import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { CATALOG_FIELD_ERROR_KEYS } from "@/lib/validations/catalog";

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
  "catalog.shared",
  "catalog.asignaturas",
  "nav.catalogAsignaturas",
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
    "asignatura.inactive",
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

  const NEW_KEYS = [
    "preview.reactivations",
    "preview.manualGroups",
    "preview.replacedEdits",
    "preview.busy",
    "result.asignaturasReactivated",
    "result.manualGruposDeactivated",
    "reasons.asignatura.inactive",
  ];
  const text = (locale: "es" | "en", key: string) =>
    resolve(locale === "es" ? esMessages : enMessages, `catalog.import.${key}`);

  it.each(["es", "en"] as const)(
    "%s carries every new import key as a non-empty string",
    (locale) => {
      for (const key of NEW_KEYS) {
        expect(typeof text(locale, key), key).toBe("string");
        expect((text(locale, key) as string).trim(), key).not.toBe("");
      }
    },
  );

  it.each([
    ["es", /cancel/i, /ocupado/, /No se aplicó nada/, /inténtalo de nuevo/],
    ["en", /cancel/i, /busy/, /Nothing was applied/, /try again/],
  ] as const)(
    "%s texts before confirmation say they can be cancelled; busy says what happened",
    (locale, cancel, busy, nothing, retry) => {
      for (const key of [
        "preview.reactivations",
        "preview.manualGroups",
        "preview.replacedEdits",
      ]) {
        expect(text(locale, key), key).toMatch(cancel);
      }
      const message = text(locale, "preview.busy") as string;
      expect(message).toMatch(busy);
      expect(message).toMatch(nothing);
      expect(message).toMatch(retry);
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

describe("catalog parity (CM-I18N-1: shared catalog copy)", () => {
  const SHARED = "catalog.shared";

  it.each(["es", "en"] as const)(
    "%s fieldErrors holds exactly the keys the manual schemas can emit",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const keys = leafPaths(resolve(messages, `${SHARED}.fieldErrors`));

      expect(keys.sort()).toEqual([...CATALOG_FIELD_ERROR_KEYS].sort());
    },
  );

  it.each(["es", "en"] as const)(
    "%s carries the status, toggle and note copy",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      for (const key of [
        "status.active",
        "status.inactive",
        "toggle.deactivate",
        "toggle.reactivate",
        "toggle.confirmTitle",
        "toggle.nothingDeleted",
        "toggle.confirm",
        "toggle.cancel",
        "noCarrera.title",
        "noCarrera.message",
        "importWins",
      ]) {
        const value = resolve(messages, `${SHARED}.${key}`);
        expect(typeof value, key).toBe("string");
      }
    },
  );

  // Each refusal is rendered through the real translator with parameters, so a
  // mistyped placeholder or an unbalanced plural throws here.
  const render = (
    locale: "es" | "en",
    key: string,
    values?: Record<string, string | number>,
  ) =>
    createTranslator({
      locale,
      messages: locale === "es" ? esMessages : enMessages,
      namespace: SHARED as "catalog.shared",
      onError: (error: Error) => {
        throw error;
      },
    })(key as never, values as never) as string;

  it.each([
    ["es", /desactiva/i, /primero/i],
    ["en", /deactivate/i, /first/i],
  ] as const)(
    "%s active-grupos refusal states the count and to deactivate them first",
    (locale, deactivate, first) => {
      for (const count of [1, 3]) {
        const message = render(locale, "refusals.activeGrupos", { count });
        expect(message).toContain(String(count));
        expect(message).toMatch(deactivate);
        expect(message).toMatch(first);
      }
    },
  );

  it.each([
    ["es", /inactivo/i, /reactívalo/i],
    ["en", /inactive/i, /reactivate/i],
  ] as const)(
    "%s duplicate-of-inactive says it exists inactive and to reactivate it",
    (locale, inactive, reactivate) => {
      const message = render(locale, "refusals.duplicateInactive");
      expect(message).toMatch(inactive);
      expect(message).toMatch(reactivate);
    },
  );

  it.each(["es", "en"] as const)(
    "%s generic duplicate does not mention reactivation, state or carrera",
    (locale) => {
      const message = render(locale, "refusals.duplicate");
      expect(message).not.toMatch(/reactiv|inactiv|activ|carrera|career/i);
    },
  );

  it.each([
    ["es", /no tiene .*carrera/i, /administra|coordinaci|secretar/i],
    ["en", /no Carrera/i, /administrator|ask|contact/i],
  ] as const)(
    "%s no-carrera says none is assigned and who to ask",
    (locale, none, who) => {
      const message = render(locale, "noCarrera.message");
      expect(message).toMatch(none);
      expect(message).toMatch(who);
    },
  );

  it.each([
    ["es", "refusals.parentInactive.asignatura", /primero/i],
    ["es", "refusals.parentInactive.docente", /primero/i],
    ["en", "refusals.parentInactive.asignatura", /first/i],
    ["en", "refusals.parentInactive.docente", /first/i],
  ] as const)(
    "%s %s names the parent and says to fix it first",
    (locale, key, first) => {
      const message = render(locale, key, { parent: "MAT101 Calculus" });
      expect(message).toContain("MAT101 Calculus");
      expect(message).toMatch(first);
    },
  );

  it.each([
    ["es", /no se guard/i, /inténtalo de nuevo/i],
    ["en", /nothing was saved/i, /try again/i],
  ] as const)(
    "%s busy says nothing was saved and to try again",
    (locale, nothing, retry) => {
      const message = render(locale, "busy");
      expect(message).toMatch(nothing);
      expect(message).toMatch(retry);
    },
  );

  it.each([
    ["es", "refusals.inactive", /reactívalo/i, /primero/i],
    ["en", "refusals.inactive", /reactivate/i, /first/i],
  ] as const)(
    "%s edit of an inactive record says to reactivate it first (A-1)",
    (locale, key, reactivate, first) => {
      const message = render(locale, key);
      expect(message).toMatch(reactivate);
      expect(message).toMatch(first);
    },
  );

  it.each(["es", "en"] as const)(
    "%s tells the user when nothing changed or the record is already inactive (A-3)",
    (locale) => {
      expect(render(locale, "refusals.unchanged").length).toBeGreaterThan(0);
      expect(render(locale, "refusals.alreadyInactive").length).toBeGreaterThan(
        0,
      );
    },
  );
});

