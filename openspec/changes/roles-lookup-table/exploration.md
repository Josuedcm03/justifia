# Exploration: roles-lookup-table

> **Correction (added after design).** This exploration says `docente` is in
> `rolesQueGestionanUsuarios` and that a `docente` can create an `administrador`.
> That was true when it was written; the working-tree constant is now
> `["secretaria", "administrador"]` (an untracked, hand-edited file). The
> escalation is real but narrower: a `secretaria` can create an `administrador`.
> `npm test` is also red before this change (`permissions.test.ts:25`). Where the
> proposal, specs or design disagree with this text, they win.

**Change**: `roles-lookup-table`
**Phase**: sdd-explore
**Store**: hybrid (this file + engram topic `sdd/roles-lookup-table/explore`)

> This change touches the database schema. It adds one table, one FK constraint
> on `"Usuario"` and one drizzle migration with its snapshot. Nothing may be
> applied to Neon without the user's explicit per-command approval.

## Request

Make `Usuario.Rol` a foreign key. Create a dedicated table for roles and leave a
seed containing the roles that exist so far.

## Current State

- **Column definition.** `src/db/schema.ts:52` defines
  `rol: varchar("Rol", { length: 20 }).notNull()`. It is a plain VARCHAR: not a
  `pgEnum`, no CHECK, no FK. The comment says the enumeration is deferred
  (`modelo_datos_sql.md` §2).
- **Schema conventions.** Tables are singular PascalCase (`"Usuario"`,
  `"Carrera"`, `"Facultad"`). Primary keys are `bigint generatedAlwaysAsIdentity`.
  FK columns are named `XId`. Both existing lookup tables use surrogate ids.
- **Migrations.** `drizzle/0000_init.sql` creates `Usuario` with
  `"Rol" varchar(20) NOT NULL`. `drizzle/0001_talented_fixer.sql` adds Facultad,
  Carrera and their FKs. The journal has entries 0 and 1 with snapshots for
  both. Whether either is applied on the shared Neon instance is **unverified**.
- **Drizzle config.** `drizzle.config.ts` reads only `DATABASE_URL`, with no
  unpooled URL.
- **Role list today.** The only source is the TS constant `rolesUsuario` in
  `src/lib/validations/auth.ts:7`: `estudiante`, `docente`, `coordinacion`,
  `secretaria`, `administrador`. `RolUsuario` and `rolUsuarioSchema` derive from it.
- **Session.** The JWT payload is `{ sub, login, rol, nombre }`.
  `isSessionPayload` validates `rol` against `rolesUsuario` in code.
  `middleware.ts` calls `verifySession` on every request, so session validation
  must stay DB-free. `requireRole` in `dal.ts` compares the JWT role; roles are
  never re-read from the DB.
- **Actions.**
  - Login casts `user.rol as RolUsuario` (`login/actions.ts:47`).
  - Register hardcodes `"estudiante"` twice (`register/actions.ts:51,66`).
  - `createStaffAction` uses `crearStaffSchema` (`rol: rolStaffSchema`, i.e.
    `rolesUsuario` minus `estudiante`), hardcodes `"coordinacion"` to require a
    career, then calls `createUsuario`.
- **Permissions.** `permissions.ts` holds `rolesQueGestionanUsuarios` and
  `canManageUsers`. It is code-based on purpose so the client sidebar can share it.
- **UI reads of the role.** `users/page.tsx`, `dashboard-header.tsx` and
  `profile/page.tsx` print the raw code. The sidebar takes `RolUsuario`.
  `new-user-form.tsx` builds its select from `rolesStaff` and toggles the career
  field on `"coordinacion"`.
- **i18n.** `users.new.roles` has 4 keys in both `es.json` and `en.json`. There
  is no `estudiante` label.
- **Seeds.** `seed.ts` inserts 3 users with `onConflictDoNothing()`. It imports
  `@/db`, which imports `@/env` and needs `DATABASE_URL`, so its `main()` is not
  unit-testable. `seed-carreras.ts` is idempotent. `package.json` has `db:seed`
  and `db:seed:carreras`.
- **Tests.** Four exist: `permissions.test.ts`, `session.test.ts`,
  `auth.test.ts` (`rolUsuarioSchema`) and `theme-toggle.test.tsx`. None touches
  the DB and `validations/users.ts` has no tests.
