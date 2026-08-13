-- ---------------------------------------------------------------------------
-- Les forfaits deviennent exécutoires
-- ---------------------------------------------------------------------------
--
-- `firm_has_feature()` existe depuis le 8 août, s'administre depuis
-- /admin/catalogue, et n'était appliquée qu'à UNE fonctionnalité : le
-- connecteur d'intelligence artificielle. Basculer l'interrupteur « signature
-- électronique » d'un forfait ne changeait rien. Le catalogue décrivait une
-- offre commerciale que le produit n'appliquait pas.
--
-- ─── TROIS DÉCISIONS, ET CHACUNE COMPTE ────────────────────────────────────
--
-- 1. DES POLITIQUES RESTRICTIVES, PAS UNE RÉÉCRITURE DES EXISTANTES.
--    Les politiques permissives se combinent par OU : ajouter une politique
--    d'insertion à côté de `agreements_firm_all` n'aurait rien restreint, elle
--    aurait ouvert une seconde porte. Une politique RESTRICTIVE se combine par
--    ET. Elle s'ajoute donc sans toucher une ligne des politiques en place —
--    lesquelles continuent de porter le cloisonnement par cabinet et les
--    permissions de membre, qui ne sont pas notre affaire ici.
--
-- 2. SUR L'INSERTION SEULEMENT, JAMAIS SUR LA LECTURE.
--    Un cabinet qui rétrograde doit continuer de voir ses contrats signés et
--    son registre de fidéicommis : il en répond devant le Collège, et les lui
--    masquer transformerait une décision commerciale en défaut de tenue de
--    dossiers. Bloquer la création est le levier ; bloquer la consultation
--    serait une faute.
--
-- 3. NI SUR LA MODIFICATION.
--    Empêcher `update` piégerait le cabinet dans ce qu'il a commencé : il ne
--    pourrait plus ANNULER une demande de signature en cours, ni clore un
--    rapprochement ouvert. On l'empêche d'ouvrir de nouveaux chantiers, on ne
--    l'enferme pas dans les anciens.
--
-- ─── CE QUE CELA NE FERME PAS, ET C'EST VOULU ──────────────────────────────
--
-- Le chemin public de signature — le client qui signe par son lien — passe par
-- la clé de service et des fonctions SECURITY DEFINER, hors RLS. Une signature
-- déjà en route aboutit donc même si le cabinet perd la fonctionnalité entre
-- l'envoi et la signature. C'est le bon comportement : le client n'est pas
-- partie au contrat commercial entre le cabinet et la plateforme.
--
-- ─── AVANT D'APPLIQUER ─────────────────────────────────────────────────────
--
-- `./cric releve-droits` a été passé sur les cabinets réels : aucun ne perd
-- une fonctionnalité dont il se sert. Cette migration ne retire donc rien à
-- personne aujourd'hui. Elle rend simplement vrai ce que le catalogue annonce.

-- ---------------------------------------------------------------------------
-- Ententes de représentation
-- ---------------------------------------------------------------------------
drop policy if exists agreements_droit on public.agreements;
create policy agreements_droit on public.agreements
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'agreements'));

drop policy if exists agreement_parties_droit on public.agreement_parties;
create policy agreement_parties_droit on public.agreement_parties
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'agreements'));

-- ---------------------------------------------------------------------------
-- Signature électronique
-- ---------------------------------------------------------------------------
drop policy if exists sig_req_droit on public.signature_requests;
create policy sig_req_droit on public.signature_requests
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'esignature'));

drop policy if exists sig_recipients_droit on public.signature_recipients;
create policy sig_recipients_droit on public.signature_recipients
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'esignature'));

-- ---------------------------------------------------------------------------
-- Facturation des clients
-- ---------------------------------------------------------------------------
drop policy if exists invoices_droit on public.invoices;
create policy invoices_droit on public.invoices
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'invoicing'));

drop policy if exists invoice_lines_droit on public.invoice_lines;
create policy invoice_lines_droit on public.invoice_lines
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'invoicing'));

drop policy if exists payments_droit on public.payments;
create policy payments_droit on public.payments
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'invoicing'));

-- ---------------------------------------------------------------------------
-- Comptes en fidéicommis
-- ---------------------------------------------------------------------------
-- `trust` est aujourd'hui « toujours comprise » : la garde laisse donc passer
-- tout le monde. Elle est posée quand même, parce que le jour où un module
-- Fidéicommis se vendra à part, il n'y aura qu'un drapeau à changer — et
-- personne n'aura à se souvenir qu'il fallait aussi écrire une politique.
drop policy if exists trust_ledger_droit on public.trust_ledger;
create policy trust_ledger_droit on public.trust_ledger
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'trust'));

drop policy if exists trust_reconciliations_droit on public.trust_reconciliations;
create policy trust_reconciliations_droit on public.trust_reconciliations
  as restrictive for insert to authenticated
  with check (public.firm_has_feature(firm_id, 'trust'));
