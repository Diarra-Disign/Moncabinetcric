-- ============================================================================
-- Les fonctions cessent de servir le cabinet qu'on leur nomme
-- ============================================================================
--
-- ─── CE QUI A ÉTÉ CONSTATÉ, EN PRODUCTION ──────────────────────────────────
--
-- Une session ouverte pour un membre du cabinet A, puis l'identifiant du
-- cabinet B passé en paramètre :
--
--     Lecture directe des tables (RLS)
--       trust_ledger     0 ligne du cabinet B     ✓
--       payments         0 ligne du cabinet B     ✓
--       clients          0 ligne du cabinet B     ✓
--
--     Par les fonctions, en leur DONNANT le cabinet B
--       firm_trust_balance      4242
--       firm_trust_by_client    2 lignes — avec le NOM des clients
--       firm_trust_ledger_view  3 lignes — le registre entier
--
-- La RLS est correcte et n'a jamais faibli. Ce sont ces fonctions qui la
-- contournent : `security definer` leur donne les pleins pouvoirs, elles
-- reçoivent le cabinet en paramètre, et aucune ne vérifiait à qui elle
-- répondait. Dix-sept fonctions étaient dans ce cas.
--
-- Pour un consultant réglementé, le simple fait qu'une personne soit sa
-- cliente est confidentiel. `firm_trust_by_client` rendait des noms.
--
-- ─── POURQUOI UNE GARDE, ET NON `security invoker` ─────────────────────────
--
-- Basculer ces fonctions en `security invoker` fermerait la fuite d'un mot :
-- la RLS s'appliquerait d'elle-même. Mais plusieurs sont appelées depuis des
-- déclencheurs et des politiques, où l'appelant n'a pas les droits de lecture
-- nécessaires. On aurait échangé une fuite contre des pannes silencieuses.
--
-- ─── LES TROIS APPELANTS LÉGITIMES ─────────────────────────────────────────
--
-- La garde doit laisser passer exactement trois cas, et rien d'autre :
--
--   · la clé de service — webhooks Stripe, actions de serveur, scripts ;
--   · un membre qui demande SON cabinet ;
--   · un administrateur de la plateforme, dont c'est le métier.
--
-- `auth.role()` lit la revendication du jeton et n'est PAS altérée par
-- `security definer` — contrairement à `current_user`, qui vaudrait le
-- propriétaire de la fonction et rendrait la garde inopérante. C'est le piège
-- classique de ce genre de correctif.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. La garde
-- ---------------------------------------------------------------------------

