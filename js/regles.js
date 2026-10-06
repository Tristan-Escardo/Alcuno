// =============================================================================================
// ALCUNO : Règles : overlays, duel, déroulement du jeu, écran « Nouvelle partie »
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Overlays des règles : pigeon, annonces, annulations, carte dorée
/* ===== PIGEON OVERLAY ===== */
function afficherOverlayFinUnRestants(){
  if(finUnOverlayAffiche) return;
  finUnOverlayAffiche = true;

  // joueurs qui ont encore des "un" stockés
  const restants = joueurs
    .map(nom => ({ nom, n: Number(annulations[nom] || 0) }))
    .filter(x => x.n > 0);

  // Même s'il n'y a aucun "1" restant, on affiche quand même l'écran de fin.

  // on évite de superposer des overlays
  const overlayRegle = document.getElementById("overlayRegleUnique");
  if(overlayRegle) overlayRegle.remove(); // fin de partie => on nettoie

  lockScroll();

  const overlay = document.createElement("div");
  overlay.id = "overlayFinUnRestants";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.backgroundColor = "rgb(0,0,0)";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.padding = "24px";
  overlay.style.gap = "18px";

  const titre = document.createElement("div");
  titre.className = "titre-pigeon";
  titre.innerText = "FIN DE LA PARTIE";
  overlay.appendChild(titre);

  const bloc = document.createElement("div");
  bloc.className = "fin-un-lignes";

  if(restants.length === 0){
    const ligne = document.createElement("div");
    ligne.className = "fin-un-ligne";
    ligne.innerText = "Aucun 1 restant à boire.";
    bloc.appendChild(ligne);
  } else {
    restants.forEach(x => {
      const ligne = document.createElement("div");
      ligne.className = "fin-un-ligne";
      ligne.innerText = `${x.nom} doit boire ${texteGorgees(x.n)} pour ses 1 restants`;
      bloc.appendChild(ligne);
    });
  }

  overlay.appendChild(bloc);

  const btnTerminer = document.createElement("button");
  btnTerminer.className = "bouton-pigeon";
  btnTerminer.innerText = "Terminer";

  surAction(btnTerminer, "fin:terminer", { once: true, unique: true }, () => {
    // ils boivent leurs "1 restants" => on remet les compteurs à 0
    restants.forEach(x => { annulations[x.nom] = 0; });
    afficherJoueurs();

    overlay.remove();
    unlockScroll();
  });

  overlay.appendChild(btnTerminer);
  document.body.appendChild(overlay);
}

function afficherMenuPigeon(){
  if(document.getElementById("overlayPigeon")) return;
  choixPigeonEnCours=true;
  lockScroll();

  const overlay=document.createElement("div");
  overlay.id="overlayPigeon";
  ajouterCarteVedette(overlay, carteTroisPourTransfertPigeon);

  const titre=document.createElement("div");
  titre.className="titre-pigeon";
  titre.innerText="Choisis le nouveau PIGEON";
  overlay.appendChild(titre);

  // C'est le pigeon actuel (celui qui vient de tirer le 3) qui choisit
  const choisisseur = joueurs[indexPigeon];

  joueurs.forEach((j,i)=>{
    if(i!==indexPigeon){
      const btn=document.createElement("button");
      btn.className="bouton-pigeon";
      btn.innerText=j;
      surAction(btn, "pigeon:" + i, { owner: choisisseur, once: true }, ()=>{
      indexPigeon = i;
      nomPigeonOriginal = joueurs[i];
      // 1) on ferme l'overlay de choix
      unlockScroll();
      overlay.remove();
      choixPigeonEnCours = false;
      afficherJoueurs();
      afficherJoueurActif();
      // 2) message demandé (overlay + .messages)
      const nPigeon = gorgeesPigeon();
      const msg = `${joueurs[i]} est le nouveau PIGEON !\nIl/elle boit ${texteGorgees(nPigeon)} pour fêter ça.`;
      // .messages : on l'affiche dans reglePigeon (et il disparaît au prochain tirage)
      // 3) overlay + annulation si compteur (utilise la carte "trois" qui a déclenché le transfert)
      const carteTrois = carteTroisPourTransfertPigeon || "trois_vert";
      const joueurTrois = joueurTroisPourTransfertPigeon;
      const couleurTrois = couleurTroisPourTransfertPigeon;
      annoncerBoireAvecAnnulation(
        i,
        nPigeon,
        carteTrois,
        msg,
        // puis la gorgée couleur éventuelle de celui qui a tiré le 3
        () => appliquerBonusCouleurSiBesoin(carteTrois, { couleur: couleurTrois, joueur: joueurTrois, preserveRuleMessage: true })
      );
      reglerDureeOverlayRegle(msg, DUREE_ANNONCE_PIGEON); // annonce du pigeon : affichée 2 fois plus longtemps
      jouerSon("pigeon");
      // optionnel : on nettoie
      carteTroisPourTransfertPigeon = "";
      joueurTroisPourTransfertPigeon = null;
      couleurTroisPourTransfertPigeon = null;
    });

      overlay.appendChild(btn);
    }
  });

  document.body.appendChild(overlay);
}

function dureeOverlaySelonNbLignes(nb){
  // Base légèrement augmentée pour laisser le temps de lire sans ralentir le jeu.
  return 1700 + Math.max(0, nb - 1) * 850;
}

function estimerNbLignesOverlay(message){
  const texte = String(message || "").trim();
  if(!texte) return 1;

  const largeur = window.innerWidth || 390;
  const caracteresParLigne =
    largeur <= 380 ? 16 :
    largeur <= 520 ? 20 :
    largeur <= 720 ? 26 : 34;

  return texte
    .split(/\n+/)
    .reduce((total, ligne) => {
      const propre = ligne.trim();
      if(!propre) return total + 1;
      return total + Math.max(1, Math.ceil(propre.length / caracteresParLigne));
    }, 0);
}

// Disparition des overlays : fondu doux (avant : rétrécissement à 80 % en même temps, trop brutal).
// Il bloque les taps jusqu'au bout : certaines règles enchaînent un écran juste après (annulations).
// Même durée qu'avant (0,3 s) : l'ordre d'enchaînement des écrans ne change pas.
const DUREE_SORTIE_OVERLAY = 300;
function animerSortieOverlay(overlay){
  overlay.style.transition = `opacity ${DUREE_SORTIE_OVERLAY}ms ease-out, transform ${DUREE_SORTIE_OVERLAY}ms ease-out`;
  overlay.style.opacity = "0";
  overlay.style.transform = "scale(0.98)";
}

// Appelle callback UNE fois : à la fin de la transition de l'élément, ou au plus tard après `ms`.
// Sécurité : si la transition n'a pas lieu (ex. fermeture juste avant la fin de l'apparition),
// "transitionend" n'arrive jamais et l'overlay resterait bloqué à l'écran.
function apresTransition(el, ms, callback){
  let fait = false;
  const fin = () => {
    if (fait) return;
    fait = true;
    // Overlay déjà retiré par une nouvelle partie : on n'enchaîne pas sur la suite de l'ancienne
    if (!el.isConnected) return;
    callback();
  };
  el.addEventListener("transitionend", fin, { once: true });
  setTimeout(fin, delai(ms) + 80);
}

function dureeOverlayPourMessage(message){
  if(rattrapageEnCours) return delai(0);
  const texte = String(message || "").trim();
  const nbLignes = estimerNbLignesOverlay(texte);
  const nbMots = texte ? texte.split(/\s+/).filter(Boolean).length : 0;

  const duree =
    dureeOverlaySelonNbLignes(nbLignes) +
    Math.max(0, nbMots - 5) * 45;

  return Math.min(4300, Math.max(1800, duree));
}

/* ===== Overlay animé pour toutes les cartes spéciales ===== */
let overlayRegleTimeout = null;
// ===== Annulation de gorgées (carte "un") =====
let overlayRegleVerrouille = false; // si true => overlayRegleUnique ne s'auto-ferme pas

function fermerOverlayRegleUnique(afterClose = null){
  const overlay = document.getElementById("overlayRegleUnique");
  if(!overlay) {
    if(typeof afterClose === "function") afterClose();
    return;
  }

  overlayRegleVerrouille = false;

  if (overlayRegleTimeout) {
    clearTimeout(overlayRegleTimeout);
    overlayRegleTimeout = null;
  }

  // Déjà en train de se fermer (tap + minuteur) : une seule fermeture
  if (overlay.dataset.enFermeture) return;
  overlay.dataset.enFermeture = "1";

  animerSortieOverlay(overlay);
  apresTransition(overlay, DUREE_SORTIE_OVERLAY, () => {
    if (!overlay.dataset.enFermeture) return; // une nouvelle annonce l'a réutilisé entre-temps
    overlay.remove();
    unlockScroll();
    if(typeof afterClose === "function") afterClose();
  });
}

