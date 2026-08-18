/**
 * El esquema de `seed_aerolinea_multitabla.sql` tal como lo devuelve el lector.
 *
 * GENERADO, no escrito a mano: es la salida REAL de `build_ir` sobre la semilla.
 * Un fixture escrito a mano no puede delatar un defecto de extraccion, y este
 * proyecto ya pago ese costo una vez con las fechas que llegaban como
 * `CAST('2024-03-04' AS DATE)`. Para regenerarlo, volver a volcar `build_ir`
 * sobre el archivo de la semilla.
 */

import type { ParsedDatabase } from "@/domain"

export const aerolineaSchemaFixture: ParsedDatabase = {
  encoding: "utf-8",
  dialect: "postgres",
  tables: [
    {
      name: "aeropuerto",
      columns: [
        { name: "codigo", sqlType: "character", nullable: false },
        { name: "nombre", sqlType: "character varying", nullable: false },
        { name: "ciudad", sqlType: "character varying", nullable: false },
        { name: "pais", sqlType: "character varying", nullable: false },
      ],
      primaryKey: ["codigo"],
      foreignKeys: [],
      rows: [
        {"codigo": "TGU", "nombre": "Toncontin", "ciudad": "Tegucigalpa", "pais": "Honduras"},
        {"codigo": "SAP", "nombre": "Ramon Villeda", "ciudad": "San Pedro Sula", "pais": "Honduras"},
        {"codigo": "RTB", "nombre": "Juan Manuel Galvez", "ciudad": "Roatan", "pais": "Honduras"},
        {"codigo": "GUA", "nombre": "La Aurora", "ciudad": "Guatemala", "pais": "Guatemala"},
        {"codigo": "SAL", "nombre": "El Salvador", "ciudad": "San Salvador", "pais": "El Salvador"},
        {"codigo": "SJO", "nombre": "Juan Santamaria", "ciudad": "San Jose", "pais": "Costa Rica"},
        {"codigo": "PTY", "nombre": "Tocumen", "ciudad": "Panama", "pais": "Panama"},
      ],
    },
    {
      name: "empleado",
      columns: [
        { name: "empleado_id", sqlType: "integer", nullable: false },
        { name: "nombre", sqlType: "character varying", nullable: false },
        { name: "puesto", sqlType: "character varying", nullable: false },
        { name: "jefe_id", sqlType: "integer", nullable: true },
      ],
      primaryKey: ["empleado_id"],
      foreignKeys: [
        { columns: ["jefe_id"], referencesTable: "empleado", referencesColumns: ["empleado_id"] },
      ],
      rows: [
        {"empleado_id": 1, "nombre": "Ana Discua", "puesto": "Directora", "jefe_id": null},
        {"empleado_id": 2, "nombre": "Luis Mejia", "puesto": "Comandante", "jefe_id": 1},
        {"empleado_id": 3, "nombre": "Rosa Andino", "puesto": "Comandante", "jefe_id": 1},
        {"empleado_id": 4, "nombre": "Carlos Padilla", "puesto": "Comandante", "jefe_id": 2},
        {"empleado_id": 5, "nombre": "Marta Zelaya", "puesto": "Sobrecargo", "jefe_id": 2},
        {"empleado_id": 6, "nombre": "Jorge Fuentes", "puesto": "Sobrecargo", "jefe_id": 3},
      ],
    },
    {
      name: "avion",
      columns: [
        { name: "matricula", sqlType: "character varying", nullable: false },
        { name: "modelo", sqlType: "character varying", nullable: false },
        { name: "fabricante", sqlType: "character varying", nullable: false },
        { name: "capacidad", sqlType: "integer", nullable: false },
      ],
      primaryKey: ["matricula"],
      foreignKeys: [],
      rows: [
        {"matricula": "HR-AXA", "modelo": "A320", "fabricante": "Airbus", "capacidad": 180},
        {"matricula": "HR-AXB", "modelo": "A320", "fabricante": "Airbus", "capacidad": 180},
        {"matricula": "HR-AXC", "modelo": "A320", "fabricante": "Airbus", "capacidad": 180},
        {"matricula": "HR-BXA", "modelo": "B737", "fabricante": "Boeing", "capacidad": 189},
        {"matricula": "HR-BXB", "modelo": "B737", "fabricante": "Boeing", "capacidad": 189},
        {"matricula": "HR-BXC", "modelo": "B737", "fabricante": "Boeing", "capacidad": 189},
        {"matricula": "HR-EXA", "modelo": "E190", "fabricante": "Embraer", "capacidad": 100},
        {"matricula": "HR-EXB", "modelo": "E190", "fabricante": "Embraer", "capacidad": 100},
      ],
    },
    {
      name: "vuelo",
      columns: [
        { name: "vuelo_id", sqlType: "integer", nullable: false },
        { name: "origen_codigo", sqlType: "character", nullable: false },
        { name: "destino_codigo", sqlType: "character", nullable: false },
        { name: "matricula", sqlType: "character varying", nullable: false },
        { name: "comandante_id", sqlType: "integer", nullable: false },
        { name: "fecha_salida", sqlType: "date", nullable: false },
      ],
      primaryKey: ["vuelo_id"],
      foreignKeys: [
        { columns: ["origen_codigo"], referencesTable: "aeropuerto", referencesColumns: ["codigo"] },
        { columns: ["destino_codigo"], referencesTable: "aeropuerto", referencesColumns: ["codigo"] },
        { columns: ["matricula"], referencesTable: "avion", referencesColumns: ["matricula"] },
        { columns: ["comandante_id"], referencesTable: "empleado", referencesColumns: ["empleado_id"] },
      ],
      rows: [
        {"vuelo_id": 901, "origen_codigo": "TGU", "destino_codigo": "SAP", "matricula": "HR-AXA", "comandante_id": 2, "fecha_salida": "2026-03-02"},
        {"vuelo_id": 902, "origen_codigo": "SAP", "destino_codigo": "RTB", "matricula": "HR-AXB", "comandante_id": 3, "fecha_salida": "2026-03-02"},
        {"vuelo_id": 903, "origen_codigo": "TGU", "destino_codigo": "GUA", "matricula": "HR-BXA", "comandante_id": 4, "fecha_salida": "2026-03-03"},
        {"vuelo_id": 904, "origen_codigo": "GUA", "destino_codigo": "SAL", "matricula": "HR-BXB", "comandante_id": 2, "fecha_salida": "2026-03-03"},
        {"vuelo_id": 905, "origen_codigo": "SAL", "destino_codigo": "SJO", "matricula": "HR-EXA", "comandante_id": 3, "fecha_salida": "2026-03-04"},
        {"vuelo_id": 906, "origen_codigo": "SJO", "destino_codigo": "PTY", "matricula": "HR-EXB", "comandante_id": 4, "fecha_salida": "2026-03-04"},
      ],
    },
    {
      name: "tramo",
      columns: [
        { name: "vuelo_id", sqlType: "integer", nullable: false },
        { name: "numero_tramo", sqlType: "integer", nullable: false },
        { name: "duracion_min", sqlType: "integer", nullable: false },
      ],
      primaryKey: ["vuelo_id", "numero_tramo"],
      foreignKeys: [
        { columns: ["vuelo_id"], referencesTable: "vuelo", referencesColumns: ["vuelo_id"] },
      ],
      rows: [
        {"vuelo_id": 901, "numero_tramo": 1, "duracion_min": 45},
        {"vuelo_id": 902, "numero_tramo": 1, "duracion_min": 40},
        {"vuelo_id": 903, "numero_tramo": 1, "duracion_min": 75},
        {"vuelo_id": 904, "numero_tramo": 1, "duracion_min": 50},
        {"vuelo_id": 905, "numero_tramo": 1, "duracion_min": 90},
        {"vuelo_id": 906, "numero_tramo": 1, "duracion_min": 65},
        {"vuelo_id": 906, "numero_tramo": 2, "duracion_min": 55},
      ],
    },
    {
      name: "reserva",
      columns: [
        { name: "reserva_id", sqlType: "integer", nullable: false },
        { name: "vuelo_id", sqlType: "integer", nullable: false },
        { name: "numero_tramo", sqlType: "integer", nullable: false },
        { name: "pasajero_id", sqlType: "integer", nullable: false },
        { name: "asiento", sqlType: "character", nullable: false },
      ],
      primaryKey: ["reserva_id"],
      foreignKeys: [
        { columns: ["pasajero_id"], referencesTable: "empleado", referencesColumns: ["empleado_id"] },
        { columns: ["vuelo_id", "numero_tramo"], referencesTable: "tramo", referencesColumns: ["vuelo_id", "numero_tramo"] },
      ],
      rows: [
        {"reserva_id": 5001, "vuelo_id": 901, "numero_tramo": 1, "pasajero_id": 5, "asiento": "12A"},
        {"reserva_id": 5002, "vuelo_id": 901, "numero_tramo": 1, "pasajero_id": 6, "asiento": "12B"},
        {"reserva_id": 5003, "vuelo_id": 903, "numero_tramo": 1, "pasajero_id": 5, "asiento": "03C"},
        {"reserva_id": 5004, "vuelo_id": 905, "numero_tramo": 1, "pasajero_id": 6, "asiento": "21F"},
        {"reserva_id": 5005, "vuelo_id": 906, "numero_tramo": 2, "pasajero_id": 5, "asiento": "07D"},
      ],
    },
    {
      name: "tarifa_historica",
      columns: [
        { name: "tarifa_id", sqlType: "integer", nullable: false },
        { name: "temporada", sqlType: "character varying", nullable: false },
        { name: "recargo_pct", sqlType: "integer", nullable: false },
      ],
      primaryKey: ["tarifa_id"],
      foreignKeys: [],
      rows: [
        {"tarifa_id": 1, "temporada": "Semana Santa", "recargo_pct": 35},
        {"tarifa_id": 2, "temporada": "Agosto", "recargo_pct": 20},
        {"tarifa_id": 3, "temporada": "Navidad", "recargo_pct": 40},
      ],
    },
  ],
  diagnostics: {
    unparsedStatements: 0,
    samples: [],
    orphanInserts: [],
    dialectScores: {"tsql": 0, "mysql": 0, "oracle": 0, "postgres": 0},
  },
}
