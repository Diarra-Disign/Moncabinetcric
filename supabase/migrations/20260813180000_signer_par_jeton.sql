-- ---------------------------------------------------------------------------
-- Signer avec un jeton — sans compte, sans session
-- ---------------------------------------------------------------------------
-- LE PROBLÈME À RÉSOUDRE. Le signataire n'a AUCUN compte : c'est tout l'objet
-- du lien public, et le cahier des charges le demande explicitement. Il ne
-- peut donc satisfaire aucune politique RLS, qui reposent toutes sur
-- current_firm_id() ou current_client_id(). Les politiques d'insertion de
-- `signatures` exigent de surcroît `signer_user_id = auth.uid()`.
--
-- Deux fonctions SECURITY DEFINER, et seulement deux. Chacune vérifie le jeton
-- elle-même : c'est le jeton qui autorise, jamais l'appelant.
--
-- CE QUE CES FONCTIONS NE PERMETTENT PAS, et il faut le lire comme une liste
-- de refus : signer une demande annulée, expirée ou déjà complétée ; signer
-- avant son tour en mode séquentiel ; signer deux fois ; signer avec un jeton
-- révoqué ; signer un document modifié depuis l'envoi — ce dernier étant
-- refusé par le déclencheur `signatures_seal`, qui s'applique aussi ici.

