// =============================================================================================
// ALCUNO : Statistiques anonymes (lues par la page privée stats.html)
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Statistiques anonymes
// Pas de nom, pas de pseudo, pas d'adresse IP enregistrée : un identifiant tiré au hasard et gardé dans ce téléphone (pour
// compter les visiteurs différents), le type d'appareil, le thème et la version du jeu. Depuis la 9.92.0 s'y ajoute
// « l'origine » de l'appareil (onglet Public d'Alcuno Stats) : pays, région, ville et fournisseur d'accès déduits de
// l'adresse IP par un service extérieur (l'IP elle-même n'est PAS gardée), navigateur, version du système, écran, langue
// et fuseau horaire lus dans le navigateur. Rien de tout ça ne demande d'autorisation au joueur (pas de GPS).
// Dans Firebase :
// - stats/jours/AAAA-MM-JJ : visites, installs, parties, partiesEnLigne, doreesEnJeu, doreesTirees
//   (compteurs), heures/{HH} (parties
//   lancées à chaque heure) et visiteurs/{id} ; modes/{hot|pj|express|tele} (parties lancées dans ce mode) ;
//   finies (parties allées jusqu'au récap), joueurs et minutes (sommes sur les parties finies : moyennes de la page stats) ;
// - stats/defis/{id}/{fait|bois} : choix des joueurs devant chaque défi du mode hot (id de js/mode-hot.js, « P… » : ajouté
//   depuis le pilotage) ;
// - stats/appareils/{id} : os, thème, version, dernière visite (répartitions de la page stats), et la dernière lecture des
//   réglages à distance : confVu (quand) et confV (quelle modification) : voyant de l'onglet Pilotage de stats.html ;
//   installe (ouvert depuis l'icône de l'appli) et joue (au moins une partie lancée) : « installations qui jouent » ;
//   origine (voir « Origine de l'appareil » plus bas) : type, nav, osv, ecran, langue, fuseau, pays, region, ville, fai ;
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

// Compteur du jour + n (transaction : deux téléphones au même instant comptent tous les deux)
function compterStats(nom, n = 1){
  if (MODE_TEST) return; // (appli de test : pas de statistiques)
  attendreFirebase(() => {
    window.fbRunTransaction(refStats(`stats/jours/${jourStats()}/${nom}`), (v) => (v || 0) + n).catch(() => {});
  });
}

function noterAppareilStats(){
  if (MODE_TEST) return;
  attendreFirebase(() => {
    // (update et non set : la fiche garde confVu / confV, écrits par js/config-distante.js)
    const fiche = {
      os: systemeStats(),
      theme: document.documentElement.dataset.theme || "bordeaux",
      version: VERSION_AFFICHEE,
      vu: window.fbServerTimestamp()
    };
    if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true) fiche.installe = true;
    window.fbUpdate(refStats(`stats/appareils/${idStats}`), fiche).then(noterOrigineStats).catch(() => {});
  });
}

// ===== Origine de l'appareil (onglet « Public » d'Alcuno Stats) =====
// Écrite À PART de la fiche ci-dessus (deuxième écriture) : si les règles Firebase en ligne ne connaissent pas encore ces
// champs, seule cette écriture est refusée et les statistiques d'avant continuent de marcher.
// - Lu dans le navigateur, sans autorisation à demander : type d'appareil, navigateur, version du système, écran, langue, fuseau.
// - Déduit de l'adresse IP par un service extérieur (une fois par jour et par appareil) : pays, région, ville, fournisseur
//   d'accès. Approximatif (en 4G, c'est souvent la ville du relais de l'opérateur). L'adresse IP n'est jamais enregistrée.
const CLE_ORIGINE = "alcuno_origine_stats";
const DELAI_ORIGINE = 6000;
const couper = (t, n) => String(t === undefined || t === null ? "" : t).replace(/\s+/g, " ").trim().slice(0, n);

