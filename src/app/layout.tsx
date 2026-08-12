import type { Metadata } from "next";
import { Poppins, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

// Poppins no es una fuente variable en Google Fonts, así que los pesos se
// piden de a uno. Solo los cinco que la interfaz usa: cada peso extra es otro
// archivo que el navegador descarga.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

// La serif de los títulos. Es lo que separa esta herramienta de un panel
// genérico: cuando título y cuerpo comparten familia, la pantalla no tiene voz.
// Fraunces es variable, así que el peso completo viaja en un solo archivo.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Normalizador SQL",
  description:
    "Sube una semilla SQL plana y sin normalizar para detectar automáticamente las dependencias funcionales, generar tablas en 3FN y migrar tus datos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${jetbrainsMono.variable} ${fraunces.variable} antialiased`}
    >
      {/*
        La página hace scroll normal, con UNA sola barra.
        Hubo una versión que bloqueaba el alto a la ventana y daba scroll
        propio a cada panel. Se revirtió: con el asistente por pasos ya se
        muestra una cosa a la vez, así que el candado no ganaba nada, y varias
        áreas de scroll anidadas dentro de una ventana bloqueada esconden
        contenido sin siquiera mostrar una barra que delate que hay más.

        `min-h-dvh` (no `min-h-full`) a propósito: es el punto de partida de
        la cadena flex que llega hasta el hero de carga (ver UploadHero). Con
        `min-h-full` el alto dependería de que `html` tenga uno declarado;
        `min-h-dvh` no depende de nada más y ya descuenta la barra de
        direcciones del navegador en móvil.
      */}
      <body className="min-h-dvh flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
