import type { GroupScheduleProvider } from "../ports";

/**
 * Temporary adapter (D5): until a real schedule exists, every group is treated
 * as having class on every date, so dates never filter subjects. This is a
 * flagged gap (RN-22); a weekday adapter over `Grupo.Dias` replaces it later.
 */
export const permissiveSchedule: GroupScheduleProvider = {
  async groupsWithClass(grupoIds) {
    return new Set(grupoIds);
  },
};
