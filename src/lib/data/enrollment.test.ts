// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupScheduleProvider } from "@/lib/intake/ports";

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

import { listEligibleGroups, listEnrollmentFailSoft } from "./enrollment";

const STUDENT = 7;
const RANGE = { from: "2026-10-01", to: "2026-10-09" };

function group(grupoId: number, asignaturaId: number, docente: string | null) {
  return {
    grupoId,
    asignaturaId,
    asignaturaCodigo: `ASG-${asignaturaId}`,
    asignaturaNombre: `Subject ${asignaturaId}`,
    periodo: "2026-II",
    numeroGrupo: `0${grupoId}`,
    docenteNombre: docente,
  };
}

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function scheduleOf(ids: number[]): GroupScheduleProvider & {
  calls: unknown[];
} {
  const calls: unknown[] = [];
  return {
    calls,
    async groupsWithClass(grupoIds, range) {
      calls.push({ grupoIds: [...grupoIds], range });
      return new Set(grupoIds.filter((id) => ids.includes(id)));
    },
  };
}

describe("listEligibleGroups (RF-04, RN-21, RN-22, D15)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the enrolled groups with the teacher label, keeping a group without teacher", async () => {
    use([
      {
        kind: "select",
        rows: [group(1, 10, "Dr. Ruiz"), group(2, 11, null)],
      },
    ]);

    const result = await listEligibleGroups(STUDENT, RANGE, scheduleOf([1, 2]));

    expect(result).toEqual([group(1, 10, "Dr. Ruiz"), group(2, 11, null)]);
  });

  it("filters the active enrollment of THIS student through the schedule port for the dates", async () => {
    const double = use([
      { kind: "select", rows: [group(1, 10, "A"), group(2, 11, "B")] },
    ]);
    const schedule = scheduleOf([2]);

    const result = await listEligibleGroups(STUDENT, RANGE, schedule);

    expect(result.map((g) => g.grupoId)).toEqual([2]);
    expect(schedule.calls).toEqual([{ grupoIds: [1, 2], range: RANGE }]);
    const where = double.log[0].where as Parameters<PgDialect["sqlToQuery"]>[0];
    const query = new PgDialect().sqlToQuery(where);
    expect(query.sql).toContain('"Inscripcion"."Activo"');
    expect(query.sql).toContain('"Grupo"."Activo"');
    expect(query.params).toContain(STUDENT);
  });

  it("requires an active asignatura: the group of an inactive one is not offered (D12)", async () => {
    const double = use([{ kind: "select", rows: [group(1, 10, "A")] }]);

    await listEligibleGroups(STUDENT, null, scheduleOf([]));

    const where = double.log[0].where as Parameters<PgDialect["sqlToQuery"]>[0];
    const query = new PgDialect().sqlToQuery(where);
    expect(query.sql).toContain('"Asignatura"."Activo"');
    expect(query.params.filter((p) => p === true)).toHaveLength(3);
  });

  it("skips the schedule port when no valid range is known yet", async () => {
    use([{ kind: "select", rows: [group(1, 10, "A")] }]);
    const schedule = scheduleOf([]);

    const result = await listEligibleGroups(STUDENT, null, schedule);

    expect(result.map((g) => g.grupoId)).toEqual([1]);
    expect(schedule.calls).toHaveLength(0);
  });

  it("does not call the port for an empty enrollment", async () => {
    use([{ kind: "select", rows: [] }]);
    const schedule = scheduleOf([1]);

    expect(await listEligibleGroups(STUDENT, RANGE, schedule)).toEqual([]);
    expect(schedule.calls).toHaveLength(0);
  });

  it("fails loud when the read fails (security-critical re-check)", async () => {
    holder.current = {
      select: () => {
        throw new Error("db down");
      },
    };

    await expect(
      listEligibleGroups(STUDENT, RANGE, scheduleOf([1])),
    ).rejects.toThrow("db down");
  });
});

describe("listEnrollmentFailSoft (UI read)", () => {
  it("wraps the groups as { data, degraded: false }", async () => {
    use([{ kind: "select", rows: [group(1, 10, "A")] }]);

    expect(
      await listEnrollmentFailSoft(STUDENT, RANGE, scheduleOf([1])),
    ).toEqual({ data: [group(1, 10, "A")], degraded: false });
  });

  it("degrades to an empty list instead of throwing", async () => {
    holder.current = {
      select: () => {
        throw new Error("db down");
      },
    };

    expect(
      await listEnrollmentFailSoft(STUDENT, RANGE, scheduleOf([1])),
    ).toEqual({ data: [], degraded: true });
  });
});
