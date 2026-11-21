// Écran « Mes défis » (défis personnalisés) : le parcours complet dans le navigateur.
//   node tests/test_defis_ecran.js          (Playwright : npm i playwright && npx playwright install chromium)
// Vérifie : ouverture depuis les Réglages, niveaux hard cachés tant que le mode hard n'est pas débloqué (il est secret),
// erreurs de saisie, ajout, compteur de caractères, modification, suppression avec confirmation, liste vide, textes
// traduits en espagnol, et aucune erreur JS. Code de sortie 0 = tout est bon.
const http = require("http");
const fs = require("fs");
const path = require("path");
function charger() {
  for (const nom of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(nom); } catch (e) {} }
  console.error("Playwright est introuvable (npm i playwright)"); process.exit(2);
}
const { chromium } = charger();
const RACINE = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".mp3": "audio/mpeg" };
const serveur = http.createServer((req, res) => {
  const chemin = path.join(RACINE, decodeURIComponent(req.url.split("?")[0]).replace(/^\/$/, "/index.html"));
  if (!chemin.startsWith(RACINE) || !fs.existsSync(chemin) || fs.statSync(chemin).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(chemin)] || "application/octet-stream" });
  fs.createReadStream(chemin).pipe(res);
});

let echecs = 0;
const verifier = (nom, ok, detail) => { console.log((ok ? "OK    " : "ECHEC ") + nom + (detail ? " : " + detail : "")); if (!ok) echecs++; };

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const url = `http://localhost:${serveur.address().port}/index.html`;
  const navigateur = await chromium.launch();

  async function ouvrirJeu(initiale) {
    const ctx = await navigateur.newContext({ viewport: { width: 390, height: 820 } });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    await page.addInitScript((cles) => { try { Object.entries(cles).forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem("alcuno_aide_vue", "1"); } catch (e) {} }, initiale || {});
    await page.goto(url);
    await page.waitForTimeout(1500);
    return { ctx, page, erreurs };
  }
  const ouvrirDefis = async (page) => {
    await page.click("#btnReglages"); await page.waitForTimeout(600);
    await page.evaluate(() => document.getElementById("btnMesDefis").click()); await page.waitForTimeout(700);
  };

  // ---- Français, mode hard verrouillé
  {
    const { ctx, page, erreurs } = await ouvrirJeu({});
    await ouvrirDefis(page);
    verifier("l'écran s'ouvre", await page.evaluate(() => getComputedStyle(document.getElementById("ecranDefisPersonnels")).display !== "none"));
    const niveaux = await page.evaluate(() => Array.from(document.getElementById("niveauDefiPersonnel").options).map((o) => ({ v: o.value, cache: o.hidden || o.disabled })));
    verifier("niveaux hard cachés tant que le mode hard n'est pas débloqué", niveaux.filter((o) => /^H/.test(o.v)).every((o) => o.cache) && niveaux.filter((o) => !/^H/.test(o.v)).every((o) => !o.cache), JSON.stringify(niveaux));
    verifier("aucun mot « hard » visible dans la ligne des Réglages", await page.evaluate(() => !/hard/i.test(document.getElementById("noteDefisPersonnels").textContent)));
    verifier("liste vide : message", await page.evaluate(() => /Aucun défi/.test(document.getElementById("listeDefisPersonnels").textContent)));

    await page.fill("#texteDefiPersonnel", "Un défi sans nom");
    verifier("défi sans {nom} : erreur affichée", await page.evaluate(() => /viser quelqu/.test(document.getElementById("erreurDefiPersonnel").textContent)));
    await page.click("#btnAjouterDefiPersonnel");
    verifier("défi invalide refusé", await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("alcuno_defis_personnels") || "{}")).length === 0));

    await page.fill("#texteDefiPersonnel", "Fais un compliment à {nom}.");
    verifier("compteur de caractères", await page.evaluate(() => document.getElementById("compteurDefiPersonnel").textContent === "27/160"), await page.textContent("#compteurDefiPersonnel"));
    verifier("aperçu avec un prénom", await page.evaluate(() => /Léa/.test(document.getElementById("apercuDefiPersonnel").textContent)));
    await page.click("#btnAjouterDefiPersonnel");
    await page.waitForTimeout(300);
    verifier("défi ajouté : une carte avec son niveau", await page.evaluate(() => document.querySelectorAll(".carteDefiPersonnel").length === 1 && /Léger/i.test(document.querySelector(".badgeNiveauDefi").textContent)));
    verifier("formulaire vidé après l'ajout", await page.evaluate(() => document.getElementById("texteDefiPersonnel").value === ""));

    await page.click(".carteDefiActions button:not(.danger)");
    verifier("Modifier remplit le formulaire", await page.evaluate(() => document.getElementById("texteDefiPersonnel").value.startsWith("Fais un compliment") && /Enregistrer/.test(document.getElementById("btnAjouterDefiPersonnel").textContent)));
    await page.fill("#texteDefiPersonnel", "Fais un compliment sincère à {nom}.");
    await page.click("#btnAjouterDefiPersonnel"); await page.waitForTimeout(300);
    verifier("modification enregistrée (toujours un seul défi)", await page.evaluate(() => document.querySelectorAll(".carteDefiPersonnel").length === 1 && /sincère/.test(document.querySelector(".carteDefiTexte").textContent)));

    page.once("dialog", (d) => d.dismiss());
    await page.click(".carteDefiActions button.danger"); await page.waitForTimeout(200);
    verifier("suppression annulée : le défi reste", await page.evaluate(() => document.querySelectorAll(".carteDefiPersonnel").length === 1));
    page.once("dialog", (d) => d.accept());
    await page.click(".carteDefiActions button.danger"); await page.waitForTimeout(300);
    verifier("suppression confirmée : liste vide", await page.evaluate(() => document.querySelectorAll(".carteDefiPersonnel").length === 0 && /Aucun défi/.test(document.getElementById("listeDefisPersonnels").textContent)));
    verifier("pas d'erreur JS", erreurs.length === 0, erreurs.join(" | "));
    await ctx.close();
  }

  // ---- Mode hard débloqué : niveaux et mot « hard » visibles
  {
    const { ctx, page, erreurs } = await ouvrirJeu({ alcuno_hard_debloque: "1" });
    await ouvrirDefis(page);
    verifier("mode hard débloqué : niveaux HA et HB proposés", await page.evaluate(() => Array.from(document.getElementById("niveauDefiPersonnel").options).filter((o) => /^H/.test(o.value)).every((o) => !o.hidden && !o.disabled)));
    verifier("mode hard débloqué : la ligne en parle", await page.evaluate(() => /hard/i.test(document.getElementById("noteDefisPersonnels").textContent)));
    verifier("pas d'erreur JS", erreurs.length === 0, erreurs.join(" | "));
    await ctx.close();
  }

  // ---- Espagnol
  {
    const { ctx, page, erreurs } = await ouvrirJeu({ alcuno_langue: "es" });
    await ouvrirDefis(page);
    const texte = await page.evaluate(() => document.getElementById("ecranDefisPersonnels").innerText);
    verifier("espagnol : écran traduit", /Mis retos guardados/i.test(texte) && /Tu reto/i.test(texte) && /Aún no hay retos/i.test(texte), texte.replace(/\s+/g, " ").slice(0, 140));
    verifier("espagnol : aucun mot français restant", !/(Ton défi|Mes défis|Aucun défi|Ajouter le défi)/i.test(texte));
    verifier("pas d'erreur JS", erreurs.length === 0, erreurs.join(" | "));
    await ctx.close();
  }

  await navigateur.close();
  serveur.close();
  console.log(echecs ? `${echecs} ÉCHEC(S)` : "TOUT EST OK");
  process.exit(echecs ? 1 : 0);
})();
