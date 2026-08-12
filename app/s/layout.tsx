import type { ReactNode } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import "../globals.css"

/**
 * La coque du parcours public de signature.
 *
 * ─── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Ce projet n'a PAS de `app/layout.tsx` : la coque HTML est portée par
 * `app/[locale]/layout.tsx`. Une route posée hors de `[locale]` — ce qui est
 * le cas de `/s/…`, et délibérément — se retrouve donc sans `<html>` ni
 * `<body>`.
 *
 * Le défaut ne se voit NI à la compilation NI au « build » : les deux
 * réussissent. Il ne se manifeste qu'à l'exécution, par un écran d'erreur
 * « Missing <html> and <body> tags in the root layout ». Il a été trouvé en
 * ouvrant la page dans un vrai navigateur — le seul contrôle qui l'attrape.
 *
 * ─── CE QU'ELLE NE CONTIENT PAS, ET C'EST LE POINT ─────────────────────────
 *
 * Ni barre latérale, ni recherche, ni cloche de notifications, ni fournisseur
 * de cabinet. Le visiteur n'a aucun compte : tout cela supposerait une session
 * qu'il n'a pas, et lui montrerait un produit qu'il n'a pas acheté.
 *
 * La langue est fixée au français, faute de segment de locale dans l'adresse.
 * Le lien doit rester court : il est copié dans un courriel et parfois recopié
 * à la main depuis un téléphone. Une version bilingue passera par la
 * préférence du destinataire, portée par la demande — pas par l'adresse.
 */

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export default function LayoutSignature({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  )
}
