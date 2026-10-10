import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import type { GrupoOrigen } from "@/lib/catalog/origen";
import { CAUSAS } from "@/lib/intake/causes";
import { MAX_DOCUMENT_BYTES } from "@/lib/intake/limits";
import { ESTADOS_SOLICITUD } from "@/lib/intake/states";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * Facultad — catálogo de facultades (modelo_datos_sql.md §3.1).
 */
export const facultad = pgTable("Facultad", {
  id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  nombre: varchar("Nombre", { length: 160 }).notNull().unique(),
  siglas: varchar("Siglas", { length: 16 }),
});

export type Facultad = typeof facultad.$inferSelect;
export type NuevaFacultad = typeof facultad.$inferInsert;

/**
 * Carrera — catálogo de carreras, cada una pertenece a una facultad
 * (modelo_datos_sql.md §3.1).
 */
export const carrera = pgTable("Carrera", {
  id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  nombre: varchar("Nombre", { length: 160 }).notNull().unique(),
  facultadId: bigint("FacultadId", { mode: "number" })
    .notNull()
    .references(() => facultad.id),
});

export type Carrera = typeof carrera.$inferSelect;
export type NuevaCarrera = typeof carrera.$inferInsert;

/**
 * Rol — catálogo de roles de usuario (roles-lookup-table, design.md decisions
 * 1 and 5). `Codigo` mirrors the code-level `rolesUsuario` constant (single
 * source of truth for VALID values); `Nombre` is a documentation display
 * name, not the i18n source (state.yaml assumption).
 */
export const rol = pgTable("Rol", {
  id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  codigo: varchar("Codigo", { length: 20 })
    .$type<RolUsuario>()
    .notNull()
    .unique(),
  nombre: varchar("Nombre", { length: 60 }).notNull(),
});

export type Rol = typeof rol.$inferSelect;
export type NuevoRol = typeof rol.$inferInsert;

/**
 * Usuario — identidad y credenciales de acceso.
 *
 * Fuente: modelo_datos_sql.md §1 (entidad 4) y DDL §3.1.
 *
 * Notas del modelo:
 * - `rolId` referencia el catálogo `Rol` (roles-lookup-table). El código de
 *   rol (estudiante | docente | coordinacion | secretaria | administrador)
 *   se resuelve por join en `src/lib/data/users.ts` y `src/lib/data/roles.ts`;
 *   el legado `rol` VARCHAR fue eliminado por la migración 0002.
 * - `cif` es único y solo lo llevan los estudiantes; NULL para el resto.
 * - `carreraId` es la carrera del estudiante o la que coordina
 *   coordinación; NULL para docente, secretaría y administración (§4 nota 2).
 * - `correo` es único (varios NULL pueden coexistir); es la clave natural de
 *   los docentes en la importación (catalog-excel-import, D7).
 * - `debeCambiarClave` marca las cuentas creadas por importación, que deben
 *   cambiar la clave temporal en el primer ingreso (forced-password-change).
 */
