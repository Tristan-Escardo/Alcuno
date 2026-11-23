// =============================================================================================
// ALCUNO : petit tutoriel interactif du premier lancement (fichier chargé en dernier : voir l'en-tête de script.js)
// Une mini-partie pour de faux, par-dessus l'accueil : on retourne une carte, le tour passe au joueur suivant,
// doigt appuyé pour revoir une règle, prénom touché pour une pause, pari sur la dernière carte. « Passer » à
// tout moment. À la fin : l'aide des flèches dorées vers les Règles et les Réglages (js/reglages.js).
// Seulement à la première ouverture de l'appli tout juste installée, pour un nouveau joueur (rien d'un joueur
// d'avant dans ce téléphone), une seule fois ; pas dans le navigateur. On le revoit depuis l'écran des Règles
// (« 🎓 Tutoriel »).
// =============================================================================================
// #region Tutoriel
const CLE_TUTORIEL = "alcuno_tutoriel"; // "a_voir" : nouveau joueur qui ne l'a pas encore vu ; "vu" : vu ou passé

function etatTutoriel(){
  try { return localStorage.getItem(CLE_TUTORIEL); } catch (e) { return "vu"; }
}
function noterTutoriel(etat){
  try { localStorage.setItem(CLE_TUTORIEL, etat); } catch (e) {}
}
function tutorielEnAttente(){
  return etatTutoriel() === "a_voir" || !!document.getElementById("tutoriel");
}

// Nouveau joueur : aucune donnée Alcuno dans ce téléphone, à part celles que le jeu écrit tout seul au
// premier lancement (identifiant des stats, réglages à distance, bots, langue, aide vue…)
function joueurToutNeuf(){
  try {
    const neutres = ["alcuno_id_stats", "alcuno_code_invitation", "alcuno_aide_vue", "alcuno_bots", "alcuno_config_distante",
      "alcuno_install_comptee", "alcuno_langue", CLE_TUTORIEL];
    return !Object.keys(localStorage).some((cle) => cle.startsWith("alcuno_") && !neutres.includes(cle));
  } catch (e) { return false; }
}

const NOMS_TUTO = () => [tr("Toi"), "Léa", "Tom"];
const NB_CARTES_TUTO = 8;
let tuto = null; // { racine, etape, depuisRegles, joueur, appui, surveillance }

