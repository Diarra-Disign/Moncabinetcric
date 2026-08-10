-- ============================================================================
-- La ventilation par client est figée avec le rapprochement
-- ============================================================================
--
-- Défaut vu à l'œil sur l'état imprimé, et qu'aucun contrôle de présence
-- n'aurait attrapé : le document affichait
--
--     SOLDE DU REGISTRE        5 915,00 $     (figé à l'arrêté)
--     Total de la ventilation  6 692,00 $     (lu sur le registre ACTUEL)
--
-- Les deux nombres devraient être le même. Ils divergeaient parce que la
-- ventilation par client était relue au moment d'imprimer, donc après les
-- écritures postérieures à la période — exactement l'erreur que le solde figé
-- était censé prévenir, reproduite juste en dessous de lui.
--
-- Sur une pièce qu'une inspection peut réclamer, deux totaux incompatibles sur
-- la même page valent moins que pas de ventilation du tout : ils invitent la
-- question qu'on cherchait à éviter.
--
-- La ventilation rejoint donc ce qui est conservé. Rétrocompatible : les
-- rapprochements existants ont un tableau vide, et le document retombe alors
-- sur la lecture courante en le disant.
-- ============================================================================

begin;

alter table public.trust_reconciliations
  add column if not exists client_breakdown jsonb not null default '[]'::jsonb;

comment on column public.trust_reconciliations.client_breakdown is
  'Ventilation par client telle qu''elle était à l''arrêté. Figée pour la même '
  'raison que ledger_balance : relue plus tard, elle ne serait plus celle du mois.';

-- Elle est figée comme les autres montants : le verrou existant doit la
-- couvrir, sans quoi on pourrait réécrire la ventilation d'un état clos.
create or replace function public.protect_closed_reconciliation()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'closed'
       and exists (select 1 from public.firms where id = old.firm_id) then
      raise exception 'Un rapprochement clos ne peut pas être supprimé : il fait foi pour la période arrêtée.'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.status = 'closed' then
    if new.bank_balance is distinct from old.bank_balance
       or new.ledger_balance is distinct from old.ledger_balance
       or new.period_end is distinct from old.period_end
       or new.explanations is distinct from old.explanations
       or new.client_breakdown is distinct from old.client_breakdown
       or new.status is distinct from old.status then
      raise exception 'Ce rapprochement est clos : ses montants et ses explications ne peuvent plus changer.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

commit;
