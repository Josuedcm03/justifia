# Staff Account Creation Specification

## Purpose

Staff-account creation follows a role-assignment hierarchy. Each role that can
create accounts may assign exactly one role, the next one down. The users module
(sidebar item, users list, `/users/new`) is reserved for those same roles. The
server is the authority: hiding UI is not sufficient.

| Caller | May assign |
|---|---|
| `administrador` | `coordinacion` |
| `coordinacion` | `secretaria` |
| `secretaria` | `docente` |
| `docente`, `estudiante` | nothing |

Nobody can assign `administrador` or `estudiante` through this flow.
"Creator" below means a caller whose role may assign at least one role, that is
`administrador`, `coordinacion` or `secretaria`.

"Denied" means: an unauthenticated caller is sent to login; an authenticated
caller who is refused is redirected to the permission-denied screen (capability
`permission-denied-screen`), not to the dashboard root.

Which refusals redirect and which are ordinary validation errors:

| Refusal | Outcome |
|---|---|
| Check (a): caller's role may not assign anything | Denied (redirect to the permission-denied screen; login if unauthenticated) |
| Check (b): requested role is outside the caller's assignable set | Denied (redirect to the permission-denied screen). There is no form error and no dedicated message |
| Invalid input data, including role `estudiante` (rejected by the input schema before check (b)) | Ordinary form error (generic invalid-data message), no redirect |
| Missing or unknown career for a `coordinacion` account | Ordinary form error (career message), no redirect |

The contents of the users list (which rows each viewer sees, pagination, search)
are specified in capability `users-listing`.

## Requirements

### Requirement: Check (a) - only creator roles may invoke creation

The creation action MUST decide, before parsing any input, whether the caller's
role may assign at least one role. If not, it MUST create nothing and MUST deny
the caller. This MUST hold for a hand-crafted request that bypasses the UI.

#### Scenario: Non-creator callers are denied (table-driven)

- GIVEN a caller who is `docente`, `estudiante` or unauthenticated
- WHEN they invoke the action with any payload, including role `administrador`
- THEN no account is created and no input is parsed
- AND `docente` and `estudiante` are redirected to the permission-denied screen
- AND the unauthenticated caller is sent to login

#### Scenario: Creator caller passes check (a)

- GIVEN an authenticated `administrador`, `coordinacion` or `secretaria`
- WHEN they invoke the action
- THEN the request proceeds to input parsing

### Requirement: Check (b) - requested role must be assignable by the caller

After parsing and before any persistence, the action MUST verify that the
requested role is in the caller's assignable set. If not, it MUST create
nothing and MUST redirect the caller to the permission-denied screen, exactly as
check (a) does. It MUST NOT return a form error for this refusal, and no
role-not-allowed message is added to the catalogs. This MUST hold for a
hand-crafted request whose role value was never offered by the UI.

#### Scenario: Allowed pairs create the account (table-driven)

| Caller | Requested role | Extra condition |
|---|---|---|
| `administrador` | `coordinacion` | valid existing `carreraId` |
| `coordinacion` | `secretaria` | the caller has a `CarreraId` (its `Carrera.FacultadId` is copied to the new account) |
| `secretaria` | `docente` | none |

- GIVEN an authenticated caller and otherwise valid data
- WHEN they submit the requested role from the row
- THEN the account is created with that role and they are redirected to the
  users list

#### Scenario: Disallowed pairs are redirected to the denied screen (table-driven)

| Caller | Rejected requested roles |
|---|---|
| `administrador` | `administrador`, `secretaria`, `docente` |
| `coordinacion` | `coordinacion`, `docente`, `administrador` |
| `secretaria` | `secretaria`, `coordinacion`, `administrador` |

- GIVEN an authenticated creator and otherwise valid data
- WHEN they submit a rejected role from their row
- THEN no account is created
- AND they are redirected to the permission-denied screen
- AND no form error is returned

#### Scenario: Estudiante target is a validation error, not a redirect

- GIVEN any creator caller
- WHEN they submit role `estudiante`
- THEN no account is created and the generic invalid-data form error is returned
- AND there is no redirect, because the input schema rejects the value as
  invalid data before check (b) runs

#### Scenario: Hand-crafted role outside the UI options

