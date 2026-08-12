# Handoff — estado del trabajo en curso

Documento para retomar el trabajo en otra máquina o después de una pausa larga.
Refleja el estado al **12 de agosto de 2026**.

Rama de trabajo: `feature/normalization-workspace`. Va **16 commits adelante de
`development` y sin divergencia**, así que entra con fast-forward.

---

## Arrancar el entorno (leer esto primero)

**El proyecto necesita DOS procesos en desarrollo, no uno.**

```bash
pip install -r requirements.txt   # una sola vez: instala sqlglot
npm run dev:parser                # terminal 1 — servicio de lectura en :8787
npm run dev                       # terminal 2 — Next.js en :3000
```

Después: <http://localhost:3000> y subir un `.sql`.

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

**El paso de carga real dejó de usar `/api/analyze` y ahora consume `/api/parse`.**
Con eso, el andamiaje de `/esquema` cumplió su función y se borró.

El hallazgo que ordenó todo el diseño: `detectFunctionalDependencies`, `normalizeTo3NF`
y `generateDdl` importan **solo `@/domain`**. Cero dependencias de servidor. El motor
nunca necesitó una base de datos, así que el análisis **bajó al navegador**:

```
servidor (Python)          cliente (TypeScript, ya existía y es puro)
─────────────────          ─────────────────────────────────────────
archivo → ParsedDatabase   toFlatTable → detectar DF → 2FN/3FN → DDL
```

`/api/analyze` hacía DOS trabajos: leer el archivo ejecutándolo en PostgreSQL **y**
detectar las dependencias. Ahora el servidor solo lee.

### El recorrido cambió

```
upload → schema → 1FN → 2FN → 3FN
```

`schema` es nuevo. Existe porque un archivo declara N tablas y **3FN está definida
sobre UNA relación**. `StepAvailability` pasó de `{ hasAnalysis, isSchemaReady }` a
`{ hasParsedFile, hasSelectedTable, isSchemaReady }`.

> **No unir las tablas en una relación universal.** Un join fabrica tuplas espurias y
> dependencias funcionales falsas que no existen en el dominio. Son N análisis
> independientes más un grafo de claves foráneas para el informe global.

### Decisiones que conviene no deshacer sin leer esto

**Dos nombres de tabla, no uno.** `previewTableName` es la que se está mirando;
`analyzedTableName` es la comprometida al análisis. Fusionarlos analizaría cada tabla
que el usuario abre solo para verla, y le sacaría la posibilidad de comparar antes de
decidir. Comprometerla es un botón aparte.

**El análisis se deriva, no se guarda.** `useMemo` sobre `[analyzedTable]`. El memo no
es especulativo: el contenedor vuelve a renderizar en cada casilla marcada durante la
revisión y la detección es combinatoria sobre filas por columnas. Se acepta a propósito
una doble ejecución al elegir tabla (el manejador la calcula para sembrar `startReview`,
y el memo la recalcula en el renderizado siguiente): guardarla en estado crearía
exactamente la copia desincronizable que el memo evita.

**`parseFile` devuelve el estado que comprometió.** Quien llama necesita decidir el paso
en el mismo evento, y leer `parse.state` justo después daría el valor del renderizado en
curso. Reaccionar con un efecto sería sincronizar dos fuentes en vez de responder a un
evento.

**El archivo sin tablas se rechaza en el validador, no en la pantalla.** `parseSchemaResponse`
devuelve `NO_TABLES_MESSAGE`. Antes caía en el mensaje genérico de cuerpo malformado, que
mandaba a buscar una falla del servicio que no existía. Hay UNA sola redacción del
problema; no volver a duplicarla en `describeParseStatus`.

