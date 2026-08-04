-- ============================================================================
-- Chaîne d'intégrité SHA-256 réelle du journal d'audit
-- ============================================================================
--
-- Les empreintes étaient fabriquées par l'application :
--
--   rowHash: `sha256-${Date.now()}`                    (actions.ts)
--   rowHash: Math.random().toString(36)…               (documents-client.tsx)
--   rowHash: `a${timestamp.toString(16)}f8e1d4c7…`     (audit-client.tsx)
--
-- Aucun hachage n'existait, et l'interface annonçait pourtant « intégrité
-- de la chaîne SHA-256 vérifiée : 100 % ». Une entrée pouvait être
-- réécrite sans que rien ne le révèle.
--
-- Choix structurant : le calcul appartient à un déclencheur, pas au code
-- applicatif. Une empreinte que l'application peut écrire est une
-- empreinte qu'elle peut falsifier — y compris involontairement. Le
-- déclencheur ignore ce que l'appelant fournit et recalcule tout.
--
-- Idempotente.
-- ============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Calcul de l'empreinte à l'insertion
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
  -- Sérialisation par cabinet : sans ce verrou, deux insertions simultanées
  -- liraient le même prev_hash et produiraient deux maillons concurrents,
  -- rompant la chaîne sans que personne ne l'ait altérée.
  perform pg_advisory_xact_lock(hashtext(new.firm_id::text));

  select a.row_hash into precedent
  from public.audit_logs a
  where a.firm_id = new.firm_id
  order by a.occurred_at desc, a.id desc
  limit 1;

  -- Première entrée d'un cabinet : ancrage conventionnel à 64 zéros.
  new.prev_hash := coalesce(precedent, repeat('0', 64));

  if new.occurred_at is null then
    new.occurred_at := now();
  end if;

  -- Les champs entrent dans un ordre fixe, séparés par un caractère qui ne
  -- peut apparaître dans les valeurs : sans séparateur non ambigu, deux
  -- entrées différentes pourraient produire la même chaîne.
  charge := concat_ws(
    E'',
    new.firm_id::text,
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
  return new;
end;
$$;

drop trigger if exists audit_logs_hash on public.audit_logs;
create trigger audit_logs_hash
  before insert on public.audit_logs
  for each row execute function public.audit_logs_set_hash();

-- ---------------------------------------------------------------------------
-- 2. Interdiction de modifier une entrée
-- ---------------------------------------------------------------------------
-- Les politiques RLS refusent déjà update et delete au rôle applicatif.
-- Ce déclencheur ferme le cas du rôle service_role, qui les contourne : un
-- script d'administration ne doit pas pouvoir réécrire l'histoire.

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Le journal d''audit est en ajout seul : une entrée ne peut être ni modifiée ni supprimée.';
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- 3. Vérification de la chaîne
-- ---------------------------------------------------------------------------
-- Recalcule chaque maillon et le compare à l'empreinte stockée. C'est ce
-- que l'interface prétendait faire sans jamais le faire.

create or replace function public.verify_audit_chain(f_id uuid default null)
returns table (
  entries       bigint,
  first_break   uuid,
  broken_at     timestamptz,
  reason        text
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
    select * from public.audit_logs
    where firm_id = cible
    order by occurred_at asc, id asc
  loop
    n := n + 1;

    if ligne.prev_hash is distinct from precedent then
      entries := n; first_break := ligne.id; broken_at := ligne.occurred_at;
      reason := 'maillon précédent incohérent';
      return next; return;
    end if;

    attendu := encode(extensions.digest(concat_ws(
      E'',
      ligne.firm_id::text,
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
      reason := 'contenu altéré après écriture';
      return next; return;
    end if;

    precedent := ligne.row_hash;
  end loop;

  entries := n; first_break := null; broken_at := null; reason := null;
  return next;
end;
$$;

revoke all on function public.verify_audit_chain(uuid) from public;
grant execute on function public.verify_audit_chain(uuid) to authenticated;

commit;
