import { z } from "zod";

import {
  CODIGO_MAX,
  NOMBRE_MAX,
  horasTotalesSchema,
  numGrupoSchema,
  periodoSchema,
  requiredString,
} from "@/lib/validations/catalog-fields";

import { deriveLogin } from "./normalize";

// Per-sheet zod schemas (D6, decision noted in design.md's File Changes
// table: "Per-sheet zod schemas"). Pure: no I/O, no xlsx import here.
//
// Error `message`s are i18n KEYS (e.g. "horasTotales.required"), never
// prose: the import UI (WU3b) resolves each key against es/en catalogs.
// Never put human-readable text in a zod `message` here.

// varchar lengths, verified against src/db/schema.ts:
//   asignatura.codigo   varchar("Codigo", { length: 32 })
//   *.nombre            varchar("Nombre", { length: 160 })  (asignatura, carrera, usuario.nombreCompleto)
//   grupo.numeroGrupo   varchar("NumeroGrupo", { length: 12 })
//   usuario.correo      varchar("Correo", { length: 160 })
//   usuario.telefono    varchar("Telefono", { length: 30 })
const CORREO_MAX = 160;
const TELEFONO_MAX = 30;

/** Required email, syntax-checked, trimmed, capped at the DB column length.
 *  Deliberately does NOT normalize (lowercase/trim beyond whitespace) the
 *  value here: normalization happens once in `normalize.ts`/`plan.ts` so
 *  this schema stays a pure structural gate. */
function requiredEmail(key: string, max: number) {
  return requiredString(key, max).pipe(
    z.string().email({ message: `${key}.invalid` }),
  );
}

/** Adds a row error at `Correo`/`CorreoDocente` when the normalized email
 *  exceeds `deriveLogin`'s LOGIN_MAX (60), even though the DB column allows
 *  up to 160: Login is derived from the whole email (decision 7). */
function checkLoginLength(correoField: "Correo" | "CorreoDocente") {
  return (data: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const correo = data[correoField];
    if (typeof correo !== "string") return;
    const derived = deriveLogin(correo);
    if ("error" in derived) {
      ctx.addIssue({
        code: "custom",
        path: [correoField],
        message: "correo.loginTooLong",
      });
    }
  };
}

export const AsignaturaRowSchema = z.object({
  Codigo: requiredString("codigo", CODIGO_MAX),
  Nombre: requiredString("nombre", NOMBRE_MAX),
  Carrera: requiredString("carrera", NOMBRE_MAX),
  HorasTotales: horasTotalesSchema,
});

export type AsignaturaRow = z.infer<typeof AsignaturaRowSchema>;

export const DocenteRowSchema = z
  .object({
    Correo: requiredEmail("correo", CORREO_MAX),
    Nombre: requiredString("nombre", NOMBRE_MAX),
    Telefono: z
      .string()
      .trim()
      .max(TELEFONO_MAX, { message: "telefono.tooLong" })
      .optional(),
  })
  .superRefine(checkLoginLength("Correo"));

export type DocenteRow = z.infer<typeof DocenteRowSchema>;

export const GrupoRowSchema = z
  .object({
    CodigoAsignatura: requiredString("codigoAsignatura", CODIGO_MAX),
    Periodo: periodoSchema,
    NumGrupo: numGrupoSchema,
    CorreoDocente: requiredEmail("correoDocente", CORREO_MAX),
    // Raw cell, kept as written: absent column = no key, empty cell = "". The
    // day tokens are parsed (and `dias.invalid` raised) by the planner.
    Dias: z.string().optional(),
  })
  .superRefine(checkLoginLength("CorreoDocente"));

export type GrupoRow = z.infer<typeof GrupoRowSchema>;
