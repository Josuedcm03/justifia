// src/lib/catalog/types.ts — PURE. Types only. Created by WU1b so the audit
// builders can map write results to events (finding F-1); later units add the
// list and form types here.

import type { DiaSemana } from "@/lib/catalog/dias";
import type { GrupoOrigen } from "@/lib/catalog/origen";
import type {
  AuditableAsignaturaField,
  AuditableGrupoField,
} from "@/lib/audit/types";

/** The state filter of a catalog list; `active` is the default (CM-LST-1). */
export type CatalogStatusFilter = "active" | "inactive" | "all";

/** One page of a catalog list; `page` is the CLAMPED page actually read and
 *  `degraded` is true when the database could not be reached. */
export type CatalogListResult<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  degraded: boolean;
};

export type AsignaturaListItem = {
  id: number;
  codigo: string;
  nombre: string;
  carreraId: number;
  carreraNombre: string;
  horasTotales: number;
  activo: boolean;
};

export type AsignaturaDetail = AsignaturaListItem & { gruposActivos: number };

/** One docente in the read-only Docentes list. No credential, `Cif` or phone. */
export type DocenteListItem = {
  id: number;
  nombreCompleto: string;
  login: string;
  correo: string | null;
  activo: boolean;
};

/** One Grupo as the list and the edit page see it. `dias` is the decoded set in
 *  week order (empty = days not recorded); the stored mask never leaves the
 *  data layer (amendment A-9). */
export type GrupoListItem = {
  id: number;
  asignaturaId: number;
  asignaturaCodigo: string;
  asignaturaNombre: string;
  periodo: string;
  numeroGrupo: string;
  docenteId: number;
  docenteNombre: string;
  activo: boolean;
  origen: GrupoOrigen;
  dias: readonly DiaSemana[];
};

/** The Grupos of one Asignatura (CM-ASG-7, design A-AGS-1): at most
 *  `ASIGNATURA_GRUPOS_MAX` rows; `truncated` when more exist; `degraded` when
 *  the read failed (then `data` is empty and says nothing about the groups). */
export type AsignaturaGruposResult = {
  data: GrupoListItem[];
  truncated: boolean;
  degraded: boolean;
};

/** Result of an Asignatura create or update. `inactive` (amendment A-1):
 *  editing an inactive record is refused (CM-ASG-3). */
export type AsignaturaWriteResult =
  | { kind: "created"; id: number }
  | { kind: "updated"; id: number; campos: readonly AuditableAsignaturaField[] }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "codigo_taken"; inScope: boolean; activo: boolean }
  | { kind: "carrera_invalid" }
  | { kind: "inactive" };

export type AsignaturaActiveResult =
  | { kind: "changed"; id: number; activo: boolean }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "has_active_groups"; count: number };

/** Result of a Grupo create or update. `inactive` (amendment A-1): editing an
 *  inactive record is refused (CM-GRP-2). */
export type GrupoWriteResult =
  | { kind: "created"; id: number }
  | { kind: "updated"; id: number; campos: readonly AuditableGrupoField[] }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "grupo_taken"; activo: boolean }
  /** missing, inactive or out of scope */
  | { kind: "asignatura_unavailable" }
  /** missing, inactive or not a docente */
  | { kind: "docente_unavailable" }
  | { kind: "inactive" };

export type GrupoActiveResult =
  | { kind: "changed"; id: number; activo: boolean }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "asignatura_unavailable" }
  | { kind: "docente_unavailable" };

/** What a create or edit form action answers with. `fieldErrors` and `message`
 *  are already translated; `gone` is both "missing" and "out of scope"
 *  (never told apart); `busy`, `inactive` and `unchanged` carry no text, the
 *  form shows the shared copy for them (amendments A-1, A-2, A-3). */
export type CatalogFormState =
  | { kind: "idle" }
  | { kind: "invalid"; fieldErrors: Record<string, string> }
  | { kind: "error"; message: string }
  | { kind: "gone" }
  | { kind: "busy" }
  | { kind: "inactive" }
  | { kind: "unchanged" };

/** What the two-step activate/deactivate control answers with. `message` is
 *  already translated; `gone` is both "missing" and "out of scope"; `unchanged`
 *  means the record was already in the requested state (amendments A-2, A-3). */
export type ActiveToggleState =
  | { kind: "idle" }
  | { kind: "done"; activo: boolean }
  | { kind: "error"; message: string }
  | { kind: "gone" }
  | { kind: "busy" }
  | { kind: "unchanged" };
