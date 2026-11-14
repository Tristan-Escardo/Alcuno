// =============================================================================================
// ALCUNO : Bar (recettes de cocktails) et Éthylo (estimation du taux d'alcool)
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
//
// Deux écrans à côté du jeu, ouverts par les cartes en éventail de l'accueil (index.html : #cartesAccueil ; la carte Album,
// js/stickers.js, est entre les deux une fois l'album découvert). Comme l'album et la FAQ, ils s'ouvrent dans l'écran des
// Règles (mêmes blocs, donc les couleurs de chaque thème) : classes « bar » / « ethylo » sur #ecranRegles.
// Tout est dans ce fichier : rien n'est téléchargé, les deux marchent hors connexion.
// =============================================================================================
// #region Bar : recettes de cocktails
// Recettes classiques, écrites pour le jeu (quantités en cl pour un verre, sauf mention). g : famille (filtre du haut).
const FAMILLES_BAR = [
  ["rhum", "Rhum"], ["vodka", "Vodka"], ["gin", "Gin"], ["tequila", "Tequila"], ["whisky", "Whisky"],
  ["bulles", "Bulles & apéro"], ["shooter", "Shooters"], ["sans", "Sans alcool"]
];
const COCKTAILS = [
  // ----- Rhum -----
  { n: "Mojito", g: "rhum", v: "Grand verre", i: ["5 cl de rhum blanc", "½ citron vert en quartiers", "2 c. à café de sucre de canne", "8 à 10 feuilles de menthe", "Eau gazeuse", "Glace pilée"],
    p: "Dans le verre, écrase doucement le citron vert, le sucre et la menthe. Remplis de glace pilée, verse le rhum, complète d'eau gazeuse et mélange." },
  { n: "Daiquiri", g: "rhum", v: "Verre à cocktail", i: ["6 cl de rhum blanc", "2 cl de jus de citron vert", "1,5 cl de sirop de sucre de canne"],
    p: "Secoue le tout au shaker avec des glaçons, puis filtre dans un verre bien froid." },
  { n: "Piña Colada", g: "rhum", v: "Grand verre", i: ["5 cl de rhum blanc", "3 cl de crème de coco", "5 cl de jus d'ananas", "Glace"],
    p: "Mixe (ou secoue fort au shaker) avec la glace jusqu'à ce que ce soit onctueux. Décore d'un morceau d'ananas." },
  { n: "Cuba Libre", g: "rhum", v: "Grand verre", i: ["5 cl de rhum", "12 cl de cola", "1 cl de jus de citron vert", "Glaçons"],
    p: "Verse le rhum et le citron vert sur les glaçons, complète de cola." },
  { n: "Ti-punch", g: "rhum", v: "Petit verre", i: ["5 cl de rhum agricole", "1 c. à café de sirop de canne", "1 petit quartier de citron vert"],
    p: "Presse le citron vert dans le verre, ajoute le sirop puis le rhum, et remue. Traditionnellement sans glace." },
  { n: "Mai Tai", g: "rhum", v: "Verre large", i: ["3 cl de rhum ambré", "3 cl de rhum blanc", "1,5 cl de curaçao orange", "1,5 cl de sirop d'orgeat", "3 cl de jus de citron vert"],
    p: "Secoue au shaker avec des glaçons, verse sur de la glace pilée. Décore de menthe." },
  { n: "Planteur", g: "rhum", v: "Grand verre", i: ["4 cl de rhum", "4 cl de jus d'orange", "4 cl de jus d'ananas", "1 cl de jus de citron vert", "1 cl de sirop de grenadine ou de canne", "1 pincée de cannelle ou de muscade"],
    p: "Mélange le tout avec des glaçons. Encore meilleur préparé à l'avance, en grande quantité, et gardé au frais." },
  { n: "Caïpirinha", g: "rhum", v: "Verre large", i: ["6 cl de cachaça", "1 citron vert en quartiers", "2 à 4 c. à café de sucre", "Glace pilée"],
    p: "Écrase le citron vert et le sucre dans le verre, remplis de glace pilée, verse la cachaça et mélange." },
  { n: "Dark 'n' Stormy", g: "rhum", v: "Grand verre", i: ["6 cl de rhum brun", "10 cl de ginger beer", "1 quartier de citron vert", "Glaçons"],
    p: "Verse la ginger beer sur les glaçons, puis le rhum par-dessus. Presse le citron vert." },
  // ----- Vodka -----
  { n: "Moscow Mule", g: "vodka", v: "Tasse en cuivre ou grand verre", i: ["4,5 cl de vodka", "12 cl de ginger beer", "1 cl de jus de citron vert", "Glaçons"],
    p: "Verse la vodka et le citron vert sur les glaçons, complète de ginger beer." },
  { n: "Cosmopolitan", g: "vodka", v: "Verre à cocktail", i: ["4 cl de vodka (au citron si possible)", "1,5 cl de triple sec", "1,5 cl de jus de citron vert", "3 cl de jus de cranberry"],
    p: "Secoue au shaker avec des glaçons, puis filtre dans un verre bien froid." },
  { n: "Sex on the Beach", g: "vodka", v: "Grand verre", i: ["4 cl de vodka", "2 cl de liqueur de pêche", "4 cl de jus d'orange", "4 cl de jus de cranberry", "Glaçons"],
    p: "Secoue au shaker (ou mélange dans le verre) et sers sur des glaçons." },
  { n: "Bloody Mary", g: "vodka", v: "Grand verre", i: ["4,5 cl de vodka", "9 cl de jus de tomate", "1,5 cl de jus de citron", "Quelques gouttes de sauce Worcestershire et de Tabasco", "Sel de céleri, poivre"],
    p: "Mélange doucement le tout avec des glaçons. Ajuste l'assaisonnement à ton goût." },
  { n: "White Russian", g: "vodka", v: "Verre large", i: ["5 cl de vodka", "2 cl de liqueur de café", "3 cl de crème liquide", "Glaçons"],
    p: "Verse la vodka et la liqueur de café sur les glaçons, puis la crème par-dessus." },
  { n: "Black Russian", g: "vodka", v: "Verre large", i: ["5 cl de vodka", "2 cl de liqueur de café", "Glaçons"],
    p: "Verse sur les glaçons et remue." },
  { n: "Espresso Martini", g: "vodka", v: "Verre à cocktail", i: ["5 cl de vodka", "3 cl de liqueur de café", "1 expresso serré", "1 cl de sirop de sucre"],
    p: "Secoue très fort au shaker avec des glaçons (c'est ce qui fait la mousse), puis filtre." },
  { n: "Vodka-orange", g: "vodka", v: "Grand verre", i: ["5 cl de vodka", "10 cl de jus d'orange", "Glaçons"],
    p: "Verse sur les glaçons et remue." },
  { n: "Blue Lagoon", g: "vodka", v: "Grand verre", i: ["4 cl de vodka", "3 cl de curaçao bleu", "2 cl de jus de citron", "Limonade (facultatif)", "Glaçons"],
    p: "Secoue vodka, curaçao et citron au shaker, verse sur des glaçons. Allonge de limonade si tu veux." },
  { n: "Long Island Iced Tea", g: "vodka", v: "Grand verre", i: ["1,5 cl de vodka", "1,5 cl de rhum blanc", "1,5 cl de gin", "1,5 cl de tequila", "1,5 cl de triple sec", "2,5 cl de jus de citron", "2 cl de sirop de sucre", "Cola", "Glaçons"],
    p: "Verse tous les alcools, le citron et le sirop sur les glaçons, complète d'un trait de cola et remue. Très chargé : il compte pour plusieurs verres." },
  // ----- Gin -----
  { n: "Gin tonic", g: "gin", v: "Grand verre", i: ["5 cl de gin", "10 à 15 cl de tonic", "1 rondelle de citron", "Glaçons"],
    p: "Verse le gin sur beaucoup de glaçons, complète de tonic bien frais." },
  { n: "Negroni", g: "gin", v: "Verre large", i: ["3 cl de gin", "3 cl de Campari", "3 cl de vermouth rouge", "1 zeste d'orange"],
    p: "Remue le tout sur des glaçons, directement dans le verre." },
  { n: "Tom Collins", g: "gin", v: "Grand verre", i: ["4,5 cl de gin", "3 cl de jus de citron", "1,5 cl de sirop de sucre", "6 cl d'eau gazeuse", "Glaçons"],
    p: "Mélange gin, citron et sirop sur les glaçons, complète d'eau gazeuse." },
  { n: "Gin Fizz", g: "gin", v: "Grand verre", i: ["4,5 cl de gin", "3 cl de jus de citron", "1 cl de sirop de sucre", "8 cl d'eau gazeuse"],
    p: "Secoue gin, citron et sirop au shaker avec des glaçons, filtre dans le verre et complète d'eau gazeuse." },
  { n: "Dry Martini", g: "gin", v: "Verre à cocktail", i: ["6 cl de gin", "1 cl de vermouth dry", "1 olive ou 1 zeste de citron"],
    p: "Remue sur des glaçons dans un verre à mélange, puis filtre dans un verre bien froid." },
  { n: "French 75", g: "gin", v: "Flûte", i: ["3 cl de gin", "1,5 cl de jus de citron", "1 cl de sirop de sucre", "6 cl de champagne"],
    p: "Secoue gin, citron et sirop au shaker, filtre dans la flûte et complète de champagne." },
  { n: "Bramble", g: "gin", v: "Verre large", i: ["5 cl de gin", "2,5 cl de jus de citron", "1 cl de sirop de sucre", "1,5 cl de crème de mûre", "Glace pilée"],
    p: "Secoue gin, citron et sirop, verse sur la glace pilée, puis fais couler la crème de mûre par-dessus." },
  // ----- Tequila -----
  { n: "Margarita", g: "tequila", v: "Verre à cocktail, bord salé", i: ["5 cl de tequila", "2 cl de triple sec", "1,5 cl de jus de citron vert", "Sel pour le bord du verre"],
    p: "Passe un quartier de citron sur le bord du verre et trempe-le dans le sel. Secoue le reste au shaker avec des glaçons et filtre." },
  { n: "Tequila Sunrise", g: "tequila", v: "Grand verre", i: ["4,5 cl de tequila", "9 cl de jus d'orange", "1,5 cl de sirop de grenadine", "Glaçons"],
    p: "Verse la tequila et le jus d'orange sur les glaçons, puis la grenadine doucement : elle descend au fond. Ne remue pas." },
  { n: "Paloma", g: "tequila", v: "Grand verre", i: ["5 cl de tequila", "10 cl de soda au pamplemousse", "1 trait de jus de citron vert", "1 pincée de sel", "Glaçons"],
    p: "Verse la tequila, le citron vert et le sel sur les glaçons, complète de soda." },
  // ----- Whisky -----
  { n: "Whisky Sour", g: "whisky", v: "Verre large", i: ["4,5 cl de bourbon", "2,5 cl de jus de citron", "2 cl de sirop de sucre", "½ blanc d'œuf (facultatif)"],
    p: "Secoue fort au shaker avec des glaçons, filtre sur de la glace. Le blanc d'œuf donne la mousse." },
  { n: "Old Fashioned", g: "whisky", v: "Verre large", i: ["4,5 cl de bourbon ou de rye", "1 morceau de sucre", "2 traits d'Angostura", "1 trait d'eau", "1 zeste d'orange"],
    p: "Dissous le sucre avec l'Angostura et l'eau dans le verre. Ajoute de gros glaçons, le whisky, et remue longuement." },
  { n: "Manhattan", g: "whisky", v: "Verre à cocktail", i: ["5 cl de rye ou de bourbon", "2 cl de vermouth rouge", "1 trait d'Angostura", "1 cerise"],
    p: "Remue sur des glaçons dans un verre à mélange, filtre dans un verre bien froid." },
  { n: "Mint Julep", g: "whisky", v: "Gobelet ou verre large", i: ["6 cl de bourbon", "4 brins de menthe", "1 c. à café de sucre", "2 c. à café d'eau", "Glace pilée"],
    p: "Écrase doucement la menthe avec le sucre et l'eau, remplis de glace pilée, verse le bourbon et remue jusqu'à ce que le verre givre." },
  { n: "Irish Coffee", g: "whisky", v: "Verre à pied résistant au chaud", i: ["5 cl de whiskey irlandais", "12 cl de café chaud", "1 c. à café de sucre", "5 cl de crème légèrement fouettée"],
    p: "Dissous le sucre dans le café chaud, ajoute le whiskey, puis dépose la crème sur le dos d'une cuillère pour qu'elle flotte." },
  { n: "Whisky-coca", g: "whisky", v: "Grand verre", i: ["4 cl de whisky", "12 cl de cola", "Glaçons"],
    p: "Verse sur les glaçons et remue." },
  // ----- Bulles & apéro -----
  { n: "Spritz", g: "bulles", v: "Verre à vin", i: ["9 cl de prosecco", "6 cl d'Aperol", "3 cl d'eau gazeuse", "1 rondelle d'orange", "Glaçons"],
    p: "Sur beaucoup de glaçons : le prosecco, l'Aperol, puis l'eau gazeuse. La règle : 3, 2, 1." },
  { n: "Kir", g: "bulles", v: "Verre à vin", i: ["1 cl de crème de cassis", "9 cl de vin blanc sec bien frais"],
    p: "Verse la crème de cassis, puis le vin blanc. Avec du champagne ou un crémant, c'est un kir royal." },
  { n: "Mimosa", g: "bulles", v: "Flûte", i: ["7,5 cl de champagne", "7,5 cl de jus d'orange"],
    p: "Verse le jus d'orange bien frais, puis le champagne doucement." },
  { n: "Bellini", g: "bulles", v: "Flûte", i: ["10 cl de prosecco", "5 cl de purée de pêche blanche"],
    p: "Verse la purée de pêche, puis le prosecco doucement, et remue à peine." },
  { n: "Hugo", g: "bulles", v: "Verre à vin", i: ["15 cl de prosecco", "2 cl de sirop de fleur de sureau", "Eau gazeuse", "Menthe, rondelle de citron vert", "Glaçons"],
    p: "Sur les glaçons : le sirop, la menthe, le prosecco, puis un trait d'eau gazeuse." },
  { n: "Americano", g: "bulles", v: "Verre large", i: ["3 cl de Campari", "3 cl de vermouth rouge", "Eau gazeuse", "1 rondelle d'orange", "Glaçons"],
    p: "Verse le Campari et le vermouth sur les glaçons, complète d'un trait d'eau gazeuse." },
  { n: "Monaco", g: "bulles", v: "Verre à bière", i: ["1 cl de sirop de grenadine", "8 cl de limonade", "16 cl de bière blonde"],
    p: "Verse la grenadine, la limonade, puis la bière bien fraîche." },
  { n: "Picon bière", g: "bulles", v: "Verre à bière", i: ["3 cl de Picon", "25 cl de bière blonde"],
    p: "Verse le Picon, puis la bière bien fraîche par-dessus." },
  { n: "Sangria (pour 6)", g: "bulles", v: "Pichet", i: ["75 cl de vin rouge", "2 oranges et 1 citron en rondelles", "50 g de sucre", "5 cl de liqueur d'orange ou de cognac (facultatif)", "1 bâton de cannelle", "25 cl de limonade"],
    p: "Mélange tout sauf la limonade et laisse reposer au frais quelques heures. Ajoute la limonade et des glaçons au moment de servir." },
  // ----- Shooters -----
  { n: "B-52", g: "shooter", v: "Verre à shooter", i: ["2 cl de liqueur de café", "2 cl de crème de whisky", "2 cl de liqueur d'orange"],
    p: "Verse dans cet ordre, très doucement, sur le dos d'une cuillère : les trois couches restent séparées." },
  { n: "Kamikaze", g: "shooter", v: "2 verres à shooter", i: ["2 cl de vodka", "2 cl de triple sec", "2 cl de jus de citron vert"],
    p: "Secoue au shaker avec des glaçons et filtre dans les verres." },
  { n: "Tequila paf", g: "shooter", v: "Petit verre solide", i: ["3 cl de tequila", "3 cl de tonic ou de limonade"],
    p: "Couvre le verre de la main, frappe-le une fois sur la table (sans casser le verre) et bois pendant que ça mousse." },
  { n: "Jägerbomb", g: "shooter", v: "Verre à shooter + grand verre", i: ["2 cl de Jägermeister", "12 cl de boisson énergisante"],
    p: "Verse la boisson énergisante dans le grand verre, puis laisse tomber le shooter dedans." },
  // ----- Sans alcool -----
  { n: "Virgin Mojito", g: "sans", v: "Grand verre", i: ["½ citron vert en quartiers", "2 c. à café de sucre de canne", "8 à 10 feuilles de menthe", "Eau gazeuse ou limonade", "Glace pilée"],
    p: "Comme un mojito, sans le rhum : écrase citron vert, sucre et menthe, remplis de glace pilée et complète." },
  { n: "Virgin Colada", g: "sans", v: "Grand verre", i: ["10 cl de jus d'ananas", "4 cl de crème de coco", "Glace"],
    p: "Mixe (ou secoue fort au shaker) avec la glace jusqu'à ce que ce soit onctueux." },
  { n: "Shirley Temple", g: "sans", v: "Grand verre", i: ["2 cl de sirop de grenadine", "15 cl de ginger ale ou de limonade", "1 cerise", "Glaçons"],
    p: "Verse la grenadine sur les glaçons, complète et remue doucement." },
  { n: "Cendrillon", g: "sans", v: "Grand verre", i: ["5 cl de jus d'orange", "5 cl de jus d'ananas", "2 cl de jus de citron", "1 cl de sirop de grenadine", "Eau gazeuse", "Glaçons"],
    p: "Secoue les jus et la grenadine au shaker, verse sur les glaçons et complète d'un trait d'eau gazeuse." }
];

