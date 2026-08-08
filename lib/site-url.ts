/**
 * Adresse publique du site.
 *
 * Une seule source, lue par le plan de site, les instructions aux robots et
 * les liens envoyés par courriel. Le domaine était auparavant recopié en dur
 * à chaque endroit — et divergeait : « moncabinetcric.ca » dans le plan de
 * site, alors que rien n'a jamais répondu à ce nom.
 */

/** Origine du site, sans barre oblique finale. */
export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")
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
