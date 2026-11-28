// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { constantCalendar } from "@/lib/intake/adapters/constant-calendar";
import type { RequestScope } from "@/lib/intake/request-scope";
import type { DeadlineRules } from "@/lib/parameters/derive";

import {
  createDbDouble,
  type LoggedStatement,
  type Step,
} from "./test-support/db-double";

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
  APPROVED_TAB_LIMIT,
  listApprovedRequests,
  listCoordinationQueue,
  listReviewQueue,
  reviewQueueQuery,
} from "@/lib/data/revision-queue";

const SCOPE: RequestScope = { kind: "facultad", facultadId: 3 };
// Wednesday 2026-10-14, 09:00 in Managua (UTC-6).
const NOW = new Date("2026-10-14T15:00:00.000Z");
const CALENDAR = constantCalendar({ 2026: ["2026-12-25"] });
/** The Reglamento values: remit in 2 business days, alert at 1 left. */
const RULES: DeadlineRules = {
  remissionBusinessDays: 2,
  alertBusinessDays: 1,
};

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    presentadaEn: new Date("2026-10-14T16:00:00.000Z"),
    reenviadaEn: null,
    plazoInicioEn: null,
    estudianteNombre: "Ana Perez",
    estudianteCif: "2020-001",
    estudianteCarrera: "Ingenieria",
    ...overrides,
  };
}

function classRow(solicitudId: number, codigo: string) {
  return {
    solicitudId,
    asignaturaId: 10,
    codigo,
    nombre: "Matematica",
    numeroGrupo: "A",
    docenteNombre: null,
  };
}

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

function renderedOrder(statement: LoggedStatement) {
  return render(sql.join(statement.orderBy as never[], sql`, `));
}

