import { constantCalendar } from "./adapters/constant-calendar";

// Non-working days for the RN-08 clock (SR-5), one explicit ISO list per year
// because Semana Santa moves. Weekends are not listed: the business-day logic
// already skips them.
//
// STATUS: VALIDATED BY THE OWNER on 2026-10-12 against the UAM academic
// calendar ("Dias feriados"), which closes the whole Semana Santa and observes
// Dia de las Madres and the Managua local holidays.
//
// Sources: UAM academic calendar (Semana Santa Monday to Friday, 1 May, 30 May,
// 19 Jul, 1 and 10 Aug, 14 and 15 Sep, 8 Dec) plus the national holidays of the
// Codigo del Trabajo, art. 66, that fall in vacations (1 Jan, 25 Dec). Semana
// Santa follows Easter Sunday (5 Apr 2026, 28 Mar 2027). Half days (24 and 31
// Dec afternoons) are not full non-working days and are not listed. Add each
// new year before it starts: the staleness test fails otherwise.
export const NON_WORKING_DAYS: Readonly<Record<number, readonly string[]>> = {
  2026: [
    "2026-01-01", // Anio Nuevo
    "2026-03-30", // Semana Santa
    "2026-03-31", // Semana Santa
    "2026-04-01", // Semana Santa
    "2026-04-02", // Semana Santa
    "2026-04-03", // Semana Santa
    "2026-05-01", // Dia del Trabajo
    "2026-05-30", // Dia de las Madres
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
    "2027-03-22", // Semana Santa
    "2027-03-23", // Semana Santa
    "2027-03-24", // Semana Santa
    "2027-03-25", // Semana Santa
    "2027-03-26", // Semana Santa
    "2027-05-01", // Dia del Trabajo
    "2027-05-30", // Dia de las Madres
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
