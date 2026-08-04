-- Le client du portail voit qui le représente.
--
-- Jusqu'ici il ne pouvait pas lire la ligne de son cabinet : la politique de
-- lecture de `firms` passe par current_firm_id_unchecked(), qui interroge
-- `profiles`, table où un client n'a pas de ligne. Le portail affichait donc
-- le nom du titulaire et son numéro de permis en dur dans le code — c'est
-- ainsi qu'un numéro inventé a pu s'y installer et y rester.
--
-- L'identité du titulaire de permis n'est pas une information à cacher au
-- client : l'article 24(3)a) du Code exige qu'elle figure au contrat de
-- services, et l'article 24(3)v) que le rôle du Collège lui soit expliqué.
-- Un client qui veut porter plainte doit pouvoir nommer son représentant.
--
-- La politique reste étroite : le cabinet auquel le client est rattaché, et
-- lui seul. Elle s'ajoute aux politiques existantes sans les modifier.

drop policy if exists firms_portal_read on public.firms;
create policy firms_portal_read on public.firms
  for select to authenticated
  using (
    public.is_portal_client()
    and id = (
      select cu.firm_id
      from public.client_users cu
      where cu.user_id = auth.uid()
      limit 1
    )
  );

-- Rappel : une politique sans GRANT ne donne rien. Le rôle `authenticated`
-- dispose déjà du SELECT sur `firms` (verrouillage du 2026-08-02), mais on
-- le réaffirme plutôt que de le supposer.
grant select on public.firms to authenticated;