// Sans accents ni majuscules, pour la recherche (« pina » trouve « Piña Colada »)
function simplifierTexteBar(texte){
  return String(texte).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

let familleBar = "";   // filtre choisi ("" : tous)
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

function remplirListeBar(zone){
  zone.textContent = "";
  const cherche = simplifierTexteBar(rechercheBar.trim());
  const trouves = COCKTAILS.filter((c) => (!familleBar || c.g === familleBar) &&
    (!cherche || simplifierTexteBar(c.n + " " + c.i.join(" ")).includes(cherche)));
  if (!trouves.length) {
    const vide = elementExtras("div", "blocRegles");
    vide.appendChild(elementExtras("p", "detailRegle extrasVide", "Aucun cocktail ne correspond."));
    zone.appendChild(vide);
    return;
  }
  FAMILLES_BAR.forEach(([id, nom]) => {
    const liste = trouves.filter((c) => c.g === id);
    if (!liste.length) return;
    const bloc = elementExtras("div", "blocRegles blocFaq");
    bloc.appendChild(elementExtras("h3", "", nom));
    liste.forEach((c) => {
      const d = elementExtras("details", "faqItem");
      d.appendChild(elementExtras("summary", "nomRegle faqQuestion", c.n));
      const corps = elementExtras("div", "detailRegle barRecette");
      const ingredients = elementExtras("ul", "lignesRegle");
      c.i.forEach((ligne) => ingredients.appendChild(elementExtras("li", "", ligne)));
      corps.append(ingredients, elementExtras("p", "", c.p), elementExtras("p", "barVerre", "Verre : " + c.v));
      d.appendChild(corps);
      bloc.appendChild(d);
    });
    zone.appendChild(bloc);
  });
}

function ouvrirBar(){
  jouerSon("cartes");
  ouvrirPageExtras("bar", "Le Bar");
  const liste = document.getElementById("listeRegles");

  const champ = elementExtras("input", "extrasChamp");
  champ.type = "search";
  champ.placeholder = "Chercher un cocktail ou un ingrédient";
  champ.setAttribute("aria-label", "Chercher un cocktail ou un ingrédient");
  champ.autocomplete = "off";
  champ.enterKeyHint = "search";
  champ.value = rechercheBar;

  const filtres = elementExtras("div", "extrasPuces");
  filtres.setAttribute("role", "group");
  filtres.setAttribute("aria-label", "Famille de cocktails");
  const zone = elementExtras("div", "barListe");
  [["", "Tous"]].concat(FAMILLES_BAR).forEach(([id, nom]) => {
    const puce = elementExtras("button", "extrasPuce", nom);
    puce.type = "button";
    puce.setAttribute("aria-pressed", String(id === familleBar));
    puce.addEventListener("click", () => {
      familleBar = id;
      filtres.querySelectorAll(".extrasPuce").forEach((p) => p.setAttribute("aria-pressed", String(p === puce)));
      remplirListeBar(zone);
    });
    filtres.appendChild(puce);
  });
  champ.addEventListener("input", () => { rechercheBar = champ.value; remplirListeBar(zone); });
  champ.addEventListener("keydown", (e) => { if (e.key === "Enter") champ.blur(); });

  liste.append(champ, filtres, zone, elementExtras("p", "extrasNote", "L'abus d'alcool est dangereux pour la santé : à consommer avec modération."));
  remplirListeBar(zone);
}
// #endregion

// #region Éthylo : estimation du taux d'alcool
// Une ESTIMATION, jamais une mesure : seul un éthylotest dit vrai. Formule de Widmark : grammes d'alcool pur bus, divisés par
// (poids x coefficient de diffusion : 0,7 pour un homme, 0,6 pour une femme) = g d'alcool par litre de sang ; le corps en élimine
// ensuite de 0,10 à 0,15 g/L par heure. Tout est choisi du côté prudent : élimination la plus lente (0,10), chaque verre compté
// d'un coup dès qu'il est bu, heures arrondies au quart d'heure d'après. Et l'écran ne dit jamais « tu peux conduire ».
// Limites en France : 0,5 g/L de sang ; 0,2 g/L en permis probatoire.
const CLE_ETHYLO = "alcuno_ethylo"; // { poids, sexe, probatoire } : gardé dans le téléphone, jamais envoyé
const ELIMINATION_PAR_HEURE = 0.10;
const LIMITE_ALCOOL = 0.5, LIMITE_PROBATOIRE = 0.2;
// Verres : volume (cl) et degré => grammes d'alcool pur (cl x 10 x degré / 100 x 0,8)
const VERRES_ETHYLO = [
  { id: "demi", nom: "Demi de bière", detail: "25 cl, 5°", cl: 25, deg: 5 },
  { id: "pinte", nom: "Pinte de bière", detail: "50 cl, 5°", cl: 50, deg: 5 },
  { id: "forte", nom: "Bière forte", detail: "33 cl, 8°", cl: 33, deg: 8 },
  { id: "vin", nom: "Verre de vin", detail: "12,5 cl, 12°", cl: 12.5, deg: 12 },
  { id: "bulles", nom: "Coupe de champagne", detail: "10 cl, 12°", cl: 10, deg: 12 },
  { id: "fort", nom: "Alcool fort ou cocktail", detail: "4 cl d'alcool à 40°", cl: 4, deg: 40 },
  { id: "shooter", nom: "Shooter", detail: "3 cl, 40°", cl: 3, deg: 40 }
];
function grammesVerre(v){ return v.cl * 10 * v.deg / 100 * 0.8; }

let ethylo = { poids: 70, sexe: "h", probatoire: false, verres: {}, debut: 120, dernier: 30 }; // (debut, dernier : il y a tant de minutes)
try {
  const garde = JSON.parse(localStorage.getItem(CLE_ETHYLO) || "null");
  if (garde && typeof garde === "object") {
    if (Number(garde.poids) >= 35 && Number(garde.poids) <= 200) ethylo.poids = Math.round(Number(garde.poids));
    if (garde.sexe === "f" || garde.sexe === "h") ethylo.sexe = garde.sexe;
    ethylo.probatoire = garde.probatoire === true;
  }
} catch (e) {}
function garderEthylo(){
  try { localStorage.setItem(CLE_ETHYLO, JSON.stringify({ poids: ethylo.poids, sexe: ethylo.sexe, probatoire: ethylo.probatoire })); } catch (e) {}
}

// Calcul, minute par minute : les verres sont répartis régulièrement entre le premier et le dernier ; à chaque minute le taux
// baisse (jamais sous 0). Renvoie le taux de maintenant et dans combien de minutes il passe sous la limite, puis à zéro.
function calculerEthylo(e, limite){
  const hausses = []; // g/L ajoutés par chaque verre
  VERRES_ETHYLO.forEach((v) => {
    for (let k = 0; k < (e.verres[v.id] || 0); k++) hausses.push(grammesVerre(v) / (e.poids * (e.sexe === "f" ? 0.6 : 0.7)));
  });
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
  return h ? `${h} h${m ? " " + String(m).padStart(2, "0") : ""}` : `${m} min`;
}
// « vers 3 h 45 (dans 2 h 10) », arrondi au quart d'heure d'après
function texteHeureEthylo(minutes){
  const dans = Math.ceil(minutes / 15) * 15;
  const d = new Date(Date.now() + dans * 60000);
  const demain = d.getDate() !== new Date().getDate();
  return `vers ${d.getHours()} h ${String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, "0")}${demain ? " demain" : ""} (dans ${texteDureeEthylo(dans)})`;
}

function majResultatEthylo(zone){
  const limite = ethylo.probatoire ? LIMITE_PROBATOIRE : LIMITE_ALCOOL;
  const r = calculerEthylo(ethylo, limite);
  zone.textContent = "";
  zone.dataset.etat = r.verres === 0 ? "vide" : r.taux >= limite ? "rouge" : r.taux > 0 ? "orange" : "zero";
  const texteLimite = `${String(limite).replace(".", ",")} g/L${ethylo.probatoire ? " (permis probatoire)" : ""}`;
  if (r.verres === 0) {
    zone.appendChild(elementExtras("p", "ethyloVerdict", "Ajoute ce que tu as bu."));
    return;
  }
  const taux = elementExtras("div", "ethyloTaux");
  taux.append(elementExtras("span", "ethyloChiffre", r.taux.toFixed(2).replace(".", ",")), elementExtras("span", "ethyloUnite", "g/L de sang, estimé"));
  zone.appendChild(taux);
  if (r.taux >= limite) {
    zone.appendChild(elementExtras("p", "ethyloVerdict", "Tu ne conduis pas."));
    zone.appendChild(elementExtras("p", "ethyloLigne", `Au-dessus de la limite de ${texteLimite}.`));
    zone.appendChild(elementExtras("p", "ethyloLigne", `Sous la limite ${texteHeureEthylo(r.sousLimite)}, à zéro ${texteHeureEthylo(r.zero)}, si tu ne bois plus rien.`));
  } else if (r.taux > 0) {
    zone.appendChild(elementExtras("p", "ethyloVerdict", "Sous la limite d'après l'estimation, mais pas à zéro."));
    zone.appendChild(elementExtras("p", "ethyloLigne", `Limite : ${texteLimite}. Tes réflexes sont déjà diminués : le plus sûr est d'attendre zéro, ${texteHeureEthylo(r.zero)}.`));
  } else {
    zone.appendChild(elementExtras("p", "ethyloVerdict", "Estimation : zéro."));
    zone.appendChild(elementExtras("p", "ethyloLigne", "D'après ce que tu as indiqué, l'alcool est éliminé. Seul un éthylotest peut le confirmer."));
  }
  if (ethylo.dernier < 45 && r.taux > 0) zone.appendChild(elementExtras("p", "ethyloLigne", "Dernier verre récent : ton taux peut encore monter pendant près d'une heure."));
}

// sansSon : écran redessiné (« Tout remettre à zéro »), sans rejouer le son d'ouverture
function ouvrirEthylo(sansSon){
  if (sansSon !== true) jouerSon("cartes");
  ouvrirPageExtras("ethylo", "Éthylo");
  const liste = document.getElementById("listeRegles");
  const resultat = elementExtras("div", "blocRegles ethyloResultat");
  resultat.setAttribute("role", "status");
  const maj = () => majResultatEthylo(resultat);

  // --- Toi ---
  const toi = elementExtras("div", "blocRegles ethyloBloc");
  toi.appendChild(elementExtras("h3", "", "Toi"));
  const ligneSexe = elementExtras("div", "extrasPuces");
  ligneSexe.setAttribute("role", "group");
  ligneSexe.setAttribute("aria-label", "Sexe (change le calcul)");
  [["h", "Homme"], ["f", "Femme"]].forEach(([id, nom]) => {
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
  const lignePoids = elementExtras("label", "ethyloLigneChamp");
  const champPoids = elementExtras("input", "extrasChamp ethyloPoids");
  champPoids.type = "number"; champPoids.inputMode = "numeric"; champPoids.min = "35"; champPoids.max = "200";
  champPoids.value = String(ethylo.poids);
  champPoids.addEventListener("input", () => {
    const p = Math.round(Number(champPoids.value));
    if (p >= 35 && p <= 200) { ethylo.poids = p; garderEthylo(); maj(); }
  });
  champPoids.addEventListener("blur", () => { champPoids.value = String(ethylo.poids); });
  champPoids.addEventListener("keydown", (e) => { if (e.key === "Enter") champPoids.blur(); });
  lignePoids.append(elementExtras("span", "nomRegle", "Poids"), champPoids, elementExtras("span", "detailRegle", "kg"));
  const ligneProbatoire = elementExtras("label", "ethyloLigneChamp");
  const caseProbatoire = elementExtras("input");
  caseProbatoire.type = "checkbox";
  caseProbatoire.checked = ethylo.probatoire;
  caseProbatoire.addEventListener("change", () => { ethylo.probatoire = caseProbatoire.checked; garderEthylo(); maj(); });
  ligneProbatoire.append(caseProbatoire, elementExtras("span", "nomRegle", "Permis probatoire"), elementExtras("span", "detailRegle", "limite à 0,2 g/L"));
  toi.append(ligneSexe, lignePoids, ligneProbatoire);

  // --- Ce que tu as bu ---
  const bu = elementExtras("div", "blocRegles ethyloBloc");
  bu.appendChild(elementExtras("h3", "", "Ce que tu as bu"));
  VERRES_ETHYLO.forEach((v) => {
    const ligne = elementExtras("div", "ligneRegle ethyloVerre");
    const texte = elementExtras("div", "texteRegle");
    texte.append(elementExtras("span", "nomRegle", v.nom), elementExtras("span", "detailRegle", v.detail));
    const compteur = elementExtras("div", "ethyloCompteur");
    const nombre = elementExtras("span", "ethyloNombre", String(ethylo.verres[v.id] || 0));
    nombre.setAttribute("aria-live", "polite");
    const bouton = (signe, libelle, pas) => {
      const b = elementExtras("button", "ethyloPas", signe);
      b.type = "button";
      b.setAttribute("aria-label", `${libelle} : ${v.nom}`);
      b.addEventListener("click", () => {
        ethylo.verres[v.id] = Math.min(30, Math.max(0, (ethylo.verres[v.id] || 0) + pas));
        nombre.textContent = String(ethylo.verres[v.id]);
        ligne.classList.toggle("ethyloChoisi", ethylo.verres[v.id] > 0);
        maj();
      });
      return b;
    };
    compteur.append(bouton("−", "Un de moins", -1), nombre, bouton("+", "Un de plus", 1));
    ligne.classList.toggle("ethyloChoisi", (ethylo.verres[v.id] || 0) > 0);
    ligne.append(texte, compteur);
    bu.appendChild(ligne);
  });

  // --- Quand ---
  const quand = elementExtras("div", "blocRegles ethyloBloc");
  quand.appendChild(elementExtras("h3", "", "Quand"));
  const choixDuree = (titre, cle, valeurs) => {
    const ligne = elementExtras("label", "ethyloLigneChamp");
    const liste = elementExtras("select", "extrasChamp");
    valeurs.forEach((m) => {
      const o = elementExtras("option", "", m === 0 ? "à l'instant" : "il y a " + texteDureeEthylo(m));
      o.value = String(m);
      liste.appendChild(o);
    });
    liste.value = String(ethylo[cle]);
    liste.addEventListener("change", () => { ethylo[cle] = Number(liste.value); maj(); });
    ligne.append(elementExtras("span", "nomRegle", titre), liste);
    return ligne;
  };
  const heures = (de, a, pas) => { const t = []; for (let m = de; m <= a; m += pas) t.push(m); return t; };
  quand.append(
    choixDuree("Premier verre", "debut", [15, 30, 45].concat(heures(60, 360, 30), heures(420, 1440, 60))),
    choixDuree("Dernier verre", "dernier", [0, 15, 30, 45].concat(heures(60, 360, 30), heures(420, 1440, 60))),
    elementExtras("p", "detailRegle ethyloAide", "Les verres sont comptés comme répartis régulièrement entre les deux.")
  );

  const remise = elementExtras("button", "btnFaqLien ethyloRemise", "Tout remettre à zéro");
  remise.type = "button";
  remise.addEventListener("click", () => { ethylo.verres = {}; ouvrirEthylo(true); });

  liste.append(resultat, toi, bu, quand, remise, elementExtras("p", "extrasNote",
    "Estimation indicative (formule de Widmark, hypothèses prudentes). Le vrai taux change d'une personne à l'autre : repas, fatigue, " +
    "médicaments, santé. Seul un éthylotest fait foi. Dans le doute, ne prends pas le volant : dors sur place, fais-toi raccompagner ou prends un taxi."));
  maj();
}
// #endregion

// #region Cartes de l'accueil (Bar, Album, Éthylo)
// Des cartes à jouer en éventail sous les deux boutons de l'accueil. Ce ne sont pas des <button> : ceux de l'accueil ont une
// forme imposée par chaque thème. Un tap, ou Entrée / Espace au clavier.
function activerCarteAccueil(id, action){
  const carte = document.getElementById(id);
  if (!carte) return;
  carte.addEventListener("click", action);
  carte.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    action();
  });
}
activerCarteAccueil("btnBarAccueil", ouvrirBar);
activerCarteAccueil("btnEthyloAccueil", ouvrirEthylo);
// (carte Album : son tap est posé par js/stickers.js ; ici, seulement le clavier)
(() => {
  const album = document.getElementById("btnAlbumAccueil");
  if (album) album.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); album.click(); } });
})();
// #endregion
