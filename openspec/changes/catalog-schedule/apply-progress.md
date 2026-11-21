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

## Batch 4: S1c-1 list table and copy (tasks 4.1-4.7; Phase 5 NOT started)

Branch `feat/catalog-schedule-s1c-list-page` (S1c-1 and S1c-2 merged into one PR by the owner, 2026-11-19), created from `feat/catalog-schedule-s1b2-list-read`. Commit `a758c55` `feat(enrollment): add the inscripciones list table and copy`. The batch stopped at this commit boundary: the commit alone measured 1064 lines, over the 800 budget, so Phase 5 (page, guards test, audited load) was not started.

### Completed tasks

- [x] 4.1 branch (satisfied by the merged branch; 5.1 is satisfied by it too)
- [x] 4.2 RED, 4.3 GREEN: `catalog.inscripciones` added to `GUARDED_SECTIONS`; keys in `es` and `en`
- [x] 4.4 RED, 4.5 RED, 4.6 GREEN: `InscripcionesTable` with the filter bar
- [x] 4.7 gates and measure done; PR NOT opened (parent owns PRs)

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.2/4.3 | `src/i18n/catalog-parity.test.ts` | Unit (structural) | 230/230 first | 2 failed (`catalog.inscripciones` exists, non-empty) | 384/384 in `src/i18n` | key-set test shared by every guarded section; component tests render with throwing `onError`, so a missing key fails there too | Clean |
| 4.4-4.6 | `src/app/(dashboard)/catalog/inscripciones/inscripciones-table.test.tsx` (new) | Integration (Testing Library, real catalogs, navigation mock) | N/A (new) | Suite failed to load (`inscripciones-table` unresolved) | 31/31 | four EA-LIST-1 state rows (active+effective, active+not effective, inactive, no CIF); each sort key and direction, filters and size kept on sort; read-only rows; leaky row (`correo`, `telefono`, `dependentRequests`, `hasActiveSibling`, `writable`) never in HTML; filter bar from URL state, option lists, GET fallback with hidden sort and size, submit of all five filters, empty submit, count, footer links, empty and no-results (term, four filter-only cases, Spanish), 360 px guard with its own self-test | Removed an unused helper and import found before the first run; prettier reformat |

Totals: 2 test files touched, 31 new component tests plus 2 new parity tests (the third parity case passes in both states). Layers: unit and integration, no E2E.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run "src/app/(dashboard)/catalog/inscripciones" src/i18n` -> 10 files, 415 passed (RED runs: parity 2 failed; table suite failed to load) |
| Runtime harness | N/A: client component rendered by Testing Library; the page and the audited load arrive in Phase 5 |
| Rollback boundary | Revert `a758c55` (new table and its test, two locale blocks, one parity line); additive |

### Gates G (2026-11-19)

| Gate | Result |
|---|---|
| `npx next typegen && npm run typecheck` | clean |
| `npm test` (full suite) | 359 files, 8610 passed |
| `npm run build` (inline dummy `DATABASE_URL`, dummy `AUTH_SECRET`) | OK |
| `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]"` on the touched files | 0 findings |
| `npx prettier --check --end-of-line auto` on the touched files | clean |

### Measured size

`git diff --shortstat feat/catalog-schedule-s1b2-list-read...HEAD -- . ':!openspec' ':!.engram'` -> 5 files changed, 1064 insertions = **1064 changed lines** (forecast ~310). Per file: `inscripciones-table.test.tsx` 559, `inscripciones-table.tsx` 395, `es.json` 54, `en.json` 54, `catalog-parity.test.ts` 2. Over the 800 budget with Phase 5 (forecast ~360, likely ~600 at the measured ratio) still to come: the combined PR would be around 1600. Decision needed from the owner (cut the table into its own PR, or accept a `size:exception`).

### Decisions and notes for Phase 5 and later

