"""
Construcción de la representación intermedia.

El IR es el contrato entre este servicio y el dominio TypeScript. Cada entrada
de `tables` incluye `name`, `columns` y `rows` con exactamente la forma de
`FlatTable` en `src/domain/relationalModel.ts`, más `primaryKey`,
`foreignKeys` y `uniqueKeys`, que el dominio puede ignorar sin romperse.
"""

import hashlib
import re
from typing import Any

import sqlglot
from sqlglot import exp

from .dialect import detect_dialect
from .reader import decode_sql
from .statements import sanitize, split_batches, split_statements
from .types import to_data_type

# Un valor binario más largo que esto se resume en lugar de transportarse. Una
# columna `image` de un catálogo pesa megabytes por fila y jamás determina otra
# columna; lo único que aporta al análisis es si dos filas son iguales, y para
# eso alcanza con un resumen estable.
_BLOB_SUMMARY_THRESHOLD = 64


def build_ir(raw: bytes) -> dict[str, Any]:
    """Convierte el archivo subido en el IR que consume el dominio."""
    decoded = decode_sql(raw)
    guess = detect_dialect(decoded.text)

    tables: dict[str, dict[str, Any]] = {}
    rows: dict[str, list[dict[str, Any]]] = {}
    unparsed: list[str] = []

    for batch in split_batches(decoded.text):
        for statement in split_statements(sanitize(batch)):
            if _is_only_comments(statement):
                continue
            try:
                parsed = sqlglot.parse_one(statement, read=guess.dialect)
            except Exception:
                unparsed.append(_excerpt(statement))
                continue

            if parsed is None or isinstance(parsed, exp.Command):
                continue

            if isinstance(parsed, exp.Create) and parsed.kind == "TABLE":
                table = _read_create_table(parsed)
                if table is not None:
                    tables[table["name"]] = table
            elif isinstance(parsed, exp.Create) and isinstance(parsed.this, exp.Index):
                _apply_unique_index(parsed, tables)
            elif isinstance(parsed, exp.Insert):
                name, values = _read_insert(parsed, tables)
                if name is not None:
                    rows.setdefault(name, []).extend(values)
            elif isinstance(parsed, exp.Alter):
                _apply_alter(parsed, tables)

    _resolve_reference_columns(tables)
    _drop_redundant_unique_keys(tables)

    for name, table in tables.items():
        table["rows"] = rows.get(name, [])

    return {
        "encoding": decoded.encoding,
        "dialect": guess.dialect,
        "tables": list(tables.values()),
        "diagnostics": {
            "unparsedStatements": len(unparsed),
            "samples": unparsed[:5],
            "orphanInserts": sorted(set(rows) - set(tables)),
            "dialectScores": guess.scores,
        },
    }


def _read_create_table(node: exp.Create) -> dict[str, Any] | None:
    schema = node.this
    if not isinstance(schema, exp.Schema):
        return None

    columns: list[dict[str, Any]] = []
    primary_key: list[str] = []
    foreign_keys: list[dict[str, Any]] = []
    unique_keys: list[list[str]] = []

    for definition in schema.expressions:
        if isinstance(definition, exp.ColumnDef):
            columns.append(
                {
                    "name": definition.name,
                    "sqlType": to_data_type(definition.kind),
                    "nullable": _is_nullable(definition),
                }
            )
            if any(isinstance(c.kind, exp.PrimaryKeyColumnConstraint) for c in definition.constraints):
                primary_key.append(definition.name)
            # El `UNIQUE` en línea nombra a su propia columna: lo que sqlglot
            # cuelga del nodo es el nombre de la restricción, no una lista.
            if any(isinstance(c.kind, exp.UniqueColumnConstraint) for c in definition.constraints):
                _append_unique_key(unique_keys, [definition.name])
            for constraint in definition.constraints:
                if isinstance(constraint.kind, exp.Reference):
                    foreign_keys.append(_read_column_reference(definition.name, constraint.kind))
        elif isinstance(definition, exp.PrimaryKey):
            primary_key = [e.name for e in definition.expressions]
        elif isinstance(definition, exp.ForeignKey):
            foreign_keys.append(_read_foreign_key(definition))
        elif isinstance(definition, exp.UniqueColumnConstraint):
            _append_unique_key(unique_keys, _read_unique_constraint(definition))
        elif isinstance(definition, exp.Constraint):
            for inner in definition.expressions:
                if isinstance(inner, exp.PrimaryKey):
                    primary_key = [e.name for e in inner.expressions]
                elif isinstance(inner, exp.ForeignKey):
                    foreign_keys.append(_read_foreign_key(inner))
                elif isinstance(inner, exp.UniqueColumnConstraint):
                    _append_unique_key(unique_keys, _read_unique_constraint(inner))

    return {
        "name": schema.this.name,
        "columns": columns,
        "primaryKey": primary_key,
        "foreignKeys": [fk for fk in foreign_keys if fk["referencesTable"]],
        # El nombre replica al de `ParsedTable` en `src/domain/parsedSchema.ts`,
        # igual que `primaryKey` y `foreignKeys`: cada entrada es una clave
        # candidata, posiblemente compuesta, afirmada por el DDL sin ver ni una fila.
        "uniqueKeys": unique_keys,
        "rows": [],
    }


