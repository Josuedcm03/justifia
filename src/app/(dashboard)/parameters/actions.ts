"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { parameterWriteEvents } from "@/lib/audit/events";
import { requireParameterAccess } from "@/lib/auth/parameter-access";
import { actionOutcomes, type Translate } from "@/lib/catalog/action-helpers";
import { withCatalogWrite } from "@/lib/data/catalog-write";
import { managuaToday } from "@/lib/intake/dates";
import type { ParameterFormState } from "@/lib/parameters/form-state";
import {
  CALENDAR_MAX_ENTRIES,
  PARAMETER_KEYS,
  PARAMETER_REGISTRY,
  type ParameterChange,
  type ParameterWriteResult,
} from "@/lib/parameters/registry";
import { writeParameters } from "@/lib/parameters/write";

// Server Actions are reachable by a direct POST, so each one authorizes first
// (nothing of the body is read before the guard resolves), takes the actor only
// from the guard, reads only its own closed field set, and writes only through
// `withCatalogWrite`, which owns the lock, the transaction and the audit row.
// A save is submitted directly: the server holds no confirmation state (NP-8).
// None of them redirects; a guard denial redirects inside `requireRole`.

const PARAMETERS_PATH = "/parameters";

const { unexpected, failure } = actionOutcomes("parameters.errors.unexpected");

/** A form field as text; anything that is not a string (a file) is empty. */
function text(formData: FormData, key: string): string {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw : "";
}

/**
 * A whole-value field (calendar, map, causes): its text, kept to echo back, and
 * the JSON it parses to. A text that is not JSON parses to `undefined`, which
 * the registry schema refuses like any other wrong shape.
 */
function jsonField(
  formData: FormData,
  key: string,
): { raw: string; value: unknown } {
  const raw = text(formData, key);
  try {
    return { raw, value: JSON.parse(raw) };
  } catch {
    return { raw, value: undefined };
  }
}

/**
 * The one write every action ends with: the changes go through the lock, the
 * write path and the audit rows in one transaction, dated today in Managua. The
 * result decides the outcome; a refusal of the write itself is a field error on
 * the key it names, with the submitted `values` kept (NP-9).
 */
async function save(
  actorId: number,
  changes: readonly ParameterChange[],
  values: Readonly<Record<string, string>>,
  t: Translate,
): Promise<ParameterFormState> {
  const today = managuaToday(new Date());

  let result: ParameterWriteResult;
  try {
    result = await withCatalogWrite(
      actorId,
      (tx) => writeParameters(tx, changes, today),
      parameterWriteEvents,
    );
  } catch (error) {
    return failure(error, t);
  }

  switch (result.kind) {
    case "updated":
      revalidatePath(PARAMETERS_PATH);
      return { kind: "saved" };
    case "unchanged":
      return { kind: "unchanged" };
    case "invalid":
      return {
        kind: "invalid",
        fieldErrors: {
          [result.clave]:
            result.reason === "alert_not_below_remission"
              ? t("parameters.errors.alert_not_below_remission")
              : t("parameters.errors.invalid"),
        },
        values,
      };
    default:
      return unexpected(t);
  }
}

// ---- Scalars (NP-7) --------------------------------------------------------

// The six keys that carry an integer range: derived from the registry, never a
// second list. The same range feeds the validation and the message.
const SCALARS = PARAMETER_KEYS.flatMap((key) => {
  const { range } = PARAMETER_REGISTRY[key];
  return range ? [{ key, range }] : [];
});

const SCALAR_ERRORS = {
  required: "parameters.errors.required",
  not_integer: "parameters.errors.not_integer",
  too_low: "parameters.errors.too_low",
  too_high: "parameters.errors.too_high",
} as const;

type Range = { min: number; max: number };

/** Typed digits to a number, or the code of what is wrong with them. */
function parseScalar(
  raw: string,
  { min, max }: Range,
): { value: number } | { error: keyof typeof SCALAR_ERRORS } {
  const typed = raw.trim();
  if (typed === "") return { error: "required" };
  if (!/^-?\d+$/.test(typed)) return { error: "not_integer" };
  const value = Number(typed);
  if (value < min) return { error: "too_low" };
  if (value > max) return { error: "too_high" };
  return { value };
}