1. `InscripcionesTable({ rows, total, state, periods })`: `state` is the full `InscripcionesListState` (with the page the read clamped to), `periods` the newest-first list from `listInscripcionPeriods`. `InscripcionRow` carries ten displayed fields only; `asignaturaId`, `writable`, `hasActiveSibling` and `dependentRequests` are NOT sent in S1 (EA-PII-1, no request content). The page must pick fields one by one. S2b adds the fields its controls need.
2. The shared `ListTable` cannot host this list (its toolbar has one search, a three-way status filter with "All", and decides empty vs no-results from `q` and `status` only). The table composes the same frame pieces (`TableCard`, `DataTable`, `TablePagination`, `EmptyState`, `ListNavigationProvider`) with its own one-form filter bar. Shared components are untouched.
3. Deviation from `ListTable`: the filter bar also renders above the empty state, so a secretaria whose latest period has no active rows (a new term) can still reach older periods and inactive rows. EA-LIST-1 "Nothing in scope" still holds (empty state, no table).
4. Filters submit through the pure `parseInscripcionesListParams` (whitelist, caps) and `catalogListHref`; sort and page size are kept, the page resets. Without JavaScript the GET form carries `sort`, `dir` and `size` as hidden fields.
5. The no-results clear link uses `prefetch: false` (the page audits every render). The shared pagination and sort links of the table kit do not opt out of prefetch; with the dashboard `loading.tsx` boundary a default prefetch does not render the page, but Phase 5 or the nav slice should confirm this when the audited load exists.
6. Copy added under `catalog.inscripciones` (`title`, `subtitle`, `tableCaption`, `columns`, `state`, `filters`, `empty`, `noResults`, `degraded`, `noFacultad`). `degraded` and `noFacultad` are for the page (Phase 5). English uses "Enrollments"; Spanish "Inscripciones".
7. State words: a raw-active row shows "Active" plus "In effect" or "Not in effect"; a raw-inactive row shows "Inactive" only.

### Remaining tasks

Phase 5 (5.2-5.5) and Phases 6-17. The parent must decide how to handle the over-budget slice before Phase 5 continues.

## Batch 5: S1c-2 page, guards, audited load (tasks 5.1-5.5; Phase 6 NOT started)

