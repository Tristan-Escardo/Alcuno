// Service worker d'Alcuno : rend le jeu installable et jouable hors connexion (mode classique).
//
// Stratégie « réseau d'abord » : avec internet, on prend TOUJOURS la dernière version en ligne
// (et on met à jour la copie locale) ; la copie locale ne sert que quand il n'y a pas de réseau.
// Ainsi l'appli installée ne reste jamais bloquée sur une vieille version (sinon les téléphones
// d'une partie en ligne n'auraient pas la même version).
//
// Changer CACHE (ex. "alcuno-v2") force les téléphones à repartir d'une copie locale propre.

const CACHE = "alcuno-v10"; // v10 : faces de cartes Star Wars (Cartes/galaxie/) ; v9 : faces de cartes Kawaii (Cartes/kawaii/) ; v8 : dos Kawaii renommés (dos_kawaii_alcuno_*) pour sortir des anciens caches ; v7 : dos Kawaii avec « ALC UNO » ; v6 : dos de cartes Kawaii ; v5 : petits personnages flottants du thème Kawaii ; v4 : album de stickers et thème Kawaii ; v3 : QR code de la partie (js/qrcode.js) ; v2 : cartes HD en WebP (les anciennes .jpg sont supprimées du cache)

// Copié dès l'installation : de quoi jouer en classique sans réseau
const A_PRECHARGER = [
  "./",
  "./index.html",
  "./script.js",
  "./js/qrcode.js",
  "./js/reglages.js",
  "./js/en-ligne.js",
  "./js/plateau.js",
  "./js/regles.js",
  "./js/synchro-en-ligne.js",
  "./js/retour-demarrage.js",
  "./js/tele.js",
  "./js/stats.js",
  "./js/stickers.js",
  "./js/mouchard.js",
  "./style_alcuno.css",
  "./style_kawaii.css",
  "./stickers/cupcake.svg",
  "./stickers/chat.svg",
  "./stickers/lapin.svg",
  "./stickers/poussin.svg",
  "./stickers/etoile.svg",
  "./stickers/licorne.svg",
  "./stickers/fraise.svg",
  "./stickers/sushi.svg",
  "./stickers/macaron.svg",
  "./stickers/chou.svg",
  "./stickers/nuage.svg",
  "./Cartes/dos_kawaii_alcuno_licorne.svg",
  "./Cartes/dos_kawaii_alcuno_nuages.svg",
  "./Cartes/dos_kawaii_alcuno_gourmand.svg",
  "./stickers/etoile_filante.svg",
  "./stickers/coeur.svg",
  "./stickers/arcenciel.svg",
  "./stickers/sucette.svg",
  "./stickers/fleur.svg",
  "./stickers/bulle.svg",
  "./stickers/glace.svg",
  "./stickers/corne.svg",
  "./stickers/scintille.svg",
  "./manifest.json",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-180.png",
  "./icones/qr_alcuno.svg",
  "./Cartes/carte_doree.svg",
  "./Cartes/galaxie/cinq_bleu.svg",
  "./Cartes/galaxie/cinq_jaune.svg",
  "./Cartes/galaxie/cinq_rouge.svg",
  "./Cartes/galaxie/cinq_vert.svg",
  "./Cartes/galaxie/couleur.svg",
  "./Cartes/galaxie/deux_bleu.svg",
  "./Cartes/galaxie/deux_jaune.svg",
  "./Cartes/galaxie/deux_rouge.svg",
  "./Cartes/galaxie/deux_vert.svg",
  "./Cartes/galaxie/huit_bleu.svg",
  "./Cartes/galaxie/huit_jaune.svg",
  "./Cartes/galaxie/huit_rouge.svg",
  "./Cartes/galaxie/huit_vert.svg",
  "./Cartes/galaxie/interdit_bleu.svg",
  "./Cartes/galaxie/interdit_jaune.svg",
  "./Cartes/galaxie/interdit_rouge.svg",
  "./Cartes/galaxie/interdit_vert.svg",
  "./Cartes/galaxie/neuf_bleu.svg",
  "./Cartes/galaxie/neuf_jaune.svg",
  "./Cartes/galaxie/neuf_rouge.svg",
  "./Cartes/galaxie/neuf_vert.svg",
  "./Cartes/galaxie/plus_2_bleu.svg",
  "./Cartes/galaxie/plus_2_jaune.svg",
  "./Cartes/galaxie/plus_2_rouge.svg",
  "./Cartes/galaxie/plus_2_vert.svg",
  "./Cartes/galaxie/plus_4.svg",
  "./Cartes/galaxie/quatre_bleu.svg",
  "./Cartes/galaxie/quatre_jaune.svg",
  "./Cartes/galaxie/quatre_rouge.svg",
  "./Cartes/galaxie/quatre_vert.svg",
  "./Cartes/galaxie/sept_bleu.svg",
  "./Cartes/galaxie/sept_jaune.svg",
  "./Cartes/galaxie/sept_rouge.svg",
  "./Cartes/galaxie/sept_vert.svg",
  "./Cartes/galaxie/six_bleu.svg",
  "./Cartes/galaxie/six_jaune.svg",
  "./Cartes/galaxie/six_rouge.svg",
  "./Cartes/galaxie/six_vert.svg",
  "./Cartes/galaxie/switch_bleu.svg",
  "./Cartes/galaxie/switch_jaune.svg",
  "./Cartes/galaxie/switch_rouge.svg",
  "./Cartes/galaxie/switch_vert.svg",
  "./Cartes/galaxie/trois_bleu.svg",
  "./Cartes/galaxie/trois_jaune.svg",
  "./Cartes/galaxie/trois_rouge.svg",
  "./Cartes/galaxie/trois_vert.svg",
  "./Cartes/galaxie/un_bleu.svg",
  "./Cartes/galaxie/un_jaune.svg",
  "./Cartes/galaxie/un_rouge.svg",
  "./Cartes/galaxie/un_vert.svg",
  "./Cartes/galaxie/zero_bleu.svg",
  "./Cartes/galaxie/zero_jaune.svg",
  "./Cartes/galaxie/zero_rouge.svg",
  "./Cartes/galaxie/zero_vert.svg",
  "./Cartes/kawaii/cinq_bleu.svg",
  "./Cartes/kawaii/cinq_jaune.svg",
  "./Cartes/kawaii/cinq_rouge.svg",
  "./Cartes/kawaii/cinq_vert.svg",
  "./Cartes/kawaii/couleur.svg",
  "./Cartes/kawaii/deux_bleu.svg",
  "./Cartes/kawaii/deux_jaune.svg",
  "./Cartes/kawaii/deux_rouge.svg",
  "./Cartes/kawaii/deux_vert.svg",
  "./Cartes/kawaii/huit_bleu.svg",
  "./Cartes/kawaii/huit_jaune.svg",
  "./Cartes/kawaii/huit_rouge.svg",
  "./Cartes/kawaii/huit_vert.svg",
  "./Cartes/kawaii/interdit_bleu.svg",
  "./Cartes/kawaii/interdit_jaune.svg",
  "./Cartes/kawaii/interdit_rouge.svg",
  "./Cartes/kawaii/interdit_vert.svg",
  "./Cartes/kawaii/neuf_bleu.svg",
  "./Cartes/kawaii/neuf_jaune.svg",
  "./Cartes/kawaii/neuf_rouge.svg",
  "./Cartes/kawaii/neuf_vert.svg",
  "./Cartes/kawaii/plus_2_bleu.svg",
  "./Cartes/kawaii/plus_2_jaune.svg",
  "./Cartes/kawaii/plus_2_rouge.svg",
  "./Cartes/kawaii/plus_2_vert.svg",
  "./Cartes/kawaii/plus_4.svg",
  "./Cartes/kawaii/quatre_bleu.svg",
  "./Cartes/kawaii/quatre_jaune.svg",
  "./Cartes/kawaii/quatre_rouge.svg",
  "./Cartes/kawaii/quatre_vert.svg",
  "./Cartes/kawaii/sept_bleu.svg",
  "./Cartes/kawaii/sept_jaune.svg",
  "./Cartes/kawaii/sept_rouge.svg",
  "./Cartes/kawaii/sept_vert.svg",
  "./Cartes/kawaii/six_bleu.svg",
  "./Cartes/kawaii/six_jaune.svg",
  "./Cartes/kawaii/six_rouge.svg",
  "./Cartes/kawaii/six_vert.svg",
  "./Cartes/kawaii/switch_bleu.svg",
  "./Cartes/kawaii/switch_jaune.svg",
  "./Cartes/kawaii/switch_rouge.svg",
  "./Cartes/kawaii/switch_vert.svg",
  "./Cartes/kawaii/trois_bleu.svg",
  "./Cartes/kawaii/trois_jaune.svg",
  "./Cartes/kawaii/trois_rouge.svg",
  "./Cartes/kawaii/trois_vert.svg",
  "./Cartes/kawaii/un_bleu.svg",
  "./Cartes/kawaii/un_jaune.svg",
  "./Cartes/kawaii/un_rouge.svg",
  "./Cartes/kawaii/un_vert.svg",
  "./Cartes/kawaii/zero_bleu.svg",
  "./Cartes/kawaii/zero_jaune.svg",
  "./Cartes/kawaii/zero_rouge.svg",
  "./Cartes/kawaii/zero_vert.svg",
  "./Cartes/cinq_bleu.webp",
  "./Cartes/cinq_jaune.webp",
  "./Cartes/cinq_rouge.webp",
  "./Cartes/cinq_vert.webp",
  "./Cartes/couleur.webp",
  "./Cartes/deux_bleu.webp",
  "./Cartes/deux_jaune.webp",
  "./Cartes/deux_rouge.webp",
  "./Cartes/deux_vert.webp",
  "./Cartes/dos.gif",
  "./Cartes/huit_bleu.webp",
  "./Cartes/huit_jaune.webp",
  "./Cartes/huit_rouge.webp",
  "./Cartes/huit_vert.webp",
  "./Cartes/interdit_bleu.webp",
  "./Cartes/interdit_jaune.webp",
  "./Cartes/interdit_rouge.webp",
  "./Cartes/interdit_vert.webp",
  "./Cartes/neuf_bleu.webp",
  "./Cartes/neuf_jaune.webp",
  "./Cartes/neuf_rouge.webp",
  "./Cartes/neuf_vert.webp",
  "./Cartes/plus_2_bleu.webp",
  "./Cartes/plus_2_jaune.webp",
  "./Cartes/plus_2_rouge.webp",
  "./Cartes/plus_2_vert.webp",
  "./Cartes/plus_4.webp",
  "./Cartes/quatre_bleu.webp",
  "./Cartes/quatre_jaune.webp",
  "./Cartes/quatre_rouge.webp",
  "./Cartes/quatre_vert.webp",
  "./Cartes/sept_bleu.webp",
  "./Cartes/sept_jaune.webp",
  "./Cartes/sept_rouge.webp",
  "./Cartes/sept_vert.webp",
  "./Cartes/six_bleu.webp",
  "./Cartes/six_jaune.webp",
  "./Cartes/six_rouge.webp",
  "./Cartes/six_vert.webp",
  "./Cartes/switch_bleu.webp",
  "./Cartes/switch_jaune.webp",
  "./Cartes/switch_rouge.webp",
  "./Cartes/switch_vert.webp",
  "./Cartes/trois_bleu.webp",
  "./Cartes/trois_jaune.webp",
  "./Cartes/trois_rouge.webp",
  "./Cartes/trois_vert.webp",
  "./Cartes/un_bleu.webp",
  "./Cartes/un_jaune.webp",
  "./Cartes/un_rouge.webp",
  "./Cartes/un_vert.webp",
  "./Cartes/zero_bleu.webp",
  "./Cartes/zero_jaune.webp",
  "./Cartes/zero_rouge.webp",
  "./Cartes/zero_vert.webp",
];

