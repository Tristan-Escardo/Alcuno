// =============================================================================================
// ALCUNO : Mode hot : défi à la place des gorgées, carte Cupidon (décisions : MODE_HOT.md)
// (fichier chargé après js/regles.js dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Mode hot
// Quand une seule personne doit boire, elle peut relever un défi à la place : « Je le fais » (rien à boire) ou
// « Je bois N ». Le défi dépend des gorgées affichées (moins de 5 : A ; de 5 à 10 : B ; plus de 10 : C),
// la personne visée est tirée au hasard, et un joueur ne retombe jamais deux fois sur le même défi dans une partie.
// {nom} : la personne visée (le partenaire pour un couple lié) ; {nom1} / {nom2} : deux joueurs différents.
const DEFIS_HOT = {
  // moins de 5 gorgées
  A: [
    { id: "A1", t: "Fais un compliment sincère à {nom}." },
    { id: "A2", t: "Souffle un bisou à {nom}, de loin." },
    { id: "A3", t: "Dis ce que tu as remarqué en premier chez {nom}." },
    { id: "A4", t: "Fais un clin d'œil hot à {nom}." },
    { id: "A5", t: "Fais ton regard le plus charmeur à {nom} pendant 5 secondes." },
    { id: "A6", t: "Donne une note sur 10 au sourire de {nom}, et explique-la." },
    { id: "A7", t: "Dis si tu inviterais {nom} à dîner en tête à tête, et pourquoi." },
    { id: "A8", t: "Toi et {nom}, buvez chacun dans le verre de l'autre. Il faut des alcools différents, sinon tu bois tes gorgées." },
    { id: "A9", t: "Tiens la main de {nom} pendant 30 secondes." },
    { id: "A10", t: "Invente un surnom mignon pour {nom} et utilise-le chaque fois que tu lui parles jusqu'à la fin de la partie." },
    { id: "A11", t: "Murmure un compliment à l'oreille de {nom}." },
    { id: "A12", t: "Dis le premier mot qui te vient en tête quand tu penses à {nom}." },
    { id: "A13", t: "Imite le rire de {nom}." },
    { id: "A14", t: "Dis ce que tu préfères dans le style de {nom}." },
    { id: "A15", t: "Échange un de tes accessoires (bague, montre, chaussette…) avec {nom} pendant 5 minutes." },
    { id: "A16", t: "Raconte à {nom} ton meilleur souvenir de bisou." },
    { id: "A17", t: "Dis à {nom} quelle a été ta première impression en faisant sa connaissance." },
    { id: "A18", t: "Fais un compliment à {nom} sur ses yeux." },
    { id: "A19", t: "Dis à {nom} dans quoi il/elle est selon toi le/la plus doué(e)." },
    { id: "A20", t: "Fais une révérence à {nom}, comme à la cour." },
    { id: "A21", t: "Dis à {nom} ce que tu aimes dans son rire." },
    { id: "A22", t: "Imite la démarche de {nom} pendant 10 secondes." },
    { id: "A23", t: "Passe ta main dans les cheveux de {nom}." },
    { id: "A24", t: "Dis à {nom} dans quelle ville du monde tu l'emmènerais pour un week-end, et pourquoi." },
    { id: "A25", t: "Mime un « coup de foudre » en croisant le regard de {nom}." },
    { id: "A26", t: "Dis à {nom} ce que tu ferais si vous étiez coincés tous les deux dans un ascenseur." },
    { id: "A27", t: "Complimente {nom} en 3 mots exactement." }
  ],
  // de 5 à 10 gorgées
  B: [
    { id: "B1", t: "Fais un bisou sur la main de {nom}." },
    { id: "B2", t: "Danse collée 30 secondes avec {nom}." },
    { id: "B3", t: "Assieds-toi sur les genoux de {nom} pendant 1 minute." },
    { id: "B4", t: "Fais un bisou sur la joue de {nom}." },
    { id: "B5", t: "Toi et {nom}, buvez bras entrelacés." },
    { id: "B6", t: "Déclare ta flamme à {nom}, le plus sérieusement possible." },
    { id: "B7", t: "Fais un baisemain théâtral à {nom}." },
    { id: "B8", t: "{nom} te fait un compliment les yeux dans les yeux pendant 10 secondes : interdit de rire." },
    { id: "B9", t: "Fais un slow de 30 secondes avec {nom}." },
    { id: "B10", t: "Fais un câlin de 15 secondes à {nom}." },
    { id: "B11", t: "Fais un massage des épaules à {nom} pendant 30 secondes." },
    { id: "B12", t: "Caresse doucement la joue de {nom} pendant 10 secondes." },
    { id: "B13", t: "Mime avec {nom} une scène de film romantique." },
    { id: "B14", t: "Tiens les deux mains de {nom1} et dis ce que tu admires le plus chez {nom2}.", deux: true },
    { id: "B15", t: "Fais tourner {nom} sur place en lui tenant la main, comme dans une danse de salon, pendant 20 secondes." },
    { id: "B16", t: "Fais un massage de la main de {nom} pendant 15 secondes." }
  ],
  // plus de 10 gorgées
  C: [
    { id: "C1", t: "Fais un bisou dans le cou de {nom}." },
    { id: "C2", t: "Fais un bisou au coin de la bouche de {nom}." },
    { id: "C3", t: "Danse collée 1 minute avec {nom}, front contre front." },
    { id: "C4", t: "Souffle doucement dans le cou de {nom}." },
    { id: "C5", t: "Lèche le bas du dos de {nom}." },
    { id: "C6", t: "Retire lentement un vêtement en regardant {nom} dans les yeux." },
    { id: "C7", t: "Tiens {nom} par la taille pendant 1 minute." },
    { id: "C8", t: "Embrasse l'épaule de {nom}." },
    { id: "C9", t: "Raconte ta soirée idéale à deux avec {nom}." },
    { id: "C10", t: "Fais un compliment très osé à {nom}, sans rire ni te cacher." },
    { id: "C11", t: "Colle ton épaule à celle de {nom} pendant 1 minute." },
    { id: "C12", t: "Fais un défilé de 20 secondes devant {nom}, comme un mannequin." },
    { id: "C13", t: "Échange un vêtement avec {nom} jusqu'à la fin de la partie." },
    { id: "C14", t: "Chante une petite chanson à {nom} pendant 20 secondes." },
    { id: "C15", t: "Tiens le visage de {nom} entre tes mains et dis-lui que tu adores te marteler les fesses avec un cactus nain 2 à 3 soirs par semaine et que tu as pris l'habitude de retirer les épines avec une pince à épiler, ce qui a nettement amélioré ta dextérité et ta mobilité des doigts." }
  ]
};

