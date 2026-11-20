import { isIsoDate } from "@/lib/intake/dates";

import {
  TIPOS_DOCUMENTO,
  type DocumentMarks,
  type ManualFields,
  type TipoDocumento,
} from "./types";

// Structural validation of what a secretary records for one document
// (manual-document-data, MD-3, MD-4, MD-5; D7, D8). Structure only: lengths,
// real calendar dates, the rest period as both dates or neither with from not
// after to, the type from the closed list and each mark true, false or null. No
// plausibility window applies to a manual value. Pure: no database, no
// "server-only".
//
// The payload is the complete state of the eight values, `null` meaning empty
// (a cleared manual value, a mark or a type not registered). The result carries
// the same eight values, trimmed with an empty one turned into null, and the
// rest dates are both set or both null: the writer relies on `restFrom` alone
// to know whether any manual value remains, which is safe only under that rule.
// The day count of a rest period is derived where it is read, never entered
// here and never stored.

export const NAME_MAX_LENGTH = 160;
export const ISSUER_MAX_LENGTH = 200;

export const DOCUMENT_DATA_ERROR_CODES = [
  "text_too_long",
  "date_invalid",
  "rest_incomplete",
  "rest_order",
  "type_invalid",
  "mark_invalid",
] as const;

export type DocumentDataErrorCode = (typeof DOCUMENT_DATA_ERROR_CODES)[number];

/** The fields an error can sit on. The rest period is one field: its two
 *  dates are entered and refused together (MD-3). */
export type DocumentDataErrorField =
  | "studentName"
  | "issuer"
  | "issueDate"
  | "rest"
  | "type"
  | "hasSignature"
  | "hasSeal";

export type DocumentDataErrors = Partial<
  Record<DocumentDataErrorField, DocumentDataErrorCode>
>;

/** The text and dates are strings or null; the type and the marks arrive from
 *  a select and two radio groups, so they are checked rather than trusted. */
export type DocumentDataPayload = {
  studentName: string | null;
  issuer: string | null;
  issueDate: string | null;
  restFrom: string | null;
  restTo: string | null;
  type: unknown;
  hasSignature: unknown;
  hasSeal: unknown;
};

export type ValidatedDocumentData = ManualFields & DocumentMarks;

export type ValidateDocumentDataResult =
  | { ok: true; data: ValidatedDocumentData }
  | { ok: false; errors: DocumentDataErrors };

/**
 * Trimmed text, or null when it is empty (D8). The type says string or null; a
 * caller that passes anything else has a bug, and it must not clear a stored
 * value by accident, so it throws (the message holds no submitted value).
 */
function normalize(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError("A text or date value must be a string or null");
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Characters as `varchar(n)` counts them: code points, not UTF-16 units. */
function lengthOf(text: string): number {
  return Array.from(text).length;
}

function isTipoDocumento(value: unknown): value is TipoDocumento {
  return TIPOS_DOCUMENTO.some((type) => type === value);
}

function checkText(
  value: string | null,
  max: number,
): DocumentDataErrorCode | null {
  return value !== null && lengthOf(value) > max ? "text_too_long" : null;
}

/** A date is null (empty) or a real calendar date. */
function checkDate(value: string | null): DocumentDataErrorCode | null {
  return value !== null && !isIsoDate(value) ? "date_invalid" : null;
}

/** `date_invalid` outranks `rest_incomplete`, which outranks `rest_order`. */
function checkRest(
  from: string | null,
  to: string | null,
): DocumentDataErrorCode | null {
  const invalid = checkDate(from) ?? checkDate(to);
  if (invalid) return invalid;
  if ((from === null) !== (to === null)) return "rest_incomplete";
  return from !== null && to !== null && to < from ? "rest_order" : null;
}

function checkMark(value: unknown): DocumentDataErrorCode | null {
  return value === null || typeof value === "boolean" ? null : "mark_invalid";
}

/** The type is null, an empty string (not registered) or one of the list. */
function checkType(value: unknown): DocumentDataErrorCode | null {
  if (value === null || value === "") return null;
  return isTipoDocumento(value) ? null : "type_invalid";
}

export function validateDocumentData(
  payload: DocumentDataPayload,
): ValidateDocumentDataResult {
  const studentName = normalize(payload.studentName);
  const issuer = normalize(payload.issuer);
  const issueDate = normalize(payload.issueDate);
  const restFrom = normalize(payload.restFrom);
  const restTo = normalize(payload.restTo);

  const checks: [DocumentDataErrorField, DocumentDataErrorCode | null][] = [
    ["studentName", checkText(studentName, NAME_MAX_LENGTH)],
    ["issuer", checkText(issuer, ISSUER_MAX_LENGTH)],
    ["issueDate", checkDate(issueDate)],
    ["rest", checkRest(restFrom, restTo)],
    ["type", checkType(payload.type)],
    ["hasSignature", checkMark(payload.hasSignature)],
    ["hasSeal", checkMark(payload.hasSeal)],
  ];
  const errors: DocumentDataErrors = {};
  for (const [field, code] of checks) {
    if (code !== null) errors[field] = code;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      studentName,
      issuer,
      issueDate,
      restFrom,
      restTo,
      type: isTipoDocumento(payload.type) ? payload.type : null,
      hasSignature: payload.hasSignature as boolean | null,
      hasSeal: payload.hasSeal as boolean | null,
    },
  };
}
