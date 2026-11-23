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
    // Ces boutons agissent au doigt posé : le bouton est souvent désactivé ou retiré avant le « click », qui ne
    // vient alors jamais (pas de son du tout, ni le sabre du thème Star Wars). Le son du bouton se joue donc ici,
    // sauf pour ceux qui ont leur propre son ; le « click » qui suivrait ne le rejoue pas (voir reglages.js)
    if(e.isTrusted && el.tagName === "BUTTON" && !el.disabled && !el.matches(BOUTONS_AVEC_LEUR_SON) &&
       !document.documentElement.classList.contains("mode-tele")){
      jouerSon("bouton");
      sonBoutonJoueLe = Date.now();
    }
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
  if(estSpectateur){ afficherToast(tr("Tu regardes la partie sans y jouer")); return; }
  const net = el._net;
  if(net.valide && !net.valide()) return;
  if(!actionPrete(el)) return;

  const owner = proprietaireAction(el);
  if(owner && owner !== pseudoActuel){
    afficherToast(tr`En attente de ${owner}`);
    return;
  }

  if(net.once){
    if(el.dataset.netEnvoye) return;
    el.dataset.netEnvoye = "1";
  }

  ecrireAction(el.dataset.netId).catch(() => {
    delete el.dataset.netEnvoye;
    afficherToast(tr("Connexion perdue, réessaie"));
  });
}

// Ajoute une action numérotée à la manche (partie, manche et pseudo lus tout de suite :
// on peut quitter la partie juste après l'appel)
//
// L'action prend la première place libre (actions/1, actions/2…) en UNE seule écriture : une transaction sur cette place,
// qui n'écrit que si elle est vide. Le numéro et l'action arrivent donc ensemble sur le serveur, ou pas du tout.
// (Avant : un numéro réservé, PUIS l'action écrite. Si le réseau coupait entre les deux, le numéro restait vide ; les autres
// téléphones le sautaient au bout de 5 s, alors que l'expéditeur avait déjà joué son action chez lui, et elle finissait par
// arriver sur le serveur, trop tard pour tout le monde => téléphones décalés pour le reste de la manche, sans que rien ne le dise.)
// « applyLocally: false » : ce téléphone ne voit pas son action avant l'accord du serveur ; il la reçoit ensuite comme les
// autres, dans l'ordre. Une action refusée (réseau, règles) n'est donc jamais jouée nulle part.
const ESSAIS_MAX_PLACE = 12;

// Première place sans doute libre : après la dernière action reçue ici
function prochainePlaceAction(){
  let max = prochainSeq - 1;
  toutesActionsManche.forEach((_, seq) => { if(seq > max) max = seq; });
  return max + 1;
}

function ecrireAction(id){
  if(estSpectateur) return Promise.reject(new Error("spectateur")); // (un spectateur n'écrit jamais dans la partie)
  const db = window.firebaseDB;
  const code = codePartieActuel;
  const manche = mancheCourante;
  const par = pseudoActuel;
  const vu = prochainSeq - 1;
  // « @vu » : dernière action que ce téléphone avait jouée au moment du tap (voir estUnDoublon)
  const action = { id: `${id}@${vu}`, par };
  const refActions = window.fbRef(db, `parties/${code}/manches/${manche}/actions`);
  const toujoursLa = () => code === codePartieActuel && manche === mancheCourante;

  const tenter = (seq, essai) => window.fbRunTransaction(
    window.fbRef(db, `parties/${code}/manches/${manche}/actions/${seq}`),
    (deja) => (deja === null ? action : undefined), // place prise : on n'y touche pas
    { applyLocally: false }
  ).then((resultat) => {
    if(resultat.committed){
      noterJournal(`envoi ${id} => numéro ${seq}`);
      marquerActiviteAction(code); // (js/en-ligne.js)
      return;
    }
    // Place prise par un autre téléphone au même instant : la suivante
    noterJournal(`numéro ${seq} déjà pris pour ${id} (essai ${essai})`);
    if(essai >= ESSAIS_MAX_PLACE || !toujoursLa()) throw new Error("aucune place libre pour l'action");
    // Plusieurs places prises d'affilée (ce téléphone est en retard sur la partie) : on demande au serveur où en est la manche
    if(essai % 3 !== 0) return tenter(seq + 1, essai + 1);
    return window.fbGet(refActions).then((snapshot) => {
      const dernier = Object.keys(snapshot.val() || {}).reduce((max, k) => Math.max(max, Number(k) || 0), 0);
      return tenter(Math.max(seq, dernier) + 1, essai + 1);
    });
  });

  return tenter(prochainePlaceAction(), 1);
}

