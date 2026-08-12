"""
Traducción de tipos al vocabulario de `information_schema`.

El dominio define `ColumnDefinition.sqlType` como el `data_type` que reporta
`information_schema.columns`, no como la ortografía del DDL: `varchar` se
guarda como `"character varying"` y `numeric(10,2)` como `"numeric"`. Los
fixtures de `src/seeds` afirman exactamente esas cadenas, así que devolver
`VARCHAR(40)` rompería el contrato en silencio.

El mapeo parte del tipo canónico de sqlglot, no del texto del dialecto: sqlglot
ya normalizó `[int]`, `INT` e `INTEGER` al mismo símbolo, así que basta con una
tabla por símbolo en vez de una por dialecto.
"""

from sqlglot import exp

Type = exp.DataType.Type

# Los nombres de destino son literalmente los que devuelve
# `information_schema.columns.data_type` en PostgreSQL.
_DATA_TYPE: dict[Type, str] = {
    Type.BOOLEAN: "boolean",
    Type.BIT: "boolean",
    Type.TINYINT: "smallint",
    Type.SMALLINT: "smallint",
    Type.INT: "integer",
    Type.BIGINT: "bigint",
    Type.DECIMAL: "numeric",
    Type.MONEY: "numeric",
    Type.SMALLMONEY: "numeric",
    Type.FLOAT: "real",
    Type.DOUBLE: "double precision",
    Type.CHAR: "character",
    Type.NCHAR: "character",
    Type.VARCHAR: "character varying",
    Type.NVARCHAR: "character varying",
    Type.TEXT: "text",
    Type.MEDIUMTEXT: "text",
    Type.LONGTEXT: "text",
    Type.DATE: "date",
    Type.DATETIME: "timestamp without time zone",
    Type.TIMESTAMP: "timestamp without time zone",
    Type.TIMESTAMPTZ: "timestamp with time zone",
    Type.TIME: "time without time zone",
    Type.BINARY: "bytea",
    Type.VARBINARY: "bytea",
    Type.IMAGE: "bytea",
    Type.UUID: "uuid",
    Type.JSON: "json",
    Type.JSONB: "jsonb",
    Type.XML: "xml",
}

# `nvarchar(max)` y `varchar(max)` son texto sin límite, no una cadena acotada.
_UNBOUNDED_TEXT = {Type.VARCHAR, Type.NVARCHAR, Type.CHAR, Type.NCHAR}


def to_data_type(kind: exp.DataType | None) -> str:
    """Traduce un tipo de sqlglot al `data_type` equivalente de PostgreSQL.

    Un tipo desconocido se degrada a su nombre canónico en minúsculas en lugar
    de lanzar: la detección de dependencias funcionales compara valores, no
    tipos, así que un tipo sin traducir no invalida el análisis.
    """
    if kind is None:
        return "text"

    if kind.this in _UNBOUNDED_TEXT and _is_max_length(kind):
        return "text"

    return _DATA_TYPE.get(kind.this, kind.this.value.lower())


def _is_max_length(kind: exp.DataType) -> bool:
    """Detecta la longitud `MAX` de T-SQL dentro de los parámetros del tipo."""
    for parameter in kind.expressions:
        if isinstance(parameter, exp.DataTypeParam):
            parameter = parameter.this
        if isinstance(parameter, exp.Var) and parameter.name.upper() == "MAX":
            return True
    return False
