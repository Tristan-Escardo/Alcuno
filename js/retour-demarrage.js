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

// Page plein écran (Réglages, Règles…) affichée et pas en train de partir : pendant son fondu de sortie,
// c'est déjà l'écran de dessous qui compte
function estOuverte(page){
  return estVisible(page) && !page.classList.contains("page-sortie");
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
  ["ecranPause", "btnReprendrePause"],
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

  if(estOuverte(ecranCredits)) return () => activer("btnFermerCredits");
  if(document.getElementById("aideAccueil")) return fermerAideAccueil;
  if(document.getElementById("ecranDiagnostic")) return () => document.getElementById("ecranDiagnostic").remove();
  if(document.getElementById("voletCarte")) return fermerVoletCarte;
  if(document.getElementById("voletPause")) return fermerVoletPause;
  if(estOuverte(ecranInstallation)) return () => activer("btnInstallationPlusTard");
  if(estOuverte(ecranRegles)) return () => activer("btnFermerRegles");
  if(estOuverte(ecranBug)) return () => activer("btnBugRetour"); // (par-dessus les Réglages)
  if(estOuverte(ecranReglages)) return () => activer("btnFermerReglages");

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
let retraitEnCoursIOS = false; // un de nos history.go(-n) n'a pas encore abouti
let minuteurRetraitIOS = null;
let ecranAvantTapIOS = null;  // tap en cours : écran affiché au moment du tap (son entrée est ajoutée)
let toucherEnCoursIOS = null; // doigt posé sur un élément qui peut changer d'écran : { ecran, x, y }
const ELEMENTS_NAVIGATION_IOS = 'button, a, [role="button"], #titreAccueil, header h1';
const DEPLACEMENT_MAX_TAP_IOS = 12; // px : au-delà, le doigt a glissé, ce n'est pas un tap
let minuteurTapIOS = null;

// Nom de l'écran affiché (pour savoir si un tap a changé d'écran)
function nomEcran(){
  if(estOuverte(ecranCredits)) return "credits";
  if(estOuverte(ecranInstallation)) return "installation";
  if(estOuverte(ecranRegles)) return "regles";
  if(estOuverte(ecranBug)) return "bug";
  if(estOuverte(ecranReglages)) return "reglages";
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

// On recule dans l'historique jusqu'à la profondeur de la pile, calculé depuis l'entrée réellement
// affichée (history.state), jamais d'après un compte de nos reculs : l'iPhone en ignore parfois un (pendant
// un glissement), et un compte décalé faisait ignorer les vrais glissements suivants, qui défilaient
// alors à vide sur l'accueil. Un seul recul à la fois. S'il n'aboutit pas (ignoré par l'iPhone), on
// n'insiste pas : l'entrée affichée prend la profondeur de la pile, pour que tout reste d'accord (avant :
// on réessayait sans fin, et plus aucune entrée n'était ajoutée => plus de glissement nulle part).
function rejoindrePileIOS(){
  const n = profondeurIOS() - pileIOS.length;
  if(n <= 0 || retraitEnCoursIOS || rechargementEnCours) return;
  retraitEnCoursIOS = true;
  clearTimeout(minuteurRetraitIOS);
  minuteurRetraitIOS = setTimeout(() => {
    retraitEnCoursIOS = false;
    if(profondeurIOS() > pileIOS.length){
      try { history.replaceState({ alcunoRetour: true, profondeur: pileIOS.length }, ""); } catch (err) {}
    }
    scellementEnCoursIOS = false;
    if(scellerApresReculIOS){ scellerApresReculIOS = false; scellerHistoriqueIOSPlusTard(); }
  }, 300);
  history.go(-n);
}

// sceller : un écran vient de se fermer (voir scellerHistoriqueIOS)
function retirerEntreesIOS(n, sceller = false){
  n = Math.min(n, pileIOS.length);
  if(n > 0){
    pileIOS.length -= n;
    if(sceller) scellerApresReculIOS = true;
  }
  rejoindrePileIOS();
  // (pas de recul lancé : l'entrée affichée était déjà la bonne, on scelle sans attendre son retour)
  if(scellerApresReculIOS && !retraitEnCoursIOS){ scellerApresReculIOS = false; scellerHistoriqueIOSPlusTard(); }
}

// Après un recul (« ← Retour », glissement retour), les entrées quittées restent « en avant » dans
// l'historique, avec la capture de l'écran qu'on vient de fermer. Vu au mouchard : un glissement depuis
// le bord droit remontrait ainsi les Réglages, et l'iPhone laissait cette capture affichée sur l'accueil
// (on touchait « ← Retour » des Réglages… et c'était le livre des Règles, dessous, qui s'ouvrait).
// On « scelle » donc l'historique une fois l'écran fermé : une entrée ajoutée (ce qui efface toutes
// celles d'après) puis retirée aussitôt. Il ne reste en avant qu'elle, avec la capture de l'écran
// affiché : glisser vers l'avant ne montre plus que l'écran où on est déjà.
let minuteurScellementIOS = null;
let scellementEnCoursIOS = false; // notre recul de scellement n'a pas encore abouti
let scellerApresReculIOS = false; // un écran vient de se fermer : scellement quand le recul aura abouti

// Au plus vite (vu au mouchard : en glissant vers l'avant moins d'une seconde après un retour, on tombait
// encore sur l'ancienne capture), mais une fois l'écran fermé disparu de l'affichage : la capture que
// l'iPhone prend au scellement doit être celle de l'écran affiché
function scellerHistoriqueIOSPlusTard(delai = 40){
  clearTimeout(minuteurScellementIOS);
  minuteurScellementIOS = setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(scellerHistoriqueIOS)), delai);
}

