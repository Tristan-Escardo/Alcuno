// =============================================================================================
// ALCUNO : Mouchard (journal détaillé pour comprendre un bug sur un vrai téléphone)
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Mouchard
// Caché : 5 taps rapides sur « Alcuno — version … » (Réglages, tout en bas) l'activent ou le coupent.
// Tant qu'il est actif, il note ce qui se passe vraiment sur le téléphone : doigts (touch / pointer /
// click et ce qu'ils touchent), défilement, écrans et overlays, sons et état du moteur de son, cartes
// tirées, appli quittée / reprise, erreurs. Le journal (400 dernières lignes) est gardé dans le téléphone
// (il survit à un rechargement) et part avec « Copier le diagnostic » et « Signaler un bug ».
const CLE_MOUCHARD = "alcuno_mouchard";
const CLE_JOURNAL_MOUCHARD = "alcuno_mouchard_journal";
const MAX_LIGNES_MOUCHARD = 400;

let mouchardActif = false;
try { mouchardActif = localStorage.getItem(CLE_MOUCHARD) === "1"; } catch (e) {}
let lignesMouchard = [];
try { lignesMouchard = JSON.parse(localStorage.getItem(CLE_JOURNAL_MOUCHARD) || "[]"); } catch (e) {}
if (!Array.isArray(lignesMouchard)) lignesMouchard = [];

let sauvegardeMouchardPrevue = null;
function sauverMouchard(){
  clearTimeout(sauvegardeMouchardPrevue);
  sauvegardeMouchardPrevue = null;
  try { localStorage.setItem(CLE_JOURNAL_MOUCHARD, JSON.stringify(lignesMouchard)); } catch (e) {}
}

function noter(texte){
  if (!mouchardActif) return;
  const d = new Date();
  const heure = d.toLocaleTimeString("fr-FR") + "." + String(d.getMilliseconds()).padStart(3, "0");
  lignesMouchard.push(`${heure} ${texte}`);
  if (lignesMouchard.length > MAX_LIGNES_MOUCHARD) lignesMouchard.splice(0, lignesMouchard.length - MAX_LIGNES_MOUCHARD);
  if (!sauvegardeMouchardPrevue) sauvegardeMouchardPrevue = setTimeout(sauverMouchard, 2000);
}

// Lignes pour le diagnostic (js/reglages.js)
function journalMouchard(){
  if (!mouchardActif && !lignesMouchard.length) return [];
  return [`--- Mouchard (${mouchardActif ? "actif" : "coupé"}, ${lignesMouchard.length} lignes) ---`, ...lignesMouchard];
}

// « button#jouer "Jouer" », « div.Carte.retournee »…
function decrireElement(el){
  if (!el || !el.tagName) return String(el);
  let texte = el.tagName.toLowerCase();
  if (el.id) texte += "#" + el.id;
  const classes = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3) : [];
  if (classes.length) texte += "." + classes.join(".");
  if (el.tagName === "BUTTON") texte += ` "${(el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 24)}"`;
  return texte;
}
const rond = (n) => Math.round(n);

// ===== Activation : 5 taps sur la version =====
const ligneVersion = document.getElementById("versionJeu");
function majLigneVersionMouchard(){
  ligneVersion.innerText = "Alcuno — version " + VERSION_AFFICHEE + (mouchardActif ? " · mouchard actif 🔴" : "");
}
let tapsVersion = [];
// (doigt levé et pas « click » : des taps rapides sur un texte ne donnent pas tous un click)
ligneVersion.addEventListener("pointerup", () => {
  const maintenant = Date.now();
  tapsVersion = tapsVersion.filter((t) => maintenant - t < 3000).concat(maintenant);
  if (tapsVersion.length < 5) return;
  tapsVersion = [];
  mouchardActif = !mouchardActif;
  try { localStorage.setItem(CLE_MOUCHARD, mouchardActif ? "1" : "0"); } catch (e) {}
  if (mouchardActif) {
    lignesMouchard = [];
    noter(`=== mouchard activé · ${VERSION_AFFICHEE} · ${navigator.userAgent}`);
    noter(`écran ${innerWidth}x${innerHeight} · appli installée : ${estEnAppli}`);
    afficherToast("Mouchard activé : reproduis le bug, puis « Copier le diagnostic »", 4000);
  } else {
    afficherToast("Mouchard coupé", 2000);
  }
  sauverMouchard();
  majLigneVersionMouchard();
});
majLigneVersionMouchard();
if (mouchardActif) noter(`--- page chargée · ${VERSION_AFFICHEE} · appli installée : ${estEnAppli} · écran ${innerWidth}x${innerHeight}`);

// ===== Doigts et clics =====
["touchstart", "touchend", "touchcancel"].forEach((type) => {
  document.addEventListener(type, (e) => {
    if (!mouchardActif) return;
    const t = e.changedTouches && e.changedTouches[0];
    noter(`${type} ${decrireElement(e.target)} (${t ? rond(t.clientX) + "," + rond(t.clientY) : "?"}) scrollY=${rond(scrollY)}`);
  }, { capture: true, passive: true });
});
["pointerdown", "pointerup", "pointercancel"].forEach((type) => {
  document.addEventListener(type, (e) => {
    if (!mouchardActif) return;
    noter(`${type} ${e.pointerType} ${decrireElement(e.target)} (${rond(e.clientX)},${rond(e.clientY)})`);
  }, { capture: true, passive: true });
});
document.addEventListener("click", (e) => {
  if (!mouchardActif) return;
  noter(`click ${decrireElement(e.target)}${e.isTrusted ? "" : " (simulé)"}`);
}, { capture: true, passive: true });

