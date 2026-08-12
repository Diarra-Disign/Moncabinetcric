-- ---------------------------------------------------------------------------
-- Signature électronique — le socle
-- ---------------------------------------------------------------------------
-- DEUX TABLES NEUVES, PAS SIX. Le cahier des charges énumère six entités ;
-- quatre existent déjà sous un autre nom et il serait fautif de les dupliquer :
--
--   SignatureEvent   → audit_logs, déjà immuable ET chaînée par empreintes.
--                      Une table neuve serait moins bonne.
--   SignedDocument   → documents, qui porte déjà sha256 et storage_path.
--   SignatureRequest → signature_requests, qui existe et qu'on étend.
--   SignatureProvider→ une colonne. Une table de deux lignes jamais jointe
--                      n'est pas un modèle de données, c'est un formulaire.
--
-- Restent SignatureRecipient et SignatureField, qui manquent réellement.
--
-- CE QUI MANQUAIT ET QUI COMMANDE TOUT LE RESTE : une demande de signature ne
-- nommait PERSONNE. Elle désignait un document, et signait qui y avait accès.
-- D'où l'impossibilité de dire qu'il manque une signature, d'imposer un ordre,
-- de relancer quelqu'un, ou de refermer une demande. Les destinataires sont la
-- pièce dont dépendent toutes les autres.

-- ---------------------------------------------------------------------------
-- 1. La demande, étendue
-- ---------------------------------------------------------------------------

alter table public.signature_requests
  -- LE FOURNISSEUR QUI A PRODUIT CETTE DEMANDE. Conservé sur la ligne et non
  -- déduit d'une variable d'environnement : le jour où le cabinet passe à un
  -- fournisseur externe, les demandes déjà ouvertes doivent rester lisibles
  -- par celui qui les a créées. Une configuration globale les rendrait
  -- orphelines du jour au lendemain.
  add column if not exists provider text not null default 'internal',
  -- L'identifiant de l'enveloppe chez le fournisseur externe, quand il y en a
  -- un. Vide pour le fournisseur interne, qui n'a pas d'ailleurs.
  add column if not exists provider_ref text,

  -- Séquentiel : chacun son tour, dans l'ordre des rangs. Parallèle : tout le
  -- monde en même temps. Le modèle porte les deux dès maintenant ; l'écran ne
  -- servira que le séquentiel en V1, qui est l'ordre réel d'une entente.
  add column if not exists signing_mode text not null default 'sequential'
    check (signing_mode in ('sequential', 'parallel')),

  add column if not exists completed_at timestamptz,
  add column if not exists declined_at  timestamptz,
  add column if not exists declined_reason text;

-- ---------------------------------------------------------------------------
-- Le vocabulaire des statuts
-- ---------------------------------------------------------------------------
-- La contrainte n'acceptait que quatre valeurs — pending, completed, cancelled,
-- stale — dont trois n'ont JAMAIS été écrites par le code. On adopte les neuf
-- états du cahier des charges, qui distinguent ce qui doit l'être : une demande
-- envoyée mais jamais ouverte n'est pas dans le même état qu'une demande
-- ouverte et non signée, et le consultant n'a pas la même chose à faire.
alter table public.signature_requests drop constraint if exists signature_requests_status_check;

-- LES DIX-SEPT DEMANDES EXISTANTES SONT ANNULÉES, explicitement.
--
-- Elles sont toutes « pending », aucune n'a jamais reçu de signature, et
-- surtout : aucune n'a jamais été annoncée à son destinataire, faute de
-- courriel. Les laisser en l'état les ferait apparaître comme des demandes
-- légitimes en attente d'un client qui n'a jamais rien reçu. Les convertir en
-- « sent » serait pire encore — cela affirmerait un envoi qui n'a pas eu lieu.
update public.signature_requests
   set status = 'cancelled',
       cancelled_at = coalesce(cancelled_at, now()),
       note = coalesce(note || ' · ', '') ||
              'Annulée à la refonte du module : aucune notification n''avait été envoyée au destinataire.'
 where status = 'pending';

alter table public.signature_requests
  add constraint signature_requests_status_check
  check (status in (
    'draft',            -- en préparation, rien n'est parti
    'ready',            -- prête à envoyer
    'sent',             -- envoyée, personne n'a encore ouvert
    'viewed',           -- au moins un destinataire a ouvert
    'partially_signed', -- au moins une signature, pas toutes
    'completed',        -- toutes les signatures attendues
    'declined',         -- un destinataire a refusé
    'cancelled',        -- retirée par le cabinet
    'expired'           -- échéance dépassée
  ));

