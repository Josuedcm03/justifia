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
// The only way to create or replace (the assign flow of EA-SIB-1); a call
// without it is the list's reactivate-only mode. The opt-in carries the group
// the user saw and confirmed as replaced (or null when the page showed none).
const FULL = { allowReplaceAndCreate: true, expectedReplaced: null } as const;
const REPLACING = (expectedReplaced: number | null) =>
  ({ allowReplaceAndCreate: true, expectedReplaced }) as const;
/** The read of the active siblings under the lock, before the update. */
const SIB_READ = (grupoIds: number[]) => ({
  kind: "select" as const,
  rows: grupoIds.map((grupoId) => ({ grupoId })),
});
const SIBLINGS_UPDATE = (grupoIds: number[]) => ({
  kind: "update" as const,
  rows: grupoIds.map((grupoId) => ({ grupoId })),
});
const NO_ROW = { kind: "select", rows: [] } as const;
const NO_SIBLING_UPDATE = { kind: "update", rows: [] } as const;
const INSERT = { kind: "insert" } as const;

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

describe("staffEnrollInGroup by default, reactivate only (EA-REACT-1, CS-3, CS-8)", () => {
  const SUCCESS = [
    STUDENT,
    TARGET,
    INACTIVE_ROW,
    NO_SIBLING,
    REACTIVATE,
    AUDIT,
  ];

  it.each([
    {
      label: "no row (would be a create)",
      script: [STUDENT, TARGET, NO_ROW],
    },
    {
      label: "an inactive row and an active sibling (would be a replace)",
      script: [
        STUDENT,
        TARGET,
        INACTIVE_ROW,
        { kind: "select", rows: [{ grupoId: 5 }] },
      ],
    },
  ] as const)(
    "fails closed: a call with no options never inserts and never updates a sibling, given $label",
    async ({ script }) => {
      const double = use([...script]);

      expect(await staffEnrollInGroup(STAFF, S, G)).toEqual({
        ok: false,
        reason: "not_eligible",
      });
      expect(double.exhausted).toBe(true);
      expect(kinds(double)).not.toContain("insert");
      expect(kinds(double)).not.toContain("update");
    },
  );

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
      label: "no inscripcion row at all (the list never creates)",
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

describe("staffEnrollInGroup create (EA-CRE-1, CS-3)", () => {
  const CREATE = [
    STUDENT,
    TARGET,
    NO_ROW,
    SIB_READ([]),
    NO_SIBLING_UPDATE,
    INSERT,
    AUDIT,
  ];
  const REACTIVATE_ROW = [
    STUDENT,
    TARGET,
    INACTIVE_ROW,
    SIB_READ([]),
    NO_SIBLING_UPDATE,
    REACTIVATE,
    AUDIT,
  ];

  function lastRows(double: ReturnType<typeof use>) {
    return double.log.at(-1)?.values as Record<string, unknown>[];
  }

  it("creates the row active for the student and writes one creada with the STAFF actor", async () => {
    const double = use(CREATE);

    expect(await staffEnrollInGroup(STAFF, S, G, FULL)).toEqual({
      ok: true,
      kind: "created",
      grupoId: G,
      replaced: [],
    });

    expect(kinds(double)).toEqual([
      "select",
      "select",
      "select",
      "select",
      "update",
      "insert",
      "insert",
    ]);
    expect(double.exhausted).toBe(true);
    // Role integrity: the row binds the student, never the staff user.
    expect(double.log[5].table).toBe(inscripcion);
    expect(double.log[5].values).toEqual({
      estudianteId: S,
      grupoId: G,
      activo: true,
    });
    expect(lastRows(double)).toEqual([
      expect.objectContaining({
        actorId: ACTOR,
        accion: "inscripcion.creada",
        entidadTipo: "Inscripcion",
        entidadId: S,
        datos: { grupoId: G },
      }),
    ]);
  });

  it("sets an existing inactive row active instead of inserting a second one, with one reactivada", async () => {
    const double = use(REACTIVATE_ROW);

    expect(await staffEnrollInGroup(STAFF, S, G, FULL)).toEqual(REACTIVATED);

    // At most one row per pair: no Inscripcion insert, only the audit insert.
    expect(
      double.log.filter((e) => e.kind === "insert").map((e) => e.table),
    ).toEqual([eventoAuditoria]);
    expect(double.log[5].set).toEqual({ activo: true });
    expect(render(double.log[2].where).params).toEqual(
      expect.arrayContaining([S, G]),
    );
    expect(lastRows(double)).toEqual([
      expect.objectContaining({
        actorId: ACTOR,
        accion: "inscripcion.reactivada",
        datos: { grupoId: G },
      }),
    ]);
  });

  it("changes nothing when the row is already active, which is also a change to the current group", async () => {
    const double = use([
      STUDENT,
      TARGET,
      { kind: "select", rows: [{ activo: true }] },
    ]);

    expect(await staffEnrollInGroup(STAFF, S, G, FULL)).toEqual({
      ok: false,
      reason: "already_enrolled",
    });
    expect(kinds(double)).toEqual(["select", "select", "select"]);
    expect(double.exhausted).toBe(true);
  });

  it.each([
    { label: "an older period", fragment: '"Grupo"."Periodo"' },
    { label: "a grupo that is inactive", fragment: '"Grupo"."Activo"' },
    { label: "an inactive asignatura", fragment: '"Asignatura"."Activo"' },
  ])(
    "refuses $label with not_eligible, nothing written and no audit row",
    async ({ fragment }) => {
      const double = use([STUDENT, { kind: "select", rows: [] }]);

      expect(await staffEnrollInGroup(STAFF, S, G, FULL)).toEqual({
        ok: false,
        reason: "not_eligible",
      });
      expect(kinds(double)).toEqual(["select", "select"]);
      expect(render(double.log[1].where).sql).toContain(fragment);
    },
  );

  it.each([
    { label: "a target who is not an active estudiante", staff: STAFF },
    { label: "a secretaria without a facultad", staff: NO_SCOPE },
  ])(
    "refuses $label with not_student after the one lock statement",
    async ({ staff }) => {
      const double = use([{ kind: "select", rows: [] }]);

      expect(await staffEnrollInGroup(staff, S, G, FULL)).toEqual({
        ok: false,
        reason: "not_student",
      });
      expect(kinds(double)).toEqual(["select"]);
      expect(double.exhausted).toBe(true);
    },
  );

  it("issues the student's own create statements plus the one sibling read: only the actor of the audit row differs", async () => {
    const staff = use(CREATE);
    await staffEnrollInGroup(STAFF, S, G, FULL);
    const student = use([
      STUDENT,
      TARGET,
      NO_ROW,
      NO_SIBLING_UPDATE,
      INSERT,
      AUDIT,
    ]);
    await enrollInGroup(S, G);

    // The student path has no optimistic check, so it has no sibling read.
    expect(staff.log.filter((_e, i) => i !== 3).map((e) => e.kind)).toEqual(
      student.log.map((e) => e.kind),
    );
    expect(staff.log[5].values).toEqual(student.log[4].values);
    expect(render(staff.log[4].where)).toEqual(render(student.log[3].where));
    const [staffRow] = lastRows(staff);
    const [studentRow] = lastRows(student);
    expect({ ...staffRow, actorId: S }).toEqual(studentRow);
  });
});

describe("staffEnrollInGroup replace and change group (EA-SIB-1, EA-CHG-1)", () => {
  const SIBLINGS = (grupoIds: number[]) => ({
    kind: "update" as const,
    rows: grupoIds.map((grupoId) => ({ grupoId })),
  });

  function lastRows(double: ReturnType<typeof use>) {
    return double.log.at(-1)?.values as Record<string, unknown>[];
  }

  it("reactivating a group with an active sibling replaces it: the sibling goes inactive, the target active, and the audit is desactivada then reactivada", async () => {
    const double = use([
      STUDENT,
      TARGET,
      INACTIVE_ROW,
      SIB_READ([5]),
      SIBLINGS([5]),
      REACTIVATE,
      AUDIT,
    ]);

    expect(await staffEnrollInGroup(STAFF, S, G, REPLACING(5))).toEqual({
      ok: true,
      kind: "reactivated",
      grupoId: G,
      replaced: [5],
    });

    expect(kinds(double)).toEqual([
      "select",
      "select",
      "select",
      "select",
      "update",
      "update",
      "insert",
    ]);
    expect(double.log[4].set).toEqual({ activo: false });
    expect(double.log[5].set).toEqual({ activo: true });
    expect(lastRows(double)).toEqual([
      expect.objectContaining({
        actorId: ACTOR,
        accion: "inscripcion.desactivada",
        entidadTipo: "Inscripcion",
        entidadId: S,
        datos: { grupoId: 5, motivo: "reemplazo" },
      }),
      expect.objectContaining({
        actorId: ACTOR,
        accion: "inscripcion.reactivada",
        entidadId: S,
        datos: { grupoId: G },
      }),
    ]);
  });

  it("changing to a group the student has no row in replaces the current group and creates the new row: desactivada then creada", async () => {
    const double = use([
      STUDENT,
      TARGET,
      NO_ROW,
      SIB_READ([5]),
      SIBLINGS([5]),
      INSERT,
      AUDIT,
    ]);

    expect(await staffEnrollInGroup(STAFF, S, G, REPLACING(5))).toEqual({
      ok: true,
      kind: "created",
      grupoId: G,
      replaced: [5],
    });

    expect(double.log[5].values).toEqual({
      estudianteId: S,
      grupoId: G,
      activo: true,
    });
    expect(lastRows(double).map((row) => [row.accion, row.datos])).toEqual([
      ["inscripcion.desactivada", { grupoId: 5, motivo: "reemplazo" }],
      ["inscripcion.creada", { grupoId: G }],
    ]);
    expect(lastRows(double).every((row) => row.actorId === ACTOR)).toBe(true);
  });

  it("scopes the sibling update to the target's asignatura and period and to other groups only, so other asignaturas and periods are not in its predicate", async () => {
    const double = use([
      STUDENT,
      TARGET,
      INACTIVE_ROW,
      SIB_READ([5]),
      SIBLINGS([5]),
      REACTIVATE,
      AUDIT,
    ]);

    await staffEnrollInGroup(STAFF, S, G, REPLACING(5));

    const sibling = double.log[4];
    expect(sibling.table).toBe(inscripcion);
    expect(sibling.calls).toContain("returning");
    const query = render(sibling.where);
    for (const part of [
      '"Inscripcion"."EstudianteId"',
      '"Inscripcion"."Activo"',
      '"Inscripcion"."GrupoId" <>',
      '"Grupo"."AsignaturaId"',
      '"Grupo"."Periodo"',
    ]) {
      expect(query.sql).toContain(part);
    }
    // Exactly the student, the target group, its asignatura and its period.
    expect([...query.params].sort()).toEqual([G, S, 3, "2026-S2", true].sort());
    const student = use([
      STUDENT,
      TARGET,
      INACTIVE_ROW,
      SIBLINGS([5]),
      REACTIVATE,
      AUDIT,
    ]);
    await enrollInGroup(S, G);
    expect(query).toEqual(render(student.log[3].where));
  });

  it("a target of another asignatura replaces nothing of the first: the predicate follows the target's own asignatura", async () => {
    const other = {
      kind: "select",
      rows: [{ id: G, asignaturaId: 8, periodo: "2026-S2" }],
    } as const;
    const double = use([
      STUDENT,
      other,
      NO_ROW,
      SIB_READ([]),
      SIBLINGS([]),
      INSERT,
      AUDIT,
    ]);

    expect(await staffEnrollInGroup(STAFF, S, G, FULL)).toMatchObject({
      ok: true,
      kind: "created",
      replaced: [],
    });

    const params = render(double.log[3].where).params;
    expect(params).toContain(8);
    expect(params).not.toContain(3);
    expect(lastRows(double)).toHaveLength(1);
  });

  it("writes both audit rows in one insert on the same transaction as the data statements, last", async () => {
    const double = use([
      STUDENT,
      TARGET,
      INACTIVE_ROW,
      SIB_READ([5]),
      SIBLINGS([5]),
      REACTIVATE,
      AUDIT,
    ]);

    await staffEnrollInGroup(STAFF, S, G, REPLACING(5));

    expect(double.transactions).toBe(1);
    expect(double.log.every((entry) => entry.inTransaction)).toBe(true);
    expect(double.log.filter((e) => e.table === eventoAuditoria)).toHaveLength(
      1,
    );
    expect(double.log.at(-1)?.table).toBe(eventoAuditoria);
    expect(double.log[0].lock?.strength).toBe("no key update");
  });

  it.each([
    { label: "the sibling read", failing: 3, reached: false },
    { label: "the sibling update", failing: 4, reached: false },
    { label: "the activation", failing: 5, reached: false },
    { label: "the audit insert carrying both rows", failing: 6, reached: true },
  ])(
    "rethrows when $label fails: one sanitized line with the STAFF actor and the replace is not reported",
    async ({ failing, reached }) => {
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      const failure = Object.assign(new Error("secret value 123"), {
        cause: { code: "40001" },
      });
      const steps = [
        STUDENT,
        TARGET,
        INACTIVE_ROW,
        SIB_READ([5]),
        SIBLINGS([5]),
        REACTIVATE,
        AUDIT,
      ].map((step, index) =>
        index === failing ? { ...step, error: failure } : step,
      );
      const double = use(steps);

      await expect(staffEnrollInGroup(STAFF, S, G, REPLACING(5))).rejects.toBe(
        failure,
      );

      expect(double.exhausted).toBe(reached);
      expect(logger).toHaveBeenCalledTimes(1);
      const line = String(logger.mock.calls[0][0]);
      expect(JSON.parse(line)).toEqual({
        event: "enrollment.write.failed",
        actor: ACTOR,
        errorName: "Error",
        errorCode: "40001",
      });
      expect(line).not.toContain("secret");
    },
  );

  it.each([
    { label: "an older period", fragment: '"Grupo"."Periodo"' },
    { label: "an inactive grupo", fragment: '"Grupo"."Activo"' },
    { label: "an inactive asignatura", fragment: '"Asignatura"."Activo"' },
  ])(
    "refuses a target in $label before any sibling is touched",
    async ({ fragment }) => {
      const double = use([STUDENT, { kind: "select", rows: [] }]);

      expect(await staffEnrollInGroup(STAFF, S, G, FULL)).toEqual({
        ok: false,
        reason: "not_eligible",
      });
      expect(kinds(double)).toEqual(["select", "select"]);
      expect(render(double.log[1].where).sql).toContain(fragment);
    },
  );

  it("refuses the student's current group with already_enrolled and leaves every sibling alone", async () => {
    const double = use([
      STUDENT,
      TARGET,
      { kind: "select", rows: [{ activo: true }] },
    ]);

    expect(await staffEnrollInGroup(STAFF, S, G, FULL)).toEqual({
      ok: false,
      reason: "already_enrolled",
    });
    expect(kinds(double)).not.toContain("update");
  });

  it("refuses a student out of scope with not_student and writes nothing", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await staffEnrollInGroup(STAFF, 999_999, G, FULL)).toEqual({
      ok: false,
      reason: "not_student",
    });
    expect(kinds(double)).toEqual(["select"]);
  });
});

