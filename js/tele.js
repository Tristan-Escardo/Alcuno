// =============================================================================================
// ALCUNO : Mode télé (« Caster ») : la partie classique affichée en grand sur une télé
// (fichier chargé en dernier dans index.html : voir l'en-tête de script.js)
//
// Le téléphone joue exactement comme d'habitude. Une fois relié à une télé, il dépose en plus,
// à chaque changement, un résumé de ce qu'il affiche (plateau, joueurs, règle, écran en cours) dans
// Firebase (tele/CODE). La télé (page …/Alcuno/tele) lit ce résumé et le dessine en grand : elle
// n'a aucune règle ni bouton du jeu. Sans télé reliée, rien de ce fichier ne tourne pendant la partie.
// =============================================================================================

// #region Commun : codes de télé
const ADRESSE_SITE_TELE = "https://tristan-escardo.github.io/Alcuno/";
const CARACTERES_CODE_TELE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // pas de 0/O ni 1/I
const estPageTele = document.documentElement.classList.contains("mode-tele");

function codeTeleValide(code){
  return /^[A-Z2-9]{5}$/.test(code);
}

// Texte d'un QR code de télé (lien …/?caster=ABC23) ou code tapé à la main => code, ou ""
function codeTeleDepuisTexte(texte){
  texte = String(texte || "").trim();
  let code = texte;
  if (/^https?:\/\//i.test(texte)) {
    try { code = new URL(texte).searchParams.get("caster") || ""; } catch (e) { code = ""; }
  }
  code = code.trim().toUpperCase();
  return codeTeleValide(code) ? code : "";
}
// #endregion

// #region Téléphone : bouton « Caster », envoi du résumé de la partie
const CLE_CODE_TELE = "alcuno_code_tele";
const btnCaster = document.getElementById("btnCaster");
const ecranCaster = document.getElementById("ecranCaster");
const champCodeCaster = document.getElementById("codeCaster");
let codeTele = null;          // télé reliée (null : aucune)
let dernierEtatTele = "";     // dernier résumé envoyé (on n'envoie que les changements)
let minuteurTele = null;
let pauseTeleJusqua = 0;      // après un refus de Firebase : on attend un peu avant de réessayer
let erreurTeleSignalee = false;
let arreterSuiviTele = null;  // fin du suivi de la connexion (voir suivreConnexionTele)

function majBoutonCaster(){
  btnCaster.querySelector(".casterTexte").textContent = codeTele ? "Caster sur la télé ✓" : "Caster sur la télé";
  btnCaster.classList.toggle("caster-actif", !!codeTele);
}

function ouvrirEcranCaster(){
  const relie = !!codeTele;
  document.getElementById("titreCaster").innerText = relie ? "Télé connectée" : "Caster sur la télé";
  document.getElementById("casterRelier").style.display = relie ? "none" : "";
  document.getElementById("casterConnecte").style.display = relie ? "" : "none";
  document.getElementById("texteCasterConnecte").innerText = relie
    ? `La partie s'affiche sur la télé (code ${codeTele}).` : "";
  champCodeCaster.value = "";
  ecranCaster.style.display = "";
}

function fermerEcranCaster(){
  ecranCaster.style.display = "none";
}

// Appli fermée, téléphone éteint ou réseau coupé pendant qu'on caste : Firebase efface tout seul
// tele/CODE et la télé revient sur son QR code au bout de 5 s (on peut la rescanner). Le téléphone revenu, il renvoie
// la partie, et aussi si le résumé a été effacé alors qu'il caste toujours (ancienne connexion)
function suivreConnexionTele(code){
  if (arreterSuiviTele) arreterSuiviTele();
  const ref = window.fbRef(window.firebaseDB, `tele/${code}`);
  const finConnexion = window.fbOnValue(window.fbRef(window.firebaseDB, ".info/connected"), (snapshot) => {
    if (snapshot.val() !== true || codeTele !== code) return;
    window.fbOnDisconnect(ref).remove().catch(() => {});
    dernierEtatTele = ""; // (à renvoyer)
  });
  const finResume = window.fbOnValue(ref, (snapshot) => {
    if (snapshot.val() === null && codeTele === code) dernierEtatTele = "";
  });
  arreterSuiviTele = () => {
    arreterSuiviTele = null;
    finConnexion();
    finResume();
    window.fbOnDisconnect(ref).cancel().catch(() => {});
  };
}

// Télé rendue (cast arrêté, ou relié à une autre télé) : un résumé « arrêt » la renvoie tout de suite sur
// son QR code (sans attendre, voir demarrerPageTele), puis il est effacé, sauf si on s'y est relié entre-temps
function rendreTele(code){
  if (!code || !window.firebaseDB) return;
  const ref = window.fbRef(window.firebaseDB, `tele/${code}`);
  window.fbSet(ref, { etat: JSON.stringify({ arret: true }), maj: window.fbServerTimestamp() }).catch(() => {});
  setTimeout(() => { if (codeTele !== code) window.fbSet(ref, null).catch(() => {}); }, 3000);
}

// silencieux : page rechargée en plein cast (par exemple après un changement de thème sur iPhone) : on se
// relie sans afficher « Télé connectée »
function relierTele(code, silencieux = false){
  const ancienCode = codeTele;
  if (ancienCode && ancienCode !== code) {
    // autre télé : l'ancienne revient sur son QR code
    if (arreterSuiviTele) arreterSuiviTele();
    rendreTele(ancienCode);
  }
  codeTele = code;
  try { sessionStorage.setItem(CLE_CODE_TELE, code); } catch (e) {}
  dernierEtatTele = "";
  pauseTeleJusqua = 0;
  erreurTeleSignalee = false;
  clearInterval(minuteurTele);
  minuteurTele = setInterval(envoyerEtatTele, 400);
  attendreFirebase(() => {
    if (codeTele !== code) return;
    suivreDecalageServeur();
    suivreConnexionTele(code);
    envoyerEtatTele();
  });
  majBoutonCaster();
  fermerEcranCaster();
  if (!silencieux) afficherNotificationHaut("", "Télé connectée", true);
}

function arreterTele(){
  const code = codeTele;
  codeTele = null;
  clearInterval(minuteurTele);
  minuteurTele = null;
  try { sessionStorage.removeItem(CLE_CODE_TELE); } catch (e) {}
  if (arreterSuiviTele) arreterSuiviTele();
  rendreTele(code); // la télé revient sur son écran d'attente (QR code)
  majBoutonCaster();
  fermerEcranCaster();
  afficherNotificationHaut("", "Télé déconnectée", true);
}

// Classe de la face d'une carte parmi ses autres classes : « trois_rouge1 », « plus_4_3 », « couleur2 »,
// « carte_doree »… (les doubles d'une même carte ont un numéro à la fin, voir « classes » dans plateau.js)
const FACE_CARTE = /^((zero|un|deux|trois|quatre|cinq|six|sept|huit|neuf|plus_2|interdit|switch)_(vert|jaune|rouge|bleu)\d*|plus_4(_\d+)?|couleur\d*|carte_doree)$/;
function faceCarte(el){
  return Array.from(el.classList).find(c => FACE_CARTE.test(c)) || "";
}

