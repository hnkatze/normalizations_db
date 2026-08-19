# Handoff — estado del trabajo en curso

Documento para retomar el trabajo en otra máquina o después de una pausa larga.
Refleja el estado al **18 de agosto de 2026**, después de la tanda que agregó el
diagnóstico de forma normal, integró la rama de 1FN y automatización, y cerró
tres bugs del motor.

Rama de trabajo: `development`. `feature/normalization-workspace` ya está
integrada y no se usa más.

> El contexto largo de esta tanda está publicado como fichas en el context-board,
> proyecto **`normalizations-db`**: el criterio de evidencia, el canonicalizador
> único, las columnas derivadas, el diagnóstico, las claves alternativas
> compuestas, el flujo automático y cómo levantar el proyecto.

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

## Qué se construyó en la tanda del 12 de agosto

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

### Lo que se agregó después del cableado

**Cada tabla resultante muestra sus filas.** `NormalizedTable.sourceColumns` ya existía
para poder emitir el `INSERT ... SELECT DISTINCT` de la migración;
`projectTableRows` resuelve ese mismo SELECT en memoria para poder enseñarlo antes de
escribir nada. El pie dice cuántas filas quedaron y cuántas eran repetición — ver que 56
ventas dejan 5 clientes ES el argumento de la normalización, y hasta entonces había que
creerlo.

**El esquema se dibuja.** `toErDiagram` convierte el `NormalizedSchema` en texto de
Mermaid y `ErDiagram` lo renderiza. La generación es una función pura, así que qué se
dibuja se prueba sin navegador. Mermaid se importa dentro del efecto porque pesa cerca de
un megabyte y solo hace falta en 2FN y 3FN.

**El paso 3FN nombra las reglas que le faltan.** Antes decía "confirmá más reglas" con
decenas pendientes, y eso hizo tropezar tres veces a la misma persona. Ahora lista las
concretas cuyo determinante queda fuera de la clave, usando el MISMO canonicalizador que
el motor para no ofrecer una regla que después no se use.

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

**El archivo sin tablas ya estaba resuelto en el servicio, no en el cliente.** Verificado
contra el servicio corriendo: un `.sql` sin un solo `CREATE TABLE` vuelve como **422** con
`kind: "no-tables-found"`, y `PARSE_ERROR_MESSAGES` ya traía ese texto. La comprobación de
lista vacía en `parseSchemaResponse` es defensa en profundidad para un 200 que hoy nunca
llega, y reutiliza ese mismo mensaje a propósito: hay UNA sola redacción del problema.

| Ruta | Qué es |
|---|---|
| `src/features/sql-upload/analyzeParsedTable.ts` | `ParsedTable` → `{ table, detection }`. Puro, 4 pruebas. |
| `src/features/sql-upload/describeParseStatus.ts` | Estado de lectura → aviso del hero. Puro, 6 pruebas. |
| `src/features/sql-upload/workspaceSteps.ts` | El recorrido y qué abre cada paso. 22 pruebas. |
| `src/features/sql-upload/SqlUploadContainer.tsx` | El contenedor. Único dueño del foco por paso. |
| `src/features/sql-upload/ParsedSchemaOverview.tsx` | El paso `schema`: lista de tablas y previsualización. |

---

## Lo que se construyó en la tanda del 18 de agosto

**La aplicación ahora emite un veredicto.** `classifyNormalForm` responde en qué forma
normal está una tabla HOY y qué la saca de ahí, y la pantalla lo muestra en el paso 1FN.
Antes, una tabla que ya estaba en 3FN mostraba dos etapas idénticas sin explicar por qué,
y no había forma de distinguir eso de un error de la aplicación.

Se calcula con las dependencias **detectadas**, no con las confirmadas: con las
confirmadas, una tabla recién abierta se declararía en 3FN, que es la respuesta correcta
a la pregunta equivocada.

**El criterio de evidencia dejó de ser binario.** `isVacuous` sólo descartaba lo que nunca
pudo fallar. Ahora `hasSolidEvidence` exige al menos 3 *oportunidades de refutación*
(`rowCount - groupCount`): filas que cayeron sobre un valor de determinante ya visto y
podrían haber roto la regla. El umbral salió de medir tres archivos reales, no de
elegirlo — las reglas legítimas quedan en 17, 22 y 4; las coincidencias de una tabla de
siete filas, en 1 y 2.

**Se integró `feature/complete-1nf-and-fd-automation`** (de Beyson): 1FN de verdad
—grupos repetitivos y arrays JSON, que el proyecto antes daba por resueltos—, la clave
primaria leída del `CREATE TABLE` con botón "Confirmar clave", y la clasificación
automática de dependencias en cuatro baldes. Un solo conflicto, en `SqlUploadContainer`.

