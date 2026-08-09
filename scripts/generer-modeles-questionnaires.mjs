#!/usr/bin/env node
/**
 * Produit la migration qui amorce la bibliothèque de questionnaires.
 *
 *   ./cric modeles > supabase/migrations/…_seed_questionnaire_templates.sql
 *
 * Pourquoi générer plutôt qu'écrire à la main : les modèles sont déjà décrits
 * en TypeScript, avec leurs sections partagées. Les retranscrire en SQL
 * créerait deux vérités qui divergeraient au premier ajout de champ — et la
 * divergence ne se verrait qu'à l'usage, sur le questionnaire d'un vrai
 * client. Le même procédé a servi pour program_requirements.
 *
 * L'amorçage est idempotent SANS être écrasant : on insère ce qui manque, on
 * ne touche pas à ce qui existe. Un cabinet qui a corrigé une formulation ne
 * doit pas la voir revenir au déploiement suivant.
 */
import { QUESTIONNAIRE_TEMPLATES } from "../lib/data/questionnaire-templates.ts"

/** Échappement d'un littéral SQL : la seule règle est de doubler l'apostrophe. */
const sql = (s) => `'${String(s).replace(/'/g, "''")}'`

const MESSAGE_FR = (titre) =>
  `Bonjour [Prénom],\n\n` +
  `Afin de nous permettre de préparer votre dossier, nous vous invitons à remplir le questionnaire suivant : ${titre}.\n\n` +
  `Merci de fournir des informations aussi précises que possible.`

const MESSAGE_EN = (titre) =>
  `Hello [Prénom],\n\n` +
  `To allow us to prepare your file, please fill out the following questionnaire: ${titre}.\n\n` +
  `Please provide information that is as accurate as possible.`

const lignes = QUESTIONNAIRE_TEMPLATES.map((t) => {
  const defaut = t.slug === "preconsultation"
  return `  (${sql(t.slug)}, ${sql(t.titleFr)}, ${sql(t.titleEn)}, ` +
    `${sql(t.descriptionFr)}, ${sql(t.descriptionEn)}, ` +
    `${sql(JSON.stringify(t.sections))}::jsonb, ` +
    `${sql(MESSAGE_FR(t.titleFr))}, ${sql(MESSAGE_EN(t.titleEn))}, ${defaut})`
})

process.stdout.write(`-- ============================================================================
-- Amorçage de la bibliothèque de questionnaires — ${QUESTIONNAIRE_TEMPLATES.length} modèles système
-- ============================================================================
--
-- FICHIER GÉNÉRÉ par scripts/generer-modeles-questionnaires.mjs depuis
-- lib/data/questionnaire-templates.ts. Ne pas le modifier à la main : la
-- prochaine génération effacerait la retouche sans prévenir.
--
-- L'insertion ne touche pas aux lignes existantes. Un cabinet qui a corrigé
-- une formulation ne doit pas la voir revenir au déploiement suivant.
-- ============================================================================

begin;

insert into public.questionnaire_templates
  (slug, title_fr, title_en, description_fr, description_en, sections, message_fr, message_en, is_default_preconsultation)
values
${lignes.join(",\n")}
on conflict do nothing;

commit;
`)
