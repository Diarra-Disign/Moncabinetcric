-- ============================================================================
-- Migration 0002 : Données Initiales (Seed Data) MonCabinetCRIC
-- ============================================================================

-- 1. Insertion du Cabinet Officiel par Défaut
INSERT INTO public.firms (id, name, rcic_license_number, owner_name)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Cabinet Immigration Boréale Inc.',
  'R-514982',
  'Adama Diarra'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insertion des Clients Initiaux
INSERT INTO public.clients (firm_id, legacy_id, file_number, name, first_name, last_name, email, phone, citizenship, residence, province, program, status, intake_motif, client_type)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'cli-1', 'CRIC-2026-0101', 'Jean Tremblay', 'Jean', 'Tremblay', 'jean.tremblay@example.ca', '+1 514 555-0101', 'France', 'Montréal, QC', 'QC', 'PEQ Travailleur', 'active', 'Demande de CSQ via PEQ', 'individual'),
  ('11111111-1111-1111-1111-111111111111', 'cli-2', 'CRIC-2026-0102', 'Sophie Dubois', 'Sophie', 'Dubois', 'sophie.dubois@example.fr', '+33 6 12 34 56 78', 'France', 'Paris, France', NULL, 'Entrée Express - FSTP', 'active', 'Immigration permanente Fédéral', 'individual'),
  ('11111111-1111-1111-1111-111111111111', 'cli-3', 'CRIC-2026-0103', 'TechNord Inc.', NULL, NULL, 'contact@technord.ca', '+1 418 555-0199', 'Canada', 'Québec, QC', 'QC', 'EIMT Simplifiée', 'active', 'Recrutement international 5 développeurs', 'employer')
ON CONFLICT (legacy_id) DO NOTHING;

-- 3. Insertion des Dossiers Initiaux (Matters)
INSERT INTO public.matters (firm_id, reference, client_name, client_type, program, category, opened_date, deadline, rcic, status, urgency_days, notes, is_priority)
VALUES
  ('11111111-1111-1111-1111-111111111111', '#DOS-35695', 'Jean Tremblay', 'b2c', 'PEQ Travailleur', 'pr', '2026-01-10', '2026-08-15', 'Adama Diarra', 'valid', 12, 'Dossier complet, attente CSQ MIFI', true),
  ('11111111-1111-1111-1111-111111111111', '#DOS-35696', 'TechNord Inc.', 'b2b', 'EIMT Simplifiée', 'work', '2026-02-01', '2026-08-10', 'Adama Diarra', 'alert', 5, 'Poste développeur senior. Délais EESD serrés', false),
  ('11111111-1111-1111-1111-111111111111', '#DOS-35697', 'Sophie Dubois', 'b2c', 'Entrée Express', 'pr', '2026-03-12', '2026-09-01', 'Adama Diarra', 'valid', 30, 'Invitation à présenter une demande (ITA) reçue', false)
ON CONFLICT (reference) DO NOTHING;

-- 4. Insertion des Leads Initiaux
INSERT INTO public.leads (firm_id, legacy_id, name, company, type, visa_type, estimated_value, score, score_label, stage, last_contact, email, phone, notes)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'lead-1', 'Marc-André Gagnon', NULL, 'b2c', 'Permis d''études', 2500.00, 85, 'high', 'consultation', '2026-08-01', 'magagnon@example.ca', '+1 514 555-0144', 'Admis à l''Université de Montréal pour Hiver 2027'),
  ('11111111-1111-1111-1111-111111111111', 'lead-2', 'AeroTek Solutions', 'AeroTek', 'b2b', 'EIMT & Permis de Travail', 12500.00, 92, 'high', 'proposal', '2026-07-28', 'hr@aerotek.ca', '+1 438 555-0188', 'Besoin de 3 ingénieurs aéronautiques en Mobilité Francophone')
ON CONFLICT (legacy_id) DO NOTHING;

-- 5. Insertion des Factures et Fidéicommis Initiaux
INSERT INTO public.invoices (firm_id, legacy_id, invoice_number, client_name, service_description, amount, date, status, is_trust_account, tax_exempt)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'inv-1', '#FAC-202601', 'Jean Tremblay', 'Honoraires professionnels - Mandat PEQ Travailleur (Étape 1)', 1500.00, '2026-01-15', 'paid', false, false),
  ('11111111-1111-1111-1111-111111111111', 'inv-2', '#FID-202602', 'TechNord Inc.', 'Dépôt en Fidéicommis - Avance sur débours gouvernementaux EIMT / MIFI', 3500.00, '2026-02-05', 'trust_reconciled', true, true)
ON CONFLICT (invoice_number) DO NOTHING;
