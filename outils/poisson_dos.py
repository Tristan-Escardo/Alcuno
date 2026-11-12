#!/usr/bin/env python3
"""Génère, dans style_poisson.css, les dos de cartes « UNO » du poisson d'avril (blague 1).
Pour chaque règle des CSS du jeu qui met un dos « ALC UNO » (Cartes/dos.gif, dos_galaxie_*.svg, dos_kawaii_alcuno_*.svg),
on écrit la même règle préfixée par html.poisson-uno, avec l'image « UNO » correspondante (nouveaux noms de fichiers).
Usage :  python3 outils/poisson_dos.py   (puis node outils/maj_empreinte_cache.js)"""
import re, os
RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
REMPLACE = {
    "dos.gif": "dos_uno.svg",
    "dos_galaxie_argent.svg": "dos_galaxie_argent_uno.svg",
    "dos_galaxie_hyperespace.svg": "dos_galaxie_hyperespace_uno.svg",
    "dos_galaxie_planete.svg": "dos_galaxie_planete_uno.svg",
    "dos_kawaii_alcuno_licorne.svg": "dos_kawaii_uno_licorne.svg",
    "dos_kawaii_alcuno_nuages.svg": "dos_kawaii_uno_nuages.svg",
    "dos_kawaii_alcuno_gourmand.svg": "dos_kawaii_uno_gourmand.svg",
}
PAT = re.compile(r'url\("Cartes/(dos\.gif|dos_galaxie_\w+\.svg|dos_kawaii_alcuno_\w+\.svg)"\)')
DEBUT, FIN = "/* >>> généré par outils/poisson_dos.py : ne pas modifier à la main >>> */", "/* <<< fin du bloc généré <<< */"

def prefixe(sel):
    sel = sel.strip()
    if sel.startswith("html"):
        return "html.poisson-uno" + sel[4:]
    return "html.poisson-uno " + sel

regles = []
for f in ["style_alcuno.css", "style_kawaii.css"]:
    s = open(os.path.join(RACINE, f), encoding="utf8").read()
    for m in PAT.finditer(s):
        o = s.rfind("{", 0, m.start()); c = s.find("}", m.end())
        coupe = max(s.rfind("}", 0, o), s.rfind("*/", 0, o) + 1 if s.rfind("*/", 0, o) >= 0 else -1) + 1
        sel = re.sub(r"\s+", " ", s[coupe:o]).strip()
        if sel == ".Carte":   # le dos par défaut : seulement les cartes de dos (les faces gardent leur image)
            sel = '.Carte:not(.retournee):not([class*="_"]):not([class*="couleur"])'
        if sel.startswith('.Carte:not(.retournee)'):   # le dos de la carte dorée (classe dos_dore) doit suivre, sinon elle se reconnaît
            sel += ',.Carte.dos_dore:not(.retournee)'
        sels = [prefixe(x) for x in sel.split(",")]
        regles.append(",\n".join(sels) + '{ background-image: url("Cartes/%s") !important; }' % REMPLACE[m.group(1)])
bloc = DEBUT + "\n" + "\n".join(regles) + "\n" + FIN
p = os.path.join(RACINE, "style_poisson.css"); css = open(p, encoding="utf8").read()
if DEBUT in css: css = css[:css.index(DEBUT)].rstrip() + "\n\n" + bloc + "\n"
else: css = css.rstrip() + "\n\n/* Dos de cartes « UNO » (blague 1 : html.poisson-uno posé par js/poisson.js) */\n" + bloc + "\n"
open(p, "w", encoding="utf8").write(css)
print(len(regles), "règles écrites dans style_poisson.css")
