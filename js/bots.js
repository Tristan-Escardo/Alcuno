// =============================================================================================
// ALCUNO : Bots (partie classique seulement)
// (fichier chargé après ceux d'avant dans index.html : voir l'en-tête de script.js)
// =============================================================================================
// #region Bots
// « 🤖 Ajouter un bot » (à côté de « Ajouter un joueur », avant la partie) : un joueur au nom tiré au hasard, joué par le
// téléphone. À son tour, il retourne une carte tout seul ; il fait aussi tous les choix qui lui reviennent (couleur, nouveau
// pigeon, duel, distribution du +4, carte dorée, pari de fin, Cupidon, Coup de foudre), en visant plutôt les vrais joueurs.
// Ses gorgées sont perdues (il ne boit pas, et elles ne comptent pas dans le récap)… sauf quand il décide de les refiler à
// quelqu'un (CHANCE_REFILE_BOT). Pas en ligne (pour l'instant), pas en mode hard (il faut 2 vrais joueurs).
// Les choix passent par les mêmes boutons qu'un vrai joueur (surAction, js/synchro-en-ligne.js) : la partie gardée en
// mémoire les rejoue comme les autres après un plantage.
const CLE_BOTS = "alcuno_bots";
// Prénoms : ceux du jeu (ConfigLib.NOMS_BOTS, js/config-lib.js), moins ceux retirés et plus ceux ajoutés depuis le pilotage
// (stats.html → Bots, « config/bots »)
const nomsDesBots = () => ConfigLib.nomsBots(typeof configDistante === "object" ? configDistante : {});
const CHANCE_REFILE_BOT = 0.25; // « de temps en temps », le bot refile ses gorgées au lieu de les perdre
const MAX_BOTS = 6;

let botsPartie = new Set();
try { (JSON.parse(localStorage.getItem(CLE_BOTS) || "[]") || []).forEach((n) => { if (typeof n === "string") botsPartie.add(n); }); } catch (e) {}
function sauverBots(){
  try { localStorage.setItem(CLE_BOTS, JSON.stringify([...botsPartie].filter((n) => joueurs.includes(n)))); } catch (e) {}
}

// Un bot : seulement en classique, et seulement s'il est encore dans la liste des joueurs
function estBot(nom){
  return !enLigneActif && botsPartie.has(nom) && joueurs.includes(nom);
}
function botsPresents(){
  return joueurs.filter((n) => estBot(n));
}
// Un vrai joueur prend ce nom (ou le bot a été retiré) : ce n'est plus un bot
function retirerBot(nom){
  if (botsPartie.delete(nom)) sauverBots();
}
// Vrais joueurs disponibles (pas en pause), en indices
function indicesHumains(sauf = -1){
  return joueurs.map((_, i) => i).filter((i) => i !== sauf && !estBot(joueurs[i]) && !estEnPause(joueurs[i]));
}
const auHasard = (liste) => liste[Math.floor(Math.random() * liste.length)];

// ----- Le relou : « Oh non pas lui... », proposé seulement en thème Sombre (une fois sur CHANCE_RELOU, un seul par partie).
// Au lancement, il choisit une victime au hasard parmi les vrais joueurs, et s'acharne sur elle : nouveau pigeon, duel,
// carte dorée, tout le +4, Cupidon, Coup de foudre… et ses gorgées, il les lui refile souvent (CHANCE_REFILE_RELOU).
const NOM_RELOU_FR = "Oh non pas lui...";
const CHANCE_RELOU = 1 / 3, CHANCE_REFILE_RELOU = 0.5;
const nomRelou = () => tr(NOM_RELOU_FR);
const estRelou = (nom) => nom === nomRelou() && estBot(nom);
let victimeDuRelou = null;
// Sa victime (une nouvelle si l'ancienne est partie, en pause, ou si c'est une autre partie) ; annoncée en haut de l'écran
function victimeRelou(){
  if (victimeDuRelou && joueurs.includes(victimeDuRelou) && !estBot(victimeDuRelou) && !estEnPause(victimeDuRelou)) return victimeDuRelou;
  const humains = indicesHumains();
  if (!humains.length) return null;
  victimeDuRelou = joueurs[auHasard(humains)];
  try { afficherNotificationHaut("😈", tr`${nomRelou()} a choisi sa victime : ${victimeDuRelou}`); } catch (e) {}
  noterHistorique(tr`${nomRelou()} a choisi sa victime : ${victimeDuRelou}`);
  return victimeDuRelou;
}

