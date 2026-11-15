// =============================================================================================
// ALCUNO : Profil joueur (connexion Google, facultative) : garde la progression dans Firebase pour la retrouver
// sur un autre téléphone ou après avoir vidé le navigateur.
// (fichier chargé en dernier dans index.html : il se sert de js/reglages.js, js/stickers.js, js/zizi-coptere.js)
//
// Ce qui est gardé (profils/<uid> dans Firebase, lisible et modifiable seulement par son propriétaire, voir database.rules.json) :
//   - les déblocages (thèmes secrets, mode hard, album, zizi-coptère) : on garde l'UNION des deux côtés, rien ne se perd ;
//   - l'album de stickers : union des stickers gagnés, plus grand nombre de parties ;
//   - les réglages (thème, sons, voix, langue…) : le dernier modifié gagne ; à la première connexion sur un téléphone,
//     ce sont ceux du profil qui sont repris.
// Ce qui ne quitte jamais le téléphone : l'éthylotest (poids, sexe), le journal du mouchard, la partie en cours, les codes.
// Rien de personnel n'est écrit dans la base : ni nom ni adresse e-mail (ils restent dans Firebase Authentication).
//
// Sans compte, rien ne change : le jeu marche comme avant, hors connexion aussi. Firebase Authentication n'est téléchargé
// que si ce téléphone est déjà connecté à un profil, ou à l'ouverture des Réglages (pour que « Se connecter » ouvre la
// fenêtre Google tout de suite : un navigateur bloque une fenêtre ouverte trop longtemps après le tap).
//
// L'appli Firebase du profil a son propre nom (« profil ») : sa connexion n'est pas celle de la page des statistiques
// (stats.html, compte administrateur), et le reste du jeu continue de parler à la base sans être connecté.
// =============================================================================================
// #region Profil joueur : fusion (sans navigateur, testée par tests/test_profil.js)
(function(global){
  // id du déblocage -> clé du stockage local (valeur "1")
  const DEBLOCAGES = {
    prestige: "alcuno_theme_prestige", galaxie: "alcuno_theme_galaxie", donjon: "alcuno_theme_donjon", kawaii: "alcuno_theme_kawaii",
    hard: "alcuno_hard_debloque", album: "alcuno_album_decouvert", zizi: "alcuno_zizi_coptere"
  };
  // Réglages gardés : la clé du stockage local sans « alcuno_ ». En ajouter un : ici ET dans database.rules.json (profils > reglages)
  const REGLAGES = ["theme", "langue", "accessibilite", "faces_fermees", "sons", "volume", "musique", "volume_musique", "rappel_eau", "gaucher",
                    "feux_artifice", "vibrations", "ordre_reglages", "voix", "vitesse_voix", "ecran_allume", "reglages_vue"];
  // (les mêmes que STICKERS dans js/stickers.js : tests/test_profil.js le vérifie)
  const STICKERS_CONNUS = ["cupcake", "chat", "lapin", "poussin", "etoile", "licorne", "fraise", "sushi", "macaron", "chou", "nuage"];
  const VALEUR_MAX = 600; // (longueur d'un réglage : l'ordre des Réglages fait environ 200 caractères)

  const objet = (o) => (o && typeof o === "object" ? o : {});
  // Remet un profil (lu dans Firebase ou construit ici) dans une forme sûre : seul le connu et le bien formé est gardé
  function normaliser(p){
    p = objet(p);
    const debloque = {};
    Object.keys(DEBLOCAGES).forEach((id) => { if (objet(p.debloque)[id] === true) debloque[id] = true; });
    const s = objet(p.stickers);
    const gagnesBruts = Array.isArray(s.gagnes) ? s.gagnes : Object.keys(objet(s.gagnes)).filter((id) => s.gagnes[id] === true);
    const gagnes = STICKERS_CONNUS.filter((id) => gagnesBruts.includes(id));
    const fins = Object.values(objet(s.fins)).map(Number).filter((n) => n > 0 && isFinite(n)).sort((a, b) => a - b).slice(-5);
    let reglages = null;
    if (p.reglages && typeof p.reglages === "object" && isFinite(Number(p.reglages.maj)) && Number(p.reglages.maj) > 0) {
      const valeurs = {};
      REGLAGES.forEach((cle) => { const v = objet(p.reglages.valeurs)[cle]; if (typeof v === "string" && v.length <= VALEUR_MAX) valeurs[cle] = v; });
      reglages = { maj: Number(p.reglages.maj), valeurs };
    }
    return { debloque, stickers: { gagnes, parties: Math.max(0, Math.floor(Number(s.parties) || 0)), fins }, reglages };
  }
  // Forme écrite dans Firebase (les stickers gagnés en { id: true } : pas de tableau à trous)
  function enForme(n){
    const gagnes = {};
    n.stickers.gagnes.forEach((id) => { gagnes[id] = true; });
    const p = { v: 1, debloque: n.debloque, stickers: { gagnes, parties: n.stickers.parties, fins: n.stickers.fins } };
    if (n.reglages) p.reglages = { maj: n.reglages.maj, valeurs: n.reglages.valeurs };
    return p;
  }
  // Texte identique pour deux objets de même contenu, quel que soit l'ordre de leurs clés
  function stable(o){
    if (Array.isArray(o)) return "[" + o.map(stable).join(",") + "]";
    if (o && typeof o === "object") return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}";
    return JSON.stringify(o);
  }

  // local   : { debloque: { id: true }, stickers: { gagnes: [], parties, fins: [] }, reglages: { cle: "valeur" } } (ce téléphone)
  // distant : ce qui est dans Firebase (null : pas encore de profil)
  // vu      : { maj, reglages } à la dernière synchronisation de CE téléphone avec CE compte (null : jamais)
  // Rend { profil (à écrire dans Firebase), ecrire (faut-il l'écrire), local (à poser sur le téléphone), reglagesChanges,
  //        nouveauxDeblocages, nouveauxStickers (ce que le téléphone n'avait pas) }
  function fusionner(local, distant, vu, maintenant){
    const l = normaliser({ debloque: objet(local).debloque, stickers: objet(local).stickers, reglages: { maj: 1, valeurs: objet(local).reglages } });
    const d = normaliser(distant);
    const debloque = Object.assign({}, d.debloque, l.debloque);
    const gagnes = STICKERS_CONNUS.filter((id) => l.stickers.gagnes.includes(id) || d.stickers.gagnes.includes(id));
    const fins = Array.from(new Set(l.stickers.fins.concat(d.stickers.fins))).sort((a, b) => a - b).slice(-5);
    const stickers = { gagnes, parties: Math.max(l.stickers.parties, d.stickers.parties), fins };

    const reglagesLocaux = l.reglages.valeurs;
    const localModifie = !!vu && stable(reglagesLocaux) !== stable(objet(vu.reglages));
    let reglages;
    if (!d.reglages) reglages = { maj: maintenant, valeurs: reglagesLocaux };                    // profil sans réglages : ceux du téléphone
    else if (!vu) reglages = d.reglages;                                                         // première fois ici : ceux du profil
    else if (localModifie) reglages = { maj: maintenant, valeurs: reglagesLocaux };              // modifiés ici depuis : ils gagnent
    else reglages = d.reglages;                                                                  // sinon ceux du profil (modifiés ailleurs, ou identiques)
    const reglagesChanges = stable(reglages.valeurs) !== stable(reglagesLocaux); // (le téléphone doit reprendre ceux du profil)

    const fusion = { debloque, stickers, reglages };
    return {
      profil: enForme(fusion),
      ecrire: stable(enForme(fusion)) !== stable(enForme(d)),
      local: { debloque, stickers, reglages: reglages.valeurs },
      reglagesChanges,
      nouveauxDeblocages: Object.keys(debloque).filter((id) => !l.debloque[id]),
      nouveauxStickers: gagnes.filter((id) => !l.stickers.gagnes.includes(id))
    };
  }

  global.ProfilLib = { DEBLOCAGES, REGLAGES, STICKERS_CONNUS, VALEUR_MAX, normaliser, enForme, stable, fusionner };
  if (typeof module !== "undefined" && module.exports) module.exports = global.ProfilLib;
})(typeof window !== "undefined" ? window : globalThis);
// #endregion

