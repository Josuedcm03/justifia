# Tasks: Coordination Reports

> Strict TDD (vitest): every behavior task is a RED task (failing test) followed by its GREEN task; tests are colocated. Focused command: `npx vitest run <paths>`. Gates per slice: `npm test`, `npm run typecheck`, `npx eslint src` (filter CRLF noise: `| rg -v 'Delete .␍.'`), `npm run format:check` (CRLF: `--end-of-line auto`), `npm run build`. Run `npm test` and `npm run build` with a dummy `DATABASE_URL` (`postgres://u:p@127.0.0.1:9/x`) so no database is targeted.
> DB rule (`CLAUDE.md`): no schema change, no migration. No task runs `drizzle-kit migrate`, `drizzle-kit push`, `db:seed` or write SQL. Tasks tagged `[ASK OWNER]` need the owner's explicit "yes" for that single command: opening an audited page against Neon writes an audit row, so every `npm run dev` walk is `[ASK OWNER]`. Unit tests never touch Neon.
> Spec IDs: RF-17 (a-e), RF-13 (a, b, d), RN-16, RNF-01, RNF-06; CR-* in `specs/coordination-reports`, plus the `audit-log` and `backoffice-shell` deltas. Decisions CR-1..CR-12 refer to `design.md`.
> Skills for apply (registry `.atl/skill-registry.md`): `C:\Users\HP VICTUS\.claude\skills\chained-pr\SKILL.md`, `C:\Users\HP VICTUS\.claude\skills\work-unit-commits\SKILL.md`. One commit per work unit (test + code together); Conventional Commits, no AI attribution.
> Threat matrix: N/A in full (design: no VCS, PR or file-execution surface). The new HTTP routes are authorization boundaries, covered by the role-matrix RED tasks 1.2, 3.x and 4.7.
> Size note: the `sdd-tasks` cap (530 words) is exceeded on purpose; the repository precedent (`document-extraction`, `teacher-remission`) keeps one line per task with spec links.
> Boundary rule (design): everything under `src/lib/**` is slice 1a (inert, no route imports it); anything importing `next/*`, React components or `i18n/` is slice 1b or later. Exception: `report-reads.ts` imports `cache` from `react`, like `request-reads.ts` (task 1.19 pins it).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,880 authored total (prod + tests): 1a ~500, 1b ~380, 2 ~550, 3 ~450; `openspec/` excluded |
| 400-line budget risk | High (aggregate; 1a, 2 and 3 each exceed 400) |
| 800-line budget risk (session `review_budget_lines`) | Low-Medium per PR: largest slice ~550. Precedent: `document-extraction` slices came in at 2-3x their forecast, so 1a and 2 can reach 800 |
| Chained PRs recommended | Yes |
| Suggested split | 1a data + audit -> 1b dashboard + nav + i18n -> 2 detail -> 3 xlsx (user-confirmed, binding) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main (user, 2026-10-30) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
800-line budget risk: Medium

**Not blocking apply, but the chain strategy MUST be recorded (task 0.2) before the first PR is opened**, because the PR bases differ. If any slice's authored diff passes 800 during apply, STOP and report; fallback for 1a is two commits groups already marked below (1a-i tasks 1.1-1.11, 1a-ii tasks 1.12-1.21), for slice 2 split table/filters from the page.

| Slice | Branch | Content | Authored lines | Base: stacked-to-main | Base: feature-branch-chain |
|-------|--------|---------|---------------:|-----------------------|----------------------------|
| Docs | tracker `feat/coordination-reports` | SDD planning documents | n/a | main | tracker (draft, no-merge) |
| 1a | `feat/coordination-reports-1a-data` | permissions, scope, params (period), constants, report-scope(-sql), rankings, dashboard event, `report-reads` | ~500 | main | tracker |
| 1b | `feat/coordination-reports-1b-dashboard` | `/reports` page, `RankingCard`, `PeriodFilter`, structure test, nav entry, i18n | ~380 | 1a branch, retarget to main after 1a merges | 1a branch |
| 2 | `feat/coordination-reports-2-detail` | filters in the builder, `report-requests`, `/reports/requests`, detail event, `NavTrail` prefetch, i18n | ~550 | 1b branch, then main | 1b branch |
| 3 | `feat/coordination-reports-3-export` | `build-workbook`, route, download event, parity test, download link, i18n | ~450 | 2 branch, then main | 2 branch |

