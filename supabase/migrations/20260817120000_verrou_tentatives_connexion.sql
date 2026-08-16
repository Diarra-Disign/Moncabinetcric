-- ---------------------------------------------------------------------------
-- Verrou sur les tentatives de connexion répétées
-- ---------------------------------------------------------------------------
--
-- L'audit du 2026-08-15 laissait un seul point ouvert : rien, dans cette
-- application, ne ralentit quelqu'un qui essaie dix mille mots de passe sur
-- « infos@dgvimmigration.com ».
--
-- Ce n'était pas un oubli. `lib/securite/limiter.ts` le documente : le
-- formulaire de connexion est un composant CLIENT qui appelle
-- signInWithPassword() directement vers Supabase. La requête ne traverse
-- jamais notre serveur, donc aucune garde écrite en TypeScript ne peut la
-- voir. Et la console Supabase n'expose aucune limite pour cet endpoint —
-- les sept réglages `rate_limit_*` couvrent les courriels, les SMS, les
-- jetons, la vérification, jamais la connexion par mot de passe.
--
-- Le seul mécanisme qui puisse intervenir est ce crochet : une fonction que
-- Supabase Auth appelle À CHAQUE vérification de mot de passe, en lui disant
-- si elle était bonne, et dont la réponse peut refuser l'accès.
--
-- ─── POURQUOI PAR COMPTE ET NON PAR ADRESSE IP ─────────────────────────────
--
-- Supabase limite déjà par IP, de son côté. Ce qu'il ne fait pas, c'est
-- compter les échecs sur UN compte donné, d'où qu'ils viennent. Or c'est
-- exactement la forme que prend une attaque sérieuse : quelques essais depuis
-- chacune de mille adresses, aucune ne dépassant jamais son propre quota.
--
-- ─── LE SEUIL, ET POURQUOI IL N'EST PAS PLUS BAS ───────────────────────────
--
-- Huit échecs en quinze minutes, puis quinze minutes de verrou.
--
-- Cinq aurait été plus sévère et plus tentant. Mais l'usager de ce logiciel
-- est un consultant réglementé qui ouvre ses dossiers un matin d'échéance
-- IRCC, avec un gestionnaire de mots de passe qui a mal rempli le champ.
-- L'enfermer dehors est un préjudice réel et immédiat ; le laisser essayer
-- huit fois ne donne rien à un attaquant, qui a besoin de milliers d'essais.
--
-- Huit est très au-dessus de l'erreur humaine, très en dessous de ce que
-- coûte une attaque par dictionnaire. Quinze minutes suffisent à rendre
-- l'exercice inutile sans transformer une faute de frappe en fin de journée.
--
-- ─── CE QUE CE VERROU NE FAIT PAS ──────────────────────────────────────────
--
-- Il ne protège pas contre l'énumération des adresses : Supabase n'appelle ce
-- crochet que lorsqu'un compte existe, puisqu'il lui faut un user_id. Une
-- adresse inconnue n'arrive jamais jusqu'ici. C'est une limite du mécanisme,
-- pas un choix, et il vaut mieux l'écrire que de la découvrir plus tard.

-- ---------------------------------------------------------------------------
-- L'ardoise
-- ---------------------------------------------------------------------------
--
-- Une ligne par compte ayant échoué au moins une fois, effacée dès qu'une
-- connexion réussit. La table reste donc minuscule : elle ne contient que les
-- comptes en cours de difficulté, jamais un historique.

