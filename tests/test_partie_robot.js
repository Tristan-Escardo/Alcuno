// Fait jouer une partie classique complète au robot (tests/prelude.js + tests/joueur_auto.js) dans plusieurs configurations :
// téléphone debout, en paysage, avec le réglage d'accessibilité, très petit écran, dans plusieurs thèmes. Environ 1 à 2 minutes.
// Vérifie que chaque partie va jusqu'à l'écran de fin, sans erreur dans la console, et que la page ne déborde pas en largeur.
//   npm i playwright && npx playwright install chromium     (une seule fois)
//   node tests/test_partie_robot.js
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
  ".json": "application/json", ".mp3": "audio/mpeg", ".webp": "image/webp", ".gif": "image/gif" };
const serveur = http.createServer((req, res) => {
  const chemin = path.join(RACINE, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(chemin)] || "application/octet-stream" });
  fs.createReadStream(chemin).pipe(res);
});

const CONFIGS = [
  { nom: "téléphone debout, Bordeaux", largeur: 390, hauteur: 780, theme: "bordeaux" },
  { nom: "téléphone en paysage, Sombre", largeur: 750, hauteur: 390, theme: "noir" },
  { nom: "accessibilité, Star Wars", largeur: 390, hauteur: 780, theme: "galaxie", accessibilite: true },
  { nom: "petit écran + accessibilité, Givre, partie express", largeur: 320, hauteur: 640, theme: "givre", accessibilite: true, express: true }
];

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const url = `http://localhost:${serveur.address().port}/index.html?graine=12345`;
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  const nav = await chromium.launch(exe);
  const prelude = fs.readFileSync(path.join(__dirname, "prelude.js"), "utf8");
  const robot = fs.readFileSync(path.join(__dirname, "joueur_auto.js"), "utf8");

  const jouer = async (c) => {
    const page = await nav.newPage({ viewport: { width: c.largeur, height: c.hauteur } });
    await page.addInitScript(prelude);
    await page.addInitScript(robot);
    await page.addInitScript(([theme, acc, express]) => {
      try { localStorage.setItem("alcuno_theme", theme); if (acc) localStorage.setItem("alcuno_accessibilite", "1"); if (express) localStorage.setItem("alcuno_partie_express", "1"); } catch (e) {}
    }, [c.theme, !!c.accessibilite, !!c.express]);
    await page.goto(url);
    let rapport = null;
    try {
      await page.waitForSelector("#rapport", { timeout: 280000, state: "attached" });
      rapport = JSON.parse((await page.evaluate(() => document.getElementById("rapport").textContent))
        .replace("RAPPORT_DEBUT\n", "").replace("\nRAPPORT_FIN", ""));
    } catch (e) {}
    const debordement = rapport ? await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) : null;
    await page.close();
    return { c, rapport, debordement };
  };

  const resultats = await Promise.all(CONFIGS.map(jouer));
  let echecs = 0;
  for (const { c, rapport, debordement } of resultats) {
    const ok = !!rapport && rapport.fin === "ok" && rapport.erreurs.length === 0 && rapport.cartesRetournees >= rapport.cartesTotal - 1 && debordement <= 0;
    if (!ok) echecs++;
    console.log((ok ? "OK    " : "ECHEC ") + `${c.nom} : ` + (rapport
      ? `fin ${rapport.fin}, erreurs ${JSON.stringify(rapport.erreurs)}, cartes ${rapport.cartesRetournees}/${rapport.cartesTotal}, débordement ${debordement} px`
      : "pas de rapport (partie trop longue ?)"));
  }
  await nav.close();
  serveur.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
