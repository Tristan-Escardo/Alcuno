// =============================================================================================
// ALCUNO : Réglages, nouvelle version, appli installable
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Réglages : thème, Mode PJ, sons, rappel d'eau, partage, diagnostic, partie en mémoire, vibrations, écran allumé
// ===== Réglages (bouton en haut à droite de l'écran d'accueil, seulement là) =====
// Chaque réglage est retenu sur le téléphone (stockage local du navigateur)
const ecranReglages = document.getElementById("ecranReglages");

document.getElementById("btnReglages").addEventListener("click", () => {
  majLignePartieMemoire();
  ecranReglages.scrollTop = 0;
  ouvrirPage(ecranReglages);
});

activerMemePendantElan(document.getElementById("btnFermerReglages"), () => fermerPage(ecranReglages));

function lireReglage(cle, parDefaut){
  try {
    const valeur = localStorage.getItem(cle);
    return valeur === null ? parDefaut : valeur === "1";
  } catch (e) { return parDefaut; }
}

function ecrireReglage(cle, actif){
  try { localStorage.setItem(cle, actif ? "1" : "0"); } catch (e) {}
}

// Accessibilité pour les gens bourrés : textes et boutons plus gros (classe sur <html>)
const CLE_ACCESSIBILITE = "alcuno_accessibilite";
const caseAccessibilite = document.getElementById("optionAccessibilite");
caseAccessibilite.checked = lireReglage(CLE_ACCESSIBILITE, false);
document.documentElement.classList.toggle("accessibilite", caseAccessibilite.checked);

caseAccessibilite.addEventListener("change", () => {
  ecrireReglage(CLE_ACCESSIBILITE, caseAccessibilite.checked);
  document.documentElement.classList.toggle("accessibilite", caseAccessibilite.checked);
});

// ===== Thème : couleur du fond du jeu (réglage de ce téléphone, purement visuel) =====
// (le thème est déjà posé au tout début du chargement par index.html : pas de flash de couleur)
const CLE_THEME = "alcuno_theme";
// Couleur de la barre du téléphone pour chaque thème (= --couleur-barre du CSS, le tout haut de la page).
// Mêmes couleurs dans le script du <head> de index.html, qui la pose dès le premier affichage.
const THEMES = { bordeaux: "#2b001d", noir: "#000000", vert: "#08301e", bleu: "#0a1634", violet: "#3d0f66",
                 cerisier: "#5a1740", givre: "#e4f5fc", prestige: "#937810" };

// Thème secret « Prestige » : débloqué en découvrant l'écran des créateurs (4 taps sur le titre)
const CLE_PRESTIGE = "alcuno_theme_prestige";
function prestigeDebloque(){
  try { return localStorage.getItem(CLE_PRESTIGE) === "1"; } catch (e) { return false; }
}

// Pastille cachée tant que le thème n'est pas débloqué
function majPastillePrestige(){
  const pastille = document.getElementById("pastillePrestige");
  if (pastille) pastille.hidden = !prestigeDebloque();
}

function debloquerPrestige(){
  if (prestigeDebloque()) return;
  try { localStorage.setItem(CLE_PRESTIGE, "1"); } catch (e) {}
  majPastillePrestige();
  afficherNotificationHaut("✨", "Thème Prestige débloqué !");
}

