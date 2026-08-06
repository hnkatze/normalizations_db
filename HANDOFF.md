# Handoff — estado del trabajo en curso

Documento para retomar el trabajo en otra máquina o después de una pausa larga.
Refleja el estado al **6 de agosto de 2026**.

---

## Lo que está pendiente y bloquea

### 1. La vista de carga todavía tiene scroll (SIN RESOLVER)

El requisito es que el paso `upload` entre completo en el viewport: es solo cargar
un archivo, no tiene sentido que haga scroll.

**Se intentaron dos enfoques y ninguno lo cerró.**

Primer intento — aritmética a mano en `UploadHero.tsx`:

```
min-h-[calc(100dvh-7.5rem)] sm:min-h-[calc(100dvh-8.5rem)]
```

restando una altura de `AppHeader` *estimada* en ~4.5rem más el padding de `<main>`.
Falló en navegador real. Es frágil por construcción: cualquier desvío en la
estimación supera 100dvh y reaparece el scroll.

Segundo intento — cadena flex, que es el estado actual del código:

| Archivo | Clases |
|---|---|
| `src/app/layout.tsx` — `<body>` | `min-h-dvh flex flex-col` |
| `src/app/page.tsx` — `<main>` | `flex-1 flex flex-col min-h-0` |
| `SqlUploadContainer.tsx` — div raíz y div de contenido | `flex flex-1 flex-col min-h-0` |
| `UploadHero.tsx` — wrapper | `flex-1 flex flex-col items-center justify-center` |

La idea es correcta: `min-h-dvh` como **mínimo** (nunca altura fija) hace que con
contenido chico el `main` se estire hasta llenar el viewport exacto, y con contenido
grande —1FN con sus dos columnas— la página crezca y el scroll aparezca normal. Sin
condicionales por paso y sin `overflow-hidden`, así que nada se recorta nunca.

El usuario reportó que **aún así sigue habiendo scroll**, y que el sobrante "es justo
el tamaño del header". Último cambio aplicado, no verificado: se quitó `h-full` del
className de `<html>` en `layout.tsx`, porque `height: 100%` resuelve contra el
*large viewport* y mezclarlo con el `min-h-dvh` del `body` hace que el documento mida
lo que dice `html`, no lo que dice `body`.

**El próximo paso es medir, no seguir estimando.** Con la app corriendo, en la consola:

```js
const d = document.documentElement;
console.log('sobrante:', d.scrollHeight - d.clientHeight, 'px');
[...document.querySelectorAll('body *')]
  .map(el => ({ el, b: el.getBoundingClientRect().bottom }))
  .filter(x => x.b > d.clientHeight)
  .slice(0, 6)
  .forEach(x => console.log(Math.round(x.b), x.el.tagName, x.el.className.slice(0, 70)));
```

La primera línea da el sobrante; el primer elemento de la lista es el culpable.

> Antecedente que conviene no repetir: ya hubo una versión que bloqueaba el alto con
> `h-full` + `overflow-hidden` en `body`/`main` y daba scroll propio a cada panel.
> Se revirtió porque escondía contenido sin mostrar barra que delatara que había más.
> El comentario en `layout.tsx` lo documenta. **No volver a ese enfoque.**

### 2. Decisión abierta: ¿el stepper se elimina de toda la app?

Hoy `WorkspaceStepper` está oculto solo en el paso `upload` (render condicional) y
sigue funcionando igual en 1FN/2FN/3FN. El usuario dijo "eso lo vamos a quitar" sin
aclarar el alcance.

Si se elimina del todo, no es borrar un componente: hay que rediseñar cómo se recorre
el flujo. Están implicados `WorkspaceStepper.tsx`, `workspaceSteps.ts` con
`resolveStep`/`stepAfter`/`stepBefore` y sus tests, y habría que reemplazar la
navegación por otra cosa — los botones "Volver / Ver siguiente" solos, o un scroll
continuo con 1FN, 2FN y 3FN una debajo de otra.

### 3. Auditoría de accesibilidad pendiente

El usuario pidió posponerla hasta terminar de pulir la interfaz. Quedó preparada y sin
ejecutar. Puntos que hay que hacerle juzgar específicamente:

- La invariante de **exactamente un h1** en todos los pasos (en `upload` vive en
  `UploadHero`; en el resto es un h1 condicional en `SqlUploadContainer`).
- El h2 de paso lleva `sr-only` en `upload` pero **sigue siendo el destino de un
  `focus()` + `scrollIntoView()` programático**. Un elemento invisible que recibe el
  foco necesita veredicto explícito.
