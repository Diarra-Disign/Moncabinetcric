-- ---------------------------------------------------------------------------
-- Ce qu'une partie au contrat retient de son adresse — et de son permis
-- ---------------------------------------------------------------------------
-- agreement_parties porte déjà address, city, province, postal_code, country :
-- la copie figée du §6, celle qui fait qu'un déménagement ne réécrit pas un
-- contrat signé. Deux morceaux y manquaient, et ils manquaient POUR LE
-- CONSULTANT :
--
--   • le complément d'adresse (bureau, unité), qui n'existait nulle part ;
--   • le NUMÉRO DE PERMIS, qui était lu sur `firms` au moment de composer le
--     PDF. C'était une fuite de la garantie de non-rétroactivité : un permis
--     renouvelé sous un autre numéro se serait imprimé sur tous les contrats
--     déjà signés, y compris ceux qui portent l'ancien à côté d'une signature.
--
-- Facultatifs : les contrats déjà établis n'en ont pas, et le PDF retombe
-- alors sur la lecture du cabinet — ce qu'il faisait déjà.

alter table public.agreement_parties
  add column if not exists address_line2  text not null default '',
  add column if not exists license_number text not null default '';

comment on column public.agreement_parties.license_number is
  'Permis CRIC du signataire, figé à la création. Vide pour un client.';
