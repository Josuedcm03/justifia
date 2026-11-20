import type { RolUsuario } from "@/lib/validations/auth";

// The access matrix oracle (design D9): an independent, literal statement of
// who may open each protected entry point. Data plus two pure lookups; it
// imports no entry point and no policy constant, so a change of policy must be
// made here on purpose. Keys are paths under `src/app`, like `inventory.ts`.

export type Identity = RolUsuario | "anonymous" | "flagged";
export type Outcome = { redirect: string } | { status: number; error: string };
export type Row = {
  allowed: readonly Identity[];
  /** Overrides of the default guard denial, per kind of denied identity. */
  denial?: Partial<Record<"anonymous" | "flagged" | "role", Outcome>>;
};

export const IDENTITIES: readonly Identity[] = [
  "anonymous",
  "flagged",
  "administrador",
  "coordinacion",
  "secretaria",
  "docente",
  "estudiante",
];

const ALL: Identity[] = [
  "administrador",
  "coordinacion",
  "secretaria",
  "docente",
  "estudiante",
];
const STAFF: Identity[] = ["administrador", "coordinacion", "secretaria"];
const SECRETARIA: Identity[] = ["secretaria"];
const COORDINACION: Identity[] = ["coordinacion"];
const ESTUDIANTE: Identity[] = ["estudiante"];
const ANY_SESSION: Identity[] = [...ALL, "flagged"];

const row = (allowed: Identity[], denial?: Row["denial"]): Row => ({
  allowed,
  denial,
});
const unauthorized: Outcome = { status: 401, error: "unauthorized" };
const forbidden: Outcome = { status: 403, error: "forbidden" };

const CATALOG = "(dashboard)/catalog";
const REQUESTS = "(dashboard)/requests";
const REVIEW = "(dashboard)/review";

export const PAGES: Record<string, Row> = {
  "(dashboard)/(home)/page.tsx": row(ALL),
  "(dashboard)/profile/page.tsx": row(ALL),
  [`${CATALOG}/asignaturas/page.tsx`]: row(STAFF),
  [`${CATALOG}/asignaturas/new/page.tsx`]: row(STAFF),
  [`${CATALOG}/asignaturas/[id]/edit/page.tsx`]: row(STAFF),
  [`${CATALOG}/asignaturas/[id]/grupos/new/page.tsx`]: row(STAFF),
  [`${CATALOG}/asignaturas/[id]/grupos/[grupoId]/edit/page.tsx`]: row(STAFF),
  [`${CATALOG}/docentes/page.tsx`]: row(STAFF),
  [`${CATALOG}/grupos/[id]/edit/page.tsx`]: row(STAFF),
  [`${CATALOG}/import/page.tsx`]: row(SECRETARIA),
  "(dashboard)/coordination/page.tsx": row(COORDINACION),
  "(dashboard)/coordination/[id]/page.tsx": row(COORDINACION),
  "(dashboard)/reports/page.tsx": row(COORDINACION),
  "(dashboard)/reports/requests/page.tsx": row(COORDINACION),
  "(dashboard)/enrollment/page.tsx": row(ESTUDIANTE),
  [`${REQUESTS}/page.tsx`]: row(ESTUDIANTE),
  [`${REQUESTS}/new/page.tsx`]: row(ESTUDIANTE),
  [`${REQUESTS}/new/confirmation/page.tsx`]: row(ESTUDIANTE),
  [`${REQUESTS}/[id]/page.tsx`]: row(ESTUDIANTE),
  [`${REQUESTS}/[id]/correct/page.tsx`]: row(ESTUDIANTE),
  [`${REVIEW}/page.tsx`]: row(SECRETARIA),
  [`${REVIEW}/[id]/page.tsx`]: row(SECRETARIA),
  "(dashboard)/users/page.tsx": row(STAFF),
  "(dashboard)/users/new/page.tsx": row(STAFF),
  "change-password/page.tsx": row(ANY_SESSION),
};

