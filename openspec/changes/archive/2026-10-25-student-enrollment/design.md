# Design: Student Enrollment

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries a writer, a student-scoped read, a route, intake edits, audit, nav and
> docs; the repository precedent (`request-consent`, `teacher-remission`) keeps
> decision tables over prose cuts. The deviation is deliberate.

> **DB-touching.** No migration. This document runs no command. The only
> database step it plans is `[READ-ONLY]` (open question 1).

Binding inputs: `proposal.md` (D1-D12), `exploration.md`,
`openspec/specs/academic-catalog/spec.md:142-180`, `docs/requirements.md`
(RF-04, RF-12, RN-21, RN-22, RNF-01, RNF-05, RNF-06, RNF-11, RNF-12).
Decisions here are **SE-1..SE-12**.

## Technical Approach

Exploration approach 1. One writer, `src/lib/data/enrollment-write.ts`, opens
one short transaction per action: it locks the student's own `Usuario` row
(which is also the role check), runs guarded statements, and appends the
`inscripcion.*` audit rows on the same handle. No `withCatalogWrite`, no global
lock, no delete. A student-scoped read, `src/lib/data/enrollment-picker.ts`,
feeds a new `/enrollment` page driven by `?asignatura=`. Intake gains the
`Asignatura.Activo` filter, an `enrolled` flag that splits the step 2 empty
state, and nudges.

## Architecture Decisions

### SE-1. Atomicity of "one active group per asignatura+period" (D2)

| Option | Tradeoff | Decision |
|---|---|---|
| Lock the student's `Usuario` row `FOR NO KEY UPDATE`, then guarded statements, in one transaction | Serializes only that student; the lock select doubles as the role check; drizzle `.for("no key update")` works through the double (unknown builder props return the proxy) | **Chosen** |
| `pg_advisory_xact_lock(estudianteId)` | Shares the single-bigint keyspace with `CATALOG_WRITE_LOCK_KEY = 5_005_001`; the two-int form needs `int4` ids; needs `tx.execute`, which `createDbDouble` does not script | Rejected |
| One CTE that deactivates siblings and upserts | Two concurrent replaces each miss the other's uncommitted insert under READ COMMITTED: two active rows | Rejected |
| `FOR UPDATE` on the student's `Inscripcion` rows | Cannot lock absent rows (first enrollment) | Rejected |
| `SERIALIZABLE` | Needs a retry loop the project has nowhere else | Rejected |

Driver: `drizzle-orm/postgres-js` (`src/db/index.ts`), so `db.transaction` is
available (as `withCatalogWrite` already proves). Lock order is always
`Usuario` then `Inscripcion`; the FK checks of the insert take `KEY SHARE`,
compatible with `NO KEY UPDATE`, so the writer cannot deadlock with itself or
with catalog writes. No `lock_timeout`: the transaction is 4-6 short statements.
Under the lock a read-then-write is race-free, so each step stays a plain
guarded statement (the proposal's "single statement" is kept per step; the
transaction exists anyway because `insertAuditEvents` requires a
`Transaction`).

### SE-2. Writer statements

`enrollInGroup(estudianteId, grupoId)`:

1. Lock + role: `select Usuario.Id from Usuario join Rol where Id=$s and
   Rol.Codigo='estudiante' and Usuario.Activo for no key update` -> none:
   `not_student`.
2. Target: `select Grupo.Id, AsignaturaId, Periodo where Grupo.Id=$g and
   Grupo.Activo and Asignatura.Activo and Periodo = (select max(Grupo.Periodo)
   from Grupo join Asignatura where Grupo.Activo and Asignatura.Activo)` ->
   none: `not_eligible`.
3. Existing pair: `select Activo from Inscripcion where (s, g)` -> active:
   `already_enrolled` (no write, no audit; the PK keeps exactly one row).
4. Replace: `update Inscripcion set Activo=false where EstudianteId=$s and
   Activo and GrupoId <> $g and GrupoId in (select Id from Grupo where
   AsignaturaId=$a and Periodo=$p) returning GrupoId`.
