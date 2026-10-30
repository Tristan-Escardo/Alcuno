# Appli de test d'Alcuno

Une copie du jeu, sur sa propre adresse, pour essayer les modifications avant de les mettre en ligne.

## Comment ça marche

- `main` = le vrai jeu (GitHub Pages). On n'y envoie que ce qui a été essayé.
- `test` = la branche d'essai. Netlify la publie toute seule à chaque push, sur une adresse à part (`lambent-conkies-fd7df9.netlify.app`).
- Quand la version de test est bonne : on fusionne `test` dans `main`, et c'est en ligne.

L'appli de test est le même jeu (mêmes fichiers, même Firebase, parties en ligne et Pilotage compris), avec trois différences voulues :

1. « · TEST » à côté de la version, dans les Réglages ;
2. aucune statistique ni aucun plantage envoyé (tes chiffres restent ceux de la vraie appli) ;
3. ses réglages, son cache hors connexion et son installation sont séparés de la vraie appli (autre adresse) : au premier lancement, tout repart de zéro.

Le « mode test » s'active tout seul sur toute adresse qui n'est ni `*.github.io` ni `localhost`. On peut aussi l'essayer n'importe où en ajoutant `?modetest` à l'adresse.

## Mise en place de Netlify (une seule fois)

1. Va sur https://app.netlify.com et crée un compte gratuit avec « Continue with GitHub ».
2. « Add new site » → « Import an existing project » → GitHub → autorise l'accès au dépôt `Alcuno`.
3. Réglages du site :
   - **Branch to deploy** : `test`
   - **Build command** : (vide)
   - **Publish directory** : `.`
4. « Deploy ». Au bout d'une minute, tu as l'adresse du site.
5. (Facultatif) « Site configuration » → « Change site name » pour une adresse plus simple.

Sur téléphone : ouvre l'adresse, puis « Ajouter à l'écran d'accueil » : tu as une 2e appli, indépendante de la vraie.

## Envoyer en ligne

Quand le test est bon, demande « mets en ligne » : la branche `test` est fusionnée dans `main`.
