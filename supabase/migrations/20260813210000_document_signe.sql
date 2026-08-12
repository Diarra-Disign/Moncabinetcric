-- ---------------------------------------------------------------------------
-- Le document signé, désigné plutôt que deviné
-- ---------------------------------------------------------------------------
-- La demande retrouvait son document signé en cherchant, dans `documents`, une
-- ligne qui remplace l'originale et qui est verrouillée. Cela marchait, mais
-- par déduction — et une déduction se trompe le jour où une seconde version
-- apparaît pour une autre raison.
--
-- Une colonne le DÉSIGNE. C'est un fait, pas une inférence.

alter table public.signature_requests
  add column if not exists signed_document_id uuid
    references public.documents(id) on delete set null;

create index if not exists idx_signature_requests_signe
  on public.signature_requests (signed_document_id)
  where signed_document_id is not null;

comment on column public.signature_requests.signed_document_id is
  'Le PDF final — pages d''origine plus page de certificat. Désigné et non déduit : une déduction se trompe dès qu''une seconde version apparaît.';
