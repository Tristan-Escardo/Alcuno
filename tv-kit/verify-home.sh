#!/usr/bin/env bash
# Test du bouton Home DEPUIS UNE APP (piège connu), avec captures avant/après.
set -euo pipefail
cd "$(dirname "$0")/.."
PY="${PY:-tools/venv/bin/python}"; APP="${1:-com.google.android.youtube.tv}"
printf '%s\n' "monkey -p $APP -c android.intent.category.LEANBACK_LAUNCHER 1" | "$PY" -I tools/tv.py --batch >/dev/null
sleep 6; "$PY" -I tools/tv.py --shot verif-1-dans-app.png
printf 'input keyevent KEYCODE_HOME\n' | "$PY" -I tools/tv.py --batch >/dev/null
sleep 3; "$PY" -I tools/tv.py --shot verif-2-apres-home.png
"$PY" -I tools/tv.py "dumpsys activity activities | grep -E 'topResumedActivity|ResumedActivity' | head -2"
echo "Attendu : com.mihir.tvhome/.MainActivity au premier plan. Regarde verif-2-apres-home.png."
