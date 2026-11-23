// En partie : toucher le cadre d'un prénom ouvre le volet de la pause, avec « 🤖 Remplacer par un bot »
// (même nom, pastille 🤖, le téléphone joue à sa place) et « reprend la main ». Partie classique seulement.
// Le jeu doit être servi (comme les autres tests navigateur) : URL_JEU, par défaut http://localhost:8765/index.html
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.URL_JEU || "http://localhost:8765/index.html";

async function partie(b, noms, avant) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.addInitScript(() => { try { localStorage.removeItem("alcuno_bots"); localStorage.removeItem("alcuno_bots_remplaces"); } catch (e) {} });
  await p.goto(URL);
  await p.waitForTimeout(2500);
  await p.evaluate(async ({ noms, avant }) => {
    const $ = (s) => document.querySelector(s);
    const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    $("#btnModeClassique").click();
    if ($("#btnContinuerOptions")) $("#btnContinuerOptions").click();
    for (const n of noms) { $("#nomJoueur").value = n; pd($("#ajouterJoueur")); }
    if (avant === "hard") { caseModeHard.checked = true; caseModeHard.dispatchEvent(new Event("change")); }
    pd($("#jouer"));
    await new Promise((ok) => setTimeout(ok, 1200));
    document.querySelectorAll("[id^=overlay]").forEach((o) => o.remove());
  }, { noms, avant });
  return { p, erreurs };
}
const outils = () => {
  // (par la place du joueur : son nom peut devenir « PIGEON (Max) »)
  window.ligne = (nom) => document.querySelectorAll("#listeJoueurs .joueur-ligne")[joueurs.indexOf(nom)];
  window.volet = () => {
    const v = document.getElementById("voletPause");
    return v && { texte: v.querySelector(".voletPause-texte").textContent, ok: v.querySelector(".voletPause-ok")?.textContent || null, bot: v.querySelector(".voletPause-bot")?.textContent || null };
  };
};