// Carte pour la télé : sa face si elle est retournée, "" si elle est de dos, "d" pour le dos doré,
// "x" si elle a quitté le plateau (carte 1 partie chez un joueur)
function carteTele(el){
  if (el.classList.contains("carte-disparue")) return "x";
  if (el.classList.contains("recachee") && document.documentElement.classList.contains("faces-fermees")) return "r";
  if (el.classList.contains("retournee")) return faceCarte(el) || "";
  return el.classList.contains("dos_dore") ? "d" : "";
}

function estAffiche(el){
  return !!el && el.isConnected && getComputedStyle(el).display !== "none";
}

// Texte d'un élément, ligne par ligne, sans les boutons ni les cartes (lu à l'écran du téléphone)
const BALISES_EN_LIGNE = new Set(["SPAN", "STRONG", "B", "EM", "I", "SMALL"]);
function texteSansBoutons(racine){
  const lignes = [];
  let ligne = "";
  const finir = () => { const t = ligne.replace(/\s+/g, " ").trim(); if (t) lignes.push(t); ligne = ""; };
  const parcourir = (noeud) => {
    noeud.childNodes.forEach((enfant) => {
      if (enfant.nodeType === Node.TEXT_NODE) { ligne += enfant.textContent; return; }
      if (enfant.nodeType !== Node.ELEMENT_NODE) return;
      if (enfant.tagName === "BUTTON" || enfant.tagName === "SCRIPT" || enfant.classList.contains("Carte") ||
          enfant.classList.contains("fin-choix-grid") || enfant.classList.contains("fin-choix-actions") ||
          enfant.classList.contains("plus4-container-joueurs") || enfant.classList.contains("plus4-actions") ||
          enfant.classList.contains("duel-boutons") || getComputedStyle(enfant).display === "none") return;
      if (enfant.tagName === "BR") { finir(); return; }
      if (BALISES_EN_LIGNE.has(enfant.tagName)) { parcourir(enfant); return; }
      finir();
      parcourir(enfant);
      finir();
    });
  };
  parcourir(racine);
  finir();
  return lignes.join("\n").slice(0, 700);
}

const BOUTONS_ACTION_TELE = ".plus4-action-btn, .fin-choix-reveler, .fin-choix-retour, .fin-revanche";

// L'écran par-dessus le plateau en ce moment (annonce, annulation, duel, +4, pari…), ou null
// Volets du téléphone montrés en grand sur la télé : règle d'une carte (appui long) et dernières cartes
function voletPourTele(){
  const carte = document.getElementById("voletCarte");
  if (carte) {
    const face = faceCarte(carte.querySelector(".voletCarte-carte"));
    const nom = carte.querySelector(".voletPause-nom").innerText.trim();
    const regle = carte.querySelector(".voletPause-texte").innerText.trim();
    return { id: "voletCarte", texte: `${nom}\n${regle}`, cartes: face ? [face] : [], choix: [] };
  }
  if (document.getElementById("voletHistorique")) return { id: "voletHistorique", texte: "", cartes: [], choix: [] };
  return null;
}

function ecranPourTele(){
  const overlays = Array.from(document.querySelectorAll('body > [id^="overlay"]')).filter(estAffiche);
  const o = overlays[overlays.length - 1];
  if (!o) return voletPourTele();
  if (o.id === "overlayFinUnRestants" && recapActuel) return { id: o.id, texte: "", cartes: [], choix: [], recap: recapActuel };
  // Cartes montrées : au plus 4 (le pari n'envoie que la carte révélée, pas sa grille de choix)
  let cartes = o.id === "overlayPredictionFin"
    ? Array.from(o.querySelectorAll(".fin-choix-reveal .Carte"))
    : Array.from(o.querySelectorAll(".Carte")).filter(c => !c.closest(".fin-choix-recap"));
  // Duel : une fois ses 2 cartes sorties, plus la carte qui l'a lancé (à côté d'elles, elle avait l'air
  // d'une 3e carte à choisir)
  if (o.id === "overlayDuel" && cartes.some(c => !c.classList.contains("carte-vedette"))) {
    cartes = cartes.filter(c => !c.classList.contains("carte-vedette"));
  }
  // Boutons visibles (joueurs du +4 avec leurs gorgées, « Annuler 1 »…) : affichés en petites étiquettes,
  // sauf les boutons d'action, qui ne servent à rien sur la télé (Retour / Annuler / Valider / Terminer)
  const choix = Array.from(o.querySelectorAll("button"))
    .filter(b => estAffiche(b) && !b.classList.contains("cache") && b.innerText.trim() &&
                 !b.matches(BOUTONS_ACTION_TELE) && b.innerText.trim() !== "Terminer")
    .slice(0, 12)
    .map(b => ({ t: b.innerText.replace(/\s+/g, " ").trim().slice(0, 40), pris: !!b.disabled }));
  return {
    id: o.id,
    texte: texteSansBoutons(o),
    // (cartes des annonces : leur face sans la classe « retournee » ; cartes du duel encore à choisir : sans face, donc de dos)
    cartes: cartes.slice(0, 4).map(c => faceCarte(c) || (c.classList.contains("dos_dore") ? "d" : "")),
    choix
  };
}

function etatPourTele(){
  const enJeu = partieLancee && joueurs.length > 0;
  const idx = enJeu ? indexJoueur % joueurs.length : -1;
  const regles = [document.getElementById("regleZero"), document.getElementById("reglePigeon")]
    .filter(estAffiche).map(el => el.innerText.trim()).filter(Boolean).join("\n")
    || (estAffiche(document.getElementById("rappelTour")) ? document.getElementById("rappelTour").dataset.tele || "" : ""); // (rappel du tour, js/plateau.js)
  return {
    v: 1,
    partie: !!partieLancee,
    cartes: Array.from(plateau.children).map(carteTele),
    restantes: enJeu ? cartesRestantes() : 0,
    joueurs: joueurs.map((nom, i) => ({
      n: avecCouronne(nom),
      a: Number(annulations[nom] || 0),
      t: i === idx,
      p: i === indexPigeon,
      z: estEnPause(nom) ? 1 : 0,       // en pause (toilettes, clope…)
      g: Number(gorgeesBues[nom] || 0), // gorgées bues depuis le début de la partie
      s: cartesSansBoire(nom)           // cartes tirées depuis sa dernière gorgée
    })),
    tour: idx >= 0 ? avecCouronne(joueurs[idx]) : "",
    pigeon: idx >= 0 && idx === indexPigeon,
    couleur: couleurChoisie || "",
    regles,
    theme: document.documentElement.dataset.theme || "bordeaux",
    voix: voixActive ? 1 : 0, // (réglage « Annonces à voix haute » : la télé lit alors les annonces, js/reglages.js)
    vitesseVoix, // (et à la vitesse choisie sur le téléphone)
    pause: !!pauseEnCours,
    musique: caseMusique.checked && !pauseEnCours ? volumeMusique : 0, // (la télé la joue à ce volume ; pas en pause)
    sons: sonsTele,
    rappel: rappelTele,
    eau: eauTele,
    envols: envolsTele,
    // dernières cartes (pas en faces cachées : elles redonneraient les cartes déjà sorties)
    h: estFacesFermees() ? [] : historiqueCartes.map(e => ({ c: e.carte, n: avecCouronne(e.nom), l: lignesHistorique(e) })),
    ecran: ecranPourTele()
  };
}