def _is_nullable(definition: exp.ColumnDef) -> bool:
    """Determina la nulabilidad declarada de una columna.

    sqlglot representa tanto `NOT NULL` como el `NULL` explícito de T-SQL con el
    mismo nodo, distinguiéndolos por el argumento `allow_null`. Comprobar solo
    el tipo del nodo marcaría toda columna con `NULL` explícito como NOT NULL.
    """
    for constraint in definition.constraints:
        if isinstance(constraint.kind, exp.NotNullColumnConstraint):
            return bool(constraint.kind.args.get("allow_null"))
    return True


def _read_unique_constraint(node: exp.UniqueColumnConstraint) -> list[str]:
    """Lee las columnas de un `UNIQUE` declarado a nivel de tabla.

    Es la única lectura del `UNIQUE`, compartida por el `CREATE TABLE` y el
    `ALTER TABLE`; T-SQL intercala `NONCLUSTERED` y sqlglot cambia el nodo por eso.
    """
    target = node.this
    if isinstance(target, exp.Schema):
        return _key_column_names(target.expressions)
    if isinstance(target, exp.NonClusteredColumnConstraint):
        return _key_column_names(target.this)
    return []


def _key_column_names(nodes: Any) -> list[str]:
    """Reduce a nombres las columnas que forman una clave.

    La misma lista llega como identificador pelado, como columna o envuelta en
    `ASC`/`DESC` según de dónde venga, y las tres nombran lo mismo.
    """
    names: list[str] = []
    for node in nodes or []:
        while isinstance(node, (exp.Ordered, exp.Column)):
            node = node.this
        names.append(node.name if isinstance(node, exp.Expression) else "")
    return names


def _append_unique_key(unique_keys: list[list[str]], columns: list[str]) -> None:
    """Suma una clave única declarada, salvo que no nombre columnas reales.

    Un índice sobre una expresión calculada llega sin nombre utilizable, y una
    clave con un hueco no se puede alinear con ninguna columna de la tabla.
    """
    if columns and all(columns):
        unique_keys.append(columns)


def _read_reference(reference: exp.Expression | None) -> tuple[str, list[str]]:
    """Lee el destino de un `REFERENCES`: la tabla y, si las declara, sus columnas.

    Es la única lectura del destino, compartida por la forma en línea y la de
    tabla; con dos podrían divergir sobre el mismo SQL.
    """
    target = reference.this if reference is not None else None
    if isinstance(target, exp.Schema):
        return target.this.name, [c.name for c in target.expressions]
    if isinstance(target, exp.Table):
        return target.name, []
    return "", []


def _read_column_reference(column: str, reference: exp.Reference) -> dict[str, Any]:
    """Traduce el `REFERENCES` en línea de una columna a una clave foránea.

    sqlglot no lo eleva a `ForeignKey`: queda como restricción de la columna, y
    sin esta rama la arista se perdería sin caer siquiera en el diagnóstico.
    """
    referenced_table, referenced_columns = _read_reference(reference)
    return {
        "columns": [column],
        "referencesTable": referenced_table,
        "referencesColumns": referenced_columns,
    }


