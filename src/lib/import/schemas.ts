import { z } from "zod";

import { deriveLogin, PERIODO_RE } from "./normalize";

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
const CODIGO_MAX = 32;
const NOMBRE_MAX = 160;
const NUMERO_GRUPO_MAX = 12;
const CORREO_MAX = 160;
const TELEFONO_MAX = 30;

/** Required, trimmed string with a min length of 1 (empty counts as
 *  missing) and a max length matching the target DB column. */
function requiredString(key: string, max: number) {
  return z
    .string({ error: `${key}.required` })
    .trim()
    .min(1, { message: `${key}.required` })
    .max(max, { message: `${key}.tooLong` });
}

/** Required email, syntax-checked, trimmed, capped at the DB column length.
 *  Deliberately does NOT normalize (lowercase/trim beyond whitespace) the
 *  value here: normalization happens once in `normalize.ts`/`plan.ts` so
 *  this schema stays a pure structural gate. */
function requiredEmail(key: string, max: number) {
  return requiredString(key, max).pipe(
    z.string().email({ message: `${key}.invalid` }),
  );
}

/** `HorasTotales`: missing, `0`, negative, non-integer or non-numeric are
 *  all row errors (AC: Non-positive or missing HorasTotales is rejected).
 *  Accepts a number or numeric string (Excel cells are numbers), never
 *  defaults a missing value (CEI: HorasTotales missing is a row error). */
const horasTotalesSchema = z
  .union([z.string(), z.number()], { error: "horasTotales.required" })
  .transform((value, ctx) => {
    const raw = typeof value === "number" ? value : value.trim();
    if (raw === "") {
      ctx.addIssue({ code: "custom", message: "horasTotales.required" });
      return z.NEVER;
    }
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(num) || num <= 0) {
      ctx.addIssue({ code: "custom", message: "horasTotales.invalid" });
      return z.NEVER;
    }
    return num;
  });

/** `NumGrupo` cells arrive as either a string or a number (Excel stores a
 *  cell like `1` as a JS number). Both are coerced to a trimmed string
 *  before the length cap is enforced (X3: NumeroGrupo policy is trim only,
 *  never numeric normalization). */
const numGrupoSchema = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  requiredString("numGrupo", NUMERO_GRUPO_MAX),
);

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

// `Periodo` is checked WITHOUT trimming: PERIODO_RE is anchored and
// whitespace-sensitive by design (normalize.ts: "case and content are left
// untouched so PERIODO_RE can reject anything that does not match exactly"),
// so a value with trailing whitespace must fail here rather than be
// silently trimmed into a valid period.
const periodoSchema = z
  .string({ error: "periodo.required" })
  .min(1, { message: "periodo.required" })
  .regex(PERIODO_RE, { message: "periodo.invalid" });

export const GrupoRowSchema = z
  .object({
    CodigoAsignatura: requiredString("codigoAsignatura", CODIGO_MAX),
    Periodo: periodoSchema,
    NumGrupo: numGrupoSchema,
    CorreoDocente: requiredEmail("correoDocente", CORREO_MAX),
  })
  .superRefine(checkLoginLength("CorreoDocente"));

export type GrupoRow = z.infer<typeof GrupoRowSchema>;
