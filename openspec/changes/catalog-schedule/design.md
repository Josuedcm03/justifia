# Design: Catalog Schedule, Secretaría Maintenance of Inscripciones

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries a writer refactor, a new guard, a scoped list, three write flows,
> nav, i18n and a seven-PR slice plan; the repository precedent
> (`student-enrollment`) keeps decision tables over prose cuts. The deviation
> is deliberate.

> **DB.** No schema change, no migration, no seed, no write SQL. Data tests use
> the scripted double (`src/lib/data/test-support/db-double.ts`).

Binding inputs: `proposal.md` (D1-D8, final), `exploration.md`,
`docs/requirements.md` (RF-12 (a)(b)(c), RF-17 (a)-(e), RN-21, RN-27, RNF-01,
RNF-02, RNF-06, RNF-11, RNF-12). Decisions here are **CS-1..CS-10**.

## Technical Approach

Exploration approaches 1 and 3. A secretaria-only guard
(`requireEnrollmentAccess`) resolves an SR-6 facultad scope from the database on
every call. A fail-soft list (`listInscripciones`) feeds
`/catalog/inscripciones`. Staff writes reuse the private statement bodies of
`enrollment-write.ts` through an actor-aware transaction helper, so the student
path, its statement order and the writer allowlist are unchanged. Create and
change group share one server-rendered assign page with a confirmation step.

## Architecture Decisions

### CS-1. Actor-aware writer (D6)

| Option | Tradeoff | Decision |
|---|---|---|
| `writeEnrollment(actor, work)` in the same file; `enrollWork` / `dropWork` extracted as private `(tx) => Promise<R>` factories; student exports keep their signatures | Student statements byte-identical; allowlist untouched; one lock and audit path | **Chosen** |
| Separate staff writer file | Allowlist change, duplicated sibling logic, drift | Rejected |
| Add an `actorId` param to `enrollInGroup` / `dropGroup` | Every student caller and test changes | Rejected |

```ts
type EnrollmentActor =
  | { kind: "student"; estudianteId: number }
  | { kind: "staff"; actorId: number; estudianteId: number; scope: RequestScope };
```

Transaction order for both actors: (1) one lock select on the student's
`Usuario` row `FOR NO KEY UPDATE OF Usuario`, (2) `work(tx)`, (3) audit insert
via `insertAuditEvents(tx, auditActor, events)` where `auditActor` is the
student id or `actor.actorId`. The staff lock adds `INNER JOIN Carrera` and
`Carrera.FacultadId = $facultad` (`none` renders `false`); it is still one
statement, so staff tests script the same step shape. Failure logs carry the
writing actor. New exports: `staffEnrollInGroup(staff, estudianteId, grupoId)`
and `staffDropGroup(staff, estudianteId, grupoId)`.

### CS-2. Staff refusal reason

| Option | Tradeoff | Decision |
|---|---|---|
| Reuse `not_student` for "no active student in your scope"; the staff action maps it to `gone` | No change to `EnrollResult`, `DropResult`, `EnrollmentErrorCode`; foreign and missing ids answer alike | **Chosen** |
| New `out_of_scope` reason | Widens shared unions and the student action's error mapping | Rejected |

### CS-3. Period rule for staff writes (D7, out-of-scope "older periods")

`staffEnrollInGroup` reuses `enrollWork` unchanged (offered groups of the latest
period only), so create, change group and reactivate need an offered group.
Deactivation is allowed on a row of any period (owner decision D9,
2026-11-19): a stale active row of an older period would otherwise block the
RN-27 retention cancellation forever. `dropWork(estudianteId, grupoId)` is
reused unchanged by staff (same SQL as the student path); no `latestOnly` flag.

### CS-4. Permission and guard (D2, D3)

`rolesQueGestionanInscripciones = ["secretaria"] as const satisfies readonly
RolUsuario[]` and `canManageEnrollments` in `permissions.ts`, shaped like
`rolesRevisores`. New `src/lib/auth/enrollment-access.ts`:
`requireEnrollmentAccess()` → `requireRole(...rolesQueGestionanInscripciones)`,
validates `session.sub` like `requireCatalogAccess`, reads `Usuario.FacultadId`,
returns `{ session, actorId, scope: requestScopeFor(rol, actor) }`. Fail loud.
`requireCatalogAccess` is not used: it admits administrador and coordinacion.
A `none` scope renders a no-facultad state, queries nothing.

### CS-5. Scope SQL in the single SR-6 module

