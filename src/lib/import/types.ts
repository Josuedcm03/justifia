import type { RolUsuario } from "@/lib/validations/auth";

/**
 * Row types of the catalog snapshot read by `loadCatalogSnapshot` and consumed
 * by the pure planner. WU2a extends this file with the parser and plan types.
 * Rows carry no credentials: `hashClave` is never part of a snapshot.
 */

export type FacultadRow = { id: number; nombre: string };

export type CarreraRow = { id: number; nombre: string; facultadId: number };

export type AsignaturaRow = {
  id: number;
  codigo: string;
  nombre: string;
  carreraId: number;
  horasTotales: number;
};

/** A user with its role CODE (resolved by join), inactive accounts included. */
export type UsuarioRow = {
  id: number;
  login: string;
  correo: string | null;
  cif: string | null;
  nombreCompleto: string;
  carreraId: number | null;
  activo: boolean;
  rol: RolUsuario;
};

/** Inactive groups are included so a corrected re-import can reactivate them. */
export type GrupoRow = {
  id: number;
  asignaturaId: number;
  periodo: string;
  numeroGrupo: string;
  docenteId: number;
  activo: boolean;
};

/** Inactive enrollments are included so a corrected re-import can reactivate them. */
export type InscripcionRow = {
  estudianteId: number;
  grupoId: number;
  activo: boolean;
};

export type CatalogSnapshot = {
  facultades: FacultadRow[];
  carreras: CarreraRow[];
  asignaturas: AsignaturaRow[];
  usuarios: UsuarioRow[];
  grupos: GrupoRow[];
  inscripciones: InscripcionRow[];
};
