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

  // 7. Fin de partie : « Terminer » ramène à l'accueil
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    await page.evaluate(() => finDePartie());
    await page.waitForSelector("#overlayFinUnRestants button.bouton-pigeon:not(.fin-revanche)");
    const recap = await page.evaluate(() => (document.querySelector("#overlayFinUnRestants .recap-sous") || {}).innerText || "");
    await page.click("#overlayFinUnRestants button.bouton-pigeon:not(.fin-revanche)");
    await page.waitForTimeout(600);
    const etat = await page.evaluate(() => ({ accueil: getComputedStyle(document.getElementById("choixMode")).display !== "none",
      jeu: getComputedStyle(document.getElementById("jeu")).display !== "none", fin: !!document.getElementById("overlayFinUnRestants") }));
    verifier(!/cartes/.test(recap), `fin de partie : pas de nombre de cartes dans le récap (« ${recap} »)`);
    verifier(etat.accueil && !etat.jeu && !etat.fin && erreurs.length === 0, `fin de partie : « Terminer » ramène à l'accueil (${JSON.stringify(etat)})`);
    await ctx.close();
  }

  // 8. Pari de la fin : une carte se choisit au doigt levé (pas en faisant défiler), avec un petit numéro dessus
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea", "Max"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    await page.evaluate(() => { paquet.splice(1); carteDoreeEnJeu = false; lancerOverlayPrediction(0); });
    await page.waitForSelector("#overlayPredictionFin .fin-choix-card");
    const sousTitreSurDeuxLignes = await page.evaluate(() => !!document.querySelector("#overlayPredictionFin .prediction-subtitle br"));
    const cartes = await page.$$("#overlayPredictionFin .fin-choix-card");
    await cartes[0].dispatchEvent("pointerdown"); // le doigt se pose (début d'un défilement) : rien ne doit être choisi
    await page.waitForTimeout(200);
    const apresPose = await page.evaluate(() => document.querySelectorAll("#overlayPredictionFin .fin-choix-numeros").length);
    const compteur = () => page.evaluate(() => [...document.querySelectorAll("#overlayPredictionFin .fin-choix-card .fin-choix-numeros b")].map((b) => b.textContent).join(","));
    await cartes[0].click(); await page.waitForTimeout(200);
    const un = await compteur();
    await cartes[0].click(); await page.waitForTimeout(200); // (même carte pour le 2e joueur : le 1 devient 2)
    const deux = await compteur();
    await cartes[1].click(); await page.waitForTimeout(200); // (autre carte pour le 3e : un 1 dessus)
    const trois = await compteur();
    verifier(sousTitreSurDeuxLignes && apresPose === 0 && un === "1" && deux === "2" && trois === "2,1" && erreurs.length === 0,
      `pari de la fin : phrase à la ligne (${sousTitreSurDeuxLignes}), rien au doigt posé (${apresPose}), compteur ${un} puis ${deux} puis ${trois}`);
    await ctx.close();
  }

  // 9. « Mauvais joueur ? » : pas quand il n'y avait qu'un joueur à choisir ; et le « NOUVEAU » du thème ne part
  //    pas en ouvrant les Réglages, seulement en essayant le thème
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    await page.evaluate(() => { indexPigeon = 0; afficherMenuPigeon(); }); // (2 joueurs : un seul autre joueur possible)
    await page.waitForTimeout(500);
    const menu2 = await page.evaluate(() => !!document.getElementById("overlayPigeon"));
    const annonce2 = await page.evaluate(() => ({ pigeon: joueurs[indexPigeon], texte: (document.getElementById("overlayRegleUnique") || { innerText: "" }).innerText.replace(/\s+/g, " ") }));
    const bandeau2 = await page.evaluate(() => !!document.getElementById("annulerChoix"));
    verifier(!menu2 && annonce2.pigeon === "Lea" && /nouveau PIGEON/.test(annonce2.texte), `pigeon à 2 joueurs : pas de choix (${menu2}), pigeon = ${annonce2.pigeon}, annonce « ${annonce2.texte.slice(0, 40)} »`);
    await ctx.close();
    const t3 = await ouvrir();
    await t3.page.click("#btnModeClassique"); await t3.page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea", "Max"]) { await t3.page.fill("#nomJoueur", nom); await t3.page.click("#ajouterJoueur"); await t3.page.waitForTimeout(250); }
    await t3.page.click("#jouer"); await t3.page.waitForTimeout(1200);
    await t3.page.evaluate(() => { indexPigeon = 0; afficherMenuPigeon(); });
    await t3.page.waitForTimeout(500);
    await (await t3.page.$("#overlayPigeon .bouton-pigeon")).click();
    await t3.page.waitForTimeout(400);
    const bandeau3 = await t3.page.evaluate(() => !!document.getElementById("annulerChoix"));
    verifier(!bandeau2 && bandeau3 && erreurs.length === 0 && t3.erreurs.length === 0, `« Mauvais joueur ? » : absent à 2 joueurs (${bandeau2}), présent à 3 (${bandeau3})`);
    await t3.ctx.close();
  }
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.evaluate(() => { localStorage.setItem("alcuno_theme_galaxie", "1"); localStorage.setItem("alcuno_galaxie_nouveau", "1"); });
    await page.reload(); await page.waitForTimeout(700);
    const avant = await page.evaluate(() => document.documentElement.classList.contains("galaxie-nouveau"));
    await page.click("#btnReglages"); await page.waitForTimeout(700);
    await page.click("#btnFermerReglages"); await page.waitForTimeout(700);
    const apresReglages = await page.evaluate(() => document.documentElement.classList.contains("galaxie-nouveau"));
    await page.click("#btnReglages"); await page.waitForTimeout(700);
    await page.click(".pastilleTheme[data-theme='galaxie']"); await page.waitForTimeout(700);
    const apresEssai = await page.evaluate(() => document.documentElement.classList.contains("galaxie-nouveau") || !!localStorage.getItem("alcuno_galaxie_nouveau"));
    verifier(avant && apresReglages && !apresEssai && erreurs.length === 0, `« NOUVEAU » : là au départ (${avant}), gardé après les Réglages (${apresReglages}), parti après l'essai (${!apresEssai})`);
    await ctx.close();
  }

  // 10. Duel à 2 joueurs : pas de choix, le tirage commence directement ; à 3 joueurs : on choisit
  {
    const ouvrirDuel = async (noms) => {
      const o = await ouvrir();
      await o.page.click("#btnModeClassique"); await o.page.waitForTimeout(800);
      for (const nom of noms) { await o.page.fill("#nomJoueur", nom); await o.page.click("#ajouterJoueur"); await o.page.waitForTimeout(250); }
      await o.page.click("#jouer"); await o.page.waitForTimeout(1200);
      await o.page.evaluate(() => lancerOverlayChoixDuel(0, ""));
      await o.page.waitForTimeout(500);
      const etat = await o.page.evaluate(() => ({ choix: document.querySelectorAll("#overlayDuel .duel-boutons button").length,
        tirage: !!document.querySelector("#overlayDuel .duel-tirage-content") }));
      return { ...o, etat };
    };
    const a = await ouvrirDuel(["Tom", "Lea"]);
    const b = await ouvrirDuel(["Tom", "Lea", "Max"]);
    verifier(a.etat.choix === 0 && a.etat.tirage && b.etat.choix === 3 && !b.etat.tirage && a.erreurs.length === 0 && b.erreurs.length === 0,
      `duel : 2 joueurs ${JSON.stringify(a.etat)} (tirage direct), 3 joueurs ${JSON.stringify(b.etat)} (choix)`);
    await a.ctx.close(); await b.ctx.close();
  }

  // 11. Thème Sombre : les boutons des fenêtres de jeu sont sombres comme ceux des menus (pas le dégradé jaune)
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea", "Max"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    const fond = async (theme) => page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      document.getElementById("overlayPigeon")?.remove();
      indexPigeon = 0; afficherMenuPigeon();
      const s = getComputedStyle(document.querySelector("#overlayPigeon .bouton-pigeon"));
      return s.backgroundImage + "|" + s.color;
    }, theme);
    const sombre = await fond("noir"), bordeaux = await fond("bordeaux");
    verifier(/rgb\(13, 11, 6\)/.test(sombre) && sombre !== bordeaux && erreurs.length === 0, `thème Sombre : boutons des fenêtres de jeu sombres (${sombre.slice(0, 50)}…)`);
    await ctx.close();
  }

  // 13. Préparation de partie sur téléphone : champ + « personne + » + « personne − » sur une ligne, « Jouer » dessous
  //     (ou à côté de « Caster » si ça tient), et la disposition revient après « Supprimer »
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    const disposition = () => page.evaluate(() => {
      const haut = (id) => Math.round(document.getElementById(id).getBoundingClientRect().top);
      return { ligne1: haut("nomJoueur") === haut("ajouterJoueur") && haut("ajouterJoueur") === haut("supprimerJoueur") || Math.abs(haut("nomJoueur") - haut("ajouterJoueur")) < 8,
        jouerSousLigne1: haut("jouer") > haut("nomJoueur") + 30, hauteurMenu: Math.round(document.getElementById("menu").getBoundingClientRect().height) };
    });
    const avant = await disposition();
    await page.click("#supprimerJoueur"); await page.waitForTimeout(600);
    await page.click("#termineSuppression"); await page.waitForTimeout(600);
    const apres = await disposition();
    verifier(avant.ligne1 && avant.jouerSousLigne1 && apres.ligne1 && apres.jouerSousLigne1 && apres.hauteurMenu < 200 && erreurs.length === 0,
      `préparation de partie : avant ${JSON.stringify(avant)}, après « Supprimer » ${JSON.stringify(apres)}`);
    await ctx.close();
  }

  // 14. Haut de partie : joueurs en pastilles, celle du joueur actif est marquée et suit le tour, le plateau est remonté
  {
    const { ctx, page, erreurs } = await ouvrir();
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea", "Max"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    const etat = () => page.evaluate(() => ({
      pastilles: document.querySelectorAll("#listeJoueurs .joueur-ligne").length,
      actives: [...document.querySelectorAll("#listeJoueurs .joueur-ligne")].map((l, i) => l.classList.contains("joueur-ligne-actif") ? i : -1).filter((i) => i >= 0),
      nom: document.getElementById("joueurActif").innerText,
      plateau: Math.round(document.getElementById("plateau").getBoundingClientRect().top) }));
    const a = await etat();
    await page.evaluate(() => { indexJoueur = 1; afficherJoueurActif(); });
    const b = await etat();
    verifier(a.pastilles === 3 && a.actives.join() === "0" && a.nom === "Tom" && b.actives.join() === "1" && b.nom === "Lea" && a.plateau < 650 && erreurs.length === 0,
      `haut de partie : ${a.pastilles} pastilles, actif ${a.nom} (${a.actives}) puis ${b.nom} (${b.actives}), plateau à ${a.plateau} px`);
    await ctx.close();
  }

  // 15. Partie express : 28 cartes au lieu de 52, de chaque famille ; le choix voyage dans la graine (en ligne)
  {
    const resultats = [];
    for (const express of [false, true]) {
      const { ctx, page, erreurs } = await ouvrir({}, express ? `try{localStorage.setItem("alcuno_partie_express","1")}catch(e){}` : "");
      await page.click("#btnModeClassique"); await page.waitForTimeout(800);
      for (const nom of ["Tom", "Lea", "Max"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
      await page.click("#jouer"); await page.waitForTimeout(1200);
      resultats.push(await page.evaluate(() => ({ cartes: document.querySelectorAll("#plateau .Carte").length, restantes: cartesRestantes(),
        familles: new Set(paquet.map(familleCarte)).size, trois: paquet.filter((c) => c.startsWith("trois")).length,
        graine: [graineExpress(5), graineExpress(5 + GRAINE_EXPRESS), graineExpress(5 + GRAINE_SANS_CARTE_DOREE + GRAINE_EXPRESS),
          graineSansCarteDoree(5 + GRAINE_SANS_CARTE_DOREE + GRAINE_EXPRESS), graineSansCarteDoree(5 + GRAINE_EXPRESS)].join() })));
      resultats[resultats.length - 1].erreurs = erreurs.length;
      await ctx.close();
    }
    const [normal, express] = resultats;
    verifier(normal.cartes === 52 && express.cartes === 28 && express.restantes === 28 && express.familles >= 8 && express.trois === 4 &&
      express.graine === "false,true,true,true,false" && normal.erreurs === 0 && express.erreurs === 0,
      `partie express : ${normal.cartes} cartes normale, ${express.cartes} en express (${express.familles} familles, ${express.trois} « 3 »), graine ${express.graine}`);
  }

  // 16. Carte dorée : étincelles derrière l'annonce et le choix de la victime ; bleues (étoiles du titre comprises) en Star Wars
  {
    const { ctx, page, erreurs } = await ouvrir({}, `try{localStorage.setItem("alcuno_theme","galaxie");localStorage.setItem("alcuno_theme_galaxie","1")}catch(e){}`);
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea", "Max"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    const lire = () => page.evaluate(() => {
      const zone = document.querySelector(".etincelles-doree");
      const bleu = (c) => { const m = c.match(/\d+/g).map(Number); return m[2] > m[0] + 60; }; // (plus de bleu que de rouge)
      return { n: zone ? zone.children.length : 0, clic: zone ? getComputedStyle(zone).pointerEvents : "",
        bleues: zone ? [...zone.children].every((e) => bleu(getComputedStyle(e).backgroundColor)) : false,
        etoiles: [...document.querySelectorAll(".doree-etincelle")].map((e) => bleu(getComputedStyle(e).color)).join() };
    });
    await page.evaluate(() => { montrerOverlayRegle("CARTE DORÉE\nTexte", "carte_doree"); habillerOverlayCarteDoree("Texte"); });
    const annonce = await lire();
    await page.evaluate(() => { montrerOverlayRegle("Une autre règle\nTexte"); });
    const apres = await lire();
    await page.evaluate(() => { document.querySelectorAll('[id^="overlay"]').forEach((e) => e.remove()); afficherOverlayCarteDoree(0); });
    const choix = await lire();
    verifier(annonce.n === 36 && annonce.clic === "none" && annonce.bleues && annonce.etoiles === "true,true" && apres.n === 0 && choix.n === 36 && choix.bleues && erreurs.length === 0,
      `carte dorée : étincelles ${annonce.n} (bleues ${annonce.bleues}, étoiles du titre ${annonce.etoiles}), retirées après (${apres.n}), au choix ${choix.n}`);
    await ctx.close();
  }

  // 17. Thème Sombre : boutons de la fenêtre de pause presque noirs au texte doré, champ de texte sans contour bleu du navigateur
  {
    const { ctx, page, erreurs } = await ouvrir({}, `try{localStorage.setItem("alcuno_theme","noir")}catch(e){}`);
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    await page.focus("#nomJoueur");
    const champ = await page.evaluate(() => { const c = getComputedStyle(document.getElementById("nomJoueur")); return { contour: c.outlineStyle, bord: c.borderColor }; });
    for (const nom of ["Tom", "Lea", "Max"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    await page.click("#listeJoueurs .joueur-ligne:nth-child(2) .btnPauseJoueur"); await page.waitForTimeout(700);
    const boutons = await page.evaluate(() => [".voletPause-ok", ".voletPause-annuler"].map((sel) => { const c = getComputedStyle(document.querySelector(sel)); return c.color + "|" + c.backgroundImage.slice(0, 40); }));
    verifier(champ.contour === "none" && /255, 2\d\d, \d+/.test(champ.bord) && boutons.every((b) => b.startsWith("rgb(255, 212, 38)") && b.includes("linear-gradient(rgb(13, 11, 6)")) && erreurs.length === 0,
      `thème Sombre : champ de texte (contour ${champ.contour}, bord ${champ.bord}), boutons de pause ${boutons.join(" ; ")}`);
    await ctx.close();
  }

  // 18. Album de stickers : conditions (classique : à la table ; en ligne : seulement soi), les 11 stickers => thème Kawaii débloqué
  {
    const { ctx, page, erreurs } = await ouvrir();
    const r = await page.evaluate(async () => {
      const o = {};
      const trier = () => lireAlbum().gagnes.slice().sort().join();
      try { localStorage.removeItem("alcuno_stickers"); localStorage.removeItem("alcuno_theme_kawaii"); localStorage.removeItem("alcuno_album_decouvert"); } catch (e) {}
      // album pas encore découvert : rien ne se gagne ni ne se compte
      enLigneActif = false; partieExpress = false;
      statsPartie = { pigeon: { Tom: 1 }, plusGros: {}, annulees: {}, duels: {}, plus4: {}, doree: null };
      stickersFinDePartie(); stickerPause("Tom"); gagnerStickers(["lapin"]);
      o.sansAlbum = JSON.stringify(lireAlbum());
      localStorage.setItem("alcuno_album_decouvert", "1");
      o.avantKawaii = kawaiiDebloque() + "/" + document.getElementById("pastilleKawaii").hidden;
      // classique : une partie express avec pigeon, duel, annulation, +4 et carte dorée
      enLigneActif = false; partieExpress = true;
      statsPartie = { pigeon: { Tom: 1 }, plusGros: {}, annulees: { Lea: 1 }, duels: { Max: 1 }, plus4: { Tom: 2 }, doree: { tireur: "Tom", victime: "Lea" } };
      stickersFinDePartie();
      o.partie1 = trier();
      o.kawaii7 = kawaiiDebloque();
      stickerPause("Tom"); // 8e sticker : Fraise
      o.partie1b = trier();
      o.kawaii8 = kawaiiDebloque() + "/" + document.getElementById("pastilleKawaii").hidden; // (pas encore : il faut les 11)
      localStorage.setItem("alcuno_stickers", JSON.stringify({ gagnes: STICKERS.map((s) => s.id).slice(0, 10), parties: 5, fins: [] }));
      gagnerStickers([STICKERS[10].id]); // 11e sticker
      o.kawaii11 = kawaiiDebloque() + "/" + document.getElementById("pastilleKawaii").hidden;
      // album : 11 lignes, 8 gagnées ; les règles se remettent ensuite
      ouvrirAlbum();
      o.album = document.querySelectorAll(".albumLigne").length + "/" + document.querySelectorAll(".albumGagne").length + "/" + document.querySelector("#ecranRegles h2").textContent;
      ouvrirRegles();
      o.regles = document.querySelector("#ecranRegles h2").textContent + "/" + document.querySelectorAll(".albumLigne").length + "/" + document.getElementById("ecranRegles").classList.contains("album");
      // 3 parties d'affilée : Chat (3 parties) et Nuage (3 en 6 h)
      localStorage.removeItem("alcuno_stickers"); partieExpress = false;
      statsPartie = { pigeon: {}, plusGros: {}, annulees: {}, duels: {}, plus4: {}, doree: null };
      stickersFinDePartie(); stickersFinDePartie();
      o.deux = trier();
      stickersFinDePartie();
      o.cinq = trier(); // (3 parties de suite : Chat et Nuage)
      // 3 parties étalées sur plus de 6 h : Chat, mais pas Nuage
      localStorage.setItem("alcuno_stickers", JSON.stringify({ gagnes: [], parties: 2, fins: [Date.now() - 20 * 3600 * 1000, Date.now() - 19 * 3600 * 1000] }));
      stickersFinDePartie();
      o.etalees = trier();
      // en ligne : seulement ce qui arrive à soi
      localStorage.removeItem("alcuno_stickers");
      enLigneActif = true; pseudoActuel = "Zoe"; partieExpress = false;
      statsPartie = { pigeon: { Tom: 1 }, plusGros: {}, annulees: {}, duels: {}, plus4: {}, doree: { tireur: "Tom", victime: "Lea" } };
      stickersFinDePartie();
      o.enLigneAutre = trier();
      statsPartie = { pigeon: { Zoe: 1 }, plusGros: {}, annulees: {}, duels: {}, plus4: {}, doree: { tireur: "Zoe", victime: "Lea" } };
      stickersFinDePartie();
      o.enLigneMoi = trier();
      enLigneActif = false; pseudoActuel = null;
      await new Promise((res) => setTimeout(res, 3600));
      o.fenetre = !!document.getElementById("fenetreKawaii");
      return o;
    });
    verifier(r.sansAlbum === '{"gagnes":[],"parties":0,"fins":[]}' && r.avantKawaii === "false/true" && r.partie1 === "chou,cupcake,etoile,lapin,licorne,poussin,sushi" && r.kawaii7 === false &&
      r.partie1b.split(",").length === 8 && r.kawaii8 === "false/true" && r.kawaii11 === "true/false" && r.album === "11/11/Album de stickers" && r.regles === "Règles du jeu/0/false" &&
      r.deux === "cupcake" && r.cinq === "chat,cupcake,nuage" && r.etalees === "chat,cupcake" && r.enLigneAutre === "cupcake,etoile,macaron" && r.enLigneMoi === "cupcake,etoile,macaron,poussin" && r.fenetre && erreurs.length === 0,
      `album de stickers : ${JSON.stringify(r)}`);
    await ctx.close();
  }

  // 19. Thème Kawaii : démarre sans erreur, fond rose, boutons en gélatine blanche, étoiles / personnages dessinés, refusé tant qu'il n'est pas débloqué
  {
    const refus = await ouvrir({}, `try{localStorage.setItem("alcuno_theme","kawaii")}catch(e){}`);
    const themeRefuse = await refus.page.evaluate(() => document.documentElement.dataset.theme);
    await refus.ctx.close();
    const { ctx, page, erreurs } = await ouvrir({}, `try{localStorage.setItem("alcuno_theme","kawaii");localStorage.setItem("alcuno_theme_kawaii","1")}catch(e){}`);
    await page.click("#btnModeClassique"); await page.waitForTimeout(800);
    for (const nom of ["Tom", "Lea", "Max"]) { await page.fill("#nomJoueur", nom); await page.click("#ajouterJoueur"); await page.waitForTimeout(250); }
    await page.click("#jouer"); await page.waitForTimeout(1200);
    const k = await page.evaluate(() => {
      const b = getComputedStyle(document.getElementById("nouvellePartie"));
      const zone = document.getElementById("stickersKawaii");
      return { theme: document.documentElement.dataset.theme, bord: b.borderTopColor, rayon: parseFloat(b.borderTopLeftRadius) > 20,
        stickers: getComputedStyle(zone).display + "/" + zone.children.length, pastille: !document.getElementById("pastilleKawaii").hidden,
        icone: getComputedStyle(document.querySelector("#listeJoueurs .joueur-ligne"), "::before").backgroundImage.includes("stickers/"),
        barre: document.querySelector('meta[name="theme-color"]').content };
    });
    verifier(themeRefuse === "bordeaux" && k.theme === "kawaii" && k.bord === "rgb(255, 255, 255)" && k.rayon && k.stickers === "block/18" && k.pastille && k.icone && k.barre === "#ffd6ec" && erreurs.length === 0,
      `thème Kawaii : refusé tant que verrouillé (${themeRefuse}), ${JSON.stringify(k)}`);
    await ctx.close();
  }

  // 20. Album de stickers caché : l'étoile filante qui traverse l'accueil, touchée, l'affiche (bouton sur l'accueil, plus de ligne dans les Réglages), et ça reste
  {
    const { ctx, page, erreurs } = await ouvrir();
    const etat = () => page.evaluate(() => ({ accueil: !document.getElementById("albumAccueil").hidden, reglages: !!document.getElementById("btnAlbum"), garde: localStorage.getItem("alcuno_album_decouvert"), etoile: !!document.querySelector(".etoileFilante") }));
    const avant = await etat();
    await page.evaluate(() => passageEtoileFilante(true));
    await page.waitForTimeout(600);
    const enVol = await etat();
    const taille = await page.evaluate(() => { const r = document.querySelector(".etoileFilante").getBoundingClientRect(); return Math.round(r.width) > 100; });
    await page.waitForTimeout(4300); // elle ressort sans être touchée : rien ne change
    const ratee = await etat();
    await page.evaluate(() => passageEtoileFilante(true));
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector(".etoileFilante").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
    await page.waitForTimeout(500);
    const apres = await etat();
    const message = await page.evaluate(() => (document.getElementById("notifHaut") || {}).innerText || "");
    await page.evaluate(() => passageEtoileFilante(true)); // plus de passage une fois l'album découvert
    await page.waitForTimeout(300);
    const encore = await etat();
    await page.reload(); await page.waitForTimeout(900);
    const recharge = await etat();
    await page.click("#btnAlbumAccueil"); await page.waitForTimeout(700);
    const ouvert = await page.evaluate(() => document.querySelector("#ecranRegles h2").textContent + "/" + document.getElementById("ecranRegles").style.display);
    verifier(!avant.accueil && !avant.reglages && !avant.etoile && enVol.etoile && taille && ratee.etoile === false && !ratee.accueil &&
      apres.accueil && !apres.reglages && apres.garde === "1" && message.includes("Vœu exaucé") && !encore.etoile && recharge.accueil && ouvert === "Album de stickers/" && erreurs.length === 0,
      `étoile filante : en vol ${enVol.etoile}, ratée -> album ${ratee.accueil}, touchée -> ${JSON.stringify(apres)} « ${message} », plus de passage ${!encore.etoile}, après rechargement ${recharge.accueil}, bouton d'accueil : ${ouvert}`);
    await ctx.close();
  }

  // 12. Les fenêtres de déblocage (Prestige, Star Wars) gardent leurs propres boutons dans tous les thèmes
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
