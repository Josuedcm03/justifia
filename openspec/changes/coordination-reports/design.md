# Design: Coordination Reports

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries a new scope, one shared where-builder, three ranking queries, three
> audit events, two pages, a route handler and a four-slice delivery plan; the
> repository precedent (`document-extraction`, `teacher-remission`) keeps
> decision tables over prose cuts. The deviation is deliberate.

Binding inputs: `proposal.md` (question round confirmed 2026-10-30),
`explore.md`, `docs/requirements.md` (RF-17, RF-13 a/b/d, RNF-01, RNF-06).
Decisions here are **CR-1..CR-12**. No schema change, no migration, no DB
command.

## Technical Approach

Exploration approach 1: a dedicated report slice. A pure `ReportScope`
(`carrera | none`) is resolved per request from `Usuario.CarreraId`, rendered
to SQL in one module, and combined by **one** `buildReportWhere(scope,
filters, states)` that feeds the rankings, the detail count, the detail page
and the export. Pages are RSC containers that guard, resolve, parse, load
(fail-soft), audit, then hand plain display props to presentational
components. `RequestScope`, `requestInScope` and their pins are not touched.

## Verified framework findings (Next 16.3.4)

| # | Finding | Source | Consequence |
|---|---|---|---|
| N1 | Page `searchParams` is a `Promise` | existing `review/page.tsx` | `await searchParams` once, then `parseReportParams` |
| N2 | `Link` default prefetch on a dynamic route prefetches down to the nearest `loading.js`; `false` never prefetches | `02-components/link.md` | Every link to an audited report page is `prefetch={false}`; no `loading.tsx` under `/reports` |
| N3 | GET route handlers are dynamic by default; `/api` is outside `middleware.ts` | `route.md`, `catalog/template/route.ts` | The export route guards itself; no config change |

## Architecture Decisions

### CR-1. Module layout

| Path | Content | Slice |
|---|---|---|
| `src/lib/auth/permissions.ts` | `rolesQueVenReportes = ["coordinacion"]`, `canViewReports(rol)` | 1a |
| `src/lib/reports/scope.ts` | `ReportScope`, `reportScopeFor(rol, actor)` (pure, fail-closed, mirrors `catalogScopeFor`) | 1a |
| `src/lib/reports/params.ts` | `PeriodFilter`, `parseReportParams`, `reportsHref`, `requestsReportHref` (1a/2), `exportHref` (3) | 1a, 2, 3 |
| `src/lib/reports/constants.ts` | `RANKING_LIMIT = 10`, `RANKING_STATES = ["aprobada", "pendiente"]`, `REPORT_PAGE_SIZE = 25` | 1a |
| `src/lib/data/report-scope.ts` | `resolveReportScope(userId, rol)` (`server-only`, fail loud, never cached) | 1a |
| `src/lib/data/report-scope-sql.ts` | `reportInScope`, `classFilter`, `buildReportWhere`; the ONLY place a `ReportScope` becomes SQL | 1a, 2 |
| `src/lib/data/report-rankings.ts` | `listReportPeriods`, three ranking queries, `loadReportDashboard` (fail-soft) | 1a |
| `src/lib/data/report-requests.ts` | `listReportRequests` (count + page), `listReportClasses(ids)` (batched), `listReportDocentes`, `listReportExport` | 2, 3 |
| `src/lib/data/report-reads.ts` | `recordReportDashboardRead`, `recordReportRequestsRead`, `recordReportDownload` | 1a, 2, 3 |
| `src/lib/reports/build-workbook.ts` | ExcelJS workbook, data sheet plus filter summary | 3 |
| `src/app/(dashboard)/reports/{page,ranking-card,period-filter}.tsx` | Dashboard container + presentational | 1b |
| `src/app/(dashboard)/reports/requests/{page,requests-table,request-filters}.tsx` | Detail container + presentational | 2 |
| `src/app/api/reports/justifications/route.ts` | xlsx download | 3 |

Rejected: extending `RequestScope` with `carrera` (touches SR-6 exhaustive
switches and `canViewDocument`); extending `ListTable` with custom filters
(shared client component, larger blast radius).

### CR-2. Scope

`reportScopeFor(rol, actor)`: `canViewReports(rol) && actor?.carreraId != null`
-> `{ kind: "carrera", carreraId }`, else `{ kind: "none" }`.
`resolveReportScope` returns `none` without a read for other roles.
`reportInScope(scope)`: `carrera` -> `EXISTS (SELECT 1 FROM Usuario e WHERE
e.Id = Solicitud.EstudianteId AND e.CarreraId = $c)`; `none` -> `sql\`false\``;
`default` -> `unhandled(never)`. Request career is the student's **current**
career (D-A); a student without a career is invisible.