function envoyerEtatTele(){
  if (!codeTele || !window.firebaseDB) return;
  // Le mode télé est pour le mode classique : partie en ligne lancée => on arrête, la télé revient sur son QR code
  if (enLigneActif) { arreterTele(); return; }
  if (Date.now() < pauseTeleJusqua) return;
  let etat;
  try { etat = JSON.stringify(etatPourTele()); } catch (e) { return; }
  if (etat === dernierEtatTele) return;
  dernierEtatTele = etat;
  const code = codeTele;
  window.fbSet(window.fbRef(window.firebaseDB, `tele/${code}`), { etat, maj: window.fbServerTimestamp() })
    .catch(() => {
      if (codeTele !== code) return;
      dernierEtatTele = "";               // à renvoyer
      pauseTeleJusqua = Date.now() + 5000; // (pas en boucle)
      if (!erreurTeleSignalee) {
        erreurTeleSignalee = true;
        afficherNotificationHaut("", "La télé ne reçoit pas la partie (réseau ?)", true);
      }
    });
}

// Sons du jeu : la télé les joue aussi (pas ceux propres au téléphone : réglages, rappels…).
// Appelé par jouerSon (reglages.js), même si le son du téléphone est coupé.
// (le sifflet « À toi » passe par rappelPourTele : téléphone et télé en même temps)
const SONS_TELE = new Set(["cartes", "doree", "tiens_gueule", "pigeon", "distribuer_gorgees", "annuler_gorgees", "annuler_0_gorgees"]);
let sonsTele = [];      // 4 derniers sons : { i: numéro, n: nom }
let dernierNumeroTele = 0;
// Numéro d'un son ou d'un envol : toujours croissant, même après un rechargement de la page (la télé ne
// rejoue que ceux qu'elle n'a pas encore vus)
function numeroTele(){
  dernierNumeroTele = Math.max(dernierNumeroTele + 1, Date.now());
  return dernierNumeroTele;
}
function sonPourTele(nom){
  if (!codeTele || enLigneActif || !SONS_TELE.has(nom)) return;
  sonsTele = sonsTele.concat({ i: numeroTele(), n: nom }).slice(-4);
  setTimeout(envoyerEtatTele, 60); // tout de suite (avec ce que montre l'écran à ce moment-là)
}

// Rappel « À toi » (sifflet + bandeau qui clignote, plateau.js) : le téléphone et la télé le font au même
// moment (sinon la télé, qui le reçoit par le réseau, était en retard sur le téléphone). Il part un peu
// plus tard, à une heure donnée en temps du serveur Firebase, que chacun connaît (à son décalage
// d'horloge près : .info/serverTimeOffset), le temps que la télé le reçoive.
// Renvoie dans combien de ms le téléphone doit le faire (0 sans télé).
const AVANCE_RAPPEL_TELE = 700;
// Rappel « Bois de l'eau » (js/reglages.js) : la télé l'affiche aussi
let eauTele = 0;
function eauPourTele(){
  if (!codeTele) return;
  eauTele = numeroTele();
  setTimeout(envoyerEtatTele, 0);
}
let rappelTele = null;   // dernier rappel : { i: numéro, t: heure de départ en temps du serveur }
let decalageServeur = 0; // temps du serveur Firebase - temps de cet appareil
let decalageServeurSuivi = false;
function suivreDecalageServeur(){
  if (decalageServeurSuivi || !window.firebaseDB) return;
  decalageServeurSuivi = true;
  window.fbOnValue(window.fbRef(window.firebaseDB, ".info/serverTimeOffset"), (snapshot) => {
    decalageServeur = Number(snapshot.val()) || 0;
  });
}
function rappelPourTele(){
  if (!codeTele || enLigneActif) return 0;
  rappelTele = { i: numeroTele(), t: Date.now() + decalageServeur + AVANCE_RAPPEL_TELE };
  setTimeout(envoyerEtatTele, 0);
  return AVANCE_RAPPEL_TELE;
}

// Carte « 1 » qui s'envole vers le nom du joueur qui la garde (envolerCarteVersJoueur, regles.js) :
// la télé fait la même animation
let envolsTele = [];    // 4 derniers envols : { i: numéro, k: case du plateau, f: face, n: joueur }
function envolPourTele(carteElement, classeCarte, nom){
  if (!codeTele || enLigneActif) return;
  const k = Array.prototype.indexOf.call(plateau.children, carteElement);
  if (k < 0) return;
  envolsTele = envolsTele.concat({ i: numeroTele(), k, f: classeCarte, n: avecCouronne(nom) }).slice(-4);
  setTimeout(envoyerEtatTele, 0);
}

function relierTeleDepuisCode(texte){
  const code = codeTeleDepuisTexte(texte);
  if (!code) { afficherToast("Code de télé invalide (5 caractères)"); return; }
  relierTele(code);
}

const CLE_POSITION_REGLAGES_TELE = "alcuno_position_reglages_tele";

if (!estPageTele) {
  btnCaster.addEventListener("click", ouvrirEcranCaster);
  document.getElementById("btnCasterFermer").addEventListener("click", fermerEcranCaster);
  document.getElementById("btnCasterArreter").addEventListener("click", arreterTele);
  // Réglages : pour une télé que le jeu n'a pas reconnue toute seule (index.html, NAVIGATEUR_TELE)
  document.getElementById("btnAfficherEcranTele").addEventListener("click", () => {
    // (un peu plus tard : le clic des boutons a le temps de jouer, il était coupé par le changement de page)
    // « Retour » de l'écran télé rouvrira les Réglages à cet endroit
    try { sessionStorage.setItem(CLE_POSITION_REGLAGES_TELE, String(ecranReglages.scrollTop)); } catch (e) {}
    setTimeout(() => { location.href = location.pathname + "?tele"; }, 300);
  });
  document.getElementById("btnCasterScanner").addEventListener("click", () => {
    ouvrirScanner({ lireCode: codeTeleDepuisTexte, quandCode: relierTele });
  });
  document.getElementById("btnCasterCode").addEventListener("click", () => relierTeleDepuisCode(champCodeCaster.value));
  champCodeCaster.addEventListener("keydown", (e) => {
    if (e.key === "Enter") relierTeleDepuisCode(champCodeCaster.value);
  });

  // QR code de la télé scanné avec l'appareil photo (lien …/?caster=CODE), ou page rechargée en cours
  // de partie (sans notification) : on relie (ou on garde) la télé
  let codeDepart = "";
  let depuisLien = false;
  try {
    codeDepart = codeTeleDepuisTexte(new URLSearchParams(location.search).get("caster") || "");
    depuisLien = !!codeDepart;
    if (codeDepart) history.replaceState(null, "", location.pathname);
    else codeDepart = codeTeleDepuisTexte(sessionStorage.getItem(CLE_CODE_TELE) || "");
  } catch (e) {}
  if (codeDepart) relierTele(codeDepart, !depuisLien);
  majBoutonCaster();
}
// #endregion

