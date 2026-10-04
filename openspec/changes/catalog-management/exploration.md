# Exploration: catalog-management

> Orchestrator note (2026-10-04): produced by `sdd-explore`. Two statements were corrected against evidence gathered earlier the same day and are marked "corrected": the state of migrations `0003`/`0004` on the shared database, and the items listed as not verified.

## Intent

Staff (`administrador`, `coordinacion`, `secretaria`) get a back-office "Catálogos" module. It sits under the new collapsible "Administración" sidebar group. In it they can list, create, edit and "delete" the internal catalog entities that the Excel import handles: Asignaturas, Docentes and Grupos. "Delete" never removes a row. It sets the row inactive.

Verified: this reverses an earlier decision. The `catalog-excel-import` proposal excluded manual per-record CRUD (`openspec/changes/catalog-excel-import/proposal.md:98`, default 5 at `:286`). It called a CRUD screen "a future, separate initiative" (`:16`, `:106`).

## Current state

### Verified in code

**Data model** (`src/db/schema.ts`)

| Entity | Columns and constraints | `Activo` |
|---|---|---|
| `Facultad` (`:20`) | `Id`, `Nombre` unique, `Siglas` | No |
| `Carrera` (`:33`) | `Id`, `Nombre` unique, `FacultadId` FK | No |
| `Asignatura` (`:108-122`) | `Id`, `Codigo` varchar(32) unique, `Nombre` varchar(160), `CarreraId` FK not null, `HorasTotales` int with `CK_Asignatura_Horas > 0` | **No** |
| `Grupo` (`:132-155`) | `Id`, `AsignaturaId` FK, `Periodo` varchar(12), `NumeroGrupo` varchar(12), `DocenteId` FK to `Usuario`, `Activo` default true. Unique (`AsignaturaId`, `Periodo`, `NumeroGrupo`), plus indexes `IX_Grupo_Docente` and partial `IX_Grupo_Activo` | Yes |
| `Usuario` (`:80-99`) | `Login` unique, `HashClave`, `RolId` FK, `NombreCompleto`, `Correo` unique (nullable), `Telefono`, `Cif` unique, `CarreraId`, `Activo`, `DebeCambiarClave`, `CreadoEn` | Yes |
| `Inscripcion` (`:165-180`) | Composite PK (`EstudianteId`, `GrupoId`), `Activo`, index on `GrupoId` | Yes |

- **A docente is a `Usuario` row.** `Grupo.DocenteId` has no database-level role check. The academic-catalog spec says the application enforces it (`academic-catalog/spec.md:108-113`).
- `Usuario.activo` is honoured at login (`src/app/(auth)/login/actions.ts:35`) and in the password change (`src/app/change-password/actions.ts:50`).
- Nothing outside the import, the planner and `catalog.ts` reads `Asignatura` or `Grupo.activo`. There is no listing UI for them today.

**No-migration answer.** The change cannot be done with no schema migration if `Asignatura` must be deactivatable. It needs one additive migration: `ALTER TABLE "Asignatura" ADD COLUMN "Activo" boolean NOT NULL DEFAULT true`. That is drizzle-generated `0005`.

- It is additive, so existing rows become active.
- The academic-catalog spec said `Asignatura` would not gain a state "in this change" (`academic-catalog/spec.md:204-213`). That wording is scoped to the import change, so this change may add it.
- `Grupo`, `Usuario` and `Inscripcion` need no migration.
- Facultad and Carrera are not in scope.
- The audit table needs no migration (see Audit below).

**Reusable read/write code**

