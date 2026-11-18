# Apply Progress: Coordination Reports

Mode: Strict TDD (vitest). Delivery: auto-chain, stacked-to-main. Branch of this batch: `feat/coordination-reports-1a` (from `feat/coordination-reports`).

## Batch 1: Phase 0 (0.1, 0.3) and Phase 1 slice 1a (1.1-1.21) - DONE

Tasks 0.1, 0.2, 0.3 and 1.1-1.21 are `[x]` in `tasks.md`. Phases 2-5 are pending (slices 1b, 2, 3 and archive).

Commits (oldest first):

| Hash | Message |
|------|---------|
| `a8826ca` | `docs(coordination-reports): add the SDD planning documents` (tracker branch, not in the 1a diff) |
| `7bfcce6` | `feat(reports): add the report scope, period params and where-builder` (1a-i) |
| `0dfcf81` | `feat(reports): add the report rankings and the dashboard audit event` (1a-ii) |

### Measured size (STOP condition: 800)

`git diff a8826ca..HEAD -- src`: 21 files, +1395 / -2 = **1,397 changed lines** (production 512, tests 885). Over the 800 session budget. 1a-i alone is 579, 1a-ii alone is 818. The overshoot is test volume (tests are about 1.7x production), the same 2-3x pattern as `document-extraction`. The work is complete and committed; the delivery decision (one oversized 1a PR with `size:exception`, or splitting along the two commits) belongs to the orchestrator/owner.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.2 | `src/lib/auth/permissions.test.ts` | Unit | 102/102 | 7 failed (`canViewReports is not a function`) | 109/109 | 5 roles + undefined | None needed |
| 1.3-1.4 | `src/lib/reports/{constants,scope}.test.ts` | Unit | N/A (new) | import not found | 10/10 | 2 careers, null, null actor, 4 roles | None needed |
| 1.5-1.6 | `src/lib/reports/params.test.ts` | Unit | N/A (new) | import not found | 14/14 | 2 codes, 7 invalid forms, round-trip | None needed |
| 1.7-1.8 | `src/lib/data/report-scope-sql.test.ts` | Unit (toSQL) | N/A (new) | import not found | 12/12 | scope x states x period x none x bogus | None needed |
| 1.9-1.10 | `src/lib/data/report-scope.test.ts` | Unit (db double) | N/A (new) | import not found | 9/9 | 4 non-reporting roles, null career, missing row, throw, no cache | None needed |
| 1.12-1.13 | `src/lib/data/report-rankings.test.ts` (SQL) | Unit (toSQL) | N/A (new) | import not found | 10/10 | 3 rankings, period on/off, states | Split `pairsOfRequests` (it built both queries per call, which would consume two double steps) into `teacherPairs`/`classPairs` |
| 1.14-1.15 | `src/lib/data/report-rankings.test.ts` (loader) | Unit (db double) | 10/10 | 9 failed (`loadReportDashboard is not a function`) | 19/19 | latest, all, absent code, no data x2, degraded x4 | None needed |
| 1.16-1.17 | `src/lib/audit/{events,types}.test.ts` | Unit | 97 pre-existing | 2 failed | 97/97 + tsc | builder, key set, 3 period shapes, 2 byte-identical pins | None needed |
| 1.18-1.19 | `src/lib/data/report-reads.test.ts` | Unit + structural | N/A (new) | import not found | 9/9 | writer x4, boundary scan x4 | None needed |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/lib/auth/permissions.test.ts src/lib/reports src/lib/data/report- src/lib/audit` -> all pass; unit totals above |
| Runtime harness | N/A: inert code, no route imports it; SQL checked with `toSQL()` / `PgDialect.sqlToQuery` |
| Rollback boundary | Delete `src/lib/reports/**`, `src/lib/data/report-*.ts`; revert `permissions.ts`, `audit/{types,events}.ts` (+ tests), the `selectDistinct` line in `test-support/db-double.ts` |

### Gates (1a)

- `DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test`: 275 files, 5,996 tests, all pass.
- `npm run typecheck`: clean.
- `npx eslint src`: 0 problems in changed files. Only the known CRLF `prettier/prettier` noise remains repo-wide (3 pre-existing non-filtered rows in untouched files: `enrollment-write.ts`, `sort-sql.ts`, `sharp-unpdf-preparer.ts`).
- `prettier --check --end-of-line auto` on all changed `src` files: clean.
- `DATABASE_URL=... npm run build`: success.

### Deviations from design / tasks

1. `classFilter(periodo)` and `ReportFilters` carry the period only. The `docenteId`, `q` and `causa` terms are deferred to tasks 3.5-3.6 (slice 2), where their RED tests are planned, so no untested code ships in 1a.
2. `RankingSource = Pick<typeof db, "select" | "selectDistinct">` and `*Query(source, ...)` builders: tests inject a DB-free `QueryBuilder` (cast) to pin the SQL; the loader passes `db`. `listReportPeriods` uses `selectDistinct`, so `test-support/db-double.ts` gained a one-line `selectDistinct` handle.
3. The `classFilter` EXISTS aliases are `fsa`/`fg` (not `sa`/`g`) so they never shadow the ranking joins.
4. `loadReportDashboard` returns `periodo: ResolvedPeriod | null` (kind-based, so 1b can feed `reportsHref`), not a bare string. `recordReportDashboardRead(actorId, carreraId, periodo: string | null, estudiantes, docentes, asignaturas)` takes primitives so React `cache()` dedupes by identity; the page maps a `ResolvedPeriod` to `"all"` or the code.
5. `reportsHref(period)` is the dashboard URL (`/reports?period=...`). The "View requests" link target `/reports/requests?period=...` is `requestsReportHref` (task 3.3, slice 2); 1b needs a literal or a decision.
6. Branch is `feat/coordination-reports-1a` (as instructed), not `feat/coordination-reports-1a-data` from the task text.
7. The scenarios "Pairs, not requests", "Cut and tie" and "Reassigned group" are proven by the generated SQL (count over the pair join, `ORDER BY count(*) desc, name, id LIMIT 10`, live `Grupo.DocenteId`), not by executed rows: the db double does not run SQL. An optional `*.integration.test.ts` against a disposable branch is not written (needs `[ASK OWNER]`).

### Task 0.3 findings

`Link prefetch={false}` never prefetches in the App Router (`link.md`); GET route handlers are dynamic by default since 15 (`route.md`); `ChartColumn` is declared by installed `lucide-react` 1.42. Drift only: the repo guards with root `middleware.ts` while the Next 16 docs name the convention `proxy` (build prints "Proxy (Middleware)"); no design impact.

### Remaining after Batch 1

Phase 2 (1b), Phase 3 (slice 2), Phase 4 (slice 3), Phase 5 (archive-time).

---

## Batch 2: Phase 2 slice 1b, tasks 2.1-2.9 - PARTIAL (stopped at the 800-line budget)

Branch `feat/coordination-reports-1b-dashboard` (from `feat/coordination-reports-1a-ii`, tip `8883cd7`). Tasks 2.1-2.9 are `[x]`; 2.10-2.14 are pending.

Commits (oldest first):

| Hash | Message |
|------|---------|
| `da4dff3` | `feat(reports): add the reports navigation entry and dashboard copy` (2.1-2.5) |
| `b59eaf7` | `feat(reports): add the ranking card and the period filter` (2.6-2.9) |

### Measured size (STOP condition: 800)

`git diff --shortstat feat/coordination-reports-1a-ii..HEAD -- src i18n`: 12 files, +783 / -19 = **802 changed lines** (production 228 incl. 68 i18n lines, tests 574). The remaining page, page test and structure test are forecast at ~500 more (~1,300 total), so work stopped at this commit boundary. Proposed split in `tasks.md` Phase 2 header.

### TDD Cycle Evidence (1b so far)

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1-2.2 | `src/i18n/reports-messages.test.ts` | Unit | N/A (new) | 16 failed (keys missing) | 16/16, `src/i18n` 321/321 | key parity, non-empty, required keys, plural 1/2/3 in es and en | None needed |
| 2.3-2.4 | `src/lib/navigation.test.ts` | Unit | 50/50 | 7 failed | 57/57 | order, prefetch flag, role table, trail exact and below, shortcuts | None needed |
| 2.5 | `src/components/app-sidebar.test.tsx`, `src/app/(dashboard)/(home)/page.test.tsx` | Component | 176/176 | 10 failed (navigation.ts reverted via stash) | 186/186 | es/en labels, prefetch=false via link double, 4 other roles hidden, active on /reports and /reports/requests | None needed |
| (impact) | `src/i18n/catalog-parity.test.ts` | Unit | pinned list | 1 failed after the nav change (shortcut keys list) | passes | n/a | list and title updated to nine |
| 2.6-2.7 | `src/app/(dashboard)/reports/ranking-card.test.tsx` | Component | N/A (new) | import not found | 10/10 | rows with and without CIF, empty, a11y (axe) rows and empty, hook-free source | Prettier layout only |
| 2.8-2.9 | `src/app/(dashboard)/reports/period-filter.test.tsx` | Component | N/A (new) | import not found | 11/11 | 3 submitted values, option order, extra absent code, no duplicate, no periods, axe | `findAllByRole` instead of a sync query (popup renders async) |

### Work Unit Evidence (1b so far)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/i18n "src/app/(dashboard)/reports" src/components "src/app/(dashboard)/(home)" src/lib/navigation.test.ts` -> 890 + 21 pass |
| Runtime harness | Pending: task 2.13 is [ASK OWNER] and no page exists yet. `npm run build` passes (no `/reports` route yet) |
| Rollback boundary | Revert the two commits: `navigation.ts` entry, i18n keys, `reports/ranking-card*.tsx`, `reports/period-filter*.tsx` and the test edits in sidebar, home, navigation and catalog-parity |

### Gates (at b59eaf7 plus tasks/progress docs)

- `DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test`: 278 files, 6,052 tests, pass on the third full run. `src/app/(dashboard)/catalog/import/import-form.test.tsx` ("shows the summary and the credentials download after the apply") failed in 2 of 4 full runs and passes alone (39/39, twice): an intermittent timing failure in an untouched file, not caused by 1b.
- `npm run typecheck`: clean.
- ESLint on all of `src` and `i18n`: only the known CRLF `prettier/prettier` "Delete ␍" noise; no other rule fires.
- `prettier --check --end-of-line auto` on every changed file: clean.
- `npm run build`: success.

### Deviations from design / tasks (1b)

1. **No dashboard to detail link and no "View requests" key** (per the orchestrator): `/reports/requests` does not exist until slice 2, a link would 404. Slice 2 adds it with `requestsReportHref`. Recorded in tasks 2.1 and 2.10.
2. **Page, structure test and nav ordering** (2.10-2.12): not started, see the size stop. Note for the split: commit `da4dff3` adds the `/reports` nav entry before its page exists, so merging 1b-i alone would show coordination a dead link. Either 1b-i and 1b-ii ship together, or move the nav entry (and its sidebar, home and navigation tests) into 1b-ii.
3. `PeriodFilter` takes `selected: "all" | code` and does the extra-option insertion itself (task 2.8 listed it as behavior, not where); `action="/reports"` is explicit.
4. `RankingCard` renders the title as an `h2` inside `CardTitle` and names the `<ol>` with `aria-label`; the rank number is a visual `aria-hidden` span.
5. The sidebar and home tests now mock `next/link` with `linkDouble` from `review/test-support` so the `prefetch` prop is observable.
6. Two commits (work units A and B) instead of the single commit named in task 2.14; the third commit (page) is pending.
7. Spanish copy uses the informal "tú" and "periodo" without accent, matching `catalog.shared` and `enrollment`; the nav label is "Reportes" (the term used in `docs/requirements.md`).

### Remaining

2.10 (page.test.tsx), 2.11 (page.tsx), 2.12 (structure.test.ts), 2.13 [ASK OWNER], 2.14 gates and final commit; then Phase 3 (slice 2), Phase 4 (slice 3), Phase 5 (archive-time).

> Batch 2 note (added in Batch 3): the commits `da4dff3` and `b59eaf7` above were rewritten into the two stacked branches of Batch 3 (the old tip is kept at `backup/coordination-reports-1b`, 7fd1557). The Batch 2 evidence and deviations stay valid; the commit hashes and the "nav entry before its page" caveat (deviation 2) are superseded by Batch 3.

---

## Batch 3: Phase 2 slice 1b reorganized into 1b-i and 1b-ii, tasks 2.10-2.12 and 2.14 - DONE (2.13 pending owner)

Tasks 2.10, 2.11, 2.12 and 2.14 are `[x]`; 2.13 (`[ASK OWNER]` dev walk) stays open. Phases 3-5 pending.

### Branch reorganization (user-approved, nothing pushed)

Safety ref `backup/coordination-reports-1b` at 7fd1557. The old branch `feat/coordination-reports-1b-dashboard` is left in place for the orchestrator to remove. Goal: no PR leaves a dead nav link in `main`.

| Branch | Base | Commit | Message |
|--------|------|--------|---------|
| `feat/coordination-reports-1b-i` | `feat/coordination-reports-1a-ii` | `6b0be87` | `feat(reports): add the reports dashboard copy` (the `reports` namespace only, es and en, plus `reports-messages.test.ts` without the nav and shortcut cases) |
| | | `f9a3a96` | `feat(reports): add the ranking card and the period filter` (cherry-pick of `b59eaf7`, unchanged) |
| `feat/coordination-reports-1b-ii` | `feat/coordination-reports-1b-i` | `4e1a5fe` | `feat(reports): add the coordination dashboard page` (page, page test, structure test) |
| | | `37af974` | `feat(reports): add the reports navigation entry` (`navigation.ts`, `nav.reports`, `dashboard.shortcuts.reports`, sidebar, home, navigation and catalog-parity test updates, the nav case of the structure test) |

The page commit precedes the nav commit, so every commit on the stack is deployable: the nav link only appears once `/reports` exists.

### Measured size (`git diff --shortstat <base>..<branch> -- src i18n`)

| Slice | Changed lines | Production | Tests |
|-------|--------------:|-----------:|------:|
| 1b-i | 598 (7 files, +598) | 210 (`ranking-card` 77, `period-filter` 69, i18n 64) | 388 |
| 1b-ii | 1,032 (11 files, +1013 / -19) | 162 (`page.tsx` 144, `navigation.ts` 14, i18n 4) | 870 (`page.test` 455, `structure.test` 229, sidebar 102, navigation 38, home 29, messages 14, parity 3) |

1b-ii is over the 800 session budget; it is finished at a clean commit boundary and not split further (instruction). The overshoot is test volume (page test 31 cases, structure test 13).

### TDD Cycle Evidence (Batch 3)

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.10-2.11 | `src/app/(dashboard)/reports/page.test.tsx` | Component (real `dal`, mocked session, data layer and audit) | N/A (new) | import of `reports/page` not found (no tests ran) | 31/31 (first run 30/31: my own test asserted `/approved/i` absent but the page description legitimately says "approved and pending"; the assertion was wrong, not the page, and was removed) | 4 non-coordinacion roles, anonymous, flagged; none scope; degraded; no period; data with 2 students (CIF and none), 1 teacher, 1 subject; rank order kept; one empty ranking vs three empty rankings; period parsing x5 (none, invalid, repeated, all, code); `all` audited as `"all"`; absent code; extra fields never rendered; es; audit once, after load, load throws -> no row, audit rejects -> throws | Prettier layout only |
| 2.12 | `src/app/(dashboard)/reports/structure.test.ts` | Source scan | N/A (new) | Mutation RED: with a temporary `loading.tsx`, a temporary `<Link href="/reports">` without `prefetch={false}` and a temporary `recordReportDownload()` call, 3 guards failed (writer allow-list, link opt-out, no loading file); temporary files removed. The nav case was written first and failed (`entry` undefined) until the nav commit | 13/13 | link-tag reader and link classifier have their own positive and negative samples, so the link guard cannot pass on an empty set | None needed |
| nav (2.1-2.5) | covered by the Batch 2 evidence | Unit / component | n/a | n/a | re-applied from `da4dff3` into the 1b-ii nav commit; focused run 955/955 | n/a | n/a |

### Work Unit Evidence (Batch 3)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/i18n "src/app/(dashboard)/reports" src/components "src/app/(dashboard)/(home)" src/lib/navigation.test.ts` -> 42 files, 955 tests pass (nav commit); `npx vitest run "src/app/(dashboard)/reports"` -> 4 files, 64 tests pass (page commit) |
| Runtime harness | Pending: task 2.13 is `[ASK OWNER]` (opening `/reports` against Neon writes an audit row); `npm run dev` was not run. `npm run build` lists `/reports` as a dynamic route |
| Rollback boundary | 1b-ii: revert `37af974` (nav entry and copy) and/or `4e1a5fe` (delete `reports/page.tsx`, `page.test.tsx`, `structure.test.ts`); 1b-i: revert `f9a3a96` and `6b0be87` (card, filter, `reports` namespace) |

### Gates (1b-ii tip, before the docs commit; dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- 1b-i tip: `npm test` 278 files, 6,030 tests pass; `npm run typecheck` clean.
- 1b-ii tip: `npm test` 280 files, 6,096 tests pass on the first full run (the flaky `catalog/import/import-form.test.tsx` seen in Batch 2 did not fail this time).
- `npm run typecheck`: clean.
- `npx eslint` on every changed `.ts/.tsx`: only the known CRLF `prettier/prettier` "Delete CR" rows; no other rule fires.
- `prettier --check --end-of-line auto` on every changed file (including both `i18n` JSON): clean.
- `npm run build`: success; `/reports` is dynamic, `Proxy (Middleware)` unchanged.

### Deviations from design / tasks (Batch 3)

1. **Branch layout** differs from the task text (two branches `1b-i` and `1b-ii` instead of `1b-dashboard`), approved by the user; the slice table in `tasks.md` is updated.
2. **No dashboard to detail link** (carry-over): the design table (CR-8) and CR-DASH-1 list a "View requests" link, but `/reports/requests` does not exist until slice 2. The page has no link at all and the structure test pins that the three dashboard files do not mention `/reports/requests`; slice 2 adds the link, its key and `requestsReportHref`.
3. **Subjects show their code** as the muted second line next to the name (two subjects can share a name); CR-RANK-3 only requires name and count, so this is additive.
4. **Empty state is audited with the period `null`** and zero counts, as the task says; the empty state shows no period filter (there is nothing to choose).
5. **Task 2.14 single commit** became four work-unit commits over two branches plus this docs commit.
6. The structure test asserts "no `loading`/`layout`/`template`/`default` file" with a file scan instead of only `loading.tsx` and `layout.tsx`, to be stricter about prefetch boundaries.

### What a coordinator sees at `/reports` (for the 2.13 walk)

- Sidebar entry "Reportes" (es) / "Reports" (en) after the review entry, visible only to `coordinacion`; home shortcut "Reportes" first among the coordination shortcuts.
- Header with the title and description (counts only `aprobada` and `pendiente`), then the period `Select` (all periods, then periods newest first, default the newest) and the apply button, then three cards in a `lg:grid-cols-3` grid: Students (name, CIF, "N requests"), Teachers (name, "N classes"), Subjects (name, code, "N classes"), each at most 10 rows with a muted empty text.
- No career: an alert block, no filter, no cards, no audit row. Degraded read: one `role="status"` notice, no audit row. No data at all: the empty-state card, one audit row with zeros. Each successful open writes one `solicitud.ranking.consultado` row (entity `Carrera`).

### Remaining

2.13 `[ASK OWNER]` dev walk; then Phase 3 (slice 2, detail), Phase 4 (slice 3, workbook), Phase 5 (archive-time).

---

## Batch 4: Phase 3 slice 2 (detail page), split into 2-i and 2-ii, tasks 3.1-3.16 and 3.18 - DONE (3.17 pending owner)

Tasks 3.1-3.16 and 3.18 are `[x]`; 3.17 (`[ASK OWNER]` dev walk of `/reports/requests`) stays open, and so does Phase 4. Carry-over closed: task 2.13 is `[x]` (the owner walked `/reports` and approved it on 2026-10-31) and the slice table records 1b-ii as delivered at 1,032 lines (870 tests) as a size exception.

### Branches and commits (nothing pushed, no PR opened)

| Branch | Base | Commit | Message |
|--------|------|--------|---------|
| `feat/coordination-reports-2-i` | `feat/coordination-reports-1b-ii` (66cc6f0) | `fe9c5f1` | `feat(reports): add the detail filters to the report params and where-builder` (3.3-3.6) |
| | | `f4aad0d` | `feat(reports): add the request detail reads` (3.7-3.8) |
| | | `31cb570` | `feat(reports): add the request detail audit event` (3.9-3.10) |
| | | `6cef2c3` | `docs(coordination-reports): record the slice 2 split and the 2-i progress` |
| `feat/coordination-reports-2-ii` | `feat/coordination-reports-2-i` | `9e2f711` | `fix(navigation): keep the section back link from prefetching audited pages` (3.1-3.2) |
| | | `792c598` | `feat(reports): add the request detail copy` (3.11) |
| | | `8bbc1ba` | `feat(reports): add the request filters and table` (3.12-3.13) |
| | | `fe5bf6a` | `feat(ui): let the empty state opt its clear link out of prefetch` |
| | | `ae254ad` | `feat(reports): add the filterable request detail page` (3.14-3.16) |
| | | `6f1c04b` | `feat(reports): link the dashboard to the request detail` |
| | | (this docs commit) | `docs(coordination-reports): record the slice 2 apply progress` |

Every commit passes its own focused tests and typechecks; the full suite was run on the 2-i code tip and on the 2-ii code tip. Every prefix is deployable: 2-i is all `src/lib` (no route imports it); in 2-ii the trail fix, the copy and the presentational components are inert, the page commit adds `/reports/requests` with no link to it, and only the last commit links the dashboard to it.

### Measured size (`git diff --shortstat <base>..<branch> -- src i18n`)

| Branch | Changed lines | Production | Tests |
|--------|--------------:|-----------:|------:|
| 2-i | 1,238 (12 files, +1212 / -26) | 449 | 789 |
| 2-ii | 2,004 (18 files, +1973 / -31) | 699 | 1,305 |
| Slice 2 total | 3,242 | 1,148 | 2,094 |

Both are over the 800 session budget (forecast was ~550 for the whole slice; tests ran 1.8x production). Finished at a clean commit boundary and not split further (instruction). Per commit (total / prod / tests): `fe9c5f1` 399/132/267, `f4aad0d` 608/233/375, `31cb570` 231/84/147, `9e2f711` 98/24/74, `792c598` 125/66/59, `8bbc1ba` 788/344/444, `fe5bf6a` 44/8/36, `ae254ad` 874/236/638, `6f1c04b` 79/25/54. If the owner wants 2-ii cut, the clean boundary is after `8bbc1ba` and `fe5bf6a` (inert parts) versus `ae254ad` and `6f1c04b` (the page and the link).

### TDD Cycle Evidence (Batch 4)

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.3-3.4 | `src/lib/reports/params.test.ts` | Unit | 170/170 (reports, report-data, audit) | 32 failed (`detailPeriod`, `requestsReportHref` missing, new fields undefined) | 56/56 | docente: 3 valid + 10 invalid forms; causa: 3 valid + 5 invalid; q cap/blank/array; page; detailPeriod x2; href: empty, full, page 1, round trip | None needed |
| 3.5-3.6 | `src/lib/data/report-scope-sql.test.ts` | Unit (toSQL) | 12/12 | 5 failed | 21/21 | period+teacher in one EXISTS, teacher alone, none, term name OR CIF with escaped wildcards, empty term, cause alone, `none` scope | One test assertion fixed: the escaped LIKE pattern (`%50\%\_x%`) |
| 3.7-3.8 | `src/lib/data/report-requests.test.ts` | Unit (toSQL + db double) | N/A (new) | import not found | 23/23 (first run 8 failed: my own test scripted `{count}` while the query selects `total`, then one assertion expected qualified columns on a single-table select; both were test errors) | count without joins, visible states, order/limit/offset, batched classes, in-scope teachers, 3 requests / 7 pairs -> 3, clamp up and down, zero total, foreign teacher, fail-soft x5 positions | Typed `ReportRequestsView` with `Omit` (tsc) |
| 3.9-3.10 | `src/lib/audit/{events,types}.test.ts`, `src/lib/data/report-reads.test.ts` | Unit | 186/186 | 7 failed | 186/186 + tsc | builder, key set, unfiltered shape; writer: one transaction, boolean search never the term, cache dedupe, other args write again, insert failure | Types for the new payload |
| 3.1-3.2 | `src/lib/navigation.test.ts`, `src/components/page-context.test.tsx` | Unit + component | 94 (99 with the new cases) | 7 failed | 99/99 | 4 audited trails carry `prefetch:false`, 5 plain trails carry no key; back link `/review/42`, `/reports/requests` false, `/users/new`, `/requests/42` default | None needed |
| 3.11 | `src/i18n/reports-messages.test.ts` | Unit | 16/16 | 4 failed (+2 for `degraded`) | 20/20, `src/i18n` 325/325 | es/en key parity, coverage list, date range es and en | None needed |
| 3.12 | `reports/requests/request-filters.test.tsx` | Component + axe | N/A (new) | module not found | 12/12 | GET form, labels, defaults, chosen values, period/teacher/cause options, absent period, foreign teacher, clear link prefetch | None needed |
| 3.13 | `reports/requests/requests-table.test.tsx` | Component + axe | N/A (new) | module not found | 9/9 | 7 headers, 2 rows, 3 classes in one cell, scroll container, axe; pagination: middle, first, last, landmark | `key` of class lines includes the index (duplicate lines) |
| (UI) | `src/components/empty-state.test.tsx` | Component | 8/8 | 1 failed | 10/10 | `prefetch:false` opt-out and the default | None needed |
| 3.14-3.15 | `reports/requests/page.test.tsx` | Component (real `dal`, mocked session, data and audit) | N/A (new) | module not found | 34/34 | 4 roles denied, anonymous, flagged, none scope, degraded, rows, time zone (03:00Z -> 5 Mar), several classes, total vs page, singular, es, filters x7, foreign teacher, no-results, paging x4, audit x5 | Mutation check: BUSINESS_TIME_ZONE=UTC and `q !== ""` -> `false` made 2 cases fail; reverted |
| 3.16 | `reports/structure.test.ts` | Source scan | 13/13 | Mutation RED: temporary `loading.tsx`, an unguarded `<Link href="/reports/requests">`, a second writer call in the dashboard and in the detail page made 4 guards fail; files removed | 16/16 | detail writer allow-list, once and after the load, no client triggers on both pages | None needed |
| (link) | `reports/page.test.tsx`, `structure.test.ts` | Component + source scan | 123/123 | 4 failed (link absent) | 125/125 | link for a code, `all`, the URL period; no link for none, degraded, empty | `periodo` narrowed directly instead of through `selected` |

### Work Unit Evidence (Batch 4)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run "src/app/(dashboard)/reports" src/lib/reports src/lib/data/report- src/lib/audit src/lib/navigation.test.ts src/components src/i18n` -> all pass (final full run: 284 files, 6,239 tests) |
| Runtime harness | Pending: task 3.17 is `[ASK OWNER]` (opening `/reports/requests` against Neon writes an audit row); `npm run dev` was not run and no command wrote to the database. `npm run build` lists `/reports/requests` as a dynamic route |
| Rollback boundary | 2-ii: revert `6f1c04b` (dashboard link), `ae254ad` (delete `reports/requests/page.tsx` and its test, structure test extension), `fe5bf6a`, `8bbc1ba`, `792c598`, `9e2f711`; 2-i: revert `31cb570`, `f4aad0d`, `fe9c5f1` (written audit rows stay) |

### Gates (2-ii tip, dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 284 files, 6,239 tests, all pass (2-i code tip: 281 files, 6,168 tests). The owner's uncommitted `app-sidebar.tsx` edit was in the working tree for every run and caused no failure.
- Flaky, unrelated: in a wider focused run (`src/app` + `src/components`, run in the background) `src/app/api/cron/intake-sweep/route.test.ts` "answers 500 with a generic body when the whole sweep fails" failed once and passed alone and in both full runs; it is an untouched file.
- `npm run typecheck`: clean.
- ESLint on the 28 changed `.ts/.tsx` files: only the known CRLF `prettier/prettier` "Delete CR" rows (2,702, all of that kind); no other rule fires.
- `prettier --check --end-of-line auto` on all 30 changed files (including both `i18n` JSON): clean.
- `npm run build`: success; `/reports` and `/reports/requests` are dynamic.

### Deviations from design / tasks (Batch 4)

1. **Two branches, `2-i` and `2-ii`** instead of `2-detail` (instruction); the slice table and Phase 3 note are updated.
2. **`loadReportRequests`** (not in the design file table) is the fail-soft aggregator for the page: count, page, classes, periods and teachers in one `try`; the three `list*` reads stay as named in the tasks.
3. **`parseReportParams` returns all five params for the dashboard too** (one parser, as CR-6 says); the dashboard ignores the extra fields. `detailPeriod` maps the dashboard default `latest` to every period on the detail (CR-DET-2).
4. **No separate "back link" copy key and no body back link**: the top-bar trail already links back to `/reports` (now with `prefetch={false}`).
5. **Two extra keys** the page needs: `reports.detail.degraded` and `reports.detail.filters.teacherOutside`. A teacher id outside the career shows generic text and zero rows, never a name.
6. **Shared `EmptyState` gained an optional `prefetch: false`** on its clear link (own commit): the design said every link to an audited report page opts out of prefetch and the no-results state is the only place a shared component links to it. The structure test cannot see that link (it lives in `src/components`), so the page test pins it.
7. **Own `RequestsPagination`** (previous, status, next) instead of the shared `TablePagination`, whose links prefetch and need the list-navigation provider.
8. **"All" select values are the literal `all`** for period, teacher and cause; the URL therefore carries `docente=all` and `causa=all` after a submit, which the parser reads as no filter.
9. **The audit `periodo` for the detail is `"all"` or the code** (never null, because the detail has no empty-period state) and the audit total for a no-results open is 0.
10. **Search guard in `report-reads.test.ts`** no longer bans the word `busqueda` (the writer now takes the boolean) but still bans `parseQ`, `searchParams` and `termino`.
11. **Size**: both branches are over 800 (see above).

### What a coordinator sees at `/reports/requests` (for the 3.17 walk)

- Entry point: the new **View requests** outline button in the `/reports` header (carries the period shown); the sidebar keeps Reports active, and the top-bar trail shows "Reports" as a link back (no prefetch).
- Header "Justification requests" with its description, then a four-field filter form (academic period, teacher, student by name or CIF, cause) with **Apply filters** and a **Clear filters** link; period defaults to **all periods** (no hidden default).
- A table card with the count ("N requests", the total, not the page) and one row per request: student, CIF, cause, state in words, absence dates, submission date (America/Managua) and the classes in one cell, each line "subject . teacher . period". 25 rows per page; Previous/Next links keep the period and every filter.
- No match: the no-results card ("No request matches the filters") with a clear link; a teacher id from another career shows "Teacher outside your career" and zero rows. Degraded read: one status notice. No career: the same alert block as the dashboard.
- Each successful open (including a no-results open) writes one `solicitud.reporte.consultado` row on the career: period, teacher id, cause, whether a search was typed, and the total; never the typed term.

### Remaining

3.17 `[ASK OWNER]` dev walk of `/reports/requests`; then Phase 4 (slice 3, workbook) and Phase 5 (archive-time).

---

## Batch 5: Phase 4 slice 3 (workbook download), tasks 4.1-4.11 and 4.13, plus the 3.17 carry-over - DONE (4.12 pending owner)

Tasks 4.1-4.11 and 4.13 are `[x]`; 4.12 (`[ASK OWNER]` real download) stays open. Carry-over closed: task 3.17 is `[x]` (the owner walked `/reports/requests` on 2026-10-31 and approved it after commit `34e40bb`). Phase 5 (archive-time) is not started.

### Carry-over: commit `34e40bb` (outside the task list)

`34e40bb fix(reports): fit the request detail table without side scrolling` was made by the owner's request during the 3.17 walk: the detail table was compacted so it fits without horizontal scrolling. It has no task of its own; it is part of 2-ii and was approved together with the page. No code of this batch touches it.

### Branch and commits (nothing pushed, no PR opened)

Branch `feat/coordination-reports-3-export`, created from `feat/coordination-reports-2-ii` (tip `34e40bb`). The owner's uncommitted edit of `src/components/app-sidebar.tsx` (the commented-out `SidebarGroupLabel`) was never touched, staged or committed; every commit was staged by explicit path.

| Hash | Message | Tasks | Prod / tests |
|------|---------|-------|--------------|
| `b772548` | `feat(reports): add the export href and the unpaged export read` | 4.1, 4.2 | 73 / 167 |
| `48cc4ff` | `feat(reports): add the workbook download audit event` | 4.3 | 72 / 122 |
| `087a486` | `feat(reports): add the workbook builder and its copy` | 4.4-4.6 | 137 / 373 |
| `f2ea790` | `test(reports): anchor the export no-limit assertion` | fix of a test in `b772548` (see Issues) | 0 / 8 |
| `3cc16c7` | `feat(reports): add the justification workbook download route` | 4.7, 4.8, 4.11 (route part) | 192 / 631 |
| `e7ffb5f` | `test(reports): prove the screen and the workbook share their total` | 4.9 | 0 / 250 |
| `c0b0706` | `feat(reports): add the workbook download control to the request detail` | 4.10, 4.11 (anchor part) | 28 / 95 |
| (this docs commit) | `docs(coordination-reports): record the slice 3 apply progress` | tasks and progress | n/a |

Every commit typechecks and passes its own focused tests. Every prefix is deployable: the first three commits are inert (no route imports them), `3cc16c7` adds a guarded route nobody links to, and only the last commit exposes the download control.

### Measured size (`git diff --shortstat feat/coordination-reports-2-ii..HEAD -- src i18n`)

22 files, +2110 / -36 = **2,146 changed lines (502 production, 1,644 tests)**. Over the 800 session budget (forecast ~450; tests ran 3.3x production, more than the 1.7-2.5x of earlier slices because the route test is 540 lines in 33 cases, the builder test 380 and the parity test 250). Finished at a clean commit boundary and not split further (instruction). If the owner wants a cut, the clean boundary is after `087a486` (inert) versus `3cc16c7`, `e7ffb5f` and `c0b0706`.

### TDD Cycle Evidence (Batch 5)

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `src/lib/reports/params.test.ts` | Unit | 46/46 | 4 failed (`exportHref` missing) | 50/50 | all-period, code, every filter, empties, no page, same query string as the detail link, round trip through the parser | `requestsReportHref` and `exportHref` share `filterParams` |
| 4.2 | `src/lib/data/report-requests.test.ts` | Unit (toSQL + db double) | 23/23 | 12 failed (`requestsExportQuery`, `listReportExport` missing) | 35/35 | where equals the count where for 5 filter sets, visible states only, no LIMIT/OFFSET, same columns and order as the page query, 30 rows (more than a page) with ONE class batch, zero rows (1 statement), 2 failure positions | `requestsPageQuery` rebuilt on the shared ordered query (the 23 earlier cases are the approval net) |
| 4.3 | `src/lib/audit/{events,types}.test.ts`, `src/lib/data/report-reads.test.ts` | Unit | 114 (121 minus the 7 new cases) | 5 failed | 121/121 + tsc | builder, same payload shape as the detail event, term never present, unfiltered shape; writer: one transaction, two identical calls write two rows, boolean search, insert failure | `reportReadEvent` shared by the two builders |
| 4.4 | `src/i18n/reports-messages.test.ts` | Unit | 20/20 | 4 failed | 24/24, `src/i18n` 329/329 | es/en key parity (existing), six keys in both locales, file name without extension or separator | None needed |
| 4.5-4.6 | `src/lib/reports/build-workbook.test.ts` | Unit (ExcelJS read-back) | N/A (new) | module not found | 17/17 | sheet order and names en/es, headers en/es, 3 rows in order, 3 classes in one cell, none, summary en and es, number total, empty input, 5 formula-like names, every text column, the typed term in the summary, numeric-looking text | Mutation: a builder writing `{ formula }` for `=` names fails 2 cases; reverted |
| 4.7-4.8 | `src/app/api/reports/justifications/route.test.ts` | Route (real `dal` and `getUserLocale`, real builder; session, scope, reads and audit doubled) | N/A (new) | module not found | 33/33 | 4 denied roles, anonymous, flagged, `none`; headers; 4 filter shapes; audit once and in order, `all`, term never passed, two downloads two rows; audit/read/build failures; log without the message; en row content, several classes, formula-like names as text, summary with and without filters, foreign teacher, empty download; es, en, no cookie, `fr`, empty cookie | Mutations: hard-coded `es` fails 6 cases; an un-awaited audit write fails the audit-gate case; both reverted |
| 4.9 | `src/app/api/reports/justifications/parity.test.tsx` | Route + page (real page, real route, scripted db) | 33/33 route, 36/36 requests | passes on first run by design (it asserts the wiring of already-built pieces); non-vacuity proven by mutation | 9/9 | 7 filter sets (60, 12, 25, 26, 51, 24, 0 matches), more rows in the file than one page shows, parameters differ when filters differ | Mutation: the route dropping `causa` fails 4 cases; reverted. Lint fixes (`use` renamed, JSX) before commit |
| 4.10 | `src/app/(dashboard)/reports/requests/page.test.tsx` | Component | 34/34 | 5 failed (the 2 hidden-state cases pass vacuously until implemented) | 41/41 | resolved filters, `period=all`, no page, zero rows, es, degraded, `none` | None needed |
| 4.11 | `src/app/(dashboard)/reports/structure.test.ts` | Source scan | 16/16 | Mutation RED: swapping the anchor for a `<Link>` fails 3 guards; reverted | 22/22 | writer allow-list, once and in order, guard order, GET only with `no-store`, `exportHref` users, no `<Link>` at the file | None needed |

### Work Unit Evidence (Batch 5)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/app/api/reports src/lib/reports src/lib/data/report- src/lib/audit src/i18n "src/app/(dashboard)/reports"` -> all pass; final full run: 287 files, 6,340 tests |
| Runtime harness | `npm run build` lists `/api/reports/justifications` as a dynamic route; `next start` (dummy `DATABASE_URL`, no database reached) answered an anonymous GET with `307 /login`, so the route bundle loads in the real runtime. Task 4.12 is `[ASK OWNER]` (a real download writes an audit row): `npm run dev` was not run and no command wrote to the database |
| Rollback boundary | Revert `c0b0706` (download control), `e7ffb5f` and `3cc16c7` (parity test; route, `src/i18n/messages.ts`, structure extension), `087a486` (workbook builder, copy), `48cc4ff` (event and writer), `f2ea790` and `b772548` (href, export read). Written audit rows stay |

### Gates (tip `c0b0706`, dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 287 files, 6,340 tests, all pass on the first full run (2-ii tip: 284 / 6,239). The owner's uncommitted `app-sidebar.tsx` edit was in the working tree and caused no failure. No flaky test appeared in this batch.
- `npm run typecheck`: clean.
- ESLint on the 20 changed `.ts/.tsx` files: 0 messages (the files written in this batch are LF).
- `prettier --check --end-of-line auto` on every changed file (including both `i18n` JSON): clean.
- `npm run build`: success; `/api/reports/justifications` is dynamic.

### Open question 1 (design): the locale in a route handler - settled by test 4.7

`cookies()` is readable in a Route Handler (Next 16 docs, `cookies.md`), so the route reads the `NEXT_LOCALE` cookie through the app's own `getUserLocale()` and builds its translators with `createTranslator` from the catalog (`loadMessages`, new `src/i18n/messages.ts`, the same dynamic import `request.ts` uses). It does not use `getTranslations`, so it does not depend on the next-intl request scope. The route test drives the real `getUserLocale` over a mocked `cookies()` with the real catalogs: `es` and `en` give Spanish and English sheets, headers, summary and file name; an absent cookie, `fr` and an empty value fall back to `es`. A unit test cannot prove Next's production request context; the authenticated path is task 4.12.

### Deviations from design / tasks (Batch 5)

1. **Translator** is `createTranslator` over `getUserLocale()` + `loadMessages`, not `getTranslations` (see above); `src/i18n/messages.ts` is a new file not in the design table.
2. **Parity test** is `parity.test.tsx`, not `.ts`, because it renders the real detail page; it runs the real page and the real route against a scripted database (the db double does not execute SQL, so the equality that carries weight is the compiled WHERE of both statements, plus the three totals). The optional integration test was not written.
3. **Dates in the workbook** are ISO text (`YYYY-MM-DD`; the submission date is the calendar day in `America/Managua`; the absence range reuses `reports.detail.dates` with ISO dates) instead of the screen's "medium" format: unambiguous and sortable in a spreadsheet. The CR-DET-1 columns and their order are the screen's.
4. **Summary teacher name**: the summary shows the teacher's name, which needs `listReportDocentes(scope)`; it is read only when a teacher filter is set. A teacher id outside the career shows the generic "Teacher outside your career", never a looked-up name. The audit row keeps the id only.
5. **File name** is a catalog key (`reports.export.fileName`: `ReporteJustificaciones` / `JustificationsReport`) so it is not hard-coded Spanish for English users.
6. **Failure response** is `500 {"error":"export_failed"}` with `no-store`, like the cron route; `listReportExport` is not fail-soft. The log line carries the error name only (a database error can quote the typed search term). Failing to resolve the scope (a database error) is not caught: Next answers its generic 500, consistent with `resolveReportScope` failing loud.
7. **The `none` scope redirects to `/denied`** (spec: "`none` scope redirects"), rather than rendering a block, since a file route has no page to render.
8. **Design `Boundary rule`**: `build-workbook.ts` lives in `src/lib/reports/` and imports only `exceljs`, so the framework-free scan of `report-reads.test.ts` covers it.
9. **Size**: 2,146 lines, over 800 (see above).

### Issues found

- **Control character in a committed test (fixed in `f2ea790`).** While writing the structure test, a Python escape (`\b` typed with a single backslash) turned a regex word boundary into a backspace character. The same slip had silently reached `b772548`: the "has no LIMIT and no OFFSET" assertion used a regex containing control characters, so it could not match anything and passed vacuously. It was found by scanning the changed files for control characters, fixed, and given a triangulation case (the paged query must match the same pattern) in `f2ea790`. The rest of the branch was scanned clean.
- **Amended once:** `e7ffb5f` was amended before any other commit existed on top of it, to fix two lint errors and a type error found by the gate after the first commit (a helper named `use`, and `createElement` without children); nothing else was rewritten.
- **Known limit, not fixed:** the classes of the whole export are read in one `IN (...)` batch with one bind parameter per request. Postgres allows 65,535 bind parameters per statement, so a career with more than about 65,000 matching requests would fail with a 500 instead of a file. That is far above pilot volume; it belongs with the open question "export has no row cap" and would be solved with chunked batches or a subquery.
- **Residual spreadsheet risk, documented:** a name such as `=1+1` is stored as a string cell, so Excel does not evaluate it on open (proved by reading the written file back). Excel would still turn it into a formula if a user edits that cell and presses Enter; ExcelJS 4.4 has no `quotePrefix` style to prevent that. Accepted; the owner decides if a visible prefix is wanted.

### What the owner should check in the downloaded file (task 4.12)

1. Open `/reports/requests` as a coordinator: the **Download Excel** (Spanish: **Descargar Excel**) button is in the page header, next to the title, with and without filters, also when nothing matches, and absent when the read is degraded.
2. Click it with a filter set (for example a period and a cause): a file named `ReporteJustificaciones.xlsx` (English: `JustificationsReport.xlsx`) downloads and the page does not navigate.
3. The first sheet (Solicitudes / Requests) has the header row in bold and frozen, the seven columns of the screen, and **one row per request across all pages**: its row count (minus the header) must equal the screen's "N solicitudes" total, even when the screen has several pages.
4. Dates read `YYYY-MM-DD` (the submission day is the business-zone day); the classes of a request are in one wrapped cell, one line each ("Subject · Teacher · Period").
5. The second sheet (Resumen / Summary) lists the period, teacher (by name), student term, cause, and **Total** as a number equal to the screen total; unset filters read "All ...".
6. A student whose name begins with `=`, `+`, `-` or `@`, if any exists, shows as plain text in the cell and is not calculated.
7. Audit (read-only query on `EventoAuditoria`): exactly one `solicitud.reporte.descargado` row per click, on entity `Carrera`, with `periodo`, `docenteId`, `causa`, `busqueda` (boolean) and `total` (the file's rows), and no search text; opening the page still writes its own `solicitud.reporte.consultado` row. Hovering or loading the page must not write a download row.
8. Switch the language and download again: the sheet names, headers and summary labels follow the language cookie (Spanish when unset).

### Remaining

4.12 `[ASK OWNER]` real download; then Phase 5 (archive-time), after verify.

## Task 4.12: real download (2026-11-18)

Run on `main` b82b359 (`next build` + `next start`, port 3001) against a disposable Neon branch `rf13-medicion` (child of `dev-arnia`, deleted afterwards). Before the run, the 11 accounts with real team names or addresses were renamed to fictitious ones on that branch only. Account: the coordinator of Ingeniería de Sistemas. Owner approval was given through Armando.

| Case | Filters | Screen total | Data rows | Summary total | Download audit rows |
| --- | --- | --- | --- | --- | --- |
| base | all periods | 101 | 101 | 101 | 1 |
| period | 2026-S2 | 66 | 66 | 66 | 1 |
| teacher | all periods, one teacher | 21 | 21 | 21 | 1 |
| student | all periods, `q` = one CIF | 11 | 11 | 11 | 1 |
| cause | all periods, medical | 50 | 50 | 50 | 1 |
| combined | 2026-S2, medical | 32 | 32 | 32 | 1 |

Checklist above: (1) the control is in the page header; (2) `ReporteJustificaciones.xlsx` downloads without navigating; (3) the header row is bold and frozen (`ySplit` 1), seven columns, one row per request across pages (101 rows over several screen pages); (4) dates read `YYYY-MM-DD` and the classes are one cell, one line each; (5) the summary sheet lists period, teacher, student, cause and the numeric total; (7) one download row per click, counted before and after each click. In each filtered case every row matched the filter (teacher name in the classes cell, CIF, cause), and every row of the 2026-S2 case has at least one class of that period.

Not checked: (6) no student name starts with `=`, `+`, `-` or `@` in the data; (7) the audit row's entity and fields; (8) the English download. The files were read back with ExcelJS, not opened in Excel or LibreOffice.
