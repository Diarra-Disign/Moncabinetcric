-- ============================================================================
-- L'ouverture d'un accès portail suit la permission, pas le rôle
-- ============================================================================
--
-- `portal.manage` a été déclarée délégable : un cabinet doit pouvoir confier
-- l'ouverture des accès client à son adjointe sans lui donner les droits du
-- propriétaire sur l'abonnement et les membres.
--
-- L'action de serveur exige désormais cette permission. Mais la politique
-- `client_users_firm_manage` continuait d'exiger is_firm_owner() : la
-- délégation aurait donc été acceptée par l'application et refusée par la base,
-- avec un message parlant de rattachement impossible. Le pire des deux — un
-- écran qui promet, une base qui refuse, et rien pour relier les deux.
--
-- Idempotente.
-- ============================================================================

begin;

drop policy if exists client_users_firm_manage on public.client_users;
create policy client_users_firm_manage on public.client_users
  for all to authenticated
  using (
    firm_id = public.current_firm_id()
    and public.member_can('portal.manage')
  )
  with check (
    firm_id = public.current_firm_id()
    and public.member_can('portal.manage')
  );

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select policyname, qual from pg_policies where tablename = 'client_users';
--   ./cric permissions
-- ============================================================================