| Ruta | Qué es |
|---|---|
| `src/features/sql-upload/analyzeParsedTable.ts` | `ParsedTable` → `{ table, detection }`. Puro, 4 pruebas. |
| `src/features/sql-upload/describeParseStatus.ts` | Estado de lectura → aviso del hero. Puro, 6 pruebas. |
| `src/features/sql-upload/workspaceSteps.ts` | El recorrido y qué abre cada paso. 22 pruebas. |
| `src/features/sql-upload/SqlUploadContainer.tsx` | El contenedor. Único dueño del foco por paso. |
| `src/features/sql-upload/ParsedSchemaOverview.tsx` | El paso `schema`: lista de tablas y previsualización. |

---

## Lo que está pendiente y bloquea

### 1. Nadie confirmó que Vercel sirva `api/*.py` en un proyecto Next.js (SIN RESOLVER)

Las rutas no chocan y la documentación de Vercel describe funciones de Python en `api/`.
Pero **no está probado en este proyecto**, y la documentación consultada no cubre el caso
de mezclarlas con Next.js.

**Sigue siendo la incógnita que bloquea producción**, y ahora pesa más: la aplicación ya
no tiene otro camino de lectura. La forma más barata de despejarla es integrar la rama a
`development` y mirar el *preview deployment*.

### 2. `/api/analyze` y `src/features/staging/` están muertos, pero siguen en pie

Ninguna pantalla los llama. Se dejaron a propósito como red hasta que el preview confirme
lo de Python. **Cuando eso pase, se borran juntos**: la ruta, `analyzeContract.ts`,
`parseAnalyzeResponse.ts` y toda la carpeta `staging/` — con lo que se va también la
dependencia de PostgreSQL y `DATABASE_URL`.

`StagingPort` era la abstracción equivocada para un parser, pero ya no hay que rediseñarla:
no hay que reemplazarla por un puerto mejor, hay que eliminarla.

### 3. Nada de esto se probó en un navegador (SIN VERIFICAR)

Lo verde son tipos, pruebas de funciones puras y build. **El recorrido de clics no se
ejecutó nunca.** Falta confirmar a mano:

- subir → elegir tabla → 1FN → 2FN → 3FN de punta a punta;
- que el anillo de foco se vea al cambiar de paso, y su contraste;
- que volver atrás y elegir OTRA tabla reinicie la revisión sin arrastrar la clave anterior.

### 4. La vista de carga y el scroll (SIN VERIFICAR, previo)

Se le quitaron unos 72px al liberar el encabezado, que es justo el sobrante que este
documento describía antes. **No está confirmado que ahora entre sin scroll.**

Si todavía sobra, el próximo paso es medir, no estimar. Con la app corriendo, en consola:

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

### 5. Varias tablas de punta a punta (parcial)

Ya se puede elegir **cuál** tabla se normaliza, y volver a elegir otra. Lo que falta es
el nivel de esquema: el grafo de claves foráneas —`ParsedTable.foreignKeys` ya las trae,
nadie las usa todavía— y un informe global. Se dejó fuera del MVP a propósito.

### 6. Decisión abierta: ¿el stepper se elimina de toda la app? (previo)

Sigue oculto solo en `upload` y ahora muestra **cinco** pasos. El usuario dijo "eso lo
vamos a quitar" sin aclarar el alcance. Implicados: `WorkspaceStepper.tsx`,
`workspaceSteps.ts` y sus pruebas.

### 7. Accesibilidad: hecho lo del recorrido, pendiente lo que necesita navegador

Cerrado en esta tanda:

- El foco ya no aterriza en el `h2` que va `sr-only` en `upload` — va al `h1` visible del
  hero. `sr-only` recorta a 1x1px y **recorta también el anillo de foco**.
- Las flechas `→`/`←` salieron del nombre accesible de los botones.
- `main` y ambos encabezados declaran su propio anillo.
- Quitar el encabezado no rompió nada: ningún criterio exige un landmark `banner`, y al
  documento lo identifica su `<title>`.

Pendiente, y **solo se puede juzgar en un navegador real**: que el anillo se pinte de
verdad, su contraste 3:1, el área táctil de los cinco botones del stepper en pantalla
angosta, y si `prefers-reduced-motion` cubre *todas* las animaciones.

