# Petit serveur web pour les tests qui ont besoin de http:// (sons chargés par fetch).
# Usage, depuis le dossier du jeu :  python tests/serveur.py   (port 8765)
# Pourquoi pas « python -m http.server » : il n'accepte que 5 connexions en attente, et sous Windows
# les suivantes sont refusées ; au chargement, Chrome en ouvre une dizaine d'un coup (fichiers du jeu,
# Firebase…) et certains fichiers du jeu échouaient au hasard (page bloquée en « chargement »).
import http.server, socketserver, sys

class Serveur(http.server.ThreadingHTTPServer):
    request_queue_size = 128

class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass  # pas de ligne par requête

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
with Serveur(("127.0.0.1", port), Gestionnaire) as serveur:
    serveur.serve_forever()
