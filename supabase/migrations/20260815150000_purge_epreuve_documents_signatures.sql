-- ---------------------------------------------------------------------------
-- La purge d'épreuve traverse aussi le verrou de document et le sceau de
-- signature
-- ---------------------------------------------------------------------------
--
-- `20260815140000` a ouvert la brèche dans le journal d'audit et effacé 34
-- cabinets d'épreuve sur 84. Les 50 autres se sont heurtés à DEUX AUTRES
-- garanties, aussi légitimes que la première :
--
--     42501 — Ce document est verrouillé : il a été envoyé en signature.
--     P0001 — Une signature ne peut être ni modifiée ni supprimée.
--
-- Ce sont les mêmes trois murs qu'un cabinet réel doit rencontrer, et ils
-- restent debout pour lui. La purge d'épreuve les traverse par la MÊME porte,
-- avec les MÊMES bornes — pas une porte de plus par mur, sinon la surface à
-- surveiller croîtrait à chaque garantie ajoutée.
--
-- LA BORNE N'A PAS BOUGÉ, ET C'EST LE POINT. Le drapeau `app.purge_epreuve`
-- n'est posé que par `purger_cabinet_epreuve()`, qui refuse tout cabinet dont
-- le courriel n'est pas dans un domaine réservé par la RFC 2606. Élargir ce
-- que le drapeau autorise n'élargit donc pas QUI peut l'obtenir. Le jour où
-- une quatrième garantie bloquera la purge, elle se branchera ici de la même
-- façon, et l'unique question à se reposer restera : le courriel décide-t-il
-- toujours seul ?
--
-- CE QUI RESTE INTERDIT, DANS TOUS LES CAS. La modification. Aucun de ces
-- trois déclencheurs ne laisse passer un UPDATE, drapeau ou pas. Antidater une
-- signature, réécrire une entrée de journal, substituer le contenu d'un
-- document signé : tout cela demeure impossible, pour tout le monde, y compris
-- pendant une purge. Retirer un locataire d'épreuve entier n'est pas
-- falsifier — et seule la première opération a été ouverte.

-- ---------------------------------------------------------------------------
-- 1. Le sceau des signatures
-- ---------------------------------------------------------------------------
create or replace function public.signatures_immutable()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE'
     and coalesce(current_setting('app.purge_epreuve', true), '') = 'oui' then
    return old;
  end if;
  raise exception 'Une signature ne peut être ni modifiée ni supprimée.';
end;
$$;

comment on function public.signatures_immutable is
  'Scelle une signature. Ne laisse passer qu''une suppression en bloc engagée par purger_cabinet_epreuve() sur un cabinet d''épreuve, jamais un UPDATE.';

-- ---------------------------------------------------------------------------
-- 2. Le verrou de contenu des documents
-- ---------------------------------------------------------------------------
-- Seule la branche DELETE s'assouplit. Les deux autres refus du déclencheur —
-- modifier le contenu d'un document verrouillé, retirer le verrou par un
-- simple UPDATE — restent intacts : ils répondent à `deverrouiller_document()`,
-- qui a ses propres conditions, et la purge n'a pas à s'en mêler.
create or replace function public.documents_verrou()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' then
    if old.locked_at is not null
       and coalesce(current_setting('app.purge_epreuve', true), '') <> 'oui' then
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
    if coalesce(current_setting('app.deverrouillage', true), '') <> 'oui' then
      raise exception
        'Le verrou d''un document signé ne se retire pas. Créez une nouvelle version.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.documents_verrou is
  'Fige le contenu d''un document envoyé en signature. Le verrou ne se retire que par deverrouiller_document() ; le document ne s''efface que par purger_cabinet_epreuve(), sur un cabinet d''épreuve.';
