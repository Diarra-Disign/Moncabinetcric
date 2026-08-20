"use server"

import { createClient } from "@supabase/supabase-js"
import { autorise, TROP_DE_TENTATIVES } from "@/lib/securite/limiter"
import type { FormSectionShape, QuestionnaireCorrection } from "./types"
import { messageErreur } from "@/lib/data/erreurs"

/**
 * Le questionnaire vu par son destinataire, sans compte.
 *
 * Ce module est le SEUL endroit de l'application où l'on parle à Postgres
 * sans session. Il n'a pourtant aucun privilège : il emploie la clé anonyme
 * — celle qui est déjà publique dans le navigateur — et n'appelle que trois
 * fonctions SECURITY DEFINER qui exigent le jeton. Le rôle anonyme n'a de
 * droit sur aucune table.
 *
 * L'alternative aurait été la clé de service. Elle aurait marché, et elle
 * aurait fait de la moindre faute de frappe dans un filtre une fuite entre
 * cabinets. Ici, une faute de frappe ne donne rien du tout.
 */

function clientAnonyme() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, anonKey, { auth: { persistSession: false } })
}

export interface QuestionnairePublic {
  id: string
  title: string
  description: string
  sections: FormSectionShape[]
  message: string
  answers: Record<string, unknown>
  prefill: Record<string, unknown>
  corrections: QuestionnaireCorrection[]
  progress: number
  status: string
  dueDate: string | null
  submittedAt: string | null
  firmName: string
}

export interface ResultatPublic {
  ok: boolean
  message: string
}

export async function ouvrirParJeton(
  jeton: string
): Promise<{ questionnaire?: QuestionnairePublic; erreur?: string }> {
  if (!(await autorise("jetonLecture", jeton))) {
    return { erreur: TROP_DE_TENTATIVES }
  }

  const sb = clientAnonyme()
  const { data, error } = await sb.rpc("questionnaire_ouvrir", { p_token: jeton })

  // Le message vient de la base : « lien invalide », « lien désactivé »,
  // « questionnaire annulé ». Les distinguer aide le destinataire à savoir
  // s'il doit vérifier son lien ou écrire au cabinet.
  if (error) return { erreur: messageErreur(error) }
  if (!data) return { erreur: "Ce lien n'est pas valide." }

  const d = data as Record<string, unknown>
  return {
    questionnaire: {
      id: String(d.id),
      title: String(d.title ?? ""),
      description: String(d.description ?? ""),
      sections: (d.sections as FormSectionShape[]) ?? [],
      message: String(d.message ?? ""),
      answers: (d.answers as Record<string, unknown>) ?? {},
      prefill: (d.prefill as Record<string, unknown>) ?? {},
      corrections: (d.corrections as QuestionnaireCorrection[]) ?? [],
      progress: Number(d.progress ?? 0),
      status: String(d.status ?? "sent"),
      dueDate: d.dueDate ? String(d.dueDate) : null,
      submittedAt: d.submittedAt ? String(d.submittedAt) : null,
      firmName: String(d.firmName ?? ""),
    },
  }
}

export async function enregistrerParJeton(
  jeton: string,
  answers: Record<string, unknown>,
  progress: number
): Promise<ResultatPublic> {
  if (!(await autorise("jetonEcriture", jeton))) {
    return { ok: false, message: TROP_DE_TENTATIVES }
  }

  const sb = clientAnonyme()
  const { error } = await sb.rpc("questionnaire_enregistrer", {
    p_token: jeton,
    p_answers: answers,
    p_progress: progress,
  })
  if (error) return { ok: false, message: messageErreur(error) }
  return { ok: true, message: "Enregistré." }
}

export async function soumettreParJeton(jeton: string): Promise<ResultatPublic> {
  if (!(await autorise("jetonEcriture", jeton))) {
    return { ok: false, message: TROP_DE_TENTATIVES }
  }

  const sb = clientAnonyme()
  const { error } = await sb.rpc("questionnaire_soumettre", { p_token: jeton })
  if (error) return { ok: false, message: messageErreur(error) }
  return { ok: true, message: "Questionnaire transmis au cabinet." }
}
