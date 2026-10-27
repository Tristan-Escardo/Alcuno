#!/usr/bin/env python3
"""Génère les faces de cartes du thème Kawaii : Cartes/kawaii/<nom>.svg (mêmes noms que Cartes/<nom>.webp).
Le CSS (outils/kawaii_deco.css, ajouté à style_kawaii.css par generer_kawaii.py) les applique sous html[data-theme="kawaii"].

    python3 outils/generer_cartes_kawaii.py
"""
import os, re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "Cartes", "kawaii")
os.makedirs(SORTIE, exist_ok=True)

COULEURS = {  # haut du dégradé, bas, contour foncé (relief des chiffres)
    "rouge": ("#ff7f9d", "#f23468", "#a30f3d"),
    "bleu":  ("#7ccbff", "#2f8ae6", "#12509c"),
    "vert":  ("#86e8a2", "#2dbb67", "#137a3f"),
    "jaune": ("#ffe97d", "#ffc21a", "#b87a00"),
}
NOMS_CHIFFRES = ["zero", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"]

# Chiffres tracés dans une boîte de 40 x 60 (trait épais à bouts ronds)
CHIFFRES = [
    "M20 6 C6 6 6 54 20 54 C34 54 34 6 20 6 Z",
    "M10 20 L22 8 L22 54",
    "M7 18 C8 4 33 4 33 20 C33 32 12 40 7 54 L34 54",
    "M8 10 C20 2 34 8 30 22 C28 28 20 30 16 30 C26 30 36 36 33 46 C30 58 12 58 6 50",
    "M28 54 L28 6 L6 38 L36 38",
    "M32 8 L10 8 L8 28 C22 22 36 28 34 42 C32 58 12 58 6 48",
    "M30 8 C16 10 8 22 8 40 C8 60 34 60 34 42 C34 28 16 26 8 40",
    "M6 8 L34 8 L16 54",
    "M20 30 C8 28 8 6 20 6 C32 6 32 28 20 30 C6 32 6 54 20 54 C34 54 34 32 20 30 Z",
    None,  # 9 = le 6 retourné
]
CHIFFRES[9] = "M30 8 C16 10 8 22 8 40 C8 60 34 60 34 42 C34 28 16 26 8 40"

def trace(d, fond, contour, largeur=7.5):
    """Un tracé blanc cerclé de la couleur foncée, avec une ombre décalée."""
    return (f'<path d="{d}" transform="translate(1.6 2.6)" fill="none" stroke="{contour}" stroke-opacity=".55" stroke-width="{largeur+5}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{contour}" stroke-width="{largeur+4.5}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="{fond}" stroke-width="{largeur}" stroke-linecap="round" stroke-linejoin="round"/>')

def chiffre(n, c):
    d = CHIFFRES[n]
    g = trace(d, "#fff", c[2])
    if n == 9:
        return f'<g transform="rotate(180 20 30)">{g}</g>'
    return g

def centre(contenu, ech=1.0, dx=0, dy=0):
    # contenu dessiné autour de (0, 0) ; ici placé au milieu de la carte (50, 78)
    return f'<g transform="translate({50+dx} {78+dy}) scale({ech})">{contenu}</g>'

def glyphe_chiffre(n, c):
    return f'<g transform="translate(-20 -30)">{chiffre(n, c)}</g>'

def plus(c, x=0, y=0, taille=11):
    d = f"M{x-taille} {y} H{x+taille} M{x} {y-taille} V{y+taille}"
    return trace(d, "#fff", c[2], 7)

def glyphe_plus_n(n, c):
    # « +2 » / « +4 » centré
    return plus(c, -27, 0, 10) + f'<g transform="translate(-6 -30)">{chiffre(n, c)}</g>'

def fleche(c, dx, dy, rot):
    d = "M0 7 H24 V1 L42 17 L24 33 V27 H0 Z"
    return (f'<g transform="rotate({rot}) translate({dx} {dy})"><path d="{d}" transform="translate(1.6 2.6)" fill="{c[2]}" fill-opacity=".55"/>'
            f'<path d="{d}" fill="#fff" stroke="{c[2]}" stroke-width="3.6" stroke-linejoin="round"/></g>')

def glyphe_inversion(c):
    return fleche(c, -21, -33, -50) + fleche(c, -21, -33, 130)

def glyphe_interdit(c):
    return (f'<circle r="21" fill="none" stroke="{c[2]}" stroke-opacity=".55" stroke-width="13" transform="translate(1.6 2.6)"/>'
            f'<circle r="21" fill="none" stroke="{c[2]}" stroke-width="13"/><circle r="21" fill="none" stroke="#fff" stroke-width="8.5"/>'
            f'<path d="M-14 14 L14 -14" stroke="{c[2]}" stroke-width="13" stroke-linecap="round"/><path d="M-14 14 L14 -14" stroke="#fff" stroke-width="8.5" stroke-linecap="round"/>')

def visage(x, y, k=1.0):
    return (f'<g transform="translate({x} {y}) scale({k})"><ellipse cx="-4.2" cy="0" rx="1.7" ry="2.2" fill="#3b2145"/><ellipse cx="4.2" cy="0" rx="1.7" ry="2.2" fill="#3b2145"/>'
            f'<circle cx="-4.8" cy="-.8" r=".7" fill="#fff"/><circle cx="3.6" cy="-.8" r=".7" fill="#fff"/>'
            f'<ellipse cx="-8" cy="3" rx="2.3" ry="1.5" fill="#ff9cb0" opacity=".7"/><ellipse cx="8" cy="3" rx="2.3" ry="1.5" fill="#ff9cb0" opacity=".7"/>'
            f'<path d="M-2 2.6 Q0 5 2 2.6" fill="none" stroke="#7a3b6e" stroke-width="1.1" stroke-linecap="round"/></g>')

def mini_carte(x, y, rot, fond, bord, visage_k=0.85):
    return (f'<g transform="translate({x} {y}) rotate({rot})"><rect x="-11" y="-16" width="22" height="32" rx="3.5" fill="{fond}" stroke="{bord}" stroke-width="2.2"/>'
            f'<ellipse cx="0" cy="0" rx="5.5" ry="11" transform="rotate(35)" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.2"/>{visage(0, 1, visage_k)}</g>')

def glyphe_plus2(c):
    return mini_carte(-8, -8, -10, "#fff", c[2]) + mini_carte(8, 8, 8, "#fff", c[2])

def glyphe_plus4():
    return (mini_carte(-14, 6, -14, "#7be39a", "#137a3f") + mini_carte(-4, -8, -4, "#7ccbff", "#12509c")
            + mini_carte(12, -10, 8, "#ffe97d", "#b87a00") + mini_carte(6, 8, 14, "#ff7f9d", "#a30f3d"))

def roue(r=1.0):
    # disque coupé en 4 (rouge, bleu, vert, jaune)
    return (f'<g transform="scale({r})"><circle r="20" fill="#fff"/>'
            f'<path d="M0 0 L0 -17 A17 17 0 0 1 17 0 Z" fill="#2f8ae6"/><path d="M0 0 L17 0 A17 17 0 0 1 0 17 Z" fill="#2dbb67"/>'
            f'<path d="M0 0 L0 17 A17 17 0 0 1 -17 0 Z" fill="#ffc21a"/><path d="M0 0 L-17 0 A17 17 0 0 1 0 -17 Z" fill="#f23468"/></g>')

def etincelle(x, y, r, c="#fff"):
    return (f'<path d="M{x} {y-r} Q{x+r*.15} {y-r*.15} {x+r} {y} Q{x+r*.15} {y+r*.15} {x} {y+r} Q{x-r*.15} {y+r*.15} {x-r} {y} Q{x-r*.15} {y-r*.15} {x} {y-r}Z" fill="{c}"/>')

def carte(haut, bas, fond_ovale, contenu_centre, coin, defs_id, coin_x=15):
    """Cadre blanc, fond en dégradé, ovale penché au milieu, indice dans deux coins (le second à l'envers)."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 156">
  <defs><linearGradient id="{defs_id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{haut}"/><stop offset="1" stop-color="{bas}"/></linearGradient>
  <clipPath id="int"><rect x="4.5" y="4.5" width="91" height="147" rx="6"/></clipPath></defs>
  <rect x="0" y="0" width="100" height="156" rx="9" fill="#fff"/>
  <rect x="4.5" y="4.5" width="91" height="147" rx="6" fill="url(#{defs_id})"/>
  <g clip-path="url(#int)">
    <ellipse cx="50" cy="78" rx="46" ry="26" transform="rotate(-50 50 78)" fill="{fond_ovale}" fill-opacity=".22" stroke="#fff" stroke-opacity=".9" stroke-width="1.6"/>
    {etincelle(80, 28, 4.5)}{etincelle(20, 128, 4)}{etincelle(78, 120, 2.6, "#fff6a8")}{etincelle(22, 34, 2.6, "#fff6a8")}
  </g>
  {contenu_centre}
  <g transform="translate({coin_x} 17) scale(.34)">{coin}</g>
  <g transform="rotate(180 50 78)"><g transform="translate({coin_x} 17) scale(.34)">{coin}</g></g>
</svg>'''

def ecrire(nom, svg):
    with open(os.path.join(SORTIE, nom + ".svg"), "w", encoding="utf-8") as f:
        f.write(svg)

total = 0
for cname, c in COULEURS.items():
    for n, nom in enumerate(NOMS_CHIFFRES):
        ecrire(f"{nom}_{cname}", carte(c[0], c[1], "#fff", centre(glyphe_chiffre(n, c), 1.25), glyphe_chiffre(n, c), "g")); total += 1
    ecrire(f"interdit_{cname}", carte(c[0], c[1], "#fff", centre(glyphe_interdit(c), 1.1), glyphe_interdit(c), "g")); total += 1
    ecrire(f"switch_{cname}", carte(c[0], c[1], "#fff", centre(glyphe_inversion(c), 1.0), glyphe_inversion(c), "g")); total += 1
    ecrire(f"plus_2_{cname}", carte(c[0], c[1], "#fff", centre(glyphe_plus2(c), 1.25), glyphe_plus_n(2, c), "g", 21)); total += 1

SOMBRE = ("#7a4fa0", "#3f2166", "#241040")
ecrire("plus_4", carte(SOMBRE[0], SOMBRE[1], "#fff", centre(glyphe_plus4(), 1.2), glyphe_plus_n(4, SOMBRE), "g", 21)); total += 1
ecrire("couleur", carte(SOMBRE[0], SOMBRE[1], "#fff", centre(roue(1.9)), roue(1.0), "g")); total += 1
# CSS : mêmes classes que les images d'origine (style_alcuno.css, « Cartes classes »), vers Cartes/kawaii/
source = open(os.path.join(RACINE, "style_alcuno.css"), encoding="utf-8").read()
regles = []
for m in re.finditer(r'^((?:\.[\w]+(?:, )?)+) \{ background-image: url\("Cartes/(\w+)\.webp"\); \}$', source, re.M):
    classes, fichier = m.group(1), m.group(2)
    sel = ", ".join(f'html[data-theme="kawaii"] {c.strip()}' for c in classes.split(","))
    regles.append(f'{sel} {{ background-image: url("Cartes/kawaii/{fichier}.svg"); }}')
with open(os.path.join(RACINE, "outils", "kawaii_cartes.css"), "w", encoding="utf-8") as f:
    f.write("/* GÉNÉRÉ par outils/generer_cartes_kawaii.py : faces de cartes du thème Kawaii */\n" + "\n".join(regles) + "\n")
print(f"{len(regles)} règles CSS")
print(f"{total} cartes écrites dans {SORTIE}")