(async () => {
  const b = await chromium.launch();
  // ----- 3 joueurs
  const { p, erreurs } = await partie(b, ["Léa", "Tom", "Max"]);
  await p.evaluate(outils);
  const res = await p.evaluate(async () => {
    const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const res = {};
    // toucher le prénom (pas le bouton ⏸) ouvre le volet
    ligne("Max").querySelector(".joueur-nom").click();
    res.voletMax = volet();
    document.querySelector("#voletPause .voletPause-fermer").click();
    // joueur actif aussi
    const actif = joueurs[indexJoueur % joueurs.length];
    document.querySelector("#listeJoueurs .joueur-ligne-actif").click();
    res.voletActif = volet() && document.querySelector("#voletPause .voletPause-nom").textContent === actif;
    document.querySelector("#voletPause .voletPause-fermer").click();
    // ⏸ : un seul volet (pas deux l'un sur l'autre)
    ligne("Tom").querySelector(".btnPauseJoueur").click();
    res.unSeulVolet = document.querySelectorAll("#voletPause").length;
    document.querySelector("#voletPause .voletPause-fermer").click();
    // un joueur en pause : « De retour » + « Remplacer par un bot » ; le bot n'est plus en pause
    ligne("Tom").click();
    document.querySelector("#voletPause .voletPause-ok").click();
    res.tomEnPause = estEnPause("Tom");
    ligne("Tom").click();
    res.voletPause = volet();
    document.querySelector("#voletPause .voletPause-bot").click();
    res.tomBotSansPause = estBot("Tom") && !estEnPause("Tom");
    // remplacer Max par un bot
    ligne("Max").click();
    document.querySelector("#voletPause .voletPause-bot").click();
    res.maxBot = estBot("Max");
    res.memeNom = joueurs.includes("Max") && joueurs.length === 3;
    res.badge = !!ligne("Max").querySelector(".badge-bot");
    res.actionNotee = (sauvegardeClassique && sauvegardeClassique.actions || []).includes("bot-classique:Max");
    // à son tour, le bot joue tout seul
    indexJoueur = joueurs.indexOf("Max"); afficherJoueurActif();
    const avant = document.querySelectorAll("#plateau .Carte.retournee").length;
    for (let i = 0; i < 40 && document.querySelectorAll("#plateau .Carte.retournee").length === avant; i++) await attendre(100);
    res.botJoue = document.querySelectorAll("#plateau .Carte.retournee").length > avant;
    for (let i = 0; i < 40 && (overlayOuvert() || document.getElementById("overlayRegleUnique")); i++) {
      const o = document.getElementById("overlayRegleUnique"); if (o) o.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await attendre(150);
    }
    document.querySelectorAll("[id^=overlay]").forEach((o) => o.remove());
    // Max reprend la main
    ligne("Max").click();
    res.voletBot = volet();
    document.querySelector("#voletPause .voletPause-bot").click();
    res.maxHumain = !estBot("Max") && !ligne("Max").querySelector(".badge-bot");
    // nouvelle partie : les remplacés redeviennent eux-mêmes
    lancerPartie();
    res.tomRedevenu = !estBot("Tom");
    return res;
  });
  assert.ok(res.voletMax && res.voletMax.ok === "Mettre Max en pause" && res.voletMax.bot === "🤖 Remplacer par un bot", "toucher le prénom : volet avec pause et bot " + JSON.stringify(res.voletMax));
  assert.ok(res.voletActif, "le joueur actif aussi");
  assert.equal(res.unSeulVolet, 1, "⏸ : un seul volet");
  assert.ok(res.maxBot && res.memeNom && res.badge, "Max remplacé par un bot, même nom, pastille 🤖");
  assert.ok(res.actionNotee, "gardé dans la partie (rejoué après un plantage)");
  assert.ok(res.botJoue, "le bot joue le tour de Max");
  assert.equal(res.voletBot.bot, "🙋 Max reprend la main");
  assert.ok(res.maxHumain, "Max reprend la main");
  assert.ok(res.tomEnPause && res.voletPause.ok === "Tom est de retour" && res.voletPause.bot === "🤖 Remplacer par un bot", "joueur en pause : retour ou bot " + JSON.stringify(res.voletPause));
  assert.ok(res.tomBotSansPause, "Tom en pause remplacé : bot, plus en pause");
  assert.ok(res.tomRedevenu, "nouvelle partie : Tom redevient lui-même");
  assert.deepEqual(erreurs, [], "aucune erreur dans la page");
  await p.close();

  // ----- 2 joueurs : pas de pause possible, mais le bot oui ; puis plus de vrai joueur à remplacer
  const d = await partie(b, ["Léa", "Tom"]);
  await d.p.evaluate(outils);
  const deux = await d.p.evaluate(() => {
    const res = {};
    ligne("Tom").click();
    res.volet = volet();
    document.querySelector("#voletPause .voletPause-bot").click();
    ligne("Léa").click();
    res.dernierHumain = volet();
    return res;
  });
  assert.ok(deux.volet && deux.volet.ok === null && deux.volet.bot === "🤖 Remplacer par un bot", "à 2 : seulement le bot " + JSON.stringify(deux.volet));
  assert.equal(deux.dernierHumain, null, "le dernier vrai joueur ne peut pas être remplacé");
  assert.deepEqual(d.erreurs, [], "aucune erreur (2 joueurs)");
  await d.p.close();

  // ----- mode hard : pas de bot
  const h = await partie(b, ["Léa", "Tom"], "hard");
  await h.p.evaluate(outils);
  const hard = await h.p.evaluate(() => { ligne("Tom").click(); return volet(); });
  assert.equal(hard, null, "mode hard à 2 : ni pause ni bot, pas de volet");
  await h.p.close();

  console.log("Remplacer par un bot : prénom touchable, bot au même nom, reprend la main, pas en hard.");
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
