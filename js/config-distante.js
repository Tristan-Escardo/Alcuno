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

  // bandeau de l'accueil : annonce, ou demande de mise à jour
  const zone = document.getElementById("annonceAccueil");
  if (!zone) return;
  let texte = "", maj = false, cle = "";
  if (configDistante.majMin && ConfigLib.versionPlusVieille(VERSION_AFFICHEE, configDistante.majMin)) {
    texte = `Une nouvelle version du jeu est disponible (${configDistante.majMin}).`; maj = true; cle = "maj" + configDistante.majMin;
  } else if (ConfigLib.annonceVisible(configDistante, Date.now())) {
    texte = configDistante.annonce.texte; cle = "annonce" + (configDistante.annonce.maj || 0) + texte;
  }
  let vue = ""; try { vue = localStorage.getItem(CLE_ANNONCE_VUE) || ""; } catch (e) {}
  const afficher = !!texte && (maj || vue !== cle);
  zone.hidden = !afficher;
  zone.dataset.cle = cle;
  document.getElementById("texteAnnonce").textContent = texte;
  document.getElementById("btnAnnonceMaj").hidden = !maj;
  document.getElementById("btnAnnonceFermer").hidden = maj; // (une mise à jour demandée ne se ferme pas)
}

function lireConfigDistante(){
  configLueLe = Date.now();
  attendreFirebase(() => {
    window.fbGet(window.fbRef(window.firebaseDB, "config")).then((s) => {
      configDistante = ConfigLib.valider(s.val());
      try { localStorage.setItem(CLE_CONFIG_DISTANTE, JSON.stringify(configDistante)); } catch (e) {}
      appliquerConfigDistante();
    }).catch(() => {}); // (pas de réseau ou règles Firebase pas encore à jour : on garde la dernière copie)
  });
}

document.getElementById("btnAnnonceFermer").addEventListener("click", () => {
  const zone = document.getElementById("annonceAccueil");
  try { localStorage.setItem(CLE_ANNONCE_VUE, zone.dataset.cle || ""); } catch (e) {}
  zone.hidden = true;
});
document.getElementById("btnAnnonceMaj").addEventListener("click", () => { location.reload(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - configLueLe > CONFIG_REFRAICHIR_APRES) lireConfigDistante();
});

appliquerConfigDistante();
lireConfigDistante();
// #endregion
