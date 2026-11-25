// Outils communs à test_affichage_telephone.js et test_affichage_tele.js (voir README.txt)
//
// Pour chaque écran, on mesure deux fois, dans le même état : AVEC le thème testé, puis SANS aucun thème (le style
// de base). On signale :
//   - MOINS LISIBLE : un texte sous le contraste 3 (contraste.js) que le thème rend moins lisible que le style de base
//   - BOUTON OUBLIÉ : un bouton plein resté exactement au style de base alors que le thème habille ses boutons
//   - DOS OUBLIÉ    : un dos de carte (la carte dorée par exemple) resté au dos de base alors que le thème change les autres
//   - DÉBORDE       : la page défile en largeur (téléphone) ou du texte sort de l'écran (télé)
//   - ERREUR JS     : une erreur JavaScript pendant l'écran
// Chaque écran est aussi photographié : planche à regarder dans tests/resultats/affichage_<telephone|tele>/<thème>/index.html
// (un test ne sait pas dire si c'est joli : il dit si c'est cassé, oublié ou illisible).
const fs = require("fs"); const path = require("path"); const http = require("http");
const RACINE = path.join(__dirname, "..");

// Serveur web du jeu : le test lance LE SIEN, sur un port libre, avec le dossier du jeu qui contient ce test (plus besoin de
// « python3 -m http.server 8765 », et plus de risque de tester sans le savoir le jeu d'un AUTRE dossier servi sur ce port).
// URL_JEU=http://… node tests/… : sert à tester une page déjà en ligne (rien n'est alors lancé). À appeler (await) avant le premier usage de C.URL_JEU.
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp",
  ".gif": "image/gif", ".json": "application/json", ".mp3": "audio/mpeg", ".ico": "image/x-icon", ".txt": "text/plain" };
let serveur = null;
async function demarrerServeur() {
  if (process.env.URL_JEU) { module.exports.URL_JEU = process.env.URL_JEU; console.log("Jeu testé : " + process.env.URL_JEU + " (URL_JEU)"); return; }
  serveur = http.createServer((req, res) => {
    const chemin = path.join(RACINE, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
    if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(chemin)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(chemin).pipe(res);
  });
  await new Promise((ok) => serveur.listen(0, ok));
  module.exports.URL_JEU = `http://localhost:${serveur.address().port}/index.html`;
  console.log("Jeu testé : " + RACINE + " (servi sur " + module.exports.URL_JEU + ")");
}
function arreterServeur() { if (serveur) { serveur.close(); serveur = null; } }

// Boutons volontairement restés au style de base (écran "*" = partout) : [écran, morceau du nom du bouton, raison]
const EXCEPTIONS_BOUTONS = [
  ["*", "pastilleTheme", "pastilles de choix du thème : chaque pastille montre la couleur de son propre thème"],
  ["*", "#btnEnvoyerBug", "« Envoyer le rapport » rouge profond voulu dans tous les thèmes"],
  ["*", "bloc-hot-btn bois", "« Je bois » du défi hot : sombre voulu (secondaire)"],
  ["*", "bouton-doree", "la carte dorée garde ses boutons or métallique dans tous les thèmes"],
  ["*", "bloc-hot-btn fait", "« Je le fais » du défi hot : rose vif voulu dans tous les thèmes (Givre et Soleil couchant le foncent)"],
  ["*", "fenetre", "fenêtres « Thème … débloqué » : leur propre style, le même dans tous les thèmes"],
];
// Textes que le calcul de contraste lit mal : [morceau de la clé, raison]
const EXCEPTIONS_CONTRASTE = [
  ["tele-pari-perdu", "pari sur la télé : les perdants sont estompés exprès (on voit encore qui a perdu, sans que ça attire l'œil)"],
  ["aideAccueil", "aide du début : son voile est assombri par backdrop-filter, que le calcul ne voit pas (lisible à l'œil)"],
];

// Thème demandé (1er argument), vérifié : il doit avoir des styles (data-theme="x" dans un fichier .css)
function lireTheme(nomTest) {
  const theme = String(process.argv[2] || "").trim().toLowerCase();
  const connus = Object.keys(lireThemesDuJeu());
  if (!theme || theme.startsWith("--")) {
    console.log(`Usage : node tests/${nomTest}.js <thème>     (ex. node tests/${nomTest}.js kawaii)`);
    console.log("Thèmes du jeu : " + connus.join(", "));
    process.exit(2);
  }
  const css = fs.readdirSync(RACINE).filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(RACINE, f), "utf8")).join("\n");
  if (!css.includes(`data-theme="${theme}"`)) {
    console.log(`Thème « ${theme} » introuvable : aucun style html[data-theme="${theme}"] dans les fichiers .css du jeu.`);
    console.log("Thèmes du jeu : " + connus.join(", "));
    process.exit(2);
  }
  const avertissements = [];
  if (!connus.includes(theme)) avertissements.push(`« ${theme} » n'est pas dans la liste THEMES de js/reglages.js : les joueurs ne pourront pas le choisir (le test le force quand même)`);
  return { theme, avertissements };
}
function lireThemesDuJeu() {
  const s = fs.readFileSync(path.join(RACINE, "js", "reglages.js"), "utf8");
  const m = s.match(/const THEMES = \{([\s\S]*?)\};/);
  const res = {};
  if (m) for (const x of m[1].matchAll(/(\w+)\s*:\s*"([^"]+)"/g)) res[x[1]] = x[2];
  return res;
}

