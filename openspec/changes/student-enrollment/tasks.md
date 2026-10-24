# Tasks: Student Enrollment

> Strict TDD (vitest): every behavior task is a RED task (failing test written first, run, seen failing) followed by a GREEN task. Focused command: `npx vitest run <paths>`. Gates per work unit: `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check` (Windows CRLF noise: `--end-of-line auto`), `npm run build`. Run `npm test` and `npm run build` with a dummy `DATABASE_URL` (PowerShell: `$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'`) so no database is targeted.
> DB rule (`CLAUDE.md`): this change has no migration and no agent task writes to Neon. Tasks tagged `[READ-ONLY]` need no confirmation; tasks tagged `ASK OWNER` need the owner's explicit "yes" for that single command, never batched. Unit tests use `createDbDouble` (`src/lib/data/test-support/db-double.ts`) and never touch a database.
> Spec IDs: RF-16 (new), RF-04, RF-12 (b), RN-21, RN-22, RNF-01, RNF-02, RNF-05, RNF-06, RNF-11, RNF-12. Decisions SE-1..SE-12 refer to `design.md`; D1-D12 to `proposal.md`.
> Threat matrix: N/A (design). Commits: conventional, one commit per unit (test + code together), no AI attribution.
> Size note: the `sdd-tasks` cap (530 words) is exceeded on purpose; the repository precedent (`request-consent`, `teacher-remission`) keeps one line per task with spec links.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,200 authored total (WU1 ~830, WU2 ~850, WU3 ~520); `openspec/` excluded |
| 400-line budget risk | High in aggregate; WU1 and WU2 sit at or just above the 800 session budget (`review_budget_lines=800`) |
| Chained PRs recommended | Yes |
| Suggested split | WU1 data -> WU2 route and UI -> WU3 intake, shell and docs (3 PRs, user-approved) |
| Delivery strategy | auto-chain (user-approved slicing) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Branch chain (tracker is the current worktree branch; only the tracker merges to `main`; slice branches are deleted after merge):

| Slice | Branch | Created from | PR base |
|-------|--------|--------------|---------|
| Tracker + planning docs | `feat/student-enrollment` | `main` | `main` (draft, no-merge until WU3 is in) |
| WU1 data | `feat/student-enrollment-1-data` | tracker | tracker |
| WU2 route and UI | `feat/student-enrollment-2-ui` | WU1 branch | WU1 branch; retarget to tracker after WU1 merges |
| WU3 intake, shell, docs | `feat/student-enrollment-3-intake` | WU2 branch | WU2 branch; retarget to tracker after WU2 merges |

If GitHub shows a previous slice in a child diff, retarget or rebase until the diff is clean.

Chain now (owner-approved 2026-10-24, after the WU1 measurement): tracker <- `-1-data` <- `-1b-picker` (the WU1 picker, Phase 3, split out) <- `-2-ui` (WU2) <- `-3-intake` (WU3). WU2 branches from `-1b-picker`, not from `-1-data`.

Forecast vs the 800 budget (stop rule: measure the authored diff before opening each PR; if over 800, stop and report; do not open an oversized PR):

