"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import { abonnementActifStripe, changerForfait, clientStripe, sessionPaiement, sessionPortail, stripeConfigure } from "@/lib/billing/stripe"
import { calculerLignesPlaces } from "@/lib/billing/seat-sync"
import { type Cadence } from "@/lib/billing/plans"
import { getPlan } from "@/lib/billing/catalogue"
import { exigerPermission } from "@/lib/auth/permissions"
import { siteUrl } from "@/lib/site-url"
import { messageErreur } from "@/lib/data/erreurs"

/**
 * Souscription et gestion de l'abonnement, côté cabinet.
 *
 * Deux invariants qui ne se négocient pas :
 *
 *   · Le cabinet vient TOUJOURS de la session, jamais du formulaire. Sans
 *     cela, un propriétaire pourrait ouvrir un paiement au nom d'un autre
 *     cabinet — ou pire, en résilier l'abonnement.
 *
 *   · L'écriture en base se limite à l'identifiant du client Stripe. Le
 *     statut, les places facturées et la période payée ne s'écrivent que
 *     depuis le webhook, à partir de ce que Stripe affirme. Une action de
 *     serveur qui pourrait écrire « active » serait un bouton « je me
 *     déclare payé ».
 */

export interface ResultatPaiement {
  ok: boolean
  message: string
  /** Adresse de la page hébergée par Stripe, vers laquelle rediriger. */
  url?: string
}

/**
 * Client à clé de service, pour la seule écriture de l'identifiant Stripe.
 *
 * `firm_subscriptions` n'accorde aucune politique d'écriture à un compte
 * authentifié, délibérément. Le cabinet visé reste celui de la session.
 */
function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Origine des adresses de retour données à Stripe.
 *
 * Délègue à siteUrl(), qui enlève les espaces. Ce détail décide de tout ici :
 * Stripe REFUSE une session de paiement dont l'URL de succès est invalide, et
 * une adresse portant un retour à la ligne l'est. Le paiement échouait donc
 * avant même de s'ouvrir, sur un message qui ne parle pas d'APP_URL.
 */
function baseUrl(): string {
  return siteUrl()
}

async function exigerProprietaire() {
  // Le nom reste, la règle change : ce n'est plus le rôle « owner » qui
  // ouvre, mais une permission nommée. Un cabinet peut donc la déléguer
  // sans distribuer le reste des droits du propriétaire.
  return exigerPermission("firm.billing")
}

/**
 * Ouvre la page de paiement Stripe pour le plan demandé.
 *
 * Le nombre de places n'est pas laissé au choix : il vaut au moins ce que le
 * cabinet occupe déjà. Souscrire un plan à une place alors que trois comptes
 * existent produirait un cabinet payant et immédiatement en infraction avec
 * sa propre limite, sans qu'aucun écran ne l'explique.
 */
