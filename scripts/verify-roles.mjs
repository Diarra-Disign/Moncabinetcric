#!/usr/bin/env node
/**
 * Éprouve la matrice de droits directement dans la base.
 *
 *   node scripts/verify-roles.mjs
 *
 * Ne teste pas ce que l'interface affiche, mais ce que la base autorise :
 * chaque sonde se fait passer pour un utilisateur donné en fixant les
 * revendications JWT, puis tente une opération réelle. Tout se déroule dans
 * une transaction annulée à la fin — rien n'est écrit.
 *
 * C'est la seule vérification qui vaille : masquer un bouton ne protège
 * rien, une politique RLS si.
 *
 * Piège à connaître : sous RLS, un DELETE ou un UPDATE refusé ne lève
 * aucune erreur — il porte simplement sur zéro ligne et réussit. Une sonde
 * naïve conclurait « autorisé ». Les sondes de suppression et de
 * modification vérifient donc FOUND, seul verdict fiable.
 *
 * Nécessite le jeton d'API de gestion configuré pour le MCP Supabase.
 */

import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

const OK = "\x1b[32m✓\x1b[0m"
const KO = "\x1b[31m✗\x1b[0m"

async function makeQuery() {
  const cfg = JSON.parse(await readFile(join(homedir(), ".gemini/config/mcp_config.json"), "utf8"))
  const sb = (cfg.mcpServers ?? cfg.servers ?? {}).supabase
  if (!sb?.headers?.Authorization) throw new Error("Jeton d'API de gestion introuvable.")
  const token = sb.headers.Authorization.replace(/^Bearer\s+/i, "")
  const ref = sb.serverUrl.match(/project_ref=([a-z0-9]+)/)?.[1]
  if (!ref) throw new Error("project_ref introuvable.")

  return async (sql) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    })
    const text = await r.text()
    if (!r.ok) throw new Error(`HTTP ${r.status} — ${text.slice(0, 300)}`)
    return JSON.parse(text)
  }
}

/**
 * Sonde unique : se fait passer pour `userId`, tente `statement`, et dit si
 * l'opération a été autorisée. Le bloc exception fait office de point de
 * reprise : une politique qui refuse lève, et l'on capte le refus.
 */
function probeSql(userId, statement) {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" }).replace(/'/g, "''")
  return `
    do $probe$
    declare allowed boolean := false;
    begin
      perform set_config('role', 'authenticated', true);
      perform set_config('request.jwt.claims', '${claims}', true);
      begin
        ${statement}
        allowed := true;
      exception when others then
        allowed := false;
      end;
      perform set_config('role', 'postgres', true);
      insert into _probe_results(allowed) values (allowed);
    end
    $probe$;`
}

