// Mode daltonien : réglage, lettre de la couleur sur les faces (jamais sur une carte recachée), nom dans le choix de couleur, télé
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const page = lire("index.html"), css = lire("style_alcuno.css"), reglages = lire("js/reglages.js"), regles = lire("js/regles.js"), tele = lire("js/tele.js");
assert.ok(page.includes("Accessibilité pour les daltoniens 👁️") && page.includes('id="optionDaltonien"') && page.includes('data-cle="daltonien"'), "réglage Mode daltonien");
assert.ok(lire("js/reglages-vue.js").includes('"accessibilite", "daltonien"'), "rangé dans Affichage");
assert.ok(reglages.includes('es: { vert: "V", jaune: "AM", rouge: "R", bleu: "AZ" }'), "espagnol : amarillo / azul différenciés");
for (const c of ["vert", "jaune", "rouge", "bleu"]) assert.ok(css.includes(`html.daltonien .Carte[class*="_${c}"]:not(.dos_dore)::after{ content: var(--daltonien-${c}`), `lettre ${c}`);
assert.ok(css.includes("html.daltonien.faces-fermees #plateau .Carte.retournee.recachee::after{ content: none !important; }"), "pas de lettre sur une carte recachée");
assert.ok(regles.includes('nomCarre.className = "carre-couleur-nom"'), "nom dans les carrés du choix de couleur");
assert.ok(tele.includes('daltonien: document.documentElement.classList.contains("daltonien")') && tele.includes('classList.toggle("daltonien", !!etat.daltonien)'), "télé : mode du téléphone qui caste");
for (const l of ["en", "es", "it"]) {
  const t = lire(`js/${l}.js`);
  assert.ok(t.includes('"Accessibilité pour les daltoniens 👁️":') && t.includes('"La couleur écrite sur les cartes et dans le choix de couleur.":'), `traduction ${l}`);
}
console.log("Mode daltonien : réglage, lettres des cartes, choix de couleur et télé vérifiés.");
