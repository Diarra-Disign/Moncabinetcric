-- ============================================================================
-- Correction : UPDATE ... FROM ne peut pas passer la ligne visée à une
-- fonction
-- ============================================================================
--
-- resync_invoices_on_tax_change() écrivait :
--
--     update public.invoices i set amount = t.total
--       from public.invoice_totals(i.id) t where …
--
-- Postgres refuse : « invalid reference to FROM-clause entry for table i ».
-- La clause FROM d'un UPDATE est évaluée AVANT que la ligne cible ne soit
-- connue ; i.id n'y existe pas encore. Une sous-requête scalaire, elle, est
-- évaluée POUR chaque ligne, et peut donc la désigner.
--
-- La fonction avait été créée sans la moindre erreur : un corps PL/pgSQL n'est
-- analysé qu'à sa PREMIÈRE EXÉCUTION. C'est ce qui rend ces déclencheurs
-- particulièrement traîtres — celui-ci n'aurait échoué que le jour où un
-- cabinet change son taux de TVQ.
-- ============================================================================

begin;

create or replace function public.resync_invoices_on_tax_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.tax_gst_rate is not distinct from old.tax_gst_rate
     and new.tax_qst_rate is not distinct from old.tax_qst_rate then
    return new;
  end if;

  update public.invoices i
     set amount = (select t.total from public.invoice_totals(i.id) t)
   where i.firm_id = new.id
     and i.status in ('draft','issued','pending')
     and exists (select 1 from public.invoice_lines l where l.invoice_id = i.id);

  return new;
end;
$$;

commit;