Chain: while a parent is open, the child targets the parent branch (clean diff); on stacked-to-main it is retargeted to `main` after the parent merges, on feature-branch-chain only the tracker merges to `main`. 1a is inert (no route imports it), 1b is the first user-visible slice, nothing needs a migration, so any prefix of the chain is deployable.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1a | Scope, params, where-builder, rankings, dashboard audit event | 1a | `npx vitest run src/lib/auth/permissions.test.ts src/lib/reports src/lib/data/report- src/lib/audit` | N/A: inert code, no route imports it; SQL checked with `toSQL()` | Delete `src/lib/reports/**`, `report-*.ts`; revert `permissions.ts`, `audit/{types,events}.ts` |
| 1b | `/reports` page, nav entry, i18n | 1b | `npx vitest run "src/app/(dashboard)/reports" src/lib/navigation.test.ts src/components src/i18n` | `[ASK OWNER]` `npm run dev` coordinator walk (writes one audit row) | Delete `reports/**` page files; revert `navigation.ts`, i18n keys |
| 2 | `/reports/requests` detail, filters, trail fix | 2 | `npx vitest run "src/app/(dashboard)/reports/requests" src/lib/data/report-requests.test.ts src/components/page-context.test.tsx` | `[ASK OWNER]` dev walk with filters (writes one audit row) | Delete `reports/requests/**`, `report-requests.ts`; revert builder filters, `NavTrail` prefetch, keys |
| 3 | xlsx route + workbook, parity | 3 | `npx vitest run src/app/api/reports src/lib/reports/build-workbook.test.ts` | `[ASK OWNER]` real download in dev; open the file in Excel/LibreOffice | Delete route + `build-workbook.ts`; revert download event and link |

## Phase 0: Planning docs and chain decision (before 1a)

- [x] 0.1 On tracker `feat/coordination-reports`: run `git diff docs/requirements.md docs/roadmap.md`, confirm the pending edits belong to this change, stage them with `openspec/changes/coordination-reports/` and commit `docs(coordination-reports): add the SDD planning documents`.
- [x] 0.2 Chain strategy recorded: stacked-to-main (user, 2026-10-30). Each PR targets the previous slice branch; 1a targets `main`.
- [x] 0.3 [READ-ONLY] Re-read `node_modules/next/dist/docs/` `link.md` (`prefetch`) and `route.md` (findings N2, N3) and confirm `ChartColumn` is exported by the installed `lucide-react`; note any drift here before 1b. Result (2026-10-30): `Link` `prefetch={false}` never prefetches on viewport or hover (App Router `link.md`); GET route handlers are dynamic by default since v15 (`route.md`); `ChartColumn` is declared by the installed `lucide-react` 1.42; drift: the repo still guards with root `middleware.ts` while the Next 16 docs name the file convention `proxy`, which does not change the design (the export route guards itself, N3).

## Phase 1: Slice 1a - Data and audit (work unit 1a, `src/lib` only)

1a-i: access, scope, params, where-builder.

