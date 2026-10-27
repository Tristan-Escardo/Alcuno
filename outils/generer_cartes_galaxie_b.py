#!/usr/bin/env python3
"""Variante B des faces Star Wars : plaques métalliques colorées, chiffres anguleux « pochoir », trame d'hexagones. Cartes/galaxie_b/"""
import os
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "Cartes", "galaxie_b"); os.makedirs(SORTIE, exist_ok=True)
COULEURS = {  # haut, bas, foncé, clair
    "rouge": ("#e5303c", "#8f0f1b", "#4a050c", "#ff8a92"),
    "bleu":  ("#2f7fe0", "#123f91", "#071f4d", "#8fc2ff"),
    "vert":  ("#2fb860", "#0f6a31", "#053a19", "#8ff0b1"),
    "jaune": ("#ffd400", "#c08a00", "#5e4200", "#fff08a"),
}
NOMS = ["zero","un","deux","trois","quatre","cinq","six","sept","huit","neuf"]
CH = ["M12 6 H28 L34 12 V48 L28 54 H12 L6 48 V12 Z","M12 16 L22 6 V54","M6 6 H34 V30 H6 V54 H34","M6 6 H34 V54 H6 M12 30 H34",
      "M6 6 V30 H34 M28 6 V54","M34 6 H6 V30 H34 V54 H6","M34 6 H6 V54 H34 V30 H6","M6 6 H34 L18 54","M6 6 H34 V54 H6 Z M6 30 H34","M34 30 H6 V6 H34 V54 H6"]
def trace(d, c, w=8.5, remplissage="#fff"):
    s = 'stroke-linejoin="miter" stroke-linecap="square" fill="none"'
    return (f'<path d="{d}" transform="translate(1.8 2.8)" {s} stroke="{c[2]}" stroke-opacity=".7" stroke-width="{w+4}"/>'
            f'<path d="{d}" {s} stroke="{c[2]}" stroke-width="{w+4}"/><path d="{d}" {s} stroke="{remplissage}" stroke-width="{w}"/>')
def chiffre(n, c): return f'<g transform="translate(-20 -30)">{trace(CH[n], c)}</g>'
def plus_n(n, c): return trace("M-37 0 H-17 M-27 -10 V10", c, 7) + f'<g transform="translate(-6 -30)">{trace(CH[n], c)}</g>'
def interdit(c):
    hexa = "M-12 -21 H12 L24 0 L12 21 H-12 L-24 0 Z"
    return trace(hexa, c, 6) + trace("M-14 14 L14 -14", c, 7)
def fleche(c, rot):
    d = "M0 7 H22 V0 L42 17 L22 34 V27 H0 Z"
    return f'<g transform="rotate({rot}) translate(-21 -34)"><path d="{d}" transform="translate(1.6 2.6)" fill="{c[2]}" fill-opacity=".7"/><path d="{d}" fill="#fff" stroke="{c[2]}" stroke-width="3" stroke-linejoin="miter"/></g>'
def inversion(c): return fleche(c, -50) + fleche(c, 130)
def plaque(x, y, rot, haut, bas, bord):
    return (f'<g transform="translate({x} {y}) rotate({rot})"><rect x="-11" y="-16" width="22" height="32" rx="2" fill="url(#{haut})" stroke="{bord}" stroke-width="2.2"/>'
            f'<path d="M-11 -9 H11" stroke="{bord}" stroke-opacity=".6" stroke-width="1"/><path d="M0 -5 L5 0 L0 5 L-5 0Z" fill="#fff" fill-opacity=".9"/></g>')
