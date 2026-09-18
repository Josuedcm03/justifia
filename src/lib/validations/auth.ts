import { z } from "zod";

/**
 * Roles de Usuario (modelo_datos_sql.md §2). Enumeración diferida en la base de
 * datos (columna VARCHAR); aquí se valida en la aplicación.
 */
export const rolesUsuario = [
  "estudiante",
  "docente",
  "coordinacion",
  "secretaria",
  "administrador",
] as const;

export const rolUsuarioSchema = z.enum(rolesUsuario);

export const loginSchema = z.object({
  login: z.string().trim().min(1, "Ingresa tu usuario").max(60),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RolUsuario = z.infer<typeof rolUsuarioSchema>;