const ETAPES_TUTO = [
  // 0 : bienvenue
  () => {
    tutoTexte(tr("Bienvenue dans Alcuno !"), tr("Le jeu de cartes qui met l'ambiance. On te montre comment jouer en 30 secondes ?"));
    tutoBoutons([[tr("C'est parti"), () => tutoEtape(1)], [tr("Passer le tutoriel"), () => fermerTutoriel(false), true]]);
  },
  // 1 : retourner une carte
  () => {
    tutoJoueurActif(0);
    tutoTexte(tr("À ton tour"), tr("Toutes les cartes sont posées <b>face cachée</b>. Touche celle de ton choix pour la retourner."));
    tutoBoutons([]);
    tutoAttendreCarte("plus_2_jaune", (regle) => {
      tutoTexte(regle.nom, regle.texte + "<br>" + tr("Chaque carte a sa règle : elle s'affiche quand on la retourne."));
      tutoBoutons([[tr("Suivant"), () => tutoEtape(2)]]);
    });
  },
  // 2 : le joueur suivant
  () => {
    const nom = NOMS_TUTO()[1];
    tutoJoueurActif(1);
    tutoTexte(tr`Au tour de ${nom}`, tr`Ensuite, c'est au joueur suivant. Retourne une carte pour ${nom}.`);
    tutoBoutons([]);
    tutoAttendreCarte("zero_bleu", (regle) => {
      tutoTexte(regle.nom, tr`Tout le monde boit ${"<em>" + texteGorgees(1) + "</em>"}, sauf ${nom}.`);
      tutoBoutons([[tr("Suivant"), () => tutoEtape(3)]]);
    });
  },
  // 3 : doigt appuyé sur une carte retournée => sa règle (le vrai volet du jeu)
  () => {
    tutoJoueurActif(2);
    tutoTexte(tr("Un trou de mémoire ?"), tr("Garde le doigt appuyé sur une carte retournée : sa règle s'affiche."));
    tutoBoutons([]);
    tutoIndice(tuto.racine.querySelectorAll(".tuto-plateau .Carte.retournee"));
    tuto.appui = (classe) => {
      tuto.appui = null;
      tutoIndice([]);
      ouvrirVoletCarte(classe);
      // (volet refermé : on continue)
      tuto.surveillance = setInterval(() => {
        if (document.getElementById("voletCarte")) return;
        clearInterval(tuto.surveillance);
        tutoTexte(tr("Un trou de mémoire ?"), tr("Tu peux aussi relire toutes les règles dans le livre 📖 de l'accueil."));
        tutoBoutons([[tr("Suivant"), () => tutoEtape(4)]]);
      }, 200);
    };
  },
  // 4 : toucher un prénom => pause (ou bot)
  () => {
    const nom = NOMS_TUTO()[2];
    tutoTexte(tr("Une pause ?"), tr`En partie, touche le prénom d'un joueur pour le mettre en pause, ou le faire remplacer par un bot 🤖. Essaie avec ${nom}.`);
    tutoBoutons([]);
    const pastille = tuto.racine.querySelectorAll(".tuto-joueur")[2];
    tutoIndice([pastille]);
    pastille.onclick = () => {
      pastille.onclick = null;
      tutoIndice([]);
      pastille.classList.add("tuto-en-pause");
      tutoJoueurActif(0);
      tutoTexte(tr("Une pause ?"), tr`${nom} est en pause : son tour est sauté jusqu'à son retour.`);
      tutoBoutons([[tr("Suivant"), () => tutoEtape(5)]]);
    };
  },
  // 5 : le pari sur la dernière carte
  () => {
    const cachees = [...tuto.racine.querySelectorAll(".tuto-plateau .Carte:not(.retournee)")];
    cachees.slice(1).forEach((carte) => carte.classList.add("tuto-partie"));
    tutoIndice(cachees.slice(0, 1));
    tutoTexte(tr("La dernière carte"), tr`Quand il ne reste qu'<b>une carte</b>, chacun parie sur son type. Ceux qui trouvent distribuent <em>${texteCulSec()}</em> !`);
    tutoBoutons([[tr("Suivant"), () => tutoEtape(6)]]);
  },
  // 6 : fin
  () => {
    tutoIndice([]);
    tutoTexte(tr("À toi de jouer !"), tr("<b>Mode classique</b> : un seul téléphone, qu'on se passe à tour de rôle.<br><b>Mode en ligne</b> : chacun joue sur son téléphone."));
    tutoBoutons([[tr("C'est parti !"), () => fermerTutoriel(true)]]);
  }
];

function afficherTutoriel(depuisRegles = false){
  if (document.getElementById("tutoriel")) return;
  const racine = document.createElement("div");
  racine.id = "tutoriel";
  racine.setAttribute("role", "dialog");
  racine.setAttribute("aria-label", tr("Tutoriel"));
  racine.innerHTML = `
    <div class="tuto-voile"></div>
    <button type="button" class="tuto-passer"></button>
    <div class="tuto-scene">
      <div class="tuto-joueurs">${NOMS_TUTO().map(() => `<button type="button" class="tuto-joueur"></button>`).join("")}</div>
      <div class="tuto-plateau">${`<div class="Carte"></div>`.repeat(NB_CARTES_TUTO)}</div>
      <div class="tuto-doigt" aria-hidden="true" hidden>👆</div>
      <div class="tuto-precharge" aria-hidden="true"><div class="Carte plus_2_jaune"></div><div class="Carte zero_bleu"></div></div>
    </div>
    <div class="voletPause-feuille tuto-feuille">
      <div class="tuto-points">${ETAPES_TUTO.map(() => "<span></span>").join("")}</div>
      <div class="voletPause-nom"></div>
      <div class="voletPause-texte"></div>
      <div class="tuto-boutons"></div>
    </div>`;
  racine.querySelector(".tuto-passer").textContent = tr("Passer");
  racine.querySelector(".tuto-passer").addEventListener("click", () => fermerTutoriel(false));
  racine.querySelectorAll(".tuto-joueur").forEach((pastille, i) => { pastille.textContent = NOMS_TUTO()[i]; });
  tuto = { racine, etape: -1, depuisRegles, joueur: 0, appui: null, surveillance: null, attenteCarte: null };
  brancherPlateauTuto(racine.querySelector(".tuto-plateau"));
  window.addEventListener("resize", replacerDoigtTuto);
  document.body.appendChild(racine);
  tutoEtape(0);
}

