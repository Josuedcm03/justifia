# Delta for Staff Account Creation

Change `docente-maintenance`. Requirements covered: RF-12 (a) ("crea"), RNF-06
(a), RNF-01. Decision D5 (owner, 2026-11-25): creating an account at `/users/new`
writes exactly one `usuario.creado` audit row, for every staff role the form can
create. Today only the catalog import writes that row, so SR-16 and FE-27 below
spoke of a creation audit row that the form did not produce. [PG] marks a scenario
that MUST run on a real PostgreSQL (see `docente-maintenance`).

## Notes for archive

- Purpose, check (a), check (b), the career rule, the visibility and selector
  requirements, the single source of truth and FE-28 are not edited. The Purpose
  table of refusals is unchanged and still binds the form: D5 adds no refusal and
  no redirect.
- Add to "Assumptions and open questions": "Decision (`docente-maintenance` D5): the
  form's audit row is written inside the same transaction as the insert, with
  `origen` `manual`, and the audit insert failing creates no account. The student
  self-registration (`/register`) is not audited by this change; that gap of RNF-06
  (a) is recorded and out of scope."
- There is still no screen that edits a staff account other than a docente. A
  docente is edited in the Docentes module (`docente-maintenance`), never here.

## MODIFIED Requirements

### Requirement: New secretaria accounts inherit the creator's facultad (SR-16, RNF-01)

When a `coordinacion` caller creates a `secretaria` account, the server MUST
set the new account's `FacultadId` to the `FacultadId` of the creator's
`Carrera` (via the creator's `Usuario.CarreraId`), read from the database at
creation time. The form MUST NOT gain a facultad field, and any `facultadId`
value in the request input MUST be ignored. A `coordinacion` caller without a
`CarreraId` (so with no derivable facultad) MUST be refused: nothing is created
and an ordinary form error is returned, not a redirect. Accounts of every other
role are created with a null `FacultadId`. `facultadId` MUST be in
`AUDITABLE_USER_FIELDS`, so the account-creation audit row (SAC-AUD-1) lists it.
There is no screen that edits a `secretaria` account, so this covers new accounts
only; a `secretaria` account that already exists receives its `FacultadId` through
a one-off, owner-confirmed `UPDATE` of that single row (tasks 7.7), never through
this flow. Docentes are edited in the Docentes module (`docente-maintenance`),
which never changes a `FacultadId`: docentes have none.
(Previously: "There is no edit-user screen, so this covers new accounts only"; the
audit row was described as existing although the form did not write it.)

#### Scenario: Coordinator creates a secretaria in their facultad

- GIVEN a `coordinacion` whose career belongs to facultad A
- WHEN they create a `secretaria` with otherwise valid data
- THEN the account is created with `FacultadId` = A
- AND the creation audit row lists `facultadId` among the fields
- AND (Previously: stated without a form row; the row is now written, SAC-AUD-1)

#### Scenario: Forged facultad ignored

- GIVEN a `coordinacion` of facultad A
- WHEN the request carries `facultadId` = B
- THEN the account is created with `FacultadId` = A

#### Scenario: Coordinator without a career refused

- GIVEN a `coordinacion` with no `CarreraId`
- WHEN they submit an otherwise valid `secretaria` account
- THEN no account is created and a form error is returned
- AND there is no redirect to the permission-denied screen

#### Scenario: Other roles get no facultad

- GIVEN an `administrador` creating a `coordinacion`, or a `secretaria` creating a `docente`
- WHEN the account is created
- THEN its `FacultadId` is null

### Requirement: FE-27 Account creation asks no "Usuario" and derives Login (UX-21; RN-02, RNF-01)

The staff creation form MUST NOT show or ask for a "Usuario". The server MUST set
the new account's `Login` deterministically from the normalized email (trimmed,
lower-case, the full address), with the same rule as the imported docentes (see
`imported-account-provisioning` "Login derivation"), and MUST ignore any `login`
value in the request. A derived `Login` that equals the `Login` of an existing
account MUST make the creation fail with an ordinary form error, with nothing
created and no suffix added. Accounts that exist before this change MUST keep
their `Login` unchanged. The audit row of the creation (SAC-AUD-1) carries no
`Login` value. Texts MUST exist in `es` and `en`.
(Previously: "The audit row of the creation keeps its existing shape.", which
assumed a row the form did not write.)

