// =============================================================================================
// ALCUNO : Statistiques anonymes (lues par la page privée stats.html)
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Statistiques anonymes
// Rien de personnel : un identifiant tiré au hasard et gardé dans ce téléphone (pour compter les
// visiteurs différents), le type d'appareil, le thème et la version du jeu. Pas de pseudo, pas d'IP.
// Dans Firebase :
// - stats/jours/AAAA-MM-JJ : visites, installs, parties, partiesEnLigne, doreesEnJeu, doreesTirees
//   (compteurs), heures/{HH} (parties
//   lancées à chaque heure) et visiteurs/{id} ;
// - stats/appareils/{id} : os, thème, version, dernière visite (répartitions de la page stats), et la dernière lecture des
//   réglages à distance : confVu (quand) et confV (quelle modification) : voyant de l'onglet Pilotage de stats.html ;
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
    // (update et non set : la fiche garde confVu / confV, écrits par js/config-distante.js)
    window.fbUpdate(refStats(`stats/appareils/${idStats}`), {
      os: systemeStats(),
      theme: document.documentElement.dataset.theme || "bordeaux",
      version: VERSION_AFFICHEE,
      vu: window.fbServerTimestamp()
    }).catch(() => {});
  });
}

// Partie lancée (classique : ce téléphone ; en ligne : seulement l'hôte, une fois par manche), et son
// heure (heure du téléphone, « 00 » à « 23 » : « À quelle heure on joue » de la page stats)
function noterPartieStats(enLigne){
  if (estPageTele) return;
  compterStats(enLigne ? "partiesEnLigne" : "parties");
  compterStats(`heures/${String(new Date().getHours()).padStart(2, "0")}`);
}

// Carte dorée : partie où elle est cachée sur le plateau (« doreesEnJeu »), et quelqu'un qui la tire
// (« doreesTirees »). Classique : ce téléphone ; en ligne : seulement l'hôte (sinon comptée par chaque
// téléphone). Pas pendant une reprise ou un rattrapage (actions déjà comptées).
function noterDoreeStats(nom){
  if (estPageTele || rattrapageEnCours || repriseClassiqueEnCours) return;
  if (enLigneActif && !estHote) return;
  compterStats(nom);
}

// Plantages (onglet « Santé » d'Alcuno Stats) : erreurs JavaScript non rattrapées, envoyées sans rien de personnel :
// message nettoyé (tout ce qui est entre guillemets est remplacé : un pseudo ou un code de partie ne part jamais), fichier et ligne,
// version du jeu et type d'appareil. Regroupés par empreinte dans sante/jours/AAAA-MM-JJ/{empreinte} avec un compteur.
// Au plus 5 empreintes différentes par ouverture du jeu, chacune une seule fois.
const PLANTAGES_MAX_PAR_SESSION = 5;
const plantagesEnvoyes = new Set();
const PLANTAGES_IGNORES = /ResizeObserver|^Script error|extension:|Non-Error promise rejection|Load failed|Failed to fetch|NetworkError/i;

function nettoyerMessagePlantage(brut){
  return String(brut || "").replace(/https?:\/\/\S+/g, "").replace(/'[^']*'|"[^"]*"|`[^`]*`/g, "'…'").replace(/\s+/g, " ").trim().slice(0, 120);
}
function empreinteTexte(texte){ // (petite empreinte stable, 12 caractères [a-z0-9])
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < texte.length; i++) { const c = texte.charCodeAt(i); h1 = ((h1 * 33) ^ c) >>> 0; h2 = ((h2 * 31) + c) >>> 0; }
  return (h1.toString(36) + h2.toString(36) + "000000000000").slice(0, 12);
}
// Renvoie {sig, msg, fichier} à envoyer, ou null (bruit connu, autre origine, déjà envoyé)
function preparerPlantage(p){
  const message = nettoyerMessagePlantage(p.message);
  if (!message || PLANTAGES_IGNORES.test(message) || PLANTAGES_IGNORES.test(String(p.fichier || ""))) return null;
  let nom = "";
  try {
    if (p.fichier) { const u = new URL(p.fichier, location.href); if (u.origin !== location.origin) return null; nom = u.pathname.split("/").pop(); }
  } catch (e) { return null; }
  const fichier = (nom + (p.ligne ? ":" + Number(p.ligne) : "")).slice(0, 40);
  return { sig: empreinteTexte(message + "|" + fichier), msg: message, fichier };
}
function envoyerPlantages(){
  while (plantagesEnAttente.length && plantagesEnvoyes.size < PLANTAGES_MAX_PAR_SESSION) {
    const p = preparerPlantage(plantagesEnAttente.shift());
    if (!p || plantagesEnvoyes.has(p.sig)) continue;
    plantagesEnvoyes.add(p.sig);
    attendreFirebase(() => {
      const base = `sante/jours/${jourStats()}/${p.sig}`;
      window.fbUpdate(refStats(base), { msg: p.msg, fichier: p.fichier, version: VERSION_AFFICHEE, os: systemeStats(), vu: window.fbServerTimestamp() })
        .then(() => window.fbRunTransaction(refStats(base + "/n"), (n) => (n || 0) + 1)).catch(() => {});
    });
  }
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
envoyerPlantages(); // (plantages survenus avant le chargement de ce fichier)

attendreFirebase(() => {
  majPresence(true);
  setInterval(() => majPresence(), 3000);             // changement d'écran (menu, partie…)
  setInterval(() => majPresence(true), PRESENCE_TOUTES_LES); // « toujours là »
  document.addEventListener("visibilitychange", () => majPresence(true));
});
// #endregion
