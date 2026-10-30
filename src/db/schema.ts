import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { effectiveClockStart } from "@/db/clock-start";
import type { GrupoOrigen } from "@/lib/catalog/origen";
import {
  EXTRACTION_ERRORS,
  EXTRACTION_STATES,
  type ExtractionError,
  type ExtractionState,
} from "@/lib/extraction/states";
import { CAUSAS } from "@/lib/intake/causes";
import { DECISION_KINDS } from "@/lib/intake/decision-templates";
import {
  ESCALATION_KINDS,
  ESCALATION_NOTICE_REASONS,
  ESCALATION_NOTICE_STATES,
  type EscalationNoticeReason,
  type EscalationNoticeState,
} from "@/lib/intake/escalation";
import { MAX_DOCUMENT_BYTES } from "@/lib/intake/limits";
import { RETURN_REASONS } from "@/lib/intake/return-reasons";
import { ESTADOS_SOLICITUD } from "@/lib/intake/states";
import {
  REMISSION_REASONS,
  REMISSION_STATES,
  type RemissionReason,
  type RemissionState,
} from "@/lib/remission/states";
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
 * - `facultadId` es la facultad de una secretaria (secretary-review, SR-1);
 *   excluyente con `carreraId` (`CK_Usuario_Ambito`). Que una secretaria la
 *   tenga se exige al crearla (SR-16) y por el alcance que falla cerrado
 *   (SR-6); un CHECK no puede leer el rol.
 */
export const usuario = pgTable(
  "Usuario",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
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
    facultadId: bigint("FacultadId", { mode: "number" }).references(
      () => facultad.id,
    ),
    activo: boolean("Activo").notNull().default(true),
    debeCambiarClave: boolean("DebeCambiarClave").notNull().default(false),
    creadoEn: timestamp("CreadoEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "CK_Usuario_Ambito",
      sql`${t.facultadId} IS NULL OR ${t.carreraId} IS NULL`,
    ),
  ],
);

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
    // Set on each resubmission after a return (RF-08); `PresentadaEn` keeps the
    // first presentation (secretary-review, SR-1).
    reenviadaEn: timestamp("ReenviadaEn", { withTimezone: true }),
    // RN-08 stored effective clock start (escalation, ES-5): the coordinator
    // answer moves it forward by the business days spent in coordination, and a
    // resubmission clears it. NULL means the clock starts at `ReenviadaEn` or
    // `PresentadaEn`.
    plazoInicioEn: timestamp("PlazoInicioEn", { withTimezone: true }),
    // RN-19: the secretary marked the approval as a special-format case; the
    // signed format is uploaded afterwards (teacher-remission, TR-1).
    formatoEspecial: boolean("FormatoEspecial").notNull().default(false),
    // RF-01 (d), RN-25: the consent of the first presentation, written in the
    // same transaction and with the same instant as `PresentadaEn`. NULL while a
    // draft and on every request presented before consent existed (request-
    // consent, RC-1: no backfill, a backfill would fabricate consent).
    consentimientoEn: timestamp("ConsentimientoEn", { withTimezone: true }),
    consentimientoVersion: varchar("ConsentimientoVersion", { length: 20 }),
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
    check(
      "CK_Solicitud_Reenvio",
      sql`${t.reenviadaEn} IS NULL OR (${t.presentadaEn} IS NOT NULL AND ${t.reenviadaEn} >= ${t.presentadaEn})`,
    ),
    // Consent: both columns or neither, and never after the presentation. A
    // draft has no presentation, so it cannot carry consent (RC-1).
    check(
      "CK_Solicitud_Consentimiento",
      sql`(${t.consentimientoEn} IS NULL) = (${t.consentimientoVersion} IS NULL)`,
    ),
    check(
      "CK_Solicitud_ConsentimientoFecha",
      sql`${t.consentimientoEn} IS NULL OR (${t.presentadaEn} IS NOT NULL AND ${t.consentimientoEn} <= ${t.presentadaEn})`,
    ),
    check(
      "CK_Solicitud_PlazoInicio",
      sql`${t.plazoInicioEn} IS NULL OR ${t.plazoInicioEn} >= coalesce(${t.reenviadaEn}, ${t.presentadaEn})`,
    ),
    check(
      "CK_Solicitud_FormatoEspecial",
      sql`NOT ${t.formatoEspecial} OR (${t.estado} = 'aprobada' AND ${t.causa} = 'fuerza_mayor')`,
    ),
    // The review queue: pending requests by effective start (SR-1, ES-5).
    index("IX_Solicitud_Cola")
      .on(effectiveClockStart(t), t.id)
      .where(sql`${t.estado} = 'pendiente'`),
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
    // Soft retirement during a correction: the row and blob stay visible to
    // staff and leave the five-document cap (secretary-review, SR-1).
    retiradoEn: timestamp("RetiradoEn", { withTimezone: true }),
    // Staff upload (teacher-remission, TR-16): NULL = uploaded by the student.
    // `FormatoEspecial` marks the signed RN-19 format and is tied to it.
    subidoPorId: bigint("SubidoPorId", { mode: "number" }).references(
      () => usuario.id,
    ),
    formatoEspecial: boolean("FormatoEspecial").notNull().default(false),
    creadoEn: timestamp("CreadoEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "CK_Documento_Retiro",
      sql`${t.retiradoEn} IS NULL OR ${t.estado} = 'valido'`,
    ),
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
    check(
      "CK_Documento_FormatoEspecial",
      sql`${t.formatoEspecial} = (${t.subidoPorId} IS NOT NULL) AND (NOT ${t.formatoEspecial} OR ${t.estado} = 'valido')`,
    ),
    // At most one signed format per request (TR-1).
    uniqueIndex("UX_Documento_FormatoEspecial")
      .on(t.solicitudId)
      .where(sql`${t.formatoEspecial}`),
    index("IX_Documento_Solicitud").on(t.solicitudId),
  ],
);

