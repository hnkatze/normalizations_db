/**
 * Recorre la aplicación en un navegador real y deja capturas.
 *
 * Existe porque durante mucho tiempo la única forma de saber cómo se veía algo
 * era preguntarle a una persona. Typecheck, pruebas y build no dicen NADA sobre
 * scroll, tamaño de un dibujo ni si un panel quedó vacío; esto sí.
 *
 * Usa el Chrome ya instalado en el sistema (`channel: "chrome"`), así que no
 * descarga navegadores.
 *
 * Necesita los dos servicios levantados:
 *   npm run dev:parser     terminal 1
 *   npm run dev            terminal 2
 *   npm run walkthrough    terminal 3
 *
 * Sube la semilla de referencia, elige la clave compuesta, confirma las reglas
 * del answer key y recorre 1FN, 2FN y 3FN, informando por consola cuántas
 * tablas salieron en cada etapa, si hubo desborde horizontal y cualquier error
 * que la página haya escrito en consola.
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"

const OUT = process.argv[2] ?? "."
const SEED = process.argv[3]
mkdirSync(OUT, { recursive: true })

// Las 13 dependencias del answer key: 5 parciales + 6 transitivas + 2 completas.
const CONFIRM = [
  ["venta_id", "fecha_venta"],
  ["venta_id", "cliente_id"],
  ["producto_id", "producto_nombre"],
  ["producto_id", "producto_precio"],
  ["producto_id", "categoria_id"],
  ["cliente_id", "cliente_nombre"],
  ["cliente_id", "cliente_email"],
  ["cliente_id", "cliente_ciudad_id"],
  ["cliente_ciudad_id", "cliente_ciudad_nombre"],
  ["cliente_ciudad_id", "cliente_ciudad_pais"],
  ["categoria_id", "categoria_nombre"],
]

const log = (...a) => console.log("[walkthrough]", ...a)

const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

const problems = []
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console.error: ${m.text().slice(0, 300)}`)
})
page.on("pageerror", (e) => problems.push(`pageerror: ${String(e).slice(0, 300)}`))

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
  log("captura:", name)
}

await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
await shot("01-carga")

// 1. Subir el archivo directamente en el input, sin diálogo del sistema.
await page.setInputFiles("#sql-file-input", SEED)
await page.getByRole("button", { name: /analizar/i }).click()

// 2. Paso de tablas.
await page.getByRole("heading", { name: /elegí qué tabla/i }).waitFor({ timeout: 30000 })
await shot("02-tablas")

await page.getByRole("button", { name: /normalizar ventas_raw/i }).click()

// 3. 1FN: la clave primaria.
//
// La aplicación ahora LEE la clave del `CREATE TABLE` y la ofrece para
// confirmar, en vez de pedir que se marque columna por columna. El selector
// manual solo aparece detrás de "Corregir", así que el recorrido confirma la
// declarada — que para la semilla de referencia ya es la compuesta correcta.
await page.getByRole("heading", { name: /1FN/ }).waitFor({ timeout: 30000 })
const confirmKey = page.getByRole("button", { name: /confirmar clave/i }).first()
if ((await confirmKey.count()) > 0) {
  await confirmKey.click()
  log("clave: confirmada desde el archivo")
} else {
  // Sin clave declarada en el archivo hay que elegirla a mano.
  await page.getByRole("button", { name: /corregir/i }).first().click()
  for (const col of ["venta_id", "producto_id"]) {
    await page.getByRole("checkbox", { name: new RegExp(`^${col}$`) }).first().click()
    log("clave:", col)
  }
  await page.getByRole("button", { name: /confirmar clave/i }).first().click()
}
await page.waitForTimeout(500)

// 4. Confirmar las reglas del answer key.
let confirmed = 0
for (const [det, dep] of CONFIRM) {
  const label = new RegExp(`${det}\\b[\\s\\S]*${dep}\\b|${dep}\\b[\\s\\S]*${det}\\b`)
  const box = page.getByRole("checkbox", { name: label }).first()
  if ((await box.count()) === 0) {
    problems.push(`no encontré la regla ${det} -> ${dep}`)
    continue
  }
  try {
    // La aplicación ahora preconfirma sola parte de las reglas al confirmar la
    // clave. Un click a ciegas las DESMARCARÍA: hay que mirar el estado antes
    // de tocar, o el recorrido termina deshaciendo el trabajo que vino a verificar.
    if ((await box.getAttribute("aria-checked")) === "true") {
      confirmed += 1
      continue
    }
    await box.click({ timeout: 4000 })
    confirmed += 1
  } catch {
    problems.push(`no pude marcar ${det} -> ${dep}`)
  }
}
log("reglas marcadas:", confirmed, "de", CONFIRM.length)
await shot("03-1fn")

// 5. Recorrer 2FN y 3FN.
for (const step of ["2FN", "3FN"]) {
  const tab = page.getByRole("button", { name: new RegExp(`^${step}`) }).first()
  if ((await tab.count()) === 0) {
    problems.push(`no hay acceso al paso ${step}`)
    continue
  }
  await tab.click()
  await page.getByRole("heading", { name: new RegExp(step) }).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(2500) // que mermaid termine de dibujar
  await shot(`04-${step}`)

  const tables = await page.locator('[data-slot="card-title"]').allTextContents()
  const svgs = await page.locator("figure svg").count()
  log(`${step}: ${tables.length} tarjetas -> ${tables.join(", ")} | diagramas svg: ${svgs}`)
  // Contar y solo imprimir deja pasar el caso peor: una etapa que no dibujó
  // NADA se lee igual que una que salió bien.
  if (tables.length === 0) problems.push(`${step} no mostró ninguna tabla`)
  if (svgs === 0) problems.push(`${step} no dibujó el diagrama`)
}

// 6. Desbordes horizontales, que es lo que no puedo ver de otra forma.
const overflow = await page.evaluate(() => {
  const d = document.documentElement
  return { sobrante: d.scrollWidth - d.clientWidth, alto: d.scrollHeight - d.clientHeight }
})
log("desborde horizontal del documento:", overflow.sobrante, "px | scroll vertical:", overflow.alto, "px")

log(problems.length === 0 ? "sin errores de consola" : `PROBLEMAS: ${problems.length}`)
problems.forEach((p) => log(" -", p))

await browser.close()

// Salir con error cuando algo falló. Sin esto el proceso termina en 0 pase lo
// que pase, y un verificador que siempre dice que sí es peor que ninguno:
// convierte un fallo en una línea de consola que nadie mira.
if (problems.length > 0) {
  process.exitCode = 1
}
