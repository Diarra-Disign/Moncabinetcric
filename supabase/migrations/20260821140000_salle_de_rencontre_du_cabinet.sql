-- ============================================================================
-- La salle de rencontre permanente du cabinet
-- ============================================================================
--
-- ─── LE DÉFAUT CONSTATÉ ────────────────────────────────────────────────────
--
-- « Google Meet » est la modalité par DÉFAUT de la fenêtre de prise de
-- rendez-vous, mais le champ du lien y est vide. Chaque rendez-vous partait
-- donc sans lien, et le courriel du client retombait sur le lien de
-- RÉSERVATION du cabinet — c'est-à-dire qu'on invitait à reprendre rendez-vous
-- quelqu'un à qui l'on venait d'en fixer un.
--
-- ─── POURQUOI UNE SALLE, ET NON UN LIEN PAR RENCONTRE ──────────────────────
--
-- Engendrer un lien Google Meet distinct pour chaque rendez-vous exige l'API
-- Google Calendar : un projet Google Cloud, un écran de consentement soumis à
-- la vérification de Google, et un raccordement OAuth par cabinet. Des jours de
-- travail, et une dépendance de plus à entretenir.
--
-- Or Google Meet offre déjà ce qu'il faut. « Créer une réunion pour plus tard »
-- rend une adresse RÉUTILISABLE, qui n'expire qu'après 365 jours sans usage —
-- et chaque usage repousse l'échéance d'autant. Le cabinet la crée une fois et
-- la garde.
--
-- La même salle sert donc tous les clients, ce qui n'est pas un défaut : Google
-- Meet retient les arrivants en salle d'attente jusqu'à ce que l'hôte les
-- admette. Deux clients qui se suivent ne se croisent pas.
--
-- ─── LA COLONNE NE DIT PAS « MEET » ────────────────────────────────────────
--
-- `meeting_room_url`, et non `google_meet_url` : un cabinet peut tenir ses
-- rencontres sur Zoom, Teams ou Whereby avec exactement la même logique de
-- salle permanente. La colonne dit ce qu'elle contient, non chez qui.
--
-- Contrainte https, comme pour `booking_url` : cette adresse part dans un
-- courriel signé du cabinet, à des candidats à l'immigration. Une valeur en
-- `javascript:` y serait un piège que le cabinet aurait l'air d'avoir posé.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.firms
  add column if not exists meeting_room_url text;

comment on column public.firms.meeting_room_url is
  'Salle de rencontre permanente du cabinet — Google Meet, Zoom, Teams. '
  'Sert de lien par défaut à tout rendez-vous en visioconférence, et part dans '
  'le courriel de confirmation du client. Toujours https : cette adresse est '
  'diffusée sous le nom du cabinet.';

alter table public.firms
  drop constraint if exists firms_meeting_room_url_https;

alter table public.firms
  add constraint firms_meeting_room_url_https
  check (meeting_room_url is null or meeting_room_url ~* '^https://[^\s<>"]+$');

commit;