// Script injecté dans la page : contraste.js + mesure des boutons + débordement
function scriptMesure() {
  return fs.readFileSync(path.join(__dirname, "contraste.js"), "utf8") + `
window.__mesurerAffichage = function (mode) {
  const visible = (el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el);
    return r.width > 4 && r.height > 4 && c.visibility !== "hidden" && c.display !== "none" && Number(c.opacity) > 0.05; };
  const boutons = [...document.querySelectorAll("button, [role=button]")].filter((el) => {
    if (!visible(el)) return false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false; }
    return true;
  }).map((el) => { const c = getComputedStyle(el);
    return { cle: (el.id ? "#" + el.id + " " : "") + (typeof el.className === "string" ? el.className.trim() : "") + " « " + (el.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 30) + " »",
      look: [c.backgroundColor, c.backgroundImage.slice(0, 80), c.color, c.borderTopColor, c.borderTopWidth].join("|") }; });
  let debord = [];
  if (mode === "telephone") {
    if (document.documentElement.scrollWidth > innerWidth + 2) debord.push("la page défile en largeur (" + document.documentElement.scrollWidth + " px pour " + innerWidth + ")");
  } else {
    // télé : un texte visible qui sort de l'écran (pas de défilement possible sur une télé)
    const ecran = document.querySelector("#ecranTele");
    if (ecran) ecran.querySelectorAll("*").forEach((el) => {
      if (el.closest(".tele-decor-kawaii") || !visible(el)) return;
      const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join("");
      if (!texte) return;
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 2 || r.bottom > innerHeight + 2 || r.left < -2 || r.top < -2) debord.push("« " + texte.slice(0, 30) + " » sort de l'écran");
    });
  }
  // Dos de cartes (y compris le dos de la carte dorée) : leur image, dans l'ordre, pour repérer un dos resté au dos de base
  const dos = [...document.querySelectorAll(".Carte:not(.retournee), .Carte.retournee.recachee")].filter((el) => visible(el) && !/_|couleur|cupidon/.test(String(el.className).replace("dos_dore", ""))).map((el) => getComputedStyle(el).backgroundImage); // (les FACES montrées sans « retournee » dans les annonces — trois_rouge, carte_doree… — ne sont pas des dos)
  // Texte sélectionné (champ du nom du joueur…) : sans règle ::selection, le navigateur le peint en bleu
  const sel = getComputedStyle(document.documentElement, "::selection");
  const selection = { fond: sel.backgroundColor, texte: sel.color };
  return { contraste: verifierContraste(3), boutons, debord, selection, dos };
};`;
}

