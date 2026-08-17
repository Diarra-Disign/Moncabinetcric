"use client"

import * as React from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Users, ChevronDown, Check, ExternalLink } from "lucide-react"

export interface ClientApercuItem {
  id: string
  name: string
  email: string
  fileNumber: string
  program: string
}

export function SelecteurClientApercu({
  clients,
  selectedClientId,
  locale,
}: {
  clients: ClientApercuItem[]
  selectedClientId?: string
  locale: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [ouvert, setOuvert] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const clientActif = clients.find((c) => c.id === selectedClientId)

  // Fermer le menu lors d'un clic extérieur
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOuvert(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const choisirClient = (id: string) => {
    const params = new URLSearchParams(searchParams?.toString())
    params.set("previewClientId", id)
    router.push(`${pathname}?${params.toString()}`)
    setOuvert(false)
  }

  if (clients.length === 0) {
    return (
      <span className="text-[11px] text-amber-200/80 italic">
        (Aucun client avec accès portail actif trouvé)
      </span>
    )
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-900/80 hover:bg-amber-900 text-amber-50 border border-amber-700/80 text-xs font-bold transition-colors cursor-pointer shadow-xs"
      >
        <Users className="h-3.5 w-3.5 text-amber-300 shrink-0" />
        <span>
          {clientActif ? (
            <>
              Client : <strong className="text-white">{clientActif.name}</strong> ({clientActif.fileNumber})
            </>
          ) : (
            <span className="text-amber-200">Choisir un portail client à prévisualiser…</span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-amber-300/80 shrink-0" />
      </button>

      {ouvert && (
        <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl bg-card border border-border shadow-xl z-50 p-2 divide-y divide-border text-foreground">
          <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            Clients ayant un portail ({clients.length})
          </div>
          <div className="py-1 space-y-1">
            {clients.map((c) => {
              const estSelectionne = c.id === selectedClientId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => choisirClient(c.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    estSelectionne
                      ? "bg-primary/10 text-primary font-bold"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                      {c.fileNumber} · {c.email || "Sans courriel"}
                    </p>
                  </div>
                  {estSelectionne && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
