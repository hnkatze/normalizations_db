@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

An automatic **database normalization tool**, not a CRUD app over a hand-designed schema. The full product definition lives in `context.md` (written in Spanish) — read it before designing anything, because none of it is inferable from the current code.

Summary of the intended flow:

1. User uploads a `.sql` seed containing **one flat, unnormalized (0NF) table**.
2. The `.sql` is executed against a `staging` schema in PostgreSQL — Postgres itself acts as the SQL parser, so there is no hand-rolled parsing.
3. Structure is read from `information_schema`, data via `SELECT * FROM staging.<table>`.
4. A functional-dependency (FD) detection engine runs in plain JS, in memory: for each candidate `A → B`, group by `A` and verify `B` is constant within every group.
5. The UI shows detected FDs; **the user confirms or discards them**. This step is deliberate — detection is heuristic over observed data, not over real business rules, so the data suggests and the human decides.
6. A normalization engine turns confirmed FDs into 1NF/2NF/3NF tables (partial dependencies split at 2NF, transitive at 3NF).
7. DDL (`CREATE TABLE` with PK/FK) plus a migration script (`INSERT ... SELECT` from staging) are generated and executed against the final schema.
8. An explorer UI runs listings and JOINs to demonstrate the redundancy is gone.

**Scope boundaries** (from `context.md`, deliberate — do not expand without being asked): `.sql` input only (not Excel), one flat table at a time, normalize up to **3NF only** (BCNF/4NF/5NF are out), everything in a single Next.js project so API Routes serve as the backend.

## Current state — read this before planning work

Built and verified (69 tests across 10 files, `tsc`/`eslint`/`next build` all clean):

- **`src/domain/`** — the frozen contract. Imports nothing; everything imports it. `FlatTable`, `FunctionalDependency` + `FdEvidence`, `NormalizedSchema`, `Displacement`. Change it only with intent — four features are typed against it.
- **`src/seeds/`** — `seed_ventas_raw.sql`, an in-memory `FlatTable` fixture, and `GROUND_TRUTH.md`. 56 rows, composite PK `(venta_id, producto_id)`, a three-level transitive chain. **The seed is the answer key, not sample data**: it encodes 13 known dependencies the engines must rediscover, plus 27 documented true-but-wrong-to-confirm ones.
- **`src/features/fd-detection/`** — `detectFunctionalDependencies`. Minimality pruning plus a `maxDeterminantSize` cap; both counted in the result rather than silently applied.
- **`src/features/normalization/`** — `normalizeTo3NF`. Consumes *confirmed* dependencies only, never re-detects. Fixpoint loop so chains decompose fully.
- **`src/features/staging/`** — Postgres adapter behind a port. `pg` never escapes it. Its tests run with no database.
- **`src/features/sql-upload/`** — the upload screen.

Still to build: the FD review UI, DDL generation, the migration step, the data explorer, and the API routes wiring the engines to the browser.

Two integration tests in `src/seeds/` are the load-bearing ones — they are the only proof the independently built engines actually compose. Run them before trusting any change to either engine.

## Commands

```bash
npm run dev      # dev server on :3000
npm run build    # production build
npm start        # serve the production build
npm run lint     # eslint (flat config, no path arg needed)
npx tsc --noEmit # typecheck — there is no npm script for this
```

## Stack specifics that differ from older conventions

- **Next.js 16.3.0, App Router.** `AGENTS.md` is authoritative here: this version has breaking changes versus older training data. Read the relevant guide under `node_modules/next/dist/docs/` before writing route handlers, layouts, or data-fetching code.
- **`AGENTS.md` is machine-generated** by `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`). Deleting it from a diff just re-creates the uncommitted change; commit it alongside your work to keep the tree clean.
- **Typed route props are global.** `app/layout.tsx` uses `LayoutProps<"/">` with no import — these types come from `.next/types` and `.next/dev/types`, both already in `tsconfig.json`'s `include`. Prefer them over hand-written prop types; they require the build to have run at least once.
- **Tailwind v4, CSS-first.** There is no `tailwind.config.*`. Theme tokens are declared in `src/app/globals.css` via `@import "tailwindcss"` and an `@theme inline` block. Add design tokens there, not in a JS config file.
- **Path alias `@/*` maps to `./src/*`.** Source lives under `src/` — `src/app/`, `src/components/ui/` (vendored shadcn primitives), `src/features/` (business features), `src/lib/`.
- **The app is light mode only, and the mechanism is counterintuitive.** `src/app/globals.css` deliberately *keeps* `@custom-variant dark (&:is(.dark *));` and deliberately *omits* the `.dark` token block. Deleting that custom-variant line does not remove dark mode — it enables it, because Tailwind v4's built-in `dark:` variant falls back to `prefers-color-scheme` and the shadcn primitives ship with `dark:` classes baked in. The override rebinds them to a `.dark` ancestor that never exists, making them inert. There is a comment in the file saying this; read it before touching that line.
- **`shadcn` belongs in `dependencies`, not `devDependencies`.** It looks like a CLI-only package, but `globals.css` does `@import "shadcn/tailwind.css"`, which resolves to `node_modules/shadcn/dist/tailwind.css` at build time.
- **The shadcn CLI has a quoting bug on Windows.** `init` created a directory literally named `'src` (leading apostrophe) and wrote a broken `"@/*": ["./'src/*"]` alias into `tsconfig.json`. Both were repaired by hand. After running any shadcn command on Windows, check `git status` for a stray `'src` and re-check the tsconfig alias.
- **`tsconfig.json` has `strict: true` only.** It does *not* enable `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, or `noImplicitOverride`. Write code that would survive those flags anyway — index access into the row/column arrays the FD engine works with is exactly where the missing `noUncheckedIndexedAccess` will let a real bug through silently.

## Agent tooling directories

`.claude/`, `.agents/`, `.kiro/`, `.atl/`, and `skills-lock.json` are gitignored mirrors of the same skill set — they are tooling, not application code. `.atl/skill-registry.md` indexes every available skill with its trigger and absolute `SKILL.md` path; it is the lookup table when selecting skills, but `SKILL.md` itself is always the source of truth.
