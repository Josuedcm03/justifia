// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { EXTRACTION_MAX_DURATION_S } from "./limits";

// DE-12, N3: Next reads route segment config statically, so each entry point
// that can run extraction exports a literal `maxDuration`, not an import. A
// Server Action takes its duration from the page that uses it. This scan pins
// the literals to the one constant the deadline arithmetic derives from.

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/** Every entry point that runs extraction after the response or from cron. */
const ENTRY_POINTS = [
  "src/app/(dashboard)/requests/new/page.tsx",
  "src/app/(dashboard)/requests/[id]/correct/page.tsx",
  "src/app/api/cron/intake-sweep/route.ts",
] as const;

/** The literal of `export const maxDuration = <digits>;`, or null. */
function literalMaxDuration(source: string): number | null {
  const match = /^export const maxDuration = (\d+);\s*$/m.exec(source);
  return match ? Number(match[1]) : null;
}

describe("literalMaxDuration (the detector)", () => {
  it("reads a literal export", () => {
    expect(literalMaxDuration("export const maxDuration = 300;\n")).toBe(300);
    expect(
      literalMaxDuration("const a = 1;\nexport const maxDuration = 60;\r\n"),
    ).toBe(60);
  });

  it.each([
    ["an imported constant", "export const maxDuration = EXTRACTION_S;"],
    ["an expression", "export const maxDuration = 5 * 60;"],
    ["a re-export", 'export { maxDuration } from "./limits";'],
    ["a different name", "export const maxDurations = 300;"],
    ["a string", 'export const maxDuration = "300";'],
    ["a non-exported const", "const maxDuration = 300;"],
    ["a commented line", "// export const maxDuration = 300;"],
    ["nothing", "export default function Page() {}"],
  ])("rejects %s", (_name, source) => {
    expect(literalMaxDuration(source)).toBeNull();
  });
});

describe("maxDuration pins (DE-12, scenario: Duration pinned)", () => {
  it("the decided ceiling is 300 seconds", () => {
    expect(EXTRACTION_MAX_DURATION_S).toBe(300);
  });

  it.each(ENTRY_POINTS)(
    "%s exports a literal maxDuration equal to the extraction ceiling",
    (file) => {
      const source = readFileSync(path.join(ROOT, file), "utf8");

      expect(literalMaxDuration(source)).toBe(EXTRACTION_MAX_DURATION_S);
    },
  );
});
