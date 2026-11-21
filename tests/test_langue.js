const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.resolve(__dirname, "..");
function chargerCatalogue(fichier, nom){
  const contexte = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(racine, "js", fichier), "utf8"), contexte);
  return contexte.window[nom];
}

const anglais = chargerCatalogue("en.js", "TEXTES_EN");
const espagnol = chargerCatalogue("es.js", "TEXTES_ES");
const italien = chargerCatalogue("it.js", "TEXTES_IT");
assert.ok(anglais && espagnol && italien, "les catalogues anglais, espagnol et italien doivent être chargés");
const politique = fs.readFileSync(path.join(racine, "confidentialite.html"), "utf8");
assert.ok(!politique.includes("En bref"), "la politique de confidentialité ne doit plus afficher le résumé « En bref »");

for(const [nom, catalogue] of [["espagnol", espagnol], ["italien", italien]]){
  assert.deepEqual(Object.keys(catalogue).sort(), Object.keys(anglais).sort(), `${nom} : les catalogues doivent couvrir les mêmes clés`);
  for(const [cle, traduction] of Object.entries(anglais)){
    assert.equal(typeof catalogue[cle], "string", `${nom} : traduction manquante : ${cle}`);
    assert.ok(catalogue[cle].trim(), `${nom} : traduction vide : ${cle}`);
    const variables = (texte) => (texte.match(/\{\d+\}/g) || []).sort();
    const variablesTraduction = variables(catalogue[cle]);
    // Chaque variable du texte français doit être reprise, sauf les marques de pluriel collées à un mot (« carte{1} » = « s »
    // ou rien) : une langue peut tourner la phrase autrement (« Cartas restantes: {0} »). Aucune variable inventée.
    const marquesPluriel = (cle.match(/[A-Za-zÀ-ÿ]\{\d+\}/g) || []).map(m => m.slice(1));
    assert.ok(variablesTraduction.every(v => variables(cle).includes(v)), `${nom} : variable absente du texte source : ${cle}`);
    assert.ok(variables(cle).filter(v => !marquesPluriel.includes(v)).every(v => variablesTraduction.includes(v)), `${nom} : variable manquante : ${cle}`);
  }
}

const clesDefis = [
  "Mes défis",
  "Ils sont gardés sur cet appareil et synchronisés avec Google si tu es connecté.",
  "Léger — moins de 5 gorgées",
  "Moyen — 5 à 10 gorgées",
  "Osé — plus de 10 gorgées",
  "Hard HA — préliminaires",
  "Hard HB — actes sexuels",
  "Exemple : Fais un compliment sincère à {nom}.",
  "Aperçu : ",
  "Aperçu : …",
  "Ajouter le défi",
  "Modifier",
  "Enregistrer",
  "Ouvrir",
  "Ajoute tes propres défis pour les modes hot et hard.",
  "Défis personnalisés",
  "Ajoute tes propres défis hot ou hard.",
  "Il manque le texte du défi.",
  "Défi trop long (160 caractères maximum).",
  "Accolades interdites : utilise uniquement {nom}, {nom1} ou {nom2}.",
  "Avec deux joueurs, utilise {nom1} et {nom2}.",
  "Choisis {nom} ou {nom1}/{nom2}, pas les deux.",
  "Le défi doit viser quelqu’un : ajoute {nom}, ou {nom1} et {nom2}.",
  "Choisis un niveau.",
  "version",
  "mouchard actif",
  "PIGEON",
  "défi personnalisé",
  "défis personnalisés"
];
for(const cle of clesDefis){
  assert.ok(anglais[cle] && espagnol[cle], `traduction du défi manquante : ${cle}`);
  assert.ok(italien[cle], `traduction italienne du défi manquante : ${cle}`);
}
for(const cle of ["Il est dans Réglages › Thèmes.", "Bravo, album complet !"]){
  assert.ok(anglais[cle] && espagnol[cle], `traduction de l'album manquante : ${cle}`);
  assert.ok(italien[cle], `traduction italienne de l'album manquante : ${cle}`);
}
// Politique de confidentialité : CHAQUE morceau de texte de la page doit être traduit dans les trois langues
// (même découpage que js/langue.js : texte nettoyé des espaces, sans script ni style)
const textesPolitique = politique
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
  .split(/<[^>]+>/).map((x) => x.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim())
  .filter((x) => x && x !== "Alcuno – Politique de confidentialité" && !/^[\w./:-]+$/.test(x)); // (les adresses, comme github.com/…, ne se traduisent pas ; le titre de l'onglet est traduit par le script de la page)
assert.ok(textesPolitique.length > 60, "la politique de confidentialité doit avoir tout son texte");
for(const cle of textesPolitique){
  assert.ok(anglais[cle], `traduction anglaise de confidentialité manquante : ${cle}`);
  assert.ok(espagnol[cle], `traduction espagnole de confidentialité manquante : ${cle}`);
  assert.ok(italien[cle], `traduction italienne de confidentialité manquante : ${cle}`);
}
for(const rubrique of ["introduction", "editeur", "donnees", "destinataires", "transferts", "securite", "cookies", "droits", "modifications"]){
  assert.ok(politique.includes(`id="${rubrique}"`), `la politique doit avoir la rubrique ${rubrique}`);
}
for(const mot of ["Défis personnalisés", "Compte Google", "Stockage sur votre appareil"]){
  assert.ok(politique.includes(mot), `la politique doit parler de : ${mot}`);
}

