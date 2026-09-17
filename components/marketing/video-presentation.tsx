"use client"

import * as React from "react"
import Image from "next/image"
import { useLocale, useTranslations } from "next-intl"
import { Play } from "lucide-react"

/**
 * LA VIDEO DE PRESENTATION — 28 secondes de motion design, en francais.
 *
 * ─── POURQUOI ELLE EST ICI, ET NON SOUS LA MAQUETTE ────────────────────────
 *
 * La maquette montre A QUOI RESSEMBLE l'application : tuiles, listes, soldes.
 * La video montre COMMENT UN DOSSIER AVANCE : prospect, pieces, echeances,
 * fideicommis. Posee sous la maquette, elle faisait deux grands visuels du
 * produit a la suite. Posee dans la section des modules, elle montre que les
 * quatre cartes qui suivent s'enchainent.
 *
 * ─── RIEN N'EST TELECHARGE AVANT LE CLIC ───────────────────────────────────
 *
 * `preload="none"` : le fichier (7 Mo) n'est demande qu'au lancement. L'image
 * d'apercu n'est PAS l'attribut `poster` de la balise : elle passe par
 * `next/image`, qui la sert en AVIF ou WebP a la taille affichee, la ou
 * `poster` aurait impose le JPEG 1920 px d'origine a un telephone.
 *
 * La lecture est lancee DANS le gestionnaire de clic. Monter la balise au clic
 * puis compter sur `autoPlay` echoue sur iOS Safari, qui exige que `play()`
 * soit appele pendant le geste de l'utilisateur.
 *
 * ─── LE SON EST COUPE AU DEPART ────────────────────────────────────────────
 *
 * La bande sonore est une musique, sans narration : elle n'apporte aucune
 * information, et la page est souvent ouverte dans un bureau partage. Le
 * bouton son des commandes natives permet de l'activer.
 *
 * ─── ACCESSIBILITE ─────────────────────────────────────────────────────────
 *
 * Les commandes sont celles du navigateur : clavier, lecteur d'ecran et plein
 * ecran fonctionnent sans code. Le focus passe sur la video au lancement — le
 * bouton qui l'avait ne disparait pas en l'emportant avec lui.
 *
 * Les sous-titres anglais traduisent le texte a l'ecran, et sont actives par
 * defaut sur `/en`. La description repliable reprend chaque plan, dans la
 * langue de la page, pour qui ne voit pas la video.
 */

const SOURCE = "/marketing/parcours-dossier.mp4"
const APERCU = "/marketing/parcours-dossier-apercu.jpg"
const SOUS_TITRES_EN = "/marketing/parcours-dossier.en.vtt"
const DUREE_SECONDES = 28
const SCENES = ["s1", "s2", "s3", "s4", "s5", "s6", "s7"] as const

/** « 0:28 » — le format de duree est le meme en francais et en anglais. */
function formaterDuree(secondes: number): string {
  const minutes = Math.floor(secondes / 60)
  return `${minutes}:${String(secondes % 60).padStart(2, "0")}`
}

export function VideoPresentation() {
  const t = useTranslations("Landing.video")
  const locale = useLocale()
  const video = React.useRef<HTMLVideoElement>(null)
  const [lancee, setLancee] = React.useState(false)

  const lancer = () => {
    const element = video.current
    if (!element) return
    element.muted = true
    setLancee(true)
    element.focus()
    // Si le navigateur refuse la lecture, les commandes natives sont deja
    // affichees : le visiteur relance d'un geste, sans message d'erreur.
    element.play().catch(() => undefined)
  }

  return (
    <figure className="m-0">
      {/* `aspect-video` : le cadre garde le 16:9 de la source avant, pendant
          et apres la lecture — aucun decalage de mise en page au clic. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-card shadow-elev-2">
        <video
          ref={video}
          preload="none"
          playsInline
          muted
          controls={lancee}
          tabIndex={lancee ? 0 : -1}
          aria-label={t("videoLabel")}
          className="absolute inset-0 size-full bg-card object-contain"
        >
          <source src={SOURCE} type="video/mp4" />
          <track
            kind="subtitles"
            src={SOUS_TITRES_EN}
            srcLang="en"
            label="English"
            default={locale === "en"}
          />
          {t("unsupported")}
        </video>

        {lancee ? null : (
          <button
            type="button"
            onClick={lancer}
            aria-label={t("play", { secondes: DUREE_SECONDES })}
            className="group absolute inset-0 flex items-center justify-center focus-visible:outline-none"
          >
            <Image
              src={APERCU}
              alt=""
              fill
              sizes="(min-width: 1024px) 56rem, 100vw"
              className="object-cover"
            />
            {/* UNE PASTILLE EN COIN, ET NON UN BOUTON ROND AU CENTRE. Le centre
                de l'image d'apercu tombe juste apres « Une seule vue. » : a
                375 px, un bouton centre de 56 px recouvrait la fin du titre.
                Le coin inferieur droit est vide a toutes les largeurs. Toute
                l'image reste cliquable ; la pastille n'est que le signal.
                Sous 640 px, le libelle est retire : la video ne fait que 184 px
                de haut et la pastille complete couvrait le schema de droite. Le
                nom complet reste porte par `aria-label`. */}
            <span
              aria-hidden="true"
              className="absolute right-2 bottom-2 inline-flex items-center gap-2 rounded-full bg-foreground py-1 pr-2.5 pl-1 text-xs font-medium text-background shadow-elev-2 transition-colors group-hover:bg-primary group-focus-visible:bg-primary group-focus-visible:ring-4 group-focus-visible:ring-primary/30 sm:right-5 sm:bottom-5 sm:py-1.5 sm:pr-3.5 sm:pl-1.5 sm:text-sm"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-background text-foreground sm:size-8">
                <Play className="size-3 translate-x-px fill-current sm:size-4" />
              </span>
              <span className="hidden sm:inline">{t("playShort")}</span>
              <span className="hidden sm:inline">·</span>
              <span className="tabular-nums">{formaterDuree(DUREE_SECONDES)}</span>
            </span>
          </button>
        )}
      </div>

      <figcaption className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
        {t("caption")}
      </figcaption>

      {/* Le triangle natif de `summary` est garde : c'est lui qui dit, sans
          un mot de plus, que la ligne se deplie. */}
      <details className="mx-auto mt-3 max-w-2xl text-center">
        <summary className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:text-foreground">
          {t("transcriptTitle")}
        </summary>
        <ol className="mt-3 flex list-decimal flex-col gap-2 rounded-xl border border-border bg-card p-5 pl-9 text-left text-sm leading-relaxed text-muted-foreground">
          {SCENES.map((scene) => (
            <li key={scene}>{t(`scenes.${scene}`)}</li>
          ))}
        </ol>
      </details>
    </figure>
  )
}
