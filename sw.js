// Service worker d'Alcuno : rend le jeu installable et jouable hors connexion (mode classique).
//
// Stratégie « réseau d'abord » : avec internet, on prend TOUJOURS la dernière version en ligne
// (et on met à jour la copie locale) ; la copie locale ne sert que quand il n'y a pas de réseau.
// Ainsi l'appli installée ne reste jamais bloquée sur une vieille version (sinon les téléphones
// d'une partie en ligne n'auraient pas la même version).
//
// Changer CACHE (ex. "alcuno-v2") force les téléphones à repartir d'une copie locale propre.

const CACHE = "alcuno-v2"; // v2 : cartes HD en WebP (les anciennes .jpg sont supprimées du cache)

// Copié dès l'installation : de quoi jouer en classique sans réseau
const A_PRECHARGER = [
  "./",
  "./index.html",
  "./script.js",
  "./js/reglages.js",
  "./js/en-ligne.js",
  "./js/plateau.js",
  "./js/regles.js",
  "./js/synchro-en-ligne.js",
  "./js/retour-demarrage.js",
  "./style_alcuno.css",
  "./manifest.json",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-180.png",
  "./icones/qr_alcuno.svg",
  "./Cartes/carte_doree.svg",
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
const SONS_A_PRECHARGER = ["cartes", "doree", "pigeon", "tour", "eau", "sons_on", "credits", "reglage_son", "no_wifi", "distribuer_gorgees", "annuler_gorgees", "annuler_0_gorgees"]
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