let dernierEtatManche = null; // état de la manche en cours (pour la rejouer)

// La manche est rejouée depuis le serveur (comme une reconnexion). retourArriere : sans le choix qu'on vient d'annuler
function resynchroniserManche(retourArriere = false){
  if(!dernierEtatManche || !enLigneActif) return;
  noterJournal(retourArriere ? "choix annulé : manche rejouée sans lui" : "remise à jour de la manche depuis le serveur");
  if(!retourArriere) afficherToast(tr("Connexion instable : remise à jour de la partie…"), 3000);
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
      afficherToast(tr("Retrait annulé : une carte venait d'être tirée, réessaie"));
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
    afficherToast(action.par === nom ? tr`${nom} a quitté la partie` : tr`${nom} a été retiré de la partie`, 3000);
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
      afficherToast(tr("Tu reviens dans la partie à la fin de l'action en cours…"), 3000);
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
        afficherToast(tr("Te revoilà dans la partie !"), 3000);
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
    afficherToast(tr`${nom} est revenu(e) dans la partie`, 3000);
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
    // Bouton d'un écran de choix déjà fermé (ou passé à la suite) au moment où l'expéditeur a tapé :
    // tap périmé (ex. 3e joueur tapé au duel, double tap sur le pigeon), ignoré partout pareil.
    // Avant, il attendait un bouton disparu : 30 s de blocage sur un écran allumé, pour toujours sur
    // un écran éteint (partie bloquée). Un écran pas encore affiché ici (action en avance) attend
    // toujours : l'expéditeur, lui, avait vu l'action qui l'a ouvert, donc après la fermeture.
    const fermeA = idsFermes.get(action.id);
    if(fermeA !== undefined && typeof action.vu === "number" && action.vu < fermeA) return "ignorer";
    return "attendre";
  }

  if(el._net.valide && !el._net.valide()) return "ignorer";

  // Vérifié au moment du rejeu (état identique partout) : bloque par ex. un double tap
  // qui aurait envoyé une 2e carte alors que ce n'était déjà plus son tour
  const owner = proprietaireAction(el);
  if(owner && owner !== action.par) return "ignorer";

  if(el._net.once) el.dataset.netUtilise = "1";
  if(el._net.unique) idsUniquesUtilises.add(action.id);
  // Boutons de l'écran de choix où l'action a lieu : notés comme « dépassés » à ce numéro d'action
  const ecranChoix = el.closest('[id^="overlay"]');
  if(ecranChoix) ecranChoix.querySelectorAll("[data-net-id]").forEach(b => idsFermes.set(b.dataset.netId, seqEnCours));
  el._net.handler();
  return "ok";
}

