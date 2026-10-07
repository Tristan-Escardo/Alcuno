// =============================================================================================
// ALCUNO : Mode en ligne : menus, salle d'attente, reconnexion
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
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

// Clavier ouvert : l'iPhone laisse glisser toute la page (on voyait le haut du jeu derrière, et la
// zone visible changeait : le bouton Scanner revenait). On bloque ce glissement sur l'écran du mode en
// ligne, sauf si son contenu ne tient pas et doit défiler.
document.addEventListener("touchmove", (e) => {
  const ecran = document.getElementById("enLigne");
  if (ecran.style.display === "none" || !document.documentElement.classList.contains("clavier-ouvert")) return;
  if (ecran.scrollHeight > ecran.clientHeight + 1 && ecran.contains(e.target)) return;
  e.preventDefault();
}, { passive: false });

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

// Code de la partie + QR code au-dessus : le scanner ouvre le jeu avec le code déjà rempli (voir ?code= plus bas)
function afficherCodePartie(code){
  document.getElementById("codePartieAffiche").innerText = "Code de la partie : " + code;
  const zone = document.getElementById("qrPartie");
  try {
    const qr = qrcode(0, "M");
    qr.addData("https://tristan-escardo.github.io/Alcuno/?code=" + encodeURIComponent(code));
    qr.make();
    zone.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    zone.style.display = "";
  } catch (e) {
    zone.innerHTML = "";
    zone.style.display = "none"; // sans QR code, le code écrit suffit
  }
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
  // Code déjà rempli (lien d'un QR code) : clavier prêt pour le pseudo. Sinon pas de clavier :
  // on voit d'abord « Scanner le QR code » (il se cache quand on tape le code à la main)
  if (document.getElementById("codeRejoindre").value.trim()) ouvrirClavier(document.getElementById("pseudoRejoindre"));
});

// ===== Scanner le QR code d'une partie (caméra) =====
// Android/Chrome : le lecteur du navigateur (BarcodeDetector). iPhone : il n'existe pas, on charge
// js/jsQR.js (seulement au premier scan : inutile de le télécharger pour tout le monde).
const ecranScanner = document.getElementById("ecranScanner");
const videoScanner = document.getElementById("videoScanner");
let fluxScanner = null;
let numeroScanner = 0; // change à chaque ouverture / fermeture : une lecture en cours d'un scan fermé s'arrête

// Texte du QR code => code de la partie (lien …/?code=ABC12 du jeu, ou le code tout seul)
function codeDepuisQR(texte){
  texte = String(texte || "").trim();
  let code = texte;
  if (/^https?:\/\//i.test(texte)) {
    try { code = new URL(texte).searchParams.get("code") || ""; } catch (e) { code = ""; }
  }
  code = code.trim().toUpperCase();
  return /^[A-Z0-9]{4,6}$/.test(code) ? code : "";
}

function chargerJsQR(){
  return new Promise((ok, echec) => {
    if (window.jsQR) { ok(); return; }
    const s = document.createElement("script");
    s.src = "js/jsQR.js";
    s.onload = ok;
    s.onerror = echec;
    document.head.appendChild(s);
  });
}

// Renvoie une fonction qui lit l'image actuelle de la vidéo (texte du QR code, ou "")
async function preparerLecteurQR(){
  if ("BarcodeDetector" in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) {
        const detecteur = new window.BarcodeDetector({ formats: ["qr_code"] });
        return async () => {
          const trouves = await detecteur.detect(videoScanner);
          return trouves.length ? trouves[0].rawValue : "";
        };
      }
    } catch (e) {}
  }
  await chargerJsQR();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async () => {
    const l = videoScanner.videoWidth, h = videoScanner.videoHeight;
    if (!l || !h) return "";
    const echelle = Math.min(1, 640 / Math.max(l, h)); // image réduite : lecture rapide, assez nette
    canvas.width = Math.round(l * echelle);
    canvas.height = Math.round(h * echelle);
    ctx.drawImage(videoScanner, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const resultat = window.jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
    return resultat ? resultat.data : "";
  };
}

function fermerScanner(){
  numeroScanner++;
  if (fluxScanner) fluxScanner.getTracks().forEach((piste) => piste.stop());
  fluxScanner = null;
  videoScanner.srcObject = null;
  fermerPage(ecranScanner);
}

async function ouvrirScanner(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Ce téléphone ne permet pas de scanner ici : entre le code à la main.");
    return;
  }
  const numero = ++numeroScanner;
  ouvrirPage(ecranScanner);
  try {
    const [flux, lire] = await Promise.all([
      navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }),
      preparerLecteurQR()
    ]);
    if (numero !== numeroScanner) { flux.getTracks().forEach((piste) => piste.stop()); return; } // fermé entre-temps
    fluxScanner = flux;
    videoScanner.srcObject = flux;
    await videoScanner.play().catch(() => {});
    const lireEncore = async () => {
      if (numero !== numeroScanner) return;
      let texte = "";
      try { texte = await lire(); } catch (e) {}
      if (numero !== numeroScanner) return;
      const code = codeDepuisQR(texte);
      if (!code) { setTimeout(lireEncore, 150); return; } // ~7 essais par seconde
      fermerScanner();
      vibrer(40);
      document.getElementById("codeRejoindre").value = code;
      const champPseudo = document.getElementById("pseudoRejoindre");
      if (!champPseudo.value.trim()) ouvrirClavier(champPseudo);
    };
    lireEncore();
  } catch (e) {
    if (numero !== numeroScanner) return;
    fermerScanner();
    alert(e && e.name === "NotAllowedError"
      ? "Autorise la caméra pour scanner le QR code (ou entre le code à la main)."
      : "Impossible d'ouvrir la caméra : entre le code à la main.");
  }
}

document.getElementById("btnScannerQR").addEventListener("click", ouvrirScanner);
document.getElementById("btnFermerScanner").addEventListener("click", fermerScanner);
// Appli mise en arrière-plan : la caméra est coupée par le téléphone, on referme le scan
document.addEventListener("visibilitychange", () => {
  if (document.hidden && ecranScanner.style.display !== "none") fermerScanner();
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
      afficherCodePartie(code);
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
        afficherCodePartie(code);
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
        // Découpe transparente des ondes autour de la barre (avant : une barre foncée dessous,
        // qui faisait un contour noir)
        '<mask id="coupureWifiMasque" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">' +
          '<rect width="24" height="24" fill="#fff"/>' +
          '<path d="M3.5 3.5l17 17" stroke="#000" stroke-width="4.6"/>' +
        '</mask>' +
        '<g stroke="#ff2a2a" stroke-width="2.2" mask="url(#coupureWifiMasque)">' +
          '<path d="M2 8.8a15 15 0 0 1 20 0"/>' +
          '<path d="M5.2 12.2a10.5 10.5 0 0 1 13.6 0"/>' +
          '<path d="M8.6 15.6a5.5 5.5 0 0 1 6.8 0"/>' +
        '</g>' +
        '<circle cx="12" cy="19.4" r="1.4" fill="#ff2a2a" mask="url(#coupureWifiMasque)"/>' +
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
  afficherCodePartie(code);
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
