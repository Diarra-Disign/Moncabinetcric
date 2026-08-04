import { ShieldCheck, AlertTriangle } from "lucide-react"
import { Link } from "@/lib/i18n/routing"

export interface LegalSection {
  heading: string
  /** Paragraphes de la section, rendus dans l'ordre. */
  paragraphs?: string[]
  /** Points d'une énumération simple. */
  bullets?: string[]
  /** Entrées titrées, pour les listes de catégories. */
  definitions?: { term: string; body: string }[]
}

export interface LegalDocumentProps {
  title: string
  subtitle: string
  effectiveLabel: string
  effectiveDate: string
  intro: string
  draftNotice: string
  tableOfContentsLabel: string
  backLabel: string
  contactHeading: string
  contact: { name: string; rcic: string; email: string; city: string }
  sections: LegalSection[]
}

/**
 * Gabarit commun à la politique de confidentialité et aux conditions
 * d'utilisation. Aucun texte n'est codé ici : tout provient des
 * catalogues messages/legal.{locale}.json via next-intl.
 */
export function LegalDocument({
  title,
  subtitle,
  effectiveLabel,
  effectiveDate,
  intro,
  draftNotice,
  tableOfContentsLabel,
  backLabel,
  contactHeading,
  contact,
  sections,
}: LegalDocumentProps) {
  const anchor = (i: number) => `section-${i + 1}`

  return (
    // <article> et non <main> : le gabarit marketing fournit déjà le <main>
    // de la page, et deux <main> imbriqués sont invalides.
    <article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      {/* Vers /landing et non / : la racine sert le portail client, alors que
          ces pages sont atteintes depuis le pied de page marketing. */}
      <Link
        href="/landing"
        className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        ← {backLabel}
      </Link>

      <header className="border-b border-border pb-8">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {effectiveLabel} {effectiveDate}
          </span>
        </div>
        <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm font-medium text-muted-foreground">
          {subtitle}
        </p>
      </header>

      {/* Mention de premier jet — exigée tant qu'aucune révision juridique
          professionnelle n'a été faite. */}
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs font-medium leading-relaxed text-amber-900">
          {draftNotice}
        </p>
      </div>

      <p className="mt-8 text-sm leading-relaxed text-foreground">{intro}</p>

      <nav className="mt-10 rounded-2xl border border-border bg-muted/40 p-5">
        <h2 className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {tableOfContentsLabel}
        </h2>
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={anchor(i)}>
              <a
                href={`#${anchor(i)}`}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 space-y-10">
        {sections.map((s, i) => (
          <section key={anchor(i)} id={anchor(i)} className="scroll-mt-8">
            <h2 className="mb-3 text-base font-black tracking-tight text-foreground">
              {s.heading}
            </h2>

            {s.paragraphs?.map((p, j) => (
              <p key={j} className="mb-3 text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}

            {s.definitions && s.definitions.length > 0 && (
              <dl className="my-4 space-y-3">
                {s.definitions.map((d, j) => (
                  <div key={j} className="rounded-xl border border-border bg-card p-4">
                    <dt className="mb-1 text-xs font-black text-foreground">{d.term}</dt>
                    <dd className="text-sm leading-relaxed text-muted-foreground">{d.body}</dd>
                  </div>
                ))}
              </dl>
            )}

            {s.bullets && s.bullets.length > 0 && (
              <ul className="my-3 space-y-2 pl-1">
                {s.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <footer className="mt-14 border-t border-border pt-8">
        <h2 className="mb-3 text-base font-black tracking-tight text-foreground">
          {contactHeading}
        </h2>
        <address className="space-y-0.5 text-sm not-italic leading-relaxed text-muted-foreground">
          <div className="font-bold text-foreground">{contact.name}</div>
          <div>{contact.rcic}</div>
          <div>{contact.city}</div>
          <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
            {contact.email}
          </a>
        </address>
      </footer>
    </article>
  )
}
