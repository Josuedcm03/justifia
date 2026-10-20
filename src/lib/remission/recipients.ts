import type { RevisionClase } from "@/db/schema";

import type { RemissionReason, RemissionState } from "./states";

// Pure construction of the remission rows of an approval (TR-4, RF-09 a, D6).

/** One teacher of the request as the class tables report it. */
export type RequestTeacher = {
  /** Null when a group has no identified teacher: it yields no row. */
  docenteId: number | null;
  nombre: string | null;
  correo: string | null;
  clases: RevisionClase[];
};

export type RemissionRowDraft = {
  docenteId: number;
  docenteNombre: string;
  correo: string | null;
  clases: RevisionClase[];
  estado: Extract<RemissionState, "pendiente" | "bloqueada">;
  motivoCodigo: Extract<
    RemissionReason,
    "sin_correo" | "formato_especial_faltante"
  > | null;
};

/**
 * One row per distinct teacher: the snapshot of id, name, email and that
 * teacher's groups. A teacher without an email is born blocked with
 * `sin_correo`; on a special-format approval every other row is born blocked
 * with `formato_especial_faltante`. Gate order matches the dispatcher: the
 * missing email is reported first.
 */
export function buildRemissionRows(
  teachers: readonly RequestTeacher[],
  options: { formatoEspecial?: boolean } = {},
): RemissionRowDraft[] {
  const byTeacher = new Map<number, RemissionRowDraft>();

  for (const teacher of teachers) {
    if (teacher.docenteId === null) continue;
    const existing = byTeacher.get(teacher.docenteId);
    if (existing) {
      existing.clases.push(...teacher.clases);
      continue;
    }
    const correo = teacher.correo?.trim() ? teacher.correo.trim() : null;
    byTeacher.set(teacher.docenteId, {
      docenteId: teacher.docenteId,
      docenteNombre: teacher.nombre ?? "",
      correo,
      clases: [...teacher.clases],
      ...initialState(correo, options.formatoEspecial === true),
    });
  }

  return [...byTeacher.values()];
}

function initialState(
  correo: string | null,
  formatoEspecial: boolean,
): Pick<RemissionRowDraft, "estado" | "motivoCodigo"> {
  if (correo === null) {
    return { estado: "bloqueada", motivoCodigo: "sin_correo" };
  }
  if (formatoEspecial) {
    return { estado: "bloqueada", motivoCodigo: "formato_especial_faltante" };
  }
  return { estado: "pendiente", motivoCodigo: null };
}
