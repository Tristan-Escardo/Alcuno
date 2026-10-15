// =============================================================================================
// ALCUNO : Mode en ligne : synchronisation des actions, rattrapage
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
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
  relancerRappelClassique(); // nouveau choix proposé : le compteur du rappel « À toi » part de maintenant

  el.addEventListener(options.evenement || "pointerdown", (e) => {
    // Tap sur le plateau ou les menus alors qu'un overlay (ou le voile entre deux) est affiché : ignoré.
    // Seulement les taps de ce téléphone : les actions des autres sont toujours rejouées.
    if(el.closest("main") && (overlayOuvert() || voileOverlays.classList.contains("visible"))) return;
    if(!enLigneActif){
      // Mêmes règles qu'en ligne : élément prêt, action pas sans objet, usage unique pas déjà fait
      // (avant, un double tap rapide sur « Annuler 1 » s'appliquait deux fois). Les taps appliqués
      // sont gardés en mémoire, pour reprendre la partie après un plantage.
      if(!actionPrete(el) || (el._net.valide && !el._net.valide())) return;
      if(el._net.once) el.dataset.netUtilise = "1";
      handler(e);
      noterActionClassique(id);
      actionAppliquee(sauvegardeClassique ? sauvegardeClassique.actions.length - 1 : -1);
      relancerRappelClassique(); // le joueur a joué : le compteur du rappel « À toi » repart de zéro
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

function resynchroniserManche(retourArriere = false){
  if(!dernierEtatManche || !enLigneActif) return;
  noterJournal(retourArriere ? "choix annulé : manche rejouée sans lui" : "remise à jour de la manche depuis le serveur");
  if(!retourArriere) afficherToast("Connexion instable : remise à jour de la partie…", 3000);
  repriseEnCours = true;
  mancheCourante = null; // la même manche est redémarrée, puis rejouée depuis le serveur
  demarrerMancheEnLigne(dernierEtatManche, { resynchro: true, retourArriere });
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
  if(action.id.startsWith("defaire:")) return appliquerDefaireEnLigne(action);

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
    // (et sautée aussi : action retirée par un « Annuler » du choix, voir appliquerDefaireEnLigne)
    seqEnCours = prochainSeq;
    const resultat = (action.refusee || seqsAnnulees.has(prochainSeq) || estUnDoublon(action)) ? "ignorer" : tenterAction(action);
    if(resultat === "ok"){
      actionsAppliquees.set(`${action.par}|${action.id}`, prochainSeq);
      actionAppliquee(prochainSeq);
    }
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
  toutesActionsManche = new Map();
  seqsAnnulees = new Set();
  masquerAnnulerChoix();
  finirRattrapage();
}

// ===== Rattrapage (reconnexion en pleine manche) =====
// Le téléphone rejoue toutes les actions déjà faites, délais quasi nuls (delai()) ;
// un écran « Retour dans la partie… » cache les overlays qui défilent en accéléré.
function commencerRattrapage(cible, texte = "Retour dans la partie…"){
  rattrapageEnCours = true;
  texteRattrapage = texte;
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
  ecran.innerText = `${texteRattrapage}\n${fait} / ${seqFinRattrapage}`;
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
    toutesActionsManche.set(Number(snapshot.key), action);
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
// options.retourArriere : … sans le choix qu'on vient d'annuler (voir appliquerDefaireEnLigne)
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
  // Bandeau « Tour de » placé pendant lancerPartie(), quand le jeu était encore caché (il se collait
  // alors tout en haut de l'écran) : on le replace sous la barre des messages maintenant qu'elle est là
  repositionnerStickyJoueurActif();
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
  // (+ les actions déjà là : celles retirées par un « Annuler » du choix sont sautées dès le rejeu)
  Promise.all([
    window.fbGet(window.fbRef(window.firebaseDB, `parties/${code}/manches/${manche}/seq`)),
    window.fbGet(window.fbRef(window.firebaseDB, `parties/${code}/manches/${manche}/actions`))
  ])
    .then(([snapshot, snapActions]) => {
      if(manche !== mancheCourante) return;
      calculerAnnulations(snapActions.val());
      const cible = Number(snapshot.val() || 0);
      if(cible > 0) commencerRattrapage(cible, options.retourArriere ? "Retour en arrière…" : undefined);
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

// #region Partie classique gardée en mémoire (reprise après un plantage)
// En classique aussi, le hasard vient d'une graine : la partie entière se déduit de la graine, des
// joueurs et de la liste des taps qui ont compté (mêmes noms d'actions qu'en ligne). Le tout est gardé
// dans le téléphone à chaque tap. Si l'appli se ferme en pleine partie (appel, batterie, plantage),
// au lancement suivant on propose de la reprendre : elle est rejouée en accéléré, comme le rattrapage
// en ligne. Oubliée quand la partie est finie ou quittée exprès (⌂), ou au bout de 12 h.
const CLE_PARTIE_CLASSIQUE = "alcuno_partie_classique";
const DUREE_PARTIE_CLASSIQUE = 12 * 60 * 60 * 1000;
let sauvegardeClassique = null; // { v, date, seed, sansDoree, soft, joueurs, actions }
let repriseClassiqueEnCours = false;

function enregistrerPartieClassique(){
  if(!sauvegardeClassique) return;
  sauvegardeClassique.date = Date.now();
  sauvegardeClassique.soft = estModeSoft();
  try { localStorage.setItem(CLE_PARTIE_CLASSIQUE, JSON.stringify(sauvegardeClassique)); } catch (e) {}
}

// Appelé par lancerPartie (classique) : nouvelle graine, ou celle de la partie qu'on reprend
function demarrerSauvegardeClassique(){
  if(repriseClassiqueEnCours && sauvegardeClassique){
    aleatoire = generateurAleatoire(sauvegardeClassique.seed);
    return;
  }
  const seed = Math.floor(Math.random() * 4294967296);
  sauvegardeClassique = {
    v: VERSION_JEU, date: Date.now(), seed, sansDoree: !premierePartieJouee(), soft: estModeSoft(),
    joueurs: joueurs.slice(), actions: []
  };
  aleatoire = generateurAleatoire(seed);
  enregistrerPartieClassique();
}

function noterActionClassique(id){
  if(enLigneActif || !sauvegardeClassique || repriseClassiqueEnCours || !partieLancee) return;
  sauvegardeClassique.actions.push(id);
  enregistrerPartieClassique();
}

function oublierPartieClassique(){
  sauvegardeClassique = null;
  try { localStorage.removeItem(CLE_PARTIE_CLASSIQUE); } catch (e) {}
}

function lirePartieClassique(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CLE_PARTIE_CLASSIQUE) || "null"); } catch (e) { s = null; }
  const valide = s && s.v === VERSION_JEU && Array.isArray(s.joueurs) && s.joueurs.length >= 2 &&
    Array.isArray(s.actions) && s.actions.length > 0 && Date.now() - Number(s.date || 0) < DUREE_PARTIE_CLASSIQUE;
  if(!valide){ oublierPartieClassique(); return null; }
  return s;
}

// Au démarrage de l'appli : « Reprendre la partie ? » s'il y a une partie classique interrompue
function proposerRepriseClassique(){
  const s = lirePartieClassique();
  if(!s) return;
  const noms = s.joueurs.map(avecCouronne);
  const liste = noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : noms[0];
  document.getElementById("texteReprise").innerText = `Avec ${liste}.`;
  ecranReprise.style.display = "";
}

const ecranReprise = document.getElementById("ecranReprise");
document.getElementById("btnRepriseNon").addEventListener("click", () => {
  ecranReprise.style.display = "none";
  oublierPartieClassique();
});
document.getElementById("btnRepriseOui").addEventListener("click", () => {
  ecranReprise.style.display = "none";
  const s = lirePartieClassique();
  if(s) reprendrePartieClassique(s);
});

function reprendrePartieClassique(s){
  sauvegardeClassique = s;
  repriseClassiqueEnCours = true;
  if(caseModeSoft.checked !== !!s.soft) caseModeSoft.checked = !!s.soft; // (même mode que pendant la partie)
  document.getElementById("btnModeClassique").click();
  document.activeElement && document.activeElement.blur && document.activeElement.blur(); // (pas de clavier)
  joueurs = s.joueurs.slice();
  annulations = {};
  afficherJoueurs();
  rejouerActionsClassiques(s.actions.slice(), "Reprise de la partie…",
    () => afficherNotificationHaut("", "Partie reprise !", true));
}

// Relance la partie (même graine) et rejoue ces taps en accéléré, derrière un écran d'attente
function rejouerActionsClassiques(actions, texte, apres = null){
  rattrapageEnCours = true; // annonces et animations quasi instantanées (voir delai)
  document.body.classList.add("rattrapage");
  const ecran = document.createElement("div");
  ecran.id = "ecranRattrapage";
  document.body.appendChild(ecran);

  lancerPartie();
  let i = 0;
  let attente = 0;
  const etape = () => {
    ecran.innerText = `${texte}\n${i} / ${actions.length}`;
    if(i >= actions.length) return terminer();
    const resultat = rejouerActionClassique(actions[i]);
    if(resultat === "attendre" && attente < 6000){
      attente += 20;
      // Annonce qui ne se ferme qu'au tap (ex. « TIENS DANS TA GUEULE ») : fermée pour continuer
      if(attente % 200 === 0 && document.getElementById("overlayRegleUnique")) fermerOverlayRegleUnique();
      setTimeout(etape, 20);
      return;
    }
    i++;
    attente = 0;
    setTimeout(etape, 0);
  };
  const terminer = () => {
    rattrapageEnCours = false;
    repriseClassiqueEnCours = false;
    document.body.classList.remove("rattrapage");
    ecran.remove();
    sauvegardeClassique.actions = actions;
    enregistrerPartieClassique();
    afficherJoueurs();
    afficherJoueurActif();
    if(apres) apres();
  };
  setTimeout(etape, 0);
}

// "ok" | "attendre" | "ignorer" (comme tenterAction en ligne, sans joueur ni réseau)
function rejouerActionClassique(id){
  if(id.startsWith("retrait-classique:")){
    const nom = id.slice("retrait-classique:".length);
    if(!joueurs.includes(nom) || joueurs.length <= 2) return "ignorer";
    if(!plateauLibre()) return "attendre";
    retirerJoueurEnJeu(nom);
    return "ok";
  }
  const candidats = Array.from(document.querySelectorAll("[data-net-id]")).filter(el => el.dataset.netId === id);
  const el = candidats.find(actionPrete);
  if(!el){
    if(candidats.some(c => c._net && c._net.valide && !c._net.valide())) return "ignorer";
    return "attendre";
  }
  if(el._net.valide && !el._net.valide()) return "ignorer";
  // Comme au doigt : le plateau ne se touche pas à travers une annonce (voir surAction)
  if(el.closest("main") && (overlayOuvert() || voileOverlays.classList.contains("visible"))) return "attendre";
  if(el._net.once) el.dataset.netUtilise = "1";
  el._net.handler();
  return "ok";
}
// #endregion

// #region Mauvais joueur choisi : « Annuler » pendant quelques secondes
// Après le choix du nouveau pigeon, de la victime de la carte dorée, des 2 joueurs du duel ou la
// validation du +4, une barre « Mauvais joueur ? ↶ Annuler » reste 6 s en bas de l'écran (en ligne :
// seulement chez celui qui a choisi). Annuler retire le choix de la liste des actions, puis la partie
// est rejouée en accéléré jusque juste avant (comme une reprise) : on retrouve l'écran de choix.
// Possible tant qu'aucune autre action n'a été jouée après. Jamais pour une carte retournée.
const DUREE_ANNULER_CHOIX = 6000;
let choixAnnulable = null;      // { debut, fin, timer } : positions des actions du choix
let seqEnCours = 0;             // en ligne : numéro de l'action en train d'être appliquée
let toutesActionsManche = new Map(); // en ligne : seq -> action, toute la manche (pour valider un « defaire »)
let seqsAnnulees = new Set();   // en ligne : actions retirées par un « Annuler » (sautées au rejeu)
let texteRattrapage = "Retour dans la partie…";

// Position de l'action en train d'être appliquée : son numéro en ligne, son rang dans la sauvegarde
// en classique (pas encore notée pendant son handler : c'est la longueur de la liste)
function positionActionCourante(){
  if(enLigneActif) return seqEnCours;
  return sauvegardeClassique ? sauvegardeClassique.actions.length : -1;
}

// À appeler dans le handler du choix. debut : 1re action du choix (le 1er joueur du duel), sinon celle-ci
function proposerAnnulerChoix(choisisseur, debut = positionActionCourante()){
  masquerAnnulerChoix();
  if(rattrapageEnCours || repriseClassiqueEnCours) return;
  if(enLigneActif && choisisseur !== pseudoActuel) return;
  const fin = positionActionCourante();
  if(debut < 0 || fin < debut) return;

  const barre = document.createElement("div");
  barre.id = "annulerChoix";
  barre.innerHTML = '<span class="annulerChoix-texte">Mauvais joueur ?</span>' +
    '<button type="button" class="annulerChoix-bouton"><svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Annuler</button>' +
    '<span class="annulerChoix-temps" aria-hidden="true"></span>';
  barre.querySelector(".annulerChoix-temps").style.animationDuration = `${DUREE_ANNULER_CHOIX}ms`;
  barre.querySelector("button").addEventListener("click", () => {
    const choix = choixAnnulable;
    masquerAnnulerChoix();
    if(choix) defaireChoix(choix);
  });
  document.body.appendChild(barre);
  choixAnnulable = { debut, fin, timer: setTimeout(masquerAnnulerChoix, DUREE_ANNULER_CHOIX) };
}

function masquerAnnulerChoix(){
  if(choixAnnulable) clearTimeout(choixAnnulable.timer);
  choixAnnulable = null;
  const barre = document.getElementById("annulerChoix");
  if(barre) barre.remove();
}

// Une autre action jouée après le choix : il est confirmé, plus d'annulation
function actionAppliquee(position){
  if(choixAnnulable && position > choixAnnulable.fin) masquerAnnulerChoix();
}

function defaireChoix(choix){
  if(enLigneActif){
    ecrireAction(`defaire:${choix.debut}`).catch(() => afficherToast("Connexion perdue, réessaie"));
    return;
  }
  if(!sauvegardeClassique || sauvegardeClassique.actions.length - 1 !== choix.fin) return;
  const s = sauvegardeClassique;
  repriseClassiqueEnCours = true; // (retourMenu ne l'oublie pas, lancerPartie reprend sa graine)
  nettoyerOverlays();
  retourMenu();
  joueurs = s.joueurs.slice();
  annulations = {};
  rejouerActionsClassiques(s.actions.slice(0, choix.debut), "Retour en arrière…");
}

// Valable si le choix a été fait par le même joueur et que rien d'autre n'a été joué entre-temps
// (seulement les autres taps du même choix : les 2 joueurs du duel). Décidé avec la seule liste des
// actions : pareil sur tous les téléphones, et pendant un rejeu.
function annulationValide(debut, fin, par, actions){
  const premiere = actions.get(debut);
  if(!premiere || premiere.par !== par || debut >= fin || seqsAnnulees.has(debut)) return false;
  const famille = (id) => String(id).replace(/:\d+$/, "");
  for(const [seq, a] of actions){
    if(seq > debut && seq < fin && !seqsAnnulees.has(seq) && famille(a.id) !== famille(premiere.id)) return false;
  }
  return true;
}

function appliquerDefaireEnLigne(action){
  const debut = Number(action.id.slice("defaire:".length));
  const fin = seqEnCours;
  if(!annulationValide(debut, fin, action.par, toutesActionsManche)){
    if(action.par === pseudoActuel) afficherToast("Trop tard pour annuler");
    return "ignorer";
  }
  for(let s = debut; s <= fin; s++) seqsAnnulees.add(s);
  // Le choix est déjà appliqué ici : la manche est rejouée depuis le serveur, sans lui
  setTimeout(() => resynchroniserManche(true), 0);
  return "ok";
}

// Rejeu (reconnexion, retour en arrière) : actions retirées, connues avant de rejouer la 1re
function calculerAnnulations(brutes){
  seqsAnnulees = new Set();
  const actions = new Map();
  Object.keys(brutes || {}).map(Number).sort((a, b) => a - b).forEach((seq) => {
    const a = Object.assign({}, brutes[seq]);
    const morceaux = /^(.*)@(\d+)$/.exec(String(a.id));
    if(morceaux) a.id = morceaux[1];
    actions.set(seq, a);
  });
  for(const [seq, a] of actions){
    if(!String(a.id).startsWith("defaire:")) continue;
    const debut = Number(a.id.slice("defaire:".length));
    if(annulationValide(debut, seq, a.par, actions)) for(let s = debut; s <= seq; s++) seqsAnnulees.add(s);
  }
}
// #endregion
