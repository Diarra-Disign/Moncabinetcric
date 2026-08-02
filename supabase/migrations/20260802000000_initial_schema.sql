-- ============================================================================
-- Migration 0001 : Schéma Fondateur MonCabinetCRIC (Conformité CICC & Multi-tenant)
-- ============================================================================

-- 1. Table des Cabinets (Multi-locataire)
CREATE TABLE IF NOT EXISTS public.firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rcic_license_number TEXT NOT NULL DEFAULT 'R-514982',
  owner_name TEXT NOT NULL DEFAULT 'Adama Diarra',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Profils Utilisateurs CICC
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  cicc_role TEXT NOT NULL DEFAULT 'rcic' CHECK (cicc_role IN ('owner', 'rcic', 'risia', 'staff', 'bookkeeper', 'readonly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Clients & Candidats
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  legacy_id TEXT UNIQUE,
  file_number TEXT NOT NULL,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  citizenship TEXT NOT NULL DEFAULT '',
  residence TEXT NOT NULL DEFAULT '',
  province TEXT,
  program TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consultation', 'pending')),
  intake_motif TEXT NOT NULL DEFAULT '',
  client_type TEXT CHECK (client_type IN ('individual', 'employer')),
  neq_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Dossiers d'Immigration (Matters)
CREATE TABLE IF NOT EXISTS public.matters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  reference TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  client_type TEXT CHECK (client_type IN ('b2b', 'b2c')),
  program TEXT NOT NULL,
  category TEXT CHECK (category IN ('pr', 'work', 'study', 'sponsorship', 'appeal')),
  opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE NOT NULL,
  rcic TEXT NOT NULL DEFAULT 'Adama Diarra',
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'alert', 'review', 'pending')),
  urgency_days INT DEFAULT 0,
  notes TEXT,
  is_priority BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Leads & CRM Pipeline
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  legacy_id TEXT UNIQUE,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  type TEXT NOT NULL CHECK (type IN ('b2b', 'b2c')),
  visa_type TEXT NOT NULL,
  estimated_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 50,
  score_label TEXT NOT NULL CHECK (score_label IN ('high', 'med', 'low')),
  stage TEXT NOT NULL CHECK (stage IN ('newLead', 'consultation', 'proposal', 'negotiation', 'signed')),
  last_contact DATE NOT NULL DEFAULT CURRENT_DATE,
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  lmia_positions INT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Factures & Fidéicommis (Invoices)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  legacy_id TEXT UNIQUE,
  matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  client_name TEXT NOT NULL,
  service_description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'trust_reconciled')),
  is_trust_account BOOLEAN NOT NULL DEFAULT false,
  tax_exempt BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Coffre-fort Documentaire (Documents)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  legacy_id TEXT UNIQUE,
  matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('client_upload', 'consultant_upload', 'contract', 'invoice', 'ircc_form')),
  uploaded_by TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiration DATE NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('valid', 'invalid', 'archived')),
  client_name TEXT,
  file_size TEXT,
  sha256 TEXT,
  storage_path TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Événements Agenda (Calendar Events)
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  legacy_id TEXT UNIQUE,
  matter_id UUID REFERENCES public.matters(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_initials TEXT DEFAULT '',
  avatar_bg TEXT DEFAULT '',
  program TEXT,
  type TEXT NOT NULL,
  platform TEXT,
  link TEXT,
  date DATE NOT NULL,
  day_name TEXT DEFAULT '',
  time TEXT DEFAULT '',
  hour INT DEFAULT 9,
  status TEXT NOT NULL DEFAULT 'confirmed',
  trust_balance TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Journal d'Audit Inaltérable (Audit Logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  legacy_id TEXT UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_member_id TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  actor_name TEXT NOT NULL DEFAULT '',
  actor_role TEXT NOT NULL DEFAULT 'rcic',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  matter_id TEXT,
  summary TEXT NOT NULL DEFAULT '',
  changes JSONB,
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  prev_hash TEXT DEFAULT '',
  row_hash TEXT NOT NULL
);

-- 10. Règles d'Échéances Réglementaires
CREATE TABLE IF NOT EXISTS public.deadline_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  program TEXT NOT NULL,
  step_name TEXT NOT NULL,
  delay_days INT NOT NULL,
  is_regulatory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Sécurité RLS (Row Level Security) Multi-Tenant
-- ============================================================================
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadline_rules ENABLE ROW LEVEL SECURITY;

-- Politiques RLS permissives pour la clé Anon en environnement de développement local ou authentifié
CREATE POLICY "Allow public read access for dev" ON public.firms FOR SELECT USING (true);
CREATE POLICY "Allow public read access for dev" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow public read access for dev" ON public.matters FOR SELECT USING (true);
CREATE POLICY "Allow public read access for dev" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Allow public read access for dev" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Allow public read access for dev" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow public read access for dev" ON public.calendar_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access for dev" ON public.audit_logs FOR SELECT USING (true);

CREATE POLICY "Allow public write access for dev" ON public.clients FOR ALL USING (true);
CREATE POLICY "Allow public write access for dev" ON public.matters FOR ALL USING (true);
CREATE POLICY "Allow public write access for dev" ON public.leads FOR ALL USING (true);
CREATE POLICY "Allow public write access for dev" ON public.invoices FOR ALL USING (true);
CREATE POLICY "Allow public write access for dev" ON public.documents FOR ALL USING (true);
CREATE POLICY "Allow public write access for dev" ON public.calendar_events FOR ALL USING (true);
CREATE POLICY "Allow public write access for dev" ON public.audit_logs FOR ALL USING (true);
