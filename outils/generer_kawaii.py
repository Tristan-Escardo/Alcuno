#!/usr/bin/env python3
"""Génère style_kawaii.css : le thème Kawaii (clair, rose) reprend toutes les règles du thème Givre (clair, bleu) de
style_alcuno.css, avec les bleus décalés vers le rose, puis ajoute outils/kawaii_deco.css (formes, stickers, boutons en gélatine).

    python3 outils/generer_kawaii.py

À relancer après chaque modification des règles « Givre » de style_alcuno.css (le fichier généré est commité aussi)."""
import colorsys, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, "style_alcuno.css")
DECO = os.path.join(RACINE, "outils", "kawaii_deco.css")
SORTIE = os.path.join(RACINE, "style_kawaii.css")

# ---------- découpage du CSS en blocs ----------
def blocs(texte):
    """Liste de (prelude, corps) pour chaque bloc du niveau courant (corps = None pour une règle sans accolades)."""
    sortie, i, n = [], 0, len(texte)
    while i < n:
        # espaces et commentaires
        while i < n and (texte[i].isspace() or texte.startswith("/*", i)):
            if texte.startswith("/*", i):
                j = texte.find("*/", i + 2)
                i = n if j < 0 else j + 2
            else:
                i += 1
        if i >= n: break
        debut = i
        guillemet = None
        while i < n:
            c = texte[i]
            if guillemet:
                if c == "\\": i += 1
                elif c == guillemet: guillemet = None
            elif c in "\"'": guillemet = c
            elif c == "(" and False: pass
            elif texte.startswith("/*", i):
                j = texte.find("*/", i + 2); i = n if j < 0 else j + 1
            elif c in "{;": break
            i += 1
        prelude = texte[debut:i].strip()
        if i >= n or texte[i] == ";":
            sortie.append((prelude, None)); i += 1; continue
        # corps entre accolades
        profondeur, i = 1, i + 1
        debut_corps = i
        guillemet = None
        while i < n and profondeur:
            c = texte[i]
            if guillemet:
                if c == "\\": i += 1
                elif c == guillemet: guillemet = None
            elif c in "\"'": guillemet = c
            elif texte.startswith("/*", i):
                j = texte.find("*/", i + 2); i = n if j < 0 else j + 1
            elif c == "{": profondeur += 1
            elif c == "}": profondeur -= 1
            i += 1
        sortie.append((prelude, texte[debut_corps:i - 1]))
    return sortie

# ---------- couleurs : bleus -> roses ----------
def decaler(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    h360 = h * 360
    if 165 <= h360 <= 265 and s >= 0.12:
        h = (300 if l < 0.30 else 330) / 360
        r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
        return round(r2 * 255), round(g2 * 255), round(b2 * 255)
    return r, g, b

def hex_vers(m):
    h = m.group(2)
    if len(h) in (3, 4): h = "".join(c * 2 for c in h)
    if len(h) not in (6, 8): return m.group(0)
    r, g, b = decaler(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    return m.group(1) + "%02x%02x%02x" % (r, g, b) + h[6:]

def rgb_vers(m):
    parties = [p.strip() for p in m.group(2).split(",")]
    if len(parties) < 3: return m.group(0)
    try: r, g, b = decaler(*[int(float(p)) for p in parties[:3]])
    except ValueError: return m.group(0)
    return f"{m.group(1)}({r}, {g}, {b}" + ("".join(", " + p for p in parties[3:])) + ")"

def colorier(texte):
    texte = re.sub(r"(%23|#)([0-9a-fA-F]{3,8})(?![0-9a-zA-Z_-])", hex_vers, texte)
    texte = re.sub(r"(rgba?)\(([^)]*)\)", rgb_vers, texte)
    return texte

# ---------- sélecteurs ----------
GIVRE = 'data-theme="givre"'
def parties_selecteur(sel):
    parties, prof, cur = [], 0, ""
    for c in sel:
        if c in "([": prof += 1
        elif c in ")]": prof -= 1
        if c == "," and prof == 0: parties.append(cur.strip()); cur = ""
        else: cur += c
    if cur.strip(): parties.append(cur.strip())
    return parties

def vise_givre(partie):
    return GIVRE in partie.replace(':not([data-theme="givre"])', "")

def cloner_regle(prelude, corps, renom):
    gardes = [p.replace(GIVRE, 'data-theme="kawaii"') for p in parties_selecteur(prelude) if vise_givre(p)]
    if not gardes: return None
    corps = colorier(corps)
    for ancien, nouveau in renom.items(): corps = corps.replace(ancien, nouveau)
    return ",\n".join(gardes) + "{" + corps + "}\n"

def principal():
    source = open(SOURCE, encoding="utf8").read()
    niveau = blocs(source)
    # animations propres à Givre : recopiées sous un autre nom
    renom, copies = {}, []
    for prelude, corps in niveau:
        m = re.match(r"@keyframes\s+(\w*Givre\w*)", prelude)
        if m:
            nouveau = m.group(1).replace("Givre", "Kawaii")
            renom[m.group(1)] = nouveau
            copies.append(f"@keyframes {nouveau}{{{colorier(corps)}}}\n")
    sortie = ["/* GÉNÉRÉ par outils/generer_kawaii.py : ne pas modifier à la main (voir kawaii_deco.css pour les décors). */\n"]
    sortie += copies
    for prelude, corps in niveau:
        if corps is None or prelude.startswith("@keyframes"): continue
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            internes = [cloner_regle(p, c, renom) for p, c in blocs(corps) if c is not None and not p.startswith("@")]
            internes = [x for x in internes if x]
            if internes: sortie.append(prelude + "{\n" + "".join(internes) + "}\n")
        elif not prelude.startswith("@"):
            r = cloner_regle(prelude, corps, renom)
            if r: sortie.append(r)
    sortie.append("\n/* ===== Décors et formes du thème Kawaii ===== */\n")
    sortie.append(open(DECO, encoding="utf8").read())
    open(SORTIE, "w", encoding="utf8").write("".join(sortie))
    print(f"{SORTIE} : {len(''.join(sortie))} caractères")

if __name__ == "__main__":
    principal()
