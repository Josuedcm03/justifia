import { z } from "zod";

import { rolesUsuario } from "@/lib/validations/auth";

/**
 * Roles que se dan de alta desde el panel de administración, no por
 * autorregistro (modelo_datos_sql.md §2, sin `estudiante`).
 */
export const rolesStaff = rolesUsuario.filter(
  (rol) => rol !== "estudiante",
) as Exclude<(typeof rolesUsuario)[number], "estudiante">[];

export const rolStaffSchema = z.enum(rolesStaff as [string, ...string[]]);

export const registroEstudianteSchema = z.object({
  login: z.string().trim().min(1, "Ingresa un usuario").max(60),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
  nombreCompleto: z.string().trim().min(1, "Ingresa tu nombre").max(160),
  correo: z
    .string()
    .trim()
    .min(1, "Ingresa tu correo")
    .email("Correo inválido")
    .max(160),
  telefono: z
    .union([z.literal(""), z.string().trim().max(30)])
    .optional()
    .transform((v) => (v ? v : undefined)),
  cif: z.string().trim().min(1, "Ingresa tu CIF").max(20),
  carreraId: z.coerce.number().int().positive("Selecciona una carrera"),
});

export type RegistroEstudianteInput = z.infer<typeof registroEstudianteSchema>;

/**
 * Staff creation (FE-27, FE-28). There is no `login` key: the server derives the
 * Login from the email, and any `login` in the request is dropped by the parse.
 * The email is required for every role, stored trimmed and lower-case, and at
 * most the 160 characters of `Usuario.Correo`.
 */
export const crearStaffSchema = z.object({
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
  nombreCompleto: z.string().trim().min(1, "Ingresa el nombre").max(160),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Ingresa el correo")
    .email("Correo inválido")
    .max(160),
  telefono: z
    .union([z.literal(""), z.string().trim().max(30)])
    .optional()
    .transform((v) => (v ? v : undefined)),
  rol: rolStaffSchema,
  carreraId: z
    .union([z.literal(""), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type CrearStaffInput = z.infer<typeof crearStaffSchema>;
