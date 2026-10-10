import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Structural proof that no catalog query runs unscoped (CM-SCOPE-1, design
// Decision 2): every exported function of the two catalog data modules must
// have a row below naming the test that proves its scope handling, and that
// test must exist inside the named describe block of the module's test file. A
// new export without a row fails the first check; a renamed or removed test
// fails the second.

type Row = { fn: string; describe: string; test: string };

const READS =
  "scope sentinel: every Asignatura read carries the scope predicate";
const GRUPO_READS =
  "scope sentinel: every Grupo read carries the scope predicate";
const SENTINEL =
  "scope sentinel: the select and the update both carry the scope predicate";

const MODULES: { source: string; tests: string; rows: Row[] }[] = [
  {
    source: "asignaturas.ts",
    tests: "asignaturas.test.ts",
    rows: [
      {
        fn: "buildAsignaturasWhere",
        describe: "buildAsignaturasWhere",
        test: "combines scope, state and search with AND",
      },
      {
        fn: "listAsignaturas",
        describe: READS,
        test: "listAsignaturas: the count and the page",
      },
      { fn: "getAsignaturaById", describe: READS, test: "getAsignaturaById" },
      {
        fn: "listAsignaturaOptions",
        describe: READS,
        test: "listAsignaturaOptions",
      },
      {
        fn: "listCarreraOptions",
        describe: "listCarreraOptions",
        test: "offers only the own carrera to a carrera scope",
      },
      {
        fn: "createAsignatura",
        describe: "createAsignatura",
        test: "inserts with the carrera from carreraIdForWrite and returns the new id",
      },
      { fn: "updateAsignatura", describe: "updateAsignatura", test: SENTINEL },
      {
        fn: "setAsignaturaActivo",
        describe: "setAsignaturaActivo",
        test: SENTINEL,
      },
    ],
  },
  {
    source: "grupos.ts",
    tests: "grupos.test.ts",
    rows: [
      {
        fn: "buildGruposWhere",
        describe: "buildGruposWhere",
        test: "scopes through the Asignatura, not through the Grupo",
      },
      {
        fn: "listGrupos",
        describe: GRUPO_READS,
        test: "listGrupos: the count and the page",
      },
      { fn: "getGrupoById", describe: GRUPO_READS, test: "getGrupoById" },
      {
        fn: "listGruposByAsignatura",
        describe: GRUPO_READS,
        test: "listGruposByAsignatura",
      },
      {
        fn: "createGrupo",
        describe: "createGrupo",
        test: "the Asignatura read carries the scope predicate (sentinel)",
      },
      {
        fn: "updateGrupo",
        describe: "updateGrupo",
        test: "the update carries the scope predicate and zero rows is not_found",
      },
      {
        fn: "setGrupoActivo",
        describe: "setGrupoActivo",
        test: "the parent read and the update carry the scope predicate (sentinel); zero rows is not_found",
      },
    ],
  },
];

const read = (name: string) =>
  readFileSync(join(process.cwd(), "src/lib/data", name), "utf8");
const exportsOf = (text: string) =>
  [...text.matchAll(/^export (?:async )?(?:function|const|class) (\w+)/gm)].map(
    (match) => match[1],
  );
const describeBlock = (text: string, name: string) => {
  const start = text.indexOf(`describe("${name}"`);
  if (start < 0) return "";
  const end = text.indexOf("\ndescribe(", start + 1);
  return text.slice(start, end < 0 ? undefined : end);
};

describe.each(MODULES)("scope inventory: $source", (module) => {
  it("pairs every exported function with a row, and every row with an export", () => {
    expect(module.rows.map((row) => row.fn).sort()).toEqual(
      exportsOf(read(module.source)).sort(),
    );
  });

  it.each(module.rows)("$fn: its scope test exists", (row) => {
    const block = describeBlock(read(module.tests), row.describe);
    expect(block).not.toBe("");
    expect(block).toContain(`"${row.test}"`);
  });
});
