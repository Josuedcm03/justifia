import type { NonWorkingDay } from "./registry";

// The default calendar of non-working days for the RN-08 clock (SR-5): the
// registry default of the key `calendario` and the value its migration seeds
// (NP-10, NP-16). Weekends are not listed: the business-day logic already skips
// them. One entry per date because Semana Santa moves.
//
// STATUS: VALIDATED BY THE OWNER on 2026-10-12 against the UAM academic
// calendar ("Dias feriados"), which closes the whole Semana Santa and observes
// Dia de las Madres and the Managua local holidays. Moved here, descriptions
// included, from `src/lib/intake/calendar.ts`.
//
// Sources: UAM academic calendar (Semana Santa Monday to Friday, 1 May, 30 May,
// 19 Jul, 1 and 10 Aug, 14 and 15 Sep, 8 Dec) plus the national holidays of the
// Codigo del Trabajo, art. 66, that fall in vacations (1 Jan, 25 Dec). Semana
// Santa follows Easter Sunday (5 Apr 2026, 28 Mar 2027). Half days (24 and 31
// Dec afternoons) are not full non-working days and are not listed. From the
// loader on, the secretaria keeps the list current from the parameters screen.
//
// The descriptions are ASCII on purpose: they travel inside the seed SQL.
export const DEFAULT_NON_WORKING_DAYS: readonly NonWorkingDay[] = [
  { fecha: "2026-01-01", descripcion: "Anio Nuevo" },
  { fecha: "2026-03-30", descripcion: "Semana Santa" },
  { fecha: "2026-03-31", descripcion: "Semana Santa" },
  { fecha: "2026-04-01", descripcion: "Semana Santa" },
  { fecha: "2026-04-02", descripcion: "Semana Santa" },
  { fecha: "2026-04-03", descripcion: "Semana Santa" },
  { fecha: "2026-05-01", descripcion: "Dia del Trabajo" },
  { fecha: "2026-05-30", descripcion: "Dia de las Madres" },
  { fecha: "2026-07-19", descripcion: "Dia de la Revolucion" },
  { fecha: "2026-08-01", descripcion: "Santo Domingo, bajada (Managua)" },
  { fecha: "2026-08-10", descripcion: "Santo Domingo, subida (Managua)" },
  { fecha: "2026-09-14", descripcion: "Batalla de San Jacinto" },
  { fecha: "2026-09-15", descripcion: "Independencia" },
  { fecha: "2026-12-08", descripcion: "Inmaculada Concepcion" },
  { fecha: "2026-12-25", descripcion: "Navidad" },
  { fecha: "2027-01-01", descripcion: "Anio Nuevo" },
  { fecha: "2027-03-22", descripcion: "Semana Santa" },
  { fecha: "2027-03-23", descripcion: "Semana Santa" },
  { fecha: "2027-03-24", descripcion: "Semana Santa" },
  { fecha: "2027-03-25", descripcion: "Semana Santa" },
  { fecha: "2027-03-26", descripcion: "Semana Santa" },
  { fecha: "2027-05-01", descripcion: "Dia del Trabajo" },
  { fecha: "2027-05-30", descripcion: "Dia de las Madres" },
  { fecha: "2027-07-19", descripcion: "Dia de la Revolucion" },
  { fecha: "2027-08-01", descripcion: "Santo Domingo, bajada (Managua)" },
  { fecha: "2027-08-10", descripcion: "Santo Domingo, subida (Managua)" },
  { fecha: "2027-09-14", descripcion: "Batalla de San Jacinto" },
  { fecha: "2027-09-15", descripcion: "Independencia" },
  { fecha: "2027-12-08", descripcion: "Inmaculada Concepcion" },
  { fecha: "2027-12-25", descripcion: "Navidad" },
];
