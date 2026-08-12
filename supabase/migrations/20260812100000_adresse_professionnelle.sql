-- ---------------------------------------------------------------------------
-- L'adresse professionnelle du cabinet, en morceaux
-- ---------------------------------------------------------------------------
-- Le cabinet n'avait qu'une colonne `address` : une seule ligne de texte, où
-- le consultant tapait tout. Cela suffisait pour l'en-tête d'une facture, où
-- l'adresse n'est qu'un repère. Cela ne suffit pas pour un contrat : c'est là
-- que l'adresse IDENTIFIE le représentant, et un contrat doit pouvoir écrire
-- « Gatineau (Québec) J8X 0B9 » sans deviner où finit la ville.
--
-- `address` EST CONSERVÉE et devient la première ligne. Ce n'est pas de la
-- timidité : elle est lue par la facture, le reçu, l'état de rapprochement, la
-- soumission et l'en-tête de tous les PDF. La remplacer par un jeu de colonnes
-- neuves aurait obligé à réécrire chacun de ces chemins le même jour, et la
-- migration des données existantes aurait dû DEVINER la ville dans une chaîne
-- libre. Le §11 demande exactement l'inverse : réutiliser ce qui existe.
--
-- Toutes facultatives. Un cabinet en démarrage n'a pas encore de bureau, et
-- c'est au moment de GÉNÉRER un contrat que l'absence doit se dire — pas au
-- moment d'enregistrer ses paramètres.

alter table public.firms
  -- Appartement, bureau, unité. Séparée de la rue parce qu'elle s'imprime sur
  -- sa propre ligne quand elle existe, et disparaît quand elle n'existe pas.
  add column if not exists address_line2 text,
  add column if not exists city          text,
  add column if not exists province      text,
  add column if not exists postal_code   text,
  -- Un cabinet CRIC exerce depuis le Canada : la valeur par défaut évite de
  -- faire saisir la seule réponse possible. Elle reste modifiable.
  add column if not exists country       text default 'Canada';

comment on column public.firms.address is
  'Numéro et rue. Première ligne de l''adresse professionnelle ; les colonnes address_line2, city, province, postal_code et country la complètent.';
comment on column public.firms.address_line2 is
  'Appartement, bureau ou unité. Omise du document quand elle est vide.';
