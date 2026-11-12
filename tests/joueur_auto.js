// Joue automatiquement une partie classique complète et écrit un rapport dans #rapport
(function(){
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const journal = [];
  const pd = (el) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  let nbPlus4 = 0;
  let nbDefis = 0;
  const visible = (el) => cliquable(el) && el.style.display !== "none";
  const cliquable = (el) => el && el.isConnected && !el.disabled &&
    getComputedStyle(el).pointerEvents !== "none" && !el.classList.contains("disabled");

  function ecrireRapport(fin){
    const r = document.getElementById("rapport") || document.body.appendChild(Object.assign(document.createElement("pre"), { id: "rapport" }));
    const joueursTxt = $("#listeJoueurs") ? $("#listeJoueurs").innerText.replace(/\s+/g, " ") : "";
    const finTxt = $("#overlayFinUnRestants") ? $("#overlayFinUnRestants").innerText.replace(/\s+/g, " ") : "";
    r.textContent = "RAPPORT_DEBUT\n" + JSON.stringify({
      fin, erreurs: window.__erreurs, nbActions: journal.length,
      cartesRetournees: $$("#plateau .Carte.retournee").length,
      cartesTotal: $$("#plateau .Carte").length,
      joueurs: joueursTxt, ecranFin: finTxt, journal
    }, null, 1) + "\nRAPPORT_FIN";
  }

  window.addEventListener("load", () => {
    $("#btnModeClassique").click();
    // Écran « Ta partie » (Mode PJ, express, hot) : les cases à cocher données par le test (window.__optionsRobot, liste d'id)
    (window.__optionsRobot || []).forEach((id) => { const c = document.getElementById(id); if (c && !c.checked) c.click(); });
    if ($("#btnContinuerOptions")) $("#btnContinuerOptions").click();
    for (const n of ["Tris", "Ylana", "Celien"]) {
      $("#nomJoueur").value = n;
      pd($("#ajouterJoueur"));
    }
    pd($("#jouer"));

    let tours = 0;
    const tick = () => {
      tours++;
      if (tours > 6000) { ecrireRapport("trop_long"); return; }

      const fin = $("#overlayFinUnRestants .bouton-pigeon");
      if (fin) { journal.push("fin"); ecrireRapport("ok"); return; }

      // Plus 4 : distribuer puis valider
      if ($("#overlayPlus4")) {
        const valider = $$("#overlayPlus4 .plus4-action-btn").find(b => b.innerText.includes("Valider"));
        if (cliquable(valider)) { journal.push("+4 valider"); pd(valider); }
        else { const b = $$("#overlayPlus4 .plus4-joueur-btn")[(nbPlus4++) % 3]; journal.push("+4 " + b.innerText.split(" ")[0]); pd(b); }
        return setTimeout(tick, 40);
      }

      // Mode hot : défi dans l'annonce (un coup « Je le fais », un coup « Je bois »)
      if ($("#overlayRegleUnique .bloc-hot-btn")) {
        const boutons = $$("#overlayRegleUnique .bloc-hot-btn").filter(cliquable);
        if (boutons.length) { journal.push("defi " + (nbDefis % 2 ? "bois" : "fait")); pd(boutons[nbDefis++ % 2] || boutons[0]); }
        return setTimeout(tick, 60);
      }
      // Mode hot, période Saint-Valentin : Coup de foudre (choisir quelqu'un, puis bisou ou cul sec, en alternance)
      if ($("#overlayCoupDeFoudre")) {
        const btns = $$("#overlayCoupDeFoudre button").filter(visible);
        const bisou = btns.find(b => b.innerText.includes("Bisou")), culsec = btns.find(b => b.innerText.includes("🥃"));
        if (bisou && culsec) { const b = nbDefis++ % 2 ? culsec : bisou; journal.push("coup de foudre " + b.innerText.trim()); pd(b); }
        else if (btns.length) { journal.push("coup de foudre joueur"); pd(btns[0]); }
        return setTimeout(tick, 60);
      }
      // Mode hot : Cupidon (lier deux joueurs, puis valider ; sinon briser un lien)
      if ($("#overlayCupidon")) {
        const btns = $$("#overlayCupidon button").filter(visible);
        const texte = (b) => b.innerText.trim();
        const lier = btns.find(b => texte(b) === "Lier deux joueurs");
        const valider = btns.find(b => texte(b) === "Valider");
        const joueursLier = btns.filter(b => b.dataset.nom);
        if (lier) { journal.push("cupidon lier"); pd(lier); }
        else if (joueursLier.length) {
          const aChoisir = joueursLier.find(b => !b.innerText.includes("💘") && !b.disabled);
          if (valider && cliquable(valider)) { journal.push("cupidon valider"); pd(valider); }
          else if (aChoisir) { journal.push("cupidon joueur " + aChoisir.dataset.nom); pd(aChoisir); }
        } else {
          const lien = btns.find(b => b.innerText.includes("💘"));
          if (lien) { journal.push("cupidon briser"); pd(lien); }
        }
        return setTimeout(tick, 60);
      }

      const choix = [
        "#overlayCouleur .carre-couleur",
        "#overlayPigeon .bouton-pigeon",
        "#overlayDuel .duel-boutons .bouton-pigeon",
        "#overlayDuel .duel-cartes .Carte",
        "#overlayAnnulation .bouton-annulation",
        "#overlayCarteDoree .bouton-doree",
        "#overlayPredictionFin .fin-choix-card",
        "#overlayPredictionFin .bouton-pigeon"
      ];
      for (const sel of choix) {
        const el = $$(sel).filter(cliquable)[sel.includes("annulation") ? 1 : 0] || $$(sel).filter(cliquable)[0];
        if (el) { journal.push(sel.split(" ").pop() + ":" + (el.innerText || el.className).trim().slice(0, 20)); if (sel.includes("#overlayPredictionFin")) el.click(); else pd(el); /* (les cartes et les boutons du pari réagissent au doigt levé) */ return setTimeout(tick, 40); }
      }

      // Overlays de message : on les ferme au tap
      const msg = $("#overlayRegleUnique") || $("#overlayResultatAnnulation");
      if (msg) { pd(msg); return setTimeout(tick, 60); }

      // Sinon : on retourne la prochaine carte du plateau
      const carte = $$("#plateau .Carte:not(.retournee)")[0];
      if (carte) { journal.push("carte"); carte.click(); }
      setTimeout(tick, 60);
    };
    setTimeout(tick, 200);
  });
})();
