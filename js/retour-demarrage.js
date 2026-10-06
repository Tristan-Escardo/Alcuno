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

// true = retour fait dans l'appli ; false = déjà sur l'écran d'accueil
function retourDansLAppli(){
  if(estVisible(document.getElementById("ecranRattrapage"))) return true;

  const annonce = document.getElementById("annonceNouvellePartie");
  if(annonce){ taper(annonce); return true; }

  if(estVisible(ecranCredits)){ activer("btnFermerCredits"); return true; }
  if(estVisible(ecranInstallation)){ activer("btnInstallationPlusTard"); return true; }
  if(estVisible(ecranRegles)){ activer("btnFermerRegles"); return true; }
  if(estVisible(ecranReglages)){ activer("btnFermerReglages"); return true; }

  // Overlays du jeu : le plus récent se ferme comme au tap (ceux où il faut choisir ne bougent pas),
  // sauf le +4 où « Retour » enlève la dernière gorgée distribuée
  const overlays = Array.from(document.querySelectorAll('[id^="overlay"]')).filter(estVisible);
  if(overlays.length){
    const dessus = overlays[overlays.length - 1];
    const btnRetour = Array.from(dessus.querySelectorAll("button"))
      .find(b => b.innerText.trim() === "Retour");
    if(!btnRetour) taper(dessus);
    else if(!btnRetour.disabled) taper(btnRetour);
    return true;
  }

  const ecrans = [
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
    if(estVisible(document.getElementById(ecran))){
      activer(bouton);
      return true;
    }
  }

  // Plateau (classique ou en ligne) : même chose que ⌂, avec confirmation si une partie est en cours
  if(estVisible(menu) || estVisible(document.getElementById("jeu"))){
    if(partieLancee) ecranConfirmerAccueil.style.display = "";
    else allerAccueil();
    return true;
  }

  return false;
}

function preparerRetour(e){
  if(e && !e.isTrusted) return;
  while(entreesRetour < NB_ENTREES_RETOUR){
    history.pushState({ alcunoRetour: true }, "");
    entreesRetour++;
  }
}

document.addEventListener("pointerdown", preparerRetour, { capture: true, passive: true });

window.addEventListener("popstate", () => {
  if(entreesRetour === 0) return;
  entreesRetour--;

  if(retourDansLAppli()){
    if(navigator.userActivation && navigator.userActivation.isActive) preparerRetour();
    return;
  }

  // Écran d'accueil : on retire nos entrées, le prochain retour quitte l'appli
  if(entreesRetour > 0){
    const n = entreesRetour;
    entreesRetour = 0;
    history.go(-n);
  }
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
