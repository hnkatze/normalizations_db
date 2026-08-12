# Sistema de diseño

Lo que el proyecto declara hoy, con valores verificados contra el código.
Estado al **12 de agosto de 2026**.

No es una guía de estilo aspiracional: describe lo que hay, y al final lista lo que
está roto o sobra. Si algo acá no coincide con `src/app/globals.css`, gana el CSS y
este documento está desactualizado.

---

## Dónde se edita qué

Tailwind v4, configuración en CSS. **No hay `tailwind.config.js` y no debe crearse uno.**

| Querés cambiar | Editá | No toques |
|---|---|---|
| Un color | `:root` en `globals.css` (líneas ~95–130) | `@theme inline` |
| El redondeo de toda la app | `--radius` en `:root` | los siete `--radius-*` |
| Una fuente | `layout.tsx` + `--font-*` en `@theme inline` | — |

Cada color se declara **dos veces**: el literal en `:root` y un alias
`--color-x: var(--x)` en `@theme inline`. Esa indirección es el contrato de shadcn y es
lo que hace posible un modo oscuro. **Los valores viven en `:root`; `@theme inline` no
se toca nunca.**

---

## Color

### La estructura real

La paleta es **cálida**: matices 45–75, croma 0.004–0.045, en `oklch`. No es gris
neutro; tiene una temperatura deliberada.

Y es más chica de lo que parece. Hay **25 nombres pero muchos menos valores**:

| Valor | Lo comparten |
|---|---|
| `oklch(0.955 0.012 70)` | `secondary`, `muted`, `accent` |
| `oklch(0.995 0.004 75)` | `card`, `popover` |
| `oklch(0.16 0.014 50)` | `foreground`, `card-foreground`, `popover-foreground` |
| `oklch(0.28 0.045 45)` | `primary`, `secondary-foreground`, `accent-foreground` |
| `oklch(0.9 0.012 70)` | `border`, `input` |

En la práctica el sistema es: **3 superficies + 2 pesos de texto + 1 borde + 1 anillo.**

Eso importa a la hora de tocar colores. Cambiar `--muted` cambia también el fondo de
`secondary` y de `accent`, porque hoy son el mismo valor. Si querés diferenciarlos, no
alcanza con editar uno: hay que decidir tres valores distintos.

### Tokens principales

| Token | Valor | Para qué |
|---|---|---|
| `--background` | `oklch(0.985 0.006 75)` | fondo de página |
| `--foreground` | `oklch(0.16 0.014 50)` | texto principal |
| `--card` / `--popover` | `oklch(0.995 0.004 75)` | superficie elevada |
| `--primary` | `oklch(0.28 0.045 45)` | acción principal |
| `--muted` | `oklch(0.955 0.012 70)` | superficie secundaria |
| `--muted-foreground` | `oklch(0.5 0.02 50)` | texto secundario |
| `--border` / `--input` | `oklch(0.9 0.012 70)` | separadores |
| `--ring` | `oklch(0.635 0.03 50)` | anillo de foco |
| `--destructive` | `oklch(0.577 0.245 27.325)` | error |

### Contraste medido

| Par | Ratio | Umbral |
|---|---|---|
| `foreground` sobre `background` | ≈18.6:1 | AA texto 4.5:1 ✅ |
| `muted-foreground` sobre `background` | ≈5.8:1 | ✅ |
| `muted-foreground` sobre `muted` | ≈5.3:1 | ✅ |
| `primary-foreground` sobre `primary` | ≈14.2:1 | ✅ |
| `ring` sobre `background` / `card` / `muted` | ≈3.29 / 3.38 / 3.01:1 | AA no-texto 3:1 ✅ |
| **`destructive` sobre `muted`** | **≈4.25:1** | AA texto 4.5:1 ⚠️ |

El anillo pasa por poco sobre `muted` (3.01:1). Cualquier retoque que aclare `--ring` o
oscurezca `--muted` lo hace fallar: **si tocás uno de los dos, hay que volver a medir.**

El caso de `destructive` sobre `muted` es un valor estimado por conversión a sRGB y
necesita medición real antes de tratarlo como falla confirmada.

### `--destructive` es el único color sin retocar

Su valor es el de fábrica de shadcn: croma 0.245 contra el 0.004–0.045 del resto. Es un
rojo saturado en una paleta cálida y apagada. Si algún día "los colores no combinan",
empezá mirando acá.

---

## Modo claro, por decisión

**No hay modo oscuro, y tampoco hay código muerto de modo oscuro.** Cero tokens
oscuros declarados, cero `prefers-color-scheme`, cero `data-theme`, ningún proveedor de
tema, y `next-themes` no es dependencia.