- **Docs describing the old state.** `modelo_datos_sql.md` (§2, the DDL at line
  101, and a note at line 262 about a possible future `UsuarioRol`) and the
  `schema.ts` doc comment.

## Affected Areas

Will change:

- `src/db/schema.ts`: new `rol` table, and `usuario.rol` gets
  `.references(() => rol.codigo)`.
- `drizzle/0002_*.sql`, `drizzle/meta/0002_snapshot.json` and `_journal.json`:
  generated, then hand-edited to insert the roles between CREATE TABLE and
  ADD CONSTRAINT.
- `src/db/seed.ts`, or a new `seed-roles.ts` plus a `package.json` script. Roles
  must be seeded before users.
- A new pure seed-data module derived from `rolesUsuario`, plus new tests.
- `modelo_datos_sql.md` §2 and the DDL.

Likely unchanged under the recommended option: `validations/auth.ts` and
`users.ts`, `session.ts`, `dal.ts`, `permissions.ts` and its test, the login,
register and users/new actions, `new-user-form.tsx`, the users, profile and
header UI, the sidebar, `middleware.ts`, `data/users.ts` and i18n.

Hardcoded role strings today: `permissions.ts` (the list),
`validations/users.ts` (`"estudiante"` filter), `register/actions.ts` (twice),
`users/new/actions.ts` (`"coordinacion"`), `new-user-form.tsx`
(`"coordinacion"`), `seed.ts` (three times), three test files, the
`users.new.roles.*` i18n keys, and `modelo_datos_sql.md`.

## Approaches

### A. Natural key (recommended)

`"Rol"(Codigo varchar(20) PK, Nombre)`. `Usuario.Rol` keeps its name, type and
data, and becomes an FK to `Rol.Codigo`.

- **Pros**: no backfill; session payload, TS types, Zod, `permissions.ts` and all
  queries and UI are untouched; `Usuario` stays readable without a join;
  reversal is lossless (drop the constraint, drop the table); smallest blast radius.
- **Cons**: departs from the surrogate-id convention used by Facultad and
  Carrera; renaming a code needs `ON UPDATE CASCADE` (codes are effectively
  immutable anyway, since `permissions.ts` keys on them).
- **Effort**: Low.

### B. Surrogate id

`Rol(Id, Codigo unique)`, `Usuario.RolId` FK, and drop `Usuario.Rol`.

- **Pros**: consistent with Facultad and Carrera; a code can be renamed freely.
- **Cons**: the migration is a hand-written sequence (create, seed, nullable
  column, UPDATE backfill, NOT NULL, FK, DROP) because drizzle-kit will not emit
  it correctly for a populated table; it ends in a destructive column drop, so
  rollback would need a Neon restore; `Usuario` loses `rol`, so login, list and
  profile all need joins; the JWT must still carry the code, so the id buys
  nothing at session level; `createStaffAction` must resolve code to id.
- **Effort**: Medium-High.

### C. `pgEnum`

Rejected: the user asked for a table, and enums are rigid to change and not
queryable as a catalog.

### Source of truth after the change

Keep the TS constant authoritative. The DB table mirrors it. The seed is
generated from `rolesUsuario`, so there is one code-level list. The migration SQL
is a frozen snapshot, which is normal. Making the DB authoritative would widen
types to `string` and need DB reads that middleware cannot make, so it is
rejected for now. Optionally, `$type<RolUsuario>()` on the column removes the
`as RolUsuario` cast, at the cost of a `db` to `validations` import.

### `permissions.ts`

Keep it code-based. Moving it to the DB needs a role-permission table and a
per-request read, which is out of scope.

## Migration of existing rows (Approach A)

One migration file, three steps:

1. `CREATE TABLE "Rol"` (generated).
2. Hand-added `INSERT INTO "Rol" ... VALUES (5 roles) ON CONFLICT DO NOTHING`.
   This must live in the migration itself, not only in a seed: the FK is
   validated against existing rows when it is added, and a seed runs after
   migrations.
3. `ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_Rol_Rol_Codigo_fk" FOREIGN KEY
   ("Rol") REFERENCES "Rol"("Codigo") ON UPDATE cascade` (generated).

