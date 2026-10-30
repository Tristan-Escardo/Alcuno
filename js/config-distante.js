// =============================================================================================
// ALCUNO : réglages à distance (suite : voir js/config-lib.js pour ce que « config » peut contenir)
// Lus dans Firebase (config), gardés dans le téléphone pour le hors connexion, appliqués à l'écran :
// annonce sur l'accueil, voix / musique / mode en ligne coupés, thèmes cachés ou de saison, mise à jour demandée.
// Rien ici ne peut empêcher de jouer : sans réseau, sans Firebase ou avec une valeur étrange, le jeu reste réglé par défaut.
// =============================================================================================
// #region Réglages à distance
const CLE_CONFIG_DISTANTE = "alcuno_config_distante";
const CLE_ANNONCE_VUE = "alcuno_annonce_vue";
const CONFIG_REFRAICHIR_APRES = 5 * 60 * 1000; // pas plus d'une lecture toutes les 5 min au retour dans l'appli
let configLueLe = 0;

try { configDistante = ConfigLib.valider(JSON.parse(localStorage.getItem(CLE_CONFIG_DISTANTE) || "{}")); } catch (e) { configDistante = {}; }

// Utilisée par appliquerTheme (js/reglages.js) : le thème est caché ou hors de sa période
function themeBloqueADistance(nom){ return !ConfigLib.themeDisponible(configDistante, nom, new Date()); }

function appliquerConfigDistante(){
  const racine = document.documentElement;
  // fonctions coupées
  racine.classList.toggle("coupure-voix", ConfigLib.coupee(configDistante, "voix"));
  racine.classList.toggle("coupure-musique", ConfigLib.coupee(configDistante, "musique"));
  const enligne = ConfigLib.coupee(configDistante, "enligne");
  racine.classList.toggle("coupure-enligne", enligne);
  const bouton = document.getElementById("btnModeEnLigne");
  if (bouton) {
    bouton.disabled = enligne;
    bouton.title = enligne ? "Le mode en ligne est coupé pour le moment" : "";
  }
  if (ConfigLib.coupee(configDistante, "voix")) { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} }
  try { majMusique(); } catch (e) {}

  // thèmes cachés / hors période : pastille retirée ; si c'est le thème en cours, retour à Bordeaux
  document.querySelectorAll(".pastilleTheme").forEach((p) => p.classList.toggle("themeCoupe", themeBloqueADistance(p.dataset.theme)));
  const actuel = racine.dataset.theme || "bordeaux";
  if (themeBloqueADistance(actuel)) appliquerTheme("bordeaux");

  appliquerDefautsDistants();
  majAnnonceAccueil();
}

// Valeurs de départ imposées à distance (volume de la musique, vitesse de la voix) : seulement pour ceux qui n'ont jamais touché au curseur
function appliquerDefautsDistants(){
  const d = configDistante.defauts || {};
  try {
    if (localStorage.getItem(CLE_VOLUME_MUSIQUE) === null) {
      volumeMusique = d.volumeMusique !== undefined ? d.volumeMusique : 30;
      curseurMusique.value = volumeMusique; majLigneMusique();
    }
    if (localStorage.getItem(CLE_VITESSE_VOIX) === null) {
      vitesseVoix = d.vitesseVoix !== undefined ? d.vitesseVoix : 1;
      curseurVoix.value = vitesseVoix; majLigneVoix();
    }
  } catch (e) {}
}

