// =============================================================================================
// ALCUNO : Réglages, nouvelle version, appli installable
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Réglages : thème, Mode PJ, sons, rappel d'eau, partage, diagnostic, partie en mémoire, vibrations, écran allumé
// ===== Réglages (bouton en haut à droite de l'écran d'accueil, seulement là) =====
// Chaque réglage est retenu sur le téléphone (stockage local du navigateur)
const ecranReglages = document.getElementById("ecranReglages");

document.getElementById("btnReglages").addEventListener("click", () => {
  // (le « NOUVEAU » d'un thème débloqué ne part pas en ouvrant les Réglages : seulement quand on essaie ce thème, voir appliquerTheme)
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
  if (caseAccessibilite.checked) jouerSon("accessibilite_on");
});

// ===== Thème : couleur du fond du jeu (réglage de ce téléphone, purement visuel) =====
// (le thème est déjà posé au tout début du chargement par index.html : pas de flash de couleur)
const CLE_THEME = "alcuno_theme";
// Couleur de la barre du téléphone pour chaque thème (= --couleur-barre du CSS, le tout haut de la page).
// Mêmes couleurs dans le script du <head> de index.html, qui la pose dès le premier affichage.
const THEMES = { bordeaux: "#2b001d", noir: "#000000", vert: "#08301e", bleu: "#0a1634", soleil: "#1f3566",
                 cerisier: "#5a1740", givre: "#e4f5fc", prestige: "#937810", galaxie: "#02030a", kawaii: "#ffd6ec" };

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
  // Rappel tant qu'on n'est pas allé le voir : point rouge sur l'icône des Réglages, « NOUVEAU » sur la pastille
  try { localStorage.setItem(CLE_PRESTIGE_NOUVEAU, "1"); } catch (e) {}
  document.documentElement.classList.add("prestige-nouveau");
  // (un peu après l'ouverture de l'écran des créateurs : on le voit d'abord, puis le secret)
  setTimeout(afficherFenetrePrestige, 1100);
}

// Rappel « nouveau thème » : point rouge sur l'icône des Réglages et « NOUVEAU » sur la pastille Prestige,
// jusqu'à ce qu'on ait essayé le thème (appliquerTheme) : ouvrir les Réglages ne les retire pas
const CLE_PRESTIGE_NOUVEAU = "alcuno_prestige_nouveau";
try { if (localStorage.getItem(CLE_PRESTIGE_NOUVEAU) && prestigeDebloque()) document.documentElement.classList.add("prestige-nouveau"); } catch (e) {}
function vuNouveauPrestige(){
  try { localStorage.removeItem(CLE_PRESTIGE_NOUVEAU); } catch (e) {}
  document.documentElement.classList.remove("prestige-nouveau");
}

// Thème Prestige débloqué : fenêtre dorée au milieu de l'écran (avant : petite notif en haut que
// personne ne voyait). « L'essayer maintenant » met le thème tout de suite, « Plus tard » ferme.
function afficherFenetrePrestige(){
  if (document.getElementById("fenetrePrestige")) return;
  const voile = document.createElement("div");
  voile.id = "fenetrePrestige";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-label", "Thème Prestige débloqué");
  voile.innerHTML = `
    <div class="fenetrePrestige-carte">
      <div class="fenetrePrestige-secret">✦ Secret trouvé ✦</div>
      <span class="fenetrePrestige-rond" aria-hidden="true"></span>
      <div class="fenetrePrestige-titre">Thème Prestige<br>débloqué !</div>
      <div class="fenetrePrestige-texte">Il est maintenant dans<br>Réglages › Thèmes</div>
      <button type="button" class="fenetrePrestige-essayer">L'essayer maintenant</button>
      <button type="button" class="fenetrePrestige-plusTard">Plus tard</button>
    </div>`;
  const fermer = () => {
    voile.classList.add("fenetrePrestige-sortie");
    setTimeout(() => voile.remove(), 250);
  };
  voile.querySelector(".fenetrePrestige-essayer").addEventListener("click", () => {
    fermer();
    const pastille = document.getElementById("pastillePrestige");
    if (pastille) pastille.click(); // comme dans les réglages (musique coupée, thème gardé…)
  });
  voile.querySelector(".fenetrePrestige-plusTard").addEventListener("click", fermer);
  vibrer([60, 40, 60]);
  document.body.appendChild(voile);
}

// ===== Thème secret « Star Wars » (nom interne : galaxie) : un mot de passe tapé comme nom de joueur (mode classique) =====
// Le mot n'est pas écrit ici (le code du jeu est public) : seulement son empreinte (FNV-1a sur le mot en
// minuscules, sans accents, espaces ni ponctuation). Le nom n'est pas ajouté : générique qui défile,
// puis le thème est mis.
const CLE_GALAXIE = "alcuno_theme_galaxie";
const EMPREINTES_GALAXIE = ["ff6221f9", "1684d6ef", "d711e3bb"];
function galaxieDebloquee(){
  try { return localStorage.getItem(CLE_GALAXIE) === "1"; } catch (e) { return false; }
}
function majPastilleGalaxie(){
  const pastille = document.getElementById("pastilleGalaxie");
  if (pastille) pastille.hidden = !galaxieDebloquee();
}
function estCodeGalaxie(nom){
  const mot = String(nom).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let h = 0x811c9dc5;
  for (const c of mot) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return EMPREINTES_GALAXIE.includes(h.toString(16).padStart(8, "0"));
}
// « NOUVEAU » sur la pastille Star Wars et point rouge sur les Réglages au premier déblocage, jusqu'à ce
// qu'on ait essayé le thème (comme Prestige)
const CLE_GALAXIE_NOUVEAU = "alcuno_galaxie_nouveau";
try { if (localStorage.getItem(CLE_GALAXIE_NOUVEAU) && galaxieDebloquee()) document.documentElement.classList.add("galaxie-nouveau"); } catch (e) {}
function vuNouveauGalaxie(){
  try { localStorage.removeItem(CLE_GALAXIE_NOUVEAU); } catch (e) {}
  document.documentElement.classList.remove("galaxie-nouveau");
}
function debloquerGalaxie(){
  // « NOUVEAU » et fenêtre « débloqué » seulement la toute première fois (revoir le générique ensuite ne les remet pas)
  const premiere = !galaxieDebloquee();
  if (premiere) {
    try { localStorage.setItem(CLE_GALAXIE_NOUVEAU, "1"); } catch (e) {}
    document.documentElement.classList.add("galaxie-nouveau");
  }
  if (document.activeElement) document.activeElement.blur(); // (le clavier du nom de joueur se ferme)
  try { localStorage.setItem(CLE_GALAXIE, "1"); } catch (e) {}
  majPastilleGalaxie();
  afficherGeneriqueGalaxie(premiere);
}
// ===== Thème secret « Kawaii » : débloqué avec les 11 stickers de l'album (js/stickers.js) =====
const CLE_KAWAII = "alcuno_theme_kawaii";
const CLE_KAWAII_NOUVEAU = "alcuno_kawaii_nouveau";
function kawaiiDebloque(){
  try { return localStorage.getItem(CLE_KAWAII) === "1"; } catch (e) { return false; }
}
function majPastilleKawaii(){
  const pastille = document.getElementById("pastilleKawaii");
  if (pastille) pastille.hidden = !kawaiiDebloque();
}
// « NOUVEAU » sur la pastille et point rouge sur les Réglages, jusqu'à ce qu'on ait essayé le thème (comme Prestige)
try { if (localStorage.getItem(CLE_KAWAII_NOUVEAU) && kawaiiDebloque()) document.documentElement.classList.add("kawaii-nouveau"); } catch (e) {}
function vuNouveauKawaii(){
  try { localStorage.removeItem(CLE_KAWAII_NOUVEAU); } catch (e) {}
  document.documentElement.classList.remove("kawaii-nouveau");
}
// Mot secret (nom de joueur) qui débloque le thème d'un coup, sans l'album : seulement son empreinte (comme Star Wars)
const EMPREINTES_KAWAII = ["5199ea9a"];
function estCodeKawaii(nom){
  const mot = String(nom).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let h = 0x811c9dc5;
  for (const c of mot) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return EMPREINTES_KAWAII.includes(h.toString(16).padStart(8, "0"));
}
function debloquerKawaii(immediat = false){
  if (kawaiiDebloque()) {
    if (immediat) afficherFenetreKawaii(); // (mot secret retapé : la fenêtre revient pour essayer le thème)
    return;
  }
  try { localStorage.setItem(CLE_KAWAII, "1"); localStorage.setItem(CLE_KAWAII_NOUVEAU, "1"); } catch (e) {}
  majPastilleKawaii();
  document.documentElement.classList.add("kawaii-nouveau");
  setTimeout(afficherFenetreKawaii, immediat ? 300 : 3200); // (sinon : après le récap de fin de partie et la notif du sticker)
}
// Fenêtre « Thème Kawaii débloqué » : « L'essayer maintenant » met le thème, « Plus tard » ferme
function afficherFenetreKawaii(){
  if (document.getElementById("fenetreKawaii")) return;
  const voile = document.createElement("div");
  voile.id = "fenetreKawaii";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-label", "Thème Kawaii débloqué");
  voile.innerHTML = `
    <div class="fenetreKawaii-carte">
      <div class="fenetreKawaii-secret">Album complet : 11 stickers !</div>
      <div class="fenetreKawaii-stickers" aria-hidden="true">
        <img src="stickers/licorne.svg" alt="" width="64" height="64"><img src="stickers/cupcake.svg" alt="" width="64" height="64"><img src="stickers/chat.svg" alt="" width="64" height="64">
      </div>
      <div class="fenetreKawaii-titre">Thème Kawaii<br>débloqué !</div>
      <div class="fenetreKawaii-texte">Il est maintenant dans<br>Réglages › Thèmes</div>
      <button type="button" class="fenetreKawaii-essayer">L'essayer maintenant</button>
      <button type="button" class="fenetreKawaii-plusTard">Plus tard</button>
    </div>`;
  const fermer = () => {
    voile.classList.add("fenetreKawaii-sortie");
    setTimeout(() => voile.remove(), 250);
  };
  voile.querySelector(".fenetreKawaii-essayer").addEventListener("click", () => {
    fermer();
    const pastille = document.getElementById("pastilleKawaii");
    if (pastille) pastille.click(); // comme dans les réglages (musique, thème gardé, barre du téléphone…)
  });
  voile.querySelector(".fenetreKawaii-plusTard").addEventListener("click", fermer);
  vibrer([60, 40, 60]);
  document.body.appendChild(voile);
}

// Accueil du thème Star Wars : le Nyan Cat traverse l'écran de temps en temps, d'un bord au bord d'en
// face par un trajet au hasard, derrière les boutons. icones/nyan_cat.png : 12 images l'une sous l'autre
// (985 x 140 chacune), le chat du GIF fourni et son arc-en-ciel prolongé loin derrière, qui ondule comme
// l'original et suit la tartine quand elle monte et descend (70 ms par image). L'arrière de
// l'arc-en-ciel s'efface en fondu (masque). Le tout est penché dans le sens du trajet.
const NYAN_U = 0.4;                      // pixels à l'écran par pixel de l'image (chat de 80 px)
const NYAN_L = 985, NYAN_H = 140;        // une image de la feuille
let dernierBordNyan = null; // bord par lequel le dernier passage est reparti
function passageNyanCat(){
  setTimeout(passageNyanCat, 25000 + Math.random() * 20000);
  const accueil = document.getElementById("choixMode");
  if (document.documentElement.dataset.theme !== "galaxie" || document.visibilityState !== "visible" ||
      document.documentElement.classList.contains("mode-tele") || // (pas sur la page de la télé)
      !accueil || getComputedStyle(accueil).display === "none" || !accueil.clientHeight ||
      accueil.querySelector(".nyanCat")) return;
  const largeur = NYAN_L * NYAN_U, hauteur = NYAN_H * NYAN_U;
  const W = accueil.clientWidth, H = accueil.clientHeight;
  const zone = document.createElement("div");
  zone.className = "nyanCat";
  const chat = document.createElement("div");
  chat.className = "nyanChat";
  chat.style.cssText = `width:${largeur}px;height:${hauteur}px;background-size:${largeur}px ${hauteur * 12}px;--fin:${-hauteur * 12}px`;
  zone.appendChild(chat);
  accueil.appendChild(zone);
  // Trajet au hasard : entre par un bord (gauche, droite ou bas) et ressort par le bord d'en face,
  // à une hauteur / un endroit au hasard : en diagonale plus ou moins penchée. Le
  // point suivi est le nez du chat (bord droit de l'image) ; l'image est tournée dans le sens du trajet
  // (retournée quand il va vers la gauche, pour ne pas voler sur le dos). On continue jusqu'à ce que la
  // queue de l'arc-en-ciel soit sortie de l'écran, à 180 px par seconde.
  const hasard = (a, b) => a + Math.random() * (b - a);
  // Seulement de gauche à droite ou de droite à gauche (plus de passage par le haut ni par le bas). Il
  // revient par le côté où il a disparu la fois d'avant (à une hauteur au hasard) ; au premier passage,
  // un côté au hasard
  const bord = dernierBordNyan || (Math.random() < 0.5 ? "gauche" : "droite");
  dernierBordNyan = bord === "gauche" ? "droite" : "gauche"; // bord de sortie
  let x0, y0, x1, y1;
  if (bord === "gauche") { x0 = -10; y0 = hasard(0.1, 0.9) * H; x1 = W + 10; y1 = hasard(0.1, 0.9) * H; }
  else { x0 = W + 10; y0 = hasard(0.1, 0.9) * H; x1 = -10; y1 = hasard(0.1, 0.9) * H; }
  const longueur = Math.hypot(x1 - x0, y1 - y0);
  const dx = (x1 - x0) / longueur, dy = (y1 - y0) / longueur;
  const angle = Math.atan2(dy, dx);
  const retourne = dx < 0 ? " scaleY(-1)" : "";
  const distance = longueur + largeur;
  const position = (d) => `translate(${x0 + dx * d - largeur}px, ${y0 + dy * d - hauteur / 2}px) rotate(${angle}rad)${retourne}`;
  const vol = chat.animate([{ transform: position(0) }, { transform: position(distance) }],
    { duration: distance / 0.18, easing: "linear" });
  vol.onfinish = () => zone.remove();
}
setTimeout(passageNyanCat, 4000);

// Halo du sabre sous la barre de l'heure (thème Star Wars, voir le CSS) : dans index.html dès le premier
// affichage ; créé ici seulement si une ancienne page gardée en cache ne l'a pas
if (!document.getElementById("haloSabre")) {
  const halo = document.createElement("div");
  halo.id = "haloSabre";
  halo.setAttribute("aria-hidden", "true");
  document.body.appendChild(halo);
}

// Musique du générique (Sons/debloquage_theme_galaxie.mp3, boucle exacte) : au volume des sons du jeu
// (pas si les sons sont coupés), la musique d'ambiance se tait pendant ce temps. Lue par le lecteur de la
// musique d'ambiance (jouerTourMusique), dans son propre circuit.
function jouerSonGenerique(){
  if (!caseSons.checked || volumeSons <= 0) return null;
  const ctx = contexteAudio();
  if (!ctx) return null;
  const maitre = ctx.createGain();
  maitre.gain.value = Math.pow(volumeSons / 100, 2);
  maitre.connect(ctx.destination);
  const L = { ctx, maitre, nom: "debloquage_theme_galaxie", morceau: null, sources: [], minuteur: null, actif: true };
  const ambiance = lecteurMusique;
  if (ambiance && ambiance.actif) {
    const g = ambiance.attenuation.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.8);
  }
  chargerMusique(ctx, L.nom).then((morceau) => {
    if (!morceau || !L.actif) return;
    L.morceau = morceau;
    jouerTourMusique(L, ctx.currentTime + 0.05, 0.4);
  });
  return L;
}
function arreterSonGenerique(L){
  if (!L) return;
  eteindreMusique(L, 1.5);
  const ambiance = lecteurMusique;
  if (ambiance && ambiance.ctx === L.ctx) {
    const g = ambiance.attenuation.gain, t = L.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(1, t + 2);
  }
}

