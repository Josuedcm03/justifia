import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

/**
 * Display names for the role catalog (design.md §"Interfaces"). Built as a
 * `Record<RolUsuario, string>` so adding a role to `rolesUsuario` is a
 * compile error here until its display name exists. `Nombre` is
 * documentation, not the i18n source (state.yaml assumption).
 */
const nombresPorCodigo: Record<RolUsuario, string> = {
  estudiante: "Estudiante",
  docente: "Docente",
  coordinacion: "Coordinación",
  secretaria: "Secretaría",
  administrador: "Administrador",
};

export const rolesSeed: { codigo: RolUsuario; nombre: string }[] =
  rolesUsuario.map((codigo) => ({ codigo, nombre: nombresPorCodigo[codigo] }));