// Notification qui arrive du haut de l'écran, en or avec des étincelles. Comme sur un téléphone :
// on la glisse vers le haut pour la fermer, on la retient au doigt (elle ne part pas tant qu'on
// la tient), un simple tap la ferme, sinon elle s'en va toute seule après 5 s.
function afficherNotificationHaut(icone, titre){
  const ancienne = document.getElementById("notifHaut");
  if (ancienne) ancienne.remove();
  const notif = document.createElement("div");
  notif.id = "notifHaut";
  notif.setAttribute("role", "status");
  const eclats = document.createElement("span");
  eclats.className = "notifHaut-eclats";
  eclats.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 9; i++) {
    const etincelle = document.createElement("span");
    etincelle.textContent = "✦";
    etincelle.style.left = (4 + Math.random() * 88) + "%";
    etincelle.style.top = (8 + Math.random() * 70) + "%";
    etincelle.style.fontSize = (8 + Math.random() * 9).toFixed(0) + "px";
    const duree = 1.6 + Math.random() * 1.6;
    etincelle.style.animationDuration = duree.toFixed(2) + "s";
    etincelle.style.animationDelay = (-Math.random() * duree).toFixed(2) + "s";
    eclats.appendChild(etincelle);
  }
  const ligneIcone = document.createElement("span");
  ligneIcone.className = "notifHaut-icone";
  ligneIcone.setAttribute("aria-hidden", "true");
  ligneIcone.textContent = icone;
  const bloc = document.createElement("span");
  bloc.className = "notifHaut-texte";
  const fort = document.createElement("strong");
  fort.textContent = titre;
  bloc.append(fort);
  notif.append(eclats, ligneIcone, bloc);

  let partie = false;
  let minuteur = null;
  const placer = (decalage, transition) => {
    notif.style.animation = "none"; // l'animation d'arrivée ne doit plus imposer sa position
    notif.style.transition = transition || "none";
    notif.style.transform = `translate(-50%, ${decalage}px)`;
  };
  const fermer = () => {
    if (partie) return;
    partie = true;
    clearTimeout(minuteur);
    placer(-(notif.offsetHeight + notif.offsetTop + 20), "transform 0.28s ease-in, opacity 0.28s ease-in");
    notif.style.opacity = "0";
    setTimeout(() => notif.remove(), 300);
  };
  const programmerDepart = (delai) => {
    clearTimeout(minuteur);
    minuteur = setTimeout(fermer, delai);
  };

  // Glissement au doigt
  let departY = null;
  let decalage = 0;
  let dernierY = 0;
  let dernierT = 0;
  let vitesse = 0;
  notif.addEventListener("pointerdown", (e) => {
    if (partie) return;
    clearTimeout(minuteur); // tenue au doigt : elle reste
    departY = e.clientY;
    dernierY = e.clientY;
    dernierT = e.timeStamp;
    decalage = 0;
    vitesse = 0;
    try { notif.setPointerCapture(e.pointerId); } catch (err) {}
    placer(0);
  });
  notif.addEventListener("pointermove", (e) => {
    if (departY === null || partie) return;
    const dy = e.clientY - departY;
    // vers le haut elle suit le doigt ; vers le bas elle résiste (élastique)
    decalage = dy < 0 ? dy : dy * 0.3;
    if (e.timeStamp > dernierT) vitesse = (e.clientY - dernierY) / (e.timeStamp - dernierT);
    dernierY = e.clientY;
    dernierT = e.timeStamp;
    placer(decalage);
  });
  const lacher = (e) => {
    if (departY === null || partie) return;
    const bouge = Math.abs(e.clientY - departY);
    departY = null;
    if (e.type === "pointerup" && bouge < 8) return fermer();                 // simple tap
    if (decalage < -notif.offsetHeight * 0.35 || vitesse < -0.5) return fermer(); // jetée vers le haut
    placer(0, "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)");                // revient à sa place
    programmerDepart(3000);
  };
  notif.addEventListener("pointerup", lacher);
  notif.addEventListener("pointercancel", lacher);

  programmerDepart(5000);
  document.body.appendChild(notif);
}

function appliquerTheme(nom){
  if (!THEMES[nom] || (nom === "prestige" && !prestigeDebloque())) nom = "bordeaux";
  document.documentElement.dataset.theme = nom;
  // Barre du téléphone en haut : on remplace la balise au lieu de la modifier (sinon Chrome sur
  // Android ne repeint parfois la barre qu'au premier changement de thème)
  document.querySelectorAll('meta[name="theme-color"]').forEach((ancienne) => ancienne.remove());
  const barre = document.createElement("meta");
  barre.name = "theme-color";
  barre.content = THEMES[nom];
  document.head.appendChild(barre);
  document.querySelectorAll(".pastilleTheme").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.theme === nom ? "true" : "false");
  });
}

// iPhone, barre du haut (sous l'heure) : quand le jeu ne passe pas dessous (appli ajoutée à l'écran
// d'accueil avant la 8.8.9 : iOS garde le réglage de la barre enregistré à l'installation), c'est
// l'iPhone qui la peint, et il ne relit sa couleur qu'au chargement de la page (elle gardait celle du
// thème d'avant). Après un changement de thème, on recharge donc la page, et les Réglages se
// rouvrent au même endroit. Quand le jeu passe sous l'heure, la barre, c'est la page : rien à faire.
const CLE_ROUVRIR_REGLAGES = "alcuno_rouvrir_reglages"; // (lue aussi par le script du <head> de index.html)
let rechargementTheme = null;

// Hauteur de la zone de l'heure occupée par le jeu (0 quand le jeu commence sous la barre du haut)
function hauteurZoneHeure(){
  const sonde = document.createElement("div");
  sonde.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top, 0px)";
  document.body.appendChild(sonde);
  const hauteur = parseFloat(getComputedStyle(sonde).paddingTop) || 0;
  sonde.remove();
  return hauteur;
}

function rafraichirBarreIphone(){
  if (!estIOS || !estEnAppli || hauteurZoneHeure() > 0) return;
  // petit délai : on voit le nouveau thème, et plusieurs taps d'affilée ne font qu'un rechargement
  clearTimeout(rechargementTheme);
  rechargementTheme = setTimeout(() => {
    const reglagesOuverts = ecranReglages.style.display !== "none" && !ecranReglages.classList.contains("page-sortie");
    try {
      if (reglagesOuverts) sessionStorage.setItem(CLE_ROUVRIR_REGLAGES, String(ecranReglages.scrollTop));
    } catch (e) {}
    location.reload();
  }, 400);
}

// Après ce rechargement : Réglages rouverts tels quels (sans animation), au même endroit
let positionReglages = null;
try {
  positionReglages = sessionStorage.getItem(CLE_ROUVRIR_REGLAGES);
  sessionStorage.removeItem(CLE_ROUVRIR_REGLAGES);
} catch (e) {}
if (positionReglages !== null) {
  ecranReglages.style.display = "";
  // (une fois tous les fichiers du jeu chargés : majLignePartieMemoire utilise js/en-ligne.js)
  document.addEventListener("DOMContentLoaded", () => {
    majLignePartieMemoire();
    ecranReglages.scrollTop = Number(positionReglages) || 0;
  });
}
document.documentElement.classList.remove("rouvrir-reglages");