// Bandeau de l'accueil : annonce (commencée, pas finie, pour cette version), ou demande de mise à jour. Revu chaque minute :
// une annonce programmée apparaît toute seule à l'heure dite.
function majAnnonceAccueil(){
  const zone = document.getElementById("annonceAccueil");
  if (!zone) return;
  let texte = "", maj = false, cle = "";
  if (configDistante.majMin && ConfigLib.versionPlusVieille(VERSION_AFFICHEE, configDistante.majMin)) {
    texte = `Une nouvelle version du jeu est disponible (${configDistante.majMin}).`; maj = true; cle = "maj" + configDistante.majMin;
  } else if (ConfigLib.annonceVisible(configDistante, Date.now(), VERSION_AFFICHEE)) {
    texte = configDistante.annonce.texte; cle = "annonce" + (configDistante.annonce.maj || 0) + texte;
  }
  let vue = ""; try { vue = localStorage.getItem(CLE_ANNONCE_VUE) || ""; } catch (e) {}
  const afficher = !!texte && (maj || vue !== cle);
  zone.hidden = !afficher;
  zone.dataset.cle = cle;
  document.getElementById("texteAnnonce").textContent = texte;
  document.getElementById("etiquetteAnnonce").textContent = maj ? "Mise à jour" : "Annonce";
  document.getElementById("iconeAnnonce").textContent = maj ? "🚀" : "📣";
  document.getElementById("btnAnnonceMaj").hidden = !maj;
  document.getElementById("btnAnnonceFermer").hidden = maj; // (une mise à jour demandée ne se ferme pas)
  // la même carte en haut des Réglages et des Crédits (plus de chances qu'elle soit vue)
  document.querySelectorAll("[data-annonce-relais]").forEach((conteneur) => {
    conteneur.hidden = !afficher;
    conteneur.textContent = "";
    if (!afficher) return;
    const carte = document.createElement("div");
    carte.className = "annonceAccueil";
    carte.setAttribute("role", "status");
    const icone = document.createElement("span"); icone.className = "annonceIcone"; icone.textContent = maj ? "🚀" : "📣";
    const corps = document.createElement("div"); corps.className = "annonceCorps";
    const etiquette = document.createElement("span"); etiquette.className = "annonceEtiquette"; etiquette.textContent = maj ? "Mise à jour" : "Annonce";
    const message = document.createElement("span"); message.className = "annonceTexte"; message.textContent = texte;
    corps.append(etiquette, message);
    if (maj) {
      const bouton = document.createElement("button"); bouton.type = "button"; bouton.className = "annonceMaj"; bouton.textContent = "Mettre à jour";
      bouton.addEventListener("click", () => location.reload());
      corps.append(bouton);
    }
    carte.append(icone, corps);
    if (!maj) {
      const fermer = document.createElement("button"); fermer.type = "button"; fermer.className = "annonceFermer"; fermer.setAttribute("aria-label", "Fermer l'annonce"); fermer.textContent = "✕";
      fermer.addEventListener("click", fermerAnnonce);
      carte.append(fermer);
    }
    conteneur.append(carte);
  });
}

function lireConfigDistante(){
  configLueLe = Date.now();
  attendreFirebase(() => {
    window.fbGet(window.fbRef(window.firebaseDB, "config")).then((s) => {
      configDistante = ConfigLib.valider(s.val());
      try { localStorage.setItem(CLE_CONFIG_DISTANTE, JSON.stringify(configDistante)); } catch (e) {}
      appliquerConfigDistante();
      // Dit à l'onglet Pilotage de stats.html que cet appareil a bien lu la config (et laquelle) : voyant « lecture »
      if (!estPageTele && !MODE_TEST) window.fbUpdate(window.fbRef(window.firebaseDB, `stats/appareils/${idStats}`), { confVu: window.fbServerTimestamp(), confV: configDistante.v || 0 }).catch(() => {});
    }).catch(() => {}); // (pas de réseau ou règles Firebase pas encore à jour : on garde la dernière copie)
  });
}

function fermerAnnonce(){ // (ferme la carte de l'accueil et ses doubles)
  const zone = document.getElementById("annonceAccueil");
  try { localStorage.setItem(CLE_ANNONCE_VUE, zone.dataset.cle || ""); } catch (e) {}
  zone.hidden = true;
  document.querySelectorAll("[data-annonce-relais]").forEach((c) => { c.hidden = true; c.textContent = ""; });
}
document.getElementById("btnAnnonceFermer").addEventListener("click", fermerAnnonce);
document.getElementById("btnAnnonceMaj").addEventListener("click", () => { location.reload(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - configLueLe > CONFIG_REFRAICHIR_APRES) lireConfigDistante();
});

appliquerConfigDistante();
lireConfigDistante();
setInterval(majAnnonceAccueil, 60 * 1000);
// #endregion
