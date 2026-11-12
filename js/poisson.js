// ===== Poisson d'avril : 3 blagues en réserve, une seule tombe le 1er avril (style_poisson.css) =====
// 1 = le titre de l'accueil devient « UNO » et tout texte « Alcuno » du jeu devient « Uno » (partout, y compris ce qui s'affiche plus tard) ; un tap dessus ouvre un message qui reste jusqu'à « Trop drôle ».
// 2 = fausse mise à jour « tout le monde boit triple » : le bouton OK s'enfuit (7 tentatives), puis avoue « Poisson d'avril ».
// 3 = faux plantage : le bouton « Réparer » s'enfuit (7 tentatives) et avoue « Poisson d'avril ». Par sécurité, les deux avouent aussi au bout de 20 s.
// Le tirage est gardé par appareil et par année (relancer le jeu ne change pas la blague). Les blagues 2 et 3 attendent l'accueil
// (jamais en pleine partie) et ne s'affichent qu'une fois ; la 1 dure toute la journée. Rien n'est envoyé à l'onglet Santé :
// le faux plantage est un simple dessin, aucune vraie erreur n'est déclenchée.
// Pour les voir hors du 1er avril (tests) : ouvrir le jeu avec ?poisson=1, ?poisson=2 ou ?poisson=3, ou appeler afficherPoisson(n).
const NB_POISSONS = 3;

function afficherPoisson(n){
  if (n === 1) poissonTitreUno();
  else if (n === 2) poissonFausseMiseAJour();
  else if (n === 3) poissonFauxPlantage();
}

// Bouton qui s'enfuit sous le doigt ; quand c'est fini il avoue et se laisse enfin taper (ferme la fenêtre).
// options : { apresFuites, apresMs, aveu, fermer }
function boutonFuyard(bouton, options){
  let fuites = 0, avoue = false;
  const avouer = () => {
    if (avoue) return;
    avoue = true;
    bouton.classList.remove("poisson-fuit");
    bouton.classList.add("poisson-aveu");
    bouton.style.left = bouton.style.top = "";
    bouton.textContent = options.aveu;
  };
  const fuir = (e) => {
    if (avoue) return;
    e.preventDefault();
    fuites++;
    if (options.apresFuites && fuites >= options.apresFuites) { avouer(); return; }
    const r = bouton.getBoundingClientRect();
    const marge = 12;
    const maxX = Math.max(marge, window.innerWidth - r.width - marge);
    const maxY = Math.max(marge, window.innerHeight - r.height - marge);
    bouton.classList.add("poisson-fuit");
    bouton.style.left = (marge + Math.random() * (maxX - marge)) + "px";
    bouton.style.top = (marge + Math.random() * (maxY - marge)) + "px";
    vibrer([20]);
  };
  bouton.addEventListener("pointerdown", fuir);
  bouton.addEventListener("click", (e) => { if (avoue) options.fermer(); else e.preventDefault(); });
  if (options.apresMs) setTimeout(avouer, options.apresMs);
}

function poissonFenetre(id, classe, html){
  if (document.getElementById(id)) return null;
  const voile = document.createElement("div");
  voile.id = id;
  voile.className = "poisson-voile " + classe;
  voile.setAttribute("role", "dialog");
  voile.innerHTML = html;
  document.body.appendChild(voile);
  return voile;
}

// ----- 1 : titre « UNO » -----
// « Alcuno » -> « Uno » dans tout texte visible et dans alt / title / aria-label / placeholder, en gardant la casse.
// On laisse les adresses (tristan-escardo.github.io/Alcuno…) : les changer les rendrait fausses.
const ATTRIBUTS_POISSON = ["alt", "title", "aria-label", "placeholder"];
function poissonTexteUno(t){
  return t.replace(/(?<![\w\/.@#-])(alc ?uno)(?![\w.\/-])/gi, (m) => m === m.toUpperCase() ? "UNO" : m[0] === m[0].toUpperCase() ? "Uno" : "uno");
}
function poissonParcourir(racine){
  if (!racine) return;
  if (racine.nodeType === 3) {
    const t = racine.nodeValue, n = poissonTexteUno(t);
    if (n !== t) racine.nodeValue = n;
    return;
  }
  if (racine.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(racine.tagName)) return;
  const elements = [racine, ...racine.querySelectorAll("*")];
  for (const el of elements) {
    for (const a of ATTRIBUTS_POISSON) {
      const v = el.getAttribute(a);
      if (v) { const n = poissonTexteUno(v); if (n !== v) el.setAttribute(a, n); }
    }
  }
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
    acceptNode: (nd) => /^(SCRIPT|STYLE|TEXTAREA)$/.test(nd.parentNode?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const noeuds = [];
  while (marcheur.nextNode()) noeuds.push(marcheur.currentNode);
  noeuds.forEach(poissonParcourir);
}
let poissonObservateur = null;
function poissonToutEnUno(){
  if (poissonObservateur) return;
  document.documentElement.classList.add("poisson-uno"); // dos de cartes « UNO » (style_poisson.css, généré par outils/poisson_dos.py)
  document.title = poissonTexteUno(document.title);
  poissonParcourir(document.body);
  poissonObservateur = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") poissonParcourir(m.target);
      else if (m.type === "characterData") poissonParcourir(m.target);
      else m.addedNodes.forEach(poissonParcourir);
    }
  });
  poissonObservateur.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTS_POISSON });
}
function poissonTitreUno(){
  poissonToutEnUno();
  const titre = document.getElementById("titreAccueil");
  if (!titre) return;
  if (!titre.classList.contains("poisson-uno")) {
    titre.classList.add("poisson-uno");
    titre.textContent = "UNO";
    titre.setAttribute("aria-label", "Uno");
    titre.addEventListener("click", ouvrirMessagePoissonUno);
  }
}
function ouvrirMessagePoissonUno(){
  const voile = poissonFenetre("fenetrePoisson", "poisson-message", `
    <div class="poisson-carte">
      <div class="poisson-texte"><strong>POISSON D’AVRIL !! 🐟</strong><br>C’est toujours un jeu d’alcool 😊</div>
      <button type="button" class="fenetrePoisson-bouton">Trop drôle</button>
    </div>`);
  if (!voile) return;
  voile.querySelector("button").addEventListener("click", () => voile.remove());
}

