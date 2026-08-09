/**
 * Adresse publique du site.
 *
 * Une seule source, lue par le plan de site, les instructions aux robots et
 * les liens envoyés par courriel. Le domaine était auparavant recopié en dur
 * à chaque endroit — et divergeait : « moncabinetcric.ca » dans le plan de
 * site, alors que rien n'a jamais répondu à ce nom.
 */

/**
 * Origine du site, sans espace parasite ni barre oblique finale.
 *
 * Le `trim()` n'est pas une précaution théorique. APP_URL a été posée sur
 * Vercel avec un retour à la ligne final — ce qui arrive dès qu'on copie une
 * adresse depuis un éditeur ou un terminal. Sans lui, la valeur vaut
 * « https://moncabinetcric.com\n », et le retour à la ligne se propage partout
 * où cette origine est concaténée :
 *
 *   · robots.txt annonçait « Sitemap: https://moncabinetcric.com » suivi de
 *     « /sitemap.xml » sur la ligne d'après — deux lignes invalides au lieu
 *     d'une bonne, et aucun moteur ne trouvait le plan de site ;
 *   · les adresses de retour envoyées à Stripe devenaient invalides, et Stripe
 *     REFUSE une session de paiement dont l'URL de succès ne l'est pas ;
 *   · les liens d'invitation par courriel étaient coupés en deux.
 *
 * Aucune de ces trois pannes n'annonce sa cause. C'est pourquoi le nettoyage
 * se fait ici, à la source, plutôt qu'à chaque endroit qui s'en sert.
 */
export function siteUrl(): string {
  const declare = (process.env.APP_URL ?? "").trim()
  if (declare) return declare.replace(/\/+$/, "")

  // Repli sur le domaine de production que Vercel expose de lui-même.
  //
  // APP_URL a été supprimée une fois. Sans repli, l'application s'est crue sur
  // localhost : robots.txt a répondu « Disallow: / » — le site entier interdit
  // aux moteurs — le plan de site s'est vidé, et les adresses de retour
  // données à Stripe pointaient vers la machine du client. Une variable
  // effacée par mégarde ne doit pas pouvoir désindexer un site.
  //
  // VERCEL_PROJECT_PRODUCTION_URL, et non VERCEL_URL : la seconde désigne le
  // déploiement courant (…-abc123.vercel.app), qui change à chaque poussée et
  // que siteDefinitif() écarte à juste titre. La première désigne le domaine
  // de production du projet, qui est stable. Ni l'une ni l'autre ne porte de
  // schéma.
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim()
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "")

  return "http://localhost:3000"
}

/**
 * Le site tourne-t-il sur son domaine définitif ?
 *
 * Une adresse de développement ou d'aperçu ne mérite pas d'être indexée : ce
 * qu'un moteur y découvre, il le garde longtemps après qu'on l'a abandonnée.
 * La liste est volontairement fermée — un domaine inconnu est réputé
 * définitif, parce que l'oubli doit pencher du côté qui n'efface pas le
 * référencement d'un vrai site.
 */
export function siteDefinitif(): boolean {
  const hote = siteUrl().replace(/^https?:\/\//, "").split("/")[0].toLowerCase()
  if (hote.startsWith("localhost") || hote.startsWith("127.0.0.1")) return false
  if (hote.endsWith(".vercel.app")) return false
  return true
}
