# Normalizador SQL

Una herramienta web que recibe **una tabla plana sin normalizar** en un archivo `.sql`,
descubre las dependencias funcionales que esconden sus datos y propone la descomposición a
**tercera forma normal**, con las tablas resultantes, sus claves y el DDL listo para ejecutar.

No es un CRUD sobre una base ya diseñada a mano. Es la herramienta que hace el trabajo de
normalización, sobre cualquier conjunto de datos que llegue como una sola tabla plana.

---

> **¿Venís a estudiar el proyecto o a exponerlo?** [`EXPOSICION.md`](EXPOSICION.md) reúne la
> teoría relacional que lo sostiene, la arquitectura, las decisiones que hay que saber
> justificar, un guión de diapositivas y las preguntas más probables con su respuesta.

## El problema, en concreto

Esta es la tabla que entra. Una fila por producto de cada venta, con todo mezclado:

| venta_id | fecha_venta | cliente_id | cliente_nombre | cliente_ciudad_pais | producto_id | producto_nombre | categoria_nombre | cantidad |
|---|---|---|---|---|---|---|---|---|
| 1 | 2024-03-04 | 1 | Ana Martinez | Honduras | 101 | Cafe molido 500g | Bebidas | 2 |
| 1 | 2024-03-04 | 1 | Ana Martinez | Honduras | 102 | Te verde 20 sobres | Bebidas | 1 |
| 1 | 2024-03-04 | 1 | Ana Martinez | Honduras | 104 | Pan integral | Panaderia | 3 |

Tres productos de **una sola venta**, y ya se repiten el nombre del cliente, su país y la
fecha. En las 56 filas del conjunto, `Ana Martinez` aparece 14 veces. Si cambia de ciudad hay
que actualizar las 14, y basta que una se escape para que la base se contradiga a sí misma.

Esta es la salida: **seis tablas**, cada una con un solo tema.

```
ciudades(ciudad_id, ciudad_nombre, ciudad_pais)
categorias(categoria_id, categoria_nombre)
clientes(cliente_id, cliente_nombre, cliente_email, cliente_ciudad_id ──> ciudades)
productos(producto_id, producto_nombre, producto_precio, categoria_id ──> categorias)
ventas(venta_id, fecha_venta, cliente_id ──> clientes)
ventas_detalle(venta_id ──> ventas, producto_id ──> productos, cantidad, subtotal)
```

`Ana Martinez` ahora existe **una sola vez**.

---

## Cómo lo hace

```
1. Subes un .sql con una tabla plana
        ↓
2. El script se ejecuta contra un esquema `staging` en PostgreSQL
        ↓
3. Se lee la estructura por `information_schema` y los datos por SELECT
        ↓
4. El motor de detección busca dependencias funcionales en los datos
        ↓
5. TÚ confirmas cuáles son reales  ←── el paso que importa
        ↓
6. El motor de normalización descompone a 3FN y genera el DDL
```

### Las dos decisiones que sostienen todo lo demás

**PostgreSQL es el parser.** El `.sql` no se analiza con código propio: se ejecuta contra un
esquema temporal y después se lee su estructura del catálogo. Escribir un analizador de SQL a
mano significa aceptar para siempre el SQL que ese analizador entiende. Postgres, en cambio,
*es* la definición de SQL válido.

**La detección propone; la persona decide.** El motor observa los datos, no conoce las reglas
del negocio. Sobre el conjunto de referencia encuentra **70 dependencias**, de las cuales
**13 son correctas**. Las otras 57 también son verdaderas en esos datos, y confirmarlas
produce un esquema equivocado.

Por eso cada dependencia se muestra con la evidencia que la respalda —cuántos grupos, cuántas
filas, qué tan grande es el grupo mayor— y **ninguna viene marcada de antemano**. Una casilla
premarcada en la dependencia equivocada es exactamente el error que esta herramienta existe
para evitar.

---

## Inicio rápido

**Requisitos:** Node.js ≥ 20.9 y una base PostgreSQL accesible (local, Docker o gestionada).

```bash
npm install

# Configura la conexión. Este archivo está en .gitignore: nunca se versiona.
echo "DATABASE_URL=postgresql://usuario:clave@host:5432/basededatos" > .env.local

npm run dev
```

Abre <http://localhost:3000>, sube `src/seeds/seed_ventas_raw.sql` y pulsa **Analizar**.

> **Sobre el rol de la base de datos.** Esta aplicación ejecuta SQL arbitrario subido por el
> usuario: es su diseño, no un descuido. Conéctala con un rol de **privilegio mínimo**,
> limitado al esquema `staging`. Con un superusuario, subir un archivo equivale a control
> total de la base.

---

## Cómo comprobar que funciona

El repositorio incluye un conjunto de datos de referencia que **no es un ejemplo: es el
solucionario**. Se diseñó al revés, partiendo de las dependencias que debe contener.

