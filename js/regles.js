// =============================================================================================
// ALCUNO : Règles : overlays, duel, déroulement du jeu, écran « Nouvelle partie »
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Overlays des règles : pigeon, annonces, annulations, carte dorée
/* ===== PIGEON OVERLAY ===== */
let recapActuel = null; // (récap affiché, pour la télé)
function afficherOverlayFinUnRestants(){
  if(finUnOverlayAffiche) return;
  finUnOverlayAffiche = true;
  if(!rattrapageEnCours) oublierPartieClassique(); // partie finie : plus rien à reprendre

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

  // Récap de la partie (podium, carte dorée, titres) ; aussi envoyé à la télé (js/tele.js)
  overlay.classList.add("overlay-recap");
  overlay.style.overflowY = "auto";
  recapActuel = calculerRecap(restants);
  try { stickersFinDePartie(); } catch (e) {} // (album de stickers, js/stickers.js)
  try { noterFinStats(recapActuel); } catch (e) {} // (stats : partie finie, joueurs, durée ; js/stats.js)
  if(partieHard) try { debloquerZiziCoptere(); } catch (e) {} // (partie hard finie : zizi-coptère du thème Donjon, js/zizi-coptere.js)
  overlay.appendChild(construireRecap(recapActuel));

  const btnTerminer = document.createElement("button");
  btnTerminer.className = "bouton-pigeon";
  btnTerminer.innerText = tr("Terminer");

  surAction(btnTerminer, "fin:terminer", { once: true, unique: true }, () => {
    // ils boivent leurs "1 restants" => on remet les compteurs à 0
    restants.forEach(x => { annulations[x.nom] = 0; noterGorgees(x.nom, x.n); });
    afficherJoueurs();

    overlay.remove();
    unlockScroll();
    allerAccueil(); // partie terminée : retour à l'accueil (en ligne, tout le monde y retourne, l'action est partagée)
  });

  // « Revanche » : relance tout de suite une partie avec les mêmes joueurs (comme « Nouvelle partie >
  // Rejouer avec les mêmes joueurs ») ; en ligne, n'importe qui peut la lancer, pour tout le monde
  const btnRevanche = document.createElement("button");
  btnRevanche.className = "bouton-pigeon fin-revanche";
  btnRevanche.innerText = tr("Revanche (mêmes joueurs)");
  btnRevanche.addEventListener("click", () => {
    restants.forEach(x => { annulations[x.nom] = 0; noterGorgees(x.nom, x.n); });
    overlay.remove();
    unlockScroll();
    document.getElementById("btnRejouerMemes").click();
  }, { once: true });

  // « Je veux garder mon permis » : ouvre l'éthylotest par-dessus l'écran de fin, sur CE téléphone seulement (« Retour »
  // y ramène ; la partie n'est pas terminée pour autant, ni pour les autres en ligne)
  const btnEthylo = document.createElement("button");
  btnEthylo.className = "bouton-pigeon fin-ethylo";
  btnEthylo.innerText = tr("Je veux garder mon permis");
  btnEthylo.addEventListener("click", () => ouvrirEthylo());

  overlay.appendChild(btnRevanche);
  overlay.appendChild(btnTerminer);
  overlay.appendChild(btnEthylo);
  document.body.appendChild(overlay);
}

function afficherMenuPigeon(){
  if(document.getElementById("overlayPigeon")) return;

  // C'est le pigeon actuel (celui qui vient de tirer le 3) qui choisit
  const choisisseur = joueurs[indexPigeon];

  // (pas ceux en pause, sauf s'il ne restait personne d'autre)
  const pigeonsPossibles = joueurs.filter((j, i) => i !== indexPigeon && !estEnPause(j)).length;
  const candidats = joueurs.map((j, i) => i).filter(i => i !== indexPigeon && (!estEnPause(joueurs[i]) || pigeonsPossibles === 0));

  // Un seul joueur possible (2 joueurs, ou tous les autres en pause) : pas de choix à faire, le pigeon passe tout de suite
  // à cet autre joueur, avec seulement l'annonce « le nouveau PIGEON est… »
  if(candidats.length === 1){
    passerPigeonA(candidats[0], null, choisisseur, false);
    return;
  }

  choixPigeonEnCours=true;
  lockScroll();

  const overlay=document.createElement("div");
  overlay.id="overlayPigeon";
  ajouterCarteVedette(overlay, carteTroisPourTransfertPigeon);

  const titre=document.createElement("div");
  titre.className="titre-pigeon";
  titre.innerText=tr("Choisis le nouveau PIGEON");
  overlay.appendChild(titre);

  candidats.forEach(i => {
    const btn=document.createElement("button");
    btn.className="bouton-pigeon";
    btn.innerText=joueurs[i];
    surAction(btn, "pigeon:" + i, { owner: choisisseur, once: true }, ()=>{
      passerPigeonA(i, overlay, choisisseur, true);
    });
    overlay.appendChild(btn);
  });

  document.body.appendChild(overlay);
}

// Le joueur i devient le PIGEON (annonce, gorgée) ; overlay : l'écran de choix à fermer (null : il n'y en a pas eu)
function passerPigeonA(i, overlay, choisisseur, avecChoix){
  if(avecChoix) proposerAnnulerChoix(choisisseur); // « Mauvais joueur ? Annuler » quelques secondes
  indexPigeon = i;
  pigeonAClignoter = Date.now(); // (clignote à la fin de l'annonce, js/plateau.js)
  compterStat("pigeon", joueurs[i]);
  nomPigeonOriginal = joueurs[i];
  // 1) on ferme l'overlay de choix
  if(overlay){
    unlockScroll();
    overlay.remove();
  }
  choixPigeonEnCours = false;
  afficherJoueurs();
  afficherJoueurActif();
  // 2) message demandé (overlay + .messages)
  const nPigeon = gorgeesPigeon();
  const msg = tr`${joueurs[i]} est le nouveau PIGEON !\nIl/elle boit ${texteGorgees(nPigeon)} pour fêter ça.`;
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
// Annonces et boutons d'annulation : les taps juste après leur apparition sont ignorés (taps encore en cours de l'écran
// d'avant, ex. au duel Réflexe : l'annonce se fermait aussitôt, puis un « Annuler N » était choisi sans le vouloir)
const DELAI_TAP_ANNONCE = 700;
const DELAI_TAP_ANNULATION = 800;
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
    faireClignoterPigeon(); // (nouveau pigeon : sa ligne clignote)
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

// Bloc Règles après une annulation : le nombre de gorgées de ce joueur est mis à jour (avant : le premier
// chiffre restait affiché). « Léa boit 2 gorgées » => « Léa boit 1 gorgée (1 annulée) » ; sinon (tout le
// monde boit…) une ligne en plus. Vu aussi par la télé, qui lit ce bloc.
function majRegleApresAnnulation(nom, nbGorgees, utilise, reste){
  if(utilise <= 0 || regleZero.style.display === "none") return;
  const texte = regleZero.innerText.trim();
  if(!texte) return;
  const apres = tr`${texteGorgees(reste)} (${utilise} annulée${utilise > 1 ? "s" : ""})`;
  let nouveau = texte;
  // (les phrases sont refaites en entier dans la langue du jeu : « Léa boit 3 gorgées » / « Léa drinks 3 sips »)
  for(const sujet of [nom, avant2(nom)]){
    const avant = tr`${sujet} boit ${texteGorgees(nbGorgees)}`;
    if(nouveau.includes(avant)){ nouveau = nouveau.replace(avant, tr`${sujet} boit ${apres}`); break; }
  }
  if(nouveau === texte && texte.includes(tr("Il/elle boit ") + texteGorgees(nbGorgees))){
    nouveau = texte.replace(tr("Il/elle boit ") + texteGorgees(nbGorgees), tr("Il/elle boit ") + apres);
  }
  if(nouveau === texte) nouveau = tr`${texte}\n${nom} annule ${utilise} : boit ${texteGorgees(reste)}`;
  afficherRegleBloc(regleZero, nouveau);
}
function avant2(nom){ return tr`Le PIGEON (${nom})`; }

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

  // Le nombre de gorgées à boire d'abord (on le voyait juste avant, puis plus du tout ici)
  const titre = document.createElement("div");
  titre.innerText = tr`${nom}, tu bois ${texteGorgees(nbGorgees)}.`;
  titre.style.fontSize = "clamp(24px, 5vw, 46px)";
  titre.style.fontWeight = "900";
  titre.style.textShadow = "2px 2px 5px #000";
  overlay.appendChild(titre);

  const ligneAnnulations = document.createElement("div");
  ligneAnnulations.innerText = tr`Tu as ${dispo} annulation${dispo > 1 ? "s" : ""}.`;
  ligneAnnulations.style.fontSize = "clamp(20px, 4.4vw, 34px)";
  ligneAnnulations.style.fontWeight = "900";
  ligneAnnulations.style.textShadow = "2px 2px 5px #000";
  overlay.appendChild(ligneAnnulations);

  const sousTitre = document.createElement("div");
  sousTitre.innerText = tr("Combien de gorgées veux-tu annuler ?");
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
    btn.innerText = tr`Annuler ${i}`;
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
      proposerAnnulerChoix(nom, positionActionCourante(), tr("Mauvais bouton ?")); // (retour au choix « Annuler 0, 1, 2… »)
      const utilise = i;
      const reste = nbGorgees - utilise;
      jouerSon(utilise > 0 ? "annuler_gorgees" : "annuler_0_gorgees");
      const messageResultat = utilise > 0
        ? tr`${texteGorgees(utilise)} annulée${utilise > 1 ? "s" : ""}. \nTu bois ${texteGorgees(reste)}.`
        : tr`Tu n’annules rien. \nTu bois ${texteGorgees(reste)}.`;

      annulations[nom] = Math.max(0, dispo - utilise);
      noterGorgees(nom, reste);
      compterStat("annulees", nom, utilise);
      majRegleApresAnnulation(nom, nbGorgees, utilise, reste);
      afficherJoueurs();
      afficherJoueurActif();

      if(typeof onDone === "function") onDone(utilise, reste);

      fermer(() => {
        afficherOverlayResultatAnnulation(messageResultat, afterClose);
      });
    });

    boutons.appendChild(btn);
  }

  // Boutons « Annuler N » inactifs un court instant (voir DELAI_TAP_ANNULATION ; en ligne, une action reçue entre-temps attend)
  boutons.style.pointerEvents = "none";
  setTimeout(() => { boutons.style.pointerEvents = ""; }, delai(DELAI_TAP_ANNULATION));
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
  const msg = prefixMsg ? prefixMsg : tr`${nom} boit ${texteGorgees(nbGorgees)}`;
  // Un bot ne boit pas : gorgées perdues, ou refilées à un vrai joueur (js/bots.js)
  if(typeof gorgeesDuBot === "function" && gorgeesDuBot(joueurIndex, nbGorgees, classeCarte, msg, onFinish,
    (h, texte) => annoncerBoireAvecAnnulation(h, nbGorgees, classeCarte, texte, onFinish))) return;

  if (nbGorgees > 15) {
    // (bloc Règles rempli aussi : avant, il restait vide pour ces grosses gorgées)
    afficherRegleBloc(regleZero, msg);
    regleZero.style.display = "block";
    zeroEnCours = true;
    // Easter egg : message signé Célien, mise en forme premium
    const citationCelien = tr("Et interdit de vomir, c'est pas fini !");
    const signatureCelien = tr("Signé Célien, un des créateurs du jeu");
    const message17 = `${citationCelien}\n${signatureCelien}`;

    montrerOverlayRegle(`${msg}\n\n${message17}`, classeCarte);
    habillerOverlayCelien(msg, citationCelien, signatureCelien);
    const defiHotCelien = montrerDefiHot(joueurIndex, nbGorgees); // (mode hot : bloc défi sous la carte, js/mode-hot.js)

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
        } else {
          finirBoireHot(defiHotCelien, joueurIndex, nbGorgees, onFinish);
        }
      };
      executerApresOverlayRegleUnique(ensuite);
    return;
  }

  afficherRegleBloc(regleZero, msg);
  regleZero.style.display = "block";
  zeroEnCours = true;

  montrerOverlayRegle(msg, classeCarte);
  const defiHot = montrerDefiHot(joueurIndex, nbGorgees); // (mode hot : bloc défi sous la carte, js/mode-hot.js)

  const ensuite = () => {
    if(joueurPeutAnnuler(joueurIndex, nbGorgees)){
      afficherOverlayAnnulation(
        joueurIndex,
        nbGorgees,
        null,
        () => { if(typeof onFinish === "function") onFinish(); }
      );
    } else {
      finirBoireHot(defiHot, joueurIndex, nbGorgees, onFinish);
    }
  };

  executerApresOverlayRegleUnique(ensuite);
}