majPastillePrestige();
let themeChoisi = "bordeaux";
try { themeChoisi = localStorage.getItem(CLE_THEME) || "bordeaux"; } catch (e) {}
appliquerTheme(themeChoisi);

// Cerisier : pétales qui tombent sur l'écran d'accueil (positions, tailles et vitesses au hasard)
const zonePetales = document.getElementById("petalesCerisier");
for (let i = 0; i < 14; i++) {
  const petale = document.createElement("span");
  const taille = 0.7 + Math.random() * 0.7;
  const duree = 9 + Math.random() * 9;
  petale.style.left = `${Math.random() * 100}%`;
  petale.style.width = `${11 * taille}px`;
  petale.style.height = `${15 * taille}px`;
  petale.style.animationDuration = `${duree}s`;
  petale.style.animationDelay = `${-Math.random() * duree}s`; // déjà en train de tomber à l'ouverture
  zonePetales.appendChild(petale);
}

// Prestige : étincelles qui scintillent sur l'écran d'accueil (positions, tailles et rythmes au hasard)
const zoneEtincelles = document.getElementById("etincellesPrestige");
for (let i = 0; i < 26; i++) {
  const etincelle = document.createElement("span");
  const taille = 12 + Math.random() * 18;
  const duree = 2.5 + Math.random() * 3;
  etincelle.textContent = "✦";
  etincelle.style.left = `${Math.random() * 96}%`;
  etincelle.style.top = `${Math.random() * 96}%`;
  etincelle.style.fontSize = `${taille}px`;
  etincelle.style.animationDuration = `${duree}s`;
  etincelle.style.animationDelay = `${-Math.random() * duree}s`;
  zoneEtincelles.appendChild(etincelle);
}

document.querySelectorAll(".pastilleTheme").forEach((pastille) => {
  pastille.addEventListener("click", () => {
    appliquerTheme(pastille.dataset.theme);
    try { localStorage.setItem(CLE_THEME, pastille.dataset.theme); } catch (e) {}
    rafraichirBarreIphone();
  });
});

// ===== Mode PJ (appelé « soft » dans le code) : moins de gorgées =====
// Classique : le réglage de ce téléphone. En ligne : le réglage de l'hôte au moment où il a créé
// la partie (champ « soft » de la partie dans Firebase) : le même pour tous, et il ne change
// plus jusqu'à la fin (même si l'hôte change ou si quelqu'un touche à son réglage).
const CLE_MODE_SOFT = "alcuno_mode_soft";
const caseModeSoft = document.getElementById("optionModeSoft");
caseModeSoft.checked = lireReglage(CLE_MODE_SOFT, false);
caseModeSoft.addEventListener("change", () => {
  ecrireReglage(CLE_MODE_SOFT, caseModeSoft.checked);
  majTitrePJ();
});

let softPartieEnLigne = false;

function estModeSoft(){
  return codePartieActuel ? softPartieEnLigne : caseModeSoft.checked;
}

// Titre du bandeau « ALCUNO PJ » : suit le Mode PJ tout de suite (réglage, ou mode de la partie en ligne),
// pas seulement au lancement d'une partie (classe « partie-soft » sur body)
function majTitrePJ(){
  document.body.classList.toggle("partie-soft", estModeSoft());
}

// Gorgées selon le mode (normal | soft)
function texteCulSec(){ return estModeSoft() ? "3 gorgées" : "un CUL SEC"; }
function gorgeesPlus2(){ return estModeSoft() ? 1 : 2; }
function gorgeesPlus4(){ return estModeSoft() ? 2 : 4; }
function gorgeesPigeon(){ return estModeSoft() ? 1 : 2; }
// Duel : valeur de la carte du perdant × multiplicateur ; en soft, moitié (arrondie au-dessus), 10 max
function gorgeesDuel(valeur, multiplicateur){
  return estModeSoft() ? Math.min(10, Math.ceil(valeur / 2) * multiplicateur) : valeur * multiplicateur;
}
function texteGorgees(n){ return `${n} gorgée${n > 1 ? "s" : ""}`; }
function texteDoreeJamaisTrouvee(){
  return estModeSoft()
    ? "Tout le monde boit 2 gorgées de la part du développeur 😘"
    : "Tout le monde prend un CUL SEC de la part du développeur 😘";
}

// En ligne : mode de la partie qu'on rejoint / crée, affiché dans la salle d'attente
function choisirModeSoftEnLigne(soft){
  softPartieEnLigne = !!soft;
  document.getElementById("infoModeSoft").style.display = softPartieEnLigne ? "" : "none";
  majTitrePJ();
}

// ===== Sons : fichiers MP3 du dossier Sons/ (voir SONS plus bas pour la liste des fichiers) =====
// Le curseur règle le volume du jeu à l'intérieur du volume du téléphone (il ne peut pas le dépasser).
const CLE_SONS = "alcuno_sons";
const CLE_VOLUME = "alcuno_volume";
const caseSons = document.getElementById("optionSons");
const curseurVolume = document.getElementById("volumeSons");
const ligneVolume = document.getElementById("ligneVolume");
caseSons.checked = lireReglage(CLE_SONS, true);

let volumeSons = 100;
try {
  const v = localStorage.getItem(CLE_VOLUME);
  if (v !== null && Number(v) >= 0 && Number(v) <= 100) volumeSons = Number(v);
} catch (e) {}
curseurVolume.value = volumeSons;

