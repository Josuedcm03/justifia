// Display model of one document's extraction (DE-13). Pure: maps a stored row
// and the request context to what the staff detail shows. It carries no raw
// error code and never decides anything about the request (RN-02).

import type { EstadoSolicitud } from "@/lib/intake/states";

import type { ExtractionState } from "./states";

/** The columns the staff section reads; `no_aplica` rows are never listed. */
export interface ExtractionRowView {
  state: Exclude<ExtractionState, "no_aplica">;
  studentName: string | null;
  issuer: string | null;
  /** Calendar dates stay ISO strings so no time zone can shift them. */
  issueDate: string | null;
  restFrom: string | null;
  restTo: string | null;
  restDays: number | null;
}

export interface ExtractionDisplayContext {
  requestState: EstadoSolicitud;
  /** True when the extraction server address resolves (see `config.ts`). */
  configured: boolean;
}

/** A recognized value, or the "no reconocido" marker (RF-11 b). */
export type FieldDisplay =
  { recognized: true; value: string } | { recognized: false };

export type RestDisplay =
  | { recognized: true; days: number; from: string | null; to: string | null }
  | { recognized: false };

export type ExtractionDisplay =
  | {
      kind: "data";
      studentName: FieldDisplay;
      issuer: FieldDisplay;
      issueDate: FieldDisplay;
      rest: RestDisplay;
    }
  | { kind: "extracting" }
  | { kind: "unavailable" }
  | { kind: "notConfigured" };

function field(value: string | null): FieldDisplay {
  return value === null ? { recognized: false } : { recognized: true, value };
}

function rest(row: ExtractionRowView): RestDisplay {
  if (row.restDays === null) return { recognized: false };
  return {
    recognized: true,
    days: row.restDays,
    from: row.restFrom,
    to: row.restTo,
  };
}

/**
 * Precedence, first match wins: completed data, then a request that is no
 * longer pending (never "extracting"), then a failed row, then "not
 * configured", then "extracting". A missing row is an eligible document that
 * has not been registered yet.
 */
export function toExtractionDisplay(
  row: ExtractionRowView | null,
  context: ExtractionDisplayContext,
): ExtractionDisplay {
  if (row?.state === "completada") {
    return {
      kind: "data",
      studentName: field(row.studentName),
      issuer: field(row.issuer),
      issueDate: field(row.issueDate),
      rest: rest(row),
    };
  }
  if (context.requestState !== "pendiente") return { kind: "unavailable" };
  if (row?.state === "fallida") return { kind: "unavailable" };
  if (!context.configured) return { kind: "notConfigured" };
  return { kind: "extracting" };
}