export async function saveScalarParametersAction(
  _prev: ParameterFormState,
  formData: FormData,
): Promise<ParameterFormState> {
  const { actorId } = await requireParameterAccess();
  const t = await getTranslations();

  // Only the six scalar keys are read: a submitted `calendario`, `causas`, an
  // unknown key, an actor or a confirmation marker is never even looked at.
  const values: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  const changes: ParameterChange[] = [];
  for (const { key, range } of SCALARS) {
    values[key] = text(formData, key);
    const parsed = parseScalar(values[key], range);
    if ("error" in parsed) {
      fieldErrors[key] = t(SCALAR_ERRORS[parsed.error], {
        min: range.min,
        max: range.max,
      });
    } else {
      changes.push({ clave: key, valor: parsed.value } as ParameterChange);
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { kind: "invalid", fieldErrors, values };
  }

  return save(actorId, changes, values, t);
}

// ---- Calendar (NP-10) ------------------------------------------------------

const CALENDAR_ERRORS = {
  date_invalid: "parameters.errors.calendar.date_invalid",
  date_duplicate: "parameters.errors.calendar.date_duplicate",
  description_too_long: "parameters.errors.calendar.description_too_long",
} as const;

/** A blank or missing description is none: it is optional (NP-10). Anything
 *  else is left as sent, so the strict entry schema refuses it. */
function withBlankDescriptionAsNone(entry: unknown): unknown {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return entry;
  }
  const { descripcion, ...rest } = entry as Record<string, unknown>;
  const blank =
    descripcion === undefined ||
    (typeof descripcion === "string" && descripcion.trim() === "");
  return { ...rest, descripcion: blank ? null : descripcion };
}

/** One message per place: a row's own date or description, else the list. */
function calendarErrors(t: Translate, error: ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const [index, field] = issue.path;
    const key =
      issue.path.length === 2
        ? `${String(field)}.${String(index)}`
        : "calendario";
    if (key in out) continue;
    if (issue.code === "too_big" && issue.path.length === 0) {
      out[key] = t("parameters.errors.calendar.too_many", {
        max: CALENDAR_MAX_ENTRIES,
      });
    } else if (Object.hasOwn(CALENDAR_ERRORS, issue.message)) {
      out[key] = t(
        CALENDAR_ERRORS[issue.message as keyof typeof CALENDAR_ERRORS],
      );
    } else {
      out[key] = t("parameters.errors.calendar.invalid");
    }
  }
  return out;
}

export async function saveCalendarAction(
  _prev: ParameterFormState,
  formData: FormData,
): Promise<ParameterFormState> {
  const { actorId } = await requireParameterAccess();
  const t = await getTranslations();

  // Only the calendar field is read: the whole list in one value.
  const { raw, value } = jsonField(formData, "calendario");
  const values = { calendario: raw };
  const parsed = PARAMETER_REGISTRY.calendario.schema.safeParse(
    Array.isArray(value) ? value.map(withBlankDescriptionAsNone) : value,
  );
  if (!parsed.success) {
    return {
      kind: "invalid",
      fieldErrors: calendarErrors(t, parsed.error),
      values,
    };
  }

  return save(
    actorId,
    [{ clave: "calendario", valor: parsed.data }],
    values,
    t,
  );
}

// ---- Whole-value forms: the type-to-cause map (NP-12) ----------------------

/**
 * A form that is one whole value in one field named by its key. The registry
 * schema is the validation: the first issue whose message has copy in `errors`
 * picks the text, any other issue gets `errors.invalid`. The refusal sits on
 * the key's own field.
 */
async function saveWholeValue(
  actorId: number,
  clave: "causas" | "tipo_documento_causa",
  errors: Readonly<Record<string, string>> & { invalid: string },
  formData: FormData,
  t: Translate,
): Promise<ParameterFormState> {
  const { raw, value } = jsonField(formData, clave);
  const values = { [clave]: raw };
  const parsed = PARAMETER_REGISTRY[clave].schema.safeParse(value);
  if (!parsed.success) {
    const code =
      parsed.error.issues.find((issue) => Object.hasOwn(errors, issue.message))
        ?.message ?? "invalid";
    return {
      kind: "invalid",
      fieldErrors: { [clave]: t(errors[code]) },
      values,
    };
  }
  return save(
    actorId,
    [{ clave, valor: parsed.data } as ParameterChange],
    values,
    t,
  );
}

export async function saveDocumentTypeCausesAction(
  _prev: ParameterFormState,
  formData: FormData,
): Promise<ParameterFormState> {
  const { actorId } = await requireParameterAccess();
  const t = await getTranslations();

  // Only the map field is read; `otro` is part of its value and must be empty.
  return saveWholeValue(
    actorId,
    "tipo_documento_causa",
    { invalid: "parameters.errors.map.invalid" },
    formData,
    t,
  );
}

// ---- Causes (NP-11) --------------------------------------------------------

export async function saveCausesAction(
  _prev: ParameterFormState,
  formData: FormData,
): Promise<ParameterFormState> {
  const { actorId } = await requireParameterAccess();
  const t = await getTranslations();

  // Only the list is read. Deactivating a cause is confirmed in the browser,
  // before the form is submitted: the server takes no marker for it (NP-8).
  return saveWholeValue(
    actorId,
    "causas",
    {
      no_active_cause: "parameters.errors.causes.no_active_cause",
      invalid: "parameters.errors.causes.invalid",
    },
    formData,
    t,
  );
}
