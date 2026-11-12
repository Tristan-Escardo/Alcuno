# Mode hard : décisions

Statut : en ligne dans l'appli test, puis porté dans le vrai jeu (9.88.0, cache `alcuno-v25`). Dernière mise à jour : 12 novembre.

## Règles
- Une option de plus dans « Ta partie », comme les autres modes. Se cumule avec Mode PJ et Partie express,
  **jamais avec le mode hot** (cocher l'un décoche l'autre).
- **À 2 joueurs seulement** : sinon « Jouer » (ou le lancement en ligne) affiche « Le mode hard se joue à 2 joueurs seulement. »
- Même fonctionnement que le mode hot (`partieHot` est vrai aussi en hard) : plus de cartes « 1 », un défi quand on doit boire,
  « Je le fais » / « Je bois N ». Refuser = boire les gorgées prévues.
- Paquet : celui du hot à 2 joueurs, donc **sans Cupidon** ; carte **Coup de foudre** à la Saint-Valentin :
  « un doigt dans le cul… ou un CUL SEC » (4 gorgées en mode PJ).
- Défis (`DEFIS_HOT.HA` / `DEFIS_HOT.HB` dans `js/mode-hot.js`, 20 en HA et 19 en HB, validés par l'utilisateur ; HB20 retiré, pas remplacé) :
  - **HA** (embrasser, préliminaires) : jusqu'à 4 gorgées (jusqu'à 2 en mode PJ)
  - **HB** (actes sexuels) : 5 gorgées et plus (3 et plus en mode PJ)
  - Le défi vise toujours l'autre joueur ({nom}). Les défis à {nom1} / {nom2} ne sortent pas (il faut 3 joueurs).
- Pas de « Couple de la soirée » dans le récap (2 joueurs : toujours le même couple).

## Affichage
- « Ta partie » : cadre noir, textes blancs, « hard » noir sur orange (idée 3), le même dans tous les thèmes
  avec un contour orange néon dans tous les thèmes. Texte : « On est pas là pour se titiller la bite avec des gants de boxe. »
- Bandeau : **18 barré dessiné** après ALCUNO (`SVG_18_BARRE`, js/plateau.js ; pas l'emoji 🔞 qui affiche
  « UNDER 18 » sur Android). Aussi sur la télé, dans le bloc du défi (« MODE HARD ») et la fenêtre Coup de foudre.
- Son à l'activation de l'option : Sons/mode_hard.mp3 (les autres modes jouent sons_on).
- Crédits : Jojo dans « Mention honorable » (idée du mode hard).

## Déblocage
- Caché tant qu'il n'est pas débloqué sur le téléphone : entrer **« Jojo »** comme nom de joueur (ou pseudo en ligne),
  majuscules et accents ignorés. Jojo reste un joueur normal. Clé `alcuno_hard_debloque`.
  Fenêtre « Mode hard débloqué ! » (même style que « Thème BDSM débloqué », `afficherFenetreDeblocage`).
- En ligne : seul celui qui lance la partie a besoin de l'avoir débloqué (bit 2^36 de la graine, `graineHard`).
- Lancer une partie hard débloque aussi le thème Donjon (BDSM), comme le hot.

## Zizi-coptère (`js/zizi-coptere.js`)
- Débloqué en **finissant une partie hard** (récap de fin), hôte ou pas, avec ou sans PJ / express. Clé `alcuno_zizi_coptere`.
- Fenêtre « 🚁 Zizi-coptère débloqué ! » sur le récap (style « Thème BDSM débloqué »), une seule fois par téléphone ;
  hors thème BDSM, bouton « Mettre le thème BDSM ».
- Seulement avec le **thème Donjon**, sur l'accueil : au départ devant le A d'ALCUNO (par-dessus la lettre), pointe vers le bas.
- 140 px. Touché : il tourne (de plus en plus vite tant qu'on le tient) et suit le doigt. Lâché : on peut le lancer ;
  gravité, rebonds sur les 4 bords de l'écran, frottement au sol, rotation qui ralentit peu à peu.
- Chaînes des côtés du thème Donjon retirées, et 4 objets qui tombent au lieu de 8 (sans les vibros ni le « 18 ») :
  on le confondait avec le décor.
- Son : Sons/zizicoptere.mp3 en boucle tant qu'il tourne, plus fort et plus aigu quand il tourne vite, s'éteint en
  2 s quand on le lâche (FONDU_SON_ZIZI) ; téléchargé dès qu'il s'affiche, et dans le cache hors connexion ; suit le réglage des sons du jeu.
- iPhone : le tout premier appui LONG depuis l'ouverture de l'appli reste muet (iOS ne débloque le son qu'après un appui
  court, vérifié avec un diagnostic) ; après un premier tap n'importe où, le bruit marche tout de suite.
  Petit texte « tapote-moi » (italique rose clair, léger halo rouge, sans cadre) au-dessus du zizi tant que le son est bloqué.
- Dessin : peau en dégradé brillant, anneau de cuir noir clouté à la base, halo rouge néon.

## Pilotage et stats (stats.html)
- Compteur `modes/hard` ; niveaux de défis ajoutés « HA » / « HB » ; défis du jeu HA1… masquables.
- **Règles Firebase modifiées** (`database.rules.json`) : à copier dans la console Firebase et à publier.