- [x] 1.1 Branch `feat/coordination-reports-1a-data` per 0.2. RED: `src/lib/auth/permissions.test.ts` table: `canViewReports` true only for `coordinacion`, false for `administrador`, `secretaria`, `docente`, `estudiante` (CR-ACC-1 matrix).
- [x] 1.2 GREEN: `src/lib/auth/permissions.ts` adds `rolesQueVenReportes = ["coordinacion"]` and `canViewReports(rol)`; no other role check anywhere.
- [x] 1.3 RED: `src/lib/reports/constants.test.ts` + `scope.test.ts`: `RANKING_LIMIT` 10, `RANKING_STATES` exactly `aprobada`, `pendiente` and a subset of `VISIBLE_STATES`, `REPORT_PAGE_SIZE` 25; `reportScopeFor` role x carrera table (coordinacion + id -> `carrera`; coordinacion + null or `actor === null` -> `none`; every other role -> `none`) (CR-ACC-1, CR-SCOPE-1; scenario "Coordination without a career").
- [x] 1.4 GREEN: `src/lib/reports/constants.ts`, `src/lib/reports/scope.ts` (`ReportScope`, pure, fail-closed, mirrors `catalogScopeFor`).
- [x] 1.5 RED: `src/lib/reports/params.test.ts` period only: `period=all` -> `all`; `2026-S1` -> code; `2026-S9`, `2026-s1`, empty, array, junk -> `latest`; `reportsHref(period)` emits `period=<code>|all` (CR-6; scenario "All periods and invalid value").
- [x] 1.6 GREEN: `src/lib/reports/params.ts` (`PeriodFilter`, period branch of `parseReportParams`, `reportsHref`) reusing `PERIODO_RE` from `src/lib/import/normalize.ts`.
- [x] 1.7 RED: `src/lib/data/report-scope-sql.test.ts` via `new QueryBuilder().toSQL()` (pattern of `request-scope-sql.test.ts`): `reportInScope(carrera)` is `EXISTS` on `Usuario e` with `e.CarreraId = $c`; `none` -> `false`; unknown kind throws; `buildReportWhere` has scope as the first term, `inArray(Estado, states)`, one `EXISTS` for `classFilter` only when `periodo` is set, none when null (CR-2, CR-3; scenario "Other career invisible").
- [x] 1.8 GREEN: `src/lib/data/report-scope-sql.ts` (`reportInScope`, `classFilter(periodo, docenteId?)`, `buildReportWhere`); the only place a `ReportScope` becomes SQL.
- [x] 1.9 RED: `src/lib/data/report-scope.test.ts` (db double): `resolveReportScope` returns `none` with no read for non-`coordinacion`; reads `Usuario.CarreraId` for `coordinacion`; missing user -> `none`; a thrown read propagates (fail loud); never cached.
- [x] 1.10 GREEN: `src/lib/data/report-scope.ts` (`server-only`).
- [x] 1.11 Commit unit 1a-i: `feat(reports): add the report scope, period params and where-builder`.

1a-ii: rankings, loader, audit.

