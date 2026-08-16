import "server-only"

import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { bornesDuMois } from "./bornes-mois"

/**
 * Le compte en fidéicommis du cabinet, vu comme un tout.
 *
 * Une seule lecture pour l'écran entier — solde global, ventilation par
 * client, mouvements, état du dernier rapprochement. Quatre requêtes séparées
 * donneraient quatre instants différents, et un total qui ne correspond pas à
 * la somme des lignes affichées juste en dessous est précisément ce qui fait
 * douter d'un état comptable.
 *
 * Tout passe par la session, donc par la RLS.
 */

export interface MouvementFideicommis {
  id: string
  type: "deposit" | "transfer_to_business" | "refund_to_client" | "withdrawal"
  montant: number
  /** Négatif pour une sortie. C'est ce qui s'additionne. */
  montantSigne: number
  date: string
  clientId: string
  clientNom: string
  dossierReference: string | null
  factureNumero: string | null
  memo: string | null
  saisiPar: string | null
}

export interface SoldeClient {
  clientId: string
  clientNom: string
  solde: number
  dernierMouvement: string | null
  ecritures: number
}

export interface EcartRapprochement {
  libelle: string
  /** Signé : un chèque non encaissé retranche, un dépôt en transit ajoute. */
  montant: number
}

export interface RapprochementVue {
  id: string
  periodeFin: string
  soldeBancaire: number
  soldeRegistre: number
  ecarts: EcartRapprochement[]
  statut: "draft" | "closed"
  closLe: string | null
  notes: string | null
}

export interface RegistreFideicommis {
  soldeTotal: number
  parClient: SoldeClient[]
  mouvements: MouvementFideicommis[]
  rapprochements: RapprochementVue[]
  /** L'état du suivi : depuis quand le cabinet n'a-t-il pas arrêté un mois ? */
  suivi: {
    dernierePeriode: string | null
    joursDepuis: number
    enRetard: boolean
  }
}

const sou = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100

export async function getRegistreFideicommis(): Promise<RegistreFideicommis | null> {
  const membre = await getCurrentMember()
  if (!membre) return null
  const sb = await getSessionSupabase()

  const [mouv, parClient, suivi, rappro] = await Promise.all([
    sb.rpc("firm_trust_ledger_view", { f_id: membre.firmId }),
    sb.rpc("firm_trust_by_client", { f_id: membre.firmId }),
    sb.rpc("trust_reconciliation_status", { f_id: membre.firmId }),
    sb.from("trust_reconciliations")
      .select("id, period_end, bank_balance, ledger_balance, explanations, status, closed_at, notes")
      .eq("firm_id", membre.firmId)
      .order("period_end", { ascending: false })
      .limit(24),
  ])

  const s = (Array.isArray(suivi.data) ? suivi.data[0] : suivi.data) ?? {}

  return {
    soldeTotal: sou(s.ledger_balance),
    parClient: (parClient.data ?? []).map((r: Record<string, unknown>) => ({
      clientId: String(r.client_id),
      clientNom: String(r.client_name ?? ""),
      solde: sou(r.balance),
      dernierMouvement: r.last_movement ? String(r.last_movement) : null,
      ecritures: Number(r.entries ?? 0),
    })),
    mouvements: (mouv.data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      type: String(r.entry_type) as MouvementFideicommis["type"],
      montant: sou(r.amount),
      montantSigne: sou(r.signed_amount),
      date: String(r.occurred_on),
      clientId: String(r.client_id),
      clientNom: String(r.client_name ?? ""),
      dossierReference: r.matter_reference ? String(r.matter_reference) : null,
      factureNumero: r.invoice_number ? String(r.invoice_number) : null,
      memo: r.memo ? String(r.memo) : null,
      saisiPar: r.recorded_by_name ? String(r.recorded_by_name) : null,
    })),
    rapprochements: (rappro.data ?? []).map((r) => ({
      id: String(r.id),
      periodeFin: String(r.period_end),
      soldeBancaire: sou(r.bank_balance),
      soldeRegistre: sou(r.ledger_balance),
      ecarts: (r.explanations as EcartRapprochement[]) ?? [],
      statut: r.status === "closed" ? "closed" : "draft",
      closLe: r.closed_at ? String(r.closed_at) : null,
      notes: r.notes ? String(r.notes) : null,
    })),
    suivi: {
      dernierePeriode: s.last_period ? String(s.last_period) : null,
      joursDepuis: Number(s.days_since ?? 0),
      enRetard: s.overdue === true,
    },
  }
}

export interface LigneRegistreMensuel {
  clientId: string
  clientNom: string
  ouverture: number
  depots: number
  retraits: number
  cloture: number
  dernierMouvement: string | null
  ecritures: number
}

export interface RegistreMensuel {
  /** Premier et dernier jour du mois arrêté, en AAAA-MM-JJ. */
  debut: string
  fin: string
  lignes: LigneRegistreMensuel[]
  totaux: {
    ouverture: number
    depots: number
    retraits: number
    cloture: number
  }
}

/**
 * Le registre du compte client pour un mois donné.
 *
 * Les totaux sont calculés ICI, sur les lignes rendues, et non demandés
 * séparément à la base. Deux lectures produiraient deux instants, et un total
 * qui ne serait pas la somme des lignes affichées juste au-dessus est
 * exactement ce qui fait douter d'un état comptable — c'est déjà la raison
 * d'être de la lecture unique de `getRegistreFideicommis()`.
 *
 * @param mois « AAAA-MM ».
 */
export async function getRegistreMensuel(mois: string): Promise<RegistreMensuel | null> {
  const membre = await getCurrentMember()
  if (!membre) return null

  const { debut, fin } = bornesDuMois(mois)
  const sb = await getSessionSupabase()
  const { data } = await sb.rpc("firm_trust_monthly_register", {
    f_id: membre.firmId,
    p_start: debut,
    p_end: fin,
  })

  const lignes: LigneRegistreMensuel[] = (data ?? []).map((r: Record<string, unknown>) => ({
    clientId: String(r.client_id),
    clientNom: String(r.client_name ?? ""),
    ouverture: sou(r.opening),
    depots: sou(r.deposits),
    retraits: sou(r.withdrawals),
    cloture: sou(r.closing),
    dernierMouvement: r.last_movement ? String(r.last_movement) : null,
    ecritures: Number(r.entries ?? 0),
  }))

  return {
    debut,
    fin,
    lignes,
    totaux: {
      ouverture: sou(lignes.reduce((t, l) => t + l.ouverture, 0)),
      depots: sou(lignes.reduce((t, l) => t + l.depots, 0)),
      retraits: sou(lignes.reduce((t, l) => t + l.retraits, 0)),
      cloture: sou(lignes.reduce((t, l) => t + l.cloture, 0)),
    },
  }
}

/** Les clients du cabinet, pour rattacher un mouvement. Aucun orphelin (F23). */
export async function getClientsPourFideicommis() {
  const membre = await getCurrentMember()
  if (!membre) return []
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("clients")
    .select("id, name, file_number")
    .eq("firm_id", membre.firmId)
    .order("name")
  return (data ?? []).map((c) => ({
    id: String(c.id),
    nom: String(c.name ?? ""),
    numero: String(c.file_number ?? ""),
  }))
}