- **WU1 ~830 (design said 950).** Already trimmed by moving the `enrollment.ts` intake split (`listEnrolledGroups`, `withClassIn`, `enrolled`, `hasActiveEnrollmentFailSoft`, ~120 lines) to WU3, where it is consumed. Further levers: table-driven role and outcome tests; assert SQL by predicate substring instead of full-statement snapshots. Pre-agreed cut if still over 800: unit 3 (picker, ~380) becomes its own PR `feat/student-enrollment-1b-picker` (base WU1 branch), and WU2 branches from it.
- **WU2 ~850.** Levers: reuse the repo's existing `AlertDialog`/`Combobox` test helpers; one parametrized dialog test. Pre-agreed cut if over 800: `group-picker.tsx` plus the replace dialog path (tests 7.5, code in 7.6) becomes `feat/student-enrollment-2b-picker`, with list, drop, actions and page in 2a.
- **WU3 ~520.** Inside budget.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Audit actions, `enrollment-write.ts`, allowlist guard | WU1 (base: tracker) | `npx vitest run src/lib/audit src/lib/data/enrollment-write.test.ts src/lib/data/inscripcion-writes.test.ts` | N/A: DB double; nothing calls the writer until WU2 | Revert audit files, `enrollment-write.ts`, guard test (no behavior depends on them) |
| 2 | Student picker read, `Asignatura.Activo` fix | WU1 | `npx vitest run src/lib/data/enrollment-picker.test.ts src/lib/data/enrollment.test.ts` | N/A: DB double; picker unused until WU2 | Revert `enrollment-picker.ts`; the one-line `Activo` filter reverts alone |
| 3 | `/enrollment` actions and validation | WU2 (base: WU1 branch) | `npx vitest run src/lib/validations/inscripcion.test.ts "src/app/(dashboard)/enrollment/actions.test.ts"` | N/A: mocks of `dal`, writer, `next/cache` | Revert `actions.ts`, `inscripcion.ts` |
| 4 | Page, list, picker, confirm dialog, i18n | WU2 | `npx vitest run "src/app/(dashboard)/enrollment" src/i18n` | `npm run dev` walk on a disposable Neon branch (task 13.x, ASK OWNER) | Revert `enrollment/` folder and `enrollment.*` keys |
| 5 | Nav item and dashboard shortcut | WU3 (base: WU2 branch) | `npx vitest run src/lib/auth/permissions.test.ts src/lib/navigation.test.ts src/i18n "src/app/(dashboard)/(home)"` | `npm run dev`: sidebar and home as estudiante and as the other four roles | Revert `permissions.ts`, `navigation.ts`, nav keys |
| 6 | Intake empty-state split, entry nudge, `/requests` link | WU3 | `npx vitest run "src/app/(dashboard)/requests" src/lib/data/enrollment.test.ts src/i18n` | `npm run dev` walk (task 13.x) | Revert intake files and keys; data split reverts with them |
| 7 | Docs: RF-16, RF-12, RN-21, changelog, roadmap | WU3 | `rg -n "RF-16" docs/requirements.md docs/roadmap.md` (readback) | N/A: documentation | Revert docs commit; code untouched |

## Phase 0: Tracker and planning docs (before WU1)

- [x] 0.1 Reconcile `openspec/changes/student-enrollment/design.md` with the specs (spec wins) in the docs commit: SE-4 and SE-2 step 2 take `max(Periodo)` over active grupos of ACTIVE asignaturas (spec "Inactive rows do not set the period"); SE-5 `listMyEnrollments` lists effective enrollments of ALL periods (spec "Own effective enrollments list"); SE-11 `/requests` empty state always links to `/enrollment` (spec "Empty state links to enrollment"), no extra read there
- [x] 0.2 On tracker `feat/student-enrollment`, stage only `openspec/changes/student-enrollment/` and commit `docs(student-enrollment): add the SDD planning documents`; do not stage `package-lock.json`
- [x] 0.3 `[READ-ONLY]` design open question 1: `select count(*) from "Inscripcion"` on production through the Neon CLI connection string (the `.env` URL may be stale); record the count here. If greater than 0, STOP and tell the owner (rows predating the writer have no audit trail) **Result (2026-10-24, read-only transaction through the `.env` URL): `count(*)` = 0, no STOP.** The `.env` URL may differ from production; re-confirm with the Neon CLI string if in doubt.
- [ ] 0.4 Push the tracker and open the tracker PR to `main` as draft/no-merge, with the chain table above Not done in this run: no push and no PR were requested.

## Phase 1: WU1 / unit 1 - Audit events (RNF-06)

- [x] 1.1 Branch `feat/student-enrollment-1-data` from the tracker
- [x] 1.2 RED `src/lib/audit/types.test.ts`: `AUDIT_ACTIONS` gains exactly `inscripcion.creada`, `inscripcion.reactivada`, `inscripcion.desactivada`; `AuditEntityType` accepts `"Inscripcion"`; all existing pinned entries unchanged (audit-log "Closed set", "Existing events unaffected")
- [x] 1.3 GREEN `src/lib/audit/types.ts`: add the three actions, the entity type and the payload type (`{ grupoId, motivo? }`)
- [x] 1.4 RED `src/lib/audit/events.test.ts`: `inscripcionEvent` table (action to meaning; `entidadId` is `estudianteId`; `datos` is `{ grupoId }`, desactivada adds `motivo: "baja" | "reemplazo"`); `enrollmentWriteEvents` per `EnrollResult`/`DropResult` (created -> `[creada]`; reactivated -> `[reactivada]`; replace -> one `desactivada(reemplazo)` per sibling then the `creada`/`reactivada`; every refusal and no-op -> `[]`); payload JSON contains no `Periodo`, `NumeroGrupo`, asignatura, docente name/email/phone, student name/CIF/email; password/hash/bcrypt leak scan (audit-log "Action to meaning", "Successful operations", "Payload has ids and no names", "Payload-leak check", AL-ONE)
- [x] 1.5 GREEN `src/lib/audit/events.ts`: `inscripcionEvent(...)` and `enrollmentWriteEvents(estudianteId, result)` (SE-8)
- [x] 1.6 Commit unit 1: `feat(enrollment): add the inscripcion audit actions and event builders`

