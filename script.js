// =============================================================================================
// ALCUNO : le jeu est réparti dans ces fichiers, chargés dans cet ordre par index.html (et copiés
// pour le hors connexion par sw.js). Chaque fichier est rangé en sections repliables
// (VS Code : flèche dans la marge à côté de « #region », ou Ctrl+K Ctrl+0 pour tout replier).
// Tout ce qu'un fichier déclare (const, let, function) est visible dans les fichiers suivants.
// Au chargement, un fichier ne doit appeler que du code des fichiers d'avant lui ; les fonctions
// lancées plus tard (boutons, minuteurs…) peuvent utiliser n'importe quel fichier.
//
//   script.js
//     Diagnostic : erreurs et avertissements récents
//     Démarrage : mode de jeu, version du jeu
//     Écran des créateurs (4 taps sur le titre)
//   js/reglages.js
//     Réglages : thème, Mode PJ, sons, rappel d'eau, partage, diagnostic, partie en mémoire, vibrations, écran allumé
//     Nouvelle version disponible et appli installable
//   js/en-ligne.js
//     Mode en ligne : codes de partie, menus Créer / Rejoindre / Revenir, transitions, clavier
//     Mode en ligne : salle d'attente, manches, présence, coupure réseau
//     Mode en ligne : reconnexion, joueur retiré qui revient, quitter la partie
//   js/plateau.js
//     Plateau, outils, joueurs, retirer un joueur en partie
//   js/regles.js
//     Overlays des règles : pigeon, annonces, annulations, carte dorée
//     Duel
//     Application des règles et déroulement du jeu
//     Écran « Nouvelle partie »
//   js/synchro-en-ligne.js
//     Mode en ligne : synchronisation des actions, rattrapage
//   js/retour-demarrage.js
//     Bouton retour du téléphone et démarrage du jeu
// =============================================================================================
// #region Diagnostic : erreurs et avertissements récents
// ===== Diagnostic : dernières erreurs et avertissements du jeu (dont Firebase) =====
// Copiés avec le reste par « Copier le diagnostic » (Réglages > À propos)
const erreursRecentes = [];
function noterErreur(texte){
  erreursRecentes.push(`${new Date().toLocaleTimeString("fr-FR")} ${String(texte).slice(0, 220)}`);
  if (erreursRecentes.length > 25) erreursRecentes.shift();
}
window.addEventListener("error", (e) => noterErreur(`${e.message} (${(e.filename || "").split("/").pop().split("?")[0]} ligne ${e.lineno})`));
window.addEventListener("unhandledrejection", (e) => noterErreur(`promesse : ${e.reason && (e.reason.message || e.reason)}`));
["warn", "error"].forEach((type) => {
  const original = console[type].bind(console);
  console[type] = (...args) => {
    try { noterErreur(`${type} : ${args.map(a => (a && a.message) ? a.message : String(a)).join(" ")}`); } catch (e) {}
    original(...args);
  };
});

// #endregion

// #region Démarrage : mode de jeu, version du jeu
// ================== MODE DE JEU (classique / en ligne) ==================
// Le module Firebase s'exécute souvent AVANT ce code : l'événement "firebase-ready"
// est alors déjà passé, on se fie donc à la présence de window.firebaseDB
function attendreFirebase(callback){
  if (window.firebaseDB) {
    callback();
  } else {
    window.addEventListener("firebase-ready", () => callback(), { once: true });
  }
}

let codePartieActuel = null;
let pseudoActuel = null;
let estHote = false;
let hotePartie = null;
// En ligne : pseudos marqués déconnectés dans Firebase (affichés « déconnecté » à côté du nom)
let deconnectes = new Set();

// Synchro en ligne : chaque tap de jeu est une action numérotée dans Firebase,
// rejouée dans le même ordre sur tous les téléphones (y compris l'émetteur).
let enLigneActif = false;
let mancheCourante = null;
let desabonnerJoueurs = null;
let desabonnerEtat = null;
let desabonnerActions = null;
let fileActions = new Map(); // seq -> { id, par }
let prochainSeq = 1;
let traitementEnCours = false;
let timerTrou = null;
let generationFile = 0; // change à chaque remise à zéro de la file (nouvelle manche, resynchronisation)
let idsUniquesUtilises = new Set(); // boutons « unique » déjà appliqués dans la manche (voir surAction)

