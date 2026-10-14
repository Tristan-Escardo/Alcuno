// =============================================================================================
// ALCUNO : Bouton retour du téléphone et démarrage du jeu
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Bouton retour du téléphone et démarrage du jeu
/* ===== BOUTON RETOUR DU TÉLÉPHONE (Android) ET DU NAVIGATEUR (Safari, PC) ===== */
// Le téléphone ne prévient la page que si elle a ajouté des entrées dans l'historique.
// On en garde quelques-unes d'avance, ajoutées pendant un tap (sinon Chrome les saute),
// et chaque retour fait la même chose que le bouton « Retour » de l'écran affiché.
const NB_ENTREES_RETOUR = 3;
let entreesRetour = 0;

function estVisible(el){
  return !!el && el.getClientRects().length > 0;
}

function taper(el){
  el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
}

// Certains boutons réagissent au tap (pointerdown), d'autres au clic
function activer(id){
  const bouton = document.getElementById(id);
  taper(bouton);
  bouton.click();
}

// Écrans avec un bouton « Retour » (ou équivalent) : [écran, bouton]
const ECRANS_RETOUR = [
  ["ecranScanner", "btnFermerScanner"],
  ["ecranCaster", "btnCasterFermer"],
  ["ecranConfirmerHote", "btnConfirmerHoteNon"],
  ["ecranConfirmerRetrait", "btnConfirmerRetraitNon"],
  ["ecranConfirmerAccueil", "btnConfirmerAccueilNon"],
  ["ecranChoixPseudo", "btnChoixPseudoAnnuler"],
  ["ecranNouvellePartie", "btnRetourNouvellePartie"],
  ["suppression", "termineSuppression"],
  ["enLigneRevenir", "btnRetourRevenir"],
  ["enLigneCreer", "btnRetourCreer"],
  ["enLigneRejoindre", "btnRetourRejoindre"],
  ["salleAttente", "btnQuitterSalle"],
  ["enLigneChoix", "btnRetourChoixMode"]
];

// Ce que fait le retour sur l'écran affiché (sans le faire), ou null sur l'écran d'accueil
function actionRetour(){
  if(estVisible(document.getElementById("ecranRattrapage"))) return () => {};

  const annonce = document.getElementById("annonceNouvellePartie");
  if(annonce) return () => taper(annonce);

  if(estVisible(ecranCredits)) return () => activer("btnFermerCredits");
  if(estVisible(ecranInstallation)) return () => activer("btnInstallationPlusTard");
  if(estVisible(ecranRegles)) return () => activer("btnFermerRegles");
  if(estVisible(ecranReglages)) return () => activer("btnFermerReglages");

  // Overlays du jeu : le plus récent se ferme comme au tap (ceux où il faut choisir ne bougent pas),
  // sauf le +4 où « Retour » enlève la dernière gorgée distribuée
  const overlays = Array.from(document.querySelectorAll('[id^="overlay"]')).filter(estVisible);
  if(overlays.length){
    const dessus = overlays[overlays.length - 1];
    const btnRetour = Array.from(dessus.querySelectorAll("button"))
      .find(b => b.innerText.trim() === "Retour");
    return () => {
      if(!btnRetour) taper(dessus);
      else if(!btnRetour.disabled) taper(btnRetour);
    };
  }

  for(const [ecran, bouton] of ECRANS_RETOUR){
    if(estVisible(document.getElementById(ecran))) return () => activer(bouton);
  }

  // Plateau (classique ou en ligne) : même chose que ⌂, avec confirmation si une partie est en cours
  if(estVisible(menu) || estVisible(document.getElementById("jeu"))){
    return () => {
      if(partieLancee) ecranConfirmerAccueil.style.display = "";
      else allerAccueil();
    };
  }

  return null;
}

// true = retour fait dans l'appli ; false = déjà sur l'écran d'accueil
function retourDansLAppli(){
  const action = actionRetour();
  if(!action) return false;
  action();
  return true;
}

function preparerRetour(e){
  if(e && !e.isTrusted) return;
  while(entreesRetour < NB_ENTREES_RETOUR){
    history.pushState({ alcunoRetour: true }, "");
    entreesRetour++;
  }
}

// On retire nos entrées de l'historique (le retour suivant n'est plus pour l'appli)
function retirerEntreesRetour(){
  if(entreesRetour === 0) return;
  const n = entreesRetour;
  entreesRetour = 0;
  history.go(-n);
}

