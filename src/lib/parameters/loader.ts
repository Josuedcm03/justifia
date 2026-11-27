import "server-only";

import { asc, desc, lte } from "drizzle-orm";
import { cache } from "react";

import { db } from "@/db";
import { parametroNormativo } from "@/db/schema";
import type { CatalogExecutor } from "@/lib/data/catalog";
import { managuaToday } from "@/lib/intake/dates";

import {
  DEFAULT_PARAMETERS,
  PARAMETER_KEYS,
  PARAMETER_REGISTRY,
  resolveParameters,
  type NormativeParameters,
  type ParameterKey,
} from "./registry";

// The fail-soft loader of the normative parameters (RNF-14, NP-4, NP-5). One
// round trip reads the newest row of each key that is in force today; each key
// is then validated on its own, so one bad value never changes another key and
// never falls back to an older row. Nothing is kept between two requests: the
// only deduplication is React `cache()` inside one render (design A4), a
// pass-through in actions and route handlers. No role check (NP-6): consumers
// are not gated. Never call it at module scope.

/** Anything that can run a `select`: the `db` singleton or a transaction. */
export type Executor = CatalogExecutor;

export type ParametersRead = {
  values: NormativeParameters;
  /** The keys that took their default: no row in force, or an invalid one. */
  fallback: readonly ParameterKey[];
  /** True when the whole read failed and every key is a default. */
  degraded: boolean;
};

/**
 * The newest row per key with `VigenteDesde` not after `today`, as stored: the
 * values are not validated here. One `DISTINCT ON ("Clave")` statement, served
 * by the unique index of (`Clave`, `VigenteDesde`) (design A3).
 */
export async function readInForce(
  exec: Executor,
  today: string,
): Promise<{ clave: string; valor: unknown }[]> {
  return exec
    .selectDistinctOn([parametroNormativo.clave], {
      clave: parametroNormativo.clave,
      valor: parametroNormativo.valor,
    })
    .from(parametroNormativo)
    .where(lte(parametroNormativo.vigenteDesde, today))
    .orderBy(
      asc(parametroNormativo.clave),
      desc(parametroNormativo.vigenteDesde),
    );
}

/**
 * One sanitised line, shaped like `logCatalogFailure`: an event name, the key
 * and a code. The code is never derived from a stored value, so the line cannot
 * carry one (NP-4).
 */
function logFallback(fields: Record<string, string>): void {
  console.error(JSON.stringify(fields));
}

/** Why a key fell back: a Zod issue code, or `no_row`; never the value. */
function fallbackCode(
  rows: readonly { clave: string; valor: unknown }[],
  key: ParameterKey,
): string {
  const row = rows.find((candidate) => candidate.clave === key);
  if (row === undefined) return "no_row";
  const issue = PARAMETER_REGISTRY[key].schema.safeParse(row.valor).error
    ?.issues[0];
  return issue?.code ?? "invalid";
}

/**
 * Every key of the registry with the value in force at `now` (Managua date),
 * or its default. Never throws: a failed read returns every default as
 * `degraded` and logs the error name only.
 */
export async function loadNormativeParameters(
  now: Date,
): Promise<ParametersRead> {
  let rows: { clave: string; valor: unknown }[];
  try {
    rows = await readInForce(db, managuaToday(now));
  } catch (error) {
    logFallback({
      event: "parameters_read_failed",
      code: error instanceof Error ? error.name : typeof error,
    });
    return {
      values: DEFAULT_PARAMETERS,
      fallback: PARAMETER_KEYS,
      degraded: true,
    };
  }

  const { values, fallback } = resolveParameters(rows);
  for (const key of fallback) {
    logFallback({
      event: "parameter_invalid",
      clave: key,
      code: fallbackCode(rows, key),
    });
  }
  return { values, fallback, degraded: false };
}

/**
 * The parameters of this request. `cache()` shares one read between the
 * consumers of one render (NP-5); every other call reads again, so a saved
 * value is seen by the next request of any instance (NP-14).
 */
export const getNormativeParameters = cache((): Promise<ParametersRead> =>
  loadNormativeParameters(new Date()),
);
