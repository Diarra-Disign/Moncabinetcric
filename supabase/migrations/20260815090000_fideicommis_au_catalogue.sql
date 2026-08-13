-- ---------------------------------------------------------------------------
-- Le fidéicommis entre au catalogue des fonctionnalités
-- ---------------------------------------------------------------------------
--
-- Le module existe depuis `20260809100000_payments_and_trust.sql` : registre,
-- solde par client, interdiction de découvert, rapprochement bancaire. Il ne
-- figurait nulle part dans `features` — donc nulle part dans l'écran du
-- catalogue, ni dans ce qu'un forfait peut dire qu'il comprend. Une capacité
-- construite mais absente de l'inventaire commercial est une capacité qu'on
-- oublie de vendre, et c'est exactement ce qui est arrivé : la page publique
-- ne la mentionnait pas.
--
-- POURQUOI `always_on = true`, ET NON UN PALIER
--
-- Parce que c'est l'état RÉEL d'aujourd'hui. Aucun écran n'appelle
-- `firm_has_feature(_, 'trust')` : la barre latérale ouvre /fideicommis à tous
-- les cabinets, et seule la permission `trust.manage` restreint l'écriture.
-- L'inscrire à `false` pour Solo ne documenterait pas le produit, cela le
-- MODIFIERAIT — en retirant à des cabinets déjà abonnés un module dont ils se
-- servent peut-être ce mois-ci pour leur rapprochement.
--
-- Il y a un second motif, plus solide que le premier. Le compte en fidéicommis
-- répond à une obligation déontologique du consultant réglementé : les sommes
-- reçues d'avance ne lui appartiennent pas, et il doit pouvoir en rendre
-- compte. C'est le même raisonnement que pour `audit_log` juste au-dessus —
-- placer derrière un palier de quoi tenir ses livres reviendrait à vendre la
-- conformité, et à laisser un confrère sur le forfait d'entrée sans de quoi
-- répondre à une vérification du Collège.
--
-- CE QUE CETTE MIGRATION PRÉPARE
--
-- Un futur « Module Fidéicommis » facturé à part ne demandera plus de
-- migration du module lui-même : il suffira de passer `always_on` à false et
-- de garnir `plan_features`, `firm_has_feature()` faisant déjà le reste. La
-- mécanique d'exception par cabinet (`firm_feature_overrides`) s'appliquera
-- sans une ligne de plus. Rien n'est vendu aujourd'hui ; le crochet existe.
--
-- Effet immédiat sur le produit : AUCUN. `firm_has_feature(_, 'trust')`
-- renvoyait déjà `false` sans être appelé nulle part, et renverra `true` sans
-- l'être davantage. La seule différence visible est une ligne de plus dans la
-- colonne « toujours comprises » de /admin/catalogue — où l'écran refuse déjà
-- de basculer une fonctionnalité `always_on`.

insert into public.features (key, label_fr, label_en, category, rank, always_on, description_fr, description_en)
values (
  'trust',
  'Comptes en fidéicommis',
  'Trust accounts',
  'conformite',
  45,
  true,
  'Registre ventilé par client, découvert impossible, et rapprochement bancaire arrêté période par période. Répond à l''obligation de rendre compte des sommes reçues d''avance : jamais conditionné à un forfait.',
  'Per-client ledger, overdrafts refused, and bank reconciliation closed period by period. Meets the duty to account for funds received in advance: never gated behind a plan.'
)
on conflict (key) do update set
  label_fr       = excluded.label_fr,
  label_en       = excluded.label_en,
  description_fr = excluded.description_fr,
  description_en = excluded.description_en,
  category       = excluded.category,
  rank           = excluded.rank,
  always_on      = excluded.always_on;

-- Chaque forfait reçoit la ligne, comme pour toute fonctionnalité toujours
-- comprise. Redondant tant qu'`always_on` tient — mais le jour où la
-- fonctionnalité devient vendable, l'absence de ligne la retirerait à tout le
-- monde d'un coup au lieu de laisser une décision à prendre forfait par
-- forfait.
insert into public.plan_features (plan, feature, enabled)
select p.plan, 'trust', true
  from public.plan_limits p
on conflict (plan, feature) do update set enabled = true;
