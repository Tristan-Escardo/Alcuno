// Joueur automatique pour le mode en ligne : clique tout ce qui est cliquable (le jeu ignore les clics
// qui ne sont pas au bon joueur). Contrôlé par window.__auto.start() / stop(). Journalise les erreurs.
(function(){
  if (window.__auto) return;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  const cliquable = (el) => el && el.isConnected && !el.disabled &&
    getComputedStyle(el).pointerEvents !== "none" && !el.classList.contains("disabled");
  window.__erreurs = window.__erreurs || [];
  window.addEventListener("error", (e) => window.__erreurs.push(String(e.message)));
  let actif = false, nbPlus4 = 0;
  const tick = () => {
    if (!actif) return;
    if ($("#ecranRattrapage")) return setTimeout(tick, 200);
    if ($("#overlayPlus4")) {
      const valider = $$("#overlayPlus4 .plus4-action-btn").find(b => b.innerText.includes("Valider"));
      if (cliquable(valider)) pd(valider); else { const b = $$("#overlayPlus4 .plus4-joueur-btn")[(nbPlus4++) % 2]; if (b) pd(b); }
      return setTimeout(tick, 250);
    }
    const choix = ["#overlayCouleur .carre-couleur", "#overlayPigeon .bouton-pigeon", "#overlayDuel .duel-boutons .bouton-pigeon",
      "#overlayDuel .duel-cartes .Carte", "#overlayAnnulation .bouton-annulation", "#overlayCarteDoree .bouton-doree",
      "#overlayPredictionFin .fin-choix-card", "#overlayPredictionFin .bouton-pigeon", "#overlayFinUnRestants .bouton-pigeon"];
    for (const sel of choix) { const el = $$(sel).filter(cliquable)[0]; if (el) { pd(el); return setTimeout(tick, 300); } }
    const msg = $("#overlayRegleUnique") || $("#overlayResultatAnnulation");
    if (msg) { pd(msg); return setTimeout(tick, 300); }
    const label = $("#stickyJoueurActif .sticky-label");
    if (label && /à toi/i.test(label.innerText)) { const c = $$("#plateau .Carte:not(.retournee)")[0]; if (c) c.click(); }
    setTimeout(tick, 400);
  };
  window.__auto = { start(){ if (!actif){ actif = true; tick(); } }, stop(){ actif = false; } };
  // Empreinte de l'état du jeu, pour comparer deux téléphones
  window.__etat = () => JSON.stringify({
    cartes: $$("#plateau .Carte").map(c => c.className.replace(/\s*(duel-a-choisir|dos_dore)\s*/g, " ").trim()).join("|"),
    joueurs: ($("#listeJoueurs") || {}).innerText,
    tour: ($("#stickyJoueurActif .sticky-nom") || {}).innerText,
    regles: ($("#messageTexte") || {}).innerText
  });
})();
