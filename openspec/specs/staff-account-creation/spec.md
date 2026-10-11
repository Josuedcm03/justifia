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
(Previously: check (b) returned a dedicated form error and never redirected.)

#### Scenario: Allowed pairs create the account (table-driven)

| Caller | Requested role | Extra condition |
|---|---|---|
| `administrador` | `coordinacion` | valid existing `carreraId` |
| `coordinacion` | `secretaria` | none |
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
