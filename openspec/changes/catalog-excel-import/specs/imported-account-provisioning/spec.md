# Imported Account Provisioning Specification

## Purpose

The catalog import creates the docente and estudiante accounts it needs, so that
groups and enrollments can reference real users. Students are outside the
role-assignment hierarchy (`staff-account-creation`); the import provisions them
through its own path and does not widen that hierarchy. Each new account gets a
generated temporary password that is returned to the importer once and never
stored in plaintext, and is flagged for a forced change (`forced-password-change`).
Accounts that already exist are matched and updated but never re-credentialed.
Import mechanics (dry-run, atomicity, guards) are in `catalog-excel-import`.

## Requirements

### Requirement: Identity resolution

A docente row MUST be matched to an account by normalized `Correo`. An estudiante
row MUST be matched by `Cif`. A matching account MUST be reused and updated; a
non-matching row MUST create a new account. Email comparison MUST be
case-insensitive and ignore surrounding whitespace. `Correo` MUST be unique
across all users.

#### Scenario: Docente matched by email regardless of case

- GIVEN an existing docente with `Correo` "ana.perez@uni.edu"
- WHEN a workbook lists " Ana.Perez@UNI.edu "
- THEN no second account is created and the existing one is used

#### Scenario: Estudiante matched by Cif

- GIVEN an existing estudiante with `Cif` "2023-0456" (for example after
  self-registration)
- WHEN the workbook lists the same `Cif`
- THEN that account is updated and reused, and no duplicate is created

#### Scenario: Two rows normalize to the same email

- GIVEN two Docentes rows whose emails differ only by case
- WHEN the workbook is planned
- THEN the duplicate is reported as a row error

#### Scenario: Email belongs to another account

- GIVEN a Docentes row whose email equals the `Correo` of an existing non-docente
  user
- WHEN it is planned
- THEN the row is an error and neither role nor account is changed

#### Scenario: Estudiante email already used by another user

- GIVEN an Estudiantes row whose email equals another user's `Correo`
- WHEN it is planned
- THEN the row is an error and no account is created

#### Scenario: Cif exists on a non-estudiante user

- GIVEN an Estudiantes row whose `Cif` belongs to a user who is not an estudiante
- WHEN it is planned
- THEN the row is an error

### Requirement: Login derivation

A new account's `Login` MUST be derived from its normalized full email, not from
its local part alone, so that `Correo` uniqueness guarantees `Login` uniqueness.
A new estudiante without an email MUST use its `Cif` as `Login`. A derived
`Login` that collides with an existing `Login` MUST be reported as a row error
and MUST NOT be silently altered or suffixed. The exact normalization is fixed at
design; it MUST be deterministic and MUST yield the same `Login` for the same
input on every import.

#### Scenario: Docente Login from email

- GIVEN a new docente with email "Ana.Perez@uni.edu"
- WHEN the account is created
- THEN its `Login` is derived from "ana.perez@uni.edu" and its `Correo` is the
  normalized email

#### Scenario: Two emails with the same local part

- GIVEN new docentes "ana@uni.edu" and "ana@otra.edu"
- WHEN both are created
- THEN their logins differ and both accounts exist

#### Scenario: Estudiante with email

- GIVEN a new estudiante with `Cif` "2023-0456" and a valid email
- WHEN the account is created
- THEN `Login` is derived from the email and `Correo` is the normalized email

#### Scenario: Estudiante without email falls back to Cif

- GIVEN a new estudiante with `Cif` "2023-0789" and no email
- WHEN the account is created
- THEN `Login` is "2023-0789" and `Correo` is null

#### Scenario: Login collision is an error

- GIVEN an existing user whose `Login` equals the one derived for a new row
- WHEN it is planned
- THEN the row is an error and nothing is written

### Requirement: Temporary password generation

Each account created by an apply MUST receive a freshly generated random
temporary password with enough entropy to be unguessable, unique per account.
Only its bcrypt hash, at 12 rounds, MUST be stored in `HashClave`. The stored
value MUST NOT be a plaintext password, and no fixed or pattern-based password
(such as the Cif or the email) MAY be used.

#### Scenario: Hash stored, not plaintext

- GIVEN a new account created by an apply
- WHEN `HashClave` is inspected
- THEN it is a bcrypt hash with cost 12 that verifies against the exported
  temporary password
- AND it does not equal the temporary password

#### Scenario: Passwords differ per account

- GIVEN an apply creating many accounts
- WHEN the temporary passwords are compared
- THEN no two are equal

#### Scenario: Not derivable from data

- GIVEN a new account
- WHEN its temporary password is compared with its `Cif`, email and `Login`
- THEN it equals none of them

### Requirement: Temporary password is shown once and never persisted or logged

After a successful apply, the temporary credentials (login and temporary
password per newly created account) MUST be delivered to the importer only in
that apply's response, as an exportable file. They MUST NOT be stored in
plaintext in the database, in any file on the server, in the session, or in any
log, and MUST NOT be re-displayed by any later request. The credentials MUST NOT
be delivered when the apply fails or rolls back. The preview MUST NOT generate
or return any password.

