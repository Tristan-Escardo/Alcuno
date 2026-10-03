SONS DU JEU
===========

Un fichier MP3 par moment du jeu, avec exactement ces noms :

  cartes.mp3   une carte est retournée sur le plateau
  doree.mp3    quelqu'un tire la carte dorée (coupé à 3 secondes par le jeu)
  pigeon.mp3   quelqu'un devient pigeon (premier pigeon ou nouveau pigeon ; coupé à 2 secondes par le jeu)
  tour.mp3     en ligne, c'est ton tour
  eau.mp3      rappel « Bois de l'eau »
  sons_on.mp3  on active les sons dans les réglages
  credits.mp3  4 taps sur le titre ALCUNO (écran des créateurs)
  reglage_son.mp3  on lâche le curseur de volume dans les réglages (pour entendre le volume)
  no_wifi.mp3  en ligne, coupure de réseau (une seule fois, quand le logo wifi barré apparaît)
  distribuer_gorgees.mp3  +4 : on tape sur un joueur pour lui donner une gorgée

Pas de son pour le cul sec de la carte dorée (« TIENS DANS TA GUEULE »).

- Fichier absent = pas de son à ce moment-là.
- Pour changer un son : remplace le fichier en gardant le même nom, puis commit + push.
- Des sons courts et pas trop lourds (moins de 200 Ko si possible).
- Le curseur de volume des réglages s'applique à tous ces sons.
- Pour couper un son plus tôt : DUREE_MAX_SONS dans script.js (ex. { doree: 3, pigeon: 2 }).
