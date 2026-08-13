/**
 * Le recensement du décor d'épreuve — et pourquoi on ne peut pas l'effacer.
 *
 * ─── CE QUI A ÉTÉ CONSTATÉ ─────────────────────────────────────────────────
 *
 * Au 13 août, la base portait 90 cabinets pour 3 réels. Chaque script de
 * vérification fabrique un cabinet et le supprime dans un `finally` en
 * annonçant « Cabinet et compte d'épreuve supprimés ». Aucun n'avait jamais
 * rien supprimé : ils appellent `.delete()` sans regarder l'erreur, et
 * impriment leur phrase quoi qu'il arrive.
 *
 * ─── LA CAUSE, ET POURQUOI ELLE EST BONNE ──────────────────────────────────
 *
 *     P0001 — Le journal d'audit est en ajout seul :
 *             une entrée ne peut être ni modifiée ni supprimée.
 *
 * `audit_logs.firm_id` cascade depuis `firms`. Supprimer un cabinet revient
 * donc à effacer ses entrées d'audit, et le déclencheur d'inaltérabilité s'y
 * oppose — comme il doit. Un cabinet dont on peut effacer le journal en
 * effaçant le cabinet n'a pas de journal : c'est précisément la manœuvre que
 * la tenue de dossiers exige d'empêcher.
 *
 * Ce module ne contourne donc RIEN. Il recense, il efface ce qui peut l'être
 * — les comptes d'authentification, que rien ne protège — et il rapporte le
 * refus mot pour mot pour tout le reste. Décider du sort des cabinets
 * d'épreuve suppose de trancher ce qu'on fait de leurs journaux : cela ne se
 * décide pas dans un script de ménage.
 *
 * ─── LE CRITÈRE ────────────────────────────────────────────────────────────
 *
 * Pas le nom du cabinet : les scripts en emploient de vrais — « DGV
 * Immigration », « Cabinet Boréale » — et un balayage par nom finirait par
 * emporter le cabinet qu'il imite.
 *
 * Le courriel. La RFC 2606 réserve `.invalid`, `.example`, `.test` et
 * `.localhost` : l'IANA ne les délègue à personne, ils ne peuvent PAS être
 * enregistrés, donc aucune adresse réelle n'en porte. Un cabinet dont le
 * courriel s'y termine est nécessairement fabriqué. C'est un critère de
 * définition, pas une heuristique.
 *
 * Reste une garde de temps, pour une autre raison : deux scripts lancés en
 * parallèle. Le second ne doit pas emporter le décor que le premier emploie.
 */

/** Les domaines que l'IANA ne délègue à personne. RFC 2606, §2 et §3. */
const RESERVES = /@(?:[^@\s]+\.)?(?:invalid|example|test|localhost)$/i

/** Un courriel qui ne peut appartenir à personne de réel. */
export const estJetable = (courriel) => RESERVES.test(String(courriel ?? "").trim())

/** Recense les dépouilles sans rien supprimer. */
export async function recenser(admin, { minutes = 10 } = {}) {
  const limite = new Date(Date.now() - minutes * 60_000).toISOString()

  const { data: firms, error } = await admin
    .from("firms").select("id, name, email, rcic_license_number, created_at")
  if (error) throw new Error(`Lecture des cabinets impossible : ${error.message}`)

  const cabinets = (firms ?? []).filter(
    (f) => estJetable(f.email) && String(f.created_at ?? "") < limite
  )

  // Les comptes d'authentification fuient par le même chemin, mais rien ne les
  // protège : eux s'effacent vraiment. Les laisser retiendrait leur adresse, et
  // un script qui réemploie la même la verrait refusée.
  const { data: u } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const comptes = (u?.users ?? []).filter(
    (x) => estJetable(x.email) && String(x.created_at ?? "") < limite
  )

  return { cabinets, comptes, gardes: (firms ?? []).length - cabinets.length }
}

/**
 * Efface ce qui peut l'être, et rapporte le reste.
 *
 * LES ERREURS SONT RENDUES, JAMAIS AVALÉES. C'est tout le sujet : une
 * suppression qui échoue en silence est ce qui a laissé croire, pendant des
 * jours, que le nettoyage fonctionnait. `refuses` porte le message de la base,
 * tel quel — celui que personne n'avait lu.
 */
export async function balayer(admin, options = {}) {
  const { cabinets, comptes } = await recenser(admin, options)
  const refuses = []
  let effacesCabinets = 0
  let effacesComptes = 0

  for (const f of cabinets) {
    // PAS UN `.delete()`. Il échouait pour tout le monde depuis des semaines :
    // `audit_logs` cascade depuis `firms`, et le déclencheur d'inaltérabilité
    // refusait la cascade. `purger_cabinet_epreuve()` est la seule porte, et
    // elle REVÉRIFIE elle-même le courriel — le critère appliqué ici n'est
    // donc pas le dernier rempart, seulement le premier.
    const { data, error } = await admin.rpc("purger_cabinet_epreuve", { p_firm_id: f.id })
    if (error) refuses.push({ quoi: `cabinet « ${f.name} »`, code: error.code, message: error.message })
    else if (data !== true) {
      refuses.push({
        quoi: `cabinet « ${f.name} »`, code: "refus",
        message: "la base refuse : courriel hors des domaines réservés par la RFC 2606",
      })
    } else effacesCabinets++
  }
  for (const c of comptes) {
    const { error } = await admin.auth.admin.deleteUser(c.id)
    if (error) refuses.push({ quoi: `compte ${c.email}`, code: error.code ?? "", message: error.message })
    else effacesComptes++
  }

  return {
    tentes: { cabinets: cabinets.length, comptes: comptes.length },
    effaces: { cabinets: effacesCabinets, comptes: effacesComptes },
    refuses,
  }
}
