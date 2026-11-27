// Duel Shifumi en mode CLASSIQUE (un seul téléphone) : chacun son tour choisit pierre, feuille ou ciseaux, une carte
// Shifumi de dos apparaît à chaque choix, puis les deux se retournent.
// Vérifie : le choix entre Classique / Shifumi, les cartes de dos (rien du choix à l'écran ni vers la télé), le dos de
// chaque thème, égalité ×2, gorgées du perdant, un bot qui joue tout seul, et la reprise d'une partie coupée.
//   node tests/test_shifumi_classique.js        (CAPTURES=dossier : garde des captures ; THEME=givre : un autre thème)
const http = require("http"), fs = require("fs"), path = require("path");
function charger(){
  for (const nom of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { return require(nom); } catch (e) {} }
  console.error("Playwright est introuvable"); process.exit(2);
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
let echecs = 0;
const verifier = (ok, msg) => { console.log((ok ? "OK    " : "ECHEC ") + msg); if (!ok) echecs++; };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const THEME = process.env.THEME || "bordeaux";
const CAPTURES = process.env.CAPTURES || "";

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const url = `http://localhost:${serveur.address().port}/index.html`;
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  const nav = await chromium.launch(exe);
  const ctx = await nav.newContext({ viewport: { width: 390, height: 780 } });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.addInitScript((t) => { try {
    if (!sessionStorage.getItem("__init")) {
      sessionStorage.setItem("__init", "1");
      localStorage.setItem("alcuno_theme", t); localStorage.setItem("alcuno_tutoriel", "vu");
      for (const cle of ["alcuno_theme_galaxie", "alcuno_theme_donjon", "alcuno_theme_kawaii"]) localStorage.setItem(cle, "1"); // (thèmes secrets débloqués)
      localStorage.setItem("alcuno_premiere_partie_jouee", "1"); localStorage.setItem("alcuno_aide_vue", "1"); localStorage.removeItem("alcuno_bots");
    }
  } catch (e) {} }, THEME);
  const capture = async (nom) => { if (CAPTURES) await p.screenshot({ path: path.join(CAPTURES, `classique_${THEME}_${nom}.png`) }); };
  await p.goto(url); await attendre(1200);
  await p.evaluate(() => { window.__sons = []; const o = jouerSon; jouerSon = (n, c) => { window.__sons.push(n); return o(n, c); }; });

  // Partie de 3 : Tris, Ylana, Max
  await p.evaluate(async () => {
    const at = (ms) => new Promise((r) => setTimeout(r, ms));
    const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    document.getElementById("btnModeClassique").click(); await at(400);
    const c = document.getElementById("btnContinuerOptions"); if (c) c.click(); await at(400);
    for (const n of ["Tris", "Ylana", "Max"]) { document.getElementById("nomJoueur").value = n; pd(document.getElementById("ajouterJoueur")); await at(120); }
    pd(document.getElementById("jouer")); await at(1500);
  });
  const tap = (sel, texte) => p.evaluate(([sel, texte]) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && (!texte || e.innerText.includes(texte)));
    if (!el) return false;
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    return true;
  }, [sel, texte || ""]);
  const lire = () => p.evaluate(() => {
    const o = document.getElementById("overlayDuel");
    const vis = (sel) => o ? [...o.querySelectorAll(sel)].filter((e) => e.getClientRects().length) : [];
    const t = (sel) => vis(sel).map((e) => e.innerText.replace(/\s+/g, " ").trim()).join(" | ");
    return {
      ouvert: !!o, options: vis(".shifumi-option").length, cartes: vis(".shifumi-carte-jeu").length,
      retournees: vis(".shifumi-carte-jeu.retournee").length,
      faces: vis(".shifumi-face-image").map((f) => f.textContent).join(""),
      info: t(".shifumi-info"), resultat: t(".shifumi-resultat"), titre: t(".duel-main-title"),
      tele: JSON.stringify((etatPourTele().ecran) || {}),
      regles: (document.getElementById("overlayRegleUnique") || {}).innerText || ""
    };
  });
  const attendreQue = async (test, ms = 8000) => { const t0 = Date.now(); let e; while (Date.now() - t0 < ms) { e = await lire(); if (test(e)) return e; await attendre(100); } return e; };
  const fermerAnnonces = () => p.evaluate(async () => {
    for (let i = 0; i < 30 && (duelEnCours || document.getElementById("overlayRegleUnique")); i++) {
      const o = document.getElementById("overlayRegleUnique"); if (o) fermerOverlayRegleUnique();
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  const lancerDuel = async (type, a, b, carte = "sept_vert") => {
    await p.evaluate((carte) => { paquetDuel.splice(0, paquetDuel.length, carte, "deux_bleu", "neuf_rouge", "cinq_jaune"); lancerOverlayChoixDuel(indexJoueur % joueurs.length, "quatre_vert"); }, carte);
    await attendre(300);
    const types = await p.evaluate(() => [...document.querySelectorAll("#overlayDuel .duel-boutons .bouton-pigeon")].map((b) => b.innerText));
    await tap("#overlayDuel .duel-boutons .bouton-pigeon", type); await attendre(500);
    await tap("#overlayDuel .duel-boutons .bouton-pigeon", a); await attendre(150);
    await tap("#overlayDuel .duel-boutons .bouton-pigeon", b); await attendre(700);
    return types;
  };
  // (qui est j1 : celui dont c'est le tour de choisir, ou le joueur du bas)
  const ordre = () => p.evaluate(() => [...document.querySelectorAll("#overlayDuel .duel-vs-nom")].map((n) => n.textContent));

  // ===== 1) CARTES =====
  const types = await lancerDuel("Shifumi", "Tris", "Ylana");
  verifier(types.length === 3 && /Classique/.test(types[0]) && /Shifumi/.test(types[1]) && /Réflexe/.test(types[2]), `choix du duel en classique : ${types.join(" / ")}`);
  let [A, B] = await ordre();
  let e = await lire();
  verifier(e.options === 3 && e.cartes === 0 && e.info.includes(`${A} : fais ton choix`), `cartes : ${A} choisit en premier, 3 choix, aucune carte (${e.info})`);
  verifier(!/✊|✋|✌/.test(JSON.parse(e.tele).texte || ""), "rien des choix dans ce qui part vers la télé");
  await capture("cartes_1");
  await tap("#overlayDuel .shifumi-option", "Pierre"); await attendre(300);
  e = await lire();
  verifier(e.cartes === 1 && e.retournees === 0 && e.options === 3 && e.info.includes(`${B} : fais ton choix`), `1er choix : une carte de dos apparaît, au tour de ${B}`);
  verifier(!/Pierre|✊/.test(e.info + e.resultat + e.tele) && !e.faces, "la carte de dos ne dit rien du choix (ni à l'écran ni vers la télé)");
  const dos = await p.evaluate(() => ({ theme: document.documentElement.dataset.theme, image: getComputedStyle(document.querySelector("#overlayDuel .shifumi-carte-jeu .shifumi-carte-dos")).backgroundImage,
    givre: getComputedStyle(document.querySelector("#overlayDuel .shifumi-carte-jeu .shifumi-carte-dos"), "::before").backgroundImage }));
  const dosAttendu = { galaxie: "dos_shifumi_galaxie", kawaii: "dos_shifumi_kawaii", donjon: "dos_shifumi_donjon" }[dos.theme] || "dos_shifumi.svg";
  verifier(dos.theme === THEME && dos.image.includes(dosAttendu) && (THEME === "givre") === /givre_/.test(dos.givre), `dos de la carte Shifumi en ${dos.theme} : ${dos.image.split("/").pop()}${/givre_/.test(dos.givre) ? " + givre" : ""}`);
  await attendre(400); await capture("cartes_2");
  await tap("#overlayDuel .shifumi-option", "Pierre"); await attendre(300);
  e = await lire();
  verifier(e.cartes === 2 && e.retournees === 0 && e.options === 0, "2e choix : deuxième carte de dos, plus de boutons, suspense");
  e = await attendreQue((x) => /Égalité/.test(x.resultat));
  verifier(e.retournees === 2 && e.faces === "✊✊" && /×2/.test(e.titre), `les 2 cartes se retournent : égalité, ×2 (${e.faces} ${e.titre})`);
  verifier(/Pierre/.test(JSON.parse(e.tele).texte), "après la révélation, la télé montre les choix");
  e = await attendreQue((x) => x.options === 3 && x.cartes === 0);
  verifier(e.options === 3 && e.cartes === 0, "on rejoue : table vide, 3 choix");
  await tap("#overlayDuel .shifumi-option", "Ciseaux"); await attendre(250);
  await tap("#overlayDuel .shifumi-option", "Pierre");
  e = await attendreQue((x) => /gagne/.test(x.resultat));
  verifier(e.resultat.includes(`${A} a perdu, ${B} gagne`), `ciseaux contre pierre : ${e.resultat}`);
  await attendre(700); await capture("cartes_3");
  e = await attendreQue((x) => /boit/.test(x.regles), 8000);
  verifier(e.regles.includes(`${A} boit 14 gorgées`), `le perdant boit 7 × 2 = 14 gorgées (${e.regles.split("\n")[0]})`);
  await fermerAnnonces();

  // ===== 3) Reprise d'une partie coupée : les duels Shifumi (tirés pour de vrai) se rejouent à l'identique =====
  // Nouvelle partie jouée par le robot des tests (tests/auto_en_ligne.js, marche aussi en classique) ; à chaque 4 tiré, le
  // test prend la main : Shifumi aux 2 premiers duels. Puis la page est rechargée et la partie reprise.
  await p.evaluate(() => { localStorage.removeItem("alcuno_partie_classique"); });
  await p.goto(url); await attendre(1200);
  await p.evaluate(async () => {
    const at = (ms) => new Promise((r) => setTimeout(r, ms));
    const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    if (document.getElementById("ecranReprise").style.display !== "none") document.getElementById("btnRepriseNon").click();
    document.getElementById("btnModeClassique").click(); await at(400);
    const c = document.getElementById("btnContinuerOptions"); if (c) c.click(); await at(400);
    for (const n of ["Tris", "Ylana", "Max"]) { document.getElementById("nomJoueur").value = n; pd(document.getElementById("ajouterJoueur")); await at(120); }
    pd(document.getElementById("jouer")); await at(1500);
  });
  await p.evaluate(fs_auto => { (0, eval)(fs_auto); window.__laisserDuels = true; }, fs.readFileSync(path.join(__dirname, "auto_en_ligne.js"), "utf8"));
  const duelsJoues = [];
  const t0 = Date.now();
  await p.evaluate(() => window.__auto.start());
  while (duelsJoues.length < 2 && Date.now() - t0 < 150000) {
    const typeVisible = await p.evaluate(() => [...document.querySelectorAll("#overlayDuel .duel-boutons .bouton-pigeon")].some((b) => /Shifumi/.test(b.innerText)));
    if (!typeVisible) {
      if (await p.evaluate(() => !!document.querySelector("#overlayFinUnRestants"))) break;
      // (le robot ne tire les cartes qu'à « À toi », du mode en ligne : en classique, c'est le test qui les tire)
      await p.evaluate(() => {
        if (document.querySelector('body > [id^="overlay"]') || !plateauLibre()) return;
        const c = document.querySelector("#plateau .Carte:not(.retournee)"); if (c) c.click();
      });
      await attendre(150); continue;
    }
    await p.evaluate(() => window.__auto.stop());
    await tap("#overlayDuel .duel-boutons .bouton-pigeon", "Shifumi"); await attendre(500);
    // les 2 premiers joueurs proposés (s'il y en a 3)
    for (let i = 0; i < 2; i++) { await p.evaluate(() => { const b = [...document.querySelectorAll("#overlayDuel .duel-boutons .bouton-pigeon")].find((x) => !x.disabled); if (b) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }); await attendre(150); }
    await attendre(600);
    const [premier, second] = duelsJoues.length === 0 ? ["Feuille", "Pierre"] : ["Ciseaux", "Feuille"];
    await tap("#overlayDuel .shifumi-option", premier); await attendre(250);
    await tap("#overlayDuel .shifumi-option", second);
    const fin = await attendreQue((x) => /gagne/.test(x.resultat), 8000);
    duelsJoues.push(fin.resultat);
    await attendreQue((x) => !x.ouvert, 8000);
    await p.evaluate(() => window.__auto.start());
  }
  verifier(duelsJoues.length === 2, `deux vrais duels Shifumi joués en partie (${duelsJoues.join(" ; ")})`);
  await p.evaluate(() => window.__auto.stop());
  await p.waitForFunction(() => typeof plateauLibre === "function" && plateauLibre() && !document.querySelector('body > [id^="overlay"]'), null, { timeout: 20000 }).catch(() => {});
  await attendre(800);
  const etat = () => p.evaluate(() => JSON.stringify({ g: gorgeesBues, d: statsPartie.duels, faces: [...document.querySelectorAll("#plateau .Carte")].map((c) => c.className.replace(/\s+/g, " ")).join("|").length,
    retournees: document.querySelectorAll("#plateau .Carte.retournee").length, shifumi: sauvegardeClassique.actions.filter((x) => x.startsWith("shifumi:")).length }));
  const avant = await etat();
  if (process.env.DEBUG) console.log("avant : duelEnCours=" + await p.evaluate(() => duelEnCours));
  if (process.env.DEBUG) console.log(await p.evaluate(() => sauvegardeClassique.actions.filter((x) => /duel|shifumi/.test(x)).join(" ")));
  await p.reload(); await attendre(1500);
  const proposee = await p.evaluate(() => document.getElementById("ecranReprise").style.display !== "none");
  if (process.env.DEBUG) {
    p.on("console", (m) => { if (m.text().startsWith("DBG")) console.log(m.text()); });
    await p.evaluate(() => {
      for (const nom of ["terminerDuel", "annoncerBoireAvecAnnulation", "afficherOverlayShifumiCartes", "afficherOverlayShifumiPartage", "afficherOverlayTirageDuel", "lancerOverlayChoixDuel", "lancerPartie"]) {
        const o = window[nom]; window[nom] = function(...a){ console.log("DBG " + nom + " " + JSON.stringify(a.filter((x) => typeof x !== "object")) + " gen=" + generationPartie + " ratt=" + rattrapageEnCours); return o.apply(this, a); };
      }
      const r = window.rejouerActionClassique; window.rejouerActionClassique = function(id){ const x = r(id); if (/duel|shifumi/.test(id)) console.log("DBG rejoue " + id + " => " + x); return x; };
    });
  }
  await p.evaluate(() => document.getElementById("btnRepriseOui").click());
  await p.waitForFunction(() => !document.getElementById("ecranRattrapage"), null, { timeout: 60000 });
  // (si la dernière action était un duel, son résultat finit de s'afficher après le rejeu : « X boit… », fermé comme avant)
  await attendre(2500);
  await fermerAnnonces();
  await p.waitForFunction(() => plateauLibre() && !duelEnCours && !document.querySelector('body > [id^="overlay"]'), null, { timeout: 15000 }).catch(() => {});
  await attendre(500);
  const apres = await etat();
  if (process.env.DEBUG) console.log(await p.evaluate(() => { const o = document.getElementById("overlayDuel"); return "duelEnCours=" + duelEnCours + " choixPigeon=" + choixPigeonEnCours + " " + (o ? o.className + " :: " + o.innerText.replace(/\s+/g, " ").slice(0, 300) : "pas de duel"); }));
  verifier(proposee && avant === apres, `reprise : même partie après avoir rejoué les Shifumi\n      avant ${avant}\n      après ${apres}`);
  verifier(!(await p.evaluate(() => duelEnCours || !!document.getElementById("overlayDuel"))), "reprise : aucun duel resté ouvert");

  // ===== 4) Un bot dans le duel « cartes » : il choisit tout seul =====
  await p.evaluate(() => { botsPartie.add("Max"); });
  await lancerDuel("Shifumi", "Tris", "Max");
  [A, B] = await ordre();
  const humain = A === "Max" ? 1 : 0;
  if (humain === 0) await tap("#overlayDuel .shifumi-option", "Pierre");
  e = await attendreQue((x) => /gagne|Égalité/.test(x.resultat), 12000);
  if (humain === 1 && !/gagne|Égalité/.test(e.resultat)) { await tap("#overlayDuel .shifumi-option", "Pierre"); e = await attendreQue((x) => /gagne|Égalité/.test(x.resultat), 12000); }
  verifier(/gagne|Égalité/.test(e.resultat), `bot dans le duel : il pose sa carte tout seul (${e.resultat})`);
  await p.evaluate(() => botsPartie.delete("Max"));

  verifier(erreurs.length === 0, "aucune erreur de script " + erreurs.join(" | "));
  await nav.close(); serveur.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
