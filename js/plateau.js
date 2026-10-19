// =============================================================================================
// ALCUNO : Plateau, outils, joueurs
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Plateau, outils, joueurs, retirer un joueur en partie
const plateau = document.getElementById("plateau");
const joueurActif = document.getElementById("joueurActif");
const listeJoueurs = document.getElementById("listeJoueurs");
const regleZero = document.getElementById("regleZero");
const reglePigeon = document.getElementById("reglePigeon");
const messagesBar = document.getElementById("messages");

const menu = document.getElementById("menu");
const suppression = document.getElementById("suppression");
const listeSuppression = document.getElementById("listeSuppression");

const nomJoueurInput = document.getElementById("nomJoueur");
const btnAjouter = document.getElementById("ajouterJoueur");
const btnJouer = document.getElementById("jouer");
const btnSupprimer = document.getElementById("supprimerJoueur");
const btnNouvellePartie = document.getElementById("nouvellePartie");
const btnTermine = document.getElementById("termineSuppression");
const btnAccueilClassique = document.getElementById("btnAccueilClassique");
const messageTexte = document.getElementById("messageTexte");
let stickyJoueurActif = null;


/* ====== Cartes du plateau principal ====== */
const classes = [
  "zero_vert","zero_jaune","zero_rouge","zero_bleu",

  "un_vert","un_vert1","un_jaune","un_jaune1","un_rouge","un_rouge1","un_bleu","un_bleu1",

  "deux_vert","deux_vert1","deux_jaune","deux_jaune1","deux_rouge","deux_rouge1","deux_bleu","deux_bleu1",

  "trois_vert","trois_vert1","trois_jaune","trois_jaune1","trois_rouge","trois_rouge1","trois_bleu","trois_bleu1",

  "quatre_vert","quatre_vert1","quatre_jaune","quatre_jaune1","quatre_rouge","quatre_rouge1","quatre_bleu","quatre_bleu1",

  "cinq_vert","cinq_vert1","cinq_jaune","cinq_jaune1","cinq_rouge","cinq_rouge1","cinq_bleu","cinq_bleu1",

  "six_vert","six_vert1","six_jaune","six_jaune1","six_rouge","six_rouge1","six_bleu","six_bleu1",

  "sept_vert","sept_vert1","sept_jaune","sept_jaune1","sept_rouge","sept_rouge1","sept_bleu","sept_bleu1",

  "huit_vert","huit_vert1","huit_jaune","huit_jaune1","huit_rouge","huit_rouge1","huit_bleu","huit_bleu1",

  "neuf_vert","neuf_vert1","neuf_jaune","neuf_jaune1","neuf_rouge","neuf_rouge1","neuf_bleu","neuf_bleu1",

  "interdit_vert","interdit_jaune","interdit_rouge","interdit_bleu",

  "couleur","couleur1","couleur2","couleur3",

  "plus_2_vert","plus_2_vert1","plus_2_jaune","plus_2_jaune1",
  "plus_2_rouge","plus_2_rouge1","plus_2_bleu","plus_2_bleu1",

  "plus_4","plus_4_1","plus_4_2","plus_4_3",

  "switch_vert","switch_jaune","switch_rouge","switch_bleu"
];

/* ====== DUEL: cartes retirées du plateau principal ====== */
const duelCartes = [
  "deux_vert","deux_vert1","deux_jaune","deux_jaune1","deux_rouge","deux_rouge1","deux_bleu","deux_bleu1",

  "cinq_vert","cinq_vert1","cinq_jaune","cinq_jaune1","cinq_rouge","cinq_rouge1","cinq_bleu","cinq_bleu1",

  "six_vert","six_vert1","six_jaune","six_jaune1","six_rouge","six_rouge1","six_bleu","six_bleu1",

  "sept_vert","sept_vert1","sept_jaune","sept_jaune1","sept_rouge","sept_rouge1","sept_bleu","sept_bleu1",

  "huit_vert","huit_vert1","huit_jaune","huit_jaune1","huit_rouge","huit_rouge1","huit_bleu","huit_bleu1",

  "neuf_vert","neuf_vert1","neuf_jaune","neuf_jaune1","neuf_rouge","neuf_rouge1","neuf_bleu","neuf_bleu1"
];

// Images des cartes chargées à l'avance (et gardées en mémoire) : sinon, avec un réseau lent,
// la 1re fois qu'une carte sort, l'overlay s'affichait sans la carte le temps que l'image arrive
let imagesCartes = null;
function prechargerImagesCartes(){
  if(imagesCartes) return;
  const test = document.createElement("div");
  test.style.display = "none";
  document.body.appendChild(test);
  const urls = new Set();
  [...classes, "carte_doree"].forEach(c => {
    test.className = "Carte " + c;
    const m = getComputedStyle(test).backgroundImage.match(/url\("?([^")]+)"?\)/);
    if(m) urls.add(m[1]);
  });
  test.remove();
  imagesCartes = [...urls].map(url => { const img = new Image(); img.src = url; return img; });
}
window.addEventListener("load", () => setTimeout(prechargerImagesCartes, 300));

let joueurs = [];
let annulations = {}; // { "Alice": 3, "Bob": 0, ... }
// Compteur de gorgées de la partie : bues (annulations déduites ; un cul sec compte pour GORGEES_CUL_SEC)
// et nombre de cartes restantes la dernière fois que chacun a bu (« n'a pas bu depuis un moment »)
let gorgeesBues = {};       // { "Alice": 12, ... }
let derniereGorgeeA = {};   // { "Alice": 31, ... } (cartes restantes à ce moment-là)
const GORGEES_CUL_SEC = 5;

function reinitialiserGorgees(){
  gorgeesBues = {};
  derniereGorgeeA = {};
  const restantes = cartesRestantes();
  joueurs.forEach(nom => { gorgeesBues[nom] = 0; derniereGorgeeA[nom] = restantes; });
}

function noterGorgees(nom, n){
  n = Number(n) || 0;
  if(!nom || n <= 0) return;
  gorgeesBues[nom] = (gorgeesBues[nom] || 0) + n;
  derniereGorgeeA[nom] = cartesRestantes();
}

// Cartes tirées depuis la dernière gorgée de ce joueur
function cartesSansBoire(nom){
  const depuis = derniereGorgeeA[nom];
  return depuis === undefined ? 0 : Math.max(0, depuis - cartesRestantes());
}
let paquet = [];

// Easter egg : environ 1 partie sur 12, une des cases du plateau cache la carte dorée (à la place d'une carte normale)
const CHANCE_CARTE_DOREE = 1 / 12;

// Jamais de carte dorée dans la toute première partie jouée sur ce téléphone (quelqu'un qui découvre le
// jeu). En ligne, c'est la première partie de l'hôte qui compte : il le dit aux autres par la graine du
// mélange, augmentée de GRAINE_SANS_CARTE_DOREE (le générateur n'en garde que les 32 bits du bas : même
// mélange ; tous les joueurs d'une partie ont la même version du jeu, voir versionCompatible)
const CLE_PREMIERE_PARTIE_JOUEE = "alcuno_premiere_partie_jouee";
const GRAINE_SANS_CARTE_DOREE = 4294967296; // 2^32

function premierePartieJouee(){
  try { return localStorage.getItem(CLE_PREMIERE_PARTIE_JOUEE) === "1"; } catch (e) { return true; }
}

function noterPremierePartieJouee(){
  try { localStorage.setItem(CLE_PREMIERE_PARTIE_JOUEE, "1"); } catch (e) {}
}

let indexCaseDoree = -1; // -1 = pas de carte dorée dans cette partie
let carteDoreeEnJeu = false; // présente et pas encore retournée

let paquetDuel = [];
let duelEnCours = false;
let duelMultiplicateur = 1;

let indexJoueur = 0;
let partieLancee = false;
let lancementPartieA = 0;

let indexPigeon = null;
let nomPigeonOriginal = "";
let choixPigeonEnCours = false;

let zeroEnCours = false;
let switchEnCours = false;
let sensHoraire = true;

let couleurChoisie = null;
let carteTroisPourTransfertPigeon = "";
let joueurTroisPourTransfertPigeon = null; // celui qui a tiré ce 3 (pour la gorgée couleur)
let couleurTroisPourTransfertPigeon = null; // couleur à boire pour ce 3 (ou null)
// Couleurs des cartes (affichage de la couleur choisie : bannière « Tour de » + bloc Règles)
const COULEURS_JEU = { rouge: "#e53935", bleu: "#1e88e5", vert: "#43a047", jaune: "#fdd835" };
const ADJECTIFS_COULEUR = { rouge: "rouge", bleu: "bleue", vert: "verte", jaune: "jaune" }; // (« une carte verte »)

