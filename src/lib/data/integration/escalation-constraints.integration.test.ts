import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db";
import {
  escalamiento,
  reporteInasistencia,
  solicitud,
  type NuevoEscalamiento,
} from "@/db/schema";
import { createFixtures } from "@/lib/data/integration/fixtures";

// Real-Postgres proof of the escalation schema rules (escalation, task 12.9).
// The unit tests read the generated SQL; this suite makes the database itself
// accept and reject rows, so a CHECK that is written wrong, or dropped by a
// migration, fails here. Two CHECKs cannot be proven by a row: Postgres reports
// the alphabetically first violated CHECK, so `CK_Escalamiento_Kind` hides
// `CK_Escalamiento_Tipo` and `CK_Escalamiento_MotivoEstado` hides
// `CK_Escalamiento_NotificacionMotivo` (every row one rejects breaks the other
// too). The catalog test below closes that gap: every expected CHECK must exist
// in `pg_constraint` with the fragments of its definition, so dropping any of
// them fails, shadowed or not.
//
// Every case runs in its own transaction that is always rolled back, so the
// only rows left behind are the fixtures (removed by `cleanup()`). A rejected
// row is identified by SQLSTATE and by constraint name: a CHECK that fires for
// the wrong reason does not count as proof.
//
// HOW TO RUN (never part of `npm test`; owner-run, phase 14):
//   INTEGRATION_DATABASE_URL=<disposable branch url> \
//   INTEGRATION_ALLOW_WRITES=1 npm run test:integration
// The branch needs migration `0011_escalation` applied. Without
// INTEGRATION_DATABASE_URL the suite is skipped; the opt-in guard is the one of
// `intake-concurrency.integration.test.ts`.

// Decided by vitest.integration.setup.ts before it replaced DATABASE_URL.
const gate = { mode: process.env.INTEGRATION_GATE_MODE ?? "skip" };
if (gate.mode === "refuse") {
  throw new Error(
    `Refusing to run the integration suite: ${process.env.INTEGRATION_GATE_REASON}`,
  );
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";

const PRESENTED = new Date("2026-10-05T15:00:00.000Z");
const CREATED = new Date("2026-10-06T15:00:00.000Z");
const LATER = new Date("2026-10-07T15:00:00.000Z");
const EARLIER = new Date("2026-10-05T15:00:00.000Z");

/** Thrown at the end of every case so the transaction never commits. */
class RolledBack extends Error {}

type Outcome =
  | { accepted: true }
  | { accepted: false; code: string; constraint: string | undefined };

/** SQLSTATE and constraint of a database error, read through `cause`. */
function databaseError(error: unknown): {
  code: string;
  constraint: string | undefined;
} {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const { code, constraint_name } = current as {
      code?: unknown;
      constraint_name?: unknown;
    };
    if (typeof code === "string" && /^[0-9]{2}[0-9A-Z]{3}$/.test(code)) {
      return {
        code,
        constraint:
          typeof constraint_name === "string" ? constraint_name : undefined,
      };
    }
    current = (current as { cause?: unknown }).cause;
  }
  throw error;
}

/** Run `work` in a transaction that is rolled back whatever happens. */
async function attempt(work: (tx: Tx) => Promise<void>): Promise<Outcome> {
  try {
    await db.transaction(async (tx) => {
      await work(tx);
      throw new RolledBack();
    });
  } catch (error) {
    if (error instanceof RolledBack) return { accepted: true };
    return { accepted: false, ...databaseError(error) };
  }
  throw new Error("The transaction ended without rolling back");
}

