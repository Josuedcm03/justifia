// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestScope } from "@/lib/intake/request-scope";
import { ESTADOS_SOLICITUD } from "@/lib/intake/states";

import {
  createDbDouble,
  type LoggedStatement,
  type Step,
} from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, insertAuditMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  insertAuditMock: vi.fn(),
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

import {
  coordinationAccountsOf,
  countCoordinationAccounts,
  escalateRequest,
  recordExcessReport,
} from "@/lib/data/solicitud-escalation";

const ACTOR = 20;
const ID = 42;
const STUDENT = 8;
const CAREER = 4;
const SCOPE: RequestScope = { kind: "facultad", facultadId: 3 };
const NOW = new Date("2026-10-14T15:00:00.000Z");
const NOTE = "La firma del medico no coincide con el sello.";

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function render(fragment: unknown) {
  return new PgDialect().sqlToQuery(
    fragment as Parameters<PgDialect["sqlToQuery"]>[0],
  );
}

const ofKind = (log: LoggedStatement[], kind: LoggedStatement["kind"]) =>
  log.filter((s) => s.kind === kind);

const careerRow = { carreraId: CAREER, carreraNombre: "Ingenieria Civil" };

describe("countCoordinationAccounts (ES-3, E17)", () => {
  it("returns the live career name and its active coordination accounts", async () => {
    const double = use([
      { kind: "select", rows: [careerRow] },
      { kind: "select", rows: [{ n: 2 }] },
    ]);

    const result = await countCoordinationAccounts(double.db as never, ID);

    expect(result).toEqual({ carreraNombre: "Ingenieria Civil", cuentas: 2 });
    expect(double.log).toHaveLength(2);
  });

  it("reads the same count on the shared handle for the staff detail page", async () => {
    const double = use([
      { kind: "select", rows: [careerRow] },
      { kind: "select", rows: [{ n: 0 }] },
    ]);

    // The detail page proves the request is in scope first, then asks this.
    expect(await coordinationAccountsOf(ID)).toEqual({
      carreraNombre: "Ingenieria Civil",
      cuentas: 0,
    });
    expect(double.log).toHaveLength(2);
    expect(double.log.every((s) => !s.inTransaction)).toBe(true);
  });

  it("reads the career of the request's student, then counts that career only", async () => {
    const double = use([
      { kind: "select", rows: [careerRow] },
      { kind: "select", rows: [{ n: 1 }] },
    ]);

    await countCoordinationAccounts(double.db as never, ID);

    expect(render(double.log[0].where).params).toEqual([ID]);
    const count = render(double.log[1].where);
    expect(count.params).toEqual([CAREER, true, "coordinacion"]);
    expect(count.sql).toContain('"CarreraId" = $1');
    expect(count.sql).toContain('"Activo" = $2');
  });

  it("ignores the email: an account without one still counts", async () => {
    const double = use([
      { kind: "select", rows: [careerRow] },
      { kind: "select", rows: [{ n: 1 }] },
    ]);

    await countCoordinationAccounts(double.db as never, ID);

    expect(render(double.log[1].where).sql).not.toMatch(/Correo/i);
  });

  it("reports zero accounts for a career with none", async () => {
    const double = use([
      { kind: "select", rows: [careerRow] },
      { kind: "select", rows: [{ n: 0 }] },
    ]);

    expect(await countCoordinationAccounts(double.db as never, ID)).toEqual({
      carreraNombre: "Ingenieria Civil",
      cuentas: 0,
    });
  });

  it("is null, with no count, for a request whose student has no career", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await countCoordinationAccounts(double.db as never, ID)).toBeNull();
    expect(double.log).toHaveLength(1);
  });
});

