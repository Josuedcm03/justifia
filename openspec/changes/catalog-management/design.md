# Design: Manual Catalog Management (Catálogos)

> **DB-touching change.** This document plans commands; it runs none. No
> migration, Neon branch operation or write SQL may run without the user's
> explicit confirmation **for that single command**. `drizzle-kit push` is never
> used. Every database step below is tagged `[READ-ONLY]` or `[CONFIRM]`.

> **Size note.** The `sdd-design` skill caps a design at 800 words. This repo's
> precedent (`catalog-excel-import/design.md`, 1045 lines) and the thirteen
> decisions the phase brief requires make that cap unreachable without deleting
> rationale. Project convention wins; the deviation is deliberate.

> **Written in parallel with the delta specs.** `specs/` did not exist when this
> was written. Everything the specs must pin for this design to hold is listed
> in *Points the specs must pin*.

Binding inputs: `proposal.md` (D1-D5, A1-A12 with A4 decided and A5
withdrawn), `exploration.md` (C1-C13), and the owner decisions of 2026-10-04.

> **Amended on 2026-10-07.** The section *Amendment 2026-10-07: meeting days of
> a Grupo* at the end of this document adds a second additive migration
> (`0006`), a day set on `Grupo`, an optional import column and a checkbox
> group. Passages below that it makes false carry a dated note; the original
> text is kept.

---

## Verified findings

### Framework (read in `node_modules/next/dist/docs/`, Next 16.3.4)

| # | Finding | Source | Consequence |
|---|---|---|---|
| N1 | `params` is a `Promise`; its values are always `string` because "users can enter any URL". `PageProps<'/route'>` is global only **after type generation** | `03-file-conventions/dynamic-routes.md:20-28,117-119`; `page.md:125-140` | `[id]` pages type `params: Promise<{ id: string }>` explicitly (as `users/page.tsx:64-68` does for `searchParams`), parse the id with a strict pattern and call `notFound()` on anything else. `PageProps` is not used: `npm run typecheck` runs without a build |
| N2 | `searchParams` is a `Promise` of a plain object and opts the page into dynamic rendering | `page.md:117-121` | List pages are dynamic by construction; no segment config is needed |
| N3 | `notFound()` works in Server Components, **Server Functions** and Route Handlers; it throws, and a `try/catch` around it suppresses it; the nearest `not-found.tsx` renders | `04-functions/not-found.md:13-15,79,169` | Pages call it outside any `try`. No `not-found.tsx` exists under `src/app` today (glob), so one is added for the catalog segment |
| N4 | `redirect()` throws and must be called outside `try`; in a Server Action it is a client navigation (303 without JS) | `redirect.md:12,29-31,51-53` | Same placement rule as `users/new/actions.ts:81` |
| N5 | `revalidatePath` with a literal path takes no `type`; with a dynamic pattern `type` is required; in a Server Function it updates the UI immediately | `revalidatePath.md:19,28-29` | Actions pass literal paths only |
| N6 | A Server Action "is reachable via a direct POST request, not just through your application's UI"; authorisation must be re-checked inside each one, including ownership of the specific resource (IDOR). Only `POST` invokes an action | `02-guides/data-security.md:281-291,370,548,601`; `forms.md:10` | Every action starts with the catalog guard and re-applies scope to the record id; no mutation is ever a GET link |
| N7 | `forbidden()` is `version: experimental` and needs `experimental.authInterrupts` | `forbidden.md:4,17` | Not used. Role denial keeps redirecting to `ACCESS_DENIED_PATH` |
| N8 | Segment config exports must be literals (found the hard way: `catalog-excel-import/apply-progress.md`, finding 4) | apply-progress | No segment config is added here: every write is one short transaction |
| N9 | `middleware.ts:28` matches `/catalog/*` (only `api`, static and dotted paths are excluded) | `middleware.ts` | Anonymous requests are redirected before the page runs; the guards still live in pages and actions, because actions do not inherit page guards (`openspec/config.yaml` convention) |

### Repository

| # | Finding | Evidence |
|---|---|---|
| R1 | `SessionPayload` has `sub, login, rol, nombre, debeCambiarClave?` and no carrera | `src/lib/auth/session.ts:8-18` |
| R2 | The active-only readers have **no application caller**: only `catalog.ts` and `catalog.test.ts` reference them | grep over `src` |
| R3 | The planner compares `Asignatura` by `nombre`, `carreraId`, `horasTotales` only, and resolves a `Grupos` row against every snapshot `Codigo` | `src/lib/import/plan.ts:83-85,133-137,296` |
| R4 | `apply.ts` inserts explicit column sets for `asignatura` and `grupo` and never names `activo`/`origen` on insert | `src/lib/import/apply.ts:62-78,191-210` |
| R5 | `insertAuditEvents` takes the transaction handle type, not `db` | `src/lib/data/audit.ts:13,21` |
| R6 | Drizzle wraps driver errors; the SQLSTATE is on `error.cause.code` | `src/lib/import/summary.ts:53-55` |
| R7 | Existing forms use `<form action={formAction}>`; **no `onSubmit` remains in `src/app`**. The import form dispatches by hand inside `startTransition` | grep; `import-form.tsx:94` |
| R8 | `@base-ui/react` ships `combobox` and `alert-dialog`; `ComboboxRoot` accepts `name`, `items`, `itemToStringLabel`, `required`, `value`/`onValueChange` | `node_modules/@base-ui/react/combobox/root/*.d.ts` |
| R9 | drizzle exposes `.for(strength)` on selects and `isolationLevel` on transactions | `drizzle-orm/pg-core/query-builders/select.d.ts:586`; `session.d.ts:31-32` |
| R10 | `drizzle/meta/0004_snapshot.json` exists and describes `Asignatura`; `0005` chains from its id | `drizzle/meta/` |
| R11 | `usuarioConRolColumns` projects `hashClave` into every users list row | `src/lib/data/users.ts:31-44` |
| R12 | The sidebar's `isCurrent` is `pathname === href \|\| pathname.startsWith(href + "/")` | `src/components/app-sidebar.tsx:80-84` |

---

## Technical Approach

Three ideas carry the whole design.

1. **Scope is a value, resolved once on the server and required everywhere.**
   The guard returns a `CatalogScope`. Every read and write in the data layer
   takes it as a required parameter, and one module turns it into SQL. A
   statement for a `coordinacion` user carries the carrera predicate in its own
   `WHERE`, so a foreign row is unreachable by the statement itself, not merely
   refused by a check above it.
2. **Every catalog write runs inside one wrapper.** `withCatalogWrite` opens the
   transaction, serialises catalog writers with a transaction-scoped advisory
   lock, runs the write, and appends the audit rows on the same handle. Check
   then write is race-free because no second writer can interleave.
3. **The import stays one pure planner.** It learns two columns, gains one row
   error, one reactivation write and two preview numbers. `apply.ts` keeps
   executing the plan it is handed.

Pages are server components following `/users`; forms are small client
components with `useActionState`; nothing is physically deleted anywhere.

---

## Architecture Decisions

### 1. Migration `0005`

**Choice.** One drizzle-generated, purely additive migration, named
`0005_catalog_management`:

```sql
-- EXPECTED shape. The file emitted by drizzle-kit is the source of truth and is
-- reviewed by hand before anything is applied.
ALTER TABLE "Asignatura" ADD COLUMN "Activo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "Grupo" ADD COLUMN "Origen" varchar(12) DEFAULT 'importacion' NOT NULL;--> statement-breakpoint
ALTER TABLE "Grupo" ADD CONSTRAINT "CK_Grupo_Origen" CHECK ("Grupo"."Origen" in ('importacion', 'manual'));
```

- **Shape confirmed**: `Grupo.Origen varchar(12)` plus a named CHECK, default
  `'importacion'`. It records how the row was **created** and is never
  rewritten: no `UPDATE` in the application sets it (pinned by a source test),
  and a manual group later matched by a workbook stays `manual`.
- **No new index.** Both tables are small, the search is `ILIKE '%term%'`
  (not served by a btree), and `IX_Grupo_Activo` already exists. The documented
  upgrade path is a partial `IX_Asignatura_Carrera ("CarreraId") WHERE "Activo"`.
  The row counts read in gate G1 are the evidence for this assumption.
- **Generation**: `npm run db:generate -- --name catalog_management`, local, no
  connection. It writes the SQL, `drizzle/meta/0005_snapshot.json` (its
  `prevId` is the `0004` snapshot id) and journal entry `idx: 5`.
- **Ordering rule (hard).** `schema.ts` and `0005` ship in the same work unit,
  and `0005` is applied to the shared database **before that unit is merged or
  deployed**. Reason: once `schema.ts` declares the columns, drizzle inserts
  into `Asignatura`/`Grupo` name every table column, so the *existing import*
  would fail against a database without them. Any code that selects the columns
  ships in a later unit still.

**Rejected.** A boolean `CreadoManualmente` (cannot express a third origin such
as the planned institutional API without another column); a Postgres enum
(the schema uses `varchar` plus code-level unions everywhere, e.g. `Rol.Codigo`,
`EventoAuditoria.Accion`); a trigger forbidding updates of `Origen` (hand-written
SQL in a generated migration, for a rule one source test already pins);
`drizzle-kit push` (forbidden, and destructive for the partitioned audit table).

**Gates** (each one is a separate step; nothing is batched):

| Gate | Tag | Step |
|---|---|---|
| G1 | `[READ-ONLY]` | On `production`: row counts of `Asignatura` and `Grupo`; `information_schema.columns` shows neither new column; `drizzle.__drizzle_migrations` holds five rows |
| G2 | `[CONFIRM]` | Create a fresh Neon branch `rehearsal-0005` from `production` (`rehearsal-audit` no longer exists) |
| G3 | `[CONFIRM]` | `npm run db:migrate` with `DATABASE_URL` pointed at the branch for that one command; the target host is restated first |
| G4 | `[READ-ONLY]` | On the branch: both columns exist with the expected default and nullability; zero `Asignatura` rows with `NOT "Activo"`; every `Grupo` has `Origen = 'importacion'`; `CK_Grupo_Origen` is in `pg_constraint`; row counts equal G1; six migration rows |
| G5 | `[CONFIRM]` | Write probes on the branch, inside a transaction that ends in `ROLLBACK`: (a) `UPDATE "Grupo" SET "Origen" = 'otro'` fails with `23514`; (b) an insert that omits `Origen` stores `importacion`; (c) an insert with `manual` succeeds; (d) an `Asignatura` insert that omits `Activo` stores `true` |
| G6 | `[CONFIRM]` | Lock probe on the branch **through the pooled endpoint**, two concurrent connections: A takes `pg_advisory_xact_lock(K)`; B sets `lock_timeout = '2s'` and requests the same lock, and must fail with `55P03`; A commits; B retries and succeeds. This is the only proof of decision 4's mechanism |
| G7 | `[CONFIRM]` | Optional: create `backup-before-0005` from `production` (the owner did this before `0004`) |
| G8 | `[CONFIRM]` | `npm run db:migrate` against `production`, host restated |
| G9 | `[READ-ONLY]` | Repeat G4 on `production` |
| G10 | `[CONFIRM]` | Delete `rehearsal-0005` |

**Rollback text.** Preferred: leave both columns; their defaults make older
code behave exactly as before. If they must go, revert `schema.ts` and
*generate* the compensating migration so the snapshot stays consistent:

```sql
-- 0006 (compensating). Loses every origin marker and every Asignatura state;
-- any manually deactivated Asignatura becomes implicitly active again.
ALTER TABLE "Grupo" DROP CONSTRAINT "CK_Grupo_Origen";--> statement-breakpoint
ALTER TABLE "Grupo" DROP COLUMN "Origen";--> statement-breakpoint
ALTER TABLE "Asignatura" DROP COLUMN "Activo";
```

> **Note 2026-10-07.** The number `0006` is now taken by the meeting-days
> migration (amendment, decision D-2). A compensating migration for `0005`
> would be generated with the next free number and would also have to follow
> the removal of `Grupo.Dias` if that column were to go.

### 2. Carrera scope

**Choice.** A server-only guard resolves the scope per request from the
database and returns it with the session:

```ts
type CatalogScope =
  | { kind: "all" }
  | { kind: "carrera"; carreraId: number }
  | { kind: "none" };
```

- `requireCatalogAccess()` runs `requireRole(...rolesQueGestionanCatalogo)`,
  reads the caller's `CarreraId` by primary key, and calls the pure
  `catalogScopeFor(rol, actor)`. A `coordinacion` user with a null `CarreraId`,
  or a session whose row no longer exists, gets `none`.
- Every data function takes `scope` as a **required** parameter. One module,
  `src/lib/data/catalog-scope-sql.ts`, is the only place a scope becomes SQL:
  `all` adds nothing, `carrera` emits `"Asignatura"."CarreraId" = $n`, `none`
  emits literal `false`. The `switch` is exhaustive with a `never` default.
- Writes carry the predicate in the statement: `UPDATE ... WHERE "Id" = $1 AND
  <scope> RETURNING "Id"`. Zero rows means "not found". A `Grupo` is scoped
  through its `Asignatura` with a subquery. An insert never uses the id from
  the form: it uses the id returned by the scoped select that precedes it, and
  an `Asignatura` create takes its `carreraId` from `carreraIdForWrite(scope,
  requested)`, which returns the scope's own carrera for `coordinacion` and
  `null` (refuse) when the request names a different one.
- **Out-of-scope answer.** A record outside the caller's scope and a record
  that does not exist are indistinguishable: pages call `notFound()`, actions
  return `{ kind: "gone" }`. The denied screen is reserved for role denial,
  where the existence of the module is not a secret.