## Phase 2: WU1 / unit 1 - Writer and allowlist guard (SE-1..SE-3, SE-12)

- [x] 2.1 RED `src/lib/data/inscripcion-writes.test.ts`: replace the "no writer" pin with `ALLOWED_WRITERS = ["lib/data/enrollment-write.ts"]` (paths normalized to `/`, Windows-safe): no offender outside the list; the allowlisted file DOES match a write pattern (the list cannot rot); it contains no `delete` shape; keep the "detects the write shapes" case (academic-catalog "Only the allowlisted writer writes Inscripcion"; SE-12, D7). Fails until 2.8
- [x] 2.2 RED `src/lib/data/enrollment-write.test.ts` enroll outcomes (table): created, reactivated, `already_enrolled` (no write, no audit), older period, grupo inactive, asignatura inactive, unknown id (`not_eligible`: nothing stored, no audit); no count query, so a twelfth enrollment is accepted; same pair re-enrolled after drop reuses the row, never a second insert (student-enrollment "Enroll outcomes", "No enrollment limit", "Re-enroll after drop reuses the row"; academic-catalog "Duplicate pair keeps one row", "Inactive pair is reactivated")
- [x] 2.3 RED same file, latest period is evaluated at write time: rendered SQL of the target statement has the `max(Periodo)` subquery joining `Asignatura` with both `Activo` filters (SE-4; student-enrollment "Inactive rows do not set the period")
- [x] 2.4 RED same file, role integrity (table, 5 roles + inactive estudiante + unknown id): the first statement is the lock select with `Rol.Codigo = 'estudiante'`, `Usuario.Activo`, and rendered `for no key update`; any refusal (`not_student`) runs no further statement and writes no audit (academic-catalog "Role of the referenced user", "Unknown estudiante or grupo is refused"; RNF-01; SE-1, SE-3)
- [x] 2.5 RED same file, replace: sibling deactivation `update` is scoped to the same `AsignaturaId` and `Periodo`, `GrupoId <>` target, `Activo` only, `returning GrupoId`; other asignaturas and other periods are not in its predicate; result `replaced` lists the siblings; audit rows are the last statement, on the same `tx`, `desactivada` first then `creada`/`reactivada`; lock then data statements order pinned (student-enrollment "Replace", "Other asignaturas and periods untouched", "Racing enrollments" argued by the lock, not executed; audit-log "Successful operations")
- [x] 2.6 RED same file, atomicity and failure: a throwing data statement or a throwing audit insert rethrows out of the transaction callback (rollback by construction), emits one sanitized log line `enrollment.write.failed` (actor, error name, SQLSTATE; no message, no params), and no audit is reported as written (student-enrollment "Replace is atomic", "Write fails"; audit-log "Operations that leave no row")
- [x] 2.7 RED same file, `dropGroup`: success sets `Activo=false` with `returning`, one `desactivada(baja)`; foreign inscripcion, unknown group id and already-inactive -> `not_enrolled`, no audit; non-student -> `not_student`; source contains no `delete` (student-enrollment "Confirm drop", "Drop refusals"; D7)
- [x] 2.8 GREEN `src/lib/data/enrollment-write.ts` (`import "server-only"`; `EnrollResult`/`DropResult` per design; `enrollInGroup`, `dropGroup`; actor and student id are the same argument, never read from a payload); 2.1 now passes
- [x] 2.9 Commit unit 1: `feat(enrollment): add the student enrollment writer with role guard, replace and audit`

## Phase 3: WU1 / unit 2 - Student picker read (SE-4, SE-5, SE-7) [P: independent of Phases 1-2]

> Shipped in the `feat/student-enrollment-1b-picker` branch (WU1b), not in the `-1-data` PR: the 5.2 cut. The tasks below stay marked done; WU2 builds on that branch.

