-- ============================================================================
-- Notifications
-- ============================================================================
--
-- Trois décisions structurent cette table.
--
-- 1. LES ÉVÉNEMENTS SONT ÉMIS PAR DÉCLENCHEUR, PAS PAR LE CODE APPLICATIF.
--    Un questionnaire change d'état par trois chemins : le consultant depuis
--    son écran, le client depuis le portail, et le destinataire anonyme par
--    son jeton. Poser l'émission dans le code aurait couvert le premier
--    chemin, oublié les deux autres, et personne n'aurait su que des
--    notifications manquaient — une notification absente ne se signale pas.
--    Elle est donc émise là où le fait est écrit : dans la base.
--
-- 2. « LU » EST PROPRE À CHAQUE MEMBRE. Une colonne read_at sur la
--    notification aurait voulu dire qu'un associé la lit et qu'elle
--    disparaît pour ses collègues. Dans un cabinet à cinq sièges, c'est un
--    défaut silencieux : chacun croirait avoir tout vu.
--
-- 3. LE DESTINATAIRE EST UN MEMBRE, TOUT LE CABINET, OU UN CLIENT. Jamais
--    deux à la fois — même règle que pour les questionnaires, et pour la
--    même raison : deux destinataires sur une ligne, c'est une ligne que
--    plus aucun écran ne sait afficher.
--
-- Ce que cette table NE fait pas : les échéances qui approchent (§27). Elles
-- demanderaient une tâche planifiée, et rien n'en exécute ici. Les annoncer
-- par une notification jamais émise serait pire que de ne rien promettre —
-- l'écran des échéances, lui, les montre déjà en les calculant.
-- ============================================================================

begin;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references public.firms(id) on delete cascade,

  -- Nul = destinée à tout le cabinet.
  profile_id  uuid references public.profiles(id) on delete cascade,
  -- Non nul = destinée à un client, lisible depuis son portail.
  client_id   uuid references public.clients(id) on delete cascade,

  kind        text not null,
  title       text not null,
  body        text not null default '',

  -- Chemin SANS locale : la base ne sait pas dans quelle langue on la lira.
  -- L'écran préfixe. Stocker « /fr/questionnaires » enverrait un anglophone
  -- sur une page française.
  link        text,

  entity_type text,
  entity_id   uuid,

  created_at  timestamptz not null default now()
);

comment on table public.notifications is
  'Événements portés à la connaissance du cabinet ou d''un client.';

alter table public.notifications
  drop constraint if exists notifications_destinataire;
alter table public.notifications
  add constraint notifications_destinataire
  check (profile_id is null or client_id is null);

create index if not exists notifications_firm_idx on public.notifications (firm_id, created_at desc);
create index if not exists notifications_client_idx on public.notifications (client_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Ce que chacun a lu
-- ---------------------------------------------------------------------------

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, profile_id)
);

comment on table public.notification_reads is
  'Une ligne par membre ayant lu. L''absence de ligne vaut « non lu » : rien '
  'à créer au moment d''émettre, et un membre ajouté demain voit les '
  'notifications antérieures comme non lues, ce qui est le comportement juste.';

-- ---------------------------------------------------------------------------
-- Le profil courant
-- ---------------------------------------------------------------------------
-- current_firm_id() existait ; l'équivalent pour le profil manquait, et les
-- politiques ci-dessous en ont besoin. Écrire « select id from profiles where
-- user_id = auth.uid() » dans chaque politique aurait dispersé la même
-- requête en autant d'endroits à corriger.

create or replace function public.current_profile_id()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id from public.profiles where user_id = auth.uid() limit 1
$$;

grant execute on function public.current_profile_id() to authenticated;

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;

drop policy if exists notifications_membre on public.notifications;
create policy notifications_membre on public.notifications
  for select to authenticated
  using (
    firm_id = public.current_firm_id()
    -- Une notification adressée à un membre précis ne regarde pas ses
    -- collègues ; celle qui vise un client ne regarde pas le cabinet par
    -- cette politique-ci.
    and client_id is null
    and (profile_id is null or profile_id = public.current_profile_id())
  );

