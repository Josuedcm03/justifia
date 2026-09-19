# Proposal: Roles Lookup Table, Role-Assignment Hierarchy, Permission-Denied Screen and Users List

> **This change TOUCHES THE DATABASE SCHEMA.** It adds a table, a FK, a backfill
> and a destructive column drop. No migration, push or seed may be run against
> Neon without the user's explicit per-command confirmation.

## Intent

`Usuario.Rol` is a bare `varchar(20)`: no FK, no CHECK, no enum. Role validity is
enforced only in TypeScript, so any write outside the app can store garbage, and
there is no catalog to join, list or label. Make the role a referenced entity.

Second goal, added by user decision after exploration: staff-account creation is
not restricted by the role being assigned. In the current working tree
`createStaffAction` accepts any caller in `rolesQueGestionanUsuarios`
(`secretaria`, `administrador`) and lets them assign any staff role, so a
`secretaria` can create an `administrador`. Replace that with a **role-assignment
hierarchy enforced by the server**.

Third goal, added by the user after design: the users module must be visible only
to roles that can create accounts, and a caller who reaches a page they may not
see must land on a clear **permission-denied screen** instead of being bounced to
the dashboard.

Fourth goal, added by the user after design: the users list is scoped by the
viewer's role (`administrador` and `coordinacion` see every user; `secretaria` sees
only users whose role is `docente`) and is shown in a **paginated data table with
a working search**. Also, a caller refused by check (b) is redirected to the
permission-denied screen exactly like check (a), and that screen offers a control
that sends the user to `/`.

## Scope

### In Scope

- New `Rol` table: `Id` (bigint identity PK), `Codigo` varchar(20) NOT NULL
  UNIQUE, `Nombre` NOT NULL.
- `Usuario.RolId` bigint NOT NULL FK to `Rol.Id`; `Usuario.Rol` dropped.
- One hand-written migration + snapshot.
- Idempotent role seed generated from the `rolesUsuario` constant, run before the
  users seed.
- Reads that need the role code (login, users list, profile) resolve it by join.
- **Role-assignment hierarchy**, decided by the user and enforced on the server:

  | Caller | May assign |
  |---|---|
  | `administrador` | `coordinacion` |
  | `coordinacion` | `secretaria` |
  | `secretaria` | `docente` |
  | `docente`, `estudiante` | nothing |

  Read literally: each role creates exactly the next one down. Confirmed by the
  user: no in-app path creates an `administrador`. The rule lives in one policy
  structure in `permissions.ts`.
- Two server-side checks in `createStaffAction`: (a) the caller must be a role that
  may assign anything, decided before any input is parsed; (b) the requested role
  must be in the caller's assignable set, decided after parsing and before any
  write. A request refused by either check is redirected to the permission-denied
  screen (user decision: there is no separate form error). The role selector offers only the caller's assignable roles.
- **The users module is reserved for the creator roles** (`administrador`,
  `coordinacion`, `secretaria`). The "Users" sidebar item, the users list and
  `/users/new` are visible only to them. `docente` and `estudiante` cannot see the
  item and cannot open the pages. This **adds `coordinacion`** to a module that
  today serves only `secretaria` and `administrador`.
- **Permission-denied screen**: one generic screen, entirely in warning red, used
  whenever an authenticated user reaches a page their role may not access. A guard
  **redirects** to it (replacing the current redirect to `/`). Unauthenticated
  callers still go to login. The screen has a control that takes the user to `/`
  (the dashboard). The red uses the design system's destructive tokens
  and must meet the contrast floor; if a token is missing, it is added to
  `docs/design-system.md` first.
- **Viewer-scoped users list** (user decision): `administrador` and `coordinacion`
  see all users; `secretaria` sees only users whose role is `docente`. The scope is
  applied on the server, inside the query, so a `secretaria` never receives other
  rows.
- **Data table** for the users list: server-side pagination and a working search,
  with the page and the search term kept in the URL. The search applies within the
  viewer's scope.
- Doc update in `modelo_datos_sql.md` (repo root); tests for seed/schema/migration
  SQL, the assignment rule, the sidebar visibility, the denied screen and the
  users list (scope, search, pagination).

### Out of Scope

- Runtime-editable roles or DB-stored permissions. Roles are fixed;
  `permissions.ts` stays code-based.
- Creating an `administrador` through the app (admins come from the seed).
- Scoping a created `secretaria` to the creating coordinator's career.
- Role labels in i18n beyond the messages this change adds.
- Restyling other screens.
- Sorting, per-column filters and export of the users list (not requested).

## Capabilities

### New Capabilities

- `user-roles`: the role catalog, its fixed membership, and the referential
  relationship between a user and a role.
- `staff-account-creation`: who may create staff accounts, which role each caller
  may assign, and who may see the users module, enforced by the server and not
  only hidden in the UI.
- `permission-denied-screen`: the generic screen and the redirect that reaches it.
- `users-listing`: who sees which users, and the paginated, searchable data table
  that shows them.

