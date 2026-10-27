#!/usr/bin/env python3
"""APERÇU (pas branché) : faces de la carte dorée pour les thèmes Kawaii et Star Wars -> Cartes/apercu/"""
import os, random
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SORTIE = os.path.join(RACINE, "Cartes", "apercu"); os.makedirs(SORTIE, exist_ok=True)

def etincelle(x, y, r, c="#fff"):
    return f'<path d="M{x} {y-r} Q{x+r*.15} {y-r*.15} {x+r} {y} Q{x+r*.15} {y+r*.15} {x} {y+r} Q{x-r*.15} {y+r*.15} {x-r} {y} Q{x-r*.15} {y-r*.15} {x} {y-r}Z" fill="{c}"/>'

# ---------- Kawaii ----------
def kawaii():
    verre = '''
  <g transform="translate(50 62)">
    <!-- couronne -->
    <g transform="translate(0 -33)"><path d="M-12 8 L-14 -6 L-6 1 L0 -9 L6 1 L14 -6 L12 8 Z" fill="#ffd54f" stroke="#7a3b6e" stroke-width="1.8" stroke-linejoin="round"/>
      <rect x="-12" y="7" width="24" height="5" rx="2" fill="#ffc21a" stroke="#7a3b6e" stroke-width="1.8"/>
      <circle cx="-14" cy="-6" r="2.2" fill="#ff8fc2" stroke="#7a3b6e" stroke-width="1"/><circle cx="0" cy="-9" r="2.4" fill="#8fe6c9" stroke="#7a3b6e" stroke-width="1"/><circle cx="14" cy="-6" r="2.2" fill="#7fc8ff" stroke="#7a3b6e" stroke-width="1"/></g>
    <!-- verre -->
    <path d="M-15 -16 L15 -16 L11 22 Q0 26 -11 22 Z" fill="#e9f7ff" fill-opacity=".85" stroke="#7a3b6e" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M-13 -2 L13 -2 L11 22 Q0 26 -11 22 Z" fill="#ffb52e" stroke="#7a3b6e" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M-11 -12 L-9 14" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>
    <ellipse cx="-4.5" cy="7" rx="2" ry="2.6" fill="#3b2145"/><ellipse cx="4.5" cy="7" rx="2" ry="2.6" fill="#3b2145"/>
    <circle cx="-5.2" cy="6" r=".8" fill="#fff"/><circle cx="3.8" cy="6" r=".8" fill="#fff"/>
    <ellipse cx="-8.5" cy="11" rx="2.4" ry="1.5" fill="#ff7aa8" opacity=".8"/><ellipse cx="8.5" cy="11" rx="2.4" ry="1.5" fill="#ff7aa8" opacity=".8"/>
    <path d="M-2.4 10.5 Q0 13.5 2.4 10.5" fill="none" stroke="#7a3b6e" stroke-width="1.4" stroke-linecap="round"/>
  </g>'''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 156">
  <defs>
    <linearGradient id="or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".3" stop-color="#ffd34d"/><stop offset=".55" stop-color="#fff0a0"/><stop offset=".8" stop-color="#ffc21a"/><stop offset="1" stop-color="#fff3b0"/></linearGradient>
    <linearGradient id="holo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd0e8"/><stop offset=".3" stop-color="#e3d2ff"/><stop offset=".55" stop-color="#cdeeff"/><stop offset=".8" stop-color="#d5ffe8"/><stop offset="1" stop-color="#fff2c0"/></linearGradient>
    <clipPath id="int"><rect x="8" y="8" width="84" height="140" rx="5"/></clipPath>
  </defs>
  <rect x="0" y="0" width="100" height="156" rx="9" fill="#fff"/>
  <rect x="3" y="3" width="94" height="150" rx="7" fill="url(#or)" stroke="#e0a000" stroke-width="1"/>
  <rect x="8" y="8" width="84" height="140" rx="5" fill="url(#holo)"/>
  <g clip-path="url(#int)">
    <g opacity=".55">{''.join(f'<path d="M{-20+i*18} 160 L{40+i*18} -10" stroke="#fff" stroke-width="3"/>' for i in range(9))}</g>
    <ellipse cx="50" cy="78" rx="46" ry="26" transform="rotate(-50 50 78)" fill="#fff" fill-opacity=".7" stroke="#ffc21a" stroke-width="2.4"/>
    <ellipse cx="50" cy="78" rx="40" ry="20" transform="rotate(-50 50 78)" fill="none" stroke="#ffc21a" stroke-width="1" stroke-dasharray="2 3"/>
  </g>
  {verre}
  <g font-family="Arial Rounded MT Bold, Arial Black, sans-serif" font-weight="900" font-size="17" text-anchor="middle" letter-spacing="1">
    <text x="50" y="107" fill="#b8770a" stroke="#b8770a" stroke-width="3" transform="translate(0 1.6)">CUL</text><text x="50" y="125" fill="#b8770a" stroke="#b8770a" stroke-width="3" transform="translate(0 1.6)">SEC</text>
    <text x="50" y="107" fill="#ffc21a" stroke="#fff" stroke-width="2.4" paint-order="stroke">CUL</text><text x="50" y="125" fill="#ffc21a" stroke="#fff" stroke-width="2.4" paint-order="stroke">SEC</text></g>
  {etincelle(20,22,6)}{etincelle(80,30,4.5)}{etincelle(78,132,6)}{etincelle(20,130,4)}{etincelle(84,80,3,"#fff6a8")}{etincelle(14,70,3,"#fff6a8")}
  <path d="M16 42 C12 38 14 34 17 36 C20 34 22 38 16 42Z" fill="#ff8fc2" stroke="#fff" stroke-width=".6"/>
  <path d="M85 112 C81 108 83 104 86 106 C89 104 91 108 85 112Z" fill="#ff8fc2" stroke="#fff" stroke-width=".6"/>
  <g transform="translate(10 12) scale(.2)" fill="#7a3b6e"></g>
