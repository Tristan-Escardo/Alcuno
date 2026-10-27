#!/usr/bin/env python3
"""Génère les faces de cartes du thème Star Wars (galaxie) : Cartes/galaxie/<nom>.svg (mêmes noms que Cartes/<nom>.webp).
Chiffres et symboles en « tubes de sabre laser » (halo coloré, cœur blanc) sur fond d'espace.

    python3 outils/generer_cartes_galaxie.py
"""
import os, random, re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "Cartes", "galaxie")
os.makedirs(SORTIE, exist_ok=True)

COULEURS = {  # couleur du sabre, teinte du fond
    "rouge": ("#ff2d3d", "#5a0612"),
    "bleu":  ("#2f9bff", "#08265a"),
    "vert":  ("#2cff6a", "#08401c"),
    "jaune": ("#ffe81f", "#5a4a02"),
}
NOMS_CHIFFRES = ["zero", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"]
CHIFFRES = [
    "M20 6 C6 6 6 54 20 54 C34 54 34 6 20 6 Z", "M10 20 L22 8 L22 54",
    "M7 18 C8 4 33 4 33 20 C33 32 12 40 7 54 L34 54",
    "M8 10 C20 2 34 8 30 22 C28 28 20 30 16 30 C26 30 36 36 33 46 C30 58 12 58 6 50",
    "M28 54 L28 6 L6 38 L36 38", "M32 8 L10 8 L8 28 C22 22 36 28 34 42 C32 58 12 58 6 48",
    "M30 8 C16 10 8 22 8 40 C8 60 34 60 34 42 C34 28 16 26 8 40", "M6 8 L34 8 L16 54",
    "M20 30 C8 28 8 6 20 6 C32 6 32 28 20 30 C6 32 6 54 20 54 C34 54 34 32 20 30 Z",
    "M30 8 C16 10 8 22 8 40 C8 60 34 60 34 42 C34 28 16 26 8 40",
]

def tube(d, col, w=6.5, fill="none"):
    """Tracé en sabre laser : halo flou de la couleur, trait de la couleur, cœur blanc."""
    return (f'<path d="{d}" fill="{fill}" stroke="{col}" stroke-width="{w+5}" stroke-linecap="round" stroke-linejoin="round" opacity=".55" filter="url(#flou)"/>'
            f'<path d="{d}" fill="{fill}" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{d}" fill="none" stroke="#fff" stroke-width="{w*0.42}" stroke-linecap="round" stroke-linejoin="round"/>')

def chiffre(n, col):
    g = tube(CHIFFRES[n], col)
    return f'<g transform="rotate(180 20 30)">{g}</g>' if n == 9 else g

def glyphe_chiffre(n, col): return f'<g transform="translate(-20 -30)">{chiffre(n, col)}</g>'
def plus(col, x=0, y=0, t=10): return tube(f"M{x-t} {y} H{x+t} M{x} {y-t} V{y+t}", col, 6)
def glyphe_plus_n(n, col): return plus(col, -27, 0, 10) + f'<g transform="translate(-6 -30)">{chiffre(n, col)}</g>'

def fleche(col, rot):
    d = "M0 7 H24 V1 L42 17 L24 33 V27 H0 Z"
    return f'<g transform="rotate({rot}) translate(-21 -33)">{tube(d, col, 3.4, "#0a1024")}</g>'
def glyphe_inversion(col): return fleche(col, -50) + fleche(col, 130)
def glyphe_interdit(col):
    return (f'<circle r="21" fill="none" stroke="{col}" stroke-width="12" opacity=".55" filter="url(#flou)"/><circle r="21" fill="none" stroke="{col}" stroke-width="7"/><circle r="21" fill="none" stroke="#fff" stroke-width="3"/>'
            + tube("M-14 14 L14 -14", col, 7))

def holocarte(x, y, rot, col):
    return (f'<g transform="translate({x} {y}) rotate({rot})"><rect x="-11" y="-16" width="22" height="32" rx="3.5" fill="#0a1024" stroke="{col}" stroke-width="2.4"/>'
            f'<rect x="-11" y="-16" width="22" height="32" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8"/>'
            f'<ellipse rx="5.5" ry="11" transform="rotate(35)" fill="none" stroke="{col}" stroke-opacity=".8" stroke-width="1.2"/>'
            f'<path d="M0 -4 L1.3 -1.3 L4 0 L1.3 1.3 L0 4 L-1.3 1.3 L-4 0 L-1.3 -1.3Z" fill="#fff"/></g>')
def glyphe_plus2(col): return holocarte(-8, -8, -10, col) + holocarte(8, 8, 8, col)
def glyphe_plus4():
    return (holocarte(-14, 6, -14, "#2cff6a") + holocarte(-4, -8, -4, "#2f9bff") + holocarte(12, -10, 8, "#ffe81f") + holocarte(6, 8, 14, "#ff2d3d"))
def roue(r=1.0):
    return (f'<g transform="scale({r})"><circle r="21" fill="#fff" opacity=".9" filter="url(#flou)"/><circle r="20" fill="#0a1024" stroke="#fff" stroke-width="1.6"/>'
            f'<path d="M0 0 L0 -17 A17 17 0 0 1 17 0 Z" fill="#2f9bff"/><path d="M0 0 L17 0 A17 17 0 0 1 0 17 Z" fill="#2cff6a"/>'
            f'<path d="M0 0 L0 17 A17 17 0 0 1 -17 0 Z" fill="#ffe81f"/><path d="M0 0 L-17 0 A17 17 0 0 1 0 -17 Z" fill="#ff2d3d"/></g>')

def etoiles(graine):
    r = random.Random(graine)
    out = ""
    for _ in range(26):
        x, y, t = r.uniform(8, 92), r.uniform(8, 148), r.choice([.5, .6, .8, 1.0, 1.3])
        out += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{t}" fill="#fff" opacity="{r.uniform(.45, 1):.2f}"/>'
    return out

def carte(col, teinte, centre, coin, graine, coin_x=15):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 156">
  <defs>
    <filter id="flou" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <radialGradient id="neb" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="{teinte}"/><stop offset=".6" stop-color="#070b1c"/><stop offset="1" stop-color="#020308"/></radialGradient>
    <clipPath id="int"><rect x="4.5" y="4.5" width="91" height="147" rx="6"/></clipPath>
  </defs>
  <rect x="0" y="0" width="100" height="156" rx="9" fill="#fff"/>
  <rect x="4.5" y="4.5" width="91" height="147" rx="6" fill="url(#neb)"/>
  <g clip-path="url(#int)">{etoiles(graine)}
    <ellipse cx="50" cy="78" rx="46" ry="26" transform="rotate(-50 50 78)" fill="{col}" fill-opacity=".10" stroke="{col}" stroke-opacity=".55" stroke-width="1.2"/></g>
  <rect x="7.5" y="7.5" width="85" height="141" rx="4.5" fill="none" stroke="{col}" stroke-width="1.4" opacity=".9"/>
  <g transform="translate(50 78) scale({centre[1]})">{centre[0]}</g>
  <g transform="translate({coin_x} 17) scale(.34)">{coin}</g>
  <g transform="rotate(180 50 78)"><g transform="translate({coin_x} 17) scale(.34)">{coin}</g></g>
</svg>'''

def ecrire(nom, svg):
    with open(os.path.join(SORTIE, nom + ".svg"), "w", encoding="utf-8") as f: f.write(svg)

total = 0
for k, (col, teinte) in COULEURS.items():
    for n, nom in enumerate(NOMS_CHIFFRES):
        ecrire(f"{nom}_{k}", carte(col, teinte, (glyphe_chiffre(n, col), 1.25), glyphe_chiffre(n, col), total)); total += 1
    ecrire(f"interdit_{k}", carte(col, teinte, (glyphe_interdit(col), 1.1), glyphe_interdit(col), total)); total += 1
    ecrire(f"switch_{k}", carte(col, teinte, (glyphe_inversion(col), 1.0), glyphe_inversion(col), total)); total += 1
    ecrire(f"plus_2_{k}", carte(col, teinte, (glyphe_plus2(col), 1.25), glyphe_plus_n(2, col), total, 21)); total += 1
BLANC = "#e8edf5"
ecrire("plus_4", carte(BLANC, "#2a2150", (glyphe_plus4(), 1.2), glyphe_plus_n(4, BLANC), total, 21)); total += 1
ecrire("couleur", carte(BLANC, "#2a2150", (roue(1.9), 1), roue(1.0), total + 1)); total += 1
# CSS : mêmes classes que les images d'origine, vers Cartes/galaxie/ ; écrit dans style_alcuno.css entre deux repères
css_path = os.path.join(RACINE, "style_alcuno.css")
source = open(css_path, encoding="utf-8").read()
DEBUT, FIN = "/* ===== Faces de cartes Star Wars (généré par outils/generer_cartes_galaxie.py) ===== */", "/* ===== fin des faces de cartes Star Wars ===== */"
if DEBUT in source:
    source = source[:source.index(DEBUT)].rstrip("\n") + "\n" + (source[source.index(FIN) + len(FIN):] if FIN in source else "")
regles = []
for m in re.finditer(r'^((?:\.[\w]+(?:, )?)+) \{ background-image: url\("Cartes/(\w+)\.webp"\); \}$', source, re.M):
    sel = ", ".join(f'html[data-theme="galaxie"] {c.strip()}' for c in m.group(1).split(","))
    regles.append(f'{sel} {{ background-image: url("Cartes/galaxie/{m.group(2)}.svg"); }}')
with open(css_path, "w", encoding="utf-8") as f:
    f.write(source.rstrip("\n") + "\n\n" + DEBUT + "\n" + "\n".join(regles) + "\n" + FIN + "\n")
print(f"{len(regles)} règles CSS")
print(f"{total} cartes écrites dans {SORTIE}")
