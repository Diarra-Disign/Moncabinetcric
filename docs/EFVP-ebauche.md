# Évaluation des facteurs relatifs à la vie privée — ÉBAUCHE

**Produit** : moncabinetcric — plateforme de gestion pour consultants réglementés en immigration
**Responsable** : Me Adama Diarra, RCIC #R-514982 — Cabinet Immigration Boréale Inc.
**Date de l'ébauche** : 2026-08-02
**Statut** : ébauche interne, non validée

> Ce document n'est **pas** une EFVP finale. La Loi 25 exige une évaluation formelle avant tout
> projet de nouveau système de collecte et avant toute communication de renseignements personnels
> hors Québec (Art. 17). Cette ébauche prépare cette évaluation ; elle ne s'y substitue pas.

---

## 1. Description du traitement

La plateforme centralise la gestion d'un cabinet de consultants réglementés : dossiers clients,
coffre-fort documentaire, ententes de services, facturation et compte en fidéicommis, échéancier
réglementaire, pipeline de prospection et journal d'audit.

À la date de cette ébauche, **toutes les données proviennent de jeux de démonstration**
(`lib/data/mock/`). Aucun dossier client réel n'est traité. Le branchement sur une base réelle
(Supabase) est en cours mais reste en mode `DATA_SOURCE=mock` par défaut.

## 2. Cartographie des renseignements personnels

| Catégorie | Source dans le code | Sensibilité |
|---|---|---|
| Identité et contact | `ClientRecord` — nom, courriel, téléphone, citoyenneté, résidence, province, NEQ | Ordinaire |
| Statut migratoire | `Matter` — programme, catégorie, échéances, notes de dossier | **Sensible** |
| Documents justificatifs | `DocumentRecord` — passeports, attestations linguistiques, diplômes, formulaires IRCC | **Sensible** |
| Données financières | `InvoiceRecord` — honoraires, débours, mouvements de fidéicommis | Sensible |
| Prospection | `Lead` — coordonnées, valeur estimée, pointage 0–100, notes | Ordinaire, avec profilage |
| Journaux techniques | `AuditLogRecord` — adresse IP, agent utilisateur, horodatage, acteur | Ordinaire |
| Personnes à charge | `AgreementPerson` — rôle `child`, conjoint, parrain | **Sensible, mineurs possibles** |

## 3. Flux et destinataires

| Destinataire | Nature du flux | Localisation | Encadrement |
|---|---|---|---|
| Fournisseur d'hébergement (Supabase) | Hébergement de l'ensemble des renseignements | **À CONFIRMER** | À documenter |
| Autorités (IRCC, MIFI, EDSC) | Dépôt des demandes | Canada | Mandat client |
| Assistants IA externes (connecteur) | Nom du client, programme, honoraires | **Probablement hors Québec** | **Absent** |
| Conseillers professionnels | Ponctuel, sur besoin | Canada | Confidentialité |

### 3.1 Point critique — région d'hébergement non confirmée

L'interface affiche « Région ca-central-1 (Canada) » et « Souveraineté des données Canada (Loi 25) »
(`documents-client.tsx`). Ces mentions sont **des chaînes codées en dur**, sans lien avec la
configuration réelle du projet Supabase `zpbkxzrnvzxcwlhjllrp`.

**Action requise** : confirmer la région dans le tableau de bord Supabase, la documenter, et
soit corriger l'interface, soit la retirer. Si la région est hors Québec, l'EFVP de l'article 17
devient obligatoire avant tout traitement réel.

### 3.2 Point critique — connecteur d'intelligence artificielle

`lib/data/mock/connector.ts` prévoit des clés d'API nommées « ChatGPT Custom GPT » et
« Claude Desktop MCP Server », avec sept actions autorisées portant sur les ententes de services
(`list_agreements`, `create_agreement_draft`, `add_agreement_party`, etc.).

Activer ce connecteur revient à communiquer des renseignements personnels — nom du client,
programme d'immigration, montants — à un exploitant tiers, vraisemblablement hors Québec.

**Ce qui est correctement conçu** : le connecteur est désactivé par défaut, et les actes réservés
(`finalize`, `send`, `sign`, `cancel`) sont exclus des actions automatisables. Cette séparation
respecte l'exigence déontologique d'accomplissement des actes réservés par une personne physique.

**Ce qui manque** : EFVP préalable, encadrement contractuel du destinataire, information des
personnes concernées, et registre des activations.

## 4. Profilage et décisions automatisées

`Lead.score` (0–100) et `Lead.scoreLabel` établissent un pointage de priorisation commerciale.
C'est un profilage au sens de la Loi 25 et il est désormais divulgué à la section 11 de la
politique de confidentialité.

Aucune décision produisant un effet juridique n'est automatisée : les analyses d'admissibilité et
les actes réservés relèvent du consultant. Cette séparation doit être préservée.

## 5. Mesures de sécurité — état réel

| Mesure affirmée dans l'UI | État réel | Verdict |
|---|---|---|
| « Traçabilité cryptographique SHA-256 » | `` `sha256-${Date.now()}` `` et `Math.random()` | **Fausse** |
| Chaîne d'audit `prevHash` / `rowHash` | Chaînage présent mais empreintes non cryptographiques | **Sans valeur probante** |
| « Chiffré AES-256 » | Aucun code de chiffrement applicatif | **Non vérifiée** |
| « Région ca-central-1 » | Chaîne codée en dur | **Non vérifiée** |
| Cloisonnement par cabinet | `firm_id` sur toutes les tables, filtre systématique | **Réel** (schéma 0001) |
| RLS activée | `enable row level security` sur 20 tables | **Réel mais inopérant** — la clé `service_role` la contourne tant que l'auth n'est pas branchée |
| Journal en ajout seul | Aucune politique `update`/`delete` sur `audit_logs` | **Réel** (schéma 0001) |
| Authentification | Aucune | **Absente** |

## 6. Risques identifiés

| # | Risque | Gravité | Statut |
|---|---|---|---|
| R1 | Affirmations de sécurité fausses affichées publiquement | Élevée | Ouvert |
| R2 | Absence totale d'authentification | Élevée | Ouvert |
| R3 | Région d'hébergement inconnue, EFVP Art. 17 non faite | Élevée | Ouvert |
| R4 | Connecteur IA sans encadrement contractuel ni EFVP | Élevée | Ouvert |
| R5 | Journal d'audit falsifiable sans détection | Moyenne | Ouvert |
| R6 | Aucune procédure documentée de notification d'incident | Moyenne | Ouvert |
| R7 | Aucune politique de gouvernance interne des RP | Moyenne | Ouvert |
| R8 | Durées de conservation non paramétrées ni appliquées | Moyenne | Ouvert |

## 7. Conclusion de l'ébauche

En l'état, la plateforme **ne doit pas accueillir de dossiers clients réels**. Les risques R1 à R4
doivent être levés au préalable. Le plan de correction ordonné figure dans
[PLAN-CORRECTION-CONFORMITE.md](./PLAN-CORRECTION-CONFORMITE.md).

Cette ébauche doit être révisée et complétée par un professionnel en protection des renseignements
personnels avant d'être considérée comme l'EFVP requise par la Loi 25.
