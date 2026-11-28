// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

// NP-15 for the on-read deadlines (design A12): the RN-08 rule modules take the
// remission days, the alert days and the calendar as arguments; the pages and
// the action that need them load once from the loader and derive each value
// with a pure adapter. No module holds the calendar, the days or a registry
// default as a constant.

const SRC_DIR = join(__dirname, "..", "..");
const DEADLINE_MODULES = [
  "lib/intake/business-days.ts",
  "lib/intake/deadline-clock.ts",
  "lib/data/revision-queue.ts",
];
const DEADLINE_CONSUMERS = [
  "app/(dashboard)/review/page.tsx",
  "app/(dashboard)/review/[id]/page.tsx",
  "app/(dashboard)/coordination/[id]/actions.ts",
];

/** The NP-15 violations of an RN-08 rule module or of one of its consumers. */
function deadlineConstantViolations(
  source: string,
  { consumer = false }: { consumer?: boolean } = {},
): string[] {
  const code = withoutComments(source);
  const found: string[] = [];
  for (const specifier of valueImports(code)) {
    if (/^@\/lib\/parameters\/(registry|defaults)$/.test(specifier)) {
      found.push(`value import of ${specifier}`);
    }
    if (specifier === "@/lib/parameters/loader" && !consumer) {
      found.push("a rule module imports the loader");
    }
    if (/(^|\/)intake\/calendar$|^\.\/calendar$/.test(specifier)) {
      found.push("imports the constant calendar");
    }
  }
  if (/\bBUSINESS_DAYS_TO_REMIT\b/.test(code)) {
    found.push("holds the remission days as a constant");
  }
  if (
    /\b(?:DEFAULT_PARAMETERS|PARAMETER_REGISTRY|DEFAULT_NON_WORKING_DAYS|NON_WORKING_DAYS)\b/.test(
      code,
    )
  ) {
    found.push("uses a registry default");
  }
  if (
    /^(?:export\s+)?const\s+\w*calendar\w*\b/im.test(code) ||
    /^(?:export\s+)?const\s+\w+(?::[^=\n]+)?\s*=\s*constantCalendar\(/m.test(
      code,
    )
  ) {
    found.push("module-level calendar constant");
  }
  return found;
}

/** Every non-test TypeScript source under `src`, as `[relative path, text]`. */
function sourceTree(dir = SRC_DIR, base = ""): [string, string][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return sourceTree(path, relative);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [[relative, readFileSync(path, "utf8")] as [string, string]]
      : [];
  });
}

describe("the deadline scan itself (a vacuous scan would prove nothing)", () => {
  it.each([
    [
      'import { x } from "@/lib/parameters/registry";',
      "value import of @/lib/parameters/registry",
    ],
    [
      'import { x } from "@/lib/parameters/defaults";',
      "value import of @/lib/parameters/defaults",
    ],
    [
      'import { getNormativeParameters } from "@/lib/parameters/loader";',
      "a rule module imports the loader",
    ],
    [
      'import { calendar } from "@/lib/intake/calendar";',
      "imports the constant calendar",
    ],
    ['import { calendar } from "./calendar";', "imports the constant calendar"],
    [
      "const BUSINESS_DAYS_TO_REMIT = 2;",
      "holds the remission days as a constant",
    ],
    ["const p = DEFAULT_PARAMETERS;", "uses a registry default"],
    ["const d = DEFAULT_NON_WORKING_DAYS;", "uses a registry default"],
    [
      "const calendar = constantCalendar({});",
      "module-level calendar constant",
    ],
    [
      "export const HOLIDAYS = constantCalendar(DAYS);",
      "module-level calendar constant",
    ],
    [
      "const nonWorkingCalendar: Provider = build();",
      "module-level calendar constant",
    ],
  ])("flags %j as %s", (source, violation) => {
    expect(deadlineConstantViolations(source)).toContain(violation);
  });

  it("lets a consumer import the loader, and ignores comments, locals and types", () => {
    const loader =
      'import { getNormativeParameters } from "@/lib/parameters/loader";';
    const clean = [
      'import type { DeadlineRules } from "@/lib/parameters/derive";',
      "// const calendar = x; BUSINESS_DAYS_TO_REMIT DEFAULT_PARAMETERS",
      "export async function f() {",
      "  const calendar = calendarOf(values);",
      "  return calendar;",
      "}",
    ].join("\n");

    expect(deadlineConstantViolations(loader, { consumer: true })).toEqual([]);
    expect(deadlineConstantViolations(clean)).toEqual([]);
  });
});

describe("the RN-08 rule modules take no constant path (NP-15, A12)", () => {
  it.each(DEADLINE_MODULES)(
    "%s imports no registry default, no loader, no constant calendar and holds no constant",
    (path) => {
      const source = readFileSync(join(SRC_DIR, path), "utf8");

      expect(deadlineConstantViolations(source)).toEqual([]);
    },
  );

  it("business-days.ts requires the remission days and the rules as arguments", () => {
    const code = withoutComments(
      readFileSync(join(SRC_DIR, DEADLINE_MODULES[0]), "utf8"),
    );

    expect(code).toMatch(/businessDays: number/);
    expect(code).toMatch(/rules: DeadlineRules/);
    expect(code).toContain("rules.alertBusinessDays");
  });
});

