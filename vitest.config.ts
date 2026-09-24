import { defineConfig } from "vitest/config";

// Unit tests only (pure functions, no I/O) — see design's Testing Strategy.
// Mirrors package.json's "imports" map ("#*" -> "./agent/*") and tsconfig's
// "paths" entry so test files can import via the same "#lib/..." specifiers
// used by the tools themselves.
export default defineConfig({
  resolve: {
    alias: {
      "#lib": new URL("./agent/lib", import.meta.url).pathname,
      "#tools": new URL("./agent/tools", import.meta.url).pathname,
    },
  },
  test: {
    // Tool CRUD tests live under top-level tests/, not agent/tools/, because
    // eve's discovery treats every file directly in agent/tools/ as a tool
    // and rejects "*.test" as an illegal tool name.
    include: ["agent/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
  },
});