// Générique : texte jaune qui défile en perspective dans les étoiles. Un tap le passe ; à la fin (ou au
// tap), le thème est mis comme dans les Réglages
function afficherGeneriqueGalaxie(premiere){
  if (document.getElementById("generiqueGalaxie")) return;
  const ecran = document.createElement("div");
  ecran.id = "generiqueGalaxie";
  ecran.setAttribute("role", "dialog");
  ecran.setAttribute("aria-label", "Thème Star Wars débloqué");
  ecran.innerHTML = `
    <div class="generique-intro">Il y a bien longtemps, dans une soirée lointaine, très lointaine…</div>
    <div class="generique-scene"><div class="generique-texte">
      <div class="generique-episode">ÉPISODE ∞</div>
      <div class="generique-titre">LA REVANCHE<br>DU PIGEON</div>
      <p>C'est une période de guerre civile autour de la table basse. Les verres sont remplis, les cartes sont posées face cachée, et plus personne ne sait qui a commencé.</p>
      <p>Le redoutable PIGEON n'a toujours pas trouvé comment s'en débarrasser. Les +4 pleuvent sur la galaxie, et les annulations de gorgées se font de plus en plus rares…</p>
      <p>Pendant ce temps, quelqu'un jure qu'il ne boit pas trop ce soir. Personne ne le croit.</p>
      <p>Mais un seul joueur a percé le secret de l'ALCUNO. Pour lui, et lui seul, s'ouvre enfin un nouveau thème…</p>
      <p class="generique-fin">THÈME STAR WARS DÉBLOQUÉ</p>
      <p class="generique-fin">Que la gorgée soit avec toi.</p>
    </div></div>
    <div class="generique-passer">Touche l'écran pour passer</div>`;
  let fini = false;
  const terminer = () => {
    if (fini) return;
    fini = true;
    clearTimeout(minuteur);
    arreterSonGenerique(son);
    ecran.classList.add("generique-sortie");
    setTimeout(() => ecran.remove(), 400);
    // Premier déblocage : le thème n'est pas mis tout seul, la fenêtre « débloqué » propose de l'essayer (comme
    // Prestige ; sur iPhone, changer de thème recharge la page et ferait disparaître la fenêtre).
    // Les fois suivantes (mot de passe retapé) : le thème est mis directement.
    if (premiere) { setTimeout(afficherFenetreGalaxie, 700); return; }
    const pastille = document.getElementById("pastilleGalaxie");
    if (pastille) pastille.click(); // comme dans les réglages (thème gardé, barre du téléphone…)
    else { appliquerTheme("galaxie"); try { localStorage.setItem(CLE_THEME, "galaxie"); } catch (e) {} }
  };
  const minuteur = setTimeout(terminer, 50000); // (le texte défile en 46,5 s depuis 3,5 s : voir generiqueDefile dans le CSS)
  const son = jouerSonGenerique();
  ecran.addEventListener("click", terminer);
  document.body.appendChild(ecran);
  vibrer([80, 60, 80, 60, 200]);
}

// Thème Star Wars débloqué : fenêtre jaune sur noir, comme celle de Prestige, juste après le générique.
// « Que la gorgée soit avec toi » met le thème (comme dans les Réglages), « Plus tard » ferme.
function jouerSabreDeblocage(){
  jouerSon(SONS_SABRE[Math.floor(Math.random() * SONS_SABRE.length)], true); // (lu dès qu'il est chargé s'il ne l'est pas encore)
}
function afficherFenetreGalaxie(){
  if (document.getElementById("fenetreGalaxie")) return;
  const ctx = contexteAudio();
  if (ctx) SONS_SABRE.forEach((n) => chargerSon(ctx, n)); // les sabres se chargent d'avance, le bouton en joue un
  const voile = document.createElement("div");
  voile.id = "fenetreGalaxie";
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-label", "Thème Star Wars débloqué");
  voile.innerHTML = `
    <div class="fenetreGalaxie-carte">
      <div class="fenetreGalaxie-secret">✦ Secret trouvé ✦</div>
      <span class="fenetreGalaxie-rond" aria-hidden="true"></span>
      <div class="fenetreGalaxie-titre">Thème Star Wars<br>débloqué !</div>
      <div class="fenetreGalaxie-texte">Il est maintenant dans<br>Réglages › Thèmes</div>
      <button type="button" class="fenetreGalaxie-ok">Que la gorgée soit avec toi</button>
      <button type="button" class="fenetreGalaxie-plusTard">Plus tard</button>
    </div>`;
  const fermer = () => {
    voile.classList.add("fenetreGalaxie-sortie");
    setTimeout(() => voile.remove(), 250);
  };
  voile.querySelector(".fenetreGalaxie-ok").addEventListener("click", () => {
    jouerSabreDeblocage(); // (le thème n'est pas encore mis : le clic normal des boutons ne serait pas un sabre)
    fermer();
    const pastille = document.getElementById("pastilleGalaxie");
    if (pastille) pastille.click(); // comme dans les réglages (musique coupée, thème gardé, barre du téléphone…)
  });
  voile.querySelector(".fenetreGalaxie-plusTard").addEventListener("click", fermer);
  vibrer([60, 40, 60]);
  document.body.appendChild(voile);
}

// Notification qui arrive du haut de l'écran, en or avec des étincelles. Comme sur un téléphone :
// on la glisse vers le haut pour la fermer, on la retient au doigt (elle ne part pas tant qu'on
// la tient), un simple tap la ferme, sinon elle s'en va toute seule après 5 s.
// sobre : panneau sombre du jeu, sans étincelles (mode télé : « Télé connectée »…) ; icone "" : sans icône
function afficherNotificationHaut(icone, titre, sobre = false){
  const ancienne = document.getElementById("notifHaut");
  if (ancienne) ancienne.remove();
  const notif = document.createElement("div");
  notif.id = "notifHaut";
  if (sobre) notif.classList.add("notifHaut-sobre");
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
  if (!sobre) notif.append(eclats);
  if (icone) notif.append(ligneIcone);
  notif.append(bloc);

  rendreNotifGlissable(notif, 5000);
  document.body.appendChild(notif);
}

// Notification en haut (« Télé connectée », rappel « Bois de l'eau »…) qui se comporte comme une vraie :
// elle part toute seule au bout de « duree » ms, se ferme d'un tap ou jetée vers le haut, et reste tant
// qu'on la tient du doigt (élastique vers le bas). Centrée par translate(-50%, …) dans le CSS.
function rendreNotifGlissable(notif, duree){
  let partie = false;
  let minuteur = null;
  const placer = (decalage, transition) => {
    notif.style.animation = "none"; // l'animation d'arrivée ne doit plus imposer sa position
    notif.style.transition = transition || "none";
    notif.style.transform = `translate(-50%, ${decalage}px)`;
  };
  // Elle ne monte jamais jusqu'au bord du haut : en la glissant vers le haut, elle montait sous l'heure,
  // et l'iPhone reprenait sa couleur pour la barre du haut (qui la gardait ensuite). Elle s'efface donc
  // en fondu en montant à peine, et la barre reprend la couleur du thème une fois la notification partie.
  const montee = () => -Math.max(0, notif.offsetTop - 8);
  const fermer = () => {
    if (partie) return;
    partie = true;
    clearTimeout(minuteur);
    placer(montee(), "transform 0.28s ease-in, opacity 0.28s ease-in");
    notif.style.opacity = "0";
    setTimeout(() => { notif.remove(); peindreBarreTelephone(); }, 300);
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
    // vers le haut elle s'efface en suivant le doigt (sans toucher le bord du haut) ; vers le bas elle
    // résiste (élastique)
    decalage = dy < 0 ? dy : dy * 0.3;
    notif.style.opacity = dy < 0 ? String(Math.max(0.15, 1 + dy / (notif.offsetHeight * 1.2))) : "";
    if (e.timeStamp > dernierT) vitesse = (e.clientY - dernierY) / (e.timeStamp - dernierT);
    dernierY = e.clientY;
    dernierT = e.timeStamp;
    placer(Math.max(decalage, montee()));
  });
  const lacher = (e) => {
    if (departY === null || partie) return;
    const bouge = Math.abs(e.clientY - departY);
    departY = null;
    if (e.type === "pointerup" && bouge < 8) return fermer();                 // simple tap
    if (decalage < -notif.offsetHeight * 0.35 || vitesse < -0.5) return fermer(); // jetée vers le haut
    placer(0, "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease"); // revient à sa place
    notif.style.opacity = "";
    programmerDepart(3000);
  };
  notif.addEventListener("pointerup", lacher);
  notif.addEventListener("pointercancel", lacher);

  programmerDepart(duree);
}

// Barre du téléphone en haut, à la couleur du thème affiché : on remplace la balise au lieu de la
// modifier (sinon Chrome sur Android ne repeint parfois la barre qu'au premier changement de thème).
// Remise aussi après la caméra (scanner) et au retour dans l'appli : l'iPhone pouvait repeindre la barre
// en noir à ce moment-là (vu en castant, après « Scanner la télé »)
function peindreBarreTelephone(){
  const nom = document.documentElement.dataset.theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((ancienne) => ancienne.remove());
  const barre = document.createElement("meta");
  barre.name = "theme-color";
  barre.content = THEMES[nom] || THEMES.bordeaux;
  document.head.appendChild(barre);
}

function appliquerTheme(nom, sansMusique = false){
  if (!THEMES[nom] || (nom === "prestige" && !prestigeDebloque()) || (nom === "galaxie" && !galaxieDebloquee()) || (nom === "kawaii" && !kawaiiDebloque())) nom = "bordeaux";
  document.documentElement.dataset.theme = nom;
  if (nom === "prestige") vuNouveauPrestige(); // thème essayé : le rappel « NOUVEAU » s'en va
  if (nom === "galaxie") vuNouveauGalaxie();
  if (nom === "kawaii") vuNouveauKawaii();
  peindreBarreTelephone();
  document.querySelectorAll(".pastilleTheme").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.theme === nom ? "true" : "false");
  });
  // Musique du nouveau thème, tout de suite (dans le tap : sinon l'iPhone refuse de la lancer). Pas si la
  // page va se recharger juste après (voir rafraichirBarreIphone) : on entendait son début, puis plus rien
  if (!sansMusique) { try { majMusique(); } catch (e) {} } // (pas encore prête pendant le chargement de la page)
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

function barreIphoneARafraichir(){
  return estIOS && estEnAppli && hauteurZoneHeure() === 0;
}

