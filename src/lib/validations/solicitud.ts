import { z } from "zod";

import { isCausa } from "@/lib/intake/causes";
import { isEndWithinWindow, isIsoDate } from "@/lib/intake/dates";

// Step schemas of the intake flow (RF-03). Every message is an i18n key, so the
// UI only translates (`intake.errors.<code>` in es.json / en.json). The codes
// match the ones `validateSubmission` reports, so a field shows the same text
// whether the error came from saving a step or from the final submit.

export const ERROR_KEY_PREFIX = "intake.errors.";

export function errorKey(code: string): string {
  return `${ERROR_KEY_PREFIX}${code}`;
}

/** What an action returns for an invalid field. */
export type FieldError = { field: string; key: string; asignaturaId?: number };

export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: String(issue.path[0] ?? "form"),
    key: issue.message,
  }));
}

function required(code: string) {
  const message = errorKey(code);
  return z.string({ error: message }).min(1, { error: message, abort: true });
}

/**
 * Step 1: cause and dates. `today` is the Managua date of the action's `now`.
 * A correction passes `filingWindow: false`: RN-23 was met when the request was
 * first presented and is not re-applied (RF-08 c); RN-05 always applies.
 */
export function makeDetailsStepSchema(
  today: string,
  { filingWindow = true }: { filingWindow?: boolean } = {},
) {
  return z
    .object({
      causa: required("causa_required").refine(isCausa, {
        error: errorKey("causa_invalid"),
      }),
      fechaInicio: required("start_required").refine(isIsoDate, {
        error: errorKey("start_invalid"),
      }),
      fechaFin: required("end_required").refine(isIsoDate, {
        error: errorKey("end_invalid"),
      }),
    })
    .superRefine((value, ctx) => {
      if (!isIsoDate(value.fechaInicio) || !isIsoDate(value.fechaFin)) return;
      const code =
        value.fechaFin < value.fechaInicio
          ? "end_before_start"
          : !filingWindow || isEndWithinWindow(value.fechaFin, today)
            ? null
            : "end_too_old";
      if (code) {
        ctx.addIssue({
          code: "custom",
          path: ["fechaFin"],
          message: errorKey(code),
        });
      }
    });
}

const id = z.number().int().positive();

/** Step 2: picked subjects; `grupoId` is null when the enrollment decides. */
export const subjectsStepSchema = z.object({
  selections: z.array(z.object({ asignaturaId: id, grupoId: id.nullable() })),
});

/** Step 3: a file already uploaded to the store, to be finalized. */
export const finalizeDocumentSchema = z.object({
  pathname: z.string().min(1).max(255),
  nombreOriginal: z.string().max(1024),
});

export const documentIdSchema = id;
