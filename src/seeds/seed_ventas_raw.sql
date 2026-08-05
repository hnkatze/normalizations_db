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

INSERT INTO ventas_raw (
  venta_id,
  fecha_venta,
  cliente_id,
  cliente_nombre,
  cliente_email,
  cliente_ciudad_id,
  cliente_ciudad_nombre,
  cliente_ciudad_pais,
  producto_id,
  producto_nombre,
  producto_precio,
  categoria_id,
  categoria_nombre,
  cantidad,
  subtotal
) VALUES
  (1, DATE '2024-03-04', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 101, 'Cafe molido 500g'  , 85.00, 10, 'Bebidas'  , 2, 170.00),
  (1, DATE '2024-03-04', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 102, 'Te verde 20 sobres', 45.50, 10, 'Bebidas'  , 1, 45.50),
  (1, DATE '2024-03-04', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 104, 'Pan integral'      , 28.00, 20, 'Panaderia', 3, 84.00),
  (1, DATE '2024-03-04', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 105, 'Tortillas de maiz' , 18.50, 20, 'Panaderia', 4, 74.00),
  (1, DATE '2024-03-04', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 106, 'Leche entera 1L'   , 24.90, 30, 'Lacteos'  , 2, 49.80),
  (1, DATE '2024-03-04', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 108, 'Yogurt natural 1L' , 45.50, 30, 'Lacteos'  , 1, 45.50),
  (1, DATE '2024-03-04', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 109, 'Detergente 1kg'    , 95.00, 40, 'Limpieza' , 1, 95.00),
  (2, DATE '2024-03-07', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 101, 'Cafe molido 500g'  , 85.00, 10, 'Bebidas'  , 1, 85.00),
  (2, DATE '2024-03-07', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 102, 'Te verde 20 sobres', 45.50, 10, 'Bebidas'  , 3, 136.50),
  (2, DATE '2024-03-07', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 103, 'Jugo de naranja 1L', 32.75, 10, 'Bebidas'  , 2, 65.50),
  (2, DATE '2024-03-07', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 105, 'Tortillas de maiz' , 18.50, 20, 'Panaderia', 2, 37.00),
  (2, DATE '2024-03-07', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 106, 'Leche entera 1L'   , 24.90, 30, 'Lacteos'  , 4, 99.60),
  (2, DATE '2024-03-07', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 107, 'Queso fresco 400g' , 62.00, 30, 'Lacteos'  , 1, 62.00),
  (2, DATE '2024-03-07', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 110, 'Jabon de manos'    , 21.75, 40, 'Limpieza' , 3, 65.25),
  (3, DATE '2024-03-11', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 101, 'Cafe molido 500g'  , 85.00, 10, 'Bebidas'  , 2, 170.00),
  (3, DATE '2024-03-11', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 103, 'Jugo de naranja 1L', 32.75, 10, 'Bebidas'  , 1, 32.75),
  (3, DATE '2024-03-11', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 106, 'Leche entera 1L'   , 24.90, 30, 'Lacteos'  , 3, 74.70),
  (3, DATE '2024-03-11', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 107, 'Queso fresco 400g' , 62.00, 30, 'Lacteos'  , 2, 124.00),
  (3, DATE '2024-03-11', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 108, 'Yogurt natural 1L' , 45.50, 30, 'Lacteos'  , 2, 91.00),
  (3, DATE '2024-03-11', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 109, 'Detergente 1kg'    , 95.00, 40, 'Limpieza' , 1, 95.00),
  (3, DATE '2024-03-11', 1, 'Ana Martinez'  , 'ana.martinez@example.com'  , 1, 'Tegucigalpa'        , 'Honduras' , 110, 'Jabon de manos'    , 21.75, 40, 'Limpieza' , 2, 43.50),
  (4, DATE '2024-03-11', 4, 'Diego Lopez'   , 'diego.lopez@example.com'   , 3, 'Ciudad de Guatemala', 'Guatemala', 101, 'Cafe molido 500g'  , 85.00, 10, 'Bebidas'  , 4, 340.00),
  (4, DATE '2024-03-11', 4, 'Diego Lopez'   , 'diego.lopez@example.com'   , 3, 'Ciudad de Guatemala', 'Guatemala', 102, 'Te verde 20 sobres', 45.50, 10, 'Bebidas'  , 2, 91.00),
  (4, DATE '2024-03-11', 4, 'Diego Lopez'   , 'diego.lopez@example.com'   , 3, 'Ciudad de Guatemala', 'Guatemala', 104, 'Pan integral'      , 28.00, 20, 'Panaderia', 1, 28.00),
  (4, DATE '2024-03-11', 4, 'Diego Lopez'   , 'diego.lopez@example.com'   , 3, 'Ciudad de Guatemala', 'Guatemala', 105, 'Tortillas de maiz' , 18.50, 20, 'Panaderia', 5, 92.50),
  (4, DATE '2024-03-11', 4, 'Diego Lopez'   , 'diego.lopez@example.com'   , 3, 'Ciudad de Guatemala', 'Guatemala', 107, 'Queso fresco 400g' , 62.00, 30, 'Lacteos'  , 1, 62.00),
  (4, DATE '2024-03-11', 4, 'Diego Lopez'   , 'diego.lopez@example.com'   , 3, 'Ciudad de Guatemala', 'Guatemala', 108, 'Yogurt natural 1L' , 45.50, 30, 'Lacteos'  , 3, 136.50),
  (4, DATE '2024-03-11', 4, 'Diego Lopez'   , 'diego.lopez@example.com'   , 3, 'Ciudad de Guatemala', 'Guatemala', 110, 'Jabon de manos'    , 21.75, 40, 'Limpieza' , 1, 21.75),
  (5, DATE '2024-03-18', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 101, 'Cafe molido 500g'  , 85.00, 10, 'Bebidas'  , 1, 85.00),
  (5, DATE '2024-03-18', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 102, 'Te verde 20 sobres', 45.50, 10, 'Bebidas'  , 1, 45.50),
  (5, DATE '2024-03-18', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 103, 'Jugo de naranja 1L', 32.75, 10, 'Bebidas'  , 3, 98.25),
  (5, DATE '2024-03-18', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 104, 'Pan integral'      , 28.00, 20, 'Panaderia', 2, 56.00),
  (5, DATE '2024-03-18', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 106, 'Leche entera 1L'   , 24.90, 30, 'Lacteos'  , 1, 24.90),
  (5, DATE '2024-03-18', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 108, 'Yogurt natural 1L' , 45.50, 30, 'Lacteos'  , 2, 91.00),
  (5, DATE '2024-03-18', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 109, 'Detergente 1kg'    , 95.00, 40, 'Limpieza' , 2, 190.00),
  (6, DATE '2024-03-22', 5, 'Elena Rivas'   , 'elena.rivas@example.com'   , 2, 'San Pedro Sula'     , 'Honduras' , 103, 'Jugo de naranja 1L', 32.75, 10, 'Bebidas'  , 4, 131.00),
  (6, DATE '2024-03-22', 5, 'Elena Rivas'   , 'elena.rivas@example.com'   , 2, 'San Pedro Sula'     , 'Honduras' , 104, 'Pan integral'      , 28.00, 20, 'Panaderia', 3, 84.00),
  (6, DATE '2024-03-22', 5, 'Elena Rivas'   , 'elena.rivas@example.com'   , 2, 'San Pedro Sula'     , 'Honduras' , 105, 'Tortillas de maiz' , 18.50, 20, 'Panaderia', 1, 18.50),
  (6, DATE '2024-03-22', 5, 'Elena Rivas'   , 'elena.rivas@example.com'   , 2, 'San Pedro Sula'     , 'Honduras' , 106, 'Leche entera 1L'   , 24.90, 30, 'Lacteos'  , 2, 49.80),
  (6, DATE '2024-03-22', 5, 'Elena Rivas'   , 'elena.rivas@example.com'   , 2, 'San Pedro Sula'     , 'Honduras' , 107, 'Queso fresco 400g' , 62.00, 30, 'Lacteos'  , 3, 186.00),
  (6, DATE '2024-03-22', 5, 'Elena Rivas'   , 'elena.rivas@example.com'   , 2, 'San Pedro Sula'     , 'Honduras' , 109, 'Detergente 1kg'    , 95.00, 40, 'Limpieza' , 1, 95.00),
  (6, DATE '2024-03-22', 5, 'Elena Rivas'   , 'elena.rivas@example.com'   , 2, 'San Pedro Sula'     , 'Honduras' , 110, 'Jabon de manos'    , 21.75, 40, 'Limpieza' , 4, 87.00),
  (7, DATE '2024-03-26', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 101, 'Cafe molido 500g'  , 85.00, 10, 'Bebidas'  , 3, 255.00),
  (7, DATE '2024-03-26', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 102, 'Te verde 20 sobres', 45.50, 10, 'Bebidas'  , 4, 182.00),
  (7, DATE '2024-03-26', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 103, 'Jugo de naranja 1L', 32.75, 10, 'Bebidas'  , 1, 32.75),
  (7, DATE '2024-03-26', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 104, 'Pan integral'      , 28.00, 20, 'Panaderia', 1, 28.00),
  (7, DATE '2024-03-26', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 105, 'Tortillas de maiz' , 18.50, 20, 'Panaderia', 3, 55.50),
  (7, DATE '2024-03-26', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 106, 'Leche entera 1L'   , 24.90, 30, 'Lacteos'  , 5, 124.50),
  (7, DATE '2024-03-26', 2, 'Bruno Castillo', 'bruno.castillo@example.com', 2, 'San Pedro Sula'     , 'Honduras' , 107, 'Queso fresco 400g' , 62.00, 30, 'Lacteos'  , 2, 124.00),
  (8, DATE '2024-03-29', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 101, 'Cafe molido 500g'  , 85.00, 10, 'Bebidas'  , 2, 170.00),
  (8, DATE '2024-03-29', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 102, 'Te verde 20 sobres', 45.50, 10, 'Bebidas'  , 2, 91.00),
  (8, DATE '2024-03-29', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 104, 'Pan integral'      , 28.00, 20, 'Panaderia', 4, 112.00),
  (8, DATE '2024-03-29', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 106, 'Leche entera 1L'   , 24.90, 30, 'Lacteos'  , 1, 24.90),
  (8, DATE '2024-03-29', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 108, 'Yogurt natural 1L' , 45.50, 30, 'Lacteos'  , 1, 45.50),
  (8, DATE '2024-03-29', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 109, 'Detergente 1kg'    , 95.00, 40, 'Limpieza' , 3, 285.00),
  (8, DATE '2024-03-29', 3, 'Carla Fuentes' , 'carla.fuentes@example.com' , 1, 'Tegucigalpa'        , 'Honduras' , 110, 'Jabon de manos'    , 21.75, 40, 'Limpieza' , 2, 43.50);
