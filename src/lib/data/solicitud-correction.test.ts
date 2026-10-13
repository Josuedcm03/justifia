// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupScheduleProvider } from "@/lib/intake/ports";
import { TRANSITIONS } from "@/lib/intake/transitions";

import {
  createDbDouble,
  type LoggedStatement,
  type Step,
} from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, insertAuditMock, listEligibleGroupsMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  insertAuditMock: vi.fn(),
  listEligibleGroupsMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: insertAuditMock }));
vi.mock("@/lib/data/enrollment", () => ({
  listEligibleGroups: listEligibleGroupsMock,
}));

import { resubmitCorrection } from "./solicitud-correction";

const USER = 7;
const REQUEST = 31;
// 2026-10-07 in Managua; the end date below is 40 days old (RN-23 would refuse).
const NOW = new Date("2026-10-07T15:00:00.000Z");
const START = "2026-08-20";
const END = "2026-08-28";
const schedule: GroupScheduleProvider = {
  groupsWithClass: async () => new Set<number>(),
};

const requestRow = {
  id: REQUEST,
  causa: "medica",
  fechaInicio: START,
  fechaFin: END,
  actualizadoEn: new Date("2026-10-06T10:00:00.000Z"),
};
const document = (id: number, estado = "valido") => ({
  id,
  nombreOriginal: `doc-${id}.pdf`,
  tipoDetectado: "pdf",
  tamanoBytes: 2048,
  estado,
});
const GROUP = { grupoId: 21, asignaturaId: 10 };

const loaded = (
  overrides: {
    row?: Record<string, unknown>;
    subjects?: unknown[];
    documents?: unknown[];
  } = {},
): Step[] => [
  { kind: "select", rows: [{ ...requestRow, ...overrides.row }] },
  { kind: "select", rows: overrides.subjects ?? [GROUP] },
  { kind: "select", rows: overrides.documents ?? [document(11)] },
];
const transaction = (
  overrides: { stored?: unknown[]; valid?: number; revision?: unknown[] } = {},
): Step[] => [
  { kind: "update", rows: [{ id: REQUEST }] },
  { kind: "select", rows: overrides.stored ?? [{ grupoId: 21 }] },
  { kind: "select", rows: [{ n: overrides.valid ?? 1 }] },
  {
    kind: "select",
    rows: overrides.revision ?? [{ numero: 2, documentoIds: [11, 12] }],
  },
  { kind: "select", rows: [{ n: 1 }] },
];

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

const input = { userId: USER, solicitudId: REQUEST, now: NOW, schedule };
const params = (statement: LoggedStatement) =>
  new PgDialect().sqlToQuery(
    statement.where as Parameters<PgDialect["sqlToQuery"]>[0],
  ).params;

beforeEach(() => {
  insertAuditMock.mockReset().mockResolvedValue(undefined);
  listEligibleGroupsMock.mockReset().mockResolvedValue([GROUP]);
});

describe("resubmitCorrection: success (RF-08 a, RF-08 c, RN-16)", () => {
  it("moves the same request to pendiente at the server time, in one transaction, restarting the RN-08 clock", async () => {
    const double = use([...loaded(), ...transaction()]);

    expect(await resubmitCorrection(input)).toEqual({ ok: true });

    expect(double.transactions).toBe(1);
    const update = double.log.find((s) => s.kind === "update")!;
    expect(update.inTransaction).toBe(true);
    expect(update.set).toEqual({
      estado: "pendiente",
      reenviadaEn: NOW,
      actualizadoEn: NOW,
    });
  });

  it("guards the update by id, owner, devuelta and the validated values, never a borrador", async () => {
    const double = use([...loaded(), ...transaction()]);

    await resubmitCorrection(input);

    const update = double.log.find((s) => s.kind === "update")!;
    expect(params(update)).toEqual([
      REQUEST,
      USER,
      "devuelta",
      "medica",
      START,
      END,
    ]);
    expect(double.log.flatMap((s) => (s.where ? params(s) : []))).not.toContain(
      "borrador",
    );
  });

  it("writes exactly one solicitud.corregida with counts only, and no new snapshot or request row", async () => {
    const double = use([...loaded(), ...transaction()]);

    await resubmitCorrection(input);

    expect(insertAuditMock).toHaveBeenCalledTimes(1);
    const [tx, actor, events] = insertAuditMock.mock.calls[0];
    expect(tx).toBe(double.tx);
    expect(actor).toBe(USER);
    expect(events).toEqual([
      {
        accion: "solicitud.corregida",
        entidadTipo: "Solicitud",
        entidadId: REQUEST,
        datos: {
          revision: 2,
          asignaturas: 1,
          documentos: 1,
          documentosRetirados: 1,
        },
      },
    ]);
    expect(double.log.filter((s) => s.kind === "insert")).toHaveLength(0);
  });

  it("leaves the student snapshot columns alone (RN-02)", async () => {
    const double = use([...loaded(), ...transaction()]);

    await resubmitCorrection(input);

    const update = double.log.find((s) => s.kind === "update")!;
    expect(Object.keys(update.set as object).sort()).toEqual([
      "actualizadoEn",
      "estado",
      "reenviadaEn",
    ]);
  });

  it("takes the identity from the caller only: the guard holds the session user", async () => {
    const double = use([...loaded(), ...transaction()]);

    await resubmitCorrection({ ...input, userId: 99 });

    const first = double.log[0];
    expect(params(first)).toContain(99);
    expect(params(first)).not.toContain(USER);
  });
});