Dos mecanismos lo sostienen:

```css
color-scheme: light;                    /* controles nativos, scrollbars, date pickers */
@custom-variant dark (&:is(.dark *));   /* la línea clave */
```

Esa segunda línea hace lo contrario de lo que parece. En Tailwind v4, `dark:` significa
`@media (prefers-color-scheme: dark)`. Reasignarla a un selector de clase **desconecta
todas las utilidades `dark:` del sistema operativo**. Los primitivos de shadcn vienen
con clases `dark:` de fábrica: sin esa línea, se activarían solas en una máquina con
tema oscuro mientras los tokens siguen claros — una interfaz mitad oscura.

**Si algún día se quiere modo oscuro**, el trabajo no es escribir la línea: es agregar
un bloque `.dark` con los 33 valores y algo que ponga la clase en `<html>`. La
infraestructura ya está lista para recibirlo.

---

## Redondeo

Escala **multiplicativa** sobre un solo número, no la aditiva de fábrica de shadcn:

| Token | Fórmula | Con `--radius: 0.75rem` |
|---|---|---|
| `--radius-sm` | `calc(var(--radius) * 0.6)` | 7.2px |
| `--radius-md` | `calc(var(--radius) * 0.8)` | 9.6px |
| `--radius-lg` | `var(--radius)` | 12px |
| `--radius-xl` | `calc(var(--radius) * 1.4)` | 16.8px |
| `--radius-2xl` | `calc(var(--radius) * 1.8)` | 21.6px |
| `--radius-3xl` | `calc(var(--radius) * 2.2)` | 26.4px |
| `--radius-4xl` | `calc(var(--radius) * 2.6)` | 31.2px |

Como `--radius` vive en `:root` y no en `@theme`, la escala se resuelve en tiempo de
ejecución: **cambiar ese único valor reescala toda la app**. Es una propiedad
deliberada y vale la pena conservarla.

`2xl`, `3xl` y `4xl` son adiciones del proyecto y además pisan los valores por defecto
de Tailwind.

---

## Tipografía

| Familia | Variable | Token | Uso |
|---|---|---|---|
| Plus Jakarta Sans | `--font-plus-jakarta-sans` | `--font-sans` | global, vía `html { font-sans }` |
| JetBrains Mono | `--font-jetbrains-mono` | `--font-mono` | 8 archivos: nombres de tabla, columnas, DDL |

Ambas por `next/font/google`, fuentes variables, sin array de pesos.

**`--font-heading` está declarado, se usa en cuatro lugares, y no hace nada:** su valor
es `var(--font-sans)`, la misma familia. Es una intención de diseño escrita y no
cumplida — alguien quiso una tipografía distinta para los títulos y quedó apuntando al
mismo lado. **Es una decisión pendiente, no un bug**: o se le da una familia propia, o
se borra el token y se usa `font-sans`.

**No hay escala tipográfica propia.** Se usa la de Tailwind por defecto, y el tamaño
más chico disponible es `text-xs` (12px).

Ojo: redefinir `--font-sans` y `--font-mono` en `@theme` **reemplaza** las pilas por
defecto de Tailwind. No queda ningún `sans-serif` ni `monospace` genérico al final; el
respaldo es únicamente la fuente de fallback que genera `next/font`.

---

## Lo que el sistema NO define

Ni espaciado, ni sombras, ni duraciones o curvas de animación, ni z-index, ni
breakpoints propios. Todo eso viene de Tailwind por defecto.

No es necesariamente un problema —la escala de Tailwind es buena— pero conviene saberlo:
**no existe "el espaciado del proyecto"**, existe el de Tailwind.

---

## La variante `short:`

```css
@custom-variant short {
  @media (max-height: 900px) { @slot; }
}
```

Responde al **alto** del viewport, no al ancho. Se usa como `short:text-2xl`,
`short:min-h-40`. El corte deja 1440×900 del lado compacto y 1920×1080 del amplio.
También cubre el zoom al 200%, que reduce a la mitad el alto efectivo.

**No es lo que hace que la pantalla entre sin scroll.** De eso se encarga la cadena
flex (`min-h-dvh` en `<body>` → `flex-1 min-h-0` hasta el hero). `short:` es un
refinamiento aparte: achica el contenido real para que más viewports bajos eviten el
scroll de respaldo.

Su costo está documentado abajo.

---

## Movimiento

