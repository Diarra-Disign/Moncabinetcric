import type { MetadataRoute } from 'next'
import { siteUrl, siteDefinitif } from '@/lib/site-url'

/**
 * Instructions aux robots d'indexation.
 *
 * Le domaine était écrit en dur — « https://moncabinetcric.ca », hérité du
 * tout premier commit du dépôt, avant qu'aucun domaine ne soit acheté.
 * Personne n'avait choisi ce nom : c'était une valeur d'échafaudage, de la
 * même génération que « Cabinet Boréale » et le permis inventé R-514982.
 * Résultat, le plan de site annonçait à Google dix adresses qui ne
 * répondaient pas.
 *
 * L'adresse vient donc de APP_URL, comme les liens d'invitation par courriel.
 * Le jour où le domaine définitif est branché, ce fichier suit sans qu'on ait
 * à y toucher.
 */
// Évalué à chaque requête plutôt que figé à la construction : APP_URL est une
// variable d'exécution chez l'hébergeur. Figée, elle obligerait à redéployer
// pour que le branchement du vrai domaine soit pris en compte — et personne
// ne se souvient de cette dépendance-là au moment où elle compte.
export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  // Tant que le site vit sur une adresse provisoire, l'indexation reste
  // fermée. Mieux vaut n'être indexé nulle part qu'être indexé sur une
  // adresse qu'on va abandonner : Google conserve longtemps un domaine
  // découvert, et le référencement se rebâtirait sur la mauvaise.
  if (!siteDefinitif()) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/_next/',
        // Écrans internes : l'atelier de composants et la console
        // d'exploitation n'ont rien à faire dans un index public.
        '/fr/design-system',
        '/en/design-system',
        '/fr/admin',
        '/en/admin',
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
