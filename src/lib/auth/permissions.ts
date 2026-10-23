import type { CoordinationScope } from "@/lib/intake/coordination-scope";
import type { RequestScope } from "@/lib/intake/request-scope";
import { isVisibleState } from "@/lib/intake/states";
import { rolesUsuario } from "@/lib/validations/auth";
import type { RolUsuario } from "@/lib/validations/auth";

/**
 * Each role may assign exactly the roles listed here. Total by construction:
 * `satisfies Record<RolUsuario, ...>` makes a new role a compile error until
 * its row exists here. This is the single source of truth for who may create
 * whom; every predicate below is derived from it (design.md decision 8).
 */
export const rolesAsignables = {
  administrador: ["coordinacion"],
  coordinacion: ["secretaria"],
  secretaria: ["docente"],
  docente: [],
  estudiante: [],
} as const satisfies Record<RolUsuario, readonly RolUsuario[]>;

export function rolesAsignablesPor(
  rol: RolUsuario | undefined,
): readonly RolUsuario[] {
  return rol ? rolesAsignables[rol] : [];
}

/**
 * The users module is reserved for the roles that can create accounts, so
 * this single predicate answers both "may open /users" and "may create an
 * account". There is deliberately no second, module-only predicate
 * (design.md decision 12).
 */
export function canCreateUsers(rol: RolUsuario | undefined): boolean {
  return rolesAsignablesPor(rol).length > 0;
}

/**
 * Type predicate: a `true` result also proves `target` is a valid
 * `RolUsuario`, which removes the `as RolUsuario` cast at the call site.
 */
export function canAssignRole(
  caller: RolUsuario | undefined,
  target: string,
): target is RolUsuario {
  return (rolesAsignablesPor(caller) as readonly string[]).includes(target);
}

/**
 * Who may run the catalog import. Derived from the assignment hierarchy (only
 * the role that provisions `docente` accounts), never a second role list.
 */
export function canImportCatalog(rol: RolUsuario | undefined): boolean {
  return canAssignRole(rol, "docente");
}

/** Derived, never hand-listed — spread into `requireRole` at every call site. */
export const rolesQueCreanUsuarios: RolUsuario[] =
  rolesUsuario.filter(canCreateUsers);

/**
 * Who may manage the catalog. Its own name so the catalog rule can diverge
 * later in one place; today it is the staff set, i.e. exactly the roles for
 * which `canCreateUsers` is true (catalog-management design decision 3).
 */
export function canManageCatalog(rol: RolUsuario | undefined): boolean {
  return canCreateUsers(rol);
}

/** Derived, never hand-listed — spread into `requireRole` at every call site. */
export const rolesQueGestionanCatalogo: RolUsuario[] =
  rolesUsuario.filter(canManageCatalog);

/**
 * One predicate, not a list: the only role tied to a single carrera.
 * `coordinacion` is scoped to its own carrera in the catalog.
 */
export function isCarreraScopedRole(rol: RolUsuario | undefined): boolean {
  return rol === "coordinacion";
}

/**
 * WHICH USERS a viewer may see, by role CODE. Not derived from
 * `rolesAsignables`: `coordinacion` assigns only `secretaria` but sees
 * everyone. "Everyone" is written out rather than signalled, so the query
 * never needs an `if` that could omit the filter (design.md decision 18). An
 * empty row makes `inArray` emit literal `false`, i.e. zero rows — it fails
 * closed.
 */
export const rolesVisibles = {
  administrador: rolesUsuario,
  coordinacion: rolesUsuario,
  secretaria: ["docente"],
  docente: [],
  estudiante: [],
} as const satisfies Record<RolUsuario, readonly RolUsuario[]>;

export function rolesVisiblesPara(
  rol: RolUsuario | undefined,
): readonly RolUsuario[] {
  return rol ? rolesVisibles[rol] : [];
}

/**
 * Roles that may file justification requests (justification-intake). Typed
 * against `RolUsuario` so a renamed role is a compile error.
 */
export const rolesSolicitantes = [
  "estudiante",
] as const satisfies readonly RolUsuario[];

export function canFileRequests(rol: RolUsuario | undefined): boolean {
  return (
    rol !== undefined && (rolesSolicitantes as readonly string[]).includes(rol)
  );
}

/**
 * Roles that review and decide requests (secretary-review, RN-15). Typed
 * against `RolUsuario` so a renamed role is a compile error.
 */
export const rolesRevisores = [
  "secretaria",
] as const satisfies readonly RolUsuario[];

export function canReviewRequests(rol: RolUsuario | undefined): boolean {
  return (
    rol !== undefined && (rolesRevisores as readonly string[]).includes(rol)
  );
}

/**
 * Roles that answer an escalation of their own career (escalation, ES-9,
 * RNF-01). The coordinator never decides a request: `rolesRevisores` stays the
 * secretary alone.
 */
export const rolesCoordinadores = [
  "coordinacion",
] as const satisfies readonly RolUsuario[];

export function canCoordinate(rol: RolUsuario | undefined): boolean {
  return (
    rol !== undefined && (rolesCoordinadores as readonly string[]).includes(rol)
  );
}

/** What the document predicate needs to know about the document's request. */
export type ViewableDocument = {
  estudianteId: number;
  /** `Carrera.FacultadId` of the student's current career; null without one. */
  estudianteFacultadId: number | null;
  /** The student's current `CarreraId`; null without one. */
  estudianteCarreraId: number | null;
  solicitudEstado: string;
  /** Set when a correction retired the document (still `valido`). */
  retiradoEn: Date | null;
  /** The request has an open `sospecha_documento` escalation. */
  tieneEscalamientoAbierto: boolean;
};

const NO_COORDINATION: CoordinationScope = { kind: "none" };

/**
 * Who may read a supporting document (D15, SR-12). The owning student reads
 * their own documents in any state, retired ones included. A reviewing role
 * reads only inside its facultad scope, and only a request that is not a
 * draft. A coordinator reads only while a suspicion escalation of the request
 * is open for their career, and only a current document (the lookup returns
 * `valido` ones only; a retired one is refused here). Every other role, and a
 * `none` scope, is denied.
 */
export function canViewDocument(
  viewer: { id: number; rol: RolUsuario },
  doc: ViewableDocument,
  scope: RequestScope,
  coordination: CoordinationScope = NO_COORDINATION,
): boolean {
  if (canFileRequests(viewer.rol)) return viewer.id === doc.estudianteId;
  if (canCoordinate(viewer.rol)) {
    return (
      coordination.kind === "carrera" &&
      doc.estudianteCarreraId !== null &&
      coordination.carreraId === doc.estudianteCarreraId &&
      doc.solicitudEstado === "en_revision_coordinacion" &&
      doc.tieneEscalamientoAbierto &&
      doc.retiradoEn === null
    );
  }
  return (
    canReviewRequests(viewer.rol) &&
    scope.kind === "facultad" &&
    doc.estudianteFacultadId !== null &&
    scope.facultadId === doc.estudianteFacultadId &&
    isVisibleState(doc.solicitudEstado)
  );
}