describe("catalog parity (CM-I18N-1, CM-LST-1: Asignaturas list copy)", () => {
  // The list keys only; form and action copy arrive with their own units. The
  // no-Carrera state reuses `catalog.shared.noCarrera`.
  const LIST_KEYS = [
    "title",
    "subtitle",
    "newButton",
    "columns.code",
    "columns.name",
    "columns.career",
    "columns.hours",
    "columns.status",
    "columns.actions",
    "edit",
    "empty",
    "noResults.title",
    "noResults.titleStatus",
    "noResults.hint",
    "degraded",
    "search.label",
    "search.placeholder",
    "search.submit",
    "search.clear",
    "count",
    "tableCaption",
    "pagination.region",
    "pagination.previous",
    "pagination.next",
    "pagination.status",
  ];

  it.each(["es", "en"] as const)(
    "%s carries exactly the list keys",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;

      expect(
        leafPaths(resolve(messages, "catalog.asignaturas"))
          .filter(
            (path) => !/^(errors|form|page|breadcrumb|state)\./.test(path),
          )
          .sort(),
      ).toEqual([...LIST_KEYS].sort());
    },
  );

  // Rendered through the real translator, so a mistyped placeholder or an
  // unbalanced plural throws here.
  it.each(["es", "en"] as const)(
    "%s renders its parameterised keys",
    (locale) => {
      const t = createTranslator({
        locale,
        messages: locale === "es" ? esMessages : enMessages,
        namespace: "catalog.asignaturas",
        onError: (error: Error) => {
          throw error;
        },
      });

      expect(t("noResults.title", { q: "calc" })).toContain("calc");
      expect(t("pagination.status", { page: 2, pages: 5 })).toMatch(/2.*5/);
      for (const count of [0, 1, 7]) {
        expect(t("count", { count }).trim()).not.toBe("");
      }
      expect(t("count", { count: 7 })).toContain("7");
    },
  );

  it.each(["es", "en"] as const)(
    "%s degraded notice says the data could not be loaded, without a raw error",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const text = resolve(messages, "catalog.asignaturas.degraded") as string;

      expect(text).toMatch(locale === "es" ? /no se pudieron/i : /could not/i);
      expect(text).not.toMatch(/exception|ECONN|stack/i);
    },
  );
});

