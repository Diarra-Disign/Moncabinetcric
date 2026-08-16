-- ============================================================================
-- Le registre mensuel du compte client
-- ============================================================================
--
-- La question à laquelle tout le module doit répondre : « combien est-ce que je
-- détiens pour chaque client, ce mois-ci, et d'où vient chaque dollar ? »
--
-- `firm_trust_by_client()` donnait déjà le solde par client, mais SANS notion
-- de période : un solde à l'instant présent, ni ouverture, ni clôture. Un
-- consultant qui doit produire l'état de mai ne peut rien en faire au mois de
-- septembre — le solde qu'il lit n'est plus celui de mai.
--
-- ─── LE MOIS QUI CASSE LES IMPLÉMENTATIONS NAÏVES ──────────────────────────
--
-- Un regroupement sur les écritures de la période paraît suffire. Il ne suffit
-- pas, et l'erreur est invisible tant qu'on ne l'éprouve pas :
--
--     mai       dépôt 3 500, retrait 2 000   → clôture 1 500
--     JUIN      AUCUN MOUVEMENT              → le client DISPARAÎT
--
-- Le cabinet détient toujours 1 500 $ de cet homme, et le registre de juin ne
-- le mentionne pas. Un état qui omet des fonds détenus est pire qu'un état
-- absent : il rassure à tort, et c'est précisément ce qu'une inspection
-- cherche.
--
-- D'où la ligne qui porte tout le reste :
--
--     where ouverture <> 0 or mouvements_de_la_periode > 0
--
-- Elle réalise à elle seule quatre exigences du cahier des charges :
--
--   · le client sans mouvement mais avec des fonds RESTE visible ;
--   · le client tombé à zéro sort de la liste le mois suivant (§7, §31) ;
--   · son historique n'est pas touché — on filtre l'affichage, jamais les
--     données (§8) ;
--   · un nouveau dépôt le fait RÉAPPARAÎTRE sans qu'on ait rien à réactiver,
--     puisque le compte de mouvements redevient positif (§9).
--
-- Aucune de ces quatre règles n'est codée séparément. Elles découlent toutes
-- de la même condition, ce qui les empêche de diverger.
--
-- ─── LE SENS D'UN MOUVEMENT N'EST PAS RÉÉCRIT ICI ──────────────────────────
--
-- Dépôts et retraits se départagent par `trust_signe()`, la fonction qui
-- calcule déjà les soldes ailleurs. Recopier la liste des types dans un `case`
-- produirait un registre dont les colonnes ne retomberaient plus sur le solde
-- affiché à côté — et les types à venir (ajustements) seraient classés sans
-- qu'on y retouche.
--
-- ─── LA GARDE ──────────────────────────────────────────────────────────────
--
-- `peut_lire_cabinet()` est obligatoire : cette fonction est `security
-- definer` et reçoit le cabinet en paramètre. Sans elle, elle rejoindrait les
-- dix-sept fonctions par lesquelles un membre lisait le registre du voisin,
-- corrigées le 2026-08-16. Le paramètre EST la faille.
--
-- Idempotente.
-- ============================================================================

begin;

create or replace function public.firm_trust_monthly_register(
  f_id uuid,
  p_start date,
  p_end date
)
returns table (
  client_id     uuid,
  client_name   text,
  opening       numeric,
  deposits      numeric,
  withdrawals   numeric,
  closing       numeric,
  last_movement date,
  entries       bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mouvements as (
    select
      l.client_id as cid,

      -- L'OUVERTURE est la somme signée de TOUT ce qui précède la période.
      -- Pas un solde reporté d'une table : un solde stocké se désynchronise
      -- de ses écritures à la première correction rétroactive, et plus rien
      -- ne dit laquelle des deux valeurs est la bonne.
      sum(case when l.occurred_on < p_start
               then public.trust_signe(l.entry_type) * l.amount
               else 0 end) as ouverture,

      sum(case when l.occurred_on >= p_start
                and public.trust_signe(l.entry_type) > 0
               then l.amount else 0 end) as depots,

      sum(case when l.occurred_on >= p_start
                and public.trust_signe(l.entry_type) < 0
               then l.amount else 0 end) as retraits,

      count(*) filter (where l.occurred_on >= p_start) as n_periode,
      max(l.occurred_on) as dernier

    from public.trust_ledger l
    where l.firm_id = f_id
      and public.peut_lire_cabinet(f_id)
      -- LE PLAFOND DE PÉRIODE EST ESSENTIEL. Sans lui, un mouvement de
      -- septembre entrerait dans l'ouverture du registre d'août, et l'état
      -- d'un mois clos changerait chaque fois qu'on saisit une écriture
      -- postérieure. Un registre doit dire ce qui était vrai à sa date.
      and l.occurred_on <= p_end
    group by l.client_id
  )
  select
    m.cid,
    c.name,
    m.ouverture::numeric(12,2),
    m.depots::numeric(12,2),
    m.retraits::numeric(12,2),
    (m.ouverture + m.depots - m.retraits)::numeric(12,2),
    m.dernier,
    m.n_periode
  from mouvements m
  join public.clients c on c.id = m.cid
  where m.ouverture <> 0 or m.n_periode > 0
  order by c.name;
$$;

comment on function public.firm_trust_monthly_register(uuid, date, date) is
  'Registre du compte client pour une période : ouverture, dépôts, retraits, '
  'clôture, par client. Un client à solde nul et sans mouvement dans la '
  'période n''y figure pas — ses écritures, elles, ne sont jamais touchées.';

revoke all on function public.firm_trust_monthly_register(uuid, date, date) from public, anon;
grant execute on function public.firm_trust_monthly_register(uuid, date, date) to authenticated;

commit;
