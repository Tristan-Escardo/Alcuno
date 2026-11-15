// ===== Accueil, thème Fête de la musique : le petit piano sous le titre se joue pour de vrai =====
// La barre colorée sous ALCUNO devient un clavier de Fa 4 à Sol 5 : 9 touches blanches et 6 noires,
// chacune un vrai bouton. Un tap joue sa note (Sons/piano/piano_<touche>.mp3, 0,9 s, de vraies
// hauteurs en tempérament égal) et un glissé du doigt les enchaîne, comme sur un vrai piano.
// Le son suit le réglage « Sons » et le curseur de volume, comme le reste.
//
// Dans tous les autres thèmes, la barre reste la ligne colorée d'origine : le clavier n'est construit que
// dans le thème musique (appel depuis appliquerTheme, js/reglages.js) et il est retiré quand on en sort.
// Si ce fichier ne se charge pas, la barre garde le dessin de piano en image de fond (style_musique.css) :
// on ne peut pas en jouer, mais rien n'est cassé.
//
// Les 15 notes ne sont téléchargées qu'au premier contact avec le clavier (240 Ko en tout), pas au
// démarrage du jeu. La première note peut donc arriver avec un petit retard ; jouerSon la joue dès
// qu'elle est prête. Elles sont dans sw.js pour être là hors connexion.
const PIANO_BLANCHES = [
  { cle: "fa4",  nom: tr("Fa") },
  { cle: "sol4", nom: tr("Sol") },
  { cle: "la4",  nom: tr("La") },
  { cle: "si4",  nom: tr("Si") },
  { cle: "do5",  nom: tr("Do") },
  { cle: "re5",  nom: tr("Ré") },
  { cle: "mi5",  nom: tr("Mi") },
  { cle: "fa5",  nom: tr("Fa aigu") },
  { cle: "sol5", nom: tr("Sol aigu") },
];
// apres : numéro de la touche blanche à droite de laquelle la noire est posée (0 = la première)
const PIANO_NOIRES = [
  { cle: "fa4d",  nom: tr("Fa dièse"),  apres: 0 },
  { cle: "sol4d", nom: tr("Sol dièse"), apres: 1 },
  { cle: "la4d",  nom: tr("La dièse"),  apres: 2 },
  { cle: "do5d",  nom: tr("Do dièse"),  apres: 4 },
  { cle: "re5d",  nom: tr("Ré dièse"),  apres: 5 },
  { cle: "fa5d",  nom: tr("Fa dièse aigu"), apres: 7 },
];
const SONS_PIANO = PIANO_BLANCHES.concat(PIANO_NOIRES).map((t) => `piano/piano_${t.cle}`);
let pianoSonsDemandes = false;

// Doigts posés sur le clavier : pointerId -> dernière touche jouée par ce doigt (pour le glissé)
const doigtsSurLePiano = new Map();

// Ce qu'il y a vraiment sous le doigt (et pas la touche où le doigt s'est posé : voir le glissé plus bas)
function toucheSousLeDoigt(e){
  const el = document.elementFromPoint(e.clientX, e.clientY);
  return el && el.closest ? el.closest(".pianoTouche") : null;
}

function toucheDuPiano(t, genre){
  const b = document.createElement("button");
  b.type = "button";
  b.className = `pianoTouche pianoTouche-${genre}`;
  b.dataset.note = t.cle;
  b.setAttribute("aria-label", tr`Note ${t.nom}`);
  return b;
}

// Les 15 notes d'un coup, au premier contact avec le clavier (les suivantes sont alors instantanées)
function chargerSonsPiano(){
  if (pianoSonsDemandes) return;
  pianoSonsDemandes = true;
  try {
    const ctx = contexteAudio();
    if (ctx) SONS_PIANO.forEach((nom) => chargerSon(ctx, nom));
  } catch (e) {} // (moteur du son pas encore prêt : jouerSon s'en occupera)
}

