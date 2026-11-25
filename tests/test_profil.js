// Profil joueur (js/profil.js) : la fusion téléphone / profil (sans navigateur), les règles Firebase, puis le parcours complet
// dans le jeu avec un Firebase simulé (pas de réseau, pas de vrai compte Google) : connexion, sauvegarde, récupération sur un
// second téléphone, reconnexion au lancement, déconnexion, suppression ; et la connexion sans fenêtre (appli installée, fenêtre
// bloquée ou muette) : aller sur la page Google (simulée), retour dans le jeu avec le jeton.
//   node tests/test_profil.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const RACINE = path.join(__dirname, "..");
const L = require(path.join(RACINE, "js", "profil.js"));
let echecs = 0;
const verifier = (ok, message) => { console.log((ok ? "OK    " : "ECHEC ") + message); if (!ok) echecs++; };

// ===== 1. Fusion (sans navigateur) =====
{
  const tel = { debloque: { prestige: true }, stickers: { gagnes: ["chat", "cupcake"], parties: 3, fins: [100, 200] }, reglages: { theme: "noir", sons: "1" } };
  // premier envoi : pas encore de profil
  const a = L.fusionner(tel, null, null, 1000);
  verifier(a.ecrire && !a.reglagesChanges && a.profil.debloque.prestige === true && a.profil.stickers.gagnes.chat === true && a.profil.stickers.parties === 3 &&
    a.profil.reglages.maj === 1000 && a.profil.reglages.valeurs.theme === "noir" && a.nouveauxDeblocages.length === 0, "fusion : premier envoi, le profil prend ce que le téléphone a");
  // rien n'a changé : rien à écrire
  const b = L.fusionner(tel, a.profil, { maj: 1000, reglages: tel.reglages }, 2000);
  verifier(!b.ecrire && !b.reglagesChanges && b.profil.reglages.maj === 1000, "fusion : rien n'a changé, rien n'est écrit");
  // second téléphone, première connexion : union des déblocages et stickers, réglages du profil repris
  const tel2 = { debloque: { galaxie: true }, stickers: { gagnes: ["lapin"], parties: 1, fins: [300] }, reglages: { theme: "vert" } };
  const c = L.fusionner(tel2, a.profil, null, 3000);
  verifier(c.ecrire && c.reglagesChanges && c.local.reglages.theme === "noir" && c.local.debloque.prestige && c.local.debloque.galaxie &&
    c.local.stickers.gagnes.join() === "cupcake,chat,lapin" && c.local.stickers.parties === 3 && c.local.stickers.fins.join() === "100,200,300" &&
    c.nouveauxDeblocages.join() === "prestige" && c.nouveauxStickers.join() === "cupcake,chat" && c.profil.reglages.maj === 1000 && c.profil.debloque.galaxie === true,
    "fusion : second téléphone, union des déblocages et des stickers, réglages du profil repris");
  // réglage modifié sur le téléphone depuis la dernière synchronisation : il gagne
  const d = L.fusionner({ ...tel, reglages: { theme: "bleu", sons: "1" } }, c.profil, { maj: 1000, reglages: tel.reglages }, 4000);
  verifier(d.ecrire && !d.reglagesChanges && d.profil.reglages.valeurs.theme === "bleu" && d.profil.reglages.maj === 4000 && d.nouveauxDeblocages.join() === "galaxie", "fusion : réglage modifié ici, il part dans le profil (et les déblocages de l'autre téléphone arrivent)");
  // réglage modifié ailleurs, pas ici : celui du profil est repris ; un réglage absent du profil est retiré
  const e = L.fusionner(tel, d.profil, { maj: 1000, reglages: tel.reglages }, 5000);
  verifier(e.reglagesChanges && e.local.reglages.theme === "bleu" && e.profil.reglages.maj === 4000, "fusion : réglage modifié sur un autre téléphone, il est repris ici");
  const f = L.fusionner(tel, { reglages: { maj: 9, valeurs: { theme: "noir" } } }, { maj: 1, reglages: tel.reglages }, 6000);
  verifier(f.reglagesChanges && f.local.reglages.sons === undefined, "fusion : un réglage remis par défaut ailleurs l'est aussi ici");
  // données étranges dans la base : seul le connu et le bien formé est gardé
  const g = L.normaliser({ debloque: { prestige: true, pirate: true, hard: "oui" }, stickers: { gagnes: { chat: true, faux: true }, parties: -4, fins: { 0: 5, 1: "x" } }, reglages: { maj: 7, valeurs: { theme: "noir", inconnu: "x", sons: 3, voix: "x".repeat(601) } } });
  verifier(JSON.stringify(g) === JSON.stringify({ debloque: { prestige: true }, stickers: { gagnes: ["chat"], parties: 0, fins: [5] }, reglages: { maj: 7, valeurs: { theme: "noir" } }, defis: {} }), "fusion : valeurs étranges ignorées " + JSON.stringify(g));
  const defisTel = { pabc123: { t: "Danse avec {nom}.", n: "B", maj: 100 } };
  const defisDistant = { pxyz789: { t: "Tiens la main de {nom1} et regarde {nom2}.", n: "C", maj: 200 } };
  const h = L.fusionner({ debloque: {}, stickers: { gagnes: [], parties: 0, fins: [] }, reglages: {}, defis: defisTel }, { defis: defisDistant }, null, 7000);
  verifier(h.local.defis.pabc123 && h.local.defis.pxyz789 && h.profil.defis.pabc123 && h.profil.defis.pxyz789, "fusion : défis personnels locaux et distants réunis");
  const i = L.fusionner({ debloque: {}, stickers: { gagnes: [], parties: 0, fins: [] }, reglages: {}, defis: {} }, h.profil, { defis: defisTel }, 8000);
  verifier(!i.local.defis.pabc123 && i.local.defis.pxyz789, "fusion : défi supprimé localement ne revient pas à la synchronisation");
  verifier(JSON.stringify(L.fusionner(null, "n'importe quoi", null, 1).profil.debloque) === "{}", "fusion : profil et téléphone vides");
}

