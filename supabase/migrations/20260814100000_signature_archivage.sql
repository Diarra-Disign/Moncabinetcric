-- ---------------------------------------------------------------------------
-- Archiver une demande close, et n'en supprimer que ce qui ne prouve rien
-- ---------------------------------------------------------------------------
-- POURQUOI PAS UN STATUT « archived ».
--
-- Le cahier des charges l'admettait, et c'eût été le choix dangereux. Le
-- statut d'une demande est calculé — par `signature_recalculer_demande()` en
-- base, et par `statutDeduit()` en TypeScript, qui doivent rendre le même
-- verdict. Y glisser une dixième valeur qu'aucune des deux ne sait produire
-- aurait obligé à retoucher le déclencheur qui clôt les demandes, c'est-à-dire
-- le cœur du chemin qui fonctionne.
--
-- Une DATE d'archivage laisse le statut intact. « Annulée » reste « annulée »
-- une fois rangée, et la restauration n'a rien à restituer : il suffit
-- d'effacer la date. Le §4 demandait de conserver le statut d'origine — ici,
-- il n'a jamais été perdu.
--
-- CE QUE L'ARCHIVAGE N'EST PAS : une suppression. Aucune ligne ne bouge,
-- aucun fichier n'est retiré, le journal reste entier.

alter table public.signature_requests
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

comment on column public.signature_requests.archived_at is
  'Rangée hors de la liste courante. Le statut reste celui d''origine — annulée ou expirée. Nul = active.';

-- Les listes courantes écartent les archives : l'index sert la requête la plus
-- fréquente, pas l'exception.
create index if not exists signature_requests_actives_idx
  on public.signature_requests (firm_id, requested_at desc)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- La permission de supprimer définitivement
-- ---------------------------------------------------------------------------
-- SÉPARÉE DE `signatures.manage`, et réservée au propriétaire. Annuler une
-- demande et effacer sa trace ne sont pas le même geste : le premier se
-- rattrape, le second non. Un cabinet où trois personnes peuvent annuler ne
-- doit pas être un cabinet où trois personnes peuvent effacer.
--
-- L'archivage, lui, relève de `signatures.manage` qui existe déjà : ranger
-- n'est pas détruire.

insert into public.permissions (key, label_fr, label_en, category, rank, owner_only, description_fr)
values (
  'signatures.purge',
  'Supprimer définitivement une signature',
  'Permanently delete a signature request',
  'documents',
  (select coalesce(max(rank), 0) + 1 from public.permissions),
  true,
  'Effacer une demande annulée ou expirée qui ne porte aucune signature. Irréversible. Réservé au propriétaire du cabinet.'
)
on conflict (key) do nothing;