// ===== Défilement : début et fin (pas chaque image), et les défilements demandés par le jeu =====
let defilementDepuis = null, defilementDebutY = 0, finDefilement = null;
window.addEventListener("scroll", () => {
  if (!mouchardActif) return;
  if (defilementDepuis === null) {
    defilementDepuis = Date.now();
    defilementDebutY = scrollY;
    noter(`défilement : début y=${rond(scrollY)}`);
  }
  clearTimeout(finDefilement);
  finDefilement = setTimeout(() => {
    noter(`défilement : fin y=${rond(scrollY)} (depuis ${rond(defilementDebutY)}, ${Date.now() - defilementDepuis} ms)`);
    defilementDepuis = null;
  }, 200);
}, { passive: true });
const scrollToOriginal = window.scrollTo.bind(window);
let scrollToNotes = 0, scrollToSeconde = 0;
window.scrollTo = function(...args){
  if (mouchardActif) {
    const seconde = Math.floor(Date.now() / 1000);
    if (seconde !== scrollToSeconde) { scrollToSeconde = seconde; scrollToNotes = 0; }
    if (++scrollToNotes <= 5) noter(`scrollTo(${JSON.stringify(args)}) depuis y=${rond(scrollY)}`);
  }
  return scrollToOriginal(...args);
};

// ===== Historique (glissement retour de l'iPhone, bouton retour d'Android) =====
["pushState", "replaceState", "go", "back"].forEach((nom) => {
  const original = history[nom].bind(history);
  history[nom] = function(...args){
    if (mouchardActif) noter(`history.${nom}(${nom === "go" ? args[0] : JSON.stringify(args[0])}) · état ${JSON.stringify(history.state)}`);
    return original(...args);
  };
});
window.addEventListener("popstate", () => noter(`popstate (glissement / retour) · état ${JSON.stringify(history.state)}`));

// ===== Appli quittée / reprise, taille de l'écran, clavier =====
document.addEventListener("visibilitychange", () => {
  noter(`appli ${document.visibilityState === "visible" ? "reprise" : "quittée"}`);
  if (document.visibilityState !== "visible") sauverMouchard();
});
window.addEventListener("pagehide", () => { noter("pagehide"); sauverMouchard(); });
window.addEventListener("pageshow", (e) => noter(`pageshow${e.persisted ? " (depuis le cache)" : ""}`));
window.addEventListener("resize", () => noter(`resize ${innerWidth}x${innerHeight}`));
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () =>
    noter(`zone visible ${rond(visualViewport.width)}x${rond(visualViewport.height)} (clavier ?)`));
}

// ===== Fonctions du jeu : écrans, overlays, sons, cartes, messages, erreurs =====
// (fonctions des fichiers d'avant : on les enveloppe, le jeu appelle la version qui note)
function envelopper(nom, decrire){
  const original = window[nom];
  if (typeof original !== "function") return;
  window[nom] = function(...args){
    if (mouchardActif) { try { noter(decrire(...args)); } catch (e) {} }
    return original.apply(this, args);
  };
}
envelopper("ouvrirPage", (page) => `écran ouvert : ${page && page.id}`);
envelopper("fermerPage", (page) => `écran fermé : ${page && page.id}`);
envelopper("lockScroll", () => `overlay : défilement bloqué (y=${rond(scrollY)}, niveau ${scrollLockCount + 1})`);
envelopper("unlockScroll", () => `overlay : défilement débloqué (niveau ${scrollLockCount})`);
envelopper("appliquerRegle", (carte, joueur) => `carte tirée : ${carte} par ${joueurs[joueur] || joueur}`);
envelopper("lancerPartie", () => `partie lancée (${joueurs.length} joueurs, ${enLigneActif ? "en ligne" : "classique"})`);
envelopper("afficherToast", (texte) => `toast : ${texte}`);
envelopper("afficherNotificationHaut", (icone, titre) => `notification : ${titre}`);
envelopper("rechargerPage", (adresse) => `rechargement de la page ${adresse || ""}`);
envelopper("noterErreur", (texte) => `ERREUR ${String(texte).slice(0, 200)}`);
envelopper("jouerSon", (nom) => {
  const ctx = contexteSon;
  return `son « ${nom} » · moteur ${ctx ? ctx.state : "absent"} · ${sonsCharges[nom] === undefined ? "pas encore chargé" : sonsCharges[nom] ? "chargé" : "fichier absent"}` +
    ` · sons ${caseSons.checked ? "on" : "off"} ${volumeSons} %`;
});

// Moteur de son : nouveau, ou changement d'état (suspendu, interrompu, fermé…)
let contexteSuivi = null, etatSuivi = null;
setInterval(() => {
  if (!mouchardActif) return;
  if (contexteSon !== contexteSuivi) {
    contexteSuivi = contexteSon;
    etatSuivi = contexteSon ? contexteSon.state : null;
    noter(`moteur de son : ${contexteSon ? "nouveau (" + contexteSon.state + ")" : "aucun"}`);
  } else if (contexteSon && contexteSon.state !== etatSuivi) {
    noter(`moteur de son : ${etatSuivi} -> ${contexteSon.state}`);
    etatSuivi = contexteSon.state;
  }
}, 500);
// #endregion