async function main() {
  const query = await makeQuery()

  const people = await query(`
    select p.email, p.cicc_role as role, p.user_id::text, p.firm_id::text
    from public.profiles p
    union all
    select a.email, 'platform_admin', a.user_id::text, null
    from public.platform_admins a
  `)

  const by = (role) => people.find((p) => p.role === role)
  const owner = by("owner")
  const rcic = by("rcic")
  const padmin = by("platform_admin")

  if (!owner) throw new Error("Aucun profil owner : lancer setup-accounts.mjs d'abord.")

  /**
   * Chaque cas dit qui agit, ce qu'il tente, et ce qui doit se produire.
   * `expected: false` signifie « la base doit refuser ».
   */
  const cases = [
    {
      who: owner,
      label: "owner lit ses clients",
      sql: `perform 1 from public.clients limit 1;`,
      expected: true,
    },
    {
      who: owner,
      label: "owner crée un client",
      sql: `insert into public.clients(firm_id, file_number, name, email)
            values ('${owner.firm_id}', 'PROBE-1', 'Sonde', 'probe@example.invalid');`,
      expected: true,
    },
    {
      who: owner,
      label: "owner supprime un client",
      sql: `delete from public.clients where file_number = 'PROBE-1';
            if not found then raise exception 'aucune ligne supprimée'; end if;`,
      expected: true,
    },
    {
      who: owner,
      label: "owner modifie son cabinet",
      sql: `update public.firms set phone = phone where id = '${owner.firm_id}';
            if not found then raise exception 'aucune ligne modifiée'; end if;`,
      expected: true,
    },
    rcic && {
      who: rcic,
      label: "rcic d'un AUTRE cabinet lit les clients du premier",
      sql: `perform 1 from public.clients where firm_id = '${owner.firm_id}' limit 1;
            if not found then raise exception 'aucune ligne visible'; end if;`,
      expected: false,
    },
    rcic && {
      who: rcic,
      label: "rcic d'un AUTRE cabinet écrit dans le premier",
      sql: `insert into public.clients(firm_id, file_number, name, email)
            values ('${owner.firm_id}', 'PROBE-X', 'Intrus', 'x@example.invalid');`,
      expected: false,
    },
    padmin && {
      who: padmin,
      label: "administrateur plateforme lit les clients",
      sql: `perform 1 from public.clients limit 1;
            if not found then raise exception 'aucune ligne visible'; end if;`,
      expected: false,
    },
    padmin && {
      who: padmin,
      label: "administrateur plateforme lit les cabinets",
      sql: `perform 1 from public.firms limit 1;
            if not found then raise exception 'aucun cabinet visible'; end if;`,
      expected: true,
    },
    padmin && {
      who: padmin,
      label: "administrateur plateforme lit le journal d'audit",
      sql: `perform 1 from public.audit_logs limit 1;
            if not found then raise exception 'aucune ligne visible'; end if;`,
      expected: false,
    },

    // Rôles éprouvés dans UN MÊME cabinet : c'est là que se joue la
    // question « qui peut créer ou supprimer quoi ». On bascule
    // temporairement le rôle du second compte et on le rattache au cabinet
    // du premier ; la transaction est annulée, rien ne subsiste.
    rcic && {
      who: rcic,
      pre: `update public.profiles set firm_id = '${owner.firm_id}', cicc_role = 'readonly' where user_id = '${rcic.user_id}';`,
      label: "readonly lit les clients",
      sql: `perform 1 from public.clients limit 1;
            if not found then raise exception 'rien de visible'; end if;`,
      expected: true,
    },
    rcic && {
      who: rcic,
      pre: `update public.profiles set cicc_role = 'readonly' where user_id = '${rcic.user_id}';`,
      label: "readonly crée un client",
      sql: `insert into public.clients(firm_id, file_number, name, email)
            values ('${owner.firm_id}', 'PROBE-RO', 'Interdit', 'ro@example.invalid');`,
      expected: false,
    },
    rcic && {
      who: rcic,
      pre: `update public.profiles set cicc_role = 'readonly' where user_id = '${rcic.user_id}';`,
      label: "readonly supprime un client",
      sql: `delete from public.clients where file_number = 'PROBE-SEED';
            if not found then raise exception 'aucune ligne supprimée'; end if;`,
      expected: false,
    },
    rcic && {
      who: rcic,
      pre: `update public.profiles set cicc_role = 'staff' where user_id = '${rcic.user_id}';`,
      label: "staff crée un client",
      sql: `insert into public.clients(firm_id, file_number, name, email)
            values ('${owner.firm_id}', 'PROBE-ST', 'Personnel', 'st@example.invalid');`,
      expected: true,
    },
    rcic && {
      who: rcic,
      pre: `update public.profiles set cicc_role = 'staff' where user_id = '${rcic.user_id}';`,
      label: "staff supprime un client",
      sql: `delete from public.clients where file_number = 'PROBE-SEED';
            if not found then raise exception 'aucune ligne supprimée'; end if;`,
      expected: false,
    },
    rcic && {
      who: rcic,
      pre: `update public.profiles set cicc_role = 'bookkeeper' where user_id = '${rcic.user_id}';`,
      label: "teneur de livres crée une facture",
      sql: `insert into public.invoices(firm_id, invoice_number, client_name, amount, status)
            values ('${owner.firm_id}', 'PROBE-INV', 'Sonde', 1, 'pending');`,
      expected: true,
    },
    rcic && {
      who: rcic,
      pre: `update public.profiles set cicc_role = 'bookkeeper' where user_id = '${rcic.user_id}';`,
      label: "teneur de livres crée un client",
      sql: `insert into public.clients(firm_id, file_number, name, email)
            values ('${owner.firm_id}', 'PROBE-BK', 'Interdit', 'bk@example.invalid');`,
      expected: false,
    },
    rcic && {
      who: rcic,
      pre: `update public.profiles set cicc_role = 'staff' where user_id = '${rcic.user_id}';`,
      label: "staff se promeut propriétaire",
      sql: `update public.profiles set cicc_role = 'owner' where user_id = '${rcic.user_id}';
            if not found then raise exception 'aucune ligne modifiée'; end if;`,
      expected: false,
    },
  ].filter(Boolean)

  // Une donnée témoin est nécessaire pour que « lire » ait un sens : sans
  // ligne, un refus et un ensemble vide se ressemblent.
  const setup = `
    create temp table _probe_results(allowed boolean);
    insert into public.clients(firm_id, file_number, name, email)
      values ('${owner.firm_id}', 'PROBE-SEED', 'Témoin', 'seed@example.invalid');
    insert into public.audit_logs(firm_id, actor, action, target, details, status, row_hash)
      values ('${owner.firm_id}', 'sonde', 'create', 'probe', 'témoin', 'success', 'probe');
  `

  const all = [
    setup,
    ...cases.flatMap((c) => (c.pre ? [c.pre, probeSql(c.who.user_id, c.sql)] : [probeSql(c.who.user_id, c.sql)])),
    "select allowed from _probe_results;",
  ]
  const results = await query(`begin;\n${all.join("\n")}\nrollback;`)

  console.log("\nMatrice de droits — éprouvée en base, transaction annulée\n")
  let failures = 0
  cases.forEach((c, i) => {
    const allowed = results[i]?.allowed ?? results?.[i]
    const got = typeof allowed === "boolean" ? allowed : Boolean(allowed)
    const ok = got === c.expected
    if (!ok) failures++
    const verdict = got ? "autorisé" : "refusé"
    const want = c.expected ? "autorisé" : "refusé"
    console.log(
      `  ${ok ? OK : KO} ${c.label.padEnd(52)} ${verdict.padEnd(9)}${ok ? "" : `  (attendu : ${want})`}`
    )
  })

  console.log("\n" + "─".repeat(74))
  console.log(
    failures === 0
      ? "\x1b[32mLa matrice est respectée.\x1b[0m"
      : `\x1b[31m${failures} écart(s).\x1b[0m`
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(2)
})
