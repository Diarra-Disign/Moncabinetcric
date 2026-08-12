-- ---------------------------------------------------------------------------
-- La description des services et l'échéancier des paiements
-- ---------------------------------------------------------------------------
-- Le contrat ne savait dire qu'UN nombre : les honoraires globaux. Un mandat
-- d'immigration se paie par étapes — à la signature, au dossier complet, à la
-- présentation de la demande — et le consultant n'avait aucun endroit où
-- l'écrire. Il le tapait donc à la main dans un article, ou pas du tout.
--
-- QUATRE COLONNES jsonb ET DEUX TEXTES. Pourquoi du jsonb plutôt que des
-- tables liées : ces données ne sont JAMAIS interrogées transversalement. On
-- ne demande pas « toutes les étapes de tous les contrats du cabinet » — on
-- lit les étapes D'UN contrat, toujours ensemble, toujours en entier. Et
-- surtout, elles doivent être FIGÉES avec le contrat (§26) : une table liée
-- vivrait sa vie et un ménage y toucherait, là où un instantané ne bouge que
-- si on le réécrit. C'est le même choix que `articles_snapshot`, pour la même
-- raison, et il a déjà fait ses preuves.
--
-- CE QUI N'EST PAS ICI, ET C'EST VOULU : aucun montant n'est dupliqué. Le
-- total reste `total_amount` ; l'échéancier le RÉPARTIT. Deux sources pour un
-- même nombre finissent toujours par diverger, et c'est le nombre que le
-- client paie.

alter table public.agreements
  -- La description libre du mandat (§3, §15). Un texte, pas une liste : c'est
  -- une phrase de contrat, et elle se lit d'un bloc.
  add column if not exists services_description text,

  -- Les services décomposés (§4) : [{ position, libelle }]. Facultatif — un
  -- mandat simple se décrit en une phrase et n'a pas besoin d'être listé.
  add column if not exists services_items jsonb not null default '[]'::jsonb,

  -- L'échéancier (§6, §7, §10, §12) :
  --   [{ position, description, declenchement, mode,
  --      montant, pourcentage, base, date_prevue, note, statut }]
  -- `base` vaut « montant » ou « pourcentage » : c'est ce que le consultant a
  -- SAISI. Le montant est toujours stocké calculé — un pourcentage relu et
  -- recalculé sur des honoraires modifiés changerait un contrat signé.
  add column if not exists payment_schedule jsonb not null default '[]'::jsonb,

  -- Les modes acceptés pour l'ensemble du contrat (§11).
  add column if not exists payment_methods jsonb not null default '[]'::jsonb,

  -- Les conditions particulières de paiement (§13). Facultatif.
  add column if not exists payment_conditions text,

  -- Les frais NON inclus (§14) : gouvernementaux, biométrie, traduction…
  -- Un texte libre plutôt qu'une liste fermée : ils varient par programme, et
  -- une liste fermée obligerait à écrire « autre » pour la moitié des cas.
  add column if not exists excluded_fees text;

comment on column public.agreements.payment_schedule is
  'Échéancier FIGÉ à la création, comme articles_snapshot. Montants calculés au moment de la saisie : un pourcentage recalculé plus tard modifierait un contrat signé.';
comment on column public.agreements.services_items is
  'Services décomposés, dans l''ordre. Facultatif : un mandat simple se décrit en une phrase.';
