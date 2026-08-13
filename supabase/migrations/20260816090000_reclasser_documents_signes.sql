-- ---------------------------------------------------------------------------
-- Rendre aux documents signés la catégorie de leur original
-- ---------------------------------------------------------------------------
--
-- `finalisation.ts` écrivait `category: "contract"` en dur pour TOUT document
-- signé. Un IMM 5476 signé devenait donc un « contrat », une lettre
-- explicative signée aussi. La catégorie dit d'où vient la pièce, et signer
-- n'en change pas la provenance — cela lui ajoute des signatures.
--
-- La conséquence n'était pas cosmétique. Chaque section du dossier client est
-- une vue filtrée par catégorie : un formulaire reclassé en « contrat »
-- disparaissait de l'onglet Formulaires, et « contrat » n'était affiché nulle
-- part. Le document sortait du dossier au moment même où il devenait la pièce
-- qui compte.
--
-- Le code est corrigé pour l'avenir. Sans cette migration, tout ce qui a déjà
-- été signé resterait mal rangé — c'est-à-dire précisément les documents dont
-- on a le plus besoin.
--
-- ─── CE QUI EST TOUCHÉ, ET RIEN D'AUTRE ────────────────────────────────────
--
-- Uniquement les lignes DÉSIGNÉES par un `signature_requests.signed_document_id`.
-- Ce n'est pas une heuristique : c'est la colonne que `finaliser()` renseigne
-- lui-même, donc la seule preuve qu'un document est né d'une signature. Deviner
-- à partir de `supersedes_id` ou du suffixe « _SIGNE » aurait attrapé les
-- nouvelles versions ordinaires créées par `nouvelleVersion()`.
--
-- La catégorie est reprise de l'ORIGINAL, via `supersedes_id`. Un document
-- signé dont l'original était bien un contrat n'est donc pas modifié : la
-- clause `is distinct from` l'exclut, et le compte annoncé ne le comptera pas.
--
-- ─── POURQUOI CECI NE HEURTE PAS LE VERROU ─────────────────────────────────
--
-- Les documents signés sont verrouillés dès leur naissance. Le déclencheur
-- `documents_verrou()` fige `storage_path` et `sha256`, et refuse la
-- suppression — mais il laisse délibérément passer `category`, comme le dit
-- l'en-tête de `20260813110000` : « Renommer une pièce ou la classer ailleurs
-- ne change pas ce qui a été signé. » Aucun drapeau, aucune exception : cette
-- migration passe par la porte ordinaire.
--
-- `requirement_id` n'est PAS repris ici. L'écrire déclencherait
-- `link_upload_to_requirement`, qui remettrait à zéro la vérification de
-- pièces déjà validées par le consultant. Le correctif applicatif vaut pour
-- les signatures à venir ; le rattrapage rétroactif ferait rouvrir un travail
-- déjà fait.

do $$
declare
  reclasses int;
begin
  with signes as (
    select
      d.id,
      d.category as actuelle,
      o.category as origine
    from public.documents d
    join public.signature_requests r on r.signed_document_id = d.id
    join public.documents o on o.id = d.supersedes_id
    where o.category is not null
      and d.category is distinct from o.category
  )
  update public.documents d
     set category = s.origine
    from signes s
   where d.id = s.id;

  get diagnostics reclasses = row_count;

  raise notice 'Documents signés reclassés selon leur original : %.', reclasses;
end $$;
