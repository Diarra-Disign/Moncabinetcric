-- ============================================================================
-- Détails des rendez-vous
-- ============================================================================
--
-- calendar_events ne portait ni la plateforme de visioconférence, ni le
-- lien de réunion, ni la plage horaire lisible. Un rendez-vous en visio ne
-- pouvait donc pas être enregistré sans perdre l'essentiel : le moyen de
-- s'y connecter.
--
-- C'est aussi ce qui avait fait échouer la migration du portail client,
-- dont les vues référençaient ces colonnes inexistantes.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.calendar_events add column if not exists platform    text;
alter table public.calendar_events add column if not exists link        text;
alter table public.calendar_events add column if not exists time        text;
alter table public.calendar_events add column if not exists hour        integer;
alter table public.calendar_events add column if not exists day_name    text;
alter table public.calendar_events add column if not exists notes       text;
alter table public.calendar_events add column if not exists duration_minutes integer;

comment on column public.calendar_events.link is
  'Lien de réunion. Transmis au client : ne jamais y stocker autre chose qu''une URL de visioconférence.';

-- Le solde en fidéicommis n'a rien à faire sur un rendez-vous : il se lit
-- sur le dossier. L'interface en écrivait un, codé en dur, sur chaque
-- rendez-vous créé.
alter table public.calendar_events drop column if exists trust_balance;

commit;
