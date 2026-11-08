// TEST DE COMPATIBILITÉ DES THÈMES : y a-t-il des boutons ou champs « oubliés » par un thème ?
//
// Principe : on ouvre chaque écran du jeu dans chaque thème. Pour chaque bouton / champ visible, on compare son
// apparence (fond, couleur du texte, bordure) à celle qu'il a SANS aucun thème (le style de base, jaune). Un thème
// habille ses boutons principaux (« Mode en ligne »…) : si ce thème en a un look différent du style de base, alors un
// bouton resté EXACTEMENT au style de base est un bouton oublié (ex. « Annuler » de la caméra restée jaune en Kawaii).
// Les thèmes dont les boutons principaux restent au style de base (Bordeaux, Vert…) ne sont pas concernés.
//
// Écrans visités : tous les écrans de index.html (liste lue dans la page, donc un écran ajouté plus tard est
// visité tout seul) + les fenêtres de jeu rencontrées par le robot pendant une partie (si on ne passe pas --sans-partie).
//
// Utilisation :  node tests/test_themes.js [--sans-partie] [--themes=kawaii,givre] [--images]
//   Nouveau thème : l'ajouter dans la liste THEMES ci-dessous (ou le passer avec --themes=montheme), puis lancer.
//   --images : enregistre une capture de chaque oubli dans tests/resultats/themes/
// Une exception voulue (bouton volontairement resté au style de base) se déclare dans EXCEPTIONS plus bas, avec la raison.
const fs = require("fs"); const path = require("path");
const { chromium } = require("playwright");
const R = __dirname + "/";
const URL = process.env.URL_JEU || "http://localhost:8765/index.html";
const THEMES = ["bordeaux", "noir", "vert", "bleu", "soleil", "cerisier", "givre", "prestige", "galaxie", "kawaii", "donjon"];
const args = process.argv.slice(2);
const sansPartie = args.includes("--sans-partie"), images = args.includes("--images");
const themes = ((args.find((a) => a.startsWith("--themes=")) || "").slice(9).split(",").filter(Boolean));
const aTester = themes.length ? themes : THEMES;

// [écran, sélecteur du bouton, raison]  (écran "*" = partout). Un oubli listé ici n'est plus signalé.
const EXCEPTIONS = [
  ["*", ".pastilleTheme", "pastilles de choix du thème : chaque pastille montre la couleur de son propre thème"],
  ["ecranBug", "#btnEnvoyerBug", "bouton « Envoyer le rapport » rouge profond voulu dans tous les thèmes (commentaire dans style_alcuno.css)"],
  ["overlayRegleUnique", ".bloc-hot-btn.bois", "bouton « Je bois » du défi hot : sombre voulu (secondaire), Givre et Kawaii seuls le recolorent"],
  ["overlayCarteDoree", "button", "la carte dorée garde ses boutons or métallique dans tous les thèmes"],
];

// Apparence d'un élément : ce qu'un thème change quand il l'habille
const FONCTION_LOOK = `(el) => { const c = getComputedStyle(el); return [c.backgroundColor, c.backgroundImage.slice(0, 80), c.color, c.borderTopColor, c.borderTopWidth, c.boxShadow.slice(0, 40)].join("|"); }`;
// Bouton « plein » : fond visible (couleur presque opaque ou dégradé). Les icônes, liens et champs à fond transparent
// ne sont pas comparés (leur style de base n'est pas un bouton jaune à habiller)
function estPlein(look) {
  const [fond, image] = look.split("|");
  if (image && image !== "none") return true;
  const m = fond.match(/rgba?\(([^)]+)\)/); if (!m) return false;
  const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
  return (p.length > 3 ? p[3] : 1) >= 0.8;
}
const SELECTEUR = "button, [role=button]";

function nomElement(e) { return (e.id ? "#" + e.id : "") + (e.classe ? "." + e.classe.trim().split(/\s+/).join(".") : "") || e.tag; }

