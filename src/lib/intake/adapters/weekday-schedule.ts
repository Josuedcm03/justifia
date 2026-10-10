import { hasClassInRange } from "../schedule";
import type { GroupScheduleProvider } from "../ports";

/**
 * Weekday adapter over `Grupo."Dias"` (F.4, RN-22): a group has class when any
 * date of the inclusive range falls on one of its meeting days. Days not
 * recorded (mask 0) count as having class. The mask read is injected so the
 * adapter stays free of the database; `getIntakeDeps` passes the data layer.
 */
export function createWeekdaySchedule(
  loadDias: (
    grupoIds: readonly number[],
  ) => Promise<readonly { id: number; dias: number }[]>,
): GroupScheduleProvider {
  return {
    async groupsWithClass(grupoIds, range) {
      if (grupoIds.length === 0) return new Set<number>();
      const rows = await loadDias(grupoIds);
      return new Set(
        rows.filter((row) => hasClassInRange(row.dias, range)).map((r) => r.id),
      );
    },
  };
}
