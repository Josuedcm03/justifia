import { getTableName } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildActiveEnrollmentQuery,
  buildActiveGruposForEstudianteQuery,
  loadCatalogSnapshot,
  type CatalogExecutor,
} from "@/lib/data/catalog";

const qb = new QueryBuilder();

/** Recording `exec` double: every `select().from(t)[.innerJoin()]` resolves to rows keyed by table name. */
function makeExec(rowsByTable: Record<string, unknown[]>) {
  const reads: string[] = [];
  const exec = {
    select: () => ({
      from: (table: never) => {
        const name = getTableName(table);
        reads.push(name);
        const result = Promise.resolve(rowsByTable[name] ?? []);
        return Object.assign(result, {
          innerJoin: () => result,
          where: () => {
            throw new Error(
              `snapshot read of ${name} must not filter rows (inactive rows are included)`,
            );
          },
        });
      },
    }),
  };
  return { exec: exec as unknown as CatalogExecutor, reads };
}

describe("loadCatalogSnapshot (AC: snapshot includes inactive rows)", () => {
  it("reads Facultad, Carrera, Asignatura, Usuario, Grupo and Inscripcion without any filter", async () => {
    const { exec, reads } = makeExec({});
    await loadCatalogSnapshot(exec);
    expect([...reads].sort()).toEqual(
      [
        "Asignatura",
        "Carrera",
        "Facultad",
        "Grupo",
        "Inscripcion",
        "Usuario",
      ].sort(),
    );
  });

  it("returns the CatalogSnapshot shape and keeps inactive rows", async () => {
    const grupo = {
      id: 1,
      asignaturaId: 2,
      periodo: "2026-S1",
      numeroGrupo: "1",
      docenteId: 3,
      activo: false,
    };
    const inscripcion = { estudianteId: 4, grupoId: 1, activo: false };
    const usuario = {
      id: 3,
      login: "a@b.c",
      correo: "a@b.c",
      cif: null,
      nombreCompleto: "A",
      carreraId: null,
      activo: false,
      rol: "docente",
    };
    const { exec } = makeExec({
      Facultad: [{ id: 1, nombre: "F" }],
      Carrera: [{ id: 1, nombre: "C", facultadId: 1 }],
      Asignatura: [
        { id: 2, codigo: "X1", nombre: "N", carreraId: 1, horasTotales: 8 },
      ],
      Usuario: [usuario],
      Grupo: [grupo],
      Inscripcion: [inscripcion],
    });
    const snapshot = await loadCatalogSnapshot(exec);
    expect(Object.keys(snapshot).sort()).toEqual([
      "asignaturas",
      "carreras",
      "facultades",
      "grupos",
      "inscripciones",
      "usuarios",
    ]);
    expect(snapshot.grupos).toEqual([grupo]);
    expect(snapshot.inscripciones).toEqual([inscripcion]);
    expect(snapshot.usuarios).toEqual([usuario]);
    expect(snapshot.facultades).toEqual([{ id: 1, nombre: "F" }]);
  });
});

describe("active-only readers (AC: Active-only reads for downstream consumers)", () => {
  it("hasActiveEnrollment filters Activo on BOTH Inscripcion and Grupo", () => {
    const { sql, params } = buildActiveEnrollmentQuery(qb, {
      cif: "C-1",
      grupoId: 7,
    }).toSQL();
    expect(sql).toContain('"Inscripcion"."Activo"');
    expect(sql).toContain('"Grupo"."Activo"');
    expect(sql).toContain('"Usuario"."Cif" = $');
    expect(params).toContain("C-1");
    expect(params).toContain(7);
  });

  it("listActiveGruposForEstudiante filters Activo on both tables and never limits to one group (RF-02, X8)", () => {
    const { sql, params } = buildActiveGruposForEstudianteQuery(qb, {
      cif: "C-1",
      codigoAsignatura: "MAT-101",
      periodo: "2026-S1",
    }).toSQL();
    expect(sql).toContain('"Inscripcion"."Activo"');
    expect(sql).toContain('"Grupo"."Activo"');
    expect(sql).toContain('"Asignatura"."Codigo" = $');
    expect(sql).toContain('"Grupo"."Periodo" = $');
    expect(sql).not.toMatch(/\blimit\b/);
    expect(params).toEqual(
      expect.arrayContaining(["C-1", "MAT-101", "2026-S1"]),
    );
  });
});
