---
name: skill-creator
description: |
  Guide méthodique et automatisé pour concevoir, structurer, rédiger et déployer des compétences (skills) Google Antigravity de haute qualité, claires, optimisées et directement fonctionnelles.
  Toutes les compétences générées ainsi que l'ensemble des instructions sont intégralement rédigées en Français.

  Déclencher obligatoirement dès que :
  - L'utilisateur demande de créer, concevoir, corriger, refactoriser ou documenter une nouvelle compétence (skill).
  - L'utilisateur mentionne des termes tels que "créer un skill", "nouvelle compétence", "créer une compétence", "SKILL.md", "dossier .agents/skills", "customization root".
---

# Créateur de Compétences Google Antigravity (Skill Creator)

Ce skill est le guide de référence obligatoire pour concevoir et générer des compétences (skills) Google Antigravity respectant rigoureusement la documentation officielle et les meilleures pratiques d'ingénierie d'agents IA.

---

## 🎯 Principes Fondamentaux d'un Skill Antigravity

Une **compétence (skill)** est un ensemble d'instructions, de scripts et de ressources qui étendent les capacités autonomes de l'agent pour des tâches spécialisées.

### 1. Structure du Répertoire d'un Skill
Chaque compétence réside dans son propre dossier et respecte l'arborescence suivante :

```text
skills/<nom-du-skill>/
├── SKILL.md                 # [REQUIS] Instructions principales avec frontmatter YAML
├── scripts/                 # [OPTIONNEL] Scripts d'assistance exécutables (Bash, Python, JS...)
├── examples/                # [OPTIONNEL] Implémentations et exemples de référence
├── resources/               # [OPTIONNEL] Fichiers modèles, templates, données statiques
└── references/              # [OPTIONNEL] Documentation étendue (si SKILL.md > 500 lignes)
```

### 2. Emplacements de Déploiement (Customization Roots)
- **Global** : `/Users/<username>/.gemini/config/skills/<nom-du-skill>/SKILL.md` (s'applique à tous les projets).
- **Projet / Workspace** : `.agents/skills/<nom-du-skill>/SKILL.md` (spécifique au projet actuel).

---

## 📐 Anatomie et Règles d'Écriture du Fichier `SKILL.md`

Le fichier `SKILL.md` se compose de deux parties essentielles :

### A. Le Frontmatter YAML (Déclenchement / Triggering)
> ⚠️ **CRITIQUE** : Seuls les champs `name` et `description` du frontmatter YAML sont analysés pour décider de l'activation d'une compétence. Le corps Markdown n'est lu qu'APRÈS activation.

- **`name`** : Identifiant unique en `kebab-case` (ex: `web-scraper`, `react-component-builder`, `skill-creator`).
- **`description`** : Doit décrire précisément le rôle et lister explicitement les **mots-clés et scénarios de déclenchement** (*Trigger when...* / *Déclencher pour...*) ainsi que les cas d'exclusion (*DO NOT trigger for...*).

### B. Le Corps Markdown (Directives d'Exécution)
- Doit être concis, direct et structuré (idéalement **< 500 lignes**).
- Si des explications dépassent 500 lignes, les déplacer dans le dossier `references/` et y faire référence dans `SKILL.md`.
- Rédiger intégralement en **Français** clair et technique.

---

## 🚀 Procédure Étape par Étape pour Créer un Nouveau Skill

Lorsqu'une demande de création de compétence est formulée, appliquer scrupuleusement la démarche suivante :

### Étape 1 : Analyser le Besoin et Définir le Périmètre
1. Déterminer le nom du skill (en `kebab-case`).
2. Identifier la portée : **Projet** (`.agents/skills/`) ou **Globale** (`.gemini/config/skills/`).
3. Lister les déclencheurs (mots-clés, intentions utilisateur, extensions de fichiers, tâches spécifiques).

### Étape 2 : Structurer le Frontmatter YAML
Rédiger une description riche incluant :
- Le rôle principal du skill.
- Les cas d'activation immédiate.
- Les cas où le skill ne doit PAS s'activer.

### Étape 3 : Rédiger le Corps de `SKILL.md`
Le document doit comporter les sections suivantes :
1. **Titre et Introduction** : Rôle et objectif principal.
2. **Conditions d'Activation & Prérequis** : Quand et comment l'utiliser.
3. **Workflow Opérationnel (Étape par étape)** : Instructions séquentielles et claires pour l'agent.
4. **Directives & Règles Strictes** : Bonnes pratiques, interdictions et contraintes.
5. **Modèles de Code / Exemples** : Blocs de code prêts à l'emploi.

### Étape 4 : Créer les Fichiers Annexes (si nécessaire)
- Placer les scripts répétitifs ou complexes dans `scripts/`.
- Placer la documentation secondaire dans `references/`.

---

## 📋 Modèle Standard (Template) d'un Fichier `SKILL.md`

```markdown
---
name: nom-de-la-competence
description: |
  Description claire du rôle de la compétence en Français.

  Déclencher immédiatement pour :
  - [Mots-clés / Tâches spécifiques]
  - [Formulations d'intentions utilisateur]

  NE PAS déclencher pour :
  - [Cas d'exclusion hors périmètre]
---

# Nom de la Compétence

Description concise de l'objectif et de l'utilité de cette compétence.

## 🎯 Objectifs & Cas d'Usage

- Objectif 1
- Objectif 2

## 🔄 Workflow par Étapes

### Étape 1 : [Titre de l'étape]
Instructions précises sur ce que l'agent doit vérifier ou faire.

### Étape 2 : [Titre de l'étape]
Instructions d'exécution, d'écriture ou de génération.

## ⚠️ Règles et Contraintes Strictes

- Règle 1 : Ne jamais...
- Règle 2 : Toujours vérifier...

## 💡 Exemples de Référence

```[langage]
// Exemple de code ou de configuration
```
```

---

## ✅ Check-list de Validation d'un Skill Généré

Avant de finaliser la création d'un skill, vérifier les points suivants :
- [ ] Le fichier est placé dans `.agents/skills/<nom>/SKILL.md` ou `~/.gemini/config/skills/<nom>/SKILL.md`.
- [ ] Le nom dans le frontmatter est en `kebab-case`.
- [ ] La description YAML contient des déclencheurs explicites et précis.
- [ ] Tout le contenu est intégralement rédigé en **Français**.
- [ ] Le fichier `SKILL.md` fait moins de 500 lignes (documentation supplémentaire déplacée dans `references/` si besoin).
- [ ] Les chemins de fichiers vers le skill sont correctement formatés sous forme de liens GitHub Markdown (`[SKILL.md](file:///path/to/SKILL.md)`).
