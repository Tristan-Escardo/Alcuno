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

  const ecrans = [
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
  for(const [ecran, bouton] of ecrans){
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

// iPhone : pas de bouton retour, seulement le glissement depuis le bord de l'écran, que Safari permet
// dès qu'il y a des entrées dans l'historique. À l'accueil, on n'en garde donc aucune (avant, on pouvait
// « revenir en arrière » sur l'accueil autant de fois qu'on voulait, avec le message pour quitter, qui
// n'a pas de sens sur iPhone) ; ailleurs, on en remet un peu après chaque tap, une fois l'écran changé
// (Safari les accepte aussi en dehors d'un tap).
let minuteurRetourIOS = null;
function ajusterRetourIOS(){
  clearTimeout(minuteurRetourIOS);
  minuteurRetourIOS = setTimeout(() => {
    if(actionRetour()) preparerRetour();
    else retirerEntreesRetour();
  }, 400);
}

if(estIOS){
  ["pointerup", "click"].forEach((type) => document.addEventListener(type, ajusterRetourIOS, { capture: true, passive: true }));
} else {
  document.addEventListener("pointerdown", preparerRetour, { capture: true, passive: true });
}

window.addEventListener("popstate", () => {
  if(entreesRetour === 0) return;
  entreesRetour--;

  if(retourDansLAppli()){
    if(estIOS) ajusterRetourIOS();
    else if(navigator.userActivation && navigator.userActivation.isActive) preparerRetour();
    return;
  }

  // Écran d'accueil : on retire nos entrées, le prochain retour quitte l'appli (iPhone : rien, on ne
  // quitte pas une appli en revenant en arrière)
  retirerEntreesRetour();
  if(!estIOS) afficherToast("Appuie encore une fois sur retour pour quitter");
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
