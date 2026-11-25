import { describe, expect, it } from "vitest";

import { classifyIdentifier } from "@/lib/auth/login-identity";
import {
  crearStaffSchema,
  registroEstudianteSchema,
} from "@/lib/validations/users";

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
    expect(issuePaths({ ...valid, password: "1234567" })).toContain("password");
    expect(issuePaths({ ...valid, password: "12345678" })).toEqual([]);
    expect(issuePaths({ ...valid, nombreCompleto: " " })).toContain(
      "nombreCompleto",
    );
    expect(issuePaths({ ...valid, rol: "estudiante" })).toContain("rol");
  });
});

// FE-26, FE-28: a student registers with the email and the CIF, never with a
// chosen username. The server derives the Login from the email.
describe("registroEstudianteSchema (FE-26, FE-28)", () => {
  const registro = {
    password: "long-enough-pass",
    nombreCompleto: "Nueva Cuenta",
    correo: "nueva@uni.edu",
    telefono: "",
    cif: "26001234",
    carreraId: "2",
  };

  function registroPaths(input: Record<string, unknown>) {
    const result = registroEstudianteSchema.safeParse(input);
    return result.success
      ? []
      : [...new Set(result.error.issues.map((i) => i.path[0]))];
  }

  it("has no login key, and a posted login is dropped from the result", () => {
    expect(Object.keys(registroEstudianteSchema.shape)).not.toContain("login");

    const parsed = registroEstudianteSchema.parse({
      ...registro,
      login: "other",
    });

    expect(parsed).not.toHaveProperty("login");
  });

  it("accepts a valid registration", () => {
    expect(
      registroEstudianteSchema.parse({ ...registro, cif: "  26001234 " }),
    ).toMatchObject({ cif: "26001234", carreraId: 2 });
  });

  // FE-26 (AEA-4), FE-21: the CIF is stored cleaned the way the sign-in cleans
  // what is typed (trim, spaces and hyphens removed, case kept), so the stored
  // value is the one a later sign-in matches.
  it.each([
    ["2201-0116", "22010116"],
    ["  2201 0116  ", "22010116"],
    ["22 01 - 01-16", "22010116"],
    ["26001234", "26001234"],
    [" Ab-12 ", "Ab12"],
    ["ABC", "ABC"],
  ])("stores the CIF %j cleaned as %j", (typed, stored) => {
    expect(
      registroEstudianteSchema.parse({ ...registro, cif: typed }).cif,
    ).toBe(stored);
  });

  it.each(["2201-0116", "  2201 0116  ", " Ab-12 ", "26001234"])(
    "stores the CIF %j as the value the sign-in looks up for the same input",
    (typed) => {
      const stored = registroEstudianteSchema.parse({
        ...registro,
        cif: typed,
      }).cif;

      expect(classifyIdentifier(typed)).toEqual({ kind: "cif", value: stored });
      expect(classifyIdentifier(stored)).toEqual({
        kind: "cif",
        value: stored,
      });
    },
  );

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["only spaces", "   "],
    ["not an address", "not-an-email"],
    ["161 characters", `${"a".repeat(153)}@uni.edu`],
  ])(
    "refuses an email that is %s, with the error on the email",
    (_l, correo) => {
      const input: Record<string, unknown> = { ...registro, correo };
      if (correo === undefined) delete input.correo;

      expect(registroPaths(input)).toEqual(["correo"]);
    },
  );

  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["only spaces", "   "],
    ["only hyphens", "---"],
    ["only spaces and hyphens", " - - "],
    ["21 characters", "1".repeat(21)],
    ["21 characters once cleaned", "1111-1111-1111-1111-1111 1"],
    // The sign-in takes anything with "@" as an email, so it could never match.
    ["an email", "ana@uni.edu"],
    ["digits with an at sign", "2201@0116"],
    ["an at sign among spaces and hyphens", " - @ - "],
  ])("refuses a CIF that is %s, with the error on the CIF", (_l, cif) => {
    const input: Record<string, unknown> = { ...registro, cif };
    if (cif === undefined) delete input.cif;

    expect(registroPaths(input)).toEqual(["cif"]);
  });

  it("accepts a CIF of exactly 20 characters", () => {
    expect(
      registroEstudianteSchema.parse({ ...registro, cif: "1".repeat(20) }).cif,
    ).toHaveLength(20);
  });

  it("applies the 20-character limit to the cleaned CIF, not to what was typed", () => {
    const typed = "1111-1111-1111-1111-1111";

    expect(typed).toHaveLength(24);
    expect(
      registroEstudianteSchema.parse({ ...registro, cif: typed }).cif,
    ).toBe("1".repeat(20));
  });

  it.each([
    ["  Ana.Perez@UNI.edu ", "ana.perez@uni.edu"],
    ["ANA@uni.edu", "ana@uni.edu"],
  ])("stores the email %j trimmed and lower-case", (typed, stored) => {
    expect(
      registroEstudianteSchema.parse({ ...registro, correo: typed }).correo,
    ).toBe(stored);
  });

  it("keeps the other rules: password, name and career", () => {
    expect(registroPaths({ ...registro, password: "1234567" })).toContain(
      "password",
    );
    expect(registroPaths({ ...registro, password: "12345678" })).toEqual([]);
    expect(registroPaths({ ...registro, nombreCompleto: " " })).toContain(
      "nombreCompleto",
    );
    expect(registroPaths({ ...registro, carreraId: "0" })).toContain(
      "carreraId",
    );
  });
});
