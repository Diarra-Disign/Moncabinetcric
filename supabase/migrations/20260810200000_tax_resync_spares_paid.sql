-- ============================================================================
-- Un changement de taux n'atteint jamais une facture déjà réglée
-- ============================================================================
--
-- Le filtre portait sur la colonne status, qui vaut encore « issued » sur une
-- facture entièrement payée : le statut « payée » est CALCULÉ depuis les
-- paiements, il n'est pas écrit. Une hausse de TVQ déplaçait donc le montant
-- d'une facture que le client avait déjà acquittée — mesuré : 747,37 $
-- devenus 747,50 $.
--
-- Les conséquences ne sont pas cosmétiques. La facture que le client détient
-- ne correspond plus à celle du cabinet ; un solde de treize cents apparaît
-- sur un dossier soldé ; et une pièce comptable émise se trouve réécrite
-- après coup, ce qu'aucune tenue de livres n'admet.
--
-- Le fait à interroger n'est donc pas le statut mais le PAIEMENT : une facture
-- qui a reçu ne serait-ce qu'un acompte est figée. Le prix demandé a été
-- accepté ; il ne se renégocie pas par un déclencheur.
-- ============================================================================

begin;

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
     set amount = (select t.total from public.invoice_totals(i.id) t)
   where i.firm_id = new.id
     and i.status in ('draft','issued','pending')
     and public.invoice_paid_amount(i.id) = 0
     and exists (select 1 from public.invoice_lines l where l.invoice_id = i.id);

  return new;
end;
$$;

commit;
