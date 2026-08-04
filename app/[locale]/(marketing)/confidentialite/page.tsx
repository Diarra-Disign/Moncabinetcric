import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { LegalDocument, type LegalSection } from "@/components/legal/legal-document"
import { getPlatformOperatorFirm, shortLocation } from "@/lib/data/platform-firm"

// L'identité de l'exploitant est lue en base : sans cela, la page serait
// figée au build et continuerait d'afficher l'ancienne raison sociale
// après un changement de dénomination ou de permis.
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Legal.privacy")
  return { title: t("title"), description: t("subtitle") }
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  // Requis dès qu'une page est rendue statiquement : sans cette
  // déclaration, next-intl n'a aucun contexte et lève « No intl context found ».
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Legal.privacy")
  const c = await getTranslations("Legal.common")
  // L'identité vient de la base, jamais des catalogues : une mention
  // légale figée finit par nommer le mauvais cabinet.
  const operator = await getPlatformOperatorFirm()

  const sections: LegalSection[] = [
    { heading: t("s1.heading"), paragraphs: [
        t("s1.p1", { ownerName: operator.rcicName, rcicNumber: operator.rcicNumber }),
        t("s1.p2", { email: operator.email }),
      ] },
    {
      heading: t("s2.heading"),
      paragraphs: [t("s2.p1")],
      definitions: [
        { term: t("s2.cat1Title"), body: t("s2.cat1Body") },
        { term: t("s2.cat2Title"), body: t("s2.cat2Body") },
        { term: t("s2.cat3Title"), body: t("s2.cat3Body") },
        { term: t("s2.cat4Title"), body: t("s2.cat4Body") },
        { term: t("s2.cat5Title"), body: t("s2.cat5Body") },
        { term: t("s2.cat6Title"), body: t("s2.cat6Body") },
      ],
    },
    {
      heading: t("s3.heading"),
      paragraphs: [t("s3.p1")],
      bullets: [t("s3.l1"), t("s3.l2"), t("s3.l3"), t("s3.l4"), t("s3.l5"), t("s3.l6")],
    },
    { heading: t("s4.heading"), paragraphs: [t("s4.p1"), t("s4.p2"), t("s4.p3")] },
    {
      heading: t("s5.heading"),
      paragraphs: [t("s5.p1")],
      definitions: [
        { term: t("s5.l1Title"), body: t("s5.l1Body") },
        { term: t("s5.l2Title"), body: t("s5.l2Body") },
        { term: t("s5.l3Title"), body: t("s5.l3Body") },
        { term: t("s5.l4Title"), body: t("s5.l4Body") },
      ],
    },
    { heading: t("s6.heading"), paragraphs: [t("s6.p1"), t("s6.p2"), t("s6.p3")] },
    { heading: t("s7.heading"), paragraphs: [t("s7.p1"), t("s7.p2"), t("s7.p3")] },
    { heading: t("s8.heading"), paragraphs: [t("s8.p1"), t("s8.p2"), t("s8.p3")] },
    {
      heading: t("s9.heading"),
      paragraphs: [t("s9.p1")],
      bullets: [t("s9.l1"), t("s9.l2"), t("s9.l3"), t("s9.l4"), t("s9.l5"), t("s9.l6")],
    },
    { heading: t("s10.heading"), paragraphs: [t("s10.p1"), t("s10.p2")] },
    { heading: t("s11.heading"), paragraphs: [t("s11.p1"), t("s11.p2"), t("s11.p3")] },
    { heading: t("s12.heading"), paragraphs: [t("s12.p1"), t("s12.p2")] },
    { heading: t("s13.heading"), paragraphs: [t("s13.p1"), t("s13.p2")] },
    {
      heading: t("s14.heading"),
      paragraphs: [t("s14.p1")],
      bullets: [t("s14.l1"), t("s14.l2"), t("s14.l3")],
    },
    { heading: t("s15.heading"), paragraphs: [t("s15.p1"), t("s15.p2")] },
  ]

  return (
    <LegalDocument
      title={t("title")}
      subtitle={t("subtitle")}
      effectiveLabel={c("effectiveLabel")}
      effectiveDate={t("effectiveDate")}
      intro={t("intro", { firmName: operator.name })}
      draftNotice={c("draftNotice")}
      tableOfContentsLabel={c("tableOfContents")}
      backLabel={c("backToHome")}
      contactHeading={c("contactHeading")}
      contact={{
        name: operator.name,
        rcic: `${c("rcicPrefix")} ${operator.rcicNumber}`,
        email: operator.email,
        city: shortLocation(operator.address),
      }}
      sections={sections}
    />
  )
}
