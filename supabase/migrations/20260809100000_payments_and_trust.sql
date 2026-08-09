-- ============================================================================
-- Paiements et registre de fidéicommis
-- ============================================================================
--
-- Jusqu'ici, l'application facturait sans jamais enregistrer d'encaissement :
-- il n'existait aucune table de paiements. `invoices.is_trust_account` marquait
-- la FACTURE, pas l'argent reçu — si bien qu'« une facture de 1 000 $ payée à
-- moitié » était inexprimable, et qu'aucun total en fidéicommis ne pouvait être
-- produit.
--
-- ---------------------------------------------------------------------------
-- POURQUOI UN REGISTRE, ET PAS SEULEMENT UNE ÉTIQUETTE
-- ---------------------------------------------------------------------------
-- Marquer chaque paiement « fidéicommis » ou « entreprise » suffirait à
-- ventiler des totaux. Ça ne suffit pas à tenir un compte en fidéicommis.
--
-- L'argent d'un client déposé en fidéicommis ne devient celui du cabinet que
-- lorsque les honoraires sont GAGNÉS, et ce transfert est un mouvement qui doit
-- se constater. Sans registre, ce virement se ferait à la banque sans laisser
-- de trace ici, et le total affiché par l'application cesserait de correspondre
-- au relevé bancaire — précisément ce qu'une inspection professionnelle
-- compare.
--
-- Le registre porte donc les quatre mouvements réels : dépôt, virement vers
-- l'entreprise, remboursement au client, retrait.
--
-- ---------------------------------------------------------------------------
-- LA RÈGLE CARDINALE
-- ---------------------------------------------------------------------------
-- Le solde en fidéicommis d'un client ne peut JAMAIS devenir négatif. Un solde
-- débiteur signifie qu'on a utilisé l'argent d'un client pour un autre : c'est
-- la faute la plus grave en matière de fidéicommis, et elle ne se découvre
-- normalement qu'au rapprochement, des mois plus tard.
--
-- Elle est tenue par un DÉCLENCHEUR, et non par l'interface. Une vérification
-- écrite dans un écran ne protège que ce qui passe par cet écran ; celle-ci
-- vaut aussi pour une action de serveur oubliée, un script d'importation, ou
-- une correction faite à la main.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Les paiements reçus
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete restrict,
  matter_id    uuid references public.matters(id) on delete set null,
  invoice_id   uuid references public.invoices(id) on delete set null,

  -- Le même type que invoices.amount. Mélanger des dollars et des cents entre
  -- deux tables qui s'additionnent produit des écarts d'un facteur cent, et
  -- ils se voient sur un relevé, pas dans un test.
  amount       numeric(12,2) not null check (amount > 0),
  currency     text not null default 'CAD',

  paid_on      date not null default current_date,
  method       text not null
               check (method in ('card','interac','bank_transfer','cheque','cash','other')),
  -- Numéro de transaction, de chèque, ou référence du virement.
  reference    text,

  -- SANS VALEUR PAR DÉFAUT, volontairement. Le brief exige que le choix soit
  -- obligatoire ; un défaut le rendrait facultatif dans les faits, et c'est
  -- « entreprise » qu'on choisirait par défaut, donc l'erreur la plus grave.
  destination  text not null check (destination in ('trust','business')),

  recorded_by  uuid references public.profiles(id) on delete set null,
  notes        text,
  created_at   timestamptz not null default now()
);

comment on table public.payments is
  'Encaissements reçus. `destination` dit où les fonds ont été déposés : fidéicommis ou compte de l''entreprise.';

create index if not exists payments_firm_idx    on public.payments(firm_id, paid_on desc);
create index if not exists payments_client_idx  on public.payments(client_id, paid_on desc);
create index if not exists payments_invoice_idx on public.payments(invoice_id);
create index if not exists payments_matter_idx  on public.payments(matter_id);

-- ---------------------------------------------------------------------------
-- 2. Le registre de fidéicommis
-- ---------------------------------------------------------------------------
-- Une écriture par mouvement. Le solde n'est stocké nulle part : il se calcule.
-- Un solde stocké se désynchronise de ses écritures au premier incident, et
-- c'est alors le solde — faux — qu'on croit.