**Rejected: `CarreraId` in the session token.** It would be stale for up to
eight hours after a coordinator is reassigned; every live `coordinacion` session
issued before the change would carry no carrera and would need either a forced
re-login or a database fallback (the lookup this option was meant to avoid); and
it edits `session.ts`, `isSessionPayload` and the login action, none of which
the proposal touches. One primary-key read per request is cheaper than all three.

**How tests prove no unscoped query exists for `coordinacion`.** (a) The type:
`scope` is not optional on any export. (b) `catalog-scope-sql.test.ts` renders
the predicate for the three kinds through a DB-free `QueryBuilder().toSQL()`,
the pattern `users-query.test.ts` established. (c) A sentinel test: the
predicate module is mocked to return a unique SQL sentinel, each read and write
runs against a recording double, and every `.where(...)` it issues on
`Asignatura` or `Grupo` must contain the sentinel. (d) Action tests with a
foreign-carrera id and a hand-built `FormData`.

### 3. Permissions

**Choice.** Three additions to `permissions.ts`, none a new role list:

```ts
export function canManageCatalog(rol) { return canCreateUsers(rol); }
export const rolesQueGestionanCatalogo = rolesUsuario.filter(canManageCatalog);
export function isCarreraScopedRole(rol) { return rol === "coordinacion"; }
```

`canManageCatalog` has its own name so the catalog rule can diverge later in
one place; today it is the staff set, which is exactly the set for which
`canCreateUsers` is true. `isCarreraScopedRole` is one predicate, not a list: no
existing structure encodes "tied to a carrera" (`users/new/actions.ts:48` writes
the same fact inline).

| Entry point | Guard | Order |
|---|---|---|
| Every `/catalog/{asignaturas,grupos,docentes}` page | `requireCatalogAccess()` | First statement, before `params`/`searchParams` are awaited |
| Every catalog action | `requireCatalogAccess()` | First statement, **before any `formData.get`** |
| `/catalog/import`, its actions, the template route | unchanged (`canImportCatalog`) | unchanged |

`requireUser` already enforces the forced password change, so the catalog
inherits it. **Rejected:** a `Record<RolUsuario, ...>` scope table (a second
hand-written role list); role checks inside pages (the convention forbids
scattering them).

### 4. Data layer

**Choice.** Two new modules, `src/lib/data/asignaturas.ts` and `grupos.ts`;
`catalog.ts` keeps the snapshot and the active-only readers. Signatures are in
*Interfaces*.

- **Lists** follow `listUsuarios`: one `where` builder reused by count and
  page, `clampPage`, fail-soft `{ degraded }`. Filters: status (`active`,
  `inactive`, `all`), search, scope.
- **Writes** take the transaction handle and return a discriminated result
  carrying what the audit builder needs (`id`, changed field names). They never
  throw for a business refusal.
- **Race safety: one advisory lock, not row locks.** `withCatalogWrite` issues
  `SET LOCAL lock_timeout = '5s'` and `SELECT pg_advisory_xact_lock(KEY)` as the
  first two statements of the transaction. All catalog writers are therefore
  serialised, and under READ COMMITTED every later statement sees every earlier
  writer's commit. "Count active Grupos, then deactivate the Asignatura" and
  "check the Asignatura and docente are active, then insert the Grupo" cannot
  interleave. A timeout surfaces as a `busy` result, never as a hang.
- **Unique violations.** The natural key is checked inside the lock, so the
  normal path returns a typed `codigo_taken` / `grupo_taken`. A `23505` read
  from `error.cause.code` (R6) is the backstop and maps to the same result. No
  driver message ever reaches the client; an unexpected failure returns a
  generic message and one sanitised log line shaped like `logImportFailure`.
- **Concurrent edits: last writer wins.** The diff for the audit row is taken
  against the row read inside the transaction, not against what the form
  loaded. A no-op update writes nothing and audits nothing.

**Rejected.** *Row locks* (`FOR UPDATE` on the Asignatura, `FOR SHARE` from
Grupo writers, R9): correct between manual writers, but the import plans from a
whole-table snapshot, so it would need its own lock protocol and a lock-order
argument. *A conditional update* (`UPDATE ... WHERE NOT EXISTS (active
grupos)`): the subquery runs on the statement's snapshot, so a concurrently
committed Grupo is not seen; it also cannot tell "not found" from "refused"
without a second statement. *SERIALIZABLE*: needs a retry loop on `40001` in
every action. *Optimistic versioning* (`xmin` or a version column): a new
column is outside the proposal, and its value is low while D3 lets the import
overwrite silently. *Extending `catalog.ts`*: it would mix a planner-only,
unfiltered snapshot with scoped UI queries in one file.

### 5. Audit

**Choice.** The closed union widens additively; the `usuario.*` variant and
`buildAuditEvents` are not edited, so both `@ts-expect-error` credential pins in
`events.test.ts:176,185` stay as written.

- Actions: `asignatura.creada`, `.actualizada`, `.desactivada`, `.reactivada`;
  `grupo.creado`, `.actualizado`, `.desactivado`, `.reactivado`.
- Entity types: `"Asignatura"`, `"Grupo"`; `entidadId` is always a number.
- Origin is its own union, shared by both entities:
  `{ origen: "manual" } | { origen: "importacion"; importacionSha256 }`. The
  manual variant has no digest field at all, so it cannot be half-filled.
- Payloads carry **field names only**, from closed lists. `changedFields`, a
  pure helper, compares two records over a closed field list with `Object.is`
  and returns names; no value can leave it because its return type is the name
  union.
- The table is not migrated: `Accion` is `varchar(60)`, `EntidadTipo`
  `varchar(40)`, `Datos` `jsonb`.

> **Note 2026-10-07.** The closed list of auditable Grupo fields gains `dias`
> (amendment, decision D-4). The audit table is still not migrated.

**Rejected.** Widening `UserChangedPayload.origen` (it would touch the import's
account events for no manual `usuario` writer in this change); a free-form
`Record<string, unknown>` payload; before/after values (RNF-05); extending
`CK_EventoAuditoria_Entidad` to the new entity types (a migration on the
partitioned audit table, which the proposal excludes; the TypeScript union
already requires the id).

### 6. Validation

**Choice.** The field rules move, unchanged, from `src/lib/import/schemas.ts`
into a pure `src/lib/validations/catalog-fields.ts`: the length caps,
`requiredString`, `horasTotalesSchema`, `periodoSchema`, `numGrupoSchema`. The
import schemas import them; `schemas.test.ts` passing untouched is the proof
that nothing drifted. `src/lib/validations/catalog.ts` builds the manual
schemas from the same rules with id-based references.

- `Codigo` is trimmed and otherwise compared exactly, as the import does, so a
  manually created code matches the import's natural key byte for byte.
- Messages stay i18n keys (`codigo.required`), resolved under
  `catalog.shared.fieldErrors`.
- The schema validates shape only. Referenced ids are re-validated in the
  transaction: `asignaturaId` must exist, be active and be inside the scope;
  `docenteId` must be an active user whose role code is `docente`; `carreraId`
  must exist and satisfy `carreraIdForWrite`.

**Rejected.** Duplicating the rules in the form schemas (the drift the proposal
names); reusing `AsignaturaRowSchema` (it takes a carrera *name*).

### 7. Import changes (WU4)

**Choice.**

- `AsignaturaRow` gains `activo`; `GrupoRow` gains `origen`;
  `loadCatalogSnapshot` projects both.
- **Reactivation.** A workbook Asignatura that matches an inactive row yields an
  `update` write with `reactivated: true` (also when no other field differs),
  counted under `counts.Asignatura.update`, exactly as a Grupo reactivation is.
  `apply.ts` adds `activo: true` to that update only.
- **Open case decided: row error.** A `Grupos` row whose Asignatura is inactive
  in the database and is **not** resolved by the workbook's Asignaturas sheet
  fails with the new reason `asignatura.inactive`. Reactivating a subject the
  workbook never listed would be a write the operator did not ask for.
- **Preview.** `ImportPlan` gains `asignaturasToReactivate` and
  `manualGruposToDeactivate` (the count of `origen === "manual"` among
  `deactivateGrupoIds`). `PreviewState`'s preview arm carries both and the
  preview renders them before the confirm control.
- **Audit and summary.** Each reactivated Asignatura gets its own
  `asignatura.reactivada` event with `origen: "importacion"`, appended after
  `buildAuditEvents(...)`, whose signature does not change. `ImportSummary` and
  the import audit payload gain `asignaturasReactivated` and
  `manualGruposDeactivated` so the losing side stays visible after the preview
  is gone.
- **Lock.** `runImportApply` takes the same advisory lock before the in-
  transaction snapshot read. Until it does, a manual write can commit between
  the import's snapshot and its writes.
- Inserts are untouched: new groups get `Origen` from the column default.
  (**Note 2026-10-07:** still true for `Origen`. The import now also reads an
  optional `Dias` column and its Grupo insert carries `dias` only for rows
  whose cell names at least one day; see amendment, decision D-3.)

**Existing tests that change:** `plan.test.ts` (snapshot fixtures need the two
fields; new scenarios), `catalog.test.ts` (projection), `apply.test.ts` (the
double must accept the lock; summary shape), `summary.test.ts`,
`events.test.ts` (the import payload equality and `makeSummary`; the credential
pins do not move), `catalog/import/actions.test.ts` and the two preview/form
component tests (state shape), `catalog-parity.test.ts` (`ROW_REASONS`).

**Rejected.** Reactivating the unlisted Asignatura (above); a separate
`reactivate` count in `EntityCounts` (breaks the five-column counts table and
its copy for one number); exempting manual groups from deactivate-absent
(decided against by D3).

### 8. Routes and UI

```
src/app/(dashboard)/catalog/
  not-found.tsx                      server   "record not available" + way back
  asignaturas/page.tsx               server   list
  asignaturas/new/page.tsx           server   breadcrumb + form
  asignaturas/[id]/edit/page.tsx     server   form + state section
  asignaturas/asignatura-form.tsx    client   create and edit
  asignaturas/actions.ts             "use server"
  grupos/...                         same five files
  docentes/page.tsx                  server   read-only list
  active-toggle.tsx                  client   shared two-step control
```

- **Forms.** `useActionState`, submitted through `onSubmit` with
  `startTransition(() => dispatch(new FormData(form)))`. React resets
  uncontrolled fields when a form `action` settles, which would discard an
  edit on a validation error; a hand dispatch does not reset (the import form
  already dispatches this way, R7). The record id travels as a hidden field and
  is never trusted: it is parsed, then scoped.
- **URL state.** `page`, `q` and `status` live in the query string. The pure
  parsing moves to a generic `src/lib/list-params.ts`;
  `src/lib/users/list-params.ts` keeps its exported names and delegates, so its
  tests are untouched. `status` defaults to `active` and unknown values fall
  back to it. `DataTableSearch` gains two optional props (`hidden` fields and
  `clearHref`) so a search keeps the status filter.
- **Confirmation: an inline two-step control.** On the edit page, a "State"
  section shows the status pill and one button. Pressing it reveals a sentence
  naming the consequence, a confirm button and a cancel; focus moves to the
  confirm, cancel restores it, and the result is announced through
  `aria-live`. Deactivation is reversible, so step one is the `secondary`
  variant and only the confirm uses `destructive`. The list offers an "Edit"
  link only, so no mutation is reachable from a link.

  | Option | Verdict |
  |---|---|
  | Dedicated confirm page | Rejected: two more routes, guards and test files per entity for one sentence |
  | **Inline two-step** | **Chosen**: no new primitive, no new token, works with the existing `Button` |
  | Base UI `AlertDialog` wrapper | Rejected: the proposal excludes new Dialog/AlertDialog primitives, and it needs a design-system entry first |

- **Selects in the Grupo form.** Carrera (tens of rows) keeps the existing
  `Select`. Asignatura and docente can reach hundreds of rows, which a plain
  list cannot serve, so they use a new `src/components/ui/combobox.tsx` wrapper
  over `@base-ui/react/combobox` (already installed, R8), styled with the
  `Input` and `Select` tokens and documented as one new entry in
  `docs/design-system.md` §5. Options are loaded on the server, active rows
  only, in scope, capped at `CATALOG_OPTIONS_MAX = 2000`; when the cap is hit
  the field says so. The Asignatura is chosen at creation only.
- **Editable fields.** Asignatura: `nombre`, `horasTotales`, and `carreraId`
  for unscoped roles; `Codigo` is rendered as text, not as an input (A1).
  Grupo: `docenteId` only; its natural key is rendered as text.
  (**Note 2026-10-07:** superseded. A Grupo edit now changes the docente, the
  meeting days, or both; see amendment, decisions D-5 and D-6.)
- **Shared pieces.** `StatusPill` moves to `src/components/status-pill.tsx`
  (`users/page.tsx` imports it); new `form-field.tsx` (label, hint, and the
  error under the field with `role="alert"`, per design system §5) and
  `status-filter.tsx` (three links, the selected one marked with
  `aria-current="true"` and the `accent` fill). `new-user-form.tsx` keeps its
  local `Field`: `/users/new` is out of scope.
- **States.** Scope `none`: one explanatory sentence, no create button, no
  query. Empty: one sentence and the create button. No results: the `/users`
  pattern. Degraded: the existing `role="status"` notice. Every edit form
  carries one muted line stating that the next catalog import can overwrite
  these values (the silent half of D3).
- **Design system.** No new colour, radius, type size or spacing step. The "you
  are here" marker (the primary bar on the sidebar item and the `.is-current`
  underline on the current breadcrumb segment, design-system.md §2.3) appears
  only in those two places; the status filter is a filter, not a location, so
  it uses `accent`. Interactive
  targets keep the 44px floor (`size="lg"`).

### 9. Sidebar