Hallazgo del auditor que **no se tomó**: pasar el efecto de foco del hero a
`useLayoutEffect` para cerrar una ventana de un frame en que el foco está en `body`. El
beneficio es de un frame y no es verificable sin lector de pantalla, mientras que
`useLayoutEffect` en un componente cliente pre-renderizado emite el warning de SSR.

---

## Trampas conocidas del proyecto

### De React

**Una bandera `isFirstRender` NO sobrevive a StrictMode.** Next 16 lo activa por defecto.
StrictMode invoca cada efecto **dos veces** en desarrollo sin desmontar de verdad, así que
los refs **no se reinician** entre las dos pasadas: la primera consume la bandera y la
segunda la encuentra ya en `false` y ejecuta el cuerpo igual.

Para "reaccionar solo cuando X cambió", **comparar contra el valor anterior**, que es
idempotente bajo el doble llamado:

```ts
const lastFocusedStep = useRef<WorkspaceStep>(step)
useEffect(() => {
  if (lastFocusedStep.current === step) return
  lastFocusedStep.current = step
  // ...
}, [step])
```

**Un solo dueño del foco.** El contenedor lo mueve al cambiar de paso; `UploadHero` solo
lo reclama cuando cambia el contador de Clear estando ya en `upload` (ahí el paso no
cambia y el contenedor no dispara). Dos autoridades sobre el foco se rompen de forma
intermitente, que es la peor forma de romperse.

**Para un destino de foco programático y no interactivo, `:focus`, nunca `:focus-visible`.**
`:focus-visible` existe para suprimir el anillo en elementos que el usuario clickea; un
encabezado con `tabindex="-1"` no se puede clickear-para-enfocar, así que esa supresión no
compra nada y deja el pintado a la heurística del navegador.

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
y nunca determina otra columna; la detección solo compara celdas por igualdad, así que un
resumen (`0x<10746 bytes:37c1cbb14754>`) conserva todo lo que el análisis necesita.

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

**El índice de CodeGraph se desactualiza.** Contrastar siempre sus resultados contra el
sistema de archivos.

**Los flags interactivos de git no existen en el entorno de agentes.** `git add -p` y
`git rebase -i` están bloqueados. Para verificar un commit aislado sirve
`git add <rutas>` → `git stash push --keep-index --include-untracked` → correr las
comprobaciones → `git commit` → `git stash pop`.

**No encadenar `npx next build` con `| tail`.** Dispara el hook que bloquea la lectura de
directorios vendorizados. Filtrar con `rg`, o correr el build en su propio comando.

---

## Cómo verificar

```bash
npx tsc --noEmit     # limpio
npx vitest run       # 31 archivos, 218 pruebas
npx eslint src       # limpio
npx next build       # compila
```

**`npx eslint api` falla**: eslint no tiene configuración para `.py`. Lintear solo `src`.

Estado al momento de escribir esto: las cuatro pasan en verde.

Un `PostToolUse` hook typechequea cada archivo `.ts`/`.tsx` al escribirlo. Su silencio
significa "no se chequeó", no "está limpio".

**No hay navegador headless garantizado en el entorno de agentes.** Que el HTML servido
contenga las clases nuevas **no prueba nada** sobre el layout. Toda afirmación sobre
scroll, foco, animaciones o responsive que no venga de un navegador real es una estimación
y debe declararse como tal.

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
> `development`. Hoy entra con fast-forward.

---

## Memoria persistente

El contexto de este trabajo está en Engram bajo el proyecto **`normalizations_db`**, en los
temas `normalizer/input-layer`, `normalizer/local-setup`, `normalizer/parse-service` y
`deploy/vercel-framework-preset`.

Ojo: si se abre una sesión desde otro directorio, Engram deriva el proyecto del nombre de
la carpeta y no encuentra nada. Buscar con `all_projects`.
