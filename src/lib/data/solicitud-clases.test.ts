// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

import type { Transaction } from "@/lib/data/audit";
import { listRequestClasses } from "@/lib/data/solicitud-clases";

function row(overrides: Record<string, unknown> = {}) {
  return {
    solicitudId: 1,
    asignaturaId: 10,
    codigo: "MAT101",
    nombre: "Matematica I",
    numeroGrupo: "A",
    docenteNombre: "Ana Perez",
    ...overrides,
  };
}

function run(rows: unknown[], ids: number[]) {
  const script: Step[] = [{ kind: "select", rows }];
  const double = createDbDouble(script);
  const result = listRequestClasses(double.tx as unknown as Transaction, ids);
  return { double, result };
}

describe("listRequestClasses (SR-3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("groups the classes by request", async () => {
    const { result, double } = run(
      [
        row({ solicitudId: 1 }),
        row({ solicitudId: 1, asignaturaId: 11, codigo: "FIS101" }),
        row({ solicitudId: 2, asignaturaId: 12, codigo: "QUI101" }),
      ],
      [1, 2],
    );
    const map = await result;

    expect([...map.keys()]).toEqual([1, 2]);
    expect(map.get(1)?.map((c) => c.codigo)).toEqual(["MAT101", "FIS101"]);
    expect(map.get(2)?.map((c) => c.codigo)).toEqual(["QUI101"]);
    expect(double.log).toHaveLength(1);
  });

  it("returns each class with the documented fields and a null teacher", async () => {
    const { result } = run([row({ docenteNombre: null })], [1]);
    const map = await result;

    expect(map.get(1)).toEqual([
      {
        asignaturaId: 10,
        codigo: "MAT101",
        nombre: "Matematica I",
        numeroGrupo: "A",
        docenteNombre: null,
      },
    ]);
  });

  it("returns a named teacher when there is one", async () => {
    const { result } = run([row()], [1]);
    const map = await result;

    expect(map.get(1)?.[0].docenteNombre).toBe("Ana Perez");
  });

  it("returns no period and no group id, whatever the row carries", async () => {
    const { result } = run([row({ periodo: "2026-1", grupoId: 99 })], [1]);
    const map = await result;

    const [cls] = map.get(1) ?? [];
    expect(Object.keys(cls).sort()).toEqual([
      "asignaturaId",
      "codigo",
      "docenteNombre",
      "nombre",
      "numeroGrupo",
    ]);
  });

  it("leaves out a request that has no class rows", async () => {
    const { result } = run([row({ solicitudId: 1 })], [1, 2]);
    const map = await result;

    expect(map.has(1)).toBe(true);
    expect(map.has(2)).toBe(false);
  });

  it("returns an empty map without a statement for empty input", async () => {
    const double = createDbDouble([]);
    const map = await listRequestClasses(
      double.tx as unknown as Transaction,
      [],
    );

    expect(map.size).toBe(0);
    expect(double.log).toHaveLength(0);
  });
});
