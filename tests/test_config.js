// Réglages à distance : vérifie js/config-lib.js sans navigateur (validation, commandes, dates, assistant en français)
// et que le script de la page stats.html (pilotage) est syntaxiquement correct.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const L = require(path.join(__dirname, "..", "js", "config-lib.js"));
let ok = 0;
const verifier = (cond, nom) => { if (!cond) { console.log("ÉCHEC  " + nom); process.exitCode = 1; } else { ok++; console.log("OK    " + nom); } };
const cmds = (phrase) => JSON.stringify(L.interpreter(phrase).cmds);

// validation : on ne garde que le connu et le bien formé
const v = L.valider({ annonce: { texte: "  Salut  ", fin: "x" }, coupures: { voix: true, musique: false, pirate: true }, themes: { kawaii: { actif: false, debut: "12-20", fin: "01-05" }, truc: { actif: false }, givre: { debut: "99-99", fin: "01-01" } }, majMin: "9.64.0", autre: 1 });
verifier(JSON.stringify(v) === JSON.stringify({ annonce: { texte: "Salut" }, coupures: { voix: true }, themes: { kawaii: { actif: false, debut: "12-20", fin: "01-05" } }, majMin: "9.64.0" }), "validation : seul le connu et bien formé est gardé " + JSON.stringify(v));
verifier(JSON.stringify(L.valider("n'importe quoi")) === "{}" && JSON.stringify(L.valider(null)) === "{}" && L.valider({ annonce: { texte: "x".repeat(500) } }).annonce.texte.length === L.TEXTE_MAX, "validation : valeurs étranges et texte trop long");

// dates : une période peut enjamber le nouvel an
const c = L.valider({ themes: { kawaii: { debut: "12-20", fin: "01-05" }, galaxie: { debut: "05-01", fin: "05-04" }, givre: { actif: false } } });
verifier(L.themeDisponible(c, "kawaii", new Date(2026, 11, 25)) && L.themeDisponible(c, "kawaii", new Date(2027, 0, 3)) && !L.themeDisponible(c, "kawaii", new Date(2026, 5, 1)), "période qui enjambe le nouvel an");
verifier(L.themeDisponible(c, "galaxie", new Date(2026, 4, 2)) && !L.themeDisponible(c, "galaxie", new Date(2026, 4, 5)) && !L.themeDisponible(c, "givre", new Date()) && L.themeDisponible(c, "bordeaux", new Date()) && L.themeDisponible({}, "kawaii"), "période simple, thème caché, thème normal");
verifier(L.versionPlusVieille("9.63.0", "9.64.0") && !L.versionPlusVieille("9.64.0", "9.64.0") && !L.versionPlusVieille("10.0.0", "9.99.9") && L.versionPlusVieille("9.9.9", "9.10.0"), "comparaison de versions");
verifier(L.annonceVisible({ annonce: { texte: "a", fin: 100 } }, 50) && !L.annonceVisible({ annonce: { texte: "a", fin: 100 } }, 150) && L.annonceVisible({ annonce: { texte: "a" } }, 1e15) && !L.annonceVisible({}, 0), "annonce : fin de validité");

// commandes
let cfg = {};
for (const m of [{ op: "annonce", texte: "Coucou", dureeMin: 60 }, { op: "coupure", cible: "voix", etat: true }, { op: "theme", id: "kawaii", actif: false }, { op: "majmin", version: "9.70.0" }]) cfg = L.appliquer(cfg, m, 1000).config;
verifier(cfg.annonce.fin === 1000 + 3600000 && cfg.coupures.voix && cfg.themes.kawaii.actif === false && cfg.majMin === "9.70.0", "commandes : annonce, coupure, thème, version");
cfg = L.appliquer(L.appliquer(L.appliquer(cfg, { op: "annonce_off" }, 0).config, { op: "coupure", cible: "voix", etat: false }, 0).config, { op: "theme", id: "kawaii", actif: true }, 0).config;
verifier(!cfg.annonce && !cfg.coupures && !cfg.themes && cfg.majMin === "9.70.0", "commandes : on retire tout, sans laisser de résidu " + JSON.stringify(cfg));
verifier(L.appliquer({}, { op: "coupure", cible: "pirate", etat: true }, 0).erreur && L.appliquer({}, { op: "theme", id: "zzz" }, 0).erreur && L.appliquer({}, { op: "annonce", texte: "  " }, 0).erreur && L.appliquer({}, { op: "majmin", version: "abc" }, 0).erreur && L.appliquer({}, { op: "rm -rf" }, 0).erreur && L.appliquer({}, null, 0).erreur, "commandes : refus de ce qui n'est pas prévu");
verifier(JSON.stringify(L.appliquer({ coupures: { voix: true } }, { op: "tout_remettre" }, 0).config) === "{}", "tout remettre par défaut");
const copie = { coupures: { voix: true } }; L.appliquer(copie, { op: "coupure", cible: "voix", etat: false }, 0);
verifier(copie.coupures.voix === true, "la config d'origine n'est jamais modifiée");

