# Plan d'Implémentation — Registre mensuel du compte client (fidéicommis)

> **Note aux Agents :** Suivre strictement chaque étape séquentiellement. Exécuter un cycle
> complet (Test → Code → Vérification → Commit) pour chaque tâche. Ne jamais passer à la
> tâche suivante sur un test rouge.

---

## 0. L'INVENTAIRE D'ABORD — ce qui existe déjà

**À lire avant toute chose.** Le module fidéicommis n'est pas un terrain vierge : les
fondations comptables sont posées, et plusieurs exigences du cahier des charges sont
**déjà satisfaites**. Reconstruire par-dessus serait la pire issue de ce chantier.

### Tables et fonctions existantes

| Objet | Fichier | Ce qu'il fait |
|---|---|---|
| `trust_ledger` | `20260809100000_payments_and_trust.sql` | Les mouvements. `firm_id`, `client_id`, `matter_id`, `entry_type`, `amount`, `occurred_on`, `payment_id`, `invoice_id`, `memo`, `recorded_by`, `created_at` |
| `payments` | idem | Paiements reçus, avec `destination in ('trust','business')` — la séparation des comptes du §24 |
| `trust_reconciliations` | `20260810260000_trust_register_and_reconciliation.sql` | Rapprochements mensuels : `period_end`, `bank_balance`, `ledger_balance` **figé**, `explanations` jsonb, `status draft/closed`, `closed_by` |
| `client_trust_balance()` | `20260809100000` | Solde d'un client, **calculé, jamais stocké** |
| `firm_trust_balance()` | idem | Total des fonds détenus (§33) |
| `trust_signe()` | idem | Le sens d'un mouvement — source unique du signe |
| `enforce_trust_balance()` | idem | **Interdit le solde négatif (§23)** |
| `payments_immutable_money()` | idem | Interdit la modification d'un montant encaissé (§35) |
| `firm_trust_ledger_view()` | `20260810260000` | Registre complet avec nom du client, dossier, n° de facture, auteur (§10, §15) |
| `firm_trust_by_client()` | idem | Solde par client + dernier mouvement (§4, partiel) |
| `protect_closed_reconciliation()` | idem | Un rapprochement clos ne se modifie plus (§22) |
| `trust_reconciliation_status()` | idem | Écart banque / registre (§20, §21) |

### Exigences DÉJÀ satisfaites — ne rien refaire

- **§1** solde calculé automatiquement — `client_trust_balance()`
- **§3** facture ≠ retrait : `invoices` et `trust_ledger` sont deux tables distinctes ;
  aucun déclencheur ne crée un transfert depuis une facture (**§27 respecté**)
- **§10** date, type, client, montant, référence, description, facture, auteur — toutes
  les colonnes existent
- **§15** traçabilité client → dépôt → paiement → facture → retrait — les clés étrangères
  sont posées
- **§20 à §22** rapprochement avec solde bancaire saisi, écart, validation et clôture
- **§23** protection contre les soldes négatifs
- **§24** séparation fidéicommis / exploitation — `payments.destination`
- **§25** le registre est relié aux modules existants, il n'est pas une liste isolée
- **§28, §29** dépôts et factures multiples — aucune contrainte ne les limite
- **§33** total des fonds détenus — `firm_trust_balance()`
- **§38** aucune référence « article 9.1 » n'existe dans le module. **Rien à corriger.**
  Les seules références affichées ailleurs visent DORS/2022-128 art. 23 et 24, pour les
  contrats. Une vérification a été faite : le module fidéicommis n'affiche aucun article.

### Garde-fou déjà en place, à ne pas casser

`trust_ledger` possède un index unique `trust_ledger_un_depot_par_paiement` : un paiement
ne peut produire qu'un seul dépôt. Toute nouvelle écriture doit le respecter.

---

## 1. LE MANQUE RÉEL

Onze exigences ne sont pas couvertes. Elles se regroupent en quatre chantiers.

| # | Exigence | Manque |
|---|---|---|
| **A** | §5, §6, §30, §32 | **Le registre mensuel.** `firm_trust_by_client()` n'a aucune notion de période : ni solde d'ouverture, ni dépôts du mois, ni retraits du mois, ni solde de clôture |
| **A** | §7, §31 | Exclusion des clients à solde nul du mois suivant, **sans perdre l'historique** (§8) |
| **A** | §9 | Réapparition automatique après un nouveau dépôt |
| **B** | §11 | Types `adjustment` et `transfer` absents — seuls quatre types existent |
| **B** | §12 | Justification obligatoire d'un ajustement, avec ancienne et nouvelle valeur |
| **B** | §35 | Annulation par contre-écriture plutôt que suppression |
| **C** | §13 | Numéro de reçu — `payments.reference` existe mais aucun format `REC-2026-0015` |
| **C** | §3 | Statut « retrait en attente » entre « facturée » et « retirée » |
| **D** | §16, §17 | Filtres par mois / client / type / statut, et recherche |
| **D** | §18, §19, §34 | Impression, PDF, export tableur du registre mensuel |

