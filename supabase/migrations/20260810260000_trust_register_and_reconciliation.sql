-- ============================================================================
-- Registre du fidéicommis à l'échelle du cabinet, et rapprochement bancaire
-- ============================================================================
--
-- Le socle existe déjà : payments, trust_ledger et ses quatre mouvements,
-- client_trust_balance(), firm_trust_balance(), et le déclencheur qui interdit
-- tout solde débiteur. Rien de cela ne change ici.
--
-- CE QUI MANQUAIT, et le troisième point conditionne les deux autres :
--
--   1. Aucune lecture ne rendait le registre du CABINET en un aller-retour.
--   2. Le rapprochement n'existait pas.
--   3. `withdrawal` et `refund_to_client` étaient déclarés dans la contrainte
--      de trust_ledger mais AUCUN chemin ne permettait de les écrire. Un
--      débours payé pour le compte d'un client sortait donc du compte en
--      banque sans laisser d'écriture ici. Le registre dérivait du relevé, et
--      le rapprochement n'aurait fait que MESURER cette dérive au lieu de la
--      prévenir.
--
-- ---------------------------------------------------------------------------
-- POURQUOI LE RAPPROCHEMENT EST UNE TABLE, ET NON UN CALCUL
-- ---------------------------------------------------------------------------
-- On pourrait comparer le solde du registre au solde bancaire à la volée, et
-- n'afficher que l'écart. Ce serait suffisant pour se rassurer, et inutile
-- pour un contrôle.
--
-- Ce que le Collège peut réclamer, c'est l'état d'un mois DONNÉ, tel qu'il a
-- été arrêté à l'époque, avec les explications qui étaient alors les bonnes.
-- Un calcul à la volée rendrait toujours l'état d'aujourd'hui : les écritures
-- ajoutées depuis auraient changé le passé. Un rapprochement est un CONSTAT
-- daté ; il se conserve.
--
-- D'où une table, et un verrou : une fois clos, un rapprochement ne se
-- retouche plus.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Le registre du cabinet, en une lecture
-- ---------------------------------------------------------------------------
-- Sur le modèle de firm_invoices_view : la fiche dossier calcule un solde par
-- client à coups de RPC, ce qui va pour un dossier et pas pour un cabinet.

