-- ============================================================================
-- Une facture émise ne se réécrit pas
-- ============================================================================
--
-- Le brief demande de pouvoir modifier et supprimer une facture. La règle
-- comptable, elle, ne l'admet que tant qu'elle est un BROUILLON : dès qu'elle
-- est émise, le client la détient. La corriger reviendrait à ce qu'il possède
-- une pièce que le cabinet ne reconnaît plus, et la supprimer, à faire
-- disparaître un numéro d'une suite qui doit être continue.
--
-- Une facture émise s'ANNULE, et se remplace. Le numéro reste pris, la trace
-- demeure.
--
-- Ce verrou est en base et non dans l'écran : la même table est écrite par
-- l'action de création, par les scripts d'administration et demain par le
-- connecteur IA. Un contrôle posé dans le seul formulaire n'aurait couvert
-- que le premier.
-- ============================================================================

begin;

create or replace function public.protect_issued_invoice()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Une facture émise ne se supprime pas : annulez-la, son numéro doit rester dans la suite.'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  -- Un brouillon se modifie librement.
  if old.status = 'draft' then return new; end if;

  -- Émise, seules deux évolutions restent permises : l'annulation, et le
  -- montant que le déclencheur des lignes reporte. Tout le reste est figé.
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

drop trigger if exists protect_issued_invoice on public.invoices;
create trigger protect_issued_invoice
  before update or delete on public.invoices
  for each row execute function public.protect_issued_invoice();

-- Les LIGNES d'une facture émise sont figées elles aussi. Sans cela, on
-- corrigerait le détail sans toucher à l'en-tête, et le total changerait sous
-- le nez d'un client qui détient déjà le document.
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

drop trigger if exists protect_issued_invoice_lines on public.invoice_lines;
create trigger protect_issued_invoice_lines
  before insert or update or delete on public.invoice_lines
  for each row execute function public.protect_issued_invoice_lines();

commit;
