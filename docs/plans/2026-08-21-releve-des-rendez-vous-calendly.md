# Relève des rendez-vous Calendly

> Cadré le 2026-08-21. Dessin approuvé avant écriture de code.

## Le problème, et pourquoi la solution évidente ne marche pas

Un client réserve par le lien Calendly du cabinet. Rien n'arrive dans le
calendrier de l'application : le consultant l'apprend par le courriel de
Calendly, et doit ressaisir le rendez-vous à la main.

La solution attendue — un webhook, où Calendly prévient l'application au moment
de la réservation — **n'est pas disponible**. Vérifié dans deux pages officielles
de Calendly : les webhooks exigent un abonnement payant (Standard, Teams ou
Enterprise selon la FAQ développeur ; Professional inclus selon le centre
d'aide). Le cabinet est au forfait gratuit.

Mais la même documentation dit deux fois autre chose, et c'est ce qui rend ce
chantier possible :

> « Developers can make GET and POST requests to API endpoints on behalf of a
> Calendly user on **any subscription plan, including the Free plan** (with the
> exception of a few endpoints that are specific to our Enterprise plan). »

Les trois exceptions Enterprise sont les journaux d'activité et deux
suppressions de données. **Lister les rendez-vous et leurs participants n'en
fait pas partie.**

Donc : Calendly ne peut pas nous prévenir, mais nous pouvons lui demander.
Ce chantier remplace la notification (push) par l'interrogation (pull).

## Ce qui existe déjà

- La table `calendar_events` porte tout le nécessaire : `firm_id`, `client_id`,
  `matter_id`, `title`, `client_name`, `type`, `platform`, `link`, `date`,
  `time`, `hour`, `duration_minutes`, `status`, `notes`.
- L'écran `/calendar` la lit par `getEvents()` (`lib/data/supabase/reads.ts`).
- `firms.booking_url` porte déjà le lien de réservation public (2026-08-20).

Rien de tout cela ne change. On ajoute une **source** d'événements, pas un
calendrier.

## Décisions prises, et ce qu'elles écartent

| Décision | Écarte |
|---|---|
| Relève à l'ouverture du calendrier, verrou de 2 min | La tâche planifiée Vercel, qui exigerait un forfait Pro |
| Un inconnu entre au calendrier sans créer de fiche | La création automatique de prospects, qui remplirait la liste d'annulations et d'essais |
| Le jeton vit dans une table fermée par RLS | Une colonne de `firms`, que l'écran renvoie au navigateur |
| Une annulation bascule le statut | La suppression de la ligne : le consultant doit pouvoir constater l'annulation |

## Périmètre & architecture fichiers

- `[Nouveau]` `supabase/migrations/…_releve_calendly.sql` — table `firm_calendly`,
  colonnes `source` et `external_id` sur `calendar_events`, index unique
- `[Nouveau]` `lib/calendrier/calendly.ts` — client d'API et fonctions pures
- `[Nouveau]` `lib/calendrier/__tests__/calendly.test.ts`
- `[Nouveau]` `lib/data/calendly-actions.ts` — Server Actions
- `[Nouveau]` `app/[locale]/(app)/calendar/releve-au-chargement.tsx`
- `[MODIFIER]` `app/[locale]/(app)/settings/settings-client.tsx` — jeton, relève
- `[MODIFIER]` `app/[locale]/(app)/calendar/page.tsx` — poser le déclencheur
- `[Nouveau]` `scripts/verify-calendly.mjs` + entrée `./cric calendly`

## Tâches

### 1. La base (est. 15 min)
Table `firm_calendly` : `firm_id` clé primaire, `access_token`,
`calendly_user_uri`, `last_synced_at`, `last_error`. RLS activée **sans aucune
politique** — refus pour tous, seule la clé de service y accède.

Sur `calendar_events` : `source` (`'manuel'` par défaut, contrainte
`in ('manuel','calendly')`) et `external_id`. Index unique partiel sur
`(firm_id, source, external_id) where external_id is not null`.

C'est cet index qui empêche la duplication. Sans lui, chaque ouverture du
calendrier recréerait tous les rendez-vous.

### 2. Les fonctions pures, en TDD (est. 30 min)
Écrire les épreuves d'abord :
- l'appariement d'un courriel à une fiche client, insensible à la casse et aux
  espaces
- la conversion d'un événement Calendly en ligne `calendar_events` (date, heure
  locale, durée, plateforme, lien)
- le calcul du statut : `active` → `confirmed`, `canceled` → `cancelled`

Ces trois-là ne touchent ni au réseau ni à la base : elles s'éprouvent seules.

### 3. Le client d'API (est. 25 min)
`GET /users/me` pour résoudre l'URI du cabinet à l'enregistrement du jeton.
`GET /scheduled_events` de hier à +90 jours, puis `/invitees` par événement.
Toute erreur est **retournée**, jamais levée : le calendrier doit s'ouvrir même
si Calendly est en panne.

### 4. Les Server Actions (est. 25 min)
`enregistrerJetonCalendly` — valide le jeton en appelant `/users/me` avant de
l'écrire ; un jeton refusé n'est pas enregistré.
`releverCalendly` — verrou de 2 min sur `last_synced_at`, upsert par
`external_id`, écrit `last_error` en cas d'échec.

### 5. Les écrans (est. 30 min)
Réglages : champ du jeton (en écriture seule — jamais relu vers le navigateur),
bouton « Relever maintenant », date de dernière relève, dernière erreur.
Calendrier : composant client qui appelle la relève après affichage, puis
rafraîchit. La page ne l'attend jamais.

### 6. L'épreuve de bout en bout (est. 30 min)
`./cric calendly` : relever deux fois ne crée qu'une ligne ; un courriel connu
accroche le bon client ; un inconnu entre sans fiche ; une annulation bascule le
statut ; un jeton invalide n'empêche pas le calendrier de s'ouvrir ; le jeton
d'un cabinet est illisible depuis un autre.

## Ce que ce chantier ne fait pas

- Pas de temps réel. Un rendez-vous pris pendant que l'écran est ouvert
  apparaît à la relève suivante.
- Pas de création de rendez-vous **vers** Calendly. La relève est à sens unique.
- Pas de rappel par courriel avant un rendez-vous — cela exigerait la tâche
  planifiée, donc le forfait Vercel Pro.
