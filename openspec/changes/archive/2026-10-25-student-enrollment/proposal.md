# Proposal: Student Enrollment

## Intent

Nothing writes `Inscripcion`, and `listEligibleGroups` is the only source of
subjects for a request, so students cannot file requests (RF-01, RF-04,
RN-22). The Excel import dropped Inscripciones by product-owner decision and
the institutional API is not available. This change lets the student declare
their own enrollment as the RN-21 stopgap. Evidence: `exploration.md`.

Parallel work: `document-extraction` is active in the main checkout; running
this change at the same time is an explicit user exception to the
one-change-at-a-time rule (CLAUDE.md, `docs/roadmap.md`).

## Scope

### In Scope
- **D1** Self-declared, unverified enrollment. Docs: new **RF-16**, amended
  RF-12 and RN-21, roadmap row, changelog entry in `docs/requirements.md`
  ("pending sync" to the thesis matrix).
- **D2** One active group per asignatura+period per student; choosing another
  replaces (deactivates) the previous one. App-level rule.
- **D3** Only the latest period, `max(Grupo.Periodo)` over active grupos.
- **D4** Picker shows the student's carrera first; other carreras searchable.
- **D5** Dropping a group used by a draft or `devuelta` request warns but is
  allowed; presented requests unaffected.
- **D6** No enrollment limit.
- **D7** Drop = confirm dialog (RNF-12) + `Activo=false`; never delete;
  re-enroll reactivates.
- **D8** New `inscripcion.*` audit actions on create, reactivate, deactivate
  (RNF-06).
- **D11** Step 2 empty state separates "no enrollments" (link to
  `/enrollment`) from "no class in these dates"; nudges at `requests/new`
  entry, `/requests` empty state, student nav item and dashboard shortcut.
- **D12** Fix the missing `Asignatura.Activo` filter in `listEligibleGroups`.
- `inscripcion-writes.test.ts` becomes an allowlist with the one writer;
  docente email/phone never reach students.

### Out of Scope
- Staff view or editing of student enrollments (D9).
- Schema migration or `Origen` column (D10); secretaria approval queue.
- Institutional API sync; past or configurable periods.

## Capabilities

### New Capabilities
- `student-enrollment`: student page to list, add, replace and drop groups of
  the latest period; rules D2-D8.

### Modified Capabilities
- `academic-catalog`: writer scenarios (role integrity, duplicate refusal,
  role table); eligible groups require active asignatura.
- `justification-intake`: split empty state and entry nudge.
- `student-requests`: `/requests` empty-state nudge.
- `backoffice-shell`: student nav item and dashboard shortcut.
- `audit-log`: `inscripcion.*` actions.

## Approach

Exploration approach 1. One writer module; each action is a single guarded
`INSERT ... SELECT ... ON CONFLICT` / `UPDATE` (no `withCatalogWrite` lock, no
deletes) with role check in the data layer plus `requireRole`. Student-scoped
read for the picker. Strict TDD with `createDbDouble`.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/lib/data/enrollment.ts`, new writer module, `inscripcion-writes.test.ts` | Modified/New |
| `src/app/(dashboard)/enrollment/*` | New |
| `requests/new/page.tsx`, `subjects-step.tsx`, `/requests` page | Modified |
| `src/lib/audit/types.ts`, `events.ts`; `src/lib/navigation.ts` | Modified |
| `i18n/{es,en}.json`, `docs/requirements.md`, `docs/roadmap.md` | Modified |

**DB schema: NO.** No migration; writes happen only at runtime.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wrong group mails an unrelated docente | Med | Secretaria approval gate (RN-15) |
| Students re-enroll every term after import | High | Nudges (D11) |
| Concurrent replace leaves two active groups | Low | Guarded statements; design decides ordering |
| Over 800 lines under `single-pr` | High | Tasks phase forecasts and slices |
| `Inscripcion` not empty | Low | Read-only count before design |

## Rollback Plan

Revert the PR. No schema change; rows written stay inert or are deactivated
by a confirmed SQL statement. Docs revert with the PR.

## Dependencies

- None blocking; merge order with `document-extraction` only affects shared
  files (`audit/types.ts`, i18n).

## Success Criteria

- [ ] A student enrolls, replaces and drops groups and can then file a request.
- [ ] Every write emits one `inscripcion.*` audit entry.
- [ ] Inactive asignaturas never appear as eligible.
- [ ] Step 2 shows the correct empty-state reason.
- [ ] Docs list RF-16 and amended RF-12/RN-21.
