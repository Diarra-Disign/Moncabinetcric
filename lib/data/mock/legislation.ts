import type { LegislationProvision, ResearchWorkspace } from "../types"
import provisions from "../legislation/provisions.json"

/**
 * Corpus LIPR / RIPR importé du texte consolidé officiel.
 *
 * Généré par `node scripts/import-legislation.mjs` depuis
 * laws-lois.justice.gc.ca — ne pas éditer à la main : toute correction se
 * fait dans l'importateur, puis on relance le script.
 *
 * citingCaseCount est absent de toutes les entrées : les valeurs qui
 * figuraient ici auparavant n'avaient aucune source vérifiable, et un
 * décompte de jurisprudence inventé n'a pas sa place dans un outil destiné
 * à des consultants réglementés.
 */
export const MOCK_LEGISLATION_PROVISIONS: LegislationProvision[] =
  provisions as LegislationProvision[]

export const MOCK_RESEARCH_WORKSPACES: ResearchWorkspace[] = [
  {
    id: "ws-2026-01",
    title: "Analyse dispense EIMT & Admissibilité — Les Industries Nordiques",
    matterId: "#DOS-35698",
    matterReference: "#DOS-35698",
    clientName: "Les Industries Nordiques Inc.",
    program: "Permis de travail / EIMT",
    createdBy: "Me Adama Diarra (RCIC #R-514982)",
    createdAt: "2026-07-15",
    updatedAt: "2026-08-01",
    notes: "Dossier entreprise impliquant le recrutement de 12 ouvriers spécialisés. Vérification de la conformité de l'offre d'emploi sous l'article 200(1) du RIPR et des conditions de l'article 11(1) de la LIPR avant dépôt.",
    sources: [
      {
        id: "src-1",
        workspaceId: "ws-2026-01",
        provisionId: "ripr-200",
        provisionNo: "200(1)",
        instrument: "ripr",
        headingFr: "Permis de travail — Délivrance et dispense d'EIMT",
        headingEn: "Work permit — Issuance and LMIA exemption",
        citationSnapshot: "RIPR DORS/2002-227, art. 200(1) (version cons. 2026-06-01)",
        textSnapshotFr: "c) soit une étude d'impact sur le marché du travail (EIMT) a été délivrée par EDSC, soit il fait partie d'une catégorie dispensée d'EIMT en vertu des articles 204 à 208...",
        textSnapshotEn: "(c) either a labour market impact assessment (LMIA) has been issued by ESDC, or the foreign national is exempt from an LMIA under sections 204 to 208...",
        note: "Vérifier la validité de l'EIMT collective pour les 12 candidats avant transmission des demandes individuelles de permis.",
        sortOrder: 1,
        addedAt: "2026-07-15"
      },
      {
        id: "src-2",
        workspaceId: "ws-2026-01",
        provisionId: "lipr-11",
        provisionNo: "11(1)",
        instrument: "lipr",
        headingFr: "Visa et document réglementaire",
        headingEn: "Visa and document required",
        citationSnapshot: "LIPR L.C. 2001, ch. 27, art. 11(1) (version cons. 2026-06-01)",
        textSnapshotFr: "L'étranger doit, préalablement à son entrée au Canada, demander au fonctionnaire un visa ou un autre document requis par règlement.",
        textSnapshotEn: "A foreign national must, before entering Canada, apply to an officer for a visa or for any other document required by the regulations.",
        note: "Rappel à donner au client RH : les travailleurs doivent recevoir leur lettre d'introduction du point d'entrée avant l'embarquement.",
        sortOrder: 2,
        addedAt: "2026-07-18"
      }
    ]
  },
  {
    id: "ws-2026-02",
    title: "Analyse d'équité procédurale — Risque de fausses déclarations Art. 40",
    matterId: "#DOS-35697",
    matterReference: "#DOS-35697",
    clientName: "Dr. S. Rahman",
    program: "Résidence Permanente (EE)",
    createdBy: "Me Adama Diarra (RCIC #R-514982)",
    createdAt: "2026-07-22",
    updatedAt: "2026-07-29",
    notes: "Préparation du mémoire explicatif suite à une lettre d'équité procédurale d'IRCC concernant une omission non intentionnelle dans le curriculum vitae précédent du candidat.",
    sources: [
      {
        id: "src-3",
        workspaceId: "ws-2026-02",
        provisionId: "lipr-40",
        provisionNo: "40(1)",
        instrument: "lipr",
        headingFr: "Fausses déclarations",
        headingEn: "Misrepresentation",
        citationSnapshot: "LIPR L.C. 2001, ch. 27, art. 40(1)a) (version cons. 2026-06-01)",
        textSnapshotFr: "a) faire, directement ou indirectement, des fausses déclarations sur un fait important quant à un objet pertinent, ou une réticence sur un tel fait, ce qui entraîne ou risque d'entraîner une erreur dans l'application de la présente loi...",
        textSnapshotEn: "(a) for directly or indirectly misrepresenting or withholding material facts relating to a relevant matter that induces or could induce an error in the administration of this Act...",
        note: "Démontrer par déclaration solennelle du candidat que l'omission ne portait pas sur un fait important et n'était pas de nature à induire en erreur l'administration.",
        sortOrder: 1,
        addedAt: "2026-07-22"
      }
    ]
  }
]