function rafraichirBarreIphone(){
  if (!barreIphoneARafraichir()) return;
  // tout petit délai (avant : 0,4 s, la barre gardait l'ancienne couleur trop longtemps) : le nouveau
  // thème s'affiche, et deux taps très rapprochés ne font qu'un rechargement
  // Le rechargement coupe le son : on laisse d'abord le clic se jouer (0,25 s après son départ). Juste
  // après un rechargement, le son n'est pas encore chargé : on l'attend (0,9 s au plus après le tap).
  // Sons coupés : comme avant, 0,1 s.
  clearTimeout(rechargementTheme);
  const tapA = Date.now();
  const recharger = () => {
    const attendreLeSon = caseSons.checked && volumeSons > 0 && Date.now() - tapA < 900 &&
      !(dernierClicJoueA >= tapA - 50 && Date.now() - dernierClicJoueA >= 250);
    if (attendreLeSon) { rechargementTheme = setTimeout(recharger, 50); return; }
    const reglagesOuverts = ecranReglages.style.display !== "none" && !ecranReglages.classList.contains("page-sortie");
    try {
      if (reglagesOuverts) sessionStorage.setItem(CLE_ROUVRIR_REGLAGES, String(ecranReglages.scrollTop));
    } catch (e) {}
    rechargerPage(); // (js/retour-demarrage.js)
  };
  rechargementTheme = setTimeout(recharger, 100);
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
majPastilleGalaxie();
majPastilleKawaii();
let themeChoisi = "bordeaux";
try { themeChoisi = localStorage.getItem(CLE_THEME) || "bordeaux"; } catch (e) {}
if (themeChoisi === "violet") themeChoisi = "soleil"; // ancien thème, remplacé par Soleil couchant
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

// Kawaii : petits personnages qui lévitent sur l'écran d'accueil (répartis en grille, un peu décalés au hasard)
const zoneFlotteurs = document.getElementById("kawaiiFlotteurs");
const personnagesKawaii = ["coeur", "licorne", "etoile", "nuage", "chat", "cupcake", "arcenciel", "lapin", "bulle", "fraise", "sucette", "chat",
  "bulle", "fleur", "macaron", "poussin", "glace", "coeur", "etoile", "chou"];
for (let i = 0; i < 36; i++) {
  const nom = personnagesKawaii[i % personnagesKawaii.length];
  const perso = document.createElement("span");
  const taille = 16 + Math.random() * 14;
  const duree = 1.1 + Math.random() * 1.3;
  perso.style.left = `${(i % 6) * 16 + Math.random() * 10}%`;
  perso.style.top = `${Math.floor(i / 6) * 16 + 1 + Math.random() * 10}%`;
  perso.style.width = perso.style.height = `${taille}px`;
  perso.style.backgroundImage = `url("stickers/${nom}.svg")`;
  // trajet de dérive propre à chacun (4 points, en boucle) : ils se baladent dans tous les sens
  const hasard = (m) => `${Math.round((Math.random() * 2 - 1) * m)}px`;
  for (let k = 1; k <= 3; k++) { perso.style.setProperty(`--x${k}`, hasard(28)); perso.style.setProperty(`--y${k}`, hasard(28)); }
  perso.style.setProperty("--r1", `${Math.round((Math.random() * 2 - 1) * 25)}deg`);
  perso.style.setProperty("--r2", `${Math.round((Math.random() * 2 - 1) * 25)}deg`);
  perso.style.animationDuration = `${duree * 2.5}s`;
  perso.style.animationDelay = `${-Math.random() * duree}s`;
  zoneFlotteurs.appendChild(perso);
}
// ... et des paillettes roses qui scintillent
for (let i = 0; i < 46; i++) {
  const paillette = document.createElement("i");
  const taille = 6 + Math.random() * 8;
  const duree = 0.8 + Math.random() * 1.4;
  paillette.style.left = `${Math.random() * 98}%`;
  paillette.style.top = `${Math.random() * 98}%`;
  paillette.style.width = paillette.style.height = `${taille}px`;
  paillette.style.animationDuration = `${duree}s`;
  paillette.style.animationDelay = `${-Math.random() * duree}s`;
  zoneFlotteurs.appendChild(paillette);
}

document.querySelectorAll(".pastilleTheme").forEach((pastille) => {
  pastille.addEventListener("click", () => {
    // Changement de thème : la musique d'ambiance se coupe (on la réactive soi-même dans les réglages)
    if (caseMusique.checked && pastille.dataset.theme !== document.documentElement.dataset.theme) {
      caseMusique.checked = false;
      ecrireReglage(CLE_MUSIQUE, false);
      majLigneMusique();
    }
    appliquerTheme(pastille.dataset.theme, barreIphoneARafraichir());
    try { localStorage.setItem(CLE_THEME, pastille.dataset.theme); } catch (e) {}
    try { setTimeout(majNoteMusiqueHorsLigne, 300); } catch (e) {} // (la ligne « Hors connexion » sous le volume de la musique)
    try { noterAppareilStats(); } catch (e) {} // statistiques : thème choisi
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
  if (caseModeSoft.checked) jouerSon("sons_on");
});

// ===== Partie express : moins de cartes (voir CARTES_EXPRESS dans js/plateau.js) =====
// Classique : le réglage de ce téléphone, gardé avec la partie (reprise comprise). En ligne : celui de
// la personne qui lance la manche, transmis dans la graine du mélange (voir lancerMancheEnLigne).
const CLE_PARTIE_EXPRESS = "alcuno_partie_express";
const casePartieExpress = document.getElementById("optionPartieExpress");
casePartieExpress.checked = lireReglage(CLE_PARTIE_EXPRESS, false);
casePartieExpress.addEventListener("change", () => {
  ecrireReglage(CLE_PARTIE_EXPRESS, casePartieExpress.checked);
  if (casePartieExpress.checked) jouerSon("sons_on");
});
function estPartieExpress(){ return casePartieExpress.checked; }

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
// ===== Faces ouvertes / faces fermées =====
// Faces fermées : une carte retournée se recache (dos grisé) une fois son annonce passée : on ne peut plus
// compter les cartes sorties pour le pari de fin. Purement visuel (le jeu sait toujours ce qui est sorti).
// En ligne : le réglage de l'hôte, gardé dans la partie (parties/CODE/faces).
const CLE_FACES_FERMEES = "alcuno_faces_fermees";
let facesPartieEnLigne = false;
function estFacesFermees(){
  return codePartieActuel ? facesPartieEnLigne : lireReglage(CLE_FACES_FERMEES, false);
}
function majFacesFermees(){
  const fermees = estFacesFermees();
  document.documentElement.classList.toggle("faces-fermees", fermees);
}
function choisirFacesEnLigne(fermees){
  facesPartieEnLigne = !!fermees;
  majFacesFermees();
}
const caseFacesFermees = document.getElementById("optionFacesFermees");
caseFacesFermees.checked = lireReglage(CLE_FACES_FERMEES, false);
caseFacesFermees.addEventListener("change", () => {
  ecrireReglage(CLE_FACES_FERMEES, caseFacesFermees.checked);
  majFacesFermees();
  if (caseFacesFermees.checked) jouerSon("cartes"); // le son des cartes qui se retournent
});
majFacesFermees();

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

let volumeSons = 30; // (30 % de base)
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

// ===== Musique d'ambiance : Sons/musique_ambiance_<thème>.mp3 (givre, cerisier, prestige, soleil, galaxie, sombre,
// kawaii),
// sinon Sons/musique_ambiance.mp3 (bordeaux, casino, nuit). En boucle, à son propre volume.
// Quand ce téléphone caste, c'est la télé qui la joue (à ce volume, avec le thème du téléphone).
const CLE_MUSIQUE = "alcuno_musique";
const CLE_VOLUME_MUSIQUE = "alcuno_volume_musique";
const THEMES_AVEC_MUSIQUE = ["givre", "cerisier", "prestige", "soleil", "galaxie", "noir", "kawaii"];
const NOM_FICHIER_MUSIQUE = { noir: "sombre" }; // thème « noir » (affiché Sombre) : musique_ambiance_sombre.mp3
const caseMusique = document.getElementById("optionMusique");
const curseurMusique = document.getElementById("volumeMusique");
const ligneVolumeMusique = document.getElementById("ligneVolumeMusique");
caseMusique.checked = lireReglage(CLE_MUSIQUE, false); // (désactivée de base)
let volumeMusique = 30;
try {
  const v = localStorage.getItem(CLE_VOLUME_MUSIQUE);
  if (v !== null && Number(v) >= 0 && Number(v) <= 100) volumeMusique = Number(v);
} catch (e) {}
curseurMusique.value = volumeMusique;

function majLigneMusique(){
  document.getElementById("volumeMusiqueValeur").innerText = volumeMusique + " %";
  curseurMusique.disabled = !caseMusique.checked;
  ligneVolumeMusique.classList.toggle("inactif", !caseMusique.checked);
}
majLigneMusique();
caseMusique.addEventListener("change", () => {
  ecrireReglage(CLE_MUSIQUE, caseMusique.checked);
  majLigneMusique();
  majMusique();
  if (caseMusique.checked) setTimeout(garderMusiquesPourHorsLigne, 1500); // (musique activée : on la garde pour le mode avion)
});
curseurMusique.addEventListener("input", () => {
  volumeMusique = Number(curseurMusique.value);
  try { localStorage.setItem(CLE_VOLUME_MUSIQUE, String(volumeMusique)); } catch (e) {}
  majLigneMusique();
  majMusique();
});

// Lecture en boucle sans à-coup : le morceau est décodé en entier (Web Audio), les blancs ajoutés par
// l'encodage MP3 au début et à la fin sont retirés, et chaque tour repart pile à la fin du précédent
// (boucles faites pour s'enchaîner : un long fondu décalait le rythme), avec juste un micro-fondu pour
// éviter un clic. Volume égalisé d'un morceau à l'autre (certains sont mixés bien plus fort).
// Tous les morceaux sont préparés à l'avance : changer de thème ne fait pas attendre.
const FONDU_MUSIQUE = 0.006; // secondes (micro-fondu aux raccords, contre les clics)
const MONTEE_MUSIQUE = 0.8;  // secondes de fondu au démarrage (lancement, retour dans l'appli, thème)
// Boucles « exactes » : le fichier contient la boucle, précédée de sa fin et suivie de son début (avant :
// secondes de pré-roulé). On joue pile « longueur » secondes à partir de « avant », et chaque raccord est
// un court fondu linéaire entre deux copies du même son : aucun creux, aucun saut. Ne dépend pas des
// blancs ajoutés par l'encodage MP3 (l'iPhone ne les retire pas toujours) : un départ décalé de quelques
// ms tombe encore dans le pré-roulé, qui est la suite exacte de la boucle.
const BOUCLES_EXACTES = {
  musique_ambiance_soleil: { avant: 0.3, longueur: 903552 / 44100 }, // 8 mesures à 93,7 BPM
  musique_ambiance_sombre: { avant: 0.3, longueur: 2903870 / 44100 }, // 65,85 s (de 11 s à 1 min 17 du morceau, qui se répète)
  musique_ambiance_kawaii: { avant: 0.3, longueur: 4111952 / 44100 }, // 93,24 s = 64 mesures à 164,7 BPM (de 25,5 s à 1 min 58,8 du morceau)
  musique_ambiance_galaxie: { avant: 0.3, longueur: 7898850 / 44100 }, // 179,11 s (de 10,7 s à 3 min 10 du morceau, qui se répète)
  debloquage_theme_galaxie: { avant: 0.3, longueur: 4201001 / 44100 }, // 95,26 s (générique du thème Star Wars)
};
const FONDU_BOUCLE_EXACTE = 0.03;
const musiquesDecodees = {}; // nom => { buffer, debut, fin } | null (fichier absent) | promesse en cours
let lecteurMusique = null;   // { ctx, maitre, nom, morceau, sources: [{ src, gain }], minuteur, actif }
let musiqueTele = null;      // page de la télé : { volume, theme, enPartie } reçus du téléphone (null : pas de musique)
let pauseMusiqueTele = false; // page de la télé : la partie est en pause sur le téléphone (js/tele.js)

// Musique coupée par la pause de la partie : elle reprendra au même endroit (voir majMusique)
function musiqueMiseEnPause(){
  if (document.documentElement.classList.contains("mode-tele")) return pauseMusiqueTele;
  try { return !!pauseEnCours; } catch (e) { return false; } // (js/plateau.js)
}

function fichierMusique(theme){
  return THEMES_AVEC_MUSIQUE.includes(theme) ? `musique_ambiance_${NOM_FICHIER_MUSIQUE[theme] || theme}` : "musique_ambiance";
}

function musiqueVoulue(){
  if (document.documentElement.classList.contains("mode-tele")) return musiqueTele;
  if (!caseMusique.checked || volumeMusique === 0 || document.visibilityState !== "visible") return null;
  let caste = false, enPause = false;
  try { caste = !!codeTele; } catch (e) {} // (js/tele.js, chargé en dernier)
  try { enPause = !!pauseEnCours; } catch (e) {} // (js/plateau.js) : pas de musique pendant la pause
  if (caste || enPause) return null;
  let enPartie = false, menuNouvellePartie = false;
  try { enPartie = !!partieLancee; } catch (e) {} // (js/plateau.js)
  try { menuNouvellePartie = enPartie && ecranNouvellePartieOuvert(); } catch (e) {} // (js/regles.js)
  return { volume: volumeMusique, theme: document.documentElement.dataset.theme || "bordeaux", enPartie, menuNouvellePartie };
}

// Pendant une partie, la musique est à 45 % de son niveau des menus ; sur l'écran « Nouvelle partie »
// (pendant une partie), encore un peu plus bas
const VOLUME_MUSIQUE_EN_PARTIE = 0.45;
const VOLUME_MUSIQUE_NOUVELLE_PARTIE = 0.6;

// Sons forts (carte dorée, pigeon, « TIENS DANS TA GUEULE ») : la musique descend à 25 % pendant le son,
// puis remonte en 1 s : ces moments ressortent au lieu d'être couverts par la musique
const SONS_QUI_BAISSENT_LA_MUSIQUE = ["doree", "pigeon", "tiens_gueule"];
function attenuerMusique(duree){
  const L = lecteurMusique;
  if (!L || !L.actif) return;
  const g = L.attenuation.gain, t = L.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(0.25, t + 0.15);
  g.setValueAtTime(0.25, t + 0.15 + duree);
  g.linearRampToValueAtTime(1, t + 1.15 + duree);
}

// Début et fin du vrai son (sans les blancs d'encodage)
function bornesMusique(buffer){
  const seuil = 0.00005; // (vrai silence seulement : on ne rogne pas le début d'une note douce)
  const canaux = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) canaux.push(buffer.getChannelData(c));
  const fort = (i) => canaux.some(d => Math.abs(d[i]) > seuil);
  let debut = 0;
  while (debut < buffer.length - 1 && !fort(debut)) debut++;
  let fin = buffer.length - 1;
  while (fin > debut && !fort(fin)) fin--;
  // Volume moyen du morceau => réglage pour qu'ils sonnent tous pareil (référence : -20 dB)
  let somme = 0, n = 0;
  const pas = Math.max(1, Math.floor(buffer.length / 200000));
  for (let i = debut; i <= fin; i += pas) { for (const d of canaux) { somme += d[i] * d[i]; n++; } }
  const db = 10 * Math.log10(somme / Math.max(1, n) + 1e-12);
  const egalisation = Math.min(2, Math.pow(10, (-20 - db) / 20));
  return { debut: debut / buffer.sampleRate, fin: (fin + 1) / buffer.sampleRate, egalisation };
}

// Téléchargement raté (réseau) : pas retenu comme « absent », réessayé 10 s plus tard au plus tôt (comme
// les sons, voir chargerSon). Seul un fichier qui n'existe pas (404) est retenu comme absent.
const musiquesRateesA = {}; // nom => moment du dernier téléchargement raté
function chargerMusique(ctx, nom){
  // (morceau déjà prêt, null, ou téléchargement en cours : pas de 2e téléchargement du même fichier)
  if (musiquesDecodees[nom] !== undefined) return Promise.resolve(musiquesDecodees[nom]);
  if (musiquesRateesA[nom] && Date.now() - musiquesRateesA[nom] < 10000) return Promise.resolve(null);
  const promesse = fetch(`Sons/${nom}.mp3`)
    .then((reponse) => {
      if (reponse.status === 404) return null;
      if (!reponse.ok) throw new Error("réseau");
      return reponse.arrayBuffer()
        .then((donnees) => new Promise((ok, ko) => ctx.decodeAudioData(donnees, ok, ko)))
        .then((buffer) => Object.assign({ buffer, exacte: BOUCLES_EXACTES[nom] || null }, bornesMusique(buffer)));
    })
    .then((morceau) => { musiquesDecodees[nom] = morceau; return morceau; },
          () => { delete musiquesDecodees[nom]; musiquesRateesA[nom] = Date.now(); return null; });
  musiquesDecodees[nom] = promesse;
  return promesse;
}

// Courbes de fondu à puissance constante (montée sinus, descente cosinus)
function courbeFondu(montee, max){
  const n = 64, courbe = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * Math.PI / 2;
    courbe[i] = (montee ? Math.sin(x) : Math.cos(x)) * max;
  }
  return courbe;
}

// Un tour de boucle qui commence à l'instant t (montée sur « montee » secondes), puis programme le suivant.
// decalage : on démarre ce tour-là à cet endroit de la boucle (reprise après la pause)
function jouerTourMusique(L, t, montee, decalage = 0){
  if (!L.actif || !L.morceau) return;
  const { buffer, egalisation, exacte } = L.morceau;
  const src = L.ctx.createBufferSource();
  src.buffer = buffer;
  const gain = L.ctx.createGain();
  src.connect(gain);
  gain.connect(L.maitre);
  let longueur, fondu;
  if (exacte) {
    // Boucle exacte : ce tour déborde de « fondu » sur la suite (le début de la boucle, copié dans le
    // fichier) en descendant pendant que le suivant monte : même son des deux côtés, somme constante
    longueur = exacte.longueur;
    if (!(decalage >= 0 && decalage < longueur - 0.5)) decalage = 0;
    const reste = longueur - decalage;
    fondu = FONDU_BOUCLE_EXACTE;
    gain.gain.setValueAtTime(0, t);
    if (montee > fondu) gain.gain.setValueCurveAtTime(courbeFondu(true, egalisation), t, Math.min(montee, reste / 3));
    else gain.gain.linearRampToValueAtTime(egalisation, t + fondu);
    gain.gain.setValueAtTime(egalisation, t + reste);
    gain.gain.linearRampToValueAtTime(0, t + reste + fondu);
    src.start(t, exacte.avant + decalage, reste + fondu);
  } else {
    longueur = L.morceau.fin - L.morceau.debut;
    if (!(decalage >= 0 && decalage < longueur - 0.5)) decalage = 0;
    const reste = longueur - decalage;
    fondu = Math.min(FONDU_MUSIQUE, longueur / 4);
    montee = Math.max(fondu, Math.min(montee, reste / 3));
    gain.gain.setValueAtTime(0, t);
    gain.gain.setValueCurveAtTime(courbeFondu(true, egalisation), t, montee);
    gain.gain.setValueCurveAtTime(courbeFondu(false, egalisation), t + reste - fondu, fondu);
    src.start(t, L.morceau.debut + decalage, reste);
  }
  // (début de la boucle en cours, pour savoir où on en est à la pause)
  L.tourDebut = t - decalage;
  L.tourLongueur = longueur;
  const piste = { src, gain };
  L.sources.push(piste);
  src.onended = () => { L.sources = L.sources.filter(p => p !== piste); };
  // Le tour suivant démarre pile à la fin de celui-ci (programmé un peu à l'avance)
  const suivant = t + longueur - decalage;
  clearTimeout(L.minuteur);
  L.minuteur = setTimeout(() => jouerTourMusique(L, suivant, fondu),
    Math.max(0, (suivant - L.ctx.currentTime - 1.5) * 1000));
}

// Arrête en douceur tout ce qui joue
function eteindreMusique(L, duree){
  if (!L) return;
  L.actif = false;
  clearTimeout(L.minuteur);
  const t = L.ctx.currentTime;
  L.sources.forEach(({ src, gain }) => {
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + duree);
      src.stop(t + duree + 0.05);
    } catch (e) {}
  });
}

