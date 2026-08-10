-- ============================================================================
-- Lignes de facture, taxes configurables, numérotation
-- ============================================================================
--
-- CE QUI EXISTAIT DÉJÀ et qu'on ne refait pas :
--
--   §11 l'architecture. invoices porte matter_id et client_id ; payments porte
--       invoice_id. Client → Dossier → Factures → Paiements est déjà la forme.
--   §5  le statut. invoice_status() le CALCULE depuis les paiements — il
--       « évolue automatiquement » sans qu'on ait rien à écrire.
--   §9  l'enregistrement d'un paiement, avec date, mode, référence et notes,
--       plus la répercussion sur le fidéicommis.
--
-- CE QUI MANQUAIT, et que voici :
--
-- 1. LES LIGNES. invoices n'avait qu'une description et un montant : une
--    facture ne pouvait pas porter « consultation 150 $ » ET « analyse
--    500 $ ». Le total devient donc une SOMME, calculée, jamais saisie — un
--    total qu'on tape à côté de lignes qu'on additionne finit par les
--    contredire, et c'est le total qu'on croit parce qu'il est en gras.
--
-- 2. LES TAUX DE TAXE. Rien ne les portait, et le brief interdit de les coder
--    en dur — à raison : ils changent par décision politique, et un cabinet
--    ne peut pas déployer. Ils vivent sur le cabinet.
--
-- 3. LE NUMÉRO. invoice_number était du texte libre, sans unicité. Deux
--    factures pouvaient porter le même numéro, ce qui est exactement ce
--    qu'une pièce comptable ne doit jamais permettre.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Les taux, sur le cabinet
-- ---------------------------------------------------------------------------

alter table public.firms
  add column if not exists tax_gst_rate numeric(6,4) not null default 0.05,
  add column if not exists tax_qst_rate numeric(6,4) not null default 0.09975,
  add column if not exists tax_gst_number text,
  add column if not exists tax_qst_number text,
  add column if not exists invoice_prefix text,
  add column if not exists payment_terms text;

comment on column public.firms.tax_gst_rate is
  'TPS. Les valeurs par défaut sont celles du Québec en 2026 ; elles ne sont '
  'PAS une vérité gravée — un taux change par décision politique, et un '
  'cabinet ne peut pas déployer pour suivre.';

-- ---------------------------------------------------------------------------
-- 2. Les lignes
-- ---------------------------------------------------------------------------

create table if not exists public.invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity    numeric(12,2) not null default 1 check (quantity > 0),
  unit_price  numeric(12,2) not null default 0 check (unit_price >= 0),
  -- Une ligne peut être exonérée sans que la facture entière le soit : des
  -- honoraires sont taxables, un débours d'IRCC ne l'est pas, et les deux
  -- figurent sur la même facture.
  taxable     boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists invoice_lines_invoice_idx on public.invoice_lines(invoice_id, position);

alter table public.invoice_lines enable row level security;

drop policy if exists invoice_lines_membre on public.invoice_lines;
create policy invoice_lines_membre on public.invoice_lines
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id());

-- ---------------------------------------------------------------------------
-- 3. Les totaux, calculés
-- ---------------------------------------------------------------------------
-- Sous-total, TPS, TVQ et total ne sont PAS stockés. Ce sont des sommes de
-- faits qui, eux, le sont : les lignes et les taux. Les stocker obligerait à
-- les recalculer à chaque modification d'une ligne, et une seule occasion
-- manquée laisserait une facture dont le total ne correspond plus à ce qu'elle
-- détaille.

create or replace function public.invoice_totals(p_invoice_id uuid)
returns table (sous_total numeric, tps numeric, tvq numeric, total numeric)
language sql stable security definer set search_path = public, pg_temp
as $$
  with f as (
    select i.id, i.tax_exempt, fi.tax_gst_rate, fi.tax_qst_rate
      from public.invoices i
      join public.firms fi on fi.id = i.firm_id
     where i.id = p_invoice_id
  ),
  l as (
    select coalesce(sum(quantity * unit_price), 0) as tout,
           coalesce(sum(quantity * unit_price) filter (where taxable), 0) as imposable
      from public.invoice_lines where invoice_id = p_invoice_id
  )
  select
    round(l.tout, 2),
    round(case when f.tax_exempt then 0 else l.imposable * f.tax_gst_rate end, 2),
    round(case when f.tax_exempt then 0 else l.imposable * f.tax_qst_rate end, 2),
    round(l.tout
          + case when f.tax_exempt then 0 else l.imposable * f.tax_gst_rate end
          + case when f.tax_exempt then 0 else l.imposable * f.tax_qst_rate end, 2)
  from f, l;
$$;

revoke all on function public.invoice_totals(uuid) from public;
grant execute on function public.invoice_totals(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Le numéro
-- ---------------------------------------------------------------------------

create or replace function public.next_invoice_number(p_firm_id uuid)
returns text
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  annee   text := to_char(current_date, 'YYYY');
  prefixe text;
  rang    int;
begin
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

revoke all on function public.next_invoice_number(uuid) from public;
grant execute on function public.next_invoice_number(uuid) to authenticated;

-- « Il ne doit jamais être possible de créer deux factures avec le même
-- numéro. » La fonction ci-dessus le CALCULE ; seul cet index l'empêche.
create unique index if not exists invoices_number_firm_unique
  on public.invoices (firm_id, invoice_number);

-- ---------------------------------------------------------------------------
-- 5. Le résumé de facturation d'un dossier (§10)
-- ---------------------------------------------------------------------------

create or replace function public.matter_billing_summary(m_id uuid)
returns table (
  nb_factures int, total_facture numeric, total_paye numeric,
  solde numeric, derniere_facture text, prochaine_echeance date
)
language sql stable security definer set search_path = public, pg_temp
as $$
  with f as (
    select i.id, i.invoice_number, i.due_on, i.date,
           (select total from public.invoice_totals(i.id)) as total,
           public.invoice_paid_amount(i.id) as paye
      from public.invoices i
     where i.matter_id = m_id and i.status <> 'cancelled'
  )
  select
    count(*)::int,
    coalesce(sum(total), 0),
    coalesce(sum(paye), 0),
    coalesce(sum(total) - sum(paye), 0),
    (select invoice_number from f order by date desc nulls last limit 1),
    (select min(due_on) from f where coalesce(total,0) > coalesce(paye,0))
  from f;
$$;

revoke all on function public.matter_billing_summary(uuid) from public;
grant execute on function public.matter_billing_summary(uuid) to authenticated;

commit;
