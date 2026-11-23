// Retirer un joueur avant la partie : ✕ sur chaque nom, bandeau « Annuler » 5 s ; rien en partie.
// Le jeu doit être servi (comme les autres tests navigateur) : URL_JEU, par défaut http://localhost:8765/index.html
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const URL = process.env.URL_JEU || "http://localhost:8765/index.html";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(2500);
  const r = await p.evaluate(async () => {
    const $ = (s) => document.querySelector(s);
    const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const croix = (nom) => [...document.querySelectorAll("#listeJoueurs .joueur-ligne")].find((l) => l.textContent.includes(nom)).querySelector(".btnRetirerJoueur");
    const res = {};
    $("#btnModeClassique").click();
    if ($("#btnContinuerOptions")) $("#btnContinuerOptions").click();
    for (const n of ["Léa", "Tom", "Max", "Inès"]) { $("#nomJoueur").value = n; pd($("#ajouterJoueur")); }
    res.croixAvant = document.querySelectorAll("#listeJoueurs .btnRetirerJoueur").length;
    res.boutonSupprimerCache = !$("#supprimerJoueur") && !$("#suppression");
    // retirer Max puis annuler : il revient à sa place
    croix("Max").click();
    res.apresRetrait = joueurs.join(",");
    res.toast = $("#toastRetrait.visible .toastRetrait-texte")?.textContent;
    $("#toastRetrait .toastRetrait-annuler").click();
    res.apresAnnuler = joueurs.join(",");
    res.toastFerme = !$("#toastRetrait").classList.contains("visible");
    // deux retraits d'affilée : « Annuler » ne remet que le dernier
    croix("Léa").click(); croix("Tom").click();
    res.texteDernier = $("#toastRetrait .toastRetrait-texte").textContent;
    $("#toastRetrait .toastRetrait-annuler").click();
    res.apresDeux = joueurs.join(",");
    // sans « Annuler » : définitif après 5 s
    croix("Inès").click();
    await attendre(5300);
    res.toastParti = !$("#toastRetrait").classList.contains("visible");
    $("#toastRetrait .toastRetrait-annuler").click();
    res.definitif = joueurs.join(",");
    // « Jouer » pendant le bandeau : la partie part sans lui, plus d'annulation possible
    for (const n of ["Hugo", "Zoé"]) { $("#nomJoueur").value = n; pd($("#ajouterJoueur")); }
    croix("Zoé").click();
    pd($("#jouer"));
    await attendre(1200);
    res.toastApresJouer = !$("#toastRetrait").classList.contains("visible");
    $("#toastRetrait .toastRetrait-annuler").click();
    res.joueursEnPartie = joueurs.join(",");
    res.croixEnPartie = document.querySelectorAll("#listeJoueurs .btnRetirerJoueur").length;
    res.boutonEnPartie = !!document.querySelector("#supprimerJoueur, #suppression");
    return res;
  });
  assert.equal(r.croixAvant, 4, "un ✕ sur chaque nom avant la partie");
  assert.ok(r.boutonSupprimerCache, "plus de bouton ni de page « Supprimer un joueur »");
  assert.equal(r.apresRetrait, "Léa,Tom,Inès");
  assert.equal(r.toast, "Max a été retiré");
  assert.equal(r.apresAnnuler, "Léa,Tom,Max,Inès", "Annuler : Max revient à sa place");
  assert.ok(r.toastFerme, "bandeau fermé après Annuler");
  assert.equal(r.texteDernier, "Tom a été retiré");
  assert.equal(r.apresDeux, "Tom,Max,Inès", "Annuler ne remet que le dernier retiré");
  assert.ok(r.toastParti, "bandeau parti après 5 s");
  assert.equal(r.definitif, "Tom,Max", "après 5 s, le retrait est définitif");
  assert.ok(r.toastApresJouer, "bandeau fermé au lancement de la partie");
  assert.equal(r.joueursEnPartie, "Tom,Max,Hugo", "la partie part sans le joueur retiré");
  assert.equal(r.croixEnPartie, 0, "pas de ✕ en partie");
  assert.equal(r.boutonEnPartie, false, "aucun moyen de retirer un joueur en partie (3 joueurs)");
  assert.deepEqual(erreurs, [], "aucune erreur dans la page");
  console.log("Retrait avant la partie : ✕, Annuler (5 s), rien en partie.");
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
