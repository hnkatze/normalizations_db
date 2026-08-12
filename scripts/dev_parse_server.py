"""
Servidor de desarrollo para la función de parseo.

`next dev` no ejecuta funciones de Python: en producción las corre Vercel, pero
en local no hay nadie que las levante. Sin esto, subir un archivo durante el
desarrollo devuelve 404.

Este script expone el MISMO handler que despliega Vercel (`api/parse.py`) en un
puerto local, y `next.config.ts` reescribe `/api/parse` hacia acá solo en
desarrollo. Es el handler real, no una imitación, así que lo que funciona aquí
funciona desplegado.

    pip install -r requirements.txt
    npm run dev:parser

Se apaga con Ctrl+C.
"""

import os
import sys
from http.server import HTTPServer

PORT = int(os.environ.get("PARSE_DEV_PORT", "8787"))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "api"))

try:
    from parse import handler
except ModuleNotFoundError as error:
    if error.name == "sqlglot":
        sys.exit(
            "Falta sqlglot. Instalá las dependencias del servicio de parseo:\n"
            "    pip install -r requirements.txt"
        )
    raise


def main() -> None:
    server = HTTPServer(("127.0.0.1", PORT), handler)
    print(f"Servicio de parseo escuchando en http://127.0.0.1:{PORT}")
    print("next.config.ts reescribe /api/parse hacia acá mientras corras `next dev`.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nApagando.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