describe("listReviewQueue (RF-06, SR-5, SR-6)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("selects only pendiente requests inside the scope", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."Estado" = $1');
    expect(query.sql).toContain('"c"."FacultadId" = $');
    expect(query.params).toEqual(["pendiente", 3]);
  });

  it("runs the exported query builder, the one the real-Postgres index proof plans", async () => {
    const listed = use([{ kind: "select", rows: [] }]);
    await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);
    const shared = use([{ kind: "select", rows: [] }]);
    await reviewQueueQuery(SCOPE);

    expect(render(shared.log[0].where)).toEqual(render(listed.log[0].where));
    expect(renderedOrder(shared.log[0])).toEqual(renderedOrder(listed.log[0]));
    expect(shared.log[0].selection).toEqual(listed.log[0].selection);
  });

  it("matches nothing for the none scope", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    const queue = await listReviewQueue({ kind: "none" }, NOW, CALENDAR, RULES);

    expect(render(double.log[0].where).sql).toContain("and false");
    expect(queue.rows).toEqual([]);
  });

  it("orders by the three-way effective start then id, the queue index expression (ES-5)", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);

    expect(renderedOrder(double.log[0]).sql).toBe(
      'coalesce("Solicitud"."PlazoInicioEn", "Solicitud"."ReenviadaEn", "Solicitud"."PresentadaEn") asc, "Solicitud"."Id" asc',
    );
  });

  it("moves the deadline later by the stored start and keeps the receipt date (RN-08)", async () => {
    use([
      {
        kind: "select",
        rows: [
          // Presented Monday 12th; the coordination answer stored Thursday
          // 15th (Managua midnight) as the effective start.
          row({
            presentadaEn: new Date("2026-10-12T16:00:00.000Z"),
            plazoInicioEn: new Date("2026-10-15T06:00:00.000Z"),
          }),
        ],
      },
      { kind: "select", rows: [] },
    ]);

    const [first] = (await listReviewQueue(SCOPE, NOW, CALENDAR, RULES)).rows;

    // Without the pause the deadline is Wednesday 14th and the row is due
    // today; with it the deadline is Monday 19th.
    expect(first.deadline).toBe("2026-10-19");
    expect(first.status).toBe("en_plazo");
    expect(first.clockStart).toEqual(new Date("2026-10-12T16:00:00.000Z"));
  });

  it("lets a stored start win over a resubmission", async () => {
    use([
      {
        kind: "select",
        rows: [
          row({
            presentadaEn: new Date("2026-10-05T16:00:00.000Z"),
            reenviadaEn: new Date("2026-10-12T16:00:00.000Z"),
            plazoInicioEn: new Date("2026-10-14T06:00:00.000Z"),
          }),
        ],
      },
      { kind: "select", rows: [] },
    ]);

    const [first] = (await listReviewQueue(SCOPE, NOW, CALENDAR, RULES)).rows;

    expect(first.deadline).toBe("2026-10-16");
    expect(first.reenviada).toBe(true);
  });

  it("keeps the order the database returned", async () => {
    use([
      {
        kind: "select",
        rows: [row({ id: 5 }), row({ id: 2 }), row({ id: 9 })],
      },
      { kind: "select", rows: [] },
    ]);

    const queue = await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);

    expect(queue.rows.map((r) => r.id)).toEqual([5, 2, 9]);
  });

  it("flags each row with the RN-08 status of its own clock start", async () => {
    use([
      {
        kind: "select",
        rows: [
          // Friday: deadline Tuesday 13th, today Wednesday 14th.
          row({ id: 1, presentadaEn: new Date("2026-10-09T16:00:00.000Z") }),
          // Monday: deadline Wednesday 14th, due today.
          row({ id: 2, presentadaEn: new Date("2026-10-12T16:00:00.000Z") }),
          // Wednesday: deadline Friday 16th, two business days left.
          row({ id: 3, presentadaEn: new Date("2026-10-14T16:00:00.000Z") }),
        ],
      },
      { kind: "select", rows: [] },
    ]);

    const queue = await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);

    expect(queue.rows.map((r) => [r.id, r.status, r.deadline])).toEqual([
      [1, "vencida", "2026-10-13"],
      [2, "por_vencer", "2026-10-14"],
      [3, "en_plazo", "2026-10-16"],
    ]);
  });

  it("starts the clock at the resubmission, not at the first presentation", async () => {
    use([
      {
        kind: "select",
        rows: [
          row({
            presentadaEn: new Date("2026-10-05T16:00:00.000Z"),
            reenviadaEn: new Date("2026-10-14T16:00:00.000Z"),
          }),
        ],
      },
      { kind: "select", rows: [] },
    ]);

    const [first] = (await listReviewQueue(SCOPE, NOW, CALENDAR, RULES)).rows;

    expect(first.status).toBe("en_plazo");
    expect(first.deadline).toBe("2026-10-16");
    expect(first.reenviada).toBe(true);
    expect(first.clockStart).toEqual(new Date("2026-10-14T16:00:00.000Z"));
  });

  it("reads the clock start as a Managua date, not a UTC date", async () => {
    // 2026-10-12 02:00 UTC is Sunday 11th, 20:00 in Managua: deadline Tuesday.
    use([
      {
        kind: "select",
        rows: [row({ presentadaEn: new Date("2026-10-12T02:00:00.000Z") })],
      },
      { kind: "select", rows: [] },
    ]);

    const [first] = (await listReviewQueue(SCOPE, NOW, CALENDAR, RULES)).rows;

    expect(first.deadline).toBe("2026-10-13");
    expect(first.status).toBe("vencida");
  });

  it("counts the classes of each request through the class reader", async () => {
    const double = use([
      { kind: "select", rows: [row({ id: 1 }), row({ id: 2 })] },
      {
        kind: "select",
        rows: [
          classRow(1, "MAT101"),
          classRow(1, "FIS101"),
          classRow(2, "QUI1"),
        ],
      },
    ]);

    const queue = await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);

    expect(queue.rows.map((r) => r.asignaturas)).toEqual([2, 1]);
    expect(double.log).toHaveLength(2);
  });

  it("reports zero classes for a request without class rows", async () => {
    use([
      { kind: "select", rows: [row({ id: 1 })] },
      { kind: "select", rows: [] },
    ]);

    const queue = await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);

    expect(queue.rows[0].asignaturas).toBe(0);
  });

  it("returns the snapshot identity and never the cause", async () => {
    use([
      { kind: "select", rows: [row({ causa: "medica" })] },
      { kind: "select", rows: [] },
    ]);

    const [first] = (await listReviewQueue(SCOPE, NOW, CALENDAR, RULES)).rows;

    expect(first).toMatchObject({
      estudianteNombre: "Ana Perez",
      estudianteCif: "2020-001",
      estudianteCarrera: "Ingenieria",
    });
    expect(first).not.toHaveProperty("causa");
  });

  it("issues no class read for an empty queue", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    const queue = await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);

    expect(queue).toEqual({ rows: [], calendarLoaded: true });
    expect(double.log).toHaveLength(1);
  });

  describe("calendar coverage", () => {
    it("surfaces that the current year is loaded", async () => {
      use([{ kind: "select", rows: [] }]);

      const queue = await listReviewQueue(SCOPE, NOW, CALENDAR, RULES);

      expect(queue.calendarLoaded).toBe(true);
    });

    it("surfaces a year without entries and still computes from weekends", async () => {
      use([
        { kind: "select", rows: [row()] },
        { kind: "select", rows: [] },
      ]);

      const queue = await listReviewQueue(
        SCOPE,
        NOW,
        constantCalendar({}),
        RULES,
      );

      expect(queue.calendarLoaded).toBe(false);
      expect(queue.rows[0].deadline).toBe("2026-10-16");
    });

    it("judges the coverage by the Managua year of now", async () => {
      use([{ kind: "select", rows: [] }]);
      // 2027-01-01 03:00 UTC is still 2026-12-31 in Managua.
      const queue = await listReviewQueue(
        SCOPE,
        new Date("2027-01-01T03:00:00.000Z"),
        constantCalendar({ 2026: ["2026-12-25"] }),
        RULES,
      );

      expect(queue.calendarLoaded).toBe(true);
    });
  });
});