| Archivo | Qué es |
|---|---|
| `src/seeds/seed_ventas_raw.sql` | 56 filas, 15 columnas, clave primaria compuesta. |
| `src/seeds/GROUND_TRUTH.md` | Las 13 dependencias correctas, las 27 de ruido esperado y la descomposición esperada en 6 tablas. |
| `src/seeds/ventasRawFixture.ts` | Los mismos datos en memoria, para las pruebas. |

Si la detección contradice ese documento, el detector está equivocado mientras no se
demuestre lo contrario.

```bash
npm test     # 116 pruebas
```

Tres de ellas son de integración y valen más que el resto: dos comprueban que motores
construidos por separado —que nunca importaron el código del otro— realmente componen, y una
recorre el camino exacto que sigue la pantalla, de la detección al DDL.

---

## Arquitectura

Dependencias en un solo sentido: `ui → aplicación → dominio`. El dominio no importa nada.

```
src/
├── domain/          Contrato compartido. Sin React, sin Next, sin pg.
├── features/
│   ├── staging/     Adaptador PostgreSQL detrás de un puerto. `pg` no sale de aquí.
│   ├── fd-detection/    Detección de dependencias funcionales.
│   ├── normalization/   Descomposición a 3FN y generación de DDL.
│   └── sql-upload/      La pantalla: subida, revisión y esquema resultante.
├── seeds/           Conjunto de datos de referencia y su solucionario.
└── app/             Rutas de Next.js y la API.
```

Cada `feature` expone su API pública por un único `index.ts`; nadie importa los internos de
otra.

### El problema combinatorio

El espacio de determinantes candidatos es el **conjunto potencia** de las columnas: `2^N`.
Con 20 columnas son más de un millón de candidatos, cada uno con un recorrido completo de las
filas. No termina nunca.

Dos límites lo hacen viable, y ambos **se reportan** en el resultado en lugar de aplicarse en
silencio: un tope al ancho del determinante, y la poda de los no mínimos —si `A → Y` ya se
cumple, `{A,X} → Y` no aporta información. Sobre el conjunto de referencia eso deja 1.134
candidatos evaluados y 244.170 descartados por el tope.

Un resultado que ocultara cuánto del espacio quedó sin explorar se leería como «estas son
todas las dependencias» cuando no lo son.

---

## Alcance

| Decisión | Motivo |
|---|---|
| Entrada `.sql`, no Excel | Estructura predecible, ya tipada, ejecutable directamente. |
| Una tabla plana por vez | Suficiente para demostrar 1FN → 3FN sin la complejidad de multi-tabla. |
| Hasta 3FN | FNBC, 4FN y 5FN quedan fuera de forma deliberada. |
| Un solo proyecto Next.js | Las rutas API son el backend: sin CORS ni despliegues separados. |

**Todavía no está construido:** la ejecución del DDL y la migración de datos contra el esquema
final, el explorador de datos normalizados y el diagrama ER. La herramienta genera el DDL,
pero aún no lo aplica.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3000. |
| `npm test` | Suite completa. `npm run test:watch` para el modo interactivo. |
| `npx tsc --noEmit` | Verificación de tipos. No hay script propio. |
| `npm run lint` | ESLint. |
| `npm run build` | Compilación de producción. |

---

## Trampas conocidas

Cosas que parecen un error y no lo son. Cada una costó tiempo de depuración.

**`@custom-variant dark` en `globals.css` no enciende el modo oscuro: lo apaga.** La
aplicación es solo modo claro. El variante `dark:` de Tailwind v4 resuelve por defecto a
`prefers-color-scheme`, y los componentes de shadcn traen clases `dark:` incorporadas.
Reasignar el variante a una clase `.dark` que nunca se aplica las deja permanentemente
inertes. Borrar esa línea reactiva el modo oscuro a medias.

**`shadcn` va en `dependencies`, no en `devDependencies`.** Parece solo una CLI, pero
`globals.css` importa `shadcn/tailwind.css`: es una dependencia de compilación.

**La CLI de shadcn tiene un error de comillas en Windows.** Su `init` puede crear un
directorio llamado `'src` —con apóstrofo— y escribir un alias roto en `tsconfig.json`. Revisa
ambos después de ejecutarla.

**Una dependencia sobre la clave primaria completa siempre es «vacua».** Una clave primaria es
única por definición, así que cada uno de sus grupos tiene una sola fila. Son precisamente las
dependencias que hay que **conservar**: definen la tabla de hechos. La vacuidad indica ruido
solo cuando el determinante *no* es la clave.

**`normalizeTo3NF` puede lanzar excepciones** ante violaciones de invariantes. Se ejecuta
durante el render, así que siempre debe invocarse dentro de `computeNormalizationOutcome`, que
la captura y la convierte en estado.