| Clase | Qué es |
|---|---|
| `upload-hero-motion` | **Marcador, no animación.** No define movimiento; es el asa por la que se lo apaga. |
| `upload-hero-progress-bar` | La única animación escrita a mano: barra indeterminada, 1.2s, infinita. |

Todo el resto del movimiento (`animate-in`, `fade-in-0`, `slide-in-from-bottom-2`) viene
de `tw-animate-css`.

```css
@media (prefers-reduced-motion: reduce) {
  .upload-hero-motion { animation: none !important; transition: none !important; transform: none !important; }
}
```

**La regla de oro: cualquier elemento animado tiene que llevar `upload-hero-motion`.**
Ese selector es la única compuerta. Un elemento con `animate-in` y sin el marcador sigue
animando aunque el usuario haya pedido menos movimiento.

Verificado: la barra de progreso infinita **sí** lleva el marcador
(`UploadHero.tsx:372`), así que se apaga correctamente.

Dos precisiones para quien lo modifique:

- `transform: none` no alcanza para todo. Tailwind v4 emite `translate-*`, `scale-*` y
  `rotate-*` como propiedades individuales, no como el atajo `transform`. Un `scale-95`
  estático **sobrevive** a esta regla.
- El comentario del archivo dice que la regla está fuera de capas para ganar en cascada
  "sin necesitar `!important`" — pero usa `!important` en las tres declaraciones. Las
  dos cosas no pueden ser ciertas a la vez, y con `!important` una regla sin capa queda
  en el extremo **débil** del orden. Hoy funciona porque nada compite; **no repitas ese
  razonamiento como si fuera cierto.**

---

## Deuda conocida

Ordenada por lo que más cuesta si no se toca.

### 1. La matriz `short:` × `sm:` × `lg:`

Hasta **seis valores para una sola propiedad** en un elemento:

```
text-3xl short:text-2xl sm:text-4xl short:sm:text-3xl lg:text-5xl short:lg:text-4xl
```

Nada está roto: cada par resuelve bien. El problema es de mantenimiento — la intención
("achicar cuando la ventana es baja") quedó repartida en ocho strings, y cualquier
ajuste de breakpoint pide hasta cuatro ediciones coordinadas. El `<label>` de la zona
de drop acumula **32 utilidades estáticas**.

Nada justifica una celda "short + large" distinta de "short".

### 2. El anillo de foco, copiado tres veces

`focus:outline-2 focus:outline-offset-4 focus:outline-ring`, idéntico, en `page.tsx`,
`UploadHero.tsx` y `SqlUploadContainer.tsx`. Los tres son destinos de foco programático
con `tabindex="-1"`. Debería ser una utilidad con nombre, en un solo lugar.

### 3. Residuo del preset: 26 líneas que nadie usa

`chart-1` … `chart-5` y los ocho `sidebar-*` no aparecen en ninguna parte de `src`, y no
existe primitivo de sidebar en el proyecto. Además son **acromáticos puros** (`0 0`),
así que nunca recibieron el retoque cálido del resto: si alguien los usara, desentonan.

### 4. `text-[0.6875rem]` fuera de escala

`ParsedSchemaOverview.tsx:84` usa 11px, un píxel por debajo de `text-xs`. O se usa
`text-xs`, o —si un tamaño micro es una decisión real y repetible— se declara como token
en `@theme`.

### 5. `.upload-hero-progress-bar` debería ser `@utility`

Es una clase suelta dentro de `@layer utilities`, que en Tailwind v4 **no la convierte
en utilidad**. Consecuencia: no acepta variantes, así que `motion-reduce:` no se puede
usar sobre ella. Hoy no hace falta porque el marcador la cubre, pero cierra una puerta
sin motivo.

### 6. `--font-heading` sin identidad

Ver la sección de tipografía. Decisión de diseño pendiente, no defecto.

---

## Lo que NO está roto

Para que nadie lo "arregle" al pasar:

- **Cero colores hardcodeados** en todo `src`. Ni un hex, ni un `rgb()`, ni un
  `text-slate-500`. Todo pasa por tokens semánticos.
- **Cero valores arbitrarios de color.** Los únicos dos valores entre corchetes del
  código propio son `text-[0.6875rem]` (deuda 4) y `scale-[1.01]`, que es legítimo: no
  existe paso de escala entre `scale-100` y `scale-105`.
- `size-11 sm:size-9` en el botón de limpiar **es deliberado**: 44px de área táctil en
  móvil, 36px en escritorio.
- El `* { border-border outline-ring/50 }` que aplica solo colores sin ancho ni estilo
  es comportamiento de fábrica de shadcn, y para el borde funciona porque Preflight ya
  puso `border: 0 solid`.
