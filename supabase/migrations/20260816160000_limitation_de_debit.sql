-- ---------------------------------------------------------------------------
-- Limitation de débit, tenue par la base
-- ---------------------------------------------------------------------------
--
-- L'audit n'a trouvé AUCUNE limitation : ni sur les formulaires publics, ni sur
-- les chemins à jeton, ni nulle part ailleurs.
--
-- ─── POURQUOI EN BASE, ET NON EN MÉMOIRE ───────────────────────────────────
--
-- Un compteur en mémoire de processus ne survit ni à un redéploiement, ni à
-- une seconde instance : sur un hébergement sans état, c'est une limite qui
-- s'efface toute seule et qui compte séparément selon la machine qui répond.
-- La base est déjà là, elle est partagée, et elle survit.
--
-- Un service dédié — Upstash, Redis — ferait mieux sur le volume. Il faudrait
-- ouvrir un compte, poser des secrets et ajouter une dépendance externe au
-- chemin critique. Pour quelques dizaines de cabinets, la base suffit ; le
-- jour où elle ne suffira plus, seul le corps de `limiter()` changera.
--
-- ─── FENÊTRE FIXE, ET C'EST ASSUMÉ ─────────────────────────────────────────
--
-- Le compteur se remet à zéro à chaque tranche. Un assaillant parfaitement
-- synchronisé peut donc envoyer deux fois le quota à cheval sur deux tranches.
-- Une fenêtre glissante corrigerait cela au prix d'une ligne par requête.
-- Contre ce qu'on veut arrêter ici — un formulaire public arrosé, un jeton
-- martelé — le facteur deux ne change rien.

create table if not exists public.rate_limits (
  cle       text        not null,
  fenetre   timestamptz not null,
  compte    int         not null default 0,
  primary key (cle, fenetre)
);

-- Le ménage se fait à la lecture plutôt que par une tâche planifiée : il n'y a
-- pas d'ordonnanceur dans ce projet, et une table qui grossit sans fin est une
-- panne différée.
create index if not exists rate_limits_fenetre_idx on public.rate_limits (fenetre);

alter table public.rate_limits enable row level security;
-- AUCUNE POLITIQUE, délibérément : personne ne lit ni n'écrit cette table
-- depuis une session. Seule `limiter()`, en SECURITY DEFINER, y touche.

/**
 * Compte un passage et dit s'il est autorisé.
 *
 * `true`  — sous le quota, l'appelant continue.
 * `false` — quota dépassé sur la fenêtre courante.
 *
 * Le compteur est incrémenté AVANT le verdict, et même quand il refuse : c'est
 * ce qui empêche de reprendre son souffle en insistant. Un assaillant qui
 * continue reste au-dessus du quota tant que la fenêtre court.
 */
create or replace function public.limiter(
  p_cle text,
  p_max int,
  p_secondes int
)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  debut timestamptz;
  n     int;
begin
  -- Début de la tranche courante : l'époque arrondie à la fenêtre.
  debut := to_timestamp(floor(extract(epoch from now()) / p_secondes) * p_secondes);

  insert into public.rate_limits (cle, fenetre, compte)
  values (p_cle, debut, 1)
  on conflict (cle, fenetre)
    do update set compte = public.rate_limits.compte + 1
  returning compte into n;

  -- Une chance sur cent de balayer les tranches périmées. Assez fréquent pour
  -- que la table reste petite, assez rare pour ne pas peser sur chaque appel.
  if random() < 0.01 then
    delete from public.rate_limits where fenetre < now() - interval '1 day';
  end if;

  return n <= p_max;
end;
$$;

revoke all on function public.limiter(text, int, int) from public, anon, authenticated;
grant execute on function public.limiter(text, int, int) to service_role;

comment on function public.limiter is
  'Compteur à fenêtre fixe. Renvoie false quand le quota est dépassé. Réservée à service_role : les appelants sont des actions serveur, jamais le navigateur.';
