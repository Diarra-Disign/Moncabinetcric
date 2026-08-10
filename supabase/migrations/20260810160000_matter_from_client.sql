-- ============================================================================
-- Ouvrir un dossier depuis la fiche d'un client
-- ============================================================================
--
-- Ce qui existait déjà et qu'on ne refait pas : clients et matters sont deux
-- tables distinctes reliées par client_id, si bien qu'un client porte déjà
-- plusieurs dossiers sans dupliquer son profil (§6) ; et
-- seed_matter_requirements() comme seed_matter_deadlines() garnissent déjà
-- tout dossier neuf de ses pièces exigées et de ses échéances (§4.5, §4.6).
--
-- Ce qui manquait :
--
-- 1. LE NUMÉRO. reference était saisie à la main. Deux ouvertures simultanées
--    pouvaient produire le même numéro, et rien ne l'aurait empêché — la
--    séquence se calcule donc en base, comme next_client_file_number() avant
--    elle, et non dans l'application où deux requêtes concurrentes lisent le
--    même maximum.
--
-- 2. Le type de service, l'agent, la priorité et la description du mandat.
--
-- program restait seul à porter à la fois « ce qu'on demande à IRCC » et
-- « quel service on vend ». Ce sont deux choses : une consultation et un
-- permis d'études peuvent viser le même programme.
-- ============================================================================

begin;

alter table public.matters
  add column if not exists service_type text,
  add column if not exists agent_id uuid references public.profiles(id) on delete set null,
  add column if not exists priority text not null default 'normal',
  add column if not exists description text;

alter table public.matters drop constraint if exists matters_priority_check;
alter table public.matters
  add constraint matters_priority_check
  check (priority in ('low','normal','high','critical'));

comment on column public.matters.service_type is
  'Le service vendu — consultation, parrainage, EIMT… — distinct du programme '
  'visé auprès d''IRCC. Une consultation et un permis d''études peuvent viser '
  'le même programme.';

comment on column public.matters.agent_id is
  'Second intervenant du cabinet, quand le dossier en a un. rcic reste le '
  'consultant réglementé qui en répond.';

-- ---------------------------------------------------------------------------
-- Le numéro de dossier
-- ---------------------------------------------------------------------------
-- Forme : PRÉFIXE-ANNÉE-00001, le préfixe venant du cabinet. Deux cabinets
-- peuvent donc numéroter en parallèle sans se croiser, et la référence reste
-- lisible au téléphone — ce qu'un uuid n'est pas.

alter table public.firms add column if not exists matter_prefix text;

comment on column public.firms.matter_prefix is
  'Préfixe des numéros de dossier. À défaut, les trois premières lettres de '
  'la raison sociale.';

create or replace function public.next_matter_reference(p_firm_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  annee   text := to_char(current_date, 'YYYY');
  prefixe text;
  rang    int;
begin
  select coalesce(
           nullif(trim(f.matter_prefix), ''),
           upper(regexp_replace(substring(f.name from 1 for 3), '[^a-zA-Z]', '', 'g'))
         )
  into prefixe
  from public.firms f
  where f.id = p_firm_id;

  -- Une raison sociale sans lettre — « 9412-3344 Québec inc. » — ne donnerait
  -- rien du tout ; le repli garantit un préfixe dans tous les cas.
  if prefixe is null or prefixe = '' then prefixe := 'DOS'; end if;

  select coalesce(max(
    nullif(regexp_replace(reference, '^' || prefixe || '-' || annee || '-', ''), reference)::int
  ), 0) + 1
  into rang
  from public.matters
  where firm_id = p_firm_id
    and reference ~ ('^' || prefixe || '-' || annee || '-[0-9]+$');

  return prefixe || '-' || annee || '-' || lpad(rang::text, 5, '0');
end;
$$;

revoke all on function public.next_matter_reference(uuid) from public;
grant execute on function public.next_matter_reference(uuid) to authenticated;

-- Une référence est unique DANS son cabinet. Sans cet index, deux ouvertures
-- simultanées liraient le même maximum et produiraient le même numéro : la
-- fonction ci-dessus les calcule, elle ne les réserve pas.
create unique index if not exists matters_reference_firm_unique
  on public.matters (firm_id, reference);

commit;
