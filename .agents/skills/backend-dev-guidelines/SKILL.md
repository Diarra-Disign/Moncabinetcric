---
name: backend-dev-guidelines
description: Directives d'ingénierie backend pour la conception, l'architecture en couches, l'accès aux données, la validation Zod, la gestion des erreurs et l'observabilité sous Node.js / Express / Next.js API Routes. Déclencher dès que le travail concerne des routes API, contrôleurs, services backend, repositories, requêtes de données ou middlewares.
---

# Backend Development Guidelines

**(Node.js · Express · Next.js API Routes · TypeScript · PostgreSQL / Prisma)**

Vous êtes un **ingénieur backend senior** opérant sur des services en production sous des contraintes strictes d'architecture, de sécurité et de fiabilité.

Votre objectif est de concevoir et maintenir des **systèmes backend prévisibles, observables et maintenables** en respectant :
* Une architecture en couches (Layered Architecture)
* Des frontières d'erreurs explicites (Explicit Error Boundaries)
* Un typage et des validations stricts (Zod + TypeScript)
* Une configuration centralisée
* Une observabilité de premier ordre

---

## 1. Indice de Faisabilité & Risque Backend (BFRI)

Avant d'implémenter ou modifier une fonctionnalité backend, évaluer sa faisabilité :

### Dimensions BFRI (1 à 5)

| Dimension | Question clé |
| --- | --- |
| **Alignement Architectural** | Le code respecte-t-il `Routes → Controllers → Services → Repositories` ? |
| **Complexité Métier** | Quelle est la complexité des règles métier ? |
| **Risque Données** | La modification touche-t-elle des données critiques ou transactions ? |
| **Risque Opérationnel** | L'impact touche-t-il l'authentification, la facturation ou la fiducie ? |
| **Testabilité** | La fonctionnalité peut-elle être testée (unitaires + intégration) ? |

### Formule de Calcul
```
BFRI = (Alignement Architectural + Testability) − (Complexité + Risque Données + Risque Opérationnel)
```
* **6 à 10 (Sûr)** : Procéder à l'implémentation.
* **3 à 5 (Modéré)** : Ajouter des tests unitaires & surveillance.
* **0 à 2 (Risqué)** : Isolations ou refactorisation préalable nécessaire.
* **< 0 (Dangereux)** : Redéfinir l'architecture avant de coder.

---

## 2. Doctrine Architectural Fondamentale (Non-Négociable)

### 1. Architecture en Couches Obligatoire
```
Routes / Endpoints → Controllers → Services → Repositories → Base de Données
```
* Aucun saut de couche.
* Aucune fuite d'abstraction entre les couches.
* Chaque couche possède **une seule responsabilité**.

### 2. Les Routes uniquement pour le Routage
Les routes ou handlers d'API ne contiennent **aucune logique métier**. Elles délèguent immédiatement au contrôleur ou au service concerné.

### 3. Les Contrôleurs Coordonnent, Les Services Décident
* **Contrôleurs** : Analysent la requête HTTP, appellent les services, gèrent le format de réponse JSON et la transmission des erreurs.
* **Services** : Contiennent l'ensemble de la logique d'affaires, sont indépendants du framework HTTP, exploitent l'injection de dépendances et sont 100% testables.

### 4. Gestion Centralisée des Erreurs
* Ne jamais absorber les exceptions en silence (`catch(e) {}` vide interdit).
* Transformer les erreurs système/base de données en erreurs de domaine explicites (`DomainError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`).
* Retourner une enveloppe d'erreur standardisée : `{ success: false, error: { code, message, details } }`.

### 5. Validation Stricte à l'Entrée avec Zod
* Valider et assainir tous les corps de requêtes (`req.body`), paramètres d'URL (`req.params`) et requêtes (`req.query`) à la frontière d'entrée via des schémas Zod.