### Modified Capabilities

- None (`openspec/specs/` is currently empty).

## Approach

**Roles table.** Exploration Approach B, **surrogate id**, chosen by the user for
consistency with `Facultad`/`Carrera`. Tradeoff accepted: the natural key would
have needed no backfill and no drop; the id costs a join on every role read and a
destructive migration, and buys nothing at session level because the JWT keeps
carrying the CODE (so `middleware.ts` stays DB-free). `rolesUsuario` remains the
type source of truth; the table mirrors it.

Migration order, single file, strictly:

1. `CREATE TABLE "Rol"`.
2. `INSERT` the 5 roles (must be in the migration; a seed runs after it).
3. `ADD COLUMN "RolId" bigint` nullable.
4. Backfill `UPDATE` joining `Usuario."Rol" = Rol."Codigo"`.
5. `SET NOT NULL`.
6. `ADD CONSTRAINT` FK.
7. `DROP COLUMN "Rol"`, last.

**Assignment rule.** One structure in `permissions.ts` maps each caller role to the
roles it may assign; predicates derive from it (which callers may create at all,
whether a given pair is allowed, which roles to offer). The users module is
reserved for the same set, so module visibility and creation rights cannot
disagree. The server is the authority.

**Permission denied.** The screen lives at `/denied`, a top-level route outside both route groups so it can be full-bleed and cannot loop. The role guard (`requireRole`) redirects authenticated
callers to the denied screen instead of `/`. Because that guard is shared, the
change applies to every guarded page, which is what makes the screen "generic".
The rule work has no dependency on the schema change, so it lands as its own work
unit and can be validated independently of the migration.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/db/schema.ts` | Modified | `rol` table; `usuario.rolId` replaces `usuario.rol` |
| `drizzle/0002_*.sql`, `meta/` | New | Hand-edited 7-step migration + snapshot + journal |
| `src/db/seed-roles.ts`, `seed.ts`, `package.json` | New/Modified | Idempotent seed from the constant, run first |
| `src/lib/data/users.ts` | Modified | Joins to expose the role code |
| `(auth)/login/actions.ts`, `users/page.tsx`, `profile/page.tsx` | Modified | Consume the joined code |
| `users/new/actions.ts`, `register/actions.ts` | Modified | Resolve code to id on insert |
| `src/lib/auth/permissions.ts` + `permissions.test.ts` | Modified | Assignment policy, predicates, tests |
| `src/lib/auth/dal.ts` | Modified | `requireRole` redirects authenticated callers to the denied screen |
| `src/app/denied/page.tsx` + a route constant | New | Generic full-screen red permission-denied screen at `/denied`, outside both route groups |
| `users/new/actions.ts`, `users/new/page.tsx`, `users/page.tsx` | Modified | Two-layer check, page guard, button |
| `users/new/new-user-form.tsx` | Modified | Role selector limited to the caller's assignable roles |
| `src/components/app-sidebar.tsx` | Modified | "Users" item only for the creator roles |
| `i18n/es.json`, `i18n/en.json` | Modified | Role-not-allowed error and the denied-screen copy |
| `docs/design-system.md`, `src/app/globals.css` | Modified | New `--denied` / `--denied-foreground` token pair (the shipped `--destructive` fails the contrast floor on a full-bleed surface: white is 4.85:1 in light but 2.89:1 in dark) and a scoped white-focus-ring exception in section 7 |
| `src/lib/data/users.ts` (list query) | Modified | Takes the viewer role, a search term and a page; applies the viewer scope, the search and the pagination in SQL and returns the total |
| `users/page.tsx` + a new data-table component | Modified/New | Reads `page` and `q` from the URL, calls the scoped query, renders the table, the search box and the pagination |
| `package.json` | Maybe | Only if the design adopts `@tanstack/react-table`; it may prove unnecessary |
| `modelo_datos_sql.md` (repo root) | Modified | §2 and the DDL |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backfill leaves NULLs (role value outside the 5 codes) | Med | Read-only pre-check `SELECT "Rol", count(*) FROM "Usuario" GROUP BY 1` before applying |
| `DROP COLUMN` is irreversible | High impact | See rollback; drop is the last statement |
| Forgotten step-2 INSERT breaks existing DBs | Med | Test asserting the SQL inserts every code before the backfill |
| Migration run over the pooled URL | Med | Confirm `DATABASE_URL` has no `-pooler`; use the direct URL |
| Constant/table drift when a role is added | Med | Seed derived from `rolesUsuario` + test asserting equality |
| Wider blast radius than the natural key | Accepted | User decision; join sites listed above |
| Behaviour change: `administrador` can create only `coordinacion`; `secretaria` only `docente`; `coordinacion` gains creation and users-module access | Med | Intended, user decision. Accounts already created are untouched |
| No in-app path to create an `administrador`, or for an administrator to create a `secretaria`/`docente` directly | Med | Accepted, confirmed by the user; admins come from the seed |
| Changing `requireRole` alters the denial for EVERY guarded page, not only users | Med | Intended ("generic"); design lists every caller and each gets a test |
| A full-screen red page can fail the contrast floor or read as an error rather than a denial | Med | Use design-system destructive tokens, compute contrast, keep one clear message and a way back |
| A redirect loop if the denied screen itself is guarded by a role | Low | The screen requires only a session, never a role; covered by a test |
| A security fix and a destructive migration in one review | Med | Two independent work units, rule first, so each can be validated on its own |
| `npm test` is already red in the working tree (`permissions.test.ts` expects every non-student role in the users-module policy) | High | The rule work unit reconciles that assertion so a new RED is distinguishable |
| The viewer scope is enforced only in the client or the UI | High impact | Applied in the SQL query; a test proves a `secretaria` never receives non-`docente` rows |
| Search input reaching SQL, and `%`/`_` acting as wildcards | Med | Parameterised query with escaped wildcards; tested with hostile input |
| Unstable pagination (no total order) or an off-by-one at the last page | Med | Deterministic order with a tie-break on `Id`; boundary tests for page 1, the last page and an out-of-range page |
| The list query is also touched by the roles migration (role code by join) | Med | The design orders the units so the two never conflict; the scope is expressed on the role code |
| A new dependency for the table | Low | Adopt only if it earns its weight; otherwise a small server-driven component |

## Rollback Plan

drizzle-kit has **no down migrations**, and step 7 destroys `Usuario.Rol`. This
is not trivially reversible.

1. **Before applying**: rehearse the full migration on a Neon branch cloned from
   the target, with production-like data. Do not apply to the shared instance
   until the rehearsal is clean.
2. **Code-only rollback** (nothing applied): `git revert`; delete the migration
   files and the journal entry. Zero data risk. The access-control work reverts
   the same way and touches no data.
3. **Failure during the migration**: the migrator wraps every pending migration
   in one database transaction (confirmed in the drizzle source during design),
   so a mid-file failure rolls back completely.
4. **After a committed apply**: forward-fix only. Re-adding `Usuario.Rol` needs a
   new migration that recreates the column and backfills from
   `Rol.Codigo` via `RolId`. Data is recoverable this way because `Codigo` was
   never dropped.
5. **Last resort**: Neon instant restore / branch-from-timestamp taken
   immediately before the apply. Note the restore point explicitly.

## Dependencies

- Explicit user confirmation for each of: `drizzle-kit generate`,
  `drizzle-kit migrate`, and any seed run.
- Whether migrations `0000`/`0001` are already applied on Neon is **unverified**;
  confirm with a read-only check first. Because all pending migrations share one
  transaction, an unapplied backlog would run together with `0002`.
- Do not install the `pg` package: `drizzle-kit` probes `pg` before `postgres` and
  would silently switch to a driver whose transactional behaviour was not verified.

## Size vs Review Budget

The design estimated ≈ 790 authored lines BEFORE the users list, the check (b) change and the data table were added. Those additions push the total well past the 800-line budget, so the work MUST be delivered as independent, chained work units, each reviewed on its own; the roles-table migration never shares a review with the others. The design phase re-estimates each unit. (Earlier revisions estimated ~530, then ~790.)

## Success Criteria

- [ ] `Rol` exists with the 5 codes; `Codigo` is UNIQUE.
- [ ] `Usuario.RolId` is NOT NULL and FK-constrained; `Usuario.Rol` is gone.
- [ ] No user row lost its role through the backfill (count per role matches the
      pre-check).
- [ ] The seed is idempotent (a second run is a no-op) and runs before the users
      seed.
- [ ] Login, users listing and profile still show the role; JWTs keep carrying
      the code and `middleware.ts` makes no DB call.
- [ ] The server accepts a staff-account creation only for the allowed
      (caller, requested role) pairs in the table above and rejects every other
      pair, including a hand-crafted request; each rejected caller role and each
      disallowed pair for the creator roles has a test.
- [ ] The role selector offers only the caller's assignable roles.
- [ ] The "Users" sidebar item, the users list and `/users/new` are visible only to
      `administrador`, `coordinacion` and `secretaria`; `docente` and `estudiante`
      see no item and are sent to the denied screen if they open the URL.
- [ ] The denied screen is generic, entirely red, meets the contrast floor, offers
      a way back, works in es and en, and an authenticated caller who is refused a
      guarded page is redirected to it; unauthenticated callers still go to login.
- [ ] A request refused by check (b) is redirected to the permission-denied screen
      (no form error), and the screen offers a control that goes to `/`.
- [ ] `administrador` and `coordinacion` see every user; `secretaria` sees only
      `docente` users, enforced by the query; `docente` and `estudiante` cannot open
      the list.
- [ ] The users list is a data table with server-side pagination and a working
      search that respects the viewer scope; the page and the search survive a
      reload through the URL; empty results and an out-of-range page are handled.
- [ ] `npm test`, `npm run typecheck` and `npm run build` pass.
- [ ] The migration was rehearsed on a Neon branch before any apply.