// Texte des overlays de règle : la 1re ligne en titre, les suivantes en détails plus petits
// (avant, tout s'affichait d'un bloc dans la même grosse taille : illisible dès 3-4 lignes)
function remplirTexteRegle(boxTexte, message){
  boxTexte.innerHTML = "";
  const lignes = String(message || "").split("\n").map(l => l.trim()).filter(Boolean);
  // Annonce du premier pigeon : l'essentiel (qui boit, combien) en gros, la règle en petit dessous
  // (avant : 4 lignes de même taille, pénible à lire en soirée)
  const estNote = (l) => /^(À chaque 3|Pour s'en débarrasser)/.test(l);
  const avecNotes = lignes.some(estNote);
  lignes.forEach((texte, i) => {
    const el = document.createElement("div");
    el.className = i === 0 ? "regle-titre" : "regle-detail";
    if (estNote(texte)) el.classList.add("regle-note");
    else if (avecNotes && i > 0) el.classList.add("regle-boit");
    // Espace insécable devant « : ; ! ? » et après « (typographie française) : sinon le « : » de « Pour s'en
    // débarrasser : tirer un 3 » pouvait partir seul à la ligne
    el.innerText = texte.replace(/ ([:;!?»])/g, "\u00A0$1").replace(/« /g, "«\u00A0");
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
    overlay._affichee = performance.now();
    // Overlay réutilisé : on retire l'habillage doré d'un message carte dorée précédent
    overlay.classList.remove("overlay-doree");
    overlay.querySelectorAll(".etincelles-doree").forEach(z => z.remove());
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
  overlay._affichee = performance.now();
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
    // (pas dans les 0,7 s après son apparition : un tap encore en cours, ex. au duel Réflexe, la fermait aussitôt)
    if (performance.now() - (overlay._affichee || 0) < DELAI_TAP_ANNONCE) return;
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
  titre.innerText = tr("Choisis une couleur");
  overlay.appendChild(titre);

  // Ce que fait la couleur, dit tout de suite (avant, on ne le comprenait qu'au moment de boire)
  const explication = document.createElement("div");
  explication.className = "explication-couleur";
  explication.innerHTML = tr("Le prochain qui tire une carte de cette couleur boit <b>1 gorgée en plus</b>");
  overlay.appendChild(explication);

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
    // (mode daltonien : le nom de la couleur dans le carré, style_alcuno.css)
    const nomCarre = document.createElement("span");
    nomCarre.className = "carre-couleur-nom";
    nomCarre.textContent = tr(c.nom).toUpperCase();
    carre.appendChild(nomCarre);
    carre.setAttribute("aria-label", tr(c.nom));
    surAction(carre, "couleur:" + c.nom, { owner: choisisseur, once: true }, ()=>{
      sonClicTheme(); // (sabre, son BDSM, saxophone : js/reglages.js)
      couleurChoisie = c.nom;
      majAffichageCouleur();
      noterHistorique(tr`Choisit le ${tr(c.nom)}`);
      unlockScroll();
      overlay.remove();
      choixPigeonEnCours = false;
      afficherJoueurActif();
      // Annonce pour toute la table (pas seulement celui qui a choisi)
      montrerOverlayRegle(tr`Couleur ${tr(c.nom).toUpperCase()}\nLe prochain qui tire une carte ${tr(ADJECTIFS_COULEUR[c.nom])} boit 1 gorgée en plus`, "couleur");
    });
    container.appendChild(carre);
  });

  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

/* ===== CARTE DORÉE : habillage premium de l'overlay de règle =====
   Fond doré + grand titre (par défaut « ✦ CARTE DORÉE ✦ ») + texte en dessous (facultatif) */
const TITRE_CARTE_DOREE = tr('<span class="doree-etincelle">✦</span> CARTE DORÉE <span class="doree-etincelle">✦</span>');

// Change la durée d'affichage de l'overlay de règle qui vient d'être montré.
// facteur = null : il reste affiché jusqu'à ce qu'on tape dessus.
// Annonce d'un pigeon (premier pigeon ou nouveau pigeon choisi) : 2 fois le temps de lecture normal
const DUREE_ANNONCE_PIGEON = 2;
// Première annonce du pigeon (elle explique la règle) : 1,2 fois (avant : 2 fois, jusqu'à 8,6 s à lire, trop long)
const DUREE_PREMIER_PIGEON = 1.2;

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

// Petites étincelles qui scintillent en continu derrière la carte dorée (annonce et choix de la victime).
// Positions et rythmes tirés au hasard (Math.random : purement visuel, pas le hasard du jeu) ; couleurs selon le thème (CSS).
function ajouterEtincellesDoree(overlay){
  if(!overlay || overlay.querySelector(".etincelles-doree")) return;
  const zone = document.createElement("div");
  zone.className = "etincelles-doree";
  zone.setAttribute("aria-hidden", "true");
  for(let i = 0; i < 36; i++){
    const e = document.createElement("span");
    const point = Math.random() < 0.35;
    const taille = point ? 3 + Math.random() * 3 : 7 + Math.random() * 10;
    e.className = `etincelle e${i % 4}${point ? " etincelle-point" : ""}`;
    e.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(6 + Math.random() * 88).toFixed(1)}%;width:${taille.toFixed(1)}px;height:${taille.toFixed(1)}px;` +
      `--duree:${(2.2 + Math.random() * 2.6).toFixed(2)}s;--delai:${(-Math.random() * 5).toFixed(2)}s`;
    zone.appendChild(e);
  }
  overlay.insertBefore(zone, overlay.firstChild);
}

function habillerOverlayCarteDoree(texte, titreHtml = TITRE_CARTE_DOREE){
  const overlay = document.getElementById("overlayRegleUnique");
  const boxTexte = overlay && overlay.querySelector(".overlay-regle-texte");
  if(!boxTexte) return;

  overlay.classList.add("overlay-doree");
  ajouterEtincellesDoree(overlay);
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
  ajouterEtincellesDoree(overlay);

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
  consigne.innerText = estModeSoft() ? tr("Choisis à qui tu distribues tes 3 gorgées") : tr("Choisis à qui tu distribues ton CUL SEC");
  overlay.appendChild(consigne);

  const liste = document.createElement("div");
  liste.className = "doree-boutons";
  overlay.appendChild(liste);

  // Tout le monde, y compris celui qui a tiré la carte
  const nbChoixDoree = joueurs.filter(nom => !estEnPause(nom)).length; // (un seul : pas de « Mauvais joueur ? »)
  joueurs.forEach((nom, i) => {
    if(estEnPause(nom)) return; // (en pause : pas là pour le cul sec)
    const btn = document.createElement("button");
    btn.className = "bouton-doree";
    btn.innerText = avecCouronne(nom);
    surAction(btn, "doree:" + i, { owner: choisisseur, once: true }, () => {
      if(nbChoixDoree > 1) proposerAnnulerChoix(choisisseur); // « Mauvais joueur ? Annuler » quelques secondes
      overlay.remove();
      unlockScroll();
      if(statsPartie) statsPartie.doree = { tireur: choisisseur, victime: nom };
      compterCouple(choisisseur, nom, GORGEES_CUL_SEC); // (récap, mode hot : « Couple de la soirée »)
      try { stickerInstantane("doree"); } catch (e) {} // (album de stickers, js/stickers.js)
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
  noterGorgees(victime, estModeSoft() ? 3 : GORGEES_CUL_SEC);
  if(enLigneActif && victime !== pseudoActuel){
    const message = estModeSoft()
      ? tr`${victime} boit les 3 gorgées de la carte dorée !`
      : tr`${victime} prend le CUL SEC de la carte dorée !`;
    montrerOverlayRegle(message, "carte_doree");
    habillerOverlayCarteDoree(message);
    reglerDureeOverlayRegle(message, null); // reste jusqu'au tap
    return;
  }

  vibrer([400, 100, 400]); // c'est lui (ou, en classique, le téléphone de la table) qui prend
  jouerSon("tiens_gueule");


  // En classique, un seul téléphone pour tous : on précise qui prend le cul sec
  const titre = enLigneActif
    ? tr("TIENS DANS<br>TA GUEULE.")
    : tr`TIENS DANS<br>TA GUEULE<br>${echapperHtml(avecCouronne(victime))}.`;
  montrerOverlayRegle(tr("TIENS DANS TA GUEULE."), "carte_doree");
  habillerOverlayCarteDoree(estModeSoft() ? tr("3 gorgées !") : "", titre);
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
  titre.innerText = tr("DUEL ! Choisis 2 joueurs");
  content.appendChild(titre);

  const containerBoutons = document.createElement("div");
  containerBoutons.className = "duel-boutons";
  content.appendChild(containerBoutons);

  let shifumi = ""; // "" : duel classique ; sinon la façon de jouer le Shifumi (voir plus bas)
  const nbDuellistes = joueurs.filter(nom => !estEnPause(nom)).length; // (2 seulement : le choix est forcé, pas de « Mauvais joueur ? »)

  // Celui qui a tiré le 4 choisit d'abord le duel : classique (les 2 cartes), Shifumi (pierre, feuille, ciseaux) ou
  // Réflexe (le premier qui tape quand « TAPE ! » s'affiche). En ligne, le Shifumi se joue en secret sur le téléphone de
  // chacun des 2 joueurs ; en classique (un seul téléphone), avec des cartes : chacun choisit à son tour, une carte de dos
  // apparaît, puis les deux se retournent. Réflexe : voir afficherOverlayReflexe.
  if(shifumiPossible()){
    // « DUEL ! » sous la carte, puis la question en plus petit
    titre.innerText = tr("DUEL !");
    const question = document.createElement("div");
    question.className = "duel-label duel-question";
    question.innerText = tr("Classique, Shifumi ou Réflexe ?");
    content.insertBefore(question, containerBoutons);
    const types = [["classique", tr("⚔️ Classique")], [enLigneActif ? "telephones" : "cartes", tr("✊ Shifumi")], ["reflexe", tr("⚡ Réflexe")]];
    types.forEach(([type, texte]) => {
      const btn = document.createElement("button");
      btn.className = "bouton-pigeon";
      btn.innerText = texte;
      surAction(btn, "duel:type:" + type, { owner: choisisseur, once: true }, () => {
        shifumi = type === "classique" ? "" : type;
        containerBoutons.style.pointerEvents = "none";
        setTimeout(() => {
          if(!overlay.isConnected) return;
          containerBoutons.innerHTML = "";
          containerBoutons.style.pointerEvents = "";
          question.remove();
          titre.innerText = shifumi === "reflexe" ? tr("RÉFLEXE ! Choisis 2 joueurs")
            : shifumi ? tr("SHIFUMI ! Choisis 2 joueurs") : tr("DUEL ! Choisis 2 joueurs");
          choisirLesJoueurs();
        }, delai(200));
      });
      containerBoutons.appendChild(btn);
    });
    document.body.appendChild(overlay);
    return;
  }
  document.body.appendChild(overlay);
  choisirLesJoueurs();

  function choisirLesJoueurs(){
    let picks = [];
    let debutChoix = -1; // action du 1er joueur choisi (« Annuler » retire les 2 choix)

    joueurs.forEach((nom, idx)=>{
      if(estEnPause(nom)) return; // (en pause : pas de duel)
      const btn = document.createElement("button");
      btn.className = "bouton-pigeon";
      btn.innerText = nom;

      surAction(btn, "duel:choix:" + idx, { owner: choisisseur, once: true }, ()=>{
        if(picks.length >= 2) return;
        if(picks.includes(idx)) return;

        if(picks.length === 0) debutChoix = positionActionCourante();
        picks.push(idx);
        btn.disabled = true; // (aspect « déjà choisi » : style_alcuno.css, #overlayDuel .duel-boutons button:disabled)
        btn.style.cursor = "not-allowed";

        if(picks.length === 2){
          if(aleatoire() < 0.5) picks.reverse(); // qui commence : au hasard (avant : le 1er joueur touché)
          // Les autres joueurs ne réagissent plus (même aspect) : un 3e tap rapide n'envoie plus d'action
          containerBoutons.style.pointerEvents = "none";
          if(nbDuellistes > 2) proposerAnnulerChoix(choisisseur, debutChoix); // « Mauvais joueur ? Annuler » quelques secondes
          // Le tirage remplace l'écran 0,2 s plus tard : on voit le « pop » du 2e bouton (script.js).
          // En ligne, la carte choisie ensuite attend que le tirage soit affiché (tenterAction).
          setTimeout(() => {
            if(!overlay.isConnected) return; // (partie relancée / overlay fermé entre-temps)
            lancerLeDuel(picks[0], picks[1]);
          }, delai(200));
        }
      });

      containerBoutons.appendChild(btn);
    });

    // Seulement 2 joueurs en jeu : le choix est forcé, on passe directement au tirage (sans demander quoi que ce soit)
    if(nbDuellistes === 2){
      const duellistes = joueurs.map((nom, idx) => idx).filter(idx => !estEnPause(joueurs[idx]));
      if(aleatoire() < 0.5) duellistes.reverse(); // qui commence : au hasard
      lancerLeDuel(duellistes[0], duellistes[1]);
    }
  }

  function lancerLeDuel(j1, j2){
    overlay.innerHTML = "";
    if(shifumi === "reflexe") afficherOverlayReflexe(overlay, j1, j2);
    else if(shifumi === "cartes") afficherOverlayShifumiCartes(overlay, j1, j2);
    else if(shifumi) afficherOverlayShifumi(overlay, j1, j2);
    else afficherOverlayTirageDuel(overlay, j1, j2, carteDuel);
  }
}

// Shifumi au duel : en ligne et en classique (pas sur l'écran d'un spectateur, qui ne choisit rien de toute façon)
function shifumiPossible(){
  return true;
}

// Thème Givre, duel : le givre de la carte du perdant (son ::before, voir style_alcuno.css) éclate en morceaux qui
// tombent chacun de son côté en tournant, pendant que la carte gigote. Les morceaux sont des copies du même dessin de
// givre, découpées (clip-path) dans une grille aux coins décalés au hasard ; le givre de la carte, lui, s'efface aussitôt.
function briserGivre(carte){
  if(document.documentElement.dataset.theme !== "givre" || !carte || !carte.animate) return;
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // (simple fondu en CSS)
  const avant = getComputedStyle(carte, "::before");
  if(!avant.backgroundImage || avant.backgroundImage === "none" || avant.content === "none") return;
  const r = carte.getBoundingClientRect();
  if(!r.width) return;
  // Boîte du givre : celle du ::before (inset: -5.13% -8%)
  const boite = { x: r.left - r.width * 0.08, y: r.top - r.height * 0.0513, l: r.width * 1.16, h: r.height * 1.1026 };
  const COLS = 4, LIGNES = 5;
  const coin = [];
  for(let i = 0; i <= LIGNES; i++){
    coin.push([]);
    for(let j = 0; j <= COLS; j++){
      const bord = i === 0 || j === 0 || i === LIGNES || j === COLS;
      coin[i].push([j / COLS * 100 + (bord ? 0 : (Math.random() - 0.5) * 14), i / LIGNES * 100 + (bord ? 0 : (Math.random() - 0.5) * 12)]);
    }
  }
  const fragment = document.createDocumentFragment();
  for(let i = 0; i < LIGNES; i++){
    for(let j = 0; j < COLS; j++){
      // Le centre de la carte n'a presque pas de givre : ces morceaux-là seraient vides
      if(i > 0 && i < LIGNES - 1 && j > 0 && j < COLS - 1 && Math.random() < 0.7) continue;
      // (le morceau dans un cadre : le liseré glacé du cadre suit le bord découpé du morceau)
      const m = document.createElement("div");
      m.className = "givre-morceau";
      Object.assign(m.style, { left: boite.x + "px", top: boite.y + "px", width: boite.l + "px", height: boite.h + "px" });
      const glace = document.createElement("div");
      m.appendChild(glace);
      const pts = [coin[i][j], coin[i][j + 1], coin[i + 1][j + 1], coin[i + 1][j]];
      Object.assign(glace.style, {
        position: "absolute", inset: "0", background: "center / 100% 100% no-repeat",
        backgroundImage: avant.backgroundImage,
        transform: avant.transform === "none" ? "" : avant.transform, // (miroir / demi-tour du dessin)
        clipPath: "polygon(" + pts.map(([x, y]) => x.toFixed(1) + "% " + y.toFixed(1) + "%").join(", ") + ")"
      });
      // Il part du côté où il est (gauche à gauche, droite à droite), tombe en accélérant et tourne
      const cote = (j + 0.5) / COLS - 0.5;
      const dx = cote * 120 + (Math.random() - 0.5) * 50;
      const dy = 160 + Math.random() * 180 + i * 12;
      const tour = (Math.random() - 0.5) * 140;
      const duree = 750 + Math.random() * 450;
      m.animate([
        { translate: "0 0", rotate: "0deg", opacity: 1 },
        { translate: (dx * 0.15).toFixed(1) + "px -6px", rotate: (tour * 0.1).toFixed(1) + "deg", opacity: 1, offset: 0.15 },
        { translate: dx.toFixed(1) + "px " + dy.toFixed(1) + "px", rotate: tour.toFixed(1) + "deg", opacity: 0 }
      ], { duration: duree, delay: Math.random() * 140, easing: "cubic-bezier(0.45, 0, 0.85, 0.5)", fill: "both" })
        .finished.then(() => m.remove(), () => m.remove());
      fragment.appendChild(m);
    }
  }
  // (sur la télé, tout ce qui n'est pas son écran est caché : les morceaux y vont)
  (carte.closest("#ecranTele") || document.body).appendChild(fragment);
  carte.classList.add("givre-brise");
}

// Fin d'un duel (classique ou Shifumi) : on enlève l'écran du duel après le temps de lire le résultat (attente, en ms),
// ou dès qu'on tape sur l'écran, puis « X boit N gorgées » (avec ses « UN » pour annuler)
function terminerDuel(overlay, perdant, gorg, cartePerdant, msg, generation, attente){
  let suiteFaite = false;
  const suite = () => {
    if(suiteFaite || generation !== generationPartie) return;
    suiteFaite = true;
    overlay.removeEventListener("pointerdown", suite);

    // L'annonce « X boit N gorgées » apparaît en fondu PAR-DESSUS le duel, et le duel n'est
    // retiré dessous qu'une fois l'annonce affichée (avant : le plateau apparaissait entre les deux)
    // (avec la carte du perdant, celle qui fixe ses gorgées, plutôt que le 4 qui a lancé le duel)
    annoncerBoireAvecAnnulation(perdant, gorg, cartePerdant, msg);
    // gorgée pour la couleur de celui qui a tiré le 4 (annoncée avant le duel) : gardée en dernière ligne des Règles
    if(couleurDuelEnAttente){ ajouterLigneCouleurRegles(couleurDuelEnAttente); couleurDuelEnAttente = null; }
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
  setTimeout(suite, delai(attente));
  // (au tour suivant seulement : sinon le tap qui vient de décider du duel, encore en train de remonter jusqu'à l'écran
  // du duel, le sautait aussitôt ; au Réflexe classique, le résultat ne s'affichait pas du tout)
  setTimeout(() => { if(!suiteFaite) overlay.addEventListener("pointerdown", suite); }, 0);
}

// ===== DUEL SHIFUMI (en ligne) =====
// Une carte du paquet des duels est tirée et montrée en grand : ses gorgées sont l'enjeu. Les 2 joueurs choisissent pierre,
// feuille ou ciseaux sur LEUR téléphone (les autres, la télé et les spectateurs ne voient que « {nom} fait son choix ») ;
// une fois les 2 choix faits : suspense, puis les deux choix et le résultat. Le perdant boit les gorgées de la carte ;
// égalité : gorgées ×2, et on rejoue (même carte), comme au duel classique.
// Chaque choix est une action en ligne (« shifumi:<manche>:<joueur>:<choix> ») jouée sur tous les téléphones dans le même
// ordre : tout le monde arrive au même résultat ; les boutons des autres existent partout, mais cachés.
const CHOIX_SHIFUMI = ["pierre", "feuille", "ciseaux"];
const IMAGE_SHIFUMI = { pierre: "✊", feuille: "✋", ciseaux: "✌️" };
const BAT_SHIFUMI = { pierre: "ciseaux", feuille: "pierre", ciseaux: "feuille" };
function nomChoixShifumi(c){ return c === "pierre" ? tr("Pierre") : c === "feuille" ? tr("Feuille") : tr("Ciseaux"); }

function afficherOverlayShifumi(overlay, j1, j2){
  const generation = generationPartie;
  overlay.classList.add("duel-shifumi");
  resetPaquetDuelSiBesoin();
  const carteEnJeu = paquetDuel.shift(); // (même paquet, même ordre sur tous les téléphones)
  const moi = (idx) => enLigneActif && !estSpectateur && joueurs[idx] === pseudoActuel;
  const jeJoue = moi(j1) || moi(j2);
  const adversaire = (idx) => idx === j1 ? j2 : j1;

  const content = document.createElement("div");
  content.className = "duel-content shifumi-content";
  overlay.appendChild(content);
  ajouterCarteVedette(content, carteEnJeu, "shifumi-carte");

  const titre = document.createElement("div");
  titre.className = "titre-pigeon duel-main-title";
  titre.innerText = tr("SHIFUMI");
  content.appendChild(titre);

  const vs = document.createElement("div");
  vs.className = "duel-vs";
  const nomVs = (idx) => { const n = document.createElement("span"); n.className = "duel-vs-nom"; n.textContent = joueurs[idx]; return n; };
  const motVs = document.createElement("b");
  motVs.className = "duel-vs-mot";
  motVs.textContent = "VS";
  vs.append(nomVs(j1), " ", motVs, " ", nomVs(j2));
  content.appendChild(vs);

  const info = document.createElement("div");
  info.className = "duel-info shifumi-info";
  content.appendChild(info);

  // « {nom} fait son choix » / « {nom} a choisi ✓ », pour les 2 joueurs
  const statuts = document.createElement("div");
  statuts.className = "shifumi-statuts";
  content.appendChild(statuts);
  const statut = {};
  [j1, j2].forEach((idx) => { statut[idx] = document.createElement("div"); statut[idx].className = "duel-label shifumi-statut"; statuts.appendChild(statut[idx]); });

  // Les 3 choix de chaque joueur : visibles seulement sur son téléphone. data-tele="" : jamais lus par la télé
  const zoneChoix = document.createElement("div");
  zoneChoix.className = "shifumi-zone";
  zoneChoix.dataset.tele = "";
  content.appendChild(zoneChoix);
  const monChoix = document.createElement("div");
  monChoix.className = "duel-label shifumi-mon-choix";
  monChoix.dataset.tele = "";
  content.appendChild(monChoix);

  // Révélation : le choix de chacun, côte à côte
  const reveal = document.createElement("div");
  reveal.className = "shifumi-reveal";
  content.appendChild(reveal);

  const resultat = document.createElement("div");
  resultat.className = "duel-info shifumi-resultat";
  content.appendChild(resultat);

  let manche = 0;
  let choix = {};

  function majStatuts(){
    [j1, j2].forEach((idx) => {
      const fait = !!choix[idx];
      statut[idx].classList.toggle("fait", fait);
      statut[idx].innerText = fait ? tr`${joueurs[idx]} a choisi ✓` : tr`${joueurs[idx]} fait son choix…`;
    });
  }

  function nouvelleManche(){
    manche++;
    choix = {};
    overlay.classList.remove("shifumi-revele");
    reveal.innerHTML = "";
    resultat.innerText = "";
    monChoix.innerText = "";
    zoneChoix.innerHTML = "";
    statuts.style.display = "";
    info.innerText = jeJoue ? tr("Fais ton choix !") : tr("Duel Shifumi en cours...");
    info.dataset.tele = tr("Duel Shifumi en cours..."); // (télé : même texte, que ce téléphone soit dans le duel ou pas)
    [j1, j2].forEach((idx) => {
      const rangee = document.createElement("div");
      rangee.className = "shifumi-options";
      if(!moi(idx)) rangee.hidden = true; // (boutons de l'autre joueur : là pour rejouer son action, mais cachés)
      CHOIX_SHIFUMI.forEach((c) => {
        const option = document.createElement("div");
        option.className = "shifumi-option";
        option.setAttribute("role", "button");
        option.innerHTML = `<span class="shifumi-image">${IMAGE_SHIFUMI[c]}</span><span class="shifumi-nom">${echapperHtml(nomChoixShifumi(c))}</span>`;
        surAction(option, `shifumi:${manche}:${idx}:${c}`, { owner: joueurs[idx], once: true, valide: () => !choix[idx] },
          () => choisir(idx, c, rangee));
        rangee.appendChild(option);
      });
      zoneChoix.appendChild(rangee);
    });
    majStatuts();
  }

  function choisir(idx, c, rangee){
    if(choix[idx] || generation !== generationPartie) return;
    choix[idx] = c;
    rangee.querySelectorAll(".shifumi-option").forEach((o) => { o.dataset.netUtilise = "1"; });
    if(moi(idx)){
      sonClicTheme();
      rangee.hidden = true;
      monChoix.innerText = tr`Tu as choisi : ${IMAGE_SHIFUMI[c]} ${nomChoixShifumi(c)}`;
      info.innerText = tr`En attente de ${joueurs[adversaire(idx)]}…`;
    }
    majStatuts();
    if(choix[j1] && choix[j2]) suspense();
  }

  // Les 2 ont choisi : « Pierre… Feuille… Ciseaux… », puis les deux choix et le résultat
  function suspense(){
    zoneChoix.innerHTML = "";
    monChoix.innerText = "";
    delete info.dataset.tele;
    const etapes = [tr("Pierre…"), tr("Feuille…"), tr("Ciseaux…")];
    etapes.forEach((t, i) => setTimeout(() => {
      if(generation !== generationPartie || !overlay.isConnected) return;
      info.innerText = t;
    }, delai(i * 550)));
    info.innerText = etapes[0];
    setTimeout(() => {
      if(generation !== generationPartie || !overlay.isConnected) return;
      reveler();
    }, delai(etapes.length * 550 + 150));
  }

  function reveler(){
    const c1 = choix[j1], c2 = choix[j2];
    statuts.style.display = "none";
    info.innerText = tr("SHIFUMI !");
    reveal.innerHTML = "";
    [[j1, c1], [j2, c2]].forEach(([idx, c]) => {
      const bloc = document.createElement("div");
      bloc.className = "shifumi-revele-joueur";
      bloc.innerHTML = `<span class="duel-label shifumi-revele-nom">${echapperHtml(joueurs[idx])}</span>` +
        `<span class="shifumi-image">${IMAGE_SHIFUMI[c]}</span><span class="duel-label shifumi-nom">${echapperHtml(nomChoixShifumi(c))}</span>`;
      reveal.appendChild(bloc);
    });
    overlay.classList.add("shifumi-revele");
    jouerSon("cartes");

    if(c1 === c2){
      duelMultiplicateur *= 2;
      titre.innerText = tr("SHIFUMI ×") + duelMultiplicateur;
      resultat.innerText = tr("Égalité ! Les gorgées sont multipliées : ×") + duelMultiplicateur;
      setTimeout(() => {
        if(generation !== generationPartie || !overlay.isConnected) return;
        nouvelleManche();
      }, delai(2200));
      return;
    }

    const gagnant = BAT_SHIFUMI[c1] === c2 ? j1 : j2;
    const perdant = adversaire(gagnant);
    reveal.children[gagnant === j1 ? 0 : 1].classList.add("shifumi-gagnant");
    reveal.children[perdant === j1 ? 0 : 1].classList.add("shifumi-perdant");
    compterStat("duels", joueurs[gagnant]); // (récap de fin : duels gagnés)
    // Les joueurs du duel lisent « tu as perdu / gagné » ; les autres et la télé, les deux noms
    const neutre = tr`${joueurs[perdant]} a perdu, ${joueurs[gagnant]} gagne`;
    resultat.dataset.tele = neutre;
    resultat.innerText = moi(perdant) ? tr`${joueurs[perdant]}, tu as perdu !\n${joueurs[gagnant]} gagne`
      : moi(gagnant) ? tr`${joueurs[gagnant]}, tu as gagné !\n${joueurs[perdant]} perd`
      : neutre;
    const gorg = gorgeesDuel(valeurCarteDuel(carteEnJeu), duelMultiplicateur);
    terminerDuel(overlay, perdant, gorg, carteEnJeu, tr`${joueurs[perdant]} boit ${texteGorgees(gorg)}`, generation, 3200);
  }

  nouvelleManche();
}

// Haut commun des Shifumi du mode classique : carte du paquet des duels en jeu, titre, « Tris VS Ylana »
function enteteShifumi(overlay, j1, j2, classe){
  overlay.classList.add("duel-shifumi", classe);
  resetPaquetDuelSiBesoin();
  const carteEnJeu = paquetDuel.shift();
  const content = document.createElement("div");
  content.className = "duel-content shifumi-content";
  overlay.appendChild(content);
  ajouterCarteVedette(content, carteEnJeu, "shifumi-carte");
  const titre = document.createElement("div");
  titre.className = "titre-pigeon duel-main-title";
  titre.innerText = tr("SHIFUMI");
  content.appendChild(titre);
  const vs = document.createElement("div");
  vs.className = "duel-vs";
  const nomVs = (idx) => { const n = document.createElement("span"); n.className = "duel-vs-nom"; n.textContent = joueurs[idx]; return n; };
  const motVs = document.createElement("b");
  motVs.className = "duel-vs-mot";
  motVs.textContent = "VS";
  vs.append(nomVs(j1), " ", motVs, " ", nomVs(j2));
  content.appendChild(vs);
  return { content, titre, carteEnJeu };
}

// Résultat d'un Shifumi : null = égalité, sinon l'index du gagnant
function gagnantShifumi(j1, c1, j2, c2){
  if(c1 === c2) return null;
  return BAT_SHIFUMI[c1] === c2 ? j1 : j2;
}

// Carte Shifumi (dos, puis face qui se retourne), pour la variante « cartes »
function creerCarteShifumi(nom){
  const carte = document.createElement("div");
  carte.className = "shifumi-carte-jeu";
  carte.innerHTML = `<div class="shifumi-carte-interieur"><div class="shifumi-carte-dos"></div>` +
    `<div class="shifumi-carte-face"><span class="shifumi-face-image"></span><span class="shifumi-face-nom"></span></div></div>` +
    `<span class="duel-label shifumi-carte-joueur">${echapperHtml(nom)}</span>`;
  return carte;
}

// ===== Shifumi CARTES (classique, un seul téléphone) =====
// Chacun son tour choisit pierre, feuille ou ciseaux (on se passe le téléphone) : une carte Shifumi de dos apparaît
// à chaque choix. Une fois les 2 cartes posées : suspense, puis elles se retournent. Égalité : ×2 et on rejoue.
// Actions « shifumi:<manche>:<joueur>:<choix> » : rejouées à la reprise d'une partie, comme le reste.
function afficherOverlayShifumiCartes(overlay, j1, j2){
  const generation = generationPartie;
  const { content, titre, carteEnJeu } = enteteShifumi(overlay, j1, j2, "shifumi-cartes");

  const table = document.createElement("div");
  table.className = "shifumi-table";
  table.dataset.tele = ""; // (télé : rien des cartes avant qu'elles soient retournées)
  content.appendChild(table);
  const precharge = document.createElement("div"); // (dos des cartes Shifumi chargé dès maintenant, voir style_alcuno.css)
  precharge.className = "shifumi-carte-dos shifumi-precharge";
  precharge.dataset.tele = "";
  content.appendChild(precharge);

  const info = document.createElement("div");
  info.className = "duel-info shifumi-info";
  content.appendChild(info);

  const zoneChoix = document.createElement("div");
  zoneChoix.className = "shifumi-zone";
  zoneChoix.dataset.tele = "";
  content.appendChild(zoneChoix);

  const resultat = document.createElement("div");
  resultat.className = "duel-info shifumi-resultat";
  content.appendChild(resultat);

  let manche = 0;
  let choix = {};
  const cartes = {};

  function aQui(idx){
    zoneChoix.innerHTML = "";
    info.innerText = tr`${joueurs[idx]} : fais ton choix !`;
    const rangee = document.createElement("div");
    rangee.className = "shifumi-options";
    CHOIX_SHIFUMI.forEach((c) => {
      const option = document.createElement("div");
      option.className = "shifumi-option";
      option.setAttribute("role", "button");
      option.innerHTML = `<span class="shifumi-image">${IMAGE_SHIFUMI[c]}</span><span class="shifumi-nom">${echapperHtml(nomChoixShifumi(c))}</span>`;
      surAction(option, `shifumi:${manche}:${idx}:${c}`, { owner: joueurs[idx], once: true, valide: () => !choix[idx] }, () => choisir(idx, c));
      rangee.appendChild(option);
    });
    zoneChoix.appendChild(rangee);
  }

  function nouvelleManche(){
    manche++;
    choix = {};
    overlay.classList.remove("shifumi-revele");
    table.innerHTML = "";
    table.dataset.tele = "";
    resultat.innerText = "";
    aQui(j1);
  }

  function choisir(idx, c){
    if(choix[idx] || generation !== generationPartie) return;
    choix[idx] = c;
    sonClicTheme();
    vibrer(40);
    // Sa carte arrive de dos sur la table
    cartes[idx] = creerCarteShifumi(joueurs[idx]);
    table.appendChild(cartes[idx]);
    if(!choix[j2]){ aQui(j2); return; }
    zoneChoix.innerHTML = "";
    suspense();
  }

  function suspense(){
    const etapes = [tr("Pierre…"), tr("Feuille…"), tr("Ciseaux…")];
    info.innerText = etapes[0];
    etapes.forEach((t, i) => setTimeout(() => {
      if(generation !== generationPartie || !overlay.isConnected) return;
      info.innerText = t;
    }, delai(i * 550)));
    setTimeout(() => {
      if(generation !== generationPartie || !overlay.isConnected) return;
      reveler();
    }, delai(etapes.length * 550 + 150));
  }

  function reveler(){
    const c1 = choix[j1], c2 = choix[j2];
    [[j1, c1], [j2, c2]].forEach(([idx, c]) => {
      const carte = cartes[idx];
      carte.querySelector(".shifumi-face-image").textContent = IMAGE_SHIFUMI[c];
      carte.querySelector(".shifumi-face-nom").textContent = nomChoixShifumi(c);
      carte.classList.add("retournee");
    });
    table.dataset.tele = `${joueurs[j1]} : ${IMAGE_SHIFUMI[c1]} ${nomChoixShifumi(c1)}   —   ${joueurs[j2]} : ${IMAGE_SHIFUMI[c2]} ${nomChoixShifumi(c2)}`;
    overlay.classList.add("shifumi-revele");
    info.innerText = tr("SHIFUMI !");
    jouerSon("cartes");

    const gagnant = gagnantShifumi(j1, c1, j2, c2);
    if(gagnant === null){
      duelMultiplicateur *= 2;
      titre.innerText = tr("SHIFUMI ×") + duelMultiplicateur;
      resultat.innerText = tr("Égalité ! Les gorgées sont multipliées : ×") + duelMultiplicateur;
      setTimeout(() => {
        if(generation !== generationPartie || !overlay.isConnected) return;
        nouvelleManche();
      }, delai(2400));
      return;
    }
    const perdant = gagnant === j1 ? j2 : j1;
    cartes[gagnant].classList.add("shifumi-gagnant");
    cartes[perdant].classList.add("shifumi-perdant");
    compterStat("duels", joueurs[gagnant]);
    resultat.innerText = tr`${joueurs[perdant]} a perdu, ${joueurs[gagnant]} gagne`;
    const gorg = gorgeesDuel(valeurCarteDuel(carteEnJeu), duelMultiplicateur);
    terminerDuel(overlay, perdant, gorg, carteEnJeu, tr`${joueurs[perdant]} boit ${texteGorgees(gorg)}`, generation, 3200);
  }

  nouvelleManche();
}

// ===== DUEL RÉFLEXE =====
// Une carte du paquet des duels est l'enjeu, au milieu de l'écran. « Prêts ? », « Attention… », puis au bout d'un temps au
// hasard (1,5 à 4,5 s) « TAPE ! » en gros, en vert : le premier qui tape gagne. Taper avant : faux départ, perdu.
// - En ligne : chacun des 2 joueurs tape n'importe où sur SON téléphone. Le temps de réaction est mesuré sur ce téléphone,
//   entre l'affichage de SON « TAPE ! » et son toucher, puis envoyé avec l'action (« reflexe:<manche>:<joueur>:<ms> »,
//   « tot » pour un faux départ, « lent » au bout de 5 s sans tap) : le retard du réseau ne compte donc pas, et chaque
//   téléphone tire son propre moment (regarder l'écran du voisin n'aide pas). Le plus rapide gagne ; même temps : égalité.
// - En classique (un seul téléphone posé entre les deux) : l'écran est coupé en deux, une moitié par joueur (celle du
//   haut à l'envers, pour celui d'en face). Le premier tap après « TAPE ! » gagne.
// Égalité : gorgées ×2 et on rejoue (même carte). Personne n'a tapé (en ligne) : on rejoue sans doubler.
// Le perdant boit les gorgées de la carte en jeu.
const DUREE_REFLEXE_LENT = 5000;
const DUREE_RESULTAT_REFLEXE = 3600; // (le résultat ne se saute pas au tap : les joueurs tapent encore, voir conclure)
function afficherOverlayReflexe(overlay, j1, j2){
  const generation = generationPartie;
  overlay.classList.add("duel-shifumi", "duel-reflexe", enLigneActif ? "reflexe-en-ligne" : "reflexe-classique");
  resetPaquetDuelSiBesoin();
  const carteEnJeu = paquetDuel.shift();
  const moi = (idx) => enLigneActif && !estSpectateur && joueurs[idx] === pseudoActuel;
  const jeJoue = moi(j1) || moi(j2);
  const adversaire = (idx) => idx === j1 ? j2 : j1;
  const bot = (idx) => !enLigneActif && typeof estBot === "function" && estBot(joueurs[idx]);

  const content = document.createElement("div");
  content.className = "duel-content shifumi-content reflexe-content";
  overlay.appendChild(content);

  // Zone de tap d'un joueur. Classique : une moitié d'écran, avec son nom. En ligne : tout l'écran (calque transparent),
  // seulement sur son téléphone (ailleurs elle existe pour rejouer son action, mais cachée)
  const zones = {};
  const creerZone = (idx) => {
    const zone = document.createElement("div");
    zone.className = "reflexe-zone";
    zone.setAttribute("role", "button");
    zone.dataset.tele = "";
    zone.innerHTML = `<span class="duel-label reflexe-zone-nom">${echapperHtml(joueurs[idx])}</span>` +
      `<span class="reflexe-zone-texte"></span>`;
    zones[idx] = zone;
    return zone;
  };
  if(!enLigneActif){
    const haut = creerZone(j2);
    haut.classList.add("reflexe-zone-haut");
    content.appendChild(haut);
  }

  const milieu = document.createElement("div");
  milieu.className = "reflexe-milieu";
  content.appendChild(milieu);
  const titre = document.createElement("div");
  titre.className = "titre-pigeon duel-main-title";
  titre.innerText = tr("RÉFLEXE");
  milieu.appendChild(titre);
  const vs = document.createElement("div");
  vs.className = "duel-vs";
  const nomVs = (idx) => { const n = document.createElement("span"); n.className = "duel-vs-nom"; n.textContent = joueurs[idx]; return n; };
  const motVs = document.createElement("b");
  motVs.className = "duel-vs-mot";
  motVs.textContent = "VS";
  vs.append(nomVs(j1), " ", motVs, " ", nomVs(j2));
  milieu.appendChild(vs);
  ajouterCarteVedette(milieu, carteEnJeu, "shifumi-carte reflexe-enjeu");

  // « Prêts ? », « Attention… », puis « TAPE ! » en gros (vert)
  const signal = document.createElement("div");
  signal.className = "reflexe-signal";
  milieu.appendChild(signal);
  const consigne = document.createElement("div");
  consigne.className = "duel-label reflexe-consigne";
  consigne.dataset.tele = "";
  milieu.appendChild(consigne);
  const temps = document.createElement("div");
  temps.className = "reflexe-temps";
  milieu.appendChild(temps);
  const resultat = document.createElement("div");
  resultat.className = "duel-info shifumi-resultat";
  milieu.appendChild(resultat);

  if(enLigneActif){
    [j1, j2].forEach((idx) => {
      const zone = creerZone(idx);
      zone.classList.add("reflexe-zone-ecran");
      if(!moi(idx)) zone.hidden = true;
      overlay.appendChild(zone);
    });
  } else {
    const bas = creerZone(j1);
    bas.classList.add("reflexe-zone-bas");
    content.appendChild(bas);
  }

  let manche = 0;
  let res = {};        // idx -> nombre (ms) | "tot" | "lent"
  let go = false;      // « TAPE ! » affiché
  let tGo = 0;         // moment où « TAPE ! » est à l'écran, sur CE téléphone
  let fini = false;
  let forcerLent = false;
  const minuteurs = [];
  const plusTard = (f, ms) => minuteurs.push(setTimeout(() => {
    if(generation !== generationPartie || !overlay.isConnected) return;
    f();
  }, ms));
  const arreterMinuteurs = () => { minuteurs.forEach(clearTimeout); minuteurs.length = 0; };

  // Le résultat s'affiche alors que les joueurs tapent encore : ces taps ne doivent ni le sauter (terminerDuel : un tap
  // sur l'écran du duel l'abrège), ni fermer l'annonce « X boit… » ou choisir une annulation juste après
  overlay.addEventListener("pointerdown", (e) => { if(fini) e.stopPropagation(); }, true);

  const texteTemps = (v) => v === "tot" ? tr("faux départ !") : v === "lent" ? tr("trop lent !") : `${v} ms`;
  const afficherSignal = (texte, classe = "") => { signal.innerText = texte; signal.className = "reflexe-signal " + classe; };

  function nouvelleManche(){
    manche++;
    res = {};
    go = false;
    fini = false;
    arreterMinuteurs();
    overlay.classList.remove("shifumi-revele", "reflexe-go");
    temps.innerHTML = "";
    resultat.innerText = "";
    delete resultat.dataset.tele;
    afficherSignal(enLigneActif && !jeJoue ? tr("Duel Réflexe en cours...") : tr("Prêts ?"), enLigneActif && !jeJoue ? "reflexe-signal-petit" : "");
    signal.dataset.tele = tr("Duel Réflexe en cours...");
    consigne.innerText = jeJoue ? tr("Tape l'écran dès que « TAPE ! » s'affiche") : "";
    [j1, j2].forEach((idx) => {
      // Zone neuve à chaque manche (surAction ajoute son écouteur : l'ancien enverrait l'action de la manche d'avant)
      const ancienne = zones[idx];
      const zone = ancienne.cloneNode(false);
      while(ancienne.firstChild) zone.appendChild(ancienne.firstChild);
      ancienne.replaceWith(zone);
      zones[idx] = zone;
      zone.classList.remove("faite", "gagnante", "perdante");
      delete zone.dataset.netUtilise;
      delete zone.dataset.netEnvoye;
      zone.querySelector(".reflexe-zone-texte").innerText = enLigneActif ? "" : tr("Tape ici dès que « TAPE ! » s'affiche");
      surAction(zone, `reflexe:${manche}:${idx}:`, {
        owner: joueurs[idx], once: true, valide: () => !fini && res[idx] === undefined,
        charge: (e) => {
          if(forcerLent){ forcerLent = false; return "lent"; }
          if(!go) return "tot";
          // heure du toucher lui-même (pas celle où ce code tourne, parfois un peu après)
          const t = e && e.timeStamp > 0 ? e.timeStamp : performance.now();
          return Math.max(1, Math.round(t - tGo));
        }
      }, (e, valeur) => taper(idx, valeur));
    });
    // La barre « Mauvais joueur ? Annuler » (quelques secondes après le choix des joueurs) cache le bas de l'écran, donc la
    // zone du joueur du bas : le compte ne commence qu'une fois la barre partie
    const m = manche;
    const lancerCompte = () => {
      if(m !== manche || fini) return;
      if(document.getElementById("annulerChoix")) return plusTard(lancerCompte, 150);
      if(jeJoue || !enLigneActif) plusTard(() => { if(!go && m === manche) afficherSignal(tr("Attention…"), "reflexe-signal-attention"); }, 900);
      // Moment du « TAPE ! » : tiré sur CE téléphone (pas le hasard commun de la partie : rien à garder pareil partout)
      plusTard(signalGo, 1500 + Math.floor(Math.random() * 3000));
    };
    lancerCompte();
  }

  function signalGo(){
    if(fini) return;
    go = true;
    overlay.classList.add("reflexe-go");
    if(jeJoue || !enLigneActif) afficherSignal(tr("TAPE !"), "reflexe-signal-go");
    tGo = performance.now();
    requestAnimationFrame((t) => { if(go && !fini) tGo = t; }); // (recalé sur l'image où « TAPE ! » apparaît)
    vibrer(60);
    const m = manche;
    [j1, j2].forEach((idx) => {
      // En ligne : pas de tap au bout de 5 s => « trop lent », envoyé par SON téléphone (lui seul sait)
      if(moi(idx)) plusTard(() => {
        if(m !== manche || fini || res[idx] !== undefined) return;
        forcerLent = true;
        zones[idx].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        forcerLent = false;
      }, DUREE_REFLEXE_LENT);
      // Bot (classique) : il tape entre 0,25 et 0,55 s après
      if(bot(idx)) plusTard(() => {
        if(m !== manche || fini) return;
        zones[idx].dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      }, 250 + Math.floor(Math.random() * 300));
    });
  }

  function taper(idx, valeur){
    if(fini || generation !== generationPartie) return;
    const v = valeur === "tot" || valeur === "lent" ? valeur : Number(valeur) || 1;
    res[idx] = v;
    const zone = zones[idx];
    zone.classList.add("faite");
    if(moi(idx) || !enLigneActif){
      sonClicTheme();
      if(!enLigneActif) zone.querySelector(".reflexe-zone-texte").innerText = texteTemps(v);
    }
    if(moi(idx) && v !== "tot"){
      consigne.innerText = `${texteTemps(v)} — ` + tr`En attente de ${joueurs[adversaire(idx)]}…`;
    }
    // Faux départ : perdu tout de suite
    if(v === "tot") return conclure(adversaire(idx));
    // Classique : le premier tap après « TAPE ! » gagne (l'autre n'a pas encore tapé)
    if(!enLigneActif) return conclure(idx);
    const a = res[j1], b = res[j2];
    if(a === undefined || b === undefined) return;
    if(a === "lent" && b === "lent") return conclure(null, true);
    if(a === "lent") return conclure(j2);
    if(b === "lent") return conclure(j1);
    conclure(a === b ? null : a < b ? j1 : j2);
  }

  // personne : aucun des deux n'a tapé (en ligne) => on recommence, sans multiplier les gorgées
  function conclure(gagnant, personne = false){
    fini = true;
    arreterMinuteurs();
    overlay.classList.add("shifumi-revele");
    overlay.classList.remove("reflexe-go");
    consigne.innerText = "";
    delete signal.dataset.tele;
    // Les temps de chacun (en ligne : ceux reçus ; en classique, seul le tap du premier compte)
    const lignes = [j1, j2].filter((idx) => res[idx] !== undefined)
      .map((idx) => `<span class="reflexe-ligne"><b>${echapperHtml(joueurs[idx])}</b> : ${echapperHtml(texteTemps(res[idx]))}</span>`);
    temps.innerHTML = lignes.join("");

    if(gagnant === null){
      if(personne){
        afficherSignal(tr("Personne n'a tapé !"), "reflexe-signal-petit");
        resultat.innerText = tr("On recommence.");
      } else {
        duelMultiplicateur *= 2;
        titre.innerText = tr("RÉFLEXE ×") + duelMultiplicateur;
        afficherSignal(tr("Égalité !"), "reflexe-signal-petit");
        resultat.innerText = tr("Égalité ! Les gorgées sont multipliées : ×") + duelMultiplicateur;
      }
      jouerSon("cartes");
      setTimeout(() => {
        if(generation !== generationPartie || !overlay.isConnected) return;
        nouvelleManche();
      }, delai(2800));
      return;
    }
    const perdant = adversaire(gagnant);
    const fauxDepart = res[perdant] === "tot";
    afficherSignal(fauxDepart ? tr`Faux départ de ${joueurs[perdant]} !` : tr("RÉFLEXE !"), "reflexe-signal-petit");
    zones[gagnant].classList.add("gagnante");
    zones[perdant].classList.add("perdante");
    jouerSon("cartes");
    compterStat("duels", joueurs[gagnant]);
    const neutre = tr`${joueurs[perdant]} a perdu, ${joueurs[gagnant]} gagne`;
    resultat.dataset.tele = neutre;
    resultat.innerText = moi(perdant) ? tr`${joueurs[perdant]}, tu as perdu !\n${joueurs[gagnant]} gagne`
      : moi(gagnant) ? tr`${joueurs[gagnant]}, tu as gagné !\n${joueurs[perdant]} perd`
      : neutre;
    const gorg = gorgeesDuel(valeurCarteDuel(carteEnJeu), duelMultiplicateur);
    terminerDuel(overlay, perdant, gorg, carteEnJeu, tr`${joueurs[perdant]} boit ${texteGorgees(gorg)}`, generation, DUREE_RESULTAT_REFLEXE);
  }

  nouvelleManche();
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

  // « Tris VS Ylana » : qui s'affronte, sous le titre, pendant tout le duel (égalités comprises)
  const vs = document.createElement("div");
  vs.className = "duel-vs";
  const nomVs = (idx) => { const s = document.createElement("span"); s.className = "duel-vs-nom"; s.textContent = joueurs[idx]; return s; };
  const motVs = document.createElement("b");
  motVs.className = "duel-vs-mot";
  motVs.textContent = "VS";
  vs.append(nomVs(j1), " ", motVs, " ", nomVs(j2)); // (espaces : la télé lit « Tris VS Ylana »)
  content.appendChild(vs);

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
    info.innerText = tr`${joueurs[j1]} : choisis une carte`;

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

    info.innerText = tr`${joueurs[j1]} : choisis une carte`;
  }

  function resoudreDuel(carteJ1, carteJ2){
    const v1 = valeurCarteDuel(carteJ1);
    const v2 = valeurCarteDuel(carteJ2);

    if(v1 === v2){
      duelMultiplicateur *= 2;
      // Le multiplicateur reste affiché dans le titre pendant tout le duel
      titre.innerText = tr("DUEL ×") + duelMultiplicateur;
      info.innerText = tr("Égalité ! Les gorgées sont multipliées : ×") + duelMultiplicateur;
      // petite pause puis on relance un duel (toujours dos au départ)
      setTimeout(() => {
        if(generation !== generationPartie) return;
        preparerDuel();
      }, delai(1500));
      return;
    }

    const perdant = (v1 < v2) ? j1 : j2;
    compterStat("duels", joueurs[perdant === j1 ? j2 : j1]); // (récap de fin : duels gagnés)
    // Sa carte du dernier tirage (après une égalité, ce sont les nouvelles cartes qui comptent)
    const vPerdant = (v1 < v2) ? v1 : v2;
    const cartePerdant = (v1 < v2) ? carteJ1 : carteJ2;
    const gorg = gorgeesDuel(vPerdant, duelMultiplicateur);
    const msg = tr`${joueurs[perdant]} boit ${texteGorgees(gorg)}`;

    // Résultat visible tout de suite sur le duel : la carte du perdant en rouge, celle du gagnant estompée
    const carteDeJ1 = (choixJ1 === 1) ? c1 : c2;
    const carteDeJ2 = (choixJ1 === 1) ? c2 : c1;
    c1.style.opacity = ""; // (opacité posée par preparerDuel : sinon la carte du gagnant ne s'estompe pas)
    c2.style.opacity = "";
    (perdant === j1 ? carteDeJ1 : carteDeJ2).classList.add("duel-perdant");
    briserGivre(perdant === j1 ? carteDeJ1 : carteDeJ2); // (thème Givre : son givre éclate et tombe en morceaux)
    (perdant === j1 ? carteDeJ2 : carteDeJ1).classList.add("duel-gagnant");
    info.innerText = joueurs[perdant] + tr(" perd le duel !");
    terminerDuel(overlay, perdant, gorg, cartePerdant, msg, generation, 2200);
  }

  function onChoose(which){
    // Phase 1 : J1 choisit
    if(phase === 1){
      sonClicTheme(); // (sabre, son BDSM, saxophone : js/reglages.js)
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
      label1.innerText = (which === 1) ? tr`Carte de ${joueurs[j1]}` : "";
      label2.innerText = (which === 2) ? tr`Carte de ${joueurs[j1]}` : "";
      info.innerText = tr`${joueurs[j2]} : clique sur la carte restante`;
      return;
    }

    // Phase 2 : J2 doit cliquer la carte restante uniquement
    if(phase === 2){
      // sécurité : si J2 clique la même que J1 (normalement impossible)
      if(which === choixJ1) return;
      sonClicTheme();

      phase = 3; // terminé
      c1.style.pointerEvents = "none";
      c2.style.pointerEvents = "none";
      c1.classList.remove("duel-a-choisir");
      c2.classList.remove("duel-a-choisir");

      // Attribution réelle des cartes
      const carteJ1 = (choixJ1 === 1) ? carteA : carteB;
      const carteJ2 = (choixJ1 === 1) ? carteB : carteA;

      // Le nom de J2 s'affiche tout de suite sous sa carte (comme pour J1), avant le retournement
      if(which === 1) label1.innerText = tr`Carte de ${joueurs[j2]}`;
      else label2.innerText = tr`Carte de ${joueurs[j2]}`;

      // La 2e carte se met aussi en retrait (comme celle de J1) : on voit qu'elle a été prise, puis on
      // passe au retournement (avant : l'effet était retiré aussitôt, rien ne se voyait au 2e tap)
      const choisie2 = (which === 1) ? c1 : c2;
      choisie2.classList.add("duel-selected");
      setTimeout(() => {
        if(generation !== generationPartie) return;
        info.innerText = tr("On retourne les cartes…");
        overlay.classList.add("reveal");
        c1.classList.remove("duel-selected");
        c2.classList.remove("duel-selected");
        c1.style.boxShadow = "";
        c2.style.boxShadow = "";
      }, delai(450));

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
          label1.innerText = tr`Carte de ${joueurs[j1]}`;
          label2.innerText = tr`Carte de ${joueurs[j2]}`;
        } else {
          label1.innerText = tr`Carte de ${joueurs[j2]}`;
          label2.innerText = tr`Carte de ${joueurs[j1]}`;
        }

        info.innerText = tr("Résultat…");
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
  titre.innerText = tr`PLUS 4\nDistribue ${texteGorgees(aDistribuer)}`; // « PLUS 4 » au-dessus
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
    totalBox.innerText = tr`Gorgées distribuées : ${total} / ${aDistribuer}`;

    // update boutons joueurs (badge)
    [...container.querySelectorAll("button[data-idx]")].forEach(btn=>{
      const idx = Number(btn.dataset.idx);
      const n = dist[idx];
      btn.innerHTML = n > 0
      ? `${echapperHtml(avecCouronne(joueurs[idx]))} <span class="plus4-badge">+ ${n}</span>`
      : echapperHtml(avecCouronne(joueurs[idx]));

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
    if(estEnPause(nom)) return; // (en pause : on ne lui distribue rien)
    const btn = document.createElement("button");
    btn.className = "bouton-pigeon plus4-joueur-btn";
    btn.dataset.idx = String(idx);
    btn.innerText = avecCouronne(nom);

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
  btnUndo.innerText = tr("Retour");
  surAction(btnUndo, "plus4:annuler", { owner: choisisseur }, ()=>{
    if(historique.length === 0) return;
    const idx = historique.pop();
    if(dist[idx] > 0) dist[idx] -= 1;
    refreshUI();
  });

  const btnReset = document.createElement("button");
  btnReset.className = "bouton-pigeon plus4-action-btn";
  btnReset.innerText = tr("Annuler");
  surAction(btnReset, "plus4:reset", { owner: choisisseur }, ()=>{
    Object.keys(dist).forEach(k => dist[k] = 0);
    historique = [];
    refreshUI();
  });

  const btnValider = document.createElement("button");
  btnValider.className = "bouton-pigeon plus4-action-btn";
  btnValider.innerText = tr("Valider");
  surAction(btnValider, "plus4:valider", { owner: choisisseur, once: true }, ()=>{
    if(totalDistribue() !== aDistribuer) return;
    if(joueurs.filter(nom => !estEnPause(nom)).length > 1) proposerAnnulerChoix(choisisseur); // « Mauvais joueur ? Annuler » : retour à la distribution (pas s'il n'y avait qu'un joueur à qui distribuer)

    overlay.remove();
    unlockScroll();
    choixPigeonEnCours = false;
    afficherJoueurActif();

    const file = Object.entries(dist)
      .map(([k,v]) => ({ idx: Number(k), n: Number(v) }))
      .filter(x => x.n > 0);

    // Résultat affiché dans « Règles » tout de suite, puis mis à jour avec les annulations
    const resultats = file.map(x => ({ nom: joueurs[x.idx], n: x.n, reste: x.n }));
    file.forEach(x => compterCouple(choisisseur, joueurs[x.idx], x.n)); // (récap, mode hot : « Couple de la soirée »)
    const afficherResultat = () => {
      afficherRegleBloc(regleZero, textePlus4(choisisseur, resultats));
      regleZero.style.display = "block";
      zeroEnCours = true; // effacé au prochain tirage, comme les autres règles
    };
    afficherResultat();

    distribuerFilePlus4(file, classeCartePlus4, (idx, reste) => {
      const r = resultats.find(x => x.nom === joueurs[idx]);
      if(r) r.reste = reste;
      afficherResultat();
    });
  });
  // Ordre d'affichage : Valider, puis Retour, puis Annuler
  actions.append(btnValider, btnUndo, btnReset);

  document.body.appendChild(overlay);
  refreshUI();
}

// Texte du résultat d'un +4 pour « Règles » : qui boit combien, annulations comprises. Court pour tenir
// dans le bloc même avec beaucoup de joueurs : ceux qui boivent autant sur une même ligne (« Ylana et Paul
// boivent 1 gorgée »), ceux qui ont tout annulé pas affichés, « Personne ne boit » si tout le monde a annulé.
function textePlus4(choisisseur, resultats){
  const parQuantite = new Map(); // gorgées => noms
  resultats.filter(r => r.reste > 0).forEach(r => {
    if(!parQuantite.has(r.reste)) parQuantite.set(r.reste, []);
    parQuantite.get(r.reste).push(r.nom);
  });
  if(parQuantite.size === 0) return tr`+4 de ${choisisseur} :\nPersonne ne boit`;
  const lignes = [...parQuantite.entries()]
    .sort((a, b) => b[0] - a[0]) // ceux qui boivent le plus d'abord
    .map(([n, noms]) => {
      const qui = noms.length > 1 ? tr`${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : noms[0];
      return noms.length > 1 ? tr`${qui} boivent ${texteGorgees(n)}` : tr`${qui} boit ${texteGorgees(n)}`;
    });
  return tr`+4 de ${choisisseur} :\n${lignes.join("\n")}`;
}

// onAnnulation(joueurIndex, gorgéesRestantes) : appelé quand un joueur a choisi combien il en annule
function distribuerFilePlus4(file, classeCartePlus4, onAnnulation = null, seul = file.length === 1){
  if(file.length === 0) return;

  const item = file.shift();
  demanderAnnulationPlus4(item.idx, item.n, classeCartePlus4, () => {
    distribuerFilePlus4(file, classeCartePlus4, onAnnulation, seul);
  }, onAnnulation, seul);
}

// seul : une seule personne reçoit tout le +4 (en mode hot, elle peut alors relever un défi)
function demanderAnnulationPlus4(joueurIndex, nbGorgees, classeCartePlus4, onFinish, onAnnulation = null, seul = false){
  compterStat("plus4", joueurs[joueurIndex], nbGorgees); // (récap de fin : gorgées reçues par des +4)
  const nom = joueurs[joueurIndex];
  const msg = tr`${nom} boit ${texteGorgees(nbGorgees)} (+4)`;
  // Un bot ne boit pas : gorgées perdues, ou refilées à un vrai joueur (js/bots.js)
  if(typeof gorgeesDuBot === "function" && gorgeesDuBot(joueurIndex, nbGorgees, classeCartePlus4, msg, onFinish,
    (h, texte) => annoncerBoireAvecAnnulation(h, nbGorgees, classeCartePlus4, texte, onFinish))) return;

  montrerOverlayRegle(msg, classeCartePlus4);
  const defiHot = montrerDefiHot(joueurIndex, nbGorgees, seul); // (mode hot : bloc défi sous la carte, js/mode-hot.js)

  executerApresOverlayRegleUnique(() => {
    if(joueurPeutAnnuler(joueurIndex, nbGorgees)){
      afficherOverlayAnnulation(
        joueurIndex,
        nbGorgees,
        (utilise, reste) => { if(typeof onAnnulation === "function") onAnnulation(joueurIndex, reste); },
        () => { if(typeof onFinish === "function") onFinish(); }
      );
    } else {
      finirBoireHot(defiHot, joueurIndex, nbGorgees, onFinish);
    }
  });
}

// #endregion

// #region Application des règles et déroulement du jeu
// ===== Annulations pour pénalités multi-joueurs (SOCIAL / ZERO) =====
function demanderAnnulationSimple(joueurIndex, nbGorgees, onFinish){
  if(!joueurPeutAnnuler(joueurIndex, nbGorgees)){
    noterGorgees(joueurs[joueurIndex], nbGorgees);
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

  if(typeof estBot === "function") victimes = victimes.filter(idx => !estBot(joueurs[idx])); // (un bot ne boit pas, js/bots.js)
  const file = victimes.filter(idx => Number(annulations[joueurs[idx]] || 0) > 0);
  victimes.filter(idx => !file.includes(idx)).forEach(idx => noterGorgees(joueurs[idx], 1)); // (rien à annuler)

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

// Faces fermées : la carte retournée se recache (dos grisé) une fois l'annonce fermée, avec un petit
// retournement. La classe « recachee » est posée même en faces ouvertes : c'est le CSS (classe
// faces-fermees sur <html>) qui décide de l'aspect, donc changer le réglage en pleine partie marche aussi.
function programmerRecache(carte){
  const generation = generationPartie;
  const recacher = () => {
    if(generation !== generationPartie || !carte.isConnected || carte.classList.contains("recachee")) return;
    if(rattrapageEnCours || !document.documentElement.classList.contains("faces-fermees")){
      carte.classList.add("recachee");
      return;
    }
    carte.classList.add("recache-anim"); // elle se referme…
    setTimeout(() => {
      carte.classList.add("recachee");    // … et revient de dos
      carte.classList.remove("recache-anim");
    }, 200);
  };
  if(rattrapageEnCours){ recacher(); return; }
  setTimeout(() => executerApresOverlayRegleUnique(() => setTimeout(recacher, 450)), 300);
}

function couleurDeLaCarte(classeCarte){
  // Ex: "un_vert1" => "vert", "interdit_rouge" => "rouge"
  const m = classeCarte.match(/_(vert|jaune|rouge|bleu)/);
  return m ? m[1] : null;
}

// La carte « 1 » s'envole du plateau vers le nom du joueur qui la garde, puis son +1 pulse
function envolerCarteVersJoueur(carteElement, classeCarte, nom){
  envolPourTele(carteElement, classeCarte, nom); // mode télé : la télé fait la même animation
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
// ===== Dernières cartes (volet du bandeau « Tour de », js/plateau.js) =====
// Une entrée par carte tirée, la plus récente en premier ; ses lignes = les messages du bloc Règles qui
// ont suivi (sans l'explication du pigeon, déjà connue)
const MAX_HISTORIQUE = 6;
let historiqueCartes = [];
function noterHistorique(texte){
  const entree = historiqueCartes[0];
  if(!entree) return;
  String(texte || "").split("\n").map(l => l.trim())
    .filter(l => l && !/^(À chaque 3|Pour s'en débarrasser|Every time a 3|To get rid of it)/.test(l))
    .map(l => l.replace(/ (sauf toi|except you)$/, tr` sauf ${entree.nom}`)) // (le 0 : « sauf toi » ne voudrait plus rien dire)
    .forEach(l => { if(!entree.lignes.includes(l)) entree.lignes.push(l); });
}

function appliquerRegle(carteTiree, joueurActuel, carteElement){
  historiqueCartes.unshift({ carte: carteTiree, nom: joueurs[joueurActuel] || "", lignes: [] });
  historiqueCartes.length = Math.min(historiqueCartes.length, MAX_HISTORIQUE);
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
    noterDoreeStats("doreesTirees"); // statistiques (js/stats.js)
    afficherRegleBloc(regleZero, tr`CARTE DORÉE : distribue ${texteCulSec()}`);
    regleZero.style.display = "block";
    zeroEnCours = true;

    // Plateau bloqué (et pari de fin en attente) jusqu'au choix de la victime
    choixPigeonEnCours = true;
    const texteCarteDoree = estModeSoft()
      ? tr("Distribue 3 gorgées de la part du développeur 😘")
      : tr("Distribue un CUL SEC de la part du développeur.\nEt obligation de se servir un vrai verre avant 😘");
    // Le texte complet sert à calculer la durée d'affichage de l'overlay
    montrerOverlayRegle(tr`CARTE DORÉE\n${texteCarteDoree}`, carteTiree);
    vibrer([150, 70, 150, 70, 300]);
    jouerSon("doree");
    habillerOverlayCarteDoree(texteCarteDoree);
    reglerDureeOverlayRegle(tr`CARTE DORÉE\n${texteCarteDoree}`, 1.65); // +65 % de temps de lecture
    executerApresOverlayRegleUnique(() => afficherOverlayCarteDoree(joueurActuel));
    return;
  }

  // Cas spécial: plus_4 => overlay de distribution + annulations chez les cibles
  if (carteTiree.startsWith("plus_4")) {
    afficherOverlayPlus4(joueurActuel, carteTiree);
    return;
  }

  // Mode hot : carte Cupidon (lier deux joueurs ou briser un lien : js/mode-hot.js)
  if(carteTiree.startsWith("cupidon")){
    const entete = tr("CUPIDON !\nLie 2 joueurs : quand l'un boit, l'autre aussi.");
    afficherRegleBloc(regleZero, entete);
    regleZero.style.display = "block";
    zeroEnCours = true;
    choixPigeonEnCours = true; // plateau bloqué jusqu'au choix
    montrerOverlayRegle(entete, carteTiree);
    executerApresOverlayRegleUnique(() => afficherOverlayCupidon(joueurActuel, carteTiree, () => {
      appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
    }));
    return;
  }

  // Mode hot, période Saint-Valentin : carte Coup de foudre (un bisou sur la bouche… ou un cul sec : js/mode-hot.js)
  if(carteTiree === "coup_de_foudre"){
    // (mode hard : un doigt dans le cul à la place du bisou)
    const entete = tr`COUP DE FOUDRE ⚡\nChoisis quelqu'un : ${partieHard ? tr("un doigt dans le cul") : tr("un bisou sur la bouche")}… ou ${estModeSoft() ? tr("4 gorgées") : tr("un CUL SEC")} !`;
    afficherRegleBloc(regleZero, entete);
    regleZero.style.display = "block";
    zeroEnCours = true;
    choixPigeonEnCours = true; // plateau bloqué jusqu'au choix
    montrerOverlayRegle(entete, carteTiree);
    // pastille « Défi hot spécial Saint-Valentin » au-dessus du titre de l'annonce (même style que la fenêtre de choix)
    const titreAnnonce = document.querySelector("#overlayRegleUnique .regle-titre");
    if(titreAnnonce && !(titreAnnonce.previousElementSibling && titreAnnonce.previousElementSibling.classList.contains("foudre-badge"))){
      const badge = document.createElement("div");
      badge.className = "foudre-badge";
      badge.innerHTML = (partieHard ? SVG_18_BARRE + tr(" Défi hard") : tr("🔥 Défi hot")) + tr(' spécial <span class="foudre-nowrap">Saint-Valentin</span> 💘');
      titreAnnonce.before(badge);
    }
    executerApresOverlayRegleUnique(() => afficherOverlayCoupDeFoudre(joueurActuel, carteTiree, () => {
      appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
    }));
    return;
  }

  // Cartes "boire"
  if(carteTiree.startsWith("interdit")){
    const entete = tr("SOCIAAALE ! \nTout le monde boit 1 gorgée");

    afficherRegleBloc(regleZero, entete);
    regleZero.style.display = "block";
    zeroEnCours = true;

    const victimes = joueurs.map((_, i) => i).filter(i => !estEnPause(joueurs[i])); // tout le monde (sauf ceux en pause)
    demarrerAnnulationsMulti(victimes, carteTiree, entete, () => {
      appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
    });
    return;
  }

  // ZERO : tout le monde boit 1 sauf celui qui a tiré le 0
  if(carteTiree.startsWith("zero")){
    const entete = tr("Tout le monde boit 1 gorgée sauf toi");

    afficherRegleBloc(regleZero, entete);
    regleZero.style.display = "block";
    zeroEnCours = true;

    const victimes = joueurs.map((_, i) => i).filter(i => i !== joueurActuel && !estEnPause(joueurs[i]));
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
      tr`${joueurs[joueurActuel]} boit ${texteGorgees(n)}`,
      () => {
        appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
      }
    );
    return; // important : on évite le traitement générique en dessous
  }

  // Cartes "un" => +1 annulation de gorgée
  if(carteTiree.startsWith("un")){
    const msg = tr("+1 annulation de gorgée !");
    montrerOverlayRegle(msg, carteTiree);
    // puis message persistant jusqu'au prochain tirage (géré par zeroEnCours)
    afficherRegleBloc(regleZero, msg);
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
    const msg = tr("Sens du jeu inversé");
    afficherRegleBloc(regleZero, msg);
    regleZero.style.display = "block";
    switchEnCours = true;
    montrerOverlayRegle(tr("Le sens du jeu est inversé !"), carteTiree);
    appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true, afterRuleOverlay: true });
  }

  // Cartes "trois/pigeon"
  if(carteTiree.startsWith("trois")){
    
    if(indexPigeon===null){
      indexPigeon=joueurActuel;
      pigeonAClignoter = Date.now();
      compterStat("pigeon", joueurs[joueurActuel]);
      nomPigeonOriginal=joueurs[joueurActuel];
      const nPigeon = gorgeesPigeon();
      // (la ligne « Pour s'en débarrasser » reste : c'est la règle ; mais plus courte qu'avant. Les lignes qui commencent par « À chaque 3 » / « Pour s'en débarrasser » sont filtrées de l'historique, noterHistorique)
      const msgPigeon = tr`${joueurs[joueurActuel]} est le PIGEON !\nIl/elle boit ${texteGorgees(nPigeon)}.\nÀ chaque 3 tiré, le PIGEON boit 1 gorgée.\nPour s'en débarrasser : tirer un 3.`;
      annoncerBoireAvecAnnulation(
        joueurActuel,
        nPigeon,
        carteTiree,
        msgPigeon,
        () => {
          appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
        }
      );
      reglerDureeOverlayRegle(msgPigeon, DUREE_PREMIER_PIGEON); // première annonce : un peu plus longue que la normale (c'est la règle du jeu)
      jouerSon("pigeon");
    
    } else if(indexPigeon===joueurActuel){
      carteTroisPourTransfertPigeon = carteTiree;
      // La gorgée couleur éventuelle viendra après l'annonce du nouveau pigeon
      joueurTroisPourTransfertPigeon = joueurActuel;
      couleurTroisPourTransfertPigeon = couleurBue;
      afficherMenuPigeon();
    
    } else {
      // si quelqu'un d'autre tire un 3 : le pigeon boit 1 (annulable si compteur)
      const msg = tr`Le PIGEON (${joueurs[indexPigeon]}) boit 1 gorgée`;
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
    const msgCouleur = tr`${joueurs[joueurActuel]} boit 1 gorgée pour la couleur (${tr(couleurBue)})`;
    annoncerBoireAvecAnnulation(joueurActuel, 1, carteTiree, msgCouleur);
    couleurDuelEnAttente = msgCouleur; // (remise sous le résultat du duel, qui remplace le bloc Règles : voir resoudreDuel)
  }
}
let couleurDuelEnAttente = null;

/* ===== JEU ===== */
function lancerPartie(){
  if(joueurs.length < 2){
    alert(tr("Il faut au moins 2 joueurs"));
    return;
  }
  // Mode hard : seulement à 2 (en ligne : vérifié au lancement de la manche, js/en-ligne.js)
  if(!enLigneActif && !repriseClassiqueEnCours && estModeHard() && joueurs.length !== 2){
    alert(tr("Le mode hard se joue à 2 joueurs seulement."));
    return;
  }
  // Pas de bot en mode hard : il faut 2 vrais joueurs (js/bots.js)
  if(!enLigneActif && !repriseClassiqueEnCours && estModeHard() && typeof botsPresents === "function" && botsPresents().length){
    alert(tr("Pas de bot en mode hard : il faut 2 vrais joueurs."));
    return;
  }
  // Joueurs remplacés par un bot pendant la partie d'avant : de nouveau eux-mêmes (après un plantage, le rejeu les remplace
  // au même moment qu'avant) (js/bots.js)
  if(typeof rendreLesRemplaces === "function") rendreLesRemplaces();
  couleurDuelEnAttente = null;

  plateau.innerHTML = "";
  prechargerImagesCartes(); // (déjà fait à l'ouverture, en principe)
  historiqueCartes = [];
  fermerVoletHistorique();
  lancementPartieA = Date.now();
  // Classique : hasard à graine aussi, pour pouvoir rejouer la partie après un plantage (voir
  // « Partie classique gardée en mémoire » dans js/synchro-en-ligne.js)
  if(!enLigneActif) demarrerSauvegardeClassique();
  // Statistiques : partie classique lancée (pas une reprise ni un retour en arrière rejoués)
  if(!enLigneActif && !repriseClassiqueEnCours && !rattrapageEnCours) noterPartieStats(false, { hot: estModeHot(), hard: estModeHard(), pj: estModeSoft(), express: estPartieExpress() });
  if(!rattrapageEnCours) noterJeuAppareilStats(); // (stats : ce téléphone joue, js/stats.js)
  majTitrePJ(); // « ALCUNO PJ » dans le bandeau
  majFacesFermees(); // faces ouvertes / fermées (réglage, ou celui de l'hôte en ligne)
  garderEcranAllume(); // pas de mise en veille pendant la partie

  // Plateau principal = toutes les cartes SAUF 2/5/6/7/8/9 (paquet duel)
  const paquetPrincipal = classes.filter(c => !duelCartes.includes(c));
  // Mode hot (réglage ; en ligne, celui de la graine de la manche ; partie reprise : celui de la partie)
  const hotSeul = enLigneActif
    ? !!dernierEtatManche && graineHot(dernierEtatManche.seed)
    : sauvegardeClassique ? !!sauvegardeClassique.hot : estModeHot();
  // Mode hard (MODE_HARD.md) : la mécanique du mode hot (paquet, défis), avec ses propres défis. Jamais avec le hot.
  const hard = !hotSeul && (enLigneActif
    ? !!dernierEtatManche && graineHard(dernierEtatManche.seed)
    : sauvegardeClassique ? !!sauvegardeClassique.hard : estModeHard());
  const hot = hotSeul || hard;
  partieHot = hot;
  partieHard = hard;
  if(enLigneActif){
    choisirModeHotEnLigne(hotSeul);
    choisirModeHardEnLigne(hard);
    choisirDefisPersonnelsEnLigne(!!dernierEtatManche && !!dernierEtatManche.defisPersonnelsActifs);
  }
  else { // (partie reprise : même mode que pendant la partie)
    if(caseModeHot.checked !== hotSeul) caseModeHot.checked = hotSeul;
    if(caseModeHard.checked !== hard) caseModeHard.checked = hard;
    if(sauvegardeClassique && typeof sauvegardeClassique.defisPersonnels === "boolean") caseDefisPersonnels.checked = sauvegardeClassique.defisPersonnels;
  }
  initialiserModeHot(); // (js/mode-hot.js : défis vus, liens Cupidon, hasard des défis)
  // Période Saint-Valentin : carte Coup de foudre dans le paquet hot (en ligne : celle de la graine ; reprise : celle de la partie)
  partieValentin = hot && (enLigneActif
    ? !!dernierEtatManche && graineValentin(dernierEtatManche.seed)
    : sauvegardeClassique ? !!sauvegardeClassique.valentin : saintValentinEnCours());
  if(hot && !rattrapageEnCours) debloquerDonjon(hard); // thème secret « Donjon » (js/reglages.js ; hot ou hard)
  paquet = hot ? paquetHot(paquetPrincipal, joueurs.length, partieValentin) : [...paquetPrincipal];
  melangerPaquet(paquet);
  const express = enLigneActif
    ? !!dernierEtatManche && graineExpress(dernierEtatManche.seed)
    : sauvegardeClassique ? !!sauvegardeClassique.express : estPartieExpress();
  partieExpress = express;
  if(express) paquet = reduirePaquetExpress(paquet, hot);

  // Paquet duel (réutilisable à l'infini via resetPaquetDuelSiBesoin)
  paquetDuel = [...duelCartes];
  melangerPaquet(paquetDuel);

  // Tirée avec « aleatoire » : en ligne, tous les téléphones ont la même carte dorée au même endroit.
  // Jamais dans la première partie (de ce téléphone en classique, de l'hôte en ligne : voir
  // GRAINE_SANS_CARTE_DOREE)
  const sansCarteDoree = enLigneActif
    ? !!dernierEtatManche && graineSansCarteDoree(dernierEtatManche.seed)
    : sauvegardeClassique ? sauvegardeClassique.sansDoree : !premierePartieJouee();
  const avecCarteDoree = aleatoire() < CHANCE_CARTE_DOREE && !sansCarteDoree;
  noterPremierePartieJouee();
  // La carte dorée REMPLACE une carte normale (n'importe laquelle : la dernière du paquet mélangé),
  // pour garder le même nombre de cases (52, ou 28 en partie express) : sinon une carte se retrouvait seule sur la dernière rangée
  if(avecCarteDoree) paquet.pop();
  const nbCases = paquet.length + (avecCarteDoree ? 1 : 0);
  indexCaseDoree = avecCarteDoree ? Math.floor(aleatoire() * nbCases) : -1;
  carteDoreeEnJeu = avecCarteDoree;
  if(avecCarteDoree) noterDoreeStats("doreesEnJeu"); // statistiques (js/stats.js)
  reinitialiserGorgees();
  joueursEnPause = new Set(); // (personne en pause au début d'une partie)
  tourSautePourPause = null;
  pauseEnCours = false;
  ecranPause.style.display = "none";

  indexJoueur = 0;
  partieLancee = true;
  majMusique(); // musique de la partie : plus basse que dans les menus
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
  majBoutonPause();
  btnJouer.style.display = "none";

  regleZero.style.display = "none";
  effacerMessagePigeon();
  afficherJoueurActif();
  afficherJoueurs(); // (boutons ⏸ des joueurs, maintenant que la partie est lancée)

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
      programmerRecache(carte); // faces fermées : la carte se recache une fois son annonce passée

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

      // Joueur suivant (ceux en pause sont sautés, voir nextPlayerIndex)
      const sansPause = (indexJoueur + (sensHoraire ? 1 : -1) + joueurs.length) % joueurs.length;
      indexJoueur = nextPlayerIndex(indexJoueur);
      if(indexJoueur !== sansPause && !rattrapageEnCours){
        afficherNotificationHaut("", tr`${joueurs[sansPause]} est en pause : au tour de ${joueurs[indexJoueur]}`, true);
      }

      afficherJoueurActif();
      afficherJoueurs();
    });

    plateau.appendChild(carte);
  }
  
  centrerDerniereLigne();
}

