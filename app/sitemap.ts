import type { MetadataRoute } from 'next'
import { siteUrl, siteDefinitif } from '@/lib/site-url'

/**
 * Plan de site.
 *
 * L'adresse vient de APP_URL et non d'une constante : le domaine y était
 * écrit en dur depuis le premier commit du dépôt, et désignait un nom
 * (« moncabinetcric.ca ») auquel rien n'a jamais répondu. Chaque entrée de ce
 * plan pointait donc vers une page injoignable.
 */
/** Même raison qu'à robots.ts : APP_URL est lue à l'exécution. */
export const dynamic = 'force-dynamic'

export default function sitemap(): MetadataRoute.Sitemap {
  // Rien à proposer tant que l'adresse est provisoire : robots.ts ferme déjà
  // l'indexation, un plan de site non vide la contredirait.
  if (!siteDefinitif()) return []

  const baseUrl = siteUrl()
  const locales = ['fr', 'en']
  // Seules les pages accessibles sans compte. Le plan listait auparavant
  // /dashboard, /matters, /pipeline, /billing, /documents et /clients :
  // toutes derrière une authentification, donc invisibles pour un robot,
  // et les annoncer ne faisait que publier la structure de l'application.
  const routes = ['', '/landing', '/demo', '/confidentialite', '/conditions']

  const sitemapEntries: MetadataRoute.Sitemap = []

  locales.forEach((locale) => {
    routes.forEach((route) => {
      sitemapEntries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: route === '' || route === '/landing' ? 1.0 : 0.8,
      })
    })
  })

  return sitemapEntries
}
