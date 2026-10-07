import { describe, expect, it } from "vitest";

import {
  groupOptionsBySubject,
  resolveGroupChoices,
  validateSubjectSelections,
  type EligibleGroup,
} from "./eligibility";

// Subject 10 has one eligible group (100); subject 20 has two (200, 201).
const ELIGIBLE: EligibleGroup[] = [
  { grupoId: 100, asignaturaId: 10 },
  { grupoId: 200, asignaturaId: 20 },
  { grupoId: 201, asignaturaId: 20 },
];

describe("groupOptionsBySubject (RF-04 c, RN-21)", () => {
  it("groups by subject and flags only the multi-group subject as ambiguous", () => {
    expect(groupOptionsBySubject(ELIGIBLE)).toEqual([
      { asignaturaId: 10, grupoIds: [100], ambiguous: false },
      { asignaturaId: 20, grupoIds: [200, 201], ambiguous: true },
    ]);
  });

  it("returns nothing when the student has no eligible group", () => {
    expect(groupOptionsBySubject([])).toEqual([]);
  });
});

describe("validateSubjectSelections", () => {
  it("accepts an unambiguous subject without a chosen group", () => {
    expect(
      validateSubjectSelections(
        [{ asignaturaId: 10, grupoId: null }],
        ELIGIBLE,
      ),
    ).toEqual([]);
  });

  it("accepts several subjects, with the ambiguous one resolved", () => {
    expect(
      validateSubjectSelections(
        [
          { asignaturaId: 10, grupoId: 100 },
          { asignaturaId: 20, grupoId: 201 },
        ],
        ELIGIBLE,
      ),
    ).toEqual([]);
  });

  it("requires a group choice for an ambiguous subject (RF-04 c)", () => {
    expect(
      validateSubjectSelections(
        [{ asignaturaId: 20, grupoId: null }],
        ELIGIBLE,
      ),
    ).toEqual([{ code: "group_required", asignaturaId: 20 }]);
  });

  it("rejects a group that belongs to another subject", () => {
    expect(
      validateSubjectSelections([{ asignaturaId: 20, grupoId: 100 }], ELIGIBLE),
    ).toEqual([{ code: "group_not_in_subject", asignaturaId: 20 }]);
  });

  it("rejects a wrong group even when the subject is unambiguous", () => {
    expect(
      validateSubjectSelections([{ asignaturaId: 10, grupoId: 200 }], ELIGIBLE),
    ).toEqual([{ code: "group_not_in_subject", asignaturaId: 10 }]);
  });

  it("rejects a subject outside the enrollment (RN-21)", () => {
    expect(
      validateSubjectSelections(
        [{ asignaturaId: 99, grupoId: null }],
        ELIGIBLE,
      ),
    ).toEqual([{ code: "subject_not_eligible", asignaturaId: 99 }]);
  });

  it("rejects the same subject twice", () => {
    expect(
      validateSubjectSelections(
        [
          { asignaturaId: 20, grupoId: 200 },
          { asignaturaId: 20, grupoId: 201 },
        ],
        ELIGIBLE,
      ),
    ).toEqual([{ code: "subject_duplicate", asignaturaId: 20 }]);
  });

  it("reports every problem at once", () => {
    const errors = validateSubjectSelections(
      [
        { asignaturaId: 99, grupoId: null },
        { asignaturaId: 20, grupoId: null },
      ],
      ELIGIBLE,
    );
    expect(errors).toEqual([
      { code: "subject_not_eligible", asignaturaId: 99 },
      { code: "group_required", asignaturaId: 20 },
    ]);
  });
});

describe("resolveGroupChoices (RF-04 b, c)", () => {
  it("fills the only eligible group of an unambiguous subject", () => {
    expect(
      resolveGroupChoices([{ asignaturaId: 10, grupoId: null }], ELIGIBLE),
    ).toEqual([{ asignaturaId: 10, grupoId: 100 }]);
  });

  it("keeps an explicit choice and leaves an ambiguous subject unresolved", () => {
    expect(
      resolveGroupChoices(
        [
          { asignaturaId: 20, grupoId: 201 },
          { asignaturaId: 20, grupoId: null },
        ],
        ELIGIBLE,
      ),
    ).toEqual([
      { asignaturaId: 20, grupoId: 201 },
      { asignaturaId: 20, grupoId: null },
    ]);
  });

  it("leaves a subject outside the enrollment untouched", () => {
    expect(
      resolveGroupChoices([{ asignaturaId: 99, grupoId: null }], ELIGIBLE),
    ).toEqual([{ asignaturaId: 99, grupoId: null }]);
  });
});
