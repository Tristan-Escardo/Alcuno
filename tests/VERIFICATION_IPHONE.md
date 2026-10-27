# À vérifier sur un vrai iPhone après une mise à jour

Les tests automatiques tournent dans un navigateur de test : ils ne voient pas tout ce qui se passe sur iPhone
(cache, polices, barre de l'heure, écran en paysage). Après chaque mise en ligne qui touche à l'affichage, 2 minutes
suffisent pour regarder les points ci-dessous.

## 1. Être sûr d'avoir la bonne version (toujours en premier)
- [ ] Ferme complètement le jeu (balayer l'appli vers le haut) et rouvre-le.
- [ ] Le numéro de version en bas de l'accueil est bien celui attendu. Sinon : rouvre encore une fois (parfois deux).
- [ ] Si les images restent anciennes malgré le bon numéro : le nom du cache (`CACHE` dans `sw.js`) ou le nom du fichier
      image n'a pas changé (voir `tests/test_cache.js`).

## 2. Accueil et barre du haut
- [ ] La barre de l'heure a la même couleur que le fond de l'écran (accueil, Réglages, Crédits), dans chaque thème.
- [ ] Le titre « ALCUNO » est bien affiché (pas de lettres décalées ni coupées).

## 3. Une partie en mode classique (3 joueurs)
- [ ] Le joueur du tour est en haut de la liste, en gros et en jaune ; il change bien à chaque tour.
- [ ] Après un duel, un choix de pigeon ou une couleur : le joueur du tour reste en gros (pas de trou).
- [ ] Les dos et les faces de cartes sont ceux du thème (Kawaii, Star Wars). Le dos et la face se distinguent au premier coup d'œil.
- [ ] Le texte « ALC / UNO » est visible sur les dos (la police peut varier d'un téléphone à l'autre).

## 4. Autres écrans
- [ ] Page Règles : les cartes d'exemple ont les bonnes images, dont la carte « dos ».
- [ ] Album de stickers : les stickers non gagnés sont en « ??? » (l'Étoile aussi).
- [ ] Réglages : de l'espace entre le titre « Thèmes » et les pastilles.

## 5. Paysage
- [ ] Téléphone couché : cartes lisibles (8 par rangée), pas de blocs qui se chevauchent.

## 6. Télé (si possible)
- [ ] Après « Caster » : l'écran de la télé prend le thème du téléphone, le joueur du tour est en haut en jaune.

## 7. Thèmes secrets
- [ ] Kawaii : le mot secret (nom de joueur) ou les 11 stickers déverrouillent bien le thème.
