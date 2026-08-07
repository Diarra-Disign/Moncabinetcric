-- ============================================================================
-- Le consultant au dossier ne se devine pas
-- ============================================================================
--
-- public.matters.rcic portait « Adama Diarra » comme valeur par défaut,
-- héritée du temps où l'application ne servait qu'un seul cabinet.
--
-- Devenue multi-cabinets, elle inscrivait le nom de l'exploitant comme
-- consultant au dossier de n'importe quel cabinet dont le code aurait omis
-- la colonne. Ce champ n'est pas un libellé d'affichage : il désigne le
-- consultant réglementé responsable du dossier. L'y porter à tort n'est pas
-- une coquille, c'est attribuer à quelqu'un la responsabilité déontologique
-- d'un dossier qu'il n'a jamais vu — et, symétriquement, en décharger celui
-- qui en répond réellement.
--
-- Le défaut est retiré, la contrainte NOT NULL conservée. Une insertion qui
-- oublierait la colonne échoue désormais bruyamment, au lieu d'écrire un nom
-- que personne n'a choisi. C'est le parti pris de tout ce schéma : mieux vaut
-- un refus visible qu'une valeur plausible.
--
-- Aucune reprise de données : la table était vide au moment de l'application.
-- La requête ci-dessous ne modifie donc rien aujourd'hui ; elle existe pour
-- le cas où cette migration serait rejouée sur une base déjà peuplée.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.matters alter column rcic drop default;

comment on column public.matters.rcic is
  'Consultant réglementé responsable du dossier. Sans valeur par défaut : ce nom engage une responsabilité déontologique et doit être choisi explicitement à chaque création.';

-- Un dossier appartenant à un autre cabinet ne peut pas avoir l'exploitant
-- pour consultant : si le cas existe, il vient du défaut supprimé ci-dessus.
update public.matters m
   set rcic = ''
  from public.firms f
 where f.id = m.firm_id
   and m.rcic = 'Adama Diarra'
   and f.rcic_license_number is distinct from 'R1041776';

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   select column_default, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'matters'
--      and column_name = 'rcic';
--   -- attendu : column_default NULL, is_nullable NO
-- ============================================================================
