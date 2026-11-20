// The effective view of a document (MD-21, RN-24). Pure, with no "server-only":
// the staff detail and every signal read the row this builds, so they cannot
// disagree. A manual value wins over the extracted one, field by field.

import type { ExtractionRowView } from "@/lib/extraction/display";
import { inclusiveDays } from "@/lib/intake/dates";

import type { ManualFields } from "./types";

/** The four data of RF-14 (a); the rest period counts as one unit. */
export type ManualDatum = "studentName" | "issuer" | "issueDate" | "rest";

export type DatumOrigin = "manual" | "extracted";

// The rest period is dates only and both or neither (CK_DatoManual_Reposo), so
// a lone date is never treated as a manual rest.
function hasManualRest(manual: ManualFields): boolean {
  return manual.restFrom !== null && manual.restTo !== null;
}

function hasManualValue(manual: ManualFields): boolean {
  return (
    manual.studentName !== null ||
    manual.issuer !== null ||
    manual.issueDate !== null ||
    hasManualRest(manual)
  );
}

/**
 * Where the value of a datum comes from. `manual` only when its manual column
 * is non-null; whether an extracted value exists is not this function's
 * business, so callers ask it only for a datum that has a value.
 */
export function datumOrigin(
  manual: ManualFields | null,
  datum: ManualDatum,
): DatumOrigin {
  if (manual === null) return "extracted";
  switch (datum) {
    case "studentName":
      return manual.studentName !== null ? "manual" : "extracted";
    case "issuer":
      return manual.issuer !== null ? "manual" : "extracted";
    case "issueDate":
      return manual.issueDate !== null ? "manual" : "extracted";
    case "rest":
      return hasManualRest(manual) ? "manual" : "extracted";
  }
}

/**
 * Overlay the manual values on the extraction row (RN-24, D8, D9, A4).
 *
 * - No manual value: the extraction row, unchanged.
 * - Any manual value among the four data: the state is `completada`, even when
 *   the row failed, is still queued or does not exist (RF-14 c). The type and
 *   the marks are not part of this input and never promote.
 * - Each datum is the manual one, else the extracted one, and the extracted
 *   one only counts when its row is `completada`.
 * - The rest period moves as one unit: a manual rest replaces the three
 *   extracted rest values, with the days derived here from the two dates.
 */
export function toEffectiveRow(
  ocr: ExtractionRowView | null,
  manual: ManualFields | null,
): ExtractionRowView | null {
  if (manual === null || !hasManualValue(manual)) return ocr;

  const base = ocr?.state === "completada" ? ocr : null;
  const rest =
    manual.restFrom !== null && manual.restTo !== null
      ? {
          restFrom: manual.restFrom,
          restTo: manual.restTo,
          restDays: inclusiveDays(manual.restFrom, manual.restTo),
        }
      : {
          restFrom: base?.restFrom ?? null,
          restTo: base?.restTo ?? null,
          restDays: base?.restDays ?? null,
        };

  return {
    state: "completada",
    studentName: manual.studentName ?? base?.studentName ?? null,
    issuer: manual.issuer ?? base?.issuer ?? null,
    issueDate: manual.issueDate ?? base?.issueDate ?? null,
    ...rest,
  };
}
