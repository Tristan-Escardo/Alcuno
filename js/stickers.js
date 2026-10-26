// =============================================================================================
// ALCUNO : Album de stickers (à gagner en jouant) : les 11 stickers débloquent le thème Kawaii
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Album de stickers
// Les stickers sont gardés sur ce téléphone (stockage local du navigateur). En classique (un seul téléphone pour
// toute la table), un sticker se gagne quand ça arrive à n'importe quel joueur ; en ligne, seulement quand ça
// arrive à soi (pseudoActuel). Tout est compté à la fin de la partie, à partir des statistiques du récap
// (statsPartie, js/plateau.js), sauf « Fraise » (mise en pause d'un joueur), comptée tout de suite.
const CLE_STICKERS = "alcuno_stickers";
const STICKERS_POUR_KAWAII = 11; // tout l'album
const FENETRE_SOIREE = 6 * 60 * 60 * 1000; // « même soirée » : 3 parties finies en 6 h
const STICKERS = [
  { id: "cupcake", nom: "Cupcake",         indice: "Finir une partie" },
  { id: "chat",    nom: "Chat",            indice: "Finir 3 parties" },
  { id: "lapin",   nom: "Lapin",           indice: "Annuler une gorgée" },
  { id: "poussin", nom: "Poussin",         indice: "Devenir pigeon" },
  { id: "etoile",  nom: "Étoile",          indice: "Tirer la carte dorée" },
  { id: "licorne", nom: "Licorne",         indice: "Gagner un duel" },
  { id: "fraise",  nom: "Fraise",          indice: "Mettre un joueur en pause" },
  { id: "sushi",   nom: "Sushi",           indice: "Finir une partie express" },
  { id: "macaron", nom: "Macaron",         indice: "Finir une partie en ligne" },
  { id: "chou",    nom: "Chou à la crème", indice: "Recevoir un +4" },
  { id: "nuage",   nom: "Nuage",           indice: "Finir 3 parties dans la même soirée" }
];

function lireAlbum(){
  let a = null;
  try { a = JSON.parse(localStorage.getItem(CLE_STICKERS) || "null"); } catch (e) { a = null; }
  if (!a || typeof a !== "object") a = {};
  return {
    gagnes: Array.isArray(a.gagnes) ? a.gagnes.filter((id) => STICKERS.some((s) => s.id === id)) : [],
    parties: Number(a.parties) || 0,
    fins: Array.isArray(a.fins) ? a.fins.map(Number).filter(Boolean).slice(-5) : []
  };
}
function ecrireAlbum(a){
  try { localStorage.setItem(CLE_STICKERS, JSON.stringify(a)); } catch (e) {}
}
function nombreStickers(){ return lireAlbum().gagnes.length; }

// Qui est concerné : à la table (classique) ou moi (en ligne)
function stickerConcerne(nom){ return !enLigneActif || nom === pseudoActuel; }
function tableConcerne(table){ return Object.keys(table || {}).some((nom) => Number(table[nom]) > 0 && stickerConcerne(nom)); }

// Ajoute les stickers donnés (ceux qu'on n'a pas encore) ; renvoie la liste des nouveaux
function gagnerStickers(ids){
  const a = lireAlbum();
  const nouveaux = ids.filter((id, i) => ids.indexOf(id) === i && !a.gagnes.includes(id));
  if (!nouveaux.length) return [];
  a.gagnes.push(...nouveaux);
  ecrireAlbum(a);
  majResumeAlbum();
  if (a.gagnes.length >= STICKERS_POUR_KAWAII && !kawaiiDebloque()) debloquerKawaii(); // (js/reglages.js)
  return nouveaux;
}

function annoncerStickers(nouveaux, delai){
  if (!nouveaux.length) return;
  const noms = nouveaux.map((id) => (STICKERS.find((s) => s.id === id) || {}).nom).filter(Boolean);
  setTimeout(() => {
    try { afficherNotificationHaut("", noms.length > 1 ? `Nouveaux stickers : ${noms.join(", ")}` : `Nouveau sticker : ${noms[0]} !`, true); } catch (e) {}
  }, delai);
}

// Fin de partie (afficherOverlayFinUnRestants, js/regles.js) : on compte ce qui s'est passé (statsPartie)
function stickersFinDePartie(){
  if (rattrapageEnCours) return; // (rejeu accéléré d'une partie reprise ou d'une reconnexion : déjà compté)
  const a = lireAlbum();
  a.parties++;
  a.fins.push(Date.now());
  a.fins = a.fins.slice(-5);
  ecrireAlbum(a);
  const st = statsPartie || {};
  const gagnes = ["cupcake"];
  if (a.parties >= 3) gagnes.push("chat");
  if (tableConcerne(st.annulees)) gagnes.push("lapin");
  if (tableConcerne(st.pigeon)) gagnes.push("poussin");
  if (st.doree) gagnes.push("etoile"); // carte dorée en jeu ET tirée dans cette partie : peu importe qui l'a tirée
  if (tableConcerne(st.duels)) gagnes.push("licorne");
  if (partieExpress) gagnes.push("sushi");
  if (enLigneActif) gagnes.push("macaron");
  if (tableConcerne(st.plus4)) gagnes.push("chou");
  if (a.fins.length >= 3 && a.fins[a.fins.length - 1] - a.fins[a.fins.length - 3] <= FENETRE_SOIREE) gagnes.push("nuage");
  annoncerStickers(gagnerStickers(gagnes), 1800);
}

// Un joueur mis en pause (basculerPauseJoueur, js/plateau.js)
function stickerPause(nom){
  if (rattrapageEnCours || !stickerConcerne(nom)) return;
  annoncerStickers(gagnerStickers(["fraise"]), 2200);
}

