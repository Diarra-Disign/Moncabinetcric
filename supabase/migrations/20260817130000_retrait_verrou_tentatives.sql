-- ---------------------------------------------------------------------------
-- Retrait du verrou sur les tentatives de connexion
-- ---------------------------------------------------------------------------
--
-- `20260817120000` posait une table et une fonction destinées au crochet
-- `hook_password_verification_attempt` de Supabase Auth. Le mécanisme est
-- correct et il a été éprouvé — huit échecs verrouillent, le verrou refuse
-- même un mot de passe juste, un succès efface l'ardoise.
--
-- Il ne sera jamais appelé. L'API de gestion refuse de brancher ce crochet :
--
--   HTTP 402 — "The following auth hooks cannot be configured for this
--               organization: HOOK_PASSWORD_VERIFICATION_ATTEMPT"
--
-- Il relève d'un palier d'abonnement supérieur au forfait Pro. La vérification
-- aurait dû précéder l'écriture de la migration, pas la suivre.
--
-- On retire donc plutôt que de laisser dormir : une table et une fonction que
-- personne n'appelle finissent par être prises pour une protection active. La
-- prochaine personne qui lit ce schéma en conclurait que les connexions sont
-- protégées contre le matraquage. Elles ne le sont pas.
--
-- ─── SI LE BESOIN REVIENT ──────────────────────────────────────────────────
--
-- Le contenu de `20260817120000` reste dans l'historique git et se rejoue tel
-- quel. Deux situations le ramèneraient :
--
--   · un forfait qui débloque le crochet ;
--   · le passage de la connexion par une action de serveur, qui rendrait la
--     requête visible depuis ce serveur — la logique de comptage et de verrou
--     resterait bonne, seul l'appelant changerait.
--
-- Le drop est inconditionnel : la table est vide, aucune donnée n'est perdue.

drop function if exists public.hook_password_verification_attempt (jsonb);

drop table if exists public.tentatives_connexion;
