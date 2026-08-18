"use client"

import dynamic from "next/dynamic"

import { erDiagramSignature, type ErDiagramInput } from "./erDiagramInput"

// El lienzo pesa varios cientos de KB (React Flow + dagre) y solo hace falta
// en los pasos 2FN y 3FN: `ssr: false` además evita medir el DOM en el
// servidor, donde no existe.
const ErDiagramCanvas = dynamic(() => import("./ErDiagramCanvas"), {
  ssr: false,
  loading: () => <p className="text-xs text-muted-foreground">Dibujando el esquema…</p>,
})

type ErDiagramProps = {
  readonly input: ErDiagramInput
}

/**
 * El esquema descompuesto, dibujado con React Flow: zoom, arrastre y un
 * minimapa cuando hay muchas tablas.
 *
 * La `key` del lienzo es una firma del contenido (`erDiagramSignature`), no
 * el objeto `input`: un esquema nuevo de verdad lo remonta con capa y
 * `fitView` propios, pero un re-render por otro motivo no le tira las
 * posiciones que el usuario ya arrastró a mano.
 */
export function ErDiagram({ input }: ErDiagramProps) {
  const tableCount = input.tables.length

  return (
    <figure className="flex flex-col gap-2 rounded-md border border-border bg-card p-3">
      <ErDiagramCanvas key={erDiagramSignature(input)} input={input} />
      <figcaption className="text-xs text-muted-foreground">
        Diagrama interactivo de {tableCount} {tableCount === 1 ? "tabla" : "tablas"} y sus
        relaciones: arrastrá para reordenar, hacé zoom o recorré cada tabla con Tab. El
        detalle completo, en texto, está en las tarjetas de abajo.
      </figcaption>
    </figure>
  )
}
