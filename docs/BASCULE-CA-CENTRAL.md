# Bascule vers un hébergement canadien

Marche à suivre pour déplacer la plateforme de `us-west-2` (Oregon) vers
`ca-central-1` (Canada Central, Toronto).

La région d'un projet Supabase ne peut pas être changée après sa création :
il faut créer un projet neuf et y rejouer la lignée de migrations.

---

## Avant de commencer

Cette opération est **sans risque aujourd'hui** et le sera de moins en
moins. État actuel de la base :

| | |
|---|---|
| Clients, dossiers, documents, factures | 0 |
| Cabinets | 2 (le vôtre et celui de démonstration) |
| Comptes | 3 |

Il n'y a rien à sauvegarder. Tout ce qui existe se recrée par script.

Une fois vos premiers dossiers réels saisis, la même opération devient une
migration de renseignements personnels sensibles : export vérifié,
notification, et destruction sécurisée de la copie américaine.

---

## 1. Créer le projet — tableau de bord Supabase

Nouveau projet dans l'organisation **Moncabinetcric**.

| Champ | Valeur |
|---|---|
| Nom | au choix — par exemple `moncabinetcric-ca` |
| **Region** | **`Canada (Central)` — c'est le seul champ qui compte** |
| Database password | en générer un fort et le conserver |

Le menu de région se trouve sous le nom du projet. **Vérifiez-le deux
fois : il ne pourra plus être modifié.**

Attendre que le projet passe en `ACTIVE_HEALTHY`, environ deux minutes.

---

## 2. Récupérer les clés — Settings → API Keys

Trois valeurs à relever :

- l'URL du projet, de la forme `https://<ref>.supabase.co`
- la clé publique (`anon` ou `sb_publishable_…`)
- la clé secrète (`service_role` ou `sb_secret_…`), masquée derrière « Reveal »

---

## 3. Pointer l'application vers le nouveau projet

Dans `.env.local`, remplacer les trois premières lignes :

```
NEXT_PUBLIC_SUPABASE_URL=https://<nouveau-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé publique>
SUPABASE_SERVICE_ROLE_KEY=<clé secrète>
```

Ne pas toucher à `DATA_SOURCE=supabase`.

La clé secrète peut être posée en saisie masquée, avec vérification de son
rôle avant écriture :

```
./cric cle
```

---

## 4. Mettre à jour le serveur MCP

Dans `~/.gemini/config/mcp_config.json`, remplacer `project_ref` par la
nouvelle référence. Sans cela, les scripts continueraient d'appliquer les
migrations sur l'ancien projet — sans erreur apparente.

```json
"serverUrl": "https://mcp.supabase.com/mcp?project_ref=<nouveau-ref>&read_only=true"
```

---

## 5. Provisionner

```
./cric provisionner            # simulation : région, migrations, garde-fou
./cric provisionner --apply
```

Le script rejoue les onze migrations dans l'ordre, recrée le cabinet
exploitant depuis `firm-identity.json`, le cabinet de démonstration, les
trois comptes et l'administrateur de plateforme.

Il **refuse de s'exécuter** si le projet visé contient déjà des cabinets,
des profils ou des données métier — pour ne jamais dupliquer un projet en
service.

Il signale également si la région visée n'est pas canadienne : c'est le
seul contrôle qui ne peut pas être rattrapé après coup.

---

## 6. Vérifier

```
./cric verifier     # 0 échec attendu
./cric roles        # la matrice doit être respectée
```

Puis se poser un mot de passe et ouvrir l'application :

```
./cric motdepasse --email=infos@dgvimmigration.com
./cric dev
```

Contrôles à faire à l'œil :

- `/fr/connexion` accepte le mot de passe
- `/fr/dashboard` affiche 0 partout, sans erreur
- `/fr/admin` liste les deux cabinets
- `/fr/confidentialite` nomme bien Diarra Global et le permis R1041776

---

## 7. Mettre les mentions légales à jour

La section 6 de la politique de confidentialité dit que la région
d'hébergement « doit être confirmée ». Une fois la bascule faite, elle peut
enfin affirmer un hébergement canadien — et l'évaluation des facteurs
relatifs à la vie privée pour transfert hors Québec n'a plus lieu d'être.

C'est le vrai gain de l'opération : une obligation supprimée, pas
documentée.

---

## 8. Supprimer l'ancien projet

Seulement après avoir vérifié le point 6, et sans précipitation. Tant que
l'ancien projet existe, il reste une copie de vos données aux États-Unis —
vides aujourd'hui, mais autant ne pas l'oublier en service.

Tableau de bord → ancien projet → Settings → General → Delete project.
