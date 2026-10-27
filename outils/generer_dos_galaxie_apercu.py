#!/usr/bin/env python3
"""APERÇU (pas branché) : deux autres dos Star Wars à faire alterner avec dos_galaxie_argent.svg -> Cartes/apercu/"""
import os, random, math
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = open(os.path.join(RACINE, "Cartes", "dos_galaxie_argent.svg"), encoding="utf-8").read().split("\n")
SORTIE = os.path.join(RACINE, "Cartes", "apercu"); os.makedirs(SORTIE, exist_ok=True)
# lignes 16 à 33 (index 15..32) = les sabres, clippés dans l'ovale
def remplace(art, defs=""):
    haut = "\n".join(BASE[:15]).replace("</defs>", defs + "</defs>")
    return haut + "\n  <g clip-path=\"url(#interieur)\">" + art + "</g>\n" + "\n".join(BASE[33:])

r = random.Random(3)
# B : saut dans l'hyperespace : traits de lumière qui partent du centre
traits = ""
for i in range(46):
    a = r.uniform(0, 2 * math.pi); d1, d2 = r.uniform(8, 20), r.uniform(30, 70)
    c = r.choice(["#fff", "#9fd4ff", "#cfe6ff", "#fff3b0"])
    traits += f'<path d="M{50+d1*math.cos(a):.1f} {78+d1*math.sin(a):.1f} L{50+d2*math.cos(a):.1f} {78+d2*math.sin(a):.1f}" stroke="{c}" stroke-width="{r.choice([.5,.8,1.1,1.5])}" stroke-linecap="round" opacity="{r.uniform(.5,1):.2f}"/>'
B = remplace('<rect x="0" y="0" width="100" height="156" fill="#050a1e"/><circle cx="50" cy="78" r="26" fill="#2a63ff" opacity=".35" filter="url(#lueur)"/>' + traits + '<circle cx="50" cy="78" r="5" fill="#fff" filter="url(#lueur2)"/>')

# C : planète à anneau, lune et chasseur stellaire (silhouette générique)
etoiles = ''.join(f'<circle cx="{r.uniform(5,95):.1f}" cy="{r.uniform(40,120):.1f}" r="{r.choice([.4,.6,.8])}" fill="#fff"/>' for _ in range(26))
C = remplace('<rect x="0" y="0" width="100" height="156" fill="#060a1c"/>' + etoiles + '''
  <circle cx="42" cy="86" r="17" fill="url(#planete)"/><ellipse cx="42" cy="86" rx="30" ry="6.5" transform="rotate(-25 42 86)" fill="none" stroke="#ffd9a0" stroke-width="2.4" opacity=".9"/>
  <path d="M25 79 A17 17 0 0 1 59 79" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1"/>
  <circle cx="68" cy="64" r="4.5" fill="#cfd6e6"/><circle cx="66.6" cy="62.8" r="1.4" fill="#9aa3b8"/>
  <g transform="translate(74 98) rotate(-35) scale(.8)"><path d="M-12 0 L-3 -2 L-3 -9 L2 -2 L12 0 L2 2 L-3 9 L-3 2 Z" fill="#dfe6f2" stroke="#05060f" stroke-width="1"/><rect x="-14" y="-.9" width="6" height="1.8" fill="#ff5a5a" filter="url(#lueur2)"/></g>''',
 '<radialGradient id="planete" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffb870"/><stop offset=".6" stop-color="#c2542e"/><stop offset="1" stop-color="#4a1a14"/></radialGradient>')
def teinte(svg, haut, bas):  # teinte de la plaque : acier bleuté / bronze
    return svg.replace('<stop offset="0" stop-color="#dfe5ef"/><stop offset="1" stop-color="#8d97aa"/>', f'<stop offset="0" stop-color="{haut}"/><stop offset="1" stop-color="{bas}"/>')
B = teinte(B, "#cfe0f7", "#6f8fbf")
C = teinte(C, "#f0dcc2", "#a98660")
open(os.path.join(SORTIE, "dos_galaxie_hyperespace.svg"), "w", encoding="utf-8").write(B)
open(os.path.join(SORTIE, "dos_galaxie_planete.svg"), "w", encoding="utf-8").write(C)
print("ok")