- [ ] 1.12 RED: `src/lib/data/report-rankings.test.ts` SQL: students `GROUP BY u.Id, NombreCompleto, Cif`; teachers `GROUP BY d.Id` over `Grupo.DocenteId`; classes `GROUP BY a.Id, Codigo, Nombre`; all `ORDER BY total DESC, name ASC, id ASC LIMIT 10`; states = `RANKING_STATES`; pair rankings add `g.Periodo = $p` on the joined group; aliases never collide with `e`; `listReportPeriods` is `DISTINCT g.Periodo ... ORDER BY DESC`, filtered by `PERIODO_RE`, uses `VISIBLE_STATES` (CR-4, CR-5; CR-RANK-1..3).
- [ ] 1.13 GREEN: `src/lib/data/report-rankings.ts` (`listReportPeriods` + three ranking queries).
- [ ] 1.14 RED: same file, `loadReportDashboard(scope, period)` with the db double: `latest` resolves to newest period; `all`; well-formed absent code applied (zero rows); no periods -> `periodo: null`; one request with 2 pairs of teacher T and one subject S -> student 1, T 2, S 2; period limits pairs; 12 students with a tie at rank 10 -> 10 kept, alphabetical; any thrown query -> `{ degraded: true }` with no partial data (scenarios "Pairs, not requests", "Period limits pairs", "Cut and tie", "Reassigned group", "No data at all", "Degraded read").
- [ ] 1.15 GREEN: `loadReportDashboard` (periods first, then `Promise.all` of three, one `try`; fail-soft `{ periods, periodo, rankings, degraded }`).
- [ ] 1.16 RED: `src/lib/audit/events.test.ts` + `types` test: `AuditEntityType` gains `Carrera`; builder for `solicitud.ranking.consultado` has entity `Carrera`, id = carreraId, payload `{ periodo, estudiantes, docentes, asignaturas }` only (no name, CIF, request id); existing events byte-identical (pin one `solicitud.cola.consultada` and one `documento.descargado`) (audit-log delta).
- [ ] 1.17 GREEN: `src/lib/audit/types.ts` (`Carrera`, action, payload type) and `src/lib/audit/events.ts` builder.
- [ ] 1.18 RED: `src/lib/data/report-reads.test.ts`: `recordReportDashboardRead` opens one transaction, calls `insertAuditEvents` once with the session user as actor, throws when the insert fails, is `cache()`-deduped for equal args (pattern of `request-reads.ts`) (CR-7, CR-AUDIT-1).
- [ ] 1.19 GREEN: `src/lib/data/report-reads.ts`; structural RED+GREEN in the same test: no `next/*` import and no `i18n/` import under the new `src/lib/reports` and `report-*.ts` files, `react` only for `cache` in `report-reads.ts`; the search term never reaches an event builder.
- [ ] 1.20 Gates 1a; measure the authored diff (target ~500, stop and report if over 800).
- [ ] 1.21 Commit unit 1a-ii: `feat(reports): add the report rankings and the dashboard audit event`.

## Phase 2: Slice 1b - Dashboard, nav, i18n (work unit 1b)

- [ ] 2.1 Branch `feat/coordination-reports-1b-dashboard` per 0.2. RED: `src/i18n/reports-messages.test.ts`: identical `es`/`en` key sets and non-empty values for `nav.reports`, the home shortcut text and `reports.*` (title, description, period label, all periods, no-career, empty, three ranking titles/descriptions/empty texts, count text with plural, "View requests") (CR-I18N-1; BS-I18N-1).
- [ ] 2.2 GREEN: `i18n/es.json`, `i18n/en.json` dashboard keys (additive; slices 2 and 3 add their own).
- [ ] 2.3 RED: `src/lib/navigation.test.ts`: `reports` item after `review`, before `administration`, `visibleTo: canViewReports`, `prefetch: false`, `ChartColumn` icon; role table per BS-NAV-1 (coordinacion: Dashboard, Reports, Administration, Settings); `trailFor("/reports")` exact, `trailFor("/reports/requests")` not exact with href `/reports`; Reports active on both paths, no other entry active (scenarios "Reports routes and active marker", "Entries per role").
- [ ] 2.4 GREEN: `src/lib/navigation.ts` entry.
- [ ] 2.5 RED: `src/components/app-sidebar.test.tsx` and the home page test: coordinacion sidebar order and Reports link rendered with prefetch disabled; home shortcut order Reports, Asignaturas, Docentes, Users with the same target and no prefetch; no Reports card or `/reports` link for the other four roles (BS-HOME-1; scenarios "Reports entry not prefetched", "Reports shortcut only for coordination"). GREEN: adjust only if red (sidebar and home already forward `prefetch`).
- [ ] 2.6 RED: `src/app/(dashboard)/reports/ranking-card.test.tsx`: `<ol>` of rows in order, student rows show CIF as secondary text, `totalText` per row, per-card muted empty text, no hooks, axe clean, tokens only from `docs/design-system.md` (CR-RANK-3, CR-DASH-1).
- [ ] 2.7 GREEN: `src/app/(dashboard)/reports/ranking-card.tsx` (presentational, design-system `Card`).
- [ ] 2.8 RED: `src/app/(dashboard)/reports/period-filter.test.tsx`: plain GET `<form>`, `Select` with `items` and `name="period"`, options "all periods" + periods newest first, selected value, extra option for a well-formed absent code, submit `Button`, axe clean.
- [ ] 2.9 GREEN: `src/app/(dashboard)/reports/period-filter.tsx`.
- [ ] 2.10 RED: `src/app/(dashboard)/reports/page.test.tsx` (link double of `review/test-support.tsx`), table-driven by CR-8: role denied by `requireRole`; `none` scope -> `role="alert"` no-career block, no load, no audit; degraded -> `DegradedAlert` (`role="status"`) only, no audit; no period -> `EmptyState variant="empty"`, one audit row with zeros; data -> filter + three cards + link to `/reports/requests?period=<resolved>` with `prefetch={false}`; exactly one `h1`; no cause, date or state in the output; audit called once, after the load; audit rejection makes the page throw and return no data; invalid period behaves as default (scenarios "Once per open", "Audit failure blocks the data", "Degraded read").
- [ ] 2.11 GREEN: `src/app/(dashboard)/reports/page.tsx` container: `await searchParams` once, guard -> scope -> params -> `loadReportDashboard` -> `recordReportDashboardRead` -> render.
- [ ] 2.12 RED+GREEN: `src/app/(dashboard)/reports/structure.test.ts` file scan: the report audit writers are called only from the `page.tsx` files and the route, once each, after the load; every `<Link` under `reports/` carries `prefetch={false}`; no `loading.tsx` and no `layout.tsx` under `reports/` (N2; scenario "Prefetch and re-render do not duplicate"). Slices 2 and 3 extend the allow-list.
- [ ] 2.13 `[ASK OWNER]` dev walk as a `coordinacion` user: nav entry, rankings, period switch, one audit row per open. Record the result here.
- [ ] 2.14 Gates 1b; measure the authored diff (target ~380); commit `feat(reports): add the coordination dashboard with its navigation entry`.