function majLigneVolume(){
  document.getElementById("volumeValeur").innerText = volumeSons + " %";
  curseurVolume.disabled = !caseSons.checked;
  ligneVolume.classList.toggle("inactif", !caseSons.checked);
}
majLigneVolume();

caseSons.addEventListener("change", () => {
  ecrireReglage(CLE_SONS, caseSons.checked);
  majLigneVolume();
  if (caseSons.checked) jouerSon("sons_on"); // petit retour pour montrer que ça marche
});

curseurVolume.addEventListener("input", () => {
  volumeSons = Number(curseurVolume.value);
  try { localStorage.setItem(CLE_VOLUME, String(volumeSons)); } catch (e) {}
  majLigneVolume();
});
curseurVolume.addEventListener("change", () => jouerSon("reglage_son")); // essai au relâchement (Sons/reglage_son.mp3)

let contexteSon = null;
let repriseRatee = false; // au tap précédent, le son était coupé et la reprise n'a pas marché
function contexteAudio(){
  if (contexteSon && contexteSon.state === "closed") contexteSon = null;
  if (!contexteSon) {
    const Contexte = window.AudioContext || window.webkitAudioContext;
    if (!Contexte) return null;
    try { contexteSon = new Contexte(); } catch (e) { return null; }
  }
  // « suspended », ou « interrupted » sur iPhone (appli en arrière-plan, appel, autre appli qui joue
  // du son…) : on relance. Avant, seul « suspended » était relancé : le son restait coupé jusqu'au
  // redémarrage de l'appli.
  if (contexteSon.state !== "running") contexteSon.resume().catch(() => {});
  return contexteSon;
}
// Les téléphones n'autorisent le son qu'après un premier tap : on le prépare à chaque tap
// (et on charge les fichiers des sons au premier tap, pour qu'ils soient prêts à temps).
// Si le son est encore coupé au tap suivant, l'iPhone l'a bloqué pour de bon : on repart d'un
// contexte neuf, créé pendant le tap (les sons déjà chargés resservent tels quels).
document.addEventListener("pointerdown", () => {
  if (!caseSons.checked) return;
  if (contexteSon && contexteSon.state !== "running" && repriseRatee) {
    try { contexteSon.close(); } catch (e) {}
    contexteSon = null;
  }
  const ctx = contexteAudio();
  chargerSons();
  repriseRatee = false;
  if (ctx && ctx.state !== "running") setTimeout(() => { repriseRatee = ctx.state !== "running"; }, 300);
}, { capture: true, passive: true });
// Retour dans l'appli : on relance le son tout de suite
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && contexteSon && contexteSon.state !== "running") {
    contexteSon.resume().catch(() => {});
  }
});

// Fichiers des sons : dossier Sons/, un MP3 par moment du jeu. Pour changer un son, il suffit de
// remplacer le fichier (même nom). Fichier absent => pas de son à ce moment-là.
//   cartes.mp3  : une carte est retournée sur le plateau
//   doree.mp3   : quelqu'un tire la carte dorée (coupé à 3 s, voir DUREE_MAX_SONS)
//   pigeon.mp3  : quelqu'un devient pigeon (premier pigeon ou nouveau pigeon ; coupé à 2 s)
//   tour.mp3    : en ligne, c'est ton tour
//   eau.mp3     : rappel « Bois de l'eau »
//   sons_on.mp3 : on active les sons dans les réglages
//   credits.mp3 : 4 taps sur le titre ALCUNO (écran des créateurs)
//   reglage_son.mp3 : on lâche le curseur de volume dans les réglages (pour entendre le volume)
//   no_wifi.mp3 : en ligne, coupure de réseau (une fois, quand le logo wifi barré apparaît)
//   distribuer_gorgees.mp3 : +4, on tape sur un joueur pour lui donner une gorgée (coupé à 0,8 s)
//   annuler_gorgees.mp3 : quelqu'un annule 1 gorgée ou plus
//   annuler_0_gorgees.mp3 : quelqu'un tape « Annuler 0 » (il n'annule rien)
// (pas de son pour le cul sec de la carte dorée)
const SONS = ["cartes", "doree", "pigeon", "tour", "eau", "sons_on", "credits", "reglage_son", "no_wifi", "distribuer_gorgees", "annuler_gorgees", "annuler_0_gorgees"];
// Sons coupés au bout de N secondes (avec un petit fondu), même si le fichier est plus long
const DUREE_MAX_SONS = { doree: 3, pigeon: 2, distribuer_gorgees: 0.8 };
const sonsCharges = {}; // nom -> son décodé (ou null si le fichier n'existe pas)
const sonsDemandes = {}; // nom -> moment où il a été demandé alors qu'il n'était pas encore chargé
let chargementSonsLance = false;

