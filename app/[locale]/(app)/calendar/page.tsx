import { CalendarClient } from "./calendar-client"
import { getEvents, getClients, getMatters, getLeads } from "@/lib/data"

export default async function CalendarPage() {
  // Les clients et dossiers alimentent la liste déroulante du formulaire
  // d'invitation, qui contenait jusqu'ici quatre clients fictifs écrits en
  // dur — impossibles à choisir pour un vrai rendez-vous.
  // Les prospects figurent aussi dans la liste : on rencontre quelqu'un
  // avant de le convertir en client, et c'est même l'objet de la
  // consultation initiale.
  const [events, clients, matters, leads] = await Promise.all([
    getEvents(),
    getClients(),
    getMatters(),
    getLeads(),
  ])

  return (
    <CalendarClient
      initialEvents={events}
      clients={clients}
      matters={matters}
      leads={leads}
    />
  )
}
