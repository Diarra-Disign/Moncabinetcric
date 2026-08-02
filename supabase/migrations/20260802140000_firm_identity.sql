-- ============================================================================
-- Identité complète du cabinet
-- ============================================================================
--
-- La table firms ne portait que le nom, le numéro de permis et le nom du
-- propriétaire. Le reste de l'identité — adresse, téléphone, courriel —
-- était codé en dur dans une douzaine de composants d'interface, si bien
-- qu'un cabinet fictif apparaissait sur les ententes, les factures et les
-- lettres de soumission sans qu'aucune donnée en base ne le dise.
--
-- Cette migration fait de firms la source unique de vérité.
--
-- Les valeurs par défaut de la migration initiale sont également retirées :
-- un numéro de permis CICC ne doit jamais avoir de valeur par défaut, sous
-- peine de voir un cabinet hériter silencieusement du permis d'un autre.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.firms add column if not exists address       text;
alter table public.firms add column if not exists phone         text;
alter table public.firms add column if not exists email         text;
alter table public.firms add column if not exists logo_letter   text;
alter table public.firms add column if not exists logo_url      text;
alter table public.firms add column if not exists updated_at    timestamptz not null default now();

-- Un permis hérité par défaut est un risque déontologique, pas un confort.
alter table public.firms alter column rcic_license_number drop default;
alter table public.firms alter column owner_name          drop default;

comment on column public.firms.rcic_license_number is
  'Numéro de permis CICC du consultant réglementé. Aucune valeur par défaut : doit être saisi explicitement.';

-- Le format R-XXXXXX est celui du Collège. La contrainte est volontairement
-- tolérante à la casse et aux espaces, mais refuse une valeur vide.
alter table public.firms drop constraint if exists firms_rcic_license_format;
alter table public.firms add constraint firms_rcic_license_format
  check (rcic_license_number is null or rcic_license_number ~ '^[Rr]-?[0-9]{6}$');

commit;
