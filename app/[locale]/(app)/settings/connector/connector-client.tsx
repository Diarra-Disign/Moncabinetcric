"use client"

import * as React from "react"
import { 
  Bot, 
  Key, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  ExternalLink, 
  Sparkles, 
  Plus, 
  Trash2, 
  RefreshCw, 
  FileText, 
  HelpCircle,
  Code2,
  Terminal,
  Ban,
  Check,
  Zap,
  BookOpen
} from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { AiConnectorSettings, AiApiKeyRecord, AiConnectorLogRecord } from "@/lib/data/types"
import { toggleAiConnector, generateAiApiKey, revokeAiApiKey } from "@/lib/data/actions"

interface ConnectorClientProps {
  initialSettings: AiConnectorSettings
  initialApiKeys: AiApiKeyRecord[]
  initialLogs: AiConnectorLogRecord[]
}

export function ConnectorClient({
  initialSettings,
  initialApiKeys,
  initialLogs
}: ConnectorClientProps) {
  const [settings, setSettings] = React.useState<AiConnectorSettings>(initialSettings)
  const [apiKeys, setApiKeys] = React.useState<AiApiKeyRecord[]>(initialApiKeys)
  const [logs, setLogs] = React.useState<AiConnectorLogRecord[]>(initialLogs)

  const [notice, setNotice] = React.useState<string | null>(null)
  const [showKeyModal, setShowKeyModal] = React.useState(false)
  const [newKeyName, setNewKeyName] = React.useState("")
  const [copiedText, setCopiedText] = React.useState<string | null>(null)
  const [newlyCreatedKey, setNewlyCreatedKey] = React.useState<string | null>(null)

  const handleToggleConnector = async (newVal: boolean) => {
    setSettings(prev => ({ ...prev, enabled: newVal, enabledAt: newVal ? new Date().toISOString() : undefined }))
    await toggleAiConnector(newVal)
    setNotice(newVal ? "✅ Connecteur IA activé par le Propriétaire. L'assistant peut interagir avec votre compte réél." : "🛑 Connecteur IA désactivé. Tous les appels externes sont maintenant bloqués.")
    setTimeout(() => setNotice(null), 5000)
  }

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) return

    if (!settings.enabled) {
      setSettings(prev => ({ ...prev, enabled: true, enabledAt: new Date().toISOString() }))
      await toggleAiConnector(true)
    }

    const key = await generateAiApiKey(newKeyName, "m-owner-01", "Me Adama Diarra (Owner)")
    setApiKeys(prev => [key, ...prev])
    setNewlyCreatedKey(`${key.keyPrefix}_${Math.random().toString(36).substring(2, 18)}`)
    setShowKeyModal(false)
    setNewKeyName("")
    setNotice(`🔑 Clé API "${key.name}" générée avec succès et Connecteur IA activé !`)
    setTimeout(() => setNotice(null), 6000)
  }

  const [keyToRevoke, setKeyToRevoke] = React.useState<{ id: string; name: string } | null>(null)

  const handleRevokeKey = (id: string, name: string) => {
    setKeyToRevoke({ id, name })
  }

  const confirmRevokeKey = async () => {
    if (!keyToRevoke) return
    const { id, name } = keyToRevoke
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: false } : k))
    await revokeAiApiKey(id)
    setNotice(`🚫 Clé API "${name}" révoquée.`)
    setKeyToRevoke(null)
    setTimeout(() => setNotice(null), 5000)
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(label)
    setTimeout(() => setCopiedText(null), 3000)
  }

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <PageHeader
        title="Connecteur IA (ChatGPT / Claude Connector)"
        subtitle="Connectez votre assistant IA externe (ChatGPT Custom GPT, Claude Desktop MCP) à votre compte réél."
        badgeText={settings.enabled ? "CONNECTEUR IA ACTIF" : "DÉSACTIVÉ PAR DÉFAUT"}
        badgeVariant={settings.enabled ? "emerald" : "amber"}
      />

      {/* NOTICE BANNER */}
      {notice && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-white font-mono">✕</button>
        </div>
      )}

      {/* BANNIÈRE GOUVERNANCE ET ACTES RÉSERVÉS */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/30 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-black shadow-md shrink-0">
            <Bot className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Assistant IA en Mode Compte Réél (Sans Copier-Coller)</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                CICC Ready — Hard Safety Gate
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              L&apos;IA prépare les brouillons, ajoute les personnes, les services et les débours du catalogue officiel. <strong className="text-amber-300">Finaliser, envoyer, signer et annuler sont délibérément bloqués (HTTP 403)</strong> et demeurent réservés à un consultant humain.
            </p>
          </div>
        </div>

        {/* INTERRUPTEUR DE ACTIVATION DU PROPRIÉTAIRE */}
        <div className="flex items-center gap-4 bg-slate-800/80 p-3 px-4 rounded-2xl border border-slate-700 shrink-0">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">Statut Propriétaire</div>
            <div className="text-xs font-black text-white">{settings.enabled ? "CONNECTEUR ACTIF" : "INACTIF"}</div>
          </div>
          <button
            type="button"
            onClick={() => handleToggleConnector(!settings.enabled)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
              settings.enabled ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {settings.enabled ? "Désactiver le Connecteur" : "Activer le Connecteur"}
          </button>
        </div>
      </div>

      {/* RÉSULTAT NOUVELLE CLÉ GÉNÉRÉE */}
      {newlyCreatedKey && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-3xl p-6 shadow-md space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-black text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-700" />
              Copiez votre nouvelle clé API dès maintenant (Elle ne sera plus réaffichée) :
            </span>
            <button type="button" onClick={() => setNewlyCreatedKey(null)} className="text-amber-700 font-mono font-bold">✕</button>
          </div>
          <div className="flex items-center gap-3">
            <code className="p-3 bg-white border border-amber-300 rounded-xl font-mono text-xs font-bold text-slate-900 flex-1 break-all">
              {newlyCreatedKey}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(newlyCreatedKey, "key")}
              className="px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Copy className="w-4 h-4" />
              <span>{copiedText === "key" ? "Copié !" : "Copier"}</span>
            </button>
          </div>
        </div>
      )}

      {/* GRILLE : GARDE-FOUS CICC (ACTIONS AUTORISÉES vs BLOQUÉES) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Colonne Autorisée */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">7 Actions Autorisées à l&apos;Assistant IA</h3>
              <p className="text-[11px] text-slate-500">Travail préparatoire d&apos;assistance</p>
            </div>
          </div>

          <ul className="space-y-2 text-xs text-slate-700 font-medium">
            <li className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Lister les ententes</strong> (<code className="text-[10px] font-mono text-indigo-600">GET /agreements</code>)</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Ouvrir un brouillon</strong> (<code className="text-[10px] font-mono text-indigo-600">POST /agreements/draft</code>)</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Ajouter des personnes</strong> (<code className="text-[10px] font-mono text-indigo-600">POST /persons</code>)</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Ajouter des services d&apos;honoraires</strong> (<code className="text-[10px] font-mono text-indigo-600">POST /services</code>)</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Ajouter débours du catalogue tenu à jour</strong> (IRCC / MIFI)</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Lancer la validation CICC</strong> (<code className="text-[10px] font-mono text-indigo-600">POST /validate</code>)</span>
            </li>
            <li className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span><strong>Demander une révision / analyse IA</strong> (<code className="text-[10px] font-mono text-indigo-600">POST /ai-review</code>)</span>
            </li>
          </ul>
        </div>

        {/* Colonne Bloquée (Actes Réservés) */}
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">4 Actes Réservés aux Humains (Strict 403 Forbidden)</h3>
              <p className="text-[11px] text-slate-400">Exclus délibérément du connecteur API</p>
            </div>
          </div>

          <ul className="space-y-2.5 text-xs text-slate-300 font-medium">
            <li className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-bold text-white">1. Finaliser une entente</span>
              </div>
              <span className="font-mono text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold">403 Forbidden</span>
            </li>
            <li className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-bold text-white">2. Envoyer l&apos;entente au client</span>
              </div>
              <span className="font-mono text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold">403 Forbidden</span>
            </li>
            <li className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-bold text-white">3. Signer / Contresigner</span>
              </div>
              <span className="font-mono text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold">403 Forbidden</span>
            </li>
            <li className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-bold text-white">4. Annuler / Résilier l&apos;entente</span>
              </div>
              <span className="font-mono text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold">403 Forbidden</span>
            </li>
          </ul>
        </div>

      </div>

      {/* GESTION DES CLÉS API & PERMISSIONS */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Clés API Actives du Cabinet</h3>
            <p className="text-xs text-slate-500">Chaque clé est liée à un membre du cabinet et autorisée individuellement par le Propriétaire.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Générer une Clé API</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-black uppercase text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nom de l&apos;Intégration</th>
                <th className="py-3 px-4">Préfixe Clé</th>
                <th className="py-3 px-4">Membre Titulaire</th>
                <th className="py-3 px-4">Date Création</th>
                <th className="py-3 px-4">Dernier Usage</th>
                <th className="py-3 px-4 text-right">Statut & Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {apiKeys.map(k => (
                <tr key={k.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{k.name}</td>
                  <td className="py-3.5 px-4 font-mono text-indigo-600 font-bold">{k.keyPrefix}...</td>
                  <td className="py-3.5 px-4 text-slate-700">{k.createdForMemberName}</td>
                  <td className="py-3.5 px-4 text-slate-500">{k.createdAt}</td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono">{k.lastUsedAt || "Jamais"}</td>
                  <td className="py-3.5 px-4 text-right">
                    {k.isActive ? (
                      <button
                        type="button"
                        onClick={() => handleRevokeKey(k.id, k.name)}
                        className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        Révoquer
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Révoquée</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* GUIDE D'INSTALLATION RCICAPP.CA/CONNECTOR */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Guide d&apos;Installation Pas-à-Pas (rcicapp.ca/connector)</h3>
              <p className="text-xs text-slate-400">Schémas prêts à être copiés dans ChatGPT ou Claude Desktop MCP Server.</p>
            </div>
          </div>
          <span className="font-mono text-xs text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-400/20 px-3 py-1 rounded-full">
            Documentation Officielle
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option 1 : ChatGPT Custom GPT */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <strong className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                1. Pour ChatGPT Custom GPT
              </strong>
              <button
                type="button"
                onClick={() => copyToClipboard("http://localhost:3000/api/v1/connector/openapi.json", "openapi")}
                className="text-[10px] font-bold text-indigo-300 hover:text-white underline cursor-pointer"
              >
                {copiedText === "openapi" ? "URL Copiée !" : "Copier URL Schema"}
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Dans ChatGPT (Éditeur de GPT personnalisé) ➔ <strong>Actions</strong> ➔ <strong>Import from URL</strong> ➔ Coller le lien ci-dessous :
            </p>
            <code className="block p-2.5 bg-slate-950 rounded-xl font-mono text-[10px] text-emerald-300 break-all border border-slate-800">
              http://localhost:3000/api/v1/connector/openapi.json
            </code>
          </div>

          {/* Option 2 : Claude Desktop MCP Server */}
          <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <strong className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                2. Pour Claude Desktop (MCP Server)
              </strong>
              <button
                type="button"
                onClick={() => copyToClipboard("http://localhost:3000/api/v1/connector/mcp-schema", "mcp")}
                className="text-[10px] font-bold text-indigo-300 hover:text-white underline cursor-pointer"
              >
                {copiedText === "mcp" ? "URL Copiée !" : "Copier URL Manifeste MCP"}
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Dans votre fichier de configuration <code className="text-indigo-300 font-mono">claude_desktop_config.json</code>, ajoutez l&apos;URL du serveur MCP :
            </p>
            <code className="block p-2.5 bg-slate-950 rounded-xl font-mono text-[10px] text-indigo-300 break-all border border-slate-800">
              http://localhost:3000/api/v1/connector/mcp-schema
            </code>
          </div>
        </div>
      </div>

      {/* LIVE AUDIT LOG DES REQUÊTES IA */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900">Journal d&apos;Audit Cryptographique SHA-256 (Appels IA)</h3>
            <p className="text-xs text-slate-500">Chaque appel API de l&apos;assistant externe est consigné de manière inaltérable.</p>
          </div>
          <span className="font-mono text-xs text-slate-400">{logs.length} événements enregistrés</span>
        </div>

        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                    log.status === "success" ? "bg-emerald-100 text-emerald-900" :
                    log.status === "forbidden_reserved" ? "bg-rose-100 text-rose-900" :
                    "bg-amber-100 text-amber-900"
                  }`}>
                    {log.status === "success" ? "200 OK" : log.status === "forbidden_reserved" ? "403 Bloqué CICC" : "403 Inactif"}
                  </span>
                  <strong className="font-bold text-slate-900">{log.action}</strong>
                  <span className="text-[10px] font-mono text-slate-400">({log.apiKeyPrefix})</span>
                </div>
                <p className="text-slate-600">{log.summary}</p>
              </div>

              <div className="text-right shrink-0">
                <div className="font-mono text-[10px] text-slate-500">{new Date(log.occurredAt).toLocaleString("fr-CA")}</div>
                <div className="font-mono text-[9px] text-slate-400">Hash: {log.rowHash.substring(0, 16)}...</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL GENERER CLE API */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Générer une Clé API IA</h3>
              <button type="button" onClick={() => setShowKeyModal(false)} className="w-8 h-8 rounded-full bg-slate-100 font-bold flex items-center justify-center">✕</button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nom de l&apos;Intégration / Usage</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: ChatGPT Custom GPT - Me Diarra"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Membre Titulaire</label>
                <input
                  type="text"
                  readOnly
                  value="Me Adama Diarra (RCIC #R-514982)"
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowKeyModal(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">Annuler</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-900 text-white font-bold hover:bg-indigo-950 shadow-md">Générer la Clé</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SUR-MESURE DE CONFIRMATION DE RÉVOCATION (Design MonCabinetCRIC) */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setKeyToRevoke(null)}>
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center gap-5" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Ban className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Confirmer la Révocation</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Voulez-vous vraiment révoquer la clé API <strong className="text-slate-900 font-mono">&quot;{keyToRevoke.name}&quot;</strong> ?
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                L&apos;assistant IA configuré avec cette clé ne pourra plus accéder à votre compte.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 w-full pt-2">
              <button
                type="button"
                onClick={() => setKeyToRevoke(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={confirmRevokeKey}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Révoquer la Clé
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
