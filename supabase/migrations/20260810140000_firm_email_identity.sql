-- ============================================================================
-- L'identité courriel du cabinet
-- ============================================================================
--
-- Jusqu'ici, tout courriel partait sous la même identité, tirée de deux
-- variables d'environnement communes à toute la plateforme. Un client recevant
-- un questionnaire voyait donc le nom de l'éditeur du logiciel, et non celui
-- de son consultant — et répondre au message n'atteignait personne.
--
-- Deux colonnes, et une limite qu'il faut dire.
--
-- reply_to_email — l'adresse du cabinet. C'est elle qui reçoit les réponses,
-- et elle accepte N'IMPORTE QUELLE adresse : répondre à un message ne demande
-- aucune autorisation technique.
--
-- email_sender_name — le nom affiché dans la boîte du destinataire.
--
-- Ce qui N'EST PAS ici, et pourquoi : l'adresse d'EXPÉDITION technique. Un
-- fournisseur de courriel n'expédie que depuis un domaine dont on a prouvé la
-- propriété par des enregistrements DNS (SPF, DKIM). Laisser un cabinet écrire
-- « moi@mondomaine.ca » dans ce champ produirait un refus du fournisseur à
-- chaque envoi — ou, pire, un message classé pourriel sans que personne ne
-- l'apprenne. L'expéditeur technique reste donc le domaine vérifié de la
-- plateforme, tandis que le NOM affiché et l'adresse de RÉPONSE sont ceux du
-- cabinet. C'est ce que fait tout logiciel de gestion, et c'est ce qui
-- délivre réellement le courriel.
-- ============================================================================

begin;

alter table public.firms
  add column if not exists reply_to_email text,
  add column if not exists email_sender_name text;

comment on column public.firms.reply_to_email is
  'Adresse du cabinet à laquelle parviennent les réponses. À défaut, celle de '
  'la plateforme, puis celle du membre qui envoie.';

comment on column public.firms.email_sender_name is
  'Nom affiché dans la boîte du destinataire. À défaut, la raison sociale.';

-- Une adresse manifestement invalide est refusée par la BASE, et non
-- seulement par le formulaire : la même colonne est écrite par l'écran des
-- paramètres, par les scripts d'administration et, demain, par le connecteur.
-- Un contrôle posé uniquement dans le formulaire n'aurait couvert que le
-- premier — et une adresse fautive ne se découvre qu'au premier envoi raté,
-- c'est-à-dire chez le client.
alter table public.firms drop constraint if exists firms_reply_to_email_valide;
alter table public.firms
  add constraint firms_reply_to_email_valide
  check (
    reply_to_email is null
    or reply_to_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$'
  );

commit;
