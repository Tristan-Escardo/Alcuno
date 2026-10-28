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
// Les morceaux de musique (Sons/musique*.mp3) sont gardés en cache d'abord (sw.js) : ils comptent aussi
const MUSIQUES = () => fichiers("Sons").filter((f) => /^Sons\/musique[^/]*\.mp3$/.test(f));
function empreinte(){
  const h = crypto.createHash("sha1");
  for (const f of DOSSIERS.flatMap(fichiers).concat(MUSIQUES()).sort()) {
    h.update(f + "\0"); h.update(crypto.createHash("sha1").update(fs.readFileSync(path.join(RACINE, f))).digest("hex") + "\n");
  }
  return h.digest("hex");
}
function nomDuCache(){
  const m = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8").match(/const CACHE = "([^"]+)"/);
  return m ? m[1] : null;
}
const FICHIER = path.join(__dirname, "empreinte_cache.json");
module.exports = { empreinte, nomDuCache, fichiers, DOSSIERS, FICHIER, RACINE };
