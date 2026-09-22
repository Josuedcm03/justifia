import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MAX_ACCOUNT_EVENTS_PER_APPLY,
  MAX_FILE_BYTES,
  MAX_NEW_ACCOUNTS_PER_APPLY,
  MAX_ROWS_PER_SHEET,
  MAX_ROWS_TOTAL,
  SERVER_ACTION_BODY_LIMIT,
  WRITE_CHUNK_ROWS,
} from "./limits";

// D1/decision 21/F3: caps consumed both by next.config.ts (which cannot see
// most of the module graph) and by the planner/apply pipeline.
describe("import limits (CEI: File guards / All-or-nothing apply)", () => {
  it("caps the upload size at 5 MiB", () => {
    expect(MAX_FILE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("caps rows per sheet at 10 000", () => {
    expect(MAX_ROWS_PER_SHEET).toBe(10_000);
  });

  it("caps total rows at 30 000", () => {
    expect(MAX_ROWS_TOTAL).toBe(30_000);
  });

  it("caps new accounts per apply at 250", () => {
    expect(MAX_NEW_ACCOUNTS_PER_APPLY).toBe(250);
  });

  it("caps account events (creates + updates) per apply at 2 000", () => {
    expect(MAX_ACCOUNT_EVENTS_PER_APPLY).toBe(2_000);
  });

  it("chunks bulk writes at 500 rows", () => {
    expect(WRITE_CHUNK_ROWS).toBe(500);
  });

  it("raises the server-action body limit exactly MAX_FILE_BYTES + 64 KiB (F3)", () => {
    expect(SERVER_ACTION_BODY_LIMIT).toBe(MAX_FILE_BYTES + 64 * 1024);
    expect(SERVER_ACTION_BODY_LIMIT).toBe(5_308_416);
  });

  it("has zero import statements, because next.config.ts consumes this file directly", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/import/limits.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