// Affiche la couleur choisie TANT QU'ELLE EST ACTIVE (jusqu'à ce qu'une carte de cette couleur tombe) :
// bannière « Tour de » teintée + petit rond + nom de la couleur, et nom dans le bloc Règles
function majAffichageCouleur(){
  const hex = couleurChoisie ? (COULEURS_JEU[couleurChoisie] || "#FFD700") : null;
  const nomCouleur = couleurChoisie ? couleurChoisie.toUpperCase() : "";

  // Bloc Règles : petit encadré de la couleur, avec ce qu'elle fait (avant : juste « VERT », on ne
  // comprenait la règle qu'au moment où quelqu'un buvait). Compact : les autres règles restent dessous.
  messageTexte.classList.toggle("avec-couleur", !!hex);
  messageTexte.textContent = "";
  if(hex){
    const encadre = document.createElement("div");
    encadre.className = "couleurActive";
    encadre.style.setProperty("--c", hex);
    const carre = document.createElement("span");
    carre.className = "couleurActive-carre";
    const texte = document.createElement("span");
    texte.className = "couleurActive-texte";
    const nom = document.createElement("b");
    nom.textContent = nomCouleur;
    texte.append(nom, ` : 1 gorgée en plus pour le prochain qui tire une carte ${ADJECTIFS_COULEUR[couleurChoisie] || couleurChoisie}`);
    encadre.append(carre, texte);
    messageTexte.appendChild(encadre);
  }

  if(!stickyJoueurActif) return;
  // Bannière : bleu plus foncé, pour ne pas le confondre avec le turquoise du pigeon
  // (texte du nom plus clair, pour rester lisible sur le fond sombre)
  const hexBanniere = couleurChoisie === "bleu" ? "#1d4ed8" : hex;
  const hexTexte = couleurChoisie === "bleu" ? "#9db9ff" : hex;
  stickyJoueurActif.classList.toggle("has-couleur", !!hex);
  if(hex){
    stickyJoueurActif.style.setProperty("--couleur-jeu", hexBanniere);
    stickyJoueurActif.style.setProperty("--couleur-jeu-texte", hexTexte);
  } else {
    stickyJoueurActif.style.removeProperty("--couleur-jeu");
    stickyJoueurActif.style.removeProperty("--couleur-jeu-texte");
  }

  const pastille = stickyJoueurActif.querySelector(".sticky-couleur");
  if(pastille) pastille.innerText = nomCouleur;
}

let phase = 1;       // 1 = choix J1, 2 = choix J2
let choixJ1 = null;  // 1 ou 2 (carte de gauche/droite)
let scrollLockCount = 0;
let scrollYBeforeLock = 0;
let finUnOverlayAffiche = false;

// ===== Règle de fin: pari sur la dernière carte =====
let predictionEnCours = false;
let predictions = null; // Array<{ joueurIndex:number, typeId:string|null }>

// Hasard utilisé pour mélanger : Math.random en classique, générateur à graine commune en ligne
let aleatoire = Math.random;
// Incrémenté à chaque relance : les callbacks d'overlays de l'ancienne partie sont ignorés
let generationPartie = 0;

let dernierTap = 0;
let dernierTouchCount = 0;

document.addEventListener("touchstart", (e) => {
  dernierTouchCount = e.touches.length;
}, { passive: true });

document.addEventListener("touchend", (e) => {
  if (dernierTouchCount > 1) return; // laisse le pinch zoom tranquille

  const maintenant = Date.now();
  const ecart = maintenant - dernierTap;

  // Deux taps rapprochés : on bloque le zoom, sauf sur ce qui se touche (champs, boutons, cartes...).
  // Ces éléments sont déjà protégés du zoom par le CSS (touch-action: manipulation) ; les bloquer ici
  // annulait leur clic (ex. une carte touchée juste après avoir fermé un overlay ne se retournait pas)
  const TOUCHABLES = "input, textarea, select, label, button, .Carte, .fin-choix-card, .carre-couleur, .supp-item";
  if (ecart > 0 && ecart < 300) {
    if (!e.target.closest(TOUCHABLES)) {
      e.preventDefault();
    }
  }

  dernierTap = maintenant;
}, { passive: false });

/* ===== OUTILS ===== */
// Décidé AU TIRAGE (même résultat sur tous les téléphones en ligne) : si la carte est de la
// couleur choisie, renvoie cette couleur et l'efface (elle ne compte qu'une fois). Sinon null.
// Pas pour le +4 ni la carte couleur.
function prendreCouleurSiBesoin(carteTiree){
  if(!couleurChoisie) return null;
  if(carteTiree.startsWith("plus_4") || carteTiree.startsWith("couleur")) return null;

  const colCarte = couleurDeLaCarte(carteTiree);
  if(!(colCarte && colCarte === couleurChoisie)) return null;

  couleurChoisie = null;
  majAffichageCouleur();
  return colCarte;
}

// Affiche la gorgée pour la couleur (options.couleur = résultat de prendreCouleurSiBesoin)
function appliquerBonusCouleurSiBesoin(carteTiree, options = {}){
  const couleur = options.couleur;
  if(!couleur) return false;

  const preserveRuleMessage = !!options.preserveRuleMessage;
  // C'est toujours celui qui a tiré la carte qui boit pour la couleur : on le nomme
  // (sinon, après « Le PIGEON boit 1 gorgée », on croyait que c'était le pigeon)
  const nom = joueurs[options.joueur];
  const msgCouleur = (nom ? `${nom} boit` : "Et boit") + " 1 gorgée pour la couleur (" + couleur + ")";
  noterGorgees(nom, 1);

  const afficher = () => {
    if(!preserveRuleMessage){
      regleZero.innerText = msgCouleur;
      regleZero.style.display = "block";
      zeroEnCours = true;
    }
    montrerOverlayRegle(msgCouleur, carteTiree);
  };

  if(options.afterRuleOverlay){
    executerApresOverlayRegleUnique(afficher);
  } else {
    afficher();
  }

  return true;
}

function lockScroll(){
  scrollLockCount++;
  if(scrollLockCount > 1) return;

  document.body.classList.add("overlay-open");
  // Fond de la page en noir le temps de l'overlay : couvre la bande réservée à la barre de défilement (PC)
  document.documentElement.classList.add("overlay-ouvert");

  // Sauve la position pour iOS
  scrollYBeforeLock = window.scrollY || document.documentElement.scrollTop || 0;
  // La place de la barre de défilement est déjà réservée en permanence (scrollbar-gutter: stable
  // sur html) : la compenser en plus décalait tout le contenu sur PC à chaque overlay.
  // On ne compense que sur les navigateurs qui ne gèrent pas scrollbar-gutter.
  const gutterStable = !!(window.CSS && CSS.supports && CSS.supports("scrollbar-gutter", "stable"));
  const sbw = gutterStable ? 0 : window.innerWidth - document.documentElement.clientWidth;
  document.documentElement.style.setProperty("--sbw", (sbw > 0 ? sbw : 0) + "px");

  document.body.classList.add("no-scroll");
  document.body.style.top = `-${scrollYBeforeLock}px`;
}

function unlockScroll(){
  if(scrollLockCount <= 0) return;
  scrollLockCount--;
  if(scrollLockCount > 0) return;

  document.body.classList.remove("overlay-open");
  document.documentElement.classList.remove("overlay-ouvert");
  document.body.classList.remove("no-scroll");
  document.documentElement.style.removeProperty("--sbw");
  const top = document.body.style.top;
  document.body.style.top = "";

  const y = top ? Math.abs(parseInt(top, 10)) : scrollYBeforeLock;
  window.scrollTo(0, y);
}

// ===== Voile noir pendant les enchaînements d'overlays =====
// Quand un overlay en remplace un autre (règle puis annulation, +4 validé puis « X boit »...),
// le plateau réapparaissait une fraction de seconde entre les deux puis le noir revenait d'un coup :
// effet de flash agressif. Ce voile reste noir tant qu'un overlay est affiché (ou qu'un autre
// arrive juste après) et ne s'efface en fondu qu'à la fin de l'enchaînement.
const voileOverlays = document.createElement("div");
voileOverlays.id = "voileOverlays"; // (pas « overlay... » : nettoyerOverlays() ne doit pas le supprimer)
document.body.appendChild(voileOverlays);
let minuteurVoile = null;
let apresTousOverlays = []; // fonctions à lancer une fois le plateau de nouveau visible

function overlayOuvert(){
  return [...document.body.children].some(el => el.id.startsWith("overlay"));
}

