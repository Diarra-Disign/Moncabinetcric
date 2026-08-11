-- ============================================================================
-- Index sur firm_id — les quatre qui manquaient réellement
-- ============================================================================
--
-- Remplace 20260811000000_firm_id_indexes.sql, qui n'a JAMAIS pu s'appliquer.
-- Ce fichier-là créait treize index, dont un sur `public.trust_register` — une
-- table qui n'existe pas. Le nom venait du titre de la migration du registre de
-- fidéicommis, pas de son contenu : les vraies tables sont trust_ledger et
-- trust_reconciliations.
--
-- `IF NOT EXISTS` porte sur le nom de l'INDEX, jamais sur la table. La ligne
-- levait donc « relation does not exist », et comme tout tenait dans un
-- begin/commit, les treize index étaient annulés ensemble. L'optimisation
-- annoncée n'a jamais existé.
--
-- POURQUOI QUATRE ET NON TREIZE — et cette liste ne doit pas être « complétée ».
--
-- Trente-huit tables portent firm_id. Trente et une ont déjà un index, posé par
-- la migration qui les a créées. Parmi les sept restantes, trois n'en ont pas
-- besoin : Postgres en crée un tout seul derrière une clé primaire ou une
-- contrainte unique.
--
--   ai_connector_settings   firm_id est la clé primaire
--   audit_chain_heads       firm_id est la clé primaire
--   firm_subscriptions      firm_id porte une contrainte unique
--
-- Ajouter un second index sur ces colonnes-là ne fait pas gagner une lecture :
-- il coûte de l'écriture à chaque insertion et de l'espace, pour rien.
--
-- Restent les quatre ci-dessous. Chacune est filtrée par RLS sur
-- `firm_id = public.current_firm_id()` et n'avait aucun index pour le servir.
-- ============================================================================

begin;

-- Pièces rattachées à une échéance. Lue à chaque ouverture d'un dossier.
create index if not exists idx_deadline_documents_firm_id
  on public.deadline_documents (firm_id);

-- Règles d'échéance du cabinet. Relue par le moteur à chaque calcul de date.
create index if not exists idx_deadline_rules_firm_id
  on public.deadline_rules (firm_id);

-- firm_id y est NULLABLE — une demande de démonstration précède le cabinet.
-- L'index reste utile : Postgres indexe les NULL en B-tree, et la recherche
-- porte sur les demandes déjà rattachées.
create index if not exists idx_demo_requests_firm_id
  on public.demo_requests (firm_id);

-- Le plus sollicité des quatre : chaque affichage de facture lit ses lignes,
-- et invoice_totals() les relit pour recalculer le total.
create index if not exists idx_invoice_lines_firm_id
  on public.invoice_lines (firm_id);

commit;
