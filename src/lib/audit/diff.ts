// src/lib/audit/diff.ts — PURE. Compares two records over a CLOSED field list
// and returns field NAMES only. The return type is the name union, so no value
// can leave this function (RNF-05, AL-PAY): a field not on the list can never
// be reported as changed.

export function changedFields<F extends string>(
  fields: readonly F[],
  before: Record<F, unknown>,
  after: Record<F, unknown>,
): F[] {
  return fields.filter((field) => !Object.is(before[field], after[field]));
}
