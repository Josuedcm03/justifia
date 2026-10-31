## Exploration: coordination-reports (roadmap #7, RF-13 a, b, d)

### Current state
- **Role and scope.** `coordinacion` is already carrera-scoped (`isCarreraScopedRole` in `src/lib/auth/permissions.ts`; `Usuario.carreraId` in `src/db/schema.ts`). `catalogScopeFor` in `src/lib/catalog/scope.ts` fails closed with `none`.
- **No request scope for coordination.** `RequestScope` (`src/lib/intake/request-scope.ts`) only has `facultad | none`, and only a `secretaria` gets `facultad`. `requestInScope` (`src/lib/data/request-scope-sql.ts`) is an `EXISTS` on the student's current `Usuario.CarreraId`. It never uses the snapshot `EstudianteCarrera`. Both are pinned by tests.
- **Request model.**
  - `Solicitud` has `estado`, `causa`, `fechaInicio`/`fechaFin`, `presentadaEn` and the snapshot columns `estudianteNombre`, `estudianteCif`, `estudianteCarrera`.
  - States are the `ESTADOS_SOLICITUD` constant, which maps to RN-16. `VISIBLE_STATES` excludes `borrador`, and every listing must filter by it.
  - The five causes are the `CAUSAS` constant, with i18n labels in `intake.causes.*`.
- **Class and teacher link.** `SolicitudAsignatura` stores `grupoId`. `Grupo` carries `periodo`, `docenteId` and `asignaturaId`.
  - `listRequestClasses` in `src/lib/data/solicitud-clases.ts` is the only module that joins `SolicitudAsignatura -> Grupo -> Asignatura -> Usuario`. It already returns `docenteNombre` per class.
  - No test forbids a new `EXISTS` on `SolicitudAsignatura` and `Grupo` in a where-clause.
- **Teacher snapshots.** `Remision` has a teacher snapshot (`docenteId`, `docenteNombre`), but it only exists for approved requests. `SolicitudRevision.clases` has no teacher or period.
- **Period model.** There is no `Periodo` table. A period is free text `Grupo.Periodo`, validated by `PERIODO_RE = /^\d{4}-S[12]$/` in `src/lib/import/normalize.ts`. `docs/api-institucional/README.md` confirms: "Texto libre `AAAA-S1`/`AAAA-S2` dentro de `Grupo.Periodo`".
- **xlsx.** `exceljs` 4.4.0 is already a dependency, with a single write-side builder in `src/lib/import/template.ts`. `src/app/api/catalog/template/route.ts` is the precedent for a download:
  - `requireRole`, then a predicate with `redirect(ACCESS_DENIED_PATH)`.
  - `new Response(Buffer.from(bytes))` with the xlsx content type, `Content-Disposition: attachment` and `Cache-Control: private, no-store`.
  - `middleware.ts` excludes `/api`, so the handler must guard itself.
  - The test runs under `@vitest-environment node` with the real `dal` over a mocked `getSession`, and a role matrix. GET handlers are dynamic by default in Next 16 (`route.md`). No `next.config.ts` change is needed.
- **List UI.**
  - `ListTable` (`src/components/tables/list-table.tsx`) supports only `q`, an active/inactive `status`, sort and paging. It cannot host period, docente or cause selects.
  - The URL contract is `parseXListParams` plus an `xListHref` builder over `src/lib/list-params.ts`.
  - Data reads use the `{data, total, page, degraded}` fail-soft shape, with a `buildXWhere` shared by the count query and the page query (`buildUsersWhere`, `clampPage`).
  - `src/lib/data/sql-like.ts` has `containsPattern`.
- **Navigation.** One list, `NAV_ITEMS` in `src/lib/navigation.ts`, with a `visibleTo` predicate. The sidebar, top-bar trail and home shortcuts all read it.
  - `src/lib/navigation.test.ts` characterizes the list exactly, and its `shortcutsFor` matrix lists `coordinacion` as `/catalog/asignaturas, /catalog/docentes, /users`.
  - Every entry needs `nav.<key>` and `dashboard.shortcuts.<key>` in both `i18n/es.json` and `i18n/en.json`. `src/i18n/catalog-parity.test.ts` enforces this.