function retourMenu(){
  if(!repriseClassiqueEnCours) oublierPartieClassique(); // partie abandonnée (« Modifier les joueurs »…)
  partieLancee = false;
  majTitrePJ(); // le titre suit le réglage Mode PJ, partie ou pas
  majMusique(); // retour aux menus : la musique remonte
  finUnOverlayAffiche = false;



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
  btnJouer.style.display = joueurs.length >= 2 ? "inline-block" : "none";
  menu.style.display = ""; // (la disposition vient du CSS : flex, ou grille sur téléphone)

  afficherJoueurs();
  // Sécurité : on réactive le scroll quoi qu'il arrive
  scrollLockCount = 0;
  document.body.classList.remove("no-scroll", "overlay-open");
  document.documentElement.classList.remove("overlay-ouvert");
  document.body.style.top = "";
  pauseEnCours = false;
  ecranPause.style.display = "none";
  majBoutonPause();
}

// (au doigt posé : le bouton disparaît aussitôt, le « click » qui joue le son des boutons ne tombait plus
// dessus => pas de son ; on le joue ici)
btnJouer.addEventListener("pointerdown", () => {
  jouerSon("bouton");
  sonBoutonJoueLe = Date.now();
  lancerPartie();
});

// #endregion

// #region Écran « Nouvelle partie »
/* ===== ÉCRAN « NOUVELLE PARTIE » (classique et en ligne) ===== */
const ecranNouvellePartie = document.getElementById("ecranNouvellePartie");