export async function ouvrirPaiement(formData: FormData): Promise<ResultatPaiement> {
  try {
    if (!stripeConfigure()) {
      return {
        ok: false,
        message:
          "Le paiement n'est pas encore configuré sur cette installation (STRIPE_SECRET_KEY manquante).",
      }
    }

    const membre = await exigerProprietaire()
    const cle = String(formData.get("plan") ?? "")
    const cadence: Cadence = String(formData.get("cadence") ?? "monthly") === "annual" ? "annual" : "monthly"
    const langue = String(formData.get("langue") ?? "fr") === "en" ? "en" : "fr"

    // Le forfait vient du catalogue en base, jamais d'une liste figée dans le
    // code : c'est ce qui permet d'en ajouter un depuis la console sans
    // déploiement. Et `purchasable` est vérifié ICI, côté serveur — l'essai,
    // la courtoisie et l'entreprise ne doivent jamais entrer dans un tunnel de
    // paiement, quel que soit ce que le formulaire affirme.
    const plan = await getPlan(cle)
    if (!plan) return { ok: false, message: "Forfait inconnu." }
    if (!plan.purchasable) {
      return {
        ok: false,
        message: `Le forfait « ${plan.labelFr} » ne se souscrit pas en ligne. Écrivez-nous pour en convenir.`,
      }
    }

    const supabase = serviceClient()

    const [{ data: cabinet }, { data: abonnement }, { data: occupees }] = await Promise.all([
      supabase.from("firms").select("name, email").eq("id", membre.firmId).maybeSingle(),
      supabase
        .from("firm_subscriptions")
        .select("id, stripe_customer_id")
        .eq("firm_id", membre.firmId)
        .maybeSingle(),
      supabase.rpc("firm_seats_taken", { f_id: membre.firmId }),
    ])

    const places = Math.max(plan.seatsIncluded, Number(occupees ?? 1))
    if (plan.maxSeats !== null && places > plan.maxSeats) {
      return {
        ok: false,
        message:
          `Le forfait « ${plan.labelFr} » n'admet que ${plan.maxSeats} place(s) et le cabinet en occupe ${places}. ` +
          `Choisissez un forfait supérieur, ou suspendez des membres et révoquez les invitations en attente.`,
      }
    }

    const customerId = await clientStripe({
      firmId: membre.firmId,
      nom: (cabinet?.name as string) ?? membre.firmName,
      courriel: (cabinet?.email as string) ?? membre.email,
      existant: (abonnement?.stripe_customer_id as string | null) ?? null,
    })

    // Consigné avant la redirection : si le cabinet abandonne puis recommence,
    // il retrouve le même client Stripe, donc le même historique de factures.
    //
    // SEUL l'identifiant Stripe s'écrit sur une ligne existante. Le forfait, la
    // cadence et les places n'y sont posés qu'à la CRÉATION, où le statut vaut
    // « incomplete » et n'ouvre donc aucun droit. Les écrire sur une ligne
    // existante revenait à changer de forfait avant tout paiement : un cabinet
    // actif sur Cabinet Pro qui cliquait sur Solo était rétrogradé sur-le-champ
    // par firm_effective_plan(), même si Stripe refusait ensuite l'opération.
    if (abonnement?.id) {
      await supabase
        .from("firm_subscriptions")
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq("firm_id", membre.firmId)
    } else {
      await supabase.from("firm_subscriptions").insert({
        firm_id: membre.firmId,
        stripe_customer_id: customerId,
        plan: plan.key,
        cadence,
        seats: places,
      })
    }

    // ---- Changement de forfait ----
    // Si le client a déjà un abonnement Stripe actif ou en essai, on modifie
    // ses lignes de facturation plutôt que de créer une session Checkout.
    // Stripe refuse de créer un second abonnement pour le même client.
    const subExistant = await abonnementActifStripe(customerId)
    if (subExistant) {
      // Les places du NOUVEAU forfait sont calculées avant l'appel, pour que
      // le changement de forfait et le réajustement des places tiennent dans
      // une seule écriture chez Stripe — donc une seule proratisation.
      const { lignes, occupees } = await calculerLignesPlaces({
        firmId: membre.firmId,
        plan,
        cadence,
      })

      const modifie = await changerForfait({
        subscriptionId: subExistant.id,
        plan,
        cadence,
        firmId: membre.firmId,
        lignesPlaces: lignes,
      })

      // Ce qui s'écrit ici vient de la RÉPONSE de Stripe, pas du formulaire.
      // Le webhook réécrira la même chose dans la seconde qui suit ; cette
      // écriture existe pour que l'écran dise la vérité tout de suite, y
      // compris sur une installation où le webhook n'est pas branché.
      await supabase
        .from("firm_subscriptions")
        .update({
          plan: modifie.metadata?.plan ?? plan.key,
          cadence: modifie.items.data[0]?.price?.recurring?.interval === "year" ? "annual" : "monthly",
          // Même grandeur que le webhook et la synchronisation : la capacité
          // payée, pas l'effectif seul.
          seats: Math.max(occupees, plan.seatsIncluded, 1),
          status: modifie.status,
          updated_at: new Date().toISOString(),
        })
        .eq("firm_id", membre.firmId)

      revalidatePath("/[locale]/settings/subscription", "page")

      return {
        ok: true,
        message: `Forfait modifié : ${plan.labelFr}. Stripe a calculé le crédit et le complément au prorata ; le détail figure sur votre prochaine facture.`,
      }
    }

    // ---- Première souscription ----
    const url = await sessionPaiement({
      customerId,
      plan,
      cadence,
      places,
      firmId: membre.firmId,
      retourOk: `${baseUrl()}/${langue}/settings/subscription?paiement=ok`,
      retourAnnule: `${baseUrl()}/${langue}/settings/subscription?paiement=annule`,
      langue,
    })

    return { ok: true, message: "Redirection vers le paiement sécurisé.", url }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Ouvre le portail Stripe : moyen de paiement, factures, résiliation.
 *
 * C'est ce qui permet au cabinet de passer de la carte au prélèvement
 * bancaire, ou de remplacer une carte expirée, sans qu'aucune coordonnée
 * bancaire ne transite par cette application.
 */
export async function ouvrirPortail(formData: FormData): Promise<ResultatPaiement> {
  try {
    if (!stripeConfigure()) {
      return { ok: false, message: "Le paiement n'est pas encore configuré sur cette installation." }
    }

    const membre = await exigerProprietaire()
    const langue = String(formData.get("langue") ?? "fr") === "en" ? "en" : "fr"

    const { data } = await serviceClient()
      .from("firm_subscriptions")
      .select("stripe_customer_id")
      .eq("firm_id", membre.firmId)
      .maybeSingle()

    const customerId = data?.stripe_customer_id as string | undefined
    if (!customerId) {
      return { ok: false, message: "Aucun abonnement à gérer : souscrivez d'abord un plan." }
    }

    const url = await sessionPortail({
      customerId,
      retour: `${baseUrl()}/${langue}/settings/subscription`,
      langue,
    })

    return { ok: true, message: "Redirection vers le portail de facturation.", url }
  } catch (e) {
    const brut = e instanceof Error ? e.message : ""
    // Stripe exige qu'une configuration de portail ait été enregistrée une
    // fois dans le tableau de bord. Son message parle de « configuration »
    // sans dire laquelle : traduit ici, parce que la personne qui lit cet
    // écran est un cabinet, pas l'exploitant de la plateforme.
    if (brut.includes("configuration")) {
      return {
        ok: false,
        message:
          "Le portail de facturation n'est pas encore ouvert. Écrivez-nous : nous vous transmettons vos factures et modifions votre moyen de paiement dans l'intervalle.",
      }
    }
    return { ok: false, message: messageErreur(e) }
  }
}