Branch `feat/catalog-schedule-s1c2-page`, created from `feat/catalog-schedule-s1c1-table` (PR #105). Date: 2026-11-20. Commits `187818d` `feat(tables): let a list opt its pagination links out of prefetch` and `40b1353` `feat(enrollment): add the inscripciones page with the audited list load`. The run was interrupted once (the PC went to sleep, the run was stopped) after the code and tests existed; the resumed run reviewed them against the specs, re-ran every gate, and committed.

### Completed tasks

- [x] 5.1 branch (from S1c-1)
- [x] 5.2 RED, 5.3 RED, 5.4 GREEN: `CI/guards.test.ts`, `CI/page.test.tsx`, `CI/page.tsx`
- [x] 5.5 gates and measure done; PR NOT opened (parent owns PRs); over budget, see "Measured size"

Nothing from Phase 6 was started.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| prefetch opt-out (shared) | `src/components/tables/table-pagination.test.tsx`, `src/test/navigation-mock.test.tsx` | Unit / integration | existing files green | Not recorded: the interrupted run committed `187818d` without recording the failing run | pass | `prefetch={false}` sets `data-prefetch="false"` on every page link; omitted keeps the default (no attribute); the link stand-in exposes the flag only when set | Removed `void prefetch` from the link stand-in |
| 5.2 | `CI/guards.test.ts` (new) | Source-text structural | N/A (new) | Not recorded (interrupted run). Honest substitute, run on resume: removing `prefetch={false}` from the table's `TablePagination` makes the prefetch test fail (2 failed: guards and page test), then restored | pass (in the 811-test focused run) | exact page set is `page.tsx`; `await requireEnrollmentAccess(` is the first `await` and precedes `await searchParams`; no `requireCatalogAccess(`; no action import, no `"use server"`; no `<form`, `<button`, `action=`, `onClick`, `onSubmit`, `formAction`, `ActiveToggle`; tag-check self-test (4 cases) and a non-vacuity pin that the table's `<TablePagination` is found; every `<Link>` and `<TablePagination>` under `inscripciones/` has `prefetch={false}` | Clean |
| 5.3 | `CI/page.test.tsx` (new) | Integration (REAL `dal` and `requireEnrollmentAccess` on a mocked session and scope read; Testing Library; real catalogs) | N/A (new) | Not recorded (interrupted run). The same substitute mutation turned the page test "opts every page link out of prefetch" red | pass | four non-secretaria roles, anonymous and pending-password-change identities -> redirect, no scope read, no list read, no audit; scope `none` -> no-facultad state, nothing read or audited; default and hostile URL params (`status=all`, array values, bad sort, size 7 and 9999, page `x` and `0`) fall back; URL cannot widen the scope (`facultadId`, `scope` ignored); clamped page rendered; one audit call AFTER the list (call order), actor and facultad from the session; payload booleans only, no search text, no CIF or name; `periodo` recorded only when it is an in-scope period; degraded -> one `role="status"`, no table, no filter bar, no link, no button, no empty state, no audit; failing insert rejects the render; one GET form only and no control in a row; a leaky row (`correo`, `telefono`, `hashClave`, `dependentRequests`, `hasActiveSibling`, `writable`, `asignaturaId`) never reaches the HTML or the serialized props; one `h1` and no skipped heading level in five variants; one page frame; Spanish title and state | Clean |
| 5.4 | same files | GREEN | n/a | n/a | `page.tsx` passes both files | n/a | Field-by-field row projection, payload built once, no `try/catch` around the audit |

Totals: focused run `npx vitest run "src/app/(dashboard)/catalog/inscripciones" src/app/route-coverage.test.ts src/app/access-matrix.pages.test.tsx src/components` -> 32 files, 811 passed. Layers: structural source checks, integration, unit. `route-coverage.test.ts` gained `requireEnrollmentAccess` in its guard allowlist and `matrix-table.ts` the page row (`SECRETARIA`), so the two route-wide pins now cover the new page.

### Review against the specs (resume run, no gap found)

- EA-ACC-1: the guard is the first statement of the page; six non-secretaria identities redirect before any read (page test).
- EA-SCOPE-1: scope comes from `requireEnrollmentAccess`, never the URL; `none` renders its own state with no read and no audit.
- EA-DEG-1 and audit-log: the audited insert runs after authorisation and after the data loaded, never in the degraded branch, with a payload built once per render; a failing insert throws to the error boundary. Note: when no period is chosen the payload `periodo` is `""` (the default means "latest"; the page does not know which period the data layer resolved without a second read), so the spec's "the period" is recorded for a chosen period only. This is a conscious reading, flagged for the verify phase.
- CS-10: `guards.test.ts` repeats the `catalog/guards.test.ts` checks for `requireEnrollmentAccess(`; the catalog guards test and `catalog-structure.test.ts` are untouched.

### Prefetch risk (closed)

Mechanism: next/link prefetches its `href` by default, and a prefetch of a dynamic route runs only as far as the nearest `loading.tsx` boundary, so the page body (which writes the audit row) did not run even before this work, because the dashboard segment has a `loading.tsx` above the page. That is an implicit, framework-version-dependent protection, so it is not relied on. Every navigation on this page is now one of: a `<Link prefetch={false}>` (the no-results clear link via the `EmptyState` action, and every pagination page link via the new optional `prefetch` prop of `TablePagination`, default unchanged for every other list), or an imperative `navigate(...)` through `useListNavigation` (sort headers, page-size select, filter submit), which is a `router.push` and never prefetches. Pins: `guards.test.ts` fails if any `<Link>` or `<TablePagination>` under `inscripciones/` lacks `prefetch={false}`; `page.test.tsx` renders the page and asserts every link (pagination and clear) has `data-prefetch="false"`; the shared change is pinned in `table-pagination.test.tsx` and `navigation-mock.test.tsx`. Verified by mutation on resume: dropping the opt-out turned both pins red.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run "src/app/(dashboard)/catalog/inscripciones" src/app/route-coverage.test.ts src/app/access-matrix.pages.test.tsx src/components` -> 32 files, 811 passed |
| Runtime harness | N/A: server component rendered by awaiting the page function with the REAL guard on a mocked session and scope source; the DB and the audit helper are mocked. The real-database walk W1 is `[USER][CONFIRM]` after S1c-3 |
| Rollback boundary | Revert `40b1353` (page, two tests, one table line, two pin lines) and, separately, `187818d` (shared pagination `prefetch` prop and mock flag); additive |

### Gates G (2026-11-20)

| Gate | Result |
|---|---|
| focused vitest (command above) | 811/811 |
| `npm test` (full suite) | 361 files, 8669 passed |
| `npx next typegen && npm run typecheck` | clean |
| `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]"` on the 6 touched files | 0 findings |
| `npx prettier --check --end-of-line auto` on the 6 touched files | clean |
| `npm run build` (inline dummy `DATABASE_URL` and dummy 32-char `AUTH_SECRET`, no `.env` written) | OK |

