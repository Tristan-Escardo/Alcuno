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

function majBoutonCaster(){
  btnCaster.innerText = codeTele ? "Caster ✓" : "Caster";
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

function relierTele(code){
  codeTele = code;
  try { sessionStorage.setItem(CLE_CODE_TELE, code); } catch (e) {}
  dernierEtatTele = "";
  pauseTeleJusqua = 0;
  erreurTeleSignalee = false;
  clearInterval(minuteurTele);
  minuteurTele = setInterval(envoyerEtatTele, 400);
  attendreFirebase(envoyerEtatTele);
  majBoutonCaster();
  fermerEcranCaster();
  afficherToast("📺 Télé connectée", 2500);
}

function arreterTele(){
  const code = codeTele;
  codeTele = null;
  clearInterval(minuteurTele);
  minuteurTele = null;
  try { sessionStorage.removeItem(CLE_CODE_TELE); } catch (e) {}
  // La télé revient sur son écran d'attente (QR code)
  if (code && window.firebaseDB) {
    window.fbSet(window.fbRef(window.firebaseDB, `tele/${code}`), null).catch(() => {});
  }
  majBoutonCaster();
  fermerEcranCaster();
  afficherToast("Télé déconnectée");
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

// L'écran par-dessus le plateau en ce moment (annonce, annulation, duel, +4, pari…), ou null
function ecranPourTele(){
  const overlays = Array.from(document.querySelectorAll('body > [id^="overlay"]')).filter(estAffiche);
  const o = overlays[overlays.length - 1];
  if (!o) return null;
  // Cartes montrées : au plus 4 (le pari n'envoie que la carte révélée, pas sa grille de choix)
  const cartes = o.id === "overlayPredictionFin"
    ? Array.from(o.querySelectorAll(".fin-choix-reveal .Carte"))
    : Array.from(o.querySelectorAll(".Carte")).filter(c => !c.closest(".fin-choix-recap"));
  // Boutons visibles (joueurs du +4 avec leurs gorgées, « Annuler 1 »…) : affichés en petites étiquettes
  const choix = Array.from(o.querySelectorAll("button"))
    .filter(b => estAffiche(b) && !b.classList.contains("cache") && b.innerText.trim())
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
    .filter(estAffiche).map(el => el.innerText.trim()).filter(Boolean).join("\n");
  return {
    v: 1,
    partie: !!partieLancee,
    cartes: Array.from(plateau.children).map(carteTele),
    restantes: enJeu ? cartesRestantes() : 0,
    joueurs: joueurs.map((nom, i) => ({
      n: avecCouronne(nom),
      a: Number(annulations[nom] || 0),
      t: i === idx,
      p: i === indexPigeon
    })),
    tour: idx >= 0 ? avecCouronne(joueurs[idx]) : "",
    pigeon: idx >= 0 && idx === indexPigeon,
    couleur: couleurChoisie || "",
    regles,
    ecran: ecranPourTele()
  };
}

function envoyerEtatTele(){
  if (!codeTele || !window.firebaseDB || enLigneActif) return; // (mode classique seulement)
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
        afficherToast("📺 La télé ne reçoit pas la partie (réseau ?)", 3500);
      }
    });
}

function relierTeleDepuisCode(texte){
  const code = codeTeleDepuisTexte(texte);
  if (!code) { afficherToast("Code de télé invalide (5 caractères)"); return; }
  relierTele(code);
}

if (!estPageTele) {
  btnCaster.addEventListener("click", ouvrirEcranCaster);
  document.getElementById("btnCasterFermer").addEventListener("click", fermerEcranCaster);
  document.getElementById("btnCasterArreter").addEventListener("click", arreterTele);
  document.getElementById("btnCasterScanner").addEventListener("click", () => {
    ouvrirScanner({ lireCode: codeTeleDepuisTexte, quandCode: relierTele });
  });
  document.getElementById("btnCasterCode").addEventListener("click", () => relierTeleDepuisCode(champCodeCaster.value));
  champCodeCaster.addEventListener("keydown", (e) => {
    if (e.key === "Enter") relierTeleDepuisCode(champCodeCaster.value);
  });

  // QR code de la télé scanné avec l'appareil photo (lien …/?caster=CODE), ou page rechargée en cours
  // de partie : on relie (ou on garde) la télé
  let codeDepart = "";
  try {
    codeDepart = codeTeleDepuisTexte(new URLSearchParams(location.search).get("caster") || "");
    if (codeDepart) history.replaceState(null, "", location.pathname);
    else codeDepart = codeTeleDepuisTexte(sessionStorage.getItem(CLE_CODE_TELE) || "");
  } catch (e) {}
  if (codeDepart) relierTele(codeDepart);
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
  el.className = "Carte" + (valeur === "d" ? " dos_dore" : "") + (valeur && valeur !== "d" ? " retournee " + valeur : "");
  return el;
}

