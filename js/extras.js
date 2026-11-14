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

const EMOJIS_BAR = { rhum: "🍹", vodka: "🍸", gin: "🌿", tequila: "🌵", whisky: "🥃", bulles: "🥂", shooter: "🔥", sans: "🧃" };

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
  zone.appendChild(elementExtras("p", "barCompte", trouves.length + (trouves.length > 1 ? " recettes" : " recette")));
  FAMILLES_BAR.forEach(([id, nom]) => {
    const liste = trouves.filter((c) => c.g === id);
    if (!liste.length) return;
    const bloc = elementExtras("div", "blocRegles blocFaq");
    bloc.appendChild(elementExtras("h3", "", EMOJIS_BAR[id] + " " + nom));
    liste.forEach((c) => {
      const d = elementExtras("details", "faqItem");
      d.name = "cocktail"; // (une seule recette ouverte à la fois, sur les téléphones récents)
      d.setAttribute("name", "cocktail");
      d.dataset.cocktail = c.n;
      const titre = elementExtras("summary", "nomRegle faqQuestion", c.n);
      titre.appendChild(elementExtras("span", "barSous", `${c.i.length} ingrédients · ${c.v}`));
      d.appendChild(titre);
      const corps = elementExtras("div", "detailRegle barRecette");
      const ingredients = elementExtras("ul", "lignesRegle");
      c.i.forEach((ligne) => ingredients.appendChild(elementExtras("li", "", ligne)));
      corps.append(ingredients, elementExtras("p", "", c.p), elementExtras("p", "barVerre", "🍸 " + c.v));
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
  champ.placeholder = "Cocktail ou ingrédient";
  champ.setAttribute("aria-label", "Chercher un cocktail ou un ingrédient");
  champ.autocomplete = "off";
  champ.enterKeyHint = "search";
  champ.value = rechercheBar;

  const filtres = elementExtras("div", "extrasPuces");
  filtres.setAttribute("role", "group");
  filtres.setAttribute("aria-label", "Famille de cocktails");
  const zone = elementExtras("div", "barListe");
  const choisirFamille = (id) => {
    familleBar = id;
    filtres.querySelectorAll(".extrasPuce").forEach((p) => p.setAttribute("aria-pressed", String(p.dataset.famille === id)));
    remplirListeBar(zone);
  };
  [["", "Tous"]].concat(FAMILLES_BAR).forEach(([id, nom]) => {
    const puce = elementExtras("button", "extrasPuce", (id ? EMOJIS_BAR[id] + " " : "") + nom);
    puce.type = "button";
    puce.dataset.famille = id;
    puce.setAttribute("aria-pressed", String(id === familleBar));
    puce.addEventListener("click", () => choisirFamille(id));
    filtres.appendChild(puce);
  });
  champ.addEventListener("input", () => { rechercheBar = champ.value; remplirListeBar(zone); });
  champ.addEventListener("keydown", (e) => { if (e.key === "Enter") champ.blur(); });

  liste.append(champ, filtres, zone, elementExtras("p", "extrasNote", "L'abus d'alcool est dangereux pour la santé : à consommer avec modération."));
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
  { id: "demi", nom: "Demi", cl: 25 },
  { id: "bouteille", nom: "Bouteille ou canette", court: "Bouteille", cl: 33 },
  { id: "pinte", nom: "Pinte", cl: 50 }
];
const DEGRE_BIERE_MIN = 2, DEGRE_BIERE_MAX = 14;
// Les autres verres : volume (cl) et degré fixes
const VERRES_ETHYLO = [
  { id: "vin", nom: "Verre de vin", detail: "12,5 cl, 12°", cl: 12.5, deg: 12 },
  { id: "bulles", nom: "Coupe de champagne", detail: "10 cl, 12°", cl: 10, deg: 12 },
  { id: "fort", nom: "Alcool fort ou cocktail", detail: "4 cl d'alcool à 40°", cl: 4, deg: 40 },
  { id: "shooter", nom: "Shooter", detail: "3 cl, 40°", cl: 3, deg: 40 }
];
// Grammes d'alcool pur : cl x 10 x degré / 100 x 0,8
function grammesAlcool(cl, deg){ return cl * 10 * deg / 100 * 0.8; }
const DUREE_MAX_ETHYLO = 16 * 60; // premier verre : jusqu'à 16 h avant maintenant
// Numéros d'urgence en France (appel gratuit) et ligne d'écoute
const NUMEROS_UTILES = [
  ["112", "Urgences", "Numéro d'urgence, partout en Europe"],
  ["15", "SAMU", "Urgence médicale : quelqu'un qui ne se réveille plus, qui respire mal"],
  ["18", "Pompiers", "Accident, personne en danger"],
  ["17", "Police, gendarmerie", "Danger, agression, accident de la route"],
  ["114", "Urgences par SMS", "Pour les personnes sourdes ou malentendantes"],
  ["0980980930", "Alcool info service", "0 980 980 930 : écoute anonyme, appel non surtaxé, tous les jours de 8 h à 2 h"]
];

let ethylo = { poids: 70, sexe: "h", probatoire: false, verres: {}, bieres: {}, degBiere: 5, debut: 120, dernier: 30 }; // (debut, dernier : il y a tant de minutes)
try {
  const garde = JSON.parse(localStorage.getItem(CLE_ETHYLO) || "null");
  if (garde && typeof garde === "object") {
    if (Number(garde.poids) >= 35 && Number(garde.poids) <= 200) ethylo.poids = Math.min(POIDS_MAX_ETHYLO, Math.max(POIDS_MIN_ETHYLO, Math.round(Number(garde.poids))));
    if (garde.sexe === "f" || garde.sexe === "h") ethylo.sexe = garde.sexe;
    ethylo.probatoire = garde.probatoire === true;
  }
} catch (e) {}
function garderEthylo(){
  try { localStorage.setItem(CLE_ETHYLO, JSON.stringify({ poids: ethylo.poids, sexe: ethylo.sexe, probatoire: ethylo.probatoire })); } catch (e) {}
}
function texteDegre(deg){ return String(deg).replace(".", ",") + "°"; }

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
  return h ? `${h} h${m ? " " + String(m).padStart(2, "0") : ""}` : `${m} min`;
}
// « vers 3 h 45 (dans 2 h 10) », arrondi au quart d'heure d'après
function texteHeureEthylo(minutes){
  const dans = Math.ceil(minutes / 15) * 15;
  const d = new Date(Date.now() + dans * 60000);
  const demain = d.getDate() !== new Date().getDate();
  return `vers ${d.getHours()} h ${String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, "0")}${demain ? " demain" : ""} (dans ${texteDureeEthylo(dans)})`;
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
    taux.append(elementExtras("span", "ethyloChiffre"), elementExtras("span", "ethyloUnite", "g/L de sang, estimé"));
    const jauge = elementExtras("div", "ethyloJauge");
    jauge.setAttribute("aria-hidden", "true");
    jauge.append(elementExtras("div", "ethyloJaugePlein"), elementExtras("div", "ethyloJaugeLimite"));
    zone.append(taux, jauge, elementExtras("p", "ethyloVerdict"), elementExtras("div", "ethyloLignes"));
  }
  const chiffre = zone.querySelector(".ethyloChiffre");
  const texteTaux = r.taux.toFixed(2).replace(".", ",");
  if (chiffre.textContent !== texteTaux) { chiffre.textContent = texteTaux; popEthylo(chiffre); }
  const echelle = Math.max(limite * 2, r.taux * 1.1); // (la limite au milieu de la jauge, tant que le taux ne déborde pas)
  zone.querySelector(".ethyloJaugePlein").style.width = Math.min(100, r.taux / echelle * 100) + "%";
  zone.querySelector(".ethyloJaugeLimite").style.left = (limite / echelle * 100) + "%";
  const texteLimite = `${String(limite).replace(".", ",")} g/L${ethylo.probatoire ? " (permis probatoire)" : ""}`;
  const verdict = zone.querySelector(".ethyloVerdict"), lignes = zone.querySelector(".ethyloLignes");
  lignes.textContent = "";
  const ligne = (texte) => lignes.appendChild(elementExtras("p", "ethyloLigne", texte));
  if (r.taux >= limite) {
    verdict.textContent = "Tu ne conduis pas.";
    ligne(`Au-dessus de la limite de ${texteLimite}.`);
    ligne(`Sous la limite ${texteHeureEthylo(r.sousLimite)}, à zéro ${texteHeureEthylo(r.zero)}, si tu ne bois plus rien.`);
  } else if (r.taux > 0) {
    verdict.textContent = "Sous la limite d'après l'estimation, mais pas à zéro.";
    ligne(`Limite : ${texteLimite}. Tes réflexes sont déjà diminués : le plus sûr est d'attendre zéro, ${texteHeureEthylo(r.zero)}.`);
  } else {
    verdict.textContent = "Estimation : zéro.";
    ligne("D'après ce que tu as indiqué, l'alcool est éliminé. Seul un éthylotest peut le confirmer.");
  }
  if (ethylo.dernier < 45 && r.taux > 0) ligne("Dernier verre récent : ton taux peut encore monter pendant près d'une heure.");
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
    if (o.estPalier && o.estPalier(v) && v !== dernierPalier) { try { if (navigator.vibrate) navigator.vibrate(6); } catch (e) {} }
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
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}

// sansSon : écran redessiné (« Tout remettre à zéro »), sans rejouer le son d'ouverture
function ouvrirEthylo(sansSon){
  if (sansSon !== true) jouerSon("cartes");
  ouvrirPageExtras("ethylo", "Éthylotest");
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
  // (paliers : attiré par les multiples de 5 à 1 kg près ; graduations tous les 5 kg, en grand tous les 10, chiffrées tous les 20)
  const graduationsPoids = [];
  for (let v = POIDS_MIN_ETHYLO; v <= POIDS_MAX_ETHYLO; v += 5) graduationsPoids.push({ v, grand: v % 10 === 0, texte: v % 20 === 0 ? String(v) : "" });
  const poids = glissiereEthylo("Poids", POIDS_MIN_ETHYLO, POIDS_MAX_ETHYLO, 1, ethylo.poids, (v) => v + " kg",
    (v) => { ethylo.poids = v; garderEthylo(); maj(); },
    { aimant: (v) => (Math.abs(v - Math.round(v / 5) * 5) <= 1 ? Math.round(v / 5) * 5 : v), estPalier: (v) => v % 5 === 0, graduations: graduationsPoids });
  const ligneProbatoire = elementExtras("label", "ethyloLigneChamp");
  const caseProbatoire = elementExtras("input");
  caseProbatoire.type = "checkbox";
  caseProbatoire.checked = ethylo.probatoire;
  caseProbatoire.addEventListener("change", () => { ethylo.probatoire = caseProbatoire.checked; garderEthylo(); maj(); });
  ligneProbatoire.append(caseProbatoire, elementExtras("span", "nomRegle", "Permis probatoire"), elementExtras("span", "detailRegle", "limite à 0,2 g/L"));
  toi.append(ligneSexe, poids.ligne, ligneProbatoire);

  // --- Ce que tu as bu ---
  const bu = elementExtras("div", "blocRegles ethyloBloc");
  bu.appendChild(elementExtras("h3", "", "Ce que tu as bu"));
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
    compteur.append(bouton("−", "Un de moins", -1), nombre, bouton("+", "Un de plus", 1));
    ligne.append(texte, compteur);
    montrer(false);
    return { ligne, montrer, sous };
  };
  const borner = (n) => Math.min(30, Math.max(0, n));

  // Bières : le degré se règle au curseur ; les compteurs montrent les bières de CE degré, les étiquettes dessous toutes les bières
  bu.appendChild(elementExtras("p", "ethyloSousTitre", "Bières"));
  const etiquettes = elementExtras("div", "ethyloBieres");
  etiquettes.setAttribute("aria-label", "Bières comptées (toucher pour en retirer une)");
  let lignesBiere = [];
  const cleBiere = (f) => f.id + "@" + ethylo.degBiere;
  const majBieres = () => {
    lignesBiere.forEach((l, k) => { l.sous.textContent = `${FORMATS_BIERE[k].cl} cl à ${texteDegre(ethylo.degBiere)}`; l.montrer(false); });
    etiquettes.textContent = "";
    Object.keys(ethylo.bieres).sort().forEach((cle) => {
      const [id, deg] = cle.split("@");
      const format = FORMATS_BIERE.find((f) => f.id === id);
      if (!format || !ethylo.bieres[cle]) return;
      const e = elementExtras("button", "extrasPuce", `${ethylo.bieres[cle]} × ${format.court || format.nom} ${texteDegre(deg)}  ✕`);
      e.type = "button";
      e.setAttribute("aria-label", `Retirer : ${format.nom} à ${texteDegre(deg)}`);
      e.addEventListener("click", () => {
        ethylo.bieres[cle] = borner(ethylo.bieres[cle] - 1);
        if (!ethylo.bieres[cle]) delete ethylo.bieres[cle];
        majBieres(); maj();
      });
      etiquettes.appendChild(e);
    });
  };
  // (paliers : chaque degré entier, en grand à 5° et 10° ; les demi-degrés restent possibles entre deux)
  const graduationsDegre = [];
  for (let v = DEGRE_BIERE_MIN; v <= DEGRE_BIERE_MAX; v++) graduationsDegre.push({ v, grand: v % 5 === 0, texte: v % 2 === 0 ? v + "°" : "" });
  const degre = glissiereEthylo("Degré de la bière", DEGRE_BIERE_MIN, DEGRE_BIERE_MAX, 0.5, ethylo.degBiere, texteDegre,
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
  bu.appendChild(elementExtras("p", "detailRegle ethyloAide", "Plusieurs bières différentes ? Règle le degré, ajoute, puis recommence pour la suivante."));
  majBieres();

  bu.appendChild(elementExtras("p", "ethyloSousTitre", "Le reste"));
  VERRES_ETHYLO.forEach((v) => {
    bu.appendChild(ligneCompteur(v.nom, v.detail, () => ethylo.verres[v.id] || 0,
      (pas) => { ethylo.verres[v.id] = borner((ethylo.verres[v.id] || 0) + pas); }).ligne);
  });

  // --- Quand --- : deux curseurs indépendants sur une même frise (à gauche : il y a 16 h, à droite : maintenant), qui
  // donnent l'heure de l'horloge du téléphone. Attirés par les heures et les demi-heures (à 7 min près), sinon de 5 en 5 min.
  // (si le « dernier » est mis avant le « premier », le calcul les remet simplement dans l'ordre)
  const quand = elementExtras("div", "blocRegles ethyloBloc");
  quand.appendChild(elementExtras("h3", "", "Quand"));
  quand.appendChild(elementExtras("p", "detailRegle ethyloAide",
    "Glisse vers la droite pour plus récent. Premier verre : quand tu as commencé ; dernier verre : quand tu as fini (tout à droite si tu bois encore)."));
  const minuteDe = (t) => DUREE_MAX_ETHYLO - t; // (position du curseur => il y a tant de minutes)
  const aimantHeure = (t) => {
    const ilYa = minuteDe(t);
    if (ilYa <= 3) return DUREE_MAX_ETHYLO; // (tout à droite : maintenant)
    const heure = new Date(Date.now() - ilYa * 60000), m = heure.getMinutes();
    const versDemi = Math.round(m / 30) * 30 - m;            // vers l'heure ou la demi-heure la plus proche
    const decalage = Math.abs(versDemi) <= 7 ? versDemi : Math.round(m / 5) * 5 - m; // sinon, de 5 en 5 minutes
    return t + decalage;
  };
  const estDemiHeure = (t) => minuteDe(t) > 0 && new Date(Date.now() - minuteDe(t) * 60000).getMinutes() % 30 === 0;
  const graduationsHeures = () => {
    const g = [], maintenant = new Date();
    const debut = new Date(maintenant.getTime() - DUREE_MAX_ETHYLO * 60000);
    let d = new Date(debut); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
    for (; d <= maintenant; d = new Date(d.getTime() + 30 * 60000)) {
      const t = DUREE_MAX_ETHYLO - (maintenant - d) / 60000, pleine = d.getMinutes() === 0;
      g.push({ v: t, grand: pleine, texte: pleine && d.getHours() % 2 === 0 ? d.getHours() + " h" : "" });
    }
    return g;
  };
  const texteQuand = (t) => {
    const ilYa = minuteDe(t);
    return ilYa <= 0 ? ["maintenant", ""] : [heureIlYa(ilYa), "il y a " + texteDureeEthylo(ilYa)];
  };
  const curseurQuand = (titre, cle) => glissiereEthylo(titre, 0, DUREE_MAX_ETHYLO, 1, DUREE_MAX_ETHYLO - Math.min(DUREE_MAX_ETHYLO, ethylo[cle]),
    texteQuand, (t) => { ethylo[cle] = minuteDe(t); maj(); }, { aimant: aimantHeure, estPalier: estDemiHeure, graduations: graduationsHeures });
  const premier = curseurQuand("Premier verre", "debut"), dernier = curseurQuand("Dernier verre", "dernier");
  quand.append(premier.ligne, dernier.ligne,
    elementExtras("p", "detailRegle ethyloAide", "Les verres sont comptés comme bus régulièrement entre les deux heures."));
  // (l'écran resté ouvert : les heures écrites suivent l'horloge)
  const minuterie = setInterval(() => {
    if (!quand.isConnected) { clearInterval(minuterie); return; }
    premier.redessiner(); dernier.redessiner(); maj();
  }, 60000);

  const remise = elementExtras("button", "btnFaqLien ethyloRemise", "Tout remettre à zéro");
  remise.type = "button";
  remise.addEventListener("click", () => { ethylo.verres = {}; ethylo.bieres = {}; ouvrirEthylo(true); });

  // --- Numéros utiles ---
  const numeros = elementExtras("div", "blocRegles ethyloBloc");
  numeros.appendChild(elementExtras("h3", "", "Numéros utiles"));
  NUMEROS_UTILES.forEach(([numero, nom, detail]) => {
    const lien = elementExtras("a", "ethyloNumero");
    lien.href = "tel:" + numero;
    lien.setAttribute("aria-label", `Appeler ${nom}`);
    const texte = elementExtras("div", "texteRegle");
    texte.append(elementExtras("span", "nomRegle", nom), elementExtras("span", "detailRegle", detail));
    lien.append(elementExtras("span", "ethyloNumeroChiffre", numero.length > 3 ? "Info" : numero), texte);
    numeros.appendChild(lien);
  });
  numeros.appendChild(elementExtras("p", "detailRegle ethyloAide",
    "Quelqu'un a trop bu et ne réagit plus ? Couche-le sur le côté, ne le laisse pas seul et appelle le 15."));

  liste.append(
    elementExtras("p", "extrasSousTitre", "Pour estimer quand tu pourras reprendre le volant sans risquer ton permis."),
    resultat, toi, bu, quand, remise, numeros, elementExtras("p", "extrasNote",
    "Estimation indicative (formule de Widmark, hypothèses prudentes). Le vrai taux change d'une personne à l'autre : repas, fatigue, " +
    "médicaments, santé. Seul un éthylotest fait foi. Dans le doute, ne prends pas le volant : dors sur place, fais-toi raccompagner ou prends un taxi."));
  maj();
}
// #endregion

// #region Cartes de l'accueil (Bar, Album, Éthylotest)
// Une main de cartes à jouer sous les deux boutons de l'accueil (style_alcuno.css : « Cartes de l'accueil »). Ce ne sont pas
// des <button> : ceux de l'accueil ont une forme imposée par chaque thème.
//  - doigt posé : la carte sort à moitié de la main, grossit et s'incline sous le doigt ; les voisines s'écartent ;
//  - doigt levé sans avoir bougé (un tap), ou carte tirée vers le haut : la carte est jouée (elle monte et grandit en
//    s'effaçant, les autres retombent), puis sa page s'ouvre ; doigt glissé ailleurs : la carte revient dans la main ;
//  - clavier : Entrée ou Espace ;
//  - en revenant sur l'accueil, la main est redistribuée.
const DELAI_CARTE_JOUEE = 380;   // ms entre la carte jouée et l'ouverture de sa page
const TIRAGE_CARTE = 0.4;        // tirée vers le haut de 40 % de sa hauteur : jouée
const INCLINAISON_CARTE = 14;    // degrés au plus sous le doigt
const mainAccueil = document.getElementById("cartesAccueil");
const calmeAccueil = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

function cartesVisibles(){
  return mainAccueil ? Array.from(mainAccueil.querySelectorAll(".carteAccueil")).filter((c) => c.offsetParent) : [];
}
// Redonne la main (après une carte jouée, ou à l'arrivée sur l'accueil)
function distribuerMain(){
  if (!mainAccueil) return;
  mainAccueil.classList.remove("enJeu", "tient", "distribution");
  mainAccueil.querySelectorAll(".carteAccueil").forEach((c) => {
    c.classList.remove("jouee", "tenue");
    ["--ecart", "--tire", "--rx", "--ry"].forEach((v) => c.style.removeProperty(v));
  });
  void mainAccueil.offsetWidth; // (relance l'animation)
  mainAccueil.classList.add("distribution");
}
function tenirCarte(carte, oui){
  const cartes = cartesVisibles(), k = cartes.indexOf(carte);
  mainAccueil.classList.toggle("tient", oui);
  carte.classList.toggle("tenue", oui);
  cartes.forEach((c, j) => { if (c !== carte) c.style.setProperty("--ecart", oui ? (j < k ? -4 : 4) + "deg" : "0deg"); });
  if (!oui) ["--tire", "--rx", "--ry"].forEach((v) => carte.style.removeProperty(v));
}
function jouerCarte(carte, action){
  if (mainAccueil.classList.contains("enJeu")) return; // (déjà une carte jouée)
  tenirCarte(carte, false);
  mainAccueil.classList.remove("distribution");
  mainAccueil.classList.add("enJeu");
  carte.classList.add("jouee");
  try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
  setTimeout(() => {
    action();
    // (la page recouvre l'accueil : la main est remise en place derrière, sans qu'on la voie)
    setTimeout(() => { if (mainAccueil.classList.contains("enJeu")) { mainAccueil.classList.remove("enJeu"); carte.classList.remove("jouee"); } }, 700);
  }, calmeAccueil() ? 0 : DELAI_CARTE_JOUEE);
}

function activerCarteAccueil(id, action){
  const carte = document.getElementById(id);
  if (!carte || !mainAccueil) return;
  let appui = null, ignorerClic = 0;
  const lacher = () => { if (appui) { appui = null; tenirCarte(carte, false); } };
  carte.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || mainAccueil.classList.contains("enJeu")) return;
    appui = { x: e.clientX, y: e.clientY, id: e.pointerId, bouge: false };
    try { carte.setPointerCapture(e.pointerId); } catch (err) {}
    tenirCarte(carte, true);
  });
  carte.addEventListener("pointermove", (e) => {
    if (!appui || e.pointerId !== appui.id) return;
    const dx = e.clientX - appui.x, dy = e.clientY - appui.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) appui.bouge = true;
    // inclinaison : la carte penche vers le doigt (mesurée sur la carte sans sa rotation)
    const h = carte.offsetHeight, l = carte.offsetWidth;
    const borne = (v) => Math.max(-1, Math.min(1, v));
    carte.style.setProperty("--ry", (borne(dx / l) * INCLINAISON_CARTE).toFixed(1) + "deg");
    carte.style.setProperty("--rx", (borne(-dy / h) * INCLINAISON_CARTE).toFixed(1) + "deg");
    carte.style.setProperty("--tire", Math.min(0, dy) + "px");
    if (dy < -h * TIRAGE_CARTE) { appui = null; ignorerClic = Date.now(); jouerCarte(carte, action); }
  });
  carte.addEventListener("pointerup", (e) => {
    if (!appui || e.pointerId !== appui.id) return;
    const tap = !appui.bouge;
    lacher();
    ignorerClic = Date.now();
    if (tap) jouerCarte(carte, action);
  });
  carte.addEventListener("pointercancel", lacher);
  carte.addEventListener("lostpointercapture", lacher);
  // (un clic sans doigt ni souris : lecteur d'écran, commande vocale)
  carte.addEventListener("click", (e) => {
    e.stopImmediatePropagation();
    if (Date.now() - ignorerClic < 800) return;
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
