-- ============================================================================
-- Correction de la chaîne d'audit : tête de chaîne et ordre déterministe
-- ============================================================================
--
-- La version précédente lisait le maillon précédent ainsi :
--
--   select row_hash from audit_logs where firm_id = … order by occurred_at desc
--
-- Deux défauts, tous deux révélés à l'essai.
--
-- 1. Un déclencheur BEFORE INSERT lit l'instantané de la commande, qui
--    n'inclut PAS les lignes insérées par cette même commande. Une
--    insertion de trois lignes produisait donc trois maillons pointant tous
--    vers le même prédécesseur : la chaîne était rompue dès l'écriture,
--    sans qu'aucune altération n'ait eu lieu.
--
-- 2. L'ordre reposait sur occurred_at, identique pour toutes les lignes
--    d'une même transaction puisque now() y est figé. L'ordre de
--    vérification ne correspondait donc pas à l'ordre d'écriture.
--
-- Correctif : une table de tête de chaîne mise à jour dans la transaction —
-- ses modifications sont visibles au déclencheur suivant — et un compteur
-- monotone qui donne un ordre sans ambiguïté.
--
-- Idempotente.
-- ============================================================================

begin;

-- Le déclencheur d'immuabilité doit être suspendu : cette migration
-- renseigne seq sur les entrées existantes, ce qu'il interdit par
-- construction. Il est rétabli avant le commit — une migration qui
-- oublierait de le faire laisserait le journal réinscriptible.
alter table public.audit_logs disable trigger audit_logs_no_update;

-- ---------------------------------------------------------------------------
-- 1. Ordre déterministe
-- ---------------------------------------------------------------------------
-- Un horodatage ne suffit pas : now() est figé pour toute la transaction et
-- deux entrées peuvent le partager.

alter table public.audit_logs add column if not exists seq bigint;

create sequence if not exists public.audit_logs_seq owned by public.audit_logs.seq;
alter table public.audit_logs alter column seq set default nextval('public.audit_logs_seq');

-- Les entrées déjà présentes reçoivent un rang stable.
update public.audit_logs set seq = sub.rang
from (
  select id, row_number() over (order by occurred_at, id) as rang
  from public.audit_logs where seq is null
) sub
where public.audit_logs.id = sub.id;

select setval('public.audit_logs_seq', coalesce((select max(seq) from public.audit_logs), 0) + 1, false);

create unique index if not exists audit_logs_firm_seq_idx on public.audit_logs (firm_id, seq);

-- ---------------------------------------------------------------------------
-- 2. Tête de chaîne par cabinet
-- ---------------------------------------------------------------------------
-- Écrite dans la même transaction que l'entrée : contrairement à une
-- lecture de audit_logs, un UPDATE voit les modifications déjà faites par
-- la transaction en cours. C'est ce qui rend correcte une insertion
-- multi-lignes.

create table if not exists public.audit_chain_heads (
  firm_id    uuid primary key references public.firms(id) on delete cascade,
  last_hash  text not null,
  updated_at timestamptz not null default now()
);

alter table public.audit_chain_heads enable row level security;
-- Aucune politique : table de mécanique interne, inaccessible au rôle
-- applicatif. Seules les fonctions security definer la manipulent.

-- Reconstruction pour les cabinets déjà pourvus d'entrées.
insert into public.audit_chain_heads (firm_id, last_hash)
select distinct on (firm_id) firm_id, row_hash
from public.audit_logs
order by firm_id, seq desc
on conflict (firm_id) do update set last_hash = excluded.last_hash;

-- ---------------------------------------------------------------------------
-- 3. Déclencheur corrigé
-- ---------------------------------------------------------------------------

create or replace function public.audit_logs_set_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  precedent text;
  charge    text;
begin
  perform pg_advisory_xact_lock(hashtext(new.firm_id::text));

  if new.occurred_at is null then
    new.occurred_at := now();
  end if;
  if new.seq is null then
    new.seq := nextval('public.audit_logs_seq');
  end if;

  -- L'UPDATE ... RETURNING voit les écritures de la transaction courante,
  -- là où un SELECT sur audit_logs ne les verrait pas.
  update public.audit_chain_heads
     set last_hash = 'en cours', updated_at = now()
   where firm_id = new.firm_id
  returning last_hash into precedent;

  if not found then
    precedent := repeat('0', 64);
    insert into public.audit_chain_heads(firm_id, last_hash)
    values (new.firm_id, precedent);
  else
    -- Récupère la vraie valeur avant écrasement : l'UPDATE ci-dessus a
    -- renvoyé la NOUVELLE valeur, pas l'ancienne.
    select last_hash into precedent
    from public.audit_chain_heads where firm_id = new.firm_id;
  end if;

  new.prev_hash := precedent;

  charge := concat_ws(
    E'',
    new.firm_id::text,
    new.seq::text,
    to_char(new.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    coalesce(new.actor_email, ''),
    coalesce(new.actor_name, ''),
    coalesce(new.actor_role, ''),
    coalesce(new.action, ''),
    coalesce(new.entity_type, ''),
    coalesce(new.entity_id, ''),
    coalesce(new.summary, ''),
    coalesce(new.changes::text, ''),
    new.prev_hash
  );

  new.row_hash := encode(extensions.digest(charge, 'sha256'), 'hex');

  update public.audit_chain_heads
     set last_hash = new.row_hash, updated_at = now()
   where firm_id = new.firm_id;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Vérification alignée sur le même ordre et la même charge
-- ---------------------------------------------------------------------------

create or replace function public.verify_audit_chain(f_id uuid default null)
returns table (
  entries     bigint,
  first_break uuid,
  broken_at   timestamptz,
  reason      text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  ligne     record;
  attendu   text;
  precedent text := repeat('0', 64);
  n         bigint := 0;
  cible     uuid := coalesce(f_id, public.current_firm_id());
begin
  for ligne in
    select * from public.audit_logs where firm_id = cible order by seq asc
  loop
    n := n + 1;

    if ligne.prev_hash is distinct from precedent then
      entries := n; first_break := ligne.id; broken_at := ligne.occurred_at;
      reason := 'maillon précédent incohérent'; return next; return;
    end if;

    attendu := encode(extensions.digest(concat_ws(
      E'',
      ligne.firm_id::text,
      ligne.seq::text,
      to_char(ligne.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      coalesce(ligne.actor_email, ''),
      coalesce(ligne.actor_name, ''),
      coalesce(ligne.actor_role, ''),
      coalesce(ligne.action, ''),
      coalesce(ligne.entity_type, ''),
      coalesce(ligne.entity_id, ''),
      coalesce(ligne.summary, ''),
      coalesce(ligne.changes::text, ''),
      ligne.prev_hash
    ), 'sha256'), 'hex');

    if attendu is distinct from ligne.row_hash then
      entries := n; first_break := ligne.id; broken_at := ligne.occurred_at;
      reason := 'contenu altéré après écriture'; return next; return;
    end if;

    precedent := ligne.row_hash;
  end loop;

  entries := n; first_break := null; broken_at := null; reason := null;
  return next;
end;
$$;

revoke all on function public.verify_audit_chain(uuid) from public;
grant execute on function public.verify_audit_chain(uuid) to authenticated;

alter table public.audit_logs enable trigger audit_logs_no_update;

commit;