- GIVEN a `secretaria` sending a request built outside the form
- WHEN the role field is `administrador`
- THEN no account is created
- AND the caller is redirected to the permission-denied screen

#### Scenario: Refusal by check (b) is decided before any write

- GIVEN a `secretaria` submitting an otherwise valid request for role
  `coordinacion`
- WHEN check (b) refuses it
- THEN the number of stored accounts is unchanged after the redirect

### Requirement: Coordinacion accounts require an existing career

When the role being assigned is `coordinacion`, a career (`carreraId`) MUST be
provided and MUST exist; otherwise nothing is created and a form error is
returned (an ordinary validation error, not a redirect). (Existing rule,
unchanged.)

#### Scenario: Administrador creates coordinacion with a valid career

- GIVEN an `administrador` and an existing career
- WHEN they submit role `coordinacion` with that `carreraId`
- THEN the account is created linked to that career

#### Scenario: Missing or unknown career

- GIVEN an `administrador` submitting role `coordinacion`
- WHEN `carreraId` is absent, or does not exist
- THEN no account is created and the corresponding career error is returned
- AND there is no redirect to the permission-denied screen

### Requirement: Users module is visible only to creator roles

The users module, meaning the "Users" sidebar item, the users list page and
`/users/new`, MUST be visible and reachable only to `administrador`,
`coordinacion` and `secretaria`. `docente` and `estudiante` MUST NOT see the
sidebar item and MUST NOT be able to open either page. This ADDS `coordinacion`
to a module that today serves only `secretaria` and `administrador`. Each page
MUST enforce this on the server, independently of the sidebar.
(Previously: creator roles were merely "allowed into" a module whose policy
was separate from creation rights.)

#### Scenario: Sidebar item per role (table-driven)

| Role | "Users" item |
|---|---|
| `administrador`, `coordinacion`, `secretaria` | present |
| `docente`, `estudiante` | absent |

- GIVEN a signed-in user with the role from the row
- WHEN the dashboard sidebar renders
- THEN the "Users" item is present or absent as in the row

#### Scenario: Creator opens each page directly

- GIVEN an authenticated `administrador`, `coordinacion` or `secretaria`
- WHEN they request the users list, and separately `/users/new`
- THEN the users list, respectively the creation form, is rendered

#### Scenario: Docente or estudiante opens each URL directly

- GIVEN an authenticated `docente` or `estudiante`
- WHEN they request the users list, and separately `/users/new`, by typing the URL
- THEN neither page content is rendered
- AND they are redirected to the permission-denied screen, not the dashboard root

#### Scenario: Unauthenticated caller opens each URL directly

- GIVEN no session
- WHEN the caller requests the users list, and separately `/users/new`
- THEN they are sent to login and no page content is rendered

### Requirement: New-user button visibility

Because every viewer of the users list is a creator, the "new user" button on the
users list MUST be shown to every viewer of that list. It is a convenience and
MUST NOT be the enforcement mechanism; check (a) and check (b) remain the
enforcement.
(Previously: hidden from non-creators who could otherwise reach the list.)

#### Scenario: Button shown to every creator (table-driven)

- GIVEN an `administrador`, `coordinacion` or `secretaria` viewing the users list
- WHEN the page renders
- THEN the button is present

#### Scenario: Hidden button does not grant or remove rights

- GIVEN a creator who opens `/users/new` without using the button
- WHEN they submit a valid allowed pair
- THEN the account is created, because enforcement does not depend on the button

### Requirement: Role selector offers only assignable roles

The role selector MUST list exactly the caller's assignable roles and nothing
else. Because the UI only offers assignable roles, check (b) is reached only by
requests that were not produced by the form.

#### Scenario: Selector contents per creator (table-driven)

- GIVEN a caller of role `administrador`, `coordinacion` or `secretaria`
- WHEN the form renders
- THEN the options are exactly `coordinacion`, `secretaria` or `docente`
  respectively

#### Scenario: Non-assignable roles never offered

- GIVEN an `administrador`
- WHEN the form renders
- THEN `administrador`, `secretaria`, `docente` and `estudiante` are absent

### Requirement: Single source of truth for the assignment rule and module visibility