- **Audit (RNF-06).**
  - Staff reads are audited on page render via `request-reads.ts`: `recordQueueRead` writes `solicitud.cola.consultada` with counts only.
  - `src/app/(dashboard)/review/structure.test.ts` pins the call sites and requires `prefetch: false` on every link to an audited page.
  - Audit actions are code-only (`AUDIT_ACTIONS` in `src/lib/audit/types.ts`), with no DB CHECK, so new actions need no migration.
  - The review queue deliberately never lists the cause, because it is health data (RNF-06).
- **Tests.** Vitest, colocated. SQL fragments are proven with `QueryBuilder().toSQL()` (`request-scope-sql.test.ts`). Opt-in real-Postgres suites (`*.integration.test.ts`, gated by `INTEGRATION_DATABASE_URL`) exist but are not part of `npm test`.

### Affected areas (all new unless noted)
- `src/lib/reports/` (new, pure):
  - `ReportScope` and `reportScopeFor(rol, actor)`.
  - `parseReportParams` and `reportHref`/`exportHref`.
  - Report row and filter types.
- `src/lib/data/report-scope-sql.ts` and `src/lib/data/justification-report.ts` (new): `buildReportWhere`, the paged query, the export query, and the filter options.
- `src/lib/auth/permissions.ts` (modified): `canViewReports(rol)` and `rolesQueVenReportes`.
- `src/app/(dashboard)/reports/page.tsx` (+ filter form, table, loading) and `src/app/api/reports/justifications/route.ts`.
- `src/lib/reports/build-workbook.ts` (new, ExcelJS).
- `src/lib/navigation.ts` (modified): one entry with `prefetch: false`. Update `navigation.test.ts` and `app-sidebar.test.tsx`.
- `i18n/{es,en}.json` (modified): nav, shortcut and report keys.
- `src/lib/audit/{types,events}.ts` (modified): new events; also `types.test.ts` and `events.test.ts`.
- `docs/roadmap.md` (at archive): mark #7 with RF-13 (c) as a documented follow-up.
- No schema change and no migration are needed.

### Approaches
1. **Dedicated report slice (recommended).** Add `ReportScope`, one shared `buildReportWhere`, an RSC page with a plain GET filter form, and a route handler for the xlsx.
   - Pros:
     - Does not touch the `RequestScope` pins and their exhaustive switches.
     - (d) holds by construction, because the count, the page and the export share one where-clause.
     - Follows the existing template route and list-params conventions.
   - Cons:
     - A new form pattern, because `ListTable` has no custom filters.
     - A new scope type.
   - Effort: Medium.
2. **Extend `RequestScope` with `carrera` and extend `ListTable` with generic filters.**
   - Pros: Reuses the scope and table machinery.
   - Cons:
     - Touches the SR-6 exhaustive switches and the `canViewDocument` and `resolveRequestScope` semantics.
     - Changes a shared client component.
     - Larger blast radius.
   - Effort: High.
3. **Export-only (no on-screen query).**
   - Pros: Smallest.
   - Cons: Violates (d), which compares the xlsx total with the "consulta en pantalla".
   - Effort: Low.

### Recommended answers to the open decisions
1. **"Period".**
   - **Definition.** Use the academic period code `AAAA-S1`/`AAAA-S2`, derived with `EXISTS (SolicitudAsignatura -> Grupo WHERE Grupo.Periodo = :p)`.
   - **Why.** It is the only period concept in the data. It is the "período académico" RN-14 will need, so (c) can reuse it later.
   - **Not chosen.** A date range on `presentadaEn`/absence dates, because it needs no calendar but diverges from RN-14.
   - **Options.** The select lists `DISTINCT Grupo.Periodo` of in-scope requests, validated against `PERIODO_RE`.
   - **Default.** "All periods", with no hidden filter. Latest period is an acceptable alternative.
   - **Limit.** A request with no group rows is invisible only when a period is chosen.
2. **Teacher relation.**
   - **Mechanism.** Use `SolicitudAsignatura -> Grupo.DocenteId` through an `EXISTS`, so rows are not multiplied.
   - **Why not `Remision`.** It exists only for approved requests, so it would hide pending, rejected and returned ones.
   - **Limit.** The group's teacher is live, not a snapshot, so a later reassignment in the catalog changes old report rows. Document it in the spec.
   - **Control.** A `<select>` of `docenteId`, from the distinct teachers of in-scope requests. A foreign id yields zero rows and leaks nothing.
   - **Columns.** Show teacher names from `listRequestClasses`.
