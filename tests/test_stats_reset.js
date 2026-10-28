// Page de stats : le bouton « Réinitialiser toutes les statistiques » efface bien tout (Firebase simulé en mémoire : pas de réseau).
//   node tests/test_stats_reset.js
const http = require("http");
const fs = require("fs");
const path = require("path");
function charger(){
  for (const nom of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(nom); } catch (e) {} }
  console.error("Playwright est introuvable (npm i playwright)"); process.exit(2);
}
const { chromium } = charger();
const RACINE = path.join(__dirname, "..");
const serveur = http.createServer((req, res) => {
  const chemin = path.join(RACINE, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/stats.html"));
  if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": chemin.endsWith(".html") ? "text/html" : "text/javascript" });
  fs.createReadStream(chemin).pipe(res);
});

// Faux Firebase : un arbre en mémoire, onValue / get / update (un chemin à null = effacé)
const FAUX_APP = `export const initializeApp = () => ({});`;
const FAUX_BASE = `
const arbre = window.__arbre = {
  stats: {
    jours: {
      "2026-10-20": { visites: 5, parties: 2, visiteurs: { abcdefghij01: true, abcdefghij02: true }, heures: { "21": 2, "22": 1 } },
      "2026-10-21": { visites: 3, installs: 1, doreesTirees: 1 }
    },
    appareils: { abcdefghij01: { os: "ios", vu: 1, theme: "noir", version: "9.43.1" }, abcdefghij02: { os: "android", vu: 1 } }
  },
  presence: { abcdefghij01: { etat: "menu", maj: 1 } }
};
window.__ecritures = [];
const lire = (chemin) => chemin.split("/").filter(Boolean).reduce((n, c) => (n === undefined || n === null ? undefined : n[c]), arbre);
const instantane = (chemin) => { const v = lire(chemin); return { val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }; };
const abonnes = [];
export const getDatabase = () => ({});
export const ref = (db, chemin) => ({ chemin });
export const onValue = (r, rappel) => { abonnes.push([r.chemin, rappel]); rappel(instantane(r.chemin)); };
export const get = async (r) => {
  if (!r.derniere) return instantane(r.chemin);
  const v = lire(r.chemin) || {}; const cles = Object.keys(v).sort(); const k = cles[cles.length - 1];
  return { val: () => (k ? { [k]: JSON.parse(JSON.stringify(v[k])) } : null) };
};
export const set = async (r, valeur) => {
  const morceaux = r.chemin.split("/").filter(Boolean); const dernier = morceaux.pop();
  let n = arbre; for (const m of morceaux) { if (n[m] === undefined) n[m] = {}; n = n[m]; }
  if (valeur === null) delete n[dernier]; else n[dernier] = JSON.parse(JSON.stringify(valeur));
  abonnes.forEach(([c, rappel]) => rappel(instantane(c)));
};
export const remove = (r) => set(r, null);
export const query = (r) => ({ chemin: r.chemin, derniere: true });
export const orderByKey = () => ({});
export const limitToLast = () => ({});
export const update = async (r, lot) => {
  window.__ecritures.push(Object.keys(lot).length);
  for (const [sous, valeur] of Object.entries(lot)) {
    const morceaux = (r.chemin + "/" + sous).split("/").filter(Boolean);
    const dernier = morceaux.pop();
    let n = arbre;
    for (const m of morceaux) { if (n[m] === undefined) { n = null; break; } n = n[m]; }
    // (les règles autorisent l'écriture sur chaque valeur et sur la fiche d'un appareil, pas sur un noeud « jours » en bloc)
    if (n && typeof n[dernier] === "object" && n[dernier] !== null && !((r.chemin + "/" + sous).startsWith("stats/appareils/") && (r.chemin + "/" + sous).split("/").length === 3)) throw new Error("écriture sur un noeud entier : " + sous);
    if (n) { if (valeur === null) delete n[dernier]; else n[dernier] = valeur; }
  }
  // les noeuds devenus vides disparaissent (comme dans Firebase)
  const nettoyer = (o) => { for (const k of Object.keys(o)) { if (o[k] && typeof o[k] === "object") { nettoyer(o[k]); if (!Object.keys(o[k]).length) delete o[k]; } } };
  nettoyer(arbre);
  abonnes.forEach(([c, rappel]) => rappel(instantane(c)));
};
`;

const FAUX_AUTH = `
let ecouteur = null; let utilisateur = null;
export const getAuth = () => ({});
export const onAuthStateChanged = (auth, rappel) => { ecouteur = rappel; rappel(utilisateur); };
export const signInWithEmailAndPassword = async (auth, email, mdp) => {
  if (mdp !== "bon") { const e = new Error("x"); e.code = "auth/invalid-credential"; throw e; }
  utilisateur = { uid: "UID-TEST-123" }; ecouteur(utilisateur); return { user: utilisateur };
};
export const signOut = async () => { utilisateur = null; ecouteur(null); };
`;

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const url = `http://localhost:${serveur.address().port}/stats.html`;
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  const nav = await chromium.launch(exe);
  const page = await nav.newPage({ viewport: { width: 390, height: 780 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.route("**/firebase-app.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_APP }));
  await page.route("**/firebase-database.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_BASE }));
  await page.route("**/firebase-auth.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_AUTH }));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem("alcuno_stats_acces", "2c8125d3adc62dac73f3ae036a86e00ba51b12b0dfb38fec2184e76441ed6826"); } catch (e) {} });
  await page.goto(url); await page.waitForTimeout(800);

  let echecs = 0;
  const verifier = (ok, texte) => { console.log((ok ? "OK    " : "ECHEC ") + texte); if (!ok) echecs++; };
  const etat = () => page.evaluate(() => ({ jours: Object.keys(window.__arbre.stats ? (window.__arbre.stats.jours || {}) : {}).length,
    appareils: Object.keys(window.__arbre.stats ? (window.__arbre.stats.appareils || {}) : {}).length,
    presence: Object.keys(window.__arbre.presence || {}).length,
    bouton: !document.getElementById("btnReset").hidden, confirme: !document.getElementById("confirmeReset").hidden,
    message: document.getElementById("messageReset").textContent, visites: document.querySelector("#tableau td b") && document.querySelector("#tableau td b").textContent }));

  const a = await etat();
  await page.click("#btnReset");
  const b = await etat();
  await page.click("#btnResetNon");
  const c = await etat();
  verifier(a.jours === 2 && a.appareils === 2 && a.bouton && !a.confirme && b.confirme && !b.bouton && c.bouton && !c.confirme && c.jours === 2,
    `bouton : confirmation demandée (${b.confirme}), « Annuler » ne touche à rien (jours ${c.jours}, appareils ${c.appareils})`);

  await page.evaluate(() => document.querySelector(".zoneReset").scrollIntoView({ block: "center" }));
  if (process.env.CAPTURE_STATS) await page.screenshot({ path: process.env.CAPTURE_STATS.replace(".png", "_bouton.png") });
  await page.click("#btnReset");
  await page.evaluate(() => document.querySelector(".zoneReset").scrollIntoView({ block: "center" }));
  if (process.env.CAPTURE_STATS) await page.screenshot({ path: process.env.CAPTURE_STATS });
  await page.click("#btnResetOui"); await page.waitForTimeout(500);
  const d = await etat();
  verifier(d.jours === 0 && d.appareils === 0 && d.presence === 1 && d.message.includes("remises à zéro") && d.bouton && !d.confirme,
    `« Oui » : tout est effacé (jours ${d.jours}, appareils ${d.appareils}), le direct est gardé (présence ${d.presence}), message « ${d.message} »`);
  const lienPilotage = await page.evaluate(() => { const l = document.querySelector(".lienPilotage"); return l && l.getAttribute("href"); });
  verifier(lienPilotage === "pilotage.html", `stats : lien vers la page de pilotage (${lienPilotage})`);
  // Pilotage du jeu (réglages à distance) : page à part, pilotage.html
  const nbErreursStats = erreurs.length;
  await page.goto(url.replace("stats.html", "pilotage.html")); await page.waitForTimeout(800);
  const pil = (js) => page.evaluate(js);
  const avantConnexion = await pil(() => ({ connexion: !document.getElementById("pilConnexion").hidden, panneau: document.getElementById("pilPanneau").hidden }));
  await page.fill("#pilEmail", "moi@exemple.fr"); await page.fill("#pilMdp", "mauvais"); await page.click("#pilConnecter"); await page.waitForTimeout(200);
  const refuse = await pil(() => document.getElementById("pilMessage").textContent);
  await page.fill("#pilMdp", "bon"); await page.click("#pilConnecter"); await page.waitForTimeout(300);
  const connecte = await pil(() => ({ panneau: !document.getElementById("pilPanneau").hidden, uid: document.getElementById("pilUid").textContent, etat: document.getElementById("pilEtat").textContent }));
  await page.fill("#pilTexte", "blabla"); await page.click("#pilComprendre"); await page.waitForTimeout(200);
  const incompris = await pil(() => document.getElementById("pilMessage").textContent);
  await page.fill("#pilTexte", "coupe la voix"); await page.click("#pilComprendre"); await page.waitForTimeout(200);
  const propose = await pil(() => ({ visible: !document.getElementById("pilPropose").hidden, texte: document.getElementById("pilProposeListe").textContent, config: window.__arbre.config || null }));
  await page.click("#pilAppliquer"); await page.waitForTimeout(300);
  const applique = await pil(() => ({ config: JSON.stringify(window.__arbre.config || null), hist: Object.keys(window.__arbre.config_hist || {}).length, etat: document.getElementById("pilEtat").textContent }));
  await page.click('#pilThemes button[data-theme="kawaii"]'); await page.waitForTimeout(300);
  await page.fill("#pilAnnonce", "Bienvenue !"); await page.selectOption("#pilAnnonceDuree", "60"); await page.click("#pilPublierAnnonce"); await page.waitForTimeout(300);
  const complet = await pil(() => JSON.stringify(window.__arbre.config));
  await page.click("#pilAnnulerDerniere"); await page.waitForTimeout(300);
  await page.click("#pilAnnulerDerniere"); await page.waitForTimeout(300);
  const annule = await pil(() => ({ config: JSON.stringify(window.__arbre.config || null), hist: Object.keys(window.__arbre.config_hist || {}).length }));
  await page.click("#pilAnnulerDerniere"); await page.waitForTimeout(300);
  const toutAnnule = await pil(() => ({ config: window.__arbre.config || null, hist: Object.keys(window.__arbre.config_hist || {}).length }));
  // annonce programmée + version visée + valeurs de départ + aperçu + historique + voyant de lecture
  page.on("dialog", (d) => d.accept());
  await page.fill("#pilAnnonce", "Bientôt !");
  await page.fill("#pilAnnonceDebut", "2099-01-02T18:30"); await page.fill("#pilAnnonceAvant", "9.70.0");
  await page.click("#pilPublierAnnonce"); await page.waitForTimeout(300);
  const prog = await pil(() => ({ annonce: window.__arbre.config.annonce, apercu: document.getElementById("pilApercu").textContent }));
  await page.selectOption("#pilDefVolume", "55"); await page.selectOption("#pilDefVitesse", "1.3"); await page.click("#pilAppliquerDefauts"); await page.waitForTimeout(300);
  const defauts = await pil(() => ({ d: window.__arbre.config.defauts, v: typeof window.__arbre.config.v, apercu: document.getElementById("pilApercu").textContent, etat: document.getElementById("pilEtat").textContent }));
  const histoAvant = await pil(() => document.querySelectorAll("#pilHisto button").length);
  await page.click("#pilHisto button >> nth=0"); await page.waitForTimeout(400); // revient avant les valeurs de départ
  const retour = await pil(() => ({ defauts: window.__arbre.config.defauts || null, annonce: !!window.__arbre.config.annonce, histo: document.querySelectorAll("#pilHisto button").length }));
  const lecture = await pil(() => document.getElementById("pilLecture").textContent);
  await page.evaluate(() => { window.__arbre.stats = { appareils: { abcdefghij01: { os: "ios", vu: Date.now(), confVu: Date.now() - 120000, confV: window.__arbre.config.v }, abcdefghij02: { os: "android", vu: Date.now() } } }; });
  await page.click('#pilCoupures button[data-coupure="musique"]'); await page.waitForTimeout(300); // (redessine aussi le voyant)
  const lecture2 = await pil(() => document.getElementById("pilLecture").textContent);
  await page.click("#pilAnnulerDerniere"); await page.waitForTimeout(300);
  await page.click("#pilRetirerAnnonce"); await page.waitForTimeout(300);
  verifier(prog.annonce.debut === new Date("2099-01-02T18:30").getTime() && prog.annonce.avantVersion === "9.70.0" && /Bientôt/.test(prog.apercu) && /apparaîtra/.test(prog.apercu) && /9\.70\.0/.test(prog.apercu), `pilotage : annonce programmée + version visée + aperçu (${JSON.stringify(prog.annonce)})`);
  verifier(defauts.d && defauts.d.volumeMusique === 55 && defauts.d.vitesseVoix === 1.3 && defauts.v === "number" && /55 %/.test(defauts.apercu) && /1,3×/.test(defauts.etat), `pilotage : valeurs de départ (${JSON.stringify(defauts.d)})`);
  verifier(histoAvant >= 2 && retour.defauts === null && retour.annonce && retour.histo > histoAvant - 1, `pilotage : historique, « Revenir avant » (${histoAvant} entrées, après ${JSON.stringify(retour)})`);
  verifier(/Aucun appareil/.test(lecture) && /2 appareils vus/.test(lecture2) && /1 ont lu/.test(lecture2) && /0 ont ta dernière modification/.test(lecture2) && /il y a 2 min/.test(lecture2), `pilotage : voyant de lecture (« ${lecture.slice(0, 80)} » puis « ${lecture2} »)`);
  verifier(avantConnexion.connexion && avantConnexion.panneau && /incorrect/.test(refuse) && connecte.panneau && connecte.uid === "UID-TEST-123" && /rien/.test(connecte.etat), `pilotage : connexion refusée puis acceptée (${refuse} / ${JSON.stringify(connecte)})`);
  verifier(/coupe|Couper/i.test(propose.texte) && propose.visible && propose.config === null && /compris/.test(incompris) && /"voix":true/.test(applique.config) && applique.hist === 1 && /voix/.test(applique.etat), `pilotage : l'assistant propose, puis applique après validation, avec historique (${propose.texte} / ${JSON.stringify(applique)}) message « ${incompris.slice(0, 30)} »`);
  verifier(/"voix":true/.test(complet) && /"kawaii":\{"actif":false\}/.test(complet) && /"texte":"Bienvenue !"/.test(complet) && /"fin":\d+/.test(complet), `pilotage : boutons thème et annonce (${complet})`);
  verifier(/"voix":true/.test(annule.config) && !/Bienvenue|kawaii/.test(annule.config) && annule.hist === 1 && toutAnnule.config && Object.keys(toutAnnule.config).join() === "v" && toutAnnule.hist === 0, `pilotage : « annuler » revient en arrière pas à pas (${JSON.stringify(annule)} puis ${JSON.stringify(toutAnnule)})`);
  verifier(erreurs.length === 0 && nbErreursStats === 0, `aucune erreur dans les pages (${erreurs.length})`);
  await nav.close(); serveur.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})();