- Foco visible del `<input type="file">`, que está dentro de un `<label>`.
- Que `prefers-reduced-motion` cubra *todas* las animaciones agregadas, no solo algunas.
- Reflow y zoom 200% con la cadena de altura.

---

## Lo que se hizo

### Rediseño de la primera vista

`SqlUploadCard.tsx` fue **eliminado** y reemplazado por `UploadHero.tsx`.

- El h1 y el párrafo descriptivo se movieron de `page.tsx` al hero.
  `SqlUploadContainer` renderiza un h1 condicional en 1FN/2FN/3FN para que siempre
  exista exactamente un h1 en el documento.
- `WorkspaceStepper` no se renderiza en `upload`.
- El h2 de paso lleva `sr-only` en `upload`, pero conserva su `tabIndex={-1}` y sigue
  siendo el objetivo del efecto de foco. **Ese efecto no se tocó.**
- Título y párrafo en `max-w-3xl`; la dropzone y el pie en `max-w-2xl`. Se ensanchó
  solo la descripción.
- `<main>` y `AppHeader` ahora comparten `max-w-7xl`. Antes el main estaba en
  `max-w-[100rem]` y el contenido sobresalía ~160px respecto del header.
- Animaciones con `tw-animate-css`, que ya estaba instalado: entrada escalonada,
  feedback de arrastre, barra de progreso indeterminada. Hay un bloque *unlayered* de
  `prefers-reduced-motion` en `globals.css` que anula todo lo marcado con
  `.upload-hero-motion`.
- Variante propia `short` (`max-height: 900px`) que compacta tipografía y paddings en
  viewports bajos. Ya no es responsable de la corrección del layout, solo reduce la
  huella del contenido.

### Bug crítico corregido: soltar el archivo fuera de la zona volaba la app

El listener de red de seguridad a nivel `window` reseteaba el estado de arrastre pero
no llamaba `preventDefault()`. Soltar un archivo **fuera** del `<label>` —sobre el
header, sobre el margen— hacía que el navegador navegara la pestaña hacia el archivo,
destruyendo la aplicación y todo su estado. En una demo con proyector, eso tumba la
presentación.

El fix tiene un detalle que no es obvio: **no alcanza con prevenir `drop`**. El
navegador solo entrega un `drop` a un destino si el `dragover` de ese instante fue
cancelado, así que también hay que prevenirlo en `window`. Para que eso no haga que la
página entera parezca zona válida, el handler pone `dropEffect = "none"` cuando el
target está fuera del `<label>`.

---

## Trampas conocidas del proyecto

**`tsconfig.json` NO tiene `noUncheckedIndexedAccess`.** Solo `strict: true`. Los
accesos por índice (`arr[i]`, `record[key]`) **no** están cubiertos por el compilador;
la guarda del `undefined` es disciplina manual.

**`UploadHero.tsx` importa `DragEvent` desde `"react"`.** Ese es `React.DragEvent`,
que **no** es el tipo que entregan los listeners de `window.addEventListener`. Para
handlers a nivel window hay que tipar explícitamente `globalThis.DragEvent`.

**No hay infraestructura para testear componentes.** `vitest.config.mts` usa
`environment: "node"` y el glob es `src/**/*.test.ts` — un archivo `.tsx` ni siquiera
se recogería. No hay `jsdom`, `happy-dom` ni `@testing-library/react`. Los 177 tests
existentes son todos de funciones puras. Agregar tests de render implica dependencias
nuevas y tocar la config de vitest: es una decisión pendiente, no algo para colar
dentro de un bugfix.

**No hay navegador headless en el entorno de agentes.** Ningún agente puede verificar
`scrollHeight <= clientHeight` ni comprobar comportamiento visual. Que el HTML servido
contenga las clases nuevas **no prueba nada** sobre el layout resultante. Toda
afirmación sobre scroll, animaciones o responsive que no venga de un navegador real es
una estimación, y debe declararse como tal.

---

## Cómo verificar

```bash
npx tsc --noEmit     # limpio
npx vitest run       # 27 archivos, 177 tests
npx eslint <rutas>   # incluye react-hooks/exhaustive-deps
```

Estado al momento de escribir esto: las tres pasan en verde.

Un `PostToolUse` hook typechequea cada archivo `.ts`/`.tsx` al escribirlo. Su silencio
significa "no se chequeó", no "está limpio".
