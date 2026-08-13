-- ---------------------------------------------------------------------------
-- Retirer le verrou d'un document qui n'a jamais rien fait signer
-- ---------------------------------------------------------------------------
--
-- LE DÉFAUT. `20260813110000_document_verrouillage.sql` pose le verrou à
-- l'envoi en signature et refuse ensuite toute modification du contenu. Son
-- message d'erreur indique la sortie :
--
--     « Annulez la demande, puis créez une nouvelle version. »
--
-- Sauf qu'annuler ne retire pas le verrou, et qu'AUCUN chemin ne le retire :
-- le déclencheur lève une exception dès que `locked_at` repasse à NULL, sans
-- condition. Un contrat envoyé par erreur, puis annulé avant que quiconque ne
-- le signe, reste figé pour toujours — impossible à corriger, impossible à
-- supprimer. Le produit conseille un geste qui n'existe pas.
--
-- Le cas se constate en base : une entente de consultation initiale porte un
-- verrou posé le 13 août, sa demande est annulée, et elle n'a jamais eu le
-- moindre destinataire ni la moindre signature.
--
-- CE QUI NE CHANGE PAS, ET C'EST L'ESSENTIEL. Le verrou existe pour empêcher
-- qu'on fasse signer une version d'un contrat puis qu'on lui substitue une
-- autre. Cette garantie tient entièrement : dès qu'une signature a été
-- apposée — une seule suffit — le verrou devient définitif. On ne libère ici
-- que ce qui n'a jamais rien prouvé.
--
-- POURQUOI UN DRAPEAU DE TRANSACTION PLUTÔT QU'UN ASSOUPLISSEMENT DU
-- DÉCLENCHEUR. Le déclencheur doit continuer de refuser un `update documents
-- set locked_at = null` venu de n'importe où, y compris du rôle de service —
-- c'est la règle du module : la garantie est en base, pas dans le code. Le
-- drapeau est posé `is_local => true`, donc il retombe à la fin de la
-- transaction : il ne peut pas rester ouvert par mégarde.

-- ---------------------------------------------------------------------------
-- 1. Le déclencheur laisse passer le seul chemin autorisé
-- ---------------------------------------------------------------------------
create or replace function public.documents_verrou()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if old.locked_at is not null then
      raise exception
        'Ce document est verrouillé : il a été envoyé en signature. Annulez la demande, puis créez une nouvelle version.'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;

  if old.locked_at is null then return new; end if;

  if new.storage_path is distinct from old.storage_path
     or new.sha256 is distinct from old.sha256 then
    raise exception
      'Le contenu d''un document envoyé en signature ne se modifie plus. Annulez la demande, puis créez une nouvelle version.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.locked_at is null then
    -- Le seul passage : `deverrouiller_document()`, qui a vérifié AVANT de
    -- poser ce drapeau qu'aucune signature n'existe. Un UPDATE direct, lui,
    -- n'a pas le drapeau et se heurte toujours au refus.
    if coalesce(current_setting('app.deverrouillage', true), '') <> 'oui' then
      raise exception
        'Le verrou d''un document signé ne se retire pas. Créez une nouvelle version.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Retirer le verrou, sous conditions vérifiées en base
-- ---------------------------------------------------------------------------
-- Rend `true` si le verrou est tombé, `false` s'il devait rester. Jamais
-- d'exception pour un refus légitime : l'appelant enchaîne souvent après une
-- annulation, et faire échouer l'annulation parce que le verrou doit rester
-- serait punir le bon geste.
create or replace function public.deverrouiller_document(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  a_signature boolean;
  encore_actif boolean;
begin
  -- Le cabinet est vérifié malgré SECURITY DEFINER, comme pour la pose : sans
  -- ce contrôle, on rouvrirait le contrat d'un autre cabinet.
  if not exists (
    select 1 from public.documents d
     where d.id = p_document_id
       and d.firm_id = public.current_firm_id()
  ) then
    return false;
  end if;

  -- UNE SEULE SIGNATURE SUFFIT À RENDRE LE VERROU DÉFINITIF. On regarde les
  -- signatures elles-mêmes, pas le statut de la demande : un statut se calcule
  -- et pourrait se tromper, une signature est un fait.
  select exists (
    select 1
      from public.signatures s
      join public.signature_requests r on r.id = s.request_id
     where r.document_id = p_document_id
  ) or exists (
    -- Le document signé engendré désigne son original : sa seule existence
    -- prouve qu'une signature a abouti.
    select 1 from public.signature_requests r
     where r.document_id = p_document_id
       and r.signed_document_id is not null
  ) into a_signature;

  if a_signature then return false; end if;

  -- Une demande encore en cours tient le verrou : c'est sa raison d'être.
  select exists (
    select 1 from public.signature_requests r
     where r.document_id = p_document_id
       and r.status not in ('cancelled', 'declined', 'expired')
  ) into encore_actif;

  if encore_actif then return false; end if;

  perform set_config('app.deverrouillage', 'oui', true);
  update public.documents set locked_at = null where id = p_document_id;
  perform set_config('app.deverrouillage', '', true);

  return true;
end;
$$;

revoke all on function public.deverrouiller_document(uuid) from public, anon;
grant execute on function public.deverrouiller_document(uuid) to authenticated, service_role;

comment on function public.deverrouiller_document is
  'Retire le verrou de contenu d''un document dont aucune demande n''a abouti. Refuse dès qu''une signature existe : le verrou protège alors une preuve. Rend false au lieu de lever, pour ne pas faire échouer l''annulation qui l''appelle.';

comment on function public.documents_verrou is
  'Fige le contenu d''un document envoyé en signature. Le verrou ne se retire que par deverrouiller_document(), qui a vérifié qu''aucune signature n''existe.';