create or replace function public.peut_lire_cabinet(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select f_id is not null and (
       auth.role() = 'service_role'
    or f_id = public.current_firm_id()
    or public.is_platform_admin()
  );
$$;

comment on function public.peut_lire_cabinet(uuid) is
  'L''appelant a-t-il le droit de lire les données de ce cabinet ? Clé de '
  'service, membre du cabinet lui-même, ou administrateur de la plateforme. '
  'À poser dans toute fonction security definer recevant un cabinet en '
  'paramètre : sans elle, le paramètre EST la faille.';

revoke all on function public.peut_lire_cabinet(uuid) from public, anon;
grant execute on function public.peut_lire_cabinet(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Les lectures — la garde REND VIDE, elle ne lève pas
-- ---------------------------------------------------------------------------
--
-- Une exception obligerait chaque appelant à la traiter, et un appelant
-- interne oublié tomberait en panne. Une clause de plus dans le `where` rend
-- une liste vide : l'appelant légitime ne voit aucune différence, l'autre
-- n'obtient rien.

create or replace function public.firm_trust_ledger_view(f_id uuid)
returns table (
  id uuid, entry_type text, amount numeric, signed_amount numeric,
  occurred_on date, client_id uuid, client_name text, matter_id uuid,
  matter_reference text, invoice_number text, memo text,
  recorded_by_name text, created_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    l.id, l.entry_type, l.amount,
    public.trust_signe(l.entry_type) * l.amount,
    l.occurred_on, l.client_id, c.name, l.matter_id, m.reference,
    i.invoice_number, l.memo, p.full_name, l.created_at
  from public.trust_ledger l
  join public.clients c on c.id = l.client_id
  left join public.matters m on m.id = l.matter_id
  left join public.invoices i on i.id = l.invoice_id
  left join public.profiles p on p.id = l.recorded_by
  where l.firm_id = f_id
    and public.peut_lire_cabinet(f_id)
  order by l.occurred_on desc, l.created_at desc;
$$;

create or replace function public.firm_trust_by_client(f_id uuid)
returns table (
  client_id uuid, client_name text, balance numeric,
  last_movement date, entries bigint
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    c.id, c.name,
    coalesce(sum(public.trust_signe(l.entry_type) * l.amount), 0)::numeric(12,2),
    max(l.occurred_on),
    count(l.id)
  from public.trust_ledger l
  join public.clients c on c.id = l.client_id
  where l.firm_id = f_id
    and public.peut_lire_cabinet(f_id)
  group by c.id, c.name
  having coalesce(sum(public.trust_signe(l.entry_type) * l.amount), 0) <> 0
      or count(l.id) > 0
  order by 3 desc, 2;
$$;

create or replace function public.firm_trust_balance(f_id uuid)
returns numeric
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(sum(public.trust_signe(l.entry_type) * l.amount), 0)::numeric(12,2)
    from public.trust_ledger l
   where l.firm_id = f_id
     and public.peut_lire_cabinet(f_id);
$$;

create or replace function public.firm_invoices_view(f_id uuid)
returns table (
  id uuid, invoice_number text, client_id uuid, client_name text,
  client_email text, matter_id uuid, matter_reference text,
  service_description text, amount numeric, paid_amount numeric,
  balance numeric, status text, date date, due_on date,
  is_trust_account boolean
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.id, i.invoice_number, i.client_id,
    coalesce(c.name, i.client_name), c.email,
    i.matter_id, m.reference, i.service_description, i.amount,
    public.invoice_paid_amount(i.id),
    -- Le solde peut être négatif si un client a trop versé : on ne le ramène
    -- pas à zéro. Un trop-perçu est un fait comptable, pas une erreur à
    -- masquer — c'est de l'argent qui lui est dû.
    i.amount - public.invoice_paid_amount(i.id),
    public.invoice_status(i.id),
    i.date, i.due_on,
    coalesce(i.is_trust_account, false)
  from public.invoices i
  left join public.clients c on c.id = i.client_id
  left join public.matters m on m.id = i.matter_id
  where i.firm_id = f_id
    and public.peut_lire_cabinet(f_id)
  order by i.date desc, i.invoice_number desc;
$$;

create or replace function public.firm_deadlines_view(f_id uuid)
returns table (
  id uuid, matter_reference text, client_name text, program text,
  title text, due_on date, days_remaining integer, severity text,
  status text, assignee_name text, is_regulatory boolean,
  completed_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    d.id, m.reference, coalesce(c.name, m.client_name), m.program,
    d.title, d.due_on, (d.due_on - current_date)::int,
    -- La gravité se DÉDUIT de la date et de la nature réglementaire. La
    -- colonne priority reste le jugement du consultant ; l'urgence, elle,
    -- ne se décrète pas : une échéance à trois jours est critique même si
    -- personne n'a pensé à la marquer telle.
    case
      when d.due_on <= current_date + 14 then 'critical'
      when d.due_on <= current_date + 30 then 'high'
      else 'normal'
    end,
    case public.deadline_status(d.status, d.due_on)
      when 'done' then 'done'
      when 'cancelled' then 'dismissed'
      else 'open'
    end,
    coalesce(p.full_name, ''),
    d.is_regulatory, d.completed_at
  from public.matter_deadlines d
  join public.matters m on m.id = d.matter_id
  left join public.clients c on c.id = m.client_id
  left join public.profiles p on p.id = d.assignee_id
  where d.firm_id = f_id
    and public.peut_lire_cabinet(f_id)
  order by d.due_on, d.due_time nulls last;
$$;

create or replace function public.firm_deadline_alerts(f_id uuid, jours integer default 7)
returns table (depassees integer, aujourdhui integer, a_venir integer)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    count(*) filter (where d.due_on <  current_date)::int,
    count(*) filter (where d.due_on =  current_date)::int,
    count(*) filter (where d.due_on >  current_date
                       and d.due_on <= current_date + jours)::int
    from public.matter_deadlines d
   where d.firm_id = f_id
     and public.peut_lire_cabinet(f_id)
     and d.status in ('todo','in_progress');
$$;

-- ---------------------------------------------------------------------------
-- 3. L'écriture — celle-ci LÈVE, et la garde y est plus fine
-- ---------------------------------------------------------------------------
--
-- `notifier` déposait une notification dans N'IMPORTE QUEL cabinet, avec un
-- titre, un corps et un LIEN choisis par l'appelant. C'est un hameçonnage
-- interne signé par la plateforme elle-même — le plus grave de la série,
-- parce qu'il écrit au lieu de lire.
--
-- Une lecture vide ne gêne personne ; une notification silencieusement perdue
-- masquerait un vrai défaut. Celle-ci refuse donc bruyamment.
--
-- MAIS LA GARDE NE VISE QUE LES COMPTES CONNECTÉS, et c'est essentiel :
-- six déclencheurs appellent cette fonction, dont ceux du questionnaire
-- PUBLIC, rempli par un candidat sans compte, par la clé anonyme. Une garde
-- exigeant `current_firm_id()` aurait cassé les questionnaires de tous les
-- candidats — une régression silencieuse, découverte par les clients.
--
-- `anon` ne peut pas appeler cette fonction directement : l'exécution lui est
-- retirée depuis `20260810130000`. Le seul chemin anonyme passe donc par les
-- déclencheurs, où le cabinet vient de la LIGNE écrite et non de l'appelant.

create or replace function public.notifier(
  p_firm_id uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_link text default null,
  p_profile_id uuid default null,
  p_client_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  nouvel_id uuid;
begin
  if auth.role() = 'authenticated'
     and p_firm_id is distinct from public.current_firm_id()
     and not public.is_platform_admin() then
    raise exception 'Notification refusée : ce cabinet n''est pas le vôtre.'
      using errcode = '42501';
  end if;

  insert into public.notifications
    (firm_id, kind, title, body, link, profile_id, client_id, entity_type, entity_id)
  values
    (p_firm_id, p_kind, p_title, p_body, p_link, p_profile_id, p_client_id, p_entity_type, p_entity_id)
  returning id into nouvel_id;
  return nouvel_id;
end;
$$;

revoke all on function public.notifier(uuid, text, text, text, text, uuid, uuid, text, uuid) from public, anon;

commit;

-- ---------------------------------------------------------------------------
-- CE QUI RESTE À FAIRE — deuxième passe
-- ---------------------------------------------------------------------------
--
-- Dix fonctions gardent la même forme, avec un enjeu moindre. Elles sont
-- traitées à part parce qu'elles sont appelées depuis des politiques RLS et
-- des contraintes, où une garde mal posée ferme l'accès à tout le monde :
--
--   · trust_reconciliation_status  — des soldes
--   · firm_seat_counts, firm_seats_taken, firm_seat_limit
--        — un effectif ; dix-neuf appels internes à éprouver un par un
--   · next_invoice_number, next_client_file_number, next_matter_reference
--        — consommer la séquence d'un autre cabinet y creuse des trous de
--          numérotation, ce qui en inspection ressemble à des factures
--          supprimées
--   · firm_access_open, firm_effective_plan, firm_has_feature
--        — plan et état d'abonnement ; appelées dans les politiques RLS
--          elles-mêmes, ce sont les plus délicates de toutes
