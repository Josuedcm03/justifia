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

import {
  hasActiveEnrollmentFailSoft,
  listEligibleGroups,
  listEnrolledGroups,
  listEnrollmentFailSoft,
  withClassIn,
} from "./enrollment";

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

describe("listEnrolledGroups and withClassIn (the split of listEligibleGroups)", () => {
  it("lists the active effective rows unfiltered, one query", async () => {
    const double = use([
      { kind: "select", rows: [group(1, 10, "A"), group(2, 11, null)] },
    ]);

    expect((await listEnrolledGroups(STUDENT)).map((g) => g.grupoId)).toEqual([
      1, 2,
    ]);
    expect(double.log).toHaveLength(1);
  });

  it("applies the schedule port for a range and skips it for null or no groups", async () => {
    const groups = [group(1, 10, "A"), group(2, 11, "B")];
    const schedule = scheduleOf([2]);

    expect(await withClassIn(groups, RANGE, schedule)).toEqual([groups[1]]);
    expect(await withClassIn(groups, null, schedule)).toEqual(groups);
    expect(await withClassIn([], RANGE, schedule)).toEqual([]);
    expect(schedule.calls).toHaveLength(1);
  });
});

describe("listEnrollmentFailSoft (UI read)", () => {
  it.each([
    ["has class in the dates", [1], [1], true],
    ["has enrollment but no class in the dates", [], [], true],
  ])(
    "reports enrolled from the unfiltered list when the student %s",
    async (_name, withClass, expected, enrolled) => {
      const double = use([{ kind: "select", rows: [group(1, 10, "A")] }]);

      expect(
        await listEnrollmentFailSoft(STUDENT, RANGE, scheduleOf(withClass)),
      ).toEqual({
        data: expected.map((id) => group(id, 10, "A")),
        degraded: false,
        enrolled,
      });
      expect(double.log).toHaveLength(1);
    },
  );

  it("reports enrolled false when the student has no enrollment at all", async () => {
    use([{ kind: "select", rows: [] }]);

    expect(
      await listEnrollmentFailSoft(STUDENT, RANGE, scheduleOf([1])),
    ).toEqual({ data: [], degraded: false, enrolled: false });
  });

  it.each([
    ["the enrollment read", false],
    ["the schedule port", true],
  ])(
    "degrades without a wrong no-enrollment message when %s fails",
    async (_name, readWorks) => {
      if (readWorks) use([{ kind: "select", rows: [group(1, 1, "A")] }]);
      else {
        holder.current = {
          select: () => {
            throw new Error("db down");
          },
        };
      }
      const failing: GroupScheduleProvider = {
        async groupsWithClass() {
          throw new Error("port down");
        },
      };

      expect(await listEnrollmentFailSoft(STUDENT, RANGE, failing)).toEqual({
        data: [],
        degraded: true,
        enrolled: true,
      });
    },
  );
});

describe("hasActiveEnrollmentFailSoft (entry nudge)", () => {
  function limited(rows: unknown[], seen: { where?: unknown; limit?: number }) {
    const chain: Record<string, unknown> = {
      from: () => chain,
      innerJoin: () => chain,
      where: (where: unknown) => ((seen.where = where), chain),
      limit: (n: number) => ((seen.limit = n), Promise.resolve(rows)),
    };
    holder.current = { select: () => chain };
  }

  it.each([
    [[{ grupoId: 1 }], true],
    [[], false],
  ])(
    "answers %j with %s, reading one row with the three active filters",
    async (rows, expected) => {
      const seen: { where?: unknown; limit?: number } = {};
      limited(rows, seen);

      expect(await hasActiveEnrollmentFailSoft(STUDENT)).toBe(expected);

      const query = new PgDialect().sqlToQuery(
        seen.where as Parameters<PgDialect["sqlToQuery"]>[0],
      );
      expect(seen.limit).toBe(1);
      for (const column of ["Inscripcion", "Grupo", "Asignatura"]) {
        expect(query.sql).toContain(`"${column}"."Activo"`);
      }
      expect(query.params).toContain(STUDENT);
    },
  );

  it("answers null on a read failure: no nudge", async () => {
    holder.current = {
      select: () => {
        throw new Error("db down");
      },
    };

    expect(await hasActiveEnrollmentFailSoft(STUDENT)).toBeNull();
  });
});
