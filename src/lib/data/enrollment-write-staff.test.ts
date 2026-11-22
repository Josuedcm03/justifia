// @vitest-environment node
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { eventoAuditoria } from "@/db/audit-schema";
import { inscripcion, usuario } from "@/db/schema";

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
  dropGroup,
  enrollInGroup,
  staffDropGroup,
  staffEnrollInGroup,
} from "./enrollment-write";

// The staff writer of the enrollment-administration change (EA-WRITE-1,
// EA-DEACT-1, EA-REACT-1, design CS-1..CS-3, CS-8). The student writer keeps
// its own file.
const S = 7;
const G = 9;
const ACTOR = 4444;
const FACULTAD = 4;
const STAFF = {
  actorId: ACTOR,
  scope: { kind: "facultad", facultadId: FACULTAD },
} as const;
const NO_SCOPE = { actorId: ACTOR, scope: { kind: "none" } } as const;
const STUDENT = { kind: "select", rows: [{ id: S }] } as const;
const AUDIT = { kind: "insert" } as const;
const TARGET = {
  kind: "select",
  rows: [{ id: G, asignaturaId: 3, periodo: "2026-S2" }],
} as const;
const INACTIVE_ROW = { kind: "select", rows: [{ activo: false }] } as const;
const NO_SIBLING = { kind: "select", rows: [] } as const;
const REACTIVATE = { kind: "update", rows: [] } as const;
const REACTIVATED = {
  ok: true,
  kind: "reactivated",
  grupoId: G,
  replaced: [],
} as const;

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function render(where: unknown) {
  return new PgDialect().sqlToQuery(where as SQL);
}

const kinds = (double: ReturnType<typeof use>) =>
  double.log.map((entry) => entry.kind);

beforeEach(() => {
  holder.current = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("staff lock (EA-WRITE-1, EA-SCOPE-1, CS-1, CS-2)", () => {
  it("takes the one lock select first: the student's Usuario row, in her facultad, with the actor checked in the same statement", async () => {
    const double = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);

    await staffDropGroup(STAFF, S, G);

    const [lock] = double.log;
    expect(lock.kind).toBe("select");
    expect(lock.lock).toEqual({
      strength: "no key update",
      config: { of: usuario },
    });
    // Rol (the student role) and Carrera (the facultad) are inner joins, so a
    // user without a role match or a carrera is not a row.
    expect(lock.calls?.filter((call) => call === "innerJoin")).toHaveLength(2);
    const query = render(lock.where);
    for (const part of [
      '"Usuario"."Id"',
      '"Rol"."Codigo"',
      '"Usuario"."Activo"',
      '"Carrera"."FacultadId"',
    ]) {
      expect(query.sql).toContain(part);
    }
    expect(query.params).toEqual(
      expect.arrayContaining([S, "estudiante", FACULTAD]),
    );
  });

  it("verifies in that same statement that the actor is an active secretaria of the same facultad", async () => {
    const double = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);

    await staffDropGroup(STAFF, S, G);

    const query = render(double.log[0].where);
    expect(query.sql).toContain("exists");
    expect(query.params).toEqual(
      expect.arrayContaining([ACTOR, "secretaria", true, FACULTAD]),
    );
    // The staff user is the actor, never the student whose row is locked.
    expect(query.params.filter((value) => value === ACTOR)).toHaveLength(1);
    expect(query.params.filter((value) => value === S)).toHaveLength(1);
  });

  it.each([
    {
      label: "a docente, secretaria, coordinacion or administrador target",
      fragment: '"Rol"."Codigo"',
    },
    {
      label: "an inactive or cancelled estudiante",
      fragment: '"Usuario"."Activo"',
    },
    {
      label: "a student of another facultad",
      fragment: '"Carrera"."FacultadId"',
    },
    {
      label: "a student without a carrera (inner join, no facultad to match)",
      fragment: '"Carrera"."FacultadId"',
    },
    { label: "an unknown id", fragment: '"Usuario"."Id"' },
    {
      label: "a stale actor that is no longer an active secretaria",
      fragment: "exists",
    },
  ])(
    "refuses $label with no further statement and no audit row",
    async ({ fragment }) => {
      // The double returns no row; the predicate is what excludes each case.
      const double = use([{ kind: "select", rows: [] }]);

      expect(await staffDropGroup(STAFF, S, G)).toEqual({
        ok: false,
        reason: "not_student",
      });
      expect(kinds(double)).toEqual(["select"]);
      expect(double.exhausted).toBe(true);
      expect(render(double.log[0].where).sql).toContain(fragment);
      expect(
        double.log[0].calls?.filter((call) => call === "innerJoin"),
      ).toHaveLength(2);
    },
  );

  it("renders a scope of none as false and still takes only the one lock statement", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await staffDropGroup(NO_SCOPE, S, G)).toEqual({
      ok: false,
      reason: "not_student",
    });

    expect(kinds(double)).toEqual(["select"]);
    const query = render(double.log[0].where);
    expect(query.sql).toContain("false");
    expect(query.params).not.toContain(FACULTAD);
  });

  it("answers a foreign student and a missing one alike", async () => {
    use([{ kind: "select", rows: [] }]);
    const foreign = await staffDropGroup(STAFF, 8, G);
    use([{ kind: "select", rows: [] }]);
    const missing = await staffDropGroup(STAFF, 999_999, G);

    expect(foreign).toEqual({ ok: false, reason: "not_student" });
    expect(missing).toEqual(foreign);
  });
});

