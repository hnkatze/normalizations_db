"use client"

import { useEffect, useId, useRef, useState } from "react"

type ErDiagramProps = {
  /** Texto en sintaxis `erDiagram` de Mermaid, ya saneado por `toErDiagram`. */
  readonly source: string
  /** Cuántas tablas dibuja, para poder describirlo sin leer el SVG. */
  readonly tableCount: number
}

/** Lo dibujado, junto al texto del que salió. `svg: null` es un intento fallido. */
type Drawn = {
  readonly source: string
  readonly svg: string | null
}

/**
 * El esquema descompuesto, dibujado.
 *
 * Mermaid se importa dentro del efecto y no arriba: pesa cerca de un megabyte
 * y solo hace falta en los pasos 2FN y 3FN, así que cargarlo con el resto de
 * la aplicación se lo cobraría también a quien nunca llega hasta acá.
 *
 * El fallo es un estado de primera clase y no una excepción: si el diagrama no
 * se puede dibujar, las tarjetas de abajo siguen contando lo mismo en texto, y
 * tumbar la pantalla entera por el dibujo sería perder lo que sí funciona.
 */
export function ErDiagram({ source, tableCount }: ErDiagramProps) {
  const reactId = useId()
  // Mermaid usa este id para el nodo del SVG, y los dos puntos que React mete
  // en `useId` no son válidos en un selector de CSS.
  const diagramId = `er-${reactId.replace(/:/g, "")}`
  const [drawn, setDrawn] = useState<Drawn | null>(null)
  // Un id distinto por intento. Cancelar solo evita el `setDrawn` tardío: la
  // llamada anterior a Mermaid sigue viva y trabajando sobre el DOM, así que
  // dos dibujos superpuestos compartiendo id se pisan entre sí. Pasa al
  // cambiar de paso rápido y en el doble montaje de StrictMode, que reutiliza
  // el mismo `useId`.
  const attempt = useRef(0)

  useEffect(() => {
    let cancelled = false
    attempt.current += 1
    const renderId = `${diagramId}-${attempt.current}`

    async function draw() {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({
          startOnLoad: false,
          // Los nombres de tabla salen de un archivo ajeno. `strict` hace que
          // Mermaid escape el HTML que pueda venir dentro de una etiqueta.
          securityLevel: "strict",
          theme: "neutral",
        })
        const { svg } = await mermaid.render(renderId, source)
        if (!cancelled) {
          setDrawn({ source, svg })
        }
      } catch (error) {
        // Se reporta en vez de tragarse: Mermaid falla el diagrama entero por
        // una sola línea inválida, y sin este mensaje el síntoma es una
        // pantalla sin dibujo y sin ninguna pista de por qué.
        console.error("[ErDiagram] Mermaid no pudo dibujar el esquema:", error)
        console.error("[ErDiagram] texto que recibió:\n" + source)
        if (!cancelled) {
          setDrawn({ source, svg: null })
        }
      }
    }

    void draw()
    return () => {
      cancelled = true
    }
  }, [source, diagramId])

  // Se DERIVA si lo dibujado corresponde al texto actual, en vez de reiniciar
  // el estado desde el efecto: un `setState` síncrono ahí dispara un
  // renderizado en cascada, y comparar no cuesta nada.
  const current = drawn?.source === source ? drawn : null

  if (current !== null && current.svg === null) {
    return null
  }

  // En una constante propia y no leído de `current` dentro del JSX: la guarda
  // de arriba es compuesta y TypeScript no arrastra ese estrechamiento hasta
  // acá, así que `current.svg` seguiría siendo `string | null`.
  const svg = current?.svg ?? null

  return (
    <figure className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      {svg === null ? (
        <p className="text-xs text-muted-foreground">Dibujando el esquema…</p>
      ) : (
        <div
          // El SVG lo produce Mermaid a partir del texto que arma
          // `toErDiagram`, con `securityLevel: "strict"` escapando lo que
          // venga del archivo.
          //
          // `aria-hidden`: un lector de pantalla no saca nada de un SVG de
          // cajas y líneas, y la MISMA información —tablas, columnas, claves y
          // relaciones— está en las tarjetas de abajo, en texto. El pie
          // describe qué se está mostrando.
          aria-hidden="true"
          // El alto manda y el ancho lo sigue. Mermaid calcula un tamaño en
          // píxeles que para seis tablas ocupa media pantalla; topando el
          // alto, el `viewBox` reescala el dibujo entero manteniendo la
          // proporción, y queda una figura compacta al lado del contenido.
          //
          // Ambas clases hacen falta. Mermaid fija el alto como atributo de
          // presentación —que cualquier regla CSS supera— y el ancho en el
          // 100% de su modo `useMaxWidth`; sin `w-auto` ese 100% se queda y el
          // tope de alto solo deformaría el dibujo en vez de reescalarlo.
          //
          // Si aun reescalado no entra a lo ancho, `overflow-x-auto` lo
          // desplaza en vez de encogerlo más: un dibujo ilegible no sirve.
          className="overflow-x-auto [&_svg]:mx-auto [&_svg]:max-h-[26rem] [&_svg]:w-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
      <figcaption className="text-xs text-muted-foreground">
        Diagrama de {tableCount} {tableCount === 1 ? "tabla" : "tablas"} y sus relaciones. El
        detalle de cada una, en texto, está en las tarjetas de abajo.
      </figcaption>
    </figure>
  )
}
