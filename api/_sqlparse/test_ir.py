"""
Pruebas de la extracción de claves foráneas.

Vive junto a `ir.py` por la misma razón que las pruebas de TypeScript viven
junto a su módulo, y el prefijo `_` de la carpeta la mantiene fuera de las
funciones que Vercel publica.
"""

from typing import Any

from .ir import build_ir


def _tables(sql: str) -> dict[str, dict[str, Any]]:
    """Corre el parser sobre el volcado y devuelve sus tablas por nombre."""
    return {table["name"]: table for table in build_ir(sql.encode("utf-8"))["tables"]}


def _column(table: dict[str, Any], name: str) -> dict[str, Any]:
    return next(column for column in table["columns"] if column["name"] == name)


def test_referencia_en_linea_con_lista_de_columnas() -> None:
    tables = _tables(
        """
        CREATE TABLE alumno (id INT PRIMARY KEY, nombre VARCHAR(50));
        CREATE TABLE inscripcion (id INT PRIMARY KEY, alumno_id INT REFERENCES alumno(id));
        """
    )

    assert tables["inscripcion"]["foreignKeys"] == [
        {"columns": ["alumno_id"], "referencesTable": "alumno", "referencesColumns": ["id"]}
    ]


def test_referencia_en_linea_sin_lista_se_resuelve_contra_la_clave_primaria() -> None:
    # `REFERENCES sede` sin columnas significa "la clave primaria de sede".
    tables = _tables(
        """
        CREATE TABLE sede (codigo INT PRIMARY KEY, ciudad VARCHAR(50));
        CREATE TABLE inscripcion (id INT PRIMARY KEY, sede_id INT REFERENCES sede);
        """
    )

    assert tables["inscripcion"]["foreignKeys"] == [
        {"columns": ["sede_id"], "referencesTable": "sede", "referencesColumns": ["codigo"]}
    ]


def test_referencia_en_linea_a_una_tabla_declarada_despues() -> None:
    # El orden de declaración de un volcado no es garantía: la resolución no
    # puede depender de que la tabla destino ya se haya leído.
    tables = _tables(
        """
        CREATE TABLE inscripcion (id INT PRIMARY KEY, sede_id INT REFERENCES sede);
        CREATE TABLE sede (codigo INT PRIMARY KEY);
        """
    )

    assert tables["inscripcion"]["foreignKeys"] == [
        {"columns": ["sede_id"], "referencesTable": "sede", "referencesColumns": ["codigo"]}
    ]


def test_referencia_en_linea_a_una_tabla_inexistente_se_descarta() -> None:
    tables = _tables(
        "CREATE TABLE inscripcion (id INT PRIMARY KEY, curso_id INT REFERENCES curso);"
    )

    assert tables["inscripcion"]["foreignKeys"] == []
    # La columna sigue existiendo: lo irresoluble es la arista, no el dato.
    assert _column(tables["inscripcion"], "curso_id")["sqlType"] == "integer"


def test_referencia_en_linea_a_una_tabla_sin_clave_primaria_se_descarta() -> None:
    tables = _tables(
        """
        CREATE TABLE sede (codigo INT, ciudad VARCHAR(50));
        CREATE TABLE inscripcion (id INT PRIMARY KEY, sede_id INT REFERENCES sede);
        """
    )

    assert tables["inscripcion"]["foreignKeys"] == []


def test_referencia_en_linea_convive_con_not_null() -> None:
    tables = _tables(
        """
        CREATE TABLE curso (codigo INT PRIMARY KEY);
        CREATE TABLE inscripcion (
          id INT PRIMARY KEY,
          curso_id INT NOT NULL REFERENCES curso (codigo)
        );
        """
    )

    assert tables["inscripcion"]["foreignKeys"] == [
        {"columns": ["curso_id"], "referencesTable": "curso", "referencesColumns": ["codigo"]}
    ]
    assert _column(tables["inscripcion"], "curso_id")["nullable"] is False