create table if not exists public.tentatives_connexion (
  user_id uuid primary key references auth.users (id) on delete cascade,
  echecs integer not null default 0,
  premier_echec timestamptz not null default now(),
  verrou_jusqu_a timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.tentatives_connexion enable row level security;

-- AUCUNE POLICY, VOLONTAIREMENT.
--
-- RLS activé sans policy signifie refus total pour `anon` et `authenticated`.
-- C'est la configuration la plus stricte qui soit, et la bonne ici : cette
-- table ne doit être lue ni écrite par personne d'autre que le service
-- d'authentification. Trois tables du projet suivent déjà ce motif —
-- `rate_limits`, `stripe_events`, `audit_chain_heads`.
--
-- Une personne connectée qui pourrait lire cette table saurait quels comptes
-- sont attaqués ; une qui pourrait l'écrire lèverait son propre verrou.

revoke all on public.tentatives_connexion from anon, authenticated;
grant select, insert, update, delete on public.tentatives_connexion to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Le crochet
-- ---------------------------------------------------------------------------
--
-- Supabase appelle cette fonction APRÈS avoir vérifié le mot de passe, en lui
-- passant { user_id, valid }. Elle répond « continue » — Supabase poursuit son
-- cours normal — ou « reject » avec un message rendu à l'appelant.
--
-- L'ordre des trois cas compte :
--
--   1. Un verrou en cours refuse MÊME UN MOT DE PASSE JUSTE. Sans cela, un
--      attaquant qui finit par trouver le bon entrerait malgré le verrou, et
--      celui-ci n'aurait servi qu'à ralentir la découverte, pas à empêcher
--      l'entrée.
--
--   2. Un mot de passe juste, hors verrou, efface l'ardoise. Compter les
--      échecs d'un usager qui se connecte normalement finirait par le
--      verrouiller sur des fautes de frappe étalées sur des semaines.
--
--   3. Un mot de passe faux incrémente, dans une fenêtre glissante.
--
-- Le message de refus n'est pas une phrase mais un jeton : « verrou:12 ».
-- L'interface le traduit dans la langue de la page — le crochet, lui, ne sait
-- pas si la personne lit le français ou l'anglais. Et un jeton qui fuirait
-- n'apprendrait rien à personne.

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  seuil constant integer := 8;
  fenetre constant interval := interval '15 minutes';
  duree constant interval := interval '15 minutes';

  uid uuid := (event -> 'user_id') #>> '{}';
  reussi boolean := coalesce((event ->> 'valid')::boolean, false);

  ligne public.tentatives_connexion%rowtype;
  restant integer;
begin
  -- Un événement sans compte identifiable ne se devine pas : on laisse
  -- Supabase suivre son cours plutôt que de refuser à l'aveugle.
  if uid is null then
    return jsonb_build_object('decision', 'continue');
  end if;

  select * into ligne from public.tentatives_connexion where user_id = uid;

  -- 1. Verrou en cours : refus, quel que soit le mot de passe présenté.
  if ligne.verrou_jusqu_a is not null and ligne.verrou_jusqu_a > now() then
    restant := ceil(extract(epoch from (ligne.verrou_jusqu_a - now())) / 60);
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'verrou:' || greatest(restant, 1)
    );
  end if;

  -- 2. Mot de passe juste : l'ardoise est effacée.
  if reussi then
    delete from public.tentatives_connexion where user_id = uid;
    return jsonb_build_object('decision', 'continue');
  end if;

  -- 3. Échec. La fenêtre est glissante : un premier échec trop ancien remet
  --    le compteur à un plutôt que d'additionner des semaines d'étourderies.
  insert into public.tentatives_connexion as t (user_id, echecs, premier_echec, updated_at)
  values (uid, 1, now(), now())
  on conflict (user_id) do update
    set echecs = case
                   when t.premier_echec < now() - fenetre then 1
                   else t.echecs + 1
                 end,
        premier_echec = case
                          when t.premier_echec < now() - fenetre then now()
                          else t.premier_echec
                        end,
        verrou_jusqu_a = null,
        updated_at = now()
  returning * into ligne;

  -- Le seuil est atteint : on pose le verrou et on le dit tout de suite,
  -- plutôt que de laisser découvrir au coup suivant.
  if ligne.echecs >= seuil then
    update public.tentatives_connexion
       set verrou_jusqu_a = now() + duree, updated_at = now()
     where user_id = uid;

    return jsonb_build_object(
      'decision', 'reject',
      'message', 'verrou:' || ceil(extract(epoch from duree) / 60)
    );
  end if;

  -- Sous le seuil : Supabase refusera de lui-même, avec son message habituel.
  return jsonb_build_object('decision', 'continue');
end;
$$;

-- Seul le service d'authentification appelle ce crochet. L'ouvrir plus
-- largement permettrait à un compte connecté de sonder l'état des verrous, ou
-- d'en provoquer par des appels directs.
revoke execute on function public.hook_password_verification_attempt (jsonb) from anon, authenticated, public;
grant execute on function public.hook_password_verification_attempt (jsonb) to supabase_auth_admin;

grant usage on schema public to supabase_auth_admin;
