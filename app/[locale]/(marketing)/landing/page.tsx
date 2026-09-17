import type { Metadata } from "next"
import { getLocale } from "next-intl/server"
import { AssuranceBand } from "@/components/marketing/assurance-band"
import { FaqSection } from "@/components/marketing/faq-section"
import { FeaturesSection } from "@/components/marketing/features-section"
import { FinalCta } from "@/components/marketing/final-cta"
import { Hero } from "@/components/marketing/hero"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { MarketingNav } from "@/components/marketing/marketing-nav"
import { PricingSection } from "@/components/marketing/pricing-section"
import { ProductPreview } from "@/components/marketing/product-preview"
import { TrustAccountingSection } from "@/components/marketing/trust-accounting-section"

/**
 * LA PAGE EST REGENEREE TOUTES LES 60 SECONDES.
 *
 * Sans cette ligne, elle etait produite UNE fois, au build (`revalidate: false`
 * dans le manifeste de pre-rendu) : un prix corrige depuis la console
 * n'apparaissait qu'au deploiement suivant, malgre le cache de 30 secondes de
 * `getCatalogue()`. Regeneree en arriere-plan, elle reste servie depuis le
 * cache — aussi rapide qu'une page statique — et suit le catalogue a une
 * minute pres.
 *
 * Next exige ici un nombre LITTERAL, lu a la compilation : ni constante
 * importee, ni re-export. La racine `(marketing)/page.tsx` porte donc sa
 * propre copie de cette valeur.
 */
export const revalidate = 60

/**
 * L'ADRESSE CANONIQUE DE CETTE PAGE EST LA RACINE.
 *
 * Depuis que `/` sert la page publique, la même page répond à deux adresses :
 * `/fr` et `/fr/landing`. Pour un moteur de recherche, ce sont deux pages au
 * contenu identique — du contenu dupliqué, qui divise le référencement entre
 * les deux et laisse la machine choisir laquelle montrer.
 *
 * Cette balise tranche : la racine est l'adresse officielle. `/fr/landing`
 * continue de répondre — elle est dans le plan de site et dans des courriels
 * déjà partis — mais elle déclare elle-même qui elle duplique.
 *
 * Rien de tel n'est déclaré sur la racine : elle EST la canonique.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return { alternates: { canonical: `/${locale}` } }
}

/**
 * LA PAGE PUBLIQUE.
 *
 * ─── POURQUOI ELLE N'EST PLUS UN SEUL COMPOSANT CLIENT ─────────────────────
 *
 * Elle l'était : `landing-client.tsx`, 1 115 lignes, `"use client"` en tête,
 * et un objet de traductions de quatre-vingts champs assemblé à la main ici
 * pour lui être passé en une prop unique. Trois conséquences mesurables :
 *
 * · Ajouter une ligne de texte demandait quatre modifications — `fr.json`,
 *   `en.json`, la table de correspondance de cette page, et l'interface
 *   `LandingClientProps`. Le coût a fini par être payé en nature : environ
 *   cent chaînes ont été écrites directement en français dans le composant,
 *   et la page anglaise les affichait en français.
 * · Toute la page était envoyée au navigateur comme du JavaScript, alors que
 *   deux blocs seulement sont interactifs : le sélecteur de modules de la
 *   maquette, et l'accordéon de questions.
 * · Un fichier de 1 115 lignes dépasse le plafond de 800 fixé par le
 *   CLAUDE.md, et personne ne pouvait modifier une section sans lire le tout.
 *
 * Chaque section lit maintenant ses propres traductions. Les composants
 * serveur n'envoient aucun JavaScript ; `MarketingNav`, `ProductPreview`,
 * `VideoPresentation` et `FaqSection` sont les seuls à en envoyer, parce
 * qu'ils sont les seuls à réagir à un clic.
 *
 * ─── L'ORDRE DES SECTIONS, ET LES DEUX TEINTES DE FOND ─────────────────────
 *
 * L'ancienne page changeait de fond à chaque section — blanc, gris, blanc,
 * gris — ce que l'œil lit comme des rayures. Ici, deux teintes seulement, et
 * elles GROUPENT : la maquette et les modules reposent sur le canevas gris,
 * tout le reste sur le blanc, et la bande sombre finale ferme la page. Deux
 * sections blanches qui se suivent sont séparées par un filet d'un pixel,
 * jamais par un changement de teinte.
 */
export default async function LandingPage() {
  return (
    <div className="flex w-full flex-col bg-card">
      <MarketingNav />
      <Hero />
      <ProductPreview />
      <AssuranceBand />
      <TrustAccountingSection />
      <FeaturesSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
      <MarketingFooter />
    </div>
  )
}