// ----- Réglages : ligne « Album de stickers » et écran de l'album -----
function majResumeAlbum(){
  const note = document.getElementById("albumResume");
  if (!note) return;
  const n = nombreStickers();
  note.textContent = kawaiiDebloque()
    ? `${n} / ${STICKERS.length} stickers · thème Kawaii débloqué`
    : `${n} / ${STICKERS.length} stickers · complète l'album pour débloquer le thème Kawaii`;
}

// L'album s'ouvre dans l'écran des règles (mêmes blocs, donc les mêmes couleurs dans chaque thème) ; ouvrirRegles remet les règles
function ouvrirAlbum(){
  const a = lireAlbum();
  const page = document.getElementById("ecranRegles");
  page.classList.add("album");
  page.querySelector("h2").textContent = "Album de stickers";
  const liste = document.getElementById("listeRegles");
  liste.innerHTML = "";

  const progression = document.createElement("div");
  progression.className = "blocRegles albumProgression";
  const titre = document.createElement("h3");
  titre.textContent = kawaiiDebloque() ? "Thème Kawaii débloqué ✓" : `Thème Kawaii : ${Math.min(a.gagnes.length, STICKERS_POUR_KAWAII)} / ${STICKERS_POUR_KAWAII}`;
  const texte = document.createElement("p");
  texte.className = "albumTexte";
  texte.textContent = kawaiiDebloque()
    ? "Il est dans Réglages › Thèmes. Bravo, album complet !"
    : `Gagne les ${STICKERS.length} stickers pour débloquer le thème Kawaii.`;
  const barre = document.createElement("div");
  barre.className = "albumBarre";
  const rempli = document.createElement("span");
  rempli.style.width = `${Math.min(100, Math.round(a.gagnes.length / STICKERS_POUR_KAWAII * 100))}%`;
  barre.appendChild(rempli);
  progression.append(titre, texte, barre);
  liste.appendChild(progression);

  const bloc = document.createElement("div");
  bloc.className = "blocRegles albumListe";
  STICKERS.forEach((s) => {
    const gagne = a.gagnes.includes(s.id);
    const ligne = document.createElement("div");
    ligne.className = "ligneRegle albumLigne" + (gagne ? " albumGagne" : "");
    const image = document.createElement("img");
    image.className = "albumSticker";
    image.src = `stickers/${s.id}.svg`;
    image.alt = "";
    image.width = 56; image.height = 56;
    const texteLigne = document.createElement("div");
    texteLigne.className = "texteRegle";
    const nom = document.createElement("span");
    nom.className = "nomRegle";
    nom.textContent = gagne ? s.nom : "???";
    const detail = document.createElement("span");
    detail.className = "detailRegle";
    detail.textContent = (gagne ? "✓ " : "") + s.indice;
    texteLigne.append(nom, detail);
    ligne.append(image, texteLigne);
    bloc.appendChild(ligne);
  });
  liste.appendChild(bloc);

  page.scrollTop = 0;
  jouerSon("regles");
  ouvrirPage(page);
}

// ----- Découverte de l'album : 3 taps rapides sur la barre arc-en-ciel sous le titre de l'accueil -----
const CLE_ALBUM_DECOUVERT = "alcuno_album_decouvert";
function albumDecouvert(){
  try { return localStorage.getItem(CLE_ALBUM_DECOUVERT) === "1"; } catch (e) { return false; }
}
function majAlbumVisible(){
  const visible = albumDecouvert();
  const accueil = document.getElementById("albumAccueil");
  const ligne = document.getElementById("btnAlbum");
  if (accueil) accueil.hidden = !visible;
  if (ligne) ligne.style.display = visible ? "" : "none";
}
function decouvrirAlbum(){
  if (albumDecouvert()) return;
  try { localStorage.setItem(CLE_ALBUM_DECOUVERT, "1"); } catch (e) {}
  majAlbumVisible();
  try { vibrer([60, 40, 60]); } catch (e) {}
  const n = nombreStickers();
  afficherNotificationHaut("", n ? `Album de stickers découvert ! (${n} / ${STICKERS.length})` : "Album de stickers découvert !", true);
}

(function(){
  document.getElementById("btnAlbum").addEventListener("click", ouvrirAlbum);
  document.getElementById("btnAlbumAccueil").addEventListener("click", ouvrirAlbum);
  const barre = document.querySelector("#choixMode .titreAccueilBarre");
  let taps = 0, dernier = 0;
  if (barre) barre.addEventListener("click", () => {
    const maintenant = Date.now();
    taps = maintenant - dernier < 700 ? taps + 1 : 1;
    dernier = maintenant;
    if (taps >= 3) { taps = 0; decouvrirAlbum(); }
  });
  majAlbumVisible();
  majResumeAlbum();
})();
// #endregion

// ----- Thème Kawaii : stickers qui flottent derrière le jeu (visibles seulement avec ce thème, voir style_kawaii.css) -----
(function(){
  const zone = document.createElement("div");
  zone.id = "stickersKawaii";
  zone.setAttribute("aria-hidden", "true");
  const hasard = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 18; i++) {
    const e = document.createElement("span");
    const taille = hasard(34, 66);
    e.style.cssText = `left:${hasard(0, 92).toFixed(1)}%;top:${hasard(0, 92).toFixed(1)}%;width:${taille.toFixed(0)}px;height:${taille.toFixed(0)}px;` +
      `background-image:url(stickers/${STICKERS[i % STICKERS.length].id}.svg);--duree:${hasard(3.5, 7).toFixed(1)}s;--delai:${(-hasard(0, 6)).toFixed(1)}s`;
    zone.appendChild(e);
  }
  document.body.appendChild(zone);
})();
