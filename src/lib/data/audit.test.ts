import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: {} }));

import { db } from "@/db";
import { eventoAuditoria } from "@/db/audit-schema";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";
import { buildAuditEvents } from "@/lib/audit/events";
import { WRITE_CHUNK_ROWS } from "@/lib/import/limits";
import type { ImportSummary } from "@/lib/import/types";
import type { AuditEvent } from "@/lib/audit/types";

type Statement = { table: unknown; values: Record<string, unknown>[] };

/** Recording `tx` double: each insert is one statement. */
function makeTx() {
  const statements: Statement[] = [];
  const tx = {
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>[]) {
          statements.push({ table, values });
          return Promise.resolve();
        },
      };
    },
  };
  return { tx: tx as unknown as Transaction, statements };
}

const zero = { create: 0, update: 0, unchanged: 0, deactivate: 0, error: 0 };
const summary: ImportSummary = {
  actor: "secretaria1",
  at: "2026-10-03T00:00:00.000Z",
  fileSha256: "a".repeat(64),
  counts: { Asignatura: zero, Usuario: zero, Grupo: zero },
  accountsCreated: 0,
  accountsUpdated: 0,
  asignaturasReactivated: 0,
  manualGruposDeactivated: 0,
};

const accountEvents = (n: number): AuditEvent[] =>
  buildAuditEvents(
    summary,
    Array.from({ length: n }, (_, i) => ({
      usuarioId: i + 1,
      rol: "docente" as const,
      kind: "creado" as const,
      campos: [],
    })),
  );

describe("insertAuditEvents (AL: Audit record content)", () => {
  it("writes one row per event mapping the event fields", async () => {
    const { tx, statements } = makeTx();
    const events = accountEvents(2);
    await insertAuditEvents(tx, 7, events);

    expect(statements).toHaveLength(1);
    expect(statements[0].table).toBe(eventoAuditoria);
    expect(statements[0].values).toHaveLength(3);
    statements[0].values.forEach((v, i) => {
      expect(v.accion).toBe(events[i].accion);
      expect(v.entidadTipo).toBe(events[i].entidadTipo);
      expect(v.entidadId).toBe(events[i].entidadId);
      expect(v.datos).toBe(events[i].datos);
    });
  });

  it("takes the actor from the parameter (Actor comes from the session)", async () => {
    const { tx, statements } = makeTx();
    await insertAuditEvents(tx, 42, accountEvents(2));
    for (const v of statements[0].values) expect(v.actorId).toBe(42);
  });

  it("never sets OcurridoEn or Id: the column default is the clock", async () => {
    const { tx, statements } = makeTx();
    await insertAuditEvents(tx, 1, accountEvents(1));
    for (const v of statements[0].values) {
      expect(Object.keys(v)).not.toContain("ocurridoEn");
      expect(Object.keys(v)).not.toContain("id");
    }
  });

  it("keeps the import event's entidadId as null", async () => {
    const { tx, statements } = makeTx();
    await insertAuditEvents(tx, 1, buildAuditEvents(summary, []));
    expect(statements[0].values[0].entidadId).toBeNull();
  });

  it("chunks at WRITE_CHUNK_ROWS: 1 001 events -> 3 statements, order kept", async () => {
    const { tx, statements } = makeTx();
    const events = accountEvents(1_000); // + the import event = 1 001
    await insertAuditEvents(tx, 1, events.slice(0, WRITE_CHUNK_ROWS * 2 + 1));
    expect(statements.map((s) => s.values.length)).toEqual([
      WRITE_CHUNK_ROWS,
      WRITE_CHUNK_ROWS,
      1,
    ]);
    const ids = statements.flatMap((s) => s.values.map((v) => v.entidadId));
    expect(ids).toEqual(
      events.slice(0, WRITE_CHUNK_ROWS * 2 + 1).map((e) => e.entidadId),
    );
  });

  it("issues no statement for an empty list", async () => {
    const { tx, statements } = makeTx();
    await insertAuditEvents(tx, 1, []);
    expect(statements).toHaveLength(0);
  });

  it("is typed on the transaction handle: the db singleton is rejected", () => {
    // Never invoked: `@ts-expect-error` is checked by `npm run typecheck`.
    const neverCalled = () =>
      // @ts-expect-error - `db` is not a transaction (decision 23)
      insertAuditEvents(db, 1, []);
    expect(neverCalled).toBeTypeOf("function");
  });
});
