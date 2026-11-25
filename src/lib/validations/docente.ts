import { z } from "zod";

import { NOMBRE_MAX, requiredString } from "@/lib/validations/catalog-fields";

// Docente maintenance schema (DM-3). Pure: no I/O. Error `message`s are i18n
// KEYS resolved under `catalog.shared.fieldErrors`. Shape only: the duplicate
// check (DM-4) runs inside the write transaction.

// varchar lengths, verified against src/db/schema.ts:
//   usuario.correo    varchar("Correo", { length: 160 })
//   usuario.telefono  varchar("Telefono", { length: 30 })
export const CORREO_MAX = 160;
export const TELEFONO_MAX = 30;

/**
 * The three editable fields and no others: `login`, `hashClave`, `rol`,
 * `activo`, `cif`, `carreraId`, `facultadId` and `debeCambiarClave` are
 * stripped by the parse. The email is required, trimmed and stored in lower
 * case; an absent or blank phone becomes `null` (it clears the stored one).
 */
export const docenteUpdateSchema = z.object({
  nombreCompleto: requiredString("nombre", NOMBRE_MAX),
  correo: z
    .string({ error: "correo.required" })
    .trim()
    .toLowerCase()
    .min(1, { message: "correo.required" })
    .email({ message: "correo.invalid" })
    .max(CORREO_MAX, { message: "correo.tooLong" }),
  telefono: z
    .string()
    .trim()
    .max(TELEFONO_MAX, { message: "telefono.tooLong" })
    .nullish()
    .transform((value) => value || null),
});

export type DocenteUpdateInput = z.infer<typeof docenteUpdateSchema>;
