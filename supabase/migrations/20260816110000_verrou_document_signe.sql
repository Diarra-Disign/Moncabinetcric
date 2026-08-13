-- ---------------------------------------------------------------------------
-- Le document SIGNÉ n'a jamais été verrouillé
-- ---------------------------------------------------------------------------
--
-- LE DÉFAUT. `finalisation.ts` appelle `verrouiller_document()` dès qu'il a
-- créé le document signé, et le commentaire au-dessus de cet appel dit :
-- « Verrouillé dès sa naissance. Un document signé ne se modifie pas — et
-- celui-ci porte les signatures. »
--
-- Il ne l'était pas. `verrouiller_document()` vérifie
-- `d.firm_id = public.current_firm_id()`, et `current_firm_id()` se résout par
-- `auth.uid()`. Or `finaliser()` est appelé depuis `conclure()`, qui emploie le
-- client de SERVICE — il n'y a pas de session, `auth.uid()` est nul, la
-- fonction rend `false`. Ce retour n'était lu nulle part.
--
-- Constaté en base au 16 août : les deux seuls documents signés existants
-- portaient `locked_at is null`. Leur contenu pouvait être remplacé et la ligne
-- supprimée — sur la pièce même qui porte les signatures.
--
-- Le verrou fonctionnait pourtant à l'ENVOI (`envoyerDemande`), qui tourne sous
-- une session de membre. C'est ce qui a masqué le défaut : les épreuves
-- vérifiaient « le document est verrouillé par l'envoi » et concluaient que le
-- mécanisme marchait.
--
-- ─── LE CORRECTIF, ET POURQUOI IL NE DESSERRE RIEN ─────────────────────────
--
-- `auth.uid() is null` signifie « aucune session ». La fonction est révoquée à
-- `public` et à `anon` : un appelant sans session détient donc nécessairement
-- la clé de service, c'est-à-dire notre propre serveur. Le contrôle de cabinet
-- garde tout son sens pour une session de membre — c'est là qu'il empêche de
-- verrouiller le document d'un tiers, le « déni de service discret » que
-- l'en-tête d'origine visait. Un appel de service, lui, ne peut venir que d'un
-- chemin qui vient d'écrire la ligne qu'il verrouille.
--
-- Le retour reste `false` si le document n'existe pas : l'appelant qui le lit
-- apprend toujours quelque chose.

create or replace function public.verrouiller_document(p_document_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  ok boolean;
begin
  if auth.uid() is null then
    -- Chemin serveur : `finaliser()` tourne sans session, avec la clé de
    -- service. Le document vient d'être créé par lui, avec le firm_id de la
    -- demande — il n'y a pas d'autre cabinet à confondre.
    select exists (
      select 1 from public.documents d where d.id = p_document_id
    ) into ok;
  else
    -- Chemin session : le cabinet est vérifié malgré SECURITY DEFINER, sans
    -- quoi un membre verrouillerait le document d'un autre cabinet.
    select exists (
      select 1 from public.documents d
      where d.id = p_document_id
        and d.firm_id = public.current_firm_id()
    ) into ok;
  end if;

  if not ok then return false; end if;

  update public.documents
     set locked_at = coalesce(locked_at, now())
   where id = p_document_id;

  return true;
end;
$$;

revoke all on function public.verrouiller_document(uuid) from public, anon;
grant execute on function public.verrouiller_document(uuid) to authenticated, service_role;

comment on function public.verrouiller_document is
  'Pose le verrou de contenu. Vérifie le cabinet pour une session de membre ; l''accepte sans session, le seul appelant possible étant alors le serveur avec la clé de service.';

-- ---------------------------------------------------------------------------
-- Rattrapage : les documents signés restés ouverts
-- ---------------------------------------------------------------------------
-- Seuls ceux qu'un `signed_document_id` désigne. C'est la colonne que
-- `finaliser()` renseigne lui-même, donc la seule preuve qu'un document est né
-- d'une signature — et donc qu'il aurait dû être verrouillé dès sa naissance.
do $$
declare
  rattrapes int;
begin
  update public.documents d
     set locked_at = now()
    from public.signature_requests r
   where r.signed_document_id = d.id
     and d.locked_at is null;

  get diagnostics rattrapes = row_count;
  raise notice 'Documents signés restés déverrouillés, désormais scellés : %.', rattrapes;
end $$;