// ===== iPhone : glissement depuis le bord de l'écran =====
// Pas de bouton retour sur iPhone, seulement ce glissement, que Safari permet dès qu'il y a des entrées
// dans l'historique. Pendant le glissement, il montre une capture de l'écran tel qu'il était quand
// l'entrée suivante a été ajoutée. On garde donc une entrée par écran ouvert (une pile), ajoutée au
// moment du tap qui l'ouvre, quand le doigt se lève (l'écran d'avant est encore affiché : c'est lui que
// montrera le glissement ; les boutons changent d'écran au clic, juste après), et retirée si le tap n'a
// pas changé d'écran. Seulement pour un vrai tap (doigt presque immobile) sur un élément qui peut
// changer d'écran (bouton…) : un glissement (depuis le bord, ou rapide, que l'iPhone ne prend pas
// toujours pour le geste retour) ou un toucher dans le vide ajoutaient une entrée, que le glissement
// suivant utilisait : en enchaînant les glissements, on glissait sans fin sur l'accueil.
// L'accueil et la partie en cours n'en ont aucune : glisser n'y fait rien (⌂ pour quitter une partie).
// (Avant : des entrées ajoutées après le tap, donc des captures du mauvais écran : en glissant depuis
// les réglages, on revoyait les réglages, puis on revenait à l'accueil.)
const ECRANS_RACINES = new Set(["accueil", "jeu"]);
let pileIOS = [];             // écran montré par chaque entrée, de la plus ancienne à la plus récente
let retraitsIOS = 0;          // nos propres history.go(-n) en cours (leur popstate n'est pas un retour)
let ecranAvantTapIOS = null;  // tap en cours : écran affiché au moment du tap (son entrée est ajoutée)
let toucherEnCoursIOS = null; // doigt posé sur un élément qui peut changer d'écran : { ecran, x, y }
const ELEMENTS_NAVIGATION_IOS = 'button, a, [role="button"], #titreAccueil, header h1';
const DEPLACEMENT_MAX_TAP_IOS = 12; // px : au-delà, le doigt a glissé, ce n'est pas un tap
let minuteurTapIOS = null;

// Nom de l'écran affiché (pour savoir si un tap a changé d'écran)
function nomEcran(){
  if(estVisible(ecranCredits)) return "credits";
  if(estVisible(ecranInstallation)) return "installation";
  if(estVisible(ecranRegles)) return "regles";
  if(estVisible(ecranReglages)) return "reglages";
  for(const [ecran] of ECRANS_RETOUR){
    if(estVisible(document.getElementById(ecran))) return ecran;
  }
  // Partie en cours (plateau, overlays des règles, annonces…) : un seul écran
  if(partieLancee || estVisible(document.getElementById("ecranRattrapage")) ||
     document.getElementById("annonceNouvellePartie") ||
     Array.from(document.querySelectorAll('[id^="overlay"]')).some(estVisible)) return "jeu";
  if(estVisible(menu) || estVisible(document.getElementById("jeu"))) return "menu";
  return "accueil";
}

// Profondeur de l'entrée d'historique actuelle (0 : celle de l'ouverture de l'appli)
function profondeurIOS(){
  return (history.state && history.state.profondeur) || 0;
}

function retirerEntreesIOS(n){
  n = Math.min(n, pileIOS.length, profondeurIOS()); // (jamais plus loin que l'entrée de départ)
  if(n <= 0) return;
  pileIOS.length -= n;
  retraitsIOS++;
  history.go(-n);
}

// Remet la pile d'accord avec l'écran affiché : accueil ou partie => plus aucune entrée ; écran déjà
// dans la pile (on y est revenu par un bouton, ou un écran s'est fermé tout seul) => on retire les
// entrées au-dessus de lui
function reconcilierPileIOS(){
  const ecran = nomEcran();
  if(ECRANS_RACINES.has(ecran)) return retirerEntreesIOS(pileIOS.length);
  const i = pileIOS.lastIndexOf(ecran);
  if(i >= 0) retirerEntreesIOS(pileIOS.length - i);
}

function toucherIOS(e){
  if(!e.isTrusted) return;
  const surNavigation = e.target && e.target.closest && e.target.closest(ELEMENTS_NAVIGATION_IOS);
  toucherEnCoursIOS = surNavigation ? { ecran: nomEcran(), x: e.clientX, y: e.clientY } : null;
}

