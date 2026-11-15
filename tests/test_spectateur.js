// Mode en ligne : « Regarder une partie » (spectateur) : sans pseudo, rien n'est écrit dans la partie, aucune action possible
// (Firebase simulé en mémoire : pas de réseau).
//   node tests/test_spectateur.js
const http = require("http");
const fs = require("fs");
const path = require("path");
function charger(){
  for (const nom of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(nom); } catch (e) {} }
  console.error("Playwright est introuvable (npm i playwright)"); process.exit(2);
}
const { chromium } = charger();
const RACINE = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
const serveur = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const chemin = path.join(RACINE, p);
  if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(chemin)] || "application/octet-stream" });
  fs.createReadStream(chemin).pipe(res);
});

const FAUX_APP = `export const initializeApp = () => ({});`;
const FAUX_BASE = `
const arbre = window.__arbre = {};
window.__ecritures = [];
const decouper = (c) => String(c).split("/").filter(Boolean);
const lire = (chemin) => decouper(chemin).reduce((n, c) => (n === undefined || n === null ? undefined : n[c]), arbre);
const copie = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const instantane = (chemin) => { const v = lire(chemin); return { val: () => copie(v), exists: () => v !== undefined && v !== null, key: decouper(chemin).pop(), ref: { chemin } }; };
const abonnes = [];     // [chemin, rappel]
const enfants = [];     // [chemin, rappel, déjà vus]
const notifier = () => {
  abonnes.forEach(([c, rappel]) => rappel(instantane(c)));
  enfants.forEach((e) => { const v = lire(e[0]) || {}; Object.keys(v).forEach((k) => { if (!e[2].has(k)) { e[2].add(k); e[1](instantane(e[0] + "/" + k)); } }); });
};
window.__notifier = notifier;
const ecrire = (chemin, valeur) => {
  const m = decouper(chemin); const dernier = m.pop(); let n = arbre;
  for (const x of m) { if (n[x] === undefined || n[x] === null) n[x] = {}; n = n[x]; }
  if (valeur === null) delete n[dernier]; else n[dernier] = copie(valeur);
  const nettoyer = (o) => { for (const k of Object.keys(o)) { if (o[k] && typeof o[k] === "object") { nettoyer(o[k]); if (!Object.keys(o[k]).length) delete o[k]; } } };
  nettoyer(arbre);
};
export const getDatabase = () => ({});
export const ref = (db, chemin) => ({ chemin });
export const serverTimestamp = () => Date.now();
export const onDisconnect = () => ({ set: async () => {}, remove: async () => {}, cancel: async () => {} });
export const onValue = (r, rappel) => {
  if (r.chemin === ".info/connected") { setTimeout(() => rappel({ val: () => true }), 0); return () => {}; }
  const e = [r.chemin, rappel]; abonnes.push(e); setTimeout(() => rappel(instantane(r.chemin)), 0);
  return () => { const i = abonnes.indexOf(e); if (i >= 0) abonnes.splice(i, 1); };
};
export const onChildAdded = (r, rappel) => {
  const e = [r.chemin, rappel, new Set()]; enfants.push(e);
  setTimeout(() => notifier(), 0);
  return () => { const i = enfants.indexOf(e); if (i >= 0) enfants.splice(i, 1); };
};
export const get = async (r) => instantane(r.chemin);
export const set = async (r, valeur) => { window.__ecritures.push({ op: "set", chemin: r.chemin }); ecrire(r.chemin, valeur); notifier(); };
export const remove = (r) => set(r, null);
export const update = async (r, lot) => {
  for (const [sous, valeur] of Object.entries(lot)) { window.__ecritures.push({ op: "update", chemin: r.chemin + "/" + sous }); ecrire(r.chemin + "/" + sous, valeur); }
  notifier();
};
export const runTransaction = async (r, fn) => {
  const avant = copie(lire(r.chemin)); const apres = fn(avant);
  if (apres === undefined) return { committed: false, snapshot: instantane(r.chemin) };
  window.__ecritures.push({ op: "transaction", chemin: r.chemin }); ecrire(r.chemin, apres); notifier();
  return { committed: true, snapshot: instantane(r.chemin) };
};
`;