function typeAppareilStats(ua = navigator.userAgent, tactileMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1){
  if (/iPad/.test(ua) || tactileMac) return "tablette";
  if (/iPhone|iPod/.test(ua)) return "telephone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "telephone" : "tablette";
  return "ordi";
}
// Navigateur (ou appli dans laquelle le lien a été ouvert : Instagram, Snapchat… utile pour savoir par où le jeu circule)
function navigateurStats(ua = navigator.userAgent){
  const v = (re) => { const m = ua.match(re); return m ? " " + m[1] : ""; };
  if (/Instagram/.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return "Facebook";
  if (/Snapchat/.test(ua)) return "Snapchat";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "TikTok";
  if (/EdgA?\/|EdgiOS\//.test(ua)) return "Edge" + v(/Edg(?:A|iOS)?\/(\d+)/);
  if (/OPR\/|OPT\//.test(ua)) return "Opera" + v(/OP[RT]\/(\d+)/);
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet" + v(/SamsungBrowser\/(\d+)/);
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox" + v(/(?:Firefox|FxiOS)\/(\d+)/);
  if (/CriOS\//.test(ua)) return "Chrome" + v(/CriOS\/(\d+)/);
  if (/Chrome\//.test(ua)) return "Chrome" + v(/Chrome\/(\d+)/);
  if (/Safari\//.test(ua) || /iPhone|iPad|iPod/.test(ua)) return "Safari" + v(/Version\/(\d+)/);
  return "Autre";
}
// Version du système. « precis » : ce que Chrome donne en plus sur demande (userAgentData), car son user-agent est figé
// (« Android 10 », « Windows NT 10.0 », « Mac OS X 10_15_7 » quelle que soit la vraie version).
function versionSystemeStats(ua = navigator.userAgent, precis = null, tactileMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1){
  const majeure = precis && precis.platformVersion ? Number(String(precis.platformVersion).split(".")[0]) : NaN;
  const deux = precis && precis.platformVersion ? String(precis.platformVersion).split(".").slice(0, 2).join(".").replace(/\.0$/, "") : "";
  let m;
  if ((m = ua.match(/(?:iPhone|iPod|iPad).*? OS (\d+)[_.](\d+)/))) {
    // (Safari récent peut annoncer une version du système figée : son propre numéro « Version/ » suit celui d'iOS, on prend le plus grand)
    const s = /CriOS|FxiOS|EdgiOS/.test(ua) ? null : ua.match(/Version\/(\d+)\.(\d+)/);
    const v = s && Number(s[1]) > Number(m[1]) ? s : m;
    return `${/iPad/.test(ua) ? "iPadOS" : "iOS"} ${v[1]}.${v[2]}`;
  }
  if (tactileMac) return "iPadOS";
  if (/Android/.test(ua)) {
    if (majeure) return "Android " + deux;
    m = ua.match(/Android (\d+(?:\.\d+)?)/);
    if (!m || /Android 10; K\)/.test(ua)) return "Android"; // (user-agent figé de Chrome : la vraie version n'y est pas)
    return "Android " + m[1];
  }
  if (/Windows/.test(ua)) return majeure ? (majeure >= 13 ? "Windows 11" : "Windows 10") : /Windows NT 10/.test(ua) ? "Windows 10 ou 11" : "Windows (ancien)";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Mac OS X/.test(ua)) return majeure ? "macOS " + deux : "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Autre";
}
// Écran en points × densité : « 390x844@3 » (la page stats en tire les pixels réels). Téléphones et tablettes : toujours debout.
function ecranStats(type){
  let l = Math.round(Number(screen.width) || 0), h = Math.round(Number(screen.height) || 0);
  if (!l || !h) return "";
  if (type !== "ordi" && l > h) { const t = l; l = h; h = t; }
  const d = Math.round((Number(window.devicePixelRatio) || 1) * 100) / 100;
  return `${l}x${h}@${d}`;
}
function techniqueOrigineStats(precis){
  const type = typeAppareilStats(), fiche = { type, nav: couper(navigateurStats(), 30), osv: couper(versionSystemeStats(navigator.userAgent, precis), 30) };
  const ecran = ecranStats(type); if (/^\d{2,5}x\d{2,5}@\d(\.\d{1,2})?$/.test(ecran)) fiche.ecran = ecran;
  const langue = couper(navigator.language || "", 16); if (/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(langue)) fiche.langue = langue;
  let fuseau = ""; try { fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  if (/^[A-Za-z0-9_+\/-]{1,40}$/.test(fuseau)) fiche.fuseau = fuseau;
  return fiche;
}
// Réponse d'un service de géolocalisation par IP => { pays, region, ville, fai } (seulement les champs trouvés), ou null.
// Plusieurs formes acceptées (les services n'ont pas tous les mêmes noms de champs).
function lireReponseOrigine(j){
  if (!j || typeof j !== "object" || j.success === false || j.error) return null;
  const c = j.connection && typeof j.connection === "object" ? j.connection : {};
  const pays = couper(j.country_code || j.countryCode || j.country_code2 || "", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(pays)) return null;
  const sortie = { pays };
  const region = couper(j.region || j.regionName || j.region_name || "", 60), ville = couper(j.city || "", 60);
  const fai = couper(c.isp || c.org || j.isp || j.organization_name || j.org || j.organization || j.asn_org || "", 80).replace(/^AS\d+\s+/, "");
  if (region) sortie.region = region;
  if (ville) sortie.ville = ville;
  if (fai) sortie.fai = fai;
  return sortie;
}
// (deux services gratuits, sans clé, interrogés l'un après l'autre : le deuxième ne sert que si le premier ne répond pas)
const SERVICES_ORIGINE = ["https://ipwho.is/", "https://get.geojs.io/v1/ip/geo.json"];
async function chercherOrigineStats(){
  for (const url of SERVICES_ORIGINE) {
    try {
      const arret = typeof AbortController === "function" ? new AbortController() : null;
      const minuteur = setTimeout(() => { if (arret) arret.abort(); }, DELAI_ORIGINE);
      const rep = await fetch(url, { signal: arret ? arret.signal : undefined, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
      clearTimeout(minuteur);
      if (!rep.ok) continue;
      const lieu = lireReponseOrigine(await rep.json());
      if (lieu) return lieu;
    } catch (e) {}
  }
  return null;
}
let origineNotee = false;
function noterOrigineStats(){
  if (MODE_TEST || origineNotee) return; // (une fois par ouverture du jeu ; noterAppareilStats repasse à chaque changement de thème)
  origineNotee = true;
  const ecrire = (fiche) => window.fbUpdate(refStats(`stats/appareils/${idStats}`), fiche).catch(() => {});
  let garde = null;
  try { garde = JSON.parse(localStorage.getItem(CLE_ORIGINE) || "null"); } catch (e) {}
  const lieuGarde = garde && garde.lieu ? lireReponseOrigine({ country_code: garde.lieu.pays, region: garde.lieu.region, city: garde.lieu.ville, isp: garde.lieu.fai }) : null;
  ecrire(Object.assign(techniqueOrigineStats(null), lieuGarde || {}));
  // la vraie version du système (Chrome : sur demande, sans rien afficher au joueur)
  try {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(["platformVersion"]).then((precis) => {
        const osv = couper(versionSystemeStats(navigator.userAgent, precis), 30);
        if (osv) ecrire({ osv });
      }).catch(() => {});
    }
  } catch (e) {}
  // le lieu : une seule demande par jour et par appareil
  if (garde && garde.jour === jourStats() && lieuGarde) return;
  chercherOrigineStats().then((lieu) => {
    if (!lieu) return;
    try { localStorage.setItem(CLE_ORIGINE, JSON.stringify({ jour: jourStats(), lieu })); } catch (e) {}
    // (région, ville ou fournisseur absents de la réponse : on efface ceux d'avant, qui ne valent plus pour ce lieu)
    ecrire({ pays: lieu.pays, region: lieu.region || null, ville: lieu.ville || null, fai: lieu.fai || null });
  });
}

// Partie lancée (classique : ce téléphone ; en ligne : seulement l'hôte, une fois par manche), et son
// heure (heure du téléphone, « 00 » à « 23 » : « À quelle heure on joue » de la page stats)
// modes : { hot, pj, express } de la partie lancée (« tele » : une télé est reliée, ici ou plus tard dans la partie)
let teleCompteePartie = false;
function noterPartieStats(enLigne, modes = {}){
  if (estPageTele) return;
  compterStats(enLigne ? "partiesEnLigne" : "parties");
  compterStats(`heures/${String(new Date().getHours()).padStart(2, "0")}`);
  ["hot", "hard", "pj", "express"].forEach((m) => { if (modes[m]) compterStats("modes/" + m); });
  teleCompteePartie = false;
  noterTelePartieStats();
}
function noterTelePartieStats(){
  if (estPageTele || teleCompteePartie || typeof codeTele === "undefined" || !codeTele) return;
  teleCompteePartie = true;
  compterStats("modes/tele");
}
// Ce téléphone a lancé ou rejoint une partie (une seule écriture par ouverture du jeu)
let jeuNoteStats = false;
function noterJeuAppareilStats(){
  if (MODE_TEST || estPageTele || jeuNoteStats) return;
  jeuNoteStats = true;
  attendreFirebase(() => { window.fbUpdate(refStats(`stats/appareils/${idStats}`), { joue: true }).catch(() => {}); });
}

// Partie finie (récap) : nombre de joueurs et durée, pour les moyennes. Classique : ce téléphone ; en ligne : l'hôte.
function noterFinStats(recap){
  if (estPageTele || rattrapageEnCours || repriseClassiqueEnCours || !recap) return;
  if (enLigneActif && !estHote) return;
  compterStats("finies");
  compterStats("joueurs", Math.min(20, Math.max(1, Number(recap.nbJoueurs) || 1)));
  compterStats("minutes", Math.min(300, Math.max(1, Number(recap.minutes) || 1)));
}

// Défi du mode hot : relevé (« fait ») ou refusé (« bois »). Classique : ce téléphone ; en ligne : l'hôte.
function noterDefiStats(id, choix){
  if (MODE_TEST || estPageTele || rattrapageEnCours || repriseClassiqueEnCours) return;
  if (enLigneActif && !estHote) return;
  if (!/^[A-Za-z0-9]{1,32}$/.test(String(id)) || (choix !== "fait" && choix !== "bois")) return;
  attendreFirebase(() => {
    window.fbRunTransaction(refStats(`stats/defis/${id}/${choix}`), (v) => (v || 0) + 1).catch(() => {});
  });
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
  if (MODE_TEST) { plantagesEnAttente.length = 0; return; }
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
  if (MODE_TEST || !window.firebaseDB) return;
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
  if (!MODE_TEST) attendreFirebase(() => {
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
