import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

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
  },
  (t) => [check("CK_Asignatura_Horas", sql`${t.horasTotales} > 0`)],
);

export type Asignatura = typeof asignatura.$inferSelect;
export type NuevaAsignatura = typeof asignatura.$inferInsert;

/**
 * Grupo — sección de una asignatura en un periodo. Clave natural:
 * (AsignaturaId, Periodo, NumeroGrupo). `NumeroGrupo` es texto (X3). `Activo`
 * permite desactivar en vez de borrar (X1).
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
  },
  (t) => [
    unique().on(t.asignaturaId, t.periodo, t.numeroGrupo),
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
