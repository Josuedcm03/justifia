import type { RolUsuario } from "@/lib/validations/auth";

/**
 * Roles allowed to see the users module and create staff accounts.
 * Students are the only role excluded. Kept free of `server-only` so client
 * components (sidebar) can share the same policy as the server guards.
 */
export const rolesQueGestionanUsuarios = [
  "secretaria",
  "administrador",
] as const satisfies readonly RolUsuario[];

export function canManageUsers(rol: RolUsuario | undefined): boolean {
  return (
    rol !== undefined &&
    (rolesQueGestionanUsuarios as readonly RolUsuario[]).includes(rol)
  );
}
