#!/bin/bash
# Génère tests/partie.html depuis le vrai index.html (sans Firebase), puis joue une partie dans Chrome
S="$(cd "$(dirname "$0")" && pwd)"; P="$(cd "$S/.." && pwd)"
W="file:///$(cygpath -m "$P")"
GRAINE="${1:-12345}"
perl -0pe "
  s{<script type=\"module\">.*?</script>}{}s;
  s{href=\"style_alcuno\.css}{href=\"$W/style_alcuno.css};
  s{src=\"' \+ f}{src=\"$W/' + f}g;
  s{href=\"' \+ f}{href=\"$W/' + f}g;
  s{<head>}{<head>\n<script src=\"prelude.js\"></script>};
  s{</body>}{<script src=\"joueur_auto.js\"></script>\n</body>};
" "$P/index.html" > "$S/partie.html"
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --allow-file-access-from-files \
  --virtual-time-budget=900000 --dump-dom "file:///$(cygpath -m "$S")/partie.html?graine=$GRAINE" 2>/dev/null \
  | perl "$S/extraire.pl"
