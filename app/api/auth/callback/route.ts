import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Retour du lien magique.
 *
 * Supabase renvoie l'utilisateur ici avec un code à échanger contre une
 * session. L'échange doit se faire côté serveur pour que les cookies de
 * session soient posés en HttpOnly.
 *
 * Route hors [locale] à dessein : c'est un point d'entrée technique, pas
 * une page, et l'URL de retour doit rester stable quelle que soit la
 * langue choisie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")

  // Destination validée : n'accepter qu'un chemin interne, sinon le lien
  // de connexion deviendrait un tremplin de redirection vers un site tiers.
  const raw = searchParams.get("suivant")
  const next = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/fr/dashboard"

  if (!code) {
    return NextResponse.redirect(`${origin}/fr/connexion`)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.redirect(`${origin}/fr/connexion`)
  }

  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/fr/connexion`)
  }

  return response
}
