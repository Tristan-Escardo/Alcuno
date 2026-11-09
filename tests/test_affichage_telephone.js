// TOUT L'AFFICHAGE DU TÉLÉPHONE DANS UN THÈME : node tests/test_affichage_telephone.js <thème>   (ex. kawaii)
// (le jeu doit être servi sur http://localhost:8765 : python3 -m http.server 8765 depuis le dossier du jeu)
//
// Ouvre chaque écran et chaque fenêtre du jeu (accueil, réglages, règles, FAQ, album, mode en ligne, caster, scan,
// bug, installation, confirmations, plateau, volets, toutes les fenêtres de partie : pigeon, duel, +4, couleur,
// Cupidon, défi hot, carte dorée, annulation, pari de fin, fin de partie…) dans le thème donné, et vérifie chacun
// (voir affichage_commun.js : texte moins lisible, bouton oublié, débordement, erreur JS). Les écrans de index.html
// que la liste ci-dessous ne connaît pas sont visités quand même (un écran ajouté plus tard n'est pas oublié), et
// les fenêtres que le code sait créer mais que le test n'ouvre pas sont signalées.
// Résultat : liste des problèmes + planche des captures dans tests/resultats/affichage_telephone/<thème>/index.html
const fs = require("fs"); const path = require("path");
const { chromium } = require("playwright");
const C = require("./affichage_commun");
const { theme, avertissements } = C.lireTheme("test_affichage_telephone");

// Lance une partie classique (3 joueurs) ; options : ids des cases de l'écran « Ta partie » (optionModeHot…)
const LANCER = `(async (options) => {
  const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById("btnModeClassique").click(); await attendre(400);
  options.forEach((id) => { const c = document.getElementById(id); if (c && !c.checked) c.click(); });
  const cont = document.getElementById("btnContinuerOptions"); if (cont) cont.click(); await attendre(400);
  for (const n of ["Tris", "Ylana", "Celien"]) { document.getElementById("nomJoueur").value = n; pd(document.getElementById("ajouterJoueur")); await attendre(120); }
  if (options.includes("__avantJouer")) return;
  pd(document.getElementById("jouer")); await attendre(1200);
  // fermer ce qui s'ouvre tout seul au début (aide, annonce)
  document.querySelectorAll('#aideAccueil').forEach((e) => e.remove());
})`;
// Montre seulement ces éléments (les autres écrans cachés) : pour les écrans rarement affichés
const MONTRER = `((ids) => {
  document.querySelectorAll("body > section, main > section, #enLigne > div").forEach((e) => { e.style.display = "none"; });
  ids.forEach((id) => { const e = document.getElementById(id); if (!e) return; e.style.display = "";
    if (getComputedStyle(e).display === "none") e.style.display = "flex";
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { p.style.display = ""; if (getComputedStyle(p).display === "none") p.style.display = "flex"; } });
})`;
const ENLIGNE = `document.getElementById('codePartieAffiche').innerText = 'Code : ABCD'; const m = document.getElementById('infoModeSoft'); if (m) m.style.display=''; document.getElementById('listeJoueursEnLigne').innerHTML = '<div>Tris<button class=btnExclure>X</button></div><div>Ylana</div>'; document.getElementById('lancerPartieEnLigne').style.display='';`;

