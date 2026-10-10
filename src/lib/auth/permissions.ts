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