// Ouvert : pas de sifflet « À toi » ni de rappel « Bois de l'eau », et la musique baisse un peu
function ecranNouvellePartieOuvert(){
  return ecranNouvellePartie.style.display !== "none";
}

function fermerEcranNouvellePartie(){
  if(!ecranNouvellePartieOuvert()) return;
  ecranNouvellePartie.style.display = "none";
  relancerRappelClassique(); // (le compteur du sifflet repart de la fermeture)
  majMusique();
}

// Écrans fixes ouverts par-dessus la partie, sans défilement à eux : le doigt (ou la molette) faisait
// défiler le plateau derrière
["ecranNouvellePartie", "ecranConfirmerAccueil", "ecranConfirmerRetrait"].forEach((id) => {
  const ecran = document.getElementById(id);
  const bloquer = (e) => { if(e.cancelable) e.preventDefault(); };
  ecran.addEventListener("touchmove", bloquer, { passive: false });
  ecran.addEventListener("wheel", bloquer, { passive: false });
});

// "click" (et pas pointerdown) : évite que le relâchement du doigt active un bouton du nouvel écran
btnNouvellePartie.addEventListener("click", () => {
  // « Jouer » (au toucher) laisse sa place à « Nouvelle partie » sous le doigt : Android et PC
  // y envoient le clic du doigt relevé, qui ouvrirait cet écran juste après le lancement
  if(Date.now() - lancementPartieA < 700) return;
  ecranNouvellePartie.style.display = "";
  majMusique();
});

