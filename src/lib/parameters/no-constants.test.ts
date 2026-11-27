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
