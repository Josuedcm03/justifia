import { describe, expect, it } from "vitest";

import { CORRECTION_FOCUS } from "./correction-focus";
import { RETURN_REASONS } from "./return-reasons";

// RN-17 / SR-17: the return reason picks the step the correction opens at. The
// mapping is closed over the RN-17 list, so a new code must be mapped.
describe("CORRECTION_FOCUS (RN-17, SR-17)", () => {
  it.each([
    ["documento_ilegible", "documents"],
    ["fecha_alterada", "documents"],
    ["fecha_incorrecta", "details"],
  ] as const)("%s opens the %s step", (reason, focus) => {
    expect(CORRECTION_FOCUS[reason]).toBe(focus);
  });

  it("maps every RN-17 code to a step, and nothing else", () => {
    expect(RETURN_REASONS.length).toBeGreaterThan(0);
    expect(Object.keys(CORRECTION_FOCUS).sort()).toEqual(
      [...RETURN_REASONS].sort(),
    );
    for (const reason of RETURN_REASONS) {
      expect(["details", "documents"]).toContain(CORRECTION_FOCUS[reason]);
    }
  });
});
