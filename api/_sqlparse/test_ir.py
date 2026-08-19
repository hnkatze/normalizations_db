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


def test_unique_de_tabla() -> None:
    tables = _tables(
        """
        CREATE TABLE turno (
          id INT PRIMARY KEY,
          conductor_id INT,
          bloque_id INT,
          UNIQUE (conductor_id, bloque_id)
        );
        """
    )

    assert tables["turno"]["uniqueKeys"] == [["conductor_id", "bloque_id"]]


def test_unique_de_tabla_con_nombre_de_restriccion() -> None:
    tables = _tables(
        """
        CREATE TABLE cuota (
          id INT PRIMARY KEY,
          plan_id INT,
          numero INT,
          CONSTRAINT uq_cuota UNIQUE (plan_id, numero)
        );
        """
    )

    assert tables["cuota"]["uniqueKeys"] == [["plan_id", "numero"]]


def test_unique_en_linea_en_la_definicion_de_columna() -> None:
    tables = _tables(
        "CREATE TABLE alumno (id INT PRIMARY KEY, dni VARCHAR(20) UNIQUE, nombre VARCHAR(50));"
    )

    assert tables["alumno"]["uniqueKeys"] == [["dni"]]


def test_unique_en_linea_con_nombre_de_restriccion() -> None:
    # T-SQL escribe `constraint UQ_x unique` pegado a la columna; el nombre no
    # es una lista de columnas y confundirlo produciría una clave inventada.
    tables = _tables(
        """
        CREATE TABLE plantilla (
          id INT PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL CONSTRAINT uq_plantilla_nombre UNIQUE
        );
        """
    )

    assert tables["plantilla"]["uniqueKeys"] == [["nombre"]]


def test_create_unique_index_posterior_a_la_tabla() -> None:
    tables = _tables(
        """
        CREATE TABLE evento (id INT PRIMARY KEY, evento_uid VARCHAR(36), origen VARCHAR(20));
        CREATE UNIQUE INDEX ux_evento_uid ON evento (evento_uid, origen);
        """
    )

    assert tables["evento"]["uniqueKeys"] == [["evento_uid", "origen"]]


def test_create_index_no_unico_no_aporta_clave() -> None:
    tables = _tables(
        """
        CREATE TABLE evento (id INT PRIMARY KEY, origen VARCHAR(20));
        CREATE INDEX ix_evento_origen ON evento (origen);
        """
    )

    assert tables["evento"]["uniqueKeys"] == []


def test_create_unique_index_filtrado_no_es_clave_candidata() -> None:
    # Un índice con `WHERE` solo es único sobre el subconjunto filtrado: fuera
    # de él la columna puede repetirse, así que no determina nada.
    tables = _tables(
        """
        CREATE TABLE cliente (id INT PRIMARY KEY, telefono VARCHAR(20), estado INT);
        CREATE UNIQUE INDEX ux_cliente_telefono ON cliente (telefono) WHERE estado = 1;
        """
    )

    assert tables["cliente"]["uniqueKeys"] == []


def test_create_unique_index_sobre_una_tabla_inexistente_se_descarta() -> None:
    tables = _tables("CREATE UNIQUE INDEX ux_fantasma ON fantasma (codigo);")

    assert tables == {}


def test_alter_table_add_constraint_unique() -> None:
    tables = _tables(
        """
        CREATE TABLE pago (id INT PRIMARY KEY, referencia VARCHAR(40));
        ALTER TABLE pago ADD CONSTRAINT uq_pago UNIQUE (referencia);
        """
    )

    assert tables["pago"]["uniqueKeys"] == [["referencia"]]


def test_unique_nonclustered_de_tsql() -> None:
    # T-SQL intercala `NONCLUSTERED` entre `UNIQUE` y la lista de columnas, y
    # sqlglot la envuelve en otro nodo en vez de dejar el `Schema` habitual.
    tables = _tables(
        """
        SET ANSI_NULLS ON
        GO
        CREATE TABLE reparto (id INT PRIMARY KEY, ruta_id INT, orden INT,
          CONSTRAINT uq_reparto UNIQUE NONCLUSTERED (ruta_id, orden))
        GO
        """
    )

    assert tables["reparto"]["uniqueKeys"] == [["ruta_id", "orden"]]


def test_unique_que_repite_la_clave_primaria_no_se_duplica() -> None:
    tables = _tables(
        """
        CREATE TABLE nota (
          alumno_id INT,
          curso_id INT,
          valor INT,
          PRIMARY KEY (alumno_id, curso_id),
          UNIQUE (curso_id, alumno_id)
        );
        """
    )

    assert tables["nota"]["primaryKey"] == ["alumno_id", "curso_id"]
    assert tables["nota"]["uniqueKeys"] == []


