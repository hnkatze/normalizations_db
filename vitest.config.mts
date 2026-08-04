import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` -> `./src/*` alias in tsconfig.json. Vitest does not read
    // tsconfig paths on its own, so without this every `@/domain` import in a test
    // fails to resolve.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // The engines under test are pure in-memory logic — no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
