import { describe, expect, it } from "vitest";

import { CAUSAS } from "./causes";
import type { EligibleGroup } from "./eligibility";
import { validateSubmission, type SubmissionInput } from "./submission";

const ELIGIBLE: EligibleGroup[] = [
  { grupoId: 100, asignaturaId: 10 },
  { grupoId: 200, asignaturaId: 20 },
  { grupoId: 201, asignaturaId: 20 },
];

const TODAY = "2026-10-06";

function valid(overrides: Partial<SubmissionInput> = {}): SubmissionInput {
  return {
    causa: CAUSAS[3],
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    selections: [{ asignaturaId: 10, grupoId: null }],
    eligibleGroups: ELIGIBLE,
    validDocumentCount: 1,
    ...overrides,
  };
}

function fields(input: SubmissionInput, today = TODAY): string[] {
  const result = validateSubmission(input, today);
  return result.ok ? [] : result.errors.map((e) => `${e.field}:${e.code}`);
}

describe("validateSubmission (RF-03, RN-01..RN-05, RN-23, D15)", () => {
  it("accepts a complete draft", () => {
    expect(validateSubmission(valid(), TODAY)).toEqual({ ok: true });
  });

  it("blocks a missing and an unknown cause (RN-01)", () => {
    expect(fields(valid({ causa: null }))).toEqual(["causa:causa_required"]);
    expect(fields(valid({ causa: "vacaciones" }))).toEqual([
      "causa:causa_invalid",
    ]);
  });

  it("requires both dates and rejects malformed ones (RF-03 a)", () => {
    expect(fields(valid({ fechaInicio: null }))).toEqual([
      "fechaInicio:start_required",
    ]);
    expect(fields(valid({ fechaFin: null }))).toEqual([
      "fechaFin:end_required",
    ]);
    expect(fields(valid({ fechaInicio: "2026-02-30" }))).toEqual([
      "fechaInicio:start_invalid",
    ]);
    expect(fields(valid({ fechaFin: "tomorrow" }))).toEqual([
      "fechaFin:end_invalid",
    ]);
  });

  it("blocks an end before the start with an error on the end date (RN-05)", () => {
    expect(
      fields(valid({ fechaInicio: "2026-10-10", fechaFin: "2026-10-09" })),
    ).toEqual(["fechaFin:end_before_start"]);
  });

  it("accepts a one-day absence (end equals start)", () => {
    expect(
      validateSubmission(
        valid({ fechaInicio: "2026-10-06", fechaFin: "2026-10-06" }),
        TODAY,
      ),
    ).toEqual({ ok: true });
  });

  describe("RN-23 window (table-driven)", () => {
    const rows: [string, string, string, string[]][] = [
      ["2026-10-31", "2026-10-01", "2026-10-01", []], // exactly 30 days
      ["2026-10-31", "2026-09-30", "2026-09-30", ["fechaFin:end_too_old"]],
      ["2026-10-06", "2026-10-20", "2026-10-20", []], // future allowed
    ];
    it.each(rows)(
      "today %s, start %s, end %s",
      (today, start, end, expected) => {
        expect(
          fields(valid({ fechaInicio: start, fechaFin: end }), today),
        ).toEqual(expected);
      },
    );

    it("does not stack end_too_old on top of end_before_start", () => {
      expect(
        fields(
          valid({ fechaInicio: "2026-09-30", fechaFin: "2026-09-01" }),
          "2026-10-31",
        ),
      ).toEqual(["fechaFin:end_before_start"]);
    });
  });

  it("requires at least one subject (D15)", () => {
    expect(fields(valid({ selections: [] }))).toEqual([
      "subjects:subjects_required",
    ]);
  });

  it("delegates subject checks and attaches the subject id (RF-04 c)", () => {
    const result = validateSubmission(
      valid({ selections: [{ asignaturaId: 20, grupoId: null }] }),
      TODAY,
    );
    expect(result).toEqual({
      ok: false,
      errors: [{ field: "subjects", code: "group_required", asignaturaId: 20 }],
    });
  });

  it("requires at least one finalized document (RN-03)", () => {
    expect(fields(valid({ validDocumentCount: 0 }))).toEqual([
      "documents:documents_required",
    ]);
  });

  it("reports all invalid fields at once, in field order (RF-03 e)", () => {
    expect(
      fields(
        valid({
          causa: null,
          fechaInicio: "2026-10-10",
          fechaFin: "2026-10-09",
          validDocumentCount: 0,
        }),
      ),
    ).toEqual([
      "causa:causa_required",
      "fechaFin:end_before_start",
      "documents:documents_required",
    ]);
  });
});
