-- ---------------------------------------------------------------------------
-- Relier une étape d'échéancier à sa facture
-- ---------------------------------------------------------------------------
-- DEUX COLONNES, PAS UNE TABLE DE LIAISON. Une étape ne peut donner qu'UNE
-- facture, et une facture ne vient que d'UNE étape : la relation est un à un,
-- et une table intermédiaire n'apporterait qu'un niveau d'indirection.
--
-- LE STATUT N'EST PAS DUPLIQUÉ ICI, et c'est le point de cette migration.
-- `invoice_status(id)` existe déjà et calcule l'état réel — émise, partielle,
-- payée, en retard — à partir des PAIEMENTS encaissés. Recopier « payé » dans
-- l'échéancier créerait une seconde vérité qui dériverait au premier
-- encaissement saisi ailleurs : le contrat dirait « payé » et le registre
-- « il reste 500 $ ».
--
-- L'étape porte donc SEULEMENT le lien. Le statut se déduit.
--
-- `on delete set null` : une facture annulée puis supprimée ne doit pas
-- emporter l'étape du contrat. L'étape redevient simplement « à facturer ».

alter table public.invoices
  add column if not exists agreement_id   uuid references public.agreements(id) on delete set null,
  -- Le RANG de l'étape dans l'échéancier, pas son identifiant : les étapes
  -- vivent dans un jsonb et n'en ont pas. Le rang suffit, et il est stable
  -- puisqu'une entente émise ne se réordonne plus.
  add column if not exists agreement_step integer;

create index if not exists idx_invoices_agreement
  on public.invoices (agreement_id) where agreement_id is not null;

-- Une étape ne se facture qu'UNE fois. Sans cet index, deux clics sur
-- « Créer la facture » produiraient deux factures pour le même versement — et
-- le client en recevrait deux.
create unique index if not exists invoices_une_facture_par_etape
  on public.invoices (agreement_id, agreement_step)
  where agreement_id is not null and status <> 'cancelled';

comment on column public.invoices.agreement_step is
  'Rang de l''étape dans payment_schedule. Le statut de l''étape se DÉDUIT de invoice_status(), jamais recopié.';