function fermerTutoriel(fini){
  const racine = document.getElementById("tutoriel");
  if (!racine || racine.classList.contains("tuto-sortie")) return;
  const depuisRegles = tuto && tuto.depuisRegles;
  if (tuto) clearInterval(tuto.surveillance);
  tuto = null;
  noterTutoriel("vu");
  window.removeEventListener("resize", replacerDoigtTuto);
  fermerVoletCarte();
  racine.classList.add("tuto-sortie");
  setTimeout(() => racine.remove(), 300);
  if (depuisRegles) return;
  // Fini : les flèches vers les Règles et les Réglages (une fois). Passé : plus rien ne s'ouvre.
  if (fini) { if (!aideDejaVue()) setTimeout(afficherAideAccueil, 320); }
  else { try { localStorage.setItem(CLE_AIDE_VUE, "1"); } catch (e) {} }
}

function tutoEtape(n){
  if (!tuto) return;
  clearInterval(tuto.surveillance);
  tuto.appui = null;
  tuto.attenteCarte = null;
  tuto.etape = n;
  tuto.racine.querySelectorAll(".tuto-points span").forEach((point, i) => point.classList.toggle("actif", i === n));
  tuto.racine.querySelector(".tuto-passer").hidden = n === 0 || n === ETAPES_TUTO.length - 1;
  ETAPES_TUTO[n]();
}

function tutoTexte(titre, html){
  const feuille = tuto.racine.querySelector(".tuto-feuille");
  feuille.querySelector(".voletPause-nom").textContent = titre;
  feuille.querySelector(".voletPause-texte").innerHTML = html; // (textes du jeu, rien qui vient d'un joueur)
  feuille.classList.remove("tuto-change");
  void feuille.offsetWidth;
  feuille.classList.add("tuto-change");
}

// boutons : [texte, action, secondaire ?]
function tutoBoutons(boutons){
  const zone = tuto.racine.querySelector(".tuto-boutons");
  zone.textContent = "";
  boutons.forEach(([texte, action, secondaire]) => {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = secondaire ? "voletPause-annuler" : "voletPause-ok";
    bouton.textContent = texte;
    bouton.addEventListener("click", action);
    zone.appendChild(bouton);
  });
}

function tutoJoueurActif(i){
  tuto.joueur = i;
  tuto.racine.querySelectorAll(".tuto-joueur").forEach((pastille, j) => pastille.classList.toggle("actif", j === i));
}

// Éléments à toucher : ils brillent, et le doigt 👆 montre le premier
function tutoIndice(elements){
  tuto.racine.querySelectorAll(".tuto-indice").forEach((el) => el.classList.remove("tuto-indice"));
  [...elements].forEach((el) => el.classList.add("tuto-indice"));
  tuto.cibleDoigt = elements[0] || null;
  replacerDoigtTuto();
}
function replacerDoigtTuto(){
  if (!tuto) return;
  const doigt = tuto.racine.querySelector(".tuto-doigt");
  const cible = tuto.cibleDoigt;
  doigt.hidden = !cible;
  if (!cible) return;
  const r = cible.getBoundingClientRect(), s = tuto.racine.querySelector(".tuto-scene").getBoundingClientRect();
  doigt.style.left = (r.left - s.left + r.width / 2) + "px";
  doigt.style.top = (r.bottom - s.top - (r.height > 60 ? 10 : -4)) + "px"; // (carte : sur son bas ; prénom : juste dessous)
}

// Le prochain tap sur une carte cachée la retourne : elle montre « face »
function tutoAttendreCarte(face, suite){
  const cachees = tuto.racine.querySelectorAll(".tuto-plateau .Carte:not(.retournee)");
  tutoIndice(cachees);
  tuto.cibleDoigt = cachees[Math.min(2, cachees.length - 1)];
  replacerDoigtTuto();
  tuto.attenteCarte = (carte) => {
    tuto.attenteCarte = null;
    tutoIndice([]);
    retournerCarteTuto(carte, face);
    setTimeout(() => { if (tuto) suite(regleDeCarte(face)); }, 380);
  };
}

