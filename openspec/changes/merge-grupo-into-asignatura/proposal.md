# Proposal: Merge Grupo into Asignatura (one catalog row per class)

> **This change TOUCHES THE DATABASE SCHEMA and is DESTRUCTIVE.** A hand-written
> migration `0007` rewrites `Asignatura`, re-points `Inscripcion` and drops the
> `Grupo` table. No migration, branch operation or write SQL may run against
> Neon without the owner's explicit confirmation for that command.
> `drizzle-kit push` is never used. Past the drop, only a Neon branch restore
> goes back.

## Intent

Secretaría maintains two catalogs, Asignaturas and Grupos, that are really one:
a group has no meaning without its subject, and the import carries them on two
sheets that must agree. The owner wants **Asignatura** and **Docente** as the
only catalogs. Each Asignatura row becomes one **class**, identified by subject
code plus group number.

This **reverses** parts of `catalog-management`: Grupo management, the Grupos
section of the Asignatura page, the rule "deactivating an Asignatura with active
Grupos is refused" (its decision D4) and the mandatory docente.

Owner decisions (2026-10-09, binding) are **D1-D9**. Everything marked
**A1-A12** is an assumed default the owner has not confirmed.

## Owner Decisions

| # | Decision |
|---|---|
| D1 | The catalogs are Asignatura and Docente only. The `Grupo` table and the `/catalog/grupos` pages are removed |
| D2 | One Asignatura row is one class: subject code + group number. The pair is unique |
| D3 | The group number is mandatory |
| D4 | One code may have several groups, on different days or on the same day |
| D5 | The docente is optional on a class. One docente may teach several groups |
| D6 | **Docente rule**: two groups of one code that share at least one meeting day and both have a docente must have different docentes. A class without docente never conflicts |
| D7 | The meeting days are a field of the class row (same bitmask, `src/lib/catalog/dias.ts`) |
| D8 | One term at a time: each term's catalog replaces the previous one. `Periodo` is removed |
| D9 | `Nombre`, `CarreraId` and `HorasTotales` belong to the subject: every row of one code carries the same values. Editing them on one row updates all rows of that code in the same transaction, under the same lock, audited. The import refuses a workbook whose rows of one code disagree |

## Scope

### In Scope

- **Schema (`0007`)**: `Asignatura` gains the group number, the optional
  docente, `Dias` and `Origen`; `Codigo` stops being unique on its own and
  (`Codigo`, group number) becomes the unique key; `Inscripcion` is re-pointed
  to the class row; `Grupo` is dropped with its `Periodo` column.
- **Docente rule (D6)** enforced in the database and pre-checked in the
  application and in the import planner; re-checked on reactivation and on any
  docente or days edit.
- **Subject fields (D9)**: propagation on manual edit; adding a group to an
  existing code takes the subject fields from that code.
- **Manual management**: `/catalog/asignaturas` lists, creates, edits,
  deactivates and reactivates class rows. Access, carrera scoping, the
  "nothing is deleted" rule and same-transaction auditing are unchanged.
- **Import**: two sheets. `Docentes` is unchanged. `Asignaturas` carries one row
  per class: `Codigo`, `Nombre`, `Carrera`, `HorasTotales`, `Grupo`, optional
  `CorreoDocente`, optional `Dias`. A workbook in the old three-sheet layout is
  refused with a message that names the new layout. The template and the
  contract card follow.
- **Removal**: the `/catalog/grupos` routes, the Grupos section of the
  Asignatura edit page, the Grupo data layer, validation, actions, audit
  builders, sidebar entry, i18n keys and their tests.
- **Docs**: `modelo_datos_sql.md`, the workbook template and `es`/`en` copy.

### Out of Scope

- The justification request (`Solicitud`, `SolicitudDetalle`) and who handles a
  request for a class without docente.
- Any writer of `Inscripcion`, and student accounts.
- Term history: no archive of a previous term's classes.
- Hours of the day, classrooms, calendars.
- Editing or deactivating user accounts; the Docentes list stays read-only.
- `Facultad` and `Carrera` management.
- Rewriting or deleting past audit rows.
- Physical deletion of a class row by any application path.

## Schema Impact