describe("escalateRequest (RF-10 a, ES-6, E17)", () => {
  const input = (overrides: Record<string, unknown> = {}) => ({
    actorId: ACTOR,
    scope: SCOPE,
    solicitudId: ID,
    motivo: "sospecha_documento",
    nota: NOTE,
    now: NOW,
    ...overrides,
  });

  const success = (cuentas = 1, escalamientoId = 9): Step[] => [
    { kind: "update", rows: [{ id: ID, estudianteId: STUDENT }] },
    { kind: "select", rows: [careerRow] },
    { kind: "select", rows: [{ n: cuentas }] },
    { kind: "insert", rows: [{ id: escalamientoId }] },
  ];

  beforeEach(() => {
    holder.current = null;
    insertAuditMock.mockReset().mockResolvedValue(undefined);
  });

  describe("success", () => {
    it("moves the request, inserts the open escalation and writes one audit row, in one transaction", async () => {
      const double = use(success());

      const result = await escalateRequest(input());

      expect(result).toEqual({ ok: true, escalamientoId: 9 });
      expect(double.transactions).toBe(1);
      expect(double.log.map((s) => s.kind)).toEqual([
        "update",
        "select",
        "select",
        "insert",
      ]);
      expect(double.log.every((s) => s.inTransaction)).toBe(true);
      expect(double.log[0].set).toEqual({
        estado: "en_revision_coordinacion",
        actualizadoEn: NOW,
      });
      expect(double.log[3].values).toEqual({
        solicitudId: ID,
        tipo: "sospecha_documento",
        estadoPrevio: "pendiente",
        nota: NOTE,
        secretariaId: ACTOR,
        creadoEn: NOW,
        notificacionEstado: "pendiente",
      });
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      expect(insertAuditMock.mock.calls[0][1]).toBe(ACTOR);
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "solicitud.escalada",
          entidadTipo: "Solicitud",
          entidadId: ID,
          datos: {
            escalamientoId: 9,
            motivo: "sospecha_documento",
            estadoPrevio: "pendiente",
            estadoNuevo: "en_revision_coordinacion",
          },
        },
      ]);
    });

    it("escalates a special case exactly like a suspicion, with its own motive (E18)", async () => {
      const double = use(success());

      const result = await escalateRequest(input({ motivo: "caso_especial" }));

      expect(result).toEqual({ ok: true, escalamientoId: 9 });
      expect(double.log.map((s) => s.kind)).toEqual([
        "update",
        "select",
        "select",
        "insert",
      ]);
      expect(double.log[0].set).toEqual({
        estado: "en_revision_coordinacion",
        actualizadoEn: NOW,
      });
      expect(double.log[3].values).toMatchObject({
        tipo: "caso_especial",
        estadoPrevio: "pendiente",
        nota: NOTE,
        notificacionEstado: "pendiente",
      });
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "solicitud.escalada",
          entidadTipo: "Solicitud",
          entidadId: ID,
          datos: {
            escalamientoId: 9,
            motivo: "caso_especial",
            estadoPrevio: "pendiente",
            estadoNuevo: "en_revision_coordinacion",
          },
        },
      ]);
    });

    it("stores the trimmed note and takes the author from the call only", async () => {
      const double = use(success());

      await escalateRequest(input({ actorId: 77, nota: `  ${NOTE}  ` }));

      expect(double.log[3].values).toMatchObject({
        nota: NOTE,
        secretariaId: 77,
      });
      expect(insertAuditMock.mock.calls[0][1]).toBe(77);
    });

    it("succeeds when the career has accounts but none has an email", async () => {
      // The count ignores the email, so one account without it is one account.
      use(success(1));

      expect(await escalateRequest(input())).toEqual({
        ok: true,
        escalamientoId: 9,
      });
    });
  });

  describe("guarded update", () => {
    it("starts from the state the transition table gives, inside the caller's scope", async () => {
      const double = use(success());

      await escalateRequest(input());

      const query = render(double.log[0].where);
      expect(query.params).toEqual([ID, "pendiente", 3]);
      expect(query.sql).toContain('"Solicitud"."Estado" = $2');
      expect(query.sql).toContain('"c"."FacultadId" = $');
    });

    it("does not look at the consent: a v1 or missing consent never blocks", async () => {
      const double = use(success());

      await escalateRequest(input());

      expect(render(double.log[0].where).sql).not.toMatch(/Consentimiento/i);
    });

    it.each(ESTADOS_SOLICITUD.filter((e) => e !== "pendiente"))(
      "never matches a request in %s",
      async (estado) => {
        const double = use([
          { kind: "update", rows: [] },
          { kind: "select", rows: estado === "borrador" ? [] : [{ id: ID }] },
        ]);

        const result = await escalateRequest(input());

        expect(render(double.log[0].where).params).not.toContain(estado);
        expect(result).toEqual({
          ok: false,
          reason: estado === "borrador" ? "not_found" : "conflict",
        });
        expect(ofKind(double.log, "insert")).toHaveLength(0);
        expect(insertAuditMock).not.toHaveBeenCalled();
      },
    );

    it("looks for the request in scope, never a draft, after a missed update", async () => {
      const double = use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [] },
      ]);

      await escalateRequest(input());

      const query = render(double.log[1].where);
      expect(query.sql).toContain('"c"."FacultadId" = $');
      expect(query.sql).toContain('"Solicitud"."Estado" in (');
      expect(query.params).not.toContain("borrador");
    });
  });

  describe("outcomes", () => {
    it("is not_found, with no writes, for an unknown id and for an out-of-scope request alike", async () => {
      const unknown = use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [] },
      ]);
      const first = await escalateRequest(input({ solicitudId: 999 }));
      const outOfScope = use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [] },
      ]);
      const second = await escalateRequest(input({ scope: { kind: "none" } }));

      expect(first).toEqual({ ok: false, reason: "not_found" });
      expect(second).toEqual(first);
      expect(ofKind(unknown.log, "insert")).toHaveLength(0);
      expect(ofKind(outOfScope.log, "insert")).toHaveLength(0);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("gives the concurrent loser conflict: the winner's update already moved the state", async () => {
      use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [{ id: ID }] },
      ]);

      expect(await escalateRequest(input())).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("refuses a career without coordination accounts, naming it, and writes nothing", async () => {
      const double = use([
        { kind: "update", rows: [{ id: ID, estudianteId: STUDENT }] },
        { kind: "select", rows: [careerRow] },
        { kind: "select", rows: [{ n: 0 }] },
      ]);

      const result = await escalateRequest(input());

      expect(result).toEqual({
        ok: false,
        reason: "sin_coordinacion",
        carreraNombre: "Ingenieria Civil",
      });
      expect(double.transactions).toBe(1);
      expect(ofKind(double.log, "insert")).toHaveLength(0);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("maps the unique violation of a second open escalation to conflict", async () => {
      use([
        ...success().slice(0, 3),
        {
          kind: "insert",
          error: Object.assign(new Error("duplicate"), { code: "23505" }),
        },
      ]);

      expect(await escalateRequest(input())).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("finds the unique violation on the error cause as well", async () => {
      use([
        ...success().slice(0, 3),
        {
          kind: "insert",
          error: new Error("query failed", { cause: { code: "23505" } }),
        },
      ]);

      expect(await escalateRequest(input())).toEqual({
        ok: false,
        reason: "conflict",
      });
    });
  });

  describe("validation", () => {
    it.each([
      ["empty", ""],
      ["whitespace only", "   "],
      ["1001 characters", "a".repeat(1001)],
    ])(
      "refuses a note that is %s before touching the database",
      async (_l, nota) => {
        const double = use([]);

        const result = await escalateRequest(input({ nota }));

        expect(result).toMatchObject({ ok: false, reason: "invalid" });
        expect(double.transactions).toBe(0);
        expect(double.log).toHaveLength(0);
      },
    );

    it.each([["exceso_inasistencias"], ["otro"], [""], [undefined], [null]])(
      "refuses the motive %j before touching the database (E18)",
      async (motivo) => {
        const double = use([]);

        const result = await escalateRequest(input({ motivo }));

        expect(result).toEqual({
          ok: false,
          reason: "invalid",
          errors: [{ field: "motivo", code: "motivo_invalid" }],
        });
        expect(double.transactions).toBe(0);
        expect(double.log).toHaveLength(0);
      },
    );

    it("accepts a note of exactly 1000 characters", async () => {
      use(success());

      expect(
        (await escalateRequest(input({ nota: "a".repeat(1000) }))).ok,
      ).toBe(true);
    });
  });

  describe("rollback", () => {
    it("propagates a failed escalation insert after the state update", async () => {
      use([
        ...success().slice(0, 3),
        { kind: "insert", error: new Error("insert failed") },
      ]);

      await expect(escalateRequest(input())).rejects.toThrow("insert failed");
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("propagates a failed audit insert", async () => {
      use(success());
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(escalateRequest(input())).rejects.toThrow("audit down");
    });

    it("propagates a failure of the account count", async () => {
      use([
        { kind: "update", rows: [{ id: ID, estudianteId: STUDENT }] },
        { kind: "select", rows: [careerRow] },
        { kind: "select", error: new Error("count failed") },
      ]);

      await expect(escalateRequest(input())).rejects.toThrow("count failed");
      expect(insertAuditMock).not.toHaveBeenCalled();
    });
  });

  it("has no mail or dispatch dependency: the post-commit notice is another unit", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "data", "solicitud-escalation.ts"),
      "utf8",
    );

    const imports = source.match(/from "[^"]+";/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.join(" ")).not.toMatch(/mail|dispatch|next\/server/i);
    expect(source).not.toMatch(/\bafter\(/);
  });
});