document.getElementById("btnRetourNouvellePartie").addEventListener("click", fermerEcranNouvellePartie);

// Courte annonce après « Rejouer (avec les mêmes joueurs) » : disparaît toute seule (~3,5 s)
// ou au tap. Hors des overlays du jeu : ne bloque rien, même en ligne.
function annoncerNouvellePartie(){
  const ancienne = document.getElementById("annonceNouvellePartie");
  if(ancienne) ancienne.remove();

  const annonce = document.createElement("div");
  annonce.id = "annonceNouvellePartie";
  annonce.innerHTML =
    tr('<div class="annonce-titre">NOUVELLE PARTIE</div>') +
    tr('<div class="annonce-texte">avec les mêmes joueurs</div>');

  const retirer = () => annonce.remove();
  annonce.addEventListener("pointerdown", retirer);
  annonce.addEventListener("animationend", (e) => {
    if(e.animationName === "annonceApparaitDisparait") retirer();
  });
  setTimeout(retirer, 4500); // sécurité (ex. animations désactivées)

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
  oublierPartieClassique(); // partie quittée exprès : plus rien à reprendre
  if(codePartieActuel) quitterPartie();
  reinitialiserEcransJeu();
  libererEcran();
  document.getElementById("enLigne").style.display = "none";
  document.getElementById("choixMode").style.display = "";
}

// ⌂ du bandeau (classique et en ligne, même place) et ⌂ de l'écran « Nouvelle partie » : on demande confirmation
// (en ligne : toujours, on quitterait la partie ; en classique : pendant une partie, et depuis « Nouvelle partie »)
const ecranConfirmerAccueil = document.getElementById("ecranConfirmerAccueil");
function demanderConfirmationAccueil(depuisNouvellePartie = false){
  const texte = ecranConfirmerAccueil.querySelector(".texteConfirmation");
  if(texte) texte.innerText = enLigneActif && partieLancee && joueurs.length <= 2 ? tr("Vous n'êtes que 2 : la partie sera supprimée, personne ne pourra y revenir.")
    : enLigneActif ? tr("Tu quittes la partie en ligne.")
    : depuisNouvellePartie ? tr("Tu quittes la partie.") : tr("La partie en cours sera perdue.");
  ecranConfirmerAccueil.style.display = "";
}
document.getElementById("btnAccueil").addEventListener("click", () => demanderConfirmationAccueil(true));
btnAccueilClassique.addEventListener("click", () => {
  if(!partieLancee && !enLigneActif){
    allerAccueil();
    return;
  }
  demanderConfirmationAccueil();
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


// #endregion
