# Auth Entry Access Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for `auth-entry-access`.

## Purpose

Pins the access behavior of the three auth-adjacent pages (`/login`, `/register`,
`/profile`), the safe `next` redirect rule and the current `registerAction`
behavior, so that a later change cannot regress them silently.

Traceability: RNF-01 (c) in every requirement (100% of protected routes and
actions deny an unauthorized role, by URL and by direct request).

Vocabulary: the five roles are `rolesUsuario`. *Flagged* means
`debeCambiarClave` is true. Tests run the REAL `src/lib/auth/dal.ts` with only
the session source mocked.

## Requirements

### Requirement: AEA-1 Signed-in users are redirected away from `/login` and `/register` (RNF-01 c)

`/login` and `/register` MUST redirect any signed-in user to `/`, for each of
the five roles and for a flagged user. An anonymous visitor MUST get the page.
`/register` MUST NOT call `listCarreras` for a signed-in user.

#### Scenario: Signed-in identity (table-driven over five roles + flagged)

- GIVEN a session for the identity
- WHEN `/login` or `/register` is requested
- THEN the response is a redirect to `/`
- AND on `/register` `listCarreras` was not called

#### Scenario: Anonymous visitor

- GIVEN no session
- WHEN `/login` or `/register` is requested
- THEN the form renders and no redirect happens (`/register` reads the careers)

### Requirement: AEA-2 `/profile` requires a normal session (RNF-01 c)

`/profile` MUST redirect anonymous to `/login` and flagged users to
`/change-password`. Each of the five roles MUST see only the data of
`session.login`. `/profile` has no `/denied` case (not role-restricted).

#### Scenario: Anonymous and flagged

- GIVEN no session, or a flagged session
- WHEN `/profile` is requested
- THEN the redirect is `/login`, or `/change-password` respectively, with no profile data read

#### Scenario: Own data per role (table-driven)

- GIVEN a session of each role with its own `login`
- WHEN `/profile` is requested
- THEN the profile is read by that `login` only

### Requirement: AEA-3 Safe `next` redirect (RNF-01 c)

One shared helper MUST decide the post-login target, used by both `login/page.tsx`
and `login/actions.ts`. It MUST accept a string starting with a single `/`
(not `//`, not `/\`) and return `/` for anything else, including empty and
non-string values. No path may resolve to another origin.

#### Scenario: Accepted values

- GIVEN `next` is `/` or `/requests?x=1`
- WHEN the helper runs
- THEN the value is returned unchanged

#### Scenario: Rejected values

- GIVEN `next` is `//evil.com`, `/\evil.com`, `https://evil.com`, `""`, or a non-string
- WHEN the helper runs
- THEN the result is `/`

#### Scenario: Same rule in page and action

- GIVEN `next=/\evil.com` or `next=//evil.com`
- WHEN the login page renders and when the login action succeeds
- THEN the form target and the action redirect are both `/`

### Requirement: AEA-4 `registerAction` characterization (RNF-01 c)

CHARACTERIZATION of current behavior, not desired behavior: the later
`/register` closing change (roadmap point 0.6) MUST edit these pins on purpose.
Today `registerAction` MUST always create the user with role `estudiante`,
MUST NOT apply any guard, and MUST NOT verify the CIF.

#### Scenario: Role is always `estudiante`

- GIVEN a valid form that also posts `rol=administrador`
- WHEN `registerAction` runs
- THEN the created user has role `estudiante`

#### Scenario: No guard, no CIF verification

- GIVEN a valid form with an unverified CIF, with or without a signed-in caller
- WHEN `registerAction` runs
- THEN the account is created without a guard check or CIF lookup
