import { getTranslations } from "next-intl/server"
import { Eyebrow, Section } from "./section"
import { Reveal } from "./reveal"

const ETAPES = ["step1", "step2", "step3"] as const

/**
 * La section fideicommis.
 *
 * ELLE NE MONTRE PLUS DE DEUXIEME GRAND LIVRE. La version precedente posait
 * ici une carte de rapprochement — solde bancaire, grand livre, ecart 0,00 $ —
 * alors que la maquette produit, six cents pixels plus haut, montrait
 * exactement la meme chose sous l'onglet « Fideicommis ». Repeter un visuel ne
 * renforce pas le propos, il le dilue et il allonge la page.
 *
 * A la place, les trois etapes du cycle d'une provision : ce que la maquette
 * ne peut pas raconter, parce qu'un tableau montre un etat, pas un mecanisme.
 * C'est la seule information vraiment nouvelle que cette section pouvait
 * apporter.
 */
export async function TrustAccountingSection() {
  const t = await getTranslations("Landing.trustAccounting")

  return (
    <Section id="fideicommis" fond="carte" filet>
      <Reveal>
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="flex flex-col gap-4 lg:col-span-5">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
              {t("title")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("subtitle")}
            </p>
          </div>

          {/* Panneau en teinte canevas a l'interieur d'une section blanche :
              il se detache sans bordure lourde ni ombre portee. */}
          <ol className="flex flex-col rounded-2xl border border-border bg-background p-6 sm:p-8 lg:col-span-7">
            {ETAPES.map((cle, index) => (
              <li key={cle} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold tabular-nums text-foreground">
                    {index + 1}
                  </span>
                  {index < ETAPES.length - 1 ? (
                    <span aria-hidden="true" className="my-2 w-px flex-1 bg-border" />
                  ) : null}
                </div>
                <div className={index < ETAPES.length - 1 ? "pb-8" : undefined}>
                  <h3 className="text-sm font-semibold text-foreground">{t(`${cle}Title`)}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t(`${cle}Desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </Section>
  )
}