export const ROUTES: Record<string, Row & { method: "GET" | "POST" }> = {
  "api/catalog/template/route.ts": { method: "GET", ...row(SECRETARIA) },
  "api/reports/justifications/route.ts": {
    method: "GET",
    ...row(COORDINACION),
  },
  "api/intake/upload-token/route.ts": {
    method: "POST",
    ...row(ESTUDIANTE, {
      anonymous: unauthorized,
      flagged: forbidden,
      role: forbidden,
    }),
  },
  "api/review/special-format-token/route.ts": {
    method: "POST",
    ...row(SECRETARIA, {
      anonymous: unauthorized,
      flagged: forbidden,
      role: { status: 400, error: "not_allowed" },
    }),
  },
  // Role access is scoped by data (`canViewDocument`); its own test covers it.
  "api/intake/documents/[id]/route.ts": {
    method: "GET",
    ...row(ALL, { anonymous: unauthorized, flagged: unauthorized }),
  },
  // Scheduler-only: no session of any kind opens them.
  "api/cron/intake-sweep/route.ts": {
    method: "GET",
    ...row([], {
      anonymous: unauthorized,
      flagged: unauthorized,
      role: unauthorized,
    }),
  },
  "api/cron/remission-retry/route.ts": {
    method: "GET",
    ...row([], {
      anonymous: unauthorized,
      flagged: unauthorized,
      role: unauthorized,
    }),
  },
  "api/cron/retention/route.ts": {
    method: "GET",
    ...row([], {
      anonymous: unauthorized,
      flagged: unauthorized,
      role: unauthorized,
    }),
  },
};

const actions = (allowed: Identity[], ...exports: string[]) => ({
  ...row(allowed),
  exports,
});

export const ACTIONS: Record<string, Row & { exports: readonly string[] }> = {
  [`${CATALOG}/asignaturas/actions.ts`]: actions(
    STAFF,
    "createAsignaturaAction",
    "updateAsignaturaAction",
    "setAsignaturaActivoAction",
  ),
  [`${CATALOG}/grupos/actions.ts`]: actions(
    STAFF,
    "createGrupoAction",
    "updateGrupoAction",
    "setGrupoActivoAction",
  ),
  [`${CATALOG}/import/actions.ts`]: actions(
    SECRETARIA,
    "previewAction",
    "applyAction",
  ),
  "(dashboard)/coordination/[id]/actions.ts": actions(
    COORDINACION,
    "answerEscalationAction",
  ),
  "(dashboard)/enrollment/actions.ts": actions(
    ESTUDIANTE,
    "enrollAction",
    "dropAction",
  ),
  [`${REQUESTS}/new/actions.ts`]: actions(
    ESTUDIANTE,
    "saveDetailsAction",
    "saveSubjectsAction",
    "finalizeDocumentAction",
    "removeDocumentAction",
    "discardDraftAction",
    "submitRequestAction",
  ),
  [`${REQUESTS}/[id]/correct/actions.ts`]: actions(
    ESTUDIANTE,
    "saveCorrectionDetailsAction",
    "saveCorrectionSubjectsAction",
    "finalizeCorrectionDocumentAction",
    "removeCorrectionDocumentAction",
    "resubmitCorrectionAction",
  ),
  [`${REVIEW}/[id]/actions.ts`]: actions(SECRETARIA, "decideAction"),
  [`${REVIEW}/[id]/document-data-actions.ts`]: actions(
    SECRETARIA,
    "saveDocumentDataAction",
  ),
  [`${REVIEW}/[id]/escalation-actions.ts`]: actions(
    SECRETARIA,
    "escalateRequestAction",
    "recordExcessReportAction",
    "resendEscalationNoticeAction",
  ),
  [`${REVIEW}/[id]/remission-actions.ts`]: actions(
    SECRETARIA,
    "resendRemissionAction",
    "attachSpecialFormatAction",
  ),
  "(dashboard)/users/new/actions.ts": actions(STAFF, "createStaffAction"),
  "change-password/actions.ts": actions(ANY_SESSION, "changePasswordAction"),
};

/** The outcome a denied identity must get, or null when it is admitted. */
export function outcomeFor(r: Row, identity: Identity): Outcome | null {
  if (r.allowed.includes(identity)) return null;
  if (identity === "anonymous")
    return r.denial?.anonymous ?? { redirect: "/login" };
  if (identity === "flagged") {
    return r.denial?.flagged ?? { redirect: "/change-password" };
  }
  return r.denial?.role ?? { redirect: "/denied" };
}

/** Denied identities of one row (entry point x identity pairs refused). */
export function denialsOf(r: Row): number {
  return IDENTITIES.filter((identity) => outcomeFor(r, identity)).length;
}
