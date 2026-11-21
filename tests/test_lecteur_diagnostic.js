// Lecteur de diagnostic (onglet Santé de stats.html, js/lecteur-diagnostic.js) : infos principales sans mouchard,
// problèmes expliqués (solutions, points à vérifier) avec mouchard
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { analyserDiagnostic, comparerVersions, decrireAppareil } = require("../js/lecteur-diagnostic.js");

assert.equal(comparerVersions("9.96.3", "9.96.24"), -1);
assert.equal(comparerVersions("9.96.24", "9.96.24"), 0);
assert.match(decrireAppareil("Mozilla/5.0 (Linux; Android 14; SM-A146B Build/UP1A) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 Instagram 350.0").navigateur, /Instagram/);

assert.equal(analyserDiagnostic("bonjour", "9.96.24").valide, false, "texte sans diagnostic refusé");

const tete = (version, ua, erreurs, partie, file, journal) => [
  "Le bouton ne marche plus !!",
  "",
  "=== Diagnostic Alcuno ===",
  `Version ${version} | 21/11/2026 21:04:10`,
  `Téléphone : ${ua}`,
  "Réseau : en ligne | Firebase chargé : true",
  "Écran : appli installée | fenêtre 412×915 | écran 412×915 | thème musique | téléphone en mode sombre",
  `Partie : ${partie}`,
  `File d'actions : ${JSON.stringify(file)}`,
  "--- Journal des actions en ligne ---",
  ...(journal.length ? journal : ["(vide)"]),
  "--- Erreurs récentes ---",
  ...(erreurs.length ? erreurs : ["aucune"])
];
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A146B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.6778.39 Mobile Safari/537.36 Instagram 350.0.0.0";
const fileBloquee = { prochainSeq: 42, seqFinRattrapage: 0, rattrapageEnCours: false, traitementEnCours: true, trouEnAttente: false, actions: [43] };

// ----- Sans mouchard : infos principales seulement
const sans = analyserDiagnostic(tete("9.96.3", UA_ANDROID, ["21:03:59 ReferenceError: majPlateau is not defined (plateau.js ligne 120)"],
  "ABC123 | pseudo : Léa | manche : 3 | partie en mémoire : {\"code\":\"ABC123\",\"pseudo\":\"Léa\"}", fileBloquee, ["41 carte:12 (Léa) => ok", "42 duel:choix (Tom) => attendre"]).join("\n"), "9.96.24");
assert.ok(sans.valide);
assert.equal(sans.messageJoueur, "Le bouton ne marche plus !!");
const info = (r, nom) => (r.infos.find((i) => i.nom === nom) || {}).valeur || "";
assert.match(info(sans, "Version"), /ancienne : la dernière est 9\.96\.24/);
assert.match(info(sans, "Téléphone"), /Android 14 · SM-A146B · navigateur intégré de Instagram/);
assert.match(info(sans, "Partie en ligne"), /ABC123 · pseudo Léa · manche 3/);
assert.match(info(sans, "File d'actions"), /prochaine action n° 42 · 1 action\(s\) en attente/);
assert.equal(info(sans, "Erreurs récentes"), "1");
assert.equal(sans.erreurs[0].explication.titre, "Le jeu appelle un morceau de code absent");
assert.equal(sans.mouchard, null);
assert.equal(sans.problemes.length, 0, "sans mouchard : pas d'analyse du bug, juste les infos");
assert.ok(sans.fin.some((t) => /Pas de mouchard/.test(t)));