describe("staffDropGroup (EA-DEACT-1, D9, CS-3)", () => {
  it("deactivates the student's row and writes one baja audit row with the STAFF actor", async () => {
    const double = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);

    expect(await staffDropGroup(STAFF, S, G)).toEqual({ ok: true, grupoId: G });

    expect(kinds(double)).toEqual(["select", "update", "insert"]);
    const drop = double.log[1];
    expect(drop.table).toBe(inscripcion);
    expect(drop.set).toEqual({ activo: false });
    const last = double.log.at(-1);
    expect(last?.table).toBe(eventoAuditoria);
    expect(last?.values).toEqual([
      expect.objectContaining({
        actorId: ACTOR,
        accion: "inscripcion.desactivada",
        entidadTipo: "Inscripcion",
        entidadId: S,
        datos: { grupoId: G, motivo: "baja" },
      }),
    ]);
  });

  it("keeps the student on the row: the staff user id never reaches the Inscripcion statement", async () => {
    const double = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);

    await staffDropGroup(STAFF, S, G);

    const query = render(double.log[1].where);
    expect(query.sql).toContain('"Inscripcion"."EstudianteId"');
    expect(query.params).toEqual(expect.arrayContaining([S, G, true]));
    expect(query.params).not.toContain(ACTOR);
  });

  it("filters on neither period nor the state of the grupo or asignatura, so an older period and an inactive group can be deactivated (D9)", async () => {
    const double = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);
    await staffDropGroup(STAFF, S, G);
    const student = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);
    await dropGroup(S, G);

    const sql = render(double.log[1].where).sql;
    expect(sql).not.toContain('"Grupo"');
    expect(sql).not.toContain('"Asignatura"');
    expect(sql).not.toContain("max(");
    // The same statement the student path issues: dropWork is reused unchanged.
    expect(render(double.log[1].where)).toEqual(render(student.log[1].where));
  });

  it.each([
    {
      label: "an inscripcion already inactive",
      fragment: '"Inscripcion"."Activo"',
    },
    {
      label: "a group the student is not in",
      fragment: '"Inscripcion"."GrupoId"',
    },
  ])(
    "refuses $label with not_enrolled: nothing changes and no audit row",
    async ({ fragment }) => {
      const double = use([STUDENT, { kind: "update", rows: [] }]);

      expect(await staffDropGroup(STAFF, S, G)).toEqual({
        ok: false,
        reason: "not_enrolled",
      });
      expect(kinds(double)).toEqual(["select", "update"]);
      expect(double.exhausted).toBe(true);
      expect(render(double.log[1].where).sql).toContain(fragment);
    },
  );

  it("runs in one transaction with every statement inside it", async () => {
    const double = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);

    await staffDropGroup(STAFF, S, G);

    expect(double.transactions).toBe(1);
    expect(double.log.every((entry) => entry.inTransaction)).toBe(true);
  });
});