// #region Télé : page …/Alcuno/tele (écran d'attente avec QR code, puis la partie en grand)
function genererCodeTele(){
  let code = "";
  for (let i = 0; i < 5; i++) code += CARACTERES_CODE_TELE[Math.floor(Math.random() * CARACTERES_CODE_TELE.length)];
  return code;
}

function creerCarteTele(valeur){
  const el = document.createElement("div");
  if (valeur === "x") { el.className = "tele-case-vide"; return el; }
  if (valeur === "r") { el.className = "Carte carte-recachee"; return el; } // faces fermées
  el.className = "Carte" + (valeur === "d" ? " dos_dore" : "") + (valeur && valeur !== "d" ? " retournee " + valeur : "");
  return el;
}

// Thème de la télé : celui du téléphone relié (Réglages > Thème) ; sans téléphone (écran d'attente),
// le thème de base, Bordeaux
const THEME_TELE_ATTENTE = "bordeaux";
function appliquerThemeTele(nom){
  if (!nom || !THEMES[nom] || document.documentElement.dataset.theme === nom) return;
  document.documentElement.dataset.theme = nom;
}

function demarrerPageTele(){
  const code = genererCodeTele();
  const lien = `${ADRESSE_SITE_TELE}?caster=${code}`;
  appliquerThemeTele(THEME_TELE_ATTENTE);

  const ecran = document.createElement("div");
  ecran.id = "ecranTele";
  ecran.innerHTML = `
    <div class="tele-attente">
      <div class="tele-attente-texte">
        <div class="tele-titre">ALCUNO</div>
        <div class="tele-sous-titre">Mode télé</div>
        <div class="tele-etape"><span class="tele-num">1</span><span>Sur le téléphone de la partie (mode classique) : bouton <b>Caster</b></span></div>
        <div class="tele-etape"><span class="tele-num">2</span><span>Scanne ce QR code avec l'appli</span></div>
        <div class="tele-etape"><span class="tele-num">3</span><span>La partie s'affiche ici</span></div>
        <button type="button" class="tele-plein-ecran">Plein écran</button>
        <button type="button" class="tele-revenir">← Retour</button>
      </div>
      <div class="tele-attente-qr">
        <div class="tele-qr"></div>
        <div class="tele-code"><small>ou entre le code</small>${code}</div>
      </div>
    </div>
    <div class="tele-jeu" hidden>
      <div class="tele-entete"><div class="tele-titre">ALCUNO</div></div>
      <div class="tele-prepa" hidden>
        <div class="tele-prepa-titre">Joueurs</div>
        <div class="tele-prepa-joueurs"></div>
        <div class="tele-prepa-info"></div>
      </div>
      <div class="tele-gauche">
        <div class="tele-plateau"></div>
        <div class="tele-restantes"></div>
      </div>
      <div class="tele-droite">
        <div class="tele-bloc tele-tour"><div class="tele-tour-label">Tour de</div><div class="tele-tour-nom"></div></div>
        <div class="tele-bloc tele-bloc-joueurs"><div class="tele-bloc-titre">Joueurs</div><div class="tele-joueurs"></div></div>
        <div class="tele-bloc tele-bloc-regles"><div class="tele-bloc-titre">Règles</div><div class="tele-couleur" hidden></div><div class="tele-regles"></div></div>
      </div>
      <div class="tele-son-coupe" hidden>Son coupé : appuie sur OK avec la télécommande</div>
      <div class="tele-pause" hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="4" width="4.6" height="16" rx="1.3"/><rect x="13.9" y="4" width="4.6" height="16" rx="1.3"/></svg>
        <div class="tele-pause-titre">PAUSE</div>
        <div class="tele-pause-texte">Remplissez les verres, on reprend juste après</div>
      </div>
      <div class="tele-pied">Télé ${code}</div>
    </div>
    <div class="tele-ecran" hidden>
      <div class="tele-ecran-cartes"></div>
      <div class="tele-ecran-texte"></div>
      <div class="tele-ecran-choix"></div>
    </div>`;
  document.body.appendChild(ecran);

  const qr = qrcode(0, "M");
  qr.addData(lien);
  qr.make();
  ecran.querySelector(".tele-qr").innerHTML = qr.createSvgTag({ scalable: true, margin: 0 });

  // « Retour » : revient aux Réglages (là où était « Afficher l'écran télé »), avec le clic des boutons
  // (coupé en mode télé) qu'on entend avant de quitter l'écran télé
  ecran.querySelector(".tele-revenir").addEventListener("click", () => {
    jouerSon("bouton");
    try {
      const position = sessionStorage.getItem(CLE_POSITION_REGLAGES_TELE) || "0";
      sessionStorage.setItem(CLE_ROUVRIR_REGLAGES, position);
    } catch (e) {}
    setTimeout(() => { location.href = location.pathname; }, 300);
  });

  // « Plein écran » : caché quand la télé y est déjà (ou quand son navigateur ne sait pas le faire)
  const btnPleinEcran = ecran.querySelector(".tele-plein-ecran");
  btnPleinEcran.addEventListener("click", () => {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  });
  const majPleinEcran = () => {
    const possible = document.fullscreenEnabled || document.webkitFullscreenEnabled;
    const dejaPleinEcran = document.fullscreenElement || document.webkitFullscreenElement ||
      (window.innerWidth >= screen.width && window.innerHeight >= screen.height); // (navigateur déjà en plein écran)
    btnPleinEcran.hidden = !possible || !!dejaPleinEcran;
  };
  ["fullscreenchange", "webkitfullscreenchange", "resize"].forEach(type => window.addEventListener(type, majPleinEcran));
  majPleinEcran();

  // Son : toujours activé sur la télé, au volume du jeu maximum (on règle le volume ou on coupe le son
  // avec la télécommande). Il démarre tout de suite si le navigateur de la télé le permet ; sinon à la
  // première touche de la télécommande, et d'ici là un rappel discret s'affiche pendant la partie.
  caseSons.checked = true;
  volumeSons = 100;
  document.addEventListener("keydown", debloquerSon, { capture: true });
  // La voix des annonces, comme le son, ne part qu'après une première touche de la télécommande (ou un clic)
  const debloquerVoix = () => { try { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; window.speechSynthesis.speak(u); } catch (e) {} };
  ["keydown", "pointerdown"].forEach((type) => document.addEventListener(type, debloquerVoix, { once: true, capture: true }));
  chargerSons();
  const majSonTele = () => {
    ecran.querySelector(".tele-son-coupe").hidden = !!(contexteSon && contexteSon.state === "running");
  };
  setInterval(majSonTele, 1000);
  majSonTele();

  // La télé ne doit pas se mettre en veille pendant la partie
  const garderAllume = () => {
    if ("wakeLock" in navigator && document.visibilityState === "visible") navigator.wakeLock.request("screen").catch(() => {});
  };
  garderAllume();
  document.addEventListener("visibilitychange", garderAllume);

  // Résumé effacé (téléphone parti) : retour au QR code au bout de 5 s seulement, le temps qu'un téléphone
  // qui recharge sa page (par exemple après un changement de thème sur iPhone) revienne. Cast arrêté
  // (résumé « arrêt », voir rendreTele) : tout de suite.
  let minuteurRetourAttente = null;
  attendreFirebase(() => {
    suivreDecalageServeur();
    window.fbOnValue(window.fbRef(window.firebaseDB, `tele/${code}`), (snapshot) => {
      const valeur = snapshot.val();
      let etat = null;
      try { etat = valeur && valeur.etat ? JSON.parse(valeur.etat) : null; } catch (e) { etat = null; }
      clearTimeout(minuteurRetourAttente);
      if (!etat) {
        minuteurRetourAttente = setTimeout(() => dessinerTele(ecran, null), 5000);
        return;
      }
      dessinerTele(ecran, etat.arret ? null : etat);
      dernierEtatNotifTele = etat.arret ? null : etat;
    });
  });
  setInterval(() => avancerNotifsTele(ecran), PAS_NOTIFS_TELE);
}