comment on column public.signature_requests.provider is
  'Fournisseur ayant produit la demande. Conservé sur la ligne : un changement de configuration ne doit pas orpheliner les demandes ouvertes.';

-- ---------------------------------------------------------------------------
-- 2. Les destinataires
-- ---------------------------------------------------------------------------
create table if not exists public.signature_recipients (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  request_id   uuid not null references public.signature_requests(id) on delete cascade,

  -- Le rôle, repris du vocabulaire des parties à une entente : les mêmes mots
  -- décrivent les mêmes gens, et agreement_parties les porte déjà.
  role         text not null default 'client'
                 check (role in ('client','spouse','co_applicant','parent',
                                 'representative','consultant','witness','other')),
  full_name    text not null,
  email        text not null,
  -- Le permis, pour le consultant seulement. Il atteste qu'il était autorisé à
  -- représenter au moment où il a signé — et c'est précisément ce que
  -- l'ancienne implémentation oubliait d'écrire.
  rcic_number  text,

  -- Le rang de signature. Égal pour tous en mode parallèle.
  rank         integer not null default 1,

  -- ── LE LIEN DE SIGNATURE ────────────────────────────────────────────────
  -- SEULE L'EMPREINTE EST STOCKÉE. Le jeton lui-même n'existe que dans le
  -- courriel du destinataire. Une fuite de la base ne donne donc aucun lien
  -- utilisable. C'est le motif déjà éprouvé par les questionnaires.
  token_hash   text unique,
  expires_at   timestamptz,
  revoked_at   timestamptz,

  -- ── AUTHENTIFICATION ────────────────────────────────────────────────────
  -- V1 : le lien secret plus la confirmation du courriel. La colonne existe
  -- dès maintenant pour que le code à usage unique s'ajoute sans migration —
  -- le cahier des charges demande de PRÉPARER, pas d'implémenter.
  auth_method  text not null default 'email_confirm'
                 check (auth_method in ('link_only','email_confirm','email_otp','sms_otp')),

  -- ── L'ÉTAT DE CE DESTINATAIRE ───────────────────────────────────────────
  status       text not null default 'pending'
                 check (status in ('pending','viewed','signed','declined','expired')),
  sent_at      timestamptz,
  viewed_at    timestamptz,
  signed_at    timestamptz,
  declined_at  timestamptz,
  -- La signature apposée, une fois faite. Le tracé est illustratif ; ce qui
  -- fait preuve reste l'empreinte figée dans `signatures`.
  signature_id uuid references public.signatures(id) on delete set null,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Une même personne ne figure qu'une fois par demande : deux lignes pour le
  -- même courriel produiraient deux liens, deux relances, et une demande qui
  -- ne se referme jamais.
  constraint signature_recipients_unique_email unique (request_id, email)
);

create index if not exists idx_sig_recipients_request on public.signature_recipients (request_id);
create index if not exists idx_sig_recipients_firm    on public.signature_recipients (firm_id);
-- Le chemin le plus chaud du module : résoudre un jeton à chaque ouverture du
-- lien public.
create index if not exists idx_sig_recipients_token
  on public.signature_recipients (token_hash) where token_hash is not null;

alter table public.signature_recipients enable row level security;

drop policy if exists sig_recipients_firm on public.signature_recipients;
create policy sig_recipients_firm on public.signature_recipients
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id() and public.can_write());

-- Le client du portail voit les destinataires des demandes qui le concernent —
-- pour savoir qui d'autre doit signer, et où en est le document.
drop policy if exists sig_recipients_client on public.signature_recipients;
create policy sig_recipients_client on public.signature_recipients
  for select to authenticated
  using (
    public.is_portal_client()
    and request_id in (
      select r.id from public.signature_requests r
      where r.client_id = public.current_client_id()
    )
  );

comment on column public.signature_recipients.token_hash is
  'SHA-256 du jeton. Le jeton en clair n''est jamais stocké : il ne vit que dans le courriel du destinataire.';

