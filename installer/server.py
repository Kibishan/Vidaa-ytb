#!/usr/bin/env python3
"""
Serveur d'installation local pour Hisense VIDAA OS (port 8080 par défaut)
Note : Pour que le proxy YouTube TV complet fonctionne en local, préférez :
  npm run serve:vidaa
"""
import http.server
import os
import socket
import socketserver

PORT = int(os.environ.get("PORT", "8080"))
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


class VidaaHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


if __name__ == "__main__":
    ip = get_local_ip()
    with socketserver.TCPServer(("0.0.0.0", PORT), VidaaHandler) as httpd:
        print("=" * 60)
        print(" Serveur Statique VIDAA OS - YouTube Extended")
        print(f" URL TV   : http://{ip}:{PORT}/vidaa.html")
        print(f" Install  : http://{ip}:{PORT}/installer/")
        print("=" * 60)
        httpd.serve_forever()