No backfill and no column drop. If any existing `Rol` value is outside the 5
codes, the ALTER fails. The pg migrator should run pending migrations in one
transaction and roll back cleanly, but this needs confirming at design time.

- **Pre-apply check.** Before any migrate, run the read-only
  `SELECT "Rol", count(*) FROM "Usuario" GROUP BY 1;`.
- **Revert.** drizzle-kit has no down migrations. Manual revert:
  `ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_Rol_Rol_Codigo_fk"; DROP TABLE "Rol";`.
- **Rehearsal and connection.** The neon-postgres skill says to rehearse on a Neon
  branch and to migrate over the direct (non-pooled) URL. `drizzle.config.ts`
  reads only `DATABASE_URL`, so confirm it is not the `-pooler` URL.
- **Generate.** `drizzle-kit generate --name roles_lookup_table` only writes local
  files, but it is still a command the user should confirm.

**Seed.** Must be idempotent (`onConflictDoNothing`, or `onConflictDoUpdate` on
`Nombre`) and must run before the users seed. Recommend a standalone
`seed-roles.ts` with a `db:seed:roles` script, called first from `seed.ts`;
design makes the final call. The migration covers existing databases and the seed
covers fresh ones.

**Test seams for strict TDD (none needs a DB):**

1. Seed codes equal `rolesUsuario`.
2. `getTableConfig(usuario)` exposes an FK on `Rol` referencing `rol.codigo`.
3. The migration SQL text inserts every code before the `ADD CONSTRAINT` statement.

## Recommendation

Approach A. `Rol.Codigo` is the natural-key PK, `Usuario.Rol` becomes an FK to it,
and the TS constant stays the source of truth. The migration inserts the roles and
an idempotent seed derived from the same constant covers fresh databases.
Sessions, existing JWTs, Zod and `permissions.ts` stay untouched.

Estimated size (well under the 800-line review budget): schema ~15 lines,
migration ~15 hand-written plus the generated snapshot, seed ~30, tests ~70,
docs ~10.

## Risks

- **Sessions.** No impact under A: the JWT carries the same code. Role changes
  and deactivation only take effect at JWT expiry (8 h), which is existing behaviour.
- **FK creation.** Fails if Neon holds any role value outside the 5 codes.
  Unverified; run the read-only check first.
- **Missing INSERT.** drizzle-kit will not generate the seed INSERT. If it is
  forgotten, the migration fails on any database that already has users.
  Reviewers must read the hand-edited SQL.
- **Shared Neon.** Any apply needs per-command confirmation, a branch rehearsal,
  and the unpooled URL.
- **Constant/table drift.** A new role needs both a constant edit and a data
  migration or seed run. Seed-from-constant and the tests mitigate this but do
  not remove it.
- **Misleading error.** `createStaffAction` catches every DB error and reports
  "duplicate". Zod blocks invalid roles upstream, so impact is low.
- **Naming.** The convention is `"Rol"` (singular PascalCase), while the user said
  "roles table". A table `Rol` next to a column `Rol` is legal but slightly confusing.

### Adjacent findings (out of scope, not a dependency)

- **Privilege escalation.** `createStaffAction` accepts any caller in
  `rolesQueGestionanUsuarios` (which includes `docente`), and `rolStaffSchema`
  allows `administrador`. A docente can therefore create an administrator. The
  action never compares the caller's role with the role being assigned.
- **Raw role codes in the UI.** The users list, header and profile show the code
  instead of an i18n label, and `estudiante` has no `roles` key.
- **Widened type.** `rolStaffSchema` widens to `string` via
  `rolesStaff as [string, ...string[]]`.

## Open product questions

1. **Table name and key.** `"Rol"` (matches convention) or `"Roles"`; natural key
   `Codigo` (recommended) or surrogate id. The surrogate id matches Facultad and
   Carrera but forces a destructive, join-heavy migration.
2. **Table columns.** Minimal `Codigo` plus `Nombre` (recommended), or also
   `Descripcion` and `Activo`?
3. **Runtime-editable roles.** Will admins manage roles or per-role permissions
   at runtime? If yes, revisit the TS-constant source of truth and code-based
   `permissions.ts` in a separate change. If no, keep this scope.

## Status

`next_recommended`: sdd-propose, after the open questions are answered.
