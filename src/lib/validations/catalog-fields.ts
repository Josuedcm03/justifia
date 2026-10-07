import { z } from "zod";

import { PERIODO_RE } from "@/lib/import/normalize";

// Shared catalog field rules (design Decision 6). Pure: no I/O. The import
// schemas and the manual-maintenance schemas are built from these, so a
// manually created record matches the import's natural key byte for byte.
//
// Error `message`s are i18n KEYS (e.g. "horasTotales.required"), never prose.

// varchar lengths, verified against src/db/schema.ts:
//   asignatura.codigo   varchar("Codigo", { length: 32 })
//   *.nombre            varchar("Nombre", { length: 160 })
//   grupo.numeroGrupo   varchar("NumeroGrupo", { length: 12 })
export const CODIGO_MAX = 32;
export const NOMBRE_MAX = 160;
export const NUMERO_GRUPO_MAX = 12;

/** Required, trimmed string with a min length of 1 (empty counts as
 *  missing) and a max length matching the target DB column. */
export function requiredString(key: string, max: number) {
  return z
    .string({ error: `${key}.required` })
    .trim()
    .min(1, { message: `${key}.required` })
    .max(max, { message: `${key}.tooLong` });
}

/** `HorasTotales`: missing, `0`, negative, non-integer or non-numeric are
 *  all errors (AC: Non-positive or missing HorasTotales is rejected).
 *  Accepts a number or numeric string (Excel cells are numbers), never
 *  defaults a missing value (CEI: HorasTotales missing is a row error). */
export const horasTotalesSchema = z
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
export const numGrupoSchema = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  requiredString("numGrupo", NUMERO_GRUPO_MAX),
);

// `Periodo` is checked WITHOUT trimming: PERIODO_RE is anchored and
// whitespace-sensitive by design (normalize.ts: "case and content are left
// untouched so PERIODO_RE can reject anything that does not match exactly"),
// so a value with trailing whitespace must fail here rather than be
// silently trimmed into a valid period.
export const periodoSchema = z
  .string({ error: "periodo.required" })
  .min(1, { message: "periodo.required" })
  .regex(PERIODO_RE, { message: "periodo.invalid" });
