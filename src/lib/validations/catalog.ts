import { z } from "zod";

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

export const grupoCreateSchema = z.object({
  asignaturaId: requiredId("asignaturaId"),
  periodo: periodoSchema,
  numeroGrupo: numGrupoSchema,
  docenteId: requiredId("docenteId"),
});

/** Only the docente may change; the natural key is stripped (CM-GRP-2). */
export const grupoUpdateSchema = z.object({
  docenteId: requiredId("docenteId"),
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
] as const;

export type CatalogFieldErrorKey = (typeof CATALOG_FIELD_ERROR_KEYS)[number];