describe("resubmitCorrection: validation (RF-03, RN-05, RN-23 not re-applied)", () => {
  it("accepts an end date 40 days old: the filing window is not re-applied", async () => {
    use([...loaded(), ...transaction()]);

    expect(await resubmitCorrection(input)).toEqual({ ok: true });
  });

  it("checks eligibility through the schedule port for the stored dates", async () => {
    use([...loaded(), ...transaction()]);

    await resubmitCorrection(input);

    expect(listEligibleGroupsMock).toHaveBeenCalledWith(
      USER,
      { from: START, to: END },
      schedule,
    );
  });

  it("RN-05 still applies: end before start is refused and nothing is written", async () => {
    const double = use(loaded({ row: { fechaInicio: END, fechaFin: START } }));

    const result = await resubmitCorrection(input);

    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "fechaFin", code: "end_before_start" }],
    });
    expect(double.transactions).toBe(0);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("refuses a subject the student is not enrolled in", async () => {
    use(loaded());
    listEligibleGroupsMock.mockResolvedValue([]);

    expect(await resubmitCorrection(input)).toEqual({
      ok: false,
      reason: "invalid",
      errors: [
        { field: "subjects", code: "subject_not_eligible", asignaturaId: 10 },
      ],
    });
  });

  it("refuses a correction left without a valid document", async () => {
    use(loaded({ documents: [document(11, "pendiente")] }));

    expect(await resubmitCorrection(input)).toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "documents", code: "documents_required" }],
    });
  });

  it("refuses more than five documents", async () => {
    use(loaded({ documents: [1, 2, 3, 4, 5, 6].map((id) => document(id)) }));

    expect(await resubmitCorrection(input)).toEqual({
      ok: false,
      reason: "invalid",
      errors: [{ field: "documents", code: "too_many_documents" }],
    });
  });

  it("accepts exactly five documents", async () => {
    use([
      ...loaded({ documents: [1, 2, 3, 4, 5].map((id) => document(id)) }),
      ...transaction({ valid: 5 }),
    ]);

    expect(await resubmitCorrection(input)).toEqual({ ok: true });
  });

  it("reports every invalid field together", async () => {
    use(
      loaded({
        row: { causa: null, fechaInicio: END, fechaFin: START },
        subjects: [],
        documents: [],
      }),
    );

    const result = await resubmitCorrection(input);

    expect(result).toMatchObject({ ok: false, reason: "invalid" });
    const codes = (result as { errors: { code: string }[] }).errors.map(
      (e) => e.code,
    );
    expect(codes).toEqual([
      "causa_required",
      "end_before_start",
      "subjects_required",
      "documents_required",
    ]);
  });
});

describe("resubmitCorrection: who and when (RN-16)", () => {
  it("is not_found for a request that is not the caller's returned one, with nothing else read or written", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await resubmitCorrection(input)).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(listEligibleGroupsMock).not.toHaveBeenCalled();
    expect(double.log).toHaveLength(1);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("the loser of a concurrent resubmit changes nothing and adds no audit row", async () => {
    const double = use([...loaded(), { kind: "update", rows: [] }]);

    expect(await resubmitCorrection(input)).toEqual({
      ok: false,
      reason: "conflict",
    });
    expect(insertAuditMock).not.toHaveBeenCalled();
    expect(double.exhausted).toBe(true);
  });
});

describe("resubmitCorrection: drift after validation rolls everything back", () => {
  it("conflict when the stored groups changed", async () => {
    use([...loaded(), ...transaction({ stored: [{ grupoId: 99 }] })]);

    expect(await resubmitCorrection(input)).toEqual({
      ok: false,
      reason: "conflict",
    });
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("conflict when no valid document remains", async () => {
    use([...loaded(), ...transaction({ valid: 0 })]);

    expect(await resubmitCorrection(input)).toEqual({
      ok: false,
      reason: "conflict",
    });
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("conflict when a concurrent upload pushed the documents past five", async () => {
    use([...loaded(), ...transaction({ valid: 6 })]);

    expect(await resubmitCorrection(input)).toEqual({
      ok: false,
      reason: "conflict",
    });
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("fails loud, writing no audit row, when a read after the state change fails", async () => {
    use([
      ...loaded(),
      { kind: "update", rows: [{ id: REQUEST }] },
      { kind: "select", rows: [{ grupoId: 21 }] },
      { kind: "select", error: new Error("db down") },
    ]);

    await expect(resubmitCorrection(input)).rejects.toThrow("db down");
    expect(insertAuditMock).not.toHaveBeenCalled();
  });

  it("fails loud when the audit insert fails, so the state change rolls back", async () => {
    use([...loaded(), ...transaction()]);
    insertAuditMock.mockRejectedValue(new Error("audit down"));

    await expect(resubmitCorrection(input)).rejects.toThrow("audit down");
  });

  it("fails loud for a returned request that has no revision snapshot", async () => {
    use([...loaded(), ...transaction({ revision: [] })]);

    await expect(resubmitCorrection(input)).rejects.toThrow(/revision/i);
    expect(insertAuditMock).not.toHaveBeenCalled();
  });
});

describe("resubmitCorrection: SQL guard and RN-16 table agree (SR-4)", () => {
  it("guards on the one state a student resubmits from, as the table says", async () => {
    const [edge, ...others] = TRANSITIONS.filter(
      (t) =>
        t.actor === "estudiante" &&
        t.to === "pendiente" &&
        t.from !== "borrador",
    );
    const double = use([...loaded(), ...transaction()]);

    await resubmitCorrection(input);

    expect(others).toHaveLength(0);
    expect(edge).toMatchObject({ from: "devuelta", to: "pendiente" });
    const update = double.log.find((s) => s.kind === "update")!;
    expect(params(update)).toContain(edge.from);
    expect((update.set as { estado: string }).estado).toBe(edge.to);
  });
});
