import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// One ordered log of everything the transaction sees: raw statements issued
// through `tx.execute`, work markers and audit inserts.
const log: string[] = [];
const auditCalls: { tx: unknown; actorId: number; events: unknown[] }[] = [];
const handles: unknown[] = [];
let transactionCount = 0;
let auditFailure: unknown = null;

const dialect = new PgDialect();

const tx = {
  execute(statement: SQL) {
    log.push(dialect.sqlToQuery(statement).sql);
    return Promise.resolve();
  },
};

vi.mock("@/db", () => ({
  db: {
    transaction: async (callback: (handle: unknown) => Promise<unknown>) => {
      transactionCount += 1;
      handles.push(tx);
      return callback(tx);
    },
  },
}));

vi.mock("@/lib/data/audit", () => ({
  insertAuditEvents: async (
    handle: unknown,
    actorId: number,
    events: unknown[],
  ) => {
    log.push("audit");
    auditCalls.push({ tx: handle, actorId, events });
    if (auditFailure) throw auditFailure;
  },
}));

import type { AuditEvent } from "@/lib/audit/types";
import {
  CATALOG_LOCK_TIMEOUT,
  CATALOG_WRITE_LOCK_KEY,
  CatalogBusyError,
  acquireCatalogWriteLock,
  logCatalogFailure,
  withCatalogWrite,
} from "@/lib/data/catalog-write";

const EVENT = {
  accion: "asignatura.creada",
  entidadTipo: "Asignatura",
  entidadId: 5,
  datos: { origen: "manual", campos: ["codigo"] },
} as unknown as AuditEvent;

beforeEach(() => {
  log.length = 0;
  auditCalls.length = 0;
  handles.length = 0;
  transactionCount = 0;
  auditFailure = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("constants", () => {
  it("pin the key and the timeout proven by gate G6", () => {
    expect(CATALOG_WRITE_LOCK_KEY).toBe(5_005_001);
    expect(CATALOG_LOCK_TIMEOUT).toBe("5s");
  });
});

describe("acquireCatalogWriteLock", () => {
  it("sets the local timeout, then takes the advisory lock", async () => {
    await acquireCatalogWriteLock(tx as never);
    expect(log).toEqual([
      "SET LOCAL lock_timeout = '5s'",
      "SELECT pg_advisory_xact_lock(5005001)",
    ]);
  });
});

describe("withCatalogWrite", () => {
  it("opens one transaction and runs work only after the lock", async () => {
    const work = vi.fn(async () => {
      log.push("work");
      return "result";
    });
    const result = await withCatalogWrite(9, work, () => [EVENT]);

    expect(result).toBe("result");
    expect(transactionCount).toBe(1);
    expect(log.slice(0, 3)).toEqual([
      "SET LOCAL lock_timeout = '5s'",
      "SELECT pg_advisory_xact_lock(5005001)",
      "work",
    ]);
    expect(work).toHaveBeenCalledWith(tx);
  });

  it("writes the audit rows last, on the same handle, for the session actor", async () => {
    await withCatalogWrite(
      9,
      async () => {
        log.push("work");
        return 41;
      },
      (r) => {
        expect(r).toBe(41);
        return [EVENT];
      },
    );

    expect(log[log.length - 1]).toBe("audit");
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0].tx).toBe(handles[0]);
    expect(auditCalls[0].actorId).toBe(9);
    expect(auditCalls[0].events).toEqual([EVENT]);
  });

  it("inserts nothing when there are no events (refusal or no-op)", async () => {
    const result = await withCatalogWrite(
      9,
      async () => ({ kind: "unchanged" }),
      () => [],
    );
    expect(result).toEqual({ kind: "unchanged" });
    expect(auditCalls).toHaveLength(0);
    expect(log).not.toContain("audit");
  });

  it("rethrows a work failure without an audit insert and logs one sanitised line", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = Object.assign(new TypeError("secret value 123"), {
      cause: { code: "23505" },
    });

    await expect(
      withCatalogWrite(
        9,
        async () => {
          throw failure;
        },
        () => [EVENT],
      ),
    ).rejects.toBe(failure);

    expect(auditCalls).toHaveLength(0);
    expect(logger).toHaveBeenCalledTimes(1);
    const line = String(logger.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({
      event: "catalog.write.failed",
      actor: 9,
      errorName: "TypeError",
      errorCode: "23505",
    });
    expect(line).not.toContain("secret");
  });

  it("propagates an audit-insert failure so the data write rolls back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    auditFailure = new Error("audit down");

    await expect(
      withCatalogWrite(
        9,
        async () => 1,
        () => [EVENT],
      ),
    ).rejects.toBe(auditFailure);
  });

  it.each([
    [
      "error.cause.code",
      Object.assign(new Error("x"), { cause: { code: "55P03" } }),
    ],
    ["error.code", Object.assign(new Error("x"), { code: "55P03" })],
  ])("maps 55P03 read from %s to CatalogBusyError", async (_label, error) => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      withCatalogWrite(
        9,
        async () => {
          throw error;
        },
        () => [EVENT],
      ),
    ).rejects.toBeInstanceOf(CatalogBusyError);

    expect(auditCalls).toHaveLength(0);
    expect(logger).not.toHaveBeenCalled();
  });

  it("maps a lock timeout raised while acquiring the lock", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const busy = Object.assign(new Error("canceling statement"), {
      cause: { code: "55P03" },
    });
    const original = tx.execute;
    tx.execute = () => Promise.reject(busy);
    const work = vi.fn();
    try {
      await expect(
        withCatalogWrite(9, work, () => [EVENT]),
      ).rejects.toBeInstanceOf(CatalogBusyError);
    } finally {
      tx.execute = original;
    }
    expect(work).not.toHaveBeenCalled();
  });
});

describe("logCatalogFailure", () => {
  it("emits no message, stack or values", () => {
    const logger = vi.fn();
    logCatalogFailure(
      { actor: 3, error: new Error("password=hunter2") },
      logger,
    );
    const line = String(logger.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({
      event: "catalog.write.failed",
      actor: 3,
      errorName: "Error",
    });
    expect(line).not.toContain("hunter2");
  });
});
