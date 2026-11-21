# Tasks: Catalog Schedule, Secretaría Maintenance of Inscripciones

> Strict TDD (vitest): every behavior task is a RED task (failing test written first, run, seen failing) followed by a GREEN task that ends with a `Verify:` line. Focused command: `npx vitest run <paths>`. Gates per work unit (**G**): `npx next typegen && npm run typecheck`; focused vitest; `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]" src`; `npx prettier --check --end-of-line auto src i18n`; at the end of each slice `npm test` and `npm run build` with a dummy `DATABASE_URL` and a dummy 32-char `AUTH_SECRET` (PowerShell: `$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'`). Windows CRLF noise: see `openspec/config.yaml` gotchas.
> DB rule (`CLAUDE.md`): this change has NO schema change, migration, seed or write SQL, and no agent task touches Neon. Every task that would touch a Neon database is tagged `[USER][CONFIRM]` (explicit per-command "yes", never batched; the agent never creates, copies or edits `.env`). Data tests use `createDbDouble` (`src/lib/data/test-support/db-double.ts`).
> Spec IDs: RF-12 (a)(b)(c), RF-17 (b)(d)(e), RN-21, RN-27 (related), RNF-01, RNF-02, RNF-06, RNF-11, RNF-12 (`docs/requirements.md`). `EA-*` = `specs/enrollment-administration`; `CS-*` = `design.md`; `D1..D10` = `proposal.md` (final, not reopened). Threat matrix: N/A (design); authorization, scope and draft-leak cases are RED tasks below.
> Path alias: `CI/` = `src/app/(dashboard)/catalog/inscripciones/`. Commits: conventional, one per unit (test + code together), no AI attribution.
> Size note: the `sdd-tasks` 530-word cap is exceeded on purpose (precedent: `student-enrollment`). The design slice plan (7 slices, ~2,330 lines) is re-forecast to 15 PRs (~4,350 lines) because measured student-enrollment diffs ran ~1.9x its forecast; each PR is forecast at or under 400.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4,350 authored total, tests included, `openspec/` excluded (per-PR table below; design said ~2,330) |
| Review budget | 800 changed lines per PR for every remaining slice (owner, 2026-11-19; was 400) |
| 400-line budget risk | High in aggregate; Medium for S1a, S1b-2, S3a-1, S3b-2 (350-380 forecast); the rest Low |
| Chained PRs recommended | Yes |
| Suggested split | S1a -> S1b-1 -> S1b-2 -> S1c-1 -> S1c-2 -> S1c-3 -> S2a-1 -> S2a-2 -> S2b-1 -> S2b-2 -> S3a-1 -> S3a-2 -> S3a-3 -> S3b-1 -> S3b-2 (15 PRs) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (owner, 2026-11-19) |

Decision needed before apply: No (resolved 2026-11-19)
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Budget change (owner, 2026-11-19): `review_budget_lines` is **800** for all slices from S1b-2 on (it was 400). A slice whose authored diff is at or under 800 ships as ONE PR; the 400 figures in the forecast and per-slice cut points below are superseded by this value, and the stop rule below now reads 800. S1b-2 measured 799 and ships whole.

Decision (owner, 2026-11-19): **stacked-to-main**. There is no tracker branch. S1a is created from `main`; each later slice branch is created from the previous slice branch and its PR targets that branch until the previous PR merges, then it is retargeted (or rebased) onto `main`, so every PR merges into `main` in order. `feat/catalog-schedule` holds only the planning documents, which land as the first commit of S1a. If GitHub shows a previous slice in a child diff, retarget or rebase until clean. Stop rule: measure the authored diff (`git diff --shortstat <base>...HEAD -- . ':!openspec' ':!.engram'`) before opening each PR; if over the budget (800 since 2026-11-19, 400 before), stop and cut at the commit boundary named in the slice.

