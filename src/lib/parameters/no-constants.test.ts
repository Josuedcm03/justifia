// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Structural proof of NP-5 and NP-15: the parameters module keeps no value
// between two requests. A saved value must reach the next request of any
// instance, so the module may not use the framework data cache, a module-level
// store or a timer. This file grows in later slices with the consumer scans.

const PARAMETERS_DIR = __dirname;

/** Source text with `/* ... *\/` and `// ...` comments blanked out. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** The NP-5 violations found in the source text of one module. */
function cacheViolations(source: string): string[] {
  const code = withoutComments(source);
  const found: string[] = [];
  if (/unstable_cache/.test(code)) found.push("unstable_cache");
  if (/["']use cache(?::\s*\w+)?["']/.test(code)) found.push("use cache");
  if (/^(?:export\s+)?(?:let|var)\s/m.test(code)) {
    found.push("module-level mutable binding");
  }
  if (
    /^(?:export\s+)?const\s+\w+(?::[^=\n]+)?\s*=\s*new\s+(?:Weak)?(?:Map|Set)\b/m.test(
      code,
    )
  ) {
    found.push("module-level collection");
  }
  if (/\b(?:setTimeout|setInterval|setImmediate)\b/.test(code)) {
    found.push("timer");
  }
  return found;
}

function productionSources(): { name: string; source: string }[] {
  return readdirSync(PARAMETERS_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({
      name,
      source: readFileSync(join(PARAMETERS_DIR, name), "utf8"),
    }));
}

describe("the scan itself (a vacuous scan would prove nothing)", () => {
  it.each([
    ['import { unstable_cache } from "next/cache";', "unstable_cache"],
    ['"use cache";\nexport async function f() {}', "use cache"],
    ['"use cache: remote"\nexport const x = 1;', "use cache"],
    ["let memo = null;", "module-level mutable binding"],
    ["export var memo = 1;", "module-level mutable binding"],
    ["const store = new Map();", "module-level collection"],
    ["export const seen: Set<string> = new Set();", "module-level collection"],
    ["const gone = new WeakMap<object, number>();", "module-level collection"],
    ["setInterval(refresh, 1000);", "timer"],
    ["const t = setTimeout(refresh, 10);", "timer"],
  ])("flags %j as %s", (source, violation) => {
    expect(cacheViolations(source)).toContain(violation);
  });

  it("ignores comments, locals and plain constants", () => {
    const source = [
      "// let memo = null; unstable_cache setTimeout",
      "/* const store = new Map(); */",
      "export const DEFAULTS = { days: 2 } as const;",
      "export function read() {",
      "  const seen = new Set<string>();",
      "  let count = 0;",
      "  return [seen, count];",
      "}",
    ].join("\n");

    expect(cacheViolations(source)).toEqual([]);
  });
});

describe("src/lib/parameters keeps no value across requests (NP-5)", () => {
  const sources = productionSources();

  it("scans the registry, the defaults, the derive adapters and the loader", () => {
    const names = sources.map((s) => s.name);

    expect(names).toEqual(
      expect.arrayContaining([
        "registry.ts",
        "defaults.ts",
        "derive.ts",
        "loader.ts",
      ]),
    );
  });

  it.each(["registry.ts", "defaults.ts", "derive.ts", "loader.ts"])(
    "%s uses no data cache, no module-level store and no timer",
    (name) => {
      const entry = sources.find((s) => s.name === name);

      expect(entry).toBeDefined();
      expect(cacheViolations(entry?.source ?? "")).toEqual([]);
    },
  );

  it("every parameters source is clean, whichever file a later slice adds", () => {
    const violations = sources.flatMap(({ name, source }) =>
      cacheViolations(source).map((v) => `${name}: ${v}`),
    );

    expect(violations).toEqual([]);
  });
});

// NP-15 for the on-read signals (design A10, A11, A12): the rule modules take
// every value as an argument and never reach for a registry default, the
// constant calendar or the deadline number of RN-08; the one data reader that
// assembles them gets everything from the loader.

const SIGNALS_DIR = join(__dirname, "..", "signals");
const SIGNALS_READER = join(__dirname, "..", "data", "signals.ts");

/** The module specifiers imported by a value (not `import type`) statement. */
function valueImports(code: string): string[] {
  return [...code.matchAll(/import\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/g)]
    .filter((match) => match[1] === undefined)
    .map((match) => match[2]);
}

/** The NP-15 violations of a signals rule module (or of the reader). */
function constantPathViolations(
  source: string,
  { reader = false }: { reader?: boolean } = {},
): string[] {
  const code = withoutComments(source);
  const found: string[] = [];
  for (const specifier of valueImports(code)) {
    if (/^@\/lib\/parameters\/(registry|defaults|loader)$/.test(specifier)) {
      if (!reader || specifier !== "@/lib/parameters/loader") {
        found.push(`value import of ${specifier}`);
      }
    }
    if (specifier === "@/lib/intake/calendar") {
      found.push("imports the constant calendar");
    }
  }
  if (/\b(?:DEFAULT_PARAMETERS|PARAMETER_REGISTRY)\b/.test(code)) {
    found.push("uses a registry default");
  }
  if (/\b(?:BUSINESS_DAYS_TO_REMIT|deadlineOf)\b/.test(code)) {
    found.push("uses the RN-08 deadline number");
  }
  if (reader && /\bDEFAULT_SIGNAL_PARAMS\b/.test(code)) {
    found.push("uses DEFAULT_SIGNAL_PARAMS");
  }
  return found;
}

describe("the constant-path scan itself (a vacuous scan would prove nothing)", () => {
  it.each([
    [
      'import { DEFAULT_PARAMETERS } from "@/lib/parameters/registry";',
      "value import of @/lib/parameters/registry",
    ],
    [
      'import { x } from "@/lib/parameters/defaults";',
      "value import of @/lib/parameters/defaults",
    ],
    [
      'import {\n  getNormativeParameters,\n} from "@/lib/parameters/loader";',
      "value import of @/lib/parameters/loader",
    ],
    [
      'import { calendar } from "@/lib/intake/calendar";',
      "imports the constant calendar",
    ],
    ["const p = DEFAULT_PARAMETERS.nonWorkingDays;", "uses a registry default"],
    ["const r = PARAMETER_REGISTRY.alerta_dias;", "uses a registry default"],
    [
      'import { deadlineOf } from "@/lib/intake/business-days";',
      "uses the RN-08 deadline number",
    ],
    ["const n = BUSINESS_DAYS_TO_REMIT;", "uses the RN-08 deadline number"],
  ])("flags %j as %s", (source, violation) => {
    expect(constantPathViolations(source)).toContain(violation);
  });

  it("flags DEFAULT_SIGNAL_PARAMS and a constant calendar in the reader only", () => {
    const source =
      'const p = DEFAULT_SIGNAL_PARAMS;\nimport { calendar } from "@/lib/intake/calendar";';

    expect(constantPathViolations(source, { reader: true })).toEqual(
      expect.arrayContaining([
        "uses DEFAULT_SIGNAL_PARAMS",
        "imports the constant calendar",
      ]),
    );
    expect(constantPathViolations(source)).not.toContain(
      "uses DEFAULT_SIGNAL_PARAMS",
    );
  });

  it("lets the reader import the loader and anyone import a type", () => {
    const loader =
      'import { getNormativeParameters } from "@/lib/parameters/loader";';
    const types = [
      'import type { TimingParams } from "@/lib/parameters/derive";',
      'import type { NormativeParameters } from "@/lib/parameters/registry";',
      "// uses DEFAULT_PARAMETERS in a comment only",
    ].join("\n");

    expect(constantPathViolations(loader, { reader: true })).toEqual([]);
    expect(constantPathViolations(types)).toEqual([]);
  });
});

describe("the signals rule modules take no constant path (NP-15, A12)", () => {
  const sources = readdirSync(SIGNALS_DIR)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => ({
      name,
      source: readFileSync(join(SIGNALS_DIR, name), "utf8"),
    }));

  it("scans the RN-07, RN-13 and RN-14 modules and the evaluation", () => {
    expect(sources.map((s) => s.name)).toEqual(
      expect.arrayContaining([
        "timing.ts",
        "evaluate.ts",
        "issuer.ts",
        "document-marks.ts",
        "params.ts",
      ]),
    );
  });

  it("imports no registry default, no constant calendar and no RN-08 number", () => {
    const violations = sources.flatMap(({ name, source }) =>
      constantPathViolations(source).map((v) => `${name}: ${v}`),
    );

    expect(violations).toEqual([]);
  });

  it("keeps the RN-07 deadline off the remission number: timing.ts counts its own days", () => {
    const timing = sources.find((s) => s.name === "timing.ts");

    expect(timing).toBeDefined();
    expect(withoutComments(timing?.source ?? "")).toContain(
      "timing.lateFilingBusinessDays",
    );
  });
});

describe("the signals read assembles from the loader only (A11)", () => {
  const reader = readFileSync(SIGNALS_READER, "utf8");

  it("imports the loader and derives the three inputs from what it returns", () => {
    const code = withoutComments(reader);

    expect(valueImports(code)).toContain("@/lib/parameters/loader");
    for (const adapter of ["signalParamsOf", "timingParamsOf", "calendarOf"]) {
      expect(code).toContain(adapter);
    }
  });

  it("holds no constant path: no registry default, no constant calendar, no code params", () => {
    expect(constantPathViolations(reader, { reader: true })).toEqual([]);
  });
});
