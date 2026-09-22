import { describe, expect, it } from "vitest";

import {
  deriveLogin,
  LOGIN_MAX,
  normalizeEmail,
  normalizeKey,
  normalizePeriodo,
  PERIODO_RE,
} from "./normalize";

// IAP: Login derivation. AC: Grupo shape / Valid-Invalid periods.
describe("normalizeEmail", () => {
  it("trims surrounding whitespace and lowercases", () => {
    expect(normalizeEmail("  Ana.Perez@Uni.EDU  ")).toBe("ana.perez@uni.edu");
  });

  it("does not strip dots from the local part", () => {
    expect(normalizeEmail("ana.perez@uni.edu")).toBe("ana.perez@uni.edu");
  });

  it("does not remove +tag suffixes", () => {
    expect(normalizeEmail("ana+docente@uni.edu")).toBe("ana+docente@uni.edu");
  });
});

describe("deriveLogin (IAP: Login derivation)", () => {
  it("derives the login from the whole normalized email", () => {
    expect(deriveLogin("Ana.Perez@uni.edu")).toEqual({
      login: "ana.perez@uni.edu",
    });
  });

  it("gives distinct logins for two emails sharing the same local part", () => {
    const a = deriveLogin("ana@uni.edu");
    const b = deriveLogin("ana@otra.edu");
    expect(a).toEqual({ login: "ana@uni.edu" });
    expect(b).toEqual({ login: "ana@otra.edu" });
    expect(a).not.toEqual(b);
  });

  it("accepts an email of exactly LOGIN_MAX (60) characters", () => {
    expect(LOGIN_MAX).toBe(60);
    const local = "a".repeat(48);
    const padded = `${local}xxxx@uni.edu`; // 48 + 4 + 8 = 60 chars
    expect(padded).toHaveLength(60);
    expect(deriveLogin(padded)).toEqual({ login: padded });
  });

  it("returns loginTooLong for an email of 61 characters, never truncated or suffixed", () => {
    const local = "a".repeat(48);
    const email = `${local}xxxxx@uni.edu`; // 48 + 5 + 8 = 61 chars
    expect(email).toHaveLength(61);
    const result = deriveLogin(email);
    expect(result).toEqual({ error: "loginTooLong" });
    // Never a truncated/suffixed login instead of the error.
    expect(result).not.toHaveProperty("login");
  });
});

describe("PERIODO_RE (AC: Valid/Invalid periods)", () => {
  it.each(["2026-S1", "2026-S2"])("accepts %s", (value) => {
    expect(PERIODO_RE.test(value)).toBe(true);
  });

  it.each(["2026-s1", "2026-S3", "26-S1", "2026-S1 ", ""])(
    "rejects %s",
    (value) => {
      expect(PERIODO_RE.test(value)).toBe(false);
    },
  );
});

describe("normalizeKey (used for header matching)", () => {
  it("trims, lowercases and strips diacritics", () => {
    expect(normalizeKey("  Código  ")).toBe("codigo");
    expect(normalizeKey("NOMBRE")).toBe("nombre");
  });
});

describe("normalizePeriodo", () => {
  it("trims only, leaving case and content untouched", () => {
    expect(normalizePeriodo("  2026-S1  ")).toBe("2026-S1");
    expect(normalizePeriodo("2026-s1")).toBe("2026-s1");
  });
});