5. `insert ... values (s, g, true)` if absent, else `update ... set Activo=true
   where (s, g) and not Activo` (reactivate, D7).
6. `insertAuditEvents(tx, estudianteId, events)`.

`dropGroup(estudianteId, grupoId)`: step 1, then `update Inscripcion set
Activo=false where (s, g) and Activo returning GrupoId` -> none:
`not_enrolled`; then one audit row. Never deletes (D7).

Unexpected errors: one sanitized log line (event `enrollment.write.failed`,
actor, error name, SQLSTATE; shaped like `logCatalogFailure`), then rethrow.

### SE-3. Role integrity (academic-catalog role table)

Data layer: step 1 above, so `docente`, `secretaria`, `coordinacion`,
`administrador` and an inactive estudiante are refused even with a stale 8 h
JWT. Edge: every action calls `requireRole(...rolesSolicitantes)` and takes the
id from `session.sub` only.

### SE-4. Latest period (D3)

`max(Grupo.Periodo)` over active grupos of ACTIVE asignaturas (an inactive
grupo, or an active grupo of an inactive asignatura, never sets the period;
spec "Inactive rows do not set the period"); `PERIODO_RE = /^\d{4}-S[12]$/` makes the
lexicographic max chronological. The writer evaluates it as a subquery (write
time is authoritative); the page reads it once and passes it to the other
reads. `null` -> empty state "no offering published".

### SE-5. Student-scoped picker read (D4) — `src/lib/data/enrollment-picker.ts`

| Function | Rows | Notes |
|---|---|---|
| `getLatestPeriod()` | `string \| null` | SE-4 |
| `listMyEnrollments(s)` | effective enrollments (active inscripcion, active grupo, active asignatura) of ALL periods, ordered asignatura name then group number (spec "Own effective enrollments list") | `inOpenRequest` flag (SE-7); returns `asignaturaId` and `periodo` so the UI detects a replace |
| `listEnrollableAsignaturas(s, periodo)` | asignaturas with an active grupo in the period, active only | `ownCarrera` = `Asignatura.CarreraId = Usuario.CarreraId`; ordered own first, then nombre; others labelled with `Carrera.Nombre`; capped at `CATALOG_OPTIONS_MAX` with `truncated` |
| `listEnrollableGroups(asignaturaId, periodo)` | active grupos of an active asignatura | `numeroGrupo`, `docenteNombre` (`Usuario.NombreCompleto` only), `dias` |
| `loadEnrollmentPage(s, asignaturaId \| null)` | `{ data, degraded }` | fail-soft wrapper: never throws |

Docente email and phone are never selected; a test pins the selected column
set. There is no schedule-time column in `Grupo`: the picker shows the
meeting days (`decodeDias`, existing day labels) only.

### SE-6. Page state lives in `?asignatura=`

| Option | Decision |
|---|---|
| Selecting an asignatura in the `Combobox` does `router.replace("?asignatura=<id>")`; the server page reads its groups | **Chosen**: RSC reads, refresh/back safe, same pattern as intake `?step=` |
| Ship every group of the period to the client | Rejected: payload grows with the offering |
| Server action used as a read | Rejected: actions are for mutations |

The param is parsed with the positive-integer guard used by
`requests/[id]/correct/page.tsx`; an invalid or ineligible id renders no group
list.

### SE-7. Drop and replace warning (D5)

`listMyEnrollments` adds `inOpenRequest = exists(select 1 from
SolicitudAsignatura join Solicitud where GrupoId = Inscripcion.GrupoId and
Solicitud.EstudianteId = $s and Estado in ('borrador','devuelta'))`. No extra
round trip when the dialog opens. Drop always confirms (RNF-12); replace uses
the same dialog because it deactivates a group; both add the warning text when
the affected group has `inOpenRequest`. The write is still allowed; presented
requests keep their `SolicitudAsignatura` rows.

### SE-8. Audit (D8, RNF-06)