// Doigt levé (un vrai tap) : entrée ajoutée maintenant, avant le clic qui change d'écran
function leverDoigtIOS(e){
  if(!e.isTrusted || toucherEnCoursIOS === null) return;
  const toucher = toucherEnCoursIOS;
  toucherEnCoursIOS = null;
  if(Math.hypot(e.clientX - toucher.x, e.clientY - toucher.y) > DEPLACEMENT_MAX_TAP_IOS) return; // a glissé
  const avant = toucher.ecran;
  if(ecranAvantTapIOS === null){
    try { history.pushState({ alcunoRetour: true, profondeur: pileIOS.length + 1 }, ""); } catch (err) { return; }
    ecranAvantTapIOS = avant;
    pileIOS.push(avant);
  }
  finTapIOS();
}

function finTapIOS(){
  clearTimeout(minuteurTapIOS);
  minuteurTapIOS = setTimeout(() => {
    const avant = ecranAvantTapIOS;
    ecranAvantTapIOS = null;
    if(avant !== null && nomEcran() === avant) retirerEntreesIOS(1); // le tap n'a pas changé d'écran
    else reconcilierPileIOS();
  }, 400);
}

if(estIOS){
  document.addEventListener("pointerdown", toucherIOS, { capture: true, passive: true });
  document.addEventListener("pointerup", leverDoigtIOS, { capture: true, passive: true });
  // geste repris par l'iPhone (glissement depuis le bord, défilement) : pas un tap
  document.addEventListener("pointercancel", () => { toucherEnCoursIOS = null; }, { capture: true, passive: true });
  document.addEventListener("click", finTapIOS, { capture: true, passive: true });
} else {
  document.addEventListener("pointerdown", preparerRetour, { capture: true, passive: true });
}

window.addEventListener("popstate", () => {
  if(estIOS){
    if(retraitsIOS > 0){ retraitsIOS--; return; }
    // En avant, sur une ancienne entrée (glissement depuis le bord droit après un retour : nos entrées
    // retirées restent « en avant » dans l'historique) : on y revient tout de suite, sinon on pouvait
    // glisser en avant puis en arrière sans fin sur l'accueil
    const profondeur = profondeurIOS();
    if(profondeur > pileIOS.length){
      retraitsIOS++;
      history.go(pileIOS.length - profondeur);
      return;
    }
    if(pileIOS.length === 0) return;
    pileIOS.length = Math.min(pileIOS.length - 1, profondeur);
    const action = actionRetour();
    if(action) action();
    setTimeout(reconcilierPileIOS, 400);
    return;
  }

  if(entreesRetour === 0) return;
  entreesRetour--;

  if(retourDansLAppli()){
    if(navigator.userActivation && navigator.userActivation.isActive) preparerRetour();
    return;
  }

  // Écran d'accueil : on retire nos entrées, le prochain retour quitte l'appli
  retirerEntreesRetour();
  afficherToast("Appuie encore une fois sur retour pour quitter");
});

/* ===== INIT ===== */
window.addEventListener("scroll", repositionnerStickyJoueurActif, { passive: true });
window.addEventListener("resize", () => { hautMinSticky = null; repositionnerStickyJoueurActif(); });

if(window.visualViewport){
  window.visualViewport.addEventListener("resize", repositionnerStickyJoueurActif);
  window.visualViewport.addEventListener("scroll", repositionnerStickyJoueurActif);
}

creerUIJoueurActifSticky();
majTitrePJ(); // « ALCUNO PJ » si le Mode PJ est déjà activé
afficherJoueurs();
majStickyJoueurActif();
window.addEventListener("resize", () => {
  centrerDerniereLigne();
});

// Tout le jeu est chargé : les taps sont de nouveau pris en compte (voir « chargement » dans index.html)
document.documentElement.classList.remove("chargement");
try { sessionStorage.removeItem("alcuno_rechargement_auto"); } catch (e) {} // (voir echecChargementJeu dans index.html)
// #endregion

// (après le démarrage complet) Invitation par QR code : on ouvre directement « Rejoindre une partie »
// avec le code rempli (lien scanné, ou appli lancée juste après l'avoir installée depuis ce lien)
(function(){
  const code = lireCodeInvitation(estEnAppli);
  if (!code) return;
  document.getElementById("codeRejoindre").value = code;
  document.getElementById("btnModeEnLigne").click();
  document.getElementById("btnRejoindrePartie").click();
})();
