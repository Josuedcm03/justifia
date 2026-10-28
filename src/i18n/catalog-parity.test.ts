import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { DIAS_SEMANA } from "@/lib/catalog/dias";
import { shortcutsFor } from "@/lib/navigation";
import { rolesUsuario } from "@/lib/validations/auth";
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
  "catalog.grupos",
  "nav.catalogDocentes",
  "catalog.docentes",
  // Backoffice shell (backoffice-ui-refresh): the top-bar trail reuses the
  // sidebar's `nav.*` labels and adds its landmark label and the profile page;
  // `roles` labels the sidebar identity block.
  "nav.profile",
  "nav.enrollment",
  "nav.trailLabel",
  // Escalation, S4: the coordinator's menu entry.
  "nav.coordination",
  "roles",
  // Backoffice shell, slice 1b: route error screen and the role-aware home.
  "shell",
  "dashboard",
  // Backoffice table kit, slice 2b: sortable headers and the caption sentence.
  "tables",
  // Backoffice users list, slice 2d: the whole `users` section (list copy and
  // the create form) keeps identical key sets.
  "users",
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

describe("catalog parity (BS-I18N-1: shell copy)", () => {
  it.each(["es", "en"] as const)(
    "%s labels exactly one role per RolUsuario",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;

      expect(leafPaths(resolve(messages, "roles")).sort()).toEqual(
        [...rolesUsuario].sort(),
      );
    },
  );

  it.each(["es", "en"] as const)(
    "%s carries the trail landmark label apart from the sidebar's",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const trail = resolve(messages, "nav.trailLabel");

      expect(typeof trail).toBe("string");
      expect(trail).not.toBe(resolve(messages, "nav.sectionLabel"));
    },
  );
});

