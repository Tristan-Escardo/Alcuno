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
    verifier(avant.ligne1 && avant.jouerSousLigne1 && apres.ligne1 && apres.jouerSousLigne1 && apres.hauteurMenu < 130 && erreurs.length === 0,
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
    verifier(a.pastilles === 3 && a.actives.join() === "0" && a.nom === "Tom" && b.actives.join() === "1" && b.nom === "Lea" && a.plateau < 420 && erreurs.length === 0,
      `haut de partie : ${a.pastilles} pastilles, actif ${a.nom} (${a.actives}) puis ${b.nom} (${b.actives}), plateau à ${a.plateau} px`);
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