| Object | Change |
|---|---|
| `Asignatura` | + group number (`NOT NULL`), + `DocenteId` (nullable, FK `Usuario`), + `Dias`, + `Origen`, with the existing CHECKs moved over |
| `Asignatura.Codigo` | UNIQUE (`Codigo`) replaced by UNIQUE (`Codigo`, group number) |
| Docente rule | Seven partial unique indexes, one per weekday bit, on (`Codigo`, `DocenteId`) where active, docente not null and that bit set |
| `Inscripcion` | `GrupoId` re-pointed to the class row (column name for design) |
| `Grupo` | Dropped, including `Periodo` and its indexes |

- **Data-preserving**: each subject x group pair becomes a class row. The
  existing Asignatura row is reused for its lowest-id group, so its id and its
  past `asignatura.*` audit rows stay valid; the other groups become new rows.
- **Preflight (read-only, no confirmation needed)**: key collisions once
  `Periodo` is gone, docente overlaps that would violate D6, and the count of
  `Inscripcion` rows. The migration must refuse to run on unresolved findings
  instead of guessing.
- **Not a table constraint**: the equality of subject fields across the rows of
  one code (D9) is kept by the application and the import. The migration starts
  it consistent by copying from the parent row.
- **Procedure**: hand-written, with a structural test like `0005` and `0006`.
  Rehearse on a fresh Neon branch, then the shared database in a short
  maintenance window, each command confirmed individually.

## Relationship to `catalog-management`

- It is committed (`d3a3997`) but **not verified or archived**, with more than
  twenty open owner tasks, many about Grupo pages this change deletes.
- `openspec/specs/` has `academic-catalog`, `audit-log` and
  `catalog-excel-import`; the `catalog-management` capability exists only in
  that change folder.
- **Required order**: verify and archive `catalog-management` first, waiving the
  Grupo-only smoke items, so this change writes REMOVED and MODIFIED deltas
  against main specs. Writing deltas against an unarchived change is the
  fallback, not the plan.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `academic-catalog`: Grupo requirements removed; the class key, mandatory group
  number, optional docente, days and origin on the Asignatura row; the docente
  rule; subject-field equality; `Periodo` removed; the Inscripcion target.
- `catalog-management`: Grupo management and the Grupos section removed; class
  create, edit, deactivate and reactivate; the deactivation refusal withdrawn;
  propagation of subject fields; docente-rule refusals.
- `catalog-excel-import`: two-sheet contract, refusal of the old layout,
  per-class rows, blank docente, deactivate-absent over every class row,
  subject-disagreement and docente-overlap errors, preview counts.
- `audit-log`: `grupo.*` events are no longer emitted and remain in history; the
  Asignatura field list widens; the import payload loses its Grupo figures.

`imported-account-provisioning` and `forced-password-change` are not modified.

## Approach

Exploration approach **A** (full merge). B (keep `Grupo`, inline editing) and C
(compatibility view) were rejected: both keep two tables and two write paths.

- **One pure rule, three callers.** The docente rule is a pure function over a
  set of class rows, used by the manual write (inside `withCatalogWrite`, after
  the lock), by the import planner (over the state the import would leave), and
  mirrored by the indexes as the last line of defence.
- **The planner decides, the apply never discovers.** A unique violation in the
  middle of an apply aborts the import, so every conflict must surface in the
  dry run as a row error.
- **Ordered apply.** The indexes are not deferrable; the apply must deactivate
  and clear before it assigns, so a swap of docentes inside one workbook does
  not fail halfway.
- **Build beside, then remove.** The class modules are built next to the Grupo
  code and the pages switch over before the Grupo code is deleted, so each
  review slice typechecks and passes its tests.

### Work units

Sizes split the exploration total (13,000 to 16,000 changed lines, about 7,000
deleted, about 120 files). In the two previous changes real sizes ran above
first estimates.

| WU | Content | Est. lines | Rollback boundary |
|---|---|---|---|
| WU1 | `0007`, its test, `schema.ts`, `modelo_datos_sql.md`, the pure docente rule | 900-1,300 | Revert; nothing applied yet |
| WU2 | Class data layer: scoped reads, writes, propagation, pre-check | 1,800-2,400 | `git revert` |
| WU3 | Audit union and builders | 500-800 | `git revert` |
| WU4 | Validation and Server Actions | 1,200-1,600 | `git revert` |
| WU5 | Pages, form, list, sidebar, i18n | 2,000-2,600 | `git revert` |
| WU6 | Import: contract, schemas, planner, apply, preview, template, fixtures | 3,000-4,000 | `git revert`; import returns to three sheets |
| WU7 | Removal of Grupo code, routes, tests and copy | mostly deletions | `git revert` |
| WU8 | Rehearsal, cutover, smoke | no code | See Rollback Plan |

