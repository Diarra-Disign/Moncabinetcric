-- ---------------------------------------------------------------------------
-- Libérer les verrous que plus aucune demande ne justifie
-- ---------------------------------------------------------------------------
--
-- `20260815110000` a doté l'annulation d'une levée de verrou : annuler une
-- demande qui n'a rien fait signer rouvre le contrat. Cela ne vaut que pour
-- les annulations À VENIR.
--
-- Les demandes annulées AVANT gardent donc leur document figé pour toujours,
-- et rien dans l'interface n'offre de le rouvrir : la levée ne se déclenche
-- qu'au moment de l'annulation, un geste qu'on ne peut pas refaire sur une
-- demande déjà annulée. Le correctif laissait derrière lui exactement les cas
-- qu'il était censé traiter.
--
-- Un cabinet en porte un, constaté en base : une entente de consultation
-- initiale, verrouillée le 13 août, dont la demande a été annulée sans avoir
-- jamais eu le moindre destinataire.
--
-- ─── LES CONDITIONS SONT CELLES DE LA FONCTION, MOT POUR MOT ───────────────
--
-- Aucune n'est assouplie parce qu'on traite un lot plutôt qu'une pièce :
--
--   · aucune signature n'existe sur aucune demande visant ce document ;
--   · aucune demande n'a engendré de document signé ;
--   · aucune demande n'est encore en cours.
--
-- Un document verrouillé qui ne remplit pas ces trois conditions n'est PAS
-- touché — c'est-à-dire tout document qui protège réellement quelque chose.
-- Le contrôle final de cette migration compte ce qui reste verrouillé, et ce
-- nombre doit rester supérieur à zéro sur une base qui a des signatures : un
-- lot qui libère tout n'a pas trié, il a rendu les armes.

do $$
declare
  liberes int;
  restants int;
begin
  perform set_config('app.deverrouillage', 'oui', true);

  with a_liberer as (
    select d.id
      from public.documents d
     where d.locked_at is not null
       -- Une demande a bien verrouillé cette pièce : sans cela on toucherait
       -- des documents verrouillés par un autre chemin, présent ou futur.
       and exists (select 1 from public.signature_requests r where r.document_id = d.id)
       and not exists (
         select 1
           from public.signatures s
           join public.signature_requests r on r.id = s.request_id
          where r.document_id = d.id
       )
       and not exists (
         select 1 from public.signature_requests r
          where r.document_id = d.id and r.signed_document_id is not null
       )
       and not exists (
         select 1 from public.signature_requests r
          where r.document_id = d.id
            and r.status not in ('cancelled', 'declined', 'expired')
       )
  )
  update public.documents d
     set locked_at = null
    from a_liberer a
   where d.id = a.id;

  get diagnostics liberes = row_count;
  perform set_config('app.deverrouillage', '', true);

  select count(*) into restants from public.documents where locked_at is not null;

  raise notice 'Verrous orphelins libérés : %. Documents encore verrouillés : %.',
    liberes, restants;
end $$;
