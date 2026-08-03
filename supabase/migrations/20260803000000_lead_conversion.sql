-- ============================================================================
-- Conversion d'un prospect en client
-- ============================================================================
--
-- Le prospect n'est pas supprimé lors de la conversion : il est marqué et
-- lié au client créé. Sans cela on perdrait l'historique du pipeline —
-- d'où venait ce client, combien de temps a duré le cycle, quelle valeur
-- avait été estimée face au réel.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.leads add column if not exists converted_client_id uuid
  references public.clients(id) on delete set null;
alter table public.leads add column if not exists converted_at timestamptz;

create index if not exists leads_converted_idx on public.leads (converted_client_id);

comment on column public.leads.converted_client_id is
  'Client créé à partir de ce prospect. Non nul = prospect converti.';

-- Un même prospect ne peut donner qu'un seul client : la contrainte
-- protège d'un double clic ou d'une double soumission.
create unique index if not exists leads_converted_client_unique
  on public.leads (converted_client_id)
  where converted_client_id is not null;

-- ---------------------------------------------------------------------------
-- Numérotation des dossiers clients
-- ---------------------------------------------------------------------------
-- Séquence par cabinet et par année, calculée en base plutôt que dans
-- l'application : deux conversions simultanées y produiraient sinon le
-- même numéro.

create or replace function public.next_client_file_number(p_firm_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  annee text := to_char(current_date, 'YYYY');
  rang  int;
begin
  select coalesce(max(
    nullif(regexp_replace(file_number, '^CRIC-' || annee || '-', ''), file_number)::int
  ), 0) + 1
  into rang
  from public.clients
  where firm_id = p_firm_id
    and file_number ~ ('^CRIC-' || annee || '-[0-9]+$');

  return 'CRIC-' || annee || '-' || lpad(rang::text, 4, '0');
end;
$$;

revoke all on function public.next_client_file_number(uuid) from public;
grant execute on function public.next_client_file_number(uuid) to authenticated;

commit;
