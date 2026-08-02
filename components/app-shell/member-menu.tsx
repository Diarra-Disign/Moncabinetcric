"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { LogOut } from "lucide-react"

export interface MemberMenuProps {
  fullName: string
  email: string
  ciccRole: string
  initials: string
}

/**
 * Identité du membre connecté et déconnexion.
 *
 * Ces informations proviennent de la session : l'en-tête affichait
 * auparavant « Me. Adama Diarra (RCIC) » en dur, ce qui aurait montré le
 * même nom à tout membre du cabinet une fois l'authentification en place.
 *
 * La déconnexion passe par un formulaire POST et non un lien : une
 * déconnexion déclenchable en GET peut l'être à l'insu de l'utilisateur
 * depuis une page tierce.
 */
export function MemberMenu({ fullName, email, ciccRole, initials }: MemberMenuProps) {
  const t = useTranslations("Auth")

  return (
    <div className="flex items-center gap-x-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-xs font-black text-primary-foreground shadow-md shadow-primary/20">
        {initials}
      </div>

      <span className="hidden lg:flex lg:flex-col lg:leading-tight">
        <span className="text-xs font-black text-foreground">{fullName}</span>
        <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
          {ciccRole}
        </span>
      </span>

      <form action="/api/auth/sign-out" method="post">
        <button
          type="submit"
          aria-label={`${t("signOut")} — ${email}`}
          title={`${t("signedInAs")} ${email}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  )
}
