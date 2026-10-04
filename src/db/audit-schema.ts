import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { usuario } from "./schema";

/**
 * EventoAuditoria - append-only audit log (design decisions 18, 26).
 *
 * NOT imported by `src/db/schema.ts`, so drizzle-kit never sees it (F7: it would
 * propose dropping the child partitions). This declaration produces NO DDL:
 * `drizzle/0004_audit_log.sql` is the only definition of the table. Everything
 * here exists to type `db.insert(eventoAuditoria)`. Keep the two in sync BY
 * REVIEW; `audit-schema.test.ts` links their column lists.
 *
 * TODO(WU2b-1): narrow `accion`, `entidadTipo` and `datos` to the closed
 * `AuditAction`, `AuditEntityType` and `AuditEvent["datos"]` types once
 * `src/lib/audit/types.ts` exists.
 *
 * Identity form of "Id": rehearsal probe S1 (PostgreSQL 18) accepted GENERATED
 * ALWAYS AS IDENTITY on the partitioned parent, so 0004 uses it (no sequence).
 */
export const eventoAuditoria = pgTable(
  "EventoAuditoria",
  {
    // Typing only: drizzle omits it from inserts.
    id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity(),
    actorId: bigint("ActorId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    ocurridoEn: timestamp("OcurridoEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
    accion: varchar("Accion", { length: 60 }).notNull(),
    entidadTipo: varchar("EntidadTipo", { length: 40 }).notNull(),
    // NULL only for the whole-operation "Importacion" entity type.
    entidadId: bigint("EntidadId", { mode: "number" }),
    datos: jsonb("Datos")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
  },
  (t) => [
    // A unique constraint on a partitioned table MUST contain every partition
    // key column (decision 25): "Id" alone is not constrained-unique.
    primaryKey({ columns: [t.id, t.ocurridoEn] }),
    index("IX_EventoAuditoria_Entidad").on(
      t.entidadTipo,
      t.entidadId,
      t.ocurridoEn.desc(),
    ),
    index("IX_EventoAuditoria_Actor").on(t.actorId, t.ocurridoEn.desc()),
    index("IX_EventoAuditoria_Ocurrido").on(t.ocurridoEn),
    check(
      "CK_EventoAuditoria_Entidad",
      sql`${t.entidadTipo} <> 'Usuario' OR ${t.entidadId} IS NOT NULL`,
    ),
  ],
);
// No `Activo`, no `updatedAt`, no soft-delete column: the table is append-only,
// so a mutable column would be a contradiction the trigger would reject.
