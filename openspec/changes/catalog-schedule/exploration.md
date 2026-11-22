# Exploration: catalog-schedule, first slice (secretaría view and maintenance of Inscripcion)

Covers RF-12 (a)(b)(c) and RF-17 (a)–(e). Touches RNF-01, RNF-02, RNF-06, RNF-11, RNF-12 and RN-21, and relates to RN-27. Out of scope: RN-22 clock-time schedules, RN-21 registry access, RNF-13 xlsx import.

## Current state

**Schema** (`src/db/schema.ts:236-254`)

- `Inscripcion` has only `estudianteId`, `grupoId` and `activo`, with a composite primary key and `IX_Inscripcion_Grupo`.
- It has no period, no `Origen`, no author and no timestamp. The period comes from `Grupo.periodo`, and authorship lives only in the audit row.
- `Grupo.docenteId` is NOT NULL.
- `Usuario.cif` is unique and nullable. A cancelled account (`canceladoEn`) is inactive, with CIF, email and phone nulled.

**Only writer** (`src/lib/data/enrollment-write.ts`)

- `enrollInGroup` and `dropGroup` both run through `writeAsStudent(estudianteId, work)`. That helper locks the student's `Usuario` row (`FOR NO KEY UPDATE`), checks role `estudiante` and active, runs the work, then inserts audit rows in the same transaction.
- The audit actor is hard-wired to the student (`insertAuditEvents(tx, estudianteId, …)`). A staff writer needs a separate actor parameter.
- `enrollInGroup` only accepts offered groups: active group, active asignatura and `periodo = latestPeriod`, evaluated at write time.
- It deactivates sibling groups of the same asignatura and period, and reuses an existing row as `reactivada`. Nothing deletes (D7).
- `src/lib/data/inscripcion-writes.test.ts` pins `ALLOWED_WRITERS = ["lib/data/enrollment-write.ts"]` and forbids writes to `inscripcion` anywhere else. A staff writer kept in the same file needs no allowlist change.
- Types: `src/lib/enrollment/types.ts`. Validation: `enrollmentInputSchema` in `src/lib/validations/inscripcion.ts`.

**Student reads**

- `src/lib/data/enrollment-picker.ts`: `listMyEnrollments` is student-scoped (effective rows only, `inOpenRequest` flag). Not reusable for staff.
- `src/lib/data/enrollment.ts`: `ACTIVE_ENROLLMENT` feeds the intake subject list, so a staff change reaches intake immediately.
- `src/lib/data/retention.ts:77`: an active inscripcion blocks cancelling a student's data (RN-27). A staff deactivation can make a student eligible for retention.

**Audit** (`src/lib/audit/events.ts`, `src/lib/audit/types.ts`)

- `inscripcionEvent` emits `inscripcion.creada`, `.reactivada` and `.desactivada`. The entity is the student and the payload is `{grupoId, motivo?: "baja"|"reemplazo"}`.
- The actor is stored on the audit row, so staff and student writes are already distinguishable.
- `types.test.ts` and `events.test.ts` pin the three inscripcion codes. New codes or `motivo` values touch those pins.

**Guards and scope**

- `canManageCatalog` equals `canCreateUsers`: administrador, coordinacion and secretaria (`src/lib/auth/permissions.ts:65`). `docs/requirements.md` already flags this as open.
- `requireCatalogAccess()` returns `{actorId, scope}`. `catalogScopeFor` gives coordinacion `{carrera}` and everyone else `{all}`. Scope SQL: `src/lib/data/catalog-scope-sql.ts`.
- A second scope exists for student PII: `requestScopeFor` / `requestInScope` limits a secretaria to the facultad of the student's carrera (SR-6). Drafts never reach staff (`VISIBLE_STATES` excludes `borrador`).

**Catalog patterns to reuse**

- Lists: `catalog/asignaturas/page.tsx` (guard as first await, `parse*ListParams`, data function returning `{data,total,page,pageSize,degraded}`, table, `DegradedAlert`). URL state in `src/lib/catalog/list-params.ts`; `CatalogListBase` is a closed union that must be extended for a third list. Search uses `containsPattern`, sorting uses `sort-sql`.
- Mutations: `catalog/active-toggle.tsx` (two-step confirm on deactivate, one press on reactivate, Server Action with `FormData{id,intent}`); `src/lib/catalog/action-helpers.ts` (`addressed`, `actionOutcomes`, `revalidateRecord`); `withCatalogWrite` in `src/lib/data/catalog-write.ts` (advisory lock + audit). The enrollment writer uses the student row lock instead.
- Docentes: `catalog/docentes/page.tsx` is read-only; docentes are created only through `/users/new`. No edit or deactivate path exists.
- Student UI shape (`enrollment/my-enrollments.tsx`, `confirm-change-dialog.tsx`) is bound to the student's actions; only the shape is reusable.

**Structural tests the slice will touch**