async function mesurer(page, contexte) {
  // contexte : racine à explorer (sélecteur d'un écran ou d'une fenêtre)
  return page.evaluate(([contexte, SELECTEUR, FONC]) => {
    const look = eval(FONC);
    const racine = contexte ? document.querySelector(contexte) : document.body;
    if (!racine) return [];
    return [...racine.querySelectorAll(SELECTEUR)].filter((el) => {
      const r = el.getBoundingClientRect(), c = getComputedStyle(el);
      return r.width > 4 && r.height > 4 && c.visibility !== "hidden" && c.display !== "none" && Number(c.opacity) > 0.05;
    }).map((el) => ({ id: el.id, classe: typeof el.className === "string" ? el.className : "", tag: el.tagName.toLowerCase(), texte: (el.innerText || el.value || el.placeholder || "").trim().slice(0, 30), look: look(el) }));
  }, [contexte, SELECTEUR, FONCTION_LOOK]);
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erreursPage = []; page.on("pageerror", (x) => erreursPage.push(x.message));
  await page.addInitScript(() => { try { localStorage.setItem("alcuno_album_decouvert", "1"); } catch (e) {} });
  await page.goto(URL); await page.waitForTimeout(2500);
  const dossierImages = path.join(R, "resultats", "themes");
  if (images) fs.mkdirSync(dossierImages, { recursive: true });

  // Liste des écrans (sections de la page), lue dans la page
  const ecrans = await page.evaluate(() => [...document.querySelectorAll("body section[id]")].map((s) => s.id));
  // Montre un écran seul. Les écrans cachés par style="display:none" reprennent leur affichage d'origine.
  const montrer = (id) => page.evaluate((id) => {
    document.querySelectorAll("body section[id], body > [id^=overlay]").forEach((s) => { s.style.display = "none"; });
    const s = document.getElementById(id); s.style.display = "";
    if (getComputedStyle(s).display === "none") s.style.display = "flex";
    if (id === "ecranCaster") { const c = document.getElementById("casterConnecte"); if (c) c.style.display = "none"; }
  }, id);
  const poserTheme = (t) => page.evaluate((t) => { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); }, t);

  // Style de base de chaque écran (sans thème)
  const base = {};
  await poserTheme(null);
  for (const id of ecrans) { await montrer(id); await page.waitForTimeout(80); base[id] = await mesurer(page, "#" + id); }
  // Apparence du bouton principal « Mode en ligne » sans thème
  await montrer("choixMode"); await page.waitForTimeout(80);
  const lookBaseRef = (await mesurer(page, "#choixMode")).find((e) => e.id === "btnModeEnLigne").look;

  const oublis = []; const resume = []; const habilles = [];
  for (const t of aTester) {
    await poserTheme(t); await montrer("choixMode"); await page.waitForTimeout(250);
    const ref = (await mesurer(page, "#choixMode")).find((e) => e.id === "btnModeEnLigne");
    const habille = ref && ref.look !== lookBaseRef;
    if (!habille) { resume.push(`${t} : boutons principaux au style de base : thème non concerné`); continue; }
    habilles.push(t);
    let n = 0, vus = 0;
    for (const id of ecrans) {
      await montrer(id); await page.waitForTimeout(150);
      const liste = await mesurer(page, "#" + id);
      const bl = base[id] || [];
      liste.forEach((e) => {
        vus++;
        const memeQueBase = bl.some((x) => x.id === e.id && x.classe === e.classe && x.tag === e.tag && x.texte === e.texte && x.look === e.look);
        if (!memeQueBase || !estPlein(e.look)) return;
        const sel = nomElement(e);
        if (EXCEPTIONS.some(([ec, s]) => (ec === id || ec === "*") && (s === sel || s === e.tag || sel.includes(s)))) return;
        n++; oublis.push({ theme: t, ecran: id, element: sel, texte: e.texte });
      });
      if (images && liste.length) await page.screenshot({ path: path.join(dossierImages, `${t}_${id}.png`) });
    }
    resume.push(`${t} : ${vus} éléments vus dans ${ecrans.length} écrans, ${n} resté(s) au style de base`);
  }

  // Fenêtres de jeu : une partie du robot par thème, on regarde chaque fenêtre qui apparaît
  const fenetresVues = new Set();
  if (!sansPartie) {
    for (const t of habilles) {
      const p = await b.newPage({ viewport: { width: 390, height: 844 } });
      await p.addInitScript(fs.readFileSync(R + "prelude.js", "utf8")); await p.addInitScript(fs.readFileSync(R + "joueur_auto.js", "utf8"));
      await p.addInitScript((t) => { window.__optionsRobot = ["optionModeHot"]; try { localStorage.setItem("alcuno_theme", t); } catch (e) {} }, t);
      await p.goto(URL + "?graine=" + (4000 + aTester.indexOf(t)));
      const vuesTheme = new Map(); const t0 = Date.now();
      while (Date.now() - t0 < 90000) {
        const etat = await p.evaluate(([SELECTEUR, FONC, t]) => {
          document.documentElement.setAttribute("data-theme", t);
          const look = eval(FONC);
          const o = [...document.querySelectorAll('body > [id^="overlay"]')].pop();
          if (!o) return { fin: !!document.getElementById("rapport") };
          return { id: o.id, boutons: [...o.querySelectorAll(SELECTEUR)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !el.disabled; })
            .map((el) => ({ id: el.id, classe: typeof el.className === "string" ? el.className : "", tag: el.tagName.toLowerCase(), texte: (el.innerText || "").trim().slice(0, 30), look: look(el) })) };
        }, [SELECTEUR, FONCTION_LOOK, t]);
        if (etat.id && !vuesTheme.has(etat.id)) vuesTheme.set(etat.id, etat.boutons);
        if (etat.fin) break;
        await p.waitForTimeout(150);
      }
      // même fenêtre sans thème, pour comparer : on la rejoue en retirant le thème sur la page de jeu au moment de la capture
      // (les fenêtres sont recréées à chaque fois : on mesure donc la base une fois, sur le premier thème qui la voit)
      for (const [id, boutons] of vuesTheme) fenetresVues.add(id);
      globalThis.__fenetres = globalThis.__fenetres || {};
      globalThis.__fenetres[t] = Object.fromEntries(vuesTheme);
      await p.close();
    }
    // Base des fenêtres : une partie sans thème
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.addInitScript(fs.readFileSync(R + "prelude.js", "utf8")); await p.addInitScript(fs.readFileSync(R + "joueur_auto.js", "utf8"));
    await p.addInitScript(() => { window.__optionsRobot = ["optionModeHot"]; });
    await p.goto(URL + "?graine=4000");
    const baseF = {}; const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      const etat = await p.evaluate(([SELECTEUR, FONC]) => {
        document.documentElement.removeAttribute("data-theme"); const look = eval(FONC);
        const o = [...document.querySelectorAll('body > [id^="overlay"]')].pop();
        if (!o) return { fin: !!document.getElementById("rapport") };
        return { id: o.id, boutons: [...o.querySelectorAll(SELECTEUR)].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !el.disabled; })
          .map((el) => ({ id: el.id, classe: typeof el.className === "string" ? el.className : "", tag: el.tagName.toLowerCase(), texte: (el.innerText || "").trim().slice(0, 30), look: look(el) })) };
      }, [SELECTEUR, FONCTION_LOOK]);
      if (etat.id && !baseF[etat.id]) baseF[etat.id] = etat.boutons;
      if (etat.fin) break;
      await p.waitForTimeout(150);
    }
    await p.close();
    for (const t of habilles) {
      const vues = globalThis.__fenetres[t];
      // thème non concerné = ses boutons de fenêtre n'ont pas du tout changé par rapport à la base
      const tous = Object.entries(vues).flatMap(([id, bs]) => bs.map((e) => ({ id: id, e })));
      const changes = tous.filter(({ id, e }) => (baseF[id] || []).some((x) => x.id === e.id && x.classe === e.classe && x.texte === e.texte && x.look !== e.look)).length;
      if (!changes) { resume.push(`${t} : fenêtres de jeu : aucun bouton habillé, thème non concerné`); continue; }
      let n = 0;
      for (const [id, boutons] of Object.entries(vues)) for (const e of boutons) {
        const mm = (baseF[id] || []).some((x) => x.id === e.id && x.classe === e.classe && x.texte === e.texte && x.look === e.look);
        if (!mm || !estPlein(e.look)) continue;
        const sel = nomElement(e);
        if (EXCEPTIONS.some(([ec, s]) => (ec === id || ec === "*") && (s === sel || s === e.tag || sel.includes(s)))) continue;
        n++; oublis.push({ theme: t, ecran: id + " (en jeu)", element: sel, texte: e.texte });
      }
      resume.push(`${t} : fenêtres de jeu vues : ${Object.keys(vues).join(", ")} ; ${n} resté(s) au style de base`);
    }
    console.log("Fenêtres de jeu rencontrées par le robot : " + [...fenetresVues].sort().join(", "));
    // Fenêtres que le jeu sait créer (lues dans le code) mais que le robot n'a pas vues : à vérifier à la main
    const toutes = new Set(); for (const f of fs.readdirSync(path.join(R, "..", "js")).filter((f) => f.endsWith(".js"))) for (const m of fs.readFileSync(path.join(R, "..", "js", f), "utf8").matchAll(/\.id\s*=\s*"(overlay[A-Za-z]+)"/g)) toutes.add(m[1]);
    const manquantes = [...toutes].filter((x) => !fenetresVues.has(x)).sort();
    if (manquantes.length) console.log("Fenêtres de jeu NON visitées (à regarder à la main) : " + manquantes.join(", "));
  }

  resume.forEach((l) => console.log(l));
  if (erreursPage.length) console.log("erreurs dans la page :", erreursPage.slice(0, 3));
  console.log("");
  if (oublis.length) {
    oublis.forEach((o) => console.log(`OUBLI    ${o.theme} · ${o.ecran} · ${o.element}${o.texte ? ` « ${o.texte} »` : ""} : resté au style de base`));
    console.log(`\n${oublis.length} OUBLI(S)`);
  } else console.log("TOUT EST OK (aucun bouton oublié par un thème)");
  await b.close();
  process.exit(oublis.length ? 1 : 0);
})();