export const usuario = pgTable("Usuario", {
  id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  login: varchar("Login", { length: 60 }).notNull().unique(),
  hashClave: varchar("HashClave", { length: 255 }).notNull(),
  rolId: bigint("RolId", { mode: "number" })
    .notNull()
    .references(() => rol.id),
  nombreCompleto: varchar("NombreCompleto", { length: 160 }).notNull(),
  correo: varchar("Correo", { length: 160 }).unique(),
  telefono: varchar("Telefono", { length: 30 }),
  cif: varchar("Cif", { length: 20 }).unique(),
  carreraId: bigint("CarreraId", { mode: "number" }).references(
    () => carrera.id,
  ),
  activo: boolean("Activo").notNull().default(true),
  debeCambiarClave: boolean("DebeCambiarClave").notNull().default(false),
  creadoEn: timestamp("CreadoEn", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Usuario = typeof usuario.$inferSelect;
export type NuevoUsuario = typeof usuario.$inferInsert;

/**
 * Asignatura — catálogo de asignaturas; `Codigo` es la clave natural usada por
 * la importación (catalog-excel-import). `HorasTotales` debe ser positivo (X9).
 * `Activo` permite desactivar en vez de borrar (catalog-management, AC-LIFE).
 */
export const asignatura = pgTable(
  "Asignatura",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    codigo: varchar("Codigo", { length: 32 }).notNull().unique(),
    nombre: varchar("Nombre", { length: 160 }).notNull(),
    carreraId: bigint("CarreraId", { mode: "number" })
      .notNull()
      .references(() => carrera.id),
    horasTotales: integer("HorasTotales").notNull(),
    activo: boolean("Activo").notNull().default(true),
  },
  (t) => [check("CK_Asignatura_Horas", sql`${t.horasTotales} > 0`)],
);

export type Asignatura = typeof asignatura.$inferSelect;
export type NuevaAsignatura = typeof asignatura.$inferInsert;

/**
 * Grupo — sección de una asignatura en un periodo. Clave natural:
 * (AsignaturaId, Periodo, NumeroGrupo). `NumeroGrupo` es texto (X3). `Activo`
 * permite desactivar en vez de borrar (X1). `Origen` registra cómo se creó la
 * fila (importación o manual); se fija al crear y nunca se reescribe. `Dias` es
 * la máscara de bits de los días de reunión (lunes = bit 0 ... domingo = bit 6;
 * 0 = días no registrados); véase `src/lib/catalog/dias.ts`.
 */
export const grupo = pgTable(
  "Grupo",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    asignaturaId: bigint("AsignaturaId", { mode: "number" })
      .notNull()
      .references(() => asignatura.id),
    periodo: varchar("Periodo", { length: 12 }).notNull(),
    numeroGrupo: varchar("NumeroGrupo", { length: 12 }).notNull(),
    docenteId: bigint("DocenteId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    activo: boolean("Activo").notNull().default(true),
    origen: varchar("Origen", { length: 12 })
      .$type<GrupoOrigen>()
      .notNull()
      .default("importacion"),
    dias: smallint("Dias").notNull().default(0),
  },
  (t) => [
    unique().on(t.asignaturaId, t.periodo, t.numeroGrupo),
    check("CK_Grupo_Origen", sql`${t.origen} in ('importacion', 'manual')`),
    check("CK_Grupo_Dias", sql`${t.dias} between 0 and 127`),
    index("IX_Grupo_Docente").on(t.docenteId),
    index("IX_Grupo_Activo")
      .on(t.asignaturaId, t.periodo)
      .where(sql`${t.activo}`),
  ],
);

export type Grupo = typeof grupo.$inferSelect;
export type NuevoGrupo = typeof grupo.$inferInsert;

/**
 * Inscripcion — matrícula de un estudiante en un grupo. La PK compuesta cubre
 * las búsquedas por estudiante; `IX_Inscripcion_Grupo` cubre la nómina de un
 * grupo. Sin índice parcial a propósito (decisión 11).
 */
export const inscripcion = pgTable(
  "Inscripcion",
  {
    estudianteId: bigint("EstudianteId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    grupoId: bigint("GrupoId", { mode: "number" })
      .notNull()
      .references(() => grupo.id),
    activo: boolean("Activo").notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.estudianteId, t.grupoId] }),
    index("IX_Inscripcion_Grupo").on(t.grupoId),
  ],
);

export type Inscripcion = typeof inscripcion.$inferSelect;
export type NuevaInscripcion = typeof inscripcion.$inferInsert;

/** Renders a closed list as a SQL `IN` list for CHECK constraints. */
function inList(values: readonly string[]) {
  return sql.raw(values.map((v) => `'${v}'`).join(", "));
}

/**
 * Solicitud — an absence justification request (justification-intake A1, D7).
 * One table holds the draft (`borrador`) and the RN-16 states; this change
 * writes `borrador` and `pendiente` only. Absence dates are calendar dates
 * (A6). The four `Estudiante*` columns are the submit-time snapshot of the
 * student's account (RN-02, D9): NULL while a draft, NOT NULL once presented
 * (`CK_Solicitud_Presentada`). `ActualizadoEn` has no trigger: every draft
 * mutation in `src/lib/data/solicitudes.ts` sets it explicitly.
 */
