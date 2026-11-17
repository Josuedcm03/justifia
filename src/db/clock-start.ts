import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// The RN-08 effective clock start as one SQL fragment (ES-5):
// `coalesce(PlazoInicioEn, ReenviadaEn, PresentadaEn)`. The `IX_Solicitud_Cola`
// index in the schema and the review queue ordering are both built from this
// function, so the planner sees the identical expression. It takes the table
// columns instead of importing the table, which would be a cycle with the
// schema.
export function effectiveClockStart(columns: {
  plazoInicioEn: AnyPgColumn;
  reenviadaEn: AnyPgColumn;
  presentadaEn: AnyPgColumn;
}): SQL {
  return sql`coalesce(${columns.plazoInicioEn}, ${columns.reenviadaEn}, ${columns.presentadaEn})`;
}
