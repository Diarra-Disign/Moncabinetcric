-- ---------------------------------------------------------------------------
-- Où signer sur un document
-- ---------------------------------------------------------------------------
-- Le contrat dessine déjà un encadré par signataire — nom imprimé, ligne pour
-- la signature, ligne pour la date. Personne ne savait où ces encadrés
-- tombaient : la page dépend de la longueur des articles, l'ordonnée du
-- contenu qui précède. Le générateur seul le sait, à l'instant où il les
-- dessine.
--
-- Cette colonne garde ce qu'il a mesuré, pour qu'on puisse plus tard apposer
-- les signatures DANS le contrat, aux emplacements qu'il prévoit, au lieu d'en
-- inventer d'autres à la fin du document.
--
-- POURQUOI SUR LE DOCUMENT ET NON SUR LA DEMANDE. Les emplacements
-- appartiennent au FICHIER : ils sont vrais dès l'émission, avant qu'aucune
-- demande de signature n'existe, et le restent si l'on en ouvre plusieurs.
-- `signature_fields` porte ensuite la projection de ces repères sur CHAQUE
-- destinataire — c'est déjà le rôle de ses colonnes page / pos_x / pos_y.
--
-- NULLABLE, ET ELLE DOIT LE RESTER. Un PDF téléversé par le cabinet n'a pas
-- d'encadrés connus : il se signera comme aujourd'hui, avec son certificat, et
-- sans tracé apposé. Rien ne doit dépendre de la présence de cette colonne.

alter table public.documents
  add column if not exists signature_anchors jsonb;

comment on column public.documents.signature_anchors is
  'Encadrés de signature mesurés par le générateur de contrat : page, boîte, ligne de signature, ligne de date. Nul pour tout document dont la mise en page n''est pas connue.';
