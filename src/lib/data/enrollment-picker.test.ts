// @vitest-environment node
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usuario } from "@/db/schema";
import { CATALOG_OPTIONS_MAX } from "@/lib/catalog/list-params";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder } = vi.hoisted(() => ({ holder: { current: null as unknown } }));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

import {
  getLatestPeriod,
  listEnrollableAsignaturas,
  listEnrollableGroups,
  listMyEnrollments,
  loadEnrollmentPage,
} from "./enrollment-picker";

const S = 7;
const PERIODO = "2026-S2";

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function render(fragment: unknown) {
  return new PgDialect().sqlToQuery(fragment as SQL);
}

const occurrences = (text: string, part: string) => text.split(part).length - 1;

function enrollment(grupoId: number, docente: string | null) {
  return {
    grupoId,
    asignaturaId: 10 + grupoId,
    asignaturaCodigo: `ASG-${grupoId}`,
    asignaturaNombre: `Subject ${grupoId}`,
    periodo: grupoId === 1 ? "2026-S1" : PERIODO,
    numeroGrupo: `0${grupoId}`,
    docenteNombre: docente,
    inOpenRequest: grupoId === 2,
  };
}

function offered(id: number, ownCarrera: boolean) {
  return {
    id,
    codigo: `ASG-${id}`,
    nombre: `Subject ${id}`,
    carreraNombre: ownCarrera ? "Own" : "Other",
    ownCarrera,
  };
}

beforeEach(() => {
  holder.current = null;
});

describe("getLatestPeriod (SE-4)", () => {
  it("reads the greatest period over active grupos of ACTIVE asignaturas", async () => {
    const double = use([{ kind: "select", rows: [{ periodo: PERIODO }] }]);

    expect(await getLatestPeriod()).toBe(PERIODO);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Grupo"."Activo"');
    expect(query.sql).toContain('"Asignatura"."Activo"');
  });

  it("is null when no active grupo of an active asignatura exists", async () => {
    use([{ kind: "select", rows: [{ periodo: null }] }]);

    expect(await getLatestPeriod()).toBeNull();
  });
});

describe("listMyEnrollments (RF-16, RF-04)", () => {
  it("lists effective enrollments of ALL periods, keeping a group without teacher", async () => {
    const double = use([
      {
        kind: "select",
        rows: [enrollment(1, "Dr. Ruiz"), enrollment(2, null)],
      },
    ]);

    const result = await listMyEnrollments(S);

    expect(result.map((r) => [r.grupoId, r.periodo, r.docenteNombre])).toEqual([
      [1, "2026-S1", "Dr. Ruiz"],
      [2, PERIODO, null],
    ]);
    const where = render(double.log[0].where);
    expect(where.params).toContain(S);
    for (const part of [
      '"Inscripcion"."Activo"',
      '"Grupo"."Activo"',
      '"Asignatura"."Activo"',
    ]) {
      expect(where.sql).toContain(part);
    }
    expect(where.sql).not.toContain('"Periodo"');
    expect((double.log[0].orderBy as SQL[]).map((o) => render(o).sql)).toEqual([
      '"Asignatura"."Nombre" asc',
      '"Grupo"."NumeroGrupo" asc',
    ]);
  });

  it("flags a group named by the student's own draft or returned request only", async () => {
    const double = use([{ kind: "select", rows: [enrollment(2, "A")] }]);

    expect((await listMyEnrollments(S))[0].inOpenRequest).toBe(true);

    const selection = double.log[0].selection as { inOpenRequest: SQL };
    const flag = render(selection.inOpenRequest);
    expect(flag.sql).toContain(
      '"SolicitudAsignatura"."GrupoId" = "Inscripcion"."GrupoId"',
    );
    expect(flag.sql).toContain('"Solicitud"."EstudianteId"');
    expect(flag.sql).toContain("in ('borrador', 'devuelta')");
    expect(flag.sql).not.toMatch(/pendiente|aprobada/);
    expect(flag.params).toEqual([S]);
  });
});