function majVoileOverlays(){
  clearTimeout(minuteurVoile);
  if(overlayOuvert()){
    voileOverlays.classList.add("visible");
    return;
  }
  // Petit délai : laisse au prochain overlay de l'enchaînement le temps d'arriver
  minuteurVoile = setTimeout(() => {
    voileOverlays.classList.remove("visible");
    // Le plateau réapparaît en fondu : on attend qu'il soit bien visible
    const file = apresTousOverlays;
    apresTousOverlays = [];
    if(file.length) setTimeout(() => file.forEach(f => f()), delai(120));
  }, delai(90));
}

// Lance callback quand plus aucun overlay n'est affiché (tout de suite s'il n'y en a pas)
function quandPlateauVisible(callback){
  if(!overlayOuvert() && !voileOverlays.classList.contains("visible")) callback();
  else apresTousOverlays.push(callback);
}
new MutationObserver(majVoileOverlays).observe(document.body, { childList: true });

function centrerDerniereLigne(){
  const cards = Array.from(plateau.querySelectorAll(".Carte"));
  const total = cards.length;
  const cols = getCols();

  // reset (important sur resize)
  cards.forEach(c => c.style.gridColumnStart = "");

  const reste = total % cols;
  if(reste === 0) return;

  const start = Math.floor((cols - reste) / 2) + 1;
  const first = total - reste;

  // ⚠️ on décale TOUTES les cartes de la dernière ligne
  for(let i = 0; i < reste; i++){
    cards[first + i].style.gridColumnStart = String(start + i);
  }
}


function getCols(){
  const cols = getComputedStyle(document.documentElement)
    .getPropertyValue("--cols")
    .trim();
  return parseInt(cols, 10) || 8;
}

// ===== Helpers: type de carte (pour la règle de fin) =====
function typeFromCardClass(carte){
  if(!carte) return "autre";
  if(carte.startsWith("zero")) return "zero";
  if(carte.startsWith("un_")) return "un";
  if(carte.startsWith("trois")) return "trois";
  if(carte.startsWith("quatre")) return "quatre";
  if(carte.startsWith("interdit")) return "interdit";
  if(carte.startsWith("couleur")) return "couleur";
  if(carte.startsWith("plus_2")) return "plus2";
  if(carte.startsWith("plus_4")) return "plus4";
  if(carte.startsWith("switch")) return "switch";
  return "autre";
}

const TYPES_PARIS = [
  { id: "zero",   label: "0",        rep: "zero_vert" },
  { id: "un",     label: "1",        rep: "un_vert" },
  { id: "trois",  label: "3",        rep: "trois_vert" },
  { id: "quatre", label: "4",        rep: "quatre_vert" },
  { id: "interdit", label: "Interdit", rep: "interdit_vert" },
  { id: "couleur", label: "Couleur", rep: "couleur" },
  { id: "plus2",  label: "+2",       rep: "plus_2_vert" },
  { id: "plus4",  label: "+4",       rep: "plus_4" },
  { id: "switch", label: "Switch",  rep: "switch_vert" },
];

// ===== Helpers UI: centrage de la dernière ligne (grilles) =====
function getFinCols(gridEl){
  if(!gridEl) return 3;
  const v = getComputedStyle(gridEl).getPropertyValue('--fin-cols').trim();
  return parseInt(v, 10) || 3;
}

function centrerDerniereLigneGrid(gridEl){
  if(!gridEl) return;
  const items = Array.from(gridEl.children);
  const total = items.length;
  const cols = getFinCols(gridEl);

  items.forEach(el => el.style.gridColumnStart = "");
  const reste = total % cols;
  if(reste === 0) return;

  const start = Math.floor((cols - reste) / 2) + 1;
  const first = total - reste;
  for(let i=0;i<reste;i++){
    items[first + i].style.gridColumnStart = String(start + i);
  }
}

function nomType(typeId){
  const t = TYPES_PARIS.find(x => x.id === typeId);
  return t ? t.label : typeId;
}

function nextPlayerIndex(fromIdx){
  if(joueurs.length === 0) return 0;
  const n = joueurs.length;
  // Joueur en pause (toilettes, clope…) : son tour est sauté
  let i = fromIdx;
  for(let k = 0; k < n; k++){
    i = (i + (sensHoraire ? 1 : -1) + n) % n;
    if(!estEnPause(joueurs[i])) return i;
  }
  return (fromIdx + (sensHoraire ? 1 : -1) + n) % n;
}

// ===== Joueurs en pause (aux toilettes, en pause clope…) =====
// Bouton ⏸ à droite de chaque nom (bloc Joueurs) : son tour est sauté et on ne peut plus le choisir
// (pigeon, duel, +4, carte dorée, sociale, 0, pari de fin) jusqu'à son retour (▶). Action de jeu comme
// une autre (« pause:NOM ») : en ligne, appliquée pareil sur tous les téléphones ; en classique, gardée
// pour la reprise après un plantage. Il reste toujours au moins 2 joueurs pas en pause.
let joueursEnPause = new Set();
function estEnPause(nom){ return joueursEnPause.has(nom); }
function indexJoueursActifs(){ return joueurs.map((_, i) => i).filter(i => !estEnPause(joueurs[i])); }

function basculerPauseJoueur(nom){
  if(!joueurs.includes(nom)) return;
  const discret = rattrapageEnCours; // (rejeu accéléré : pas de notif)
  if(estEnPause(nom)){
    joueursEnPause.delete(nom);
    if(!discret) afficherNotificationHaut("", `${nom} est de retour !`, true);
  } else {
    if(indexJoueursActifs().length <= 2) return;
    joueursEnPause.add(nom);
    const courant = indexJoueur % joueurs.length;
    if(joueurs[courant] === nom){
      indexJoueur = nextPlayerIndex(courant); // c'était son tour : au suivant
      if(!discret) afficherNotificationHaut("", `${nom} est en pause : au tour de ${joueurs[indexJoueur]}`, true);
    } else if(!discret){
      afficherNotificationHaut("", `${nom} est en pause`, true);
    }
  }
  afficherJoueurs();
  afficherJoueurActif();
}

// Volet du bas (pause d'un joueur, règle d'une carte) : le doigt (ou la molette) sur le volet ou le fond
// assombri ne fait pas défiler la partie derrière ; glisser vers le bas (n'importe où) descend la feuille,
// qui se ferme si on la lâche assez bas ou d'un coup sec, sinon elle remonte
function rendreVoletGlissable(volet){
  const feuille = volet.querySelector(".voletPause-feuille");
  let depart = null, decalage = 0, aGlisse = false, vitesse = 0, dernier = null;
  const placer = (y, duree) => {
    feuille.style.transition = volet.style.transition = duree ? `transform ${duree}s ease, background-color ${duree}s ease` : "none";
    feuille.style.transform = `translateY(${y}px)`;
    volet.style.backgroundColor = `rgba(0, 0, 0, ${(0.55 * (1 - Math.min(1, y / feuille.offsetHeight))).toFixed(3)})`;
  };
  volet.addEventListener("touchstart", (e) => {
    if(e.touches.length !== 1) return;
    depart = { y: e.touches[0].clientY, moment: Date.now() };
    dernier = depart;
    decalage = 0;
    vitesse = 0;
    aGlisse = false;
    feuille.style.animation = "none"; // (l'animation d'arrivée garderait la main sur la position)
  }, { passive: true });
  volet.addEventListener("touchmove", (e) => {
    if(e.cancelable) e.preventDefault();
    if(!depart) return;
    decalage = Math.max(0, e.touches[0].clientY - depart.y);
    const maintenant = { y: e.touches[0].clientY, moment: Date.now() };
    vitesse = (maintenant.y - dernier.y) / Math.max(1, maintenant.moment - dernier.moment); // px par ms, au dernier mouvement
    dernier = maintenant;
    if(decalage > 8) aGlisse = true;
    placer(decalage, 0);
  }, { passive: false });
  const lacher = () => {
    if(!depart) return;
    depart = null;
    if(decalage > feuille.offsetHeight * 0.3 || (decalage > 30 && vitesse > 0.5)){
      placer(feuille.offsetHeight, 0.2);
      setTimeout(() => { if(volet.isConnected) volet.remove(); }, 200);
    } else if(decalage > 0){
      placer(0, 0.2);
    }
  };
  volet.addEventListener("touchend", lacher);
  volet.addEventListener("touchcancel", lacher);
  volet.addEventListener("wheel", (e) => { if(e.cancelable) e.preventDefault(); }, { passive: false });
  // Doigt levé après un glissement : pas de clic sur le bouton ou le fond en dessous
  volet.addEventListener("click", (e) => {
    if(aGlisse){ e.stopImmediatePropagation(); e.preventDefault(); aGlisse = false; }
  }, true);
}

