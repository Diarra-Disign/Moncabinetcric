-- ============================================================================
-- Le lien de réservation du cabinet
-- ============================================================================
--
-- L'onglet « Zoom & Google Calendar » des Réglages offrait quatre contrôles :
-- un lien Calendly, un mode de visioconférence, un compte Zoom/Google, et une
-- pastille verte « Calendly configuré ».
--
-- Aucun des quatre n'était enregistré. Le formulaire envoyait vingt et un
-- champs au serveur, et pas ceux-là ; et la table `firms` n'avait de toute
-- façon aucune colonne où les écrire. Le message vert « enregistrés avec
-- succès » s'affichait, `router.refresh()` relisait la base — qui n'avait
-- jamais rien reçu — et les champs se vidaient. La pastille « configuré »,
-- elle, se déclenchait sur l'état React local : elle certifiait une
-- configuration qui disparaissait au rechargement.
--
-- Des quatre, un seul est réalisable aujourd'hui : le lien de réservation.
-- C'est une adresse que le cabinet possède déjà chez Calendly, TidyCal ou
-- Cal.com — il n'y a qu'à la garder et la montrer. Les trois autres exigeaient
-- des comptes développeur Zoom et Google et un flux OAuth par cabinet ; ils
-- sont retirés de l'écran plutôt que laissés à faire semblant.
--
-- ─── POURQUOI `booking_url` ET NON `calendly_url` ──────────────────────────
--
-- Calendly n'est pas seul, et le cabinet qui utilise TidyCal ou Cal.com ne
-- doit pas avoir à ranger son adresse dans une colonne portant le nom d'un
-- concurrent. La colonne dit ce qu'elle contient — un lien de réservation —
-- et non chez qui il est hébergé.
--
-- ─── LA CONTRAINTE ─────────────────────────────────────────────────────────
--
-- Cette adresse est publiée à des candidats, dans le portail client. Une
-- valeur en `javascript:` ou en `data:` y deviendrait un lien piégé signé du
-- cabinet. La contrainte n'autorise donc que https, et la validation
-- applicative refait le contrôle avant l'écriture : la base est le dernier
-- rempart, pas le seul.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.firms
  add column if not exists booking_url text;

comment on column public.firms.booking_url is
  'Lien public de prise de rendez-vous du cabinet — Calendly, TidyCal, '
  'Cal.com ou autre. Affiché au candidat sur son portail client. Toujours '
  'https : ce lien est publié, une autre forme y serait un piège signé du '
  'cabinet.';

alter table public.firms
  drop constraint if exists firms_booking_url_https;

alter table public.firms
  add constraint firms_booking_url_https
  check (booking_url is null or booking_url ~* '^https://[^\s<>"]+$');

commit;