// #region Télé : petites notifs qui chambrent (façon notification d'iPhone, au-dessus du plateau)
// Une de temps en temps pendant la partie : à un moment au hasard entre 10 et 15 minutes de jeu, et
// seulement quand rien n'est affiché en grand (choix, annonce). Phrase tirée au sort parmi celles qui
// vont avec la partie (pigeon, joueurs), jamais deux fois la même d'affilée. Seulement sur la télé.
const PHRASES_TELE = [
  { pigeon: true, texte: n => `Quelqu’un a pensé à donner des graines à <b>${n}</b> ?` },
  { pigeon: true, texte: n => `<b>${n}</b> picore ses gorgées. 🐦` },
  { aSec: true, texte: n => `<b>${n}</b> n’a pas bu depuis un moment… c’est louche.` },
  { texte: n => `<b>${n}</b> ? Toujours vivant(e) ?` },
  { sansCreateur: true, texte: n => `<b>${n}</b> fait semblant de comprendre les règles depuis le début.` },
  { sansNom: true, texte: () => `Y’en a certains qui ont dit « je bois pas trop ce soir » ? Mdr.` },
  { sansNom: true, texte: () => `Vous pouvez AUSSI prendre vos propres gorgées.` },
  // thème Star Wars seulement : mêlées aux autres, même rythme
  { galaxie: true, sansNom: true, texte: () => `Obi-Wan Kenobière, tu es mon seul espoir.` },
  { galaxie: true, texte: n => `Dark Vodka n’est PAS ton père <b>${n}</b>.` },
  { galaxie: true, sansNom: true, texte: () => `Luke, je suis ton verre.` }
];
const PAS_NOTIFS_TELE = 5000;
// Quelqu'un qui traîne à jouer : une fois par tour, au bout de 1 min 20 (temps sans choix ni annonce à
// l'écran, hors pause)
const DELAI_LENTEUR = 80000;
let cleTourLenteur = "";
let tempsTourLenteur = 0;
let lenteurDite = false;
function phraseLenteur(etat){
  const cle = `${etat.tour}|${etat.restantes}`;
  if (cle !== cleTourLenteur) { cleTourLenteur = cle; tempsTourLenteur = 0; lenteurDite = false; return ""; }
  if (etat.ecran || etat.pause || lenteurDite || !etat.tour) return "";
  tempsTourLenteur += PAS_NOTIFS_TELE;
  if (tempsTourLenteur < DELAI_LENTEUR) return "";
  return `<b>${echapperHtml(etat.tour)}</b> réfléchit depuis plus d’une minute… c’est pas une partie d’échecs.`;
}
const CARTES_A_SEC_TELE = 8; // « n'a pas bu depuis un moment » : au moins 8 cartes tirées sans boire
const DUREE_NOTIF_TELE = 7000;
let dernierEtatNotifTele = null;
let tempsJeuNotifTele = 0;
let prochaineNotifTele = delaiNotifTele();
let dernierePhraseTele = -1;

function delaiNotifTele(){
  return (10 + Math.random() * 5) * 60000;
}

function avancerNotifsTele(ecran){
  const etat = dernierEtatNotifTele;
  if (!etat || !etat.partie || !(etat.cartes || []).length || document.visibilityState !== "visible") return;
  if (etat.pause) return; // (pas de notif ni de temps de jeu compté pendant la pause)
  const lenteur = phraseLenteur(etat);
  if (lenteur) { lenteurDite = true; montrerNotifTele(ecran, lenteur); return; }
  tempsJeuNotifTele += PAS_NOTIFS_TELE;
  if (tempsJeuNotifTele < prochaineNotifTele || etat.ecran) return; // (choix ou annonce à l'écran : on attend)
  const texte = phraseNotifTele(etat);
  if (!texte) return;
  tempsJeuNotifTele = 0;
  prochaineNotifTele = delaiNotifTele();
  montrerNotifTele(ecran, texte);
}

function phraseNotifTele(etat){
  const joueurs = (etat.joueurs || []).map(j => ({ nom: String(j.n || ""), pigeon: !!j.p, sansBoire: Number(j.s) || 0 }))
    .filter(j => j.nom);
  if (!joueurs.length) return "";
  const pigeon = joueurs.find(j => j.pigeon);
  // celui qui n'a rien bu depuis le plus de cartes (s'il y en a un vraiment à sec)
  const aSec = joueurs.reduce((max, j) => (j.sansBoire > (max ? max.sansBoire : 0) ? j : max), null);
  const aSecVraiment = aSec && aSec.sansBoire >= CARTES_A_SEC_TELE ? aSec : null;
  const possibles = PHRASES_TELE
    .map((phrase, i) => ({ phrase, i }))
    .filter(({ phrase, i }) => i !== dernierePhraseTele && (!phrase.pigeon || pigeon) && (!phrase.aSec || aSecVraiment) &&
      (!phrase.galaxie || document.documentElement.dataset.theme === "galaxie"));
  const { phrase, i } = possibles[Math.floor(Math.random() * possibles.length)];
  dernierePhraseTele = i;
  let candidats = phrase.pigeon ? [pigeon] : phrase.aSec ? [aSecVraiment] : joueurs;
  if (phrase.sansCreateur) candidats = candidats.filter(j => !j.nom.includes("👑"));
  if (!phrase.sansNom && !candidats.length) return "";
  const nom = phrase.sansNom ? "" : candidats[Math.floor(Math.random() * candidats.length)].nom;
  return phrase.texte(echapperHtml(nom));
}

