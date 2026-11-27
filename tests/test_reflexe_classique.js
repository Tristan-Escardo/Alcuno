// Duel RÉFLEXE en mode CLASSIQUE (un seul téléphone) : écran coupé en deux (une moitié par joueur, celle du haut à l'envers),
// la carte en jeu au milieu, puis « TAPE ! » en gros au bout d'un temps au hasard ; le premier qui tape ensuite gagne,
// taper avant = faux départ (perdu). Vérifie : le choix du duel (3 types), faux départ, temps de réaction, les taps qui
// continuent après le résultat (ni le résultat, ni l'annonce « X boit… », ni les « Annuler N » ne partent tout seuls),
// le tap du perdant juste après qui ne saute pas le résultat, un bot qui tape tout seul (après le retournement), et la
// reprise d'une partie coupée (les temps sont gardés dans les actions, rejouées à l'identique).
//   node tests/test_reflexe_classique.js
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
  await p.addInitScript(() => { try {
    if (!sessionStorage.getItem("__init")) {
      sessionStorage.setItem("__init", "1");
      localStorage.setItem("alcuno_tutoriel", "vu");
      for (const cle of ["alcuno_theme_galaxie", "alcuno_theme_donjon", "alcuno_theme_kawaii"]) localStorage.setItem(cle, "1");
      localStorage.setItem("alcuno_premiere_partie_jouee", "1"); localStorage.setItem("alcuno_aide_vue", "1"); localStorage.removeItem("alcuno_bots");
    }
  } catch (e) {} });
  const capture = async (nom) => { if (CAPTURES) await p.screenshot({ path: path.join(CAPTURES, `reflexe_${nom}.png`) }); };
  const nouvellePartie = () => p.evaluate(async () => {
    const at = (ms) => new Promise((r) => setTimeout(r, ms));
    const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    if (document.getElementById("ecranReprise").style.display !== "none") document.getElementById("btnRepriseNon").click();
    document.getElementById("btnModeClassique").click(); await at(400);
    const c = document.getElementById("btnContinuerOptions"); if (c) c.click(); await at(400);
    for (const n of ["Tris", "Ylana", "Max"]) { document.getElementById("nomJoueur").value = n; pd(document.getElementById("ajouterJoueur")); await at(120); }
    pd(document.getElementById("jouer")); await at(1500);
  });
  await p.goto(url); await attendre(1200);
  await nouvellePartie();

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
      ouvert: !!o, zones: vis(".reflexe-zone").length, retournee: vis(".reflexe-signal-go").length,
      info: t(".reflexe-signal"), temps: t(".reflexe-temps"), resultat: t(".shifumi-resultat"), titre: t(".duel-main-title"),
      zonesTexte: t(".reflexe-zone"), tele: JSON.stringify((etatPourTele().ecran) || {}),
      regles: (document.getElementById("overlayRegleUnique") || {}).innerText || ""
    };
  });
  const attendreQue = async (test, ms = 8000) => { const t0 = Date.now(); let e; while (Date.now() - t0 < ms) { e = await lire(); if (test(e)) return e; await attendre(40); } return e; };
  const fermerAnnonces = () => p.evaluate(async () => {
    for (let i = 0; i < 30 && (duelEnCours || document.getElementById("overlayRegleUnique")); i++) {
      if (document.getElementById("overlayRegleUnique")) fermerOverlayRegleUnique();
      await new Promise((r) => setTimeout(r, 200));
    }
  });
  const lancerDuel = async (a, b, carte = "sept_vert") => {
    await p.evaluate((carte) => { paquetDuel.splice(0, paquetDuel.length, carte, "deux_bleu", "neuf_rouge", "cinq_jaune"); lancerOverlayChoixDuel(indexJoueur % joueurs.length, "quatre_vert"); }, carte);
    await attendre(300);
    const types = await p.evaluate(() => [...document.querySelectorAll("#overlayDuel .duel-boutons .bouton-pigeon")].map((b) => b.innerText));
    await tap("#overlayDuel .duel-boutons .bouton-pigeon", "Réflexe"); await attendre(500);
    await tap("#overlayDuel .duel-boutons .bouton-pigeon", a); await attendre(150);
    await tap("#overlayDuel .duel-boutons .bouton-pigeon", b); await attendre(700);
    return types;
  };
  // [joueur du bas (j1), joueur du haut (j2)]
  const ordre = () => p.evaluate(() => [".reflexe-zone-bas", ".reflexe-zone-haut"].map((s) => document.querySelector("#overlayDuel " + s + " .reflexe-zone-nom").textContent));

  // ===== 1) Choix du duel, écran coupé en deux =====
  const types = await lancerDuel("Tris", "Ylana");
  verifier(types.length === 3 && /Classique/.test(types[0]) && /Shifumi/.test(types[1]) && /Réflexe/.test(types[2]), `3 duels proposés : ${types.join(" / ")}`);
  let [BAS, HAUT] = await ordre();
  let e = await lire();
  verifier(e.zones === 2 && e.retournee === 0 && /Prêts/.test(e.info), `2 zones de tap, « ${e.info} »`);
  const geo = await p.evaluate(() => {
    const r = (s) => document.querySelector("#overlayDuel " + s).getBoundingClientRect();
    return { haut: r(".reflexe-zone-haut"), bas: r(".reflexe-zone-bas"), carte: r(".reflexe-enjeu"), autres: document.querySelectorAll("#overlayDuel .shifumi-carte-jeu, #overlayDuel .shifumi-carte-dos").length,
      rot: getComputedStyle(document.querySelector("#overlayDuel .reflexe-zone-haut")).transform, h: innerHeight, l: innerWidth,
      deborde: document.getElementById("overlayDuel").scrollHeight > innerHeight + 2 };
  });
  verifier(geo.haut.top < geo.carte.top && geo.carte.bottom < geo.bas.top && geo.bas.bottom <= geo.h + 1 && !geo.deborde,
    `zone de ${HAUT} en haut, la carte en jeu au milieu, zone de ${BAS} en bas, tout tient à l'écran (${Math.round(geo.haut.top)}/${Math.round(geo.carte.top)}/${Math.round(geo.bas.bottom)} sur ${geo.h})`);
  verifier(/matrix\(-1/.test(geo.rot), `la zone du haut est à l'envers (${geo.rot})`);
  verifier(/Réflexe en cours/.test(e.tele) && !/Tape ici/.test(e.tele), "la télé lit « Duel Réflexe en cours... », pas les zones");
  verifier(geo.autres === 0, "plus de carte Réflexe qui se retourne : seulement la carte en jeu");
  await capture("1_attente");

  // ===== 2) Faux départ : le joueur du bas tape avant le retournement =====
  await tap("#overlayDuel .reflexe-zone-bas");
  e = await attendreQue((x) => /gagne/.test(x.resultat));
  verifier(e.retournee === 0, "faux départ : « TAPE ! » ne s'affiche pas");
  verifier(e.resultat.includes(`${BAS} a perdu, ${HAUT} gagne`) && e.info.includes(`Faux départ de ${BAS}`) && /faux départ/.test(e.temps),
    `faux départ : « ${e.info} » — ${e.temps} — ${e.resultat}`);
  await capture("2_faux_depart");
  e = await attendreQue((x) => /boit/.test(x.regles), 8000);
  verifier(e.regles.includes(`${BAS} boit 7 gorgées`), `le perdant boit les 7 gorgées de la carte (${e.regles.split("\n")[0]})`);
  await fermerAnnonces();

  // ===== 3) Le premier qui tape après le retournement gagne ; le tap de l'autre juste après ne saute pas le résultat =====
  await lancerDuel("Tris", "Max", "cinq_vert");
  [BAS, HAUT] = await ordre();
  const t0 = Date.now();
  const barre = await p.evaluate(() => !!document.getElementById("annulerChoix"));
  e = await attendreQue((x) => x.retournee === 1, 11000);
  const delaiRetour = Date.now() - t0;
  const barreAuRetour = await p.evaluate(() => !!document.getElementById("annulerChoix"));
  verifier(e.retournee === 1 && /TAPE/.test(e.info) && barre && !barreAuRetour && delaiRetour > 5000,
    `« TAPE ! » seulement après la barre « Mauvais joueur ? » (qui cache la zone du bas) : au bout de ${delaiRetour} ms (« ${e.info} »)`);
  await capture("3_retournee");
  await attendre(200);
  await tap("#overlayDuel .reflexe-zone-haut");
  await attendre(120);
  await tap("#overlayDuel .reflexe-zone-bas"); // (le perdant tape juste après)
  e = await lire();
  const ms = Number((e.temps.match(/(\d+) ms/) || [])[1]);
  verifier(e.ouvert && e.resultat.includes(`${BAS} a perdu, ${HAUT} gagne`) && ms >= 30 && ms < 1500,
    `${HAUT} tape en premier : gagne (${e.temps}) ; l'écran du résultat reste malgré le tap de ${BAS}`);
  await capture("4_resultat");
  e = await attendreQue((x) => /boit/.test(x.regles), 8000);
  verifier(e.regles.includes(`${BAS} boit 5 gorgées`), `le perdant boit 5 gorgées (${e.regles.split("\n")[0]})`);
  await fermerAnnonces();

  // ===== 3 bis) Les taps continuent après le résultat : rien ne doit partir tout seul (Tris a 2 annulations) =====
  await p.evaluate(() => { annulations["Tris"] = 2; });
  await lancerDuel("Tris", "Ylana", "six_vert");
  [BAS, HAUT] = await ordre();
  const perdantA = BAS;
  // le joueur du bas fait un faux départ, puis tout le monde continue de taper partout pendant 2,5 s
  await tap("#overlayDuel .reflexe-zone-bas");
  const tFin = Date.now();
  const taps = setInterval(() => p.evaluate(() => { for (const sel of ["#overlayDuel .reflexe-zone-bas", "#overlayDuel .reflexe-zone-haut", "#overlayDuel", "#overlayRegleUnique", "#overlayAnnulation .bouton-annulation"]) { const el = document.querySelector(sel); if (el) el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); } }).catch(() => {}), 120);
  await attendre(2500);
  clearInterval(taps);
  e = await lire();
  verifier(e.ouvert && /gagne/.test(e.resultat), `résultat toujours affiché après 2,5 s de taps (« ${e.resultat} »)`);
  e = await attendreQue((x) => !x.ouvert && /boit/.test(x.regles), 6000);
  const dureeResultat = Date.now() - tFin;
  verifier(dureeResultat > 3300, `le résultat reste ${dureeResultat} ms, même en tapant`);
  // tap tout de suite sur l'annonce : ignoré ; plus tard : la ferme
  await tap("#overlayRegleUnique");
  await attendre(150);
  verifier(await p.evaluate(() => !!document.getElementById("overlayRegleUnique") && !document.getElementById("overlayRegleUnique").dataset.enFermeture), "tap juste à l'apparition de « … boit … » : ignoré");
  await attendre(800);
  if (perdantA === "Tris") {
    await tap("#overlayRegleUnique");
    await p.waitForFunction(() => document.getElementById("overlayAnnulation"), null, { timeout: 8000 }).catch(() => {});
    await tap("#overlayAnnulation .bouton-annulation", "Annuler 2");
    await attendre(200);
    verifier(await p.evaluate(() => !!document.getElementById("overlayAnnulation") && annulations["Tris"] === 2), "tap juste à l'apparition des « Annuler N » : ignoré");
    await attendre(900);
    await tap("#overlayAnnulation .bouton-annulation", "Annuler 1");
    await attendre(400);
    verifier(await p.evaluate(() => annulations["Tris"] === 1), "puis « Annuler 1 » marche normalement");
  } else console.log("      (perdant : " + perdantA + ", sans annulation : partie annulations non vérifiée)");
  await fermerAnnonces();
  await p.evaluate(async () => { for (let i = 0; i < 20 && document.querySelector("#overlayResultatAnnulation, #overlayAnnulation"); i++) { const o = document.querySelector("#overlayResultatAnnulation"); if (o) o.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); await new Promise((r) => setTimeout(r, 300)); } });
  await fermerAnnonces();

  // ===== 4) Un bot dans le duel : il tape tout seul, après le retournement (jamais de faux départ) =====
  await p.evaluate(() => { botsPartie.add("Max"); });
  let okBot = 0;
  for (let i = 0; i < 3; i++) {
    await lancerDuel("Tris", "Max");
    e = await attendreQue((x) => /gagne/.test(x.resultat), 14000);
    if (e.resultat.includes("Tris a perdu, Max gagne") && /Max : \d+ ms/.test(e.temps) && !/faux/.test(e.temps)) okBot++;
    else console.log("      bot : " + e.temps + " / " + e.resultat);
    await attendreQue((x) => /boit/.test(x.regles), 8000); await fermerAnnonces();
  }
  verifier(okBot === 3, `bot : il tape tout seul après le retournement, 3 fois sur 3 (${e.temps})`);
  await p.evaluate(() => botsPartie.delete("Max"));

  // ===== 5) Reprise d'une partie coupée : les temps sont dans les actions, la partie se rejoue à l'identique =====
  // Nouvelle partie jouée par le robot des tests (tests/auto_en_ligne.js) ; à chaque 4 tiré, le test prend la main :
  // Réflexe aux 2 premiers duels (un faux départ, puis un vrai tap). Puis la page est rechargée et la partie reprise.
  await p.evaluate(() => { localStorage.removeItem("alcuno_partie_classique"); });
  await p.goto(url); await attendre(1200);
  await nouvellePartie();
  await p.evaluate((code) => { (0, eval)(code); window.__laisserDuels = true; }, fs.readFileSync(path.join(__dirname, "auto_en_ligne.js"), "utf8"));
  const duelsJoues = [];
  const tDebut = Date.now();
  await p.evaluate(() => window.__auto.start());
  while (duelsJoues.length < 2 && Date.now() - tDebut < 150000) {
    const typeVisible = await p.evaluate(() => [...document.querySelectorAll("#overlayDuel .duel-boutons .bouton-pigeon")].some((b) => /Réflexe/.test(b.innerText)));
    if (!typeVisible) {
      if (await p.evaluate(() => !!document.querySelector("#overlayFinUnRestants"))) break;
      await p.evaluate(() => {
        if (document.querySelector('body > [id^="overlay"]') || !plateauLibre()) return;
        const c = document.querySelector("#plateau .Carte:not(.retournee)"); if (c) c.click();
      });
      await attendre(150); continue;
    }
    await p.evaluate(() => window.__auto.stop());
    await tap("#overlayDuel .duel-boutons .bouton-pigeon", "Réflexe"); await attendre(500);
    for (let i = 0; i < 2; i++) { await p.evaluate(() => { const b = [...document.querySelectorAll("#overlayDuel .duel-boutons .bouton-pigeon")].find((x) => !x.disabled); if (b) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }); await attendre(150); }
    await attendreQue((x) => x.zones === 2, 5000);
    if (duelsJoues.length === 0) await tap("#overlayDuel .reflexe-zone-bas");
    else { await attendreQue((x) => x.retournee === 1, 11000); await attendre(250); await tap("#overlayDuel .reflexe-zone-haut"); }
    const fin = await attendreQue((x) => /gagne/.test(x.resultat), 8000);
    duelsJoues.push(fin.temps + " → " + fin.resultat);
    await attendreQue((x) => !x.ouvert, 8000);
    await p.evaluate(() => window.__auto.start());
  }
  verifier(duelsJoues.length === 2, `deux vrais duels Réflexe joués en partie (${duelsJoues.join(" ; ")})`);
  await p.evaluate(() => window.__auto.stop());
  const actions = await p.evaluate(() => sauvegardeClassique.actions.filter((x) => x.startsWith("reflexe:")));
  verifier(actions.length === 2 && /:tot$/.test(actions[0]) && /^reflexe:1:\d+:\d+$/.test(actions[1]), `temps gardés dans les actions : ${actions.join(" ")}`);
  await p.waitForFunction(() => plateauLibre() && !duelEnCours && !document.querySelector('body > [id^="overlay"]'), null, { timeout: 20000 }).catch(() => {});
  await attendre(800);
  const etat = () => p.evaluate(() => JSON.stringify({ g: gorgeesBues, d: statsPartie.duels, i: indexJoueur, pq: paquetDuel.length,
    retournees: document.querySelectorAll("#plateau .Carte.retournee").length, reflexe: sauvegardeClassique.actions.filter((x) => x.startsWith("reflexe:")).length }));
  const avant = await etat();
  await p.reload(); await attendre(1500);
  const proposee = await p.evaluate(() => document.getElementById("ecranReprise").style.display !== "none");
  if (process.env.DEBUG) await p.evaluate(() => { const r = window.rejouerActionClassique; window.__rejeu = []; window.rejouerActionClassique = function(id){ const x = r(id); if (x !== "ok" || /duel|reflexe/.test(id)) window.__rejeu.push(id + " => " + x); return x; }; });
  await p.evaluate(() => document.getElementById("btnRepriseOui").click());
  await p.waitForFunction(() => !document.getElementById("ecranRattrapage"), null, { timeout: 60000 }).catch(async () => {
    console.log(await p.evaluate(() => [...new Set(window.__rejeu || [])].join("\n") + "\n" + (document.getElementById("ecranRattrapage") || {}).innerText + "\n" + (document.getElementById("overlayDuel") || {}).innerText));
  });
  await attendre(2500); await fermerAnnonces();
  await p.waitForFunction(() => plateauLibre() && !duelEnCours && !document.querySelector('body > [id^="overlay"]'), null, { timeout: 15000 }).catch(() => {});
  const apres = await etat();
  verifier(proposee && avant === apres, `reprise : même partie après avoir rejoué les duels Réflexe\n      avant ${avant}\n      après ${apres}`);

  verifier(erreurs.length === 0, "aucune erreur de script " + erreurs.join(" | "));
  await nav.close(); serveur.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
