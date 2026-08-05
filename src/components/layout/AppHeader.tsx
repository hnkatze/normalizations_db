export function AppHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
          Normalize
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          SQL 0NF<span aria-hidden="true"> &rarr; </span><span className="sr-only"> to </span>3NF
        </span>
      </div>
    </header>
  )
}
