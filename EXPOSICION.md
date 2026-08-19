# Defensa del Normalizador SQL

Material para estudiar el proyecto, redactar el informe y armar las diapositivas.

Todo lo que está acá es verificable en el repositorio: los números salen de mediciones
reales, no de estimaciones. Cuando un dato viene de una medición concreta, se dice de dónde.

**Contenido**

1. [Qué es, en una frase](#1-qué-es-en-una-frase)
2. [El problema: la redundancia](#2-el-problema-la-redundancia)
3. [La dependencia funcional](#3-la-dependencia-funcional)
4. [Las tres formas normales](#4-las-tres-formas-normales)
5. [El caso completo](#5-el-caso-completo)
6. [Cómo está construido](#6-cómo-está-construido)
7. [El motor, por dentro](#7-el-motor-por-dentro)
8. [Las decisiones difíciles](#8-las-decisiones-difíciles)
9. [Números y verificación](#9-números-y-verificación)
10. [Guión de diapositivas](#10-guión-de-diapositivas)
11. [Lo que le van a preguntar](#11-lo-que-le-van-a-preguntar)
12. [Lo que NO hace](#12-lo-que-no-hace)

---

## 1. Qué es, en una frase

Es una herramienta web que recibe **una tabla plana sin normalizar** en un archivo `.sql`,
descubre las dependencias funcionales escondidas en sus datos y propone la descomposición a
**tercera forma normal**: las tablas resultantes, sus claves y el DDL listo para ejecutar.

**La distinción que conviene marcar de entrada.** No es un CRUD sobre una base ya diseñada.
Es la herramienta que *hace* el trabajo de normalización — el trabajo que normalmente se hace
a mano, con papel, y que en un volcado de 552 tablas nadie hace a mano.

Y hay una decisión de fondo que atraviesa todo el proyecto. Conviene tenerla clarísima porque
es la primera que se va a discutir:

> **La aplicación nunca decide sola.** Detecta candidatas y las propone; quien confirma es la
> persona. El motivo no es cautela de diseño, es teoría: los datos solo pueden *refutar* una
> dependencia funcional, nunca probarla. Está desarrollado en la sección 3 — es el argumento
> más fuerte del proyecto.

---

## 2. El problema: la redundancia

Esta es la tabla que entra. Una fila por producto de cada venta, con todo mezclado en un solo
lugar:

| venta_id | fecha_venta | cliente_id | cliente_nombre | ciudad | producto_id | producto_nombre | categoria | cant. |
|---|---|---|---|---|---|---|---|---|
| 1 | 2024-03-04 | 1 | Ana Martinez | Tegucigalpa | 101 | Cafe molido 500g | Bebidas | 2 |
| 1 | 2024-03-04 | 1 | Ana Martinez | Tegucigalpa | 102 | Te verde 20 sobres | Bebidas | 1 |
| 1 | 2024-03-04 | 1 | Ana Martinez | Tegucigalpa | 104 | Pan integral | Panaderia | 3 |

Tres productos de **una sola venta**, y ya se repiten el nombre de la clienta, su ciudad y la
fecha. En las 56 filas del conjunto, **Ana Martinez aparece 14 veces**.

### Por qué eso es un problema y no solo algo feo

Conviene nombrarlo con los tres términos que el docente espera escuchar:

| Anomalía | Qué ocurre |
|---|---|
| **De actualización** | Si Ana se muda, hay que corregir 14 filas. Basta que una se escape para que la base *se contradiga a sí misma*: la misma clienta viviendo en dos ciudades. |
| **De inserción** | No se puede registrar una ciudad nueva sin inventar una venta que la use. El dato existe en el negocio pero no tiene dónde vivir. |
| **De borrado** | Al borrar la última venta de una categoría, la categoría desaparece con ella. Se pierde información que nadie pidió borrar. |

Las tres son el mismo defecto visto desde tres ángulos: **hay más de un tema dentro de la
misma tabla**. Normalizar es separar los temas.

---

## 3. La dependencia funcional

Es el concepto central de toda la teoría. Si se explica bien, el resto se sigue solo.

> **Definición.** En una relación *R*, el conjunto de atributos **X** determina funcionalmente
> al atributo **Y** —se escribe `X → Y`— si para **cada** valor de X existe **exactamente un**
> valor de Y.
>
> En criollo: *sabiendo X, ya se sabe Y sin preguntarle a nadie más*.

En la tabla de arriba:

```
cliente_id → cliente_nombre          el mismo id siempre trae el mismo nombre
{venta_id, producto_id} → cantidad   hace falta el par completo: determinante compuesto
```

### El punto que da la nota alta

> **Una dependencia funcional es una propiedad del ESQUEMA, no de los datos.** Los datos solo
> pueden *refutarla* —basta un contraejemplo— pero **nunca probarla**. Que una regla se cumpla
> en las 56 filas no la vuelve cierta: puede que la fila 57 la rompa.

Por eso la aplicación **siempre pide confirmación humana**. La evidencia en contra la ponen los
datos; el conocimiento del dominio lo pone la persona. Esa división de trabajo es la tesis del
proyecto entero, no un detalle de interfaz.

Y tiene una consecuencia práctica que sorprende: el motor de normalización **nunca lee una sola
fila**. Un volcado de solo esquema, sin ningún `INSERT`, se puede normalizar igual. Lo que se
pierde sin datos es la capacidad de *sugerir*, no la de normalizar.

### Dependencias triviales, parciales y transitivas

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| Trivial | El dependiente ya está dentro del determinante | `{a, b} → a` |
| Parcial | El determinante es un subconjunto propio de una clave compuesta | `producto_id → producto_nombre` |
| Transitiva | Un atributo no-primo determina a otro no-primo | `cliente_id → cliente_nombre` |

Dos palabras de vocabulario que conviene usar bien: un atributo **primo** es el que forma parte
de alguna clave candidata; **no-primo** es el que no. Una **clave candidata** es un conjunto
mínimo de atributos que determina toda la fila.

---

## 4. Las tres formas normales

Cada forma normal *contiene* a la anterior: para estar en 3FN hay que estar primero en 2FN, y
para eso en 1FN. Son capas, no alternativas.

### 1FN — Todos los valores son atómicos

Sin grupos repetidos ni listas dentro de una celda. Nada de un campo `telefonos` con
`"9988-1122, 3344-5566"` adentro.

**En este proyecto 1FN es el piso.** La entrada se lee de un `CREATE TABLE`, que ya es
relacional por construcción, así que ninguna tabla puede estar *por debajo* de 1FN. Es un buen
detalle para mencionar: muestra que se entiende de dónde viene el dato.

### 2FN — Sin dependencias parciales de la clave

Está en 1FN y además ningún atributo no-primo depende de *una parte* de la clave primaria.
Solo puede violarse cuando la clave es **compuesta**: si la clave es de una sola columna, 2FN
se cumple gratis.

```
PK = {venta_id, producto_id}
producto_id → producto_nombre     depende de MEDIA clave
```

El arreglo: sacar `producto_nombre` a una tabla `productos` cuya clave es `producto_id`.

### 3FN — Sin dependencias transitivas

Está en 2FN y además ningún atributo no-primo depende de otro atributo no-primo. La frase
clásica: *cada atributo depende de la clave, de toda la clave y de nada más que la clave*.

```
venta_id → cliente_id → cliente_nombre
                        la clave llega al nombre POR EL CAMINO del cliente
```

El arreglo: sacar los datos del cliente a su propia tabla y dejar `cliente_id` como clave
foránea.

> **Si preguntan por BCNF:** es un refinamiento de 3FN que exige que *todo* determinante sea
> clave candidata. El proyecto se detiene en 3FN **por decisión explícita y documentada**, no
> por olvido. Conviene decirlo así: un alcance elegido se defiende, uno olvidado no.

---

## 5. El caso completo

Este es el ejemplo que conviene llevar preparado, porque va de punta a punta y los números
están verificados.

**Entrada.** Una tabla `ventas_raw`: 15 columnas, 56 filas, clave primaria compuesta
`{venta_id, producto_id}`.

**Las reglas confirmadas.** Trece dependencias: 5 parciales, 6 transitivas y 2 completas.

**Salida: seis tablas, cada una con un solo tema.**

```
ciudades(ciudad_id, ciudad_nombre, ciudad_pais)
categorias(categoria_id, categoria_nombre)
clientes(cliente_id, cliente_nombre, cliente_email, cliente_ciudad_id ──> ciudades)
productos(producto_id, producto_nombre, producto_precio, categoria_id ──> categorias)
ventas(venta_id, fecha_venta, cliente_id ──> clientes)
ventas_detalle(venta_id ──> ventas, producto_id ──> productos, cantidad, subtotal)
```

Filas por tabla: **56 / 8 / 10 / 5 / 3 / 4**.

> **Ana Martinez ahora existe una sola vez.** Ese es el resultado, dicho en una frase que
> cualquiera entiende. Conviene guardarla para el cierre de la exposición.

Y vale la pena señalar la cadena que el motor resolvió solo:

```
venta_id → cliente_id → cliente_ciudad_id → cliente_ciudad_pais
```

Tres saltos. Por eso 3FN se aplica como un **bucle de punto fijo** —seguir desplazando hasta
que nada más se mueva— y no como dos pasadas escritas a mano.

---

## 6. Cómo está construido

### El recorrido de un archivo

1. **El navegador sube el archivo.** El cuerpo va en crudo, sin envolver en `multipart`. A
   propósito: la codificación es justamente lo que hay que detectar, y decodificar antes de
   tiempo destruye el BOM que la delata (SSMS exporta en UTF-16).
2. **Una función de Python lo interpreta.** `/api/parse` usa **sqlglot** para leer SQL de
   cuatro dialectos: SQL Server, MySQL, Oracle y PostgreSQL. **No lo ejecuta** — lo parsea.
   Esa diferencia es de seguridad y vale mencionarla.
3. **Sale una representación intermedia.** El IR es el contrato entre Python y TypeScript:
   tablas, columnas, tipos, claves primarias, foráneas y únicas, más un diagnóstico de lo que
   no se pudo leer. Nada se descarta en silencio.
4. **El detector propone dependencias.** Agrupa filas y busca qué columnas determinan a
   cuáles, con la evidencia que respalda cada candidata.
5. **La persona confirma.** El paso que no se puede automatizar, por teoría y no por comodidad.
6. **El motor descompone y emite el DDL.** 1FN → 2FN → 3FN, con el esquema resultante, el
   diagrama y las sentencias `CREATE TABLE`.

### Las capas del código

La regla es una sola y se cumple sin excepciones: **el dominio no depende de nada; todo depende
del dominio.**

| Capa | Qué vive ahí | De qué depende |
|---|---|---|
| `src/domain/` | Los tipos y reglas puras del modelo relacional | De nada |
| `src/features/fd-detection/` | Detectar dependencias y columnas calculadas | Dominio |
| `src/features/normalization/` | El motor 1FN→2FN→3FN, el diagnóstico y el DDL | Dominio |
| `src/features/sql-upload/` | La pantalla, el diagrama y el informe del archivo | Dominio y las otras dos |
| `api/_sqlparse/` | El lector de SQL en Python | sqlglot |

> **Por qué Python y no TypeScript para el parseo.** Porque `sqlglot` entiende cuatro dialectos
> de SQL y no existe equivalente en el ecosistema JavaScript. La función de Python convive con
> la aplicación Next.js en el *mismo* despliegue de Vercel, así que no hay CORS ni un segundo
> servidor que mantener.

---

## 7. El motor, por dentro

Si preguntan «¿y cómo lo descompone?», esta es la respuesta. Y es más elegante de lo que
parece.

> **La idea central.** Toda columna que no es clave está **poseída por exactamente una tabla a
> la vez**. Al inicio todas pertenecen a la tabla de hechos. Confirmar `X → Y` reasigna la
> posesión de Y a una tabla cuya clave es X — creándola la primera vez, reutilizándola después.
> Las columnas de X *nunca se mueven*, y eso es precisamente lo que las convierte en la
> **clave foránea** de vuelta.

### Dos pasadas, por dos razones distintas

- **2FN se resuelve en una sola pasada.** Se define solo respecto de la clave primaria
  original, que no cambia. No hace falta mirar tablas intermedias.
- **3FN se resuelve con un bucle de punto fijo.** Porque hay cadenas: al mover `cliente_id`
  puede quedar expuesta una dependencia nueva. Se sigue desplazando hasta que nada más se mueva.

### El caso raro que hay que saber explicar

Si están confirmadas `{A} → B` y `{B} → A` al mismo tiempo, A y B son **claves candidatas
alternativas de la misma entidad** — un id y un nombre único, por ejemplo. Si el motor las
tratara por separado crearía *dos tablas que se referencian mutuamente*: un ciclo de claves
foráneas, que es un esquema roto.

Por eso los determinantes recíprocos se **fusionan antes** de cualquier pasada, conservando la
clave de menor cardinalidad. Y hay una verificación defensiva que lanza excepción si algún
ciclo sobrevive: mejor que falle ruidosamente ahí y no que entregue un esquema silenciosamente
roto.

> **Dato real para contar:** ese *assert* no era paranoia teórica. Se disparó con datos de
> usuario legítimos, en la semilla de empleado/departamento. El caso: `dir` determinaba a
> `oficio` y `comision`, y el par `(oficio, comision)` determinaba a `dir`. Un ciclo con
> determinante compuesto que la fusión original no reconocía.

---

## 8. Las decisiones difíciles

Esta sección es la que separa una exposición que describe de una que **demuestra criterio**.
Cada decisión salió de un problema real y se tomó midiendo, no adivinando.

### 8.1 El umbral de evidencia: por qué 3

Que una dependencia se cumpla en todas las filas no alcanza. Hay que preguntarse **cuántas
filas pudieron haberla roto y no la rompieron**. A eso se le llama *oportunidades de
refutación*:

```
oportunidades = filas − grupos distintos del determinante
```

Si cada valor del determinante aparece una sola vez, la regla se cumple por accidente: nunca
tuvo ocasión de fallar. En una tabla de 7 filas, `dir → oficio` («vivir en León determina ser
vendedor») se cumplía porque dos personas de León resultaron vendedoras. El motor fabricaba una
tabla por eso.

> **El 3 no se eligió a ojo: salió de medir tres archivos reales.** Las reglas legítimas
> quedaron en 17, 22 y 4 oportunidades. Las coincidencias, en 1 y 2. El corte cae en el hueco
> que las separa. Bajarlo revive las tablas fantasma; subirlo mata una regla legítima de
> Northwind.

### 8.2 Columnas calculadas: cuando la estadística no alcanza

`subtotal` determina a `producto_precio` y `cantidad` con evidencia impecable. Y sin embargo
extraer una tabla `subtotal` no saca ninguna redundancia: la redundancia de un valor calculado
se quita **borrando la columna**, no mudándola de tabla.

Ninguna medida estadística las separa: `subtotal` comprime 36 grupos sobre 56 filas (0,64) y el
`PostalCode` de Northwind comprime 87 sobre 91 (0,96). Cualquier umbral que descarte al primero
descarta también al segundo, que sí es una regla real del dominio.

La solución fue **detectar la aritmética**: producto y suma de dos columnas, más un factor
constante sobre una. Y ahí apareció algo que vale la pena contar porque muestra pensamiento:

> **El caso del porcentaje es simétrico.** `iva = base × 0,15` y `base = iva × 6,66` se cumplen
> exactamente igual, y *nada en los datos dice cuál de las dos se calcula*. Marcar la
> equivocada sería peor que no marcar ninguna — así que se marcan **las dos**. Alcanza para el
> propósito: un par de columnas en razón fija no nombra una entidad en ningún caso.

### 8.3 Escala: 552 tablas no caben en una pantalla

Con un volcado real de SQL Server —552 tablas y 584 claves foráneas— el índice medía **33.607
píxeles de alto**: 33 pantallas de scroll. Y el diagrama, aunque dibujaba las 552 tablas sin un
solo error en 7,3 segundos, alejaba tanto la cámara que solo quedaban líneas.

Lo que resolvió el diseño no fue la intuición sino **medir la distribución**: la mediana de
vecinos por tabla es **1**, y 541 de 552 tablas tienen 10 vecinos o menos. Entonces se muestra
el *vecindario* de la tabla elegida, no el esquema completo. Cubre el 98 % de los casos.

### 8.4 Un solo canonicalizador, una sola definición de cada regla

Llegaron a existir **dos implementaciones** del mismo concepto con criterios de desempate
distintos: la del motor elegía la columna declarada primero en el `CREATE TABLE`; la de la
pantalla priorizaba la clave primaria. Dos versiones de la misma regla divergen en silencio, y
la pantalla terminaba ofreciendo una regla que el motor reinterpretaba de otra forma.

> **La lección, dicha como principio:** hay UNA sola definición de cada regla y vive en el
> dominio. Una pantalla que anticipa al motor tiene que *llamarlo*, no imitarlo.

---

## 9. Números y verificación

Los datos duros del proyecto, para la portada del informe:

| Métrica | Valor |
|---|---|
| Pruebas automáticas | **500** (470 TypeScript + 30 Python) |
| Archivos TypeScript | 203 |
| Líneas de TypeScript | 24.152 |
| Líneas de Python | 1.409 |
| Dialectos SQL leídos | 4 |
| Tablas del archivo más grande probado | 552 |

### Cómo se verifica

Esta tabla contesta sola la pregunta «¿y cómo sabe que funciona?»:

| Comando | Qué comprueba |
|---|---|
| `npx tsc --noEmit` | Que los tipos cierran |
| `npx vitest run` | 470 pruebas de la lógica |
| `npm run test:parser` | 30 pruebas del lector de SQL |
| `npx eslint src` | Estilo y errores comunes |
| `npx next build` | Que compila para producción |
| `npm run walkthrough:all` | Tres recorridos en un Chrome real |

> **El argumento más fuerte sobre calidad.** Los tipos, las pruebas y el build *no dicen nada*
> sobre si un panel quedó vacío o si algo se sale de la pantalla. Por eso hay un recorrido
> automático que maneja un Chrome de verdad, sube las tres semillas, hace clic por toda la
> aplicación y verifica el resultado. Las tres llegan a 3FN con **0 píxeles** de desborde
> horizontal y **cero errores de consola**.

### Rendimiento, medido

| Caso | Tiempo |
|---|---|
| 552 tablas, solo esquema | 10 ms |
| 1 tabla de 40 columnas × 200 filas | 59 ms |
| 200 tablas con datos | 745 ms |

El detector recorre el conjunto potencia de las columnas, que es 2^N. Se acota el determinante
a **2 columnas**: una tabla de 20 columnas pasa de más de un millón de candidatos a
**C(20,1) + C(20,2) = 210**. Además hay poda por minimalidad: si `A → Y` ya está confirmada,
`{A, …} → Y` queda implicada por aumento y nunca se evalúa.

---

## 10. Guión de diapositivas

Doce diapositivas para unos 12–15 minutos. Para cada una: qué va **en** la diapo y qué **se
dice**. Regla de oro: la diapo no es el guión. Si está todo escrito, el aula lee en vez de
escuchar.

### Diapo 1 — Portada

*En la diapo:* «Normalizador SQL», el nombre, la clase, y una línea: «de una tabla plana a un
esquema en 3FN».

*Qué decir:* empezar por el problema, no por uno mismo. «Voy a mostrarles una tabla que muchos
han visto en un Excel de trabajo, y por qué esa tabla es una bomba de tiempo.»

### Diapo 2 — El problema

*En la diapo:* la captura de la tabla plana, con las celdas repetidas resaltadas.

*Qué decir:* mostrar la tabla y dejarla tres segundos en silencio. Después: «tres productos de
una sola venta, y el nombre de la clienta ya está tres veces. En las 56 filas está 14 veces.»
Cerrar con la pregunta que engancha: «¿qué pasa si Ana se muda?»

### Diapo 3 — Consecuencias

*En la diapo:* las tres anomalías —actualización, inserción, borrado— con una línea cada una.

*Qué decir:* acá va el vocabulario técnico. Es el momento de mostrar que se sabe cómo se llaman
las cosas: «las tres son el mismo defecto — hay más de un tema en la misma tabla.»

### Diapo 4 — El concepto

*En la diapo:* la notación `X → Y` grande y sola, con un ejemplo concreto debajo.

*Qué decir:* «sabiendo X, ya se sabe Y sin preguntarle a nadie más.» Primero en criollo y
después formal. Si se da la definición formal sola, la mitad del aula se pierde.

### Diapo 5 — La tesis

*En la diapo:* una sola frase — «Los datos refutan; nunca prueban».

*Qué decir:* esta es **la** diapositiva del proyecto. «Que una regla se cumpla en las 56 filas
no la vuelve cierta: la fila 57 puede romperla. Por eso el programa propone y la persona
confirma.» Si solo recuerdan una cosa, que sea esta.

### Diapo 6 — Teoría

*En la diapo:* tres bloques apilados, uno por forma normal, con un ejemplo real en cada uno.

*Qué decir:* marcar que son capas, no alternativas. Y aclarar que 2FN solo puede violarse con
clave compuesta: es el detalle que casi nadie menciona y siempre suma.

### Diapo 7 — Demo

*En la diapo:* nada de texto, la aplicación en pantalla.

*Qué decir:* subir el archivo y recorrer 1FN → 2FN → 3FN, narrando lo que pasa y no lo que se
hace clic. **Llevar capturas de respaldo**: si el wifi del aula falla, la demo se cae y la
exposición con ella.

### Diapo 8 — Resultado

*En la diapo:* el diagrama entidad-relación y los conteos 56 / 8 / 10 / 5 / 3 / 4.

*Qué decir:* cerrar el círculo con la frase del principio: **«Ana Martinez ahora existe una
sola vez.»**

### Diapo 9 — Arquitectura

*En la diapo:* el diagrama del recorrido en seis pasos. Next.js + TypeScript, Python + sqlglot.

*Qué decir:* destacar dos cosas — el SQL **se parsea, no se ejecuta** (seguridad), y el dominio
no depende de nada (la regla de las capas).

### Diapo 10 — Criterio

*En la diapo:* legítimas 17, 22 y 4 oportunidades; coincidencias 1 y 2; el corte cae en el
hueco.

*Qué decir:* contar la historia de «vivir en León determina ser vendedor». Se entiende sola, da
gracia y demuestra que el número salió de medir y no de inventar.

### Diapo 11 — Escala

*En la diapo:* 33.607 px de alto → 1.615 px. Mediana de vecinos: 1.

*Qué decir:* «medimos la distribución en vez de suponerla: 541 de 552 tablas tienen 10 vecinos
o menos, así que mostramos el vecindario y no el esquema completo.»

### Diapo 12 — Cierre

*En la diapo:* 500 pruebas y 3 recorridos en navegador. Alcance: hasta 3FN, por decisión. Lo
que sigue.

*Qué decir:* terminar diciendo qué falta **suma**, no resta: muestra que se sabe dónde están
los límites de lo que se hizo. Ver la sección 12.

---

## 11. Lo que le van a preguntar

Ordenadas de la más probable a la más incómoda.

**¿Por qué se detiene en 3FN y no llega a BCNF?**
Por alcance elegido y documentado. 3FN cubre las anomalías que aparecen en datos reales de
gestión; BCNF exige que *todo* determinante sea clave candidata y los casos donde 3FN no
alcanza son poco frecuentes. Además, BCNF puede no preservar las dependencias funcionales al
descomponer, y eso es un costo real.

**¿Por qué no se automatiza la confirmación de las reglas?**
Porque sería incorrecto, no porque sea difícil. Una dependencia funcional es una propiedad del
esquema; los datos solo pueden refutarla. Confirmar automáticamente sería afirmar que la
muestra es el universo. La herramienta aporta la evidencia *en contra*; el conocimiento del
dominio lo aporta la persona.

**¿Y si la tabla tiene millones de filas?**
El detector es sensible al número de columnas, no tanto al de filas: el espacio de candidatos
es 2^N en columnas y se acota a determinantes de 2, lo que deja 210 candidatos para una tabla
de 20 columnas. Las filas se recorren una vez por candidato. El límite duro hoy es el tamaño
del archivo subido, no el algoritmo.

**¿Cómo sabe que la descomposición es correcta?**
Hay tres respuestas y conviene dar las tres. Una: un *answer key* resuelto a mano con el que se
compara el resultado (6 tablas con conteos exactos 56/8/10/5/3/4). Dos: 500 pruebas
automáticas. Tres: un recorrido en un Chrome real que hace clic por toda la aplicación y
verifica el resultado en pantalla.

**¿Ejecuta el SQL que uno sube?**
No. Lo **parsea** con sqlglot, que construye un árbol sintáctico sin ejecutar nada. Es una
diferencia de seguridad importante: una versión anterior del proyecto sí ejecutaba el archivo
contra una base, y se eliminó por eso.

**¿Por qué dos lenguajes? ¿No era más simple uno solo?**
Porque `sqlglot` lee cuatro dialectos de SQL y no hay equivalente en JavaScript. La alternativa
era escribir un parser de SQL, que es un proyecto en sí mismo. Las dos piezas conviven en el
mismo despliegue, así que el costo operativo es cero: no hay segundo servidor ni CORS.

**¿Qué pasa si el archivo no trae datos, solo el `CREATE TABLE`?**
Funciona igual, y esa es una de las partes más interesantes. El motor nunca lee una fila: las
dependencias que el esquema declara (clave primaria, claves únicas, claves foráneas) se ofrecen
para confirmar, y las que faltan se declaran a mano. Sin datos se pierde la capacidad de
*sugerir*, no la de normalizar.

**¿Qué fue lo que más costó?**
Respuesta honesta y buena: distinguir una dependencia real de una coincidencia estadística. Con
pocas filas cualquier par de columnas parece relacionado. La solución no fue un umbral inventado
sino medir tres archivos reales y encontrar el hueco entre las legítimas (17, 22 y 4
oportunidades de refutación) y las coincidencias (1 y 2).

---

## 12. Lo que NO hace

Decir esto **suma**. Un alcance conocido se defiende; uno que se descubre durante las
preguntas, no.

- **No pasa de 3FN.** No implementa BCNF, 4FN ni 5FN.
- **No normaliza el archivo entero de una pasada.** Diagnostica todas las tablas, pero
  normaliza una por vez. Falta resolver qué hacer cuando dos tablas extraen la misma entidad.
- **No detecta fórmulas de tres o más operandos** ni concatenación de texto
  (`nombre + apellido`).
- **No adivina el significado del negocio.** Propone; la persona decide. Es una limitación
  deliberada, no una pendiente.
- **El archivo tiene un tope de tamaño** impuesto por la plataforma (4,5 MB en el borde de
  Vercel), y el cliente lo valida antes de enviar.

---

**Antes de exponer:** correr la aplicación una vez de punta a punta y sacar capturas de cada
paso. Si el wifi del aula falla, esas capturas son la demo.