### Measured size

`git diff --shortstat feat/catalog-schedule-s1c1-table...HEAD -- . ':!openspec' ':!.engram'` -> 10 files changed, 848 insertions(+), 4 deletions(-) = **852 changed lines**, over the 800 budget (forecast ~360; 2.4x). Per commit: `187818d` 49 (47 + 2; `table-pagination.tsx` 7, its test 20, `navigation-mock.ts` 3, its test 19), `40b1353` 803 (801 + 2; `page.test.tsx` 534, `guards.test.ts` 134, `page.tsx` 126, route-coverage 6, table 2, matrix 1). The page commit alone is 3 lines over 800. Per the instruction, comments and tests were NOT trimmed to fit; the stop rule applies and Phase 6 was not started. Decision needed from the owner: ship with `size:exception`, or cut at a commit boundary (`187818d` as its own small PR below this one leaves S1c-2 at 803, still over; the largest movable piece is `page.test.tsx`, 534 lines, at the cost of splitting the strict-TDD pairing).

### Remaining tasks

Open PR for S1c-2 (parent) and Phases 6-17 (S1c-3 onward).

## Batch 6: S1c-3 navigation, pins, docs, plus the #108 audit fix (tasks 6.1-6.9; Phase 7 NOT started)

Branch `feat/catalog-schedule-s1c3-nav`, created from `feat/catalog-schedule-s1c2-page` (PR #108). Date: 2026-11-20. Every chain branch has `origin/main` merged in (archived change `manual-document-data`, schema 0015). Commits `c1fb67e` `fix(enrollment): record the resolved period in the inscripciones list read audit` and `881f486` `feat(enrollment): add the inscripciones navigation entry and home shortcut`. Runtime attempt state `proceed` (acquired by the parent, not settled here).

### Completed tasks

- [x] 6.1 branch (from S1c-2)
- [x] 6.9 carried fix from PR #108 (new task line): RED then GREEN, commit `c1fb67e`
- [x] 6.2 RED navigation test, 6.3 RED pins, 6.4 GREEN `navigation.ts` plus `nav.catalogInscripciones` and `dashboard.shortcuts.catalogInscripciones`, 6.5 roadmap, 6.6 requirements, 6.7 readback: commit `881f486`
- [x] 6.8 gates and measure done; PR NOT opened (parent owns it)

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 6.9 | `src/lib/data/inscripciones.test.ts` | Unit (db double) | 88/88 with the page test | 8 failed: the three `toEqual` shapes (none, no period offered, degraded) lacked `resolvedPeriodo`, three new cases read `undefined` | 92/92 with the page test | default (latest), chosen existing period, unknown typed period falls back to the latest, empty string for scope `none`, no period offered and degraded | One local variable reuses the resolved period for the WHERE (no second lookup) |
| 6.9 | `CI/page.test.tsx` | Integration (real guard, Testing Library) | same run | 4 failed in the page file (payload still `""` by default, plus the new hostile-URL case) | pass | default load records the resolved period; a chosen `2026-S1` is recorded; hostile `periodo=Pérez` records the resolved `2026-S2` and the serialized call never contains the typed text | The page no longer needs the `periods.includes` rule |
| 6.2 | `src/lib/navigation.test.ts` | Unit | Not run before the edit; the 62 unchanged tests passed in the RED run | 7 failed: characterization list, prefetch pin, group order, visibility table, trail, CR-9 prefetch trail list, shortcuts for secretaria | pass | `isNavVisible` table for the five roles, trail, `isCurrentPath` rows between Asignaturas and Inscripciones, order inside the group, shortcuts in order | Clean |
| 6.3 | `app-sidebar.test.tsx`, `page-context.test.tsx`, `(home)/page.test.tsx`, `catalog-parity.test.ts` | Integration (real catalogs) | Not run before the edits; 999 of 1025 passed in the RED run | 26 failed in 5 files (the four listed plus `navigation.test.ts`) | 1038/1038 | es and en labels, prefetch flag on the sidebar link and the home card, hidden from the four other roles, active marker only on Inscripciones (also on a subpath) and only on Asignaturas for its own path, group opens on the page, tab order, label differs from the student label, parity of `nav.catalogInscripciones` and the shortcut key set | Renamed the stale "nine destinations" test to eleven |
| 6.4 | same files | GREEN | n/a | n/a | the entry plus four i18n lines pass every pin except the sidebar defect below | n/a | n/a |

`navigation-mock.test.tsx` (named in 6.3) pins no navigation entry: it only uses `/catalog/docentes` as a sample path for the router double, so nothing there changes.

### Finding: the sidebar ignored `prefetch` for group children

The first GREEN run left four sidebar tests red, one of them the new "prefetch disabled" pin: `NavGroupItem` rendered its child `<Link>` without `prefetch`, so a `prefetch: false` on any child of the Administration group was silently dropped (no child carried the flag before). `app-sidebar.tsx` now passes `prefetch={prefetchOf(link)}` for children, the same helper the top level uses; the home cards and the trail already forwarded it. The other three red tests were the tab-order test and the entries-per-role table, updated for the new entry, and a locale test that used the Spanish trigger name.

### Decisions and deviations

1. **`prefetch: false` on the entry.** BS-NAV-4 is silent on it; BS-NAV-1 gives it to Escalated requests and Reports because their pages are audited on render. `/catalog/inscripciones` writes an audit row per render (D10), so the sidebar link, the home card and the back link of the trail do not prefetch it. This closes the open point of Batch 4 note 5 and of Batch 5 "Prefetch risk". Pinned in `navigation.test.ts` (entry, trail, CR-9 list), the sidebar and the home. The spec text could gain one sentence for it; nothing conflicts.
2. **Labels.** `nav.catalogInscripciones` is "Inscripciones" (es) and "Enrollments" (en), the page titles. They differ from the student's "Inscripción" and "Enrollment" (pinned) only by a plural; the Administration group and the role keep them apart. Shortcut copy follows the sentence style of Docentes and Review.
3. **Icon.** `ClipboardList` (Review uses `ClipboardCheck`).
4. **#108 audit fix (6.9).** `listInscripciones` returns `resolvedPeriodo` (the chosen period when it exists, else the latest, `""` when nothing was read). The page records it, so the row always carries the real period and typed text can never reach it. This resolves the "conscious reading" flagged in Batch 5 for the verify phase.
5. **i18n.** Four additive lines, each placed right after its `catalogDocentes` sibling (`nav` and `dashboard.shortcuts`, both locales); no other key touched, to keep merges with `flow-experience` small.
6. **Docs.** `docs/roadmap.md` row 0 (state stays `pendiente`) plus one Notas bullet after the `student-enrollment` bullet (docentes gap of RF-12 (a) and RN-22 clock-time schedules not covered); `docs/requirements.md` one changelog row (2026-11-20) and one continuation under the existing RF-12 pending item. No RF, RN or RNF row text changed. The new row is not marked "pending sync with the thesis matrix" because no requirement text changed; the owner may want it flagged anyway.
7. The sidebar test "offers exactly Asignaturas and Docentes among the catalog pages" now also excludes `/catalog/inscripciones` from its filter (it has its own describe block).

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/navigation.test.ts src/components src/i18n "src/app/(dashboard)/(home)" src/test` -> 41 files, 1038 passed; fix: `npx vitest run src/lib/data/inscripciones.test.ts "src/app/(dashboard)/catalog/inscripciones/page.test.tsx"` -> 92 passed (RED runs: 12 failed, then 26 failed across 5 files) |
| Runtime harness | N/A: nav config, sidebar and home rendered by Testing Library on the real catalogs; the real-database walk W1 (sidebar and home per role) is `[USER][CONFIRM]` |
| Rollback boundary | Revert `881f486` (nav entry, sidebar `prefetch` forward, four i18n lines, pins, docs hunks) and, separately, `c1fb67e` (`resolvedPeriodo` on the list result and the page payload); both additive |

### Gates G (2026-11-20)

| Gate | Result |
|---|---|
| `npx next typegen && npm run typecheck` | clean |
| focused vitest (above) | 1038/1038 and 92/92; broader `"src/app/(dashboard)/catalog/inscripciones" src/lib/data src/lib/audit` 1670/1670 after the fix |
| `npm test` (full suite) | 372 files, 9177 passed, 0 failed (the two known flaky files passed under load this time) |
| `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]"` on the touched files | 0 errors; 1 pre-existing warning (`SidebarGroupLabel` unused in `app-sidebar.tsx`, not from this slice) |
| `npx prettier --check --end-of-line auto` on the touched files and both locale files | clean |
| `npm run build` (inline dummy `DATABASE_URL` and 32-char `AUTH_SECRET`, no `.env` written) | OK |

