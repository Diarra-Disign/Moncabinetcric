-- ============================================================================
-- Les taux de taxe doivent tenir en entier, et rester des taux
-- ============================================================================
--
-- 1. PRÉCISION. numeric(6,4) ne garde que quatre décimales : la TVQ du Québec,
--    9,975 %, y devenait 0,0998. Sur une facture de 650 $, cela produit
--    64,87 $ au lieu de 64,84 $ — trois cents d'écart, sur chaque facture,
--    dans le sens qui surfacture le client. Une taxe mal calculée n'est pas un
--    arrondi d'affichage : c'est un montant perçu sans fondement, et c'est
--    Revenu Québec qui en juge.
--
--    Le défaut ne se voyait nulle part : le total s'affichait proprement, il
--    était simplement faux. Mon propre contrôle avait d'ailleurs inscrit
--    64,87 $ comme valeur attendue — il vérifiait que le logiciel se trompait
--    de façon reproductible.
--
-- 2. BORNES. Rien n'empêchait d'enregistrer un taux de 5 — soit 500 %. Une
--    faute de frappe dans l'écran des paramètres aurait facturé cinq cents
--    pour cent de taxe à tous les clients, et le calcul, lui, aurait
--    parfaitement fonctionné.
-- ============================================================================

begin;

alter table public.firms
  alter column tax_gst_rate type numeric(8,6),
  alter column tax_qst_rate type numeric(8,6);

-- Les valeurs déjà tronquées sont rétablies. Sans cela, les cabinets créés
-- avant cette migration garderaient 0,0998 : la colonne saurait porter le bon
-- taux, et contiendrait toujours le mauvais.
update public.firms set tax_qst_rate = 0.09975 where tax_qst_rate = 0.0998;

alter table public.firms alter column tax_qst_rate set default 0.09975;

alter table public.firms drop constraint if exists firms_tax_rates_plausibles;
alter table public.firms
  add constraint firms_tax_rates_plausibles
  check (tax_gst_rate >= 0 and tax_gst_rate <= 1
     and tax_qst_rate >= 0 and tax_qst_rate <= 1);

commit;
