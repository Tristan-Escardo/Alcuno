document.addEventListener("DOMContentLoaded", function () {
  const plateau = document.getElementById("plateau");
  const joueurActif = document.getElementById("joueurActif");
  const listeJoueurs = document.getElementById("listeJoueurs");
  const regleZero = document.getElementById("regleZero");
  const reglePigeon = document.getElementById("reglePigeon");

  const menu = document.getElementById("menu");
  const suppression = document.getElementById("suppression");
  const listeSuppression = document.getElementById("listeSuppression");

  const nomJoueurInput = document.getElementById("nomJoueur");
  const btnAjouter = document.getElementById("ajouterJoueur");
  const btnJouer = document.getElementById("jouer");
  const btnSupprimer = document.getElementById("supprimerJoueur");
  const btnNouvellePartie = document.getElementById("nouvellePartie");
  const btnTermine = document.getElementById("termineSuppression");

  const classes = [
    "zero_vert","zero_jaune","zero_rouge","zero_bleu",

    "un_vert","un_vert1","un_jaune","un_jaune1","un_rouge","un_rouge1","un_bleu","un_bleu1",

    "deux_vert","deux_vert1","deux_jaune","deux_jaune1","deux_rouge","deux_rouge1","deux_bleu","deux_bleu1",

    "trois_vert","trois_vert1","trois_jaune","trois_jaune1","trois_rouge","trois_rouge1","trois_bleu","trois_bleu1",

    "quatre_vert","quatre_vert1","quatre_jaune","quatre_jaune1","quatre_rouge","quatre_rouge1","quatre_bleu","quatre_bleu1",

    "cinq_vert","cinq_vert1","cinq_jaune","cinq_jaune1","cinq_rouge","cinq_rouge1","cinq_bleu","cinq_bleu1",

    "six_vert","six_vert1","six_jaune","six_jaune1","six_rouge","six_rouge1","six_bleu","six_bleu1",

    "sept_vert","sept_vert1","sept_jaune","sept_jaune1","sept_rouge","sept_rouge1","sept_bleu","sept_bleu1",

    "huit_vert","huit_vert1","huit_jaune","huit_jaune1","huit_rouge","huit_rouge1","huit_bleu","huit_bleu1",

    "neuf_vert","neuf_vert1","neuf_jaune","neuf_jaune1","neuf_rouge","neuf_rouge1","neuf_bleu","neuf_bleu1",

    "interdit_vert","interdit_jaune","interdit_rouge","interdit_bleu",

    "couleur","couleur1","couleur2","couleur3",

    "plus_2_vert","plus_2_vert1","plus_2_jaune","plus_2_jaune1",
    "plus_2_rouge","plus_2_rouge1","plus_2_bleu","plus_2_bleu1",

    "plus_4","plus_4_1","plus_4_2","plus_4_3",

    "switch_vert","switch_jaune","switch_rouge","switch_bleu"
  ];

  /* ====== DUEL: cartes retirées du plateau principal ====== */
  const duelCartes = [
    "deux_vert","deux_vert1","deux_jaune","deux_jaune1","deux_rouge","deux_rouge1","deux_bleu","deux_bleu1",

    "cinq_vert","cinq_vert1","cinq_jaune","cinq_jaune1","cinq_rouge","cinq_rouge1","cinq_bleu","cinq_bleu1",

    "six_vert","six_vert1","six_jaune","six_jaune1","six_rouge","six_rouge1","six_bleu","six_bleu1",

    "sept_vert","sept_vert1","sept_jaune","sept_jaune1","sept_rouge","sept_rouge1","sept_bleu","sept_bleu1",

    "huit_vert","huit_vert1","huit_jaune","huit_jaune1","huit_rouge","huit_rouge1","huit_bleu","huit_bleu1",

    "neuf_vert","neuf_vert1","neuf_jaune","neuf_jaune1","neuf_rouge","neuf_rouge1","neuf_bleu","neuf_bleu1"
  ];

  let joueurs = [];
  let annulations = {}; // { "Alice": 3, "Bob": 0, ... }
  let paquet = [];

  let paquetDuel = [];
  let duelEnCours = false;
  let duelMultiplicateur = 1;

  let indexJoueur = 0;
  let partieLancee = false;

  let indexPigeon = null;
  let nomPigeonOriginal = "";
  let choixPigeonEnCours = false;

  let zeroEnCours = false;
  let switchEnCours = false;
  let sensHoraire = true;

  let couleurChoisie = null;

  let phase = 1;       // 1 = choix J1, 2 = choix J2
  let choixJ1 = null;  // 1 ou 2 (carte de gauche/droite)
  let lastCols = null;

  /* ===== OUTILS ===== */
  function centrerDerniereLigne(){
    const cards = Array.from(plateau.querySelectorAll(".Carte"));
    const total = cards.length;
    const cols = getCols();

    // reset (important sur resize)
    cards.forEach(c => c.style.gridColumnStart = "");

    const reste = total % cols;
    if(reste === 0) return;

    const start = Math.floor((cols - reste) / 2) + 1;
    const first = total - reste;

    // ⚠️ on décale TOUTES les cartes de la dernière ligne
    for(let i = 0; i < reste; i++){
      cards[first + i].style.gridColumnStart = String(start + i);
    }
  }

  
  function getCols(){
    const cols = getComputedStyle(document.documentElement)
      .getPropertyValue("--cols")
      .trim();
    return parseInt(cols, 10) || 8;
  }


  function melangerPaquet(array){
    for(let i=array.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [array[i],array[j]]=[array[j],array[i]];
    }
  }

  function resetPaquetDuelSiBesoin(){
    if(paquetDuel.length === 0){
      paquetDuel = [...duelCartes];
      melangerPaquet(paquetDuel);
    }
  }

  function valeurCarteDuel(c){
    if(c.startsWith("deux")) return 2;
    if(c.startsWith("cinq")) return 5;
    if(c.startsWith("six")) return 6;
    if(c.startsWith("sept")) return 7;
    if(c.startsWith("huit")) return 8;
    if(c.startsWith("neuf")) return 9;
    return 0;
  }

  function afficherJoueurs(){
    listeJoueurs.innerHTML = joueurs.map((j,i)=>{
      const n = Number(annulations[j] || 0);
      const bonus = n > 0 ? ` <span class="bonus-annulation">+${n}</span>` : "";

      // label pigeon (mais on garde le bonus)
      if(i === indexPigeon){
        return `<div><strong>PIGEON</strong> (${nomPigeonOriginal})${bonus}</div>`;
      }

      return `<div>${j}${bonus}</div>`;
    }).join("");

    if(!partieLancee){
      btnJouer.style.display = joueurs.length>0 ? "inline-block" : "none";
    }
  }


  function afficherJoueurActif(){
    if(!partieLancee || choixPigeonEnCours || duelEnCours){
      joueurActif.innerText = "";
      return;
    }
    joueurActif.innerText = "Joueur actif : " + joueurs[indexJoueur%joueurs.length];
  }

  function afficherMessagePigeon(msg){
    reglePigeon.innerText = msg;
    reglePigeon.style.display = "block";
  }

  function effacerMessagePigeon(){
    reglePigeon.innerText = "";
    reglePigeon.style.display = "none";
  }

  /* ===== JOUEURS ===== */
  function ajouterJoueur(){
    const nom = nomJoueurInput.value.trim();
    if(!nom) return;
    joueurs.push(nom);
    if(annulations[nom] == null) annulations[nom] = 0;
    nomJoueurInput.value = "";
    afficherJoueurs();
  }

  btnAjouter.addEventListener("click", ajouterJoueur);
  nomJoueurInput.addEventListener("keydown", e=>{ if(e.key==="Enter") ajouterJoueur(); });

  btnSupprimer.addEventListener("click", ()=>{
    menu.style.display="none";
    suppression.style.display="flex";
    listeSuppression.innerHTML="";
    joueurs.forEach((j,i)=>{
      const ligne=document.createElement("div");
      ligne.innerHTML=`<input type="checkbox" value="${i}"> <label>${j}</label>`;
      listeSuppression.appendChild(ligne);
    });
  });

  btnTermine.addEventListener("click", ()=>{
    const toDelete=[...listeSuppression.querySelectorAll("input:checked")]
      .map(cb=>parseInt(cb.value,10)).sort((a,b)=>b-a);
    toDelete.forEach(i=>{
      const name = joueurs[i];
      joueurs.splice(i,1);
      if(name != null) delete annulations[name];
    });
    suppression.style.display="none";
    menu.style.display="flex";
    afficherJoueurs();
  });

  /* ===== PIGEON OVERLAY ===== */
  function afficherMenuPigeon(){
    if(document.getElementById("overlayPigeon")) return;
    choixPigeonEnCours=true;

    const overlay=document.createElement("div");
    overlay.id="overlayPigeon";

    const titre=document.createElement("div");
    titre.className="titre-pigeon";
    titre.innerText="Choisis le nouveau pigeon";
    overlay.appendChild(titre);

    joueurs.forEach((j,i)=>{
      if(i!==indexPigeon){
        const btn=document.createElement("button");
        btn.className="bouton-pigeon";
        btn.innerText=j;
        btn.addEventListener("click",()=>{
          indexPigeon=i;
          nomPigeonOriginal=joueurs[i];
          overlay.remove();
          choixPigeonEnCours=false;
          afficherJoueurs();
          afficherJoueurActif();
        });
        overlay.appendChild(btn);
      }
    });

    document.body.appendChild(overlay);
  }

  function dureeOverlaySelonNbLignes(nb){
    // 1 ligne = 1500ms, puis +900ms par ligne supplémentaire
    return 1500 + Math.max(0, nb - 1) * 900;
  }

  /* ===== Overlay animé pour toutes les cartes spéciales ===== */
  let overlayRegleTimeout = null;
  // ===== Annulation de gorgées (carte "un") =====
  let overlayRegleVerrouille = false; // si true => overlayRegleUnique ne s'auto-ferme pas

  function fermerOverlayRegleUnique(){
    const overlay = document.getElementById("overlayRegleUnique");
    if(!overlay) return;

    overlayRegleVerrouille = false;

    // stop timer éventuel
    if (overlayRegleTimeout) {
      clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = null;
    }

    overlay.style.opacity = "0";
    overlay.style.transform = "scale(0.8)";
    overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
  }

  // Ajoute (ou remplace) l'UI de choix d'annulation dans l'overlay existant.
  // - joueurIndex : index dans joueurs[]
  // - nbGorgees : combien il devrait boire au départ
  // - onDone(annule, reste) : callback une fois le choix fait
  function injecterChoixAnnulationDansOverlay(joueurIndex, nbGorgees, onDone){
    const overlay = document.getElementById("overlayRegleUnique");
    if(!overlay) return false;

    const nom = joueurs[joueurIndex];
    const dispo = Number(annulations[nom] || 0);
    const maxAnnulable = Math.min(dispo, nbGorgees);

    if(maxAnnulable <= 0) return false;

    // On verrouille l'overlay => pas d'auto-close tant que pas de choix
    overlayRegleVerrouille = true;

    // On stoppe le timer de fermeture si déjà lancé
    if (overlayRegleTimeout) {
      clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = null;
    }

    // Supprime un ancien bloc d'annulation si présent (au cas où)
    const old = overlay.querySelector(".bloc-annulation");
    if(old) old.remove();

    const bloc = document.createElement("div");
    bloc.className = "bloc-annulation";

    const titre = document.createElement("div");
    titre.className = "titre-annulation";
    titre.innerText = `${nom}, tu as +${dispo} annulation(s). Combien tu en utilises ?`;
    bloc.appendChild(titre);

    const boutons = document.createElement("div");
    boutons.className = "ligne-boutons-annulation";

    // Boutons: 0..maxAnnulable (pas d'invention : 1 bouton par valeur possible)
    for(let i=0; i<=maxAnnulable; i++){
      const btn = document.createElement("button");
      btn.className = "bouton-annulation";
      btn.innerText = `Annuler ${i}`;

      btn.addEventListener("click", () => {
        const utilise = i;
        const reste = nbGorgees - utilise;

        annulations[nom] = Math.max(0, dispo - utilise);
        afficherJoueurs();

        // Enlève le bloc boutons (choix fait)
        bloc.remove();

        // Ajoute une ligne résultat dans l'overlay
        const boxTexte = overlay.querySelector(".overlay-regle-texte");
        if(boxTexte){
          const ligne = document.createElement("div");
          ligne.style.marginTop = "10px";
          ligne.innerText =
            utilise > 0
              ? `✅ Annulé ${utilise}. Tu bois ${reste} gorgée(s).`
              : `➡️ Tu n’annules rien. Tu bois ${reste} gorgée(s).`;
          boxTexte.appendChild(ligne);
        }

        // Déverrouille et ferme après un court délai (le temps de lire)
        overlayRegleVerrouille = false;

        // petite pause de lecture, puis fermeture
        setTimeout(() => {
          fermerOverlayRegleUnique();
        }, 900);

        if(typeof onDone === "function") onDone(utilise, reste);
      });

      boutons.appendChild(btn);
    }

    bloc.appendChild(boutons);
    overlay.appendChild(bloc);

    return true;
  }

  // Helper : annonce "X boit N" + propose annulation si dispo
  function annoncerBoireAvecAnnulation(joueurIndex, nbGorgees, classeCarte = "", prefixMsg = null){
    const nom = joueurs[joueurIndex];
    const msg = prefixMsg ? prefixMsg : `${nom} boit ${nbGorgees} gorgée(s)`;

    // On affiche l'overlay (ou on ajoute une ligne si déjà là)
    montrerOverlayRegle(msg, classeCarte);

    // On tente d'injecter le choix d'annulation DANS le même overlay
    const ok = injecterChoixAnnulationDansOverlay(joueurIndex, nbGorgees, (annule, reste) => {
      // Met à jour le message persistant (bloc règles) avec le résultat final
      regleZero.innerText = `${nom} boit ${reste} gorgée(s)`;
      regleZero.style.display = "block";
      zeroEnCours = true;
    });

    // Si pas d'annulation possible => message persistant normal
    if(!ok){
      regleZero.innerText = msg;
      regleZero.style.display = "block";
      zeroEnCours = true;
    }
  }


  function montrerOverlayRegle(message, classeCarte = "", classeCarteSupplementaire = "") {
    // 1) Si un overlay existe déjà, on ajoute un message dessous
    let overlay = document.getElementById("overlayRegleUnique");
    if (overlay) {
      const boxTexteExist = overlay.querySelector(".overlay-regle-texte");
      if (boxTexteExist) {
        const ligne = document.createElement("div");
        ligne.innerText = message;
        ligne.style.marginTop = "10px";
        boxTexteExist.appendChild(ligne);

        const nbLignes = boxTexteExist.children.length;
        const duree = dureeOverlaySelonNbLignes(nbLignes);

        // On relance le timer de fermeture (sauf si overlay verrouillé)
        if (!overlayRegleVerrouille) {
          if (overlayRegleTimeout) clearTimeout(overlayRegleTimeout);
          overlayRegleTimeout = setTimeout(() => {
            overlay.style.opacity = "0";
            overlay.style.transform = "scale(0.8)";
            overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
          }, duree);
        }
      }
      return;
    }

    // 2) Sinon, on crée l’overlay normal (une seule fois)
    overlay = document.createElement("div");
    overlay.id = "overlayRegleUnique";
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.7)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "9999";
    overlay.style.color = "#FFD700";
    overlay.style.fontSize = "36px";
    overlay.style.fontWeight = "bold";
    overlay.style.textAlign = "center";
    overlay.style.padding = "20px";
    overlay.style.borderRadius = "20px";
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.3s ease, transform 0.3s ease";

    // Cartes (si tu utilises cette partie)
    const cartes = document.createElement("div");
    cartes.style.display = "flex";
    cartes.style.gap = "30px";
    cartes.style.marginBottom = "20px";

    if (classeCarte) {
      const carte1 = document.createElement("div");
      carte1.className = "Carte " + classeCarte;
      cartes.appendChild(carte1);
    }

    if (classeCarteSupplementaire) {
      const carte2 = document.createElement("div");
      carte2.className = "Carte " + classeCarteSupplementaire;
      cartes.appendChild(carte2);
    }

    if (cartes.children.length > 0) overlay.appendChild(cartes);

    // Texte (container pour empiler les messages)
    const boxTexte = document.createElement("div");
    boxTexte.className = "overlay-regle-texte";

    const ligne1 = document.createElement("div");
    ligne1.innerText = message;
    boxTexte.appendChild(ligne1);

    overlay.appendChild(boxTexte);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1.05)";
    });

    const nbLignes = boxTexte.children.length;
    const duree = dureeOverlaySelonNbLignes(nbLignes);

    // Auto-close seulement si pas verrouillé
    if (!overlayRegleVerrouille) {
      if (overlayRegleTimeout) clearTimeout(overlayRegleTimeout);
      overlayRegleTimeout = setTimeout(() => {
        overlay.style.opacity = "0";
        overlay.style.transform = "scale(0.8)";
        overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
      }, duree);
    }
  }

   

  /* ===== Règles centralisées ===== */
  const reglesBoire = {
    "zero": "Tout le monde boit 1 gorgée sauf toi",
    "plus_2": "Bois 2 gorgées",
    "plus_4": "Distribue 4 gorgées (tu peux les partager)",
    "interdit": "SOCIAAALE ! Tout le monde boit 1 gorgée"
  };

  function afficherOverlayCouleur(){
    if(document.getElementById("overlayCouleur")) return;
    choixPigeonEnCours = true;

    const overlay = document.createElement("div");
    overlay.id = "overlayCouleur";

    const titre = document.createElement("div");
    titre.className = "titre-couleur";
    titre.innerText = "Choisis une couleur";
    overlay.appendChild(titre);

    const container = document.createElement("div");
    container.className = "container-couleurs";

    const couleurs = [
      { nom: "vert", classe: "carre-vert" },
      { nom: "jaune", classe: "carre-jaune" },
      { nom: "rouge", classe: "carre-rouge" },
      { nom: "bleu", classe: "carre-bleu" }
    ];

    couleurs.forEach(c=>{
      const carre = document.createElement("div");
      carre.className = "carre-couleur " + c.classe;
      carre.addEventListener("click", ()=>{
        couleurChoisie = c.nom;
        overlay.remove();
        choixPigeonEnCours = false;
        afficherJoueurActif();
      });
      container.appendChild(carre);
    });

    overlay.appendChild(container);
    document.body.appendChild(overlay);
  }

  /* ===== DUEL : Choix joueurs puis tirage ===== */
  function lancerOverlayChoixDuel(){
    if(document.getElementById("overlayDuel")) return;
    duelEnCours = true;
    choixPigeonEnCours = true;
    duelMultiplicateur = 1;

    const overlay = document.createElement("div");
    overlay.id = "overlayDuel";

    const titre = document.createElement("div");
    titre.className = "titre-pigeon";
    titre.innerText = "DUEL ! Choisis 2 joueurs";
    overlay.appendChild(titre);

    const containerBoutons = document.createElement("div");
    containerBoutons.style.display = "flex";
    containerBoutons.style.flexWrap = "wrap";
    containerBoutons.style.justifyContent = "center";
    containerBoutons.style.gap = "20px";
    overlay.appendChild(containerBoutons);

    let picks = [];

    joueurs.forEach((nom, idx)=>{
      const btn = document.createElement("button");
      btn.className = "bouton-pigeon";
      btn.innerText = nom;

      btn.addEventListener("click", ()=>{
        if(picks.length >= 2) return;

        picks.push(idx);
        btn.style.backgroundColor = "#ffea70";
        btn.style.color = "#000";

        if(picks.length === 2){
          overlay.innerHTML = "";
          afficherOverlayTirageDuel(overlay, picks[0], picks[1]);
        }
      });

      containerBoutons.appendChild(btn);
    });

    document.body.appendChild(overlay);
  }

  function afficherOverlayTirageDuel(overlay, j1, j2){
    const titre = document.createElement("div");
    titre.className = "titre-pigeon";
    titre.innerText = "DUEL";
    overlay.appendChild(titre);

    const info = document.createElement("div");
    info.style.color = "#FFD700";
    info.style.fontSize = "28px";
    info.style.fontWeight = "bold";
    info.style.textAlign = "center";
    info.style.marginBottom = "16px";
    overlay.appendChild(info);

    const containerCartes = document.createElement("div");
    containerCartes.style.display = "flex";
    containerCartes.style.gap = "40px";
    containerCartes.style.justifyContent = "center";
    containerCartes.style.alignItems = "center";
    overlay.appendChild(containerCartes);

    const c1 = document.createElement("div");
    c1.className = "Carte";
    containerCartes.appendChild(c1);

    const c2 = document.createElement("div");
    c2.className = "Carte";
    containerCartes.appendChild(c2);

    // Labels sous les cartes (optionnel mais clair)
    const labels = document.createElement("div");
    labels.style.display = "flex";
    labels.style.gap = "40px";
    labels.style.justifyContent = "center";
    labels.style.alignItems = "center";
    labels.style.marginTop = "12px";
    overlay.appendChild(labels);

    const label1 = document.createElement("div");
    label1.style.width = "150px";
    label1.style.textAlign = "center";
    label1.style.color = "#FFD700";
    label1.style.fontSize = "18px";
    label1.style.fontWeight = "700";
    labels.appendChild(label1);

    const label2 = document.createElement("div");
    label2.style.width = "150px";
    label2.style.textAlign = "center";
    label2.style.color = "#FFD700";
    label2.style.fontSize = "18px";
    label2.style.fontWeight = "700";
    labels.appendChild(label2);

    let carteA = null;
    let carteB = null;
    let selectionFaite = false;

    function tirerUneCarte(){
      resetPaquetDuelSiBesoin();
      return paquetDuel.shift();
    }

    // 1) On prépare le duel : les 2 cartes sont "en main" mais restent de dos à l'écran
    function preparerDuel(){
      phase = 1;
      choixJ1 = null;
      info.innerText = joueurs[j1] + " : choisis une carte";

      selectionFaite = false;

      // Reset visuel : cartes de dos (classe Carte uniquement)
      c1.className = "Carte";
      c2.className = "Carte";
      c1.style.boxShadow = "";
      c2.style.boxShadow = "";
      c1.style.opacity = "1";
      c2.style.opacity = "1";
      c1.style.pointerEvents = "auto";
      c2.style.pointerEvents = "auto";

      label1.innerText = "";
      label2.innerText = "";

      // On pioche 2 cartes, mais on NE les affiche PAS encore (donc dos)
      carteA = tirerUneCarte();
      carteB = tirerUneCarte();

      info.innerText = joueurs[j1] + " : choisis une carte";
    }

    function resoudreDuel(carteJ1, carteJ2){
      const v1 = valeurCarteDuel(carteJ1);
      const v2 = valeurCarteDuel(carteJ2);

      if(v1 === v2){
        duelMultiplicateur *= 2;
        // petite pause puis on relance un duel (toujours dos au départ)
        setTimeout(() => {
          preparerDuel();
        }, 1400);
        return;
      }

      const perdant = (v1 < v2) ? j1 : j2;
      const vPerdant = (v1 < v2) ? v1 : v2;
      const gorg = vPerdant * duelMultiplicateur;
      const msg = joueurs[perdant] + " boit " + gorg + " gorgées";

       // 1) on enlève l’overlay du duel (après un mini délai pour lire le reveal)
      setTimeout(() => {
        overlay.remove();
        annoncerBoireAvecAnnulation(perdant, gorg, "", msg);

        // Puis on restaure l'état du jeu (sans attendre la fin d'overlay ici)
        setTimeout(() => {
          duelEnCours = false;
          choixPigeonEnCours = false;
          duelMultiplicateur = 1;
          afficherJoueurActif();
        }, 1000);
      }, 1000);
    }

    function onChoose(which){
      // Phase 1 : J1 choisit
      if(phase === 1){
        choixJ1 = which;
        phase = 2;

        // feedback visuel : on "marque" le choix de J1
        if(which === 1){
          c1.style.boxShadow = "0 0 25px #FFD700";
          c1.style.pointerEvents = "none";
          c2.style.pointerEvents = "auto";
        } else {
          c2.style.boxShadow = "0 0 25px #FFD700";
          c2.style.pointerEvents = "none";
          c1.style.pointerEvents = "auto";
        }

        label1.innerText = "";
        label2.innerText = "";
        info.innerText = joueurs[j2] + " : clique sur la carte restante";
        return;
      }

      // Phase 2 : J2 doit cliquer la carte restante uniquement
      if(phase === 2){
        // sécurité : si J2 clique la même que J1 (normalement impossible)
        if(which === choixJ1) return;

        phase = 3; // terminé
        c1.style.pointerEvents = "none";
        c2.style.pointerEvents = "none";

        // Attribution réelle des cartes
        const carteJ1 = (choixJ1 === 1) ? carteA : carteB;
        const carteJ2 = (choixJ1 === 1) ? carteB : carteA;

        info.innerText = "On retourne les cartes…";

        // Reveal des 2 cartes (on ajoute les classes maintenant)
        setTimeout(() => {
          // enlever le halo dès qu'on retourne les cartes
          c1.style.boxShadow = "";
          c2.style.boxShadow = "";

          c1.className = "Carte";
          c2.className = "Carte";

          // La gauche montre carteA, la droite montre carteB (positions fixes)
          c1.classList.add(carteA);
          c2.classList.add(carteB);

          // Labels clairs : qui a quoi
          if(choixJ1 === 1){
            label1.innerText = "Carte de " + joueurs[j1];
            label2.innerText = "Carte de " + joueurs[j2];
          } else {
            label1.innerText = "Carte de " + joueurs[j2];
            label2.innerText = "Carte de " + joueurs[j1];
          }

          info.innerText = "Résultat…";
          resoudreDuel(carteJ1, carteJ2);
        }, 1400);
      }
    }


    c1.addEventListener("click", () => onChoose(1));
    c2.addEventListener("click", () => onChoose(2));

    preparerDuel();
  }

  function couleurDeLaCarte(classeCarte){
    // Ex: "un_vert1" => "vert", "interdit_rouge" => "rouge"
    const m = classeCarte.match(/_(vert|jaune|rouge|bleu)/);
    return m ? m[1] : null;
  }

  /* ===== Application des règles ===== */
  function appliquerRegle(carteTiree, joueurActuel, carteElement){
    if(zeroEnCours || switchEnCours){
      regleZero.style.display="none";
      zeroEnCours=false;
      switchEnCours=false;
    }

    effacerMessagePigeon();

    // Cartes "boire"
    // Cas spécial: plus_2 => le joueur actuel boit 2 (annulable)
    if (carteTiree.startsWith("plus_2")) {
      annoncerBoireAvecAnnulation(
        joueurActuel,
        2,
        carteTiree,
        `${joueurs[joueurActuel]} boit 2 gorgée(s)`
      );
      return; // important : on évite le traitement générique en dessous
    }
    // Autres règles génériques de "boire"
    for (const key in reglesBoire) {
      if (key === "plus_2") continue; // sécurité (au cas où)
      if (carteTiree.startsWith(key)) {
        const msg = reglesBoire[key];
        regleZero.innerText = msg;
        regleZero.style.display = "block";
        zeroEnCours = true;
        montrerOverlayRegle(msg, carteTiree);
        return; // une seule règle "boire" à appliquer
      }
    }


    // Cartes "un" => +1 annulation de gorgée
    if(carteTiree.startsWith("un")){
      const msg = "+1 annulation de gorgée !";
      montrerOverlayRegle(msg, carteTiree);
      // puis message persistant jusqu'au prochain tirage (géré par zeroEnCours)
      regleZero.innerText = msg;
      regleZero.style.display = "block";
      zeroEnCours = true;

      // +1 permanent à côté du nom du joueur
      const nom = joueurs[joueurActuel];
      annulations[nom] = Number(annulations[nom] || 0) + 1;
      afficherJoueurs();

      // la carte reste visible 6s puis devient "trou"
      if(carteElement){
        setTimeout(() => {
          carteElement.classList.add("carte-disparue");
        }, 2000);
      }
    }


    // Cartes "switch"
    if(carteTiree.startsWith("switch")){
      sensHoraire = !sensHoraire;
      const msg = "Sens du jeu inversé";
      regleZero.innerText = msg;
      regleZero.style.display = "block";
      switchEnCours = true;
      montrerOverlayRegle("Le sens du jeu est inversé !", carteTiree);
    }

    // Cartes "trois/pigeon"
    if(carteTiree.startsWith("trois")){
      if(indexPigeon===null){
        indexPigeon=joueurActuel;
        nomPigeonOriginal=joueurs[joueurActuel];
        // montrerOverlayRegle("Tu es pigeon ! Bois 2 gorgées.", carteTiree);
        annoncerBoireAvecAnnulation(joueurActuel, 2, carteTiree, `Tu es pigeon ! ${joueurs[joueurActuel]} boit 2 gorgée(s)`);

        afficherMessagePigeon(
          "Tu es pigeon ! Boit 2 gorgées. À chaque 3 tiré, tu bois 1 gorgée. Pour sortir, tire un 3."
        );
      } else if(indexPigeon===joueurActuel){
        afficherMenuPigeon();
      } else {
        montrerOverlayRegle("Le pigeon boit 1 gorgée", carteTiree);
        afficherMessagePigeon("Le pigeon boit 1 gorgée");
      }
    }

    // Cartes "couleur"
    if(carteTiree.startsWith("couleur")){
      afficherOverlayCouleur();
    }

    // Cartes "quatre" => duel
    if(carteTiree.startsWith("quatre")){
      lancerOverlayChoixDuel();
    }

    // - ne s'applique PAS à plus_2 / plus_4 / couleur
    // - ne se déclenche QUE quand la carte tirée est de la couleur choisie
    if(couleurChoisie){
      const estExclue =
        carteTiree.startsWith("plus_4") ||
        carteTiree.startsWith("couleur");

      if(!estExclue){
        const colCarte = couleurDeLaCarte(carteTiree);

        if(colCarte && colCarte === couleurChoisie){
          const msgCouleur = "Et boit 1 gorgée pour la couleur (" + couleurChoisie + ") !";

          // ✅ annulable via les "UN" (même overlay, pas de superposition)
          annoncerBoireAvecAnnulation(joueurActuel, 1, carteTiree, msgCouleur);

          // la couleur "attendue" est tombée => on reset
          couleurChoisie = null;
        }
      }
    }
    
  }

  /* ===== JEU ===== */
  function lancerPartie(){
    if(joueurs.length < 2){
      alert("Il faut au moins 2 joueurs");
      return;
    }

    plateau.innerHTML = "";

    // Plateau principal = toutes les cartes SAUF 2/5/6/7/8/9 (paquet duel)
    const paquetPrincipal = classes.filter(c => !duelCartes.includes(c));
    paquet = [...paquetPrincipal];
    melangerPaquet(paquet);

    // Paquet duel (réutilisable à l'infini via resetPaquetDuelSiBesoin)
    paquetDuel = [...duelCartes];
    melangerPaquet(paquetDuel);

    indexJoueur = 0;
    partieLancee = true;
    zeroEnCours = false;
    switchEnCours = false;
    sensHoraire = true;
    couleurChoisie = null;

    duelEnCours = false;
    duelMultiplicateur = 1;

    btnNouvellePartie.style.display = "inline-block";
    btnSupprimer.style.display = "none";
    btnJouer.style.display = "none";

    regleZero.style.display = "none";
    effacerMessagePigeon();
    afficherJoueurActif();

    for(let i=0;i<paquet.length;i++){
      const carte = document.createElement("div");
      carte.classList.add("Carte");

      carte.addEventListener("click", ()=>{
        // Plateau bloqué pendant overlays pigeon/couleur/duel
        if(choixPigeonEnCours || duelEnCours) return;
        if(carte.classList.contains("retournee")) return;
        if(joueurs.length === 0) return;

        const carteTiree = paquet.shift();
        if(!carteTiree) return;

        carte.classList.add(carteTiree, "retournee");

        const joueurActuel = indexJoueur % joueurs.length;
        appliquerRegle(carteTiree, joueurActuel, carte);

        indexJoueur = (indexJoueur + (sensHoraire ? 1 : -1) + joueurs.length) % joueurs.length;

        afficherJoueurActif();
        afficherJoueurs();
      });

      plateau.appendChild(carte);
    }
    
    centrerDerniereLigne();
  }

  function retourMenu(){
    partieLancee = false;
    paquet = [];
    paquetDuel = [];

    indexJoueur = 0;

    indexPigeon = null;
    nomPigeonOriginal = "";
    choixPigeonEnCours = false;

    zeroEnCours = false;
    switchEnCours = false;
    sensHoraire = true;

    couleurChoisie = null;

    duelEnCours = false;
    duelMultiplicateur = 1;

    plateau.innerHTML = "";

    regleZero.style.display = "none";
    effacerMessagePigeon();
    joueurActif.innerText = "";

    const overlayPigeon = document.getElementById("overlayPigeon");
    if(overlayPigeon) overlayPigeon.remove();

    const overlayCouleur = document.getElementById("overlayCouleur");
    if(overlayCouleur) overlayCouleur.remove();

    const overlayDuel = document.getElementById("overlayDuel");
    if(overlayDuel) overlayDuel.remove();

    btnNouvellePartie.style.display = "none";
    btnSupprimer.style.display = "inline-block";
    btnJouer.style.display = joueurs.length>0 ? "inline-block" : "none";
    menu.style.display = "flex";

    afficherJoueurs();
  }

  btnJouer.addEventListener("click", lancerPartie);
  btnNouvellePartie.addEventListener("click", retourMenu);

  /* ===== INIT ===== */
  afficherJoueurs();
  window.addEventListener("resize", () => {
    centrerDerniereLigne();
  });
});