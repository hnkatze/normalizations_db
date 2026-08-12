"""
Troceado del script en sentencias individuales.

Dos rarezas de los volcados de SSMS obligan a hacer esto a mano antes de
entregarle nada a sqlglot:

1. `GO` no es SQL. Es el separador de lotes del cliente de SQL Server, y el
   servidor nunca lo recibe. Enviarlo al parser es un error sintáctico seguro.
2. SSMS emite `INSERT` consecutivos **sin punto y coma** entre ellos. sqlglot
   no puede separar dos sentencias pegadas, así que sin este troceo devuelve
   cero filas.
"""

import re
from typing import Iterator

# Palabras que solo pueden abrir una sentencia. Al encontrarlas al principio de
# una línea, y fuera de cualquier literal, se asume que la anterior terminó.
_STATEMENT_STARTERS = (
    "INSERT", "CREATE", "ALTER", "DROP", "SET", "UPDATE",
    "DELETE", "EXEC", "EXECUTE", "USE", "TRUNCATE", "GRANT",
)

_GO_BATCH = re.compile(r"(?im)^\s*GO\s*(?:--[^\n]*)?$")

# Ruido de almacenamiento e índices que emite SSMS y que ningún otro motor
# entiende. Sin quitarlo, sqlglot degrada el CREATE TABLE a un `Command` opaco
# —en silencio, sin lanzar excepción— y la tabla desaparece del resultado.
_NOISE: tuple[tuple[str, str], ...] = (
    (r"(?is)\bWITH\s*\(\s*PAD_INDEX\b.*?\)", ""),
    (r"(?i)\bTEXTIMAGE_ON\s*\[[^\]]+\]", ""),
    (r"(?i)\bFILESTREAM_ON\s*\[[^\]]+\]", ""),
    (r"(?i)\bON\s*\[PRIMARY\]", ""),
    (r"(?i)\b(?:NON)?CLUSTERED\b", ""),
    (r"(?i)\bIDENTITY\s*\(\s*\d+\s*,\s*\d+\s*\)", ""),
    (r"(?i)\bCOLLATE\s+\w+", ""),
    (r"(?im)^\s*SET\s+(?:ANSI_NULLS|QUOTED_IDENTIFIER|NOCOUNT|ANSI_PADDING)\s+(?:ON|OFF)\s*;?\s*$", ""),
    (r"(?i)\bSET\s+IDENTITY_INSERT\s+[\w\[\]\.]+\s+(?:ON|OFF)\s*;?", ""),
    (r"(?im)^\s*USE\s*\[?[\w\s]+\]?\s*;?\s*$", ""),
    (r"(?i)\b(?:ASC|DESC)\s*(?=[,\)])", ""),
)


def sanitize(sql: str) -> str:
    """Elimina las cláusulas propietarias que impiden parsear el DDL.

    Solo se quita ruido de almacenamiento, nunca información estructural:
    nombres, tipos, nulabilidad y claves quedan intactos.
    """
    for pattern, replacement in _NOISE:
        sql = re.sub(pattern, replacement, sql)
    return sql


def split_batches(sql: str) -> list[str]:
    """Separa el script por el marcador de lote `GO`."""
    return [batch for batch in _GO_BATCH.split(sql) if batch.strip()]


def _starts_statement(text: str) -> bool:
    head = text.lstrip()[:16].upper()
    return any(
        head.startswith(word) and head[len(word):len(word) + 1] in (" ", "\t", "\n", "")
        for word in _STATEMENT_STARTERS
    )


def split_statements(sql: str) -> Iterator[str]:
    """Trocea un lote en sentencias, ignorando delimitadores dentro de literales.

    Corta en `;` y también ante una línea que empieza una sentencia nueva, que
    es el caso de los `INSERT` sin punto y coma de SSMS. El recorrido tiene que
    ser carácter a carácter porque un `;` o un salto de línea dentro de una
    cadena, un identificador entre corchetes o un comentario no son
    delimitadores.
    """
    buffer: list[str] = []
    index, length = 0, len(sql)
    quote: str | None = None       # ' " o [ cuando estamos dentro de un literal
    comment: str | None = None     # "line" o "block"

    def flush() -> Iterator[str]:
        statement = "".join(buffer).strip()
        if statement:
            yield statement

    while index < length:
        char = sql[index]

        if comment == "line":
            if char == "\n":
                comment = None
            buffer.append(char)
            index += 1
            continue

        if comment == "block":
            if char == "*" and sql.startswith("*/", index):
                comment = None
                buffer.append("*/")
                index += 2
                continue
            buffer.append(char)
            index += 1
            continue

        if quote is not None:
            # Una comilla simple duplicada es un escape, no un cierre.
            if quote == "'" and char == "'" and sql.startswith("''", index):
                buffer.append("''")
                index += 2
                continue
            if (quote == "'" and char == "'") or (quote == '"' and char == '"') or (quote == "[" and char == "]"):
                quote = None
            buffer.append(char)
            index += 1
            continue

        if char == "-" and sql.startswith("--", index):
            comment = "line"
            buffer.append("--")
            index += 2
            continue

        if char == "/" and sql.startswith("/*", index):
            comment = "block"
            buffer.append("/*")
            index += 2
            continue

        if char in ("'", '"', "["):
            quote = char
            buffer.append(char)
            index += 1
            continue

        if char == ";":
            yield from flush()
            buffer.clear()
            index += 1
            continue

        if char == "\n" and _starts_statement(sql[index + 1:index + 40]):
            yield from flush()
            buffer.clear()
            index += 1
            continue

        buffer.append(char)
        index += 1

    yield from flush()
