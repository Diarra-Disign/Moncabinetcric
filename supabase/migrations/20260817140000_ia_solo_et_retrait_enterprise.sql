-- ---------------------------------------------------------------------------
-- Le connecteur d'IA descend chez Solo, et Enterprise quitte le catalogue
-- ---------------------------------------------------------------------------
--
-- Deux décisions commerciales prises le 16 août 2026, sans rapport entre elles
-- sinon qu'elles touchent la même table.
--
-- ─── 1. L'IA CHEZ LES SOLOS ────────────────────────────────────────────────
--
-- Le connecteur était le principal écart entre Solo (49 $) et Cabinet (79 $).
-- Ce découpage privait de l'IA exactement la clientèle qui en a le plus
-- besoin : le consultant réglementé qui exerce seul, et qui n'a personne à qui
-- déléguer une recherche législative. La majorité des CRIC sont dans ce cas.
--
-- Un solo qui voulait l'IA devait passer à Cabinet et payer TROIS PLACES dont
-- il n'en utilisait qu'une. Il ne lisait pas « l'IA me coûte 30 $ de plus », il
-- lisait « on me facture deux collègues imaginaires ». Ce n'est pas une montée
-- en gamme, c'est une friction.
--
-- La différenciation repose désormais sur les places seules, ce qui se dit en
-- une phrase : même logiciel, autant d'accès qu'il vous en faut.
--
-- DEUX PORTES, ET NON UNE. C'est le piège de ce changement : le connecteur est
-- gardé à deux endroits indépendants, et n'ouvrir qu'un seul ne se voit pas
-- tout de suite.
--
--   · `plan_limits.ai_connector` — lu par connector_firm(), qui décide si une
--     clé d'API donne accès aux données du cabinet ;
--   · `plan_features` — lue par firm_has_feature(), qui décide si l'écran
--     s'affiche.
--
-- N'ouvrir que la seconde afficherait l'écran à un solo dont chaque appel
-- serait ensuite refusé. N'ouvrir que la première laisserait le connecteur
-- utilisable sans qu'aucun écran ne permette d'y créer une clé.
--
-- Ce qui NE CHANGE PAS chez Solo : `team_roles` et `priority_support` restent
-- fermés. Le premier n'aurait aucun sens sur une place unique.
--
-- ─── 2. LE RETRAIT D'ENTERPRISE ────────────────────────────────────────────
--
-- `purchasable = false`, et absent de PLANS_OCTROYABLES. Aucun chemin ne menait
-- à ce forfait : ni le paiement, ni la console d'exploitation. Il était pourtant
-- annoncé par une carte entière sur la page publique, avec un bouton.
--
-- Une offre que personne ne peut souscrire et que l'exploitant ne peut pas
-- accorder n'est pas une offre, c'est une promesse sans porte. Les grands
-- cabinets restent servis : Business n'a aucun plafond de places, à 20 $ la
-- place supplémentaire.
--
-- Retiré « pour le moment » : le contenu de ce forfait reste dans l'historique
-- git et se rejoue tel quel le jour où une vraie négociation le justifie.
--
-- Idempotente.

begin;

-- ---------------------------------------------------------------------------
-- Garde-fou : ne jamais retirer un forfait que quelqu'un occupe
-- ---------------------------------------------------------------------------
--
-- Vérifié à zéro au moment d'écrire, mais une migration se rejoue ailleurs et
-- plus tard. Supprimer sous les pieds d'un cabinet le rendrait introuvable par
-- firm_effective_plan(), donc muet sur ses droits.

do $$
declare
  occupants integer;
begin
  select count(*) into occupants from public.firms where plan = 'enterprise';
  if occupants > 0 then
    raise exception
      'Retrait impossible : % cabinet(s) sont au forfait enterprise. Déplacez-les d''abord.',
      occupants;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Le connecteur descend chez Solo — les deux portes
-- ---------------------------------------------------------------------------

update public.plan_limits
   set ai_connector = true,
       updated_at   = now()
 where plan = 'solo';

update public.plan_features
   set enabled = true
 where plan = 'solo'
   and feature = 'ai_connector';

-- Le seed de `20260808130000` posait la ligne ; si elle manquait — base neuve,
-- ordre différent — l'update ci-dessus ne ferait rien en silence.
insert into public.plan_features (plan, feature, enabled)
values ('solo', 'ai_connector', true)
on conflict (plan, feature) do update set enabled = true;

-- ---------------------------------------------------------------------------
-- 2. Enterprise quitte le catalogue
-- ---------------------------------------------------------------------------
--
-- Les fonctionnalités d'abord : `plan_features` référence le forfait, et
-- l'ordre inverse laisserait des lignes orphelines si la contrainte venait à
-- changer.

delete from public.plan_features where plan = 'enterprise';
delete from public.plan_limits   where plan = 'enterprise';

commit;
