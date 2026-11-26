import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// DM-15 "The phone appears only on the edit page" (A5). Characterization pin
// over source text: it passes against the code as it stands, so it cannot be
// RED. It was proved live by adding the phone to each reader below and
// restoring it. The rendered side of the same rule lives in the page tests:
// the Docentes list delivers no phone (`docentes/page.test.tsx`) and the edit
// page is the one place that serializes it (`[id]/edit/page.test.tsx`).

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Non-test `.ts` and `.tsx` sources below a folder, as repo-relative paths. */
function sourcesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return sourcesUnder(path);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
        ? [path]
        : [];
    },
  );
}

/** One top-level declaration of a source file: from its first line to the
 *  next declaration that starts at column zero. */
function declaration(source: string, start: RegExp): string {
  const from = source.search(start);
  expect(from, `declaration ${start} not found`).toBeGreaterThanOrEqual(0);
  const rest = source.slice(from + 1);
  const next = rest.search(/\n(?:export |\/\*\*|\/\/ )/);
  return source.slice(from, next < 0 ? undefined : from + 1 + next);
}

const USERS = read("src/lib/data/users.ts");

describe("the phone stays out of every list and option reader (DM-15, A5)", () => {
  it.each([
    ["the Users list projection", /export const usuarioListColumns\b/],
    ["the Docentes list read", /export async function listDocentes\(/],
    [
      "the grupo docente options read",
      /export async function listDocenteOptions\(/,
    ],
  ] as const)("%s selects no phone", (_name, start) => {
    const body = declaration(USERS, start);

    expect(body.length).toBeGreaterThan(80);
    expect(body).not.toMatch(/telefono/i);
  });

  it("the Docentes list delivers its four fields without the phone", () => {
    for (const file of [
      "src/app/(dashboard)/catalog/docentes/page.tsx",
      "src/app/(dashboard)/catalog/docentes/docentes-table.tsx",
    ]) {
      expect(read(file), file).not.toMatch(/telefono/i);
    }
  });

  // A new reader that selects the phone has to be added here on purpose. The
  // Postgres test support under `integration/` is not a reader.
  it("only the readers that need the phone name it in the data layer", () => {
    const naming = sourcesUnder("src/lib/data").filter(
      (file) => !file.includes("/integration/") && /telefono/i.test(read(file)),
    );

    expect(
      naming
        .map((file) => relative("src/lib/data", file).replace(/\\/g, "/"))
        .sort(),
    ).toEqual(["catalog.ts", "docentes.ts", "retention.ts", "users.ts"]);
  });

  it("under the docentes screens only the edit page, its form and its action carry the phone", () => {
    const base = "src/app/(dashboard)/catalog/docentes";
    const naming = sourcesUnder(base).filter((file) =>
      /telefono/i.test(read(file)),
    );

    expect(
      naming.map((file) => relative(base, file).replace(/\\/g, "/")).sort(),
    ).toEqual(["[id]/edit/page.tsx", "actions.ts", "docente-form.tsx"]);
  });
});
