# Pourquoi `vercel.json` fixe la région à `yul1`

`vercel.json` est un fichier JSON : il n'accepte pas de commentaire. Cette
note tient lieu d'explication, et elle est versionnée à côté de lui.

## Le défaut qu'il corrige

La base de données, l'authentification et le stockage sont hébergés en
`ca-central-1` — au Canada. L'hébergement APPLICATIF, lui, n'était fixé nulle
part : aucun `vercel.json` n'existait, et la région par défaut du fournisseur
est aux États-Unis.

Or c'est dans ces fonctions que les renseignements sont réellement manipulés.
Un contrat s'y compose, un PDF s'y assemble, un dossier s'y lit. Dire que les
données « sont au Canada » parce que la base l'est, c'est décrire l'entrepôt en
oubliant l'atelier.

La politique de confidentialité publiée affirmait pourtant :

> « Les renseignements sont hébergés au Canada […]. Ils ne sont pas transférés
> hors du Canada dans le cadre de l'exploitation courante de la plateforme. »

Exact pour le stockage. Inexact pour le traitement.

## Pourquoi fixer plutôt que déclarer

Deux issues existaient : corriger la politique pour y documenter un transfert
hors Québec au sens de l'article 17 de la Loi 25, ou supprimer le transfert.

La seconde a été retenue. Elle coûte une ligne de configuration, elle rend la
phrase publiée vraie au lieu de la nuancer, et elle évite d'avoir à faire
reposer une conformité sur une explication que personne ne lira.

## Et un gain qui n'était pas le but

`yul1` est à Montréal, `ca-central-1` aussi. Les fonctions s'exécutent
désormais à côté de la base plutôt qu'à Washington : chaque requête économise
un aller-retour transfrontalier. La conformité et la latence tirent ici dans le
même sens, ce qui est assez rare pour être noté.

## À vérifier après tout changement d'hébergement

Une région se déclare ici, mais elle se CONSTATE sur un déploiement. Le
contrôle est décrit dans `docs/conformite/EFVP-2026-08-12.md`, section 5.2 :
toute modification de la région déclenche une réévaluation.
