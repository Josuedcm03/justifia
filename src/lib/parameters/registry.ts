import { z } from "zod";

import { type TipoDocumento } from "@/lib/document-data/types";
import { CAUSAS, type Causa } from "@/lib/intake/causes";
import { isIsoDate } from "@/lib/intake/dates";
import type { DocumentTypeCauses } from "@/lib/signals/document-marks";
import { DOCUMENT_TYPE_CAUSES } from "@/lib/signals/document-type-causes";
import { DEFAULT_SIGNAL_PARAMS } from "@/lib/signals/params";

import { DEFAULT_NON_WORKING_DAYS } from "./defaults";

// The closed registry of normative parameters (RNF-14, NP-2). Each key has a
// validation schema, a default and, for a scalar, an inclusive integer range.
// The defaults are the Reglamento baseline: after this change they live only
// here, as the fallback the loader uses (NP-15). Pure, with no "server-only",
// so the loader, the write path, the forms and the tests share one list.

export const PARAMETER_KEYS = [
  "plazo_remision_dias",
  "alerta_dias",
  "presentacion_tardia_dias",
  "ventana_presentacion_dias",
  "umbral_reincidencia",
  "tamano_maximo_mib",
  "calendario",
  "causas",
  "tipo_documento_causa",
] as const;

export type ParameterKey = (typeof PARAMETER_KEYS)[number];

/** One non-working date of the RN-08 calendar (NP-10). */
export type NonWorkingDay = {
  fecha: string;
  descripcion: string | null;
};

/** The active flag and the position of one of the five causes (NP-11). */
export type CauseSetting = {
  codigo: Causa;
  activa: boolean;
  posicion: number;
};

/** One requested change of a key (the write path validates `valor`). */
export type ParameterChange = {
  [K in ParameterKey]: { clave: K; valor: unknown };
}[ParameterKey];

/** A change that was written: the effective value before and after (A9). */
export type AppliedChange = {
  clave: ParameterKey;
  antes: unknown;
  despues: unknown;
};

export type ParameterWriteResult =
  | { kind: "updated"; changes: readonly AppliedChange[] }
  | { kind: "unchanged" }
  | {
      kind: "invalid";
      clave: ParameterKey;
      reason: "schema" | "alert_not_below_remission";
    };

export type NormativeParameters = {
  remissionBusinessDays: number;
  alertBusinessDays: number;
  lateFilingBusinessDays: number;
  filingWindowDays: number;
  issuerRecurrenceThreshold: number;
  maxDocumentMib: number;
  nonWorkingDays: readonly NonWorkingDay[];
  causes: readonly CauseSetting[];
  documentTypeCauses: DocumentTypeCauses;
};

// The Reglamento baseline. The threshold and the map point at the values the
// signals module keeps for its own callers (design A10), so there is one value.
export const DEFAULT_PARAMETERS: NormativeParameters = {
  remissionBusinessDays: 2,
  alertBusinessDays: 1,
  lateFilingBusinessDays: 2,
  filingWindowDays: 30,
  issuerRecurrenceThreshold: DEFAULT_SIGNAL_PARAMS.issuerRecurrenceThreshold,
  maxDocumentMib: 10,
  nonWorkingDays: DEFAULT_NON_WORKING_DAYS,
  causes: CAUSAS.map((codigo, index) => ({
    codigo,
    activa: true,
    posicion: index + 1,
  })),
  documentTypeCauses: DOCUMENT_TYPE_CAUSES,
};

/** A scalar is a JSON integer inside an inclusive range (NP-2). */
function scalar(min: number, max: number) {
  return z.number().int().min(min).max(max);
}

const CALENDAR_MAX_ENTRIES = 1000;
const DESCRIPTION_MAX_LENGTH = 120;

function isUnique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

// NP-10: real calendar dates, none twice, an optional description of at most
// 120 characters, at most 1000 entries (an input bound), stored ascending.
const calendarSchema = z
  .array(
    z.strictObject({
      fecha: z.string().refine(isIsoDate, "date_invalid"),
      descripcion: z
        .string()
        .trim()
        .min(1, "description_empty")
        .max(DESCRIPTION_MAX_LENGTH, "description_too_long")
        .nullable(),
    }),
  )
  .max(CALENDAR_MAX_ENTRIES)
  .refine((entries) => isUnique(entries.map((e) => e.fecha)), "date_duplicate")
  .transform((entries) =>
    [...entries].sort((a, b) =>
      a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0,
    ),
  );

