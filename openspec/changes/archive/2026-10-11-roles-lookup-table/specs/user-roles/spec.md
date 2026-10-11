# User Roles Specification

## Purpose

Make the role a referenced catalog entity instead of a free-text column, without
changing what the session carries or what role reads return. Roles stay fixed
(no runtime editing) and the TypeScript role list stays the source of truth.

## Requirements

### Requirement: Role catalog membership

The system MUST persist a role catalog where each role has an `Id`, a `Codigo`
(unique, at most 20 characters) and a non-null `Nombre`. The catalog MUST contain
exactly these codes: `estudiante`, `docente`, `coordinacion`, `secretaria`,
`administrador`.

#### Scenario: Catalog has the five codes

- GIVEN the migration has been applied
- WHEN the catalog is read
- THEN it contains exactly the 5 codes, each with a non-empty `Nombre`

#### Scenario: Duplicate code rejected

- GIVEN a role with code `docente` exists
- WHEN another role with code `docente` is inserted
- THEN the insert fails on the uniqueness constraint

#### Scenario: Catalog matches the code-level role list

- GIVEN the code-level role list (`rolesUsuario`)
- WHEN the seed data is compared with it
- THEN both contain the same set of codes

### Requirement: User-to-role reference

Every user MUST reference exactly one catalog role through a NOT NULL foreign
key (`Usuario.RolId`). The free-text `Usuario.Rol` column MUST NOT exist after
the change.

#### Scenario: User must have a role

- GIVEN the migrated schema
- WHEN a user is inserted without a role reference
- THEN the insert fails

#### Scenario: Unknown role reference rejected

- GIVEN the migrated schema
- WHEN a user is inserted with a `RolId` absent from the catalog
- THEN the insert fails on the foreign key

### Requirement: Migration guarantees

The migration MUST insert all 5 catalog roles before the backfill, MUST backfill
`RolId` for every existing user by matching the legacy role value to `Codigo`,
and MUST drop the legacy column only after the backfill, NOT NULL and the
foreign key are in place. It MUST abort, leaving data unchanged, if any existing
user has a legacy role value outside the 5 codes. No user MAY lose a role.

#### Scenario: Existing users keep their role

- GIVEN users exist with legacy roles across the 5 codes
- WHEN the migration runs
- THEN each user references the role whose code equals their legacy value
- AND the per-role user counts equal the pre-migration counts

#### Scenario: Roles inserted before the backfill

- GIVEN the migration SQL text
- WHEN statement order is inspected
- THEN the role insert precedes the backfill, and the column drop is last

#### Scenario: Out-of-catalog legacy value aborts

- GIVEN a user whose legacy role is `profesor`
- WHEN the migration runs
- THEN it fails and no schema or data change persists

### Requirement: Idempotent role seed

The role seed MUST insert every catalog role, MUST be safe to run repeatedly
(a second run changes nothing and does not fail), and MUST run before the users
seed.

#### Scenario: Fresh database seeded

- GIVEN a database with an empty catalog
- WHEN the seed runs
- THEN the 5 roles exist

#### Scenario: Second run is a no-op

- GIVEN the seed already ran
- WHEN it runs again
- THEN no error occurs and the catalog is unchanged

#### Scenario: Users seed follows roles seed

- GIVEN the combined seed flow
- WHEN it executes
- THEN roles are seeded before any user is inserted

### Requirement: Session carries the role code

The session token MUST keep carrying the role CODE (not the id). Session
verification MUST NOT depend on a database read.

#### Scenario: Token payload uses the code

- GIVEN a user with role `secretaria` logs in
- WHEN the session token is issued and decoded
- THEN its role claim is `secretaria`

#### Scenario: Verification stays DB-free

- GIVEN a valid session token
- WHEN the session is verified
- THEN no database access occurs

### Requirement: Role reads return the code

Login, the users list and the profile view MUST still expose each user's role as
its code, resolved from the catalog.

#### Scenario: Login resolves the code

- GIVEN a user referencing the `docente` role
- WHEN they log in
- THEN the resulting session role is `docente`

#### Scenario: List and profile show the code

- GIVEN a user referencing the `administrador` role
- WHEN the users list and that user's profile are rendered
- THEN both show `administrador`

## Open questions

- Should `Nombre` values be Spanish display names, and are they seeded by the
  migration and the seed identically? (Assumed yes; exact text is a design item.)
- Exact behavior when the migrator does not wrap the file in one transaction is
  unconfirmed; the "abort with no change" guarantee assumes it does.
