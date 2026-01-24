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

  let joueurs = [];
  let paquet = [];
  let indexJoueur = 0;
  let partieLancee = false;
  let indexPigeon = null;
  let nomPigeonOriginal = "";
  let choixPigeonEnCours = false;
  let zeroEnCours = false;
  let switchEnCours = false;
  let sensHoraire = true; 
  let couleurChoisie = null; // couleur choisie pour la règle couleur

  /* ===== OUTILS ===== */
  function melangerPaquet(array){
    for(let i=array.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [array[i],array[j]]=[array[j],array[i]];
    }
  }

  function afficherJoueurs(){
    listeJoueurs.innerHTML = joueurs.map((j,i)=>{
      if(i===indexPigeon) return `<div><strong>PIGEON</strong> (${nomPigeonOriginal})</div>`;
      return `<div>${j}</div>`;
    }).join("");
    if(!partieLancee){
      btnJouer.style.display=joueurs.length>0?"inline-block":"none";
    }
  }

  function afficherJoueurActif(){
    if(!partieLancee || choixPigeonEnCours){
      joueurActif.innerText="";
      return;
    }
    joueurActif.innerText="Joueur actif : "+joueurs[indexJoueur%joueurs.length];
  }

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

  function afficherMessagePigeon(msg){
    reglePigeon.innerText=msg;
    reglePigeon.style.display="block";
  }

  function effacerMessagePigeon(){
    reglePigeon.innerText="";
    reglePigeon.style.display="none";
  }

  /* ===== JOUEURS ===== */
  function ajouterJoueur(){
    const nom=nomJoueurInput.value.trim();
    if(!nom) return;
    joueurs.push(nom);
    nomJoueurInput.value="";
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
      .map(cb=>parseInt(cb.value)).sort((a,b)=>b-a);
    toDelete.forEach(i=>joueurs.splice(i,1));
    suppression.style.display="none";
    menu.style.display="flex";
    afficherJoueurs();
  });

  /* ===== Overlay animé pour toutes les cartes spéciales ===== */
  function montrerOverlayRegle(message, classeCarte="", classeCarteSupplementaire="") {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
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

    const imagesContainer = document.createElement("div");
    imagesContainer.style.display = "flex";
    imagesContainer.style.gap = "20px";
    imagesContainer.style.marginBottom = "20px";

    if(classeCarte){
      const miniCarte = document.createElement("div");
      miniCarte.classList.add("Carte", classeCarte);
      miniCarte.style.width = "150px";
      miniCarte.style.height = "220px";
      miniCarte.style.boxShadow = "0 0 15px #FFD700";
      imagesContainer.appendChild(miniCarte);
    }

    if(classeCarteSupplementaire){
      const miniCarte2 = document.createElement("div");
      miniCarte2.classList.add("Carte", classeCarteSupplementaire);
      miniCarte2.style.width = "150px";
      miniCarte2.style.height = "220px";
      miniCarte2.style.boxShadow = "0 0 15px #FFD700";
      imagesContainer.appendChild(miniCarte2);
    }

    if(classeCarte || classeCarteSupplementaire){
      overlay.appendChild(imagesContainer);
    }

    const texte = document.createElement("div");
    texte.innerText = message;
    overlay.appendChild(texte);

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      overlay.style.transform = "scale(1.05)";
    });

    setTimeout(() => {
      overlay.style.opacity = "0";
      overlay.style.transform = "scale(0.8)";
      overlay.addEventListener("transitionend", () => overlay.remove(), {once: true});
    }, 1500);
  }

  /* ===== Règles centralisées ===== */
  const reglesBoire = {
    "zero": "Tout le monde boit 1 gorgée sauf toi",
    "plus_2": "Bois 2 gorgées",
    "plus_4": "Distribue 4 gorgées (tu peux les partager)",
    "interdit": "SOCIAAALE ! Tout le monde boit 1 gorgée"
  };

  function appliquerRegle(carteTiree, joueurActuel){
    if(zeroEnCours || switchEnCours){
      regleZero.style.display="none";
      zeroEnCours=false;
      switchEnCours=false;
    }

    effacerMessagePigeon();
    let messageCarte = "";

    // Cartes "boire"
    for(const key in reglesBoire){
      if(carteTiree.startsWith(key)){
        messageCarte = reglesBoire[key];
        regleZero.innerText = messageCarte;
        regleZero.style.display = "block";
        zeroEnCours = true;
        montrerOverlayRegle(messageCarte, carteTiree);
      }
    }

    // Cartes "switch"
    if(carteTiree.startsWith("switch")){
      sensHoraire = !sensHoraire;
      messageCarte = "Sens du jeu inversé";
      regleZero.innerText = messageCarte;
      regleZero.style.display = "block";
      switchEnCours = true;
      montrerOverlayRegle("Le sens du jeu est inversé !", carteTiree);
    }

    // Cartes "trois/pigeon"
    if(carteTiree.startsWith("trois")){
      if(indexPigeon===null){
        indexPigeon=joueurActuel;
        nomPigeonOriginal=joueurs[joueurActuel];
        montrerOverlayRegle("Tu es pigeon ! Bois 2 gorgées.", carteTiree);
        afficherMessagePigeon(
          "Tu es pigeon ! Bois 2 gorgées. À chaque 3 tiré, tu bois 1 gorgée. Pour sortir, tire un 3."
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

    // FIX COULEUR : application correcte
    if(couleurChoisie){
      // on ne check plus si carteTiree.includes(couleurChoisie)
      const msgCouleur = "Bois 1 gorgée pour la couleur !";
      if(regleZero.innerText){
        regleZero.innerText += "\n" + msgCouleur;
      } else {
        regleZero.innerText = msgCouleur;
        regleZero.style.display = "block";
      }
      montrerOverlayRegle(msgCouleur, carteTiree);
      couleurChoisie = null;
    }
  }

  function afficherOverlayCouleur(){
    if(document.getElementById("overlayCouleur")) return;
    choixPigeonEnCours=true;

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

  /* ===== JEU ===== */
  function lancerPartie(){
    if(joueurs.length < 2){
      alert("Il faut au moins 2 joueurs");
      return;
    }

    plateau.innerHTML="";
    paquet=[...classes];
    melangerPaquet(paquet);
    indexJoueur=0;
    partieLancee=true;
    zeroEnCours=false;
    sensHoraire = true;
    couleurChoisie = null;

    btnNouvellePartie.style.display="inline-block";
    btnSupprimer.style.display="none";
    btnJouer.style.display="none";

    regleZero.style.display="none";
    effacerMessagePigeon();
    afficherJoueurActif();

    for(let i=0;i<paquet.length;i++){
      const carte=document.createElement("div");
      carte.classList.add("Carte");

      carte.addEventListener("click", ()=>{
        if(choixPigeonEnCours) return;
        if(carte.classList.contains("retournee")) return;

        const carteTiree = paquet.shift();
        carte.classList.add(carteTiree,"retournee");

        const joueurActuel = indexJoueur % joueurs.length;
        appliquerRegle(carteTiree, joueurActuel);

        indexJoueur = (indexJoueur + (sensHoraire?1:-1) + joueurs.length) % joueurs.length;

        afficherJoueurActif();
        afficherJoueurs();
      });

      plateau.appendChild(carte);
    }
  }

  function retourMenu(){
    partieLancee=false;
    paquet=[];
    indexJoueur=0;
    indexPigeon=null;
    nomPigeonOriginal="";
    choixPigeonEnCours=false;
    zeroEnCours=false;
    switchEnCours=false;
    sensHoraire = true;
    couleurChoisie = null;

    plateau.innerHTML="";
    regleZero.style.display="none";
    effacerMessagePigeon();
    joueurActif.innerText="";

    const overlay=document.getElementById("overlayPigeon");
    if(overlay) overlay.remove();
    const overlayCouleur = document.getElementById("overlayCouleur");
    if(overlayCouleur) overlayCouleur.remove();

    btnNouvellePartie.style.display="none";
    btnSupprimer.style.display="inline-block";
    btnJouer.style.display=joueurs.length>0?"inline-block":"none";
    menu.style.display="flex";
    afficherJoueurs();
  }

  btnJouer.addEventListener("click", lancerPartie);
  btnNouvellePartie.addEventListener("click", retourMenu);

  afficherJoueurs();
});