function executerApresOverlayRegleUnique(callback){
  const overlay = document.getElementById("overlayRegleUnique");
  if(!overlay){
    callback();
    return;
  }

  const generation = generationPartie;
  const obs = new MutationObserver(() => {
    const stillThere = document.getElementById("overlayRegleUnique");
    if(!stillThere){
      obs.disconnect();
      if(generation === generationPartie) callback();
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
}

function joueurPeutAnnuler(joueurIndex, nbGorgees){
  const nom = joueurs[joueurIndex];
  const dispo = Number(annulations[nom] || 0);
  return Math.min(dispo, nbGorgees) > 0;
}

function afficherOverlayResultatAnnulation(message, afterClose = null){
  if(document.getElementById("overlayResultatAnnulation")) return false;

  lockScroll();

  const overlay = document.createElement("div");
  overlay.id = "overlayResultatAnnulation";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "10001";
  overlay.style.backgroundColor = "rgb(0,0,0)";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.padding = "20px";
  overlay.style.textAlign = "center";
  overlay.style.color = "#FFD700";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.25s ease, transform 0.25s ease";
  overlay.style.transform = "scale(0.96)";
  overlay.style.gap = "16px";
  overlay.style.overflowY = "auto";
  overlay.style.webkitOverflowScrolling = "touch";

  const texte = document.createElement("div");
  texte.innerText = message;
  texte.style.fontSize = "clamp(22px, 5vw, 42px)";
  texte.style.fontWeight = "900";
  texte.style.textShadow = "2px 2px 5px #000";
  texte.style.maxWidth = "min(820px, 100%)";
  overlay.appendChild(texte);

  let enFermeture = false;
  const fermer = () => {
    if(enFermeture) return; // tap + minuteur : une seule fermeture
    enFermeture = true;
    animerSortieOverlay(overlay);
    apresTransition(overlay, DUREE_SORTIE_OVERLAY, () => {
      overlay.remove();
      unlockScroll();
      if(typeof afterClose === "function") afterClose();
    });
  };

  overlay.style.cursor = "pointer";
  overlay.addEventListener("pointerdown", fermer);

  document.body.appendChild(overlay);
  getComputedStyle(overlay).opacity; // départ du fondu bien pris en compte (sinon il apparaissait d'un coup)
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    overlay.style.transform = "scale(1)";
  });

  setTimeout(fermer, dureeOverlayPourMessage(message));
  return true;
}

function afficherOverlayAnnulation(joueurIndex, nbGorgees, onDone = null, afterClose = null){
  const nom = joueurs[joueurIndex];
  const dispo = Number(annulations[nom] || 0);
  const maxAnnulable = Math.min(dispo, nbGorgees);

  if(maxAnnulable <= 0){
    if(typeof afterClose === "function") afterClose();
    return false;
  }

  if(document.getElementById("overlayAnnulation")) return true;

  lockScroll();

  const overlay = document.createElement("div");
  overlay.id = "overlayAnnulation";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "10000";
  overlay.style.backgroundColor = "rgb(0,0,0)";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.padding = "20px";
  overlay.style.textAlign = "center";
  overlay.style.color = "#FFD700";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.25s ease, transform 0.25s ease";
  overlay.style.transform = "scale(0.96)";
  overlay.style.gap = "16px";
  overlay.style.overflowY = "auto";
  overlay.style.webkitOverflowScrolling = "touch";

  const titre = document.createElement("div");
  titre.innerText = `${nom}, tu as ${dispo} annulation${dispo > 1 ? "s" : ""}.`;
  titre.style.fontSize = "clamp(24px, 5vw, 46px)";
  titre.style.fontWeight = "900";
  titre.style.textShadow = "2px 2px 5px #000";
  overlay.appendChild(titre);

  const sousTitre = document.createElement("div");
  sousTitre.innerText = "Combien de gorgées veux-tu annuler ?";
  sousTitre.style.fontSize = "clamp(18px, 4vw, 28px)";
  sousTitre.style.fontWeight = "800";
  sousTitre.style.maxWidth = "min(780px, 100%)";
  overlay.appendChild(sousTitre);

  const boutons = document.createElement("div");
  boutons.style.display = "flex";
  boutons.style.flexWrap = "wrap";
  boutons.style.justifyContent = "center";
  boutons.style.gap = "14px";
  boutons.style.width = "min(760px, 100%)"; // (92vw dépassait de la marge de l'overlay : il défilait de côté)
  overlay.appendChild(boutons);

  let enFermeture = false;
  const fermer = (callback = null) => {
    if(enFermeture) return;
    enFermeture = true;
    animerSortieOverlay(overlay);
    apresTransition(overlay, DUREE_SORTIE_OVERLAY, () => {
      overlay.remove();
      unlockScroll();
      if(typeof callback === "function"){
        callback();
      } else if(typeof afterClose === "function"){
        afterClose();
      }
    });
  };

  for(let i=0; i<=maxAnnulable; i++){
    const btn = document.createElement("button");
    btn.className = "bouton-annulation";
    btn.innerText = `Annuler ${i}`;
    btn.style.width = "min(420px, 100%)";
    btn.style.padding = "clamp(12px, 3.2vw, 22px)";
    btn.style.fontSize = "clamp(16px, 4vw, 28px)";
    btn.style.fontWeight = "800";
    btn.style.border = "none";
    btn.style.borderRadius = "12px";
    btn.style.backgroundColor = "#FFD700";
    btn.style.color = "#000";
    btn.style.cursor = "pointer";
    btn.style.boxShadow = "0 10px 24px rgba(0,0,0,0.28)";

    surAction(btn, `annul:${nom}:${i}`, { owner: nom, once: true }, () => {
      // Overlay en train de se fermer : ses autres boutons ne doivent plus recevoir d'action
      overlay.dataset.netFerme = "1";
      const utilise = i;
      const reste = nbGorgees - utilise;
      jouerSon(utilise > 0 ? "annuler_gorgees" : "annuler_0_gorgees");
      const messageResultat = utilise > 0
        ? `${texteGorgees(utilise)} annulée${utilise > 1 ? "s" : ""}. \nTu bois ${texteGorgees(reste)}.`
        : `Tu n’annules rien. \nTu bois ${texteGorgees(reste)}.`;

      annulations[nom] = Math.max(0, dispo - utilise);
      afficherJoueurs();
      afficherJoueurActif();

      if(typeof onDone === "function") onDone(utilise, reste);

      fermer(() => {
        afficherOverlayResultatAnnulation(messageResultat, afterClose);
      });
    });

    boutons.appendChild(btn);
  }

  document.body.appendChild(overlay);
  getComputedStyle(overlay).opacity; // départ du fondu bien pris en compte (sinon il apparaissait d'un coup)
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    overlay.style.transform = "scale(1)";
  });

  return true;
}

// Annonce "X boit N" + propose annulation si dispo
function annoncerBoireAvecAnnulation(joueurIndex, nbGorgees, classeCarte = "", prefixMsg = null, onFinish = null){
  const nom = joueurs[joueurIndex];
  const msg = prefixMsg ? prefixMsg : `${nom} boit ${texteGorgees(nbGorgees)}`;

  if (nbGorgees > 15) {
    // Easter egg : message signé Célien, mise en forme premium
    const citationCelien = "Et interdit de vomir, c'est pas fini !";
    const signatureCelien = "Signé Célien, un des créateurs du jeu";
    const message17 = `${citationCelien}\n${signatureCelien}`;

    montrerOverlayRegle(`${msg}\n\n${message17}`, classeCarte);
    habillerOverlayCelien(msg, citationCelien, signatureCelien);

    // Ce message contient l'avertissement "interdit de vomir" => +2s d'affichage
    if (overlayRegleTimeout) {
      clearTimeout(overlayRegleTimeout);
    }
    if (!overlayRegleVerrouille) {
      overlayRegleTimeout = setTimeout(
        () => fermerOverlayRegleUnique(),
        delai(dureeOverlayPourMessage(`${msg}\n\n${message17}`) + 2000)
      );
    }
      const ensuite = () => {
        if(joueurPeutAnnuler(joueurIndex, nbGorgees)){
          afficherOverlayAnnulation(
            joueurIndex,
            nbGorgees,
            null,
            () => { if(typeof onFinish === "function") onFinish(); }
          );
        } else if(typeof onFinish === "function"){
          onFinish();
        }
      };
      executerApresOverlayRegleUnique(ensuite);
    return;
  }

  regleZero.innerText = msg;
  regleZero.style.display = "block";
  zeroEnCours = true;

  montrerOverlayRegle(msg, classeCarte);

  const ensuite = () => {
    if(joueurPeutAnnuler(joueurIndex, nbGorgees)){
      afficherOverlayAnnulation(
        joueurIndex,
        nbGorgees,
        null,
        () => { if(typeof onFinish === "function") onFinish(); }
      );
    } else if(typeof onFinish === "function"){
      onFinish();
    }
  };

  executerApresOverlayRegleUnique(ensuite);
}