// Volet « Léa » (au tap sur ⏸ / ▶) : confirmation, puis l'action de jeu (évènement « alcuno-pause »)
function ouvrirVoletPause(nom, bouton){
  fermerVoletPause();
  const enPause = estEnPause(nom);
  if(!enPause && indexJoueursActifs().length <= 2){
    afficherNotificationHaut("", "Il faut au moins 2 joueurs qui ne sont pas en pause", true);
    return;
  }
  const volet = document.createElement("div");
  volet.id = "voletPause";
  volet.innerHTML = `<div class="voletPause-feuille" role="dialog">
      <div class="voletPause-poignee"></div>
      <div class="voletPause-nom"></div>
      <div class="voletPause-texte"></div>
      <button type="button" class="voletPause-ok"></button>
      <button type="button" class="voletPause-annuler">Annuler</button>
    </div>`;
  volet.querySelector(".voletPause-nom").textContent = avecCouronne(nom);
  volet.querySelector(".voletPause-texte").innerHTML = enPause
    ? "De retour parmi nous ?"
    : "En pause clope ? Aux toilettes en train de vomir ?<br>Son tour sera sauté jusqu'à ce qu'il revienne.";
  volet.querySelector(".voletPause-ok").textContent = enPause ? `${nom} est de retour` : `Mettre ${nom} en pause`;
  rendreVoletGlissable(volet);
  volet.addEventListener("click", (e) => { if(e.target === volet) fermerVoletPause(); });
  volet.querySelector(".voletPause-annuler").addEventListener("click", fermerVoletPause);
  volet.querySelector(".voletPause-ok").addEventListener("click", () => {
    fermerVoletPause();
    if(bouton.isConnected) bouton.dispatchEvent(new Event("alcuno-pause"));
  });
  document.body.appendChild(volet);
}
function fermerVoletPause(){
  const volet = document.getElementById("voletPause");
  if(volet) volet.remove();
}

// ===== Revoir la règle d'une carte : doigt appuyé 0,5 s sur une carte retournée du plateau =====
// Volet du bas (comme la pause) avec la carte en grand et sa règle (celle de l'écran des Règles).
// Rien d'envoyé aux autres téléphones. Faces cachées : rien sur une carte recachée (sinon on pourrait
// recompter les cartes sorties avec).
const DUREE_APPUI_LONG = 500;

// "plus_2_jaune1" => "plus_2", "couleur2" => "couleur", "un_rouge" => "un"
function typeDeCarte(classe){
  if(classe.startsWith("plus_2")) return "plus_2";
  if(classe.startsWith("plus_4")) return "plus_4";
  return classe.split("_")[0].replace(/\d+$/, "");
}

function regleDeCarte(classe){
  if(classe === "carte_doree"){
    return { nom: "Carte dorée", texte: estModeSoft()
      ? "Distribue 3 gorgées de la part du développeur 😘"
      : "Distribue un CUL SEC de la part du développeur, et obligation de se servir un vrai verre avant 😘" };
  }
  const cartes = reglesDuJeu().find(partie => partie.titre === "Les cartes").regles;
  return cartes.find(r => typeDeCarte(r.carte) === typeDeCarte(classe)) || null;
}

// Classe de la face d'une carte du plateau (« trois_vert », « carte_doree »…), ou null
function faceDeCarte(carte){
  return [...carte.classList].find(c => c === "carte_doree" || classes.includes(c)) || null;
}

function ouvrirVoletCarte(classe){
  const regle = regleDeCarte(classe);
  if(!regle) return;
  fermerVoletCarte();
  const volet = document.createElement("div");
  volet.id = "voletCarte";
  volet.innerHTML = `<div class="voletPause-feuille" role="dialog">
      <div class="voletPause-poignee"></div>
      <div class="voletCarte-contenu">
        <div class="Carte retournee voletCarte-carte"></div>
        <div>
          <div class="voletPause-nom"></div>
          <div class="voletPause-texte"></div>
        </div>
      </div>
    </div>`;
  volet.querySelector(".voletCarte-carte").classList.add(classe);
  volet.querySelector(".voletPause-nom").textContent = regle.nom;
  volet.querySelector(".voletPause-texte").textContent = regle.texte;
  volet.querySelector(".voletPause-feuille").setAttribute("aria-label", regle.nom);
  rendreVoletGlissable(volet);
  volet.addEventListener("click", (e) => { if(e.target === volet) fermerVoletCarte(); });
  document.body.appendChild(volet);
}
function fermerVoletCarte(){
  const volet = document.getElementById("voletCarte");
  if(volet) volet.remove();
}

let appuiCarte = null; // { carte, x, y, minuteur, minuteurVisuel }
// Le clic qui suit l'appui long (doigt levé) ne compte pas : il tomberait sur le fond du volet, qui se
// refermerait aussitôt
let appuiLongFait = false;

function annulerAppuiCarte(){
  if(!appuiCarte) return;
  clearTimeout(appuiCarte.minuteur);
  clearTimeout(appuiCarte.minuteurVisuel);
  appuiCarte.carte.classList.remove("carte-appuyee");
  appuiCarte = null;
}

// Carte retournée sous le doigt (elles ignorent le doigt, pour ne pas être rejouées : on la cherche par
// sa position)
function carteRetourneeSous(x, y){
  return [...plateau.querySelectorAll(".Carte.retournee")].find((carte) => {
    const r = carte.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }) || null;
}

plateau.addEventListener("pointerdown", (e) => {
  annulerAppuiCarte();
  const carte = carteRetourneeSous(e.clientX, e.clientY);
  if(!carte || carte.classList.contains("carte-disparue")) return;
  if(document.documentElement.classList.contains("faces-fermees") && carte.classList.contains("recachee")) return;
  const classe = faceDeCarte(carte);
  if(!classe) return;
  appuiCarte = { carte, x: e.clientX, y: e.clientY };
  // (un peu après : un doigt qui fait juste défiler le plateau ne fait pas briller la carte)
  appuiCarte.minuteurVisuel = setTimeout(() => carte.classList.add("carte-appuyee"), 120);
  appuiCarte.minuteur = setTimeout(() => {
    annulerAppuiCarte();
    appuiLongFait = true;
    try { window.getSelection().removeAllRanges(); } catch (err) {}
    vibrer(20);
    ouvrirVoletCarte(classe);
  }, DUREE_APPUI_LONG);
});
plateau.addEventListener("pointermove", (e) => {
  if(appuiCarte && Math.hypot(e.clientX - appuiCarte.x, e.clientY - appuiCarte.y) > 10) annulerAppuiCarte();
});
["pointerup", "pointercancel", "pointerleave"].forEach((type) => plateau.addEventListener(type, annulerAppuiCarte));
window.addEventListener("scroll", annulerAppuiCarte, { passive: true });
document.addEventListener("pointerup", () => {
  if(appuiLongFait) setTimeout(() => { appuiLongFait = false; }, 400); // (au cas où aucun clic ne suit)
}, true);
document.addEventListener("click", (e) => {
  if(appuiLongFait){ e.stopImmediatePropagation(); e.preventDefault(); appuiLongFait = false; }
}, true);
plateau.addEventListener("contextmenu", (e) => { if(carteRetourneeSous(e.clientX, e.clientY)) e.preventDefault(); });
// iPhone : pendant l'appui, pas de sélection de texte (il en sélectionnait autour de la carte)
document.addEventListener("selectstart", (e) => { if(appuiCarte || appuiLongFait) e.preventDefault(); });

const ICONE_PAUSE_JOUEUR = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>';
const ICONE_RETOUR_JOUEUR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

function creerCartePreview(className){
  const wrap = document.createElement("div");
  wrap.className = "Carte retournee " + className;
  return wrap;
}

// Cartes encore cachées sur le plateau (carte dorée comprise)
function cartesRestantes(){
  return paquet.length + (carteDoreeEnJeu ? 1 : 0);
}

