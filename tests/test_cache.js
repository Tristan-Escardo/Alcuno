// Vérifie que le nom du cache du service worker (CACHE dans sw.js) change quand une image du jeu change :
// sinon les téléphones gardent les anciennes images (c'est arrivé avec les dos de cartes Kawaii).
//   node tests/test_cache.js
// Si l'échec dit d'enregistrer l'empreinte :  node outils/maj_empreinte_cache.js
const fs = require("fs"), path = require("path");
const { empreinte, empreinteMusiques, nomDuCache, nomCacheMusiques, fichiers, FICHIER, RACINE } = require("./empreinte_cache");
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

// Les musiques ont leur propre cache (CACHE_MUSIQUES) : son nom doit changer quand un morceau change, et seulement alors
const cacheM = nomCacheMusiques(), musiquesMaintenant = empreinteMusiques();
verifier(cacheM !== null, "CACHE_MUSIQUES présent dans sw.js (les musiques hors connexion survivent aux mises à jour du jeu)");
verifier(!(cacheM === notee.cacheMusiques && musiquesMaintenant !== notee.empreinteMusiques),
  `musique modifiée avec le même nom de cache des musiques (${cacheM}) : change CACHE_MUSIQUES dans sw.js (-v+1), puis lance « node outils/maj_empreinte_cache.js »`);
verifier(cacheM === notee.cacheMusiques && musiquesMaintenant === notee.empreinteMusiques,
  `empreinte des musiques à jour pour ${cacheM} (notée : ${notee.cacheMusiques}) : lance « node outils/maj_empreinte_cache.js »`);
verifier(cacheM !== cache, "le cache des musiques n'a pas le même nom que celui du jeu");

// Toute image du jeu doit être dans la liste A_PRECHARGER de sw.js (sinon elle manque hors connexion)
const sw = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8");
const manquantes = fichiers("Cartes").concat(fichiers("stickers")).filter((f) => !sw.includes(`"./${f}"`));
verifier(manquantes.length === 0, `images absentes de A_PRECHARGER dans sw.js ${manquantes.slice(0, 8).join(", ")}${manquantes.length > 8 ? " … (" + manquantes.length + ")" : ""}`);

console.log(echecs ? `\n${echecs} ÉCHEC(S)` : "\nTOUT EST OK");
process.exit(echecs ? 1 : 0);