function majMusique(){
  const voulu = musiqueVoulue();
  if (!voulu) {
    const L = lecteurMusique;
    if (L && L.actif) {
      // Pause de la partie : on retient où en est la boucle, la reprise repartira de là
      const position = L.tourLongueur ? (((L.ctx.currentTime - L.tourDebut) % L.tourLongueur) + L.tourLongueur) % L.tourLongueur : 0;
      L.reprise = musiqueMiseEnPause() ? { nom: L.nom, position } : null;
      eteindreMusique(L, 0.4);
    }
    return;
  }
  const ctx = contexteAudio();
  if (!ctx) return;
  if (!lecteurMusique || lecteurMusique.ctx !== ctx) {
    if (lecteurMusique) eteindreMusique(lecteurMusique, 0.05);
    const maitre = ctx.createGain();
    const attenuation = ctx.createGain(); // baisse le temps des sons forts (voir attenuerMusique)
    maitre.connect(attenuation);
    attenuation.connect(ctx.destination);
    lecteurMusique = { ctx, maitre, attenuation, nom: "", morceau: null, sources: [], minuteur: null, actif: false,
                       enChargement: false, enPartie: false };
  }
  const L = lecteurMusique;
  // Volume (en douceur). Pleine musique dans les menus (accueil, réglages, salle d'attente, ajout des
  // joueurs) ; pendant la partie, juste un fond (on parle, et les sons du jeu doivent ressortir).
  // Passage menu <=> partie en un fondu plus long.
  const niveau = Math.pow(voulu.volume / 100, 2) * 0.5 * (voulu.enPartie ? VOLUME_MUSIQUE_EN_PARTIE : 1) *
    (voulu.menuNouvellePartie ? VOLUME_MUSIQUE_NOUVELLE_PARTIE : 1);
  const rampe = L.enPartie !== voulu.enPartie ? 1.5 : 0.3;
  L.enPartie = voulu.enPartie;
  L.maitre.gain.cancelScheduledValues(ctx.currentTime);
  L.maitre.gain.setValueAtTime(L.maitre.gain.value, ctx.currentTime);
  L.maitre.gain.linearRampToValueAtTime(niveau, ctx.currentTime + rampe);

  const nom = fichierMusique(voulu.theme);
  if (L.nom === nom && (L.actif || L.enChargement)) return; // (déjà en train de jouer / de préparer ce morceau)
  L.nom = nom;
  L.enChargement = true;
  chargerMusique(ctx, nom).then((morceau) => {
    if (!morceau && nom !== "musique_ambiance") return chargerMusique(ctx, "musique_ambiance");
    return morceau;
  }).then((morceau) => {
    if (lecteurMusique !== L || L.nom !== nom) return;
    L.enChargement = false;
    if (!morceau || !musiqueVoulue()) return;
    // L'ancien morceau (autre thème) continue jusqu'ici, puis s'éteint pendant que le nouveau monte
    if (L.actif) eteindreMusique(L, MONTEE_MUSIQUE);
    L.actif = true;
    L.morceau = morceau;
    // après une pause : on reprend la même musique là où elle s'était arrêtée
    const reprise = L.reprise && L.reprise.nom === nom ? L.reprise.position : 0;
    L.reprise = null;
    jouerTourMusique(L, ctx.currentTime + 0.05, MONTEE_MUSIQUE, reprise);
    preparerToutesLesMusiques(ctx);
  });
}

// Les autres morceaux sont téléchargés et décodés en arrière-plan, l'un après l'autre
let musiquesPreparees = false;
// Les morceaux à avoir : pas la musique des thèmes secrets Star Wars et Kawaii tant qu'ils ne sont pas débloqués (3-4 Mo pour rien)
function nomsMusiquesAPreparer(){
  return ["musique_ambiance"].concat(THEMES_AVEC_MUSIQUE
    .filter(t => (t !== "galaxie" || galaxieDebloquee()) && (t !== "kawaii" || kawaiiDebloque())).map(fichierMusique));
}
function preparerToutesLesMusiques(ctx){
  if (musiquesPreparees) return;
  musiquesPreparees = true;
  nomsMusiquesAPreparer().reduce((suite, nom) => suite.then(() => chargerMusique(ctx, nom)), Promise.resolve());
}

// Musique hors connexion (mode avion) : quand la musique est activée et qu'il y a du réseau, tous les morceaux disponibles sont
// téléchargés tout de suite, en arrière-plan (celui du thème en cours d'abord, deux à la fois) pour que le service worker (sw.js) les
// garde. Un morceau déjà gardé n'est pas retéléchargé ; pas en économie de données. Une ligne sous le volume de la musique dit où
// on en est (« 5 / 8 prêtes ») pour savoir quand on peut couper le réseau. Reprend aussi quand une nouvelle version de l'appli prend la
// main ou que le réseau revient.
const noteMusiqueHorsLigne = document.getElementById("noteMusiqueHorsLigne");
function musiquesAGarder(){ // (ordre de priorité : thème en cours, musique de base, thèmes débloqués)
  const actuel = fichierMusique(document.documentElement.dataset.theme || "bordeaux");
  return Array.from(new Set([actuel].concat(nomsMusiquesAPreparer())));
}
const musiqueGardee = async (nom) => { try { return !!(await caches.match(`Sons/${nom}.mp3`)); } catch (e) { return false; } };
// Bloc « Utilisable hors connexion » des Réglages : les fichiers du jeu sont-ils gardés ? (plus les musiques, comptées plus bas)
const ligneHorsLigne = document.getElementById("ligneHorsLigne");
const FICHIERS_JEU_HORS_LIGNE = ["index.html", "script.js", "style_alcuno.css", "js/plateau.js", "js/reglages.js"];
async function majStatutHorsLigne(pretes, total){
  const texte = document.getElementById("texteHorsLigne"), pastille = document.getElementById("pastilleHorsLigne");
  let etat, message;
  if (!(window.caches && navigator.serviceWorker)) { etat = "non"; message = "Pas possible sur ce navigateur."; }
  else {
    let jeuPret = false;
    try { jeuPret = (await Promise.all(FICHIERS_JEU_HORS_LIGNE.map((f) => caches.match(f)))).every(Boolean); } catch (e) {}
    if (!jeuPret) { etat = "attente"; message = "Pas encore prêt : reste connecté et rouvre le jeu une fois."; }
    else if (pretes < total) { etat = "attente"; message = `Le jeu est prêt. Musiques : ${pretes} / ${total} gardées (active la musique en ligne pour les garder).`; }
    else { etat = "ok"; message = "Prêt : le jeu et les musiques marchent sans réseau (mode avion)."; }
  }
  ligneHorsLigne.dataset.etat = etat;
  texte.textContent = message;
  pastille.textContent = etat === "ok" ? "✓" : etat === "non" ? "✕" : "…";
}
async function majNoteMusiqueHorsLigne(){
  // (visible aussi quand la musique est coupée : changer de thème la coupe, et on veut quand même voir si elle est prête hors connexion)
  const ok = window.caches && navigator.serviceWorker && navigator.serviceWorker.controller;
  noteMusiqueHorsLigne.hidden = !ok;
  if (!ok) { majStatutHorsLigne(0, 1); return; }
  const noms = musiquesAGarder();
  let pretes = 0;
  for (const nom of noms) if (await musiqueGardee(nom)) pretes++;
  majStatutHorsLigne(pretes, noms.length);
  noteMusiqueHorsLigne.textContent = pretes >= noms.length
    ? "Hors connexion : musiques prêtes ✓"
    : !caseMusique.checked ? `Hors connexion : ${pretes} / ${noms.length} prêtes. Active la musique pour télécharger le reste.`
    : gardeMusiquesEnCours ? `Hors connexion : téléchargement (${pretes} / ${noms.length})…`
    : navigator.onLine ? `Hors connexion : ${pretes} / ${noms.length} prêtes, téléchargement à venir…`
    : `Hors connexion : ${pretes} / ${noms.length} prêtes (le reste demande du réseau)`;
}
let gardeMusiquesEnCours = false;
function garderMusiquesPourHorsLigne(){
  majNoteMusiqueHorsLigne();
  if (gardeMusiquesEnCours || !caseMusique.checked || !navigator.onLine || !window.caches) return;
  if (!(navigator.serviceWorker && navigator.serviceWorker.controller)) return; // (c'est lui qui garde les fichiers)
  if (navigator.connection && navigator.connection.saveData) return;
  gardeMusiquesEnCours = true;
  majNoteMusiqueHorsLigne();
  const noms = musiquesAGarder();
  let suivant = 0;
  const ouvrier = async () => {
    while (suivant < noms.length) {
      const nom = noms[suivant++];
      try {
        if (await musiqueGardee(nom)) continue;
        const reponse = await fetch(`Sons/${nom}.mp3`);
        if (reponse.ok) await reponse.arrayBuffer(); // (lu en entier : le service worker en garde alors une copie)
      } catch (e) {}
      majNoteMusiqueHorsLigne();
    }
  };
  Promise.all([ouvrier(), ouvrier()]).then(() => { gardeMusiquesEnCours = false; majNoteMusiqueHorsLigne(); },
    () => { gardeMusiquesEnCours = false; majNoteMusiqueHorsLigne(); });
}
window.addEventListener("load", () => setTimeout(garderMusiquesPourHorsLigne, 800));
window.addEventListener("online", () => setTimeout(garderMusiquesPourHorsLigne, 500));
window.addEventListener("offline", majNoteMusiqueHorsLigne);
if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("controllerchange", () => setTimeout(garderMusiquesPourHorsLigne, 800));
document.getElementById("btnReglages").addEventListener("click", () => setTimeout(garderMusiquesPourHorsLigne, 300));
document.addEventListener("visibilitychange", () => {
  // Appli quittée : le téléphone suspend le son presque aussitôt. Le fondu de 0,4 s de majMusique était
  // coupé net en plein volume (petit « bip » en quittant) : on éteint tout de suite, en 40 ms
  if (document.visibilityState !== "visible" && lecteurMusique && lecteurMusique.actif) eteindreMusique(lecteurMusique, 0.04);
  setTimeout(majMusique, 0);
});
setInterval(majMusique, 2000); // (début ou fin du cast, changement de thème)

let contexteSon = null;
let sonInterrompu = false; // iPhone : le son a été interrompu depuis le dernier tap (voir debloquerSon)
let repriseRatee = false; // au tap précédent, le son était coupé et la reprise n'a pas marché
function contexteAudio(){
  if (contexteSon && contexteSon.state === "closed") contexteSon = null;
  if (!contexteSon) {
    const Contexte = window.AudioContext || window.webkitAudioContext;
    if (!Contexte) return null;
    try { contexteSon = new Contexte(); } catch (e) { return null; }
    contexteSon.onstatechange = function(){ if (this.state === "interrupted") sonInterrompu = true; };
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
// iPhone : le son ne se débloque qu'à la fin du toucher (doigt relevé) ou au clic, pas au début du
// toucher. En classique, ça passait quand même (le son de la carte est joué dans le clic) ; en ligne,
// tous les sons arrivent plus tard par Firebase : sans ça, le son n'était jamais débloqué.
function debloquerSon(){
  if (!caseSons.checked && !caseMusique.checked) return;
  // iPhone : après une interruption (centre de contrôle, appel, Siri…), le son repartait parfois dans
  // l'écouteur du haut, beaucoup plus faible (la musique « baissait » toute seule). Au tap suivant, on
  // repart d'un contexte de son neuf (la musique reprend au début, en fondu).
  if (sonInterrompu && contexteSon) {
    sonInterrompu = false;
    try { contexteSon.close(); } catch (e) {}
    contexteSon = null;
  }
  if (contexteSon && contexteSon.state !== "running" && repriseRatee) {
    try { contexteSon.close(); } catch (e) {}
    contexteSon = null;
  }
  const ctx = contexteAudio();
  chargerSons();
  repriseRatee = false;
  // Musique lancée (ou relancée : après un rechargement de la page, l'iPhone attend un tap) pendant le
  // geste lui-même : seul moment où l'iPhone accepte de la jouer
  majMusique();
  if (!ctx || ctx.state === "running") return;
  // Un son muet joué pendant le geste : ce qui débloque vraiment le son sur iPhone
  try {
    const muet = ctx.createBufferSource();
    muet.buffer = ctx.createBuffer(1, 1, 22050);
    muet.connect(ctx.destination);
    muet.start(0);
  } catch (e) {}
  setTimeout(() => { repriseRatee = ctx.state !== "running"; }, 300);
}
["pointerdown", "touchend", "click"].forEach((type) => {
  document.addEventListener(type, debloquerSon, { capture: true, passive: true });
});
// Après la caméra (scan du QR code) : l'iPhone peut laisser le son coupé ou l'envoyer dans l'écouteur
// du haut. On repart d'un contexte de son neuf, relancé au prochain tap (les sons chargés resservent).
function repartirSonApresCamera(){
  if (!contexteSon) return;
  try { contexteSon.close(); } catch (e) {}
  contexteSon = null;
}
// Retour dans l'appli : on relance le son tout de suite, et la barre du haut reprend la couleur du thème.
// Après plus de 20 s ailleurs, on repart aussi d'un contexte de son neuf au premier tap (comme après une
// interruption, voir debloquerSon) : l'iPhone rendait parfois un son « en marche » mais muet, et le jeu
// restait sans son jusqu'à son redémarrage.
const RETOUR_SON_NEUF = 20 * 1000;
let appliQuitteeA = null;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") { appliQuitteeA = Date.now(); return; }
  if (appliQuitteeA && Date.now() - appliQuitteeA > RETOUR_SON_NEUF && contexteSon) sonInterrompu = true;
  appliQuitteeA = null;
  if (contexteSon && contexteSon.state !== "running") contexteSon.resume().catch(() => {});
  peindreBarreTelephone();
});

// Fichiers des sons : dossier Sons/, un MP3 par moment du jeu. Pour changer un son, il suffit de
// remplacer le fichier (même nom). Fichier absent => pas de son à ce moment-là.
//   cartes.mp3  : une carte est retournée sur le plateau
//   doree.mp3   : quelqu'un tire la carte dorée (coupé à 3 s, voir DUREE_MAX_SONS)
//   pigeon.mp3  : quelqu'un devient pigeon (premier pigeon ou nouveau pigeon ; coupé à 2 s)
//   tour.mp3    : c'est ton tour et tu n'as toujours pas joué (toutes les 50 s ; en ligne et en classique)
//   eau.mp3     : rappel « Bois de l'eau »
//   sons_on.mp3 : on active les sons dans les réglages
//   credits.mp3 : 4 taps sur le titre ALCUNO (écran des créateurs)
//   reglage_son.mp3 : on lâche le curseur de volume dans les réglages (pour entendre le volume)
//   no_wifi.mp3 : en ligne, coupure de réseau (une fois, quand le logo wifi barré apparaît)
//   distribuer_gorgees.mp3 : +4, on tape sur un joueur pour lui donner une gorgée (coupé à 0,8 s)
//   annuler_gorgees.mp3 : quelqu'un annule 1 gorgée ou plus
//   annuler_0_gorgees.mp3 : quelqu'un tape « Annuler 0 » (il n'annule rien)
//   tiens_gueule.mp3 : le cul sec de la carte dorée (« TIENS DANS TA GUEULE »)
//   regles.mp3 : on ouvre les Règles du jeu (boutons « Règles du jeu » de l'accueil et de la partie)
//   accessibilite_on.mp3 : on active « Accessibilité pour les gens bourrés » dans les réglages
const SONS = ["cartes", "doree", "tiens_gueule", "bouton", "pigeon", "tour", "eau", "sons_on", "credits", "reglage_son", "no_wifi", "distribuer_gorgees", "annuler_gorgees", "annuler_0_gorgees", "regles", "accessibilite_on"]; // (les sons de sabre ne se chargent que dans le thème Star Wars, voir morceauSabre)
// Sons de sabre : Sons/sabre/sabre_01.mp3 à sabre_54.mp3 (0,8 s chacun). Le clic des boutons en joue un au
// hasard (jouerSon("bouton")). Si tu en supprimes, retire aussi leur nom de cette liste (et de SONS_A_PRECHARGER dans sw.js) ; un nom sans fichier est simplement ignoré (404).
const SONS_SABRE = ["sabre/sabre_01", "sabre/sabre_02", "sabre/sabre_05", "sabre/sabre_07", "sabre/sabre_09", "sabre/sabre_11", "sabre/sabre_14", "sabre/sabre_15", "sabre/sabre_18", "sabre/sabre_22", "sabre/sabre_24", "sabre/sabre_26", "sabre/sabre_31", "sabre/sabre_33", "sabre/sabre_35", "sabre/sabre_37", "sabre/sabre_38", "sabre/sabre_40", "sabre/sabre_41", "sabre/sabre_48", "sabre/sabre_54"];
// Sons coupés au bout de N secondes (avec un petit fondu), même si le fichier est plus long
const DUREE_MAX_SONS = { doree: 3, pigeon: 2, distribuer_gorgees: 0.8, bouton: 0.3 };
const sonsCharges = {}; // nom -> son décodé (ou null si le fichier n'existe pas)
const sonsDemandes = {}; // nom -> moment où il a été demandé alors qu'il n'était pas encore chargé
const sonsEnChargement = new Set();
const sonsRatesA = {}; // nom -> moment du dernier téléchargement raté (réseau)

