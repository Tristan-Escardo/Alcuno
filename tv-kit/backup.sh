#!/usr/bin/env bash
# Sauvegarde l'état de la TV AVANT toute modification. À lancer depuis la racine du dépôt tv-home
# (après setup.sh + find-tv.sh). Crée backup-<date>/ avec l'état des paquets, les réglages et une capture.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PY:-tools/venv/bin/python}"
D="backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$D"
run() { printf '%s\n' "$1" | "$PY" -I tools/tv.py --batch | sed '1d'; }
run "getprop ro.product.model; getprop ro.build.version.release; getprop ro.build.display.id" > "$D/device.txt"
run "pm list packages -f"        > "$D/packages-all.txt"
run "pm list packages -d"        > "$D/packages-disabled-avant.txt"
run "pm list packages -e"        > "$D/packages-enabled-avant.txt"
run "pm list packages -3"        > "$D/packages-user.txt"
run "cmd package resolve-activity --brief -c android.intent.category.HOME -a android.intent.action.MAIN" > "$D/home-activity.txt"
run "settings list global"       > "$D/settings-global.txt"
run "settings list secure"       > "$D/settings-secure.txt"
run "settings list system"       > "$D/settings-system.txt"
"$PY" -I tools/tv.py --shot "$D/ecran-avant.png"
echo "OK -> $D/  (garde ce dossier ; restore.sh réactive aussi tout ce qui était activé)"
echo "Launcher d'origine :"; cat "$D/home-activity.txt"
