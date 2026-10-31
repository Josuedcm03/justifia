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

### Remaining

Phase 2 (1b), Phase 3 (slice 2), Phase 4 (slice 3), Phase 5 (archive-time).
