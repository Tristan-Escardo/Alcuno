// Vérifie que le nom du cache du service worker (CACHE dans sw.js) change quand une image du jeu change :
// sinon les téléphones gardent les anciennes images (c'est arrivé avec les dos de cartes Kawaii).
//   node tests/test_cache.js
// Si l'échec dit d'enregistrer l'empreinte :  node outils/maj_empreinte_cache.js
const fs = require("fs"), path = require("path");
const { empreinte, nomDuCache, fichiers, FICHIER, RACINE } = require("./empreinte_cache");
let echecs = 0;
const verifier = (ok, msg) => { console.log((ok ? "OK    " : "ECHEC ") + msg); if (!ok) echecs++; };

const cache = nomDuCache(), maintenant = empreinte();
let notee = { cache: null, empreinte: null };
try { notee = JSON.parse(fs.readFileSync(FICHIER, "utf8")); } catch (e) {}
const memeCache = cache === notee.cache, memesImages = maintenant === notee.empreinte;
verifier(!(memeCache && !memesImages),
  `images modifiées avec le même nom de cache (${cache}) : change CACHE dans sw.js (alcuno-v+1), puis lance « node outils/maj_empreinte_cache.js »`);
verifier(memeCache && memesImages,
  `empreinte à jour pour le cache ${cache} (notée : ${notee.cache}) : lance « node outils/maj_empreinte_cache.js »`);

// Toute image du jeu doit être dans la liste A_PRECHARGER de sw.js (sinon elle manque hors connexion)
const sw = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8");
const manquantes = fichiers("Cartes").concat(fichiers("stickers")).filter((f) => !sw.includes(`"./${f}"`));
verifier(manquantes.length === 0, `images absentes de A_PRECHARGER dans sw.js ${manquantes.slice(0, 8).join(", ")}${manquantes.length > 8 ? " … (" + manquantes.length + ")" : ""}`);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
process.exit(echecs ? 1 : 0);