def test_unique_que_repite_una_clave_primaria_declarada_por_alter() -> None:
    # La clave primaria puede llegar después del `UNIQUE`; comparar en el
    # momento de leerlo dejaría pasar el duplicado.
    tables = _tables(
        """
        CREATE TABLE nota (alumno_id INT, curso_id INT, UNIQUE (alumno_id, curso_id));
        ALTER TABLE nota ADD PRIMARY KEY (alumno_id, curso_id);
        """
    )

    assert tables["nota"]["uniqueKeys"] == []


def test_una_clave_unica_declarada_dos_veces_se_emite_una_sola_vez() -> None:
    tables = _tables(
        """
        CREATE TABLE tienda (id INT PRIMARY KEY, codigo VARCHAR(20) UNIQUE);
        CREATE UNIQUE INDEX ux_tienda_codigo ON tienda (codigo);
        """
    )

    assert tables["tienda"]["uniqueKeys"] == [["codigo"]]


def test_uniqueidentifier_no_es_una_restriccion_unique() -> None:
    # `uniqueidentifier` es el tipo GUID de T-SQL. Contarlo como restricción
    # inventaría una clave candidata sobre una columna que nadie declaró única.
    tables = _tables(
        """
        SET ANSI_NULLS ON
        GO
        CREATE TABLE bandeja (id INT PRIMARY KEY, evento_id UNIQUEIDENTIFIER NOT NULL)
        GO
        """
    )

    assert tables["bandeja"]["uniqueKeys"] == []


def test_una_tabla_sin_unique_declara_la_lista_vacia() -> None:
    # El campo existe siempre: el dominio no debería distinguir "no hay claves"
    # de "esta versión del lector todavía no las leía".
    tables = _tables("CREATE TABLE simple (id INT PRIMARY KEY, nombre VARCHAR(20));")

    assert tables["simple"]["uniqueKeys"] == []


def test_dos_esquemas_con_el_mismo_nombre_de_tabla_no_se_pisan() -> None:
    """Un volcado multi-esquema declara `ventas.cliente` y `rrhh.cliente`.

    Con la clave corta la segunda sobrescribía a la primera: la tabla
    desaparecía del IR y las claves foráneas que la referenciaban quedaban
    apuntando a columnas que no existen.
    """
    tables = _tables(
        """
        CREATE TABLE ventas.cliente (id INT PRIMARY KEY, nombre VARCHAR(50));
        CREATE TABLE rrhh.cliente (codigo INT PRIMARY KEY, area VARCHAR(50));
        """
    )

    assert set(tables) == {"ventas.cliente", "rrhh.cliente"}
    assert [c["name"] for c in tables["ventas.cliente"]["columns"]] == ["id", "nombre"]
    assert [c["name"] for c in tables["rrhh.cliente"]["columns"]] == ["codigo", "area"]


def test_la_referencia_calificada_resuelve_al_esquema_que_nombra() -> None:
    """`pedido` no compite por su nombre, así que lo conserva corto.

    Lo que se califica es el DESTINO, que sí compite. Los dos nombres conviven
    en la misma clave foránea y esa mezcla es deliberada.
    """
    tables = _tables(
        """
        CREATE TABLE ventas.cliente (id INT PRIMARY KEY);
        CREATE TABLE rrhh.cliente (codigo INT PRIMARY KEY);
        CREATE TABLE ventas.pedido (
            id INT PRIMARY KEY,
            cliente_id INT REFERENCES ventas.cliente(id)
        );
        """
    )

    assert tables["pedido"]["foreignKeys"] == [
        {
            "columns": ["cliente_id"],
            "referencesTable": "ventas.cliente",
            "referencesColumns": ["id"],
        }
    ]


def test_sin_colision_el_nombre_se_queda_corto() -> None:
    """El nombre calificado es la excepción, no la regla.

    Calificar siempre cambiaría el nombre que la aplicación muestra en cada
    archivo que hoy funciona, sin resolver ningún conflicto.
    """
    tables = _tables(
        """
        CREATE TABLE dbo.alumno (id INT PRIMARY KEY);
        CREATE TABLE dbo.nota (id INT PRIMARY KEY, alumno_id INT REFERENCES dbo.alumno(id));
        """
    )

    assert set(tables) == {"alumno", "nota"}
    assert tables["nota"]["foreignKeys"][0]["referencesTable"] == "alumno"