Three entries are added to the "Administración" `children`, each with
`visibleTo: canManageCatalog`, in this order: `catalogAsignaturas`
(`/catalog/asignaturas`), `catalogGrupos` (`/catalog/grupos`),
`catalogDocentes` (`/catalog/docentes`), then the existing `catalogImport` and
`users`. No entry claims `/catalog`, so by R12 `/catalog/import` and the three
new prefixes cannot match each other. `app-sidebar.test.tsx` pins the ordered
link list for the five roles and asserts exactly one `aria-current` on
`/catalog/import` and on `/catalog/asignaturas/12/edit`.

**Rejected:** one "Catálogos" entry spanning three routes (it needs a `/catalog`
prefix, which lights up on `/catalog/import`).

### 10. Readers

**Choice.** Both active-only readers also require `Asignatura.Activo`;
`buildActiveEnrollmentQuery` gains the join it lacks. By D4 and decision 4 an
active Grupo under an inactive Asignatura cannot be produced by the
application, so this is defence in depth against a direct SQL edit. **Blast
radius: none today** (R2): the only consumers are the two SQL-shape tests in
`catalog.test.ts`, which are updated. Future RF-03/RF-31 callers inherit the
rule. **Rejected:** leaving them as they are (the first consumer would have to
rediscover the rule).

### 11. i18n

Namespaces: `catalog.shared` (status labels, filter, toggle, field errors,
not-found, no-carrera, import-wins note), `catalog.asignaturas`,
`catalog.grupos`, `catalog.docentes`, and `nav.catalogAsignaturas`,
`nav.catalogGrupos`, `nav.catalogDocentes`. The import gains its preview and
result lines and the reason `asignatura.inactive`.

`catalog-parity.test.ts`: the seven sections join `GUARDED_SECTIONS`;
`ROW_REASONS` gains the new reason; a new pinned list asserts that
`catalog.shared.fieldErrors` holds exactly the keys the manual schemas can emit.

### 12. Work units and order

See *Work Units and Order*. Two revisions to the proposal: **WU4 moves ahead of
WU2 and WU3**, and WU1, WU2 and WU3 each split.

### 13. Testing strategy

See *Testing Strategy*.

---

## Data Flow

A manual write, every entity and every operation:

```
form (client) ── POST ──► action ("use server")
  1  requireCatalogAccess()
        requireRole(...rolesQueGestionanCatalogo) ─► /login | /change-password | /denied
        getCatalogActor(actorId)  [db, PK read]  ─► catalogScopeFor(rol, actor)
  2  scope none ─► { kind: "error" }            formData not read yet
  3  schema.safeParse(formData) ─► { kind: "invalid", fieldErrors }
  4  withCatalogWrite(actorId, work, toEvents)
        db.transaction(tx):
          SET LOCAL lock_timeout = '5s'
          SELECT pg_advisory_xact_lock(KEY)          serialises catalog writers
          work(tx): scoped SELECT ─► checks ─► scoped INSERT/UPDATE ... RETURNING
          events = toEvents(result)                  pure; [] for a refusal or no-op
          events.length > 0 ─► insertAuditEvents(tx, actorId, events)
        COMMIT                                       any throw ─► ROLLBACK, no audit row
  5  result.kind ─► state, or revalidatePath(...) + redirect(...)   outside try
```

Deactivating an Asignatura (D4), inside step 4:

```
SELECT "Id","Activo" FROM "Asignatura" WHERE "Id" = $1 AND <scope>   0 rows ─► not_found
already inactive ─► unchanged                                        no write, no audit
SELECT count(*) FROM "Grupo" WHERE "AsignaturaId" = $1 AND "Activo"  n > 0 ─► has_active_groups(n)
UPDATE "Asignatura" SET "Activo" = false WHERE "Id" = $1 AND <scope> RETURNING "Id"
```

Import apply after WU4 (only the new steps are marked):

```
db.transaction(tx):
  * acquireCatalogWriteLock(tx)
    snapshot ← loadCatalogSnapshot(tx)          * now with activo, origen
    plan ← planImport(parsed, snapshot)         * asignatura.inactive, reactivated, two counts
    applyImport(tx, plan, ...)
      Asignatura ▸ Usuario ▸ Grupo ▸ deactivate(grupoIds)
      insertAuditEvents(tx, [...buildAuditEvents(summary, touched),
                           * ...asignatura.reactivada per reactivated id])
```

---

## File Changes

| File | Action | Description |
|---|---|---|
| `src/db/schema.ts` | Modify | `asignatura.activo`; `grupo.origen` with `$type<GrupoOrigen>()` and `CK_Grupo_Origen` |
| `drizzle/0005_catalog_management.sql`, `drizzle/meta/0005_snapshot.json`, `_journal.json` | New/Modify | Generated; reviewed by hand |
| `src/db/migration-0005.test.ts` | New | SQL assertions (see Testing) |
| `modelo_datos_sql.md` | Modify | §3.1 both columns; §4 note 3 now true as written (manual maintenance exists); origin semantics |
| `src/lib/catalog/origen.ts` | New | `GRUPO_ORIGENES`, `GrupoOrigen` (pure) |
| `src/lib/catalog/scope.ts` | New | `CatalogScope`, `catalogScopeFor`, `carreraIdForWrite` (pure) |
| `src/lib/catalog/types.ts` | New | Result unions, list item types, form state types (pure) |
| `src/lib/catalog/list-params.ts` | New | Status filter parsing and hrefs (pure) |
| `src/lib/list-params.ts` | New | Generic `parsePage`, `parseQ`, href builder (pure) |
| `src/lib/users/list-params.ts` | Modify | Delegates; exported names unchanged |
| `src/lib/auth/permissions.ts` | Modify | Decision 3 |
| `src/lib/auth/catalog-access.ts` | New | `requireCatalogAccess` (server-only) |
| `src/lib/audit/types.ts`, `events.ts` | Modify | Decision 5; WU4 adds the two summary fields |
| `src/lib/audit/diff.ts` | New | `changedFields` (pure) |
| `src/lib/data/catalog-scope-sql.ts` | New | The only place a scope becomes SQL |
| `src/lib/data/catalog-write.ts` | New | `acquireCatalogWriteLock`, `withCatalogWrite`, failure log |
| `src/lib/data/asignaturas.ts`, `grupos.ts` | New | Scoped reads and transactional writes |
| `src/lib/data/users.ts` | Modify | `getCatalogActor`, `listDocentes`, `listDocenteOptions`; none selects `hashClave` |
| `src/lib/data/catalog.ts` | Modify | Readers require `Asignatura.Activo` (WU1); snapshot projects both columns (WU4) |
| `src/lib/validations/catalog-fields.ts`, `catalog.ts` | New | Shared rules; manual schemas |
| `src/lib/import/schemas.ts` | Modify | Imports the shared rules; behaviour unchanged |
| `src/lib/import/{types,plan,apply,summary}.ts` | Modify | Decision 7 |
| `src/app/(dashboard)/catalog/import/{actions.ts,import-preview.tsx}` | Modify | Two preview numbers; two result lines |
| `src/app/(dashboard)/catalog/**` | New | Decision 8 tree, with colocated tests |
| `src/components/{status-pill,form-field,status-filter}.tsx` | New | Shared pieces |
| `src/components/ui/combobox.tsx` | New | Base UI wrapper |
| `src/components/data-table-search.tsx` | Modify | Optional `hidden`, `clearHref` |
| `src/app/(dashboard)/users/page.tsx` | Modify | Imports `StatusPill`; nothing else |
| `src/components/app-sidebar.tsx` + test | Modify | Decision 9 |
| `docs/design-system.md` | Modify | §5 Combobox entry; §5 note on the two-step confirm |
| `i18n/es.json`, `i18n/en.json`, `src/i18n/catalog-parity.test.ts` | Modify | Decision 11 |

No file is deleted.

> **Note 2026-10-07.** The amendment adds files and modifies some already
> applied ones; see its *File changes* table.

---

## Interfaces / Contracts

> **Note 2026-10-07.** Four entries of this block are extended by the
> amendment and are no longer complete as written: `AUDITABLE_GRUPO_FIELDS`
> (gains `dias`), `GrupoListItem` (gains `dias`), the inputs of `createGrupo`
> and `updateGrupo`, and `grupoCreateSchema` / `grupoUpdateSchema`. The
> authoritative signatures are in the amendment's *Interfaces* block.

```ts
// src/lib/catalog/origen.ts — PURE
export const GRUPO_ORIGENES = ["importacion", "manual"] as const;
export type GrupoOrigen = (typeof GRUPO_ORIGENES)[number];

// src/db/schema.ts — the additions
activo: boolean("Activo").notNull().default(true),                 // asignatura
origen: varchar("Origen", { length: 12 }).$type<GrupoOrigen>()     // grupo
  .notNull().default("importacion"),
check("CK_Grupo_Origen", sql`${t.origen} in ('importacion', 'manual')`),
```

```ts
// src/lib/auth/permissions.ts
export function canManageCatalog(rol: RolUsuario | undefined): boolean;
export const rolesQueGestionanCatalogo: RolUsuario[];
export function isCarreraScopedRole(rol: RolUsuario | undefined): boolean;

// src/lib/catalog/scope.ts — PURE
export type CatalogScope =
  | { kind: "all" } | { kind: "carrera"; carreraId: number } | { kind: "none" };
export function catalogScopeFor(
  rol: RolUsuario, actor: { carreraId: number | null } | null,
): CatalogScope;
/** The carrera an Asignatura write may use, or null to refuse. */
export function carreraIdForWrite(
  scope: CatalogScope, requested: number | undefined,
): number | null;

// src/lib/auth/catalog-access.ts — server-only
export type CatalogAccess = {
  session: SessionPayload; actorId: number; scope: CatalogScope;
};
export async function requireCatalogAccess(): Promise<CatalogAccess>;
```

```ts
// src/lib/data/catalog-scope-sql.ts — server-only
export function asignaturaInScope(scope: CatalogScope): SQL | undefined;
export function asignaturaRowInScope(scope: CatalogScope, id: number): SQL;
export function grupoRowInScope(scope: CatalogScope, id: number): SQL;

// src/lib/data/catalog-write.ts — server-only
export const CATALOG_WRITE_LOCK_KEY = 5_005_001;
export const CATALOG_LOCK_TIMEOUT = "5s";
export async function acquireCatalogWriteLock(tx: Transaction): Promise<void>;
export class CatalogBusyError extends Error {}          // SQLSTATE 55P03
export async function withCatalogWrite<R>(
  actorId: number,
  work: (tx: Transaction) => Promise<R>,
  toEvents: (result: R) => readonly AuditEvent[],
): Promise<R>;
```

```ts
// src/lib/catalog/types.ts — PURE
export type CatalogStatusFilter = "active" | "inactive" | "all";
export type CatalogListResult<T> = {
  data: T[]; total: number; page: number; pageSize: number; degraded: boolean;
};
export type AsignaturaListItem = {
  id: number; codigo: string; nombre: string; carreraId: number;
  carreraNombre: string; horasTotales: number; activo: boolean;
};
export type AsignaturaDetail = AsignaturaListItem & { gruposActivos: number };
export type GrupoListItem = {
  id: number; asignaturaId: number; asignaturaCodigo: string;
  asignaturaNombre: string; periodo: string; numeroGrupo: string;
  docenteId: number; docenteNombre: string; activo: boolean; origen: GrupoOrigen;
};

export type AsignaturaWriteResult =
  | { kind: "created"; id: number }
  | { kind: "updated"; id: number; campos: readonly AuditableAsignaturaField[] }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "codigo_taken"; inScope: boolean; activo: boolean }
  | { kind: "carrera_invalid" };
export type AsignaturaActiveResult =
  | { kind: "changed"; id: number; activo: boolean }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "has_active_groups"; count: number };
export type GrupoWriteResult =
  | { kind: "created"; id: number }
  | { kind: "updated"; id: number; campos: readonly AuditableGrupoField[] }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "grupo_taken"; activo: boolean }
  | { kind: "asignatura_unavailable" }      // missing, inactive or out of scope
  | { kind: "docente_unavailable" };        // missing, inactive or not a docente
export type GrupoActiveResult =
  | { kind: "changed"; id: number; activo: boolean }
  | { kind: "unchanged"; id: number }
  | { kind: "not_found" }
  | { kind: "asignatura_unavailable" } | { kind: "docente_unavailable" };
```

```ts
// src/lib/data/asignaturas.ts — server-only
export function buildAsignaturasWhere(
  scope: CatalogScope, f: { status: CatalogStatusFilter; q: string },
): SQL | undefined;
export async function listAsignaturas(p: {
  scope: CatalogScope; status: CatalogStatusFilter; q: string;
  page: number; pageSize: number;
}): Promise<CatalogListResult<AsignaturaListItem>>;
export async function getAsignaturaById(
  scope: CatalogScope, id: number,
): Promise<AsignaturaDetail | null>;
export async function listAsignaturaOptions(
  scope: CatalogScope,
): Promise<{ id: number; codigo: string; nombre: string }[]>;   // active only
export async function createAsignatura(
  tx: Transaction, scope: CatalogScope,
  input: { codigo: string; nombre: string; carreraId?: number; horasTotales: number },
): Promise<AsignaturaWriteResult>;
export async function updateAsignatura(
  tx: Transaction, scope: CatalogScope, id: number,
  input: { nombre: string; carreraId?: number; horasTotales: number },
): Promise<AsignaturaWriteResult>;
export async function setAsignaturaActivo(
  tx: Transaction, scope: CatalogScope, id: number, activo: boolean,
): Promise<AsignaturaActiveResult>;

// src/lib/data/grupos.ts — server-only; same shape
export async function listGrupos(p: {...}): Promise<CatalogListResult<GrupoListItem>>;
export async function getGrupoById(scope: CatalogScope, id: number): Promise<GrupoListItem | null>;
export async function createGrupo(
  tx: Transaction, scope: CatalogScope,
  input: { asignaturaId: number; periodo: string; numeroGrupo: string; docenteId: number },
): Promise<GrupoWriteResult>;                 // always inserts origen: "manual"
export async function updateGrupo(
  tx: Transaction, scope: CatalogScope, id: number, input: { docenteId: number },
): Promise<GrupoWriteResult>;
export async function setGrupoActivo(
  tx: Transaction, scope: CatalogScope, id: number, activo: boolean,
): Promise<GrupoActiveResult>;

// src/lib/data/users.ts — additions; none projects hashClave
export async function getCatalogActor(id: number): Promise<{ carreraId: number | null } | null>;
export async function listDocentes(p: {
  status: CatalogStatusFilter; q: string; page: number; pageSize: number;
}): Promise<CatalogListResult<{ id: number; nombreCompleto: string; login: string;
  correo: string | null; activo: boolean }>>;
export async function listDocenteOptions(): Promise<
  { id: number; nombreCompleto: string; correo: string | null }[]>;   // active docentes
```