// [nom, partie (null : pas de partie ; [] : partie normale ; ["optionModeHot"] : partie hot), code à lancer, attente ms]
const ECRANS = [
  ["accueil", null, "", 300],
  ["accueil : aide du début", null, "afficherAideAccueil()", 600],
  ["accueil : notification", null, "afficherNotificationHaut('⭐', 'Sticker gagné : Licorne')", 600],
  ["accueil : bandeau de mise à jour", null, "afficherBandeauMiseAJour()", 600],
  ["réglages", null, "ouvrirReglages()", 700],
  ["réglages : options de la partie", null, "ouvrirOptionsPartie(() => {})", 700],
  ["règles", null, "ouvrirRegles()", 700],
  ["questions fréquentes", null, "ouvrirFaq()", 700],
  ["album de stickers", null, "ouvrirAlbum()", 700],
  ["créateurs", null, "ouvrirPage(document.getElementById('ecranCredits'))", 700],
  ["signaler un bug", null, "ouvrirEcranBug()", 700],
  ["installation", null, "ouvrirEcranInstallation()", 700],
  ["caster sur la télé", null, "ouvrirEcranCaster()", 700],
  ["caster : télé connectée", null, "ouvrirEcranCaster(); document.getElementById('casterRelier').style.display='none'; document.getElementById('casterConnecte').style.display=''; document.getElementById('texteCasterConnecte').innerText='Connecté à la télé ABCDE'", 700],
  ["caméra (scan d'un QR code)", null, MONTRER + "(['ecranScanner'])", 500],
  ["fenêtre Prestige débloqué", null, "afficherFenetrePrestige()", 700],
  ["fenêtre BDSM débloqué", null, "afficherFenetreBdsm()", 700],
  ["fenêtre Kawaii débloqué", null, "afficherFenetreKawaii()", 700],
  ["fenêtre Star Wars débloqué", null, "afficherFenetreGalaxie()", 700],
  ...["enLigneChoix", "enLigneCreer", "enLigneRejoindre", "enLigneRevenir", "salleAttente"].map((id) => [`en ligne : ${id}`, null, MONTRER + `(['enLigne', '${id}']); ${ENLIGNE}`, 700]),
  ...["ecranNouvellePartie", "ecranChoixPseudo", "ecranConfirmerAccueil", "ecranConfirmerHote", "ecranConfirmerRetrait", "ecranReprise", "ecranPause"].map((id) =>
    [id, null, MONTRER + `(['${id}']); document.querySelectorAll('#${id} .texteConfirmation, #${id} h2').forEach(e => { if (!e.innerText.trim()) e.innerText = 'Texte de test'; })`, 700]),
  ["ajout des joueurs", ["__avantJouer"], "", 300],
  ["plateau (début de partie)", [], "", 300],
  ["plateau (en cours)", [], "document.querySelectorAll('#plateau .Carte').forEach((c, i) => { if (i < 5) c.classList.add('retournee', classes[i * 7 % classes.length]); }); indexPigeon = 1; afficherJoueurs(); afficherJoueurActif()", 500],
  ["volet dernières cartes", [], "ouvrirVoletHistorique()", 600],
  ["volet d'une carte", [], "ouvrirVoletCarte(classes.find(c => c.startsWith('plus')) || classes[0])", 600],
  ["volet pause d'un joueur", [], "ouvrirVoletPause(joueurs[1], document.querySelectorAll('.btnPauseJoueur')[1])", 600],
  ["retirer un joueur (en jeu)", [], "ouvrirRetraitEnJeu()", 700],
  ["rappel de boire de l'eau", [], "afficherRappelEau()", 700],
  ["message en bas (toast)", [], "afficherToast('Connexion perdue, on réessaie…', 5000)", 400],
  ["annonce d'une règle", [], "montrerOverlayRegle('Tris boit 3 gorgées\\nEt un détail en dessous', 'trois_rouge'); reglerDureeOverlayRegle('', null)", 900],
  ["annonce du premier pigeon", [], "indexPigeon = null; montrerOverlayRegle('Tris est le PIGEON !\\nIl/elle boit 2 gorgées.\\nÀ chaque 3 tiré, le PIGEON boit 1 gorgée.\\nPour s\\'en débarrasser : tirer un 3.', 'trois_vert'); reglerDureeOverlayRegle('', null)", 900],
  ["Célien (plus de 15 gorgées)", [], "montrerOverlayRegle('Ylana boit 2 gorgées', 'deux_bleu'); habillerOverlayCelien('Ylana boit 2 gorgées', 'Une citation de Célien', 'Célien'); reglerDureeOverlayRegle('', null)", 900],
  ["choix de la couleur", [], "afficherOverlayCouleur(0)", 900],
  ["carte dorée : annonce", [], "montrerOverlayRegle('CARTE DORÉE\\nDistribue un CUL SEC', 'carte_doree'); habillerOverlayCarteDoree('Distribue un CUL SEC de la part du développeur'); reglerDureeOverlayRegle('', null)", 900],
  ["carte dorée : choix", [], "afficherOverlayCarteDoree(0)", 900],
  ["carte dorée : personne ne l'a trouvée", [], "montrerOverlayRegle(\"Personne n'a trouvé la CARTE DORÉE !!\\nCUL SEC pour Tris\", 'carte_doree'); reglerDureeOverlayRegle('', null)", 900],
  ["tiens ta gueule", [], "afficherOverlayTiensGueule(1)", 900],
  ["duel : choix de l'adversaire", [], "lancerOverlayChoixDuel(0, '')", 900],
  ["duel : tirage", [], "lancerOverlayChoixDuel(0, ''); const tap = (k) => { const b = document.querySelectorAll('#overlayDuel .duel-boutons .bouton-pigeon')[k]; b.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true})); b.click(); }; setTimeout(() => tap(0), 300); setTimeout(() => tap(1), 700)", 2600],
  ["+4", [], "afficherOverlayPlus4(0, 'plus_4')", 900],
  ["choix du nouveau pigeon", [], "indexPigeon = 0; afficherMenuPigeon()", 900],
  ["annulation d'une gorgée", [], "annulations[joueurs[1]] = 2; afficherOverlayAnnulation(1, 3)", 900],
  ["résultat de l'annulation", [], "afficherOverlayResultatAnnulation('Ylana annule ses 3 gorgées')", 900],
  ["pari de fin", [], "cartesRestantes = () => 1; lancerOverlayPrediction(0)", 1200],
  ["fin de partie", [], "statsPartie.doree = { personne: false, soft: false, tireur: joueurs[0], victime: joueurs[1] }; afficherOverlayFinUnRestants()", 1200],
  ["défi hot", ["optionModeHot"], "montrerOverlayRegle('Ylana boit 2 gorgées', 'deux_bleu'); montrerDefiHot(1, 2); reglerDureeOverlayRegle('', null)", 900],
  ["Cupidon", ["optionModeHot"], "afficherOverlayCupidon(0, 'cupidon_a')", 900],
];