function traiterFile(){
  if(traitementEnCours || !enLigneActif) return;

  const action = fileActions.get(prochainSeq);
  if(!action){
    // Trou dans la numérotation : le jeu n'en fait plus (voir ecrireAction : numéro et action écrits ensemble). Filet de
    // sécurité si une place restait vide quand même : sautée au bout de 5 s, dès qu'une action plus loin existe (et pendant
    // un rattrapage, jusqu'à sa dernière action), pour ne pas bloquer la partie.
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

    // (sautée : action retirée par un « Annuler » du choix, voir appliquerDefaireEnLigne)
    seqEnCours = prochainSeq;
    const resultat = (seqsAnnulees.has(prochainSeq) || estUnDoublon(action)) ? "ignorer" : tenterAction(action);
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
let idsFermes = new Map(); // bouton d'un écran de choix -> dernière action appliquée sur cet écran (voir tenterAction)
const ACTIONS_REPETABLES = ["plus4:joueur:", "plus4:annuler", "plus4:reset", "pause:"];

function estUnDoublon(action){
  if(typeof action.vu !== "number") return false;
  if(ACTIONS_REPETABLES.some(debut => action.id.startsWith(debut))) return false;
  const derniere = actionsAppliquees.get(`${action.par}|${action.id}`);
  return derniere !== undefined && derniere > action.vu;
}

function reinitialiserFileActions(){
  generationFile++; // une action de l'ancienne file encore en attente s'arrête
  actionsAppliquees = new Map();
  idsFermes = new Map();
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
function commencerRattrapage(cible, texte = tr("Retour dans la partie…")){
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
  // (nombre d'actions pas encore connu : la manche est en cours de lecture, voir demarrerMancheEnLigne)
  if(seqFinRattrapage <= 0){ ecran.innerText = texteRattrapage; return; }
  const fait = Math.min(prochainSeq - 1, seqFinRattrapage);
  ecran.innerText = `${texteRattrapage}\n${fait} / ${seqFinRattrapage}`;
}

function finirRattrapage(){
  if(ecranAttenduApresRetour){ // (retour en arrière : d'abord jusqu'à l'écran du choix annulé)
    const id = ecranAttenduApresRetour;
    ecranAttenduApresRetour = null;
    return avancerJusquAEcran(id, finirRattrapage);
  }
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

  // Reconnexion en pleine manche : on lit les actions déjà jouées, puis on les rejoue toutes en accéléré avant de
  // reprendre normalement. L'écran d'attente est là dès maintenant : le plateau tout neuf, pas encore à jour, ne se
  // touche pas. Lecture ratée (réseau) : on réessaie jusqu'à ce qu'elle passe. (Avant : au premier échec, toute la manche
  // était rejouée à vitesse normale, annonces et sons compris, sur un plateau qu'on pouvait toucher.)
  repriseEnCours = false;
  const code = codePartieActuel;
  const manche = etat.manche;
  const generation = generationFile; // (manche relancée ou quittée entre-temps : cette lecture ne compte plus)
  const texte = options.retourArriere ? tr("Retour en arrière…") : undefined;
  const refActions = window.fbRef(window.firebaseDB, `parties/${code}/manches/${manche}/actions`);
  commencerRattrapage(0, texte);

  const lire = (essai) => {
    window.fbGet(refActions).then((snapActions) => {
      if(generation !== generationFile || manche !== mancheCourante) return;
      const brutes = snapActions.val();
      // (les actions retirées par un « Annuler » du choix sont sautées dès le rejeu)
      calculerAnnulations(brutes);
      // Dernière action à rattraper : le plus grand numéro écrit
      const cible = Object.keys(brutes || {}).reduce((max, k) => Math.max(max, Number(k) || 0), 0);
      if(cible > 0) commencerRattrapage(cible, texte);
      else finirRattrapage();
      ecouterActions();
      if(cible === 0) verifierRetourDansManche();
    }, (erreur) => {
      if(generation !== generationFile || manche !== mancheCourante) return;
      noterJournal(`lecture de la manche ratée (essai ${essai}) : ${erreur && erreur.message}`);
      setTimeout(() => {
        if(generation === generationFile && manche === mancheCourante) lire(essai + 1);
      }, Math.min(4000, 1000 * essai));
    });
  };
  lire(1);
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
    bouton.setAttribute("aria-label", tr("Voir le code de la partie"));
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
  bouton.querySelector(".texte").innerText = (estSpectateur ? "👁 " : "") + tr("Code : ") + codePartieActuel;
  bouton.classList.remove("ouvert");
}

function afficherToast(message, duree = 1800){
  let toast = document.getElementById("toastEnLigne");
  if(!toast){
    toast = document.createElement("div");
    toast.id = "toastEnLigne";
    document.body.appendChild(toast);
    rendreToastGlissable(toast);
  }
  toast.innerText = message;
  toast.style.transition = toast.style.transform = toast.style.opacity = "";
  toast.classList.add("visible");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("visible"), duree);
}

// Le message du bas se jette vers le bas avec le doigt (ou se ferme d'un tap) ; tenu au doigt, il reste
function rendreToastGlissable(toast){
  let departY = null, decalage = 0, dernierY = 0, dernierT = 0, vitesse = 0;
  const placer = (dy, transition) => {
    toast.style.transition = transition || "none";
    toast.style.transform = `translate(-50%, ${dy}px)`;
  };
  const cacher = () => {
    clearTimeout(toast._timer);
    placer(toast.offsetHeight + 40, "transform 0.22s ease-in, opacity 0.22s ease-in");
    toast.style.opacity = "0";
    setTimeout(() => { toast.classList.remove("visible"); toast.style.transition = toast.style.transform = toast.style.opacity = ""; }, 240);
  };
  toast.addEventListener("pointerdown", (e) => {
    if(!toast.classList.contains("visible")) return;
    clearTimeout(toast._timer);
    departY = dernierY = e.clientY;
    dernierT = e.timeStamp;
    decalage = vitesse = 0;
    try { toast.setPointerCapture(e.pointerId); } catch (err) {}
    placer(0);
  });
  toast.addEventListener("pointermove", (e) => {
    if(departY === null) return;
    const dy = e.clientY - departY;
    decalage = dy > 0 ? dy : dy * 0.3; // vers le haut il résiste
    if(e.timeStamp > dernierT) vitesse = (e.clientY - dernierY) / (e.timeStamp - dernierT);
    dernierY = e.clientY;
    dernierT = e.timeStamp;
    placer(decalage);
  });
  const lacher = (e) => {
    if(departY === null) return;
    const bouge = Math.abs(e.clientY - departY);
    departY = null;
    if(e.type === "pointerup" && bouge < 8) return cacher();                  // simple tap
    if(decalage > toast.offsetHeight * 0.4 || vitesse > 0.5) return cacher(); // jeté vers le bas
    placer(0, "transform 0.22s ease");                                        // revient à sa place
    toast._timer = setTimeout(() => toast.classList.remove("visible"), 2500);
  };
  toast.addEventListener("pointerup", lacher);
  toast.addEventListener("pointercancel", lacher);
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
let sauvegardeClassique = null; // { v, date, seed, sansDoree, soft, express, hot, hard, joueurs, actions }
let repriseClassiqueEnCours = false;

// Faces des cartes retournées, place par place ("" : de dos) : gardées avec la partie pour vérifier qu'une reprise
// redonne bien le même plateau (voir reprendrePartieClassique)
function facesPlateauClassique(){
  return Array.from(plateau.children).map(c => (c.classList.contains("retournee") && faceDeCarte(c)) || "");
}

function enregistrerPartieClassique(){
  if(!sauvegardeClassique) return;
  sauvegardeClassique.date = Date.now();
  try { sauvegardeClassique.faces = facesPlateauClassique(); } catch (e) {}
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
    v: VERSION_JEU, date: Date.now(), seed, sansDoree: !premierePartieJouee(), soft: estModeSoft(), express: estPartieExpress(), hot: estModeHot(), hard: estModeHard(), defisPersonnels: defisPersonnelsActifs(), valentin: saintValentinEnCours(),
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
  // Jeu mis à jour depuis (nouvelle version chargée en pleine partie : appli relancée, page rechargée) : la partie reste
  // reprenable si elle a gardé ses faces (vérifiées après la reprise) ; avant, elle était effacée sans rien dire
  const valide = s && (s.v === VERSION_JEU || Array.isArray(s.faces)) && Array.isArray(s.joueurs) && s.joueurs.length >= 2 &&
    Array.isArray(s.actions) && s.actions.length > 0 && Date.now() - Number(s.date || 0) < DUREE_PARTIE_CLASSIQUE;
  if(!valide){ oublierPartieClassique(); return null; }
  return s;
}

// Au démarrage de l'appli : « Reprendre la partie ? » s'il y a une partie classique interrompue
function proposerRepriseClassique(){
  const s = lirePartieClassique();
  if(!s) return;
  const noms = s.joueurs.map(avecCouronne);
  const liste = noms.length > 1 ? tr`${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : noms[0];
  document.getElementById("texteReprise").innerText = tr`Avec ${liste}.`;
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
  if(caseModeHot.checked !== !!s.hot) caseModeHot.checked = !!s.hot;
  if(caseModeHard.checked !== !!s.hard) caseModeHard.checked = !!s.hard;
  if(caseDefisPersonnels.checked !== !!s.defisPersonnels) caseDefisPersonnels.checked = !!s.defisPersonnels;
  casePartieExpress.checked = !!s.express; // (rien n'est gardé sur le téléphone : la revanche refera une partie du même type)
  majTitrePJ();
  ouvrirModeClassique(); // (js/en-ligne.js) sans passer par l'écran « Ta partie »
  document.activeElement && document.activeElement.blur && document.activeElement.blur(); // (pas de clavier)
  joueurs = s.joueurs.slice();
  annulations = {};
  afficherJoueurs();
  const facesAttendues = Array.isArray(s.faces) ? s.faces.slice() : null;
  rejouerActionsClassiques(s.actions.slice(), tr("Reprise de la partie…"), () => {
    // Plateau rejoué différent de celui de la partie (jeu mis à jour entre-temps, et le mélange a changé) : on ne la
    // laisse pas continuer de travers, on le dit et on revient à l'accueil
    const faces = facesPlateauClassique();
    if(facesAttendues && facesAttendues.some((f, i) => f && faces[i] !== f)){
      allerAccueil(); // (js/regles.js : oublie aussi la partie)
      alert(tr("Le jeu a été mis à jour pendant la partie : elle n'a pas pu être reprise à l'identique.\n\nLance une nouvelle partie."));
      return;
    }
    afficherNotificationHaut("", tr("Partie reprise !"), true);
  });
}

// Relance la partie (même graine) et rejoue ces taps en accéléré, derrière un écran d'attente
// ecranAttendu : écran à retrouver après la dernière action (retour en arrière : voir avancerJusquAEcran)
function rejouerActionsClassiques(actions, texte, apres = null, ecranAttendu = null){
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
    if(i >= actions.length) return ecranAttendu ? avancerJusquAEcran(ecranAttendu, terminer) : terminer();
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
  // (js/bots.js : joueur remplacé par un bot, ou qui reprend la main)
  if(id.startsWith("bot-classique:") || id.startsWith("humain-classique:")){
    const nom = id.slice(id.indexOf(":") + 1);
    if(id.startsWith("bot-classique:")) return remplacerParBot(nom) ? "ok" : "ignorer";
    return reprendreLaMain(nom) ? "ok" : "ignorer";
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
const DUREE_ANNULER_CHOIX = 4500;
let choixAnnulable = null;      // { debut, fin, timer } : positions des actions du choix
let seqEnCours = 0;             // en ligne : numéro de l'action en train d'être appliquée
let toutesActionsManche = new Map(); // en ligne : seq -> action, toute la manche (pour valider un « defaire »)
let seqsAnnulees = new Set();   // en ligne : actions retirées par un « Annuler » (sautées au rejeu)
let texteRattrapage = tr("Retour dans la partie…");

// Position de l'action en train d'être appliquée : son numéro en ligne, son rang dans la sauvegarde
// en classique (pas encore notée pendant son handler : c'est la longueur de la liste)
function positionActionCourante(){
  if(enLigneActif) return seqEnCours;
  return sauvegardeClassique ? sauvegardeClassique.actions.length : -1;
}

// À appeler dans le handler du choix. debut : 1re action du choix (le 1er joueur du duel), sinon celle-ci.
// texte : la question de la barre (« Mauvais joueur ? », « Mauvais bouton ? »…)
function proposerAnnulerChoix(choisisseur, debut = positionActionCourante(), texte = tr("Mauvais joueur ?")){
  masquerAnnulerChoix();
  if(rattrapageEnCours || repriseClassiqueEnCours) return;
  if(enLigneActif && (estSpectateur || choisisseur !== pseudoActuel)) return;
  const fin = positionActionCourante();
  if(debut < 0 || fin < debut) return;

  const barre = document.createElement("div");
  barre.id = "annulerChoix";
  barre.innerHTML = '<span class="annulerChoix-poignee" aria-hidden="true"></span>' + // (on peut la glisser vers le bas)
    '<span class="annulerChoix-texte"></span>' +
    '<button type="button" class="annulerChoix-bouton"><svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>' + tr("Annuler") + '</button>' +
    '<span class="annulerChoix-temps" aria-hidden="true"></span>';
  barre.querySelector(".annulerChoix-texte").textContent = texte;
  barre.querySelector(".annulerChoix-temps").style.animationDuration = `${DUREE_ANNULER_CHOIX}ms`;
  barre.querySelector("button").addEventListener("click", () => {
    const choix = choixAnnulable;
    masquerAnnulerChoix();
    if(choix) defaireChoix(choix);
  });
  rendreAnnulerChoixGlissable(barre);
  document.body.appendChild(barre);
  choixAnnulable = { debut, fin, timer: setTimeout(masquerAnnulerChoix, DUREE_ANNULER_CHOIX) };
}

// Comme les notifications du haut : on le jette vers le bas pour le faire partir (vers le haut il
// résiste, élastique). Le bouton Annuler garde son tap normal (le glissement ne part pas de lui).
function rendreAnnulerChoixGlissable(barre){
  let departY = null, decalage = 0, dernierY = 0, dernierT = 0, vitesse = 0;
  const placer = (dy, transition) => {
    barre.style.animation = "none"; // l'animation d'arrivée ne doit plus imposer sa position
    barre.style.transition = transition || "none";
    barre.style.transform = `translateY(${dy}px)`;
  };
  barre.addEventListener("pointerdown", (e) => {
    if(e.target.closest("button")) return;
    departY = dernierY = e.clientY;
    dernierT = e.timeStamp;
    decalage = vitesse = 0;
    try { barre.setPointerCapture(e.pointerId); } catch (err) {}
    placer(0);
  });
  barre.addEventListener("pointermove", (e) => {
    if(departY === null) return;
    const dy = e.clientY - departY;
    decalage = dy > 0 ? dy : dy * 0.3;
    if(e.timeStamp > dernierT) vitesse = (e.clientY - dernierY) / (e.timeStamp - dernierT);
    dernierY = e.clientY;
    dernierT = e.timeStamp;
    placer(decalage);
  });
  const lacher = () => {
    if(departY === null) return;
    departY = null;
    if(decalage > barre.offsetHeight * 0.35 || vitesse > 0.5){ // jeté vers le bas
      if(choixAnnulable) clearTimeout(choixAnnulable.timer);
      choixAnnulable = null;
      placer(barre.offsetHeight + 40, "transform 0.25s ease-in, opacity 0.25s ease-in");
      barre.style.opacity = "0";
      setTimeout(() => barre.remove(), 260);
      return;
    }
    placer(0, "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)"); // revient à sa place
  };
  barre.addEventListener("pointerup", lacher);
  barre.addEventListener("pointercancel", lacher);
}

// Barre d'info en bas de l'écran, même allure que « Mauvais joueur ? » mais sans bouton (ex. en ligne : le choix d'un défi hot
// fait par un autre joueur). Se jette vers le bas comme elle. Ne remplace jamais une vraie barre « Annuler » en cours.
function afficherBarreInfo(texte, duree = 4000){
  if(choixAnnulable){ afficherToast(texte, duree); return; }
  const ancienne = document.getElementById("annulerChoix");
  if(ancienne) ancienne.remove();
  const barre = document.createElement("div");
  barre.id = "annulerChoix";
  barre.className = "barreInfo";
  barre.innerHTML = '<span class="annulerChoix-poignee" aria-hidden="true"></span><span class="annulerChoix-texte"></span>'; // (pas de barre du temps)
  barre.querySelector(".annulerChoix-texte").textContent = texte;
  barre.setAttribute("role", "status");
  rendreAnnulerChoixGlissable(barre);
  document.body.appendChild(barre);
  setTimeout(() => { if(barre.isConnected) barre.remove(); }, duree);
}

function masquerAnnulerChoix(){
  if(choixAnnulable) clearTimeout(choixAnnulable.timer);
  choixAnnulable = null;
  const barre = document.getElementById("annulerChoix");
  if(barre) barre.remove();
}

// Une autre action jouée après le choix : il est confirmé, plus d'annulation
function actionAppliquee(position){
  if(enLigneActif && partieLancee) programmerRappelTour("en-ligne"); // (en ligne : le compteur du sifflet repart à chaque action jouée)
  if(choixAnnulable && position > choixAnnulable.fin) masquerAnnulerChoix();
}

// Écran où se fait chaque choix annulable. Après un retour en arrière, la partie est rejouée jusqu'à l'action
// d'avant le choix ; entre elle et l'écran du choix, il peut y avoir des étapes sans action (fin du duel, annonce
// « X boit N gorgées »…) : on les fait défiler vite, pour revenir directement sur l'écran du choix (avant : on
// revoyait la fin du duel, puis l'annonce, avant de retrouver « Annuler 0, 1, 2… »).
const ECRANS_DES_CHOIX = [[/^annul:/, "overlayAnnulation"], [/^duel:choix:/, "overlayDuel"], [/^pigeon:/, "overlayPigeon"],
  [/^doree:/, "overlayCarteDoree"], [/^plus4:/, "overlayPlus4"]];
let ecranAttenduApresRetour = null; // en ligne : écran à retrouver à la fin du rejeu (voir finirRattrapage)
function ecranDuChoix(idAction){
  const e = ECRANS_DES_CHOIX.find(([motif]) => motif.test(String(idAction || "")));
  return e ? e[1] : null;
}
// Pendant le rejeu (rattrapageEnCours : annonces et animations quasi instantanées), jusqu'à ce que l'écran soit là
// (8 s au plus : si le choix ne revient pas, on s'arrête là où on en est)
function avancerJusquAEcran(id, fin){
  const depart = Date.now();
  const tour = () => {
    if(!id || document.getElementById(id) || Date.now() - depart > 8000) return fin();
    if(document.getElementById("overlayRegleUnique")) fermerOverlayRegleUnique(); // (annonce qui attend un tap)
    setTimeout(tour, 40);
  };
  tour();
}

function defaireChoix(choix){
  if(estSpectateur) return;
  if(enLigneActif){
    ecrireAction(`defaire:${choix.debut}`).catch(() => afficherToast(tr("Connexion perdue, réessaie")));
    return;
  }
  if(!sauvegardeClassique || sauvegardeClassique.actions.length - 1 !== choix.fin) return;
  const s = sauvegardeClassique;
  repriseClassiqueEnCours = true; // (retourMenu ne l'oublie pas, lancerPartie reprend sa graine)
  nettoyerOverlays();
  retourMenu();
  joueurs = s.joueurs.slice();
  annulations = {};
  rejouerActionsClassiques(s.actions.slice(0, choix.debut), tr("Retour en arrière…"), null, ecranDuChoix(s.actions[choix.debut]));
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
    if(action.par === pseudoActuel) afficherToast(tr("Trop tard pour annuler"));
    return "ignorer";
  }
  for(let s = debut; s <= fin; s++) seqsAnnulees.add(s);
  ecranAttenduApresRetour = ecranDuChoix((toutesActionsManche.get(debut) || {}).id);
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
