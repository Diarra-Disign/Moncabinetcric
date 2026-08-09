"use client"

import * as React from "react"
import { Bell, Check } from "lucide-react"
import { useRouter } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { marquerLues } from "@/lib/data/notification-actions"
import { cn } from "@/lib/utils"

export interface NotificationVue {
  id: string
  kind: string
  titre: string
  corps: string
  /** Chemin SANS locale : le routeur localisé s'en charge. */
  lien: string | null
  creeLe: string
  lu: boolean
}

const ilYA = (iso: string): string => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const heures = Math.round(minutes / 60)
  if (heures < 24) return `il y a ${heures} h`
  const jours = Math.round(heures / 24)
  if (jours < 30) return `il y a ${jours} j`
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })
}

/**
 * La cloche et son panneau.
 *
 * Le panneau est en `absolute` dans un parent `relative`, et non en `fixed`.
 * L'en-tête porte un `backdrop-blur-md`, lequel fait de lui un bloc conteneur
 * pour tout descendant `fixed` — le panneau se serait retrouvé rogné dans les
 * 64 pixels de la barre, exactement comme le tiroir de navigation mobile
 * l'avait été avant d'être porté par un portail.
 */
export function ClocheNotifications({
  notifications,
  nonLues,
  etiquette,
}: {
  notifications: NotificationVue[]
  nonLues: number
  etiquette: string
}) {
  const [ouvert, setOuvert] = React.useState(false)
  const conteneur = React.useRef<HTMLDivElement>(null)
  const routeur = useRouter()

  React.useEffect(() => {
    if (!ouvert) return
    const auClic = (e: MouseEvent) => {
      if (conteneur.current && !conteneur.current.contains(e.target as Node)) setOuvert(false)
    }
    const auClavier = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false) }
    document.addEventListener("mousedown", auClic)
    document.addEventListener("keydown", auClavier)
    return () => {
      document.removeEventListener("mousedown", auClic)
      document.removeEventListener("keydown", auClavier)
    }
  }, [ouvert])

  const toutMarquer = async () => {
    const ids = notifications.filter((n) => !n.lu).map((n) => n.id)
    if (ids.length === 0) return
    const fd = new FormData()
    fd.set("ids", ids.join(","))
    await marquerLues(fd)
    routeur.refresh()
  }

  return (
    <div ref={conteneur} className="relative shrink-0">
      <Button
        variant="ghost"
        size="icon"
        aria-label={etiquette}
        aria-expanded={ouvert}
        onClick={() => setOuvert((o) => !o)}
        className="rounded-xl shrink-0 relative"
      >
        <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        {nonLues > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-error text-white text-[10px] font-black flex items-center justify-center"
            aria-hidden="true"
          >
            {nonLues > 9 ? "9+" : nonLues}
          </span>
        )}
        {/* Le compte est répété en toutes lettres pour les lecteurs d'écran :
            une pastille rouge ne dit rien à qui ne la voit pas. */}
        <span className="sr-only">{nonLues > 0 ? `${nonLues} non lues` : "aucune non lue"}</span>
      </Button>

      {ouvert && (
        <div
          role="dialog"
          aria-label={etiquette}
          className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card shadow-2xl z-[110] overflow-hidden"
        >
          <header className="flex items-center justify-between gap-2 p-3 border-b border-border">
            <span className="text-xs font-black text-foreground">Notifications</span>
            {nonLues > 0 && (
              <button
                type="button"
                onClick={toutMarquer}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
              >
                <Check className="h-3 w-3" /> Tout marquer comme lu
              </button>
            )}
          </header>

          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Aucune notification pour le moment.
              </p>
            ) : (
              notifications.map((n) => {
                const contenu = (
                  <>
                    <span className="flex items-start gap-2">
                      {!n.lu && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />}
                      <span className={cn("min-w-0", n.lu && "pl-3.5")}>
                        <span className="block text-xs font-bold text-foreground">{n.titre}</span>
                        {n.corps && <span className="block text-[11px] text-muted-foreground truncate">{n.corps}</span>}
                        <span className="block text-[10px] text-muted-foreground mt-0.5">{ilYA(n.creeLe)}</span>
                      </span>
                    </span>
                  </>
                )

                if (!n.lien) {
                  return <div key={n.id} className="p-3">{contenu}</div>
                }

                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={async () => {
                      if (!n.lu) {
                        const fd = new FormData()
                        fd.set("ids", n.id)
                        await marquerLues(fd)
                      }
                      setOuvert(false)
                      routeur.push(n.lien as Parameters<typeof routeur.push>[0])
                    }}
                    className="w-full text-left p-3 hover:bg-muted transition-colors cursor-pointer"
                  >
                    {contenu}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