let defisVusHot = {};   // nom => défis déjà tirés par ce joueur dans la partie
let liensHot = [];      // couples liés par Cupidon : [[nomA, nomB], ...]
let hasardHot = Math.random; // hasard des défis : à graine (voir initialiserModeHot), pour qu'il soit le même chez tous les joueurs

// Début de partie (js/regles.js, lancerPartie) : plus de défis vus, plus de liens, hasard à graine.
// Le hasard est à part de celui du paquet : les défis ne changent jamais l'ordre des cartes.
function initialiserModeHot(){
  defisVusHot = {};
  // Défis ajoutés depuis le pilotage (stats.html → config.defisHot, js/config-lib.js) : figés pour toute la partie,
  // triés par identifiant pour que le tirage à graine reste le même en reprise de partie.
  // En ligne : ceux que la manche emporte (téléphone qui l'a lancée, js/en-ligne.js), les mêmes pour tous ;
  // une manche sans liste (lancée par une ancienne version) : ceux de ce téléphone.
  const manche = enLigneActif && dernierEtatManche && (dernierEtatManche.defisHot || dernierEtatManche.defisMasques) ? dernierEtatManche : null;
  const source = manche ? ConfigLib.valider({ defisHot: manche.defisHot, defisMasques: manche.defisMasques })
    : (typeof configDistante === "object" && configDistante) || {};
  const ajoutes = source.defisHot || {};
  defisMasquesHot = Object.assign({}, source.defisMasques || {}); // (défis du jeu retirés depuis le pilotage)
  defisAjoutesHot = { A: [], B: [], C: [] };
  Object.keys(ajoutes).sort().forEach((id) => {
    const d = ajoutes[id];
    if (defisAjoutesHot[d.n]) defisAjoutesHot[d.n].push({ id: "P" + id, t: d.t, deux: /\{nom1\}/.test(d.t) });
  });
  liensHot = [];
  const graine = enLigneActif
    ? (dernierEtatManche ? dernierEtatManche.seed : 0)
    : (sauvegardeClassique ? sauvegardeClassique.seed : 0);
  hasardHot = generateurAleatoire(((Number(graine) % 4294967296) ^ 0x2F6B1A93) >>> 0);
}