// ----- Bouton « Ajouter un bot » : prénom tiré au hasard, puis « Ajouter le bot Roméo à la partie ? » Oui / Non
const btnAjouterBot = document.getElementById("ajouterBot");
const ecranConfirmerBot = document.getElementById("ecranConfirmerBot");
let botPropose = "";
function nomBotLibre(){
  const pris = (n) => joueurs.some((j) => (j || "").toLocaleLowerCase("fr-FR") === n.toLocaleLowerCase("fr-FR"));
  const libres = nomsDesBots().filter((n) => !pris(n));
  if (libres.length) return auHasard(libres);
  for (let k = 2; ; k++) { const essai = "Robot " + k; if (!pris(essai)) return essai; }
}
function proposerBot(){
  if (partieLancee || enLigneActif || estModeHard()) return;
  if (botsPresents().length >= MAX_BOTS) { afficherToast(tr`${MAX_BOTS} bots au plus`, 2500); return; }
  const relou = document.documentElement.dataset.theme === "noir" && !joueurs.includes(nomRelou()) && Math.random() < CHANCE_RELOU;
  botPropose = relou ? nomRelou() : nomBotLibre();
  document.getElementById("texteConfirmerBot").innerText = relou ? tr("Il va s'acharner sur l'un de vous. Bon courage 😈") : tr("Il joue tout seul et ne boit pas… enfin, presque 🤖");
  document.getElementById("titreConfirmerBot").innerText = tr`Ajouter le bot ${botPropose} à la partie ?`.replace(/ ([?!])/g, "\u00a0$1"); // (le « ? » ne passe jamais seul à la ligne)
  ecranConfirmerBot.style.display = "";
}
function ajouterBot(nom){
  ecranConfirmerBot.style.display = "none";
  if (!nom || partieLancee || enLigneActif || estModeHard() || joueurs.includes(nom)) return;
  botsPartie.add(nom);
  joueurs.push(nom);
  sauverBots();
  afficherJoueurs();
}
if (btnAjouterBot) btnAjouterBot.addEventListener("click", proposerBot);
document.getElementById("btnConfirmerBotOui").addEventListener("click", () => ajouterBot(botPropose));
document.getElementById("btnConfirmerBotNon").addEventListener("click", () => { ecranConfirmerBot.style.display = "none"; });
// (« Ajouter un bot » : visible comme « Ajouter un joueur », sauf en ligne et en mode hard, où il faut 2 vrais joueurs)
function majBoutonBot(){
  if (!btnAjouterBot) return;
  btnAjouterBot.style.display = (partieLancee || enLigneActif || estModeHard()) ? "none" : "";
}
caseModeHard.addEventListener("change", majBoutonBot);
majBoutonBot();

