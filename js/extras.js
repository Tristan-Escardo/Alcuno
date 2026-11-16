// =============================================================================================
// ALCUNO : Bar (recettes de cocktails) et Éthylotest (estimation du taux d'alcool)
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
//
// Deux écrans à côté du jeu, ouverts par les cartes en éventail de l'accueil (index.html : #cartesAccueil ; la carte Album,
// js/stickers.js, est entre les deux une fois l'album découvert). Comme l'album et la FAQ, ils s'ouvrent dans l'écran des
// Règles (mêmes blocs, donc les couleurs de chaque thème) : classes « bar » / « ethylo » sur #ecranRegles.
// Tout est dans ce fichier : rien n'est téléchargé, les deux marchent hors connexion.
// =============================================================================================
// #region Bar : recettes de cocktails
// Sans accents ni majuscules, pour la recherche (« pina » trouve « Piña Colada »)
function simplifierTexteBar(texte){
  return String(texte).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Petit retour au doigt (Android ; un iPhone ne peut pas vibrer depuis une page web). Passe par vibrer() de js/reglages.js, donc
// respecte le réglage « Vibrations » ; ne fait rien si le téléphone ne sait pas vibrer.
function tic(ms){
  try { if (typeof vibrer === "function") vibrer(ms); } catch (e) {}
}

let familleBar = "";   // filtre choisi ("" : tous, "fav" : les favoris)
let rechercheBar = "";

function elementExtras(balise, classe, texte){
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

// Ouvre un des écrans de ce fichier dans l'écran des Règles (voir l'en-tête)
function ouvrirPageExtras(mode, titre){
  const page = ecranRegles;
  page.classList.remove("album", "faq", "bar", "ethylo");
  page.classList.add(mode);
  page.querySelector("h2").textContent = titre;
  document.getElementById("listeRegles").textContent = "";
  page.scrollTop = 0;
  if (page.style.display === "none" || page.classList.contains("page-sortie")) ouvrirPage(page);
}

// Favoris : les identifiants des recettes, gardés sur ce téléphone
const CLE_FAVORIS_BAR = "alcuno_bar_favoris";
function lireFavorisBar(){
  try {
    const l = JSON.parse(localStorage.getItem(CLE_FAVORIS_BAR) || "[]");
    return new Set(Array.isArray(l) ? l.filter((x) => typeof x === "string") : []);
  } catch (e) { return new Set(); }
}
function ecrireFavorisBar(favoris){
  try { localStorage.setItem(CLE_FAVORIS_BAR, JSON.stringify(Array.from(favoris))); } catch (e) {}
}

const EMOJIS_BAR = { fav: "⭐", rhum: "🍹", vodka: "🍸", gin: "🌿", tequila: "🌵", whisky: "🥃", bulles: "🥂", shooter: "🔥", sans: "🧃" };

// Jeu en anglais : une recette du Bar dans sa version anglaise. Dans l'ordre : le texte anglais saisi dans le pilotage
// (stats.html, onglet Bar : c.en), sinon la traduction du jeu (js/en.js) pour chaque morceau resté tel quel (nom, verre,
// chaque ingrédient, préparation), sinon le français. Une recette du jeu dont on n'a changé qu'un ingrédient reste donc
// en anglais partout ailleurs.
function cocktailEnAnglais(c){
  const en = c.en || {};
  const lignesEn = en.i ? en.i.split("\n") : null;
  return Object.assign({}, c, {
    n: en.n || tr(c.n), v: en.v || tr(c.v),
    i: lignesEn && lignesEn.length ? lignesEn : c.i.map((l) => tr(l)),
    p: en.p || tr(c.p)
  });
}

function remplirListeBar(zone){
  zone.textContent = "";
  const cherche = simplifierTexteBar(rechercheBar.trim());
  // (jeu en anglais : voir cocktailEnAnglais)
  const favoris = lireFavorisBar();
  const trouves = cocktailsBar(typeof configDistante === "object" ? configDistante : null)
    .map((c) => (estAnglais ? cocktailEnAnglais(c) : c)).filter((c) => (!familleBar || (familleBar === "fav" ? favoris.has(c.id) : c.g === familleBar)) &&
    (!cherche || simplifierTexteBar(c.n + " " + c.i.join(" ")).includes(cherche)));
  if (!trouves.length) {
    const vide = elementExtras("div", "blocRegles");
    vide.appendChild(elementExtras("p", "detailRegle extrasVide", familleBar === "fav" && !cherche
      ? tr("Aucun favori pour l'instant : ouvre une recette et touche « Ajouter aux favoris ».") : tr("Aucun cocktail ne correspond.")));
    zone.appendChild(vide);
    return;
  }
  zone.appendChild(elementExtras("p", "barCompte", trPluriel(trouves.length, tr("recette"))));
  FAMILLES_BAR.forEach(([id, nom]) => {
    const liste = trouves.filter((c) => c.g === id);
    if (!liste.length) return;
    const bloc = elementExtras("div", "blocRegles blocFaq");
    bloc.appendChild(elementExtras("h3", "", EMOJIS_BAR[id] + " " + tr(nom)));
    liste.forEach((c) => {
      const d = elementExtras("details", "faqItem");
      d.name = "cocktail"; // (une seule recette ouverte à la fois, sur les téléphones récents)
      d.setAttribute("name", "cocktail");
      d.dataset.cocktail = c.n;
      const titre = elementExtras("summary", "nomRegle faqQuestion", c.n);
      const etoile = elementExtras("span", "barEtoile", favoris.has(c.id) ? "★" : "");
      etoile.setAttribute("aria-hidden", "true");
      titre.prepend(etoile);
      titre.appendChild(elementExtras("span", "barSous", tr`${c.i.length} ingrédients · ${c.v}`));
      d.appendChild(titre);
      const corps = elementExtras("div", "detailRegle barRecette");
      const ingredients = elementExtras("ul", "lignesRegle");
      c.i.forEach((ligne) => ingredients.appendChild(elementExtras("li", "", ligne)));
      const bouton = elementExtras("button", "extrasPuce barFavori");
      bouton.type = "button";
      const majFavori = () => {
        const fav = favoris.has(c.id);
        bouton.textContent = fav ? "★ " + tr("Retirer des favoris") : "☆ " + tr("Ajouter aux favoris");
        bouton.setAttribute("aria-pressed", String(fav));
        etoile.textContent = fav ? "★" : "";
      };
      bouton.addEventListener("click", () => { // (la recette reste ouverte : on met seulement l'étoile à jour)
        if (!favoris.delete(c.id)) favoris.add(c.id);
        ecrireFavorisBar(favoris);
        tic(10);
        majFavori();
      });
      majFavori();
      corps.append(ingredients, elementExtras("p", "", c.p), elementExtras("p", "barVerre", "🍸 " + c.v), bouton);
      d.appendChild(corps);
      bloc.appendChild(d);
    });
    zone.appendChild(bloc);
  });
}

function ouvrirBar(){
  jouerSon("cartes");
  ouvrirPageExtras("bar", tr("Le Bar"));
  const liste = document.getElementById("listeRegles");

  const champ = elementExtras("input", "extrasChamp");
  champ.type = "search";
  champ.placeholder = tr("Cocktail ou ingrédient");
  champ.setAttribute("aria-label", tr("Chercher un cocktail ou un ingrédient"));
  champ.autocomplete = "off";
  champ.enterKeyHint = "search";
  champ.value = rechercheBar;

  const filtres = elementExtras("div", "extrasPuces");
  filtres.setAttribute("role", "group");
  filtres.setAttribute("aria-label", tr("Famille de cocktails"));
  const zone = elementExtras("div", "barListe");
  const choisirFamille = (id) => {
    familleBar = id;
    filtres.querySelectorAll(".extrasPuce").forEach((p) => p.setAttribute("aria-pressed", String(p.dataset.famille === id)));
    remplirListeBar(zone);
  };
  [["", tr("Tous")], ["fav", tr("Favoris")]].concat(FAMILLES_BAR).forEach(([id, nom]) => {
    const puce = elementExtras("button", "extrasPuce", (id ? EMOJIS_BAR[id] + " " : "") + tr(nom));
    puce.type = "button";
    puce.dataset.famille = id;
    puce.setAttribute("aria-pressed", String(id === familleBar));
    puce.addEventListener("click", () => choisirFamille(id));
    filtres.appendChild(puce);
  });
  champ.addEventListener("input", () => { rechercheBar = champ.value; remplirListeBar(zone); });
  champ.addEventListener("keydown", (e) => { if (e.key === "Enter") champ.blur(); });

  liste.append(champ, filtres, zone, elementExtras("p", "extrasNote", tr("L'abus d'alcool est dangereux pour la santé : à consommer avec modération.")));
  remplirListeBar(zone);
}
// #endregion

// #region Éthylotest : estimation du taux d'alcool
// Une ESTIMATION, jamais une mesure : seul un éthylotest dit vrai. Formule de Widmark : grammes d'alcool pur bus, divisés par
// (poids x coefficient de diffusion : 0,7 pour un homme, 0,6 pour une femme) = g d'alcool par litre de sang ; le corps en élimine
// ensuite de 0,10 à 0,15 g/L par heure. Tout est choisi du côté prudent : élimination la plus lente (0,10), chaque verre compté
// d'un coup dès qu'il est bu, heures arrondies au quart d'heure d'après. Et l'écran ne dit jamais « tu peux conduire ».
// Limites en France : 0,5 g/L de sang ; 0,2 g/L en permis probatoire.
const CLE_ETHYLO = "alcuno_ethylo"; // { poids, sexe, probatoire } : gardé dans le téléphone, jamais envoyé
const ELIMINATION_PAR_HEURE = 0.10;
const LIMITE_ALCOOL = 0.5, LIMITE_PROBATOIRE = 0.2;
const POIDS_MIN_ETHYLO = 40, POIDS_MAX_ETHYLO = 160;
// Bières : un format et un degré au choix (le curseur), comptées à part pour chaque degré (clé « format@degré » dans ethylo.bieres)
const FORMATS_BIERE = [
  { id: "demi", nom: tr("Demi"), cl: 25 },
  { id: "bouteille", nom: tr("Bouteille ou canette"), court: tr("Bouteille"), cl: 33 },
  { id: "pinte", nom: tr("Pinte"), cl: 50 }
];
const DEGRE_BIERE_MIN = 2, DEGRE_BIERE_MAX = 14;
// Les autres verres : volume (cl) et degré fixes
const VERRES_ETHYLO = [
  { id: "vin", nom: tr("Verre de vin"), detail: tr("12,5 cl, 12°"), cl: 12.5, deg: 12 },
  { id: "bulles", nom: tr("Coupe de champagne"), detail: tr("10 cl, 12°"), cl: 10, deg: 12 },
  { id: "fort", nom: tr("Alcool fort ou cocktail"), detail: tr("4 cl d'alcool à 40°"), cl: 4, deg: 40 },
  { id: "shooter", nom: tr("Shooter"), detail: tr("3 cl, 40°"), cl: 3, deg: 40 }
];
// Grammes d'alcool pur : cl x 10 x degré / 100 x 0,8
function grammesAlcool(cl, deg){ return cl * 10 * deg / 100 * 0.8; }
const DUREE_MAX_ETHYLO = 16 * 60; // premier verre : jusqu'à 16 h avant maintenant
// Numéros d'urgence en France (appel gratuit) et ligne d'écoute
const NUMEROS_UTILES = [
  ["112", tr("Urgences"), tr("Numéro d'urgence, partout en Europe")],
  ["15", "SAMU", tr("Urgence médicale : quelqu'un qui ne se réveille plus, qui respire mal")],
  ["18", tr("Pompiers"), tr("Accident, personne en danger")],
  ["17", tr("Police, gendarmerie"), tr("Danger, agression, accident de la route")],
  ["114", tr("Urgences par SMS"), tr("Pour les personnes sourdes ou malentendantes")],
  ["0980980930", tr("Alcool info service"), tr("0 980 980 930 : écoute anonyme, appel non surtaxé, tous les jours de 8 h à 2 h")]
];

let ethylo = { poids: 70, sexe: "h", probatoire: false, verres: {}, bieres: {}, degBiere: 5, debut: 120, dernier: 30 }; // (debut, dernier : il y a tant de minutes)
try {
  const garde = JSON.parse(localStorage.getItem(CLE_ETHYLO) || "null");
  if (garde && typeof garde === "object") {
    if (Number(garde.poids) >= 35 && Number(garde.poids) <= 200) ethylo.poids = Math.min(POIDS_MAX_ETHYLO, Math.max(POIDS_MIN_ETHYLO, Math.round(Number(garde.poids))));
    if (garde.sexe === "f" || garde.sexe === "h" || garde.sexe === "a") ethylo.sexe = garde.sexe;
    ethylo.probatoire = garde.probatoire === true;
  }
} catch (e) {}
function garderEthylo(){
  try { localStorage.setItem(CLE_ETHYLO, JSON.stringify({ poids: ethylo.poids, sexe: ethylo.sexe, probatoire: ethylo.probatoire })); } catch (e) {}
}
function texteDegre(deg){ return estAnglais ? deg + "%" : String(deg).replace(".", ",") + "°"; }

// Tous les verres comptés, en grammes d'alcool pur (un nombre par verre)
function grammesBus(e){
  const g = [];
  Object.keys(e.bieres || {}).forEach((cle) => {
    const [id, deg] = cle.split("@");
    const format = FORMATS_BIERE.find((f) => f.id === id);
    if (!format || !(Number(deg) > 0)) return;
    for (let k = 0; k < e.bieres[cle]; k++) g.push(grammesAlcool(format.cl, Number(deg)));
  });
  VERRES_ETHYLO.forEach((v) => { for (let k = 0; k < (e.verres[v.id] || 0); k++) g.push(grammesAlcool(v.cl, v.deg)); });
  return g;
}

// Calcul, minute par minute : les verres sont répartis régulièrement entre le premier et le dernier ; à chaque minute le taux
// baisse (jamais sous 0). Renvoie le taux de maintenant et dans combien de minutes il passe sous la limite, puis à zéro.
function calculerEthylo(e, limite){
  const hausses = grammesBus(e).map((g) => g / (e.poids * (e.sexe === "f" ? 0.6 : 0.7))); // g/L ajoutés par chaque verre
  const n = hausses.length;
  if (!n) return { taux: 0, verres: 0, sousLimite: 0, zero: 0 };
  hausses.sort((a, b) => b - a); // (les plus chargés d'abord : c'est le cas le moins favorable)
  const debut = Math.max(e.debut, e.dernier), dernier = Math.min(e.debut, e.dernier);
  const parMinute = ELIMINATION_PAR_HEURE / 60;
  let taux = 0, prochain = 0;
  for (let t = debut; t >= 0; t--) { // t : il y a t minutes
    while (prochain < n && t <= (n === 1 ? dernier : debut - (debut - dernier) * prochain / (n - 1))) taux += hausses[prochain++];
    if (t > 0) taux = Math.max(0, taux - parMinute);
  }
  while (prochain < n) taux += hausses[prochain++];
  return {
    taux, verres: n,
    sousLimite: taux >= limite ? Math.floor((taux - limite) / parMinute) + 1 : 0, // (strictement sous la limite)
    zero: Math.ceil(taux / parMinute)
  };
}

function texteDureeEthylo(minutes){
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h} h${m ? " " + String(m).padStart(2, "0") : ""}` : tr`${m} min`;
}
// « 2 h 10, donc à 3 h 45 » : l'attente, puis l'heure de l'horloge (arrondie à la demi-heure d'après)
function texteHeureEthylo(minutes){
  const d = new Date(Date.now() + minutes * 60000);
  d.setSeconds(0, 0);
  if (d.getMinutes() % 30) d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30);
  const dans = Math.max(1, Math.round((d.getTime() - Date.now()) / 60000));
  const demain = d.getDate() !== new Date().getDate();
  return tr`${texteDureeEthylo(dans)}, donc à ${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}${demain ? tr(" demain") : ""}`;
}

// Rejoue une petite animation (classe « pop ») sur un élément
function popEthylo(e){
  e.classList.remove("pop");
  void e.offsetWidth;
  e.classList.add("pop");
}

// Le bloc du résultat (caché tant qu'aucun verre n'est compté) : construit une fois, puis seulement mis à jour, pour que la
// jauge et le chiffre s'animent d'une valeur à l'autre
function majResultatEthylo(zone){
  const limite = ethylo.probatoire ? LIMITE_PROBATOIRE : LIMITE_ALCOOL;
  const r = calculerEthylo(ethylo, limite);
  zone.hidden = r.verres === 0;
  zone.dataset.etat = r.verres === 0 ? "vide" : r.taux >= limite ? "rouge" : r.taux > 0 ? "orange" : "zero";
  if (r.verres === 0) return;
  if (!zone.firstChild) {
    const taux = elementExtras("div", "ethyloTaux");
    taux.append(elementExtras("span", "ethyloChiffre"), elementExtras("span", "ethyloUnite", tr("g/L de sang, estimé")));
    const jauge = elementExtras("div", "ethyloJauge");
    jauge.setAttribute("aria-hidden", "true");
    jauge.append(elementExtras("div", "ethyloJaugePlein"), elementExtras("div", "ethyloJaugeLimite"));
    zone.append(taux, jauge, elementExtras("p", "ethyloVerdict"), elementExtras("div", "ethyloLignes"));
  }
  const chiffre = zone.querySelector(".ethyloChiffre");
  const verdict = zone.querySelector(".ethyloVerdict"), lignes = zone.querySelector(".ethyloLignes");
  const machine = ethylo.sexe === "a"; // (blague : un hélicoptère, ou un X-Wing en Star Wars, ne marche pas à la bière)
  zone.querySelector(".ethyloUnite").hidden = machine;
  zone.querySelector(".ethyloJauge").hidden = machine;
  zone.classList.toggle("machine", machine);
  if (machine) {
    zone.dataset.etat = "rouge";
    chiffre.textContent = tr("Mauvais carburant");
    verdict.textContent = ""; lignes.textContent = "";
    return;
  }
  const texteTaux = trNombre(r.taux.toFixed(2).replace(".", ","));
  if (chiffre.textContent !== texteTaux) { chiffre.textContent = texteTaux; popEthylo(chiffre); }
  const echelle = Math.max(limite * 2, r.taux * 1.1); // (la limite au milieu de la jauge, tant que le taux ne déborde pas)
  zone.querySelector(".ethyloJaugePlein").style.width = Math.min(100, r.taux / echelle * 100) + "%";
  zone.querySelector(".ethyloJaugeLimite").style.left = (limite / echelle * 100) + "%";
  const texteLimite = `${trNombre(String(limite).replace(".", ","))} g/L${ethylo.probatoire ? tr(" (permis probatoire)") : ""}`;
  lignes.textContent = "";
  const ligne = (texte) => lignes.appendChild(elementExtras("p", "ethyloLigne", texte));
  if (r.taux >= limite) {
    verdict.textContent = tr("Tu ne conduis pas.");
    ligne(tr`Attends ${texteHeureEthylo(r.sousLimite)} avant de reprendre le volant.`);
  } else if (r.taux > 0) {
    verdict.textContent = tr("Sous la limite, mais pas à zéro.");
    ligne(tr`Le plus sûr : attends ${texteHeureEthylo(r.zero)}.`);
  } else {
    verdict.textContent = tr("Estimation : zéro.");
  }
  if (ethylo.dernier < 45 && r.taux > 0) ligne(tr("Dernier verre récent : ton taux peut encore monter."));
}

// Un réglage à glisser : nom, valeur écrite, curseur, graduations dessous.
//  texte(valeur) : ce qu'on affiche (un texte, ou [valeur, précision] : la précision s'écrit en petit dessous) ;
//  siChange(valeur) : à chaque mouvement ;
//  o.aimant(valeur) : palier vers lequel le curseur est attiré (renvoie la valeur elle-même s'il n'y en a pas près) ;
//  o.estPalier(valeur) : vrai sur un palier (petite vibration en l'atteignant, sur Android) ;
//  o.graduations : [{ v, grand, texte }] traits sous le curseur.
// Renvoie { ligne, poser(valeur), redessiner() }.
function glissiereEthylo(titre, min, max, pas, valeur, texte, siChange, o){
  o = o || {};
  const ligne = elementExtras("label", "ethyloGlisse");
  const tete = elementExtras("div", "ethyloGlisseTete");
  const ecrit = elementExtras("span", "ethyloGlisseValeur");
  const precision = elementExtras("span", "ethyloGlissePrecision");
  tete.append(elementExtras("span", "nomRegle", titre), ecrit);
  const curseur = elementExtras("input", "extrasGlisse");
  curseur.type = "range";
  curseur.min = String(min); curseur.max = String(max); curseur.step = String(pas);
  const position = (v) => (v - min) / (max - min);
  const montrer = () => {
    const v = Number(curseur.value);
    const t = texte(v), [principal, detail] = Array.isArray(t) ? t : [t, ""];
    ecrit.textContent = principal;
    precision.textContent = detail;
    precision.hidden = !detail;
    curseur.setAttribute("aria-valuetext", detail ? `${principal}, ${detail}` : principal);
    curseur.style.setProperty("--p", (position(v) * 100) + "%");
  };
  const graduations = elementExtras("div", "ethyloGraduations");
  graduations.setAttribute("aria-hidden", "true");
  const redessiner = () => {
    graduations.textContent = "";
    (typeof o.graduations === "function" ? o.graduations() : o.graduations || []).forEach((g) => {
      // (le centre du rond va de 14 px à la largeur moins 14 px : voir .extrasGlisse dans style_alcuno.css)
      const place = `calc(14px + (100% - 28px) * ${position(g.v)})`;
      const trait = elementExtras("span", "ethyloTrait" + (g.grand ? " grand" : ""));
      trait.style.left = place;
      graduations.appendChild(trait);
      if (g.texte) { const t = elementExtras("span", "ethyloTraitTexte", g.texte); t.style.left = place; graduations.appendChild(t); }
    });
    graduations.classList.toggle("avecTextes", !!graduations.querySelector(".ethyloTraitTexte"));
    montrer();
  };
  let dernierPalier = null;
  curseur.value = String(valeur);
  curseur.addEventListener("input", () => {
    let v = Number(curseur.value);
    if (o.aimant) {
      const a = Math.min(max, Math.max(min, o.aimant(v)));
      if (a !== v) { v = a; curseur.value = String(a); }
    }
    if (o.estPalier && o.estPalier(v) && v !== dernierPalier) { tic(6); }
    dernierPalier = o.estPalier && o.estPalier(v) ? v : null;
    montrer();
    siChange(v);
  });
  ligne.append(tete, precision, curseur, graduations);
  redessiner();
  return { ligne, poser: (v) => { curseur.value = String(v); montrer(); }, redessiner };
}

// Heure de l'horloge du téléphone, il y a tant de minutes : « 21 h 30 »
function heureIlYa(minutes){
  const d = new Date(Date.now() - minutes * 60000);
  return `${d.getHours()}${estAnglais ? ":" : " h "}${String(d.getMinutes()).padStart(2, "0")}`;
}

// sansSon : écran redessiné (« Tout remettre à zéro »), sans rejouer le son d'ouverture
function ouvrirEthylo(sansSon){
  if (sansSon !== true) jouerSon("cartes");
  ouvrirPageExtras("ethylo", tr("Éthylotest"));
  const liste = document.getElementById("listeRegles");
  const resultat = elementExtras("div", "blocRegles ethyloResultat");
  resultat.setAttribute("role", "status");
  const maj = () => majResultatEthylo(resultat);

  // --- Toi ---
  const toi = elementExtras("div", "blocRegles ethyloBloc");
  toi.appendChild(elementExtras("h3", "", tr("Toi")));
  const ligneSexe = elementExtras("div", "extrasPuces ethyloSexe");
  ligneSexe.setAttribute("role", "group");
  ligneSexe.setAttribute("aria-label", tr("Sexe (change le calcul)"));
  [["h", tr("Homme")], ["f", tr("Femme")]].concat([["a", document.documentElement.dataset.theme === "galaxie" ? "T-65 X-Wing" : "Boeing AH-64"]]).forEach(([id, nom]) => {
    const puce = elementExtras("button", "extrasPuce", nom);
    puce.type = "button";
    puce.setAttribute("aria-pressed", String(ethylo.sexe === id));
    puce.addEventListener("click", () => {
      ethylo.sexe = id;
      ligneSexe.querySelectorAll(".extrasPuce").forEach((p) => p.setAttribute("aria-pressed", String(p === puce)));
      garderEthylo(); maj();
    });
    ligneSexe.appendChild(puce);
  });
  // (paliers : attiré par les multiples de 5 à 1 kg près ; graduations tous les 10 kg, chiffrées tous les 20)
  const graduationsPoids = [];
  for (let v = POIDS_MIN_ETHYLO; v <= POIDS_MAX_ETHYLO; v += 20) graduationsPoids.push({ v, grand: true, texte: String(v) });
  const poids = glissiereEthylo(tr("Poids"), POIDS_MIN_ETHYLO, POIDS_MAX_ETHYLO, 1, ethylo.poids, (v) => v + " kg",
    (v) => { ethylo.poids = v; garderEthylo(); maj(); },
    { aimant: (v) => (Math.abs(v - Math.round(v / 5) * 5) <= 1 ? Math.round(v / 5) * 5 : v), estPalier: (v) => v % 5 === 0, graduations: graduationsPoids });
  const ligneProbatoire = elementExtras("label", "ethyloLigneChamp");
  const caseProbatoire = elementExtras("input");
  caseProbatoire.type = "checkbox";
  caseProbatoire.checked = ethylo.probatoire;
  caseProbatoire.addEventListener("change", () => { ethylo.probatoire = caseProbatoire.checked; garderEthylo(); maj(); });
  ligneProbatoire.append(caseProbatoire, elementExtras("span", "nomRegle", tr("Permis probatoire")), elementExtras("span", "detailRegle", tr("limite à 0,2 g/L")));
  toi.append(ligneSexe, poids.ligne, ligneProbatoire);

  // --- Ce que tu as bu ---
  const bu = elementExtras("div", "blocRegles ethyloBloc");
  bu.appendChild(elementExtras("h3", "", tr("Ce que tu as bu")));
  // Une ligne avec − nombre + ; lire() : le nombre du moment, changer(pas) : l'appliquer. Renvoie { ligne, montrer() }.
  const ligneCompteur = (nom, detail, lire, changer) => {
    const ligne = elementExtras("div", "ligneRegle ethyloVerre");
    const texte = elementExtras("div", "texteRegle");
    const sous = elementExtras("span", "detailRegle", detail);
    texte.append(elementExtras("span", "nomRegle", nom), sous);
    const compteur = elementExtras("div", "ethyloCompteur");
    const nombre = elementExtras("span", "ethyloNombre");
    nombre.setAttribute("aria-live", "polite");
    const montrer = (anime) => {
      const n = lire();
      if (nombre.textContent !== String(n)) { nombre.textContent = String(n); if (anime) popEthylo(nombre); }
      ligne.classList.toggle("ethyloChoisi", n > 0);
    };
    const bouton = (signe, libelle, pas) => {
      const b = elementExtras("button", "ethyloPas", signe);
      b.type = "button";
      b.setAttribute("aria-label", `${libelle} : ${nom}`);
      b.addEventListener("click", () => { changer(pas); montrer(true); maj(); });
      return b;
    };
    compteur.append(bouton("−", tr("Un de moins"), -1), nombre, bouton("+", tr("Un de plus"), 1));
    ligne.append(texte, compteur);
    montrer(false);
    return { ligne, montrer, sous };
  };
  const borner = (n) => Math.min(30, Math.max(0, n));

  // Bières : le degré se règle au curseur ; les compteurs montrent les bières de CE degré, les étiquettes dessous toutes les bières
  bu.appendChild(elementExtras("p", "ethyloSousTitre", tr("Bières")));
  bu.appendChild(elementExtras("p", "detailRegle ethyloAide", tr("Plusieurs bières différentes ? Règle le degré, ajoute, puis recommence pour la suivante.")));
  const etiquettes = elementExtras("div", "ethyloBieres");
  etiquettes.setAttribute("aria-label", tr("Bières comptées (toucher pour en retirer une)"));
  let lignesBiere = [];
  const cleBiere = (f) => f.id + "@" + ethylo.degBiere;
  const majBieres = () => {
    lignesBiere.forEach((l, k) => { l.sous.textContent = tr`${FORMATS_BIERE[k].cl} cl à ${texteDegre(ethylo.degBiere)}`; l.montrer(false); });
    etiquettes.textContent = "";
    Object.keys(ethylo.bieres).sort().forEach((cle) => {
      const [id, deg] = cle.split("@");
      const format = FORMATS_BIERE.find((f) => f.id === id);
      if (!format || !ethylo.bieres[cle]) return;
      const e = elementExtras("button", "extrasPuce", `${ethylo.bieres[cle]} × ${format.court || format.nom} ${texteDegre(deg)}  ✕`);
      e.type = "button";
      e.setAttribute("aria-label", tr`Retirer : ${format.nom} à ${texteDegre(deg)}`);
      e.addEventListener("click", () => {
        ethylo.bieres[cle] = borner(ethylo.bieres[cle] - 1);
        if (!ethylo.bieres[cle]) delete ethylo.bieres[cle];
        majBieres(); maj();
      });
      etiquettes.appendChild(e);
    });
  };
  // (graduations tous les 2 degrés ; les demi-degrés restent possibles entre deux)
  const graduationsDegre = [];
  for (let v = DEGRE_BIERE_MIN; v <= DEGRE_BIERE_MAX; v += 4) graduationsDegre.push({ v, grand: true, texte: v + (estAnglais ? "%" : "°") });
  const degre = glissiereEthylo(tr("Degré de la bière"), DEGRE_BIERE_MIN, DEGRE_BIERE_MAX, 0.5, ethylo.degBiere, texteDegre,
    (v) => { ethylo.degBiere = v; majBieres(); },
    { estPalier: (v) => v % 5 === 0, graduations: graduationsDegre });
  bu.appendChild(degre.ligne);
  lignesBiere = FORMATS_BIERE.map((f) => ligneCompteur(f.nom, "", () => ethylo.bieres[cleBiere(f)] || 0, (pas) => {
    const n = borner((ethylo.bieres[cleBiere(f)] || 0) + pas);
    if (n) ethylo.bieres[cleBiere(f)] = n; else delete ethylo.bieres[cleBiere(f)];
    majBieres();
  }));
  lignesBiere.forEach((l) => bu.appendChild(l.ligne));
  bu.appendChild(etiquettes);
  majBieres();

  bu.appendChild(elementExtras("p", "ethyloSousTitre", tr("Le reste")));
  VERRES_ETHYLO.forEach((v) => {
    bu.appendChild(ligneCompteur(v.nom, v.detail, () => ethylo.verres[v.id] || 0,
      (pas) => { ethylo.verres[v.id] = borner((ethylo.verres[v.id] || 0) + pas); }).ligne);
  });

  // --- Quand --- : deux curseurs indépendants sur une même frise (à gauche : il y a 16 h, à droite : maintenant), qui
  // donnent l'heure de l'horloge du téléphone. Toujours sur une demi-heure.
  // (si le « dernier » est mis avant le « premier », le calcul les remet simplement dans l'ordre)
  const quand = elementExtras("div", "blocRegles ethyloBloc");
  quand.appendChild(elementExtras("h3", "", tr("Quand")));
  const minuteDe = (t) => DUREE_MAX_ETHYLO - t; // (position du curseur => il y a tant de minutes)
  // (le curseur avance par demi-heures d'écart : « il y a 15 h 30 » ; l'heure de l'horloge dessous se calcule d'après le téléphone)
  const aimantHeure = (t) => DUREE_MAX_ETHYLO - Math.round(minuteDe(t) / 30) * 30;
  const estDemiHeure = (t) => minuteDe(t) % 60 === 0;
  const graduationsHeures = () => {
    const g = [];
    for (let h = 16; h >= 0; h -= 2) g.push({ v: DUREE_MAX_ETHYLO - h * 60, grand: true, texte: h + " h" }); // (il y a tant d'heures)
    return g;
  };
  const texteQuand = (t) => {
    const ilYa = minuteDe(t);
    return ilYa <= 0 ? [tr("maintenant"), tr("donc à ") + heureIlYa(0)] : [estAnglais ? texteDureeEthylo(ilYa) + " ago" : "il y a " + texteDureeEthylo(ilYa), tr("donc à ") + heureIlYa(ilYa)];
  };
  const curseurQuand = (titre, cle) => glissiereEthylo(titre, 0, DUREE_MAX_ETHYLO, 1, DUREE_MAX_ETHYLO - Math.min(DUREE_MAX_ETHYLO, ethylo[cle]),
    texteQuand, (t) => { ethylo[cle] = minuteDe(t); maj(); }, { aimant: aimantHeure, estPalier: estDemiHeure, graduations: graduationsHeures });
  // (les valeurs de départ aussi)
  ["debut", "dernier"].forEach((cle) => { ethylo[cle] = Math.max(0, minuteDe(aimantHeure(DUREE_MAX_ETHYLO - Math.min(DUREE_MAX_ETHYLO, ethylo[cle])))); });
  const premier = curseurQuand(tr("Premier verre"), "debut"), dernier = curseurQuand(tr("Dernier verre"), "dernier");
  quand.append(premier.ligne, dernier.ligne,
    elementExtras("p", "detailRegle ethyloAide", tr("Les verres sont comptés comme bus régulièrement entre les deux heures.")));
  // (l'écran resté ouvert : les heures écrites suivent l'horloge)
  const minuterie = setInterval(() => {
    if (!quand.isConnected) { clearInterval(minuterie); return; }
    premier.redessiner(); dernier.redessiner(); maj();
  }, 60000);

  // (« Tout remettre à zéro » : en bas du bloc « Ce que tu as bu », il ne vide que les verres)
  const remise = elementExtras("button", "btnFaqLien ethyloRemise", tr("Tout remettre à zéro"));
  remise.type = "button";
  remise.addEventListener("click", () => { ethylo.verres = {}; ethylo.bieres = {}; const y = ecranRegles.scrollTop; ouvrirEthylo(true); ecranRegles.scrollTop = y; });
  bu.appendChild(remise);

  // --- Numéros utiles ---
  const numeros = elementExtras("div", "blocRegles ethyloBloc");
  numeros.appendChild(elementExtras("h3", "", tr("Numéros utiles")));
  NUMEROS_UTILES.forEach(([numero, nom, detail]) => {
    const lien = elementExtras("a", "ethyloNumero");
    lien.href = "tel:" + numero;
    lien.setAttribute("aria-label", tr`Appeler ${nom}`);
    const texte = elementExtras("div", "texteRegle");
    texte.append(elementExtras("span", "nomRegle", nom), elementExtras("span", "detailRegle", detail));
    lien.append(elementExtras("span", "ethyloNumeroChiffre", numero.length > 3 ? tr("Info") : numero), texte);
    numeros.appendChild(lien);
  });

  liste.append(
    elementExtras("p", "extrasSousTitre", tr("Pour garder ton permis")),
    resultat, toi, quand, bu, numeros,
    elementExtras("p", "extrasNote", tr("Le vrai taux change d'une personne à l'autre : repas, fatigue, médicaments, santé.")),
    elementExtras("p", "extrasNote", tr("L'abus d'alcool est dangereux pour la santé, buvez avec modération. C'est vrai qu'il est pas souvent là en soirée mais c'est vraiment un chic type, c'est un tigre, un maestrom, un chevalier du zodiaque, un dragan du crépuscule, le café bien chaud qui t'apaise le matin bigoulet 😘")));
  maj();
}
// #endregion

// #region Flèche « remonter » de l'écran des Règles (Règles, Bar, Éthylotest, album, FAQ)
// La même que celle du plateau (#btnRemonter, js/plateau.js), mais pour cet écran, qui défile à part. Pas un <button> : les thèmes
// à néon dessinent un cadre autour de chaque bouton. Remontée animée ici : le défilement « smooth » s'arrête en route sur iPhone.
(() => {
  const page = document.getElementById("ecranRegles");
  if (!page) return;
  const fleche = document.createElement("div");
  fleche.id = "btnRemonterRegles";
  fleche.setAttribute("role", "button");
  fleche.setAttribute("aria-label", tr("Remonter en haut"));
  fleche.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  document.body.appendChild(fleche);
  const majFleche = () => fleche.classList.toggle("visible",
    page.style.display !== "none" && !page.classList.contains("page-sortie") && page.scrollTop > 400);
  page.addEventListener("scroll", majFleche, { passive: true });
  if (window.MutationObserver) new MutationObserver(majFleche).observe(page, { attributes: true, attributeFilter: ["class", "style"] });
  let enCours = null, auDoigtA = 0;
  // Sur iPhone, un élan de défilement encore en cours (doigt levé en plein mouvement) continue après la remontée et redescend la page.
  // Pendant la remontée l'écran est donc bloqué (« overflow: hidden » coupe l'élan), puis on garde le haut de page 0,4 s de plus.
  const arreter = () => {
    if (enCours) { cancelAnimationFrame(enCours); enCours = null; }
    page.style.overflowY = "";
  };
  const remonter = () => {
    cancelAnimationFrame(enCours);
    const depart = page.scrollTop;
    if (depart <= 0) return;
    page.style.overflowY = "hidden";
    const debut = performance.now(), duree = Math.min(650, 250 + depart / 8);
    let fin = 0;
    const etape = (maintenant) => {
      const avance = Math.min(1, (maintenant - debut) / duree);
      page.scrollTop = Math.round(depart * Math.pow(1 - avance, 3)); // rapide au début, en douceur à l'arrivée
      if (avance >= 1 && !fin) fin = maintenant;
      if (!fin || maintenant - fin < 400) { enCours = requestAnimationFrame(etape); return; }
      arreter();
      page.scrollTop = 0;
    };
    enCours = requestAnimationFrame(etape);
  };
  fleche.addEventListener("touchstart", (e) => {
    if (e.cancelable) e.preventDefault();
    auDoigtA = Date.now();
    jouerSon("bouton");
    remonter();
  }, { passive: false });
  fleche.addEventListener("click", () => { if (Date.now() - auDoigtA > 800) remonter(); });
  // (un doigt posé ailleurs arrête la remontée)
  page.addEventListener("touchstart", arreter, { passive: true });
})();
// #endregion

// #region Cartes de l'accueil (Bar, Album, Éthylotest)
// Une main de cartes à jouer sous les deux boutons de l'accueil (style_alcuno.css : « Cartes de l'accueil »). Ce ne sont pas
// des <button> : ceux de l'accueil ont une forme imposée par chaque thème.
//  - doigt posé : la carte sous le doigt sort un peu de la main, grossit, s'éclaire et s'incline ; les autres s'écartent,
//    s'enfoncent et s'assombrissent ;
//  - doigt glissé de côté, sans lever : l'éventail suit le doigt en continu (entre deux cartes, les deux sont à moitié sorties) ;
//  - doigt avancé vers le haut : la carte suit, jusqu'à une sortie maximale (elle résiste en approchant du maximum) ;
//    doigt levé quand elle est assez sortie : elle est jouée (elle monte et grandit en s'effaçant, les autres retombent),
//    puis sa page s'ouvre ; doigt reculé avant de le lever : la carte revient dans l'éventail et rien n'est joué ;
//  - simple tap (doigt levé sans avoir bougé) : la carte est jouée ;
//  - clavier : Entrée ou Espace ;
//  - en revenant sur l'accueil, la main est redistribuée.
// Tant qu'un doigt est posé (et jusqu'au retour au repos), les cartes sont animées ici, image par image, par des ressorts :
// chaque valeur (sortie, écart, inclinaison, zoom, lumière) rejoint sa cible en douceur, et le transform est écrit
// directement sur la carte (classe « vivante » : les transitions CSS sont coupées, sinon elles se relanceraient à chaque
// mouvement du doigt). Au repos, tout est rendu au CSS.
const DELAI_CARTE_JOUEE = 380;   // ms entre la carte jouée et l'ouverture de sa page
const INCLINAISON_CARTE = 14;    // degrés au plus sous le doigt
const LEVE_TENUE = 0.16;         // la carte sous le doigt sort de 16 % de sa hauteur…
const LEVE_AUTRES = 0.05;        // … les autres s'enfoncent de 5 %
const ZOOM_TENUE = 0.08;         // … elle grossit de 8 %
const ECART_VOISINES = 4;        // degrés : les voisines s'écartent de la carte tenue
const LUM_TENUE = 1.08, LUM_AUTRES = 0.8, LUM_PRETE = 1.25; // lumière : carte tenue, autres cartes, carte prête à être jouée
const ZONE_MORTE_TIRE = 8;       // px : le doigt doit monter de plus que ça avant que la carte le suive
const TIRE_MAX = 0.4;            // tirée au plus de 40 % de sa hauteur (en plus des 16 %) : la carte ne sort jamais davantage
const TIRE_PRETE = 0.24;         // tirée de 24 % : elle sera jouée au lâcher
const TIRE_VERROU = 0.1;         // tirée de plus de 10 % : glisser de côté ne change plus de carte (déverrouillée sous 5 %)
const mainAccueil = document.getElementById("cartesAccueil");
const calmeAccueil = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const actionsCartes = new Map(); // carte => ce qu'elle ouvre
let eventail = null;             // animation en cours : { cartes: [{ el, cx, angle, v, vit }], h, l, pas, doigt, choisie, verrou, prete, t, raf }
let ignorerClicCarte = 0;

function cartesVisibles(){
  return mainAccueil ? Array.from(mainAccueil.querySelectorAll(".carteAccueil")).filter((c) => c.offsetParent) : [];
}
// Rend les cartes au CSS (fin de l'animation au doigt)
function lacherEventail(){
  if (!eventail) return;
  cancelAnimationFrame(eventail.raf);
  eventail.cartes.forEach((c) => { c.el.style.transform = ""; c.el.style.filter = ""; c.el.style.zIndex = ""; c.el.classList.remove("tenue", "prete"); });
  eventail = null;
  mainAccueil.classList.remove("vivante");
}
// Redonne la main (après une carte jouée, ou à l'arrivée sur l'accueil)
function distribuerMain(){
  if (!mainAccueil) return;
  lacherEventail();
  mainAccueil.classList.remove("enJeu", "distribution");
  mainAccueil.querySelectorAll(".carteAccueil").forEach((c) => c.classList.remove("jouee"));
  void mainAccueil.offsetWidth; // (relance l'animation)
  mainAccueil.classList.add("distribution");
}
function jouerCarte(carte, action){
  if (mainAccueil.classList.contains("enJeu")) return; // (déjà une carte jouée)
  lacherEventail(); // (la carte part de là où elle est : la transition CSS de « jouee » prend le relais)
  mainAccueil.classList.remove("distribution");
  mainAccueil.classList.add("enJeu");
  carte.classList.add("jouee");
  tic(12);
  setTimeout(() => {
    action();
    // (la page recouvre l'accueil : la main est remise en place derrière, sans qu'on la voie)
    setTimeout(() => { if (mainAccueil.classList.contains("enJeu")) { mainAccueil.classList.remove("enJeu"); carte.classList.remove("jouee"); } }, 700);
  }, calmeAccueil() ? 0 : DELAI_CARTE_JOUEE);
}

// ----- Éventail animé au doigt -----
const REPOS_CARTE = { leve: 0, ecart: 0, tire: 0, rx: 0, ry: 0, zoom: 1, lum: 1 };
const SEUIL_REPOS = { leve: 0.002, ecart: 0.05, tire: 0.3, rx: 0.1, ry: 0.1, zoom: 0.002, lum: 0.005 }; // (écart négligeable)
const borneCarte = (v, min, max) => Math.max(min, Math.min(max, v));
function creerEventail(){
  const cartes = cartesVisibles();
  if (!cartes.length) return null;
  const h = cartes[0].offsetHeight, l = cartes[0].offsetWidth, r = mainAccueil.getBoundingClientRect();
  // Centre de chaque carte au repos, calculé (pas mesuré : une carte peut être en plein mouvement) : les cartes tournent
  // autour d'un pivot placé 2 hauteurs de carte sous leur centre (transform-origin du CSS)
  const liste = cartes.map((el) => {
    const angle = parseFloat(getComputedStyle(el).getPropertyValue("--angle")) || 0;
    return { el, angle, cx: r.left + l / 2 + 2 * h * Math.sin(angle * Math.PI / 180), v: Object.assign({}, REPOS_CARTE), vit: { leve: 0, ecart: 0, tire: 0, rx: 0, ry: 0, zoom: 0, lum: 0 }, cible: null };
  });
  const pas = liste.length > 1 ? (liste[liste.length - 1].cx - liste[0].cx) / (liste.length - 1) : l;
  return { cartes: liste, h, l, pas: Math.max(1, pas), doigt: null, choisie: null, verrou: false, prete: false, t: 0, raf: 0 };
}
// Où chaque carte doit aller, d'après le doigt
function viserEventail(m){
  const d = m.doigt;
  if (!d) { m.cartes.forEach((c) => { c.cible = REPOS_CARTE; }); return; }
  const dy = d.y - d.y0, h = m.h;
  // sortie de la carte tirée : suit le doigt, puis résiste et plafonne à TIRE_MAX
  const monte = Math.max(0, -dy - ZONE_MORTE_TIRE), max = TIRE_MAX * h;
  const tire = max * Math.tanh(monte / max);
  if (tire > TIRE_VERROU * h) m.verrou = true; else if (tire < TIRE_VERROU * h / 2) m.verrou = false;
  // poids de chaque carte : 1 sous le doigt, 0 à une carte de distance (continu : entre deux cartes, moitié-moitié)
  const x = borneCarte(d.x, m.cartes[0].cx, m.cartes[m.cartes.length - 1].cx);
  if (!m.verrou || !m.choisie) {
    let meilleure = null;
    m.cartes.forEach((c) => {
      const p = borneCarte(1 - Math.abs(x - c.cx) / m.pas, 0, 1);
      c.poids = p * p * (3 - 2 * p); // (départ et arrivée en douceur)
      if (!meilleure || c.poids > meilleure.poids) meilleure = c;
    });
    if (meilleure !== m.choisie) {
      if (m.choisie) { m.choisie.el.classList.remove("tenue", "prete"); tic(5); } // (tic léger : le doigt passe sur une autre carte)
      m.choisie = meilleure; m.prete = false;
      meilleure.el.classList.add("tenue");
    }
  } else m.cartes.forEach((c) => { c.poids = c === m.choisie ? 1 : 0; });
  const prete = tire >= TIRE_PRETE * h;
  if (prete !== m.prete) {
    m.prete = prete;
    m.choisie.el.classList.toggle("prete", prete);
    if (prete) tic(12);
  }
  const xEcart = m.verrou ? m.choisie.cx : x;
  m.cartes.forEach((c) => {
    const p = c.poids, tenue = c === m.choisie;
    c.cible = {
      leve: -LEVE_TENUE * p + LEVE_AUTRES * (1 - p),
      ecart: borneCarte((c.cx - xEcart) / m.pas, -1, 1) * ECART_VOISINES,
      tire: tenue ? -tire : 0,
      rx: tenue ? borneCarte(-dy / h, -1, 1) * INCLINAISON_CARTE * p : 0,
      ry: tenue ? borneCarte((d.x - c.cx) / m.l, -1, 1) * INCLINAISON_CARTE * p : 0,
      zoom: 1 + ZOOM_TENUE * p,
      lum: tenue && prete ? LUM_PRETE : LUM_AUTRES + (LUM_TENUE - LUM_AUTRES) * p,
    };
    c.el.style.zIndex = tenue ? "4" : "";
  });
}
function animerEventail(t){
  const m = eventail;
  if (!m) return;
  const dt = Math.min(0.034, m.t ? (t - m.t) / 1000 : 0.016);
  m.t = t;
  viserEventail(m);
  const calme = calmeAccueil();
  let auRepos = !m.doigt;
  m.cartes.forEach((c) => {
    for (const k in c.cible) {
      // ressort : raide pour ce qui suit le doigt (tirage, inclinaison), plus souple pour le reste (léger rebond au retour)
      const raide = m.doigt && (k === "tire" || k === "rx" || k === "ry");
      const K = raide ? 900 : 300, D = raide ? 54 : 26;
      if (calme) { c.v[k] = c.cible[k]; c.vit[k] = 0; }
      else {
        c.vit[k] += ((c.cible[k] - c.v[k]) * K - c.vit[k] * D) * dt;
        c.v[k] += c.vit[k] * dt;
      }
      if (Math.abs(c.cible[k] - c.v[k]) > SEUIL_REPOS[k] || Math.abs(c.vit[k]) > SEUIL_REPOS[k] * 20) auRepos = false;
    }
    const v = c.v, h = m.h;
    // (même suite de transformations que dans le CSS, pour que les transitions CSS reprennent sans à-coup)
    c.el.style.transform = `translateY(${v.tire.toFixed(2)}px) rotate(${(c.angle + v.ecart).toFixed(3)}deg) translateY(${(v.leve * h).toFixed(2)}px) `
      + `translateY(${-2 * h}px) rotateX(${v.rx.toFixed(2)}deg) rotateY(${v.ry.toFixed(2)}deg) scale(${v.zoom.toFixed(4)}) translateY(${2 * h}px)`;
    c.el.style.filter = Math.abs(v.lum - 1) < 0.005 ? "" : `brightness(${v.lum.toFixed(3)})`;
  });
  if (auRepos) { lacherEventail(); return; }
  m.raf = requestAnimationFrame(animerEventail);
}
function finAppuiMain(jouer){
  const m = eventail;
  if (!m || !m.doigt) return;
  const carte = m.choisie && m.choisie.el;
  m.doigt = null; m.verrou = false; m.prete = false;
  m.cartes.forEach((c) => { c.el.classList.remove("tenue", "prete"); c.el.style.zIndex = ""; });
  m.choisie = null;
  ignorerClicCarte = Date.now();
  if (jouer && carte) jouerCarte(carte, actionsCartes.get(carte)); // (sinon l'animation ramène les cartes au repos)
}
if (mainAccueil) {
  mainAccueil.addEventListener("pointermove", (e) => {
    const d = eventail && eventail.doigt;
    if (!d || e.pointerId !== d.id) return;
    d.x = e.clientX; d.y = e.clientY; // (seulement noté : c'est l'animation qui en tient compte, une fois par image)
    if (Math.abs(d.x - d.x0) > 10 || Math.abs(d.y - d.y0) > 10) d.bouge = true;
  });
  mainAccueil.addEventListener("pointerup", (e) => {
    const d = eventail && eventail.doigt;
    if (!d || e.pointerId !== d.id) return;
    d.x = e.clientX; d.y = e.clientY;
    viserEventail(eventail); // (position du doigt au moment exact du lâcher)
    finAppuiMain(!d.bouge || eventail.prete); // (tap, ou carte assez sortie)
  });
  mainAccueil.addEventListener("pointercancel", () => finAppuiMain(false));
  mainAccueil.addEventListener("lostpointercapture", () => finAppuiMain(false));
}

function activerCarteAccueil(id, action){
  const carte = document.getElementById(id);
  if (!carte || !mainAccueil) return;
  actionsCartes.set(carte, action);
  carte.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || (eventail && eventail.doigt) || mainAccueil.classList.contains("enJeu")) return;
    // (cartes encore en train de revenir : l'animation en cours continue, sans à-coup)
    if (!eventail) { eventail = creerEventail(); if (!eventail) return; mainAccueil.classList.add("vivante"); eventail.raf = requestAnimationFrame(animerEventail); }
    eventail.doigt = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, bouge: false };
    // (le doigt est suivi par toute la main : il peut passer d'une carte à l'autre)
    try { mainAccueil.setPointerCapture(e.pointerId); } catch (err) {}
    viserEventail(eventail);
  });
  // (un clic sans doigt ni souris : lecteur d'écran, commande vocale)
  carte.addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    if (Date.now() - ignorerClicCarte < 800) return;
    jouerCarte(carte, action);
  });
  carte.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    jouerCarte(carte, action);
  });
}
activerCarteAccueil("btnBarAccueil", ouvrirBar);
activerCarteAccueil("btnEthyloAccueil", ouvrirEthylo);
activerCarteAccueil("btnAlbumAccueil", ouvrirAlbum); // (js/stickers.js ne pose plus son tap)
(() => {
  if (!mainAccueil) return;
  // Deux cartes ou trois : la main se resserre ou s'ouvre selon que l'album est découvert (classe « troisCartes »)
  const zoneAlbum = document.getElementById("albumAccueil");
  const compter = () => mainAccueil.classList.toggle("troisCartes", !!zoneAlbum && !zoneAlbum.hidden);
  compter();
  if (!window.MutationObserver) { mainAccueil.classList.add("distribution"); return; }
  if (zoneAlbum) new MutationObserver(compter).observe(zoneAlbum, { attributes: true, attributeFilter: ["hidden"] });
  // Main redistribuée quand l'accueil réapparaît (retour d'une partie) ou quand la page ouverte par une carte se referme
  distribuerMain();
  const accueil = document.getElementById("choixMode");
  let accueilVisible = accueil && accueil.style.display !== "none";
  if (accueil) new MutationObserver(() => {
    const v = accueil.style.display !== "none";
    if (v && !accueilVisible) distribuerMain();
    accueilVisible = v;
  }).observe(accueil, { attributes: true, attributeFilter: ["style"] });
  const regles = document.getElementById("ecranRegles");
  if (regles) new MutationObserver(() => {
    if (regles.classList.contains("page-sortie") && !regles._mainRedonnee) { regles._mainRedonnee = true; distribuerMain(); }
    if (!regles.classList.contains("page-sortie")) regles._mainRedonnee = false;
  }).observe(regles, { attributes: true, attributeFilter: ["class"] });
})();
// #endregion
