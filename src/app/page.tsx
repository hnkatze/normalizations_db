import { SqlUploadContainer } from "@/features/sql-upload/SqlUploadContainer"

export default function Home() {
  return (
    <>
      {/*
        tabIndex={-1} para que el enlace de saltar al contenido MUEVA el foco
        y no solo desplace la ventana: sin él, el siguiente Tab vuelve al
        principio del documento y el salto no saltó nada.
      */}
      {/*
        Sin título propio acá: el paso "upload" trae el suyo, centrado, como
        parte de su hero (ver UploadHero), y los demás pasos lo reciben de
        SqlUploadContainer. El documento tiene que tener siempre exactamente
        un h1, nunca uno fijo compitiendo con el de cada paso.
      */}
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-[96rem] min-h-0 flex-1 flex-col gap-5 px-4 py-6 focus:outline-2 focus:outline-offset-4 focus:outline-ring sm:px-6 sm:py-8 2xl:px-10"
      >
        <SqlUploadContainer />
      </main>
    </>
  )
}