drop policy if exists notifications_client on public.notifications;
create policy notifications_client on public.notifications
  for select to authenticated
  using (
    public.is_portal_client()
    and client_id is not null
    and client_id = public.current_client_id()
  );

drop policy if exists notification_reads_soi on public.notification_reads;
create policy notification_reads_soi on public.notification_reads
  for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- ---------------------------------------------------------------------------
-- Émettre
-- ---------------------------------------------------------------------------

create or replace function public.notifier(
  p_firm_id uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_link text default null,
  p_profile_id uuid default null,
  p_client_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null
) returns uuid
language plpgsql volatile security definer
set search_path = public, pg_temp
as $$
declare
  nouvel_id uuid;
begin
  insert into public.notifications
    (firm_id, kind, title, body, link, profile_id, client_id, entity_type, entity_id)
  values
    (p_firm_id, p_kind, p_title, p_body, p_link, p_profile_id, p_client_id, p_entity_type, p_entity_id)
  returning id into nouvel_id;
  return nouvel_id;
end;
$$;

revoke all on function public.notifier(uuid, text, text, text, text, uuid, uuid, text, uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Les événements d'un questionnaire
-- ---------------------------------------------------------------------------

create or replace function public.notifier_questionnaire()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  qui text;
begin
  -- Seul le CHANGEMENT d'état est un événement. Sans cette garde, chaque
  -- enregistrement automatique — toutes les secondes et demie pendant que le
  -- destinataire tape — produirait une notification.
  --
  -- TG_OP est indispensable : dans un déclencheur d'INSERT, OLD n'est pas
  -- assigné, et le seul fait de lire OLD.status y lève « record "old" is not
  -- assigned yet ». L'insertion échouerait alors entièrement — c'est-à-dire
  -- qu'AUCUN questionnaire ne pourrait plus être envoyé.
  if TG_OP = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select coalesce(c.name, l.name, 'Le destinataire')
  into qui
  from (select 1) x
  left join public.clients c on c.id = new.client_id
  left join public.leads l on l.id = new.lead_id;

  if new.status = 'opened' then
    perform public.notifier(new.firm_id, 'questionnaire_opened',
      qui || ' a ouvert son questionnaire',
      new.title, '/questionnaires', null, null, 'questionnaire', new.id);

  elsif new.status = 'in_progress' then
    perform public.notifier(new.firm_id, 'questionnaire_started',
      qui || ' a commencé à répondre',
      new.title, '/questionnaires', null, null, 'questionnaire', new.id);

  elsif new.status = 'submitted' then
    perform public.notifier(new.firm_id, 'questionnaire_submitted',
      qui || ' a transmis son questionnaire',
      new.title, '/questionnaires', null, null, 'questionnaire', new.id);

  elsif new.status = 'corrected' then
    perform public.notifier(new.firm_id, 'questionnaire_corrected',
      qui || ' a apporté les corrections demandées',
      new.title, '/questionnaires', null, null, 'questionnaire', new.id);

  elsif new.status = 'to_correct' and new.client_id is not null then
    -- Celle-ci part vers le CLIENT, pas vers le cabinet : c'est lui qui doit
    -- agir. Un prospect sans portail n'en reçoit pas — il n'a nulle part où
    -- la lire ; c'est le courriel qui le prévient.
    perform public.notifier(new.firm_id, 'questionnaire_to_correct',
      'Une correction vous est demandée',
      new.title, '/portal', null, new.client_id, 'questionnaire', new.id);

  elsif new.status = 'sent' and new.client_id is not null then
    perform public.notifier(new.firm_id, 'questionnaire_sent',
      'Un nouveau questionnaire est disponible dans votre portail',
      new.title, '/portal', null, new.client_id, 'questionnaire', new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists notifier_questionnaire on public.client_questionnaires;
create trigger notifier_questionnaire
  after insert or update on public.client_questionnaires
  for each row execute function public.notifier_questionnaire();

commit;
