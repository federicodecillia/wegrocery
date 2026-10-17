import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // *.integration.test.ts need a database: npm run test:int (vitest.int.config.ts).
    // console/ runs its own tests (console/vitest.config.ts).
    exclude: ["**/*.integration.test.ts", "node_modules/**", ".next/**", "console/**"],
  },
});