-- ---------------------------------------------------------------------------
-- 3. Les champs à remplir
-- ---------------------------------------------------------------------------
create table if not exists public.signature_fields (
  id           uuid primary key default gen_random_uuid(),
  firm_id      uuid not null references public.firms(id) on delete cascade,
  request_id   uuid not null references public.signature_requests(id) on delete cascade,
  recipient_id uuid not null references public.signature_recipients(id) on delete cascade,

  kind         text not null
                 check (kind in ('signature','initials','full_name','date','checkbox','text')),
  label        text not null default '',
  required     boolean not null default true,
  position     integer not null default 1,

  -- LE PLACEMENT SUR LA PAGE EST FACULTATIF, et c'est un choix de portée.
  -- Poser un champ au pixel près suppose d'afficher le PDF dans le navigateur :
  -- bibliothèque de rendu, surface de glisser-déposer, gestion du zoom. C'est
  -- un chantier à lui seul. Les colonnes existent pour que ce chantier n'exige
  -- aucune migration ; en V1, les champs sont présentés à côté du document.
  page         integer,
  pos_x        numeric(8,2),
  pos_y        numeric(8,2),
  width        numeric(8,2),
  height       numeric(8,2),

  -- Ce que le destinataire a répondu. Pour une signature ou des initiales,
  -- c'est le tracé ; pour une case, « true » ; pour une date, la date.
  value        text,
  filled_at    timestamptz,

  created_at   timestamptz not null default now()
);

create index if not exists idx_sig_fields_request   on public.signature_fields (request_id);
create index if not exists idx_sig_fields_recipient on public.signature_fields (recipient_id);
create index if not exists idx_sig_fields_firm      on public.signature_fields (firm_id);

alter table public.signature_fields enable row level security;

drop policy if exists sig_fields_firm on public.signature_fields;
create policy sig_fields_firm on public.signature_fields
  for all to authenticated
  using (firm_id = public.current_firm_id())
  with check (firm_id = public.current_firm_id() and public.can_write());

drop policy if exists sig_fields_client on public.signature_fields;
create policy sig_fields_client on public.signature_fields
  for select to authenticated
  using (
    public.is_portal_client()
    and request_id in (
      select r.id from public.signature_requests r
      where r.client_id = public.current_client_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. La résolution d'un jeton — SECURITY DEFINER, et c'est nécessaire
-- ---------------------------------------------------------------------------
-- Le signataire n'a PAS de compte : c'est tout l'objet du lien public. Il ne
-- peut donc satisfaire aucune politique RLS, qui reposent toutes sur
-- current_firm_id() ou current_client_id().
--
-- Cette fonction est le SEUL point par lequel un porteur de jeton atteint la
-- base. Elle vérifie l'empreinte, l'échéance et la révocation, et ne rend que
-- ce qui est nécessaire pour afficher la page de signature — jamais le dossier,
-- jamais les autres documents du client.
--
-- L'EXPIRATION EST VÉRIFIÉE ICI, EN BASE. La vérifier dans le code applicatif
-- seulement, comme le faisait l'ancienne implémentation, laisse passer un appel
-- direct à l'API.
create or replace function public.resolve_signature_token(p_token_hash text)
returns table (
  recipient_id   uuid,
  request_id     uuid,
  firm_id        uuid,
  document_id    uuid,
  document_name  text,
  firm_name      text,
  full_name      text,
  email          text,
  role           text,
  auth_method    text,
  recipient_status text,
  request_status text,
  signing_mode   text,
  expires_at     timestamptz,
  -- Vrai quand c'est au tour de CE destinataire de signer. En mode séquentiel,
  -- personne d'autre ne peut prendre les devants.
  son_tour       boolean
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    d.id, r.id, r.firm_id, req.document_id, doc.name, f.name,
    r.full_name, r.email, r.role, r.auth_method, r.status, req.status,
    req.signing_mode, r.expires_at,
    (
      req.signing_mode = 'parallel'
      or not exists (
        select 1 from public.signature_recipients autre
        where autre.request_id = r.request_id
          and autre.rank < r.rank
          and autre.status not in ('signed', 'declined')
      )
    )
  from public.signature_recipients r
  join public.signature_requests req on req.id = r.request_id
  join public.documents doc on doc.id = req.document_id
  join public.firms f on f.id = r.firm_id
  cross join lateral (select r.id) as d(id)
  where r.token_hash = p_token_hash
    and r.revoked_at is null
    and (r.expires_at is null or r.expires_at > now())
    and req.status not in ('cancelled', 'expired', 'completed')
  limit 1;
$$;

revoke all on function public.resolve_signature_token(text) from public, anon, authenticated;
grant execute on function public.resolve_signature_token(text) to service_role;

comment on function public.resolve_signature_token is
  'Seul point d''accès d''un porteur de jeton. Vérifie empreinte, révocation et ÉCHÉANCE en base — pas seulement dans le code applicatif.';
