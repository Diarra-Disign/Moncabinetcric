-- ============================================================================
-- Un cabinet ne s'accorde rien à lui-même
-- ============================================================================
--
-- `./cric sieges` a montré un propriétaire écrivant `extra_seats = 9` sur son
-- propre cabinet, et l'obtenant.
--
-- La cause : `firms_owner_update` autorise le propriétaire à modifier la ligne
-- de SON cabinet, et une politique RLS travaille sur des LIGNES, pas sur des
-- colonnes. Elle n'a jamais distingué « corriger son adresse » de « se donner
-- neuf places ». La colonne extra_seats n'a fait que rendre le défaut visible :
-- `plan`, `status`, `trial_ends_at` et `is_platform_operator` étaient exposés
-- de la même manière depuis le début.
--
-- La portée réelle mérite d'être dite. Écrire `plan = 'business'` n'accordait
-- déjà aucun droit : firm_effective_plan() lit l'abonnement payé et non cette
-- colonne — c'est le correctif de la tranche 2. Mais `extra_seats` échappait à
-- tout, et `status = 'active'` sur un cabinet suspendu aurait été plus grave
-- encore si la politique ne s'était pas appuyée sur current_firm_id(), qui se
-- referme précisément dans ce cas.
--
-- ---------------------------------------------------------------------------
-- POURQUOI UN DÉCLENCHEUR ET NON DES DROITS PAR COLONNE
-- ---------------------------------------------------------------------------
-- Postgres sait restreindre l'UPDATE colonne par colonne. Mais ce droit
-- s'attache au RÔLE, et l'exploitant comme le propriétaire de cabinet sont
-- tous deux `authenticated` : révoquer la colonne au second la retirerait au
-- premier, qui en a précisément besoin.
--
-- Le déclencheur, lui, peut interroger is_platform_admin(). Il ne refuse que
-- si la valeur CHANGE : un formulaire d'identité qui renvoie toute la ligne
-- inchangée continue de fonctionner, et le refus ne survient qu'au moment où
-- quelqu'un tente réellement quelque chose.
--
-- Idempotente.
-- ============================================================================

begin;

create or replace function public.protect_firm_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() est NULL hors session : clé de service, scripts d'exploitation,
  -- webhook Stripe. Ces chemins sont déjà privilégiés — c'est par eux que
  -- passe l'octroi légitime — et les soumettre au contrôle fermerait la porte
  -- à celui qui l'ouvre.
  if auth.uid() is null or public.is_platform_admin() then
    return new;
  end if;

  if new.extra_seats is distinct from old.extra_seats then
    raise exception 'Les places supplémentaires s''accordent par une demande, pas par une modification directe.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.plan is distinct from old.plan then
    raise exception 'Le forfait suit l''abonnement : il se change depuis Réglages → Abonnement.'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status
     or new.trial_ends_at is distinct from old.trial_ends_at
     or new.suspended_at is distinct from old.suspended_at then
    raise exception 'L''état d''accès d''un cabinet relève de l''exploitant.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Se déclarer cabinet exploitant ouvrirait les pages légales publiques et,
  -- avec elles, la lecture de cette ligne à tout le monde.
  if new.is_platform_operator is distinct from old.is_platform_operator then
    raise exception 'Cette qualité ne se déclare pas.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists firms_protect_columns on public.firms;
create trigger firms_protect_columns
  before update on public.firms
  for each row execute function public.protect_firm_columns();

commit;

-- ============================================================================
-- Contrôles après application
-- ============================================================================
--   ./cric sieges
--   -- puis, en session de propriétaire :
--   --   update public.firms set extra_seats = 9 where id = …;  → refusé
--   --   update public.firms set phone = '…' where id = …;       → accepté
-- ============================================================================
