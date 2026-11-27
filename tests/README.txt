TESTS DU JEU
============

À lancer avant de publier une modification, pour vérifier qu'on n'a rien cassé.
Il faut Google Chrome installé à l'endroit habituel (C:\Program Files\Google\Chrome\Application\chrome.exe).
Les tests ouvrent Chrome sans fenêtre et jouent tout seuls.

Tout lancer d'un coup (environ 10 minutes)
------------------------------------------
  Dans PowerShell, depuis le dossier tests :  powershell -File tout_tester.ps1
     -enLigne : ajoute les tests en ligne (vrai Firebase, environ 15 minutes de plus)
     -rapide  : lisibilité seulement sur Givre et Bordeaux (au lieu des 8 thèmes)

  Lance les tests ci-dessous l'un après l'autre (et le petit serveur web des tests de sons), vérifie
  la sortie de chacun et affiche un résumé. Résultat attendu : « TOUT EST OK ».
  La sortie complète de chaque test est gardée dans tests/resultats/ (ignoré par git).

Démarrage rapide (30 secondes, Linux / macOS / Windows)
-------------------------------------------------------
  npm i playwright && npx playwright install chromium     (une seule fois)
  node tests/test_demarrage.js

  Vérifie que le jeu démarre sans erreur dans chaque thème, que l'aide du début arrive tout de suite,
  que l'écran d'installation Android attend Chrome, que le déblocage Star Wars marche et que ses phrases
  ne sortent que dans ce thème. Résultat attendu : « TOUT EST OK ». GitHub le lance aussi à chaque
  push (onglet Actions, « Tests de démarrage »).

Duel Shifumi en mode classique (2 minutes, Linux / macOS / Windows)
-------------------------------------------------------------------
  node tests/test_shifumi_classique.js
     THEME=givre : dans un autre thème ; CAPTURES=dossier : garde des captures

  Un seul téléphone : chacun son tour choisit, une carte Shifumi de dos apparaît à chaque choix, puis elles se
  retournent. Vérifie aussi le dos de chaque thème, l'égalité ×2, les gorgées, un bot dans le duel, et qu'une partie
  coupée en plein Shifumi se reprend à l'identique. Résultat attendu : « TOUT EST OK ».

Duel Shifumi en mode hot et hard (1 minute, Linux / macOS / Windows)
--------------------------------------------------------------------
  node tests/test_shifumi_hot.js

  Le défi proposé au perdant suit les gorgées finales, égalités comprises (×2, ×4…) : hot A jusqu'à 4, B de 5 à 10,
  C au-dessus ; hard HA jusqu'à 4, HB au-dessus ; aussi en mode PJ (moitié des gorgées, 10 au plus).
  Résultat attendu : « TOUT EST OK ».