// Téléchargement raté (réseau qui coupe, serveur qui ne répond pas) : réessayé au prochain son, 10 s plus
// tard au plus tôt. Avant, le son était marqué absent : il ne se jouait plus jusqu'au redémarrage de l'appli.
// Seul un fichier qui n'existe pas (404) est abandonné.
function chargerSon(ctx, nom){
  if (sonsCharges[nom] !== undefined || sonsEnChargement.has(nom)) return;
  if (sonsRatesA[nom] && Date.now() - sonsRatesA[nom] < 10000) return;
  sonsEnChargement.add(nom);
  fetch(`Sons/${nom}.mp3?t=${window.ANTI_CACHE || Date.now()}`)
    .then((reponse) => {
      if (reponse.status === 404) { sonsCharges[nom] = null; return null; } // (pas de son à ce moment-là)
      if (!reponse.ok) throw new Error("réseau");
      return reponse.arrayBuffer();
    })
    .then((donnees) => {
      if (!donnees) return;
      return new Promise((ok, ko) => ctx.decodeAudioData(donnees, ok, ko)).then((son) => {
        sonsCharges[nom] = son;
        // Demandé juste avant d'être chargé (tout premier tap) : joué maintenant, si c'était il y a < 1,5 s
        if (sonsDemandes[nom] && Date.now() - sonsDemandes[nom] < 1500) lireSon(nom, son);
        delete sonsDemandes[nom];
      }, () => { sonsRatesA[nom] = Date.now(); }); // (décodage raté, ex. moteur du son recréé entre-temps)
    })
    .catch(() => { sonsRatesA[nom] = Date.now(); })
    .finally(() => { sonsEnChargement.delete(nom); });
}

function chargerSons(){
  const ctx = contexteAudio();
  if (!ctx) return;
  SONS.forEach((nom) => chargerSon(ctx, nom));
}

// carte | doree | culsec | pigeon | tour | eau
// Petit son de clic (Sons/bouton.mp3) sur les boutons, sauf ceux qui ont déjà leur propre son
// (annuler des gorgées, distribuer au +4, choisir le pigeon ou la victime de la carte dorée), et sauf
// Réglages, « Signaler un bug » et « Copier le diagnostic » (silencieux)
const BOUTONS_AVEC_LEUR_SON = ".bouton-annulation, .plus4-joueur-btn, #overlayPigeon .bouton-pigeon, .bouton-doree, " +
  "#btnReglages, #btnSignalerBug, #btnDiagnostic, #btnRegles, #btnReglesJeu, #bandeauMiseAJour .maj, .fenetreGalaxie-ok";
document.addEventListener("click", (e) => {
  if (!e.isTrusted || document.documentElement.classList.contains("mode-tele")) return;
  if (Date.now() - sonBoutonJoueLe < 500) return; // déjà joué au doigt levé (activerMemePendantElan)
  const bouton = e.target && e.target.closest && e.target.closest("button, [role='button']");
  if (!bouton || bouton.disabled || bouton.matches(BOUTONS_AVEC_LEUR_SON)) return;
  // (choix d'un thème : toujours le clic normal, même dans le thème Star Wars)
  jouerSon("bouton", bouton.classList.contains("pastilleTheme"));
}, { capture: true, passive: true });

// Thème Star Wars seulement : un son de sabre au hasard, parmi ceux qui existent encore dans Sons/sabre/
// (ou pas encore chargés). Dans les autres thèmes, le clic reste le son « bouton ».
function morceauSabre(){
  if (document.documentElement.dataset.theme !== "galaxie") return "bouton";
  const ctx = contexteAudio();
  if (ctx) SONS_SABRE.forEach((n) => chargerSon(ctx, n));
  const dispo = SONS_SABRE.filter((n) => sonsCharges[n] !== null);
  return dispo.length ? dispo[Math.floor(Math.random() * dispo.length)] : "bouton";
}

// clicNormal : le son « bouton » d'origine, jamais remplacé par un sabre
function jouerSon(nom, clicNormal = false){
  sonPourTele(nom);
  if (nom === "bouton" && !clicNormal) nom = morceauSabre(); // le clic des boutons = un son de sabre au hasard // mode télé : la télé le joue aussi (même si le son de ce téléphone est coupé)
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

let dernierClicJoueA = 0; // moment où le dernier clic (bouton ou sabre) a vraiment commencé (voir rafraichirBarreIphone)
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
  if (nom === "bouton" || nom.startsWith("sabre/")) dernierClicJoueA = Date.now();

  const dureeMax = DUREE_MAX_SONS[nom];
  if (SONS_QUI_BAISSENT_LA_MUSIQUE.includes(nom)) attenuerMusique(Math.min(son.duration, dureeMax || son.duration));
  if (dureeMax && son.duration > dureeMax) {
    sortie.gain.setValueAtTime(volume, debut + dureeMax - 0.3);
    sortie.gain.linearRampToValueAtTime(0.0001, debut + dureeMax);
    lecture.stop(debut + dureeMax + 0.02);
  }
}

// ===== Rappel « Bois de l'eau 💧 » : toutes les 20 minutes de partie (désactivé par défaut) =====
// Petit bandeau en haut de l'écran, qui ne bloque rien et se ferme au tap ou tout seul.
// (Chaque téléphone le gère de son côté : rien n'est envoyé aux autres joueurs.)
const CLE_RAPPEL_EAU = "alcuno_rappel_eau";
const caseRappelEau = document.getElementById("optionRappelEau");
caseRappelEau.checked = lireReglage(CLE_RAPPEL_EAU, false);
caseRappelEau.addEventListener("change", () => {
  ecrireReglage(CLE_RAPPEL_EAU, caseRappelEau.checked);
  if (caseRappelEau.checked) jouerSon("eau"); // on entend le son du rappel en l'activant
});

// ===== Mode gaucher : les boutons pour le pouce passent de l'autre côté (html.gaucher, voir le CSS) =====
// (case absente si le téléphone a gardé une ancienne page en cache : le réglage s'applique quand même)
const CLE_GAUCHER = "alcuno_gaucher";
const caseGaucher = document.getElementById("optionGaucher");
document.documentElement.classList.toggle("gaucher", lireReglage(CLE_GAUCHER, false));
if (caseGaucher) {
  caseGaucher.checked = lireReglage(CLE_GAUCHER, false);
  caseGaucher.addEventListener("change", () => {
    ecrireReglage(CLE_GAUCHER, caseGaucher.checked);
    document.documentElement.classList.toggle("gaucher", caseGaucher.checked);
    if (caseGaucher.checked) jouerSon("sons_on");
  });
}

const MINUTES_RAPPEL_EAU = 20;
let tempsDeJeuSansEau = 0; // ms de partie (écran allumé) depuis le dernier rappel

setInterval(() => {
  if (!caseRappelEau.checked || !partieLancee || pauseEnCours || document.visibilityState !== "visible") return;
  if (ecranNouvellePartieOuvert()) return; // (js/regles.js) : ce temps-là ne compte pas
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
    '<strong>L\'eau aussi, ça se boit 😉</strong></span>' +
    '<span class="rappelEau-languette" aria-hidden="true"></span>'; // (on peut la glisser, comme une vraie)
  rendreNotifGlissable(bandeau, 9000);
  document.body.appendChild(bandeau);
  jouerSon("eau");
  try { eauPourTele(); } catch (e) {} // (js/tele.js : la télé l'affiche aussi)
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
    ` | accueil ${Math.round(accueil.top)}→${Math.round(accueil.bottom)} | pixels ×${window.devicePixelRatio}` +
    ` | barre demandée ${(document.querySelector('meta[name="theme-color"]') || {}).content || "-"}` +
    ` | tout en haut ${hautDePage()}` +
    ` | téléphone en mode ${window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "sombre" : "clair"}`;
}

// Ce qu'il y a tout en haut de la page, sous l'heure (l'iPhone peint sa barre de la couleur de fond de ce
// qu'il y trouve) : l'élément touché à 1 px du haut, et le premier fond non transparent en remontant
function hautDePage(){
  const el = document.elementFromPoint(window.innerWidth / 2, 1);
  if (!el) return "rien";
  let fond = "transparent", e = el;
  while (e && e.nodeType === 1) {
    const c = getComputedStyle(e).backgroundColor;
    if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) { fond = c; break; }
    e = e.parentElement;
  }
  const nom = (n) => n.tagName.toLowerCase() + (n.id ? "#" + n.id : "");
  return `${nom(el)} (fond ${fond}${e && e !== el ? " de " + nom(e) : ""})`;
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
    ...(erreursRecentes.length ? erreursRecentes : ["aucune"]),
    ...(typeof journalMouchard === "function" ? journalMouchard() : []) // (js/mouchard.js)
  ].join("\n");
}

document.getElementById("btnDiagnostic").addEventListener("click", () => {
  const texte = texteDiagnostic();
  const copie = (navigator.clipboard && navigator.clipboard.writeText)
    ? navigator.clipboard.writeText(texte)
    : Promise.reject(new Error("presse-papiers indisponible"));
  copie.then(() => afficherToast("Diagnostic copié", 3000))
    .catch((e) => {
      // Refus du téléphone : on le dit (avant, rien : l'ancien texte restait dans le presse-papier)
      noterErreur(`copie du diagnostic refusée : ${e && (e.name + " " + e.message)}`);
      afficherToast(`Copie refusée par le téléphone (${(e && e.name) || "erreur"})`, 4000);
    });
});

// ===== Signaler un bug (Réglages) : le rapport arrive tout de suite en notification sur le téléphone du
// développeur (appli ntfy, abonnée au canal CANAL_BUGS du service gratuit ntfy.sh), avec le diagnostic
// de ce téléphone, puis une notification par photo ou vidéo jointe (une seule pièce jointe par message
// chez ntfy, 15 Mo au plus : les photos sont réduites, les vidéos trop lourdes refusées au choix).
// (Le nom du canal est dans ce fichier : quelqu'un qui le lit pourrait y écrire aussi.)
// La fenêtre est une demi-page qui monte du bas, par-dessus les Réglages : le clavier ne s'ouvre qu'en
// touchant la zone de texte ; on la ferme avec ✕, en touchant le fond ou en la glissant vers le bas.
const CANAL_BUGS = "alcuno-bugs-7cy7edx1ee25";
const MAX_PIECES_BUG = 3;
const TAILLE_MAX_VIDEO_BUG = 15 * 1024 * 1024; // (limite des pièces jointes de ntfy.sh)
const TEXTE_BOUTON_BUG = "Envoyer le rapport";
const ecranBug = document.getElementById("ecranBug");
const feuilleBug = ecranBug.querySelector(".bugFeuille");
const champBug = document.getElementById("texteBug");
const btnEnvoyerBug = document.getElementById("btnEnvoyerBug");
const libelleEnvoyerBug = btnEnvoyerBug.querySelector(".libelle");
const btnAjouterPieceBug = document.getElementById("btnAjouterPieceBug");
const champPiecesBug = document.getElementById("fichiersBug");
const zonePiecesBug = document.getElementById("bugPieces");
let piecesBug = []; // { fichier, url, video } (url : aperçu)
let dernierEnvoiBug = 0;
let minuteurFermetureBug = null;

function ouvrirEcranBug(){
  clearTimeout(minuteurFermetureBug);
  feuilleBug.style.transform = "";
  ecranBug.style.display = "";
  void ecranBug.offsetWidth; // (la demi-page part d'en bas)
  ecranBug.classList.add("ouvert");
}

function fermerEcranBug(){
  champBug.blur();
  ecranBug.classList.remove("ouvert");
  feuilleBug.style.transform = ""; // (redescend depuis là où le doigt l'a laissée)
  clearTimeout(minuteurFermetureBug);
  minuteurFermetureBug = setTimeout(() => { ecranBug.style.display = "none"; }, 280);
}

// Glisser la demi-page vers le bas depuis son haut (poignée, titre) : elle suit le doigt, et se ferme
// si on l'a assez descendue (ou d'un geste rapide)
let departGlisseBug = null;
const enteteBug = ecranBug.querySelector(".bugEntete");
enteteBug.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  departGlisseBug = { y: e.clientY, t: e.timeStamp };
  feuilleBug.style.transition = "none";
  try { enteteBug.setPointerCapture(e.pointerId); } catch (err) {}
});
enteteBug.addEventListener("pointermove", (e) => {
  if (!departGlisseBug) return;
  feuilleBug.style.transform = `translateY(${Math.max(0, e.clientY - departGlisseBug.y)}px)`;
});
function lacherGlisseBug(e){
  if (!departGlisseBug) return;
  const descente = e.clientY - departGlisseBug.y;
  const vitesse = descente / Math.max(1, e.timeStamp - departGlisseBug.t);
  departGlisseBug = null;
  feuilleBug.style.transition = "";
  if (descente > 90 || vitesse > 0.6) fermerEcranBug();
  else feuilleBug.style.transform = "";
}
enteteBug.addEventListener("pointerup", lacherGlisseBug);
enteteBug.addEventListener("pointercancel", lacherGlisseBug);

// Pièces jointes (photos ou vidéos du téléphone) : aperçus, MAX_PIECES_BUG au plus
function afficherPiecesBug(){
  zonePiecesBug.innerHTML = "";
  piecesBug.forEach((piece, i) => {
    const vignette = document.createElement("div");
    vignette.className = "bugVignette" + (piece.video ? " bugVignetteVideo" : "");
    let apercu;
    if (piece.video) {
      apercu = document.createElement("video");
      apercu.src = piece.url + "#t=0.1"; // (première image affichée, sans lecture)
      apercu.muted = true;
      apercu.playsInline = true;
      apercu.preload = "metadata";
    } else {
      apercu = document.createElement("img");
      apercu.src = piece.url;
    }
    apercu.setAttribute("aria-label", `Pièce jointe ${i + 1}`);
    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.className = "bugRetirer";
    retirer.setAttribute("aria-label", "Retirer la pièce jointe");
    retirer.innerText = "✕";
    retirer.addEventListener("click", () => {
      URL.revokeObjectURL(piece.url);
      piecesBug = piecesBug.filter(p => p !== piece);
      afficherPiecesBug();
    });
    vignette.append(apercu, retirer);
    zonePiecesBug.appendChild(vignette);
  });
  zonePiecesBug.hidden = piecesBug.length === 0;
  btnAjouterPieceBug.hidden = piecesBug.length >= MAX_PIECES_BUG;
}

