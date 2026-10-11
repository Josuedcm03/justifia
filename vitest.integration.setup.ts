import { vi } from "vitest";

import { resolveIntegrationGate } from "@/lib/data/integration/guard";

// Setup of the opt-in real-Postgres suites (`npm run test:integration`).
//
// `@/db` builds its client from `env.DATABASE_URL` at import, so this file runs
// first and decides which database that is: the integration one when the gate
// says `run`, otherwise an unroutable placeholder (nothing connects until a
// query runs). The application's own DATABASE_URL is never inherited.

// `server-only` throws outside a React Server build; the data layer imports it.
vi.mock("server-only", () => ({}));

const PLACEHOLDER = "postgres://skipped:skipped@127.0.0.1:1/skipped";

process.env.INTEGRATION_FORBIDDEN_URL ??= process.env.DATABASE_URL;

// Decide once, before DATABASE_URL is replaced: re-resolving afterwards would
// compare the integration URL with itself. The suites read this decision.
const gate = resolveIntegrationGate(process.env);
process.env.INTEGRATION_GATE_MODE = gate.mode;
if (gate.mode === "refuse") process.env.INTEGRATION_GATE_REASON = gate.reason;
process.env.DATABASE_URL = gate.mode === "run" ? gate.url : PLACEHOLDER;
process.env.AUTH_SECRET ??= "integration-suite-secret-not-used-0000000000";
