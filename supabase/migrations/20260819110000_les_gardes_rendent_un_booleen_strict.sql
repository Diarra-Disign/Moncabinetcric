-- ============================================================================
-- Les gardes cessent de rendre NULL
-- ============================================================================
--
-- Défaut trouvé par `./cric cloisonnement`, sur le cas du cabinet suspendu :
-- il continuait à obtenir un numéro de facture alors que la garde aurait dû
-- refuser.
--
-- ─── LA LOGIQUE À TROIS VALEURS ────────────────────────────────────────────
--
-- Chez un cabinet suspendu, `current_firm_id()` rend null. La garde s'écrivait
--
--     f_id = public.current_firm_id()      →  NULL, et non `false`
--
-- puis `false or NULL or false` → NULL, et la fonction entière rendait NULL.
--
-- Dans un `where`, NULL écarte la ligne : les six fonctions de la première
-- passe se comportaient donc correctement, et le défaut y était invisible.
--
-- Dans un `if not …` de PL/pgSQL, c'est l'inverse exact : `not NULL` vaut
-- NULL, la condition n'est pas retenue, et LA GARDE LAISSE PASSER. Les quatre
-- fonctions de numérotation, seules à s'en servir sous cette forme, rendaient
-- donc leur réponse à un cabinet fermé.
--
-- Une garde qui rend NULL est une garde qui protège selon l'endroit où on la
-- pose. On la rend booléenne stricte une fois pour toutes, à la source, plutôt
-- que de poser un `coalesce` chez chacun de ses appelants — le prochain
-- appelant oublierait.
--
-- Idempotente.
-- ============================================================================

begin;

create or replace function public.peut_lire_cabinet(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    f_id is not null and (
         auth.role() = 'service_role'
      or f_id = public.current_firm_id()
      or public.is_platform_admin()
    ), false);
$$;

create or replace function public.membre_du_cabinet(f_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    f_id is not null and (
         auth.role() = 'service_role'
      or exists (
           select 1 from public.profiles p
            where p.user_id = auth.uid()
              and p.firm_id = f_id
              and p.status  = 'active')
      -- Le portail client : ces comptes n'ont pas de profil, mais ils ont
      -- légitimement affaire à ce cabinet.
      or exists (
           select 1 from public.client_users cu
            where cu.user_id = auth.uid()
              and cu.firm_id = f_id)
      or public.is_platform_admin()
    ), false);
$$;

commit;