function jouerToucheDuPiano(touche){
  touche.classList.add("pianoTouche-enfoncee");
  setTimeout(() => touche.classList.remove("pianoTouche-enfoncee"), 150);
  try { vibrer([10]); } catch (e) {}
  try { jouerSon(`piano/piano_${touche.dataset.note}`); } catch (e) {}
}

function majPianoAccueil(){
  const barre = document.querySelector("#choixMode .titreAccueilBarre");
  if (!barre) return;
  const voulu = document.documentElement.dataset.theme === "musique"
    && !document.documentElement.classList.contains("mode-tele");
  const dejaLa = barre.classList.contains("titreAccueilPiano");
  if (!voulu) {
    if (dejaLa) { // retour à la ligne colorée d'origine
      barre.classList.remove("titreAccueilPiano");
      barre.textContent = "";
      barre.setAttribute("aria-hidden", "true");
      barre.removeAttribute("role");
      barre.removeAttribute("aria-label");
    }
    return;
  }
  if (dejaLa) return;
  barre.classList.add("titreAccueilPiano");
  barre.removeAttribute("aria-hidden"); // des boutons sous aria-hidden seraient invisibles pour un lecteur d'écran
  barre.setAttribute("role", "group");
  barre.setAttribute("aria-label", tr("Petit piano"));
  PIANO_BLANCHES.forEach((t, i) => {
    const b = toucheDuPiano(t, "blanche");
    if (i === PIANO_BLANCHES.length - 1) b.classList.add("pianoTouche-fin"); // (pas de trait à droite)
    barre.appendChild(b);
  });
  PIANO_NOIRES.forEach((t) => {
    const b = toucheDuPiano(t, "noire");
    b.style.left = `${(t.apres + 1) * 100 / PIANO_BLANCHES.length}%`; // centrée par un margin-left négatif (CSS)
    barre.appendChild(b);
  });
  // Au doigt posé, pas au doigt levé : une vraie touche de piano sonne tout de suite
  barre.addEventListener("pointerdown", (e) => {
    const touche = toucheSousLeDoigt(e);
    if (!touche) return;
    chargerSonsPiano();
    doigtsSurLePiano.set(e.pointerId, touche);
    jouerToucheDuPiano(touche);
  });
  // Glissé : chaque touche survolée sonne à son tour. Le navigateur « capture » le doigt sur la touche du
  // départ, donc e.target reste cette touche-là pendant tout le glissé : on regarde ce qu'il y a vraiment
  // sous le doigt. Plusieurs doigts à la fois sont suivis séparément (e.pointerId).
  barre.addEventListener("pointermove", (e) => {
    if (!doigtsSurLePiano.has(e.pointerId)) return;
    const touche = toucheSousLeDoigt(e);
    if (!touche || touche === doigtsSurLePiano.get(e.pointerId)) return;
    doigtsSurLePiano.set(e.pointerId, touche);
    jouerToucheDuPiano(touche);
  });
  const doigtLeve = (e) => doigtsSurLePiano.delete(e.pointerId);
  barre.addEventListener("pointerup", doigtLeve);
  barre.addEventListener("pointercancel", doigtLeve); // (le navigateur reprend le doigt pour faire défiler la page)
  window.addEventListener("pointerup", doigtLeve);    // doigt levé en dehors du clavier
  window.addEventListener("pointercancel", doigtLeve);
  // Entrée / Espace au clavier, ou un lecteur d'écran : il n'y a pas eu de pointerdown (e.detail === 0)
  barre.addEventListener("click", (e) => {
    const touche = e.target.closest && e.target.closest(".pianoTouche");
    if (!touche || e.detail !== 0) return;
    chargerSonsPiano();
    jouerToucheDuPiano(touche);
  });
}

// Premier appel : appliquerTheme (js/reglages.js) tourne avant que ce fichier soit chargé, donc c'est ici
// que le clavier est construit au démarrage du jeu. Ensuite, c'est appliquerTheme qui rappelle la fonction.
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", majPianoAccueil);
else majPianoAccueil();
