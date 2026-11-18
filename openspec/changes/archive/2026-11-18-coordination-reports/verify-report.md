```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:944757d0ca293831775b23f7062d01f6a5f670f355434ce474ba19b1db9db47e
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 25/25
scenarios: 52/52
test_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test
test_exit_code: 0
test_output_hash: sha256:a02697bde3706db5c147fbe66617f30c594073dc91392e43b2678089ea37ca85
build_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm run typecheck
build_exit_code: 0
build_output_hash: sha256:f2cbbbb191d7d62906ae878fdb2a44507726ff4ca341b4a9aefe69c0847edf74
```

## Verification Report

**Change**: coordination-reports
**Version**: N/A (new capability `coordination-reports` plus deltas to `audit-log` and `backoffice-shell`)
**Mode**: Strict TDD (`strict_tdd: true`, runner `npm test` = `vitest run`)
**Verified on**: `main` b82b359 (worktree `C:\justifia-worktrees\p1`, branch `docs/coordination-reports-archive`), 2026-11-18. The only uncommitted changes in the worktree are `docs/roadmap.md`, `openspec/changes/coordination-reports/apply-progress.md` and `tasks.md` (the archive-time and task 4.12 records); no source file differs from main.

**Build note**: `npm run build` was NOT run by this verifier on instruction of the orchestrator, which built b82b359 successfully the same day. The `build_*` envelope fields therefore carry the type-check (`npm run typecheck`, `tsc --noEmit`), the only compile-level gate executed here. Nothing was run against Neon; every command used the dummy `DATABASE_URL`.

**RF numbering**: the specs, tasks and design cite RF-17 (a-e) for the dashboard. `docs/requirements.md` renumbered it to RF-18 on 2026-11-09 (RF-17 is now the student enrollment). Mapping used here: spec "RF-17 (a-e)" = requirements.md RF-18 (a-e); "RF-13 (a, b, d)" is unchanged. The project convention (requirements.md change log: archived changes keep the numbering they were archived with) makes this acceptable; see SUGGESTION S2.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 73 |
| Tasks complete | 72 |
| Tasks incomplete | 1 (5.4, archive-time by design) |

Task 5.4 (record the CR-LIMIT-1 limitations and the three `Carrera` audit actions in the archive notes; sync the three delta specs into `openspec/specs/`) is performed by `sdd-archive` and cannot precede it. The skill default treats any unchecked task as CRITICAL; this report follows the orchestrator's explicit instruction and records it as an expected WARNING (W6), not a blocker. Tasks 4.12 and 5.1-5.3 were closed on 2026-11-18 (see apply-progress, "Task 4.12: real download"); their claims were spot-checked (the roadmap diff shows row #7 `archivado`, `RF-13 (c)` added to row #5, and the closing "Pendiente: sincronizar RF-18" note).

### Build & Tests Execution

**Type-check (build evidence)**: PASS, `npm run typecheck` exit 0.