// ----- Cupidon : deux joueurs liés, quand l'un boit l'autre aussi -----
function liensActifsHot(){
  return liensHot.filter(([a, b]) => joueurs.includes(a) && joueurs.includes(b));
}
function partenaireHot(nom){
  if(!partieHot) return null;
  for(const [a, b] of liensActifsHot()){
    if(a === nom) return b;
    if(b === nom) return a;
  }
  return null;
}
function joueursLibresHot(){
  return joueurs.filter(n => !estEnPause(n) && !partenaireHot(n));
}

// ----- Défis -----
let defisAjoutesHot = { A: [], B: [], C: [] };
let defisMasquesHot = {};
function defisDuNiveauHot(groupe){ return DEFIS_HOT[groupe].filter((d) => !defisMasquesHot[d.id]).concat(defisAjoutesHot[groupe] || []); }
function groupeDefiHot(nbGorgees){
  return nbGorgees > 10 ? "C" : nbGorgees >= 5 ? "B" : "A";
}

// { texte } du défi pour ce joueur (null s'il n'y a personne à viser)
function tirerDefiHot(nom, nbGorgees, partenaire){
  const groupe = groupeDefiHot(nbGorgees);
  const autres = joueurs.filter(j => j !== nom && !estEnPause(j));
  const cibles = partenaire ? [partenaire] : autres;
  if(cibles.length === 0) return null;
  const vus = defisVusHot[nom] || (defisVusHot[nom] = new Set());
  const possible = (d) => !vus.has(d.id) && (!d.deux || autres.length >= 2);
  const tous = defisDuNiveauHot(groupe);
  let pool = tous.filter(possible);
  if(pool.length === 0){ // (tous vus : on repart de zéro plutôt que de ne rien proposer)
    tous.forEach(d => vus.delete(d.id));
    pool = tous.filter(possible);
  }
  if(pool.length === 0) return null; // (tout est masqué à ce niveau : pas de défi, on boit)
  const defi = pool[Math.floor(hasardHot() * pool.length)];
  vus.add(defi.id);
  let nom1 = null, nom2 = null, cible = null;
  if(defi.deux){
    // deux joueurs différents (couple lié : le partenaire, puis un autre joueur)
    nom1 = partenaire || autres[Math.floor(hasardHot() * autres.length)];
    const restants = autres.filter(j => j !== nom1);
    nom2 = restants[Math.floor(hasardHot() * restants.length)];
  } else {
    cible = cibles[Math.floor(hasardHot() * cibles.length)];
  }
  const texte = defi.t
    .replace(/\{nom1\}/g, avecCouronne(nom1 || ""))
    .replace(/\{nom2\}/g, avecCouronne(nom2 || ""))
    .replace(/\{nom\}/g, avecCouronne(cible || ""));
  return { id: defi.id, texte };
}

