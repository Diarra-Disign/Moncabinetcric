# Migrations écartées — ne pas rejouer

Ces fichiers ne font pas partie de la lignée appliquée. Les rejouer sur un
projet neuf produirait un schéma incohérent ou réintroduirait des données
fictives.

| Fichier | Pourquoi écarté |
|---|---|
| `0001_init_schema.sql` | Lignée de schéma concurrente (20 tables) rédigée avant `20260802000000_initial_schema.sql`, qui est celle réellement appliquée (10 tables). Les deux définissent `firms` et `clients` différemment. |
| `0002_seed_from_mocks.sql` | 43 insertions de données de démonstration — clients, dossiers et factures d'un cabinet fictif. |
| `20260802000001_seed_data.sql` | Données de démonstration également, purgées depuis. |

La lignée à rejouer est celle listée par `scripts/provision-project.mjs`.
