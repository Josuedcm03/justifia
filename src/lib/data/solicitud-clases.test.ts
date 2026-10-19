// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

import type { Transaction } from "@/lib/data/audit";
import {
  listRequestClasses,
  listRequestTeachers,
} from "@/lib/data/solicitud-clases";

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

describe("listRequestTeachers (teacher-remission TR-4)", () => {
  beforeEach(() => vi.clearAllMocks());

  function teacherRow(overrides: Record<string, unknown> = {}) {
    return {
      docenteId: 5,
      docenteNombre: "Ana Perez",
      docenteCorreo: "ana@uam.edu.ni",
      asignaturaId: 10,
      codigo: "MAT101",
      nombre: "Matematica I",
      numeroGrupo: "A",
      ...overrides,
    };
  }

  function runTeachers(rows: unknown[]) {
    const double = createDbDouble([{ kind: "select", rows }]);
    const result = listRequestTeachers(double.tx as unknown as Transaction, 42);
    return { double, result };
  }

  it("returns one entry per teacher with that teacher's groups only", async () => {
    const { result } = runTeachers([
      teacherRow(),
      teacherRow({
        docenteId: 6,
        docenteNombre: "Luis Mora",
        docenteCorreo: "luis@uam.edu.ni",
        asignaturaId: 11,
        codigo: "FIS101",
        nombre: "Fisica I",
        numeroGrupo: "B",
      }),
    ]);

    expect(await result).toEqual([
      {
        docenteId: 5,
        nombre: "Ana Perez",
        correo: "ana@uam.edu.ni",
        clases: [
          {
            asignaturaId: 10,
            codigo: "MAT101",
            nombre: "Matematica I",
            numeroGrupo: "A",
          },
        ],
      },
      {
        docenteId: 6,
        nombre: "Luis Mora",
        correo: "luis@uam.edu.ni",
        clases: [
          {
            asignaturaId: 11,
            codigo: "FIS101",
            nombre: "Fisica I",
            numeroGrupo: "B",
          },
        ],
      },
    ]);
  });

  it("merges two groups of the same teacher, keeping the row order", async () => {
    const { result } = runTeachers([
      teacherRow(),
      teacherRow({ asignaturaId: 12, codigo: "QUI101", numeroGrupo: "C" }),
    ]);

    const teachers = await result;
    expect(teachers).toHaveLength(1);
    expect(teachers[0].clases.map((c) => c.codigo)).toEqual([
      "MAT101",
      "QUI101",
    ]);
  });

  it("keeps a teacher without an email as null", async () => {
    const { result } = runTeachers([teacherRow({ docenteCorreo: null })]);

    expect((await result)[0].correo).toBeNull();
  });

  it("reports a group without an identified teacher with a null id", async () => {
    const { result } = runTeachers([
      teacherRow({ docenteId: null, docenteNombre: null, docenteCorreo: null }),
    ]);

    expect((await result)[0]).toMatchObject({ docenteId: null, nombre: null });
  });

  it("returns an empty list for a request without classes", async () => {
    const { result } = runTeachers([]);

    expect(await result).toEqual([]);
  });

  it("issues one statement and returns no period or group id", async () => {
    const { result, double } = runTeachers([
      teacherRow({ periodo: "2026-1", grupoId: 99 }),
    ]);

    const [teacher] = await result;
    expect(double.log).toHaveLength(1);
    expect(Object.keys(teacher.clases[0]).sort()).toEqual([
      "asignaturaId",
      "codigo",
      "nombre",
      "numeroGrupo",
    ]);
  });
});
