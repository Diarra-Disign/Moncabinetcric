-- ---------------------------------------------------------------------------
-- L'état d'accès des cabinets, calculé par la base et non recopié
-- ---------------------------------------------------------------------------
--
-- LE DÉFAUT. `firm_access_open()` est l'autorité : elle consulte le statut du
-- cabinet, l'échéance d'essai, l'état de l'abonnement Stripe et le délai de
-- grâce. Deux copies TypeScript prétendent dire la même chose sans consulter
-- l'abonnement :
--
--   lib/data/admin.ts:119   accessOpen: status === 'active' && (plan !== 'trial' || …)
--   lib/data/firm.ts:151    la même expression
--
-- Conséquence : un cabinet dont l'abonnement est résilié ou impayé au-delà du
-- délai de grâce s'affiche OUVERT dans la console d'exploitation, alors que la
-- base lui refuse tout. L'exploitant lit un état qui n'est pas le vrai, et
-- c'est précisément l'écran sur lequel il décide de suspendre ou non.
--
-- POURQUOI UNE FONCTION D'ENSEMBLE PLUTÔT QU'UN APPEL PAR CABINET. La console
-- liste tous les cabinets ; interroger `firm_access_open()` une fois par ligne
-- ferait une requête par cabinet — le N+1 que la liste doit justement éviter.
-- Cette fonction rend l'état de tous ceux que l'appelant a le droit de voir,
-- en une fois.
--
-- CE QU'ELLE N'ÉLARGIT PAS. Elle renvoie uniquement les cabinets déjà visibles
-- par la politique `firms_read_own` : son propre cabinet pour un membre, tous
-- pour un exploitant. Elle n'est pas SECURITY DEFINER — c'est la RLS de
-- `firms` qui filtre, comme partout ailleurs. Une fonction d'audit qui
-- contourne les politiques est exactement ce qu'on ne veut pas ajouter ici.

create or replace function public.firms_access_state()
returns table (firm_id uuid, access_open boolean)
language sql
stable
as $$
  select f.id, public.firm_access_open(f.id)
  from public.firms f;
$$;

revoke all on function public.firms_access_state() from public, anon;
grant execute on function public.firms_access_state() to authenticated;

comment on function public.firms_access_state is
  'État d''accès de chaque cabinet visible par l''appelant, en une seule requête. Volontairement NON security definer : la RLS de firms fait le filtrage.';