champPiecesBug.addEventListener("change", () => {
  let fichiers = Array.from(champPiecesBug.files || [])
    .filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
  champPiecesBug.value = "";
  const tropLourdes = fichiers.filter(f => f.type.startsWith("video/") && f.size > TAILLE_MAX_VIDEO_BUG);
  if (tropLourdes.length) afficherToast("Vidéo trop lourde (15 Mo au plus) : prends-en une plus courte", 3500);
  fichiers = fichiers.filter(f => !tropLourdes.includes(f));
  const place = MAX_PIECES_BUG - piecesBug.length;
  if (fichiers.length > place) afficherToast(`${MAX_PIECES_BUG} pièces jointes au plus`);
  fichiers.slice(0, place).forEach(f => piecesBug.push({ fichier: f, url: URL.createObjectURL(f), video: f.type.startsWith("video/") }));
  afficherPiecesBug();
});

// Image réduite (1 600 px au plus) en JPEG : elle part vite, même en 4G
function compresserPhotoBug(fichier){
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      const echelle = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      const toile = document.createElement("canvas");
      toile.width = Math.round(image.naturalWidth * echelle);
      toile.height = Math.round(image.naturalHeight * echelle);
      toile.getContext("2d").drawImage(image, 0, 0, toile.width, toile.height);
      URL.revokeObjectURL(url);
      toile.toBlob(b => b ? ok(b) : ko(new Error("image")), "image/jpeg", 0.8);
    };
    image.onerror = () => { URL.revokeObjectURL(url); ko(new Error("image illisible")); };
    image.src = url;
  });
}

// Un message ntfy : texte simple, ou fichier (Blob sans type) ; titre dans l'adresse => pas de requête
// préalable du navigateur
function publierNtfy(titre, corps, nomFichier){
  const parametres = new URLSearchParams({ title: titre, tags: "beetle" });
  if (nomFichier) parametres.set("filename", nomFichier);
  return fetch(`https://ntfy.sh/${CANAL_BUGS}?${parametres}`, { method: "POST", body: corps })
    .then((reponse) => { if (!reponse.ok) throw new Error("ntfy " + reponse.status); });
}

function remettreBoutonBug(){
  btnEnvoyerBug.disabled = false;
  libelleEnvoyerBug.innerText = TEXTE_BOUTON_BUG;
}

// Extension du fichier envoyé (ntfy en déduit le type de la pièce jointe)
function extensionPieceBug(fichier){
  const nom = (fichier.name || "").match(/\.([a-z0-9]{2,4})$/i);
  if (nom) return nom[1].toLowerCase();
  return fichier.type === "video/quicktime" ? "mov" : (fichier.type.split("/")[1] || "bin");
}

async function envoyerBug(){
  const texte = champBug.value.trim();
  if (!texte) { afficherToast("Écris d'abord ce qui s'est passé"); return; }
  if (Date.now() - dernierEnvoiBug < 30000) { afficherToast("Attends un peu avant d'en renvoyer un"); return; }
  const titre = `Bug Alcuno ${VERSION_AFFICHEE}`;
  const pieces = piecesBug.slice();
  const annoncePieces = pieces.length
    ? `\n\n(${pieces.length} pièce${pieces.length > 1 ? "s" : ""} jointe${pieces.length > 1 ? "s" : ""} juste après)` : "";
  // ntfy : 4 096 octets au plus (au-delà, le message devient une pièce jointe) => texte + diagnostic coupés
  const message = (texte.slice(0, 1500) + annoncePieces + "\n\n" + texteDiagnostic()).slice(0, 3000);
  // Mouchard actif : le diagnostic complet (avec tout son journal) part aussi en fichier, juste après
  const diagnosticComplet = (typeof mouchardActif !== "undefined" && mouchardActif) ? texteDiagnostic() : null;
  btnEnvoyerBug.disabled = true;
  libelleEnvoyerBug.innerText = "Envoi…";
  try {
    await publierNtfy(titre, message);
  } catch (e) {
    afficherToast(navigator.onLine === false ? "Pas de réseau : réessaie plus tard" : "L'envoi n'a pas marché, réessaie", 3000);
    remettreBoutonBug();
    return;
  }
  dernierEnvoiBug = Date.now();
  let piecesRatees = 0;
  if (diagnosticComplet) {
    libelleEnvoyerBug.innerText = "Envoi du mouchard…";
    try { await publierNtfy(`${titre} : mouchard`, new Blob([diagnosticComplet]), "mouchard.txt"); } catch (e) { piecesRatees++; }
  }
  for (let i = 0; i < pieces.length; i++) {
    libelleEnvoyerBug.innerText = `Envoi de la pièce jointe ${i + 1}/${pieces.length}…`;
    try {
      const { fichier, video } = pieces[i];
      const contenu = video ? fichier : await compresserPhotoBug(fichier); // (vidéo telle quelle)
      await publierNtfy(`${titre} : pièce jointe ${i + 1}/${pieces.length}`, new Blob([contenu]),
        `piece-jointe-${i + 1}.${video ? extensionPieceBug(fichier) : "jpg"}`);
    } catch (e) {
      piecesRatees++;
    }
  }
  champBug.value = "";
  piecesBug.forEach(p => URL.revokeObjectURL(p.url));
  piecesBug = [];
  afficherPiecesBug();
  remettreBoutonBug();
  fermerEcranBug();
  afficherNotificationHaut("", piecesRatees ? "Rapport envoyé, mais pas toutes les pièces jointes" : "Merci ! Le rapport est envoyé", true);
}

document.getElementById("btnSignalerBug").addEventListener("click", ouvrirEcranBug);
document.getElementById("btnBugRetour").addEventListener("click", fermerEcranBug);
ecranBug.querySelector(".bugFond").addEventListener("click", fermerEcranBug);
btnAjouterPieceBug.addEventListener("click", () => champPiecesBug.click());
btnEnvoyerBug.addEventListener("click", envoyerBug);

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

// ===== Réorganiser les Réglages : « Modifier » (en haut à droite) =====
// Chaque bloc reçoit, sur le côté, une poignée « ≡ » : on l'attrape et on le fait glisser (au clavier : flèches haut et bas sur la
// poignée). « OK » termine, « Par défaut » remet l'ordre d'origine. L'ordre est gardé sur
// ce téléphone (clé alcuno_ordre_reglages) sous forme de la liste des data-cle de index.html ; un réglage ajouté plus tard à l'appli
// (absent de l'ordre gardé) se place à sa position d'origine. « Partager » et « À propos » restent en bas, sans poignée. Le glisser est fait à la main (événements « pointer ») : le
// glisser-déposer du navigateur ne marche pas au doigt.
const CLE_ORDRE_REGLAGES = "alcuno_ordre_reglages";
const contenuReglages = document.querySelector("#ecranReglages .reglages-contenu");
const btnModifierReglages = document.getElementById("btnModifierReglages");
const btnParDefautReglages = document.getElementById("btnParDefautReglages");
const blocsReglages = () => Array.from(contenuReglages.children).filter((e) => e.dataset.cle);
const blocsVisiblesReglages = () => blocsReglages().filter((e) => e.offsetHeight > 0);
const ORDRE_REGLAGES_PAR_DEFAUT = blocsReglages().map((e) => e.dataset.cle);

function appliquerOrdreReglages(ordre){
  const parCle = new Map(blocsReglages().map((e) => [e.dataset.cle, e]));
  const voulu = ordre.filter((c, i) => parCle.has(c) && ordre.indexOf(c) === i);
  ORDRE_REGLAGES_PAR_DEFAUT.forEach((cle, i) => { // (réglage inconnu de l'ordre gardé : juste après celui qui le précède d'origine)
    if (voulu.includes(cle)) return;
    const avant = ORDRE_REGLAGES_PAR_DEFAUT[i - 1];
    const place = avant ? voulu.indexOf(avant) + 1 : 0;
    voulu.splice(place, 0, cle);
  });
  const fin = contenuReglages.querySelector(":scope > .blocPartage"); // (« Partager » et « À propos » ne bougent pas : toujours en bas)
  voulu.forEach((cle) => contenuReglages.insertBefore(parCle.get(cle), fin));
}
function enregistrerOrdreReglages(){
  const ordre = blocsReglages().map((e) => e.dataset.cle);
  try {
    if (ordre.join() === ORDRE_REGLAGES_PAR_DEFAUT.join()) localStorage.removeItem(CLE_ORDRE_REGLAGES);
    else localStorage.setItem(CLE_ORDRE_REGLAGES, JSON.stringify(ordre));
  } catch (e) {}
}
try {
  const gardé = JSON.parse(localStorage.getItem(CLE_ORDRE_REGLAGES) || "null");
  if (Array.isArray(gardé) && gardé.every((c) => typeof c === "string")) appliquerOrdreReglages(gardé);
} catch (e) {}

let editionReglages = false;
let zoneControlesReglages = null;
const nomBlocReglage = (bloc) => ((bloc.querySelector(".optionTitre") || {}).textContent || bloc.dataset.cle).replace(/\s+/g, " ").trim();

function placerControlesReglages(){
  if (!zoneControlesReglages) return;
  zoneControlesReglages.querySelectorAll(".ctrlReglage").forEach((groupe) => {
    const bloc = contenuReglages.querySelector(`[data-cle="${groupe.dataset.pour}"]`);
    if (!bloc || bloc.offsetHeight === 0) { groupe.hidden = true; return; }
    groupe.hidden = false;
    groupe.style.top = `${bloc.offsetTop + (bloc.glisseDy || 0) + Math.max(0, (bloc.offsetHeight - groupe.offsetHeight) / 2)}px`;
  });
}
function construireControlesReglages(){
  zoneControlesReglages = document.createElement("div");
  zoneControlesReglages.id = "controlesReglages";
  blocsReglages().forEach((bloc) => {
    const nom = nomBlocReglage(bloc);
    const groupe = document.createElement("div");
    groupe.className = "ctrlReglage";
    groupe.dataset.pour = bloc.dataset.cle;
    groupe.innerHTML = `<button type="button" class="ctrlPoignee" aria-label="Déplacer ${nom} (glisser, ou flèches haut et bas du clavier)">≡</button>`;
    const poignee = groupe.querySelector(".ctrlPoignee");
    poignee.addEventListener("pointerdown", (e) => demarrerGlisseReglage(bloc, e));
    poignee.addEventListener("keydown", (e) => { // (clavier : la poignée a le focus, flèches haut / bas)
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      deplacerBlocReglage(bloc, e.key === "ArrowUp" ? -1 : 1);
      poignee.focus();
    });
    zoneControlesReglages.appendChild(groupe);
  });
  contenuReglages.appendChild(zoneControlesReglages);
}
function deplacerBlocReglage(bloc, sens){
  const visibles = blocsVisiblesReglages();
  const voisin = visibles[visibles.indexOf(bloc) + sens];
  if (!voisin) return;
  contenuReglages.insertBefore(bloc, sens < 0 ? voisin : voisin.nextSibling);
  enregistrerOrdreReglages();
  placerControlesReglages();
  try { bloc.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
}

// Glisser : la poignée suit le doigt ; dès que le centre du bloc dépasse celui d'un voisin, ils échangent leurs places
let glisseReglage = null;
function demarrerGlisseReglage(bloc, e){
  e.preventDefault();
  const poignee = e.currentTarget;
  try { poignee.setPointerCapture(e.pointerId); } catch (err) {}
  const defileur = document.getElementById("ecranReglages");
  glisseReglage = { bloc, poignee, defileur, departY: e.clientY + defileur.scrollTop, departHaut: bloc.offsetTop, y: e.clientY, id: e.pointerId };
  bloc.classList.add("glisse");
  const suivre = () => {
    const g = glisseReglage;
    if (!g) return;
    if (g.y < 90) g.defileur.scrollTop -= 14; else if (g.y > innerHeight - 90) g.defileur.scrollTop += 14; // (défile aux bords de l'écran)
    let dy = g.y + g.defileur.scrollTop - g.departY + (g.departHaut - g.bloc.offsetTop);
    g.bloc.glisseDy = dy;
    const centre = () => g.bloc.offsetTop + g.bloc.glisseDy + g.bloc.offsetHeight / 2;
    const visibles = blocsVisiblesReglages();
    const i = visibles.indexOf(g.bloc);
    const haut = visibles[i - 1], bas = visibles[i + 1];
    if (haut && centre() < haut.offsetTop + haut.offsetHeight / 2) contenuReglages.insertBefore(g.bloc, haut);
    else if (bas && centre() > bas.offsetTop + bas.offsetHeight / 2) contenuReglages.insertBefore(g.bloc, bas.nextSibling);
    dy = g.y + g.defileur.scrollTop - g.departY + (g.departHaut - g.bloc.offsetTop); // (la place a pu changer : on recalcule)
    g.bloc.glisseDy = dy;
    g.bloc.style.transform = `translateY(${dy}px)`;
    placerControlesReglages();
    g.trame = requestAnimationFrame(suivre);
  };
  glisseReglage.trame = requestAnimationFrame(suivre);
  poignee.addEventListener("pointermove", (ev) => { if (glisseReglage) glisseReglage.y = ev.clientY; });
  const fin = () => {
    const g = glisseReglage;
    if (!g) return;
    cancelAnimationFrame(g.trame);
    g.bloc.classList.remove("glisse");
    g.bloc.style.transform = "";
    g.bloc.glisseDy = 0;
    glisseReglage = null;
    enregistrerOrdreReglages();
    placerControlesReglages();
  };
  poignee.addEventListener("pointerup", fin, { once: true });
  poignee.addEventListener("pointercancel", fin, { once: true });
}

function entrerEditionReglages(){
  if (editionReglages) return;
  editionReglages = true;
  document.getElementById("ecranReglages").classList.add("reglages-edition");
  btnModifierReglages.textContent = "OK";
  btnParDefautReglages.hidden = false;
  construireControlesReglages();
  requestAnimationFrame(placerControlesReglages); // (après la mise en page avec la marge de gauche)
}
function finirEditionReglages(){
  if (!editionReglages) return;
  editionReglages = false;
  document.getElementById("ecranReglages").classList.remove("reglages-edition");
  btnModifierReglages.textContent = "Modifier";
  btnParDefautReglages.hidden = true;
  if (zoneControlesReglages) zoneControlesReglages.remove();
  zoneControlesReglages = null;
}
btnModifierReglages.addEventListener("click", () => (editionReglages ? finirEditionReglages() : entrerEditionReglages()));
btnParDefautReglages.addEventListener("click", () => {
  appliquerOrdreReglages(ORDRE_REGLAGES_PAR_DEFAUT);
  contenuReglages.appendChild(zoneControlesReglages); // (les poignées restent après les blocs)
  enregistrerOrdreReglages();
  requestAnimationFrame(placerControlesReglages);
});
document.getElementById("btnFermerReglages").addEventListener("click", finirEditionReglages, true);
document.getElementById("btnReglages").addEventListener("click", finirEditionReglages, true);
window.addEventListener("resize", () => requestAnimationFrame(placerControlesReglages));

// ===== Annonces à voix haute (synthèse vocale du navigateur, réglage désactivé de base) =====
// Lit à voix haute le texte des fenêtres d'annonce (pigeon, duel, +4, carte dorée…), des règles affichées sous le plateau et le
// rappel du tour (« C'est à Tom de jouer… »).
// Pas sur la télé (elle a son propre écran), ni pendant le rejeu accéléré d'une reconnexion. Sur iPhone, la première phrase doit
// partir d'un tap : c'est pourquoi activer le réglage dit une phrase de test.
const CLE_VOIX = "alcuno_voix";
const caseVoix = document.getElementById("optionVoix");
const voixPossible = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance === "function";
let voixActive = false;
try { voixActive = localStorage.getItem(CLE_VOIX) === "1" && voixPossible; } catch (e) {}
caseVoix.checked = voixActive;
// Vitesse de la voix : de 0,6 (posée) à 1,6 (rapide), 1 = normale ; envoyée aussi à la télé quand ce téléphone caste
const CLE_VITESSE_VOIX = "alcuno_vitesse_voix";
const curseurVoix = document.getElementById("vitesseVoix");
const ligneVitesseVoix = document.getElementById("ligneVitesseVoix");
let vitesseVoix = 1;
try { const v = Number(localStorage.getItem(CLE_VITESSE_VOIX)); if (v >= 0.6 && v <= 1.6) vitesseVoix = v; } catch (e) {}
curseurVoix.value = vitesseVoix;
function majLigneVoix(){
  document.getElementById("vitesseVoixValeur").innerText = vitesseVoix.toFixed(1).replace(".", ",") + "×";
  curseurVoix.disabled = !caseVoix.checked;
  ligneVitesseVoix.classList.toggle("inactif", !caseVoix.checked);
}
majLigneVoix();
if (!voixPossible) {
  caseVoix.disabled = true;
  document.getElementById("noteVoix").insertAdjacentHTML("beforeend", "<br>Indisponible sur cet appareil.");
}

// Texte prêt à être lu : sans emojis ni symboles, « +4 » -> « plus 4 », « 1/4 » -> « 1 sur 4 », « Il/elle » -> « Il ou elle »
function textePourVoix(brut){
  return String(brut || "")
    .replace(/\p{Extended_Pictographic}|\uFE0F|[✦✧★☆▶◀●•]/gu, " ")
    .replace(/\b(Il|Elle|il|elle)\/(il|elle)\b/g, "$1 ou $2")
    .replace(/\+(\d+)/g, "plus $1")
    .replace(/(\d+)\s*\/\s*(\d+)/g, "$1 sur $2")
    .replace(/\s+/g, " ").replace(/\s+([.,!?])/g, "$1").replace(/([!?])\./g, "$1").trim();
}

// Meilleure voix française de l'appareil : une voix « améliorée / premium / naturelle » si elle existe, sinon le français de France
// (avant le français du Canada ou de Belgique), de préférence installée sur l'appareil. Recalculée si la liste des voix change.
let voixFrChoisie = null, voixFrCherchee = false;
function noteVoix(v){
  const nom = `${v.name || ""} ${v.voiceURI || ""}`;
  let n = 0;
  if (/premium|enhanced|am[ée]lior[ée]e?|neural|natural|naturelle/i.test(nom)) n += 100;
  if (/^fr[-_]FR$/i.test(v.lang)) n += 20; else if (/^fr$/i.test(v.lang)) n += 10;
  if (v.localService) n += 5;
  if (/google/i.test(nom)) n += 3;
  if (v.default) n += 1;
  return n;
}
function meilleureVoixFr(){
  ecouterChangementDeVoix();
  if (voixFrCherchee && voixFrChoisie) return voixFrChoisie;
  const voix = (window.speechSynthesis.getVoices() || []).filter((v) => /^fr/i.test(v.lang));
  voixFrCherchee = voix.length > 0; // (liste encore vide : on redemande à la prochaine lecture)
  voixFrChoisie = voix.length ? voix.slice().sort((a, b) => noteVoix(b) - noteVoix(a))[0] : null;
  return voixFrChoisie;
}
let ecouteVoix = false; // (la synthèse vocale n'est touchée qu'à la première lecture : réglage désactivé = on n'y touche pas du tout)
function ecouterChangementDeVoix(){
  if (ecouteVoix) return;
  ecouteVoix = true;
  try { window.speechSynthesis.addEventListener("voiceschanged", () => { voixFrCherchee = false; voixFrChoisie = null; }); } catch (e) {}
}

let voixDernier = { texte: "", date: 0 };
// Lit un texte tout de suite (sans tenir compte du réglage : l'appelant a déjà décidé). Sert au téléphone (parler) et à la télé.
function dire(brut, force = false, vitesse = null){
  if (!voixPossible) return;
  const texte = textePourVoix(brut);
  if (!texte) return;
  if (!force && texte === voixDernier.texte && Date.now() - voixDernier.date < 6000) return; // (la même annonce lue deux fois de suite)
  voixDernier = { texte, date: Date.now() };
  try {
    window.speechSynthesis.cancel();
    const lecture = new SpeechSynthesisUtterance(texte);
    lecture.lang = "fr-FR";
    lecture.rate = Math.min(1.6, Math.max(0.6, Number(vitesse) || vitesseVoix));
    const voixFr = meilleureVoixFr();
    if (voixFr) lecture.voice = voixFr;
    const apres = () => { // (iPhone : la voix peut interrompre le son de la page ; une fois la lecture finie, on relance le son et la musique)
      for (const attente of [100, 1500]) setTimeout(() => { try { if (contexteSon && contexteSon.state !== "running") contexteSon.resume().catch(() => {}); majMusique(); } catch (e) {} }, attente);
    };
    lecture.onend = apres;
    lecture.onerror = apres;
    window.speechSynthesis.speak(lecture);
    try { attenuerMusique(Math.min(8, 1.5 + texte.length * 0.07)); } catch (e) {} // la musique baisse pendant la lecture
  } catch (e) {}
}
// Annonce du téléphone : seulement si le réglage est activé, pas sur la page télé (elle lit via lireSurTele, js/tele.js), pas pendant le
// rejeu accéléré d'une reconnexion, et pas quand ce téléphone caste : c'est alors la télé qui lit l'annonce
function parler(brut, force = false){
  if (!voixPossible || (!voixActive && !force)) return;
  if (document.documentElement.classList.contains("mode-tele")) return;
  try { if (rattrapageEnCours) return; } catch (e) {}
  try { if (codeTele) return; } catch (e) {}
  dire(brut, force);
}

curseurVoix.addEventListener("input", () => {
  vitesseVoix = Number(curseurVoix.value);
  majLigneVoix();
});
curseurVoix.addEventListener("change", () => {
  try { localStorage.setItem(CLE_VITESSE_VOIX, String(vitesseVoix)); } catch (e) {}
  parler("Voilà la vitesse de la voix.", true); // (essai au relâchement, comme le curseur du volume)
});

caseVoix.addEventListener("change", () => {
  voixActive = caseVoix.checked && voixPossible;
  majLigneVoix();
  try { localStorage.setItem(CLE_VOIX, voixActive ? "1" : "0"); } catch (e) {}
  if (voixActive) parler("Annonces à voix haute activées.", true); // (part d'un tap : nécessaire sur iPhone)
  else { try { window.speechSynthesis.cancel(); } catch (e) {} }
});
document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "visible" && voixActive) { try { window.speechSynthesis.cancel(); } catch (e) {} } });

