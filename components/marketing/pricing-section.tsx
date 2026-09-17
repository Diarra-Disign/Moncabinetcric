import { getLocale, getTranslations } from "next-intl/server"
import { Check } from "lucide-react"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { getCatalogue } from "@/lib/billing/catalogue"
import { formatMontant, tarifPublic, type Plan, type TarifPublic } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"
import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section"

/**
 * La tarification.
 *
 * LA LECTURE DU CATALOGUE A ETE RAPATRIEE ICI, depuis `landing/page.tsx`. La
 * page assemblait a la main un objet de quatre-vingts champs pour le passer en
 * une seule prop au composant client : ajouter une ligne de texte demandait
 * quatre modifications (fr.json, en.json, la table de correspondance, et
 * l'interface TypeScript). Chaque section lit maintenant ses propres
 * traductions, et celle-ci lit ses propres prix.
 *
 * Les commentaires d'origine sont conserves : ils documentent des incidents
 * reels, pas des intentions.
 *
 * ─── CE QUI CHANGE VISUELLEMENT ───────────────────────────────────────────
 *
 * La carte recommandee portait `border-2 border-blue-600`, une `shadow-md`,
 * un halo `ring-4 ring-blue-500/5` ET un decalage `md:-translate-y-2`. Quatre
 * signaux pour dire une chose, et le decalage cassait l'alignement des trois
 * cartes — les prix ne se lisaient plus sur une meme ligne. Il reste une
 * bordure teintee, une elevation, la pastille, et le seul bouton plein des
 * trois. Les trois cartes reposent sur la meme ligne de base.
 */
