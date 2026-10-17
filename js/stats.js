// =============================================================================================
// ALCUNO : Statistiques anonymes (lues par la page privée stats.html)
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Statistiques anonymes
// Rien de personnel : un identifiant tiré au hasard et gardé dans ce téléphone (pour compter les
// visiteurs différents), le type d'appareil, le thème et la version du jeu. Pas de pseudo, pas d'IP.
// Dans Firebase :
// - stats/jours/AAAA-MM-JJ : visites, installs, parties, partiesEnLigne (compteurs) et visiteurs/{id} ;
// - stats/appareils/{id} : os, thème, version, dernière visite (répartitions de la page stats) ;
// - presence/{id} : ce que fait ce téléphone en ce moment (menu, classique, enligne, tele), retiré
//   par Firebase dès que le téléphone se déconnecte (« en ce moment » de la page stats).
const CLE_ID_STATS = "alcuno_id_stats";
const CLE_INSTALL_COMPTEE = "alcuno_install_comptee";
const PRESENCE_TOUTES_LES = 60 * 1000; // la page stats ignore une présence pas rafraîchie depuis 3 min

let idStats = null;
try { idStats = localStorage.getItem(CLE_ID_STATS); } catch (e) {}
if (!idStats || !/^[a-z0-9]{12}$/.test(idStats)) {
  idStats = Array.from({ length: 12 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join("");
  try { localStorage.setItem(CLE_ID_STATS, idStats); } catch (e) {}
}

// Date du jour du téléphone (heure locale), « AAAA-MM-JJ »
function jourStats(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function systemeStats(){
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "ordi";
}

function refStats(chemin){ return window.fbRef(window.firebaseDB, chemin); }

// Compteur du jour + 1 (transaction : deux téléphones au même instant comptent tous les deux)
function compterStats(nom){
  attendreFirebase(() => {
    window.fbRunTransaction(refStats(`stats/jours/${jourStats()}/${nom}`), (n) => (n || 0) + 1).catch(() => {});
  });
}

function noterAppareilStats(){
  attendreFirebase(() => {
    window.fbSet(refStats(`stats/appareils/${idStats}`), {
      os: systemeStats(),
      theme: document.documentElement.dataset.theme || "bordeaux",
      version: VERSION_AFFICHEE,
      vu: window.fbServerTimestamp()
    }).catch(() => {});
  });
}

// Partie lancée (classique : ce téléphone ; en ligne : seulement l'hôte, une fois par manche)
function noterPartieStats(enLigne){
  if (estPageTele) return;
  compterStats(enLigne ? "partiesEnLigne" : "parties");
}

// Installation : premier lancement depuis l'icône de l'écran d'accueil (iPhone et Android), ou
// l'événement d'installation de Chrome (Android). Une seule fois par téléphone.
function noterInstallationStats(){
  try {
    if (localStorage.getItem(CLE_INSTALL_COMPTEE)) return;
    localStorage.setItem(CLE_INSTALL_COMPTEE, "1");
  } catch (e) { return; }
  compterStats("installs");
}

// ===== Présence (en ce moment) =====
let etatPresence = null;
let presencePosee = false;

function etatActuelPresence(){
  if (estPageTele) {
    const jeu = document.querySelector("#ecranTele .tele-jeu");
    return jeu && !jeu.hidden ? "tele" : null; // télé en attente d'un téléphone : pas comptée
  }
  if (partieLancee) return enLigneActif ? "enligne" : "classique";
  return "menu";
}

function majPresence(force = false){
  if (!window.firebaseDB) return;
  const etat = document.visibilityState === "hidden" ? null : etatActuelPresence();
  const ref = refStats(`presence/${idStats}`);
  if (!etat) {
    if (presencePosee) window.fbRemove(ref).catch(() => {});
    presencePosee = false;
    etatPresence = null;
    return;
  }
  if (!force && presencePosee && etat === etatPresence) return;
  etatPresence = etat;
  presencePosee = true;
  window.fbOnDisconnect(ref).remove().catch(() => {});
  window.fbSet(ref, { etat, maj: window.fbServerTimestamp() }).catch(() => {});
}

// ===== Au lancement =====
if (!estPageTele) {
  compterStats("visites");
  attendreFirebase(() => {
    window.fbSet(refStats(`stats/jours/${jourStats()}/visiteurs/${idStats}`), true).catch(() => {});
  });
  noterAppareilStats();
  const enAppli = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (enAppli) noterInstallationStats();
  window.addEventListener("appinstalled", noterInstallationStats);
}

attendreFirebase(() => {
  majPresence(true);
  setInterval(() => majPresence(), 3000);             // changement d'écran (menu, partie…)
  setInterval(() => majPresence(true), PRESENCE_TOUTES_LES); // « toujours là »
  document.addEventListener("visibilitychange", () => majPresence(true));
});
// #endregion
