import { eq, notInArray, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { parametroNormativo } from "@/db/schema";
import {
  PARAMETER_KEYS,
  PARAMETER_REGISTRY,
  type ParameterKey,
} from "@/lib/parameters/registry";

// Fixtures of the Postgres suite of the normative parameters. Not a test file:
// `*.integration.test.ts` is the only pattern the integration config collects.

/** The date the migration gives the nine seed rows (drizzle/0017). */
export const SEED_DATE = "2026-01-01";

/** SQLSTATEs the suite expects from the database. */
export const UNIQUE_VIOLATION = "23505";
export const STRING_TOO_LONG = "22001";

/** The stored value of a key as the migration seeds it: its code default. */
export function seedValue(key: ParameterKey): unknown {
  return PARAMETER_REGISTRY[key].default;
}

/** One row of `ParametroNormativo`, inserted as given (no validation). */
export async function putRow(
  clave: string,
  valor: unknown,
  vigenteDesde: string,
): Promise<void> {
  await db.insert(parametroNormativo).values({ clave, valor, vigenteDesde });
}

/** Delete every row of a key, the seed row included. */
export async function dropKey(clave: string): Promise<void> {
  await db
    .delete(parametroNormativo)
    .where(eq(parametroNormativo.clave, clave));
}

/**
 * Back to the seeded state: every row dated after the seed date goes, every row
 * of a key outside the registry goes, and a seed row that a case deleted comes
 * back with its code default. A seed row that is still there is never
 * overwritten, so the first case still proves what the migration really stored.
 * Audit rows are not touched (they are append-only).
 */
export async function restoreSeeds(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(parametroNormativo)
      .where(
        or(
          ne(parametroNormativo.vigenteDesde, SEED_DATE),
          notInArray(parametroNormativo.clave, [...PARAMETER_KEYS]),
        ),
      );
    await tx
      .insert(parametroNormativo)
      .values(
        PARAMETER_KEYS.map((clave) => ({
          clave,
          valor: seedValue(clave),
          vigenteDesde: SEED_DATE,
        })),
      )
      .onConflictDoNothing({
        target: [parametroNormativo.clave, parametroNormativo.vigenteDesde],
      });
  });
}

/** SQLSTATE and constraint of a database error, read through `cause`. */
export function databaseError(error: unknown): {
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

/** Run `work` and return the database error it raises; fails if it succeeds. */
export async function refusal(
  work: () => Promise<unknown>,
): Promise<{ code: string; constraint: string | undefined }> {
  try {
    await work();
  } catch (error) {
    return databaseError(error);
  }
  throw new Error(
    "The database accepted a row the suite expected it to refuse",
  );
}