create or replace function public.firm_trust_ledger_view(f_id uuid)
returns table (
  id           uuid,
  entry_type   text,
  amount       numeric,
  signed_amount numeric,
  occurred_on  date,
  client_id    uuid,
  client_name  text,
  matter_id    uuid,
  matter_reference text,
  invoice_number text,
  memo         text,
  recorded_by_name text,
  created_at   timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    l.id,
    l.entry_type,
    l.amount,
    -- Le signe vient de trust_signe(), la même fonction qui calcule les
    -- soldes. Le réécrire ici produirait un registre dont le total ne
    -- correspondrait pas au solde affiché à côté.
    public.trust_signe(l.entry_type) * l.amount,
    l.occurred_on,
    l.client_id,
    c.name,
    l.matter_id,
    m.reference,
    i.invoice_number,
    l.memo,
    p.full_name,
    l.created_at
  from public.trust_ledger l
  join public.clients c on c.id = l.client_id
  left join public.matters m on m.id = l.matter_id
  left join public.invoices i on i.id = l.invoice_id
  left join public.profiles p on p.id = l.recorded_by
  where l.firm_id = f_id
  order by l.occurred_on desc, l.created_at desc;
$$;

-- Le solde par client : c'est la ventilation qu'un inspecteur demande en
-- premier, parce qu'un total juste peut masquer un client débiteur compensé
-- par un autre. Le déclencheur l'interdit, mais un état doit le montrer.
create or replace function public.firm_trust_by_client(f_id uuid)
returns table (
  client_id   uuid,
  client_name text,
  balance     numeric,
  last_movement date,
  entries     bigint
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    c.id,
    c.name,
    coalesce(sum(public.trust_signe(l.entry_type) * l.amount), 0)::numeric(12,2),
    max(l.occurred_on),
    count(l.id)
  from public.trust_ledger l
  join public.clients c on c.id = l.client_id
  where l.firm_id = f_id
  group by c.id, c.name
  having coalesce(sum(public.trust_signe(l.entry_type) * l.amount), 0) <> 0
      or count(l.id) > 0
  order by 3 desc, 2;
$$;

revoke all on function public.firm_trust_ledger_view(uuid) from public;
revoke all on function public.firm_trust_by_client(uuid) from public;
grant execute on function public.firm_trust_ledger_view(uuid) to authenticated;
grant execute on function public.firm_trust_by_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Les rapprochements
-- ---------------------------------------------------------------------------

create table if not exists public.trust_reconciliations (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.firms(id) on delete cascade,

  -- Le dernier jour du mois arrêté. Une date plutôt qu'un couple (année,
  -- mois) : elle se compare, se trie et s'affiche sans arithmétique.
  period_end    date not null,

  -- Ce que dit le relevé de la banque, saisi par le cabinet.
  bank_balance  numeric(12,2) not null,
  -- Ce que disait le registre à l'instant où le rapprochement a été arrêté.
  -- FIGÉ, et c'est tout l'intérêt : recalculé plus tard, il aurait changé.
  ledger_balance numeric(12,2),

  -- Les éléments qui expliquent l'écart : chèques en circulation, dépôts en
  -- transit, frais bancaires. Chacun porte un libellé et un montant signé.
  explanations  jsonb not null default '[]'::jsonb,

  status        text not null default 'draft' check (status in ('draft','closed')),
  closed_at     timestamptz,
  closed_by     uuid references public.profiles(id) on delete set null,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles(id) on delete set null
);

comment on table public.trust_reconciliations is
  'États de rapprochement du compte en fidéicommis. Un constat DATÉ : le solde '
  'du registre y est figé, car recalculé plus tard il ne serait plus celui du mois.';

-- Un seul rapprochement par mois et par cabinet. Deux états contradictoires
-- pour la même période, c'est la situation où l'on ne sait plus lequel a été
-- remis.
create unique index if not exists trust_reconciliations_periode_unique
  on public.trust_reconciliations(firm_id, period_end);

create index if not exists trust_reconciliations_firm_idx
  on public.trust_reconciliations(firm_id, period_end desc);

alter table public.trust_reconciliations enable row level security;

drop policy if exists trust_reconciliations_firm_read on public.trust_reconciliations;
create policy trust_reconciliations_firm_read on public.trust_reconciliations
  for select using (firm_id = public.current_firm_id());

drop policy if exists trust_reconciliations_firm_write on public.trust_reconciliations;
create policy trust_reconciliations_firm_write on public.trust_reconciliations
  for all using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- ---------------------------------------------------------------------------
-- 3. Un rapprochement clos ne se retouche plus
-- ---------------------------------------------------------------------------
-- Même raisonnement que pour une facture émise : ce qui a été arrêté et
-- conservé comme pièce ne peut pas changer après coup. La RLS est
-- ligne-par-ligne et ne sait pas dire « ces colonnes-ci sont figées » : il
-- faut un déclencheur.

create or replace function public.protect_closed_reconciliation()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    -- La suppression en cascade du cabinet passe : la ligne parente n'existe
    -- déjà plus. Une suppression DIRECTE d'un état clos, non.
    if old.status = 'closed'
       and exists (select 1 from public.firms where id = old.firm_id) then
      raise exception 'Un rapprochement clos ne peut pas être supprimé : il fait foi pour la période arrêtée.'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.status = 'closed' then
    -- Seules les notes restent ouvertes : on peut annoter une pièce sans la
    -- réécrire. Les montants, la période et les explications sont figés.
    if new.bank_balance is distinct from old.bank_balance
       or new.ledger_balance is distinct from old.ledger_balance
       or new.period_end is distinct from old.period_end
       or new.explanations is distinct from old.explanations
       or new.status is distinct from old.status then
      raise exception 'Ce rapprochement est clos : ses montants et ses explications ne peuvent plus changer.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_closed_reconciliation on public.trust_reconciliations;
create trigger protect_closed_reconciliation
  before update or delete on public.trust_reconciliations
  for each row execute function public.protect_closed_reconciliation();

-- ---------------------------------------------------------------------------
-- 4. L'alerte : depuis quand le cabinet n'a-t-il pas rapproché ?
-- ---------------------------------------------------------------------------
-- Rendue par la base et non calculée dans un écran : le tableau de bord, la
-- page fidéicommis et un futur courriel de rappel doivent tous répondre la
-- même chose.

create or replace function public.trust_reconciliation_status(f_id uuid)
returns table (
  last_period date,
  last_closed_at timestamptz,
  days_since int,
  overdue boolean,
  ledger_balance numeric
)
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
    public.firm_trust_balance(f_id);
$$;

revoke all on function public.trust_reconciliation_status(uuid) from public;
grant execute on function public.trust_reconciliation_status(uuid) to authenticated;

commit;
