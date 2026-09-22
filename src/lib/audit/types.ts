import type { EntityCounts, EntityName } from "@/lib/import/types";
import type { RolUsuario } from "@/lib/validations/auth";

// PURE. No db, no clock, no I/O (decisions 18, 22). Types and constants only:
// the closed `AuditEvent` union is constructible ONLY through the builders in
// `src/lib/audit/events.ts` (WU2b-2), never by hand elsewhere.

export const AUDIT_ACTIONS = [
  "catalogo.importacion.aplicada",
  "usuario.creado",
  "usuario.actualizado",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEntityType = "Importacion" | "Usuario";

/** Closed list. A field not named here can never be reported as changed.
 *  `login` and `hashClave` are ABSENT on purpose: `hashClave` is a
 *  credential, and `login` is never rewritten by an import (decision 7). */
export const AUDITABLE_USER_FIELDS = [
  "nombreCompleto",
  "correo",
  "telefono",
  "cif",
  "carreraId",
  "rolId",
  "activo",
] as const;

export type AuditableUserField = (typeof AUDITABLE_USER_FIELDS)[number];

type ImportAppliedPayload = {
  archivoSha256: string;
  conteos: Record<EntityName, EntityCounts>;
  cuentasCreadas: number;
  cuentasActualizadas: number;
};

type UserChangedPayload = {
  /** FIELD NAMES ONLY — never values (RNF-05, decision 22). */
  campos: readonly AuditableUserField[];
  rol: RolUsuario;
  origen: "importacion";
  importacionSha256: string;
};

/** Closed discriminated union. Built ONLY by `src/lib/audit/events.ts`.
 *  `actorId` and `ocurridoEn` are NOT on this type: the actor is supplied by
 *  the writer from the session, and the timestamp is the column default, so
 *  a builder cannot forge either one. */
export type AuditEvent =
  | {
      accion: "catalogo.importacion.aplicada";
      entidadTipo: "Importacion";
      entidadId: null;
      datos: ImportAppliedPayload;
    }
  | {
      accion: "usuario.creado" | "usuario.actualizado";
      entidadTipo: "Usuario";
      entidadId: number;
      datos: UserChangedPayload;
    };
