// The per-row loop both mail outboxes share (RNF-07 a): rows are dispatched one
// after another, a row that blows up is logged by code only (never a message,
// which could carry an address) and the rest still run. No database import, so
// the dispatchers stay testable with their data modules mocked.

export type DispatchSummary = {
  sent: number;
  failed: number;
  blocked: number;
  skipped: number;
  lost: number;
  errored: number;
};

export function emptySummary(): DispatchSummary {
  return { sent: 0, failed: 0, blocked: 0, skipped: 0, lost: 0, errored: 0 };
}

export async function dispatchEach(
  ids: readonly number[],
  dispatchOne: (id: number) => Promise<{ outcome: keyof DispatchSummary }>,
  failure: { event: string; idKey: string },
): Promise<DispatchSummary> {
  const summary = emptySummary();
  for (const id of ids) {
    try {
      const result = await dispatchOne(id);
      summary[result.outcome] += 1;
    } catch (error) {
      summary.errored += 1;
      console.error(failure.event, {
        [failure.idKey]: id,
        code: error instanceof Error ? error.name : "unknown",
      });
    }
  }
  return summary;
}
