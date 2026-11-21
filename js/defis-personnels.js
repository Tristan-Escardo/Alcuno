// =============================================================================================
// ALCUNO : défis hot/hard personnalisés, stockés sur l'appareil puis synchronisés par js/profil.js
// =============================================================================================
(function(global){
  "use strict";
  const CLE = "alcuno_defis_personnels";
  const NIVEAUX = ["A", "B", "C", "HA", "HB"];
  const objet = (o) => o && typeof o === "object" && !Array.isArray(o) ? o : {};

  function lire(){
    try {
      const brut = JSON.parse(localStorage.getItem(CLE) || "{}");
      const propre = {};
      Object.keys(objet(brut)).sort().slice(0, 300).forEach((id) => {
        const d = brut[id];
        if (!/^p[a-z0-9]{1,29}$/.test(id) || !objet(d) || !NIVEAUX.includes(d.n) || typeof d.t !== "string") return;
        const erreur = valider(d.t);
        if (!erreur) propre[id] = { t: d.t.trim(), n: d.n, maj: Number(d.maj) > 0 ? Number(d.maj) : 1 };
      });
      return propre;
    } catch(e){ return {}; }
  }
  function ecrire(defis){
    try { localStorage.setItem(CLE, JSON.stringify(defis)); } catch(e){}
    try { window.dispatchEvent(new CustomEvent("alcuno-defis-personnels-change")); } catch(e){}
  }
  function valider(texte){
    const t = typeof texte === "string" ? texte.trim() : "";
    if(!t) return "Il manque le texte du défi.";
    if(t.length > 160) return "Défi trop long (160 caractères maximum).";
    const un = /\{nom\}/.test(t), n1 = /\{nom1\}/.test(t), n2 = /\{nom2\}/.test(t);
    const reste = t.replace(/\{nom[12]?\}/g, "");
    if(/[{}]/.test(reste)) return "Accolades interdites : utilise uniquement {nom}, {nom1} ou {nom2}.";
    if(n1 !== n2) return "Avec deux joueurs, utilise {nom1} et {nom2}.";
    if(un && n1) return "Choisis {nom} ou {nom1}/{nom2}, pas les deux.";
    if(!un && !n1) return "Le défi doit viser quelqu’un : ajoute {nom}, ou {nom1} et {nom2}.";
    return "";
  }
  function nouveauId(){
    let id;
    do {
      const n = typeof crypto !== "undefined" && crypto.getRandomValues
        ? Array.from(crypto.getRandomValues(new Uint32Array(2)), (x) => x.toString(36)).join("")
        : String(Date.now()) + Math.random().toString(36).slice(2);
      id = ("p" + n.replace(/[^a-z0-9]/gi, "").toLowerCase()).slice(0, 30);
    } while(lire()[id]);
    return id;
  }
  function enregistrer(niveau, texte, id){
    const erreur = valider(texte);
    if(erreur) return { erreur };
    if(!NIVEAUX.includes(niveau)) return { erreur: "Choisis un niveau." };
    const defis = lire();
    const cle = id && defis[id] ? id : nouveauId();
    defis[cle] = { t: texte.trim(), n: niveau, maj: Date.now() };
    ecrire(defis);
    return { id: cle, defis };
  }
  function supprimer(id){
    const defis = lire();
    if(!defis[id]) return;
    delete defis[id];
    ecrire(defis);
  }
  function remplacer(defis){
    const propre = {};
    Object.keys(objet(defis)).sort().slice(0, 300).forEach((id) => {
      const d = defis[id];
      if(!/^p[a-z0-9]{1,29}$/.test(id) || !d || !NIVEAUX.includes(d.n) || typeof d.t !== "string" || valider(d.t)) return;
      propre[id] = { t: d.t.trim(), n: d.n, maj: Number(d.maj) > 0 ? Number(d.maj) : 1 };
    });
    ecrire(propre);
  }
  function pourPartie(){
    const defis = lire(), sortie = {};
    Object.keys(defis).sort().forEach((id) => sortie[id] = { t: defis[id].t, n: defis[id].n });
    return sortie;
  }
  function apercu(texte){
    return String(texte || "").replace(/\{nom1\}/g, "Léa").replace(/\{nom2\}/g, "Tom").replace(/\{nom\}/g, "Léa");
  }
  // Le mode hard est secret tant qu'il n'est pas débloqué (js/reglages.js) : on n'en parle, et on ne propose ses niveaux, qu'ensuite
  function hardOuvert(){
    try { return typeof hardDebloque === "function" && hardDebloque(); } catch(e){ return false; }
  }
  const NOMS_NIVEAUX = { A: "Léger", B: "Moyen", C: "Osé", HA: "Hard HA", HB: "Hard HB" };
  function nomNiveau(n){ return tr(NOMS_NIVEAUX[n] || n); }
  function majTextes(){
    const ouvert = hardOuvert();
    const note = document.getElementById("noteDefisPersonnels");
    if(note) {
      const n = Object.keys(lire()).length;
      note.textContent = n
        ? `${n} ${tr(n === 1 ? "défi personnalisé" : "défis personnalisés")}.`
        : tr(ouvert ? "Ajoute tes propres défis pour les modes hot et hard." : "Ajoute tes propres défis pour le mode hot.");
    }
    const notePartie = document.getElementById("noteDefisPersonnelsPartie");
    if(notePartie) notePartie.textContent = tr(ouvert ? "Ajoute tes propres défis hot ou hard." : "Ajoute tes propres défis hot.");
    const choix = document.getElementById("niveauDefiPersonnel");
    if(choix) Array.from(choix.options).forEach((o) => { if(/^H/.test(o.value)) { o.hidden = !ouvert; o.disabled = !ouvert; } });
  }
  function majCompteur(){ majTextes(); }
  global.DefisPersonnels = { CLE, NIVEAUX, lire, valider, enregistrer, supprimer, remplacer, pourPartie, apercu, majCompteur, majTextes, nomNiveau, hardOuvert };
  if(typeof module !== "undefined" && module.exports) module.exports = global.DefisPersonnels;
})(typeof window !== "undefined" ? window : globalThis);

