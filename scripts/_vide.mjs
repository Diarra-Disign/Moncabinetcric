/**
 * Module vide substitué à « server-only » dans les scripts d'épreuve.
 *
 * « server-only » lève délibérément hors d'un composant serveur React, pour
 * empêcher qu'une clé secrète parte dans un paquet destiné au navigateur.
 * Cette garde reste entière dans l'application ; elle n'a simplement aucun
 * sens dans un script en ligne de commande, qui est du serveur par nature.
 */
export {}
