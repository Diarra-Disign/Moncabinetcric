-- ============================================================================
-- Deuxième passe : le noyau des droits, les sièges et la numérotation
-- ============================================================================
--
-- La première passe (20260818090000) a fermé six lectures et une écriture. Il
-- restait onze fonctions de la même forme — un cabinet en paramètre, aucune
-- vérification — laissées de côté parce qu'elles touchent au cœur des droits.
--
-- ─── CE QUI FUITAIT ────────────────────────────────────────────────────────
--
-- Toutes étaient exécutables par `anon`, c'est-à-dire par la clé publique que
-- tout navigateur télécharge avec l'application. Avec l'identifiant d'un
-- cabinet concurrent, on obtenait :
--
--     firm_effective_plan      son forfait
--     firm_access_open         si son abonnement est à jour
--     firm_seats_taken         son effectif
--     next_invoice_number      son préfixe ET son volume de factures
--     next_client_file_number  son nombre de clients
--     trust_reconciliation_status  la date de son dernier rapprochement
--
-- Aucun nom de client ici — la première passe s'en était chargée. Mais le
-- volume d'affaires et la santé financière d'un confrère sont exactement ce
-- qu'on ne veut pas voir circuler.
--
-- ─── POURQUOI LA GARDE DE LA PREMIÈRE PASSE NE SUFFIT PAS ──────────────────
--
-- `peut_lire_cabinet()` appelle `current_firm_id()`, qui appelle
-- `firm_access_open()`. La poser dans `firm_access_open` bouclerait sur
-- elle-même : récursion infinie, et toute requête de l'application tombe.
--
-- Second obstacle, moins visible et plus grave : `peut_lire_cabinet()` exige
-- un ABONNEMENT OUVERT, puisque `current_firm_id()` rend null dès que l'accès
-- est fermé. Appliquée aux fonctions de forfait et de sièges, elle aurait
-- rendu « aucun forfait, zéro siège » à un cabinet suspendu — c'est-à-dire à
-- l'écran même qui lui sert à se réabonner. On aurait fermé la porte de
-- sortie.
--
-- D'où une SECONDE garde, qui répond à une autre question :
--
--     peut_lire_cabinet(f)   « ce cabinet est-il le mien, et est-il ouvert ? »
--     membre_du_cabinet(f)   « ce cabinet est-il le mien ? »              ← ici
--
-- La seconde ne consulte que l'appartenance, en lisant `profiles` et
-- `client_users` directement. Elle n'appelle ni `current_firm_id()` ni
-- `firm_access_open()`, donc aucune récursion n'est possible.
--
-- ─── LE PORTAIL CLIENT, QU'ON A FAILLI OUBLIER ─────────────────────────────
--
-- `current_client_id()` appelle `firm_access_open(cu.firm_id)` où `cu` est une
-- ligne de `client_users` : l'appelant est un CLIENT, pas un membre du
-- cabinet. Une garde qui n'aurait regardé que `profiles` aurait rendu faux,
-- `current_client_id()` aurait rendu null, et le portail client entier serait
-- devenu inaccessible — sans message, sans erreur, une page vide.
--
-- ─── CE QU'UNE GARDE REFUSÉE REND ──────────────────────────────────────────
--
-- Jamais une exception : ces fonctions sont appelées depuis des politiques RLS
-- et un déclencheur, où une exception fait échouer l'écriture d'un innocent.
-- Elles rendent la réponse vide — faux, null, zéro ligne.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. La garde d'appartenance, sans récursion possible
-- ---------------------------------------------------------------------------

