// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { escalamiento, solicitud } from "@/db/schema";
import type { CoordinationScope } from "@/lib/intake/coordination-scope";
import type { NonWorkingDaysProvider } from "@/lib/intake/ports";

import { createDbDouble, type Step } from "./test-support/db-double";

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

import { answerEscalation } from "@/lib/data/escalation-answer";

const ACTOR = 30;
const ESCALATION = 9;
const REQUEST = 41;
const CAREER = 4;
const SCOPE: CoordinationScope = { kind: "carrera", carreraId: CAREER };
const NONE: CoordinationScope = { kind: "none" };
const ANSWER = "Los documentos son consistentes con la causa declarada.";

function calendar(days: readonly string[] = []): NonWorkingDaysProvider {
  return {
    isNonWorkingDay: (iso) => days.includes(iso),
    coversYear: () => true,
  };
}

// 2026-10-05 is a Monday. Instants are Managua noon (UTC-6).
const noon = (iso: string) => new Date(`${iso}T18:00:00Z`);
const MON = "2026-10-05";
const TUE = "2026-10-06";
const WED = "2026-10-07";
const THU = "2026-10-08";
const NEXT_MON = "2026-10-12";

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

type Dates = {
  escalatedOn: string;
  answeredOn: string;
  presentedOn?: string;
  plazoInicioEn?: Date | null;
  reenviadaEn?: Date | null;
};

/** The three statements of a successful answer, for the given dates. */
function success(d: Dates): Step[] {
  return [
    {
      kind: "update",
      rows: [{ solicitudId: REQUEST, creadoEn: noon(d.escalatedOn) }],
    },
    {
      kind: "select",
      rows: [
        {
          presentadaEn: noon(d.presentedOn ?? MON),
          reenviadaEn: d.reenviadaEn ?? null,
          plazoInicioEn: d.plazoInicioEn ?? null,
        },
      ],
    },
    { kind: "update", rows: [{ id: REQUEST }] },
  ];
}

const input = (overrides: Record<string, unknown> = {}) => ({
  actorId: ACTOR,
  scope: SCOPE,
  escalamientoId: ESCALATION,
  respuesta: ANSWER,
  now: noon(THU),
  calendar: calendar(),
  ...overrides,
});

beforeEach(() => {
  holder.current = null;
  insertAuditMock.mockReset().mockResolvedValue(undefined);
});

