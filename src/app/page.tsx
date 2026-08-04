import { AppHeader } from "@/components/layout/AppHeader"
import { SqlUploadContainer } from "@/features/sql-upload/SqlUploadContainer"

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-6 sm:py-20"
      >
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Normalize your SQL seed
          </h1>
          <p className="max-w-prose text-base text-muted-foreground">
            Upload a flat, unnormalized SQL seed and we&apos;ll detect
            functional dependencies, generate a 3NF schema, and prepare the
            migration for you.
          </p>
        </div>
        <SqlUploadContainer />
      </main>
    </div>
  )
}
