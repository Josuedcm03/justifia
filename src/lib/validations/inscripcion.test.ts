import { describe, expect, it } from "vitest";

import {
  assignEnrollmentInputSchema,
  enrollmentInputSchema,
  staffEnrollmentInputSchema,
} from "./inscripcion";

describe("enrollment input schema (SE-10, RNF-01)", () => {
  it.each([1, 7, 2_147_483_647])("accepts the positive integer %s", (id) => {
    expect(enrollmentInputSchema.parse({ grupoId: id })).toEqual({
      grupoId: id,
    });
  });

  it.each([
    ["zero", 0],
    ["a negative", -3],
    ["a decimal", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a numeric string", "7"],
    ["null", null],
    ["a boolean", true],
  ])("rejects %s as grupoId", (_label, grupoId) => {
    expect(enrollmentInputSchema.safeParse({ grupoId }).success).toBe(false);
  });

  it("rejects a missing grupoId and a non-object payload", () => {
    expect(enrollmentInputSchema.safeParse({}).success).toBe(false);
    expect(enrollmentInputSchema.safeParse(undefined).success).toBe(false);
    expect(enrollmentInputSchema.safeParse(7).success).toBe(false);
  });

  it("drops an extra estudianteId instead of carrying it", () => {
    const parsed = enrollmentInputSchema.parse({
      grupoId: 4,
      estudianteId: 99,
    });

    expect(parsed).toEqual({ grupoId: 4 });
    expect("estudianteId" in parsed).toBe(false);
  });
});

describe("staff enrollment input schema (EA-ACC-1, EA-SCOPE-1, CS-9)", () => {
  it.each([
    [1, 1],
    [7, 12],
    [2_147_483_647, 2_147_483_647],
  ])("accepts the positive integers %s and %s", (estudianteId, grupoId) => {
    expect(staffEnrollmentInputSchema.parse({ estudianteId, grupoId })).toEqual(
      { estudianteId, grupoId },
    );
  });

  it.each(["estudianteId", "grupoId"] as const)(
    "rejects a bad %s while the other id is valid",
    (field) => {
      const bad = [
        0,
        -3,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        "7",
        null,
        true,
        undefined,
      ];

      for (const value of bad) {
        const payload = { estudianteId: 7, grupoId: 5, [field]: value };

        expect(
          staffEnrollmentInputSchema.safeParse(payload).success,
          `${field}=${String(value)}`,
        ).toBe(false);
      }
    },
  );

  it("rejects a missing id and a non-object payload", () => {
    expect(staffEnrollmentInputSchema.safeParse({ grupoId: 5 }).success).toBe(
      false,
    );
    expect(
      staffEnrollmentInputSchema.safeParse({ estudianteId: 7 }).success,
    ).toBe(false);
    expect(staffEnrollmentInputSchema.safeParse(undefined).success).toBe(false);
    expect(staffEnrollmentInputSchema.safeParse(7).success).toBe(false);
  });

  it("drops an extra actor key instead of carrying it", () => {
    const parsed = staffEnrollmentInputSchema.parse({
      estudianteId: 7,
      grupoId: 5,
      actorId: 99,
      scope: { kind: "all" },
    });

    expect(parsed).toEqual({ estudianteId: 7, grupoId: 5 });
    expect("actorId" in parsed).toBe(false);
    expect("scope" in parsed).toBe(false);
  });
});

describe("staff assign input schema (EA-SIB-1 optimistic check)", () => {
  it.each([null, 1, 5, 2_147_483_647])(
    "accepts %s as the group the user saw as replaced",
    (expectedReplaced) => {
      expect(
        assignEnrollmentInputSchema.parse({
          estudianteId: 7,
          grupoId: 9,
          expectedReplaced,
        }),
      ).toEqual({ estudianteId: 7, grupoId: 9, expectedReplaced });
    },
  );

  it.each([
    ["undefined", undefined],
    ["zero", 0],
    ["a negative", -1],
    ["a decimal", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["a numeric string", "5"],
    ["a boolean", false],
    ["an object", { id: 5 }],
    ["an array", [5]],
  ])("rejects %s as expectedReplaced", (_label, value) => {
    expect(
      assignEnrollmentInputSchema.safeParse({
        estudianteId: 7,
        grupoId: 9,
        expectedReplaced: value,
      }).success,
    ).toBe(false);
  });

  it("requires the key: an absent expectedReplaced is not null", () => {
    expect(
      assignEnrollmentInputSchema.safeParse({ estudianteId: 7, grupoId: 9 })
        .success,
    ).toBe(false);
  });

  it("keeps the two id rules and drops an extra actor key", () => {
    expect(
      assignEnrollmentInputSchema.safeParse({
        estudianteId: 0,
        grupoId: 9,
        expectedReplaced: null,
      }).success,
    ).toBe(false);
    expect(
      assignEnrollmentInputSchema.safeParse({
        estudianteId: 7,
        grupoId: 1.5,
        expectedReplaced: null,
      }).success,
    ).toBe(false);
    expect(
      assignEnrollmentInputSchema.parse({
        estudianteId: 7,
        grupoId: 9,
        expectedReplaced: 5,
        actorId: 99,
      }),
    ).toEqual({ estudianteId: 7, grupoId: 9, expectedReplaced: 5 });
  });
});