function lancerOverlayPrediction(startIndex){
  if(predictionEnCours) return;
  if(joueurs.length < 2) return;
  if(cartesRestantes() !== 1) return; // on doit être à l'avant-dernière carte tirée

  // La dernière carte cachée est la carte dorée : personne ne l'a trouvée
  const derniereEstDoree = carteDoreeEnJeu && paquet.length === 0;

  predictionEnCours = true;
  predictions = joueurs.map((_, idx) => ({ joueurIndex: idx, typeId: null }));

  // Nettoie un overlay règle s'il traîne (sécurité)
  const overlayRegle = document.getElementById("overlayRegleUnique");
  if(overlayRegle) overlayRegle.remove();

  lockScroll();

  const overlay = document.createElement("div");
  overlay.id = "overlayPredictionFin";
  overlay.className = "overlay-opaque";

  const panel = document.createElement("div");
  panel.className = "overlay-panel";

  const header = document.createElement("div");
  header.className = "prediction-header";

  const titre = document.createElement("div");
  titre.className = "titre-pigeon prediction-title";
  titre.innerText = "Pari sur la dernière carte";

  const subtitle = document.createElement("div");
  subtitle.className = "overlay-subtitle prediction-subtitle";
  subtitle.innerText = `Chacun choisit un type de carte. Tous ceux qui trouvent distribuent ${texteCulSec()} !`;

  header.appendChild(titre);
  header.appendChild(subtitle);

  const turn = document.createElement("div");
  turn.className = "fin-choix-turn";

  const recap = document.createElement("div");
  recap.className = "fin-choix-recap";

  const grid = document.createElement("div");
  grid.className = "fin-choix-grid";

  // Crée les cartes de choix (face découverte)
  TYPES_PARIS.forEach(t => {
    const cardWrap = document.createElement("div");
    cardWrap.className = "fin-choix-card";
    cardWrap.dataset.typeId = t.id;

    const preview = creerCartePreview(t.rep);
    cardWrap.appendChild(preview);

    surAction(cardWrap, "pred:" + t.id, {
      owner: () => curPos < ordre.length ? joueurs[ordre[curPos]] : null,
      pret: () => !cardWrap.classList.contains("disabled"),
      valide: () => curPos < ordre.length // tout le monde a déjà choisi (en attente de « Valider »)
    }, () => {
      if(cardWrap.classList.contains("disabled")) return;
      const typeId = cardWrap.dataset.typeId;
      const cur = ordre[curPos];
      predictions[cur].typeId = typeId;
      curPos++;
      rafraichirUI();
    });

    grid.appendChild(cardWrap);
  });

  // Ordre de jeu pour la sélection
  const ordre = [];
  for(let k = 0; k < joueurs.length; k++){
    const idx = (startIndex + (sensHoraire ? k : -k) + joueurs.length) % joueurs.length;
    if(!estEnPause(joueurs[idx])) ordre.push(idx); // (joueur en pause : ne parie pas)
  }
  let curPos = 0;
  let revele = false; // la dernière carte n'est révélée qu'avec « Valider » (on peut encore revenir en arrière)

  // « Valider » (quand tout le monde a choisi : révèle la carte) et « Retour » (annule le dernier choix, s'il s'est planté).
  // Place toujours gardée sous le récap : les cartes ne bougent pas quand les boutons apparaissent.
  const actionsPari = document.createElement("div");
  actionsPari.className = "fin-choix-actions";

  const btnReveler = document.createElement("button");
  btnReveler.type = "button";
  btnReveler.className = "bouton-pigeon fin-choix-reveler";
  btnReveler.innerText = "Valider";
  surAction(btnReveler, "pred:reveler", {
    once: true,
    unique: true,
    valide: () => curPos >= ordre.length && !revele
  }, () => {
    revele = true;
    rafraichirUI();
  });

  const btnRetourPari = document.createElement("button");
  btnRetourPari.type = "button";
  btnRetourPari.className = "bouton-pigeon fin-choix-retour";
  btnRetourPari.innerText = "Retour";
  surAction(btnRetourPari, "pred:retour", {
    owner: () => curPos > 0 ? joueurs[ordre[curPos - 1]] : null, // celui qui vient de choisir
    valide: () => curPos > 0 && !revele
  }, () => {
    curPos--;
    predictions[ordre[curPos]].typeId = null;
    rafraichirUI();
  });
  actionsPari.append(btnReveler, btnRetourPari);

  function majBoutonsPari(){
    const peutReveler = curPos >= ordre.length && !revele;
    const peutRevenir = curPos > 0 && !revele;
    btnReveler.disabled = !peutReveler;
    btnReveler.classList.toggle("cache", !peutReveler);
    btnRetourPari.disabled = !peutRevenir;
    btnRetourPari.classList.toggle("cache", !peutRevenir);
  }

  function rafraichirUI(){
    // recap : le choix de chacun, en gros avec une mini-carte (avant : petit texte à droite, illisible)
    recap.innerHTML = "";
    ordre.forEach((jIdx, i) => {
      const p = predictions[jIdx];
      const ligne = document.createElement("div");
      ligne.className = "ligne" + (i === curPos && !revele ? " en-cours" : "");
      const who = document.createElement("strong");
      who.innerText = joueurs[jIdx] + (i === curPos && !revele ? " ←" : "");
      const what = document.createElement("span");
      what.className = "choix";
      const type = p.typeId ? TYPES_PARIS.find(t => t.id === p.typeId) : null;
      if(type){
        const mini = creerCartePreview(type.rep);
        mini.classList.add("fin-choix-mini");
        what.append(mini, document.createTextNode(type.label));
      } else {
        what.innerText = "—";
      }
      ligne.appendChild(who);
      ligne.appendChild(what);
      recap.appendChild(ligne);
    });

    majBoutonsPari();

    if(curPos < ordre.length){
      const jIdx = ordre[curPos];
      turn.innerText = `Au tour de ${joueurs[jIdx]} : choisis un type`;
      Array.from(grid.querySelectorAll('.fin-choix-card')).forEach(el => el.classList.remove('disabled'));
    } else if(!revele){
      turn.innerText = "Tout le monde a choisi !";
      Array.from(grid.querySelectorAll('.fin-choix-card')).forEach(el => el.classList.add('disabled'));
    } else {
      actionsPari.remove();
      // Révélation
      const lastCard = derniereEstDoree ? "carte_doree" : paquet[0];
      const vraiType = typeFromCardClass(lastCard);
      const gagnants = derniereEstDoree ? [] : ordre
        .map(jIdx => predictions[jIdx])
        .filter(p => p.typeId === vraiType)
        .map(p => joueurs[p.joueurIndex]);

      turn.innerText = "Révélation de la dernière carte";
      header.style.display = 'none';
      panel.classList.add('prediction-reveal-mode');

      // Désactive les cartes
      Array.from(grid.querySelectorAll('.fin-choix-card')).forEach(el => el.classList.add('disabled'));

      const reveal = document.createElement('div');
      reveal.className = 'fin-choix-reveal';

      const prev = creerCartePreview(
        derniereEstDoree ? "carte_doree" : (TYPES_PARIS.find(t=>t.id===vraiType)?.rep || lastCard)
      );
      reveal.appendChild(prev);

      const txt = document.createElement('div');
      txt.className = 'fin-choix-resultat';

      if(derniereEstDoree){
        // La dernière carte était la carte dorée : le pari est perdu pour tout le monde
        prev.classList.add("doree-carte-vedette");
        reveal.classList.add("reveal-doree");
        txt.innerHTML =
          '<div class="doree-titre"><span class="doree-etincelle">✦</span> PERSONNE N\'A TROUVÉ LA CARTE DORÉE !! <span class="doree-etincelle">✦</span></div>' +
          '<div class="doree-texte">' + texteDoreeJamaisTrouvee() + '</div>';
      } else if(gagnants.length === 0){
        txt.innerText = `Personne n'a trouvé \nLa dernière carte était ${nomType(vraiType)}`;
      } else if(gagnants.length === 1){
        txt.innerText = `${gagnants[0]} a trouvé ! Il/elle distribue ${texteCulSec()} !`;
      } else {
        txt.innerText = `${gagnants.join(', ')} ont trouvé ! Chacun distribue ${texteCulSec()} !`;
      }
      reveal.appendChild(txt);

      const btn = document.createElement('button');
      btn.className = 'bouton-pigeon';
      btn.innerText = 'Terminer';
      surAction(btn, "pred:terminer", { once: true, unique: true }, () => {
        if(overlay._cleanup) overlay._cleanup();
        overlay.remove();
        unlockScroll();
        predictionEnCours = false;

        // On considère la dernière carte comme "résolue" par le pari (sa règle ne s'applique pas) :
        // on la retire et on enchaîne directement sur l'écran de fin.
        if(derniereEstDoree){
          // Le cul sec collectif vient d'être annoncé : on retourne la carte dorée sur le plateau
          carteDoreeEnJeu = false;
          const caseDoree = plateau.children[indexCaseDoree];
          if(caseDoree){
            caseDoree.classList.remove("dos_dore");
            caseDoree.classList.add("carte_doree", "retournee");
          }
        } else if(paquet.length === 1){
          paquet.pop();
        }
        // Affiche systématiquement l'écran de fin (même si 0 "1 restant")
        finDePartie();
      });
      reveal.appendChild(btn);

      // remplace la grille par la révélation (garde recap au dessus)
      grid.replaceWith(reveal);
    }
  }

  panel.appendChild(header);
  panel.appendChild(turn);
  panel.appendChild(recap);
  panel.appendChild(actionsPari);
  panel.appendChild(grid);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Centre la dernière ligne (surtout utile quand la grille est en 3 colonnes sur mobile)
  const onResize = () => centrerDerniereLigneGrid(grid);
  window.addEventListener('resize', onResize);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', onResize);
  }

  // Quand on quitte l'overlay, on nettoie le listener
  overlay._cleanup = () => {
    window.removeEventListener('resize', onResize);
    if(window.visualViewport){
      window.visualViewport.removeEventListener('resize', onResize);
    }
  };

  centrerDerniereLigneGrid(grid);

  rafraichirUI();
}


