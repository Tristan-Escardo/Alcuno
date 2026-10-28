# Piloter le jeu à distance (Alcuno Stats → « Pilotage du jeu »)

Depuis la page privée **Alcuno Stats** (onglet **Pilotage** en haut : tape dessus ou glisse le doigt vers la gauche ; glisse vers la droite pour revenir aux stats), tu règles le jeu sans rien republier :
annonce sur l'accueil, voix / musique / mode en ligne coupés, thèmes cachés ou de saison
(visibles seulement sur une période, chaque année), mise à jour demandée. Tout est annulable.

Le jeu ne peut pas être bloqué par ça : sans réseau ou si Firebase ne répond pas, il reste réglé par défaut.

## À faire une seule fois (5 minutes, gratuit)

1. **Console Firebase** (console.firebase.google.com, projet *alcuno*) → **Authentication** → *Commencer* →
   **Sign-in method** → active **E-mail/Mot de passe**.
2. Onglet **Users** → **Ajouter un utilisateur** : ton e-mail et un mot de passe solide.
   Copie son **UID** (colonne « Identifiant de l'utilisateur »).
   (Dans *Settings → User actions*, tu peux aussi désactiver la création de comptes.)
3. **Realtime Database** → **Règles** : colle le contenu de `database.rules.json`, **remplace
   `REMPLACE_PAR_TON_UID` par ton UID** (3 occurrences), puis **Publier**.
   Tant que ce n'est pas fait, personne ne peut écrire : le pilotage affiche « Refusé par Firebase ».
4. Ouvre Alcuno Stats, descends jusqu'à **Pilotage du jeu**, connecte-toi.

## Mise à jour des règles (version 9.65.0)

Les règles ont de nouveaux champs (annonce programmée, version visée, valeurs de départ, voyant de lecture).
Après une mise à jour du jeu qui touche `database.rules.json`, recolle-le dans Realtime Database → Règles → **Publier**
(ton UID y est déjà). Sans ça, le pilotage affiche « Refusé par Firebase » pour ces nouveaux réglages.

## Utilisation

- **Assistant** : écris une phrase, il te montre ce qu'il a compris, tu valides. Exemples :
  `coupe la voix` · `ferme le mode en ligne` · `désactive le thème Kawaii` ·
  `thème Star Wars du 1er mai au 4 mai` · `annonce : « Soirée ce soir ! » pendant 2 jours` ·
  `oblige la mise à jour 9.64.0` · `remets tout à zéro`.
- **Aperçu** : « Ce que voit un joueur » montre l'accueil avec la config actuelle, et chaque demande de l'assistant
  montre l'aperçu *après* application avant que tu valides.
- **Annonce programmée** : « annonce demain à 18h : « Soirée ! » pendant 3 heures » (ou le champ « Début »). Elle apparaît toute seule à l'heure.
- **Annonce visée** : « … pour les versions avant 9.65.0 » (ou le champ « Seulement pour les versions avant »).
- **Valeurs de départ** : volume de la musique et vitesse de la voix pour ceux qui n'ont jamais touché au curseur
  (« volume de la musique par défaut à 50 »).
- **Historique** : les 20 dernières modifications ; « Revenir avant » rétablit l'état d'avant l'une d'elles.
- **Lecture par les joueurs** : combien d'appareils ont lu les réglages, et combien ont ta dernière modification
  (les appareils en 9.65.0 ou plus le signalent ; un avertissement apparaît si aucun ne l'a fait).
- **Boutons** : Couper / Remettre une fonction, Cacher / Remettre un thème, période d'un thème, annonce.
- **Annuler la dernière modification** : revient à l'état d'avant (l'historique est dans `config_hist`).

## Assistant intelligent gratuit (facultatif)

Pour comprendre des demandes plus libres : clé gratuite **Google Gemini** (aistudio.google.com → *Get API key*),
collée dans « Assistant intelligent gratuit ». Elle reste dans ton téléphone, jamais dans le jeu ni sur GitHub.
L'IA ne peut proposer que les réglages de la liste ci-dessus, vérifiés par le code, et tu valides avant.
Le modèle utilisé est `MODELE_IA` dans `stats.html` (à changer si Google le renomme).

## Ce que ça ne peut pas faire

Ajouter une fonction, changer un design, corriger un bug ou modifier le texte des cartes : ça reste du code à publier.