function chargerSons(){
  const ctx = contexteAudio();
  if (!ctx || chargementSonsLance) return;
  chargementSonsLance = true;
  SONS.forEach((nom) => {
    fetch(`Sons/${nom}.mp3?t=${window.ANTI_CACHE || Date.now()}`)
      .then((reponse) => {
        if (!reponse.ok) throw new Error("absent");
        return reponse.arrayBuffer();
      })
      .then((donnees) => new Promise((ok, ko) => ctx.decodeAudioData(donnees, ok, ko)))
      .then((son) => {
        sonsCharges[nom] = son;
        // Demandé juste avant d'être chargé (tout premier tap) : joué maintenant, si c'était il y a < 1,5 s
        if (sonsDemandes[nom] && Date.now() - sonsDemandes[nom] < 1500) lireSon(nom, son);
        delete sonsDemandes[nom];
      })
      .catch(() => { sonsCharges[nom] = null; });
  });
}

// carte | doree | culsec | pigeon | tour | eau
function jouerSon(nom){
  if (!caseSons.checked || volumeSons <= 0) return;
  if (rattrapageEnCours) return; // reconnexion : pas de sons pour les actions déjà passées
  const ctx = contexteAudio();
  if (!ctx) return;
  chargerSons();
  const son = sonsCharges[nom];
  if (son === undefined) sonsDemandes[nom] = Date.now(); // pas encore chargé : joué dès qu'il arrive
  if (!son) return; // (null : pas de fichier pour ce moment)
  lireSon(nom, son);
}

function lireSon(nom, son){
  const ctx = contexteAudio();
  if (!ctx || !caseSons.checked || rattrapageEnCours) return;
  const sortie = ctx.createGain();
  const volume = Math.pow(volumeSons / 100, 2); // curseur plus naturel à l'oreille
  sortie.gain.value = volume;
  sortie.connect(ctx.destination);
  const lecture = ctx.createBufferSource();
  lecture.buffer = son;
  lecture.connect(sortie);
  const debut = ctx.currentTime;
  lecture.start(debut);

  const dureeMax = DUREE_MAX_SONS[nom];
  if (dureeMax && son.duration > dureeMax) {
    sortie.gain.setValueAtTime(volume, debut + dureeMax - 0.3);
    sortie.gain.linearRampToValueAtTime(0.0001, debut + dureeMax);
    lecture.stop(debut + dureeMax + 0.02);
  }
}

// ===== Rappel « Bois de l'eau 💧 » : toutes les 30 minutes de partie (désactivé par défaut) =====
// Petit bandeau en haut de l'écran, qui ne bloque rien et se ferme au tap ou tout seul.
// (Chaque téléphone le gère de son côté : rien n'est envoyé aux autres joueurs.)
const CLE_RAPPEL_EAU = "alcuno_rappel_eau";
const caseRappelEau = document.getElementById("optionRappelEau");
caseRappelEau.checked = lireReglage(CLE_RAPPEL_EAU, false);
caseRappelEau.addEventListener("change", () => ecrireReglage(CLE_RAPPEL_EAU, caseRappelEau.checked));

const MINUTES_RAPPEL_EAU = 30;
let tempsDeJeuSansEau = 0; // ms de partie (écran allumé) depuis le dernier rappel

setInterval(() => {
  if (!caseRappelEau.checked || !partieLancee || document.visibilityState !== "visible") return;
  tempsDeJeuSansEau += 15000;
  if (tempsDeJeuSansEau >= MINUTES_RAPPEL_EAU * 60000) {
    tempsDeJeuSansEau = 0;
    afficherRappelEau();
  }
}, 15000);


function afficherRappelEau(){
  const ancien = document.getElementById("rappelEau");
  if (ancien) ancien.remove();
  const bandeau = document.createElement("div");
  bandeau.id = "rappelEau";
  bandeau.setAttribute("role", "status");
  bandeau.innerHTML =
    '<span class="rappelEau-icone" aria-hidden="true">💧</span>' +
    '<span class="rappelEau-texte"><strong>MESSAGE DE TON ANGE GARDIEN</strong>' +
    '<strong>Bois de l\'eau !</strong>' +
    '<span>Demain tu me diras merci 😉</span></span>';
  const fermer = () => bandeau.remove();
  bandeau.addEventListener("click", fermer);
  setTimeout(fermer, 9000);
  document.body.appendChild(bandeau);
  jouerSon("eau");
  vibrer([60, 80, 60]);
}

// ===== Partager le jeu : bouton « Partager » du téléphone, sinon lien copié =====
const ADRESSE_JEU = "https://tristan-escardo.github.io/Alcuno/";

document.getElementById("btnPartagerJeu").addEventListener("click", () => {
  if (navigator.share) {
    navigator.share({ url: ADRESSE_JEU }).catch(() => {}); // juste le lien (aperçu : l'icône du jeu, cf. og:image)
    return;
  }
  const copie = navigator.clipboard ? navigator.clipboard.writeText(ADRESSE_JEU) : Promise.reject();
  copie.then(() => afficherToast("Lien copié !"))
    .catch(() => prompt("Copie le lien du jeu :", ADRESSE_JEU));
});