describe("recordExcessReport (RF-15, ES-7)", () => {
  const TEACHER = { docenteId: 5, docenteNombre: "Ana Perez" };
  const input = (overrides: Record<string, unknown> = {}) => ({
    actorId: ACTOR,
    scope: SCOPE,
    solicitudId: ID,
    remisionId: 31,
    comunicadoEl: "2026-10-14",
    nota: "Llamo para avisar.",
    now: NOW,
    ...overrides,
  });

  /** Lock, remission lookup, report insert, escalation insert. */
  const success = (): Step[] => [
    { kind: "select", rows: [{ id: ID }] },
    { kind: "select", rows: [TEACHER] },
    { kind: "insert", rows: [{ id: 3 }] },
    { kind: "insert", rows: [{ id: 8 }] },
  ];

  beforeEach(() => {
    holder.current = null;
    insertAuditMock.mockReset().mockResolvedValue(undefined);
  });

  describe("success", () => {
    it("inserts the report and its notice and audits once, in one transaction", async () => {
      const double = use(success());

      const result = await recordExcessReport(input());

      expect(result).toEqual({ ok: true, reporteId: 3, escalamientoId: 8 });
      expect(double.transactions).toBe(1);
      expect(double.log.map((s) => s.kind)).toEqual([
        "select",
        "select",
        "insert",
        "insert",
      ]);
      expect(double.log.every((s) => s.inTransaction)).toBe(true);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      expect(insertAuditMock.mock.calls[0][1]).toBe(ACTOR);
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "solicitud.reporte_inasistencias",
          entidadTipo: "Solicitud",
          entidadId: ID,
          datos: { reporteId: 3, escalamientoId: 8, docenteId: 5 },
        },
      ]);
    });

    it("snapshots the teacher id and name and stores the date, note and author", async () => {
      const double = use(success());

      await recordExcessReport(input());

      expect(double.log[2].values).toEqual({
        solicitudId: ID,
        docenteId: 5,
        docenteNombre: "Ana Perez",
        comunicadoEl: "2026-10-14",
        nota: "Llamo para avisar.",
        registradoPorId: ACTOR,
        registradoEn: NOW,
      });
    });

    it("creates the notice as an exceso record before approval state, pending, with no note of its own", async () => {
      const double = use(success());

      await recordExcessReport(input());

      expect(double.log[3].values).toEqual({
        solicitudId: ID,
        tipo: "exceso_inasistencias",
        estadoPrevio: "aprobada",
        reporteId: 3,
        secretariaId: ACTOR,
        creadoEn: NOW,
        notificacionEstado: "pendiente",
      });
    });

    it("leaves the request state and the remissions untouched: no update statement", async () => {
      const double = use(success());

      await recordExcessReport(input());

      expect(ofKind(double.log, "update")).toHaveLength(0);
      expect(ofKind(double.log, "delete")).toHaveLength(0);
    });

    it("stores no percentage or absence count anywhere", async () => {
      const double = use(success());

      await recordExcessReport(input());

      for (const statement of ofKind(double.log, "insert")) {
        expect(Object.keys(statement.values as object).join(" ")).not.toMatch(
          /porcentaje|conteo|inasistencias$/i,
        );
      }
    });

    it("records a report without a note as a null note", async () => {
      const double = use(success());

      await recordExcessReport(input({ nota: undefined }));

      expect(double.log[2].values).toMatchObject({ nota: null });
    });

    it("looks up no coordination account: zero accounts or zero emails never refuse", async () => {
      // The script has no account query; one would fail as unscripted.
      const double = use(success());

      expect((await recordExcessReport(input())).ok).toBe(true);
      expect(double.exhausted).toBe(true);
    });

    it("makes a second row, not an update, for a second report of the same teacher", async () => {
      const first = use(success());
      await recordExcessReport(input());
      const second = use(success());
      await recordExcessReport(input({ comunicadoEl: "2026-10-13" }));

      expect(ofKind(first.log, "insert")).toHaveLength(2);
      expect(ofKind(second.log, "insert")).toHaveLength(2);
      expect(second.log[2].values).toMatchObject({
        comunicadoEl: "2026-10-13",
      });
    });
  });

  describe("the request", () => {
    it("is locked FOR UPDATE, only when approved and in the caller's scope", async () => {
      const double = use(success());

      await recordExcessReport(input());

      const query = render(double.log[0].where);
      expect(query.params).toEqual([ID, "aprobada", 3]);
      expect(query.sql).toContain('"c"."FacultadId" = $');
      const source = readFileSync(
        join(process.cwd(), "src", "lib", "data", "solicitud-escalation.ts"),
        "utf8",
      );
      expect(source).toMatch(/\.for\("update"\)/);
    });

    it.each(ESTADOS_SOLICITUD.filter((e) => e !== "aprobada"))(
      "refuses a request in %s with nothing created",
      async (estado) => {
        const double = use([
          { kind: "select", rows: [] },
          { kind: "select", rows: estado === "borrador" ? [] : [{ id: ID }] },
        ]);

        const result = await recordExcessReport(input());

        expect(render(double.log[0].where).params).not.toContain(estado);
        expect(result).toEqual({
          ok: false,
          reason: estado === "borrador" ? "not_found" : "conflict",
        });
        expect(ofKind(double.log, "insert")).toHaveLength(0);
        expect(insertAuditMock).not.toHaveBeenCalled();
      },
    );

    it("is not_found for an unknown or out-of-scope request", async () => {
      const double = use([
        { kind: "select", rows: [] },
        { kind: "select", rows: [] },
      ]);

      expect(
        await recordExcessReport(input({ scope: { kind: "none" } })),
      ).toEqual({ ok: false, reason: "not_found" });
      expect(ofKind(double.log, "insert")).toHaveLength(0);
    });
  });

  describe("the teacher", () => {
    it("resolves the teacher from the request's own remission row", async () => {
      const double = use(success());

      await recordExcessReport(input({ remisionId: 31 }));

      const query = render(double.log[1].where);
      expect(query.params).toEqual([31, ID]);
    });

    it("refuses a teacher outside the request's remissions with an error on teacher", async () => {
      const double = use([
        { kind: "select", rows: [{ id: ID }] },
        { kind: "select", rows: [] },
      ]);

      const result = await recordExcessReport(input({ remisionId: 999 }));

      expect(result).toEqual({
        ok: false,
        reason: "invalid",
        errors: [{ field: "docente", code: "docente_invalid" }],
      });
      expect(ofKind(double.log, "insert")).toHaveLength(0);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it.each([
      ["tomorrow", "2026-10-15"],
      ["missing", undefined],
      ["2026-02-30", "2026-02-30"],
    ])("refuses the date %s before touching the database", async (_l, date) => {
      const double = use([]);

      const result = await recordExcessReport(input({ comunicadoEl: date }));

      expect(result).toMatchObject({ ok: false, reason: "invalid" });
      expect(double.transactions).toBe(0);
    });

    it("refuses a blank or oversized note before touching the database", async () => {
      const double = use([]);

      expect(await recordExcessReport(input({ nota: "   " }))).toMatchObject({
        ok: false,
        reason: "invalid",
      });
      expect(
        await recordExcessReport(input({ nota: "a".repeat(1001) })),
      ).toMatchObject({ ok: false, reason: "invalid" });
      expect(double.transactions).toBe(0);
    });
  });

  describe("rollback", () => {
    it("propagates a failed report insert", async () => {
      use([
        { kind: "select", rows: [{ id: ID }] },
        { kind: "select", rows: [TEACHER] },
        { kind: "insert", error: new Error("report failed") },
      ]);

      await expect(recordExcessReport(input())).rejects.toThrow(
        "report failed",
      );
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("propagates a failed notice insert after the report", async () => {
      use([
        { kind: "select", rows: [{ id: ID }] },
        { kind: "select", rows: [TEACHER] },
        { kind: "insert", rows: [{ id: 3 }] },
        { kind: "insert", error: new Error("notice failed") },
      ]);

      await expect(recordExcessReport(input())).rejects.toThrow(
        "notice failed",
      );
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("propagates a failed audit insert", async () => {
      use(success());
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(recordExcessReport(input())).rejects.toThrow("audit down");
    });
  });
});