The assignment hierarchy MUST be defined once, as one structure in the
role-permission policy. "May this caller create at all", "may this caller assign
this role", "which roles to offer" and "may this caller see the users module"
MUST all derive from it, so module visibility and creation rights cannot
disagree. The action, page guards, sidebar item, button and selector MUST reuse
those derivations. No other file MAY restate the rule or hold a separate
users-module role list. (Which roles a viewer may see in the list is a separate
rule owned by `users-listing`; it lives in the same policy file but is not
restated here.)

#### Scenario: Predicates match the structure

- GIVEN the policy structure
- WHEN each predicate is evaluated for every (caller, target) pair
- THEN results equal the table in Purpose, with no pair outside it allowed

#### Scenario: Module visibility equals creation rights

- GIVEN each of the five roles
- WHEN "may see the users module" and "may create at all" are evaluated
- THEN both give the same answer for every role

#### Scenario: Unknown or missing caller role

- GIVEN an undefined or unrecognized caller role
- WHEN any predicate is evaluated
- THEN it denies, offers no roles and hides the module

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

### Requirement: FE-28 Staff accounts require a unique email (UX-21; RN-02, RNF-01)

Creating a staff account MUST require an email: a missing or empty email, or one
that is not a valid address of at most 160 characters, MUST make the creation
fail with an ordinary form error, with nothing created and no redirect. The email
MUST be stored normalized. An email equal, ignoring case and surrounding
whitespace, to the email of an existing account MUST make the creation fail the
same way. The rule applies to every role the flow can assign. Accounts created
before this change without an email, which have no CIF either, are not altered
by it; they cannot sign in by any value, their stored `Login` included, because
no fallback exists (`auth-entry-access` FE-21, FE-25). Texts MUST exist in `es`
and `en`.

#### Scenario: Email required and unique (table-driven)

| Email submitted | Existing accounts | Result |
|---|---|---|
| empty or absent | any | refused, error on email |
| `not-an-email` | any | refused, error on email |
| 161 characters | any | refused, error on email |
| `ana@uni.edu` | none with that email | account created |
| `ANA@uni.edu` | one with `ana@uni.edu` | refused, error on email, nothing created |

- GIVEN a creator and otherwise valid data for an allowed role
- WHEN they submit the email in the row
- THEN the outcome is as shown

#### Scenario: Every assignable role needs it

- GIVEN an `administrador` creating a `coordinacion`, a `coordinacion` creating a `secretaria` and a `secretaria` creating a `docente`
- WHEN each submits without an email
- THEN each is refused with an error on the email

#### Scenario: New staff can sign in

- GIVEN a staff account just created with an email and a password
- WHEN its holder submits that email and password at sign-in
- THEN they are signed in (`auth-entry-access` FE-21)

#### Scenario: Older email-less accounts are untouched

- GIVEN an active coordinator account created before this change with no email and no CIF
- WHEN the change is applied
- THEN the account is unchanged and cannot sign in, by its stored `Login` or by any other value, until it has an email

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
## Assumptions and open questions

- Decision (user): a request refused by check (b) is redirected to the
  permission-denied screen, like check (a). There is no form error and no new
  `users.new.errors` message. The denied screen's copy is generic and does not say
  that the requested role was not assignable; this is accepted because the UI
  never offers such a role, so only a hand-crafted request reaches check (b).
- Assumption: the estudiante target stays a generic invalid-data form error, since
  the input schema rejects it before check (b); it is the one role-related value
  that does not redirect.
- Assumption (confirm): the users list and `/users/new` are refused to
  non-creators by the same denial behaviour (permission-denied screen); the
  screen itself is specified in `permission-denied-screen`.
- Assumption: `coordinacion` gains users-module access. What each viewer role sees
  in the list is now specified in `users-listing` (`coordinacion` sees all users).
- Decision consequence (confirm): no in-app path creates an `administrador`;
  admins come from the seed.
- Assumption: a `secretaria` created by a `coordinacion` is NOT scoped to the
  coordinator's career.
- Assumption: self-registration (creates `estudiante`) is unchanged and out of
  this capability.
- Assumption: accounts created earlier are untouched.
- Assumption: the "Settings" and "Dashboard" sidebar items are unaffected.
- Decision (`docente-maintenance` D5): the form's audit row is written inside the same transaction as the insert, with `origen` `manual`, and the audit insert failing creates no account. The student self-registration (`/register`) is not audited by this change; that gap of RNF-06 (a) is recorded and out of scope.
