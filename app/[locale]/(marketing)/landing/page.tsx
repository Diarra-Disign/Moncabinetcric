import { getLocale, getTranslations } from "next-intl/server"
import { LandingClient } from "./landing-client"
import { formatMontant, type Plan } from "@/lib/billing/plans"
import { getCatalogue } from "@/lib/billing/catalogue"

export default async function LandingPage() {
  const tLanding = await getTranslations("Landing")
  const locale = await getLocale()

  // Le catalogue vient de la base : un prix corrigé depuis la console apparaît
  // ici sans déploiement. `plan()` retombe sur un forfait vide quand la clé
  // n'existe plus — la carte affiche alors un tarif nul plutôt que de faire
  // échouer toute la page publique.
  const catalogue = await getCatalogue()
  const plan = (cle: string): Plan =>
    catalogue.find((p) => p.key === cle) ?? {
      key: cle, labelFr: "", labelEn: "", taglineFr: "", taglineEn: "", rank: 0,
      purchasable: false, monthly: 0, annual: 0, extraSeatMonthly: 0,
      extraSeatAnnual: 0, seatsIncluded: 1, maxSeats: null, aiConnector: false,
    }

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
      plusBusinessLabel: tLanding("pricing.plusBusinessLabel"),
      plusEnterpriseLabel: tLanding("pricing.plusEnterpriseLabel"),
      // Chaque bloc porte désormais la CLÉ DU FORFAIT qu'il décrit. Ils
      // s'appelaient « basic » et « business » alors qu'ils désignaient Solo
      // et Cabinet Pro : ajouter le vrai forfait Business par-dessus aurait
      // laissé « pricing.business » pointer sur un autre forfait que celui de
      // son nom — le genre de piège qui se paie une seule fois, très cher.
      solo: {
        name: tLanding("pricing.solo.name"),
        price: prix(plan('solo').monthly ?? 0),
        annual: tLanding("pricing.annualNote", { price: prix(plan('solo').annual ?? 0) }),
        desc: tLanding("pricing.solo.desc"),
        f1: tLanding("pricing.solo.f1"),
        f2: tLanding("pricing.solo.f2"),
        f3: tLanding("pricing.solo.f3"),
        f4: tLanding("pricing.solo.f4"),
        // La gestion du fidéicommis n'apparaissait nulle part sur la page
        // publique alors que le module est livré à TOUS les forfaits. Elle est
        // annoncée dans le forfait d'entrée, et les autres cartes en héritent
        // par leur « … plus : ». Le libellé ne promet que ce qui est construit :
        // un registre ventilé par client et le rapprochement bancaire. Ni
        // lien bancaire, ni automatisation, ni conformité garantie.
        f5: tLanding("pricing.solo.f5"),
        btn: tLanding("pricing.solo.btn"),
      },
      cabinet: {
        name: tLanding("pricing.cabinet.name"),
        price: prix(plan('cabinet').monthly ?? 0),
        annual: tLanding("pricing.annualNote", { price: prix(plan('cabinet').annual ?? 0) }),
        desc: tLanding("pricing.cabinet.desc"),
        f1: tLanding("pricing.cabinet.f1", { price: prix(plan('cabinet').extraSeatMonthly) }),
        f2: tLanding("pricing.cabinet.f2"),
        f3: tLanding("pricing.cabinet.f3"),
        f4: tLanding("pricing.cabinet.f4"),
        badge: tLanding("pricing.cabinet.badge", { defaultValue: "RECOMMANDÉ" }),
        btn: tLanding("pricing.cabinet.btn"),
      },
      // Cabinet Business était vendable et vendu dans l'application depuis la
      // refonte du catalogue, sans figurer nulle part sur la page publique :
      // un visiteur ne pouvait pas le découvrir. C'est ./cric facturation qui
      // l'a signalé, une fois réparé.
      //
      // Ses fonctions sont EXACTEMENT celles de Cabinet Pro — vérifié dans
      // plan_features. L'écart est économique : huit places au lieu de trois,
      // et des places moins chères. La carte ne promet donc aucune fonction
      // supplémentaire, parce qu'il n'y en a aucune.
      business: {
        name: tLanding("pricing.business.name"),
        price: prix(plan('business').monthly ?? 0),
        annual: tLanding("pricing.annualNote", { price: prix(plan('business').annual ?? 0) }),
        desc: tLanding("pricing.business.desc"),
        f1: tLanding("pricing.business.f1"),
        f2: tLanding("pricing.business.f2", { price: prix(plan('business').extraSeatMonthly) }),
        f3: tLanding("pricing.business.f3"),
        f4: tLanding("pricing.business.f4"),
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