describe("staff events (audit-log: staff events add nothing)", () => {
  function auditRowOf(double: ReturnType<typeof use>) {
    const [row] = double.log.at(-1)?.values as Record<string, unknown>[];
    return row;
  }

  it("student drop and staff deactivation rows match except the actor", async () => {
    const student = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);
    await dropGroup(S, G);
    const staff = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);
    await staffDropGroup(STAFF, S, G);

    const studentRow = auditRowOf(student);
    const staffRow = auditRowOf(staff);
    expect(studentRow.actorId).toBe(S);
    expect(staffRow.actorId).toBe(ACTOR);
    expect({ ...staffRow, actorId: S }).toEqual(studentRow);
  });

  it("carries ids and closed codes only: no staff id, name, CIF, email or request count", async () => {
    const double = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);

    await staffDropGroup(STAFF, S, G);

    const row = auditRowOf(double);
    expect(Object.keys(row.datos as object).sort()).toEqual([
      "grupoId",
      "motivo",
    ]);
    const payload = JSON.stringify({
      entidadId: row.entidadId,
      datos: row.datos,
    });
    expect(payload).toBe(
      `{"entidadId":${S},"datos":{"grupoId":${G},"motivo":"baja"}}`,
    );
    expect(payload).not.toContain(String(ACTOR));
  });

  it("writes no audit row for a refusal", async () => {
    const double = use([STUDENT, { kind: "update", rows: [] }]);

    await staffDropGroup(STAFF, S, G);

    expect(double.log.map((entry) => entry.table)).not.toContain(
      eventoAuditoria,
    );
  });
});

describe("staff atomicity and failure (EA-DEG-1 Write fails)", () => {
  it.each([
    { label: "a data statement", failing: "update", reached: false },
    { label: "the audit insert", failing: "audit", reached: true },
  ])(
    "rethrows when $label throws, logs one sanitized line with the STAFF actor and reports no audit",
    async ({ failing, reached }) => {
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      const failure = Object.assign(new Error("secret value 123"), {
        cause: { code: "23505" },
      });
      const double = use([
        STUDENT,
        failing === "update"
          ? { kind: "update", error: failure }
          : { kind: "update", rows: [{ grupoId: G }] },
        failing === "audit" ? { kind: "insert", error: failure } : AUDIT,
      ]);

      await expect(staffDropGroup(STAFF, S, G)).rejects.toBe(failure);

      expect(double.exhausted).toBe(reached);
      expect(logger).toHaveBeenCalledTimes(1);
      const line = String(logger.mock.calls[0][0]);
      expect(JSON.parse(line)).toEqual({
        event: "enrollment.write.failed",
        actor: ACTOR,
        errorName: "Error",
        errorCode: "23505",
      });
      expect(line).not.toContain("secret");
    },
  );

  it("does not log a refusal", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    use([{ kind: "select", rows: [] }]);

    await staffDropGroup(STAFF, S, G);

    expect(logger).not.toHaveBeenCalled();
  });
});