describe("answerEscalation (ES-8, E1, E3)", () => {
  describe("success", () => {
    it("closes the escalation, returns the request to pendiente and writes one audit row, in one transaction", async () => {
      const double = use(success({ escalatedOn: MON, answeredOn: THU }));

      const result = await answerEscalation(input());

      expect(result).toEqual({ ok: true, solicitudId: REQUEST });
      expect(double.transactions).toBe(1);
      expect(double.log.map((s) => s.kind)).toEqual([
        "update",
        "select",
        "update",
      ]);
      expect(double.log.every((s) => s.inTransaction)).toBe(true);
      expect(double.log[0].table).toBe(escalamiento);
      expect(double.log[2].table).toBe(solicitud);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      expect(insertAuditMock.mock.calls[0][1]).toBe(ACTOR);
      expect(insertAuditMock.mock.calls[0][2]).toEqual([
        {
          accion: "solicitud.escalamiento_resuelto",
          entidadTipo: "Solicitud",
          entidadId: REQUEST,
          datos: {
            escalamientoId: ESCALATION,
            estadoPrevio: "en_revision_coordinacion",
            estadoNuevo: "pendiente",
          },
        },
      ]);
    });

    it("stores the trimmed answer, the answering coordinator and the time, and touches no outbox column", async () => {
      const double = use(success({ escalatedOn: MON, answeredOn: THU }));

      await answerEscalation(input({ respuesta: `  ${ANSWER}  ` }));

      expect(double.log[0].set).toEqual({
        respuesta: ANSWER,
        respondidaPorId: ACTOR,
        respondidaEn: noon(THU),
      });
    });

    it("guards the escalation update: open, either motive (E18), in the career of the caller", async () => {
      const double = use(success({ escalatedOn: MON, answeredOn: THU }));

      await answerEscalation(input());

      const where = render(double.log[0].where);
      expect(where.sql).toContain('"Escalamiento"."Id" = $1');
      expect(where.sql).toContain('"Escalamiento"."Tipo" in ($2, $3)');
      expect(where.sql).toContain('"Escalamiento"."RespondidaEn" is null');
      expect(where.sql).toContain('"ec"."CarreraId" = $4');
      expect(where.params).toEqual([
        ESCALATION,
        "sospecha_documento",
        "caso_especial",
        CAREER,
      ]);
    });

    it("guards the request update with the coordination source state only", async () => {
      const double = use(success({ escalatedOn: MON, answeredOn: THU }));

      await answerEscalation(input());

      const where = render(double.log[2].where);
      expect(where.sql).toContain('"Solicitud"."Id" = $1');
      expect(where.sql).toContain('"Solicitud"."Estado" = $2');
      expect(where.params).toEqual([REQUEST, "en_revision_coordinacion"]);
    });

    it("writes no decision row and updates only the escalation and the request", async () => {
      const double = use(success({ escalatedOn: MON, answeredOn: THU }));

      await answerEscalation(input());

      expect(double.log.filter((s) => s.kind === "insert")).toHaveLength(0);
      expect(double.log.filter((s) => s.kind === "delete")).toHaveLength(0);
      expect(
        double.log.filter((s) => s.kind === "update").map((s) => s.table),
      ).toEqual([escalamiento, solicitud]);
    });
  });

  describe("the RN-08 pause (spec table, business days)", () => {
    it.each([
      ["Mon / Mon / Thu: three days paused", MON, THU, "2026-10-08T06:00:00Z"],
      [
        "Mon / Tue / next Mon: four days paused",
        TUE,
        NEXT_MON,
        "2026-10-09T06:00:00Z",
      ],
    ])("%s", async (_label, escalatedOn, answeredOn, expectedStart) => {
      const double = use(success({ escalatedOn, answeredOn }));

      await answerEscalation(input({ now: noon(answeredOn) }));

      expect(double.log[2].set).toEqual({
        estado: "pendiente",
        plazoInicioEn: new Date(expectedStart),
        actualizadoEn: noon(answeredOn),
      });
    });

    it("writes no PlazoInicioEn when no business day was paused (answered the same day it was escalated)", async () => {
      const double = use(success({ escalatedOn: TUE, answeredOn: TUE }));

      await answerEscalation(input({ now: noon(TUE) }));

      expect(double.log[2].set).toEqual({
        estado: "pendiente",
        actualizadoEn: noon(TUE),
      });
      expect(Object.keys(double.log[2].set as object)).not.toContain(
        "plazoInicioEn",
      );
    });

    it("adds a second pause on top of the stored start", async () => {
      const double = use(
        success({
          escalatedOn: NEXT_MON,
          answeredOn: "2026-10-14",
          plazoInicioEn: new Date("2026-10-08T06:00:00Z"),
        }),
      );

      await answerEscalation(input({ now: noon("2026-10-14") }));

      expect(
        (double.log[2].set as { plazoInicioEn: Date }).plazoInicioEn,
      ).toEqual(new Date("2026-10-12T06:00:00Z"));
    });

    it("starts from the resubmission when there is no stored start (Thu + 2 business days = next Mon)", async () => {
      const double = use(
        success({
          escalatedOn: "2026-10-12",
          answeredOn: "2026-10-14",
          reenviadaEn: noon(THU),
        }),
      );

      await answerEscalation(input({ now: noon("2026-10-14") }));

      expect(
        (double.log[2].set as { plazoInicioEn: Date }).plazoInicioEn,
      ).toEqual(new Date("2026-10-12T06:00:00Z"));
    });

    it("does not count a holiday inside the pause", async () => {
      const double = use(success({ escalatedOn: MON, answeredOn: THU }));

      await answerEscalation(
        input({ now: noon(THU), calendar: calendar([WED]) }),
      );

      // Mon and Tue are paused (Wed is a holiday): Mon + 2 business days = Thu.
      expect(
        (double.log[2].set as { plazoInicioEn: Date }).plazoInicioEn,
      ).toEqual(new Date("2026-10-08T06:00:00Z"));
    });

    it("reads the start columns of the request in the same transaction", async () => {
      const double = use(success({ escalatedOn: MON, answeredOn: THU }));

      await answerEscalation(input());

      expect(double.log[1].table).toBe(solicitud);
      expect(double.log[1].inTransaction).toBe(true);
      expect(render(double.log[1].where).params).toEqual([REQUEST]);
    });
  });

  describe("refusals write nothing", () => {
    it.each([
      ["empty", "", "texto_required"],
      ["whitespace only", "   \n ", "texto_required"],
      ["1001 characters", "a".repeat(1001), "texto_too_long"],
    ])(
      "refuses an answer of %s before any statement",
      async (_l, text, code) => {
        const double = use([]);

        const result = await answerEscalation(input({ respuesta: text }));

        expect(result).toEqual({
          ok: false,
          reason: "invalid",
          errors: [{ field: "texto", code }],
        });
        expect(double.log).toHaveLength(0);
        expect(double.transactions).toBe(0);
        expect(insertAuditMock).not.toHaveBeenCalled();
      },
    );

    it("accepts an answer of exactly 1000 characters", async () => {
      const double = use(success({ escalatedOn: MON, answeredOn: THU }));

      const result = await answerEscalation(
        input({ respuesta: "a".repeat(1000) }),
      );

      expect(result).toEqual({ ok: true, solicitudId: REQUEST });
      expect(
        (double.log[0].set as { respuesta: string }).respuesta,
      ).toHaveLength(1000);
    });

    it("answers not_found for a coordinator without a career, with no statement", async () => {
      const double = use([]);

      expect(await answerEscalation(input({ scope: NONE }))).toEqual({
        ok: false,
        reason: "not_found",
      });
      expect(double.log).toHaveLength(0);
    });

    it("answers not_found when nothing matches in the career (another career, a notice, a pendiente request)", async () => {
      const double = use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [] },
      ]);

      expect(await answerEscalation(input())).toEqual({
        ok: false,
        reason: "not_found",
      });
      expect(double.log.map((s) => s.kind)).toEqual(["update", "select"]);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("tells an answered escalation of the own career apart: the concurrent loser gets conflict", async () => {
      const double = use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [{ id: ESCALATION }] },
      ]);

      expect(await answerEscalation(input())).toEqual({
        ok: false,
        reason: "conflict",
      });
      expect(insertAuditMock).not.toHaveBeenCalled();
      const lookup = render(double.log[1].where);
      expect(lookup.params).toEqual([
        ESCALATION,
        "sospecha_documento",
        "caso_especial",
        CAREER,
      ]);
      expect(lookup.sql).toContain('"ec"."CarreraId" = $4');
    });
  });

  describe("failure rolls back (nothing is audited)", () => {
    it("throws when the request is no longer in coordination, so the answer is undone", async () => {
      use([
        success({ escalatedOn: MON, answeredOn: THU })[0],
        success({ escalatedOn: MON, answeredOn: THU })[1],
        { kind: "update", rows: [] },
      ]);

      await expect(answerEscalation(input())).rejects.toThrow();
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("rejects when the request update fails", async () => {
      const steps = success({ escalatedOn: MON, answeredOn: THU });
      use([steps[0], steps[1], { kind: "update", error: new Error("down") }]);

      await expect(answerEscalation(input())).rejects.toThrow("down");
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("rejects when the audit insert fails", async () => {
      use(success({ escalatedOn: MON, answeredOn: THU }));
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(answerEscalation(input())).rejects.toThrow("audit down");
    });
  });
});
