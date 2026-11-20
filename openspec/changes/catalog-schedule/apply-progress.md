# Apply progress: catalog-schedule

Mode: Strict TDD (vitest). Artifact store: openspec. Chain strategy: stacked-to-main.

## Batch 1: S1a scope (tasks 0.1, 0.3, 1.1-1.9; 1.10 partial)

Branch `feat/catalog-schedule-s1a-scope`, created from `main`. Date: 2026-11-19.

### Completed tasks

- [x] 0.1 planning commit `d859249` (already on the branch)
- [x] 0.2 chain strategy (owner decision, earlier)
- [x] 0.3 Next 16 guides read (see "Task 0.3 notes")
- [x] 1.1 branch
- [x] 1.2 RED, 1.3 GREEN: `canManageEnrollments`
- [x] 1.4 RED, 1.5 GREEN: `requireEnrollmentAccess`
- [x] 1.6 RED, 1.7 GREEN: `enrollmentInScope`, `studentRowInScope`
- [x] 1.8 RED, 1.9 GREEN: inscripciones list params
- [ ] 1.10 gates and measure done, PR not opened (parent owns PRs); budget exceeded, see "Measured size and cut"

Nothing from S1b or later was started.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.3 | `src/lib/auth/permissions.test.ts` | Unit | 209/209 (permissions 149, scope SQL 9, list params 51) | 8 new tests failed (`rolesQueGestionanInscripciones`/`canManageEnrollments` undefined) | 157/157 in file | secretaria true; 4 roles + `undefined` false; catalog predicate still true for administrador and coordinacion | Clean (shape copied from `rolesRevisores`) |
| 1.4/1.5 | `src/lib/auth/enrollment-access.test.ts` (new) | Unit (mocked `requireRole`, `resolveRequestScope`) | N/A (new) | Suite failed to load: `@/lib/auth/enrollment-access` unresolved | 18/18 | six-identity redirect table with no scope read; facultad scope; scope `none`; two calls read twice (no cache); throw propagates; 7 invalid `sub` values | Clean |
| 1.6/1.7 | `src/lib/data/request-scope-sql.test.ts` | Unit (`PgDialect` render via `QueryBuilder`) | 9 existing tests green first (the `requestInScope`/`requestRowInScope` assertions untouched) | 10 new tests failed (`enrollmentInScope is not a function`) | 19/19 | 2 builders x (render, other facultad id bound, inner join, `none` -> `false`, unknown kind throws) | Extracted private `studentOfFacultad(column, facultadId)`; `requestInScope` rendered SQL unchanged (its tests pass untouched) |
| 1.8/1.9 | `src/lib/catalog/list-params.test.ts` | Unit + compile-time pins | 51 existing tests green first | Whole file failed to load (`INSCRIPCIONES_SORT_KEYS` undefined) | 74/74 | defaults, full parse, bad status (`all`, unknown, case, array), bad sort keys, each sort key, oversize and repeated filters, href defaults, canonical order, round-trip, no page on filter links, other bases unchanged, two `@ts-expect-error` pins | Typecheck error found and fixed (`DEFAULT_STATUS` typed as the catalog union; separate `DEFAULT_INSCRIPCION_STATUS`) |

Test summary: 4 files touched or added, 268 tests passing across them (59 new: 8 + 18 + 10 + 23). Layers: unit only. Pure functions added: `parseInscripcionesListParams`, `canManageEnrollments`, three scope builders.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/auth/permissions.test.ts src/lib/auth/enrollment-access.test.ts src/lib/data/request-scope-sql.test.ts src/lib/catalog/list-params.test.ts` -> 4 files, 268 tests passed |
| Runtime harness | N/A: DB double / pure SQL render; nothing calls the new functions yet |
| Rollback boundary | Revert commits `08d0ba1`, `f860476`, `c776de8` (additive; `requestInScope` behaviour unchanged) |

### Gates G (2026-11-19)

| Gate | Result |
|---|---|
| `npx next typegen && npm run typecheck` | clean (after fixing one error found by typecheck) |
| focused vitest | 268/268 |
| `npm test` (full suite) | 8511 passed |
| `npm run build` (dummy `DATABASE_URL`, dummy 32-char `AUTH_SECRET`) | OK |
| `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]" src` | 0 findings in files of this slice. Pre-existing and not touched here: 2 prettier errors in `src/test/access/inventory.ts` (from `776626e`, quote style) and 1 unused-import warning in `src/components/app-sidebar.tsx` |
| `npx prettier --check --end-of-line auto src i18n` | 1 file flagged, `src/test/access/inventory.ts` (pre-existing, same cause) |