function scellerHistoriqueIOS(){
  // Un tap ou un recul en cours, appli en arrière-plan : un peu plus tard
  if(retraitEnCoursIOS || ecranAvantTapIOS !== null || toucherEnCoursIOS !== null ||
     document.visibilityState !== "visible"){ scellerHistoriqueIOSPlusTard(150); return; }
  if(rechargementEnCours || profondeurIOS() !== pileIOS.length) return;
  try { history.pushState({ alcunoRetour: true, profondeur: pileIOS.length + 1, scelle: true }, ""); } catch (err) { return; }
  scellementEnCoursIOS = true;
  rejoindrePileIOS();
}

// Filet de sécurité : après un glissement, l'iPhone garde sa capture affichée tant que la page ne se
// redessine pas (vu au mouchard : une capture des Réglages restée par-dessus l'accueil). Un point
// invisible change de teinte : la page se redessine.
let temoinRepeintIOS = null;
function forcerRepeintIOS(){
  if(!temoinRepeintIOS){
    temoinRepeintIOS = document.createElement("div");
    temoinRepeintIOS.setAttribute("aria-hidden", "true");
    temoinRepeintIOS.style.cssText = "position:fixed;left:0;bottom:0;width:2px;height:2px;pointer-events:none;z-index:2147483647";
    document.body.appendChild(temoinRepeintIOS);
  }
  temoinRepeintIOS.dataset.teinte = temoinRepeintIOS.dataset.teinte === "1" ? "2" : "1";
  temoinRepeintIOS.style.background = `rgba(0, 0, 0, 0.0${temoinRepeintIOS.dataset.teinte})`;
}

// Une entrée vient d'être ajoutée par un tap : elle a déjà effacé celles d'après, pas besoin de sceller
function annulerScellementIOS(){
  clearTimeout(minuteurScellementIOS);
  scellerApresReculIOS = false;
}

// Remet la pile d'accord avec l'écran affiché : accueil ou partie => plus aucune entrée ; écran déjà
// dans la pile (on y est revenu par un bouton, ou un écran s'est fermé tout seul) => on retire les
// entrées au-dessus de lui
function reconcilierPileIOS(){
  const ecran = nomEcran();
  if(ECRANS_RACINES.has(ecran)) return retirerEntreesIOS(pileIOS.length, true);
  const i = pileIOS.lastIndexOf(ecran);
  if(i >= 0) retirerEntreesIOS(pileIOS.length - i, true);
}

function toucherIOS(e){
  if(!e.isTrusted) return;
  // Une page qui part encore en fondu (« ← Retour » des Réglages tapé juste avant) : finie tout de suite.
  // Sinon, en tapant vite sur un autre bouton (Caster…), l'iPhone prenait sa capture avec les Réglages
  // encore à l'écran, et le glissement retour suivant remontrait les Réglages.
  document.querySelectorAll(".page-sortie").forEach(page => { if(page._finSortie) page._finSortie(); });
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
  // (un recul en cours, quelques centièmes de seconde : pas d'entrée cette fois)
  if(ecranAvantTapIOS === null && !retraitEnCoursIOS){
    try { history.pushState({ alcunoRetour: true, profondeur: pileIOS.length + 1 }, ""); } catch (err) { return; }
    annulerScellementIOS();
    ecranAvantTapIOS = avant;
    pileIOS.push(avant);
  }
  finTapIOS();
}

