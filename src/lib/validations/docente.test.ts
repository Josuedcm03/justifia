import { describe, expect, it } from "vitest";

import { docenteUpdateSchema } from "@/lib/validations/docente";

const valid = {
  nombreCompleto: "Ana Perez",
  correo: "ana@uni.edu",
  telefono: "555-0100",
};

function issues(input: unknown) {
  const result = docenteUpdateSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.error!.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
  }));
}

/** A valid address of exactly `length` characters (the local part pads it). */
function emailOfLength(length: number) {
  const domain = "@uni.edu";
  return "a".repeat(length - domain.length) + domain;
}

describe("docenteUpdateSchema (DM-3)", () => {
  it("accepts a valid input and returns the three typed fields", () => {
    const result = docenteUpdateSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(valid);
  });

  it.each([
    ["name empty", { nombreCompleto: "" }, "nombreCompleto", "nombre.required"],
    [
      "name whitespace",
      { nombreCompleto: "   " },
      "nombreCompleto",
      "nombre.required",
    ],
    [
      "name 161 chars",
      { nombreCompleto: "a".repeat(161) },
      "nombreCompleto",
      "nombre.tooLong",
    ],
    ["email empty", { correo: "" }, "correo", "correo.required"],
    ["email whitespace", { correo: "   " }, "correo", "correo.required"],
    ["email missing", { correo: undefined }, "correo", "correo.required"],
    [
      "email not an address",
      { correo: "not-an-email" },
      "correo",
      "correo.invalid",
    ],
    ["email without a domain", { correo: "a@" }, "correo", "correo.invalid"],
    [
      "email with a space",
      { correo: "a b@uni.edu" },
      "correo",
      "correo.invalid",
    ],
    [
      "email 161 chars",
      { correo: emailOfLength(161) },
      "correo",
      "correo.tooLong",
    ],
    [
      "phone 31 chars",
      { telefono: "5".repeat(31) },
      "telefono",
      "telefono.tooLong",
    ],
  ])("refuses %s", (_label, override, path, message) => {
    expect(issues({ ...valid, ...override })).toContainEqual({ path, message });
  });

  it.each([
    ["name of exactly 160", { nombreCompleto: "a".repeat(160) }],
    ["email of exactly 160", { correo: emailOfLength(160) }],
    ["phone of exactly 30", { telefono: "5".repeat(30) }],
  ])("accepts %s", (_label, override) => {
    expect(
      docenteUpdateSchema.safeParse({ ...valid, ...override }).success,
    ).toBe(true);
  });

  it("trims the name and the phone, and keeps the inner spaces of the name", () => {
    const data = docenteUpdateSchema.parse({
      ...valid,
      nombreCompleto: "  Ana  Perez ",
      telefono: "  555-0100 ",
    });
    expect(data.nombreCompleto).toBe("Ana  Perez");
    expect(data.telefono).toBe("555-0100");
  });

  it("trims the email and stores it in lower case", () => {
    expect(
      docenteUpdateSchema.parse({ ...valid, correo: " Ana.Perez@UNI.edu " })
        .correo,
    ).toBe("ana.perez@uni.edu");
  });

  it.each([
    ["empty", { telefono: "" }],
    ["whitespace only", { telefono: "   " }],
    ["absent", { telefono: undefined }],
    ["null", { telefono: null }],
  ])("a %s phone is stored as no value", (_label, override) => {
    expect(
      docenteUpdateSchema.parse({ ...valid, ...override }).telefono,
    ).toBeNull();
  });

  it("strips every key outside the three editable fields", () => {
    const data = docenteUpdateSchema.parse({
      ...valid,
      login: "x",
      hashClave: "y",
      rol: "administrador",
      activo: "false",
      cif: "1",
      carreraId: "3",
      facultadId: "2",
      debeCambiarClave: "true",
    });
    expect(data).toEqual(valid);
    expect(Object.keys(data).toSorted()).toEqual([
      "correo",
      "nombreCompleto",
      "telefono",
    ]);
  });

  it("reports every field error together, one entry per invalid field", () => {
    const found = issues({
      nombreCompleto: "",
      correo: "not-an-email",
      telefono: "5".repeat(31),
    });
    expect(found).toEqual(
      expect.arrayContaining([
        { path: "nombreCompleto", message: "nombre.required" },
        { path: "correo", message: "correo.invalid" },
        { path: "telefono", message: "telefono.tooLong" },
      ]),
    );
  });
});