---

## 2. DÉCISIONS PRISES, ET POURQUOI

Trois choix engagent la suite. Ils sont arrêtés ici plutôt que découverts en chemin.

### D1 — L'ajustement se scinde en deux types, il ne porte pas un montant signé

`trust_ledger` impose `amount > 0`, et le signe vient de `trust_signe(entry_type)`. C'est
une invariante saine : elle rend impossible un montant négatif saisi par erreur.

Un ajustement peut aller dans les deux sens. Plutôt que d'affaiblir la contrainte, on
ajoute **deux** types : `adjustment_credit` et `adjustment_debit`. L'invariante tient,
et le registre lit le sens comme pour tout autre mouvement.

### D2 — « Retrait en attente » est DÉRIVÉ, jamais stocké

Une facture émise dont aucun `transfer_to_business` ne porte l'`invoice_id` est en attente
de retrait. C'est déductible des données existantes.

Un statut stocké devrait être mis à jour par un déclencheur à chaque écriture du registre,
et divergerait le jour où quelqu'un enregistre un transfert à la main. Un état dérivé ne
peut pas mentir.

### D3 — L'export tableur est un CSV, pas un fichier .xlsx

Excel ouvre un CSV sans rien installer. Produire un vrai `.xlsx` demanderait une
dépendance de plus, pour un gain nul sur les colonnes demandées au §34. Le §34 dit
« lorsque pertinent » : ça ne l'est pas ici.

### D4 — Aucune affirmation de conformité (§37)

Nulle part le logiciel ne dira qu'il « garantit la conformité CICC ». Les écrans parlent
d'outils de tenue de registre. Une mention discrète rappellera que le consultant demeure
responsable de ses obligations. **Cette règle prime sur toute formulation commerciale.**

---

## 3. PÉRIMÈTRE & ARCHITECTURE FICHIERS

### Chantier A — le registre mensuel (le cœur)
- [ ] `[NOUVEAU]` `supabase/migrations/20260818100000_registre_mensuel_fideicommis.sql`
      — `firm_trust_monthly_register(f_id, period_start, period_end)`
- [ ] `[MODIFIER]` `lib/data/trust.ts` — lecture du registre mensuel
- [ ] `[NOUVEAU]` `lib/data/__tests__/registre-mensuel.test.ts` — le scénario du §39

### Chantier B — ajustements et contre-écritures
- [ ] `[NOUVEAU]` `supabase/migrations/20260818110000_ajustements_fideicommis.sql`
      — types `adjustment_credit` / `adjustment_debit`, colonnes `reason`,
      `reverses_id`, contrainte « motif obligatoire »
- [ ] `[MODIFIER]` `lib/data/trust-actions.ts` — action d'ajustement, action d'annulation

### Chantier C — reçus et statut de retrait
- [ ] `[NOUVEAU]` `supabase/migrations/20260818120000_numeros_de_recu.sql`
      — séquence par cabinet, format `REC-AAAA-NNNN`
- [ ] `[MODIFIER]` `lib/data/trust.ts` — statut de retrait dérivé

### Chantier D — écran, filtres, impression
- [ ] `[MODIFIER]` `app/[locale]/(app)/fideicommis/fideicommis-client.tsx`
- [ ] `[NOUVEAU]` `app/[locale]/(app)/fideicommis/registre-mensuel.tsx`
- [ ] `[NOUVEAU]` `app/api/fideicommis/registre/route.ts` — CSV
- [ ] `[MODIFIER]` `messages/fr.json`, `messages/en.json`

---

## 4. DÉCOUPAGE DES TÂCHES SÉQUENTIELLES

### CHANTIER A — LE REGISTRE MENSUEL

#### Tâche A1 : Le scénario du §39, écrit en test d'abord (Est. 20 min)
- [ ] Rédiger `lib/data/__tests__/registre-mensuel.test.ts` reproduisant **exactement**
      le test final obligatoire :
      - dépôt 3 500 $ → facture 2 000 $ → retrait 2 000 $ → mai affiche **1 500 $**
      - juin : ouverture 1 500 $, aucune transaction, clôture **1 500 $**
      - retrait de 1 500 $ → solde 0 $
      - juillet : **le client n'apparaît plus** dans les soldes actifs
      - son historique reste interrogeable
- [ ] Lancer `npm test` et constater l'échec explicite
- [ ] **Ne pas écrire de SQL avant que ce test échoue pour la bonne raison**

#### Tâche A2 : La fonction du registre mensuel (Est. 30 min)
- [ ] Écrire `firm_trust_monthly_register(f_id uuid, p_start date, p_end date)` renvoyant
      `client_id, client_name, opening, deposits, withdrawals, closing, last_movement`
- [ ] `opening` = somme signée de tous les mouvements **strictement antérieurs** à `p_start`
- [ ] `closing` = `opening + deposits − withdrawals`
- [ ] Filtre `having` : garder une ligne si `opening <> 0` **ou** s'il y a eu un mouvement
      dans la période. C'est ce qui réalise §7, §9, §31 et §32 d'un seul coup — un client
      à zéro sans mouvement disparaît, un nouveau dépôt le fait réapparaître