// Clic sur un élément qui change d'écran alors qu'aucune entrée n'a été ajoutée pour ce tap : l'iPhone
// corrige les taps un peu à côté d'un bouton (le doigt se pose sur le fond, le clic arrive au bouton).
// Sans entrée, le glissement retour ne marchait plus sur l'écran ouvert (vu au mouchard : Réglages
// ouverts par un tap au bord de l'icône). Le clic arrive avant que le bouton change d'écran : il est
// encore temps de l'ajouter.
function clicIOS(e){
  if(e.isTrusted && ecranAvantTapIOS === null && !retraitEnCoursIOS &&
     e.target && e.target.closest && e.target.closest(ELEMENTS_NAVIGATION_IOS)){
    try {
      history.pushState({ alcunoRetour: true, profondeur: pileIOS.length + 1 }, "");
      annulerScellementIOS();
      ecranAvantTapIOS = nomEcran();
      pileIOS.push(ecranAvantTapIOS);
    } catch (err) {}
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
  // Au démarrage la pile est vide : l'entrée affichée est la base (une profondeur gardée d'avant un
  // rechargement de l'appli la mettrait en désaccord avec la pile)
  if(profondeurIOS() > 0){
    try { history.replaceState({ alcunoRetour: true, profondeur: 0 }, ""); } catch (err) {}
  }
  document.addEventListener("pointerdown", toucherIOS, { capture: true, passive: true });
  document.addEventListener("pointerup", leverDoigtIOS, { capture: true, passive: true });
  // geste repris par l'iPhone (glissement depuis le bord, défilement) : pas un tap
  document.addEventListener("pointercancel", () => { toucherEnCoursIOS = null; }, { capture: true, passive: true });
  document.addEventListener("click", clicIOS, { capture: true, passive: true });
} else {
  document.addEventListener("pointerdown", preparerRetour, { capture: true, passive: true });
}

// Rechargement de l'appli (mise à jour, changement de thème…) : on revient d'abord à la première entrée
// de l'historique, puis on recharge. Sinon le rechargement ne remplaçait que l'entrée affichée (celle
// ajoutée par le tap sur « Mettre à jour », par ex.) : les entrées d'avant restaient derrière, et un
// glissement retour sur l'accueil y retournait => page vierge le temps de recharger l'ancienne page.
let rechargementEnCours = false;
function rechargerPage(adresse){
  const recharger = () => {
    if(recharger.fait) return;
    recharger.fait = true;
    if(adresse) location.replace(adresse);
    else location.reload();
  };
  const n = estIOS ? profondeurIOS() : entreesRetour;
  if(n <= 0) return recharger();
  rechargementEnCours = true;
  window.addEventListener("popstate", recharger, { once: true });
  setTimeout(recharger, 500); // (recul ignoré par le téléphone : on recharge quand même)
  history.go(-n);
}

window.addEventListener("popstate", () => {
  if(rechargementEnCours) return; // (voir rechargerPage : la page va être rechargée)
  if(estIOS){
    retraitEnCoursIOS = false;
    clearTimeout(minuteurRetraitIOS);
    forcerRepeintIOS();
    requestAnimationFrame(forcerRepeintIOS);
    const profondeur = profondeurIOS();
    // Plus loin que la pile : en avant sur une ancienne entrée (glissement depuis le bord droit après un
    // retour : nos entrées retirées restent « en avant » dans l'historique), ou recul pas encore fini :
    // on revient tout de suite à la bonne entrée (sinon on glissait sans fin sur l'accueil)
    if(profondeur > pileIOS.length){ rejoindrePileIOS(); return; }
    // À la profondeur de la pile : c'est notre recul qui vient d'aboutir (puis, si un écran vient de se
    // fermer, on scelle l'historique ; et rien de plus si c'était justement le recul du scellement)
    if(profondeur === pileIOS.length){
      if(scellementEnCoursIOS) scellementEnCoursIOS = false;
      else if(scellerApresReculIOS){ scellerApresReculIOS = false; scellerHistoriqueIOSPlusTard(); }
      return;
    }
    // Moins loin : un vrai glissement retour
    pileIOS.length = profondeur;
    const action = actionRetour();
    if(action) action();
    // L'iPhone a déjà fait glisser l'écran : celui qu'on quitte disparaît tout de suite (pas de 2e
    // animation), et l'historique est scellé sans attendre (l'écran quitté y reste en avant)
    document.querySelectorAll(".page-sortie").forEach(page => { if(page._finSortie) page._finSortie(); });
    setTimeout(reconcilierPileIOS, 400);
    scellerHistoriqueIOSPlusTard();
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
  if (!code) {
    // Sinon : partie classique interrompue (appli fermée en pleine partie) => « Reprendre ? »
    if (!document.documentElement.classList.contains("mode-tele")) proposerRepriseClassique();
    return;
  }
  document.getElementById("codeRejoindre").value = code;
  document.getElementById("btnModeEnLigne").click();
  document.getElementById("btnRejoindrePartie").click();
})();
