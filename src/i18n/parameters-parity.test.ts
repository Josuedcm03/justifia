import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";

// NP-17 (normative-parameters): every text of the parameters screen, its errors
// and its sidebar entry exists in both locales with identical keys, the same
// placeholders and a non-empty message; es is neutral professional Spanish with
// no voseo; a message that states a bound takes it as a placeholder.

function leaves(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (typeof value !== "object" || value === null) return [[prefix, ""]];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

function resolve(root: unknown, dotted: string): unknown {
  return dotted
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      root,
    );
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

const catalogs = [
  ["es", es],
  ["en", en],
] as const;

/** The state and error copy the four actions answer with. */
const REQUIRED_KEYS = [
  "state.saved",
  "state.unchanged",
  "state.busy",
  "errors.unexpected",
  "errors.invalid",
  "errors.required",
  "errors.not_integer",
  "errors.too_low",
  "errors.too_high",
  "errors.alert_not_below_remission",
  "errors.calendar.date_invalid",
  "errors.calendar.date_duplicate",
  "errors.calendar.description_too_long",
  "errors.calendar.too_many",
  "errors.calendar.invalid",
  "errors.map.invalid",
];

describe("parameters copy: key parity (NP-17)", () => {
  it("has the same keys in es and en", () => {
    const keys = (catalog: unknown) =>
      leaves(resolve(catalog, "parameters"))
        .map(([key]) => key)
        .sort();

    expect(keys(es).length).toBeGreaterThan(0);
    expect(keys(es)).toEqual(keys(en));
  });

  it.each(catalogs)("%s holds only non-empty strings", (_locale, catalog) => {
    for (const [key, text] of leaves(resolve(catalog, "parameters"))) {
      expect(text.trim(), key).not.toBe("");
    }
  });

  it("uses the same placeholders in both locales for every message", () => {
    const english = new Map(leaves(resolve(en, "parameters")));

    for (const [key, text] of leaves(resolve(es, "parameters"))) {
      expect(placeholders(text), key).toEqual(
        placeholders(english.get(key) ?? ""),
      );
    }
  });

  it.each(catalogs)("%s carries every key the actions answer with", (_l, c) => {
    for (const key of REQUIRED_KEYS) {
      expect(resolve(c, `parameters.${key}`), key).toEqual(expect.any(String));
    }
  });

  it.each(catalogs)(
    "%s states the allowed range in every scalar error (NP-7)",
    (_l, c) => {
      for (const code of ["required", "not_integer", "too_low", "too_high"]) {
        const text = String(resolve(c, `parameters.errors.${code}`));

        expect(text, code).toContain("{min}");
        expect(text, code).toContain("{max}");
      }
    },
  );

  it("names the sidebar entry in both locales (BS-NAV-1)", () => {
    expect(es.nav).toHaveProperty("parameters", "Parámetros normativos");
    expect(en.nav).toHaveProperty("parameters", "Normative parameters");
  });
});

describe("parameters copy: neutral professional Spanish", () => {
  it("has no voseo", () => {
    const text = [
      ...leaves(resolve(es, "parameters")),
      ["nav.parameters", String(resolve(es, "nav.parameters"))],
    ]
      .map(([, value]) => value)
      .join(" ");

    expect(text).not.toMatch(
      /(\bvos\b|tenés|podés|querés|sabés|\bsos\b|mirá|revisá|fijate|hacé|verificá|contactá|ingresá|escribí|elegí|intentá|probá|guardá|\bche\b)/i,
    );
  });
});

describe("every parameters key the actions use exists (NP-17)", () => {
  const source = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/parameters/actions.ts"),
    "utf8",
  );
  const used = [...source.matchAll(/"(parameters\.[\w.]+)"/g)].map((m) => m[1]);

  it("finds the keys in the source (a vacuous scan would prove nothing)", () => {
    expect(used.length).toBeGreaterThan(0);
  });

  it.each(catalogs)("%s has them all", (_locale, catalog) => {
    for (const key of used) {
      expect(resolve(catalog, key), key).toEqual(expect.any(String));
    }
  });
});