- `catalog/guards.test.ts`: exact set of catalog pages, and "list pages render no form or button".
- `src/lib/navigation.test.ts`, `(home)/page.test.tsx`, `page-context.test.tsx`: nav structure and shortcuts.
- `src/i18n/catalog-parity.test.ts`: `GUARDED_SECTIONS` for new keys in `i18n/es.json` and `i18n/en.json`.
- Data tests use the scripted DB double (`src/lib/data/test-support/db-double.ts`); refactoring `writeAsStudent` must keep the statement order or `enrollment-write.test.ts` breaks.
- `enrollment-presented.integration.test.ts` needs a Neon branch; not run here.

## Affected areas

- `src/lib/data/enrollment-write.ts`: generalize actor versus student, add staff operations.
- New `src/lib/data/inscripciones.ts` (staff list), `list-params.ts` entries, and a page and table under `src/app/(dashboard)/catalog/inscripciones/`.
- `src/lib/auth/permissions.ts`: a named predicate such as `canManageEnrollments`.
- `src/lib/navigation.ts`, `i18n/{es,en}.json`, and the pins above.
- `src/lib/audit/*` only if a new `motivo` is chosen.
- Docs: `docs/roadmap.md` row 0.
- Schema: no change needed. An `Origen` or author column was rejected in D10 and would need explicit owner confirmation.

## Open decisions for the owner

1. **May the secretaría create an inscription on behalf of a student?**

   | Option | Pros | Cons | Effort |
   | --- | --- | --- | --- |
   | A. List plus deactivate and reactivate | Smallest; no student lookup or group picker. | RF-12 (a) says "crea, edita": creation not covered. | Low–Med |
   | B. A plus change group | Covers "edita" via the sibling-replace rule. | Group picker and replace confirmation (RNF-12). | Med |
   | C. B plus create for a student with no row | Satisfies RF-12 (a) fully. | Student search over students with no inscripcion (new PII surface); period rule to decide. | High |

   Recommendation: A first, then B and C as later slices of the same change.

2. **Roles.** Reuse `canManageCatalog` (consistent, no new logic) or secretaria only (matches RF-12 and least privilege, diverges from the catalog guard). Recommendation: a named predicate `canManageEnrollments`, initially equal to `canManageCatalog`, with the divergence recorded.
3. **Scoping.** `CatalogScope` on the group's asignatura carrera (consistent; secretaria sees all) or the student's facultad as in SR-6 (stricter for PII). Recommendation: `CatalogScope` plus minimal PII (name and CIF only); confirm that secretaria sees all carreras.
4. **Route and nav.** `/catalog/inscripciones` in the Administración group. Needs `guards.test.ts`, `navigation.test.ts` and `CatalogListBase` updates; the toggle lives in a client component.
5. **Search and filters.** Student (name or CIF), asignatura (code or name), group number, period, status (default active). Show effective versus raw state. Default period: latest.
6. **Interaction with RF-17 (b).** Staff activation reuses the sibling rule with a confirmation naming the replaced group. Last writer wins. A staff deactivation is not sticky (the student can re-enroll) without a schema column. Whether staff may act on older periods is open.
7. **Deactivation and submitted requests (RF-17 e).** Submitted requests reference the group, so they are unaffected. A staff warning must not reveal drafts (D7); at most count `devuelta` and submitted requests naming the group.
8. **Docentes gap in RF-12 (a).** Different feature (own writer and UI). Recommendation: separate change or slice.

## Approaches

| Approach | Pros | Cons | Effort |
| --- | --- | --- | --- |
| 1. Chained slices: read-only list, then deactivate/reactivate, then create/change group | Fits the 400-line budget; each slice shippable. | Several PRs. | ~700 + 500 + 600 lines (estimate) |
| 2. One PR | One walk. | Far over budget. | Same total |
| 3. Staff writer generalized in the same file | Allowlist and role-integrity rule keep applying; shared tx, lock and audit. | Refactor of tested code (DB-double order). | Low–Med |
| 4. Separate staff writer file | No refactor. | Allowlist change, duplicated logic, drift. | Med |

## Recommendation

Approach 1 with Approach 3. Slice 1 is the read-only staff list (filters, paging, nav, i18n, pinned tests, degraded handling) and touches no writer. Slice 2 adds deactivate and reactivate through the generalized writer, reusing `ActiveToggle` and the existing audit codes. Later slices add create and change group. Line figures are estimates, not measurements.

## Risks

- Audit actor: staff writes must record the staff actor, not the student.
- Race with the student's writer: the staff writer must take the same `Usuario` row lock.
- Retention (RN-27): deactivating the last active inscripcion may make a student eligible for cancellation.
- PII exposure: name and CIF in the list; the scope choice carries privacy weight (SR-6 facultad limit).
- Draft leak: a staff warning must never reveal a `borrador`.
- Brittle pins in guards, navigation, audit and i18n parity tests.
- No integration proof without a Neon branch; writes there need explicit owner confirmation per command.

## Ready for proposal

Yes, once the owner answers decisions 1, 2, 3 and 7. Decisions 4, 5, 6 and 8 have recommended defaults for the proposal.
