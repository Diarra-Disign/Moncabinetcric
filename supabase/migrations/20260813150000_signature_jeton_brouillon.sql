-- ---------------------------------------------------------------------------
-- Correctif : le lien d'un BROUILLON ne doit rien ouvrir
-- ---------------------------------------------------------------------------
-- `resolve_signature_token()` écartait les demandes annulées, expirées et
-- complétées — mais PAS les brouillons.
--
-- Conséquence : le jeton existe dès la création, et il est rendu à l'appelant.
-- Un lien fonctionnait donc AVANT que le consultant n'ait décidé d'envoyer.
-- Le cas concret n'est pas tiré par les cheveux : on prépare une demande, on
-- relit les signataires, on se ravise — et le lien engendré entre-temps ouvre
-- quand même le contrat.
--
-- Pire : le document n'est verrouillé qu'à l'ENVOI. Un brouillon ouvert était
-- donc un document encore modifiable, exposé par un lien public.
--
-- La règle devient explicite : seule une demande RÉELLEMENT PARTIE s'ouvre.
-- « viewed » et « partially_signed » restent ouvertes — ce sont des demandes
-- envoyées dont le parcours est commencé.
--
-- Attrapé par ./cric signature, qui vérifie qu'un brouillon n'ouvre rien.

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
  son_tour       boolean
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    r.id, req.id, r.firm_id, req.document_id, doc.name, f.name,
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
  where r.token_hash = p_token_hash
    and r.revoked_at is null
    and (r.expires_at is null or r.expires_at > now())
    -- SEULE UNE DEMANDE RÉELLEMENT PARTIE S'OUVRE. Un brouillon porte déjà son
    -- jeton, mais son document n'est pas encore verrouillé : l'ouvrir
    -- exposerait un contrat encore modifiable.
    and req.status in ('sent', 'viewed', 'partially_signed')
  limit 1;
$$;

revoke all on function public.resolve_signature_token(text) from public, anon, authenticated;
grant execute on function public.resolve_signature_token(text) to service_role;

comment on function public.resolve_signature_token is
  'Seul point d''accès d''un porteur de jeton. Vérifie empreinte, révocation, ÉCHÉANCE et ENVOI : un brouillon n''ouvre rien, son document n''étant pas encore verrouillé.';
