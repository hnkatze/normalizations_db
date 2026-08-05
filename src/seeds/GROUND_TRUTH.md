# Verdad de referencia de `ventas_raw`

**Este es el solucionario.** La semilla `ventas_raw` no se muestreó de ninguna parte: se
diseñó en sentido inverso a partir de la lista de dependencias que aparece más abajo, de
modo que una persona pueda distinguir un detector correcto de uno que alucina. Si la salida
de la detección contradice este documento, el detector está equivocado mientras no se
demuestre lo contrario.

Tres archivos contienen el mismo conjunto de datos y nunca deben divergir:

| Archivo | Función |
| --- | --- |
| `src/seeds/ventasRawFixture.ts` | Fuente de verdad. Las filas se obtienen uniendo las tablas de entidades, de modo que las dependencias son verdaderas por construcción. |
| `src/seeds/seed_ventas_raw.sql` | Generado a partir del fixture. Se carga en el esquema `staging`. |
| `src/seeds/GROUND_TRUTH.md` | Este documento. El solucionario en prosa. |

---

## Ruta rápida: cómo calificar un detector

1. Ejecute la detección sobre `ventas_raw` con clave primaria `(venta_id, producto_id)`.
2. Debe aparecer cada fila de [El solucionario](#el-solucionario). Una fila ausente es un
   **falso negativo** y constituye un defecto.
3. Toda dependencia adicional debe aparecer en [Ruido esperado](#ruido-esperado-verdaderas-pero-no-son-la-respuesta).
   Esas son verdaderas en los datos; informarlas es comportamiento correcto, no un error.
4. Cualquier cosa fuera de ambas listas es un **falso positivo**. No debería haber ninguno: con
   determinantes de tamaño 1, se cumplen exactamente 38 dependencias en estos datos, y las 38 están listadas más abajo.
5. Entregue las dependencias confirmadas al normalizador y compare el resultado con
   [La descomposición 3FN esperada](#la-descomposición-3fn-esperada).

---

## La tabla

`ventas_raw` es una única tabla plana de ventas con **grano de línea de detalle**: una fila por producto de una venta.

- Clave primaria: `(venta_id, producto_id)` — compuesta, que es lo que hace posibles las
  violaciones de 2FN.
- **56 filas**, construidas a partir de 8 ventas, 10 productos, 5 clientes, 3 ciudades y 4 categorias.
- Toda columna es `NOT NULL`. La nulabilidad queda deliberadamente fuera del ejercicio.

El volumen se eligió, no se adivinó. Con muy pocas filas, cada columna casi única parece
determinar a todas las demás, y el detector se ahoga en accidentes de la muestra. Cada
determinante de esta tabla lleva asociado un grupo repetido grande:

| Columna | Valores distintos | Grupo más grande |
| --- | ---: | ---: |
| `venta_id` | 8 | 7 |
| `fecha_venta` | 7 | 14 |
| `cliente_id` | 5 | 14 |
| `cliente_nombre` | 5 | 14 |
| `cliente_email` | 5 | 14 |
| `cliente_ciudad_id` | 3 | 28 |
| `cliente_ciudad_nombre` | 3 | 28 |
| `cliente_ciudad_pais` | 2 | 49 |
| `producto_id` | 10 | 7 |
| `producto_nombre` | 10 | 7 |
| `producto_precio` | 9 | 11 |
| `categoria_id` | 4 | 18 |
| `categoria_nombre` | 4 | 18 |
| `cantidad` | 5 | 19 |
| `subtotal` | 36 | 4 |

**Ninguna columna es completamente única.** El menor de los grupos más grandes es 4
(`subtotal`). Ningún determinante *de una sola columna* es vacuo en el sentido de
`isVacuous`: toda dependencia informada a partir de una sola columna tuvo una oportunidad
real de ser contradicha por los datos y no lo fue.

**La clave compuesta es la excepción, y no es un defecto.** `(venta_id, producto_id)` es la
clave primaria, así que es única por definición: los 56 grupos que genera contienen
exactamente una fila cada uno. Por lo tanto, ambas dependencias completas informan
`maxGroupSize: 1` e `isVacuous` devuelve verdadero para ellas. Verificado, no teorizado.

Eso tiene consecuencias aguas abajo. Una interfaz de revisión que atenúe, ordene al final o
descarte automáticamente basándose solo en `isVacuous` descartaría
`(venta_id, producto_id) -> cantidad` y `-> subtotal`, es decir, las dos dependencias que
definen la tabla de hechos y que deben conservarse. La vacuidad es evidencia de ruido
únicamente cuando el determinante **no** es la clave.

---

## El solucionario

13 dependencias. Estas son el diseño; el detector debe encontrarlas todas.

### Parciales — violaciones de 2FN

Un **subconjunto propio** de la clave compuesta determina el atributo. La 2FN existe para extraerlas.

| Dependencia | Por qué es una violación |
| --- | --- |
| `venta_id -> fecha_venta` | La fecha pertenece a la venta, no a la línea de venta. Se repite una vez por cada producto de la venta. |
| `venta_id -> cliente_id` | Lo mismo: el cliente es una propiedad de la venta. |
| `producto_id -> producto_nombre` | El nombre pertenece al producto, no a esta línea de esta venta. |
| `producto_id -> producto_precio` | Lo mismo para el precio unitario. |
| `producto_id -> categoria_id` | Lo mismo para la categoría en la que se ubica el producto. |

### Transitivas — violaciones de 3FN

Un **atributo no clave** determina otro atributo no clave. La 3FN existe para extraerlas.

| Dependencia | Por qué es una violación |
| --- | --- |
| `cliente_id -> cliente_nombre` | `cliente_id` no es clave de esta tabla y, aun así, fija el nombre. |
| `cliente_id -> cliente_email` | Lo mismo. |
| `cliente_id -> cliente_ciudad_id` | Lo mismo, y esta además abre el tercer nivel de la cadena. |
| `cliente_ciudad_id -> cliente_ciudad_nombre` | El nombre de la ciudad es una propiedad de la ciudad, a dos saltos de la clave. |
| `cliente_ciudad_id -> cliente_ciudad_pais` | Lo mismo para el país. |
| `categoria_id -> categoria_nombre` | El nombre de la categoría es una propiedad de la categoría. |

**La cadena de tres niveles es el caso más interesante del conjunto de datos:**

```
venta_id ──> cliente_id ──> cliente_ciudad_id ──> cliente_ciudad_pais
   (parcial)    (transitiva)      (transitiva)
```

Un detector que colapse esto a `venta_id -> cliente_ciudad_pais` y se detenga ahí ha perdido
la estructura: normalizar esa vista aplanada produce una tabla `ventas` con una columna de país
dentro. La cadena debe sobrevivir como tres flechas separadas para que la descomposición pueda
ubicar `ciudades`, `clientes` y `ventas` en tres tablas distintas.

### Completas — permanecen en su lugar, y es correcto

Se requiere la clave compuesta **completa**. Estas son las únicas medidas verdaderas de la
tabla de hechos y permanecen en ella.

| Dependencia | Nota |
| --- | --- |
| `(venta_id, producto_id) -> cantidad` | Verificado: ni `venta_id` por sí solo ni `producto_id` por sí solo la determinan. |
| `(venta_id, producto_id) -> subtotal` | Lo mismo. Véase más abajo la salvedad sobre el atributo derivado. |

`cantidad` varía dentro de cada venta *y* entre todos los productos de forma deliberada. Si las
cantidades hubieran sido uniformes, `producto_id -> cantidad` se cumpliría por accidente y la
tabla de hechos se descompondría hasta no quedar nada de ella.

---

## Ruido esperado: verdaderas, pero no son la respuesta

Estas dependencias **se cumplen realmente** en las 56 filas. Un detector correcto las informa.
No las califique como errores, pero tampoco las confirme en el normalizador, porque varias
producirían una descomposición incorrecta.

### Cierre (8)

Implicadas por transitividad sobre el solucionario. `venta_id -> cliente_id` y
`cliente_id -> cliente_email` juntas fuerzan `venta_id -> cliente_email`.

`venta_id -> cliente_nombre` · `venta_id -> cliente_email` · `venta_id -> cliente_ciudad_id` ·
`venta_id -> cliente_ciudad_nombre` · `venta_id -> cliente_ciudad_pais` ·
`cliente_id -> cliente_ciudad_nombre` · `cliente_id -> cliente_ciudad_pais` ·
`producto_id -> categoria_nombre`

> Confirmarlas en el normalizador es el error clásico: aplana la cadena y devuelve las
> columnas de ciudad y país a `ventas`.

### Inversas (17)

El lado derecho es una **clave candidata** de su entidad —los nombres y los correos resultan
ser únicos—, de modo que la flecha también apunta de vuelta al id.

| Determinante | Determina |
| --- | --- |
| `cliente_nombre` | `cliente_id`, `cliente_email`, `cliente_ciudad_id`, `cliente_ciudad_nombre`, `cliente_ciudad_pais` |
| `cliente_email` | `cliente_id`, `cliente_nombre`, `cliente_ciudad_id`, `cliente_ciudad_nombre`, `cliente_ciudad_pais` |
| `cliente_ciudad_nombre` | `cliente_ciudad_id`, `cliente_ciudad_pais` |
| `producto_nombre` | `producto_id`, `producto_precio`, `categoria_id`, `categoria_nombre` |
| `categoria_nombre` | `categoria_id` |

> Estas son claves alternativas reales, no artefactos. Elegir `cliente_nombre` como
> determinante seguiría normalizando correctamente; simplemente daría a la tabla `clientes`
> una clave basada en un nombre. El id subrogado es la mejor opción, y esa elección le
> corresponde al usuario, no al detector.

### Derivadas (2)

`subtotal -> cantidad` · `subtotal -> producto_precio`

Véase la sección siguiente.

---

## Atributo derivado: `subtotal`

**`subtotal = cantidad * producto_precio`, exactamente, para las 56 filas.** Esto es intencional
y tiene consecuencias que parecen errores del detector, pero no lo son.

| Efecto | Explicación |
| --- | --- |
| Se informan `subtotal -> cantidad` y `subtotal -> producto_precio` | Con solo 9 precios distintos, un subtotal dado casi siempre puede factorizarse de una única manera. Esto no dice nada sobre el negocio; es aritmética. |
| `subtotal` tiene 36 valores distintos sobre 56 filas | Su grupo más grande es 4. Es lo más parecido a una columna casi única que hay aquí, y las columnas casi únicas parecen determinar cosas. |
| Confirmar cualquiera de las dos dependencias corrompe el esquema | Trasladaría `cantidad` a una tabla cuya clave fuera `subtotal`. |

**El manejo correcto es dejar `subtotal` en la tabla de hechos**, con la clave compuesta
completa, y reconocer que un diseño estrictamente normalizado no lo almacenaría en absoluto:
lo calcularía. La semilla lo almacena porque las tablas desnormalizadas reales lo almacenan, y
el detector tiene que ser capaz de lidiar con eso.

Se diseñaron dos colisiones específicamente para impedir que esto empeore:

- **El `producto_precio` 45.50 es compartido por `Te verde 20 sobres` (102) y `Yogurt natural 1L`
  (108).** Sin esa colisión, los 10 precios serían distintos y `producto_precio` parecería
  determinar el nombre del producto, la categoría y todo lo que sigue. No determina nada.
- **La `fecha_venta` 2024-03-11 es compartida por las ventas 3 y 4**, cuyos clientes residen en
  ciudades distintas *y* en países distintos. La fecha compartida elimina `fecha_venta -> venta_id`
  y `fecha_venta -> cliente_id`; las ciudades contrastantes eliminan la coincidencia
  `fecha_venta -> cliente_ciudad_*`.

---

## La descomposición 3FN esperada

Seis tablas. Léase de arriba abajo: cada una depende únicamente de las tablas que la preceden.

### 1. `ciudades` — 3 filas

| | |
| --- | --- |
| Clave primaria | `ciudad_id` |
| Columnas | `ciudad_id`, `ciudad_nombre`, `ciudad_pais` |
| Claves foráneas | ninguna |
| Procedente de | `cliente_ciudad_id`, `cliente_ciudad_nombre`, `cliente_ciudad_pais` |
| Justificada por | `cliente_ciudad_id -> cliente_ciudad_nombre`, `cliente_ciudad_id -> cliente_ciudad_pais` |

### 2. `categorias` — 4 filas

| | |
| --- | --- |
| Clave primaria | `categoria_id` |
| Columnas | `categoria_id`, `categoria_nombre` |
| Claves foráneas | ninguna |
| Procedente de | `categoria_id`, `categoria_nombre` |
| Justificada por | `categoria_id -> categoria_nombre` |

### 3. `clientes` — 5 filas

| | |
| --- | --- |
| Clave primaria | `cliente_id` |
| Columnas | `cliente_id`, `cliente_nombre`, `cliente_email`, `cliente_ciudad_id` |
| Claves foráneas | `cliente_ciudad_id` → `ciudades(ciudad_id)` |
| Procedente de | `cliente_id`, `cliente_nombre`, `cliente_email`, `cliente_ciudad_id` |
| Justificada por | `cliente_id -> cliente_nombre`, `cliente_id -> cliente_email`, `cliente_id -> cliente_ciudad_id` |

### 4. `productos` — 10 filas

| | |
| --- | --- |
| Clave primaria | `producto_id` |
| Columnas | `producto_id`, `producto_nombre`, `producto_precio`, `categoria_id` |
| Claves foráneas | `categoria_id` → `categorias(categoria_id)` |
| Procedente de | `producto_id`, `producto_nombre`, `producto_precio`, `categoria_id` |
| Justificada por | `producto_id -> producto_nombre`, `producto_id -> producto_precio`, `producto_id -> categoria_id` |

### 5. `ventas` — 8 filas

| | |
| --- | --- |
| Clave primaria | `venta_id` |
| Columnas | `venta_id`, `fecha_venta`, `cliente_id` |
| Claves foráneas | `cliente_id` → `clientes(cliente_id)` |
| Procedente de | `venta_id`, `fecha_venta`, `cliente_id` |
| Justificada por | `venta_id -> fecha_venta`, `venta_id -> cliente_id` |

### 6. `ventas_detalle` — 56 filas (la tabla de hechos)

| | |
| --- | --- |
| Clave primaria | `(venta_id, producto_id)` — compuesta |
| Columnas | `venta_id`, `producto_id`, `cantidad`, `subtotal` |
| Claves foráneas | `venta_id` → `ventas(venta_id)`, `producto_id` → `productos(producto_id)` |
| Procedente de | `venta_id`, `producto_id`, `cantidad`, `subtotal` |
| Justificada por | Nada menor que la clave completa determina `cantidad` ni `subtotal`. |

### Por qué importa el orden

La 2FN y la 3FN hacen cada una la mitad de este trabajo, y la división se aprecia en el resultado:

| Paso | Produce | Impulsado por |
| --- | --- | --- |
| 2FN | `ventas`, `productos`, `ventas_detalle` | Las cinco dependencias parciales. |
| 3FN | `clientes` (a partir de `ventas`), `ciudades` (a partir de `clientes`), `categorias` (a partir de `productos`) | Las seis dependencias transitivas. |

`ciudades` solo es alcanzable en la segunda pasada, porque `cliente_ciudad_id` no se convierte
en atributo no clave de una tabla más pequeña hasta que existe `clientes`. Eso es la cadena
cumpliendo su función.

### Comprobación del recuento de filas

La descomposición es sin pérdida: `56 = 56`. Volver a unir las seis tablas debe reproducir
`ventas_raw` exactamente, 56 filas, sin duplicados y sin pérdidas.

| Tabla | Filas |
| --- | ---: |
| `ciudades` | 3 |
| `categorias` | 4 |
| `clientes` | 5 |
| `productos` | 10 |
| `ventas` | 8 |
| `ventas_detalle` | 56 |

La ganancia en almacenamiento es el objetivo: `cliente_email` se escribe 5 veces en lugar de 56,
y `cliente_ciudad_pais` 3 veces en lugar de 56.

---

## Lista de verificación para calificar

- [ ] Se detectaron las 5 dependencias parciales.
- [ ] Se detectaron las 6 dependencias transitivas.
- [ ] Se detectaron ambas dependencias completas sobre la clave compuesta.
- [ ] La cadena `venta_id -> cliente_id -> cliente_ciudad_id -> cliente_ciudad_pais` sobrevive como
      tres flechas separadas, no como una sola flecha colapsada.
- [ ] No se informó ninguna dependencia fuera del solucionario + el ruido esperado (38 en total con determinantes de tamaño 1).
- [ ] Nada quedó marcado como vacuo: ningún determinante de esta tabla es completamente único.
- [ ] La descomposición produce exactamente las seis tablas anteriores, con esas claves y esas claves foráneas.
- [ ] `subtotal` permaneció en `ventas_detalle`; nada quedó con clave basada en él.
- [ ] Volver a unir las seis tablas reproduce las 56 filas originales.

---

## Mantenimiento

Edite `ventasRawFixture.ts` y regenere el SQL; nunca edite `seed_ventas_raw.sql` a mano.
El fixture construye las filas uniendo objetos de entidad en lugar de repetir valores, de modo
que una errata en un `cliente_nombre` repetido no es expresable. Esa propiedad es la razón por
la que se puede confiar en el solucionario.

Si cambia los datos, vuelva a derivar este documento. Un solucionario desactualizado es peor que
no tener ninguno: reprueba a los detectores correctos y aprueba a los defectuosos.

`ventasRawFixture.ts` también exporta las dos listas anteriores como datos (`expectedDependencies`
y `expectedIncidentalDependencies`) para que las pruebas se validen directamente contra ellas y no
contra la prosa.

### Nota sobre la representación en el fixture

El fixture modela `numeric(10,2)` como un `number` de JavaScript. El controlador `pg` devuelve
`numeric` como **cadena de texto** de forma predeterminada, así que el adaptador de ingesta debe
convertirlo, o la detección sobre la base de datos real comparará `"85.00"` donde el fixture
compara `85`. La detección de dependencias funcionales basada en igualdad da la misma respuesta en
cualquier caso; cualquier cosa que haga aritmética, no.
