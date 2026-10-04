TESTS DU JEU
============

À lancer avant de publier une modification, pour vérifier qu'on n'a rien cassé.
Il faut Google Chrome installé à l'endroit habituel (C:\Program Files\Google\Chrome\Application\chrome.exe).
Les tests ouvrent Chrome sans fenêtre et jouent tout seuls.

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
                               python3 -m http.server 8765 , puis lancer le test dans un autre terminal.
