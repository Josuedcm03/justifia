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

/** Derived, never hand-listed — spread into `requireRole` at every call site. */
export const rolesQueCreanUsuarios: RolUsuario[] =
  rolesUsuario.filter(canCreateUsers);
