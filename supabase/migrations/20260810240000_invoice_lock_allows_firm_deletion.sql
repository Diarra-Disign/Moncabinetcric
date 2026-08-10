-- ============================================================================
-- Le verrou des factures ne doit pas empêcher de fermer un cabinet
-- ============================================================================
--
-- protect_issued_invoice() refusait toute suppression d'une facture émise —
-- y compris celles qui disparaissent EN CASCADE quand le cabinet lui-même est
-- supprimé. Fermer un compte devenait donc impossible, et le refus arrivait
-- sous la forme d'un message parlant de numérotation comptable, sans rapport
-- avec ce qu'on essayait de faire.
--
-- La distinction se lit dans la base : lors d'une cascade, la ligne du cabinet
-- est DÉJÀ supprimée quand le déclencheur s'exécute. Son absence signe donc
-- une suppression du cabinet entier, et non celle d'une facture isolée.
--
-- La règle devient : une facture émise ne se supprime pas — sauf quand le
-- cabinet qui l'a émise cesse d'exister, auquel cas il n'y a plus de suite de
-- numéros à préserver.
-- ============================================================================

begin;

create or replace function public.protect_issued_invoice()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'DELETE' then
    if old.status <> 'draft'
       and exists (select 1 from public.firms f where f.id = old.firm_id) then
      raise exception 'Une facture émise ne se supprime pas : annulez-la, son numéro doit rester dans la suite.'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if old.status = 'draft' then return new; end if;

  if new.invoice_number is distinct from old.invoice_number
     or new.client_id  is distinct from old.client_id
     or new.matter_id  is distinct from old.matter_id
     or new.date       is distinct from old.date
     or new.tax_exempt is distinct from old.tax_exempt then
    raise exception 'Une facture émise ne se modifie plus. Annulez-la et créez-en une nouvelle.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Même raisonnement pour les lignes : la facture parente a déjà disparu.
create or replace function public.protect_issued_invoice_lines()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  etat text;
begin
  select status into etat from public.invoices
   where id = coalesce(new.invoice_id, old.invoice_id);

  if etat is not null and etat <> 'draft' then
    raise exception 'Les lignes d''une facture émise ne se modifient plus.'
      using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end;
$$;

commit;
