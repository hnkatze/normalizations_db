"""
Función de Vercel que convierte un volcado SQL en la representación intermedia.

Convive con la aplicación Next.js en el mismo despliegue: el navegador envía el
archivo a `/api/parse` sin salir del dominio, así que no hay CORS ni un segundo
servicio que mantener.

El cuerpo de la petición es el archivo en crudo, sin envolver en multipart. Se
recibe como bytes a propósito: la codificación es justamente lo que hay que
detectar, y decodificar antes de tiempo destruye el BOM que lo delata.
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from _sqlparse import build_ir  # noqa: E402

# Vercel corta el cuerpo en 4,5 MB y responde 413 EN EL BORDE: por encima de eso
# la petición no llega hasta aquí, así que ningún mensaje escrito en este archivo
# puede explicarla. Por eso el cliente mide el tamaño antes de enviar, en
# `validateUploadSize.ts`, y este tope solo alcanza a quien llame a la función
# sin pasar por la aplicación.
MAX_BODY_BYTES = 4 * 1024 * 1024 + 512 * 1024


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("content-length") or 0)
        except ValueError:
            self._send_error(400, "invalid-content-length", "La cabecera content-length no es un número.")
            return

        if length <= 0:
            self._send_error(400, "empty-body", "No se recibió ningún archivo.")
            return

        if length > MAX_BODY_BYTES:
            self._send_error(
                413,
                "file-too-large",
                f"El archivo supera el límite de {MAX_BODY_BYTES / (1024 * 1024):.1f} MB.",
            )
            return

        raw = self.rfile.read(length)

        try:
            payload = build_ir(raw)
        except Exception as error:  # noqa: BLE001 — la causa se devuelve al cliente
            self._send_error(422, "parse-failed", str(error))
            return

        if not payload["tables"]:
            self._send_error(
                422,
                "no-tables-found",
                "El archivo se leyó pero no declara ninguna tabla.",
                dialect=payload["dialect"],
                encoding=payload["encoding"],
                diagnostics=payload["diagnostics"],
            )
            return

        self._send_json(200, payload)

    def do_GET(self) -> None:
        self._send_json(200, {"status": "ok", "accepts": "POST con el archivo .sql en el cuerpo"})

    def _send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, status: int, kind: str, message: str, **extra: object) -> None:
        self._send_json(status, {"error": {"kind": kind, "message": message, **extra}})

    def log_message(self, *_args: object) -> None:
        """Silencia el registro por petición de BaseHTTPRequestHandler.

        Vercel ya registra cada invocación; duplicarlo solo ensucia los logs.
        """