describe("staffEnrollInGroup, reactivate only (EA-REACT-1, CS-3, CS-8)", () => {
  const SUCCESS = [
    STUDENT,
    TARGET,
    INACTIVE_ROW,
    NO_SIBLING,
    REACTIVATE,
    AUDIT,
  ];

  it("reactivates an inactive row of an offered group with no sibling and writes one reactivada with the STAFF actor", async () => {
    const double = use(SUCCESS);

    expect(await staffEnrollInGroup(STAFF, S, G)).toEqual(REACTIVATED);

    expect(kinds(double)).toEqual([
      "select",
      "select",
      "select",
      "select",
      "update",
      "insert",
    ]);
    expect(double.exhausted).toBe(true);
    expect(double.log[4].table).toBe(inscripcion);
    expect(double.log[4].set).toEqual({ activo: true });
    const last = double.log.at(-1);
    expect(last?.table).toBe(eventoAuditoria);
    expect(last?.values).toEqual([
      expect.objectContaining({
        actorId: ACTOR,
        accion: "inscripcion.reactivada",
        entidadTipo: "Inscripcion",
        entidadId: S,
        datos: { grupoId: G },
      }),
    ]);
  });

  it("issues the student's own reactivate statement and an audit row equal to the student's except the actor", async () => {
    const staff = use(SUCCESS);
    await staffEnrollInGroup(STAFF, S, G);
    const student = use([
      STUDENT,
      TARGET,
      INACTIVE_ROW,
      { kind: "update", rows: [] },
      REACTIVATE,
      AUDIT,
    ]);
    await enrollInGroup(S, G);

    expect(render(staff.log[4].where)).toEqual(render(student.log[4].where));
    expect(render(staff.log[4].where).params).toEqual(
      expect.arrayContaining([S, G, false]),
    );
    const [staffRow] = staff.log.at(-1)?.values as Record<string, unknown>[];
    const [studentRow] = student.log.at(-1)?.values as Record<
      string,
      unknown
    >[];
    expect(staffRow.actorId).toBe(ACTOR);
    expect({ ...staffRow, actorId: S }).toEqual(studentRow);
  });

  it.each([
    { label: "an older period", fragment: '"Grupo"."Periodo"' },
    { label: "a grupo that is inactive", fragment: '"Grupo"."Activo"' },
    {
      label: "an asignatura that is inactive",
      fragment: '"Asignatura"."Activo"',
    },
  ])(
    "refuses $label with not_eligible: nothing changes and no audit row",
    async ({ fragment }) => {
      // The double returns no group; the predicate is what excludes each case.
      const double = use([STUDENT, { kind: "select", rows: [] }]);

      expect(await staffEnrollInGroup(STAFF, S, G)).toEqual({
        ok: false,
        reason: "not_eligible",
      });
      expect(kinds(double)).toEqual(["select", "select"]);
      expect(double.exhausted).toBe(true);
      expect(render(double.log[1].where).sql).toContain(fragment);
    },
  );

  it.each([
    {
      label: "a row that is already active",
      script: [STUDENT, TARGET, { kind: "select", rows: [{ activo: true }] }],
      reason: "already_enrolled",
    },
    {
      label: "no inscripcion row at all (create belongs to S3)",
      script: [STUDENT, TARGET, { kind: "select", rows: [] }],
      reason: "not_eligible",
    },
  ] as const)(
    "refuses $label with $reason: nothing is inserted or updated and no audit row",
    async ({ script, reason }) => {
      const double = use([...script]);

      expect(await staffEnrollInGroup(STAFF, S, G)).toEqual({
        ok: false,
        reason,
      });
      expect(kinds(double)).toEqual(["select", "select", "select"]);
      expect(double.exhausted).toBe(true);
    },
  );

  it("refuses an out-of-scope, unknown or non-student target with not_student after the one lock statement", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await staffEnrollInGroup(STAFF, 999_999, G)).toEqual({
      ok: false,
      reason: "not_student",
    });
    expect(kinds(double)).toEqual(["select"]);
    expect(double.exhausted).toBe(true);
  });

  it("refuses a scope of none like any other out-of-scope student", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await staffEnrollInGroup(NO_SCOPE, S, G)).toEqual({
      ok: false,
      reason: "not_student",
    });
    expect(kinds(double)).toEqual(["select"]);
    expect(render(double.log[0].where).sql).toContain("false");
  });

  describe("sibling found inside the transaction, under the lock (CS-8)", () => {
    const SIBLING = { kind: "select", rows: [{ grupoId: 5 }] } as const;

    it("refuses with nothing changed: no sibling update, no reactivation, no audit row", async () => {
      const double = use([STUDENT, TARGET, INACTIVE_ROW, SIBLING]);

      expect(await staffEnrollInGroup(STAFF, S, G)).toEqual({
        ok: false,
        reason: "not_eligible",
      });
      expect(kinds(double)).toEqual(["select", "select", "select", "select"]);
      expect(double.exhausted).toBe(true);
      expect(double.log.map((entry) => entry.table)).not.toContain(
        eventoAuditoria,
      );
      // The sibling was only READ under the lock taken first.
      expect(double.log[0].lock?.strength).toBe("no key update");
      expect(double.transactions).toBe(1);
    });

    it("reads the sibling with the writer's own predicate: the student's sibling update renders the same where", async () => {
      const staff = use([STUDENT, TARGET, INACTIVE_ROW, SIBLING]);
      await staffEnrollInGroup(STAFF, S, G);
      const student = use([
        STUDENT,
        TARGET,
        INACTIVE_ROW,
        { kind: "update", rows: [] },
        REACTIVATE,
        AUDIT,
      ]);
      await enrollInGroup(S, G);

      const sibling = render(staff.log[3].where);
      expect(sibling).toEqual(render(student.log[3].where));
      expect(sibling.params).toEqual(
        expect.arrayContaining([S, true, G, 3, "2026-S2"]),
      );
      expect(sibling.sql).toContain('"Inscripcion"."Activo"');
    });

    it("never replaces: a student with several siblings is refused just the same", async () => {
      const double = use([
        STUDENT,
        TARGET,
        INACTIVE_ROW,
        { kind: "select", rows: [{ grupoId: 5 }, { grupoId: 6 }] },
      ]);

      expect(await staffEnrollInGroup(STAFF, S, G)).toEqual({
        ok: false,
        reason: "not_eligible",
      });
      expect(kinds(double)).not.toContain("update");
    });
  });
});