### CR-3. One where-builder

```ts
type ReportFilters = {
  periodo: string | null;        // null = all periods
  docenteId?: number | null;     // slice 2
  q?: string;                    // slice 2, snapshot name or CIF
  causa?: Causa | null;          // slice 2
};
buildReportWhere(scope, filters, states: readonly EstadoSolicitud[]): SQL
// and(reportInScope(scope), inArray(Solicitud.Estado, states),
//     classFilter(periodo, docenteId)?, term(q)?, eq(causa)?)
```

| Rule | Detail |
|---|---|
| Scope first | Unconditional first term, filters only narrow it (as `buildUsersWhere`) |
| States | Rankings pass `RANKING_STATES`; detail, export and period options pass `VISIBLE_STATES` |
| `classFilter` | One `EXISTS (SolicitudAsignatura sa JOIN Grupo g ... WHERE sa.SolicitudId = Solicitud.Id [AND g.Periodo = $p] [AND g.DocenteId = $d])`; omitted when both are absent. Period and teacher sit in the **same** `EXISTS`, so "teacher d in period p" means one class row satisfying both |
| Term | `or(ilike(EstudianteNombre), ilike(EstudianteCif))` with `containsPattern` |

### CR-4. Ranking SQL

All three share `buildReportWhere(scope, { periodo }, RANKING_STATES)`.

| Ranking | FROM / JOIN | GROUP BY | Count |
|---|---|---|---|
| Students | `Solicitud s JOIN Usuario u ON u.Id = s.EstudianteId` | `u.Id, u.NombreCompleto, u.Cif` | `count(*)` = requests |
| Teachers | `Solicitud s JOIN SolicitudAsignatura sa JOIN Grupo g JOIN Usuario d ON d.Id = g.DocenteId` | `d.Id, d.NombreCompleto` | `count(*)` = pairs (PK `(SolicitudId, GrupoId)` forbids duplicates) |
| Classes | `... JOIN Grupo g JOIN Asignatura a ON a.Id = g.AsignaturaId` | `a.Id, a.Codigo, a.Nombre` | `count(*)` = pairs |

Every ranking: `ORDER BY total DESC, name ASC, id ASC LIMIT 10`. The `id` term
makes homonyms deterministic; a tie at position 10 is cut, not expanded.
Pair rankings also add `g.Periodo = $p` on the **joined** group when a period
is chosen: the `EXISTS` admits the request, the join predicate keeps a request
that spans two periods from leaking its other-period classes. Aliases `u`, `d`,
`g`, `sa` never collide with the scope alias `e`.

### CR-5. Periods and the default

`listReportPeriods(scope)`: `SELECT DISTINCT g.Periodo FROM Solicitud JOIN
SolicitudAsignatura JOIN Grupo g WHERE buildReportWhere(scope, { periodo: null
}, VISIBLE_STATES) ORDER BY g.Periodo DESC`, then filtered through
`PERIODO_RE` (`src/lib/import/normalize.ts`). `AAAA-S1/S2` sorts correctly as
text. Default ("most recent with data") = first option; no options -> the
empty state. One list for dashboard, detail and export, so the default never
differs between them; a latest period whose requests are all outside
`RANKING_STATES` shows three empty rankings (accepted, documented in spec).

### CR-6. Params and hrefs (`params.ts`, pure)

| Param | Parse | Absent / invalid |
|---|---|---|
| `period` | `"all"` -> `{ kind: "all" }`; `PERIODO_RE` match -> `{ kind: "code", periodo }` | `{ kind: "latest" }` |
| `docente` | `/^[1-9]\d*$/`, safe integer | null |
| `causa` | exact match in `CAUSAS` | null |
| `q` | `parseQ(raw, 100)` | `""` |
| `page` | `parsePage` | 1 |

The page resolves `latest` to a concrete code (or `null` when there is no
data) before querying; every outgoing href (`requestsReportHref`,
`exportHref`, pagination) carries the **resolved** `period=<code>|all`, so the
screen and the file query the same period. A well-formed code absent from the
options is applied (zero rows, nothing leaked) and rendered as an extra select
option. A foreign `docente` id yields zero rows.

### CR-7. Audit (code-only, no migration)

