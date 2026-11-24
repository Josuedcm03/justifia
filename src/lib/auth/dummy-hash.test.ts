// @vitest-environment node
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";

import { DUMMY_PASSWORD_HASH } from "@/lib/auth/dummy-hash";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

// FE-23, D13: an unknown identifier still pays for one password check, so the
// time of the answer does not tell a missing account from a wrong password.
// That only holds while the dummy hash costs what a real hash costs.
describe("DUMMY_PASSWORD_HASH (FE-23: timing equalized)", () => {
  it("is a bcrypt hash with the cost hashPassword uses", async () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    const real = await hashPassword("any password");
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(bcrypt.getRounds(real));
  });

  it.each([
    ["a typed password", "temporary-pass"],
    ["the hash itself", DUMMY_PASSWORD_HASH],
    ["eight bangs", "!".repeat(8)],
    ["the empty string", ""],
  ])("never verifies %s", async (_label, attempt) => {
    expect(await verifyPassword(attempt, DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
