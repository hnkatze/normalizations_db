-- Volcado de SOLO ESQUEMA: la misma tabla que `seed_ventas_raw.sql` sin una
-- sola fila.
--
-- Existe porque un export de solo estructura es el caso corriente de una
-- herramienta como SSMS, y el motor SIEMPRE pudo normalizarlo: ni
-- `normalizeTo3NF` ni `generateDdl` leen `table.rows`. Lo que faltaba era la
-- puerta de entrada para las reglas. Sin este archivo, ese camino no tiene
-- ninguna verificacion en un navegador.

-- =============================================================================
-- ventas_raw -- la tabla de origen sin normalizar de la que parte este proyecto.
--
-- QUÉ ES ESTO
--   Una única tabla plana de ventas que lleva en línea los atributos de
--   cliente, ciudad, producto y categoría. Está INTENCIONALMENTE DESNORMALIZADA:
--   viola la 2FN y la 3FN por diseño. No la "corrija" -- descomponerla es todo
--   el ejercicio.
--
--   Cada redundancia que hay aquí es deliberada y está documentada en
--   src/seeds/GROUND_TRUTH.md, que es el solucionario con el que se califica el
--   motor de detección. src/seeds/ventasRawFixture.ts contiene los mismos datos
--   como fixture en memoria; los dos nunca deben divergir.
--
-- CÓMO CARGARLA
--   Este script se ejecuta DENTRO de un esquema (`staging` de forma
--   predeterminada), así que el nombre de la tabla no lleva prefijo de esquema.
--   Configure el search_path antes de ejecutarlo:
--
--     CREATE SCHEMA IF NOT EXISTS staging;
--     SET search_path TO staging;
--     \i src/seeds/seed_ventas_raw.sql
--
--   Reejecutable: la tabla se elimina y se vuelve a crear.
--
-- FORMA
--   56 filas construidas a partir de 8 ventas, 10 productos,
--   5 clientes distribuidos en 3 ciudades y 4 categorias.
--   Grano / clave primaria: (venta_id, producto_id) -- una fila por línea de
--   producto de una venta.
--
--   subtotal es DERIVADO: subtotal = cantidad * producto_precio, exacto para
--   cada fila. Eso es a propósito, y hace que el detector informe dependencias
--   adicionales verdaderas pero poco interesantes. Consulte la sección
--   "Atributo derivado" de GROUND_TRUTH.md antes de reportarlo como un error.
--
-- GENERADO A PARTIR DE src/seeds/ventasRawFixture.ts -- edite el fixture, no este archivo.
-- =============================================================================

DROP TABLE IF EXISTS ventas_raw;

CREATE TABLE ventas_raw (
  venta_id              integer       NOT NULL,
  fecha_venta           date          NOT NULL,
  cliente_id            integer       NOT NULL,
  cliente_nombre        varchar(120)  NOT NULL,
  cliente_email         varchar(160)  NOT NULL,
  cliente_ciudad_id     integer       NOT NULL,
  cliente_ciudad_nombre varchar(120)  NOT NULL,
  cliente_ciudad_pais   varchar(80)   NOT NULL,
  producto_id           integer       NOT NULL,
  producto_nombre       varchar(160)  NOT NULL,
  producto_precio       numeric(10,2) NOT NULL,
  categoria_id          integer       NOT NULL,
  categoria_nombre      varchar(120)  NOT NULL,
  cantidad              integer       NOT NULL,
  subtotal              numeric(10,2) NOT NULL,

  -- La clave compuesta es lo que convierte en violaciones a las violaciones de
  -- 2FN: fecha_venta y cliente_id dependen solo de venta_id, y producto_*
  -- depende solo de producto_id.
  CONSTRAINT ventas_raw_pkey PRIMARY KEY (venta_id, producto_id)
);

COMMENT ON TABLE ventas_raw IS
  'Tabla de ventas desnormalizada a propósito. Datos semilla para la descomposición automática a 3FN; ver src/seeds/GROUND_TRUTH.md.';
