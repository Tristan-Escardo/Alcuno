// À lancer après avoir changé une image du jeu ET le nom du cache (CACHE dans sw.js) : enregistre l'empreinte
// des images pour tests/test_cache.js.   node outils/maj_empreinte_cache.js
const fs = require("fs");
const { empreinte, nomDuCache, FICHIER } = require("../tests/empreinte_cache");
let ancienne = {};
try { ancienne = JSON.parse(fs.readFileSync(FICHIER, "utf8")); } catch (e) {}
const cache = nomDuCache(), nouvelle = empreinte();
if (ancienne.cache === cache && ancienne.empreinte && ancienne.empreinte !== nouvelle) {
  console.error(`Les images ont changé mais CACHE est toujours « ${cache} » dans sw.js : change-le d'abord (ex. alcuno-v+1).`);
  process.exit(1);
}
fs.writeFileSync(FICHIER, JSON.stringify({ cache, empreinte: nouvelle }, null, 2) + "\n");
console.log(`Empreinte enregistrée pour le cache ${cache} : ${nouvelle.slice(0, 12)}…`);
