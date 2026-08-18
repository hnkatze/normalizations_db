-- Semilla multitabla: un esquema con relaciones de verdad.
--
-- Las otras dos semillas declaran UNA tabla y CERO claves foráneas, así que
-- nada del nivel de esquema se podía probar con ellas. Esta existe para eso:
-- cada tabla cubre a propósito una forma sintáctica o un caso del grafo que
-- el resto del banco de pruebas no tocaba.
--
--   aeropuerto        Destino de DOS claves foráneas de la misma tabla
--                     (vuelo.origen_codigo y vuelo.destino_codigo). Un grafo
--                     que colapse las aristas por par de tablas pierde una.
--
--   empleado          AUTORREFERENCIA (jefe_id -> empleado) escrita como
--                     REFERENCES sin lista de columnas: el destino es la
--                     clave primaria de la tabla, no una columna nombrada.
--
--   avion             La tabla que NO está en 3FN. modelo determina
--                     fabricante y capacidad, y modelo no es clave: es una
--                     transitiva sobre matricula. Le da algo que decir al
--                     veredicto por tabla.
--
--   vuelo             Cuatro claves foráneas inline, dos de ellas al mismo
--                     destino. Es el nodo de mayor grado del grafo.
--
--   tramo             Clave primaria COMPUESTA, para que reserva pueda
--                     colgarle una clave foránea compuesta.
--
--   reserva           Clave foránea COMPUESTA declarada a nivel de tabla con
--                     CONSTRAINT nombrada, más una inline. Dos formas
--                     sintácticas conviviendo en un mismo CREATE TABLE.
--
--   tarifa_historica  TABLA AISLADA: no referencia a nadie y nadie la
--                     referencia. Una pantalla de esquema tiene que poder
--                     mostrarla aparte en vez de esconderla.
--
-- La clave foránea de tramo llega por ALTER TABLE al final, que es como los
-- volcados declaran las restricciones: primero todas las tablas, después las
-- referencias, para que el orden de creación no importe.

CREATE TABLE aeropuerto (
  codigo   char(3)      NOT NULL PRIMARY KEY,
  nombre   varchar(60)  NOT NULL,
  ciudad   varchar(40)  NOT NULL,
  pais     varchar(40)  NOT NULL
);

CREATE TABLE empleado (
  empleado_id  integer      NOT NULL PRIMARY KEY,
  nombre       varchar(60)  NOT NULL,
  puesto       varchar(30)  NOT NULL,
  jefe_id      integer      REFERENCES empleado
);

CREATE TABLE avion (
  matricula   varchar(10)  NOT NULL PRIMARY KEY,
  modelo      varchar(30)  NOT NULL,
  fabricante  varchar(30)  NOT NULL,
  capacidad   integer      NOT NULL
);

CREATE TABLE vuelo (
  vuelo_id         integer      NOT NULL PRIMARY KEY,
  origen_codigo    char(3)      NOT NULL REFERENCES aeropuerto(codigo),
  destino_codigo   char(3)      NOT NULL REFERENCES aeropuerto(codigo),
  matricula        varchar(10)  NOT NULL REFERENCES avion(matricula),
  comandante_id    integer      NOT NULL REFERENCES empleado(empleado_id),
  fecha_salida     date         NOT NULL
);

CREATE TABLE tramo (
  vuelo_id       integer      NOT NULL,
  numero_tramo   integer      NOT NULL,
  duracion_min   integer      NOT NULL,
  CONSTRAINT pk_tramo PRIMARY KEY (vuelo_id, numero_tramo)
);

CREATE TABLE reserva (
  reserva_id      integer      NOT NULL PRIMARY KEY,
  vuelo_id        integer      NOT NULL,
  numero_tramo    integer      NOT NULL,
  pasajero_id     integer      NOT NULL REFERENCES empleado(empleado_id),
  asiento         char(4)      NOT NULL,
  CONSTRAINT fk_reserva_tramo FOREIGN KEY (vuelo_id, numero_tramo)
    REFERENCES tramo (vuelo_id, numero_tramo)
);

