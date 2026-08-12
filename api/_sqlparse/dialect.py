"""
Detección del dialecto de origen.

El dialecto decide qué gramática usa sqlglot para leer. Se infiere por marcas
sintácticas que solo emite cada motor, puntuando en lugar de cortar en la
primera coincidencia: un volcado real mezcla comentarios y datos donde puede
aparecer casi cualquier subcadena.
"""

import re
from typing import NamedTuple

# Cada marca vale por lo específica que es de un motor, no por lo frecuente.
# `GO` en su propia línea y `TEXTIMAGE_ON` no existen fuera de SQL Server; una
# comilla invertida no aparece nunca en un volcado que no sea de MySQL.
_SIGNALS: dict[str, tuple[tuple[str, int], ...]] = {
    "tsql": (
        (r"(?im)^\s*GO\s*$", 3),
        (r"(?i)\bTEXTIMAGE_ON\b", 3),
        (r"(?i)\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)", 2),
        (r"(?i)\bSET\s+(ANSI_NULLS|QUOTED_IDENTIFIER|IDENTITY_INSERT)\b", 2),
        (r"(?i)\bON\s*\[PRIMARY\]", 2),
        (r"(?i)\bNVARCHAR\s*\(\s*MAX\s*\)", 1),
        (r"\[\w+\]\.\[\w+\]", 1),
    ),
    "mysql": (
        (r"(?i)\bENGINE\s*=\s*\w+", 3),
        (r"(?i)\bAUTO_INCREMENT\b", 2),
        (r"(?i)\bDEFAULT\s+CHARSET\s*=", 2),
        (r"(?i)/\*!\d+", 2),
        (r"`\w+`", 1),
    ),
    "oracle": (
        (r"(?i)\bVARCHAR2\s*\(", 3),
        (r"(?i)\bNUMBER\s*\(", 2),
        (r"(?im)^\s*/\s*$", 1),
    ),
    "postgres": (
        (r"(?i)\bSERIAL\b", 2),
        (r"(?i)\bWITHOUT\s+TIME\s+ZONE\b", 2),
        (r"(?i)\bOWNER\s+TO\b", 2),
        (r"(?i)\bCREATE\s+EXTENSION\b", 1),
    ),
}

# Sin ninguna marca reconocible se asume Postgres: es el dialecto que la
# aplicación ya soportaba, así que mantiene el comportamiento previo.
DEFAULT_DIALECT = "postgres"


class DialectGuess(NamedTuple):
    dialect: str
    scores: dict[str, int]


def detect_dialect(sql: str) -> DialectGuess:
    """Infiere el dialecto de origen a partir de marcas propietarias.

    Devuelve también el puntaje de cada candidato para que la respuesta pueda
    exponerlo: cuando la detección se equivoca, ver los puntajes es la única
    forma de entender por qué sin volver a ejecutar nada.
    """
    scores = {
        name: sum(weight for pattern, weight in signals if re.search(pattern, sql))
        for name, signals in _SIGNALS.items()
    }

    best = max(scores, key=lambda name: scores[name])
    if scores[best] == 0:
        return DialectGuess(DEFAULT_DIALECT, scores)
    return DialectGuess(best, scores)
