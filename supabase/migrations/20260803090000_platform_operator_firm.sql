-- ============================================================================
-- Cabinet exploitant de la plateforme
-- ============================================================================
--
-- Les pages publiques /confidentialite et /conditions nommaient un cabinet
-- fictif, avec un numéro de permis CICC inexistant. Or la politique de
-- confidentialité est le document qui désigne le responsable de la
-- protection des renseignements personnels : il désignait une personne qui
-- n'existe pas.
--
-- Ces pages sont publiques et n'ont donc aucune session : elles ne peuvent
-- pas déduire le cabinet du membre connecté. Un marqueur explicite dit
-- lequel des cabinets est l'exploitant de la plateforme.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.firms
  add column if not exists is_platform_operator boolean not null default false;

-- Un seul exploitant possible : sans cet index, deux cabinets marqués
-- donneraient une politique de confidentialité non déterministe.
create unique index if not exists firms_single_platform_operator
  on public.firms ((is_platform_operator)) where is_platform_operator;

comment on column public.firms.is_platform_operator is
  'Cabinet qui exploite la plateforme. Ses coordonnées alimentent les pages légales publiques. Un seul cabinet peut porter ce marqueur.';

-- Lecture publique de la seule entité exploitante, et uniquement des
-- champs qui figurent déjà dans les mentions légales. Aucun autre cabinet
-- n'est exposé.
drop policy if exists firms_public_operator on public.firms;
create policy firms_public_operator on public.firms
  for select to anon, authenticated
  using (is_platform_operator);

commit;
