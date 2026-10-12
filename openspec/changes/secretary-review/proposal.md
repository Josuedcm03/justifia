# Proposal: Secretary Review

## Intent

Presented requests stay `pendiente` with no reviewer. Deliver roadmap row 2: RF-06..RF-08, RN-08, RN-15..RN-17; cross-cutting RNF-01, RNF-06, RNF-12. Confirmed decisions (Engram `sdd/secretary-review/pre-proposal`) are authoritative.

## Scope

### In Scope
- Facultad queue: new `Usuario.FacultadId`, required for `secretaria`; scope via student `CarreraId -> Carrera.FacultadId`; fail-closed. Order `COALESCE(ReenviadaEn, PresentadaEn)` ASC; alert on read at <= 1 business day or overdue (RN-08).
- Staff detail with prior revisions and retired documents.
- `secretaria`-only decisions (RN-15): approve (optional text), reject (required bounded text, RNF-12 dialog), return (RN-17 code). Editable predefined templates; final text in `SolicitudDecision`; audit stores codes only.
- Student `/requests` list and `/requests/[id]` detail; in-place correction while `devuelta` (RF-08) restarting the clock (`ReenviadaEn`), no RN-23 re-check, never `borrador`.
- Widened document route: staff in scope, attachment download, `modo: ver|descarga`.
- Audited reads: one `solicitud.consultada` per staff detail and one `solicitud.cola.consultada` (entity `Facultad`, count only) per queue open; student reads unaudited.
- `docs/roadmap.md` row 2 owner: Armando.

### Out of Scope
- RF-05, RF-09, RF-10, RF-11, RNF-14, `en_revision_coordinacion`, merge-grupo-into-asignatura.

## Capabilities

### New Capabilities
- `request-review`: queue, RN-08 deadline, staff detail, decisions, templates.
- `student-requests`: list, detail, RF-08 correction.

### Modified Capabilities
- `supporting-documents`: staff access, soft retirement, attachment mode.
- `audit-log`: decision, correction and read events.

## Approach

Hexagonal. Pure domain in `src/lib/intake/`: `business-days.ts` (Mon-Fri, `NonWorkingDaysProvider` port, constant per-year calendar; test fails when the current year is empty), `return-reasons.ts`, `decision-templates.ts`, RN-16 transitions. Guarded `UPDATE ... WHERE Estado = 'pendiente'` plus audit in one transaction (`submitDraft` pattern). `RequestScope` in `permissions.ts`. Class data only through `solicitud-clases.ts`; new tables have no `Grupo` FK. Strict TDD.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/db/schema.ts`, new `drizzle/` migration | Modified/New |
| `src/lib/intake/`, `src/lib/data/` | New/Modified |
| `src/lib/audit/events.ts`, `src/lib/auth/permissions.ts` | Modified |
| `src/app/(dashboard)/review/`, `src/app/(dashboard)/requests/` | New |
| `src/app/api/intake/documents/[id]`, intake steps | Modified |
| `app-sidebar.tsx`, `i18n/{es,en}.json`, `docs/roadmap.md` | Modified |

**DB schema: YES.** No migration or seed runs against Neon without explicit per-command confirmation.

## Delivery Outline (chained PRs, <= 1000 lines each)

| Slice | Content |
|-------|---------|
| 1 | Domain, schema, migration |
| 2 | Scope, data modules, audit events |
| 3 | Queue, detail, decision dialog |
| 4 | Student list, detail, correction |
| 5 | Document access, roadmap |

Estimate 3,500-5,000 lines.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Duplicate read audits (prefetch) | Med | Exactly-once test |
| Holiday calendar stale | Med | Failing year test |
| Secretary lacks `FacultadId` | Med | Fail-closed; confirmed data step |
| Free text is personal data | Low | Never in audit |

## Rollback Plan

Revert slices in reverse order. If applied, a confirmed down-migration drops new tables and columns; intake data is untouched.

## Dependencies

- justification-intake archived first. No dependency on `merge-grupo-into-asignatura` (archived 2026-10-12 as option A, no schema change); class reads stay behind the `solicitud-clases.ts` seam as a design rule.

## Success Criteria

- [ ] Queue shows only own facultad, ordered and alerted per RN-08.
- [ ] Each decision persists text, state and one audit row; concurrent decisions cannot both succeed.
- [ ] Corrected request returns to `pendiente` keeping prior revision.
- [ ] Out-of-scope roles and facultades are denied (RNF-01).
