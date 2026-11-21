// =============================================================================================
// ALCUNO : langue du jeu (français, anglais, espagnol ou italien). Chargé en tout premier (index.html, FICHIERS_JEU).
// Le français est écrit dans le code ; les autres langues sont dans js/en.js, js/es.js et js/it.js (texte français -> traduction), chargées
// seulement quand elle est choisie. tr("texte") ou tr`texte ${variable}` rend le texte dans la langue
// du jeu ; un texte absent du dictionnaire reste en français. La langue se choisit dans Réglages > Langue : la
// page se recharge (les textes sont posés un peu partout au chargement).
// Ajouter un texte : l'écrire en français dans tr(...), puis ajouter sa traduction dans les dictionnaires anglais, espagnol et italien
// (clé : le texte français, avec {0}, {1}… à la place des ${...}).
// =============================================================================================
const CLE_LANGUE = "alcuno_langue";
const LANGUE = (() => {
  try { const l = localStorage.getItem(CLE_LANGUE); return l === "en" || l === "es" || l === "it" ? l : "fr"; } catch (e) { return "fr"; }
})();
const TEXTES_LANGUE = (LANGUE === "en" && window.TEXTES_EN) || (LANGUE === "es" && window.TEXTES_ES) || (LANGUE === "it" && window.TEXTES_IT) || null;
const estAnglais = LANGUE === "en";
const estEspanol = LANGUE === "es";
const estItalien = LANGUE === "it";
const LOCALE_LANGUE = estAnglais ? "en-US" : estEspanol ? "es-ES" : estItalien ? "it-IT" : "fr-FR";

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
    if (t !== undefined) {
      let resultat = "";
      let positionPrecedente = 0;
      t.replace(/\{(\d+)\}/g, (m, i, position) => {
        let segment = t.slice(positionPrecedente, position);
        if(i >= valeurs.length){
          resultat += segment + m;
        }else{
          const valeur = String(valeurs[i]);
          const finalesItaliennes = { a: "e", o: "i", e: "i" };
          const finale = segment.slice(-1).toLowerCase();
          if(estItalien && valeur === "s" && finalesItaliennes[finale]){
            segment = segment.slice(0, -1) + finalesItaliennes[finale];
            resultat += segment;
          }else{
            resultat += segment + valeur;
          }
        }
        positionPrecedente = position + m.length;
        return m;
      });
      return resultat + t.slice(positionPrecedente);
    }
  }
  let texte = "";
  for (let i = 0; i < a.length; i++) texte += a[i] + (i < valeurs.length ? String(valeurs[i]) : "");
  return texte;
}

// « 3 gorgées », « 2 annulées » : accord au pluriel en français et espagnol, formes anglaises irrégulières à part
const MOTS_INVARIABLES_EN = ["cancelled"];
const PLURIELS_ES = { "anulación": "anulaciones", "vez": "veces", "luz": "luces", "voz": "voces" };
const PLURIELS_IT = { "sorso": "sorsi", "ricetta": "ricette" };
function trPluriel(n, mot){
  const m = tr(mot);
  if(n === 1 || (estAnglais && MOTS_INVARIABLES_EN.includes(m))) return `${n} ${m}`;
  if(estEspanol) return `${n} ${PLURIELS_ES[m] || m + (/[aeiouáéíóú]$/i.test(m) ? "s" : "es")}`;
  if(estItalien) return `${n} ${PLURIELS_IT[m] || m.replace(/o$/i, "i").replace(/a$/i, "e").replace(/e$/i, "i")}`;
  return `${n} ${m}${estAnglais && /s$/.test(m) ? "es" : "s"}`;
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
if (TEXTES_LANGUE) {
  document.documentElement.lang = LANGUE;
  traduireElement(document.body);
  // Titre du réglage « Mode hard » : en anglais l'adjectif passe devant (« Hard mode », « hard » dans son badge orange)
  const titreHard = document.querySelector("#ligneModeHard .optionTitre");
  const badgeHard = titreHard && titreHard.querySelector(".badgeOrangeHard");
  if (estAnglais && badgeHard) { badgeHard.textContent = "Hard"; titreHard.textContent = " mode"; titreHard.prepend(badgeHard); }
}

// Réglages > Langue : on retient le choix et on recharge la page
function choisirLangue(langue){
  const nouvelle = langue === "en" || langue === "es" || langue === "it" ? langue : "fr";
  if (nouvelle === LANGUE) return;
  try { localStorage.setItem(CLE_LANGUE, nouvelle); } catch (e) { return; }
  // Même chemin que le changement de thème (js/reglages.js) : rechargerPage() (js/retour-demarrage.js) revient d'abord à la
  // première entrée de l'historique, puis recharge. Un simple location.reload() laissait derrière lui les entrées ajoutées par
  // l'ouverture des Réglages : sur iPhone, la page d'accueil se retrouvait défilable. Les Réglages se rouvrent au même endroit.
  try {
    const ouverts = typeof ecranReglages !== "undefined" && ecranReglages.style.display !== "none" && !ecranReglages.classList.contains("page-sortie");
    if (ouverts && typeof CLE_ROUVRIR_REGLAGES !== "undefined") sessionStorage.setItem(CLE_ROUVRIR_REGLAGES, String(ecranReglages.scrollTop));
  } catch (e) {}
  // Rechargement après le clic : on attend que le son du clic ait fini (250 ms au moins, 1,2 s au plus ; c'est toujours le son
  // « bouton » d'origine, même dans les thèmes Star Wars, BDSM et Fête de la musique)
  const resteClic = typeof finDernierClicA === "number" ? finDernierClicA - Date.now() : 0;
  setTimeout(() => {
    if (typeof rechargerPage === "function") rechargerPage(); else location.reload();
  }, Math.max(250, Math.min(1200, resteClic + 50)));
}
let sonLangueJoueA = 0;
document.querySelectorAll(".chipLangue").forEach((chip) => {
  const active = chip.dataset.langue === LANGUE;
  chip.classList.toggle("actif", active);
  chip.setAttribute("aria-pressed", active ? "true" : "false");
  chip.addEventListener("pointerdown", () => {
    // (son « bouton » d'origine dans tous les thèmes : pas de sabre, de son BDSM ni de saxophone pour les langues)
    if (typeof jouerSon === "function") jouerSon("bouton", true);
    sonLangueJoueA = Date.now();
  });
  chip.addEventListener("click", () => {
    if (Date.now() - sonLangueJoueA >= 300 && typeof jouerSon === "function") jouerSon("bouton", true);
    choisirLangue(chip.dataset.langue);
  });
});
