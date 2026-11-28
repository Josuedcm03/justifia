import { describe, expect, it } from "vitest";

import { filingRulesOf, type FilingRules } from "@/lib/parameters/derive";
import { DEFAULT_PARAMETERS } from "@/lib/parameters/registry";

import {
  documentIdSchema,
  errorKey,
  finalizeDocumentSchema,
  makeDetailsStepSchema,
  subjectsStepSchema,
  toFieldErrors,
} from "./solicitud";

const TODAY = "2026-10-07";
const RULES = filingRulesOf(DEFAULT_PARAMETERS);
const windowOf = (windowDays: number): FilingRules => ({
  ...RULES,
  windowDays,
});
const details = makeDetailsStepSchema(TODAY, RULES);

function errorsOf(input: unknown) {
  const result = details.safeParse(input);
  expect(result.success).toBe(false);
  return result.success ? [] : toFieldErrors(result.error);
}

describe("details step schema (RN-01, RN-05, RN-23)", () => {
  it("accepts a valid cause and dates", () => {
    const input = {
      causa: "medica",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
    };
    expect(details.parse(input)).toEqual(input);
  });

  it("accepts a future range and an end exactly 30 days back", () => {
    expect(
      details.safeParse({
        causa: "fuerza_mayor",
        fechaInicio: "2026-09-01",
        fechaFin: "2026-09-07",
      }).success,
    ).toBe(true);
    expect(
      details.safeParse({
        causa: "fuerza_mayor",
        fechaInicio: "2026-10-20",
        fechaFin: "2026-10-25",
      }).success,
    ).toBe(true);
  });

  it("reports an empty form field by field with i18n keys", () => {
    expect(errorsOf({})).toEqual([
      { field: "causa", key: "intake.errors.causa_required" },
      { field: "fechaInicio", key: "intake.errors.start_required" },
      { field: "fechaFin", key: "intake.errors.end_required" },
    ]);
  });

  it("rejects a cause outside the five and an impossible date", () => {
    expect(
      errorsOf({
        causa: "vacaciones",
        fechaInicio: "2026-02-30",
        fechaFin: "2026-10-03",
      }),
    ).toEqual([
      { field: "causa", key: "intake.errors.causa_invalid" },
      { field: "fechaInicio", key: "intake.errors.start_invalid" },
    ]);
  });

  it("rejects an end before the start on the end field", () => {
    expect(
      errorsOf({
        causa: "medica",
        fechaInicio: "2026-10-10",
        fechaFin: "2026-10-09",
      }),
    ).toEqual([{ field: "fechaFin", key: "intake.errors.end_before_start" }]);
  });

  it("rejects an end more than 30 days before the submission date", () => {
    expect(
      errorsOf({
        causa: "medica",
        fechaInicio: "2026-08-01",
        fechaFin: "2026-09-06",
      }),
    ).toEqual([{ field: "fechaFin", key: "intake.errors.end_too_old" }]);
  });

  describe("the window follows the parameter (table-driven)", () => {
    const rows: [number, string, boolean][] = [
      [10, "2026-09-27", true], // exactly 10 days before 2026-10-07
      [10, "2026-09-26", false],
      [60, "2026-08-08", true], // exactly 60 days
      [60, "2026-08-07", false],
    ];
    it.each(rows)("window %i, end %s -> accepted %s", (days, end, accepted) => {
      const result = makeDetailsStepSchema(TODAY, windowOf(days)).safeParse({
        causa: "medica",
        fechaInicio: end,
        fechaFin: end,
      });

      expect(result.success).toBe(accepted);
      expect(!result.success && toFieldErrors(result.error)).toEqual(
        accepted
          ? false
          : [{ field: "fechaFin", key: "intake.errors.end_too_old" }],
      );
    });
  });
});

describe("subjects step schema (RF-04)", () => {
  it("accepts subjects with a chosen group or null", () => {
    const input = {
      selections: [
        { asignaturaId: 10, grupoId: 21 },
        { asignaturaId: 11, grupoId: null },
      ],
    };
    expect(subjectsStepSchema.parse(input)).toEqual(input);
  });

  it.each([
    ["a missing list", {}],
    [
      "a non-integer id",
      { selections: [{ asignaturaId: 1.5, grupoId: null }] },
    ],
    ["a negative group", { selections: [{ asignaturaId: 1, grupoId: -3 }] }],
    ["a string id", { selections: [{ asignaturaId: "1", grupoId: null }] }],
  ])("rejects %s", (_name, input) => {
    expect(subjectsStepSchema.safeParse(input).success).toBe(false);
  });
});

describe("document schemas", () => {
  it("finalize input needs a pathname and keeps the original name", () => {
    expect(
      finalizeDocumentSchema.parse({
        pathname: "intake/4/a.pdf",
        nombreOriginal: "scan.pdf",
      }),
    ).toEqual({ pathname: "intake/4/a.pdf", nombreOriginal: "scan.pdf" });
    expect(
      finalizeDocumentSchema.safeParse({ pathname: "", nombreOriginal: "x" })
        .success,
    ).toBe(false);
    expect(finalizeDocumentSchema.safeParse({ pathname: "a" }).success).toBe(
      false,
    );
  });

  it("document id is a positive integer", () => {
    expect(documentIdSchema.parse(12)).toBe(12);
    expect(documentIdSchema.safeParse(0).success).toBe(false);
    expect(documentIdSchema.safeParse("12").success).toBe(false);
  });
});

describe("errorKey", () => {
  it("maps a domain code to its i18n key", () => {
    expect(errorKey("documents_required")).toBe(
      "intake.errors.documents_required",
    );
  });
});

describe("details step schema without the filing window (RN-23 not re-applied on a correction)", () => {
  const noWindow = makeDetailsStepSchema(TODAY, RULES, { filingWindow: false });
  const old = {
    causa: "medica",
    fechaInicio: "2026-08-01",
    fechaFin: "2026-09-06",
  };

  it("accepts an end date more than 30 days old, which the default refuses", () => {
    expect(details.safeParse(old).success).toBe(false);
    expect(noWindow.safeParse(old).success).toBe(true);
  });

  it("refuses nothing for the date: an end 20 days old is accepted under a window of 10", () => {
    const twenty = {
      causa: "medica",
      fechaInicio: "2026-09-17",
      fechaFin: "2026-09-17",
    };

    expect(
      makeDetailsStepSchema(TODAY, windowOf(10)).safeParse(twenty).success,
    ).toBe(false);
    expect(
      makeDetailsStepSchema(TODAY, windowOf(10), {
        filingWindow: false,
      }).safeParse(twenty).success,
    ).toBe(true);
  });

  it("RN-05 still applies: an end before the start is refused on the end field", () => {
    const result = noWindow.safeParse({
      ...old,
      fechaInicio: "2026-09-10",
      fechaFin: "2026-09-09",
    });

    expect(result.success).toBe(false);
    expect(!result.success && toFieldErrors(result.error)).toEqual([
      { field: "fechaFin", key: "intake.errors.end_before_start" },
    ]);
  });
});
