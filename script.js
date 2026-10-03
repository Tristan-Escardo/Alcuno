// =============================================================================================
// ALCUNO : tout le jeu est dans ce fichier, rangé en sections repliables
// (VS Code : flèche dans la marge à côté de « #region », ou Ctrl+K Ctrl+0 pour tout replier).
//
//   Diagnostic : erreurs et avertissements récents
//   Démarrage : mode de jeu, version du jeu
//   Écran des créateurs (4 taps sur le titre)
//   Réglages : thème, Mode PJ, sons, rappel d'eau, partage, diagnostic, partie en mémoire…
//   Nouvelle version disponible et appli installable
//   Mode en ligne : codes de partie, menus Créer / Rejoindre / Revenir, transitions, clavier
//   Mode en ligne : salle d'attente, manches, présence, coupure réseau
//   Mode en ligne : reconnexion, joueur retiré qui revient, quitter la partie
//   Plateau, outils, joueurs, retirer un joueur en partie
//   Overlays des règles : pigeon, annonces, annulations, carte dorée
//   Duel
//   Application des règles et déroulement du jeu
//   Écran « Nouvelle partie »
//   Mode en ligne : synchronisation des actions, rattrapage
//   Bouton retour du téléphone et démarrage du jeu
// =============================================================================================
document.addEventListener("DOMContentLoaded", function () {
  // #region Diagnostic : erreurs et avertissements récents
  // ===== Diagnostic : dernières erreurs et avertissements du jeu (dont Firebase) =====
  // Copiés avec le reste par « Copier le diagnostic » (Réglages > À propos)
  const erreursRecentes = [];
  function noterErreur(texte){
    erreursRecentes.push(`${new Date().toLocaleTimeString("fr-FR")} ${String(texte).slice(0, 220)}`);
    if (erreursRecentes.length > 25) erreursRecentes.shift();
  }
  window.addEventListener("error", (e) => noterErreur(`${e.message} (ligne ${e.lineno})`));
  window.addEventListener("unhandledrejection", (e) => noterErreur(`promesse : ${e.reason && (e.reason.message || e.reason)}`));
  ["warn", "error"].forEach((type) => {
    const original = console[type].bind(console);
    console[type] = (...args) => {
      try { noterErreur(`${type} : ${args.map(a => (a && a.message) ? a.message : String(a)).join(" ")}`); } catch (e) {}
      original(...args);
    };
  });

  // #endregion

  // #region Démarrage : mode de jeu, version du jeu
  // ================== MODE DE JEU (classique / en ligne) ==================
  // Le module Firebase s'exécute souvent AVANT ce code : l'événement "firebase-ready"
  // est alors déjà passé, on se fie donc à la présence de window.firebaseDB
  function attendreFirebase(callback){
    if (window.firebaseDB) {
      callback();
    } else {
      window.addEventListener("firebase-ready", () => callback(), { once: true });
    }
  }

  let codePartieActuel = null;
  let pseudoActuel = null;
  let estHote = false;
  let hotePartie = null;
  // En ligne : pseudos marqués déconnectés dans Firebase (affichés « déconnecté » à côté du nom)
  let deconnectes = new Set();

  // Synchro en ligne : chaque tap de jeu est une action numérotée dans Firebase,
  // rejouée dans le même ordre sur tous les téléphones (y compris l'émetteur).
  let enLigneActif = false;
  let mancheCourante = null;
  let desabonnerJoueurs = null;
  let desabonnerEtat = null;
  let desabonnerActions = null;
  let fileActions = new Map(); // seq -> { id, par }
  let prochainSeq = 1;
  let traitementEnCours = false;
  let timerTrou = null;
  let generationFile = 0; // change à chaque remise à zéro de la file (nouvelle manche, resynchronisation)
  let idsUniquesUtilises = new Set(); // boutons « unique » déjà appliqués dans la manche (voir surAction)

  // Reconnexion en pleine manche : on rejoue toutes les actions déjà faites, en accéléré
  let repriseEnCours = false;     // la prochaine manche démarrée est une reprise (reprendrePlaceEnLigne)
  let rattrapageEnCours = false;  // délais du jeu quasi nuls pendant le rattrapage (voir delai())
  let seqFinRattrapage = 0;       // numéro de la dernière action à rattraper

  // Joueur retiré qui revient : il est remis dans la manche par une action « retour »
  // (voir verifierRetourDansManche), appliquée au même moment sur tous les téléphones
  let ordreManche = [];           // joueurs au début de la manche : on revient à sa place d'origine
  let retourEnCours = false;      // ce téléphone attend d'être remis dans la manche
  let retourEnvoye = false;       // notre demande de retour est dans la file, pas encore traitée
  let retourAnnonce = false;      // message « Tu reviens dans la partie… » déjà affiché
  let timerRetour = null;

  const PSEUDO_INVALIDE = /[.#$\[\]\/]/;

  // Easter egg : couronne 👑 à côté du nom des créateurs du jeu
  // (majuscules/minuscules ignorées : « TrIs », « ROSA »… comptent aussi)
  const PSEUDOS_CREATEURS = [
    "tris", "tristanus", "origamy",
    "yla", "nana", "ylana",
    "celien", "célien", "chouchou",
    "ro", "rosa", "rosy", "roseanna"
  ];

  function estCreateur(nom){
    return PSEUDOS_CREATEURS.includes(String(nom || "").trim().toLocaleLowerCase("fr-FR"));
  }

  function avecCouronne(nom){
    return estCreateur(nom) ? `${nom} 👑` : nom;
  }

  // À augmenter (+1) à chaque mise en ligne qui touche au mode en ligne : un téléphone qui a
  // gardé une ancienne version ne pourra pas rejoindre (sinon les parties se désynchronisent)
  // Affichée en bas de l'accueil. Enregistrée dans Firebase sous forme de nombre
  // (les règles l'exigent) : "8.3.2" => 80302, pour pouvoir comparer les versions.
  const VERSION_AFFICHEE = "8.8.10";
  const VERSION_JEU = VERSION_AFFICHEE.split(".")
    .reduce((total, partie, i) => total + Number(partie) * [10000, 100, 1][i], 0);
  // À l'écran : le numéro complet, pour voir d'un coup d'œil si un téléphone est à jour
  document.getElementById("versionJeu").innerText = "Alcuno — version " + VERSION_AFFICHEE;

  // #endregion

  // #region Écran des créateurs (4 taps sur le titre)
  // ===== Easter egg : 4 taps rapides sur le titre ALCUNO => écran des créateurs =====
  const ecranCredits = document.getElementById("ecranCredits");
  let tapsTitre = 0;
  let dernierTapTitre = 0;

  // pointerdown (et pas click) : les taps rapprochés ne génèrent pas tous un "click" sur mobile
  // (titre du bandeau et grand titre de l'écran d'accueil)
  document.querySelectorAll("header h1, #titreAccueil").forEach((titre) => titre.addEventListener("pointerdown", () => {
    const maintenant = Date.now();
    tapsTitre = (maintenant - dernierTapTitre < 600) ? tapsTitre + 1 : 1;
    dernierTapTitre = maintenant;

    if (tapsTitre >= 4) {
      tapsTitre = 0;
      ecranCredits.scrollTop = 0;
      jouerSon("credits");
      ouvrirPage(ecranCredits);
      debloquerPrestige(); // découvrir les créateurs débloque le thème secret « Prestige »
    }
  }));

  // Bouton d'une page qui défile (Réglages, créateurs) : un tap pendant que la page glisse encore
  // sur son élan sert d'abord à arrêter le défilement, et le téléphone n'envoie alors pas de
  // « click » (il fallait taper deux fois). On réagit donc aussi au doigt levé, si le doigt n'a
  // presque pas bougé (sinon c'est un glissement). Un seul déclenchement par tap.
  function activerMemePendantElan(bouton, action){
    let depart = null;
    let clicDejaFait = false; // le « click » qui suit le doigt levé du même tap ne compte pas
    let minuteur = null;
    bouton.addEventListener("pointerdown", (e) => {
      clicDejaFait = false; // nouveau tap
      depart = (e.pointerType === "touch" || e.pointerType === "pen") ? { x: e.clientX, y: e.clientY } : null;
    });
    bouton.addEventListener("pointerup", (e) => {
      if (!depart) return;
      const deplacement = Math.hypot(e.clientX - depart.x, e.clientY - depart.y);
      depart = null;
      if (deplacement >= 12) return;
      clicDejaFait = true;
      clearTimeout(minuteur);
      minuteur = setTimeout(() => { clicDejaFait = false; }, 350);
      action();
    });
    bouton.addEventListener("pointercancel", () => { depart = null; });
    // Un nouveau contact ailleurs sur l'écran : le « click » de l'ancien tap ne viendra plus
    document.addEventListener("pointerdown", (e) => { if (e.target !== bouton) clicDejaFait = false; }, true);
    bouton.addEventListener("click", () => {
      if (clicDejaFait) { clicDejaFait = false; return; }
      action();
    });
  }

  activerMemePendantElan(document.getElementById("btnFermerCredits"), () => fermerPage(ecranCredits));

  // Pages plein écran (Réglages, créateurs) : elles arrivent en glissant depuis la droite et
  // repartent en fondu vers la droite (avant : elles apparaissaient / disparaissaient d'un coup)
  function ouvrirPage(page){
    page.classList.remove("page-sortie", "page-entree");
    page.style.display = "";
    void page.offsetWidth; // relance l'animation même si la page vient d'être fermée
    page.classList.add("page-entree");
  }

  function fermerPage(page){
    if (page.style.display === "none" || page.classList.contains("page-sortie")) return;
    page.classList.remove("page-entree");
    page.classList.add("page-sortie");
    let fini = false;
    const fin = (e) => {
      if (e && e.target !== page) return; // (fin d'une animation d'un élément de la page)
      if (fini) return;
      fini = true;
      page.removeEventListener("animationend", fin);
      page.classList.remove("page-sortie");
      page.style.display = "none";
    };
    page.addEventListener("animationend", fin);
    setTimeout(() => fin(), 350); // sécurité : animations désactivées sur le téléphone
  }

  // #endregion

  // #region Réglages : thème, Mode PJ, sons, rappel d'eau, partage, diagnostic, partie en mémoire, vibrations, écran allumé
  // ===== Réglages (bouton en haut à droite de l'écran d'accueil, seulement là) =====
  // Chaque réglage est retenu sur le téléphone (stockage local du navigateur)
  const ecranReglages = document.getElementById("ecranReglages");

  document.getElementById("btnReglages").addEventListener("click", () => {
    majLignePartieMemoire();
    ecranReglages.scrollTop = 0;
    ouvrirPage(ecranReglages);
  });

  activerMemePendantElan(document.getElementById("btnFermerReglages"), () => fermerPage(ecranReglages));

  function lireReglage(cle, parDefaut){
    try {
      const valeur = localStorage.getItem(cle);
      return valeur === null ? parDefaut : valeur === "1";
    } catch (e) { return parDefaut; }
  }

  function ecrireReglage(cle, actif){
    try { localStorage.setItem(cle, actif ? "1" : "0"); } catch (e) {}
  }

  // Accessibilité pour les gens bourrés : textes et boutons plus gros (classe sur <html>)
  const CLE_ACCESSIBILITE = "alcuno_accessibilite";
  const caseAccessibilite = document.getElementById("optionAccessibilite");
  caseAccessibilite.checked = lireReglage(CLE_ACCESSIBILITE, false);
  document.documentElement.classList.toggle("accessibilite", caseAccessibilite.checked);

  caseAccessibilite.addEventListener("change", () => {
    ecrireReglage(CLE_ACCESSIBILITE, caseAccessibilite.checked);
    document.documentElement.classList.toggle("accessibilite", caseAccessibilite.checked);
  });

  // ===== Thème : couleur du fond du jeu (réglage de ce téléphone, purement visuel) =====
  // (le thème est déjà posé au tout début du chargement par index.html : pas de flash de couleur)
  const CLE_THEME = "alcuno_theme";
  const THEMES = { bordeaux: "#2b001d", noir: "#0e0e12", vert: "#08301e", bleu: "#0a1634", violet: "#3d0f66",
                   cerisier: "#5a1740", prestige: "#3a2806" };

  // Thème secret « Prestige » : débloqué en découvrant l'écran des créateurs (4 taps sur le titre)
  const CLE_PRESTIGE = "alcuno_theme_prestige";
  function prestigeDebloque(){
    try { return localStorage.getItem(CLE_PRESTIGE) === "1"; } catch (e) { return false; }
  }

  // Pastille cachée tant que le thème n'est pas débloqué
  function majPastillePrestige(){
    const pastille = document.getElementById("pastillePrestige");
    if (pastille) pastille.hidden = !prestigeDebloque();
  }

  function debloquerPrestige(){
    if (prestigeDebloque()) return;
    try { localStorage.setItem(CLE_PRESTIGE, "1"); } catch (e) {}
    majPastillePrestige();
    afficherNotificationHaut("✨", "Thème Prestige débloqué !");
  }

  // Notification qui arrive du haut de l'écran, en or avec des étincelles. Comme sur un téléphone :
  // on la glisse vers le haut pour la fermer, on la retient au doigt (elle ne part pas tant qu'on
  // la tient), un simple tap la ferme, sinon elle s'en va toute seule après 5 s.
  function afficherNotificationHaut(icone, titre){
    const ancienne = document.getElementById("notifHaut");
    if (ancienne) ancienne.remove();
    const notif = document.createElement("div");
    notif.id = "notifHaut";
    notif.setAttribute("role", "status");
    const eclats = document.createElement("span");
    eclats.className = "notifHaut-eclats";
    eclats.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 9; i++) {
      const etincelle = document.createElement("span");
      etincelle.textContent = "✦";
      etincelle.style.left = (4 + Math.random() * 88) + "%";
      etincelle.style.top = (8 + Math.random() * 70) + "%";
      etincelle.style.fontSize = (8 + Math.random() * 9).toFixed(0) + "px";
      const duree = 1.6 + Math.random() * 1.6;
      etincelle.style.animationDuration = duree.toFixed(2) + "s";
      etincelle.style.animationDelay = (-Math.random() * duree).toFixed(2) + "s";
      eclats.appendChild(etincelle);
    }
    const ligneIcone = document.createElement("span");
    ligneIcone.className = "notifHaut-icone";
    ligneIcone.setAttribute("aria-hidden", "true");
    ligneIcone.textContent = icone;
    const bloc = document.createElement("span");
    bloc.className = "notifHaut-texte";
    const fort = document.createElement("strong");
    fort.textContent = titre;
    bloc.append(fort);
    notif.append(eclats, ligneIcone, bloc);

    let partie = false;
    let minuteur = null;
    const placer = (decalage, transition) => {
      notif.style.animation = "none"; // l'animation d'arrivée ne doit plus imposer sa position
      notif.style.transition = transition || "none";
      notif.style.transform = `translate(-50%, ${decalage}px)`;
    };
    const fermer = () => {
      if (partie) return;
      partie = true;
      clearTimeout(minuteur);
      placer(-(notif.offsetHeight + notif.offsetTop + 20), "transform 0.28s ease-in, opacity 0.28s ease-in");
      notif.style.opacity = "0";
      setTimeout(() => notif.remove(), 300);
    };
    const programmerDepart = (delai) => {
      clearTimeout(minuteur);
      minuteur = setTimeout(fermer, delai);
    };

    // Glissement au doigt
    let departY = null;
    let decalage = 0;
    let dernierY = 0;
    let dernierT = 0;
    let vitesse = 0;
    notif.addEventListener("pointerdown", (e) => {
      if (partie) return;
      clearTimeout(minuteur); // tenue au doigt : elle reste
      departY = e.clientY;
      dernierY = e.clientY;
      dernierT = e.timeStamp;
      decalage = 0;
      vitesse = 0;
      try { notif.setPointerCapture(e.pointerId); } catch (err) {}
      placer(0);
    });
    notif.addEventListener("pointermove", (e) => {
      if (departY === null || partie) return;
      const dy = e.clientY - departY;
      // vers le haut elle suit le doigt ; vers le bas elle résiste (élastique)
      decalage = dy < 0 ? dy : dy * 0.3;
      if (e.timeStamp > dernierT) vitesse = (e.clientY - dernierY) / (e.timeStamp - dernierT);
      dernierY = e.clientY;
      dernierT = e.timeStamp;
      placer(decalage);
    });
    const lacher = (e) => {
      if (departY === null || partie) return;
      const bouge = Math.abs(e.clientY - departY);
      departY = null;
      if (e.type === "pointerup" && bouge < 8) return fermer();                 // simple tap
      if (decalage < -notif.offsetHeight * 0.35 || vitesse < -0.5) return fermer(); // jetée vers le haut
      placer(0, "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)");                // revient à sa place
      programmerDepart(3000);
    };
    notif.addEventListener("pointerup", lacher);
    notif.addEventListener("pointercancel", lacher);

    programmerDepart(5000);
    document.body.appendChild(notif);
  }

  function appliquerTheme(nom){
    if (!THEMES[nom] || (nom === "prestige" && !prestigeDebloque())) nom = "bordeaux";
    document.documentElement.dataset.theme = nom;
    // Barre du téléphone en haut : on remplace la balise au lieu de la modifier (sinon Chrome sur
    // Android ne repeint parfois la barre qu'au premier changement de thème)
    document.querySelectorAll('meta[name="theme-color"]').forEach((ancienne) => ancienne.remove());
    const barre = document.createElement("meta");
    barre.name = "theme-color";
    barre.content = THEMES[nom];
    document.head.appendChild(barre);
    document.querySelectorAll(".pastilleTheme").forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.theme === nom ? "true" : "false");
    });
  }

  // iPhone (Safari d'iOS 26 et plus) : la barre du haut ne lit plus theme-color, elle prend la
  // couleur du haut de la page… et ne la relit qu'après un changement de mise en page ou un
  // défilement. Un simple changement de couleur ne lui suffit pas : on lui en provoque un, invisible.
  function rafraichirBarreIphone(){
    const reglages = document.getElementById("ecranReglages");
    // une fine bande fixe aux couleurs du thème, posée en haut (derrière les pages) puis retirée
    const bande = document.createElement("div");
    bande.id = "teinteHaut";
    bande.setAttribute("aria-hidden", "true");
    document.body.appendChild(bande);
    // la page Réglages (fixe, tout en haut) change de mise en page d'un pixel, en bas, le temps d'une image
    document.documentElement.classList.add("teinte-maj");
    // défilement d'un pixel aller-retour (de la page et des réglages)
    const yPage = window.scrollY;
    const yReglages = reglages ? reglages.scrollTop : 0;
    window.scrollTo(0, yPage > 0 ? yPage - 1 : yPage + 1);
    if (reglages) reglages.scrollTop = yReglages > 0 ? yReglages - 1 : yReglages + 1;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.documentElement.classList.remove("teinte-maj");
      window.scrollTo(0, yPage);
      if (reglages) reglages.scrollTop = yReglages;
      setTimeout(() => bande.remove(), 400);
    }));
  }

  majPastillePrestige();
  let themeChoisi = "bordeaux";
  try { themeChoisi = localStorage.getItem(CLE_THEME) || "bordeaux"; } catch (e) {}
  appliquerTheme(themeChoisi);

  // Cerisier : pétales qui tombent sur l'écran d'accueil (positions, tailles et vitesses au hasard)
  const zonePetales = document.getElementById("petalesCerisier");
  for (let i = 0; i < 14; i++) {
    const petale = document.createElement("span");
    const taille = 0.7 + Math.random() * 0.7;
    const duree = 9 + Math.random() * 9;
    petale.style.left = `${Math.random() * 100}%`;
    petale.style.width = `${11 * taille}px`;
    petale.style.height = `${15 * taille}px`;
    petale.style.animationDuration = `${duree}s`;
    petale.style.animationDelay = `${-Math.random() * duree}s`; // déjà en train de tomber à l'ouverture
    zonePetales.appendChild(petale);
  }

  // Prestige : étincelles qui scintillent sur l'écran d'accueil (positions, tailles et rythmes au hasard)
  const zoneEtincelles = document.getElementById("etincellesPrestige");
  for (let i = 0; i < 26; i++) {
    const etincelle = document.createElement("span");
    const taille = 12 + Math.random() * 18;
    const duree = 2.5 + Math.random() * 3;
    etincelle.textContent = "✦";
    etincelle.style.left = `${Math.random() * 96}%`;
    etincelle.style.top = `${Math.random() * 96}%`;
    etincelle.style.fontSize = `${taille}px`;
    etincelle.style.animationDuration = `${duree}s`;
    etincelle.style.animationDelay = `${-Math.random() * duree}s`;
    zoneEtincelles.appendChild(etincelle);
  }

  document.querySelectorAll(".pastilleTheme").forEach((pastille) => {
    pastille.addEventListener("click", () => {
      appliquerTheme(pastille.dataset.theme);
      rafraichirBarreIphone();
      try { localStorage.setItem(CLE_THEME, pastille.dataset.theme); } catch (e) {}
    });
  });

  // ===== Mode PJ (appelé « soft » dans le code) : moins de gorgées =====
  // Classique : le réglage de ce téléphone. En ligne : le réglage de l'hôte au moment où il a créé
  // la partie (champ « soft » de la partie dans Firebase) : le même pour tous, et il ne change
  // plus jusqu'à la fin (même si l'hôte change ou si quelqu'un touche à son réglage).
  const CLE_MODE_SOFT = "alcuno_mode_soft";
  const caseModeSoft = document.getElementById("optionModeSoft");
  caseModeSoft.checked = lireReglage(CLE_MODE_SOFT, false);
  caseModeSoft.addEventListener("change", () => ecrireReglage(CLE_MODE_SOFT, caseModeSoft.checked));

  let softPartieEnLigne = false;

  function estModeSoft(){
    return codePartieActuel ? softPartieEnLigne : caseModeSoft.checked;
  }

  // Gorgées selon le mode (normal | soft)
  function texteCulSec(){ return estModeSoft() ? "3 gorgées" : "un CUL SEC"; }
  function gorgeesPlus2(){ return estModeSoft() ? 1 : 2; }
  function gorgeesPlus4(){ return estModeSoft() ? 2 : 4; }
  function gorgeesPigeon(){ return estModeSoft() ? 1 : 2; }
  // Duel : valeur de la carte du perdant × multiplicateur ; en soft, moitié (arrondie au-dessus), 10 max
  function gorgeesDuel(valeur, multiplicateur){
    return estModeSoft() ? Math.min(10, Math.ceil(valeur / 2) * multiplicateur) : valeur * multiplicateur;
  }
  function texteGorgees(n){ return `${n} gorgée${n > 1 ? "s" : ""}`; }
  function texteDoreeJamaisTrouvee(){
    return estModeSoft()
      ? "Tout le monde boit 2 gorgées de la part du développeur 😘"
      : "Tout le monde prend un CUL SEC de la part du développeur 😘";
  }

  // En ligne : mode de la partie qu'on rejoint / crée, affiché dans la salle d'attente
  function choisirModeSoftEnLigne(soft){
    softPartieEnLigne = !!soft;
    document.getElementById("infoModeSoft").style.display = softPartieEnLigne ? "" : "none";
  }

  // ===== Sons : fichiers MP3 du dossier Sons/ (voir SONS plus bas pour la liste des fichiers) =====
  // Le curseur règle le volume du jeu à l'intérieur du volume du téléphone (il ne peut pas le dépasser).
  const CLE_SONS = "alcuno_sons";
  const CLE_VOLUME = "alcuno_volume";
  const caseSons = document.getElementById("optionSons");
  const curseurVolume = document.getElementById("volumeSons");
  const ligneVolume = document.getElementById("ligneVolume");
  caseSons.checked = lireReglage(CLE_SONS, true);

  let volumeSons = 100;
  try {
    const v = localStorage.getItem(CLE_VOLUME);
    if (v !== null && Number(v) >= 0 && Number(v) <= 100) volumeSons = Number(v);
  } catch (e) {}
  curseurVolume.value = volumeSons;

  function majLigneVolume(){
    document.getElementById("volumeValeur").innerText = volumeSons + " %";
    curseurVolume.disabled = !caseSons.checked;
    ligneVolume.classList.toggle("inactif", !caseSons.checked);
  }
  majLigneVolume();

  caseSons.addEventListener("change", () => {
    ecrireReglage(CLE_SONS, caseSons.checked);
    majLigneVolume();
    if (caseSons.checked) jouerSon("sons_on"); // petit retour pour montrer que ça marche
  });

  curseurVolume.addEventListener("input", () => {
    volumeSons = Number(curseurVolume.value);
    try { localStorage.setItem(CLE_VOLUME, String(volumeSons)); } catch (e) {}
    majLigneVolume();
  });
  curseurVolume.addEventListener("change", () => jouerSon("reglage_son")); // essai au relâchement (Sons/reglage_son.mp3)

  let contexteSon = null;
  function contexteAudio(){
    if (!contexteSon) {
      const Contexte = window.AudioContext || window.webkitAudioContext;
      if (!Contexte) return null;
      try { contexteSon = new Contexte(); } catch (e) { return null; }
    }
    if (contexteSon.state === "suspended") contexteSon.resume().catch(() => {});
    return contexteSon;
  }
  // Les téléphones n'autorisent le son qu'après un premier tap : on le prépare à chaque tap
  // (et on charge les fichiers des sons au premier tap, pour qu'ils soient prêts à temps)
  document.addEventListener("pointerdown", () => { if (caseSons.checked) { contexteAudio(); chargerSons(); } },
    { capture: true, passive: true });

  // Fichiers des sons : dossier Sons/, un MP3 par moment du jeu. Pour changer un son, il suffit de
  // remplacer le fichier (même nom). Fichier absent => pas de son à ce moment-là.
  //   cartes.mp3  : une carte est retournée sur le plateau
  //   doree.mp3   : quelqu'un tire la carte dorée (coupé à 3 s, voir DUREE_MAX_SONS)
  //   pigeon.mp3  : quelqu'un devient pigeon (premier pigeon ou nouveau pigeon ; coupé à 2 s)
  //   tour.mp3    : en ligne, c'est ton tour
  //   eau.mp3     : rappel « Bois de l'eau »
  //   sons_on.mp3 : on active les sons dans les réglages
  //   credits.mp3 : 4 taps sur le titre ALCUNO (écran des créateurs)
  //   reglage_son.mp3 : on lâche le curseur de volume dans les réglages (pour entendre le volume)
  //   no_wifi.mp3 : en ligne, coupure de réseau (une fois, quand le logo wifi barré apparaît)
  // (pas de son pour le cul sec de la carte dorée)
  const SONS = ["cartes", "doree", "pigeon", "tour", "eau", "sons_on", "credits", "reglage_son", "no_wifi"];
  // Sons coupés au bout de N secondes (avec un petit fondu), même si le fichier est plus long
  const DUREE_MAX_SONS = { doree: 3, pigeon: 2 };
  const sonsCharges = {}; // nom -> son décodé (ou null si le fichier n'existe pas)
  const sonsDemandes = {}; // nom -> moment où il a été demandé alors qu'il n'était pas encore chargé
  let chargementSonsLance = false;

  function chargerSons(){
    const ctx = contexteAudio();
    if (!ctx || chargementSonsLance) return;
    chargementSonsLance = true;
    SONS.forEach((nom) => {
      fetch(`Sons/${nom}.mp3?t=${window.ANTI_CACHE || Date.now()}`)
        .then((reponse) => {
          if (!reponse.ok) throw new Error("absent");
          return reponse.arrayBuffer();
        })
        .then((donnees) => new Promise((ok, ko) => ctx.decodeAudioData(donnees, ok, ko)))
        .then((son) => {
          sonsCharges[nom] = son;
          // Demandé juste avant d'être chargé (tout premier tap) : joué maintenant, si c'était il y a < 1,5 s
          if (sonsDemandes[nom] && Date.now() - sonsDemandes[nom] < 1500) lireSon(nom, son);
          delete sonsDemandes[nom];
        })
        .catch(() => { sonsCharges[nom] = null; });
    });
  }

  // carte | doree | culsec | pigeon | tour | eau
  function jouerSon(nom){
    if (!caseSons.checked || volumeSons <= 0) return;
    if (rattrapageEnCours) return; // reconnexion : pas de sons pour les actions déjà passées
    const ctx = contexteAudio();
    if (!ctx) return;
    chargerSons();
    const son = sonsCharges[nom];
    if (son === undefined) sonsDemandes[nom] = Date.now(); // pas encore chargé : joué dès qu'il arrive
    if (!son) return; // (null : pas de fichier pour ce moment)
    lireSon(nom, son);
  }

  function lireSon(nom, son){
    const ctx = contexteAudio();
    if (!ctx || !caseSons.checked || rattrapageEnCours) return;
    const sortie = ctx.createGain();
    const volume = Math.pow(volumeSons / 100, 2); // curseur plus naturel à l'oreille
    sortie.gain.value = volume;
    sortie.connect(ctx.destination);
    const lecture = ctx.createBufferSource();
    lecture.buffer = son;
    lecture.connect(sortie);
    const debut = ctx.currentTime;
    lecture.start(debut);

    const dureeMax = DUREE_MAX_SONS[nom];
    if (dureeMax && son.duration > dureeMax) {
      sortie.gain.setValueAtTime(volume, debut + dureeMax - 0.3);
      sortie.gain.linearRampToValueAtTime(0.0001, debut + dureeMax);
      lecture.stop(debut + dureeMax + 0.02);
    }
  }

  // ===== Rappel « Bois de l'eau 💧 » : toutes les 30 minutes de partie (désactivé par défaut) =====
  // Petit bandeau en haut de l'écran, qui ne bloque rien et se ferme au tap ou tout seul.
  // (Chaque téléphone le gère de son côté : rien n'est envoyé aux autres joueurs.)
  const CLE_RAPPEL_EAU = "alcuno_rappel_eau";
  const caseRappelEau = document.getElementById("optionRappelEau");
  caseRappelEau.checked = lireReglage(CLE_RAPPEL_EAU, false);
  caseRappelEau.addEventListener("change", () => ecrireReglage(CLE_RAPPEL_EAU, caseRappelEau.checked));

  const MINUTES_RAPPEL_EAU = 30;
  let tempsDeJeuSansEau = 0; // ms de partie (écran allumé) depuis le dernier rappel

  setInterval(() => {
    if (!caseRappelEau.checked || !partieLancee || document.visibilityState !== "visible") return;
    tempsDeJeuSansEau += 15000;
    if (tempsDeJeuSansEau >= MINUTES_RAPPEL_EAU * 60000) {
      tempsDeJeuSansEau = 0;
      afficherRappelEau();
    }
  }, 15000);


  function afficherRappelEau(){
    const ancien = document.getElementById("rappelEau");
    if (ancien) ancien.remove();
    const bandeau = document.createElement("div");
    bandeau.id = "rappelEau";
    bandeau.setAttribute("role", "status");
    bandeau.innerHTML =
      '<span class="rappelEau-icone" aria-hidden="true">💧</span>' +
      '<span class="rappelEau-texte"><strong>MESSAGE DE TON ANGE GARDIEN</strong>' +
      '<strong>Bois de l\'eau !</strong>' +
      '<span>Demain tu me diras merci 😉</span></span>';
    const fermer = () => bandeau.remove();
    bandeau.addEventListener("click", fermer);
    setTimeout(fermer, 9000);
    document.body.appendChild(bandeau);
    jouerSon("eau");
    vibrer([60, 80, 60]);
  }

  // ===== Partager le jeu : bouton « Partager » du téléphone, sinon lien copié =====
  const ADRESSE_JEU = "https://tristan-escardo.github.io/Alcuno/";

  document.getElementById("btnPartagerJeu").addEventListener("click", () => {
    if (navigator.share) {
      navigator.share({ url: ADRESSE_JEU }).catch(() => {}); // juste le lien (aperçu : l'icône du jeu, cf. og:image)
      return;
    }
    const copie = navigator.clipboard ? navigator.clipboard.writeText(ADRESSE_JEU) : Promise.reject();
    copie.then(() => afficherToast("Lien copié !"))
      .catch(() => prompt("Copie le lien du jeu :", ADRESSE_JEU));
  });

  // ===== Diagnostic : tout ce qu'il faut pour comprendre un plantage en ligne, copié en un tap =====
  // Écran : appli installée ou navigateur, et zones de l'heure / du bas (pour la barre du haut de l'iPhone)
  function infosEcranDiagnostic(){
    const sonde = document.createElement("div");
    sonde.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;" +
      "padding-top:env(safe-area-inset-top, 0px);padding-bottom:env(safe-area-inset-bottom, 0px)";
    document.body.appendChild(sonde);
    const zone = getComputedStyle(sonde);
    const haut = zone.paddingTop, bas = zone.paddingBottom;
    sonde.remove();
    return `Écran : ${estEnAppli ? "appli installée" : "navigateur"} | fenêtre ${window.innerWidth}×${window.innerHeight}` +
      ` | écran ${screen.width}×${screen.height} | zone de l'heure ${haut} | zone du bas ${bas}` +
      ` | thème ${document.documentElement.dataset.theme || "-"}`;
  }

  function texteDiagnostic(){
    const etat = window.__etatFileAlcuno ? window.__etatFileAlcuno() : {};
    const journal = etat.journal || [];
    delete etat.journal;
    return [
      "=== Diagnostic Alcuno ===",
      `Version ${VERSION_AFFICHEE} | ${new Date().toLocaleString("fr-FR")}`,
      `Téléphone : ${navigator.userAgent}`,
      `Réseau : ${navigator.onLine ? "en ligne" : "hors connexion"} | Firebase chargé : ${!!window.firebaseDB}`,
      infosEcranDiagnostic(),
      `Partie : ${codePartieActuel || "aucune"} | pseudo : ${pseudoActuel || "-"} | manche : ${mancheCourante === null ? "-" : mancheCourante}` +
        ` | partie en mémoire : ${JSON.stringify(lirePartieLocale())}`,
      `File d'actions : ${JSON.stringify(etat)}`,
      "--- Journal des actions en ligne ---",
      ...(journal.length ? journal : ["(vide)"]),
      "--- Erreurs récentes ---",
      ...(erreursRecentes.length ? erreursRecentes : ["aucune"])
    ].join("\n");
  }

  document.getElementById("btnDiagnostic").addEventListener("click", () => {
    const texte = texteDiagnostic();
    const copie = (navigator.clipboard && navigator.clipboard.writeText)
      ? navigator.clipboard.writeText(texte)
      : Promise.reject(new Error("presse-papiers indisponible"));
    copie.then(() => afficherToast("Diagnostic copié", 3000))
      .catch(() => {
        // Pas de presse-papiers : bouton « Partager » du téléphone, sinon le texte dans une fenêtre
        if (navigator.share) {
          navigator.share({ title: "Diagnostic Alcuno", text: texte }).catch(() => {});
        } else {
          prompt("Copie ce texte :", texte);
        }
      });
  });

  // ===== Partie en mémoire : la partie en ligne dont ce téléphone se souvient (« Revenir ») =====
  function majLignePartieMemoire(){
    const memoire = lirePartieLocale();
    const ligne = document.getElementById("lignePartieMemoire");
    if (!memoire || !memoire.code) {
      ligne.style.display = "none";
      return;
    }
    document.getElementById("textePartieMemoire").innerText =
      `Partie ${memoire.code}${memoire.pseudo ? " (" + memoire.pseudo + ")" : ""} : proposée par « Revenir dans une partie en cours ».`;
    ligne.style.display = "";
  }

  document.getElementById("btnOublierPartie").addEventListener("click", () => {
    const memoire = lirePartieLocale();
    if (!memoire || !memoire.code) { majLignePartieMemoire(); return; }
    if (!confirm(`Oublier la partie ${memoire.code} ?\n\nLe bouton « Revenir dans une partie en cours » ne la proposera plus. ` +
                 `(Tu pourras toujours la rejoindre avec « Rejoindre » et ton pseudo.)`)) return;
    oublierPartieLocale();
    majBoutonRevenir();
    majLignePartieMemoire();
    afficherToast("Partie oubliée");
  });

  // ===== Vibrations (Android : un iPhone ne peut pas vibrer depuis une page web) =====
  // Activées par défaut
  const CLE_VIBRATIONS = "alcuno_vibrations";
  const caseVibrations = document.getElementById("optionVibrations");
  let vibrationsActives = true;
  try { vibrationsActives = localStorage.getItem(CLE_VIBRATIONS) !== "0"; } catch (e) {}
  caseVibrations.checked = vibrationsActives;

  caseVibrations.addEventListener("change", () => {
    vibrationsActives = caseVibrations.checked;
    try { localStorage.setItem(CLE_VIBRATIONS, vibrationsActives ? "1" : "0"); } catch (e) {}
    if (vibrationsActives) vibrer(60); // petit retour pour montrer que ça marche
  });

  function vibrer(motif){
    if (!vibrationsActives || typeof navigator.vibrate !== "function") return;
    if (rattrapageEnCours) return; // reconnexion : pas de vibrations pour les actions déjà passées
    try { navigator.vibrate(motif); } catch (e) {}
  }

  let dernierTourVibre = null; // en ligne : on vibre une seule fois par tour (voir majStickyJoueurActif)

  // ===== Écran toujours allumé pendant une partie (Wake Lock) =====
  // Un téléphone en veille ne reçoit plus les actions en ligne et prend du retard.
  // Le navigateur relâche le verrou quand on change d'appli : on le redemande au retour.
  // Réglage « Écran toujours allumé » (activé par défaut)
  let verrouEcran = null;
  let demandeVerrouEnCours = false;
  const CLE_ECRAN_ALLUME = "alcuno_ecran_allume";
  const caseEcranAllume = document.getElementById("optionEcranAllume");
  caseEcranAllume.checked = lireReglage(CLE_ECRAN_ALLUME, true);

  caseEcranAllume.addEventListener("change", () => {
    ecrireReglage(CLE_ECRAN_ALLUME, caseEcranAllume.checked);
    if (!caseEcranAllume.checked) libererEcran();
  });

  function garderEcranAllume(){
    if (!caseEcranAllume.checked) return;
    if (verrouEcran || demandeVerrouEnCours) return;
    if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;

    demandeVerrouEnCours = true;
    navigator.wakeLock.request("screen").then((verrou) => {
      verrouEcran = verrou;
      verrou.addEventListener("release", () => {
        if (verrouEcran === verrou) verrouEcran = null;
      });
    }).catch(() => {}).finally(() => { demandeVerrouEnCours = false; });
  }

  function libererEcran(){
    if (!verrouEcran) return;
    const verrou = verrouEcran;
    verrouEcran = null;
    verrou.release().catch(() => {});
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && (partieLancee || codePartieActuel)) garderEcranAllume();
    if (document.visibilityState === "visible") verifierNouvelleVersion();
  });

  // #endregion

  // #region Nouvelle version disponible et appli installable
  // ===== Nouvelle version disponible =====
  // Une appli installée qu'on rouvre depuis les applis récentes reprend l'ancienne page sans la
  // recharger. On regarde donc si une version plus récente est en ligne (au retour dans l'appli,
  // et toutes les 5 min) ; si oui, un bandeau propose de mettre à jour en un tap.
  // Jamais en pleine partie ni dans une partie en ligne : on ne coupe personne.
  let versionEnLigne = null;

  // "8.5.1" => 80501 (même calcul que VERSION_JEU), pour comparer les versions
  function versionEnNombre(texte){
    return String(texte).split(".").reduce((total, partie, i) => total + Number(partie) * [10000, 100, 1][i], 0);
  }

  function verifierNouvelleVersion(){
    if (document.visibilityState !== "visible" || navigator.onLine === false) return;
    fetch("script.js?verif=" + Date.now(), { cache: "no-store" })
      .then((reponse) => reponse.ok ? reponse.text() : "")
      .then((texte) => {
        const trouve = texte.match(/VERSION_AFFICHEE = "([^"]+)"/);
        // Seulement si la version en ligne est PLUS RÉCENTE que celle de ce téléphone
        if (trouve && versionEnNombre(trouve[1]) > VERSION_JEU) {
          versionEnLigne = trouve[1];
          afficherBandeauMiseAJour();
        }
      })
      .catch(() => {}); // pas de réseau : on réessaiera plus tard
  }

  function afficherBandeauMiseAJour(){
    if (!versionEnLigne) return;
    if (partieLancee || codePartieActuel) return; // pas en pleine partie (affiché au retour à l'accueil)
    if (document.getElementById("bandeauMiseAJour")) return;

    const bandeau = document.createElement("div");
    bandeau.id = "bandeauMiseAJour";
    bandeau.innerHTML =
      `<span class="texte">Nouvelle version disponible (${echapperHtml(versionEnLigne)})</span>` +
      `<button type="button" class="maj">Mettre à jour</button>` +
      `<button type="button" class="plusTard" aria-label="Plus tard">✕</button>`;
    // Adresse neuve (?v=...) : contourne le cache et recharge toute l'appli
    bandeau.querySelector(".maj").addEventListener("click", () => {
      location.replace(location.pathname + "?v=" + encodeURIComponent(versionEnLigne));
    });
    bandeau.querySelector(".plusTard").addEventListener("click", () => bandeau.remove());
    document.body.appendChild(bandeau);
  }

  setInterval(verifierNouvelleVersion, 5 * 60 * 1000);

  // ===== Appli installable (PWA) =====
  // Service worker « réseau d'abord » (sw.js) : dernière version avec internet, copie locale sans.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // Déjà ouvert en appli (depuis l'icône) : on ne propose rien
  const estEnAppli =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  const blocInstaller = document.getElementById("installerAppli");
  const btnInstallerAppli = document.getElementById("btnInstallerAppli");
  let demandeInstallation = null;

  // Android (Chrome) : le navigateur signale qu'on peut installer => on montre le bouton
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    if (estEnAppli) return;
    demandeInstallation = e;
    blocInstaller.hidden = false;
    btnInstallerAppli.hidden = false;
  });

  btnInstallerAppli.addEventListener("click", () => {
    if (!demandeInstallation) return;
    demandeInstallation.prompt();
    demandeInstallation.userChoice.finally(() => {
      demandeInstallation = null;
      btnInstallerAppli.hidden = true;
      blocInstaller.hidden = true;
    });
  });

  window.addEventListener("appinstalled", () => {
    demandeInstallation = null;
    blocInstaller.hidden = true;
  });

  // iPhone / iPad : pas de bouton possible (Apple ne le permet pas), on affiche l'astuce Safari
  const estIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (estIOS && !estEnAppli) {
    blocInstaller.hidden = false;
    document.getElementById("astuceIphone").hidden = false;
  }

  // #endregion

  // #region Mode en ligne : codes de partie, menus Créer / Rejoindre / Revenir, transitions, clavier
  // Easter egg : de temps en temps, le code de la partie est un de ces noms,
  // complété par des chiffres AVANT ou APRÈS (jamais au milieu) pour faire 5 caractères
  const CODES_EASTER_EGG = ["YLA", "CELIEN", "ROSA", "TRIS"];
  const CHANCE_EASTER_EGG = 0.2; // 1 partie sur 5
  const LONGUEUR_CODE = 5;
  const CHIFFRES_CODE = "23456789"; // pas de 0/1 (confusion avec O/I)

  function tirer(chaine){
    return chaine[Math.floor(Math.random() * chaine.length)];
  }

  function genererCodePartie(){
    if (Math.random() < CHANCE_EASTER_EGG) {
      const nom = tirer(CODES_EASTER_EGG);
      let chiffres = "";
      for (let i = nom.length; i < LONGUEUR_CODE; i++) chiffres += tirer(CHIFFRES_CODE);
      return Math.random() < 0.5 ? chiffres + nom : nom + chiffres;
    }

    const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ" + CHIFFRES_CODE;
    let code = "";
    for (let i = 0; i < LONGUEUR_CODE; i++){
      code += tirer(caracteres);
    }
    return code;
  }

  // Tire un code qui n'est pas déjà utilisé par une autre partie
  // (indispensable pour les codes easter egg, peu nombreux : CELIEN est unique)
  function trouverCodeLibre(essaisRestants = 10){
    const code = genererCodePartie();
    return window.fbGet(window.fbRef(window.firebaseDB, `parties/${code}`)).then((snapshot) => {
      if (!snapshot.exists()) return code;
      if (essaisRestants <= 1) throw new Error("Aucun code de partie libre trouvé");
      return trouverCodeLibre(essaisRestants - 1);
    });
  }

  function erreurFirebase(err){
    console.error(err);
    const refus = err && String(err.code || err.message || "").toLowerCase().includes("permission");
    alert(refus
      ? "Accès refusé par la base Firebase (règles de sécurité)."
      : "Impossible de joindre le serveur. Vérifie ta connexion.");
  }

  // Entrée dans un champ = clic sur le bouton de validation
  function validerAvecEntree(idsChamps, idBouton){
    idsChamps.forEach((id) => {
      document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") document.getElementById(idBouton).click();
      });
    });
  }
  validerAvecEntree(["pseudoCreateur"], "validerCreation");
  validerAvecEntree(["pseudoRejoindre"], "validerRejoindre");
  validerAvecEntree(["codeRevenir"], "validerRevenir");
  // Rejoindre : Entrée sur le code => on passe au pseudo s'il est vide (sinon on valide)
  document.getElementById("codeRejoindre").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const champPseudo = document.getElementById("pseudoRejoindre");
    if (!champPseudo.value.trim()) ouvrirClavier(champPseudo);
    else document.getElementById("validerRejoindre").click();
  });

  // Clavier ouvert : zone de l'écran encore visible (au-dessus du clavier), pour que l'écran du mode en
  // ligne s'y cale (voir #enLigne dans le CSS) : sinon le clavier cache le bouton « Créer » / « Rejoindre »
  if (window.visualViewport) {
    const majZoneVisible = () => {
      const zone = window.visualViewport;
      document.documentElement.style.setProperty("--hauteur-visible", `${zone.height}px`);
      document.documentElement.style.setProperty("--haut-visible", `${zone.offsetTop}px`);
      // Clavier ouvert (zone visible nettement plus petite que l'écran) : contenu calé au-dessus du clavier
      document.documentElement.classList.toggle("clavier-ouvert", zone.height < window.innerHeight * 0.8);
    };
    window.visualViewport.addEventListener("resize", majZoneVisible);
    window.visualViewport.addEventListener("scroll", majZoneVisible);
    majZoneVisible();
  }

  // Transitions entre les pages : « ← Retour » et ⌂ => la page suivante arrive depuis la gauche
  // (classe nav-retour, voir le CSS) ; sinon elle arrive depuis la droite
  let minuteurNavRetour = null;
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest(".btnRetour, .btnAccueilTexte")) return;
    document.documentElement.classList.add("nav-retour");
    clearTimeout(minuteurNavRetour);
    minuteurNavRetour = setTimeout(() => document.documentElement.classList.remove("nav-retour"), 400);
  }, true);

  // Animation d'arrivée d'un élément déjà affiché (ex. la page du mode classique)
  function animerArrivee(el){
    el.classList.remove("page-entree");
    void el.offsetWidth;
    el.classList.add("page-entree");
    el.addEventListener("animationend", function fin(e){
      if (e.target !== el) return;
      el.removeEventListener("animationend", fin);
      el.classList.remove("page-entree");
    });
  }

  // Ouvre le clavier sur un champ. À appeler pendant le tap sur le bouton qui affiche le champ :
  // sinon l'iPhone refuse d'ouvrir le clavier tout seul.
  function ouvrirClavier(champ){
    if (!champ) return;
    try { champ.focus({ preventScroll: true }); } catch (e) { champ.focus(); }
  }

  document.getElementById("btnModeClassique").addEventListener("click", () => {
    document.getElementById("choixMode").style.display = "none";
    document.getElementById("menu").style.display = "";
    document.getElementById("messages").style.display = "";
    document.getElementById("jeu").style.display = "";
    ["menu", "messages", "jeu"].forEach((id) => animerArrivee(document.getElementById(id)));
    ouvrirClavier(document.getElementById("nomJoueur")); // clavier ouvert pour ajouter les joueurs
  });

  // Connexion à Firebase ouverte à l'avance (dès « Mode en ligne », ou au chargement si une partie
  // est en mémoire) : sinon le 1er tap « Créer » / « Rejoindre » attend aussi la connexion
  let firebasePrechauffe = false;

  function prechaufferFirebase(){
    if (firebasePrechauffe) return;
    firebasePrechauffe = true;
    attendreFirebase(() => {
      window.fbOnValue(window.fbRef(window.firebaseDB, ".info/connected"), () => {});
    });
  }

  // Bouton qui attend Firebase : il réagit tout de suite (texte « … », grisé) et ne peut pas
  // être tapé deux fois. Renvoie la fonction qui le remet comme avant.
  function boutonEnAttente(id, texte){
    const bouton = document.getElementById(id);
    const texteAvant = bouton.innerText;
    bouton.disabled = true;
    bouton.classList.add("enAttente");
    bouton.innerText = texte;
    return () => {
      bouton.disabled = false;
      bouton.classList.remove("enAttente");
      bouton.innerText = texteAvant;
    };
  }

  document.getElementById("btnModeEnLigne").addEventListener("click", () => {
    prechaufferFirebase();
    document.getElementById("choixMode").style.display = "none";
    document.getElementById("enLigne").style.display = "";
  });

  document.getElementById("btnCreerPartie").addEventListener("click", () => {
    document.getElementById("enLigneChoix").style.display = "none";
    document.getElementById("enLigneCreer").style.display = "";
    ouvrirClavier(document.getElementById("pseudoCreateur"));
  });

  document.getElementById("btnRejoindrePartie").addEventListener("click", () => {
    document.getElementById("enLigneChoix").style.display = "none";
    document.getElementById("enLigneRejoindre").style.display = "";
    const champCode = document.getElementById("codeRejoindre");
    ouvrirClavier(champCode.value.trim() ? document.getElementById("pseudoRejoindre") : champCode);
  });

  // ===== « Revenir dans une partie » : reconnexion avec le code seulement =====
  const btnRevenirPartie = document.getElementById("btnRevenirPartie");

  // Si ce téléphone se souvient d'une partie en cours, le bouton la propose directement
  // (le code n'est pas affiché sur le bouton, le champ est pré-rempli au tap). Depuis un autre
  // téléphone : « Rejoindre une partie » avec le même pseudo qu'avant remet aussi le joueur à sa place.
  // Le bouton n'apparaît que si la partie peut vraiment être reprise, vérifié dans Firebase :
  // - partie supprimée ou créée avec une ancienne version => oubliée, plus de bouton ;
  // - plus aucun autre joueur connecté dedans => pas de bouton (il revient si quelqu'un se reconnecte).
  let verificationRevenir = 0;

  function majBoutonRevenir(){
    const memoire = lirePartieLocale();
    const numero = ++verificationRevenir;
    if (!memoire || !memoire.code) {
      btnRevenirPartie.style.display = "none";
      return;
    }

    prechaufferFirebase(); // partie en mémoire : le joueur va sans doute revenir en ligne
    attendreFirebase(() => {
      window.fbGet(window.fbRef(window.firebaseDB, `parties/${memoire.code}`)).then((snapshot) => {
        if (numero !== verificationRevenir) return; // une vérification plus récente a été lancée
        const partie = snapshot.val();
        const versionPartie = partie && typeof partie.version === "number" ? partie.version : 0;

        if (!partie || versionPartie < VERSION_JEU) {
          oublierPartieLocale();
          btnRevenirPartie.style.display = "none";
          return;
        }

        // Connecté = pas marqué « false » (sans info de présence, on considère le joueur là)
        const joueursPartie = partie.joueurs || {};
        const quelquUn = Object.keys(joueursPartie)
          .some(nom => nom !== memoire.pseudo && joueursPartie[nom].connecte !== false);
        btnRevenirPartie.style.display = quelquUn ? "" : "none";
      }).catch(() => {}); // hors connexion : on laisse le bouton tel quel
    });
  }
  document.getElementById("btnModeEnLigne").addEventListener("click", majBoutonRevenir);

  // Retour sur l'appli (téléphone déverrouillé...) hors partie : le bouton est revérifié
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !codePartieActuel) majBoutonRevenir();
  });

  btnRevenirPartie.addEventListener("click", () => {
    const memoire = lirePartieLocale();
    document.getElementById("codeRevenir").value = (memoire && memoire.code) || "";
    document.getElementById("enLigneChoix").style.display = "none";
    document.getElementById("enLigneRevenir").style.display = "";
    // Code déjà rempli (partie en mémoire) : pas besoin du clavier, il suffit de taper « Revenir »
    if (!document.getElementById("codeRevenir").value) ouvrirClavier(document.getElementById("codeRevenir"));
  });

  document.getElementById("btnRetourRevenir").addEventListener("click", () => {
    document.getElementById("enLigneRevenir").style.display = "none";
    document.getElementById("enLigneChoix").style.display = "";
  });

  document.getElementById("validerRevenir").addEventListener("click", () => {
    const code = document.getElementById("codeRevenir").value.trim().toUpperCase();
    if (!code) { alert("Entre le code de la partie."); return; }

    const finAttente = boutonEnAttente("validerRevenir", "Connexion…");
    attendreFirebase(() => {
      window.fbGet(window.fbRef(window.firebaseDB, `parties/${code}`)).then((snapshot) => {
        finAttente();
        if (!snapshot.exists()) {
          oublierPartieLocale();
          majBoutonRevenir();
          alert("Aucune partie trouvée avec ce code (elle est peut-être terminée).");
          return;
        }
        const partie = snapshot.val();

        // Partie créée avec une ANCIENNE version du jeu : elle ne peut plus être reprise (les
        // téléphones ne joueraient pas pareil). On l'oublie : le bouton « Revenir » disparaît,
        // au lieu de reproposer sans fin une partie impossible à reprendre.
        const versionPartie = typeof partie.version === "number" ? partie.version : 0;
        if (versionPartie < VERSION_JEU) {
          oublierPartieLocale();
          majBoutonRevenir();
          document.getElementById("enLigneRevenir").style.display = "none";
          document.getElementById("enLigneChoix").style.display = "";
          alert("Cette partie a été créée avec une ancienne version du jeu : elle ne peut plus être reprise.\n\n" +
                "Créez une nouvelle partie.");
          return;
        }

        if (!versionCompatible(partie)) return;
        revenirAvecLeCode(code, partie, !!(partie.etatJeu && partie.etatJeu.demarree));
      }).catch((e) => { finAttente(); erreurFirebase(e); });
    });
  });

  // Même version du jeu que la partie ? Sinon message (et rechargement si c'est nous qui sommes en retard)
  function versionCompatible(partie){
    if (partie.version === VERSION_JEU) return true;

    // Anciennes parties : version en texte => considérée comme plus ancienne
    const versionPartie = typeof partie.version === "number" ? partie.version : 0;
    if (versionPartie > VERSION_JEU) {
      // C'est nous qui sommes en retard : rechargement sur une adresse neuve (contourne le cache)
      alert("Ton jeu n'est pas à jour : la page va se recharger.\nEntre ensuite à nouveau le code.");
      location.replace(location.pathname + "?v=" + versionPartie);
    } else {
      alert("Le téléphone qui a créé la partie a une ancienne version du jeu.\n" +
            "Il doit recharger la page (ou l'ouvrir en navigation privée), puis recréer la partie.");
    }
    return false;
  }

  document.getElementById("btnQuitterSalle").addEventListener("click", quitterPartie);

  document.getElementById("validerCreation").addEventListener("click", () => {
    const pseudo = document.getElementById("pseudoCreateur").value.replace(/\s+/g, " ").trim();
    if (!pseudo) { alert("Entre un pseudo."); return; }
    if (PSEUDO_INVALIDE.test(pseudo)) { alert("Pseudo invalide (pas de . # $ [ ] /)."); return; }

    const finAttente = boutonEnAttente("validerCreation", "Création…");
    attendreFirebase(() => {
      let code = null;
      let soft = caseModeSoft.checked; // réglage de l'hôte, fixé pour toute la partie
      let softRefuse = false;

      const creer = (avecSoft) => window.fbSet(window.fbRef(window.firebaseDB, `parties/${code}`), Object.assign({
        version: VERSION_JEU,
        hote: pseudo,
        joueurs: {
          [pseudo]: { nom: pseudo, host: true, rejoint: Date.now() }
        },
        etatJeu: { demarree: false, hote: pseudo },
        // Pour le nettoyage automatique (.github/workflows/nettoyage.yml)
        creee: window.fbServerTimestamp(),
        activite: window.fbServerTimestamp()
      }, avecSoft ? { soft: true } : {}));

      trouverCodeLibre().then((codeLibre) => {
        code = codeLibre;
        // Règles Firebase pas encore à jour pour « soft » : partie créée en mode normal
        return creer(soft).catch((erreur) => {
          if (!soft) throw erreur;
          soft = false;
          softRefuse = true;
          return creer(false);
        });
      }).then(() => {
        choisirModeSoftEnLigne(soft);
        if (softRefuse) {
          alert("Le Mode PJ n'est pas encore disponible en ligne (règles Firebase à mettre à jour) : " +
                "la partie est créée en mode normal.");
        }
        codePartieActuel = code;
        pseudoActuel = pseudo;
        estHote = true;
        memoriserPartieLocale(code, pseudo);
        suivrePresence(code, pseudo);

        document.getElementById("enLigneCreer").style.display = "none";
        document.getElementById("codePartieAffiche").innerText = "Code de la partie : " + code;
        document.getElementById("salleAttente").style.display = "";

        ecouterSalleAttente(code);
        ecouterEtatPartie(code);
      }).catch(erreurFirebase).finally(finAttente);
    });
  });

  document.getElementById("validerRejoindre").addEventListener("click", () => {
    const code = document.getElementById("codeRejoindre").value.trim().toUpperCase();
    const pseudo = document.getElementById("pseudoRejoindre").value.replace(/\s+/g, " ").trim();
    if (!code || !pseudo) {
      alert("Entre le code et ton pseudo.\n\n" +
            "Tu as été déconnecté d'une partie ? Entre le code et le même pseudo qu'avant : tu reprendras ta place.");
      return;
    }
    if (PSEUDO_INVALIDE.test(pseudo)) { alert("Pseudo invalide (pas de . # $ [ ] /)."); return; }

    const finAttente = boutonEnAttente("validerRejoindre", "Connexion…");
    attendreFirebase(() => {
      const db = window.firebaseDB;
      const refPartie = window.fbRef(db, `parties/${code}`);

      window.fbGet(refPartie).then((snapshot) => {
        if (!snapshot.exists()) {
          alert("Aucune partie trouvée avec ce code.");
          return;
        }

        const partie = snapshot.val();
        if (!versionCompatible(partie)) return;
        const enJeu = !!(partie.etatJeu && partie.etatJeu.demarree);

        // Pseudo déjà dans la partie (majuscules ignorées) : c'est sans doute un joueur qui s'est
        // déconnecté (page rechargée, téléphone éteint...) => il reprend sa place, sous son pseudo exact
        const pseudoMin = pseudo.toLocaleLowerCase("fr-FR");
        const nomExistant = Object.keys(partie.joueurs || {})
          .find(nom => nom.toLocaleLowerCase("fr-FR") === pseudoMin);

        if (nomExistant) {
          const ok = confirm(
            `« ${nomExistant} » est déjà dans cette partie.\n\n` +
            `C'est toi ? Appuie sur OK pour reprendre ta place` +
            (enJeu ? " : tu retrouveras la partie là où elle en est." : ".") +
            `\n\n(Sinon, annule et choisis un autre pseudo.)`
          );
          if (ok) reprendrePlaceEnLigne(code, nomExistant, partie);
          return;
        }

        if (enJeu) {
          // Joueur retiré (ou parti) pendant la partie : il peut y revenir sous le même pseudo
          const nomRetire = joueurRetire(partie, pseudo);
          if (nomRetire) {
            const ok = confirm(
              `« ${nomRetire} » a été retiré de cette partie.\n\n` +
              `C'est toi ? Appuie sur OK pour y revenir : tu retrouveras la partie là où elle en est.`
            );
            if (ok) revenirApresRetrait(code, nomRetire, partie);
            return;
          }

          alert("La partie a déjà commencé : on ne peut plus y ajouter de joueur.\n\n" +
                "Si tu en faisais partie et que tu as été déconnecté, entre exactement le même pseudo " +
                "qu'avant pour reprendre ta place.");
          return;
        }

        const refJoueur = window.fbRef(db, `parties/${code}/joueurs/${pseudo}`);
        return window.fbSet(refJoueur, { nom: pseudo, host: false, rejoint: Date.now() }).then(() => {
          choisirModeSoftEnLigne(partie.soft === true);
          marquerActivite(code);
          codePartieActuel = code;
          pseudoActuel = pseudo;
          estHote = false;
          memoriserPartieLocale(code, pseudo);
          suivrePresence(code, pseudo);

          document.getElementById("enLigneRejoindre").style.display = "none";
          document.getElementById("codePartieAffiche").innerText = "Code de la partie : " + code;
          document.getElementById("salleAttente").style.display = "";

          ecouterSalleAttente(code);
          ecouterEtatPartie(code);
        });
      }).catch(erreurFirebase).finally(finAttente);
    });
  });

  document.getElementById("lancerPartieEnLigne").addEventListener("click", () => {
    if (!estHote || !codePartieActuel) return;

    const finAttente = boutonEnAttente("lancerPartieEnLigne", "Lancement…");
    window.fbGet(window.fbRef(window.firebaseDB, `parties/${codePartieActuel}/joueurs`)).then((snapshot) => {
      const liste = Object.values(snapshot.val() || {})
        .sort((a, b) => (a.rejoint || 0) - (b.rejoint || 0))
        .map(j => j.nom);

      if (liste.length < 2) { alert("Il faut au moins 2 joueurs."); return; }
      return lancerMancheEnLigne(liste, true);
    }).catch(erreurFirebase).finally(finAttente);
  });

  
  // ===== BOUTONS RETOUR =====
  document.getElementById("btnRetourChoixMode").addEventListener("click", () => {
    document.getElementById("enLigne").style.display = "none";
    document.getElementById("choixMode").style.display = "";
  });

  document.getElementById("btnRetourCreer").addEventListener("click", () => {
    document.getElementById("enLigneCreer").style.display = "none";
    document.getElementById("enLigneChoix").style.display = "";
  });

  document.getElementById("btnRetourRejoindre").addEventListener("click", () => {
    document.getElementById("enLigneRejoindre").style.display = "none";
    document.getElementById("enLigneChoix").style.display = "";
  });


  // #endregion

  // #region Mode en ligne : salle d'attente, manches, présence, coupure réseau
  function ecouterSalleAttente(code){
    const db = window.firebaseDB;
    const refJoueurs = window.fbRef(db, `parties/${code}/joueurs`);
    garderEcranAllume(); // en ligne : pas de mise en veille dès la salle d'attente

    if (desabonnerJoueurs) desabonnerJoueurs();
    desabonnerJoueurs = window.fbOnValue(refJoueurs, (snapshot) => {
      // Plus aucun joueur : la partie a été supprimée
      if (!snapshot.exists()) {
        partieFermee();
        return;
      }

      const data = snapshot.val();

      // On n'est plus dans la liste : un autre joueur nous a retiré
      if (!data[pseudoActuel]) {
        // Joueur retiré qui revient : sa fiche a pu être effacée en retard (nettoyage du retrait) => on la remet
        if (retourEnCours) {
          remettreFicheJoueur();
          return;
        }
        const code = codePartieActuel;
        const nom = pseudoActuel;
        quitterPartieEnLigne();
        alerteRetire(code, nom);
        return;
      }

      // Le rôle d'hôte peut changer (l'hôte précédent est parti)
      estHote = !!data[pseudoActuel].host;

      // Seulement « false » : sans info de présence (champ absent), on ne marque personne
      const absents = Object.keys(data).filter(n => data[n].connecte === false && n !== pseudoActuel);
      if (absents.sort().join("|") !== Array.from(deconnectes).sort().join("|")) {
        deconnectes = new Set(absents);
        if (partieLancee) {
          afficherJoueurs();
          afficherJoueurActif();
        }
      }

      const liste = document.getElementById("listeJoueursEnLigne");
      liste.innerHTML = "";

      const tries = Object.values(data).sort((a, b) => (a.rejoint || 0) - (b.rejoint || 0));
      tries.forEach((j) => {
        const div = document.createElement("div");
        const nom = document.createElement("span");
        nom.innerText = avecCouronne(j.nom) + (j.host ? " (hôte)" : "");
        ajouterBadgeDeconnecte(nom, deconnectes.has(j.nom));
        div.appendChild(nom);

        // Tout le monde peut retirer les autres joueurs (pour partir soi-même : « Retour »)
        if (j.nom !== pseudoActuel) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btnExclure";
          btn.innerText = "✕";
          btn.title = "Retirer " + j.nom;
          btn.addEventListener("click", () => {
            // Retirer l'hôte arrête la partie : écran de confirmation d'abord
            if (j.host) {
              demanderRetraitHote(code, j.nom);
              return;
            }
            retirerJoueur(code, j.nom).catch(erreurFirebase);
          });
          div.appendChild(btn);
        }

        liste.appendChild(div);
      });

      document.getElementById("lancerPartieEnLigne").style.display =
        (estHote && tries.length >= 2) ? "" : "none";
    });
  }

  // ===== Écran de confirmation « Retirer l'hôte ? » =====
  const ecranConfirmerHote = document.getElementById("ecranConfirmerHote");
  let retraitHoteEnAttente = null; // { code, nom }

  function demanderRetraitHote(code, nomHote){
    document.getElementById("texteConfirmerHote").innerText =
      `${nomHote} est l'hôte de la partie.\n` +
      `Si tu le retires, la partie s'arrête pour tout le monde.`;
    retraitHoteEnAttente = { code, nom: nomHote };
    ecranConfirmerHote.style.display = "";
  }

  function fermerConfirmationHote(){
    retraitHoteEnAttente = null;
    ecranConfirmerHote.style.display = "none";
  }

  document.getElementById("btnConfirmerHoteOui").addEventListener("click", () => {
    const retrait = retraitHoteEnAttente;
    fermerConfirmationHote();
    if (retrait) retirerJoueur(retrait.code, retrait.nom).catch(erreurFirebase);
  });

  document.getElementById("btnConfirmerHoteNon").addEventListener("click", fermerConfirmationHote);

  function ecouterEtatPartie(code){
    if (desabonnerEtat) desabonnerEtat();
    desabonnerEtat = window.fbOnValue(window.fbRef(window.firebaseDB, `parties/${code}/etatJeu`), (snapshot) => {
      const etat = snapshot.val();

      // Partie supprimée (l'hôte est parti ou a été retiré)
      if (!etat) {
        if (codePartieActuel === code) partieFermee();
        return;
      }

      if (etat.demarree && etat.manche !== mancheCourante) {
        demarrerMancheEnLigne(etat);
      } else if (!etat.demarree && enLigneActif) {
        retourSalleEnLigne(etat);
      }
    });
  }

  // Écrit une nouvelle manche (transaction : si deux joueurs relancent en même temps, une seule passe)
  // depuisSalle : lancement depuis la salle d'attente ; sinon « Rejouer » pendant une manche
  function lancerMancheEnLigne(listeJoueurs, depuisSalle){
    const mancheAttendue = mancheCourante;
    const refEtat = window.fbRef(window.firebaseDB, `parties/${codePartieActuel}/etatJeu`);

    return window.fbRunTransaction(refEtat, (etat) => {
      const e = etat || {};
      const possible = depuisSalle ? !e.demarree : (e.demarree && e.manche === mancheAttendue);
      if (!possible) return; // quelqu'un a déjà relancé => abandon

      return {
        demarree: true,
        manche: (e.manche || 0) + 1,
        seed: Math.floor(Math.random() * 4294967296),
        joueurs: listeJoueurs,
        hote: e.hote || pseudoActuel
      };
    }).then(() => marquerActivite(codePartieActuel)).catch(erreurFirebase);
  }

  // Date de dernière activité (heure du serveur) : une partie sans activité depuis 3 h
  // est supprimée par le nettoyage automatique (.github/workflows/nettoyage.yml)
  function marquerActivite(code){
    if (!code) return;
    window.fbSet(window.fbRef(window.firebaseDB, `parties/${code}/activite`), window.fbServerTimestamp())
      .catch(() => {}); // pas bloquant pour le jeu
  }

  // « Modifier les joueurs » : tout le monde repasse en salle d'attente, même code
  function renvoyerEnSalleEnLigne(){
    const mancheAttendue = mancheCourante;
    const refEtat = window.fbRef(window.firebaseDB, `parties/${codePartieActuel}/etatJeu`);

    window.fbRunTransaction(refEtat, (etat) => {
      const e = etat || {};
      if (!e.demarree || e.manche !== mancheAttendue) return;
      return { demarree: false, manche: e.manche, hote: e.hote || pseudoActuel };
    }).then(() => marquerActivite(codePartieActuel)).catch(erreurFirebase);
  }

  function retourSalleEnLigne(etat){
    enLigneActif = false;
    arreterRetour(); // en salle d'attente, plus de manche où revenir
    if (desabonnerActions) { desabonnerActions(); desabonnerActions = null; }
    reinitialiserFileActions();
    reinitialiserEcransJeu();

    ["enLigneChoix", "enLigneCreer", "enLigneRejoindre"].forEach((id) => {
      document.getElementById(id).style.display = "none";
    });
    document.getElementById("salleAttente").style.display = "";
    document.getElementById("enLigne").style.display = "";

    if (etat.message) afficherToast(etat.message, 4000);
  }

  // ===== Présence : qui est connecté ? =====
  // joueurs/<pseudo>/connecte vaut true tant que le téléphone est connecté à la partie. Firebase le
  // passe tout seul à false quand la connexion est perdue (page fermée, téléphone éteint, réseau coupé).
  // Sert à proposer les bons pseudos quand quelqu'un revient avec le code seulement.
  let desabonnerPresence = null;
  let refPresence = null;

  function suivrePresence(code, nom){
    arreterPresence();
    refPresence = window.fbRef(window.firebaseDB, `parties/${code}/joueurs/${nom}/connecte`);
    const refConnecte = refPresence;
    desabonnerPresence = window.fbOnValue(window.fbRef(window.firebaseDB, ".info/connected"), (snapshot) => {
      majCoupureReseau(snapshot.val() === true);
      if (snapshot.val() !== true) return;
      // (re)connecté au serveur : on prépare le « false » automatique, puis on passe à true
      window.fbOnDisconnect(refConnecte).set(false)
        .then(() => window.fbSet(refConnecte, true))
        .catch(() => {}); // sans la règle Firebase "connecte", on continue sans présence
    });
  }

  // ===== Coupure de réseau : grand logo wifi rouge barré qui clignote au milieu de l'écran =====
  // (mode en ligne seulement : tant que la présence est suivie). Tous les taps sont bloqués dès
  // la coupure ; le logo apparaît après 1,5 s (pas pour un simple raté de connexion). Tout est
  // retiré dès que Firebase est reconnecté.
  let firebaseConnecte = true;
  let timerCoupure = null;

  function majCoupureReseau(connecte){
    if (connecte !== undefined) firebaseConnecte = connecte;
    const coupe = !!desabonnerPresence && (!firebaseConnecte || navigator.onLine === false);
    let logo = document.getElementById("coupureReseau");

    if (!coupe) {
      clearTimeout(timerCoupure);
      timerCoupure = null;
      if (logo) logo.remove();
      return;
    }
    if (logo) return;

    // Écran transparent par-dessus tout : plus aucun tap ne passe
    logo = document.createElement("div");
    logo.id = "coupureReseau";
    logo.setAttribute("role", "alert");
    logo.setAttribute("aria-label", "Connexion perdue");
    ["pointerdown", "pointerup", "click", "touchstart", "touchend", "mousedown", "mouseup", "contextmenu"].forEach((type) => {
      logo.addEventListener(type, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, { passive: false });
    });
    document.body.appendChild(logo);

    timerCoupure = setTimeout(() => {
      timerCoupure = null;
      if (!logo.isConnected) return;
      logo.classList.add("visible");
      jouerSon("no_wifi"); // une seule fois par coupure (quand le logo apparaît), pas en boucle
      logo.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" aria-hidden="true">' +
          '<g stroke="#ff2a2a" stroke-width="2.2">' +
            '<path d="M2 8.8a15 15 0 0 1 20 0"/>' +
            '<path d="M5.2 12.2a10.5 10.5 0 0 1 13.6 0"/>' +
            '<path d="M8.6 15.6a5.5 5.5 0 0 1 6.8 0"/>' +
          '</g>' +
          '<circle cx="12" cy="19.4" r="1.4" fill="#ff2a2a"/>' +
          '<path d="M3.5 3.5l17 17" stroke="#2B001D" stroke-width="4.6"/>' +
          '<path d="M3.5 3.5l17 17" stroke="#ff2a2a" stroke-width="2.4"/>' +
        '</svg>';
    }, 1500);
  }

  // Le téléphone signale aussi la perte du réseau tout de suite (wifi coupé, mode avion)
  window.addEventListener("offline", () => majCoupureReseau());
  window.addEventListener("online", () => majCoupureReseau());

  function arreterPresence(){
    if (desabonnerPresence) { desabonnerPresence(); desabonnerPresence = null; }
    majCoupureReseau(true); // plus en ligne : plus de logo
    if (refPresence) {
      window.fbOnDisconnect(refPresence).cancel().catch(() => {});
      refPresence = null;
    }
  }

  // #endregion

  // #region Mode en ligne : reconnexion, joueur retiré qui revient, quitter la partie
  // ===== Mémoire : ce téléphone se souvient de son pseudo dans la partie en cours =====
  // (stockage local du navigateur) : pour revenir, le code suffit, sans retaper son pseudo
  const CLE_PARTIE_LOCALE = "alcuno_partie_en_ligne";

  function memoriserPartieLocale(code, pseudo){
    try { localStorage.setItem(CLE_PARTIE_LOCALE, JSON.stringify({ code, pseudo })); } catch (e) {}
  }

  function oublierPartieLocale(){
    try { localStorage.removeItem(CLE_PARTIE_LOCALE); } catch (e) {}
  }

  function lirePartieLocale(){
    try { return JSON.parse(localStorage.getItem(CLE_PARTIE_LOCALE)); } catch (e) { return null; }
  }

  // Au chargement (ici : après la mémoire locale) : bouton « Revenir » déjà juste à l'ouverture du mode en ligne
  majBoutonRevenir();

  // Revenir avec le code seulement (champ pseudo vide) :
  // 1) ce téléphone se souvient de son pseudo dans cette partie => il reprend sa place directement ;
  // 2) sinon (autre téléphone...), on propose les joueurs déconnectés : un seul => confirmation,
  //    plusieurs => écran « Qui es-tu ? ».
  function revenirAvecLeCode(code, partie, enJeu){
    const joueursPartie = partie.joueurs || {};

    const memoire = lirePartieLocale();
    if (memoire && memoire.code === code && joueursPartie[memoire.pseudo]) {
      reprendrePlaceEnLigne(code, memoire.pseudo, partie);
      return;
    }

    // Ce téléphone a été retiré de la partie : il peut y revenir (en salle d'attente : si personne
    // n'a pris son pseudo entre-temps)
    const pseudoLibre = () => !Object.keys(joueursPartie).some(n =>
      n.toLocaleLowerCase("fr-FR") === String(memoire.pseudo).toLocaleLowerCase("fr-FR"));
    if (memoire && memoire.code === code && memoire.pseudo &&
        (enJeu ? joueurRetire(partie, memoire.pseudo) : pseudoLibre())) {
      if (confirm(`Tu as été retiré de la partie ${code}.\n\nY revenir en tant que « ${memoire.pseudo} » ?`)) {
        revenirApresRetrait(code, memoire.pseudo, partie);
      }
      return;
    }

    // Déconnectés = connecte à false. Sans info de présence (règle Firebase absente),
    // on propose tous ceux qui ne sont pas marqués connectés.
    const candidats = Object.keys(joueursPartie)
      .filter(nom => joueursPartie[nom].connecte !== true)
      .sort((a, b) => (joueursPartie[a].rejoint || 0) - (joueursPartie[b].rejoint || 0));

    if (candidats.length === 0) {
      alert(enJeu
        ? "Tous les joueurs de cette partie sont connectés : il n'y a pas de place à reprendre."
        : "Entre ton pseudo pour rejoindre la partie.");
      return;
    }

    if (candidats.length === 1) {
      if (confirm(`Reprendre la place de « ${candidats[0]} » dans la partie ${code} ?`)) {
        reprendrePlaceEnLigne(code, candidats[0], partie);
      }
      return;
    }

    afficherChoixPseudo(code, candidats, partie);
  }

  // Écran « Qui es-tu ? » : plusieurs joueurs déconnectés, on choisit sa place
  const ecranChoixPseudo = document.getElementById("ecranChoixPseudo");

  function afficherChoixPseudo(code, noms, partie){
    document.getElementById("texteChoixPseudo").innerText =
      `Plusieurs joueurs se sont déconnectés de la partie ${code}.\nChoisis ton pseudo pour reprendre ta place.`;

    const liste = document.getElementById("listeChoixPseudo");
    liste.innerHTML = "";
    noms.forEach((nom) => {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.innerText = avecCouronne(nom);
      bouton.addEventListener("click", () => {
        ecranChoixPseudo.style.display = "none";
        reprendrePlaceEnLigne(code, nom, partie);
      });
      liste.appendChild(bouton);
    });

    ecranChoixPseudo.style.display = "";
  }

  document.getElementById("btnChoixPseudoAnnuler").addEventListener("click", () => {
    ecranChoixPseudo.style.display = "none";
  });

  // Reconnexion : le joueur reprend sa place sous son pseudo exact. En pleine manche, son téléphone
  // rejoue toutes les actions déjà faites (rattrapage accéléré) avant de reprendre en direct.
  function reprendrePlaceEnLigne(code, nom, partie){
    choisirModeSoftEnLigne(partie.soft === true);
    codePartieActuel = code;
    pseudoActuel = nom;
    estHote = !!(partie.joueurs[nom] && partie.joueurs[nom].host);
    repriseEnCours = !!(partie.etatJeu && partie.etatJeu.demarree);

    document.getElementById("enLigneRejoindre").style.display = "none";
    document.getElementById("enLigneRevenir").style.display = "none";
    document.getElementById("codePartieAffiche").innerText = "Code de la partie : " + code;
    document.getElementById("salleAttente").style.display = "";

    marquerActivite(code);
    ecouterSalleAttente(code);
    memoriserPartieLocale(code, nom);
    suivrePresence(code, nom);
    ecouterEtatPartie(code); // manche en cours => démarrée en mode rattrapage (demarrerMancheEnLigne)
  }

  // ===== Joueur retiré qui revient =====
  // Pseudo exact d'un joueur retiré de la partie (majuscules ignorées), ou null : il était dans la
  // manche en cours au départ, ou a été retiré pendant une manche (actions « retrait »)
  function joueurRetire(partie, pseudo){
    const cherche = String(pseudo).toLocaleLowerCase("fr-FR");
    const memeNom = n => String(n).toLocaleLowerCase("fr-FR") === cherche;
    if (Object.keys(partie.joueurs || {}).some(memeNom)) return null; // toujours dans la partie

    const anciens = Object.values((partie.etatJeu && partie.etatJeu.joueurs) || {});
    Object.values(partie.manches || {}).forEach((manche) => {
      Object.values((manche && manche.actions) || {}).forEach((action) => {
        if (action && typeof action.id === "string" && action.id.startsWith("retrait:")) {
          anciens.push(action.id.split(":").slice(2).join(":"));
        }
      });
    });
    return anciens.find(memeNom) || null;
  }

  // Le joueur se remet une fiche dans la partie, puis rattrape la manche en cours en spectateur ;
  // à la fin du rattrapage, il demande à être remis dans le jeu (verifierRetourDansManche)
  function revenirApresRetrait(code, nom, partie){
    const enJeu = !!(partie.etatJeu && partie.etatJeu.demarree);
    const fiche = { nom, host: false, rejoint: Date.now() };

    window.fbSet(window.fbRef(window.firebaseDB, `parties/${code}/joueurs/${nom}`), fiche).then(() => {
      retourEnCours = enJeu;
      const joueursPartie = Object.assign({}, partie.joueurs, { [nom]: fiche });
      reprendrePlaceEnLigne(code, nom, Object.assign({}, partie, { joueurs: joueursPartie }));
    }).catch(erreurFirebase);
  }

  // Fiche effacée par le nettoyage d'un retrait arrivé en retard : on la remet
  function remettreFicheJoueur(){
    const code = codePartieActuel;
    const nom = pseudoActuel;
    if (!code || !nom) return;
    window.fbSet(window.fbRef(window.firebaseDB, `parties/${code}/joueurs/${nom}`),
      { nom, host: false, rejoint: Date.now() })
      .then(() => { if (codePartieActuel === code) suivrePresence(code, nom); })
      .catch(() => {});
  }

  // Retiré par un autre joueur : ce téléphone garde la partie en mémoire pour pouvoir y revenir
  function alerteRetire(code, nom){
    if (code && nom) {
      memoriserPartieLocale(code, nom);
      majBoutonRevenir();
    }
    alert("Tu as été retiré de la partie.\n\nPour y revenir : « Revenir dans une partie en cours ».");
  }

  function arreterRetour(){
    retourEnCours = false;
    retourEnvoye = false;
    retourAnnonce = false;
    clearTimeout(timerRetour);
    timerRetour = null;
  }

  // Quitte la partie (Accueil, ou Retour dans la salle d'attente)
  function quitterPartie(){
    const code = codePartieActuel;
    const pseudo = pseudoActuel;

    // Joueur retiré qui revenait, pas encore remis dans la manche : il repart sans arrêter la partie
    // (sa demande de retour déjà envoyée est annulée par un retrait juste derrière, si possible)
    if (enLigneActif && partieLancee && code && !joueurs.includes(pseudo)) {
      const annulation = retourEnvoye ? ecrireAction(idRetrait(pseudo)).catch(() => {}) : Promise.resolve();
      quitterPartieEnLigne();
      annulation.then(() => {
        window.fbSet(window.fbRef(window.firebaseDB, `parties/${code}/joueurs/${pseudo}`), null).catch(() => {});
      });
      return;
    }

    // En pleine partie à plus de 2 : on se retire seulement, la partie continue sans nous
    // (à 2, il ne resterait qu'un joueur : tout le monde repasse en salle d'attente)
    if (enLigneActif && partieLancee && joueurs.length > 2 && joueurs.includes(pseudo)) {
      ecrireAction(idRetrait(pseudo)).catch(() => {});
      quitterPartieEnLigne();
      return;
    }

    quitterPartieEnLigne();
    if (!code) return;

    retirerJoueur(code, pseudo, `${pseudo} a quitté la partie`).catch(erreurFirebase);
  }

  // Retire un joueur (soi-même ou un autre).
  // - Si c'est l'hôte (ou le dernier joueur) : la partie est supprimée => elle s'arrête pour tout le monde
  // - Sinon : il est retiré de la liste, et si une manche était en cours, tout le monde
  //   repasse en salle d'attente (la manche ne peut pas continuer sans lui)
  // Si deux joueurs retirent la même personne en même temps, la 2e suppression ne change rien.
  function retirerJoueur(code, nom, message){
    const refPartie = window.fbRef(window.firebaseDB, `parties/${code}`);

    return window.fbGet(refPartie).then((snapshot) => {
      const partie = snapshot.val();
      if (!partie || !partie.joueurs || !partie.joueurs[nom]) return; // déjà retiré

      const restants = Object.keys(partie.joueurs).filter(n => n !== nom);
      if (partie.hote === nom || restants.length === 0) {
        return window.fbRemove(refPartie);
      }

      const maj = { [`joueurs/${nom}`]: null };
      if (partie.etatJeu && partie.etatJeu.demarree) {
        maj.etatJeu = {
          demarree: false,
          manche: partie.etatJeu.manche,
          hote: partie.hote,
          message: message || `${nom} a été retiré de la partie`
        };
      }
      return window.fbUpdate(refPartie, maj);
    });
  }

  // La partie n'existe plus (l'hôte est parti ou a été retiré)
  function partieFermee(){
    const etaisHote = estHote;
    quitterPartieEnLigne();
    alert(etaisHote
      ? "Tu as été retiré de la partie.\nComme tu étais l'hôte, la partie est terminée."
      : "La partie est terminée : l'hôte l'a quittée ou a été retiré.");
  }

  function quitterPartieEnLigne(){
    // Diagnostic : où en était la partie au moment de la quitter (le journal est gardé après)
    if (codePartieActuel) {
      noterJournal(`partie ${codePartieActuel} quittée (manche ${mancheCourante}, prochaine action ${prochainSeq}, ` +
        `${fileActions.size} en file, ${traitementEnCours ? "une action en attente" : "rien en attente"})`);
    }
    if (desabonnerJoueurs) { desabonnerJoueurs(); desabonnerJoueurs = null; }
    if (desabonnerEtat) { desabonnerEtat(); desabonnerEtat = null; }
    libererEcran();
    if (desabonnerActions) { desabonnerActions(); desabonnerActions = null; }

    // Parti volontairement / retiré / partie fermée : plus de présence, plus rien à reprendre
    arreterPresence();
    oublierPartieLocale();
    majBoutonRevenir();
    arreterRetour();

    codePartieActuel = null;
    pseudoActuel = null;
    estHote = false;
    hotePartie = null;
    choisirModeSoftEnLigne(false);
    deconnectes = new Set();
    enLigneActif = false;
    mancheCourante = null;
    reinitialiserFileActions();
    reinitialiserEcransJeu();
    fermerConfirmationHote();

    document.getElementById("enLigne").style.display = "";
    document.getElementById("salleAttente").style.display = "none";
    document.getElementById("lancerPartieEnLigne").style.display = "none";
    document.getElementById("enLigneChoix").style.display = "";
  }

  // #endregion

  // #region Plateau, outils, joueurs, retirer un joueur en partie
  const plateau = document.getElementById("plateau");
  const joueurActif = document.getElementById("joueurActif");
  const listeJoueurs = document.getElementById("listeJoueurs");
  const regleZero = document.getElementById("regleZero");
  const reglePigeon = document.getElementById("reglePigeon");
  const messagesBar = document.getElementById("messages");

  const menu = document.getElementById("menu");
  const suppression = document.getElementById("suppression");
  const listeSuppression = document.getElementById("listeSuppression");

  const nomJoueurInput = document.getElementById("nomJoueur");
  const btnAjouter = document.getElementById("ajouterJoueur");
  const btnJouer = document.getElementById("jouer");
  const btnSupprimer = document.getElementById("supprimerJoueur");
  const btnNouvellePartie = document.getElementById("nouvellePartie");
  const btnTermine = document.getElementById("termineSuppression");
  const btnAccueilClassique = document.getElementById("btnAccueilClassique");
  const messageTexte = document.getElementById("messageTexte");
  let stickyJoueurActif = null;


  /* ====== Cartes du plateau principal ====== */
  const classes = [
    "zero_vert","zero_jaune","zero_rouge","zero_bleu",

    "un_vert","un_vert1","un_jaune","un_jaune1","un_rouge","un_rouge1","un_bleu","un_bleu1",

    "deux_vert","deux_vert1","deux_jaune","deux_jaune1","deux_rouge","deux_rouge1","deux_bleu","deux_bleu1",

    "trois_vert","trois_vert1","trois_jaune","trois_jaune1","trois_rouge","trois_rouge1","trois_bleu","trois_bleu1",

    "quatre_vert","quatre_vert1","quatre_jaune","quatre_jaune1","quatre_rouge","quatre_rouge1","quatre_bleu","quatre_bleu1",

    "cinq_vert","cinq_vert1","cinq_jaune","cinq_jaune1","cinq_rouge","cinq_rouge1","cinq_bleu","cinq_bleu1",

    "six_vert","six_vert1","six_jaune","six_jaune1","six_rouge","six_rouge1","six_bleu","six_bleu1",

    "sept_vert","sept_vert1","sept_jaune","sept_jaune1","sept_rouge","sept_rouge1","sept_bleu","sept_bleu1",

    "huit_vert","huit_vert1","huit_jaune","huit_jaune1","huit_rouge","huit_rouge1","huit_bleu","huit_bleu1",

    "neuf_vert","neuf_vert1","neuf_jaune","neuf_jaune1","neuf_rouge","neuf_rouge1","neuf_bleu","neuf_bleu1",

    "interdit_vert","interdit_jaune","interdit_rouge","interdit_bleu",

    "couleur","couleur1","couleur2","couleur3",

    "plus_2_vert","plus_2_vert1","plus_2_jaune","plus_2_jaune1",
    "plus_2_rouge","plus_2_rouge1","plus_2_bleu","plus_2_bleu1",

    "plus_4","plus_4_1","plus_4_2","plus_4_3",

    "switch_vert","switch_jaune","switch_rouge","switch_bleu"
  ];

  /* ====== DUEL: cartes retirées du plateau principal ====== */
  const duelCartes = [
    "deux_vert","deux_vert1","deux_jaune","deux_jaune1","deux_rouge","deux_rouge1","deux_bleu","deux_bleu1",

    "cinq_vert","cinq_vert1","cinq_jaune","cinq_jaune1","cinq_rouge","cinq_rouge1","cinq_bleu","cinq_bleu1",

    "six_vert","six_vert1","six_jaune","six_jaune1","six_rouge","six_rouge1","six_bleu","six_bleu1",

    "sept_vert","sept_vert1","sept_jaune","sept_jaune1","sept_rouge","sept_rouge1","sept_bleu","sept_bleu1",

    "huit_vert","huit_vert1","huit_jaune","huit_jaune1","huit_rouge","huit_rouge1","huit_bleu","huit_bleu1",

    "neuf_vert","neuf_vert1","neuf_jaune","neuf_jaune1","neuf_rouge","neuf_rouge1","neuf_bleu","neuf_bleu1"
  ];

  // Images des cartes chargées à l'avance (et gardées en mémoire) : sinon, avec un réseau lent,
  // la 1re fois qu'une carte sort, l'overlay s'affichait sans la carte le temps que l'image arrive
  let imagesCartes = null;
  function prechargerImagesCartes(){
    if(imagesCartes) return;
    const test = document.createElement("div");
    test.style.display = "none";
    document.body.appendChild(test);
    const urls = new Set();
    [...classes, "carte_doree"].forEach(c => {
      test.className = "Carte " + c;
      const m = getComputedStyle(test).backgroundImage.match(/url\("?([^")]+)"?\)/);
      if(m) urls.add(m[1]);
    });
    test.remove();
    imagesCartes = [...urls].map(url => { const img = new Image(); img.src = url; return img; });
  }
  window.addEventListener("load", () => setTimeout(prechargerImagesCartes, 300));

  let joueurs = [];
  let annulations = {}; // { "Alice": 3, "Bob": 0, ... }
  let paquet = [];

  // Easter egg : environ 1 partie sur 50, une des cases du plateau cache la carte dorée (à la place d'une carte normale)
  const CHANCE_CARTE_DOREE = 1 / 50;

  let indexCaseDoree = -1; // -1 = pas de carte dorée dans cette partie
  let carteDoreeEnJeu = false; // présente et pas encore retournée

  let paquetDuel = [];
  let duelEnCours = false;
  let duelMultiplicateur = 1;

  let indexJoueur = 0;
  let partieLancee = false;
  let lancementPartieA = 0;

  let indexPigeon = null;
  let nomPigeonOriginal = "";
  let choixPigeonEnCours = false;

  let zeroEnCours = false;
  let switchEnCours = false;
  let sensHoraire = true;

  let couleurChoisie = null;
  let carteTroisPourTransfertPigeon = "";
  let joueurTroisPourTransfertPigeon = null; // celui qui a tiré ce 3 (pour la gorgée couleur)
  let couleurTroisPourTransfertPigeon = null; // couleur à boire pour ce 3 (ou null)
  // Couleurs des cartes (affichage de la couleur choisie : bannière « Tour de » + bloc Règles)
  const COULEURS_JEU = { rouge: "#e53935", bleu: "#1e88e5", vert: "#43a047", jaune: "#fdd835" };

  // Affiche la couleur choisie TANT QU'ELLE EST ACTIVE (jusqu'à ce qu'une carte de cette couleur tombe) :
  // bannière « Tour de » teintée + petit rond + nom de la couleur, et nom dans le bloc Règles
  function majAffichageCouleur(){
    const hex = couleurChoisie ? (COULEURS_JEU[couleurChoisie] || "#FFD700") : null;
    const nomCouleur = couleurChoisie ? couleurChoisie.toUpperCase() : "";

    messageTexte.innerText = nomCouleur;
    messageTexte.style.color = hex || "#FFD700";

    if(!stickyJoueurActif) return;
    // Bannière : bleu plus foncé, pour ne pas le confondre avec le turquoise du pigeon
    // (texte du nom plus clair, pour rester lisible sur le fond sombre)
    const hexBanniere = couleurChoisie === "bleu" ? "#1d4ed8" : hex;
    const hexTexte = couleurChoisie === "bleu" ? "#9db9ff" : hex;
    stickyJoueurActif.classList.toggle("has-couleur", !!hex);
    if(hex){
      stickyJoueurActif.style.setProperty("--couleur-jeu", hexBanniere);
      stickyJoueurActif.style.setProperty("--couleur-jeu-texte", hexTexte);
    } else {
      stickyJoueurActif.style.removeProperty("--couleur-jeu");
      stickyJoueurActif.style.removeProperty("--couleur-jeu-texte");
    }

    const pastille = stickyJoueurActif.querySelector(".sticky-couleur");
    if(pastille) pastille.innerText = nomCouleur;
  }

  let phase = 1;       // 1 = choix J1, 2 = choix J2
  let choixJ1 = null;  // 1 ou 2 (carte de gauche/droite)
  let scrollLockCount = 0;
  let scrollYBeforeLock = 0;
  let finUnOverlayAffiche = false;

  // ===== Règle de fin: pari sur la dernière carte =====
  let predictionEnCours = false;
  let predictions = null; // Array<{ joueurIndex:number, typeId:string|null }>

  // Hasard utilisé pour mélanger : Math.random en classique, générateur à graine commune en ligne
  let aleatoire = Math.random;
  // Incrémenté à chaque relance : les callbacks d'overlays de l'ancienne partie sont ignorés
  let generationPartie = 0;

  let dernierTap = 0;
  let dernierTouchCount = 0;

  document.addEventListener("touchstart", (e) => {
    dernierTouchCount = e.touches.length;
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (dernierTouchCount > 1) return; // laisse le pinch zoom tranquille

    const maintenant = Date.now();
    const ecart = maintenant - dernierTap;

    // Deux taps rapprochés : on bloque le zoom, sauf sur ce qui se touche (champs, boutons, cartes...).
    // Ces éléments sont déjà protégés du zoom par le CSS (touch-action: manipulation) ; les bloquer ici
    // annulait leur clic (ex. une carte touchée juste après avoir fermé un overlay ne se retournait pas)
    const TOUCHABLES = "input, textarea, select, label, button, .Carte, .fin-choix-card, .carre-couleur, .supp-item";
    if (ecart > 0 && ecart < 300) {
      if (!e.target.closest(TOUCHABLES)) {
        e.preventDefault();
      }
    }

    dernierTap = maintenant;
  }, { passive: false });

  /* ===== OUTILS ===== */
  // Décidé AU TIRAGE (même résultat sur tous les téléphones en ligne) : si la carte est de la
  // couleur choisie, renvoie cette couleur et l'efface (elle ne compte qu'une fois). Sinon null.
  // Pas pour le +4 ni la carte couleur.
  function prendreCouleurSiBesoin(carteTiree){
    if(!couleurChoisie) return null;
    if(carteTiree.startsWith("plus_4") || carteTiree.startsWith("couleur")) return null;

    const colCarte = couleurDeLaCarte(carteTiree);
    if(!(colCarte && colCarte === couleurChoisie)) return null;

    couleurChoisie = null;
    majAffichageCouleur();
    return colCarte;
  }

  // Affiche la gorgée pour la couleur (options.couleur = résultat de prendreCouleurSiBesoin)
  function appliquerBonusCouleurSiBesoin(carteTiree, options = {}){
    const couleur = options.couleur;
    if(!couleur) return false;

    const preserveRuleMessage = !!options.preserveRuleMessage;
    // C'est toujours celui qui a tiré la carte qui boit pour la couleur : on le nomme
    // (sinon, après « Le PIGEON boit 1 gorgée », on croyait que c'était le pigeon)
    const nom = joueurs[options.joueur];
    const msgCouleur = (nom ? `${nom} boit` : "Et boit") + " 1 gorgée pour la couleur (" + couleur + ")";

    const afficher = () => {
      if(!preserveRuleMessage){
        regleZero.innerText = msgCouleur;
        regleZero.style.display = "block";
        zeroEnCours = true;
      }
      montrerOverlayRegle(msgCouleur, carteTiree);
    };

    if(options.afterRuleOverlay){
      executerApresOverlayRegleUnique(afficher);
    } else {
      afficher();
    }

    return true;
  }

  function lockScroll(){
    scrollLockCount++;
    if(scrollLockCount > 1) return;

    document.body.classList.add("overlay-open");
    // Fond de la page en noir le temps de l'overlay : couvre la bande réservée à la barre de défilement (PC)
    document.documentElement.classList.add("overlay-ouvert");

    // Sauve la position pour iOS
    scrollYBeforeLock = window.scrollY || document.documentElement.scrollTop || 0;
    // La place de la barre de défilement est déjà réservée en permanence (scrollbar-gutter: stable
    // sur html) : la compenser en plus décalait tout le contenu sur PC à chaque overlay.
    // On ne compense que sur les navigateurs qui ne gèrent pas scrollbar-gutter.
    const gutterStable = !!(window.CSS && CSS.supports && CSS.supports("scrollbar-gutter", "stable"));
    const sbw = gutterStable ? 0 : window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--sbw", (sbw > 0 ? sbw : 0) + "px");

    document.body.classList.add("no-scroll");
    document.body.style.top = `-${scrollYBeforeLock}px`;
  }

  function unlockScroll(){
    if(scrollLockCount <= 0) return;
    scrollLockCount--;
    if(scrollLockCount > 0) return;

    document.body.classList.remove("overlay-open");
    document.documentElement.classList.remove("overlay-ouvert");
    document.body.classList.remove("no-scroll");
    document.documentElement.style.removeProperty("--sbw");
    const top = document.body.style.top;
    document.body.style.top = "";

    const y = top ? Math.abs(parseInt(top, 10)) : scrollYBeforeLock;
    window.scrollTo(0, y);
  }

  // ===== Voile noir pendant les enchaînements d'overlays =====
  // Quand un overlay en remplace un autre (règle puis annulation, +4 validé puis « X boit »...),
  // le plateau réapparaissait une fraction de seconde entre les deux puis le noir revenait d'un coup :
  // effet de flash agressif. Ce voile reste noir tant qu'un overlay est affiché (ou qu'un autre
  // arrive juste après) et ne s'efface en fondu qu'à la fin de l'enchaînement.
  const voileOverlays = document.createElement("div");
  voileOverlays.id = "voileOverlays"; // (pas « overlay... » : nettoyerOverlays() ne doit pas le supprimer)
  document.body.appendChild(voileOverlays);
  let minuteurVoile = null;
  let apresTousOverlays = []; // fonctions à lancer une fois le plateau de nouveau visible

  function overlayOuvert(){
    return [...document.body.children].some(el => el.id.startsWith("overlay"));
  }

  function majVoileOverlays(){
    clearTimeout(minuteurVoile);
    if(overlayOuvert()){
      voileOverlays.classList.add("visible");
      return;
    }
    // Petit délai : laisse au prochain overlay de l'enchaînement le temps d'arriver
    minuteurVoile = setTimeout(() => {
      voileOverlays.classList.remove("visible");
      // Le plateau réapparaît en fondu : on attend qu'il soit bien visible
      const file = apresTousOverlays;
      apresTousOverlays = [];
      if(file.length) setTimeout(() => file.forEach(f => f()), delai(120));
    }, delai(90));
  }

  // Lance callback quand plus aucun overlay n'est affiché (tout de suite s'il n'y en a pas)
  function quandPlateauVisible(callback){
    if(!overlayOuvert() && !voileOverlays.classList.contains("visible")) callback();
    else apresTousOverlays.push(callback);
  }
  new MutationObserver(majVoileOverlays).observe(document.body, { childList: true });
  
  function centrerDerniereLigne(){
    const cards = Array.from(plateau.querySelectorAll(".Carte"));
    const total = cards.length;
    const cols = getCols();

    // reset (important sur resize)
    cards.forEach(c => c.style.gridColumnStart = "");

    const reste = total % cols;
    if(reste === 0) return;

    const start = Math.floor((cols - reste) / 2) + 1;
    const first = total - reste;

    // ⚠️ on décale TOUTES les cartes de la dernière ligne
    for(let i = 0; i < reste; i++){
      cards[first + i].style.gridColumnStart = String(start + i);
    }
  }

  
  function getCols(){
    const cols = getComputedStyle(document.documentElement)
      .getPropertyValue("--cols")
      .trim();
    return parseInt(cols, 10) || 8;
  }

  // ===== Helpers: type de carte (pour la règle de fin) =====
  function typeFromCardClass(carte){
    if(!carte) return "autre";
    if(carte.startsWith("zero")) return "zero";
    if(carte.startsWith("un_")) return "un";
    if(carte.startsWith("trois")) return "trois";
    if(carte.startsWith("quatre")) return "quatre";
    if(carte.startsWith("interdit")) return "interdit";
    if(carte.startsWith("couleur")) return "couleur";
    if(carte.startsWith("plus_2")) return "plus2";
    if(carte.startsWith("plus_4")) return "plus4";
    if(carte.startsWith("switch")) return "switch";
    return "autre";
  }

  const TYPES_PARIS = [
    { id: "zero",   label: "0",        rep: "zero_vert" },
    { id: "un",     label: "1",        rep: "un_vert" },
    { id: "trois",  label: "3",        rep: "trois_vert" },
    { id: "quatre", label: "4",        rep: "quatre_vert" },
    { id: "interdit", label: "Interdit", rep: "interdit_vert" },
    { id: "couleur", label: "Couleur", rep: "couleur" },
    { id: "plus2",  label: "+2",       rep: "plus_2_vert" },
    { id: "plus4",  label: "+4",       rep: "plus_4" },
    { id: "switch", label: "Switch",  rep: "switch_vert" },
  ];

  // ===== Helpers UI: centrage de la dernière ligne (grilles) =====
  function getFinCols(gridEl){
    if(!gridEl) return 3;
    const v = getComputedStyle(gridEl).getPropertyValue('--fin-cols').trim();
    return parseInt(v, 10) || 3;
  }

  function centrerDerniereLigneGrid(gridEl){
    if(!gridEl) return;
    const items = Array.from(gridEl.children);
    const total = items.length;
    const cols = getFinCols(gridEl);

    items.forEach(el => el.style.gridColumnStart = "");
    const reste = total % cols;
    if(reste === 0) return;

    const start = Math.floor((cols - reste) / 2) + 1;
    const first = total - reste;
    for(let i=0;i<reste;i++){
      items[first + i].style.gridColumnStart = String(start + i);
    }
  }

  function nomType(typeId){
    const t = TYPES_PARIS.find(x => x.id === typeId);
    return t ? t.label : typeId;
  }

  function nextPlayerIndex(fromIdx){
    if(joueurs.length === 0) return 0;
    return (fromIdx + (sensHoraire ? 1 : -1) + joueurs.length) % joueurs.length;
  }

  function creerCartePreview(className){
    const wrap = document.createElement("div");
    wrap.className = "Carte retournee " + className;
    return wrap;
  }

  // Cartes encore cachées sur le plateau (carte dorée comprise)
  function cartesRestantes(){
    return paquet.length + (carteDoreeEnJeu ? 1 : 0);
  }

  function lancerOverlayPrediction(startIndex){
    if(predictionEnCours) return;
    if(joueurs.length < 2) return;
    if(cartesRestantes() !== 1) return; // on doit être à l'avant-dernière carte tirée

    // La dernière carte cachée est la carte dorée : personne ne l'a trouvée
    const derniereEstDoree = carteDoreeEnJeu && paquet.length === 0;

    predictionEnCours = true;
    predictions = joueurs.map((_, idx) => ({ joueurIndex: idx, typeId: null }));

    // Nettoie un overlay règle s'il traîne (sécurité)
    const overlayRegle = document.getElementById("overlayRegleUnique");
    if(overlayRegle) overlayRegle.remove();

    lockScroll();

    const overlay = document.createElement("div");
    overlay.id = "overlayPredictionFin";
    overlay.className = "overlay-opaque";

    const panel = document.createElement("div");
    panel.className = "overlay-panel";

    const header = document.createElement("div");
    header.className = "prediction-header";

    const titre = document.createElement("div");
    titre.className = "titre-pigeon prediction-title";
    titre.innerText = "Pari sur la dernière carte";

    const subtitle = document.createElement("div");
    subtitle.className = "overlay-subtitle prediction-subtitle";
    subtitle.innerText = `Chacun choisit un type de carte. Tous ceux qui trouvent distribuent ${texteCulSec()} !`;

    header.appendChild(titre);
    header.appendChild(subtitle);

    const turn = document.createElement("div");
    turn.className = "fin-choix-turn";

    const recap = document.createElement("div");
    recap.className = "fin-choix-recap";

    const grid = document.createElement("div");
    grid.className = "fin-choix-grid";

    // Crée les cartes de choix (face découverte)
    TYPES_PARIS.forEach(t => {
      const cardWrap = document.createElement("div");
      cardWrap.className = "fin-choix-card";
      cardWrap.dataset.typeId = t.id;

      const preview = creerCartePreview(t.rep);
      cardWrap.appendChild(preview);

      surAction(cardWrap, "pred:" + t.id, {
        owner: () => curPos < ordre.length ? joueurs[ordre[curPos]] : null,
        pret: () => !cardWrap.classList.contains("disabled")
      }, () => {
        if(cardWrap.classList.contains("disabled")) return;
        const typeId = cardWrap.dataset.typeId;
        const cur = ordre[curPos];
        predictions[cur].typeId = typeId;
        curPos++;
        rafraichirUI();
      });

      grid.appendChild(cardWrap);
    });

    // Ordre de jeu pour la sélection
    const ordre = [];
    for(let k = 0; k < joueurs.length; k++){
      ordre.push((startIndex + (sensHoraire ? k : -k) + joueurs.length) % joueurs.length);
    }
    let curPos = 0;

    function rafraichirUI(){
      // recap
      recap.innerHTML = "";
      ordre.forEach((jIdx, i) => {
        const p = predictions[jIdx];
        const ligne = document.createElement("div");
        ligne.className = "ligne";
        const who = document.createElement("strong");
        who.innerText = joueurs[jIdx] + (i === curPos ? " ←" : "");
        const what = document.createElement("span");
        what.innerText = p.typeId ? nomType(p.typeId) : "—";
        ligne.appendChild(who);
        ligne.appendChild(what);
        recap.appendChild(ligne);
      });

      if(curPos < ordre.length){
        const jIdx = ordre[curPos];
        turn.innerText = `Au tour de ${joueurs[jIdx]} : choisis un type`;
      } else {
        // Révélation
        const lastCard = derniereEstDoree ? "carte_doree" : paquet[0];
        const vraiType = typeFromCardClass(lastCard);
        const gagnants = derniereEstDoree ? [] : ordre
          .map(jIdx => predictions[jIdx])
          .filter(p => p.typeId === vraiType)
          .map(p => joueurs[p.joueurIndex]);

        turn.innerText = "Révélation de la dernière carte";
        header.style.display = 'none';
        panel.classList.add('prediction-reveal-mode');

        // Désactive les cartes
        Array.from(grid.querySelectorAll('.fin-choix-card')).forEach(el => el.classList.add('disabled'));

        const reveal = document.createElement('div');
        reveal.className = 'fin-choix-reveal';

        const prev = creerCartePreview(
          derniereEstDoree ? "carte_doree" : (TYPES_PARIS.find(t=>t.id===vraiType)?.rep || lastCard)
        );
        reveal.appendChild(prev);

        const txt = document.createElement('div');
        txt.className = 'fin-choix-resultat';

        if(derniereEstDoree){
          // La dernière carte était la carte dorée : le pari est perdu pour tout le monde
          prev.classList.add("doree-carte-vedette");
          reveal.classList.add("reveal-doree");
          txt.innerHTML =
            '<div class="doree-titre"><span class="doree-etincelle">✦</span> PERSONNE N\'A TROUVÉ LA CARTE DORÉE !! <span class="doree-etincelle">✦</span></div>' +
            '<div class="doree-texte">' + texteDoreeJamaisTrouvee() + '</div>';
        } else if(gagnants.length === 0){
          txt.innerText = `Personne n'a trouvé \nLa dernière carte était ${nomType(vraiType)}`;
        } else if(gagnants.length === 1){
          txt.innerText = `${gagnants[0]} a trouvé ! Il/elle distribue ${texteCulSec()} !`;
        } else {
          txt.innerText = `${gagnants.join(', ')} ont trouvé ! Chacun distribue ${texteCulSec()} !`;
        }
        reveal.appendChild(txt);

        const btn = document.createElement('button');
        btn.className = 'bouton-pigeon';
        btn.innerText = 'Terminer';
        surAction(btn, "pred:terminer", { once: true, unique: true }, () => {
          if(overlay._cleanup) overlay._cleanup();
          overlay.remove();
          unlockScroll();
          predictionEnCours = false;

          // On considère la dernière carte comme "résolue" par le pari (sa règle ne s'applique pas) :
          // on la retire et on enchaîne directement sur l'écran de fin.
          if(derniereEstDoree){
            // Le cul sec collectif vient d'être annoncé : on retourne la carte dorée sur le plateau
            carteDoreeEnJeu = false;
            const caseDoree = plateau.children[indexCaseDoree];
            if(caseDoree){
              caseDoree.classList.remove("dos_dore");
              caseDoree.classList.add("carte_doree", "retournee");
            }
          } else if(paquet.length === 1){
            paquet.pop();
          }
          // Affiche systématiquement l'écran de fin (même si 0 "1 restant")
          finDePartie();
        });
        reveal.appendChild(btn);

        // remplace la grille par la révélation (garde recap au dessus)
        grid.replaceWith(reveal);
      }
    }

    panel.appendChild(header);
    panel.appendChild(turn);
    panel.appendChild(recap);
    panel.appendChild(grid);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Centre la dernière ligne (surtout utile quand la grille est en 3 colonnes sur mobile)
    const onResize = () => centrerDerniereLigneGrid(grid);
    window.addEventListener('resize', onResize);
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', onResize);
    }

    // Quand on quitte l'overlay, on nettoie le listener
    overlay._cleanup = () => {
      window.removeEventListener('resize', onResize);
      if(window.visualViewport){
        window.visualViewport.removeEventListener('resize', onResize);
      }
    };

    centrerDerniereLigneGrid(grid);

    rafraichirUI();
  }


  function melangerPaquet(array){
    for(let i=array.length-1;i>0;i--){
      const j=Math.floor(aleatoire()*(i+1));
      [array[i],array[j]]=[array[j],array[i]];
    }
  }

  function resetPaquetDuelSiBesoin(){
    if(paquetDuel.length === 0){
      paquetDuel = [...duelCartes];
      melangerPaquet(paquetDuel);
    }
  }

  function valeurCarteDuel(c){
    if(c.startsWith("deux")) return 2;
    if(c.startsWith("cinq")) return 5;
    if(c.startsWith("six")) return 6;
    if(c.startsWith("sept")) return 7;
    if(c.startsWith("huit")) return 8;
    if(c.startsWith("neuf")) return 9;
    return 0;
  }


  // Bannière « Tour de » : sous la barre d'infos, puis collée en haut de l'écran.
  // Avant, elle était toujours « fixe » et sa position recalculée à chaque évènement de défilement :
  // elle suivait la page avec un temps de retard (saccades). Maintenant :
  //  - tant que la barre d'infos est à l'écran, elle est posée dans la page (position absolue) et
  //    c'est le navigateur qui la fait défiler avec le reste, sans calcul ;
  //  - une fois arrivée en haut, elle passe en position fixe (CSS) et plus rien ne bouge.
  // Les styles ne sont réécrits que quand ils changent vraiment.
  let modeSticky = "";
  let topStickyPage = null;
  let hautMinSticky = null; // haut de l'écran + encoche (calculé une fois, refait au redimensionnement)

  function mesurerHautMinSticky(){
    const sonde = document.createElement("div");
    sonde.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;top:calc(env(safe-area-inset-top, 0px) + " +
      (window.innerWidth <= 520 ? 8 : 10) + "px)";
    document.body.appendChild(sonde);
    const haut = sonde.getBoundingClientRect().top;
    sonde.remove();
    return haut;
  }

  function repositionnerStickyJoueurActif(){
    if(!stickyJoueurActif || !messagesBar) return;
    if(hautMinSticky === null) hautMinSticky = mesurerHautMinSticky();

    const rect = messagesBar.getBoundingClientRect();
    const gap = window.innerWidth <= 520 ? 8 : 10;
    const ancre = Math.round(rect.bottom + gap); // position voulue, en haut de l'écran

    if(rect.height > 0 && ancre > hautMinSticky){
      // Position dans la page (pendant un overlay, la page est décalée sur body : même calcul)
      const origine = document.body.classList.contains("no-scroll")
        ? document.body.getBoundingClientRect().top
        : document.documentElement.getBoundingClientRect().top;
      const top = Math.round(ancre - origine);
      if(modeSticky !== "page" || top !== topStickyPage){
        modeSticky = "page";
        topStickyPage = top;
        stickyJoueurActif.classList.add("dans-la-page");
        stickyJoueurActif.style.top = top + "px";
      }
    } else if(modeSticky !== "colle"){
      modeSticky = "colle";
      topStickyPage = null;
      stickyJoueurActif.classList.remove("dans-la-page");
      stickyJoueurActif.style.top = "";
    }
  }

  function creerUIJoueurActifSticky(){
    if(document.getElementById("stickyJoueurActif")) return;

    stickyJoueurActif = document.createElement("div");
    stickyJoueurActif.id = "stickyJoueurActif";
    stickyJoueurActif.setAttribute("aria-live", "polite");
    stickyJoueurActif.innerHTML = `
      <span class="sticky-label">Tour de</span>
      <span class="sticky-valeur">
        <span class="sticky-nom">—</span>
        <span class="sticky-bonus"></span>
      </span>
      <span class="sticky-couleur"></span>
    `;

    document.body.appendChild(stickyJoueurActif);
    repositionnerStickyJoueurActif();
  }

  function majStickyJoueurActif(){
    if(!stickyJoueurActif) return;

    repositionnerStickyJoueurActif();

    const labelEl = stickyJoueurActif.querySelector(".sticky-label");
    const nomEl = stickyJoueurActif.querySelector(".sticky-nom");
    const bonusEl = stickyJoueurActif.querySelector(".sticky-bonus");
    labelEl.innerText = "Tour de";

    if(!partieLancee || joueurs.length === 0 || choixPigeonEnCours || duelEnCours){
      stickyJoueurActif.classList.remove("visible", "is-pigeon", "has-bonus");
      nomEl.innerText = "—";
      bonusEl.innerText = "";
      return;
    }

    const idx = indexJoueur % joueurs.length;
    const nom = joueurs[idx];
    const n = Number(annulations[nom] || 0);
    const estPigeon = idx === indexPigeon;

    nomEl.innerText = estPigeon ? `PIGEON (${avecCouronne(nom)})` : avecCouronne(nom);
    ajouterBadgeDeconnecte(nomEl, !!texteDeconnecte(nom));
    bonusEl.innerText = n > 0 ? `+${n}` : "";
    if(enLigneActif && nom === pseudoActuel){
      labelEl.innerText = "À toi !";
      // Vibre une seule fois par tour (un tour = un nombre de cartes restantes dans la manche)
      const tour = `${mancheCourante}:${cartesRestantes()}`;
      if(tour !== dernierTourVibre){
        dernierTourVibre = tour;
        vibrer([70, 60, 70]);
        jouerSon("tour");
      }
    }

    stickyJoueurActif.classList.toggle("is-pigeon", estPigeon);
    stickyJoueurActif.classList.toggle("has-bonus", n > 0);
    stickyJoueurActif.classList.add("visible");
  }

  // Un nom de joueur inséré dans du HTML doit passer par ici : sinon un pseudo comme
  // <img src=x onerror=...> exécuterait du code chez tous les joueurs (mode en ligne)
  function echapperHtml(texte){
    return String(texte)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // En ligne : mention ajoutée au nom d'un joueur déconnecté (vide sinon)
  function texteDeconnecte(nom){
    return enLigneActif && deconnectes.has(nom) ? " (déconnecté(e))" : "";
  }

  function badgeDeconnecte(nom){
    return texteDeconnecte(nom) ? ` <span class="joueur-deconnecte">déconnecté(e)</span>` : "";
  }

  // Même mention (rouge, en italique, plus petite), ajoutée à un élément affiché en texte
  function ajouterBadgeDeconnecte(el, deconnecte){
    if(!deconnecte) return;
    const badge = document.createElement("span");
    badge.className = "joueur-deconnecte";
    badge.innerText = "déconnecté(e)";
    el.appendChild(badge);
  }

  function afficherJoueurs(){
    listeJoueurs.innerHTML = joueurs.map((j,i)=>{
      const n = Number(annulations[j] || 0);
      const bonus = n > 0 ? ` <span class="bonus-annulation">+${n}</span>` : "";

      if(i === indexPigeon){
        return `<div class="joueur-ligne joueur-ligne-pigeon"><strong>PIGEON</strong> (${echapperHtml(avecCouronne(nomPigeonOriginal))})${bonus}${badgeDeconnecte(j)}</div>`;
      }

      return `<div class="joueur-ligne">${echapperHtml(avecCouronne(j))}${bonus}${badgeDeconnecte(j)}</div>`;
    }).join("");

    if(!partieLancee){
      btnJouer.style.display = joueurs.length >= 2 ? "inline-block" : "none";
    }
    majBoutonsJoueurs();
    majStickyJoueurActif();
  }

  // Supprimer : avant la partie (classique) dès qu'il y a un joueur, pendant la partie s'il en reste plus de 2.
  // Ajouter : seulement avant la partie (en ligne, les joueurs viennent de la salle d'attente).
  function majBoutonsJoueurs(){
    const supprimer = partieLancee ? joueurs.length > 2 : (!enLigneActif && joueurs.length > 0);
    btnSupprimer.style.display = supprimer ? "inline-block" : "none";
    nomJoueurInput.style.display = partieLancee ? "none" : "";
    btnAjouter.style.display = partieLancee ? "none" : "";
  }


  function afficherJoueurActif(){
    if(!partieLancee || choixPigeonEnCours || duelEnCours || joueurs.length === 0){
      joueurActif.innerText = "";
      majStickyJoueurActif();
      return;
    }

    const idx = indexJoueur % joueurs.length;
    const nom = joueurs[idx];
    const n = Number(annulations[nom] || 0);
    const libelle = idx === indexPigeon ? `PIGEON (${avecCouronne(nom)})` : avecCouronne(nom);
    const bonus = n > 0 ? ` +${n}` : "";
    joueurActif.innerText = "Joueur actif : " + libelle + bonus;
    ajouterBadgeDeconnecte(joueurActif, !!texteDeconnecte(nom));

    majStickyJoueurActif();
  }

  function effacerMessagePigeon(){
    reglePigeon.innerText = "";
    reglePigeon.style.display = "none";
  }

  /* ===== JOUEURS ===== */
  function ajouterJoueur(){
    if(partieLancee) return; // pas de nouveau joueur en pleine partie
      let nom = nomJoueurInput.value;

    // Normalisation robuste : trim + espaces multiples -> 1 + lower
    nom = nom.replace(/\s+/g, " ").trim();
    if(!nom) return;

    const key = nom.toLocaleLowerCase("fr-FR");

    if (joueurs.some(j => (j || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr-FR") === key)) {
        nomJoueurInput.value = "";
        return;
    }

    joueurs.push(nom);
    nomJoueurInput.value = "";
    afficherJoueurs();
}


  btnAjouter.addEventListener("pointerdown", (e) => {
    // Clavier ouvert : il reste ouvert pour le joueur suivant (sinon le champ perd le focus à chaque ajout)
    if (document.activeElement === nomJoueurInput) e.preventDefault();
    ajouterJoueur();
  });
  nomJoueurInput.addEventListener("keydown", e=>{ if(e.key==="Enter") ajouterJoueur(); });

  const titreSuppression = suppression.querySelector("h2");

  // "click" (et pas pointerdown) : sinon le doigt relevé coche/choisit tout de suite le joueur placé dessous
  btnSupprimer.addEventListener("click", ()=>{
    if(partieLancee){
      ouvrirRetraitEnJeu();
      return;
    }
    titreSuppression.innerText = "Supprimer un ou plusieurs joueurs";
    btnTermine.innerText = "Terminé";
    menu.style.display="none";
    suppression.style.display="flex";
    lockScroll();
    listeSuppression.innerHTML="";
    joueurs.forEach((j,i)=>{
      const ligne = document.createElement("div");

      ligne.innerHTML = `
        <label class="supp-item">
          <input class="supp-check" type="checkbox" value="${i}">
          <span class="supp-name">${echapperHtml(j)}</span>
        </label>
      `;

      listeSuppression.appendChild(ligne);
    });
  });

  btnTermine.addEventListener("click", ()=>{
    const toDelete=[...listeSuppression.querySelectorAll("input:checked")]
      .map(cb=>parseInt(cb.value,10)).sort((a,b)=>b-a);
    toDelete.forEach(i=>{
      const name = joueurs[i];
      joueurs.splice(i,1);
      // si pigeon supprimé ou liste vide
      if (joueurs.length === 0) {
        indexPigeon = null;
      } else if (indexPigeon != null) {
        // si on a supprimé quelqu’un avant l’index pigeon, il faut le décaler
        // (le plus safe : retrouver par nom si tu gardes nomPigeonOriginal)
        const newIdx = joueurs.indexOf(nomPigeonOriginal);
        indexPigeon = newIdx >= 0 ? newIdx : null;
      }
      // sécurise indexJoueur
      if (joueurs.length > 0) indexJoueur = ((indexJoueur % joueurs.length) + joueurs.length) % joueurs.length;

      if(name != null) delete annulations[name];
    });
    suppression.style.display="none";
    menu.style.display="flex";
    unlockScroll();
    afficherJoueurs();
  });

  /* ===== RETIRER UN JOUEUR PENDANT LA PARTIE ===== */
  // Seulement plateau au repos : aucun overlay, aucun choix en cours, pas pendant le pari de fin
  // (il reste alors 1 carte). En ligne, c'est vérifié à nouveau sur chaque téléphone au moment du retrait.
  function plateauLibre(){
    return partieLancee && !choixPigeonEnCours && !duelEnCours && !predictionEnCours &&
      cartesRestantes() !== 1 && !document.querySelector('[id^="overlay"]');
  }

  function ouvrirRetraitEnJeu(){
    if(joueurs.length <= 2){
      afficherToast("Il faut au moins 3 joueurs pour en retirer un");
      return;
    }
    if(!plateauLibre()){
      afficherToast("Attends la fin de l'action en cours");
      return;
    }

    titreSuppression.innerText = "Retirer un joueur de la partie";
    btnTermine.innerText = "Annuler";
    listeSuppression.innerHTML = "";
    joueurs.forEach((nom) => {
      const bouton = document.createElement("button");
      bouton.type = "button";
      bouton.className = "supp-item supp-retrait";
      bouton.innerHTML = `<span class="supp-name">${echapperHtml(avecCouronne(nom))}</span>${badgeDeconnecte(nom)}`;
      bouton.addEventListener("click", () => demanderConfirmationRetrait(nom));
      listeSuppression.appendChild(bouton);
    });

    menu.style.display = "none";
    suppression.style.display = "flex";
    lockScroll();
  }

  const ecranConfirmerRetrait = document.getElementById("ecranConfirmerRetrait");
  let retraitEnAttente = null;

  function demanderConfirmationRetrait(nom){
    retraitEnAttente = nom;
    document.getElementById("titreConfirmerRetrait").innerText = `Retirer ${nom} de la partie ?`;

    let texte = "La partie continue sans lui/elle.";
    if(enLigneActif && nom === pseudoActuel){
      texte = "Tu vas quitter la partie. Elle continuera sans toi.";
    } else if(enLigneActif && nom === hotePartie){
      const i = joueurs.indexOf(nom);
      texte = `C'est l'hôte : le rôle d'hôte passera à ${joueurs[(i + 1) % joueurs.length]}.\nLa partie continue sans lui/elle.`;
    }
    document.getElementById("texteConfirmerRetrait").innerText = texte;
    ecranConfirmerRetrait.style.display = "";
  }

  function fermerRetraitEnJeu(){
    retraitEnAttente = null;
    ecranConfirmerRetrait.style.display = "none";
    if(suppression.style.display !== "none"){
      suppression.style.display = "none";
      menu.style.display = "flex";
      unlockScroll();
    }
  }

  document.getElementById("btnConfirmerRetraitNon").addEventListener("click", () => {
    retraitEnAttente = null;
    ecranConfirmerRetrait.style.display = "none";
  });

  document.getElementById("btnConfirmerRetraitOui").addEventListener("click", () => {
    const nom = retraitEnAttente;
    fermerRetraitEnJeu();
    if(!nom || !joueurs.includes(nom)) return;
    if(joueurs.length <= 2){
      afficherToast("Il faut au moins 3 joueurs pour en retirer un");
      return;
    }
    if(!plateauLibre()){
      afficherToast("Une action vient de commencer : réessaie juste après");
      return;
    }

    if(!enLigneActif){
      retirerJoueurEnJeu(nom);
      afficherToast(`${nom} a été retiré de la partie`);
      return;
    }

    const moiMeme = nom === pseudoActuel;
    ecrireAction(idRetrait(nom))
      .then(() => {
        // Retrait de soi-même : on part tout de suite (si le retrait n'a pas déjà été appliqué ici)
        if(!moiMeme || !codePartieActuel) return;
        quitterPartieEnLigne();
        allerAccueil();
      })
      .catch(() => afficherToast("Connexion perdue, réessaie"));
  });

  // Applique le retrait (identique sur tous les téléphones en ligne). Le tour, le pigeon, ses « 1 » et
  // l'hôte sont mis à jour ; les overlays sont fermés à ce moment-là, rien d'autre ne dépend de lui.
  function retirerJoueurEnJeu(nom){
    const idx = joueurs.indexOf(nom);
    if(idx < 0 || joueurs.length <= 2) return false;

    const courant = indexJoueur % joueurs.length;
    joueurs.splice(idx, 1);
    delete annulations[nom];
    const n = joueurs.length;

    if(indexPigeon !== null){
      if(indexPigeon === idx){
        // Plus de pigeon : le prochain qui tire un 3 le devient, comme en début de partie
        indexPigeon = null;
        nomPigeonOriginal = "";
        effacerMessagePigeon();
      } else if(indexPigeon > idx){
        indexPigeon--;
      }
    }

    // C'était son tour : il passe au suivant, dans le sens du jeu
    if(idx < courant) indexJoueur = courant - 1;
    else if(idx > courant) indexJoueur = courant;
    else indexJoueur = sensHoraire ? idx % n : (idx - 1 + n) % n;

    if(enLigneActif && nom === hotePartie) hotePartie = joueurs[idx % n];

    afficherJoueurs();
    afficherJoueurActif();
    return true;
  }

  // Carte dorée jamais retournée : elle se révèle et tout le monde prend un cul sec avant l'écran de fin
  function finDePartie(){
    if(!carteDoreeEnJeu){
      afficherOverlayFinUnRestants();
      return;
    }

    carteDoreeEnJeu = false;
    const caseDoree = plateau.children[indexCaseDoree];
    if(caseDoree){
      caseDoree.classList.remove("dos_dore");
      caseDoree.classList.add("carte_doree", "retournee");
    }

    const texte = texteDoreeJamaisTrouvee();
    montrerOverlayRegle(`Personne n'a trouvé la CARTE DORÉE !!\n${texte}`, "carte_doree");
    habillerOverlayCarteDoree(
      texte,
      '<span class="doree-etincelle">✦</span> PERSONNE N\'A TROUVÉ LA CARTE DORÉE !! <span class="doree-etincelle">✦</span>'
    );
    executerApresOverlayRegleUnique(afficherOverlayFinUnRestants);
  }

  // #endregion

  // #region Overlays des règles : pigeon, annonces, annulations, carte dorée
  /* ===== PIGEON OVERLAY ===== */
  function afficherOverlayFinUnRestants(){
    if(finUnOverlayAffiche) return;
    finUnOverlayAffiche = true;

    // joueurs qui ont encore des "un" stockés
    const restants = joueurs
      .map(nom => ({ nom, n: Number(annulations[nom] || 0) }))
      .filter(x => x.n > 0);

    // Même s'il n'y a aucun "1" restant, on affiche quand même l'écran de fin.

    // on évite de superposer des overlays
    const overlayRegle = document.getElementById("overlayRegleUnique");
    if(overlayRegle) overlayRegle.remove(); // fin de partie => on nettoie

    lockScroll();

    const overlay = document.createElement("div");
    overlay.id = "overlayFinUnRestants";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "9999";
    overlay.style.backgroundColor = "rgb(0,0,0)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.padding = "24px";
    overlay.style.gap = "18px";

    const titre = document.createElement("div");
    titre.className = "titre-pigeon";
    titre.innerText = "FIN DE LA PARTIE";
    overlay.appendChild(titre);

    const bloc = document.createElement("div");
    bloc.className = "fin-un-lignes";

    if(restants.length === 0){
      const ligne = document.createElement("div");
      ligne.className = "fin-un-ligne";
      ligne.innerText = "Aucun 1 restant à boire.";
      bloc.appendChild(ligne);
    } else {
      restants.forEach(x => {
        const ligne = document.createElement("div");
        ligne.className = "fin-un-ligne";
        ligne.innerText = `${x.nom} doit boire ${x.n} gorgée(s) pour ses 1 restants`;
        bloc.appendChild(ligne);
      });
    }

    overlay.appendChild(bloc);

    const btnTerminer = document.createElement("button");
    btnTerminer.className = "bouton-pigeon";
    btnTerminer.innerText = "Terminer";

    surAction(btnTerminer, "fin:terminer", { once: true, unique: true }, () => {
      // ils boivent leurs "1 restants" => on remet les compteurs à 0
      restants.forEach(x => { annulations[x.nom] = 0; });
      afficherJoueurs();

      overlay.remove();
      unlockScroll();
    });

    overlay.appendChild(btnTerminer);
    document.body.appendChild(overlay);
  }

  function afficherMenuPigeon(){
    if(document.getElementById("overlayPigeon")) return;
    choixPigeonEnCours=true;
    lockScroll();

    const overlay=document.createElement("div");
    overlay.id="overlayPigeon";
    ajouterCarteVedette(overlay, carteTroisPourTransfertPigeon);

    const titre=document.createElement("div");
    titre.className="titre-pigeon";
    titre.innerText="Choisis le nouveau PIGEON";
    overlay.appendChild(titre);

    // C'est le pigeon actuel (celui qui vient de tirer le 3) qui choisit
    const choisisseur = joueurs[indexPigeon];

    joueurs.forEach((j,i)=>{
      if(i!==indexPigeon){
        const btn=document.createElement("button");
        btn.className="bouton-pigeon";
        btn.innerText=j;
        surAction(btn, "pigeon:" + i, { owner: choisisseur, once: true }, ()=>{
        indexPigeon = i;
        nomPigeonOriginal = joueurs[i];
        // 1) on ferme l'overlay de choix
        unlockScroll();
        overlay.remove();
        choixPigeonEnCours = false;
        afficherJoueurs();
        afficherJoueurActif();
        // 2) message demandé (overlay + .messages)
        const nPigeon = gorgeesPigeon();
        const msg = `${joueurs[i]} est le nouveau PIGEON !\nIl/elle boit ${texteGorgees(nPigeon)} pour fêter ça.`;
        // .messages : on l'affiche dans reglePigeon (et il disparaît au prochain tirage)
        // 3) overlay + annulation si compteur (utilise la carte "trois" qui a déclenché le transfert)
        const carteTrois = carteTroisPourTransfertPigeon || "trois_vert";
        const joueurTrois = joueurTroisPourTransfertPigeon;
        const couleurTrois = couleurTroisPourTransfertPigeon;
        annoncerBoireAvecAnnulation(
          i,
          nPigeon,
          carteTrois,
          msg,
          // puis la gorgée couleur éventuelle de celui qui a tiré le 3
          () => appliquerBonusCouleurSiBesoin(carteTrois, { couleur: couleurTrois, joueur: joueurTrois, preserveRuleMessage: true })
        );
        reglerDureeOverlayRegle(msg, DUREE_ANNONCE_PIGEON); // annonce du pigeon : affichée 2 fois plus longtemps
        jouerSon("pigeon");
        // optionnel : on nettoie
        carteTroisPourTransfertPigeon = "";
        joueurTroisPourTransfertPigeon = null;
        couleurTroisPourTransfertPigeon = null;
      });

        overlay.appendChild(btn);
      }
    });

    document.body.appendChild(overlay);
  }

  function dureeOverlaySelonNbLignes(nb){
    // Base légèrement augmentée pour laisser le temps de lire sans ralentir le jeu.
    return 1700 + Math.max(0, nb - 1) * 850;
  }

  function estimerNbLignesOverlay(message){
    const texte = String(message || "").trim();
    if(!texte) return 1;

    const largeur = window.innerWidth || 390;
    const caracteresParLigne =
      largeur <= 380 ? 16 :
      largeur <= 520 ? 20 :
      largeur <= 720 ? 26 : 34;

    return texte
      .split(/\n+/)
      .reduce((total, ligne) => {
        const propre = ligne.trim();
        if(!propre) return total + 1;
        return total + Math.max(1, Math.ceil(propre.length / caracteresParLigne));
      }, 0);
  }

  // Disparition des overlays : fondu doux (avant : rétrécissement à 80 % en même temps, trop brutal).
  // Il bloque les taps jusqu'au bout : certaines règles enchaînent un écran juste après (annulations).
  // Même durée qu'avant (0,3 s) : l'ordre d'enchaînement des écrans ne change pas.
  const DUREE_SORTIE_OVERLAY = 300;
  function animerSortieOverlay(overlay){
    overlay.style.transition = `opacity ${DUREE_SORTIE_OVERLAY}ms ease-out, transform ${DUREE_SORTIE_OVERLAY}ms ease-out`;
    overlay.style.opacity = "0";
    overlay.style.transform = "scale(0.98)";
  }

  // Appelle callback UNE fois : à la fin de la transition de l'élément, ou au plus tard après `ms`.
  // Sécurité : si la transition n'a pas lieu (ex. fermeture juste avant la fin de l'apparition),
  // "transitionend" n'arrive jamais et l'overlay resterait bloqué à l'écran.
  function apresTransition(el, ms, callback){
    let fait = false;
    const fin = () => {
      if (fait) return;
      fait = true;
      // Overlay déjà retiré par une nouvelle partie : on n'enchaîne pas sur la suite de l'ancienne
      if (!el.isConnected) return;
      callback();
    };
    el.addEventListener("transitionend", fin, { once: true });
    setTimeout(fin, delai(ms) + 80);
  }

  // Délai du jeu (overlays, duel...) : quasi nul pendant le rattrapage d'une reconnexion.
  // Minimum 60 ms : laisse le temps à l'overlay d'apparaître (requestAnimationFrame) avant de se fermer.
  function delai(ms){
    return rattrapageEnCours ? Math.min(ms, 60) : ms;
  }

  function dureeOverlayPourMessage(message){
    if(rattrapageEnCours) return delai(0);
    const texte = String(message || "").trim();
    const nbLignes = estimerNbLignesOverlay(texte);
    const nbMots = texte ? texte.split(/\s+/).filter(Boolean).length : 0;

    const duree =
      dureeOverlaySelonNbLignes(nbLignes) +
      Math.max(0, nbMots - 5) * 45;

    return Math.min(4300, Math.max(1800, duree));
  }

  /* ===== Overlay animé pour toutes les cartes spéciales ===== */
  let overlayRegleTimeout = null;
  // ===== Annulation de gorgées (carte "un") =====
  let overlayRegleVerrouille = false; // si true => overlayRegleUnique ne s'auto-ferme pas

  function fermerOverlayRegleUnique(afterClose = null){
    const overlay = document.getElementById("overlayRegleUnique");
    if(!overlay) {
      if(typeof afterClose === "function") afterClose();
      return;
    }

    overlayRegleVerrouille = false;

    if (overlayRegleTimeout) {
      clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = null;
    }

    // Déjà en train de se fermer (tap + minuteur) : une seule fermeture
    if (overlay.dataset.enFermeture) return;
    overlay.dataset.enFermeture = "1";

    animerSortieOverlay(overlay);
    apresTransition(overlay, DUREE_SORTIE_OVERLAY, () => {
      if (!overlay.dataset.enFermeture) return; // une nouvelle annonce l'a réutilisé entre-temps
      overlay.remove();
      unlockScroll();
      if(typeof afterClose === "function") afterClose();
    });
  }

  function executerApresOverlayRegleUnique(callback){
    const overlay = document.getElementById("overlayRegleUnique");
    if(!overlay){
      callback();
      return;
    }

    const generation = generationPartie;
    const obs = new MutationObserver(() => {
      const stillThere = document.getElementById("overlayRegleUnique");
      if(!stillThere){
        obs.disconnect();
        if(generation === generationPartie) callback();
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  function joueurPeutAnnuler(joueurIndex, nbGorgees){
    const nom = joueurs[joueurIndex];
    const dispo = Number(annulations[nom] || 0);
    return Math.min(dispo, nbGorgees) > 0;
  }

  function afficherOverlayResultatAnnulation(message, afterClose = null){
    if(document.getElementById("overlayResultatAnnulation")) return false;

    lockScroll();

    const overlay = document.createElement("div");
    overlay.id = "overlayResultatAnnulation";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "10001";
    overlay.style.backgroundColor = "rgb(0,0,0)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.padding = "20px";
    overlay.style.textAlign = "center";
    overlay.style.color = "#FFD700";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    overlay.style.transform = "scale(0.96)";
    overlay.style.gap = "16px";
    overlay.style.overflowY = "auto";
    overlay.style.webkitOverflowScrolling = "touch";

    const texte = document.createElement("div");
    texte.innerText = message;
    texte.style.fontSize = "clamp(22px, 5vw, 42px)";
    texte.style.fontWeight = "900";
    texte.style.textShadow = "2px 2px 5px #000";
    texte.style.maxWidth = "min(820px, 92vw)";
    overlay.appendChild(texte);

    let enFermeture = false;
    const fermer = () => {
      if(enFermeture) return; // tap + minuteur : une seule fermeture
      enFermeture = true;
      animerSortieOverlay(overlay);
      apresTransition(overlay, DUREE_SORTIE_OVERLAY, () => {
        overlay.remove();
        unlockScroll();
        if(typeof afterClose === "function") afterClose();
      });
    };

    overlay.style.cursor = "pointer";
    overlay.addEventListener("pointerdown", fermer);

    document.body.appendChild(overlay);
    getComputedStyle(overlay).opacity; // départ du fondu bien pris en compte (sinon il apparaissait d'un coup)
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    });

    setTimeout(fermer, dureeOverlayPourMessage(message));
    return true;
  }

  function afficherOverlayAnnulation(joueurIndex, nbGorgees, onDone = null, afterClose = null){
    const nom = joueurs[joueurIndex];
    const dispo = Number(annulations[nom] || 0);
    const maxAnnulable = Math.min(dispo, nbGorgees);

    if(maxAnnulable <= 0){
      if(typeof afterClose === "function") afterClose();
      return false;
    }

    if(document.getElementById("overlayAnnulation")) return true;

    lockScroll();

    const overlay = document.createElement("div");
    overlay.id = "overlayAnnulation";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "10000";
    overlay.style.backgroundColor = "rgb(0,0,0)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.padding = "20px";
    overlay.style.textAlign = "center";
    overlay.style.color = "#FFD700";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.25s ease, transform 0.25s ease";
    overlay.style.transform = "scale(0.96)";
    overlay.style.gap = "16px";
    overlay.style.overflowY = "auto";
    overlay.style.webkitOverflowScrolling = "touch";

    const titre = document.createElement("div");
    titre.innerText = `${nom}, tu as +${dispo} annulation(s).`;
    titre.style.fontSize = "clamp(24px, 5vw, 46px)";
    titre.style.fontWeight = "900";
    titre.style.textShadow = "2px 2px 5px #000";
    overlay.appendChild(titre);

    const sousTitre = document.createElement("div");
    sousTitre.innerText = "Combien de gorgées veux-tu annuler ?";
    sousTitre.style.fontSize = "clamp(18px, 4vw, 28px)";
    sousTitre.style.fontWeight = "800";
    sousTitre.style.maxWidth = "min(780px, 92vw)";
    overlay.appendChild(sousTitre);

    const boutons = document.createElement("div");
    boutons.style.display = "flex";
    boutons.style.flexWrap = "wrap";
    boutons.style.justifyContent = "center";
    boutons.style.gap = "14px";
    boutons.style.width = "min(760px, 92vw)";
    overlay.appendChild(boutons);

    let enFermeture = false;
    const fermer = (callback = null) => {
      if(enFermeture) return;
      enFermeture = true;
      animerSortieOverlay(overlay);
      apresTransition(overlay, DUREE_SORTIE_OVERLAY, () => {
        overlay.remove();
        unlockScroll();
        if(typeof callback === "function"){
          callback();
        } else if(typeof afterClose === "function"){
          afterClose();
        }
      });
    };

    for(let i=0; i<=maxAnnulable; i++){
      const btn = document.createElement("button");
      btn.className = "bouton-annulation";
      btn.innerText = `Annuler ${i}`;
      btn.style.width = "min(420px, 92vw)";
      btn.style.padding = "clamp(12px, 3.2vw, 22px)";
      btn.style.fontSize = "clamp(16px, 4vw, 28px)";
      btn.style.fontWeight = "800";
      btn.style.border = "none";
      btn.style.borderRadius = "12px";
      btn.style.backgroundColor = "#FFD700";
      btn.style.color = "#000";
      btn.style.cursor = "pointer";
      btn.style.boxShadow = "0 10px 24px rgba(0,0,0,0.28)";

      surAction(btn, `annul:${nom}:${i}`, { owner: nom, once: true }, () => {
        // Overlay en train de se fermer : ses autres boutons ne doivent plus recevoir d'action
        overlay.dataset.netFerme = "1";
        const utilise = i;
        const reste = nbGorgees - utilise;
        const messageResultat = utilise > 0
          ? `${utilise} gorgée(s) annulée(s). \nTu bois ${reste} gorgée(s).`
          : `Tu n’annules rien. \nTu bois ${reste} gorgée(s).`;

        annulations[nom] = Math.max(0, dispo - utilise);
        afficherJoueurs();
        afficherJoueurActif();

        if(typeof onDone === "function") onDone(utilise, reste);

        fermer(() => {
          afficherOverlayResultatAnnulation(messageResultat, afterClose);
        });
      });

      boutons.appendChild(btn);
    }

    document.body.appendChild(overlay);
    getComputedStyle(overlay).opacity; // départ du fondu bien pris en compte (sinon il apparaissait d'un coup)
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    });

    return true;
  }

  // Annonce "X boit N" + propose annulation si dispo
  function annoncerBoireAvecAnnulation(joueurIndex, nbGorgees, classeCarte = "", prefixMsg = null, onFinish = null){
    const nom = joueurs[joueurIndex];
    const msg = prefixMsg ? prefixMsg : `${nom} boit ${nbGorgees} gorgée(s)`;

    if (nbGorgees > 15) {
      // Easter egg : message signé Célien, mise en forme premium
      const citationCelien = "Et interdit de vomir, c'est pas fini !";
      const signatureCelien = "Signé Célien, un des créateurs du jeu";
      const message17 = `${citationCelien}\n${signatureCelien}`;

      montrerOverlayRegle(`${msg}\n\n${message17}`, classeCarte);
      habillerOverlayCelien(msg, citationCelien, signatureCelien);

      // Ce message contient l'avertissement "interdit de vomir" => +2s d'affichage
      if (overlayRegleTimeout) {
        clearTimeout(overlayRegleTimeout);
      }
      if (!overlayRegleVerrouille) {
        overlayRegleTimeout = setTimeout(
          () => fermerOverlayRegleUnique(),
          delai(dureeOverlayPourMessage(`${msg}\n\n${message17}`) + 2000)
        );
      }
        const ensuite = () => {
          if(joueurPeutAnnuler(joueurIndex, nbGorgees)){
            afficherOverlayAnnulation(
              joueurIndex,
              nbGorgees,
              null,
              () => { if(typeof onFinish === "function") onFinish(); }
            );
          } else if(typeof onFinish === "function"){
            onFinish();
          }
        };
        executerApresOverlayRegleUnique(ensuite);
      return;
    }

    regleZero.innerText = msg;
    regleZero.style.display = "block";
    zeroEnCours = true;

    montrerOverlayRegle(msg, classeCarte);

    const ensuite = () => {
      if(joueurPeutAnnuler(joueurIndex, nbGorgees)){
        afficherOverlayAnnulation(
          joueurIndex,
          nbGorgees,
          null,
          () => { if(typeof onFinish === "function") onFinish(); }
        );
      } else if(typeof onFinish === "function"){
        onFinish();
      }
    };

    executerApresOverlayRegleUnique(ensuite);
  }



  // Texte des overlays de règle : la 1re ligne en titre, les suivantes en détails plus petits
  // (avant, tout s'affichait d'un bloc dans la même grosse taille : illisible dès 3-4 lignes)
  function remplirTexteRegle(boxTexte, message){
    boxTexte.innerHTML = "";
    String(message || "")
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .forEach((texte, i) => {
        const el = document.createElement("div");
        el.className = i === 0 ? "regle-titre" : "regle-detail";
        el.innerText = texte;
        boxTexte.appendChild(el);
      });
  }

  // Carte tirée, affichée en haut des overlays de choix (+4, duel, nouveau pigeon)
  function ajouterCarteVedette(parent, classeCarte, classeEnPlus = ""){
    if(!classeCarte) return;
    const carte = document.createElement("div");
    carte.className = `Carte retournee carte-vedette ${classeCarte} ${classeEnPlus}`.trim();
    parent.appendChild(carte);
  }

  function montrerOverlayRegle(message, classeCarte = "", classeCarteSupplementaire = "") {
    let overlay = document.getElementById("overlayRegleUnique");
    if (overlay) {
      // Annonce arrivée pendant que le précédent disparaît (ex. en ligne, l'action d'un autre joueur) :
      // on annule sa sortie (avant, la nouvelle annonce disparaissait avec lui, carte comprise)
      if (overlay.dataset.enFermeture) {
        delete overlay.dataset.enFermeture;
        overlay.style.transition = "opacity 0.3s ease, transform 0.3s ease";
        overlay.style.opacity = "1";
        overlay.style.transform = "scale(1)";
      }
      // Overlay réutilisé : on retire l'habillage doré d'un message carte dorée précédent
      overlay.classList.remove("overlay-doree");
      const cartes = overlay.querySelector(".overlay-regle-cartes");
      const boxTexte = overlay.querySelector(".overlay-regle-texte");

      if (overlayRegleTimeout) {
        clearTimeout(overlayRegleTimeout);
        overlayRegleTimeout = null;
      }

      if (cartes) {
        cartes.innerHTML = "";
        if (classeCarte) {
          const carte1 = document.createElement("div");
          carte1.className = "Carte " + classeCarte;
          cartes.appendChild(carte1);
        }
        if (classeCarteSupplementaire) {
          const carte2 = document.createElement("div");
          carte2.className = "Carte " + classeCarteSupplementaire;
          cartes.appendChild(carte2);
        }
        cartes.style.display = cartes.children.length > 0 ? "flex" : "none";
      }

      if (boxTexte) remplirTexteRegle(boxTexte, message);

      if (!overlayRegleVerrouille) {
        overlayRegleTimeout = setTimeout(() => fermerOverlayRegleUnique(), dureeOverlayPourMessage(message));
      }
      return;
    }

    overlay = document.createElement("div");
    overlay.id = "overlayRegleUnique";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgb(0,0,0)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "9999";
    overlay.style.color = "#FFD700";
    overlay.style.fontSize = "36px";
    overlay.style.fontWeight = "bold";
    overlay.style.textAlign = "center";
    overlay.style.padding = "20px";
    overlay.style.borderRadius = "20px";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    overlay.style.transform = "scale(1)";

    const cartes = document.createElement("div");
    cartes.className = "overlay-regle-cartes";
    cartes.style.display = "flex";
    cartes.style.gap = "30px";
    cartes.style.marginBottom = "20px";

    if (classeCarte) {
      const carte1 = document.createElement("div");
      carte1.className = "Carte " + classeCarte;
      cartes.appendChild(carte1);
    }

    if (classeCarteSupplementaire) {
      const carte2 = document.createElement("div");
      carte2.className = "Carte " + classeCarteSupplementaire;
      cartes.appendChild(carte2);
    }

    cartes.style.display = cartes.children.length > 0 ? "flex" : "none";
    overlay.appendChild(cartes);

    const boxTexte = document.createElement("div");
    boxTexte.className = "overlay-regle-texte";

    remplirTexteRegle(boxTexte, message);

    overlay.appendChild(boxTexte);
    overlay.style.cursor = "pointer";
    overlay.addEventListener("pointerdown", () => {
      if (!overlayRegleVerrouille) {
        fermerOverlayRegleUnique();
      }
    });

    lockScroll();
    document.body.appendChild(overlay);
    getComputedStyle(overlay).opacity; // départ du fondu bien pris en compte

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    });

    if (!overlayRegleVerrouille) {
      if (overlayRegleTimeout) clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = setTimeout(() => fermerOverlayRegleUnique(), dureeOverlayPourMessage(message));
    }
  }

  function afficherOverlayCouleur(joueurActuel){
    if(document.getElementById("overlayCouleur")) return;
    const choisisseur = joueurs[joueurActuel];
    choixPigeonEnCours = true;
    lockScroll();

    const overlay = document.createElement("div");
    overlay.id = "overlayCouleur";

    const titre = document.createElement("div");
    titre.className = "titre-couleur";
    titre.innerText = "Choisis une couleur";
    overlay.appendChild(titre);

    const container = document.createElement("div");
    container.className = "container-couleurs";

    const couleurs = [
      { nom: "vert", classe: "carre-vert" },
      { nom: "jaune", classe: "carre-jaune" },
      { nom: "rouge", classe: "carre-rouge" },
      { nom: "bleu", classe: "carre-bleu" }
    ];

    couleurs.forEach(c=>{
      const carre = document.createElement("div");
      carre.className = "carre-couleur " + c.classe;
      surAction(carre, "couleur:" + c.nom, { owner: choisisseur, once: true }, ()=>{
        couleurChoisie = c.nom;
        majAffichageCouleur();
        unlockScroll();
        overlay.remove();
        choixPigeonEnCours = false;
        afficherJoueurActif();
      });
      container.appendChild(carre);
    });

    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  /* ===== CARTE DORÉE : habillage premium de l'overlay de règle =====
     Fond doré + grand titre (par défaut « ✦ CARTE DORÉE ✦ ») + texte en dessous (facultatif) */
  const TITRE_CARTE_DOREE = '<span class="doree-etincelle">✦</span> CARTE DORÉE <span class="doree-etincelle">✦</span>';

  // Change la durée d'affichage de l'overlay de règle qui vient d'être montré.
  // facteur = null : il reste affiché jusqu'à ce qu'on tape dessus.
  // Annonce d'un pigeon (premier pigeon ou nouveau pigeon choisi) : 2 fois le temps de lecture normal
  const DUREE_ANNONCE_PIGEON = 2;

  function reglerDureeOverlayRegle(message, facteur){
    if(overlayRegleTimeout){
      clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = null;
    }
    if(facteur === null || overlayRegleVerrouille) return;
    overlayRegleTimeout = setTimeout(
      () => fermerOverlayRegleUnique(),
      Math.round(dureeOverlayPourMessage(message) * facteur)
    );
  }

  // Easter egg Célien (plus de 15 gorgées) : fond doré, le message, puis la citation
  // en italique dorée et la signature ornée
  function habillerOverlayCelien(message, citation, signature){
    const overlay = document.getElementById("overlayRegleUnique");
    const boxTexte = overlay && overlay.querySelector(".overlay-regle-texte");
    if(!boxTexte) return;

    overlay.classList.add("overlay-doree");
    remplirTexteRegle(boxTexte, message);

    const bloc = document.createElement("div");
    bloc.className = "celien-bloc";

    const ligneCitation = document.createElement("div");
    ligneCitation.className = "celien-citation";
    ligneCitation.innerText = `« ${citation} »`;

    const ligneSignature = document.createElement("div");
    ligneSignature.className = "celien-signature";
    ligneSignature.innerHTML =
      `<span class="doree-etincelle">✦</span> ${echapperHtml(signature)} 👑 <span class="doree-etincelle">✦</span>`;

    bloc.appendChild(ligneCitation);
    bloc.appendChild(ligneSignature);
    boxTexte.appendChild(bloc);
  }

  function habillerOverlayCarteDoree(texte, titreHtml = TITRE_CARTE_DOREE){
    const overlay = document.getElementById("overlayRegleUnique");
    const boxTexte = overlay && overlay.querySelector(".overlay-regle-texte");
    if(!boxTexte) return;

    overlay.classList.add("overlay-doree");
    boxTexte.innerHTML = "";

    const titre = document.createElement("div");
    titre.className = "doree-titre";
    titre.innerHTML = titreHtml;
    boxTexte.appendChild(titre);

    if(texte){
      const ligne = document.createElement("div");
      ligne.className = "doree-texte";
      ligne.innerText = texte;
      boxTexte.appendChild(ligne);
    }
  }

  /* ===== CARTE DORÉE : choix de celui qui prend le cul sec ===== */
  function afficherOverlayCarteDoree(joueurActuel){
    if(document.getElementById("overlayCarteDoree")) return;
    const choisisseur = joueurs[joueurActuel];
    choixPigeonEnCours = true;
    lockScroll();

    const overlay = document.createElement("div");
    overlay.id = "overlayCarteDoree";

    // En-tête : la carte dorée qui brille, le titre, puis la consigne
    const carte = document.createElement("div");
    carte.className = "Carte carte_doree doree-carte-vedette";
    overlay.appendChild(carte);

    const titre = document.createElement("div");
    titre.className = "doree-titre";
    titre.innerHTML = TITRE_CARTE_DOREE;
    overlay.appendChild(titre);

    const consigne = document.createElement("div");
    consigne.className = "doree-texte";
    consigne.innerText = estModeSoft() ? "Choisis à qui tu distribues tes 3 gorgées" : "Choisis à qui tu distribues ton CUL SEC";
    overlay.appendChild(consigne);

    const liste = document.createElement("div");
    liste.className = "doree-boutons";
    overlay.appendChild(liste);

    // Tout le monde, y compris celui qui a tiré la carte
    joueurs.forEach((nom, i) => {
      const btn = document.createElement("button");
      btn.className = "bouton-doree";
      btn.innerText = avecCouronne(nom);
      surAction(btn, "doree:" + i, { owner: choisisseur, once: true }, () => {
        overlay.remove();
        unlockScroll();
        afficherOverlayTiensGueule(nom);

        // En ligne : on débloque tout de suite. L'overlay reste affiché jusqu'au tap, mais ne doit
        // pas bloquer ce téléphone (sinon, s'il n'est pas tapé, il raterait les actions des autres
        // et se désynchroniserait). Si la partie avance, le message suivant le remplace.
        if(enLigneActif){
          choixPigeonEnCours = false;
          afficherJoueurActif();
          return;
        }

        // Classique : plateau (et pari de fin) débloqués seulement une fois le message lu
        executerApresOverlayRegleUnique(() => {
          choixPigeonEnCours = false;
          afficherJoueurActif();
        });
      });
      liste.appendChild(btn);
    });

    document.body.appendChild(overlay);
  }

  // En ligne : seul le téléphone de la victime affiche « TIENS DANS TA GUEULE. »
  function afficherOverlayTiensGueule(victime){
    if(enLigneActif && victime !== pseudoActuel){
      const message = estModeSoft()
        ? `${victime} boit les 3 gorgées de la carte dorée !`
        : `${victime} prend le CUL SEC de la carte dorée !`;
      montrerOverlayRegle(message, "carte_doree");
      habillerOverlayCarteDoree(message);
      reglerDureeOverlayRegle(message, null); // reste jusqu'au tap
      return;
    }

    vibrer([400, 100, 400]); // c'est lui (ou, en classique, le téléphone de la table) qui prend


    // En classique, un seul téléphone pour tous : on précise qui prend le cul sec
    const titre = enLigneActif
      ? "TIENS DANS<br>TA GUEULE."
      : `TIENS DANS<br>TA GUEULE<br>${echapperHtml(avecCouronne(victime))}.`;
    montrerOverlayRegle("TIENS DANS TA GUEULE.", "carte_doree");
    habillerOverlayCarteDoree(estModeSoft() ? "3 gorgées !" : "", titre);
    reglerDureeOverlayRegle("", null); // reste jusqu'au tap
  }

  // #endregion

  // #region Duel
  /* ===== DUEL : Choix joueurs puis tirage ===== */
  function lancerOverlayChoixDuel(joueurActuel, carteDuel = ""){
    if(document.getElementById("overlayDuel")) return;
    const choisisseur = joueurs[joueurActuel];
    duelEnCours = true;
    choixPigeonEnCours = true;
    lockScroll();
    duelMultiplicateur = 1;

    const overlay = document.createElement("div");
    overlay.id = "overlayDuel";

    const content = document.createElement("div");
    content.className = "duel-content duel-choix-content";
    overlay.appendChild(content);
    ajouterCarteVedette(content, carteDuel);

    const titre = document.createElement("div");
    titre.className = "titre-pigeon duel-main-title";
    titre.innerText = "DUEL ! Choisis 2 joueurs";
    content.appendChild(titre);

    const containerBoutons = document.createElement("div");
    containerBoutons.className = "duel-boutons";
    content.appendChild(containerBoutons);

    let picks = [];

    joueurs.forEach((nom, idx)=>{
      const btn = document.createElement("button");
      btn.className = "bouton-pigeon";
      btn.innerText = nom;

      surAction(btn, "duel:choix:" + idx, { owner: choisisseur, once: true }, ()=>{
        if(picks.length >= 2) return;
        if(picks.includes(idx)) return;

        picks.push(idx);
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
        btn.style.backgroundColor = "#ffea70";
        btn.style.color = "#000";

        if(picks.length === 2){
          overlay.innerHTML = "";
          afficherOverlayTirageDuel(overlay, picks[0], picks[1], carteDuel);
        }
      });

      containerBoutons.appendChild(btn);
    });

    document.body.appendChild(overlay);
  }

  function afficherOverlayTirageDuel(overlay, j1, j2, carteDuel = ""){
    const content = document.createElement("div");
    content.className = "duel-content duel-tirage-content";
    // Si une nouvelle partie démarre pendant le duel, ses minuteurs ne doivent plus rien faire
    const generation = generationPartie;
    overlay.appendChild(content);
    // Le 4 tiré, en petit : on voit qu'il ne fait pas partie des 2 cartes du duel
    ajouterCarteVedette(content, carteDuel, "carte-vedette-petite");

    const titre = document.createElement("div");
    titre.className = "titre-pigeon duel-main-title";
    titre.innerText = "DUEL";
    content.appendChild(titre);

    const info = document.createElement("div");
    info.className = "duel-info";
    content.appendChild(info);

    const revealWrap = document.createElement("div");
    revealWrap.className = "duel-reveal-wrap";
    content.appendChild(revealWrap);

    const containerCartes = document.createElement("div");
    containerCartes.className = "duel-cartes";
    revealWrap.appendChild(containerCartes);

    const c1 = document.createElement("div");
    c1.className = "Carte";
    containerCartes.appendChild(c1);

    const c2 = document.createElement("div");
    c2.className = "Carte";
    containerCartes.appendChild(c2);

    const labels = document.createElement("div");
    labels.className = "duel-labels";
    revealWrap.appendChild(labels);

    const label1 = document.createElement("div");
    label1.className = "duel-label";
    labels.appendChild(label1);

    const label2 = document.createElement("div");
    label2.className = "duel-label";
    labels.appendChild(label2);

    let carteA = null;
    let carteB = null;

    function tirerUneCarte(){
      resetPaquetDuelSiBesoin();
      return paquetDuel.shift();
    }

    // 1) On prépare le duel : les 2 cartes sont "en main" mais restent de dos à l'écran
    function preparerDuel(){
      phase = 1;
      choixJ1 = null;
      info.innerText = joueurs[j1] + " : choisis une carte";

      // Reset visuel : cartes de dos, qui pulsent (= à choisir)
      c1.className = "Carte duel-a-choisir";
      c2.className = "Carte duel-a-choisir";
      c1.style.boxShadow = "";
      c2.style.boxShadow = "";
      c1.style.opacity = "1";
      c2.style.opacity = "1";
      c1.style.pointerEvents = "auto";
      c2.style.pointerEvents = "auto";

      label1.innerText = "";
      label2.innerText = "";

      // On pioche 2 cartes, mais on NE les affiche PAS encore (donc dos)
      carteA = tirerUneCarte();
      carteB = tirerUneCarte();

      info.innerText = joueurs[j1] + " : choisis une carte";
    }

    function resoudreDuel(carteJ1, carteJ2){
      const v1 = valeurCarteDuel(carteJ1);
      const v2 = valeurCarteDuel(carteJ2);

      if(v1 === v2){
        duelMultiplicateur *= 2;
        // Le multiplicateur reste affiché dans le titre pendant tout le duel
        titre.innerText = "DUEL ×" + duelMultiplicateur;
        info.innerText = "Égalité ! Les gorgées sont multipliées : ×" + duelMultiplicateur;
        // petite pause puis on relance un duel (toujours dos au départ)
        setTimeout(() => {
          if(generation !== generationPartie) return;
          preparerDuel();
        }, delai(1500));
        return;
      }

      const perdant = (v1 < v2) ? j1 : j2;
      const vPerdant = (v1 < v2) ? v1 : v2;
      const gorg = gorgeesDuel(vPerdant, duelMultiplicateur);
      const msg = joueurs[perdant] + " boit " + texteGorgees(gorg);

      // Résultat visible tout de suite sur le duel : la carte du perdant en rouge, celle du gagnant estompée
      const carteDeJ1 = (choixJ1 === 1) ? c1 : c2;
      const carteDeJ2 = (choixJ1 === 1) ? c2 : c1;
      c1.style.opacity = ""; // (opacité posée par preparerDuel : sinon la carte du gagnant ne s'estompe pas)
      c2.style.opacity = "";
      (perdant === j1 ? carteDeJ1 : carteDeJ2).classList.add("duel-perdant");
      (perdant === j1 ? carteDeJ2 : carteDeJ1).classList.add("duel-gagnant");
      info.innerText = joueurs[perdant] + " perd le duel !";

      // 1) on enlève l’overlay du duel après le temps de lire le reveal (2,2 s),
      //    ou dès qu'on tape sur l'écran
      let suiteFaite = false;
      const suite = () => {
        if(suiteFaite || generation !== generationPartie) return;
        suiteFaite = true;
        overlay.removeEventListener("pointerdown", suite);

        // L'annonce « X boit N gorgées » apparaît en fondu PAR-DESSUS le duel, et le duel n'est
        // retiré dessous qu'une fois l'annonce affichée (avant : le plateau apparaissait entre les deux)
        annoncerBoireAvecAnnulation(perdant, gorg, carteDuel, msg);
        setTimeout(() => {
          overlay.remove();
          unlockScroll();
        }, delai(450));

        // Puis on restaure l'état du jeu (sans attendre la fin d'overlay ici)
        setTimeout(() => {
          if(generation !== generationPartie) return;
          duelEnCours = false;
          choixPigeonEnCours = false;
          duelMultiplicateur = 1;
          afficherJoueurActif();
        }, delai(1800));
      };
      setTimeout(suite, delai(2200));
      overlay.addEventListener("pointerdown", suite);
    }

    function onChoose(which){
      // Phase 1 : J1 choisit
      if(phase === 1){
        choixJ1 = which;
        phase = 2;

        // La carte de J1 se met en retrait (plus de halo) ; seule la carte restante pulse
        const choisie = (which === 1) ? c1 : c2;
        const restante = (which === 1) ? c2 : c1;
        choisie.classList.remove("duel-a-choisir");
        choisie.classList.add("duel-selected");
        choisie.style.pointerEvents = "none";
        restante.style.pointerEvents = "auto";

        // On sait tout de suite à qui est la carte choisie
        label1.innerText = (which === 1) ? "Carte de " + joueurs[j1] : "";
        label2.innerText = (which === 2) ? "Carte de " + joueurs[j1] : "";
        info.innerText = joueurs[j2] + " : clique sur la carte restante";
        return;
      }

      // Phase 2 : J2 doit cliquer la carte restante uniquement
      if(phase === 2){
        // sécurité : si J2 clique la même que J1 (normalement impossible)
        if(which === choixJ1) return;

        phase = 3; // terminé
        c1.style.pointerEvents = "none";
        c2.style.pointerEvents = "none";
        c1.classList.remove("duel-a-choisir");
        c2.classList.remove("duel-a-choisir");

        // Attribution réelle des cartes
        const carteJ1 = (choixJ1 === 1) ? carteA : carteB;
        const carteJ2 = (choixJ1 === 1) ? carteB : carteA;

        // Le nom de J2 s'affiche tout de suite sous sa carte (comme pour J1), avant le retournement
        if(which === 1) label1.innerText = "Carte de " + joueurs[j2];
        else label2.innerText = "Carte de " + joueurs[j2];

        info.innerText = "On retourne les cartes…";
        overlay.classList.add("reveal");

        c1.classList.remove("duel-selected");
        c2.classList.remove("duel-selected");
        c1.style.boxShadow = "";
        c2.style.boxShadow = "";

        // Reveal des 2 cartes (on ajoute les classes maintenant)
        setTimeout(() => {
          if(generation !== generationPartie) return; // partie relancée entre-temps

          overlay.classList.remove("reveal");
          
          c1.style.boxShadow = "";
          c2.style.boxShadow = "";

          c1.className = "Carte retournee";
          c2.className = "Carte retournee";

          // La gauche montre carteA, la droite montre carteB (positions fixes)
          c1.classList.add(carteA);
          c2.classList.add(carteB);

          // Labels clairs : qui a quoi
          if(choixJ1 === 1){
            label1.innerText = "Carte de " + joueurs[j1];
            label2.innerText = "Carte de " + joueurs[j2];
          } else {
            label1.innerText = "Carte de " + joueurs[j2];
            label2.innerText = "Carte de " + joueurs[j1];
          }

          info.innerText = "Résultat…";
          resoudreDuel(carteJ1, carteJ2);
        }, delai(1400));
      }
    }


    // J1 choisit sa carte, puis J2 prend la restante
    const choisisseurDuel = () => phase === 1 ? joueurs[j1] : joueurs[j2];
    surAction(c1, "duel:carte:1", { owner: choisisseurDuel }, () => onChoose(1));
    surAction(c2, "duel:carte:2", { owner: choisisseurDuel }, () => onChoose(2));

    preparerDuel();
  }

  function afficherOverlayPlus4(joueurActuel, classeCartePlus4){
    if(document.getElementById("overlayPlus4")) return;

    choixPigeonEnCours = true;
    const aDistribuer = gorgeesPlus4(); // 4 (2 en mode soft)
    lockScroll();
    const choisisseur = joueurs[joueurActuel];

    const overlay = document.createElement("div");
    overlay.id = "overlayPlus4";
    ajouterCarteVedette(overlay, classeCartePlus4);

    const titre = document.createElement("div");
    titre.className = "titre-pigeon";
    titre.innerText = `PLUS 4 — Distribue ${texteGorgees(aDistribuer)}`;
    overlay.appendChild(titre);

    const info = document.createElement("div");
    info.className = "plus4-info";
    overlay.appendChild(info);

    const totalBox = document.createElement("div");
    totalBox.className = "plus4-total";
    overlay.appendChild(totalBox);

    const container = document.createElement("div");
    container.className = "plus4-container-joueurs";
    overlay.appendChild(container);

    const actions = document.createElement("div");
    actions.className = "plus4-actions";
    overlay.appendChild(actions);

    // distribution par joueur (index -> nb gorgées)
    const dist = {};
    joueurs.forEach((_, i) => dist[i] = 0);

    // historique pour "annuler le dernier"
    let historique = []; // ex: [2,2,5,1] = on a ajouté +1 à ces joueurs dans cet ordre

    function totalDistribue(){
      return Object.values(dist).reduce((a,b)=>a+b,0);
    }

    function refreshUI(){
      const total = totalDistribue();
      totalBox.innerText = `Gorgées distribuées : ${total} / ${aDistribuer}`;

      if(total < aDistribuer){
        info.innerText = `Choisis à qui tu veux distribuer tes ${texteGorgees(aDistribuer)}.`;
      } else {
        info.innerText = "Total atteint. Tu peux valider.";
      }

      // update boutons joueurs (badge)
      [...container.querySelectorAll("button[data-idx]")].forEach(btn=>{
        const idx = Number(btn.dataset.idx);
        const n = dist[idx];
        btn.innerHTML = n > 0
        ? `${echapperHtml(joueurs[idx])} <span class="plus4-badge">+ ${n}</span>`
        : echapperHtml(joueurs[idx]);

        // optionnel: griser si le total est atteint (plus possible d'ajouter)
        if(total >= aDistribuer){
          btn.style.opacity = "0.7";
        } else {
          btn.style.opacity = "1";
        }
      });

      // enable/disable undo
      btnUndo.disabled = (historique.length === 0);
      btnUndo.style.opacity = btnUndo.disabled ? "0.6" : "1";

      // validation uniquement si le total est atteint
      btnValider.disabled = (total !== aDistribuer);
      btnValider.style.opacity = btnValider.disabled ? "0.6" : "1";
    }

    // boutons joueurs : UN CLIC = +1 (si total < aDistribuer)
    joueurs.forEach((nom, idx)=>{
      const btn = document.createElement("button");
      btn.className = "bouton-pigeon plus4-joueur-btn";
      btn.dataset.idx = String(idx);
      btn.innerText = nom;

      surAction(btn, "plus4:joueur:" + idx, { owner: choisisseur }, ()=>{
        const total = totalDistribue();
        if(total >= aDistribuer) return;

        dist[idx] += 1;
        historique.push(idx);
        refreshUI();
      });

      container.appendChild(btn);
    });

    const btnUndo = document.createElement("button");
    btnUndo.className = "bouton-pigeon plus4-action-btn";
    btnUndo.innerText = "Retour";
    surAction(btnUndo, "plus4:annuler", { owner: choisisseur }, ()=>{
      if(historique.length === 0) return;
      const idx = historique.pop();
      if(dist[idx] > 0) dist[idx] -= 1;
      refreshUI();
    });

    const btnReset = document.createElement("button");
    btnReset.className = "bouton-pigeon plus4-action-btn";
    btnReset.innerText = "Annuler";
    surAction(btnReset, "plus4:reset", { owner: choisisseur }, ()=>{
      Object.keys(dist).forEach(k => dist[k] = 0);
      historique = [];
      refreshUI();
    });

    const btnValider = document.createElement("button");
    btnValider.className = "bouton-pigeon plus4-action-btn";
    btnValider.innerText = "Valider";
    surAction(btnValider, "plus4:valider", { owner: choisisseur, once: true }, ()=>{
      if(totalDistribue() !== aDistribuer) return;

      overlay.remove();
      unlockScroll();
      choixPigeonEnCours = false;
      afficherJoueurActif();

      const file = Object.entries(dist)
        .map(([k,v]) => ({ idx: Number(k), n: Number(v) }))
        .filter(x => x.n > 0);

      distribuerFilePlus4(file, classeCartePlus4);
    });
    // Ordre d'affichage : Valider, puis Retour, puis Annuler
    actions.append(btnValider, btnUndo, btnReset);

    document.body.appendChild(overlay);
    refreshUI();
  }

  function distribuerFilePlus4(file, classeCartePlus4){
    if(file.length === 0) return;

    const item = file.shift();
    demanderAnnulationPlus4(item.idx, item.n, classeCartePlus4, () => {
      distribuerFilePlus4(file, classeCartePlus4);
    });
  }

  function demanderAnnulationPlus4(joueurIndex, nbGorgees, classeCartePlus4, onFinish){
    const nom = joueurs[joueurIndex];
    const msg = `${nom} boit ${nbGorgees} gorgée(s) (+4)`;

    montrerOverlayRegle(msg, classeCartePlus4);

    executerApresOverlayRegleUnique(() => {
      if(joueurPeutAnnuler(joueurIndex, nbGorgees)){
        afficherOverlayAnnulation(
          joueurIndex,
          nbGorgees,
          null,
          () => { if(typeof onFinish === "function") onFinish(); }
        );
      } else if(typeof onFinish === "function"){
        onFinish();
      }
    });
  }

  // #endregion

  // #region Application des règles et déroulement du jeu
  // ===== Annulations pour pénalités multi-joueurs (SOCIAL / ZERO) =====
  function demanderAnnulationSimple(joueurIndex, nbGorgees, onFinish){
    if(!joueurPeutAnnuler(joueurIndex, nbGorgees)){
      if(typeof onFinish === "function") onFinish();
      return;
    }

    afficherOverlayAnnulation(
      joueurIndex,
      nbGorgees,
      null,
      () => { if(typeof onFinish === "function") onFinish(); }
    );
  }

  function demarrerAnnulationsMulti(victimes, classeCarte, messageEntete, onComplete = null){
    montrerOverlayRegle(messageEntete, classeCarte);

    const file = victimes.filter(idx => Number(annulations[joueurs[idx]] || 0) > 0);

    function next(){
      if(file.length === 0){
        if(typeof onComplete === "function") onComplete();
        return;
      }

      const idx = file.shift();
      demanderAnnulationSimple(idx, 1, next);
    }

    executerApresOverlayRegleUnique(next);
  }

  function couleurDeLaCarte(classeCarte){
    // Ex: "un_vert1" => "vert", "interdit_rouge" => "rouge"
    const m = classeCarte.match(/_(vert|jaune|rouge|bleu)/);
    return m ? m[1] : null;
  }

  // La carte « 1 » s'envole du plateau vers le nom du joueur qui la garde, puis son +1 pulse
  function envolerCarteVersJoueur(carteElement, classeCarte, nom){
    const depart = carteElement.getBoundingClientRect();
    carteElement.classList.add("carte-disparue"); // le trou reste à sa place
    const sansAnimation = rattrapageEnCours || !carteElement.animate ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if(sansAnimation || depart.width === 0) return;

    // Le +1 du joueur dans la liste « Joueurs » (s'il est à l'écran), sinon vers le haut de l'écran
    const ligneJoueur = () => listeJoueurs.querySelectorAll(".joueur-ligne")[joueurs.indexOf(nom)];
    const cible = ligneJoueur();
    const zone = cible && (cible.querySelector(".bonus-annulation") || cible).getBoundingClientRect();
    const cibleVisible = zone && zone.width > 0 && zone.bottom > 0 && zone.top < window.innerHeight;
    const arriveeX = cibleVisible ? zone.left + zone.width / 2 : depart.left + depart.width / 2;
    const arriveeY = cibleVisible ? zone.top + zone.height / 2 : -depart.height;
    const dx = arriveeX - (depart.left + depart.width / 2);
    const dy = arriveeY - (depart.top + depart.height / 2);

    const vol = document.createElement("div");
    vol.className = "Carte retournee carte-envol " + classeCarte;
    Object.assign(vol.style, {
      left: depart.left + "px", top: depart.top + "px",
      width: depart.width + "px", height: depart.height + "px"
    });
    document.body.appendChild(vol);

    const animation = vol.animate([
      { transform: "translate(0, 0) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
      { transform: "translate(0, -10px) scale(1.15) rotate(-4deg)", opacity: 1, offset: 0.25 }, // on la « prend »
      { transform: `translate(${dx}px, ${dy}px) scale(0.22) rotate(8deg)`, opacity: 0.35, offset: 1 }
    ], { duration: 950, easing: "ease-in-out", fill: "forwards" });

    animation.onfinish = () => {
      vol.remove();
      const ligne = cibleVisible && ligneJoueur();
      const badge = ligne && ligne.querySelector(".bonus-annulation");
      if(badge){
        badge.classList.remove("bonus-pulse");
        void badge.offsetWidth; // relance l'animation
        badge.classList.add("bonus-pulse");
      }
    };
  }

  /* ===== Application des règles ===== */
  function appliquerRegle(carteTiree, joueurActuel, carteElement){
    // Gorgée pour la couleur choisie : décidée maintenant (et la couleur effacée),
    // affichée plus tard par chaque règle, après son propre message
    const couleurBue = prendreCouleurSiBesoin(carteTiree);

    if(zeroEnCours || switchEnCours){
      regleZero.style.display="none";
      zeroEnCours=false;
      switchEnCours=false;
    }

    effacerMessagePigeon();


    if (carteTiree === "carte_doree") {
      regleZero.innerText = `CARTE DORÉE : distribue ${texteCulSec()}`;
      regleZero.style.display = "block";
      zeroEnCours = true;

      // Plateau bloqué (et pari de fin en attente) jusqu'au choix de la victime
      choixPigeonEnCours = true;
      const texteCarteDoree = estModeSoft()
        ? "Distribue 3 gorgées de la part du développeur 😘"
        : "Distribue un CUL SEC de la part du développeur, et obligation de se servir un vrai verre avant 😘";
      // Le texte complet sert à calculer la durée d'affichage de l'overlay
      montrerOverlayRegle(`CARTE DORÉE\n${texteCarteDoree}`, carteTiree);
      vibrer([150, 70, 150, 70, 300]);
      jouerSon("doree");
      habillerOverlayCarteDoree(texteCarteDoree);
      reglerDureeOverlayRegle(`CARTE DORÉE\n${texteCarteDoree}`, 1.65); // +65 % de temps de lecture
      executerApresOverlayRegleUnique(() => afficherOverlayCarteDoree(joueurActuel));
      return;
    }

    // Cas spécial: plus_4 => overlay de distribution + annulations chez les cibles
    if (carteTiree.startsWith("plus_4")) {
      afficherOverlayPlus4(joueurActuel, carteTiree);
      return;
    }

    // Cartes "boire"
    if(carteTiree.startsWith("interdit")){
      const entete = "SOCIAAALE ! \nTout le monde boit 1 gorgée";

      regleZero.innerText = entete;
      regleZero.style.display = "block";
      zeroEnCours = true;

      const victimes = joueurs.map((_, i) => i); // tout le monde
      demarrerAnnulationsMulti(victimes, carteTiree, entete, () => {
        appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
      });
      return;
    }

    // ZERO : tout le monde boit 1 sauf celui qui a tiré le 0
    if(carteTiree.startsWith("zero")){
      const entete = "Tout le monde boit 1 gorgée sauf toi";

      regleZero.innerText = entete;
      regleZero.style.display = "block";
      zeroEnCours = true;

      const victimes = joueurs.map((_, i) => i).filter(i => i !== joueurActuel);
      demarrerAnnulationsMulti(victimes, carteTiree, entete, () => {
        appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
      });
      return;
    }

    if (carteTiree.startsWith("plus_2")) {
      const n = gorgeesPlus2();
      annoncerBoireAvecAnnulation(
        joueurActuel,
        n,
        carteTiree,
        `${joueurs[joueurActuel]} boit ${texteGorgees(n)}`,
        () => {
          appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
        }
      );
      return; // important : on évite le traitement générique en dessous
    }

    // Cartes "un" => +1 annulation de gorgée
    if(carteTiree.startsWith("un")){
      const msg = "+1 annulation de gorgée !";
      montrerOverlayRegle(msg, carteTiree);
      // puis message persistant jusqu'au prochain tirage (géré par zeroEnCours)
      regleZero.innerText = msg;
      regleZero.style.display = "block";
      zeroEnCours = true;

      // +1 permanent à côté du nom du joueur
      const nom = joueurs[joueurActuel];
      annulations[nom] = Number(annulations[nom] || 0) + 1;
      afficherJoueurs();

      // Comme en vrai, le joueur garde la carte avec lui : une fois les overlays fermés, elle
      // s'envole vers son nom (là où s'affiche son +1) et laisse un trou sur le plateau.
      // (avant, elle disparaissait d'un coup : on croyait à un bug)
      if(carteElement && rattrapageEnCours){
        carteElement.classList.add("carte-disparue"); // reconnexion : pas d'animation pour les cartes déjà jouées
      } else if(carteElement){
        const generation = generationPartie;
        quandPlateauVisible(() => {
          if(generation !== generationPartie || !carteElement.isConnected) return;
          envolerCarteVersJoueur(carteElement, carteTiree, nom);
        });
      }

      // Couleur choisie : la gorgée s'affiche APRÈS « +1 annulation » (sinon elle l'effaçait)
      appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true, afterRuleOverlay: true });
    }


    // Cartes "switch"
    if(carteTiree.startsWith("switch")){
      sensHoraire = !sensHoraire;
      const msg = "Sens du jeu inversé";
      regleZero.innerText = msg;
      regleZero.style.display = "block";
      switchEnCours = true;
      montrerOverlayRegle("Le sens du jeu est inversé !", carteTiree);
      appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true, afterRuleOverlay: true });
    }

    // Cartes "trois/pigeon"
    if(carteTiree.startsWith("trois")){
      
      if(indexPigeon===null){
        indexPigeon=joueurActuel;
        nomPigeonOriginal=joueurs[joueurActuel];
        const nPigeon = gorgeesPigeon();
        const msgPigeon = `${joueurs[joueurActuel]} est le PIGEON !\nIl/elle boit ${texteGorgees(nPigeon)}.\nÀ chaque 3 tiré, le PIGEON boit 1 gorgée.\nPour s'en débarrasser : tirer un 3 et choisir le prochain PIGEON.`;
        annoncerBoireAvecAnnulation(
          joueurActuel,
          nPigeon,
          carteTiree,
          msgPigeon,
          () => {
            appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
          }
        );
        reglerDureeOverlayRegle(msgPigeon, DUREE_ANNONCE_PIGEON); // annonce du pigeon : affichée 2 fois plus longtemps
        jouerSon("pigeon");
      
      } else if(indexPigeon===joueurActuel){
        carteTroisPourTransfertPigeon = carteTiree;
        // La gorgée couleur éventuelle viendra après l'annonce du nouveau pigeon
        joueurTroisPourTransfertPigeon = joueurActuel;
        couleurTroisPourTransfertPigeon = couleurBue;
        afficherMenuPigeon();
      
      } else {
        // si quelqu'un d'autre tire un 3 : le pigeon boit 1 (annulable si compteur)
        const msg = `Le PIGEON (${joueurs[indexPigeon]}) boit 1 gorgée`;
        // message dans .messages (disparaît au prochain tirage grâce à effacerMessagePigeon() au début)
        // overlay + choix d'annulation si le pigeon a des "UN"
        annoncerBoireAvecAnnulation(indexPigeon, 1, carteTiree, msg, () => {
          appliquerBonusCouleurSiBesoin(carteTiree, { couleur: couleurBue, joueur: joueurActuel, preserveRuleMessage: true });
        });
      }
    }

    // Cartes "couleur"
    if(carteTiree.startsWith("couleur")){
      afficherOverlayCouleur(joueurActuel);
    }

    // Cartes "quatre" => duel
    if(carteTiree.startsWith("quatre")){
      lancerOverlayChoixDuel(joueurActuel, carteTiree);
    }

    // Duel de la couleur choisie : la gorgée couleur s'affiche avant le duel
    // (annulable via les "UN"). Les autres cartes l'affichent elles-mêmes après leur règle.
    if(couleurBue && carteTiree.startsWith("quatre")){
      const msgCouleur = `${joueurs[joueurActuel]} boit 1 gorgée pour la couleur (${couleurBue})`;
      annoncerBoireAvecAnnulation(joueurActuel, 1, carteTiree, msgCouleur);
    }
  }

  /* ===== JEU ===== */
  function lancerPartie(){
    if(joueurs.length < 2){
      alert("Il faut au moins 2 joueurs");
      return;
    }

    plateau.innerHTML = "";
    prechargerImagesCartes(); // (déjà fait à l'ouverture, en principe)
    lancementPartieA = Date.now();
    document.body.classList.toggle("partie-soft", estModeSoft()); // badge « 🌱 SOFT » dans le bandeau
    garderEcranAllume(); // pas de mise en veille pendant la partie

    // Plateau principal = toutes les cartes SAUF 2/5/6/7/8/9 (paquet duel)
    const paquetPrincipal = classes.filter(c => !duelCartes.includes(c));
    paquet = [...paquetPrincipal];
    melangerPaquet(paquet);

    // Paquet duel (réutilisable à l'infini via resetPaquetDuelSiBesoin)
    paquetDuel = [...duelCartes];
    melangerPaquet(paquetDuel);

    // Tirée avec « aleatoire » : en ligne, tous les téléphones ont la même carte dorée au même endroit
    const avecCarteDoree = aleatoire() < CHANCE_CARTE_DOREE;
    // La carte dorée REMPLACE une carte normale (n'importe laquelle : la dernière du paquet mélangé),
    // pour garder 52 cases : sinon une carte se retrouvait seule sur la dernière rangée
    if(avecCarteDoree) paquet.pop();
    const nbCases = paquet.length + (avecCarteDoree ? 1 : 0);
    indexCaseDoree = avecCarteDoree ? Math.floor(aleatoire() * nbCases) : -1;
    carteDoreeEnJeu = avecCarteDoree;

    indexJoueur = 0;
    partieLancee = true;
    zeroEnCours = false;
    switchEnCours = false;
    sensHoraire = true;
    couleurChoisie = null;
    majAffichageCouleur();

    duelEnCours = false;
    duelMultiplicateur = 1;
    finUnOverlayAffiche = false;

    btnNouvellePartie.style.display = "inline-block";
    majBoutonsJoueurs();
    btnJouer.style.display = "none";

    regleZero.style.display = "none";
    effacerMessagePigeon();
    afficherJoueurActif();

    for(let i=0;i<nbCases;i++){
      const carte = document.createElement("div");
      carte.classList.add("Carte");
      const estCaseDoree = i === indexCaseDoree;
      if(estCaseDoree) carte.classList.add("dos_dore");

      surAction(carte, "carte:" + i, {
        evenement: "click",
        owner: () => joueurs[indexJoueur % joueurs.length],
        pret: () => !choixPigeonEnCours && !duelEnCours && !predictionEnCours && cartesRestantes() > 1,
        valide: () => !carte.classList.contains("retournee")
      }, ()=>{
        // Plateau bloqué pendant overlays pigeon/couleur/duel
        if(choixPigeonEnCours || duelEnCours) return;
        if(carte.classList.contains("retournee")) return;
        // La dernière carte cachée ne se retourne pas : elle est réservée au pari de fin
        if(cartesRestantes() <= 1) return;
        if(joueurs.length === 0) return;

        const carteTiree = estCaseDoree ? "carte_doree" : paquet.shift();
        if(!carteTiree) return;

        if(estCaseDoree){
          carteDoreeEnJeu = false;
          carte.classList.remove("dos_dore");
        }
        carte.classList.add(carteTiree, "retournee");
        if(!estCaseDoree) jouerSon("cartes");

        const joueurActuel = indexJoueur % joueurs.length;
        appliquerRegle(carteTiree, joueurActuel, carte);

        // Avant-dernière carte tirée (carte dorée comprise) => on lance le pari sur la dernière,
        // après les overlays éventuels. La dernière carte n'est jamais jouée : elle sert au pari.
        if(cartesRestantes() === 1 && !predictionEnCours){
          const startIdx = nextPlayerIndex(joueurActuel);
          const generation = generationPartie;
          executerApresOverlayRegleUnique(() => {
            // Si un duel/pigeon est en cours, on attend que ça finisse avant d'afficher.
            // (Minuteur et pas requestAnimationFrame : celui-ci s'arrête quand l'écran est éteint ou
            // l'appli en arrière-plan, et le pari ne s'affichait alors qu'au retour sur l'appli)
            const attendre = () => {
              if(generation !== generationPartie) return; // partie relancée entre-temps
              if(choixPigeonEnCours || duelEnCours){
                setTimeout(attendre, 100);
                return;
              }
              lancerOverlayPrediction(startIdx);
            };
            attendre();
          });
        }
        // fin du plateau : on affiche les "1 restants"
        if(cartesRestantes() === 0){
          executerApresOverlayRegleUnique(() => {
            finDePartie();
          });
        }

        indexJoueur = (indexJoueur + (sensHoraire ? 1 : -1) + joueurs.length) % joueurs.length;

        afficherJoueurActif();
        afficherJoueurs();
      });

      plateau.appendChild(carte);
    }
    
    centrerDerniereLigne();
  }

  function retourMenu(){
    partieLancee = false;
    document.body.classList.remove("partie-soft");
    finUnOverlayAffiche = false;

    // Écrans du retrait en cours de partie (nouvelle manche, départ, partie fermée...)
    retraitEnAttente = null;
    ecranConfirmerRetrait.style.display = "none";
    suppression.style.display = "none";


    // ✅ reset des annulations (compteurs "un") pour une nouvelle partie
    joueurs.forEach(nom => {
      annulations[nom] = 0;
    });

    paquet = [];
    paquetDuel = [];
    indexCaseDoree = -1;
    carteDoreeEnJeu = false;

    indexJoueur = 0;

    indexPigeon = null;
    nomPigeonOriginal = "";
    choixPigeonEnCours = false;

    zeroEnCours = false;
    switchEnCours = false;
    sensHoraire = true;

    couleurChoisie = null;
    majAffichageCouleur();

    duelEnCours = false;
    duelMultiplicateur = 1;

    plateau.innerHTML = "";

    regleZero.style.display = "none";
    effacerMessagePigeon();
    joueurActif.innerText = "";

    const overlayPigeon = document.getElementById("overlayPigeon");
    if(overlayPigeon) overlayPigeon.remove();

    const overlayCouleur = document.getElementById("overlayCouleur");
    if(overlayCouleur) overlayCouleur.remove();

    const overlayDuel = document.getElementById("overlayDuel");
    if(overlayDuel) overlayDuel.remove();

    btnNouvellePartie.style.display = "none";
    btnSupprimer.style.display = "inline-block";
    btnJouer.style.display = joueurs.length >= 2 ? "inline-block" : "none";
    menu.style.display = "flex";

    afficherJoueurs();
    // Sécurité : on réactive le scroll quoi qu'il arrive
    scrollLockCount = 0;
    document.body.classList.remove("no-scroll", "overlay-open");
    document.documentElement.classList.remove("overlay-ouvert");
    document.body.style.top = "";
  }

  btnJouer.addEventListener("pointerdown", lancerPartie);

  // #endregion

  // #region Écran « Nouvelle partie »
  /* ===== ÉCRAN « NOUVELLE PARTIE » (classique et en ligne) ===== */
  const ecranNouvellePartie = document.getElementById("ecranNouvellePartie");

  function fermerEcranNouvellePartie(){
    ecranNouvellePartie.style.display = "none";
  }

  // "click" (et pas pointerdown) : évite que le relâchement du doigt active un bouton du nouvel écran
  btnNouvellePartie.addEventListener("click", () => {
    // « Jouer » (au toucher) laisse sa place à « Nouvelle partie » sous le doigt : Android et PC
    // y envoient le clic du doigt relevé, qui ouvrirait cet écran juste après le lancement
    if(Date.now() - lancementPartieA < 700) return;
    ecranNouvellePartie.style.display = "";
  });

  document.getElementById("btnRetourNouvellePartie").addEventListener("click", fermerEcranNouvellePartie);

  // Courte annonce après « Rejouer (avec les mêmes joueurs) » : disparaît toute seule (~1,5 s)
  // ou au tap. Hors des overlays du jeu : ne bloque rien, même en ligne.
  function annoncerNouvellePartie(){
    const ancienne = document.getElementById("annonceNouvellePartie");
    if(ancienne) ancienne.remove();

    const annonce = document.createElement("div");
    annonce.id = "annonceNouvellePartie";
    annonce.innerHTML =
      '<div class="annonce-titre">NOUVELLE PARTIE</div>' +
      '<div class="annonce-texte">avec les mêmes joueurs</div>';

    const retirer = () => annonce.remove();
    annonce.addEventListener("pointerdown", retirer);
    annonce.addEventListener("animationend", (e) => {
      if(e.animationName === "annonceApparaitDisparait") retirer();
    });
    setTimeout(retirer, 2000); // sécurité (ex. animations désactivées)

    document.body.appendChild(annonce);
  }

  document.getElementById("btnRejouerMemes").addEventListener("click", () => {
    fermerEcranNouvellePartie();
    if(enLigneActif){
      lancerMancheEnLigne(joueurs.slice(), false);
      return;
    }
    nettoyerOverlays();
    retourMenu();
    lancerPartie();
    annoncerNouvellePartie();
  });

  document.getElementById("btnModifierJoueurs").addEventListener("click", () => {
    fermerEcranNouvellePartie();
    if(enLigneActif){
      renvoyerEnSalleEnLigne();
      return;
    }
    nettoyerOverlays();
    retourMenu();
    ouvrirClavier(nomJoueurInput); // « Modifier les joueurs » : clavier prêt pour en ajouter
  });

  function allerAccueil(){
    setTimeout(afficherBandeauMiseAJour, 0); // nouvelle version repérée pendant la partie : proposée maintenant
    if(codePartieActuel) quitterPartie();
    reinitialiserEcransJeu();
    libererEcran();
    document.getElementById("enLigne").style.display = "none";
    document.getElementById("choixMode").style.display = "";
  }

  document.getElementById("btnAccueil").addEventListener("click", allerAccueil);
  // ⌂ du bandeau (mode classique) : pendant une partie, on demande confirmation
  const ecranConfirmerAccueil = document.getElementById("ecranConfirmerAccueil");
  btnAccueilClassique.addEventListener("click", () => {
    if(!partieLancee){
      allerAccueil();
      return;
    }
    ecranConfirmerAccueil.style.display = "";
  });
  document.getElementById("btnConfirmerAccueilOui").addEventListener("click", () => {
    ecranConfirmerAccueil.style.display = "none";
    allerAccueil();
  });
  document.getElementById("btnConfirmerAccueilNon").addEventListener("click", () => {
    ecranConfirmerAccueil.style.display = "none";
  });
  // Écrans en ligne (Créer / Rejoindre / salle d'attente) : quitte la partie éventuelle
  document.getElementById("btnAccueilEnLigne").addEventListener("click", allerAccueil);

  // Remet l'interface de jeu à zéro et la masque (plateau, menu, overlays, liste de joueurs)
  function reinitialiserEcransJeu(){
    nettoyerOverlays();
    retourMenu();
    joueurs = [];
    annulations = {};
    aleatoire = Math.random;
    afficherJoueurs();

    document.body.classList.remove("mode-en-ligne");
    fermerEcranNouvellePartie();
    menu.style.display = "none";
    messagesBar.style.display = "none";
    document.getElementById("jeu").style.display = "none";
  }

  // on force l'UI du menu (au cas où)
  suppression.style.display = "none";

  btnSupprimer.style.display = "inline-block";

  // #endregion

  // #region Mode en ligne : synchronisation des actions, rattrapage
  /* ===== MODE EN LIGNE : synchronisation des actions ===== */
  // Un élément « de jeu » (carte, bouton d'overlay…) est déclaré via surAction :
  // - en classique, le tap exécute directement le handler ;
  // - en ligne, le tap est envoyé à Firebase, et chaque téléphone exécute le handler
  //   quand l'action lui revient, dans l'ordre des numéros (seq).
  // options : owner (nom ou fonction -> nom autorisé, null = tout le monde),
  //           pret() (l'élément peut recevoir l'action maintenant),
  //           valide() (false => action sans objet, ignorée),
  //           once (un seul usage), unique (une seule fois par manche : un 2e envoi est ignoré),
  //           evenement ("pointerdown" par défaut)
  function surAction(el, id, options, handler){
    el.dataset.netId = id;
    el._net = Object.assign({ owner: null, pret: null, valide: null, once: false, unique: false }, options, { handler });

    el.addEventListener(options.evenement || "pointerdown", (e) => {
      if(!enLigneActif){
        handler(e);
        return;
      }
      envoyerAction(el);
    });
  }

  function actionPrete(el){
    if(!el._net || !el.isConnected) return false;
    if(el.disabled || el.dataset.netUtilise) return false;
    if(el.closest("[data-net-ferme]")) return false;
    if(getComputedStyle(el).pointerEvents === "none") return false;
    return el._net.pret ? el._net.pret() : true;
  }

  function proprietaireAction(el){
    const owner = el._net.owner;
    return typeof owner === "function" ? owner() : owner;
  }

  function envoyerAction(el){
    const net = el._net;
    if(net.valide && !net.valide()) return;
    if(!actionPrete(el)) return;

    const owner = proprietaireAction(el);
    if(owner && owner !== pseudoActuel){
      afficherToast(`En attente de ${owner}`);
      return;
    }

    if(net.once){
      if(el.dataset.netEnvoye) return;
      el.dataset.netEnvoye = "1";
    }

    ecrireAction(el.dataset.netId).catch(() => {
      delete el.dataset.netEnvoye;
      afficherToast("Connexion perdue, réessaie");
    });
  }

  // Ajoute une action numérotée à la manche (partie, manche et pseudo lus tout de suite :
  // on peut quitter la partie juste après l'appel)
  function ecrireAction(id){
    const db = window.firebaseDB;
    const code = codePartieActuel;
    const manche = mancheCourante;
    const par = pseudoActuel;
    const vu = prochainSeq - 1;
    const refSeq = window.fbRef(db, `parties/${code}/manches/${manche}/seq`);

    // Deux téléphones qui envoient au même instant : Firebase refuse le 2e (« permission_denied »)
    // au lieu de le faire réessayer. On réessaie nous-mêmes, un peu plus tard (3 fois au plus).
    const reserverNumero = (essai) => window.fbRunTransaction(refSeq, n => (n || 0) + 1).catch((erreur) => {
      noterJournal(`numéro refusé pour ${id} (essai ${essai}) : ${erreur && erreur.message}`);
      if(essai >= 3 || code !== codePartieActuel || manche !== mancheCourante) throw erreur;
      return new Promise(r => setTimeout(r, 60 + Math.random() * 180)).then(() => reserverNumero(essai + 1));
    });

    return reserverNumero(1)
      .then((res) => {
        const seq = res.snapshot.val();
        noterJournal(`envoi ${id} => numéro ${seq}`);
        // Une seule écriture : l'action + la date de dernière activité.
        // « @vu » : dernière action que ce téléphone avait jouée au moment du tap (voir estUnDoublon)
        return window.fbUpdate(window.fbRef(db, `parties/${code}`), {
          [`manches/${manche}/actions/${seq}`]: { id: `${id}@${vu}`, par },
          activite: window.fbServerTimestamp()
        }).catch((erreur) => {
          actionRefusee(code, manche, seq);
          throw erreur;
        });
      });
  }

  // Firebase montre tout de suite à ce téléphone sa propre action (avant l'accord du serveur) : le
  // jeu réagit sans attendre. Si le serveur la refuse ensuite (réseau, serveur), les autres
  // téléphones ne l'ont jamais reçue : ce téléphone ne doit pas la garder.
  // - pas encore appliquée ici => on la retire de la file (elle est sautée partout pareil) ;
  // - déjà appliquée ici => on rejoue toute la manche depuis le serveur (comme une reconnexion).
  let dernierEtatManche = null; // état de la manche en cours (pour la rejouer)

  function actionRefusee(code, manche, seq){
    noterJournal(`refus du serveur pour mon action ${seq}`);
    if(!enLigneActif || code !== codePartieActuel || manche !== mancheCourante) return;

    const action = fileActions.get(seq);
    if(seq > prochainSeq || (seq === prochainSeq && action && !traitementEnCours)){
      fileActions.delete(seq);
      traiterFile();
      return;
    }
    if(seq === prochainSeq && action){
      action.refusee = true; // en cours d'essai (« attendre ») : elle sera sautée
      return;
    }
    resynchroniserManche();
  }

  function resynchroniserManche(){
    if(!dernierEtatManche || !enLigneActif) return;
    noterJournal("remise à jour de la manche depuis le serveur");
    afficherToast("Connexion instable : remise à jour de la partie…", 3000);
    repriseEnCours = true;
    mancheCourante = null; // la même manche est redémarrée, puis rejouée depuis le serveur
    demarrerMancheEnLigne(dernierEtatManche, { resynchro: true });
  }

  // Retrait en ligne : l'action garde le nombre de cartes restantes au moment de la demande.
  // Si une carte a été tirée entre-temps, le retrait est ignoré partout (même résultat sur
  // tous les téléphones) : le demandeur n'a plus qu'à réessayer.
  function idRetrait(nom){
    return `retrait:${cartesRestantes()}:${nom}`;
  }

  function appliquerRetraitEnLigne(action){
    const [, restantes, ...reste] = action.id.split(":");
    const nom = reste.join(":");

    if(!joueurs.includes(nom) || joueurs.length <= 2) return "ignorer";
    if(cartesRestantes() !== Number(restantes)){
      if(action.par === pseudoActuel && !rattrapageEnCours){
        afficherToast("Retrait annulé : une carte venait d'être tirée, réessaie");
      }
      return "ignorer";
    }
    // Overlay qui se ferme tout seul encore affiché ici : on attend qu'il disparaisse
    if(!plateauLibre()) return "attendre";

    const etaitHote = nom === hotePartie;
    retirerJoueurEnJeu(nom);

    // Firebase : fait une seule fois, par celui qui a demandé le retrait
    // (ou le premier joueur restant s'il s'est retiré lui-même)
    const nettoyeur = joueurs.includes(action.par) ? action.par : joueurs[0];
    if(!rattrapageEnCours && pseudoActuel === nettoyeur){
      nettoyerRetraitFirebase(nom, etaitHote ? hotePartie : null);
    }

    if(nom === pseudoActuel){
      // Pendant le rattrapage, c'est un joueur retiré qui revient : il reste, et demandera
      // à être remis dans la manche à la fin du rattrapage (verifierRetourDansManche)
      if(rattrapageEnCours) return "ok";
      const code = codePartieActuel;
      setTimeout(() => {
        if(codePartieActuel !== code) return; // déjà parti
        quitterPartieEnLigne();
        if(action.par === nom) allerAccueil();
        else alerteRetire(code, nom);
      }, 0);
    } else if(!rattrapageEnCours){
      afficherToast(action.par === nom ? `${nom} a quitté la partie` : `${nom} a été retiré de la partie`, 3000);
    }
    return "ok";
  }

  function nettoyerRetraitFirebase(nom, nouvelHote){
    const db = window.firebaseDB;
    const code = codePartieActuel;
    const manche = mancheCourante;

    window.fbSet(window.fbRef(db, `parties/${code}/joueurs/${nom}`), null).catch(() => {});
    if(!nouvelHote) return;

    // Nouvel hôte : même forme d'écriture que le reste du jeu (joueur entier, etatJeu par transaction)
    window.fbGet(window.fbRef(db, `parties/${code}/joueurs/${nouvelHote}`)).then((snapshot) => {
      const joueur = snapshot.val();
      if(joueur) window.fbSet(snapshot.ref, Object.assign({}, joueur, { host: true })).catch(() => {});
    }).catch(() => {});
    window.fbSet(window.fbRef(db, `parties/${code}/hote`), nouvelHote).catch(() => {});
    window.fbRunTransaction(window.fbRef(db, `parties/${code}/etatJeu`), (etat) => {
      if(!etat || etat.manche !== manche) return;
      return Object.assign({}, etat, { hote: nouvelHote });
    }).catch(() => {});
  }

  // Joueur retiré qui revient : tant qu'il n'est pas dans la manche, il la regarde et demande à y
  // être remis (action « retour:<cartes restantes>:<nom> », ou « retour:fin:<nom> » une fois la
  // manche finie). La demande part plateau au repos, sinon on réessaie un peu plus tard.
  function verifierRetourDansManche(){
    clearTimeout(timerRetour);
    timerRetour = null;
    if(!enLigneActif || !pseudoActuel || rattrapageEnCours || retourEnvoye) return;
    if(joueurs.includes(pseudoActuel)){
      retourEnCours = false;
      retourAnnonce = false;
      return;
    }
    retourEnCours = true;

    // Toutes les actions reçues doivent être appliquées ici avant de demander (état à jour)
    const id = (traitementEnCours || fileActions.size > 0) ? null
      : finUnOverlayAffiche ? `retour:fin:${pseudoActuel}`
      : plateauLibre() ? `retour:${cartesRestantes()}:${pseudoActuel}`
      : null;
    if(!id){
      if(!retourAnnonce){
        retourAnnonce = true;
        afficherToast("Tu reviens dans la partie à la fin de l'action en cours…", 3000);
      }
      timerRetour = setTimeout(verifierRetourDansManche, 500);
      return;
    }

    retourEnvoye = true;
    const manche = mancheCourante;
    ecrireAction(id).then(() => {
      // Sécurité : demande jamais traitée (envoi interrompu) => on la refait
      timerRetour = setTimeout(() => {
        if(manche !== mancheCourante) return;
        retourEnvoye = false;
        verifierRetourDansManche();
      }, 20000);
    }).catch(() => {
      retourEnvoye = false;
      if(manche === mancheCourante) timerRetour = setTimeout(verifierRetourDansManche, 2000);
    });
  }

  // Comme le retrait : ignoré si une carte a été tirée depuis la demande (le joueur redemande
  // tout seul), appliqué plateau au repos. Seul le joueur lui-même peut demander son retour.
  function appliquerRetourEnLigne(action){
    const [, restantes, ...reste] = action.id.split(":");
    const nom = reste.join(":");

    let resultat;
    if(action.par !== nom || joueurs.includes(nom)) resultat = "ignorer";
    else if(restantes === "fin") resultat = finUnOverlayAffiche ? "ok" : "attendre";
    else if(finUnOverlayAffiche || cartesRestantes() !== Number(restantes)) resultat = "ignorer";
    else resultat = plateauLibre() ? "ok" : "attendre";
    if(resultat === "attendre") return resultat;

    if(resultat === "ok") ajouterJoueurEnJeu(nom);

    if(nom === pseudoActuel){
      if(!rattrapageEnCours){
        retourEnvoye = false;
        if(resultat === "ok"){
          retourEnCours = false;
          retourAnnonce = false;
          clearTimeout(timerRetour);
          timerRetour = null;
          afficherToast("Te revoilà dans la partie !", 3000);
          // Fiche effacée entre-temps par le nettoyage du retrait : on la remet
          const code = codePartieActuel;
          window.fbGet(window.fbRef(window.firebaseDB, `parties/${code}/joueurs/${nom}`)).then((snapshot) => {
            if(!snapshot.exists() && codePartieActuel === code) remettreFicheJoueur();
          }).catch(() => {});
        } else {
          setTimeout(verifierRetourDansManche, 0); // redemande (ou déjà revenu)
        }
      }
    } else if(resultat === "ok" && !rattrapageEnCours){
      afficherToast(`${nom} est revenu(e) dans la partie`, 3000);
    }
    return resultat;
  }

  // Remet un joueur retiré dans la partie (en ligne, identique sur tous les téléphones) : à sa place
  // d'origine dans l'ordre de la manche (sinon à la fin), sans changer à qui c'est le tour
  function ajouterJoueurEnJeu(nom){
    if(joueurs.includes(nom)) return false;

    const rang = ordreManche.indexOf(nom);
    let idx = rang < 0 ? -1 : joueurs.findIndex((j) => {
      const r = ordreManche.indexOf(j);
      return r < 0 || r > rang;
    });
    if(idx < 0) idx = joueurs.length;

    const courant = joueurs.length > 0 ? indexJoueur % joueurs.length : 0;
    joueurs.splice(idx, 0, nom);
    annulations[nom] = 0;
    indexJoueur = idx <= courant ? courant + 1 : courant;
    if(indexPigeon !== null && indexPigeon >= idx) indexPigeon++;

    afficherJoueurs();
    afficherJoueurActif();
    return true;
  }

  // "ok" | "attendre" (élément pas encore là / pas prêt) | "ignorer" (action devenue sans objet)
  function tenterAction(action){
    if(action.id.startsWith("retrait:")) return appliquerRetraitEnLigne(action);
    if(action.id.startsWith("retour:")) return appliquerRetourEnLigne(action);

    // Bouton à usage unique dans la manche (ex. « Terminer ») déjà appliqué : si deux joueurs
    // ont appuyé en même temps, le 2e appui est ignoré au lieu d'attendre un bouton disparu
    if(idsUniquesUtilises.has(action.id)) return "ignorer";

    const candidats = Array.from(document.querySelectorAll("[data-net-id]"))
      .filter(el => el.dataset.netId === action.id);

    const el = candidats.find(actionPrete);
    if(!el){
      if(candidats.some(c => c._net && c._net.valide && !c._net.valide())) return "ignorer";
      return "attendre";
    }

    if(el._net.valide && !el._net.valide()) return "ignorer";

    // Vérifié au moment du rejeu (état identique partout) : bloque par ex. un double tap
    // qui aurait envoyé une 2e carte alors que ce n'était déjà plus son tour
    const owner = proprietaireAction(el);
    if(owner && owner !== action.par) return "ignorer";

    if(el._net.once) el.dataset.netUtilise = "1";
    if(el._net.unique) idsUniquesUtilises.add(action.id);
    el._net.handler();
    return "ok";
  }

  function traiterFile(){
    if(traitementEnCours || !enLigneActif) return;

    const action = fileActions.get(prochainSeq);
    if(!action){
      // Trou dans la numérotation (envoi interrompu ou refusé par le serveur) : on le saute au
      // bout de 5 s, dès qu'une action plus loin existe. Pendant un rattrapage, les numéros
      // jusqu'à la fin du rattrapage ont tous été réservés : un trou est sauté même s'il est le dernier.
      const plusLoin = Array.from(fileActions.keys()).some(k => k > prochainSeq) ||
        (rattrapageEnCours && prochainSeq <= seqFinRattrapage);
      if(plusLoin && !timerTrou){
        const attendu = prochainSeq;
        const generation = generationFile;
        timerTrou = setTimeout(() => {
          timerTrou = null;
          if(generation !== generationFile) return;
          if(prochainSeq === attendu && !fileActions.has(attendu)){
            noterJournal(`trou ${attendu} sauté`);
            prochainSeq++;
            apresActionTraitee();
          }
          // Toujours : si la file a avancé entre-temps jusqu'à un autre trou, il faut le
          // repérer maintenant (sinon plus rien ne relance la vérification)
          traiterFile();
        }, 5000);
      }
      return;
    }

    traitementEnCours = true;
    const manche = mancheCourante;
    const generation = generationFile;
    let attente = 0;
    let attenteNotee = false; // journal : une seule ligne « attendre » par action

    const essayer = () => {
      if(manche !== mancheCourante || generation !== generationFile) return;

      // Action refusée par le serveur pendant qu'on attendait de pouvoir l'appliquer : sautée
      const resultat = (action.refusee || estUnDoublon(action)) ? "ignorer" : tenterAction(action);
      if(resultat === "ok") actionsAppliquees.set(`${action.par}|${action.id}`, prochainSeq);
      if(resultat !== "attendre" || !attenteNotee) noterJournal(`${prochainSeq} ${action.id} (${action.par}) => ${resultat}`);
      if(resultat === "attendre") attenteNotee = true;
      // On attend que l'overlay concerné soit affiché chez nous (max 30 s d'écran allumé)
      if(resultat === "attendre" && attente < 30000){
        const pas = rattrapageEnCours ? 20 : 120;
        if(document.visibilityState === "visible") attente += pas;
        setTimeout(essayer, pas);
        return;
      }

      fileActions.delete(prochainSeq);
      prochainSeq++;
      traitementEnCours = false;
      apresActionTraitee();

      traiterFile();
    };

    essayer();
  }

  // Diagnostic (console du navigateur / tests) : état de la file d'actions en ligne
  // + journal des dernières actions traitées (numéro, action, joueur => résultat)
  const journalFile = [];
  function noterJournal(texte){
    journalFile.push(texte);
    if(journalFile.length > 120) journalFile.shift();
  }

  window.__etatFileAlcuno = () => ({
    prochainSeq, seqFinRattrapage, rattrapageEnCours, traitementEnCours,
    trouEnAttente: !!timerTrou, actions: Array.from(fileActions.keys()), journal: journalFile.slice()
  });

  // Après chaque action traitée (ou trou sauté) : fin du rattrapage quand tout est rejoué
  function apresActionTraitee(){
    if(!rattrapageEnCours) return;
    if(prochainSeq > seqFinRattrapage){
      finirRattrapage();
      setTimeout(verifierRetourDansManche, 0); // joueur retiré qui revient : il demande sa place
    }
    else majRattrapage();
  }

  // Doublon : le même joueur a tapé deux fois le même élément avant que son 1er tap revienne du
  // serveur (tap rapide, réseau lent). Si ce même tap a déjà été appliqué APRÈS ce que l'expéditeur
  // avait vu, le 2e est ignoré. Décidé uniquement avec la file d'actions : pareil sur tous les
  // téléphones (avant, il restait en attente sur l'élément disparu : abandonné au bout de 30 s sur
  // un écran allumé, attendu pour toujours sur un écran éteint => téléphones décalés).
  // Exceptions : les boutons qu'on tape exprès plusieurs fois de suite (+1 et Retour du +4).
  let actionsAppliquees = new Map(); // "joueur|action" -> numéro de la dernière fois appliquée
  const ACTIONS_REPETABLES = ["plus4:joueur:", "plus4:annuler", "plus4:reset"];

  function estUnDoublon(action){
    if(typeof action.vu !== "number") return false;
    if(ACTIONS_REPETABLES.some(debut => action.id.startsWith(debut))) return false;
    const derniere = actionsAppliquees.get(`${action.par}|${action.id}`);
    return derniere !== undefined && derniere > action.vu;
  }

  function reinitialiserFileActions(){
    generationFile++; // une action de l'ancienne file encore en attente s'arrête
    actionsAppliquees = new Map();
    fileActions = new Map();
    prochainSeq = 1;
    traitementEnCours = false;
    if(timerTrou){ clearTimeout(timerTrou); timerTrou = null; }
    idsUniquesUtilises = new Set();
    finirRattrapage();
  }

  // ===== Rattrapage (reconnexion en pleine manche) =====
  // Le téléphone rejoue toutes les actions déjà faites, délais quasi nuls (delai()) ;
  // un écran « Retour dans la partie… » cache les overlays qui défilent en accéléré.
  function commencerRattrapage(cible){
    rattrapageEnCours = true;
    seqFinRattrapage = cible;
    document.body.classList.add("rattrapage");

    let ecran = document.getElementById("ecranRattrapage");
    if(!ecran){
      ecran = document.createElement("div");
      ecran.id = "ecranRattrapage";
      document.body.appendChild(ecran);
    }
    majRattrapage();
  }

  function majRattrapage(){
    const ecran = document.getElementById("ecranRattrapage");
    if(!ecran) return;
    const fait = Math.min(prochainSeq - 1, seqFinRattrapage);
    ecran.innerText = `Retour dans la partie…\n${fait} / ${seqFinRattrapage}`;
  }

  function finirRattrapage(){
    rattrapageEnCours = false;
    seqFinRattrapage = 0;
    document.body.classList.remove("rattrapage");
    const ecran = document.getElementById("ecranRattrapage");
    if(ecran) ecran.remove();
  }

  function ecouterActions(){
    if(desabonnerActions) desabonnerActions();
    const refActions = window.fbRef(
      window.firebaseDB,
      `parties/${codePartieActuel}/manches/${mancheCourante}/actions`
    );

    desabonnerActions = window.fbOnChildAdded(refActions, (snapshot) => {
      // « id@vu » => id + vu (dernière action jouée par l'expéditeur au moment du tap)
      const action = Object.assign({}, snapshot.val());
      const morceaux = /^(.*)@(\d+)$/.exec(String(action.id));
      if(morceaux){
        action.id = morceaux[1];
        action.vu = Number(morceaux[2]);
      }
      fileActions.set(Number(snapshot.key), action);
      traiterFile();
    });
  }

  // Générateur pseudo-aléatoire à graine (mulberry32) : même graine => même mélange sur tous les téléphones
  function generateurAleatoire(seed){
    let a = seed >>> 0;
    return function(){
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function nettoyerOverlays(){
    generationPartie++;
    document.querySelectorAll('[id^="overlay"]').forEach(el => el.remove());
    if(overlayRegleTimeout){
      clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = null;
    }
    overlayRegleVerrouille = false;
    predictionEnCours = false;
    predictions = null;
  }

  // options.resynchro : même manche rejouée depuis le serveur (voir resynchroniserManche)
  function demarrerMancheEnLigne(etat, options = {}){
    const etaitEnJeu = enLigneActif;
    dernierEtatManche = etat;
    enLigneActif = true;
    mancheCourante = etat.manche;
    hotePartie = etat.hote;
    reinitialiserFileActions();

    nettoyerOverlays();
    joueurs = Object.values(etat.joueurs || {});
    ordreManche = joueurs.slice();
    annulations = {};
    retourMenu();

    // Demande de retour faite dans la manche précédente : elle n'y sera jamais traitée
    retourEnvoye = false;
    clearTimeout(timerRetour);
    timerRetour = null;

    aleatoire = generateurAleatoire(etat.seed);
    lancerPartie();

    // Manche relancée pendant une partie (« Rejouer ») et pas depuis la salle d'attente
    if(etaitEnJeu && !options.resynchro) annoncerNouvellePartie();

    document.body.classList.add("mode-en-ligne");
    fermerEcranNouvellePartie();
    fermerConfirmationHote();
    document.getElementById("enLigne").style.display = "none";
    messagesBar.style.display = "";
    document.getElementById("jeu").style.display = "";
    afficherBadgeCode();

    if(!repriseEnCours){
      ecouterActions();
      verifierRetourDansManche(); // pas dans la nouvelle manche (joueur qui revenait) : il demande sa place
      return;
    }

    // Reconnexion en pleine manche : on regarde combien d'actions ont déjà été jouées,
    // puis on les rejoue toutes en accéléré avant de reprendre normalement
    repriseEnCours = false;
    const code = codePartieActuel;
    const manche = etat.manche;
    window.fbGet(window.fbRef(window.firebaseDB, `parties/${code}/manches/${manche}/seq`))
      .then((snapshot) => {
        if(manche !== mancheCourante) return;
        const cible = Number(snapshot.val() || 0);
        if(cible > 0) commencerRattrapage(cible);
        ecouterActions();
        if(cible === 0) verifierRetourDansManche();
      })
      .catch(() => {
        if(manche !== mancheCourante) return;
        ecouterActions();
        verifierRetourDansManche();
      });
  }

  // Code de la partie, discret : petit bouton 🔑 en bas à gauche, accessible par-dessus les overlays
  // (même en plein duel). Un tap affiche « Code : XXXXX » quelques secondes, pour le redonner
  // à un joueur déconnecté.
  function afficherBadgeCode(){
    let bouton = document.getElementById("btnCodePartie");
    if(!bouton){
      bouton = document.createElement("button");
      bouton.type = "button";
      bouton.id = "btnCodePartie";
      bouton.setAttribute("aria-label", "Voir le code de la partie");
      bouton.innerHTML = '<span class="cle" aria-hidden="true">🔑</span><span class="texte"></span>';
      bouton.addEventListener("click", () => {
        bouton.classList.toggle("ouvert");
        clearTimeout(bouton._minuteur);
        if(bouton.classList.contains("ouvert")){
          bouton._minuteur = setTimeout(() => bouton.classList.remove("ouvert"), 6000);
        }
      });
      document.body.appendChild(bouton);
    }
    bouton.querySelector(".texte").innerText = "Code : " + codePartieActuel;
    bouton.classList.remove("ouvert");
  }

  function afficherToast(message, duree = 1800){
    let toast = document.getElementById("toastEnLigne");
    if(!toast){
      toast = document.createElement("div");
      toast.id = "toastEnLigne";
      document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add("visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("visible"), duree);
  }

  // #endregion

  // #region Bouton retour du téléphone et démarrage du jeu
  /* ===== BOUTON RETOUR DU TÉLÉPHONE (Android) ET DU NAVIGATEUR (Safari, PC) ===== */
  // Le téléphone ne prévient la page que si elle a ajouté des entrées dans l'historique.
  // On en garde quelques-unes d'avance, ajoutées pendant un tap (sinon Chrome les saute),
  // et chaque retour fait la même chose que le bouton « Retour » de l'écran affiché.
  const NB_ENTREES_RETOUR = 3;
  let entreesRetour = 0;

  function estVisible(el){
    return !!el && el.getClientRects().length > 0;
  }

  function taper(el){
    el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  }

  // Certains boutons réagissent au tap (pointerdown), d'autres au clic
  function activer(id){
    const bouton = document.getElementById(id);
    taper(bouton);
    bouton.click();
  }

  // true = retour fait dans l'appli ; false = déjà sur l'écran d'accueil
  function retourDansLAppli(){
    if(estVisible(document.getElementById("ecranRattrapage"))) return true;

    const annonce = document.getElementById("annonceNouvellePartie");
    if(annonce){ taper(annonce); return true; }

    if(estVisible(ecranCredits)){ activer("btnFermerCredits"); return true; }
    if(estVisible(ecranReglages)){ activer("btnFermerReglages"); return true; }

    // Overlays du jeu : le plus récent se ferme comme au tap (ceux où il faut choisir ne bougent pas),
    // sauf le +4 où « Retour » enlève la dernière gorgée distribuée
    const overlays = Array.from(document.querySelectorAll('[id^="overlay"]')).filter(estVisible);
    if(overlays.length){
      const dessus = overlays[overlays.length - 1];
      const btnRetour = Array.from(dessus.querySelectorAll("button"))
        .find(b => b.innerText.trim() === "Retour");
      if(!btnRetour) taper(dessus);
      else if(!btnRetour.disabled) taper(btnRetour);
      return true;
    }

    const ecrans = [
      ["ecranConfirmerHote", "btnConfirmerHoteNon"],
      ["ecranConfirmerRetrait", "btnConfirmerRetraitNon"],
      ["ecranConfirmerAccueil", "btnConfirmerAccueilNon"],
      ["ecranChoixPseudo", "btnChoixPseudoAnnuler"],
      ["ecranNouvellePartie", "btnRetourNouvellePartie"],
      ["suppression", "termineSuppression"],
      ["enLigneRevenir", "btnRetourRevenir"],
      ["enLigneCreer", "btnRetourCreer"],
      ["enLigneRejoindre", "btnRetourRejoindre"],
      ["salleAttente", "btnQuitterSalle"],
      ["enLigneChoix", "btnRetourChoixMode"]
    ];
    for(const [ecran, bouton] of ecrans){
      if(estVisible(document.getElementById(ecran))){
        activer(bouton);
        return true;
      }
    }

    // Plateau (classique ou en ligne) : même chose que ⌂, avec confirmation si une partie est en cours
    if(estVisible(menu) || estVisible(document.getElementById("jeu"))){
      if(partieLancee) ecranConfirmerAccueil.style.display = "";
      else allerAccueil();
      return true;
    }

    return false;
  }

  function preparerRetour(e){
    if(e && !e.isTrusted) return;
    while(entreesRetour < NB_ENTREES_RETOUR){
      history.pushState({ alcunoRetour: true }, "");
      entreesRetour++;
    }
  }

  document.addEventListener("pointerdown", preparerRetour, { capture: true, passive: true });

  window.addEventListener("popstate", () => {
    if(entreesRetour === 0) return;
    entreesRetour--;

    if(retourDansLAppli()){
      if(navigator.userActivation && navigator.userActivation.isActive) preparerRetour();
      return;
    }

    // Écran d'accueil : on retire nos entrées, le prochain retour quitte l'appli
    if(entreesRetour > 0){
      const n = entreesRetour;
      entreesRetour = 0;
      history.go(-n);
    }
    afficherToast("Appuie encore une fois sur retour pour quitter");
  });

  /* ===== INIT ===== */
  window.addEventListener("scroll", repositionnerStickyJoueurActif, { passive: true });
  window.addEventListener("resize", () => { hautMinSticky = null; repositionnerStickyJoueurActif(); });

  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", repositionnerStickyJoueurActif);
    window.visualViewport.addEventListener("scroll", repositionnerStickyJoueurActif);
  }

  creerUIJoueurActifSticky();
  afficherJoueurs();
  majStickyJoueurActif();
  window.addEventListener("resize", () => {
    centrerDerniereLigne();
  });
  // #endregion
});