import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  loginSchema,
  rolUsuarioSchema,
} from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("accepts a valid credential pair and trims the login", () => {
    const result = loginSchema.parse({
      login: "  admin  ",
      password: "supersecret",
    });

    expect(result).toEqual({ login: "admin", password: "supersecret" });
  });

  it("rejects an empty login", () => {
    expect(
      loginSchema.safeParse({ login: "", password: "supersecret" }).success,
    ).toBe(false);
  });

  // FE-21: the identifier is an email (up to the 160 characters of
  // `Usuario.Correo`) or a CIF, so the old 60-character limit of a username no
  // longer applies.
  it("accepts a 160-character identifier after trimming and refuses 161", () => {
    const ok = "a".repeat(160);
    expect(
      loginSchema.parse({ login: `  ${ok}  `, password: "supersecret" }).login,
    ).toBe(ok);
    expect(
      loginSchema.safeParse({ login: "a".repeat(161), password: "supersecret" })
        .success,
    ).toBe(false);
  });

  it("accepts an email-sized identifier that the old limit of 60 refused", () => {
    const email = `${"a".repeat(70)}@uni.edu`;
    expect(
      loginSchema.safeParse({ login: email, password: "supersecret" }).success,
    ).toBe(true);
  });

  it("refuses an identifier that is only spaces", () => {
    expect(
      loginSchema.safeParse({ login: "   ", password: "supersecret" }).success,
    ).toBe(false);
  });

  it("keeps the password rule: 8 to 128 characters", () => {
    const login = "26001234";
    const bad = (password: string) =>
      loginSchema.safeParse({ login, password }).success;
    expect(bad("1234567")).toBe(false);
    expect(bad("12345678")).toBe(true);
    expect(bad("p".repeat(128))).toBe(true);
    expect(bad("p".repeat(129))).toBe(false);
  });

  it("does not ask for a Usuario in any of its messages", () => {
    const result = loginSchema.safeParse({ login: "", password: "short" });
    expect(result.success).toBe(false);
    if (!result.success) {
      for (const issue of result.error.issues) {
        expect(issue.message.toLowerCase()).not.toContain("usuario");
      }
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      loginSchema.safeParse({ login: "admin", password: "short" }).success,
    ).toBe(false);
  });
});

describe("rolUsuarioSchema", () => {
  it("accepts the roles defined in the data model", () => {
    expect(rolUsuarioSchema.parse("secretaria")).toBe("secretaria");
    expect(rolUsuarioSchema.parse("administrador")).toBe("administrador");
  });

  it("rejects an unknown role", () => {
    expect(rolUsuarioSchema.safeParse("superuser").success).toBe(false);
  });
});

describe("changePasswordSchema (FPC)", () => {
  const valid = {
    currentPassword: "temporary-pass",
    newPassword: "my-own-secret",
    confirmPassword: "my-own-secret",
  };

  function issuePaths(input: Record<string, unknown>) {
    const result = changePasswordSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((i) => i.path[0]);
  }

  it("accepts a compliant change", () => {
    expect(changePasswordSchema.parse(valid)).toEqual(valid);
  });

  it("requires the current password", () => {
    expect(issuePaths({ ...valid, currentPassword: "" })).toContain(
      "currentPassword",
    );
  });

  it("applies the registration strength rule to the new password", () => {
    expect(
      issuePaths({ ...valid, newPassword: "short", confirmPassword: "short" }),
    ).toContain("newPassword");
    const long = "x".repeat(129);
    expect(
      issuePaths({ ...valid, newPassword: long, confirmPassword: long }),
    ).toContain("newPassword");
  });

  it("requires the confirmation to match", () => {
    expect(issuePaths({ ...valid, confirmPassword: "different-one" })).toEqual([
      "confirmPassword",
    ]);
  });

  it("rejects a new password equal to the current (temporary) one", () => {
    const same = "temporary-pass";
    expect(
      issuePaths({
        currentPassword: same,
        newPassword: same,
        confirmPassword: same,
      }),
    ).toEqual(["newPassword"]);
  });
});
