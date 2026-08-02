# Feuille de route — comptes, accès, abonnements et test de bout en bout

État au 2026-08-02. Ce document décrit ce qui existe, ce qui manque, et
l'ordre dans lequel le construire.

---

## 1. Trois natures de comptes à ne pas confondre

Aujourd'hui l'application n'en connaît qu'une seule : un membre rattaché à
un cabinet. C'est la source de la confusion que vous avez relevée.

| Nature | Qui | Voit quoi | Existe ? |
|---|---|---|---|
| **Exploitant de la plateforme** | Vous, éditeur du logiciel | Les cabinets abonnés, leur statut, leur facturation — **jamais les dossiers clients** | ❌ |
| **Membre d'un cabinet** | Vous en tant que consultant, vos futurs abonnés | Uniquement les données de son cabinet | ✅ partiellement |
| **Client final** | Les clients d'un cabinet | Uniquement son propre dossier | ❌ |

### Pourquoi séparer l'exploitant du consultant

Ce n'est pas du confort. Trois raisons, dans l'ordre d'importance :

**Secret professionnel.** Un exploitant de plateforme n'a aucun titre à
consulter les dossiers d'immigration d'un cabinet abonné. Si votre compte
d'exploitant peut lire les dossiers, vous ne pourrez pas l'affirmer à un
confrère qui vous confie sa clientèle.

**Test honnête.** Vous voulez éprouver le produit comme un utilisateur
externe. Avec un compte qui voit tout, vous ne verrez jamais les blocages
que vivra un abonné — et ce sont précisément ceux-là qu'il faut trouver.

**Loi 25.** Moins de personnes ont accès aux renseignements personnels,
plus le principe de nécessité est respecté.

### Ce que cela donne concrètement

```
diarrasf@outlook.fr        → exploitant       → console d'administration, aucun dossier
<votre courriel pro>       → cabinet « <votre raison sociale> », rôle owner
<courriel de test>         → cabinet « Cabinet de démonstration », rôle rcic
```

---

## 2. Sécurité des accès : l'état réel

### Ce qui est acquis

- La base refuse la clé anonyme sur les sept tables métier.
- Chaque membre ne voit que son cabinet, imposé par la base et non par le code.
- Le journal d'audit est en insertion seule : aucune politique `update` ni
  `delete` n'existe, donc une entrée écrite ne peut plus être modifiée.

### Ce qui ne l'est pas

**Les rôles ne servent à rien.** La politique appliquée est :

```sql
for all to authenticated
using (firm_id = public.current_firm_id())
```

`for all` couvre `select`, `insert`, `update` et `delete`. Résultat : dans
un cabinet donné, un `readonly`, un `bookkeeper` et le `owner` ont
**exactement les mêmes droits**. N'importe quel membre peut supprimer un
dossier client.

C'est acceptable tant que vous êtes seul. Cela cesse de l'être dès le
premier collaborateur, et c'est bloquant avant d'ouvrir à des testeurs
externes.

### La matrice à mettre en place

| Action | owner | rcic | risia | staff | bookkeeper | readonly |
|---|---|---|---|---|---|---|
| Lire les dossiers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Créer / modifier un dossier | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Supprimer un dossier** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Facturation, fidéicommis | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Inviter un membre | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Modifier l'identité du cabinet | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Exporter l'audit | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

Point déontologique : les **actes réservés** — signer, envoyer, finaliser
une entente — doivent rester le fait d'un consultant réglementé. Le
garde-fou existe déjà pour le connecteur IA ; il doit valoir aussi pour les
rôles non réglementés.

---

## 3. Abonnements et accès gratuits

Rien n'existe aujourd'hui : aucune table ne dit si un cabinet est abonné,
en essai ou suspendu.

### Modèle proposé

Sur la table `firms` :

| Colonne | Valeurs | Rôle |
|---|---|---|
| `plan` | `trial`, `solo`, `cabinet`, `courtoisie` | Ce que le cabinet a droit d'utiliser |
| `status` | `active`, `suspended`, `expired` | Accès ouvert ou fermé |
| `trial_ends_at` | date | Fin d'essai |
| `granted_by` | uuid | Qui a accordé un accès gratuit, et donc qui en répond |

`courtoisie` est le plan de vos testeurs : mêmes fonctions qu'un abonnement
payant, sans échéance, traçable. C'est plus honnête qu'un essai prolongé
indéfiniment, et cela vous laisse retirer l'accès proprement.

**Le contrôle se fait en base, pas dans l'interface.** Une politique RLS
refuse l'accès dès que `status <> 'active'`. Masquer un bouton ne protège
rien.

