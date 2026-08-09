-- ============================================================================
-- Les échéances du cabinet, pour le bandeau et l'Avertisseur
-- ============================================================================
--
-- matter_deadlines_view() sert UN dossier ; firm_deadline_alerts() ne renvoie
-- que trois nombres. Rien ne listait les échéances d'un cabinet, si bien que
-- getDeadlines() renvoyait un tableau vide en dur dès qu'on était branché sur
-- Supabase — et que le bandeau d'échéances comme l'écran « Avertisseur »
-- étaient structurellement vides pour tout cabinet réel.
--
-- L'écran n'était pas cassé : il affichait « Aucune échéance à venir », ce qui
-- est rassurant et faux. Pour un consultant réglementé, dont une prescription
-- manquée engage la responsabilité, c'est le pire des deux mondes.
--
-- Les jours restants et la gravité sont calculés ICI, en même temps que la
-- liste, plutôt que dans l'application : deadline_status() vit déjà en base,
-- et un second calcul du même fait finit toujours par en différer.
-- ============================================================================

begin;

create or replace function public.firm_deadlines_view(f_id uuid)
returns table (
  id uuid,
  matter_reference text,
  client_name text,
  program text,
  title text,
  due_on date,
  days_remaining int,
  severity text,
  status text,
  assignee_name text,
  is_regulatory boolean,
  completed_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    d.id,
    m.reference,
    coalesce(c.name, m.client_name),
    m.program,
    d.title,
    d.due_on,
    (d.due_on - current_date)::int,
    -- La gravité se DÉDUIT de la date et de la nature réglementaire. La
    -- colonne priority reste le jugement du consultant ; l'urgence, elle,
    -- ne se décrète pas : une échéance à trois jours est critique même si
    -- personne n'a pensé à la marquer telle.
    case
      when d.due_on <= current_date + 14 then 'critical'
      when d.due_on <= current_date + 30 then 'high'
      else 'normal'
    end,
    case public.deadline_status(d.status, d.due_on)
      when 'done' then 'done'
      when 'cancelled' then 'dismissed'
      else 'open'
    end,
    coalesce(p.full_name, ''),
    d.is_regulatory,
    d.completed_at
  from public.matter_deadlines d
  join public.matters m on m.id = d.matter_id
  left join public.clients c on c.id = m.client_id
  left join public.profiles p on p.id = d.assignee_id
  where d.firm_id = f_id
  order by d.due_on, d.due_time nulls last;
$$;

revoke all on function public.firm_deadlines_view(uuid) from public;
grant execute on function public.firm_deadlines_view(uuid) to authenticated;

commit;
