-- ============================================================================
-- Indexation B-Tree des colonnes multi-tenant (firm_id)
-- ============================================================================
--
-- Contexte : Les politiques Row Level Security (RLS) filtrent chaque requête
-- avec `firm_id = public.current_firm_id()`. Sans index B-Tree sur la colonne
-- firm_id, PostgreSQL effectue un scan séquentiel (Sequential Scan) complet de
-- chaque table sur chaque requête.
--
-- Cette migration ajoute des index B-tree idempotents (IF NOT EXISTS) sur toutes
-- les tables métiers hébergeant un cloisonnement par cabinet (firm_id).
-- ============================================================================

begin;

CREATE INDEX IF NOT EXISTS idx_matters_firm_id ON public.matters (firm_id);
CREATE INDEX IF NOT EXISTS idx_clients_firm_id ON public.clients (firm_id);
CREATE INDEX IF NOT EXISTS idx_leads_firm_id ON public.leads (firm_id);
CREATE INDEX IF NOT EXISTS idx_invoices_firm_id ON public.invoices (firm_id);
CREATE INDEX IF NOT EXISTS idx_documents_firm_id ON public.documents (firm_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_firm_id ON public.calendar_events (firm_id);
CREATE INDEX IF NOT EXISTS idx_deadline_rules_firm_id ON public.deadline_rules (firm_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_firm_id ON public.audit_logs (firm_id);
CREATE INDEX IF NOT EXISTS idx_signatures_firm_id ON public.signatures (firm_id);
CREATE INDEX IF NOT EXISTS idx_seat_requests_firm_id ON public.seat_requests (firm_id);
CREATE INDEX IF NOT EXISTS idx_notifications_firm_id ON public.notifications (firm_id);
CREATE INDEX IF NOT EXISTS idx_trust_register_firm_id ON public.trust_register (firm_id);
CREATE INDEX IF NOT EXISTS idx_client_questionnaires_firm_id ON public.client_questionnaires (firm_id);

commit;