## Phase 3: Slice 2 - Detail page (work unit 2)

- [ ] 3.1 Branch `feat/coordination-reports-2-detail` per 0.2. RED: `src/lib/navigation.test.ts` + `src/components/page-context.test.tsx`: `NavTrail` carries `prefetch` of its entry; the non-exact back link on `/reports/requests` and on `/review/[id]` renders `prefetch={false}`; entries without the flag are unchanged (CR-9).
- [ ] 3.2 GREEN: `src/lib/navigation.ts` (`NavTrail.prefetch`, `trailFor`) and `src/components/page-context.tsx` forward it.
- [ ] 3.3 RED: `params.test.ts` additions: `docente` accepts `/^[1-9]\d*$/` safe integers only (`0`, `-1`, `01`, `1.5`, huge, array -> null); `causa` exact match in `CAUSAS` else null; `q` through `parseQ(raw, 100)`; `page` through `parsePage`; absent `period` means all on the detail (no hidden default); `requestsReportHref` carries the resolved period and filters, omitting empties (CR-6, CR-DET-2; "A cause outside the five causes is ignored").
- [ ] 3.4 GREEN: `src/lib/reports/params.ts` (remaining params, `requestsReportHref`).
- [ ] 3.5 RED: `report-scope-sql.test.ts` additions: `docenteId` sits in the same `EXISTS` as `periodo` (one class row satisfying both); `docenteId` alone still one `EXISTS`; `q` is `or(ilike(EstudianteNombre), ilike(EstudianteCif))` with `containsPattern`; `causa` is `eq`; all terms AND-ed after the scope term (CR-3).
- [ ] 3.6 GREEN: `report-scope-sql.ts` filters in `classFilter` and `buildReportWhere`.
- [ ] 3.7 RED: `src/lib/data/report-requests.test.ts`: `listReportRequests` count is requests, not pairs (3 requests, 7 pairs -> 3), `VISIBLE_STATES` only (`borrador` and other career absent, `rechazada`/`devuelta` present), order submission date desc then id desc (A-SORT), page size 25 with the page clamped; `listReportClasses(ids)` is one batched query (no per-row query) returning every pair with teacher and period per request; `listReportDocentes` lists only teachers with a pair in scope; foreign `docente` -> zero rows and no name; any thrown query -> `{ degraded: true }` (CR-DET-1..3; scenarios "One row per request", "Foreign teacher", "Total counts requests").
- [ ] 3.8 GREEN: `src/lib/data/report-requests.ts` (`listReportRequests`, `listReportClasses`, `listReportDocentes`).
- [ ] 3.9 RED: events and `report-reads.test.ts` additions: `solicitud.reporte.consultado` builder on `Carrera` with payload `{ periodo, docenteId, causa, busqueda: boolean, total }`; serializing the payload never contains the typed search term ("Maria Lopez") and `busqueda` is true; `recordReportRequestsRead` one transaction, throws on insert failure (audit-log "Student term never stored").
- [ ] 3.10 GREEN: `src/lib/audit/{types,events}.ts` and `src/lib/data/report-reads.ts` (`recordReportRequestsRead`).
- [ ] 3.11 RED: extend `src/i18n/reports-messages.test.ts` for the detail keys (title, filter labels, columns, cause labels reuse, total text, no-results, clear, back link). GREEN: `i18n/{es,en}.json`.
- [ ] 3.12 RED: `src/app/(dashboard)/reports/requests/request-filters.test.tsx`: GET `<form>` with period select (default all), teacher select, student `Input name="q"`, cause select, apply button, clear link (`prefetch={false}`), values preserved, labels, axe clean. GREEN: `request-filters.tsx`.
- [ ] 3.13 RED: `requests-table.test.tsx`: columns (student, CIF, cause, state, absence dates, submission date, classes); several classes in one cell each with teacher and period; dates in the business time zone (America/Managua); cause here only; pagination links keep the resolved filters and are `prefetch={false}`; `TableCard`, no overflow at 360 px (static guard). GREEN: `requests-table.tsx`.
- [ ] 3.14 RED: `requests/page.test.tsx` (CR-8 states, as 2.10): denied; `none` scope no audit; degraded alert no audit; zero rows -> `EmptyState variant="no-results"` with a clear link, still audited; data -> total of requests, page clamp, filters AND-ed, invalid cause ignored; one `h1`; one audit row after the load with `total`; audit failure -> no data; hrefs carry the resolved period (scenarios "Combined filters", "Borrador and other careers excluded", "Once per open, none on denial").
- [ ] 3.15 GREEN: `src/app/(dashboard)/reports/requests/page.tsx` container (guard -> scope -> params -> resolve period -> load -> `recordReportRequestsRead` -> render).
- [ ] 3.16 Extend `reports/structure.test.ts` allow-list to the detail page (still once, after the load, every `<Link` `prefetch={false}`).
- [ ] 3.17 `[ASK OWNER]` dev walk of `/reports/requests` with each filter; record the result.
- [ ] 3.18 Gates 2; measure the authored diff (target ~550, stop and report if over 800); commit `feat(reports): add the filterable request detail and fix the trail prefetch`.

