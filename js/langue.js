// =============================================================================================
// ALCUNO : langue du jeu (français ou anglais). Chargé en tout premier (index.html, FICHIERS_JEU).
// Le français est écrit dans le code ; l'anglais est dans js/en.js (texte français -> texte anglais), chargé
// seulement quand le jeu est en anglais. tr("texte") ou tr`texte ${variable}` rend le texte dans la langue
// du jeu ; un texte absent de js/en.js reste en français. La langue se choisit dans Réglages > Langue : la
// page se recharge (les textes sont posés un peu partout au chargement).
// Ajouter un texte : l'écrire en français dans tr(...), puis ajouter sa traduction dans js/en.js
// (clé : le texte français, avec {0}, {1}… à la place des ${...}).
// =============================================================================================
const CLE_LANGUE = "alcuno_langue";
const LANGUE = (() => {
  try { return localStorage.getItem(CLE_LANGUE) === "en" ? "en" : "fr"; } catch (e) { return "fr"; }
})();
const TEXTES_LANGUE = (LANGUE === "en" && window.TEXTES_EN) || null;
const estAnglais = !!TEXTES_LANGUE;

// tr("Retour") -> "Back" ; tr`Tour de ${nom}` -> cherche « Tour de {0} »
function tr(a, ...valeurs){
  if (typeof a === "string") {
    if (!TEXTES_LANGUE) return a;
    const t = TEXTES_LANGUE[a];
    return t === undefined ? a : t;
  }
  if (TEXTES_LANGUE) {
    let cle = "";
    for (let i = 0; i < a.length; i++) cle += a[i] + (i < a.length - 1 ? "{" + i + "}" : "");
    const t = TEXTES_LANGUE[cle.replace(/\n[ \t]*/g, "\n")];
    if (t !== undefined) return t.replace(/\{(\d+)\}/g, (m, i) => (i < valeurs.length ? String(valeurs[i]) : m));
  }
  let texte = "";
  for (let i = 0; i < a.length; i++) texte += a[i] + (i < valeurs.length ? String(valeurs[i]) : "");
  return texte;
}

// « 3 gorgées », « 2 annulées » : le pluriel français ajoute un s ; en anglais le mot traduit décide
// (« cancelled » ne change pas)
const MOTS_INVARIABLES_EN = ["cancelled"];
function trPluriel(n, mot){
  const m = tr(mot);
  return `${n} ${m}${n > 1 && !(estAnglais && MOTS_INVARIABLES_EN.includes(m)) ? (estAnglais && /s$/.test(m) ? "es" : "s") : ""}`;
}

// Nombre à virgule : « 0,5 » en français, « 0.5 » en anglais
function trNombre(texte){ return estAnglais ? String(texte).replace(",", ".") : String(texte); }

// Textes fixes d'index.html : chaque morceau de texte et chaque attribut lisible (aria-label, placeholder, title, alt)
// est remplacé par sa traduction. Appelé au chargement (le jeu est en bas de page : tout le HTML est déjà là).
function traduireElement(racine){
  if (!TEXTES_LANGUE || !racine) return;
  const marcheur = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
  const noeuds = [];
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) noeuds.push(n);
  noeuds.forEach((n) => {
    const parent = n.parentElement;
    if (!parent || /^(SCRIPT|STYLE)$/.test(parent.tagName)) return;
    const brut = n.nodeValue, net = brut.replace(/\s+/g, " ").trim();
    if (!net) return;
    const t = TEXTES_LANGUE[net];
    if (t !== undefined) n.nodeValue = brut.replace(/^(\s*)[\s\S]*?(\s*)$/, (m, a, b) => a + t + b);
  });
  const ATTRIBUTS = ["aria-label", "placeholder", "title", "alt"];
  const elements = racine.querySelectorAll ? racine.querySelectorAll("[aria-label], [placeholder], [title], [alt]") : [];
  elements.forEach((e) => ATTRIBUTS.forEach((attr) => {
    const v = e.getAttribute(attr);
    if (!v) return;
    const t = TEXTES_LANGUE[v.trim()];
    if (t !== undefined) e.setAttribute(attr, t);
  }));
}
if (estAnglais) {
  document.documentElement.lang = "en";
  traduireElement(document.body);
}

// Réglages > Langue : on retient le choix et on recharge la page
function choisirLangue(langue){
  const nouvelle = langue === "en" ? "en" : "fr";
  if (nouvelle === LANGUE) return;
  try { localStorage.setItem(CLE_LANGUE, nouvelle); } catch (e) { return; }
  location.reload();
}
document.querySelectorAll(".chipLangue").forEach((chip) => {
  const active = chip.dataset.langue === LANGUE;
  chip.classList.toggle("actif", active);
  chip.setAttribute("aria-pressed", active ? "true" : "false");
  chip.addEventListener("click", () => choisirLangue(chip.dataset.langue));
});
