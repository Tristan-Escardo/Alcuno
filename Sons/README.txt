SONS DU JEU
===========

Un fichier MP3 par moment du jeu, avec exactement ces noms :

  cartes.mp3   une carte est retournée sur le plateau
  doree.mp3    quelqu'un tire la carte dorée (coupé à 3 secondes par le jeu)
  pigeon.mp3   quelqu'un devient pigeon (premier pigeon ou nouveau pigeon ; coupé à 2 secondes par le jeu)
  tour.mp3     c'est ton tour et tu n'as toujours pas joué (toutes les 50 s, en ligne et en classique)
  eau.mp3      rappel « Bois de l'eau »
  sons_on.mp3  on active les sons dans les réglages
  credits.mp3  4 taps sur le titre ALCUNO (écran des créateurs)
  reglage_son.mp3  on lâche le curseur de volume dans les réglages (pour entendre le volume)
  no_wifi.mp3  en ligne, coupure de réseau (une seule fois, quand le logo wifi barré apparaît)
  distribuer_gorgees.mp3  +4 : on tape sur un joueur pour lui donner une gorgée (coupé à 0,8 seconde par le jeu)
  annuler_gorgees.mp3  quelqu'un annule 1 gorgée ou plus
  annuler_0_gorgees.mp3  quelqu'un tape « Annuler 0 » (il n'annule rien)
  regles.mp3   on ouvre les Règles du jeu

  tiens_gueule.mp3  le cul sec de la carte dorée (« TIENS DANS TA GUEULE »)
  bouton.mp3   petit clic quand on touche un bouton (sauf ceux qui ont déjà leur son ; coupé à 0,3 seconde par le jeu)

MUSIQUE D'AMBIANCE (en boucle, réglage « Musique d'ambiance ») :
  musique_ambiance.mp3  thèmes bordeaux, sombre, casino, nuit (et les autres si leur musique manque)
  musique_ambiance_givre.mp3     thème givre
  musique_ambiance_cerisier.mp3  thème cerisier
  musique_ambiance_prestige.mp3  thème prestige
  musique_ambiance_soleil.mp3    thème Soleil couchant
  Jusqu'à 3-4 minutes, 128 kbit/s (environ 1 Mo par minute) : elle se lance plus vite.

- Fichier absent = pas de son à ce moment-là.
- Pour changer un son : remplace le fichier en gardant le même nom, puis commit + push.
- Des sons courts et pas trop lourds (moins de 200 Ko si possible).
- Le curseur de volume des réglages s'applique à tous ces sons.
- Pour couper un son plus tôt : DUREE_MAX_SONS dans js/reglages.js (ex. { doree: 3, pigeon: 2, distribuer_gorgees: 0.8, bouton: 0.3 }).