// Texte des overlays de règle : la 1re ligne en titre, les suivantes en détails plus petits
// (avant, tout s'affichait d'un bloc dans la même grosse taille : illisible dès 3-4 lignes)
function remplirTexteRegle(boxTexte, message){
  boxTexte.innerHTML = "";
  String(message || "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .forEach((texte, i) => {
      const el = document.createElement("div");
      el.className = i === 0 ? "regle-titre" : "regle-detail";
      el.innerText = texte;
      boxTexte.appendChild(el);
    });
}

// Carte tirée, affichée en haut des overlays de choix (+4, duel, nouveau pigeon)
function ajouterCarteVedette(parent, classeCarte, classeEnPlus = ""){
  if(!classeCarte) return;
  const carte = document.createElement("div");
  carte.className = `Carte retournee carte-vedette ${classeCarte} ${classeEnPlus}`.trim();
  parent.appendChild(carte);
}

function montrerOverlayRegle(message, classeCarte = "", classeCarteSupplementaire = "") {
  let overlay = document.getElementById("overlayRegleUnique");
  if (overlay) {
    // Annonce arrivée pendant que le précédent disparaît (ex. en ligne, l'action d'un autre joueur) :
    // on annule sa sortie (avant, la nouvelle annonce disparaissait avec lui, carte comprise)
    if (overlay.dataset.enFermeture) {
      delete overlay.dataset.enFermeture;
      overlay.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    }
    // Overlay réutilisé : on retire l'habillage doré d'un message carte dorée précédent
    overlay.classList.remove("overlay-doree");
    const cartes = overlay.querySelector(".overlay-regle-cartes");
    const boxTexte = overlay.querySelector(".overlay-regle-texte");

    if (overlayRegleTimeout) {
      clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = null;
    }

    if (cartes) {
      cartes.innerHTML = "";
      if (classeCarte) {
        const carte1 = document.createElement("div");
        carte1.className = "Carte " + classeCarte;
        cartes.appendChild(carte1);
      }
      if (classeCarteSupplementaire) {
        const carte2 = document.createElement("div");
        carte2.className = "Carte " + classeCarteSupplementaire;
        cartes.appendChild(carte2);
      }
      cartes.style.display = cartes.children.length > 0 ? "flex" : "none";
    }

    if (boxTexte) remplirTexteRegle(boxTexte, message);

    if (!overlayRegleVerrouille) {
      overlayRegleTimeout = setTimeout(() => fermerOverlayRegleUnique(), dureeOverlayPourMessage(message));
    }
    return;
  }

  overlay = document.createElement("div");
  overlay.id = "overlayRegleUnique";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgb(0,0,0)";
  overlay.style.display = "flex";
  overlay.style.flexDirection = "column";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "9999";
  overlay.style.color = "#FFD700";
  overlay.style.fontSize = "36px";
  overlay.style.fontWeight = "bold";
  overlay.style.textAlign = "center";
  overlay.style.padding = "20px";
  overlay.style.borderRadius = "20px";
  overlay.style.opacity = "0";
  overlay.style.transition = "opacity 0.3s ease, transform 0.3s ease";
  overlay.style.transform = "scale(1)";

  const cartes = document.createElement("div");
  cartes.className = "overlay-regle-cartes";
  cartes.style.display = "flex";
  cartes.style.gap = "30px";
  cartes.style.marginBottom = "20px";

  if (classeCarte) {
    const carte1 = document.createElement("div");
    carte1.className = "Carte " + classeCarte;
    cartes.appendChild(carte1);
  }

  if (classeCarteSupplementaire) {
    const carte2 = document.createElement("div");
    carte2.className = "Carte " + classeCarteSupplementaire;
    cartes.appendChild(carte2);
  }

  cartes.style.display = cartes.children.length > 0 ? "flex" : "none";
  overlay.appendChild(cartes);

  const boxTexte = document.createElement("div");
  boxTexte.className = "overlay-regle-texte";

  remplirTexteRegle(boxTexte, message);

  overlay.appendChild(boxTexte);
  overlay.style.cursor = "pointer";
  overlay.addEventListener("pointerdown", () => {
    if (!overlayRegleVerrouille) {
      fermerOverlayRegleUnique();
    }
  });

  lockScroll();
  document.body.appendChild(overlay);
  getComputedStyle(overlay).opacity; // départ du fondu bien pris en compte

  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    overlay.style.transform = "scale(1)";
  });

  if (!overlayRegleVerrouille) {
    if (overlayRegleTimeout) clearTimeout(overlayRegleTimeout);
    overlayRegleTimeout = setTimeout(() => fermerOverlayRegleUnique(), dureeOverlayPourMessage(message));
  }
}