| Piece | Location | Reuse |
|---|---|---|
| Snapshot reader | `src/lib/data/catalog.ts:37-92` | Unfiltered, built for the planner. Not usable for paged listings. |
| Active-only readers | `catalog.ts:107-154` | Built for RF-03/RF-31 consumers. |
| `CatalogExecutor` | `catalog.ts:26` | Executor type reusable for transaction-scoped writes. |
| `Transaction` | `src/lib/data/audit.ts:13` | Transaction handle type. |
| `insertAuditEvents(tx, actorId, events)` | `src/lib/data/audit.ts:21` | Reusable as is. |
| Users list | `src/lib/data/users.ts:46-153` | `listUsuarios` has the where/count/clamp/degraded pattern, but is hard-wired to `usuario` + `rol`. Copy the shape, not the code. |
| List params | `src/lib/users/list-params.ts` | `page` and `q` parsing. `USERS_*` names and the `/users` href are hard-coded. |
| Table UI | `src/components/data-table.tsx`, `data-table-search.tsx`, `data-table-pagination.tsx`, `page-header.tsx` | Generic and reusable. The search form takes an `action` prop, so it works on any route. |
| `StatusPill` | `src/app/(dashboard)/users/page.tsx:18` | Private to that page. It needs extracting if reused. |
| New-user form | `src/app/(dashboard)/users/new/new-user-form.tsx` | Page-local `Field` helper (`:27`) and `useActionState` pattern. |
| Validation | `src/lib/import/schemas.ts:91-133` | `AsignaturaRowSchema`, `GrupoRowSchema`. Messages are i18n keys. The length caps and `PERIODO_RE` (`normalize.ts:30`) are the same rules a manual form needs. |
| Hours rule | `schemas.ts:48-62` | `horasTotalesSchema` is not exported and `AsignaturaRowSchema` takes a `Carrera` name, not an id. |

**Seams missing:**

- A paged, filtered list query for `Asignatura` and `Grupo`.
- An exported schema for manual forms (id-based references, not names).
- Update and deactivate data functions.
- A shared "is this user a docente" check. The import does it in the pure planner (`plan.ts:190`, `:312`).
- Generic list-params. They are users-specific today.
- UI primitives: there is no Dialog, AlertDialog, Tabs, Checkbox or Switch under `src/components/ui/`, only sheet, select, card, table, input, label, dropdown-menu, collapsible, tooltip, sonner.

**Audit**

- `AUDIT_ACTIONS` is `["catalogo.importacion.aplicada", "usuario.creado", "usuario.actualizado"]` (`src/lib/audit/types.ts:8-12`).
- `AuditEntityType` is `"Importacion" | "Usuario"` (`:16`).
- The `AuditEvent` union is closed, with the only constructors in `src/lib/audit/events.ts`.
- The `usuario.*` payload hard-codes `origen: "importacion"` and a required `importacionSha256` (`types.ts:40-46`). A manual docente event cannot be built with the current type.
- The table accepts any value: `Accion` varchar(60), `EntidadTipo` varchar(40), `Datos` jsonb. The only check is `Usuario` implies `EntidadId` not null (`drizzle/0004_audit_log.sql:16`, `src/db/audit-schema.ts:62-65`). **No migration is needed for new audit actions or entity types.** Only the TypeScript union changes.
- The audit-log spec requires the audit row in the same transaction as the write and no values in payloads (`audit-log/spec.md:78-114`, RNF-05).
- The import audits `Asignatura` and `Grupo` only as import-level counts (`catalog-excel-import/spec.md:465-467`). Manual per-record CRUD would be the first per-record audit of these entities.
- The needed events are:
  - `asignatura.creada`, `asignatura.actualizada`, `asignatura.desactivada`, `asignatura.reactivada`
  - `grupo.creado`, `grupo.actualizado`, `grupo.desactivado`, `grupo.reactivado`
  - `usuario.*` with `origen: "manual"` if docentes are managed here
- Payloads should carry field names only, never values, and an `origen: "manual"` discriminator.
- `AuditEntityType` needs `"Asignatura"` and `"Grupo"`.
- Updating the TODO in `audit-schema.ts:24` is optional.

**Permissions today**

- `rolesAsignables`: administrador assigns `coordinacion`; coordinacion assigns `secretaria`; secretaria assigns `docente` (`permissions.ts:10-16`).
- `canCreateUsers` makes `/users` reachable by all three staff roles. `rolesVisibles`: administrador and coordinacion see everyone, secretaria sees only docentes (`:65-71`).
- `canImportCatalog` is secretaria only (`:49-51`).
- Today no role can create or edit an `Asignatura` or `Grupo` manually. The only write path is the secretaria import.
- Only secretaria can create docentes, and only via `/users/new`. There is no edit-user or deactivate-user path at all.

**Requirement documents**