#### Scenario: The form has no Usuario field

- GIVEN an `administrador`, `coordinacion` or `secretaria` opening `/users/new`
- WHEN the form renders
- THEN it has no "Usuario" field and asks for name, email, password and the role-specific fields only

#### Scenario: Login derived from the email

- GIVEN a valid creation with the email "Ana.Perez@uni.edu"
- WHEN it succeeds
- THEN the account's `Login` is derived from "ana.perez@uni.edu" and its email is stored as "ana.perez@uni.edu"

#### Scenario: Posted login ignored

- GIVEN a hand-crafted request that carries `login=other`
- WHEN the account is created
- THEN its `Login` is the derived one

#### Scenario: Derived Login collision

- GIVEN an existing account whose `Login` equals the one derived for the new email
- WHEN the creation is submitted
- THEN no account is created and an ordinary form error is returned, with no redirect to the denied screen
- AND no audit row exists for the refused creation

#### Scenario: Existing logins untouched

- GIVEN accounts created before this change with a chosen "Usuario"
- WHEN the change is applied
- THEN their `Login` values are unchanged

## ADDED Requirements

### Requirement: SAC-AUD-1 Account creation from the form is audited (D5; RF-12 a, RNF-06 a)

A successful creation at `/users/new`, for every role the form can create
(`coordinacion`, `secretaria` and `docente`), MUST write exactly one
`usuario.creado` audit row, inside the same database transaction as the insert of
the account, with the creating user as actor, entity type `Usuario`, the new
account's id as entity id, and a payload of field names only with `origen`
`manual` (`audit-log` DM-AUD-1 to DM-AUD-3). If the audit insert fails, no account
MUST exist and the form MUST answer with an ordinary form error and no redirect.
A refused creation MUST write no row. Nothing else about the form changes: check
(a) before parsing, check (b), the input schema and its messages, the Login
derivation, the email uniqueness check, the career check, the facultad rule, the
password hashing, `DebeCambiarClave`, the redirect to `/users` on success, and every
outcome listed in the Purpose table. Student self-registration is not changed and
writes no row.

#### Scenario: One row per created role (table-driven) [PG]

| Creator | Role created | Audit rows added |
|---|---|---|
| `administrador` | `coordinacion` | 1 (`usuario.creado`) |
| `coordinacion` | `secretaria` | 1 (`usuario.creado`, lists `facultadId`) |
| `secretaria` | `docente` | 1 (`usuario.creado`) |

- GIVEN a creator and valid data for the role from the row
- WHEN the form is submitted
- THEN the account exists, the user is redirected to `/users`, and exactly the
  audit rows in the row exist, with the creator as actor and the new account's id
  as entity id

#### Scenario: Audit insert failure creates no account [PG]

- GIVEN a valid creation whose audit insert is made to fail
- WHEN the action runs
- THEN no account with that email exists, no audit row exists, and the form shows
  an ordinary error without redirecting

#### Scenario: Refusals write no row (table-driven) [PG]

| Refusal |
|---|
| check (a): a caller who may not create |
| check (b): a role outside the caller's assignable set |
| invalid data (including role `estudiante`) |
| email already held by another account, in any case |
| derived Login already in use |
| `coordinacion` account without a valid career |
| `coordinacion` caller without a career creating a `secretaria` |

- GIVEN the refusal from the row
- WHEN the form is submitted
- THEN the outcome (redirect to the denied screen or ordinary form error) is the
  one defined before this change, no account is created and no audit row exists

#### Scenario: Concurrent creations of one email [PG]

- GIVEN two creations of the same new email at the same time
- WHEN both run
- THEN exactly one account and one `usuario.creado` row exist, and the other
  request gets the ordinary duplicate form error

#### Scenario: The row holds no value

- GIVEN a created account with a name, email, phone and password
- WHEN its audit payload is serialized
- THEN it holds none of them, nor the derived `Login` nor a hash

#### Scenario: Student self-registration is unchanged

- GIVEN a student registering at `/register`
- WHEN the registration succeeds
- THEN no `usuario.creado` row is written by this change and the registration
  behaves as before