function afficherOverlayCouleur(joueurActuel){
  if(document.getElementById("overlayCouleur")) return;
  const choisisseur = joueurs[joueurActuel];
  choixPigeonEnCours = true;
  lockScroll();

  const overlay = document.createElement("div");
  overlay.id = "overlayCouleur";

  const titre = document.createElement("div");
  titre.className = "titre-couleur";
  titre.innerText = "Choisis une couleur";
  overlay.appendChild(titre);

  const container = document.createElement("div");
  container.className = "container-couleurs";

  const couleurs = [
    { nom: "vert", classe: "carre-vert" },
    { nom: "jaune", classe: "carre-jaune" },
    { nom: "rouge", classe: "carre-rouge" },
    { nom: "bleu", classe: "carre-bleu" }
  ];

  couleurs.forEach(c=>{
    const carre = document.createElement("div");
    carre.className = "carre-couleur " + c.classe;
    surAction(carre, "couleur:" + c.nom, { owner: choisisseur, once: true }, ()=>{
      couleurChoisie = c.nom;
      majAffichageCouleur();
      unlockScroll();
      overlay.remove();
      choixPigeonEnCours = false;
      afficherJoueurActif();
    });
    container.appendChild(carre);
  });

  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

/* ===== CARTE DORÉE : habillage premium de l'overlay de règle =====
   Fond doré + grand titre (par défaut « ✦ CARTE DORÉE ✦ ») + texte en dessous (facultatif) */
const TITRE_CARTE_DOREE = '<span class="doree-etincelle">✦</span> CARTE DORÉE <span class="doree-etincelle">✦</span>';

// Change la durée d'affichage de l'overlay de règle qui vient d'être montré.
// facteur = null : il reste affiché jusqu'à ce qu'on tape dessus.
// Annonce d'un pigeon (premier pigeon ou nouveau pigeon choisi) : 2 fois le temps de lecture normal
const DUREE_ANNONCE_PIGEON = 2;

function reglerDureeOverlayRegle(message, facteur){
  if(overlayRegleTimeout){
    clearTimeout(overlayRegleTimeout);
    overlayRegleTimeout = null;
  }
  if(facteur === null || overlayRegleVerrouille) return;
  overlayRegleTimeout = setTimeout(
    () => fermerOverlayRegleUnique(),
    Math.round(dureeOverlayPourMessage(message) * facteur)
  );
}

// Easter egg Célien (plus de 15 gorgées) : fond doré, le message, puis la citation
// en italique dorée et la signature ornée
function habillerOverlayCelien(message, citation, signature){
  const overlay = document.getElementById("overlayRegleUnique");
  const boxTexte = overlay && overlay.querySelector(".overlay-regle-texte");
  if(!boxTexte) return;

  overlay.classList.add("overlay-doree");
  remplirTexteRegle(boxTexte, message);

  const bloc = document.createElement("div");
  bloc.className = "celien-bloc";

  const ligneCitation = document.createElement("div");
  ligneCitation.className = "celien-citation";
  ligneCitation.innerText = `« ${citation} »`;

  const ligneSignature = document.createElement("div");
  ligneSignature.className = "celien-signature";
  ligneSignature.innerHTML =
    `<span class="doree-etincelle">✦</span> ${echapperHtml(signature)} 👑 <span class="doree-etincelle">✦</span>`;

  bloc.appendChild(ligneCitation);
  bloc.appendChild(ligneSignature);
  boxTexte.appendChild(bloc);
}

function habillerOverlayCarteDoree(texte, titreHtml = TITRE_CARTE_DOREE){
  const overlay = document.getElementById("overlayRegleUnique");
  const boxTexte = overlay && overlay.querySelector(".overlay-regle-texte");
  if(!boxTexte) return;

  overlay.classList.add("overlay-doree");
  boxTexte.innerHTML = "";

  const titre = document.createElement("div");
  titre.className = "doree-titre";
  titre.innerHTML = titreHtml;
  boxTexte.appendChild(titre);

  if(texte){
    const ligne = document.createElement("div");
    ligne.className = "doree-texte";
    ligne.innerText = texte;
    boxTexte.appendChild(ligne);
  }
}

/* ===== CARTE DORÉE : choix de celui qui prend le cul sec ===== */
function afficherOverlayCarteDoree(joueurActuel){
  if(document.getElementById("overlayCarteDoree")) return;
  const choisisseur = joueurs[joueurActuel];
  choixPigeonEnCours = true;
  lockScroll();

  const overlay = document.createElement("div");
  overlay.id = "overlayCarteDoree";

  // En-tête : la carte dorée qui brille, le titre, puis la consigne
  const carte = document.createElement("div");
  carte.className = "Carte carte_doree doree-carte-vedette";
  overlay.appendChild(carte);

  const titre = document.createElement("div");
  titre.className = "doree-titre";
  titre.innerHTML = TITRE_CARTE_DOREE;
  overlay.appendChild(titre);

  const consigne = document.createElement("div");
  consigne.className = "doree-texte";
  consigne.innerText = estModeSoft() ? "Choisis à qui tu distribues tes 3 gorgées" : "Choisis à qui tu distribues ton CUL SEC";
  overlay.appendChild(consigne);

  const liste = document.createElement("div");
  liste.className = "doree-boutons";
  overlay.appendChild(liste);

  // Tout le monde, y compris celui qui a tiré la carte
  joueurs.forEach((nom, i) => {
    const btn = document.createElement("button");
    btn.className = "bouton-doree";
    btn.innerText = avecCouronne(nom);
    surAction(btn, "doree:" + i, { owner: choisisseur, once: true }, () => {
      overlay.remove();
      unlockScroll();
      afficherOverlayTiensGueule(nom);

      // En ligne : on débloque tout de suite. L'overlay reste affiché jusqu'au tap, mais ne doit
      // pas bloquer ce téléphone (sinon, s'il n'est pas tapé, il raterait les actions des autres
      // et se désynchroniserait). Si la partie avance, le message suivant le remplace.
      if(enLigneActif){
        choixPigeonEnCours = false;
        afficherJoueurActif();
        return;
      }

      // Classique : plateau (et pari de fin) débloqués seulement une fois le message lu
      executerApresOverlayRegleUnique(() => {
        choixPigeonEnCours = false;
        afficherJoueurActif();
      });
    });
    liste.appendChild(btn);
  });

  document.body.appendChild(overlay);
}

// En ligne : seul le téléphone de la victime affiche « TIENS DANS TA GUEULE. »
function afficherOverlayTiensGueule(victime){
  if(enLigneActif && victime !== pseudoActuel){
    const message = estModeSoft()
      ? `${victime} boit les 3 gorgées de la carte dorée !`
      : `${victime} prend le CUL SEC de la carte dorée !`;
    montrerOverlayRegle(message, "carte_doree");
    habillerOverlayCarteDoree(message);
    reglerDureeOverlayRegle(message, null); // reste jusqu'au tap
    return;
  }

  vibrer([400, 100, 400]); // c'est lui (ou, en classique, le téléphone de la table) qui prend


  // En classique, un seul téléphone pour tous : on précise qui prend le cul sec
  const titre = enLigneActif
    ? "TIENS DANS<br>TA GUEULE."
    : `TIENS DANS<br>TA GUEULE<br>${echapperHtml(avecCouronne(victime))}.`;
  montrerOverlayRegle("TIENS DANS TA GUEULE.", "carte_doree");
  habillerOverlayCarteDoree(estModeSoft() ? "3 gorgées !" : "", titre);
  reglerDureeOverlayRegle("", null); // reste jusqu'au tap
}

// #endregion

// #region Duel
/* ===== DUEL : Choix joueurs puis tirage ===== */
function lancerOverlayChoixDuel(joueurActuel, carteDuel = ""){
  if(document.getElementById("overlayDuel")) return;
  const choisisseur = joueurs[joueurActuel];
  duelEnCours = true;
  choixPigeonEnCours = true;
  lockScroll();
  duelMultiplicateur = 1;

  const overlay = document.createElement("div");
  overlay.id = "overlayDuel";

  const content = document.createElement("div");
  content.className = "duel-content duel-choix-content";
  overlay.appendChild(content);
  ajouterCarteVedette(content, carteDuel);

  const titre = document.createElement("div");
  titre.className = "titre-pigeon duel-main-title";
  titre.innerText = "DUEL ! Choisis 2 joueurs";
  content.appendChild(titre);

  const containerBoutons = document.createElement("div");
  containerBoutons.className = "duel-boutons";
  content.appendChild(containerBoutons);

  let picks = [];

  joueurs.forEach((nom, idx)=>{
    const btn = document.createElement("button");
    btn.className = "bouton-pigeon";
    btn.innerText = nom;

    surAction(btn, "duel:choix:" + idx, { owner: choisisseur, once: true }, ()=>{
      if(picks.length >= 2) return;
      if(picks.includes(idx)) return;

      picks.push(idx);
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.cursor = "not-allowed";
      btn.style.backgroundColor = "#ffea70";
      btn.style.color = "#000";

      if(picks.length === 2){
        overlay.innerHTML = "";
        afficherOverlayTirageDuel(overlay, picks[0], picks[1], carteDuel);
      }
    });

    containerBoutons.appendChild(btn);
  });

  document.body.appendChild(overlay);
}

function afficherOverlayTirageDuel(overlay, j1, j2, carteDuel = ""){
  const content = document.createElement("div");
  content.className = "duel-content duel-tirage-content";
  // Si une nouvelle partie démarre pendant le duel, ses minuteurs ne doivent plus rien faire
  const generation = generationPartie;
  overlay.appendChild(content);
  // Le 4 tiré, en petit : on voit qu'il ne fait pas partie des 2 cartes du duel
  ajouterCarteVedette(content, carteDuel, "carte-vedette-petite");

  const titre = document.createElement("div");
  titre.className = "titre-pigeon duel-main-title";
  titre.innerText = "DUEL";
  content.appendChild(titre);

  const info = document.createElement("div");
  info.className = "duel-info";
  content.appendChild(info);

  const revealWrap = document.createElement("div");
  revealWrap.className = "duel-reveal-wrap";
  content.appendChild(revealWrap);

  const containerCartes = document.createElement("div");
  containerCartes.className = "duel-cartes";
  revealWrap.appendChild(containerCartes);

  const c1 = document.createElement("div");
  c1.className = "Carte";
  containerCartes.appendChild(c1);

  const c2 = document.createElement("div");
  c2.className = "Carte";
  containerCartes.appendChild(c2);

  const labels = document.createElement("div");
  labels.className = "duel-labels";
  revealWrap.appendChild(labels);

  const label1 = document.createElement("div");
  label1.className = "duel-label";
  labels.appendChild(label1);

  const label2 = document.createElement("div");
  label2.className = "duel-label";
  labels.appendChild(label2);

  let carteA = null;
  let carteB = null;

  function tirerUneCarte(){
    resetPaquetDuelSiBesoin();
    return paquetDuel.shift();
  }

  // 1) On prépare le duel : les 2 cartes sont "en main" mais restent de dos à l'écran
  function preparerDuel(){
    phase = 1;
    choixJ1 = null;
    info.innerText = joueurs[j1] + " : choisis une carte";

    // Reset visuel : cartes de dos, qui pulsent (= à choisir)
    c1.className = "Carte duel-a-choisir";
    c2.className = "Carte duel-a-choisir";
    c1.style.boxShadow = "";
    c2.style.boxShadow = "";
    c1.style.opacity = "1";
    c2.style.opacity = "1";
    c1.style.pointerEvents = "auto";
    c2.style.pointerEvents = "auto";

    label1.innerText = "";
    label2.innerText = "";

    // On pioche 2 cartes, mais on NE les affiche PAS encore (donc dos)
    carteA = tirerUneCarte();
    carteB = tirerUneCarte();

    info.innerText = joueurs[j1] + " : choisis une carte";
  }

  function resoudreDuel(carteJ1, carteJ2){
    const v1 = valeurCarteDuel(carteJ1);
    const v2 = valeurCarteDuel(carteJ2);

    if(v1 === v2){
      duelMultiplicateur *= 2;
      // Le multiplicateur reste affiché dans le titre pendant tout le duel
      titre.innerText = "DUEL ×" + duelMultiplicateur;
      info.innerText = "Égalité ! Les gorgées sont multipliées : ×" + duelMultiplicateur;
      // petite pause puis on relance un duel (toujours dos au départ)
      setTimeout(() => {
        if(generation !== generationPartie) return;
        preparerDuel();
      }, delai(1500));
      return;
    }

    const perdant = (v1 < v2) ? j1 : j2;
    const vPerdant = (v1 < v2) ? v1 : v2;
    const gorg = gorgeesDuel(vPerdant, duelMultiplicateur);
    const msg = joueurs[perdant] + " boit " + texteGorgees(gorg);

    // Résultat visible tout de suite sur le duel : la carte du perdant en rouge, celle du gagnant estompée
    const carteDeJ1 = (choixJ1 === 1) ? c1 : c2;
    const carteDeJ2 = (choixJ1 === 1) ? c2 : c1;
    c1.style.opacity = ""; // (opacité posée par preparerDuel : sinon la carte du gagnant ne s'estompe pas)
    c2.style.opacity = "";
    (perdant === j1 ? carteDeJ1 : carteDeJ2).classList.add("duel-perdant");
    (perdant === j1 ? carteDeJ2 : carteDeJ1).classList.add("duel-gagnant");
    info.innerText = joueurs[perdant] + " perd le duel !";

    // 1) on enlève l’overlay du duel après le temps de lire le reveal (2,2 s),
    //    ou dès qu'on tape sur l'écran
    let suiteFaite = false;
    const suite = () => {
      if(suiteFaite || generation !== generationPartie) return;
      suiteFaite = true;
      overlay.removeEventListener("pointerdown", suite);

      // L'annonce « X boit N gorgées » apparaît en fondu PAR-DESSUS le duel, et le duel n'est
      // retiré dessous qu'une fois l'annonce affichée (avant : le plateau apparaissait entre les deux)
      annoncerBoireAvecAnnulation(perdant, gorg, carteDuel, msg);
      setTimeout(() => {
        overlay.remove();
        unlockScroll();
      }, delai(450));

      // Puis on restaure l'état du jeu (sans attendre la fin d'overlay ici)
      setTimeout(() => {
        if(generation !== generationPartie) return;
        duelEnCours = false;
        choixPigeonEnCours = false;
        duelMultiplicateur = 1;
        afficherJoueurActif();
      }, delai(1800));
    };
    setTimeout(suite, delai(2200));
    overlay.addEventListener("pointerdown", suite);
  }

  function onChoose(which){
    // Phase 1 : J1 choisit
    if(phase === 1){
      choixJ1 = which;
      phase = 2;

      // La carte de J1 se met en retrait (plus de halo) ; seule la carte restante pulse
      const choisie = (which === 1) ? c1 : c2;
      const restante = (which === 1) ? c2 : c1;
      choisie.classList.remove("duel-a-choisir");
      choisie.classList.add("duel-selected");
      choisie.style.pointerEvents = "none";
      restante.style.pointerEvents = "auto";

      // On sait tout de suite à qui est la carte choisie
      label1.innerText = (which === 1) ? "Carte de " + joueurs[j1] : "";
      label2.innerText = (which === 2) ? "Carte de " + joueurs[j1] : "";
      info.innerText = joueurs[j2] + " : clique sur la carte restante";
      return;
    }

    // Phase 2 : J2 doit cliquer la carte restante uniquement
    if(phase === 2){
      // sécurité : si J2 clique la même que J1 (normalement impossible)
      if(which === choixJ1) return;

      phase = 3; // terminé
      c1.style.pointerEvents = "none";
      c2.style.pointerEvents = "none";
      c1.classList.remove("duel-a-choisir");
      c2.classList.remove("duel-a-choisir");

      // Attribution réelle des cartes
      const carteJ1 = (choixJ1 === 1) ? carteA : carteB;
      const carteJ2 = (choixJ1 === 1) ? carteB : carteA;

      // Le nom de J2 s'affiche tout de suite sous sa carte (comme pour J1), avant le retournement
      if(which === 1) label1.innerText = "Carte de " + joueurs[j2];
      else label2.innerText = "Carte de " + joueurs[j2];

      info.innerText = "On retourne les cartes…";
      overlay.classList.add("reveal");

      c1.classList.remove("duel-selected");
      c2.classList.remove("duel-selected");
      c1.style.boxShadow = "";
      c2.style.boxShadow = "";

      // Reveal des 2 cartes (on ajoute les classes maintenant)
      setTimeout(() => {
        if(generation !== generationPartie) return; // partie relancée entre-temps

        overlay.classList.remove("reveal");
        
        c1.style.boxShadow = "";
        c2.style.boxShadow = "";

        c1.className = "Carte retournee";
        c2.className = "Carte retournee";

        // La gauche montre carteA, la droite montre carteB (positions fixes)
        c1.classList.add(carteA);
        c2.classList.add(carteB);
        jouerSon("cartes"); // les 2 cartes du duel se retournent

        // Labels clairs : qui a quoi
        if(choixJ1 === 1){
          label1.innerText = "Carte de " + joueurs[j1];
          label2.innerText = "Carte de " + joueurs[j2];
        } else {
          label1.innerText = "Carte de " + joueurs[j2];
          label2.innerText = "Carte de " + joueurs[j1];
        }

        info.innerText = "Résultat…";
        resoudreDuel(carteJ1, carteJ2);
      }, delai(1400));
    }
  }


  // J1 choisit sa carte, puis J2 prend la restante
  const choisisseurDuel = () => phase === 1 ? joueurs[j1] : joueurs[j2];
  surAction(c1, "duel:carte:1", { owner: choisisseurDuel }, () => onChoose(1));
  surAction(c2, "duel:carte:2", { owner: choisisseurDuel }, () => onChoose(2));

  preparerDuel();
}

function afficherOverlayPlus4(joueurActuel, classeCartePlus4){
  if(document.getElementById("overlayPlus4")) return;

  choixPigeonEnCours = true;
  const aDistribuer = gorgeesPlus4(); // 4 (2 en mode soft)
  lockScroll();
  const choisisseur = joueurs[joueurActuel];

  const overlay = document.createElement("div");
  overlay.id = "overlayPlus4";
  ajouterCarteVedette(overlay, classeCartePlus4);

  const titre = document.createElement("div");
  titre.className = "titre-pigeon";
  titre.innerText = `PLUS 4\nDistribue ${texteGorgees(aDistribuer)}`; // « PLUS 4 » au-dessus
  overlay.appendChild(titre);

  const totalBox = document.createElement("div");
  totalBox.className = "plus4-total";
  overlay.appendChild(totalBox);

  const container = document.createElement("div");
  container.className = "plus4-container-joueurs";
  overlay.appendChild(container);

  const actions = document.createElement("div");
  actions.className = "plus4-actions";
  overlay.appendChild(actions);

  // distribution par joueur (index -> nb gorgées)
  const dist = {};
  joueurs.forEach((_, i) => dist[i] = 0);

  // historique pour "annuler le dernier"
  let historique = []; // ex: [2,2,5,1] = on a ajouté +1 à ces joueurs dans cet ordre

  function totalDistribue(){
    return Object.values(dist).reduce((a,b)=>a+b,0);
  }

  function refreshUI(){
    const total = totalDistribue();
    totalBox.innerText = `Gorgées distribuées : ${total} / ${aDistribuer}`;

    // update boutons joueurs (badge)
    [...container.querySelectorAll("button[data-idx]")].forEach(btn=>{
      const idx = Number(btn.dataset.idx);
      const n = dist[idx];
      btn.innerHTML = n > 0
      ? `${echapperHtml(joueurs[idx])} <span class="plus4-badge">+ ${n}</span>`
      : echapperHtml(joueurs[idx]);

      // Total atteint : plus possible d'en ajouter, les joueurs ne réagissent plus (même apparence)
      // jusqu'à « Retour » ou « Annuler »
      btn.disabled = total >= aDistribuer;
    });

    // enable/disable undo
    btnUndo.disabled = (historique.length === 0);
    btnUndo.style.opacity = btnUndo.disabled ? "0.6" : "1";

    // validation uniquement si le total est atteint
    btnValider.disabled = (total !== aDistribuer);
    btnValider.style.opacity = btnValider.disabled ? "0.6" : "1";
  }

  // boutons joueurs : UN CLIC = +1 (si total < aDistribuer)
  joueurs.forEach((nom, idx)=>{
    const btn = document.createElement("button");
    btn.className = "bouton-pigeon plus4-joueur-btn";
    btn.dataset.idx = String(idx);
    btn.innerText = nom;

    surAction(btn, "plus4:joueur:" + idx, { owner: choisisseur }, ()=>{
      const total = totalDistribue();
      if(total >= aDistribuer) return;

      dist[idx] += 1;
      historique.push(idx);
      refreshUI();
      jouerSon("distribuer_gorgees");
    });

    container.appendChild(btn);
  });

  const btnUndo = document.createElement("button");
  btnUndo.className = "bouton-pigeon plus4-action-btn";
  btnUndo.innerText = "Retour";
  surAction(btnUndo, "plus4:annuler", { owner: choisisseur }, ()=>{
    if(historique.length === 0) return;
    const idx = historique.pop();
    if(dist[idx] > 0) dist[idx] -= 1;
    refreshUI();
  });

  const btnReset = document.createElement("button");
  btnReset.className = "bouton-pigeon plus4-action-btn";
  btnReset.innerText = "Annuler";
  surAction(btnReset, "plus4:reset", { owner: choisisseur }, ()=>{
    Object.keys(dist).forEach(k => dist[k] = 0);
    historique = [];
    refreshUI();
  });

  const btnValider = document.createElement("button");
  btnValider.className = "bouton-pigeon plus4-action-btn";
  btnValider.innerText = "Valider";
  surAction(btnValider, "plus4:valider", { owner: choisisseur, once: true }, ()=>{
    if(totalDistribue() !== aDistribuer) return;

    overlay.remove();
    unlockScroll();
    choixPigeonEnCours = false;
    afficherJoueurActif();

    const file = Object.entries(dist)
      .map(([k,v]) => ({ idx: Number(k), n: Number(v) }))
      .filter(x => x.n > 0);

    distribuerFilePlus4(file, classeCartePlus4);
  });
  // Ordre d'affichage : Valider, puis Retour, puis Annuler
  actions.append(btnValider, btnUndo, btnReset);

  document.body.appendChild(overlay);
  refreshUI();
}

function distribuerFilePlus4(file, classeCartePlus4){
  if(file.length === 0) return;

  const item = file.shift();
  demanderAnnulationPlus4(item.idx, item.n, classeCartePlus4, () => {
    distribuerFilePlus4(file, classeCartePlus4);
  });
}

function demanderAnnulationPlus4(joueurIndex, nbGorgees, classeCartePlus4, onFinish){
  const nom = joueurs[joueurIndex];
  const msg = `${nom} boit ${texteGorgees(nbGorgees)} (+4)`;

  montrerOverlayRegle(msg, classeCartePlus4);

  executerApresOverlayRegleUnique(() => {
    if(joueurPeutAnnuler(joueurIndex, nbGorgees)){
      afficherOverlayAnnulation(
        joueurIndex,
        nbGorgees,
        null,
        () => { if(typeof onFinish === "function") onFinish(); }
      );
    } else if(typeof onFinish === "function"){
      onFinish();
    }
  });
}

// #endregion

// #region Application des règles et déroulement du jeu
// ===== Annulations pour pénalités multi-joueurs (SOCIAL / ZERO) =====
function demanderAnnulationSimple(joueurIndex, nbGorgees, onFinish){
  if(!joueurPeutAnnuler(joueurIndex, nbGorgees)){
    if(typeof onFinish === "function") onFinish();
    return;
  }

  afficherOverlayAnnulation(
    joueurIndex,
    nbGorgees,
    null,
    () => { if(typeof onFinish === "function") onFinish(); }
  );
}

function demarrerAnnulationsMulti(victimes, classeCarte, messageEntete, onComplete = null){
  montrerOverlayRegle(messageEntete, classeCarte);

  const file = victimes.filter(idx => Number(annulations[joueurs[idx]] || 0) > 0);

  function next(){
    if(file.length === 0){
      if(typeof onComplete === "function") onComplete();
      return;
    }

    const idx = file.shift();
    demanderAnnulationSimple(idx, 1, next);
  }

  executerApresOverlayRegleUnique(next);
}

function couleurDeLaCarte(classeCarte){
  // Ex: "un_vert1" => "vert", "interdit_rouge" => "rouge"
  const m = classeCarte.match(/_(vert|jaune|rouge|bleu)/);
  return m ? m[1] : null;
}

// La carte « 1 » s'envole du plateau vers le nom du joueur qui la garde, puis son +1 pulse
function envolerCarteVersJoueur(carteElement, classeCarte, nom){
  const depart = carteElement.getBoundingClientRect();
  carteElement.classList.add("carte-disparue"); // le trou reste à sa place
  const sansAnimation = rattrapageEnCours || !carteElement.animate ||
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if(sansAnimation || depart.width === 0) return;

  // Le +1 du joueur dans la liste « Joueurs » (s'il est à l'écran), sinon vers le haut de l'écran
  const ligneJoueur = () => listeJoueurs.querySelectorAll(".joueur-ligne")[joueurs.indexOf(nom)];
  const cible = ligneJoueur();
  const zone = cible && (cible.querySelector(".bonus-annulation") || cible).getBoundingClientRect();
  const cibleVisible = zone && zone.width > 0 && zone.bottom > 0 && zone.top < window.innerHeight;
  const arriveeX = cibleVisible ? zone.left + zone.width / 2 : depart.left + depart.width / 2;
  const arriveeY = cibleVisible ? zone.top + zone.height / 2 : -depart.height;
  const dx = arriveeX - (depart.left + depart.width / 2);
  const dy = arriveeY - (depart.top + depart.height / 2);

  const vol = document.createElement("div");
  vol.className = "Carte retournee carte-envol " + classeCarte;
  Object.assign(vol.style, {
    left: depart.left + "px", top: depart.top + "px",
    width: depart.width + "px", height: depart.height + "px"
  });
  document.body.appendChild(vol);

  const animation = vol.animate([
    { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
    { transform: "translate(0, -10px) scale(1.15) rotate(-4deg)", opacity: 1, offset: 0.25 }, // on la « prend »
    { transform: `translate(${dx}px, ${dy}px) scale(0.22) rotate(8deg)`, opacity: 0.35, offset: 1 }
  ], { duration: 950, easing: "ease-in-out", fill: "forwards" });

  animation.onfinish = () => {
    vol.remove();
    const ligne = cibleVisible && ligneJoueur();
    const badge = ligne && ligne.querySelector(".bonus-annulation");
    if(badge){
      badge.classList.remove("bonus-pulse");
      void badge.offsetWidth; // relance l'animation
      badge.classList.add("bonus-pulse");
    }
  };
}

/* ===== Application des règles ===== */
function appliquerRegle(carteTiree, joueurActuel, carteElement){
  // Gorgée pour la couleur choisie : décidée maintenant (et la couleur effacée),
  // affichée plus tard par chaque règle, après son propre message
  const couleurBue = prendreCouleurSiBesoin(carteTiree);

  if(zeroEnCours || switchEnCours){
    regleZero.style.display="none";
    zeroEnCours=false;
    switchEnCours=false;
  }

  effacerMessagePigeon();


  if (carteTiree === "carte_doree") {
    regleZero.innerText = `CARTE DORÉE : distribue ${texteCulSec()}`;
    regleZero.style.display = "block";
    zeroEnCours = true;

    // Plateau bloqué (et pari de fin en attente) jusqu'au choix de la victime
    choixPigeonEnCours = true;
    const texteCarteDoree = estModeSoft()
      ? "Distribue 3 gorgées de la part du développeur 😘"
      : "Distribue un CUL SEC de la part du développeur, et obligation de se servir un vrai verre avant 😘";
    // Le texte complet sert à calculer la durée d'affichage de l'overlay
    montrerOverlayRegle(`CARTE DORÉE\n${texteCarteDoree}`, carteTiree);
    vibrer([150, 70, 150, 70, 300]);
    jouerSon("doree");
    habillerOverlayCarteDoree(texteCarteDoree);
    reglerDureeOverlayRegle(`CARTE DORÉE\n${texteCarteDoree}`, 1.65); // +65 % de temps de lecture
    executerApresOverlayRegleUnique(() => afficherOverlayCarteDoree(joueurActuel));
    return;
  }

  // Cas spécial: plus_4 => overlay de distribution + annulations chez les cibles
  if (carteTiree.startsWith("plus_4")) {
    afficherOverlayPlus4(joueurActuel, carteTiree);
    return;
  }

  // Cartes "boire"
  if(carteTiree.startsWith("interdit")){
    const entete = "SOCIAAALE ! \nTout le monde boit 1 gorgée";

    regleZero.innerText = entete;
    regleZero.style.display = "block";
    zeroEnCours = true;

    const victimes = joueurs.map((_, i) => i); // tout le monde
    demarrerAnnulationsMulti(victimes, carteTiree, entete, () => {
      appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
    });
    return;
  }

  // ZERO : tout le monde boit 1 sauf celui qui a tiré le 0
  if(carteTiree.startsWith("zero")){
    const entete = "Tout le monde boit 1 gorgée sauf toi";

    regleZero.innerText = entete;
    regleZero.style.display = "block";
    zeroEnCours = true;

    const victimes = joueurs.map((_, i) => i).filter(i => i !== joueurActuel);
    demarrerAnnulationsMulti(victimes, carteTiree, entete, () => {
      appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
    });
    return;
  }

  if (carteTiree.startsWith("plus_2")) {
    const n = gorgeesPlus2();
    annoncerBoireAvecAnnulation(
      joueurActuel,
      n,
      carteTiree,
      `${joueurs[joueurActuel]} boit ${texteGorgees(n)}`,
      () => {
        appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
      }
    );
    return; // important : on évite le traitement générique en dessous
  }

  // Cartes "un" => +1 annulation de gorgée
  if(carteTiree.startsWith("un")){
    const msg = "+1 annulation de gorgée !";
    montrerOverlayRegle(msg, carteTiree);
    // puis message persistant jusqu'au prochain tirage (géré par zeroEnCours)
    regleZero.innerText = msg;
    regleZero.style.display = "block";
    zeroEnCours = true;

    // +1 permanent à côté du nom du joueur
    const nom = joueurs[joueurActuel];
    annulations[nom] = Number(annulations[nom] || 0) + 1;
    afficherJoueurs();

    // Comme en vrai, le joueur garde la carte avec lui : une fois les overlays fermés, elle
    // s'envole vers son nom (là où s'affiche son +1) et laisse un trou sur le plateau.
    // (avant, elle disparaissait d'un coup : on croyait à un bug)
    if(carteElement && rattrapageEnCours){
      carteElement.classList.add("carte-disparue"); // reconnexion : pas d'animation pour les cartes déjà jouées
    } else if(carteElement){
      const generation = generationPartie;
      quandPlateauVisible(() => {
        if(generation !== generationPartie || !carteElement.isConnected) return;
        envolerCarteVersJoueur(carteElement, carteTiree, nom);
      });
    }

    // Couleur choisie : la gorgée s'affiche APRÈS « +1 annulation » (sinon elle l'effaçait)
    appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true, afterRuleOverlay: true });
  }


  // Cartes "switch"
  if(carteTiree.startsWith("switch")){
    sensHoraire = !sensHoraire;
    const msg = "Sens du jeu inversé";
    regleZero.innerText = msg;
    regleZero.style.display = "block";
    switchEnCours = true;
    montrerOverlayRegle("Le sens du jeu est inversé !", carteTiree);
    appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true, afterRuleOverlay: true });
  }

  // Cartes "trois/pigeon"
  if(carteTiree.startsWith("trois")){
    
    if(indexPigeon===null){
      indexPigeon=joueurActuel;
      nomPigeonOriginal=joueurs[joueurActuel];
      const nPigeon = gorgeesPigeon();
      const msgPigeon = `${joueurs[joueurActuel]} est le PIGEON !\nIl/elle boit ${texteGorgees(nPigeon)}.\nÀ chaque 3 tiré, le PIGEON boit 1 gorgée.\nPour s'en débarrasser : tirer un 3 et choisir le prochain PIGEON.`;
      annoncerBoireAvecAnnulation(
        joueurActuel,
        nPigeon,
        carteTiree,
        msgPigeon,
        () => {
          appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
        }
      );
      reglerDureeOverlayRegle(msgPigeon, DUREE_ANNONCE_PIGEON); // annonce du pigeon : affichée 2 fois plus longtemps
      jouerSon("pigeon");
    
    } else if(indexPigeon===joueurActuel){
      carteTroisPourTransfertPigeon = carteTiree;
      // La gorgée couleur éventuelle viendra après l'annonce du nouveau pigeon
      joueurTroisPourTransfertPigeon = joueurActuel;
      couleurTroisPourTransfertPigeon = couleurBue;
      afficherMenuPigeon();
    
    } else {
      // si quelqu'un d'autre tire un 3 : le pigeon boit 1 (annulable si compteur)
      const msg = `Le PIGEON (${joueurs[indexPigeon]}) boit 1 gorgée`;
      // message dans .messages (disparaît au prochain tirage grâce à effacerMessagePigeon() au début)
      // overlay + choix d'annulation si le pigeon a des "UN"
      annoncerBoireAvecAnnulation(indexPigeon, 1, carteTiree, msg, () => {
        appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
      });
    }
  }

  // Cartes "couleur"
  if(carteTiree.startsWith("couleur")){
    afficherOverlayCouleur(joueurActuel);
  }

  // Cartes "quatre" => duel
  if(carteTiree.startsWith("quatre")){
    lancerOverlayChoixDuel(joueurActuel, carteTiree);
  }

  // Duel de la couleur choisie : la gorgée couleur s'affiche avant le duel
  // (annulable via les "UN"). Les autres cartes l'affichent elles-mêmes après leur règle.
  if(couleurBue && carteTiree.startsWith("quatre")){
    const msgCouleur = `${joueurs[joueurActuel]} boit 1 gorgée pour la couleur (${couleurBue})`;
    annoncerBoireAvecAnnulation(joueurActuel, 1, carteTiree, msgCouleur);
  }
}