def _read_foreign_key(node: exp.ForeignKey) -> dict[str, Any]:
    referenced_table, referenced_columns = _read_reference(node.args.get("reference"))

    # Los nombres de los campos son los de `ForeignKey` en
    # `src/domain/normalizedSchema.ts`, para que el dominio consuma el IR sin
    # una capa de traducción en el medio.
    return {
        "columns": [c.name for c in node.expressions],
        "referencesTable": referenced_table,
        "referencesColumns": referenced_columns,
    }


def _apply_alter(node: exp.Alter, tables: dict[str, dict[str, Any]]) -> None:
    """Incorpora las claves foráneas declaradas en un `ALTER TABLE` posterior.

    Los volcados declaran las tablas primero y las restricciones al final, para
    que el orden de creación no importe.
    """
    target = node.this
    name = target.name if isinstance(target, exp.Table) else None
    table = tables.get(name) if name else None
    if table is None:
        return

    for action in node.args.get("actions") or []:
        for candidate in _flatten_constraints(action):
            if isinstance(candidate, exp.ForeignKey):
                foreign_key = _read_foreign_key(candidate)
                if foreign_key["referencesTable"]:
                    table["foreignKeys"].append(foreign_key)
            elif isinstance(candidate, exp.PrimaryKey) and not table["primaryKey"]:
                table["primaryKey"] = [e.name for e in candidate.expressions]
            elif isinstance(candidate, exp.UniqueColumnConstraint):
                _append_unique_key(table["uniqueKeys"], _read_unique_constraint(candidate))


def _apply_unique_index(node: exp.Create, tables: dict[str, dict[str, Any]]) -> None:
    """Incorpora la clave que declara un `CREATE UNIQUE INDEX` posterior.

    Un índice filtrado solo es único dentro de su `WHERE`: fuera de ese
    subconjunto la columna se repite, así que no afirma ninguna clave candidata.
    """
    index = node.this
    if not node.args.get("unique") or not isinstance(index, exp.Index):
        return

    target = index.args.get("table")
    table = tables.get(target.name) if isinstance(target, exp.Table) else None
    if table is None:
        return

    params = index.args.get("params")
    if not isinstance(params, exp.IndexParameters) or params.args.get("where") is not None:
        return

    _append_unique_key(table["uniqueKeys"], _key_column_names(params.args.get("columns")))


def _flatten_constraints(action: exp.Expression) -> list[exp.Expression]:
    """Desenvuelve las restricciones que declara una acción de `ALTER TABLE`.

    sqlglot envuelve el `ADD` en un `AddConstraint` y, cuando la restricción
    lleva nombre, en un `Constraint` más adentro.
    """
    if isinstance(action, (exp.AddConstraint, exp.Constraint)):
        return [nested for inner in action.expressions for nested in _flatten_constraints(inner)]
    return [action]


def _resolve_reference_columns(tables: dict[str, dict[str, Any]]) -> None:
    """Completa contra la clave primaria destino las foráneas que no la declaran.

    Corre al final porque el volcado puede referenciar una tabla que declara más
    abajo: el destino solo se conoce con el archivo entero leído.
    """
    for table in tables.values():
        resolved: list[dict[str, Any]] = []
        for foreign_key in table["foreignKeys"]:
            if not foreign_key["referencesColumns"]:
                target = tables.get(foreign_key["referencesTable"])
                foreign_key["referencesColumns"] = list(target["primaryKey"]) if target else []
            # El dominio da por sentado que `referencesColumns` se alinea
            # posicionalmente con `columns`; una arista que no puede cumplirlo
            # miente más de lo que aporta, así que se descarta.
            if len(foreign_key["referencesColumns"]) == len(foreign_key["columns"]):
                resolved.append(foreign_key)
        table["foreignKeys"] = resolved


def _drop_redundant_unique_keys(tables: dict[str, dict[str, Any]]) -> None:
    """Descarta las claves únicas que no agregan nada sobre lo ya declarado.

    Compara por conjunto porque el orden de las columnas no cambia qué filas
    distingue una clave, y corre al final porque la primaria puede llegar en un
    `ALTER TABLE` posterior al `UNIQUE` que la repite.
    """
    for table in tables.values():
        seen: set[frozenset[str]] = set()
        if table["primaryKey"]:
            seen.add(frozenset(table["primaryKey"]))

        distinct: list[list[str]] = []
        for key in table["uniqueKeys"]:
            signature = frozenset(key)
            if signature in seen:
                continue
            seen.add(signature)
            distinct.append(key)
        table["uniqueKeys"] = distinct