| Action | Entity | `datos` | Writer |
|---|---|---|---|
| `solicitud.ranking.consultado` | `Carrera`, carreraId | `{ periodo: code \| "all" \| null, estudiantes, docentes, asignaturas }` (row counts shown) | dashboard page |
| `solicitud.reporte.consultado` | `Carrera` | `{ periodo, docenteId \| null, causa \| null, busqueda: boolean, total }` | detail page |
| `solicitud.reporte.descargado` | `Carrera` | same as above | export route |

| Option | Tradeoff | Decision |
|---|---|---|
| New `AuditEntityType` `"Carrera"` | Code-only (`EntidadTipo varchar(40)`, only `CK_EventoAuditoria_Entidad` on `Usuario`); entity matches the scope | **Chosen** |
| `Facultad` + its id | Extra lookup; loses which career was read | Rejected |

The search term is never logged (it may be a student name): only `busqueda`.
Writers mirror `request-reads.ts`: one transaction, `insertAuditEvents`;
`cache()` for the page writers. Order: guard -> scope -> load -> audit ->
render. A failed insert throws to the error boundary (no data without its
row). `none` scope and a degraded load write **no** row (nothing disclosed).

### CR-8. Page composition (container-presentational)

| State | Dashboard (`/reports`) | Audit |
|---|---|---|
| Role not `coordinacion` | `requireRole(...rolesQueVenReportes)` denies | No |
| `none` scope | `PageHeader` + `role="alert"` `noCareer` block (review `noFaculty` pattern) | No |
| Degraded | `DegradedAlert` only | No |
| No period with data | `EmptyState variant="empty"` | Yes (zeros) |
| Data | `PeriodFilter` + three `RankingCard` in `grid gap-6 lg:grid-cols-3` + link "View requests" | Yes |

`loadReportDashboard(scope, period)` is all-or-nothing: periods first (to
resolve `latest`), then the three rankings in `Promise.all`, inside one
`try` -> `{ periods, periodo, rankings, degraded }`. `RankingCard`
(presentational, hook-free) takes `{ title, description, rows: { key, label,
secondary?, totalText }[], emptyText }`, renders an `<ol>` in the
design-system `Card`, muted per-card empty text. `PeriodFilter` is a plain
GET `<form>` with the shadcn `Select` (`items`, `name="period"`) and a submit
`Button`; no client navigation. The detail page reuses the same states,
`TableCard`, `EmptyState variant="no-results"` with a clear link, and the
batched class list (several classes in one cell). Tokens only from
`docs/design-system.md`.

### CR-9. Navigation

`NAV_ITEMS` gains top-level `{ key: "reports", href: "/reports", icon:
<lucide chart icon, e.g. ChartColumn; confirm the export in the installed
lucide-react>, visibleTo: canViewReports, prefetch: false }` after `review`.
Sidebar and home shortcuts already forward `prefetch`. Slice 2 adds
`prefetch` to `NavTrail` so `PageContext`'s back link from
`/reports/requests` is `prefetch={false}` (also closes the same latent gap on
`/review/[id]`). `src/app/(dashboard)/reports/structure.test.ts` pins: audit
writers called only from the two `page.tsx` files and the route, once each,
after the load; every `<Link` under `reports/` carries `prefetch={false}`; no
`loading.tsx` or `layout.tsx` under `reports/`.

### CR-10. Export route (slice 3)

`requireRole(...rolesUsuario)` -> `canViewReports` else
`redirect(ACCESS_DENIED_PATH)` -> scope (`none` -> redirect) -> parse ->
`listReportExport` (same `buildReportWhere`, `VISIBLE_STATES`, no paging) ->
`buildWorkbook` -> `recordReportDownload` -> `Response` with xlsx type,
`attachment`, `Cache-Control: private, no-store`. Audit failure -> 500, no
bytes. Empty result is a valid file with total 0.

## Data Flow

```
coordinator -> GET /reports?period=...
  requireRole -> resolveReportScope (Usuario.CarreraId)
     none --> noCareer block (no audit)
     carrera --> parseReportParams
        -> loadReportDashboard: listReportPeriods -> resolve latest
              -> Promise.all(students, teachers, classes)  [buildReportWhere]
        degraded --> DegradedAlert (no audit)
        ok --> recordReportDashboardRead -> render cards
/reports/requests -> same guard/scope/params -> count + page + classes
                     [buildReportWhere] -> recordReportRequestsRead -> table
/api/reports/justifications -> same guard/params -> export rows
                     [buildReportWhere] -> workbook -> recordReportDownload -> bytes
```

