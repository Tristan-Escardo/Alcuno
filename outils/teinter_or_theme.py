# -*- coding: utf-8 -*-
"""
Teinte le jaune doré du jeu de base aux couleurs d'un thème de fête.

Le jeu de base (style_alcuno.css) met du jaune doré partout : textes, interrupteurs on/off, curseurs de volume,
joueur actif, bandeau du tour, halo qui rappelle de jouer, bordures… Un thème qui veut « tout dans le thème »
doit tout recolorer. Cet outil lit style_alcuno.css, garde chaque règle qui contient du doré, remplace le doré par
les couleurs du thème et recopie la règle sous html[data-theme="<thème>"] (avec ses @media). Les animations
(@keyframes) dorées sont recopiées sous un autre nom, et les éléments qui les utilisent sont rebranchés dessus.

Ce qui RESTE doré (voulu) : fenêtres de déblocage des thèmes secrets, halo de sélection des pastilles de thème,
sticker gagné, carte dorée (c'est son nom), générique Star Wars, et les règles propres aux autres thèmes.

Le résultat est écrit ENTRE deux marqueurs au début de style_<thème>.css : les règles écrites à la main dans le
thème, plus bas, gardent le dernier mot à égalité.

Utilisation :  python3 outils/teinter_or_theme.py valentin
(couleurs de remplacement : dictionnaire THEMES plus bas ; relancer après chaque changement de style_alcuno.css)
"""
import re, sys, os

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Doré du jeu de base -> couleur du thème. Clés : couleurs en minuscules, « r,v,b » pour les rgb()/rgba().
THEMES = {
    "valentin": {
        "#ffd700": "#ffe3ee", "255,215,0": "255,200,222",
        "120,70,0": "138,18,68",
        "255,210,38": "255,184,210", "#ffcc00": "#ff9ec2", "#ffea70": "#ffe0ec", "#ffe680": "#ffe4ef",
        "255,200,40": "255,170,200", "255,223,90": "255,200,222", "#e9d9a8": "#f6d6e3", "#d9c38a": "#e8bcd0",
        "#ffe27a": "#ffe0ec", "#c8880a": "#b0185a", "255,220,90": "255,200,222", "255,216,77": "255,190,214",
        "255,200,0": "255,160,195", "#ffe066": "#ffd3e4", "#ffd54f": "#ffc2da", "#ffd23f": "#ffb8d2",
        "#e8a900": "#f06292", "#fff3a8": "#fff0f6", "#fff0a8": "#fff0f6", "#f2b400": "#f48fb1",
        "255,244,190": "255,236,244",
    },
    "patrick": {
        "#ffd700": "#d9ffe5", "255,215,0": "200,255,220",
        "120,70,0": "6,70,40",
        "255,210,38": "170,255,200", "#ffcc00": "#7dff9f", "#ffea70": "#e6ffee", "#ffe680": "#ecfff2",
        "255,200,40": "140,255,175", "255,223,90": "200,255,220", "#e9d9a8": "#d6f5e0", "#d9c38a": "#b9e8cb",
        "#ffe27a": "#e6ffee", "#c8880a": "#0f8a50", "255,220,90": "200,255,220", "255,216,77": "185,255,210",
        "255,200,0": "120,255,160", "#ffe066": "#c9ffd9", "#ffd54f": "#b4ffcb", "#ffd23f": "#9affbb",
        "#e8a900": "#2fcf72", "#fff3a8": "#f2fff6", "#fff0a8": "#f2fff6", "#f2b400": "#3ddc7e",
        "255,244,190": "236,255,242",
    },
    "justrose": {
        "#ffd700": "#ffffff", "255,215,0": "255,255,255",
        "120,70,0": "106,30,67",
        "255,210,38": "255,214,233", "#ffcc00": "#ffc2de", "#ffea70": "#ffffff", "#ffe680": "#ffffff",
        "255,200,40": "255,190,220", "255,223,90": "255,235,244", "#e9d9a8": "#ffe6f1", "#d9c38a": "#ffd0e6",
        "#ffe27a": "#ffffff", "#c8880a": "#a3135a", "255,220,90": "255,235,244", "255,216,77": "255,214,233",
        "255,200,0": "255,170,210", "#ffe066": "#ffeef6", "#ffd54f": "#ffe0ee", "#ffd23f": "#ffd0e6",
        "#e8a900": "#f06fa8", "#fff3a8": "#ffffff", "#fff0a8": "#ffffff", "#f2b400": "#f48fb1",
        "255,244,190": "255,240,247", "255,230,128": "255,255,255",
    },
    "halloween": {
        "#ffd700": "#ff9a3c", "255,215,0": "255,154,60",
        "120,70,0": "90,30,4",
        "255,210,38": "255,150,60", "#ffcc00": "#ff7a18", "#ffea70": "#ffc07a", "#ffe680": "#ffc98c",
        "255,200,40": "255,140,50", "255,223,90": "255,180,100", "#e9d9a8": "#f0c49a", "#d9c38a": "#e0a86f",
        "#ffe27a": "#ffc07a", "#c8880a": "#a8430a", "255,220,90": "255,180,100", "255,216,77": "255,168,85",
        "255,200,0": "255,130,30", "#ffe066": "#ffb469", "#ffd54f": "#ff9f45", "#ffd23f": "#ff8f30",
        "#e8a900": "#e06510", "#fff3a8": "#ffd9b0", "#fff0a8": "#ffd9b0", "#f2b400": "#f07418",
        "255,244,190": "255,218,180", "255,230,128": "255,196,130",
    },
    "musique": {
        "#ffd700": "#ffffff", "255,215,0": "255,255,255",
        "120,70,0": "42,14,110",
        "255,210,38": "232,222,255", "#ffcc00": "#d9c9ff", "#ffea70": "#ffffff", "#ffe680": "#ffffff",
        "255,200,40": "215,200,255", "255,223,90": "240,234,255", "#e9d9a8": "#ece6ff", "#d9c38a": "#d6c9ff",
        "#ffe27a": "#ffffff", "#c8880a": "#7a56f0", "255,220,90": "240,234,255", "255,216,77": "232,222,255",
        "255,200,0": "200,180,255", "#ffe066": "#f3eeff", "#ffd54f": "#e6dcff", "#ffd23f": "#dcd0ff",
        "#e8a900": "#8a6cf5", "#fff3a8": "#ffffff", "#fff0a8": "#ffffff", "#f2b400": "#a58bf7",
        "255,244,190": "246,242,255", "255,230,128": "255,255,255",
    },
}