export type DocumentoRespaldo = typeof documentoRespaldo.$inferSelect;
export type NuevoDocumentoRespaldo = typeof documentoRespaldo.$inferInsert;

/** One class of a revision snapshot (no period, no `Grupo` id). */
export type RevisionClase = {
  asignaturaId: number;
  codigo: string;
  nombre: string;
  numeroGrupo: string;
};

/**
 * SolicitudRevision — the snapshot of a returned version of a request, written
 * when the request is returned (secretary-review, SR-1, RF-08). Classes are a
 * jsonb copy so history does not follow live catalog edits and the table holds
 * no reference to `Grupo`. Append-only; no cascade: a presented request is
 * never deleted.
 */
export const solicitudRevision = pgTable(
  "SolicitudRevision",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    solicitudId: bigint("SolicitudId", { mode: "number" })
      .notNull()
      .references(() => solicitud.id),
    numero: smallint("Numero").notNull(),
    causa: varchar("Causa", { length: 30 }).notNull(),
    fechaInicio: date("FechaInicio", { mode: "string" }).notNull(),
    fechaFin: date("FechaFin", { mode: "string" }).notNull(),
    clases: jsonb("Clases").$type<RevisionClase[]>().notNull(),
    documentoIds: jsonb("DocumentoIds").$type<number[]>().notNull(),
    creadaEn: timestamp("CreadaEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("UQ_SolicitudRevision").on(t.solicitudId, t.numero),
    check("CK_SolicitudRevision_Numero", sql`${t.numero} > 0`),
    check("CK_SolicitudRevision_Causa", sql`${t.causa} IN (${inList(CAUSAS)})`),
    check(
      "CK_SolicitudRevision_Fechas",
      sql`${t.fechaFin} >= ${t.fechaInicio}`,
    ),
  ],
);

export type SolicitudRevision = typeof solicitudRevision.$inferSelect;
export type NuevaSolicitudRevision = typeof solicitudRevision.$inferInsert;

/**
 * SolicitudDecision — one secretary decision on a request (secretary-review,
 * SR-1, RF-07). Append-only: a return cycle adds rows, never rewrites them. A
 * return carries its RN-17 reason and the revision snapshot it created; an
 * approval or rejection carries neither. Audit stores codes only; the text
 * lives here.
 */