/* ===== JEU ===== */
function lancerPartie(){
  if(joueurs.length < 2){
    alert("Il faut au moins 2 joueurs");
    return;
  }

  plateau.innerHTML = "";
  prechargerImagesCartes(); // (déjà fait à l'ouverture, en principe)
  lancementPartieA = Date.now();
  majTitrePJ(); // « ALCUNO PJ » dans le bandeau
  garderEcranAllume(); // pas de mise en veille pendant la partie

  // Plateau principal = toutes les cartes SAUF 2/5/6/7/8/9 (paquet duel)
  const paquetPrincipal = classes.filter(c => !duelCartes.includes(c));
  paquet = [...paquetPrincipal];
  melangerPaquet(paquet);

  // Paquet duel (réutilisable à l'infini via resetPaquetDuelSiBesoin)
  paquetDuel = [...duelCartes];
  melangerPaquet(paquetDuel);

  // Tirée avec « aleatoire » : en ligne, tous les téléphones ont la même carte dorée au même endroit
  const avecCarteDoree = aleatoire() < CHANCE_CARTE_DOREE;
  // La carte dorée REMPLACE une carte normale (n'importe laquelle : la dernière du paquet mélangé),
  // pour garder 52 cases : sinon une carte se retrouvait seule sur la dernière rangée
  if(avecCarteDoree) paquet.pop();
  const nbCases = paquet.length + (avecCarteDoree ? 1 : 0);
  indexCaseDoree = avecCarteDoree ? Math.floor(aleatoire() * nbCases) : -1;
  carteDoreeEnJeu = avecCarteDoree;

  indexJoueur = 0;
  partieLancee = true;
  zeroEnCours = false;
  switchEnCours = false;
  sensHoraire = true;
  couleurChoisie = null;
  majAffichageCouleur();

  duelEnCours = false;
  duelMultiplicateur = 1;
  finUnOverlayAffiche = false;

  btnNouvellePartie.style.display = "inline-block";
  majBoutonsJoueurs();
  btnJouer.style.display = "none";

  regleZero.style.display = "none";
  effacerMessagePigeon();
  afficherJoueurActif();

  for(let i=0;i<nbCases;i++){
    const carte = document.createElement("div");
    carte.classList.add("Carte");
    const estCaseDoree = i === indexCaseDoree;
    if(estCaseDoree) carte.classList.add("dos_dore");

    surAction(carte, "carte:" + i, {
      evenement: "click",
      owner: () => joueurs[indexJoueur % joueurs.length],
      pret: () => !choixPigeonEnCours && !duelEnCours && !predictionEnCours && cartesRestantes() > 1,
      valide: () => !carte.classList.contains("retournee")
    }, ()=>{
      // Plateau bloqué pendant overlays pigeon/couleur/duel
      if(choixPigeonEnCours || duelEnCours) return;
      if(carte.classList.contains("retournee")) return;
      // La dernière carte cachée ne se retourne pas : elle est réservée au pari de fin
      if(cartesRestantes() <= 1) return;
      if(joueurs.length === 0) return;

      const carteTiree = estCaseDoree ? "carte_doree" : paquet.shift();
      if(!carteTiree) return;

      if(estCaseDoree){
        carteDoreeEnJeu = false;
        carte.classList.remove("dos_dore");
      }
      carte.classList.add(carteTiree, "retournee");
      if(!estCaseDoree) jouerSon("cartes");

      const joueurActuel = indexJoueur % joueurs.length;
      appliquerRegle(carteTiree, joueurActuel, carte);

      // Avant-dernière carte tirée (carte dorée comprise) => on lance le pari sur la dernière,
      // après les overlays éventuels. La dernière carte n'est jamais jouée : elle sert au pari.
      if(cartesRestantes() === 1 && !predictionEnCours){
        const startIdx = nextPlayerIndex(joueurActuel);
        const generation = generationPartie;
        executerApresOverlayRegleUnique(() => {
          // Si un duel/pigeon est en cours, on attend que ça finisse avant d'afficher.
          // (Minuteur et pas requestAnimationFrame : celui-ci s'arrête quand l'écran est éteint ou
          // l'appli en arrière-plan, et le pari ne s'affichait alors qu'au retour sur l'appli)
          const attendre = () => {
            if(generation !== generationPartie) return; // partie relancée entre-temps
            if(choixPigeonEnCours || duelEnCours){
              setTimeout(attendre, 100);
              return;
            }
            lancerOverlayPrediction(startIdx);
          };
          attendre();
        });
      }
      // fin du plateau : on affiche les "1 restants"
      if(cartesRestantes() === 0){
        executerApresOverlayRegleUnique(() => {
          finDePartie();
        });
      }

      indexJoueur = (indexJoueur + (sensHoraire ? 1 : -1) + joueurs.length) % joueurs.length;

      afficherJoueurActif();
      afficherJoueurs();
    });

    plateau.appendChild(carte);
  }
  
  centrerDerniereLigne();
}

