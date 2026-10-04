import { randomInt as cryptoRandomInt } from "node:crypto";

// 32 symbols, no look-alikes (0 O 1 I): these passwords are transcribed by
// hand from a printed sheet. 16 chars * 5 bits = 80 bits (decision D8).
export const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TEMP_PASSWORD_LENGTH = 16;

export type RandomInt = (min: number, max: number) => number;

/**
 * One temporary password. The RNG is injectable so alphabet/length are
 * deterministically testable; the default is the CSPRNG `crypto.randomInt`
 * (unbiased by contract). Never `Math.random`.
 */
export function generateTemporaryPassword(
  randomInt: RandomInt = cryptoRandomInt,
): string {
  let out = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(0, TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}
