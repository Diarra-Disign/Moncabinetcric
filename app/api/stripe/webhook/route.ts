import { NextResponse } from "next/server"
import type Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { stripe, stripeConfigure } from "@/lib/billing/stripe"

/**
 * Réception des événements Stripe.
 *
 * Route non localisée, comme le prévoient les conventions du projet pour les
 * webhooks : Stripe n'a pas de langue et ne doit pas traverser next-intl.
 *
 * Trois principes tiennent cette route :
 *
 *   1. Rien n'est cru sans signature. Le corps est lu brut et vérifié contre
 *      STRIPE_WEBHOOK_SECRET. Sans cela, l'adresse serait publiquement
 *      appelable et n'importe qui pourrait s'y déclarer abonné — c'est-à-dire
 *      s'ouvrir l'accès à l'application.
 *
 *   2. Le cabinet vient de la métadonnée posée à la création du client Stripe,
 *      jamais d'un paramètre. Un événement qui ne désigne aucun cabinet connu
 *      est ignoré, pas deviné.
 *
 *   3. Chaque événement n'est traité qu'une fois. Stripe réémet tant qu'il n'a
 *      pas reçu de 200, et peut livrer deux fois même ensuite. Sans la table
 *      stripe_events, un renvoi de « paiement échoué » repousserait le délai
 *      de grâce à chaque livraison : un cabinet qui ne paie plus resterait
 *      ouvert indéfiniment.
 */

export const runtime = "nodejs"
// La signature porte sur les octets exacts reçus : toute mise en cache ou
// re-sérialisation la ferait échouer.
export const dynamic = "force-dynamic"

