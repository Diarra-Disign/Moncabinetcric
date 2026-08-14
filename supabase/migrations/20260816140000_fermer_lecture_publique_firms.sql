-- ---------------------------------------------------------------------------
-- Refermer la lecture publique de `firms`
-- ---------------------------------------------------------------------------
--
-- `firms_public_operator` ouvrait la ligne du cabinet exploitant à `anon` :
--
--     create policy firms_public_operator on public.firms
--       for select to anon, authenticated
--       using (is_platform_operator);
--
-- Son commentaire annonçait « uniquement des champs qui figurent déjà dans les
-- mentions légales ». UNE POLITIQUE POSTGRES S'APPLIQUE PAR LIGNE, JAMAIS PAR
-- COLONNE : c'est la ligne entière, ses 35 colonnes, qui était lisible sans
-- aucun compte.
--
-- Constaté avec la clé anonyme — celle que porte le navigateur de n'importe
-- quel visiteur — avant correction :
--
--     lignes visibles sans aucun compte : 1
--     email = infos@dgvimmigration.com   phone = 438 921-2020
--     plan = courtoisie   status = active   extra_seats = 0
--
-- Étaient également exposées, dès qu'elles seraient renseignées :
-- `tax_gst_number`, `tax_qst_number`, `notes` (champ libre interne),
-- `granted_by`, `suspended_at`, `suspension_notice_at`.
--
-- ─── POURQUOI CETTE POLITIQUE EXISTAIT ─────────────────────────────────────
--
-- Les mentions légales — conditions d'utilisation et politique de
-- confidentialité — nomment l'entité exploitante. Ces pages n'ont aucune
-- session : elles ne peuvent pas déduire le cabinet d'un membre connecté. La
-- lecture passait donc par la clé anonyme, d'où la politique.
--
-- ─── CE QUI LA REND INUTILE ────────────────────────────────────────────────
--
-- `lib/data/platform-firm.ts` porte `import "server-only"` depuis sa création :
-- il ne s'exécute JAMAIS dans le navigateur. Employer une clé destinée au
-- navigateur y était un réflexe, pas une nécessité. Il lit désormais par le
-- client de service, et plus rien n'a besoin que `firms` soit publique.
--
-- Les pages légales continuent de s'afficher pour un visiteur sans compte :
-- c'est le SERVEUR qui lit, puis rend le texte déjà composé. Une exigence de
-- la Loi 25, au passage — la politique de confidentialité doit être lisible
-- sans créer de compte.

drop policy if exists firms_public_operator on public.firms;

comment on column public.firms.is_platform_operator is
  'Marque l''entité qui exploite la plateforme, pour les mentions légales. NE DOIT PLUS servir de condition à une politique ouverte à anon : une politique s''applique par ligne, donc à toutes les colonnes. La lecture se fait côté serveur, cf. lib/data/platform-firm.ts.';