| Item | Value |
|---|---|
| Actions | `inscripcion.creada`, `inscripcion.reactivada`, `inscripcion.desactivada` added to `AUDIT_ACTIONS` |
| `AuditEntityType` | `"Inscripcion"` |
| `entidadId` | `estudianteId`: `IX_EventoAuditoria_Entidad` then serves "a student's enrollment history"; the actor index stops serving it once staff may edit (D9) |
| `datos` | `{ grupoId }`; deactivation adds `motivo: "baja" \| "reemplazo"` (ids only, RNF-05) |
| Builders | `inscripcionEvent(...)` and `enrollmentWriteEvents(estudianteId, result)` in `events.ts`; refusals map to `[]` (AL-ONE) |

Rejected: `entidadId = grupoId` (history per student would need a jsonb
filter), and a synthetic composite id (no column for it).

### SE-9. Permissions and navigation

`permissions.ts`: `canManageOwnEnrollment(rol) = canFileRequests(rol)` (derived
from `rolesSolicitantes`, not a second list). `NAV_ITEMS` gets `{ key:
"enrollment", href: "/enrollment", icon: BookMarked, visibleTo:
canManageOwnEnrollment }` after `newRequest`; `shortcutsFor` then offers the
dashboard shortcut with no other code. i18n: `nav.enrollment`,
`dashboard.shortcuts.enrollment`.

### SE-10. Actions

`src/app/(dashboard)/enrollment/actions.ts` (`"use server"`): `enrollAction`,
`dropAction`. Each: `requireRole(...rolesSolicitantes)`, parse
`enrollmentInputSchema` (`{ grupoId: positive int }`, new
`src/lib/validations/inscripcion.ts`), call the writer, `revalidatePath(
"/enrollment")` on success (project precedent; Next 16 `refresh()` also exists
but only the catalog's `revalidatePath` pattern is in use), return `{ ok: true
} | { ok: false, error: <i18n key> }`. A thrown writer error becomes
`error: "unexpected"`.

### SE-11. Intake changes (D11, D12)

| File | Change |
|---|---|
| `enrollment.ts` | add `eq(asignatura.activo, true)`; split into `listEnrolledGroups(s)` + `withClassIn(groups, range, schedule)`; `listEligibleGroups` keeps its signature (fail loud) |
| `enrollment.ts` | `listEnrollmentFailSoft` returns `{ data, degraded, enrolled }`, `enrolled = unfiltered.length > 0`: the null-range list comes from the same single query |
| `enrollment.ts` | `hasActiveEnrollmentFailSoft(s): Promise<boolean \| null>` (`limit 1`; `null` on failure: no nudge) |
| `flow-steps.tsx`, `subjects-step.tsx` | pass `enrolled`; `!enrolled` -> `intake.subjects.noEnrollment` + link to `/enrollment`; else `intake.subjects.empty` reworded to "no class in these dates" |
| `requests/new/page.tsx`, `requests/[id]/correct/page.tsx` | fallback `{ data: [], degraded: false, enrolled: true }`; new page shows a non-blocking notice with a link when `hasActiveEnrollmentFailSoft` is `false` |
| `requests/page.tsx` | the empty state always links to `/enrollment` (spec "Empty state links to enrollment"); no extra read there |

### SE-12. Write guard becomes an allowlist

`inscripcion-writes.test.ts`: `ALLOWED_WRITERS = ["lib/data/enrollment-write.ts"]`
(paths normalized to `/`, Windows-safe). Asserts: no offender outside the list;
the allowlisted file does match a write pattern (the list cannot rot); it
contains no `delete` shape (D7).

## Data Flow

    /enrollment page ──> loadEnrollmentPage (fail-soft) ──> enrollment-picker reads
          │ Combobox -> ?asignatura=
          ▼
    GroupPicker / MyEnrollments ──> enrollAction / dropAction
          │ requireRole, zod, session id
          ▼
    enrollment-write: tx { lock Usuario(role) -> guarded stmts -> audit }
          ▼
    revalidatePath("/enrollment")   intake reads listEligibleGroups (Activo fixed)

## File Changes

| File | Action |
|---|---|
| `src/lib/data/enrollment-write.ts` (+test) | Create: SE-1..SE-3 |
| `src/lib/data/enrollment-picker.ts` (+test) | Create: SE-4, SE-5, SE-7 |
| `src/lib/data/enrollment.ts` (+test) | Modify: SE-11 |
| `src/lib/data/inscripcion-writes.test.ts` | Modify: SE-12 |
| `src/lib/audit/types.ts`, `events.ts` (+tests) | Modify: SE-8 |
| `src/lib/auth/permissions.ts`, `src/lib/navigation.ts` (+tests) | Modify: SE-9 |
| `src/lib/validations/inscripcion.ts` | Create |
| `src/app/(dashboard)/enrollment/page.tsx`, `actions.ts`, `group-picker.tsx`, `my-enrollments.tsx`, `confirm-change-dialog.tsx` (+tests) | Create: reuse `PageHeader`, `DegradedAlert`, `EmptyState`, `Combobox`, `AlertDialog`; 44 px targets, 360 px layout (RNF-11) |
| `requests/new/{page,flow-steps,subjects-step}.tsx`, `requests/[id]/correct/page.tsx`, `requests/page.tsx` (+tests) | Modify: SE-11 |
| `i18n/es.json`, `i18n/en.json` | Modify: `enrollment.*`, nav, shortcut, intake, requests keys |
| `docs/requirements.md` | Modify (Spanish, neutral): new RF-16 (student self-declares enrollment of the latest period, unverified, audited, one group per asignatura, confirmed drop); RF-12 (inscripciones leave secretaria maintenance while RF-16 applies); RN-21 (internal catalog fed by RF-16 until institutional access); changelog row, "pendiente de sincronizar con la matriz" |
| `docs/roadmap.md` | Modify: `student-enrollment` row (RF-16, RF-12, RF-04; RN-21, RN-22; RNF-06, RNF-12) |

## Interfaces / Contracts

```ts
export type EnrollResult =
  | { ok: true; kind: "created" | "reactivated"; grupoId: number; replaced: number[] }
  | { ok: false; reason: "not_student" | "not_eligible" | "already_enrolled" };
