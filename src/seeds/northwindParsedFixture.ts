import type { ParsedDatabase } from "@/domain"

/**
 * Un archivo real ya leido, para desarrollar la interfaz sin backend.
 *
 * Sale de `test.sql` — una exportacion de Northwind hecha por SQL Server
 * Management Studio, en UTF-16 LE — pasada por `api/_sqlparse`. Las filas van
 * recortadas a 6 por tabla porque esto existe para VER la pantalla, no para
 * analizar nada.
 *
 * Importa que sea real y no inventado: trae exactamente las rarezas que hay que
 * mostrar bien. Una tabla sin ninguna clave foranea, tipos que ya vienen
 * traducidos al vocabulario de `information_schema`, columnas anulables
 * mezcladas con obligatorias, y una columna binaria cuyo valor es un resumen y
 * no el blob.
 */
export const northwindParsedFixture = {
    "encoding": "utf-16-le",
    "dialect": "tsql",
    "tables": [
      {
        "name": "Categories",
        "columns": [
          {
            "name": "CategoryID",
            "sqlType": "integer",
            "nullable": false
          },
          {
            "name": "CategoryName",
            "sqlType": "character varying",
            "nullable": false
          },
          {
            "name": "Description",
            "sqlType": "text",
            "nullable": true
          },
          {
            "name": "Picture",
            "sqlType": "bytea",
            "nullable": true
          }
        ],
        "primaryKey": [
          "CategoryID"
        ],
        "foreignKeys": [],
        "rows": [
          {
            "CategoryID": 1,
            "CategoryName": "Beverages",
            "Description": "Soft drinks, coffees, teas, beers, and ales",
            "Picture": "0x<10746 bytes:37c1cbb14754>"
          },
          {
            "CategoryID": 2,
            "CategoryName": "Condiments",
            "Description": "Sweet and savory sauces, relishes, spreads, and seasonings",
            "Picture": "0x<10746 bytes:3bff9a95fb20>"
          },
          {
            "CategoryID": 3,
            "CategoryName": "Confections",
            "Description": "Desserts, candies, and sweet breads",
            "Picture": "0x<10746 bytes:af84866466fb>"
          },
          {
            "CategoryID": 4,
            "CategoryName": "Dairy Products",
            "Description": "Cheeses",
            "Picture": "0x<10746 bytes:f3d301e454a8>"
          },
          {
            "CategoryID": 5,
            "CategoryName": "Grains/Cereals",
            "Description": "Breads, crackers, pasta, and cereal",
            "Picture": "0x<10746 bytes:3e59064bbb85>"
          },
          {
            "CategoryID": 6,
            "CategoryName": "Meat/Poultry",
            "Description": "Prepared meats",
            "Picture": "0x<10746 bytes:94a7bcf9827c>"
          }
        ]
      },
      {
        "name": "Customers",
        "columns": [
          {
            "name": "CustomerID",
            "sqlType": "character",
            "nullable": false
          },
          {
            "name": "CompanyName",
            "sqlType": "character varying",
            "nullable": false
          },
          {
            "name": "ContactName",
            "sqlType": "character varying",
            "nullable": true
          },
          {
            "name": "ContactTitle",
            "sqlType": "character varying",
            "nullable": true
          },
          {
            "name": "Address",
            "sqlType": "character varying",
            "nullable": true
          },
          {
            "name": "City",
            "sqlType": "character varying",
            "nullable": true
          },
          {
            "name": "Region",
            "sqlType": "character varying",
            "nullable": true
          },
          {
            "name": "PostalCode",
            "sqlType": "character varying",
            "nullable": true
          },
          {
            "name": "Country",
            "sqlType": "character varying",
            "nullable": true
          },
          {
            "name": "Phone",
            "sqlType": "character varying",
            "nullable": true
          },
          {
            "name": "Fax",
            "sqlType": "character varying",
            "nullable": true
          }
        ],
        "primaryKey": [
          "CustomerID"
        ],
        "foreignKeys": [],
        "rows": [
          {
            "CustomerID": "ALFKI",
            "CompanyName": "Alfreds Futterkiste",
            "ContactName": "Maria Anders",
            "ContactTitle": "Sales Representative",
            "Address": "Obere Str. 57",
            "City": "Berlin",
            "Region": null,
            "PostalCode": "12209",
            "Country": "Germany",
            "Phone": "030-0074321",
            "Fax": "030-0076545"
          },
          {
            "CustomerID": "ANATR",
            "CompanyName": "Ana Trujillo Emparedados y helados",
            "ContactName": "Ana Trujillo",
            "ContactTitle": "Owner",
            "Address": "Avda. de la Constitución 2222",
            "City": "México D.F.",
            "Region": null,
            "PostalCode": "05021",
            "Country": "Mexico",
            "Phone": "(5) 555-4729",
            "Fax": "(5) 555-3745"
          },
          {
            "CustomerID": "ANTON",
            "CompanyName": "Antonio Moreno Taquería",
            "ContactName": "Antonio Moreno",
            "ContactTitle": "Owner",
            "Address": "Mataderos  2312",
            "City": "México D.F.",
            "Region": null,
            "PostalCode": "05023",
            "Country": "Mexico",
            "Phone": "(5) 555-3932",
            "Fax": null
          },
          {
            "CustomerID": "AROUT",
            "CompanyName": "Around the Horn",
            "ContactName": "Thomas Hardy",
            "ContactTitle": "Sales Representative",
            "Address": "120 Hanover Sq.",
            "City": "London",
            "Region": null,
            "PostalCode": "WA1 1DP",
            "Country": "UK",
            "Phone": "(171) 555-7788",
            "Fax": "(171) 555-6750"
          },
          {
            "CustomerID": "BERGS",
            "CompanyName": "Berglunds snabbköp",
            "ContactName": "Christina Berglund",
            "ContactTitle": "Order Administrator",
            "Address": "Berguvsvägen  8",
            "City": "Luleå",
            "Region": null,
            "PostalCode": "S-958 22",
            "Country": "Sweden",
            "Phone": "0921-12 34 65",
            "Fax": "0921-12 34 67"
          },
          {
            "CustomerID": "BLAUS",
            "CompanyName": "Blauer See Delikatessen",
            "ContactName": "Hanna Moos",
            "ContactTitle": "Sales Representative",
            "Address": "Forsterstr. 57",
            "City": "Mannheim",
            "Region": null,
            "PostalCode": "68306",
            "Country": "Germany",
            "Phone": "0621-08460",
            "Fax": "0621-08924"
          }
        ]
      }
    ],
    "diagnostics": {
      "unparsedStatements": 0,
      "samples": [],
      "orphanInserts": [],
      "dialectScores": {
        "tsql": 13,
        "mysql": 0,
        "oracle": 0,
        "postgres": 0
      }
    }
  } as const satisfies ParsedDatabase
