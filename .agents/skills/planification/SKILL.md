---
name: planification
description: |
  Compétence de planification technique granulaire pour convertir une spécification ou un besoin complexe en un plan d'implémentation étape par étape (TDD, tâches granulaires de 2 à 5 min, validation de périmètre). Inspiré de obra/superpowers (writing-plans).
  Toutes les directives et étapes sont intégralement rédigées en Français.

  Déclencher obligatoirement dès que :
  - L'utilisateur demande un plan d me mise en œuvre, une feuille de route, un découpage de tâches ou une stratégie d'implémentation multi-étapes.
  - L'utilisateur mentionne "planification", "plan d'implémentation", "plan d'action", "découper en tâches", "roadmap", "planifier", "writing-plans".

  NE PAS déclencher pour :
  - La simple exécution d'une tâche unique déjà trivialement définie.
---

# Planification d'Implémentation Granulaire (Superpowers)

Cette compétence permet de concevoir des plans d'exécution ultra-précis, granulaires et structurés, garantissant une implémentation sans friction, testée et commitée régulièrement.

---

## 🎯 Principes Directeurs

1. **Granularité Ultra-Fine (2 à 5 minutes par sous-tâche)** : Découper chaque action en unités atomiques facilement vérifiables.
2. **Développement Guidé par les Tests (TDD)** : Écrire d'abord le test en échec, implémenter le code minimal pour réussir, puis commiter.
3. **Isolation des Responsabilités (DRY / YAGNI)** : Modifier un ensemble restreint de fichiers cohérents par tâche.
4. **Annonce au Démarrage** : Toujours annoncer : *"J'utilise la compétence `planification` pour rédiger le plan d'implémentation."*

---

## 📐 Structure du Fichier de Plan d'Implémentation

Chaque plan d'implémentation doit être sauvegardé sous :  
📁 `docs/plans/YYYY-MM-DD-<nom-de-la-fonctionnalite>.md`

### En-tête Obligatoire du Document de Plan
```markdown
# Plan d'Implémentation - [Nom de la Fonctionnalité]

> **Note aux Agents :** Suivre strictement chaque étape séquentielllement. Exécuter un cycle complet (Test -> Code -> Verification -> Commit) pour chaque tâche.
```

---

## 🔄 Découpage Granulaire d'une Tâche (Exemple de Workflow Atomique)

Chaque sous-tâche doit suivre précisément ces 5 micro-étapes :

1. **Étape 1** : Écrire le test unitaire ou d'intégration qui échoue.
2. **Étape 2** : Exécuter le test et vérifier son échec explicite.
3. **Étape 3** : Rédiger le code minimaliste permettant de faire passer le test.
4. **Étape 4** : Réexécuter la suite de tests et confirmer la réussite (100% vert).
5. **Étape 5** : Effectuer un commit Git avec un message clair (ex: `feat(core): ajout du filtre par statut`).

---

## 📋 Modèle Standard de Plan d'Implémentation

```markdown
# Plan d'Implémentation : [Nom de la Fonctionnalité]

## 1. Périmètre & Architecture Fichiers
- [ ] `[MODIFIER]` `lib/services/audit.ts` - Ajout de la fonction d'horodatage
- [ ] `[Nouveau]` `lib/services/audit.test.ts` - Tests unitaires de conformité

## 2. Découpage des Tâches Séquentielles

### Tâche 1 : Mise en place du modèle de données (Est. 5 min)
- [ ] Rédiger le test unitaire pour l'initialisation du modèle dans `audit.test.ts`
- [ ] Lancer les tests et constater l'échec
- [ ] Définir l'interface dans `audit.ts`
- [ ] Valider le passage du test
- [ ] Commiter les modifications (`feat(audit): initialisation du modèle`)

### Tâche 2 : Intégration de l'interface utilisateur (Est. 5 min)
- [ ] Écrire le test d'affichage du composant
- [ ] Créer le composant minimal
- [ ] Valider les tests et la mise en page
- [ ] Commiter (`feat(ui): ajout du badge d'audit`)
```

---

## ⚠️ Règles d'Or de la Planification

- 🟢 **Ne jamais regrouper plusieurs sous-systèmes indépendants** dans un seul plan géant : créer un plan distinct par sous-système.
- 🟢 **Vérification pré-exécution** : Valider que chaque fichier mentionné dans le plan a sa responsabilité clairement identifiée.
- 🟢 **Commits Fréquents** : Un commit par sous-tâche accomplie pour garantir la traçabilité.