describe("catalog parity (CM-I18N-1: Asignatura action copy)", () => {
  // The test translator of `actions.test.ts` echoes keys, so only a scan of the
  // action source can prove every message key it chooses exists in the catalogs.
  const source = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/catalog/asignaturas/actions.ts"),
    "utf8",
  );
  const used = [
    ...new Set(
      [...source.matchAll(/"((?:shared|asignaturas)\.[A-Za-z.]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];

  it("the scan finds the keys the actions choose, reusing the shared refusals", () => {
    expect(used).toEqual(
      expect.arrayContaining([
        "asignaturas.errors.unexpected",
        "shared.noCarrera.message",
        "shared.refusals.activeGrupos",
        "shared.refusals.duplicate",
        "shared.refusals.duplicateInactive",
        "shared.fieldErrors.carreraId.invalid",
      ]),
    );
  });

  it.each(["es", "en"] as const)(
    "%s carries every message key the action source uses",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      for (const key of used) {
        expect(typeof resolve(messages, `catalog.${key}`), key).toBe("string");
      }
    },
  );

  it.each(["es", "en"] as const)(
    "%s action errors hold only the generic message, with no raw error wording",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const errors = resolve(messages, "catalog.asignaturas.errors");

      expect(leafPaths(errors)).toEqual(["unexpected"]);
      expect((errors as Record<string, string>).unexpected).not.toMatch(
        /exception|ECONN|stack|sql/i,
      );
    },
  );
});

describe("catalog parity (CM-I18N-1, CM-UX-1: Asignatura form, toggle and page copy)", () => {
  const section = (locale: "es" | "en", path: string) =>
    resolve(locale === "es" ? esMessages : enMessages, path);
  const keysOf = (locale: "es" | "en", path: string) =>
    leafPaths(section(locale, path)).sort();

  const FORM_KEYS = [
    "carreraFixedHint",
    "carreraLabel",
    "carreraPlaceholder",
    "codigoHint",
    "codigoLabel",
    "horasLabel",
    "nombreLabel",
    "submitCreate",
    "submitSave",
    "submitting",
  ];
  const PAGE_KEYS = [
    "page.editSubtitle",
    "page.editTitle",
    "page.newSubtitle",
    "page.newTitle",
    "page.reactivateHint",
    "breadcrumb.edit",
    "breadcrumb.label",
    "breadcrumb.new",
    "state.activeGroups",
    "state.title",
  ];

  it.each(["es", "en"] as const)("%s pins exactly the form keys", (locale) => {
    expect(keysOf(locale, "catalog.asignaturas.form")).toEqual(FORM_KEYS);
  });

  it.each(["es", "en"] as const)(
    "%s pins exactly the page, breadcrumb and state keys",
    (locale) => {
      const paths = leafPaths(section(locale, "catalog.asignaturas"))
        .filter((path) => /^(page|breadcrumb|state)\./.test(path))
        .sort();

      expect(paths).toEqual([...PAGE_KEYS].sort());
    },
  );

  it("the toggle keys have identical sets in es and en", () => {
    expect(keysOf("es", "catalog.shared.toggle")).toEqual(
      keysOf("en", "catalog.shared.toggle"),
    );
    expect(keysOf("en", "catalog.shared.toggle")).toEqual([
      "cancel",
      "confirm",
      "confirmTitle",
      "deactivate",
      "nothingDeleted",
      "reactivate",
    ]);
  });

  it.each([
    ["es", /no se elimina nada/i, /reactiv/i],
    ["en", /nothing is deleted/i, /reactivate/i],
  ] as const)(
    "%s confirmation sentence says nothing is deleted and that it can be reactivated",
    (locale, nothing, reactivate) => {
      const text = section(locale, "catalog.shared.toggle.nothingDeleted");

      expect(text).toMatch(nothing);
      expect(text).toMatch(reactivate);
    },
  );

  const translate = (locale: "es" | "en") =>
    createTranslator({
      locale,
      messages: locale === "es" ? esMessages : enMessages,
      namespace: "catalog.asignaturas",
      onError: (error: Error) => {
        throw error;
      },
    });

  it.each([
    ["es", /desactiv/i, /antes/i],
    ["en", /deactivate/i, /before/i],
  ] as const)(
    "%s active-groups sentence states the count and to deactivate them first",
    (locale, deactivate, before) => {
      const t = translate(locale);

      for (const count of [1, 3, 12]) {
        const text = t("state.activeGroups", { count });
        expect(text).toContain(String(count));
        expect(text).toMatch(deactivate);
        expect(text).toMatch(before);
      }
      const none = t("state.activeGroups", { count: 0 });
      expect(none).not.toMatch(/\d/);
      expect(none.trim()).not.toBe("");
    },
  );

  it.each(["es", "en"] as const)(
    "%s breadcrumb names the record being edited",
    (locale) => {
      expect(
        translate(locale)("breadcrumb.edit", { codigo: "MAT101" }),
      ).toContain("MAT101");
    },
  );

  it.each([
    ["es", /react[ií]v/i, /estado/i],
    ["en", /reactivate/i, /status/i],
  ] as const)(
    "%s inactive hint points to the State section to reactivate",
    (locale, reactivate, stateWord) => {
      const text = section(locale, "catalog.asignaturas.page.reactivateHint");

      expect(text).toMatch(reactivate);
      expect(text).toMatch(stateWord);
    },
  );
});
