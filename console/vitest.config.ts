import { defineConfig } from "vitest/config";
import path from "path";

// Pure unit tests only: no database, no network (provider adapters take an
// injectable fetch).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    exclude: ["node_modules/**", ".next/**"],
  },
});