- RF-31 (`docs/otros/Capitulo-IV/requisitos_F_NF_auditado.md:55`) gives the import to secretaria only.
- The audited requirements list no catalog-maintenance or administrator requirement, and four roles in RNF-01 without administrador (`:63`).
- `modelo_datos_sql.md:8` says `Grupo` and `Inscripcion` load "por importación o carga manual". The import design recorded this as a contradiction and ruled that RF-35 wins (X4, `design.md:122`).
- `docs/api-institucional/README.md` proposes a future institutional read API as source of truth for these entities, with the rule "what is absent is deactivated, never deleted". If it lands, manual edits would conflict with it the same way they do with the import.

**Sidebar** (`src/components/app-sidebar.tsx`)

- The collapsible "Administración" group now exists with "Carga de catálogo" and "Usuarios"; a third child is one entry in the `items` array.
- Active matching is `pathname === href || pathname.startsWith(href + "/")`. A top-level `/catalog` entry would still light up on `/catalog/import`.
- Use distinct routes, for example `/catalog/asignaturas` and `/catalog/grupos`.

### Import vs manual edits: every conflict

| # | Scenario | Behaviour today | Defined by import spec? |
|---|---|---|---|
| C1 | Grupo deactivated manually and present in next workbook | Reactivated (`plan.ts:362-370`, `apply.ts:217`) | Yes: "Corrected re-import reactivates" (`spec.md:406-410`) |
| C2 | Grupo created manually and absent from next workbook | Deactivated by deactivate-absent (`plan.ts:382-385`, `apply.ts:224-234`) | Yes, literally; the intent was never considered for manual rows |
| C3 | Grupo docente changed manually and workbook lists a different docente | Overwritten (`plan.ts:361`) | Yes: "Docente reassignment" (`spec.md:368-372`) |
| C4 | Asignatura name, hours or carrera edited manually and workbook has the old value | Overwritten (`plan.ts:133-145`) | Yes: "Changed values update in place" |
| C5 | Asignatura `Codigo` edited manually | The natural key moves. The next import re-creates the old `Codigo` as a new row and duplicates the subject. | No |
| C6 | Asignatura absent from workbook | Left untouched; the import never deactivates `Asignatura` (`plan.ts:387-389`, `spec.md:204-213`) | Yes |
| C7 | Asignatura deactivated manually and in workbook | If `Activo` exists, the planner would not reactivate it. It compares only name, carrera and hours. Groups referencing it get re-created or updated while their asignatura stays inactive. | No, new gap |
| C8 | Docente created manually with `Correo` the workbook also carries | Matched by `normalizeEmail` and updated in place for name and phone (`plan.ts:189`, `:241-254`) | Yes: natural key `Correo` |
| C9 | Docente created manually with null `Correo` | Never matched. The next import creates a second account for the same person. | No |
| C10 | Docente `Correo` stored with mixed case | The DB unique is case-sensitive. The planner map is keyed by lowercased email (`plan.ts:156-160`). `createStaffAction` stores `correo` unnormalised (`users/new/actions.ts:68`). Two rows differing only in case collide in the map. | No |
| C11 | Docente name or phone edited manually | Overwritten (`plan.ts:241-254`) | Yes |
| C12 | Docente deactivated manually | The import never touches `Usuario.activo` (`apply.ts:160-161`). It still resolves them as a valid docente in `Grupos` rows (`plan.ts:307-315` has no `activo` check), so an active Grupo can end up with an inactive docente. | Partly: "inactive matched account stays inactive" is a code comment, not a spec scenario |
| C13 | Docente login equals a derived login | Row error `login.collision` (`plan.ts:219`) | Yes |

Overall: there is no concept of "who wins". Manual and import are symmetric last-writer-wins, and the import additionally treats "absent" as "deactivate" for groups. The product owner must decide the precedence (see Open questions).

## Affected areas

