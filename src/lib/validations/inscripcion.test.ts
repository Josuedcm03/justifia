import { describe, expect, it } from "vitest";

import {
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
