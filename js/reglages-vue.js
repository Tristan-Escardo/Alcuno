// ===== Vues des Réglages : Liste (d'origine), Sections repliables, Tuiles =====
// Aucun bloc n'est déplacé dans la page (« Modifier » et « Ta partie » de js/reglages.js continuent de marcher) : chaque bloc reçoit
// un attribut data-groupe, et le CSS (style_alcuno.css, « Vues des Réglages ») les ordonne et les montre ou cache selon la vue choisie.
// Le choix est gardé sur ce téléphone (clé alcuno_reglages_vue : liste | sections | tuiles).
// #region Vues des Réglages
(function(){
  const ecran = document.getElementById("ecranReglages");
  const contenu = ecran && ecran.querySelector(".reglages-contenu");
  if (!contenu) return;
  const CLE_VUE = "alcuno_reglages_vue";
  const GROUPES = [
    { id: "affichage", nom: "Affichage", icone: "🎨", cles: ["themes", "feux-artifice", "faces-cachees", "gaucher", "accessibilite"] },
    { id: "son", nom: "Son", icone: "🔊", cles: ["sons", "musique", "vibrations", "voix"] },
    { id: "jeu", nom: "Jeu", icone: "🎮", cles: ["eau", "ecran-allume", "partie-memoire"] },
    { id: "appareil", nom: "Appareil", icone: "📱", cles: ["hors-ligne", "ecran-tele"] },
    { id: "langue", nom: "Langue", icone: "🌐", cles: ["langue"] },
    { id: "apropos", nom: "À propos", icone: "ℹ️", cles: [] } // (Partager le jeu + À propos : sans data-cle, repérés par leur classe)
  ];
  const groupeDe = (cle) => (GROUPES.find((g) => g.cles.includes(cle)) || GROUPES[2]).id; // (réglage ajouté plus tard : rangé dans « Jeu »)
  Array.from(contenu.children).forEach((el) => {
    if (el.dataset.cle) el.dataset.groupe = groupeDe(el.dataset.cle);
    else if (el.classList.contains("blocPartage") || el.classList.contains("aPropos")) el.dataset.groupe = "apropos";
  });

  const lire = () => { try { const v = localStorage.getItem(CLE_VUE); return v === "sections" || v === "tuiles" ? v : "liste"; } catch (e) { return "liste"; } };
  let vue = lire();
  let actif = ""; // tuiles : le groupe ouvert ("" = la page des tuiles)
  const ouverts = new Set(); // sections : les groupes ouverts (tout est fermé quand on lance l'appli)
  // Changer de thème recharge la page (js/reglages.js) et rouvre les Réglages : on garde donc la tuile / les sections ouvertes (sessionStorage)
  const CLE_ETAT = "alcuno_reglages_etat";
  const idsOK = GROUPES.map((g) => g.id);
  // L'état n'est repris QUE si la page vient d'être rechargée par un changement de thème (la classe « rouvrir-vue » est posée par le <head>
  // de index.html dans ce cas seulement) ; à un lancement normal de l'appli, tout est fermé.
  const apresChangementDeTheme = document.documentElement.classList.contains("rouvrir-vue");
  try {
    const e = apresChangementDeTheme ? JSON.parse(sessionStorage.getItem(CLE_ETAT) || "null") : null;
    if (e && typeof e === "object") {
      if (idsOK.includes(e.actif)) actif = e.actif;
      if (Array.isArray(e.ouverts)) { ouverts.clear(); e.ouverts.filter((i) => idsOK.includes(i)).forEach((i) => ouverts.add(i)); }
    }
  } catch (e) {}
  const sauverEtat = () => { try { sessionStorage.setItem(CLE_ETAT, JSON.stringify({ actif, ouverts: Array.from(ouverts) })); } catch (e) {} };

  const h2 = document.getElementById("titreReglages");
  const el = (balise, classe, texte) => { const e = document.createElement(balise); if (classe) e.className = classe; if (texte != null) e.textContent = texte; return e; };

  // « Mise en page » : un bouton en haut à droite (à la place d'où était « Modifier », qui passe dessous) ouvre un petit menu à trois choix
  const ICONES_VUE = {
    liste: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    sections: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="6" rx="2"/><path d="M4 15h16M4 19h16"/></svg>',
    tuiles: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>'
  };
  const VUES = [["liste", "Liste"], ["sections", "Sections"], ["tuiles", "Tuiles"]];
  const btnMEP = el("button", "btnMiseEnPage"); btnMEP.type = "button"; btnMEP.id = "btnMiseEnPage";
  btnMEP.setAttribute("aria-haspopup", "menu"); btnMEP.setAttribute("aria-expanded", "false");
  btnMEP.innerHTML = '<span class="mepIcone"></span><span class="mepTexte">Mise en page</span><span class="mepFleche" aria-hidden="true"></span>';
  const menuMEP = el("div", "menuMiseEnPage"); menuMEP.id = "menuMiseEnPage"; menuMEP.setAttribute("role", "menu"); menuMEP.hidden = true;
  const titreMenu = el("div", "menuMEPTitre", "Présenter en"); menuMEP.append(titreMenu);
  const itemsMEP = VUES.map(([id, nom]) => {
    // (pas un <button> : les thèmes à néon dessinent un cadre lumineux autour de chaque bouton ; ici, le néon est autour du menu entier)
    const b = el("div", "menuMEPItem"); b.tabIndex = 0; b.dataset.vue = id; b.setAttribute("role", "menuitemradio");
    b.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); b.click(); } });
    b.innerHTML = ICONES_VUE[id] + "<span></span><span class=\"menuMEPCoche\" aria-hidden=\"true\">✓</span>"; b.children[1].textContent = nom;
    b.addEventListener("click", () => {
      fermerMenuMEP();
      if (vue === id) return;
      vue = id; actif = ""; try { localStorage.setItem(CLE_VUE, id); } catch (e) {}
      majVue(); entrer(Array.from(contenu.querySelectorAll(":scope > [data-groupe]")).filter((e) => e.offsetHeight > 0));
    });
    menuMEP.append(b); return b;
  });
  function fermerMenuMEP(){ menuMEP.hidden = true; btnMEP.setAttribute("aria-expanded", "false"); }
  btnMEP.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const ouvrir = menuMEP.hidden;
    menuMEP.hidden = !ouvrir; btnMEP.setAttribute("aria-expanded", ouvrir ? "true" : "false");
    if (ouvrir && !calme() && menuMEP.animate) menuMEP.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "ease-out" });
  });
  document.addEventListener("pointerdown", (ev) => { if (!menuMEP.hidden && !menuMEP.contains(ev.target) && !btnMEP.contains(ev.target)) fermerMenuMEP(); }, true);
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !menuMEP.hidden) { fermerMenuMEP(); btnMEP.focus(); } });
  ecran.append(btnMEP, menuMEP);
  const boutonRetour = document.getElementById("btnFermerReglages");
  if (boutonRetour) boutonRetour.addEventListener("click", fermerMenuMEP, true);
  const choix = h2; // (les tuiles se placent juste après le titre)

  // Animations : un bloc qui apparaît glisse et se fond (en cascade) ; un bloc qui disparaît se fond d'abord. Pas d'animation si le
  // téléphone demande moins de mouvement.
  const calme = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
  function entrer(liste){
    if (calme()) return;
    liste.forEach((e, i) => { if (e.animate) e.animate([{ opacity: 0, transform: "translateY(-10px)" }, { opacity: 1, transform: "none" }], { duration: 260, delay: Math.min(i, 8) * 40, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }); });
  }
  function sortir(liste, apres){
    if (calme() || !liste.length || !liste[0].animate) { apres(); return; }
    const anims = liste.map((e) => e.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px)" }], { duration: 140, easing: "ease-in", fill: "forwards" }));
    Promise.all(anims.map((a) => a.finished)).then(() => { apres(); anims.forEach((a) => a.cancel()); }, apres);
  }
  const blocsDe = (id) => Array.from(contenu.querySelectorAll(`:scope > [data-groupe="${id}"]:not(.enteteGroupe)`)).filter((e) => e.offsetHeight > 0 || !e.classList.contains("groupe-ouvert"));
  const blocsVisiblesDe = (id) => Array.from(contenu.querySelectorAll(`:scope > [data-groupe="${id}"]:not(.enteteGroupe)`)).filter((e) => e.offsetHeight > 0);

  // Tuiles
  const tuiles = el("div", "tuilesReglages"); tuiles.id = "tuilesReglages";
  GROUPES.forEach((g) => {
    const t = el("button", "tuileReglage"); t.type = "button"; t.dataset.groupe = g.id;
    t.append(el("span", "tuileIcone", g.icone), el("span", "tuileNom", g.nom));
    t.addEventListener("click", () => {
      const ancien = actif;
      const ouvrir = (id) => { actif = id; majVue(); const bl = blocsVisiblesDe(id); entrer(bl); if (bl[0]) setTimeout(() => { try { bl[0].scrollIntoView({ behavior: calme() ? "auto" : "smooth", block: "nearest" }); } catch (e) {} }, 60); };
      if (ancien === g.id) sortir(blocsVisiblesDe(ancien), () => { actif = ""; majVue(); }); // (retap : la page se referme)
      else if (ancien) sortir(blocsVisiblesDe(ancien), () => ouvrir(g.id));
      else ouvrir(g.id);
    });
    tuiles.append(t);
  });
  choix.after(tuiles);

  // En-têtes de groupe (sections : titre à ouvrir / fermer ; tuiles : bouton « ← Groupe » au-dessus de la page ouverte)
  const entetes = GROUPES.map((g, i) => {
    const e = el("button", "enteteGroupe"); e.type = "button"; e.dataset.groupe = g.id; e.dataset.rang = String(i);
    e.append(el("span", "enteteIcone", g.icone), el("span", "enteteNom", g.nom), el("span", "enteteFleche"));
    e.lastChild.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></svg>';
    e.addEventListener("click", () => {
      if (ouverts.has(g.id)) { sortir(blocsVisiblesDe(g.id), () => { ouverts.delete(g.id); majVue(); }); return; }
      ouverts.add(g.id); majVue(); entrer(blocsVisiblesDe(g.id));
    });
    return e;
  });
  entetes.forEach((e) => contenu.append(e));

  function majVue(){
    ecran.classList.toggle("vue-sections", vue === "sections");
    ecran.classList.toggle("vue-tuiles", vue === "tuiles");
    ecran.dataset.groupeActif = vue === "tuiles" ? actif : "";
    itemsMEP.forEach((b) => { const sel = b.dataset.vue === vue; b.classList.toggle("actif", sel); b.setAttribute("aria-checked", sel ? "true" : "false"); });
    btnMEP.querySelector(".mepIcone").innerHTML = ICONES_VUE[vue];
    tuiles.querySelectorAll(".tuileReglage").forEach((t) => t.classList.toggle("choisie", vue === "tuiles" && t.dataset.groupe === actif));
    sauverEtat();
    // Ordre d'affichage (CSS « order ») : un groupe après l'autre ; chaque bloc garde son rang d'origine dans son groupe
    GROUPES.forEach((g, i) => {
      const ouvert = vue === "sections" ? ouverts.has(g.id) : vue === "tuiles" ? actif === g.id : true;
      contenu.querySelectorAll(`:scope > [data-groupe="${g.id}"]`).forEach((e) => {
        if (e.classList.contains("enteteGroupe")) {
          e.classList.toggle("groupe-ouvert", ouvert);
          e.setAttribute("aria-expanded", ouvert ? "true" : "false");
          e.style.order = String(i * 100);
        } else {
          e.classList.toggle("groupe-ouvert", ouvert);
          e.style.order = vue === "liste" ? "" : String(i * 100 + 10);
        }
      });
    });
  }
  majVue();
  // Les tuiles et les titres de section prennent la couleur des titres des réglages du thème en cours (jaune en Bordeaux, bleu en Givre…)
  // Le menu « Mise en page » prend lui aussi les couleurs du thème (fond de page éclairci, couleur des titres) : calculées ici, sans color-mix (iPhone anciens)
  const lireRGB = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return v.length >= 3 ? v.slice(0, 3) : null; };
  const melanger = (a, b, t) => a.map((x, i) => Math.round(x * (1 - t) + b[i] * t));
  const css = (v, alpha) => alpha == null ? `rgb(${v.join(",")})` : `rgba(${v.join(",")},${alpha})`;
  const majCouleurTitre = () => {
    try {
      const t = contenu.querySelector(".optionTitre"); if (!t) return;
      const couleurTitre = getComputedStyle(t).color;
      ecran.style.setProperty("--titreReglage", couleurTitre);
      const titre = lireRGB(couleurTitre), fond = lireRGB(getComputedStyle(ecran).backgroundColor);
      if (!titre || !fond) return;
      const clair = (0.299 * fond[0] + 0.587 * fond[1] + 0.114 * fond[2]) > 140; // (thème clair : Givre, Kawaii…)
      const lum = (v) => { const f = v.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
      const contraste = (a, b) => { const [h, l] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)]; return (h + 0.05) / (l + 0.05); };
      let menu = melanger(fond, [255, 255, 255], clair ? 0.6 : 0.12);
      // Texte trop proche du fond (doré sur Prestige, sur Chandeleur…) : le menu s'assombrit (ou s'éclaircit si le texte est foncé) jusqu'à être lisible
      if (contraste(titre, menu) < 4) menu = melanger(fond, lum(titre) > 0.3 ? [0, 0, 0] : [255, 255, 255], 0.7);
      ecran.style.setProperty("--menuFond", css(menu));
      ecran.style.setProperty("--menuBord", css(titre, 0.4));
      ecran.style.setProperty("--menuActif", css(titre, 0.18));
      ecran.style.setProperty("--menuSousTitre", css(titre, 0.75));
    } catch (e) {}
  };
  majCouleurTitre();
  try { new MutationObserver(() => setTimeout(majCouleurTitre, 50)).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] }); } catch (e) {}
  ["btnReglages", "btnReglagesJeu"].forEach((id) => { const b = document.getElementById(id); if (b) b.addEventListener("click", () => setTimeout(majCouleurTitre, 0)); });
  // Réglages rouverts après un changement de thème (rechargement) : ils étaient cachés (voir le <head> de index.html) ; on les montre une
  // fois la mise en page prête et le défilement remis (js/reglages.js, à DOMContentLoaded), avec un fondu
  const montrerApresRechargement = () => {
    if (!document.documentElement.classList.contains("rouvrir-vue")) return;
    requestAnimationFrame(() => {
      ecran.classList.add("apparition-reglages");
      document.documentElement.classList.remove("rouvrir-vue");
      setTimeout(() => { ecran.classList.remove("apparition-reglages"); document.documentElement.classList.remove("rouvrir-fond"); }, 400); // (l'accueil, dessous, reste caché pendant le fondu)
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montrerApresRechargement);
  else montrerApresRechargement();
  // À chaque ouverture des Réglages, les tuiles reviennent à la page d'accueil
  const retour = () => { if (actif) { actif = ""; majVue(); } };
  ["btnReglages", "btnReglagesJeu"].forEach((id) => { const b = document.getElementById(id); if (b) b.addEventListener("click", retour); });
})();
// #endregion