if(typeof document !== "undefined" && !document.documentElement.classList.contains("mode-tele")){
  const ecran = document.getElementById("ecranDefisPersonnels");
  const texte = document.getElementById("texteDefiPersonnel");
  const niveau = document.getElementById("niveauDefiPersonnel");
  const id = document.getElementById("idDefiPersonnel");
  const erreur = document.getElementById("erreurDefiPersonnel");
  const apercu = document.getElementById("apercuDefiPersonnel");
  const liste = document.getElementById("listeDefisPersonnels");
  const bouton = document.getElementById("btnAjouterDefiPersonnel");

  const compteur = document.getElementById("compteurDefiPersonnel");
  function majApercu(){
    if(compteur && texte) compteur.textContent = texte.value.length + "/160";
    if(!apercu) return;
    apercu.textContent = texte && texte.value.trim()
      ? tr("Aperçu : ") + DefisPersonnels.apercu(texte.value.trim())
      : tr("Aperçu : …");
  }
  function effacerFormulaire(){
    if(id) id.value = "";
    if(texte) texte.value = "";
    if(niveau) niveau.value = "A";
    if(erreur) erreur.textContent = "";
    if(bouton) bouton.textContent = tr("Ajouter le défi");
    majApercu();
  }
  function dessiner(){
    if(!liste) return;
    const defis = DefisPersonnels.lire();
    liste.replaceChildren();
    const cles = Object.keys(defis).sort();
    if(!cles.length){
      const vide = document.createElement("p");
      vide.className = "defisVide";
      vide.textContent = tr("Aucun défi pour l'instant.");
      liste.appendChild(vide);
    }
    cles.forEach((cle) => {
      const d = defis[cle];
      const carte = document.createElement("article");
      carte.className = "carteDefiPersonnel";
      const corps = document.createElement("div");
      corps.className = "carteDefiCorps";
      const badge = document.createElement("span");
      badge.className = "badgeNiveauDefi niveau-" + d.n;
      badge.textContent = DefisPersonnels.nomNiveau(d.n);
      const titre = document.createElement("p");
      titre.className = "carteDefiTexte";
      titre.textContent = DefisPersonnels.apercu(d.t);
      corps.append(badge, titre);
      const actions = document.createElement("div");
      actions.className = "carteDefiActions";
      const modifier = document.createElement("button");
      modifier.type = "button";
      modifier.textContent = tr("Modifier");
      modifier.addEventListener("click", () => {
        id.value = cle;
        texte.value = d.t;
        niveau.value = d.n;
        bouton.textContent = tr("Enregistrer");
        majApercu();
        texte.focus();
        if(erreur) erreur.textContent = "";
        if(ecran && ecran.scrollTo) ecran.scrollTo({ top: 0, behavior: "smooth" });
      });
      const supprimer = document.createElement("button");
      supprimer.type = "button";
      supprimer.className = "danger";
      supprimer.textContent = tr("Supprimer");
      supprimer.addEventListener("click", () => {
        if(!confirm(tr("Supprimer ce défi ?"))) return;
        DefisPersonnels.supprimer(cle);
      });
      actions.append(modifier, supprimer);
      carte.append(corps, actions);
      liste.appendChild(carte);
    });
    DefisPersonnels.majCompteur();
  }
  if(bouton) bouton.addEventListener("click", () => {
    const r = DefisPersonnels.enregistrer(niveau ? niveau.value : "A", texte ? texte.value : "", id ? id.value : "");
    if(r.erreur) { if(erreur) erreur.textContent = tr(r.erreur); return; }
    effacerFormulaire();
    dessiner();
  });
  if(texte) texte.addEventListener("input", () => {
    if(erreur) erreur.textContent = tr(DefisPersonnels.valider(texte.value));
    majApercu();
  });
  document.querySelectorAll("[data-inserer]").forEach((boutonInsertion) => {
    boutonInsertion.addEventListener("click", () => {
      if(!texte) return;
      const valeur = boutonInsertion.dataset.inserer;
      const debut = typeof texte.selectionStart === "number" ? texte.selectionStart : texte.value.length;
      texte.setRangeText(valeur, debut, typeof texte.selectionEnd === "number" ? texte.selectionEnd : debut, "end");
      texte.dispatchEvent(new Event("input"));
      texte.focus();
    });
  });
  const retour = document.getElementById("btnRetourDefisPersonnels");
  if(retour) retour.addEventListener("click", () => fermerPage(ecran));
  const ouvrir = document.getElementById("btnMesDefis");
  if(ouvrir) ouvrir.addEventListener("click", () => {
    DefisPersonnels.majTextes();
    dessiner();
    ouvrirPage(ecran);
  });
  window.addEventListener("alcuno-defis-personnels-change", dessiner);
  DefisPersonnels.majCompteur();
  dessiner();
}
