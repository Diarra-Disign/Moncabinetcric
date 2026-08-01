# Check-list Complète d'Audit & Design UI/UX Pro Max

Ce document sert de guide de référence étendu pour auditer et concevoir des interfaces utilisateur d'exception.

---

## 🎨 1. Définition des Jetons de Design (Design Tokens)

### Variables CSS Conseillées (`:root`)
```css
:root {
  /* Polices */
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Plus Jakarta Sans', var(--font-sans);

  /* Couleurs - Mode Sombre Premium */
  --bg-base: hsl(222, 47%, 7%);
  --bg-surface: hsl(217, 33%, 12%);
  --bg-surface-hover: hsl(217, 33%, 17%);

  /* Éléments de Texte */
  --text-primary: hsl(210, 40%, 98%);
  --text-secondary: hsl(215, 20%, 65%);
  --text-tertiary: hsl(215, 16%, 47%);

  /* Marque et Accents */
  --primary: hsl(250, 84%, 67%);
  --primary-hover: hsl(250, 84%, 74%);
  --accent: hsl(172, 66%, 50%);

  /* Statuts */
  --success: hsl(142, 71%, 45%);
  --warning: hsl(38, 92%, 50%);
  --danger: hsl(354, 84%, 57%);

  /* Espacements (Système 8pt) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Rayons de Bordure */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;

  /* Ombre & Éléments de Profondeur */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-glow: 0 0 20px -3px var(--primary);
}
```

---

## ♿ 2. Check-list d'Accessibilité (WCAG 2.1)

- [ ] **Contraste des couleurs** : Ratio d'au moins 4.5:1 pour le texte normal et 3:1 pour le texte volumineux (>= 18pt).
- [ ] **Visibilité du Focus** : Tout élément interactif au clavier (`Tab`) affiche un indicateur clair (`:focus-visible`).
- [ ] **Attributs ARIA** : Boutons avec icônes seules dotés de `aria-label`, modales avec `role="dialog"` et `aria-modal="true"`.
- [ ] **Taille des Zones Cliquables** : Au moins 44px x 44px sur mobile et écran tactile.
- [ ] **Structure sémantique HTML5** : Un seul `<h1>` par page, suivi de `<h2>`, `<h3>` hiérarchisés sans saut de niveau.
- [ ] **Alternatives textuelles** : Les images informatives comportent une balise `alt` descriptive (`alt=""` réservé aux images purement décoratives).

---

## 📱 3. Responsive Design & Layouts

- [ ] **Breakpoints Standardisés** :
  - Mobile : `< 640px`
  - Tablette : `640px - 1024px`
  - Desktop : `1024px - 1440px`
  - Ultra-Wide : `> 1440px`
- [ ] **Fluid Typography** : Utilisation de `clamp()` pour des titres réactifs sans media queries excessives (ex: `font-size: clamp(1.75rem, 4vw, 3rem)`).
- [ ] **Débordement d'Écran (No Horizontal Scroll)** : Garantir que `max-width: 100%` et `box-sizing: border-box` empêchent tout défilement parasite.