/** Jours laissés à un cabinet pour régulariser après un échec de prélèvement. */
const JOURS_DE_GRACE = 10

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(request: Request) {
  if (!stripeConfigure() || !process.env.STRIPE_WEBHOOK_SECRET) {
    // 503 et non 400 : le problème est ici, pas dans ce que Stripe a envoyé.
    // Un 400 lui ferait abandonner l'événement ; un 503 le fait réessayer,
    // et l'abonnement se rattrape tout seul une fois la clé posée.
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Signature absente." }, { status: 400 })
  }

  const brut = await request.text()

  let evenement: Stripe.Event
  try {
    evenement = await stripe().webhooks.constructEventAsync(
      brut,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch {
    // Le message d'erreur de Stripe n'est pas répercuté : il distingue
    // « signature invalide » de « horodatage périmé », ce qui aiderait à
    // forger une requête plutôt qu'à diagnostiquer un problème réel.
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 })
  }

  const supabase = serviceClient()

  // L'insertion fait office de verrou : la clé primaire refuse le doublon, et
  // le refus se produit AVANT tout traitement. Deux livraisons simultanées du
  // même événement ne peuvent donc pas s'exécuter toutes les deux.
  const { error: dejaVu } = await supabase
    .from("stripe_events")
    .insert({ id: evenement.id, type: evenement.type })

  if (dejaVu) {
    if (dejaVu.code === "23505") return NextResponse.json({ received: true, duplicate: true })
    return NextResponse.json({ error: "Journalisation impossible." }, { status: 500 })
  }

  try {
    await traiter(evenement, supabase)
  } catch (e) {
    // La trace d'idempotence est retirée pour que la réémission de Stripe ait
    // une chance d'aboutir. La garder ferait d'un incident passager une
    // divergence définitive entre Stripe et cette base.
    await supabase.from("stripe_events").delete().eq("id", evenement.id)
    console.error("[stripe] échec du traitement", evenement.type, e)
    return NextResponse.json({ error: "Traitement impossible." }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

type Service = ReturnType<typeof serviceClient>

async function traiter(evenement: Stripe.Event, supabase: Service) {
  switch (evenement.type) {
    case "checkout.session.completed": {
      const session = evenement.data.object as Stripe.Checkout.Session
      if (!session.subscription) return
      const abonnement = await stripe().subscriptions.retrieve(String(session.subscription), {
        expand: ["default_payment_method"],
      })
      await synchroniser(abonnement, supabase)
      return
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      // Rechargé plutôt que pris tel quel : la charge utile de l'événement ne
      // porte pas le moyen de paiement développé, et l'écran d'abonnement en
      // a besoin pour dire « carte •••• 4242 » ou « prélèvement bancaire ».
      const brut = evenement.data.object as Stripe.Subscription
      const abonnement = await stripe().subscriptions.retrieve(brut.id, {
        expand: ["default_payment_method"],
      })
      await synchroniser(abonnement, supabase)
      return
    }

    case "invoice.payment_failed": {
      const facture = evenement.data.object as Stripe.Invoice
      const firmId = await cabinetDeLaFacture(facture, supabase)
      if (!firmId) return

      // Le délai de grâce n'est posé que s'il n'y en a pas déjà un en cours :
      // Stripe relance une facture impayée plusieurs fois, et chaque échec
      // rallongerait sinon le sursis au lieu de l'épuiser.
      const { data: existant } = await supabase
        .from("firm_subscriptions")
        .select("grace_until")
        .eq("firm_id", firmId)
        .maybeSingle()

      const enCours =
        existant?.grace_until && new Date(existant.grace_until as string) > new Date()

      await supabase
        .from("firm_subscriptions")
        .update({
          grace_until: enCours
            ? existant!.grace_until
            : new Date(Date.now() + JOURS_DE_GRACE * 86400000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("firm_id", firmId)
      return
    }

    case "invoice.payment_succeeded": {
      const facture = evenement.data.object as Stripe.Invoice
      const firmId = await cabinetDeLaFacture(facture, supabase)
      if (!firmId) return

      await supabase
        .from("firm_subscriptions")
        .update({ grace_until: null, updated_at: new Date().toISOString() })
        .eq("firm_id", firmId)
      return
    }

    default:
      // Les autres événements sont acceptés sans être traités : renvoyer une
      // erreur ferait réessayer Stripe indéfiniment pour rien.
      return
  }
}

/**
 * Reporte en base l'état d'un abonnement Stripe.
 *
 * Stripe fait foi de bout en bout. Rien n'est recalculé ici — ni le statut,
 * ni les places, ni la période payée — parce que deux systèmes qui calculent
 * chacun la vérité finissent toujours par en avoir deux.
 */
async function synchroniser(abonnement: Stripe.Subscription, supabase: Service) {
  const firmId = await cabinetDeLAbonnement(abonnement, supabase)
  if (!firmId) {
    console.warn("[stripe] abonnement sans cabinet identifiable", abonnement.id)
    return
  }

  const moyen = moyenDePaiement(abonnement)
  const statut = abonnement.status

  const plan = await planDeLAbonnement(abonnement, supabase)
  if (!plan) {
    // Un forfait que le catalogue ne connaît pas ne s'invente pas. L'ancien
    // code repliait tout sur « solo » : un cabinet qui souscrivait Cabinet
    // Business à 169 $ était enregistré à 49 $, plafonné à une place, et rien
    // ne le signalait — ni au cabinet, ni ici.
    console.warn("[stripe] forfait inconnu du catalogue", abonnement.id, abonnement.metadata?.plan)
    return
  }

  await supabase.from("firm_subscriptions").upsert(
    {
      firm_id: firmId,
      stripe_customer_id: String(abonnement.customer),
      stripe_subscription_id: abonnement.id,
      plan,
      cadence: cadenceDeLAbonnement(abonnement),
      seats: await placesDeLAbonnement(abonnement, plan, supabase),
      status: statut,
      current_period_end: finDePeriode(abonnement),
      cancel_at_period_end: Boolean(abonnement.cancel_at_period_end),
      // Un abonnement redevenu sain n'a plus de sursis à courir.
      ...(statut === "active" || statut === "trialing" ? { grace_until: null } : {}),
      payment_method: moyen.type,
      payment_last4: moyen.last4,
      currency: abonnement.currency ?? "cad",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "firm_id" }
  )

  // Le plan du cabinet suit l'abonnement : c'est lui que lisent plan_limits,
  // donc le déclencheur des places et l'ouverture du connecteur.
  if (statut === "active" || statut === "trialing") {
    await supabase
      .from("firms")
      .update({
        plan,
        // L'essai accordé à la main n'a plus lieu d'être : il rouvrirait
        // l'accès d'un cabinet dont l'abonnement aurait été résilié.
        trial_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", firmId)
      // Un accès de courtoisie est une décision de l'exploitant : un paiement
      // ne doit pas la révoquer silencieusement.
      .neq("plan", "courtoisie")
  }
}

/** Le cabinet, depuis la métadonnée de l'abonnement puis celle du client. */
async function cabinetDeLAbonnement(
  abonnement: Stripe.Subscription,
  supabase: Service
): Promise<string | null> {
  const direct = abonnement.metadata?.firm_id
  if (direct) return direct

  const client = await stripe()
    .customers.retrieve(String(abonnement.customer))
    .catch(() => null)
  if (client && !("deleted" in client && client.deleted) && client.metadata?.firm_id) {
    return client.metadata.firm_id
  }

  // Dernier recours : la ligne posée avant la redirection vers le paiement.
  const { data } = await supabase
    .from("firm_subscriptions")
    .select("firm_id")
    .eq("stripe_customer_id", String(abonnement.customer))
    .maybeSingle()

  return (data?.firm_id as string) ?? null
}

async function cabinetDeLaFacture(facture: Stripe.Invoice, supabase: Service): Promise<string | null> {
  const { data } = await supabase
    .from("firm_subscriptions")
    .select("firm_id")
    .eq("stripe_customer_id", String(facture.customer))
    .maybeSingle()

  return (data?.firm_id as string) ?? null
}

/** Une ligne de places, par opposition à la ligne du forfait lui-même. */
function estLignePlace(item: Stripe.SubscriptionItem): boolean {
  return (item.price?.lookup_key ?? "").includes("_place")
}

/** La ligne du forfait. Reconnue à sa clé, jamais à sa position. */
function ligneDeBase(abonnement: Stripe.Subscription): Stripe.SubscriptionItem | undefined {
  return abonnement.items.data.find((i) => !estLignePlace(i)) ?? abonnement.items.data[0]
}

/**
 * Le forfait de cet abonnement, vérifié contre le catalogue.
 *
 * Deux sources, dans cet ordre : la métadonnée posée à la souscription, puis
 * la clé de recherche du tarif de base (`mcc_<forfait>_<cadence>`). Ni l'une
 * ni l'autre n'est crue sans confrontation à `plan_limits` — le catalogue
 * s'édite depuis la console, et un forfait retiré ne doit pas continuer à
 * s'écrire dans `firms.plan`, où une clé étrangère l'attend.
 *
 * Renvoie null plutôt qu'un forfait de repli. Un repli silencieux sur « solo »
 * facturait 169 $ pour les droits d'un forfait à 49 $.
 */
async function planDeLAbonnement(
  abonnement: Stripe.Subscription,
  supabase: Service
): Promise<string | null> {
  const candidats: string[] = []

  const declare = abonnement.metadata?.plan
  if (declare) candidats.push(declare)

  const cle = ligneDeBase(abonnement)?.price?.lookup_key ?? ""
  const trouve = /^mcc_(.+?)_(monthly|annual)/.exec(cle)
  if (trouve) candidats.push(trouve[1])

  const { data } = await supabase.from("plan_limits").select("plan")
  const connus = new Set((data ?? []).map((r) => r.plan as string))

  return candidats.find((c) => connus.has(c)) ?? null
}

function cadenceDeLAbonnement(abonnement: Stripe.Subscription): string {
  const interval = ligneDeBase(abonnement)?.price?.recurring?.interval
  return interval === "year" ? "annual" : "monthly"
}

/**
 * Places facturées : celles comprises au forfait, plus les lignes de places.
 *
 * Le nombre compris est lu dans `plan_limits`, et non codé en dur. Il l'était :
 * « 3 si cabinet, 1 sinon » — ce qui donnait 1 à Cabinet Business, qui en
 * comprend 8.
 *
 * Le filtre des lignes de places, lui, cherchait une clé se TERMINANT par
 * `_place`. Depuis la tarification par rôle, ces clés s'appellent
 * `mcc_cabinet_monthly_place_staff` : aucune ne correspondait plus. Le webhook
 * ramenait donc les places au seul nombre compris, à chaque événement
 * d'abonnement — défaisant la synchronisation qui venait de les ajuster.
 */
async function placesDeLAbonnement(
  abonnement: Stripe.Subscription,
  plan: string,
  supabase: Service
): Promise<number> {
  const { data } = await supabase
    .from("plan_limits")
    .select("seats_included")
    .eq("plan", plan)
    .maybeSingle()

  const comprises = (data?.seats_included as number | null) ?? 1
  const extras = abonnement.items.data
    .filter(estLignePlace)
    .reduce((total, i) => total + (i.quantity ?? 0), 0)

  return Math.max(1, comprises + extras)
}

/**
 * Fin de la période payée.
 *
 * Lue d'abord sur la ligne d'abonnement, où Stripe l'a déplacée dans les
 * versions récentes de l'API, puis sur l'abonnement lui-même pour les
 * versions antérieures. Purement informatif : cette date n'entre pas dans la
 * décision d'ouvrir l'accès, précisément pour qu'un webhook manqué ne ferme
 * pas des cabinets à jour de leurs paiements.
 */
function finDePeriode(abonnement: Stripe.Subscription): string | null {
  const item = abonnement.items.data[0] as unknown as { current_period_end?: number }
  const legacy = abonnement as unknown as { current_period_end?: number }
  const secondes = item?.current_period_end ?? legacy.current_period_end
  return secondes ? new Date(secondes * 1000).toISOString() : null
}

/** Type de moyen de paiement et quatre derniers chiffres, s'ils sont donnés. */
function moyenDePaiement(abonnement: Stripe.Subscription): {
  type: string | null
  last4: string | null
} {
  const moyen = abonnement.default_payment_method
  if (!moyen || typeof moyen === "string") return { type: null, last4: null }

  if (moyen.type === "card") return { type: "card", last4: moyen.card?.last4 ?? null }
  // Tout autre type est enregistré sans ses quatre derniers chiffres : la
  // souscription se fait par carte, et un moyen arrivé autrement — ajouté
  // depuis le portail Stripe, par exemple — doit être CONSIGNÉ plutôt
  // qu'ignoré. Un abonnement dont le moyen de paiement s'afficherait vide
  // serait pris pour un abonnement sans moyen de paiement.
  return { type: moyen.type, last4: null }
}