function demarrerPageTele(){
  const code = genererCodeTele();
  const lien = `${ADRESSE_SITE_TELE}?caster=${code}`;

  const ecran = document.createElement("div");
  ecran.id = "ecranTele";
  ecran.innerHTML = `
    <div class="tele-attente">
      <div class="tele-attente-texte">
        <div class="tele-titre">ALCUNO</div>
        <div class="tele-sous-titre">📺 Mode télé</div>
        <div class="tele-etape"><span class="tele-num">1</span><span>Sur le téléphone de la partie (mode classique) : bouton <b>Caster</b></span></div>
        <div class="tele-etape"><span class="tele-num">2</span><span>Scanne ce QR code avec l'appli</span></div>
        <div class="tele-etape"><span class="tele-num">3</span><span>La partie s'affiche ici en grand</span></div>
        <button type="button" class="tele-plein-ecran">Plein écran</button>
      </div>
      <div class="tele-attente-qr">
        <div class="tele-qr"></div>
        <div class="tele-code"><small>ou entre le code</small>${code}</div>
      </div>
    </div>
    <div class="tele-jeu" hidden>
      <div class="tele-entete"><div class="tele-titre">ALCUNO</div></div>
      <div class="tele-gauche">
        <div class="tele-plateau"></div>
        <div class="tele-preparation" hidden>Partie en préparation…</div>
        <div class="tele-restantes"></div>
      </div>
      <div class="tele-droite">
        <div class="tele-bloc tele-tour"><div class="tele-tour-label">TOUR DE</div><div class="tele-tour-nom"></div></div>
        <div class="tele-bloc"><div class="tele-bloc-titre">Joueurs</div><div class="tele-joueurs"></div></div>
        <div class="tele-bloc tele-bloc-regles"><div class="tele-bloc-titre">Règles</div><div class="tele-regles"></div></div>
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

  ecran.querySelector(".tele-plein-ecran").addEventListener("click", () => {
    const el = document.documentElement;
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
  });

  // La télé ne doit pas se mettre en veille pendant la partie
  const garderAllume = () => {
    if ("wakeLock" in navigator && document.visibilityState === "visible") navigator.wakeLock.request("screen").catch(() => {});
  };
  garderAllume();
  document.addEventListener("visibilitychange", garderAllume);

  attendreFirebase(() => {
    window.fbOnValue(window.fbRef(window.firebaseDB, `tele/${code}`), (snapshot) => {
      const valeur = snapshot.val();
      let etat = null;
      try { etat = valeur && valeur.etat ? JSON.parse(valeur.etat) : null; } catch (e) { etat = null; }
      dessinerTele(ecran, etat);
    });
  });
}

function dessinerTele(ecran, etat){
  const attente = ecran.querySelector(".tele-attente");
  const jeu = ecran.querySelector(".tele-jeu");
  const surEcran = ecran.querySelector(".tele-ecran");
  if (!etat) { attente.hidden = false; jeu.hidden = true; surEcran.hidden = true; return; }
  attente.hidden = true;
  jeu.hidden = false;

  // Plateau : on ne recrée que les cartes qui ont changé (pas de clignotement)
  const plateauTele = ecran.querySelector(".tele-plateau");
  const cartes = Array.isArray(etat.cartes) ? etat.cartes : [];
  plateauTele.hidden = cartes.length === 0;
  ecran.querySelector(".tele-preparation").hidden = cartes.length > 0;
  while (plateauTele.children.length > cartes.length) plateauTele.lastChild.remove();
  cartes.forEach((valeur, i) => {
    const actuelle = plateauTele.children[i];
    if (actuelle && actuelle.dataset.valeur === valeur) return;
    const nouvelle = creerCarteTele(valeur);
    nouvelle.dataset.valeur = valeur;
    if (actuelle) actuelle.replaceWith(nouvelle); else plateauTele.appendChild(nouvelle);
  });
  ecran.querySelector(".tele-restantes").innerText = etat.partie && etat.restantes
    ? `${etat.restantes} carte${etat.restantes > 1 ? "s" : ""} restante${etat.restantes > 1 ? "s" : ""}` : "";

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
  const liste = ecran.querySelector(".tele-joueurs");
  liste.innerHTML = "";
  (etat.joueurs || []).forEach((j) => {
    const ligne = document.createElement("div");
    ligne.className = "tele-joueur" + (j.t ? " tele-joueur-actif" : "");
    const nom = document.createElement("span");
    nom.innerText = (j.t ? "▶ " : "") + j.n + (j.p ? " 🐦" : "");
    ligne.appendChild(nom);
    if (j.a > 0) {
      const badge = document.createElement("span");
      badge.className = "tele-badge";
      badge.innerText = `+${j.a}`;
      ligne.appendChild(badge);
    }
    liste.appendChild(ligne);
  });

  // Règles
  ecran.querySelector(".tele-regles").innerText = etat.regles || "";
  ecran.querySelector(".tele-bloc-regles").hidden = !etat.regles;

  // Écran en cours sur le téléphone (annonce, duel, +4, pari…)
  const e = etat.ecran;
  surEcran.hidden = !e;
  if (e) {
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

if (estPageTele) demarrerPageTele();
// #endregion
