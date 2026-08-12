import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ententePdf, type ArticleImprime, type SignataireImprime } from "./pdf"
import type { LanguePdf } from "@/lib/pdf/primitives"
import { nomAvecCivilite } from "@/lib/data/identite"
import { lignesAdresse } from "@/lib/data/adresse"

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
        "firms(name, owner_name, address, address_line2, city, province, postal_code, country, phone, email, website, rcic_license_number, logo_url, tax_gst_number, tax_qst_number, payment_terms)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!data) return null
  const a = data as unknown as Record<string, unknown>

  const { data: parties } = await sb
    .from("agreement_parties")
    .select("role, civility, first_name, last_name, legal_name, email, phone, address, address_line2, city, province, postal_code, country, license_number, signing_order")
    .eq("agreement_id", id)
    .order("signing_order")

  const lignes = (parties ?? []) as unknown as Record<string, string | number | null>[]
  const cab = a.firms as unknown as Record<string, string | null> | null
  const dossier = a.matters as unknown as { reference?: string } | null

  const txt = (v: unknown) => String(v ?? "").trim()

  // Le NOM DE LA PERSONNE, toujours. La raison sociale a son propre champ dans
  // le bloc : les confondre ferait signer « Diarra Global Visa » à quelqu'un.
  const nomDe = (p: Record<string, string | number | null>) =>
    nomAvecCivilite(
      {
        civility: p.civility as string | null,
        firstName: String(p.first_name ?? ""),
        lastName: String(p.last_name ?? ""),
      },
      langue
    ) || txt(p.legal_name)

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
    //
    // Il est lu sur la COPIE FIGÉE en priorité. Le relire sur `firms`
    // réécrirait le permis de tous les contrats déjà signés le jour où il
    // changerait ; le repli n'existe que pour les ententes établies avant que
    // la colonne n'existe.
    permis: p.role === "consultant"
      ? (txt(p.license_number) || txt(cab?.rcic_license_number))
      : undefined,
  }))

  // ---- Les deux blocs d'identification (§8) -------------------------------
  // Tous deux composés depuis agreement_parties, c'est-à-dire depuis ce que le
  // contrat a RETENU. Une adresse professionnelle corrigée dans les Paramètres
  // s'applique aux contrats suivants et ne touche pas celui-ci (§6).
  const blocDe = (p: Record<string, string | number | null> | null, organisation?: string) => ({
    nom: p ? nomDe(p) : "",
    organisation,
    permis: p && p.role === "consultant"
      ? (txt(p.license_number) || txt(cab?.rcic_license_number))
      : undefined,
    lignesAdresse: p
      ? lignesAdresse({
          ligne1: txt(p.address),
          ligne2: txt(p.address_line2),
          ville: txt(p.city),
          province: txt(p.province),
          codePostal: txt(p.postal_code),
          pays: txt(p.country),
        })
      : [],
    telephone: p ? txt(p.phone) : "",
    courriel: p ? txt(p.email) : "",
  })

  const ligneConsultant = lignes.find((p) => p.role === "consultant") ?? null

  // Le consultant n'a de bloc que si sa partie a été enregistrée. À défaut —
  // une entente antérieure à cette version — on retombe sur les Paramètres :
  // mieux vaut l'adresse actuelle du cabinet qu'un bloc vide sur un contrat.
  const blocConsultant = ligneConsultant
    ? { ...blocDe(ligneConsultant, txt(cab?.name)), siteWeb: txt(cab?.website) }
    : {
        nom: txt(cab?.owner_name),
        organisation: txt(cab?.name),
        permis: txt(cab?.rcic_license_number),
        lignesAdresse: lignesAdresse({
          ligne1: txt(cab?.address), ligne2: txt(cab?.address_line2),
          ville: txt(cab?.city), province: txt(cab?.province),
          codePostal: txt(cab?.postal_code), pays: txt(cab?.country),
        }),
        telephone: txt(cab?.phone),
        courriel: txt(cab?.email),
        siteWeb: txt(cab?.website),
      }

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
      consultant: blocConsultant,
      // La raison sociale du client : renseignée seulement pour une personne
      // morale, et jamais confondue avec son nom.
      client: blocDe(principal, principal ? txt(principal.legal_name) : ""),
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
      // L'en-tête de page garde la première ligne : le bloc « ENTRE » porte
      // l'adresse complète juste dessous, et la répéter en entier deux fois
      // sur la même page ferait un dépliant.
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