// Reconnexion en pleine manche : on rejoue toutes les actions déjà faites, en accéléré
let repriseEnCours = false;     // la prochaine manche démarrée est une reprise (reprendrePlaceEnLigne)
let rattrapageEnCours = false;  // délais du jeu quasi nuls pendant le rattrapage (voir delai())
let seqFinRattrapage = 0;       // numéro de la dernière action à rattraper

// Délai du jeu (overlays, duel...) : quasi nul pendant le rattrapage d'une reconnexion.
// Minimum 60 ms : laisse le temps à l'overlay d'apparaître (requestAnimationFrame) avant de se fermer.
function delai(ms){
  return rattrapageEnCours ? Math.min(ms, 60) : ms;
}

// Joueur retiré qui revient : il est remis dans la manche par une action « retour »
// (voir verifierRetourDansManche), appliquée au même moment sur tous les téléphones
let ordreManche = [];           // joueurs au début de la manche : on revient à sa place d'origine
let retourEnCours = false;      // ce téléphone attend d'être remis dans la manche
let retourEnvoye = false;       // notre demande de retour est dans la file, pas encore traitée
let retourAnnonce = false;      // message « Tu reviens dans la partie… » déjà affiché
let timerRetour = null;

const PSEUDO_INVALIDE = /[.#$\[\]\/]/;

// Easter egg : couronne 👑 à côté du nom des créateurs du jeu
// (majuscules/minuscules ignorées : « TrIs », « ROSA »… comptent aussi)
const PSEUDOS_CREATEURS = [
  "tris", "tristanus", "origamy",
  "yla", "nana", "ylana",
  "celien", "célien", "chouchou",
  "ro", "rosa", "rosy", "roseanna"
];

function estCreateur(nom){
  return PSEUDOS_CREATEURS.includes(String(nom || "").trim().toLocaleLowerCase("fr-FR"));
}

function avecCouronne(nom){
  return estCreateur(nom) ? `${nom} 👑` : nom;
}

// À augmenter (+1) à chaque mise en ligne qui touche au mode en ligne : un téléphone qui a
// gardé une ancienne version ne pourra pas rejoindre (sinon les parties se désynchronisent)
// Affichée en bas de l'accueil. Enregistrée dans Firebase sous forme de nombre
// (les règles l'exigent) : "8.3.2" => 80302, pour pouvoir comparer les versions.
const VERSION_AFFICHEE = "9.1.5";
const VERSION_JEU = VERSION_AFFICHEE.split(".")
  .reduce((total, partie, i) => total + Number(partie) * [10000, 100, 1][i], 0);
// À l'écran : le numéro complet, pour voir d'un coup d'œil si un téléphone est à jour
document.getElementById("versionJeu").innerText = "Alcuno — version " + VERSION_AFFICHEE;

// #endregion

// #region Écran des créateurs (4 taps sur le titre)
// ===== Easter egg : 4 taps rapides sur le titre ALCUNO => écran des créateurs =====
const ecranCredits = document.getElementById("ecranCredits");
let tapsTitre = 0;
let dernierTapTitre = 0;

// pointerdown (et pas click) : les taps rapprochés ne génèrent pas tous un "click" sur mobile
// (titre du bandeau et grand titre de l'écran d'accueil)
document.querySelectorAll("header h1, #titreAccueil").forEach((titre) => titre.addEventListener("pointerdown", () => {
  const maintenant = Date.now();
  tapsTitre = (maintenant - dernierTapTitre < 600) ? tapsTitre + 1 : 1;
  dernierTapTitre = maintenant;

  if (tapsTitre >= 4) {
    tapsTitre = 0;
    ecranCredits.scrollTop = 0;
    jouerSon("credits");
    ouvrirPage(ecranCredits);
    debloquerPrestige(); // découvrir les créateurs débloque le thème secret « Prestige »
  }
}));

// Bouton d'une page qui défile (Réglages, créateurs) : un tap pendant que la page glisse encore
// sur son élan sert d'abord à arrêter le défilement, et le téléphone n'envoie alors pas de
// « click » (il fallait taper deux fois). On réagit donc aussi au doigt levé, si le doigt n'a
// presque pas bougé (sinon c'est un glissement). Un seul déclenchement par tap.
// Le « click » qui suit ce doigt levé est avalé, où qu'il tombe : la page qui se ferme ne capte
// plus les taps (pointer-events: none pendant sa sortie), et sur iPhone ce click tombait sur le
// bouton caché dessous (← Retour des Réglages => ouvrait les Règles du jeu, au même endroit).
let clicAAvaler = false;
let minuteurClicAAvaler = null;
document.addEventListener("click", (e) => {
  if (!clicAAvaler) return;
  clicAAvaler = false;
  e.preventDefault();
  e.stopPropagation();
}, true);
// Un nouveau contact sur l'écran : le « click » de l'ancien tap ne viendra plus
document.addEventListener("pointerdown", () => { clicAAvaler = false; }, true);

// Bouton touché : marqué « appuyé » 400 ms (style dans style_alcuno.css, comme :active). Les boutons des
// overlays réagissent dès le toucher et l'overlay disparaît aussitôt : sans ça, on ne voyait pas quel
// bouton avait été pris.
document.addEventListener("pointerdown", (e) => {
  const bouton = e.target.closest && e.target.closest("button");
  if (!bouton || bouton.disabled) return;
  bouton.classList.add("bouton-appuye");
  setTimeout(() => bouton.classList.remove("bouton-appuye"), 400);
}, true);

function activerMemePendantElan(bouton, action){
  let depart = null;
  bouton.addEventListener("pointerdown", (e) => {
    depart = (e.pointerType === "touch" || e.pointerType === "pen") ? { x: e.clientX, y: e.clientY } : null;
  });
  bouton.addEventListener("pointerup", (e) => {
    if (!depart) return;
    const deplacement = Math.hypot(e.clientX - depart.x, e.clientY - depart.y);
    depart = null;
    if (deplacement >= 12) return;
    clicAAvaler = true;
    clearTimeout(minuteurClicAAvaler);
    minuteurClicAAvaler = setTimeout(() => { clicAAvaler = false; }, 350);
    action();
  });
  bouton.addEventListener("pointercancel", () => { depart = null; });
  bouton.addEventListener("click", action); // souris, clavier (le click d'un tap est avalé plus haut)
}

activerMemePendantElan(document.getElementById("btnFermerCredits"), () => fermerPage(ecranCredits));

// Pages plein écran (Réglages, créateurs) : elles arrivent en glissant depuis la droite et
// repartent en fondu vers la droite (avant : elles apparaissaient / disparaissaient d'un coup)
function ouvrirPage(page){
  // Créateurs : la page derrière prend le fond du thème, comme cet écran (voir style_alcuno.css)
  if (page.id === "ecranCredits") document.documentElement.classList.add("credits-ouverts");
  page.classList.remove("page-sortie", "page-entree");
  page.style.display = "";
  void page.offsetWidth; // relance l'animation même si la page vient d'être fermée
  page.classList.add("page-entree");
}

function fermerPage(page){
  if (page.style.display === "none" || page.classList.contains("page-sortie")) return;
  page.classList.remove("page-entree");
  page.classList.add("page-sortie");
  let fini = false;
  const fin = (e) => {
    if (e && e.target !== page) return; // (fin d'une animation d'un élément de la page)
    if (fini) return;
    fini = true;
    page.removeEventListener("animationend", fin);
    page.classList.remove("page-sortie");
    page.style.display = "none";
    if (page.id === "ecranCredits") document.documentElement.classList.remove("credits-ouverts");
  };
  page.addEventListener("animationend", fin);
  setTimeout(() => fin(), 350); // sécurité : animations désactivées sur le téléphone
}

// #endregion
