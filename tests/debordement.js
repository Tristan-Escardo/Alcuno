// Ce qui déborde sur l'écran affiché (utilisé par test_debordement.ps1). Renvoie une liste de problèmes :
//  - COUPÉ EN HAUT : un élément commence au-dessus de l'écran alors que l'écran est tout en haut
//    (on ne pourra jamais le voir en défilant)
//  - DÉBORDE SUR LE CÔTÉ : l'écran est plus large que la fenêtre (il défile de côté)
//  - ÉCRASÉ : un bouton visible fait 0 px de haut (ex. joueurs du +4)
window.verifierDebordement = function () {
  const affiche = (e) => {
    const st = getComputedStyle(e);
    return st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0;
  };
  // Écran plein du dessus (overlay, page, accueil…), sinon la page elle-même
  const couvrants = [...document.querySelectorAll("body *")].filter((e) => {
    const st = getComputedStyle(e);
    if (st.position !== "fixed" || !affiche(e) || st.pointerEvents === "none") return false;
    const r = e.getBoundingClientRect();
    return r.width >= innerWidth * 0.95 && r.height >= innerHeight * 0.9;
  });
  const z = (e) => Number(getComputedStyle(e).zIndex) || 0;
  const dessus = couvrants.sort((a, b) => z(a) - z(b)).pop();
  const ecran = dessus || document.scrollingElement;
  const nom = (e) => e.id ? "#" + e.id : e.tagName.toLowerCase() +
    (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/)[0] : "");
  const problemes = [];
  const ancienDefil = ecran.scrollTop;
  ecran.scrollTop = 0;
  const haut = dessus ? dessus.getBoundingClientRect().top : 0;
  (dessus || document.body).querySelectorAll("*").forEach((el) => {
    if (!affiche(el) || el.closest("svg, #notifHaut, #stickyJoueurActif, #rappelEau")) return;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (!affiche(p)) return;
    const st = getComputedStyle(el);
    if (st.position === "fixed" && el !== dessus) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    if (r.top < haut - 1 && r.height > 0) problemes.push("COUPÉ EN HAUT : " + nom(el) + " (" + Math.round(r.top - haut) + " px)");
    if (el.tagName === "BUTTON" && r.width > 0 && r.height < 1) problemes.push("ÉCRASÉ : " + nom(el) + " « " + el.innerText.trim().slice(0, 20) + " »");
  });
  ecran.scrollTop = ancienDefil;
  if (ecran.scrollWidth > ecran.clientWidth + 1 && getComputedStyle(ecran).overflowX !== "hidden") {
    problemes.push("DÉBORDE SUR LE CÔTÉ : " + nom(ecran) + " (" + ecran.scrollWidth + " px pour " + ecran.clientWidth + ")");
  }
  return [...new Set(problemes)];
};
