import { AppHeader } from "@/components/layout/AppHeader"
import { SqlUploadContainer } from "@/features/sql-upload/SqlUploadContainer"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-12"
      >
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Normaliza tu semilla SQL
          </h1>
          <p className="max-w-prose text-base text-muted-foreground">
            Sube una semilla SQL plana y sin normalizar; detectaremos las
            dependencias funcionales, generaremos un esquema en 3FN y
            prepararemos la migración por ti.
          </p>
        </div>
        <SqlUploadContainer />
      </main>
    </div>
  )
}
