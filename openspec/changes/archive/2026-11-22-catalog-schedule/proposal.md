# Proposal: Catalog Schedule, Secretaría Maintenance of Inscripciones

## Intent

Only the student writes `Inscripcion` (RF-17), so the secretaría cannot
inspect or correct enrollments that feed intake (RF-12 (a)(c)). This change
lets the secretaría list, deactivate, reactivate, change the group of, and
create an inscription for a student of her facultad, closing RF-12 (a) for
inscriptions. Evidence: `exploration.md`. Owner decisions dated 2026-11-19
are final; no further proposal question round.

## Scope

### In Scope
- **D1** Chained slices, each within 400 lines (split further if a forecast
  exceeds it): **S1** read-only list at `/catalog/inscripciones`; **S2**
  deactivate and reactivate; **S3** change group and create.
- **D2** New predicate `canManageEnrollments` (secretaria only); divergence
  from `canManageCatalog` recorded in `docs/requirements.md`.
- **D3** Facultad scope as SR-6 (`requestScopeFor` / `requestInScope`); list
  shows name and CIF only, never email or phone.
- **D4** Deactivation confirm (RNF-12) counts submitted or `devuelta`
  requests using the group and states they do not change (RF-17 (e));
  `borrador` never counted or revealed.
- **D5** Administración nav item; filters: student (name/CIF), asignatura
  (code/name), group number, period (default latest), status (default
  active); effective versus raw state shown.
- **D6** Staff writes in `enrollment-write.ts` with an explicit actor, same
  `Usuario` row lock, sibling rule with a confirm naming the replaced group,
  staff actor in the audit row (RNF-06).
- **D7** Staff create and change group only on offered groups of the latest
  period; last writer wins; staff deactivation not sticky.
- **D8** RF-17 (a) is NOT amended (owner, 2026-11-19): the thesis is the
  source of truth and `docs/requirements.md` mirrors it. RF-17 (a) ("Solo el
  estudiante autenticado declara o modifica su inscripción") is read as a
  rule among students (each student modifies only their own inscription);
  the secretaría writes through RF-12 (a), which already gives her the
  maintenance of inscriptions. The specs record this reading; any wording
  change waits for a thesis revision.
- **D9** Staff deactivation works on a row of any period (owner,
  2026-11-19), so stale active rows of older periods do not block RN-27;
  create, change group and reactivate stay on offered groups of the latest
  period (D7).
- **D10** Reads are audited (owner, 2026-11-19), applying RNF-06 (a)
  literally: each list load and each student search writes one audit row
  whose entity is the secretaria's facultad, with no student data or search
  text (new actions `inscripcion.lista.consultada` and
  `inscripcion.estudiantes.consultada`). The other catalog lists, which do not
  audit reads, are existing debt outside this change.
- Docs: roadmap row 0 only.

### Out of Scope
- Docentes maintenance gap of RF-12 (a); RN-22 clock-time schedules (note
  both in the roadmap).
- Schema change, `Origen`/author column (D10 of `student-enrollment`).
- Older periods, coordinación or administrador access, xlsx import.

## Capabilities

### New Capabilities
- `enrollment-administration`: secretaría list, filters, scope, PII limits,
  deactivate/reactivate, change group, create (D1-D7).

### Modified Capabilities
- `student-enrollment`: the student is the only writer among students
  (RF-17 (a), read per D8); the secretaría also writes under RF-12 (a);
  shared lock and last-writer-wins.
- `academic-catalog`: writer role-integrity scenarios admit the staff actor.
- `audit-log`: `inscripcion.*` entries may carry a staff actor.
- `backoffice-shell`: Administración nav item.

## Approach

Exploration approaches 1 and 3. S1 adds a fail-soft list (`{data, degraded}`)
reusing catalog list patterns and touches no writer. S2/S3 generalize
`writeAsStudent` into an actor-aware helper, preserving statement order for
`enrollment-write.test.ts`; actions re-check `canManageEnrollments` and
scope. Strict TDD with the DB double.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/lib/data/enrollment-write.ts`, new `src/lib/data/inscripciones.ts` | Modified/New |
| `src/app/(dashboard)/catalog/inscripciones/*` | New |
| `src/lib/auth/permissions.ts`, `src/lib/catalog/list-params.ts`, `src/lib/navigation.ts` | Modified |
| `i18n/{es,en}.json`; guards, navigation, i18n parity pins | Modified |
| `docs/roadmap.md` | Modified |

**DB schema: NO.** No migration, seed or write SQL.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Last active deactivation makes student retention-eligible (RN-27) | Med | Stated in confirm copy and specs; no auto-cancel |
| PII or draft leak | Low | Facultad scope, name/CIF only, `borrador` excluded |
| Audit records student instead of staff | Low | Explicit actor parameter, tested |
| Race with student writer | Low | Same row lock |
| Slice over budget | Med | Tasks forecast and split |
| No Neon integration proof | Med | DB double; branch writes need owner confirmation |

## Rollback Plan

Revert slice PRs in reverse order. No schema change; rows written stay valid
and editable by the student. Docs revert with their PR.

## Dependencies

- None blocking. No requirement text changes (D8).

## Success Criteria

- [ ] Secretaria lists only her facultad's inscriptions with name and CIF.
- [ ] Other roles are denied page and actions.
- [ ] Each staff write emits one `inscripcion.*` entry with the staff actor.
- [ ] Deactivation confirm shows the non-draft request count.
- [ ] Change group replaces the sibling after a confirm naming it.