describe.skipIf(gate.mode !== "run")(
  "escalation schema rules (real Postgres)",
  () => {
    const fixtures = createFixtures();
    let studentId: number;
    let secretariaId: number;
    let teacherId: number;

    beforeAll(async () => {
      // Fail fast and readable when the branch is unreachable or unmigrated.
      await db.select({ id: escalamiento.id }).from(escalamiento).limit(1);
      studentId = (await fixtures.addStudent()).id;
      secretariaId = (await fixtures.addSecretaria()).id;
      teacherId = await fixtures.addTeacher();
    });

    afterAll(async () => {
      await fixtures.cleanup();
    });

    /** A presented request, inserted directly in the transaction. */
    async function request(
      tx: Tx,
      overrides: Partial<typeof solicitud.$inferInsert> = {},
    ): Promise<number> {
      const [row] = await tx
        .insert(solicitud)
        .values({
          estudianteId: studentId,
          estado: "pendiente",
          causa: "medica",
          fechaInicio: "2026-10-01",
          fechaFin: "2026-10-03",
          presentadaEn: PRESENTED,
          estudianteNombre: "IT Estudiante",
          estudianteCif: "IT0001",
          estudianteCarrera: "IT carrera",
          estudianteCorreo: "it@integration.invalid",
          ...overrides,
        })
        .returning({ id: solicitud.id });
      return row.id;
    }

    async function report(
      tx: Tx,
      solicitudId: number,
      nota: string | null = null,
    ): Promise<number> {
      const [row] = await tx
        .insert(reporteInasistencia)
        .values({
          solicitudId,
          docenteId: teacherId,
          docenteNombre: "IT Docente",
          comunicadoEl: "2026-10-04",
          nota,
          registradoPorId: secretariaId,
        })
        .returning({ id: reporteInasistencia.id });
      return row.id;
    }

    /** A valid suspicion row for `solicitudId`, with `overrides` applied. */
    function suspicion(
      solicitudId: number,
      overrides: Partial<NuevoEscalamiento> = {},
    ): NuevoEscalamiento {
      return {
        solicitudId,
        tipo: "sospecha_documento",
        estadoPrevio: "pendiente",
        nota: "The certificate looks altered",
        secretariaId,
        creadoEn: CREATED,
        ...overrides,
      };
    }

    /** A valid excess-absence row; `reporteId` comes from `report()`. */
    function excess(
      solicitudId: number,
      reporteId: number,
      overrides: Partial<NuevoEscalamiento> = {},
    ): NuevoEscalamiento {
      return {
        solicitudId,
        tipo: "exceso_inasistencias",
        estadoPrevio: "aprobada",
        nota: null,
        reporteId,
        secretariaId,
        creadoEn: CREATED,
        ...overrides,
      };
    }

    type Case = {
      name: string;
      /** Builds the row in the transaction; the insert is the case. */
      row: (tx: Tx) => Promise<NuevoEscalamiento>;
      /** Absent when accepted; else every constraint the row really breaks. */
      rejectedBy?: string[];
    };

    const answered = {
      respuesta: "Reviewed: the certificate is genuine",
      respondidaEn: LATER,
    };

    const CASES: Case[] = [
      // CK_Escalamiento_Tipo
      {
        name: "accepts a suspicion",
        row: async (tx) => suspicion(await request(tx)),
      },
      {
        name: "rejects an unknown Tipo",
        row: async (tx) =>
          suspicion(await request(tx), { tipo: "otro" as never }),
        rejectedBy: ["CK_Escalamiento_Tipo", "CK_Escalamiento_Kind"],
      },

      // CK_Escalamiento_Kind: suspicion shape
      {
        name: "rejects a suspicion that came from a state other than pendiente",
        row: async (tx) =>
          suspicion(await request(tx), { estadoPrevio: "aprobada" }),
        rejectedBy: ["CK_Escalamiento_Kind"],
      },
      {
        name: "rejects a suspicion that carries a report",
        row: async (tx) => {
          const approved = await request(tx, { estado: "aprobada" });
          return suspicion(await request(tx), {
            reporteId: await report(tx, approved),
          });
        },
        rejectedBy: ["CK_Escalamiento_Kind"],
      },
      {
        name: "rejects a suspicion without a note",
        row: async (tx) => suspicion(await request(tx), { nota: null }),
        rejectedBy: ["CK_Escalamiento_Kind"],
      },
      {
        name: "rejects a suspicion with a blank note",
        row: async (tx) => suspicion(await request(tx), { nota: "   " }),
        rejectedBy: ["CK_Escalamiento_Kind"],
      },

      // CK_Escalamiento_Kind: excess-absence shape
      {
        name: "accepts an excess-absence notice with its report",
        row: async (tx) => {
          const approved = await request(tx, { estado: "aprobada" });
          return excess(approved, await report(tx, approved));
        },
      },
      {
        name: "rejects an excess-absence notice from a state other than aprobada",
        row: async (tx) => {
          const approved = await request(tx, { estado: "aprobada" });
          return excess(approved, await report(tx, approved), {
            estadoPrevio: "pendiente",
          });
        },
        rejectedBy: ["CK_Escalamiento_Kind"],
      },
      {
        name: "rejects an excess-absence notice without a report",
        row: async (tx) =>
          excess(await request(tx, { estado: "aprobada" }), 0, {
            reporteId: null,
          }),
        rejectedBy: ["CK_Escalamiento_Kind"],
      },
      {
        name: "rejects an excess-absence notice that carries a note",
        row: async (tx) => {
          const approved = await request(tx, { estado: "aprobada" });
          return excess(approved, await report(tx, approved), {
            nota: "A note belongs to a suspicion",
          });
        },
        rejectedBy: ["CK_Escalamiento_Kind"],
      },

      // CK_Escalamiento_Respuesta: the three answer columns go together
      {
        name: "accepts an answered suspicion",
        row: async (tx) =>
          suspicion(await request(tx), {
            ...answered,
            respondidaPorId: secretariaId,
          }),
      },
      {
        name: "rejects an answer without who answered",
        row: async (tx) => suspicion(await request(tx), { ...answered }),
        rejectedBy: ["CK_Escalamiento_Respuesta"],
      },
      {
        name: "rejects who answered without an answer",
        row: async (tx) =>
          suspicion(await request(tx), {
            respuesta: null,
            respondidaPorId: secretariaId,
            respondidaEn: null,
          }),
        rejectedBy: ["CK_Escalamiento_Respuesta"],
      },
      {
        name: "rejects an answer without its time",
        row: async (tx) =>
          suspicion(await request(tx), {
            ...answered,
            respondidaPorId: secretariaId,
            respondidaEn: null,
          }),
        rejectedBy: ["CK_Escalamiento_Respuesta"],
      },
      {
        name: "rejects a blank answer",
        row: async (tx) =>
          suspicion(await request(tx), {
            ...answered,
            respuesta: "   ",
            respondidaPorId: secretariaId,
          }),
        rejectedBy: ["CK_Escalamiento_Respuesta"],
      },
      {
        name: "rejects an answer older than the escalation",
        row: async (tx) =>
          suspicion(await request(tx), {
            ...answered,
            respondidaPorId: secretariaId,
            respondidaEn: EARLIER,
          }),
        rejectedBy: ["CK_Escalamiento_Respuesta"],
      },

      // CK_Escalamiento_SinRespuesta: only a suspicion is answered
      {
        name: "rejects an answer on an excess-absence notice",
        row: async (tx) => {
          const approved = await request(tx, { estado: "aprobada" });
          return excess(approved, await report(tx, approved), {
            ...answered,
            respondidaPorId: secretariaId,
          });
        },
        rejectedBy: ["CK_Escalamiento_SinRespuesta"],
      },

      // CK_Escalamiento_NotificacionEstado / NotificacionMotivo / MotivoEstado
      {
        name: "accepts a blocked notice with sin_destinatarios",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "bloqueada",
            notificacionMotivo: "sin_destinatarios",
          }),
      },
      {
        name: "accepts a pending notice with error_envio and attempts",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "pendiente",
            notificacionMotivo: "error_envio",
            intentos: 3,
          }),
      },
      {
        name: "rejects an unknown notice state",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "otra" as never,
          }),
        rejectedBy: ["CK_Escalamiento_NotificacionEstado"],
      },
      {
        name: "rejects an unknown notice reason",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionMotivo: "otro" as never,
          }),
        rejectedBy: [
          "CK_Escalamiento_NotificacionMotivo",
          "CK_Escalamiento_MotivoEstado",
        ],
      },
      {
        name: "rejects sin_destinatarios on a pending notice",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "pendiente",
            notificacionMotivo: "sin_destinatarios",
          }),
        rejectedBy: ["CK_Escalamiento_MotivoEstado"],
      },
      {
        name: "rejects error_envio on a blocked notice",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "bloqueada",
            notificacionMotivo: "error_envio",
          }),
        rejectedBy: ["CK_Escalamiento_MotivoEstado"],
      },
      {
        name: "rejects a blocked notice without a reason",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "bloqueada",
            notificacionMotivo: null,
          }),
        rejectedBy: ["CK_Escalamiento_MotivoEstado"],
      },
      {
        name: "accepts a sent notice with its time and no reason",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "enviada",
            enviadaEn: LATER,
          }),
      },
      {
        name: "rejects a sent notice without its time",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "enviada",
            enviadaEn: null,
          }),
        rejectedBy: ["CK_Escalamiento_Enviada"],
      },
      {
        name: "rejects a sending time on a notice that was not sent",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "pendiente",
            enviadaEn: LATER,
          }),
        rejectedBy: ["CK_Escalamiento_Enviada"],
      },
      {
        name: "rejects a reason on a sent notice",
        row: async (tx) =>
          suspicion(await request(tx), {
            notificacionEstado: "enviada",
            enviadaEn: LATER,
            notificacionMotivo: "error_envio",
          }),
        rejectedBy: ["CK_Escalamiento_MotivoEstado"],
      },

      // CK_Escalamiento_Reclamo: the claim columns go together
      {
        name: "accepts a claim with its time",
        row: async (tx) =>
          suspicion(await request(tx), {
            reclamoId: "6f0c4d4e-5c1f-4a53-9a55-2f5d2a1c9b11",
            reclamadaEn: LATER,
          }),
      },
      {
        name: "rejects a claim id without its time",
        row: async (tx) =>
          suspicion(await request(tx), {
            reclamoId: "6f0c4d4e-5c1f-4a53-9a55-2f5d2a1c9b11",
            reclamadaEn: null,
          }),
        rejectedBy: ["CK_Escalamiento_Reclamo"],
      },
      {
        name: "rejects a claim time without its id",
        row: async (tx) =>
          suspicion(await request(tx), {
            reclamoId: null,
            reclamadaEn: LATER,
          }),
        rejectedBy: ["CK_Escalamiento_Reclamo"],
      },

      // CK_Escalamiento_Intentos
      {
        name: "accepts zero attempts",
        row: async (tx) => suspicion(await request(tx), { intentos: 0 }),
      },
      {
        name: "rejects a negative attempt count",
        row: async (tx) => suspicion(await request(tx), { intentos: -1 }),
        rejectedBy: ["CK_Escalamiento_Intentos"],
      },
    ];

    // Expected CHECKs: table, then fragments of the definition. Postgres
    // rewrites a CHECK when it stores it (casts, parentheses, `ANY (ARRAY[...])`
    // for `IN`), so the fragments are the column names and literals, which it
    // keeps verbatim, never the whole text.
    const EXPECTED_CHECKS: Record<
      string,
      [table: string, ...fragments: string[]]
    > = {
      CK_Escalamiento_Tipo: [
        "Escalamiento",
        '"Tipo"',
        "sospecha_documento",
        "exceso_inasistencias",
      ],
      CK_Escalamiento_Kind: [
        "Escalamiento",
        '"EstadoPrevio"',
        '"ReporteId"',
        "aprobada",
        "btrim",
      ],
      CK_Escalamiento_Respuesta: [
        "Escalamiento",
        '"RespondidaPorId"',
        '"RespondidaEn"',
        '"CreadoEn"',
      ],
      CK_Escalamiento_SinRespuesta: [
        "Escalamiento",
        "sospecha_documento",
        '"RespondidaEn"',
      ],
      CK_Escalamiento_NotificacionEstado: [
        "Escalamiento",
        '"NotificacionEstado"',
        "pendiente",
        "enviada",
        "bloqueada",
      ],
      CK_Escalamiento_NotificacionMotivo: [
        "Escalamiento",
        '"NotificacionMotivo"',
        "sin_destinatarios",
        "error_envio",
      ],
      CK_Escalamiento_Enviada: [
        "Escalamiento",
        '"NotificacionEstado"',
        '"EnviadaEn"',
      ],
      CK_Escalamiento_MotivoEstado: [
        "Escalamiento",
        '"NotificacionEstado"',
        '"NotificacionMotivo"',
        "bloqueada",
        "sin_destinatarios",
      ],
      CK_Escalamiento_Reclamo: ["Escalamiento", '"ReclamoId"', '"ReclamadaEn"'],
      CK_Escalamiento_Intentos: ["Escalamiento", '"Intentos"', ">= 0"],
      CK_ReporteInasistencia_Nota: ["ReporteInasistencia", '"Nota"', "btrim"],
      CK_Solicitud_PlazoInicio: [
        "Solicitud",
        '"PlazoInicioEn"',
        '"ReenviadaEn"',
        '"PresentadaEn"',
      ],
    };

    describe("CHECK constraints exist in the catalog", () => {
      it("has every expected CHECK on its table, with its definition", async () => {
        const names = Object.keys(EXPECTED_CHECKS);
        const rows = (await db.execute(sql`
          SELECT c.conname AS name,
                 c.conrelid::regclass::text AS tabla,
                 pg_get_constraintdef(c.oid) AS def
          FROM pg_constraint c
          WHERE c.contype = 'c'
            AND c.conname IN (${sql.join(
              names.map((name) => sql`${name}`),
              sql`, `,
            )})
        `)) as unknown as Array<{ name: string; tabla: string; def: string }>;

        const found = new Map(rows.map((row) => [row.name, row]));
        // One expectation, so a dropped CHECK is named in the failure.
        expect(names.filter((name) => !found.has(name))).toEqual([]);

        for (const [name, [table, ...fragments]] of Object.entries(
          EXPECTED_CHECKS,
        )) {
          const row = found.get(name)!;
          // `regclass` quotes mixed-case names and may carry the schema.
          expect(row.tabla.replaceAll('"', "").split(".").pop(), name).toBe(
            table,
          );
          for (const fragment of fragments) {
            expect(row.def, `${name} should contain ${fragment}`).toContain(
              fragment,
            );
          }
        }
      });
    });

    describe("Escalamiento CHECK constraints", () => {
      it.each(CASES)("$name", async ({ row, rejectedBy }) => {
        const outcome = await attempt(async (tx) => {
          await tx.insert(escalamiento).values(await row(tx));
        });

        if (!rejectedBy) {
          expect(outcome).toEqual({ accepted: true });
          return;
        }
        expect(outcome).toMatchObject({
          accepted: false,
          code: CHECK_VIOLATION,
        });
        expect(rejectedBy).toContain(
          (outcome as { constraint?: string }).constraint,
        );
      });
    });

    describe("CK_ReporteInasistencia_Nota", () => {
      it.each([
        ["accepts no note", null, true],
        ["accepts a note with text", "Teacher called on Monday", true],
        ["rejects a blank note", "   ", false],
        ["rejects an empty note", "", false],
      ])("%s", async (_name, nota, accepted) => {
        const outcome = await attempt(async (tx) => {
          const approved = await request(tx, { estado: "aprobada" });
          await report(tx, approved, nota);
        });

        if (accepted) {
          expect(outcome).toEqual({ accepted: true });
        } else {
          expect(outcome).toEqual({
            accepted: false,
            code: CHECK_VIOLATION,
            constraint: "CK_ReporteInasistencia_Nota",
          });
        }
      });
    });

    describe("UX_Escalamiento_Abierto: one open suspicion per request", () => {
      it("rejects a second open suspicion on the same request", async () => {
        const outcome = await attempt(async (tx) => {
          const id = await request(tx);
          await tx.insert(escalamiento).values(suspicion(id));
          await tx.insert(escalamiento).values(suspicion(id));
        });

        expect(outcome).toEqual({
          accepted: false,
          code: UNIQUE_VIOLATION,
          constraint: "UX_Escalamiento_Abierto",
        });
      });

      it("allows a new suspicion once the first one was answered", async () => {
        const outcome = await attempt(async (tx) => {
          const id = await request(tx);
          const [first] = await tx
            .insert(escalamiento)
            .values(suspicion(id))
            .returning({ id: escalamiento.id });
          await tx
            .update(escalamiento)
            .set({
              respuesta: "Reviewed: the certificate is genuine",
              respondidaPorId: secretariaId,
              respondidaEn: LATER,
            })
            .where(eq(escalamiento.id, first.id));
          await tx.insert(escalamiento).values(suspicion(id));
        });

        expect(outcome).toEqual({ accepted: true });
      });

      it("allows an excess-absence notice next to an open suspicion", async () => {
        const outcome = await attempt(async (tx) => {
          const id = await request(tx);
          await tx.insert(escalamiento).values(suspicion(id));
          await tx
            .insert(escalamiento)
            .values(excess(id, await report(tx, id)));
        });

        expect(outcome).toEqual({ accepted: true });
      });

      it("allows suspicions on different requests at the same time", async () => {
        const outcome = await attempt(async (tx) => {
          await tx.insert(escalamiento).values(suspicion(await request(tx)));
          await tx.insert(escalamiento).values(suspicion(await request(tx)));
        });

        expect(outcome).toEqual({ accepted: true });
      });
    });

    describe("CK_Solicitud_PlazoInicio: the stored clock start", () => {
      const REENVIADA = new Date("2026-10-08T15:00:00.000Z");

      it.each([
        ["accepts no stored start", {}, true],
        [
          "accepts a start after the presentation",
          { plazoInicioEn: LATER },
          true,
        ],
        [
          "accepts a start equal to the presentation",
          { plazoInicioEn: PRESENTED },
          true,
        ],
        [
          "rejects a start before the presentation",
          { plazoInicioEn: new Date("2026-10-04T15:00:00.000Z") },
          false,
        ],
        [
          "accepts a start equal to the resubmission",
          { reenviadaEn: REENVIADA, plazoInicioEn: REENVIADA },
          true,
        ],
        [
          "rejects a start between the presentation and the resubmission",
          { reenviadaEn: REENVIADA, plazoInicioEn: LATER },
          false,
        ],
      ])("%s", async (_name, overrides, accepted) => {
        const outcome = await attempt(async (tx) => {
          await request(tx, overrides);
        });

        if (accepted) {
          expect(outcome).toEqual({ accepted: true });
        } else {
          expect(outcome).toEqual({
            accepted: false,
            code: CHECK_VIOLATION,
            constraint: "CK_Solicitud_PlazoInicio",
          });
        }
      });
    });
  },
);
