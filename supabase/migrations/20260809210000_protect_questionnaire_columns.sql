-- ============================================================================
-- Ce qu'un client du portail ne peut pas réécrire dans son questionnaire
-- ============================================================================
--
-- La politique client_questionnaires_portal_update autorise l'UPDATE de la
-- ligne. Row Level Security s'arrête là : elle décide QUELLES LIGNES sont
-- accessibles, jamais QUELLES COLONNES. Un client pouvait donc, avec une
-- requête façonnée à la main, vider `corrections` — les demandes de
-- correction du consultant — et `history` — le journal des modifications.
--
-- Autrement dit, il pouvait effacer la trace de ses propres changements.
-- Pour un consultant réglementé, un journal que le client peut réécrire ne
-- vaut rien comme preuve devant le CRIC.
--
-- Ce verrou ne se pose donc pas dans une politique mais dans un déclencheur,
-- comme protect_review_columns() et payments_immutable_money() avant lui.

begin;

create or replace function public.protect_questionnaire_columns()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  -- Le cabinet garde la main sur tout : c'est lui qui demande les
  -- corrections et qui tient le journal.
  if not public.is_portal_client() then return new; end if;

  if new.firm_id     is distinct from old.firm_id
     or new.client_id   is distinct from old.client_id
     or new.matter_id   is distinct from old.matter_id
     or new.title       is distinct from old.title
     or new.description is distinct from old.description
     or new.form_type   is distinct from old.form_type
     or new.due_date    is distinct from old.due_date
     or new.corrections is distinct from old.corrections
     or new.created_at  is distinct from old.created_at then
    raise exception 'Un client ne peut modifier que ses réponses.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Le journal ne se réécrit pas : il s'allonge. On accepte donc un
  -- historique qui commence par l'ancien, et rien d'autre.
  if not (new.history @> old.history) then
    raise exception 'Le journal des modifications ne peut pas être réécrit.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_questionnaire_columns on public.client_questionnaires;
create trigger protect_questionnaire_columns
  before update on public.client_questionnaires
  for each row execute function public.protect_questionnaire_columns();

commit;
