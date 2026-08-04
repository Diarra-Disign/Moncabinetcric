-- L'échéance d'un dossier n'est pas connue à son ouverture.
--
-- La colonne était NOT NULL, si bien qu'ouvrir un dossier imposait une date
-- limite avant même de savoir de quel programme il relève. Le formulaire s'en
-- tirait en n'écrivant rien du tout : il annonçait « Nouveau dossier créé
-- avec succès et synchronisé sur le Registre CICC » et fermait la fenêtre,
-- sans insertion. La contrainte n'a jamais gêné personne parce que rien ne
-- l'atteignait.
--
-- Une échéance inventée dans un dossier d'immigration est pire qu'une
-- échéance absente : elle se retrouve dans les rappels, et une date fausse
-- qui rassure vaut moins que pas de date du tout. La colonne devient donc
-- nullable, et l'affichage montre un tiret tant qu'aucune date n'est fixée.

alter table public.matters
  alter column deadline drop not null;

comment on column public.matters.deadline is
  'Échéance du dossier. NULL tant qu''aucune date n''est fixée — ne jamais y écrire une date de remplissage.';
