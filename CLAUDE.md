# Conventions & Règles de développement - moncabinetcric

## Architecture & i18n
- **Bilinguisme strict** : Aucune chaîne de caractères visible n'est codée en dur. Tout texte de l'UI doit utiliser `useTranslations` (next-intl) et se trouver dans `messages/fr.json` et `messages/en.json`.
- **Routage** : Toutes les pages de l'application sont situées sous `app/[locale]/...`. Ne jamais utiliser de routes non localisées sauf pour des webhooks ou des assets statiques.
- **Server Components par défaut** : Utiliser `use client` uniquement quand l'interactivité (état, événements) est requise. Préférer les Server Actions pour les mutations de données.
- **Data Fetching** : Une couche unique `lib/data/` concentre l'accès aux données. Cette couche utilisera d'abord des mocks, puis sera branchée sur Supabase sans modifier l'UI.
- **Style** : Tailwind CSS avec des variables définies dans `tailwind.config.ts`. Ne jamais utiliser de valeurs magiques (ex: `w-[42px]`) mais s'appuyer sur le système de design et les primitives dans `components/ui/`.
