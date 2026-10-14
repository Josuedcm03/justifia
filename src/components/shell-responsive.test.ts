import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// BS-RSP-1 and BS-A11Y-1: there is no browser or E2E layer, so the narrow-width
// rules are pinned at the class level where a class assertion is meaningful.
// The 320px and 360px results themselves are on the manual checklist (F.4).

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const SHELL_FILES = [
  "src/components/app-sidebar.tsx",
  "src/components/page-context.tsx",
  "src/components/page-frame.tsx",
  "src/components/table-card.tsx",
  "src/components/empty-state.tsx",
  "src/components/degraded-alert.tsx",
  "src/app/(dashboard)/loading.tsx",
  "src/app/(dashboard)/(home)/loading.tsx",
  "src/app/(dashboard)/error.tsx",
  "src/app/(dashboard)/(home)/page.tsx",
] as const;

// A fixed pixel or rem width (`w-96`, `w-[320px]`, `min-w-[20rem]`) cannot
// shrink with the viewport. Fractions, `w-full`, `max-w-*`, `min-w-0` (the
// flex shrink fix) and CSS-variable widths are fine. The top bar is left out:
// its only match is the user dropdown's popup `min-w-56`, a popup, not layout.
const FIXED_WIDTH =
  /(?<![\w-])(?:min-)?w-(?:(?!0(?![\d.]))\d+(?:\.\d+)?(?![/\d])|\[\d)/;

describe("shell responsive classes (BS-RSP-1)", () => {
  it.each(SHELL_FILES)("%s uses no fixed pixel widths", (file) => {
    expect(read(file)).not.toMatch(FIXED_WIDTH);
  });

  it("the detector flags a fixed width and accepts a fraction", () => {
    expect("w-96").toMatch(FIXED_WIDTH);
    expect("min-w-[20rem]").toMatch(FIXED_WIDTH);
    expect("w-1/4 w-full max-w-md min-w-0 w-(--sidebar-width)").not.toMatch(
      FIXED_WIDTH,
    );
  });

  it("the home shortcut and count grids collapse to one column below sm", () => {
    const source = read("src/app/(dashboard)/(home)/page.tsx");
    const grids = [...source.matchAll(/className="([^"]*\bgrid\b[^"]*)"/g)];

    expect(grids.length).toBeGreaterThanOrEqual(2);
    for (const [, classes] of grids) {
      expect(classes).toMatch(/\bsm:grid-cols-2\b/);
      expect(classes).not.toMatch(/(^|\s)grid-cols-\d/);
    }
  });

  it("the loading skeleton and the error screen wrap instead of overflowing", () => {
    expect(read("src/app/(dashboard)/error.tsx")).toMatch(/flex-wrap/);
    // Skeleton blocks size by fraction of the row, never by pixels.
    expect(read("src/app/(dashboard)/loading.tsx")).toMatch(/w-1\/4/);
  });

  it("the home skeleton sizes blocks by fraction and mirrors the real grid", () => {
    const source = read("src/app/(dashboard)/(home)/loading.tsx");

    expect(source).toMatch(/sm:grid-cols-2/);
    expect(source).toMatch(/w-(?:1\/\d|2\/3|full)/);
  });

  it("the top-bar trail keeps only the entry below md", () => {
    expect(read("src/components/page-context.tsx")).toMatch(
      /hidden [^"]*md:flex/,
    );
  });
});
