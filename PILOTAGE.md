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

## Onglet Santé (jeu 9.66.0)

Le jeu envoie les vrais plantages (erreurs JavaScript non rattrapées) à l'onglet **Santé** d'Alcuno Stats, sans rien de personnel :
message nettoyé (tout ce qui est entre guillemets est remplacé, donc jamais un pseudo ni un code de partie), fichier et ligne,
version du jeu, type d'appareil. Au plus 5 types d'erreurs par ouverture du jeu, chacun une seule fois.

- Voyant vert / orange / rouge selon le nombre de plantages des dernières 24 h, et un badge rouge sur l'onglet.
- Les erreurs sont regroupées sur 7 jours (nombre, versions touchées, appareils, dernière fois).
- **Ignorer** une erreur connue (elle ne compte plus) ; **Effacer le journal**. Ça demande d'être connecté dans l'onglet Pilotage.
- Il faut **republier `database.rules.json`** (nouvelle section `sante`), sinon rien n'est enregistré.

## Assistant : conversation, questions, raccourcis (stats 1.11.0)

- **Il se souvient de la conversation** : « coupe la voix » puis « finalement non, remets-la » ou « fais pareil pour la musique ».
  Avec une clé Gemini, l'IA reçoit aussi les derniers échanges.
- **Questions sur les stats**, sans IA pour les cas courants : « combien de parties cette semaine ? », « quel thème est le plus utilisé ? »,
  « quelle version plante le plus ? », « combien de plantages ? »… Avec une clé Gemini, il répond aussi aux questions plus libres
  d'après les chiffres de la page (il n'invente rien).
- **Raccourcis** (boutons ou phrases) : 🛠️ Mode maintenance (coupe le mode en ligne + annonce), ✅ Fin de maintenance, 🔇 Silence total,
  🔊 Rétablir le son, 🆘 Bug connu. Tu valides toujours avant.
- **Modèles d'annonces** : un tap remplit le champ, à adapter ; **✨ Reformuler avec l'IA** propose 3 variantes (sans inventer de dates ni de chiffres).
- **Clé Gemini** : « Enregistrer et tester la clé » dit si elle est valide et choisit tout seul un modèle disponible ;
  si Google renomme le modèle, l'appel est réessayé automatiquement avec un autre.

## Annonce à plusieurs endroits

L'annonce s'affiche sur l'accueil, en haut des Réglages et en haut des Crédits. La fermer la ferme partout.

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

## Assistant intelligent (facultatif) : Gemini, Claude ou ChatGPT