// ----- Avec mouchard
const mouchard = [
  "--- Mouchard (actif, 16 lignes) ---",
  "21:03:40.100 --- page chargée · 9.96.3 · appli installée : true · écran 412x915",
  "21:03:41.000 écran ouvert : pageJeu",
  "21:03:42.000 son « bouton » · moteur interrupted · chargé · sons on 80 %",
  "21:03:43.000 touchstart button#btnValider \"Valider\" (200,600) scrollY=0",
  "21:03:43.090 touchend button#btnValider \"Valider\" (200,600) scrollY=0",
  "21:03:44.000 touchstart button#btnValider \"Valider\" (201,601) scrollY=0",
  "21:03:44.080 touchend button#btnValider \"Valider\" (201,601) scrollY=0",
  "21:03:45.000 touchstart div#voileOverlays (10,10) scrollY=0",
  "21:03:45.100 touchstart div#voileOverlays (12,12) scrollY=0",
  "21:03:45.200 touchstart div#voileOverlays (14,14) scrollY=0",
  "21:03:46.000 appli quittée",
  "21:03:50.000 appli reprise",
  "21:03:51.000 ERREUR ReferenceError: majPlateau is not defined (plateau.js ligne 120)",
  "21:03:52.000 toast : Connexion perdue…",
  "21:03:53.000 click button#btnDiagnostic \"Copier le diagnostic\""
];
const avec = analyserDiagnostic(tete("9.96.3", UA_ANDROID, ["21:03:51 ReferenceError: majPlateau is not defined (plateau.js ligne 120)"],
  "ABC123 | pseudo : Léa | manche : 3 | partie en mémoire : null", fileBloquee, ["41 carte:12 (Léa) => ok", "42 duel:choix (Tom) => attendre"]).concat(mouchard).join("\n"), "9.96.24");
const titres = avec.problemes.map((p) => p.titre);
const probleme = (debut) => avec.problemes.find((p) => p.titre.startsWith(debut));
assert.equal(probleme("Le jeu appelle").n, 1, "erreur à la fois dans le mouchard et les erreurs récentes : comptée une fois");
for (const t of ["Le jeu appelle un morceau de code absent", "Sons demandés alors que le moteur de son était coupé", "Taps sur un bouton sans effet",
  "Taps attrapés par un voile ou un overlay", "Partie en ligne : la file d'actions est bloquée", "Problème juste après le retour dans l'appli",
  "Réseau coupé pendant la session", "Jeu ouvert dans le navigateur de Instagram", "Ancienne version du jeu"]) {
  assert.ok(titres.includes(t), `problème attendu : ${t} (trouvés : ${titres.join(" | ")})`);
}
for (const p of avec.problemes) {
  assert.ok(p.explication, `explication : ${p.titre}`);
  assert.ok(Array.isArray(p.solutions) && Array.isArray(p.verifier), `solutions et points à vérifier : ${p.titre}`);
}
assert.ok(avec.problemes.filter((p) => p.gravite === "grave").every((p) => p.solutions.length), "chaque problème grave propose une solution");
assert.equal(probleme("Taps sur un bouton").n, 2);
assert.match(probleme("Partie en ligne : la file").explication, /42 duel:choix \(Tom\)/);
assert.equal(avec.mouchard.dernierEcran, "pageJeu");
assert.equal(avec.mouchard.compte.taps, 5);
assert.equal(avec.problemes[0].gravite, "grave", "problèmes graves en premier");

// ----- Diagnostic coupé (« Signaler un bug » : 3 000 caractères au plus)
const coupe = analyserDiagnostic("=== Diagnostic Alcuno ===\nVersion 9.96.24 | 21/11/2026\nTéléphone : Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)", "9.96.24");
assert.ok(coupe.coupe && coupe.fin.some((t) => /coupé/.test(t)));

// ----- Page : le lecteur est dans l'onglet Santé et charge le fichier
const page = fs.readFileSync(path.join(__dirname, "..", "stats.html"), "utf8");
assert.ok(page.includes('src="js/lecteur-diagnostic.js"'));
for (const id of ["lecteurTexte", "lecteurAnalyser", "lecteurResultat"]) assert.ok(page.includes(`id="${id}"`), `élément ${id}`);
assert.ok(page.indexOf('id="blocLecteur"') > page.indexOf('id="vueSante"') && page.indexOf('id="blocLecteur"') < page.indexOf('id="vuePilotage"'), "lecteur dans l'onglet Santé");

console.log(`Lecteur de diagnostic : infos sans mouchard, ${avec.problemes.length} problèmes expliqués avec mouchard, diagnostic coupé repéré.`);
