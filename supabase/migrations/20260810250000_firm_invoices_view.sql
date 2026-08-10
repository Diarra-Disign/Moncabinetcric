-- ============================================================================
-- Les factures du cabinet, avec leur statut RÉEL
-- ============================================================================
--
-- L'écran Facturation du menu lisait la table invoices telle quelle et se
-- fiait à la colonne status. Or cette colonne ne dit pas tout : elle reste
-- « issued » sur une facture entièrement payée, et elle ignore qu'une échéance
-- est passée. invoice_status() est la fonction qui tranche — c'est elle que la
-- fiche dossier interroge déjà.
--
-- La fiche l'appelle FACTURE PAR FACTURE (deux RPC par ligne). Sur un dossier
-- qui en compte trois, c'est sans conséquence. Sur l'écran du cabinet, qui les
-- montre toutes, cela ferait deux allers-retours par facture — et l'écran
-- ralentirait à mesure que le cabinet réussit.
--
-- Cette vue rend la liste ET les statuts en une seule lecture. Le montant réglé
-- vient de invoice_paid_amount(), la même fonction que partout ailleurs : deux
-- arithmétiques du même fait finissent toujours par produire deux avis.
-- ============================================================================

begin;

-- Le type de retour change à chaque colonne ajoutée : « create or replace » ne
-- suffit pas, Postgres refuse de redéfinir la signature d'une fonction qui
-- rend une table.
drop function if exists public.firm_invoices_view(uuid);

create function public.firm_invoices_view(f_id uuid)
returns table (
  id uuid,
  invoice_number text,
  client_id uuid,
  client_name text,
  -- L'adresse voyage avec la ligne : c'est elle que la fenêtre de confirmation
  -- doit montrer avant d'envoyer. Un nom ne dit pas où part le document.
  client_email text,
  matter_id uuid,
  matter_reference text,
  service_description text,
  amount numeric,
  paid_amount numeric,
  balance numeric,
  status text,
  date date,
  due_on date,
  is_trust_account boolean
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    i.id,
    i.invoice_number,
    i.client_id,
    coalesce(c.name, i.client_name),
    c.email,
    i.matter_id,
    m.reference,
    i.service_description,
    i.amount,
    public.invoice_paid_amount(i.id),
    -- Le solde peut être négatif si un client a trop versé : on ne le ramène
    -- pas à zéro. Un trop-perçu est un fait comptable, pas une erreur à
    -- masquer — c'est de l'argent qui lui est dû.
    i.amount - public.invoice_paid_amount(i.id),
    public.invoice_status(i.id),
    i.date,
    i.due_on,
    coalesce(i.is_trust_account, false)
  from public.invoices i
  left join public.clients c on c.id = i.client_id
  left join public.matters m on m.id = i.matter_id
  where i.firm_id = f_id
  order by i.date desc, i.invoice_number desc;
$$;

comment on function public.firm_invoices_view(uuid) is
  'Toutes les factures d''un cabinet, statut calculé compris. Une seule lecture '
  'là où l''écran en faisait deux par facture.';

commit;
