import { describe, expect, it } from "vitest";

import { RETURN_REASONS, isReturnReason } from "./return-reasons";

describe("RN-17 return reasons", () => {
  it("is the closed list of three codes", () => {
    expect([...RETURN_REASONS]).toEqual([
      "fecha_incorrecta",
      "fecha_alterada",
      "documento_ilegible",
    ]);
  });

  it("fits the MotivoCodigo varchar(30) column", () => {
    for (const code of RETURN_REASONS)
      expect(code.length).toBeLessThanOrEqual(30);
  });

  it("accepts listed codes only", () => {
    for (const code of RETURN_REASONS) expect(isReturnReason(code)).toBe(true);
    for (const bad of ["", "otro", "FECHA_INCORRECTA", null, undefined, 1]) {
      expect(isReturnReason(bad)).toBe(false);
    }
  });
});
