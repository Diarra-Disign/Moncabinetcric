# Page de réservation publique

> Cadré et approuvé le 2026-08-21. Remplace Calendly par une page à l'adresse
> du cabinet.

## L'objectif

`moncabinetcric.com/rdv/<cabinet>` : le client choisit un créneau libre, laisse
ses coordonnées, et le rendez-vous entre dans le calendrier du consultant avec
le lien de sa salle Google Meet. Aucun service tiers, aucun abonnement.

## Décisions prises

| Décision | Écarte |
|---|---|
| Confirmation immédiate | L'écran de validation, les deux courriels, le client qui attend |
| Gratuit | Le tunnel Stripe, les remboursements, la facture |
| Aucune fiche client créée | Une liste de clients remplie d'inconnus et d'essais |
| Préavis minimal de 24 h | Une réservation pour dans dix minutes |

## Ce qui existe et qu'on réutilise

- `calendar_events` avec `source` et `external_id` (2026-08-21)
- `firms.meeting_room_url` — la salle, qui part dans le courriel
- `courrielRendezVous()` et `annoncerRendezVous()` — déjà éprouvés
- `lib/securite/limiter.ts` — quotas des chemins ouverts sans session
- Les motifs publics `/s/[jeton]` et `/q/[token]`

## Périmètre & architecture fichiers

- `[Nouveau]` `supabase/migrations/…_reservation_publique.sql`
- `[Nouveau]` `lib/reservation/creneaux.ts` — calcul pur des créneaux libres
- `[Nouveau]` `lib/reservation/__tests__/creneaux.test.ts`
- `[Nouveau]` `lib/data/reservation.ts` — lecture publique et écriture
- `[Nouveau]` `app/[locale]/rdv/[slug]/page.tsx` + `reservation-client.tsx`
- `[MODIFIER]` réglages — plages, durée, préavis, horizon, interrupteur
- `[Nouveau]` `scripts/verify-reservation-publique.mjs` + `./cric rdv`

## Tâches

### 1. La base (est. 40 min)
`firms` : `booking_slug` (unique, `^[a-z0-9-]{3,40}$`), `booking_enabled`,
`booking_slot_minutes` (30), `booking_lead_hours` (24), `booking_horizon_days` (30).

`firm_availability` : `firm_id`, `weekday` 0-6, `start_time`, `end_time`.
RLS : le cabinet gère les siennes.

Deux fonctions `security definer` :
- `cabinet_public(p_slug)` — nom, logo, salle, réglages. **Rien d'autre.**
- `creneaux_pris(p_slug, p_du, p_au)` — les seuls INSTANTS occupés, sans nom
  de client ni motif. Un créneau occupé ne dit jamais par qui.

### 2. Le calcul des créneaux, en TDD (est. 60 min)
Fonction pure. Épreuves d'abord :
- un rendez-vous de 90 min en bloque trois de 30
- le préavis se compte dans le fuseau du cabinet
- le passage à l'heure d'été ne décale ni ne duplique un créneau
- l'horizon borne la liste
- une plage 13 h 30 – 17 h avec des créneaux de 30 min en donne sept

### 3. L'écriture, et la course (est. 45 min)
`reserver_creneau()` en `security definer` : revérifie que le créneau est libre
**dans la même transaction** que l'insertion. Deux clients sur le même créneau :
l'un gagne, l'autre reçoit un refus lisible.

Verrou consultatif sur `(firm_id, instant)` pour sérialiser les prétendants.

### 4. La page publique (est. 60 min)
`/rdv/[slug]`. Sans session. Heure affichée dans le fuseau du cabinet **et**
dans celui du visiteur s'il diffère. Champ-piège contre les robots. Quota par
adresse.

### 5. Les réglages (est. 45 min)
Déclaration des plages, des quatre réglages, et l'adresse publique avec un
bouton pour la copier.

### 6. L'épreuve (est. 40 min)
`./cric rdv` : un créneau occupé n'est pas offert ; le préavis est respecté ;
deux réservations simultanées n'en écrivent qu'une ; la page d'un cabinet ne
révèle jamais un nom de client ; un cabinet fermé n'offre rien.

## Ce que ce chantier ne fait pas

- Pas de paiement.
- Pas d'annulation en libre-service : le client écrit, le consultant annule.
- Pas de plages d'exception (vacances) — les disponibilités sont hebdomadaires.
  À ajouter ensuite si le besoin se confirme.