### Comment vous donnerez un accès gratuit

1. Console d'administration → « Nouveau cabinet »
2. Raison sociale, permis CICC, courriel du responsable, plan `courtoisie`
3. La plateforme envoie une invitation
4. Le destinataire choisit son mot de passe et arrive dans **son** cabinet, vide

Aucune inscription libre. Un cabinet ne se crée pas tout seul : vous
l'ouvrez. C'est cohérent avec un outil destiné à des professionnels
réglementés, et cela vous évite d'héberger les données de n'importe qui.

---

## 4. Parcours de bout en bout à tester

### Visiteur

| Étape | Page |
|---|---|
| Découverte | `/fr/landing` |
| Politique de confidentialité | `/fr/confidentialite` |
| Conditions d'utilisation | `/fr/conditions` |
| Demande de démonstration | ❌ **à construire** |

La landing propose aujourd'hui « Réserver une démo » et « Espace Cabinet ».
Le premier ne mène nulle part, le second vers `/fr/connexion`.

### Consultant abonné

| Étape | Page | État |
|---|---|---|
| Invitation reçue par courriel | — | ❌ |
| Choix du mot de passe | `/fr/bienvenue` | ❌ |
| Connexion | `/fr/connexion` | ✅ |
| Tableau de bord | `/fr/dashboard` | ✅ |
| Créer un client, un dossier | `/fr/clients`, `/fr/matters` | ✅ |
| Téléverser une pièce | `/fr/documents` | ⚠️ métadonnées seulement, aucun fichier stocké |
| Produire une entente | `/fr/agreements` | ✅ |
| Facturer | `/fr/billing` | ✅ |
| Rechercher une disposition | `/fr/research` | ✅ |
| Inviter un collaborateur | `/fr/settings` | ❌ |

### Exploitant

| Étape | Page | État |
|---|---|---|
| Console d'administration | `/fr/admin` | ❌ |
| Créer un cabinet, accorder un plan | `/fr/admin/cabinets` | ❌ |
| Suspendre un accès | `/fr/admin/cabinets` | ❌ |

---

## 5. Ordre de construction

### Étape 1 — Séparer les identités *(indispensable avant tout test)*

- Table `platform_admins`, distincte de `profiles`
- `diarrasf@outlook.fr` y est déplacé et **perd son profil de cabinet**
- Création de votre cabinet réel et de son compte `owner`
- Création d'un cabinet de démonstration et d'un compte de test

Vérification : connecté en exploitant, `/fr/dashboard` doit être **refusé**.

### Étape 2 — Appliquer les rôles

- Politiques RLS distinctes par opération au lieu du `for all` actuel
- Fonction `current_cicc_role()` — déjà créée, encore inutilisée
- Contrôle : un compte `readonly` ne doit pas pouvoir supprimer un client

Vérification : le diagnostic teste chaque rôle contre chaque opération.

### Étape 3 — Abonnements

- Colonnes `plan`, `status`, `trial_ends_at`, `granted_by`
- Politique refusant l'accès si `status <> 'active'`

Vérification : suspendre le cabinet de démonstration doit fermer l'accès
immédiatement, sans déploiement.

### Étape 4 — Invitations

- Table `invitations` à jeton unique et expirant
- Page `/fr/bienvenue` de choix du mot de passe
- Envoi du courriel par Supabase Auth

### Étape 5 — Console d'exploitant

- `/fr/admin`, réservée aux `platform_admins`
- Liste des cabinets, plan, statut, dernière connexion
- **Aucun accès aux dossiers clients** — c'est la règle qui justifie tout
  le découpage

### Étape 6 — Parcours public

- « Réserver une démo » → formulaire alimentant `leads`
- Page tarifs cohérente avec les plans réels

---

## 6. Avant d'accueillir de vraies données clients

Rappels des points déjà documentés, encore ouverts :

- **Hébergement en Oregon.** Transfert hors Québec : EFVP obligatoire au
  titre de l'article 17 de la Loi 25, ou migration vers `ca-central-1`.
- **Affirmations fausses dans l'interface.** « ca-central-1 », « AES-256 »,
  « traçabilité SHA-256 » sont affichées sans implémentation correspondante.
- **Empreintes d'audit fictives.** `Date.now()` et `Math.random()` au lieu
  d'un vrai hachage.
- **Aucun fichier n'est stocké.** Le coffre-fort ne conserve que des
  métadonnées.

Ces quatre points sont sans conséquence tant que les données sont fictives.
Ils deviennent bloquants au premier dossier réel.
