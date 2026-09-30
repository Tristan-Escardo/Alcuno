// Service worker d'Alcuno : rend le jeu installable et jouable hors connexion (mode classique).
//
// Stratégie « réseau d'abord » : avec internet, on prend TOUJOURS la dernière version en ligne
// (et on met à jour la copie locale) ; la copie locale ne sert que quand il n'y a pas de réseau.
// Ainsi l'appli installée ne reste jamais bloquée sur une vieille version (sinon les téléphones
// d'une partie en ligne n'auraient pas la même version).
//
// Changer CACHE (ex. "alcuno-v2") force les téléphones à repartir d'une copie locale propre.

const CACHE = "alcuno-v1";

// Copié dès l'installation : de quoi jouer en classique sans réseau
const A_PRECHARGER = [
  "./",
  "./index.html",
  "./script.js",
  "./style_alcuno.css",
  "./manifest.json",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-180.png",
  "./Cartes/carte_doree.svg",
  "./Cartes/cinq_bleu.jpg",
  "./Cartes/cinq_jaune.jpg",
  "./Cartes/cinq_rouge.jpg",
  "./Cartes/cinq_vert.jpg",
  "./Cartes/couleur.jpg",
  "./Cartes/deux_bleu.jpg",
  "./Cartes/deux_jaune.jpg",
  "./Cartes/deux_rouge.jpg",
  "./Cartes/deux_vert.jpg",
  "./Cartes/dos.gif",
  "./Cartes/huit_bleu.jpg",
  "./Cartes/huit_jaune.jpg",
  "./Cartes/huit_rouge.jpg",
  "./Cartes/huit_vert.jpg",
  "./Cartes/interdit_bleu.jpg",
  "./Cartes/interdit_jaune.jpg",
  "./Cartes/interdit_rouge.jpg",
  "./Cartes/interdit_vert.jpg",
  "./Cartes/neuf_bleu.jpg",
  "./Cartes/neuf_jaune.jpg",
  "./Cartes/neuf_rouge.jpg",
  "./Cartes/neuf_vert.jpg",
  "./Cartes/plus_2_bleu1.jpg",
  "./Cartes/plus_2_jaune.jpg",
  "./Cartes/plus_2_rouge.jpg",
  "./Cartes/plus_2_vert.jpg",
  "./Cartes/plus_4.jpg",
  "./Cartes/quatre_bleu.jpg",
  "./Cartes/quatre_jaune.jpg",
  "./Cartes/quatre_rouge.jpg",
  "./Cartes/quatre_vert.jpg",
  "./Cartes/sept_bleu.jpg",
  "./Cartes/sept_jaune.jpg",
  "./Cartes/sept_rouge.jpg",
  "./Cartes/sept_vert.jpg",
  "./Cartes/six_bleu.jpg",
  "./Cartes/six_jaune.jpg",
  "./Cartes/six_rouge.jpg",
  "./Cartes/six_vert.jpg",
  "./Cartes/switch_bleu.jpg",
  "./Cartes/switch_jaune.jpg",
  "./Cartes/switch_rouge.jpg",
  "./Cartes/switch_vert.jpg",
  "./Cartes/trois_bleu.jpg",
  "./Cartes/trois_jaune.jpg",
  "./Cartes/trois_rouge.jpg",
  "./Cartes/trois_vert.jpg",
  "./Cartes/un_bleu.jpg",
  "./Cartes/un_jaune.jpg",
  "./Cartes/un_rouge.jpg",
  "./Cartes/un_vert.jpg",
  "./Cartes/zero_bleu.jpg",
  "./Cartes/zero_jaune.jpg",
  "./Cartes/zero_rouge.jpg",
  "./Cartes/zero_vert.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(A_PRECHARGER))
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
