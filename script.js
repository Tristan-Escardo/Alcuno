document.addEventListener("DOMContentLoaded", function () {
  const plateau = document.getElementById("plateau");
  const totalCartes = 60;
  const classes = [
    "zero_vert", "zero_jaune", "zero_rouge", "zero_bleu", 
    "un_vert", "un_vert1", "un_jaune", "un_jaune1", "un_rouge", "un_rouge1", "un_bleu", "un_bleu1",
    "trois_vert", "trois_vert1", "trois_jaune", "trois_jaune1", "trois_rouge", "trois_rouge1", "trois_bleu", "trois_bleu1",
    "quatre_vert", "quatre_vert1", "quatre_jaune", "quatre_jaune1", "quatre_rouge", "quatre_rouge1", "quatre_bleu", "quatre_bleu1",
    "interdit_vert", "interdit_jaune", "interdit_rouge", "interdit_bleu",
    "couleur", "couleur1", "couleur2", "couleur3",
    "plus_2_vert", "plus_2_vert1", "plus_2_jaune", "plus_2_jaune1", "plus_2_rouge", "plus_2_rouge1", "plus_2_bleu", "plus_2_bleu1",
    "plus_4", "plus_4_1", "plus_4_2", "plus_4_3"
  ];
  const defi = [
    "deux_vert", "deux_vert1", "deux_jaune", "deux_jaune1", "deux_rouge", "deux_rouge1", "deux_bleu", "deux_bleu1",
    "cinq_vert", "cinq_vert1","cinq_jaune", "cinq_jaune1","cinq_rouge", "cinq_rouge1", "cinq_bleu", "cinq_bleu1",
    "six_vert", "six_vert1", "six_jaune", "six_jaune1", "six_rouge", "six_rouge1", "six_bleu", "six_bleu1",
    "sept_vert", "sept_vert1", "sept_jaune", "sept_jaune1", "sept_rouge", "sept_rouge1", "sept_bleu", "sept_bleu1",
    "huit_vert", "huit_vert1", "huit_jaune", "huit_jaune1", "huit_rouge", "huit_rouge1", "huit_bleu", "huit_bleu1",
    "neuf_vert", "neuf_vert1", "neuf_jaune", "neuf_jaune1", "neuf_rouge", "neuf_rouge1", "neuf_bleu", "neuf_bleu1"
  ];

  for (let i = 0; i < totalCartes; i++) {
    const carte = document.createElement("div");
    carte.classList.add("Carte");

    // Ajoute un gestionnaire de clic
    carte.addEventListener("click", function handleClick() {
      
      // Tirage au sort d'une classe
      const randomClass = classes[Math.floor(Math.random() * classes.length)];
      
      // Appliquer la classe et désactiver les clics suivants
      carte.classList.remove("zero_vert", "zero_jaune", "zero_rouge", "zero_bleu",
        "un_vert", "un_vert1", "un_jaune", "un_jaune1", "un_rouge", "un_rouge1", "un_bleu", "un_bleu1",
        "trois_vert", "trois_vert1", "trois_jaune", "trois_jaune1", "trois_rouge", "trois_rouge1", "trois_bleu", "trois_bleu1",
        "quatre_vert", "quatre_vert1", "quatre_jaune", "quatre_jaune1", "quatre_rouge", "quatre_rouge1", "quatre_bleu", "quatre_bleu1",
        "interdit_vert", "interdit_jaune", "interdit_rouge", "interdit_bleu",
        "couleur", "couleur1", "couleur2", "couleur3",
        "plus_2_vert", "plus_2_vert1", "plus_2_jaune", "plus_2_jaune1", "plus_2_rouge", "plus_2_rouge1", "plus_2_bleu", "plus_2_bleu1",
        "plus_4", "plus_4_1", "plus_4_2", "plus_4_3"
      );

      carte.classList.add(randomClass);

      // ❌ Désactiver ce gestionnaire après le premier clic
      carte.removeEventListener("click", handleClick);
    });

    plateau.appendChild(carte);
  }
});