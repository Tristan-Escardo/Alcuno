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
window.__notifier = () => abonnes.forEach(([c, rappel]) => rappel(instantane(c)));
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
const ecouteurs = []; let utilisateur = null;
const AUTH = {};
export const getAuth = () => AUTH;
export const onAuthStateChanged = (auth, rappel) => { ecouteurs.push(rappel); rappel(utilisateur); };
export const signInWithEmailAndPassword = async (auth, email, mdp) => {
  if (mdp !== "bon") { const e = new Error("x"); e.code = "auth/invalid-credential"; throw e; }
  utilisateur = { uid: "UID-TEST-123" }; ecouteurs.forEach((e) => e(utilisateur)); return { user: utilisateur };
};
export const signOut = async () => { utilisateur = null; ecouteurs.forEach((e) => e(null)); };
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
  // Onglets Stats / Pilotage : tap sur l'onglet, glissement du doigt (gauche = Pilotage, droite = Stats), pas de glissement depuis un champ
  const vues = () => page.evaluate(() => ({ stats: document.getElementById("vueStats").classList.contains("actif") && getComputedStyle(document.getElementById("vueStats")).display !== "none",
    sante: document.getElementById("vueSante").classList.contains("actif") && getComputedStyle(document.getElementById("vueSante")).display !== "none",
    pilotage: document.getElementById("vuePilotage").classList.contains("actif") && getComputedStyle(document.getElementById("vuePilotage")).display !== "none",
    onglet: document.querySelector('.onglet[aria-selected="true"]').dataset.vue, sous: document.getElementById("sousTitre").textContent, hash: location.hash }));
  const glisser = (dx, cible = "document.body") => page.evaluate(([dx, cible]) => {
    const el = cible === "document.body" ? document.body : document.querySelector(cible);
    const t = (x) => new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [t(200)], changedTouches: [t(200)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [t(200 + dx)] }));
  }, [dx, cible]);
  const v0 = await vues();
  await glisser(-200); const v1 = await vues();
  await glisser(-200); const v1b = await vues();
  await glisser(-200); const v1c = await vues(); // (déjà sur la dernière page : rien de plus)
  await glisser(200); const v2 = await vues();
  await glisser(200); const v2b = await vues();
  await glisser(200); const v2c = await vues(); // (déjà sur la première page)
  await page.click("#ongletPilotage"); const v3 = await vues();
  await page.click("#ongletSante"); const v3b = await vues();
  await page.click("#ongletStats"); const v4 = await vues();
  await glisser(-200, "#pilEmail"); const v5 = await vues(); // (un glissement qui démarre dans un champ ne change pas de page)
  await glisser(-30); const v6 = await vues(); // (trop court)
  verifier(v0.stats && !v0.pilotage && v1.sante && v1.sous === "Santé du jeu" && v1.hash === "#sante" && v1b.pilotage && v1b.sous === "Pilotage" && v1c.pilotage && v2.sante && v2b.stats && v2b.sous === "Statistiques" && v2c.stats && v3.pilotage && v3b.sante && v4.stats && v4.hash === "" && v5.stats && v6.stats,
    `onglets Stats / Santé / Pilotage : glisser, taper (${JSON.stringify([v0.stats, v1.sante, v1b.pilotage, v1c.pilotage, v2.sante, v2b.stats, v2c.stats, v3.pilotage, v3b.sante, v4.stats, v5.stats, v6.stats])})`);
  // Santé : plantages envoyés par le jeu, regroupés sur 7 jours
  const jourDe = (decalage) => { const d = new Date(Date.now() - decalage * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  await page.evaluate(([auj, hier, vieux]) => {
    window.__arbre.sante = { jours: {
      [auj]: { aaaaaaaaaaaa: { msg: "TypeError: x is not a function", fichier: "plateau.js:120", version: "9.66.0", os: "ios", vu: Date.now() - 3600000, n: 3 },
               bbbbbbbbbbbb: { msg: "RangeError: ancien", fichier: "regles.js:9", version: "9.60.0", os: "android", vu: Date.now() - 5 * 3600000, n: 2 } },
      [hier]: { aaaaaaaaaaaa: { msg: "TypeError: x is not a function", fichier: "plateau.js:120", version: "9.65.1", os: "android", vu: Date.now() - 30 * 3600000, n: 4 } },
      [vieux]: { cccccccccccc: { msg: "trop vieux", fichier: "x.js:1", version: "9.0.0", os: "ios", vu: 1, n: 9 } } } };
    window.__notifier();
  }, [jourDe(0), jourDe(1), jourDe(20)]);
  await page.click("#ongletSante"); await page.waitForTimeout(200);
  const sante1 = await page.evaluate(() => ({ etat: document.getElementById("santeEtat").textContent, lignes: [...document.querySelectorAll("#santeListe .santeLigne")].map((l) => l.textContent), badge: document.getElementById("badgeSante").hidden ? "" : document.getElementById("badgeSante").textContent, effacer: document.getElementById("santeEffacer").hidden }));
  await page.click('#santeListe button[data-ignorer="aaaaaaaaaaaa"]'); await page.waitForTimeout(200);
  const sante2 = await page.evaluate(() => ({ note: document.getElementById("santeNote").textContent, ignore: (window.__arbre.sante.ignores || {}).aaaaaaaaaaaa || null }));
  verifier(/5 plantages/.test(sante1.etat) && sante1.lignes.length === 2 && /×7/.test(sante1.lignes[0]) && /9\.66\.0 ×3/.test(sante1.lignes[0]) && /9\.65\.1 ×4/.test(sante1.lignes[0]) && /plateau\.js:120/.test(sante1.lignes[0]) && !/trop vieux/.test(sante1.lignes.join()) && sante1.badge === "5" && sante1.effacer && /Connecte-toi/.test(sante2.note) && sante2.ignore === null,
    `santé : plantages regroupés sur 7 jours, badge, ignorer demande la connexion (${sante1.etat} / ${JSON.stringify(sante1.lignes)} / badge ${sante1.badge} / ${sante2.note})`);
  await page.click("#ongletStats");
  // Pilotage du jeu (réglages à distance) : deuxième onglet de la même page
  const nbErreursStats = erreurs.length;
  await page.click("#ongletPilotage"); await page.waitForTimeout(200);
  const pil = (js) => page.evaluate(js);
  const avantConnexion = await pil(() => ({ connexion: !document.getElementById("pilConnexion").hidden, panneau: document.getElementById("pilPanneau").hidden }));
  await page.fill("#pilEmail", "moi@exemple.fr"); await page.fill("#pilMdp", "mauvais"); await page.click("#pilConnecter"); await page.waitForTimeout(200);
  const refuse = await pil(() => document.getElementById("pilMessage").textContent);
  await page.fill("#pilMdp", "bon"); await page.click("#pilConnecter"); await page.waitForTimeout(300);
  const connecte = await pil(() => ({ panneau: !document.getElementById("pilPanneau").hidden, uid: document.getElementById("pilUid").textContent, etat: document.getElementById("pilEtat").textContent }));
  await page.fill("#pilTexte", "blabla"); await page.click("#pilComprendre"); await page.waitForTimeout(200);
  const incompris = await pil(() => [...document.querySelectorAll("#pilFil .bulle")].pop().textContent);
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
  // Assistant : se souvient (« finalement non »), répond aux questions sur les stats, raccourcis, modèles d'annonces
  await page.click("#ongletPilotage"); await page.waitForTimeout(200);
  const envoyer = async (texte) => { await page.fill("#pilTexte", texte); await page.click("#pilComprendre"); await page.waitForTimeout(250); };
  const dernier = () => page.evaluate(() => ({ bulle: [...document.querySelectorAll("#pilFil .bulle")].pop().textContent, liste: document.getElementById("pilProposeListe").textContent, propose: !document.getElementById("pilPropose").hidden }));
  await page.evaluate((auj) => { window.__arbre.stats = { jours: { [auj]: { visites: 10, parties: 4, partiesEnLigne: 2, visiteurs: { abcdefghij01: true, abcdefghij02: true } } }, appareils: { abcdefghij01: { os: "ios", vu: Date.now(), theme: "kawaii", version: "9.66.0" }, abcdefghij02: { os: "android", vu: Date.now(), theme: "kawaii", version: "9.65.1" } } }; window.__notifier(); }, jourDe(0));
  await page.click("#pilEffacerFil");
  await envoyer("coupe la voix"); await page.click("#pilAppliquer"); await page.waitForTimeout(300);
  await envoyer("finalement non, remets-la"); const suiteNon = await dernier();
  await page.click("#pilAnnulerPropose");
  await envoyer("combien de parties aujourd'hui ?"); const questionParties = await dernier();
  await envoyer("quel thème est le plus utilisé ?"); const questionTheme = await dernier();
  await envoyer("combien de plantages ?"); const questionPlantages = await dernier();
  await page.click('#pilRaccourcis button[data-raccourci="maintenance"]'); await page.waitForTimeout(200);
  const raccourci = await dernier();
  await page.click("#pilAppliquer"); await page.waitForTimeout(300);
  const maintenance = await page.evaluate(() => ({ enligne: !!(window.__arbre.config.coupures || {}).enligne, annonce: (window.__arbre.config.annonce || {}).texte || "" }));
  await page.click('#pilModeles button[data-modele="0"]');
  const modele = await page.evaluate(() => document.getElementById("pilAnnonce").value);
  const nbBulles = await page.evaluate(() => document.querySelectorAll("#pilFil .bulle").length);
  verifier(/Remettre les annonces/.test(suiteNon.liste) && suiteNon.propose && /Parties aujourd'hui : 6 \(4 classiques, 2 en ligne\)/.test(questionParties.bulle) && /Kawaii \(100 %\)/.test(questionTheme.bulle) && /plantage/i.test(questionPlantages.bulle) && !questionParties.propose,
    `assistant : suite « finalement non », questions sur les stats (${JSON.stringify([suiteNon.liste, questionParties.bulle, questionTheme.bulle, questionPlantages.bulle])})`);
  verifier(/mode en ligne/i.test(raccourci.liste) && /maintenance/i.test(raccourci.liste) && maintenance.enligne && /maintenance/i.test(maintenance.annonce) && /Soirée/.test(modele) && nbBulles >= 8, `raccourci « maintenance » + modèle d'annonce (${JSON.stringify([raccourci.liste, maintenance, modele, nbBulles])})`);
  await page.click("#pilEffacerFil"); await page.click("#pilAnnulerDerniere"); await page.waitForTimeout(300); await page.click("#pilRetirerAnnonce"); await page.waitForTimeout(200);

  // IA (Gemini simulé) : test de la clé, conversation avec historique, modèle renommé, reformulation de l'annonce
  const appelsIA = [];
  await page.route("https://generativelanguage.googleapis.com/**", async (route) => {
    const req = route.request(), url = req.url();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (corps, status = 200) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(corps) });
    if (/models\?/.test(url)) {
      if (/key=MAUVAISE/.test(url)) return json({ error: { message: "API key not valid" } }, 403);
      return json({ models: [{ name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] }, { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] });
    }
    const corps = JSON.parse(req.postData() || "{}");
    appelsIA.push({ url, systeme: corps.systemInstruction.parts[0].text, contenus: corps.contents });
    if (/models\/disparu:/.test(url)) return json({ error: { message: "model not found" } }, 404);
    if (/Réécris/.test(corps.systemInstruction.parts[0].text)) return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ variantes: ["Variante A 🍻", "Variante B", "Variante C"] }) }] } }] });
    const dernierTexte = corps.contents[corps.contents.length - 1].parts[0].text;
    const rep = /plaisir/.test(dernierTexte) ? { commandes: [{ op: "coupure", cible: "musique", etat: true }], reponse: "Historique reçu : " + corps.contents.length } : { commandes: [], reponse: "Je ne gère que le jeu." };
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(rep) }] } }] });
  });
  await page.evaluate(() => { document.getElementById("pilCleIA").closest("details").open = true; });
  await page.fill("#pilCleIA", "MAUVAISE"); await page.click("#pilEnregistrerCle"); await page.waitForTimeout(400);
  const cleMauvaise = await page.evaluate(() => ({ etat: document.getElementById("pilIAEtat").textContent, stockee: localStorage.getItem("alcuno_pilotage_cle_ia") }));
  await page.fill("#pilCleIA", "BONNE"); await page.click("#pilEnregistrerCle"); await page.waitForTimeout(400);
  const cleBonne = await page.evaluate(() => ({ etat: document.getElementById("pilIAEtat").textContent, stockee: localStorage.getItem("alcuno_pilotage_cle_ia"), modele: localStorage.getItem("alcuno_pilotage_modele_ia") }));
  await envoyer("pourquoi le ciel est bleu ?"); await page.waitForTimeout(300);
  const horsSujet = await dernier();
  await envoyer("fais plaisir à tout le monde"); await page.waitForTimeout(300);
  const ia = await dernier();
  await page.click("#pilAnnulerPropose");
  await page.evaluate(() => localStorage.setItem("alcuno_pilotage_modele_ia", "disparu"));
  await envoyer("fais plaisir à tout le monde encore"); await page.waitForTimeout(500);
  const renomme = await dernier(); const modeleApres = await page.evaluate(() => localStorage.getItem("alcuno_pilotage_modele_ia"));
  await page.click("#pilAnnulerPropose");
  await page.fill("#pilAnnonce", "soirée samedi"); await page.click("#pilReformuler"); await page.waitForTimeout(400);
  const variantes = await page.evaluate(() => [...document.querySelectorAll("#pilVariantes button")].map((b) => b.textContent));
  await page.click('#pilVariantes button[data-variante="1"]');
  const choisie = await page.evaluate(() => ({ texte: document.getElementById("pilAnnonce").value, restantes: document.querySelectorAll("#pilVariantes button").length }));
  const appelHistorique = appelsIA.find((x) => /plaisir/.test(JSON.stringify(x.contenus)) && x.contenus.length > 1);
  verifier(/refusée/.test(cleMauvaise.etat) && cleMauvaise.stockee === null && /Clé valide ✓ · modèle utilisé : gemini-2\.5-flash/.test(cleBonne.etat) && cleBonne.stockee === "BONNE" && cleBonne.modele === "gemini-2.5-flash", `IA : clé refusée / valide, modèle retenu (${JSON.stringify([cleMauvaise, cleBonne])})`);
  verifier(/Je ne gère que le jeu/.test(horsSujet.bulle) && !horsSujet.propose && /Historique reçu : [3-9]/.test(ia.bulle) && ia.propose && /musique/i.test(ia.liste) && appelHistorique && /aujourdhui/.test(appelHistorique.systeme) && /gemini-2\.5-flash/.test(appelsIA[0].url),
    `IA : conversation avec historique et données des stats (${JSON.stringify([horsSujet.bulle, ia.bulle, ia.liste])})`);
  verifier(/Historique reçu/.test(renomme.bulle) && modeleApres === "gemini-2.5-flash" && appelsIA.some((x) => /models\/disparu:/.test(x.url)), `IA : modèle renommé (404) => un autre modèle est trouvé et la demande réessayée (${modeleApres})`);
  verifier(variantes.length === 3 && choisie.texte === "Variante B" && choisie.restantes === 0, `IA : reformulation de l'annonce en 3 variantes (${JSON.stringify([variantes, choisie])})`);
  await page.evaluate(() => { localStorage.removeItem("alcuno_pilotage_cle_ia"); localStorage.removeItem("alcuno_pilotage_modele_ia"); });
  // Claude (Anthropic) et ChatGPT (OpenAI) simulés : une clé par fournisseur, en-têtes propres à chacun, même conversation
  const appelsClaude = [], appelsOpenai = [];
  const corsAutres = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
  const repondre = (route, corps, status = 200) => route.fulfill({ status, headers: { ...corsAutres, "content-type": "application/json" }, body: JSON.stringify(corps) });
  const reponseIA = (systeme, messages) => /Réécris/.test(systeme) ? { variantes: ["Version un", "Version deux", "Version trois"] } : /plaisir/.test(messages[messages.length - 1]) ? { commandes: [{ op: "coupure", cible: "voix", etat: true }], reponse: "Reçu " + messages.length + " message(s)" } : { commandes: [], reponse: "Autre réponse" };
  await page.route("https://api.anthropic.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsAutres });
    if (/\/v1\/models/.test(req.url())) return req.headers()["x-api-key"] === "MAUVAISE-C" ? repondre(route, { error: { message: "invalid x-api-key" } }, 401) : repondre(route, { data: [{ id: "claude-sonnet-5-5" }, { id: "claude-haiku-5-5" }] });
    const corps = JSON.parse(req.postData() || "{}");
    appelsClaude.push({ entetes: req.headers(), corps });
    const r = reponseIA(corps.system, corps.messages.map((m) => m.content));
    return repondre(route, { content: [{ type: "text", text: "```json\n" + JSON.stringify(r) + "\n```" }] }); // (Claude peut entourer le JSON de texte : on le retrouve)
  });
  await page.route("https://api.openai.com/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: corsAutres });
    if (/\/v1\/models/.test(req.url())) return req.headers().authorization === "Bearer MAUVAISE-O" ? repondre(route, { error: { message: "Incorrect API key" } }, 401) : repondre(route, { data: [{ id: "text-embedding-3-small" }, { id: "gpt-4o-mini" }, { id: "gpt-4o" }] });
    const corps = JSON.parse(req.postData() || "{}");
    appelsOpenai.push({ entetes: req.headers(), corps });
    const r = reponseIA(corps.messages[0].content, corps.messages.slice(1).map((m) => m.content));
    return repondre(route, { choices: [{ message: { content: JSON.stringify(r) } }] });
  });
  const etatCle = () => page.evaluate(() => ({ etat: document.getElementById("pilIAEtat").textContent, champ: document.getElementById("pilCleIA").value, aide: document.getElementById("pilIAAide").textContent, fournisseur: document.getElementById("pilFournisseur").value }));
  await page.selectOption("#pilFournisseur", "claude"); const claudeVide = await etatCle();
  await page.fill("#pilCleIA", "MAUVAISE-C"); await page.click("#pilEnregistrerCle"); await page.waitForTimeout(400); const claudeMauvaise = await etatCle();
  await page.fill("#pilCleIA", "CLE-C"); await page.click("#pilEnregistrerCle"); await page.waitForTimeout(400); const claudeBonne = await etatCle();
  await envoyer("fais plaisir à tout le monde"); await page.waitForTimeout(400); const claude = await dernier();
  await page.click("#pilAnnulerPropose");
  await page.fill("#pilAnnonce", "brouillon"); await page.click("#pilReformuler"); await page.waitForTimeout(400);
  const variantesClaude = await page.evaluate(() => [...document.querySelectorAll("#pilVariantes button")].map((b) => b.textContent));
  await page.click('#pilVariantes button[data-variante="0"]');
  await page.selectOption("#pilFournisseur", "openai"); const openaiVide = await etatCle();
  await page.fill("#pilCleIA", "MAUVAISE-O"); await page.click("#pilEnregistrerCle"); await page.waitForTimeout(400); const openaiMauvaise = await etatCle();
  await page.fill("#pilCleIA", "CLE-O"); await page.click("#pilEnregistrerCle"); await page.waitForTimeout(400); const openaiBonne = await etatCle();
  await envoyer("fais plaisir à tout le monde encore une fois"); await page.waitForTimeout(400); const openai = await dernier();
  await page.click("#pilAnnulerPropose");
  await page.selectOption("#pilFournisseur", "gemini"); const retourGemini = await etatCle();
  const stock = await page.evaluate(() => ({ c: localStorage.getItem("alcuno_pilotage_cle_ia_claude"), o: localStorage.getItem("alcuno_pilotage_cle_ia_openai"), g: localStorage.getItem("alcuno_pilotage_cle_ia"), mc: localStorage.getItem("alcuno_pilotage_modele_ia_claude"), mo: localStorage.getItem("alcuno_pilotage_modele_ia_openai"), f: localStorage.getItem("alcuno_pilotage_fournisseur") }));
  const appelC = appelsClaude.find((x) => /plaisir/.test(JSON.stringify(x.corps.messages))), appelO = appelsOpenai[appelsOpenai.length - 1];
  verifier(claudeVide.fournisseur === "claude" && /console\.anthropic\.com/.test(claudeVide.aide) && claudeVide.champ === "" && /refusée par Anthropic/.test(claudeMauvaise.etat) && /Clé valide ✓ · modèle utilisé : claude-haiku-5-5/.test(claudeBonne.etat) && stock.c === "CLE-C" && stock.mc === "claude-haiku-5-5",
    `Claude : clé propre au fournisseur, refusée puis valide, modèle économique choisi (${JSON.stringify([claudeVide, claudeMauvaise.etat, claudeBonne.etat])})`);
  verifier(/Reçu \d+ message/.test(claude.bulle) && claude.propose && /voix/i.test(claude.liste) && appelC && appelC.entetes["x-api-key"] === "CLE-C" && appelC.entetes["anthropic-dangerous-direct-browser-access"] === "true" && !!appelC.entetes["anthropic-version"] && appelC.corps.model === "claude-haiku-5-5" && appelC.corps.max_tokens > 0 && /aujourdhui/.test(appelC.corps.system) && appelC.corps.messages[0].role === "user" && appelC.corps.messages.every((m, i, l) => i === 0 || m.role !== l[i - 1].role) && variantesClaude.length === 3,
    `Claude : conversation, en-têtes, JSON retrouvé dans la réponse, reformulation (${claude.bulle} / ${JSON.stringify(appelC && appelC.entetes)})`);
  verifier(openaiVide.champ === "" && /platform\.openai\.com/.test(openaiVide.aide) && /refusée par OpenAI/.test(openaiMauvaise.etat) && /Clé valide ✓ · modèle utilisé : gpt-4o-mini/.test(openaiBonne.etat) && stock.o === "CLE-O" && stock.mo === "gpt-4o-mini" && /Reçu \d+ message/.test(openai.bulle) && openai.propose
    && appelO && appelO.entetes.authorization === "Bearer CLE-O" && appelO.corps.model === "gpt-4o-mini" && appelO.corps.response_format.type === "json_object" && appelO.corps.messages[0].role === "system" && appelO.corps.messages[1].role === "user",
    `ChatGPT : clé propre, refusée puis valide, requête (${JSON.stringify([openaiVide.aide, openaiMauvaise.etat, openaiBonne.etat, openai.bulle])})`);
  verifier(retourGemini.fournisseur === "gemini" && retourGemini.champ === "" && stock.f === "gemini" && stock.g === null, `les clés restent séparées par fournisseur (retour à Gemini : ${JSON.stringify(retourGemini)} / ${JSON.stringify(stock)})`);
  await page.evaluate(() => { Object.keys(localStorage).filter((k) => k.startsWith("alcuno_pilotage_cle_ia") || k.startsWith("alcuno_pilotage_modele_ia")).forEach((k) => localStorage.removeItem(k)); });

  // Santé, connecté : ignorer / réafficher / effacer
  await page.click("#ongletSante"); await page.waitForTimeout(200);
  await page.click('#santeListe button[data-ignorer="aaaaaaaaaaaa"]'); await page.waitForTimeout(300);
  const ign = await page.evaluate(() => ({ ignore: window.__arbre.sante.ignores && window.__arbre.sante.ignores.aaaaaaaaaaaa, lignes: document.querySelectorAll("#santeListe .santeLigne").length, ignores: document.getElementById("santeIgnoresTitre").textContent, badge: document.getElementById("badgeSante").hidden ? "" : document.getElementById("badgeSante").textContent, etat: document.getElementById("santeEtat").textContent }));
  await page.evaluate(() => { document.getElementById("santeIgnores").open = true; });
  await page.click('#santeIgnoresListe button[data-reafficher="aaaaaaaaaaaa"]'); await page.waitForTimeout(300);
  const reaf = await page.evaluate(() => ({ ignore: !!(window.__arbre.sante.ignores || {}).aaaaaaaaaaaa, lignes: document.querySelectorAll("#santeListe .santeLigne").length }));
  await page.click("#santeEffacer"); await page.waitForTimeout(300);
  const efface = await page.evaluate(() => ({ jours: !!(window.__arbre.sante && window.__arbre.sante.jours), etat: document.getElementById("santeEtat").textContent }));
  verifier(ign.ignore === true && ign.lignes === 1 && /Ignorés \(1\)/.test(ign.ignores) && ign.badge === "2" && reaf.ignore === false && reaf.lignes === 2 && !efface.jours && /Aucun plantage/.test(efface.etat), `santé (connecté) : ignorer, réafficher, effacer (${JSON.stringify([ign, reaf, efface])})`);
  verifier(erreurs.length === 0 && nbErreursStats === 0, `aucune erreur dans les pages (${erreurs.length})`);
  await nav.close(); serveur.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})();
