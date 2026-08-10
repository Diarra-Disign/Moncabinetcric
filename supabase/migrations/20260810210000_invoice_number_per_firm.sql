-- ============================================================================
-- Le numéro de facture est unique DANS un cabinet, pas dans le monde
-- ============================================================================
--
-- invoices_invoice_number_key portait sur la seule colonne invoice_number :
-- l'unicité était GLOBALE. Le premier cabinet à émettre « FAC-2026-000001 »
-- interdisait ce numéro à tous les autres, définitivement.
--
-- Le défaut ne se voyait pas tant qu'un seul cabinet facturait. Il serait
-- apparu au deuxième — sous la forme d'un refus incompréhensible, sur une
-- facture parfaitement légitime, chez un client qui n'a rien à voir avec le
-- cabinet ayant pris le numéro le premier.
--
-- Chaque cabinet tient sa propre suite : c'est ce que fait toute
-- comptabilité, et c'est ce que next_invoice_number() calcule déjà, par
-- cabinet. Seule la contrainte disait autre chose.
-- ============================================================================

begin;

alter table public.invoices drop constraint if exists invoices_invoice_number_key;

-- invoices_number_firm_unique (firm_id, invoice_number) existe déjà et prend
-- le relais : elle dit la même règle, à la bonne échelle.

commit;
