import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Same rule sets the old .eslintrc.json extended (next/core-web-vitals and
// next/typescript), in flat-config form: `next lint` is gone in Next.js 16.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // New in eslint-plugin-react-hooks 7 (shipped with eslint-config-next 16):
      // flags a setState called synchronously in an effect. Nine existing sites
      // (reset-on-open dialogs, hydration-safe clock, prop-to-state sync) rely on
      // it on purpose; rewriting them is a behaviour change that does not belong
      // in a framework upgrade. Re-enable once they are reworked.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
