// À lancer après avoir changé une image du jeu ET le nom du cache (CACHE dans sw.js) : enregistre l'empreinte
// des images pour tests/test_cache.js.   node outils/maj_empreinte_cache.js
const fs = require("fs");
const { empreinteCode, empreinte, empreinteMusiques, nomDuCache, nomCacheMusiques, FICHIER } = require("../tests/empreinte_cache");
let ancienne = {};
try { ancienne = JSON.parse(fs.readFileSync(FICHIER, "utf8")); } catch (e) {}
const cache = nomDuCache(), nouvelle = empreinte();
if (ancienne.cache === cache && ancienne.empreinte && ancienne.empreinte !== nouvelle) {
  console.error(`Les images ont changé mais CACHE est toujours « ${cache} » dans sw.js : change-le d'abord (ex. alcuno-v+1).`);
  process.exit(1);
}
const nouveauCode = empreinteCode();
if (ancienne.cache === cache && ancienne.empreinteCode && ancienne.empreinteCode !== nouveauCode) {
  console.error(`Le code du jeu a changé mais CACHE est toujours « ${cache} » dans sw.js : change-le d'abord (ex. alcuno-v+1), sinon des téléphones garderaient l'ancienne version.`);
  process.exit(1);
}
const cacheM = nomCacheMusiques(), nouvelleM = empreinteMusiques();
if (ancienne.cacheMusiques === cacheM && ancienne.empreinteMusiques && ancienne.empreinteMusiques !== nouvelleM) {
  console.error(`Une musique a changé mais CACHE_MUSIQUES est toujours « ${cacheM} » dans sw.js : change-le d'abord (ex. -v2).`);
  process.exit(1);
}
fs.writeFileSync(FICHIER, JSON.stringify({ cache, empreinte: nouvelle, empreinteCode: nouveauCode, cacheMusiques: cacheM, empreinteMusiques: nouvelleM }, null, 2) + "\n");
console.log(`Empreinte enregistrée pour le cache ${cache} : ${nouvelle.slice(0, 12)}…`);
