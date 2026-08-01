"use client"

import * as React from "react"
import { Video, Calendar, Clock, ExternalLink, Sparkles, CheckCircle2, UserCheck, ShieldCheck, Globe } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface VirtualMeetingCardProps {
  calendlyUrl?: string
}

export function VirtualMeetingCard({ 
  calendlyUrl = "https://calendly.com/me-adama-diarra/consultation-30min" 
}: VirtualMeetingCardProps) {
  const [meetingState] = React.useState({
    status: "scheduled",
    reason: "Consultation Initiale d'évaluation",
    date: "Mercredi 5 août 2026",
    time: "14 h 00 – 15 h 00 (HE)",
    link: "https://calendly.com/me-adama-diarra/consultation-30min"
  })

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
                Prochaine Rencontre Virtuelle avec Me. Adama Diarra
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
                <span>RCIC #R-514982</span>
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
