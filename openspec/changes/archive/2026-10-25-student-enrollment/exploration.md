# Exploration: student-enrollment

## Problem

Nothing writes `Inscripcion`. `listEligibleGroups` (`src/lib/data/enrollment.ts:32-66`) is the only
source of subjects for a justification request, so students have no subjects to choose and cannot
file requests (RF-01, RF-04, RN-22).

The Excel catalog import dropped Inscripciones in a product-owner scope reduction
(`src/lib/import/sheets.ts:7`, `src/lib/import/types.ts:83-85,196-197`; rationale in
`openspec/changes/archive/2026-10-04-catalog-excel-import/proposal.md:13-26`).

## Current State

- `src/lib/data/inscripcion-writes.test.ts:17-20,56-67` fails as soon as any module writes
  `Inscripcion`; it must become an allowlist containing only the new writer.
- `openspec/specs/academic-catalog/spec.md:142-180` binds the change that adds a writer: `EstudianteId`
  must reference an `estudiante`, duplicates are refused, and the deferred role table becomes scenarios.
- Requirements conflict: RF-12 (`docs/requirements.md:27`) gives inscripciones maintenance to the
  secretaria; RN-21 (`:56`) makes the internal catalog the source only while the institutional register
  is unavailable. No RF/RN covers student self-registration. The institutional API
  (`docs/api-institucional/README.md:31-33`) is the future authoritative source.

### Data model (no migration strictly needed)

- `Inscripcion` (`src/db/schema.ts:212-227`): PK `(EstudianteId, GrupoId)`, `Activo`,
  `IX_Inscripcion_Grupo`. No period column, origin, timestamps, or one-group-per-asignatura rule.
- `Grupo` (`:172-202`): unique `(AsignaturaId, Periodo, NumeroGrupo)`, required `DocenteId`, `Activo`,
  `Origen`, `Dias`. `Asignatura` (`:144-159`): one `CarreraId`, `Activo`.
- `SolicitudAsignatura` (`:339-350`) references `Grupo`, so presented requests are unaffected by later
  enrollment edits.
- The audit table has no CHECK on `Accion`/`EntidadTipo` (`src/db/audit-schema.ts:42-43`); new actions
  need only `AUDIT_ACTIONS` (`src/lib/audit/types.ts:15-45`) and its pin test.
- Latent bug: `listEligibleGroups` does not filter `Asignatura.Activo` (`enrollment.ts:51-57`), which the
  spec requires (`academic-catalog/spec.md:182-232`) and `src/lib/data/catalog.ts:111-161` already does.

### Catalog, periods, activo

- No "current period" exists in `src`; period is only a format (`src/lib/import/normalize.ts:30`).
- Every import deactivates all active grupos absent from the workbook (`src/lib/import/plan.ts:431-441`),
  so the active groups are the current offering and past-term inscripciones become hidden.
- Students have no catalog read path (`src/lib/catalog/scope.ts:16-26`,
  `src/lib/auth/permissions.ts:64-70`); a student-scoped read is needed. Docente email/phone must not reach
  students.
- `withCatalogWrite` takes one global advisory lock (`src/lib/data/catalog-write.ts:18,88-110`);
  enrollment writes should use a single guarded `INSERT ... SELECT ... ON CONFLICT` instead.

### Reusable patterns

- Guards: `requireRole(...rolesSolicitantes)` (`src/lib/auth/dal.ts:33-39`); predicates in
  `permissions.ts:106-114`.
- Navigation: `NAV_ITEMS` (`src/lib/navigation.ts:50-97`), `shortcutsFor` (`:173-179`), i18n keys in
  `i18n/es.json` and `i18n/en.json`, tests `navigation.test.ts`, `app-sidebar.test.tsx`.
- Actions: `"use server"`, role re-check, session identity, zod parse
  (`src/lib/validations/solicitud.ts:74-87`), logic in a non-"use server" module
  (`requests/new/step-actions.ts:28-33`).
- UI precedent: `requests/new/subjects-step.tsx`; `AlertDialog`, `Combobox`, `DegradedAlert`,
  `EmptyState`, `PageHeader`; RNF-11 360 px rule.
- Data layer: fail-soft reads (`{ data, degraded }`), fail-loud mutations; audit builders in
  `src/lib/audit/events.ts`.
- Tests: Strict TDD, colocated vitest, `createDbDouble` (`src/lib/data/test-support/db-double.ts`)
  asserting rendered SQL (`enrollment.test.ts:77-92`). No new port or fake needed.

### Intake interaction

- Callers of `listEligibleGroups`: step 2 save (`step-actions.ts:90`), submit re-check (`actions.ts:99`),
  correction resubmit (`src/lib/data/solicitud-correction.ts:81`).
- Empty enrollment is discovered late at step 2 (`intake.subjects.empty`, `subjects-step.tsx:82-88`),
  and the message conflates "no enrollment" with "no class in range" (RN-22).
- A draft holding a dropped group fails at submit with `subject_not_eligible`; a `devuelta` request
  cannot be resubmitted until the student re-enrolls.
- Nudge points: entry check in `requests/new/page.tsx`, actionable step 2 empty state, `/requests` empty
  state, student dashboard shortcut.

## Approaches

1. **Student self-enrollment page, no schema change, audited, soft-deactivate** (recommended).
   Pros: no migration, no `0011` clash with `document-extraction`, reuses patterns, reversible.
   Cons: unverified enrollment, no queryable origin marker. Effort: medium.
2. **Approach 1 plus `Inscripcion.Origen`/`CreadaEn`.** Queryable provenance, but needs a Neon
   migration and risks the numbering clash; value is speculative. Effort: medium-high.
3. **Secretaria approves self-registered enrollments.** Trusted source, but blocks students and needs
   a state column, queue and UI. Effort: high.
4. **Inline enrollment inside intake step 2.** Rejected: the intake spec requires subjects to come from
   enrollment.
5. **Restore the Inscripciones import sheet.** Rejected: reverses a recorded product-owner decision.

## Recommendation

Approach 1: one writer module with one guarded statement per action, no deletes, no global lock; role
check in the data layer as well as `requireRole`; one `inscripcion.*` audit event per change; picker of
active groups from active periods filtered to the student's carrera; confirm dialog on drop; docs, guard
test and spec scenarios updated; fix the `Asignatura.Activo` filter.

## Open business questions

1. Trust model: self-declared enrollment as the RN-21 stopgap (new RF, amended RF-12/RN-21) vs
   secretaria validation.
2. One active group per asignatura per period, or several?
3. Which periods can be chosen; retroactive enrollment (RN-23 allows filing up to 30 days late)?
4. Carrera restriction or cross-carrera subjects?
5. Dropping a group referenced by a draft or `devuelta` request.
6. Enrollment limits per period.
7. Confirm dialog on drop (RNF-12 b).
8. Audit (RNF-06) and entity id for the composite key.
9. Staff visibility/editing of student enrollment.
10. `Origen` column now or later.
11. Empty-state wording that separates "no enrollments" from "no class in these dates".

## Risks

- A wrong group sends the supporting document to an unrelated docente; only the secretaria approval
  gate (RN-15) mitigates it.
- Requirement drift: docs and thesis matrix must change first.
- The `inscripcion-writes` guard and spec scenarios must be handled here or CI fails.
- Students must re-enroll every term after each import.
- Existing `Asignatura.Activo` gap in `listEligibleGroups`.
- Likely over 800 changed lines under `single-pr`.
- `Inscripcion` assumed empty; verify with a read-only count before design.
