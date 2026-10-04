import { describe, expect, it, vi } from "vitest";

import {
  TEMP_PASSWORD_ALPHABET,
  TEMP_PASSWORD_LENGTH,
  generateTemporaryPassword,
} from "@/lib/import/temp-password";

describe("generateTemporaryPassword (IAP: Temporary password generation)", () => {
  it("uses the 32-symbol ambiguity-free alphabet (no 0 O 1 I L)", () => {
    expect(TEMP_PASSWORD_ALPHABET).toBe("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");
    expect(TEMP_PASSWORD_ALPHABET).toHaveLength(32);
    // The pinned alphabet drops the look-alikes 0, O, 1 and I.
    for (const ch of "0O1I") expect(TEMP_PASSWORD_ALPHABET).not.toContain(ch);
  });

  it("is 16 characters, every one inside the alphabet", () => {
    const pw = generateTemporaryPassword();
    expect(TEMP_PASSWORD_LENGTH).toBe(16);
    expect(pw).toHaveLength(16);
    for (const ch of pw) expect(TEMP_PASSWORD_ALPHABET).toContain(ch);
  });

  it("gives a different password per account (1 000 real draws are unique)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1_000; i++) seen.add(generateTemporaryPassword());
    expect(seen.size).toBe(1_000);
  });

  it("draws each character with randomInt(0, 32), deterministically", () => {
    const randomInt = vi.fn((min: number, max: number) => {
      void min;
      void max;
      return 0;
    });
    const pw = generateTemporaryPassword(randomInt);
    expect(randomInt).toHaveBeenCalledTimes(16);
    for (const call of randomInt.mock.calls) expect(call).toEqual([0, 32]);
    expect(pw).toBe("A".repeat(16));

    let n = 0;
    const counter = (): number => n++ % 32;
    expect(generateTemporaryPassword(counter)).toBe(
      TEMP_PASSWORD_ALPHABET.slice(0, 16),
    );
  });

  it("is not derivable from the account's email or login", () => {
    const accounts = [
      { login: "ana.perez", correo: "ana.perez@uni.edu" },
      { login: "AAAAAAAAAAAAAAAA", correo: "aaaaaaaaaaaaaaaa@uni.edu" },
    ];
    for (let i = 0; i < 200; i++) {
      const pw = generateTemporaryPassword();
      for (const a of accounts) {
        expect(pw.toLowerCase()).not.toBe(a.login.toLowerCase());
        expect(pw.toLowerCase()).not.toBe(a.correo.toLowerCase());
      }
    }
  });
});
