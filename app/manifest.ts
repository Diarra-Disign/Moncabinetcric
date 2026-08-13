import type { MetadataRoute } from "next"

/**
 * Le manifeste d'application web.
 *
 * ─── POURQUOI UN FICHIER TYPESCRIPT ET NON UN JSON DANS public/ ────────────
 *
 * Next.js sert ce fichier à `/manifest.webmanifest` et pose lui-même la balise
 * `<link rel="manifest">` dans chaque page. Un `public/manifest.json` aurait
 * demandé de déclarer cette balise à la main dans le layout — donc de la
 * maintenir en double, et de la voir disparaître le jour où quelqu'un
 * réorganise l'en-tête.
 *
 * ─── CE QUE CELA CHANGE POUR L'UTILISATEUR ─────────────────────────────────
 *
 * Un consultant qui ajoute le site à l'écran d'accueil de son téléphone
 * obtient une vraie icône et un nom, au lieu d'une capture de la page et de
 * l'adresse du domaine. `display: standalone` retire la barre d'adresse : la
 * chose ressemble alors à une application, ce qu'elle est.
 *
 * ─── LA RACINE, ET POURQUOI ELLE EST JUSTE MAINTENANT ──────────────────────
 *
 * `start_url: "/"` n'aurait pas convenu avant aujourd'hui : la racine servait
 * le portail client et renvoyait tout visiteur non authentifié vers la page de
 * connexion. L'application installée se serait ouverte sur un formulaire de
 * mot de passe. Depuis `f630750`, la racine sert la page publique, qui oriente
 * vers la connexion ou vers la démonstration selon qui regarde.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mon Cabinet CRIC",
    short_name: "MonCabinetCRIC",
    description:
      "Gestion de cabinet pour consultants réglementés en immigration canadienne : dossiers, échéances, ententes, signature électronique, facturation et fidéicommis.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563EB",
    lang: "fr-CA",
    // Le produit est bilingue et l'écran d'installation suit la langue du
    // système ; rien ici ne fige le français côté client.
    categories: ["business", "productivity"],
    icons: [
      // Les tailles intermédiaires ne sont pas décoratives : Android choisit
      // celle qui correspond à la densité de l'écran, et à défaut redimensionne
      // la plus grande — ce qui adoucit les angles du carré et épaissit la
      // lettre.
      { src: "/marque/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { src: "/marque/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { src: "/marque/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { src: "/marque/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/marque/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