- [x] 3.1 RED `src/lib/data/enrollment-picker.test.ts` `getLatestPeriod`: greatest `Periodo` among active grupos of active asignaturas; an inactive grupo and an active grupo of an inactive asignatura do not set it; none -> `null` (student-enrollment "Latest period is the greatest...", "Inactive rows do not set the period")
- [x] 3.2 RED `listMyEnrollments(s)`: effective filter (table: inactive inscripcion / inactive grupo / inactive asignatura -> hidden); includes earlier periods whose grupo is active; order asignatura name then group number; docente null kept as `null`; returns `asignaturaId` and `periodo` so the UI can detect a replace (student-enrollment "Effective enrollments shown", "Non-effective rows hidden", "Group without teacher")
- [x] 3.3 RED `inOpenRequest` (SE-7): SQL predicate pinned to `SolicitudAsignatura` joined to `Solicitud` with `EstudianteId = $s` and `Estado in ('borrador','devuelta')`; cases `pendiente`, `aprobada`, another student's draft -> false (student-enrollment "Draft uses the group", "Returned request uses the group", "No dependent request, no warning")
- [x] 3.4 RED `listEnrollableAsignaturas(s, periodo)`: only active asignaturas with an active grupo in the period; `ownCarrera` from `Asignatura.CarreraId = Usuario.CarreraId`; own first then nombre; others carry `Carrera.Nombre`; student with no carrera -> all in one list; capped at `CATALOG_OPTIONS_MAX` with `truncated` (student-enrollment "Own carrera first", "Student without carrera")
- [x] 3.5 RED `listEnrollableGroups(asignaturaId, periodo)` and `loadEnrollmentPage(s, asignaturaId|null)`: selected column set pinned (docente `NombreCompleto` only; never email or phone; serialized result searched for both); `dias` decoded via `decodeDias`; wrapper never throws and returns `degraded: true` on any read error; `null` period -> "no offering" data; invalid or ineligible asignatura id -> no groups (student-enrollment "Docente contact data is never exposed", "Read fails", "No offered group")
- [x] 3.6 GREEN `src/lib/data/enrollment-picker.ts` (`import "server-only"`; `getLatestPeriod`, `listMyEnrollments`, `listEnrollableAsignaturas`, `listEnrollableGroups`, `loadEnrollmentPage`)
- [x] 3.7 Commit unit 2a: `feat(enrollment): add the student-scoped enrollment picker reads` Committed LAST of WU1 (after phase 4) so the pre-agreed 1b cut is a clean branch point.

## Phase 4: WU1 / unit 2 - Eligible groups require an active asignatura (D12)

- [x] 4.1 RED `src/lib/data/enrollment.test.ts`: the rendered `listEligibleGroups` query filters `Asignatura.Activo` (style of the existing SQL pin at lines ~77-92); the group of an inactive asignatura is absent; signature and fail-loud behavior unchanged (academic-catalog "Eligible groups require an active asignatura", "Active grupo of an inactive asignatura is hidden"; justification-intake "Subject of an inactive asignatura not offered")
- [x] 4.2 GREEN `src/lib/data/enrollment.ts`: add `eq(asignatura.activo, true)` to the `where`
- [x] 4.3 Commit: `fix(enrollment): hide groups of inactive asignaturas from the eligible list`

## Phase 5: WU1 - Gates and PR

