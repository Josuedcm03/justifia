# Proposal: Manual Catalog Management (Catálogos)

> **This change TOUCHES THE DATABASE SCHEMA** (two additive columns in one
> drizzle-generated migration, `0005`). No migration, branch operation or write
> SQL may run against Neon without the user's explicit per-command confirmation.
> `drizzle-kit push` is never used.

## Intent

Today the only way to change an `Asignatura` or a `Grupo` is to re-upload the
whole Excel workbook, and only `secretaria` can do that. A single wrong docente
on one group, or one subject that is no longer offered, costs a full re-import.
Staff need a back-office "Catálogos" module to list, create, edit and
deactivate individual catalog records.

This **reverses** an explicit exclusion of `catalog-excel-import` (its Out of
Scope item "Manual per-record CRUD" and its assumed default 5). Manual and
imported writes now coexist on the same rows, so the change must also say who
wins and make the losing side visible.

Product-owner decisions (2026-10-04, binding) are marked **D1-D5** below.
Everything marked **A1-A12** is an assumed default that can be overridden.

## Scope

### In Scope

- **Audience (D1)**: `administrador`, `coordinacion` and `secretaria` may list,
  create, edit and deactivate. Nothing is physically deleted: "delete" means
  setting `Activo` to false.
- **Asignaturas and Grupos (D2)**: full management — list, create, edit,
  deactivate, reactivate (A2).
- **Docentes (D2)**: list only, inside Catálogos, linking to `/users`. No
  write of any kind on `Usuario` in this change.
- **Carrera scoping (D5)**: `coordinacion` reads and writes only the
  Asignaturas of its own `Carrera` and the Grupos of those Asignaturas.
  `administrador` and `secretaria` are unscoped. Enforced on the server for
  every list, every form load and every action; the UI only reflects it.
- **Deactivation integrity (D4)**: deactivating an `Asignatura` that has active
  Grupos is refused; the message states how many active groups exist and that
  they must be deactivated first. No cascade.
- **Import precedence (D3)**: the import still wins. What the import writes is
  unchanged. The dry-run preview gains one explicit warning: how many of the
  groups it is about to deactivate were created manually.
- **Schema (migration `0005`, additive)**: `Asignatura.Activo` and an origin
  marker on `Grupo` (see Schema Impact).
- **Audit**: every manual create, update, deactivate and reactivate writes its
  audit row in the same transaction (A8).
- **UI**: `/catalog/asignaturas`, `/catalog/grupos`, `/catalog/docentes`, with
  search, pagination and a status filter; `new` and `[id]/edit` pages for the
  two managed entities; sidebar entries under "Administración"; es/en copy.

### Out of Scope

- Editing or deactivating user accounts (a future change on the users module).
- Creating a docente anywhere other than `/users/new`.
- `Facultad` and `Carrera` management.
- `Inscripcion` rows and student accounts.
- Read-access auditing (still deferred from RNF-02).
- The future institutional API (`docs/api-institucional/`).
- Physical deletion of any row.
- Any change to what the import writes, to `rolesAsignables`, `rolesVisibles`,
  `canImportCatalog` or `/users/new`.
- New Dialog, AlertDialog or Tabs primitives.

## Schema Impact

One drizzle-generated migration, `0005`, purely additive:

| Column | Definition | Effect on existing rows |
|---|---|---|
| `Asignatura.Activo` | `boolean NOT NULL DEFAULT true` | All become active |
| `Grupo.Origen` | `varchar NOT NULL DEFAULT 'importacion'`, CHECK in (`importacion`, `manual`) | All become `importacion` |

- **Origin marker (decision for design to confirm).** `Origen` records how the
  row was **created** and is never rewritten. Manual creates set `manual`; the
  import relies on the column default, so `apply.ts` insert code does not
  change. Backfilling `importacion` is correct because no manual write path has
  ever existed. Cost: one column, one CHECK, no data rewrite, no new index.
  Design must confirm the name, the type (varchar + CHECK versus boolean) and
  that "set once at creation" is the right semantics.
- **No audit migration.** `Accion`, `EntidadTipo` and `Datos` accept the new
  values as is; only the TypeScript union widens.