def plus2(c): return plaque(-8, -8, -10, "pl", "", "#fff") + plaque(8, 8, 8, "pl", "", "#fff")
def plus4(): return plaque(-14, 6, -14, "pg", "", "#053a19") + plaque(-4, -8, -4, "pb", "", "#071f4d") + plaque(12, -10, 8, "py", "", "#5e4200") + plaque(6, 8, 14, "pr", "", "#4a050c")
def roue(r):
    return (f'<g transform="scale({r})"><path d="M-12 -21 H12 L24 0 L12 21 H-12 L-24 0 Z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="miter"/>'
            '<path d="M0 0 L0 -18 H11 L21 0 Z" fill="#2f7fe0"/><path d="M0 0 L21 0 L11 18 H0 Z" fill="#2fb860"/><path d="M0 0 H-21 L-11 18 H0 Z" fill="#ffd400"/><path d="M0 0 L-21 0 L-11 -18 H0 Z" fill="#e5303c"/></g>')
def hexa_trame():
    out = ""
    for ry, y in enumerate(range(0, 170, 14)):
        for x in range(-6, 110, 16):
            ox = 8 if ry % 2 else 0
            out += f'<path d="M{x+ox+4} {y} h8 l4 7 l-4 7 h-8 l-4 -7z" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".8"/>'
    return out
def carte(c, centre, coin, coin_x=15, sombre=False):
    h, b, f, l = c
    degr = f'<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{h}"/><stop offset="1" stop-color="{b}"/></linearGradient>'
    pl = ''.join(f'<linearGradient id="{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{u}"/><stop offset="1" stop-color="{v}"/></linearGradient>'
        for i, u, v in [("pl", "#f4f6fa", "#aeb6c6"), ("pg", "#8ff0b1", "#2fb860"), ("pb", "#8fc2ff", "#2f7fe0"), ("py", "#fff08a", "#ffd400"), ("pr", "#ff8a92", "#e5303c")])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 156">
  <defs>{degr}{pl}<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9edf3"/><stop offset=".5" stop-color="#9aa3b2"/><stop offset="1" stop-color="#d7dce5"/></linearGradient>
  <clipPath id="int"><rect x="6" y="6" width="88" height="144" rx="4"/></clipPath></defs>
  <rect x="0" y="0" width="100" height="156" rx="9" fill="url(#metal)"/>
  <rect x="6" y="6" width="88" height="144" rx="4" fill="url(#g)"/>
  <g clip-path="url(#int)">{hexa_trame()}<ellipse cx="50" cy="78" rx="46" ry="26" transform="rotate(-50 50 78)" fill="#fff" fill-opacity=".12" stroke="#fff" stroke-opacity=".8" stroke-width="1.4"/>
  <ellipse cx="50" cy="78" rx="38" ry="19" transform="rotate(-50 50 78)" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1" stroke-dasharray="3 3"/></g>
  <rect x="6" y="6" width="88" height="144" rx="4" fill="none" stroke="{f}" stroke-width="1.6"/>
  {''.join(f'<circle cx="{x}" cy="{y}" r="1.6" fill="#5b6475"/>' for x in (3, 97) for y in (3, 153))}
  <g transform="translate(50 78) scale({centre[1]})">{centre[0]}</g>
  <g transform="translate({coin_x} 19) scale(.34)">{coin}</g>
  <g transform="rotate(180 50 78)"><g transform="translate({coin_x} 19) scale(.34)">{coin}</g></g>
</svg>'''
n_ = 0
def ecrire(nom, svg):
    global n_; n_ += 1; open(os.path.join(SORTIE, nom + ".svg"), "w", encoding="utf-8").write(svg)
for k, c in COULEURS.items():
    for n, nom in enumerate(NOMS): ecrire(f"{nom}_{k}", carte(c, (chiffre(n, c), 1.25), chiffre(n, c)))
    ecrire(f"interdit_{k}", carte(c, (interdit(c), 1.1), interdit(c)))
    ecrire(f"switch_{k}", carte(c, (inversion(c), 1.0), inversion(c)))
    ecrire(f"plus_2_{k}", carte(c, (plus2(c), 1.25), plus_n(2, c), 21))
N = ("#5b4e8a", "#2a2150", "#120c2e", "#bda8ff")
ecrire("plus_4", carte(N, (plus4(), 1.2), plus_n(4, N), 21)); ecrire("couleur", carte(N, (roue(1.9), 1), roue(1.0)))
print(n_, "cartes")
