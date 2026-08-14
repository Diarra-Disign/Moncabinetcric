import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { routing } from './lib/i18n/routing'

const handleI18n = createMiddleware(routing)

/**
 * Les segments PUBLICS, après le préfixe de langue. Tout le reste est fermé.
 *
 * ─── POURQUOI CETTE LISTE EST À L'ENVERS DE CE QU'ELLE ÉTAIT ───────────────
 *
 * Elle énumérait les segments PROTÉGÉS. Une route privée ajoutée sans qu'on
 * pense à la compléter était donc PUBLIQUE — et rien ne le signalait : la page
 * s'affiche, tout paraît fonctionner. Ce n'était pas un risque théorique.
 * `/admin/utilisateurs`, livrée le 15 août, n'est couverte que parce qu'elle
 * commence par « admin », un segment déjà listé. Par chance de nommage, pas
 * par conception.
 *
 * Désormais l'oubli penche du côté sûr : une route non déclarée ici demande
 * une session. Le défaut se voit tout de suite — on est renvoyé à la connexion
 * — au lieu de rester invisible jusqu'à ce que quelqu'un le trouve.
 *
 * ─── CE QUI FIGURE ICI, ET POURQUOI ────────────────────────────────────────
 *
 * Les pages commerciales et légales, la connexion, l'acceptation d'invitation.
 * Et « q » : la page qu'ouvre un client avec son jeton, sans compte — c'est le
 * jeton qui y tient lieu de clé. « s », la page de signature, vit hors de
 * /<locale> et n'est même pas atteinte par ce filtre.
 *
 * « design-system » N'Y EST PAS. C'est l'atelier de composants, un écran
 * interne que robots.txt écarte déjà de l'indexation ; il devient donc fermé.
 * Une ligne à ajouter ici si tu veux le rouvrir.
 */
const SEGMENTS_PUBLICS = [
  'landing',
  'connexion',
  'demo',
  'bienvenue',
  'conditions',
  'confidentialite',
  'q',
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

  // LA RACINE EST PUBLIQUE, et c'est la page d'accueil commerciale.
  //
  // Elle a longtemps servi le portail client — un dossier d'immigration, donc
  // une page qui exige d'être authentifié — et devait à ce titre être protégée.
  // Conséquence : qui tapait le nom de domaine tombait sur un formulaire de mot
  // de passe. Un confrère curieux, un client venu d'une recherche, un moteur
  // d'indexation : tous voyaient la connexion, jamais le produit.
  //
  // Le portail a repris sa route propre, `/fr/portal`, qui n'est pas déclarée
  // publique ci-dessus et se referme donc d'elle-même.
  if (!afterLocale) return false

  // UNE ADRESSE INCONNUE EST FERMÉE, elle aussi. Un visiteur qui tape une
  // adresse inexistante est renvoyé à la connexion plutôt que de recevoir un
  // 404 — ce qui a l'avantage second de ne pas révéler quelles routes
  // existent.
  return !SEGMENTS_PUBLICS.includes(afterLocale)
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
  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error("Middleware Supabase connection error:", err)
  }

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
