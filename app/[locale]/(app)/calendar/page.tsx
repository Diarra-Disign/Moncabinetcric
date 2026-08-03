import { CalendarClient } from "./calendar-client"
import { getEvents, getClients, getMatters } from "@/lib/data"

export default async function CalendarPage() {
  // Les clients et dossiers alimentent la liste déroulante du formulaire
  // d'invitation, qui contenait jusqu'ici quatre clients fictifs écrits en
  // dur — impossibles à choisir pour un vrai rendez-vous.
  const [events, clients, matters] = await Promise.all([
    getEvents(),
    getClients(),
    getMatters(),
  ])

  return <CalendarClient initialEvents={events} clients={clients} matters={matters} />
}