export const solicitudDecision = pgTable(
  "SolicitudDecision",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    solicitudId: bigint("SolicitudId", { mode: "number" })
      .notNull()
      .references(() => solicitud.id),
    tipo: varchar("Tipo", { length: 20 }).notNull(),
    plantillaCodigo: varchar("PlantillaCodigo", { length: 40 }).notNull(),
    motivoCodigo: varchar("MotivoCodigo", { length: 30 }),
    texto: varchar("Texto", { length: 1000 }),
    revisionId: bigint("RevisionId", { mode: "number" }).references(
      () => solicitudRevision.id,
    ),
    secretariaId: bigint("SecretariaId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    decididaEn: timestamp("DecididaEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "CK_SolicitudDecision_Tipo",
      sql`${t.tipo} IN (${inList(DECISION_KINDS)})`,
    ),
    check(
      "CK_SolicitudDecision_Motivo",
      sql`(${t.tipo} = 'devuelta') = (${t.motivoCodigo} IS NOT NULL)`,
    ),
    check(
      "CK_SolicitudDecision_MotivoCodigo",
      sql`${t.motivoCodigo} IS NULL OR ${t.motivoCodigo} IN (${inList(RETURN_REASONS)})`,
    ),
    // Null-safe: a CHECK that evaluates to NULL passes, so blank text is
    // refused explicitly for every decision except an approval.
    check(
      "CK_SolicitudDecision_Texto",
      sql`${t.tipo} = 'aprobada' OR (${t.texto} IS NOT NULL AND length(btrim(${t.texto})) > 0)`,
    ),
    check(
      "CK_SolicitudDecision_Revision",
      sql`(${t.tipo} = 'devuelta') = (${t.revisionId} IS NOT NULL)`,
    ),
    index("IX_SolicitudDecision_Solicitud").on(t.solicitudId, t.decididaEn),
  ],
);

export type SolicitudDecision = typeof solicitudDecision.$inferSelect;
export type NuevaSolicitudDecision = typeof solicitudDecision.$inferInsert;

/**
 * Remision — one delivery of an approved justification to one teacher
 * (teacher-remission, TR-1): a transactional outbox row created in the
 * approval's transaction. Teacher id, name, email and groups are a snapshot
 * taken at approval. Not append-only: it is a state machine, so every write
 * goes through `src/lib/data/remision.ts` (pinned by a structural test). The
 * claim columns make each send at-most-once under concurrency (TR-6). No
 * cascade: a decided request is never deleted.
 */
