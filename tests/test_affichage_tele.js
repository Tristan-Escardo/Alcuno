// TOUT L'AFFICHAGE DE LA TÉLÉ DANS UN THÈME : node tests/test_affichage_tele.js <thème>   (ex. kawaii)
// (le jeu doit être servi sur http://localhost:8765 : python3 -m http.server 8765 depuis le dossier du jeu)
//
// 1) Un téléphone simulé joue une partie complète en mode hot (robot : joueur_auto.js) dans ce thème ; chaque état
//    différent qu'il enverrait à la télé est gardé (plateau, annonces, pigeon, duel, +4, couleur, Cupidon, défi hot,
//    annulations, pari, récap de fin…), plus quelques états rares ajoutés à la main (carte dorée, pause, mode PJ,
//    préparation des joueurs, écran d'attente).
// 2) Chaque état est dessiné sur une vraie page télé (index.html?tele, 1280 x 720) et vérifié (voir affichage_commun.js :
//    texte moins lisible qu'avec le style de base, texte qui sort de l'écran, erreur JS).
// Résultat : liste des problèmes + planche des captures dans tests/resultats/affichage_tele/<thème>/index.html
const fs = require("fs"); const path = require("path");
const { chromium } = require("playwright");
const C = require("./affichage_commun");
const { theme, avertissements } = C.lireTheme("test_affichage_tele");
const MAX_PAR_FENETRE = 3; // variantes gardées par type d'écran (sinon une partie donne des centaines d'états)

