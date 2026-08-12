-- ============================================================================
-- L'adresse postale d'un prospect et d'un client
-- ============================================================================
--
-- Le §5 du brief demande de pré-remplir un contrat avec « adresse, ville,
-- province, pays, code postal ». Aucune de ces colonnes n'existait, sauf
-- `province` sur les clients.
--
-- `clients` portait `citizenship` et `residence` — la nationalité et le pays de
-- résidence, qui servent au dossier d'immigration. Ni l'une ni l'autre n'est
-- une adresse : on ne peut pas écrire « demeurant au Canada » en tête d'une
-- entente de services et appeler ça l'identification d'une partie.
--
-- Conséquence concrète, mesurée par verifierAvantGeneration() : sans ces
-- colonnes, TOUT contrat serait refusé pour « adresse du client absente », et
-- le consultant n'aurait aucun endroit où la saisir. Le §30 demande de ne
-- jamais faire retaper une information déjà présente ; encore faut-il qu'elle
-- ait une place.
--
-- Toutes facultatives : un prospect qu'on vient d'avoir au téléphone n'a pas
-- encore donné son adresse, et le formulaire de création ne doit pas la
-- réclamer pour autant. C'est au moment de générer le contrat que le manque
-- devient bloquant — et il est alors nommé.
-- ============================================================================

begin;

alter table public.clients
  add column if not exists address     text,
  add column if not exists city        text,
  add column if not exists postal_code text,
  add column if not exists country     text;

alter table public.leads
  add column if not exists address     text,
  add column if not exists city        text,
  add column if not exists province    text,
  add column if not exists postal_code text,
  add column if not exists country     text;

comment on column public.clients.address is
  'Adresse de correspondance, pour les documents contractuels. À ne pas '
  'confondre avec « residence », qui est le PAYS de résidence et sert au '
  'dossier d''immigration.';

commit;
