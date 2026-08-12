# Handoff — estado del trabajo en curso

Documento para retomar el trabajo en otra máquina o después de una pausa larga.
Refleja el estado al **11 de agosto de 2026**.

Rama de trabajo: `feature/normalization-workspace` (empujada, `84adc25..a204bd2`).

---

## Arrancar el entorno (leer esto primero)

**El proyecto ahora necesita DOS procesos en desarrollo, no uno.**

```bash
pip install -r requirements.txt   # una sola vez: instala sqlglot
npm run dev:parser                # terminal 1 — servicio de lectura en :8787
npm run dev                       # terminal 2 — Next.js en :3000
```

Después: <http://localhost:3000/esquema> y subir un `.sql`.

`next dev` **no ejecuta funciones de Python**. En producción las corre Vercel desde
`api/parse.py`, pero en local no las levanta nadie y `/api/parse` daría 404.
`next.config.ts` reescribe esa ruta hacia `127.0.0.1:8787` **solo en desarrollo**;
desplegado, responde la función real y una reescritura la taparía.

El script de desarrollo sirve el **mismo** handler que se despliega, no una imitación.

Si al subir un archivo aparece *"El servicio de lectura no respondió"*, la terminal 1
no está corriendo. `useParseSql` traduce el 404 a ese mensaje a propósito, para que no
se busque el error en el código de la aplicación, donde no está.

---

## Qué se construyó en esta tanda

El problema: la aplicación **ejecutaba** el `.sql` subido contra un esquema de staging en
PostgreSQL y leía `information_schema`. Eso ataba la entrada al dialecto de Postgres, así
que ningún volcado de SQL Server, MySQL u Oracle podía leerse. Y `discoverCreatedTable`
además rechazaba por diseño los archivos con más de una tabla (`ambiguous-table`).

La solución: **parsear el archivo en vez de ejecutarlo**.

```
bytes → codificación (BOM) → dialecto (puntaje) → quitar ruido → trocear sentencias
      → sqlglot → IR canónico → dominio TypeScript (detección de DF + 3FN, intacto)
```

| Ruta | Qué es |
|---|---|
| `api/parse.py` | Función de Vercel. Cuerpo crudo, tope de 90 MB, errores en JSON. |
| `api/_sqlparse/reader.py` | Codificación por BOM. Nunca lanza. |
| `api/_sqlparse/dialect.py` | Puntaje por marcas propietarias. Cae en `postgres`. |
| `api/_sqlparse/statements.py` | Saneador de ruido de SSMS + troceador que respeta literales. |
| `api/_sqlparse/types.py` | Tipo canónico de sqlglot → `data_type` de `information_schema`. |
| `api/_sqlparse/ir.py` | Constructor del IR. |
| `src/domain/parsedSchema.ts` | `ParsedTable` / `ParsedDatabase` + `toFlatTable`. |
| `src/features/sql-upload/parseContract.ts` | Contrato de `POST /api/parse`. |
| `src/features/sql-upload/parseSchemaResponse.ts` | Validación en tiempo de ejecución (10 pruebas). |
| `src/features/sql-upload/describeParsedTable.ts` | Lógica pura (11 pruebas). |
| `src/features/sql-upload/useParseSql.ts` | La subida. |
| `src/features/sql-upload/SqlFileField.tsx` | El input. |
| `src/features/sql-upload/ParsedSchemaOverview.tsx` | Panel + selector de tabla. |
| `src/features/sql-upload/ParsedTableDetail.tsx` | Columnas y muestra de datos. |

Verificado contra un volcado real de Northwind hecho por SSMS (UTF-16 LE): detecta
`tsql`, encuentra las 2 tablas con sus claves primarias, extrae **99 filas** y no deja
ninguna sentencia sin interpretar. Un volcado sintético de `mysqldump` también se lee.

---

## Lo que está pendiente y bloquea

### 1. Nadie confirmó que Vercel sirva `api/*.py` en un proyecto Next.js (SIN RESOLVER)

Las rutas no chocan (`/api/parse` contra `/api/analyze`, que es de Next), y la
documentación de Vercel describe funciones de Python en `api/`. Pero **no está probado en
este proyecto**, y la documentación consultada no cubre el caso de mezclarlas con Next.js.

**Es la incógnita que bloquea producción.** La forma más barata de despejarla: llevar esta
rama al flujo de `development` (ver abajo) y mirar el *preview deployment*. No hace falta
instalar el CLI de Vercel.

### 2. El paso de carga real todavía no usa `/api/parse`

`UploadHero` + `SqlUploadContainer` siguen yendo a `/api/analyze`, el camino viejo con
PostgreSQL. Lo nuevo vive en `/esquema`, que es **andamiaje**: cuando el paso real consuma
`/api/parse`, hay que borrar `src/app/esquema/page.tsx` y
`src/seeds/northwindParsedFixture.ts`.