function retourMenu(){
  partieLancee = false;
  majTitrePJ(); // le titre suit le réglage Mode PJ, partie ou pas
  finUnOverlayAffiche = false;

  // Écrans du retrait en cours de partie (nouvelle manche, départ, partie fermée...)
  retraitEnAttente = null;
  ecranConfirmerRetrait.style.display = "none";
  suppression.style.display = "none";


  // ✅ reset des annulations (compteurs "un") pour une nouvelle partie
  joueurs.forEach(nom => {
    annulations[nom] = 0;
  });

  paquet = [];
  paquetDuel = [];
  indexCaseDoree = -1;
  carteDoreeEnJeu = false;

  indexJoueur = 0;

  indexPigeon = null;
  nomPigeonOriginal = "";
  choixPigeonEnCours = false;

  zeroEnCours = false;
  switchEnCours = false;
  sensHoraire = true;

  couleurChoisie = null;
  majAffichageCouleur();

  duelEnCours = false;
  duelMultiplicateur = 1;

  plateau.innerHTML = "";

  regleZero.style.display = "none";
  effacerMessagePigeon();
  joueurActif.innerText = "";

  const overlayPigeon = document.getElementById("overlayPigeon");
  if(overlayPigeon) overlayPigeon.remove();

  const overlayCouleur = document.getElementById("overlayCouleur");
  if(overlayCouleur) overlayCouleur.remove();

  const overlayDuel = document.getElementById("overlayDuel");
  if(overlayDuel) overlayDuel.remove();

  btnNouvellePartie.style.display = "none";
  btnSupprimer.style.display = "inline-block";
  btnJouer.style.display = joueurs.length >= 2 ? "inline-block" : "none";
  menu.style.display = "flex";

  afficherJoueurs();
  // Sécurité : on réactive le scroll quoi qu'il arrive
  scrollLockCount = 0;
  document.body.classList.remove("no-scroll", "overlay-open");
  document.documentElement.classList.remove("overlay-ouvert");
  document.body.style.top = "";
}

