import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { PgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";

import { db } from "@/db";
import type { escalamiento, remision } from "@/db/schema";
import type { AuditEvent, RemissionFailureCode } from "@/lib/audit/types";
import { insertAuditEvents } from "@/lib/data/audit";

// The claim, lease and guarded completion that the two mail outboxes share
// (`Remision` in `remision.ts`, `Escalamiento` in `escalamiento.ts`). Each
// module keeps its own states and columns; this holds only what is identical:
// the lease, the claim stamp, the release, the give-back of an unconfigured
// attempt and the single transaction that completes a row while its claim is
// still held (TR-6).

/**
 * How long a claim blocks other attempts. Longer than any function duration,
 * so only a crashed or cut-off attempt is ever taken over.
 */
export const CLAIM_LEASE_MS = 10 * 60 * 1000;

/** Longest provider message id the column holds. */
const PROVIDER_ID_MAX = 100;

type OutboxTable = typeof remision | typeof escalamiento;

/** What a worker holds while it owns a row. */
export type HeldClaim = { id: number; reclamoId: string };

function leaseCutoff(now: Date): Date {
  return new Date(now.getTime() - CLAIM_LEASE_MS);
}

/** True for a row with no claim, or whose claim has expired. */
export function leaseFree(reclamadaEn: PgColumn, now: Date) {
  return or(isNull(reclamadaEn), lt(reclamadaEn, leaseCutoff(now)));
}

/** The columns a claim stamps: a new claim id, the time and one more attempt. */
export function claimStamp(table: OutboxTable, now: Date) {
  return {
    reclamoId: randomUUID(),
    reclamadaEn: now,
    intentos: sql`${table.intentos} + 1`,
    actualizadaEn: now,
  };
}

/** The claim is always released by a completion. */
export function claimRelease(now: Date) {
  return { reclamoId: null, reclamadaEn: null, actualizadaEn: now };
}

/** The send time and the provider id, cut to the column. */
export function sentStamp(providerId: string, now: Date) {
  return {
    enviadaEn: now,
    proveedorMensajeId: providerId.slice(0, PROVIDER_ID_MAX),
  };
}

/**
 * When the mail service is not configured yet the attempt is given back: rows
 * wait for the keys without exhausting the automatic-retry cap before the
 * first send.
 */
export function attemptGivenBack(
  table: OutboxTable,
  codigo: RemissionFailureCode,
) {
  return codigo === "not_configured"
    ? { intentos: sql`greatest(${table.intentos} - 1, 0)` }
    : {};
}

/** Matches the row only while this attempt still holds its claim. */
export function heldBy(table: OutboxTable, claim: HeldClaim) {
  return and(eq(table.id, claim.id), eq(table.reclamoId, claim.reclamoId));
}

/**
 * Applies one guarded completion and its audit row in a single transaction. A
 * worker whose lease was taken over matches no row, writes nothing and reports
 * `false`.
 */
export function completeHeld<T extends OutboxTable>(
  table: T,
  claim: HeldClaim,
  actorId: number,
  set: PgUpdateSetSource<T>,
  event: AuditEvent,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(table)
      .set(set)
      .where(heldBy(table, claim))
      .returning({ id: table.id });
    if (updated.length === 0) return false;
    await insertAuditEvents(tx, actorId, [event]);
    return true;
  });
}
