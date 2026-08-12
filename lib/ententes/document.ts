import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ententePdf, type ArticleImprime, type SignataireImprime } from "./pdf"
import type { LanguePdf } from "@/lib/pdf/primitives"
import { nomAvecCivilite } from "@/lib/data/identite"

/**
 * Le PDF d'une entente, et ce qu'il faut pour l'envoyer.
 *
 * Cette fonction existe pour la même raison que `pdfDeFacture()` : la route qui
 * AFFICHE l'entente et l'action qui la CLASSE au dossier doivent produire
 * exactement le même document. Deux compositions séparées auraient divergé, et
 * le contrat archivé n'aurait plus été celui que le consultant a relu.
 *
 * ELLE NE LIT NI MODÈLE NI VARIABLE. Tout vient d'`articles_snapshot` et
 * d'`agreement_parties`, c'est-à-dire de ce que l'entente a RETENU au moment de
 * sa création. C'est le §18 : réécrire le modèle ne doit pas modifier un
 * contrat déjà établi. Si cette fonction relisait `agreement_template_articles`,
 * la garantie serait annulée sans que rien ne le signale.
 */

/** Assemble en écartant les vides : une adresse partielle ne doit pas produire
 *  de virgules orphelines dans un document officiel. */
const joindre = (parties: (string | null | undefined)[], separateur: string) =>
  parties.map((p) => (p ?? "").trim()).filter(Boolean).join(separateur)

export const langueDeLEntente = (v: unknown): LanguePdf => (String(v ?? "") === "en" ? "en" : "fr")

export interface EntenteComposee {
  octets: Uint8Array
  reference: string
  titre: string
  statut: string
  clientId: string | null
  leadId: string | null
  matterId: string | null
  documentId: string | null
  contractantNom: string
  contractantCourriel: string
}

export async function pdfDEntente(
  sb: SupabaseClient,
  id: string,
  langue: LanguePdf = "fr"
): Promise<EntenteComposee | null> {
  const { data } = await sb
    .from("agreements")
    .select(
      "id, reference, title, status, kind, is_probono, fees_amount, taxes_amount, total_amount, " +
        "articles_snapshot, created_at, issued_at, client_id, lead_id, matter_id, document_id, " +
        "matters(reference), " +
        "firms(name, address, phone, email, rcic_license_number, logo_url, tax_gst_number, tax_qst_number, payment_terms)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!data) return null
  const a = data as unknown as Record<string, unknown>

  const { data: parties } = await sb
    .from("agreement_parties")
    .select("role, civility, first_name, last_name, legal_name, email, address, city, province, postal_code, country, signing_order")
    .eq("agreement_id", id)
    .order("signing_order")

  const lignes = (parties ?? []) as unknown as Record<string, string | number | null>[]
  const cab = a.firms as unknown as Record<string, string | null> | null
  const dossier = a.matters as unknown as { reference?: string } | null

  const nomDe = (p: Record<string, string | number | null>) =>
    String(p.legal_name ?? "").trim() ||
    nomAvecCivilite(
      {
        civility: p.civility as string | null,
        firstName: String(p.first_name ?? ""),
        lastName: String(p.last_name ?? ""),
      },
      langue
    )

  // Le contractant du bandeau est la partie « client ». À défaut — une entente
  // dont les parties n'auraient pas été enregistrées — la première venue :
  // mieux vaut un contrat au bon nom sans rôle qu'un contrat sans nom.
  const principal = lignes.find((p) => p.role === "client") ?? lignes[0] ?? null

  const articles = ((a.articles_snapshot as ArticleImprime[]) ?? []).map((x, i) => ({
    position: Number(x.position ?? i + 1),
    code: String(x.code ?? ""),
    title_fr: String(x.title_fr ?? ""),
    body_fr: String(x.body_fr ?? ""),
    level: String(x.level ?? "free"),
  }))

  const signataires: SignataireImprime[] = lignes.map((p) => ({
    nom: nomDe(p),
    role: String(p.role ?? "other"),
    // Le permis n'accompagne QUE le consultant. Le porter sur une autre ligne
    // laisserait croire que le client est lui aussi autorisé à représenter.
    permis: p.role === "consultant" ? (cab?.rcic_license_number ?? "") : undefined,
  }))

  const jour = (v: unknown) =>
    v
      ? new Date(String(v)).toLocaleDateString(langue === "en" ? "en-CA" : "fr-CA", {
          day: "numeric", month: "long", year: "numeric",
        })
      : ""

  const octets = await ententePdf(
    {
      numero: String(a.reference ?? ""),
      // La date qui fait foi est celle de l'ÉMISSION quand elle existe : une
      // entente préparée en mars et émise en avril est datée d'avril.
      date: jour(a.issued_at ?? a.created_at),
      titre: String(a.title ?? ""),
      statut: String(a.status ?? "draft"),
      proBono: a.is_probono === true,
      contractantNom: principal ? nomDe(principal) : "",
      contractantAdresse: principal
        ? joindre(
            [
              String(principal.address ?? ""),
              joindre([String(principal.city ?? ""), String(principal.province ?? "")], ", "),
              String(principal.postal_code ?? ""),
              String(principal.country ?? ""),
            ],
            ", "
          )
        : "",
      contractantCourriel: principal ? String(principal.email ?? "") : "",
      dossierReference: dossier?.reference ?? "",
      articles,
      signataires,
      montants: {
        honoraires: Number(a.fees_amount ?? 0),
        taxes: Number(a.taxes_amount ?? 0),
        total: Number(a.total_amount ?? 0),
      },
      langue,
    },
    {
      nom: cab?.name ?? "",
      adresse: cab?.address ?? "",
      telephone: cab?.phone ?? "",
      courriel: cab?.email ?? "",
      numeroPermis: cab?.rcic_license_number ?? "",
      numeroTps: cab?.tax_gst_number ?? "",
      numeroTvq: cab?.tax_qst_number ?? "",
      conditionsPaiement: cab?.payment_terms ?? "",
      logoUrl: cab?.logo_url ?? "",
    }
  )

  return {
    octets,
    reference: String(a.reference ?? ""),
    titre: String(a.title ?? ""),
    statut: String(a.status ?? "draft"),
    clientId: a.client_id ? String(a.client_id) : null,
    leadId: a.lead_id ? String(a.lead_id) : null,
    matterId: a.matter_id ? String(a.matter_id) : null,
    documentId: a.document_id ? String(a.document_id) : null,
    contractantNom: principal ? nomDe(principal) : "",
    contractantCourriel: principal ? String(principal.email ?? "") : "",
  }
}
