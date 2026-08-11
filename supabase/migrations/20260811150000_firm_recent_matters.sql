-- ============================================================================
-- Les dossiers récents du tableau de bord — filtrés, triés et paginés EN BASE
-- ============================================================================
--
-- La section « Dossiers récents » du tableau de bord bouclait sur un tableau
-- vide écrit en dur. Elle n'a donc jamais rien affiché, pour aucun cabinet.
-- Ce qui suit lui donne sa source.
--
-- POURQUOI EN SQL ET NON DANS LA PAGE. Le brief demande de chercher par date,
-- par type de date, par texte, avec un tri, et que cela reste rapide « même
-- lorsque le cabinet possède un grand nombre de dossiers ». Charger tous les
-- dossiers pour en filtrer huit dans le navigateur tient tant que le cabinet
-- est jeune et cesse de tenir exactement le jour où il ne l'est plus — c'est-
-- à-dire le jour où personne ne surveille plus.
--
-- SECURITY INVOKER, délibérément : la fonction lit `matters` sous les droits
-- de l'appelant, donc sous Row Level Security. Un membre d'un autre cabinet
-- n'obtient aucune ligne, sans qu'un filtre écrit ici ait à y penser. Ajouter
-- un filtre firm_id donnerait l'illusion que c'est LUI qui protège, et son
-- oubli ailleurs passerait inaperçu.
--
-- LES QUATRE DATES, ET CELLE QUI N'EXISTE PAS. Le brief en demande cinq :
-- création, dernière modification, dernière activité, ouverture, prochaine
-- échéance.
--
-- La table n'en portait que TROIS — created_at, opened_date, deadline. Le
-- fichier _archive/0001_init_schema.sql déclare bien un updated_at ; c'est une
-- archive, et ce n'est pas ce qui a été appliqué. La vraie base ne l'a pas,
-- Postgres l'a dit. Interroger le catalogue plutôt que relire un fichier est
-- la seule façon de le savoir.
--
-- On l'ajoute donc, rétro-rempli depuis created_at : un dossier jamais modifié
-- depuis sa création a bien été modifié pour la dernière fois à sa création.
-- Mettre now() aurait daté d'aujourd'hui des dossiers ouverts il y a six mois.
--
-- « Dernière activité » reste absente, et je ne la simule pas. Elle voudrait
-- dire « une pièce a été déposée, un paiement enregistré, un questionnaire
-- rendu » — or rien de tout cela ne remonte au dossier. La proposer en la
-- faisant pointer vers updated_at serait offrir deux entrées pour une seule
-- vérité. Il y a donc quatre dates, et la quatrième s'appelle « dernière
-- modification ».
-- ============================================================================

begin;

alter table public.matters
  add column if not exists updated_at timestamptz not null default now();

update public.matters set updated_at = created_at where updated_at > created_at;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_matters_updated_at on public.matters;
create trigger touch_matters_updated_at
  before update on public.matters
  for each row execute function public.touch_updated_at();

create or replace function public.firm_recent_matters(
  p_champ_date text default 'updated_at',
  p_du         date default null,
  p_au         date default null,
  p_recherche  text default null,
  p_tri        text default 'date_desc',
  p_limite     int  default 8,
  p_decalage   int  default 0
)
returns table (
  id           uuid,
  reference    text,
  client_name  text,
  client_id    uuid,
  program      text,
  category     text,
  status       text,
  opened_date  date,
  deadline     date,
  created_at   timestamptz,
  updated_at   timestamptz,
  total        bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with filtre as (
    select m.*,
      -- La date sur laquelle porte la recherche, choisie par l'appelant. Un
      -- CASE plutôt que du SQL assemblé à la main : une chaîne concaténée
      -- ouvrirait une injection là où il n'y a que quatre valeurs possibles.
      case p_champ_date
        when 'created_at'  then m.created_at::date
        when 'opened_date' then m.opened_date
        when 'deadline'    then m.deadline
        else                    m.updated_at::date
      end as date_retenue
    from public.matters m
  )
  select f.id, f.reference, f.client_name, f.client_id, f.program, f.category,
         f.status, f.opened_date, f.deadline, f.created_at, f.updated_at,
         count(*) over () as total
    from filtre f
   where (p_du is null or f.date_retenue >= p_du)
     and (p_au is null or f.date_retenue <= p_au)
     -- Une échéance absente ne doit pas disparaître d'une recherche qui ne
     -- porte PAS sur l'échéance : la condition ne s'applique qu'au champ visé.
     and (p_champ_date <> 'deadline' or f.deadline is not null or (p_du is null and p_au is null))
     -- La recherche et le filtre se composent (§7) : ils se cumulent dans le
     -- même WHERE au lieu de s'exclure.
     and (
       p_recherche is null or btrim(p_recherche) = '' or
       f.client_name ilike '%' || btrim(p_recherche) || '%' or
       f.reference   ilike '%' || btrim(p_recherche) || '%' or
       f.program     ilike '%' || btrim(p_recherche) || '%'
     )
   order by
     case when p_tri = 'date_asc'  then f.date_retenue end asc  nulls last,
     case when p_tri = 'client'    then f.client_name  end asc  nulls last,
     case when p_tri = 'statut'    then f.status       end asc  nulls last,
     -- L'échéance la plus PROCHE d'abord : c'est ce qu'on veut savoir d'une
     -- échéance, jamais la plus lointaine.
     case when p_tri = 'echeance'  then f.deadline     end asc  nulls last,
     case when p_tri not in ('date_asc','client','statut','echeance')
          then f.date_retenue end desc nulls last,
     -- Départage stable : sans lui, deux dossiers de même date changeraient
     -- d'ordre d'un chargement à l'autre, et la pagination sauterait des lignes.
     f.reference asc
   limit greatest(1, least(coalesce(p_limite, 8), 100))
  offset greatest(0, coalesce(p_decalage, 0));
$$;

comment on function public.firm_recent_matters(text, date, date, text, text, int, int) is
  'Dossiers récents du tableau de bord. SECURITY INVOKER : le cloisonnement '
  'entre cabinets vient de RLS, pas d''un filtre écrit ici. « total » est le '
  'nombre de dossiers CORRESPONDANTS, pas le nombre rendu — sans quoi on ne '
  'pourrait pas dire « 8 sur 143 ».';

-- Le tri par défaut porte sur updated_at ; sans cet index, chaque ouverture du
-- tableau de bord balaie toute la table.
create index if not exists idx_matters_firm_updated_at
  on public.matters (firm_id, updated_at desc);

commit;