(async () => {
  const dossier = C.preparerDossier("affichage_telephone", theme);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(C.scriptMesure());
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("alcuno_theme", t); localStorage.setItem("alcuno_album_decouvert", "1");
      // thèmes secrets débloqués (sinon le jeu remet Bordeaux)
      ["alcuno_theme_prestige", "alcuno_theme_galaxie", "alcuno_theme_kawaii", "alcuno_theme_donjon"].forEach((k) => localStorage.setItem(k, "1"));
    } catch (e) {}
    window.__erreursTest = [];
    window.addEventListener("error", (e) => window.__erreursTest.push(String(e.message)));
    // pas d'animations de transition pendant les mesures (le thème est retiré puis remis)
    document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "*,*::before,*::after{transition:none!important}"; document.head.appendChild(s); });
  }, theme);
  const page = await ctx.newPage();
  const erreurs = []; page.on("pageerror", (x) => erreurs.push(x.message));
  const ecrans = []; const infos = []; const ouverts = new Set();
  let controlerBoutons = true;

  const ouvrir = async () => {
    await page.goto(C.URL_JEU, { waitUntil: "load" }); await page.waitForTimeout(500);
    await page.evaluate((t) => { document.documentElement.setAttribute("data-theme", t); document.querySelectorAll("#aideAccueil").forEach((e) => e.remove()); }, theme);
  };
  const faire = async (nom, prep, attente, numero) => {
    const debutErreurs = erreurs.length;
    let erreurTest = null;
    if (prep) { try { await page.evaluate(prep); } catch (e) { erreurTest = e.message.split("\n")[0]; } }
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await page.waitForTimeout(attente);
    (await page.evaluate(() => [...document.querySelectorAll("[id^=overlay], section[id]")].filter((e) => getComputedStyle(e).display !== "none").map((e) => e.id))).forEach((id) => ouverts.add(id));
    const r = await C.verifierEcran(page, theme, "telephone", controlerBoutons);
    if (nom === "accueil") {
      controlerBoutons = r.boutonsHabilles > 0;
      if (!controlerBoutons) { infos.push("les boutons de l'accueil gardent le style de base (jaune) : les « boutons oubliés » ne sont pas cherchés pour ce thème"); r.problemes = r.problemes.filter((p) => !p.startsWith("BOUTON")); }
    }
    if (erreurTest) r.problemes.unshift(`ERREUR DU TEST  ${erreurTest} (écran non ouvert : à mettre à jour dans le test)`);
    erreurs.slice(debutErreurs).forEach((m) => r.problemes.push(`ERREUR JS      ${m}`));
    const base = String(numero).padStart(2, "0") + "_" + nom.replace(/[^\wÀ-ÿ]+/g, "_").slice(0, 40);
    const images = [base + ".png"];
    await page.screenshot({ path: path.join(dossier, images[0]) });
    // écran qui défile : aussi le bas
    const defile = await page.evaluate(() => {
      const el = [...document.querySelectorAll("body *")].filter((e) => { const c = getComputedStyle(e); return /(auto|scroll)/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 300; }).pop();
      if (!el) return false; el.scrollTop = el.scrollHeight; return true;
    });
    if (defile) { await page.waitForTimeout(200); images.push(base + "_bas.png"); await page.screenshot({ path: path.join(dossier, images[1]) }); }
    ecrans.push({ nom, problemes: r.problemes, images });
    process.stdout.write(r.problemes.length ? "x" : ".");
  };

  let n = 0;
  for (const [nom, partie, prep, attente] of ECRANS) {
    n++;
    await ouvrir();
    if (partie) { await page.evaluate(`${LANCER}(${JSON.stringify(partie)})`); await page.waitForTimeout(300); }
    await faire(nom, prep, attente, n);
  }

  // Écrans de index.html que la liste ne connaît pas : visités quand même
  await ouvrir();
  const sections = await page.evaluate(() => [...document.querySelectorAll("section[id]")].map((s) => s.id));
  for (const id of sections.filter((id) => !ouverts.has(id))) {
    n++; await ouvrir();
    await faire(`écran ${id} (non prévu dans le test)`, MONTRER + `(['${id}'])`, 700, n);
    infos.push(`écran « ${id} » visité, mais pas prévu dans la liste du test : à y ajouter avec un vrai contenu`);
  }
  // Fenêtres que le code sait créer mais que le test n'a pas ouvertes
  const toutes = new Set();
  for (const f of fs.readdirSync(path.join(C.RACINE, "js")).filter((f) => f.endsWith(".js")))
    for (const m of fs.readFileSync(path.join(C.RACINE, "js", f), "utf8").matchAll(/\.id\s*=\s*"(overlay[A-Za-z]+)"/g)) toutes.add(m[1]);
  const manquantes = [...toutes].filter((x) => !ouverts.has(x));
  if (manquantes.length) infos.push("fenêtres jamais ouvertes par le test (à y ajouter) : " + manquantes.join(", "));

  console.log("");
  C.ecrirePlanche(dossier, `Affichage du téléphone : thème ${theme}`, ecrans);
  C.conclure(`Affichage du téléphone : thème ${theme}`, dossier, ecrans, avertissements, infos);
  await b.close();
})();
