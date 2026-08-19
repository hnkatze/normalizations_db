-- =============================================================================
-- biblioteca -- el caso extremo: todas las trampas de un parcial, en un archivo.
--
-- QUÉ ES ESTO
--   Un archivo ADVERSARIAL. No representa un sistema que alguien construiría:
--   representa lo que un docente arma cuando quiere ver si el alumno --o la
--   herramienta-- entendió normalización o solo memorizó el caso feliz.
--
--   Cada bloque ataca una parte distinta del análisis. Están numerados para
--   poder señalar cuál falló cuando algo falla.
--
-- CÓMO CARGARLO
--     CREATE SCHEMA IF NOT EXISTS staging;
--     SET search_path TO staging;
--     \i src/seeds/seed_biblioteca_extremo.sql
--
--   Reejecutable: cada tabla se elimina y se vuelve a crear.
--
-- LAS TRAMPAS, EN ORDEN
--   1. sucursal        -- el final de la cadena transitiva
--   2. prestamo_raw    -- 1FN, 2FN, 3FN y BCNF violadas a la vez
--   3. ejemplar        -- FK declarada + prefijo de nombre (heurística)
--   4. bitacora_acceso -- sin clave primaria y sin unicidad observable
--   5. socio_documento -- clave candidata alternativa, declarada tarde
-- =============================================================================

DROP TABLE IF EXISTS prestamo_raw;
DROP TABLE IF EXISTS ejemplar;
DROP TABLE IF EXISTS bitacora_acceso;
DROP TABLE IF EXISTS socio_documento;
DROP TABLE IF EXISTS sucursal;

-- -----------------------------------------------------------------------------
-- 1. sucursal -- el final de la cadena transitiva de prestamo_raw.
-- -----------------------------------------------------------------------------
CREATE TABLE sucursal (
  sucursal_id     INT PRIMARY KEY,
  sucursal_nombre VARCHAR(60) NOT NULL,
  ciudad          VARCHAR(40) NOT NULL,
  region          VARCHAR(40) NOT NULL
);

INSERT INTO sucursal (sucursal_id, sucursal_nombre, ciudad, region) VALUES
  (1, 'Central', 'Tegucigalpa', 'Francisco Morazán'),
  (2, 'Norte', 'San Pedro Sula', 'Cortés'),
  (3, 'Valle de Ángeles', 'Valle de Ángeles', 'Francisco Morazán');

