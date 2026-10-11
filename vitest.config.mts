import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Real-Postgres suites are opt-in: `npm run test:integration`.
    exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"],
    css: false,
    // Must stay above the 5s async-utility timeout set in vitest.setup.ts, so
    // a slow wait reports its own error instead of a bare test timeout.
    testTimeout: 15000,
  },
});