## Phase 4: Slice 3 - Workbook download (work unit 3)

- [ ] 4.1 Branch `feat/coordination-reports-3-export` per 0.2. RED: `params.test.ts` addition: `exportHref` carries the resolved period and the active filters, omits empty ones, targets `/api/reports/justifications`. GREEN: `params.ts`.
- [ ] 4.2 RED: `report-requests.test.ts` addition: `listReportExport` uses the same `buildReportWhere` and `VISIBLE_STATES` as the count (SQL equality via `toSQL()`), has no `LIMIT`, batches classes once. GREEN: `report-requests.ts`.
- [ ] 4.3 RED: events and `report-reads.test.ts`: `solicitud.reporte.descargado` on `Carrera` with the same payload as 3.9 (`total` = row count, e.g. 12 with period + cause); `recordReportDownload` is not `cache()`d (repeated downloads write one row each), throws on insert failure. GREEN: `audit/{types,events}.ts`, `report-reads.ts`.
- [ ] 4.4 RED: extend `reports-messages.test.ts` for workbook keys (sheet names, headers, summary labels, filter labels, total). GREEN: `i18n/{es,en}.json`.
- [ ] 4.5 RED: `src/lib/reports/build-workbook.test.ts` (read back with ExcelJS): locale `en` -> English headers and labels, `es` -> Spanish; one data row per request with the CR-DET-1 columns; summary sheet lists applied filters and the total; values `=1+1`, `+1`, `-1`, `@x` are string cells, never formulas; empty input -> headers and total 0 (CR-XLS-2; scenarios "Locale, summary, formula-like text", "Empty download").
- [ ] 4.6 GREEN: `src/lib/reports/build-workbook.ts`.
- [ ] 4.7 RED: `src/app/api/reports/justifications/route.test.ts` (`// @vitest-environment node`, real `dal`, mocked `getSession`): role matrix (only in-career `coordinacion` gets bytes; others and anonymous get the `ACCESS_DENIED_PATH` redirect with no bytes); `none` scope redirects; headers xlsx type, `Content-Disposition: attachment`, `Cache-Control: private, no-store`; `recordReportDownload` called once after authorization and before the response is built; insert failure -> 500 and no bytes; denied and failed calls write no row; two downloads -> two rows; locale from the cookie with fallback `es` (design open question 1: this is the first slice-3 test, record the outcome); empty result still downloads (CR-XLS-1, CR-XLS-4).
- [ ] 4.8 GREEN: `src/app/api/reports/justifications/route.ts` (self-guarded: `requireRole` -> `canViewReports` -> scope -> params -> `listReportExport` -> `buildWorkbook` -> `recordReportDownload` -> `Response`).
- [ ] 4.9 RED: parity test `src/app/api/reports/justifications/parity.test.ts`, table of filter sets over one shared dataset: export where SQL equals the count where SQL (`toSQL()`), and detail total, workbook summary total and data row count are equal (CR-XLS-3). GREEN: fix only what the test finds. Optional `*.integration.test.ts` written, not run (`[ASK OWNER]`, disposable branch only).
- [ ] 4.10 RED: `requests/page.test.tsx` addition: a download control with `href = exportHref(resolved filters)`, a plain `<a>` (not `Link`: it is a file route, no client navigation), shown with zero rows, hidden when degraded or `none`. GREEN: `requests/page.tsx` or `requests-table.tsx`. Not listed in the design file table: see risks.
- [ ] 4.11 Extend `reports/structure.test.ts`: the download writer is called only from `route.ts`, once, after authorization and before the bytes.
- [ ] 4.12 `[ASK OWNER]` real download in dev: open in Excel or LibreOffice, compare total with the screen, confirm one audit row; record the result.
- [ ] 4.13 Gates 3; measure the authored diff (target ~450); commit `feat(reports): add the justification workbook download`.

## Phase 5: Archive-time tasks (after verify, in the archive commit)

- [ ] 5.1 `docs/roadmap.md`: set row #7 `coordination-reports` to `archivado` (as done for row 4) and add a note (Spanish, like the others) that it was archived on the archive date with the RF-17 and RF-13 (a, b, d) scope.
- [ ] 5.2 `docs/roadmap.md`: RF-13 (c) recidivism follow-up note: it moves to `validation-signals` (#5, RN-14); add `RF-13 (c)` to row #5 "Cubre"; state that the student ranking is not RN-14 recidivism.
- [ ] 5.3 FLAG for the owner: add the roadmap note "Pendiente: sincronizar RF-17 con la matriz de la tesis" (precedent: `student-enrollment`, RF-16). Do not edit the thesis matrix here.
- [ ] 5.4 Archive notes (`sdd-archive`): record the documented limitations of CR-LIMIT-1 (teacher is the live `Grupo.DocenteId`; career is the student's current `CarreraId`) and the three audit actions with entity `Carrera`; sync the delta specs (`coordination-reports`, `audit-log`, `backoffice-shell`) into `openspec/specs/`.