### Measured size and cut

`git diff --shortstat main...HEAD -- . ':!openspec' ':!.engram'` -> 9 files changed, 609 insertions, 23 deletions = **632 changed lines**, over the 400 budget (forecast ~380; student-enrollment ratio was 1.9x so tests dominate). Per commit:

| Commit | Content | Changed lines |
|---|---|---|
| `c776de8` feat(auth): add the enrollment management predicate and guard | 1.2-1.5 | 189 |
| `f860476` feat(enrollment): add the enrollment scope SQL | 1.6-1.7 | 174 |
| `08d0ba1` feat(catalog): add the inscripciones list params | 1.8-1.9 | 269 |

Stop rule applies. The measurement was taken at task 1.10, after the three commits existed; the history was not rewritten. Suggested cut with no rewrite needed: PR A = `c776de8` + `f860476` (363 lines), PR B = `08d0ba1` (269 lines, stacked on A). This differs slightly from the tasks.md cut point (1.6-1.9 together would be 443 lines, still over): the scope SQL stays with the guard. Later slices that depend on list params (S1b-2, S1c-1) only need PR B.

### Task 0.3 notes (Next 16 docs, read-only)

- `searchParams` in a page is a `Promise`: `await searchParams` (`file-conventions/page.md`); params are parsed with the pure `parseInscripcionesListParams`.
- `bind` arguments in `forms.md` are client-visible: S2b actions re-validate `estudianteId` with zod and the scope (already in CS-8, CS-9).
- `notFound()` throws and must be called in the render path (a component or a function it `await`s), never from an un-awaited promise (`functions/not-found.md`); relevant to S3b-1.
- `revalidatePath(path)` is for Server Functions and Route Handlers only, never client components or proxy; in a Server Function it refreshes the viewed path immediately (`functions/revalidatePath.md`).
- `use server` files export async functions only; authenticate and authorize inside each action, read identity from the session, never from parameters (`directives/use-server.md`, "Security considerations").

### Deviations and decisions for later slices

1. `requireEnrollmentAccess` reads the scope through the existing `resolveRequestScope(userId, rol)` (`src/lib/data/request-scope.ts`: database read of `Usuario.FacultadId` on every call, then `requestScopeFor`) instead of a new reader. Same behaviour as CS-4, no duplicated query; the test mocks that module. Its return type is `EnrollmentAccess = { session, actorId, scope: RequestScope }`.
2. `InscripcionesListState.periodo` is a string where `""` means unset (latest period); the data layer (S1b-2) resolves it with `getLatestPeriod()` and falls back for unknown values. `status` is `InscripcionStatusFilter = "active" | "inactive"` (new type in `src/lib/catalog/types.ts`); `all` falls back to `active`.
3. `catalogListHref` is typed per base: `periodo`, `asignatura`, `grupo` and `status` of the inscripciones base are only accepted for `/catalog/inscripciones` (compile-time pins in the test). URL order: `q`, `asignatura`, `grupo`, `periodo`, `status`, `sort`, `dir`, `size`, `page`. Filter caps: asignatura 100, grupo 12, periodo 12 (the `Grupo` column lengths).
4. No design change needed. The forecast of ~380 lines was too low (measured 632).

### Remaining tasks

Phase 1.10 (open the PR(s) after the cut decision) and Phases 2-17 (S1b-1 onward).

## Batch 2: S1b-1 audited read plumbing (tasks 2.1-2.8)

Branch `feat/catalog-schedule-s1b1-audit-reads`, created from `feat/catalog-schedule-s1a2-list-params`. Date: 2026-11-19. Single commit `367d79e` `feat(audit): add the audited read of the inscripciones list`.

### Completed tasks

- [x] 2.1 branch
- [x] 2.2 RED, 2.3 GREEN: `AUDIT_ACTIONS` gains `inscripcion.lista.consultada` and `inscripcion.estudiantes.consultada`; payload type `InscripcionReadPayload`
- [x] 2.4 RED, 2.5 GREEN: `inscripcionListaConsultadaEvent`, `inscripcionEstudiantesConsultadaEvent`
- [x] 2.6 RED, 2.7 GREEN: `recordEnrollmentListRead`
- [x] 2.8 gates and measure done; PR NOT opened (parent owns PRs)