### Measured size

`git diff --shortstat feat/catalog-schedule-s1c2-page...HEAD -- . ':!openspec' ':!.engram'` -> 16 files changed, 321 insertions(+), 27 deletions(-) = **348 changed lines** (forecast ~190), under the 800 budget. After `c1fb67e`: 93 (5 files, 74 + 19). `881f486` alone: 255 (11 files, 247 + 8). One PR.

### Remaining tasks

Open PR for S1c-3 (parent) and Phases 7-17 (S2a-1 onward). Walk W1 is the owner's, after this slice.

## Batch 7: S2a actor-aware writer and staff drop (Phase 7 done; Phase 8 NOT started, size stop)

Branch `feat/catalog-schedule-s2a-writer`, created from `feat/catalog-schedule-s1c3-nav` (PR #130; chain #99 -> #100 -> #101 -> #103 -> #105 -> #108 -> #130). The owner merged S2a-1 and S2a-2 into this one branch and one PR (2026-11-20): task 7.1 is done on this branch and 8.1 is marked done because no separate S2a-2 branch will exist. Date: 2026-11-20. Commit `7424eb8` `refactor(enrollment): make the enrollment writer actor-aware and add the staff drop`. Nothing was pushed. Runtime attempt state `proceed` (acquired by the parent, not settled here).

### Completed tasks

- [x] 7.1 branch (merged S2a branch, see above), 8.1 branch (same branch)
- [x] 7.2 baseline: `enrollment-write.test.ts` and `inscripcion-writes.test.ts` green and UNTOUCHED (git shows neither modified)
- [x] 7.3 RED lock, 7.4 RED `staffDropGroup`, 7.5 RED atomicity: new `src/lib/data/enrollment-write-staff.test.ts`
- [x] 7.6 GREEN `src/lib/data/enrollment-write.ts`
- [x] 7.7 gates and measure done; PR NOT opened (parent owns it); Phase 8 deliberately not started, see "Measured size"

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 7.2 | `enrollment-write.test.ts`, `inscripcion-writes.test.ts` (unchanged) | Unit (db double) and structural | 54/54 across the four files `enrollment-write`, `inscripcion-writes`, `enrollment-picker`, `enrollment` before any edit | N/A (characterization of the student path; proof is that both files stay unedited and green) | 27/27 in the two files after the refactor, 49/49 with the staff file | the student statement order, rendered SQL and failure log are asserted by the untouched file | `enrollInGroup` and `dropGroup` keep their signatures; `enrollWork` and `dropWork` bodies moved unchanged |
| 7.3 | `enrollment-write-staff.test.ts` (new) | Unit (db double, `PgDialect` render) | N/A (new) | 22 failed of 22 (`TypeError: staffDropGroup is not a function`) | 22/22 | lock first and `for no key update of Usuario`, two inner joins (Rol, Carrera), facultad and student params; actor exists-clause with actor id, `secretaria`, active, same facultad; refusal table of six predicates each ending after the one lock statement with no audit; scope `none` renders `false`; foreign and missing ids answer alike | Mutation checks: replacing the staff audit actor by the student id turned 4 tests red; removing the actor clause turned 2 red; both restored |
| 7.4 | same file | Unit | N/A (new) | same run | pass | success row with the staff actor and the student as entity; `Inscripcion` statement binds the student and never the staff id; no period, Grupo or Asignatura filter and the rendered where equals the student's drop (D9, `dropWork` unchanged); two `not_enrolled` refusals; student drop and staff drop rows equal except `actorId`; payload keys exactly `grupoId`, `motivo`, no staff id | Clean |
| 7.5 | same file | Unit | N/A (new) | same run | pass | data statement failing and audit insert failing: rethrown, exactly one sanitized log line with the STAFF actor id and no message or params, `exhausted` false then true; a refusal logs nothing | Clean |
| 7.6 | `enrollment-write.ts` | GREEN | n/a | n/a | the three files pass: 49/49 | n/a | `lockStudent` untouched; `writeAsStudent` became `writeEnrollment(actor, work)` with the same lock, work, audit order |

### Decisions and deviations

1. **Actor check in the same lock statement.** CS-1 says the staff lock "is still one statement" and EA-WRITE-1 requires verifying the actor, so the actor check is an `exists` over aliased `Usuario` and `Rol` (`actor`, `actor_rol`) inside the lock's WHERE: id, role `secretaria`, active, and `FacultadId` equal to the scope facultad (so a secretaria reassigned after the guard ran is refused). Task 7.3 words it as a "staff-only guard statement"; no second statement was added because the design keeps one and the student statement order is untouched. The actor row itself is not locked (only the student row, `of: usuario`).
2. **Scope `none`.** The staff lock still runs its one statement with a literal `false` (CS-1), so it takes no lock and answers `not_student` like any other refusal.
3. **`EnrollmentStaff` export.** `{ actorId, scope }` is the new exported type; the action of S2b-1 passes exactly those two fields of the guard result. `staffDropGroup` copies the two fields explicitly into the actor (no object spread), so extra guard properties never travel.
4. **Result unions unchanged.** No member added to `EnrollResult`, `DropResult` or `EnrollmentErrorCode`; the staff drop returns the existing `not_student` (CS-2) and `not_enrolled`.
5. **Writer allowlist unchanged.** `enrollment-write.ts` is still the only module that writes `Inscripcion`; `inscripcion-writes.test.ts` passes untouched.

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/data/enrollment-write.test.ts src/lib/data/enrollment-write-staff.test.ts src/lib/data/inscripcion-writes.test.ts` -> 3 files, 49 passed (RED run of the new file: 22 failed of 22) |
| Runtime harness | N/A: DB double; no caller until S2b-1 (real-database walk W2 is `[USER][CONFIRM]`) |
| Rollback boundary | Revert `7424eb8`: the `enrollment-write.ts` refactor and `enrollment-write-staff.test.ts`; the student tests are unchanged and stay green |

### Gates G (2026-11-20)

| Gate | Result |
|---|---|
| `npx next typegen && npm run typecheck` | clean |
| focused vitest (above) | 49/49 |
| `npm test` (full suite) | 373 files, 9199 passed, 0 failed (no flaky file failed under load this time) |
| `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]"` on the 2 touched files | 0 findings |
| `npx prettier --check --end-of-line auto` on the 2 touched files | clean |
| `npm run build` (inline dummy `DATABASE_URL` and 32-char `AUTH_SECRET`, no `.env` written) | OK |

### Measured size

`git diff --shortstat feat/catalog-schedule-s1c3-nav...HEAD -- . ':!openspec' ':!.engram'` -> 2 files changed, 536 insertions(+), 25 deletions(-) = **561 changed lines** for commit `7424eb8` (forecast ~230; 2.4x): `enrollment-write.ts` 175 (150 + 25), `enrollment-write-staff.test.ts` 386. Budget for the merged PR is 800. Phase 8 forecast is ~200; at the measured ratio it would add 300 to 480 lines and take the PR to roughly 860 to 1,040, so per the stop rule Phase 8 was NOT started and comments and tests were not trimmed. Decision needed from the owner: ship S2a-1 alone at 561 and keep S2a-2 as its own PR (the original plan), or accept `size:exception` for the merged PR.

### Remaining tasks

Open PR for S2a-1 (parent); Phase 8 (8.2-8.6: staff reactivate, `staffEnrollInGroup`, picker and enrollment additive asserts) and Phases 9-17.