btnJouer.addEventListener("pointerdown", lancerPartie);

// #endregion

// #region Écran « Nouvelle partie »
/* ===== ÉCRAN « NOUVELLE PARTIE » (classique et en ligne) ===== */
const ecranNouvellePartie = document.getElementById("ecranNouvellePartie");

function fermerEcranNouvellePartie(){
  ecranNouvellePartie.style.display = "none";
}

// "click" (et pas pointerdown) : évite que le relâchement du doigt active un bouton du nouvel écran
btnNouvellePartie.addEventListener("click", () => {
  // « Jouer » (au toucher) laisse sa place à « Nouvelle partie » sous le doigt : Android et PC
  // y envoient le clic du doigt relevé, qui ouvrirait cet écran juste après le lancement
  if(Date.now() - lancementPartieA < 700) return;
  ecranNouvellePartie.style.display = "";
});

document.getElementById("btnRetourNouvellePartie").addEventListener("click", fermerEcranNouvellePartie);

// Courte annonce après « Rejouer (avec les mêmes joueurs) » : disparaît toute seule (~1,5 s)
// ou au tap. Hors des overlays du jeu : ne bloque rien, même en ligne.
function annoncerNouvellePartie(){
  const ancienne = document.getElementById("annonceNouvellePartie");
  if(ancienne) ancienne.remove();

  const annonce = document.createElement("div");
  annonce.id = "annonceNouvellePartie";
  annonce.innerHTML =
    '<div class="annonce-titre">NOUVELLE PARTIE</div>' +
    '<div class="annonce-texte">avec les mêmes joueurs</div>';

  const retirer = () => annonce.remove();
  annonce.addEventListener("pointerdown", retirer);
  annonce.addEventListener("animationend", (e) => {
    if(e.animationName === "annonceApparaitDisparait") retirer();
  });
  setTimeout(retirer, 2000); // sécurité (ex. animations désactivées)

  document.body.appendChild(annonce);
}

