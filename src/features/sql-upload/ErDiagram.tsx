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

/**
 * Qué dice el pie del diagrama.
 *
 * `"instructional"` es la explicación completa de cómo se usa el dibujo
 * (arrastrar, zoom, Tab). `"labelOnly"` es un nombre corto y propio de esta
 * figura: lo usa el modo automático en las etapas que NO son la primera,
 * donde la instrucción completa ya se leyó una vez y repetirla en cada
 * diagrama apilado es puro ruido. El pie sigue siendo el nombre accesible de
 * la figura en los dos casos — nunca queda sin uno.
 */
export type ErDiagramCaption = { readonly kind: "instructional" } | { readonly kind: "labelOnly"; readonly label: string }

type ErDiagramProps = {
  readonly input: ErDiagramInput
  /** @default { kind: "instructional" } */
  readonly caption?: ErDiagramCaption
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
export function ErDiagram({ input, caption = { kind: "instructional" } }: ErDiagramProps) {
  const tableCount = input.tables.length

  return (
    <figure className="flex flex-col gap-2 rounded-md border border-chart-1/40 bg-chart-1/5 p-3">
      <ErDiagramCanvas key={erDiagramSignature(input)} input={input} />
      <figcaption className="text-xs text-muted-foreground">
        {captionContent(caption, tableCount)}
      </figcaption>
    </figure>
  )
}

function captionContent(caption: ErDiagramCaption, tableCount: number) {
  switch (caption.kind) {
    case "instructional":
      return (
        <>
          Diagrama interactivo de {tableCount} {tableCount === 1 ? "tabla" : "tablas"} y sus
          relaciones: arrastrá para reordenar, hacé zoom o recorré cada tabla con Tab. El
          detalle completo, en texto, está en las tarjetas de abajo.
        </>
      )
    case "labelOnly":
      return caption.label
    default: {
      const unhandled: never = caption
      throw new Error(`ErDiagram: pie de diagrama no contemplado ${String(unhandled)}`)
    }
  }
}