**Tres bugs del motor, cerrados:**

| Qué pasaba | Arreglo |
|---|---|
| El motor abortaba con "foreign-key cycle" ante entrada legítima | Reconocer claves alternativas con determinante compuesto |
| Dos canonicalizadores con criterios de desempate distintos | Uno solo, en el motor, y recibe la clave primaria |
| La automatización fabricaba una tabla `subtotal` | `detectDerivedColumns`: lo calculado no es una entidad |

Y una inconsistencia que apareció al probar: el diagnóstico y el clasificador automático
usaban criterios de evidencia distintos, así que la app llegaba a decir "esta tabla ya
está en 3FN" y descomponerla igual en tres tablas.

### Estado verificado en Chrome

| Archivo | Veredicto | 3FN |
|---|---|---|
| `ventas_raw` (semilla) | 1FN | 6 tablas — el answer key exacto |
| `Customers` (Northwind) | 2FN | Customers · City · PostalCode |
| `empleado` | 3FN | 1 tabla |
| `Categories` (Northwind) | 3FN | 1 tabla |

Lo que la aplicación dice y lo que hace coinciden en los cuatro.

### Decisiones abiertas de esta tanda

**Los porcentajes no se detectan.** `detectDerivedColumns` cubre producto y suma de dos
columnas —y de arrastre resta y división, que son las mismas leídas al revés— pero no
`iva = base * 0.15`, ni fórmulas de tres operandos, ni concatenación de texto. El
porcentaje aparece en cualquier volcado de facturación y hoy pasa derecho a
preseleccionarse. Ampliar tiene precio: cuantas más formas se prueban, más columnas se
marcan por casualidad.

**El tratamiento sigue mezclado.** `UploadHero` habla de usted y el resto de la
aplicación vosea. Elegir uno y aplicarlo entero; la mitad es peor que cualquiera de
los dos.

---

## Lo que se construyó en la tanda del 18 de agosto (segunda mitad)

Cinco commits sobre `development`, después de traer los quince de la rama de trabajo
(el `npm install` de ese pull es obligatorio: `@xyflow/react` y `@dagrejs/dagre` son
dependencias nuevas y sin ellas `tsc` y un test fallan).

**El archivo se diagnostica entero, no una tabla a la vez.**
`summarizeSchemaNormalization` recorre todas las tablas, las cuenta por forma normal y
ordena las que necesitan trabajo. Es el `map` sobre `classifyNormalForm` que faltaba, y
no reimplementa nada: usa `analyzeParsedTable` y `describeNormalFormVerdict`.

Cuenta **causas**, no violaciones crudas. Sobre `ventas_raw` son 10 en vez de 51, y las
cinco primeras son exactamente las cinco entidades del answer key. Contar violaciones de
a una hacía creer que había cinco veces más trabajo del que hay.

Aparta las reglas cuyo determinante es una columna calculada, con el MISMO criterio que
`suggestFunctionalDependencies` usa para no preseleccionarlas: si la pantalla no las
ofrece, el informe no puede contarlas como trabajo pendiente sin contradecirla.

**Medido antes de ponerlo en pantalla**: 552 tablas de solo esquema tardan 10 ms, una
tabla de 40 columnas con 200 filas 59 ms, y 200 tablas CON datos 745 ms. Un `useMemo`
alcanza; sacarlo a un worker sería resolver un problema que no existe.

**Dos esquemas ya no se pisan.** Un volcado que declara `ventas.cliente` y `rrhh.cliente`
registraba las dos bajo la misma clave: la segunda sobrescribía a la primera, la tabla
desaparecía del IR y la clave foránea que la referenciaba quedaba apuntando a columnas de
otra entidad. Ahora se registran calificadas y el nombre vuelve a acortarse al final para
las que no compiten — que es el caso corriente de un volcado entero bajo `dbo`.

> La gotcha anterior decía que `REFERENCES dbo.alumno(id)` no se resolvía. **Es falso**,
> medido el 18 de agosto de 2026: 8 de 8 claves foráneas calificadas resuelven bien. Lo
> que fallaba era la colisión entre esquemas distintos, que es un problema peor porque
> corrompe en vez de perder.

**El par de columnas en razón fija.** `iva = base * 0.15` era el hueco que más dolía.
La relación es SIMÉTRICA —`base = iva * 6.66` se cumple igual— y nada en los datos dice
cuál se calcula, así que se marcan LAS DOS. Alcanza para el propósito: ninguna se
preselecciona, y un par en razón fija no nombra una entidad en ningún caso. Medido sobre
los tres archivos del repo: cero sugerencias nuevas.

