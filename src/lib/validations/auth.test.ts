import { describe, expect, it } from "vitest";

import { loginSchema, rolUsuarioSchema } from "@/lib/validations/auth";

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