- `src/db/schema.ts`: add `activo` to `asignatura`.
- `drizzle/0005_*.sql` and `drizzle/meta/*`: generated migration (needs explicit user confirmation before any apply).
- `modelo_datos_sql.md`: document `Asignatura.Activo`.
- `src/lib/audit/types.ts` and `events.ts`: new actions, entity types, manual-origin payload variants.
- `src/lib/data/catalog.ts` or new `asignaturas.ts` and `grupos.ts`: paged lists, create, update, set-active, all transaction-scoped with audit.
- `src/lib/data/users.ts` (only if docentes are manageable): update/deactivate.
- `src/lib/validations/` (new `catalog.ts`): manual-form schemas. `src/lib/import/schemas.ts` should export shared field rules.
- `src/lib/auth/permissions.ts`: new predicate(s), for example `canManageCatalog`. Derived from `rolesAsignables`, no second hand-written list.
- `src/lib/import/plan.ts` and `types.ts`: only if import precedence changes (C2, C7, C12).
- `src/app/(dashboard)/catalog/...`: list, new and edit pages, actions.
- `src/components/app-sidebar.tsx`: add "Catálogos" entries to the "Administración" group.
- `i18n/es.json` and `en.json`: identical key sets, enforced by `src/i18n/catalog-parity.test.ts`.
- `src/components/` and `src/components/ui/`: shared status pill, possibly a confirm control.

## Approaches compared

### A. Scope of entities

| Option | Pros | Cons | Effort |
|---|---|---|---|
| A1. Asignaturas + Grupos CRUD; docentes list-only in Catálogos with a link to `/users` | Smallest coherent slice. No account-provisioning duplication. Docente lifecycle stays where passwords live. | "Docentes" in Catálogos is not editable. Needs a `/users` edit and deactivate feature that does not exist yet. | Medium |
| A2. All three, docente create through the same provisioning path as the import | Matches the stated intent literally. One place for staff. | Needs temporary password, `DebeCambiarClave`, credentials display, `canAssignRole` rules and `usuario.*` manual audit. About the size of the previous change's account slice. Hierarchy conflict: administrador and coordinacion cannot assign `docente` today. | High |
| A3. Docentes as a thin view over `Usuario` in Catálogos with edit and deactivate only (no create) | Covers "edit" and "delete" without credentials. Create stays on `/users/new`. | Splits one concept across two screens. Still needs a new user update and deactivate path. | Medium |

### B. Deactivation model for Asignatura

| Option | Pros | Cons | Effort |
|---|---|---|---|
| B1. Add `Asignatura.Activo` (migration 0005) | Meets the intent. Consistent with `Grupo`. Readers can filter. | Needs a gated migration. Planner and `catalog.ts` readers must learn it. | Low to Medium |
| B2. No schema change: Asignatura is never deactivated, only `Grupo` | No migration. | Contradicts "deactivates it" for Asignaturas. | Lowest |

### C. Route and UI shape

| Option | Pros | Cons | Effort |
|---|---|---|---|
| C1. Separate list pages `/catalog/asignaturas`, `/catalog/grupos`, `/catalog/docentes`, each with `new` and `[id]/edit` pages | Mirrors `/users`, `/users/new`. No missing UI primitives. Plain server pages. Clean sidebar active state. | More files and routes. | Medium |
| C2. One `/catalog` page with tabs and dialogs | Fewer routes. | Needs Dialog and Tabs primitives that do not exist. Breaks the `/catalog/import` active state. Heavier client code. | High |
| C3. List page plus side sheet (`sheet.tsx` exists) | Faster editing. | Sheet-driven forms with server actions are novel here. Harder to test. | Medium to High |

### D. Import and manual coexistence

| Option | Pros | Cons | Effort |
|---|---|---|---|
| D1. Keep the import as is; document last-writer-wins | Zero import change. | C2 silently deactivates every manual group on the next import, and C4/C9 behave surprisingly. | None |
| D2. Add `Origen` (import vs manual) to `Grupo` and exempt manual rows from deactivate-absent | Safe for manual groups. | Another migration and a planner rule change. | High |
| D3. Make `Codigo` immutable on edit (closes C5), make the planner skip reactivating a manually deactivated Asignatura, and report C2 in the dry-run preview as already specified | Low risk. Mostly spec text and a few planner lines. | C2, C3 and C4 still surprise users. | Low to Medium |

## Recommendation