const POSITIONS = CAUSAS.length;

// NP-11: exactly the five codes once each, the positions a permutation of 1 to
// 5, at least one cause active; stored by position. The codes are fixed, so a
// sixth code, a repeat or an omission fails.
const causesSchema = z
  .array(
    z.strictObject({
      codigo: z.enum(CAUSAS),
      activa: z.boolean(),
      posicion: scalar(1, POSITIONS),
    }),
  )
  .length(POSITIONS)
  .refine((items) => isUnique(items.map((c) => c.codigo)), "code_repeated")
  .refine(
    (items) => isUnique(items.map((c) => c.posicion)),
    "position_repeated",
  )
  .refine((items) => items.some((c) => c.activa), "no_active_cause")
  .transform((items) => [...items].sort((a, b) => a.posicion - b.posicion));

const causeSetSchema = z
  .array(z.enum(CAUSAS))
  .refine(isUnique, "cause_repeated");

// NP-12: every document type is present, each set holds only the five codes
// without repeats, and `otro` is exactly empty because it corresponds to no
// cause (Annex D D11). A type outside the list fails (strict object).
const documentTypeCausesSchema = z.strictObject({
  constancia_medica: causeSetSchema,
  constancia_institucional: causeSetSchema,
  otro: z.tuple([]),
} satisfies Record<TipoDocumento, z.ZodType>);

type RegistryEntry = {
  field: keyof NormativeParameters;
  schema: z.ZodType;
  default: unknown;
  range?: { min: number; max: number };
};

function scalarEntry(
  field: keyof NormativeParameters,
  min: number,
  max: number,
): RegistryEntry {
  return {
    field,
    schema: scalar(min, max),
    default: DEFAULT_PARAMETERS[field],
    range: { min, max },
  };
}

export const PARAMETER_REGISTRY: {
  readonly [K in ParameterKey]: RegistryEntry;
} = {
  plazo_remision_dias: scalarEntry("remissionBusinessDays", 1, 10),
  // The alert stays below the remission deadline: a cross-key rule the write
  // path checks against the merged values (design A16), not a schema.
  alerta_dias: scalarEntry("alertBusinessDays", 0, 10),
  presentacion_tardia_dias: scalarEntry("lateFilingBusinessDays", 1, 10),
  ventana_presentacion_dias: scalarEntry("filingWindowDays", 1, 365),
  umbral_reincidencia: scalarEntry("issuerRecurrenceThreshold", 2, 20),
  // The upper end is the existing database check `CK_Documento_Tamano`
  // (10 MiB): a larger value could not be stored (A19, size-ceiling.test.ts).
  tamano_maximo_mib: scalarEntry("maxDocumentMib", 1, 10),
  calendario: {
    field: "nonWorkingDays",
    schema: calendarSchema,
    default: DEFAULT_PARAMETERS.nonWorkingDays,
  },
  causas: {
    field: "causes",
    schema: causesSchema,
    default: DEFAULT_PARAMETERS.causes,
  },
  tipo_documento_causa: {
    field: "documentTypeCauses",
    schema: documentTypeCausesSchema,
    default: DEFAULT_PARAMETERS.documentTypeCauses,
  },
};

/**
 * The effective values from the rows in force (one per key at most). Pure:
 * a key outside the registry is ignored; a missing or invalid key takes its own
 * default and joins `fallback`, and never changes another key (NP-2, NP-4).
 */
export function resolveParameters(
  rows: readonly { clave: string; valor: unknown }[],
): { values: NormativeParameters; fallback: readonly ParameterKey[] } {
  const values: Record<string, unknown> = { ...DEFAULT_PARAMETERS };
  const fallback: ParameterKey[] = [];
  for (const key of PARAMETER_KEYS) {
    const { field, schema } = PARAMETER_REGISTRY[key];
    const row = rows.find((candidate) => candidate.clave === key);
    const parsed = row === undefined ? null : schema.safeParse(row.valor);
    if (parsed?.success) {
      values[field] = parsed.data;
    } else {
      fallback.push(key);
    }
  }
  return { values: values as NormativeParameters, fallback };
}