// ===== Diagnostic : tout ce qu'il faut pour comprendre un plantage en ligne, copié en un tap =====
// Écran : appli installée ou navigateur, et zones de l'heure / du bas (pour la barre du haut de l'iPhone)
function infosEcranDiagnostic(){
  const sonde = document.createElement("div");
  sonde.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top, 0px);padding-bottom:env(safe-area-inset-bottom, 0px)";
  document.body.appendChild(sonde);
  const zone = getComputedStyle(sonde);
  const haut = zone.paddingTop, bas = zone.paddingBottom;
  sonde.remove();
  // Bas d'un élément fixe calé en haut avec ce style (bande vide en bas de l'iPhone : quelle hauteur
  // le jeu voit-il vraiment ?)
  const basFixe = (style) => {
    const s = document.createElement("div");
    s.style.cssText = "position:fixed;top:0;left:0;width:1px;visibility:hidden;pointer-events:none;" + style;
    document.body.appendChild(s);
    const b = Math.round(s.getBoundingClientRect().bottom);
    s.remove();
    return b;
  };
  const zoneVisible = window.visualViewport;
  const accueil = document.getElementById("choixMode").getBoundingClientRect();
  return `Écran : ${estEnAppli ? "appli installée" : "navigateur"} | fenêtre ${window.innerWidth}×${window.innerHeight}` +
    ` | écran ${screen.width}×${screen.height} | zone de l'heure ${haut} | zone du bas ${bas}` +
    ` | thème ${document.documentElement.dataset.theme || "-"}` +
    ` | bas des écrans fixes ${basFixe("bottom:0")} | 100vh ${basFixe("height:100vh")} | 100dvh ${basFixe("height:100dvh")}` +
    ` | 100lvh ${basFixe("height:100lvh")} | html ${document.documentElement.clientHeight}` +
    ` | zone visible ${zoneVisible ? Math.round(zoneVisible.height) + " décalée de " + Math.round(zoneVisible.offsetTop) : "-"}` +
    ` | accueil ${Math.round(accueil.top)}→${Math.round(accueil.bottom)} | pixels ×${window.devicePixelRatio}`;
}

function texteDiagnostic(){
  const etat = window.__etatFileAlcuno ? window.__etatFileAlcuno() : {};
  const journal = etat.journal || [];
  delete etat.journal;
  return [
    "=== Diagnostic Alcuno ===",
    `Version ${VERSION_AFFICHEE} | ${new Date().toLocaleString("fr-FR")}`,
    `Téléphone : ${navigator.userAgent}`,
    `Réseau : ${navigator.onLine ? "en ligne" : "hors connexion"} | Firebase chargé : ${!!window.firebaseDB}`,
    infosEcranDiagnostic(),
    `Partie : ${codePartieActuel || "aucune"} | pseudo : ${pseudoActuel || "-"} | manche : ${mancheCourante === null ? "-" : mancheCourante}` +
      ` | partie en mémoire : ${JSON.stringify(lirePartieLocale())}`,
    `File d'actions : ${JSON.stringify(etat)}`,
    "--- Journal des actions en ligne ---",
    ...(journal.length ? journal : ["(vide)"]),
    "--- Erreurs récentes ---",
    ...(erreursRecentes.length ? erreursRecentes : ["aucune"])
  ].join("\n");
}

document.getElementById("btnDiagnostic").addEventListener("click", () => {
  const texte = texteDiagnostic();
  const copie = (navigator.clipboard && navigator.clipboard.writeText)
    ? navigator.clipboard.writeText(texte)
    : Promise.reject(new Error("presse-papiers indisponible"));
  copie.then(() => afficherToast("Diagnostic copié", 3000))
    .catch(() => {
      // Pas de presse-papiers : bouton « Partager » du téléphone, sinon le texte dans une fenêtre
      if (navigator.share) {
        navigator.share({ title: "Diagnostic Alcuno", text: texte }).catch(() => {});
      } else {
        prompt("Copie ce texte :", texte);
      }
    });
});

// ===== Partie en mémoire : la partie en ligne dont ce téléphone se souvient (« Revenir ») =====
function majLignePartieMemoire(){
  const memoire = lirePartieLocale();
  const ligne = document.getElementById("lignePartieMemoire");
  if (!memoire || !memoire.code) {
    ligne.style.display = "none";
    return;
  }
  document.getElementById("textePartieMemoire").innerText =
    `Partie ${memoire.code}${memoire.pseudo ? " (" + memoire.pseudo + ")" : ""} : proposée par « Revenir dans une partie en cours ».`;
  ligne.style.display = "";
}

document.getElementById("btnOublierPartie").addEventListener("click", () => {
  const memoire = lirePartieLocale();
  if (!memoire || !memoire.code) { majLignePartieMemoire(); return; }
  if (!confirm(`Oublier la partie ${memoire.code} ?\n\nLe bouton « Revenir dans une partie en cours » ne la proposera plus. ` +
               `(Tu pourras toujours la rejoindre avec « Rejoindre » et ton pseudo.)`)) return;
  oublierPartieLocale();
  majBoutonRevenir();
  majLignePartieMemoire();
  afficherToast("Partie oubliée");
});

// ===== Vibrations (Android : un iPhone ne peut pas vibrer depuis une page web) =====
// Activées par défaut
const CLE_VIBRATIONS = "alcuno_vibrations";
const caseVibrations = document.getElementById("optionVibrations");
let vibrationsActives = true;
try { vibrationsActives = localStorage.getItem(CLE_VIBRATIONS) !== "0"; } catch (e) {}
caseVibrations.checked = vibrationsActives;

caseVibrations.addEventListener("change", () => {
  vibrationsActives = caseVibrations.checked;
  try { localStorage.setItem(CLE_VIBRATIONS, vibrationsActives ? "1" : "0"); } catch (e) {}
  if (vibrationsActives) vibrer(60); // petit retour pour montrer que ça marche
});

