-- ============================================================================
-- La date saisie à l'ouverture d'un dossier ne doit pas se perdre
-- ============================================================================
--
-- La migration précédente a fait de matters.deadline une PROJECTION : la plus
-- proche échéance encore ouverte. Elle a repris les dates des dossiers déjà
-- existants, mais elle a laissé un trou pour les dossiers À VENIR.
--
-- Le scénario, constaté en éprouvant :
--
--   1. on crée un dossier avec deadline = dans 90 jours ;
--   2. le déclencheur des règles de programme pose une échéance à 60 jours ;
--   3. la projection recalcule matters.deadline → 60 jours.
--
-- La date saisie par l'utilisateur a disparu, sans erreur et sans trace. Elle
-- n'était contredite par rien : elle était simplement plus lointaine que
-- l'échéance engendrée, et la projection ne connaît que la table.
--
-- Le déclencheur de garnissage la transforme donc, elle aussi, en échéance.
-- Ce qui est saisi est conservé ; ce qui est calculé s'y ajoute.
--
-- Idempotente.
-- ============================================================================

begin;

create or replace function public.seed_matter_deadlines()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- La date portée par le dossier à sa création devient une échéance. Sans
  -- cela, elle serait écrasée par la projection dès qu'une règle de programme
  -- produit une échéance plus proche.
  if new.deadline is not null then
    insert into public.matter_deadlines
      (firm_id, matter_id, title, due_on, is_regulatory, notes)
    values
      (new.firm_id, new.id, 'Échéance principale', new.deadline, true,
       'Date saisie à l''ouverture du dossier.');
  end if;

  insert into public.matter_deadlines
    (firm_id, matter_id, title, due_on, is_regulatory, notes)
  select new.firm_id, new.id, r.step_name,
         coalesce(new.opened_date, current_date) + (r.delay_days || ' days')::interval,
         r.is_regulatory,
         'Engendrée depuis les règles de délai du programme.'
    from public.deadline_rules r
   where r.firm_id = new.firm_id
     and lower(r.program) = lower(coalesce(new.program, ''));

  return new;
end;
$$;

commit;

-- ============================================================================
-- Contrôle après application
-- ============================================================================
--   -- Tout dossier ouvert avec une date doit porter au moins une échéance :
--   select m.reference, m.deadline
--     from public.matters m
--    where m.deadline is not null
--      and not exists (select 1 from public.matter_deadlines d where d.matter_id = m.id);
-- ============================================================================
