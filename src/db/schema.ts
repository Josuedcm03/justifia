import {
  bigint,
  boolean,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

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
 * Usuario — identidad y credenciales de acceso.
 *
 * Fuente: modelo_datos_sql.md §1 (entidad 4) y DDL §3.1.
 *
 * Notas del modelo:
 * - `rol` se mantiene como VARCHAR (enumeración diferida, §2):
 *   estudiante | docente | coordinacion | secretaria | administrador.
 * - `cif` es único y solo lo llevan los estudiantes; NULL para el resto.
 * - `carreraId` es la carrera del estudiante o la que coordina
 *   coordinación; NULL para docente, secretaría y administración (§4 nota 2).
 */
export const usuario = pgTable("Usuario", {
  id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  login: varchar("Login", { length: 60 }).notNull().unique(),
  hashClave: varchar("HashClave", { length: 255 }).notNull(),
  rol: varchar("Rol", { length: 20 }).notNull(),
  nombreCompleto: varchar("NombreCompleto", { length: 160 }).notNull(),
  correo: varchar("Correo", { length: 160 }),
  telefono: varchar("Telefono", { length: 30 }),
  cif: varchar("Cif", { length: 20 }).unique(),
  carreraId: bigint("CarreraId", { mode: "number" }).references(
    () => carrera.id,
  ),
  activo: boolean("Activo").notNull().default(true),
  creadoEn: timestamp("CreadoEn", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Usuario = typeof usuario.$inferSelect;
export type NuevoUsuario = typeof usuario.$inferInsert;