document.getElementById("btnRejouerMemes").addEventListener("click", () => {
  fermerEcranNouvellePartie();
  if(enLigneActif){
    lancerMancheEnLigne(joueurs.slice(), false);
    return;
  }
  nettoyerOverlays();
  retourMenu();
  lancerPartie();
  annoncerNouvellePartie();
});

document.getElementById("btnModifierJoueurs").addEventListener("click", () => {
  fermerEcranNouvellePartie();
  if(enLigneActif){
    renvoyerEnSalleEnLigne();
    return;
  }
  nettoyerOverlays();
  retourMenu();
  ouvrirClavier(nomJoueurInput); // « Modifier les joueurs » : clavier prêt pour en ajouter
});

function allerAccueil(){
  setTimeout(afficherBandeauMiseAJour, 0); // nouvelle version repérée pendant la partie : proposée maintenant
  if(codePartieActuel) quitterPartie();
  reinitialiserEcransJeu();
  libererEcran();
  document.getElementById("enLigne").style.display = "none";
  document.getElementById("choixMode").style.display = "";
}

document.getElementById("btnAccueil").addEventListener("click", allerAccueil);
// ⌂ du bandeau (mode classique) : pendant une partie, on demande confirmation
const ecranConfirmerAccueil = document.getElementById("ecranConfirmerAccueil");
btnAccueilClassique.addEventListener("click", () => {
  if(!partieLancee){
    allerAccueil();
    return;
  }
  ecranConfirmerAccueil.style.display = "";
});
document.getElementById("btnConfirmerAccueilOui").addEventListener("click", () => {
  ecranConfirmerAccueil.style.display = "none";
  allerAccueil();
});
document.getElementById("btnConfirmerAccueilNon").addEventListener("click", () => {
  ecranConfirmerAccueil.style.display = "none";
});
// Écrans en ligne (Créer / Rejoindre / salle d'attente) : quitte la partie éventuelle
document.getElementById("btnAccueilEnLigne").addEventListener("click", allerAccueil);

// Remet l'interface de jeu à zéro et la masque (plateau, menu, overlays, liste de joueurs)
function reinitialiserEcransJeu(){
  nettoyerOverlays();
  retourMenu();
  joueurs = [];
  annulations = {};
  aleatoire = Math.random;
  afficherJoueurs();

  document.body.classList.remove("mode-en-ligne");
  fermerEcranNouvellePartie();
  menu.style.display = "none";
  messagesBar.style.display = "none";
  document.getElementById("jeu").style.display = "none";
}

// on force l'UI du menu (au cas où)
suppression.style.display = "none";

btnSupprimer.style.display = "inline-block";

// #endregion
