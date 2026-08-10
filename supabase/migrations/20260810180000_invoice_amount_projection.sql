-- ============================================================================
-- invoices.amount devient une projection des lignes
-- ============================================================================
--
-- Le défaut, mesuré : une facture de 747,37 $ ayant reçu un acompte de 200 $
-- s'annonçait « payée ». invoice_status() compare le versé à invoices.amount,
-- resté à 0 parce que le montant vivait désormais dans les lignes.
--
-- Deux corrections étaient possibles.
--
-- La première : faire lire à invoice_status() le total calculé. Elle ne
-- règle qu'UN lecteur. Les listes, le tableau de bord, le portail client et
-- Stripe lisent tous invoices.amount ; ils auraient continué d'afficher 0 $
-- sur une facture de 747 $, et il aurait fallu penser à chacun.
--
-- La seconde, retenue : amount cesse d'être une saisie pour devenir une
-- PROJECTION des lignes, maintenue par la base. Tout ce qui la lit — sans rien
-- changer — cesse de pouvoir contredire le détail. C'est le même geste que
-- matters.deadline, devenue la plus proche échéance ouverte.
--
-- Une facture SANS ligne garde son montant saisi : c'est la forme des
-- factures antérieures, et les priver de leur montant reviendrait à effacer
-- des pièces comptables au motif qu'elles sont anciennes.
-- ============================================================================

begin;

create or replace function public.sync_invoice_amount()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  cible uuid := coalesce(new.invoice_id, old.invoice_id);
  n     int;
begin
  select count(*) into n from public.invoice_lines where invoice_id = cible;

  -- Aucune ligne : on ne touche pas au montant. Retomber à 0 effacerait le
  -- total d'une facture dont on vient de retirer la dernière ligne par erreur.
  if n = 0 then return coalesce(new, old); end if;

  update public.invoices i
     set amount = t.total
    from public.invoice_totals(cible) t
   where i.id = cible;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_invoice_amount on public.invoice_lines;
create trigger sync_invoice_amount
  after insert or update or delete on public.invoice_lines
  for each row execute function public.sync_invoice_amount();

-- Les taux vivent sur le cabinet : les changer déplace le total de toute
-- facture non close. Sans ce déclencheur, seules les factures retouchées
-- ensuite auraient suivi, et deux factures du même jour auraient porté deux
-- TPS différentes.
create or replace function public.resync_invoices_on_tax_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.tax_gst_rate is not distinct from old.tax_gst_rate
     and new.tax_qst_rate is not distinct from old.tax_qst_rate then
    return new;
  end if;

  update public.invoices i
     set amount = t.total
    from public.invoice_totals(i.id) t
   where i.firm_id = new.id
     and i.status in ('draft','issued','pending')
     and exists (select 1 from public.invoice_lines l where l.invoice_id = i.id);

  return new;
end;
$$;

drop trigger if exists resync_invoices_on_tax_change on public.firms;
create trigger resync_invoices_on_tax_change
  after update on public.firms
  for each row execute function public.resync_invoices_on_tax_change();

-- ---------------------------------------------------------------------------
-- Le statut, inchangé dans son principe
-- ---------------------------------------------------------------------------
-- Il continue de lire amount. Ce n'est plus un défaut : amount DIT désormais
-- le total. On y ajoute seulement la garde qui manquait — un total nul ne
-- rend pas une facture « payée », alors que 0 >= 0 est vrai.

create or replace function public.invoice_status(i_id uuid)
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  with f as (select * from public.invoices where id = i_id),
       r as (select public.invoice_paid_amount(i_id) as regle)
  select case
    when (select status from f) in ('draft','cancelled') then (select status from f)
    when (select amount from f) <= 0                               then 'issued'
    when (select regle from r) <= 0
      and (select due_on from f) is not null
      and (select due_on from f) < current_date                    then 'overdue'
    when (select regle from r) <= 0                                then 'issued'
    when (select regle from r) >= (select amount from f)           then 'paid'
    else 'partial'
  end;
$$;

comment on function public.invoice_status(uuid) is
  'Statut affiché. « partial » est le « partiellement payée » du brief ; '
  '« issued » couvre l''envoyée et l''en attente de paiement, que la base ne '
  'distingue pas — l''envoi n''est pas un fait qu''elle observe.';

commit;
