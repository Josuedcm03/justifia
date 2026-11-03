// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { describe, expect, it, vi } from "vitest";

// The signals and the verdict are display-only (RN-15, RF-05 d; VS-2). No write
// path (decision, escalation, answer, report, correction, finalize, resend,
// upload, notification) may read them. The write paths are the server actions
// and every data module except the signals loader itself.

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));
// Both signal entry points throw if they are evaluated or even loaded.
vi.mock("@/lib/data/signals", () => {
  throw new Error("signals_loaded_by_a_write_path");
});
vi.mock("@/lib/signals/evaluate", () => {
  throw new Error("signals_loaded_by_a_write_path");
});
// RN-26 (S2) has its own evaluator; it is covered like the rest.
vi.mock("@/lib/signals/repeated-document", () => {
  throw new Error("signals_loaded_by_a_write_path");
});

type SourceFile = { path: string; text: string };

/** The module specifiers a source file imports, requires or lazy-loads. */
function specifiers(source: string): string[] {
  const text = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [
    ...text.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']([^"']+)["']/g,
    ),
  ].map((m) => m[1]);
}

/** A repo path (`src/...`) for an import, or null when it is a package. */
function resolved(from: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith(".")) {
    return posix.normalize(posix.join(posix.dirname(from), specifier));
  }
  return null;
}

const SIGNAL_MODULES = [
  /^src\/lib\/signals(\/|$)/,
  /^src\/lib\/data\/signals$/,
];

/** The files that import a signals module. */
function importersOfSignals(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ path, text }) =>
      specifiers(text).some((specifier) => {
        const target = resolved(path, specifier);
        return target !== null && SIGNAL_MODULES.some((re) => re.test(target));
      }),
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

const ACTION_FILE = /(^|\/)(actions|[\w-]+-actions)\.ts$/;
const writePaths = [
  ...walk("src").filter((path) => ACTION_FILE.test(path)),
  ...walk("src/lib/data").filter(
    (path) =>
      posix.dirname(path) === "src/lib/data" &&
      path !== "src/lib/data/signals.ts",
  ),
];

const read = (path: string): SourceFile => ({
  path,
  text: readFileSync(path, "utf8"),
});

describe("the scanner", () => {
  it("flags a fixture that imports the signals modules, in every import form", () => {
    const flagged = importersOfSignals([
      {
        path: "src/lib/data/a.ts",
        text: 'import { x } from "@/lib/signals/evaluate";',
      },
      {
        path: "src/lib/data/b.ts",
        text: 'import { y } from "@/lib/data/signals";',
      },
      { path: "src/lib/data/c.ts", text: 'import { y } from "./signals";' },
      {
        path: "src/lib/data/d.ts",
        text: 'const m = await import("../signals/verdict");',
      },
      { path: "src/app/e/actions.ts", text: 'import "@/lib/signals/types";' },
      {
        path: "src/lib/data/g.ts",
        text: 'import { evaluateRepeatedDocument } from "@/lib/signals/repeated-document";',
      },
      {
        path: "src/app/f/actions.ts",
        text: 'const m = require("@/lib/data/signals");',
      },
    ]);

    expect(flagged).toEqual([
      "src/lib/data/a.ts",
      "src/lib/data/b.ts",
      "src/lib/data/c.ts",
      "src/lib/data/d.ts",
      "src/app/e/actions.ts",
      "src/lib/data/g.ts",
      "src/app/f/actions.ts",
    ]);
  });

  it("does not flag unrelated imports or look-alike names", () => {
    expect(
      importersOfSignals([
        {
          path: "src/lib/data/a.ts",
          text: 'import { x } from "@/lib/data/signals-sql";',
        },
        {
          path: "src/lib/data/b.ts",
          text: 'import { y } from "@/lib/data/solicitudes";',
        },
        {
          path: "src/lib/data/c.ts",
          text: 'import { z } from "some-signals-lib";',
        },
        {
          path: "src/lib/data/d.ts",
          text: "// import from '@/lib/signals/evaluate'",
        },
      ]),
    ).toEqual([]);
  });
});

describe("write paths do not read the signals (No write path reads the signals)", () => {
  it("scans the server actions and the data modules, not the signals loader", () => {
    expect(writePaths.length).toBeGreaterThan(30);
    expect(writePaths).toContain("src/app/(dashboard)/review/[id]/actions.ts");
    expect(writePaths).toContain("src/lib/data/solicitud-decision.ts");
    expect(writePaths).toContain("src/lib/data/documentos.ts");
    expect(writePaths).not.toContain("src/lib/data/signals.ts");
  });

  it("imports nothing from the signals modules in any of them", () => {
    expect(importersOfSignals(writePaths.map(read))).toEqual([]);
  });

  it("makes the throwing stubs real: loading either signal module fails", async () => {
    // vitest wraps the factory's error; either way the import rejects.
    await expect(import("@/lib/data/signals")).rejects.toThrow(
      /error when mocking a module/,
    );
    await expect(import("@/lib/signals/evaluate")).rejects.toThrow(
      /error when mocking a module/,
    );
    await expect(import("@/lib/signals/repeated-document")).rejects.toThrow(
      /error when mocking a module/,
    );
  });

  it("still imports every write-path module with both signal modules throwing", async () => {
    // The environment schema parses at import; no connection is ever opened.
    vi.stubEnv("DATABASE_URL", "postgres://u:p@127.0.0.1:9/x");
    vi.stubEnv("AUTH_SECRET", "x".repeat(32));
    for (const path of writePaths) {
      await expect(
        import(/* @vite-ignore */ `/${path}`),
        path,
      ).resolves.toBeDefined();
    }
  }, 120_000);
});

describe("the queue is untouched (Queue unchanged)", () => {
  it("no queue module imports the signals", () => {
    const queue = [
      ...walk("src/app/(dashboard)/review").filter(
        (path) => !path.includes("/[id]/"),
      ),
      "src/lib/data/revision-queue.ts",
    ];

    expect(queue.length).toBeGreaterThan(5);
    expect(importersOfSignals(queue.map(read))).toEqual([]);
  });
});