Detalle suelto: `UploadHero.tsx` (~línea 362) todavía le dice al usuario que *"los esquemas
con varias tablas todavía no son compatibles"*. Ya es falso.

### 3. `StagingPort` es la abstracción equivocada para un parser

`StagingPort` modela una **base de datos** (`resetSchema` / `runScript` /
`discoverCreatedTable` / `readRows`). Hacer que el servicio de Python lo implemente sería
forzarlo. Corresponde un puerto por encima que devuelva `Result<readonly FlatTable[], …>`
directamente; `pgStagingAdapter` + `loadFlatTable` pasan a ser **una** implementación y el
parser otra.

### 4. Varias tablas de punta a punta

`FlatTable` es una sola relación y toda la interfaz está construida alrededor de eso.

> **No unir las tablas en una relación universal.** Un join fabrica tuplas espurias y
> dependencias funcionales falsas que no existen en el dominio. Lo correcto es N análisis
> independientes —3FN está definida sobre UNA relación— más un grafo de claves foráneas
> para el informe global.

### 5. La vista de carga todavía tiene scroll (SIN RESOLVER, previo)

El requisito es que el paso `upload` entre completo en el viewport. Se intentaron dos
enfoques y ninguno lo cerró.

Primer intento — aritmética a mano en `UploadHero.tsx`:

```
min-h-[calc(100dvh-7.5rem)] sm:min-h-[calc(100dvh-8.5rem)]
```

restando una altura de `AppHeader` *estimada*. Falló en navegador real, y es frágil por
construcción.

Segundo intento — cadena flex, que es el estado actual del código:

| Archivo | Clases |
|---|---|
| `src/app/layout.tsx` — `<body>` | `min-h-dvh flex flex-col` |
| `src/app/page.tsx` — `<main>` | `flex-1 flex flex-col min-h-0` |
| `SqlUploadContainer.tsx` — div raíz y de contenido | `flex flex-1 flex-col min-h-0` |
| `UploadHero.tsx` — wrapper | `flex-1 flex flex-col items-center justify-center` |

El usuario reportó que **aún así sigue habiendo scroll**, y que el sobrante "es justo el
tamaño del header". Último cambio aplicado y no verificado: se quitó `h-full` del `<html>`
en `layout.tsx`.

**El próximo paso es medir, no seguir estimando.** Con la app corriendo, en la consola:

```js
const d = document.documentElement;
console.log('sobrante:', d.scrollHeight - d.clientHeight, 'px');
[...document.querySelectorAll('body *')]
  .map(el => ({ el, b: el.getBoundingClientRect().bottom }))
  .filter(x => x.b > d.clientHeight)
  .slice(0, 6)
  .forEach(x => console.log(Math.round(x.b), x.el.tagName, x.el.className.slice(0, 70)));
```

> Antecedente que conviene no repetir: hubo una versión que bloqueaba el alto con
> `h-full` + `overflow-hidden` y daba scroll propio a cada panel. Se revirtió porque
> escondía contenido sin mostrar barra que delatara que había más. **No volver a eso.**

### 6. Decisión abierta: ¿el stepper se elimina de toda la app? (previo)

Hoy `WorkspaceStepper` está oculto solo en el paso `upload` y sigue funcionando en
1FN/2FN/3FN. El usuario dijo "eso lo vamos a quitar" sin aclarar el alcance. Si se elimina
del todo hay que rediseñar cómo se recorre el flujo: están implicados
`WorkspaceStepper.tsx`, `workspaceSteps.ts` con `resolveStep`/`stepAfter`/`stepBefore` y
sus pruebas.

### 7. Auditoría de accesibilidad pendiente (previo)

Pospuesta hasta terminar de pulir la interfaz. Puntos a juzgar:

- La invariante de **exactamente un h1** en todos los pasos.
- El h2 de paso lleva `sr-only` en `upload` pero **sigue siendo destino de un `focus()` +
  `scrollIntoView()` programático**. Un elemento invisible que recibe el foco necesita
  veredicto explícito.
- Foco visible del `<input type="file">`, que está dentro de un `<label>`.
- Que `prefers-reduced-motion` cubra *todas* las animaciones.
- Reflow y zoom 200% con la cadena de altura.

---

## Trampas conocidas del proyecto

### Del parseo

**sqlglot solo no alcanza con la salida cruda de SSMS.** Sin sanear antes, degrada el
`CREATE TABLE` a un `exp.Command` opaco y al transpilar devuelve el T-SQL **sin traducir**.
Falla **en silencio**, no lanza excepción. Hay que quitar `WITH (PAD_INDEX = …)`,
`ON [PRIMARY]`, `TEXTIMAGE_ON`, `CLUSTERED`, `IDENTITY(n,n)`, `SET IDENTITY_INSERT`.

