import { defineConfig } from "vitest/config";

// Opt-in real-Postgres suites (`npm run test:integration`). Not part of
// `npm test`: vitest.config.mts excludes `*.integration.test.ts`. Node
// environment (no jsdom), one file at a time, long timeout for network I/O.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.integration.setup.ts"],
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
