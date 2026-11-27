// Duel Shifumi en mode HOT et HARD (classique) : le défi proposé au perdant suit les gorgées FINALES, égalités comprises
// (×2, ×4…) : hot A jusqu'à 4 gorgées, B de 5 à 10, C au-dessus ; hard HA jusqu'à 4 (2 en PJ), HB au-dessus. Aussi en
// mode PJ (gorgées du duel divisées par 2, 10 au plus). Vérifie que le bloc du défi s'affiche, et « Je le fais » / « Je bois ».
//   node tests/test_shifumi_hot.js
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

(async () => {
  await new Promise((r) => serveur.listen(0, r));
  const url = `http://localhost:${serveur.address().port}/index.html`;
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  const nav = await chromium.launch(exe);

  // Une partie classique avec ces options (cases de « Ta partie »)
  const partie = async (noms, options) => {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 780 } });
    const p = await ctx.newPage();
    const erreurs = [];
    p.on("pageerror", (e) => erreurs.push(e.message));
    await p.addInitScript(() => { try {
      localStorage.setItem("alcuno_tutoriel", "vu"); localStorage.setItem("alcuno_premiere_partie_jouee", "1"); localStorage.setItem("alcuno_aide_vue", "1");
      localStorage.setItem("alcuno_hard_debloque", "1"); localStorage.removeItem("alcuno_bots");
    } catch (e) {} });
    await p.goto(url); await attendre(1200);
    await p.evaluate(async ([noms, options]) => {
      const at = (ms) => new Promise((r) => setTimeout(r, ms));
      const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      document.getElementById("btnModeClassique").click(); await at(400);
      for (const id of options) { const c = document.getElementById(id); c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true })); await at(100); }
      const c = document.getElementById("btnContinuerOptions"); if (c) c.click(); await at(400);
      for (const n of noms) { document.getElementById("nomJoueur").value = n; pd(document.getElementById("ajouterJoueur")); await at(120); }
      pd(document.getElementById("jouer")); await at(1500);
      // (on note le groupe de défi demandé à chaque annonce)
      window.__groupes = [];
      const o = groupeDefiHot; groupeDefiHot = (n) => { const g = o(n); window.__groupes.push(n + ":" + g); return g; };
    }, [noms, options]);
    return { p, ctx, erreurs };
  };

  const tap = (p, sel, texte) => p.evaluate(([sel, texte]) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.getClientRects().length && (!texte || e.innerText.includes(texte)));
    if (!el) return false;
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    return true;
  }, [sel, texte || ""]);

  // Un duel Shifumi : carte en jeu, puis les choix de chaque manche ([j1, j2] ; égalité = même choix)
  const duel = async (p, carte, manches, choisir2 = true) => {
    await p.evaluate((carte) => { window.__groupes = []; paquetDuel.splice(0, paquetDuel.length, carte, "deux_bleu", "neuf_rouge"); lancerOverlayChoixDuel(indexJoueur % joueurs.length, "quatre_vert"); }, carte);
    await attendre(300);
    await tap(p, "#overlayDuel .duel-boutons .bouton-pigeon", "Shifumi"); await attendre(500);
    if (choisir2) {
      for (let i = 0; i < 2; i++) { await p.evaluate(() => { const b = [...document.querySelectorAll("#overlayDuel .duel-boutons .bouton-pigeon")].find((x) => !x.disabled); if (b) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }); await attendre(150); }
      await attendre(500);
    }
    for (const [a, b] of manches) {
      await p.waitForFunction(() => document.querySelectorAll("#overlayDuel .shifumi-option").length === 3 && !document.querySelector("#overlayDuel .shifumi-carte-jeu"), null, { timeout: 8000 });
      await tap(p, "#overlayDuel .shifumi-option", a); await attendre(250);
      await tap(p, "#overlayDuel .shifumi-option", b); await attendre(200);
    }
    await p.waitForFunction(() => document.querySelector("#overlayRegleUnique .bloc-hot") || (document.getElementById("overlayRegleUnique") && /boit/.test(document.getElementById("overlayRegleUnique").innerText)), null, { timeout: 15000 });
    await attendre(400);
    const r = await p.evaluate(() => {
      const o = document.getElementById("overlayRegleUnique");
      return { texte: (o.innerText.match(/\S+ boit \d+ gorgées?/) || [""])[0], defi: !!o.querySelector(".bloc-hot"),
        boutons: [...o.querySelectorAll(".bloc-hot-btn")].map((b) => b.innerText.trim()).join(" / "), groupes: window.__groupes.slice() };
    });
    return r;
  };
  const fermer = async (p, bouton) => {
    if (bouton) await tap(p, "#overlayRegleUnique .bloc-hot-btn", bouton);
    await p.evaluate(async () => {
      for (let i = 0; i < 40 && (duelEnCours || document.getElementById("overlayRegleUnique")); i++) {
        if (document.getElementById("overlayRegleUnique") && !document.querySelector("#overlayRegleUnique .bloc-hot-btn:not(:disabled)")) fermerOverlayRegleUnique();
        await new Promise((r) => setTimeout(r, 200));
      }
    });
    await attendre(400);
  };
  const gorgees = (r) => Number((r.texte.match(/(\d+) gorgée/) || [])[1]);
  const groupe = (r) => (r.groupes[r.groupes.length - 1] || "").split(":")[1];

  // ===== HOT, 3 joueurs =====
  {
    const { p, ctx, erreurs } = await partie(["Tris", "Ylana", "Max"], ["optionModeHot"]);
    verifier(await p.evaluate(() => partieHot && !partieHard), "partie hot lancée");
    const cas = [
      ["deux_vert", [["Pierre", "Ciseaux"]], 2, "A", "2 gorgées, sans égalité"],
      ["deux_vert", [["Pierre", "Pierre"], ["Pierre", "Ciseaux"]], 4, "A", "2 × 2 (une égalité)"],
      ["deux_vert", [["Pierre", "Pierre"], ["Feuille", "Feuille"], ["Pierre", "Ciseaux"]], 8, "B", "2 × 4 (deux égalités) : passe en B"],
      ["cinq_vert", [["Pierre", "Ciseaux"]], 5, "B", "5 gorgées"],
      ["six_vert", [["Ciseaux", "Ciseaux"], ["Pierre", "Ciseaux"]], 12, "C", "6 × 2 (une égalité) : passe de B à C"],
    ];
    for (const [carte, manches, attendu, gAttendu, quoi] of cas) {
      const r = await duel(p, carte, manches);
      verifier(gorgees(r) === attendu && groupe(r) === gAttendu && r.defi && /Je le fais/.test(r.boutons),
        `hot, ${quoi} : « ${r.texte} », défi ${groupe(r)} (attendu ${attendu} gorgées, ${gAttendu}) [${r.boutons}]`);
      await fermer(p, cas.indexOf(cas.find((c) => c[0] === carte)) % 2 ? "Je bois" : "Je le fais");
    }
    verifier(!(await p.evaluate(() => duelEnCours || !!document.getElementById("overlayDuel"))), "hot : la partie reprend après les défis");
    verifier(erreurs.length === 0, "hot : aucune erreur " + erreurs.join(" | "));
    await ctx.close();
  }

  // ===== HARD, 2 joueurs (les 2 joueurs du duel sont forcés) =====
  {
    const { p, ctx, erreurs } = await partie(["Tris", "Ylana"], ["optionModeHard"]);
    verifier(await p.evaluate(() => partieHard), "partie hard lancée");
    const cas = [
      ["deux_vert", [["Pierre", "Ciseaux"]], 2, "HA", "2 gorgées"],
      ["deux_vert", [["Pierre", "Pierre"], ["Pierre", "Ciseaux"]], 4, "HA", "2 × 2 : reste HA"],
      ["deux_vert", [["Pierre", "Pierre"], ["Feuille", "Feuille"], ["Pierre", "Ciseaux"]], 8, "HB", "2 × 4 : passe en HB"],
      ["cinq_vert", [["Pierre", "Ciseaux"]], 5, "HB", "5 gorgées"],
    ];
    for (const [carte, manches, attendu, gAttendu, quoi] of cas) {
      const r = await duel(p, carte, manches, false);
      verifier(gorgees(r) === attendu && groupe(r) === gAttendu && r.defi,
        `hard, ${quoi} : « ${r.texte} », défi ${groupe(r)} (attendu ${attendu} gorgées, ${gAttendu}) [${r.boutons}]`);
      await fermer(p, "Je le fais");
    }
    verifier(erreurs.length === 0, "hard : aucune erreur " + erreurs.join(" | "));
    await ctx.close();
  }

  // ===== HOT + PJ : gorgées du duel divisées par 2 (arrondi au-dessus), 10 au plus =====
  {
    const { p, ctx, erreurs } = await partie(["Tris", "Ylana", "Max"], ["optionModeHot", "optionModeSoft"]);
    verifier(await p.evaluate(() => partieHot && estModeSoft()), "partie hot en mode PJ lancée");
    const cas = [
      ["neuf_vert", [["Pierre", "Ciseaux"]], 5, "B", "9 → 5 gorgées"],
      ["neuf_vert", [["Pierre", "Pierre"], ["Pierre", "Ciseaux"]], 10, "B", "9 → 5 × 2 = 10"],
      ["neuf_vert", [["Pierre", "Pierre"], ["Feuille", "Feuille"], ["Pierre", "Ciseaux"]], 10, "B", "9 → 5 × 4 = 20, plafonné à 10"],
    ];
    for (const [carte, manches, attendu, gAttendu, quoi] of cas) {
      const r = await duel(p, carte, manches);
      verifier(gorgees(r) === attendu && groupe(r) === gAttendu,
        `PJ, ${quoi} : « ${r.texte} », défi ${groupe(r)} (attendu ${attendu} gorgées, ${gAttendu})`);
      await fermer(p, "Je bois");
    }
    verifier(erreurs.length === 0, "PJ : aucune erreur " + erreurs.join(" | "));
    await ctx.close();
  }

  await nav.close(); serveur.close();
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
