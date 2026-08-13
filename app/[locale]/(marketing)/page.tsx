import LandingPage from "./landing/page"

/**
 * La racine du domaine — `moncabinetcric.com` — sert la page publique.
 *
 * ─── CE QU'ELLE SERVAIT AVANT, ET POURQUOI C'ÉTAIT UN PROBLÈME ─────────────
 *
 * La racine rendait le PORTAIL CLIENT : l'espace où un candidat à l'immigration
 * consulte son dossier. Comme il faut y être authentifié, le proxy déclarait la
 * racine protégée, et tout visiteur non connecté était renvoyé vers la page de
 * connexion. Quelqu'un qui tapait le nom de domaine — un confrère curieux, un
 * client potentiel venu d'une recherche — tombait donc sur un formulaire de mot
 * de passe, sans jamais voir ce que le produit fait.
 *
 * Le sitemap annonçait pourtant cette racine en priorité 1.0. Un moteur de
 * recherche s'y rendait, était redirigé vers la connexion, et indexait cela.
 *
 * ─── POURQUOI UN RÉ-EXPORT PLUTÔT QU'UN DÉPLACEMENT ────────────────────────
 *
 * `/fr/landing` est référencée : dans le sitemap, dans les courriels déjà
 * envoyés, dans les liens qu'on a pu partager. Déplacer le fichier aurait cassé
 * ces adresses. Les deux chemins rendent la même page, et il n'y a qu'un seul
 * composant à maintenir.
 *
 * C'est exactement le procédé qui servait à l'inverse pour le portail :
 * `(portal)/portal/page.tsx` ré-exportait la racine. Le portail a repris sa
 * route propre, `/fr/portal`, et la racine lui a cédé la place.
 */
export default LandingPage