// #region Profil joueur : connexion et synchronisation (navigateur)
if (typeof document !== "undefined" && !document.documentElement.classList.contains("mode-tele")) (function(){
  const bloc = document.querySelector('#ecranReglages [data-cle="compte"]');
  if (!bloc) return;
  const L = window.ProfilLib;
  const CLE_PROFIL = "alcuno_profil"; // { uid, nom, maj, reglages } : le compte de ce téléphone et ce qu'il a vu à la dernière synchronisation
  const CLE_RECHARGE = "alcuno_profil_recharge"; // (sessionStorage : heure du dernier rechargement fait pour appliquer des réglages)
  const DELAI_LECTURE = 12000;
  const note = document.getElementById("texteProfil");
  const btnConnexion = document.getElementById("btnProfilConnexion");
  const btnSupprimer = document.getElementById("btnProfilSupprimer");
  const ligneSupprimer = document.getElementById("ligneProfilSupprimer");

  let fb = null;            // fonctions de Firebase (auth + base), une fois téléchargées
  let auth = null, base = null;
  let utilisateur = null;
  let chargement = null;
  let enCours = false, aRefaire = false;
  let connexionVoulue = false; // (on vient d'appuyer sur « Se connecter » : message et rechargement si besoin)
  let occupe = false;          // (fenêtre Google ouverte, suppression en cours)
  let etatTexte = "";          // message à la place de la note habituelle (erreur, « Sauvegarde… »)
  let dernierInstantane = null;

  const lireEtat = () => {
    try { const e = JSON.parse(localStorage.getItem(CLE_PROFIL) || "null"); return e && typeof e === "object" && typeof e.uid === "string" ? e : null; } catch (e) { return null; }
  };
  const ecrireEtat = (e) => { try { if (e) localStorage.setItem(CLE_PROFIL, JSON.stringify(e)); else localStorage.removeItem(CLE_PROFIL); } catch (err) {} };
  const lire = (cle) => { try { return localStorage.getItem(cle); } catch (e) { return null; } };

  // ----- Ce que ce téléphone a (lu dans le stockage local) -----
  function profilLocal(){
    const debloque = {};
    Object.keys(L.DEBLOCAGES).forEach((id) => { if (lire(L.DEBLOCAGES[id]) === "1") debloque[id] = true; });
    const album = typeof lireAlbum === "function" ? lireAlbum() : { gagnes: [], parties: 0, fins: [] };
    const reglages = {};
    L.REGLAGES.forEach((cle) => { const v = lire("alcuno_" + cle); if (v !== null && v.length <= L.VALEUR_MAX) reglages[cle] = v; });
    return { debloque, stickers: { gagnes: album.gagnes, parties: album.parties, fins: album.fins }, reglages };
  }
  const instantane = () => L.stable(profilLocal());

  // ----- Poser sur le téléphone ce qui vient du profil (sans fenêtre « débloqué » ni « NOUVEAU » : ce n'est pas une découverte) -----
  const APRES_DEBLOCAGE = {
    prestige: () => majPastillePrestige(), galaxie: () => majPastilleGalaxie(), donjon: () => majPastilleDonjon(), kawaii: () => majPastilleKawaii(),
    hard: () => majOptionHard(), album: () => majAlbumVisible(), zizi: () => majZiziCoptere()
  };
  function poserLocal(r){
    r.nouveauxDeblocages.forEach((id) => {
      try { localStorage.setItem(L.DEBLOCAGES[id], "1"); } catch (e) {}
      try { APRES_DEBLOCAGE[id](); } catch (e) {}
    });
    const album = typeof lireAlbum === "function" ? lireAlbum() : null;
    if (album && typeof ecrireAlbum === "function" && L.stable(album) !== L.stable(r.local.stickers)) ecrireAlbum(r.local.stickers);
    // Album complet reconstitué à partir de deux téléphones : le thème Kawaii va avec (envoyé au profil à la synchronisation suivante)
    if (r.local.stickers.gagnes.length >= L.STICKERS_CONNUS.length && lire(L.DEBLOCAGES.kawaii) !== "1") {
      try { localStorage.setItem(L.DEBLOCAGES.kawaii, "1"); } catch (e) {}
      try { majPastilleKawaii(); } catch (e) {}
    }
    if (!r.reglagesChanges) return;
    L.REGLAGES.forEach((cle) => {
      try {
        if (Object.prototype.hasOwnProperty.call(r.local.reglages, cle)) localStorage.setItem("alcuno_" + cle, r.local.reglages[cle]);
        else localStorage.removeItem("alcuno_" + cle);
      } catch (e) {}
    });
  }

  // Les réglages repris du profil sont lus au chargement du jeu : on recharge la page, mais seulement depuis l'accueil
  // (jamais en partie ni dans une salle d'attente), et pas deux fois de suite. Sinon, ils seront là au prochain lancement.
  function rechargerSiPossible(){
    try {
      const accueil = document.getElementById("choixMode");
      const surAccueil = accueil && getComputedStyle(accueil).display !== "none";
      if (!surAccueil || partieLancee || codePartieActuel) return false;
      if (Date.now() - Number(sessionStorage.getItem(CLE_RECHARGE) || 0) < 20000) return false;
      sessionStorage.setItem(CLE_RECHARGE, String(Date.now()));
      const ouverts = ecranReglages.style.display !== "none" && !ecranReglages.classList.contains("page-sortie");
      if (ouverts) sessionStorage.setItem(CLE_ROUVRIR_REGLAGES, String(ecranReglages.scrollTop)); // (les Réglages se rouvrent au même endroit)
    } catch (e) { return false; }
    if (typeof rechargerPage === "function") rechargerPage(); else location.reload();
    return true;
  }

  // ----- Affichage du bloc des Réglages -----
  function majBloc(){
    const etat = lireEtat();
    const connecte = !!utilisateur;
    const nom = connecte ? (utilisateur.displayName || utilisateur.email || "") : "";
    bloc.classList.toggle("profil-connecte", connecte);
    btnConnexion.textContent = connecte ? tr("Se déconnecter") : tr("Se connecter");
    btnConnexion.disabled = occupe;
    ligneSupprimer.hidden = !connecte;
    if (etatTexte) note.textContent = etatTexte;
    else if (connecte) note.textContent = (nom ? tr`Connecté : ${nom}.` + " " : "") + tr("Ta progression est sauvegardée.");
    else if (etat && !auth) note.textContent = tr("Connexion à ton profil…");
    else note.textContent = tr("Connecte-toi avec Google pour retrouver ta progression sur un autre téléphone.");
  }
  const dire = (texte) => { etatTexte = texte || ""; majBloc(); };
  const notifier = (texte) => { try { afficherNotificationHaut("", texte, true); } catch (e) {} };

  // ----- Firebase (appli à part, nommée « profil ») -----
  function charger(){
    if (auth) return Promise.resolve();
    if (chargement) return chargement;
    const adresse = window.ADRESSE_FIREBASE, config = window.CONFIG_FIREBASE;
    if (!adresse || !config) return Promise.reject(new Error("config"));
    chargement = Promise.all([import(adresse + "firebase-app.js"), import(adresse + "firebase-database.js"), import(adresse + "firebase-auth.js")])
      .then(([a, d, au]) => {
        const appli = a.initializeApp(config, "profil");
        fb = { ref: d.ref, get: d.get, set: d.set, remove: d.remove, GoogleAuthProvider: au.GoogleAuthProvider, signInWithPopup: au.signInWithPopup,
               signOut: au.signOut, deleteUser: au.deleteUser };
        base = d.getDatabase(appli);
        auth = au.getAuth(appli);
        au.onAuthStateChanged(auth, surChangementDeCompte);
      })
      .catch((e) => { chargement = null; throw e; }); // (réessayé plus tard)
    return chargement;
  }

  function surChangementDeCompte(u){
    utilisateur = u || null;
    if (!utilisateur) {
      // (session expirée ou compte supprimé ailleurs : ce téléphone n'est plus lié, on ne retélécharge plus l'authentification au lancement)
      ecrireEtat(null);
      dernierInstantane = null;
      majBloc();
      return;
    }
    majBloc();
    synchroniser();
  }

  const avecDelai = (promesse, ms) => Promise.race([promesse, new Promise((_, rejet) => setTimeout(() => rejet(new Error("delai")), ms))]);

  // Lit le profil, le fusionne avec le téléphone, pose le résultat des deux côtés
  function synchroniser(){
    if (!utilisateur || !base) return;
    if (enCours) { aRefaire = true; return; }
    enCours = true;
    const moi = utilisateur, voulue = connexionVoulue;
    connexionVoulue = false;
    const chemin = fb.ref(base, "profils/" + moi.uid);
    let recharge = false;
    avecDelai(fb.get(chemin), DELAI_LECTURE)
      .then((photo) => {
        if (utilisateur !== moi) return null;
        const etat = lireEtat();
        const vu = etat && etat.uid === moi.uid && etat.maj ? { maj: etat.maj, reglages: etat.reglages } : null;
        const r = L.fusionner(profilLocal(), photo.val(), vu, Date.now());
        poserLocal(r);
        const fin = () => {
          ecrireEtat({ uid: moi.uid, nom: moi.displayName || "", maj: r.profil.reglages.maj, reglages: r.local.reglages });
          dernierInstantane = instantane();
          return r;
        };
        return r.ecrire ? avecDelai(fb.set(chemin, r.profil), DELAI_LECTURE).then(fin) : fin();
      })
      .then((r) => {
        if (!r) return;
        etatTexte = "";
        const n = r.nouveauxDeblocages.length + r.nouveauxStickers.length;
        if (r.reglagesChanges) recharge = rechargerSiPossible();
        if (recharge) return;
        if (voulue) notifier(n ? tr`Profil retrouvé ! Déblocages et stickers récupérés : ${n}` : tr("Profil connecté : ta progression est sauvegardée."));
        else if (n) notifier(tr`Profil : déblocages et stickers récupérés : ${n}`);
      })
      .catch(() => {
        // (pas de réseau, base injoignable, règles pas encore publiées : on réessaiera, rien n'est perdu sur le téléphone)
        if (voulue) etatTexte = tr("Connecté, mais la sauvegarde n'a pas pu se faire. Elle sera retentée.");
      })
      .then(() => {
        enCours = false;
        if (recharge) return;
        majBloc();
        if (aRefaire) { aRefaire = false; synchroniser(); }
      });
  }

  // Quelque chose a changé sur le téléphone depuis la dernière synchronisation (réglage, sticker, déblocage) : on envoie
  function verifier(){
    if (!utilisateur || enCours || !navigator.onLine) return;
    if (dernierInstantane !== null && instantane() === dernierInstantane) return;
    synchroniser();
  }

  // ----- Boutons -----
  function messageErreur(e){
    const code = (e && e.code) || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return "";
    if (code === "auth/popup-blocked") return tr("Fenêtre bloquée par le navigateur : autorise les fenêtres pop-up, puis réessaie.");
    if (code === "auth/network-request-failed" || !navigator.onLine) return tr("Pas de connexion internet : réessaie plus tard.");
    if (code === "auth/operation-not-supported-in-this-environment" || code === "auth/web-storage-unsupported") return tr("Connexion impossible ici : ouvre le jeu dans ton navigateur (Chrome, Safari), puis réessaie.");
    // (console Firebase : fournisseur Google pas activé, domaine du jeu pas autorisé, ou création de comptes désactivée : voir PILOTAGE.md)
    if (code === "auth/operation-not-allowed" || code === "auth/unauthorized-domain" || code === "auth/admin-restricted-operation") return tr("La connexion Google n'est pas encore activée pour le jeu.");
    return tr("Connexion impossible pour le moment. Réessaie plus tard.");
  }
  function connecter(){
    if (occupe) return;
    occupe = true;
    dire(tr("Connexion…"));
    const ouvrir = () => fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
    // (authentification déjà téléchargée, cas normal : la fenêtre Google s'ouvre dans le tap lui-même)
    connexionVoulue = true;
    (auth ? ouvrir() : charger().then(ouvrir))
      .then(() => { occupe = false; etatTexte = ""; majBloc(); })
      .catch((e) => { occupe = false; connexionVoulue = false; dire(messageErreur(e)); });
  }
  function deconnecter(){
    if (occupe || !auth) return;
    occupe = true;
    // (le téléphone garde tout ce qu'il a ; le profil en ligne reste tel qu'il était à la dernière sauvegarde)
    fb.signOut(auth).catch(() => {}).then(() => { occupe = false; etatTexte = ""; ecrireEtat(null); majBloc(); });
  }
  function supprimer(){
    if (occupe || !utilisateur) return;
    if (!confirm(tr("Supprimer ton profil ?\n\nTa progression sauvegardée en ligne et ton compte Alcuno sont effacés. Ce téléphone garde ce qu'il a déjà."))) return;
    occupe = true;
    dire(tr("Suppression…"));
    const moi = utilisateur;
    avecDelai(fb.remove(fb.ref(base, "profils/" + moi.uid)), DELAI_LECTURE)
      .then(() => fb.deleteUser(moi))
      .then(() => { occupe = false; ecrireEtat(null); dire(""); notifier(tr("Profil supprimé.")); })
      .catch((e) => {
        occupe = false;
        // (Google demande une connexion récente pour effacer un compte : on déconnecte, il suffit de se reconnecter et de recommencer)
        if (e && e.code === "auth/requires-recent-login") { fb.signOut(auth).catch(() => {}); dire(tr("Par sécurité, reconnecte-toi, puis appuie de nouveau sur « Supprimer mon profil ».")); }
        else dire(tr("Suppression impossible pour le moment. Réessaie plus tard."));
      });
  }
  btnConnexion.addEventListener("click", () => { if (utilisateur) deconnecter(); else connecter(); });
  btnSupprimer.addEventListener("click", supprimer);

  // ----- Quand télécharger l'authentification, quand envoyer -----
  const precharger = () => { if (navigator.onLine) charger().catch(() => {}); };
  ["btnReglages", "btnReglagesJeu"].forEach((id) => { const b = document.getElementById(id); if (b) b.addEventListener("click", precharger); });
  const btnFermer = document.getElementById("btnFermerReglages");
  if (btnFermer) btnFermer.addEventListener("click", () => setTimeout(verifier, 400));
  document.addEventListener("visibilitychange", verifier);
  window.addEventListener("online", () => { if (lireEtat()) charger().then(verifier, () => {}); });
  setInterval(verifier, 45000);

  majBloc();
  // Téléphone déjà lié à un profil : on s'y reconnecte tout seul (un peu après le lancement : le jeu d'abord)
  if (lireEtat()) setTimeout(precharger, 1500);
  // (rouverts après un rechargement, les Réglages n'ont pas reçu de tap : l'authentification est préparée quand même)
  else if (document.documentElement.classList.contains("rouvrir-reglages")) setTimeout(precharger, 1500);
})();
// #endregion