#### Scenario: Export accompanies the successful apply

- GIVEN an apply that created 3 accounts
- WHEN it succeeds
- THEN the importer receives one export with 3 login and temporary-password
  pairs

#### Scenario: Not retrievable afterwards

- GIVEN a completed apply
- WHEN the importer reloads the page or requests the result again
- THEN no password is available anywhere in the application

#### Scenario: Logs are clean

- GIVEN an apply that created accounts
- WHEN the structured server log and any error output are inspected
- THEN they contain no temporary password and no password hash

#### Scenario: No credentials on failure

- GIVEN an apply that rolls back
- WHEN the outcome is returned
- THEN no credentials are present and no account exists

#### Scenario: Preview returns no credentials

- GIVEN a workbook containing new accounts
- WHEN it is only previewed
- THEN the report shows the count of accounts that would be created and no
  password

### Requirement: New accounts are flagged for password change

Every account created by an apply MUST have `DebeCambiarClave` true, an active
state, and the correct role (`docente` or `estudiante`). The mechanism that
enforces the change is specified in `forced-password-change`.

#### Scenario: Created accounts

- GIVEN a workbook with new docentes and estudiantes
- WHEN it is applied
- THEN each created docente has role `docente`, each created estudiante has role
  `estudiante`, all are active and all have `DebeCambiarClave` true

### Requirement: Existing accounts keep their credentials

An account matched by `Correo` or `Cif` MUST be updated only in its
non-credential attributes (for example name). Its `HashClave` MUST NOT change,
`DebeCambiarClave` MUST NOT be set true by the import, no temporary password MUST
be generated for it, and its role MUST NOT change.

#### Scenario: Re-import does not reset a password

- GIVEN a docente created by a previous import who has since set their own
  password
- WHEN the same workbook is imported again
- THEN their `HashClave` is unchanged and `DebeCambiarClave` is false
- AND the export contains no entry for them

#### Scenario: Existing self-registered student

- GIVEN a student who self-registered with a `Cif`
- WHEN a workbook including that `Cif` is applied
- THEN the account is updated without a credential change, no flag is set and it
  is absent from the export

#### Scenario: Changed name on an existing account

- GIVEN an existing docente whose name differs in the workbook
- WHEN applied
- THEN the name is updated and counted as `update`, and the password is
  unchanged

### Requirement: Provisioning is part of the all-or-nothing apply

Account creation MUST occur inside the same transaction as the catalog writes. If
the apply rolls back, no account created in it MAY remain.

#### Scenario: Rollback removes created accounts

- GIVEN a workbook creating new accounts and a later failing row
- WHEN the apply runs
- THEN no new account exists afterwards

### Requirement: Account writes are audited without credentials

Each account created by an apply, and each existing account updated by an apply,
MUST produce one audit record (per `audit-log`) with the actor, the action
(create or update), entity type user and the account id, in the same transaction
as the account write. An account counted `unchanged` MUST NOT produce a record.
No audit record MAY contain a temporary password, a password hash or any other
credential. The payload MUST identify the account by its id and `Cif` or
normalized `Correo` only as needed, and for updates MUST name the changed fields
without any credential field.

#### Scenario: Created accounts are audited

- GIVEN an apply that created 3 accounts
- WHEN it succeeds
- THEN 3 account audit records with action create exist, one per account id

#### Scenario: Updated account is audited

- GIVEN an existing docente whose name differs in the workbook
- WHEN applied
- THEN one audit record with action update exists for that account and names the
  changed field

#### Scenario: Unchanged account is not audited

- GIVEN an existing account identical to its workbook row
- WHEN applied
- THEN no account audit record exists for it

#### Scenario: Account audit records contain no credentials

- GIVEN an apply that created and updated accounts
- WHEN all account audit records are serialized and searched
- THEN none contains a temporary password, a `HashClave` value or a bcrypt hash

#### Scenario: Rollback removes account audit records

- GIVEN a workbook creating new accounts and a later failing row
- WHEN the apply rolls back
- THEN no account audit record exists for that apply

## Assumptions and open questions

- Assumption (user decision): account audit records are in scope of F2 (RNF-02,
  write events only); read-access auditing is deferred.
- Assumption (from proposal): temporary credentials are exported as a file to
  the importer, not emailed (default 12); existing accounts keep their password
  and are not flagged (default 8); estudiante upsert key is `Cif`, with `Login`
  from email when present and `Cif` otherwise (default 7).
- Assumption: a workbook email or `Cif` matching an account of the wrong role is
  a row error; the import never changes an existing account's role.
- Assumption: an existing account matched by the import that is inactive is
  updated but not reactivated by this change. Confirm at design.
- Assumption: the export file format, the password length and alphabet, and the
  `Login` normalization are design decisions; the requirements above constrain
  only the observable properties.
- Assumption: no `Correo` is required for an estudiante; a missing email is
  allowed only for estudiantes.
