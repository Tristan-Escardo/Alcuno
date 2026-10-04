// Chargé AVANT le jeu : capture des erreurs + hasard fixé (graine dans l'adresse : ?graine=123)
window.__erreurs = [];
window.onerror = function(m, s, l){ window.__erreurs.push(String(m) + " @" + l); };
window.addEventListener("unhandledrejection", function(e){ window.__erreurs.push("promesse: " + String(e.reason)); });
(function(){
  var g = new URLSearchParams(location.search).get("graine") || "12345";
  var a = Number(g) >>> 0;
  Math.random = function(){
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  var debut = 1790000000000; Date.now = function(){ return debut; }; // anti-cache stable
})();
