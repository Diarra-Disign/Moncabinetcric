-- ---------------------------------------------------------------------------
-- « Autres documents » : une catégorie de plus, rien de retiré
-- ---------------------------------------------------------------------------
-- Le dossier accepte aujourd'hui cinq catégories : ce que le client dépose, ce
-- que le cabinet dépose, les contrats, les factures et les formulaires IRCC.
-- Il manquait la sixième — celle du document qui n'entre dans aucune : une
-- lettre explicative, une correspondance reçue d'une autorité, une pièce
-- justificative qu'aucun programme n'exige.
--
-- CE QUI CHANGE : une valeur ajoutée à la contrainte, une colonne de plus.
-- AUCUNE valeur existante n'est retirée, aucune ligne n'est réécrite. Les
-- catégories, les types, les pièces exigées et les listes de contrôle sont
-- exactement ce qu'ils étaient.
--
-- POURQUOI UNE COLONNE `description` ET NON UN RÉEMPLOI DE `type`.
-- `type` porte une ÉTIQUETTE — « Formulaire », « Entente de service » — et
-- sert au tri et au filtrage. Y loger une phrase du consultant mêlerait deux
-- natures dans la même colonne : le jour où l'on voudra filtrer par type, la
-- liste serait polluée de phrases entières.

alter table public.documents
  drop constraint if exists documents_category_check;

alter table public.documents
  add constraint documents_category_check
  check (category in (
    'client_upload', 'consultant_upload', 'contract', 'invoice', 'ircc_form',
    -- La sixième. Générique par dessein : c'est le NOM du document qui le
    -- distingue, pas sa catégorie. Voir le §19 du cahier des charges.
    'other'
  ));

alter table public.documents
  add column if not exists description text;

comment on column public.documents.description is
  'Note libre du consultant sur la pièce. Facultative. Distincte de `type`, qui reste une étiquette servant au tri.';
