-- ---------------------------------------------------------------------------
-- La permission de gérer les signatures
-- ---------------------------------------------------------------------------
-- UNE SEULE PERMISSION DE PLUS, pas six. Le cahier des charges en proposait
-- six — view, create, send, cancel, download, manage. `signatures.request`
-- existe déjà et couvre demander et envoyer.
--
-- Reste à distinguer un geste : ANNULER une demande ou RÉVOQUER un lien. Ce
-- n'est pas la même chose que d'en ouvrir une — cela retire quelque chose qui
-- circule déjà, parfois chez le client.
--
-- La LECTURE suit l'accès au dossier : quelqu'un qui voit le dossier voit où en
-- sont ses signatures. Une permission de lecture séparée produirait surtout des
-- écrans à moitié vides et des refus incompréhensibles, dans un cabinet où
-- trois personnes travaillent.

insert into public.permissions (key, label_fr, label_en, category, rank, owner_only, description_fr)
values (
  'signatures.manage',
  'Annuler une signature',
  'Cancel a signature request',
  'documents',
  (select coalesce(max(rank), 0) + 1 from public.permissions),
  false,
  'Annuler une demande de signature en cours et révoquer les liens déjà transmis. Demander une signature relève de « signatures.request ».'
)
on conflict (key) do nothing;

-- Le propriétaire l'a de plein droit — member_can() le lui accorde sans ligne.
-- On la donne au consultant réglementé : c'est lui qui répond du document, donc
-- lui qui doit pouvoir le retirer.
insert into public.role_permissions (cicc_role, permission, granted)
select r, 'signatures.manage', true
from (values ('rcic')) as t(r)
on conflict (cicc_role, permission) do nothing;