1. **Entities.** Recommended: A1 for the first delivery, with B1. Build Asignaturas and Grupos CRUD with soft delete. Show docentes read-only in Catálogos and link to `/users`. Treat docente edit and deactivate as a follow-up change on the `/users` module, because it is account management (passwords, role hierarchy), not catalog data. If the product owner insists on docentes in this change, take A3 (edit and deactivate, no create).
2. **Schema.** B1: one additive migration `0005` adding `Asignatura.Activo`. No audit migration is needed.
3. **UI.** C1: separate pages, `/catalog/asignaturas` and `/catalog/grupos`, following the `/users` pattern. Do not claim `/catalog` itself.
4. **Audit.** Extend the closed union with per-record manual events and an `origen: "manual"` payload. Every write goes through a transaction that calls `insertAuditEvents`.
5. **Import.** D3: freeze `Codigo` after creation, and have the planner not reactivate an inactive Asignatura. State explicitly in the proposal that C2 to C4 remain last-writer-wins, and have the import preview already show them as updates and deactivations. Postpone D2 unless the product owner rejects C2.
6. **Slicing.** Three chained work units (see Size).

## Deactivation semantics and integrity

Proposed rules, all assumptions until the product owner confirms:

| Action | Rule | Basis |
|---|---|---|
| Deactivate Asignatura with active Grupos | Refuse with a message listing the count, or cascade to groups with explicit confirmation | Decision for the owner. `IX_Grupo_Activo` and the RF-03 readers show a group stays "active" independently of its asignatura today. |
| Deactivate Asignatura with no active Grupos | Allow | Assumption |
| Deactivate Grupo with Inscripcion rows | Allow. Enrollments stay. RF-31 readers already require `Grupo.Activo` (`catalog.ts:127-128`, `:150-151`). | Verified: readers handle it |
| Deactivate docente assigned to active Grupos | Refuse until reassigned, or allow with a warning | Decision for the owner. The import allows it today (C12). |
| Reactivate | In scope for Grupo and Asignatura. It is a symmetrical write and a trivial toggle. The import already reactivates groups. | Assumption |
| Create Grupo | Require active Asignatura and an active docente. Validate role in the application. | Verified requirement (`academic-catalog/spec.md:108-113`) |

Listing needs an active/inactive/all filter (default active) and a status column, reusing the `/users` `StatusPill`. The `q` search covers `Codigo`/`Nombre` for Asignaturas and asignatura code, period, docente name for Grupos. The database has no index for these searches; at faculty scale this is acceptable (assumption).

## Size and slicing

Estimates. In `catalog-excel-import` real sizes ran 3 to 5 times the first estimates because tests and bilingual copy dominate. Applying that here:

| Slice | Authored lines (est.) |
|---|---|
| Migration 0005, schema, audit union and manual builders, tests | 350 to 500 |
| Asignaturas: data layer, schema, list, new, edit, actions, i18n, tests | 700 to 1000 |
| Grupos: same, plus docente and asignatura selects and integrity checks | 800 to 1100 |
| Permissions, sidebar entry, shared list-params and status pill extraction | 150 to 250 |
| Import planner adjustments (D3) and tests | 100 to 200 |
| **Total (A1)** | **about 2100 to 3050** |
| Docentes (A2) additionally | 700 to 1000 |

A single PR within the 800-line review budget is **not realistic**. Even the smallest useful slice (one entity end to end) is about 700 to 1000 lines.

Natural seams, each autonomous with its own tests and rollback:

- **WU1: foundations.** Migration 0005, `Asignatura.Activo`, audit union and manual events, `canManageCatalog`, shared list-params and status pill. Roughly 500 to 700 lines. The migration needs explicit confirmation.
- **WU2: Asignaturas** screens and actions, plus the sidebar entry.
- **WU3: Grupos** screens and actions.
- **WU4 (optional):** import-planner adjustments, and docentes if included.

The cached `single-pr` strategy conflicts with these numbers. The orchestrator must raise it at the tasks phase (`Decision needed before apply: Yes`) and either switch to chained slices or accept a `size:exception`.

## Risks

