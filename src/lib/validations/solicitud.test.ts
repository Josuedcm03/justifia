import { describe, expect, it } from "vitest";

import {
  documentIdSchema,
  errorKey,
  finalizeDocumentSchema,
  makeDetailsStepSchema,
  subjectsStepSchema,
  toFieldErrors,
} from "./solicitud";

const TODAY = "2026-10-07";
const details = makeDetailsStepSchema(TODAY);

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
