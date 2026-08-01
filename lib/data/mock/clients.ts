import { ClientRecord } from "../types"

export const MOCK_CLIENTS: ClientRecord[] = [
  {
    id: "c-1",
    fileNumber: "CRIC-2026-0101",
    name: "M. A. Diarra",
    email: "adiarra@consulting.ca",
    phone: "+1 (514) 555-0101",
    citizenship: "Mali",
    residence: "Canada",
    province: "Québec",
    program: "Résidence Permanente (PEQ)",
    status: "active",
    intakeMotif: "Diplômé universitaire du Québec, expérience de travail 12 mois."
  },
  {
    id: "c-2",
    fileNumber: "CRIC-2026-0102",
    name: "Dr. S. Rahman",
    email: "s.rahman@medtech.ca",
    phone: "+1 (514) 555-0144",
    citizenship: "Tunisie",
    residence: "Canada",
    province: "Ontario",
    program: "Entrée Express (Catégorie Santé)",
    status: "active",
    intakeMotif: "Ingénieur biomédical avec offre d'emploi validée en Ontario."
  },
  {
    id: "c-3",
    fileNumber: "CRIC-2026-0103",
    name: "Mme. K. Dubois",
    email: "k.dubois@gmail.com",
    phone: "+33 6 12 34 56 78",
    citizenship: "France",
    residence: "France",
    program: "Permis d'études + CAQ",
    status: "consultation",
    intakeMotif: "Admission à l'Université de Montréal pour la rentrée d'automne."
  },
  {
    id: "c-4",
    fileNumber: "CRIC-2026-0104",
    name: "M. G. Bouchard (Les Industries Nordiques)",
    email: "rh@industriesnordiques.ca",
    phone: "+1 (819) 555-0192",
    citizenship: "Canada (Employeur)",
    residence: "Canada",
    province: "Québec",
    program: "EIMT - 12 Postes Agroalimentaires",
    status: "active",
    intakeMotif: "Recrutement collectif en agroalimentaire — Outaouais."
  }
]
