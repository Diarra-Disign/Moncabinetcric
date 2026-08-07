import { getLocale, getTranslations } from "next-intl/server"
import { LandingClient } from "./landing-client"
import { PLANS, formatMontant } from "@/lib/billing/plans"

export default async function LandingPage() {
  const tLanding = await getTranslations("Landing")
  const locale = await getLocale()

  // Les montants viennent du catalogue, jamais du fichier de traduction.
  // Deux tarifs publics contradictoires — l'un dans le code, l'autre dans les
  // traductions — ont déjà coexisté sur cette page. Un prix qu'on peut écrire
  // à deux endroits finit toujours par y différer, et c'est le client qui
  // découvre lequel est facturé.
  const prix = (cents: number) => formatMontant(cents, locale)

  // Assemble translation object to pass to client component
  const translations = {
    nav: {
      product: tLanding("nav.product"),
      solution: tLanding("nav.solution"),
      features: tLanding("nav.features"),
      testimonials: tLanding("nav.testimonials"),
      faq: tLanding("nav.faq"),
      bookDemo: tLanding("nav.bookDemo"),
      login: tLanding("nav.login", { defaultValue: "Espace Cabinet" }),
    },
    hero: {
      badge: tLanding("hero.badge", { defaultValue: "✦ NOUVEAU : CONFORMITÉ CICC & RAPPELS AUTOMATIQUES" }),
      title: tLanding("hero.title"),
      subtitle: tLanding("hero.subtitle"),
      ctaPrimary: tLanding("hero.ctaPrimary", { defaultValue: "Réserver une démo privée" }),
      ctaSecondary: tLanding("hero.ctaSecondary", { defaultValue: "Explorer le portail client" }),
    },
    // Ces trois chiffres portaient des valeurs de repli — « 99.8% de
    // conformité », « 0 oubli », « 3x plus rapide » — qu'aucune mesure ne
    // soutenait. Un repli est une valeur affichée : il engage autant que
    // le fichier de traduction. Les clés existent, elles suffisent.
    stats: {
      stat1Value: tLanding("stats.stat1Value"),
      stat1Label: tLanding("stats.stat1Label"),
      stat2Value: tLanding("stats.stat2Value"),
      stat2Label: tLanding("stats.stat2Label"),
      stat3Value: tLanding("stats.stat3Value"),
      stat3Label: tLanding("stats.stat3Label"),
    },
    features: {
      sectionBadge: tLanding("features.sectionBadge", { defaultValue: "CONÇU POUR LE DROIT DE L'IMMIGRATION" }),
      sectionTitle: tLanding("features.sectionTitle", { defaultValue: "Une architecture pensée pour la rigueur et la clarté." }),
      sectionSubtitle: tLanding("features.sectionSubtitle", { defaultValue: "Chaque module résout un point de friction réel des consultants réglementés : données uniques, zéro saisie en double, traçabilité absolue." }),
      f1Title: tLanding("features.f1Title"),
      f1Desc: tLanding("features.f1Desc"),
      f2Title: tLanding("features.f2Title"),
      f2Desc: tLanding("features.f2Desc"),
      f3Title: tLanding("features.f3Title"),
      f3Desc: tLanding("features.f3Desc"),
      f4Title: tLanding("features.f4Title"),
      f4Desc: tLanding("features.f4Desc"),
    },
    pricing: {
      badge: tLanding("pricing.badge", { defaultValue: "TARIFICATION TRANSPARENTE" }),
      title: tLanding("pricing.title"),
      subtitle: tLanding("pricing.subtitle"),
      period: tLanding("pricing.period"),
      taxNote: tLanding("pricing.taxNote"),
      // Ces trois intitulés étaient écrits en dur dans le composant, donc
      // affichés en français sur la page anglaise.
      includedLabel: tLanding("pricing.includedLabel"),
      plusProLabel: tLanding("pricing.plusProLabel"),
      plusEnterpriseLabel: tLanding("pricing.plusEnterpriseLabel"),
      basic: {
        name: tLanding("pricing.basic.name"),
        price: prix(PLANS.solo.monthly),
        annual: tLanding("pricing.annualNote", { price: prix(PLANS.solo.annual) }),
        desc: tLanding("pricing.basic.desc"),
        f1: tLanding("pricing.basic.f1"),
        f2: tLanding("pricing.basic.f2"),
        f3: tLanding("pricing.basic.f3"),
        f4: tLanding("pricing.basic.f4"),
        btn: tLanding("pricing.basic.btn"),
      },
      business: {
        name: tLanding("pricing.business.name"),
        price: prix(PLANS.cabinet.monthly),
        annual: tLanding("pricing.annualNote", { price: prix(PLANS.cabinet.annual) }),
        desc: tLanding("pricing.business.desc"),
        f1: tLanding("pricing.business.f1", { price: prix(PLANS.cabinet.extraSeatMonthly) }),
        f2: tLanding("pricing.business.f2"),
        f3: tLanding("pricing.business.f3"),
        f4: tLanding("pricing.business.f4"),
        badge: tLanding("pricing.business.badge", { defaultValue: "RECOMMANDÉ" }),
        btn: tLanding("pricing.business.btn"),
      },
      enterprise: {
        name: tLanding("pricing.enterprise.name"),
        price: tLanding("pricing.enterprise.price"),
        desc: tLanding("pricing.enterprise.desc"),
        f1: tLanding("pricing.enterprise.f1"),
        f2: tLanding("pricing.enterprise.f2"),
        f3: tLanding("pricing.enterprise.f3"),
        f4: tLanding("pricing.enterprise.f4"),
        btn: tLanding("pricing.enterprise.btn"),
      },
    },
    finalCta: {
      title: tLanding("finalCta.title"),
      subtitle: tLanding("finalCta.subtitle"),
      ctaPrimary: tLanding("finalCta.ctaPrimary"),
      ctaSecondary: tLanding("finalCta.ctaSecondary"),
    },
    faq: {
      badge: tLanding("faq.badge", { defaultValue: "RÉPONSES CLAIRES" }),
      title: tLanding("faq.title"),
      q1: tLanding("faq.q1"),
      a1: tLanding("faq.a1", { defaultValue: "Notre architecture respecte strictement les normes de tenue de dossiers : journal d'audit infalsifiable horodaté par utilisateur, hébergement des données et séparation stricte des environnements de test et de production." }),
      q2: tLanding("faq.q2"),
      a2: tLanding("faq.a2", { defaultValue: "Le pipeline commercial suit vos prospects jusqu'à la signature de l'entente. Une fois converti, le client passe dans le pipeline réglementaire (IRCC / MIFI) avec ses échéances propres, sans jamais polluer vos statistiques de vente." }),
      q3: tLanding("faq.q3"),
      a3: tLanding("faq.a3", { defaultValue: "Oui. Le système applique automatiquement les règles de taxation selon le pays de résidence de la fiche client (TPS/TVQ/TVH ou exonération internationale), avec mention légale sur la facture et possibilité de modification manuelle." }),
      q4: tLanding("faq.q4", { defaultValue: "Puis-je exporter l'intégralité d'un dossier en cas de contrôle ou transfert ?" }),
      a4: tLanding("faq.a4", { defaultValue: "Absolument. En un seul clic, vous pouvez générer une archive complète (PDF consolidé ou ZIP) contenant l'historique, les notes, le contrat et toutes les pièces justificatives du client." }),
    },
  }

  return <LandingClient t={translations} />
}