Nothing from Phase 3 or later was started. `recordEnrollmentStudentSearch` stays in S3a-1 (task 11.6).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.2/2.3 | `src/lib/audit/types.test.ts` | Unit | 3 files, 136 tests green before (audit + request-reads) | Expected-set test and 2 new tests failed (two actions missing) | pass | exact sorted set with the two new codes; write set filter equals the three `creada/reactivada/desactivada`; read set equals the two new codes in order; `slice(0, 3)` pin untouched | Clean |
| 2.4/2.5 | `src/lib/audit/events.test.ts` | Unit | existing tests green | 8 new tests failed (builders undefined) | pass | 2 builders x (entity `Facultad` and `entidadId`, exact payload keys with booleans, smuggled search text, student id, name, CIF, group id, request count and string filters leave no trace and filters coerce to `false`, no email or credential key) | Shared private `inscripcionReadPayload` rebuilds the payload key by key; `=== true` keeps a string out of the booleans |
| 2.6/2.7 | `src/lib/data/request-reads.test.ts` | Unit (`createDbDouble`, mocked `insertAuditEvents`, `cache` fake) | existing tests green; cache-count pin moved 3 -> 4 | 5 new tests failed (`recordEnrollmentListRead is not a function`) | pass | one transaction, staff actor, entity `Facultad`; payload keys; same args twice -> 1 write, other facultad or actor -> writes again; failing insert rejects | Clean |

Totals: 3 test files touched, 151 tests passing in the focused run (15 new: 3 + 8 + 4, plus the cache-count assertion changed). Layers: unit only.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/audit src/lib/data/request-reads.test.ts` -> 4 files, 151 tests passed (RED run before the code: 3 files failed, 15 tests failed) |
| Runtime harness | N/A: DB double; nothing calls `recordEnrollmentListRead` until S1c-2 |
| Rollback boundary | Revert `367d79e` (additive; no existing builder or action changed) |

### Gates G (2026-11-19)

| Gate | Result |
|---|---|
| `npx next typegen && npm run typecheck` | clean |
| focused vitest | 151/151 |
| `npm test` (full suite) | 357 files, 8525 passed (8511 + 14 new) |
| `npm run build` (dummy `DATABASE_URL`, dummy 32-char `AUTH_SECRET`) | OK |
| `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]"` on the touched files | 0 findings |
| `npx prettier --check --end-of-line auto` on the touched files | clean (prettier reformatted `types.ts` and `events.test.ts`, which were then committed) |

### Measured size

`git diff --shortstat feat/catalog-schedule-s1a2-list-params...HEAD -- . ':!openspec' ':!.engram'` -> 6 files changed, 295 insertions, 2 deletions = **297 changed lines** (forecast ~210; 1.4x). Under the 400 budget; single commit, no cut needed.

### Decisions and notes for later slices

1. Both builders share one payload type `InscripcionReadPayload` exported from `src/lib/audit/types.ts` (task 2.3 names a single payload shape), and a private `inscripcionReadPayload` helper rebuilds it. For the student search (S3a-1) `periodo`, `status`, `page` and `total` still apply: the assign page passes the period and status it used and the page of results.
2. `recordEnrollmentListRead(actorId, facultadId, payload)` takes the payload as an object. `react` `cache()` dedupes by reference for objects, so the page (S1c-2) builds the payload once per render. Because the page calls it once, the dedupe is only a guard.
3. The payload `filters` are rebuilt with `=== true`: a string passed through a cast becomes `false`, never a leak.
4. `src/lib/audit/types.ts` now imports the type `InscripcionStatusFilter` from `@/lib/catalog/types` (type-only; no cycle at runtime).
5. No design change needed.

### Remaining tasks

Phases 3-17 (S1b-2 onward). PR for S1b-1 to be opened by the parent against `feat/catalog-schedule-s1a2-list-params`.

## Batch 3: S1b-2 list read (tasks 3.1-3.11, complete)

Branch `feat/catalog-schedule-s1b2-list-read`, created from `feat/catalog-schedule-s1b1-audit-reads`. Date: 2026-11-19. Commits `cb7f2ee` `feat(enrollment): add the scoped inscripciones list read` (3.1-3.5), `28742bc` `feat(enrollment): add the sibling flag, request count and periods to the inscripciones read` (3.6-3.9) and a docs commit for 3.10 and these artifacts. The first pass stopped after `cb7f2ee` at 636 lines; the owner then raised `review_budget_lines` to 800 (see "Budget change") and the slice was finished.

### Completed tasks

