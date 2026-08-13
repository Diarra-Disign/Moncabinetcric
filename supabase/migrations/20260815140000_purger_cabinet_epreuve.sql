-- ---------------------------------------------------------------------------
-- Supprimer un cabinet d'ÉPREUVE, journal compris
-- ---------------------------------------------------------------------------
--
-- LISEZ CECI AVANT DE TOUCHER À CE FICHIER. Il ouvre la seule brèche qui
-- existe dans l'inaltérabilité du journal d'audit. Elle est étroite par
-- construction, et chacune de ses bornes est là pour une raison.
--
-- ─── POURQUOI UNE BRÈCHE ───────────────────────────────────────────────────
--
-- 90 cabinets s'étaient accumulés en base pour 3 réels. Chaque script
-- d'épreuve fabrique un cabinet et le supprime dans son `finally` — sauf
-- qu'aucune de ces suppressions n'a jamais abouti : `audit_logs` cascade
-- depuis `firms`, et le déclencheur d'inaltérabilité refusait la cascade.
-- Les scripts n'ont jamais regardé l'erreur, et annonçaient « supprimé »
-- depuis des semaines.
--
-- ─── LES QUATRE BORNES ─────────────────────────────────────────────────────
--
-- 1. LA MODIFICATION RESTE IMPOSSIBLE. La brèche ne s'ouvre que sur DELETE.
--    Un UPDATE sur `audit_logs` est refusé comme avant, sans exception et
--    quel que soit le rôle. Réécrire une ligne d'histoire est une falsification ;
--    retirer un locataire d'épreuve entier n'en est pas une. Ce n'est pas la
--    même opération, et elles ne doivent pas partager la même porte.
--
-- 2. LE COURRIEL DÉCIDE, ET IL NE PEUT PAS MENTIR. La fonction refuse tout
--    cabinet dont le courriel n'est pas dans un domaine que la RFC 2606
--    réserve : `.invalid`, `.example`, `.test`, `.localhost`. L'IANA ne les
--    délègue à personne — ils ne PEUVENT PAS être enregistrés. Aucun cabinet
--    réel n'en portera jamais. Ce n'est pas une heuristique qu'on espère
--    juste : c'est une impossibilité d'enregistrement.
--
-- 3. LE NAVIGATEUR N'Y ACCÈDE PAS. `execute` est retiré à `public`, `anon` et
--    `authenticated`. Seul `service_role` l'appelle, donc seul un script
--    d'exploitation lancé depuis un poste qui détient la clé de service. Aucun
--    chemin applicatif ne mène ici.
--
-- 4. LE DRAPEAU EST LOCAL À LA TRANSACTION. `set_config(..., true)` : il
--    retombe au COMMIT comme au ROLLBACK. Il ne peut pas rester ouvert par
--    mégarde, ni fuir vers une autre requête de la même connexion.
--
-- ─── CE QUE CELA NE FAIT PAS ───────────────────────────────────────────────
--
-- Un cabinet réel reste indestructible, et c'est voulu : son journal répond
-- d'une obligation de tenue de dossiers. Si le besoin de fermer un vrai
-- cabinet se présente un jour, il ne passera PAS par ici — il demandera une
-- politique de conservation, une durée, et une trace de la décision.

-- ---------------------------------------------------------------------------
-- 1. Le déclencheur distingue enfin réécrire et retirer
-- ---------------------------------------------------------------------------
create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  -- La suppression en bloc d'un locataire d'épreuve, et elle seule. Le drapeau
  -- n'est posé que par `purger_cabinet_epreuve()`, qui a vérifié AVANT que le
  -- cabinet porte un courriel impossible à enregistrer.
  if TG_OP = 'DELETE'
     and coalesce(current_setting('app.purge_epreuve', true), '') = 'oui' then
    return old;
  end if;

  raise exception
    'Le journal d''audit est en ajout seul : une entrée ne peut être ni modifiée ni supprimée.';
end;
$$;

comment on function public.audit_logs_immutable is
  'Interdit toute modification du journal. Ne laisse passer qu''une suppression en bloc engagée par purger_cabinet_epreuve(), jamais un UPDATE.';

-- ---------------------------------------------------------------------------
-- 2. La purge
-- ---------------------------------------------------------------------------
create or replace function public.purger_cabinet_epreuve(p_firm_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  courriel text;
begin
  select f.email into courriel from public.firms f where f.id = p_firm_id;
  if courriel is null then return false; end if;

  -- LA BORNE QUI COMPTE. Un domaine réservé par la RFC 2606 ne s'enregistre
  -- pas : le cabinet est donc nécessairement fabriqué. Le refus est SILENCIEUX
  -- (false plutôt qu'exception) parce que l'appelant balaie une liste et ne
  -- doit pas s'interrompre sur le premier cabinet réel qu'il rencontre.
  if courriel !~* '@([^@[:space:]]+\.)?(invalid|example|test|localhost)$' then
    return false;
  end if;

  perform set_config('app.purge_epreuve', 'oui', true);
  delete from public.firms where id = p_firm_id;
  perform set_config('app.purge_epreuve', '', true);

  return true;
end;
$$;

revoke all on function public.purger_cabinet_epreuve(uuid) from public, anon, authenticated;
grant execute on function public.purger_cabinet_epreuve(uuid) to service_role;

comment on function public.purger_cabinet_epreuve is
  'Supprime un cabinet d''épreuve et tout ce qui en dépend, journal d''audit compris. Refuse tout cabinet dont le courriel n''est pas dans un domaine réservé par la RFC 2606 — un cabinet réel ne peut donc pas être visé. Réservée à service_role.';
