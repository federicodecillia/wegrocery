import { defineConfig } from "vitest/config";
import path from "path";

// Integration tests (*.int.test.ts): the real queries against a throwaway
// Postgres. `npm run test:int`; see test/int/setup.ts for the database rules.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.int.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./test/int/setup.ts"],
    // One database for every file: run them one after the other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