describe("catalog parity (BS-I18N-1: states and home copy)", () => {
  const messagesOf = (locale: "es" | "en") =>
    locale === "es" ? esMessages : enMessages;

  it.each(["es", "en"] as const)(
    "%s holds exactly the route error keys",
    (locale) => {
      expect(leafPaths(resolve(messagesOf(locale), "shell")).sort()).toEqual([
        "error.dashboardLink",
        "error.description",
        "error.reference",
        "error.retry",
        "error.title",
      ]);
    },
  );

  it.each(["es", "en"] as const)(
    "%s renders the error reference with the digest through the real translator",
    (locale) => {
      const t = createTranslator({
        locale,
        messages: messagesOf(locale),
        namespace: "shell",
        onError: (error: Error) => {
          throw error;
        },
      });

      expect(t("error.reference", { digest: "ab12cd" })).toContain("ab12cd");
    },
  );

  // Every destination any role can be offered needs a one-sentence description.
  const SHORTCUT_KEYS = [
    ...new Set(
      rolesUsuario.flatMap((rol) => shortcutsFor(rol)).map((l) => l.key),
    ),
  ].sort();

  it("offers shortcuts for the nine destinations the roles reach", () => {
    expect(SHORTCUT_KEYS).toEqual([
      "catalogAsignaturas",
      "catalogDocentes",
      "catalogImport",
      "coordination",
      "enrollment",
      "myRequests",
      "newRequest",
      "review",
      "users",
    ]);
  });

  it.each(["es", "en"] as const)(
    "%s describes every shortcut and carries the degraded and empty sentences",
    (locale) => {
      const paths = leafPaths(resolve(messagesOf(locale), "dashboard"));

      for (const key of SHORTCUT_KEYS) {
        expect(paths, key).toContain(`shortcuts.${key}`);
      }
      expect(paths).toEqual(expect.arrayContaining(["degraded", "empty"]));
    },
  );

  it.each([
    ["es", /no se pudieron/i],
    ["en", /could not/i],
  ] as const)(
    "%s home degraded sentence says the figures could not be loaded",
    (locale, notLoaded) => {
      expect(resolve(messagesOf(locale), "dashboard.degraded")).toMatch(
        notLoaded,
      );
    },
  );
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
    "tableCaption",
  ];

  it.each(["es", "en"] as const)(
    "%s carries exactly the list keys",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;

      expect(
        leafPaths(resolve(messages, "catalog.asignaturas"))
          .filter(
            (path) =>
              !/^(errors|form|page|breadcrumb|state|grupos|matches)\./.test(
                path,
              ),
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

describe("catalog parity (CM-I18N-1, CM-ASG-9: Asignaturas search by group)", () => {
  const MATCHES = "catalog.asignaturas.matches";
  const KEYS = ["label", "item", "itemInactive", "more"];

  it.each(["es", "en"] as const)(
    "%s carries exactly the matches keys, all non-empty",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const paths = leafPaths(resolve(messages, MATCHES));
      expect(paths.sort()).toEqual([...KEYS].sort());
      for (const key of KEYS) {
        const text = resolve(messages, `${MATCHES}.${key}`) as string;
        expect(text.trim()).not.toBe("");
      }
    },
  );

  it.each(["es", "en"] as const)(
    "%s renders item, itemInactive and the more plural through the real translator",
    (locale) => {
      const t = createTranslator({
        locale,
        messages: locale === "es" ? esMessages : enMessages,
        namespace: MATCHES as "catalog.asignaturas.matches",
        onError: (error: Error) => {
          throw error;
        },
      });
      const args = {
        periodo: "2026-S1",
        numeroGrupo: "3",
        docente: "Ana Pérez",
      };

      const item = t("item", args);
      for (const part of ["2026-S1", "3", "Ana Pérez"]) {
        expect(item).toContain(part);
      }
      const inactive = t("itemInactive", args);
      expect(inactive).toContain("Ana Pérez");
      expect(inactive).not.toBe(item);
      expect(inactive.startsWith(item)).toBe(true);

      expect(t("more", { count: 1 })).toContain("+1");
      expect(t("more", { count: 7 })).toContain("+7");
      expect(t("more", { count: 1 })).not.toBe(t("more", { count: 7 }));
    },
  );

  it.each(["es", "en"] as const)(
    "%s search copy names docente and periodo",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      const teacher = locale === "es" ? /docente/i : /teacher/i;
      const period = locale === "es" ? /per[ií]odo/i : /period/i;
      for (const key of [
        "search.label",
        "search.placeholder",
        "noResults.hint",
      ]) {
        const text = resolve(messages, `catalog.asignaturas.${key}`) as string;
        expect(text, key).toMatch(teacher);
        expect(text, key).toMatch(period);
      }
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
    "degraded",
    "edit",
    "columns.periodo",
    "columns.numeroGrupo",
    "columns.docente",
    "columns.dias",
    "columns.status",
    "columns.actions",
  ];
  const messagesOf = (locale: "es" | "en") =>
    locale === "es" ? esMessages : enMessages;

  it.each(["es", "en"] as const)(
    "%s holds exactly the section keys, with the columns and the edit label moved in and no link to a list",
    (locale) => {
      expect(leafPaths(resolve(messagesOf(locale), GRUPOS)).sort()).toEqual(
        [...KEYS].sort(),
      );
      expect(leafPaths(resolve(messagesOf(locale), GRUPOS))).not.toContain(
        "viewAll",
      );
    },
  );

  it.each([
    ["es", "columns.dias", "Días"],
    ["en", "columns.dias", "Days"],
    ["es", "edit", "Editar"],
    ["en", "edit", "Edit"],
  ] as const)("%s %s reads %s", (locale, key, text) => {
    expect(resolve(messagesOf(locale), `${GRUPOS}.${key}`)).toBe(text);
  });

  it.each(["es", "en"] as const)(
    "%s keeps no Grupos list namespace once the list is retired",
    (locale) => {
      expect(
        resolve(messagesOf(locale), "catalog.grupos.list"),
      ).toBeUndefined();
    },
  );

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

describe("catalog parity (CM-I18N-1, CM-UX-1: Grupo form, page and state copy)", () => {
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

  it.each(["es", "en"] as const)(
    "%s pins exactly the page, breadcrumb and state keys, with nothing else in the section",
    (locale) => {
      const all = leafPaths(section(locale, "catalog.grupos"));

      expect(
        all.filter((path) => /^(page|breadcrumb|state)\./.test(path)).sort(),
      ).toEqual([...PAGE_KEYS].sort());
      expect(
        all.filter((path) => !/^(form|page|breadcrumb|state)\./.test(path)),
      ).toEqual(["errors.unexpected"]);
    },
  );

  it("the form, page, breadcrumb and state keys have identical sets in es and en", () => {
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
    "%s breadcrumb names the Periodo and NumeroGrupo being edited, and not the Asignatura code its parent crumb already shows",
    (locale) => {
      // The real translator throws on a missing value, so a leftover
      // {codigo} placeholder fails here.
      const text = translate(locale, "catalog.grupos")("breadcrumb.edit", {
        periodo: "2026-S1",
        numeroGrupo: "G7",
      });

      expect(text).toContain("2026-S1");
      expect(text).toContain("G7");
      expect(
        section(locale, "catalog.grupos.breadcrumb.edit") as string,
      ).not.toContain("{codigo}");
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

  // The group is created under an Asignatura chosen by the route (CM-GRP-9),
  // so the page no longer adds a group "to the catalog".
  it.each([
    ["es", /asignatura/i, /cat[aá]logo/i],
    ["en", /subject/i, /catalog/i],
  ] as const)(
    "%s new-group subtitle names the subject, not the catalog",
    (locale, subject, catalog) => {
      const text = section(locale, "catalog.grupos.page.newSubtitle");

      expect(text).toMatch(subject);
      expect(text).not.toMatch(catalog);
    },
  );

  // There is no list to select a subject from any more: a missing or unusable
  // one means the form was not opened from a subject's page.
  it.each([
    ["es", /de la lista/i, /p[aá]gina de la asignatura/i],
    ["en", /from the list/i, /subject's page/i],
  ] as const)(
    "%s Asignatura field errors no longer point to a list and say where to go",
    (locale, list, where) => {
      for (const key of ["required", "invalid"]) {
        const text = section(
          locale,
          `catalog.shared.fieldErrors.asignaturaId.${key}`,
        );

        expect(text, key).not.toMatch(list);
        expect(text, key).toMatch(where);
      }
    },
  );
});

describe("catalog parity (CM-I18N-1: Grupo page and form copy)", () => {
  // The page and form tests mock the translator, so only a scan of the source
  // proves every message key they choose exists. Each file declares its
  // translators as `const t = ...("namespace")`; the keys are the string
  // literals in the call arguments.
  const DIR = "src/app/(dashboard)/catalog/grupos";
  const FILES = [
    "../asignaturas/[id]/grupos/new/page.tsx",
    "../asignaturas/[id]/grupos/[grupoId]/edit/page.tsx",
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
    "%s carries the long and short day names the form renders",
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

  it("the form uses the shared day names, not its own", () => {
    expect(read("grupo-form.tsx")).toContain("dias.long.");
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
    "tableCaption",
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

  // The page reads its copy through `getTranslations`, the client table
  // through `useTranslations`; every literal key either chooses must exist in
  // both locales (DT-I18N-1, CM-LST-1).
  function keysUsedBy(file: string) {
    const source = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/catalog/docentes", file),
      "utf8",
    );
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

  const used = [
    ...new Set(["docentes-table.tsx", "page.tsx"].flatMap(keysUsedBy)),
  ];

  it("the scan finds the keys the Docentes table and page choose, all reused", () => {
    expect(used).toEqual(
      expect.arrayContaining([
        "catalog.docentes.title",
        "catalog.docentes.subtitle",
        "catalog.docentes.usersLink",
        "catalog.docentes.degraded",
        "catalog.docentes.columns.name",
        "catalog.docentes.columns.login",
        "catalog.docentes.columns.email",
        "catalog.docentes.columns.status",
        "catalog.docentes.noEmail",
        "catalog.docentes.tableCaption",
        "catalog.docentes.empty",
        "catalog.docentes.noResults.title",
        "catalog.docentes.noResults.titleStatus",
        "catalog.docentes.noResults.hint",
        "catalog.shared.status.active",
      ]),
    );
  });

  it.each(["es", "en"] as const)(
    "%s carries every key the Docentes table and page use",
    (locale) => {
      const messages = locale === "es" ? esMessages : enMessages;
      for (const key of used) {
        expect(typeof resolve(messages, key), key).toBe("string");
      }
    },
  );

  // One hint serves the term and the status-only no-results, so it must point
  // at the status filter as well as at the search fields.
  it.each([
    ["es", /estado/i],
    ["en", /status/i],
  ] as const)(
    "%s Docentes no-results hint also names the status filter",
    (locale, status) => {
      const messages = locale === "es" ? esMessages : enMessages;
      expect(resolve(messages, "catalog.docentes.noResults.hint")).toMatch(
        status,
      );
    },
  );
});

describe("catalog parity (DT-I18N-1: table core copy)", () => {
  const messagesOf = (locale: "es" | "en") =>
    locale === "es" ? esMessages : enMessages;

  it.each(["es", "en"] as const)(
    "%s holds exactly the table core and table control keys",
    (locale) => {
      expect(leafPaths(resolve(messagesOf(locale), "tables")).sort()).toEqual([
        "caption.sortable",
        "clear",
        "count",
        "filter.active",
        "filter.all",
        "filter.inactive",
        "filter.label",
        "pageSize.label",
        "pageSize.option",
        "pagination.first",
        "pagination.last",
        "pagination.next",
        "pagination.previous",
        "pagination.region",
        "pagination.status",
        "search.submit",
        "sort.ascending",
        "sort.descending",
        "sort.sortable",
        "toolbar.label",
        "updating",
      ]);
    },
  );

  // `pageSize.option` is a bare number format and is the same in both.
  it("words each locale in its own language", () => {
    for (const key of [
      "tables.caption.sortable",
      "tables.clear",
      "tables.count",
      "tables.filter.active",
      "tables.filter.all",
      "tables.filter.inactive",
      "tables.filter.label",
      "tables.pageSize.label",
      "tables.pagination.first",
      "tables.pagination.last",
      "tables.pagination.next",
      "tables.pagination.previous",
      "tables.pagination.region",
      "tables.pagination.status",
      "tables.search.submit",
      "tables.sort.ascending",
      "tables.sort.descending",
      "tables.sort.sortable",
      "tables.toolbar.label",
      "tables.updating",
    ]) {
      expect(resolve(esMessages, key), key).not.toBe(resolve(enMessages, key));
    }
  });

  it.each(["es", "en"] as const)(
    "%s interpolates counts and pages instead of concatenating them",
    (locale) => {
      const tables = resolve(messagesOf(locale), "tables") as Record<
        string,
        Node
      >;
      const count = tables.count as string;
      const status = (tables.pagination as Record<string, string>).status;

      expect(count).toMatch(/\{count, plural,.*=0 .*one .*other /);
      expect(count.match(/#/g)?.length).toBe(2);
      expect(status).toContain("{page}");
      expect(status).toContain("{pages}");
      expect((tables.pageSize as Record<string, string>).option).toContain(
        "{size",
      );
    },
  );
});

describe("catalog parity (DT-I18N-1, UL: users list copy)", () => {
  const messagesOf = (locale: "es" | "en") =>
    locale === "es" ? esMessages : enMessages;

  // Everything the users table and its page render. Most keys predate this
  // slice and are reused; the two status keys are new (a no-results state
  // caused by the status filter alone has no search term to name).
  const LIST_KEYS = [
    "columns.createdAt",
    "columns.login",
    "columns.name",
    "columns.role",
    "columns.status",
    "degraded",
    "empty",
    "newButton",
    "noResults.hintStatus",
    "noResults.titleStatus",
    "noResults.hint",
    "noResults.title",
    "search.label",
    "search.placeholder",
    "status.active",
    "status.inactive",
    "tableCaption",
  ];

  it.each(["es", "en"] as const)(
    "%s carries every key the users table renders",
    (locale) => {
      const paths = leafPaths(resolve(messagesOf(locale), "users"));

      expect(paths).toEqual(expect.arrayContaining(LIST_KEYS));
    },
  );

  it("words the status-only no-results copy in each locale's language", () => {
    for (const key of [
      "users.noResults.hintStatus",
      "users.noResults.titleStatus",
    ]) {
      expect(resolve(esMessages, key), key).not.toBe(resolve(enMessages, key));
    }
  });

  it.each(["es", "en"] as const)(
    "%s names the search term in the term title and not in the status title",
    (locale) => {
      const users = resolve(messagesOf(locale), "users") as Record<
        string,
        Node
      >;
      const noResults = users.noResults as Record<string, string>;

      expect(noResults.title).toContain("{q}");
      expect(noResults.titleStatus).not.toContain("{q}");
    },
  );
});

describe("catalog parity (DT-I18N-1, CM-LST-1: Asignaturas table and page copy)", () => {
  const DIR = "src/app/(dashboard)/catalog/asignaturas";
  const messagesOf = (locale: "es" | "en") =>
    locale === "es" ? esMessages : enMessages;

  // Source scan, like the Docentes one: the client table reads its copy through
  // `useTranslations`, the page through `getTranslations`. Every literal key
  // either of them chooses must exist in both locales, so a renamed or removed
  // key fails here instead of throwing at render time.
  function keysUsedBy(file: string) {
    const source = readFileSync(join(process.cwd(), DIR, file), "utf8");
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

  const used = [
    ...new Set(["asignaturas-table.tsx", "page.tsx"].flatMap(keysUsedBy)),
  ];

  it("the scan finds the keys the table and the page choose, all reused", () => {
    expect(used).toEqual(
      expect.arrayContaining([
        "catalog.asignaturas.title",
        "catalog.asignaturas.newButton",
        "catalog.asignaturas.columns.code",
        "catalog.asignaturas.columns.name",
        "catalog.asignaturas.columns.career",
        "catalog.asignaturas.columns.hours",
        "catalog.asignaturas.columns.groups",
        "catalog.asignaturas.columns.status",
        "catalog.asignaturas.columns.actions",
        "catalog.asignaturas.tableCaption",
        "catalog.asignaturas.empty",
        "catalog.asignaturas.noResults.title",
        "catalog.asignaturas.noResults.titleStatus",
        "catalog.asignaturas.noResults.hint",
        "catalog.asignaturas.degraded",
        "catalog.asignaturas.matches.label",
        "catalog.shared.status.active",
        "catalog.shared.noCarrera.title",
      ]),
    );
  });

  it.each(["es", "en"] as const)(
    "%s carries every key the table and the page use",
    (locale) => {
      for (const key of used) {
        expect(typeof resolve(messagesOf(locale), key), key).toBe("string");
      }
    },
  );

  // One hint serves the term and the status-only no-results, so it must point
  // at the status filter as well as at the search fields.
  it.each([
    ["es", /estado/i],
    ["en", /status/i],
  ] as const)(
    "%s no-results hint also names the status filter",
    (locale, status) => {
      expect(
        resolve(messagesOf(locale), "catalog.asignaturas.noResults.hint"),
      ).toMatch(status);
    },
  );
});

describe("catalog parity (DT-I18N-1: retired list copy)", () => {
  // The old table components read these keys; the shared table kit reads
  // `tables.*` instead, so they were removed from both catalogs (slice 3d).
  const RETIRED = [
    "users.search.submit",
    "users.search.clear",
    "users.count",
    "users.pagination",
    "catalog.asignaturas.search.submit",
    "catalog.asignaturas.search.clear",
    "catalog.asignaturas.count",
    "catalog.asignaturas.pagination",
    "catalog.docentes.search.submit",
    "catalog.docentes.search.clear",
    "catalog.docentes.count",
    "catalog.docentes.pagination",
    "catalog.shared.filter",
  ];

  it.each(["es", "en"] as const)("%s no longer carries them", (locale) => {
    const messages = locale === "es" ? esMessages : enMessages;
    for (const key of RETIRED) {
      expect(resolve(messages, key), key).toBeUndefined();
    }
  });
});
