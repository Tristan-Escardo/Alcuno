#!/usr/bin/env python3
"""Génère les faces de cartes du thème secret BDSM (nom interne : donjon) : Cartes/donjon/<nom>.svg (mêmes noms que Cartes/<nom>.webp).
Cuir noir capitonné avec des clous, liseré piqué de la couleur de la carte, ovale en latex verni, gros chiffre blanc.
Cupidon : deux cœurs reliés par des menottes. Écrit aussi les règles CSS dans style_donjon.css, entre deux repères.

    python3 outils/generer_cartes_donjon.py
"""
import os, re
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "Cartes", "donjon")
os.makedirs(SORTIE, exist_ok=True)
COULEURS = {  # couleur vive, couleur foncée (latex)
    "rouge": ("#ff2a3d", "#7a0612"), "bleu": ("#2f86ff", "#0a2a6a"),
    "vert": ("#22c95a", "#06481d"), "jaune": ("#ffd21f", "#7a5a00"),
}
NOMS = ["zero", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"]

def texte(t, taille, coul="#fff", contour="#0a0a0c", ep=None):
    ep = ep if ep is not None else taille * 0.11
    return (f'<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="{taille}" '
            f'fill="{coul}" stroke="{contour}" stroke-width="{ep}" paint-order="stroke fill" stroke-linejoin="round">{t}</text>')

def chiffre(n, col):
    t = str(n)
    souligne = '<rect x="-9" y="23" width="18" height="3.4" rx="1.7" fill="#fff" stroke="#0a0a0c" stroke-width="1.4"/>' if n in (6, 9) else ""
    return f'<g filter="url(#lueur)">{texte(t, 58)}</g>{souligne}'

def coin_txt(t, col): return texte(t, 15, "#fff", col, 2.6)

def mini_carte(x, y, rot, col):
    return (f'<g transform="translate({x} {y}) rotate({rot})"><rect x="-10" y="-15" width="20" height="30" rx="3" fill="#fff"/>'
            f'<rect x="-8.4" y="-13.4" width="16.8" height="26.8" rx="2" fill="#111" stroke="{col}" stroke-width="1.6"/>'
            f'<path d="M-4.5 -1.5 C-4.5 -4.5 -1.5 -5 0 -2.6 C1.5 -5 4.5 -4.5 4.5 -1.5 C4.5 2 1.5 3.6 0 5.2 C-1.5 3.6 -4.5 2 -4.5 -1.5Z" fill="{col}"/></g>')

def plus_n(n, cartes):
    """Gros « +n » blanc au centre (lisible comme les chiffres), mini-cartes en éventail au-dessus, à demi effacées."""
    return f'<g opacity=".8" transform="translate(0 -6) scale(.8)">{"".join(cartes)}</g><g transform="translate(0 12)" filter="url(#lueur)">{texte("+" + str(n), 44)}</g>'

def interdit(col):
    return ('<circle r="20" fill="none" stroke="#0a0a0c" stroke-width="11"/><circle r="20" fill="none" stroke="url(#chrome)" stroke-width="7.5"/>'
            '<circle r="20" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-dasharray="10 30"/>'
            '<path d="M-14 14 L14 -14" stroke="#0a0a0c" stroke-width="11" stroke-linecap="round"/><path d="M-14 14 L14 -14" stroke="url(#chrome)" stroke-width="7" stroke-linecap="round"/>')

def fleches():
    d = "M0 7 H22 V0 L40 15 L22 30 V23 H0 Z"
    f = lambda rot: f'<g transform="rotate({rot}) translate(-20 -30)"><path d="{d}" fill="#fff" stroke="#0a0a0c" stroke-width="3" stroke-linejoin="round"/></g>'
    return f(-50) + f(130)

def roue(r):
    return (f'<g transform="scale({r})"><circle r="21" fill="url(#chrome)" stroke="#0a0a0c" stroke-width="2"/>'
            '<path d="M0 0 L0 -17 A17 17 0 0 1 17 0 Z" fill="#2f86ff"/><path d="M0 0 L17 0 A17 17 0 0 1 0 17 Z" fill="#22c95a"/>'
            '<path d="M0 0 L0 17 A17 17 0 0 1 -17 0 Z" fill="#ffd21f"/><path d="M0 0 L-17 0 A17 17 0 0 1 0 -17 Z" fill="#ff2a3d"/>'
            '<circle r="17" fill="none" stroke="#0a0a0c" stroke-width="1.6"/><path d="M-11 -9 A14 14 0 0 1 4 -14" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round"/></g>')

def coeur(x, y, s, col):
    return (f'<g transform="translate({x} {y}) scale({s})"><path d="M0 -6 C-3 -13 -15 -12 -15 -2 C-15 7 -5 11 0 17 C5 11 15 7 15 -2 C15 -12 3 -13 0 -6Z" fill="{col}" stroke="#0a0a0c" stroke-width="2.2"/>'
            '<path d="M-10 -5 C-9 -9 -5 -10 -3 -7" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/></g>')
def menottes():
    anneau = lambda x: (f'<circle cx="{x}" cy="0" r="10" fill="none" stroke="#0a0a0c" stroke-width="6.5"/><circle cx="{x}" cy="0" r="10" fill="none" stroke="url(#chrome)" stroke-width="3.6"/>')
    chaine = ''.join(f'<ellipse cx="{x}" cy="0" rx="3" ry="2" fill="none" stroke="#0a0a0c" stroke-width="2.6"/><ellipse cx="{x}" cy="0" rx="3" ry="2" fill="none" stroke="#d9dbe2" stroke-width="1.3"/>' for x in (-5, 0, 5))
    return anneau(-17) + anneau(17) + chaine
def cupidon():
    return coeur(-17, -2, .95, "#ff3d71") + coeur(17, -2, .95, "#ff3d71") + f'<g transform="translate(0 20)">{menottes()}</g>'

def carte(col, fonce, centre, coin, coin_x=15, ovale=True):
    capiton = "".join(f'<path d="M{-60+i*16} 0 L{60+i*16} 156 M{160-i*16} 0 L{40-i*16} 156" />' for i in range(-2, 12))
    clous = "".join(f'<circle cx="{x}" cy="{y}" r="1.25"/>' for x in range(2, 100, 16) for y in range(4, 156, 24)) + \
            "".join(f'<circle cx="{x}" cy="{y}" r="1.25"/>' for x in range(10, 100, 16) for y in range(16, 156, 24))
    ov = (f'<g transform="rotate(-38 50 78)"><ellipse cx="50" cy="78" rx="32" ry="56" fill="url(#latex)" stroke="#0a0a0c" stroke-width="2"/>'
          f'<path d="M30 46 C34 34 44 26 54 25" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3.2" stroke-linecap="round"/>'
          f'<path d="M72 112 C68 122 60 129 52 131" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/></g>') if ovale else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 156">
  <defs>
    <linearGradient id="cuir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#26262c"/><stop offset=".5" stop-color="#0b0b0e"/><stop offset="1" stop-color="#1e1e24"/></linearGradient>
    <linearGradient id="latex" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{col}"/><stop offset=".55" stop-color="{fonce}"/><stop offset="1" stop-color="{col}"/></linearGradient>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#9ea2ad"/><stop offset=".55" stop-color="#5d616c"/><stop offset="1" stop-color="#e3e5ea"/></linearGradient>
    <filter id="lueur" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="1.6" stdDeviation="0" flood-color="#000"/><feDropShadow dx="0" dy="0" stdDeviation="2.6" flood-color="{col}" flood-opacity=".9"/></filter>
    <clipPath id="int"><rect x="4.5" y="4.5" width="91" height="147" rx="6"/></clipPath>
  </defs>
  <rect width="100" height="156" rx="9" fill="#fff"/>
  <rect x="4.5" y="4.5" width="91" height="147" rx="6" fill="url(#cuir)"/>
  <g clip-path="url(#int)"><g stroke="#000" stroke-opacity=".55" stroke-width=".9" fill="none">{capiton}</g><g stroke="#fff" stroke-opacity=".05" stroke-width=".5" fill="none" transform="translate(.8 0)">{capiton}</g>
    <g fill="#c9ccd4" opacity=".45">{clous}</g>{ov}</g>
  <rect x="8" y="8" width="84" height="140" rx="4.5" fill="none" stroke="{col}" stroke-width="1.3" stroke-dasharray="3.2 2.2"/>
  <g transform="translate(50 78) scale({centre[1]})">{centre[0]}</g>
  <g transform="translate({coin_x} 18)">{coin}</g>
  <g transform="rotate(180 50 78)"><g transform="translate({coin_x} 18)">{coin}</g></g>
</svg>'''

def ecrire(nom, svg): open(os.path.join(SORTIE, nom + ".svg"), "w").write(svg)
for k, (col, fonce) in COULEURS.items():
    for n, nom in enumerate(NOMS):
        ecrire(f"{nom}_{k}", carte(col, fonce, (chiffre(n, col), 1), coin_txt(n, col)))
    ecrire(f"interdit_{k}", carte(col, fonce, (interdit(col), 1.15), f'<g transform="scale(.36)">{interdit(col)}</g>'))
    ecrire(f"switch_{k}", carte(col, fonce, (fleches(), 1.05), f'<g transform="scale(.33)">{fleches()}</g>'))
    ecrire(f"plus_2_{k}", carte(col, fonce, (plus_n(2, [mini_carte(-13, -14, -16, col), mini_carte(13, -14, 14, col)]), 1), coin_txt("+2", col), 18))
ecrire("plus_4", carte("#ff2a3d", "#2a2a30", (plus_n(4, [mini_carte(-24, -18, -24, "#22c95a"), mini_carte(-8, -24, -8, "#2f86ff"), mini_carte(8, -24, 8, "#ffd21f"), mini_carte(24, -18, 24, "#ff2a3d")]), 1), coin_txt("+4", "#ff2a3d"), 18, False))
ecrire("couleur", carte("#e8e8ee", "#2a2a30", (roue(1.7), 1), f'<g transform="scale(.42)">{roue(1)}</g>', 15, False))
ecrire("cupidon", carte("#ff3d71", "#6a0a2a", (cupidon(), 1.1), f'<g transform="scale(.42)">{coeur(0, 0, 1, "#ff3d71")}</g>', 15))
# CSS : mêmes classes que les images d'origine, vers Cartes/donjon/ ; écrit dans style_donjon.css entre deux repères
css_path = os.path.join(RACINE, "style_donjon.css")
source = open(css_path, encoding="utf-8").read()
origine = open(os.path.join(RACINE, "style_alcuno.css"), encoding="utf-8").read()
DEBUT, FIN = "/* ===== Faces de cartes BDSM (généré par outils/generer_cartes_donjon.py) ===== */", "/* ===== fin des faces de cartes BDSM ===== */"
if DEBUT in source:
    source = source[:source.index(DEBUT)].rstrip("\n") + "\n" + (source[source.index(FIN) + len(FIN):] if FIN in source else "")
regles = []
for m in re.finditer(r'^((?:\.[\w]+(?:, )?)+) \{ background-image: url\("Cartes/(\w+)\.webp"\); \}$', origine, re.M):
    sel = ", ".join(f'html[data-theme="donjon"] {c.strip()}' for c in m.group(1).split(","))
    regles.append(f'{sel} {{ background-image: url("Cartes/donjon/{m.group(2)}.svg"); }}')
with open(css_path, "w", encoding="utf-8") as f:
    f.write(source.rstrip("\n") + "\n\n" + DEBUT + "\n" + "\n".join(regles) + "\n" + FIN + "\n")
print(f"{len(regles)} règles CSS")
print(f"{len(os.listdir(SORTIE))} cartes dans {SORTIE}")