export type DropResult =
  | { ok: true; grupoId: number }
  | { ok: false; reason: "not_student" | "not_enrolled" };
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (data) | statement order, lock clause, role filter, refusals write nothing, replace returns siblings, audit last and in tx | `createDbDouble` script + rendered SQL (`enrollment.test.ts:77-92` style) |
| Unit (data) | role table x5, duplicate refusal, `Asignatura.Activo`, `enrolled`, latest period, column set without email/phone | same |
| Unit (audit, nav) | pin lists, builders, shortcut for estudiante only | existing pin tests |
| Action | role guard, zod refusal, session id, revalidate on success only | vitest mocks of `dal`, writer, `next/cache` |
| Component | picker, dialog warning, empty states, 360 px, 44 px | Testing Library, existing layout tests |
| Structural | allowlist | SE-12 |

Concurrency is argued (SE-1), not executed: tests never hit the database.

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification
or process-integration boundary; the new page route is ordinary app routing.

## Migration / Rollout

No migration. Rollback: revert the PR; written rows stay inert or are
deactivated by a `[CONFIRM]` SQL statement.

## Size Forecast

| Work unit | Scope | Lines (approx.) |
|---|---|---|
| WU1 data | writer, picker, enrollment.ts, audit, allowlist, tests | 950 |
| WU2 route | page, actions, three components, validations, i18n, tests | 850 |
| WU3 intake + shell + docs | SE-9, SE-11, docs, tests | 400 |
| Total | | ~2200 |

Above the 800-line `single-pr` budget by about 2.7x. Recommended: chained PRs
WU1 -> WU2 -> WU3 (each green on its own), or an explicit `size:exception`.

## Open Questions

- [ ] `[READ-ONLY]` `select count(*) from "Inscripcion"` before apply (proposal risk).
- [ ] Delivery: chained PRs or `size:exception` (decision needed before apply).
