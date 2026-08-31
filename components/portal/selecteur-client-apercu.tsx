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
      <span className="text-xs text-muted-foreground italic">
        Aucun client enregistré dans le cabinet
      </span>
    )
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOuvert(!ouvert)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card hover:bg-muted text-foreground border border-border text-xs font-semibold transition-all cursor-pointer shadow-2xs hover:border-primary/40"
      >
        <Users className="h-4 w-4 text-primary shrink-0" />
        <span className="truncate max-w-[240px]">
          {clientActif ? (
            <>
              Client : <strong className="text-foreground">{clientActif.name}</strong>{" "}
              <span className="font-mono text-muted-foreground text-[11px]">({clientActif.fileNumber})</span>
            </>
          ) : (
            <span className="text-muted-foreground">Changer de client…</span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
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