function vibrer(motif){
  if (!vibrationsActives || typeof navigator.vibrate !== "function") return;
  if (rattrapageEnCours) return; // reconnexion : pas de vibrations pour les actions déjà passées
  try { navigator.vibrate(motif); } catch (e) {}
}

let dernierTourVibre = null; // en ligne : on vibre une seule fois par tour (voir majStickyJoueurActif)

// ===== Écran toujours allumé pendant une partie (Wake Lock) =====
// Un téléphone en veille ne reçoit plus les actions en ligne et prend du retard.
// Le navigateur relâche le verrou quand on change d'appli : on le redemande au retour.
// Réglage « Écran toujours allumé » (activé par défaut)
let verrouEcran = null;
let demandeVerrouEnCours = false;
const CLE_ECRAN_ALLUME = "alcuno_ecran_allume";
const caseEcranAllume = document.getElementById("optionEcranAllume");
caseEcranAllume.checked = lireReglage(CLE_ECRAN_ALLUME, true);

caseEcranAllume.addEventListener("change", () => {
  ecrireReglage(CLE_ECRAN_ALLUME, caseEcranAllume.checked);
  if (!caseEcranAllume.checked) libererEcran();
});

function garderEcranAllume(){
  if (!caseEcranAllume.checked) return;
  if (verrouEcran || demandeVerrouEnCours) return;
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;

  demandeVerrouEnCours = true;
  navigator.wakeLock.request("screen").then((verrou) => {
    verrouEcran = verrou;
    verrou.addEventListener("release", () => {
      if (verrouEcran === verrou) verrouEcran = null;
    });
  }).catch(() => {}).finally(() => { demandeVerrouEnCours = false; });
}

function libererEcran(){
  if (!verrouEcran) return;
  const verrou = verrouEcran;
  verrouEcran = null;
  verrou.release().catch(() => {});
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && (partieLancee || codePartieActuel)) garderEcranAllume();
  if (document.visibilityState === "visible") verifierNouvelleVersion();
});

// #endregion

// #region Nouvelle version disponible et appli installable
// ===== Nouvelle version disponible =====
// Une appli installée qu'on rouvre depuis les applis récentes reprend l'ancienne page sans la
// recharger. On regarde donc si une version plus récente est en ligne (au retour dans l'appli,
// et toutes les 5 min) ; si oui, un bandeau propose de mettre à jour en un tap.
// Jamais en pleine partie ni dans une partie en ligne : on ne coupe personne.
let versionEnLigne = null;

// "8.5.1" => 80501 (même calcul que VERSION_JEU), pour comparer les versions
function versionEnNombre(texte){
  return String(texte).split(".").reduce((total, partie, i) => total + Number(partie) * [10000, 100, 1][i], 0);
}

function verifierNouvelleVersion(){
  if (document.visibilityState !== "visible" || navigator.onLine === false) return;
  fetch("script.js?verif=" + Date.now(), { cache: "no-store" })
    .then((reponse) => reponse.ok ? reponse.text() : "")
    .then((texte) => {
      const trouve = texte.match(/VERSION_AFFICHEE = "([^"]+)"/);
      // Seulement si la version en ligne est PLUS RÉCENTE que celle de ce téléphone
      if (trouve && versionEnNombre(trouve[1]) > VERSION_JEU) {
        versionEnLigne = trouve[1];
        afficherBandeauMiseAJour();
      }
    })
    .catch(() => {}); // pas de réseau : on réessaiera plus tard
}

function afficherBandeauMiseAJour(){
  if (!versionEnLigne) return;
  if (partieLancee || codePartieActuel) return; // pas en pleine partie (affiché au retour à l'accueil)
  if (document.getElementById("bandeauMiseAJour")) return;

  const bandeau = document.createElement("div");
  bandeau.id = "bandeauMiseAJour";
  bandeau.innerHTML =
    `<span class="texte">Nouvelle version disponible (${echapperHtml(versionEnLigne)})</span>` +
    `<button type="button" class="maj">Mettre à jour</button>` +
    `<button type="button" class="plusTard" aria-label="Plus tard">✕</button>`;
  // Adresse neuve (?v=...) : contourne le cache et recharge toute l'appli
  bandeau.querySelector(".maj").addEventListener("click", () => {
    location.replace(location.pathname + "?v=" + encodeURIComponent(versionEnLigne));
  });
  bandeau.querySelector(".plusTard").addEventListener("click", () => bandeau.remove());
  document.body.appendChild(bandeau);
}

setInterval(verifierNouvelleVersion, 5 * 60 * 1000);

// ===== Appli installable (PWA) =====
// Service worker « réseau d'abord » (sw.js) : dernière version avec internet, copie locale sans.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// Déjà ouvert en appli (depuis l'icône) : on ne propose rien
const estEnAppli =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const blocInstaller = document.getElementById("installerAppli");
const btnInstallerAppli = document.getElementById("btnInstallerAppli");
let demandeInstallation = null;

// Android (Chrome) : le navigateur signale qu'on peut installer => on montre le bouton
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  if (estEnAppli) return;
  demandeInstallation = e;
  blocInstaller.hidden = false;
  btnInstallerAppli.hidden = false;
});