describe("listReviewQueue reads the rules in force (RR-QUEUE, NP-10, NP-13)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  // Presented Monday 12th; NOW is Wednesday 14th. With 2 and 1 the deadline is
  // today and the row is flagged; remission 3 gives Thursday 15th.
  const MONDAY = row({ presentadaEn: new Date("2026-10-12T16:00:00.000Z") });

  async function firstWith(rules: DeadlineRules, calendar = CALENDAR) {
    holder.current = createDbDouble([
      { kind: "select", rows: [MONDAY] },
      { kind: "select", rows: [] },
    ]).db;
    return (await listReviewQueue(SCOPE, NOW, calendar, rules)).rows[0];
  }

  it.each([
    // remission, alert, deadline, status
    [2, 1, "2026-10-14", "por_vencer"],
    [3, 1, "2026-10-15", "por_vencer"],
    [3, 0, "2026-10-15", "en_plazo"],
    [4, 1, "2026-10-16", "en_plazo"],
    [4, 2, "2026-10-16", "por_vencer"],
    [1, 0, "2026-10-13", "vencida"],
    [2, 0, "2026-10-14", "por_vencer"],
  ] as const)(
    "remission %d and alert %d give the deadline %s and the state %s",
    async (remissionBusinessDays, alertBusinessDays, deadline, status) => {
      const first = await firstWith({
        remissionBusinessDays,
        alertBusinessDays,
      });

      expect(first.deadline).toBe(deadline);
      expect(first.status).toBe(status);
    },
  );

  it("moves the deadline from Wednesday to Thursday when a calendar date is added", async () => {
    const before = await firstWith(RULES);
    const after = await firstWith(
      RULES,
      constantCalendar({ 2026: ["2026-10-13", "2026-12-25"] }),
    );

    expect(before.deadline).toBe("2026-10-14");
    expect(after.deadline).toBe("2026-10-15");
    // The same request, only read differently: nothing else about it moves.
    expect(after.clockStart).toEqual(before.clockStart);
  });

  it("never recomputes the stored start: it reads PlazoInicioEn and only counts from it", async () => {
    // The answer stored Thursday 15th (Managua midnight) under the old calendar.
    const stored = row({
      presentadaEn: new Date("2026-10-12T16:00:00.000Z"),
      plazoInicioEn: new Date("2026-10-15T06:00:00.000Z"),
    });
    const read = async (calendar: typeof CALENDAR) => {
      const double = createDbDouble([
        { kind: "select", rows: [stored] },
        { kind: "select", rows: [] },
      ]);
      holder.current = double.db;
      const [first] = (await listReviewQueue(SCOPE, NOW, calendar, RULES)).rows;
      return { first, double };
    };

    const old = await read(CALENDAR);
    // Friday 16th becomes a holiday: the same stored Thursday start now counts
    // Mon 19th and Tue 20th.
    const added = await read(
      constantCalendar({ 2026: ["2026-10-16", "2026-12-25"] }),
    );

    expect(old.first.deadline).toBe("2026-10-19");
    expect(added.first.deadline).toBe("2026-10-20");
    // Both read the same stored value; the receipt date is untouched, and the
    // read never writes.
    expect(added.first.clockStart).toEqual(
      new Date("2026-10-12T16:00:00.000Z"),
    );
    expect(added.double.log.map((statement) => statement.kind)).toEqual([
      "select",
      "select",
    ]);
  });

  it("orders and badges every row by the same rules, one row per request", async () => {
    use([
      {
        kind: "select",
        rows: [
          row({ id: 1, presentadaEn: new Date("2026-10-09T16:00:00.000Z") }),
          row({ id: 2, presentadaEn: new Date("2026-10-12T16:00:00.000Z") }),
          row({ id: 3, presentadaEn: new Date("2026-10-14T16:00:00.000Z") }),
        ],
      },
      { kind: "select", rows: [] },
    ]);

    const queue = await listReviewQueue(SCOPE, NOW, CALENDAR, {
      remissionBusinessDays: 3,
      alertBusinessDays: 2,
    });

    // Fri 9th +3 = Wed 14th (due today), Mon 12th +3 = Thu 15th (1 left),
    // Wed 14th +3 = Mon 19th (3 left).
    expect(queue.rows.map((r) => [r.id, r.status, r.deadline])).toEqual([
      [1, "por_vencer", "2026-10-14"],
      [2, "por_vencer", "2026-10-15"],
      [3, "en_plazo", "2026-10-19"],
    ]);
  });
});

