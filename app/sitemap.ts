import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://moncabinetcric.ca'
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
