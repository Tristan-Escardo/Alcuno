# Dos des cartes Shifumi (duel Shifumi « cartes », js/regles.js) : un dos commun à tous les thèmes, plus un dos pour
# Star Wars (galaxie), Kawaii et BDSM (donjon), faits à partir des dos de cartes de ces thèmes (« ALC / UNO » devient
# « SHI / FUMI »). Givre : le dos commun, givré en CSS comme les autres cartes. Lancer depuis la racine du jeu :
#   python3 outils/generer_dos_shifumi.py
# Android : le dos Star Wars a des flous SVG (cassés sur Android, comme les autres dos du thème) : une copie en image,
# Cartes/shifumi/dos_shifumi_galaxie_android.webp (300 x 468), est faite à partir du SVG (capture du navigateur).
import re

def shi_fumi(svg):
    svg = svg.replace(">ALC<", ">SHI<")
    # « FUMI » (4 lettres) un peu plus petit que « UNO », pour tenir dans l'ovale
    return re.sub(r'(<text[^>]*font-size=")(\d+(?:\.\d+)?)("[^>]*>)UNO<',
                  lambda m: f'{m.group(1)}{round(float(m.group(2)) * 0.8, 1)}{m.group(3)}FUMI<', svg)

MAINS = '<text x="50" y="{y}" font-size="{t}" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">✊✋✌️</text>'

# Dos commun : comme le dos du jeu (noir, ovale rouge, lettres jaunes)
commun = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 156">
  <rect width="100" height="156" rx="9" fill="#fff"/>
  <rect x="5" y="5" width="90" height="146" rx="6" fill="#000"/>
  <ellipse cx="50" cy="78" rx="46" ry="27" transform="rotate(-28 50 78)" fill="#e8180c"/>
  <g transform="rotate(-22 50 78)" font-family="Arial Black, Arial, sans-serif" font-weight="900" text-anchor="middle" fill="#FFE81F" stroke="#000" stroke-width="3" paint-order="stroke" letter-spacing="1">
    <text x="50" y="72" font-size="25">SHI</text>
    <text x="50" y="98" font-size="21">FUMI</text>
  </g>
</svg>
'''
open("Cartes/shifumi/dos_shifumi.svg", "w").write(commun)

open("Cartes/shifumi/dos_shifumi_galaxie.svg", "w").write(shi_fumi(open("Cartes/dos_galaxie_argent.svg").read()))
open("Cartes/shifumi/dos_shifumi_kawaii.svg", "w").write(shi_fumi(open("Cartes/dos_kawaii_alcuno_licorne.svg").read()))

# BDSM : le cœur masqué du dos du thème, plus petit en haut, « SHIFUMI » en rouge
donjon = open("Cartes/dos_donjon.svg").read()
debut = donjon.index('<path d="M26 74')
fin = donjon.rindex("</svg>")
cadre, coeur = donjon[:debut], donjon[debut:fin]
donjon = (cadre + '<g transform="translate(50 66) scale(.62) translate(-50 -83)">' + coeur + '</g>'
  + '<text x="50" y="118" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="15" text-anchor="middle" letter-spacing="1" fill="#d8102a" stroke="#000" stroke-width="2" paint-order="stroke">SHIFUMI</text>'
  + "</svg>\n")
open("Cartes/shifumi/dos_shifumi_donjon.svg", "w").write(donjon)
print("Dos Shifumi écrits dans Cartes/shifumi/")
