-- Semilla de ejemplo: sin normalizar.
--
-- Está diseñada para que CADA ETAPA MUEVA ALGO, que es lo que no se ve
-- cuando la clave primaria es de una sola columna o cuando se confirman
-- pocas reglas:
--
--   Clave primaria         (estudiante_id, curso_id) — compuesta a propósito.
--                          Es lo único que no se repite en toda la tabla.
--
--   Se queda en la tabla   nota, fecha_inscripcion. Dependen de la
--   de hechos              inscripción COMPLETA: ni el estudiante ni el
--                          curso por separado las determinan.
--
--   Sale en 2FN            estudiante_nombre y carrera_id dependen solo de
--   (parciales)            estudiante_id; curso_nombre, creditos y
--                          docente_id dependen solo de curso_id. Media
--                          clave, no la clave entera.
--
--   Sale en 3FN            carrera_nombre cuelga de carrera_id;
--   (transitivas)          docente_nombre y departamento_id cuelgan de
--                          docente_id; departamento_nombre cuelga de
--                          departamento_id. Ninguna de esas columnas es
--                          clave, y la última es una CADENA DE DOS NIVELES
--                          (curso -> docente -> departamento) que obliga al
--                          motor a repetir la pasada hasta que nada se mueve.
--
-- Resultado esperado en 3FN: seis tablas.
--   inscripciones_raw(estudiante_id, curso_id, nota, fecha_inscripcion)
--   estudiante_id(estudiante_id, estudiante_nombre, carrera_id)
--   curso_id(curso_id, curso_nombre, creditos, docente_id)
--   carrera_id(carrera_id, carrera_nombre)
--   docente_id(docente_id, docente_nombre, departamento_id)
--   departamento_id(departamento_id, departamento_nombre)
--
-- RUIDO ESPERADO: cada columna `_nombre` es única por entidad, así que el
-- detector también propondrá el camino inverso (estudiante_nombre ->
-- estudiante_id, y así con las otras cuatro). Son claves alternas reales, no
-- errores: describen la misma entidad desde el otro lado. El motor las
-- fusiona al normalizar; en la pantalla de revisión conviene no confirmarlas.
--
-- Sin prefijo de esquema y una sola tabla: el cargador ejecuta este archivo
-- con el search_path apuntando al esquema de staging y descubre la tabla ahí.

CREATE TABLE inscripciones_raw (
  estudiante_id        integer      NOT NULL,
  curso_id             integer      NOT NULL,
  nota                 integer      NOT NULL,
  fecha_inscripcion    date         NOT NULL,
  estudiante_nombre    varchar(60)  NOT NULL,
  carrera_id           integer      NOT NULL,
  carrera_nombre       varchar(60)  NOT NULL,
  curso_nombre         varchar(60)  NOT NULL,
  creditos             integer      NOT NULL,
  docente_id           integer      NOT NULL,
  docente_nombre       varchar(60)  NOT NULL,
  departamento_id      integer      NOT NULL,
  departamento_nombre  varchar(60)  NOT NULL
);

INSERT INTO inscripciones_raw (
  estudiante_id, curso_id, nota, fecha_inscripcion,
  estudiante_nombre, carrera_id, carrera_nombre,
  curso_nombre, creditos, docente_id, docente_nombre,
  departamento_id, departamento_nombre
) VALUES
  (1, 501, 90, '2026-01-15', 'Ana Rodriguez',   1, 'Ingenieria de Sistemas', 'Bases de Datos', 4, 100, 'Marta Villalobos', 10, 'Ciencias de la Computacion'),
  (1, 502, 80, '2026-01-16', 'Ana Rodriguez',   1, 'Ingenieria de Sistemas', 'Algoritmos',     5, 101, 'Carlos Zelaya',    10, 'Ciencias de la Computacion'),
  (1, 503, 95, '2026-01-17', 'Ana Rodriguez',   1, 'Ingenieria de Sistemas', 'Calculo I',      4, 102, 'Elena Ordonez',    20, 'Ciencias Basicas'),
  (2, 501, 70, '2026-01-18', 'Luis Fernandez',  1, 'Ingenieria de Sistemas', 'Bases de Datos', 4, 100, 'Marta Villalobos', 10, 'Ciencias de la Computacion'),
  (2, 502, 85, '2026-01-15', 'Luis Fernandez',  1, 'Ingenieria de Sistemas', 'Algoritmos',     5, 101, 'Carlos Zelaya',    10, 'Ciencias de la Computacion'),
  (2, 504, 80, '2026-01-16', 'Luis Fernandez',  1, 'Ingenieria de Sistemas', 'Estadistica',    3, 102, 'Elena Ordonez',    20, 'Ciencias Basicas'),
  (3, 501, 95, '2026-01-17', 'Sofia Martinez',  2, 'Administracion',         'Bases de Datos', 4, 100, 'Marta Villalobos', 10, 'Ciencias de la Computacion'),
  (3, 503, 85, '2026-01-18', 'Sofia Martinez',  2, 'Administracion',         'Calculo I',      4, 102, 'Elena Ordonez',    20, 'Ciencias Basicas'),
  (3, 504, 90, '2026-01-15', 'Sofia Martinez',  2, 'Administracion',         'Estadistica',    3, 102, 'Elena Ordonez',    20, 'Ciencias Basicas'),
  (4, 502, 85, '2026-01-16', 'Diego Herrera',   1, 'Ingenieria de Sistemas', 'Algoritmos',     5, 101, 'Carlos Zelaya',    10, 'Ciencias de la Computacion'),
  (4, 503, 70, '2026-01-17', 'Diego Herrera',   1, 'Ingenieria de Sistemas', 'Calculo I',      4, 102, 'Elena Ordonez',    20, 'Ciencias Basicas'),
  (4, 504, 80, '2026-01-18', 'Diego Herrera',   1, 'Ingenieria de Sistemas', 'Estadistica',    3, 102, 'Elena Ordonez',    20, 'Ciencias Basicas'),
  (5, 501, 90, '2026-01-15', 'Paola Cruz',      2, 'Administracion',         'Bases de Datos', 4, 100, 'Marta Villalobos', 10, 'Ciencias de la Computacion'),
  (5, 502, 95, '2026-01-16', 'Paola Cruz',      2, 'Administracion',         'Algoritmos',     5, 101, 'Carlos Zelaya',    10, 'Ciencias de la Computacion'),
  (5, 503, 70, '2026-01-17', 'Paola Cruz',      2, 'Administracion',         'Calculo I',      4, 102, 'Elena Ordonez',    20, 'Ciencias Basicas'),
  (5, 504, 90, '2026-01-18', 'Paola Cruz',      2, 'Administracion',         'Estadistica',    3, 102, 'Elena Ordonez',    20, 'Ciencias Basicas');
