-- ---------------------------------------------------------------------------
-- La clôture automatique d'une demande, et le journal des événements
-- ---------------------------------------------------------------------------
-- L'AUDIT L'AVAIT SIGNALÉ : les états « completed », « cancelled » et « stale »
-- étaient déclarés en base et JAMAIS écrits. Dix-sept demandes vivaient donc
-- en attente perpétuelle. Rien ne refermait rien.
--
-- LA CLÔTURE EST UN DÉCLENCHEUR, PAS DU CODE APPLICATIF. Trois raisons :
--
--   1. Elle doit valoir quel que soit le chemin. Un destinataire signe depuis
--      la page publique, un autre depuis le portail : deux chemins, une seule
--      règle.
--   2. Elle doit valoir même si le processus applicatif meurt entre
--      l'enregistrement de la signature et la mise à jour de la demande. Dans
--      la même transaction, il n'y a pas de « entre ».
--   3. C'est le motif suivi partout ailleurs dans ce produit : on stocke le
--      FAIT — qui a signé — et l'état se calcule.
--
-- UNE RÈGLE, DEUX IMPLÉMENTATIONS, ET C'EST ASSUMÉ. `statutDeduit()` en
-- TypeScript applique exactement la même logique. Elle n'est PAS redondante :
-- elle sert aux fournisseurs EXTERNES, qui rendent l'état de leurs
-- destinataires par API et n'ont aucun déclencheur ici. Les deux servent deux
-- populations distinctes — et `./cric signature` compare leurs verdicts sur les
-- mêmes entrées, pour qu'une divergence se voie le jour où elle apparaît.

create or replace function public.signature_recalculer_demande()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  d_id uuid;
  actuel text;
  total int;
  signes int;
  refuses int;
  vus int;
  nouveau text;
begin
  d_id := coalesce(new.request_id, old.request_id);

  select status into actuel from public.signature_requests where id = d_id;
  if actuel is null then return coalesce(new, old); end if;

  -- Un état posé par le cabinet ne se recalcule pas : la déduction ne doit
  -- pas rouvrir une décision humaine.
  if actuel in ('cancelled', 'expired') then return coalesce(new, old); end if;

  select count(*),
         count(*) filter (where status = 'signed'),
         count(*) filter (where status = 'declined'),
         count(*) filter (where status = 'viewed')
    into total, signes, refuses, vus
    from public.signature_recipients
   where request_id = d_id;

  if total = 0 then return coalesce(new, old); end if;

  -- UN SEUL REFUS ARRÊTE TOUT. Un contrat qu'une partie refuse n'est pas
  -- « partiellement signé » : il n'existe pas. Continuer à réclamer les
  -- signatures suivantes ferait signer des gens sur un document mort.
  if refuses > 0 then
    nouveau := 'declined';
  elsif signes = total then
    nouveau := 'completed';
  elsif signes > 0 then
    nouveau := 'partially_signed';
  elsif vus > 0 then
    nouveau := 'viewed';
  elsif actuel in ('draft', 'ready') then
    nouveau := actuel;
  else
    nouveau := 'sent';
  end if;

  update public.signature_requests
     set status = nouveau,
         completed_at = case when nouveau = 'completed'
                             then coalesce(completed_at, now()) else completed_at end,
         declined_at  = case when nouveau = 'declined'
                             then coalesce(declined_at, now()) else declined_at end
   where id = d_id
     and status is distinct from nouveau;

  return coalesce(new, old);
end;
$$;

drop trigger if exists signature_recipients_cloture on public.signature_recipients;
create trigger signature_recipients_cloture
  after insert or update or delete on public.signature_recipients
  for each row execute function public.signature_recalculer_demande();

comment on function public.signature_recalculer_demande is
  'Recalcule l''état d''une demande depuis celui de ses destinataires. Un déclencheur et non du code : la règle doit valoir quel que soit le chemin emprunté, et survivre à la mort du processus applicatif.';

-- ---------------------------------------------------------------------------
-- Le journal des événements
-- ---------------------------------------------------------------------------
-- AUCUNE TABLE NEUVE : `audit_logs` est déjà immuable et chaînée par
-- empreintes. Elle est meilleure que ce qu'on écrirait.
--
-- SECURITY DEFINER est NÉCESSAIRE ici, et ce n'est pas une facilité : le
-- signataire n'a AUCUN compte — c'est tout l'objet du lien public. Il ne peut
-- donc satisfaire aucune politique RLS, qui reposent toutes sur
-- current_firm_id() ou current_client_id(). Sans cette fonction, les
-- événements les plus importants du journal — « document ouvert »,
-- « signature apposée » — seraient les seuls à manquer.
--
-- Le cabinet n'est PAS transmis par l'appelant : il est résolu depuis la
-- demande. Un firm_id passé en paramètre serait modifiable, et permettrait
-- d'écrire dans le journal d'un autre cabinet.
create or replace function public.signature_event(
  p_request_id   uuid,
  p_event        text,
  p_actor        text default '',
  p_recipient_id uuid default null,
  p_ip           text default null,
  p_agent        text default null,
  p_details      jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  f_id uuid;
  doc_id uuid;
  journal_id uuid;
begin
  select r.firm_id, r.document_id into f_id, doc_id
    from public.signature_requests r where r.id = p_request_id;

  if f_id is null then
    raise exception 'Demande de signature introuvable : aucun événement écrit.';
  end if;

  insert into public.audit_logs (
    firm_id, actor_name, action, entity_type, entity_id,
    summary, changes, ip_address, user_agent
  ) values (
    f_id,
    coalesce(nullif(p_actor, ''), 'Système'),
    p_event,
    'signature_request',
    p_request_id,
    p_event,
    jsonb_build_object(
      'document_id', doc_id,
      'recipient_id', p_recipient_id
    ) || coalesce(p_details, '{}'::jsonb),
    p_ip,
    p_agent
  )
  returning id into journal_id;

  return journal_id;
end;
$$;

revoke all on function public.signature_event(uuid, text, text, uuid, text, text, jsonb)
  from public, anon;
grant execute on function public.signature_event(uuid, text, text, uuid, text, text, jsonb)
  to authenticated, service_role;

comment on function public.signature_event is
  'Écrit un événement de signature dans audit_logs. SECURITY DEFINER parce que le signataire n''a aucun compte ; le cabinet est résolu depuis la demande, jamais transmis.';

-- On lit le journal PAR DEMANDE — « qu'est-il arrivé à ce contrat ? ». Rien ne
-- servait cette question.
create index if not exists idx_audit_logs_signature
  on public.audit_logs (firm_id, entity_id, occurred_at desc)
  where entity_type = 'signature_request';