> Dos fixtures viejos de `detectDerivedColumns` tenían razón fija por accidente (`b = a*2`
> en uno, `precio` constante en el otro) y probaban otra cosa que la que su nombre decía.

**El recorrido cubre lo nuevo.** Ya no está cableado a `ventas_raw`: toma el nombre de la
tabla del archivo, aplica el answer key solo a la semilla que lo tiene y declara una regla
a mano cuando no hay filas. `seed_ventas_solo_esquema.sql` es nueva y existe porque sin
ella el camino de un volcado sin datos no tenía ninguna verificación en navegador.

### Estado verificado en Chrome (18 de agosto de 2026)

`npm run walkthrough:all` corre las tres semillas. Las tres llegan a 3FN con **0 px** de
desborde horizontal y **cero errores de consola**:

| Semilla | Informe del archivo | 3FN |
|---|---|---|
| `seed_ventas_raw` | 1 de 1 tabla, 10 causas, 1FN | 6 tablas (answer key completo) |
| `seed_aerolinea_multitabla` | 1 de 7 tablas, 1 en 2FN y 6 en 3FN | 1 tabla |
| `seed_ventas_solo_esquema` | sin diagnosticar (no hay filas ni reglas) | 2 tablas |

> Al declarar una regla a mano hay que usar `check({ force: true })`, no `click()`: el
> control real está debajo de su etiqueta y un click directo no cambia el estado. El
> formulario queda aparentemente lleno diciendo "seleccione al menos una columna
> determinante", y se pierden treinta segundos buscando un bug que no existe.

---

## Lo que está pendiente y bloquea

### 1. Vercel sí sirve `api/*.py` en un proyecto Next.js (RESUELTO)

**Confirmado en un preview deployment real.** Era la incógnita que bloqueaba producción
desde el principio y ya no lo es: la función de Python convive con la aplicación Next.js
en el mismo despliegue y responde en `/api/parse`.

Lo que hizo falta para que funcionara:

| Pieza | Por qué |
|---|---|
| `api/` en la RAÍZ | No dentro de `app/`. Cada `.py` ahí se vuelve una función. |
| `class handler(BaseHTTPRequestHandler)` | Uno de los tres puntos de entrada que Vercel reconoce. |
| `requirements.txt` en la raíz | De ahí salen las dependencias. |
| `framework: 'nextjs'` en `vercel.ts` | Sin el pin cae en el preset "Other" y tira rutas y funciones. |
| UNA sola configuración | `vercel.ts` **y** `vercel.json` a la vez aborta el despliegue. |

> **Trampa que sigue viva:** si alguien agrega FastAPI, Flask o Django a `requirements.txt`,
> Vercel detecta un preset de framework Python y **las funciones de `/api` dejan de
> existir** — esa aplicación pasa a atender todas las peticiones. Hoy no ocurre porque solo
> está `sqlglot`.

Queda una pregunta menor sin cerrar: si los módulos de `api/_sqlparse/` se convirtieron en
funciones propias. La convención del guion bajo dice que no, pero la documentación no lo
afirma. Se ve en la lista de funciones del despliegue.

### 2. `/api/analyze` y `src/features/staging/` (RESUELTO)

Borrados: la ruta, `analyzeContract.ts`, `parseAnalyzeResponse.ts` y toda la carpeta
`staging/`. Con ellos se fueron las dependencias `pg` y `@types/pg`, y `DATABASE_URL`
dejó de tener uso en el proyecto. 23 archivos, −1359 líneas.


### 3. El recorrido está verificado de punta a punta (RESUELTO)

`npm run walkthrough` lo comprueba solo, en un Chrome de verdad. Resultado con la semilla
de referencia: **las seis tablas** de 3FN con los conteos exactos del answer key
—56 / 8 / 10 / 5 / 3 / 4—, **0 px** de desborde horizontal y cero errores de consola.

Lo que sigue sin comprobarse automáticamente: el foco visible, el contraste real y el
comportamiento con teclado. El script mira estructura y desborde, no percepción.

### 4. La vista de carga y el scroll (parcialmente verificado)

Se le quitaron unos 72px al liberar el encabezado. El recorrido reporta **0 px de
desborde horizontal**, pero el scroll VERTICAL de la vista de carga no está medido: el
script informa el del documento entero, que en 2FN y 3FN es largo por diseño.

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

Ya se puede elegir **cuál** tabla se normaliza, y volver a elegir otra. Cada tabla se
diagnostica sola con `classifyNormalForm`, que es puro y por-tabla: diagnosticar el
archivo entero es un `map` sobre sus tablas.

El nivel de esquema ya está: el grafo de claves foráneas alimenta el diagrama
(`deriveForeignKeyGraph`, `parsedSchemaToErDiagram`) y el informe global vive en
`summarizeSchemaNormalization`, arriba del índice de tablas.