// ----- Gorgées d'un bot : perdues, ou (de temps en temps) refilées à un vrai joueur au hasard.
// refiler(indexHumain, message) : la suite normale (annonce + annulations) pour ce joueur. Renvoie false si ce n'est pas un bot.
function gorgeesDuBot(joueurIndex, nbGorgees, classeCarte, msg, onFinish, refiler){
  const bot = joueurs[joueurIndex];
  if (!estBot(bot)) return false;
  const humains = indicesHumains();
  // le relou : souvent, et toujours à sa victime
  const victime = estRelou(bot) ? victimeRelou() : null;
  if (victime && Math.random() < CHANCE_REFILE_RELOU) {
    const h = joueurs.indexOf(victime);
    const quoi = nbGorgees === 1 ? tr("sa gorgée") : tr`ses ${texteGorgees(nbGorgees)}`;
    const texte = `${msg}\n${tr`${bot} refile ${quoi} à ${victime}. Encore ${victime}. Évidemment.`}\n${tr`Donc ${victime}, tu bois ${texteGorgees(nbGorgees)}.`}`;
    noterHistorique(tr`${bot} refile ${texteGorgees(nbGorgees)} à ${victime}`);
    refiler(h, texte);
    return true;
  }
  if (!victime && humains.length && Math.random() < CHANCE_REFILE_BOT) {
    const h = auHasard(humains), nom = joueurs[h];
    const quoi = nbGorgees === 1 ? tr("sa gorgée") : tr`ses ${texteGorgees(nbGorgees)}`;
    const texte = `${msg}\n${tr`${bot} a décidé de refiler ${quoi} à ${nom}. Normalement on n'a pas le droit, mais ${bot} s'en bat les couilles.`}\n${tr`Donc ${nom}, tu bois ${texteGorgees(nbGorgees)}.`}`;
    noterHistorique(tr`${bot} refile ${texteGorgees(nbGorgees)} à ${nom}`);
    refiler(h, texte);
    return true;
  }
  const texte = `${msg}\n${tr`${bot} est un bot : ses gorgées partent dans le vide 🤖`}`;
  afficherRegleBloc(regleZero, msg);
  regleZero.style.display = "block";
  zeroEnCours = true;
  montrerOverlayRegle(texte, classeCarte);
  executerApresOverlayRegleUnique(() => { if (typeof onFinish === "function") onFinish(); });
  return true;
}

// ----- Le bot joue : à son tour (une carte du plateau), et les choix qui lui reviennent
const DELAI_BOT = () => 900 + Math.random() * 700; // le temps qu'on voie ce qui se passe
let actionBotPrevue = null;

function proprietaire(el){
  const o = el._net && el._net.owner;
  return typeof o === "function" ? o() : o;
}
function visibleBot(el){
  return el.isConnected && el.getClientRects().length > 0 && !el.closest("[hidden]");
}
function pretBot(el){
  return typeof actionPrete === "function" && actionPrete(el) && !(el._net.valide && !el._net.valide()) && visibleBot(el);
}
function declencher(el){
  const ev = (el._net && el._net.evenement) || "pointerdown";
  if (ev === "click") el.click();
  else if (ev.startsWith("pointer")) el.dispatchEvent(new PointerEvent(ev, { bubbles: true }));
  else el.dispatchEvent(new Event(ev, { bubbles: true }));
}
const idDe = (el) => el.dataset.netId || "";
// Boutons qu'un bot ne touche jamais (revenir en arrière, effacer) : ils n'entrent même pas dans « ce qui lui revient »
// (sinon le « Retour » du pari, qui appartient à celui qui vient de parier, bloquait le bot suivant)
const IDS_JAMAIS_BOT = /^(plus4:annuler|plus4:reset|pred:retour|cupidon:retour|foudre:retour|pause:)/;
const indexDe = (el) => Number(idDe(el).split(":").pop());