function melangerPaquet(array){
  for(let i=array.length-1;i>0;i--){
    const j=Math.floor(aleatoire()*(i+1));
    [array[i],array[j]]=[array[j],array[i]];
  }
}

function resetPaquetDuelSiBesoin(){
  if(paquetDuel.length === 0){
    paquetDuel = [...duelCartes];
    melangerPaquet(paquetDuel);
  }
}

function valeurCarteDuel(c){
  if(c.startsWith("deux")) return 2;
  if(c.startsWith("cinq")) return 5;
  if(c.startsWith("six")) return 6;
  if(c.startsWith("sept")) return 7;
  if(c.startsWith("huit")) return 8;
  if(c.startsWith("neuf")) return 9;
  return 0;
}


// Bannière « Tour de » : sous la barre d'infos, puis collée en haut de l'écran.
// Avant, elle était toujours « fixe » et sa position recalculée à chaque évènement de défilement :
// elle suivait la page avec un temps de retard (saccades). Maintenant :
//  - tant que la barre d'infos est à l'écran, elle est posée dans la page (position absolue) et
//    c'est le navigateur qui la fait défiler avec le reste, sans calcul ;
//  - une fois arrivée en haut, elle passe en position fixe (CSS) et plus rien ne bouge.
// Les styles ne sont réécrits que quand ils changent vraiment.
let modeSticky = "";
let topStickyPage = null;
let hautMinSticky = null; // haut de l'écran + encoche (calculé une fois, refait au redimensionnement)