- [x] 5.1 Gates WU1: `npx vitest run src/lib`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` (dummy `DATABASE_URL`); record exact results **Results (2026-10-24):** `npx vitest run src/lib` 105 files / 2259 tests pass; `npm test` 238 files / 5162 tests pass; `npm run typecheck` clean (after `npx next typegen`); `npm run lint` clean only with `prettier/prettier` `endOfLine: auto` (raw run reports CRLF noise on every file, also on untouched ones); `npm run format:check` fails on pre-existing markdown/json under `docs/`, `openspec/` and generated `.vitest/`, `.engram/` (the tracker already fails), and `npx prettier --check --end-of-line auto src i18n` is clean; `npm run build` passes with dummy `DATABASE_URL` plus a dummy 32-char `AUTH_SECRET` (the build needs both).
- [ ] 5.2 Measure the authored diff against the tracker (target ~830, `openspec/` excluded). If over 800, apply the pre-agreed cut (picker to `feat/student-enrollment-1b-picker`) and report **Measured: 1,295 authored lines (1,276 added + 19 deleted, `openspec/` excluded), over the 800 budget. STOP: pre-agreed cut proposed. Without the picker commit (496 lines) WU1 is 799.**
- [ ] 5.3 Open the WU1 PR (base: tracker) with the chain diagram marking WU1, forecast, gates, measured size and "no migration; writer unused until WU2"; merge into the tracker with a merge commit after review

## Phase 6: WU2 / unit 3 - Validation and actions (SE-10)

- [x] 6.1 Branch `feat/student-enrollment-2-ui` from the WU1 branch; PR base is the WU1 branch until it merges, then retarget to the tracker **Done from `feat/student-enrollment-1b-picker` (the chain note above); PR base is `-1b-picker`.**
- [x] 6.2 `[READ-ONLY]` read the Next 16 guides in `node_modules/next/dist/docs/` for server components, server actions, `revalidatePath` and `searchParams` before coding (`AGENTS.md`)
- [x] 6.3 RED `src/lib/validations/inscripcion.test.ts`: `enrollmentInputSchema` accepts a positive integer `grupoId`; rejects `0`, negatives, decimals, `NaN`, strings, `null`, missing; an extra `estudianteId` key is dropped, not carried
- [x] 6.4 GREEN `src/lib/validations/inscripcion.ts`
- [x] 6.5 RED `src/app/(dashboard)/enrollment/actions.test.ts`: role table (`docente`, `secretaria`, `coordinacion`, `administrador`) and no session -> denied, writer never called, `revalidatePath` never called; a payload carrying another `estudianteId` -> the writer receives `session.sub` only; zod refusal -> error key, writer not called; writer refusals (`not_student`, `not_eligible`, `already_enrolled`, `not_enrolled`) -> `{ ok:false, error:<i18n key> }`, no revalidate; success -> `revalidatePath("/enrollment")` once; thrown writer error -> `error: "unexpected"`, no revalidate (student-enrollment "Other roles denied", "Unauthenticated call", "Forged student id is ignored", "Write fails"; audit-log "Actor from the session")
- [x] 6.6 GREEN `src/app/(dashboard)/enrollment/actions.ts` (`"use server"`; `enrollAction`, `dropAction`; `requireRole(...rolesSolicitantes)` first)
- [x] 6.7 Commit unit 3: `feat(enrollment): add the enroll and drop server actions` **Writer results map to `enrollment.errors.<code>` (codes `not_student`, `not_eligible`, `already_enrolled`, `not_enrolled`, `invalid`, `unexpected`); the action returns the code, the UI translates it.**

## Phase 7: WU2 / unit 4 - Messages, components, page (RNF-11, RNF-12)

- [x] 7.1 RED `src/i18n/enrollment-messages.test.ts`: every `enrollment.*` key (title, description, empty states, labels, buttons, dialog titles and descriptions, warning, error keys incl. `not_eligible`, `already_enrolled`, `not_enrolled`, `not_student`, `unexpected`, degraded) exists in `es` and `en` with identical key sets and non-empty values (student-enrollment "Key parity")
- [x] 7.2 GREEN `i18n/es.json` and `i18n/en.json`: `enrollment.*` namespace
- [x] 7.3 RED `src/app/(dashboard)/enrollment/confirm-change-dialog.test.tsx`: drop and replace variants name the affected group; warning shown only when `inOpenRequest`, never blocks confirm; cancel calls nothing and closes; a failed action shows its error and keeps the dialog usable; controls are at least 44 px (student-enrollment "Cancel drop", "Cancel replace", "Draft uses the group", "No dependent request, no warning")
- [x] 7.4 RED `src/app/(dashboard)/enrollment/my-enrollments.test.tsx`: entry shows code, name, period, group number, docente or the "no teacher assigned" label; drop control opens the dialog; empty state invites the picker (student-enrollment "Effective enrollments shown", "Group without teacher", "No enrollments")
- [x] 7.5 RED `src/app/(dashboard)/enrollment/group-picker.test.tsx`: own-carrera options first; other carrera found by code, name or carrera name ("Cálculo"); no-results state shows the term with a clear control; student without carrera sees one list; already enrolled group is marked and offers no enroll; selecting an asignatura calls `router.replace("?asignatura=<id>")`; enrolling with a sibling in the same asignatura and period opens the replace dialog, otherwise enrolls directly; `truncated` notice (student-enrollment "Own carrera first", "Other carrera by search", "Search without results", "Already enrolled group", "Replace")
- [x] 7.6 GREEN `confirm-change-dialog.tsx`, `my-enrollments.tsx`, `group-picker.tsx` under `src/app/(dashboard)/enrollment/` (reuse `AlertDialog`, `Combobox`, `EmptyState`)
- [x] 7.7 RED `src/app/(dashboard)/enrollment/page.test.tsx`: other roles and anonymous denied with no read performed; degraded read renders the shared `role="status"` alert in place of list, picker and empty states, with no action present; no offering -> localized empty state; `?asignatura=` guard (invalid, `0`, negative, ineligible -> no group list); fixture docentes with email and phone: serialized props and rendered HTML contain neither; exactly one `h1` (student-enrollment "Read fails", "No offered group", "No contact data reaches the student")
- [x] 7.8 RED `src/app/(dashboard)/enrollment/layout-360.test.tsx`: page, picker and each dialog at 360 px have no horizontal overflow; tokens per `docs/design-system.md` (student-enrollment "No horizontal scroll")
- [x] 7.9 GREEN `src/app/(dashboard)/enrollment/page.tsx` (server component: `requireRole`, session id, positive-integer guard as in `requests/[id]/correct/page.tsx`, `loadEnrollmentPage`, `PageHeader`, `DegradedAlert`)
- [x] 7.10 Commit unit 4, committed as four work-unit commits so the pre-agreed 2a/2b cut and the finer cuts fall on commit boundaries: `feat(enrollment): add the enrollment list with the confirmed drop`, `feat(enrollment): add the enrollment page`, `feat(ui): let the combobox report its text and the empty state clear through a handler`, `feat(enrollment): add the group picker with the confirmed replace`. **Deviations: the confirm dialog is one generic frame (texts and action come from `my-enrollments.tsx` and `group-picker.tsx`), so 7.3 is covered through those two tests plus `confirm-change-dialog.test.tsx`; the picker needed two small shared changes (`Combobox` `inputValue`/`onInputValueChange`, `EmptyState` no-results `clear` as `{ label, onClick }`) because the combobox clears its text on close and the shared no-results state only took a link; the 360 px check is a static class guard like `requests/new/layout-360.test.tsx` (jsdom has no layout).**

## Phase 8: WU2 - Gates and PR

- [x] 8.1 Gates WU2 (same five, dummy `DATABASE_URL`); `npx vitest run "src/app/(dashboard)/enrollment" src/lib src/i18n`; record results **Results (2026-10-24):** `npm test` 246 files / 5303 tests pass; `npm run typecheck` clean (after `npx next typegen`); `npm run lint` clean only with `prettier/prettier` `endOfLine: auto` (raw run: 92,591 CRLF errors, noise on every file); `npx prettier --check --end-of-line auto src i18n` clean (raw `npm run format:check` fails on CRLF, docs, openspec, .vitest, .engram as on the tracker); `npm run build` passes with dummy `DATABASE_URL` and 32-char `AUTH_SECRET`, `/enrollment` listed as a dynamic route.
- [x] 8.2 Measure the authored diff against the WU1 head (target ~850). If over 800, split per the pre-agreed cut (2a list, drop, actions, page / 2b picker and replace) and report **Measured against `-1b-picker` (`openspec/` and `.engram/` excluded): 2,398 authored lines (2,389 added + 9 deleted), about 3x the 800 budget (tests 1,646, production code 634, locale messages 118). Per commit: actions 308 / list and drop 803 / page 341 / combobox and empty-state handlers 100 / picker and replace 856. The pre-agreed 2a (actions, list, drop, page = 1,452) / 2b (shared handlers, picker, replace = 956) cut does not bring either half under 800. STOP: do not open the WU2 PR as is; the owner decides the cut (see the apply report).**
- [ ] 8.3 Open the WU2 PR (base: WU1 branch; retarget to the tracker after WU1 merges) with the chain diagram marking WU2; note "page reachable by URL only until WU3 adds the nav item"

## Phase 9: WU3 / unit 5 - Navigation and dashboard shortcut (BS-NAV-3, BS-HOME-1) [P: independent of Phase 10]

- [ ] 9.1 Branch `feat/student-enrollment-3-intake` from the WU2 branch; PR base is the WU2 branch until it merges, then retarget to the tracker
- [ ] 9.2 RED `src/lib/auth/permissions.test.ts`: `canManageOwnEnrollment` true for `estudiante`, false for the other four roles and `undefined`; equals `canFileRequests` for every role (derived from `rolesSolicitantes`, not a second list)
- [ ] 9.3 GREEN `src/lib/auth/permissions.ts`: `canManageOwnEnrollment(rol) = canFileRequests(rol)`
- [ ] 9.4 RED `src/lib/navigation.test.ts`: `NAV_ITEMS` has `enrollment` (`/enrollment`, `BookMarked`) right after `newRequest`; entries per role table (estudiante: Dashboard, My requests, New request, Enrollment, Settings; other four roles unchanged and without it); `shortcutsFor("estudiante")` is My requests, New request, Enrollment; `/settings` entry untouched; active marker only on `/enrollment` and not on `/requests/new`; trail label for `/enrollment` in `es` and `en` (backoffice-shell "Entries per role", "Entry and active marker", "Trail", "Hidden from other roles", "Home per role")
- [ ] 9.5 GREEN `src/lib/navigation.ts`; add `nav.enrollment` and `dashboard.shortcuts.enrollment` to `i18n/es.json` and `i18n/en.json`; update `src/i18n/catalog-parity.test.ts` and any home or sidebar fixtures (`src/app/(dashboard)/(home)/page.test.tsx`, sidebar tests) that list student entries
- [ ] 9.6 Commit unit 5: `feat(enrollment): add the student enrollment nav item and dashboard shortcut`

## Phase 10: WU3 / unit 6 - Intake empty-state split and nudges (SE-11) [P: independent of Phase 9]

- [ ] 10.1 RED `src/lib/data/enrollment.test.ts`: `listEnrolledGroups(s)` returns active effective rows unfiltered; `withClassIn(groups, range, schedule)` applies the port; `listEnrollmentFailSoft` returns `{ data, degraded, enrolled }` with `enrolled` true when the unfiltered list is non-empty even if the range filters all out, false when no enrollment; a single enrollment query serves both lists; on a read failure `degraded: true` and `enrolled: true` (no wrong "no enrollment" message); `listEligibleGroups` signature and fail-loud unchanged (justification-intake "No enrollment at all", "Enrolled but no class in these dates", "Degraded read is not an empty state")
- [ ] 10.2 RED same file, `hasActiveEnrollmentFailSoft(s)`: true with one effective enrollment, false with none, `null` on failure, `limit 1` in the rendered SQL, same three active filters
- [ ] 10.3 GREEN `src/lib/data/enrollment.ts`: split `listEnrolledGroups` and `withClassIn`, add `enrolled`, add `hasActiveEnrollmentFailSoft`
- [ ] 10.4 RED `src/app/(dashboard)/requests/new/subjects-step.test.tsx` and `flow-steps` test: `!enrolled` -> `intake.subjects.noEnrollment` text with a link to `/enrollment`; enrolled but empty -> reworded `intake.subjects.empty` ("no class in these dates"), the way back to the dates step, no `/enrollment` link; the two rendered texts differ; degraded -> neither message; update existing assertions of the old generic message (justification-intake "No enrollment at all", "The two empty states differ", "Degraded read is not an empty state")
- [ ] 10.5 GREEN `src/app/(dashboard)/requests/new/flow-steps.tsx` and `subjects-step.tsx` (pass `enrolled`); `intake.subjects.noEnrollment` and reworded `intake.subjects.empty` in `i18n/es.json` and `i18n/en.json`; extend `src/i18n/intake-messages.test.ts`
- [ ] 10.6 RED `src/app/(dashboard)/requests/new/page.test.tsx` and `requests/[id]/correct/page.test.tsx`: notice with link to `/enrollment` when `hasActiveEnrollmentFailSoft` is `false` and step 1 stays usable; no notice when `true` or `null`; the correct page fallback is `{ data: [], degraded: false, enrolled: true }` and shows no notice; notice at 360 px in `layout-360.test.tsx` (justification-intake "Notice for a student without enrollment", "No notice with enrollment", "No notice when the read degrades")
- [ ] 10.7 GREEN `requests/new/page.tsx` (non-blocking notice) and `requests/[id]/correct/page.tsx` (fallback shape); notice keys in both locale files, extend `intake-messages.test.ts`
- [ ] 10.8 RED `src/app/(dashboard)/requests/page.test.tsx`: the empty state (no presented request; a draft alone does not count) links to `/enrollment`; with a presented request the list shows and the empty state does not; link text in `es` and `en` (student-requests "Empty state links to enrollment", "No empty state with requests")
- [ ] 10.9 GREEN `src/app/(dashboard)/requests/page.tsx` plus the link key in both locale files, extend `src/i18n/requests-messages.test.ts`
- [ ] 10.10 Commit unit 6: `feat(enrollment): split the step 2 empty state and nudge students without enrollment`

## Phase 11: WU3 / unit 7 - Documentation (RF-16, RF-12, RN-21)

- [ ] 11.1 `docs/requirements.md` (Spanish, neutral): add RF-16 (the student declares, replaces and drops their own enrollment in groups of the latest period; unverified; audited; one group per asignatura and period; confirmed drop) with acceptance criteria; amend RF-12 (inscripciones are also maintained by the student's own declaration) and RN-21 (until the institutional register is available the internal catalog, including declared enrollments, is the source); update the RF counts in text, and add a changelog row dated 2026-10-24 marked "pendiente de sincronizar con la matriz" (student-enrollment "Documents list the new and amended requirements")
- [ ] 11.2 `docs/roadmap.md`: add row 14 `student-enrollment` covering RF-16, RF-12, RF-04; RN-21, RN-22; RNF-06, RNF-12, state `pendiente` (set to `archivado` at closeout 14.3)
- [ ] 11.3 Readback: `rg -n "RF-16" docs/requirements.md docs/roadmap.md` and `rg -n "student-enrollment" docs/roadmap.md` show the new and amended entries; `npm run format:check` clean on both files
- [ ] 11.4 Commit unit 7: `docs(enrollment): add RF-16 and amend RF-12 and RN-21`

## Phase 12: WU3 - Gates and PR

- [ ] 12.1 Gates WU3 (same five, dummy `DATABASE_URL`); record results
- [ ] 12.2 Measure the authored diff against the WU2 head (target ~520); open the WU3 PR (base: WU2 branch, retarget to the tracker after WU2 merges) with the chain diagram marking WU3
- [ ] 12.3 After WU1, WU2 and WU3 are in the tracker, re-run `npm test`, typecheck, lint, `npm run build` on the tracker head

## Phase 13: Owner manual walk (after WU3 is on the tracker; the app writes to the database, so every DB step is ASK OWNER)

- [ ] 13.1 ASK OWNER, explicit yes per command: create a disposable Neon branch from production and point the local dev server at it (never production)
- [ ] 13.2 ASK OWNER, explicit yes per command: practice accounts (student, secretaria); no seeding without the yes
- [ ] 13.3 Walk at 360 px and desktop, `es` and `en`: enroll, replace (dialog names the group), cancel, drop (dialog; draft warning when a draft uses it), search another carrera, no-offering state, sidebar and dashboard shortcut as estudiante and as another role, `/requests/new` notice and both step 2 empty states, `/requests` empty-state link, keyboard only
- [ ] 13.4 ASK OWNER, explicit yes per command: `[READ-ONLY]` query on the walk branch: one `inscripcion.*` audit row per change, none for refused or cancelled operations, payloads hold ids only; codes and counts only
- [ ] 13.5 ASK OWNER, explicit yes per command: delete the walk branch; record every result and date here

## Phase 14: Closeout (after phase 13)

- [ ] 14.1 Verify (`sdd-verify`): every spec scenario against a test or the walk record
- [ ] 14.2 Spec sync: merge the deltas into `openspec/specs/{academic-catalog,audit-log,justification-intake,student-requests,backoffice-shell}/spec.md` (supersede the "no code writes Inscripcion" bullet of the academic-catalog assumptions) and create `openspec/specs/student-enrollment/spec.md`; readback with `diff`
- [ ] 14.3 `docs/roadmap.md` row 14 state `archivado`; Notas: self-declared and unverified (RN-15 gate remains), staff view and `Origen` column out of scope (D9, D10), thesis matrix sync pending
- [ ] 14.4 Archive to `openspec/changes/archive/<date>-student-enrollment/` with `git mv` and an `archive-report.md`
- [ ] 14.5 Owner: merge the tracker PR into `main` with a merge commit after all three slices are in it; keep the tracker branch; delete merged slice branches