3. **Where the on-screen query lives.**
   - **Page.** `src/app/(dashboard)/reports/page.tsx`, with URL params `period`, `docente`, `q` (student name or CIF, using `containsPattern` on the snapshot columns), `causa` and `page`. Use a plain GET `<form>` and a pure `parseReportParams`/`reportHref`.
   - **Download.** `GET /api/reports/justifications?<same filters>` as a plain link, with no server action. Both the page and the route use the same parser.
   - **Nav.** Add `{ key: "reports", href: "/reports", icon: <lucide>, visibleTo: canViewReports, prefetch: false }`. `prefetch: false` is needed because the page is audited on render. Placing it top-level is fine, since the "administration" group is reserved for catalog and users.
4. **xlsx library.**
   - **Library.** Reuse `exceljs` 4.4.0 and `writeBuffer()` in a new `build-workbook.ts`. Add no dependency.
   - **Layout.** One data sheet with one row per request, plus a small summary block or sheet with the applied filters and the total.
   - **Encoding.** ExcelJS writes strings as text, so values beginning with `=`, `+`, `-` or `@` do not become formulas.
   - **Volume.** In-memory writing is fine at pilot volume.
   - **Locale.** Headers and labels come from next-intl and reuse the existing cause and state labels. `getTranslations` should work in a route handler through the cookie locale; verify it in a test.
5. **Does `administrador` see all careers?**
   - **Recommendation.** No, for v1. RF-13 says "coordinación de carrera", and `administrador` only provisions coordination accounts (`rolesAsignables`). `canViewReports` is `coordinacion` only, and the scope is `carrera | none`, with `none` when `carreraId` is null.
   - **Cost to add.** An `all` kind is cheap later (about 10 lines plus tests).
   - **Open.** The user must confirm.

### New decisions and risks found
- **D-A: what "career of a request" means.** Recommend the student's current `Usuario.CarreraId`, as SR-6 does, with an inner join so a student without a career is invisible. A student who later changes career moves their old requests to the new career's report. Alternatives are the snapshot name (brittle) or `Asignatura.CarreraId` (electives appear in two reports).
- **D-B: the cause is health data.**
  - **Exposure.** The review queue never lists it (RNF-06), but RF-13 (b) filters by cause. Recommend including the cause as a column and filter for the coordination, and flag it to the user for a privacy decision.
  - **Audit.** Add audit events, with codes and counts only and no student data: `solicitud.reporte.consultado` per page render, and `solicitud.reporte.descargado` per download. They need a new `AuditEntityType` for the carrera, or `Facultad` plus its id. RNF-06 says "cada lectura ... exactamente una entrada".
  - **Structure.** Add a structural test like `review/structure.test.ts`: the audit call lives only in the page and the route, with a single call after the data load.
- **D-C: (d) must hold structurally.** One `buildReportWhere` feeds the count, the page query and the export. Add a test that the export row count equals the screen total for the same filters. The total counts requests (one row per request), not request-class pairs. State this explicitly in the spec.
- **D-D: out of scope.** Do not ship an empty or zero "recidivism" column. Record RF-13 (c) as a follow-up for `validation-signals` (#5, RN-14), and state it in the roadmap on archive. An optional state filter is not in RF-13 (b) and is not recommended.
- **Conflict risk.** The unmerged `escalation` branch (`origin/feat/escalation*`) is likely to touch `audit/types.ts`, `i18n/*.json`, `navigation.ts` and the migration numbering (`0011`). It will not conflict on the schema, because this change has none. Merge-order conflicts are possible in those hot files.
- **Review budget (800 lines).** The full change, tests included, is expected to exceed it. With `delivery_strategy=auto-chain`, chain it as three slices:
  1. Scope, params, data layer and audit.
  2. Page, nav and i18n.
  3. The xlsx route and workbook.
- **`coordinacion` with `carreraId` null.** It gets `none`, with a "no career assigned" message like the review queue's `noFaculty`. The route returns the access-denied redirect or a 403.
- **Cache and privacy.** Use `Cache-Control: private, no-store` on the download.
- **Project instruction.** The Neon DB rule is not triggered; there is no schema change. An integration test for (d) is optional and needs a disposable database.

### Ready for proposal
Yes, after the user confirms:
- (a) `administrador` excluded in v1.
- (b) The cause is shown in the report, with every query and download audited.
- (c) Career means the student's current career.
- (d) Period means the academic period code.
- (e) Delivery as three chained slices.