// assistant en français
const attendu = {
  "coupe la voix": [{ op: "coupure", cible: "voix", etat: true }],
  "Réactive la musique": [{ op: "coupure", cible: "musique", etat: false }],
  "ferme le mode en ligne": [{ op: "coupure", cible: "enligne", etat: true }],
  "désactive le thème Kawaii": [{ op: "theme", id: "kawaii", actif: false }],
  "remets le thème Star Wars": [{ op: "theme", id: "galaxie", actif: true }],
  "thème Star Wars du 1er mai au 4 mai": [{ op: "theme", id: "galaxie", debut: "05-01", fin: "05-04" }],
  "thème Kawaii du 20/12 au 05/01": [{ op: "theme", id: "kawaii", debut: "12-20", fin: "01-05" }],
  "Cerisier du 20 décembre au 5 janvier": [{ op: "theme", id: "cerisier", debut: "12-20", fin: "01-05" }],
  "kawaii toute l'année": [{ op: "theme_periode_off", id: "kawaii" }],
  "annonce : Soirée ce soir ! pendant 2 jours": [{ op: "annonce", texte: "Soirée ce soir !", dureeMin: 2880 }],
  "affiche l'annonce «Bonne année !» pendant une semaine": [{ op: "annonce", texte: "Bonne année !", dureeMin: 10080 }],
  "retire l'annonce": [{ op: "annonce_off" }],
  "oblige la mise à jour 9.64.0": [{ op: "majmin", version: "9.64.0" }],
  "supprime la version minimale": [{ op: "majmin", version: null }],
  "remets tout à zéro": [{ op: "tout_remettre" }],
  "coupe la voix et la musique": [{ op: "coupure", cible: "voix", etat: true }, { op: "coupure", cible: "musique", etat: true }],
  "coupe la voix et désactive le thème Kawaii": [{ op: "coupure", cible: "voix", etat: true }, { op: "theme", id: "kawaii", actif: false }],
  "ferme le mode en ligne, puis remets la musique": [{ op: "coupure", cible: "enligne", etat: true }, { op: "coupure", cible: "musique", etat: false }]
};
for (const [phrase, voulu] of Object.entries(attendu)) verifier(cmds(phrase) === JSON.stringify(voulu), `assistant : « ${phrase} » => ${cmds(phrase)}`);
verifier(L.interpreter("bonjour").cmds.length === 0 && L.interpreter("").cmds.length === 0 && L.interpreter("bonjour").raison, "assistant : phrase incomprise => explication");
verifier(L.decrire({}).join() === "rien : le jeu est réglé par défaut" && L.decrire(cfg).length === 1, "description des réglages en cours");

// stats.html : le script de pilotage est syntaxiquement correct
const html = fs.readFileSync(path.join(__dirname, "..", "stats.html"), "utf8");
const scripts = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const tmp = path.join(require("os").tmpdir(), "stats_module_test.mjs");
fs.writeFileSync(tmp, scripts.join("\n"));
const r = require("child_process").spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
verifier(scripts.length === 1 && r.status === 0, "stats.html : script du pilotage sans erreur de syntaxe " + (r.stderr || ""));
// les règles Firebase restent un JSON valide qui protège « config » en écriture
const regles = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "database.rules.json"), "utf8")).rules;
verifier(regles.config[".read"] === true && /auth\.uid/.test(regles.config[".write"]) && /auth\.uid/.test(regles.config_hist[".write"]) && regles.config_hist[".read"] !== true, "règles Firebase : config lisible par tous, écriture réservée au compte administrateur");
console.log(process.exitCode ? "\nÉCHEC(S)" : `\nTOUT EST OK (${ok})`);
