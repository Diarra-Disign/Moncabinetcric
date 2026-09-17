"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Section, SectionHeading } from "./section"

const QUESTIONS = [1, 2, 3, 4] as const

/**
 * La foire aux questions.
 *
 * Les quatre questions vivaient dans quatre cartes bordees et espacees de
 * 12 px : quatre boites empilees, quatre bordures, douze coins arrondis. Elles
 * partagent maintenant un seul conteneur separe par des filets — le meme
 * dessin que les listes du produit. Moins de contours, plus de calme.
 */
export function FaqSection() {
  const t = useTranslations("Landing.faq")
  const [ouverte, setOuverte] = React.useState<number | null>(1)

  return (
    <Section id="faq" fond="carte" filet>
      <SectionHeading title={t("title")} eyebrow={t("badge")} />

      <div className="mx-auto mt-12 max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {QUESTIONS.map((n) => {
          const estOuverte = ouverte === n
          return (
            <div key={n}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOuverte(estOuverte ? null : n)}
                  aria-expanded={estOuverte}
                  aria-controls={`reponse-${n}`}
                  className="flex w-full items-center justify-between gap-6 px-5 py-4 text-left transition-colors hover:bg-muted/50 sm:px-6"
                >
                  <span className="text-sm font-medium text-foreground">
                    {t(`q${n}` as "q1")}
                  </span>
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                      estOuverte ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {estOuverte ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                  </span>
                </button>
              </h3>
              {estOuverte ? (
                <div
                  id={`reponse-${n}`}
                  role="region"
                  className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6"
                >
                  {/* La reponse s'arrete a 70 caracteres par ligne : au-dela,
                      l'oeil rate le debut de la ligne suivante. */}
                  <p className="max-w-2xl">{t(`a${n}` as "a1")}</p>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </Section>
  )
}
