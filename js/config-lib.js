// =============================================================================================
// ALCUNO : réglages à distance (pilotés depuis la page privée stats.html, sans republier le jeu)
// Ce fichier ne touche à aucun écran : il décrit seulement ce qu'on a le droit de régler, vérifie
// et applique les commandes, et comprend les phrases tapées dans l'assistant de stats.html.
// Il est chargé par le jeu (index.html), par stats.html et par les tests (node).
//
// Dans Firebase, « config » contient (tout est facultatif) :
//   annonce   : { texte, debut, fin, avantVersion }  message sur l'accueil (debut / fin : dates en ms, facultatives ;
//                                              avantVersion : seulement pour les versions du jeu plus anciennes que celle-ci)
//   coupures  : { voix, musique, enligne }     true = fonction coupée pour tout le monde
//   themes    : { <thème>: { actif, debut, fin } }   actif:false = thème caché ; debut/fin = « MM-JJ » (chaque année)
//   majMin    : "9.64.0"                       version minimale : en dessous, bandeau « mets à jour »
//   defauts   : { volumeMusique, vitesseVoix } valeurs de départ (seulement pour ceux qui n'ont jamais touché au curseur)
//   v         : date de la dernière modification (ms) : les appareils la renvoient dans stats/appareils (voyant du pilotage)
// =============================================================================================
(function (global) {
  "use strict";

  const THEMES_CONNUS = ["bordeaux", "noir", "vert", "bleu", "soleil", "cerisier", "givre", "prestige", "galaxie", "kawaii"];
  const NOMS_THEMES = {
    bordeaux: "Bordeaux", noir: "Sombre", vert: "Casino", bleu: "Nuit", soleil: "Soleil couchant",
    cerisier: "Cerisier", givre: "Givre", prestige: "Prestige", galaxie: "Star Wars", kawaii: "Kawaii"
  };
  const COUPURES_CONNUES = ["voix", "musique", "enligne"];
  const NOMS_COUPURES = { voix: "les annonces à voix haute", musique: "la musique", enligne: "le mode en ligne" };
  const MOIS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
  const MOIS_AFFICHES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const TEXTE_MAX = 140;

  const estObjet = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const md = (m, j) => `${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
  const motifMD = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

  // Ne garde que ce qui est connu et bien formé (le reste est ignoré : une valeur inattendue dans Firebase ne casse rien)
  function valider(brut) {
    const c = {};
    if (!estObjet(brut)) return c;
    const a = brut.annonce;
    if (estObjet(a) && typeof a.texte === "string" && a.texte.trim()) {
      c.annonce = { texte: a.texte.trim().slice(0, TEXTE_MAX) };
      if (typeof a.fin === "number" && isFinite(a.fin)) c.annonce.fin = a.fin;
      if (typeof a.maj === "number" && isFinite(a.maj)) c.annonce.maj = a.maj;
      if (typeof a.debut === "number" && isFinite(a.debut)) c.annonce.debut = a.debut;
      if (typeof a.avantVersion === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a.avantVersion)) c.annonce.avantVersion = a.avantVersion;
    }
    if (estObjet(brut.coupures)) {
      COUPURES_CONNUES.forEach((n) => { if (brut.coupures[n] === true) (c.coupures = c.coupures || {})[n] = true; });
    }
    if (estObjet(brut.themes)) {
      THEMES_CONNUS.forEach((t) => {
        const x = brut.themes[t];
        if (!estObjet(x)) return;
        const o = {};
        if (x.actif === false) o.actif = false;
        if (typeof x.debut === "string" && motifMD.test(x.debut) && typeof x.fin === "string" && motifMD.test(x.fin)) { o.debut = x.debut; o.fin = x.fin; }
        if (Object.keys(o).length) (c.themes = c.themes || {})[t] = o;
      });
    }
    if (estObjet(brut.defauts)) {
      const d = brut.defauts;
      if (typeof d.volumeMusique === "number" && d.volumeMusique >= 0 && d.volumeMusique <= 100) (c.defauts = c.defauts || {}).volumeMusique = Math.round(d.volumeMusique / 5) * 5;
      if (typeof d.vitesseVoix === "number" && d.vitesseVoix >= 0.6 && d.vitesseVoix <= 1.6) (c.defauts = c.defauts || {}).vitesseVoix = Math.round(d.vitesseVoix * 10) / 10;
    }
    if (typeof brut.v === "number" && isFinite(brut.v)) c.v = brut.v;
    if (typeof brut.majMin === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(brut.majMin)) c.majMin = brut.majMin;
    return c;
  }

  function versionPlusVieille(a, b) { // vrai si a < b
    const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); }
    return false;
  }

  function dansPeriode(debut, fin, date) {
    const j = md(date.getMonth() + 1, date.getDate());
    return debut <= fin ? (j >= debut && j <= fin) : (j >= debut || j <= fin); // (« 20-12 → 05-01 » enjambe le nouvel an)
  }

  function themeDisponible(config, theme, date) {
    const t = config && config.themes && config.themes[theme];
    if (!t) return true;
    if (t.actif === false) return false;
    if (t.debut && t.fin) return dansPeriode(t.debut, t.fin, date || new Date());
    return true;
  }

  const coupee = (config, nom) => !!(config && config.coupures && config.coupures[nom]);

  // Annonce à montrer maintenant ? (commencée, pas finie, et pour cette version du jeu)
  function annonceVisible(config, maintenant, version) {
    const a = config && config.annonce;
    if (!a) return false;
    if (typeof a.debut === "number" && a.debut > maintenant) return false;
    if (typeof a.fin === "number" && a.fin <= maintenant) return false;
    if (a.avantVersion && version && !versionPlusVieille(version, a.avantVersion)) return false;
    return true;
  }

  // ----- Commandes : { op: … } -----
  // annonce {texte, dureeMin?} · annonce_off · coupure {cible, etat} · theme {id, actif?, debut?, fin?} · theme_periode_off {id}
  // · majmin {version|null} · tout_remettre
  function copie(c) { return JSON.parse(JSON.stringify(c || {})); }

  function appliquer(config, cmd, maintenant) {
    const c = copie(config);
    if (!estObjet(cmd)) return { erreur: "Commande illisible." };
    switch (cmd.op) {
      case "annonce": {
        const texte = String(cmd.texte || "").trim().slice(0, TEXTE_MAX);
        if (!texte) return { erreur: "Il manque le texte de l'annonce." };
        c.annonce = { texte, maj: maintenant };
        let debut = "", duree = "", version = "";
        const t0 = Number(cmd.debut) > maintenant ? Number(cmd.debut) : maintenant;
        if (t0 > maintenant) { c.annonce.debut = t0; debut = ` à partir du ${new Date(t0).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`; }
        if (Number(cmd.dureeMin) > 0) { c.annonce.fin = t0 + Math.round(Number(cmd.dureeMin)) * 60000; duree = `, pendant ${dureeEnTexte(Number(cmd.dureeMin))}`; }
        if (cmd.avantVersion) {
          if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(String(cmd.avantVersion))) return { erreur: "Version illisible (attendu : 9.64.0)." };
          c.annonce.avantVersion = String(cmd.avantVersion); version = `, seulement pour les versions avant ${cmd.avantVersion}`;
        }
        return { config: c, resume: `Annonce sur l'accueil : « ${texte} »${debut}${duree}${version}` };
      }
      case "annonce_off":
        delete c.annonce;
        return { config: c, resume: "Annonce retirée de l'accueil" };
      case "coupure": {
        if (COUPURES_CONNUES.indexOf(cmd.cible) < 0) return { erreur: "Je ne sais pas couper « " + cmd.cible + " »." };
        c.coupures = c.coupures || {};
        if (cmd.etat) c.coupures[cmd.cible] = true; else delete c.coupures[cmd.cible];
        if (!Object.keys(c.coupures).length) delete c.coupures;
        return { config: c, resume: (cmd.etat ? "Couper " : "Remettre ") + NOMS_COUPURES[cmd.cible] };
      }
      case "theme": {
        if (THEMES_CONNUS.indexOf(cmd.id) < 0) return { erreur: "Thème inconnu." };
        c.themes = c.themes || {};
        const t = c.themes[cmd.id] = c.themes[cmd.id] || {};
        const nom = NOMS_THEMES[cmd.id];
        let resume = "";
        if (cmd.actif === false) { t.actif = false; resume = `Cacher le thème ${nom}`; }
        else if (cmd.actif === true) { delete t.actif; resume = `Remettre le thème ${nom}`; }
        if (cmd.debut || cmd.fin) {
          if (!motifMD.test(cmd.debut || "") || !motifMD.test(cmd.fin || "")) return { erreur: "Dates du thème illisibles." };
          t.debut = cmd.debut; t.fin = cmd.fin;
          resume = `Thème ${nom} disponible du ${dateEnTexte(cmd.debut)} au ${dateEnTexte(cmd.fin)}, chaque année`;
        }
        if (!Object.keys(t).length) delete c.themes[cmd.id];
        if (!Object.keys(c.themes).length) delete c.themes;
        return { config: c, resume: resume || `Thème ${nom} inchangé` };
      }
      case "theme_periode_off": {
        if (THEMES_CONNUS.indexOf(cmd.id) < 0) return { erreur: "Thème inconnu." };
        if (c.themes && c.themes[cmd.id]) {
          delete c.themes[cmd.id].debut; delete c.themes[cmd.id].fin;
          if (!Object.keys(c.themes[cmd.id]).length) delete c.themes[cmd.id];
          if (!Object.keys(c.themes).length) delete c.themes;
        }
        return { config: c, resume: `Thème ${NOMS_THEMES[cmd.id]} : plus de dates (disponible toute l'année)` };
      }
      case "majmin": {
        if (cmd.version === null || cmd.version === undefined) { delete c.majMin; return { config: c, resume: "Plus de mise à jour obligatoire" }; }
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(String(cmd.version))) return { erreur: "Version illisible (attendu : 9.64.0)." };
        c.majMin = String(cmd.version);
        return { config: c, resume: `Demander la mise à jour sous la version ${c.majMin}` };
      }
      case "defaut": {
        const bornes = { volumeMusique: [0, 100, 5, "Volume de la musique", " %"], vitesseVoix: [0.6, 1.6, 0.1, "Vitesse de la voix", "×"] }[cmd.cible];
        if (!bornes) return { erreur: "Je ne sais pas régler « " + cmd.cible + " »." };
        if (cmd.valeur === null || cmd.valeur === undefined) {
          if (c.defauts) { delete c.defauts[cmd.cible]; if (!Object.keys(c.defauts).length) delete c.defauts; }
          return { config: c, resume: `${bornes[3]} : chacun garde son réglage (plus de valeur par défaut imposée)` };
        }
        let x = Number(cmd.valeur);
        if (!isFinite(x) || x < bornes[0] - 1e-9 || x > bornes[1] + 1e-9) return { erreur: `${bornes[3]} : valeur entre ${bornes[0]} et ${bornes[1]}.` };
        x = Math.round(x / bornes[2]) * bornes[2]; x = Math.round(x * 100) / 100;
        (c.defauts = c.defauts || {})[cmd.cible] = x;
        return { config: c, resume: `${bornes[3]} par défaut : ${String(x).replace(".", ",")}${bornes[4]} (pour ceux qui n'ont jamais touché au curseur)` };
      }
      case "tout_remettre":
        return { config: {}, resume: "Tout remettre par défaut (aucun réglage à distance)" };
      default:
        return { erreur: "Commande inconnue." };
    }
  }

  function dureeEnTexte(min) {
    if (min % 1440 === 0) return `${min / 1440} jour${min / 1440 > 1 ? "s" : ""}`;
    if (min % 60 === 0) return `${min / 60} h`;
    return `${min} min`;
  }
  function dateEnTexte(mdj) { const [m, j] = mdj.split("-").map(Number); return `${j === 1 ? "1er" : j} ${MOIS_AFFICHES[m - 1]}`; }

  // ----- L'assistant : comprend des phrases simples en français -----
  function sansAccent(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  const SYNONYMES_THEMES = [
    ["galaxie", /star ?wars|galaxie/], ["kawaii", /kawaii|kawai/], ["prestige", /prestige/], ["cerisier", /cerisier/],
    ["givre", /givre/], ["soleil", /soleil/], ["vert", /casino|\bvert\b/], ["bleu", /\bnuit\b|\bbleu\b/],
    ["noir", /sombre|\bnoir\b/], ["bordeaux", /bordeaux/]
  ];
  function themeDans(t) { for (const [id, re] of SYNONYMES_THEMES) if (re.test(t)) return id; return null; }

  function coupureDans(t) {
    if (/mode en ligne|en ligne|enligne|multijoueur/.test(t)) return "enligne";
    if (/voix|annonces? (a )?haute|parole|lecture/.test(t)) return "voix";
    if (/musique|ambiance/.test(t)) return "musique";
    return null;
  }

  function dateDans(t, debutPos) { // « 20 octobre », « 1er decembre », « 20/10 »
    const m1 = t.slice(debutPos).match(/(\d{1,2})(?:er)?\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)/);
    if (m1) return { md: md(MOIS.indexOf(m1[2]) + 1, Number(m1[1])), fin: debutPos + m1.index + m1[0].length };
    const m2 = t.slice(debutPos).match(/(\d{1,2})\/(\d{1,2})/);
    if (m2) return { md: md(Number(m2[2]), Number(m2[1])), fin: debutPos + m2.index + m2[0].length };
    return null;
  }

  const JOURS_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  // Début d'une annonce programmée : « demain à 18h », « samedi 21h30 », « le 5 novembre à 20h », « ce soir à 21h », « à 18h »
  function debutDans(t, maintenant) {
    const now = new Date(maintenant);
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const plus = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const h = t.match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/);
    let jour = null, genre = "fixe"; // fixe : jour dit clairement ; semaine : « samedi » (le prochain) ; heure : seulement « à 18h »
    if (/apres[- ]demain/.test(t)) jour = plus(base, 2);
    else if (/\bdemain\b/.test(t)) jour = plus(base, 1);
    else if (/ce soir|aujourd'hui|ce matin|cet apres/.test(t)) jour = base;
    else {
      const i = JOURS_SEMAINE.findIndex((n) => new RegExp("\\b" + n + "\\b").test(t));
      if (i >= 0) { jour = plus(base, (i - now.getDay() + 7) % 7); genre = "semaine"; }
      else {
        const d = dateDans(t, 0);
        if (d) { const [m, j] = d.md.split("-").map(Number); jour = new Date(now.getFullYear(), m - 1, j); if (plus(jour, 1) <= now) jour = new Date(now.getFullYear() + 1, m - 1, j); }
      }
    }
    if (!jour && !h) return null;
    if (!jour) { jour = base; genre = "heure"; }
    const soir = /ce soir/.test(t);
    let heure = h ? Number(h[1]) : (soir ? 20 : 8), min = h && h[2] ? Number(h[2]) : 0;
    if (heure > 23 || min > 59) return null;
    let d = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), heure, min);
    if (d <= now && genre !== "fixe") d.setDate(d.getDate() + (genre === "semaine" ? 7 : 1));
    return d.getTime();
  }

  function dureeDans(t) { // « pendant 2 jours », « 3 heures », « une semaine »
    const m = t.match(/(?:pendant|pour|durant|jusqu a dans)\s+(un|une|\d+)\s*(minutes?|min|heures?|h|jours?|j|semaines?)/);
    if (!m) return 0;
    const n = m[1] === "un" || m[1] === "une" ? 1 : Number(m[1]);
    const u = m[2];
    if (/^(minute|min)/.test(u)) return n;
    if (/^(heure|h$)/.test(u)) return n * 60;
    if (/^semaine/.test(u)) return n * 10080;
    return n * 1440;
  }

  // Plusieurs demandes dans une phrase (« coupe la voix et la musique », « … puis désactive le thème Kawaii »)
  function interpreter(texteBrut, maintenant) {
    maintenant = typeof maintenant === "number" ? maintenant : Date.now();
    const brut = String(texteBrut || "").trim();
    if (!/[«"“:]/.test(brut)) {
      const parties = brut.split(/\s*(?:,(?!\d)|;|\bet\b|\bpuis\b)\s*/i).filter(Boolean);
      if (parties.length > 1) {
        const verbe = parties[0].split(/\s+/)[0];
        const cmds = []; let raison = "";
        for (const [i, partie] of parties.entries()) {
          let r = interpreterUne(partie, maintenant);
          if (!r.cmds.length && i > 0) r = interpreterUne(verbe + " " + partie, maintenant);
          if (!r.cmds.length) return { cmds: [], raison: r.raison };
          cmds.push(...r.cmds);
        }
        return { cmds, raison };
      }
    }
    return interpreterUne(brut, maintenant);
  }

  function interpreterUne(texteBrut, maintenant) {
    const brut = String(texteBrut || "").trim();
    const t = sansAccent(brut).replace(/[’‘]/g, "'");
    const cmds = [];
    if (!t) return { cmds, raison: "Écris une demande, par exemple : coupe la voix." };

    if (/(remets?|reinitialise|reset|annule) (tout|tous les reglages)|tout remettre|retour (aux )?reglages par defaut/.test(t)) return { cmds: [{ op: "tout_remettre" }] };

    // annonce
    const entre = brut.match(/[«"“]([^»"”]+)[»"”]/);
    if (/(retire|supprime|enleve|efface|cache|vire)\s+(l'|le |les )?(annonce|message|bandeau)/.test(t)) cmds.push({ op: "annonce_off" });
    else if (/\b(annonce|message|bandeau|previens|affiche)\b/.test(t) && (entre || /:/.test(brut))) {
      let texte = entre ? entre[1] : brut.slice(brut.indexOf(":") + 1);
      const reDuree = /\s*(?:pendant|pour|durant)\s+(?:un|une|\d+)\s*(?:minutes?|min|heures?|h|jours?|j|semaines?)\s*$/i;
      const reste = entre ? sansAccent(brut.replace(entre[0], " ")) : sansAccent(texte);
      let d = dureeDans(reste);
      if (!entre) { texte = texte.replace(reDuree, ""); }
      const cmd = { op: "annonce", texte: texte.trim() };
      if (d) cmd.dureeMin = d;
      // (le début et la version visée se disent hors du texte : avant les « : », ou hors des guillemets)
      const hors = (entre ? reste : sansAccent(brut.slice(0, brut.indexOf(":")))).replace(/(?:pendant|pour|durant)\s+(?:un|une|\d+)\s*[a-z]+/, " ");
      const av = hors.match(/(?:avant|inferieure?s?|moins que|en dessous de|sous)\s*(?:a |de |la |les )?(?:version\s*)?(\d+\.\d+\.\d+)/);
      if (av) cmd.avantVersion = av[1];
      const debut = debutDans(hors.replace(/(\d+\.\d+\.\d+)/, " "), maintenant);
      if (debut) cmd.debut = debut;
      cmds.push(cmd);
    }

    // valeurs par défaut des curseurs
    if (!cmds.length && /\b(volume|vitesse)\b/.test(t)) {
      const cible = /volume/.test(t) && /musique|ambiance/.test(t) ? "volumeMusique" : /vitesse/.test(t) && /voix|lecture|annonce/.test(t) ? "vitesseVoix" : null;
      if (cible) {
        const n = t.match(/(\d+(?:[.,]\d+)?)/);
        if (n) cmds.push({ op: "defaut", cible, valeur: Number(n[1].replace(",", ".")) });
        else if (/par defaut|remets?|supprime|retire|enleve|plus de/.test(t)) cmds.push({ op: "defaut", cible, valeur: null });
      }
    }

    // version minimale
    const v = t.match(/(\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (/(oblige|force|impose|exige|demande)[^.]*(mise a jour|maj)|version minimale?/.test(t) && v) cmds.push({ op: "majmin", version: v[1] });
    else if (/(plus de|supprime|retire|enleve)[^.]*(mise a jour obligatoire|version minimale?)/.test(t)) cmds.push({ op: "majmin", version: null });

    // thème
    const theme = themeDans(t);
    if (theme && !cmds.length) {
      const du = t.search(/\bdu\b|\bentre le\b|a partir du/);
      const d1 = du >= 0 ? dateDans(t, du) : null;
      const d2 = d1 ? dateDans(t, d1.fin) : null;
      if (d1 && d2) cmds.push({ op: "theme", id: theme, debut: d1.md, fin: d2.md });
      else if (/toute l'annee|sans date|plus de date|n'importe quand/.test(t)) cmds.push({ op: "theme_periode_off", id: theme });
      else if (/(desactive|cache|masque|retire|supprime|enleve|coupe|bloque|ferme|vire)/.test(t)) cmds.push({ op: "theme", id: theme, actif: false });
      else if (/(active|reactive|remets?|affiche|montre|reouvre|rouvre|debloque)/.test(t)) cmds.push({ op: "theme", id: theme, actif: true });
    }

    // fonctions
    const cible = coupureDans(t);
    if (cible && !cmds.length && !theme) {
      if (/(coupe|desactive|ferme|bloque|stop|arrete|retire|vire|enleve|plus de)/.test(t)) cmds.push({ op: "coupure", cible, etat: true });
      else if (/(reactive|remets?|rouvre|reouvre|active|reouvrir|debloque|rallume|reprend)/.test(t)) cmds.push({ op: "coupure", cible, etat: false });
    }

    if (!cmds.length) return { cmds, raison: "Je n'ai pas compris. Exemples : « coupe la voix », « désactive le thème Kawaii », « thème Star Wars du 1er mai au 4 mai », « annonce : « Soirée ce soir ! » pendant 2 jours », « oblige la mise à jour 9.64.0 »." };
    return { cmds };
  }

  // Phrase de description de l'état actuel (pour l'assistant et pour l'IA)
  function decrire(config) {
    const c = valider(config), l = [];
    if (c.annonce) l.push(`annonce : « ${c.annonce.texte} »${typeof c.annonce.debut === "number" ? " (dès le " + new Date(c.annonce.debut).toLocaleString("fr-FR") + ")" : ""}${typeof c.annonce.fin === "number" ? " (jusqu'au " + new Date(c.annonce.fin).toLocaleString("fr-FR") + ")" : ""}${c.annonce.avantVersion ? " (versions avant " + c.annonce.avantVersion + ")" : ""}`);
    COUPURES_CONNUES.forEach((n) => { if (coupee(c, n)) l.push(`${NOMS_COUPURES[n]} : coupé`); });
    Object.keys(c.themes || {}).forEach((t) => {
      const x = c.themes[t];
      l.push(`thème ${NOMS_THEMES[t]} : ${x.actif === false ? "caché" : "visible"}${x.debut ? ", du " + dateEnTexte(x.debut) + " au " + dateEnTexte(x.fin) : ""}`);
    });
    if (c.majMin) l.push(`mise à jour obligatoire sous la version ${c.majMin}`);
    if (c.defauts && c.defauts.volumeMusique !== undefined) l.push(`volume de la musique par défaut : ${c.defauts.volumeMusique} %`);
    if (c.defauts && c.defauts.vitesseVoix !== undefined) l.push(`vitesse de la voix par défaut : ${String(c.defauts.vitesseVoix).replace(".", ",")}×`);
    return l.length ? l : ["rien : le jeu est réglé par défaut"];
  }

  global.ConfigLib = {
    THEMES_CONNUS, NOMS_THEMES, COUPURES_CONNUES, NOMS_COUPURES, TEXTE_MAX,
    valider, versionPlusVieille, themeDisponible, coupee, annonceVisible, appliquer, interpreter, decrire, dansPeriode, dateEnTexte
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.ConfigLib;
})(typeof window !== "undefined" ? window : globalThis);