describe("the constant calendar is gone (NP-15, A12)", () => {
  const tree = sourceTree();

  it("scans a real tree", () => {
    expect(tree.length).toBeGreaterThan(300);
  });

  it("no `src/lib/intake/calendar.ts` module exists, so no `calendar` export remains", () => {
    expect(tree.map(([path]) => path)).not.toContain("lib/intake/calendar.ts");
    expect(existsSync(join(SRC_DIR, "lib", "intake", "calendar.ts"))).toBe(
      false,
    );
  });

  it("no source imports the constant calendar or names the remission-days constant", () => {
    const offenders = tree.flatMap(([path, source]) => {
      const code = withoutComments(source);
      return [
        ...valueImports(code).filter((specifier) =>
          /(^|\/)intake\/calendar$|^\.\/calendar$/.test(specifier),
        ),
        ...(/\bBUSINESS_DAYS_TO_REMIT\b/.test(code)
          ? ["BUSINESS_DAYS_TO_REMIT"]
          : []),
      ].map((what) => `${path}: ${what}`);
    });

    expect(offenders).toEqual([]);
  });
});

describe("the queue, the detail and the answer pause read the loader (A11)", () => {
  const sources = new Map(
    DEADLINE_CONSUMERS.map((path) => [
      path,
      readFileSync(join(SRC_DIR, path), "utf8"),
    ]),
  );

  it.each(DEADLINE_CONSUMERS)(
    "%s holds no constant path: no registry default, no constant calendar, no module-level calendar",
    (path) => {
      expect(
        deadlineConstantViolations(sources.get(path) ?? "", { consumer: true }),
      ).toEqual([]);
    },
  );

  it.each(DEADLINE_CONSUMERS)(
    "%s imports the loader and derives the calendar from what it returns",
    (path) => {
      const code = withoutComments(sources.get(path) ?? "");

      expect(valueImports(code)).toContain("@/lib/parameters/loader");
      expect(code).toContain("calendarOf");
    },
  );

  it.each(DEADLINE_CONSUMERS.slice(0, 2))(
    "%s derives the deadline rules from the same read",
    (path) => {
      const code = withoutComments(sources.get(path) ?? "");

      expect(code).toContain("deadlineRulesOf");
    },
  );
});

// NP-15 for the filing window (design A12): the RN-23 rule modules take the
// window as an argument; the actions and the data function that need it load
// once from the loader and derive the rules with `filingRulesOf`. No module
// holds the window or a registry default as a constant.

const WINDOW_MODULES = [
  "lib/intake/dates.ts",
  "lib/intake/submission.ts",
  "lib/validations/solicitud.ts",
];
const WINDOW_CONSUMERS = [
  "app/(dashboard)/requests/new/step-actions.ts",
  "app/(dashboard)/requests/new/actions.ts",
  "lib/data/solicitud-correction.ts",
];

describe("the filing window is a parameter (NP-15, A12)", () => {
  it("no source names the former window constant", () => {
    const offenders = sourceTree()
      .filter(([, source]) =>
        /\bLATE_WINDOW_DAYS\b/.test(withoutComments(source)),
      )
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it.each(WINDOW_MODULES)(
    "%s imports no registry default and no loader and holds no constant",
    (path) => {
      const source = readFileSync(join(SRC_DIR, path), "utf8");

      expect(deadlineConstantViolations(source)).toEqual([]);
    },
  );

  it("dates.ts requires the window days as an argument", () => {
    const code = withoutComments(
      readFileSync(join(SRC_DIR, WINDOW_MODULES[0]), "utf8"),
    );

    expect(code).toMatch(/windowDays: number/);
  });

  it.each(WINDOW_CONSUMERS)(
    "%s imports the loader, derives the filing rules from it and holds no constant path",
    (path) => {
      const source = readFileSync(join(SRC_DIR, path), "utf8");
      const code = withoutComments(source);

      expect(deadlineConstantViolations(source, { consumer: true })).toEqual(
        [],
      );
      expect(valueImports(code)).toContain("@/lib/parameters/loader");
      expect(code).toContain("filingRulesOf");
    },
  );
});

// NP-15 for the maximum document size (design A12, A19): the data functions
// take `maxBytes` from their caller; the token routes and the two actions load
// once from the loader and derive the bytes with `maxDocumentBytesOf`; the two
// browser components receive the limit as a prop and import no size constant.

const SIZE_CONSUMERS = [
  "app/api/intake/upload-token/route.ts",
  "app/api/review/special-format-token/route.ts",
  "app/(dashboard)/requests/new/step-actions.ts",
  "app/(dashboard)/review/[id]/remission-actions.ts",
];
const SIZE_CLIENTS = [
  "app/(dashboard)/requests/new/documents-step.tsx",
  "app/(dashboard)/review/[id]/special-format-upload.tsx",
];

describe("the maximum document size is a parameter (NP-15, A12)", () => {
  it("no source names the former size constant", () => {
    const offenders = sourceTree()
      .filter(([, source]) =>
        /\bMAX_DOCUMENT_BYTES\b/.test(withoutComments(source)),
      )
      .map(([path]) => path);

    expect(offenders).toEqual([]);
  });

  it.each(SIZE_CONSUMERS)(
    "%s imports the loader and derives the limit from what it returns",
    (path) => {
      const code = withoutComments(readFileSync(join(SRC_DIR, path), "utf8"));

      expect(valueImports(code)).toContain("@/lib/parameters/loader");
      expect(code).toContain("maxDocumentBytesOf");
      expect(valueImports(code)).not.toContain("@/lib/parameters/registry");
      expect(valueImports(code)).not.toContain("@/lib/parameters/defaults");
    },
  );

  it.each(SIZE_CLIENTS)(
    "%s receives the limit as a prop: no size constant, no copy of the number",
    (path) => {
      const code = withoutComments(readFileSync(join(SRC_DIR, path), "utf8"));

      expect(code).not.toMatch(/\bMAX_DOCUMENT_BYTES\b/);
      expect(code).not.toMatch(/10_?485_?760/);
      expect(valueImports(code)).not.toContain("@/lib/parameters/loader");
      expect(valueImports(code)).not.toContain("@/lib/parameters/registry");
    },
  );
});