Dans « Assistant intelligent », choisis un **fournisseur** et colle ta clé (« Enregistrer et tester la clé » dit si elle est valide
et choisit tout seul un modèle disponible, le plus économique ; si le modèle est renommé, l'appel est réessayé avec un autre) :

| Fournisseur | Coût | Où prendre la clé |
|---|---|---|
| Google Gemini | **gratuit** (quota gratuit de Google, à vérifier sur leur page ; Google peut utiliser les échanges du quota gratuit pour s'améliorer) | aistudio.google.com → *Get API key* |
| Claude (Anthropic) | payant à l'usage, crédit prépayé, **séparé** de l'abonnement Claude | console.anthropic.com → *API keys* |
| ChatGPT (OpenAI) | payant à l'usage, crédit prépayé, **séparé** de l'abonnement ChatGPT | platform.openai.com/api-keys |

Une clé par fournisseur, gardée dans ton téléphone (jamais dans le jeu ni sur GitHub). L'IA ne peut proposer que les réglages de la liste,
vérifiés par le code, et tu valides avant. Elle sert aussi à reformuler une annonce et à répondre aux questions sur les stats.

## Ce que ça ne peut pas faire

Ajouter une fonction, changer un design, corriger un bug ou modifier le texte des cartes : ça reste du code à publier.

## Onglet Aide (stats 1.15.0)

Un 4e onglet **Aide** dans Alcuno Stats : questions dépliables (lire les stats, la Santé, chaque réglage du Pilotage, l'assistant, la clé d'IA et ses erreurs,
« Refusé par Firebase », un joueur resté sur l'ancienne version). Glisser vers la gauche depuis Pilotage y mène.

## Sécurité : lecture réservée à l'administrateur (stats 1.16.0)

Avant, les statistiques, la santé et la présence étaient lisibles par n'importe qui connaissant l'adresse de la base (le code de la page Stats ne protégeait que l'affichage).
Maintenant :
- `database.rules.json` : `stats`, `sante` et `presence` ne sont **lisibles que par ton compte administrateur**. Exception voulue : les compteurs eux-mêmes
  (visites, parties, heures, `n` d'un plantage), que le jeu doit relire pour faire +1 (transactions) ; les listes d'appareils, de visiteurs et les messages d'erreur restent privés.
- La page Stats s'ouvre avec **l'e-mail et le mot de passe** du compte administrateur (le code d'accès est supprimé). Firebase garde la session.

**Ordre de mise en ligne** : 1) mettre la nouvelle page Stats en ligne (main) ; 2) seulement ensuite, recoller `database.rules.json` dans Realtime Database → Règles → **Publier**.
Dans l'autre sens, l'ancienne page Stats (avec le code) ne verrait plus rien.
Pour revenir en arrière : recoller l'ancien contenu de `database.rules.json` (git, version précédente) et Publier.

À faire aussi dans la console (sans code) : restreindre la clé d'API aux adresses du jeu (Google Cloud Console → Identifiants), désactiver la création de comptes
(Authentication → Paramètres → Actions de l'utilisateur), mot de passe administrateur long et unique, alerte de budget / quota.

## Onglet Public et rangement par rubriques (stats 1.22.0, jeu 9.93.0)

### Ce qui a changé dans Alcuno Stats

- 5 onglets : **Stats** (ce qui se passe dans le jeu, en trois groupes : Parties, Quand on joue, Joueurs), **Public** (nouveau),
  **Santé**, **Pilotage**, **Aide**.
- **Pilotage** n'est plus une longue page : 8 rubriques, une seule affichée à la fois (la dernière ouverte est retenue).
  👁 Aperçu (réglé en ce moment, ce que voit un joueur, lecture, historique, annuler) · 💬 Assistant (+ raccourcis, clé d'IA) ·
  📣 Annonce · 🔊 Son et jeu (couper une fonction, valeurs de départ, **mise à jour demandée**, qui a maintenant son propre réglage) ·
  🎨 Thèmes · 🔥 Défis hot · 🍹 Bar (l'ancien onglet Bar) · 🔑 Compte (identifiant, déconnexion, réinitialisation des statistiques).
- Adresse directe vers une rubrique : `stats.html#pilotage-themes`, `#pilotage-bar`, `#public-liste`…

### Onglet Public : d'où viennent les appareils

Pour chaque appareil qui ouvre le jeu (jeu 9.93.0 ou plus), `js/stats.js` ajoute à sa fiche `stats/appareils/{id}` :

| Information | D'où elle vient |
|---|---|
| Pays, région, ville, fournisseur internet | de l'**adresse IP**, par un service extérieur (ipwho.is, puis get.geojs.io si le premier ne répond pas), une fois par jour et par appareil |
| Type d'appareil, navigateur, version du système, résolution d'écran, langue de l'appareil, fuseau horaire | du **navigateur** (l'adresse IP ne les donne pas) |

- **Aucune autorisation n'est demandée au joueur** : le jeu n'utilise pas la position du téléphone (GPS), un test le vérifie.
- **L'adresse IP n'est pas enregistrée** ; seul le lieu déduit l'est. Le service de lieu, lui, voit l'adresse IP (comme tout site visité).
- La ville est **approximative** : en 4G / 5G c'est souvent celle du relais de l'opérateur, avec un VPN celle du VPN.
- Chrome sur Android et les ordinateurs ne donnent pas toujours la version exacte du système : elle s'affiche alors sans numéro.
- Les deux services sont gratuits et sans clé ; leurs limites d'usage peuvent changer. Si « localisés » reste à 0 alors que les autres
  informations arrivent, c'est le service qui ne répond plus (adresses dans `SERVICES_ORIGINE`, `js/stats.js`).

### À faire après la mise en ligne

Recoller `database.rules.json` dans Realtime Database → Règles → **Publier** (10 nouveaux champs dans `stats/appareils`).
Tant que ce n'est pas fait, rien ne casse : l'origine est écrite à part, seule cette écriture est refusée, et l'onglet Public reste vide.

### À savoir (données personnelles)

Un lieu déduit de l'adresse IP, un fournisseur d'accès et les caractéristiques d'un appareil, rattachés à un identifiant, sont des
données personnelles au sens du RGPD, et l'adresse IP part chez un service tiers. Le jeu ne peut donc plus être présenté comme ne
collectant « aucune donnée personnelle » : il faut au minimum en informer les joueurs (FAQ ou Crédits du jeu). Ce point n'est pas réglé par le code.

### Infos en temps réel (stats 1.23.0)
Onglet Public, sous « Portée » : une ligne par appareil qui a le jeu ouvert maintenant (présence rafraîchie depuis moins de 3 min) : état (menu, partie classique, partie en ligne, télé), thème, lieu, fournisseur, appareil, navigateur, système, écran, langue, fuseau et heure locale, version du jeu. Rien de nouveau n'est écrit par les joueurs : la page rapproche `presence/{id}` de `stats/appareils/{id}` (même identifiant). Limites : le thème est celui relevé à l'ouverture du jeu (un changement de thème recharge la page, donc il est à jour) ; une télé castée n'a pas de fiche d'appareil (affichée « Appareil inconnu »).

## Profil joueur : connexion Google (jeu 9.95.0)

Dans les Réglages du jeu, le bloc **Profil joueur** permet de se connecter avec Google (facultatif) pour retrouver sa progression
sur un autre téléphone : thèmes secrets débloqués, mode hard, album de stickers, zizi-coptère, et les réglages (thème, sons, voix,
langue, ordre des Réglages…). Sans compte, rien ne change. Code : `js/profil.js` ; test : `node tests/test_profil.js`.

**À faire une seule fois, AVANT de mettre cette version en ligne** (sinon « Se connecter » répond « La connexion Google n'est pas
encore activée pour le jeu ») :

1. **Console Firebase** → **Authentication** → **Sign-in method** → *Ajouter un fournisseur* → **Google** → Activer
   (nom public du projet : « Alcuno », e-mail d'assistance : le tien) → Enregistrer.
2. **Authentication** → **Settings** → **Authorized domains** : ajoute `tristan-escardo.github.io` (et tout autre domaine où le jeu
   est servi).
3. **Authentication** → **Settings** → **User actions** : la **création de comptes doit rester autorisée** (si tu l'avais désactivée
   à l'étape 2 du début de ce document, réactive-la : un joueur qui se connecte pour la première fois crée son compte).
4. **Realtime Database** → **Règles** : recolle `database.rules.json` (nouvelle section `profils`) → **Publier**. Sans ça, la
   connexion marche mais rien n'est sauvegardé (« Connecté, mais la sauvegarde n'a pas pu se faire »).
5. **Google Cloud Console** (console.cloud.google.com, projet *alcuno*) → **API et services** → **Identifiants** → *ID clients
   OAuth 2.0* → **Web client (auto created by Google Service)** → **URI de redirection autorisés** → *Ajouter un URI* →
   `https://tristan-escardo.github.io/Alcuno/` (exactement, avec la barre finale) → Enregistrer. Ne retire pas l'URI
   `https://alcuno.firebaseapp.com/__/auth/handler` déjà présent. Sans ça, dans l'appli installée, la page Google répond
   « Accès bloqué : redirect_uri_mismatch ». Si le jeu est servi à une autre adresse, ajoute-la aussi.

Ce qui est enregistré : `profils/<uid>` (déblocages, stickers, réglages), lisible et modifiable **seulement par son propriétaire**
(pas même par le compte administrateur depuis le jeu ; tu le vois dans la console Firebase). Ni nom ni e-mail dans la base : ils sont
dans Authentication → Users. Ne partent jamais : l'éthylotest (poids, sexe), le journal du mouchard, la partie en cours, les codes.

Règles de fusion : déblocages et stickers = l'union des téléphones (rien ne se perd) ; réglages = le dernier modifié gagne, et à la
première connexion sur un téléphone ce sont ceux du profil qui sont repris (la page se recharge une fois, depuis l'accueil seulement).

« Supprimer mon profil » (visible une fois connecté) efface `profils/<uid>` et le compte dans Authentication ; le téléphone garde ce
qu'il a. C'est le droit à l'effacement du RGPD : pense à mentionner le profil dans ta politique de confidentialité si tu en as une.

Le profil utilise sa propre appli Firebase (nommée « profil ») : ta connexion administrateur d'Alcuno Stats n'est pas touchée, et le
reste du jeu continue de parler à la base sans être connecté.

**Deux façons de se connecter** (jeu 9.95.2) :
- dans un navigateur : la fenêtre Google de Firebase ;
- dans l'**appli installée** (écran d'accueil de l'iPhone surtout), où cette fenêtre ne s'ouvre jamais et ne répond jamais (le
  bouton restait sur « Connexion… ») : le jeu va sur la page Google, qui revient dans le jeu déjà connecté, Réglages rouverts.
  C'est l'étape 5 ci-dessus qui l'autorise. Pas pendant une partie (la page est rechargée au retour) : « Termine ta partie, puis
  connecte-toi depuis l'accueil ».
- la page Google sert aussi de secours : fenêtre bloquée par le navigateur, ou sans réponse au bout de 8 s (le bouton est rendu,
  le tap suivant passe par la page Google).

**À vérifier à la main sur de vrais téléphones** (le test automatique simule Google) : iPhone avec l'appli ajoutée à l'écran
d'accueil, iPhone dans Safari, Android (Chrome et appli installée).