describe("listEnrollableAsignaturas (RF-16, RN-21)", () => {
  it("offers active asignaturas with an active grupo in the period, own carrera first", async () => {
    const double = use([
      { kind: "select", rows: [offered(1, true), offered(2, false)] },
    ]);

    const result = await listEnrollableAsignaturas(S, PERIODO);

    expect(result).toEqual({
      data: [offered(1, true), offered(2, false)],
      truncated: false,
    });
    const [entry] = double.log;
    const where = render(entry.where);
    expect(where.sql).toContain('"Asignatura"."Activo"');
    expect(where.sql).toContain('"Grupo"."Activo"');
    expect(where.params).toContain(PERIODO);
    const own = render((entry.selection as { ownCarrera: SQL }).ownCarrera);
    expect(own.sql).toContain('"Asignatura"."CarreraId"');
    expect(own.sql).toContain('"Usuario"."CarreraId"');
    expect(own.sql).toContain("coalesce");
    expect(render(entry.where).params).toContain(S);
    const order = (entry.orderBy as SQL[]).map((o) => render(o).sql);
    expect(order[0]).toContain("desc");
    expect(order[0]).toContain('"Usuario"."CarreraId"');
    expect(order[1]).toBe('"Asignatura"."Nombre" asc');
  });

  it("caps the list at CATALOG_OPTIONS_MAX and says so", async () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => offered(i + 1, false));
    use([{ kind: "select", rows: many(CATALOG_OPTIONS_MAX + 1) }]);

    const capped = await listEnrollableAsignaturas(S, PERIODO);
    expect(capped.data).toHaveLength(CATALOG_OPTIONS_MAX);
    expect(capped.truncated).toBe(true);

    use([{ kind: "select", rows: many(CATALOG_OPTIONS_MAX) }]);
    const exact = await listEnrollableAsignaturas(S, PERIODO);
    expect(exact.data).toHaveLength(CATALOG_OPTIONS_MAX);
    expect(exact.truncated).toBe(false);
  });
});

describe("listEnrollableGroups (RNF-01, RNF-02)", () => {
  it("selects the docente name only, never email or phone, and decodes the days", async () => {
    const double = use([
      {
        kind: "select",
        rows: [
          { grupoId: 5, numeroGrupo: "01", docenteNombre: "Dr. Ruiz", dias: 5 },
          { grupoId: 6, numeroGrupo: "02", docenteNombre: null, dias: 0 },
        ],
      },
    ]);

    expect(await listEnrollableGroups(11, PERIODO)).toEqual([
      {
        grupoId: 5,
        numeroGrupo: "01",
        docenteNombre: "Dr. Ruiz",
        dias: ["lunes", "miercoles"],
      },
      { grupoId: 6, numeroGrupo: "02", docenteNombre: null, dias: [] },
    ]);

    const selection = double.log[0].selection as Record<string, unknown>;
    expect(Object.keys(selection)).toEqual([
      "grupoId",
      "numeroGrupo",
      "docenteNombre",
      "dias",
    ]);
    expect(selection.docenteNombre).toBe(usuario.nombreCompleto);
    expect(Object.values(selection)).not.toContain(usuario.correo);
    expect(Object.values(selection)).not.toContain(usuario.telefono);
    const where = render(double.log[0].where);
    expect(where.params).toEqual(expect.arrayContaining([11, PERIODO]));
    expect(occurrences(where.sql, '."Activo"')).toBe(2);
  });
});

describe("loadEnrollmentPage (fail-soft)", () => {
  const group = { grupoId: 5, numeroGrupo: "01", docenteNombre: "A", dias: 1 };

  it("returns the enrollments, the offering and the groups of the selected asignatura", async () => {
    const double = use([
      { kind: "select", rows: [{ periodo: PERIODO }] },
      { kind: "select", rows: [enrollment(2, "A")] },
      { kind: "select", rows: [offered(11, true)] },
      { kind: "select", rows: [group] },
    ]);

    const result = await loadEnrollmentPage(S, 11);

    expect(result.degraded).toBe(false);
    expect(result.data.periodo).toBe(PERIODO);
    expect(result.data.enrollments.map((e) => e.grupoId)).toEqual([2]);
    expect(result.data.asignaturas.map((a) => a.id)).toEqual([11]);
    expect(result.data.groups.map((g) => g.grupoId)).toEqual([5]);
    expect(double.exhausted).toBe(true);
  });

  it("reads no groups when no asignatura is selected", async () => {
    const double = use([
      { kind: "select", rows: [{ periodo: PERIODO }] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [offered(11, true)] },
    ]);

    const result = await loadEnrollmentPage(S, null);

    expect(result.data.groups).toEqual([]);
    expect(result.data.asignaturas).toHaveLength(1);
    expect(double.exhausted).toBe(true);
  });

  it("without a period returns the enrollments and no offering", async () => {
    const double = use([
      { kind: "select", rows: [{ periodo: null }] },
      { kind: "select", rows: [enrollment(2, "A")] },
    ]);

    const result = await loadEnrollmentPage(S, 11);

    expect(result).toEqual({
      degraded: false,
      data: {
        periodo: null,
        enrollments: [enrollment(2, "A")],
        asignaturas: [],
        truncated: false,
        groups: [],
      },
    });
    expect(double.exhausted).toBe(true);
  });

  it("never throws: any read error is a degraded, empty result", async () => {
    use([
      { kind: "select", rows: [{ periodo: PERIODO }] },
      { kind: "select", error: new Error("db down") },
    ]);

    expect(await loadEnrollmentPage(S, 11)).toEqual({
      degraded: true,
      data: {
        periodo: null,
        enrollments: [],
        asignaturas: [],
        truncated: false,
        groups: [],
      },
    });
  });
});