## File Changes

| File | Action | Slice |
|---|---|---|
| `src/lib/auth/permissions.ts` (+ test) | Modify | 1a |
| `src/lib/reports/{scope,params,constants}.ts` (+ tests) | Create | 1a |
| `src/lib/data/{report-scope,report-scope-sql,report-rankings,report-reads}.ts` (+ tests) | Create | 1a |
| `src/lib/audit/{types,events}.ts` (+ tests) | Modify | 1a, 2, 3 |
| `src/app/(dashboard)/reports/{page,ranking-card,period-filter,structure.test}.tsx` (+ tests) | Create | 1b |
| `src/lib/navigation.ts`, `navigation.test.ts`, `src/components/app-sidebar.test.tsx`, home page test | Modify | 1b |
| `i18n/{es,en}.json` | Modify | 1b, 2, 3 |
| `src/app/(dashboard)/reports/requests/**`, `src/lib/data/report-requests.ts` (+ tests) | Create | 2 |
| `src/components/page-context.tsx` (+ test) | Modify | 2 |
| `src/lib/reports/build-workbook.ts`, `src/app/api/reports/justifications/route.ts` (+ tests) | Create | 3 |

## Testing Strategy (Strict TDD)

| Slice | What | Approach |
|---|---|---|
| 1a | `reportScopeFor` role/carrera matrix; params (every invalid form, `all`, `latest`); `reportInScope` `none` -> `false`; `buildReportWhere` scope-first, states list, `classFilter` single `EXISTS`; ranking SQL: GROUP BY, `ORDER BY total desc, name, id`, `LIMIT 10`, joined-period predicate; periods ordered and `PERIODO_RE`-filtered; fail-soft; event builders and `Carrera` | Vitest; SQL via `new QueryBuilder().toSQL()` (as `request-scope-sql.test.ts`); data reads via the existing db double |
| 1b | Each CR-8 state; audit once after load, never on `none`/degraded; links `prefetch=false`; nav matrix (`coordinacion` sees Reports, others do not); es/en parity | Testing Library with `review/test-support.tsx` link double; file-scan `structure.test.ts` |
| 2 | Filters narrow, foreign `docente` -> zero; `q` never in audit; paging clamp; batched classes; trail prefetch | Same |
| 3 | Role matrix (`@vitest-environment node`, real `dal`, mocked `getSession`), headers, `none` redirect, audit failure -> no bytes; **parity**: export where SQL equals the count where SQL for the same filters, and row count equals total | `toSQL()` equality + db double; optional `*.integration.test.ts` |

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A: no file classification or execution |
| Git repository selection | N/A: no VCS automation |
| Commit state | N/A: no VCS automation |
| Push state | N/A: no VCS automation |
| PR commands | N/A: no PR automation |

The new HTTP routes are authorization boundaries, covered by CR-2, CR-7 and
CR-10 and their role-matrix tests.

## Migration / Rollout

No migration required. New audit actions and the `Carrera` entity type are
code-only. Rollback: revert slices in reverse order; written audit rows stay.

## Review Workload Forecast (auto-chain, 800 lines)

| Slice | Content | Approx. lines |
|---|---|---|
| 1a | Data plus audit: permissions, scope, params (period), constants, report-scope(-sql), rankings, dashboard event, `report-reads` | ~500 |
| 1b | Page plus nav: dashboard page, `RankingCard`, `PeriodFilter`, structure test, nav entry and its tests, i18n | ~380 |
| 2 | Detail: filters in the builder, `report-requests`, detail page/table/form, detail event, trail prefetch, i18n | ~550 |
| 3 | xlsx: `build-workbook`, route, download event, parity test, i18n | ~450 |

Slice 1 as one PR is forecast at ~880 lines, over budget: `sdd-tasks` should
plan 1a and 1b from the start. 1a is inert (no route imports it); 1b is the
first user-visible slice. Boundary rule: anything importing `next/*`, React or
`i18n/` belongs to 1b; everything under `src/lib/**` belongs to 1a.

## Open Questions

- [ ] `getTranslations` with the cookie locale inside a route handler
  (workbook in the user's locale) must be proven by the first slice-3 test;
  fallback is `es`.
- [ ] Export has no row cap (pilot volume); revisit if volume grows.
- [ ] Live `Grupo.DocenteId` rewrites history on reassignment (documented
  limitation, spec).