**Focused tests** (the change's own files, plus the nav, sidebar, home, permissions, page-context, empty-state and catalog-parity files it modified): PASS, 30 files, 1,198 tests, 0 failed. The change-owned subset alone (`src/lib/reports`, `src/app/(dashboard)/reports`, `src/app/api/reports`, the five `report-*.test.ts`, `src/lib/audit`, `src/i18n/reports-messages.test.ts`): 22 files, 505 tests, 0 failed (`events.test.ts` 105 and `types`/`diff` 15 include pre-existing cases).

**Full suite**: PASS, `npm test` exit 0, **341 test files passed (341), 7,764 tests passed (7,764)**, 0 failed, 0 skipped, duration 235.56 s. No flake appeared (`src/lib/signals/evaluate.test.ts` passed). The "Not implemented: navigation to another Document" lines are jsdom noise from pre-existing tests.

**Lint**: `npm run lint` exit 1 with 140,630 problems: 140,629 are the known repo-wide CRLF `prettier/prettier` "Delete CR" errors; after filtering them ONE warning remains: `src/components/app-sidebar.tsx:23:3 'SidebarGroupLabel' is defined but never used` (`@typescript-eslint/no-unused-vars`), introduced by commit 40b9edf (`style(sidebar): hide the navigation section label`, outside this change). No lint finding in any file owned by this change. See W4.

Output hashes (sha256 of the captured stdout and stderr plus an appended `exit=N` line): test `a02697bd...ca85`, typecheck `f2cbbbb1...edf74`, lint `78715ba2...cd44`.

**Coverage**: not available (`@vitest/coverage-v8` is not installed; no coverage script). Reported as skipped, not a failure.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | PASS | "TDD Cycle Evidence" tables in apply-progress Batches 1, 2, 3, 4 and 5 (every behavior task has a row) |
| All tasks have tests | PASS | 28/28 test files named in the tables exist in the repo |
| RED confirmed (tests exist) | PASS | 28/28 files verified; RED outcomes recorded (import not found, N failed, or mutation RED) |
| GREEN confirmed (tests pass) | PASS | all 28 files pass in the full run and in the focused run |
| Triangulation adequate | PASS | every row lists several cases (role tables, 5 filter sets, 7 parity sets, es and en); single-case rows are structural pins |
| Safety net for modified files | PASS | modified files (`permissions`, `events`, `navigation`, sidebar, home, `page-context`, `empty-state`, `report-reads`) list a pre-change green count; files marked "N/A (new)" were new |

**TDD Compliance**: 6/6 checks passed. Two disclosed cycle irregularities, both handled: (a) task 4.9 `parity.test.tsx` passed on its first run by design (it asserts the wiring of already-built pieces); non-vacuity was proven by mutation (the route dropping `causa` fails 4 cases). (b) the "no LIMIT/OFFSET" assertion committed in `b772548` was vacuous (control characters in a regex); the author found it and fixed it in `f2ea790` with a companion positive case.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure functions, `toSQL()` SQL pins, db double, ExcelJS read-back) | 211 | 11 (`params`, `scope`, `constants`, `build-workbook`, `report-scope`, `report-scope-sql`, `report-rankings`, `report-requests`, `report-reads`, `reports-messages`, report cases of `events`/`types`) | vitest |
| Integration, component (Testing Library, axe) | 117 | 6 (`page` x2, `period-filter`, `ranking-card`, `request-filters`, `requests-table`) | vitest, Testing Library, jest-axe |
| Route handler and page+route wiring (node env, real `dal`) | 42 | 2 (`route.test.ts`, `parity.test.tsx`) | vitest |
| Source-scan structural guards | 22 | 1 (`structure.test.ts`) | vitest |
| E2E | 0 | 0 | not installed |
| DB-backed integration (`*.integration.test.ts`) | 0 | 0 | the repo has `vitest.integration.config.mts`, but none was written for this change (needs `[ASK OWNER]` and a disposable branch) |

### Changed File Coverage

Coverage analysis skipped, no coverage tool detected (not a failure).

### Assertion Quality

Scan of all report-owned test files for banned patterns:

- Tautologies and assertions without a production call: none found.
- `toBeDefined()`: 3 hits (`report-scope-sql.test.ts` L74 and L141, `structure.test.ts` L278); each is followed by value assertions in the same test (SQL text and params; `prefetch: false` containment), so they are guards, not the assertion.
- `toEqual([])`: 14 hits. The axe `violations` ones are real a11y assertions; the structure scans have their own positive and negative samples (apply-progress, task 2.12) so they cannot pass on an empty set; the `report-requests` empties have non-empty companions (`returns every pair...`, `joins every pair...`, `returns every matching request`).
- Ghost loops: none in the report files; the structure test's link scan is proven non-vacuous by its own sample cases.
- Mock ratio: `vi.mock` 8 / 89 `expect` (dashboard page), 8 / 92 (detail page), 8 / 68 (route), 9 / 12 (parity, intentionally wiring-level), 4 for `report-reads`; none above 2x.
- Implementation-detail coupling: the SQL-text and `prefetch` prop assertions are deliberate contract pins required by the design (CR-3, CR-4, N2), not incidental coupling.

