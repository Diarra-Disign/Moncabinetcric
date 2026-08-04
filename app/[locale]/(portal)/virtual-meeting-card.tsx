"use client"

import * as React from "react"
import { Video, Calendar, Clock, ExternalLink, Sparkles, CheckCircle2, UserCheck, ShieldCheck, Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface VirtualMeetingCardProps {
  calendlyUrl?: string
  /** Titulaire du cabinet, lu en base par la page. Vide si indisponible. */
  consultantName?: string
}

export function VirtualMeetingCard({ calendlyUrl = "", consultantName = "" }: VirtualMeetingCardProps) {
  // Ce bloc décrivait un rendez-vous entièrement fictif — date, motif et
  // lien — affiché à tout client ouvrant le portail. Vidé : la carte
  // n'annonce plus une rencontre qui n'existe pas.
  const [meetingState] = React.useState({
    status: "none",
    reason: "",
    date: "",
    time: "",
    link: "",
  })

  const hasMeeting = meetingState.status === "scheduled" && meetingState.link !== ""

  if (!hasMeeting) {
    return (
      <Card className="border-slate-200 bg-slate-50/60 rounded-3xl">
        <CardContent className="p-7 sm:p-8 text-center">
          <Video className="w-7 h-7 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-black text-slate-800">
            Aucune rencontre planifiée
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Votre consultant vous transmettra un lien lorsqu&apos;un rendez-vous sera fixé.
          </p>
          {calendlyUrl && (
            <Button
              variant="outline"
              onClick={() => window.open(calendlyUrl, "_blank")}
              className="mt-5 gap-2 text-xs font-bold border-slate-300 text-slate-800 bg-white hover:bg-slate-100 rounded-2xl px-6 py-3"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Demander un créneau</span>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/70 shadow-md rounded-3xl overflow-hidden">
      <CardContent className="p-7 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          {/* LEFT DETAILS */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2.5">
              <Badge className="bg-blue-600 text-white font-bold text-xs uppercase tracking-wider px-3 py-1">
                <Video className="w-3.5 h-3.5 mr-1.5" /> Visioconférence CICC
              </Badge>
              <Badge variant="success" className="text-xs font-bold px-3 py-1">
                Confirmé via Calendly ✓
              </Badge>
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {/* Le titulaire était nommé en dur, avec le titre « Me » qui
                    est celui d'un avocat. Il vient maintenant du cabinet. */}
                {consultantName
                  ? `Prochaine rencontre virtuelle avec ${consultantName}`
                  : "Prochaine rencontre virtuelle"}
              </h3>
              <p className="text-sm font-extrabold text-blue-700 mt-1">
                Motif d&apos;entrevue : {meetingState.reason}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 text-sm font-semibold text-slate-700 pt-1">
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs font-mono font-bold text-slate-900 text-sm">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>{meetingState.date}</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-2xs font-mono font-bold text-slate-900 text-sm">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>{meetingState.time}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs sm:text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Consultant réglementé CICC</span>
              </div>
            </div>
          </div>

          {/* RIGHT ACTIONS */}
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch gap-3 shrink-0">
            <a
              href={meetingState.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-7 py-3.5 text-xs sm:text-sm font-black shadow-lg shadow-blue-600/25 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Globe className="w-4 h-4" />
              <span>Ouvrir sur Calendly</span>
              <ExternalLink className="w-4 h-4 opacity-80" />
            </a>

            <Button
              variant="outline"
              onClick={() => window.open(calendlyUrl, "_blank")}
              className="gap-2 text-xs sm:text-sm font-bold border-slate-300 text-slate-800 bg-white hover:bg-slate-100 rounded-2xl px-6 py-3.5"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Reprogrammer un créneau</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