`request-scope-sql.ts` gains `enrollmentInScope(scope)` (exists over the
student's current carrera, keyed on `Inscripcion.EstudianteId`) and
`studentRowInScope(scope)` (keyed on `Usuario.Id`, for the assign page search).
A private `studentOfFacultad(column, facultadId)` builds the exists;
`requestInScope` keeps its rendered SQL (its tests are the proof).

### CS-6. Staff list (D3, D5)

`listInscripciones({ scope, q, asignatura, grupo, periodo, status, page,
pageSize, sort })` in new `src/lib/data/inscripciones.ts`, returning
`CatalogListResult<InscripcionListItem>`; `try/catch` → `degraded: true`.
Joins `Inscripcion → Usuario` (name, CIF only), `Grupo`, `Asignatura`. Per row:
raw `activo`; `effective` (`activo ∧ Grupo.Activo ∧ Asignatura.Activo`);
`writable` (`Grupo.Periodo = latest`); `hasActiveSibling` (another effective row
of the same asignatura and period); `dependentRequests` (CS-7). Filters: `q`
`containsPattern` on name or CIF; `asignatura` on code or name; `grupo` exact
number; `periodo` exact (default `getLatestPeriod()`); `status` on the
effective state (default `active`). `listInscripcionPeriods(scope)` feeds the
period select. `list-params.ts`: `CatalogListBase` adds
`"/catalog/inscripciones"`, plus `INSCRIPCIONES_SORT_KEYS = ["student",
"subject", "group"]`, `parseInscripcionesListParams`, and an `extra` map in
`catalogListHref` for the three extra filters.

### CS-6b. Audited reads (D10)

Two new audited-read helpers join `src/lib/data/request-reads.ts`, following
`recordQueueRead`: `recordEnrollmentListRead(actorId, facultadId, payload)` and
`recordEnrollmentStudentSearch(actorId, facultadId, payload)`, each wrapped in
`cache()` and one `db.transaction` with `insertAuditEvents`. New events in
`src/lib/audit/events.ts` and `types.ts`: `inscripcion.lista.consultada` and
`inscripcion.estudiantes.consultada`, entity type `Facultad`, payload
`{ periodo, status, filters: { q, asignatura, grupo } as booleans, page, total }`
(no search text, no ids typed as filters, no student data). The page calls the
helper after authorisation and after the data loaded, and never in the
degraded branch; a failed insert throws to the error boundary, so no data is
shown without its row (same contract as SR-11). The pinned closed sets in
`src/lib/audit/types.test.ts` and `events.test.ts` gain the two actions.
`recordEnrollmentListRead` lands in S1b; the student-search helper in S3a.

### CS-7. Dependent-request count (D4)

One correlated `count(*)` column: `SolicitudAsignatura.GrupoId = row.grupoId ∧
Solicitud.EstudianteId = row.estudianteId ∧ Solicitud.Estado IN
VISIBLE_STATES`. `borrador` is excluded by the constant, never by a literal;
the number never includes or hints at drafts. A test renders the SQL and
asserts `'borrador'` is absent and every visible state present.

### CS-8. Confirmation flows (RNF-12)

| Action | Flow |
|---|---|
| Deactivate | `ActiveToggle` two-step; `notice` = plural count sentence ("N submitted requests use this group; they do not change") plus a fixed RN-27 sentence about the last active inscription |
| Reactivate | Single press, offered only when `writable ∧ ¬hasActiveSibling`. In S2 the staff reactivate also re-checks for an active sibling inside the transaction, under the `Usuario` row lock, and refuses with nothing changed if one exists (spec EA-REACT-1), so a race never replaces in S2; the replace path arrives with EA-SIB-1 in S3 |
| Change group / create | `/catalog/inscripciones/assign?estudiante=&asignatura=`: server-rendered picker of latest-period groups (`listEnrollableGroups`), the student's current group marked; a client confirm step names student, asignatura, new group and, when present, the replaced group |

`ActiveToggle` is reused unchanged; the composite key travels as
`setInscripcionActivoAction.bind(null, estudianteId)` with `id = grupoId`. Bound
arguments are client-visible (Next `forms.md`), so the action re-validates them
with zod and the scope.

### CS-9. Server actions

`src/app/(dashboard)/catalog/inscripciones/actions.ts` (`"use server"`, async
exports only): first statement `await requireEnrollmentAccess()`, then zod,
then the staff writer. `not_student` → `gone`, `not_enrolled` → `unchanged`,
`not_eligible` / `already_enrolled` → error copy, throw → `unexpected`.
`revalidatePath("/catalog/inscripciones")`.

### CS-10. Guard tests and nav

`catalog/guards.test.ts` lists `SEGMENTS` explicitly and its pins assert
`requireCatalogAccess(`, so it stays untouched. New
`catalog/inscripciones/guards.test.ts` repeats its source checks for
`requireEnrollmentAccess(`: exact page set, guard as first await, no action
import in pages, no mutating control in `page.tsx`, actions guarded before any
form read, only async exports. `catalog-structure.test.ts` `ACTION_DIRS` is not
extended (those writes go through `enrollment-write.ts`). Nav: an
`administration` child `catalogInscripciones` after `catalogDocentes`,
`visibleTo: canManageEnrollments`. Pins to update: `navigation.test.ts`,
`app-sidebar.test.tsx`, `page-context.test.tsx`, `(home)/page.test.tsx`,
`navigation-mock.test.tsx`, `catalog-parity.test.ts` (`SHORTCUT_KEYS`,
`GUARDED_SECTIONS` + `nav.catalogInscripciones`, `catalog.inscripciones`), and
`dashboard.shortcuts.catalogInscripciones` in both locales.

## Data Flow

    secretaria ─GET─→ page.tsx ─→ requireEnrollmentAccess ─→ scope(facultad)
                          └──→ listInscripciones(scope, filters) ─→ table
    table(ActiveToggle) ─POST─→ actions.ts ─→ staffDropGroup ─→ tx

Staff deactivation:

    UI        Action                 Writer (tx)                 DB
    confirm → requireEnrollmentAccess
              zod(estudianteId,grupoId)
              staffDropGroup ──────→ lock Usuario ∧ facultad ──→ FOR NO KEY UPDATE
                                     dropWork              ────→ UPDATE Inscripcion
                                     insertAuditEvents(staff) ─→ INSERT EventoAuditoria
              ← done | unchanged | gone
              revalidatePath

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/auth/permissions.ts` | Modify | `rolesQueGestionanInscripciones`, `canManageEnrollments` |
| `src/lib/auth/enrollment-access.ts` | Create | `requireEnrollmentAccess` |
| `src/lib/data/request-scope-sql.ts` | Modify | `enrollmentInScope`, `studentRowInScope` |
| `src/lib/catalog/list-params.ts` | Modify | third list base, parser, `extra` |
| `src/lib/data/inscripciones.ts` | Create | list, periods, student search, assign read |
| `src/lib/data/enrollment-write.ts` | Modify | CS-1, CS-3 |
| `src/app/(dashboard)/catalog/inscripciones/{page,inscripciones-table,actions}.tsx?` | Create | list and actions |
| `src/app/(dashboard)/catalog/inscripciones/assign/{page,assign-form}.tsx` | Create | create / change group |
| `src/lib/navigation.ts`, `i18n/{es,en}.json` | Modify | nav item, copy |
| `docs/roadmap.md` | Modify | row 0 only |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | predicate, scope builder, list params, SQL of scope and count | vitest, `PgDialect` render |
| Unit | student writer order unchanged; staff lock, audit actor, in-transaction sibling refusal on reactivate | existing `enrollment-write.test.ts` untouched plus a staff block on the double |
| Unit | list and assign reads, degraded | DB double |
| Integration | table, toggle notice, assign confirm, actions mapping | Testing Library, mocked guard |
| Structural | guards, nav, i18n parity, writer allowlist | source scans |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation or executable-file
classification. Authorization (CS-4, CS-9), scope (CS-5) and draft leak (CS-7)
are covered by the RED tests above.

## Slice Plan (400-line budget, tests included)

| Slice | Content | Forecast |
|---|---|---|
| S1a | CS-4, CS-5, list params | ~280 |
| S1b | `listInscripciones`, periods, CS-7, CS-6b list-read audit | ~370 |
| S1c | list page, read-only table, nav, i18n, pins, new guards test | ~390 |
| S2a | CS-1..CS-3 writer refactor, staff writer | ~260 |
| S2b | toggle action, table wiring, copy | ~330 |
| S3a | student search, assign read, assign action, CS-6b search audit | ~340 |
| S3b | assign page, confirm form, list link, copy | ~360 |

S1c is closest to the budget; `sdd-tasks` moves nav pins to their own PR if
its forecast exceeds 400.

## Migration / Rollout

No migration required. Revert slices in reverse order.

## Open Questions

- [x] CS-3 period rule: resolved by the owner on 2026-11-19 (D9). Deactivation
  works on any period; create, change group and reactivate need an offered
  group of the latest period.
