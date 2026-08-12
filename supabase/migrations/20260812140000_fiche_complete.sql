-- ---------------------------------------------------------------------------
-- La fiche complète d'un client et d'un prospect
-- ---------------------------------------------------------------------------
-- DEUX CHOSES DANS CETTE MIGRATION, et la première est un CORRECTIF.
--
-- 1. address_line2 N'EXISTAIT NI SUR clients NI SUR leads. Le formulaire de
--    création écrit pourtant cette colonne depuis le lot précédent : créer un
--    prospect ou un client en remplissant « Appartement, bureau, unité » aurait
--    échoué sur « column address_line2 does not exist ». Le défaut n'a pas été
--    attrapé parce que les épreuves d'ententes insèrent directement en base,
--    sans passer par createLead() ni createClient() — un chemin éprouvé n'est
--    pas le chemin qu'emprunte l'utilisateur.
--
-- 2. LES CHAMPS QUE LA FICHE NE SAVAIT PAS PORTER. Le nom légal, la date de
--    naissance, le second téléphone et le second courriel étaient demandés par
--    le cahier des charges et n'avaient aucune colonne.
--
--    Le NOM LÉGAL n'est pas un doublon du nom : une cliente connue sous
--    « Fatou Traoré » peut signer « Fatou Traoré-Diallo », et c'est le nom du
--    passeport qui doit figurer au contrat. agreement_parties porte déjà un
--    legal_name pour cette raison ; la fiche ne pouvait pas l'alimenter.
--
--    La DATE DE NAISSANCE sert déjà à ageALaDate() : la limite d'âge d'un
--    enfant à charge se calcule à la date de dépôt, pas aujourd'hui. Elle était
--    collectée sur family_members et absente du requérant principal.
--
--    Les SECONDS moyens de contact : un client d'immigration change souvent de
--    numéro en arrivant au Canada, et perdre le premier ferait perdre le
--    dossier. On garde les deux plutôt que d'écraser.
--
-- Toutes facultatives. Une fiche se complète avec le temps ; exiger à la
-- création ce qu'on apprendra plus tard ferait inventer des réponses.

alter table public.clients
  add column if not exists address_line2   text,
  add column if not exists legal_name      text,
  add column if not exists birth_date      date,
  add column if not exists phone_secondary text,
  add column if not exists email_secondary text;

alter table public.leads
  add column if not exists address_line2   text,
  add column if not exists legal_name      text,
  add column if not exists birth_date      date,
  add column if not exists phone_secondary text,
  add column if not exists email_secondary text;

comment on column public.clients.legal_name is
  'Nom tel qu''il figure au passeport, s''il diffère du nom usuel. C''est lui qui est porté au contrat.';
comment on column public.clients.address_line2 is
  'Appartement, bureau ou unité. Omis des documents quand il est vide.';

-- ---------------------------------------------------------------------------
-- Le journal des modifications
-- ---------------------------------------------------------------------------
-- AUCUNE TABLE NEUVE. `audit_logs` existe, elle est IMMUABLE (un déclencheur
-- refuse UPDATE et DELETE) et CHAÎNÉE par empreintes — chaque ligne porte
-- l'empreinte de la précédente, si bien qu'une suppression au milieu se voit.
-- Elle comptait zéro ligne : la structure était là, rien ne l'écrivait.
--
-- C'est exactement ce que le §6 demande, et le §15 interdit d'en construire
-- une seconde à côté.
--
-- Un seul index manquait : on lit le journal PAR FICHE — « qu'est-il arrivé à
-- ce client ? » — et rien ne servait cette question.
create index if not exists idx_audit_logs_entite
  on public.audit_logs (firm_id, entity_type, entity_id, occurred_at desc);
