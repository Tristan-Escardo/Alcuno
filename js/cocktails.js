// =============================================================================================
// ALCUNO : recettes du Bar (fichier commun au jeu, js/extras.js, et à la page privée stats.html, onglet Bar)
// Les recettes d'ici sont celles du jeu. Le pilotage (stats.html) peut en modifier, en masquer et en ajouter :
// c'est rangé dans Firebase sous config/bar (js/config-lib.js), et cocktailsBar(config) fait le mélange.
// =============================================================================================
// Recettes classiques, écrites pour le jeu (quantités en cl pour un verre, sauf mention). g : famille (filtre du haut).
const FAMILLES_BAR = ConfigLib.FAMILLES_BAR; // (js/config-lib.js : [id, nom], dans l'ordre d'affichage)
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

// Identifiant d'une recette du jeu : son nom sans accents (« Piña Colada » → « pina-colada »). Ne pas renommer une recette
// d'ici sans raison : ses modifications faites depuis le pilotage sont rangées sous cet identifiant.
function idCocktail(nom){
  return String(nom).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

// Les recettes à montrer : celles du jeu (remplacées par leur version modifiée s'il y en a une, sauf masquées), puis
// les recettes ajoutées. Chacune : { id, n, g, v, i: [lignes], p, jeu (vrai si recette du jeu), modifie, masque }.
// avecMasques : garde aussi les masquées (pour le pilotage).
function cocktailsBar(config, avecMasques){
  const bar = (config && config.bar) || {};
  const liste = [];
  COCKTAILS.forEach((c) => {
    const id = idCocktail(c.n), m = bar[id];
    if (m && m.x && !avecMasques) return;
    const base = { id, n: c.n, g: c.g, v: c.v, i: c.i.slice(), p: c.p, jeu: true, modifie: false, masque: !!(m && m.x) };
    if (m && m.n) Object.assign(base, { n: m.n, g: m.g, v: m.v, i: m.i.split("\n"), p: m.p, modifie: true });
    liste.push(base);
  });
  const ids = new Set(liste.map((c) => c.id));
  Object.keys(bar).sort().forEach((id) => {
    const m = bar[id];
    if (ids.has(id) || COCKTAILS.some((c) => idCocktail(c.n) === id) || !m.n) return;
    liste.push({ id, n: m.n, g: m.g, v: m.v, i: m.i.split("\n"), p: m.p, jeu: false, modifie: false, masque: false });
  });
  return liste;
}