const ESCALATED_AT = new Date("2026-10-13T15:00:00.000Z");

function coordinationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    estudianteNombre: "Ana Perez",
    estudianteCif: "2020-001",
    estudianteCarrera: "Ingenieria",
    motivo: "sospecha_documento",
    escaladaEn: ESCALATED_AT,
    notificacionEstado: "pendiente",
    notificacionMotivo: null,
    enviadaEn: null,
    ...overrides,
  };
}

describe("listCoordinationQueue (RF-06, RF-10, E14)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("selects the open escalation, of any motive, of requests in coordination inside the scope", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listCoordinationQueue(SCOPE);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."Estado" = $1');
    expect(query.sql).toContain('"Escalamiento"."Tipo" in ($2, $3, $4)');
    expect(query.sql).toContain('"Escalamiento"."RespondidaEn" is null');
    expect(query.sql).toContain('"c"."FacultadId" = $');
    expect(query.params).toEqual([
      "en_revision_coordinacion",
      "sospecha_documento",
      "caso_especial",
      "otro",
      3,
    ]);
  });

  it("matches nothing for the none scope", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    const queue = await listCoordinationQueue({ kind: "none" });

    expect(render(double.log[0].where).sql).toContain("and false");
    expect(queue.rows).toEqual([]);
  });

  it("orders by escalation time ascending, oldest first, then id", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listCoordinationQueue(SCOPE);

    expect(renderedOrder(double.log[0]).sql).toBe(
      '"Escalamiento"."CreadoEn" asc, "Solicitud"."Id" asc',
    );
  });

  it("returns the reason, the escalation time and the notification status per row", async () => {
    use([
      {
        kind: "select",
        rows: [
          coordinationRow({ id: 5 }),
          coordinationRow({
            id: 2,
            notificacionEstado: "bloqueada",
            notificacionMotivo: "sin_destinatarios",
          }),
          coordinationRow({
            id: 3,
            notificacionEstado: "enviada",
            enviadaEn: new Date("2026-10-13T15:05:00.000Z"),
          }),
        ],
      },
      {
        kind: "select",
        rows: [classRow(5, "MAT101"), classRow(5, "FIS101")],
      },
    ]);

    const queue = await listCoordinationQueue(SCOPE);

    expect(queue.rows.map((r) => r.id)).toEqual([5, 2, 3]);
    expect(queue.rows[2]).toMatchObject({
      notificacionEstado: "enviada",
      enviadaEn: new Date("2026-10-13T15:05:00.000Z"),
    });
    expect(queue.rows[0]).toMatchObject({
      estudianteNombre: "Ana Perez",
      motivo: "sospecha_documento",
      escaladaEn: ESCALATED_AT,
      asignaturas: 2,
      notificacionEstado: "pendiente",
      notificacionMotivo: null,
    });
    expect(queue.rows[1]).toMatchObject({
      asignaturas: 0,
      notificacionEstado: "bloqueada",
      notificacionMotivo: "sin_destinatarios",
    });
  });

  it("never returns the cause or the note", async () => {
    use([
      {
        kind: "select",
        rows: [coordinationRow({ causa: "medica", nota: "Sospecha" })],
      },
      { kind: "select", rows: [] },
    ]);

    const [first] = (await listCoordinationQueue(SCOPE)).rows;

    expect(first.estudianteNombre).toBe("Ana Perez");
    expect(first).not.toHaveProperty("causa");
    expect(first).not.toHaveProperty("nota");
  });

  it("issues no class read for an empty tab", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listCoordinationQueue(SCOPE);

    expect(double.log).toHaveLength(1);
  });
});

function approvedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    estudianteNombre: "Ana Perez",
    estudianteCif: "2020-001",
    estudianteCarrera: "Ingenieria",
    aprobadaEn: new Date("2026-10-12T15:00:00.000Z"),
    reportes: 0,
    ...overrides,
  };
}

describe("listApprovedRequests (RF-15, E14)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("selects the approval of aprobada requests inside the scope", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listApprovedRequests(SCOPE);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."Estado" = $1');
    expect(query.sql).toContain('"SolicitudDecision"."Tipo" = $2');
    expect(query.sql).toContain('"c"."FacultadId" = $');
    expect(query.params).toEqual(["aprobada", "aprobada", 3]);
  });

  it("matches nothing for the none scope", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    const queue = await listApprovedRequests({ kind: "none" });

    expect(render(double.log[0].where).sql).toContain("and false");
    expect(queue.rows).toEqual([]);
  });

  it("orders by the approval time descending, newest first, then id", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listApprovedRequests(SCOPE);

    expect(renderedOrder(double.log[0]).sql).toBe(
      '"SolicitudDecision"."DecididaEn" desc, "Solicitud"."Id" desc',
    );
  });

  it("reads only the newest 50", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    await listApprovedRequests(SCOPE);

    expect(APPROVED_TAB_LIMIT).toBe(50);
    expect(double.log[0].limit).toBe(50);
  });

  it("returns the approval time and the number of recorded reports per row", async () => {
    use([
      {
        kind: "select",
        rows: [approvedRow({ id: 9, reportes: 2 }), approvedRow({ id: 4 })],
      },
    ]);

    const queue = await listApprovedRequests(SCOPE);

    expect(queue.rows.map((r) => [r.id, r.reportes])).toEqual([
      [9, 2],
      [4, 0],
    ]);
    expect(queue.rows[0].aprobadaEn).toEqual(
      new Date("2026-10-12T15:00:00.000Z"),
    );
    expect(queue.rows[0]).toMatchObject({
      estudianteNombre: "Ana Perez",
      estudianteCif: "2020-001",
      estudianteCarrera: "Ingenieria",
    });
  });
});
