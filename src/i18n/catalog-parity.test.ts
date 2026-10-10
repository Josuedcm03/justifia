import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { DIAS_SEMANA } from "@/lib/catalog/dias";
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
  "catalog.grupos.errors",
  "nav.catalogGrupos",
  "catalog.grupos",
  "nav.catalogDocentes",
  "catalog.docentes",
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
    "dias.invalid",
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

  // CEI-DIAS-4 (Locale parity), CM-I18N-1: the days column documents itself in
  // the contract card and names the offending token in its row error.
  it.each(["es", "en"] as const)(
    "%s carries the days contract rules and the dias.invalid reason as non-empty strings",
    (locale) => {
      for (const key of [
        "contract.rules.diasTokens",
        "contract.rules.diasEffect",
        "reasons.dias.invalid",
      ]) {
        expect(typeof text(locale, key), key).toBe("string");
        expect((text(locale, key) as string).trim(), key).not.toBe("");
      }
    },
  );

  it("the contract rules hold the same seven keys in es and en", () => {
    const es = leafPaths(resolve(esMessages, "catalog.import.contract.rules"));
    const en = leafPaths(resolve(enMessages, "catalog.import.contract.rules"));

    expect(es.sort()).toEqual(en.sort());
    expect(es).toContain("diasTokens");
    expect(es).toContain("diasEffect");
    expect(es).toHaveLength(7);
  });

  it.each([
    ["es", /lunes/i, /\bLun\b/, /Domingo/i, /\bDom\b/, /coma/i],
    ["en", /lunes/i, /\bLun\b/, /Domingo/i, /\bDom\b/, /comma/i],
  ] as const)(
    "%s diasTokens lists the Spanish day names and abbreviations separated by commas",
    (locale, monday, mondayShort, sunday, sundayShort, comma) => {
      const message = text(locale, "contract.rules.diasTokens") as string;

      expect(message).toMatch(monday);
      expect(message).toMatch(mondayShort);
      expect(message).toMatch(sunday);
      expect(message).toMatch(sundayShort);
      expect(message).toMatch(comma);
    },
  );

  it.each([
    [
      "es",
      /columna/i,
      /omites la columna/i,
      /reemplaza/i,
      /vac[ií]a/i,
      /nunca/i,
    ],
    ["en", /column/i, /leave the column out/i, /replaces/i, /empty/i, /never/i],
  ] as const)(
    "%s diasEffect states what an absent column, a filled cell and an empty cell do, and that days are never cleared",
    (locale, column, absent, replaces, empty, never) => {
      const message = text(locale, "contract.rules.diasEffect") as string;

      expect(message).toMatch(column);
      expect(message).toMatch(absent);
      expect(message).toMatch(replaces);
      expect(message).toMatch(empty);
      expect(message).toMatch(never);
    },
  );

  it.each(["es", "en"] as const)(
    "%s dias.invalid carries the {value} placeholder",
    (locale) => {
      expect(text(locale, "reasons.dias.invalid")).toContain("{value}");
    },
  );

  it.each(["es", "en"] as const)(
    "%s names the offending token when dias.invalid is rendered by the real translator",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const t = createTranslator({
        locale,
        messages,
        namespace: "catalog.import",
        onError: (error) => {
          throw error;
        },
      });

      expect(t("reasons.dias.invalid", { value: "Funday" })).toContain(
        "Funday",
      );
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

  // Amendment 2026-10-09: the create actions answer a duplicate as a field
  // error, so these four keys are emitted by the actions, not by the schemas.
  const DUPLICATE_FIELD_ERRORS = [
    "codigo.taken",
    "codigo.takenInactive",
    "numGrupo.taken",
    "numGrupo.takenInactive",
  ];

  it.each(["es", "en"] as const)(
    "%s fieldErrors holds exactly the keys the manual schemas and the duplicate refusals can emit",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const keys = leafPaths(resolve(messages, `${SHARED}.fieldErrors`));

      expect(keys.sort()).toEqual(
        [...CATALOG_FIELD_ERROR_KEYS, ...DUPLICATE_FIELD_ERRORS].sort(),
      );
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
    ["es", "codigo", /inactiva/i, /reactívala/i],
    ["en", "codigo", /inactive/i, /reactivate/i],
    ["es", "numGrupo", /inactivo/i, /reactívalo/i],
    ["en", "numGrupo", /inactive/i, /reactivate/i],
  ] as const)(
    "%s duplicate-of-inactive %s says it exists inactive and to reactivate it",
    (locale, field, inactive, reactivate) => {
      const message = render(locale, `fieldErrors.${field}.takenInactive`);
      expect(message).toMatch(inactive);
      expect(message).toMatch(reactivate);
    },
  );

  it.each([
    ["es", "codigo", /asignatura.*código/i],
    ["en", "codigo", /subject.*code/i],
    ["es", "numGrupo", /grupo.*período.*número.*asignatura/i],
    ["en", "numGrupo", /group.*period.*number.*subject/i],
  ] as const)(
    "%s duplicate %s names the conflicting key and not the state, carrera or any value",
    (locale, field, key) => {
      for (const variant of ["taken", "takenInactive"]) {
        expect(render(locale, `fieldErrors.${field}.${variant}`)).toMatch(key);
      }
      const message = render(locale, `fieldErrors.${field}.taken`);
      expect(message).not.toMatch(/reactiv|inactiv|carrera|career/i);
    },
  );

  it.each(["es", "en"] as const)(
    "%s no longer carries the generic form-level duplicate refusals",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const refusals = resolve(messages, `${SHARED}.refusals`) as Record<
        string,
        unknown
      >;
      expect(refusals).not.toHaveProperty("duplicate");
      expect(refusals).not.toHaveProperty("duplicateInactive");
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
    ["es", /al menos un día/i, /selecciona/i],
    ["en", /at least one/i, /select/i],
  ] as const)(
    "%s dias.required says one meeting day is required and to select one",
    (locale, required, select) => {
      const message = render(locale, "fieldErrors.dias.required");
      expect(message).toMatch(required);
      expect(message).toMatch(select);
    },
  );

  it.each([
    ["es", /no es un día de la semana/i],
    ["en", /not a day of the week/i],
  ] as const)(
    "%s dias.invalid says the value is not a day of the week",
    (locale, notADay) => {
      expect(render(locale, "fieldErrors.dias.invalid")).toMatch(notADay);
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
    "columns.groups",
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
            (path) =>
              !/^(errors|form|page|breadcrumb|state|grupos)\./.test(path),
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

describe("catalog parity (CM-I18N-1, CM-ASG-7: Grupos section copy of the Asignatura edit page)", () => {
  const GRUPOS = "catalog.asignaturas.grupos";
  const KEYS = [
    "title",
    "add",
    "empty",
    "inactiveHint",
    "tableCaption",
    "editLabel",
    "truncated",
    "viewAll",
    "degraded",
  ];
  const messagesOf = (locale: "es" | "en") =>
    locale === "es" ? esMessages : enMessages;

  it.each(["es", "en"] as const)("%s holds exactly the nine keys", (locale) => {
    expect(leafPaths(resolve(messagesOf(locale), GRUPOS)).sort()).toEqual(
      [...KEYS].sort(),
    );
  });

  it("has identical key sets and no empty value in both locales", () => {
    expect(leafPaths(resolve(esMessages, GRUPOS)).sort()).toEqual(
      leafPaths(resolve(enMessages, GRUPOS)).sort(),
    );
    for (const locale of ["es", "en"] as const) {
      const values = leafValues(resolve(messagesOf(locale), GRUPOS));
      expect(values).toHaveLength(KEYS.length);
      for (const value of values) expect(value.trim()).not.toBe("");
    }
  });

  it.each([
    ["tableCaption", ["{codigo}"]],
    ["editLabel", ["{periodo}", "{numeroGrupo}"]],
    ["truncated", ["{max}"]],
  ] as const)("%s carries its placeholders in both locales", (key, holes) => {
    for (const locale of ["es", "en"] as const) {
      const text = resolve(messagesOf(locale), `${GRUPOS}.${key}`) as string;
      for (const hole of holes)
        expect(text, `${locale} ${key}`).toContain(hole);
    }
  });

  it.each(["es", "en"] as const)(
    "%s renders the parameterised keys through the real translator",
    (locale) => {
      const t = createTranslator({
        locale,
        messages: messagesOf(locale),
        namespace: GRUPOS as "catalog.asignaturas.grupos",
        onError: (error: Error) => {
          throw error;
        },
      });

      expect(t("tableCaption", { codigo: "MAT101" })).toContain("MAT101");
      const edit = t("editLabel", { periodo: "2026-S1", numeroGrupo: "G7" });
      expect(edit).toContain("2026-S1");
      expect(edit).toContain("G7");
      expect(t("truncated", { max: 100 })).toContain("100");
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
        "shared.fieldErrors.codigo.taken",
        "shared.fieldErrors.codigo.takenInactive",
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

describe("catalog parity (CM-I18N-1: Grupo action copy)", () => {
  // Same scan as the Asignatura one: the test translator of the action suite
  // echoes keys, so only the source proves every chosen key exists.
  const source = readFileSync(
    join(process.cwd(), "src/app/(dashboard)/catalog/grupos/actions.ts"),
    "utf8",
  );
  const used = [
    ...new Set(
      [...source.matchAll(/"((?:shared|grupos)\.[A-Za-z.]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ];

  it("the scan finds the keys the Grupo actions choose, reusing the shared refusals", () => {
    expect(used).toEqual(
      expect.arrayContaining([
        "grupos.errors.unexpected",
        "shared.noCarrera.message",
        "shared.fieldErrors.numGrupo.taken",
        "shared.fieldErrors.numGrupo.takenInactive",
        "shared.refusals.parentInactive.asignatura",
        "shared.refusals.parentInactive.docente",
        "shared.fieldErrors.asignaturaId.invalid",
        "shared.fieldErrors.docenteId.invalid",
      ]),
    );
  });

  it.each(["es", "en"] as const)(
    "%s carries every message key the Grupo action source uses",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      for (const key of used) {
        expect(typeof resolve(messages, `catalog.${key}`), key).toBe("string");
      }
    },
  );

  it.each(["es", "en"] as const)(
    "%s Grupo action errors hold only the generic message, with no raw error wording",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const errors = resolve(messages, "catalog.grupos.errors");

      expect(leafPaths(errors)).toEqual(["unexpected"]);
      expect((errors as Record<string, string>).unexpected).not.toMatch(
        /exception|ECONN|stack|sql/i,
      );
    },
  );

  it.each([
    ["es", /no se pudo guardar/i, /inténtalo de nuevo/i],
    ["en", /could not be saved/i, /try again/i],
  ] as const)(
    "%s generic Grupo error says the change was not saved and to try again",
    (locale, notSaved, retry) => {
      const message = resolve(
        locale === "es" ? esMessages : enMessages,
        "catalog.grupos.errors.unexpected",
      ) as string;

      expect(message).toMatch(notSaved);
      expect(message).toMatch(retry);
    },
  );

  // The refusals the Grupo actions name (which parent, duplicate of an
  // inactive group, no Carrera, busy) all live in `catalog.shared`; their
  // content is asserted by the shared copy tests above, and the scan here
  // proves the Grupo actions choose only keys that exist.
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

describe("catalog parity (CM-GRP-6, CM-GRP-7, CM-I18N-1: day names)", () => {
  const DIAS = "catalog.shared.dias";
  const section = (locale: "es" | "en", path: string) =>
    resolve(locale === "es" ? esMessages : enMessages, path);

  const EXPECTED = {
    es: {
      long: [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
        "Domingo",
      ],
      short: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
    },
    en: {
      long: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      short: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
  } as const;

  it.each(["es", "en"] as const)(
    "%s holds exactly the DIAS_SEMANA codes under long and short, plus notSet",
    (locale) => {
      expect(leafPaths(section(locale, DIAS)).sort()).toEqual(
        [
          ...DIAS_SEMANA.map((dia) => `long.${dia}`),
          ...DIAS_SEMANA.map((dia) => `short.${dia}`),
          "notSet",
        ].sort(),
      );
    },
  );

  it("has identical key sets in es and en and no empty value", () => {
    expect(leafPaths(section("es", DIAS)).sort()).toEqual(
      leafPaths(section("en", DIAS)).sort(),
    );
    for (const locale of ["es", "en"] as const) {
      const values = leafValues(section(locale, DIAS));
      expect(values.length).toBe(DIAS_SEMANA.length * 2 + 1);
      for (const value of values) expect(value.trim()).not.toBe("");
    }
  });

  it.each(["es", "en"] as const)(
    "%s renders the day names in week order",
    (locale) => {
      const t = createTranslator({
        locale,
        messages: locale === "es" ? esMessages : enMessages,
        namespace: DIAS as "catalog.shared.dias",
        onError: (error: Error) => {
          throw error;
        },
      });

      expect(DIAS_SEMANA.map((dia) => t(`long.${dia}`))).toEqual(
        EXPECTED[locale].long,
      );
      expect(DIAS_SEMANA.map((dia) => t(`short.${dia}`))).toEqual(
        EXPECTED[locale].short,
      );
      expect(t("notSet").trim()).not.toBe("");
    },
  );
});

describe("catalog parity (CM-I18N-1, CM-UX-1: Grupo list, form, page and state copy)", () => {
  const section = (locale: "es" | "en", path: string) =>
    resolve(locale === "es" ? esMessages : enMessages, path);
  const keysOf = (locale: "es" | "en", path: string) =>
    leafPaths(section(locale, path)).sort();

  const FORM_KEYS = [
    "asignaturaLabel",
    "diasHint",
    "diasLabel",
    "docenteLabel",
    "naturalKeyHint",
    "noMatches",
    "numeroGrupoLabel",
    "periodoHint",
    "periodoLabel",
    "searchPlaceholder",
    "submitCreate",
    "submitSave",
    "submitting",
    "truncated",
  ];
  const LIST_KEYS = [
    "title",
    "subtitle",
    "newButton",
    "columns.code",
    "columns.subject",
    "columns.periodo",
    "columns.numeroGrupo",
    "columns.docente",
    "columns.dias",
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
  const PAGE_KEYS = [
    "page.editSubtitle",
    "page.editTitle",
    "page.newSubtitle",
    "page.newTitle",
    "page.reactivateHint",
    "breadcrumb.edit",
    "breadcrumb.label",
    "breadcrumb.new",
    "state.title",
  ];

  it.each(["es", "en"] as const)("%s pins exactly the form keys", (locale) => {
    expect(keysOf(locale, "catalog.grupos.form")).toEqual(FORM_KEYS);
  });

  it.each(["es", "en"] as const)("%s pins exactly the list keys", (locale) => {
    expect(keysOf(locale, "catalog.grupos.list")).toEqual(
      [...LIST_KEYS].sort(),
    );
  });

  it.each(["es", "en"] as const)(
    "%s pins exactly the page, breadcrumb and state keys, with nothing else in the section",
    (locale) => {
      const all = leafPaths(section(locale, "catalog.grupos"));

      expect(
        all.filter((path) => /^(page|breadcrumb|state)\./.test(path)).sort(),
      ).toEqual([...PAGE_KEYS].sort());
      expect(
        all.filter(
          (path) => !/^(list|form|page|breadcrumb|state)\./.test(path),
        ),
      ).toEqual(["errors.unexpected"]);
    },
  );

  it("the form, list, page, breadcrumb and state keys have identical sets in es and en", () => {
    expect(keysOf("es", "catalog.grupos")).toEqual(
      keysOf("en", "catalog.grupos"),
    );
  });

  it.each([
    ["es", /d[ií]as/i, /al menos un d[ií]a/i],
    ["en", /days/i, /at least one day/i],
  ] as const)(
    "%s days label and hint say what to pick (select at least one)",
    (locale, label, hint) => {
      expect(section(locale, "catalog.grupos.form.diasLabel")).toMatch(label);
      expect(section(locale, "catalog.grupos.form.diasHint")).toMatch(hint);
    },
  );

  it.each([
    ["es", "Días"],
    ["en", "Days"],
  ] as const)("%s list column header for the days is %s", (locale, header) => {
    expect(section(locale, "catalog.grupos.list.columns.dias")).toBe(header);
  });

  type Translate = (
    key: string,
    values?: Record<string, string | number>,
  ) => string;
  const translate = (locale: "es" | "en", namespace: string) =>
    createTranslator({
      locale,
      messages: locale === "es" ? esMessages : enMessages,
      namespace: namespace as "catalog.grupos",
      onError: (error: Error) => {
        throw error;
      },
    }) as unknown as Translate;

  it.each(["es", "en"] as const)(
    "%s renders the parameterised list keys through the real translator",
    (locale) => {
      const t = translate(locale, "catalog.grupos.list");

      expect(t("noResults.title", { q: "calc" })).toContain("calc");
      expect(t("pagination.status", { page: 2, pages: 5 })).toMatch(/2.*5/);
      for (const count of [0, 1, 7]) {
        expect(t("count", { count }).trim()).not.toBe("");
      }
      expect(t("count", { count: 7 })).toContain("7");
    },
  );

  it.each(["es", "en"] as const)(
    "%s breadcrumb names the Asignatura, Periodo and NumeroGrupo being edited",
    (locale) => {
      const text = translate(locale, "catalog.grupos")("breadcrumb.edit", {
        codigo: "MAT101",
        periodo: "2026-S1",
        numeroGrupo: "G7",
      });

      expect(text).toContain("MAT101");
      expect(text).toContain("2026-S1");
      expect(text).toContain("G7");
    },
  );

  it.each([
    ["es", /no se elimina nada/i, /reactiv/i],
    ["en", /nothing is deleted/i, /reactivate/i],
  ] as const)(
    "%s Grupo toggle sentence names the Asignatura, Periodo and NumeroGrupo and says nothing is deleted",
    (locale, nothing, reactivate) => {
      const t = translate(locale, "catalog.shared.toggle");
      // The edit page passes this label as the record of the confirmation.
      const title = t("confirmTitle", {
        record: "MAT101 · Calculus · 2026-S1 · G7",
      });

      expect(title).toContain("MAT101");
      expect(title).toContain("Calculus");
      expect(title).toContain("2026-S1");
      expect(title).toContain("G7");
      expect(t("nothingDeleted")).toMatch(nothing);
      expect(t("nothingDeleted")).toMatch(reactivate);
    },
  );

  it.each([
    ["es", /react[ií]v/i, /estado/i],
    ["en", /reactivate/i, /status/i],
  ] as const)(
    "%s inactive hint points to the State section to reactivate",
    (locale, reactivate, stateWord) => {
      const text = section(locale, "catalog.grupos.page.reactivateHint");

      expect(text).toMatch(reactivate);
      expect(text).toMatch(stateWord);
    },
  );

  it.each([
    ["es", "Grupos"],
    ["en", "Groups"],
  ] as const)("%s sidebar label is %s", (locale, label) => {
    expect(section(locale, "nav.catalogGrupos")).toBe(label);
  });
});

describe("catalog parity (CM-I18N-1: Grupo page and form copy)", () => {
  // The page and form tests mock the translator, so only a scan of the source
  // proves every message key they choose exists. Each file declares its
  // translators as `const t = ...("namespace")`; the keys are the string
  // literals in the call arguments.
  const DIR = "src/app/(dashboard)/catalog/grupos";
  const FILES = [
    "page.tsx",
    "new/page.tsx",
    "[id]/edit/page.tsx",
    "grupo-form.tsx",
  ];
  const read = (file: string) =>
    readFileSync(join(process.cwd(), DIR, file), "utf8");

  function keysUsedBy(file: string) {
    const source = read(file);
    const translators = [
      ...source.matchAll(
        /const (\w+) = (?:await getTranslations|useTranslations)\("([^"]+)"\)/g,
      ),
    ];
    const keys: string[] = [];
    for (const [, variable, namespace] of translators) {
      for (const call of source.matchAll(
        new RegExp(`\\b${variable}\\(([^()]*)`, "g"),
      )) {
        for (const literal of call[1].matchAll(/"([A-Za-z.]+)"/g)) {
          keys.push(`${namespace}.${literal[1]}`);
        }
      }
    }
    return keys;
  }

  const used = [...new Set(FILES.flatMap(keysUsedBy))];

  it("the scan finds the keys the Grupo pages and form choose", () => {
    expect(used).toEqual(
      expect.arrayContaining([
        "catalog.grupos.list.title",
        "catalog.grupos.list.columns.dias",
        "catalog.grupos.list.count",
        "catalog.grupos.page.newTitle",
        "catalog.grupos.page.editTitle",
        "catalog.grupos.page.reactivateHint",
        "catalog.grupos.breadcrumb.edit",
        "catalog.grupos.state.title",
        "catalog.grupos.form.diasLabel",
        "catalog.grupos.form.diasHint",
        "catalog.grupos.form.submitSave",
        "catalog.grupos.form.submitCreate",
        "catalog.shared.noCarrera.title",
        "catalog.shared.status.active",
        "catalog.shared.dias.notSet",
        "catalog.shared.refusals.inactive",
        "catalog.shared.busy",
        "catalog.shared.importWins",
      ]),
    );
  });

  it.each(["es", "en"] as const)(
    "%s carries every message key the Grupo pages and form use",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      for (const key of used) {
        expect(typeof resolve(messages, key), key).toBe("string");
      }
    },
  );

  it.each(["es", "en"] as const)(
    "%s carries the long and short day names the form and the list render",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      for (const dia of DIAS_SEMANA) {
        for (const form of ["long", "short"]) {
          expect(
            typeof resolve(messages, `catalog.shared.dias.${form}.${dia}`),
            `${form}.${dia}`,
          ).toBe("string");
        }
      }
    },
  );

  it("the form and the list use the shared day names, not their own", () => {
    const form = read("grupo-form.tsx");
    const list = read("page.tsx");

    expect(form).toContain("dias.long.");
    expect(list).toContain('tDias("notSet")');
    expect(list).toContain("short.");
    expect(list).toContain("long.");
  });
});

describe("catalog parity (CM-I18N-1, CM-UX-1: Docentes list copy)", () => {
  const section = (locale: "es" | "en", path: string) =>
    resolve(locale === "es" ? esMessages : enMessages, path);

  const DOCENTES_KEYS = [
    "title",
    "subtitle",
    "usersLink",
    "columns.name",
    "columns.login",
    "columns.email",
    "columns.status",
    "noEmail",
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
    "%s pins exactly the Docentes list keys",
    (locale) => {
      expect(leafPaths(section(locale, "catalog.docentes")).sort()).toEqual(
        [...DOCENTES_KEYS].sort(),
      );
    },
  );

  it.each([
    ["es", "Docentes"],
    ["en", "Teachers"],
  ] as const)("%s sidebar label is %s", (locale, label) => {
    expect(section(locale, "nav.catalogDocentes")).toBe(label);
  });

  it("the Docentes page chooses only keys that exist in both locales", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/catalog/docentes/page.tsx"),
      "utf8",
    );
    const translators = [
      ...source.matchAll(/const (\w+) = await getTranslations\("([^"]+)"\)/g),
    ];
    const used = new Set<string>();
    for (const [, variable, namespace] of translators) {
      for (const call of source.matchAll(
        new RegExp(`\\b${variable}\\(([^()]*)`, "g"),
      )) {
        for (const literal of call[1].matchAll(/"([A-Za-z.]+)"/g)) {
          used.add(`${namespace}.${literal[1]}`);
        }
      }
    }

    expect([...used]).toEqual(
      expect.arrayContaining([
        "catalog.docentes.title",
        "catalog.docentes.usersLink",
        "catalog.docentes.columns.email",
        "catalog.docentes.noEmail",
        "catalog.docentes.count",
        "catalog.docentes.pagination.status",
        "catalog.shared.status.active",
      ]),
    );
    for (const messages of [esMessages, enMessages]) {
      for (const key of used) {
        expect(typeof resolve(messages, key), key).toBe("string");
      }
    }
  });
});