// Fenêtres d'annonce : lues quand elles apparaissent et quand leur texte change (l'annonce « règle » est une même fenêtre réutilisée)
if (voixPossible) {
  const surveilles = new WeakSet();
  const lireFenetre = (fenetre) => {
    if (!voixActive || !fenetre.isConnected) return;
    let texte = "";
    try { texte = texteSansBoutons(fenetre); } catch (e) { texte = fenetre.innerText || ""; } // (js/tele.js : le texte sans les boutons ni les cartes)
    parler(String(texte).replace(/\n+/g, ". "));
  };
  const surveiller = (fenetre) => {
    if (surveilles.has(fenetre)) return;
    surveilles.add(fenetre);
    let minuteur = null;
    const planifier = () => { clearTimeout(minuteur); minuteur = setTimeout(() => lireFenetre(fenetre), 450); };
    new MutationObserver(planifier).observe(fenetre, { childList: true, subtree: true, characterData: true });
    planifier();
  };
  new MutationObserver((mutations) => {
    for (const m of mutations) m.addedNodes.forEach((n) => { if (n.nodeType === 1 && /^overlay/.test(n.id || "")) surveiller(n); });
  }).observe(document.body, { childList: true });

  // Règles sous le plateau (« Il/elle boit 1 gorgée… ») : seulement quand aucune fenêtre ne les annonce déjà
  let minuteurRegles = null;
  const lireRegles = () => {
    if (!voixActive || document.querySelector('body > [id^="overlay"]')) return;
    const zone = document.getElementById("messageTexte");
    if (zone && zone.innerText.trim()) parler(zone.innerText);
  };
  const zoneRegles = document.getElementById("messageTexte");
  if (zoneRegles) new MutationObserver(() => { clearTimeout(minuteurRegles); minuteurRegles = setTimeout(lireRegles, 500); }).observe(zoneRegles, { childList: true });

  // « C'est à Tom de jouer, tire une carte. » : lu à chaque changement de tour (en ligne : « C'est à toi de jouer… » pour celui dont c'est le tour)
  let minuteurTour = null;
  const lireTour = () => {
    if (!voixActive || document.querySelector('body > [id^="overlay"]')) return;
    const rappel = document.getElementById("rappelTour");
    if (rappel && rappel.style.display !== "none" && rappel.textContent.trim()) parler(rappel.textContent);
  };
  const rappelTourZone = document.getElementById("rappelTour");
  if (rappelTourZone) new MutationObserver(() => { clearTimeout(minuteurTour); minuteurTour = setTimeout(lireTour, 700); }).observe(rappelTourZone, { childList: true, characterData: true, subtree: true });
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
  // Adresse neuve (?v=...) : contourne le cache et recharge toute l'appli. Avec son propre son (celui de
  // l'accessibilité, 1,7 s) : la page ne se recharge qu'à la fin, sinon il serait coupé net.
  // Les sons ne se chargent qu'au premier tap : si c'est celui-ci (appli tout juste rouverte, bandeau
  // déjà là), on attend que le son arrive (4 s au plus). Avant, la page se rechargeait sans l'avoir joué.
  const boutonMaj = bandeau.querySelector(".maj");
  boutonMaj.addEventListener("click", () => {
    if (boutonMaj.disabled) return;
    boutonMaj.disabled = true;
    boutonMaj.textContent = "Mise à jour…";
    const recharger = () => rechargerPage(location.pathname + "?v=" + encodeURIComponent(versionEnLigne)); // (js/retour-demarrage.js)
    if (!caseSons.checked || volumeSons <= 0) { recharger(); return; }
    const debut = Date.now();
    const jouerPuisRecharger = () => {
      chargerSons(); // (relance un téléchargement raté)
      const son = sonsCharges.accessibilite_on;
      if (son === undefined && Date.now() - debut < 4000) { setTimeout(jouerPuisRecharger, 100); return; }
      if (!son) { recharger(); return; } // (pas de fichier, ou pas de réseau)
      lireSon("accessibilite_on", son);
      setTimeout(recharger, 1700);
    };
    jouerPuisRecharger();
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

const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const estAndroid = /android/i.test(navigator.userAgent);
const estTelephone = estIOS || estAndroid;

// ===== Écran « Installer Alcuno » (téléphone, jeu pas installé) =====
// Affiché tout seul à l'ouverture. « Jouer sans installer » le ferme jusqu'à la prochaine ouverture du
// jeu (sessionStorage) ; le petit bouton « Installer l'appli » en bas de l'accueil le rouvre.
//  - iPhone / iPad : Apple ne permet pas de bouton, on montre les étapes de Safari
//  - Android avec Chrome : le navigateur sait installer => gros bouton « Installer » (un tap)
//  - Android, autre navigateur ou Chrome qui ne propose pas l'installation : les étapes du menu ⋮
const ecranInstallation = document.getElementById("ecranInstallation");
const btnInstallationInstaller = document.getElementById("btnInstallationInstaller");
const CLE_INSTALLATION_PLUS_TARD = "alcuno_installation_plus_tard";
const ICONE_PARTAGER = '<svg viewBox="0 0 24 24" class="iconeEtape" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5v10h14V11h-1"/></svg>';
const ICONE_AJOUTER = '<svg viewBox="0 0 24 24" class="iconeEtape" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const ICONE_MENU = '<svg viewBox="0 0 24 24" class="iconeEtape" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';

function majEcranInstallation(){
  const etapes = estIOS
    ? [`Dans Safari, touche ${ICONE_PARTAGER} <b>Partager</b><small>(ou ••• puis Partager)</small>`,
       `Choisis ${ICONE_AJOUTER} <b>Sur l'écran d'accueil</b>`,
       "Touche <b>Ajouter</b>"]
    : [`Touche le menu ${ICONE_MENU} du navigateur`,
       "Choisis <b>Installer l'application</b> ou <b>Ajouter à l'écran d'accueil</b>",
       "Confirme"];
  const zone = document.getElementById("installationEtapes");
  zone.hidden = !!demandeInstallation; // Chrome sait installer : pas besoin d'étapes
  zone.innerHTML = etapes.map((texte, i) =>
    `<div class="etapeInstallation"><span class="numeroEtape">${i + 1}</span><span>${texte}</span></div>`).join("");
  btnInstallationInstaller.hidden = !demandeInstallation;
}

function ouvrirEcranInstallation(){
  majEcranInstallation();
  ouvrirPage(ecranInstallation);
}

function fermerEcranInstallation(){
  try { sessionStorage.setItem(CLE_INSTALLATION_PLUS_TARD, "1"); } catch (e) {}
  fermerPage(ecranInstallation);
}

function installationRemiseAPlusTard(){
  try { return sessionStorage.getItem(CLE_INSTALLATION_PLUS_TARD) === "1"; } catch (e) { return false; }
}

activerMemePendantElan(document.getElementById("btnInstallationPlusTard"), fermerEcranInstallation);

// Android (Chrome) : le navigateur signale qu'on peut installer
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  if (estEnAppli) return;
  demandeInstallation = e;
  blocInstaller.hidden = false;
  if (ecranInstallation.style.display !== "none") majEcranInstallation(); // les étapes deviennent un bouton
  else if (ouvertureAutoEnAttente) ouvrirEcranInstallationAuto(); // Chrome a répondu : l'écran s'ouvre avec le bouton, sans étapes avant
});

function lancerInstallation(){
  if (!demandeInstallation) return;
  demandeInstallation.prompt();
  demandeInstallation.userChoice.then((choix) => {
    if (choix && choix.outcome === "accepted") fermerPage(ecranInstallation);
  }).finally(() => {
    demandeInstallation = null; // Chrome ne la propose qu'une fois
    if (!estTelephone) blocInstaller.hidden = true;
    if (ecranInstallation.style.display !== "none") majEcranInstallation();
  });
}

btnInstallationInstaller.addEventListener("click", lancerInstallation);

// Petit bouton en bas de l'accueil : téléphone => l'écran ; ordinateur avec Chrome => installe directement
btnInstallerAppli.addEventListener("click", () => {
  if (estTelephone) ouvrirEcranInstallation();
  else lancerInstallation();
});

window.addEventListener("appinstalled", () => {
  demandeInstallation = null;
  blocInstaller.hidden = true;
  fermerPage(ecranInstallation);
});

// Écran d'installation à l'ouverture. Android avec Chrome : Chrome dit parfois plusieurs secondes après
// l'ouverture s'il sait installer. On attend sa réponse (écran direct avec le bouton « Installer ») au lieu
// d'afficher d'abord les étapes puis de les remplacer par le bouton ; sans réponse au bout de 5 s, les étapes.
// Les autres navigateurs Android ne répondront jamais : étapes après 1,5 s.
const estChromeAndroid = estAndroid && /chrome\//i.test(navigator.userAgent) &&
  !/edga|opr\/|samsungbrowser|firefox|fxios|duckduckgo|ucbrowser|miuibrowser|vivaldi/i.test(navigator.userAgent);
let ouvertureAutoEnAttente = false;
function ouvrirEcranInstallationAuto(){
  if (!ouvertureAutoEnAttente) return;
  ouvertureAutoEnAttente = false;
  // (pas si on a déjà quitté l'accueil entre-temps : il surgirait par-dessus ce qu'on est en train de faire)
  const toujoursSurAccueil = document.getElementById("choixMode").style.display !== "none" &&
    ecranReglages.style.display === "none" && ecranRegles.style.display === "none";
  if (!installationRemiseAPlusTard() && toujoursSurAccueil) ouvrirEcranInstallation();
}
if (estTelephone && !estEnAppli) {
  blocInstaller.hidden = false;
  // Arrivé par le QR code d'une partie : on va droit à la partie (le bouton « Installer l'appli » reste en bas)
  if (!installationRemiseAPlusTard() && !codeInvitationLien) {
    if (estIOS) ouvrirEcranInstallation();
    else {
      ouvertureAutoEnAttente = true;
      if (demandeInstallation) ouvrirEcranInstallationAuto();
      else setTimeout(ouvrirEcranInstallationAuto, estChromeAndroid ? 5000 : 1500);
    }
  }
}


// ===== Aide du premier lancement : où sont les Règles et les Réglages =====
// Seulement pour les nouveaux, à la première ouverture de l'appli tout juste installée (pas dans le
// navigateur, pas pour ceux qui jouaient déjà), sur l'accueil quand rien d'autre n'est ouvert. L'accueil est flouté sauf les deux icônes, montrées par des flèches dorées
// « coup de pinceau » (courbes, épaisses au milieu, fines aux deux bouts). Un tap n'importe où la ferme.
const CLE_AIDE_VUE = "alcuno_aide_vue";

function aideDejaVue(){
  try { return localStorage.getItem(CLE_AIDE_VUE) === "1"; } catch (e) { return true; }
}

// Contour de la flèche : bézier cubique de la queue (P0) à la pointe (P3), élargie de part et d'autre
// (épaisseur max au milieu), puis la pointe en chevron (deux petits traits effilés)
function cheminFlecheAide(P0, P1, P2, P3, epaisseur){
  const point = (t) => { const u = 1 - t; return {
    x: u*u*u*P0.x + 3*u*u*t*P1.x + 3*u*t*t*P2.x + t*t*t*P3.x,
    y: u*u*u*P0.y + 3*u*u*t*P1.y + 3*u*t*t*P2.y + t*t*t*P3.y }; };
  const direction = (t) => { const u = 1 - t; const d = {
    x: 3*u*u*(P1.x-P0.x) + 6*u*t*(P2.x-P1.x) + 3*t*t*(P3.x-P2.x),
    y: 3*u*u*(P1.y-P0.y) + 6*u*t*(P2.y-P1.y) + 3*t*t*(P3.y-P2.y) };
    const l = Math.hypot(d.x, d.y) || 1; return { x: d.x / l, y: d.y / l }; };
  const f = (n) => n.toFixed(1);
  const gauche = [], droite = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, q = point(t), d = direction(t);
    const demi = Math.max(0.8, epaisseur * Math.pow(Math.sin(Math.PI * t), 0.75)) / 2;
    gauche.push(`${f(q.x - d.y * demi)} ${f(q.y + d.x * demi)}`);
    droite.unshift(`${f(q.x + d.y * demi)} ${f(q.y - d.x * demi)}`);
  }
  let chemin = `M${gauche.join("L")}L${droite.join("L")}Z`;
  const d = direction(1), pointe = { x: P3.x + d.x * 3, y: P3.y + d.y * 3 };
  for (const cote of [1, -1]) {
    const bout = { x: pointe.x - d.x * 17 - d.y * 11 * cote, y: pointe.y - d.y * 17 + d.x * 11 * cote };
    const milieu = { x: (pointe.x + bout.x) / 2, y: (pointe.y + bout.y) / 2 };
    const l = Math.hypot(bout.x - pointe.x, bout.y - pointe.y);
    const px = -(bout.y - pointe.y) / l, py = (bout.x - pointe.x) / l;
    chemin += `M${f(pointe.x - px*1.2)} ${f(pointe.y - py*1.2)}Q${f(milieu.x - px*2.6)} ${f(milieu.y - py*2.6)} ${f(bout.x)} ${f(bout.y)}` +
      `Q${f(milieu.x + px*2.6)} ${f(milieu.y + py*2.6)} ${f(pointe.x + px*1.2)} ${f(pointe.y + py*1.2)}Z`;
  }
  return chemin;
}