// Mode hot : le défi s'affiche dans l'annonce de la règle (« Léa boit 2 gorgées »), sous la carte : un bloc rose
// avec le défi et deux boutons. L'annonce reste jusqu'au choix (elle ne se ferme plus toute seule).
// À appeler juste après montrerOverlayRegle, quand UNE SEULE personne (ou un couple lié) doit boire.
// Renvoie null (hors mode hot, ou pas de défi à proposer) ou l'état du défi : { choix: null | "fait" | "bois", partenaire }.
// defiImpose : { id, texte } déjà prêt (aperçu du pilotage, voir apercuDefiHot)
function montrerDefiHot(joueurIndex, nbGorgees, defiPossible = true, defiImpose = null){
  if(!partieHot || !defiPossible || !partieLancee) return null;
  const overlay = document.getElementById("overlayRegleUnique");
  if(!overlay) return null;
  const nom = joueurs[joueurIndex];
  const partenaire = partenaireHot(nom);
  const defi = defiImpose || tirerDefiHot(nom, nbGorgees, partenaire);
  if(!defi) return null;
  const etat = { choix: null, partenaire };
  const qui = partenaire ? `${avecCouronne(nom)} et ${avecCouronne(partenaire)}` : avecCouronne(nom);

  overlay.querySelectorAll(".bloc-hot").forEach(b => b.remove());
  const bloc = document.createElement("div");
  bloc.className = "bloc-hot";

  const puce = document.createElement("span");
  puce.className = "bloc-hot-puce";
  puce.innerText = "🔥 MODE HOT";
  bloc.appendChild(puce);

  if(partenaire){
    const lien = document.createElement("div");
    lien.className = "bloc-hot-lien";
    lien.innerText = `💘 ${qui} boivent ensemble`;
    bloc.appendChild(lien);
  }

  const texte = document.createElement("p");
  texte.className = "bloc-hot-texte";
  texte.innerText = defi.texte;
  bloc.appendChild(texte);

  const boutons = document.createElement("div");
  boutons.className = "bloc-hot-boutons";
  bloc.appendChild(boutons);

  const choisir = (choix, messageRegle) => {
    etat.choix = choix;
    try { noterDefiStats(defi.id, choix); } catch (e) {} // (stats : défi relevé ou refusé, js/stats.js)
    bloc.dataset.netFerme = "1";
    afficherRegleBloc(regleZero, messageRegle);
    regleZero.style.display = "block";
    zeroEnCours = true;
    overlayRegleVerrouille = false;
    fermerOverlayRegleUnique(); // (la suite : finirBoireHot, quand l'annonce est fermée)
  };
  const bouton = (classe, libelle, id, action) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bloc-hot-btn " + classe;
    btn.innerText = libelle;
    surAction(btn, id, { owner: nom, once: true }, action);
    boutons.appendChild(btn);
  };
  bouton("fait", "Je le fais", "defi:fait", () => {
    jouerSon("annuler_gorgees");
    choisir("fait", `${qui} ${partenaire ? "relèvent" : "relève"} le défi :\n${defi.texte}`);
  });
  bouton("bois", `Je bois ${nbGorgees}`, "defi:bois", () => {
    choisir("bois", `${qui} ${partenaire ? "boivent" : "boit"} ${texteGorgees(nbGorgees)}`);
  });

  overlay.appendChild(bloc);
  overlayRegleVerrouille = true; // l'annonce attend le choix
  if(overlayRegleTimeout){ clearTimeout(overlayRegleTimeout); overlayRegleTimeout = null; }
  return etat;
}

// Fin de l'annonce : les gorgées, sauf si le défi est relevé (le partenaire d'un couple lié boit pareil)
function finirBoireHot(etat, joueurIndex, nbGorgees, onFinish){
  if(!(etat && etat.choix === "fait")){
    noterGorgees(joueurs[joueurIndex], nbGorgees);
    if(etat && etat.partenaire){
      noterGorgees(etat.partenaire, nbGorgees);
      compterCouple(joueurs[joueurIndex], etat.partenaire, nbGorgees); // (récap : « Couple de la soirée »)
    }
  }
  if(typeof onFinish === "function") onFinish();
}