**The cached `single-pr` strategy cannot hold this change** (16 to 20 slices at
800 lines). See Open Question 1.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/db/schema.ts`, `drizzle/0007_*.sql`, `drizzle/meta/*` | Modified/New | Class columns, key, indexes; `grupo` removed |
| `src/db/migration-0007.test.ts` | New | Structural test of the migration |
| `modelo_datos_sql.md` | Modified | `Asignatura`, `Inscripcion`, `SolicitudDetalle`; `Grupo` removed |
| `src/lib/data/asignaturas.ts`, `catalog.ts`, `catalog-scope-sql.ts` | Modified | Class reads and writes, snapshot, scope |
| `src/lib/data/grupos.ts` | Removed | Folded into the class data layer |
| `src/lib/catalog/` (`types.ts`, `origen.ts`, `dias.ts`, `list-params.ts`) | Modified | Class types, outcomes, the pure rule |
| `src/lib/validations/catalog*.ts` | Modified | One class form schema |
| `src/lib/audit/types.ts`, `events.ts` | Modified | Field list, retired builders |
| `src/lib/import/*` | Modified | `sheets`, `schemas`, `plan`, `apply`, `types`, `summary`, template, fixtures |
| `src/app/(dashboard)/catalog/asignaturas/*` | Modified | List, form, edit; Grupos section removed |
| `src/app/(dashboard)/catalog/grupos/*` | Removed | Pages, form, actions, tests |
| `src/app/(dashboard)/catalog/import/*`, `src/app/api/catalog/template/*` | Modified | Contract card, preview, errors, template |
| `src/components/app-sidebar.tsx` | Modified | Grupos entry removed |
| `i18n/es.json`, `i18n/en.json` | Modified | Identical key sets |
| `docs/PlantillaCatalogo.xlsx` | Modified | Two-sheet template |
| `src/lib/data/inscripcion-writes.test.ts` | Unchanged | Still pins "no writer" |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Irreversible migration on the shared database | Med, high impact | Read-only preflight; rehearsal on a fresh branch; backup branch before cutover; per-command confirmation |
| Groups of different periods collide on (code, group number) | Unknown until preflight | A2; the rehearsal reports every row not carried over; the owner approves the list |
| Existing data already violates D6 | Unknown until preflight | Preflight lists the pairs; the owner fixes them before the migration |
| Subject fields drift between rows of one code | Med | One write path under the lock; planner check; a structural test; a read-only consistency query at verify |
| An incomplete workbook deactivates most of the catalog | Med, high impact | Preview states the deactivation count before confirm; nothing is deleted; a re-import reactivates |
| A unique violation aborts an apply | Med | Planner evaluates D6 on the resulting state; ordered apply |
| Classes with no days recorded escape D6 | Certain | Stated; see Open Question 4 |
| Row identity spans terms: a later term reuses the row | Certain | No reader today; recorded as a constraint on the future Solicitud change (Open Question 3) |
| Old `grupo.*` audit rows reference ids that no longer exist | Certain | Entity type keeps them distinguishable; no row is edited; documented |
| Staff upload the old three-sheet workbook | High at first | Refused before any row is read, with a message and the new template |
| A scope or authorization check lost in the rewrite | Med, high impact | Existing guard, scope-inventory and leak tests are carried over, not rewritten from memory |
| Size overrun and reviewer fatigue | High | Chained slices of at most 800 lines; deletion-heavy slices kept apart |
| `catalog-management` left unarchived | Med | Archive first; otherwise deltas target a change folder |

## Rollback Plan

1. **Nothing applied**: `git revert` the slices; delete `0007` and its journal
   entry.
2. **Failure during `0007`**: it runs in one transaction and rolls back whole.
3. **After `0007` is applied**: there is no down migration. Restore the Neon
   backup branch taken immediately before the cutover and redeploy the previous
   commit. Catalog writes made after the cutover are lost, which is why the
   cutover runs in a maintenance window and is smoke-tested before it reopens.
4. **Per slice before cutover**: WU2 to WU7 carry no applied schema and revert
   independently in reverse order.
5. **Bad data after cutover**: corrected by a manual write or a re-import; each
   leaves its own audit row.

## Dependencies

- `catalog-management` verified and archived.
- The read-only preflight results, before the design is closed.
- Explicit owner confirmation for each Neon command, including branch creation.
- The delivery decision (Open Question 1).
- A `docs/design-system.md` check for the merged form and list.

## Assumed Defaults to Confirm

| # | Assumed default | If wrong |
|---|---|---|
| A1 | An existing Asignatura with no group becomes one class with group number `1` | Needs another placeholder, or those subjects are left out |
| A2 | Groups of different periods that collide on (code, group number): keep the active one, otherwise the one of the most recent period; the others are not carried over and are listed in the rehearsal report. If a row not carried over has `Inscripcion` rows, the migration stops | The owner resolves each collision by hand before the migration |
| A3 | `Origen` moves to the class row with the same meaning (how the row was created, set once) | The manual-deactivation warning of the import is dropped |
| A4 | A migrated class is active only when both its Asignatura and its Grupo were active | Some inactive records reappear as active |
| A5 | The workbook is the complete current catalog: a class row absent from it is deactivated, never deleted | Deactivate-absent needs an opt-in |
| A6 | A blank `CorreoDocente` cell means "no docente" and clears a stored one | A blank cell keeps the stored docente, and the import cannot remove one |
| A7 | An absent `Dias` column or an empty cell keeps the stored days (existing rule) | The import could clear days |
| A8 | A class with no days is accepted by the import; the manual form still requires at least one day (existing rule) | The form allows none, or the import rejects none |
| A9 | The code and the group number are immutable after creation | Needs a rename rule that keeps the import from duplicating the class |
| A10 | When a docente is given it must be an active user with the `docente` role (existing rule) | Weaker integrity on manual writes |
| A11 | `/catalog/grupos` URLs answer "not found"; no redirect | A redirect to `/catalog/asignaturas` is added |
| A12 | The cutover runs in a short maintenance window with catalog writes stopped | Needs a migration that tolerates concurrent writers |

## Open Questions

### For the owner

1. **Delivery (the one delivery question)**: one branch with chained review
   slices of at most 800 lines, or chained pull requests?
2. Who handles a justification request for a class without docente? Out of
   scope here; it must be answered before the Solicitud change.
3. With `Periodo` gone, a class row is reused when the same code and group
   return next term, with a different docente or days. Is it acceptable that
   the system keeps no record of which term a class row described?
4. A class with no days recorded cannot conflict under D6. Acceptable, or must
   a class with a docente have days?
5. Do you confirm A2 (which row survives a period collision)?
6. Do you confirm A6 (a blank docente cell clears the docente)?

### For spec and design

7. Drop `Grupo` inside `0007`, or keep it frozen and drop it in a later
   migration after a verification period? The second keeps the old data
   readable longer at the cost of a dead table.
8. Column names: the group number on `Asignatura`, the re-pointed `Inscripcion`
   column, and the workbook header (`Grupo` here; today's sheet uses
   `NumGrupo`).
9. How the old layout is detected: a `Grupos` sheet present, a missing `Grupo`
   column, or both.
10. Whether a propagated edit of subject fields writes one audit row or one per
    affected class.
11. Whether any audit reader must accept both shapes of the import payload.
12. The apply order that keeps the non-deferrable indexes satisfied.

## Success Criteria

- [ ] `Grupo` no longer exists in the schema, the code or the UI; the catalogs
      are Asignaturas and Docentes.
- [ ] No two class rows share a code and a group number; no row lacks a group
      number.
- [ ] A write that would break the docente rule is refused by the form, by the
      import preview and by the database, each tested.
- [ ] Editing a subject field on one class updates every class of that code in
      one transaction; a workbook whose rows of one code disagree is refused.
- [ ] A class without docente can be created manually and by import.
- [ ] The old three-sheet workbook is refused with a message naming the new
      layout; the new template uploads unchanged with zero errors.
- [ ] The import preview states how many classes it will deactivate; no code
      path deletes a class row.
- [ ] The rehearsal shows every pre-migration group either carried over or
      listed in the report, and `Inscripcion` rows re-pointed with none lost.
- [ ] Access, carrera scoping and same-transaction auditing behave as before
      for `administrador`, `coordinacion` and `secretaria`.
- [ ] `es` and `en` catalogs have identical key sets.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src` and `npm run build`
      pass; `0007` was rehearsed on a fresh Neon branch before the shared
      database.