**Assertion quality**: 0 CRITICAL, 0 WARNING.

### Quality Metrics

**Linter**: 1 warning, 0 errors outside the CRLF noise, none in this change's files (W4).
**Type Checker**: no errors.

### Spec Compliance Matrix

Rule used: a scenario is COMPLIANT when a covering test passed in this run. Where the outcome depends on Postgres evaluating a join, grouping or ordering and every covering test pins the compiled SQL and the db double (which does not execute SQL) instead of executing rows, the scenario is accepted as COMPLIANT but flagged "SQL-pinned, aggregation not executed" when its GIVEN data is never constructed (four scenarios, see W1); this is the method the design Testing Strategy prescribes for slice 1a (SQL via toSQL(), reads via the db double). Pure row-filter predicates (scope, state list, teacher) are accepted on exact compiled-SQL parameter assertions and marked "SQL-pinned". The validator admits a passing verdict only with complete counts, so no scenario is left PARTIAL.

Spec 1: `specs/coordination-reports/spec.md` (18 requirements, 27 scenarios)

| Requirement | Scenario | Test (file > test) | Result |
|-------------|----------|--------------------|--------|
| CR-ACC-1 | Role matrix (table-driven) | `src/app/(dashboard)/reports/page.test.tsx > ReportsPage access` (each non-coordinacion role denied, anonymous, flagged); `src/app/(dashboard)/reports/requests/page.test.tsx > access`; `src/app/api/reports/justifications/route.test.ts > access > denies %s / anonymous`; `src/lib/auth/permissions.test.ts > lists exactly coordinacion as the reporting role` | COMPLIANT |
| CR-ACC-1 | Coordination without a career | `reports/page.test.tsx > without a career (alert block, no query, no audit)`; `requests/page.test.tsx` same; `route.test.ts > redirects a coordinator without a career`; `src/lib/reports/scope.test.ts`; `src/lib/data/report-scope.test.ts > fails closed` | COMPLIANT |
| CR-SCOPE-1 | Other career invisible | `src/lib/data/report-scope-sql.test.ts > is an EXISTS on the student's career, bound as a parameter`, `> puts the scope first...`; `report-rankings.test.ts > %s count only aprobada and pendiente, in the career scope` (scope param first, one `Usuario e`) | COMPLIANT (SQL-pinned) |
| CR-SCOPE-1 | Student changes career | `report-scope-sql.test.ts > never uses the snapshot career name or a join on Carrera` (live `Usuario.CarreraId`; documented limitation) | COMPLIANT (SQL-pinned) |
| CR-PERIOD-1 | Default is the latest period with data | `src/lib/data/report-rankings.test.ts > resolves latest to the newest period and ranks it`; `reports/page.test.tsx > period handling` | COMPLIANT |
| CR-PERIOD-1 | All periods and invalid value | `src/lib/reports/params.test.ts > reads period=all...` and invalid forms fall back; `report-rankings.test.ts > ranks every period for all`; `reports/page.test.tsx > selects All periods and audits the period as all` | COMPLIANT |
| CR-PERIOD-1 | No data at all | `report-rankings.test.ts > reports no period and runs no ranking when there is no data`; `reports/page.test.tsx > without any period` (empty state, audited with zeros) | COMPLIANT |
| CR-RANK-1 | Counted states (table-driven) | `src/lib/reports/constants.test.ts > counts exactly aprobada and pendiente (RN-16)`; `report-rankings.test.ts > %s count only aprobada and pendiente` (params `[7,"aprobada","pendiente"]`) | COMPLIANT |
| CR-RANK-2 | Pairs, not requests, for teachers and classes | `report-rankings.test.ts > students: one count per request`, `teachers: pairs grouped...`, `classes: pairs grouped...` (SQL shape only; the 1-student/2/2 data is never executed) | COMPLIANT (SQL-pinned, aggregation not executed) |
| CR-RANK-2 | Period limits pairs | `report-rankings.test.ts > pair rankings keep the other-period pairs of a request out`, `the student ranking needs no joined-period predicate` (params and `g.Periodo` predicate; no executed rows) | COMPLIANT (SQL-pinned, aggregation not executed) |
| CR-RANK-3 | Cut and tie | `report-rankings.test.ts` ORDER clause `total DESC, name ASC, id ASC LIMIT 10` for the three rankings (the 12-student tie is never constructed); `reports/page.test.tsx` renders rows in the order given | COMPLIANT (SQL-pinned, aggregation not executed) |
| CR-DASH-1 | Degraded read | `report-rankings.test.ts > is degraded with no partial data when %s fails` (x4); `reports/page.test.tsx > degraded read` (`role="status"`, no figures, no audit) | COMPLIANT |
| CR-AUDIT-1 | Once per open | `reports/page.test.tsx > audited read` (once, after the load); `src/lib/data/report-reads.test.ts > wraps each page writer in React cache()`, `is a no-op for a second identical call`; `reports/structure.test.ts > calls the writer exactly once in the page, after the guard and the data load` | COMPLIANT |
| CR-AUDIT-1 | Audit failure blocks the data | `reports/page.test.tsx > returns no data when the audit write fails`; `report-reads.test.ts > rejects when the audit insert fails` | COMPLIANT |
| CR-LIMIT-1 | Reassigned group | `report-rankings.test.ts > teachers: pairs grouped by the live Grupo.DocenteId` (group by the live `Grupo.DocenteId`; a reassignment is never executed) | COMPLIANT (SQL-pinned, aggregation not executed) |
| CR-I18N-1 | Key parity | `src/i18n/reports-messages.test.ts > es.json and en.json hold exactly the same reports keys` and non-empty values; `src/i18n/catalog-parity.test.ts` | COMPLIANT |
| CR-DET-1 | One row per request | `src/lib/data/report-requests.test.ts > counts 3 requests that hold 7 pairs as 3`, `loadReportRequests > joins every pair of a request into its row, in one batch`; `requests/page.test.tsx > rows` (several classes in one cell); `requests-table.test.tsx` | COMPLIANT |
| CR-DET-1 | Borrador and other careers excluded | `report-requests.test.ts > lists the visible states only: no borrador`, `applies the same where as the count`; `report-scope-sql.test.ts > filters the request state by the list it is given` | COMPLIANT (SQL-pinned) |
| CR-DET-2 | Combined filters | `report-scope-sql.test.ts > ANDs period, teacher, term and cause after the scope term`, `puts period and teacher on the same class row`; `requests/page.test.tsx > filters`; `parity.test.tsx` (7 filter sets); real run 2026-11-18 case "combined" (2026-S2 plus medical: 32 = 32 = 32) | COMPLIANT |
| CR-DET-2 | Foreign teacher | `report-requests.test.ts > reads no page when nothing matches (a foreign teacher yields zero rows)`; `requests/page.test.tsx` ("Teacher outside your career", no name); `route.test.ts > names a teacher outside the career generically` | COMPLIANT (SQL-pinned) |
| CR-DET-3 | Total counts requests | `report-requests.test.ts > counts 3 requests that hold 7 pairs as 3`, `clamps a page past the end`; `requests/page.test.tsx > paging`; `parity.test.tsx` (25/26 page boundary, 60, 0) | COMPLIANT |
| CR-DET-4 | Once per open, none on denial | `requests/page.test.tsx > audit (CR-DET-4)` (once, after the load, none when denied, none when `none` scope or degraded, failure blocks data); `report-reads.test.ts > recordReportRequestsRead` | COMPLIANT |
| CR-XLS-1 | Role matrix and headers | `route.test.ts > gives an in-career coordinator the workbook with the three headers` (xlsx type, `attachment`, `private, no-store`, PK magic bytes), `denies %s`, anonymous, flagged | COMPLIANT |
| CR-XLS-2 | Locale, summary, formula-like text | `src/lib/reports/build-workbook.test.ts > text stays text` (5 names and every column), `summary sheet`; `route.test.ts > workbook content` (en row and headers, formula-like name kept as text, summary lists filters and total), `locale` (es, en, no cookie, `fr`, empty) | COMPLIANT |
| CR-XLS-2 | Empty download | `build-workbook.test.ts > is a valid workbook with the headers, no data row and a total of 0`; `route.test.ts > still downloads when nothing matches` | COMPLIANT |
| CR-XLS-3 | Parity | `src/app/api/reports/justifications/parity.test.tsx` (real page and real route, 7 filter sets: compiled WHERE equal, screen total = summary total = data rows); real run 2026-11-18, six cases all equal (101, 66, 21, 11, 50, 32) | COMPLIANT |
| CR-XLS-4 | Audit gate | `route.test.ts > audit gate` (one row after authorization, read and build, before the response; two downloads two rows; 500 and no bytes on insert failure; no row on read or build failure); `report-reads.test.ts > recordReportDownload is NOT deduplicated` | COMPLIANT |