# Sélecteurs laissés en doré (voir plus haut)
GARDER_OR = re.compile(r"fenetre|pastilleTheme|stickerGagne|[Dd]oree|culsec|generique|data-theme|etoileFilante|couronneTitre")

def couleur_cle(m):
    return m.group(0).lower()

# Teinte cible de chaque thème (degrés, roue des couleurs) : TOUT jaune / doré / ambre que la table ci-dessus ne
# connaît pas est reconnu à sa teinte (entre 36° et 64°, assez saturé) et tourné vers cette teinte, en gardant sa
# clarté. Avant, seule la liste servait : un jaune oublié (ex. #FFE36B du nom dans la bannière « Tour de ») restait jaune.
TEINTE = {"valentin": 336, "patrick": 140, "justrose": 330, "musique": 265, "halloween": 25}

def tourner(r, v, b, cible):
    import colorsys
    h, l, s = colorsys.rgb_to_hls(r / 255, v / 255, b / 255)
    if not (36 / 360 <= h <= 64 / 360 and s > 0.45 and 0.25 < l < 0.97): return None
    r2, v2, b2 = colorsys.hls_to_rgb(cible / 360, min(l + 0.04, 0.96), min(s, 0.9))
    return round(r2 * 255), round(v2 * 255), round(b2 * 255)

def teinter(texte, table, cible=None):
    """Remplace le doré dans un morceau de CSS. Renvoie (texte, nombre de remplacements)."""
    n = 0
    def hexa(m):
        nonlocal n
        k = m.group(0).lower()
        if k in table: n += 1; return table[k]
        if cible is not None and len(k) == 7:
            t = tourner(int(k[1:3], 16), int(k[3:5], 16), int(k[5:7], 16), cible)
            if t: n += 1; return "#%02x%02x%02x" % t
        return m.group(0)
    def rgb(m):
        nonlocal n
        parts = [x.strip() for x in m.group(2).split(",")]
        k = ",".join(parts[:3])
        reste = parts[3:]
        if k in table:
            n += 1
            return f"{m.group(1)}({table[k]}{(',' + ','.join(reste)) if reste else ''})"
        if cible is not None and len(parts) >= 3 and all(re.fullmatch(r"\d+", x) for x in parts[:3]):
            t = tourner(int(parts[0]), int(parts[1]), int(parts[2]), cible)
            if t:
                n += 1
                return f"{m.group(1)}({t[0]},{t[1]},{t[2]}{(',' + ','.join(reste)) if reste else ''})"
        return m.group(0)
    texte = re.sub(r"#[0-9a-fA-F]{6}\b", hexa, texte)
    texte = re.sub(r"(rgba?)\(([^)]*)\)", rgb, texte)
    return texte, n

def sans_commentaires(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)

def blocs(css):
    """Découpe du CSS en (prélude, contenu) : règles, @media {…} (récursif), @keyframes {…}."""
    i, n, res = 0, len(css), []
    while i < n:
        j = css.find("{", i)
        if j < 0: break
        prelude = css[i:j].strip()
        k, prof = j + 1, 1
        while k < n and prof:
            if css[k] == "{": prof += 1
            elif css[k] == "}": prof -= 1
            k += 1
        res.append((prelude, css[j + 1:k - 1]))
        i = k
    return res