Lo que queda es el paso siguiente y es una decisión de producto, no un hueco: hoy se
normaliza UNA tabla por vez aunque el informe diagnostique todas. Normalizar el archivo
entero de una pasada implica resolver qué hacer cuando dos tablas extraen la misma
entidad, y eso no está decidido.


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

**Para un destino de foco programático, `:focus-visible`, nunca `:focus`.**
`tabindex="-1"` significa "no alcanzable con Tab", **no** "no enfocable con click": un
elemento así SÍ recibe foco al clickearlo. Con `:focus` a secas, cualquier click sobre el
encabezado —o sobre `<main>`, que también lo lleva por el enlace de saltar al contenido—
pinta el anillo aunque el usuario esté con el mouse.

Esto se probó de las dos formas: primero se cambió a `:focus` siguiendo el argumento de que
un elemento con `tabindex="-1"` no se puede clickear-para-enfocar. **Ese argumento es falso**
y el resultado se vio en el navegador — anillo azul en cada click. `:focus-visible` es
justamente la pseudo-clase que distingue teclado de puntero, que es la distinción que acá
hace falta.

### De las pruebas y las herramientas

**`vitest` NO typechequea.** Pasó tres veces en una tanda: las pruebas en verde mientras
`tsc` reportaba errores de tipos. Correr `npx tsc --noEmit` aparte siempre, aunque el
suite esté limpio.

**Las pruebas usan `ventasRawFixture.ts`, escrito a mano, NO la salida del parser.** El
servicio de Python no tiene pruebas propias, así que cualquier defecto de extracción de
valores solo aparece ejecutándolo. Así se coló que las fechas llegaran como
`CAST('2024-03-04' AS DATE)` en vez de la fecha.

**Cuando una pantalla anticipa lo que hará el motor, tiene que llamar al motor.** La lista
de reglas sugeridas clasificaba por su cuenta y podía ofrecer una que el motor luego
descartaba, porque él canonicaliza los pares recíprocos antes de clasificar. Se extrajo
`createCanonicalizer` para que no haya dos versiones de la misma regla.

**Un `<ul>` con `display: flex` o `grid` pierde la semántica de lista en WebKit.** Se le
devuelve con `role="list"` explícito. No es un rol redundante en ese caso.

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
npm install              # obligatorio tras un pull que toque package.json
npx tsc --noEmit         # limpio
npx vitest run           # 470 pruebas
npm run test:parser      # 30 pruebas de Python (pip install -r requirements-dev.txt)
npx eslint src           # limpio
npx next build           # compila
npm run walkthrough:all  # recorre las TRES semillas en Chrome
```

El recorrido necesita los otros dos procesos levantados. Sale distinto de cero si algo
falla, así que sirve como comprobación y no solo como paseo.

**`npx eslint api` falla**: eslint no tiene configuración para `.py`. Lintear solo `src`.

Estado al 18 de agosto de 2026: las siete pasan en verde.

Un `PostToolUse` hook typechequea cada archivo `.ts`/`.tsx` al escribirlo. Su silencio
significa "no se chequeó", no "está limpio".

**Ahora SÍ se puede mirar la aplicación**, con `npm run walkthrough` (necesita los otros
dos procesos levantados). Usa Playwright contra el Chrome del sistema —no descarga
navegadores—, sube la semilla de referencia, confirma las reglas del answer key, recorre
las tres etapas y deja capturas en `.walkthrough/`. Informa cuántas tablas salió cada
etapa, el desborde horizontal del documento y cualquier error de consola.

Eso no vuelve opcional la honestidad: typecheck, pruebas y build siguen sin decir nada
sobre layout. La diferencia es que ahora hay una forma de comprobarlo en vez de estimarlo,
así que una afirmación sobre lo visual sin captura que la respalde no tiene excusa.

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

El contexto de este trabajo vive en dos lados.

**Context-board** (compartido, llega a cualquier máquina): proyecto `normalizations-db`,
con fichas sobre el criterio de evidencia, el canonicalizador único, las columnas
derivadas, el diagnóstico de forma normal, las claves alternativas compuestas, el flujo
automático y cómo levantar el proyecto.

**Engram** (local), bajo el proyecto **`normalizations_db`**, en los temas
`normalizer/input-layer`, `normalizer/local-setup`, `normalizer/parse-service`,
`normalizer/normal-form-diagnosis`, `normalizer/vacuous-fd-noise`,
`normalizer/three-fixes-after-merge`, `git/merge-beyson-1nf-automation` y
`deploy/vercel-framework-preset`.

Ojo: si se abre una sesión desde otro directorio, Engram deriva el proyecto del nombre de
la carpeta y no encuentra nada. Buscar con `all_projects`.