// ===== 2. Règles Firebase et listes du jeu =====
{
  const regles = JSON.parse(fs.readFileSync(path.join(RACINE, "database.rules.json"), "utf8")).rules.profils.$uid;
  const liste = (regle) => regle.match(/matches\(\/\^\(([^)]*)\)\$\/\)/)[1].split("|").sort().join();
  verifier(regles[".read"] === "auth != null && auth.uid === $uid" && regles[".write"] === regles[".read"] && regles.$autre[".validate"] === false, "règles Firebase : un profil n'est lu et écrit que par son propriétaire");
  verifier(liste(regles.debloque.$id[".validate"]) === Object.keys(L.DEBLOCAGES).sort().join(), "règles Firebase : mêmes déblocages que js/profil.js");
  verifier(liste(regles.reglages.valeurs.$cle[".validate"]) === L.REGLAGES.slice().sort().join() && regles.reglages.valeurs.$cle[".validate"].includes("<= " + L.VALEUR_MAX), "règles Firebase : mêmes réglages que js/profil.js");
  verifier(liste(regles.stickers.gagnes.$id[".validate"]) === L.STICKERS_CONNUS.slice().sort().join(), "règles Firebase : mêmes stickers que js/profil.js");
  verifier(regles.defis && regles.defis.$id[".validate"].includes("p") && regles.defis.$id.t[".validate"].includes("<= 160"), "règles Firebase : défis personnels synchronisés");
  const stickers = fs.readFileSync(path.join(RACINE, "js", "stickers.js"), "utf8").match(/const STICKERS = \[[\s\S]*?\n\];/)[0];
  verifier((stickers.match(/id: "([a-z]+)"/g) || []).map((m) => m.slice(5, -1)).join() === L.STICKERS_CONNUS.join(), "les stickers de js/profil.js sont ceux de js/stickers.js");
  // Chaque clé du stockage local citée existe bien dans le code du jeu
  const code = ["script.js", "index.html"].concat(fs.readdirSync(path.join(RACINE, "js")).filter((f) => f !== "profil.js").map((f) => "js/" + f)).map((f) => fs.readFileSync(path.join(RACINE, f), "utf8")).join("\n");
  const inconnues = Object.values(L.DEBLOCAGES).concat(L.REGLAGES.map((c) => "alcuno_" + c)).filter((cle) => !code.includes('"' + cle + '"'));
  verifier(inconnues.length === 0, "chaque clé gardée par le profil existe dans le jeu " + inconnues.join(", "));
  // Ce qui ne doit jamais partir : éthylotest, mouchard, partie en cours, codes
  verifier(!["ethylo", "mouchard", "mouchard_journal", "partie_en_ligne", "partie_classique", "code_invitation", "code_tele", "id_stats"].some((c) => L.REGLAGES.includes(c)), "rien de privé dans les réglages gardés (éthylotest, mouchard, parties, codes)");
}

