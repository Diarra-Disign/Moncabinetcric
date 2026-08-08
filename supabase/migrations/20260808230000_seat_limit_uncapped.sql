-- ============================================================================
-- Un forfait facturé à la place ne se refuse pas, il se facture
-- ============================================================================
--
-- firm_seat_limit() lisait d'abord firm_subscriptions.seats, c'est-à-dire le
-- nombre de places FACTURÉES, et s'en servait comme PLAFOND. Les deux notions
-- se confondaient tant qu'aucun forfait ne vendait de place à l'unité. Depuis
-- la tarification par place, elles s'opposent :
--
--   Un cabinet sous Cabinet Pro paie cinq places. seats = 5, donc plafond = 5.
--   Il invite un sixième membre → le déclencheur refuse.
--   La synchronisation qui aurait porté la facture à six ne s'exécute
--   qu'APRÈS une invitation acceptée. Elle ne s'exécute donc jamais.
--
-- Le cabinet est bloqué à l'effectif qu'il avait au moment de payer, sur un
-- forfait vendu comme extensible — « puis 25 $ par mois et par membre
-- supplémentaire ». Rien dans l'écran n'explique le refus, et l'exploitant n'a
-- aucune trace : l'invitation échoue, c'est tout.
--
-- ---------------------------------------------------------------------------
-- CE QUI CHANGE
-- ---------------------------------------------------------------------------
-- Le plafond vient du FORFAIT, plus jamais de l'abonnement. Un forfait dont
-- max_seats est null n'a pas de plafond : chaque place s'ajoute et se facture.
-- Un forfait plafonné (Essai, Solo) garde son plafond, augmenté des places
-- accordées à la main par l'exploitant.
--
-- firm_subscriptions.seats reste écrit et reste lu par les écrans : il dit ce
-- que le cabinet PAIE. Il ne dit plus ce qu'il a le DROIT d'occuper.
--
-- Idempotente. Aucune donnée n'est touchée.
-- ============================================================================

begin;

create or replace function public.firm_seat_limit(f_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with cap as (
    select l.max_seats
      from public.plan_limits l
     where l.plan = public.firm_effective_plan(f_id)
  )
  select case
    -- Sans plafond au forfait, sans plafond ici. Ajouter extra_seats à null
    -- donnerait null de toute façon ; le dire explicitement évite qu'on croie
    -- à un oubli.
    when (select max_seats from cap) is null then null
    else (select max_seats from cap)
         + coalesce((select f.extra_seats from public.firms f where f.id = f_id), 0)
  end;
$$;

revoke all on function public.firm_seat_limit(uuid) from public;
grant execute on function public.firm_seat_limit(uuid) to authenticated;

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   -- Un cabinet sous forfait plafonné garde son plafond :
--   select f.name, public.firm_effective_plan(f.id) as forfait,
--          public.firm_seats_taken(f.id) as occupees,
--          public.firm_seat_limit(f.id)  as plafond
--     from public.firms f order by f.name;
--
--   -- Aucun cabinet ne doit afficher un plafond INFÉRIEUR à ses places
--   -- occupées : ce serait un cabinet déjà en infraction avec sa limite.
--   select f.name from public.firms f
--    where public.firm_seat_limit(f.id) is not null
--      and public.firm_seat_limit(f.id) < public.firm_seats_taken(f.id);
-- ============================================================================
