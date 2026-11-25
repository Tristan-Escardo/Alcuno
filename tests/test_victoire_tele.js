// Victoire au pari sur la dernière carte (télé et téléphone) : l'animation se joue quand quelqu'un trouve, UNE SEULE FOIS par révélation
// (le téléphone renvoie l'écran à la télé toutes les demi-secondes : les confettis et le son ne doivent pas repartir), pas quand
// personne ne trouve ni quand c'est la carte dorée, et se rejoue au pari suivant. Mouvements réduits : état final tout de suite.
// Marche sous Linux / macOS / Windows, avec Playwright :
//   npm i playwright && npx playwright install chromium     (une seule fois)
//   node tests/test_victoire_tele.js
// Il lance son propre petit serveur web. Code de sortie 0 = tout est bon.
const http = require("http");
const fs = require("fs");
const path = require("path");

function charger(){
  for (const nom of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try { return require(nom); } catch (e) {}
  }
  console.error("Playwright est introuvable (npm i playwright)");
  process.exit(2);
}
const { chromium } = charger();

const RACINE = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml",
  ".json": "application/json", ".mp3": "audio/mpeg", ".webp": "image/webp" };
const serveur = http.createServer((req, res) => {
  const chemin = path.join(RACINE, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(chemin)] || "application/octet-stream" });
  fs.createReadStream(chemin).pipe(res);
});