describe("not sticky and serialized (EA-WRITE-1 Race, Not sticky)", () => {
  it("a staff deactivation is undone by the student's own enrollInGroup: one reactivada, by the student, on the same row", async () => {
    use([STUDENT, { kind: "update", rows: [{ grupoId: G }] }, AUDIT]);
    expect(await staffDropGroup(STAFF, S, G)).toEqual({ ok: true, grupoId: G });

    const student = use([
      STUDENT,
      TARGET,
      INACTIVE_ROW,
      { kind: "update", rows: [] },
      REACTIVATE,
      AUDIT,
    ]);
    expect(await enrollInGroup(S, G)).toEqual(REACTIVATED);

    const rows = student.log.at(-1)?.values as Record<string, unknown>[];
    expect(rows).toEqual([
      expect.objectContaining({
        actorId: S,
        accion: "inscripcion.reactivada",
        entidadId: S,
        datos: { grupoId: G },
      }),
    ]);
    const where = render(student.log[4].where);
    expect(where.params).toEqual(expect.arrayContaining([S, G, false]));
    expect(where.params).not.toContain(ACTOR);
  });

  it.each([
    {
      label: "staffDropGroup",
      run: () => staffDropGroup(STAFF, S, G),
      script: [STUDENT, { kind: "update", rows: [{ grupoId: G }] }, AUDIT],
    },
    {
      label: "staffEnrollInGroup",
      run: () => staffEnrollInGroup(STAFF, S, G),
      script: [STUDENT, TARGET, INACTIVE_ROW, NO_SIBLING, REACTIVATE, AUDIT],
    },
  ] as const)(
    "$label takes the one lock first and writes the audit row last",
    async ({ run, script }) => {
      const double = use([...script]);

      await run();

      expect(double.log.filter((entry) => entry.lock)).toHaveLength(1);
      expect(double.log[0].lock?.strength).toBe("no key update");
      const last = double.log.at(-1);
      expect(last?.kind).toBe("insert");
      expect(last?.table).toBe(eventoAuditoria);
      expect(
        double.log.slice(0, -1).filter((e) => e.table === eventoAuditoria),
      ).toHaveLength(0);
      expect(double.log.every((entry) => entry.inTransaction)).toBe(true);
    },
  );

  it("logs the STAFF actor when the reactivation audit insert fails and rolls everything back", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("secret value 123");
    const double = use([
      STUDENT,
      TARGET,
      INACTIVE_ROW,
      NO_SIBLING,
      REACTIVATE,
      { kind: "insert", error: failure },
    ]);

    await expect(staffEnrollInGroup(STAFF, S, G)).rejects.toBe(failure);

    expect(double.exhausted).toBe(true);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(logger.mock.calls[0][0]))).toEqual({
      event: "enrollment.write.failed",
      actor: ACTOR,
      errorName: "Error",
    });
  });
});