</svg>'''

# ---------- Star Wars ----------
def galaxie():
    r = random.Random(7)
    etoiles = ''.join(f'<circle cx="{r.uniform(10,90):.1f}" cy="{r.uniform(10,146):.1f}" r="{r.choice([.5,.7,.9,1.2])}" fill="#fff" opacity="{r.uniform(.4,1):.2f}"/>' for _ in range(28))
    tube = lambda d, w=2.2: (f'<path d="{d}" fill="none" stroke="#ffe81f" stroke-width="{w+3}" stroke-linecap="round" stroke-linejoin="round" opacity=".5" filter="url(#flou)"/>'
                          f'<path d="{d}" fill="none" stroke="#ffe81f" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
                          f'<path d="{d}" fill="none" stroke="#fff" stroke-width="{w*.4}" stroke-linecap="round" stroke-linejoin="round"/>')
    glass = tube("M-15 -16 L15 -16 L11 22 Q0 26 -11 22 Z") + tube("M-13 -2 L13 -2", 1.6) + tube("M-12 -24 L-14 -34 L-6 -28 L0 -38 L6 -28 L14 -34 L12 -24 Z", 1.8)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 156">
  <defs>
    <filter id="flou" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <radialGradient id="neb" cx="50%" cy="48%" r="75%"><stop offset="0" stop-color="#4a3a05"/><stop offset=".55" stop-color="#0c0a04"/><stop offset="1" stop-color="#020203"/></radialGradient>
    <linearGradient id="or" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2a0"/><stop offset=".35" stop-color="#c9a010"/><stop offset=".6" stop-color="#fff0a8"/><stop offset="1" stop-color="#a87e00"/></linearGradient>
    <clipPath id="int"><rect x="4.5" y="4.5" width="91" height="147" rx="6"/></clipPath>
  </defs>
  <rect x="0" y="0" width="100" height="156" rx="9" fill="url(#or)"/>
  <rect x="4.5" y="4.5" width="91" height="147" rx="6" fill="url(#neb)"/>
  <g clip-path="url(#int)">{etoiles}
    <g opacity=".35">{''.join(f'<rect x="0" y="{y}" width="100" height=".7" fill="#ffe81f"/>' for y in range(6,152,5))}</g>
    <ellipse cx="50" cy="78" rx="46" ry="26" transform="rotate(-50 50 78)" fill="#ffe81f" fill-opacity=".1" stroke="#ffe81f" stroke-opacity=".7" stroke-width="1.4"/></g>
  <rect x="7.5" y="7.5" width="85" height="141" rx="4.5" fill="none" stroke="#ffe81f" stroke-width="1.4" opacity=".9"/>
  <g transform="translate(50 62)">{glass}
    <path d="M-12 -2 L12 -2 L10 21 Q0 25 -10 21 Z" fill="#ffe81f" fill-opacity=".25"/></g>
  <g font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="17" text-anchor="middle" letter-spacing="1">
    <text x="50" y="107" fill="#ffe81f" stroke="#ffe81f" stroke-width="3" filter="url(#flou)" opacity=".6">CUL</text><text x="50" y="125" fill="#ffe81f" stroke="#ffe81f" stroke-width="3" filter="url(#flou)" opacity=".6">SEC</text>
    <text x="50" y="107" fill="#05060f" stroke="#ffe81f" stroke-width="1.6" paint-order="stroke">CUL</text><text x="50" y="125" fill="#05060f" stroke="#ffe81f" stroke-width="1.6" paint-order="stroke">SEC</text></g>
  {etincelle(18,20,5,"#fff")}{etincelle(84,26,4,"#fff")}{etincelle(82,134,5,"#ffe81f")}{etincelle(18,132,4,"#ffe81f")}
</svg>'''

open(os.path.join(SORTIE, "doree_kawaii.svg"), "w", encoding="utf-8").write(kawaii())
open(os.path.join(SORTIE, "doree_galaxie.svg"), "w", encoding="utf-8").write(galaxie())
print("ok")
