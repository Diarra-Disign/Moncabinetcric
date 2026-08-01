import { CalendarClient } from "./calendar-client"
import { getEvents } from "@/lib/data"

export default async function CalendarPage() {
  const events = await getEvents()
  return <CalendarClient initialEvents={events} />
}