function mesurerHautMinSticky(){
  const sonde = document.createElement("div");
  sonde.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;top:calc(env(safe-area-inset-top, 0px) + " +
    (window.innerWidth <= 520 ? 8 : 10) + "px)";
  document.body.appendChild(sonde);
  const haut = sonde.getBoundingClientRect().top;
  sonde.remove();
  return haut;
}

function repositionnerStickyJoueurActif(){
  if(!stickyJoueurActif || !messagesBar) return;
  if(hautMinSticky === null) hautMinSticky = mesurerHautMinSticky();

  const rect = messagesBar.getBoundingClientRect();
  const gap = window.innerWidth <= 520 ? 8 : 10;
  const ancre = Math.round(rect.bottom + gap); // position voulue, en haut de l'écran

  if(rect.height > 0 && ancre > hautMinSticky){
    // Position dans la page (pendant un overlay, la page est décalée sur body : même calcul)
    const origine = document.body.classList.contains("no-scroll")
      ? document.body.getBoundingClientRect().top
      : document.documentElement.getBoundingClientRect().top;
    const top = Math.round(ancre - origine);
    if(modeSticky !== "page" || top !== topStickyPage){
      modeSticky = "page";
      topStickyPage = top;
      stickyJoueurActif.classList.add("dans-la-page");
      stickyJoueurActif.style.top = top + "px";
    }
  } else if(modeSticky !== "colle"){
    modeSticky = "colle";
    topStickyPage = null;
    stickyJoueurActif.classList.remove("dans-la-page");
    stickyJoueurActif.style.top = "";
  }
}

function creerUIJoueurActifSticky(){
  if(document.getElementById("stickyJoueurActif")) return;

  stickyJoueurActif = document.createElement("div");
  stickyJoueurActif.id = "stickyJoueurActif";
  stickyJoueurActif.setAttribute("aria-live", "polite");
  stickyJoueurActif.innerHTML = `
      <span class="sticky-label">Tour de</span>
      <span class="sticky-valeur">
        <span class="sticky-nom">—</span>
        <span class="sticky-bonus"></span>
      </span>
      <span class="sticky-couleur"></span>
    `;

  // ⏸ Pause (mode classique) : au bout de la pastille, toujours à portée pendant la partie
  const btnPause = document.getElementById("btnPause");
  if(btnPause) stickyJoueurActif.appendChild(btnPause);

  document.body.appendChild(stickyJoueurActif);
  repositionnerStickyJoueurActif();
}

// Son « À toi » (sifflet) et bandeau qui clignote : quand le jeu attend depuis 50 s que le joueur joue
// (retourne sa carte, ou fasse son choix : pigeon, duel, +4, annulation, couleur…), puis toutes les 50 s
// tant qu'il ne joue pas. Regarder les règles, faire défiler le plateau, etc. ne compte pas.
//  - classique : le compteur repart de zéro à chaque action du jeu, quand un choix est proposé (voir
//    surAction) et quand le tour passe au joueur suivant ; sur le téléphone de la partie (et sur la télé
//    en mode télé, voir tele.js)
//  - en ligne : seulement sur le téléphone du joueur dont c'est le tour, 50 s après le début de son tour
// Pas pendant le pari de la dernière carte ni à la fin de la partie.
const DELAI_RAPPEL_TOUR = 50 * 1000;
let minuteurRappelTour = null;
let dernierTourRappel = null; // classique : tour pour lequel le compteur est déjà reparti

// tour : en ligne, le tour à jouer (le rappel s'arrête s'il est joué) ; en classique, null
function programmerRappelTour(tour){
  clearTimeout(minuteurRappelTour);
  minuteurRappelTour = setTimeout(() => {
    if(!partieLancee || joueurs.length === 0 || predictionEnCours || finUnOverlayAffiche || pauseEnCours) return;
    // écran « Nouvelle partie » ouvert : pas de sifflet, on réessaie dans 50 s (et à sa fermeture, voir regles.js)
    if(ecranNouvellePartieOuvert()) return programmerRappelTour(tour);
    if(enLigneActif){
      if(`${mancheCourante}:${cartesRestantes()}` !== tour) return; // tour joué entre-temps
      if(joueurs[indexJoueur % joueurs.length] !== pseudoActuel) return; // plus son tour
    } else if(tour !== null) return; // (rappel d'une partie en ligne)
    // (mode télé : un peu plus tard, en même temps que la télé, voir rappelPourTele dans tele.js)
    setTimeout(() => {
      jouerSon("tour");
      faireClignoterBandeauTour(); // même sans le son (sons coupés, musique forte…)
    }, rappelPourTele());
    programmerRappelTour(tour); // et encore dans 50 s s'il ne joue toujours pas
  }, DELAI_RAPPEL_TOUR);
}

// Classique : le compteur du rappel repart de zéro (action du jeu, nouveau choix proposé, ou tour passé
// au joueur suivant)
function relancerRappelClassique(){
  if(!enLigneActif && partieLancee) programmerRappelTour(null);
}

// ===== Pause (mode classique) : ⏸ du bandeau => écran « PAUSE » par-dessus la partie floutée. Pendant la
// pause : pas de rappel « À toi », ni « Bois de l'eau », ni de petites notifs sur la télé (qui affiche
// « PAUSE » aussi), ni de musique d'ambiance.
let pauseEnCours = false;
const btnPause = document.getElementById("btnPause");
const ecranPause = document.getElementById("ecranPause");

function majBoutonPause(){
  btnPause.hidden = !(partieLancee && !enLigneActif);
}

function mettreEnPause(){
  if(!partieLancee || enLigneActif || pauseEnCours) return;
  pauseEnCours = true;
  clearTimeout(minuteurRappelTour);
  ecranPause.style.display = "";
  majMusique(); // (la musique d'ambiance se coupe pendant la pause)
}

function reprendreApresPause(){
  if(!pauseEnCours) return;
  pauseEnCours = false;
  ecranPause.style.display = "none";
  relancerRappelClassique();
  majMusique(); // (et reprend en fondu)
}

btnPause.addEventListener("click", mettreEnPause);
document.getElementById("btnReprendrePause").addEventListener("click", reprendreApresPause);

// Halo lumineux tout autour de l'écran du téléphone, qui pulse 3 fois au rythme du bandeau « À toi »
// (voir haloRappel dans le CSS ; pas sur la télé)
function faireBrillerBordsEcran(){
  let halo = document.getElementById("haloRappel");
  if(!halo){
    halo = document.createElement("div");
    halo.id = "haloRappel";
    halo.setAttribute("aria-hidden", "true");
    document.body.appendChild(halo);
  }
  halo.classList.remove("actif");
  void halo.offsetWidth; // relance l'animation si elle était déjà là
  halo.classList.add("actif");
  halo.addEventListener("animationend", () => halo.classList.remove("actif"), { once: true });
}

// Le bandeau « À toi » clignote 3 fois (voir rappel-tour dans le CSS), avec le halo autour de l'écran
function faireClignoterBandeauTour(){
  faireBrillerBordsEcran();
  if(!stickyJoueurActif) return;
  stickyJoueurActif.classList.remove("rappel-tour");
  void stickyJoueurActif.offsetWidth; // relance l'animation si elle était déjà là
  stickyJoueurActif.classList.add("rappel-tour");
  stickyJoueurActif.addEventListener("animationend", () => stickyJoueurActif.classList.remove("rappel-tour"), { once: true });
}

function majStickyJoueurActif(){
  if(!stickyJoueurActif) return;

  repositionnerStickyJoueurActif();

  const labelEl = stickyJoueurActif.querySelector(".sticky-label");
  const nomEl = stickyJoueurActif.querySelector(".sticky-nom");
  const bonusEl = stickyJoueurActif.querySelector(".sticky-bonus");
  labelEl.innerText = "Tour de";

  if(!partieLancee || joueurs.length === 0 || choixPigeonEnCours || duelEnCours){
    stickyJoueurActif.classList.remove("visible", "is-pigeon", "has-bonus");
    nomEl.innerText = "—";
    bonusEl.innerText = "";
    return;
  }

  const idx = indexJoueur % joueurs.length;
  const nom = joueurs[idx];
  const n = Number(annulations[nom] || 0);
  const estPigeon = idx === indexPigeon;

  nomEl.innerText = estPigeon ? `PIGEON (${avecCouronne(nom)})` : avecCouronne(nom);
  ajouterBadgeDeconnecte(nomEl, !!texteDeconnecte(nom));
  bonusEl.innerText = n > 0 ? `+${n}` : "";
  // Un tour = un nombre de cartes restantes dans la manche
  const tour = `${mancheCourante}:${cartesRestantes()}`;
  if(enLigneActif && nom === pseudoActuel){
    labelEl.innerText = "À toi";
    // Vibre une seule fois par tour. Pas au tout premier tour (aucune carte retournée) : tout le monde
    // voit la partie démarrer
    if(tour !== dernierTourVibre){
      dernierTourVibre = tour;
      if(plateau.querySelector(".retournee")) vibrer([70, 60, 70]);
      programmerRappelTour(tour);
    }
  } else if(!enLigneActif && `${lancementPartieA}:${cartesRestantes()}:${idx}` !== dernierTourRappel){
    // Classique (un seul téléphone) : tour passé au joueur suivant => le compteur du rappel repart de
    // zéro, sans vibrer
    dernierTourRappel = `${lancementPartieA}:${cartesRestantes()}:${idx}`;
    relancerRappelClassique();
  }

  stickyJoueurActif.classList.toggle("is-pigeon", estPigeon);
  stickyJoueurActif.classList.toggle("has-bonus", n > 0);
  stickyJoueurActif.classList.add("visible");
}

// Un nom de joueur inséré dans du HTML doit passer par ici : sinon un pseudo comme
// <img src=x onerror=...> exécuterait du code chez tous les joueurs (mode en ligne)
function echapperHtml(texte){
  return String(texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// En ligne : mention ajoutée au nom d'un joueur déconnecté (vide sinon)
function texteDeconnecte(nom){
  return enLigneActif && deconnectes.has(nom) ? " (déconnecté(e))" : "";
}

function badgeDeconnecte(nom){
  return texteDeconnecte(nom) ? ` <span class="joueur-deconnecte">déconnecté(e)</span>` : "";
}

// Même mention (rouge, en italique, plus petite), ajoutée à un élément affiché en texte
function ajouterBadgeDeconnecte(el, deconnecte){
  if(!deconnecte) return;
  const badge = document.createElement("span");
  badge.className = "joueur-deconnecte";
  badge.innerText = "déconnecté(e)";
  el.appendChild(badge);
}

function afficherJoueurs(){
  listeJoueurs.innerHTML = joueurs.map((j,i)=>{
    const n = Number(annulations[j] || 0);
    const bonus = n > 0 ? ` <span class="bonus-annulation">+${n}</span>` : "";

    const pause = estEnPause(j) ? ` <span class="badge-pause">EN PAUSE</span>` : "";
    const classePause = estEnPause(j) ? " joueur-en-pause" : "";
    if(i === indexPigeon){
      return `<div class="joueur-ligne joueur-ligne-pigeon${classePause}"><strong>PIGEON</strong> (${echapperHtml(avecCouronne(nomPigeonOriginal))})${bonus}${pause}${badgeDeconnecte(j)}</div>`;
    }

    return `<div class="joueur-ligne${classePause}">${echapperHtml(avecCouronne(j))}${bonus}${pause}${badgeDeconnecte(j)}</div>`;
  }).join("");

  // En partie : bouton ⏸ (ou ▶ s'il est en pause) à droite de chaque nom
  if(partieLancee){
    listeJoueurs.querySelectorAll(".joueur-ligne").forEach((ligne, i) => {
      const nom = joueurs[i];
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "btnPauseJoueur" + (estEnPause(nom) ? " en-pause" : "");
      bouton.setAttribute("aria-label", estEnPause(nom) ? `${nom} est de retour` : `Mettre ${nom} en pause`);
      bouton.innerHTML = estEnPause(nom) ? ICONE_RETOUR_JOUEUR : ICONE_PAUSE_JOUEUR;
      surAction(bouton, "pause:" + nom, {
        evenement: "alcuno-pause",
        pret: () => partieLancee && !predictionEnCours,
        valide: () => joueurs.includes(nom) && (estEnPause(nom) || indexJoueursActifs().length > 2)
      }, () => basculerPauseJoueur(nom));
      bouton.addEventListener("click", () => ouvrirVoletPause(nom, bouton));
      ligne.appendChild(bouton);
    });
  }

  if(!partieLancee){
    btnJouer.style.display = joueurs.length >= 2 ? "inline-block" : "none";
  }
  majBoutonsJoueurs();
  majStickyJoueurActif();
}

// Supprimer : avant la partie (classique) dès qu'il y a un joueur, pendant la partie s'il en reste plus de 2.
// Ajouter : seulement avant la partie (en ligne, les joueurs viennent de la salle d'attente).
function majBoutonsJoueurs(){
  const supprimer = partieLancee ? joueurs.length > 2 : (!enLigneActif && joueurs.length > 0);
  btnSupprimer.style.display = supprimer ? "inline-block" : "none";
  nomJoueurInput.style.display = partieLancee ? "none" : "";
  btnAjouter.style.display = partieLancee ? "none" : "";
}


function afficherJoueurActif(){
  if(!partieLancee || choixPigeonEnCours || duelEnCours || joueurs.length === 0){
    joueurActif.innerText = "";
    majStickyJoueurActif();
    return;
  }

  const idx = indexJoueur % joueurs.length;
  const nom = joueurs[idx];
  const n = Number(annulations[nom] || 0);
  const libelle = idx === indexPigeon ? `PIGEON (${avecCouronne(nom)})` : avecCouronne(nom);
  const bonus = n > 0 ? ` +${n}` : "";
  joueurActif.innerText = "Joueur actif : " + libelle + bonus;
  ajouterBadgeDeconnecte(joueurActif, !!texteDeconnecte(nom));

  majStickyJoueurActif();
}

function effacerMessagePigeon(){
  reglePigeon.innerText = "";
  reglePigeon.style.display = "none";
}

/* ===== JOUEURS ===== */
function ajouterJoueur(){
  if(partieLancee) return; // pas de nouveau joueur en pleine partie
    let nom = nomJoueurInput.value;

  // Normalisation robuste : trim + espaces multiples -> 1 + lower
  nom = nom.replace(/\s+/g, " ").trim();
  if(!nom) return;

  const key = nom.toLocaleLowerCase("fr-FR");

  if (joueurs.some(j => (j || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr-FR") === key)) {
      nomJoueurInput.value = "";
      return;
  }

  joueurs.push(nom);
  nomJoueurInput.value = "";
  afficherJoueurs();
}


btnAjouter.addEventListener("pointerdown", (e) => {
  // Clavier ouvert : il reste ouvert pour le joueur suivant (sinon le champ perd le focus à chaque ajout)
  if (document.activeElement === nomJoueurInput) e.preventDefault();
  ajouterJoueur();
});
nomJoueurInput.addEventListener("keydown", e=>{ if(e.key==="Enter") ajouterJoueur(); });

const titreSuppression = suppression.querySelector("h2");

// "click" (et pas pointerdown) : sinon le doigt relevé coche/choisit tout de suite le joueur placé dessous
btnSupprimer.addEventListener("click", ()=>{
  if(partieLancee){
    ouvrirRetraitEnJeu();
    return;
  }
  titreSuppression.innerText = "Supprimer un ou plusieurs joueurs";
  btnTermine.innerText = "Terminé";
  menu.style.display="none";
  suppression.style.display="flex";
  lockScroll();
  listeSuppression.innerHTML="";
  joueurs.forEach((j,i)=>{
    const ligne = document.createElement("div");

    ligne.innerHTML = `
        <label class="supp-item">
          <input class="supp-check" type="checkbox" value="${i}">
          <span class="supp-name">${echapperHtml(j)}</span>
        </label>
      `;

    listeSuppression.appendChild(ligne);
  });
});

btnTermine.addEventListener("click", ()=>{
  const toDelete=[...listeSuppression.querySelectorAll("input:checked")]
    .map(cb=>parseInt(cb.value,10)).sort((a,b)=>b-a);
  toDelete.forEach(i=>{
    const name = joueurs[i];
    joueurs.splice(i,1);
    // si pigeon supprimé ou liste vide
    if (joueurs.length === 0) {
      indexPigeon = null;
    } else if (indexPigeon != null) {
      // si on a supprimé quelqu’un avant l’index pigeon, il faut le décaler
      // (le plus safe : retrouver par nom si tu gardes nomPigeonOriginal)
      const newIdx = joueurs.indexOf(nomPigeonOriginal);
      indexPigeon = newIdx >= 0 ? newIdx : null;
    }
    // sécurise indexJoueur
    if (joueurs.length > 0) indexJoueur = ((indexJoueur % joueurs.length) + joueurs.length) % joueurs.length;

    if(name != null) delete annulations[name];
  });
  suppression.style.display="none";
  menu.style.display="flex";
  unlockScroll();
  afficherJoueurs();
});

/* ===== RETIRER UN JOUEUR PENDANT LA PARTIE ===== */
// Seulement plateau au repos : aucun overlay, aucun choix en cours, pas pendant le pari de fin
// (il reste alors 1 carte). En ligne, c'est vérifié à nouveau sur chaque téléphone au moment du retrait.
function plateauLibre(){
  return partieLancee && !choixPigeonEnCours && !duelEnCours && !predictionEnCours &&
    cartesRestantes() !== 1 && !document.querySelector('[id^="overlay"]');
}

function ouvrirRetraitEnJeu(){
  if(joueurs.length <= 2){
    afficherToast("Il faut au moins 3 joueurs pour en retirer un");
    return;
  }
  if(!plateauLibre()){
    afficherToast("Attends la fin de l'action en cours");
    return;
  }

  titreSuppression.innerText = "Retirer un joueur de la partie";
  btnTermine.innerText = "Annuler";
  listeSuppression.innerHTML = "";
  joueurs.forEach((nom) => {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "supp-item supp-retrait";
    bouton.innerHTML = `<span class="supp-name">${echapperHtml(avecCouronne(nom))}</span>${badgeDeconnecte(nom)}`;
    bouton.addEventListener("click", () => demanderConfirmationRetrait(nom));
    listeSuppression.appendChild(bouton);
  });

  menu.style.display = "none";
  suppression.style.display = "flex";
  lockScroll();
}

const ecranConfirmerRetrait = document.getElementById("ecranConfirmerRetrait");
let retraitEnAttente = null;

function demanderConfirmationRetrait(nom){
  retraitEnAttente = nom;
  document.getElementById("titreConfirmerRetrait").innerText = `Retirer ${nom} de la partie ?`;

  let texte = "La partie continue sans lui/elle.";
  if(enLigneActif && nom === pseudoActuel){
    texte = "Tu vas quitter la partie. Elle continuera sans toi.";
  } else if(enLigneActif && nom === hotePartie){
    const i = joueurs.indexOf(nom);
    texte = `C'est l'hôte : le rôle d'hôte passera à ${joueurs[(i + 1) % joueurs.length]}.\nLa partie continue sans lui/elle.`;
  }
  document.getElementById("texteConfirmerRetrait").innerText = texte;
  ecranConfirmerRetrait.style.display = "";
}

function fermerRetraitEnJeu(){
  retraitEnAttente = null;
  ecranConfirmerRetrait.style.display = "none";
  if(suppression.style.display !== "none"){
    suppression.style.display = "none";
    menu.style.display = "flex";
    unlockScroll();
  }
}

document.getElementById("btnConfirmerRetraitNon").addEventListener("click", () => {
  retraitEnAttente = null;
  ecranConfirmerRetrait.style.display = "none";
});

document.getElementById("btnConfirmerRetraitOui").addEventListener("click", () => {
  const nom = retraitEnAttente;
  fermerRetraitEnJeu();
  if(!nom || !joueurs.includes(nom)) return;
  if(joueurs.length <= 2){
    afficherToast("Il faut au moins 3 joueurs pour en retirer un");
    return;
  }
  if(!plateauLibre()){
    afficherToast("Une action vient de commencer : réessaie juste après");
    return;
  }

  if(!enLigneActif){
    retirerJoueurEnJeu(nom);
    noterActionClassique(`retrait-classique:${nom}`);
    afficherToast(`${nom} a été retiré de la partie`);
    return;
  }

  const moiMeme = nom === pseudoActuel;
  ecrireAction(idRetrait(nom))
    .then(() => {
      // Retrait de soi-même : on part tout de suite (si le retrait n'a pas déjà été appliqué ici)
      if(!moiMeme || !codePartieActuel) return;
      quitterPartieEnLigne();
      allerAccueil();
    })
    .catch(() => afficherToast("Connexion perdue, réessaie"));
});

// Applique le retrait (identique sur tous les téléphones en ligne). Le tour, le pigeon, ses « 1 » et
// l'hôte sont mis à jour ; les overlays sont fermés à ce moment-là, rien d'autre ne dépend de lui.
function retirerJoueurEnJeu(nom){
  const idx = joueurs.indexOf(nom);
  if(idx < 0 || joueurs.length <= 2) return false;

  const courant = indexJoueur % joueurs.length;
  joueurs.splice(idx, 1);
  delete annulations[nom];
  joueursEnPause.delete(nom);
  const n = joueurs.length;

  if(indexPigeon !== null){
    if(indexPigeon === idx){
      // Plus de pigeon : le prochain qui tire un 3 le devient, comme en début de partie
      indexPigeon = null;
      nomPigeonOriginal = "";
      effacerMessagePigeon();
    } else if(indexPigeon > idx){
      indexPigeon--;
    }
  }

  // C'était son tour : il passe au suivant, dans le sens du jeu
  if(idx < courant) indexJoueur = courant - 1;
  else if(idx > courant) indexJoueur = courant;
  else indexJoueur = sensHoraire ? idx % n : (idx - 1 + n) % n;

  if(enLigneActif && nom === hotePartie) hotePartie = joueurs[idx % n];

  afficherJoueurs();
  afficherJoueurActif();
  return true;
}

// Carte dorée jamais retournée : elle se révèle et tout le monde prend un cul sec avant l'écran de fin
function finDePartie(){
  if(!carteDoreeEnJeu){
    afficherOverlayFinUnRestants();
    return;
  }

  carteDoreeEnJeu = false;
  joueurs.forEach(nom => noterGorgees(nom, estModeSoft() ? 2 : GORGEES_CUL_SEC));
  const caseDoree = plateau.children[indexCaseDoree];
  if(caseDoree){
    caseDoree.classList.remove("dos_dore");
    caseDoree.classList.add("carte_doree", "retournee");
  }

  const texte = texteDoreeJamaisTrouvee();
  montrerOverlayRegle(`Personne n'a trouvé la CARTE DORÉE !!\n${texte}`, "carte_doree");
  habillerOverlayCarteDoree(
    texte,
    '<span class="doree-etincelle">✦</span> PERSONNE N\'A TROUVÉ LA CARTE DORÉE !! <span class="doree-etincelle">✦</span>'
  );
  executerApresOverlayRegleUnique(afficherOverlayFinUnRestants);
}

// #endregion