def _read_insert(
    node: exp.Insert,
    tables: dict[str, dict[str, Any]],
) -> tuple[str | None, list[dict[str, Any]]]:
    """Extrae las filas de un `INSERT`, resolviendo los nombres de columna.

    `mysqldump` omite la lista de columnas y escribe `INSERT INTO t VALUES
    (...)`. En ese caso los nombres salen del `CREATE TABLE`, que el volcado
    siempre declara antes de insertar; inventarlos produciría columnas fantasma
    sobre las que el detector de dependencias trabajaría en vano.
    """
    target = node.this
    if isinstance(target, exp.Schema):
        name = target.this.name
        columns = [c.name for c in target.expressions]
    elif isinstance(target, exp.Table):
        name = target.name
        columns = []
    else:
        return None, []

    if not columns:
        declared = tables.get(name)
        if declared is not None:
            columns = [c["name"] for c in declared["columns"]]

    values = node.expression
    if not isinstance(values, exp.Values):
        return name, []

    rows: list[dict[str, Any]] = []
    for tuple_node in values.expressions:
        cells = [_to_cell_value(cell) for cell in tuple_node.expressions]
        keys = columns or [f"column_{i + 1}" for i in range(len(cells))]
        rows.append(dict(zip(keys, cells)))
    return name, rows


def _to_cell_value(node: exp.Expression) -> Any:
    """Reduce un literal SQL a los tipos que admite `CellValue` en el dominio.

    `CellValue` es `string | number | boolean | null`, así que todo lo que no
    encaje se transporta como cadena. Los binarios grandes se resumen: la
    detección de dependencias solo necesita poder comparar dos celdas, y un
    resumen conserva la igualdad sin arrastrar megabytes por fila.
    """
    if isinstance(node, exp.Null):
        return None
    if isinstance(node, exp.Boolean):
        return node.this
    # T-SQL escribe sus cadenas Unicode como `N'...'`. sqlglot las envuelve en un
    # nodo `National` que no es `Literal`, así que sin desenvolverlo el prefijo y
    # las comillas terminarían dentro del valor.
    if isinstance(node, exp.National):
        return _to_cell_value(node.this) if isinstance(node.this, exp.Expression) else node.this
    # Un volcado escribe las fechas tipadas como `CAST('2024-03-04' AS DATE)`.
    # El valor que importa es el de adentro: sin desenvolverlo, la celda termina
    # guardando la expresión SQL entera como texto. `TryCast` hereda de `Cast`,
    # así que entra por el mismo camino.
    if isinstance(node, exp.Cast):
        return _to_cell_value(node.this)
    if isinstance(node, exp.Neg):
        inner = _to_cell_value(node.this)
        return -inner if isinstance(inner, (int, float)) else inner
    if isinstance(node, exp.HexString):
        return _summarize_blob(str(node.this))
    if isinstance(node, exp.Literal):
        if node.is_string:
            return node.this
        text = node.this
        try:
            return int(text)
        except ValueError:
            try:
                return float(text)
            except ValueError:
                return text

    rendered = node.sql()
    if rendered.lower().startswith("0x"):
        return _summarize_blob(rendered[2:])
    return rendered


def _summarize_blob(payload: str) -> str:
    """Resume un binario largo conservando su identidad para las comparaciones."""
    if len(payload) <= _BLOB_SUMMARY_THRESHOLD:
        return f"0x{payload}"
    digest = hashlib.sha1(payload.encode("ascii", "ignore")).hexdigest()[:12]
    return f"0x<{len(payload) // 2} bytes:{digest}>"


def _excerpt(statement: str) -> str:
    collapsed = " ".join(statement.split())
    return collapsed[:120]


def _is_only_comments(statement: str) -> bool:
    """Indica si el fragmento no contiene nada más que comentarios.

    SSMS intercala una cabecera `/****** Object: ... ******/` antes de cada
    objeto. Al quedar fuera de toda sentencia son fragmentos legítimos que no
    aportan nada, y contarlos como fallos de parseo daría un diagnóstico falso.
    """
    without_comments = re.sub(r"(?s)/\*.*?\*/", "", statement)
    without_comments = re.sub(r"(?m)--[^\n]*$", "", without_comments)
    return not without_comments.strip()