CREATE TABLE tarifa_historica (
  tarifa_id    integer      NOT NULL PRIMARY KEY,
  temporada    varchar(20)  NOT NULL,
  recargo_pct  integer      NOT NULL
);

INSERT INTO aeropuerto (codigo, nombre, ciudad, pais) VALUES
  ('TGU', 'Toncontin',           'Tegucigalpa', 'Honduras'),
  ('SAP', 'Ramon Villeda',       'San Pedro Sula', 'Honduras'),
  ('RTB', 'Juan Manuel Galvez',  'Roatan', 'Honduras'),
  ('GUA', 'La Aurora',           'Guatemala', 'Guatemala'),
  ('SAL', 'El Salvador',         'San Salvador', 'El Salvador'),
  ('SJO', 'Juan Santamaria',     'San Jose', 'Costa Rica'),
  ('PTY', 'Tocumen',             'Panama', 'Panama');

INSERT INTO empleado (empleado_id, nombre, puesto, jefe_id) VALUES
  (1, 'Ana Discua',      'Directora',  NULL),
  (2, 'Luis Mejia',      'Comandante', 1),
  (3, 'Rosa Andino',     'Comandante', 1),
  (4, 'Carlos Padilla',  'Comandante', 2),
  (5, 'Marta Zelaya',    'Sobrecargo', 2),
  (6, 'Jorge Fuentes',   'Sobrecargo', 3);

-- modelo determina fabricante y capacidad, y modelo no es la clave:
-- tres modelos sobre ocho filas dejan cinco oportunidades de refutacion,
-- arriba del umbral de tres que exige el detector.
INSERT INTO avion (matricula, modelo, fabricante, capacidad) VALUES
  ('HR-AXA', 'A320',  'Airbus',  180),
  ('HR-AXB', 'A320',  'Airbus',  180),
  ('HR-AXC', 'A320',  'Airbus',  180),
  ('HR-BXA', 'B737',  'Boeing',  189),
  ('HR-BXB', 'B737',  'Boeing',  189),
  ('HR-BXC', 'B737',  'Boeing',  189),
  ('HR-EXA', 'E190',  'Embraer', 100),
  ('HR-EXB', 'E190',  'Embraer', 100);

INSERT INTO vuelo (vuelo_id, origen_codigo, destino_codigo, matricula, comandante_id, fecha_salida) VALUES
  (901, 'TGU', 'SAP', 'HR-AXA', 2, '2026-03-02'),
  (902, 'SAP', 'RTB', 'HR-AXB', 3, '2026-03-02'),
  (903, 'TGU', 'GUA', 'HR-BXA', 4, '2026-03-03'),
  (904, 'GUA', 'SAL', 'HR-BXB', 2, '2026-03-03'),
  (905, 'SAL', 'SJO', 'HR-EXA', 3, '2026-03-04'),
  (906, 'SJO', 'PTY', 'HR-EXB', 4, '2026-03-04');

INSERT INTO tramo (vuelo_id, numero_tramo, duracion_min) VALUES
  (901, 1, 45),
  (902, 1, 40),
  (903, 1, 75),
  (904, 1, 50),
  (905, 1, 90),
  (906, 1, 65),
  (906, 2, 55);

INSERT INTO reserva (reserva_id, vuelo_id, numero_tramo, pasajero_id, asiento) VALUES
  (5001, 901, 1, 5, '12A'),
  (5002, 901, 1, 6, '12B'),
  (5003, 903, 1, 5, '03C'),
  (5004, 905, 1, 6, '21F'),
  (5005, 906, 2, 5, '07D');

INSERT INTO tarifa_historica (tarifa_id, temporada, recargo_pct) VALUES
  (1, 'Semana Santa', 35),
  (2, 'Agosto',       20),
  (3, 'Navidad',      40);

ALTER TABLE tramo
  ADD CONSTRAINT fk_tramo_vuelo FOREIGN KEY (vuelo_id) REFERENCES vuelo (vuelo_id);
