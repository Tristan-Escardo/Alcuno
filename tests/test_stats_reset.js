// Page de stats : onglets, rubriques, onglet Public, pilotage, santé, et le bouton « Réinitialiser toutes les statistiques »
// (Firebase simulé en mémoire : pas de réseau).
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
const ecouteurs = []; let utilisateur = null; try { if (localStorage.getItem("faux_utilisateur")) utilisateur = { uid: "UID-TEST-123" }; } catch (e) {}
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
  const brancher = async (p) => {
    await p.route("**/firebase-app.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_APP }));
    await p.route("**/firebase-database.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_BASE }));
    await p.route("**/firebase-auth.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_AUTH }));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  };
  await brancher(page);
  // Les réglages sont rangés par onglets et par rubriques (une seule affichée à la fois) : avant d'agir sur un élément, on ouvre
  // son onglet et sa rubrique en tapant sur les vrais boutons, comme le ferait l'utilisateur.
  const ouvrirRubriqueDe = (p) => {
    for (const methode of ["click", "fill", "selectOption"]) {
      const origine = p[methode].bind(p);
      p[methode] = async (selecteur, ...reste) => {
        await p.evaluate((sel) => {
          let el = null; try { el = document.querySelector(sel.split(" >> ")[0]); } catch (e) {}
          if (!el || el.closest(".onglets, .sousMenu")) return;
          const vue = el.closest(".vue");
          if (vue && !vue.classList.contains("actif")) document.getElementById("onglet" + vue.id.slice(3)).click();
          const pan = el.closest(".pan");
          if (pan && !pan.classList.contains("actif")) document.querySelector(`.sousMenu[data-groupe="${pan.dataset.groupe}"] button[data-pan="${pan.dataset.pan}"]`).click();
        }, selecteur);
        return origine(selecteur, ...reste);
      };
    }
  };
  ouvrirRubriqueDe(page);
  await page.addInitScript(() => { try { localStorage.setItem("faux_utilisateur", "1"); } catch (e) {} }); // (session Firebase retrouvée : connecté d'office)
  await page.goto(url); await page.waitForTimeout(800);

  let echecs = 0;
  const verifier = (ok, texte) => { console.log((ok ? "OK    " : "ECHEC ") + texte); if (!ok) echecs++; };

  // Écran de connexion : la page ne s'ouvre qu'avec le compte administrateur (les règles Firebase ne laissent lire les stats qu'à lui)
  const porte = await (async () => {
    const p2 = await nav.newPage({ viewport: { width: 390, height: 780 } });
    await brancher(p2);
    await p2.goto(url); await p2.waitForTimeout(600);
    const etat = () => p2.evaluate(() => ({ porte: !document.getElementById("porte").hidden, contenu: !document.getElementById("contenu").hidden, erreur: document.getElementById("erreurPorte").textContent }));
    const ferme = await etat();
    await p2.fill("#porteEmail", "moi@exemple.fr"); await p2.fill("#porteMdp", "mauvais"); await p2.click("#formPorte button"); await p2.waitForTimeout(300);
    const refuse = await etat();
    await p2.fill("#porteMdp", "bon"); await p2.click("#formPorte button"); await p2.waitForTimeout(600);
    const ouvert = await etat();
    await p2.click("#ongletPilotage"); await p2.waitForTimeout(200);
    const avantCompte = await p2.isVisible("#pilDeconnecter"); // (rangé dans la rubrique « Compte » : pas visible avant de l'ouvrir)
    await p2.click('#pilMenu button[data-pan="compte"]');
    if (avantCompte) throw new Error("« Se déconnecter » devrait être rangé dans la rubrique Compte");
    await p2.click("#pilDeconnecter"); await p2.waitForTimeout(800); // (se déconnecter ramène à l'écran de connexion)
    const deconnecte = await p2.evaluate(() => ({ porte: !document.getElementById("porte").hidden, contenu: !document.getElementById("contenu").hidden }));
    await p2.close();
    return { ferme, refuse, ouvert, deconnecte };
  })();
  verifier(porte.ferme.porte && !porte.ferme.contenu && /incorrect/.test(porte.refuse.erreur) && !porte.refuse.contenu && porte.ouvert.contenu && !porte.ouvert.porte && porte.deconnecte.porte && !porte.deconnecte.contenu,
    `connexion : écran fermé, refusé, ouvert avec le bon mot de passe, retour à l'écran après déconnexion (${JSON.stringify(porte)})`);

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
  // Onglet Aide : les 5 onglets tiennent sur la largeur du téléphone, la page s'ouvre, ses questions se déplient
  await page.click("#ongletAide"); await page.waitForTimeout(400);
  const aide = await page.evaluate(() => {
    const bar = document.querySelector(".onglets").getBoundingClientRect();
    const debord = Array.from(document.querySelectorAll(".onglet")).some((o) => o.scrollWidth > o.clientWidth + 1 || o.getBoundingClientRect().right > bar.right + 1);
    return { actif: document.getElementById("vueAide").classList.contains("actif"), nb: document.querySelectorAll("#vueAide details").length, debord,
      largeurPage: document.documentElement.scrollWidth, version: document.getElementById("versionStats4").textContent };
  });
  if (process.env.CAPTURE_AIDE) { await page.evaluate(() => document.querySelectorAll("#vueAide details")[3].open = true); await page.screenshot({ path: process.env.CAPTURE_AIDE }); }
  verifier(aide.actif && aide.nb >= 8 && !aide.debord && aide.largeurPage <= 390 && /^\d+\.\d+\.\d+$/.test(aide.version), `onglet Aide : ${JSON.stringify(aide)}`);
  await page.click("#ongletStats"); await page.waitForTimeout(300);

  // Onglets Stats / Pilotage : tap sur l'onglet, glissement du doigt (gauche = Pilotage, droite = Stats), pas de glissement depuis un champ
  const vues = () => page.evaluate(() => ({ public: document.getElementById("vuePublic").classList.contains("actif") && getComputedStyle(document.getElementById("vuePublic")).display !== "none",
    stats: document.getElementById("vueStats").classList.contains("actif") && getComputedStyle(document.getElementById("vueStats")).display !== "none",
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
  await glisser(-200); const v0b = await vues(); // (page Public)
  await glisser(-200); const v1 = await vues();
  await glisser(-200); const v1b = await vues();
  await glisser(-200); const v1c = await vues(); // (page Aide)
  await glisser(-200); const v1d = await vues(); // (déjà sur la dernière page : rien de plus)
  await glisser(200); const v1e = await vues(); // (retour à Pilotage)
  await glisser(200); const v2 = await vues();
  await glisser(200); const v2a = await vues(); // (retour à Public)
  await glisser(200); const v2b = await vues();
  await glisser(200); const v2c = await vues(); // (déjà sur la première page)
  await page.click("#ongletPilotage"); const v3 = await vues();
  await page.click("#ongletSante"); const v3b = await vues();
  await page.click("#ongletStats"); const v4 = await vues();
  await glisser(-200, "#pilEmail"); const v5 = await vues(); // (un glissement qui démarre dans un champ ne change pas de page)
  await glisser(-30); const v6 = await vues(); // (trop court)
  verifier(v0.stats && !v0.pilotage && v0b.public && v0b.sous === "Public et appareils" && v0b.hash === "#public" && v2a.public && v1.sante && v1.sous === "Santé du jeu" && v1.hash === "#sante" && v1b.pilotage && v1b.sous === "Pilotage" && v1c.onglet === "aide" && v1d.onglet === "aide" && v1e.pilotage && v2.sante && v2b.stats && v2b.sous === "Statistiques" && v2c.stats && v3.pilotage && v3b.sante && v4.stats && v4.hash === "" && v5.stats && v6.stats,
    `onglets Stats / Public / Santé / Pilotage / Aide : glisser, taper (${JSON.stringify([v0.stats, v1.sante, v1b.pilotage, v1c.onglet, v1d.onglet, v1e.pilotage, v2.sante, v2b.stats, v2c.stats, v3.pilotage, v3b.sante, v4.stats, v5.stats, v6.stats])})`);
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
  const sante2 = await page.evaluate(() => ({ note: document.getElementById("santeNote").textContent, ignore: (window.__arbre.sante.ignores || {}).aaaaaaaaaaaa || null }));
  verifier(/5 plantages/.test(sante1.etat) && sante1.lignes.length === 2 && /×7/.test(sante1.lignes[0]) && /9\.66\.0 ×3/.test(sante1.lignes[0]) && /9\.65\.1 ×4/.test(sante1.lignes[0]) && /plateau\.js:120/.test(sante1.lignes[0]) && !/trop vieux/.test(sante1.lignes.join()) && sante1.badge === "5" && !sante1.effacer && !/Connecte-toi/.test(sante2.note) && sante2.ignore === null,
    `santé : plantages regroupés sur 7 jours, badge, déjà connecté (${sante1.etat} / ${JSON.stringify(sante1.lignes)} / badge ${sante1.badge} / ${sante2.note})`);
  await page.click("#ongletStats");
  // Pilotage du jeu (réglages à distance) : deuxième onglet de la même page
  const nbErreursStats = erreurs.length;
  await page.click("#ongletPilotage"); await page.waitForTimeout(200);
  const pil = (js) => page.evaluate(js);
  const avantConnexion = await pil(() => ({ connexion: !document.getElementById("pilConnexion").hidden, panneau: document.getElementById("pilPanneau").hidden }));
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
  verifier(!avantConnexion.connexion && !avantConnexion.panneau && connecte.panneau && connecte.uid === "UID-TEST-123" && /rien/.test(connecte.etat), `pilotage : déjà connecté avec la session de la page ( ${JSON.stringify(connecte)})`);
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
  // Onglet Public : lieux (d'après l'IP, écrits par js/stats.js), appareils, fiche par fiche, période ; rien d'injecté dans la page
  await page.evaluate(() => {
    const m = Date.now(), h = 3600000, j = 24 * h;
    window.__arbre.stats = { appareils: {
      aaaaaaaaaa01: { os: "ios", vu: m - h, version: "9.92.0", theme: "noir", type: "telephone", nav: "Safari 17", osv: "iOS 17.5", ecran: "390x844@3", langue: "fr-FR", fuseau: "Europe/Paris", pays: "FR", region: "Occitanie", ville: "Toulouse", fai: "Orange S.A.", installe: true },
      aaaaaaaaaa02: { os: "android", vu: m - 2 * h, version: "9.92.0", type: "telephone", nav: "Chrome 126", osv: "Android 14", ecran: "412x915@2.63", langue: "fr-FR", fuseau: "Europe/Paris", pays: "FR", region: "Occitanie", ville: "Toulouse", fai: "Free SAS" },
      aaaaaaaaaa03: { os: "android", vu: m - 3 * j, version: "9.92.0", type: "tablette", nav: "Instagram", osv: "Android 13", ecran: "800x1280@2", langue: "fr-BE", fuseau: "Europe/Brussels", pays: "BE", region: "Bruxelles", ville: "Bruxelles", fai: "Proximus NV" },
      aaaaaaaaaa04: { os: "ordi", vu: m - 20 * j, version: "9.92.0", type: "ordi", nav: "Edge 126", osv: "Windows 11", ecran: "1920x1080@1", langue: "en-CA", fuseau: "America/Toronto", pays: "CA", region: "Québec", ville: "Montréal", fai: "<img src=x onerror=window.__injecte=1>" },
      aaaaaaaaaa05: { os: "ios", vu: m - 5 * h, version: "9.91.1", theme: "noir" },
      aaaaaaaaaa06: { os: "ios", vu: m - 200 * j, version: "9.80.0", pays: "JP", ville: "Tokyo", type: "telephone" } } };
    window.__notifier();
  });
  await page.click("#ongletPublic"); await page.waitForTimeout(300);
  const lirePublic = () => page.evaluate(() => {
    const barres = (id) => [...document.querySelectorAll("#" + id + " .barre")].map((b) => b.querySelector(".nom").textContent + " = " + b.querySelector(".pc").textContent);
    const visibles = [...document.querySelectorAll('.pan[data-groupe="public"]')].filter((p) => getComputedStyle(p).display !== "none").map((p) => p.dataset.pan);
    return { pays: document.getElementById("pubPays").textContent, villes: document.getElementById("pubVilles").textContent, appareils: document.getElementById("pubAppareils").textContent, legende: document.getElementById("pubLegende").textContent,
      bPays: barres("barresPays"), bVilles: barres("barresVilles"), bFai: barres("barresFai"), bTypes: barres("barresTypes"), bOsv: barres("barresOsv"), bNav: barres("barresNav"), bEcrans: barres("barresEcrans"), bLangues: barres("barresLangues"), bFuseaux: barres("barresFuseaux"), bOs: barres("barresOs"), bVersions: barres("barresVersions"),
      fiches: [...document.querySelectorAll("#pubListe .appLigne")].map((l) => l.textContent), images: document.querySelectorAll("#vuePublic img").length, injecte: !!window.__injecte, visibles,
      plus: !document.getElementById("pubVoirPlus").hidden, largeur: document.documentElement.scrollWidth,
      debord: [...document.querySelectorAll("#vuePublic .barre, #vuePublic .sousMenu button, #vuePublic .appLigne")].some((e) => e.getBoundingClientRect().right > 391) };
  });
  const pub30 = await lirePublic();
  verifier(pub30.pays === "3" && pub30.villes === "3" && pub30.appareils === "5" && /4 localisés sur 5/.test(pub30.legende) && /France = 2 · 50 %/.test(pub30.bPays[0]) && pub30.bPays.length === 3 && /Toulouse = 2 · 50 %/.test(pub30.bVilles[0])
    && pub30.bFai.length === 4 && pub30.bTypes.join().includes("Téléphone = 2 · 50 %") && pub30.bOsv.join().includes("iOS 17.5") && pub30.bNav.join().includes("Instagram") && pub30.bEcrans.join().includes("1170 × 2532") && pub30.bEcrans.join().includes("1084 × 2406")
    && /Français \(France\) = 2/.test(pub30.bLangues[0]) && /Europe\/Paris · UTC\+[12] = 2/.test(pub30.bFuseaux[0]) && pub30.bOs.join().includes("iPhone = 2 · 40 %") && pub30.bVersions.join().includes("9.92.0 = 4 · 80 %"),
    `onglet Public (30 jours) : pays, villes, fournisseurs, appareils (${JSON.stringify([pub30.pays, pub30.villes, pub30.appareils, pub30.legende, pub30.bPays, pub30.bVilles, pub30.bEcrans, pub30.bLangues, pub30.bFuseaux])})`);
  verifier(pub30.fiches.length === 5 && /Toulouse, Occitanie/.test(pub30.fiches[0]) && /il y a 60 min/.test(pub30.fiches[0]) && /Orange S\.A\./.test(pub30.fiches[0]) && /Téléphone · iOS 17\.5 · Safari 17 · 1170 × 2532 · Français \(France\) · Europe\/Paris · jeu 9\.92\.0 · installé/.test(pub30.fiches[0])
    && /Lieu inconnu/.test(pub30.fiches.join("|")) && /<img src=x/.test(pub30.fiches.join("|")) && pub30.images === 0 && !pub30.injecte && !pub30.plus,
    `onglet Public : une fiche par appareil, la plus récente d'abord ; un texte piégé reste du texte (${JSON.stringify(pub30.fiches[0])}, images ${pub30.images})`);
  verifier(pub30.visibles.length === 1 && pub30.largeur <= 390 && !pub30.debord, `onglet Public : une seule rubrique affichée (${pub30.visibles}), rien ne dépasse de l'écran (largeur ${pub30.largeur})`);
  await page.click('#pubPeriode button[data-jours="7"]'); const pub7 = await lirePublic();
  await page.click('#pubPeriode button[data-jours="0"]'); const pubTout = await lirePublic();
  await page.click('.sousMenu[data-groupe="public"] button[data-pan="liste"]'); const pubListe = await lirePublic();
  verifier(pub7.appareils === "4" && pub7.pays === "2" && pubTout.appareils === "6" && pubTout.pays === "4" && pubTout.bPays.join().includes("Japon") && pubListe.visibles.join() === "liste",
    `onglet Public : période 7 jours (${pub7.appareils} appareils, ${pub7.pays} pays), depuis le début (${pubTout.appareils}, ${pubTout.pays}), rubrique « Un par un » (${pubListe.visibles})`);
  await page.click('#pubPeriode button[data-jours="30"]');

  // Pilotage rangé par rubriques : une seule affichée, celle qu'on a ouverte est retenue ; le Bar et la remise à zéro y sont rangés
  await page.click("#ongletPilotage"); await page.waitForTimeout(200);
  const rubriques = () => page.evaluate(() => ({ boutons: [...document.querySelectorAll("#pilMenu button")].map((b) => b.dataset.pan), choisie: (document.querySelector('#pilMenu button[aria-selected="true"]') || {}).dataset.pan,
    visibles: [...document.querySelectorAll('.pan[data-groupe="pilotage"]')].filter((p) => getComputedStyle(p).display !== "none").map((p) => p.dataset.pan),
    orphelins: [...document.querySelectorAll("#pilPanneau > *")].filter((e) => !e.matches(".sousMenu, .pan")).length, retenue: localStorage.getItem("alcuno_stats_rubrique_pilotage"),
    debord: [...document.querySelectorAll("#pilMenu button")].some((b) => b.scrollWidth > b.clientWidth + 1), largeur: document.documentElement.scrollWidth }));
  await page.click('#pilMenu button[data-pan="themes"]'); const rubThemes = await rubriques();
  const themesVisibles = await page.evaluate(() => ({ themes: document.getElementById("pilThemes").offsetParent !== null, annonce: document.getElementById("pilAnnonce").offsetParent !== null, reset: document.getElementById("btnReset").offsetParent !== null, bar: document.getElementById("barListe").offsetParent !== null }));
  await page.click('#pilMenu button[data-pan="bar"]'); const rubBar = await rubriques();
  const barVisible = await page.evaluate(() => ({ bar: document.getElementById("barListe").offsetParent !== null, recettes: document.querySelectorAll("#barListe .pilLigne").length, themes: document.getElementById("pilThemes").offsetParent !== null }));
  verifier(rubThemes.boutons.join() === "etat,assistant,annonce,jeu,themes,defis,bar,compte" && rubThemes.choisie === "themes" && rubThemes.visibles.join() === "themes" && rubThemes.orphelins === 0 && rubThemes.retenue === "themes" && !rubThemes.debord && rubThemes.largeur <= 390
    && themesVisibles.themes && !themesVisibles.annonce && !themesVisibles.reset && !themesVisibles.bar && rubBar.visibles.join() === "bar" && barVisible.bar && barVisible.recettes > 10 && !barVisible.themes,
    `pilotage : 8 rubriques, une seule affichée (${rubThemes.visibles} puis ${rubBar.visibles}), retenue (${rubThemes.retenue}), Bar rangé dedans (${barVisible.recettes} recettes)`);
  // Mise à jour demandée : son propre réglage (avant : seulement par une phrase à l'assistant)
  await page.fill("#pilMajMin", "9.92"); await page.click("#pilMajDemander"); await page.waitForTimeout(200);
  const majRefus = await page.evaluate(() => ({ majMin: window.__arbre.config.majMin || null, message: document.getElementById("pilMessage").textContent }));
  await page.fill("#pilMajMin", "9.92.0"); await page.click("#pilMajDemander"); await page.waitForTimeout(300);
  const majOui = await page.evaluate(() => ({ majMin: window.__arbre.config.majMin || null, etat: document.getElementById("pilMajEtat").textContent, rubrique: document.querySelector('#pilMenu button[aria-selected="true"]').dataset.pan }));
  await page.click("#pilMajRetirer"); await page.waitForTimeout(300);
  const majNon = await page.evaluate(() => ({ majMin: window.__arbre.config.majMin || null, etat: document.getElementById("pilMajEtat").textContent }));
  verifier(majRefus.majMin === null && /9\.92\.0/.test(majRefus.message) && majOui.majMin === "9.92.0" && /9\.92\.0/.test(majOui.etat) && majOui.rubrique === "jeu" && majNon.majMin === null && /rien/.test(majNon.etat),
    `pilotage : mise à jour demandée (${JSON.stringify([majRefus, majOui, majNon])})`);
  // Adresse directe vers une rubrique, et rubrique retenue d'une ouverture à l'autre
  const directe = await (async () => {
    const p3 = await nav.newPage({ viewport: { width: 390, height: 780 } });
    await brancher(p3);
    await p3.addInitScript(() => { try { localStorage.setItem("faux_utilisateur", "1"); } catch (e) {} });
    await p3.goto(url + "#pilotage-defis"); await p3.waitForTimeout(600);
    const r = await p3.evaluate(() => ({ vue: document.querySelector(".vue.actif").id, rubrique: document.querySelector('#pilMenu button[aria-selected="true"]').dataset.pan, defis: document.getElementById("pilDefiTexte").offsetParent !== null }));
    await p3.goto(url + "#public-liste"); await p3.reload(); await p3.waitForTimeout(600);
    const r2 = await p3.evaluate(() => ({ vue: document.querySelector(".vue.actif").id, rubrique: document.querySelector('.sousMenu[data-groupe="public"] button[aria-selected="true"]').dataset.pan }));
    await p3.close();
    return { r, r2 };
  })();
  verifier(directe.r.vue === "vuePilotage" && directe.r.rubrique === "defis" && directe.r.defis && directe.r2.vue === "vuePublic" && directe.r2.rubrique === "liste", `adresse directe vers une rubrique (${JSON.stringify(directe)})`);
  verifier(erreurs.length === 0 && nbErreursStats === 0, `aucune erreur dans les pages (${erreurs.length})`);
  await nav.close(); serveur.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})();