**SSMS emite los `INSERT` consecutivos SIN punto y coma.** sqlglot no puede separar dos
sentencias pegadas: sin el troceador propio, la extracción de filas devuelve **cero**.

**`N'...'` no es un `exp.Literal`.** T-SQL escribe sus cadenas Unicode así y sqlglot las
envuelve en `exp.National`. Sin desenvolverlo, el valor llega como la cadena
`"N'Beverages'"`, con prefijo y comillas incluidos.

**`mysqldump` omite la lista de columnas** (`INSERT INTO t VALUES (…)`). Los nombres tienen
que salir del `CREATE TABLE` ya parseado, o se generan columnas fantasma.

**`ColumnDefinition.sqlType` es el `data_type` de `information_schema`,** no la ortografía
del DDL: `"character varying"`, no `"VARCHAR(40)"`. Los fixtures de
`src/seeds/ventasRawFixture.ts` afirman esas cadenas exactas.

**Los binarios se resumen, no se transportan.** Una columna `image` pesa megabytes por fila
y nunca determina otra columna; la detección de dependencias solo compara celdas por
igualdad, así que un resumen (`0x<10746 bytes:37c1cbb14754>`) conserva todo lo que el
análisis necesita.

### Del resto del proyecto

**`tsconfig.json` NO tiene `noUncheckedIndexedAccess`.** Solo `strict: true`. Los accesos
por índice (`arr[i]`, `record[key]`) **no** están cubiertos; la guarda del `undefined` es
disciplina manual.

**`UploadHero.tsx` importa `DragEvent` desde `"react"`.** Ese es `React.DragEvent`, que
**no** es el tipo que entregan los listeners de `window.addEventListener`. Para handlers a
nivel window hay que tipar `globalThis.DragEvent`.

**No hay infraestructura para testear componentes.** `vitest.config.mts` usa
`environment: "node"` y el glob es `src/**/*.test.ts` — un `.tsx` ni se recogería. No hay
`jsdom` ni `@testing-library/react`. Todas las pruebas son de funciones puras. Agregar
pruebas de render implica dependencias nuevas y tocar la config: es una decisión pendiente,
no algo para colar dentro de un bugfix.

**El índice de CodeGraph se desactualiza.** Devolvió `SqlUploadCard.tsx`, que fue
eliminado. Contrastar siempre sus resultados contra el sistema de archivos.

---

## Cómo verificar

```bash
npx tsc --noEmit     # limpio
npx vitest run       # 29 archivos, 198 pruebas
npx eslint src       # limpio
npx next build       # compila; emite la ruta /esquema
```

**`npx eslint api` falla**: eslint no tiene configuración para `.py`. Lintear solo `src`.

Estado al momento de escribir esto: las cuatro pasan en verde.

Un `PostToolUse` hook typechequea cada archivo `.ts`/`.tsx` al escribirlo. Su silencio
significa "no se chequeó", no "está limpio".

**No hay navegador headless garantizado en el entorno de agentes.** Que el HTML servido
contenga las clases nuevas **no prueba nada** sobre el layout. Toda afirmación sobre
scroll, animaciones o responsive que no venga de un navegador real es una estimación y debe
declararse como tal.

> Lo que sí se midió en navegador real para la pantalla nueva: el desbordamiento horizontal
> del documento es **0 px** a 1280 px y a 375 px. La tabla ancha se desplaza dentro de su
> propio contenedor (`[data-slot="table-container"]`), ocultando ~199 px. Por eso el
> encabezado dice *"Datos (6 filas · 11 columnas)"*: en los sistemas que superponen la barra
> de desplazamiento, el número es la única pista de que hay más.

---

## Flujo de ramas y despliegue

`main` es la rama de producción (ajuste de Vercel, solo modificable desde el panel).
`development` es la rama de trabajo y despliega como *preview*.

**Flujo:** trabajar y commitear en `development` → mergear en `main` y empujar para
publicar. Empujar `development` sola solo produce un preview.

`git merge --ff-only development` **falla** sobre `main`: las ramas divergieron por el
commit de merge del PR #1. Hace falta un merge normal.

> `feature/normalization-workspace` está **fuera** de ese flujo. Para que llegue a preview
> —y de paso despejar la incógnita de Python en Vercel— hay que integrarla a
> `development`.

---

## Memoria persistente

El contexto de este trabajo está en Engram bajo el proyecto **`normalizations_db`**, en los
temas `normalizer/input-layer`, `normalizer/local-setup`, `normalizer/parse-service` y
`deploy/vercel-framework-preset`.

Ojo: si se abre una sesión desde otro directorio, Engram deriva el proyecto del nombre de
la carpeta y no encuentra nada. Buscar con `all_projects`.
