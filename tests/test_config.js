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

// annonces programmées, version visée, valeurs de départ, date de la modification
const A = (a) => L.valider({ annonce: Object.assign({ texte: "x" }, a) });
verifier(!L.annonceVisible(A({ debut: 2000 }), 1000, "9.65.0") && L.annonceVisible(A({ debut: 2000 }), 2500, "9.65.0") && !L.annonceVisible(A({ debut: 2000, fin: 3000 }), 3500, "9.65.0"), "annonce programmée : pas avant le début, plus après la fin");
verifier(L.annonceVisible(A({ avantVersion: "9.66.0" }), 1, "9.65.0") && !L.annonceVisible(A({ avantVersion: "9.65.0" }), 1, "9.65.0") && !L.annonceVisible(A({ avantVersion: "9.65.0" }), 1, "9.70.1") && L.annonceVisible(A({}), 1, "1.0.0"), "annonce visée : seulement les versions plus anciennes");
const d = L.valider({ defauts: { volumeMusique: 47, vitesseVoix: 1.34 }, v: 123 });
verifier(d.defauts.volumeMusique === 45 && d.defauts.vitesseVoix === 1.3 && d.v === 123 && !L.valider({ defauts: { volumeMusique: 150, vitesseVoix: 9 } }).defauts && !("v" in L.valider({ v: "x" })), "valeurs de départ arrondies, refusées hors limites ; date de modification");
let cd = L.appliquer({}, { op: "defaut", cible: "volumeMusique", valeur: 50 }, 0);
cd = L.appliquer(cd.config, { op: "defaut", cible: "vitesseVoix", valeur: 1.2 }, 0);
verifier(cd.config.defauts.volumeMusique === 50 && cd.config.defauts.vitesseVoix === 1.2 && !L.appliquer({}, { op: "defaut", cible: "volumeMusique", valeur: 101 }, 0).config && !L.appliquer({}, { op: "defaut", cible: "x", valeur: 1 }, 0).config, "commande « valeur de départ »");
verifier(!L.appliquer(cd.config, { op: "defaut", cible: "volumeMusique", valeur: null }, 0).config.defauts.volumeMusique && !L.appliquer(L.appliquer(cd.config, { op: "defaut", cible: "volumeMusique", valeur: null }, 0).config, { op: "defaut", cible: "vitesseVoix", valeur: null }, 0).config.defauts, "valeur de départ retirée, sans résidu");
const T0 = new Date(2026, 9, 28, 15, 0).getTime(); // mercredi 28 octobre 2026, 15 h
const quand = (phrase) => { const c = L.interpreter(phrase, T0).cmds[0]; return c && c.debut ? new Date(c.debut).toLocaleString("sv-SE").slice(0, 16) : null; };
verifier(quand("annonce demain à 18h : Salut") === "2026-10-29 18:00" && quand("annonce : « Salut » samedi 21h30") === "2026-10-31 21:30" && quand("annonce le 5 novembre à 20h : Salut") === "2026-11-05 20:00" && quand("annonce à 12h : Salut") === "2026-10-29 12:00" && quand("annonce à 17h : Salut") === "2026-10-28 17:00" && quand("annonce mercredi à 10h : Salut") === "2026-11-04 10:00" && quand("annonce ce soir : Salut") === "2026-10-28 20:00" && quand("annonce : Salut pendant 2h") === null, "assistant : début de l'annonce (demain, jour de la semaine, date, heure seule)");
const ia = L.interpreter("affiche l'annonce «Mise à jour dispo» pour les versions avant 9.65.0 pendant 3 jours", T0).cmds[0];
verifier(ia.avantVersion === "9.65.0" && ia.dureeMin === 4320 && ia.texte === "Mise à jour dispo" && !ia.debut, "assistant : version visée et durée");
const pd = (p) => JSON.stringify(L.interpreter(p, T0).cmds);
verifier(pd("volume de la musique par défaut à 50") === '[{"op":"defaut","cible":"volumeMusique","valeur":50}]' && pd("vitesse de la voix 1,2 par défaut") === '[{"op":"defaut","cible":"vitesseVoix","valeur":1.2}]' && pd("remets le volume de la musique par défaut") === '[{"op":"defaut","cible":"volumeMusique","valeur":null}]', "assistant : valeurs de départ");
const prog = L.appliquer({}, { op: "annonce", texte: "Plus tard", debut: T0 + 3600000, dureeMin: 60, avantVersion: "9.70.0" }, T0);
verifier(prog.config.annonce.debut === T0 + 3600000 && prog.config.annonce.fin === T0 + 7200000 && prog.config.annonce.avantVersion === "9.70.0" && !L.appliquer({}, { op: "annonce", texte: "x", avantVersion: "abc" }, 0).config, "annonce programmée : la durée compte depuis le début");

// stats.html et pilotage.html : les scripts de la page sont syntaxiquement corrects
for (const nom of ["stats.html", "pilotage.html"]) {
  const html = fs.readFileSync(path.join(__dirname, "..", nom), "utf8");
  const scripts = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const tmp = path.join(require("os").tmpdir(), "page_module_test.mjs");
  fs.writeFileSync(tmp, scripts.join("\n"));
  const r = require("child_process").spawnSync(process.execPath, ["--check", tmp], { encoding: "utf8" });
  verifier(scripts.length === 1 && r.status === 0, nom + " : script sans erreur de syntaxe " + (r.stderr || ""));
}
// les règles Firebase restent un JSON valide qui protège « config » en écriture
const regles = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "database.rules.json"), "utf8")).rules;
verifier(regles.stats.appareils.$id.confVu && regles.stats.appareils.$id.confV && regles.config.v && regles.config.defauts && regles.config.annonce.debut && regles.config.annonce.avantVersion, "règles Firebase : champs des nouveaux réglages");
verifier(regles.config[".read"] === true && /auth\.uid/.test(regles.config[".write"]) && /auth\.uid/.test(regles.config_hist[".write"]) && regles.config_hist[".read"] !== true, "règles Firebase : config lisible par tous, écriture réservée au compte administrateur");
console.log(process.exitCode ? "\nÉCHEC(S)" : `\nTOUT EST OK (${ok})`);
