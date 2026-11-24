import { listHref, parseQ, type RawSearchParams } from "@/lib/list-params";
import { USERS_SEARCH_MAX } from "@/lib/users/list-params";

export const ASSIGN_BASE = "/catalog/inscripciones/assign";

const POSITIVE_INTEGER = /^[1-9]\d*$/;

/** A positive safe integer from a single URL value, else null. */
function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string" || !POSITIVE_INTEGER.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * `none`: no `estudiante` in the URL, so the page is the student search.
 * `invalid`: a value that is present but is not a positive safe integer (or is
 * repeated); the page answers not found and reads nothing (EA-SCOPE-1).
 */
export type AssignEstudiante =
  { kind: "none" } | { kind: "invalid" } | { kind: "id"; id: number };

export type AssignParams = {
  /** The student search text, trimmed and capped (empty = no search). */
  q: string;
  estudiante: AssignEstudiante;
  /** The chosen asignatura; a bad value is no selection, never an error. */
  asignatura: number | null;
};

/** Pure and total: a hostile query is classified here and never reaches a
 *  read. The scope is not a parameter at all. */
export function parseAssignParams(raw: RawSearchParams): AssignParams {
  let estudiante: AssignEstudiante = { kind: "none" };
  if (raw.estudiante !== undefined) {
    const id = parseId(raw.estudiante);
    estudiante = id === null ? { kind: "invalid" } : { kind: "id", id };
  }
  return {
    q: parseQ(raw.q, USERS_SEARCH_MAX),
    estudiante,
    asignatura: parseId(raw.asignatura),
  };
}

/** The one place that knows the URL shape of the assign page, so the list
 *  links, the results and the picker agree. */
export function assignHref(ids: {
  estudianteId?: number;
  asignaturaId?: number;
}): string {
  const extra: Record<string, string> = {};
  if (ids.estudianteId !== undefined) {
    extra.estudiante = String(ids.estudianteId);
  }
  if (ids.asignaturaId !== undefined) {
    extra.asignatura = String(ids.asignaturaId);
  }
  return listHref(ASSIGN_BASE, { extra });
}
