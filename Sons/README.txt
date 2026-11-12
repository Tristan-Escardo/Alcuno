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
  accessibilite_on.mp3  on active « Accessibilité pour les gens bourrés » dans les réglages
  etoile.mp3   on touche l'étoile filante de l'accueil (découverte de l'album de stickers)

  tiens_gueule.mp3  le cul sec de la carte dorée (« TIENS DANS TA GUEULE »)
  bouton.mp3   petit clic quand on touche un bouton (sauf ceux qui ont déjà leur son ; coupé à 0,3 seconde par le jeu)
  sabre/sabre/*.mp3  sons de sabre de 0,6 s : un au hasard à la place du clic des boutons, dans le thème Star Wars seulement. Supprime ceux que tu n'aimes pas (fichier absent = ignoré).
  (lightsaber_sound.mp3 = le fichier d'origine de 45 s, plus utilisé par le jeu)
  bdsm_buttons/*.mp3  un au hasard à la place du clic des boutons, dans le thème BDSM seulement (liste SONS_BDSM dans js/reglages.js et dans sw.js).
  saxo/*.mp3  sons de saxophone de 0,39 à 0,89 s (découpés dans un enregistrement) : un au hasard à la place du clic des boutons, dans le thème de fête « Fête de la musique » seulement (liste SONS_SAXO dans js/reglages.js et dans sw.js).
  piano/piano_<touche>.mp3  les 15 notes du petit piano de l'accueil (thème Fête de la musique) : de
    Fa 4 à Sol 5, 0,9 s chacune. « d » = dièse (piano_la4d.mp3 = La dièse 4). Un tap sur une touche joue sa note
    (js/piano-accueil.js). Ce ne sont pas des enregistrements : elles sont synthétisées, en tempérament égal.

MUSIQUE D'AMBIANCE (en boucle, réglage « Musique d'ambiance ») :
  musique_ambiance.mp3  thèmes bordeaux, casino, nuit (et les autres si leur musique manque)
  musique_ambiance_givre.mp3     thème givre
  musique_ambiance_cerisier.mp3  thème cerisier
  musique_ambiance_prestige.mp3  thème prestige
  musique_ambiance_soleil.mp3    thème Soleil couchant
  musique_ambiance_sombre.mp3    thème Sombre (boucle exacte, voir BOUCLES_EXACTES dans js/reglages.js)
  musique_ambiance_galaxie.mp3   thème Star Wars (boucle exacte de 2 min 59, voir BOUCLES_EXACTES)
  musique_ambiance_kawaii.mp3    thème secret Kawaii (boucle exacte de 1 min 33, voir BOUCLES_EXACTES)
  musique_ambiance_bdsm.mp3      thème secret BDSM (boucle exacte de 1 min 42, voir BOUCLES_EXACTES)
  musique_ambiance_valentin.mp3  thème de fête Saint-Valentin (boucle exacte de 2 min 04,8, voir BOUCLES_EXACTES)
  musique_ambiance_noel.mp3      thème de fête Noël (boucle exacte, voir BOUCLES_EXACTES)
  musique_ambiance_patrick.mp3   thème de fête Saint-Patrick (boucle exacte de 1 min 04,9, voir BOUCLES_EXACTES)
  musique_ambiance_justrose.mp3  thème de fête Just Rosé (boucle exacte de 1 min 50,2, voir BOUCLES_EXACTES)
  musique_ambiance_musique.mp3   thème de fête Fête de la musique (boucle exacte de 36,96 s, voir BOUCLES_EXACTES)
  Jusqu'à 3-4 minutes, 128 kbit/s (environ 1 Mo par minute) : elle se lance plus vite.

GÉNÉRIQUE DU THÈME SECRET STAR WARS (au volume des sons, la musique d'ambiance se tait pendant) :
  debloquage_theme_galaxie.mp3  boucle exacte (voir BOUCLES_EXACTES dans js/reglages.js)

  mode_hard.mp3                  on active le Mode hard dans « Ta partie »
  zizicoptere.mp3                zizi-coptère du thème BDSM : en boucle tant qu'il tourne (js/zizi-coptere.js)

- Fichier absent = pas de son à ce moment-là.
- Pour changer un son : remplace le fichier en gardant le même nom, puis commit + push.
- Des sons courts et pas trop lourds (moins de 200 Ko si possible).
- Le curseur de volume des réglages s'applique à tous ces sons.
- Pour couper un son plus tôt : DUREE_MAX_SONS dans js/reglages.js (ex. { doree: 3, pigeon: 2, distribuer_gorgees: 0.8, bouton: 0.3 }).