// Place les trous du voile, les flèches et les textes d'après la position réelle des deux icônes
function placerAideAccueil(aide){
  const r1 = document.getElementById("btnRegles").getBoundingClientRect();
  const r2 = document.getElementById("btnReglages").getBoundingClientRect();
  const a = { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 };
  const c = { x: r2.left + r2.width / 2, y: r2.top + r2.height / 2 };
  const largeur = window.innerWidth;
  const hautTextes = Math.max(a.y, c.y) + 196;
  aide.querySelector(".aideAccueil-voile").style.cssText =
    `--x1:${a.x}px;--y1:${a.y}px;--x2:${c.x}px;--y2:${c.y}px`;
  aide.querySelector(".aideAccueil-fleches").setAttribute("viewBox", `0 0 ${largeur} ${window.innerHeight}`);
  const queueG = largeur * 0.3, queueD = largeur * 0.7;
  const fleches = [
    cheminFlecheAide({ x: queueG, y: hautTextes - 14 }, { x: queueG + 4, y: hautTextes - 90 },
      { x: a.x + 60, y: a.y + 70 }, { x: a.x + 22, y: a.y + 34 }, 11),
    cheminFlecheAide({ x: queueD, y: hautTextes - 14 }, { x: queueD - 4, y: hautTextes - 90 },
      { x: c.x - 60, y: c.y + 70 }, { x: c.x - 22, y: c.y + 34 }, 11)
  ].join("");
  aide.querySelectorAll(".aideAccueil-fleches path").forEach((chemin) => chemin.setAttribute("d", fleches));
  aide.querySelectorAll(".aideAccueil-repere").forEach((repere) => { repere.style.top = hautTextes + "px"; });
}

function fermerAideAccueil(){
  const aide = document.getElementById("aideAccueil");
  if (!aide || aide.classList.contains("aideAccueil-sortie")) return;
  try { localStorage.setItem(CLE_AIDE_VUE, "1"); } catch (e) {}
  aide.classList.add("aideAccueil-sortie");
  window.removeEventListener("resize", aide._replacer);
  setTimeout(() => aide.remove(), 300);
}

function afficherAideAccueil(){
  if (document.getElementById("aideAccueil")) return;
  const aide = document.createElement("div");
  aide.id = "aideAccueil";
  aide.setAttribute("role", "dialog");
  aide.setAttribute("aria-label", "Où sont les règles et les réglages");
  aide.innerHTML = `
    <div class="aideAccueil-voile"></div>
    <svg class="aideAccueil-fleches" aria-hidden="true">
      <defs><linearGradient id="orAideAccueil" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#E6A800"/><stop offset="1" stop-color="#FFE34D"/></linearGradient></defs>
      <path class="aideAccueil-ombre"/><path fill="url(#orAideAccueil)"/>
    </svg>
    <div class="aideAccueil-repere aideAccueil-gauche"><b>Règles</b>Toutes les cartes<br>expliquées.</div>
    <div class="aideAccueil-repere aideAccueil-droite"><b>Réglages</b>Thèmes, sons,<br>musiques…</div>
    <div class="aideAccueil-bas"><b>QUE LA FÊTE COMMENCE !</b>Touche l'écran pour jouer</div>`;
  placerAideAccueil(aide);
  aide._replacer = () => placerAideAccueil(aide);
  window.addEventListener("resize", aide._replacer);
  aide.addEventListener("click", fermerAideAccueil);
  document.body.appendChild(aide);
}

// Nouveau : premier lancement depuis l'icône (installation pas encore comptée par js/stats.js) et rien
// d'un joueur d'avant dans ce téléphone (réglages, partie gardée…). Les autres ne la verront jamais.
function nouveauQuiVientDInstaller(){
  try {
    if (localStorage.getItem("alcuno_install_comptee")) return false;
    const clesNeuves = ["alcuno_id_stats", "alcuno_code_invitation", CLE_AIDE_VUE];
    return !Object.keys(localStorage).some((cle) => cle.startsWith("alcuno_") && !clesNeuves.includes(cle));
  } catch (e) { return false; }
}
if (estEnAppli && !aideDejaVue() && !nouveauQuiVientDInstaller()) {
  try { localStorage.setItem(CLE_AIDE_VUE, "1"); } catch (e) {}
}

// On attend que l'accueil soit libre : une partie en cours ou une invitation par QR code passent d'abord
// (l'aide viendra au prochain passage sur l'accueil). Seulement dans l'appli installée : l'écran
// d'installation ne s'ouvre jamais là, donc plus de délai d'attente au lancement.
if (!document.documentElement.classList.contains("mode-tele") && estEnAppli && !aideDejaVue()) { // (pas sur la télé)
  const verifierAideAccueil = () => {
    if (aideDejaVue()) { clearInterval(surveillance); return; }
    const accueilLibre = !partieLancee &&
      document.getElementById("choixMode").style.display !== "none" &&
      [ecranInstallation, ecranReglages, ecranRegles, ecranCredits].every((page) => page.style.display === "none") &&
      !document.getElementById("fenetrePrestige");
    if (!accueilLibre) return;
    clearInterval(surveillance);
    afficherAideAccueil();
  };
  const surveillance = setInterval(verifierAideAccueil, 300);
  setTimeout(verifierAideAccueil, 50); // (pas tout de suite : les écrans plus bas dans le fichier ne sont pas encore créés)
}
// #endregion

// #region Écran des règles du jeu (bouton livre de l'accueil et du bandeau de la partie)
// Rempli à chaque ouverture : les gorgées suivent le Mode PJ. Pas de carte dorée (c'est une surprise).
const ecranRegles = document.getElementById("ecranRegles");

// Règles du jeu (écran des Règles, et fiche d'une carte au doigt appuyé sur le plateau : js/plateau.js).
// texte : une phrase, ou une liste de lignes (règles longues : plus facile à lire qu'un pavé). Petit HTML
// écrit ici (rien qui vient d'un joueur) : <b> le mot important, <em> les gorgées (en doré).
function reglesDuJeu(){
  const pj = estModeSoft();
  const g = (n) => `<em>${texteGorgees(n)}</em>`;
  const parties = [
    { titre: "Comment on joue", regles: [
      { carte: "", nom: "À ton tour", texte: [
        "Toutes les cartes sont posées <b>face cachée</b>",
        "À ton tour, retourne celle de ton choix et applique sa règle",
        "Puis c'est au joueur suivant"
      ]}
    ]},
    { titre: "Les cartes", regles: [
      { carte: "zero_bleu", nom: "0", texte: `Tout le monde boit ${g(1)}, sauf toi.` },
      { carte: "un_rouge", nom: "1 : annulation", texte: `Tu gardes la carte : quand tu dois boire, tu peux t'en servir pour annuler ${g(1)}.` },
      { carte: "plus_2_jaune", nom: "+2", texte: `Tu bois ${g(gorgeesPlus2())}.` },
      { carte: "plus_4", nom: "+4", texte: `Tu distribues ${g(gorgeesPlus4())} comme tu veux.` },
      { carte: "trois_vert", nom: "3 : le Pigeon", texte: [
        `Le premier qui tire un 3 devient le <b>Pigeon</b> : ${g(gorgeesPigeon())}`,
        `Un autre tire un 3 : le Pigeon boit ${g(1)}`,
        `Le Pigeon tire un 3 : il choisit le <b>nouveau Pigeon</b>, qui boit ${g(gorgeesPigeon())}`
      ]},
      { carte: "quatre_bleu", nom: "4 : duel", texte: [
        "Choisis <b>2 joueurs</b> : chacun prend une carte cachée",
        pj ? "La plus petite carte boit <em>la moitié de sa valeur</em> (10 gorgées max)"
           : "La plus petite carte boit <em>sa valeur en gorgées</em>",
        "Égalité : on recommence, <em>gorgées doublées</em>"
      ]},
      { carte: "interdit_rouge", nom: "Sociale", texte: `Tout le monde boit ${g(1)}.` },
      { carte: "switch_vert", nom: "Changement de sens", texte: "Le sens du jeu est inversé." },
      { carte: "couleur", nom: "Couleur", texte: `Choisis une couleur : le prochain qui tire une carte de cette couleur boit ${g(1)} en plus.` }
    ]},
    { titre: "Fin de la partie", regles: [
      { carte: "", nom: "Pari sur la dernière carte", texte: [
        "Quand il ne reste qu'<b>une carte</b>, chacun parie sur son type",
        `Ceux qui trouvent distribuent <em>${texteCulSec()}</em>`
      ]},
      { carte: "un_jaune", nom: "Les 1 restants", texte: `Chaque 1 gardé jusqu'à la fin se transforme en gorgée à boire (${g(1)} par carte).` }
    ]}
  ];
  return parties;
}

// Texte d'une règle en HTML : la phrase telle quelle, ou les lignes en liste à puces dorées
function htmlRegle(texte){
  if (!Array.isArray(texte)) return texte;
  return `<ul class="lignesRegle">${texte.map((ligne) => `<li>${ligne}</li>`).join("")}</ul>`;
}

function remplirRegles(){
  const pj = estModeSoft();
  const parties = reglesDuJeu();

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
      detail.innerHTML = htmlRegle(r.texte);
      texte.append(nom, detail);
      ligne.append(carte, texte);
      bloc.appendChild(ligne);
    });
    liste.appendChild(bloc);
  });
}

function ouvrirRegles(){
  jouerSon("regles"); // (à la place du clic des boutons, voir BOUTONS_AVEC_LEUR_SON)
  ecranRegles.classList.remove("album"); // (l'album de stickers s'ouvre dans cet écran : js/stickers.js)
  ecranRegles.querySelector("h2").textContent = "Règles du jeu";
  remplirRegles();
  ecranRegles.scrollTop = 0;
  choixDejaEnAttente = new Set(choixEnAttentePourMoi()); // déjà là à l'ouverture : on ne referme pas pour eux
  ouvrirPage(ecranRegles);
}

// En ligne : si, pendant qu'on lit les règles, c'est à nous de choisir quelque chose (nouveau Pigeon, +4,
// duel, annulation, couleur...), l'écran des règles se ferme tout seul : sinon il cachait le choix
// et les autres attendaient sans comprendre.
let choixDejaEnAttente = new Set();
let verificationReglesPrevue = false;

function choixEnAttentePourMoi(){
  if(!enLigneActif) return [];
  return [...document.querySelectorAll('[id^="overlay"] [data-net-id]')]
    .filter(el => el._net && actionPrete(el) && proprietaireAction(el) === pseudoActuel);
}

function fermerReglesSiCestAMoi(){
  if(ecranRegles.style.display === "none" || ecranRegles.classList.contains("page-sortie")) return;
  if(!choixEnAttentePourMoi().some(el => !choixDejaEnAttente.has(el))) return;
  fermerPage(ecranRegles);
  afficherToast("C'est à toi de choisir !", 2500);
}

new MutationObserver(() => {
  if(!enLigneActif || ecranRegles.style.display === "none" || verificationReglesPrevue) return;
  verificationReglesPrevue = true;
  requestAnimationFrame(() => {
    verificationReglesPrevue = false;
    fermerReglesSiCestAMoi();
  });
}).observe(document.body, { childList: true, subtree: true });

document.getElementById("btnRegles").addEventListener("click", ouvrirRegles);
document.getElementById("btnReglesJeu").addEventListener("click", ouvrirRegles);
activerMemePendantElan(document.getElementById("btnFermerRegles"), () => fermerPage(ecranRegles));

// #endregion
