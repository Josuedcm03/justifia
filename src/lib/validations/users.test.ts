import { describe, expect, it } from "vitest";

import { crearStaffSchema } from "@/lib/validations/users";

const valid = {
  password: "password123",
  nombreCompleto: "Nueva Persona",
  correo: "nueva@uni.edu",
  telefono: "",
  rol: "docente",
  carreraId: "",
};

function issuePaths(input: Record<string, unknown>) {
  const result = crearStaffSchema.safeParse(input);
  return result.success
    ? []
    : [...new Set(result.error.issues.map((i) => i.path[0]))];
}

// FE-27, FE-28: staff are created by their institutional email. The server
// derives the Login from it, so the schema has no login key at all.
describe("crearStaffSchema (FE-27, FE-28)", () => {
  it("has no login key, and a posted login is dropped from the result", () => {
    expect(Object.keys(crearStaffSchema.shape)).not.toContain("login");

    const parsed = crearStaffSchema.parse({ ...valid, login: "other" });

    expect(parsed).not.toHaveProperty("login");
  });

  it("accepts a valid creation", () => {
    expect(crearStaffSchema.parse(valid)).toMatchObject({
      correo: "nueva@uni.edu",
      rol: "docente",
    });
  });

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["only spaces", "   "],
    ["not an address", "not-an-email"],
    ["an address with no domain", "ana@"],
    ["161 characters", `${"a".repeat(153)}@uni.edu`],
  ])(
    "refuses an email that is %s, with the error on the email",
    (_l, correo) => {
      const input: Record<string, unknown> = { ...valid, correo };
      if (correo === undefined) delete input.correo;

      expect(issuePaths(input)).toEqual(["correo"]);
    },
  );

  it("accepts an email of exactly 160 characters", () => {
    const correo = `${"a".repeat(152)}@uni.edu`;
    expect(correo).toHaveLength(160);

    expect(crearStaffSchema.parse({ ...valid, correo }).correo).toBe(correo);
  });

  it.each([
    ["  Ana.Perez@UNI.edu ", "ana.perez@uni.edu"],
    ["ANA@uni.edu", "ana@uni.edu"],
    ["ana@uni.edu", "ana@uni.edu"],
  ])("stores %j trimmed and lower-case", (typed, stored) => {
    expect(crearStaffSchema.parse({ ...valid, correo: typed }).correo).toBe(
      stored,
    );
  });

  it("requires the email for every role the flow can assign", () => {
    for (const rol of [
      "docente",
      "secretaria",
      "coordinacion",
      "administrador",
    ]) {
      expect(issuePaths({ ...valid, rol, correo: "" })).toContain("correo");
    }
  });

  it("keeps the other rules: password, name and role", () => {
    expect(issuePaths({ ...valid, password: "short" })).toContain("password");
    expect(issuePaths({ ...valid, nombreCompleto: " " })).toContain(
      "nombreCompleto",
    );
    expect(issuePaths({ ...valid, rol: "estudiante" })).toContain("rol");
  });
});