// ----- Carte Coup de foudre (période Saint-Valentin) : celui qui la tire choisit quelqu'un, puis
// un bisou sur la bouche… ou un cul sec (4 gorgées en mode PJ). Synchronisé en ligne comme Cupidon (surAction).
function afficherOverlayCoupDeFoudre(joueurActuel, classeCarte, suite = null){
  if(document.getElementById("overlayCoupDeFoudre")) return;
  const choisisseur = joueurs[joueurActuel];
  const autres = joueurs.filter(n => n !== choisisseur && !estEnPause(n));
  if(!autres.length){ // (personne d'autre : rien à faire)
    choixPigeonEnCours = false;
    if(typeof suite === "function") suite();
    return;
  }
  choixPigeonEnCours = true;
  lockScroll();
  const culSec = estModeSoft() ? "4 gorgées" : "CUL SEC";
  let etape = "choix", elu = null;

  const overlay = document.createElement("div");
  overlay.id = "overlayCoupDeFoudre";
  const titre = document.createElement("div");
  titre.className = "titre-pigeon";
  overlay.appendChild(titre);
  ajouterCarteVedette(overlay, classeCarte);
  const container = document.createElement("div");
  container.className = "plus4-container-joueurs";
  overlay.appendChild(container);
  const actions = document.createElement("div");
  actions.className = "plus4-actions";
  overlay.appendChild(actions);

  const boutons = [];
  const nouveau = (parent, libelle, id, etapes, action, opts = {}) => {
    const btn = document.createElement("button");
    btn.className = "bouton-pigeon plus4-joueur-btn";
    btn.innerHTML = libelle;
    surAction(btn, id, Object.assign({ owner: choisisseur, pret: () => etapes.includes(etape) }, opts), action);
    parent.appendChild(btn);
    boutons.push({ el: btn, etapes });
    return btn;
  };
  function terminer(message){
    overlay.remove();
    unlockScroll();
    choixPigeonEnCours = false;
    afficherJoueurs();
    afficherJoueurActif();
    afficherRegleBloc(regleZero, message);
    regleZero.style.display = "block";
    zeroEnCours = true;
    montrerOverlayRegle(message, classeCarte);
    if(typeof suite === "function") suite();
  }

  // 1) choisir quelqu'un
  autres.forEach((nom) => {
    nouveau(container, echapperHtml(avecCouronne(nom)), "foudre:joueur:" + joueurs.indexOf(nom), ["choix"], () => {
      elu = nom; etape = "action"; jouerSon("distribuer_gorgees"); refresh();
    });
  });
  // 2) bisou ou cul sec
  nouveau(actions, "💋 Bisou sur la bouche", "foudre:bisou", ["action"], () => {
    compterCouple(choisisseur, elu, 0, 1);
    jouerSon("annuler_gorgees");
    terminer(`💋 ${avecCouronne(choisisseur)} et ${avecCouronne(elu)} : coup de foudre !`);
  }, { once: true });
  nouveau(actions, `🥃 ${culSec}`, "foudre:culsec", ["action"], () => {
    noterGorgees(choisisseur, estModeSoft() ? 4 : GORGEES_CUL_SEC);
    terminer(`🥃 ${avecCouronne(choisisseur)} préfère ${estModeSoft() ? "boire 4 gorgées" : "le CUL SEC"} !`);
  }, { once: true });
  nouveau(actions, "Retour", "foudre:retour", ["action"], () => { elu = null; etape = "choix"; refresh(); });

  function refresh(){
    // « Défi hot spécial Saint-Valentin », puis le titre, puis la consigne, bien séparés (style_alcuno.css : .foudre-*)
    // (des <div> et pas des <span> : la télé, js/tele.js, met chaque bloc sur sa ligne)
    titre.innerHTML = `<div class="foudre-badge">🔥 Défi hot spécial <span class="foudre-nowrap">Saint-Valentin</span> 💘</div><div class="foudre-titre">COUP DE FOUDRE ⚡</div>`
      + `<div class="foudre-consigne">${etape === "choix" ? "Choisis quelqu'un"
        : `${echapperHtml(avecCouronne(elu))} : un bisou sur la bouche… ou ${culSec} ?`}</div>`;
    boutons.forEach(({ el, etapes }) => { el.style.display = etapes.includes(etape) ? "" : "none"; });
  }
  document.body.appendChild(overlay);
  refresh();
}

