// =============================================================================================
// ALCUNO STATS : lecteur de diagnostic (onglet Santé de stats.html)
// =============================================================================================
// On colle le texte de « Copier le diagnostic » (Réglages › À propos du jeu), ou le message reçu par « Signaler un bug »,
// avec ou sans mouchard (5 taps sur la version). Tout est lu dans la page : rien n'est envoyé nulle part.
//  - sans mouchard : les infos principales (version, téléphone, réseau, écran, partie, erreurs) ;
//  - avec mouchard : en plus, ce qui s'est passé juste avant, les problèmes trouvés, leur explication, quoi faire, quoi vérifier.
// Les explications sont des PISTES déduites du texte (règles écrites à la main), pas des certitudes.
// analyserDiagnostic(texte, versionActuelle) => { valide, message, infos, erreurs, mouchard, problemes, fin }
// #region Lecteur de diagnostic
(function(){
  const nettoyer = (s) => String(s == null ? "" : s).trim();

  // « 9.96.24 » < « 9.96.3 » ? (comparaison nombre par nombre)
  function comparerVersions(a, b){
    const x = String(a).split(".").map((n) => parseInt(n, 10) || 0), y = String(b).split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
    }
    return 0;
  }

  // Téléphone lisible d'après le navigateur (userAgent)
  function decrireAppareil(ua){
    ua = String(ua || "");
    let systeme = "système inconnu", navigateur = "navigateur inconnu", integre = "";
    let m;
    if ((m = ua.match(/iPhone OS (\d+)[_.](\d+)/))) systeme = `iPhone · iOS ${m[1]}.${m[2]}`;
    else if ((m = ua.match(/iPad.*OS (\d+)[_.](\d+)/))) systeme = `iPad · iPadOS ${m[1]}.${m[2]}`;
    else if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) {
      const modele = (ua.match(/Android [^;)]*;\s*([^;)]+?)(?:\s+Build|\))/) || [])[1];
      systeme = `Android ${m[1]}${modele && modele !== "K" ? " · " + modele : ""}`;
    } else if (/Macintosh/.test(ua)) systeme = /Mobile/.test(ua) ? "iPad (se présente comme un Mac)" : "Mac";
    else if (/Windows/.test(ua)) systeme = "Windows";
    else if (/Linux/.test(ua)) systeme = "Linux";
    for (const [motif, nom] of [[/Instagram/, "Instagram"], [/FBAN|FBAV|FB_IAB/, "Facebook"], [/Snapchat/, "Snapchat"], [/musical_ly|TikTok|BytedanceWebview/, "TikTok"], [/Messenger/, "Messenger"], [/LinkedInApp/, "LinkedIn"]]) {
      if (motif.test(ua)) { integre = nom; break; }
    }
    if (integre) navigateur = `navigateur intégré de ${integre}`;
    else if ((m = ua.match(/SamsungBrowser\/(\d+)/))) navigateur = `Samsung Internet ${m[1]}`;
    else if ((m = ua.match(/EdgA?\/(\d+)/))) navigateur = `Edge ${m[1]}`;
    else if ((m = ua.match(/Firefox\/(\d+)|FxiOS\/(\d+)/))) navigateur = `Firefox ${m[1] || m[2]}`;
    else if ((m = ua.match(/CriOS\/(\d+)/))) navigateur = `Chrome ${m[1]} (iPhone)`;
    else if ((m = ua.match(/Chrome\/(\d+)/))) navigateur = `Chrome ${m[1]}${/; wv\)/.test(ua) ? " (vue web d'une appli)" : ""}`;
    else if ((m = ua.match(/Version\/(\d+(?:\.\d+)?).*Safari/))) navigateur = `Safari ${m[1]}`;
    else if (/AppleWebKit/.test(ua) && /iPhone|iPad/.test(ua)) navigateur = "Safari (appli installée ou vue web)";
    return { systeme, navigateur, integre, iphone: /iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua)), android: /Android/.test(ua) };
  }

  // Erreur => ce qu'elle veut sans doute dire, quoi faire, quoi vérifier
  function expliquerErreur(message){
    const m = String(message);
    if (/permission[_ ]denied/i.test(m)) return {
      titre: "Firebase refuse une lecture ou une écriture (PERMISSION_DENIED)",
      explication: "Les règles de la base Firebase n'autorisent pas ce que le jeu essaie de faire. Le plus souvent : de nouvelles règles (database.rules.json) pas encore publiées dans la console Firebase, ou un joueur pas connecté là où c'est demandé.",
      solutions: ["Publier le contenu de database.rules.json dans la console Firebase (Realtime Database › Règles) du bon projet (alcuno ou alcuno-test).", "Si c'est le compte Google : se déconnecter puis se reconnecter dans Réglages."],
      verifier: ["Le chemin cité dans l'erreur (profils/…, parties/…, config…) existe bien dans les règles publiées.", "Le projet Firebase de l'appli (vrai jeu ou appli test) est celui où les règles ont été publiées."]
    };
    if (/auth\/unauthorized-domain/i.test(m)) return {
      titre: "Connexion Google refusée : adresse du site non autorisée",
      explication: "Firebase n'accepte la connexion Google que depuis les adresses listées dans Authentication › Paramètres › Domaines autorisés.",
      solutions: ["Ajouter l'adresse du site (ex. tristan-escardo.github.io) dans les domaines autorisés de Firebase Authentication."],
      verifier: ["Le joueur ouvre bien le jeu depuis l'adresse officielle, pas depuis une copie ou un raccourcisseur de lien."]
    };
    if (/auth\/popup-blocked|auth\/popup-closed|auth\/cancelled-popup/i.test(m)) return {
      titre: "Fenêtre de connexion Google bloquée ou fermée",
      explication: "La fenêtre Google a été bloquée par le navigateur ou fermée avant la fin. « popup-closed-by-user » veut juste dire que le joueur l'a fermée lui-même.",
      solutions: ["Réessayer en touchant directement le bouton (pas de bloqueur de fenêtres).", "Dans un navigateur intégré (Instagram, Snapchat…), ouvrir le jeu dans Safari ou Chrome."],
      verifier: ["Le navigateur du joueur (ligne Téléphone) n'est pas un navigateur intégré."]
    };
    if (/auth\/network-request-failed/i.test(m)) return {
      titre: "Connexion Google impossible : réseau",
      explication: "Le téléphone n'a pas pu joindre les serveurs de Google pendant la connexion.",
      solutions: ["Réessayer avec une meilleure connexion (wifi ou 4G)."],
      verifier: ["Pas de VPN ou de bloqueur de publicités qui filtre les adresses Google / Firebase."]
    };
    if (/auth\//i.test(m)) return {
      titre: "Erreur de connexion Google (" + ((m.match(/auth\/[\w-]+/) || [""])[0]) + ")",
      explication: "Firebase Authentication a refusé la connexion. Le code après « auth/ » donne la raison exacte (voir la documentation Firebase Authentication).",
      solutions: ["Réessayer la connexion ; si ça se répète, chercher ce code dans la documentation Firebase."],
      verifier: ["La connexion Google est toujours activée dans Firebase Authentication › Méthodes de connexion."]
    };
    if (/dynamically imported module|Importing a module script failed|Loading chunk|Script error/i.test(m)) return {
      titre: "Fichier du jeu mal chargé",
      explication: "Un fichier du jeu n'est pas arrivé (réseau coupé, ou mise à jour pendant le chargement). « Script error » seul ne dit pas d'où ça vient : le navigateur cache le détail.",
      solutions: ["Recharger le jeu ; si ça revient, fermer complètement l'appli et la rouvrir."],
      verifier: ["La version du diagnostic est la dernière (sinon, ancienne version gardée en cache)."]
    };
    if (/is not defined|is not a function|Can't find variable/i.test(m)) return {
      titre: "Le jeu appelle un morceau de code absent",
      explication: "Cause la plus fréquente : la page et les fichiers viennent de deux versions différentes (mise à jour en cours, cache). Si ça arrive sur la dernière version après rechargement, c'est un vrai bug : le nom et le fichier sont dans le message.",
      solutions: ["Recharger le jeu (il se recharge parfois tout seul).", "Si l'erreur revient sur la dernière version : chercher le nom cité dans le fichier et la ligne indiqués."],
      verifier: ["Version du diagnostic = version actuelle du jeu.", "Ordre de chargement des fichiers dans index.html (un fichier qui utilise une fonction d'un fichier chargé après lui)."]
    };
    if (/null is not an object|undefined is not an object|Cannot read propert|Cannot set propert|of null|of undefined/i.test(m)) return {
      titre: "Le jeu cherche un élément ou une donnée qui n'existe pas",
      explication: "Un bouton, un bloc de l'écran ou une donnée de partie manque au moment où le jeu s'en sert. Souvent un écran fermé trop tôt, une partie en ligne pas encore reçue, ou une page pas à jour.",
      solutions: ["Recharger le jeu ; si ça se reproduit au même geste, c'est un vrai bug à corriger au fichier et à la ligne indiqués."],
      verifier: ["Ce que le joueur venait de faire (dernières lignes du mouchard).", "La version : un élément renommé entre deux versions donne cette erreur sur une page en cache."]
    };
    if (/QuotaExceeded|quota|SecurityError.*(localStorage|storage)|The operation is insecure/i.test(m)) return {
      titre: "Le téléphone refuse d'enregistrer",
      explication: "Mémoire du navigateur pleine, navigation privée, ou stockage bloqué par les réglages du téléphone. Les réglages et la partie en cours peuvent ne pas être gardés.",
      solutions: ["Quitter la navigation privée, ou libérer de la place sur le téléphone."],
      verifier: ["Le joueur n'est pas en navigation privée ni dans un navigateur intégré."]
    };
    if (/NotAllowedError/i.test(m) && /play|audio|son/i.test(m)) return {
      titre: "Son bloqué par le navigateur",
      explication: "Les navigateurs ne laissent jouer un son qu'après un geste du joueur. Un son lancé sans tap juste avant est refusé.",
      solutions: ["Toucher l'écran une fois : les sons suivants passent normalement."],
      verifier: ["Le son refusé était lancé sans tap (musique au démarrage, son au retour dans l'appli…)."]
    };
    if (/copie du diagnostic refusée|clipboard|presse-papiers/i.test(m)) return {
      titre: "Copie refusée par le téléphone",
      explication: "Le navigateur a bloqué l'accès au presse-papiers (permission, navigateur intégré…). Sans gravité pour le jeu.",
      solutions: ["Utiliser « Signaler un bug » à la place : le diagnostic part avec."],
      verifier: []
    };
    if (/Failed to fetch|NetworkError|Load failed|network|timeout|délai|hors connexion/i.test(m)) return {
      titre: "Connexion coupée ou trop lente",
      explication: "Une demande au réseau n'a pas abouti. Pas un bug du jeu en soi, mais une partie en ligne peut se décaler.",
      solutions: ["Vérifier la connexion du téléphone, puis recharger ; en ligne, « Revenir » avec le code de la partie."],
      verifier: ["La ligne Réseau (en ligne / hors connexion) et « Firebase chargé »."]
    };
    if (/FIREBASE WARNING/i.test(m)) return {
      titre: "Avertissement Firebase",
      explication: "Firebase signale quelque chose sans planter (souvent : écriture refusée, données mal formées ou connexion lente). Le détail est dans le message.",
      solutions: ["Lire la fin du message : s'il parle de permission, voir les règles Firebase."],
      verifier: []
    };
    return null;
  }

  // « 12:34:56 message » ou « 12:34:56.789 message » => [heure, message]
  function couperHeure(ligne){
    const m = String(ligne).match(/^(\d{1,2}:\d{2}:\d{2}(?:\.\d{1,3})?)\s+(.*)$/);
    return m ? [m[1], m[2]] : ["", String(ligne)];
  }
  // heure « 12:34:56.789 » => millisecondes depuis minuit (pour mesurer les écarts)
  function enMs(heure){
    const m = String(heure).match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
    return m ? ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 + (m[4] ? +m[4].padEnd(3, "0") : 0) : null;
  }

  function analyserDiagnostic(texteBrut, versionActuelle){
    const texte = String(texteBrut || "").replace(/\r\n?/g, "\n");
    const debut = texte.indexOf("=== Diagnostic Alcuno ===");
    if (debut < 0) {
      return { valide: false, message: "Ce texte ne contient pas « === Diagnostic Alcuno === ». Colle tout le texte copié par « Copier le diagnostic » (Réglages › À propos du jeu), ou le message reçu par « Signaler un bug »." };
    }
    const messageJoueur = nettoyer(texte.slice(0, debut));
    const lignes = texte.slice(debut).split("\n");
    const sections = { tete: [], journal: [], erreurs: [], mouchard: [] };
    let section = "tete", enteteMouchard = "";
    for (const brute of lignes) {
      const l = brute.replace(/\s+$/, "");
      if (/^--- Journal des actions en ligne ---/.test(l)) { section = "journal"; continue; }
      if (/^--- Erreurs récentes ---/.test(l)) { section = "erreurs"; continue; }
      if (/^--- Mouchard \(/.test(l)) { section = "mouchard"; enteteMouchard = l; continue; }
      if (section === "tete" && /^=== Diagnostic Alcuno ===/.test(l)) continue;
      if (!l.trim()) continue;
      sections[section].push(l);
    }
    const tete = sections.tete.join("\n");
    const champ = (re) => { const m = tete.match(re); return m ? nettoyer(m[1]) : ""; };

    // ----- Infos principales -----
    const version = champ(/^Version ([\d.]+)/m);
    const date = champ(/^Version [\d.]+ \| (.+)$/m);
    const ua = champ(/^Téléphone : (.+)$/m);
    const appareil = decrireAppareil(ua);
    const reseau = champ(/^Réseau : ([^|]+)/m);
    const firebase = champ(/Firebase chargé : (\w+)/);
    const ecran = champ(/^Écran : (.+)$/m);
    const morceauEcran = (nom) => { const m = ecran.match(new RegExp("(?:^|\\| )" + nom + " ([^|]+)")); return m ? nettoyer(m[1]) : ""; };
    const installe = /^appli installée/.test(ecran) ? "appli installée" : /^navigateur/.test(ecran) ? "dans le navigateur" : "";
    const theme = morceauEcran("thème");
    const fenetre = morceauEcran("fenêtre");
    const modeTel = morceauEcran("téléphone en mode");
    const partie = champ(/^Partie : ([^|]+)/m);
    const pseudo = champ(/\| pseudo : ([^|]+)/);
    const manche = champ(/\| manche : ([^|]+)/);
    let partieMemoire = null;
    { const m = tete.match(/partie en mémoire : (.+)$/m); if (m) { try { partieMemoire = JSON.parse(m[1]); } catch (e) { partieMemoire = undefined; } } }
    let file = null;
    { const m = tete.match(/^File d'actions : (.+)$/m); if (m) { try { file = JSON.parse(m[1]); } catch (e) { file = undefined; } } }

    const infos = [];
    const ajouter = (nom, valeur, niveau) => { if (valeur) infos.push({ nom, valeur, niveau: niveau || "" }); };
    let etatVersion = "";
    if (version && versionActuelle) {
      const c = comparerVersions(version, versionActuelle);
      etatVersion = c < 0 ? ` (ancienne : la dernière est ${versionActuelle})` : c > 0 ? ` (plus récente que ${versionActuelle} : appli test ?)` : " (la dernière)";
    }
    ajouter("Version", version + etatVersion, etatVersion.startsWith(" (ancienne") ? "att" : "");
    ajouter("Copié le", date);
    ajouter("Téléphone", `${appareil.systeme} · ${appareil.navigateur}`, appareil.integre ? "att" : "");
    ajouter("Ouvert", installe);
    const horsLigne = /hors connexion/.test(reseau);
    ajouter("Réseau", reseau ? `${reseau}${firebase ? " · Firebase " + (firebase === "true" ? "chargé" : "pas chargé") : ""}` : "", horsLigne || firebase === "false" ? "att" : "");
    ajouter("Écran", [fenetre && "fenêtre " + fenetre, theme && "thème " + theme, modeTel && "mode " + modeTel].filter(Boolean).join(" · "));
    const enPartie = partie && partie !== "aucune";
    ajouter("Partie en ligne", enPartie ? `${partie}${pseudo && pseudo !== "-" ? " · pseudo " + pseudo : ""}${manche && manche !== "-" ? " · manche " + manche : ""}` : "aucune");
    if (partieMemoire && typeof partieMemoire === "object") ajouter("Gardée en mémoire", `partie ${partieMemoire.code || "?"}${partieMemoire.pseudo ? " · " + partieMemoire.pseudo : ""}`);
    if (file && typeof file === "object" && (enPartie || file.rattrapageEnCours || (file.actions || []).length)) {
      const morceaux = [`prochaine action n° ${file.prochainSeq}`];
      if (file.rattrapageEnCours) morceaux.push("rattrapage en cours");
      if (file.trouEnAttente) morceaux.push("action manquante attendue");
      if ((file.actions || []).length) morceaux.push(`${file.actions.length} action(s) en attente`);
      ajouter("File d'actions", morceaux.join(" · "), file.rattrapageEnCours || file.trouEnAttente || (file.actions || []).length ? "att" : "");
    }
    const erreurs = sections.erreurs.filter((l) => !/^aucune$/.test(l.trim()));
    ajouter("Erreurs récentes", erreurs.length ? `${erreurs.length}` : "aucune", erreurs.length ? "grave" : "ok");

    // Erreurs : message + explication (pistes)
    const erreursLues = erreurs.map((l) => { const [heure, msg] = couperHeure(l); return { heure, message: msg, explication: expliquerErreur(msg) }; });

    // Coupé ? (« Signaler un bug » coupe le diagnostic à 3 000 caractères dans la notification)
    const coupe = !sections.erreurs.length && !/^--- Erreurs récentes ---/m.test(texte);

    const resultat = {
      valide: true, messageJoueur, version, appareil, infos, erreurs: erreursLues, coupe,
      mouchard: null, problemes: [], fin: []
    };
    if (coupe) resultat.fin.push("Diagnostic coupé avant la fin (message de « Signaler un bug » limité en taille) : s'il y avait un mouchard, le texte complet est dans le fichier mouchard.txt joint à la notification.");

    // ===== Sans mouchard : on s'arrête aux infos principales =====
    if (!enteteMouchard) {
      resultat.fin.push("Pas de mouchard dans ce diagnostic : juste les infos principales. Pour comprendre un bug : 5 taps rapides sur « Alcuno — version … » (Réglages, tout en bas), refaire le bug, puis « Copier le diagnostic » et le coller ici.");
      return resultat;
    }

    // ===== Avec mouchard =====
    const actif = /\(actif/.test(enteteMouchard);
    const lignesM = sections.mouchard.map((l) => { const [heure, msg] = couperHeure(l); return { heure, ms: enMs(heure), msg }; });
    const problemes = resultat.problemes;
    const ajouterProbleme = (p) => problemes.push(p);
    const compter = (re) => lignesM.filter((l) => re.test(l.msg)).length;

    // --- Erreurs du jeu (journal du mouchard + erreurs récentes), regroupées par explication
    const vues = new Map();
    // (une erreur notée pendant que le mouchard tourne est dans les deux listes : comptée une fois)
    const erreursM = lignesM.filter((l) => /^ERREUR /.test(l.msg)).map((l) => ({ heure: l.heure, message: l.msg.slice(7) }));
    const toutesErreurs = erreursM.concat(erreursLues.filter((e) => !erreursM.some((x) => x.message === e.message.slice(0, 200))));
    for (const e of toutesErreurs) {
      const ex = e.explication || expliquerErreur(e.message);
      if (!ex) continue;
      const deja = vues.get(ex.titre);
      if (deja) { deja.n++; if (!deja.exemples.includes(e.message) && deja.exemples.length < 3) deja.exemples.push(e.message); }
      else vues.set(ex.titre, { ...ex, n: 1, exemples: [e.message], gravite: /Copie refusée|Son bloqué|Avertissement/.test(ex.titre) ? "info" : "grave" });
    }
    const inexpliquees = toutesErreurs.filter((e) => !(e.explication || expliquerErreur(e.message)));
    for (const p of vues.values()) ajouterProbleme(p);
    if (inexpliquees.length) {
      const exemples = [...new Set(inexpliquees.map((e) => e.message))].slice(0, 3);
      ajouterProbleme({
        gravite: "grave", n: inexpliquees.length, exemples,
        titre: "Erreur du jeu sans cause connue",
        explication: "Ce message ne correspond à aucun cas connu : il faut le lire. Le fichier et la ligne (entre parenthèses) disent où chercher.",
        solutions: ["Ouvrir le fichier indiqué à la ligne indiquée, dans la version du diagnostic.", "Refaire les mêmes gestes (dernières lignes du mouchard) pour reproduire."],
        verifier: ["L'erreur arrive-t-elle aussi sur la dernière version ?", "Est-elle dans l'onglet Santé (plantages des autres joueurs) ?"]
      });
    }

    // --- Rechargements en boucle
    const chargements = lignesM.filter((l) => /^--- page chargée/.test(l.msg));
    if (chargements.length >= 3) {
      const ecartMin = chargements.slice(1).reduce((min, l, i) => {
        const a = chargements[i].ms, b = l.ms;
        return a !== null && b !== null && b >= a ? Math.min(min, b - a) : min;
      }, Infinity);
      if (ecartMin < 15000) ajouterProbleme({
        gravite: "grave", n: chargements.length,
        titre: "La page se recharge plusieurs fois de suite",
        explication: `${chargements.length} chargements de page dans le journal, dont deux à ${Math.round(ecartMin / 1000)} s d'écart. Le jeu se recharge tout seul après certaines erreurs, ou à une mise à jour : si ça s'enchaîne, il tourne en boucle.`,
        solutions: ["Fermer complètement l'appli, attendre la fin de la mise à jour, rouvrir.", "Si ça continue : regarder l'erreur notée juste avant chaque « page chargée »."],
        verifier: ["Lignes « rechargement de la page » et « ERREUR » juste avant chaque chargement.", "La version change-t-elle d'un chargement à l'autre (mise à jour) ?"]
      });
    }

    // --- Son
    const sonsMoteurCoupe = lignesM.filter((l) => /^son « .* · moteur (suspended|interrupted|closed)/.test(l.msg));
    const sonsAbsents = lignesM.filter((l) => /^son « .*fichier absent/.test(l.msg));
    const sonsOff = compter(/^son « .* sons off/);
    const sonsTotal = compter(/^son « /);
    if (sonsMoteurCoupe.length) {
      const etats = [...new Set(sonsMoteurCoupe.map((l) => (l.msg.match(/moteur (\w+)/) || [])[1]))].join(", ");
      ajouterProbleme({
        gravite: "grave", n: sonsMoteurCoupe.length,
        titre: "Sons demandés alors que le moteur de son était coupé",
        explication: `${sonsMoteurCoupe.length} son(s) demandé(s) avec le moteur de son « ${etats} ». « suspended » : le navigateur l'a mis en pause (pas encore de tap, appli remise au premier plan) ; « interrupted » (iPhone) : un appel, une autre appli ou Siri a pris le son. Ces sons ne s'entendent pas.`,
        solutions: ["Toucher l'écran une fois : le jeu relance le moteur au tap suivant.", "Si le son ne revient jamais : fermer et rouvrir l'appli."],
        verifier: ["Lignes « moteur de son : … -> … » : à quel moment il se coupe (appli quittée, appel…).", appareil.iphone ? "iPhone : le bouton silencieux et le volume du téléphone (à vérifier, l'effet dépend de la version d'iOS)." : "Volume média du téléphone."]
      });
    }
    if (sonsAbsents.length) {
      const noms = [...new Set(sonsAbsents.map((l) => (l.msg.match(/^son « ([^»]+) »/) || [])[1]))].join(", ");
      ajouterProbleme({
        gravite: "grave", n: sonsAbsents.length,
        titre: "Fichier son introuvable",
        explication: `Le jeu n'a pas trouvé le fichier du son : ${noms}. Soit il n'est pas dans le dossier Sons, soit il n'a pas pu être téléchargé (hors connexion sans copie en cache).`,
        solutions: ["Vérifier que le fichier existe dans Sons/ avec exactement ce nom.", "Recharger le jeu avec du réseau pour qu'il soit mis en cache."],
        verifier: ["Le nom du son dans le code (DUREE_MAX_SONS, SONS_CLIC_THEME…) et le nom du fichier.", "La liste des fichiers gardés hors connexion dans sw.js."]
      });
    }
    if (sonsTotal && sonsOff === sonsTotal) ajouterProbleme({
      gravite: "info", n: sonsOff,
      titre: "Sons coupés dans les réglages",
      explication: "Tous les sons demandés l'ont été avec le réglage Sons sur « off » : c'est normal qu'on n'entende rien.",
      solutions: ["Réactiver les sons dans Réglages › Son."], verifier: []
    });
    else if (lignesM.some((l) => /^son « .* sons on 0 %/.test(l.msg))) ajouterProbleme({
      gravite: "info", n: 1,
      titre: "Volume des sons du jeu à 0 %",
      explication: "Les sons sont activés mais le volume du jeu est à zéro.",
      solutions: ["Monter le volume des sons dans Réglages › Son."], verifier: []
    });

    // --- Taps qui ne donnent rien (doigt levé sans « click » derrière)
    const tapsPerdus = [];
    for (let i = 0; i < lignesM.length; i++) {
      const l = lignesM[i];
      const m = l.msg.match(/^touchend (button[^(]*?)\s*\(/);
      if (!m || l.ms === null) continue;
      let clic = false;
      for (let j = i + 1; j < lignesM.length; j++) {
        const s = lignesM[j];
        if (s.ms !== null && s.ms - l.ms > 800) break;
        if (/^click /.test(s.msg)) { clic = true; break; }
        if (/^touchstart /.test(s.msg)) break;
      }
      if (!clic) tapsPerdus.push(m[1].trim());
    }
    if (tapsPerdus.length >= 2) {
      const boutons = [...new Set(tapsPerdus)].slice(0, 4).join(", ");
      ajouterProbleme({
        gravite: "grave", n: tapsPerdus.length,
        titre: "Taps sur un bouton sans effet",
        explication: `${tapsPerdus.length} fois, le doigt s'est levé sur un bouton sans que le navigateur envoie de « click » : ${boutons}. Causes possibles : le doigt a un peu glissé (pris pour un défilement), un « pointercancel », ou le bouton bougeait sous le doigt.`,
        solutions: ["Réagir au « pointerup » plutôt qu'au « click » pour ce bouton (comme la ligne de version).", "Agrandir la zone du bouton ou l'empêcher de bouger pendant l'appui."],
        verifier: ["Lignes « pointercancel » et « défilement : début » juste après le touchstart.", "Le bouton est-il dans une zone qui défile ?"]
      });
    }
    // --- Tap reçu par autre chose que ce qu'on voit (voile, overlay invisible)
    const voiles = lignesM.filter((l) => /^touchstart div#voile|^touchstart div[#.][^ ]*(voile|overlay|fond)/i.test(l.msg));
    if (voiles.length >= 3) ajouterProbleme({
      gravite: "att", n: voiles.length,
      titre: "Taps attrapés par un voile ou un overlay",
      explication: `${voiles.length} taps ont touché un voile / overlay (${[...new Set(voiles.map((l) => l.msg.split(" ")[1]))].slice(0, 3).join(", ")}). Si le joueur dit « ça ne répond plus », un voile est peut-être resté devant l'écran sans se voir.`,
      solutions: ["Chercher pourquoi ce voile reste affiché (écran fermé sans le retirer)."],
      verifier: ["Lignes « écran ouvert / fermé » et « overlay : défilement bloqué / débloqué » autour de ces taps."]
    });

    // --- Défilement resté bloqué
    let niveau = 0;
    for (const l of lignesM) {
      const m = l.msg.match(/^overlay : défilement bloqué .*niveau (\d+)/);
      if (m) niveau = +m[1];
      const d = l.msg.match(/^overlay : défilement débloqué \(niveau (\d+)\)/);
      if (d) niveau = Math.max(0, +d[1] - 1);
      if (/^--- page chargée/.test(l.msg)) niveau = 0;
    }
    if (niveau >= 2) ajouterProbleme({
      gravite: "att", n: niveau,
      titre: "Défilement bloqué par plusieurs overlays à la fois",
      explication: `À la fin du journal, ${niveau} overlays bloquent encore le défilement. Si un seul est visible à l'écran, un autre n'a pas été refermé proprement : la page ne défile plus.`,
      solutions: ["Trouver l'overlay ouvert sans « débloqué » derrière, et vérifier qu'il appelle unlockScroll en se fermant."],
      verifier: ["Lignes « overlay : défilement bloqué » sans « débloqué » correspondant."]
    });

    // --- Partie en ligne : file d'actions bloquée, actions perdues, coupures
    const attentes = sections.journal.filter((l) => /=> attendre$/.test(l));
    const derniereLigneJournal = sections.journal[sections.journal.length - 1] || "";
    if (file && typeof file === "object" && (file.rattrapageEnCours || file.trouEnAttente || /=> attendre$/.test(derniereLigneJournal))) {
      ajouterProbleme({
        gravite: "grave", n: 1,
        titre: "Partie en ligne : la file d'actions est bloquée",
        explication: [
          file.rattrapageEnCours ? "le téléphone était encore en train de rejouer la partie (rattrapage)" : "",
          file.trouEnAttente ? "il attendait une action manquante" : "",
          /=> attendre$/.test(derniereLigneJournal) ? `la dernière action (${derniereLigneJournal.replace(/ => attendre$/, "")}) attendait un écran qui n'est pas venu` : ""
        ].filter(Boolean).join(" ; ").replace(/^./, (c) => c.toUpperCase()) + ". Ce téléphone est alors décalé par rapport aux autres.",
        solutions: ["Quitter la partie (⌂) puis « Revenir » avec le code : la manche est relue depuis le serveur.", "Vérifier le réseau de ce téléphone."],
        verifier: ["Dernières lignes du « Journal des actions en ligne ».", "Les autres joueurs voient-ils la même chose ? (même manche, même tour)"]
      });
    }
    const trous = sections.journal.filter((l) => /^trou \d+ sauté/.test(l));
    if (trous.length) ajouterProbleme({
      gravite: "att", n: trous.length,
      titre: "Partie en ligne : actions sautées",
      explication: `${trous.length} action(s) jamais arrivée(s) ont été sautées. Un joueur a peut-être perdu le réseau en pleine action.`,
      solutions: ["Si les téléphones ne montrent plus la même chose : « Revenir » avec le code sur le téléphone décalé."],
      verifier: ["Coupures de réseau d'un des joueurs à ce moment-là."]
    });
    const lecturesRatees = sections.journal.filter((l) => /lecture de la manche ratée/.test(l));
    if (lecturesRatees.length) ajouterProbleme({
      gravite: "grave", n: lecturesRatees.length,
      titre: "Partie en ligne : manche impossible à relire",
      explication: "Le téléphone n'a pas réussi à relire la manche sur le serveur : " + lecturesRatees[lecturesRatees.length - 1].replace(/^.*: /, "") + ".",
      solutions: ["Vérifier le réseau ; si le message parle de permission, voir les règles Firebase."],
      verifier: ["Le message d'erreur exact au bout de la ligne."]
    });
    if (attentes.length >= 5) ajouterProbleme({
      gravite: "info", n: attentes.length,
      titre: "Partie en ligne : beaucoup d'attentes",
      explication: `${attentes.length} actions ont dû attendre qu'un écran s'affiche avant d'être jouées. Normal si un écran met du temps à s'ouvrir, suspect s'il y en a beaucoup.`,
      solutions: [], verifier: ["Quel écran est attendu (nom de l'action) et s'il s'ouvre bien."]
    });

    // --- Appli quittée / reprise, coupure de réseau
    const quittees = compter(/^appli quittée/);
    const reprises = lignesM.filter((l) => /^appli reprise/.test(l.msg));
    if (quittees && reprises.length) {
      // bug juste après une reprise ? (erreur ou moteur coupé dans les 5 s)
      const apresReprise = reprises.some((r) => lignesM.some((l) => r.ms !== null && l.ms !== null && l.ms >= r.ms && l.ms - r.ms < 5000 && /^ERREUR |moteur (suspended|interrupted)/.test(l.msg)));
      if (apresReprise) ajouterProbleme({
        gravite: "att", n: reprises.length,
        titre: "Problème juste après le retour dans l'appli",
        explication: "Une erreur ou un son coupé arrive dans les 5 s qui suivent un retour dans l'appli. Le téléphone a pu mettre le jeu en veille (réseau, son, minuteurs arrêtés).",
        solutions: ["Toucher l'écran une fois au retour ; en ligne, attendre la reconnexion ou « Revenir » avec le code."],
        verifier: ["Ce que le jeu fait au retour (visibilitychange, pageshow) pour ce cas."]
      });
    }
    if (lignesM.some((l) => /^toast : .*(connexion|réseau|hors ligne)/i.test(l.msg)) || horsLigne) ajouterProbleme({
      gravite: "att", n: 1,
      titre: "Réseau coupé pendant la session",
      explication: horsLigne ? "Le téléphone était hors connexion au moment du diagnostic." : "Le jeu a affiché un message de connexion pendant la session.",
      solutions: ["Rejouer avec du réseau ; en ligne, « Revenir » avec le code de la partie."],
      verifier: ["Messages (toasts) du jeu listés dans le parcours."]
    });

    // --- Navigateur intégré
    if (appareil.integre) ajouterProbleme({
      gravite: "att", n: 1,
      titre: `Jeu ouvert dans le navigateur de ${appareil.integre}`,
      explication: "Les navigateurs intégrés aux réseaux sociaux limitent souvent les sons, la copie, la connexion Google et l'installation de l'appli. Beaucoup de bugs disparaissent dans le vrai navigateur.",
      solutions: ["Ouvrir le lien dans Safari ou Chrome (menu ⋯ › Ouvrir dans le navigateur)."],
      verifier: ["Le bug existe-t-il aussi dans Safari / Chrome ?"]
    });

    // --- Version ancienne
    if (version && versionActuelle && comparerVersions(version, versionActuelle) < 0) ajouterProbleme({
      gravite: "att", n: 1,
      titre: "Ancienne version du jeu",
      explication: `Le diagnostic vient de la version ${version}, la dernière est ${versionActuelle}. Le bug est peut-être déjà corrigé.`,
      solutions: ["Faire recharger le jeu (fermer complètement l'appli et la rouvrir), puis refaire le test."],
      verifier: ["Pilotage › Mise à jour demandée, pour forcer les anciennes versions à se recharger."]
    });

    // ----- Parcours : écrans, messages, cartes, dans l'ordre (les 25 derniers)
    const parcours = lignesM.filter((l) => /^(écran ouvert|écran fermé|toast|notification|carte tirée|partie lancée|rechargement|--- page chargée|appli quittée|appli reprise|popstate|ERREUR|moteur de son|=== mouchard)/.test(l.msg));
    const dernierEcran = [...lignesM].reverse().find((l) => /^écran ouvert/.test(l.msg));
    const dernierGeste = [...lignesM].reverse().find((l) => /^click /.test(l.msg));
    resultat.mouchard = {
      actif, nombre: lignesM.length, plein: lignesM.length >= 400,
      debut: (lignesM[0] || {}).heure || "", finHeure: (lignesM[lignesM.length - 1] || {}).heure || "",
      parcours: parcours.slice(-25).map((l) => ({ heure: l.heure, texte: l.msg })),
      dernieres: lignesM.slice(-15).map((l) => ({ heure: l.heure, texte: l.msg })),
      dernierEcran: dernierEcran ? dernierEcran.msg.replace(/^écran ouvert : /, "") : "",
      dernierGeste: dernierGeste ? dernierGeste.msg.replace(/^click /, "") : "",
      compte: { taps: compter(/^touchstart /), clics: compter(/^click /), sons: sonsTotal, ecrans: compter(/^écran ouvert/), defilements: compter(/^défilement : début/) }
    };
    if (!actif) resultat.fin.push("Le mouchard était déjà coupé : ce journal est celui d'avant (il peut dater).");
    if (resultat.mouchard.plein) resultat.fin.push("Journal du mouchard plein (400 lignes) : le début de la session est perdu. Pour un bug long à reproduire, réactiver le mouchard juste avant.");
    if (!problemes.length) resultat.fin.push("Aucun problème connu trouvé dans le journal. Lire le parcours et les dernières lignes : le bug est sans doute juste avant la copie du diagnostic.");
    const ordre = { grave: 0, att: 1, info: 2 };
    problemes.sort((a, b) => ordre[a.gravite] - ordre[b.gravite]);
    return resultat;
  }

  const api = { analyserDiagnostic, decrireAppareil, expliquerErreur, comparerVersions };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.LecteurDiagnostic = api;
})();
// #endregion
