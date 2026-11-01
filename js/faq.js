// ===== Questions fréquentes (FAQ) =====
// S'ouvre dans l'écran des Règles (comme l'album : mêmes blocs, donc les mêmes couleurs dans chaque thème), depuis
// Réglages › « Aide et questions fréquentes » ou le bouton « Questions fréquentes » en haut des Règles.
// Les images (dossier faq/) sont des captures du jeu avec la zone à toucher entourée ; elles ne se chargent qu'à l'ouverture
// d'une question, pour ne pas ralentir le démarrage. Petit HTML écrit ici (rien qui vient d'un joueur).
const QUESTIONS_FAQ = [
  { titre: "Jouer", questions: [
    { q: "Comment lancer une partie ?", image: "faq/accueil.webp", alt: "Accueil du jeu : le bouton Mode classique est entouré",
      r: ["Touche <b>Mode classique</b> : tout le monde joue sur <b>un seul téléphone</b>, même sans réseau.",
          "Ajoute les prénoms des joueurs, puis touche <b>Jouer</b>.",
          "Chacun son tour retourne une carte et applique sa règle (voir le livre 📖 en haut à gauche)."] },
    { q: "Comment mettre quelqu'un en pause ?", image: "faq/pause.webp", alt: "Barre du joueur actif : le petit bouton pause est entouré",
      r: ["Touche le petit bouton <b>pause</b> ⏸ à côté du nom du joueur (toilettes, clope, appel…).",
          "Pendant sa pause, on le saute. S'il revient avant qu'une carte soit retournée, il récupère son tour.",
          "Touche ▶ pour le remettre en jeu."] },
    { q: "Comment débloquer les thèmes et les stickers ?", r: [
          "Les thèmes sont dans <b>Réglages › Thèmes</b>. Certains se débloquent en jouant.",
          "Pour le thème Kawaii : collectionne les stickers de l'album (une étoile filante apparaît de temps en temps, et l'album se découvre en tapant 3 fois sur la barre arc-en-ciel sous le titre)."] }
  ]},
  { titre: "En ligne et télé", questions: [
    { q: "Comment jouer en ligne avec des amis ?", image: "faq/enligne.webp", alt: "Écran du mode en ligne : Créer une partie et Rejoindre une partie sont entourés",
      r: ["Touche <b>Mode en ligne</b>. Une personne choisit <b>Créer une partie</b> et reçoit un <b>code</b> (et un QR code).",
          "Les autres touchent <b>Rejoindre une partie</b> et entrent le code, ou scannent le QR code.",
          "Chacun joue sur son téléphone. Déconnecté ? Entre le code dans « Revenir dans une partie » pour reprendre ta place."] },
    { q: "Comment afficher la partie sur la télé ?", image: "faq/tele.webp", alt: "Réglages : la ligne Afficher l'écran télé est entourée",
      r: ["Sur la télé, ouvre le navigateur et va sur l'adresse du jeu. Sur la plupart des télés, l'<b>écran télé</b> s'ouvre tout seul.",
          "Sinon : <b>Réglages › Afficher l'écran télé</b>, sur la télé.",
          "Sur ton téléphone, touche l'icône de diffusion à côté de « Nouvelle partie » et entre le code affiché sur la télé."] }
  ]},
  { titre: "Appli et problèmes", questions: [
    { q: "Comment installer l'appli sur mon téléphone ?", image: "faq/installer.webp", alt: "Écran Installer Alcuno avec les 3 étapes",
      r: ["<b>iPhone</b> : dans Safari, touche <b>Partager</b>, puis <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.",
          "<b>Android</b> : touche le menu ⋮ du navigateur, puis <b>Installer l'application</b> (ou <b>Ajouter à l'écran d'accueil</b>).",
          "Le bouton <b>Installer l'appli</b> en bas de l'accueil rouvre cet écran. Une fois installé, le mode classique marche sans réseau."] },
    { q: "Le jeu ne se met pas à jour ou plante", r: [
          "Ferme complètement l'appli, puis rouvre-la : une nouvelle version se charge en général toute seule.",
          "Si ça continue : <b>Réglages › Signaler un bug</b>, ou « Copier le diagnostic » pour l'envoyer."] }
  ]}
];

function ouvrirFaq(){
  jouerSon("regles");
  const page = ecranRegles;
  page.classList.remove("album");
  page.classList.add("faq");
  page.querySelector("h2").textContent = "Questions fréquentes";
  const liste = document.getElementById("listeRegles");
  liste.innerHTML = "";
  QUESTIONS_FAQ.forEach((partie) => {
    const bloc = document.createElement("div");
    bloc.className = "blocRegles blocFaq";
    const titre = document.createElement("h3");
    titre.textContent = partie.titre;
    bloc.appendChild(titre);
    partie.questions.forEach((item) => {
      const d = document.createElement("details");
      d.className = "faqItem";
      const s = document.createElement("summary");
      s.className = "nomRegle faqQuestion";
      s.textContent = item.q;
      const rep = document.createElement("div");
      rep.className = "detailRegle faqReponse";
      rep.innerHTML = htmlRegle(item.r);
      d.append(s, rep);
      if (item.image) {
        // chargée à la première ouverture de la question seulement
        d.addEventListener("toggle", () => {
          if (!d.open || rep.querySelector("img")) return;
          const img = document.createElement("img");
          img.className = "faqImage";
          img.src = item.image;
          img.alt = item.alt || "";
          img.loading = "lazy";
          img.decoding = "async";
          rep.appendChild(img);
        });
      }
      bloc.appendChild(d);
    });
    liste.appendChild(bloc);
  });
  page.scrollTop = 0;
  choixDejaEnAttente = new Set(choixEnAttentePourMoi());
  if (page.style.display === "none" || page.classList.contains("page-sortie")) ouvrirPage(page);
}

document.getElementById("btnFaq").addEventListener("click", ouvrirFaq);
document.getElementById("btnFaqDepuisRegles").addEventListener("click", ouvrirFaq);