-- -----------------------------------------------------------------------------
-- 2. prestamo_raw -- la tabla del ejercicio.
--
--    Clave primaria COMPUESTA (prestamo_id, ejemplar_id): un préstamo se lleva
--    varios ejemplares. Esa composición es lo que hace posible que existan
--    dependencias PARCIALES, que es todo el punto de la 2FN. Con una clave de
--    una sola columna la 2FN se satisface sola y el ejercicio se vuelve trivial.
--
--    VIOLA 1FN de dos formas distintas a la vez:
--      a) telefono_1 / telefono_2 / telefono_3 -- grupo repetido por sufijo.
--      b) generos -- varios valores en una celda, separados por punto y coma.
--
--    MEDIDO CONTRA LA APLICACIÓN: detecta (a) y la resuelve sola --las 16 filas
--    de abajo se vuelven 30 al expandir los teléfonos-- pero NO detecta (b).
--    `classifyNonAtomicValue` reconoce arreglos JSON, objetos JSON y colecciones
--    SQL explícitas; un texto con separadores le pasa como valor atómico.
--    No es un descuido: adivinar separadores parte en dos una dirección como
--    'Calle 5, Col. Centro'. Pero el multivaluado por coma es EL ejemplo de
--    libro de texto, así que es el hueco más probable frente a un archivo
--    escrito por un docente. Queda acá justamente para que se vea.
--
--    VIOLA 2FN -- dependencias parciales, una de cada mitad de la clave:
--      prestamo_id -> socio_id, socio_nombre, fecha_prestamo, telefono_*
--      ejemplar_id -> isbn, titulo, autor_id, autor_nombre, generos
--
--    VIOLA 3FN -- cadena transitiva donde ningún eslabón es clave:
--      socio_id -> sucursal_id -> ciudad -> region
--
--    VIOLA BCNF sin violar 3FN:
--      isbn -> titulo y titulo -> isbn son ambas ciertas en los datos. isbn es
--      un determinante que NO es superclave de la relación. Este es el caso que
--      separa a quien entendió BCNF de quien llegó hasta 3FN y paró.
--
--    Y trae una COLUMNA DERIVADA que no debe proponerse como determinante:
--      multa_total = dias_atraso * multa_diaria
--
--    LA TRAMPA FINAL, y la más instructiva: multa_diaria -> sucursal_id se
--    cumple en las 30 filas por accidente --cada monto de multa cayó en una
--    sola sucursal-- pero es FALSA en el dominio: nada impide que dos sucursales
--    cobren lo mismo. La aplicación la detecta y extrae una tabla `multa_diaria`
--    con clave primaria `multa_diaria`, que es exactamente el resultado
--    esperado de una detección honesta sobre pocas filas.
--    Ese es el límite que hay que entender: una dependencia funcional se
--    REFUTA con datos, nunca se DEMUESTRA con ellos. Que no aparezca un
--    contraejemplo en 30 filas no convierte la regla en verdadera. Por eso la
--    aplicación muestra la evidencia --cuántas filas, cuántos grupos-- en vez
--    de afirmar la regla a secas, y por eso existe el recorrido manual.
-- -----------------------------------------------------------------------------
CREATE TABLE prestamo_raw (
  prestamo_id    INT NOT NULL,
  ejemplar_id    INT NOT NULL,
  socio_id       INT NOT NULL,
  socio_nombre   VARCHAR(60) NOT NULL,
  telefono_1     VARCHAR(20),
  telefono_2     VARCHAR(20),
  telefono_3     VARCHAR(20),
  sucursal_id    INT NOT NULL,
  ciudad         VARCHAR(40) NOT NULL,
  region         VARCHAR(40) NOT NULL,
  isbn           VARCHAR(20) NOT NULL,
  titulo         VARCHAR(90) NOT NULL,
  autor_id       INT NOT NULL,
  autor_nombre   VARCHAR(60) NOT NULL,
  generos        VARCHAR(80) NOT NULL,
  fecha_prestamo DATE NOT NULL,
  dias_atraso    INT NOT NULL,
  multa_diaria   NUMERIC(6,2) NOT NULL,
  multa_total    NUMERIC(8,2) NOT NULL,
  PRIMARY KEY (prestamo_id, ejemplar_id)
);

/* Los datos sostienen cada dependencia declarada arriba. También contradicen a
   propósito una que "se ve" cierta a primera vista: ciudad -> sucursal_id es
   FALSA, porque la región Francisco Morazán tiene dos sucursales en ciudades
   distintas. Un detector que la proponga está mirando el nombre, no los datos. */
