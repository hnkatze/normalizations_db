"""
Decodificación del archivo subido.

Un volcado generado por SQL Server Management Studio se guarda por defecto en
UTF-16 LE con BOM. Leerlo como UTF-8 no falla: produce texto con NUL
intercalados que ningún parser reconoce. La detección por BOM va primero,
antes que cualquier intento de parseo.
"""

from typing import NamedTuple

# Cada BOM es un prefijo de bytes inequívoco. UTF-32 se comprueba antes que
# UTF-16 porque el BOM de UTF-32 LE empieza con el de UTF-16 LE.
_BOMS: tuple[tuple[bytes, str], ...] = (
    (b"\xff\xfe\x00\x00", "utf-32-le"),
    (b"\x00\x00\xfe\xff", "utf-32-be"),
    (b"\xff\xfe", "utf-16-le"),
    (b"\xfe\xff", "utf-16-be"),
    (b"\xef\xbb\xbf", "utf-8-sig"),
)


class DecodedSource(NamedTuple):
    text: str
    encoding: str


def decode_sql(raw: bytes) -> DecodedSource:
    """Decodifica el volcado subido a texto, informando qué codificación se usó.

    El BOM manda cuando está presente. Sin BOM se intenta UTF-8 estricto y, si
    falla, se cae a latin-1: nunca lanza excepción, porque un byte suelto mal
    codificado en una columna de datos no debe impedir leer el esquema.
    """
    for bom, encoding in _BOMS:
        if raw.startswith(bom):
            return DecodedSource(raw.decode(encoding), encoding)

    try:
        return DecodedSource(raw.decode("utf-8"), "utf-8")
    except UnicodeDecodeError:
        return DecodedSource(raw.decode("latin-1"), "latin-1")
