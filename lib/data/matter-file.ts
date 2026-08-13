import "server-only"

import { getSessionSupabase } from "@/lib/supabase/session"

/**
 * Le dossier client, vu comme un tout.
 *
 * Une seule lecture pour tous les onglets. L'alternative — une requête par
 * onglet — donnerait des chiffres pris à des instants différents : le bandeau
 * annoncerait « 3 pièces manquantes » pendant que l'onglet Documents en
 * montrerait 2, et l'écart serait mis sur le compte d'un rafraîchissement.
 *
 * Tout passe par la session, donc par la RLS. Aucune clé de service ici : ce
 * qu'un membre ne peut pas lire en base, il ne le verra pas davantage à
 * l'écran, et le cloisonnement n'a pas à être réécrit dans chaque requête.
 */

export interface ExigenceVue {
  id: string
  code: string
  label: string
  mandatory: boolean
  /** « form » ou « document » : les deux ne se rangent pas au même onglet. */
  kind: string
  status: string
  documentId: string | null
  receivedFrom: string | null
  receivedAt: string | null
  verifiedAt: string | null
  expiresOn: string | null
  rejectionReason: string | null
  /** Le fichier rattaché, quand il y en a un. */
  documentNom: string | null
  documentDepotLe: string | null
  documentDeposePar: string | null
}

export interface EcheanceVue {
  id: string
  title: string
  description: string | null
  dueOn: string
  priority: string
  status: string
  isRegulatory: boolean
  assigneeName: string | null
  completedAt: string | null
  documents: number
}

export interface FormulaireVue {
  id: string
  code: string
  label: string
  version: number
  status: string
  formVersion: string | null
  documentId: string | null
  sentAt: string | null
  signedAt: string | null
  archived: boolean
}

export interface FormulaireDepose {
  id: string
  nom: string
  type: string | null
  deposeLe: string
  deposePar: string | null
  taille: number | null
}

/**
 * Un document du dossier qui n'entre dans aucune catégorie prévue.
 *
 * La catégorie est générique ; le NOM ne l'est pas. C'est lui qui distingue
 * « Lettre explicative sur le refus de 2024 » de « Correspondance IRCC du
 * 3 mars » — et sans lui, la section deviendrait une pile de « Autre document »
 * indiscernables.
 */
export interface AutreDocument {
  id: string
  nom: string
  description: string | null
  /** La date du document lui-même, quand elle diffère du dépôt. */
  dateDocument: string | null
  source: string | null
  deposeLe: string
  deposePar: string | null
  taille: number | null
}

export interface FactureVue {
  id: string
  numero: string
  description: string | null
  montant: number
  regle: number
  solde: number
  date: string | null
  dueOn: string | null
  statut: string
}

export interface PaiementVue {
  id: string
  montant: number
  date: string
  methode: string
  reference: string | null
  destination: "trust" | "business"
  factureNumero: string | null
  notes: string | null
}

export interface DossierComplet {
  /**
   * Les identifiants RÉELS, résolus ici.
   *
   * Matter.id, dans la couche de données historique, porte la RÉFÉRENCE du
   * dossier — « DOS-35695 » — et Matter.clientId un identifiant hérité, pas
   * l'UUID du client. Les passer aux fonctions SQL ne produisait aucune
   * erreur : les requêtes ne trouvaient rien, et l'écran s'affichait vide.
   *
   * Ils sont donc résolus une fois, ici, et redescendus aux formulaires.
   */
  matterId: string
  /**
   * Nul quand le dossier n'est rattaché à aucun client.
   *
   * Ce cas EXISTE dans les données réelles, et le premier jet refusait alors
   * d'afficher quoi que ce soit : les cinq pièces exigées du dossier étaient
   * bien en base, et l'écran restait vide. Un dossier incomplet doit se
   * montrer avec ce qui manque, pas disparaître.
   */
  clientId: string | null

  exigences: ExigenceVue[]
  bloquantes: { code: string; label: string; status: string }[]
  echeances: EcheanceVue[]
  formulaires: FormulaireVue[]
  formulairesDeposes: FormulaireDepose[]
  autresDocuments: AutreDocument[]
  factures: FactureVue[]
  paiements: PaiementVue[]

  finances: {
    facture: number
    paye: number
    solde: number
    enFideicommis: number
    auCompteEntreprise: number
    soldeFideicommisClient: number
  }

  portail: {
    compteCree: boolean
    derniereConnexion: string | null
    documentsDeposes: number
    validationsEnAttente: number
  }

  progression: {
    total: number
    recues: number
    verifiees: number
    manquantes: number
    aVerifier: number
    pourcentage: number
  }
}

/** Une somme d'argent, toujours ramenée au cent près. */
const sou = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100

/**
 * Le dossier complet, à partir de la RÉFÉRENCE affichée.
 *
 * Renvoie null quand le dossier est introuvable — ce que la RLS produit aussi
 * pour un dossier d'un autre cabinet, et c'est voulu : de l'extérieur, « pas
 * le vôtre » et « n'existe pas » doivent se ressembler.
 */
