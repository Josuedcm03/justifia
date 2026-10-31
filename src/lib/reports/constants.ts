import type { EstadoSolicitud } from "@/lib/intake/states";

// Coordination reports (coordination-reports, CR-RANK-1, CR-RANK-3, CR-DET-3).
// Pure: no db, no Next, no React.

/** Entries kept per ranking; a tie at the cut is cut, not expanded (CR-4). */
export const RANKING_LIMIT = 10;

/**
 * The only states a ranking counts (RF-17 c, RN-16): approved and pending.
 * Both are visible states, so a draft can never reach a figure.
 */
export const RANKING_STATES: readonly EstadoSolicitud[] = [
  "aprobada",
  "pendiente",
];

/** Rows per page of the request detail (slice 2). */
export const REPORT_PAGE_SIZE = 25;
