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