// Mesure avec le thème, puis sans thème (même état de la page), et compare
async function verifierEcran(page, theme, mode, controlerBoutons = true) {
  const avec = await page.evaluate((m) => window.__mesurerAffichage(m), mode);
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
  await page.waitForTimeout(60);
  const sans = await page.evaluate((m) => window.__mesurerAffichage(m), mode);
  await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
  await page.waitForTimeout(60);
  const problemes = [];
  const base = new Map(sans.contraste.map((x) => [x.cle, x.ratio]));
  for (const x of avec.contraste) {
    if (EXCEPTIONS_CONTRASTE.some(([morceau]) => x.cle.includes(morceau))) continue;
    const b = base.get(x.cle);
    if (b === undefined) problemes.push(`MOINS LISIBLE  ${x.cle} : contraste ${x.ratio} (lisible sans le thème)`);
    else if (x.ratio < b - 0.3) problemes.push(`MOINS LISIBLE  ${x.cle} : contraste ${x.ratio} (${b} sans le thème)`);
  }
  const lookBase = new Map(sans.boutons.map((x) => [x.cle, x.look]));
  const plein = (look) => { const [fond, image] = look.split("|"); if (image && image !== "none") return true;
    const m = fond.match(/rgba?\(([^)]+)\)/); if (!m) return false; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return (p.length > 3 ? p[3] : 1) >= 0.8; };
  const vus = new Set();
  for (const x of avec.boutons) {
    if (vus.has(x.cle)) continue; vus.add(x.cle);
    if (!controlerBoutons || lookBase.get(x.cle) !== x.look || !plein(x.look)) continue;
    if (EXCEPTIONS_BOUTONS.some(([, morceau]) => x.cle.includes(morceau))) continue;
    problemes.push(`BOUTON OUBLIÉ  ${x.cle} : resté au style de base`);
  }
  // DOS OUBLIÉ : le thème change le dos de certaines cartes (ex. un dos rose) mais l'une d'elles garde le dos de base
  // (c'était arrivé à la carte dorée : son nom de classe « dos_dore » échappait à la règle du thème)
  if (avec.dos.length === sans.dos.length && avec.dos.length) {
    const changes = avec.dos.filter((d, i) => d !== sans.dos[i]).length;
    const oublies = avec.dos.filter((d, i) => d === sans.dos[i]).length;
    if (changes && oublies) problemes.push(`DOS OUBLIÉ     ${oublies} carte(s) de dos sur ${avec.dos.length} gardent le dos de base alors que le thème en change d'autres (carte dorée ?)`);
  }
  for (const d of avec.debord) problemes.push(`DÉBORDE        ${d}`);
  return { problemes, selection: avec.selection,
    boutonsHabilles: avec.boutons.filter((x) => lookBase.has(x.cle) && lookBase.get(x.cle) !== x.look).length };
}

// Planche des captures (à ouvrir dans un navigateur) + rapport texte
function ecrirePlanche(dossier, titre, ecrans) {
  const echap = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const html = `<!doctype html><meta charset="utf-8"><title>${echap(titre)}</title>
<style>body{font:14px system-ui,sans-serif;background:#222;color:#eee;margin:16px}h1{font-size:20px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.e{background:#333;border-radius:8px;padding:8px}.e img{width:100%;border-radius:4px;display:block;margin-top:6px}
.e.ko{outline:3px solid #e33}.p{color:#ff8a8a;font-size:12px;margin-top:6px;white-space:pre-wrap}</style>
<h1>${echap(titre)}</h1><div class="g">` + ecrans.map((e) => `<div class="e${e.problemes.length ? " ko" : ""}"><b>${echap(e.nom)}</b>` +
    (e.problemes.length ? `<div class="p">${echap(e.problemes.join("\n"))}</div>` : "") +
    e.images.map((i) => `<a href="${echap(i)}"><img loading="lazy" src="${echap(i)}"></a>`).join("") + "</div>").join("") + "</div>";
  fs.writeFileSync(path.join(dossier, "index.html"), html);
}

function preparerDossier(nom, theme) {
  const dossier = path.join(__dirname, "resultats", nom, theme);
  fs.rmSync(dossier, { recursive: true, force: true });
  fs.mkdirSync(dossier, { recursive: true });
  return dossier;
}

// Résumé final, code de sortie 1 s'il y a des problèmes
function conclure(titre, dossier, ecrans, avertissements, infos) {
  // un même problème vu sur plusieurs écrans (ex. bouton de l'accueil sous une fenêtre) : une seule ligne
  const parProbleme = new Map();
  ecrans.forEach((e) => e.problemes.forEach((p) => { if (!parProbleme.has(p)) parProbleme.set(p, []); parProbleme.get(p).push(e.nom); }));
  const lignes = [...parProbleme].map(([p, noms]) => `${p}\n               écran${noms.length > 1 ? "s" : ""} : ${noms.join(", ")}`);
  console.log("");
  avertissements.forEach((a) => console.log("ATTENTION : " + a));
  infos.forEach((a) => console.log("info : " + a));
  lignes.forEach((l) => console.log(l));
  console.log(`\n${ecrans.length} écrans vérifiés. Planche des captures : ${path.join(dossier, "index.html")}`);
  fs.writeFileSync(path.join(dossier, "rapport.txt"), [titre, ...avertissements.map((a) => "ATTENTION : " + a), ...infos.map((a) => "info : " + a), ...lignes, `${ecrans.length} écrans`].join("\n"));
  if (lignes.length) { console.log(`${lignes.length} PROBLÈME(S) DIFFÉRENT(S)`); process.exitCode = 1; }
  else console.log("TOUT EST OK");
}

module.exports = { URL_JEU: null, demarrerServeur, arreterServeur, RACINE, lireTheme, scriptMesure, verifierEcran, ecrirePlanche, preparerDossier, conclure };
