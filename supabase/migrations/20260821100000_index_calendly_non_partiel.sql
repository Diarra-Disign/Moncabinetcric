-- ============================================================================
-- L'index de déduplication cesse d'être partiel
-- ============================================================================
--
-- La migration précédente posait :
--
--     create unique index … on calendar_events (firm_id, source, external_id)
--       where external_id is not null;
--
-- La clause `where` visait à laisser coexister les saisies manuelles, qui n'ont
-- pas d'identifiant externe. Elle rendait l'index INUTILISABLE pour la relève,
-- et l'upsert échouait :
--
--     42P10 — there is no unique or exclusion constraint matching the
--             ON CONFLICT specification
--
-- Pour qu'un index PARTIEL serve à `on conflict`, l'instruction doit répéter sa
-- condition — `on conflict (a, b, c) where external_id is not null`. PostgREST
-- n'expose que la liste des colonnes : il n'existe aucun moyen de transmettre
-- le prédicat depuis l'application.
--
-- ─── ET LA CLAUSE ÉTAIT INUTILE ────────────────────────────────────────────
--
-- PostgreSQL considère deux NULL comme DISTINCTS dans un index unique. Mille
-- rendez-vous saisis à la main, tous à `external_id is null`, ne se heurtent
-- donc jamais — sans aucune clause. La précaution ne protégeait rien et cassait
-- la fonction qu'elle accompagnait.
--
-- Idempotente.
-- ============================================================================

begin;

drop index if exists public.calendar_events_source_externe_unique;

create unique index if not exists calendar_events_source_externe_unique
  on public.calendar_events (firm_id, source, external_id);

comment on index public.calendar_events_source_externe_unique is
  'Empêche la relève de dupliquer un rendez-vous déjà connu. NON PARTIEL : un '
  'index partiel ne peut pas être visé par « on conflict » sans répéter sa '
  'condition, que PostgREST ne sait pas transmettre. Les saisies manuelles '
  'restent libres parce que Postgres tient deux NULL pour distincts.';

commit;