export async function PricingSection() {
  const t = await getTranslations("Landing.pricing")
  const locale = await getLocale()

  // Le catalogue vient de la base : un prix corrige depuis la console apparait
  // ici sans deploiement — la page est regeneree toutes les 60 secondes, voir
  // `revalidate` dans `landing/page.tsx`.
  //
  // UN FORFAIT SANS TARIF PUBLIC N'AFFICHE AUCUN MONTANT. Le repli precedent
  // fabriquait un forfait vide et la grille annoncait « 0 $ par mois » des que
  // le catalogue ne repondait pas. La carte dit desormais que le tarif est
  // presente lors de la demonstration, et l'incident est journalise.
  const catalogue = await lireCatalogue()
  const tarif = (cle: string) => tarifPublic(catalogue.find((p) => p.key === cle))

  // Les montants viennent du catalogue, jamais du fichier de traduction.
  // Deux tarifs publics contradictoires — l'un dans le code, l'autre dans les
  // traductions — ont deja coexiste sur cette page. Un prix qu'on peut ecrire
  // a deux endroits finit toujours par y differer, et c'est le client qui
  // decouvre lequel est facture.
  const prix = (cents: number) => formatMontant(cents, locale)
  const chiffrage = (tarif: TarifPublic | null) =>
    tarif
      ? { mensuel: prix(tarif.mensuel), annuel: t("annualNote", { price: prix(tarif.annuel) }) }
      : null

  const solo = tarif("solo")
  const cabinet = tarif("cabinet")
  const business = tarif("business")

  const sansTarif = Object.entries({ solo, cabinet, business })
    .filter(([, valeur]) => valeur === null)
    .map(([cle]) => cle)
  if (sansTarif.length > 0) {
    console.error(
      `[landing/tarifs] Aucun tarif public pour : ${sansTarif.join(", ")}. Cartes affichees sans montant.`,
    )
  }

  const forfaits = [
    {
      cle: "solo",
      nom: t("solo.name"),
      description: t("solo.desc"),
      montants: chiffrage(solo),
      entete: t("includedLabel"),
      // La gestion du fideicommis n'apparaissait nulle part sur la page
      // publique alors que le module est livre a TOUS les forfaits. Elle est
      // annoncee dans le forfait d'entree, et les autres cartes en heritent
      // par leur « … plus : ».
      avantages: [t("solo.f1"), t("solo.f2"), t("solo.f3"), t("solo.f4"), t("solo.f5")],
      action: t("solo.btn"),
      recommande: false,
    },
    {
      cle: "cabinet",
      nom: t("cabinet.name"),
      description: t("cabinet.desc"),
      montants: chiffrage(cabinet),
      entete: t("plusProLabel"),
      avantages: [
        cabinet?.placeSupplementaire
          ? t("cabinet.f1", { price: prix(cabinet.placeSupplementaire) })
          : t("cabinet.f1NoPrice"),
        t("cabinet.f2"),
        t("cabinet.f3"),
        t("cabinet.f4"),
      ],
      action: t("cabinet.btn"),
      recommande: true,
    },
    {
      // Ses fonctions sont EXACTEMENT celles de Cabinet Pro — verifie dans
      // plan_features. L'ecart est economique : huit places au lieu de trois,
      // et des places moins cheres. La carte ne promet donc aucune fonction
      // supplementaire, parce qu'il n'y en a aucune.
      cle: "business",
      nom: t("business.name"),
      description: t("business.desc"),
      montants: chiffrage(business),
      entete: t("plusBusinessLabel"),
      avantages: [
        t("business.f1"),
        business?.placeSupplementaire
          ? t("business.f2", { price: prix(business.placeSupplementaire) })
          : t("business.f2NoPrice"),
        t("business.f3"),
        t("business.f4"),
      ],
      action: t("business.btn"),
      recommande: false,
    },
  ]

  return (
    <Section id="pricing" fond="carte">
      <Reveal>
        <SectionHeading eyebrow={t("badge")} title={t("title")} lead={t("subtitle")} />
      </Reveal>

      <Reveal className="mt-14 sm:mt-16">
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {forfaits.map((forfait) => (
            <div
              key={forfait.cle}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-6 sm:p-7",
                forfait.recommande
                  ? "border-primary shadow-elev-2"
                  : "border-border shadow-elev-1",
              )}
            >
              {forfait.recommande ? (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                  {t("cabinet.badge")}
                </span>
              ) : null}

              <h3 className="text-base font-semibold tracking-tight text-foreground">{forfait.nom}</h3>
              {/* `min-h-8` remplace `min-h-[32px]` : meme valeur, sur l'echelle
                  d'espacement, donc sans valeur arbitraire. Elle aligne les
                  prix des trois cartes quand une description tient sur deux
                  lignes et les autres sur une. */}
              <p className="mt-1.5 min-h-8 text-sm leading-relaxed text-muted-foreground">
                {forfait.description}
              </p>

              {forfait.montants ? (
                <>
                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "text-3xl font-semibold tabular-nums tracking-tight",
                        forfait.recommande ? "text-primary" : "text-foreground",
                      )}
                    >
                      {forfait.montants.mensuel}
                    </span>
                    <span className="text-sm text-muted-foreground">{t("period")}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-success-strong">
                    {forfait.montants.annuel}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-6 text-xl font-semibold tracking-tight text-foreground">
                    {t("onRequest")}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{t("onRequestNote")}</p>
                </>
              )}

              <p className="mt-7 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {forfait.entete}
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-3">
                {forfait.avantages.map((avantage) => (
                  <li key={avantage} className="flex items-start gap-2.5 text-sm text-foreground">
                    {/* Une seule couleur de coche pour les trois cartes. L'une
                        les avait en bleu, les deux autres en vert, sans que
                        rien ne distingue les deux cas. */}
                    <Check className="mt-0.5 size-4 shrink-0 text-success-strong" />
                    <span className="leading-relaxed">{avantage}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="lg"
                variant={forfait.recommande ? "default" : "outline"}
                className="mt-8 w-full"
              >
                <Link href="/demo">{forfait.action}</Link>
              </Button>
            </div>
          ))}
        </div>
      </Reveal>

      <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-relaxed text-muted-foreground">
        {t("taxNote")}
      </p>
    </Section>
  )
}

/**
 * Lit le catalogue sans jamais faire tomber la page publique.
 *
 * `getCatalogue()` leve une exception quand la configuration Supabase est
 * incomplete. Sans ce garde-fou, c'est TOUTE la page de vente qui passait en
 * erreur — heros, maquette et foire aux questions compris — pour une grille
 * de prix illisible. La grille s'affiche alors sans montants, et l'incident est
 * journalise cote serveur.
 */
async function lireCatalogue(): Promise<Plan[]> {
  try {
    return await getCatalogue()
  } catch (erreur) {
    console.error("[landing/tarifs] Lecture du catalogue impossible.", erreur)
    return []
  }
}
