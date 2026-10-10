import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { grupo } from "@/db/schema";

/** Meeting-day mask of a group (`Grupo."Dias"`, see `catalog/dias.ts`). */
export type GrupoDias = { id: number; dias: number };

/**
 * Day masks of the given groups, read for the weekday schedule adapter
 * (RN-22). Fails loud: the submit re-check relies on it.
 */
export async function listGrupoDias(
  grupoIds: readonly number[],
): Promise<GrupoDias[]> {
  if (grupoIds.length === 0) return [];
  return db
    .select({ id: grupo.id, dias: grupo.dias })
    .from(grupo)
    .where(inArray(grupo.id, [...grupoIds]));
}