INSERT INTO prestamo_raw VALUES
  (101, 9001, 1, 'Ana Martínez', '2200-1111', '9900-1111', NULL, 1, 'Tegucigalpa', 'Francisco Morazán', '978-84-376-0494-7', 'Cien años de soledad', 501, 'García Márquez', 'Novela; Realismo mágico', CAST('2026-03-04' AS DATE), 0, 5.00, 0.00),
  (101, 9002, 1, 'Ana Martínez', '2200-1111', '9900-1111', NULL, 1, 'Tegucigalpa', 'Francisco Morazán', '978-84-204-8305-1', 'El amor en los tiempos del cólera', 501, 'García Márquez', 'Novela', CAST('2026-03-04' AS DATE), 3, 5.00, 15.00),
  (102, 9003, 2, 'Luis OBrien', '2200-2222', NULL, NULL, 2, 'San Pedro Sula', 'Cortés', '978-0-14-118776-1', 'Rebelión en la granja', 502, 'George Orwell', 'Novela; Sátira; Política', CAST('2026-03-06' AS DATE), 0, 7.50, 0.00),
  (102, 9001, 2, 'Luis OBrien', '2200-2222', NULL, NULL, 2, 'San Pedro Sula', 'Cortés', '978-84-376-0494-7', 'Cien años de soledad', 501, 'García Márquez', 'Novela; Realismo mágico', CAST('2026-03-06' AS DATE), 12, 7.50, 90.00),
  (103, 9004, 3, 'Sofía Núñez', '2200-3333', '9900-3333', '3300-3333', 1, 'Tegucigalpa', 'Francisco Morazán', '978-0-452-28423-4', '1984', 502, 'George Orwell', 'Novela; Distopía', CAST('2026-03-09' AS DATE), 1, 5.00, 5.00),
  (103, 9005, 3, 'Sofía Núñez', '2200-3333', '9900-3333', '3300-3333', 1, 'Tegucigalpa', 'Francisco Morazán', '978-607-31-1234-5', 'La casa de los espíritus', 503, 'Isabel Allende', 'Novela; Realismo mágico', CAST('2026-03-09' AS DATE), 0, 5.00, 0.00),
  (104, 9002, 4, 'Carlos Pérez', '2200-4444', NULL, NULL, 3, 'Valle de Ángeles', 'Francisco Morazán', '978-84-204-8305-1', 'El amor en los tiempos del cólera', 501, 'García Márquez', 'Novela', CAST('2026-03-11' AS DATE), 5, 4.25, 21.25),
  (104, 9004, 4, 'Carlos Pérez', '2200-4444', NULL, NULL, 3, 'Valle de Ángeles', 'Francisco Morazán', '978-0-452-28423-4', '1984', 502, 'George Orwell', 'Novela; Distopía', CAST('2026-03-11' AS DATE), 0, 4.25, 0.00),
  (105, 9006, 5, 'María Fernández', '2200-5555', '9900-5555', NULL, 2, 'San Pedro Sula', 'Cortés', '978-84-663-0005-7', 'Crónica de una muerte anunciada', 501, 'García Márquez', 'Novela; Periodismo', CAST('2026-03-14' AS DATE), 2, 6.00, 12.00),
  (105, 9003, 5, 'María Fernández', '2200-5555', '9900-5555', NULL, 2, 'San Pedro Sula', 'Cortés', '978-0-14-118776-1', 'Rebelión en la granja', 502, 'George Orwell', 'Novela; Sátira; Política', CAST('2026-03-14' AS DATE), 0, 6.00, 0.00),
  (106, 9005, 1, 'Ana Martínez', '2200-1111', '9900-1111', NULL, 1, 'Tegucigalpa', 'Francisco Morazán', '978-607-31-1234-5', 'La casa de los espíritus', 503, 'Isabel Allende', 'Novela; Realismo mágico', CAST('2026-03-18' AS DATE), 4, 5.00, 20.00),
  (106, 9006, 1, 'Ana Martínez', '2200-1111', '9900-1111', NULL, 1, 'Tegucigalpa', 'Francisco Morazán', '978-84-663-0005-7', 'Crónica de una muerte anunciada', 501, 'García Márquez', 'Novela; Periodismo', CAST('2026-03-18' AS DATE), 0, 5.00, 0.00),
  (107, 9007, 3, 'Sofía Núñez', '2200-3333', '9900-3333', '3300-3333', 1, 'Tegucigalpa', 'Francisco Morazán', '978-950-07-1234-8', 'Ficciones', 504, 'Jorge Luis Borges', 'Cuento; Fantástico', CAST('2026-03-20' AS DATE), 7, 5.00, 35.00),
  (107, 9001, 3, 'Sofía Núñez', '2200-3333', '9900-3333', '3300-3333', 1, 'Tegucigalpa', 'Francisco Morazán', '978-84-376-0494-7', 'Cien años de soledad', 501, 'García Márquez', 'Novela; Realismo mágico', CAST('2026-03-20' AS DATE), 0, 5.00, 0.00),
  (108, 9007, 2, 'Luis OBrien', '2200-2222', NULL, NULL, 2, 'San Pedro Sula', 'Cortés', '978-950-07-1234-8', 'Ficciones', 504, 'Jorge Luis Borges', 'Cuento; Fantástico', CAST('2026-03-24' AS DATE), 1, 7.50, 7.50),
  (108, 9006, 2, 'Luis OBrien', '2200-2222', NULL, NULL, 2, 'San Pedro Sula', 'Cortés', '978-84-663-0005-7', 'Crónica de una muerte anunciada', 501, 'García Márquez', 'Novela; Periodismo', CAST('2026-03-24' AS DATE), 0, 7.50, 0.00);