- [x] 3.1 branch
- [x] 3.2 RED, 3.3 GREEN: `listInscripciones` core and `InscripcionListItem`
- [x] 3.4 RED, 3.5 GREEN: filters, sort, paging
- [x] 3.6 RED, 3.7 GREEN: `hasActiveSibling` and `dependentRequests` columns
- [x] 3.8 RED, 3.9 GREEN: `listInscripcionPeriods`
- [x] 3.10 `design.md` CS-6 reconciled (status on the RAW state, `writable` = offered group, sibling = raw-active row)
- [x] 3.11 gates and measure done; PR NOT opened (parent owns PRs)

Nothing from Phase 4 was started.

### Budget change (owner, 2026-11-19)

`review_budget_lines` is now **800** for all remaining slices (was 400). Recorded in the tasks.md Review Workload Forecast block. The whole S1b-2 slice ships as ONE PR when its authored diff is at or under 800; it measured 799 (below).

### First pass: commit 1 alone was over the old 400-line budget

`git diff --shortstat feat/catalog-schedule-s1b1-audit-reads...HEAD -- . ':!openspec' ':!.engram'` -> 4 files changed, 636 insertions, 0 deletions = **636 changed lines** (forecast ~380 for the whole slice). Per file: `inscripciones.test.ts` 410, `inscripciones.ts` 198, `types.ts` 21, `db-double.ts` 7. Instruction: stop and report, so tasks 3.6-3.9 were not started. Rough split of the 636 by task group (estimate from line positions, not measured per commit): core 3.2-3.3 about 365, filters/sort/paging 3.4-3.5 about 270.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.2/3.3 | `src/lib/data/inscripciones.test.ts` (new) | Unit (`createDbDouble`, `PgDialect` render) | 7 files, 200/200 green first (catalog, enrollment-picker, request-scope-sql) | Suite failed to load: `@/lib/data/inscripciones` unresolved | 19/19 | scope `none` (no statement) vs facultad 3 and 9 (id bound in count and page); no latest period -> empty; four EA-LIST-1 state rows -> raw, effective, writable; five `writable` cases (offered, inactive inscripcion of offered group, older period, inactive group, inactive asignatura); smuggled `correo`/`telefono` never reach the JSON; selection holds name and CIF, not email or phone; failure at each of the three statements -> degraded | `effective` and `writable` share one `offered` term |
| 3.4/3.5 | same file | Unit | 19/19 | 19 of 39 tests failed (filters, order, paging not implemented) | 39/39 | each filter alone and combined; LIKE wildcards escaped; raw state `inactive` never reads `Grupo.Activo`; existing vs unknown period (fallback, extra `Grupo` lookup only when the period is not the latest); default order and each sort key and direction, unknown key falls back; page clamp (1, 2, 9 of 25, 0, empty) with limit and offset | Order helper appends the `grupoId` tie-break in the direction of the chosen key; `where` shared by count and page |

| 3.6/3.7 | same file | Unit (`createDbDouble`, `PgDialect` render of the selected column fragments) | 39/39 | 13 failed (the 4 existing state rows now expect the two new keys; 9 new tests: `selection.hasActiveSibling` and `selection.dependentRequests` undefined) | 48/48 | flag and count carried for `true/2` and `false/0`; sibling SQL: same student, raw `Activo`, `<>` own group, same asignatura, same period (aliased `sib`, `sibg`); count SQL: this group, this student, `count(*)`; bound params equal `VISIBLE_STATES` exactly, no `borrador` in SQL or params; EA-DEACT-1 table (2, 2, 0, 1) derived from the bound params | Aliases and the two fragments are module constants; the `from` clause names the table before its alias (an aliased table alone renders only the alias in a `sql` template) |
| 3.8/3.9 | same file | Unit | 48/48 | 3 failed (`listInscripcionPeriods is not a function`) | 51/51 | in-scope read (facultad 9 bound, `Grupo.Periodo desc`, rows to strings); scope `none` -> `[]` with no statement; failing read -> `[]` without throwing | Clean |

Total: 51 tests in the new file (39 + 12), all passing; 62 with `enrollment-picker.test.ts`. Layer: unit only. Pure helpers added: `buildInscripcionesWhere`, `inscripcionesOrderBy`. Final trim: after prettier the slice was 806 lines, so repeated `toContain` calls became loops over non-empty fragment arrays and three doc comments were shortened (commit 2 amended before any push).

