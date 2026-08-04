-- Nature détaillée d'un document, en plus de son origine.
--
-- `category` ne dit que d'où vient le fichier : cinq valeurs, dont
-- « client_upload » qui recouvre aussi bien un passeport qu'un relevé
-- bancaire. `doc_type` dit ce que le fichier est.
--
-- La colonne est nullable et sans contrainte de valeurs : la liste des types
-- vit dans lib/data/document-types.ts et bougera avec la pratique et les
-- numéros de formulaires IRCC. Une contrainte CHECK ici obligerait à une
-- migration à chaque ajout, et ferait échouer une insertion légitime plutôt
-- que de laisser passer une valeur simplement inconnue de la base.
--
-- Les fiches existantes gardent doc_type NULL : l'origine reste connue, la
-- nature ne l'est pas rétroactivement. On ne devine pas.

alter table public.documents
  add column if not exists doc_type text;

comment on column public.documents.doc_type is
  'Nature détaillée du document (identifiant issu de lib/data/document-types.ts). NULL = non renseignée.';

create index if not exists documents_doc_type_idx
  on public.documents (firm_id, doc_type)
  where doc_type is not null;