export async function getDossierComplet(
  reference: string,
  locale: string
): Promise<DossierComplet | null> {
  const sb = await getSessionSupabase()
  const fr = locale !== "en"

  // Mêmes formes que getMatterById : l'interface manipule tantôt « #DOS-1 »,
  // tantôt « DOS-1 », selon qu'on vienne d'un lien ou d'un segment d'URL.
  const nue = decodeURIComponent(reference).replace("#", "")
  const { data: dossierRow } = await sb
    .from("matters")
    .select("id, client_id")
    .in("reference", [decodeURIComponent(reference), `#${nue}`, nue])
    .limit(1)
    .maybeSingle()

  if (!dossierRow?.id) return null

  const matterId = dossierRow.id as string
  // Sans client, tout ce qui touche à l'argent et au portail est hors de
  // portée — mais les pièces, les formulaires et les échéances tiennent au
  // DOSSIER, pas au client. Ils restent donc visibles.
  const clientId = (dossierRow.client_id as string | null) ?? null

  // Lancées ensemble : ces lectures ne dépendent pas les unes des autres, et
  // les enchaîner ajouterait autant d'allers-retours que d'onglets.
  const [exig, bloq, ech, form, fact, paie, cu, docsClient, revues, soldeFid, docs] =
    await Promise.all([
      sb.rpc("matter_requirements_view", { m_id: matterId }),
      sb.rpc("matter_blocking_requirements", { m_id: matterId }),
      sb.rpc("matter_deadlines_view", { m_id: matterId }),
      sb.from("matter_forms")
        .select("id, form_code, version, status, form_version, document_id, sent_at, signed_at")
        .eq("matter_id", matterId)
        .order("version", { ascending: false }),
      sb.from("invoices")
        .select("id, invoice_number, service_description, amount, date, due_on, status")
        .eq("matter_id", matterId)
        .order("date", { ascending: false }),
      clientId
        ? sb.from("payments")
            .select("id, amount, paid_on, method, reference, destination, notes, invoice_id")
            .eq("client_id", clientId)
            .order("paid_on", { ascending: false })
        : Promise.resolve({ data: [] }),
      clientId
        ? sb.from("client_users").select("user_id, created_at").eq("client_id", clientId).maybeSingle()
        : Promise.resolve({ data: null }),
      clientId
        ? sb.from("documents").select("id").eq("client_id", clientId).eq("category", "client_upload")
        : Promise.resolve({ data: [] }),
      clientId
        ? sb.from("document_reviews").select("id").eq("client_id", clientId).eq("status", "pending")
        : Promise.resolve({ data: [] }),
      clientId
        ? sb.rpc("client_trust_balance", { c_id: clientId })
        : Promise.resolve({ data: 0 }),
      sb.from("documents")
        .select("id, name, type, category, created_at, uploaded_by, size_bytes, requirement_id, storage_path, description, date, source")
        .eq("matter_id", matterId)
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
    ])

  // Les documents indexés par leur identifiant, pour joindre nom et date à
  // chaque pièce sans refaire une requête par ligne.
  const parId = new Map(
    (docs.data ?? []).map((d) => [String(d.id), d as Record<string, unknown>])
  )

  const exigences: ExigenceVue[] = (exig.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    code: String(r.code),
    label: String(fr ? r.label_fr : r.label_en),
    mandatory: Boolean(r.mandatory),
    kind: String(r.kind ?? "document"),
    status: String(r.status),
    documentId: (r.document_id as string) ?? null,
    receivedFrom: (r.received_from as string) ?? null,
    receivedAt: (r.received_at as string) ?? null,
    verifiedAt: (r.verified_at as string) ?? null,
    expiresOn: (r.expires_on as string) ?? null,
    rejectionReason: (r.rejection_reason as string) ?? null,
    documentNom: (parId.get(String(r.document_id))?.name as string) ?? null,
    documentDepotLe: (parId.get(String(r.document_id))?.created_at as string) ?? null,
    documentDeposePar: (parId.get(String(r.document_id))?.uploaded_by as string) ?? null,
  }))

  // Le statut et le montant réglé de chaque facture viennent de la base, pas
  // d'un calcul refait ici. invoice_status() est la même fonction qui décidera
  // ailleurs — une seconde arithmétique produirait un second avis.
  const factures: FactureVue[] = []
  for (const f of fact.data ?? []) {
    const [{ data: statut }, { data: regle }] = await Promise.all([
      sb.rpc("invoice_status", { i_id: f.id }),
      sb.rpc("invoice_paid_amount", { i_id: f.id }),
    ])
    factures.push({
      id: String(f.id),
      numero: String(f.invoice_number ?? ""),
      description: (f.service_description as string) ?? null,
      montant: sou(f.amount),
      regle: sou(regle),
      solde: sou(Number(f.amount ?? 0) - Number(regle ?? 0)),
      date: (f.date as string) ?? null,
      dueOn: (f.due_on as string) ?? null,
      statut: String(statut ?? f.status),
    })
  }

  const numeroParFacture = new Map(factures.map((f) => [f.id, f.numero]))

  const paiements: PaiementVue[] = (paie.data ?? []).map((p) => ({
    id: String(p.id),
    montant: sou(p.amount),
    date: String(p.paid_on),
    methode: String(p.method),
    reference: (p.reference as string) ?? null,
    destination: p.destination === "trust" ? "trust" : "business",
    factureNumero: numeroParFacture.get(String(p.invoice_id)) ?? null,
    notes: (p.notes as string) ?? null,
  }))

  // Les deux totaux ne se mélangent JAMAIS, même sur un tableau de bord. Un
  // montant global qui additionne le fidéicommis et les honoraires encaissés
  // suggère que le cabinet dispose de l'ensemble — ce qui est faux, et ce que
  // le Code de déontologie interdit précisément de laisser croire.
  const enFideicommis = sou(
    paiements.filter((p) => p.destination === "trust").reduce((t, p) => t + p.montant, 0)
  )
  const auCompteEntreprise = sou(
    paiements.filter((p) => p.destination === "business").reduce((t, p) => t + p.montant, 0)
  )

  const totalFacture = sou(factures.reduce((t, f) => t + f.montant, 0))
  const totalPaye = sou(factures.reduce((t, f) => t + f.regle, 0))

  const recues = exigences.filter((e) => e.receivedAt !== null).length
  const verifiees = exigences.filter((e) => e.status === "verified").length
  const manquantes = exigences.filter((e) => e.status === "missing" || e.status === "requested").length
  const aVerifier = exigences.filter((e) => e.status === "received").length

  return {
    matterId,
    clientId,
    exigences,
    bloquantes: (bloq.data ?? []).map((b: Record<string, unknown>) => ({
      code: String(b.code),
      label: String(b.label_fr),
      status: String(b.status),
    })),
    echeances: (ech.data ?? []).map((d: Record<string, unknown>) => ({
      id: String(d.id),
      title: String(d.title),
      description: (d.description as string) ?? null,
      dueOn: String(d.due_on),
      priority: String(d.priority),
      status: String(d.status),
      isRegulatory: Boolean(d.is_regulatory),
      assigneeName: (d.assignee_name as string) ?? null,
      completedAt: (d.completed_at as string) ?? null,
      documents: Number(d.documents ?? 0),
    })),
    formulaires: (form.data ?? []).map((f) => ({
      id: String(f.id),
      code: String(f.form_code),
      label: String(f.form_code).replace(/^IMM(\d+)$/, "IMM $1"),
      version: Number(f.version),
      status: String(f.status),
      formVersion: (f.form_version as string) ?? null,
      documentId: (f.document_id as string) ?? null,
      sentAt: (f.sent_at as string) ?? null,
      signedAt: (f.signed_at as string) ?? null,
      archived: f.status === "archived",
    })),
    // MÊME REQUÊTE, AUTRE FILTRE. Les documents du dossier sont déjà chargés
    // une fois : en refaire une requête pour la sixième catégorie ferait deux
    // aller-retours pour lire la même table.
    autresDocuments: (docs.data ?? [])
      .filter((d) => d.category === "other")
      .map((d) => ({
        id: String(d.id),
        nom: String(d.name ?? ""),
        description: (d.description as string) ?? null,
        dateDocument: (d.date as string) ?? null,
        source: (d.source as string) ?? null,
        deposeLe: String(d.created_at),
        deposePar: (d.uploaded_by as string) ?? null,
        taille: (d.size_bytes as number) ?? null,
      })),
    formulairesDeposes: (docs.data ?? [])
      .filter((d) => d.category === "ircc_form")
      .map((d) => ({
        id: String(d.id),
        nom: String(d.name ?? ""),
        type: (d.type as string) ?? null,
        deposeLe: String(d.created_at),
        deposePar: (d.uploaded_by as string) ?? null,
        taille: (d.size_bytes as number) ?? null,
      })),
    factures,
    paiements,
    finances: {
      facture: totalFacture,
      paye: totalPaye,
      solde: sou(totalFacture - totalPaye),
      enFideicommis,
      auCompteEntreprise,
      soldeFideicommisClient: sou(soldeFid.data),
    },
    portail: {
      compteCree: Boolean(cu.data?.user_id),
      derniereConnexion: null, // auth.users n'est pas lisible sous RLS.
      documentsDeposes: (docsClient.data ?? []).length,
      validationsEnAttente: (revues.data ?? []).length,
    },
    progression: {
      total: exigences.length,
      recues,
      verifiees,
      manquantes,
      aVerifier,
      pourcentage: exigences.length === 0 ? 0 : Math.round((verifiees / exigences.length) * 100),
    },
  }
}
