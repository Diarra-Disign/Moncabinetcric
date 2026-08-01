# moncabinetcric — SaaS de Gestion pour Consultants en Immigration Canadienne (RCIC / CICC)

**moncabinetcric** est une plateforme professionnelle tout-en-un conçue spécifiquement pour les Consultants Réglementés en Immigration Canadienne (RCIC / CICC).

## 🚀 Stack Technique

- **Framework** : Next.js 16 (App Router, Turbopack) & React 19
- **Styling** : Tailwind CSS v4
- **Internationalisation (i18n)** : `next-intl` v4 (Français / Anglais)
- **Icônes** : `lucide-react`
- **Gestionnaire de paquets** : pnpm

## 📁 Fonctionnalités Clés

- **Tableau de Bord & Analytics** : KPI d'activité, dossiers actifs, documents expirés.
- **Portefeuille de Dossiers CICC** : Gestion multi-programmes (Résidence Permanente, EIMT, Permis d'Études, Parrainage).
- **Agenda & Visioconférence** : Grille horodatée interactive, synchronisation externe (Calendly, Google Calendar, Outlook).
- **Pipeline Commercial (CRM)** : Prospection B2B / B2C et conversion directe en mandat CICC.
- **Facturation & Fidéicommis** : Rapprochement comptable, gestion des taxes provinciales/exonérations et reçus fiduciaires.
- **Gestion Documentaire** : Numérisation, alertes d'expiration et autoremplissage intelligent des formulaires IRCC (IMM 0008, IMM 5476, etc.).
- **Portail Client Sécurisé** : Dépôt de pièces, suivi de demande et visioconférence.

## 🛠️ Démarrage Local

```bash
# Installation des dépendances
pnpm install

# Démarrer le serveur de développement
pnpm dev

# Build de production
pnpm build
```

Accéder à l'application : [http://localhost:3000/fr/dashboard](http://localhost:3000/fr/dashboard)