export const remision = pgTable(
  "Remision",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    solicitudId: bigint("SolicitudId", { mode: "number" })
      .notNull()
      .references(() => solicitud.id),
    docenteId: bigint("DocenteId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    docenteNombre: varchar("DocenteNombre", { length: 160 }).notNull(),
    correo: varchar("Correo", { length: 160 }),
    clases: jsonb("Clases").$type<RevisionClase[]>().notNull(),
    estado: varchar("Estado", { length: 20 })
      .$type<RemissionState>()
      .notNull()
      .default("pendiente"),
    motivoCodigo: varchar("MotivoCodigo", {
      length: 40,
    }).$type<RemissionReason>(),
    intentos: smallint("Intentos").notNull().default(0),
    reclamoId: uuid("ReclamoId"),
    reclamadaEn: timestamp("ReclamadaEn", { withTimezone: true }),
    enviadaEn: timestamp("EnviadaEn", { withTimezone: true }),
    proveedorMensajeId: varchar("ProveedorMensajeId", { length: 100 }),
    creadaEn: timestamp("CreadaEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actualizadaEn: timestamp("ActualizadaEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("UQ_Remision_SolicitudDocente").on(t.solicitudId, t.docenteId),
    check(
      "CK_Remision_Estado",
      sql`${t.estado} IN (${inList(REMISSION_STATES)})`,
    ),
    check(
      "CK_Remision_Motivo",
      sql`${t.motivoCodigo} IS NULL OR ${t.motivoCodigo} IN (${inList(REMISSION_REASONS)})`,
    ),
    check(
      "CK_Remision_Enviada",
      sql`(${t.estado} = 'enviada') = (${t.enviadaEn} IS NOT NULL)`,
    ),
    check(
      "CK_Remision_MotivoEstado",
      sql`(${t.estado} <> 'enviada' OR ${t.motivoCodigo} IS NULL) AND (${t.estado} <> 'bloqueada' OR (${t.motivoCodigo} IS NOT NULL AND ${t.motivoCodigo} <> 'error_envio')) AND (${t.estado} <> 'pendiente' OR ${t.motivoCodigo} IS NULL OR ${t.motivoCodigo} = 'error_envio')`,
    ),
    check(
      "CK_Remision_Correo",
      sql`${t.correo} IS NOT NULL OR ${t.motivoCodigo} = 'sin_correo'`,
    ),
    check(
      "CK_Remision_Reclamo",
      sql`(${t.reclamoId} IS NULL) = (${t.reclamadaEn} IS NULL)`,
    ),
    check("CK_Remision_Intentos", sql`${t.intentos} >= 0`),
    // The retry job reads pending rows oldest first (TR-12).
    index("IX_Remision_Pendiente")
      .on(t.creadaEn, t.id)
      .where(sql`${t.estado} = 'pendiente'`),
    index("IX_Remision_Solicitud").on(t.solicitudId),
  ],
);

export type Remision = typeof remision.$inferSelect;
export type NuevaRemision = typeof remision.$inferInsert;

/**
 * ReporteInasistencia — the RF-15 report that a teacher was told about excess
 * absences of an approved request (escalation, ES-2). Append-only: no function
 * updates or deletes it (structural test). The teacher name is a snapshot and
 * the request has no percentage or count field. No cascade.
 */
export const reporteInasistencia = pgTable(
  "ReporteInasistencia",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    solicitudId: bigint("SolicitudId", { mode: "number" })
      .notNull()
      .references(() => solicitud.id),
    docenteId: bigint("DocenteId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    docenteNombre: varchar("DocenteNombre", { length: 160 }).notNull(),
    comunicadoEl: date("ComunicadoEl", { mode: "string" }).notNull(),
    nota: varchar("Nota", { length: 1000 }),
    registradoPorId: bigint("RegistradoPorId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    registradoEn: timestamp("RegistradoEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "CK_ReporteInasistencia_Nota",
      sql`${t.nota} IS NULL OR length(btrim(${t.nota})) > 0`,
    ),
    index("IX_ReporteInasistencia_Solicitud").on(t.solicitudId),
  ],
);

export type ReporteInasistencia = typeof reporteInasistencia.$inferSelect;
export type NuevoReporteInasistencia = typeof reporteInasistencia.$inferInsert;

/**
 * Escalamiento — one escalation to the career coordination and its own
 * notification outbox (escalation, ES-1). Two kinds share the table: a
 * `sospecha_documento` moves the request to `en_revision_coordinacion` and is
 * answered by the coordination; an `exceso_inasistencias` is informational and
 * leaves the request `aprobada`. The career is never stored: it is the
 * student's live `CarreraId` (ES-3). The outbox columns mirror `Remision`; after
 * creation only `src/lib/data/escalamiento.ts` writes them (structural test).
 * No cascade: a decided request is never deleted.
 */
export const escalamiento = pgTable(
  "Escalamiento",
  {
    id: bigint("Id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    solicitudId: bigint("SolicitudId", { mode: "number" })
      .notNull()
      .references(() => solicitud.id),
    tipo: varchar("Tipo", { length: 30 }).notNull(),
    estadoPrevio: varchar("EstadoPrevio", { length: 30 }).notNull(),
    nota: varchar("Nota", { length: 1000 }),
    reporteId: bigint("ReporteId", { mode: "number" }).references(
      () => reporteInasistencia.id,
    ),
    secretariaId: bigint("SecretariaId", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    creadoEn: timestamp("CreadoEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respuesta: varchar("Respuesta", { length: 1000 }),
    respondidaPorId: bigint("RespondidaPorId", { mode: "number" }).references(
      () => usuario.id,
    ),
    respondidaEn: timestamp("RespondidaEn", { withTimezone: true }),
    notificacionEstado: varchar("NotificacionEstado", { length: 20 })
      .$type<EscalationNoticeState>()
      .notNull()
      .default("pendiente"),
    notificacionMotivo: varchar("NotificacionMotivo", {
      length: 30,
    }).$type<EscalationNoticeReason>(),
    intentos: smallint("Intentos").notNull().default(0),
    reclamoId: uuid("ReclamoId"),
    reclamadaEn: timestamp("ReclamadaEn", { withTimezone: true }),
    enviadaEn: timestamp("EnviadaEn", { withTimezone: true }),
    proveedorMensajeId: varchar("ProveedorMensajeId", { length: 100 }),
    actualizadaEn: timestamp("ActualizadaEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "CK_Escalamiento_Tipo",
      sql`${t.tipo} IN (${inList(ESCALATION_KINDS)})`,
    ),
    check(
      "CK_Escalamiento_Kind",
      sql`(${t.tipo} = 'sospecha_documento' AND ${t.estadoPrevio} = 'pendiente' AND ${t.reporteId} IS NULL AND ${t.nota} IS NOT NULL AND length(btrim(${t.nota})) > 0) OR (${t.tipo} = 'exceso_inasistencias' AND ${t.estadoPrevio} = 'aprobada' AND ${t.reporteId} IS NOT NULL AND ${t.nota} IS NULL)`,
    ),
    check(
      "CK_Escalamiento_Respuesta",
      sql`(${t.respuesta} IS NULL) = (${t.respondidaPorId} IS NULL) AND (${t.respuesta} IS NULL) = (${t.respondidaEn} IS NULL) AND (${t.respuesta} IS NULL OR (length(btrim(${t.respuesta})) > 0 AND ${t.respondidaEn} >= ${t.creadoEn}))`,
    ),
    check(
      "CK_Escalamiento_SinRespuesta",
      sql`${t.tipo} = 'sospecha_documento' OR ${t.respondidaEn} IS NULL`,
    ),
    check(
      "CK_Escalamiento_NotificacionEstado",
      sql`${t.notificacionEstado} IN (${inList(ESCALATION_NOTICE_STATES)})`,
    ),
    check(
      "CK_Escalamiento_NotificacionMotivo",
      sql`${t.notificacionMotivo} IS NULL OR ${t.notificacionMotivo} IN (${inList(ESCALATION_NOTICE_REASONS)})`,
    ),
    check(
      "CK_Escalamiento_Enviada",
      sql`(${t.notificacionEstado} = 'enviada') = (${t.enviadaEn} IS NOT NULL)`,
    ),
    check(
      "CK_Escalamiento_MotivoEstado",
      sql`(${t.notificacionEstado} <> 'enviada' OR ${t.notificacionMotivo} IS NULL) AND (${t.notificacionEstado} <> 'bloqueada' OR (${t.notificacionMotivo} IS NOT NULL AND ${t.notificacionMotivo} = 'sin_destinatarios')) AND (${t.notificacionEstado} <> 'pendiente' OR ${t.notificacionMotivo} IS NULL OR ${t.notificacionMotivo} = 'error_envio')`,
    ),
    check(
      "CK_Escalamiento_Reclamo",
      sql`(${t.reclamoId} IS NULL) = (${t.reclamadaEn} IS NULL)`,
    ),
    check("CK_Escalamiento_Intentos", sql`${t.intentos} >= 0`),
    // E12: at most one open suspicion per request.
    uniqueIndex("UX_Escalamiento_Abierto")
      .on(t.solicitudId)
      .where(
        sql`${t.tipo} = 'sospecha_documento' AND ${t.respondidaEn} IS NULL`,
      ),
    // The retry job reads pending notices oldest first.
    index("IX_Escalamiento_Pendiente")
      .on(t.creadoEn, t.id)
      .where(sql`${t.notificacionEstado} = 'pendiente'`),
    index("IX_Escalamiento_Solicitud").on(t.solicitudId, t.creadoEn),
  ],
);

export type Escalamiento = typeof escalamiento.$inferSelect;
export type NuevoEscalamiento = typeof escalamiento.$inferInsert;

/**
 * ExtraccionDocumento — what the model server read from one supporting
 * document (document-extraction, DE-2): the validated name, issuer, issue date
 * and rest period, plus the control data of a state machine with a claim and a
 * lease (as `Remision`). Not append-only, so every write goes through
 * `src/lib/data/extraction.ts` (pinned by a structural test). It holds no
 * document text, no raw model answer, no confidence and no name-match value
 * (RNF-04). The row follows its document on delete, so extracted data never
 * outlives the document; extraction writes no audit row (no human actor).
 */
export const extraccionDocumento = pgTable(
  "ExtraccionDocumento",
  {
    documentoId: bigint("DocumentoId", { mode: "number" })
      .primaryKey()
      .references(() => documentoRespaldo.id, { onDelete: "cascade" }),
    estado: varchar("Estado", { length: 12 })
      .$type<ExtractionState>()
      .notNull()
      .default("pendiente"),
    intentos: smallint("Intentos").notNull().default(0),
    errorCodigo: varchar("ErrorCodigo", {
      length: 30,
    }).$type<ExtractionError>(),
    reclamoId: uuid("ReclamoId"),
    reclamadaEn: timestamp("ReclamadaEn", { withTimezone: true }),
    nombreEstudiante: varchar("NombreEstudiante", { length: 160 }),
    emisor: varchar("Emisor", { length: 200 }),
    fechaEmision: date("FechaEmision", { mode: "string" }),
    reposoDesde: date("ReposoDesde", { mode: "string" }),
    reposoHasta: date("ReposoHasta", { mode: "string" }),
    reposoDias: smallint("ReposoDias"),
    motor: varchar("Motor", { length: 40 }),
    // Time of the terminal outcome (`completada` or `fallida`).
    procesadoEn: timestamp("ProcesadoEn", { withTimezone: true }),
    creadaEn: timestamp("CreadaEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actualizadaEn: timestamp("ActualizadaEn", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "CK_Extraccion_Estado",
      sql`${t.estado} IN (${inList(EXTRACTION_STATES)})`,
    ),
    check(
      "CK_Extraccion_Error",
      sql`${t.errorCodigo} IS NULL OR ${t.errorCodigo} IN (${inList(EXTRACTION_ERRORS)})`,
    ),
    check(
      "CK_Extraccion_Reclamo",
      sql`(${t.reclamoId} IS NULL) = (${t.reclamadaEn} IS NULL)`,
    ),
    check(
      "CK_Extraccion_Procesando",
      sql`(${t.estado} = 'procesando') = (${t.reclamoId} IS NOT NULL)`,
    ),
    check(
      "CK_Extraccion_Fallida",
      sql`${t.estado} <> 'fallida' OR ${t.errorCodigo} IS NOT NULL`,
    ),
    check(
      "CK_Extraccion_Completada",
      sql`${t.estado} <> 'completada' OR (${t.errorCodigo} IS NULL AND ${t.procesadoEn} IS NOT NULL AND ${t.motor} IS NOT NULL)`,
    ),
    check(
      "CK_Extraccion_Datos",
      sql`${t.estado} = 'completada' OR (${t.nombreEstudiante} IS NULL AND ${t.emisor} IS NULL AND ${t.fechaEmision} IS NULL AND ${t.reposoDesde} IS NULL AND ${t.reposoHasta} IS NULL AND ${t.reposoDias} IS NULL)`,
    ),
    check(
      "CK_Extraccion_Reposo",
      sql`(${t.reposoDias} IS NULL OR ${t.reposoDias} > 0) AND (${t.reposoHasta} IS NULL OR ${t.reposoDesde} IS NULL OR ${t.reposoHasta} >= ${t.reposoDesde})`,
    ),
    check("CK_Extraccion_Intentos", sql`${t.intentos} >= 0`),
    // The sweep and the registration read the open rows oldest first.
    index("IX_Extraccion_Abierta")
      .on(t.creadaEn)
      .where(sql`${t.estado} IN ('pendiente', 'procesando')`),
  ],
);

export type ExtraccionDocumento = typeof extraccionDocumento.$inferSelect;
export type NuevaExtraccionDocumento = typeof extraccionDocumento.$inferInsert;
