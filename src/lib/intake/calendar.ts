import { constantCalendar } from "./adapters/constant-calendar";

// Non-working days for the RN-08 clock (SR-5), one explicit ISO list per year
// because Semana Santa moves. Weekends are not listed: the business-day logic
// already skips them.
//
// STATUS: PENDING OWNER VALIDATION (tasks 1.9). Remove this marker only after
// the owner's written "yes". Do not merge S1 with unvalidated data.
//
// Source (to be confirmed by the owner): Codigo del Trabajo de Nicaragua, art.
// 66, national holidays: 1 Jan, Jueves Santo, Viernes Santo, 1 May, 19 Jul,
// 14 Sep, 15 Sep, 8 Dec, 25 Dec. Semana Santa follows Easter Sunday (5 Apr 2026,
// 28 Mar 2027). The Managua local holidays 1 Aug and 10 Aug (Santo Domingo) are
// included because the UAM is in Managua; the owner decides whether the UAM
// observes them, and whether any extra UAM closure must be added. Half days
// (24 and 31 Dec afternoons) are not full non-working days and are not listed.
export const NON_WORKING_DAYS: Readonly<Record<number, readonly string[]>> = {
  2026: [
    "2026-01-01", // Anio Nuevo
    "2026-04-02", // Jueves Santo
    "2026-04-03", // Viernes Santo
    "2026-05-01", // Dia del Trabajo
    "2026-07-19", // Dia de la Revolucion
    "2026-08-01", // Santo Domingo, bajada (Managua)
    "2026-08-10", // Santo Domingo, subida (Managua)
    "2026-09-14", // Batalla de San Jacinto
    "2026-09-15", // Independencia
    "2026-12-08", // Inmaculada Concepcion
    "2026-12-25", // Navidad
  ],
  2027: [
    "2027-01-01", // Anio Nuevo
    "2027-03-25", // Jueves Santo
    "2027-03-26", // Viernes Santo
    "2027-05-01", // Dia del Trabajo
    "2027-07-19", // Dia de la Revolucion
    "2027-08-01", // Santo Domingo, bajada (Managua)
    "2027-08-10", // Santo Domingo, subida (Managua)
    "2027-09-14", // Batalla de San Jacinto
    "2027-09-15", // Independencia
    "2027-12-08", // Inmaculada Concepcion
    "2027-12-25", // Navidad
  ],
};

export const calendar = constantCalendar(NON_WORKING_DAYS);
