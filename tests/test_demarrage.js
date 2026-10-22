// Test rapide (environ 30 s) : le jeu démarre sans erreur dans chaque thème, et les comportements du lancement
// fonctionnent (aide du début, écran d'installation Android, déblocage Star Wars, phrases Star Wars).
// Marche sous Linux / macOS / Windows, avec Playwright :
//   npm i playwright && npx playwright install chromium     (une seule fois)
//   node tests/test_demarrage.js
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
  ".json": "application/json", ".mp3": "audio/mpeg" };
const serveur = http.createServer((req, res) => {
  const chemin = path.join(RACINE, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(chemin)] || "application/octet-stream" });
  fs.createReadStream(chemin).pipe(res);
});

const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const THEMES = ["bordeaux", "noir", "vert", "bleu", "soleil", "cerisier", "givre"];
let echecs = 0;
function verifier(ok, texte){
  console.log((ok ? "OK    " : "ECHEC ") + texte);
  if (!ok) echecs++;
}

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const url = `http://localhost:${serveur.address().port}/index.html`;
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  const nav = await chromium.launch(exe);
  const ouvrir = async (options = {}, avant) => {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 780 }, ...options });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    if (avant) await page.addInitScript(avant);
    await page.goto(url);
    await page.waitForTimeout(700);
    return { ctx, page, erreurs };
  };

  // 1. Démarrage sans erreur dans chaque thème
  for (const theme of THEMES) {
    const { ctx, page, erreurs } = await ouvrir({}, `try{localStorage.setItem("alcuno_theme","${theme}")}catch(e){}`);
    const accueil = await page.evaluate(() => getComputedStyle(document.getElementById("choixMode")).display !== "none");
    verifier(accueil && erreurs.length === 0, `thème ${theme} : accueil affiché, sans erreur ${erreurs.join(" | ")}`);
    await ctx.close();
  }

  // 2. Aide du début : dans l'appli installée, elle arrive tout de suite (moins de 2 s)
  {
    const { ctx, page } = await ouvrir({}, `Object.defineProperty(navigator,"standalone",{value:true})`);
    const t = Date.now();
    const vue = await page.waitForSelector("#aideAccueil", { timeout: 2000 }).then(() => true, () => false);
    verifier(vue, `aide du début affichée en ${Date.now() - t} ms (+ 700 ms de chargement)`);
    await ctx.close();
  }

  // 3. Android avec Chrome : si Chrome répond tard, l'écran s'ouvre avec le bouton, sans étapes d'abord
  {
    const { ctx, page, erreurs } = await ouvrir({ userAgent: UA_ANDROID, isMobile: true });
    const etat = () => page.evaluate(() => ({ ouvert: document.getElementById("ecranInstallation").style.display !== "none",
      etapes: !document.getElementById("installationEtapes").hidden, bouton: !document.getElementById("btnInstallationInstaller").hidden }));
    await page.waitForTimeout(2000);
    const avant = await etat();
    await page.evaluate(() => { const e = new Event("beforeinstallprompt"); e.prompt = () => {}; e.userChoice = Promise.resolve({}); window.dispatchEvent(e); });
    await page.waitForTimeout(500);
    const apres = await etat();
    verifier(!avant.ouvert && apres.ouvert && apres.bouton && !apres.etapes && erreurs.length === 0,
      "Android : pas d'étapes avant la réponse de Chrome, puis écran avec le bouton Installer");
    await ctx.close();
  }
  {
    const { ctx, page } = await ouvrir({ userAgent: UA_ANDROID, isMobile: true });
    await page.waitForTimeout(5500);
    const ouvert = await page.evaluate(() => document.getElementById("ecranInstallation").style.display !== "none");
    verifier(ouvert, "Android : sans réponse de Chrome, les étapes s'affichent au bout de 5 s");
    await ctx.close();
  }

  // 4. Star Wars : le déblocage ouvre le générique, puis la fenêtre « débloqué » après un tap
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.evaluate(() => debloquerGalaxie());
    await page.waitForTimeout(800);
    const generique = await page.evaluate(() => !!document.getElementById("generiqueGalaxie"));
    const duree = await page.evaluate(() => getComputedStyle(document.querySelector(".generique-texte")).animationDuration);
    await page.click("#generiqueGalaxie");
    await page.waitForTimeout(1500);
    const fenetre = await page.evaluate(() => !!document.getElementById("fenetreGalaxie"));
    const themeAvant = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.evaluate(() => { window.__sons = []; const origine = jouerSon; jouerSon = (nom, ...reste) => { window.__sons.push(nom); return origine(nom, ...reste); }; });
    await page.click(".fenetreGalaxie-ok");
    const sons = await page.evaluate(() => window.__sons);
    verifier(sons.length === 1 && /^sabre\//.test(sons[0]), `Star Wars : le bouton de la fenêtre joue un sabre (${sons.join(", ")})`);
    await page.waitForTimeout(800);
    const themeApres = await page.evaluate(() => document.documentElement.dataset.theme);
    verifier(themeAvant !== "galaxie" && themeApres === "galaxie", `Star Wars : thème pas mis tout seul (${themeAvant}), mis par « Que la gorgée soit avec toi » (${themeApres})`);
    verifier(generique && duree === "46.5s" && fenetre && erreurs.length === 0, `Star Wars : générique (${duree}) puis fenêtre « débloqué »`);
    await ctx.close();
  }

  // 5. Phrases Star Wars : seulement dans le thème Star Wars
  {
    const { ctx, page } = await ouvrir();
    const compter = (theme) => page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
      const vues = new Set();
      for (let i = 0; i < 150; i++) vues.add(phraseNotifTele({ joueurs: [{ n: "Tom", p: 0, s: 0 }] }));
      return [...vues].filter((x) => /Obi-Wan|Dark Vodka|Luke, je suis/.test(x)).length;
    }, theme);
    const sw = await compter("galaxie"), autre = await compter("bordeaux");
    verifier(sw === 3 && autre === 0, `phrases Star Wars : ${sw}/3 dans Star Wars, ${autre} ailleurs`);
    await ctx.close();
  }

  // 6. Duel : un tap sur un joueur joue UN son de bouton (sabre en Star Wars) et le joueur choisi se voit
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.evaluate(() => { document.documentElement.dataset.theme = "galaxie"; });
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea", "Max"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    await page.evaluate(() => { window.__sons = []; const origine = jouerSon; jouerSon = (nom, ...reste) => { window.__sons.push(nom); return origine(nom, ...reste); }; lancerOverlayChoixDuel(0, ""); });
    await page.waitForTimeout(800);
    const avant = await page.evaluate(() => getComputedStyle(document.querySelectorAll("#overlayDuel .duel-boutons button")[0]).backgroundImage);
    await (await page.$$("#overlayDuel .duel-boutons button"))[0].click();
    await page.waitForTimeout(300);
    const sons = await page.evaluate(() => window.__sons);
    const apres = await page.evaluate(() => getComputedStyle(document.querySelectorAll("#overlayDuel .duel-boutons button")[0]).backgroundImage);
    verifier(sons.length === 1 && sons[0] === "bouton" && avant !== apres && erreurs.length === 0,
      `duel Star Wars : un son au tap (${sons.join(", ")}), joueur choisi en holo (${avant !== apres ? "oui" : "non"})`);
    await ctx.close();
  }

  // 7. Les fenêtres de déblocage (Prestige, Star Wars) gardent leurs propres boutons dans tous les thèmes
  {
    const { ctx, page } = await ouvrir();
    const themes = [...THEMES, "prestige", "galaxie"];
    for (const [nom, fonction, selecteur] of [["Prestige", "afficherFenetrePrestige", ".fenetrePrestige-essayer, .fenetrePrestige-plusTard"],
        ["Star Wars", "afficherFenetreGalaxie", ".fenetreGalaxie-ok, .fenetreGalaxie-plusTard"]]) {
      const styles = [];
      for (const theme of themes) {
        styles.push(await page.evaluate(([theme, fonction, selecteur]) => {
          document.querySelectorAll("#fenetrePrestige, #fenetreGalaxie").forEach((e) => e.remove());
          document.documentElement.dataset.theme = theme;
          eval(fonction + "()");
          return [...document.querySelectorAll(selecteur)].map((b) => { const s = getComputedStyle(b);
            return [s.backgroundImage, s.backgroundColor, s.color, s.borderTopColor, s.boxShadow].join("|"); }).join("##");
        }, [theme, fonction, selecteur]));
      }
      const differents = themes.filter((_, i) => styles[i] !== styles[0]);
      verifier(differents.length === 0, `fenêtre ${nom} : mêmes boutons dans tous les thèmes ${differents.join(", ")}`);
    }
    await ctx.close();
  }

  await nav.close();
  serveur.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
