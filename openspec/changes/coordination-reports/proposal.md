# Proposal: Coordination Reports

## Intent

Career coordinators cannot see which students, teachers and classes of their career are most affected by justified absences, nor query or export the underlying requests. Deliver roadmap row 7: RF-17 first, then RF-13 (b, d) on screen and RF-13 (a) as a download, respecting RNF-01 and RNF-06. Exploration `sdd/coordination-reports/explore` and the user decisions of 2026-10-30 are authoritative.

## Scope

### In Scope
- **Shared rules.** `ReportScope` (`carrera | none`); only `coordinacion` (`canViewReports`); null `carreraId` gives `none` and a "no career assigned" state. Request career = the student's current `Usuario.CarreraId`. Period = `Grupo.Periodo` (`AAAA-S1/S2`) through `EXISTS`. One shared where-builder.
- **1. Dashboard (RF-17).** Three top-10 rankings, filtered by period:
  - students by number of requests;
  - teachers (live `Grupo.DocenteId`) by justified classes;
  - classes (`Grupo -> Asignatura`) by justified classes.
  - A justified class is one `SolicitudAsignatura` pair. Only `aprobada` and `pendiente` count (RF-17 c).
  - Each view writes one audit entry without student data (RF-17 e).
- **2. Detail (RF-13 b, d).** Filterable on-screen query (period, teacher, student, cause), one row per `VISIBLE_STATES` request, with total.
- **3. Download (RF-13 a).** `GET /api/reports/justifications`, same parser and where, `exceljs`, self-guarded, `Cache-Control: private, no-store`, total parity (d).
- Cause shown in detail and file; every view and download audited with codes and counts only.
- Nav entry with `prefetch: false`, structural test, i18n in es and en.

### Out of Scope
- RF-13 (c) recidivism, a follow-up for `validation-signals` (#5, RN-14). The student ranking is **not** RN-14 recidivism (no issuer, no threshold, no signal).
- `administrador` access, an `all` scope, schema changes, charts, a teacher snapshot.

## Capabilities

### New Capabilities
- `coordination-reports`: scope, rankings dashboard, detail query, xlsx export, total parity, audit.

### Modified Capabilities
- `backoffice-shell`: BS-NAV-1 and BS-HOME-1 gain the Reports entry for `coordinacion`.
- `audit-log`: dashboard views, detail views and downloads are audited events.

## Approach

Exploration approach 1, a dedicated report slice (`src/lib/reports/`, `src/lib/data/report-*.ts`); `RequestScope` pins untouched; strict TDD.

**Decision (confirmed):** two routes, `/reports` (dashboard) and `/reports/requests` (detail), one nav entry, linked with `prefetch: false`. Why: each route has its own filters and one audit event per render, and slice 2 adds a route without editing slice 1. Alternative: one `/reports` with tabs.

Slices (auto-chain, 800 lines):
1. Scope, shared where, ranking queries, audit, dashboard page, nav, i18n (~750, tight; fallback split: data plus audit, then page plus nav).
2. Detail page (~550).
3. xlsx route and workbook (~450).

## Affected Areas

| Area | Impact |
|------|--------|
| `src/lib/reports/**`, `src/lib/data/report-*.ts` | New |
| `src/app/(dashboard)/reports/**`, `src/app/api/reports/justifications/route.ts` | New |
| `src/lib/auth/permissions.ts`, `src/lib/navigation.ts`, `src/lib/audit/{types,events}.ts`, `i18n/{es,en}.json` | Modified |

**DB schema: NO.**

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Student ranking singles out individuals with health-related absences (RNF-06) | Med | Career-scoped, coordinator-only, audited |
| Cause (health data) in detail and file | Med | Same, plus no-store |
| Teacher reassignment rewrites history | Med | Documented limitation |
| Conflicts with `escalation` in hot files | Med | Rebase per slice, additive edits |

## Rollback Plan

Revert slice PRs in reverse order. No data or schema touched; written audit entries stay.

## Dependencies

- None. `exceljs` is installed.

## Success Criteria

- [ ] A coordinator sees three period-filtered top-10 rankings of their career, counting only `aprobada` and `pendiente`.
- [ ] The detail filters by period, teacher, student and cause; the xlsx count equals the screen total (test).
- [ ] Other roles and other careers are denied or invisible.
- [ ] Each view and download writes exactly one audit entry.

## Proposal question round (confirmed by the user on 2026-10-30)

Slice 1:
1. Top-N is 10; ties break by name.
2. Default period is the most recent with data; "all periods" is selectable.
3. `en_revision_coordinacion` and `devuelta` are excluded from rankings.
4. Two routes: `/reports` (dashboard) and `/reports/requests` (detail), one nav entry.

Deferred to slices 2 and 3: columns (name, CIF, cause, state, dates, classes with teacher and period); several classes in one cell; empty download allowed with total 0; workbook in the user's locale with a filter summary.
