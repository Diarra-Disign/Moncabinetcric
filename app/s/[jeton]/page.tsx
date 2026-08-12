import type { Metadata } from "next"
import { ouvrirSignature } from "@/lib/data/signature-publique-actions"
import { SignerClient } from "./signer-client"

/**
 * La page publique de signature.
 *
 * ─── HORS DE L'APPLICATION, DÉLIBÉRÉMENT ───────────────────────────────────
 *
 * Elle vit sous `/s/…`, en dehors de `app/[locale]/`. Trois raisons :
 *
 *   1. Le visiteur n'a AUCUN compte. La coque applicative — barre latérale,
 *      recherche, notifications — n'a rien à lui montrer et suppose une
 *      session qu'il n'a pas.
 *   2. L'adresse doit rester courte et sans locale : elle est copiée dans un
 *      courriel, parfois recopiée à la main depuis un téléphone.
 *   3. Le filtre de proxy ne couvre que les chemins localisés. Ce n'est pas un
 *      trou : rien ici n'est accessible sans un jeton valide, et c'est la base
 *      qui le vérifie.
 *
 * ─── PAS D'INDEXATION ──────────────────────────────────────────────────────
 *
 * Un contrat ne se retrouve pas dans un moteur de recherche.
 */

export const metadata: Metadata = {
  title: "Signature de document",
  robots: { index: false, follow: false, nocache: true },
}

// Chaque ouverture est un événement du journal : rien ne doit être servi
// depuis un cache.
export const dynamic = "force-dynamic"

export default async function PageSignature({
  params,
}: {
  params: Promise<{ jeton: string }>
}) {
  const { jeton } = await params
  const ouverture = await ouvrirSignature(jeton)

  // UN SEUL MESSAGE POUR TOUS LES REFUS — jeton inconnu, expiré, révoqué,
  // demande annulée ou déjà close. Distinguer les cas apprendrait à un
  // visiteur curieux quels liens existent.
  if (!ouverture) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <h1 className="text-xl font-black text-foreground">Ce lien n&apos;est plus valide</h1>
        <p className="text-sm text-muted-foreground">
          Il a peut-être expiré, été remplacé par un nouveau, ou la demande a été
          annulée. Le document a pu être signé entre-temps.
        </p>
        <p className="text-sm text-muted-foreground">
          Écrivez au cabinet qui vous l&apos;a envoyé : il vous en fera parvenir un
          nouveau.
        </p>
      </main>
    )
  }

  return (
    <SignerClient
      jeton={jeton}
      vue={ouverture.vue}
      champs={ouverture.champs}
      lienDocument={ouverture.lien}
    />
  )
}