describe("staffEnrollInGroup refuses a stale replace (EA-SIB-1, EA-CHG-1: the optimistic check)", () => {
  const STALE = { ok: false, reason: "stale" } as const;
  const rows = [
    ["no row (create)", NO_ROW],
    ["an inactive row (reactivate)", INACTIVE_ROW],
  ] as const;
  const cases = [
    { label: "expected none but a sibling exists", expected: null, found: [5] },
    { label: "expected a sibling but none exists", expected: 5, found: [] },
    {
      label: "expected one sibling but another exists",
      expected: 5,
      found: [6],
    },
    {
      label: "expected one sibling but it has company",
      expected: 5,
      found: [5, 6],
    },
    {
      label: "expected one sibling but there are two others",
      expected: 5,
      found: [6, 7],
    },
  ] as const;

  it.each(
    cases.flatMap((c) =>
      rows.map(([rowLabel, row]) => ({ ...c, rowLabel, row })),
    ),
  )(
    "$label, over $rowLabel: refuses with stale, nothing after the read and no audit row",
    async ({ expected, found, row }) => {
      // The script ends at the sibling read: any further statement (the
      // sibling update, the activation or the audit insert) would find it
      // exhausted and throw.
      const double = use([STUDENT, TARGET, row, SIB_READ([...found])]);

      expect(
        await staffEnrollInGroup(STAFF, S, G, REPLACING(expected)),
      ).toEqual(STALE);

      expect(kinds(double)).toEqual(["select", "select", "select", "select"]);
      expect(double.exhausted).toBe(true);
      expect(double.log.some((e) => e.table === eventoAuditoria)).toBe(false);
      expect(double.log.map((e) => e.kind)).not.toContain("update");
      expect(double.log.map((e) => e.kind)).not.toContain("insert");
    },
  );

  it.each([
    { expected: 5, found: [5], row: INACTIVE_ROW, kind: "reactivated" },
    { expected: 12, found: [12], row: NO_ROW, kind: "created" },
  ] as const)(
    "replaces exactly the group the user saw ($expected) over a $kind target",
    async ({ expected, found, row, kind }) => {
      const double = use([
        STUDENT,
        TARGET,
        row,
        SIB_READ([...found]),
        SIBLINGS_UPDATE([...found]),
        row === NO_ROW ? INSERT : REACTIVATE,
        AUDIT,
      ]);

      expect(
        await staffEnrollInGroup(STAFF, S, G, REPLACING(expected)),
      ).toEqual({ ok: true, kind, grupoId: G, replaced: [expected] });
      expect(double.exhausted).toBe(true);
    },
  );

  it("reads the siblings with the very predicate the update uses, under the one lock and in the one transaction", async () => {
    const double = use([
      STUDENT,
      TARGET,
      INACTIVE_ROW,
      SIB_READ([5]),
      SIBLINGS_UPDATE([5]),
      REACTIVATE,
      AUDIT,
    ]);

    await staffEnrollInGroup(STAFF, S, G, REPLACING(5));

    expect(render(double.log[3].where)).toEqual(render(double.log[4].where));
    expect(double.log.every((entry) => entry.inTransaction)).toBe(true);
    expect(double.log.filter((entry) => entry.lock)).toHaveLength(1);
  });

  it("a caller that bypasses the type and omits expectedReplaced fails closed to reactivate only", async () => {
    const double = use([STUDENT, TARGET, NO_ROW]);

    // @ts-expect-error expectedReplaced is required with the opt-in
    const result = await staffEnrollInGroup(STAFF, S, G, {
      allowReplaceAndCreate: true,
    });

    expect(result).toEqual({ ok: false, reason: "not_eligible" });
    expect(double.log.map((e) => e.kind)).not.toContain("insert");
    expect(double.log.map((e) => e.kind)).not.toContain("update");
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
      run: () => staffEnrollInGroup(STAFF, S, G, FULL),
      script: [
        STUDENT,
        TARGET,
        INACTIVE_ROW,
        SIB_READ([]),
        NO_SIBLING_UPDATE,
        REACTIVATE,
        AUDIT,
      ],
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
      SIB_READ([]),
      NO_SIBLING_UPDATE,
      REACTIVATE,
      { kind: "insert", error: failure },
    ]);

    await expect(staffEnrollInGroup(STAFF, S, G, FULL)).rejects.toBe(failure);

    expect(double.exhausted).toBe(true);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(logger.mock.calls[0][0]))).toEqual({
      event: "enrollment.write.failed",
      actor: ACTOR,
      errorName: "Error",
    });
  });
});