// Choix parmi les boutons proposés à ce bot (tous du même écran)
function choisirPourBot(bot, choix){
  const ids = (prefixe) => choix.filter((el) => idDe(el).startsWith(prefixe));
  const humain = (liste) => liste.filter((el) => !estBot(joueurs[indexDe(el)]));
  // (le relou vise toujours sa victime quand elle est proposée)
  const victime = estRelou(bot) ? victimeRelou() : null;
  const surVictime = (liste) => victime ? liste.filter((el) => joueurs[indexDe(el)] === victime) : [];
  const versHumain = (liste) => surVictime(liste)[0] || auHasard(humain(liste).length ? humain(liste) : liste);
  // +4 : une gorgée à la fois, plutôt à ceux qui ont le moins bu (un peu de malice), puis Valider
  const valider4 = ids("plus4:valider")[0];
  if (valider4) return valider4;
  const plus4 = humain(ids("plus4:joueur:"));
  if (surVictime(plus4).length) return surVictime(plus4)[0]; // (le relou : tout pour sa victime)
  if (plus4.length) {
    const min = Math.min(...plus4.map((el) => gorgeesBues[joueurs[indexDe(el)]] || 0));
    const moinsBu = plus4.filter((el) => (gorgeesBues[joueurs[indexDe(el)]] || 0) <= min + 2);
    return auHasard(Math.random() < 0.7 ? moinsBu : plus4);
  }
  if (ids("plus4:joueur:").length) return auHasard(ids("plus4:joueur:"));
  // Cupidon : lier deux vrais joueurs, sinon briser un lien
  // (« Valider » n'est proposé qu'avec 2 joueurs choisis : les choisis ont un 💘)
  if (ids("cupidon:valider").length) return ids("cupidon:valider")[0];
  const libresCupidon = ids("cupidon:joueur:").filter((el) => !el.innerText.includes("💘"));
  if (libresCupidon.length) return versHumain(libresCupidon);
  if (ids("cupidon:lier").length) return ids("cupidon:lier")[0];
  if (ids("cupidon:briser").length) return ids("cupidon:briser")[0];
  if (ids("cupidon:lien:").length) return auHasard(ids("cupidon:lien:"));
  // Coup de foudre : un vrai joueur… puis le cul sec (un bot ne fait pas de bisou)
  if (ids("foudre:culsec").length) return ids("foudre:culsec")[0];
  if (ids("foudre:joueur:").length) return versHumain(ids("foudre:joueur:"));
  // Nouveau pigeon, adversaire du duel, victime de la carte dorée : un vrai joueur
  for (const p of ["pigeon:", "duel:choix:", "doree:"]) if (ids(p).length) return versHumain(ids(p));
  // Défi hot ou annulations (normalement jamais pour un bot) : il boit, et annule le plus possible
  if (ids("defi:bois").length) return ids("defi:bois")[0];
  if (ids("annul:").length) return ids("annul:").sort((a, b) => indexDe(b) - indexDe(a))[0];
  // Couleur, carte du duel, pari de fin… : au hasard
  return choix.length ? auHasard(choix) : null;
}

function actionDuBot(){
  if (!partieLancee) victimeDuRelou = null; // (nouvelle partie : nouvelle victime)
  if (enLigneActif || !partieLancee || !botsPresents().length) return null;
  if (estBot(nomRelou())) victimeRelou(); // (choisie et annoncée dès le début de la partie)
  if (typeof rattrapageEnCours !== "undefined" && rattrapageEnCours) return null;
  if (typeof repriseClassiqueEnCours !== "undefined" && repriseClassiqueEnCours) return null;
  if (typeof pauseEnCours !== "undefined" && pauseEnCours) return null;
  if (document.documentElement.classList.contains("mode-tele")) return null;
  // 1) un choix qui revient à un bot (écran par-dessus le plateau)
  const proposes = [...document.querySelectorAll("[data-net-id]")].filter((el) => !el.closest("#plateau") && el._net && !IDS_JAMAIS_BOT.test(idDe(el)) && estBot(proprietaire(el)) && pretBot(el));
  if (proposes.length) {
    const bot = proprietaire(proposes[0]);
    return choisirPourBot(bot, proposes.filter((el) => proprietaire(el) === bot));
  }
  // 2) son tour : une carte cachée du plateau au hasard (quand plus rien n'est affiché par-dessus)
  if (typeof overlayOuvert === "function" && overlayOuvert()) return null;
  if (voileOverlays.classList.contains("visible")) return null;
  const cartes = [...plateau.querySelectorAll(".Carte:not(.retournee)")].filter((c) => c._net && estBot(proprietaire(c)) && pretBot(c));
  return cartes.length ? auHasard(cartes) : null;
}

// Toutes les 300 ms : si un bot a quelque chose à faire, il le fait après un petit temps de « réflexion »
// (refait le point juste avant : l'écran a pu changer entre-temps)
setInterval(() => {
  if (actionBotPrevue) return;
  const el = actionDuBot();
  if (!el) return;
  actionBotPrevue = setTimeout(() => {
    actionBotPrevue = null;
    const encore = actionDuBot();
    if (!encore) return;
    // même écran : on garde l'élément choisi s'il est toujours proposé, sinon le nouveau choix
    const cible = (el.isConnected && pretBot(el) && estBot(proprietaire(el))) ? el : encore;
    declencher(cible);
  }, DELAI_BOT());
}, 300);
// #endregion