def decouper_selecteurs(sel):
    parts, prof, cur = [], 0, ""
    for c in sel:
        if c in "([": prof += 1
        elif c in ")]": prof -= 1
        if c == "," and prof == 0: parts.append(cur.strip()); cur = ""
        else: cur += c
    if cur.strip(): parts.append(cur.strip())
    return parts

def portee(sel, theme):
    # :where(…) n'ajoute AUCUNE priorité : la règle teintée garde la même force que l'originale, donc une règle plus
    # précise du jeu de base (ex. le fond transparent du bouton « X » dans la liste des joueurs en ligne) l'emporte toujours.
    h = f':where(html[data-theme="{theme}"])'
    if sel.startswith(":root"): return h + sel[5:]
    if re.match(r"html\b", sel): return h + sel[4:]
    return h + " " + sel

def proprietes(contenu):
    return [d.split(":", 1)[0].strip().lower() for d in contenu.split(";") if ":" in d]

def traiter(liste, theme, table, anims_or, sortie, retrait=""):
    # Une propriété redéfinie PLUS LOIN par une règle au sélecteur identique (même endroit : même @media) n'est pas
    # teintée : à force égale, c'est la règle d'après qui s'applique dans le jeu de base (ex. le nom du joueur actif de
    # la télé : doré, puis plus loin à la couleur du joueur actif). Sinon la règle teintée, chargée après, la réécraserait.
    redefinies = set()
    for i, (prelude, contenu) in enumerate(liste):
        if prelude.startswith("@"): continue
        for j in range(i + 1, len(liste)):
            if liste[j][0] == prelude:
                for prop in proprietes(liste[j][1]): redefinies.add((i, prop))
    for i, (prelude, contenu) in enumerate(liste):
        if prelude.startswith("@media") or prelude.startswith("@supports"):
            dedans = []
            traiter(blocs(contenu), theme, table, anims_or, dedans, retrait + "  ")
            if dedans: sortie.append(f"{retrait}{prelude}{{\n" + "".join(dedans) + f"{retrait}}}\n")
            continue
        if prelude.startswith("@"): continue  # @keyframes (traités à part), @font-face…
        sels = [s for s in decouper_selecteurs(prelude) if not GARDER_OR.search(s)]
        if not sels: continue
        decls = []
        for d in contenu.split(";"):
            d = d.strip()
            if not d or ":" not in d: continue
            prop = d.split(":", 1)[0].strip().lower()
            if (i, prop) in redefinies: continue
            if prop in ("animation", "animation-name"):
                val = d
                for nom in anims_or:
                    val = re.sub(rf"\b{re.escape(nom)}\b", nom + "_" + theme, val)
                if val != d: decls.append(val); continue
            t, nb = teinter(d, table, TEINTE.get(theme))
            if nb: decls.append(t)
        if decls:
            sortie.append(f"{retrait}{', '.join(portee(s, theme) for s in sels)}{{ " + "; ".join(decls) + "; }\n")

def main():
    theme = sys.argv[1] if len(sys.argv) > 1 else "valentin"
    table = THEMES[theme]
    css = sans_commentaires(open(os.path.join(RACINE, "style_alcuno.css"), encoding="utf-8").read())
    tout = blocs(css)
    # animations dorées : recopiées sous un autre nom
    anims_or, kf = [], []
    def cherche_kf(liste):
        for prelude, contenu in liste:
            if prelude.startswith("@media"): cherche_kf(blocs(contenu)); continue
            m = re.match(r"@(-webkit-)?keyframes\s+([\w-]+)", prelude)
            if m:
                t, nb = teinter(contenu, table, TEINTE.get(theme))
                if nb and m.group(2) not in anims_or:
                    anims_or.append(m.group(2))
                    kf.append(f"@keyframes {m.group(2)}_{theme}{{{t}}}\n")
    cherche_kf(tout)
    sortie = []
    traiter(tout, theme, table, anims_or, sortie)
    bloc = ("/* === DÉBUT : doré du jeu de base teinté au thème (généré par outils/teinter_or_theme.py " + theme + " : ne pas modifier à la main) === */\n"
            + "".join(kf) + "".join(sortie)
            + "/* === FIN du doré teinté (généré) === */\n")
    fichier = os.path.join(RACINE, f"style_{theme}.css")
    s = open(fichier, encoding="utf-8").read()
    s = re.sub(r"/\* === DÉBUT : doré du jeu de base teinté.*?/\* === FIN du doré teinté \(généré\) === \*/\n", "", s, flags=re.S)
    fin_entete = s.index("*/") + 2  # juste après le commentaire d'en-tête du thème
    s = s[:fin_entete] + "\n\n" + bloc + s[fin_entete:]
    open(fichier, "w", encoding="utf-8").write(s)
    print(f"{theme} : {len(sortie)} règles teintées, {len(kf)} animations recopiées ({', '.join(anims_or)})")

if __name__ == "__main__":
    main()
