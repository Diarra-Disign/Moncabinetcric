import { notFound } from "next/navigation"
import { setRequestLocale } from "next-intl/server"
import { getCabinetPublic, getCreneaux } from "@/lib/data/reservation"
import { ReservationClient } from "./reservation-client"

export const dynamic = "force-dynamic"

/**
 * La page publique de réservation d'un cabinet.
 *
 * ─── AUCUNE SESSION, ET AUCUNE FUITE ───────────────────────────────────────
 *
 * Le visiteur est un inconnu. Tout ce que cette page reçoit passe par trois
 * fonctions `security definer` étroites : le nom du cabinet, ses plages, et les
 * INSTANTS occupés — jamais un nom de client, jamais un motif de rendez-vous.
 * Pour un consultant réglementé, le simple fait qu'une personne soit sa cliente
 * est confidentiel.
 *
 * Le calcul des créneaux se fait au serveur. Le faire au navigateur aurait
 * obligé à lui transmettre les instants occupés — donc à dévoiler le rythme de
 * travail du cabinet et, à qui sait compter, son volume d'affaires.
 *
 * `force-dynamic` : un créneau pris il y a trente secondes ne doit pas
 * réapparaître libre dans une page mise en cache.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const cabinet = await getCabinetPublic(slug)
  if (!cabinet) return { title: "Page introuvable" }
  return {
    title: `Prendre rendez-vous — ${cabinet.nom}`,
    description: `Choisissez un créneau de consultation avec ${cabinet.nom}.`,
    // Pas d'indexation : cette page est faite pour être partagée par le
    // cabinet, non trouvée par un moteur de recherche.
    robots: { index: false, follow: false },
  }
}

export default async function PageReservation({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const cabinet = await getCabinetPublic(slug)
  // `notFound()` plutôt qu'un message : un cabinet qui a fermé sa page ne doit
  // pas voir l'existence de son compte confirmée à un visiteur au hasard.
  if (!cabinet) notFound()

  const creneaux = await getCreneaux(slug)

  return (
    <ReservationClient
      slug={slug}
      nomCabinet={cabinet.nom}
      logoUrl={cabinet.logoUrl}
      dureeMinutes={cabinet.dureeMinutes}
      aUneSalle={Boolean(cabinet.salle)}
      creneaux={creneaux.map((c) => ({ iso: c.debut.toISOString(), local: c.debutLocal }))}
    />
  )
}
