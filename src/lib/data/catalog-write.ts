import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { AuditEvent } from "@/lib/audit/types";
import { insertAuditEvents, type Transaction } from "@/lib/data/audit";

/**
 * The single place a catalog write transaction is opened (design Decision 4).
 * One advisory lock serialises every manual catalog writer, so "count active
 * Grupos, then deactivate the Asignatura" and "check the parents are active,
 * then insert the Grupo" cannot interleave under READ COMMITTED. The mechanism
 * (`SET LOCAL lock_timeout` + `pg_advisory_xact_lock`, SQLSTATE `55P03` on
 * timeout) was proven through the pooled host with prepared statements on by
 * gate G6; changing it is a design change.
 */
export const CATALOG_WRITE_LOCK_KEY = 5_005_001;
export const CATALOG_LOCK_TIMEOUT = "5s";

/** SQLSTATE `lock_not_available`: the bounded wait for the lock expired. */
const LOCK_NOT_AVAILABLE = "55P03";

/** The lock could not be taken within `CATALOG_LOCK_TIMEOUT`; retry later. */
export class CatalogBusyError extends Error {
  constructor() {
    super("catalog write busy");
    this.name = "CatalogBusyError";
  }
}

/**
 * Must be the first two statements of the transaction. Both are literal SQL
 * built from constants (never user input): `SET LOCAL` takes no parameters,
 * and the lock call is kept in the exact form G6 proved.
 */
export async function acquireCatalogWriteLock(tx: Transaction): Promise<void> {
  await tx.execute(
    sql.raw(`SET LOCAL lock_timeout = '${CATALOG_LOCK_TIMEOUT}'`),
  );
  await tx.execute(
    sql.raw(`SELECT pg_advisory_xact_lock(${CATALOG_WRITE_LOCK_KEY})`),
  );
}

function stringCode(value: unknown): string | undefined {
  const code = (value as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code : undefined;
}

/** SQLSTATE of a driver error: own `code`, else `cause.code` (R6). */
export function sqlStateOf(error: unknown): string | undefined {
  return (
    stringCode(error) ??
    stringCode((error as { cause?: unknown } | null | undefined)?.cause)
  );
}

export type CatalogFailure = { actor: number; error: unknown };

/**
 * One sanitised line for an unexpected catalog write failure, shaped like
 * `logImportFailure`: actor, error name and SQLSTATE only. No message, stack,
 * query or parameters ever reach the line.
 */
export function logCatalogFailure(
  { actor, error }: CatalogFailure,
  logger: (line: string) => void = console.error,
): void {
  const errorCode = sqlStateOf(error);
  logger(
    JSON.stringify({
      event: "catalog.write.failed",
      actor,
      errorName: error instanceof Error ? error.name : typeof error,
      ...(errorCode === undefined ? {} : { errorCode }),
    }),
  );
}

/**
 * Runs `work` and its audit rows in one transaction, after the lock. `work`
 * returns a result; `toEvents` turns it into zero or more audit events, and an
 * empty list (refusal, no-op) inserts nothing. The audit insert uses the same
 * handle and is the last statement, so a failure on either side rolls back
 * both. `actorId` comes from the session, never from an event.
 */
export async function withCatalogWrite<R>(
  actorId: number,
  work: (tx: Transaction) => Promise<R>,
  toEvents: (result: R) => readonly AuditEvent[],
): Promise<R> {
  try {
    return await db.transaction(async (tx) => {
      await acquireCatalogWriteLock(tx);
      const result = await work(tx);
      const events = toEvents(result);
      if (events.length > 0) {
        await insertAuditEvents(tx, actorId, events);
      }
      return result;
    });
  } catch (error) {
    if (sqlStateOf(error) === LOCK_NOT_AVAILABLE) {
      throw new CatalogBusyError();
    }
    logCatalogFailure({ actor: actorId, error });
    throw error;
  }
}
