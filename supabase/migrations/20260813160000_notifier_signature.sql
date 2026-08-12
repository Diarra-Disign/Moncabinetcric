-- ---------------------------------------------------------------------------
-- Écrire une notification de signature
-- ---------------------------------------------------------------------------
-- LA TABLE `notifications` N'AVAIT QUE DES POLITIQUES DE LECTURE. Deux pour
-- lire, aucune pour écrire. Voilà pourquoi personne ne l'écrivait depuis sa
-- création : ce n'était pas un oubli d'appel, c'était une impossibilité.
--
-- Et ce n'est pas un défaut de conception : une notification n'est PAS écrite
-- par un utilisateur. Elle est produite par le système, en réaction à un fait.
-- Ouvrir une politique d'insertion aux comptes authentifiés permettrait à
-- n'importe quel membre de fabriquer des notifications — y compris en se
-- faisant passer pour le système.
--
-- La bonne réponse est donc une fonction, pas une politique.
--
-- LE CABINET EST RÉSOLU DEPUIS LA DEMANDE, jamais transmis. Un firm_id passé
-- en paramètre serait modifiable : on écrirait dans la boîte d'un autre
-- cabinet. C'est le même principe que `signature_event()`, et pour la même
-- raison.
--
-- SECURITY DEFINER est nécessaire ici aussi : la notification « le client a
-- signé » doit pouvoir naître d'un geste posé par un signataire qui n'a AUCUN
-- compte.

create or replace function public.notifier_signature(
  p_request_id  uuid,
  p_kind        text,
  p_title       text,
  p_body        text,
  p_link        text default null,
  p_client_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  f_id uuid;
  n_id uuid;
begin
  select r.firm_id into f_id
    from public.signature_requests r where r.id = p_request_id;

  if f_id is null then
    -- On ne lève pas : une notification manquée ne doit pas défaire l'acte qui
    -- l'a déclenchée. L'appelant verra un NULL et le consignera.
    return null;
  end if;

  insert into public.notifications
    (firm_id, profile_id, client_id, kind, title, body, link, entity_type, entity_id)
  values
    -- Adressée au CABINET quand aucun client n'est visé : n'importe quel
    -- membre peut avoir envoyé la demande, et c'est le dossier qui compte.
    -- La contrainte de la table interdit de viser les deux à la fois.
    (f_id, null, p_client_id, p_kind, p_title, p_body, p_link,
     'signature_request', p_request_id)
  returning id into n_id;

  return n_id;
end;
$$;

revoke all on function public.notifier_signature(uuid, text, text, text, text, uuid)
  from public, anon;
grant execute on function public.notifier_signature(uuid, text, text, text, text, uuid)
  to authenticated, service_role;

comment on function public.notifier_signature is
  'Dépose une notification de signature. Fonction et non politique : une notification est produite par le système, jamais par un utilisateur. Le cabinet est résolu depuis la demande.';
