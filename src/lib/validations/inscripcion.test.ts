import { describe, expect, it } from "vitest";

import { enrollmentInputSchema } from "./inscripcion";

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