// ----- Carte Cupidon : lier deux joueurs, ou briser un lien -----
// suite : appelée une fois le choix fait (gorgée de la couleur choisie éventuelle)
function afficherOverlayCupidon(joueurActuel, classeCarte, suite = null){
  if(document.getElementById("overlayCupidon")) return;
  const choisisseur = joueurs[joueurActuel];
  const peutLier = () => joueursLibresHot().length >= 2;
  const peutBriser = () => liensActifsHot().length > 0;
  if(!peutLier() && !peutBriser()){ // (rien à faire : personne à lier, aucun lien)
    choixPigeonEnCours = false;
    if(typeof suite === "function") suite();
    return;
  }

  choixPigeonEnCours = true;
  lockScroll();
  let etape = peutLier() ? (peutBriser() ? "choix" : "lier") : "briser";
  let selection = []; // joueurs choisis pour le lien (2)

  const overlay = document.createElement("div");
  overlay.id = "overlayCupidon";

  const titre = document.createElement("div"); // (au-dessus de la carte)
  titre.className = "titre-pigeon";
  overlay.appendChild(titre);
  ajouterCarteVedette(overlay, classeCarte);

  const total = document.createElement("div");
  total.className = "plus4-total";
  overlay.appendChild(total);

  const container = document.createElement("div");
  container.className = "plus4-container-joueurs";
  overlay.appendChild(container);

  const actions = document.createElement("div");
  actions.className = "plus4-actions";
  overlay.appendChild(actions);

  const boutons = []; // { el, etape }
  const nouveau = (parent, classe, libelle, id, etapes, action, opts = {}) => {
    const btn = document.createElement("button");
    btn.className = classe;
    btn.innerHTML = libelle;
    surAction(btn, id, Object.assign({ owner: choisisseur, pret: () => etapes.includes(etape) }, opts), action);
    parent.appendChild(btn);
    boutons.push({ el: btn, etapes });
    return btn;
  };

  function terminer(message){
    overlay.remove();
    unlockScroll();
    choixPigeonEnCours = false;
    afficherJoueurs();
    afficherJoueurActif();
    afficherRegleBloc(regleZero, message);
    regleZero.style.display = "block";
    zeroEnCours = true;
    montrerOverlayRegle(message, classeCarte);
    if(typeof suite === "function") suite();
  }

  // 1) lier ou briser
  nouveau(container, "bouton-pigeon plus4-joueur-btn", "Lier deux joueurs", "cupidon:lier", ["choix"], () => { etape = "lier"; refresh(); });
  nouveau(container, "bouton-pigeon plus4-joueur-btn", "Briser un lien", "cupidon:briser", ["choix"], () => { etape = "briser"; refresh(); });

  // 2) lier : joueurs libres au moment où la carte sort
  const libres = joueursLibresHot();
  libres.forEach((nom) => {
    const btn = nouveau(container, "bouton-pigeon plus4-joueur-btn", echapperHtml(avecCouronne(nom)), "cupidon:joueur:" + joueurs.indexOf(nom), ["lier"], () => {
      if(selection.includes(nom)) selection = selection.filter(x => x !== nom);
      else if(selection.length < 2) selection.push(nom);
      jouerSon("distribuer_gorgees");
      refresh();
    });
    btn.dataset.nom = nom;
  });

  // 3) briser : un bouton par lien
  const liensAuDepart = liensActifsHot();
  liensAuDepart.forEach(([a, b], k) => {
    nouveau(container, "bouton-pigeon plus4-joueur-btn", `${echapperHtml(avecCouronne(a))} 💘 ${echapperHtml(avecCouronne(b))}`, "cupidon:lien:" + k, ["briser"], () => {
      liensHot = liensHot.filter(([x, y]) => !(x === a && y === b));
      terminer(`💔 Le lien entre ${avecCouronne(a)} et ${avecCouronne(b)} est brisé.`);
    });
  });

  const btnValider = nouveau(actions, "bouton-pigeon plus4-action-btn", "Valider", "cupidon:valider", ["lier"], () => {
    if(selection.length !== 2) return;
    const [a, b] = selection;
    liensHot.push([a, b]);
    terminer(`💘 ${avecCouronne(a)} et ${avecCouronne(b)} sont liés !\nQuand l'un boit, l'autre aussi.`);
  }, { once: true });
  const btnRetour = nouveau(actions, "bouton-pigeon plus4-action-btn", "Retour", "cupidon:retour", ["lier", "briser"], () => {
    selection = [];
    etape = (peutLier() && peutBriser()) ? "choix" : etape;
    refresh();
  });

  function refresh(){
    titre.innerText = etape === "choix" ? "CUPIDON\nQue veux-tu faire ?"
      : etape === "lier" ? "CUPIDON\nChoisis 2 joueurs à lier" : "CUPIDON\nQuel lien briser ?";
    total.innerText = etape === "lier" ? `Joueurs choisis : ${selection.length} / 2` : "";
    total.style.display = etape === "lier" ? "" : "none";
    boutons.forEach(({ el, etapes }) => {
      el.style.display = etapes.includes(etape) ? "" : "none";
      if(el.dataset.nom){
        const choisi = selection.includes(el.dataset.nom);
        el.innerHTML = choisi ? `${echapperHtml(avecCouronne(el.dataset.nom))} <span class="plus4-badge">💘</span>` : echapperHtml(avecCouronne(el.dataset.nom));
        el.disabled = !choisi && selection.length >= 2;
      }
    });
    btnValider.disabled = selection.length !== 2;
    btnValider.style.opacity = btnValider.disabled ? "0.6" : "1";
    btnRetour.style.display = (etape !== "choix" && ((peutLier() && peutBriser()) || (etape === "lier" && selection.length > 0))) ? "" : "none";
  }

  document.body.appendChild(overlay);
  refresh();
}
// #endregion