```ts
// src/lib/audit/types.ts — additions (existing members unchanged)
export const AUDITABLE_ASIGNATURA_FIELDS =
  ["codigo", "nombre", "carreraId", "horasTotales", "activo"] as const;
export const AUDITABLE_GRUPO_FIELDS =
  ["asignaturaId", "periodo", "numeroGrupo", "docenteId", "activo", "origen"] as const;
export type AuditOrigin =
  | { origen: "manual" }
  | { origen: "importacion"; importacionSha256: string };
type CatalogRecordPayload<F extends string> = { campos: readonly F[] } & AuditOrigin;
// AuditEntityType gains "Asignatura" | "Grupo"; AUDIT_ACTIONS gains the eight codes.
// AuditEvent gains two members, each with entidadId: number.

// src/lib/audit/diff.ts — PURE. Returns NAMES only.
export function changedFields<F extends string>(
  fields: readonly F[], before: Record<F, unknown>, after: Record<F, unknown>,
): F[];

// src/lib/audit/events.ts — additions; buildAuditEvents is not edited
export const MANUAL_ORIGIN: AuditOrigin;
export function asignaturaCreatedEvent(a: { asignaturaId: number; origin: AuditOrigin }): AuditEvent;
export function asignaturaUpdatedEvent(a: { asignaturaId: number;
  campos: readonly AuditableAsignaturaField[]; origin: AuditOrigin }): AuditEvent;
export function asignaturaActiveChangedEvent(a: { asignaturaId: number;
  activo: boolean; origin: AuditOrigin }): AuditEvent;   // .desactivada | .reactivada
// grupoCreatedEvent, grupoUpdatedEvent, grupoActiveChangedEvent: same shape.
/** Result -> events. `[]` for every refusal and for `unchanged`. */
export function asignaturaWriteEvents(r: AsignaturaWriteResult | AsignaturaActiveResult): AuditEvent[];
export function grupoWriteEvents(r: GrupoWriteResult | GrupoActiveResult): AuditEvent[];
```

```ts
// src/lib/validations/catalog.ts — PURE, built from catalog-fields.ts
export const asignaturaCreateSchema;   // codigo, nombre, carreraId?, horasTotales
export const asignaturaUpdateSchema;   // nombre, carreraId?, horasTotales  (no codigo, A1)
export const grupoCreateSchema;        // asignaturaId, periodo, numeroGrupo, docenteId
export const grupoUpdateSchema;        // docenteId
export function parseRecordId(raw: unknown): number | null;   // /^[1-9][0-9]{0,14}$/

// src/lib/catalog/list-params.ts — PURE
export const CATALOG_PAGE_SIZE = 20;
export const CATALOG_OPTIONS_MAX = 2000;
export function parseCatalogListParams(sp): { page: number; q: string; status: CatalogStatusFilter };
export function catalogListHref(
  base: "/catalog/asignaturas" | "/catalog/grupos" | "/catalog/docentes",
  p: { page?: number; q?: string; status?: CatalogStatusFilter },
): string;                              // defaults are omitted from the URL
```

```ts
// src/lib/catalog/types.ts — action states
export type CatalogFormState =
  | { kind: "idle" }
  | { kind: "invalid"; fieldErrors: Record<string, string> }   // translated
  | { kind: "error"; message: string }
  | { kind: "gone" };                   // not found OR out of scope, never told apart
export type ActiveToggleState =
  | { kind: "idle" } | { kind: "done"; activo: boolean }
  | { kind: "error"; message: string } | { kind: "gone" };

// src/app/(dashboard)/catalog/asignaturas/actions.ts  (grupos/actions.ts mirrors it)
export async function createAsignaturaAction(prev: CatalogFormState, fd: FormData): Promise<CatalogFormState>;
export async function updateAsignaturaAction(prev: CatalogFormState, fd: FormData): Promise<CatalogFormState>;
export async function setAsignaturaActivoAction(prev: ActiveToggleState, fd: FormData): Promise<ActiveToggleState>;
// First statement of all three: const access = await requireCatalogAccess();
```

```ts
// src/lib/import/types.ts — WU4
export type AsignaturaRow = { ...; activo: boolean };
export type GrupoRow = { ...; origen: GrupoOrigen };
// AsignaturaWrite "update" gains: reactivated: boolean
export type ImportPlan = { ...; asignaturasToReactivate: number; manualGruposToDeactivate: number };
export type ImportSummary = { ...; asignaturasReactivated: number; manualGruposDeactivated: number };
// PreviewState "preview" arm gains the same two plan numbers.
```

---

## Testing Strategy

Strict TDD: each row is a failing test first. `vi.mock("server-only", () => ({}))`
as established.

| Layer | What | Approach |
|---|---|---|
| Unit, pure | `catalogScopeFor` and `carreraIdForWrite` tables (five roles, null carrera, missing actor, foreign carrera requested) | Table-driven |
| Unit, pure | Permission predicates over the five roles, plus a derivation test that `canManageCatalog` tracks `canCreateUsers` | Table-driven |
| Unit, pure | `changedFields`; every new builder; `asignaturaWriteEvents`/`grupoWriteEvents` emit exactly one event for `created`/`updated`/`changed` and none otherwise | Hand-built fixtures |
| Unit, pure | Credentials cannot reach a payload: the forbidden-key sweep extends to the new builders; a `@ts-expect-error` that a manual origin cannot carry `importacionSha256` | Negative type tests |
| Unit, pure | Manual schemas; `parseRecordId`; list-param parsing and hrefs; `schemas.test.ts` unchanged and green | Table-driven |
| Unit, pure | `planImport`: reactivation with and without field changes, `asignatura.inactive`, both counts, origin preserved | Fixtures, no database |
| Unit, SQL shape | `asignaturaInScope` and both row predicates for the three scope kinds; list queries; the two readers | `new QueryBuilder().toSQL()` |
| Unit, SQL text | `migration-0005.test.ts`: both `ADD COLUMN`s with default and `NOT NULL`; the CHECK lists exactly `GRUPO_ORIGENES`; no `DROP`, no rename; journal has `0005`; the `0005` snapshot contains no `EventoAuditoria` | `readFileSync` |
| Integration, `tx` double | Each write: the scoped predicate reaches every statement (sentinel); no insert happens when the scoped select is empty; D4 refusal carries the count and issues no update; a no-op issues no update | Hand-rolled recording double |
| Integration, `tx` double | `withCatalogWrite`: timeout then lock are the first two statements; audit rows go to the same handle, last; a throw leaves no audit insert; an empty event list inserts nothing; `55P03` becomes `CatalogBusyError` | Same double |
| Integration | Actions: the guard runs before any `formData.get`; `docente`/`estudiante` never reach the data layer; scope comes from the guard, never from the form; `gone` for a foreign id; `23505` maps to the typed result; no driver text in any state | `vi.mock` of the guard and data layer, as `users/new/actions.test.ts` |
| Integration | Pages: real `dal.ts` over a mocked session; five-role table; anonymous; flagged user; `notFound` for a bad or foreign id; the no-carrera state issues no list query | As `catalog/import/page.test.tsx` |
| Component | Forms, the two-step toggle, the status filter, the combobox wrapper | Testing Library with the real catalogs |
| Structural pins | No `.delete(` and no `delete from` in the catalog data modules and actions; no `.set(` names `origen`; every catalog `page.tsx` and action source calls `requireCatalogAccess(`; `listDocentes` never selects `hashClave` | `readFileSync` and projection assertions |
| i18n | Parity for the seven sections; reason and field-error lists | Existing parity test |
| E2E | Not available (`openspec/config.yaml`) | |

**Proved only by the Neon rehearsal, not by tests:** the column defaults and
the CHECK firing (G4, G5), and the advisory lock with its timeout through the
pooled endpoint (G6). The `tx` double proves the statements were issued in
order, not that Postgres serialises anything.

**Avoiding the known flaky class.** After any interaction, queries are
`await screen.findBy...`, never a synchronous `getAllByRole` (the
`new-user-form.test.tsx` failure). Every action promise a test starts is
resolved inside `act` before the test ends (apply-progress finding 3). Combobox
options are awaited after typing; popup contents are never read synchronously.

---

## Threat Matrix

The standard rows do not apply: the change runs no shell, subprocess, VCS or PR
automation and classifies no file as executable.

| Boundary | Applicability |
|---|---|
| Documentation-like paths; Git repository selection; Commit state; Push state; PR commands | **N/A**, for the reason above |

Boundaries this change does have, carried with the same discipline:

| Boundary | Adversarial cases | Design response | Planned RED tests |
|---|---|---|---|
| Object reference (IDOR) | A `coordinacion` user submits another carrera's Asignatura or Grupo id, a foreign `asignaturaId` in a Grupo create, a foreign `carreraId` in an Asignatura create | Scope in the statement's `WHERE`; inserts use ids from scoped selects; `carreraIdForWrite`; identical answer for missing and foreign | Sentinel tests; action tests with foreign ids |
| Authorisation order | A `docente` posts directly to an action; a body crafted to fail parsing first | Guard is the first statement | "guard before `formData.get`" per action |
| Mutation by GET | A link that deactivates | Mutations exist only as Server Actions; lists hold links to pages | Structural pin on the list pages |
| Existence disclosure | Probing ids to map another carrera | `notFound()` and `gone` for both cases; `codigo_taken` never names the carrera | Page and action tests |
| Audit payload | A value, name or email in `datos` | Field names from closed lists | Forbidden-key sweep |
| Physical delete | Any delete statement | None exists | Structural pin |

---

## Migration / Rollout

1. Generate and review `0005` locally (no connection).
2. Run gates G1 to G6 on the rehearsal branch, then G7 to G10. Each `[CONFIRM]`
   gate is one explicit user approval.
3. Only after G9 is the first work unit merged or deployed (ordering rule,
   decision 1).
4. No feature flag: the screens are invisible and server-denied to `docente`
   and `estudiante`, and inert until used.