function montrerNotifTele(ecran, texte){
  const ancienne = ecran.querySelector(".tele-notif");
  if (ancienne) ancienne.remove();
  const notif = document.createElement("div");
  notif.className = "tele-notif";
  notif.innerHTML = `<img src="icones/icone-192.png" alt=""><div><div class="tele-notif-haut">` +
    `<span>ALCUNO</span><span class="tele-notif-heure">maintenant</span></div><div class="tele-notif-texte">${texte}</div></div>`;
  // centrée au-dessus du plateau, juste sous le titre ALCUNO
  const zone = ecran.querySelector(".tele-gauche").getBoundingClientRect();
  const entete = ecran.querySelector(".tele-entete").getBoundingClientRect();
  notif.style.left = `${zone.left + zone.width / 2}px`;
  notif.style.top = `${entete.bottom + 12}px`;
  ecran.appendChild(notif);
  setTimeout(() => notif.classList.add("tele-notif-depart"), DUREE_NOTIF_TELE);
  setTimeout(() => notif.remove(), DUREE_NOTIF_TELE + 600);
}

// Sans télé reliée : les mêmes petites notifs sur le téléphone (classique et en ligne : en ligne, chaque
// téléphone a les siennes, à son propre moment), en haut comme le rappel « Bois de l'eau », glissables
let tempsJeuNotifTel = 0;
let prochaineNotifTel = delaiNotifTele();
setInterval(() => {
  if (!partieLancee || pauseEnCours || codeTele || document.visibilityState !== "visible") return;
  if (ecranNouvellePartieOuvert()) return; // (js/regles.js) : ce temps-là ne compte pas
  const etat = etatPourTele();
  const libre = !etat.ecran && etat.cartes.length &&
    !document.querySelector("#rappelEau, #notifChambrage, #voletPause, #voletCarte, #voletHistorique");
  const lenteur = phraseLenteur(etat);
  if (lenteur && libre) { lenteurDite = true; afficherNotifChambrage(lenteur); return; }
  tempsJeuNotifTel += PAS_NOTIFS_TELE;
  if (tempsJeuNotifTel < prochaineNotifTel) return;
  // (choix ou annonce à l'écran, volet ouvert, autre notification : on attend)
  if (!libre) return;
  const texte = phraseNotifTele(etat);
  if (!texte) return;
  tempsJeuNotifTel = 0;
  prochaineNotifTel = delaiNotifTele();
  afficherNotifChambrage(texte);
}, PAS_NOTIFS_TELE);

function afficherNotifChambrage(texte){
  const ancienne = document.getElementById("notifChambrage");
  if (ancienne) ancienne.remove();
  const notif = document.createElement("div");
  notif.id = "notifChambrage";
  notif.setAttribute("role", "status");
  // Comme une vraie notification du téléphone : Android ou iPhone (iPhone aussi sur ordinateur), en clair
  // ou en sombre selon le réglage du téléphone (voir le CSS). (texte : noms déjà échappés)
  if (systemeStats() === "android") {
    notif.className = "notif-android";
    notif.innerHTML = `<div class="notifChambrage-haut"><img src="icones/icone-192.png" alt="">` +
      `<span>Alcuno</span><span>•</span><span>maintenant</span></div><div class="notifChambrage-texte">${texte}</div>`;
  } else {
    notif.innerHTML = `<img src="icones/icone-192.png" alt=""><div><div class="notifChambrage-haut">` +
      `<span>ALCUNO</span><span>maintenant</span></div><div class="notifChambrage-texte">${texte}</div></div>`;
  }
  notif.insertAdjacentHTML("beforeend", '<span class="rappelEau-languette" aria-hidden="true"></span>');
  rendreNotifGlissable(notif, DUREE_NOTIF_TELE);
  document.body.appendChild(notif);
  vibrer([40]);
}
// #endregion

// Sons du téléphone joués par la télé : seulement ceux arrivés depuis le dernier résumé (pas les
// anciens quand la télé vient de se relier)
let dernierSonTele = null;
let dernierEnvolTele = null;
let dernierRappelTele = null;
let dernierEauTele = null;
function montrerEauTele(ecran, eau){
  const i = Number(eau) || 0;
  if (dernierEauTele !== null && i > dernierEauTele) {
    montrerNotifTele(ecran, "💧 <b>MESSAGE DE TON ANGE GARDIEN</b><br>L’eau aussi, ça se boit 😉");
    jouerSon("eau");
  }
  dernierEauTele = Math.max(dernierEauTele || 0, i);
}
function jouerSonsTele(sons){
  sons = Array.isArray(sons) ? sons : [];
  const plusRecent = sons.reduce((max, son) => Math.max(max, Number(son.i) || 0), 0);
  if (dernierSonTele !== null) {
    sons.filter(son => son.i > dernierSonTele && SONS_TELE.has(son.n)).forEach(son => jouerSon(son.n));
  }
  dernierSonTele = Math.max(dernierSonTele || 0, plusRecent);
}

// Rappel « À toi » : sifflet + bloc « Tour de » qui s'illumine, à l'heure donnée par le téléphone (voir
// rappelPourTele), donc en même temps que lui ; pas s'il arrive avec plus de 1,5 s de retard
function programmerRappelTele(ecran, rappel){
  const i = rappel ? Number(rappel.i) || 0 : 0;
  if (dernierRappelTele !== null && i > dernierRappelTele) {
    const attente = Number(rappel.t) - (Date.now() + decalageServeur);
    if (attente > -1500) {
      setTimeout(() => {
        jouerSon("tour");
        faireClignoterTourTele(ecran);
      }, Math.max(0, attente));
    }
  }
  dernierRappelTele = Math.max(dernierRappelTele || 0, i);
}

// Bloc « Tour de » qui clignote 3 fois (comme la bannière du téléphone, voir rappel-tour dans le CSS)
function faireClignoterTourTele(ecran){
  const tour = ecran.querySelector(".tele-tour");
  tour.classList.remove("tele-rappel-tour");
  void tour.offsetWidth; // relance l'animation si elle était déjà là
  tour.classList.add("tele-rappel-tour");
  tour.addEventListener("animationend", () => tour.classList.remove("tele-rappel-tour"), { once: true });
}

// Même animation que sur le téléphone : la carte part de sa case vers le +1 du joueur, qui grossit
// un instant à son arrivée (seulement les envols nouveaux, comme les sons)
function envolerCartesTele(ecran, envols){
  envols = Array.isArray(envols) ? envols : [];
  const plusRecent = envols.reduce((max, envol) => Math.max(max, Number(envol.i) || 0), 0);
  if (dernierEnvolTele !== null) {
    envols.filter(envol => envol.i > dernierEnvolTele).forEach(envol => envolerCarteTele(ecran, envol));
  }
  dernierEnvolTele = Math.max(dernierEnvolTele || 0, plusRecent);
}

