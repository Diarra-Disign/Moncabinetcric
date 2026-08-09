-- ============================================================================
-- Un document sans date d'expiration doit pouvoir exister
-- ============================================================================
--
-- documents.expiration était NOT NULL, sans valeur par défaut. Autrement dit :
-- AUCUN document ne pouvait entrer en base sans qu'on lui invente une date de
-- péremption.
--
-- Or la plupart n'en ont pas. Un passeport expire ; un relevé bancaire, une
-- lettre d'emploi, une entente de représentation, non. La contrainte
-- n'obligeait donc pas à dire la vérité — elle obligeait à en inventer une, et
-- cette date inventée aurait fini par faire basculer une pièce en « expirée »
-- sans raison.
--
-- Découvert en éprouvant le dépôt par le portail : le premier téléversement
-- d'un client était refusé par la base, pour un motif qui n'avait rien à voir
-- avec le portail. La table était fermée à tout le monde depuis le début, et
-- rien ne l'avait signalé parce qu'aucun document réel n'y avait encore été
-- écrit.
--
-- Trois valeurs par défaut sont posées au passage, pour que déposer une pièce
-- n'oblige pas à renseigner ce que le système sait déjà.
--
-- Idempotente.
-- ============================================================================

begin;

alter table public.documents alter column expiration drop not null;

comment on column public.documents.expiration is
  'Date de péremption, quand la pièce en a une. Nulle par défaut : la plupart n''expirent pas.';

alter table public.documents alter column status set default 'pending_review';
alter table public.documents alter column source set default 'cabinet';
alter table public.documents alter column type   set default 'Document';

commit;

-- ============================================================================
-- Contrôle après application
-- ============================================================================
--   insert into public.documents (firm_id, name, category, uploaded_by)
--   values ((select id from public.firms limit 1), 'Essai.pdf', 'consultant_upload', 'Épreuve');
--   -- doit réussir, puis :
--   delete from public.documents where name = 'Essai.pdf';
-- ============================================================================