5. Runtime harness for every UI unit is the user's manual smoke in `npm run
   dev`. A smoke that writes must target a rehearsal branch, or be confirmed
   for the shared database.

### Rollback

| Situation | Action |
|---|---|
| Nothing applied | `git revert`; delete `0005`, its snapshot and journal entry |
| `0005` fails mid-way | drizzle wraps it in one transaction; nothing remains |
| `0005` applied, code reverted | Leave the columns. Defaults keep older code correct |
| Columns must go | The generated compensating migration in decision 1, with confirmation |
| A UI unit misbehaves | `git revert` of that unit; no schema involved |
| WU4 misbehaves | `git revert`; the import returns to today's behaviour. If manual deactivations already exist, the import again ignores `Asignatura.Activo` (C7) until WU4 returns |
| A wrong manual write | Corrected by another manual write or a re-import; each leaves its own audit row; no audit row is ever edited |

---

## Work Units and Order

**One PR is not realistic.** The numbers below are bottom-up counts of authored
lines **including tests and both locale files**, with no multiplier applied on
top; they exclude the generated snapshot. They total roughly 7,500 to 9,500
lines, about two and a half times the proposal's figure, which matches the
previous change (its last unit was estimated at 660 and measured 3,233). **The
cached `single-pr` strategy cannot hold. This design does not choose the
replacement: that decision belongs to the user at the tasks phase.**

Order: WU1a, WU1b, WU1c, **WU4**, WU2a, WU2b, WU2c, WU3a, WU3b, WU5. WU4 goes
first among the feature units so the import already understands `Activo` and
`Origen` before any screen can produce those states; until then it is inert.

| WU | Content | Est. lines | Depends on | Focused tests | Rollback boundary |
|---|---|---|---|---|---|
| WU1a | `schema.ts`, `0005`, `origen.ts`, `migration-0005.test.ts`, `modelo_datos_sql.md`, reader change; gates G1 to G10 | 250-350 | — | `npx vitest run src/db src/lib/data/catalog.test.ts` | Revert code; columns may stay |
| WU1b | Audit union, builders, `diff.ts`, suites | 400-550 | — | `npx vitest run src/lib/audit` | `git revert` |
| WU1c | Predicates, scope, guard, scope SQL, `withCatalogWrite`, shared field rules, `getCatalogActor` | 600-800 | WU1b | `npx vitest run src/lib/auth src/lib/catalog src/lib/data src/lib/validations src/lib/import/schemas.test.ts` | `git revert` |
| WU4 | Decision 7 end to end | 800-1,000 | WU1a applied, WU1b, WU1c | `npx vitest run src/lib/import src/lib/audit "src/app/(dashboard)/catalog/import" src/i18n` | `git revert` |
| WU2a | `asignaturas.ts`, manual schemas, generic and catalog list-params | 800-1,000 | WU1c | `npx vitest run src/lib/data/asignaturas.test.ts src/lib/validations src/lib/catalog src/lib/users` | `git revert` |
| WU2b | Shared pieces, list page, `not-found`, sidebar, i18n for the list | 900-1,200 | WU2a | `npx vitest run src/components "src/app/(dashboard)/catalog/asignaturas" src/i18n` | `git revert` |
| WU2c | Form, actions, new and edit pages, two-step toggle, their copy | 1,100-1,400 | WU2b | `npx vitest run "src/app/(dashboard)/catalog"` | `git revert` |
| WU3a | `grupos.ts`, option readers, suites | 750-950 | WU2a | `npx vitest run src/lib/data` | `git revert` |
| WU3b | Combobox wrapper and design-system entry, Grupo pages, form, actions, copy | 1,500-1,900 | WU3a, WU2c | `npx vitest run src/components "src/app/(dashboard)/catalog/grupos" src/i18n` | `git revert` |
| WU5 | `listDocentes`, docentes page, copy | 450-600 | WU1c, WU2b | `npx vitest run src/lib/data/users "src/app/(dashboard)/catalog/docentes"` | `git revert` |

Against the 800-line budget: WU1a, WU1b and WU1c fit; WU4 and WU2a are at the
limit; WU2b, WU2c and WU3b exceed it and split once more at copy versus code or
form versus actions. Levers the user may pull, none decided here: replace the
combobox with the existing `Select` (about 250 lines less, at a usability
cost); defer WU5; drop the two summary counters from WU4 (about 150 lines of
test churn).

Runtime harness per unit: none for WU1b, WU1c, WU2a and WU3a (pure and
double-backed); the Neon gates for WU1a; the user's manual smoke for every unit
with a screen and for WU4's preview.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A writer skips `withCatalogWrite` and the lock | Low | It is the only caller of `db.transaction` in the catalog modules (source pin); writes need a `tx`, which only it hands out |
| `lock_timeout` does not bound an advisory-lock wait, or the pooled endpoint breaks the lock | Low, high impact | Gate G6 proves it before any code depends on it. Fallback without redesign: `pg_try_advisory_xact_lock` with a short retry |
| Pooled endpoint without `prepare: false` (fact given) now sits under every save | Unknown | The app and the `0004` apply work today. G6 runs through the pooler; a failure there is a blocking finding, not something to patch silently |
| A manual write commits between the import's snapshot and its writes before WU4 lands | Low | WU4 is ordered first |
| Scope omitted on one path | Low, high impact | Required parameter, one SQL module, sentinel tests |
| The next import overwrites manual edits (C3, C4) | High | Accepted by D3; stated on every edit form |
| Inactive docente still resolves in the import (C12) | Low today | Manual writes require an active docente; the import side stays a recorded gap |
| Mixed-case `Correo` (C10) | Low-Med | Not introduced or fixed here |
| Base UI combobox is unstable under jsdom | Med | Await-only queries; the `Select` fallback is a tasks-level lever |
| Real catalog sizes are unknown | Med | G1 reads the counts; `CATALOG_OPTIONS_MAX` is explicit and visible when hit |
| Size overrun | High | Ten slices with named seams; strategy decided with the user |
| Deltas written against unarchived specs | Med | Archive or commit `catalog-excel-import` first (proposal) |

---

## What this design does NOT do

- Edit, deactivate or create user accounts; create a docente outside
  `/users/new`; change `rolesAsignables`, `rolesVisibles`, `canImportCatalog`
  or `/users/new`.
- Manage `Facultad` or `Carrera`; touch `Inscripcion` or student accounts.
- Audit reads. Check `Usuario.Activo` for a live session.
- Physically delete any row, or add any delete statement.
- Cascade a deactivation. Protect manual rows from the import.
- Add a Dialog, AlertDialog or Tabs primitive. Rename `middleware.ts`.
- Change `prepare`, the connection or the pooling mode.
- Migrate the audit table, or narrow the `TODO` types in `audit-schema.ts`.
- Add an index, a trigger, a version column or a feature flag.
- Integrate the institutional API.
- Decide the delivery strategy.

---

## Departures from the proposal

| # | Departure | Why |
|---|---|---|
| P1 | Order: WU4 before WU2 and WU3; WU1, WU2, WU3 split; total about 2.5 times larger | Import must understand the new states first; bottom-up counts |
| P2 | A `Combobox` primitive is added | Hundreds of options are unusable in a plain list. The proposal excludes Dialog, AlertDialog and Tabs by name, not this; it is still a new primitive and is flagged |
| P3 | `ImportSummary` and the import audit payload gain two counters; reactivations are audited per record | The preview disappears after confirm; without them nothing durable records that manual work lost |
| P4 | The import transaction takes the advisory lock | Closes the snapshot-to-write race; no row is written by it |
| P5 | Both active-only readers require `Asignatura.Activo` (the proposal left it open) | Zero callers today; cheapest moment to fix the rule |
| P6 | Files not in *Affected Areas*: `data-table-search.tsx`, `catalog/not-found.tsx`, `docs/design-system.md`, `src/lib/data/users.ts`, `src/lib/import/{apply,summary}.ts` | Consequences of decisions 7 and 8 |
| P7 | "`apply.ts` insert code does not change" holds, with a caveat | Declaring the columns makes existing inserts name them, hence the ordering rule |

---

## Points the specs must pin

1. A record outside scope and a missing record get the same answer, on pages
   and on actions.
2. `coordinacion` with a null `CarreraId`: explanatory state, no data, every
   write refused; an Asignatura create by `coordinacion` uses its own carrera
   and a different submitted carrera is refused.
3. Editable fields: Asignatura `nombre`, `horasTotales`, and `carreraId` for
   unscoped roles only; Grupo `docenteId` only. `Codigo` and the Grupo natural
   key are immutable after creation. (**Note 2026-10-07:** the Grupo's
   editable fields are now the docente and the meeting days; pinned by
   CM-GRP-2 and CM-GRP-6.)
4. `Codigo` comparison is exact after trimming, identical to the import.
5. Creating a record whose natural key already exists is refused, whether the
   existing row is active or inactive; the message points to reactivation only
   when that row is inside the caller's scope.
6. A manual write that leaves a Grupo active requires an active Asignatura and
   an active docente; a docente change always requires an active docente;
   deactivating a Grupo is always allowed; reactivating an Asignatura is always
   allowed.
7. The D4 refusal states the count and performs no write and no audit.
8. A no-op edit and a no-op state change write nothing and audit nothing.
9. Exactly one audit row per effective manual write, same transaction, field
   names only, `origen: "manual"`.
10. `Grupo.Origen` is set at creation and never rewritten, including when the
    import later matches or reactivates a manual group.
11. Import: reactivation counts as an update and is shown before confirm; a
    Grupo row for an inactive Asignatura absent from the workbook's sheet is
    the row error `asignatura.inactive`; the preview states the manual-group
    count; each reactivation has its own audit event with the file digest.
12. Lists default to active rows; `status` accepts `active`, `inactive`, `all`.
13. A concurrent catalog write that cannot start within the lock timeout is
    reported as "busy, try again" and writes nothing.
14. The docentes list is unscoped, read-only, and exposes no credential field.
15. Active-only readers also require an active Asignatura.

---

## Could not be verified

- That `lock_timeout` bounds an advisory-lock wait, and that the transaction-
  scoped lock behaves through Neon's pooled endpoint (gate G6).
- That drizzle's insert builder names every table column with `default`; the
  ordering rule is correct either way.
- The exact SQL text drizzle-kit will emit for `0005`.
- That `(dashboard)/catalog/not-found.tsx` renders inside the dashboard layout.
- That a hand-dispatched `useActionState` form is never reset by React; it is
  consistent with `import-form.tsx` but was not run here.
- The Base UI combobox under jsdom.
- Real row counts of `Asignatura`, `Grupo` and docentes.
- How many literal fixtures in `plan.test.ts` need the two new fields.

---

## Open for the owner

- [ ] **Existing inactive record on create**: refuse and point to reactivation
      (designed), or reactivate automatically?
- [ ] **Grupo edits limited to the docente** (designed). Is correcting a wrong
      period or group number by deactivating and creating a new group
      acceptable? (**Note 2026-10-07:** the owner added the meeting days to
      the editable fields; the natural key stays immutable.)
- [ ] **Moving an Asignatura to another carrera** is allowed for
      `administrador` and `secretaria` (designed). Confirm.
- [ ] **Workbook Grupo row for an inactive Asignatura not in the workbook**:
      row error (designed), or reactivate it too?
- [ ] **Import audit row gains two counters and per-record reactivation
      events** (designed, departure P3). Confirm, or keep the preview as the
      only place that number appears.
- [ ] **Readers require an active Asignatura** (designed, departure P5).
- [ ] **Delivery strategy**: ten slices or more against an 800-line budget;
      chained PRs, a size exception, or a reduced scope. Decided at the tasks
      phase.

---
---

# Amendment 2026-10-07: meeting days of a Grupo

> **Second DB-touching change.** This section plans commands; it runs none.
> Every Neon step is tagged `[READ-ONLY]` or `[CONFIRM]` (one explicit user
> "yes" per command). `drizzle-kit push` is never used.

Contract: `proposal.md` "Amendment 2026-10-07" and the delta specs (new
CM-GRP-6, CM-GRP-7, AC-DIAS, AC-DIAS-ADD, CEI-DIAS-1..4; modified CM-GRP-1,
CM-GRP-2, CM-I18N-1, AL-PAY, AL-SET). Binding owner rules: A-DIAS-REQ,
A-DIAS-REACT, A-DIAS-NOSEARCH, A-DIAS-IMP-a, -c, -d as written, and
**A-DIAS-IMP-b as flipped by the owner: an empty `Dias` cell leaves the stored
days untouched; the import never clears days.** Where this section says
"design decision", the spec is silent and the choice is made here.

State this amendment is written against: Phases 0-9 applied and uncommitted on
`0a45737`, `0005` applied on production, Phase 11 in progress, Phases 10, 12,
13, 14, 15 not started.

Decisions are numbered **D-1 to D-8** so they cannot be confused with decisions
1-13 above. Gates are **DG1 to DG10**.

## A. Verified findings (2026-10-07)

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| F-A | `parse.ts` writes `""` for an optional column whose header is absent, so "column absent" and "empty cell" are indistinguishable today | `src/lib/import/parse.ts:128-133` | D-3 changes this for `Grupos.Dias` only |
| F-B | `issuesToRowErrors` puts the **field name** in `RowError.value`, not the cell text | `src/lib/import/plan.ts:37-48` | `dias.invalid` must name the offending token, so it is raised by the planner, not by a zod message |
| F-C | The template and the contract card iterate `SHEETS[i].required` then `.optional` | `src/lib/import/template.ts:14`, `workbook-contract.tsx:41-62` | Declaring `Dias` in `SHEETS` updates both with no code change (CEI-DIAS-4) |
| F-D | No checkbox primitive exists (`src/components/ui/`: avatar, breadcrumb, button, card, collapsible, combobox, dropdown-menu, input, label, select, separator, sheet, sidebar, skeleton, sonner, table, tooltip); `docs/design-system.md` §5 has no checkbox entry | glob, grep | D-6 adds the smallest token-only one |
| F-E | `FormField` renders `<Label htmlFor={id}>` and hands `id` / `aria-describedby` / `aria-invalid` to **one** control | `src/components/form-field.tsx` | It cannot label a group of seven inputs; D-6 adds a sibling with the same visual pattern |
| F-F | `AUDITABLE_GRUPO_FIELDS` follows the column order of `schema.ts`; `types.test.ts` pins the exact array; `events.test.ts:365` spreads the constant | `src/lib/audit/types.ts:74-81` | D-4: one line of production code, one pinned test |
| F-G | `grupoUpdateSchema` is `{ docenteId }` and `CATALOG_FIELD_ERROR_KEYS` has 15 keys; both applied in Phase 5 and pinned by `validations/catalog.test.ts` and the parity test | `src/lib/validations/catalog.ts:83-106` | D-5 modifies applied code |
| F-H | The only application statements on `Grupo` today are the import's insert and two updates, the snapshot select (explicit projection), a `count(*)` in `asignaturas.ts`, and two reader joins | grep `(from\|insert\|update\|innerJoin)(grupo` | Only the import's insert is affected by declaring a new column before it exists (D-2 ordering rule) |
| F-I | `migration-0005.test.ts` looks up `idx: 5` and the `0004`-to-`0005` snapshot chain; nothing in it counts journal entries | `src/db/migration-0005.test.ts:80-101` | It stays green, unmodified, after `0006` is generated |
| F-J | AC "Manual writes require an active Asignatura and an active docente" lists create, docente change and reactivation only | `specs/academic-catalog/spec.md:73-95` | A days-only edit triggers no parent check (D-5) |

## B. Decisions

### D-1. Storage: one `smallint` bitmask column

**Choice.** `Grupo."Dias" smallint NOT NULL DEFAULT 0`, with the named
constraint `CK_Grupo_Dias CHECK ("Dias" BETWEEN 0 AND 127)`. Bit `i` (value
`1 << i`) is the `i`-th day of the week, **Monday = bit 0 … Sunday = bit 6**,
so the bit index equals Postgres `isodow - 1`. `0` is the empty set.

| Option | Additive, safe default | DB guarantees "only the seven" | "Unchanged" detection | drizzle-kit risk | Verdict |
|---|---|---|---|---|---|
| **`smallint` bitmask + CHECK range** | Yes: constant default, metadata-only `ADD COLUMN`; an insert that omits it stores `0` | Yes, completely: every integer in 0..127 is a valid set and nothing else passes. Duplicates and order cannot be represented at all | `a === b` on two numbers, in the planner, in `updateGrupo` and in `changedFields` (`Object.is`) | Same two statement kinds `0005` already emitted cleanly (`ADD COLUMN ... DEFAULT ... NOT NULL`, `ADD CONSTRAINT ... CHECK`) | **Chosen** |
| Postgres array (`smallint[]` or `varchar[]`) | Yes | Partly: `<@ ARRAY[...]` rejects foreign values but admits duplicates and any order, so set equality needs normalisation on every write and a deep comparison on every read | Array comparison after sorting | Array defaults (`'{}'`) and array CHECK text are a kind of emission this repository has never reviewed | Rejected |
| Child table `GrupoDia (GrupoId, Dia)` | Yes | Yes (PK + CHECK) | Set comparison across rows; a days edit becomes delete-and-insert, which collides with "no delete statement exists in the catalog modules" (CM-NFR-1 pins) | New table, FK, PK | Rejected: also adds a join to every list row and to the snapshot |
| Seven boolean columns | Yes | Yes | Seven comparisons | Seven columns | Rejected: seven audit names or a synthetic one; noisy schema |

The cost of the bitmask is that the value is opaque in ad-hoc SQL; it is paid
once, in `modelo_datos_sql.md` §3.1, which documents the bit table.

**Single TypeScript source of truth**, mirroring `origen.ts`:
`src/lib/catalog/dias.ts` (pure; see *Interfaces*). Codes are the unaccented
Spanish names (`lunes` … `domingo`), consistent with the repository's Spanish
domain identifiers (`importacion`, `manual`, role codes); they are the form's
wire values and the i18n key suffixes. **The mask exists only in the database
row, the import snapshot/plan and inside the data layer; pages, forms, actions
and list items carry `DiaSemana[]` in week order** (`decodeDias`).

`schema.ts` writes the bounds as literals inside the `sql` template (see
*Interfaces*): an interpolated number would become a bind parameter in
generated DDL.
`schema.test.ts` pins that the literal upper bound equals `DIAS_MASK_MAX`.

**Future read (not built here).** In TypeScript, `decodeDias(row.dias)`; in SQL,
`("Dias" & (1 << (extract(isodow from <date>)::int - 1))) <> 0`. Note for that
change: JavaScript `Date.getDay()` is Sunday = 0, so the bit index is
`(getDay() + 6) % 7`, and the date's time zone must be decided there.

**No index** (A-DIAS-NOSEARCH: the days are never searched or filtered).

### D-2. Migration `0006` and the ordering rule

**Generation.** `[CONFIRM]` `npm run db:generate -- --name grupo_dias` (local,
no connection). Expected output: `drizzle/0006_grupo_dias.sql`,
`drizzle/meta/0006_snapshot.json` (`prevId` = the `0005` snapshot id), journal
entry `idx: 6`. Expected SQL, **exactly two statements**:

```sql
-- EXPECTED shape; the emitted file is the source of truth and is hand-reviewed.
ALTER TABLE "Grupo" ADD COLUMN "Dias" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Grupo" ADD CONSTRAINT "CK_Grupo_Dias" CHECK ("Grupo"."Dias" between 0 and 127);
```

Hand review stops the unit and reports to the user on: any third statement;
anything touching `EventoAuditoria`, `Asignatura`, `CK_Grupo_Origen` or the
unique constraint; any `DROP`, `RENAME`, `ALTER COLUMN`, data statement or
transaction control; a rename prompt (answer "create", never "rename").
`src/db/migration-0006.test.ts` copies the shape of `migration-0005.test.ts`
(file looked up by pattern, two statements, additive-only regexes, CHECK bounds
`0` and `DIAS_MASK_MAX`, journal `idx: 6`, snapshot chained to `0005`, no
`EventoAuditoria`).

**Gates** (same discipline as G1-G10; one step each, nothing batched; HC before
every write):

| Gate | Tag | Step |
|---|---|---|
| DG1 | `[READ-ONLY]` | On `production`: current row counts of `Asignatura` and `Grupo` (do **not** reuse the 2/2 of 2026-10-04); `Grupo.Dias` absent in `information_schema.columns`; six migration rows, the last with the `0005` hash `160ac32b…52ae`; shared host re-read from `.env` (host part only) |
| — | `[USER]` | Written approval of the emitted SQL and the `schema.ts` diff. A later edit to the file restarts at DG2 |
| DG-H | `[READ-ONLY]` | Freeze: sha256 of `drizzle/0006_*.sql` as in the working tree and with LF endings |
| DG2 | `[CONFIRM]` | Create a **fresh** Neon branch `rehearsal-0006` from `production` (AC-DIAS-ADD requires a fresh branch) |
| DG3 | `[CONFIRM]` | `npm run db:migrate` with a shell-scoped `DATABASE_URL` pointing at the branch; abort if the host equals the shared host |
| DG4 | `[READ-ONLY]` | On the branch: `Dias` is `smallint`, `NOT NULL`, default `0`; zero `Grupo` rows with `"Dias" <> 0`; `CK_Grupo_Dias` in `pg_constraint`; `Origen`, `Activo` and every count equal DG1; `CK_Grupo_Origen` still present; seven migration rows, the last with the DG-H LF hash |
| DG5 | `[CONFIRM]` | Probes on the branch, each inside a transaction ending in `ROLLBACK`: (a) `UPDATE "Grupo" SET "Dias" = 128` and `= -1`, and an `INSERT` with `128`, each fail with `23514`; (b) an insert that **omits** `Dias` stores `0` (what code predating the column does); (c) inserts with `Dias = 5` and `= 127` succeed, and an `UPDATE` back to `0` succeeds (the empty set is valid data); (d) `SELECT ("Dias" & 1) <> 0` type-checks on a `smallint`. Counts before and after are equal |
| DG6 | — | **Not repeated.** No new locking mechanism is introduced; the G6 evidence of 2026-10-04 stands |
| DG7 | `[CONFIRM]` | Optional: `backup-before-0006` from `production` (the owner decides whether it replaces `backup-before-0005`) |
| DG8a | `[READ-ONLY]` | Pre-apply re-check on `production`: repeat DG1; `.env` host equals the shared host; file hash equals DG-H |
| DG8 | `[CONFIRM]` | `npm run db:migrate` against `production`, exact command and host restated first |
| DG9 | `[READ-ONLY]` | Repeat DG4 on `production`. **Ordering gate: record "0006 applied and verified on production"** |
| DG10 | `[CONFIRM]` | Cleanup, see "Rehearsal branches" below |

**Ordering rule (hard), stated for the current reality.** drizzle's insert
builder names every declared column (using `default` for omitted ones), so from
the moment `src/db/schema.ts` in a working tree declares `grupo.dias`, **any
Grupo insert issued by that tree fails (`42703`) against a database that lacks
the column**. Today the only such insert is the import apply (F-H); later also
`createGrupo`. And from the moment the snapshot or `grupos.ts` project
`grupo.dias`, the import **preview** and the Grupos pages fail the same way.
Therefore:

1. `schema.ts` with the new column is not merged, deployed, or used by an app
   write flow against the shared database before DG9.
2. While everything is uncommitted, the rule applies to the **working tree and
   whatever database a running process points at**. From the task that edits
   `schema.ts` until DG9, no `npm run dev` session may run the import apply
   against `production` (the `.env` target), and none against
   `rehearsal-catalog-ui` either, because that branch was cut on 2026-10-07 at
   `0005` and lacks the column too. Asignatura screens and their write smokes
   are unaffected (no statement of theirs inserts into `Grupo` or reads
   `Dias`). The failure mode is a rolled-back transaction, not corrupted data,
   but it is still forbidden.
3. To keep that window short, the `schema.ts` edit, the generation and the
   hand review are the **last** code tasks of their unit and are followed
   directly by the gates. The pure pieces (`dias.ts`, the audit list) come
   first and carry no risk.
4. Code that only needs `dias.ts` and is exercised through doubles (the
   checkbox group, `grupos.ts` and the Grupo actions under test) may be written
   while the gates wait. Nothing that selects or writes `Grupo.Dias` is run
   against any database before that database has `0006`.
5. The three `drizzle/` files of `0006` must be committed together with (or
   before) the `schema.ts` change, as recorded for `0005`.

**Rehearsal branches.** `rehearsal-catalog-ui` is **not** used to rehearse
`0006`: the spec requires a fresh branch, and that one carries smoke data.
Default (design decision; each step is the user's `[CONFIRM]`): after DG9,
`rehearsal-0006` already has `0006` and becomes the target of the Grupo write
smokes (13.13, 15.6); `rehearsal-catalog-ui` is deleted once the pending
Asignatura smoke (9.12) is done, or, if the user wants to keep its data, gets
`0006` through one more `[CONFIRM]` `db:migrate` with HC before any Grupo
screen is pointed at it. DG10 deletes `rehearsal-0006` at the end of Phase 15.

**Rollback.** Preferred: leave the column; its default makes older code behave
exactly as before (DG5b). If it must go, revert `schema.ts` and *generate* the
compensating migration (`DROP CONSTRAINT "CK_Grupo_Dias"`, `DROP COLUMN
"Dias"`), with confirmation; it loses every stored day.

### D-3. Import: optional `Dias` column

- **Contract.** `SHEETS` (`sheets.ts`): the `Grupos` entry gets
  `optional: ["Dias"]`. By F-C the template and the contract card follow.
  `sheets.ts` also exports `ABSENCE_SIGNIFICANT = { Grupos: ["Dias"] }`.
- **Absent versus empty.** In `parse.ts`, an optional column listed in
  `ABSENCE_SIGNIFICANT` whose header is absent is **omitted from `cells`**; a
  present header with a blank cell yields `Dias: ""`. Every other optional
  column keeps today's `""` (changing `Telefono` would turn stored `""` into
  `null`: out of scope). `GrupoRowSchema` gains `Dias: z.string().optional()`
  (structural only, no cap: nothing of the raw text is stored). Both cases mean
  "do not touch the stored days", so the planner needs no branch on them; they
  stay distinguishable so that the two spec scenarios are driven by different
  inputs and so that a future reversal of A-DIAS-IMP-b is one planner line.
  Existing planner fixtures, which have no `Dias` key, already mean "column
  absent".
- **Token parser.** New pure module `src/lib/import/dias.ts`:
  `parseDiasCell(raw)`. It splits on `,`, trims, drops empty segments, looks
  each token up by `normalizeKey` (trim, lower-case, NFD, strip diacritics:
  covers composed and decomposed accents) in a closed table of fourteen keys
  (`lunes`/`lun` … `domingo`/`dom`), and returns `{ ok: true, mask }` or
  `{ ok: false, token }` with the **first** unrecognised token, trimmed, as
  written. `mask === 0` means "no token". Spanish tokens are a data contract,
  not UI copy: they never come from the i18n catalogs.
- **Planner (Stage C).** Directly after `GrupoRowSchema` succeeds and before
  the reference checks, `parseDiasCell(Dias ?? "")`. A failure pushes
  `{ sheet: "Grupos", row, reason: "dias.invalid", value: token }`, counts one
  `error` and skips the row, like the other non-schema row errors (design
  decision: the cell-format error wins over a reference error on the same
  row). For a new group the `create` write carries `dias: mask` **only when
  `mask > 0`**. For a matched group, `diasChanged = mask > 0 && mask !==
  existing.dias`; the row is an `update` when `docenteChanged || reactivated ||
  diasChanged`, and the write carries `dias: mask` only when `diasChanged`.
  Otherwise it is `unchanged`. A plan can therefore never contain `dias: 0`:
  the import cannot clear days. Deactivate-absent is untouched.
- **Snapshot.** `GrupoRow` gains `dias: number` (the mask);
  `loadCatalogSnapshot` projects `grupo.dias`.
- **Apply.** `writeGrupos` spreads `...(w.dias ? { dias: w.dias } : {})` into
  the insert values and into the update `.set`. **The values object names
  `dias` only when the row carries days**; a falsy mask is treated as absent,
  so even a planner bug could not clear days. (drizzle may still render the
  column with the `default` keyword for the other rows of a chunk; that is the
  ordering rule's reason, not a write of days.) No per-record `grupo.*` event.
- **Preview, summary, audit payload.** No new count, field or line: a days-only
  change is one `update` in `counts.Grupo` (CEI-DIAS-3). `ImportPlan`,
  `ImportSummary`, `PreviewState` and `buildAuditEvents` do not change.
- **Template and contract card.** No code change in `template.ts` or the
  header strip. `workbook-contract.tsx` adds two entries to `RULES`:
  `diasTokens` (names or three-letter abbreviations in Spanish, comma
  separated) and `diasEffect` (column left out keeps the stored days; a
  non-empty cell replaces them; an empty cell leaves them untouched; the import
  never clears days).
- **Rejected.** A zod refinement for the tokens (F-B: the token would be
  lost); a workbook-level "column present" flag (every `ParsedWorkbook` literal
  in the tests would need it); English tokens (A-DIAS-IMP-d); a preview figure
  for days changes (the spec asks for none).

### D-4. Audit

`AUDITABLE_GRUPO_FIELDS` becomes `["asignaturaId", "periodo", "numeroGrupo",
"docenteId", "activo", "origen", "dias"]`: **`dias` is appended last**, because
the list mirrors the column order of `schema.ts` (F-F) and `Dias` is the last
column. No stored audit row carries the old list (no manual Grupo write has
shipped). Consequences, with no builder edited:

- `grupoCreatedEvent` lists the full closed list, now including `dias`.
- `grupoUpdatedEvent` receives `campos` from `changedFields(["docenteId",
  "dias"], before, after)` where both records hold the **mask**; a days-only
  edit yields exactly `["dias"]`, a docente-and-days edit `["docenteId",
  "dias"]`. Two selections of the same set give the same mask, so nothing is
  reported.
- No payload carries a day name, a mask or a count: the builders accept field
  names only. Pinned by an exact-equality test
  (`datos` is `{ campos: ["dias"], origen: "manual" }`) and by extending the
  leak sweep of task 12.9 with day sentinels.

**Applied Phase 2 code and tests that change:** `src/lib/audit/types.ts` (one
line), `types.test.ts` (the pinned array of task 2.4), `events.test.ts` (new
days-only case; the `created` expectation follows the constant). The two
`@ts-expect-error` credential pins do not move.

### D-5. Grupos data layer, manual schema and actions

- **Reads.** `buildGruposWhere` gains nothing (pin: its SQL never mentions
  `"Dias"`). `listGrupos` and `getGrupoById` project `grupo.dias` and map it
  with `decodeDias`; `GrupoListItem` gains `dias: readonly DiaSemana[]`.
- **`createGrupo`.** Input gains `dias: readonly DiaSemana[]`; the insert sets
  `dias: encodeDias(input.dias)` next to `origen: "manual"`.
- **`updateGrupo`.** Input becomes `{ docenteId: number; dias: readonly
  DiaSemana[] }`. After the scoped read (which now returns the stored mask) and
  the `inactive` refusal: `docenteChanged`, `diasChanged = encodeDias(input.dias)
  !== row.dias`. Neither: `unchanged`, with no docente validation (the
  unchanged-inactive-docente exemption is kept). `docenteChanged`: the existing
  parent checks. **A days-only change runs no parent check** (F-J; design
  decision where CM-GRP-2 is silent). The `.set` keys are exactly the changed
  fields (a subset of `docenteId`, `dias`); `campos` is the same subset in list
  order. Result unions are unchanged: **`unchanged` detection includes the
  days**, and no new result kind is needed.
- **`setGrupoActivo`.** Untouched: it neither reads nor writes the days
  (A-DIAS-REACT). Pin: its `.set` names only `activo`.
- **"At least one day" lives in one place, the manual schema.** The data layer
  accepts an empty array (the data shape allows the empty set, and the import
  creates groups without days). Action tests with a hand-built `FormData` pin
  the refusal.
- **Manual schema** (`validations/catalog.ts`, applied in Phase 5, modified
  here). Wire format: seven checkboxes sharing `name="dias"`, each with a
  `DiaSemana` code as `value`; the action passes `formData.getAll("dias")`.
  `diasSchema` accepts only an array: an empty array is `dias.required`; a
  non-string entry (a `File`), a string outside `DIAS_SEMANA`, or more than
  seven raw entries is `dias.invalid`; duplicates collapse; the output is
  `DiaSemana[]` in week order. `grupoCreateSchema` gains `dias`;
  `grupoUpdateSchema` becomes `{ docenteId, dias }`.
  `CATALOG_FIELD_ERROR_KEYS` gains `dias.required` and `dias.invalid` (17
  keys), and the copy lands in the same task because the parity test requires
  `catalog.shared.fieldErrors` to hold exactly that list.
- **Edit rule.** A Grupo edit changes the docente, the days, or both. Since the
  edit schema requires at least one day (A-DIAS-REQ), editing a pre-existing
  group with no days is refused with `dias.required` until a day is chosen,
  **even when the user only wants to change the docente**. That is the
  owner-confirmed rule, not a side effect.
- **Concurrency.** `updateGrupo` runs inside `withCatalogWrite`, and
  `runImportApply` takes the same advisory lock, so a days edit and an import
  cannot interleave; last writer wins, as for every other field.

### D-6. UI

**Control: native checkboxes in a `fieldset` with a `legend`.**

| Option | Verdict |
|---|---|
| **Seven native `<input type="checkbox" name="dias">` in a `fieldset`/`legend`** | **Chosen.** Tab reaches each box, Space toggles; assistive technology announces the group name once and each day with "checked"/"not checked"; the check mark is a shape, not a colour; it submits through plain `FormData` with no client state, so values survive an `invalid` answer under the hand-dispatched submit (R7) |
| Base UI `CheckboxGroup` | Rejected: a hidden-input and indicator layer for seven fixed options, plus another jsdom-stability risk like the combobox |
| Multi-select `Combobox` | Rejected: hides seven options behind a popup and a chip list; more keystrokes, worse overview |
| Toggle buttons (`aria-pressed`) | Rejected: needs hidden inputs and a pressed style that risks colour-only state |

- **Primitive (smallest token-only addition).** `src/components/ui/checkbox.tsx`:
  a native input, 20px, `accent-primary` (native `accent-color`), the standard
  focus ring of §7. No new colour, radius, type size or spacing step.
- **Group.** `src/components/checkbox-group.tsx` (client-free, generic):
  props `legend`, `name`, `options: { value; label }[]`, `defaultValues`,
  `hint?`, `error?`, `id`. It renders `<fieldset aria-describedby="hint
  error">`, the `legend` styled with the `Label` classes, then one
  `<label class="inline-flex min-h-11 items-center gap-2">` per option (44px
  target, the whole row clickable) in a wrapping row, then the hint
  (`text-muted-foreground text-xs`) and the error (`role="alert"`,
  `text-destructive-ink text-sm`), exactly the visual pattern of `FormField`.
  **`FormField` is not reused** (F-E). `aria-invalid` and `aria-required` are
  not set on the `fieldset` (not supported on the `group` role); the
  requirement is said in the hint text and the error is announced by its alert
  role.
- **Design-system entry** (`docs/design-system.md` §5, added by the unit that
  builds the component, not by this document): "Checkbox group. For a small
  fixed set of independent options. A `fieldset` whose `legend` is the field
  label; native checkboxes tinted `primary`, each inside a 44px-tall label;
  hint and error as in Form. No new token."
- **Form.** `GrupoForm` renders the group in create and edit mode, options in
  `DIAS_SEMANA` order with the **long** names, `defaultValues` from the record
  (empty for a pre-existing group: nothing selected and no error shown until
  submit, CM-GRP-6).
- **List column.** A "Days" column between the docente and the state. Non-empty:
  short names in week order joined by ", " in an `aria-hidden` span, plus an
  `sr-only` span with the long names (CM-GRP-7). Empty: the plain muted text
  "days not set", no role, no error colour.
- **i18n** (`es` and `en`, identical keys):

  | Namespace | Keys |
  |---|---|
  | `catalog.shared.dias.long` | `lunes` … `domingo` (es "Lunes" …, en "Monday" …) |
  | `catalog.shared.dias.short` | `lunes` … `domingo` (es "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"; en "Mon" … "Sun") |
  | `catalog.shared.dias` | `notSet` |
  | `catalog.shared.fieldErrors.dias` | `required`, `invalid` |
  | `catalog.grupos` (form and list keys, named as the Asignaturas ones) | days label, days hint ("select at least one"), days column header |
  | `catalog.import.reasons.dias` | `invalid` (names the token through `{value}`, as the existing reasons do) |
  | `catalog.import.contract.rules` | `diasTokens`, `diasEffect` |

  The parity test gains: `ROW_REASONS` + `dias.invalid`; the two contract
  rules; a pinned list asserting `dias.long` and `dias.short` hold exactly
  `DIAS_SEMANA`.

### D-7. Work-unit plan for `sdd-tasks`

New phases are numbered after the existing ones so no task id moves.

| Unit | Phase | Goal | Files | Depends on | Authored lines (honest) | Seam |
|---|---|---|---|---|---|---|
| WU-D1 | **16 (new)** | Day-set module, audit list, schema column, `0006`, gates DG1-DG10, data-model doc | `src/lib/catalog/dias.ts` (+test); `src/lib/audit/types.ts`, `types.test.ts`, `events.test.ts`; `src/db/schema.ts`, `schema.test.ts`; `drizzle/0006_*`, `drizzle/meta/*`; `src/db/migration-0006.test.ts`; `modelo_datos_sql.md` | Phase 1 closed | 300-450 | 16A pure (`dias.ts`, audit list) / 16B `schema.ts`, generation, review, gates |
| WU-D3 | **18 (new)** | `Checkbox` primitive, `CheckboxGroup`, day-name copy, design-system entry | `src/components/ui/checkbox.tsx` (+test), `src/components/checkbox-group.tsx` (+test), `i18n/{es,en}.json`, `catalog-parity.test.ts`, `docs/design-system.md` | 16A only | 350-550 | components / copy |
| WU-D2 | **17 (new)** | Import `Dias` column end to end | `src/lib/import/{sheets,parse,schemas,types,plan,apply}.ts` and their tests, new `src/lib/import/dias.ts` (+test), `__fixtures__/plan-fixtures.ts`, `template.test.ts`, `src/lib/data/catalog.ts` (+test), `catalog/import/workbook-contract.tsx` (+test), `catalog/import/actions.test.ts`, `i18n/{es,en}.json`, `catalog-parity.test.ts` | **DG9**, 16A | 600-900 | 17A parse, token parser, schema, snapshot type and projection, planner / 17B apply, contract card, copy |
| WU3a | 10 (existing, absorbs) | Grupos data layer with days | as planned | 16A; DG9 before any runtime use | +120-200, new range 950-1,500 | reads / writes (unchanged) |
| WU3b-2 | 12 (existing, absorbs) | Manual schema with days, Grupo actions | as planned + `validations/catalog.ts` (+test), `i18n` field errors | Phase 10 | +150-250, new range 750-1,150 | schema and create / update and toggle |
| WU3b-3 | 13 (existing, absorbs) | Form with the group, list column, pages | as planned | Phases 12 and 18 | +200-300, new range 1,200-1,800 | form / pages and copy (unchanged) |
| WU3b-1 | 11 | **Unaffected.** The combobox stays single-select; the days do not use it | — | — | — | — |
| WU5 | 14 | **Unaffected.** Docentes carry no days | — | — | — | — |
| Closing | 15 (existing, absorbs) | Extra smoke, housekeeping, records | — | all | bookkeeping | — |

Added authored lines: roughly **1,700-2,650** on top of the existing forecast.
Each new unit fits the 800-line budget except WU-D2 at its upper bound, which
has a named seam.

**Existing tasks that change** (ids as in `tasks.md`):

| Task | Change |
|---|---|
| Header, forecast, unit tables | Add the spec ids (CM-GRP-6, CM-GRP-7, AC-DIAS, AC-DIAS-ADD, CEI-DIAS-1..4), gates DG1-DG10, Phases 16-18, the new estimates and order |
| "Decisions still open" #5 | Record the owner's answer: docente and days |
| 10.2 / 10.3 | Projection and `GrupoListItem.dias` (decoded, week order); pin that the where clause and `q` never mention `"Dias"` |
| 10.6 / 10.7 | `createGrupo` input carries `dias`; the insert stores `encodeDias` (selection order irrelevant, duplicates collapse) |
| 10.8 / 10.9 | Rewrite: input `{ docenteId, dias }`; four cases (nothing, docente only, days only, both); days-only runs no parent check; `.set` keys equal the changed fields; `campos` is `["docenteId"]`, `["dias"]` or `["docenteId", "dias"]`; same set in another order is `unchanged` |
| 10.10 / 10.11 | Add: a group with mask `0` reactivates; `.set` still names only `activo` |
| 10.12 | Add to the structural pin: `setGrupoActivo` never mentions `dias` |
| 10.15 | Checkpoint also looks at the days-only path |
| 12.1 | Read `validations/catalog.ts` and its test as well |
| new 12.1a / 12.1b | RED/GREEN `diasSchema`, both Grupo schemas, the two error keys and their copy (modifies applied Phase 5 code and its pinned tests) |
| 12.2 / 12.3 | `formData.getAll("dias")`; no day -> `dias.required` under the field, nothing written; a foreign value or a non-string entry -> `dias.invalid`; a valid create passes the days in week order |
| 12.4 / 12.5 | Rewrite: input to `updateGrupo` is `{ docenteId, dias }`; a pre-existing group without days is refused with `dias.required`; days-only edit -> one `grupo.actualizado` with `campos: ["dias"]`; same set reordered -> `unchanged` |
| 12.6 / 12.7 | Add one case: reactivation of a group without days succeeds |
| 12.9 | Leak sweep gains day sentinels (a day code, a long name, a mask) |
| 12.10 / 12.11 | Covered by 12.1a/b for the field errors; nothing else |
| 13.2 / 13.3 | The form renders the group in both modes; edit prefilled; selections survive `invalid`; the error sits under the group with `role="alert"`; keyboard reach and toggle of every day; a pre-existing group shows nothing selected and no error |
| 13.4 / 13.5 | The list shows the days column (short visible, long for assistive technology, "days not set"), in both locales; no days filter or search field |
| 13.6 / 13.7 | The edit page passes the record's days to the form |
| 13.10 / 13.11 | Grupo form and list day keys |
| 13.13 | Smoke adds the checkbox group in a real browser, both themes |
| 15.2 | Sweep adds: no `.set` or values object with a literal `dias: 0` in `src/lib/import` |
| 15.5 | Re-read the `Dias` entry of `modelo_datos_sql.md` and the checkbox entry of the design system |
| 15.6 | See below |
| 15.7 | Housekeeping also covers `rehearsal-0006`, `rehearsal-catalog-ui`, `backup-before-0006` |
| 15.10 | Records DG1-DG10 evidence and the `0006` hash |

**Phase 15.6, additional coverage of the final rehearsal smoke** (on a branch
that has `0006`): create a Grupo with days chosen out of order and see week
order in the list; create without days refused; open a pre-existing group (no
days selected, no error) and see the refusal on submit; a days-only edit, then
a read-only `SELECT` of its audit row (`campos` is `["dias"]`, no day value); a
no-change resubmit; reactivate a group that has no days; import with a
non-empty `Dias` cell (replaces), with an empty cell (keeps), without the
column (keeps), with `Lunes, Funday` (one `dias.invalid` naming `Funday`, no
confirm control); re-import of the same file (`unchanged` only); no `grupo.*`
audit row from any import; download the template, check `Dias` in the Grupos
header and upload it unchanged (zero rows, zero errors); a read-only `SELECT
"Dias"` to compare stored masks with what the screens show.

**Recommended order from the current state:** finish Phase 11 → **16A** → 16B
code → gates DG1-DG9 (user-paced; Phase 18 and the code of Phase 10 may proceed
under doubles meanwhile) → **17** → 10 → 12 → 13 → 14 → 15. Phase 14 is
independent and may move earlier. Phases 17, 18, 12 and 13 all edit
`i18n/*.json` and `catalog-parity.test.ts`, and Phases 10 and 12 edit
`catalog/types.ts` / `validations/catalog.ts`: they are applied one at a time,
never in parallel. Phase 17 goes before the Grupo phases only to close the
already-reviewed import surface first; unlike WU4 there is no correctness
reason, because an import that does not know the column never touches it.

### D-8. Risks and unknowns

| Risk | Likelihood | Handling |
|---|---|---|
| drizzle-kit emits something other than the two expected statements (for example re-emits `CK_Grupo_Origen`, or renders the CHECK differently) | Low: `0005` emitted the same two statement kinds verbatim | Hand review with a stop rule; `migration-0006.test.ts`; if the CHECK text is equivalent but different, the test is adjusted in the same batch and recorded |
| The ordering window: `schema.ts` declares the column while `production` and `rehearsal-catalog-ui` lack it | Certain, short | D-2 rules 1-5; the `schema.ts` edit is the last code task before the gates |
| drizzle renders a multi-row insert whose rows have different key sets incorrectly | Low | `apply.test.ts` pins the values handed to the double; the rendered SQL is only proven by the rehearsal smoke (15.6). Not verified here |
| Concurrent writers on the days | Covered | The existing advisory lock already serialises every `withCatalogWrite` and the import apply; no new protocol. Last writer wins |
| `23505` and aborted transactions | Unchanged | The days are not part of any unique key, so no new `23505` path exists. A `23514` on `CK_Grupo_Dias` is unreachable through `encodeDias`; if it ever fires it is an unexpected failure: the transaction is aborted, no further statement (including the audit insert) may run on it, it is **not** mapped to a typed result, and it follows the generic logged path |
| Tests that pin exact shapes | Certain | `types.test.ts` (array), `sheets.test.ts` (`grupos.optional` is `[]`), `template.test.ts` and `workbook-contract.test.tsx` (header literals), `validations/catalog.test.ts` (schema key sets, 15 keys), `catalog-parity.test.ts` (`ROW_REASONS`, field errors, contract rules), `plan.test.ts` / `apply.test.ts` / `import/actions.test.ts` (snapshot `GrupoRow` literals; `makeGrupoRow` absorbs most), `data/catalog.test.ts` (projection). `migration-0005.test.ts` does **not** change (F-I) |
| `accent-color` check-mark contrast is chosen by the browser, per theme | Low-Med | Checked in the browser smoke (13.13) in both themes; fallback is `appearance-none` with a drawn check using existing tokens, still no new token |
| `Telefono` keeps the old "absent equals empty" behaviour while `Dias` does not | Certain, deliberate | `ABSENCE_SIGNIFICANT` names the one exception; a parse test pins both columns |
| A coordinator cannot change only the docente of a legacy group without also choosing days | Certain, by A-DIAS-REQ | Stated in D-5; the hint says a day is required |
| The opaque mask is misread in ad-hoc SQL or by the future request feature (Sunday-first `getDay()`) | Med | Bit table in `modelo_datos_sql.md`; note in D-1; only `dias.ts` converts |
| Spec text still saying "an empty cell clears the days" | Was true while this was written | The owner's flipped rule wins; the delta read on 2026-10-07 already states "left untouched" |

**Applied code that contradicts the amendment and must be modified:**
`src/lib/import/parse.ts` (F-A), `src/lib/import/sheets.ts` and its pinned
test, `src/lib/import/schemas.ts`, `types.ts`, `plan.ts`, `apply.ts`,
`__fixtures__/plan-fixtures.ts`, `src/lib/data/catalog.ts`,
`catalog/import/workbook-contract.tsx`, `src/lib/audit/types.ts` and
`types.test.ts`, `src/lib/validations/catalog.ts` (the comment "Only the
docente may change" and both Grupo schemas) and its test, `src/db/schema.ts`,
`modelo_datos_sql.md`, `i18n/{es,en}.json`, `catalog-parity.test.ts`.
`docs/PlantillaCatalogo.xlsx` (the frozen sample) has no `Dias` column and
stays valid because the column is optional.

## C. Interfaces (authoritative for the amended entries)

```ts
// src/lib/catalog/dias.ts — PURE. The only place a day set is encoded/decoded.
export const DIAS_SEMANA = [
  "lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo",
] as const;                                   // week order; index = bit
export type DiaSemana = (typeof DIAS_SEMANA)[number];
export const DIAS_MASK_MAX = 127;             // (1 << DIAS_SEMANA.length) - 1
export function isDiaSemana(value: unknown): value is DiaSemana;
/** OR of `1 << index`; duplicates and order collapse by construction. */
export function encodeDias(dias: Iterable<DiaSemana>): number;
/** Week order. Throws RangeError unless an integer in 0..DIAS_MASK_MAX. */
export function decodeDias(mask: number): DiaSemana[];

// src/db/schema.ts — additions to `grupo`
dias: smallint("Dias").notNull().default(0),
check("CK_Grupo_Dias", sql`${t.dias} between 0 and 127`),

// src/lib/import/sheets.ts
// Grupos: optional: ["Dias"]
export const ABSENCE_SIGNIFICANT: Readonly<Record<string, readonly string[]>>;

// src/lib/import/dias.ts — PURE
export type DiasCell = { ok: true; mask: number } | { ok: false; token: string };
export function parseDiasCell(raw: string): DiasCell;      // mask 0 = no token

// src/lib/import/types.ts
export type GrupoRow = { ...; dias: number };              // snapshot: the mask
// GrupoWrite "create": dias?: number   present only when the cell names a day
// GrupoWrite "update": dias?: number   present only when non-empty AND different

// src/lib/audit/types.ts
export const AUDITABLE_GRUPO_FIELDS = ["asignaturaId", "periodo", "numeroGrupo",
  "docenteId", "activo", "origen", "dias"] as const;

// src/lib/catalog/types.ts
export type GrupoListItem = { ...; dias: readonly DiaSemana[] };   // week order

// src/lib/data/grupos.ts
createGrupo(tx, scope, input: { asignaturaId; periodo; numeroGrupo; docenteId;
  dias: readonly DiaSemana[] }): Promise<GrupoWriteResult>;
updateGrupo(tx, scope, id, input: { docenteId: number;
  dias: readonly DiaSemana[] }): Promise<GrupoWriteResult>;
// setGrupoActivo: unchanged.

// src/lib/validations/catalog.ts
export const diasSchema;           // unknown -> DiaSemana[] (week order, >= 1)
export const grupoCreateSchema;    // + dias
export const grupoUpdateSchema;    // { docenteId, dias }
// CATALOG_FIELD_ERROR_KEYS += "dias.required", "dias.invalid"

// src/components/ui/checkbox.tsx, src/components/checkbox-group.tsx
export function Checkbox(props: ComponentProps<"input">): JSX.Element;
export function CheckboxGroup(props: {
  id: string; legend: string; name: string;
  options: readonly { value: string; label: string }[];
  defaultValues?: readonly string[]; hint?: string; error?: string;
}): JSX.Element;
```

## D. File changes (amendment)

| File | Action | Description |
|---|---|---|
| `src/lib/catalog/dias.ts` (+test) | Create | D-1 source of truth and helpers |
| `src/db/schema.ts`, `schema.test.ts` | Modify | `grupo.dias`, `CK_Grupo_Dias` |
| `drizzle/0006_grupo_dias.sql`, `drizzle/meta/0006_snapshot.json`, `_journal.json` | Create/Modify | Generated; hand-reviewed |
| `src/db/migration-0006.test.ts` | Create | SQL and journal assertions |
| `modelo_datos_sql.md` | Modify | §3.1 `Grupo."Dias"`, `CK_Grupo_Dias`, the bit table, "empty means not recorded" |
| `src/lib/audit/types.ts`, `types.test.ts`, `events.test.ts` | Modify | D-4 |
| `src/lib/import/dias.ts` (+test) | Create | Token parser |
| `src/lib/import/{sheets,parse,schemas,types,plan,apply}.ts` + tests, `__fixtures__/plan-fixtures.ts`, `template.test.ts` | Modify | D-3 |
| `src/lib/data/catalog.ts` (+test) | Modify | Snapshot projects `grupo.dias` |
| `src/app/(dashboard)/catalog/import/workbook-contract.tsx` (+test), `actions.test.ts` | Modify | Two contract rules; fixture literals |
| `src/lib/validations/catalog.ts` (+test) | Modify | D-5 manual schema |
| `src/lib/catalog/types.ts` | Modify | `GrupoListItem.dias` (with Phase 10) |
| `src/lib/data/grupos.ts` (+test) | Create (Phase 10) | With days from the start |
| `src/app/(dashboard)/catalog/grupos/**` | Create (Phases 12, 13) | With days from the start |
| `src/components/ui/checkbox.tsx`, `src/components/checkbox-group.tsx` (+tests) | Create | D-6 |
| `docs/design-system.md` | Modify | §5 "Checkbox group" entry |
| `i18n/es.json`, `i18n/en.json`, `src/i18n/catalog-parity.test.ts` | Modify | D-6 key table |

No file is deleted. `template.ts`, `summary.ts`, `events.ts`,
`catalog-write.ts`, `catalog-scope-sql.ts`, `import-preview.tsx`,
`form-field.tsx` and `combobox.tsx` are **not** modified.

## E. Testing additions (strict TDD, each a failing test first)

| Layer | What |
|---|---|
| Unit, pure | `dias.ts`: order and tuple pin; encode/decode round trip over all 128 masks; duplicates and order collapse; `decodeDias` rejects `-1`, `128`, `1.5`; type test rejecting a foreign code |
| Unit, pure | `parseDiasCell`: both spec tables of CEI-DIAS-2 (accepted spellings, unrecognised tokens), decomposed accents, the first bad token returned as written |
| Unit, SQL text | `migration-0006.test.ts` (D-2); `schema.test.ts` column and CHECK bounds against `DIAS_MASK_MAX` |
| Unit, parse | Header absent: no `Dias` key; header present and blank: `Dias: ""`; `Telefono` unchanged in both cases; the template uploaded unchanged parses to zero rows and zero errors |
| Unit, planner | Every scenario of CEI-DIAS-3, with "column absent" and "empty cell" as separate cases; no write ever carries `dias: 0`; an invalid token blocks the plan with one error naming the token |
| Integration, `tx` double | `apply`: the insert values and the update `.set` name `dias` only for writes that carry it; no `grupo.*` event. `grupos.ts`: the four update cases, `.set` keys, `campos`, days-only without parent reads, `setGrupoActivo` blind to days |
| Integration, actions | `getAll("dias")` parsing; `dias.required`; a foreign value and a `File` entry refused; exactly one event with `campos: ["dias"]`; guard still runs before any `formData` read |
| Component | `Checkbox`, `CheckboxGroup` (legend as group name, `aria-describedby`, alert, keyboard toggle, 44px label rows by class), `GrupoForm` with the group, list cell rendering in `es` and `en` |
| i18n | Parity for the new keys; `dias.long` / `dias.short` equal `DIAS_SEMANA` |

**Proved only by the Neon rehearsal:** the default, the CHECK firing at both
bounds, an insert that omits the column (DG4, DG5), and the rendered SQL of a
mixed-key multi-row insert (smoke 15.6).

## F. Threat matrix (amendment)

Standard rows remain N/A (no shell, subprocess, VCS or PR automation). Added
boundaries:

| Boundary | Adversarial case | Design response | Planned RED tests |
|---|---|---|---|
| Hand-crafted `dias` | A value outside the seven, a `File`, hundreds of entries, no entry | `diasSchema` validates against `DIAS_SEMANA`, bounds the entry count, requires one; `CK_Grupo_Dias` is the backstop | Action and schema tests |
| Audit payload | A day name, mask or count in `datos` | Builders take field names only | Exact-equality test; leak sweep with day sentinels |
| Import clearing days | An empty cell, or a planner defect producing `0` | The planner never emits `dias` for an empty cell; the apply treats a falsy mask as absent | Planner and apply tests |
| Scope | A coordinator editing the days of a foreign group | Unchanged: the scoped statement and the A-6 pre-check cover every field of the record | Existing sentinel and foreign-id tests extended to the days path |

## G. Choices made where the spec is silent

1. Storage as a `smallint` bitmask, the column and constraint names, no index.
2. Bit order (Monday = bit 0) and the codes `lunes` … `domingo`.
3. `dias` appended last in `AUDITABLE_GRUPO_FIELDS`.
4. A days-only edit runs no Asignatura or docente check.
5. The "at least one day" rule is enforced in the manual schema only.
6. More than seven raw `dias` entries in a request is `dias.invalid`.
7. `dias.invalid` is checked right after the row schema and wins over a
   reference error on the same row; it names the first bad token only.
8. Absent versus empty travels as "key absent" versus `""`, for `Grupos.Dias`
   only.
9. Native checkboxes in a `fieldset`; a new `CheckboxGroup` beside `FormField`;
   no `aria-invalid` on the `fieldset`.
10. List cell: short names visible, long names for assistive technology,
    comma separated.
11. Two contract rule keys (`diasTokens`, `diasEffect`); no template note.
12. Migration name `0006_grupo_dias`; fresh branch `rehearsal-0006`;
    `rehearsal-catalog-ui` not reused for the rehearsal.
13. Phase 17 before the Grupo phases (ordering preference, not a dependency).

## H. Not done by this amendment

The justification-request form; validating `FechaInasistencia` against the
days; hours, classrooms or calendars; showing the days to students; a days
search or filter; English import tokens; a preview figure for days changes; an
index; any change to `Asignatura`, `Usuario`, `Inscripcion` or the audit table.