let echecs = 0;
const verifier = (ok, message) => { console.log((ok ? "OK    " : "ECHEC ") + message); if (!ok) echecs++; };

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const url = `http://localhost:${serveur.address().port}/index.html?modetest=1`;
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  const nav = await chromium.launch(exe);
  const ctx = await nav.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  const dialogues = [];
  page.on("dialog", (d) => { dialogues.push(d.message()); d.accept(); });
  await page.route("**/firebase-app.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_APP }));
  await page.route("**/firebase-database.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_BASE }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());

  await page.goto(url); await page.waitForTimeout(1500);
  const version = await page.evaluate(() => VERSION_JEU);
  const cap = async (nom) => { if (process.env.CAPTURES) await page.screenshot({ path: path.join(process.env.CAPTURES, nom + ".png") }); }; // (CAPTURES=dossier : captures pour regarder le rendu)
  const visible = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== "none" && e.getClientRects().length > 0; }, sel);
  const ecritures = () => page.evaluate(() => window.__ecritures.length);
  const arbre = (c) => page.evaluate((c) => JSON.parse(JSON.stringify(c.split("/").reduce((n, x) => (n == null ? n : n[x]), window.__arbre) ?? null)), c);

  // La partie existe déjà : salle d'attente, deux joueurs
  await page.evaluate((v) => {
    window.__arbre.parties = { ABCD2: { version: v, hote: "Alice", creee: 1, activite: 1,
      joueurs: { Alice: { nom: "Alice", host: true, rejoint: 1, connecte: true }, Bob: { nom: "Bob", host: false, rejoint: 2, connecte: true } },
      etatJeu: { demarree: false, hote: "Alice" } } };
  }, version);

  // 1. L'écran « Regarder » : le code seulement, pas de pseudo
  await page.click("#btnModeEnLigne"); await page.waitForTimeout(300);
  verifier(await visible("#btnRegarderPartie") && await visible("#btnRejoindrePartie"), "mode en ligne : le bouton « Regarder une partie » est à côté de « Rejoindre une partie »");
  await cap("1_choix");
  await page.click("#btnRegarderPartie"); await page.waitForTimeout(300);
  await cap("2_regarder");
  verifier(await visible("#codeRejoindre") && !(await visible("#pseudoRejoindre")) && await visible("#validerRegarder") && !(await visible("#validerRejoindre")) && await visible("#btnScannerQR"),
    "écran Regarder : code et scanner, pas de pseudo, bouton « Regarder » (pas « Rejoindre »)");
  await page.click("#btnRetourRejoindre"); await page.waitForTimeout(200);
  await page.click("#btnRejoindrePartie"); await page.waitForTimeout(300);
  verifier(await visible("#pseudoRejoindre") && await visible("#validerRejoindre") && !(await visible("#validerRegarder")), "écran Rejoindre (normal) inchangé : pseudo et « Rejoindre », pas « Regarder »");
  await page.click("#btnRetourRejoindre"); await page.waitForTimeout(200);

  // 2. Code inconnu, code vide
  await page.click("#btnRegarderPartie"); await page.waitForTimeout(200);
  await page.click("#validerRegarder"); await page.waitForTimeout(200);
  await page.fill("#codeRejoindre", "zzzz9"); await page.click("#validerRegarder"); await page.waitForTimeout(500);
  verifier(/code/i.test(dialogues[0] || "") && /Aucune partie/.test(dialogues[1] || "") && !(await visible("#salleAttente")), `code vide puis inconnu : refusés (${JSON.stringify(dialogues)})`);

  // 3. Salle d'attente : on voit les joueurs, rien d'autre
  const avant = await ecritures();
  await page.fill("#codeRejoindre", "abcd2"); await page.click("#validerRegarder"); await page.waitForTimeout(800);
  await cap("3_salle");
  const salle = await page.evaluate(() => ({
    noms: [...document.querySelectorAll("#listeJoueursEnLigne > div > span")].map((s) => s.innerText), exclure: document.querySelectorAll("#listeJoueursEnLigne .btnExclure").length,
    code: document.getElementById("codePartieAffiche").innerText, info: getComputedStyle(document.getElementById("infoSpectateur")).display, spect: document.body.classList.contains("mode-spectateur"),
    lancer: getComputedStyle(document.getElementById("lancerPartieEnLigne")).display }));
  verifier(await visible("#salleAttente") && salle.noms.length === 2 && salle.exclure === 0 && /ABCD2/.test(salle.code) && salle.info !== "none" && salle.spect && salle.lancer === "none",
    `salle d'attente : 2 joueurs, pas de ✕ ni « Lancer », code et mention « tu regardes » (${JSON.stringify(salle)})`);
  verifier((await ecritures()) === avant && Object.keys(await arbre("parties/ABCD2/joueurs")).join() === "Alice,Bob", "salle d'attente : rien n'est écrit, le spectateur n'est pas dans la liste des joueurs");

  // 4. La partie démarre : le plateau s'affiche, rien ne se joue
  await page.evaluate(() => { window.__arbre.parties.ABCD2.etatJeu = { demarree: true, manche: 1, seed: 123456, joueurs: ["Alice", "Bob"], hote: "Alice" }; window.__notifier(); });
  await page.waitForTimeout(2500);
  const jeu = await page.evaluate(() => ({ cartes: document.querySelectorAll("#plateau .Carte").length, ligne: document.body.classList.contains("mode-en-ligne"), spect: document.body.classList.contains("mode-spectateur"),
    badge: (document.querySelector("#btnCodePartie .texte") || {}).innerText, rattrapage: !!document.getElementById("ecranRattrapage") }));
  verifier(await visible("#jeu") && jeu.cartes > 0 && jeu.ligne && jeu.spect && /ABCD2/.test(jeu.badge || "") && !jeu.rattrapage, `la manche démarre chez le spectateur (${JSON.stringify(jeu)})`);
  await cap("4_jeu");
  const apresDemarrage = await ecritures();
  await page.evaluate(() => { const c = document.querySelector("#plateau .Carte:not(.retournee)"); if (c) { c.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); c.click(); } });
  await page.waitForTimeout(600);
  const toast = await page.evaluate(() => (document.getElementById("toastEnLigne") || {}).innerText);
  verifier((await ecritures()) === apresDemarrage && !(await arbre("parties/ABCD2/manches")) && /regardes/i.test(toast || ""), `toucher une carte : rien n'est envoyé, message « ${toast} »`);
  verifier(!(await visible("#nouvellePartie")), "pas de bouton « Nouvelle partie » pour un spectateur");

  // 5. Il part : aucune écriture, les joueurs restent
  await page.evaluate(() => document.getElementById("btnAccueilClassique").click()); await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("btnConfirmerAccueilOui").click()); await page.waitForTimeout(600);
  verifier((await ecritures()) === apresDemarrage && Object.keys(await arbre("parties/ABCD2/joueurs")).join() === "Alice,Bob" && !(await arbre("parties/ABCD2/joueurs/null"))
    && await page.evaluate(() => !estSpectateur && !document.body.classList.contains("mode-spectateur") && codePartieActuel === null), "quitter : aucune écriture, les joueurs sont intacts, l'état de spectateur est remis à zéro");

  // 6. Arrivée en pleine manche : la manche est rattrapée (actions déjà jouées), sans écrire
  await page.evaluate(() => { window.__arbre.parties.ABCD2.etatJeu = { demarree: true, manche: 1, seed: 123456, joueurs: ["Alice", "Bob"], hote: "Alice" }; });
  await page.click("#btnModeEnLigne").catch(() => {}); await page.waitForTimeout(300);
  await page.click("#btnRegarderPartie"); await page.waitForTimeout(200);
  await page.fill("#codeRejoindre", "ABCD2"); await page.click("#validerRegarder"); await page.waitForTimeout(3000);
  const tard = await page.evaluate(() => ({ cartes: document.querySelectorAll("#plateau .Carte").length, rattrapage: !!document.getElementById("ecranRattrapage") }));
  verifier(await visible("#jeu") && tard.cartes > 0 && !tard.rattrapage && (await ecritures()) === apresDemarrage && Object.keys(await arbre("parties/ABCD2/joueurs")).join() === "Alice,Bob",
    `arrivée en pleine manche : le plateau s'affiche sans rien écrire (${JSON.stringify(tard)})`);

  verifier(erreurs.length === 0, `aucune erreur dans la page ${JSON.stringify(erreurs.slice(0, 3))}`);
  await nav.close(); serveur.close();
  console.log(echecs ? `\n${echecs} ECHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})();