// Sons (dossier Sons/) : copiés aussi, pour en avoir hors connexion. Un par un et sans bloquer :
// un fichier absent (son pas encore ajouté) n'empêche pas l'installation du reste.
const SONS_A_PRECHARGER = ["cartes", "doree", "tiens_gueule", "bouton", "pigeon", "tour", "eau", "sons_on", "credits", "reglage_son", "no_wifi", "distribuer_gorgees", "annuler_gorgees", "annuler_0_gorgees", "regles", "accessibilite_on"]
  .concat(["sabre/sabre_01", "sabre/sabre_02", "sabre/sabre_05", "sabre/sabre_07", "sabre/sabre_09", "sabre/sabre_11", "sabre/sabre_14", "sabre/sabre_15", "sabre/sabre_18", "sabre/sabre_22", "sabre/sabre_24", "sabre/sabre_26", "sabre/sabre_31", "sabre/sabre_33", "sabre/sabre_35", "sabre/sabre_37", "sabre/sabre_38", "sabre/sabre_40", "sabre/sabre_41", "sabre/sabre_48", "sabre/sabre_54"])
  .map((nom) => `./Sons/${nom}.mp3`);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(A_PRECHARGER)
        .then(() => Promise.all(SONS_A_PRECHARGER.map((son) => cache.add(son).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((cle) => cle !== CACHE).map((cle) => caches.delete(cle))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  // Firebase, polices, etc. : pas touché (le mode en ligne a de toute façon besoin du réseau)
  if (url.origin !== self.location.origin) return;
  // Musique d'ambiance : lue en flux par morceaux (requêtes « Range »), pas gardée (fichiers lourds)
  if (url.pathname.includes("/Sons/musique")) return;

  // Une seule copie par fichier : on ignore le « ?t=... » anti-cache de index.html
  const cle = url.origin + url.pathname;

  event.respondWith(
    fetch(requete)
      .then((reponse) => {
        if (reponse.ok) {
          const copie = reponse.clone();
          caches.open(CACHE).then((cache) => cache.put(cle, copie));
        }
        return reponse;
      })
      .catch(() =>
        caches.match(cle).then((enCache) => {
          if (enCache) return enCache;
          // Page d'accueil demandée avec une autre adresse (ex. ?v=...) : on sert index.html
          if (requete.mode === "navigate") return caches.match(new URL("./index.html", self.registration.scope).href);
          return Response.error();
        })
      )
  );
});
