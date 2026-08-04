import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { routing } from './lib/i18n/routing'

const handleI18n = createMiddleware(routing)

/** Segments réservés aux membres du cabinet, après le préfixe de langue. */
const PROTECTED_SEGMENTS = [
  'dashboard',
  'clients',
  'matters',
  'documents',
  'billing',
  'calendar',
  'deadlines',
  'agreements',
  'pipeline',
  'research',
  'settings',
  // La console d'exploitation exige en outre d'être administrateur ; ce
  // second contrôle appartient au layout, qui peut interroger la base.
  'admin',
  // Le portail client : il vit sous /<locale>/portal, mais aussi à la
  // racine /<locale>. La racine est traitée séparément ci-dessous, le
  // segment après la locale y étant vide.
  'portal',
]

const LOGIN_PATH = 'connexion'

function localeOf(pathname: string): string {
  const segment = pathname.split('/')[1]
  return routing.locales.includes(segment as (typeof routing.locales)[number])
    ? segment
    : routing.defaultLocale
}

function isProtected(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean)
  const aLocale = routing.locales.includes(parts[0] as (typeof routing.locales)[number])
  const afterLocale = aLocale ? parts[1] : parts[0]

  // La racine « / » et « /fr » servent le portail client, qui affiche un
  // dossier d'immigration. Sans ce cas particulier, elles échappaient à
  // toute protection : le segment après la locale y est vide.
  if (!afterLocale) return true

  return PROTECTED_SEGMENTS.includes(afterLocale)
}

export default async function proxy(request: NextRequest) {
  // L'internationalisation d'abord : elle peut rediriger ou réécrire, et
  // c'est sur SA réponse que les cookies de session doivent être posés,
  // sinon le jeton rafraîchi est perdu à la redirection.
  const response = handleI18n(request)

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

  // Appel systématique : c'est lui qui fait tourner le jeton d'accès avant
  // expiration. Sans cela l'utilisateur serait déconnecté au bout d'une heure.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (isProtected(pathname) && !user) {
    const locale = localeOf(pathname)
    const redirect = request.nextUrl.clone()
    redirect.pathname = `/${locale}/${LOGIN_PATH}`
    // Mémorise la destination pour y revenir après connexion.
    redirect.searchParams.set('suivant', pathname)
    return NextResponse.redirect(redirect)
  }

  // Déjà connecté : la page de connexion n'a plus lieu d'être — sauf
  // lorsqu'elle signale un problème de compte. Sans cette exception, un
  // utilisateur connecté mais sans profil rebondirait indéfiniment entre
  // la connexion et le tableau de bord.
  const hasProblem = request.nextUrl.searchParams.has('probleme')
  if (user && !hasProblem && pathname.endsWith(`/${LOGIN_PATH}`)) {
    const locale = localeOf(pathname)
    const redirect = request.nextUrl.clone()
    redirect.pathname = `/${locale}/dashboard`
    redirect.search = ''
    return NextResponse.redirect(redirect)
  }

  return response
}

export const config = {
  matcher: ['/', '/(fr|en)/:path*'],
}