(async () => {
  const dossier = C.preparerDossier("affichage_tele", theme);
  const b = await chromium.launch();
  const infos = [];

  // ----- 1) États envoyés à la télé pendant une partie du robot -----
  const tel = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errTel = []; tel.on("pageerror", (x) => errTel.push(x.message));
  await tel.addInitScript(fs.readFileSync(path.join(__dirname, "prelude.js"), "utf8"));
  await tel.addInitScript(fs.readFileSync(path.join(__dirname, "joueur_auto.js"), "utf8"));
  await tel.addInitScript((t) => {
    window.__optionsRobot = ["optionModeHot"];
    try { localStorage.setItem("alcuno_theme", t); ["alcuno_theme_prestige", "alcuno_theme_galaxie", "alcuno_theme_kawaii", "alcuno_theme_donjon"].forEach((k) => localStorage.setItem(k, "1")); } catch (e) {}
  }, theme);
  // relevé dans la page, à chaque changement de l'écran (le robot joue trop vite pour un relevé de l'extérieur)
  await tel.addInitScript((MAX) => {
    window.__etatsTele = []; const cles = new Set(); const parType = {};
    const relever = () => {
      let e = null; try { e = etatPourTele(); } catch (x) { return; }
      if (!e || !(e.partie || e.ecran)) return; // (pendant le pari et la fin, la partie n'est plus « lancée »)
      const ecr = e.ecran || {};
      const type = ecr.recap ? "récap de fin" : ecr.id || "plateau";
      const cle = [type, (ecr.texte || "").slice(0, 60), (ecr.choix || []).length, (ecr.cartes || []).length, type === "plateau" ? (e.regles || "").slice(0, 40) : ""].join("|");
      if (cles.has(cle) || (parType[type] || 0) >= MAX) return;
      cles.add(cle); parType[type] = (parType[type] || 0) + 1;
      window.__etatsTele.push({ nom: `${type} ${parType[type]}`, type, e: JSON.parse(JSON.stringify(e)) });
    };
    // (appel direct à chaque lot de changements : avec un délai, la fin de partie n'était jamais relevée)
    window.addEventListener("load", () => new MutationObserver(relever).observe(document.body, { childList: true, subtree: true, characterData: true }));
  }, MAX_PAR_FENETRE);
  await tel.goto(C.URL_JEU + "?graine=4242");
  const t0 = Date.now();
  process.stdout.write("partie du robot…");
  while (Date.now() - t0 < 180000) {
    if (await tel.evaluate(() => !!document.getElementById("rapport"))) break;
    await tel.waitForTimeout(500);
  }
  await tel.waitForTimeout(600); // (récap de fin)
  const etats = await tel.evaluate(() => window.__etatsTele);
  const parType = {}; etats.forEach((x) => { parType[x.type] = (parType[x.type] || 0) + 1; });
  console.log("");
  if (Date.now() - t0 >= 180000) infos.push("la partie du robot n'est pas allée au bout en 3 minutes (états gardés jusque-là)");
  errTel.forEach((m) => infos.push("erreur JS sur le téléphone pendant la partie : " + m));
  await tel.close();

  // ----- États rares ajoutés à la main (à partir d'un plateau de la partie) -----
  const plateau = (etats.find((x) => !x.e.ecran) || etats[0]).e;
  const copie = (o) => JSON.parse(JSON.stringify(o));
  const rares = [];
  rares.push({ nom: "préparation (ajout des joueurs)", e: Object.assign(copie(plateau), { cartes: [], ecran: null }) });
  rares.push({ nom: "plateau : dos de la carte dorée + carte dorée retournée", e: Object.assign(copie(plateau), { ecran: null, cartes: plateau.cartes.map((c, i) => (i === 1 ? "d" : i === 2 ? "carte_doree" : c)) }) });
  rares.push({ nom: "plateau en mode PJ", e: Object.assign(copie(plateau), { ecran: null, pj: 1 }) });
  rares.push({ nom: "pause", e: Object.assign(copie(plateau), { ecran: null, pause: true }) });
  rares.push({ nom: "annonce de la carte dorée", e: Object.assign(copie(plateau), { ecran: { id: "overlayRegleUnique", texte: "Carte dorée\nCUL SEC pour Tris !", cartes: ["carte_doree"], choix: [] } }) });
  const recap = etats.find((x) => x.e.ecran && x.e.ecran.recap);
  if (recap) {
    const r = copie(recap.e); r.ecran.recap.doree = { personne: false, soft: false, tireur: "Tris", victime: "Ylana" }; r.ecran.recap.totaux.culSecs = 1;
    rares.push({ nom: "récap de fin avec la carte dorée", e: r });
  } else infos.push("pas de récap de fin dans la partie du robot : récap avec carte dorée non vérifié");
  // Fenêtres que le robot ne croise pas (ou rarement) : ouvertes pour de vrai sur un téléphone, état relevé tel quel
  const tel2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  await tel2.goto(C.URL_JEU, { waitUntil: "load" }); await tel2.waitForTimeout(500);
  await tel2.evaluate(async () => {
    const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelectorAll("#aideAccueil").forEach((e) => e.remove());
    document.getElementById("btnModeClassique").click(); await attendre(400);
    const cont = document.getElementById("btnContinuerOptions"); if (cont) cont.click(); await attendre(400);
    for (const n of ["Tris", "Ylana", "Celien"]) { document.getElementById("nomJoueur").value = n; pd(document.getElementById("ajouterJoueur")); await attendre(120); }
    pd(document.getElementById("jouer")); await attendre(1200);
  });
  const forcer = [
    ["annulation d'une gorgée", "annulations[joueurs[1]] = 2; afficherOverlayAnnulation(1, 3)"],
    ["résultat de l'annulation", "afficherOverlayResultatAnnulation('Ylana annule ses 3 gorgées')"],
    ["carte dorée : choix", "afficherOverlayCarteDoree(0)"],
    ["tiens ta gueule", "afficherOverlayTiensGueule(1)"],
  ];
  for (const [nom, code] of forcer) {
    const e = await tel2.evaluate(async (code) => {
      document.querySelectorAll('body > [id^="overlay"]').forEach((o) => o.remove());
      try { eval(code); } catch (x) { return { erreur: x.message }; }
      await new Promise((r) => setTimeout(r, 700));
      return JSON.parse(JSON.stringify(etatPourTele()));
    }, code);
    if (e.erreur) infos.push(`« ${nom} » non vérifié (le test n'arrive plus à l'ouvrir : ${e.erreur})`);
    else rares.push({ nom, e });
  }
  await tel2.close();
  const tous = [...etats, ...rares];

  // ----- 2) Rendu sur la page télé -----
  const tv = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erreurs = []; tv.on("pageerror", (x) => erreurs.push(x.message));
  await tv.addInitScript(C.scriptMesure());
  await tv.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "*,*::before,*::after{transition:none!important}"; document.head.appendChild(s); }));
  await tv.goto(C.URL_JEU + "?tele", { waitUntil: "load" }); await tv.waitForTimeout(1200);
  const ecrans = [];
  // écran d'attente (QR code) : toujours en Bordeaux, avant qu'un téléphone soit relié (voulu, js/tele.js)
  await tv.screenshot({ path: path.join(dossier, "00_attente.png") });
  ecrans.push({ nom: "écran d'attente (toujours Bordeaux, voulu)", problemes: [], images: ["00_attente.png"] });
  let n = 0;
  for (const { nom, e } of tous) {
    n++;
    const debut = erreurs.length;
    const etat = Object.assign(copie(e), { theme, voix: 0, musique: 0, sons: [], envols: [], rappel: null, eau: null });
    await tv.evaluate((etat) => dessinerTele(document.getElementById("ecranTele"), etat), etat);
    await tv.waitForTimeout(500);
    const r = await C.verifierEcran(tv, theme, "tele", false);
    erreurs.slice(debut).forEach((m) => r.problemes.push(`ERREUR JS      ${m}`));
    const img = String(n).padStart(3, "0") + "_" + nom.replace(/[^\wÀ-ÿ]+/g, "_").slice(0, 40) + ".png";
    await tv.screenshot({ path: path.join(dossier, img) });
    ecrans.push({ nom, problemes: r.problemes, images: [img] });
    process.stdout.write(r.problemes.length ? "x" : ".");
  }
  console.log("");
  infos.push("types d'écrans vus : " + Object.keys(parType).sort().join(", ") + " + états ajoutés à la main");
  // fenêtres que le jeu sait créer mais que la partie du robot n'a pas montrées
  const toutes = new Set();
  for (const f of fs.readdirSync(path.join(C.RACINE, "js")).filter((f) => f.endsWith(".js")))
    for (const m of fs.readFileSync(path.join(C.RACINE, "js", f), "utf8").matchAll(/\.id\s*=\s*"(overlay[A-Za-z]+)"/g)) toutes.add(m[1]);
  const vues = new Set([...Object.keys(parType), ...tous.map((x) => x.e.ecran && x.e.ecran.id)]);
  const manquantes = [...toutes].filter((x) => !vues.has(x) && x !== "overlayFinUnRestants");
  if (manquantes.length) infos.push("fenêtres non vues sur la télé pendant cette partie (à regarder à la main, ou changer la graine) : " + manquantes.join(", "));
  C.ecrirePlanche(dossier, `Affichage de la télé : thème ${theme}`, ecrans);
  C.conclure(`Affichage de la télé : thème ${theme}`, dossier, ecrans, avertissements, infos);
  await b.close();
})();
