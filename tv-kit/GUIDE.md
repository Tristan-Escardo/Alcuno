# Guide TCL Smart TV Pro (Android 14) — ce que tu dois faire toi-même

Claude (session cloud) ne peut pas joindre ta TV : tu lances les commandes depuis ton ordinateur
(même Wi-Fi que la TV). Dépôt de base : https://github.com/mihirgupta0900/tv-home (MIT, code relu : pas de réseau dans le launcher, aucune désinstallation).

## 0. Sur la TV (manuel, obligatoire)
Réglages → Système → À propos → appuie 7× sur OK sur « Numéro de build » → Options pour les développeurs
→ activer « Débogage USB » (et « Débogage réseau/Wi-Fi » s'il existe). Garde la TV allumée.

## 1. Sur l'ordinateur
```bash
git clone https://github.com/mihirgupta0900/tv-home && cd tv-home
cp <ce-dossier>/tv-kit/{backup.sh,verify-home.sh,debloat-tcl-android14.txt} .   # ou colle-les dans le dépôt
./setup.sh --no-launcher        # client Python (macOS). Linux/Windows : python3 -m venv tools/venv && tools/venv/bin/pip install -r tools/requirements.txt
tools/find-tv.sh                # trouve la TV (find-tv.sh est écrit pour macOS ; sinon : echo 192.168.x.y > tools/.tv_host)
tools/venv/bin/python -I tools/tv.py --probe   # ACCEPTE « Autoriser le débogage ? » sur la TV
```
## 2. Sauvegarde puis débloat
```bash
./backup.sh                                      # ➜ envoie-moi backup-*/packages-all.txt pour affiner la liste
tools/disable.sh debloat-tcl-android14.txt       # relis la liste d'abord !
tools/venv/bin/python -I tools/tv.py --shot apres-debloat.png   # la TV doit encore fonctionner
```
## 3. Launcher
Édite `launcher/res/values/config.xml` (dock : donne-moi tes apps, noms de paquets via
`tools/venv/bin/python -I tools/tv.py 'pm list packages -3'`). Sur Android 14 `live_tv_package` = com.tcl.tv à vérifier.
Il faut JDK 17 + SDK Android 34 (setup.sh complet sur macOS/Homebrew, sinon à installer toi-même).
```bash
launcher/build-and-install.sh
./verify-home.sh            # teste Home depuis YouTube + captures verif-*.png
```
Le script désactive aussi le launcher Google TV et `com.google.android.tungsten.setupwraith`.
Si ta TV est un Android TV classique (pas Google TV), le launcher d'origine est `com.google.android.tvlauncher` :
passe `STOCK_LAUNCHER=com.google.android.tvlauncher` aux scripts (le home d'origine est dans backup-*/home-activity.txt).

## 4. Restaurer
`tools/restore.sh debloat-tcl-android14.txt` (réactive la liste, setupwraith et le launcher d'origine).
Si l'écran est bloqué : Réglages → Applications → Afficher toutes → réactive à la main.
