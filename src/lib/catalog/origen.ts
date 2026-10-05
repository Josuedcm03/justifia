/**
 * How a `Grupo` row was created (catalog-management, AC-ORIG). Set once at
 * creation and never rewritten. Pure: no imports, safe for client and server.
 * The same list backs the `CK_Grupo_Origen` check in `src/db/schema.ts`.
 */
export const GRUPO_ORIGENES = ["importacion", "manual"] as const;
export type GrupoOrigen = (typeof GRUPO_ORIGENES)[number];
