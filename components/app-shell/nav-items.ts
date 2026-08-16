import { LayoutDashboard, Users, FolderOpen, Calendar, FileText, Settings, Building2, Files, FileSignature, AlertTriangle, BookOpen, PenLine, KeyRound, ClipboardList, Landmark } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  labelKey: string
  href: string
  icon: LucideIcon
}

export const MAIN_NAV: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "deadlines", href: "/deadlines", icon: AlertTriangle },
  { labelKey: "calendar", href: "/calendar", icon: Calendar },
  { labelKey: "clients", href: "/clients", icon: Users },
  { labelKey: "matters", href: "/matters", icon: FolderOpen },
  { labelKey: "questionnaires", href: "/questionnaires", icon: ClipboardList },
  { labelKey: "agreements", href: "/agreements", icon: FileSignature },
  { labelKey: "documents", href: "/documents", icon: Files },
  { labelKey: "signatures", href: "/signatures", icon: PenLine },
  { labelKey: "research", href: "/research", icon: BookOpen },
  { labelKey: "pipeline", href: "/pipeline", icon: Building2 },
]

export const OTHER_NAV: NavItem[] = [
  { labelKey: "billing", href: "/billing", icon: FileText },
  { labelKey: "trust", href: "/fideicommis", icon: Landmark },
  { labelKey: "portal", href: "/portal", icon: KeyRound },
  // L'ENTRÉE « CONNECTEUR IA » A ÉTÉ RETIRÉE le 16 août 2026, en attendant que
  // le connecteur fasse quelque chose.
  //
  // Tout l'appareil de sécurité existe et il est bon : clés hachées et
  // révocables, journal en ajout seul, cloisonnement par cabinet, et surtout
  // quatre actes — finaliser, envoyer, signer, annuler — réservés à un humain
  // par `connector_authorize()`, donc inopposables même à un appel qui
  // contournerait entièrement cette application.
  //
  // Ce qui manque, c'est le muscle. `GET /agreements` répond `data: []` avec
  // une note disant que la table des ententes n'existe pas encore — un
  // commentaire devenu faux, la table existe et porte des lignes. `/mcp-schema`
  // annonce un « serveur MCP officiel pour Claude Desktop » qui n'implémente ni
  // JSON-RPC, ni `initialize`, ni `tools/call` : rien ne peut s'y connecter. Et
  // deux des quatre outils annoncés n'ont aucune route.
  //
  // Un écran qui délivre une clé menant à une liste toujours vide coûte plus
  // cher qu'il ne rapporte : il se démontre mal, il inquiète, et il laisse
  // croire que le reste du logiciel promet au-delà de ce qu'il tient.
  //
  // Les routes `/api/v1/connector/*` restent en place et gardées : les retirer
  // n'apporterait rien et compliquerait la reprise. Seul le chemin d'accès
  // disparaît de l'interface.
  { labelKey: "settings", href: "/settings", icon: Settings },
]
