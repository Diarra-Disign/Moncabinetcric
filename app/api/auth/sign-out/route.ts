import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Déconnexion.
 *
 * En POST uniquement : une déconnexion en GET peut être déclenchée à
 * l'insu de l'utilisateur par une simple balise image sur une page tierce.
 */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl
  const response = NextResponse.redirect(`${origin}/fr/connexion`, { status: 303 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return response

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

  await supabase.auth.signOut()
  return response
}