function retournerCarteTuto(carte, face){
  jouerSon("cartes");
  const demi = { duration: 170, easing: "ease-in" };
  const tourner = carte.animate ? (a, b, o) => carte.animate([{ transform: a }, { transform: b }], o).finished : () => Promise.resolve();
  tourner("rotateY(0)", "rotateY(90deg)", demi).catch(() => {}).then(() => {
    carte.classList.add(face, "retournee");
    return tourner("rotateY(90deg)", "rotateY(0)", { duration: 170, easing: "ease-out" });
  }).catch(() => {});
}

// Comme le vrai plateau : tap sur une carte cachée, doigt appuyé sur une carte retournée (elles ignorent
// le doigt : on les cherche par leur position)
function brancherPlateauTuto(plateauTuto){
  let appui = null;
  const annuler = () => {
    if (!appui) return;
    clearTimeout(appui.minuteur);
    clearTimeout(appui.minuteurVisuel);
    appui.carte.classList.remove("carte-appuyee");
    appui = null;
  };
  plateauTuto.addEventListener("click", (e) => {
    const carte = e.target.closest(".Carte");
    if (tuto && tuto.attenteCarte && carte && !carte.classList.contains("retournee") && !carte.classList.contains("tuto-partie")) tuto.attenteCarte(carte);
  });
  plateauTuto.addEventListener("pointerdown", (e) => {
    annuler();
    if (!tuto || !tuto.appui) return;
    const carte = [...plateauTuto.querySelectorAll(".Carte.retournee")].find((c) => {
      const r = c.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    });
    if (!carte) return;
    appui = { carte, x: e.clientX, y: e.clientY };
    appui.minuteurVisuel = setTimeout(() => carte.classList.add("carte-appuyee"), 120);
    appui.minuteur = setTimeout(() => {
      const face = faceDeCarte(carte);
      annuler();
      if (!tuto || !tuto.appui || !face) return;
      appuiLongFait = true; // (le clic du doigt levé ne doit pas refermer le volet aussitôt : voir js/plateau.js)
      try { window.getSelection().removeAllRanges(); } catch (err) {}
      vibrer(20);
      jouerSon("regles");
      tuto.appui(face);
    }, DUREE_APPUI_LONG);
  });
  plateauTuto.addEventListener("pointermove", (e) => {
    if (appui && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 10) annuler();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((type) => plateauTuto.addEventListener(type, annuler));
  plateauTuto.addEventListener("contextmenu", (e) => e.preventDefault());
}

// Écran des Règles : « 🎓 Tutoriel » le rejoue (on revient aux Règles à la fin)
document.getElementById("btnTutoDepuisRegles").addEventListener("click", () => afficherTutoriel(true));

// Lancement tout seul : nouveau joueur, dans l'appli installée (estEnAppli, js/reglages.js : dans le navigateur,
// rien n'est décidé, pour qu'il vienne à l'installation), sur l'accueil quand rien d'autre n'est ouvert (partie,
// invitation par QR code…). Pas sur la télé.
// Robots de test (navigator.webdriver) : jamais tout seul, sauf si le test l'a demandé (alcuno_tutoriel = "a_voir").
if (!document.documentElement.classList.contains("mode-tele")) {
  if (etatTutoriel() === null && estEnAppli && !navigator.webdriver) noterTutoriel(joueurToutNeuf() && !premierePartieJouee() ? "a_voir" : "vu");
  if (etatTutoriel() === "a_voir") {
    const verifierTutoriel = () => {
      if (etatTutoriel() !== "a_voir") { clearInterval(surveillanceTuto); return; }
      if (premierePartieJouee()) { noterTutoriel("vu"); clearInterval(surveillanceTuto); return; } // (a déjà joué entre-temps)
      const accueilLibre = !partieLancee && !ouvertureAutoEnAttente &&
        document.getElementById("choixMode").style.display !== "none" &&
        [ecranInstallation, ecranReglages, ecranRegles, ecranCredits].every((page) => page.style.display === "none") &&
        !document.querySelector("#fenetrePrestige, #aideAccueil, #voletCarte, #voletPause");
      if (!accueilLibre) return;
      clearInterval(surveillanceTuto);
      afficherTutoriel();
    };
    const surveillanceTuto = setInterval(verifierTutoriel, 300);
    setTimeout(verifierTutoriel, 50);
  }
}
// #endregion
