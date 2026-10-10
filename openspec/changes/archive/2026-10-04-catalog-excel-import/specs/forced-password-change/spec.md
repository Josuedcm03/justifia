# Forced Password Change Specification

## Purpose

Accounts provisioned by the catalog import start with a temporary password known
to the importer. Such an account MUST NOT be usable until its owner sets their
own password. This capability defines the `DebeCambiarClave` marker, its
propagation into the session and the enforcement that blocks every guarded route
until the change is made, without creating redirect loops or locking the user
out of logout. Password reset, forgot-password and email delivery are out of
scope.

## Requirements

### Requirement: DebeCambiarClave marker

`Usuario` MUST carry a boolean `DebeCambiarClave`, not null, defaulting to false.
All accounts existing before this change MUST have it false. The only paths in
this change that set it true are account creation by the import
(`imported-account-provisioning`); the only path that clears it is a successful
password change.

#### Scenario: Default is false

- GIVEN an account created by self-registration or `/users/new`
- WHEN its `DebeCambiarClave` is read
- THEN it is false

#### Scenario: Import-created account is flagged

- GIVEN an account created by an import apply
- WHEN its `DebeCambiarClave` is read
- THEN it is true

### Requirement: Flag travels in the session

When a user signs in, the session MUST carry the current `DebeCambiarClave`
value. After a successful password change, the session MUST be refreshed so that
the flag is false and the user is not sent back to the change screen. The
enforcement MUST rely on the session value without requiring any extra query
per guarded request.

#### Scenario: Login with flagged account

- GIVEN a user whose `DebeCambiarClave` is true
- WHEN they sign in with the temporary password
- THEN the session indicates that a password change is required

#### Scenario: Login with normal account

- GIVEN a user whose `DebeCambiarClave` is false
- WHEN they sign in
- THEN the session indicates no change is required and their experience is
  unchanged

#### Scenario: Session refreshed after change

- GIVEN a flagged user who completes the change
- WHEN the change succeeds
- THEN the session's flag is false immediately, without signing in again

#### Scenario: Sessions issued before this change

- GIVEN a session created before the flag existed
- WHEN it is read
- THEN it is treated as not requiring a change

### Requirement: Guarded routes redirect flagged users

An authenticated user whose session requires a password change MUST be redirected
to the change-password screen from every route protected by the authenticated
guard, including every dashboard page and every guarded server action or route
handler, until the change is complete. This MUST hold for direct URL access and
for hand-crafted requests. Guarded actions MUST NOT perform their effect for a
flagged user.

#### Scenario: Any dashboard page (table-driven)

| Requested route |
|---|
| dashboard home |
| users list |
| `/users/new` |
| catalog import page |
| settings |

- GIVEN a signed-in user requiring a password change, of any role
- WHEN they request the route from the row
- THEN no page content is rendered and they are redirected to the
  change-password screen

#### Scenario: Guarded action is blocked

- GIVEN a flagged `secretaria` with a valid workbook
- WHEN they invoke the import preview or apply action
- THEN nothing is parsed or written and they are redirected to the
  change-password screen

#### Scenario: Template route is blocked

- GIVEN a flagged `secretaria`
- WHEN they request the template download
- THEN no file is returned and they are redirected to the change-password screen

#### Scenario: Non-flagged users are unaffected

- GIVEN a signed-in user whose flag is false
- WHEN they request any guarded route they are permitted to open
- THEN no change-password redirect occurs

#### Scenario: Unauthenticated user

- GIVEN no session
- WHEN the change-password screen or its action is requested
- THEN the caller is sent to login

### Requirement: Change-password screen and action

The change-password screen and its server action MUST require only a valid
session, never a specific role and never the not-flagged condition. The action
MUST require the new password to satisfy the same password rules as
registration, MUST require it to differ from the current temporary password, and
on success MUST store a new bcrypt hash at 12 rounds, set `DebeCambiarClave` to
false, refresh the session and redirect to the dashboard. On invalid input it
MUST return a form error and change nothing. The current password MUST be
verified before it is replaced.

#### Scenario: Successful change

- GIVEN a flagged user with a valid current temporary password
- WHEN they submit a compliant new password that differs from it
- THEN `HashClave` is replaced, the flag becomes false, the session is refreshed
  and they land on the dashboard
- AND the temporary password no longer authenticates

#### Scenario: Wrong current password

- GIVEN a flagged user
- WHEN they submit an incorrect current password
- THEN nothing changes, the flag stays true and a form error is shown

#### Scenario: Weak or mismatched new password

- GIVEN a flagged user
- WHEN the new password violates the rules, or its confirmation does not match
- THEN nothing changes and a form error is shown

#### Scenario: New password equals the temporary one

- GIVEN a flagged user
- WHEN the new password equals the current temporary password
- THEN nothing changes and a form error is shown

#### Scenario: Flagged user can reach the screen

- GIVEN a flagged user of any role
- WHEN they open the change-password screen
- THEN it renders and no redirect occurs

#### Scenario: No redirect loop

- GIVEN a flagged user on the change-password screen
- WHEN the page loads, and when the action returns a form error
- THEN there is no redirect to itself and the page remains stable

#### Scenario: Non-flagged user opens the screen

- GIVEN a signed-in user whose flag is false
- WHEN they open the change-password screen
- THEN it renders normally and the change is permitted (voluntary change)

### Requirement: Logout remains reachable

A flagged user MUST always be able to sign out, from the change-password screen
and from anywhere the logout control is offered. Logout MUST NOT be redirected to
the change-password screen.

#### Scenario: Logout while flagged

- GIVEN a flagged user on the change-password screen
- WHEN they sign out
- THEN the session ends and they are sent to login

#### Scenario: After logout the flag persists

- GIVEN a flagged user who signed out without changing the password
- WHEN they sign in again
- THEN they are again redirected to the change-password screen

### Requirement: Login flow itself is not blocked

The login and registration screens MUST remain reachable to unauthenticated
callers and MUST NOT redirect to the change-password screen. Only an
authenticated flagged session is redirected.

#### Scenario: Login page while signed out

- GIVEN no session
- WHEN the login page is requested
- THEN it renders

### Requirement: Copy in both locales

All text of the change-password screen and its errors MUST exist in the Spanish
and English catalogs with identical keys.

#### Scenario: Catalog parity

- GIVEN both catalogs
- WHEN the change-password keys are compared
- THEN the key sets are equal

## Assumptions and open questions

- Assumption: the change-password screen sits outside the guarded dashboard
  layout, at a path requiring only a session (for example `/change-password`);
  the exact path and the guard split are design decisions.
- Assumption: a voluntary password change for non-flagged users is allowed but
  no menu entry for it is required by this change.
- Assumption: password rules are those already applied at registration; no new
  policy is introduced.
- Assumption: revoking other live sessions on password change is not required
  (sessions are stateless).
- Assumption: permission-denied and role checks apply after the forced-change
  check; a flagged user is never shown a role-based denial before being sent to
  the change screen.