const document = {
  documentElement: { lang: "fr" },
  body: { querySelectorAll: () => [] },
  createTreeWalker: () => ({ nextNode: () => null }),
  querySelector: () => null,
  querySelectorAll: () => []
};
const contexte = vm.createContext({
  window: { TEXTES_ES: espagnol },
  localStorage: { getItem: () => "es" },
  document,
  NodeFilter: { SHOW_TEXT: 4 }
});
contexte.cleTest = Object.keys(espagnol)[0];
vm.runInContext(fs.readFileSync(path.join(racine, "js", "langue.js"), "utf8"), contexte);
assert.equal(vm.runInContext("LANGUE", contexte), "es");
assert.equal(document.documentElement.lang, "es");
assert.equal(vm.runInContext("tr(cleTest)", contexte), espagnol[contexte.cleTest]);
assert.equal(vm.runInContext('tr("clé inconnue")', contexte), "clé inconnue");
assert.equal(vm.runInContext('tr("PIGEON")', contexte), "PALOMA");
const sorbo = vm.runInContext('tr("gorgée")', contexte);
assert.equal(vm.runInContext('trPluriel(1, "gorgée")', contexte), `1 ${sorbo}`);
assert.equal(vm.runInContext('trPluriel(2, "gorgée")', contexte), `2 ${sorbo}s`);
assert.equal(vm.runInContext('trPluriel(0, "gorgée")', contexte), `0 ${sorbo}s`);
// pluriels espagnols : « sorbo » est masculin, « anulación » ne prend pas un simple « s »
assert.equal(vm.runInContext('tr`${"3 sorbos"} (${2} annulée${"s"})`', contexte), "3 sorbos (2 anulados)");
assert.equal(vm.runInContext('tr`${2} défi${"s"} relevé${"s"}`', contexte), "2 retos superados");
assert.equal(vm.runInContext('tr`Tu as ${2} annulation${"s"}.`', contexte), "Anulaciones disponibles: 2.");

const contexteItalien = vm.createContext({
  window: { TEXTES_IT: italien },
  localStorage: { getItem: () => "it" },
  document: {
    documentElement: { lang: "fr" },
    body: { querySelectorAll: () => [] },
    createTreeWalker: () => ({ nextNode: () => null }),
    querySelector: () => null,
    querySelectorAll: () => []
  },
  NodeFilter: { SHOW_TEXT: 4 }
});
contexteItalien.cleTest = Object.keys(italien)[0];
vm.runInContext(fs.readFileSync(path.join(racine, "js", "langue.js"), "utf8"), contexteItalien);
assert.equal(vm.runInContext("LANGUE", contexteItalien), "it");
assert.equal(contexteItalien.document.documentElement.lang, "it");
assert.equal(vm.runInContext("tr(cleTest)", contexteItalien), italien[contexteItalien.cleTest]);
assert.equal(vm.runInContext('tr("PIGEON")', contexteItalien), italien["PIGEON"]);
assert.equal(vm.runInContext('trPluriel(1, "gorgée")', contexteItalien), "1 sorso");
assert.equal(vm.runInContext('trPluriel(2, "gorgée")', contexteItalien), "2 sorsi");

const sourceLangue = fs.readFileSync(path.join(racine, "js", "langue.js"), "utf8");
assert.ok(sourceLangue.includes('jouerSon("bouton")'), "changement de langue : un son doit être joué");
assert.ok(sourceLangue.includes('pointerdown'), "changement de langue : le son doit partir à l'appui");
assert.ok(sourceLangue.includes('setTimeout(() =>'), "changement de langue : le rechargement doit laisser passer le son");

const sourceReglages = fs.readFileSync(path.join(racine, "js", "reglages.js"), "utf8");
assert.ok(sourceReglages.includes(".chipLangue"), "changement de langue : puce exclue du double clic sonore générique");
assert.ok(sourceReglages.includes("galaxie: SONS_SABRE"), "thème Star Wars : sons de sabre disponibles");
assert.ok(sourceReglages.includes("donjon: SONS_BDSM"), "thème BDSM : sons respectifs disponibles");
assert.ok(sourceReglages.includes("musique: SONS_SAXO"), "thème Fête de la musique : sons respectifs disponibles");
assert.equal(vm.runInContext('trPluriel(2, "recette")', contexteItalien), "2 ricette");
assert.equal(vm.runInContext('tr` gorgée${"s"}`', contexteItalien), " sorsi");
assert.equal(vm.runInContext('tr`Il reste ${2} carte${"s"}`', contexteItalien), "Carte rimaste: 2");
assert.equal(vm.runInContext('tr`Il reste ${1} carte${""}`', contexteItalien), "Carte rimaste: 1");
assert.equal(vm.runInContext('tr`${2} duel${"s"} gagné${"s"}`', contexteItalien), "2 duelli vinti");
assert.equal(vm.runInContext('tr`Tu as ${2} annulation${"s"}.`', contexteItalien), "Hai 2 annullamenti.");
assert.equal(italien["PIGEON"], "PICCIONE");
assert.equal(italien["Spectateur"], "Spettatore");
assert.equal(italien["1 c. à café de sucre"], "1 cucchiaino di zucchero");
assert.equal(italien["Mode en ligne"], "Modalità online");
assert.equal(italien["Ouvrir"], "Apri");
assert.ok(!italien["Envoi du mouchard…"].includes("cookie"));
assert.equal(anglais["Langues"], "Languages");
assert.equal(espagnol["Langues"], "Idiomas");
assert.equal(italien["Langues"], "Lingue");

console.log(`Langues espagnole et italienne : ${Object.keys(espagnol).length} / ${Object.keys(italien).length} traductions et runtimes vérifiés.`);