let echecs = 0;
function verifier(ok, texte){
  console.log((ok ? "OK    " : "ECHEC ") + texte);
  if (!ok) echecs++;
}

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const base = `http://localhost:${serveur.address().port}/index.html`;
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  const nav = await chromium.launch(exe);

  // 1) Trois révélations jouées sur un vrai téléphone : un gagnant, deux gagnants, personne, carte dorée
  const tel = await nav.newPage({ viewport: { width: 390, height: 780 } });
  const erreurs = [];
  tel.on("pageerror", (e) => erreurs.push("téléphone : " + e.message));
  await tel.addInitScript(() => { localStorage.setItem("alcuno_premiere_partie_jouee", "1"); localStorage.setItem("alcuno_tutoriel", "vu"); localStorage.setItem("alcuno_aide_vue", "1"); });
  await tel.goto(base); await tel.waitForTimeout(1200);
  await tel.evaluate(async () => {
    const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    const at = (ms) => new Promise((r) => setTimeout(r, ms));
    document.getElementById("btnModeClassique").click(); await at(400);
    const c = document.getElementById("btnContinuerOptions"); if (c) c.click(); await at(400);
    for (const n of ["Tris", "Ylana", "Max", "Léa"]) { document.getElementById("nomJoueur").value = n; pd(document.getElementById("ajouterJoueur")); await at(120); }
    pd(document.getElementById("jouer")); await at(1500);
  });
  const reveler = (choix, doree) => tel.evaluate(async ([choix, doree]) => {
    const at = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelectorAll('body > [id^="overlay"]').forEach((o) => o.remove());
    predictionEnCours = false;
    if (doree) { paquet.splice(0, paquet.length); carteDoreeEnJeu = true; } else { paquet.splice(0, paquet.length, "trois_rouge"); carteDoreeEnJeu = false; }
    lancerOverlayPrediction(0); await at(400);
    const o = document.getElementById("overlayPredictionFin");
    for (const c of choix) { o.querySelector('.fin-choix-card[data-type-id="' + c + '"]').click(); await at(150); }
    o.querySelector(".fin-choix-reveler").click(); await at(500);
    const etat = etatPourTele();
    const classes = [...(document.querySelector("#overlayPredictionFin") || { classList: [] }).classList];
    return { etat, classes, victoireTel: !!document.querySelector("#overlayPredictionFin.pari-victoire") };
  }, [choix, doree]);
  const un = await reveler(["trois", "zero", "un", "zero"], false);
  const deux = await reveler(["trois", "trois", "un", "zero"], false);
  const personne = await reveler(["zero", "un", "quatre", "zero"], false);
  const doree = await reveler(["trois", "zero", "un", "zero"], true);
  verifier(!!un.etat.ecran.pari.rv && !!deux.etat.ecran.pari.rv && !!personne.etat.ecran.pari.rv && doree.etat.ecran.pari.rv.d === 1, "révélations jouées sur le téléphone (un, deux, personne, carte dorée)");
  verifier(un.victoireTel && deux.victoireTel && !personne.victoireTel && !doree.victoireTel, `téléphone : animation de victoire seulement si quelqu'un a trouvé (${[un, deux, personne, doree].map((x) => x.victoireTel).join("/")})`);
  await tel.close();

  // 2) La télé reçoit ces états, comme le téléphone les renvoie : plusieurs fois le même, toutes les demi-secondes
  const tv = await nav.newPage({ viewport: { width: 1280, height: 720 } });
  tv.on("pageerror", (e) => erreurs.push("télé : " + e.message));
  await tv.goto(base + "?tele"); await tv.waitForTimeout(1000);
  await tv.evaluate(() => { window.__sons = []; const o = lireSon; lireSon = (n, s) => { window.__sons.push(n); return o(n, s); }; });
  const dessiner = (etat) => tv.evaluate((etat) => dessinerTele(document.getElementById("ecranTele"), Object.assign({}, etat, { voix: 0, musique: 0, sons: [], envols: [], rappel: null, eau: null })), etat);
  const mesure = () => tv.evaluate(() => ({
    victoire: !!document.querySelector("#ecranTele .tele-victoire"),
    couronnes: [...document.querySelectorAll("#ecranTele .tele-victoire-couronne")].filter((c) => c.offsetParent !== null).length, // (visibles : l'écran caché garde son contenu)
    confettis: document.querySelectorAll(".tele-confettis").length,
    morceaux: document.querySelectorAll(".tele-confetti").length,
    sonsVictoire: window.__sons.filter((n) => n === "victoire").length,
    rayons: document.querySelectorAll("#ecranTele .tele-victoire-rayons").length
  }));
  const rien = { ...un.etat, ecran: null };

  await dessiner(un.etat); await tv.waitForTimeout(400);
  let m = await mesure();
  verifier(m.victoire && m.couronnes === 1 && m.confettis === 1 && m.morceaux > 50 && m.sonsVictoire === 1 && m.rayons === 1, `un gagnant : animation lancée (${JSON.stringify(m)})`);
  for (let i = 0; i < 4; i++) { await tv.waitForTimeout(500); await dessiner(un.etat); }
  m = await mesure();
  verifier(m.confettis === 1 && m.sonsVictoire === 1 && m.couronnes === 1 && m.rayons === 1, `même état renvoyé 4 fois : pas de nouveaux confettis, un seul son, une seule couronne (${JSON.stringify(m)})`);

  await dessiner(rien); await tv.waitForTimeout(300);
  m = await mesure();
  verifier(!m.victoire && m.couronnes === 0, "écran du pari fermé : plus d'animation");
  await dessiner(deux.etat); await tv.waitForTimeout(400);
  m = await mesure();
  verifier(m.victoire && m.couronnes === 2 && m.sonsVictoire === 2, `pari suivant, deux gagnants : l'animation se rejoue, deux couronnes (${JSON.stringify(m)})`);

  await dessiner(rien); await tv.waitForTimeout(200);
  const avantM = await mesure(), avant = avantM.sonsVictoire; // (les confettis du pari précédent volent encore : on compte les nouveaux)
  await dessiner(personne.etat); await tv.waitForTimeout(400);
  m = await mesure();
  verifier(!m.victoire && m.couronnes === 0 && m.confettis === avantM.confettis && m.sonsVictoire === avant, `personne n'a trouvé : pas d'animation, pas de son (${JSON.stringify(m)})`);
  await dessiner(rien); await tv.waitForTimeout(200);
  await dessiner(doree.etat); await tv.waitForTimeout(400);
  m = await mesure();
  verifier(!m.victoire && m.couronnes === 0 && m.confettis === avantM.confettis && m.sonsVictoire === avant, `carte dorée : pas d'animation de victoire (${JSON.stringify(m)})`);
  await tv.close();

  // 3) Mouvements réduits : état final tout de suite, ni confettis ni mouvement, couronnes quand même
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  const tr = await ctx.newPage();
  tr.on("pageerror", (e) => erreurs.push("télé (mouvements réduits) : " + e.message));
  await tr.goto(base + "?tele"); await tr.waitForTimeout(1000);
  await tr.evaluate((etat) => dessinerTele(document.getElementById("ecranTele"), Object.assign({}, etat, { voix: 0, musique: 0, sons: [], envols: [], rappel: null, eau: null })), un.etat);
  await tr.waitForTimeout(300);
  m = await tr.evaluate(() => ({ finie: !!document.querySelector("#ecranTele .tele-victoire-finie"), confettis: document.querySelectorAll(".tele-confettis").length, couronnes: document.querySelectorAll("#ecranTele .tele-victoire-couronne").length }));
  verifier(m.finie && m.confettis === 0 && m.couronnes === 1, `mouvements réduits : état final tout de suite, sans confettis (${JSON.stringify(m)})`);
  await ctx.close();

  verifier(erreurs.length === 0, `aucune erreur de script ${erreurs.join(" | ")}`);
  await nav.close();
  serveur.close();
  console.log(echecs ? echecs + " ÉCHEC(S)" : "TOUT EST OK");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
