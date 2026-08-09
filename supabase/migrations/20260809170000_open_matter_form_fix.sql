-- ============================================================================
-- open_matter_form : un paramètre nommé comme une colonne
-- ============================================================================
--
--   ERROR: column reference "code" is ambiguous
--
-- Le paramètre s'appelait `code`, et la fonction interroge form_definitions,
-- dont la clé primaire s'appelle `code` elle aussi. Postgres ne tranche pas :
-- il refuse.
--
-- Le défaut n'apparaît pas à la création de la fonction — le corps n'est
-- analysé qu'à la première exécution. Il ne s'est donc vu qu'en l'appelant,
-- et c'est la raison pour laquelle une migration qui « s'applique sans erreur »
-- ne prouve rien sur les fonctions qu'elle contient.
--
-- Les paramètres portent désormais un préfixe. La convention vaut mieux que la
-- vigilance : elle ne s'oublie pas un vendredi soir.
--
-- Idempotente.
-- ============================================================================

begin;

drop function if exists public.open_matter_form(uuid, text);

create or replace function public.open_matter_form(p_matter uuid, p_code text)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_cabinet uuid; v_client uuid; v_ancienne public.matter_forms; v_nouvelle uuid;
begin
  select m.firm_id, m.client_id into v_cabinet, v_client
    from public.matters m where m.id = p_matter;
  if v_cabinet is null then
    raise exception 'Dossier introuvable.' using errcode = 'no_data_found';
  end if;
  if v_cabinet <> public.current_firm_id() then
    raise exception 'Dossier hors du cabinet.' using errcode = 'insufficient_privilege';
  end if;
  if not public.member_can('records.write') then
    raise exception 'Droit d''écriture requis.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_ancienne from public.matter_forms
   where matter_id = p_matter and form_code = p_code and status <> 'archived'
   limit 1;

  if found then
    update public.matter_forms set status = 'archived', updated_at = now()
     where id = v_ancienne.id;
  end if;

  insert into public.matter_forms
    (firm_id, matter_id, client_id, form_code, version, data, form_version, status, prepared_at)
  values
    (v_cabinet, p_matter, v_client, p_code,
     coalesce(v_ancienne.version, 0) + 1,
     coalesce(v_ancienne.data, '{}'::jsonb) || public.form_prefill(p_matter),
     (select fd.version from public.form_definitions fd where fd.code = p_code),
     'in_preparation', now())
  returning id into v_nouvelle;

  return v_nouvelle;
end;
$$;

revoke all on function public.open_matter_form(uuid, text) from public;
grant execute on function public.open_matter_form(uuid, text) to authenticated;

commit;