// ----- 2 : fausse mise à jour -----
function poissonFausseMiseAJour(){
  const voile = poissonFenetre("fenetrePoisson", "poisson-maj", `
    <div class="poisson-carte">
      <div class="poisson-icone" aria-hidden="true">🍺🍺🍺</div>
      <div class="poisson-titre">Mise à jour obligatoire</div>
      <div class="poisson-texte">Désormais, tout le monde boit triple !</div>
      <button type="button" class="fenetrePoisson-bouton">OK</button>
    </div>`);
  if (!voile) return;
  boutonFuyard(voile.querySelector("button"), { apresFuites: 7, apresMs: 20000, aveu: "Poisson d’avril ! 🐟", fermer: () => voile.remove() });
}

// ----- 3 : faux plantage -----
function poissonFauxPlantage(){
  const voile = poissonFenetre("fenetrePoisson", "poisson-plantage", `
    <div class="poisson-carte">
      <div class="poisson-icone" aria-hidden="true">⚠️</div>
      <div class="poisson-titre">Alcuno a rencontré un problème</div>
      <div class="poisson-texte">Une erreur inattendue est survenue et la partie ne peut plus continuer.</div>
      <div class="poisson-code">TypeError: Cannot read properties of undefined (reading 'cartes')</div>
      <button type="button" class="fenetrePoisson-bouton">Réparer</button>
    </div>`);
  if (!voile) return;
  boutonFuyard(voile.querySelector("button"), { apresFuites: 7, apresMs: 20000, aveu: "Poisson d’avril ! 🐟", fermer: () => voile.remove() });
}

// ----- Tirage du 1er avril -----
function poissonForce(){
  try {
    const n = parseInt(new URLSearchParams(location.search).get("poisson"), 10);
    if (n >= 1 && n <= NB_POISSONS) return n;
  } catch (e) {}
  return 0;
}
function poissonDuJour(){
  const an = new Date().getFullYear();
  const cle = "alcuno_poisson_" + an;
  try {
    let n = parseInt(localStorage.getItem(cle), 10);
    if (!(n >= 1 && n <= NB_POISSONS)) {
      n = 1 + Math.floor(Math.random() * NB_POISSONS);
      localStorage.setItem(cle, String(n));
    }
    return n;
  } catch (e) { return 1; } // stockage bloqué : la blague sans fenêtre, la plus inoffensive
}
function poissonSiBesoin(){
  const force = poissonForce();
  const d = new Date();
  if (!force && !(d.getMonth() === 3 && d.getDate() === 1)) return;
  const n = force || poissonDuJour();
  // Blague 1 : tout de suite, sans attendre l'accueil (sinon, après un rechargement du jeu, par exemple au changement de thème
  // sur iPhone, le titre et les textes redeviennent « Alcuno » pendant plusieurs secondes, voire toute la partie)
  if (n === 1) { poissonTitreUno(); return; }
  const cleVue = "alcuno_poisson_vu_" + d.getFullYear();
  const essayer = () => {
    const accueil = document.getElementById("choixMode");
    const surAccueil = accueil && getComputedStyle(accueil).display !== "none";
    if (!surAccueil) return false; // en pleine partie : on attend le retour à l'accueil
    if (document.querySelector('[id^="fenetre"], [id^="overlay"][style*="flex"]')) return false;
    if (!force) { try { if (localStorage.getItem(cleVue)) return true; localStorage.setItem(cleVue, "1"); } catch (e) { return true; } }
    afficherPoisson(n);
    return true;
  };
  const minuteur = setInterval(() => { if (essayer()) clearInterval(minuteur); }, 2000);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", poissonSiBesoin); else poissonSiBesoin();