function envolerCarteTele(ecran, envol){
  const caseDepart = ecran.querySelector(".tele-plateau").children[envol.k];
  if (!caseDepart || !FACE_CARTE.test(envol.f) || !caseDepart.animate) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const depart = caseDepart.getBoundingClientRect();
  const badgeDuJoueur = () => {
    const ligne = Array.from(ecran.querySelectorAll(".tele-joueur")).find(l => l.dataset.nom === envol.n);
    return ligne && (ligne.querySelector(".tele-badge") || ligne);
  };
  const cible = badgeDuJoueur();
  if (!depart.width || !cible) return;
  const zone = cible.getBoundingClientRect();
  const dx = zone.left + zone.width / 2 - (depart.left + depart.width / 2);
  const dy = zone.top + zone.height / 2 - (depart.top + depart.height / 2);

  const vol = creerCarteTele(envol.f);
  vol.classList.add("tele-envol");
  Object.assign(vol.style, {
    left: depart.left + "px", top: depart.top + "px",
    width: depart.width + "px", height: depart.height + "px"
  });
  ecran.appendChild(vol);
  const animation = vol.animate([
    { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
    { transform: "translate(0, -1.4vh) scale(1.15) rotate(-4deg)", opacity: 1, offset: 0.25 }, // on la « prend »
    { transform: `translate(${dx}px, ${dy}px) scale(0.22) rotate(8deg)`, opacity: 0.35, offset: 1 }
  ], { duration: 950, easing: "ease-in-out", fill: "forwards" });
  animation.onfinish = () => {
    vol.remove();
    const badge = badgeDuJoueur();
    if (!badge || !badge.classList.contains("tele-badge")) return;
    badge.classList.remove("tele-badge-pulse");
    void badge.offsetWidth; // relance l'animation
    badge.classList.add("tele-badge-pulse");
  };
}

// Annonces à voix haute sur la télé : quand le téléphone qui caste a activé le réglage, la télé lit la fenêtre d'annonce affichée,
// sinon la règle / le rappel du tour (« C'est à Tom de jouer… »). Chaque texte n'est lu qu'une fois tant qu'il reste affiché.
let derniereLectureTele = "";
function lireSurTele(etat){
  if (!etat || !etat.voix || !etat.partie) { derniereLectureTele = ""; return; }
  const e = etat.ecran;
  const texte = e ? (e.recap ? "" : e.texte || "") : etat.regles || "";
  if (!texte) { derniereLectureTele = ""; return; }
  const cle = (e ? e.id : "") + "|" + texte;
  if (cle === derniereLectureTele) return;
  derniereLectureTele = cle;
  try { dire(String(texte).replace(/\n+/g, ". "), false, etat.vitesseVoix); } catch (err) {}
}

function dessinerTele(ecran, etat){
  const attente = ecran.querySelector(".tele-attente");
  const jeu = ecran.querySelector(".tele-jeu");
  const surEcran = ecran.querySelector(".tele-ecran");
  if (!etat) {
    attente.hidden = false; jeu.hidden = true; surEcran.hidden = true;
    document.documentElement.classList.remove("tele-ecran-ouvert");
    appliquerThemeTele(THEME_TELE_ATTENTE);
    dernierSonTele = null;
    dernierEnvolTele = null;
    dernierRappelTele = null;
    dernierEauTele = null;
    ecran._pigeonTele = undefined;
    ecran._pigeonTeleA = 0;
    musiqueTele = null; // (plus de téléphone relié : plus de musique)
    pauseMusiqueTele = false;
    majMusique();
    return;
  }
  attente.hidden = true;
  jeu.hidden = false;
  appliquerThemeTele(etat.theme);
  lireSurTele(etat);
  musiqueTele = Number(etat.musique) > 0 ? { volume: Number(etat.musique), theme: etat.theme, enPartie: !!etat.partie } : null;
  pauseMusiqueTele = !!etat.pause; // (la musique reprendra au même endroit après la pause)
  majMusique();
  ecran.querySelector(".tele-pause").hidden = !etat.pause;
  jouerSonsTele(etat.sons);
  programmerRappelTele(ecran, etat.rappel);
  montrerEauTele(ecran, etat.eau);

  // Avant la partie (joueurs en cours d'ajout) : les joueurs en grand, au milieu
  const cartes = Array.isArray(etat.cartes) ? etat.cartes : [];
  const enPreparation = cartes.length === 0;
  ecran.querySelector(".tele-prepa").hidden = !enPreparation;
  ecran.querySelector(".tele-gauche").hidden = enPreparation;
  ecran.querySelector(".tele-droite").hidden = enPreparation;
  if (enPreparation) {
    const noms = (etat.joueurs || []).map(j => j.n);
    const zone = ecran.querySelector(".tele-prepa-joueurs");
    if (zone.dataset.noms !== noms.join("\n")) { // (seulement si la liste a changé : pas de clignotement)
      zone.dataset.noms = noms.join("\n");
      zone.innerHTML = "";
      noms.forEach((nom) => {
        const puce = document.createElement("div");
        puce.className = "tele-prepa-joueur";
        puce.innerText = nom;
        zone.appendChild(puce);
      });
    }
    zone.classList.toggle("tele-prepa-nombreux", noms.length > 8);
    ecran.querySelector(".tele-prepa-info").innerText = noms.length >= 2
      ? "La partie va commencer…"
      : "Ajoute les joueurs sur le téléphone";
  }

  // Plateau : on ne recrée que les cartes qui ont changé (pas de clignotement)
  const plateauTele = ecran.querySelector(".tele-plateau");
  while (plateauTele.children.length > cartes.length) plateauTele.lastChild.remove();
  cartes.forEach((valeur, i) => {
    const actuelle = plateauTele.children[i];
    if (actuelle && actuelle.dataset.valeur === valeur) return;
    const nouvelle = creerCarteTele(valeur);
    nouvelle.dataset.valeur = valeur;
    if (actuelle) actuelle.replaceWith(nouvelle); else plateauTele.appendChild(nouvelle);
  });
  dessinerDernieresTele(ecran.querySelector(".tele-restantes"), etat.partie ? etat.h : []);

  // Tour de…
  const tour = ecran.querySelector(".tele-tour");
  tour.hidden = !etat.tour;
  tour.classList.toggle("tele-pigeon", !!etat.pigeon);
  tour.style.setProperty("--couleur-tele", COULEURS_JEU[etat.couleur] || "transparent");
  tour.classList.toggle("tele-avec-couleur", !!COULEURS_JEU[etat.couleur]);
  const nomTour = etat.pigeon ? `PIGEON (${etat.tour})` : etat.tour;
  const elNomTour = ecran.querySelector(".tele-tour-nom");
  elNomTour.innerText = nomTour;
  // Nom long (« PIGEON (Maximilien 👑) ») : plus petit, pour tenir sur une ligne
  elNomTour.style.fontSize = nomTour.length > 18 ? "3.4vh" : nomTour.length > 12 ? "4.2vh" : "";

  // Joueurs
  // (refaite seulement si elle a changé : le +1 qui grossit à l'arrivée d'une carte n'est pas coupé)
  const liste = ecran.querySelector(".tele-joueurs");
  const cleJoueurs = JSON.stringify(etat.joueurs || []);
  if (liste.dataset.cle !== cleJoueurs) {
    liste.dataset.cle = cleJoueurs;
    liste.innerHTML = "";
    liste.classList.toggle("tele-joueurs-2col", (etat.joueurs || []).length > 7); // (le bloc Règles garde sa place)
    (etat.joueurs || []).forEach((j) => {
      const ligne = document.createElement("div");
      ligne.className = "tele-joueur" + (j.t ? " tele-joueur-actif" : "") + (j.z ? " tele-joueur-pause" : "") + (j.p ? " tele-joueur-pigeon" : "");
      ligne.dataset.nom = j.n;
      const nom = document.createElement("span");
      nom.innerText = j.n + (j.p ? " 🐦" : "") + (j.z ? " · en pause" : "");
      ligne.appendChild(nom);
      if (j.a > 0) {
        const badge = document.createElement("span");
        badge.className = "tele-badge";
        badge.innerText = `+${j.a}`;
        ligne.appendChild(badge);
      }
      liste.appendChild(ligne);
    });
  }
  // Nouveau pigeon : sa ligne clignote en turquoise quand l'annonce du téléphone se ferme (comme sur le téléphone,
  // voir faireClignoterPigeon dans js/plateau.js). Pas au premier état reçu (téléphone qui se relie en pleine partie).
  const pigeonTele = ((etat.joueurs || []).find(j => j.p) || {}).n || null;
  if (ecran._pigeonTele !== undefined && pigeonTele && pigeonTele !== ecran._pigeonTele) ecran._pigeonTeleA = Date.now();
  ecran._pigeonTele = pigeonTele;
  if (ecran._pigeonTeleA && !etat.ecran) {
    const recent = Date.now() - ecran._pigeonTeleA < 30000;
    ecran._pigeonTeleA = 0;
    const ligne = recent ? liste.querySelector(".tele-joueur-pigeon") : null;
    if (ligne) {
      ligne.classList.remove("pigeon-flash");
      void ligne.offsetWidth; // relance l'animation si elle était déjà là
      ligne.classList.add("pigeon-flash");
      ligne.addEventListener("animationend", () => ligne.classList.remove("pigeon-flash"), { once: true });
    }
  }
  envolerCartesTele(ecran, etat.envols); // (plateau et joueurs à jour : départ et arrivée en place)

  // Règles (toujours affiché, comme sur le téléphone) : couleur à boire en cours, puis la règle
  const hexCouleur = COULEURS_JEU[etat.couleur];
  const elCouleur = ecran.querySelector(".tele-couleur");
  elCouleur.hidden = !hexCouleur;
  elCouleur.textContent = "";
  elCouleur.style.setProperty("--c", hexCouleur || "");
  if (hexCouleur) {
    // comme sur le téléphone : la couleur et ce qu'elle fait
    const carre = document.createElement("span");
    carre.className = "tele-couleur-carre";
    const texte = document.createElement("span");
    const nom = document.createElement("b");
    nom.textContent = etat.couleur.toUpperCase();
    texte.append(nom, ` : 1 gorgée en plus pour le prochain qui tire une carte ${ADJECTIFS_COULEUR[etat.couleur] || etat.couleur}`);
    elCouleur.append(carre, texte);
  }
  afficherRegleBloc(ecran.querySelector(".tele-regles"), etat.regles); // (js/plateau.js)

  // Écran en cours sur le téléphone (annonce, duel, +4, pari…)
  const e = etat.ecran;
  surEcran.hidden = !e;
  document.documentElement.classList.toggle("tele-ecran-ouvert", !!e); // (pas de reflet Prestige dessus)
  surEcran.classList.toggle("tele-ecran-historique", !!e && e.id === "voletHistorique");
  surEcran.classList.toggle("tele-ecran-recap", !!(e && e.recap));
  if (e && e.recap) {
    surEcran.querySelector(".tele-ecran-cartes").innerHTML = "";
    surEcran.querySelector(".tele-ecran-choix").innerHTML = "";
    const zone = surEcran.querySelector(".tele-ecran-texte");
    const cle = JSON.stringify(e.recap);
    if (zone.dataset.recap !== cle) { zone.dataset.recap = cle; zone.innerHTML = ""; zone.appendChild(construireRecap(e.recap)); }
    return;
  }
  delete surEcran.querySelector(".tele-ecran-texte").dataset.recap;
  if (e && e.id === "voletHistorique") {
    surEcran.querySelector(".tele-ecran-cartes").innerHTML = "";
    surEcran.querySelector(".tele-ecran-choix").innerHTML = "";
    dessinerHistoriqueTele(surEcran.querySelector(".tele-ecran-texte"), etat.h || []);
  } else if (e) {
    const zoneCartes = surEcran.querySelector(".tele-ecran-cartes");
    zoneCartes.innerHTML = "";
    (e.cartes || []).forEach(valeur => zoneCartes.appendChild(creerCarteTele(valeur)));
    const zoneTexte = surEcran.querySelector(".tele-ecran-texte");
    zoneTexte.innerHTML = "";
    String(e.texte || "").split("\n").filter(Boolean).forEach((t, i) => {
      const l = document.createElement("div");
      l.className = i === 0 ? "tele-ecran-titre" : "tele-ecran-detail";
      l.innerText = t;
      zoneTexte.appendChild(l);
    });
    const zoneChoix = surEcran.querySelector(".tele-ecran-choix");
    zoneChoix.innerHTML = "";
    (e.choix || []).forEach((c) => {
      const puce = document.createElement("span");
      puce.className = "tele-puce" + (c.pris ? " tele-puce-prise" : "");
      puce.innerText = c.t;
      zoneChoix.appendChild(puce);
    });
  }
}

// Sous le plateau : « Dernières cartes tirées », en petit avec le prénom (la plus récente entourée)
function dessinerDernieresTele(zone, historique){
  historique = Array.isArray(historique) ? historique : [];
  const cle = JSON.stringify(historique.map(h => [h.c, h.n]));
  if (zone.dataset.cle === cle) return;
  zone.dataset.cle = cle;
  zone.innerHTML = "";
  zone.classList.toggle("tele-dernieres", historique.length > 0);
  if (!historique.length) return;
  const titre = document.createElement("span");
  titre.className = "tele-dernieres-titre";
  titre.innerText = "Dernières cartes tirées";
  zone.appendChild(titre);
  historique.forEach((h) => {
    const item = document.createElement("div");
    item.className = "tele-dernieres-item";
    const nom = document.createElement("span");
    nom.innerText = h.n;
    item.append(creerCarteTele(h.c), nom);
    zone.appendChild(item);
  });
}

// En grand, quand le téléphone ouvre ses dernières cartes : la liste avec ce qui s'est passé
function dessinerHistoriqueTele(zone, historique){
  zone.innerHTML = "";
  const titre = document.createElement("div");
  titre.className = "tele-ecran-titre";
  titre.innerText = "Dernières cartes";
  zone.appendChild(titre);
  historique.forEach((h) => {
    const ligne = document.createElement("div");
    ligne.className = "tele-historique-ligne";
    const texte = document.createElement("div");
    const nom = document.createElement("b");
    nom.innerText = h.n;
    texte.appendChild(nom);
    const quoi = document.createElement("div");
    quoi.className = "tele-historique-quoi";
    remplirAvecGorgees(quoi, (h.l || []).join(" · ")); // (js/plateau.js)
    texte.appendChild(quoi);
    ligne.append(creerCarteTele(h.c), texte);
    zone.appendChild(ligne);
  });
}

if (estPageTele) demarrerPageTele();
// #endregion
