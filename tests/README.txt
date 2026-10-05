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