- **Procedure.** `drizzle-kit generate` produces the file locally. Applying it
  is gated: rehearse on a **fresh** Neon branch first (the earlier
  `rehearsal-audit` branch no longer exists), then the shared `production`
  database, each command confirmed individually by the user. `0003` and `0004`
  are already applied there, so `0005` builds on them.
- **Ordering.** The columns must exist before code that selects them is
  deployed; the migration ships in the first work unit, ahead of every reader.

## Relationship to `catalog-excel-import`

- That change is **implemented but uncommitted and unarchived**. `openspec/specs/`
  is currently empty, so its five specs exist only inside its change folder.
- This change modifies its behaviour: the planner reads two new columns, the
  preview gains a warning, and two of its statements ("maintenance is re-import
  only", "`Asignatura` is never deactivated") stop being true.
- **Required order**: `catalog-excel-import` should be verified and archived
  first, so the deltas written here have a main spec to apply to. If archiving
  is not possible, it must at least be committed, and this change branches from
  that commit. Writing deltas against an unarchived change is the fallback, not
  the plan.

## Capabilities

### New Capabilities

- `catalog-management`: who may manage the catalog, carrera scoping and the
  no-`CarreraId` case, list/filter/search behaviour, create/edit/deactivate/
  reactivate rules for Asignatura and Grupo, the deactivation refusal, the
  docentes list, and server-side enforcement on every entry point.

### Modified Capabilities

- `academic-catalog`: `Asignatura` gains `Activo`; the requirement "Facultad,
  Carrera and Asignatura are never deactivated" narrows to Facultad and
  Carrera; `Codigo` becomes immutable after creation; `Grupo` gains its origin
  marker; an active `Grupo` requires an active `Asignatura` and an active
  docente on manual writes.
- `audit-log`: per-record manual events for `Asignatura` and `Grupo`, the
  manual-origin discriminator and the field-names-only payload rule.
- `catalog-excel-import`: the dry-run report states how many groups to be
  deactivated are manual; the planner's treatment of an inactive `Asignatura`;
  the "no per-record CRUD" assumption is withdrawn.

`imported-account-provisioning` and `forced-password-change` are not modified.

## Approach

Exploration options **A1 + B1 + C1**, with **D2 narrowed** by decision D3: the
origin marker is added, but manual rows are **not** exempted from
deactivate-absent. Where the exploration recommended D3-only (no marker), the
owner's decision wins.

- **Pages, not dialogs.** Plain server pages and server actions following the
  `/users` pattern. Each action re-checks authorization and scope itself.
- **Access as predicates.** New predicates in `src/lib/auth/permissions.ts`,
  derived from existing ones rather than a second hand-written role list. The
  staff set already equals the roles for which `canCreateUsers` is true; design
  confirms the derivation.
- **Scope resolved on the server.** `SessionPayload` carries no `CarreraId`
  (verified in `src/lib/auth/session.ts`), so the actor's carrera is read from
  the database per request. A single scope value (all, one carrera, or none)
  is passed into every query and write so no code path can omit the filter.
- **Writes are transactions.** Each write and its audit row share one
  `db.transaction`, reusing `insertAuditEvents`.
- **Import.** The snapshot and planner read `Grupo.Origen` and
  `Asignatura.Activo`; the plan gains a count of manual groups among
  `deactivateGrupoIds`; the preview renders it. The apply writes the same rows
  as today.

### Work units

The exploration estimates 2,100 to 3,050 authored lines for Asignaturas and
Grupos alone, before the origin marker, carrera scoping and the docentes list.
In `catalog-excel-import`, real sizes ran 3 to 5 times first estimates. **One
PR inside the 800-line budget is not realistic.**

| WU | Content | Est. lines | Rollback boundary |
|---|---|---|---|
| WU1 | Schema, migration `0005`, snapshot types, widened audit union and manual builders, predicates and scope resolution, `modelo_datos_sql.md` | 600-850 | Revert code; columns are additive and may stay |
| WU2 | Asignaturas: data layer, validation, list/new/edit, actions, shared list-params and status pill, sidebar, i18n | 800-1,150 | `git revert`; no schema |
| WU3 | Grupos: same, plus asignatura/docente selection and integrity checks | 900-1,250 | `git revert`; no schema |
| WU4 | Import: planner reads, manual-deactivation warning, reactivation of an inactive Asignatura present in the workbook | 200-350 | `git revert`; import returns to current behaviour |
| WU5 | Docentes list page | 200-300 | `git revert` |

Seams: WU2 and WU3 each split cleanly at data layer versus UI if they measure
over budget. WU4 and WU5 depend only on WU1.

**The cached `single-pr` strategy conflicts with these numbers and must be
revisited with the user at the tasks phase.** This proposal does not decide it.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/db/schema.ts` | Modified | `asignatura.activo`, `grupo.origen` |
| `drizzle/0005_*.sql`, `drizzle/meta/*` | New | Generated additive migration |
| `modelo_datos_sql.md` | Modified | Both columns |
| `src/lib/audit/types.ts`, `events.ts` | Modified | New actions, entity types, manual payloads |
| `src/lib/data/` (new `asignaturas.ts`, `grupos.ts`; `catalog.ts`) | New/Modified | Paged scoped lists, transactional writes; snapshot reads new columns |
| `src/lib/validations/` (new catalog schemas), `src/lib/import/schemas.ts` | New/Modified | Id-based form schemas; shared field rules exported |
| `src/lib/auth/permissions.ts` + test | Modified | Management predicate(s) and scope |
| `src/lib/import/plan.ts`, `types.ts` | Modified | Origin and `Activo` reads, manual-deactivation count |
| `src/app/(dashboard)/catalog/import/*` | Modified | Preview warning copy |
| `src/app/(dashboard)/catalog/{asignaturas,grupos,docentes}/*` | New | Pages and actions |
| `src/lib/users/list-params.ts`, `users/page.tsx` | Modified | Generic list params; `StatusPill` extracted |
| `src/components/app-sidebar.tsx` + test | Modified | Catálogos entries |
| `i18n/es.json`, `i18n/en.json` | Modified | Identical key sets |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The next import deactivates manual groups and overwrites manual edits (C2-C4) | High | Accepted by D3. Preview warns with the manual-group count. Overwritten field edits are **not** detectable and stay silent; stated in the UI copy |
| Inactive docente still resolves in the import (C12) | Low today | No UI can deactivate a user yet. Manual forms require an active docente. Left for the users-module change; recorded in `catalog-excel-import` delta as a known gap |
| Mixed-case `Correo` from `/users/new` collides in the planner map (C10) | Low-Med | Not introduced or fixed here (`/users/new` is out of scope); recommended follow-up |
| Migration on the shared database | Med | Additive only; fresh-branch rehearsal; per-command confirmation; never `push` |
| Scope filter omitted on one path | Med, high impact | One scope value threaded through every query; tests per entry point with a foreign-carrera record and a hand-crafted request |
| Sidebar active state: `/catalog` prefix matches `/catalog/import` | Med | Distinct leaf routes; no entry claims `/catalog` |
| Widened audit union breaks existing builders | Med | Additive variants; existing `buildAuditEvents` tests stay untouched and green |
| Deltas written against unarchived specs | Med | Archive or commit `catalog-excel-import` first |
| Field-names-only audit limits what a reviewer can reconstruct | Certain | By design (RNF-05); documented |
| Size overrun | High | Five slices with pre-identified split seams |

## Rollback Plan

1. **Nothing applied**: `git revert`, delete `0005` and its journal entry.
2. **Migration failure**: drizzle runs it in one transaction; it rolls back whole.
3. **After `0005` is applied**: prefer leaving both columns in place. Their
   defaults make the pre-change code behave exactly as before. A compensating
   migration may drop them, with user confirmation, losing only origin and
   Asignatura state.
4. **Per slice**: WU2-WU5 carry no schema and revert independently.
5. **Bad manual write**: corrected by another manual write or a re-import; each
   leaves its own audit row. No audit row is ever edited.

## Dependencies

- `catalog-excel-import` verified and archived (or at least committed).
- Explicit user confirmation for each Neon command, including branch creation.
- A delivery-strategy decision at the tasks phase.
- A `docs/design-system.md` check for the status filter and the deactivate control.

## Assumed Defaults to Confirm

| # | Assumed default | If wrong |
|---|---|---|
| A1 | `Asignatura.Codigo` is immutable after creation (closes C5) | Needs a rename rule that keeps the import from duplicating the subject |
| A2 | Reactivation is in scope for Asignatura and Grupo | Deactivation becomes one-way until the next import |
| A3 | Lists show active rows by default, with an active/inactive/all filter and a status column | Different default filter |
| A4 | **Decided by the owner (2026-10-04), no longer an assumption:** an Asignatura present in the workbook is reactivated by the import if it was deactivated manually, consistent with "the import wins"; the dry-run preview reports it as a reactivation before confirm | — |
| A5 | Withdrawn by the decision in A4: a workbook Grupo row whose Asignatura is in the same workbook is never an error on account of that Asignatura being inactive, because the import reactivates it | — |
| A6 | Separate pages per entity, `/users` pattern, no dialog or tabs primitives | New primitives added to the design system first |
| A7 | Creating or editing a Grupo requires an active Asignatura and an active user with the `docente` role, validated on the server | Weaker integrity on manual writes |
| A8 | Every manual write audits in the same transaction, field names only, never values, with a manual-origin discriminator; union widened, table not migrated | Different audit granularity |
| A9 | Access is expressed as predicates in `permissions.ts`, no second role list | — |
| A10 | A `coordinacion` user with null `CarreraId` sees nothing, gets an explanatory empty state, and every write is refused | They would need an explicit unscoped or blocked-at-login rule |
| A11 | A `coordinacion` user creates Asignaturas only in its own carrera and cannot move one to another carrera | Needs a cross-carrera transfer rule |
| A12 | The docentes list is not carrera-scoped (docentes are not bound to one carrera, and `rolesVisibles` already lets all three roles see docentes) | Needs a docente-to-carrera rule that does not exist |

## Open Questions for Spec and Design

1. **Resolved (owner, 2026-10-04): the import reactivates.** A manually
   deactivated Asignatura that appears in the workbook is reactivated by the
   import and its Grupo rows load normally; the preview shows the
   reactivation. This changes what the import writes in one respect only (it
   may set `Asignatura.Activo = true`), which D3 accepts as part of "the
   import wins". Left for spec: a workbook Grupo row that references an
   Asignatura which is NOT in the workbook's Asignaturas sheet and is
   inactive in the database (reactivate it as well, or report a row error),
   and whether the reactivation is audited per record or only in the import
   summary.
2. Which `Grupo` fields are editable? Changing its natural key reproduces C5
   for groups. Recommended: only the docente and the active state.
3. Creating a record whose natural key matches an existing inactive one:
   refuse and point to reactivation, or reactivate?
4. How is deactivation confirmed without a dialog primitive?
5. Sidebar shape: three entries, or one "Catálogos" entry whose active state
   spans three routes?
6. Should the downstream active-only readers (RF-03, RF-31) also require
   `Asignatura.Activo`?
7. Scope source: database lookup per request (recommended) versus adding
   `CarreraId` to the session token.

## Success Criteria

- [ ] The three staff roles can list, create, edit, deactivate and reactivate
      Asignaturas and Grupos; `docente` and `estudiante` are denied on every
      page and action, including hand-crafted requests.
- [ ] A `coordinacion` user cannot read or write a record outside its carrera
      by any route, and one without `CarreraId` sees the empty state.
- [ ] Deactivating an Asignatura with active Grupos is refused with the count.
- [ ] No code path deletes a catalog row.
- [ ] Every manual write produces exactly one audit row in the same
      transaction; a failed write leaves none; no payload contains a value.
- [ ] The import preview states how many groups to be deactivated are manual,
      and an apply writes exactly what it wrote before this change.
- [ ] The docentes list is read-only and links to `/users`.
- [ ] `es` and `en` catalogs have identical key sets.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src` and `npm run build`
      pass; `0005` was rehearsed on a fresh Neon branch before the shared
      database.
