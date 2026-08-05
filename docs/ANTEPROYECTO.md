# Normalizador SQL — Anteproyecto

Propuesta de lo que se va a construir, cómo, y con qué criterio se va a calificar.

---

## Qué vamos a construir

Una herramienta web que **reciba una tabla plana sin normalizar en un archivo `.sql`**,
descubra las dependencias funcionales que esconden sus datos y proponga la descomposición a
**tercera forma normal**: las tablas resultantes, sus claves y el DDL.

No es un CRUD sobre una base ya diseñada a mano. **Es la herramienta que hace el trabajo de
normalización**, sobre cualquier conjunto de datos que llegue como una sola tabla plana.

---

## Cómo pensamos hacerlo

```text
1. Se sube un .sql con una tabla plana
        ↓
2. El script se ejecuta contra un esquema `staging` en PostgreSQL
        ↓
3. Se lee la estructura por `information_schema` y los datos por SELECT
        ↓
4. El motor de detección busca dependencias funcionales en los datos
        ↓
5. La persona confirma cuáles son reales
        ↓
6. El motor de normalización descompone a 3FN y genera el DDL
```

### PostgreSQL es el parser

El `.sql` **no se va a analizar con código propio**. Se ejecuta contra un esquema temporal y
después se lee su estructura del catálogo del motor.

Escribir un analizador de SQL a mano significa aceptar para siempre el subconjunto de SQL que
ese analizador entienda. Postgres, en cambio, *es* la definición de SQL válido.

Esa decisión tiene una consecuencia que se asume de forma deliberada: la aplicación va a
ejecutar SQL arbitrario subido por el usuario. Por eso la conexión debe usar un rol de
**privilegio mínimo**, limitado al esquema `staging`. Con un superusuario, subir un archivo
equivale a control total de la base.

---

## El riesgo que ya está identificado

Un detector que observa datos va a encontrar **muchas más dependencias de las que son
reales**. Las de más no van a ser errores del detector: van a ser verdaderas en esos datos.
Pero confirmarlas produce un esquema equivocado.

Un ejemplo del tipo de trampa que hay que sobrevivir. Si en la tabla se cumple esta cadena:

```text
venta_id ──> cliente_id ──> cliente_ciudad_id ──> cliente_ciudad_pais
   (parcial)    (transitiva)      (transitiva)
```

entonces `venta_id -> cliente_ciudad_pais` **también se cumple**, por transitividad. Es cierta.
Y confirmarla aplana la cadena: devuelve la columna de país a la tabla de ventas y hace
desaparecer la tabla de ciudades. La cadena tiene que sobrevivir como flechas separadas para
que la descomposición pueda ubicar cada entidad en su propia tabla.

Por eso el diseño **no** va a ser «el sistema normaliza solo». Va a ser:

> El motor propone cada dependencia junto con la evidencia que la respalda —cuántos grupos,
> cuántas filas, qué tan grande es el grupo mayor— y la persona confirma cuáles son reales.

**Ninguna candidata va a venir marcada de antemano.** Una casilla premarcada en la dependencia
equivocada es exactamente el error que esta herramienta existe para evitar.

### El costo computacional

El espacio de determinantes candidatos es el **conjunto potencia** de las columnas: `2^N`. Con
20 columnas son más de un millón de candidatos, cada uno con un recorrido completo de las filas.

Se va a acotar con un tope al ancho del determinante y con la poda de los no mínimos: si
`A -> Y` ya se cumple, `{A,X} -> Y` no aporta información. Ambos límites **se van a reportar en
el resultado** en lugar de aplicarse en silencio. Un resultado que ocultara cuánto del espacio
quedó sin explorar se leería como «estas son todas las dependencias» cuando no lo son.

---

## Cómo vamos a saber si funciona

**Antes de escribir el detector se construye el conjunto de datos de prueba.** Y se diseña al
revés: partiendo de la lista de dependencias que debe contener, de modo que las dependencias
sean verdaderas por construcción.

Ese archivo no va a ser un ejemplo. Va a ser el **solucionario**. Si la salida de la detección
lo contradice, el detector está equivocado mientras no se demuestre lo contrario.

El criterio de calificación queda fijado desde el primer día:

| Resultado del detector | Veredicto |
| --- | --- |
| Falta una dependencia del solucionario | Falso negativo. Es un defecto. |
| Informa una dependencia verdadera que no es parte del diseño | Correcto. Es ruido esperado, no un error. |
| Informa algo que no se cumple en los datos | Falso positivo. Es un defecto. |
| La descomposición no reproduce las tablas esperadas | Defecto del normalizador, no del detector. |

Además, volver a unir las tablas resultantes debe reproducir la tabla original **exactamente**:
mismo número de filas, sin duplicados y sin pérdidas. Una descomposición que no cumple eso no
es una normalización.

Tener este criterio desde el día dos es lo que permite saber que el detector falla **mientras
se construye**, y no al final.

---

## Alcance

| Vamos a hacer | No vamos a hacer |
| --- | --- |
| Entrada `.sql`, una tabla plana por vez | Excel, CSV, múltiples tablas |
| Detección de dependencias funcionales | Confirmación automática de candidatas |
| Revisión humana con evidencia por dependencia | — |
| Descomposición hasta **3FN** | FNBC, 4FN, 5FN |
| Generación del DDL | **Ejecutar** ese DDL y migrar los datos |
| — | Diagrama ER y explorador de datos normalizados |

La herramienta va a generar el DDL. **Aplicarlo queda fuera de estas dos semanas.**