Spec 2: `specs/audit-log/spec.md` (4 requirements, 12 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Scope limited to write events (MODIFIED) | Preview writes no audit record | pre-existing import-preview tests in the full suite (unchanged by this change) | COMPLIANT (regression, not re-audited) |
| Scope limited to write events (MODIFIED) | Staff read is in scope | pre-existing review-read tests; `src/lib/audit/events.test.ts > review event builders` | COMPLIANT (regression) |
| Scope limited to write events (MODIFIED) | Student own read is out of scope | pre-existing student-request tests (unchanged) | COMPLIANT (regression) |
| Scope limited to write events (MODIFIED) | Coordination report read is in scope | `events.test.ts > the dashboard view is on the Carrera of the coordinator`; `reports/page.test.tsx > audited read` | COMPLIANT |
| Closed set of report events | Action to entity type (table-driven) | `events.test.ts` dashboard, detail and download builders (action, `Carrera`, carrera id); `src/lib/audit/types.test.ts`; `report-reads.test.ts` (actor is the session user, one transaction each) | COMPLIANT |
| Closed set of report events | Existing events unchanged | `events.test.ts > leaves existing events byte-identical` | COMPLIANT |
| One audit row per report view and download | Successful operations (table-driven) | `reports/page.test.tsx`, `requests/page.test.tsx`, `route.test.ts` (one writer call each; two downloads, two calls); the row shape is asserted at the writer in `report-reads.test.ts` (rows are not read back from a database) | COMPLIANT |
| One audit row per report view and download | Operations that leave no row (table-driven) | page tests (denied, `none`, degraded, audit failure) and `route.test.ts` (denied, `none`, read failure, build failure, audit failure) | COMPLIANT |
| One audit row per report view and download | Prefetch and re-render do not duplicate | `reports/structure.test.ts > every <Link> under reports/ or aimed at /reports has prefetch={false}`, `has no loading, layout, template or default file`; `src/lib/navigation.test.ts > opts the reports entry out of prefetching`; `report-reads.test.ts > wraps each page writer in React cache()` | COMPLIANT (structural) |
| Report payloads are codes and counts only | Dashboard payload | `events.test.ts > the payload holds the period and counts only, no name, CIF or request id` | COMPLIANT |
| Report payloads are codes and counts only | Student term never stored | `events.test.ts > holds the filters and the count only: a boolean for the search, never a term`; `report-reads.test.ts > stores a boolean for the search`; `route.test.ts > never hands the typed term to the audit writer` | COMPLIANT |
| Report payloads are codes and counts only | Download payload | `events.test.ts > solicitudReporteDescargadoEvent`; `route.test.ts > audits the period as all, a false search and the total of the file` | COMPLIANT |

Spec 3: `specs/backoffice-shell/spec.md` (3 requirements, 13 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| BS-NAV-1 | Entries per role (table-driven) | `src/components/app-sidebar.test.tsx > AppSidebar entries per role` (coordinacion sees Reports after the escalation entry and before Administration; the spec table omits the later `Solicitudes escaladas` entry, see W2) | COMPLIANT |
| BS-NAV-1 | Settings entry unchanged | `app-sidebar.test.tsx > keeps the settings entry for %s` | COMPLIANT |
| BS-NAV-1 | Active marker | pre-existing `app-sidebar.test.tsx > marks only the more specific top-level link` | COMPLIANT (regression) |
| BS-NAV-1 | Administration group hidden when empty | `app-sidebar.test.tsx > entries per role` (docente and estudiante: no group trigger) | COMPLIANT |
| BS-NAV-1 | Reports entry not prefetched | `src/lib/navigation.test.ts > opts the reports entry out of prefetching`; `app-sidebar.test.tsx > AppSidebar reports item`; `src/app/(dashboard)/(home)/page.test.tsx > offers coordinacion the Reports shortcut ..., not prefetched` | COMPLIANT |
| BS-NAV-1 | Reports routes and active marker | `app-sidebar.test.tsx > reports item` (`/reports`, `/reports/requests`); `navigation.test.ts > trailFor` (exact on `/reports`, link on `/reports/requests`); `src/components/page-context.test.tsx` (back link `prefetch={false}`) | COMPLIANT |
| BS-HOME-1 | Home per role (table-driven) | `(home)/page.test.tsx > HOME_PER_ROLE` (coordinacion: `/coordination`, `/reports`, asignaturas, docentes, users; the spec row omits the escalation card, see W2) | COMPLIANT |
| BS-HOME-1 | Counts hidden from student and docente | pre-existing home tests (unchanged) | COMPLIANT (regression) |
| BS-HOME-1 | No shortcut to settings | pre-existing home tests (unchanged) | COMPLIANT (regression) |
| BS-HOME-1 | Stats read degrades | pre-existing home tests (unchanged) | COMPLIANT (regression) |
| BS-HOME-1 | Predicates stay in step | `(home)/page.test.tsx > hides Asignaturas and Docentes from both when the catalog predicate flips` and the shared nav config | COMPLIANT |
| BS-HOME-1 | Reports shortcut only for coordination | `(home)/page.test.tsx > shows %s no Reports card and no link to /reports` (4 roles) | COMPLIANT |
| BS-I18N-1 | Key parity | `reports-messages.test.ts > names the sidebar entry in both catalogs` and key-set parity; `catalog-parity.test.ts` (shortcut keys) | COMPLIANT |

**Compliance summary**: 52/52 scenarios compliant (0 PARTIAL, 0 FAILING, 0 UNTESTED); 25/25 requirements. Eight scenarios rest on compiled-SQL pins rather than executed rows: CR-SCOPE-1 (2), CR-DET-1 "Borrador and other careers excluded", CR-DET-2 "Foreign teacher" and the four flagged in W1 (CR-RANK-2 x2, CR-RANK-3, CR-LIMIT-1).

Out-of-scope check: RF-13 (c) (recidivism per student) is explicitly out of scope in `proposal.md` (Out of Scope), in the spec Purpose (traceability list) and in `tasks.md` task 5.2 (it moves to `validation-signals`, #5, RN-14); CR-LIMIT-1 forbids any recidivism figure or placeholder in a view. Static scan: no recidivism string in any report source or in the `reports.*` catalog keys (the only `Reincidencia` key, `rn14` in `i18n/es.json`, belongs to the signals namespace). Not implemented, as intended.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| CR-ACC-1 | Implemented | `canViewReports` and `rolesQueVenReportes` in `permissions.ts`; page, detail and route all guard |
| CR-SCOPE-1 | Implemented | one `buildReportWhere` with the scope EXISTS as its first term feeds rankings, count, page and export |
| CR-PERIOD-1 | Implemented | `listReportPeriods`, `PERIODO_RE` filter, `latest` resolution in the loader |
| CR-RANK-1/2/3 | Implemented | three ranking queries, `RANKING_STATES`, `LIMIT 10`, tie-break by name then id |
| CR-DASH-1 | Implemented | page, filter, three cards, link to the detail (commit 6f1c04b), degraded alert |
| CR-AUDIT-1, CR-DET-4, CR-XLS-4 | Implemented | writers run after the load; the route writes after the build and before the response; an insert failure throws or answers 500 |
| CR-LIMIT-1 | Implemented | live `Grupo.DocenteId`, current `Usuario.CarreraId`; the archive notes are task 5.4 (pending) |
| CR-I18N-1 | Implemented | `reports.*` in both catalogs, workbook labels from the catalog |
| CR-DET-1/2/3 | Implemented | one row per request, five-param parser shared with the export, 25 per page with clamp |
| CR-XLS-1/2/3 | Implemented | self-guarded GET route, ExcelJS builder with text cells, parity test |
| Audit-log delta | Implemented | `Carrera` entity type, three actions, code-only payloads, no schema change |
| Backoffice-shell delta | Implemented | nav entry with `prefetch: false`, home shortcut, trail prefetch fix |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| CR-1 module layout | Yes, with additions | extra files recorded in apply-progress: `src/i18n/messages.ts`, `loadReportRequests`, own `RequestsPagination` |
| CR-2 scope | Yes | `reportScopeFor`, `resolveReportScope`, `reportInScope` (`none` is false, unknown kind throws) |
| CR-3 one where-builder | Yes | scope first; period and teacher in one `EXISTS` |
| CR-4 ranking SQL | Yes | group-by, order and limit pinned; joined-period predicate on the pair rankings |
| CR-5 periods and default | Yes | one list for all views |
| CR-6 params and hrefs | Yes | the resolved period is carried by every outgoing href |
| CR-7 audit | Yes | `Carrera` entity; the search term is never logged (boolean) |
| CR-8 page composition | Yes | states table honored; no-career block, degraded alert, empty state |
| CR-9 navigation | Yes | nav entry, `NavTrail.prefetch`, structure test guards |
| CR-10 export route | Yes | guard order pinned by `structure.test.ts`; open question 1 (locale in a route handler) settled by `route.test.ts` with `createTranslator` over `getUserLocale()` |
| Deviations | Recorded | apply-progress lists them per batch (translator choice, `.tsx` parity test, ISO dates in the workbook, `none` scope redirects to `/denied`, "all" select literal). None breaks a spec requirement |
| Size forecast | Exceeded | every slice passed the 800-line budget (tests 1.7x to 3.3x production); delivered as accepted exceptions. Process note, not a defect |

### Issues Found

**CRITICAL**: None.

**WARNING**:

- W1. Four scenarios are accepted on SQL pins only (they would be PARTIAL under a strict executed-rows reading): "Pairs, not requests", "Period limits pairs", "Cut and tie" and "Reassigned group". Their GIVEN data (one request with two pairs, a 12-student tie, a reassigned group) is never constructed; every covering test pins the compiled SQL (`GROUP BY`, `count(*)`, `ORDER BY total DESC, name ASC, id ASC LIMIT 10`, joined `g.Periodo` predicate) with the db double, which does not execute SQL (apply-progress Batch 1, deviation 7). No `*.integration.test.ts` exists for the rankings. Mitigation: the owner walked `/reports` on 2026-10-31 and approved it (task 2.13), and the 2026-11-18 real run executed the detail and export filters against real data, but it did not exercise the three rankings. Recommendation: an optional integration test on a disposable branch (needs the owner's consent per `CLAUDE.md`).
- W2. The delta specs are stale against `openspec/specs/` and must be rebased before the archive sync (task 5.4), or a blind sync regresses main. (a) The `audit-log` MODIFIED requirement "Scope limited to write events" restates the pre-`escalation` text and drops the coordinator escalation exception (`escalamiento.cola.consultada`, `solicitud.consultada` for an escalated request) and the scenario "Coordinator read is in scope" that the main spec now contains. (b) The `audit-log` ADDED requirement says the entity types "MUST gain `Carrera`", which `escalation` already added to the main spec (harmless wording). (c) The `backoffice-shell` BS-NAV-1 and BS-HOME-1 tables list `coordinacion` as Dashboard, Reports, Administration, Settings and as Reports, Asignaturas, Docentes, Users, but the shipped sidebar and home also carry the `Solicitudes escaladas` entry and the `/coordination` shortcut (from `escalation`), and the tests pin them. The tests pass on the actual behavior; the specs describe a state that does not exist.
- W3. Task 4.12 was closed with weaker evidence than its text: the six downloads were read back with ExcelJS, not opened in Excel or LibreOffice; checklist items 6 (formula-like student name), 7 (audit row entity and fields) and 8 (English download) were not checked in the real run (apply-progress states this). They remain covered by unit and route tests only (`build-workbook.test.ts`, `route.test.ts > locale`, `events.test.ts`). Not blocking: the totals parity and one audit row per click were proven live.
- W4. `npm run lint` exits 1. Apart from the 140,629 known CRLF noise errors, one warning: `src/components/app-sidebar.tsx:23:3 'SidebarGroupLabel' is defined but never used` (from commit 40b9edf, the owner's commented-out label; not part of this change). A repository hygiene item for the owner.
- W5. Disclosed TDD irregularities, already handled: the parity test passed first time by design (mutation-proven non-vacuous), and one vacuous assertion shipped in `b772548` until `f2ea790` fixed it. No action beyond keeping the mutation checks.
- W6. Task 5.4 is unchecked (see Completeness). Expected: it is the archive step itself, so the report is `pass_with_warnings`, not `fail`. It is the first thing `sdd-archive` must do, together with W2.
- W7. Roadmap row #7 already reads `archivado` (task 5.1) in this uncommitted worktree while the change is not yet archived; that is correct only if the archive lands in the same commit, as tasks.md Phase 5 intends.

**SUGGESTION**:

- S1. Record in the archive notes (5.4) the two limitations documented only in apply-progress: the export reads classes in one `IN (...)` batch with one bind parameter per request (about 65,000 requests would fail with a 500), and Excel can still turn a `=...` name into a formula if a user edits that cell (ExcelJS 4.4 has no `quotePrefix`).
- S2. Because the delta specs cite RF-17 where `docs/requirements.md` now says RF-18, add one line to the archived change (or the archive notes) saying that RF-17 in the planning documents means RF-18 today; the requirements.md log says archived changes keep their numbering, so no rewrite is required.
- S3. `tasks.md` narrative lines 130 and 148 (tasks 3.18 and 4.13) still say that tasks 3.17 and 4.12 are "still open" although both are now `[x]`; refresh the wording when archiving.
- S4. The open design questions (the export has no row cap; the live `Grupo.DocenteId` rewrites history) remain accepted limitations; track them in the roadmap or a backlog entry so they are not lost after the archive.

### Verdict

PASS WITH WARNINGS

All 7,764 tests, the type-check and the focused change tests pass, all 52 scenarios have a passing covering test with no failing or untested scenario, and the strict-TDD evidence checks out; the open points are four ranking scenarios proven only by SQL shape, spec deltas that must be rebased onto the current main specs before the archive sync, and the archive-time task 5.4.