| Slice | Branch (`feat/catalog-schedule-...`) | Created from / PR base | Depends on | Est. lines |
|-------|------|------|------|-----|
| S1a-1 guard + scope SQL | `-s1a1-guard` | `main` | none | 363 measured |
| S1a-2 list params | `-s1a2-list-params` | S1a-1 | S1a-1 | 269 measured |
| S1b-1 audit reads | `-s1b1-audit-reads` | S1a | none functional (stacked) | ~210 |
| S1b-2 list read | `-s1b2-list-read` | S1b-1 | S1a | ~380 |
| S1c-1 table | `-s1c1-table` | S1b-2 | S1b-2 | 1064 measured; `size:exception` accepted by the owner (2026-11-19) |
| S1c-2 page | `-s1c2-page` | S1c-1 | S1a, S1b-1, S1b-2, S1c-1 | 852 measured; `size:exception` accepted by the owner (2026-11-20) |
| S1c-3 nav + docs | `-s1c3-nav` | S1c-2 | S1a, S1c-2 | 348 measured (includes the #108 audit fix, 93) |
| S2a-1 writer actor | `-s2a-writer` (S2a-1 and S2a-2 merged into one branch and one PR by the owner, 2026-11-20; supersedes `-s2a1-writer-actor`) | S1c-3 | S1a | ~230; 561 measured for commit 1 |
| S2a-2 staff reactivate | `-s2a-writer` (merged with S2a-1, same branch and PR; supersedes `-s2a2-staff-enroll`) | S2a-1 | S2a-1 | ~200 |
| S2b-1 toggle action | `-s2b1-actions` | S2a-2 | S1a, S2a-1, S2a-2 | ~330 |
| S2b-2 toggle wiring | `-s2b2-toggle` | S2b-1 | S1c-1, S2b-1 | ~270 |
| S3a-1 reads | `-s3a1-reads` | S2b-2 | S1b-2 | ~355 |
| S3a-2 writer replace/create | `-s3a2-writer-replace` | S3a-1 | S2a-2 | ~170 |
| S3a-3 assign action | `-s3a3-assign-action` | S3a-2 | S2b-1, S3a-2 | ~270 |
| S3b-1 assign page | `-s3b1-assign-page` | S3a-3 | S3a-1, S3a-3, S1c-1 | ~330 |
| S3b-2 assign form | `-s3b2-assign-form` | S3b-1 | S3a-3, S3b-1 | ~370 |

Parallelism: inside a slice, tasks marked `[P]` are independent. Across slices the chain is linear for review; the writer slices (S2a-1, S2a-2, S3a-2) do not depend on the UI slices and S1b-1 does not depend on S1a, so with `stacked-to-main` they could be reordered or parallelised by the owner.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| S1a | `canManageEnrollments`, `requireEnrollmentAccess`, scope SQL, list params | PR 1 | `npx vitest run src/lib/auth/permissions.test.ts src/lib/auth/enrollment-access.test.ts src/lib/data/request-scope-sql.test.ts src/lib/catalog/list-params.test.ts` | N/A: DB double, nothing calls them yet | Revert the four source files and tests; additive |
| S1b-1 | Two read audit actions, builders, `recordEnrollmentListRead` | PR 2 | `npx vitest run src/lib/audit src/lib/data/request-reads.test.ts` | N/A: DB double | Revert audit files and helper; unused until S1c-2 |
| S1b-2 | `listInscripciones`, `listInscripcionPeriods`, dependent-request count | PR 3 | `npx vitest run src/lib/data/inscripciones.test.ts` | N/A: DB double | Revert `inscripciones.ts` and its types |
| S1c-1 | List table, filters, copy | PR 4 | `npx vitest run "src/app/(dashboard)/catalog/inscripciones" src/i18n` | Walk W1 `[USER][CONFIRM]` (after S1c-3) | Revert `inscripciones-table.tsx` and `catalog.inscripciones.*` keys |
| S1c-2 | `/catalog/inscripciones` page, audited list load, new guards test | PR 5 | `npx vitest run "src/app/(dashboard)/catalog/inscripciones"` | Walk W1 | Revert `CI/page.tsx`, `CI/guards.test.ts` |
| S1c-3 | Nav item, home shortcut, pins, roadmap and requirements docs | PR 6 | `npx vitest run src/lib/navigation.test.ts src/components/app-sidebar.test.tsx src/i18n "src/app/(dashboard)/(home)"` | Walk W1: sidebar and home per role | Revert `navigation.ts`, nav keys, pins, docs hunks |
| S2a-1 | Actor-aware writer, staff lock, `staffDropGroup` | PR 7 | `npx vitest run src/lib/data/enrollment-write.test.ts src/lib/data/enrollment-write-staff.test.ts src/lib/data/inscripcion-writes.test.ts` | N/A: DB double; no caller until S2b-1 | Revert `enrollment-write.ts` refactor and the staff test file; student tests unchanged |
| S2a-2 | `staffEnrollInGroup` (reactivate-only, no sibling) | PR 8 | same three files | N/A: DB double | Revert the staff function and its tests |
| S2b-1 | Staff input schema, toggle action, guard checks, error copy | PR 9 | `npx vitest run src/lib/validations/inscripcion.test.ts "src/app/(dashboard)/catalog/inscripciones"` | N/A: mocks of guard, writer, `next/cache` | Revert `CI/actions.ts`, schema, error keys |
| S2b-2 | Row toggle, deactivation notice, reactivate rule, copy | PR 10 | `npx vitest run "src/app/(dashboard)/catalog/inscripciones" src/i18n` | Walk W2 `[USER][CONFIRM]` | Revert table wiring and its keys; read-only list remains |
| S3a-1 | `searchStudents`, `loadAssignPage`, `recordEnrollmentStudentSearch` | PR 11 | `npx vitest run src/lib/data/inscripciones.test.ts src/lib/data/request-reads.test.ts` | N/A: DB double | Revert the added reads and helper |
| S3a-2 | Staff replace and create paths (lifts the S2 guard) | PR 12 | `npx vitest run src/lib/data/enrollment-write-staff.test.ts src/lib/data/inscripcion-writes.test.ts` | N/A: DB double | Revert the writer hunk; S2 refusal returns |
| S3a-3 | Assign action | PR 13 | `npx vitest run "src/app/(dashboard)/catalog/inscripciones/actions.test.ts" "src/app/(dashboard)/catalog/inscripciones/guards.test.ts"` | N/A: mocks | Revert the action export and tests |
| S3b-1 | Assign page, audited search, list links | PR 14 | `npx vitest run "src/app/(dashboard)/catalog/inscripciones"` | Walk W3 `[USER][CONFIRM]` | Revert `CI/assign/page.tsx`, table links, keys |
| S3b-2 | Assign form with confirm step | PR 15 | `npx vitest run "src/app/(dashboard)/catalog/inscripciones/assign" src/i18n` | Walk W3 | Revert `assign-form.tsx`; page stays read-only |

## Phase 0: Planning commit and prerequisites

- [x] 0.1 On `feat/catalog-schedule-s1a-scope` (created from `main`, task 1.1), commit only `openspec/changes/catalog-schedule` as its first commit: `docs(catalog-schedule): add the SDD planning documents`. The docs of P3.2 and the catalog-management closeout already went in PR #98, so the index holds nothing else. Done: commit `d859249`.
- [x] 0.2 `[USER]` Chain strategy decided by the owner on 2026-11-19: stacked-to-main, no tracker PR.
- [x] 0.3 `[READ-ONLY]` Read the Next 16 guides in `node_modules/next/dist/docs/` for server components, server actions (`forms.md`: bound arguments are client-visible), `searchParams`, `notFound` and `revalidatePath` before S1c-2 (`AGENTS.md`).

## Phase 1: S1a scope (CS-4, CS-5, list params)

- [x] 1.1 Branch `feat/catalog-schedule-s1a-scope` from an up-to-date `main` (then task 0.1).
- [x] 1.2 [P] RED `src/lib/auth/permissions.test.ts`: `canManageEnrollments` true only for `secretaria`, false for the other four roles and `undefined`; `rolesQueGestionanInscripciones` equals `["secretaria"]`; `canManageCatalog` still true for `administrador` and `coordinacion` (EA-ACC-1 "Catalog predicate unchanged").
- [x] 1.3 GREEN `src/lib/auth/permissions.ts`: `rolesQueGestionanInscripciones = ["secretaria"] as const satisfies readonly RolUsuario[]` and `canManageEnrollments`, shaped like `rolesRevisores`. Verify: `npx vitest run src/lib/auth/permissions.test.ts`.
- [x] 1.4 RED `src/lib/auth/enrollment-access.test.ts` (model: `catalog-access.test.ts`): table `estudiante`, `docente`, `coordinacion`, `administrador`, anonymous, `secretaria` with pending password change -> denied, no `Usuario` read; invalid `session.sub` throws; secretaria with facultad -> `{ session, actorId, scope: { kind: "facultad", facultadId } }`; no facultad -> scope `none`; facultad read from the database on every call, never from the session (EA-ACC-1, EA-SCOPE-1, RNF-01).
- [x] 1.5 GREEN `src/lib/auth/enrollment-access.ts`: `requireEnrollmentAccess()` = `requireRole(...rolesQueGestionanInscripciones)` + `requestScopeFor`; fail loud. Verify: `npx vitest run src/lib/auth/enrollment-access.test.ts`.
- [x] 1.6 [P] RED `src/lib/data/request-scope-sql.test.ts` (`PgDialect` render): `enrollmentInScope(facultad)` is an exists over the student's CURRENT carrera keyed on `Inscripcion.EstudianteId`; `studentRowInScope(facultad)` keyed on `Usuario.Id`; `none` renders `false` for both; student without carrera invisible (inner join); the existing `requestInScope` assertions pass untouched (EA-SCOPE-1, CS-5).
- [x] 1.7 GREEN `src/lib/data/request-scope-sql.ts`: private `studentOfFacultad(column, facultadId)` plus the two exports; `requestInScope` keeps its rendered SQL. Verify: `npx vitest run src/lib/data/request-scope-sql.test.ts`.
- [x] 1.8 [P] RED `src/lib/catalog/list-params.test.ts`: `parseInscripcionesListParams` defaults (page 1, empty `q`/`asignatura`/`grupo`, `periodo` unset = latest, `status` `active`, default sort `student` asc, size 10); `status=all` and unknown values fall back (EA-FILT-1 allows `active`/`inactive` only); `INSCRIPCIONES_SORT_KEYS = ["student","subject","group"]`; `catalogListHref("/catalog/inscripciones", ...)` omits defaults and writes `periodo`, `asignatura`, `grupo` through an `extra` map; page resets when a filter changes; the two existing bases keep their hrefs.
- [x] 1.9 GREEN `src/lib/catalog/list-params.ts`: `CatalogListBase` adds `"/catalog/inscripciones"`, sort keys, parser, `extra`. Verify: `npx vitest run src/lib/catalog/list-params.test.ts`.
- [x] 1.10 Gates G + measure. **Measured 632 authored lines (forecast ~380), over budget. Owner decision 2026-11-19: two stacked PRs cut at `f860476`: S1a-1 `feat/catalog-schedule-s1a1-guard` (`c776de8` + `f860476`, 363 lines, base `main`) and S1a-2 `feat/catalog-schedule-s1a2-list-params` (`08d0ba1`, 269 lines, base S1a-1). Later slices measure after each commit, and their forecasts are read at about 1.7x.** Open PR. Commits: `feat(auth): add the enrollment management predicate and guard`, `feat(enrollment): add the enrollment scope SQL`, `feat(catalog): add the inscripciones list params`.
  - Apply result (2026-11-19): gates G green and measured, PR NOT opened. Measured authored diff is 632 lines (609 added, 23 removed), over the 400 budget (forecast ~380): commits `c776de8` (189), `f860476` (174), `08d0ba1` (269). Stop rule applies: cut into PR A = `c776de8` + `f860476` (363 lines, tasks 1.2-1.7) and PR B = `08d0ba1` (269 lines, tasks 1.8-1.9). See `apply-progress.md`.

## Phase 2: S1b-1 audited read plumbing (CS-6b, D10)

- [x] 2.1 Branch `feat/catalog-schedule-s1b1-audit-reads` from S1a.
- [x] 2.2 RED `src/lib/audit/types.test.ts`: `AUDIT_ACTIONS` gains exactly `inscripcion.lista.consultada` and `inscripcion.estudiantes.consultada`; every existing pinned entry unchanged; no new entity type (`Facultad` already exists); the closed `inscripcion.*` write set is unchanged (audit-log "no write action added").
- [x] 2.3 GREEN `src/lib/audit/types.ts`: the two actions and the payload type `{ periodo, status, filters: { q, asignatura, grupo }, page, total }`. Verify: `npx vitest run src/lib/audit/types.test.ts`.
- [x] 2.4 RED `src/lib/audit/events.test.ts`: both builders return entity `Facultad`, `entidadId = facultadId`, `datos` exactly the payload keys with the three filters as booleans; serialized payload for search text "Pérez", a student id, name, CIF, a group id and a request count contains none of them (audit-log "List load writes one row without student data").
- [x] 2.5 GREEN `src/lib/audit/events.ts`: `inscripcionListaConsultadaEvent`, `inscripcionEstudiantesConsultadaEvent` (both land here so the closed set is pinned once; the search helper arrives in S3a-1). Verify: `npx vitest run src/lib/audit`.
- [x] 2.6 RED `src/lib/data/request-reads.test.ts`: `recordEnrollmentListRead(actorId, facultadId, payload)` opens one transaction and inserts exactly one list event with that actor; a failing insert rejects (not swallowed); `cache()` makes a second call with the same args a no-op (same shape as the `recordQueueRead` tests).
- [x] 2.7 GREEN `src/lib/data/request-reads.ts`: `recordEnrollmentListRead`. Verify: `npx vitest run src/lib/data/request-reads.test.ts`.
- [x] 2.8 Gates G + measure (~210). Open PR is left to the parent. Commit: `feat(audit): add the audited read of the inscripciones list`.
  - Apply result (2026-11-19): gates G green and measured, PR NOT opened. Commit `367d79e`, measured **297 authored lines** against base S1a-2 (295 added, 2 removed; forecast ~210, 1.4x). Focused 151/151, full suite 8525 passed, typecheck, eslint, prettier clean, build OK. See `apply-progress.md`.

## Phase 3: S1b-2 list read (CS-6, CS-7)

- [x] 3.1 Branch `feat/catalog-schedule-s1b2-list-read` from S1b-1.
- [x] 3.2 RED `src/lib/data/inscripciones.test.ts` core (db double): scope `none` -> `{ data: [], total: 0, degraded: false }` with no statement run; facultad scope renders `enrollmentInScope`; selected columns pinned to student `NombreCompleto` and `Cif` (serialized result searched for any email and phone, EA-PII-1); states table of the four EA-LIST-1 rows -> raw `activo` and `effective`; `writable` true only for an offered group (latest period, grupo and asignatura active); failing read -> `{ data: [], degraded: true }` without throwing (EA-DEG-1).
- [x] 3.3 GREEN `src/lib/data/inscripciones.ts` (`import "server-only"`) `listInscripciones` core + `InscripcionListItem` and `CatalogListResult` use in `src/lib/catalog/types.ts`. Verify: `npx vitest run src/lib/data/inscripciones.test.ts`.
- [x] 3.4 RED same file, filters (EA-FILT-1 table): student by name or CIF (`containsPattern`), asignatura by code or name, group exact number, period exact (default `getLatestPeriod()`, unknown value falls back), status on the RAW state (`active` default, `inactive`); filters AND-combine; stable total order with `(estudianteId, grupoId)` tie-break; page clamp; each sort key; no latest period -> empty, not an error.
- [x] 3.5 GREEN `listInscripciones` filters, sort and paging. Verify: same command.
- [x] 3.6 RED same file: `hasActiveSibling` (another raw-active row of the same student, asignatura and period, per the spec sibling term; not other asignaturas or periods); `dependentRequests` SQL render contains every `VISIBLE_STATES` value and never the literal `'borrador'`; counts only this student's requests naming this group; count table of EA-DEACT-1 (pendiente+devuelta=2, aprobada+rechazada=2, only borrador=0, pendiente+borrador=1).
- [x] 3.7 GREEN `listInscripciones`: correlated `count(*)` column and sibling flag. Verify: same command.
- [x] 3.8 RED same file: `listInscripcionPeriods(scope)` returns the distinct periods of in-scope rows, newest first; `none` -> `[]` with no query; failure -> `[]`, no throw.
- [x] 3.9 GREEN `listInscripcionPeriods`. Verify: same command.
- [x] 3.10 Reconcile `design.md` CS-6: `status` filters the RAW state, `writable` means an offered group and `hasActiveSibling` means a raw-active sibling, to match EA-FILT-1, EA-REACT-1 and EA-CHG-1 (spec wins).
- [x] 3.11 Gates G + measure done (799 authored lines, one PR under the 800 budget; commits `cb7f2ee` 636, `28742bc` 167). Open PR: left to the parent.

## Phase 4: S1c-1 list table and copy (EA-LIST-1, EA-FILT-1, EA-UI-1, RNF-11)

- [x] 4.1 Branch `feat/catalog-schedule-s1c1-table` from S1b-2. The branch first ran as `feat/catalog-schedule-s1c-list-page` (S1c-1 and S1c-2 together); Phase 4 alone measured 1064 lines, so the owner (2026-11-19) shipped it as its own PR with `size:exception` and renamed the branch.
- [x] 4.2 RED `src/i18n/catalog-parity.test.ts`: `catalog.inscripciones.*` keys (title, description, columns, raw and effective state labels, filter labels, empty, no-results, clear, degraded, no-facultad) exist in `es` and `en` with identical key sets and non-empty values (EA-UI-1 "Key parity").
- [x] 4.3 GREEN `i18n/es.json` and `i18n/en.json`: `catalog.inscripciones.*`. Verify: `npx vitest run src/i18n`.
- [x] 4.4 RED `CI/inscripciones-table.test.tsx` (model: `docentes-table.test.tsx`): row shows name and CIF, asignatura code and name, period, group number, raw and effective state as TEXT (four EA-LIST-1 rows); no email, phone or request content anywhere; no `form`, button or other control in a row in S1; header sort links built with `catalogListHref`.
- [x] 4.5 RED same file: filter bar (student, asignatura, group, period select from the periods prop, status active/inactive) submits as GET and keeps the URL state; no results -> shared no-results state with a clear control; no rows in scope -> shared empty state and no table; 360 px class guard (`layout-360` style).
- [x] 4.6 GREEN `CI/inscripciones-table.tsx` (reuse the shared list frame, `EmptyState`, design-system tokens only). Verify: `npx vitest run "src/app/(dashboard)/catalog/inscripciones"`.
- [x] 4.7 Gates G + measure (~310). Open PR. Commit: `feat(enrollment): add the inscripciones list table and copy`.
  - Apply result (2026-11-19): gates G green (typecheck, focused 31/31 and i18n, full suite 8610, build OK, eslint and prettier clean on the touched files); PR NOT opened (parent owns it). Commit `a758c55` measured **1064 authored lines** (forecast ~310; 3.4x), over the 800 budget on its own. Stop rule applied: Phase 5 NOT started. See `apply-progress.md`.

## Phase 5: S1c-2 page, guards, audited load (EA-ACC-1, EA-SCOPE-1, EA-DEG-1, D10)

- [x] 5.1 Branch `feat/catalog-schedule-s1c2-page` from S1c-1 (the merge with S1c-1 was undone on 2026-11-19, see 4.1).
- [x] 5.2 RED `CI/guards.test.ts` (model: `catalog/guards.test.ts`, CS-10): exact page set is `page.tsx`; `await requireEnrollmentAccess()` is the first await of the page; no action import in any page; no mutating control (`<form`, `action=`, `ActiveToggle`) in `page.tsx`. `catalog/guards.test.ts` and `catalog-structure.test.ts` stay untouched.
- [x] 5.3 RED `CI/page.test.tsx`: denied identities table (6 rows) -> no list read, no audit; scope `none` -> no-facultad state, no read, no audit; success -> `listInscripciones` with facultad scope and parsed params, then `recordEnrollmentListRead` once with `(actorId, facultadId, payload)` AFTER the data loaded, payload booleans only and no search text; degraded -> shared `role="status"` alert, no table, no empty state, no action, no audit; a failing audit insert makes the page throw (no data shown without its row); invalid params fall back; serialized props and HTML hold no email or phone; exactly one `h1`.
- [x] 5.4 GREEN `CI/page.tsx` (server component: guard, parse, load list and periods, audit, `PageHeader`, `DegradedAlert`). Verify: `npx vitest run "src/app/(dashboard)/catalog/inscripciones"`.
- [x] 5.5 Gates G + measure (~360). Open PR (page reachable by URL only until S1c-3). Commit: `feat(enrollment): add the inscripciones page with the audited list load`.
  - Apply result (2026-11-20): gates G green (typecheck, focused 811/811, full suite 8669, build OK, eslint and prettier clean on the touched files). Commits `187818d` (49 lines, shared pagination `prefetch` opt-out) and `40b1353` (803 lines, page, guards test, page test). Measured **852 authored lines** against S1c-1 (848 added, 4 removed), over the 800 budget (forecast ~360; 2.4x). Stop rule applied: Phase 6 NOT started; the cut or `size:exception` is the owner's decision. PR NOT opened (parent owns it). See `apply-progress.md`.

## Phase 6: S1c-3 navigation, pins, docs (BS-NAV-4, BS-HOME-1, EA-UI-1)

- [x] 6.1 Branch `feat/catalog-schedule-s1c3-nav` from S1c-2.
- [x] 6.2 RED `src/lib/navigation.test.ts`: `catalogInscripciones` (`/catalog/inscripciones`) is in the `administration` group after Docentes and before Import, `visibleTo: canManageEnrollments`; entries per role table (secretaria: Dashboard, Review requests, Administration (Asignaturas, Docentes, Inscripciones, Import, Users), Settings; other four roles unchanged); `shortcutsFor("secretaria")` includes it in order; active marker only Inscripciones on `/catalog/inscripciones` and only Asignaturas on `/catalog/asignaturas`; trail Administration / Inscripciones in `es` and `en`; label differs from the student's Enrollment label; `/settings` entry untouched.
- [x] 6.3 [P] RED pins: `src/components/app-sidebar.test.tsx`, `page-context.test.tsx`, `src/app/(dashboard)/(home)/page.test.tsx`, `navigation-mock.test.tsx`, `src/i18n/catalog-parity.test.ts` (`SHORTCUT_KEYS`, `GUARDED_SECTIONS` + `nav.catalogInscripciones`, `catalog.inscripciones`) expect the new entry for secretaria only and none for the other four roles.
- [x] 6.4 GREEN `src/lib/navigation.ts`; `nav.catalogInscripciones` and `dashboard.shortcuts.catalogInscripciones` in both locale files. Verify: `npx vitest run src/lib/navigation.test.ts src/components src/i18n "src/app/(dashboard)/(home)"`.
- [x] 6.5 Docs `docs/roadmap.md` row 0 (Spanish, project convention): replace "Horarios en el catálogo" with the inscripciones maintenance scope and covered IDs (RF-12 (a)(b)(c), RF-17 (b)(d)(e); RN-21; RNF-01, RNF-02, RNF-06, RNF-12; RN-27 related); add a Notas bullet: docentes gap of RF-12 (a) and RN-22 clock-time schedules NOT covered. State stays `pendiente` until archive.
- [x] 6.6 Docs `docs/requirements.md` (Spanish): record that the enrollment surface uses `canManageEnrollments` (secretaría only) instead of `canManageCatalog`, via a changelog row and a note; RF-12, RF-17 and RN-21 rows unchanged (D8). Stage hunks only (`git add -p`): the file already carries unrelated staged edits.
- [x] 6.7 Readback: `rg -n "catalog-schedule|canManageEnrollments" docs/roadmap.md docs/requirements.md`; `git diff -- docs/requirements.md` shows no change inside the RF-12, RF-17 or RN-21 rows.
- [x] 6.8 Gates G + measure (~190). Open PR. Commits: `feat(nav): add the inscripciones entry for the secretaria`, `docs(catalog-schedule): record the scope in the roadmap and requirements`.
  - Apply result (2026-11-20): gates G green (typecheck, focused 1038/1038 for navigation, components, i18n and home; full suite 372 files, 9177 passed with no flaky failure; build OK; eslint and prettier clean on the touched files). Commits `c1fb67e` (6.9, 93 lines) and `881f486` (6.2-6.7, 255 lines; the planned two commits became the carried fix plus one feature commit with the docs inside). Measured **348 authored lines** against S1c-2 (321 added, 27 removed), under the 800 budget (forecast ~190; 1.8x). Open PR: left to the parent. See `apply-progress.md`.
- [x] 6.9 Carried fix from the PR #108 review (audit-log: the row records the period): when no period is chosen the `inscripcion.lista.consultada` payload carried `periodo: ""`. RED first in `src/lib/data/inscripciones.test.ts` (`resolvedPeriodo` on the result: the latest by default, the chosen period when it exists, the latest and never the typed text when it does not, `""` for scope `none`, no period offered and degraded) and `CI/page.test.tsx` (the payload carries `result.resolvedPeriodo`, never the URL text). GREEN: `listInscripciones` returns `InscripcionesListResult` (`CatalogListResult<InscripcionListItem> & { resolvedPeriodo }`, new in `src/lib/catalog/types.ts`) and `page.tsx` puts it in the payload. Verify: `npx vitest run src/lib/data/inscripciones.test.ts "src/app/(dashboard)/catalog/inscripciones/page.test.tsx"`. Commit: `fix(enrollment): record the resolved period in the inscripciones list read audit` (`c1fb67e`, 93 lines).

## Phase 7: S2a-1 actor-aware writer and staff drop (CS-1, CS-2, CS-3, EA-WRITE-1, EA-DEACT-1)

- [x] 7.1 Branch `feat/catalog-schedule-s2a1-writer-actor` from S1c-3. Done as the merged branch `feat/catalog-schedule-s2a-writer` (S2a-1 and S2a-2 in one branch and one PR, owner decision 2026-11-20), created from `feat/catalog-schedule-s1c3-nav`.
- [x] 7.2 Baseline: run `npx vitest run src/lib/data/enrollment-write.test.ts src/lib/data/inscripcion-writes.test.ts` green; both files stay UNTOUCHED in this slice (proof the student path is byte-identical, CS-1).
- [x] 7.3 RED new `src/lib/data/enrollment-write-staff.test.ts` (db double), lock: first statement is the one lock select with inner join `Carrera`, `Carrera.FacultadId = $facultad`, `Rol.Codigo = 'estudiante'`, `Usuario.Activo`, rendered `for no key update`; refusal table (docente, secretaria, coordinacion, administrador, inactive or cancelled estudiante, other facultad, no carrera, unknown id, scope `none`) -> `not_student`, no further statement, no audit; a stale actor that is not an active secretaria -> refused, nothing written (EA-WRITE-1; staff-only guard statement, student statement order unchanged); foreign and missing ids answer alike (EA-SCOPE-1, CS-2).
- [x] 7.4 RED same file, `staffDropGroup`: success sets `Activo=false`, one `inscripcion.desactivada` (`motivo: "baja"`) with actor `staff.actorId` and entity id = student id; works for a group of an older period and an inactive group (D9, no period filter); already inactive or foreign group -> `not_enrolled`, no audit; student drop and staff drop rows identical except the actor; payload scan: no staff id, name, CIF, email, request count (audit-log "Staff payload has ids and no names"); the `Inscripcion` row keeps `EstudianteId` = the student, never the staff user.
- [x] 7.5 RED same file, atomicity: a throwing data statement or audit insert rethrows, one `enrollment.write.failed` log line carries the STAFF actor id and no message or params, no audit reported (EA-DEG-1 "Write fails").
- [x] 7.6 GREEN `src/lib/data/enrollment-write.ts`: `EnrollmentActor` union, `writeEnrollment(actor, work)`, private `enrollWork` and `dropWork` extracted unchanged, `enrollInGroup` and `dropGroup` keep their signatures, `staffDropGroup(staff, estudianteId, grupoId)`; audit through `insertAuditEvents(tx, auditActor, events)`. Verify: `npx vitest run src/lib/data/enrollment-write.test.ts src/lib/data/enrollment-write-staff.test.ts src/lib/data/inscripcion-writes.test.ts` (old files green and unedited).
- [x] 7.7 Gates G + measure (~230). Open PR (no caller until S2b-1). Commit: `refactor(enrollment): make the enrollment writer actor-aware and add the staff drop`.
  - Apply result (2026-11-20): gates G green (typecheck, focused 49/49, full suite 373 files and 9199 passed, build OK, eslint and prettier clean on the touched files). Commit `7424eb8` measured **561 authored lines** (536 added, 25 removed; forecast ~230, 2.4x) against S1c-3. Stop rule: Phase 8 forecast ~200 at the same ratio would take the merged PR to about 1,000, over the 800 budget, so Phase 8 was NOT started; the owner decides between cutting S2a-2 back into its own PR and `size:exception`. PR NOT opened (parent owns it). See `apply-progress.md`.

## Phase 8: S2a-2 staff reactivate (EA-REACT-1, EA-WRITE-1)

- [x] 8.1 Branch `feat/catalog-schedule-s2a2-staff-enroll` from S2a-1. Not created: the owner merged S2a-1 and S2a-2 into the single branch `feat/catalog-schedule-s2a-writer` (2026-11-20); Phase 8 commits go on that branch.
- [ ] 8.2 RED `src/lib/data/enrollment-write-staff.test.ts`, S2 reactivate-only: inactive row of an offered group with no sibling -> row active, one `inscripcion.reactivada` with the staff actor; refusal table (older period, grupo inactive, asignatura inactive -> `not_eligible`; row already active -> `already_enrolled`; out-of-scope or unknown student -> `not_student`; NO existing row -> `not_eligible`, nothing inserted, create is S3) each with no audit; an active sibling found inside the transaction under the lock -> refused with nothing changed and no sibling update statement (CS-8, EA-REACT-1); no new member in `EnrollResult`, `DropResult` or `EnrollmentErrorCode` (CS-2).
- [ ] 8.3 RED same file: staff deactivation is not sticky (the student's `enrollInGroup` then reactivates the same row with one `reactivada` by the student); the lock is the first statement and audit the last for every staff write (last writer wins by serialization, EA-WRITE-1 "Race", "Not sticky").
- [ ] 8.4 RED `src/lib/data/enrollment-picker.test.ts` and `enrollment.test.ts` (additive asserts): `listMyEnrollments` and `listEligibleGroups` read only `Inscripcion.Activo` with no author or `Origen` column, so a staff change shows at once (student-enrollment "Staff change shows to the student", EA-WRITE-1 "reaches the student and the intake").
- [ ] 8.5 GREEN `enrollment-write.ts`: `staffEnrollInGroup(staff, estudianteId, grupoId)` reusing `enrollWork` behind a staff-only reactivate-only guard (existing row required, sibling refuses); S3a-2 lifts the guard. Verify: `npx vitest run src/lib/data/enrollment-write-staff.test.ts src/lib/data/enrollment-write.test.ts src/lib/data/inscripcion-writes.test.ts src/lib/data/enrollment-picker.test.ts src/lib/data/enrollment.test.ts`.
- [ ] 8.6 Gates G + measure (~200). Open PR. Commit: `feat(enrollment): add the staff reactivation without replace`.

## Phase 9: S2b-1 toggle action (EA-ACC-1, EA-SCOPE-1, CS-9)

- [ ] 9.1 Branch `feat/catalog-schedule-s2b1-actions` from S2a-2.
- [ ] 9.2 [P] RED `src/lib/validations/inscripcion.test.ts`: `staffEnrollmentInputSchema` accepts positive integer `estudianteId` and `grupoId`; rejects `0`, negatives, decimals, `NaN`, strings, `null`, missing; extra keys (`actorId`) are dropped, not carried.
- [ ] 9.3 GREEN `src/lib/validations/inscripcion.ts`. Verify: `npx vitest run src/lib/validations/inscripcion.test.ts`.
- [ ] 9.4 RED `CI/actions.test.ts`, `setInscripcionActivoAction.bind(null, estudianteId)` with `id = grupoId`: denied identities table (6 rows) -> writers never called, no revalidate; forged actor or student in the payload -> the writer gets the session actor and scope; zod refusal -> error, no write; deactivate: `ok` -> `{ kind: "done", activo: false }` and `revalidatePath("/catalog/inscripciones")` once, `not_enrolled` -> `unchanged`, `not_student` -> `gone`; reactivate: `ok` -> `done`, `already_enrolled` and `not_eligible` (incl. sibling refusal) -> error copy; thrown writer error -> `unexpected`, no revalidate; scope `none` -> `gone`, writer not called.
- [ ] 9.5 GREEN `CI/actions.ts` (`"use server"`, async exports only; first statement `await requireEnrollmentAccess()`, then zod, then the staff writer). Verify: `npx vitest run "src/app/(dashboard)/catalog/inscripciones/actions.test.ts"`.
- [ ] 9.6 RED `CI/guards.test.ts` additions: `actions.ts` guard runs before any form or payload read, exports only async functions, never imports `requireCatalogAccess`; the writer allowlist test still passes.
- [ ] 9.7 RED then GREEN `catalog.inscripciones.errors.*` (gone, unchanged, not_eligible, already_enrolled, unexpected) in `es` and `en` with parity pin. Verify: `npx vitest run src/i18n "src/app/(dashboard)/catalog/inscripciones/guards.test.ts"`.
- [ ] 9.8 Gates G + measure (~330). Open PR. Commit: `feat(enrollment): add the staff toggle server action`.

## Phase 10: S2b-2 row toggle and deactivation notice (EA-DEACT-1, EA-REACT-1, RNF-12, RN-27)

- [ ] 10.1 Branch `feat/catalog-schedule-s2b2-toggle` from S2b-1.
- [ ] 10.2 RED `CI/inscripciones-table.test.tsx`: a raw-active row of ANY period offers the existing `ActiveToggle` (reused unchanged) bound to `setInscripcionActivoAction.bind(null, estudianteId)`, `id = grupoId` (D9); dialog notice states the count of non-draft requests ("N submitted requests use this group; they do not change", singular and plural, N from the EA-DEACT-1 table) and always carries the fixed RN-27 sentence (retention effect if this is the last active inscription, nothing cancelled automatically); count 0 -> no mention of requests and no word `borrador` or draft anywhere in the DOM; cancel changes nothing and calls no action.
- [ ] 10.3 RED same file: reactivate control only when raw inactive AND offered group AND no active sibling, otherwise absent (no dead control, EA-REACT-1); single press, no dialog; `gone`, `unchanged` and error states render; a degraded read renders no toggle (page test).
- [ ] 10.4 GREEN `CI/inscripciones-table.tsx` wiring, notice and confirm copy (ICU plural) in `es` and `en` with parity pin. Verify: `npx vitest run "src/app/(dashboard)/catalog/inscripciones" src/i18n`.
- [ ] 10.5 Gates G + measure (~270). Open PR. Commit: `feat(enrollment): add the confirmed deactivation and reactivation to the list`.

## Phase 11: S3a-1 student search and assign reads (EA-CRE-1, EA-PII-1, D10)

- [ ] 11.1 Branch `feat/catalog-schedule-s3a1-reads` from S2b-2.
- [ ] 11.2 RED `src/lib/data/inscripciones.test.ts`, `searchStudents(scope, q)`: only in-scope ACTIVE estudiantes (excluded: other facultad, no carrera, non-active or cancelled account, other roles); match by name or CIF (`containsPattern`); capped by a named constant; rows are `{ id, nombreCompleto, cif }` only, serialized scan finds no email or phone; scope `none` -> `[]`, no query; failure -> `{ data: [], degraded: true }`.
- [ ] 11.3 RED same file, `loadAssignPage(scope, estudianteId, asignaturaId | null)`: student not in scope or unknown -> `not_found` (alike for both); asignaturas via `listEnrollableAsignaturas`, groups via `listEnrollableGroups` (latest period, offered only; docente name only); the student's current active group of that asignatura and period is marked and its sibling is named; invalid or ineligible asignatura -> no groups; failure fail-soft `degraded: true`.
- [ ] 11.4 GREEN `src/lib/data/inscripciones.ts`: `searchStudents`, `loadAssignPage` (uses `studentRowInScope`). Verify: `npx vitest run src/lib/data/inscripciones.test.ts`.
- [ ] 11.5 RED `src/lib/data/request-reads.test.ts`: `recordEnrollmentStudentSearch(actorId, facultadId, payload)` inserts exactly one `inscripcion.estudiantes.consultada`, entity `Facultad`; a failing insert rejects; cached per render.
- [ ] 11.6 GREEN `src/lib/data/request-reads.ts`: `recordEnrollmentStudentSearch`. Verify: `npx vitest run src/lib/data/request-reads.test.ts`.
- [ ] 11.7 Gates G + measure (~355). Open PR. Commit: `feat(enrollment): add the scoped student search and assign reads`.

## Phase 12: S3a-2 staff replace and create (EA-SIB-1, EA-CHG-1, EA-CRE-1, EA-WRITE-1)

- [ ] 12.1 Branch `feat/catalog-schedule-s3a2-writer-replace` from S3a-1.
- [ ] 12.2 RED `src/lib/data/enrollment-write-staff.test.ts`, create table (EA-CRE-1): no row -> created active, one `inscripcion.creada`; inactive row -> `reactivada`; already active -> `already_enrolled`, no audit; not an offered group -> `not_eligible`; target not an active estudiante or cancelled -> `not_student`; at most one row for the pair, role integrity binds the student never the actor.
- [ ] 12.3 RED same file, replace and change group: sibling deactivation `update` scoped to the same asignatura and period, `GrupoId <>` target, `returning`; other asignaturas and other periods are not in its predicate; audit rows `desactivada` (`motivo: "reemplazo"`) then `creada` or `reactivada`, staff actor, written last on the same `tx`; change to the current group -> `already_enrolled`; target of another asignatura, older period, inactive grupo or asignatura -> `not_eligible`; out-of-scope -> `not_student`; an audit insert failing on the second row rolls back both (previous group still active); the 8.2 sibling-refusal assertion is replaced by "reactivate with a sibling replaces it".
- [ ] 12.4 GREEN `enrollment-write.ts`: lift the S2 reactivate-only guard so `staffEnrollInGroup` runs the full `enrollWork`. Verify: `npx vitest run src/lib/data/enrollment-write-staff.test.ts src/lib/data/enrollment-write.test.ts src/lib/data/inscripcion-writes.test.ts`.
- [ ] 12.5 Gates G + measure (~170). Open PR. Commit: `feat(enrollment): let the staff create, change group and replace`.

## Phase 13: S3a-3 assign action (EA-CHG-1, EA-CRE-1, EA-SCOPE-1, CS-9)

- [ ] 13.1 Branch `feat/catalog-schedule-s3a3-assign-action` from S3a-2.
- [ ] 13.2 RED `CI/actions.test.ts`, `assignInscripcionAction(estudianteId, grupoId)`: denied identities table (6 rows) -> no write, no revalidate; forged actor or student ignored; zod refusal; created, reactivated and replaced -> success and `revalidatePath("/catalog/inscripciones")` once; `already_enrolled` and `not_eligible` -> error copy; `not_student` -> `gone`; thrown -> `unexpected`; out-of-scope table (change group, create) -> refused, no audit.
- [ ] 13.3 GREEN `CI/actions.ts`: `assignInscripcionAction` (guard first, then zod, then `staffEnrollInGroup`). Verify: `npx vitest run "src/app/(dashboard)/catalog/inscripciones/actions.test.ts" "src/app/(dashboard)/catalog/inscripciones/guards.test.ts"`.
- [ ] 13.4 RED then GREEN: `CI/guards.test.ts` still passes with the second action; error keys for the assign outcomes added to `catalog.inscripciones.errors.*` in both locales with parity pin.
- [ ] 13.5 Gates G + measure (~270). Open PR. Commit: `feat(enrollment): add the staff assign server action`.

## Phase 14: S3b-1 assign page, audited search, list links (EA-CRE-1, EA-CHG-1, EA-SIB-1, D10)

- [ ] 14.1 Branch `feat/catalog-schedule-s3b1-assign-page` from S3a-3.
- [ ] 14.2 RED `CI/guards.test.ts`: page set is exactly `page.tsx` and `assign/page.tsx`; each has `await requireEnrollmentAccess()` as first await; no page imports an action; no mutating control in either `page.tsx`.
- [ ] 14.3 RED `CI/assign/page.test.tsx`: denied identities table -> no read, no audit; scope `none` -> no-facultad state; `?estudiante=` invalid, `0`, negative, out-of-scope or unknown -> `notFound()`, no group read, no audit; `?q=` -> `searchStudents`, then `recordEnrollmentStudentSearch` once AFTER results, never when degraded or when no `q`, failing insert throws; results show name and CIF only; with a student: asignatura picker (own carrera first), latest-period offered groups only, current group marked; one `h1`; degraded alert in place of content; serialized props hold no email or phone.
- [ ] 14.4 GREEN `CI/assign/page.tsx` (server) and its copy keys in both locales with parity pin. Verify: `npx vitest run "src/app/(dashboard)/catalog/inscripciones" src/i18n`.
- [ ] 14.5 RED `CI/inscripciones-table.test.tsx` and `src/lib/navigation.test.ts`: an active row of an offered group links to `assign?estudiante=&asignatura=` (change group); a row whose group is not offered shows no change link (EA-CHG-1); an inactive offered row WITH an active sibling shows a replace link to the same page (the S2 hidden reactivation, EA-SIB-1 reached through the assign confirm); a "create" link in the header; Inscripciones stays the active entry and the trail resolves on `/catalog/inscripciones/assign`.
- [ ] 14.6 GREEN table links, copy and any trail entry. Verify: same command plus `npx vitest run src/lib/navigation.test.ts src/components`.
- [ ] 14.7 Gates G + measure (~330; cut point: 14.5-14.6 move to a follow-up PR). Open PR (assign page is read-only until S3b-2). Commit: `feat(enrollment): add the assign page with the audited student search`.

## Phase 15: S3b-2 assign form with confirmation (EA-SIB-1, EA-CHG-1, EA-CRE-1, RNF-12, RNF-11)

- [ ] 15.1 Branch `feat/catalog-schedule-s3b2-assign-form` from S3b-1.
- [ ] 15.2 RED `CI/assign/assign-form.test.tsx`: current group is marked and cannot be submitted; a group with no sibling -> confirm step names student, asignatura and group; with a sibling -> the same plus the REPLACED group; cancel calls nothing and writes nothing; confirm calls `assignInscripcionAction` once with `(estudianteId, grupoId)` only; success -> message and link back to the list; error and `gone` states render and the form stays usable; submit disabled while pending; controls at least 44 px; 360 px class guard.
- [ ] 15.3 GREEN `CI/assign/assign-form.tsx` (client; reuse `AlertDialog` and the enrollment confirm frame if exported, else a local frame; tokens per `docs/design-system.md`) wired into `assign/page.tsx`, with its copy in both locales and parity pin. Verify: `npx vitest run "src/app/(dashboard)/catalog/inscripciones/assign" src/i18n`.
- [ ] 15.4 Gates G on the full tree (`npm test`, `npm run build`) + measure (~370; cut point: copy and 360 px guard to a follow-up). Open PR. Commit: `feat(enrollment): add the confirmed create and change group form`.

## Phase 16: Owner manual walk (the list load and every search write audit rows, so ALL DB steps are `[USER][CONFIRM]`)

- [ ] 16.1 `[USER][CONFIRM]` Create a disposable Neon branch and point the local dev server at it (never production). Check the `DATABASE_URL` host is the walk branch before starting (the student-enrollment walk wrote to production through a stale `.env`); the owner edits `.env`, the agent never does.
- [ ] 16.2 `[USER][CONFIRM]` Practice accounts on the walk branch: two secretarias (two facultades), students in both, one cancelled student, one docente; no seeding without an explicit yes.
- [ ] 16.3 `[USER][CONFIRM]` W1 (after S1c-3), `es` and `en`, 360 px and desktop, keyboard: list shows only her facultad with name and CIF; filters; four state labels; other roles denied; sidebar and home entry per role.
- [ ] 16.4 `[USER][CONFIRM]` W2 (after S2b-2): deactivate with the count dialog (a draft is not counted), cancel, last-active sentence, reactivate, student `/enrollment` and intake step 2 reflect it.
- [ ] 16.5 `[USER][CONFIRM]` W3 (after S3b-2): change group (dialog names the replaced group), create, search, out-of-scope direct URL -> not found, student `/enrollment` shows the result.
- [ ] 16.6 `[USER][CONFIRM]` `[READ-ONLY]` query on the walk branch: each staff write has one `inscripcion.*` row with the staff actor and the student id as entity; one `inscripcion.lista.consultada` per list load and one `inscripcion.estudiantes.consultada` per search, entity `Facultad`, payload without search text, ids or names; none for refused or cancelled operations.
- [ ] 16.7 `[USER][CONFIRM]` Delete the walk branch; record every result and date here.

## Phase 17: Closeout (after Phase 16)

- [ ] 17.1 After the last slice merges into `main`, re-run `npm test`, typecheck, lint and `npm run build` on `main` and record the result (student-enrollment left this open).
- [ ] 17.2 `sdd-verify`: every scenario of the five spec deltas mapped to a test or the walk record.
- [ ] 17.3 `sdd-archive` spec sync: merge the deltas into `openspec/specs/{student-enrollment,academic-catalog,audit-log,backoffice-shell}/spec.md` and create `openspec/specs/enrollment-administration/spec.md`; update the student-enrollment Purpose sentence ("staff view or editing" out of scope); readback in `archive-report.md`.
- [ ] 17.4 `docs/roadmap.md` row 0 state to `archivado`; keep the note on the docentes gap and RN-22.
- [ ] 17.5 Archive to `openspec/changes/archive/<date>-catalog-schedule/` with `git mv` and an `archive-report.md`.
- [ ] 17.6 `[USER]` Merge order: each slice PR into `main` in chain order, retargeting the next PR onto `main` after each merge; delete merged slice branches and `feat/catalog-schedule`.