| # | Risk | Type |
|---|---|---|
| R1 | The next import deactivates every manually created group (C2) and silently overwrites manual edits (C3, C4, C11). Highest-impact interaction. | Product decision |
| R2 | A docente deactivated in `/users` still resolves for new groups and imports (C12), leaving active groups with an inactive teacher. | Technical decision |
| R3 | `Asignatura.Activo` requires a migration on a shared Neon database. Per `CLAUDE.md`, each DB command needs explicit confirmation, and `drizzle-kit push` is forbidden. | Technical decision |
| R4 | (corrected) Migrations `0003` and `0004` ARE applied on the shared Neon database (`production`): `0003` was found already applied and `0004` was applied on 2026-10-04 with user confirmation and verified read-only (see `catalog-excel-import/apply-progress.md`, Phase 6). `0005` can build on them. The Neon branch `rehearsal-audit` no longer exists, so a rehearsal of `0005` needs a fresh branch. | Fact (verified) |
| R5 | Sidebar prefix matching: a `/catalog` entry lights up on `/catalog/import`. | Technical decision (resolved by distinct routes) |
| R6 | Changing the import's ownership or semantics reopens a spec set that is implemented but unarchived and uncommitted. Archive order and deltas need care. | Technical decision |
| R7 | The closed audit union and `origen: "importacion"` payload need widening without breaking the existing `buildAuditEvents` and its tests. | Technical decision |
| R8 | Mixed-case correos from manual creation (C10) break the planner's map. | Technical decision |
| R9 | The audit rule says no values in payloads, so audit rows for edits record field names only, which limits the diffs available to a reviewer. | Fact (by design, RNF-05) |
| R10 | No Dialog/Tabs/AlertDialog primitive exists. A destructive-looking confirm for deactivation needs either a new primitive added to `docs/design-system.md` first, or a plain two-step page. | Technical decision |
| R11 | A future institutional API could replace the Excel import and conflict with manual edits the same way (C1 to C4). | Product decision |
| R12 | Whether `administrador` should manage catalog data at all is unsupported by the audited requirements. | Product decision |

## Open questions for the product owner

1. Which roles may create and edit Asignaturas? (`administrador`, `coordinacion`, `secretaria`, all three, or a subset)
2. Which roles may create and edit Grupos?
3. Which roles may deactivate and reactivate each entity?
4. Should `coordinacion` be limited to Asignaturas of its own `Carrera`, as RF-18 and RF-20 imply for requests?
5. Does `administrador` get catalog access at all, given the audited requirements name only four roles and give the import to `secretaria`?
6. Docentes in this change: list-only with a link to `/users` (recommended), edit and deactivate only, or full create with temporary password?
7. If docentes are created here, may `coordinacion` and `administrador` create them, even though the current hierarchy gives that right only to `secretaria`?
8. When the next Excel import omits a manually created Grupo, should it still be deactivated (today), or should manual rows be protected?
9. When a manual edit and the workbook disagree (name, hours, docente), who wins: the import (today) or the manual edit?
10. May an Asignatura be deactivated while it has active Grupos: refuse, or cascade to the groups?
11. May a docente be deactivated while assigned to active Grupos: refuse, warn, or allow?
12. Should `Codigo` of an Asignatura be immutable after creation?
13. Is reactivation in scope, or is deactivation one-way until the next import?
14. Should the list show inactive rows by default, or only on request?
15. Do you accept chained pull requests (about 3 to 4 slices) instead of the cached `single-pr` strategy, given the estimated 2100 to 3050 authored lines?

Answered so far (2026-10-04, in conversation): the module is for `administrador`, `coordinacion` and `secretaria`; it must allow create, edit and deactivate, never physical delete.

## Ready for proposal

**Yes, with caveats.** The code facts are sufficient to write the proposal. The proposal should record the schema change (`Asignatura.Activo`, gated), the audit extension, and the delivery-strategy decision.

Still missing from the product owner: questions 4, 6, 8 to 10 and 15 above (carrera scoping, docente scope, import precedence, deactivation integrity and delivery strategy). The proposal can state defaults for the rest.

Not verified in this exploration:

- The base-ui `Dialog`/`AlertDialog` primitives were not inspected. This is only relevant if C2 or C3 is chosen.
- The contents of `docs/design-system.md` were not read by the explorer, so the proposed controls need a design-system check at design time.
- The full text of `modelo_datos_sql.md` §4 was not read, only the matched lines.