export const solicitud = pgTable(
  "Solicitud",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    estudianteId: bigint("EstudianteId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    estado: varchar("Estado", { length: 30 }).notNull().default("borrador"),
    causa: varchar("Causa", { length: 30 }),
    fechaInicio: date("FechaInicio", { mode: "string" }),
    fechaFin: date("FechaFin", { mode: "string" }),
    presentadaEn: timestamp("PresentadaEn", { withTimezone: true }),
    estudianteNombre: varchar("EstudianteNombre", { length: 160 }),
    estudianteCif: varchar("EstudianteCif", { length: 20 }),
    estudianteCarrera: varchar("EstudianteCarrera", { length: 160 }),
    estudianteCorreo: varchar("EstudianteCorreo", { length: 160 }),
    creadoEn: timestamp("CreadoEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actualizadoEn: timestamp("ActualizadoEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "CK_Solicitud_Estado",
      sql`${t.estado} IN (${inList(ESTADOS_SOLICITUD)})`,
    ),
    check(
      "CK_Solicitud_Causa",
      sql`${t.causa} IS NULL OR ${t.causa} IN (${inList(CAUSAS)})`,
    ),
    check("CK_Solicitud_Fechas", sql`${t.fechaFin} >= ${t.fechaInicio}`),
    check(
      "CK_Solicitud_Presentada",
      sql`${t.estado} = 'borrador' OR (${t.presentadaEn} IS NOT NULL AND ${t.causa} IS NOT NULL AND ${t.fechaInicio} IS NOT NULL AND ${t.fechaFin} IS NOT NULL AND ${t.estudianteNombre} IS NOT NULL AND ${t.estudianteCif} IS NOT NULL AND ${t.estudianteCarrera} IS NOT NULL AND ${t.estudianteCorreo} IS NOT NULL)`,
    ),
    // D8: at most one open draft per student.
    uniqueIndex("UX_Solicitud_Borrador")
      .on(t.estudianteId)
      .where(sql`${t.estado} = 'borrador'`),
    index("IX_Solicitud_Estado").on(t.estado, t.presentadaEn),
    // Serves the expiry sweep (draft inactivity, D8).
    index("IX_Solicitud_BorradorActualizado")
      .on(t.actualizadoEn)
      .where(sql`${t.estado} = 'borrador'`),
  ],
);

export type Solicitud = typeof solicitud.$inferSelect;
export type NuevaSolicitud = typeof solicitud.$inferInsert;

/**
 * SolicitudAsignatura — a subject of the request, stored as the chosen group
 * (RF-04): the subject is derived through `Grupo.AsignaturaId`. Rows follow the
 * request on delete (discard, expiry).
 */
export const solicitudAsignatura = pgTable(
  "SolicitudAsignatura",
  {
    solicitudId: bigint("SolicitudId", { mode: "number" })
      .notNull()
      .references(() => solicitud.id, { onDelete: "cascade" }),
    grupoId: bigint("GrupoId", { mode: "number" })
      .notNull()
      .references(() => grupo.id),
  },
  (t) => [primaryKey({ columns: [t.solicitudId, t.grupoId] })],
);

export type SolicitudAsignatura = typeof solicitudAsignatura.$inferSelect;
export type NuevaSolicitudAsignatura = typeof solicitudAsignatura.$inferInsert;

/**
 * DocumentoRespaldo — a supporting document of a request (supporting-documents,
 * A2). Finalize claims a `pendiente` row before sniffing the stored bytes so
 * the 5-document cap (D12) and pathname uniqueness hold under concurrency; a
 * `valido` row always carries the detected type (RN-04). Only the pathname is
 * stored, never a fetchable URL (RNF-02).
 */
export const documentoRespaldo = pgTable(
  "DocumentoRespaldo",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    solicitudId: bigint("SolicitudId", { mode: "number" })
      .notNull()
      .references(() => solicitud.id, { onDelete: "cascade" }),
    pathname: varchar("Pathname", { length: 255 }).notNull().unique(),
    nombreOriginal: varchar("NombreOriginal", { length: 255 }).notNull(),
    tipoDetectado: varchar("TipoDetectado", { length: 10 }),
    tamanoBytes: integer("TamanoBytes").notNull(),
    estado: varchar("Estado", { length: 10 }).notNull(),
    creadoEn: timestamp("CreadoEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "CK_Documento_Tipo",
      sql`${t.tipoDetectado} IS NULL OR ${t.tipoDetectado} IN ('pdf', 'png', 'jpeg')`,
    ),
    check(
      "CK_Documento_Tamano",
      sql`${t.tamanoBytes} > 0 AND ${t.tamanoBytes} <= ${sql.raw(String(MAX_DOCUMENT_BYTES))}`,
    ),
    check("CK_Documento_Estado", sql`${t.estado} IN ('pendiente', 'valido')`),
    check(
      "CK_Documento_Validado",
      sql`${t.estado} = 'pendiente' OR ${t.tipoDetectado} IS NOT NULL`,
    ),
    index("IX_Documento_Solicitud").on(t.solicitudId),
  ],
);

export type DocumentoRespaldo = typeof documentoRespaldo.$inferSelect;
export type NuevoDocumentoRespaldo = typeof documentoRespaldo.$inferInsert;