create or replace function public.membre_du_cabinet(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f_id is not null and (
       auth.role() = 'service_role'
    or exists (
         select 1 from public.profiles p
          where p.user_id = auth.uid()
            and p.firm_id = f_id
            and p.status  = 'active')
    -- Le portail client : ces comptes n'ont pas de profil, mais ils ont
    -- légitimement affaire à ce cabinet.
    or exists (
         select 1 from public.client_users cu
          where cu.user_id = auth.uid()
            and cu.firm_id = f_id)
    or public.is_platform_admin()
  );
$$;

comment on function public.membre_du_cabinet(uuid) is
  'L''appelant appartient-il à ce cabinet ? Ne consulte QUE l''appartenance, '
  'jamais l''état de l''abonnement : c''est ce qui permet à un cabinet '
  'suspendu de voir son propre forfait et de se réabonner. Ne dépend ni de '
  'current_firm_id() ni de firm_access_open(), donc utilisable à l''intérieur '
  'de ceux-ci sans récursion.';

revoke all on function public.membre_du_cabinet(uuid) from public, anon;
grant execute on function public.membre_du_cabinet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Le noyau : accès, forfait, fonctionnalités
-- ---------------------------------------------------------------------------
--
-- `firm_access_open` est la fonction la plus appelée de la base : six
-- fonctions et l'ouverture de session en dépendent. Le seul appelant qui ne
-- soit pas `security definer` est `firms_access_state()`, invoquée par
-- l'application — elle ne lit que les cabinets que la RLS lui laisse voir,
-- donc le sien.

create or replace function public.firm_access_open(f_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.firms f
    left join public.firm_subscriptions s on s.firm_id = f.id
    where f.id = f_id
      and public.membre_du_cabinet(f_id)
      -- La suspension décidée depuis la console reste souveraine : elle ferme
      -- même un cabinet parfaitement à jour de ses paiements.
      and f.status = 'active'
      and (
        (f.plan = 'trial'
          and (f.trial_ends_at is null or f.trial_ends_at >= current_date))
        or f.plan = 'courtoisie'
        or (s.status in ('active', 'trialing'))
        or (s.status in ('past_due', 'unpaid')
            and s.grace_until is not null
            and s.grace_until >= now())
      )
  );
$$;

create or replace function public.firm_effective_plan(f_id uuid)
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when not public.membre_du_cabinet(f_id) then null else coalesce(
    (select s.plan
       from public.firm_subscriptions s
      where s.firm_id = f_id
        and (
          s.status in ('active', 'trialing')
          or (s.status in ('past_due', 'unpaid')
              and s.grace_until is not null
              and s.grace_until >= now())
        )),
    (select f.plan from public.firms f where f.id = f_id)
  ) end;
$$;

-- Neuf politiques RLS d'insertion appellent celle-ci, toutes réservées au rôle
-- `authenticated`, toujours avec le cabinet de la LIGNE écrite. Un membre qui
-- écrit chez lui passe ; la RLS refusait déjà d'écrire ailleurs.
create or replace function public.firm_has_feature(f_id uuid, feature_key text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.membre_du_cabinet(f_id) and coalesce(
    -- 1. Ce qui ne se vend pas.
    (select true from public.features f
      where f.key = feature_key and f.always_on),
    -- 2. L'exception accordée au cabinet, tant qu'elle court.
    (select o.enabled from public.firm_feature_overrides o
      where o.firm_id = f_id and o.feature = feature_key
        and (o.expires_at is null or o.expires_at > now())),
    -- 3. Le forfait réellement payé — jamais celui écrit à la main dans
    --    firms.plan, cf. firm_effective_plan().
    (select pf.enabled from public.plan_features pf
      where pf.plan = public.firm_effective_plan(f_id) and pf.feature = feature_key),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Les sièges
-- ---------------------------------------------------------------------------
--
-- `firm_seat_limit` et `firm_seats_taken` sont appelées par le déclencheur
-- `enforce_seat_limit`, qui s'exécute pendant l'insertion d'un profil ou
-- d'une invitation. `membre_du_cabinet()` y répond vrai : l'écriture vient
-- soit de la clé de service, soit d'un membre du cabinet concerné. Une garde
-- fondée sur `current_firm_id()` aurait rendu zéro pendant le déclencheur,
-- et le plafond de sièges aurait cessé d'être appliqué sans que rien ne le
-- signale — un plafond qui laisse passer est pire qu'un plafond absent.

create or replace function public.firm_seat_counts(f_id uuid)
returns table(cicc_role text, n integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select r.cicc_role, count(*)::int as n
  from (
    select p.cicc_role
      from public.profiles p
     where p.firm_id = f_id and p.status = 'active'
    union all
    select i.cicc_role
      from public.invitations i
     where i.firm_id = f_id
       and i.accepted_at is null
       and i.revoked_at is null
       and i.expires_at > now()
  ) r
  where public.membre_du_cabinet(f_id)
  group by r.cicc_role;
$$;

create or replace function public.firm_seat_limit(f_id uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp
as $$
  with cap as (
    select l.max_seats
      from public.plan_limits l
     where l.plan = public.firm_effective_plan(f_id)
  )
  select case
    when not public.membre_du_cabinet(f_id) then null
    -- Sans plafond au forfait, sans plafond ici. Ajouter extra_seats à null
    -- donnerait null de toute façon ; le dire explicitement évite qu'on croie
    -- à un oubli.
    when (select max_seats from cap) is null then null
    else (select max_seats from cap)
         + coalesce((select f.extra_seats from public.firms f where f.id = f_id), 0)
  end;
$$;

create or replace function public.firm_seats_taken(f_id uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp
as $$
  select case when not public.membre_du_cabinet(f_id) then 0 else
    (select count(*) from public.profiles p
      where p.firm_id = f_id and p.status = 'active')
  + (select count(*) from public.invitations i
      where i.firm_id = f_id
        and i.accepted_at is null
        and i.revoked_at is null
        and i.expires_at > now())
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. La numérotation
-- ---------------------------------------------------------------------------
--
-- Rectification d'une note de la première passe : ces fonctions sont en
-- lecture seule et calculent « le plus grand + 1 ». Elles NE CONSOMMENT PAS
-- de séquence, et un appel étranger ne creusait donc aucun trou de
-- numérotation. Ce qu'elles livraient est autre chose : le préfixe du cabinet
-- et son VOLUME — combien de factures, combien de clients, combien de
-- dossiers cette année. C'est du renseignement commercial.
--
-- Ici la garde d'accès complet convient : on ne numérote une pièce nouvelle
-- que dans un cabinet ouvert.

create or replace function public.next_client_file_number(p_firm_id uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  annee text := to_char(current_date, 'YYYY');
  rang  int;
begin
  if not public.peut_lire_cabinet(p_firm_id) then return null; end if;

  select coalesce(max(
    nullif(regexp_replace(file_number, '^CRIC-' || annee || '-', ''), file_number)::int
  ), 0) + 1
  into rang
  from public.clients
  where firm_id = p_firm_id
    and file_number ~ ('^CRIC-' || annee || '-[0-9]+$');

  return 'CRIC-' || annee || '-' || lpad(rang::text, 4, '0');
end;
$$;

create or replace function public.next_invoice_number(p_firm_id uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  annee   text := to_char(current_date, 'YYYY');
  prefixe text;
  rang    int;
begin
  if not public.peut_lire_cabinet(p_firm_id) then return null; end if;

  select coalesce(nullif(trim(f.invoice_prefix), ''), 'FAC')
    into prefixe from public.firms f where f.id = p_firm_id;

  select coalesce(max(
    nullif(regexp_replace(invoice_number, '^' || prefixe || '-' || annee || '-', ''), invoice_number)::int
  ), 0) + 1
  into rang
  from public.invoices
  where firm_id = p_firm_id
    and invoice_number ~ ('^' || prefixe || '-' || annee || '-[0-9]+$');

  return prefixe || '-' || annee || '-' || lpad(rang::text, 6, '0');
end;
$$;

create or replace function public.next_matter_reference(p_firm_id uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  annee   text := to_char(current_date, 'YYYY');
  prefixe text;
  rang    int;
begin
  if not public.peut_lire_cabinet(p_firm_id) then return null; end if;

  select coalesce(
           nullif(trim(f.matter_prefix), ''),
           upper(regexp_replace(substring(f.name from 1 for 3), '[^a-zA-Z]', '', 'g'))
         )
  into prefixe
  from public.firms f
  where f.id = p_firm_id;

  -- Une raison sociale sans lettre — « 9412-3344 Québec inc. » — ne donnerait
  -- rien du tout ; le repli garantit un préfixe dans tous les cas.
  if prefixe is null or prefixe = '' then prefixe := 'DOS'; end if;

  select coalesce(max(
    nullif(regexp_replace(reference, '^' || prefixe || '-' || annee || '-', ''), reference)::int
  ), 0) + 1
  into rang
  from public.matters
  where firm_id = p_firm_id
    and reference ~ ('^' || prefixe || '-' || annee || '-[0-9]+$');

  return prefixe || '-' || annee || '-' || lpad(rang::text, 5, '0');
end;
$$;

create or replace function public.prochaine_reference_rencontre(f_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  annee text := to_char(current_date, 'YYYY');
  prefixe text := 'REN-' || annee || '-';
  max_num integer := 0;
  dernier text;
begin
  if not public.peut_lire_cabinet(f_id) then return null; end if;

  select reference into dernier
    from public.matter_meeting_notes
   where firm_id = f_id
     and reference like prefixe || '%'
   order by reference desc
   limit 1;

  if dernier is not null then
    max_num := coalesce(substring(dernier from 'REN-[0-9]{4}-([0-9]+)')::integer, 0);
  end if;

  return prefixe || lpad((max_num + 1)::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Le rapprochement du fidéicommis
-- ---------------------------------------------------------------------------
--
-- Le solde qu'elle rend passait déjà par `firm_trust_balance()`, gardée à la
-- première passe. Restaient la date du dernier rapprochement et le fait
-- qu'un cabinet soit ou non en retard — un renseignement dont la place n'est
-- nulle part ailleurs que chez lui.

create or replace function public.trust_reconciliation_status(f_id uuid)
returns table(last_period date, last_closed_at timestamptz, days_since integer,
              overdue boolean, ledger_balance numeric)
language sql stable security definer set search_path = public, pg_temp
as $$
  with dernier as (
    select period_end, closed_at
      from public.trust_reconciliations
     where firm_id = f_id and status = 'closed'
     order by period_end desc
     limit 1
  )
  select
    (select period_end from dernier),
    (select closed_at from dernier),
    (current_date - coalesce((select period_end from dernier), current_date - 31))::int,
    -- Jamais rapproché compte comme en retard dès qu'il existe un mouvement :
    -- un cabinet sans compte en fidéicommis n'a rien à rapprocher, et on ne
    -- lui reproche rien.
    (current_date - coalesce((select period_end from dernier), current_date - 31))::int > 30
      and exists (select 1 from public.trust_ledger where firm_id = f_id),
    public.firm_trust_balance(f_id)
  where public.peut_lire_cabinet(f_id);
$$;

-- ---------------------------------------------------------------------------
-- 6. Retirer la clé publique du chemin
-- ---------------------------------------------------------------------------
--
-- Défense en profondeur : la garde suffit, mais rien ne justifie qu'un
-- visiteur sans compte puisse seulement APPELER ces fonctions. Aucune
-- politique RLS n'est ouverte à `anon` dans cette base, et les appels internes
-- venant de fonctions `security definer` sont contrôlés au nom du
-- propriétaire, non de l'appelant : cette révocation ne les touche pas.

revoke execute on function public.firm_access_open(uuid)                from anon;
revoke execute on function public.firm_effective_plan(uuid)             from anon;
revoke execute on function public.firm_has_feature(uuid, text)          from anon;
revoke execute on function public.firm_seat_counts(uuid)                from anon;
revoke execute on function public.firm_seat_limit(uuid)                 from anon;
revoke execute on function public.firm_seats_taken(uuid)                from anon;
revoke execute on function public.next_client_file_number(uuid)         from anon;
revoke execute on function public.next_invoice_number(uuid)             from anon;
revoke execute on function public.next_matter_reference(uuid)           from anon;
revoke execute on function public.prochaine_reference_rencontre(uuid)   from anon;
revoke execute on function public.trust_reconciliation_status(uuid)     from anon;

commit;
