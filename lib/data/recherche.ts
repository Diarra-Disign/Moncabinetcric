import "server-only"

import { getClients, getMatters, getDocuments, getInvoices } from "./queries"

/**
 * Ce que la recherche du cabinet peut trouver.
 *
 * POURQUOI CETTE FONCTION EXISTE. Deux écrans portaient chacun leur propre
 * liste : la barre du haut la construisait dans le gabarit, à partir des
 * vraies données ; le tableau de bord la déclarait comme une constante
 * `SEARCH_DATABASE` qui, une fois les données de démonstration retirées,
 * valait le tableau VIDE. Le champ du tableau de bord répondait donc
 * « aucun dossier ou client trouvé » quoi qu'on tape — pour un utilisateur,
 * une recherche cassée.
 *
 * Le défaut n'était pas le tableau vide : c'était d'avoir deux listes pour la
 * même question. La seconde pouvait se vider sans que la première le dise.
 */

export interface ResultatRecherche {
  id: string
  title: string
  subtitle: string
  type: "matter" | "client" | "document"
  href: string
}

export async function construireRecherche(): Promise<ResultatRecherche[]> {
  const [clients, matters, documents, invoices] = await Promise.all([
    getClients(), getMatters(), getDocuments(), getInvoices(),
  ])

  // Le dossier d'un client, quand il en a un : c'est là que le consultant
  // veut aller en cherchant un nom. Sans lui, on retombe sur le répertoire.
  const dossierDuClient = new Map<string, string>()
  for (const m of matters) {
    if (m.clientId && !dossierDuClient.has(m.clientId)) {
      dossierDuClient.set(m.clientId, m.id.replace("#", ""))
    }
  }

  return [
    ...clients.map((c) => {
      const dossier = c.id ? dossierDuClient.get(c.id) : undefined
      return {
        // Les identifiants d'entités différentes peuvent coïncider ; le
        // préfixe garantit une clé de rendu unique dans la liste combinée.
        id: `client-${c.id}`,
        title: c.name,
        subtitle: `${c.fileNumber}${c.program ? ` · ${c.program}` : ""}`,
        type: "client" as const,
        href: dossier ? `/matters/${dossier}` : "/clients",
      }
    }),
    ...matters.map((m) => ({
      id: `matter-${m.id}`,
      title: m.clientName,
      subtitle: `${m.id}${m.program ? ` · ${m.program}` : ""}`,
      type: "matter" as const,
      href: `/matters/${m.id.replace("#", "")}`,
    })),
    ...documents.map((d) => ({
      id: `doc-${d.id}`,
      title: d.name || d.type,
      subtitle: d.clientName ? `${d.clientName} · ${d.uploadedBy}` : d.uploadedBy,
      type: "document" as const,
      href: "/documents",
    })),
    ...invoices.map((i) => ({
      id: `invoice-${i.id}`,
      title: `Facture ${i.invoiceNumber}`,
      subtitle: `${i.clientName} · ${i.amount} $ CAD`,
      type: "matter" as const,
      href: "/billing",
    })),
  ]
}