// ===== 3. Dans le jeu, avec un Firebase simulé =====
function charger(){
  for (const nom of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(nom); } catch (e) {} }
  console.error("Playwright est introuvable (npm i playwright)"); process.exit(2);
}
const { chromium } = charger();
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
const serveur = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const chemin = path.join(RACINE, p);
  if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(chemin)] || "application/octet-stream" });
  fs.createReadStream(chemin).pipe(res);
});

// La base et le compte simulés sont gardés dans le stockage local du « téléphone » : ils survivent à un rechargement de la page
const FAUX_APP = `export const initializeApp = (config, nom) => ({ nom: nom || "[DEFAULT]" });`;
const FAUX_BASE = `
const lireArbre = () => JSON.parse(localStorage.getItem("faux_arbre") || "{}");
const decouper = (c) => String(c).split("/").filter(Boolean);
const lire = (chemin) => decouper(chemin).reduce((n, c) => (n === undefined || n === null ? undefined : n[c]), lireArbre());
const instantane = (chemin) => { const v = lire(chemin); return { val: () => (v === undefined ? null : v), exists: () => v !== undefined && v !== null }; };
window.__ecritures = [];
export const getDatabase = (appli) => ({ appli: appli && appli.nom });
export const ref = (db, chemin) => ({ chemin, appli: db && db.appli });
export const get = async (r) => instantane(r.chemin);
export const set = async (r, valeur) => {
  if (window.__panneBase) throw new Error("PERMISSION_DENIED");
  window.__ecritures.push({ chemin: r.chemin, appli: r.appli });
  const arbre = lireArbre(), m = decouper(r.chemin), dernier = m.pop(); let n = arbre;
  for (const x of m) { if (!n[x]) n[x] = {}; n = n[x]; }
  if (valeur === null) delete n[dernier]; else n[dernier] = JSON.parse(JSON.stringify(valeur));
  localStorage.setItem("faux_arbre", JSON.stringify(arbre));
};
export const remove = (r) => set(r, null);
export const update = async () => {};
export const onValue = (r, rappel) => { setTimeout(() => rappel(instantane(r.chemin)), 0); return () => {}; };
export const onChildAdded = () => () => {};
export const onDisconnect = () => ({ set: async () => {}, remove: async () => {}, cancel: async () => {} });
export const runTransaction = async (r) => ({ committed: false, snapshot: instantane(r.chemin) });
export const serverTimestamp = () => Date.now();
`;
const FAUX_AUTH = `
window.__authCharge = true;
const lireCompte = () => JSON.parse(localStorage.getItem("faux_compte") || "null");
const ecouteurs = [];
let courant = lireCompte();
const prevenir = () => ecouteurs.forEach((f) => f(courant));
export const getAuth = (appli) => ({ appli: appli && appli.nom });
export const onAuthStateChanged = (a, f) => { window.__appliAuth = a.appli; ecouteurs.push(f); setTimeout(() => f(courant), 0); };
export class GoogleAuthProvider {}
export class OAuthProvider { constructor(id){ this.id = id; } credential(o){ return { fournisseur: this.id, jeton: o.idToken, rawNonce: o.rawNonce }; } }
// (comme le vrai Firebase : le jeton porte l'empreinte SHA-256 du nombre, qui doit être fourni en clair, sinon missing-or-invalid-nonce)
export const signInWithCredential = async (a, c) => {
  const contenu = JSON.parse(atob(c.jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(c.rawNonce || ""));
  const hache = Array.from(new Uint8Array(h), (o) => o.toString(16).padStart(2, "0")).join("");
  if (c.fournisseur !== "google.com" || !c.rawNonce || contenu.nonce !== hache) { const e = new Error("x"); e.code = "auth/missing-or-invalid-nonce"; throw e; }
  localStorage.setItem("faux_jeton", c.jeton);
  courant = { uid: "u1", displayName: "Tom", email: "tom@example.com" };
  localStorage.setItem("faux_compte", JSON.stringify(courant)); prevenir();
  return { user: courant };
};
export const signInWithPopup = async () => {
  localStorage.setItem("faux_popup", "1");
  if (window.__erreurPopup === "muette") return new Promise(() => {}); // (fenêtre qui ne s'ouvre pas et ne répond jamais : appli installée sur iPhone)
  if (window.__erreurPopup) { const e = new Error("x"); e.code = window.__erreurPopup; throw e; }
  courant = { uid: "u1", displayName: "Tom", email: "tom@example.com" };
  localStorage.setItem("faux_compte", JSON.stringify(courant)); prevenir();
  return { user: courant };
};
export const signOut = async () => { courant = null; localStorage.removeItem("faux_compte"); prevenir(); };
export const deleteUser = async () => { window.__compteEfface = true; courant = null; localStorage.removeItem("faux_compte"); prevenir(); };
`;

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const url = `http://localhost:${serveur.address().port}/index.html?modetest=1`;
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  const nav = await chromium.launch(exe);
  const erreurs = [];
  // Un « téléphone » : son propre stockage local, rempli avant le premier lancement
  const racine = url.replace(/index\.html.*$/, "");
  const telephone = async (stockage, installee) => {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    // La page Google (simulée) : elle renvoie dans le jeu, avec un jeton (« ok »), un refus du joueur (« refus »), un jeton qui ne porte
    // pas le bon nombre (« faux ») ou une réponse à un autre départ (« autre »)
    const google = { demandes: [], reponse: "refus" };
    const jeton = (nonce) => "e30." + Buffer.from(JSON.stringify({ sub: "u1", nonce })).toString("base64url") + ".x";
    await page.route("https://accounts.google.com/**", (r) => {
      const u = new URL(r.request().url()), e = u.searchParams.get("state"), n = u.searchParams.get("nonce");
      google.demandes.push(u);
      const suite = { refus: `error=access_denied&state=${e}`, ok: `state=${e}&id_token=${jeton(n)}&authuser=0`, faux: `state=${e}&id_token=${jeton("autre")}`, autre: `state=0000&id_token=${jeton(n)}` }[google.reponse];
      r.fulfill({ contentType: "text/html", body: `<script>location.replace(${JSON.stringify(url + "#" + suite)})</script>` });
    });
    if (installee) await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "standalone", { get: () => true, configurable: true });
      // (comme sur un iPhone lent : la configuration Firebase, posée par le script module de index.html, arrive 2 s après js/profil.js)
      Object.defineProperty(window, "CONFIG_FIREBASE", { configurable: true, get: () => undefined,
        set: (v) => setTimeout(() => Object.defineProperty(window, "CONFIG_FIREBASE", { value: v, writable: true, configurable: true }), 2000) });
    });
    page.on("pageerror", (e) => erreurs.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.route("**/firebase-app.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_APP }));
    await page.route("**/firebase-database.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_BASE }));
    await page.route("**/firebase-auth.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_AUTH }));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.addInitScript((s) => {
      if (localStorage.getItem("faux_pret")) return; // (seulement au premier lancement, pas aux rechargements)
      localStorage.setItem("faux_pret", "1"); localStorage.setItem("alcuno_aide_vue", "1");
      Object.keys(s).forEach((k) => localStorage.setItem(k, s[k]));
    }, stockage);
    await page.goto(url); await page.waitForTimeout(1500);
    return { ctx, page, google };
  };
  const etat = (page) => page.evaluate(() => ({
    bouton: document.getElementById("btnProfilConnexion").textContent.trim(), google: document.getElementById("btnProfilConnexion").classList.contains("btnGoogle"), note: document.getElementById("texteProfil").textContent,
    supprimer: !document.getElementById("ligneProfilSupprimer").hidden, lie: localStorage.getItem("alcuno_profil"),
    profil: (JSON.parse(localStorage.getItem("faux_arbre") || "{}").profils || {}).u1 || null,
    reglagesOuverts: getComputedStyle(document.getElementById("ecranReglages")).display !== "none",
    theme: document.documentElement.dataset.theme || "", authCharge: !!window.__authCharge, appliAuth: window.__appliAuth || "",
    ecritures: (window.__ecritures || []).map((e) => e.chemin + "@" + e.appli).join(),
    adresse: location.href, aller: localStorage.getItem("alcuno_profil_aller"), jeton: localStorage.getItem("faux_jeton"), popup: localStorage.getItem("faux_popup"),
    desactive: document.getElementById("btnProfilConnexion").disabled }));

  // --- Téléphone A : Prestige débloqué, album découvert, 2 stickers, thème noir ---
  const A = await telephone({ alcuno_theme_prestige: "1", alcuno_album_decouvert: "1", alcuno_theme: "noir",
    alcuno_stickers: JSON.stringify({ gagnes: ["cupcake", "chat"], parties: 3, fins: [100, 200] }), alcuno_ethylo: JSON.stringify({ poids: 70, sexe: "h" }) });
  let a = await etat(A.page);
  verifier(!a.authCharge && a.lie === null, "sans profil : l'authentification n'est pas téléchargée au lancement");
  await A.page.click("#btnReglages"); await A.page.waitForTimeout(700);
  a = await etat(A.page);
  const visible = await A.page.evaluate(() => { const b = document.querySelector('#ecranReglages [data-cle="compte"]'); return b.offsetHeight > 0 && b.dataset.groupe === "appareil" && b.nextElementSibling.dataset.cle === "economie"; }); // (Mode Préhistoire rangé sous le compte Google : c'est lui qui suit, plus « hors-ligne »)
  verifier(visible && a.google && a.bouton === "Se connecter avec Google" && !a.supprimer && a.authCharge && a.appliAuth === "profil" && a.profil === null,
    `Réglages : bloc « Profil joueur » visible, déconnecté, authentification prête dans sa propre appli (${a.appliAuth})`);

  // fenêtre bloquée par le navigateur : on passe par la page Google ; le joueur y renonce : retour dans les Réglages, rien à signaler
  await A.page.evaluate(() => { window.__erreurPopup = "auth/popup-blocked"; });
  await A.page.click("#btnProfilConnexion"); await A.page.waitForTimeout(3200);
  a = await etat(A.page);
  const dA = A.google.demandes[0];
  verifier(A.google.demandes.length === 1 && dA.searchParams.get("redirect_uri") === racine && dA.searchParams.get("response_type") === "id_token" && /openid/.test(dA.searchParams.get("scope")) &&
    dA.searchParams.get("nonce").length >= 32 && dA.searchParams.get("state").length >= 32 && /apps\.googleusercontent\.com$/.test(dA.searchParams.get("client_id")),
    `fenêtre Google bloquée : on va sur la page Google, qui doit revenir à l'adresse du jeu (${dA && dA.searchParams.get("redirect_uri")})`);
  verifier(/^Connecte-toi avec Google/.test(a.note) && a.bouton === "Se connecter avec Google" && !a.desactive && a.lie === null && a.aller === null && a.reglagesOuverts && !/#|access_denied/.test(a.adresse),
    `page Google quittée sans se connecter : retour dans les Réglages, rien à signaler, adresse propre (${a.note})`);
  // fenêtre fermée par le joueur : pas de message d'erreur
  await A.page.evaluate(() => { window.__erreurPopup = "auth/popup-closed-by-user"; });
  await A.page.click("#btnProfilConnexion"); await A.page.waitForTimeout(400);
  a = await etat(A.page);
  verifier(/^Connecte-toi avec Google/.test(a.note) && !(await A.page.evaluate(() => document.getElementById("btnProfilConnexion").disabled)), "fenêtre Google fermée : rien à signaler, le bouton reste utilisable");

  // connexion : le profil est créé avec ce que le téléphone a
  await A.page.evaluate(() => { window.__erreurPopup = ""; });
  await A.page.click("#btnProfilConnexion"); await A.page.waitForTimeout(700);
  a = await etat(A.page);
  verifier(a.bouton === "Se déconnecter" && a.google && a.supprimer && /Tom/.test(a.note) && a.reglagesOuverts && a.profil && a.profil.debloque.prestige === true && a.profil.debloque.album === true &&
    Object.keys(a.profil.stickers.gagnes).sort().join() === "chat,cupcake" && a.profil.stickers.parties === 3 && a.profil.reglages.valeurs.theme === "noir" && JSON.parse(a.lie).uid === "u1",
    `connexion : profil créé avec les déblocages, les stickers et les réglages du téléphone (${a.note})`);
  verifier(a.ecritures === "profils/u1@profil" && !/ethylo|example\.com|Tom/.test(JSON.stringify(a.profil)), `le profil est écrit par l'appli « profil », sans éthylotest, nom ni e-mail (${a.ecritures})`);

  // un réglage change : envoyé à la fermeture des Réglages
  const majAvant = a.profil.reglages.maj;
  await A.page.evaluate(() => document.getElementById("optionVibrations").click());
  await A.page.click("#btnFermerReglages"); await A.page.waitForTimeout(1200);
  a = await etat(A.page);
  const vibrations = await A.page.evaluate(() => localStorage.getItem("alcuno_vibrations"));
  verifier(a.profil.reglages.valeurs.vibrations === vibrations && vibrations !== null && a.profil.reglages.maj > majAvant, "réglage modifié : envoyé au profil à la fermeture des Réglages");
  // rien n'a changé : pas de nouvelle écriture
  const nbEcritures = a.ecritures.split(",").length;
  await A.page.click("#btnReglages"); await A.page.waitForTimeout(500); await A.page.click("#btnFermerReglages"); await A.page.waitForTimeout(1000);
  verifier((await etat(A.page)).ecritures.split(",").length === nbEcritures, "rien n'a changé : rien n'est renvoyé");
  const arbreA = await A.page.evaluate(() => localStorage.getItem("faux_arbre"));
  await A.ctx.close();

  // --- Téléphone B (la base contient le profil de A) : Star Wars débloqué, 1 sticker, thème vert ---
  const B = await telephone({ faux_arbre: arbreA, alcuno_theme_galaxie: "1", alcuno_theme: "vert", alcuno_stickers: JSON.stringify({ gagnes: ["lapin"], parties: 1, fins: [300] }) });
  await B.page.click("#btnReglages"); await B.page.waitForTimeout(700);
  await B.page.click("#btnProfilConnexion"); await B.page.waitForTimeout(4500); // (les réglages du profil sont repris : la page se recharge, les Réglages se rouvrent)
  let b = await etat(B.page);
  const localB = await B.page.evaluate(() => ({ prestige: localStorage.getItem("alcuno_theme_prestige"), galaxie: localStorage.getItem("alcuno_theme_galaxie"), album: localStorage.getItem("alcuno_album_decouvert"),
    stickers: JSON.parse(localStorage.getItem("alcuno_stickers")), vibrations: localStorage.getItem("alcuno_vibrations"),
    pastilles: !document.getElementById("pastillePrestige").hidden && !document.getElementById("pastilleGalaxie").hidden, nouveau: localStorage.getItem("alcuno_prestige_nouveau"),
    fenetre: !!document.querySelector('[id^="fenetre"]') }));
  verifier(localB.prestige === "1" && localB.galaxie === "1" && localB.album === "1" && localB.stickers.gagnes.join() === "cupcake,chat,lapin" && localB.stickers.parties === 3 && localB.pastilles && localB.nouveau === null && !localB.fenetre,
    `second téléphone : déblocages et stickers des deux téléphones réunis, sans fenêtre « débloqué » ${JSON.stringify(localB)}`);
  verifier(b.theme === "noir" && localB.vibrations === vibrations && b.reglagesOuverts && b.bouton === "Se déconnecter", `second téléphone : réglages du profil repris (thème ${b.theme}), Réglages rouverts après le rechargement`);
  verifier(b.profil.debloque.galaxie === true && b.profil.debloque.prestige === true && Object.keys(b.profil.stickers.gagnes).length === 3 && b.profil.reglages.valeurs.theme === "noir", "second téléphone : ce qu'il avait en plus est parti dans le profil");

  // relancé : il se reconnecte tout seul, sans recharger ni réécrire
  await B.page.reload(); await B.page.waitForTimeout(3200);
  b = await etat(B.page);
  verifier(b.authCharge && b.bouton === "Se déconnecter" && b.ecritures === "" && b.theme === "noir" && !b.reglagesOuverts, `relancé : reconnecté tout seul, rien à écrire (${b.ecritures})`);

  // base en panne (règles pas publiées…) : le jeu continue, rien n'est perdu
  await B.page.evaluate(() => { window.__panneBase = true; localStorage.setItem("alcuno_gaucher", "1"); document.dispatchEvent(new Event("visibilitychange")); });
  await B.page.waitForTimeout(600);
  b = await etat(B.page);
  verifier(b.profil.reglages.valeurs.gaucher === undefined && b.bouton === "Se déconnecter", "base injoignable : pas d'erreur, la sauvegarde attend");
  await B.page.evaluate(() => { window.__panneBase = false; document.dispatchEvent(new Event("visibilitychange")); });
  await B.page.waitForTimeout(600);
  verifier((await etat(B.page)).profil.reglages.valeurs.gaucher === "1", "base de retour : la sauvegarde en attente part");

  // déconnexion : le téléphone garde tout, le profil en ligne aussi
  await B.page.click("#btnReglages"); await B.page.waitForTimeout(600);
  await B.page.click("#btnProfilConnexion"); await B.page.waitForTimeout(500);
  b = await etat(B.page);
  verifier(b.bouton === "Se connecter avec Google" && !b.supprimer && b.lie === null && b.profil && await B.page.evaluate(() => localStorage.getItem("alcuno_theme_prestige") === "1"), "déconnexion : le téléphone et le profil en ligne gardent tout");

  // suppression : profil effacé de la base, compte effacé, le téléphone garde ce qu'il a
  await B.page.click("#btnProfilConnexion"); await B.page.waitForTimeout(700);
  await B.page.click("#btnProfilSupprimer"); await B.page.waitForTimeout(300);
  // (confirmation à l'écran, aux couleurs du thème : plus de confirm() du navigateur)
  const confirmation = await B.page.evaluate(() => { const e = document.getElementById("ecranConfirmerRetrait"); return e.style.display !== "none" && document.getElementById("titreConfirmerRetrait").innerText; });
  verifier(confirmation === "Supprimer ton profil ?", `suppression : confirmation affichée à l'écran (${confirmation})`);
  await B.page.click("#btnConfirmerRetraitOui"); await B.page.waitForTimeout(700);
  b = await etat(B.page);
  verifier(b.profil === null && b.bouton === "Se connecter avec Google" && b.lie === null && await B.page.evaluate(() => window.__compteEfface === true && localStorage.getItem("alcuno_theme_galaxie") === "1"),
    "suppression : profil et compte effacés, le téléphone garde ses déblocages");
  await B.ctx.close();

  // --- Appli installée (écran d'accueil de l'iPhone) : jamais la fenêtre, toujours la page Google ---
  const D = await telephone({ alcuno_theme_prestige: "1" }, true);
  await D.page.click("#btnReglages"); await D.page.waitForTimeout(700);
  // en partie : on ne quitte pas le jeu
  await D.page.evaluate(() => { partieLancee = true; });
  await D.page.click("#btnProfilConnexion"); await D.page.waitForTimeout(400);
  let d = await etat(D.page);
  verifier(/Termine ta partie/.test(d.note) && !d.desactive && D.google.demandes.length === 0, `appli installée, en partie : on ne part pas chez Google (${d.note})`);
  await D.page.evaluate(() => { partieLancee = false; });
  // jeton qui ne porte pas le nombre tiré au départ : refusé
  D.google.reponse = "faux";
  await D.page.click("#btnProfilConnexion"); await D.page.waitForTimeout(3200);
  d = await etat(D.page);
  verifier(D.google.demandes.length === 1 && d.bouton === "Se connecter avec Google" && d.jeton === null && /Connexion impossible/.test(d.note) && !d.desactive && !/id_token/.test(d.adresse), `jeton qui ne répond pas à ce départ : refusé (${d.note})`);
  // réponse à un autre départ : ignorée
  D.google.reponse = "autre";
  await D.page.click("#btnProfilConnexion"); await D.page.waitForTimeout(3200);
  d = await etat(D.page);
  verifier(d.bouton === "Se connecter avec Google" && d.jeton === null && d.aller === null && !/id_token/.test(d.adresse), "réponse à un autre départ : ignorée, le jeton ne reste pas dans l'adresse");
  // connexion : aller sur la page Google, retour dans le jeu, connecté, Réglages rouverts
  D.google.reponse = "ok";
  await D.page.click("#btnProfilConnexion"); await D.page.waitForTimeout(3500);
  d = await etat(D.page);
  verifier(d.bouton === "Se déconnecter" && /Tom/.test(d.note) && d.popup === null && d.jeton && d.aller === null && d.reglagesOuverts && !/#/.test(d.adresse) && d.profil && d.profil.debloque.prestige === true && JSON.parse(d.lie).uid === "u1",
    `appli installée : connexion par la page Google sans aucune fenêtre, profil créé, Réglages rouverts (${d.note})`);
  await D.ctx.close();

  // --- Navigateur où la fenêtre Google ne répond jamais : le bouton est rendu, le tap suivant passe par la page Google ---
  const E = await telephone({});
  await E.page.click("#btnReglages"); await E.page.waitForTimeout(700);
  await E.page.evaluate(() => { window.__erreurPopup = "muette"; });
  await E.page.click("#btnProfilConnexion"); await E.page.waitForTimeout(600);
  let e5 = await etat(E.page);
  verifier(/Connexion…/.test(e5.note) && e5.desactive, "fenêtre muette : « Connexion… » pendant qu'on l'attend");
  await E.page.waitForTimeout(8000);
  e5 = await etat(E.page);
  verifier(/appuie de nouveau/.test(e5.note) && !e5.desactive && E.google.demandes.length === 0, `fenêtre muette : au bout de 8 s le bouton est rendu (${e5.note})`);
  E.google.reponse = "ok";
  await E.page.click("#btnProfilConnexion"); await E.page.waitForTimeout(3500);
  e5 = await etat(E.page);
  verifier(E.google.demandes.length === 1 && e5.bouton === "Se déconnecter" && /Tom/.test(e5.note), `fenêtre muette : le tap suivant connecte par la page Google (${e5.note})`);
  await E.ctx.close();

  // --- En anglais : le bloc est traduit ---
  const C = await telephone({ alcuno_langue: "en" });
  await C.page.click("#btnReglages"); await C.page.waitForTimeout(600);
  const c = await C.page.evaluate(() => document.querySelector('#ecranReglages [data-cle="compte"]').textContent.replace(/\s+/g, " ").trim());
  verifier(/Player profile/.test(c) && /Sign in/.test(c) && !/Connecte-toi|Profil joueur/.test(c), `anglais : bloc traduit (${c.slice(0, 60)}…)`);
  await C.ctx.close();

  // --- Écran télé : pas de profil ---
  const T = await nav.newContext({ viewport: { width: 1280, height: 720 } });
  const pageT = await T.newPage();
  pageT.on("pageerror", (e) => erreurs.push(e.message));
  await pageT.route("**/firebase-app.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_APP }));
  await pageT.route("**/firebase-database.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_BASE }));
  await pageT.route("**/firebase-auth.js", (r) => r.fulfill({ contentType: "text/javascript", body: FAUX_AUTH }));
  await pageT.addInitScript(() => localStorage.setItem("alcuno_profil", JSON.stringify({ uid: "u1", maj: 1, reglages: {} })));
  await pageT.goto(url.replace("?modetest=1", "?tele&modetest=1")); await pageT.waitForTimeout(2500);
  verifier(!(await pageT.evaluate(() => !!window.__authCharge)), "écran télé : l'authentification n'est jamais téléchargée");
  await T.close();

  verifier(erreurs.length === 0, `aucune erreur dans la page ${JSON.stringify(erreurs.slice(0, 3))}`);
  await nav.close(); serveur.close();
  console.log(echecs ? `\n${echecs} ECHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})();