- [ ] `security definer`, `set search_path`, `revoke`/`grant` comme les fonctions voisines
- [ ] Appliquer, relancer le test, viser le vert

#### Tâche A3 : La lecture côté application (Est. 15 min)
- [ ] Ajouter `getRegistreMensuel(mois)` dans `lib/data/trust.ts`
- [ ] Aucun filtre applicatif sur le cabinet — la RLS s'en charge, comme le reste du module
- [ ] Vérifier les totaux : somme des `closing` = `firm_trust_balance()` (§33)
- [ ] Commiter (`feat(fidéicommis): registre mensuel avec soldes d'ouverture et de clôture`)

### CHANTIER B — AJUSTEMENTS ET CONTRE-ÉCRITURES

#### Tâche B1 : Test du refus d'un ajustement sans motif (Est. 10 min)
- [ ] Test : un ajustement sans `reason` doit être **refusé par la base**, pas par le code
- [ ] Constater l'échec

#### Tâche B2 : Les deux types et la contrainte (Est. 20 min)
- [ ] Étendre le `check` de `entry_type` avec `adjustment_credit`, `adjustment_debit`,
      `transfer_authorized`
- [ ] Étendre `trust_signe()` en conséquence
- [ ] Ajouter `reason text`, `reverses_id uuid references trust_ledger(id)`
- [ ] Contrainte : `check (entry_type not like 'adjustment%' or (reason is not null and length(trim(reason)) >= 10))`
- [ ] Vérifier que `enforce_trust_balance()` couvre les nouveaux types
- [ ] Commiter (`feat(fidéicommis): ajustements tracés et justifiés`)

#### Tâche B3 : L'annulation par contre-écriture (Est. 20 min)
- [ ] Action `annulerMouvement(id, motif)` : crée un mouvement inverse liant `reverses_id`
- [ ] **Ne jamais supprimer** (§35) — un test doit le prouver
- [ ] Commiter

### CHANTIER C — REÇUS ET STATUT DE RETRAIT

#### Tâche C1 : Numérotation des reçus (Est. 25 min)
- [ ] Reprendre le motif de numérotation des factures — **ne pas en inventer un second**
- [ ] `REC-AAAA-NNNN`, séquence par cabinet et par année
- [ ] Test : deux reçus simultanés n'obtiennent jamais le même numéro
- [ ] Commiter

#### Tâche C2 : Statut de retrait dérivé (Est. 15 min)
- [ ] `invoice_trust_status(i_id)` : `facturee` / `retrait_en_attente` / `retiree`
- [ ] Aucune colonne ajoutée (cf. D2)
- [ ] Commiter

### CHANTIER D — ÉCRAN, FILTRES, IMPRESSION

#### Tâche D1 : Le sélecteur de mois et le tableau (Est. 40 min)
- [ ] Composant `registre-mensuel.tsx` : sélecteur de mois, tableau du §6, ligne de totaux
- [ ] Tous les libellés dans `messages/*.json` — **aucune chaîne en dur**
- [ ] Commiter

#### Tâche D2 : Filtres et recherche (Est. 30 min)
- [ ] Filtres mois / client / type / statut (§16)
- [ ] Recherche nom, dossier, n° reçu, n° facture, référence (§17)
- [ ] Commiter

#### Tâche D3 : Impression et PDF (Est. 40 min)
- [ ] En-tête du §19 : nom, adresse, téléphone, courriel du cabinet, période
- [ ] Réutiliser la chaîne PDF de `lib/pdf/` — ne pas en créer une seconde
- [ ] Mention du §37 en pied : outil de tenue de registre, responsabilité du consultant
- [ ] Commiter

#### Tâche D4 : Export CSV (Est. 20 min)
- [ ] Colonnes du §34 : client, date, référence, description, dépôt, retrait, solde,
      facture, reçu
- [ ] Commiter

---

## 5. RÈGLE DE NON-RÉGRESSION (§36)

Avant chaque commit :

```
npm test          # 264 épreuves au vert au démarrage de ce chantier
npx tsc --noEmit
./cric facturation
```

Aucune table existante n'est renommée. Aucune colonne n'est supprimée. `trust_ledger`
n'est étendue que par ajout de colonnes nullables et élargissement d'un `check`.

---

## 6. CE QUI N'EST PAS DANS CE PLAN

- La comptabilité du compte d'exploitation. Le §24 demande de **ne pas mélanger** ;
  ce plan ne touche donc qu'au fidéicommis.
- Toute affirmation de conformité réglementaire (§37).
- L'affichage d'une référence d'article. Le §38 demande de vérifier avant d'afficher :
  tant que la vérification n'est pas faite auprès du texte en vigueur, **on n'affiche
  rien**. Ne pas écrire « article 32 » sur la foi de ce cahier des charges seul.
