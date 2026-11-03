// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { describe, expect, it } from "vitest";

// supporting-documents: "Fingerprint is internal, immutable and checked" (RN-26,
// RNF-01, RNF-02). The SHA-256 of a stored file is written once at finalize and
// read once by the RN-26 lookup. It must never reach a page, response, export,
// notification, log line or audit payload. This is a source scan: the column
// may be named in the schema, the finalize path, the Q5 reader and tests only.

type SourceFile = { path: string; text: string };

/** Where the stored fingerprint may be named in production code. */
const ALLOWED = [
  "src/db/schema.ts",
  "src/lib/data/documentos.ts",
  "src/lib/data/signals.ts",
];

const NAMES = /huellaSha256|HuellaSha256/;

/** Production files that name the fingerprint column but are not allowed to. */
function exposures(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ path, text }) => NAMES.test(text) && !ALLOWED.includes(path))
    .map(({ path }) => path);
}

/** Readers that would return every column of a document, fingerprint included. */
function wholeRowReads(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ text }) =>
      [
        /\.select\(\s*\)\s*\.from\(\s*documentoRespaldo/,
        /getTableColumns\(\s*documentoRespaldo/,
        /\.\.\.\s*documentoRespaldo\b/,
        /\bquery\.documentoRespaldo\b/,
      ].some((re) => re.test(text)),
    )
    .map(({ path }) => path);
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = posix.join(dir.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) return walk(join(dir, entry.name));
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

const production: SourceFile[] = walk("src").map((path) => ({
  path,
  text: readFileSync(path, "utf8"),
}));

const under = (prefix: string) =>
  production.filter(({ path }) => path.startsWith(prefix));

describe("the scanner", () => {
  it("flags a module outside the allowed ones that names the column", () => {
    expect(
      exposures([
        { path: "src/lib/audit/events.ts", text: "datos: { huellaSha256 }" },
        { path: "src/lib/data/documentos.ts", text: "huellaSha256: sha256" },
        { path: "src/lib/data/solicitud-detail.ts", text: "no hash here" },
      ]),
    ).toEqual(["src/lib/audit/events.ts"]);
  });

  it("flags a whole-row read of the documents table", () => {
    expect(
      wholeRowReads([
        {
          path: "src/lib/data/a.ts",
          text: "db.select().from(documentoRespaldo)",
        },
        {
          path: "src/lib/data/b.ts",
          text: "getTableColumns(documentoRespaldo)",
        },
        {
          path: "src/lib/data/c.ts",
          text: "db.select({ id: documentoRespaldo.id }).from(documentoRespaldo)",
        },
      ]),
    ).toEqual(["src/lib/data/a.ts", "src/lib/data/b.ts"]);
  });
});

describe("Never exposed (scenario)", () => {
  it("scans the whole production source and finds the column in the allowed modules", () => {
    expect(production.length).toBeGreaterThan(300);
    for (const path of ALLOWED) {
      expect(
        production.some((f) => f.path === path && NAMES.test(f.text)),
        path,
      ).toBe(true);
    }
  });

  it("names the fingerprint only in the schema, the finalize path and the Q5 reader", () => {
    expect(exposures(production)).toEqual([]);
  });

  it("never reads a whole document row, so no detail reader can return the fingerprint", () => {
    expect(wholeRowReads(production)).toEqual([]);
    // The readers behind the three detail screens select explicit columns.
    for (const reader of [
      "src/lib/data/solicitud-detail.ts",
      "src/lib/data/student-requests.ts",
      "src/lib/data/coordination-queue.ts",
    ]) {
      const text = production.find((f) => f.path === reader)?.text ?? "";
      expect(text, reader).toContain("documentoRespaldo");
      expect(text, reader).not.toMatch(/huella|fingerprint|sha256/i);
    }
  });

  it("keeps the fingerprint out of the audit log, the mail and the document route", () => {
    const places = [
      ...under("src/lib/audit/"),
      ...under("src/lib/mail/"),
      ...under("src/lib/remission/"),
      ...under("src/app/api/intake/documents/"),
    ];

    expect(places.length).toBeGreaterThan(5);
    for (const { path, text } of places) {
      // Other digests exist (the account import file); only ours is barred.
      expect(text, path).not.toMatch(/huella|fingerprint/i);
    }
  });

  it("logs no fingerprint: no console call in the modules that handle it mentions one", () => {
    for (const path of ALLOWED) {
      const text = production.find((f) => f.path === path)?.text ?? "";
      const calls = [...text.matchAll(/console\.\w+\([^;]*;/g)].map(
        (m) => m[0],
      );

      for (const call of calls) {
        expect(call, path).not.toMatch(/huella|fingerprint|sha256|hash/i);
      }
    }
  });

  it("never updates the fingerprint after finalize: one write in the whole source", () => {
    const writes = production.flatMap(({ path, text }) =>
      [...text.matchAll(/\bhuellaSha256\s*:/g)].map(() => path),
    );

    // `huellaSha256:` is the column definition (schema), the selection alias
    // of the Q5 reader would be `huella`, and finalize's update is the only
    // assignment. No other module may assign it.
    expect(writes.filter((p) => !ALLOWED.includes(p))).toEqual([]);
    expect(writes.filter((p) => p === "src/lib/data/documentos.ts")).toEqual([
      "src/lib/data/documentos.ts",
    ]);
  });
});
