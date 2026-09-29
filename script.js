document.addEventListener("DOMContentLoaded", function () {
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
  const VERSION_AFFICHEE = "8.3.3";
  const VERSION_JEU = VERSION_AFFICHEE.split(".")
    .reduce((total, partie, i) => total + Number(partie) * [10000, 100, 1][i], 0);
  document.getElementById("versionJeu").innerText = "version " + VERSION_AFFICHEE;

  // ===== Easter egg : 4 taps rapides sur le titre ALCUNO => écran des créateurs =====
  const ecranCredits = document.getElementById("ecranCredits");
  let tapsTitre = 0;
  let dernierTapTitre = 0;

  // pointerdown (et pas click) : les taps rapprochés ne génèrent pas tous un "click" sur mobile
  document.querySelector("header h1").addEventListener("pointerdown", () => {
    const maintenant = Date.now();
    tapsTitre = (maintenant - dernierTapTitre < 600) ? tapsTitre + 1 : 1;
    dernierTapTitre = maintenant;

    if (tapsTitre >= 4) {
      tapsTitre = 0;
      ecranCredits.scrollTop = 0;
      ecranCredits.style.display = "";
    }
  });

  document.getElementById("btnFermerCredits").addEventListener("click", () => {
    ecranCredits.style.display = "none";
  });

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
  validerAvecEntree(["codeRejoindre", "pseudoRejoindre"], "validerRejoindre");

  document.getElementById("btnModeClassique").addEventListener("click", () => {
    document.getElementById("choixMode").style.display = "none";
    document.getElementById("menu").style.display = "";
    document.getElementById("messages").style.display = "";
    document.getElementById("jeu").style.display = "";
  });

  document.getElementById("btnModeEnLigne").addEventListener("click", () => {
    document.getElementById("choixMode").style.display = "none";
    document.getElementById("enLigne").style.display = "";
  });

  document.getElementById("btnCreerPartie").addEventListener("click", () => {
    document.getElementById("enLigneChoix").style.display = "none";
    document.getElementById("enLigneCreer").style.display = "";
  });

  document.getElementById("btnRejoindrePartie").addEventListener("click", () => {
    document.getElementById("enLigneChoix").style.display = "none";
    document.getElementById("enLigneRejoindre").style.display = "";
  });

  document.getElementById("btnQuitterSalle").addEventListener("click", quitterPartie);

  document.getElementById("validerCreation").addEventListener("click", () => {
    const pseudo = document.getElementById("pseudoCreateur").value.replace(/\s+/g, " ").trim();
    if (!pseudo) { alert("Entre un pseudo."); return; }
    if (PSEUDO_INVALIDE.test(pseudo)) { alert("Pseudo invalide (pas de . # $ [ ] /)."); return; }

    attendreFirebase(() => {
      let code = null;

      trouverCodeLibre().then((codeLibre) => {
        code = codeLibre;
        return window.fbSet(window.fbRef(window.firebaseDB, `parties/${code}`), {
          version: VERSION_JEU,
          hote: pseudo,
          joueurs: {
            [pseudo]: { nom: pseudo, host: true, rejoint: Date.now() }
          },
          etatJeu: { demarree: false, hote: pseudo },
          // Pour le nettoyage automatique (.github/workflows/nettoyage.yml)
          creee: window.fbServerTimestamp(),
          activite: window.fbServerTimestamp()
        });
      }).then(() => {
        codePartieActuel = code;
        pseudoActuel = pseudo;
        estHote = true;

        document.getElementById("enLigneCreer").style.display = "none";
        document.getElementById("codePartieAffiche").innerText = "Code de la partie : " + code;
        document.getElementById("salleAttente").style.display = "";

        ecouterSalleAttente(code);
        ecouterEtatPartie(code);
      }).catch(erreurFirebase);
    });
  });

  document.getElementById("validerRejoindre").addEventListener("click", () => {
    const code = document.getElementById("codeRejoindre").value.trim().toUpperCase();
    const pseudo = document.getElementById("pseudoRejoindre").value.replace(/\s+/g, " ").trim();
    if (!code || !pseudo) { alert("Entre le code et ton pseudo."); return; }
    if (PSEUDO_INVALIDE.test(pseudo)) { alert("Pseudo invalide (pas de . # $ [ ] /)."); return; }

    attendreFirebase(() => {
      const db = window.firebaseDB;
      const refPartie = window.fbRef(db, `parties/${code}`);

      window.fbGet(refPartie).then((snapshot) => {
        if (!snapshot.exists()) {
          alert("Aucune partie trouvée avec ce code.");
          return;
        }

        const partie = snapshot.val();
        if (partie.version !== VERSION_JEU) {
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
          return;
        }
        if (partie.etatJeu && partie.etatJeu.demarree) {
          alert("La partie a déjà commencé.");
          return;
        }
        if (partie.joueurs && partie.joueurs[pseudo]) {
          alert("Ce pseudo est déjà pris dans cette partie.");
          return;
        }

        const refJoueur = window.fbRef(db, `parties/${code}/joueurs/${pseudo}`);
        window.fbSet(refJoueur, { nom: pseudo, host: false, rejoint: Date.now() }).then(() => {
          marquerActivite(code);
          codePartieActuel = code;
          pseudoActuel = pseudo;
          estHote = false;

          document.getElementById("enLigneRejoindre").style.display = "none";
          document.getElementById("codePartieAffiche").innerText = "Code de la partie : " + code;
          document.getElementById("salleAttente").style.display = "";

          ecouterSalleAttente(code);
          ecouterEtatPartie(code);
        }).catch(erreurFirebase);
      }).catch(erreurFirebase);
    });
  });

  document.getElementById("lancerPartieEnLigne").addEventListener("click", () => {
    if (!estHote || !codePartieActuel) return;

    window.fbGet(window.fbRef(window.firebaseDB, `parties/${codePartieActuel}/joueurs`)).then((snapshot) => {
      const liste = Object.values(snapshot.val() || {})
        .sort((a, b) => (a.rejoint || 0) - (b.rejoint || 0))
        .map(j => j.nom);

      if (liste.length < 2) { alert("Il faut au moins 2 joueurs."); return; }
      lancerMancheEnLigne(liste, true);
    }).catch(erreurFirebase);
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


  function ecouterSalleAttente(code){
    const db = window.firebaseDB;
    const refJoueurs = window.fbRef(db, `parties/${code}/joueurs`);

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
        quitterPartieEnLigne();
        alert("Tu as été retiré de la partie.");
        return;
      }

      // Le rôle d'hôte peut changer (l'hôte précédent est parti)
      estHote = !!data[pseudoActuel].host;

      const liste = document.getElementById("listeJoueursEnLigne");
      liste.innerHTML = "";

      const tries = Object.values(data).sort((a, b) => (a.rejoint || 0) - (b.rejoint || 0));
      tries.forEach((j) => {
        const div = document.createElement("div");
        const nom = document.createElement("span");
        nom.innerText = avecCouronne(j.nom) + (j.host ? " (hôte)" : "");
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

    window.fbRunTransaction(refEtat, (etat) => {
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

  // Quitte la partie (Accueil, ou Retour dans la salle d'attente)
  function quitterPartie(){
    const code = codePartieActuel;
    const pseudo = pseudoActuel;
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
    if (desabonnerJoueurs) { desabonnerJoueurs(); desabonnerJoueurs = null; }
    if (desabonnerEtat) { desabonnerEtat(); desabonnerEtat = null; }
    if (desabonnerActions) { desabonnerActions(); desabonnerActions = null; }

    codePartieActuel = null;
    pseudoActuel = null;
    estHote = false;
    hotePartie = null;
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

  let joueurs = [];
  let annulations = {}; // { "Alice": 3, "Bob": 0, ... }
  let paquet = [];

  // Easter egg : environ 1 partie sur 50, une case en plus sur le plateau cache la carte dorée
  const CHANCE_CARTE_DOREE = 1 / 50;
  let indexCaseDoree = -1; // -1 = pas de carte dorée dans cette partie
  let carteDoreeEnJeu = false; // présente et pas encore retournée

  let paquetDuel = [];
  let duelEnCours = false;
  let duelMultiplicateur = 1;

  let indexJoueur = 0;
  let partieLancee = false;

  let indexPigeon = null;
  let nomPigeonOriginal = "";
  let choixPigeonEnCours = false;

  let zeroEnCours = false;
  let switchEnCours = false;
  let sensHoraire = true;

  let couleurChoisie = null;
  let carteTroisPourTransfertPigeon = "";
  let messageCouleurEnCours = false;

  let phase = 1;       // 1 = choix J1, 2 = choix J2
  let choixJ1 = null;  // 1 ou 2 (carte de gauche/droite)
  let lastCols = null;
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

    if (ecart > 0 && ecart < 300) {
      if (!e.target.closest("input, textarea, select, label")) {
        e.preventDefault();
      }
    }

    dernierTap = maintenant;
  }, { passive: false });

  /* ===== OUTILS ===== */
  function appliquerBonusCouleurSiBesoin(carteTiree, options = {}){
    if(!couleurChoisie) return false;

    const estExclue =
      carteTiree.startsWith("plus_4") ||
      carteTiree.startsWith("couleur");

    if(estExclue) return false;

    const colCarte = couleurDeLaCarte(carteTiree);
    if(!(colCarte && colCarte === couleurChoisie)) return false;

    const preserveRuleMessage = !!options.preserveRuleMessage;
    const msgCouleur = "Et boit 1 gorgée pour la couleur (" + couleurChoisie + ")";

    const afficher = () => {
      if(!preserveRuleMessage){
        regleZero.innerText = msgCouleur;
        regleZero.style.display = "block";
        zeroEnCours = true;
      }
      montrerOverlayRegle(msgCouleur, carteTiree);
    };

    couleurChoisie = null;

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

    // Sauve la position pour iOS
    scrollYBeforeLock = window.scrollY || document.documentElement.scrollTop || 0;
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--sbw", (sbw > 0 ? sbw : 0) + "px");

    document.body.classList.add("no-scroll");
    document.body.style.top = `-${scrollYBeforeLock}px`;
  }

  function unlockScroll(){
    if(scrollLockCount <= 0) return;
    scrollLockCount--;
    if(scrollLockCount > 0) return;

    document.body.classList.remove("overlay-open");
    document.body.classList.remove("no-scroll");
    document.documentElement.style.removeProperty("--sbw");
    const top = document.body.style.top;
    document.body.style.top = "";

    const y = top ? Math.abs(parseInt(top, 10)) : scrollYBeforeLock;
    window.scrollTo(0, y);
  }
  
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

  function lancerOverlayPrediction(startIndex){
    if(predictionEnCours) return;
    if(joueurs.length < 2) return;
    if(paquet.length !== 1) return; // on doit être à l'avant-dernière carte tirée

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
    subtitle.innerText = "Chacun choisit un type de carte. Tous ceux qui trouvent distribuent un CUL SEC !.";

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
        const lastCard = paquet[0];
        const vraiType = typeFromCardClass(lastCard);
        const gagnants = ordre
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

        const prev = creerCartePreview(TYPES_PARIS.find(t=>t.id===vraiType)?.rep || lastCard);
        reveal.appendChild(prev);

        const txt = document.createElement('div');
        txt.className = 'fin-choix-resultat';

        if(gagnants.length === 0){
          txt.innerText = `Personne n'a trouvé \nLa dernière carte était ${nomType(vraiType)}`;
        } else if(gagnants.length === 1){
          txt.innerText = `${gagnants[0]} a trouvé ! Il/elle distribue un CUL SEC !`;
        } else {
          txt.innerText = `${gagnants.join(', ')} ont trouvé ! Chacun distribue un CUL SEC !`;
        }
        reveal.appendChild(txt);

        const btn = document.createElement('button');
        btn.className = 'bouton-pigeon';
        btn.innerText = 'Terminer';
        surAction(btn, "pred:terminer", { owner: () => hotePartie, once: true }, () => {
          if(overlay._cleanup) overlay._cleanup();
          overlay.remove();
          unlockScroll();
          predictionEnCours = false;

          // On considère la dernière carte comme "résolue" par le pari :
          // on la retire du paquet et on enchaîne directement sur l'écran de fin.
          if(paquet.length === 1){
            paquet.pop();
          }
          // Affiche systématiquement l'écran de fin (même si 0 "1 restant")
          afficherOverlayFinUnRestants();
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


  function repositionnerStickyJoueurActif(){
    if(!stickyJoueurActif || !messagesBar) return;

    const rect = messagesBar.getBoundingClientRect();
    const gap = window.innerWidth <= 520 ? 8 : 10;
    const topSouhaite = Math.max(Math.round(rect.bottom + gap), 0);

    stickyJoueurActif.style.setProperty("--sticky-anchor-bottom", `${topSouhaite}px`);
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
    bonusEl.innerText = n > 0 ? `+${n}` : "";
    if(enLigneActif && nom === pseudoActuel) labelEl.innerText = "À toi !";

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

  function afficherJoueurs(){
    listeJoueurs.innerHTML = joueurs.map((j,i)=>{
      const n = Number(annulations[j] || 0);
      const bonus = n > 0 ? ` <span class="bonus-annulation">+${n}</span>` : "";

      if(i === indexPigeon){
        return `<div class="joueur-ligne joueur-ligne-pigeon"><strong>PIGEON</strong> (${echapperHtml(avecCouronne(nomPigeonOriginal))})${bonus}</div>`;
      }

      return `<div class="joueur-ligne">${echapperHtml(avecCouronne(j))}${bonus}</div>`;
    }).join("");

    if(!partieLancee){
      btnJouer.style.display = joueurs.length >= 2 ? "inline-block" : "none";
    }
    btnSupprimer.style.display = (!partieLancee && joueurs.length > 0) ? "inline-block" : "none";
    // Avant la partie seulement : pendant la partie, l'accueil passe par « Nouvelle partie »
    btnAccueilClassique.style.display = partieLancee ? "none" : "inline-block";
    majStickyJoueurActif();
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

    majStickyJoueurActif();
  }

  function afficherMessagePigeon(msg){
    reglePigeon.innerText = msg;
    reglePigeon.style.display = "block";
  }

  function effacerMessagePigeon(){
    reglePigeon.innerText = "";
    reglePigeon.style.display = "none";
  }

  /* ===== JOUEURS ===== */
  function ajouterJoueur(){
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


  btnAjouter.addEventListener("pointerdown", ajouterJoueur);
  nomJoueurInput.addEventListener("keydown", e=>{ if(e.key==="Enter") ajouterJoueur(); });

  btnSupprimer.addEventListener("pointerdown", ()=>{
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

  btnTermine.addEventListener("pointerdown", ()=>{
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
        ligne.innerText = `${x.nom} doit boire ${x.n} gorgée(s) pour les 1 restants`;
        bloc.appendChild(ligne);
      });
    }

    overlay.appendChild(bloc);

    const btnTerminer = document.createElement("button");
    btnTerminer.className = "bouton-pigeon";
    btnTerminer.innerText = "Terminer";

    surAction(btnTerminer, "fin:terminer", { owner: () => hotePartie, once: true }, () => {
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
        const msg = `${joueurs[i]} est le nouveau PIGEON,\n il boit 2 gorgées pour fêter ça`;
        // .messages : on l'affiche dans reglePigeon (et il disparaît au prochain tirage)
        // 3) overlay + annulation si compteur (utilise la carte "trois" qui a déclenché le transfert)
        annoncerBoireAvecAnnulation(
          i,
          2,
          carteTroisPourTransfertPigeon || "trois_vert",
          msg
        );
        // optionnel : on nettoie
        carteTroisPourTransfertPigeon = "";
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

  // Appelle callback UNE fois : à la fin de la transition de l'élément, ou au plus tard après `ms`.
  // Sécurité : si la transition n'a pas lieu (ex. fermeture juste avant la fin de l'apparition),
  // "transitionend" n'arrive jamais et l'overlay resterait bloqué à l'écran.
  function apresTransition(el, ms, callback){
    let fait = false;
    const fin = () => {
      if (fait) return;
      fait = true;
      callback();
    };
    el.addEventListener("transitionend", fin, { once: true });
    setTimeout(fin, ms + 80);
  }

  function dureeOverlayPourMessage(message){
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

    overlay.style.opacity = "0";
    overlay.style.transform = "scale(0.8)";
    apresTransition(overlay, 300, () => {
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

    const fermer = () => {
      overlay.style.opacity = "0";
      overlay.style.transform = "scale(0.96)";
      overlay.addEventListener("transitionend", () => {
        overlay.remove();
        unlockScroll();
        if(typeof afterClose === "function") afterClose();
      }, { once: true });
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

      btn.addEventListener("pointerdown", () => {
        const utilise = i;
        const reste = nbGorgees - utilise;

        annulations[nom] = Math.max(0, dispo - utilise);
        afficherJoueurs();
        afficherJoueurActif();

        boutons.remove();

        const resultat = document.createElement("div");
        resultat.innerText = utilise > 0
          ? `${utilise} gorgée(s) annulée(s).\nTu bois ${reste} gorgée(s).`
          : `Tu n’annules rien.\nTu bois ${reste} gorgée(s).`;
        resultat.style.fontSize = "clamp(22px, 5vw, 42px)";
        resultat.style.fontWeight = "900";
        resultat.style.textShadow = "2px 2px 5px #000";
        resultat.style.maxWidth = "min(820px, 92vw)";
        overlay.appendChild(resultat);

        if(typeof onDone === "function") onDone(utilise, reste);
        setTimeout(fermer, 1200);
      });

      boutons.appendChild(btn);
    }

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    });

    return true;
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
      overlay.style.opacity = "0";
      overlay.style.transform = "scale(0.96)";
      apresTransition(overlay, 250, () => {
        overlay.remove();
        unlockScroll();
        if(typeof afterClose === "function") afterClose();
      });
    };

    overlay.style.cursor = "pointer";
    overlay.addEventListener("pointerdown", fermer);

    document.body.appendChild(overlay);
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
      overlay.style.opacity = "0";
      overlay.style.transform = "scale(0.96)";
      apresTransition(overlay, 250, () => {
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
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    });

    return true;
  }

  // Ajoute (ou remplace) l'UI de choix d'annulation dans l'overlay existant.
  // - joueurIndex : index dans joueurs[]
  // - nbGorgees : combien il devrait boire au départ
  // - onDone(annule, reste) : callback une fois le choix fait
  function injecterChoixAnnulationDansOverlay(joueurIndex, nbGorgees, onDone, afterClose = null){
    const overlay = document.getElementById("overlayRegleUnique");
    if(!overlay) return false;

    const nom = joueurs[joueurIndex];
    const dispo = Number(annulations[nom] || 0);
    const maxAnnulable = Math.min(dispo, nbGorgees);

    if(maxAnnulable <= 0) return false;

    // On verrouille l'overlay => pas d'auto-close tant que pas de choix
    overlayRegleVerrouille = true;

    // On stoppe le timer de fermeture si déjà lancé
    if (overlayRegleTimeout) {
      clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = null;
    }

    // Supprime un ancien bloc d'annulation si présent (au cas où)
    const old = overlay.querySelector(".bloc-annulation");
    if(old) old.remove();

    const bloc = document.createElement("div");
    bloc.className = "bloc-annulation";

    const titre = document.createElement("div");
    titre.className = "titre-annulation";
    titre.innerText = `${nom}, tu as +${dispo} annulation(s). Combien de gorgées veux-tu annuler ?`;
    bloc.appendChild(titre);

    const boutons = document.createElement("div");
    boutons.className = "ligne-boutons-annulation";

    // Boutons: 0..maxAnnulable (pas d'invention : 1 bouton par valeur possible)
    for(let i=0; i<=maxAnnulable; i++){
      const btn = document.createElement("button");
      btn.className = "bouton-annulation";
      btn.innerText = `Annuler ${i}`;

      btn.addEventListener("pointerdown", () => {
        const utilise = i;
        const reste = nbGorgees - utilise;

        annulations[nom] = Math.max(0, dispo - utilise);
        afficherJoueurs();

        // Enlève le bloc boutons (choix fait)
        bloc.remove();

        // Ajoute une ligne résultat dans l'overlay
        const boxTexte = overlay.querySelector(".overlay-regle-texte");
        if(boxTexte){
          const ligne = document.createElement("div");
          ligne.style.marginTop = "10px";
          ligne.innerText =
            utilise > 0
              ? `${utilise} gorgée(s) annulée(s). \nTu bois ${reste} gorgée(s).`
              : `Tu n’annules rien. Tu bois ${reste} gorgée(s).`;
          boxTexte.appendChild(ligne);
        }

        // Déverrouille et ferme après un court délai (le temps de lire)
        overlayRegleVerrouille = false;

        // petite pause de lecture, puis fermeture
        if(typeof onDone === "function") onDone(utilise, reste);
        setTimeout(() => {
          fermerOverlayRegleUnique(afterClose);
        }, dureeOverlayPourMessage(utilise > 0
          ? `${utilise} gorgée(s) annulée(s). \nTu bois ${reste} gorgée(s).`
          : `Tu n’annules rien. Tu bois ${reste} gorgée(s).`));
      });

      boutons.appendChild(btn);
    }

    bloc.appendChild(boutons);
    overlay.appendChild(bloc);

    return true;
  }

  // Annonce "X boit N" + propose annulation si dispo
  function annoncerBoireAvecAnnulation(joueurIndex, nbGorgees, classeCarte = "", prefixMsg = null, onFinish = null){
    const nom = joueurs[joueurIndex];
    const msg = prefixMsg ? prefixMsg : `${nom} boit ${nbGorgees} gorgée(s)`;

    if (nbGorgees > 15) {
      const message17 =
        "Et interdit de vomir, c'est pas fini !\n" +
        "Célien Cosme (un des créateurs du jeu).";

      montrerOverlayRegle(`${msg}\n\n${message17}`, classeCarte);

      // Ce message contient l'avertissement "interdit de vomir" => +2s d'affichage
      if (overlayRegleTimeout) {
        clearTimeout(overlayRegleTimeout);
      }
      if (!overlayRegleVerrouille) {
        overlayRegleTimeout = setTimeout(
          () => fermerOverlayRegleUnique(),
          dureeOverlayPourMessage(`${msg}\n\n${message17}`) + 2000
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



  function montrerOverlayRegle(message, classeCarte = "", classeCarteSupplementaire = "") {
    let overlay = document.getElementById("overlayRegleUnique");
    if (overlay) {
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

      if (boxTexte) {
        boxTexte.innerHTML = "";
        const ligne = document.createElement("div");
        ligne.innerText = message;
        boxTexte.appendChild(ligne);
      }

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

    const ligne1 = document.createElement("div");
    ligne1.innerText = message;
    boxTexte.appendChild(ligne1);

    overlay.appendChild(boxTexte);
    overlay.style.cursor = "pointer";
    overlay.addEventListener("pointerdown", () => {
      if (!overlayRegleVerrouille) {
        fermerOverlayRegleUnique();
      }
    });

    lockScroll();
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1)";
    });

    if (!overlayRegleVerrouille) {
      if (overlayRegleTimeout) clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = setTimeout(() => fermerOverlayRegleUnique(), dureeOverlayPourMessage(message));
    }
  }

  /* ===== Règles centralisées ===== */
  const reglesBoire = {
    "zero": "Tout le monde boit 1 gorgée sauf toi",
    "plus_2": "Boit 2 gorgées",
    "plus_4": "Distribue 4 gorgées (tu peux les partager)",
    "interdit": "SOCIAAALE ! \nTout le monde boit 1 gorgée"
  };

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
        const mapCouleurs = {
          rouge: "#e53935",
          bleu: "#1e88e5",
          vert: "#43a047",
          jaune: "#fdd835"
        };
        messageTexte.innerText = c.nom.toUpperCase();
        messageTexte.style.color = mapCouleurs[c.nom] || "#FFD700";
        messageCouleurEnCours = true;
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

  /* ===== CARTE DORÉE : choix de celui qui prend le cul sec ===== */
  function afficherOverlayCarteDoree(joueurActuel){
    if(document.getElementById("overlayCarteDoree")) return;
    const choisisseur = joueurs[joueurActuel];
    choixPigeonEnCours = true;
    lockScroll();

    const overlay = document.createElement("div");
    overlay.id = "overlayCarteDoree";

    const titre = document.createElement("div");
    titre.className = "titre-pigeon";
    titre.innerText = "Choisis à qui tu vas distribuer ton cul sec";
    overlay.appendChild(titre);

    // Tout le monde, y compris celui qui a tiré la carte
    joueurs.forEach((nom, i) => {
      const btn = document.createElement("button");
      btn.className = "bouton-pigeon";
      btn.innerText = nom;
      surAction(btn, "doree:" + i, { owner: choisisseur, once: true }, () => {
        overlay.remove();
        unlockScroll();
        afficherOverlayTiensGueule(nom);
        // Plateau (et pari de fin) débloqués seulement une fois le message lu
        executerApresOverlayRegleUnique(() => {
          choixPigeonEnCours = false;
          afficherJoueurActif();
        });
      });
      overlay.appendChild(btn);
    });

    document.body.appendChild(overlay);
  }

  // En ligne : seul le téléphone de la victime affiche « TIENS DANS TA GUEULE. »
  function afficherOverlayTiensGueule(victime){
    if(enLigneActif && victime !== pseudoActuel){
      montrerOverlayRegle(`${victime} prend le CUL SEC de la carte dorée !`, "carte_doree");
      return;
    }
    montrerOverlayRegle("TIENS DANS TA GUEULE.");
  }

  /* ===== DUEL : Choix joueurs puis tirage ===== */
  function lancerOverlayChoixDuel(joueurActuel){
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
          afficherOverlayTirageDuel(overlay, picks[0], picks[1]);
        }
      });

      containerBoutons.appendChild(btn);
    });

    document.body.appendChild(overlay);
  }

  function afficherOverlayTirageDuel(overlay, j1, j2){
    const content = document.createElement("div");
    content.className = "duel-content duel-tirage-content";
    overlay.appendChild(content);

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
    let selectionFaite = false;

    function tirerUneCarte(){
      resetPaquetDuelSiBesoin();
      return paquetDuel.shift();
    }

    // 1) On prépare le duel : les 2 cartes sont "en main" mais restent de dos à l'écran
    function preparerDuel(){
      phase = 1;
      choixJ1 = null;
      info.innerText = joueurs[j1] + " : choisis une carte";

      selectionFaite = false;

      // Reset visuel : cartes de dos (classe Carte uniquement)
      c1.className = "Carte";
      c2.className = "Carte";
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
        // petite pause puis on relance un duel (toujours dos au départ)
        setTimeout(() => {
          preparerDuel();
        }, 1500);
        return;
      }

      const perdant = (v1 < v2) ? j1 : j2;
      const vPerdant = (v1 < v2) ? v1 : v2;
      const gorg = vPerdant * duelMultiplicateur;
      const msg = joueurs[perdant] + " boit " + gorg + " gorgées";

       // 1) on enlève l’overlay du duel (après un mini délai pour lire le reveal)
      setTimeout(() => {
        unlockScroll();
        overlay.remove();
        annoncerBoireAvecAnnulation(perdant, gorg, "", msg);

        // Puis on restaure l'état du jeu (sans attendre la fin d'overlay ici)
        setTimeout(() => {
          duelEnCours = false;
          choixPigeonEnCours = false;
          duelMultiplicateur = 1;
          afficherJoueurActif();
        }, 1800);
      }, 1100);
    }

    function onChoose(which){
      // Phase 1 : J1 choisit
      if(phase === 1){
        choixJ1 = which;
        phase = 2;

        if(which === 1){
          c1.classList.add("duel-selected");
          c1.style.pointerEvents = "none";
          c2.style.pointerEvents = "auto";
        } else {
          c2.classList.add("duel-selected");
          c2.style.pointerEvents = "none";
          c1.style.pointerEvents = "auto";
        }

        label1.innerText = "";
        label2.innerText = "";
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

        // Attribution réelle des cartes
        const carteJ1 = (choixJ1 === 1) ? carteA : carteB;
        const carteJ2 = (choixJ1 === 1) ? carteB : carteA;

        info.innerText = "On retourne les cartes…";
        overlay.classList.add("reveal");

        c1.classList.remove("duel-selected");
        c2.classList.remove("duel-selected");
        c1.style.boxShadow = "";
        c2.style.boxShadow = "";

        // Reveal des 2 cartes (on ajoute les classes maintenant)
        setTimeout(() => {

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
        }, 1400);
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
    lockScroll();
    const choisisseur = joueurs[joueurActuel];

    const overlay = document.createElement("div");
    overlay.id = "overlayPlus4";

    const titre = document.createElement("div");
    titre.className = "titre-pigeon";
    titre.innerText = "PLUS 4 — Distribue 4 gorgées";
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
      totalBox.innerText = `Gorgées distribuées : ${total} / 4`;

      if(total < 4){
        info.innerText = "Choisis à qui tu veux distribuer tes 4 gorgées.";
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

        // optionnel: griser si total déjà à 4 (plus possible d'ajouter)
        if(total >= 4){
          btn.style.opacity = "0.7";
        } else {
          btn.style.opacity = "1";
        }
      });

      // enable/disable undo
      btnUndo.disabled = (historique.length === 0);
      btnUndo.style.opacity = btnUndo.disabled ? "0.6" : "1";

      // validation uniquement si total == 4
      btnValider.disabled = (total !== 4);
      btnValider.style.opacity = btnValider.disabled ? "0.6" : "1";
    }

    // boutons joueurs : UN CLIC = +1 (si total < 4)
    joueurs.forEach((nom, idx)=>{
      const btn = document.createElement("button");
      btn.className = "bouton-pigeon plus4-joueur-btn";
      btn.dataset.idx = String(idx);
      btn.innerText = nom;

      surAction(btn, "plus4:joueur:" + idx, { owner: choisisseur }, ()=>{
        const total = totalDistribue();
        if(total >= 4) return;

        dist[idx] += 1;
        historique.push(idx);
        refreshUI();
      });

      container.appendChild(btn);
    });

    const btnUndo = document.createElement("button");
    btnUndo.className = "bouton-pigeon plus4-action-btn";
    btnUndo.innerText = "Annuler la dernière";
    surAction(btnUndo, "plus4:annuler", { owner: choisisseur }, ()=>{
      if(historique.length === 0) return;
      const idx = historique.pop();
      if(dist[idx] > 0) dist[idx] -= 1;
      refreshUI();
    });
    actions.appendChild(btnUndo);

    const btnReset = document.createElement("button");
    btnReset.className = "bouton-pigeon plus4-action-btn";
    btnReset.innerText = "Reset";
    surAction(btnReset, "plus4:reset", { owner: choisisseur }, ()=>{
      Object.keys(dist).forEach(k => dist[k] = 0);
      historique = [];
      refreshUI();
    });
    actions.appendChild(btnReset);

    const btnValider = document.createElement("button");
    btnValider.className = "bouton-pigeon plus4-action-btn";
    btnValider.innerText = "Valider";
    surAction(btnValider, "plus4:valider", { owner: choisisseur, once: true }, ()=>{
      if(totalDistribue() !== 4) return;

      overlay.remove();
      unlockScroll();
      choixPigeonEnCours = false;
      afficherJoueurActif();

      const file = Object.entries(dist)
        .map(([k,v]) => ({ idx: Number(k), n: Number(v) }))
        .filter(x => x.n > 0);

      distribuerFilePlus4(file, classeCartePlus4);
    });
    actions.appendChild(btnValider);

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

  /* ===== Application des règles ===== */
  function appliquerRegle(carteTiree, joueurActuel, carteElement){
    if(zeroEnCours || switchEnCours){
      regleZero.style.display="none";
      zeroEnCours=false;
      switchEnCours=false;
    }

    effacerMessagePigeon();
    
    // On enlève l'affichage de la couleur au prochain tirage
    if(messageCouleurEnCours){
      messageTexte.innerText = "";
      messageTexte.style.color = "#FFD700"; // ou "inherit"
      messageCouleurEnCours = false;
    }


    if (carteTiree === "carte_doree") {
      regleZero.innerText = "CARTE DORÉE : distribue un cul sec";
      regleZero.style.display = "block";
      zeroEnCours = true;

      // Plateau bloqué (et pari de fin en attente) jusqu'au choix de la victime
      choixPigeonEnCours = true;
      montrerOverlayRegle(
        "Tu as trouvé la CARTE DORÉE !!\n" +
        "Distribue un cul sec de la part du développeur, et obligation de se servir un vrai verre avant 😘",
        carteTiree
      );
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
        appliquerBonusCouleurSiBesoin(carteTiree, { preserveRuleMessage: true });
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
        appliquerBonusCouleurSiBesoin(carteTiree, { preserveRuleMessage: true });
      });
      return;
    }

    if (carteTiree.startsWith("plus_2")) {
      annoncerBoireAvecAnnulation(
        joueurActuel,
        2,
        carteTiree,
        `${joueurs[joueurActuel]} boit 2 gorgées`,
        () => {
          appliquerBonusCouleurSiBesoin(carteTiree, { preserveRuleMessage: true });
        }
      );
      return; // important : on évite le traitement générique en dessous
    }

    // Autres règles génériques de "boire"
    for (const key in reglesBoire) {
      if (key === "plus_2") continue; // sécurité (au cas où)
      if (carteTiree.startsWith(key)) {
        const msg = reglesBoire[key];
        regleZero.innerText = msg;
        regleZero.style.display = "block";
        zeroEnCours = true;
        montrerOverlayRegle(msg, carteTiree);
        appliquerBonusCouleurSiBesoin(carteTiree, { preserveRuleMessage: true, afterRuleOverlay: true });
        return; // une seule règle "boire" à appliquer
      }
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

      // la carte reste visible 6s puis devient "trou"
      if(carteElement){
        setTimeout(() => {
          carteElement.classList.add("carte-disparue");
        }, 2000);
      }
    }


    // Cartes "switch"
    if(carteTiree.startsWith("switch")){
      sensHoraire = !sensHoraire;
      const msg = "Sens du jeu inversé";
      regleZero.innerText = msg;
      regleZero.style.display = "block";
      switchEnCours = true;
      montrerOverlayRegle("Le sens du jeu est inversé !", carteTiree);
      appliquerBonusCouleurSiBesoin(carteTiree, { preserveRuleMessage: true, afterRuleOverlay: true });
    }

    // Cartes "trois/pigeon"
    if(carteTiree.startsWith("trois")){
      
      if(indexPigeon===null){
        indexPigeon=joueurActuel;
        nomPigeonOriginal=joueurs[joueurActuel];
        annoncerBoireAvecAnnulation(
          joueurActuel,
          2,
          carteTiree,
          `${joueurs[joueurActuel]} est PIGEON ! \nIl boit 2 gorgées. \nÀ chaque 3 tiré, tu bois 1 gorgée. \nPour en sortir, tire un 3.`,
          () => {
            appliquerBonusCouleurSiBesoin(carteTiree, { preserveRuleMessage: true });
          }
        );
      
      } else if(indexPigeon===joueurActuel){
        carteTroisPourTransfertPigeon = carteTiree;
        afficherMenuPigeon();
      
      } else {
        // si quelqu'un d'autre tire un 3 : le pigeon boit 1 (annulable si compteur)
        const msg = "Le PIGEON boit 1 gorgée";
        // message dans .messages (disparaît au prochain tirage grâce à effacerMessagePigeon() au début)
        // overlay + choix d'annulation si le pigeon a des "UN"
        annoncerBoireAvecAnnulation(indexPigeon, 1, carteTiree, msg, () => {
          appliquerBonusCouleurSiBesoin(carteTiree, { preserveRuleMessage: true });
        });
      }
    }

    // Cartes "couleur"
    if(carteTiree.startsWith("couleur")){
      afficherOverlayCouleur(joueurActuel);
    }

    // Cartes "quatre" => duel
    if(carteTiree.startsWith("quatre")){
      lancerOverlayChoixDuel(joueurActuel);
    }

    // - ne s'applique PAS à plus_2 / plus_4 / couleur
    // - ne se déclenche QUE quand la carte tirée est de la couleur choisie
    if(couleurChoisie){
      const estExclue =
        carteTiree.startsWith("plus_4") ||
        carteTiree.startsWith("couleur");

      if(!estExclue){
        const colCarte = couleurDeLaCarte(carteTiree);

        if(colCarte && colCarte === couleurChoisie){
          const msgCouleur = "Et boit 1 gorgée pour la couleur ("+ couleurChoisie +")";

          // annulable via les "UN" (même overlay, pas de superposition)
          annoncerBoireAvecAnnulation(joueurActuel, 1, carteTiree, msgCouleur);

          // la couleur "attendue" est tombée => on reset
          couleurChoisie = null;
        }
      }
    }
    
  }

  /* ===== JEU ===== */
  function lancerPartie(){
    if(joueurs.length < 2){
      alert("Il faut au moins 2 joueurs");
      return;
    }

    plateau.innerHTML = "";

    // Plateau principal = toutes les cartes SAUF 2/5/6/7/8/9 (paquet duel)
    const paquetPrincipal = classes.filter(c => !duelCartes.includes(c));
    paquet = [...paquetPrincipal];
    melangerPaquet(paquet);

    // Paquet duel (réutilisable à l'infini via resetPaquetDuelSiBesoin)
    paquetDuel = [...duelCartes];
    melangerPaquet(paquetDuel);

    // Tirée avec « aleatoire » : en ligne, tous les téléphones ont la même carte dorée au même endroit
    const avecCarteDoree = aleatoire() < CHANCE_CARTE_DOREE;
    const nbCases = paquet.length + (avecCarteDoree ? 1 : 0);
    indexCaseDoree = avecCarteDoree ? Math.floor(aleatoire() * nbCases) : -1;
    carteDoreeEnJeu = avecCarteDoree;

    indexJoueur = 0;
    partieLancee = true;
    zeroEnCours = false;
    switchEnCours = false;
    sensHoraire = true;
    couleurChoisie = null;

    duelEnCours = false;
    duelMultiplicateur = 1;
    finUnOverlayAffiche = false;

    btnNouvellePartie.style.display = "inline-block";
    btnSupprimer.style.display = "none";
    btnJouer.style.display = "none";
    btnAccueilClassique.style.display = "none";

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
        pret: () => !choixPigeonEnCours && !duelEnCours && !predictionEnCours,
        valide: () => !carte.classList.contains("retournee")
      }, ()=>{
        // Plateau bloqué pendant overlays pigeon/couleur/duel
        if(choixPigeonEnCours || duelEnCours) return;
        if(carte.classList.contains("retournee")) return;
        if(joueurs.length === 0) return;

        // La dernière carte du paquet est réservée au pari de fin : la carte dorée doit sortir avant
        if(!estCaseDoree && carteDoreeEnJeu && paquet.length === 1){
          afficherToast("Tire d'abord la carte dorée ✨");
          return;
        }

        const carteTiree = estCaseDoree ? "carte_doree" : paquet.shift();
        if(!carteTiree) return;

        if(estCaseDoree){
          carteDoreeEnJeu = false;
          carte.classList.remove("dos_dore");
        }
        carte.classList.add(carteTiree, "retournee");

        const joueurActuel = indexJoueur % joueurs.length;
        appliquerRegle(carteTiree, joueurActuel, carte);

        // Avant-dernière carte tirée => on lance le pari sur la dernière (après les overlays éventuels)
        if(paquet.length === 1 && !predictionEnCours && !carteDoreeEnJeu){
          const startIdx = nextPlayerIndex(joueurActuel);
          executerApresOverlayRegleUnique(() => {
            // Si un duel/pigeon est en cours, on attend que ça finisse avant d'afficher
            const attendre = () => {
              if(choixPigeonEnCours || duelEnCours){
                requestAnimationFrame(attendre);
                return;
              }
              lancerOverlayPrediction(startIdx);
            };
            attendre();
          });
        }
        // fin du plateau : on affiche les "1 restants"
        if(paquet.length === 0){
          executerApresOverlayRegleUnique(() => {
            afficherOverlayFinUnRestants();
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
    finUnOverlayAffiche = false;


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
    document.body.classList.remove("no-scroll");
    document.body.style.top = "";
  }

  btnJouer.addEventListener("pointerdown", lancerPartie);

  /* ===== ÉCRAN « NOUVELLE PARTIE » (classique et en ligne) ===== */
  const ecranNouvellePartie = document.getElementById("ecranNouvellePartie");

  function fermerEcranNouvellePartie(){
    ecranNouvellePartie.style.display = "none";
  }

  // "click" (et pas pointerdown) : évite que le relâchement du doigt active un bouton du nouvel écran
  btnNouvellePartie.addEventListener("click", () => {
    ecranNouvellePartie.style.display = "";
  });

  document.getElementById("btnRetourNouvellePartie").addEventListener("click", fermerEcranNouvellePartie);

  document.getElementById("btnRejouerMemes").addEventListener("click", () => {
    fermerEcranNouvellePartie();
    if(enLigneActif){
      lancerMancheEnLigne(joueurs.slice(), false);
      return;
    }
    nettoyerOverlays();
    retourMenu();
    lancerPartie();
  });

  document.getElementById("btnModifierJoueurs").addEventListener("click", () => {
    fermerEcranNouvellePartie();
    if(enLigneActif){
      renvoyerEnSalleEnLigne();
      return;
    }
    nettoyerOverlays();
    retourMenu();
  });

  function allerAccueil(){
    if(codePartieActuel) quitterPartie();
    reinitialiserEcransJeu();
    document.getElementById("enLigne").style.display = "none";
    document.getElementById("choixMode").style.display = "";
  }

  document.getElementById("btnAccueil").addEventListener("click", allerAccueil);
  btnAccueilClassique.addEventListener("click", allerAccueil);
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

  /* ===== MODE EN LIGNE : synchronisation des actions ===== */
  // Un élément « de jeu » (carte, bouton d'overlay…) est déclaré via surAction :
  // - en classique, le tap exécute directement le handler ;
  // - en ligne, le tap est envoyé à Firebase, et chaque téléphone exécute le handler
  //   quand l'action lui revient, dans l'ordre des numéros (seq).
  // options : owner (nom ou fonction -> nom autorisé, null = tout le monde),
  //           pret() (l'élément peut recevoir l'action maintenant),
  //           valide() (false => action sans objet, ignorée),
  //           once (un seul usage), evenement ("pointerdown" par défaut)
  function surAction(el, id, options, handler){
    el.dataset.netId = id;
    el._net = Object.assign({ owner: null, pret: null, valide: null, once: false }, options, { handler });

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

    const db = window.firebaseDB;
    const code = codePartieActuel;
    const manche = mancheCourante;

    window.fbRunTransaction(window.fbRef(db, `parties/${code}/manches/${manche}/seq`), n => (n || 0) + 1)
      .then((res) => {
        const seq = res.snapshot.val();
        // Une seule écriture : l'action + la date de dernière activité
        return window.fbUpdate(window.fbRef(db, `parties/${code}`), {
          [`manches/${manche}/actions/${seq}`]: { id: el.dataset.netId, par: pseudoActuel },
          activite: window.fbServerTimestamp()
        });
      })
      .catch(() => {
        delete el.dataset.netEnvoye;
        afficherToast("Connexion perdue, réessaie");
      });
  }

  // "ok" | "attendre" (élément pas encore là / pas prêt) | "ignorer" (action devenue sans objet)
  function tenterAction(action){
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
    el._net.handler();
    return "ok";
  }

  function traiterFile(){
    if(traitementEnCours || !enLigneActif) return;

    const action = fileActions.get(prochainSeq);
    if(!action){
      // Trou dans la numérotation (envoi interrompu) : on le saute au bout de 5 s
      const plusLoin = Array.from(fileActions.keys()).some(k => k > prochainSeq);
      if(plusLoin && !timerTrou){
        const attendu = prochainSeq;
        timerTrou = setTimeout(() => {
          timerTrou = null;
          if(prochainSeq === attendu && !fileActions.has(attendu)){
            prochainSeq++;
            traiterFile();
          }
        }, 5000);
      }
      return;
    }

    traitementEnCours = true;
    const manche = mancheCourante;
    let attente = 0;

    const essayer = () => {
      if(manche !== mancheCourante) return;

      const resultat = tenterAction(action);
      // On attend que l'overlay concerné soit affiché chez nous (max 30 s d'écran allumé)
      if(resultat === "attendre" && attente < 30000){
        if(document.visibilityState === "visible") attente += 120;
        setTimeout(essayer, 120);
        return;
      }

      fileActions.delete(prochainSeq);
      prochainSeq++;
      traitementEnCours = false;
      traiterFile();
    };

    essayer();
  }

  function reinitialiserFileActions(){
    fileActions = new Map();
    prochainSeq = 1;
    traitementEnCours = false;
    if(timerTrou){ clearTimeout(timerTrou); timerTrou = null; }
  }

  function ecouterActions(){
    if(desabonnerActions) desabonnerActions();
    const refActions = window.fbRef(
      window.firebaseDB,
      `parties/${codePartieActuel}/manches/${mancheCourante}/actions`
    );

    desabonnerActions = window.fbOnChildAdded(refActions, (snapshot) => {
      fileActions.set(Number(snapshot.key), snapshot.val());
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

  function demarrerMancheEnLigne(etat){
    enLigneActif = true;
    mancheCourante = etat.manche;
    hotePartie = etat.hote;
    reinitialiserFileActions();

    nettoyerOverlays();
    joueurs = Object.values(etat.joueurs || {});
    annulations = {};
    retourMenu();

    aleatoire = generateurAleatoire(etat.seed);
    lancerPartie();

    document.body.classList.add("mode-en-ligne");
    fermerEcranNouvellePartie();
    fermerConfirmationHote();
    document.getElementById("enLigne").style.display = "none";
    messagesBar.style.display = "";
    document.getElementById("jeu").style.display = "";

    ecouterActions();
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

  /* ===== INIT ===== */
  window.addEventListener("scroll", repositionnerStickyJoueurActif, { passive: true });
  window.addEventListener("resize", repositionnerStickyJoueurActif);

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
});