-- -----------------------------------------------------------------------------
-- 3. ejemplar -- FK declarada de UNA columna terminada en `_id`, más una columna
--    que comparte su prefijo. Es la forma exacta que la heurística por nombre
--    necesita: sin la restricción declarada no hay dónde anclar el prefijo.
-- -----------------------------------------------------------------------------
CREATE TABLE ejemplar (
  ejemplar_id     INT PRIMARY KEY,
  isbn            VARCHAR(20) NOT NULL,
  sucursal_id     INT NOT NULL,
  sucursal_nombre VARCHAR(60) NOT NULL,
  estado          VARCHAR(20) NOT NULL,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(sucursal_id)
);

INSERT INTO ejemplar VALUES
  (9001, '978-84-376-0494-7', 1, 'Central', 'disponible'),
  (9002, '978-84-204-8305-1', 1, 'Central', 'prestado'),
  (9003, '978-0-14-118776-1', 2, 'Norte', 'disponible'),
  (9004, '978-0-452-28423-4', 3, 'Valle de Ángeles', 'prestado'),
  (9005, '978-607-31-1234-5', 1, 'Central', 'disponible'),
  (9006, '978-84-663-0005-7', 2, 'Norte', 'disponible'),
  (9007, '978-950-07-1234-8', 1, 'Central', 'en reparación');

-- -----------------------------------------------------------------------------
-- 4. bitacora_acceso -- SIN clave primaria declarada y con filas repetidas, así
--    que tampoco hay unicidad observable de donde inferir una. Sin clave no hay
--    2FN ni 3FN posibles: decir eso es la respuesta correcta, e inventar una
--    clave para poder seguir es la respuesta incorrecta.
-- -----------------------------------------------------------------------------
CREATE TABLE bitacora_acceso (
  socio_id    INT NOT NULL,
  sucursal_id INT NOT NULL,
  momento     TIMESTAMP NOT NULL,
  accion      VARCHAR(30) NOT NULL
);

INSERT INTO bitacora_acceso VALUES
  (1, 1, CAST('2026-03-04 09:12:00' AS TIMESTAMP), 'ingreso'),
  (1, 1, CAST('2026-03-04 09:12:00' AS TIMESTAMP), 'ingreso'),
  (2, 2, CAST('2026-03-06 14:03:00' AS TIMESTAMP), 'ingreso'),
  (3, 1, CAST('2026-03-09 10:45:00' AS TIMESTAMP), 'consulta'),
  (3, 1, CAST('2026-03-09 10:45:00' AS TIMESTAMP), 'consulta');

-- -----------------------------------------------------------------------------
-- 5. socio_documento -- clave candidata ALTERNATIVA. La primaria es socio_id,
--    pero `documento` identifica igual de bien y el esquema lo declara. Una
--    clave candidata es una superclave: no es una dependencia que descomponer.
-- -----------------------------------------------------------------------------
CREATE TABLE socio_documento (
  socio_id   INT PRIMARY KEY,
  documento  VARCHAR(20) NOT NULL,
  emitido_en VARCHAR(40) NOT NULL
);

INSERT INTO socio_documento VALUES
  (1, '0801-1990-01234', 'Tegucigalpa'),
  (2, '0501-1988-05678', 'San Pedro Sula'),
  (3, '0801-1995-09876', 'Tegucigalpa'),
  (4, '0801-1992-04321', 'Valle de Ángeles'),
  (5, '0501-1985-06789', 'San Pedro Sula');

-- La unicidad llega DESPUÉS del CREATE TABLE, en dos formas distintas: una por
-- índice y otra por restricción con nombre. Ambas declaran claves candidatas y
-- un lector que solo mire los CREATE TABLE se pierde las dos.
CREATE UNIQUE INDEX ux_socio_documento ON socio_documento (documento);
ALTER TABLE ejemplar ADD CONSTRAINT uq_ejemplar_isbn_sucursal UNIQUE (isbn, sucursal_id);
