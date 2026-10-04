// Lisibilité des textes : pour chaque texte visible, contraste entre sa couleur et le fond effectif
// derrière lui (1 = invisible, 21 = noir sur blanc). Utilisé par test_contraste.ps1.
// Renvoie [{ ratio, cle }] pour les textes sous le seuil.
window.verifierContraste = function (seuil) {
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const melange = (haut, bas) => ({
    r: haut.r * haut.a + bas.r * (1 - haut.a), g: haut.g * haut.a + bas.g * (1 - haut.a),
    b: haut.b * haut.a + bas.b * (1 - haut.a), a: 1
  });
  const couleurCss = (valeur) => {
    const d = document.createElement("div");
    d.style.color = valeur;
    document.body.appendChild(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return parse(c);
  };
  const fondTheme = couleurCss(getComputedStyle(document.documentElement).getPropertyValue("--fond-theme").trim());

  // Fond effectif : couleurs de fond des parents empilées, jusqu'à une couche opaque.
  // Un dégradé compte pour sa première couleur opaque (boutons, panneaux), sinon pour sa première
  // couleur si elle est assez opaque.
  function fondDe(el) {
    const couches = [];
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const st = getComputedStyle(e);
      const img = st.backgroundImage;
      if (img && img !== "none" && !img.includes("url(")) {
        const m = img.match(/rgba?\([^)]+\)/g);
        const couleurs = m ? m.map(parse) : [];
        const opaque = couleurs.find((c) => c.a >= 0.99);
        if (opaque) { couches.push(opaque); break; }
        // dégradé presque opaque (pastille « Tour de ») : compte comme une couche
        if (couleurs.length && couleurs[0].a >= 0.5) couches.push(couleurs[0]);
      }
      const c = parse(st.backgroundColor);
      if (c && c.a > 0) { couches.push(c); if (c.a >= 0.99) break; }
    }
    let res = { ...fondTheme };
    for (let i = couches.length - 1; i >= 0; i--) res = melange(couches[i], res);
    return res;
  }

  const affiche = (e) => {
    const st = getComputedStyle(e);
    return st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0;
  };
  const visible = (e) => {
    const r = e.getBoundingClientRect();
    return affiche(e) && r.width > 0 && r.height > 0;
  };
  // Écran plein par-dessus le reste (overlay, réglages, créateurs…) : seuls ses textes comptent
  const couvrants = [...document.querySelectorAll("body *")].filter((e) => {
    const st = getComputedStyle(e);
    if (st.position !== "fixed" || !visible(e)) return false;
    const r = e.getBoundingClientRect();
    return r.width >= innerWidth * 0.95 && r.height >= innerHeight * 0.9 && st.pointerEvents !== "none";
  });
  const dessus = couvrants.sort((a, b) => (Number(getComputedStyle(a).zIndex) || 0) - (Number(getComputedStyle(b).zIndex) || 0)).pop();

  const nom = (e) => (e.id ? "#" + e.id : e.tagName.toLowerCase() +
    (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).join(".") : ""));
  const res = [];
  (dessus || document.body).querySelectorAll("*").forEach((el) => {
    if (el.closest(".Carte, svg, #notifHaut, #rappelEau, #annonceNouvellePartie, #btnCodePartie, #stickyJoueurActif:not(.visible)")) return;
    if (!visible(el)) return;
    // (parents : pas de test de taille, <main> fait 0 px de haut sous ses écrans fixes)
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) if (!affiche(e)) return;
    const texte = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").trim();
    if (!texte && !(el.tagName === "INPUT" && el.placeholder)) return;
    const st = getComputedStyle(el);
    const fond = fondDe(el);
    const c = melange(parse(st.color), fond);
    const l1 = lum(c), l2 = lum(fond);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < seuil) {
      res.push({ ratio: Math.round(ratio * 100) / 100,
                 cle: nom(el.parentElement) + " > " + nom(el) + " « " + (texte || el.placeholder).slice(0, 30) + " »" });
    }
  });
  return res;
};
