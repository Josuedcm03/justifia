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

/**
 * Forced/voluntary password change (FPC). The new-password rule is the one
 * registration applies (8 to 128 characters); no new policy is introduced.
 * The "differs from the current one" check is what stops a flagged user from
 * keeping the temporary password the importer knows.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual").max(128),
    newPassword: z.string().min(8, "Mínimo 8 caracteres").max(128),
    confirmPassword: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.confirmPassword !== v.newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden",
      });
    }
    if (v.newPassword === v.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "La nueva contraseña debe ser distinta de la actual",
      });
    }
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RolUsuario = z.infer<typeof rolUsuarioSchema>;