-- ---------------------------------------------------------------------------
-- 1. Marquer la consultation
-- ---------------------------------------------------------------------------
-- Séparée de la signature parce qu'ouvrir n'est pas signer. La distinction
-- change ce que le consultant doit faire : relancer parce que le courriel
-- s'est perdu, ou relancer parce que la personne hésite.
create or replace function public.consulter_par_jeton(
  p_token_hash text,
  p_ip         text default null,
  p_agent      text default null
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r_id uuid;
  req_id uuid;
  nom text;
begin
  select r.id, r.request_id, r.full_name
    into r_id, req_id, nom
    from public.signature_recipients r
    join public.signature_requests req on req.id = r.request_id
   where r.token_hash = p_token_hash
     and r.revoked_at is null
     and (r.expires_at is null or r.expires_at > now())
     and req.status in ('sent', 'viewed', 'partially_signed')
   limit 1;

  if r_id is null then return false; end if;

  -- Seulement si l'on n'a pas déjà fait mieux : une personne qui a signé ne
  -- redevient pas « a consulté » parce qu'elle rouvre le lien.
  update public.signature_recipients
     set status = 'viewed', viewed_at = coalesce(viewed_at, now())
   where id = r_id and status = 'pending';

  perform public.signature_event(
    req_id, 'signature.document.opened', nom, r_id, p_ip, p_agent, '{}'::jsonb
  );

  return true;
end;
$$;

revoke all on function public.consulter_par_jeton(text, text, text) from public, anon, authenticated;
grant execute on function public.consulter_par_jeton(text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Signer
-- ---------------------------------------------------------------------------
create or replace function public.signer_par_jeton(
  p_token_hash text,
  p_courriel   text,
  p_trace      text default null,
  p_champs     jsonb default '[]'::jsonb,
  p_ip         text default null,
  p_agent      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  sig_id uuid;
  champ jsonb;
  manquants int;
begin
  select r0.id, r0.request_id, r0.firm_id, r0.full_name, r0.email, r0.role,
         r0.rcic_number, r0.rank, r0.status, r0.auth_method,
         req.document_id, req.status as req_status, req.signing_mode
    into r
    from public.signature_recipients r0
    join public.signature_requests req on req.id = r0.request_id
   where r0.token_hash = p_token_hash
     and r0.revoked_at is null
     and (r0.expires_at is null or r0.expires_at > now())
   limit 1;

  if r.id is null then
    return jsonb_build_object('ok', false, 'motif', 'JETON_INVALIDE',
      'message', 'Ce lien n''est plus valide. Demandez-en un nouveau au cabinet.');
  end if;

  if r.req_status not in ('sent', 'viewed', 'partially_signed') then
    return jsonb_build_object('ok', false, 'motif', 'DEMANDE_CLOSE',
      'message', 'Cette demande de signature n''est plus active.');
  end if;

  if r.status = 'signed' then
    return jsonb_build_object('ok', false, 'motif', 'DEJA_SIGNE',
      'message', 'Vous avez déjà signé ce document.');
  end if;

  if r.status = 'declined' then
    return jsonb_build_object('ok', false, 'motif', 'DEJA_REFUSE',
      'message', 'Vous avez refusé de signer ce document.');
  end if;

  -- L'ORDRE. En séquentiel, prendre les devants produirait un contrat signé
  -- dans le désordre : contestable, et impossible à corriger après coup.
  if r.signing_mode = 'sequential' and exists (
    select 1 from public.signature_recipients autre
    where autre.request_id = r.request_id
      and autre.rank < r.rank
      and autre.status not in ('signed', 'declined')
  ) then
    return jsonb_build_object('ok', false, 'motif', 'PAS_VOTRE_TOUR',
      'message', 'Un autre signataire doit signer avant vous. Vous serez prévenu.');
  end if;

  -- L'AUTHENTIFICATION DE LA V1 : le lien secret, plus la confirmation du
  -- courriel. Elle empêche qu'un lien transféré soit signé par quelqu'un
  -- d'autre sans qu'il s'en aperçoive. La comparaison ignore la casse et les
  -- espaces — refuser « Jean@Example.ca » pour une majuscule ferait abandonner
  -- des gens de bonne foi.
  if r.auth_method = 'email_confirm'
     and lower(trim(coalesce(p_courriel, ''))) is distinct from lower(trim(r.email)) then
    return jsonb_build_object('ok', false, 'motif', 'COURRIEL',
      'message', 'Ce courriel ne correspond pas à celui auquel le lien a été envoyé.');
  end if;

  -- Les champs obligatoires. On refuse AVANT de signer : une signature apposée
  -- sur un formulaire incomplet obligerait à tout recommencer.
  update public.signature_fields f
     set value = c.valeur, filled_at = now()
    from jsonb_to_recordset(coalesce(p_champs, '[]'::jsonb))
         as c(id uuid, valeur text)
   where f.id = c.id and f.recipient_id = r.id;

  select count(*) into manquants
    from public.signature_fields f
   where f.recipient_id = r.id
     and f.required
     and f.kind <> 'signature'
     and coalesce(nullif(trim(f.value), ''), null) is null;

  if manquants > 0 then
    return jsonb_build_object('ok', false, 'motif', 'CHAMPS',
      'message', format('Il reste %s renseignement(s) obligatoire(s) à remplir.', manquants));
  end if;

  -- LA SIGNATURE. `signatures_seal` impose ici l'empreinte du document et
  -- REFUSE si le fichier a changé depuis la demande — cette garantie
  -- s'applique au chemin public exactement comme au chemin authentifié.
  insert into public.signatures (
    request_id, firm_id, document_id, signer_kind, signer_user_id,
    signer_name, signer_email, signer_role, rcic_number,
    document_sha256, ip_address, user_agent, signature_image
  ) values (
    r.request_id, r.firm_id, r.document_id,
    case when r.role = 'consultant' then 'member' else 'client' end,
    null,
    r.full_name, r.email, r.role,
    -- LE PERMIS, enfin écrit. L'ancienne implémentation avait la colonne, le
    -- certificat l'affichait, et personne ne la remplissait.
    r.rcic_number,
    'imposé par la base', p_ip, p_agent, p_trace
  )
  returning id into sig_id;

  update public.signature_recipients
     set status = 'signed', signed_at = now(), signature_id = sig_id
   where id = r.id;

  perform public.signature_event(
    r.request_id, 'signature.signed', r.full_name, r.id, p_ip, p_agent,
    jsonb_build_object('role', r.role)
  );

  -- Le déclencheur de clôture a déjà recalculé l'état de la demande : on le
  -- relit plutôt que de le déduire une seconde fois.
  if (select status from public.signature_requests where id = r.request_id) = 'completed' then
    perform public.signature_event(
      r.request_id, 'signature.completed', 'Système', null, null, null, '{}'::jsonb
    );
  end if;

  return jsonb_build_object(
    'ok', true, 'signature_id', sig_id, 'request_id', r.request_id,
    'complete', (select status from public.signature_requests where id = r.request_id) = 'completed'
  );
end;
$$;

revoke all on function public.signer_par_jeton(text, text, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.signer_par_jeton(text, text, text, jsonb, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Refuser
-- ---------------------------------------------------------------------------
-- Refuser est un droit, et il doit être aussi simple que signer. Un signataire
-- qui n'a aucun bouton pour dire non se contente de ne rien faire — et le
-- cabinet relance indéfiniment quelqu'un qui a déjà décidé.
create or replace function public.refuser_par_jeton(
  p_token_hash text,
  p_motif      text default null,
  p_ip         text default null,
  p_agent      text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
begin
  select r0.id, r0.request_id, r0.full_name, r0.status, req.status as req_status
    into r
    from public.signature_recipients r0
    join public.signature_requests req on req.id = r0.request_id
   where r0.token_hash = p_token_hash
     and r0.revoked_at is null
     and (r0.expires_at is null or r0.expires_at > now())
   limit 1;

  if r.id is null or r.req_status not in ('sent', 'viewed', 'partially_signed') then
    return jsonb_build_object('ok', false, 'message', 'Ce lien n''est plus valide.');
  end if;

  if r.status = 'signed' then
    return jsonb_build_object('ok', false,
      'message', 'Vous avez déjà signé : un refus ne peut plus être enregistré.');
  end if;

  update public.signature_recipients
     set status = 'declined', declined_at = now()
   where id = r.id;

  update public.signature_requests
     set declined_reason = p_motif
   where id = r.request_id;

  perform public.signature_event(
    r.request_id, 'signature.declined', r.full_name, r.id, p_ip, p_agent,
    jsonb_build_object('motif', p_motif)
  );

  return jsonb_build_object('ok', true, 'request_id', r.request_id);
end;
$$;

revoke all on function public.refuser_par_jeton(text, text, text, text) from public, anon, authenticated;
grant execute on function public.refuser_par_jeton(text, text, text, text) to service_role;

comment on function public.signer_par_jeton is
  'Signature par lien public. C''est le JETON qui autorise, jamais l''appelant. Refuse : demande close, tour non venu, double signature, courriel discordant, champs obligatoires vides — et le déclencheur de scellement refuse un document modifié.';
