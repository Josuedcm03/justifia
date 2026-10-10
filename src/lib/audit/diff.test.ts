import { describe, expect, it } from "vitest";

import { changedFields } from "./diff";

const FIELDS = ["nombre", "horasTotales", "activo"] as const;

describe("changedFields", () => {
  it("returns the differing names in field-list order", () => {
    const before = { nombre: "A", horasTotales: 40, activo: true };
    const after = { nombre: "B", horasTotales: 40, activo: false };
    expect(changedFields(FIELDS, before, after)).toEqual(["nombre", "activo"]);
  });

  it("follows the list order, not the key order of the records", () => {
    const before = { activo: true, horasTotales: 1, nombre: "A" };
    const after = { activo: false, horasTotales: 2, nombre: "B" };
    expect(changedFields(FIELDS, before, after)).toEqual([
      "nombre",
      "horasTotales",
      "activo",
    ]);
  });

  it("returns [] when every listed field is equal", () => {
    const record = { nombre: "A", horasTotales: 40, activo: true };
    expect(changedFields(FIELDS, record, { ...record })).toEqual([]);
  });

  it("treats NaN as equal to NaN", () => {
    const before = { nombre: "A", horasTotales: Number.NaN, activo: true };
    const after = { nombre: "A", horasTotales: Number.NaN, activo: true };
    expect(changedFields(FIELDS, before, after)).toEqual([]);
  });

  it("ignores keys outside the list", () => {
    const before = { nombre: "A", horasTotales: 1, activo: true, extra: 1 };
    const after = { nombre: "A", horasTotales: 1, activo: true, extra: 2 };
    expect(changedFields(FIELDS, before, after)).toEqual([]);
  });

  it("returns names only: the result type is the name union", () => {
    const names = changedFields(
      FIELDS,
      { nombre: "A", horasTotales: 1, activo: true },
      { nombre: "B", horasTotales: 1, activo: true },
    );
    // @ts-expect-error - the result holds field names, not values: a name is
    // not assignable to a value type such as number.
    const asNumber: number = names[0];
    expect(names[0]).toBe("nombre");
    expect(asNumber).toBe("nombre");
  });
});