Commit 1 gates (first pass): focused vitest 50 passed; typecheck clean (after typing `params` as `ListInscripcionesParams`); eslint 0 findings after renaming the test helper `use` to `scripted` (`react-hooks/rules-of-hooks` flags a `use*` function called from a named helper); prettier clean.

### Decisions and notes

1. `InscripcionListItem` (in `src/lib/catalog/types.ts`) has `estudianteCif: string | null` (`Usuario.Cif` is nullable); it carries no email or phone. `hasActiveSibling` and `dependentRequests` are NOT in the type yet; tasks 3.6-3.9 add them.
2. The data layer selects the raw `Grupo.Activo` and `Asignatura.Activo` internally and derives `effective` and `writable` in the mapper; the two raw flags never leave it. `writable` is independent of the raw state of the inscripcion (a reactivation target must be offered, so an inactive row of an offered group is writable).
3. Period resolution: `getLatestPeriod()` (reused from `enrollment-picker.ts`, same db), and for an explicit period other than the latest one extra `select 1 from Grupo where Periodo = ? limit 1`; unknown -> latest. No latest period -> empty page, not degraded.
4. `src/lib/data/test-support/db-double.ts` now also logs `offset` (7 lines), so the page tests can assert it. No existing test used `offset` through the double.
5. Sort keys: `student` and `subject` use the collated name (`es-x-icu`), `group` the plain number; the total order ends with `(estudianteId, grupoId)` in the direction of the chosen key.
6. Not a deviation from design CS-6 except the three points task 3.10 reconciles (`status` on the RAW state, `writable` = offered group, sibling = raw-active row).
7. Sibling: task 3.6 and CS-6 said "another effective row"; the spec term (terms table of the spec) and `enrollInGroup` (`enrollment-write.ts`, which deactivates every raw-active sibling) use raw `Activo` true with no group or asignatura condition. The list follows the spec and the writer so the offered reactivate control never disagrees with the server refusal. CS-6 and task 3.6 were corrected.
8. `hasActiveSibling` and `dependentRequests` are correlated subqueries of the PAGE select only (at most `pageSize` rows), not of the count. `dependentRequests` uses `.mapWith(Number)` (pg `count(*)` is a bigint string), like the existing total.
9. `listInscripcionPeriods(scope)` lists the periods of in-scope rows of any status (a period with only inactive rows is still selectable), via `selectDistinct`; it lives in the same file and is fail-soft (`[]`).
10. The two `InscripcionListItem` field doc comments were dropped to fit the budget; the type header comment still describes the states, and the fields are named by the spec terms.

### Gates G (2026-11-19, S1b-2 complete)

| Gate | Result |
|---|---|
| `npx vitest run src/lib/data/inscripciones.test.ts src/lib/data/enrollment-picker.test.ts` | 2 files, 62 passed |
| `npx next typegen && npm run typecheck` | clean |
| `npm test` (full suite) | 358 files, 8576 passed |
| `npm run build` (dummy `DATABASE_URL`, dummy 32-char `AUTH_SECRET`, inline env) | OK |
| `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]" src` | 0 findings in the slice files. Same 3 pre-existing items as S1a (2 prettier errors in `src/test/access/inventory.ts`, 1 unused-import warning in `src/components/app-sidebar.tsx`), untouched |
| `npx prettier --check --end-of-line auto` on the touched files | clean |

### Work Unit Evidence (S1b-2)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/data/inscripciones.test.ts src/lib/data/enrollment-picker.test.ts` -> 2 files, 62 passed (RED runs: 13 failed after 3.6, 3 failed after 3.8) |
| Runtime harness | N/A: DB double; the SQL fragments are rendered with `PgDialect` and nothing calls `listInscripciones` until S1c-2 |
| Rollback boundary | Revert `28742bc` (sibling, count, periods) and `cb7f2ee` (list read); both additive, `inscripciones.ts` is a new file and `types.ts` only gained the type |

### Measured size

`git diff --shortstat feat/catalog-schedule-s1b1-audit-reads...HEAD -- . ':!openspec' ':!.engram'` -> 4 files changed, 799 insertions(+) = **799 changed lines**, under the 800 budget (forecast ~380; the first pass measured 636 after commit 1). Per commit: `cb7f2ee` 636, `28742bc` 167 (165 insertions, 2 deletions of `cb7f2ee` lines). Margin: 1 line, so any later edit to this slice needs a matching trim. One PR; the docs commit is openspec only.

### Remaining tasks

Phases 4-17 (S1c-1 onward). PR for S1b-2 to be opened by the parent against `feat/catalog-schedule-s1b1-audit-reads`.
