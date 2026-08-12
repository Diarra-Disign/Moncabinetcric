-- ---------------------------------------------------------------------------
-- Correctif : la valeur par défaut du statut d'une demande
-- ---------------------------------------------------------------------------
-- La migration précédente a remplacé le vocabulaire des statuts sans toucher à
-- la valeur PAR DÉFAUT de la colonne, restée « pending » — une valeur que la
-- nouvelle contrainte refuse.
--
-- Conséquence immédiate, et elle n'était pas théorique : `demanderSignature()`
-- n'écrit pas de statut et comptait sur le défaut. Le bouton « Envoyer pour
-- signature » aurait échoué en production sur une contrainte de vérification,
-- avec un message que personne n'aurait su interpréter.
--
-- Attrapé par ./cric ententes, qui crée une demande de signature par ce même
-- chemin. Sans cette épreuve, le défaut serait parti en production.
--
-- POURQUOI « sent » ET NON « draft ». Le nouveau modèle distingue créer et
-- envoyer : une demande naît en brouillon, puis part. Mais l'appelant existant
-- crée ET envoie d'un même geste — son « pending » signifiait « en attente de
-- signature », c'est-à-dire « sent ». Choisir « draft » comme défaut aurait
-- silencieusement transformé ses envois en brouillons que personne n'aurait
-- jamais expédiés : un défaut pire, parce que muet.
--
-- Le service de signature, lui, écrira toujours son statut explicitement.

alter table public.signature_requests
  alter column status set default 'sent';

comment on column public.signature_requests.status is
  'Défaut « sent » : l''appelant historique crée et envoie d''un même geste. Le SignatureService pose toujours le statut explicitement.';
