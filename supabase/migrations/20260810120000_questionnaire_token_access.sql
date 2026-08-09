-- ============================================================================
-- Accès à un questionnaire par lien sécurisé, sans compte
-- ============================================================================
--
-- Un prospect n'a pas de compte et ne doit pas en avoir : le brief est
-- explicite, il ne doit pas accéder au portail client. Il lui faut donc un
-- chemin qui ne passe par aucune session.
--
-- Trois précautions, dans cet ordre d'importance.
--
-- 1. La base ne connaît QUE l'empreinte du jeton. Le hachage a lieu ICI, en
--    SQL : si l'application hachait de son côté et interrogeait par
--    empreinte, alors l'empreinte deviendrait elle-même un mot de passe, et
--    une fuite de la table rendrait tous les liens utilisables.
--
-- 2. Aucune politique RLS n'est ouverte au rôle anonyme. Tout passe par ces
--    trois fonctions, qui exposent des colonnes choisies une par une. Une
--    colonne ajoutée demain à la table ne fuitera pas par distraction.
--
-- 3. Chaque envoi porte son propre jeton. Deux destinataires du même
--    questionnaire ne partagent jamais de lien — c'est ce qui garantit que
--    l'un ne verra jamais les réponses de l'autre (§21).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- L'empreinte
-- ---------------------------------------------------------------------------

create or replace function public.questionnaire_empreinte(p_token text)
returns text
language sql immutable
set search_path = public, extensions, pg_temp
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

-- ---------------------------------------------------------------------------
-- Résolution d'un jeton, avec toutes les raisons de refuser
-- ---------------------------------------------------------------------------
-- Une seule fonction interne, appelée par les trois publiques : les
-- conditions d'acceptation d'un lien ne doivent exister qu'à un seul endroit,
-- sinon « lire » et « écrire » finiront par ne plus s'accorder sur ce qu'est
-- un lien valide.

create or replace function public.questionnaire_du_jeton(p_token text)
returns public.client_questionnaires
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
declare
  q public.client_questionnaires;
begin
  -- Un jeton court n'est pas un jeton : refuser avant d'interroger évite de
  -- transformer une chaîne vide en clé passe-partout si une colonne venait
  -- un jour à contenir NULL ou ''.
  if p_token is null or length(p_token) < 32 then
    raise exception 'Lien invalide.' using errcode = 'invalid_parameter_value';
  end if;

  select * into q from public.client_questionnaires
  where token_hash = public.questionnaire_empreinte(p_token);

  if not found then
    raise exception 'Lien invalide.' using errcode = 'invalid_parameter_value';
  end if;
  if q.token_revoked_at is not null then
    raise exception 'Ce lien a été désactivé par le cabinet.' using errcode = 'invalid_parameter_value';
  end if;
  if q.status = 'cancelled' then
    raise exception 'Ce questionnaire a été annulé.' using errcode = 'invalid_parameter_value';
  end if;

  return q;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Ouvrir
-- ---------------------------------------------------------------------------
-- Marque l'ouverture au passage : c'est la seule façon de savoir qu'un envoi
-- a bien atterri. Le brief le demande (§14, « Ouvert »), et sans cela un
-- rappel partirait aussi bien vers quelqu'un qui n'a jamais reçu le courriel
-- que vers quelqu'un qui l'ignore — deux situations à traiter autrement.

create or replace function public.questionnaire_ouvrir(p_token text)
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions, pg_temp
as $$
declare
  q public.client_questionnaires;
  cabinet text;
begin
  q := public.questionnaire_du_jeton(p_token);

  if q.opened_at is null then
    update public.client_questionnaires
    set opened_at = now(),
        status = case when status = 'sent' then 'opened' else status end
    where id = q.id
    returning * into q;
  end if;

  select name into cabinet from public.firms where id = q.firm_id;

  -- Les colonnes sont énumérées une par une : ce qui n'est pas nommé ici ne
  -- sort pas, aujourd'hui ni après l'ajout d'une colonne interne.
  return jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'description', q.description,
    'sections', q.sections,
    'message', q.message,
    'answers', q.answers,
    'prefill', q.prefill,
    'corrections', q.corrections,
    'progress', q.progress,
    'status', public.questionnaire_status(q.status, q.due_date, q.token_revoked_at),
    'dueDate', q.due_date,
    'submittedAt', q.submitted_at,
    'firmName', cabinet
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Enregistrer
-- ---------------------------------------------------------------------------

create or replace function public.questionnaire_enregistrer(
  p_token text, p_answers jsonb, p_progress integer
) returns void
language plpgsql volatile security definer
set search_path = public, extensions, pg_temp
as $$
declare
  q public.client_questionnaires;
begin
  q := public.questionnaire_du_jeton(p_token);

  if q.status in ('completed') then
    raise exception 'Ce questionnaire est clos.' using errcode = 'check_violation';
  end if;
  if q.due_date is not null and q.due_date < now() then
    raise exception 'La date limite est dépassée. Demandez au cabinet de la prolonger.'
      using errcode = 'check_violation';
  end if;

  update public.client_questionnaires
  set answers = p_answers,
      progress = greatest(0, least(100, p_progress)),
      -- Un questionnaire soumis puis repris repasse « en cours » ; un
      -- questionnaire à corriger passe « corrigé ». Le statut suit le geste.
      status = case
        when status in ('sent','opened','draft') then 'in_progress'
        when status = 'to_correct' then 'corrected'
        else status end,
      last_saved_at = now(),
      updated_at = now()
  where id = q.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Soumettre
-- ---------------------------------------------------------------------------

create or replace function public.questionnaire_soumettre(p_token text)
returns void
language plpgsql volatile security definer
set search_path = public, extensions, pg_temp
as $$
declare
  q public.client_questionnaires;
begin
  q := public.questionnaire_du_jeton(p_token);

  if q.status = 'completed' then
    raise exception 'Ce questionnaire a déjà été clos par le cabinet.'
      using errcode = 'check_violation';
  end if;

  update public.client_questionnaires
  set status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  where id = q.id;
end;
$$;

-- Le rôle anonyme obtient l'exécution, jamais la table.
revoke all on function public.questionnaire_du_jeton(text) from public, anon, authenticated;

grant execute on function public.questionnaire_ouvrir(text) to anon, authenticated;
grant execute on function public.questionnaire_enregistrer(text, jsonb, integer) to anon, authenticated;
grant execute on function public.questionnaire_soumettre(text) to anon, authenticated;

commit;
