# Ground truth for `ventas_raw`

**This is the answer key.** The `ventas_raw` seed was not sampled from anywhere — it was
designed backwards from the dependency list below, so a human can tell a correct detector
from a hallucinating one. If detection output disagrees with this document, the detector is
wrong until proven otherwise.

Three files hold the same dataset and must never diverge:

| File | Role |
| --- | --- |
| `src/seeds/ventasRawFixture.ts` | Source of truth. Rows are joined from entity tables, so the dependencies are true by construction. |
| `src/seeds/seed_ventas_raw.sql` | Generated from the fixture. Loads into the `staging` schema. |
| `src/seeds/GROUND_TRUTH.md` | This document. The prose answer key. |

---

## Quick path: how to grade a detector

1. Run detection over `ventas_raw` with primary key `(venta_id, producto_id)`.
2. Every row of [The answer key](#the-answer-key) must appear. A missing one is a **false
   negative** and a defect.
3. Every extra dependency must appear in [Expected noise](#expected-noise-true-but-not-the-answer).
   Those are true in the data; reporting them is correct behavior, not a bug.
4. Anything outside both lists is a **false positive**. There should be none: at determinant
   size 1, exactly 38 dependencies hold in this data, and all 38 are listed below.
5. Feed the confirmed dependencies to the normalizer and compare against
   [The expected 3NF decomposition](#the-expected-3nf-decomposition).

---

## The table

`ventas_raw` is one flat sales table at **line-item grain**: one row per product of a sale.

- Primary key: `(venta_id, producto_id)` — composite, which is what makes 2NF violations
  possible at all.
- **56 rows**, built from 8 ventas, 10 productos, 5 clientes, 3 ciudades, 4 categorias.
- Every column is `NOT NULL`. Nullability is deliberately not part of the exercise.

Volume was chosen, not guessed. With too few rows every near-unique column appears to
determine every other column, and the detector drowns in accidents of the sample. Each
determinant here carries a large repeated group:

| Column | Distinct values | Largest group |
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

**No column is all-unique.** The smallest largest-group is 4 (`subtotal`). No
*single-column* determinant is vacuous in the sense of `isVacuous` — every dependency
reported off one column had a real chance to be contradicted by the data and was not.

**The composite key is the exception, and it is not a defect.** `(venta_id, producto_id)`
is the primary key, so it is unique by definition: all 56 of its groups hold exactly one
row. Both full dependencies therefore report `maxGroupSize: 1` and `isVacuous` returns
true for them. Verified, not theorised.

That matters downstream. A review UI that dims, sorts down, or auto-discards on
`isVacuous` alone would discard `(venta_id, producto_id) -> cantidad` and `-> subtotal`
— the two dependencies that define the fact table and must be kept. Vacuity is evidence
of noise only when the determinant is **not** the key.

---

## The answer key

13 dependencies. These are the design; the detector must find all of them.

### Partial — 2NF violations

A **proper subset** of the composite key determines the attribute. 2NF exists to move these out.

| Dependency | Why it is a violation |
| --- | --- |
| `venta_id -> fecha_venta` | The date belongs to the sale, not to the sale line. Repeated once per product on the sale. |
| `venta_id -> cliente_id` | Same: the customer is a property of the sale. |
| `producto_id -> producto_nombre` | The name belongs to the product, not to this line of this sale. |
| `producto_id -> producto_precio` | Same for the unit price. |
| `producto_id -> categoria_id` | Same for the category the product sits in. |

### Transitive — 3NF violations

A **non-key attribute** determines another non-key attribute. 3NF exists to move these out.

| Dependency | Why it is a violation |
| --- | --- |
| `cliente_id -> cliente_nombre` | `cliente_id` is not a key of this table, yet it fixes the name. |
| `cliente_id -> cliente_email` | Same. |
| `cliente_id -> cliente_ciudad_id` | Same — and this one opens the third level of the chain. |
| `cliente_ciudad_id -> cliente_ciudad_nombre` | The city name is a property of the city, two hops from the key. |
| `cliente_ciudad_id -> cliente_ciudad_pais` | Same for the country. |
| `categoria_id -> categoria_nombre` | The category name is a property of the category. |

**The three-level chain is the most interesting case in the dataset:**

```
venta_id ──> cliente_id ──> cliente_ciudad_id ──> cliente_ciudad_pais
   (partial)    (transitive)      (transitive)
```

A detector that collapses this to `venta_id -> cliente_ciudad_pais` and stops has lost the
structure: normalizing that flat view produces a `ventas` table with a country column in it.
The chain must survive as three separate arrows so the decomposition can place `ciudades`,
`clientes`, and `ventas` in three separate tables.

### Full — correctly stays put

The **whole** composite key is required. These are the only true measures of the fact table
and they stay in it.

| Dependency | Note |
| --- | --- |
| `(venta_id, producto_id) -> cantidad` | Verified: neither `venta_id` alone nor `producto_id` alone determines it. |
| `(venta_id, producto_id) -> subtotal` | Same. See the derived-attribute caveat below. |

`cantidad` varies within every venta *and* across every producto on purpose. Had quantities
been uniform, `producto_id -> cantidad` would hold by accident and the fact table would
decompose away to nothing.

---

## Expected noise: true, but not the answer

These dependencies **genuinely hold** in the 56 rows. A correct detector reports them.
Do not grade them as errors — but do not confirm them into the normalizer either, because
several would produce a wrong decomposition.

### Closure (8)

Implied by transitivity over the answer key. `venta_id -> cliente_id` and
`cliente_id -> cliente_email` together force `venta_id -> cliente_email`.

`venta_id -> cliente_nombre` · `venta_id -> cliente_email` · `venta_id -> cliente_ciudad_id` ·
`venta_id -> cliente_ciudad_nombre` · `venta_id -> cliente_ciudad_pais` ·
`cliente_id -> cliente_ciudad_nombre` · `cliente_id -> cliente_ciudad_pais` ·
`producto_id -> categoria_nombre`

> Confirming these into the normalizer is the classic mistake: it flattens the chain and
> puts city and country columns back onto `ventas`.

### Inverse (17)

The right-hand side is a **candidate key** of its entity — names and emails happen to be
unique — so the arrow also points back at the id.

| Determinant | Determines |
| --- | --- |
| `cliente_nombre` | `cliente_id`, `cliente_email`, `cliente_ciudad_id`, `cliente_ciudad_nombre`, `cliente_ciudad_pais` |
| `cliente_email` | `cliente_id`, `cliente_nombre`, `cliente_ciudad_id`, `cliente_ciudad_nombre`, `cliente_ciudad_pais` |
| `cliente_ciudad_nombre` | `cliente_ciudad_id`, `cliente_ciudad_pais` |
| `producto_nombre` | `producto_id`, `producto_precio`, `categoria_id`, `categoria_nombre` |
| `categoria_nombre` | `categoria_id` |

> These are real alternate keys, not artifacts. Choosing `cliente_nombre` as the determinant
> would still normalize correctly — it would just key the `clientes` table on a name. The
> surrogate id is the better choice, and that choice belongs to the user, not the detector.

### Derived (2)

`subtotal -> cantidad` · `subtotal -> producto_precio`

See the next section.

---

## Derived attribute: `subtotal`

**`subtotal = cantidad * producto_precio`, exactly, for all 56 rows.** This is intentional and
it has consequences that read like detector bugs but are not.

| Effect | Explanation |
| --- | --- |
| `subtotal -> cantidad` and `subtotal -> producto_precio` are reported | With only 9 distinct prices, a given subtotal can almost always be factored one way. This says nothing about the business; it is arithmetic. |
| `subtotal` has 36 distinct values over 56 rows | Its largest group is 4. It is the closest thing here to a near-unique column, and near-unique columns appear to determine things. |
| Confirming either dependency corrupts the schema | It would move `cantidad` into a table keyed on `subtotal`. |

**The correct handling is to leave `subtotal` in the fact table**, keyed on the full composite
key, and to recognize that a strictly normalized design would not store it at all — it would
compute it. The seed stores it because real denormalized tables store it, and the detector has
to cope with that.

Two collisions were engineered specifically to stop this from getting worse:

- **`producto_precio` 45.50 is shared by `Te verde 20 sobres` (102) and `Yogurt natural 1L`
  (108).** Without it, all 10 prices would be distinct and `producto_precio` would appear to
  determine the product name, the category, and everything downstream. It determines nothing.
- **`fecha_venta` 2024-03-11 is shared by ventas 3 and 4**, whose clientes sit in different
  ciudades *and* different paises. The shared date kills `fecha_venta -> venta_id` and
  `fecha_venta -> cliente_id`; the contrasting cities kill the coincidental
  `fecha_venta -> cliente_ciudad_*`.

---

## The expected 3NF decomposition

Six tables. Read top-down: each one depends only on the tables above it.

### 1. `ciudades` — 3 rows

| | |
| --- | --- |
| Primary key | `ciudad_id` |
| Columns | `ciudad_id`, `ciudad_nombre`, `ciudad_pais` |
| Foreign keys | none |
| From | `cliente_ciudad_id`, `cliente_ciudad_nombre`, `cliente_ciudad_pais` |
| Justified by | `cliente_ciudad_id -> cliente_ciudad_nombre`, `cliente_ciudad_id -> cliente_ciudad_pais` |

### 2. `categorias` — 4 rows

| | |
| --- | --- |
| Primary key | `categoria_id` |
| Columns | `categoria_id`, `categoria_nombre` |
| Foreign keys | none |
| From | `categoria_id`, `categoria_nombre` |
| Justified by | `categoria_id -> categoria_nombre` |

### 3. `clientes` — 5 rows

| | |
| --- | --- |
| Primary key | `cliente_id` |
| Columns | `cliente_id`, `cliente_nombre`, `cliente_email`, `cliente_ciudad_id` |
| Foreign keys | `cliente_ciudad_id` → `ciudades(ciudad_id)` |
| From | `cliente_id`, `cliente_nombre`, `cliente_email`, `cliente_ciudad_id` |
| Justified by | `cliente_id -> cliente_nombre`, `cliente_id -> cliente_email`, `cliente_id -> cliente_ciudad_id` |

### 4. `productos` — 10 rows

| | |
| --- | --- |
| Primary key | `producto_id` |
| Columns | `producto_id`, `producto_nombre`, `producto_precio`, `categoria_id` |
| Foreign keys | `categoria_id` → `categorias(categoria_id)` |
| From | `producto_id`, `producto_nombre`, `producto_precio`, `categoria_id` |
| Justified by | `producto_id -> producto_nombre`, `producto_id -> producto_precio`, `producto_id -> categoria_id` |

### 5. `ventas` — 8 rows

| | |
| --- | --- |
| Primary key | `venta_id` |
| Columns | `venta_id`, `fecha_venta`, `cliente_id` |
| Foreign keys | `cliente_id` → `clientes(cliente_id)` |
| From | `venta_id`, `fecha_venta`, `cliente_id` |
| Justified by | `venta_id -> fecha_venta`, `venta_id -> cliente_id` |

### 6. `ventas_detalle` — 56 rows (the fact table)

| | |
| --- | --- |
| Primary key | `(venta_id, producto_id)` — composite |
| Columns | `venta_id`, `producto_id`, `cantidad`, `subtotal` |
| Foreign keys | `venta_id` → `ventas(venta_id)`, `producto_id` → `productos(producto_id)` |
| From | `venta_id`, `producto_id`, `cantidad`, `subtotal` |
| Justified by | Nothing smaller than the full key determines `cantidad` or `subtotal`. |

### Why the order matters

2NF and 3NF each do one half of this work, and the split is visible in the result:

| Step | Produces | Driven by |
| --- | --- | --- |
| 2NF | `ventas`, `productos`, `ventas_detalle` | The five partial dependencies. |
| 3NF | `clientes` (out of `ventas`), `ciudades` (out of `clientes`), `categorias` (out of `productos`) | The six transitive dependencies. |

`ciudades` is only reachable in the second pass, because `cliente_ciudad_id` does not become a
non-key attribute of a smaller table until `clientes` exists. That is the chain doing its job.

### Row-count check

The decomposition is lossless: `56 = 56`. Joining all six tables back must reproduce
`ventas_raw` exactly, 56 rows, no duplicates and no drops.

| Table | Rows |
| --- | ---: |
| `ciudades` | 3 |
| `categorias` | 4 |
| `clientes` | 5 |
| `productos` | 10 |
| `ventas` | 8 |
| `ventas_detalle` | 56 |

The storage win is the point: `cliente_email` is written 5 times instead of 56, and
`cliente_ciudad_pais` 3 times instead of 56.

---

## Grading checklist

- [ ] All 5 partial dependencies detected.
- [ ] All 6 transitive dependencies detected.
- [ ] Both full dependencies detected on the composite key.
- [ ] The chain `venta_id -> cliente_id -> cliente_ciudad_id -> cliente_ciudad_pais` survives as
      three separate arrows, not one collapsed arrow.
- [ ] No dependency reported outside the answer key + expected noise (38 total at determinant size 1).
- [ ] Nothing flagged vacuous — no determinant in this table is all-unique.
- [ ] Decomposition yields exactly the six tables above, with those keys and those foreign keys.
- [ ] `subtotal` stayed in `ventas_detalle`; nothing was keyed on it.
- [ ] Rejoining the six tables reproduces all 56 original rows.

---

## Maintenance

Edit `ventasRawFixture.ts` and regenerate the SQL — never hand-edit `seed_ventas_raw.sql`.
The fixture builds rows by joining entity objects rather than repeating values, so a typo in a
repeated `cliente_nombre` is not expressible. That property is the reason the answer key can
be trusted.

If you change the data, re-derive this document. A stale answer key is worse than none: it
fails correct detectors and passes broken ones.

`ventasRawFixture.ts` also exports the two lists above as data (`expectedDependencies` and
`expectedIncidentalDependencies`) so tests assert against them directly instead of against
prose.

### Fixture representation note

The fixture models `numeric(10,2)` as a JavaScript `number`. The `pg` driver returns `numeric`
as a **string** by default, so the ingestion adapter must coerce it, or detection over the live
database will compare `"85.00"` where the fixture compares `85`. Equality-based FD detection
gives the same answer either way; anything doing arithmetic does not.
