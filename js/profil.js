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
// Deux façons de se connecter :
//   - dans un navigateur : la fenêtre Google de Firebase (signInWithPopup) ;
//   - dans l'appli installée (écran d'accueil de l'iPhone surtout), où cette fenêtre ne s'ouvre jamais et ne répond jamais :
//     on va sur la page Google, qui revient dans le jeu avec un jeton dans l'adresse (#id_token=…), donné à Firebase
//     (signInWithCredential). C'est aussi le secours quand la fenêtre est bloquée ou ne donne rien au bout de quelques secondes.
//     L'adresse du jeu doit être dans les « URI de redirection autorisés » du client OAuth (Google Cloud Console, voir PILOTAGE.md).
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
    const defis = {};
    Object.keys(objet(p.defis)).sort().slice(0, 300).forEach((id) => {
      if (!/^p[a-z0-9]{1,29}$/.test(id)) return;
      const d = objet(p.defis[id]);
      if (!/^(A|B|C|HA|HB)$/.test(d.n) || typeof d.t !== "string" || d.t.trim().length < 1 || d.t.length > 160) return;
      defis[id] = { t: d.t.trim(), n: d.n, maj: Number(d.maj) > 0 ? Number(d.maj) : 1 };
    });
    return { debloque, stickers: { gagnes, parties: Math.max(0, Math.floor(Number(s.parties) || 0)), fins }, reglages, defis };
  }
  // Forme écrite dans Firebase (les stickers gagnés en { id: true } : pas de tableau à trous)
  function enForme(n){
    const gagnes = {};
    n.stickers.gagnes.forEach((id) => { gagnes[id] = true; });
    const p = { v: 1, debloque: n.debloque, stickers: { gagnes, parties: n.stickers.parties, fins: n.stickers.fins } };
    if (n.reglages) p.reglages = { maj: n.reglages.maj, valeurs: n.reglages.valeurs };
    if (Object.keys(n.defis).length) p.defis = n.defis;
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
    const l = normaliser({ debloque: objet(local).debloque, stickers: objet(local).stickers, reglages: { maj: 1, valeurs: objet(local).reglages }, defis: objet(local).defis });
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

    const defis = {};
    const vus = objet(objet(vu).defis);
    const ids = Array.from(new Set(Object.keys(l.defis).concat(Object.keys(d.defis)).concat(Object.keys(vus))));
    ids.forEach((id) => {
      const localDefi = l.defis[id], distantDefi = d.defis[id], vuDefi = vus[id];
      if (!localDefi && vuDefi && distantDefi) return; // supprimé depuis la dernière synchronisation
      if (localDefi && !distantDefi) defis[id] = localDefi;
      else if (!localDefi && distantDefi) defis[id] = distantDefi;
      else if (localDefi && distantDefi) defis[id] = (localDefi.maj >= distantDefi.maj ? localDefi : distantDefi);
    });
    const fusion = { debloque, stickers, reglages, defis };
    return {
      profil: enForme(fusion),
      ecrire: stable(enForme(fusion)) !== stable(enForme(d)),
      local: { debloque, stickers, reglages: reglages.valeurs, defis },
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
  // Client OAuth « Web client (auto created by Google Service) » du projet Firebase alcuno (public : il est dans l'adresse de la page Google)
  const ID_CLIENT_GOOGLE = "481896309098-0a4v9j6saqfav3d9maej4qedbi0tsjr8.apps.googleusercontent.com";
  const CLE_ALLER = "alcuno_profil_aller"; // { etat, nonce, quand } : départ vers la page Google, vérifié au retour
  const DELAI_FENETRE = 8000;              // (fenêtre Google sans réponse : le bouton est rendu, le tap suivant passe par la page Google)
  const DUREE_ALLER = 15 * 60000;
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
  let sansFenetre = false;     // (la fenêtre Google n'a rien donné ici : on passe par la page Google)
  let essai = 0;

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
    const defis = typeof DefisPersonnels === "object" ? DefisPersonnels.lire() : {};
    return { debloque, stickers: { gagnes: album.gagnes, parties: album.parties, fins: album.fins }, reglages, defis };
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
    if (typeof DefisPersonnels === "object" && L.stable(DefisPersonnels.lire()) !== L.stable(r.local.defis)) DefisPersonnels.remplacer(r.local.defis);
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
    // Déconnecté : bouton « Se connecter avec Google » (blanc, avec le G de Google), sous le texte ; connecté : petit bouton du jeu
    btnConnexion.classList.add("btnGoogle"); // (même bouton blanc « Google » connecté ou non)
    btnConnexion.classList.toggle("connecte", connecte);
    document.getElementById("texteBtnProfil").textContent = connecte ? tr("Se déconnecter") : tr("Se connecter avec Google");
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
    // La configuration est posée par le script module de index.html, qui peut passer APRÈS ce fichier (iPhone surtout) :
    // au retour de la page Google, on se connecte dès le lancement, il faut donc l'attendre (sinon « Connexion impossible »)
    const attendreConfig = () => new Promise((ok, rejet) => {
      const debut = Date.now();
      (function voir(){
        if (window.ADRESSE_FIREBASE && window.CONFIG_FIREBASE) ok();
        else if (Date.now() - debut > 15000) { const e = new Error("config"); e.code = "config"; rejet(e); }
        else setTimeout(voir, 100);
      })();
    });
    chargement = attendreConfig()
      .then(() => Promise.all([import(window.ADRESSE_FIREBASE + "firebase-app.js"), import(window.ADRESSE_FIREBASE + "firebase-database.js"), import(window.ADRESSE_FIREBASE + "firebase-auth.js")]))
      .then(([a, d, au]) => {
        const appli = a.initializeApp(window.CONFIG_FIREBASE, "profil");
        fb = { ref: d.ref, get: d.get, set: d.set, remove: d.remove, GoogleAuthProvider: au.GoogleAuthProvider, signInWithPopup: au.signInWithPopup,
               OAuthProvider: au.OAuthProvider, signInWithCredential: au.signInWithCredential, signOut: au.signOut, deleteUser: au.deleteUser };
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
        const vu = etat && etat.uid === moi.uid && etat.maj ? { maj: etat.maj, reglages: etat.reglages, defis: etat.defis } : null;
        const r = L.fusionner(profilLocal(), photo.val(), vu, Date.now());
        poserLocal(r);
        const fin = () => {
          ecrireEtat({ uid: moi.uid, nom: moi.displayName || "", maj: r.profil.reglages.maj, reglages: r.local.reglages, defis: r.local.defis });
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
    // (erreur sans code — téléchargement raté, délai dépassé… — : son message court sert de code, pour toujours savoir ce qui coince)
    const code = (e && (e.code || (typeof e.message === "string" ? e.message.slice(0, 40) : ""))) || "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return "";
    if (code === "auth/popup-blocked") return tr("Fenêtre bloquée par le navigateur : autorise les fenêtres pop-up, puis réessaie.");
    if (code === "auth/network-request-failed" || !navigator.onLine) return tr("Pas de connexion internet : réessaie plus tard.");
    if (code === "auth/operation-not-supported-in-this-environment" || code === "auth/web-storage-unsupported") return tr("Connexion impossible ici : ouvre le jeu dans ton navigateur (Chrome, Safari), puis réessaie.");
    // (console Firebase : fournisseur Google pas activé, domaine du jeu pas autorisé, ou création de comptes désactivée : voir PILOTAGE.md)
    if (code === "auth/operation-not-allowed" || code === "auth/unauthorized-domain" || code === "auth/admin-restricted-operation") return tr("La connexion Google n'est pas encore activée pour le jeu.");
    // (le code de l'erreur est montré : il dit tout de suite ce qui coince quand un joueur le signale)
    return tr("Connexion impossible pour le moment. Réessaie plus tard.") + (code ? " (" + code.replace(/^auth\//, "") + ")" : "");
  }
  const appliInstallee = () => { try { return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches; } catch (e) { return false; } };
  const hasard = () => Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16).padStart(8, "0")).join("");
  // (Google reçoit l'empreinte SHA-256 du nombre tiré, Firebase le nombre lui-même : sinon il refuse le jeton, « missing-or-invalid-nonce »)
  const empreinte = (texte) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte))
    .then((h) => Array.from(new Uint8Array(h), (o) => o.toString(16).padStart(2, "0")).join(""));
  // (l'adresse du jeu sans « index.html » ni paramètres : celle qui est déclarée dans la console Google)
  const adresseRetour = () => location.origin + location.pathname.replace(/index\.html$/, "");

  // Connexion sans fenêtre : on quitte le jeu pour la page Google, qui y revient (voir retourDeGoogle)
  function allerChezGoogle(){
    let enPartie = false;
    try { enPartie = !!(partieLancee || codePartieActuel); } catch (e) {}
    // (la page est rechargée au retour : jamais pendant une partie ni dans une salle d'attente)
    if (enPartie) { dire(tr("Termine ta partie, puis connecte-toi depuis l'accueil.")); return; }
    if (!navigator.onLine) { dire(tr("Pas de connexion internet : réessaie plus tard.")); return; }
    occupe = true;
    dire(tr("Connexion…"));
    const nonce = hasard();
    empreinte(nonce).then((hache) => {
      const aller = { etat: hasard(), nonce, hache, quand: Date.now() };
      localStorage.setItem(CLE_ALLER, JSON.stringify(aller));
      if (localStorage.getItem(CLE_ALLER) === null) throw new Error("stockage");
      try { sessionStorage.setItem(CLE_ROUVRIR_REGLAGES, String(ecranReglages.scrollTop)); } catch (e) {} // (au retour, les Réglages se rouvrent au même endroit)
      const adresse = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
        client_id: ID_CLIENT_GOOGLE, redirect_uri: adresseRetour(), response_type: "id_token", scope: "openid email profile",
        nonce: hache, state: aller.etat, prompt: "select_account" });
      // (page gardée en mémoire par le téléphone puis réaffichée par « précédent » : le bouton n'y reste pas bloqué)
      window.addEventListener("pageshow", (e) => { if (e.persisted) { occupe = false; dire(""); } }, { once: true });
      // (rechargerPage vide d'abord l'historique du jeu : au retour, « précédent » ne ramène pas sur la page Google)
      if (typeof rechargerPage === "function") rechargerPage(adresse); else location.assign(adresse);
    }).catch(() => { occupe = false; dire(tr("Connexion impossible ici : ouvre le jeu dans ton navigateur (Chrome, Safari), puis réessaie.")); });
  }

  // Au lancement : la page Google vient de nous renvoyer ici (le script du <head> de index.html a retiré le jeton de l'adresse)
  function retourDeGoogle(){
    const brut = window.RETOUR_GOOGLE;
    if (!brut) return false;
    window.RETOUR_GOOGLE = "";
    const p = new URLSearchParams(brut);
    let aller = null;
    try { aller = JSON.parse(localStorage.getItem(CLE_ALLER) || "null"); localStorage.removeItem(CLE_ALLER); } catch (e) {}
    // (retour qui ne répond pas à un départ de CE téléphone, ou trop vieux : on n'en fait rien)
    if (!aller || typeof aller !== "object" || !aller.etat || p.get("state") !== aller.etat || Date.now() - Number(aller.quand) > DUREE_ALLER) return false;
    const jeton = p.get("id_token");
    if (!jeton) {
      // (access_denied : le joueur a refusé ou fermé la page Google, rien à signaler)
      if (p.get("error") && p.get("error") !== "access_denied") dire(messageErreur({ code: "google-" + p.get("error") }));
      return false;
    }
    // Le jeton doit porter le nombre tiré au départ : un jeton fabriqué ou rejoué ailleurs est refusé (Firebase vérifie le reste)
    let nonce = "";
    try { nonce = JSON.parse(atob(jeton.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).nonce; } catch (e) {}
    if (!aller.hache || nonce !== aller.hache) { dire(messageErreur({ code: "nonce" })); return false; }
    occupe = true;
    connexionVoulue = true;
    dire(tr("Connexion…"));
    const identifiant = () => new fb.OAuthProvider("google.com").credential({ idToken: jeton, rawNonce: aller.nonce });
    avecDelai(charger().then(() => fb.signInWithCredential(auth, identifiant())), 2 * DELAI_LECTURE)
      .then(() => { occupe = false; etatTexte = ""; majBloc(); })
      .catch((e) => { occupe = false; connexionVoulue = false; dire(messageErreur(e)); });
    return true;
  }

  function connecter(){
    if (occupe) return;
    // (appli installée : la fenêtre de Firebase ne s'y ouvre pas et ne répond jamais, le bouton restait sur « Connexion… »)
    if (sansFenetre || appliInstallee()) { allerChezGoogle(); return; }
    occupe = true;
    dire(tr("Connexion…"));
    const ouvrir = () => fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
    // (authentification déjà téléchargée, cas normal : la fenêtre Google s'ouvre dans le tap lui-même)
    connexionVoulue = true;
    const moi = ++essai;
    // Fenêtre qui ne s'ouvre pas ou ne répond pas : on ne reste jamais bloqué, le tap suivant passe par la page Google
    setTimeout(() => {
      if (moi !== essai || utilisateur) return;
      occupe = false; sansFenetre = true;
      dire(tr("Si la fenêtre Google ne s'est pas ouverte, appuie de nouveau sur le bouton."));
    }, DELAI_FENETRE);
    (auth ? ouvrir() : charger().then(ouvrir))
      .then(() => { if (moi === essai) essai++; occupe = false; etatTexte = ""; majBloc(); })
      .catch((e) => {
        if (moi !== essai) return; // (réponse d'une ancienne tentative : elle ne dérange pas la nouvelle)
        essai++;
        occupe = false; connexionVoulue = false;
        const code = (e && e.code) || "";
        // (fenêtre bloquée ou impossible dans ce navigateur : on passe tout de suite par la page Google)
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") { sansFenetre = true; allerChezGoogle(); return; }
        dire(messageErreur(e));
      });
  }
  function deconnecter(){
    if (occupe || !auth) return;
    occupe = true;
    // (le téléphone garde tout ce qu'il a ; le profil en ligne reste tel qu'il était à la dernière sauvegarde)
    fb.signOut(auth).catch(() => {}).then(() => { occupe = false; etatTexte = ""; ecrireEtat(null); majBloc(); });
  }
  // Confirmation à l'écran, aux couleurs du thème (pas de confirm() du navigateur) : #ecranConfirmerRetrait (l'ancien écran
  // « Retirer un joueur ? », déjà habillé par chaque thème), passé au-dessus des Réglages le temps de la question.
  function confirmerAEcran(titre, texte, libelleOui, libelleNon){
    return new Promise((fin) => {
      const ecran = document.getElementById("ecranConfirmerRetrait"), h = document.getElementById("titreConfirmerRetrait"),
        p = document.getElementById("texteConfirmerRetrait"), oui = document.getElementById("btnConfirmerRetraitOui"), non = document.getElementById("btnConfirmerRetraitNon");
      if (!ecran || !oui || !non) { fin(window.confirm(titre + "\n\n" + texte)); return; }
      const avant = [h.innerText, p.innerText, oui.textContent, non.textContent];
      h.innerText = titre; p.innerText = texte; oui.textContent = libelleOui; non.textContent = libelleNon;
      ecran.classList.add("confirmationReglages");
      ecran.style.display = "";
      const repondre = (rep) => (e) => {
        e.stopImmediatePropagation(); e.preventDefault();
        oui.removeEventListener("click", siOui, true); non.removeEventListener("click", siNon, true);
        ecran.style.display = "none"; ecran.classList.remove("confirmationReglages");
        [h.innerText, p.innerText, oui.textContent, non.textContent] = avant;
        fin(rep);
      };
      const siOui = repondre(true), siNon = repondre(false);
      oui.addEventListener("click", siOui, true); non.addEventListener("click", siNon, true);
    });
  }
  function supprimer(){
    if (occupe || !utilisateur) return;
    confirmerAEcran(tr("Supprimer ton profil ?"),
      tr("Ta progression sauvegardée en ligne et ton compte Alcuno sont effacés. Ce téléphone garde ce qu'il a déjà."),
      tr("Supprimer"), tr("Annuler")).then((ok) => { if (ok) supprimerVraiment(); });
  }
  function supprimerVraiment(){
    if (occupe || !utilisateur) return;
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
  if (retourDeGoogle()) { /* (la connexion est en route) */ }
  // Téléphone déjà lié à un profil : on s'y reconnecte tout seul (un peu après le lancement : le jeu d'abord)
  else if (lireEtat()) setTimeout(precharger, 1500);
  // (rouverts après un rechargement, les Réglages n'ont pas reçu de tap : l'authentification est préparée quand même)
  else if (document.documentElement.classList.contains("rouvrir-reglages")) setTimeout(precharger, 1500);
})();
// #endregion
