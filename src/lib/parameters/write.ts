import "server-only";

import { sql } from "drizzle-orm";

import { parametroNormativo } from "@/db/schema";
import type { Transaction } from "@/lib/data/audit";

import { readInForce } from "./loader";
import {
  PARAMETER_REGISTRY,
  resolveParameters,
  type AppliedChange,
  type NormativeParameters,
  type ParameterChange,
  type ParameterKey,
  type ParameterWriteResult,
} from "./registry";

export type { AppliedChange, ParameterChange, ParameterWriteResult };

// The guarded write path of the normative parameters (RNF-14, NP-2, NP-3, NP-9).
// It runs on the transaction `withCatalogWrite` opens, after the catalog write
// lock and before the audit insert, so the lock, the busy mapping and the audit
// row belong to the caller (design A6, A9, A16). Never deletes a row: a save is
// one upsert per changed key, dated today in Managua.

/** Keys sorted at every depth, so two equal values give the same text. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item !== null && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : item,
  );
}

function isRegistered(clave: string): clave is ParameterKey {
  return Object.hasOwn(PARAMETER_REGISTRY, clave);
}

const ALERT_KEYS: readonly ParameterKey[] = [
  "alerta_dias",
  "plazo_remision_dias",
];

/**
 * Applies the changes on `tx`. The effective values are read first (the stored
 * value, or the default when no valid row is in force); each change is
 * re-validated with its schema, the alert is checked against the remission
 * deadline on the merged values, and a value equal to the one in force is
 * dropped. `today` is the Managua date of the request and the only date this
 * function writes, so no row is ever dated in the future.
 */
export async function writeParameters(
  tx: Transaction,
  changes: readonly ParameterChange[],
  today: string,
): Promise<ParameterWriteResult> {
  const { values } = resolveParameters(await readInForce(tx, today));

  const validated: AppliedChange[] = [];
  for (const { clave, valor } of changes) {
    if (!isRegistered(clave)) {
      return { kind: "invalid", clave, reason: "schema" };
    }
    const { field, schema } = PARAMETER_REGISTRY[clave];
    const parsed = schema.safeParse(valor);
    if (!parsed.success) {
      return { kind: "invalid", clave, reason: "schema" };
    }
    validated.push({ clave, antes: values[field], despues: parsed.data });
  }

  if (validated.some((change) => ALERT_KEYS.includes(change.clave))) {
    const merged: NormativeParameters = { ...values };
    for (const { clave, despues } of validated) {
      Object.assign(merged, { [PARAMETER_REGISTRY[clave].field]: despues });
    }
    if (merged.alertBusinessDays >= merged.remissionBusinessDays) {
      const clave = validated.some((change) => change.clave === "alerta_dias")
        ? "alerta_dias"
        : "plazo_remision_dias";
      return { kind: "invalid", clave, reason: "alert_not_below_remission" };
    }
  }

  const applied = validated.filter(
    (change) => canonicalJson(change.antes) !== canonicalJson(change.despues),
  );
  for (const { clave, despues } of applied) {
    await tx
      .insert(parametroNormativo)
      .values({ clave, valor: despues, vigenteDesde: today })
      .onConflictDoUpdate({
        target: [parametroNormativo.clave, parametroNormativo.vigenteDesde],
        set: { valor: sql`excluded."Valor"` },
      });
  }

  return applied.length === 0
    ? { kind: "unchanged" }
    : { kind: "updated", changes: applied };
}
