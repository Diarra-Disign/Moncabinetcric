-- ============================================================================
-- Statuts de membre : refermer ce que trois politiques laissaient ouvert
-- ============================================================================
--
-- La migration précédente a posé `profiles_owner_manage`, qui exclut
-- explicitement l'auteur de la modification. L'épreuve `./cric membres` a
-- pourtant montré un propriétaire se suspendant lui-même avec succès.
--
-- La raison tient à une propriété des politiques RLS qu'il est facile
-- d'oublier : plusieurs politiques d'une même commande se combinent par OU,
-- jamais par ET. Ajouter une politique restrictive n'interdit donc rien tant
-- qu'une politique permissive plus large subsiste à côté. Trois cohabitaient
-- ici sur UPDATE, dont l'ancienne `profiles_owner_update`, sans exclusion de
-- soi-même. C'est elle qui répondait.
--
-- Conséquence concrète : un propriétaire pouvait se fermer la porte. Son
-- cabinet se retrouvait alors sans personne pour la rouvrir — exactement
-- l'impasse des cabinets sans propriétaire rencontrée aux premiers essais,
-- mais atteinte cette fois d'un seul clic, et par la seule personne qui aurait
-- pu la défaire.
--
-- Idempotente.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Une seule politique de gestion, celle qui exclut l'auteur
-- ---------------------------------------------------------------------------

drop policy if exists profiles_owner_update on public.profiles;

drop policy if exists profiles_owner_manage on public.profiles;
create policy profiles_owner_manage on public.profiles
  for update to authenticated
  using (
    firm_id = public.current_firm_id()
    and public.is_firm_owner()
    -- Le propriétaire agit sur les autres, jamais sur lui-même. Changer de
    -- propriétaire reste possible : on promeut d'abord quelqu'un d'autre.
    and user_id <> auth.uid()
  )
  with check (
    firm_id = public.current_firm_id()
    and public.is_firm_owner()
    and user_id <> auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 2. Modifier sa propre fiche, sans se donner de droits
-- ---------------------------------------------------------------------------
-- Cette politique existait déjà et gardait bien le rôle : `cicc_role` devait
-- rester inchangé. Le statut, lui, n'était pas gardé — il n'existait pas
-- encore. Un membre pouvait donc écrire son propre statut.
--
-- L'escalade était en pratique fermée par ailleurs : un membre suspendu voit
-- current_firm_id() et current_cicc_role() renvoyer NULL, et les deux
-- conditions de WITH CHECK échouent. Il ne peut donc pas se réactiver. Mais
-- s'en remettre à cette coïncidence reviendrait à protéger une porte parce
-- que le couloir est sombre. La condition est écrite.

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and firm_id = public.current_firm_id()
    and cicc_role = public.current_cicc_role()
    -- Son propre accès ne se donne pas : il se reçoit du propriétaire.
    and status = 'active'
  );

-- ---------------------------------------------------------------------------
-- 3. Un rattachement ne se supprime plus
-- ---------------------------------------------------------------------------
-- `profiles_owner_delete` permettait au propriétaire d'effacer la ligne d'un
-- membre. C'était le chemin qu'empruntait l'ancien `retirerMembre`, remplacé
-- par la révocation.
--
-- La politique disparaît avec lui : tant qu'elle demeure, l'effacement reste
-- atteignable — par un écran futur, par un script, ou par une correction faite
-- à la hâte un soir de production. Or cette ligne porte la réponse à « qui a
-- déposé cette pièce », et cette réponse a une valeur déontologique.
--
-- La suppression d'un cabinet entier continue de fonctionner : elle passe par
-- la contrainte ON DELETE CASCADE de la clé étrangère, qui ne consulte aucune
-- politique.

drop policy if exists profiles_owner_delete on public.profiles;

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select policyname, cmd from pg_policies
--    where tablename = 'profiles' order by cmd, policyname;
--   -- attendu : aucune ligne DELETE, deux lignes UPDATE
--   --           (profiles_owner_manage, profiles_update_self)
--
--   ./cric membres
-- ============================================================================
