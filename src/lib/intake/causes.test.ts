import { describe, expect, it } from "vitest";

import { CAUSAS, isCausa } from "./causes";

describe("CAUSAS (RN-01)", () => {
  it("lists exactly five distinct codes", () => {
    expect(CAUSAS).toHaveLength(5);
    expect(new Set(CAUSAS).size).toBe(5);
  });

  it("keeps every code within the Causa varchar(30) column", () => {
    for (const causa of CAUSAS) {
      expect(causa.length).toBeLessThanOrEqual(30);
    }
  });
});

describe("isCausa", () => {
  it("accepts each of the five codes", () => {
    for (const causa of CAUSAS) {
      expect(isCausa(causa)).toBe(true);
    }
  });

  it("rejects a cause outside the list, empty, and non-strings", () => {
    expect(isCausa("vacaciones")).toBe(false);
    expect(isCausa("")).toBe(false);
    expect(isCausa(null)).toBe(false);
    expect(isCausa(undefined)).toBe(false);
    expect(isCausa(3)).toBe(false);
  });
});
