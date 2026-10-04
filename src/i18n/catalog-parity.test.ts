import { describe, expect, it } from "vitest";

import enMessages from "../../i18n/en.json";
import esMessages from "../../i18n/es.json";

/**
 * Top-level catalog sections whose es/en key sets must stay identical. Each
 * work unit that adds copy extends this list (the import UI adds
 * `catalog.import`; the sidebar's Administración group adds
 * `nav.administration` and `nav.catalogImport`). Sections are not compared
 * wholesale on purpose: this guards the copy the forced-password-change spec
 * requires.
 */
const GUARDED_SECTIONS = [
  "changePassword",
  "catalog.import",
  "nav.administration",
  "nav.catalogImport",
] as const;

type Node = string | { [key: string]: Node };

function resolve(root: unknown, dotted: string): Node | undefined {
  return dotted
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      root,
    ) as Node | undefined;
}

/** Leaf paths of a catalog subtree, e.g. `errors.wrongCurrent`. */
function leafPaths(node: Node | undefined, prefix = ""): string[] {
  if (node === undefined) return [];
  if (typeof node === "string") return [prefix];
  return Object.entries(node).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function leafValues(node: Node | undefined): string[] {
  if (node === undefined) return [];
  if (typeof node === "string") return [node];
  return Object.values(node).flatMap(leafValues);
}

describe("catalog parity (FPC: Copy in both locales)", () => {
  it.each(GUARDED_SECTIONS)("%s exists in both catalogs", (section) => {
    expect(leafPaths(resolve(esMessages, section)).length).toBeGreaterThan(0);
    expect(leafPaths(resolve(enMessages, section)).length).toBeGreaterThan(0);
  });

  it.each(GUARDED_SECTIONS)(
    "%s has identical deep key sets in es and en",
    (section) => {
      const es = leafPaths(resolve(esMessages, section)).sort();
      const en = leafPaths(resolve(enMessages, section)).sort();

      expect(es).toEqual(en);
    },
  );

  it.each(GUARDED_SECTIONS)(
    "%s holds only non-empty strings in both catalogs",
    (section) => {
      const values = [
        ...leafValues(resolve(esMessages, section)),
        ...leafValues(resolve(enMessages, section)),
      ];

      expect(values.length).toBeGreaterThan(0);
      for (const value of values) {
        expect(typeof value).toBe("string");
        expect(value.trim()).not.toBe("");
      }
    },
  );

  it("changePassword carries every key the screen and its action use", () => {
    const required = [
      "title",
      "subtitle",
      "subtitleForced",
      "currentPasswordLabel",
      "newPasswordLabel",
      "newPasswordHint",
      "confirmPasswordLabel",
      "submit",
      "submitting",
      "errors.invalid",
      "errors.wrongCurrent",
      "errors.weak",
      "errors.mismatch",
      "errors.sameAsCurrent",
      "errors.unexpected",
    ];

    expect(leafPaths(resolve(enMessages, "changePassword")).sort()).toEqual(
      [...required].sort(),
    );
  });
});

describe("catalog parity (CEI: Import UI flow and copy, Locales)", () => {
  // Every `reason` the parser, the zod schemas and the planner can emit (the
  // zod messages are i18n keys by design, see schemas.ts). A reason absent
  // from the catalogs would reach secretaria as a raw code.
  const ROW_REASONS = [
    "codigo.required",
    "codigo.tooLong",
    "codigo.duplicate",
    "nombre.required",
    "nombre.tooLong",
    "carrera.required",
    "carrera.tooLong",
    "carrera.unresolved",
    "horasTotales.required",
    "horasTotales.invalid",
    "correo.required",
    "correo.tooLong",
    "correo.invalid",
    "correo.loginTooLong",
    "correo.duplicate",
    "correo.assignedToOtherRole",
    "telefono.tooLong",
    "login.collision",
    "codigoAsignatura.required",
    "codigoAsignatura.tooLong",
    "periodo.required",
    "periodo.invalid",
    "numGrupo.required",
    "numGrupo.tooLong",
    "correoDocente.required",
    "correoDocente.tooLong",
    "correoDocente.invalid",
    "asignatura.unresolved",
    "docente.unresolved",
    "grupo.duplicate",
    "accountsToCreate.capExceeded",
    "accountEvents.capExceeded",
  ];

  it.each(["es", "en"] as const)(
    "%s translates every row-level reason the import can emit",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const reasons = leafPaths(resolve(messages, "catalog.import.reasons"));

      expect(reasons.sort()).toEqual([...ROW_REASONS].sort());
    },
  );

  it.each(["es", "en"] as const)(
    "%s names the three entities the preview counts",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const entities = leafPaths(resolve(messages, "catalog.import.entities"));

      expect(entities.sort()).toEqual(["Asignatura", "Grupo", "Usuario"]);
    },
  );
});
