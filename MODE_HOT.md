# Mode hot : décisions

Statut : première version codée (jeu 9.74.0, non poussée). Dernière mise à jour : 2 novembre.

## Ce qui est codé (9.74.0)
- Écran « Ta partie » (Mode PJ, Partie express, Mode hot) : c'est l'écran des Réglages en « vue options » (js/reglages.js, `ouvrirOptionsPartie`), ouvert après « Mode classique » et « Créer une partie » (en ligne). PJ et express ne sont plus dans les Réglages normaux.
- Flamme 🔥 après ALCUNO dans le bandeau quand le mode hot est actif.
- Paquet hot (js/plateau.js, `paquetHot`) : plus de « 1 », 1 à 3 Cupidon selon le nombre de joueurs (3 : 1 ; 4-5 : 2 ; 6+ : 3 ; 2 joueurs : 0), 2 changements de sens en plus, le reste en « +2 ». Toujours 52 cartes (28 en express).
- En ligne : le mode hot voyage dans la graine du mélange (bit 2^34, comme l'express) : c'est le réglage de celui qui lance la partie. Pas de changement des règles Firebase.
- js/mode-hot.js : 58 défis (A 27, B 16, C 15), choix selon les gorgées affichées, cible au hasard (hasard à graine, à part de celui du paquet), pas deux fois le même défi pour un joueur, écran du défi, carte Cupidon (lier / briser), 💘 dans la liste des joueurs.
- Pas encore fait / limites connues : lien Cupidon seulement pour les gorgées d'une seule personne (pas pour 0 / Sociale / carte dorée) ; pas de duel de regards ; pas de réglage de fréquence ; un défi par événement de gorgées (la gorgée « couleur » en plus donne un 2e défi) ; télé : le défi s'affiche comme une annonce avec ses boutons en étiquettes.

## Ajouts du 10 novembre (jeu 9.86.0)
- **« Couple de la soirée » 💞** dans le récap de fin, à TOUTES les parties hot : les deux joueurs qui se sont le plus fait boire l'un l'autre. Compté : gorgées données au +4, cul sec de la carte dorée, gorgées bues ensemble par un lien Cupidon, bisous de la carte Coup de foudre (un bisou vaut un cul sec). `compterCouple` dans js/plateau.js.
- **Carte « Coup de foudre » ⚡💋** (Cartes/coup_de_foudre.svg ; de dos comme les autres) : pendant la période Saint-Valentin (7 au 15 février, ou thème Saint-Valentin choisi à la main en attendant le calendrier), elle remplace un des 2 changements de sens en plus du paquet hot (toujours 52 cartes ; en express aussi, à la place d'un changement de sens). Celui qui la tire choisit quelqu'un : un bisou sur la bouche… ou un cul sec (4 gorgées en mode PJ). En ligne : la période de celui qui lance la partie voyage dans la graine (bit 2^35, `graineValentin`). Fenêtre : `afficherOverlayCoupDeFoudre` (js/mode-hot.js), même style que Cupidon.

## Périmètre
- On ajoute UNIQUEMENT un mode hot dans Alcuno. Les autres modes (Je n'ai jamais, mot interdit…) sont abandonnés.
- Une carte normale reste une carte normale ; le hot s'ajoute dessus, via une seule fonction qui prend n'importe quelle carte et ajoute le bonus avant l'affichage, sans réécrire chaque règle.
- Passer un défi hot = boire les gorgées prévues. Pas de joker, pas de passe gratuite.

## Décisions du 2 novembre
- **Affichage : maquette A retenue.** L'écran habituel de la carte reste, un bloc s'ajoute dessous avec deux boutons : « Je le fais » / « Je bois N ». Le bloc porte seulement « 🔥 MODE HOT » : une seule flamme, aucun mot « léger / osé / très osé » et pas 2 ou 3 flammes à l'écran.
- **Un défi hot à chaque fois que quelqu'un prend des gorgées** (au lieu du « 1 carte sur 4 » du début). À tester pour voir comment ça rend. Prévoir un réglage de fréquence pour pouvoir baisser si c'est trop.
- **Niveau du défi selon les gorgées en jeu (interne, jamais affiché)** :
  - moins de 5 gorgées : défis du premier groupe
  - de 5 à 10 : défis du deuxième groupe
  - plus de 10 : défis du troisième groupe
- **Pas de défi quand plusieurs personnes boivent en même temps** (« Sociale », 0, +4…). Pas de défi de groupe non plus. Le défi ne se déclenche que si une seule personne boit.
- **Carte dorée : inchangée en mode hot** pour le moment.
- **Annulations retirées du jeu en mode hot** : plus de cartes « 1 » (annulation), donc plus de « on boit les 1 restants à la fin ». Par quoi on remplace les 8 cartes « 1 » : proposition en attente de réponse (voir questions).
- **Activation : refusées** les maquettes D (interrupteur sur « Nouvelle partie »), G (deux boutons), H (fenêtre) et I (interrupteur sur l'accueil), et les Réglages. **Piste de l'utilisateur : un écran en plus** qui regroupe Mode PJ, Partie express et Mode hot. J2 (bouton ⚙ + pastilles sous les joueurs) refusé, trop moche. Pas d'affichage des modes en pastilles : **quand le mode hot est actif, une flamme s'affiche à côté d'ALCUNO en haut, comme « PJ » dans « ALCUNO PJ »** (le titre du jeu).
  - Designs de l'écran : O1 (liste), O2 (tuiles), O3 (feuille du bas sur l'écran des joueurs).
  - Autres façons de l'activer : « étape 1 sur 2 avant les joueurs » ; « la flamme du titre est le bouton » (grisée quand éteinte ; PJ et express resteraient dans les Réglages).
  - Texte du Mode hot sur cet écran : « Des défis osés pendant la partie. » (sans « quand une seule personne boit »).
  - **Choix du 2 novembre : design O1 (la liste).** Mode PJ et Partie express quittent les Réglages et passent sur cet écran (l'utilisateur a dit « virer le reste des réglages » : compris comme ces deux options, pas tous les Réglages ; à confirmer). Reste à décider quand l'écran s'ouvre (après « Jouer », étape avant les joueurs, ou autre).
- **Duel de regards : maquette E retenue** (bannière au-dessus du plateau, chrono 5 min, « J'ai craqué »).
- **Missions secrètes (F)** : l'idée est bonne, mise de côté pour le moment (pas dans la première version).

## Modifications hot d'une carte normale (idées de départ)
- Gorgées contre contact : au lieu de boire, on offre un compliment sincère ou un bisou sur la joue. (La version « refus = on boit le double » est à trancher : voir questions.)
- Le duo : la règle touche aussi la personne de son choix.
- Le public vote : le groupe désigne qui accomplit la règle.
- Gages échangés : on donne son gage à quelqu'un, qui peut le refuser en buvant le double.
- Effet miroir : celui qui lance la règle la subit aussi.
- Choisis qui : celui qui pioche désigne n'importe qui et doit le rapprocher d'un autre joueur.
- Intensité qui monte au fil de la partie, sans jauge visible.

## Duel de regards
- L'app désigne 2 joueurs. Bannière « Duel de regards en cours », minuteur de 5 min, la partie continue en dessous.
- Bouton « J'ai craqué » pour finir plus tôt.
- Celui qui craque boit 4 gorgées. Si personne ne craque : les deux trinquent et distribuent 2 gorgées.
- Les deux joueurs ne sont pas tirés pour d'autres défis pendant le duel.
- Nom à garder différent du « Duel » existant (carte 4).

## Défis de groupe (mis de côté : l'utilisateur ne veut pas de défi de groupe pour le moment)
- Tous ceux qui ont déjà embrassé quelqu'un dans la pièce boivent.
- Les couples boivent, les célibataires distribuent 2 gorgées.
- Chacun désigne en même temps la personne la plus séduisante ; celui qui a le plus de doigts boit.
- Tous ceux qui ont déjà envoyé un message hot à la mauvaise personne boivent.
- Tous ceux qui ont déjà dragué pour un verre gratuit boivent.
- Celui qui a la plus longue relation du groupe désigne quelqu'un qui boit.
- Ne pas rédiger les 20 défis de groupe pour le moment.

## Missions secrètes hot (mises de côté pour le moment)
- Chaque joueur reçoit une mission secrète qu'il doit accomplir discrètement. Appui long sur son prénom pour la voir.
- Si un autre joueur devine la mission, celui qui la portait boit. Si elle est réussie sans être repérée, il distribue.
- Exemples : « fais complimenter quelqu'un par deux personnes », « fais danser deux joueurs ensemble », « fais en sorte que deux joueurs se retrouvent côte à côte à la fin ».

## Idées refusées (ne pas reproposer)
Match secret, roulette hot, compteur de chaleur, murmure à l'oreille / question à voix basse, massage d'épaules, défi de groupe « crush sur quelqu'un de la soirée », jokers, interrupteur « Mode hot » dans les Réglages ou sur l'écran « Nouvelle partie ».

## Constats sur le code actuel (lus, pas testés)
- Les règles sont dans `js/regles.js`, fonction `appliquerRegle`. Les gorgées passent presque toutes par `annoncerBoireAvecAnnulation` et `demarrerAnnulationsMulti` : point d'accroche probable pour afficher le bloc hot.
- Gorgées en partie normale (`js/reglages.js`) : +2 = 2, +4 = 4, pigeon = 2, « Sociale » et 0 = 1, duel = valeur de la carte du perdant (2, 5, 6, 7, 8 ou 9) × un multiplicateur qui double à chaque égalité, carte dorée = cul sec. Donc dans la pratique : « léger » sera de loin le plus fréquent, « osé » viendra surtout des duels, « très osé » seulement des duels après égalités. Mode PJ : moitié moins.
- Cartes « 1 » (annulation) : 8 cartes dans `classes` (`js/plateau.js`). Les retirer fait passer le paquet de 52 à 44 cartes (44 = 11 rangées pleines de 4 sur téléphone ; sur tablette à 6 colonnes la dernière rangée serait incomplète). Le texte des règles et la FAQ parlent des « 1 » : à masquer en mode hot.
- Un « Duel » existe déjà (carte 4), un Mode PJ, une Partie express, un mode en ligne (`js/synchro-en-ligne.js`) et un mode télé : le mode hot doit être identique chez tous les joueurs en ligne.
- L'écran d'accueil n'a que deux boutons (Mode en ligne, Mode classique). L'écran « Nouvelle partie » a un seul bouton « Jouer ».

## Décisions du 2 novembre (suite)
1. L'écran d'options hot (O1) s'ouvre après « Mode classique » ou « Mode en ligne », avant le choix des joueurs. DÉCIDÉ.
2. Les 8 cartes « 1 » deviennent : carte **Cupidon** (1 si 3 joueurs, 2 si 4 ou 5 joueurs, 3 si 6 joueurs ou plus ; chacune remplace un « +2 » ; lie 2 personnes, quand l'une boit l'autre aussi), **2 « sens inversé »**, le reste en « +2 ». DÉCIDÉ.
3. Refus d'un défi : on boit exactement les gorgées prévues. DÉCIDÉ.
4. Refus du défi : c'est la personne qui doit faire le défi (qui a tiré la carte) qui boit les gorgées prévues. On ne choisit personne d'autre. DÉCIDÉ.
5. Mode PJ + hot : l'intensité du défi se calcule sur les gorgées affichées (proposition gardée). DÉCIDÉ.
Cupidon (DÉCIDÉ) : à chaque nouvelle carte Cupidon, celui qui la tire choisit de briser un lien existant ou d'en créer un nouveau. Un couple lié compte comme une seule personne pour les défis : le texte affiche « Tom et Léa boivent » au lieu d'un nom. Les défis d'un couple lié se font uniquement entre eux tant qu'ils sont liés. Pour un couple, les phrases « Toi et {nom} » utilisent le prénom du partenaire, et c'est celui qui a tiré la carte qui fait le défi.
6. Mode en ligne : l'hôte choisit hot, comme pour le Mode PJ. DÉCIDÉ.
Les phrases des défis seront validées dans le message suivant de l'utilisateur.

Principe du défi (précisé par l'utilisateur) : quand quelqu'un doit boire des gorgées, il peut les annuler en faisant un défi. C'est donc toujours celui qui doit boire qui fait le défi (pour un +4, celui qui reçoit les gorgées). S'il refuse, il boit les gorgées prévues. Pour un couple lié qui boit ensemble, le défi se fait entre eux. Les massages B11 et B16 restent.

## Questions ouvertes (anciennes, pour mémoire)
4. Si la personne choisie pour un défi refuse : on en choisit une autre, ou celui qui doit le défi boit ?
5. Mode PJ + mode hot : les groupes de défis (moins de 5 / 5 à 10 / plus de 10) se calculent sur les gorgées réellement affichées (donc divisées par 2) ?
6. Cupidon : durée du lien (jusqu'à la prochaine carte Cupidon ?), chaîne (lié qui boit à cause du lien ne déclenche pas de nouveau lien), pas de défi quand deux personnes boivent.

## Idées de cartes pour remplacer les 8 cartes « 1 »
- **Regards** (4 cartes) : déclenche le duel de regards (l'app désigne 2 joueurs). Donne enfin un déclencheur au duel.
- **Le jury** (4 cartes) : tout le monde désigne du doigt en même temps quelqu'un ; celui qui a le plus de doigts boit 3 gorgées. Une seule personne boit, donc le défi hot s'applique.
- **Les liés** (idée de réserve) : le joueur qui la tire désigne 2 personnes liées jusqu'à la prochaine fois que la carte sort ; quand l'une boit, l'autre aussi.
- Il faut dessiner les images de ces cartes (en SVG, comme `Cartes/carte_doree.svg`) : non fait.

## Défis hot : version 2 (45), à valider
Règles décidées : jamais « la personne de ton choix » : l'app tire au hasard la personne visée ({nom}) ; pour un couple lié, c'est l'autre membre du couple. Pas de durée vague (« long », « jusqu'au prochain tour », « à vie », « fin de partie ») : toujours un temps précis. Les accords de genre (« il/elle », « (e) ») sont permis : ce n'était pas une règle de l'utilisateur. Les câlins sont dans B et C. Les groupes (moins de 5 / 5 à 10 / plus de 10 gorgées affichées) servent à choisir le défi, jamais écrits à l'écran. Groupes A et B validés le 2 novembre (A10 remplacée, à confirmer) ; groupe C à valider.

### Groupe A (moins de 5 gorgées)
A1. Fais un compliment sincère à {nom}.
A2. Souffle un bisou à {nom}, de loin.
A3. Dis ce que tu as remarqué en premier chez {nom}.
A4. Fais un clin d'œil hot à {nom}.
A5. Fais ton regard le plus charmeur à {nom} pendant 5 secondes.
A6. Donne une note sur 10 au sourire de {nom}, et explique-la.
A7. Dis si tu inviterais {nom} à dîner en tête à tête, et pourquoi.
A8. Toi et {nom}, buvez chacun dans le verre de l'autre. Il faut des alcools différents, sinon tu bois tes gorgées.
A9. Tiens la main de {nom} pendant 30 secondes.
A10. Invente un surnom mignon pour {nom} et utilise-le chaque fois que tu lui parles jusqu'à la fin de la partie.
A11. Murmure un compliment à l'oreille de {nom}.
A12. Dis le premier mot qui te vient en tête quand tu penses à {nom}.
A13. Imite le rire de {nom}.
A14. Dis ce que tu préfères dans le style de {nom}.
A15. Échange un de tes accessoires (bague, montre, chaussette…) avec {nom} pendant 5 minutes.
A16. Raconte à {nom} ton meilleur souvenir de bisou.
A17. Dis à {nom} quelle a été ta première impression en faisant sa connaissance.
A18. Fais un compliment à {nom} sur ses yeux.
A19. Dis à {nom} dans quoi il/elle est selon toi le/la plus doué(e).
A20. Fais une révérence à {nom}, comme à la cour.
A21. Dis à {nom} ce que tu aimes dans son rire.
A22. Imite la démarche de {nom} pendant 10 secondes.
A23. Passe ta main dans les cheveux de {nom}.
A24. Dis à {nom} dans quelle ville du monde tu l'emmènerais pour un week-end, et pourquoi.
A25. Mime un « coup de foudre » en croisant le regard de {nom}.
A26. Dis à {nom} ce que tu ferais si vous étiez coincés tous les deux dans un ascenseur.
A27. Complimente {nom} en 3 mots exactement.

### Groupe B (de 5 à 10 gorgées)
B1. Fais un bisou sur la main de {nom}.
B2. Danse collée 30 secondes avec {nom}.
B3. Assieds-toi sur les genoux de {nom} pendant 1 minute.
B4. Fais un bisou sur la joue de {nom}.
B5. Toi et {nom}, buvez bras entrelacés.
B6. Déclare ta flamme à {nom}, le plus sérieusement possible.
B7. Fais un baisemain théâtral à {nom}.
B8. {nom} te fait un compliment les yeux dans les yeux pendant 10 secondes : interdit de rire.
B9. Fais un slow de 30 secondes avec {nom}.
B10. Fais un câlin de 15 secondes à {nom}.
B11. Fais un massage des épaules à {nom} pendant 30 secondes.
B12. Caresse doucement la joue de {nom} pendant 10 secondes.
B13. Mime avec {nom} une scène de film romantique.
B14. Tiens les deux mains de {nom1} et dis ce que tu admires le plus chez {nom2}. Deux joueurs différents, tirés au hasard ; ne tombe que s'il y a au moins 3 joueurs. Pour un couple lié : tu tiens les mains de ton partenaire et tu le dis, les yeux dans les yeux, à un autre joueur tiré au hasard.
B15. Fais tourner {nom} sur place en lui tenant la main, comme dans une danse de salon, pendant 20 secondes.
B16. Fais un massage de la main de {nom} pendant 15 secondes.

### Groupe C (plus de 10 gorgées)
C1. Fais un bisou dans le cou de {nom}.
C2. Fais un bisou au coin de la bouche de {nom}.
C3. Danse collée 1 minute avec {nom}, front contre front.
C4. Souffle doucement dans le cou de {nom}.
C5. Lèche le bas du dos de {nom}.
C6. Retire lentement un vêtement en regardant {nom} dans les yeux.
C7. Tiens {nom} par la taille pendant 1 minute.
C8. Embrasse l'épaule de {nom}.
C9. Raconte ta soirée idéale à deux avec {nom}.
C10. Fais un compliment très osé à {nom}, sans rire ni te cacher.
C11. Colle ton épaule à celle de {nom} pendant 1 minute.
C12. Fais un défilé de 20 secondes devant {nom}, comme un mannequin.
C13. Échange un vêtement avec {nom} jusqu'à la fin de la partie.
C14. Chante une petite chanson à {nom} pendant 20 secondes.
C15. Tiens le visage de {nom} entre tes mains et dis-lui que tu adores te marteler les fesses avec un cactus nain 2 à 3 soirs par semaine et que tu as pris l'habitude de retirer les épines avec une pince à épiler, ce qui a nettement amélioré ta dextérité et ta mobilité des doigts.
