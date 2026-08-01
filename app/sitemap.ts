import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://moncabinetcric.ca'
  const locales = ['fr', 'en']
  const routes = ['', '/landing', '/dashboard', '/matters', '/calendar', '/pipeline', '/billing', '/documents', '/clients']

  const sitemapEntries: MetadataRoute.Sitemap = []

  locales.forEach((locale) => {
    routes.forEach((route) => {
      sitemapEntries.push({
        url: `${baseUrl}/${locale}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '/dashboard' || route === '/matters' ? 'daily' : 'weekly',
        priority: route === '' || route === '/landing' ? 1.0 : 0.8,
      })
    })
  })

  return sitemapEntries
}