create table if not exists public.trust_ledger (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete restrict,
  matter_id    uuid references public.matters(id) on delete set null,

  entry_type   text not null check (entry_type in (
                 'deposit',              -- le client verse en fidéicommis
                 'transfer_to_business', -- honoraires gagnés, virés au cabinet
                 'refund_to_client',     -- remboursement du solde au client
                 'withdrawal'            -- débours payé pour le compte du client
               )),
  amount       numeric(12,2) not null check (amount > 0),
  occurred_on  date not null default current_date,

  -- Le paiement qui a produit ce dépôt, s'il y en a un. `restrict` : on ne
  -- supprime pas un paiement dont une écriture dépend.
  payment_id   uuid references public.payments(id) on delete restrict,
  -- La facture dont les honoraires sont virés, pour un transfert.
  invoice_id   uuid references public.invoices(id) on delete set null,

  memo         text,
  recorded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

comment on table public.trust_ledger is
  'Mouvements du compte en fidéicommis. Le solde se calcule à partir des écritures, il n''est jamais stocké.';

create index if not exists trust_ledger_firm_idx   on public.trust_ledger(firm_id, occurred_on desc);
create index if not exists trust_ledger_client_idx on public.trust_ledger(client_id, occurred_on desc);

-- Un dépôt ne peut naître que d'un paiement, et un paiement ne peut produire
-- qu'un dépôt. Sans cet index, une réexécution d'un traitement doublerait le
-- solde du client sans que rien ne le signale.
create unique index if not exists trust_ledger_un_depot_par_paiement
  on public.trust_ledger(payment_id) where entry_type = 'deposit' and payment_id is not null;

-- ---------------------------------------------------------------------------
-- 3. Le sens d'un mouvement, et les soldes
-- ---------------------------------------------------------------------------

create or replace function public.trust_signe(t text)
returns int language sql immutable as $$
  select case when t = 'deposit' then 1 else -1 end;
$$;

create or replace function public.client_trust_balance(c_id uuid)
returns numeric
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(sum(public.trust_signe(l.entry_type) * l.amount), 0)::numeric(12,2)
    from public.trust_ledger l
   where l.client_id = c_id;
$$;

create or replace function public.firm_trust_balance(f_id uuid)
returns numeric
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(sum(public.trust_signe(l.entry_type) * l.amount), 0)::numeric(12,2)
    from public.trust_ledger l
   where l.firm_id = f_id;
$$;

revoke all on function public.client_trust_balance(uuid) from public;
revoke all on function public.firm_trust_balance(uuid) from public;
grant execute on function public.client_trust_balance(uuid) to authenticated;
grant execute on function public.firm_trust_balance(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. La règle cardinale : jamais de solde débiteur
-- ---------------------------------------------------------------------------

create or replace function public.enforce_trust_balance()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  solde numeric;
begin
  -- Calculé APRÈS l'écriture, dans la même transaction : c'est le solde qui
  -- résulterait de l'opération qu'on vérifie, pas celui d'avant.
  select public.client_trust_balance(new.client_id) into solde;

  if solde < 0 then
    raise exception
      'Solde en fidéicommis débiteur interdit : le client passerait à %. Un solde négatif signifie que les fonds d''un autre client seraient employés.',
      to_char(solde, 'FM999999990.00')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trust_ledger_balance_guard on public.trust_ledger;
create constraint trigger trust_ledger_balance_guard
  after insert or update or delete on public.trust_ledger
  deferrable initially immediate
  for each row execute function public.enforce_trust_balance();

-- ---------------------------------------------------------------------------
-- 5. Un paiement en fidéicommis crée son dépôt, sans qu'on ait à y penser
-- ---------------------------------------------------------------------------
-- Le faire depuis l'application laisserait la porte ouverte à un encaissement
-- enregistré sans écriture au registre — l'argent apparaîtrait dans les
-- totaux du cabinet sans jamais entrer dans le compte en fidéicommis.

create or replace function public.payment_to_trust_ledger()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.destination = 'trust' then
    insert into public.trust_ledger
      (firm_id, client_id, matter_id, entry_type, amount, occurred_on,
       payment_id, invoice_id, memo, recorded_by)
    values
      (new.firm_id, new.client_id, new.matter_id, 'deposit', new.amount, new.paid_on,
       new.id, new.invoice_id, 'Dépôt automatique à l''enregistrement du paiement', new.recorded_by)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists payments_trust_deposit on public.payments;
create trigger payments_trust_deposit
  after insert on public.payments
  for each row execute function public.payment_to_trust_ledger();

-- Le montant et la destination d'un paiement ne se modifient plus après coup :
-- l'écriture du registre a déjà été produite, et la corriger silencieusement
-- ferait diverger le registre du paiement. Une erreur se corrige par une
-- écriture inverse, comme en comptabilité — c'est ce qui laisse une trace.
create or replace function public.payments_immutable_money()
returns trigger
language plpgsql as $$
begin
  if new.amount is distinct from old.amount
     or new.destination is distinct from old.destination
     or new.client_id is distinct from old.client_id then
    raise exception
      'Le montant, la destination et le client d''un paiement ne se modifient pas. Corriger par une écriture inverse au registre.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_no_money_edit on public.payments;
create trigger payments_no_money_edit
  before update on public.payments
  for each row execute function public.payments_immutable_money();

-- ---------------------------------------------------------------------------
-- 6. Les statuts de facture, et ce qui se calcule
-- ---------------------------------------------------------------------------
-- La contrainte n'admettait que « paid », « pending » et « trust_reconciled ».
-- Le brief en demande six. Trois d'entre eux — payée, partiellement payée, en
-- retard — se DÉDUISENT des paiements et de l'échéance : les stocker les
-- ferait dériver dès le premier encaissement enregistré ailleurs.
--
-- On stocke donc la seule chose qui relève d'une décision — brouillon, émise,
-- annulée — et l'on calcule le reste.

alter table public.invoices add column if not exists due_on date;
comment on column public.invoices.due_on is
  'Échéance de paiement. Sans elle, « en retard » ne veut rien dire.';

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('draft','issued','cancelled',
                    -- Conservés : des lignes existantes peuvent les porter, et
                    -- une migration qui invalide des données déjà écrites est
                    -- une migration qui échoue en production.
                    'paid','pending','trust_reconciled'));

create or replace function public.invoice_paid_amount(i_id uuid)
returns numeric
language sql stable security definer set search_path = public, pg_temp
as $$
  select coalesce(sum(p.amount), 0)::numeric(12,2)
    from public.payments p where p.invoice_id = i_id;
$$;

/**
 * Statut effectif d'une facture.
 *
 * Une décision explicite l'emporte toujours : une facture annulée reste
 * annulée même si un paiement lui est rattaché, et un brouillon n'est jamais
 * « en retard ».
 */
create or replace function public.invoice_status(i_id uuid)
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  with f as (select * from public.invoices where id = i_id),
       r as (select public.invoice_paid_amount(i_id) as regle)
  select case
    when (select status from f) in ('draft','cancelled') then (select status from f)
    when (select regle from r) <= 0
      and (select due_on from f) is not null
      and (select due_on from f) < current_date                    then 'overdue'
    when (select regle from r) <= 0                                then 'issued'
    when (select regle from r) >= (select amount from f)           then 'paid'
    else 'partial'
  end;
$$;

revoke all on function public.invoice_paid_amount(uuid) from public;
revoke all on function public.invoice_status(uuid) from public;
grant execute on function public.invoice_paid_amount(uuid) to authenticated;
grant execute on function public.invoice_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Une permission propre aux mouvements de fidéicommis
-- ---------------------------------------------------------------------------
-- Enregistrer un encaissement et SORTIR de l'argent du fidéicommis ne sont pas
-- le même geste. Le second engage la responsabilité professionnelle du
-- consultant réglementé ; il ne suit donc pas `invoices.write`.

insert into public.permissions (key, label_fr, label_en, category, rank, owner_only, description_fr)
values ('trust.manage', 'Mouvements de fidéicommis', 'Trust account movements', 'argent', 35, false,
        'Virer des honoraires gagnés vers le compte de l''entreprise, rembourser un client, enregistrer un débours. Le dépôt, lui, suit l''enregistrement du paiement.')
on conflict (key) do update set
  label_fr = excluded.label_fr, label_en = excluded.label_en,
  category = excluded.category, description_fr = excluded.description_fr;

insert into public.role_permissions (cicc_role, permission, granted) values
  ('owner','trust.manage',      true),
  ('rcic','trust.manage',       true),
  ('bookkeeper','trust.manage', true),
  ('risia','trust.manage',      false),
  ('staff','trust.manage',      false),
  ('readonly','trust.manage',   false)
on conflict (cicc_role, permission) do update set granted = excluded.granted;

-- ---------------------------------------------------------------------------
-- 8. Cloisonnement
-- ---------------------------------------------------------------------------
-- Mêmes principes que partout : le cabinet vient de la session, jamais de la
-- ligne. Un client du portail n'a AUCUNE politique ici — ni paiements, ni
-- registre. Ce que le client doit voir de ses finances passera par une vue
-- dédiée, choisie, et non par un accès direct à la comptabilité du cabinet.

alter table public.payments     enable row level security;
alter table public.trust_ledger enable row level security;

drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select to authenticated
  using (firm_id = public.current_firm_id());

drop policy if exists payments_write on public.payments;
create policy payments_write on public.payments
  for insert to authenticated
  with check (firm_id = public.current_firm_id() and public.member_can('invoices.write'));

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments
  for update to authenticated
  using (firm_id = public.current_firm_id() and public.member_can('invoices.write'))
  with check (firm_id = public.current_firm_id());

drop policy if exists trust_ledger_read on public.trust_ledger;
create policy trust_ledger_read on public.trust_ledger
  for select to authenticated
  using (firm_id = public.current_firm_id());

-- Les dépôts naissent du déclencheur, qui est SECURITY DEFINER et ne passe
-- donc pas par cette politique. Ce qui reste ici, ce sont les mouvements
-- décidés par une personne — ceux qui font SORTIR de l'argent.
drop policy if exists trust_ledger_write on public.trust_ledger;
create policy trust_ledger_write on public.trust_ledger
  for insert to authenticated
  with check (
    firm_id = public.current_firm_id()
    and public.member_can('trust.manage')
    and entry_type <> 'deposit'
  );

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   -- Aucun client ne doit jamais afficher un solde négatif :
--   select c.name, public.client_trust_balance(c.id) as solde
--     from public.clients c
--    where public.client_trust_balance(c.id) < 0;
--
--   -- Ventilation comptable, jamais mélangée :
--   select destination, sum(amount) from public.payments group by destination;
--
--   -- Le registre doit égaler la somme des dépôts moins les sorties :
--   select f.name,
--          public.firm_trust_balance(f.id) as registre,
--          (select coalesce(sum(p.amount),0) from public.payments p
--            where p.firm_id = f.id and p.destination = 'trust') as encaisse_en_fideicommis
--     from public.firms f;
-- ============================================================================
