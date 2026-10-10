import { z } from "zod";

import { DIAS_SEMANA, isDiaSemana, type DiaSemana } from "@/lib/catalog/dias";
import {
  CODIGO_MAX,
  horasTotalesSchema,
  NOMBRE_MAX,
  numGrupoSchema,
  periodoSchema,
  requiredString,
} from "@/lib/validations/catalog-fields";

// Manual-maintenance schemas (design Decision 6). Pure: no I/O. Built from the
// shared field rules, so a manually created record matches the import's
// natural key byte for byte. They validate SHAPE only: referenced ids are
// re-validated inside the write transaction.
//
// Error `message`s are i18n KEYS resolved under `catalog.shared.fieldErrors`.
// The manual `numeroGrupo` field reuses the import's `numGrupoSchema`, whose
// keys are `numGrupo.*`.

const RECORD_ID_RE = /^[1-9][0-9]{0,14}$/;

/** A record id as submitted by a form: a string of 1-15 digits, no leading
 *  zero. Anything else (numbers, arrays, `null`, padding) is `null`. */
export function parseRecordId(raw: unknown): number | null {
  return typeof raw === "string" && RECORD_ID_RE.test(raw) ? Number(raw) : null;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** A required id field: `<key>.required` when blank, `<key>.invalid` else. */
function requiredId(key: string) {
  return z.unknown().transform((value, ctx) => {
    const id = parseRecordId(value);
    if (id === null) {
      ctx.addIssue({
        code: "custom",
        message: `${key}.${isBlank(value) ? "required" : "invalid"}`,
      });
      return z.NEVER;
    }
    return id;
  });
}

/** An optional id field: blank is absent (a scoped actor sends none). */
const optionalCarreraId = z
  .unknown()
  .transform((value, ctx) => {
    if (isBlank(value)) return undefined;
    const id = parseRecordId(value);
    if (id === null) {
      ctx.addIssue({ code: "custom", message: "carreraId.invalid" });
      return z.NEVER;
    }
    return id;
  })
  .optional();

export const asignaturaCreateSchema = z.object({
  codigo: requiredString("codigo", CODIGO_MAX),
  nombre: requiredString("nombre", NOMBRE_MAX),
  carreraId: optionalCarreraId,
  horasTotales: horasTotalesSchema,
});

/** No `codigo`: a submitted one is stripped (CM-ASG-2, AC-CODE). */
export const asignaturaUpdateSchema = z.object({
  nombre: requiredString("nombre", NOMBRE_MAX),
  carreraId: optionalCarreraId,
  horasTotales: horasTotalesSchema,
});

/** At most one entry per weekday; more raw entries cannot be a valid form. */
const DIAS_RAW_MAX = DIAS_SEMANA.length;

/** `DiaSemana[]` in week order, or the key of the one error to report. */
function parseDias(
  value: unknown,
): DiaSemana[] | "dias.required" | "dias.invalid" {
  if (!Array.isArray(value) || value.length > DIAS_RAW_MAX) {
    return "dias.invalid";
  }
  if (!value.every(isDiaSemana)) return "dias.invalid";
  if (value.length === 0) return "dias.required";
  return DIAS_SEMANA.filter((dia) => value.includes(dia));
}

/** The `formData.getAll("dias")` list of a form. A missing field (`undefined`)
 *  is reported as `missing`: `dias.invalid` standing alone, `dias.required`
 *  inside a Grupo schema, where it means the user chose nothing. */
function diasOf(missing: "dias.required" | "dias.invalid") {
  return z.unknown().transform((value, ctx) => {
    const result = value === undefined ? missing : parseDias(value);
    if (typeof result === "string") {
      ctx.addIssue({ code: "custom", message: result });
      return z.NEVER;
    }
    return result;
  });
}

/** The meeting days of a Grupo: an array of `DIAS_SEMANA` codes, collapsed and
 *  put in week order; empty is `dias.required`, anything else off is
 *  `dias.invalid` (CM-GRP-6, A-14). */
export const diasSchema = diasOf("dias.invalid");

export const grupoCreateSchema = z.object({
  asignaturaId: requiredId("asignaturaId"),
  periodo: periodoSchema,
  numeroGrupo: numGrupoSchema,
  docenteId: requiredId("docenteId"),
  dias: diasOf("dias.required"),
});

/** Only the docente and the days may change; the natural key is stripped
 *  (CM-GRP-2). The days are required even for a docente-only edit. */
export const grupoUpdateSchema = z.object({
  docenteId: requiredId("docenteId"),
  dias: diasOf("dias.required"),
});

/** Every message the schemas above can emit, in one closed list: the i18n
 *  parity test asserts `catalog.shared.fieldErrors` holds exactly these. */
export const CATALOG_FIELD_ERROR_KEYS = [
  "codigo.required",
  "codigo.tooLong",
  "nombre.required",
  "nombre.tooLong",
  "horasTotales.required",
  "horasTotales.invalid",
  "carreraId.invalid",
  "asignaturaId.required",
  "asignaturaId.invalid",
  "docenteId.required",
  "docenteId.invalid",
  "periodo.required",
  "periodo.invalid",
  "numGrupo.required",
  "numGrupo.tooLong",
  "dias.required",
  "dias.invalid",
] as const;

export type CatalogFieldErrorKey = (typeof CATALOG_FIELD_ERROR_KEYS)[number];