// ----- Aperçu d'un défi depuis le pilotage (stats.html → « Voir comme en jeu ») -----
// index.html?apercu_defi=<texte>&niveau=A|B|C : l'annonce telle qu'en partie (Léa boit, Tom et Max visés), boutons sans effet.
// L'adresse met le jeu en appli de test (MODE_TEST, script.js) : rien n'est compté dans les statistiques.
function apercuDefiHot(texte, niveau){
  const gorgees = { A: 3, B: 7, C: 12 }[niveau] || 3;
  joueurs = ["Léa", "Tom", "Max"];
  partieHot = true; partieLancee = true;
  const t = String(texte).replace(/\{nom1\}|\{nom\}/g, "Tom").replace(/\{nom2\}/g, "Max");
  montrerOverlayRegle(`Léa boit ${texteGorgees(gorgees)}`, niveau === "A" ? "trois_rouge" : niveau === "B" ? "plus_2_bleu" : "plus_4");
  montrerDefiHot(0, gorgees, true, { id: "apercu", texte: t });
  document.querySelectorAll("#overlayRegleUnique .bloc-hot-btn").forEach((b) => {
    const copie = b.cloneNode(true); // (sans ses actions : l'aperçu ne joue pas)
    copie.addEventListener("click", () => { copie.animate([{ transform: "scale(.94)" }, { transform: "scale(1)" }], 160); });
    b.replaceWith(copie);
  });
}
(() => {
  const p = new URLSearchParams(location.search);
  if (!p.has("apercu_defi")) return;
  document.documentElement.classList.add("apercu-defi");
  const lancer = () => setTimeout(() => { try { apercuDefiHot(p.get("apercu_defi"), p.get("niveau")); } catch (e) { console.error(e); } }, 600);
  if (document.readyState === "complete") lancer(); else window.addEventListener("load", lancer);
})();
