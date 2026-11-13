// Empreinte des images du jeu (Cartes/, stickers/, icones/) : sert à vérifier qu'on change le nom du cache du service worker
// (CACHE dans sw.js) à chaque fois qu'une image change. Utilisé par test_cache.js et outils/maj_empreinte_cache.js.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const RACINE = path.join(__dirname, "..");
const DOSSIERS = ["Cartes", "stickers", "icones"];

function fichiers(dossier){
  const sortie = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(path.join(RACINE, d), { withFileTypes: true })) {
      const rel = d + "/" + e.name;
      if (e.isDirectory()) parcourir(rel); else sortie.push(rel);
    }
  };
  parcourir(dossier);
  return sortie;
}
// Les morceaux de musique (Sons/musique*.mp3) sont dans un cache à part (CACHE_MUSIQUES, sw.js) : leur empreinte aussi
const MUSIQUES = () => fichiers("Sons").filter((f) => /^Sons\/musique[^/]*\.mp3$/.test(f));
function empreinteDe(liste){
  const h = crypto.createHash("sha1");
  for (const f of liste.sort()) {
    h.update(f + "\0"); h.update(crypto.createHash("sha1").update(fs.readFileSync(path.join(RACINE, f))).digest("hex") + "\n");
  }
  return h.digest("hex");
}
function empreinte(){ return empreinteDe(DOSSIERS.flatMap(fichiers)); }
function empreinteMusiques(){ return empreinteDe(MUSIQUES()); }
// Le code du jeu : les fichiers de A_PRECHARGER (sw.js) + sw.js lui-même sans sa ligne « const CACHE = … » (qui change à chaque version).
// Sert à vérifier qu'on change le nom du cache dès que le code change (sinon des téléphones gardent l'ancienne version).
function empreinteCode(){
  const sw = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8");
  const bloc = (sw.match(/const A_PRECHARGER = \[([\s\S]*?)\];/) || [, ""])[1];
  const liste = [...bloc.matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1]).filter((f) => fs.existsSync(path.join(RACINE, f)) && fs.statSync(path.join(RACINE, f)).isFile());
  const h = crypto.createHash("sha1");
  for (const f of liste.sort()) h.update(f + "\0" + crypto.createHash("sha1").update(fs.readFileSync(path.join(RACINE, f))).digest("hex") + "\n");
  h.update("sw.js\0" + sw.replace(/^const CACHE = .*$/m, "").replace(/^const CACHE_MUSIQUES = .*$/m, ""));
  return h.digest("hex");
}
function nomDuCache(){
  const m = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8").match(/const CACHE = "([^"]+)"/);
  return m ? m[1] : null;
}
function nomCacheMusiques(){
  const m = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8").match(/const CACHE_MUSIQUES = "([^"]+)"/);
  return m ? m[1] : null;
}
const FICHIER = path.join(__dirname, "empreinte_cache.json");
module.exports = { empreinteCode, empreinte, empreinteMusiques, nomDuCache, nomCacheMusiques, fichiers, DOSSIERS, FICHIER, RACINE };