btnInstallerAppli.addEventListener("click", () => {
  if (!demandeInstallation) return;
  demandeInstallation.prompt();
  demandeInstallation.userChoice.finally(() => {
    demandeInstallation = null;
    btnInstallerAppli.hidden = true;
    blocInstaller.hidden = true;
  });
});

window.addEventListener("appinstalled", () => {
  demandeInstallation = null;
  blocInstaller.hidden = true;
});

// iPhone / iPad : pas de bouton possible (Apple ne le permet pas), on affiche l'astuce Safari
const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (estIOS && !estEnAppli) {
  blocInstaller.hidden = false;
  document.getElementById("astuceIphone").hidden = false;
}

// #endregion

// #region Écran des règles du jeu (bouton livre de l'accueil et du bandeau de la partie)
// Rempli à chaque ouverture : les gorgées suivent le Mode PJ. Pas de carte dorée (c'est une surprise).
const ecranRegles = document.getElementById("ecranRegles");

function remplirRegles(){
  const pj = estModeSoft();
  const duel = pj
    ? "Choisis 2 joueurs. Chacun prend une carte cachée : celui qui a la plus petite boit la moitié de sa valeur (10 gorgées max). Égalité : on recommence, gorgées doublées."
    : "Choisis 2 joueurs. Chacun prend une carte cachée : celui qui a la plus petite boit sa valeur en gorgées. Égalité : on recommence, gorgées doublées.";
  const parties = [
    { titre: "Comment on joue", regles: [
      { carte: "", nom: "À ton tour", texte: "Toutes les cartes sont posées face cachée. Quand c'est ton tour, retourne la carte de ton choix et applique sa règle. Ensuite, c'est au joueur suivant." }
    ]},
    { titre: "Les cartes", regles: [
      { carte: "zero_bleu", nom: "0", texte: "Tout le monde boit 1 gorgée, sauf toi." },
      { carte: "un_rouge", nom: "1 : annulation", texte: "Tu gardes la carte : quand tu dois boire, tu peux t'en servir pour annuler 1 gorgée." },
      { carte: "plus_2_jaune", nom: "+2", texte: `Tu bois ${texteGorgees(gorgeesPlus2())}.` },
      { carte: "plus_4", nom: "+4", texte: `Tu distribues ${texteGorgees(gorgeesPlus4())} comme tu veux.` },
      { carte: "trois_vert", nom: "3 : le Pigeon", texte: `Le premier qui tire un 3 devient le Pigeon et boit ${texteGorgees(gorgeesPigeon())}. À chaque 3 tiré par un autre, le Pigeon boit 1 gorgée. Si le Pigeon tire un 3, il choisit le nouveau Pigeon, qui boit ${texteGorgees(gorgeesPigeon())}.` },
      { carte: "quatre_bleu", nom: "4 : duel", texte: duel },
      { carte: "interdit_rouge", nom: "Sociale", texte: "Tout le monde boit 1 gorgée." },
      { carte: "switch_vert", nom: "Changement de sens", texte: "Le sens du jeu est inversé." },
      { carte: "couleur", nom: "Couleur", texte: "Choisis une couleur : le prochain qui tire une carte de cette couleur boit 1 gorgée en plus." }
    ]},
    { titre: "Fin de la partie", regles: [
      { carte: "", nom: "Pari sur la dernière carte", texte: `Quand il ne reste qu'une carte, chacun parie sur son type. Ceux qui trouvent distribuent ${texteCulSec()}.` },
      { carte: "un_jaune", nom: "Les 1 restants", texte: "Chaque 1 gardé jusqu'à la fin se transforme en gorgée à boire (1 gorgée par carte)." }
    ]}
  ];

  const liste = document.getElementById("listeRegles");
  liste.innerHTML = "";
  if(pj){
    const note = document.createElement("p");
    note.className = "reglesNotePJ";
    note.innerText = "Mode PJ activé : moins de gorgées.";
    liste.appendChild(note);
  }
  parties.forEach(partie => {
    const bloc = document.createElement("div");
    bloc.className = "blocRegles";
    const titre = document.createElement("h3");
    titre.innerText = partie.titre;
    bloc.appendChild(titre);
    partie.regles.forEach(r => {
      const ligne = document.createElement("div");
      ligne.className = "ligneRegle";
      const carte = document.createElement("div");
      carte.className = ("Carte retournee " + r.carte).trim(); // sans classe : le dos de la carte
      carte.setAttribute("aria-hidden", "true");
      const texte = document.createElement("div");
      texte.className = "texteRegle";
      const nom = document.createElement("span");
      nom.className = "nomRegle";
      nom.innerText = r.nom;
      const detail = document.createElement("span");
      detail.className = "detailRegle";
      detail.innerText = r.texte;
      texte.append(nom, detail);
      ligne.append(carte, texte);
      bloc.appendChild(ligne);
    });
    liste.appendChild(bloc);
  });
}

function ouvrirRegles(){
  remplirRegles();
  ecranRegles.scrollTop = 0;
  ouvrirPage(ecranRegles);
}

document.getElementById("btnRegles").addEventListener("click", ouvrirRegles);
document.getElementById("btnReglesJeu").addEventListener("click", ouvrirRegles);
activerMemePendantElan(document.getElementById("btnFermerRegles"), () => fermerPage(ecranRegles));

// #endregion