Duel Réflexe en mode classique (3 minutes, Linux / macOS / Windows)
--------------------------------------------------------------------
  node tests/test_reflexe_classique.js
     CAPTURES=dossier : garde des captures

  Un seul téléphone posé entre les deux : écran coupé en deux (la moitié du haut à l'envers), la carte en jeu au
  milieu, puis « TAPE ! » en gros au bout d'un temps au hasard ; le premier qui tape ensuite gagne. Vérifie : les 3 duels
  proposés, le faux départ, que « TAPE ! » attend la fin de la barre « Mauvais joueur ? » (qui cache la zone du bas), que
  les taps qui continuent ne sautent ni le résultat, ni l'annonce « X boit… », ni ne choisissent un « Annuler N », un
  bot qui tape tout seul, et la reprise d'une partie coupée (temps gardés dans les actions). Résultat attendu : « TOUT EST OK ».

Spectateur en ligne (10 secondes, Linux / macOS / Windows)
----------------------------------------------------------
  node tests/test_spectateur.js

  « Regarder une partie » (mode en ligne) avec un Firebase simulé en mémoire : écran sans pseudo, salle d'attente
  sans ✕ ni « Lancer », manche qui démarre ou rattrapée en cours de route, aucune écriture dans la partie, aucune
  action possible, départ sans toucher à la liste des joueurs. Lancé aussi par GitHub.

Profil joueur (30 secondes, Linux / macOS / Windows)
----------------------------------------------------
  node tests/test_profil.js

  Le profil joueur (js/profil.js) : la fusion entre le téléphone et le profil, les règles Firebase, puis le parcours dans le
  jeu avec un Firebase et un compte Google simulés : connexion, sauvegarde d'un réglage, récupération sur un second téléphone
  (déblocages et stickers réunis, réglages repris), reconnexion au lancement, base en panne, déconnexion, suppression.
  Ne teste PAS la vraie fenêtre Google : à vérifier à la main sur un vrai téléphone (voir PILOTAGE.md). Lancé aussi par GitHub.

Parties complètes du robot (1 à 2 minutes, Linux / macOS / Windows)
-------------------------------------------------------------------
  node tests/test_partie_robot.js

  Le robot (prelude.js + joueur_auto.js) joue une partie complète dans 4 configurations : téléphone debout,
  téléphone en paysage, avec le réglage d'accessibilité, et très petit écran. Chaque partie doit arriver à
  l'écran de fin sans erreur et sans que la page déborde. Lancé aussi par GitHub (job « partie-robot »).

Tout l'affichage dans UN thème : téléphone et télé (pour vérifier un nouveau thème, ex. un thème de fête)
-------------------------------------------------------------------------------------------------------
  (le test lance son propre serveur web, sur le dossier du jeu qui contient ce test ; URL_JEU=http://… pour tester une page déjà en ligne)
  node tests/test_affichage_telephone.js kawaii    tous les écrans du téléphone (environ 3 minutes)
  node tests/test_affichage_tele.js kawaii         tous les écrans de la télé (environ 2 minutes)

  Téléphone : ouvre chacun des écrans et des fenêtres du jeu (accueil, réglages, règles, FAQ, album, en ligne, caster,
  scan, bug, installation, confirmations, plateau, volets, pigeon, duel, +4, couleur, Cupidon, défi hot, carte dorée,
  annulation, pari, fin de partie… : environ 60). Télé : un robot joue une partie en mode hot, chaque écran qu'il
  enverrait à la télé est redessiné sur une vraie page télé, plus les écrans rares forcés (carte dorée, annulation,
  pause, mode PJ…). Pour chaque écran, comparé au même écran SANS thème, il signale :
     MOINS LISIBLE   un texte que le thème rend moins lisible (contraste sous 3)
     BOUTON OUBLIÉ   un bouton resté au jaune de base alors que le thème habille les autres (téléphone)
     DÉBORDE         la page défile en largeur (téléphone), du texte sort de l'écran (télé)
     ERREUR JS       une erreur JavaScript
  Un écran ajouté plus tard dans index.html est visité tout seul ; une fenêtre que le test ne sait pas ouvrir est signalée.
  Chaque écran est photographié : ouvrir tests/resultats/affichage_telephone/<thème>/index.html (ou affichage_tele) dans
  un navigateur pour tout voir d'un coup. Le test dit si c'est cassé, oublié ou illisible, pas si c'est joli : la planche
  est faite pour ça. Exceptions voulues (bouton ou texte volontairement comme ça) : dans tests/affichage_commun.js.
  Limites : l'écran d'attente de la télé est toujours en Bordeaux (voulu) ; le contraste est calculé sur les couleurs
  (une ombre de texte ou un flou d'arrière-plan qui aide à lire n'est pas pris en compte).

Compatibilité des thèmes (boutons oubliés par un thème, environ 10 minutes avec la partie du robot)
----------------------------------------------------------------------------------------------------
  (le jeu doit être servi sur http://localhost:8765 : python3 -m http.server 8765 depuis le dossier du jeu)
  node tests/test_themes.js                 tout : écrans + fenêtres de jeu (pigeon, duel, +4…) jouées par le robot
  node tests/test_themes.js --sans-partie   écrans seulement (environ 1 minute)
  node tests/test_themes.js --themes=montheme   un seul thème (nouveau thème : l'ajouter aussi dans la liste THEMES du script)

  Ouvre chaque écran du jeu dans chaque thème (la liste des écrans est lue dans index.html : un écran ajouté plus tard est
  visité tout seul) et compare chaque bouton plein à son apparence SANS thème (le jaune de base). Si le thème a habillé ses
  boutons principaux mais qu'un bouton est resté exactement au style de base, il est signalé : « OUBLI thème · écran · bouton ».
  Limites : les thèmes dont les boutons principaux restent jaunes (Bordeaux, Vert, Bleu, Cerisier, Prestige) ne sont pas
  concernés ; les icônes, liens et champs de saisie ne sont pas comparés ; un bouton « habillé » avec une mauvaise couleur n'est
  pas détecté (la lisibilité des textes, elle, est dans test_contraste.ps1) ; les fenêtres de jeu que le robot ne rencontre pas
  (carte dorée, annulation…) sont listées en fin de test, à regarder à la main. Un bouton volontairement resté au style de
  base se déclare dans la liste EXCEPTIONS du script, avec la raison.

Partie classique (le plus important, environ 1 minute)
------------------------------------------------------
  bash tests/generer.sh          (depuis le dossier du jeu, dans Git Bash)

  Joue une partie complète hors connexion avec un hasard fixé (autre graine : bash tests/generer.sh 2026).
  Résultat attendu : "fin": "ok" et "erreurs": [].
  Fichiers utilisés : prelude.js (hasard fixé, capture des erreurs), joueur_auto.js (joue la partie),
  extraire.pl (lit le rapport). Crée tests/partie.html (ignoré par git).

Mode en ligne (vrai Firebase, 3 onglets = 3 téléphones, quelques minutes chacun)
-------------------------------------------------------------------------------
  Dans PowerShell, depuis le dossier tests :  powershell -File test_traque.ps1
  (parties de test créées puis supprimées de Firebase à la fin)

  test_traque.ps1        plusieurs parties complètes à 3 : les 3 téléphones doivent rester IDENTIQUES
  test_retour.ps1        un joueur retiré revient (même téléphone, puis un autre téléphone)
  test_reconnexion.ps1   un téléphone se reconnecte en pleine manche (rattrapage)
  test_coupure.ps1       coupure de réseau pendant la partie
  test_refus.ps1         action refusée par Firebase : le téléphone se resynchronise
  auto_en_ligne.js       le joueur automatique utilisé par ces tests

  Résultat attendu : IDENTIQUES=True partout et aucune erreur JS.

Autres vérifications
--------------------
  test_rechargement_theme.ps1  iPhone simulé : changer de thème recharge la page et rouvre les Réglages
  test_manque_bas.ps1          iPhone simulé : taille des écrans, ligne « Écran » du diagnostic,
                               bouton ⌂ caché sur Créer / Rejoindre
  test_notif_or.ps1            notification dorée (glisser vers le haut, tenir au doigt, tap, départ seule)
                               captures dans tests/acc/ (ignoré par git)
  test_sons.ps1, test_annuler.ps1   sons (distribution, annulation, relance du son coupé). Ces deux-là
                               ont besoin d'un petit serveur : depuis le dossier du jeu,
                               python tests/serveur.py , puis lancer le test dans un autre terminal
                               (pas « python -m http.server » : il refuse des connexions sous Windows
                               et des fichiers du jeu échouent au hasard).

Lisibilité des textes dans tous les thèmes (environ 5 minutes)
--------------------------------------------------------------
  Dans PowerShell, depuis le dossier tests :  powershell -File test_contraste.ps1
  (un seul thème, plus rapide :  powershell -File test_contraste.ps1 -themes givre)

  Passe sur chaque écran (accueil, réglages, en ligne, plateau, créateurs…) et sur chaque overlay
  des règles (en Givre et en Bordeaux), et mesure le contraste de chaque texte avec son fond.
  Compare à contraste_reference.txt (les textes déjà connus un peu pâles, comme le blanc sur les
  boutons jaunes) : signale tout texte NOUVEAU sous le seuil, ou MOINS BIEN lisible qu'avant.
  Résultat attendu : « RÉSULTAT : OK ».
  Si un changement est voulu (nouvelle couleur, nouveau bouton) : relancer avec -enregistrer
  pour mettre à jour la référence, puis la publier avec le reste.
  Fichiers : contraste.js (la mesure), contraste_actuel.txt (dernier passage, ignoré par git).

Rien ne déborde (environ 4 minutes, inclus dans tout_tester.ps1)
---------------------------------------------------------------
  Dans PowerShell, depuis le dossier tests :  powershell -File test_debordement.ps1
  (un seul format :  -formats paysage   ;   formats : portrait, paysage, pc)

  Passe sur chaque écran et chaque overlay en téléphone portrait (390 x 844), téléphone en paysage
  (844 x 390) et fenêtre de PC basse (1280 x 645). Signale ce qui est COUPÉ EN HAUT (impossible à
  atteindre en défilant), ce qui DÉBORDE SUR LE CÔTÉ et les boutons ÉCRASÉS à 0 px.
  Résultat attendu : « RÉSULTAT : OK ». Fichiers : debordement.js, debordement_actuel.txt (ignoré par git).

Après chaque mise en ligne (git push)
-------------------------------------
  Dans PowerShell, depuis le dossier tests :  powershell -File verifier_mise_en_ligne.ps1

  Attend que GitHub Pages ait publié le dernier commit, puis vérifie que le site en ligne affiche la
  même version que le code. Résultat attendu : « RÉSULTAT : OK, le site en ligne est en x.y.z ».
  En cas d'échec de la publication (incident passager côté GitHub) : refaire un push.


Cache du service worker et images (tests/test_cache.js)
-------------------------------------------------------
  node tests/test_cache.js
  Échoue si une image de Cartes/, stickers/ ou icones/ a changé sans qu'on ait changé CACHE dans sw.js (les téléphones
  garderaient les anciennes images), ou si une image manque dans A_PRECHARGER de sw.js.
  Quand tu changes une image : 1) change CACHE dans sw.js (alcuno-v12 -> alcuno-v13), 2) lance
  node outils/maj_empreinte_cache.js (enregistre l'empreinte dans tests/empreinte_cache.json), 3) commite les deux.
  Tourne aussi sur GitHub à chaque push.

À regarder sur un vrai iPhone après une mise à jour : voir tests/VERIFICATION_IPHONE.md