def test_una_columna_con_referencia_en_linea_conserva_tipo_y_nulabilidad() -> None:
    tables = _tables(
        """
        CREATE TABLE alumno (id INT PRIMARY KEY);
        CREATE TABLE inscripcion (
          id INT PRIMARY KEY,
          alumno_id INT REFERENCES alumno(id),
          observacion VARCHAR(80) NULL
        );
        """
    )

    assert tables["inscripcion"]["columns"] == [
        {"name": "id", "sqlType": "integer", "nullable": True},
        {"name": "alumno_id", "sqlType": "integer", "nullable": True},
        {"name": "observacion", "sqlType": "character varying", "nullable": True},
    ]


def test_clave_foranea_compuesta_a_nivel_de_tabla() -> None:
    tables = _tables(
        """
        CREATE TABLE inscripcion (
          alumno_id INT,
          curso_id INT,
          PRIMARY KEY (alumno_id, curso_id)
        );
        CREATE TABLE nota (
          alumno_id INT,
          curso_id INT,
          valor INT,
          FOREIGN KEY (alumno_id, curso_id) REFERENCES inscripcion (alumno_id, curso_id)
        );
        """
    )

    assert tables["nota"]["foreignKeys"] == [
        {
            "columns": ["alumno_id", "curso_id"],
            "referencesTable": "inscripcion",
            "referencesColumns": ["alumno_id", "curso_id"],
        }
    ]


def test_alter_table_add_constraint() -> None:
    tables = _tables(
        """
        CREATE TABLE alumno (id INT PRIMARY KEY);
        CREATE TABLE pago (id INT PRIMARY KEY, alumno_id INT);
        ALTER TABLE pago ADD CONSTRAINT fk_pago FOREIGN KEY (alumno_id) REFERENCES alumno (id);
        """
    )

    assert tables["pago"]["foreignKeys"] == [
        {"columns": ["alumno_id"], "referencesTable": "alumno", "referencesColumns": ["id"]}
    ]


def test_alter_table_sin_lista_de_columnas_se_resuelve_contra_la_clave_primaria() -> None:
    tables = _tables(
        """
        CREATE TABLE sede (codigo INT PRIMARY KEY);
        CREATE TABLE recibo (id INT PRIMARY KEY, sede_id INT);
        ALTER TABLE recibo ADD CONSTRAINT fk_recibo FOREIGN KEY (sede_id) REFERENCES sede;
        """
    )

    assert tables["recibo"]["foreignKeys"] == [
        {"columns": ["sede_id"], "referencesTable": "sede", "referencesColumns": ["codigo"]}
    ]


def test_una_referencia_sin_lista_a_una_clave_compuesta_se_descarta() -> None:
    # Copiar una clave primaria de dos columnas sobre una foránea de una sola
    # rompería el alineamiento posicional que el dominio da por sentado.
    tables = _tables(
        """
        CREATE TABLE inscripcion (
          alumno_id INT,
          curso_id INT,
          PRIMARY KEY (alumno_id, curso_id)
        );
        CREATE TABLE nota (id INT PRIMARY KEY, inscripcion_id INT REFERENCES inscripcion);
        """
    )

    assert tables["nota"]["foreignKeys"] == []


def test_toda_clave_foranea_emitida_respeta_el_alineamiento_posicional() -> None:
    tables = _tables(
        """
        CREATE TABLE alumno (id INT PRIMARY KEY);
        CREATE TABLE sede (codigo INT PRIMARY KEY);
        CREATE TABLE inscripcion (
          id INT PRIMARY KEY,
          alumno_id INT NOT NULL REFERENCES alumno(id),
          sede_id INT REFERENCES sede,
          fantasma_id INT REFERENCES fantasma
        );
        CREATE TABLE pago (id INT PRIMARY KEY, alumno_id INT);
        ALTER TABLE pago ADD CONSTRAINT fk_pago FOREIGN KEY (alumno_id) REFERENCES alumno;
        """
    )

    emitted = [(name, fk) for name, table in tables.items() for fk in table["foreignKeys"]]
    # Anti-vacuidad: si no se emitiera ninguna arista, las comprobaciones de
    # abajo pasarían sin haber mirado nada.
    assert len(emitted) == 3
    for name, fk in emitted:
        assert len(fk["columns"]) == len(fk["referencesColumns"]), (name, fk)
        assert fk["referencesTable"] in tables, (name, fk)
