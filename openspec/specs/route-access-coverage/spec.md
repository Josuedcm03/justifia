# Route Access Coverage Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for `route-access-coverage`.

## Purpose

A repo-wide invariant and a denial matrix that make RNF-01 (c) provable: every
entry point and server action has a test, every dashboard page calls a guard,
and every identity outside an entry point's allowed set is denied.

Traceability: RNF-01 (c) in every requirement.

Vocabulary: *entry point* is a `page.tsx` or `route.ts` under `src/app`, or an
exported server action of a `"use server"` file under `src/app`. *Identities* are the five roles
(`rolesUsuario`), anonymous and flagged (`debeCambiarClave`): 7 in total. The
guard is the REAL `src/lib/auth/dal.ts`; only the session source is mocked.

## Requirements

### Requirement: RAC-1 Every entry point has a test (RNF-01 c)

Every `page.tsx` and `route.ts` under `src/app` MUST have a sibling test file,
and every `"use server"` file under `src/app` MUST have an actions test. The
inventory covers `src/app` only: `src/i18n/locale.ts` (a `"use server"` file that
reads and writes the locale cookie only, with no protected data) is outside it.
The check reads the tree, so an added entry point under `src/app` without a test
MUST fail.

#### Scenario: Missing test

- GIVEN a `page.tsx`, `route.ts` or `"use server"` file under `src/app` with no sibling test and no exemption
- WHEN the ratchet runs
- THEN it fails naming the file

#### Scenario: Complete tree

- GIVEN every entry point has its test
- WHEN the ratchet runs
- THEN it passes

### Requirement: RAC-2 Every dashboard page calls a guard (RNF-01 c)

Every `page.tsx` under `src/app/(dashboard)` MUST call a guard from `dal.ts`
(`requireUser`, `requireUserAllowingPasswordChange` or `requireRole`), directly
or through a named guard helper.

#### Scenario: Unguarded dashboard page

- GIVEN a `(dashboard)` page that calls no guard and has no exemption
- WHEN the ratchet runs
- THEN it fails naming the page

### Requirement: RAC-3 Justified exemptions (RNF-01 c)

Public entry points (for example `denied`, `privacy`, `login`, `register`, the
public server actions) MAY be exempt only through an exemption list where every
entry has a written reason. An entry without a reason, or one that matches no
file, MUST fail.

#### Scenario: Exemption without reason or stale

- GIVEN an exemption with an empty reason, or a path that does not exist
- WHEN the ratchet runs
- THEN it fails naming the entry

### Requirement: RAC-4 Denial matrix over the real guard (RNF-01 c)

One table-driven test MUST list every protected entry point and exported server
action with its allowed identities. For each entry, all 7 identities MUST run
through the real `dal.ts`. Every identity outside the allowed set MUST be
denied: redirect to `/denied`, `/login` or `/change-password`, or the action's
documented denial result. No data module MAY be read before the denial.

#### Scenario: Unauthorized identity (table-driven)

- GIVEN an entry point and an identity outside its allowed set
- WHEN the entry point is requested by URL or the action is called directly
- THEN it is denied as documented (anonymous `/login`, flagged `/change-password`, other role `/denied`)
- AND every data double (which throws) was not called

#### Scenario: Allowed identity

- GIVEN an identity inside the allowed set
- WHEN the entry point is requested
- THEN no denial happens

### Requirement: RAC-5 Table equals the tree (RNF-01 c)

The matrix table MUST equal the set of protected entry points found in the
tree. A missing row (a protected entry point not in the table) and a stale row
(a row with no entry point) MUST both fail.

#### Scenario: Drift in either direction

- GIVEN a protected entry point absent from the table, or a row for a removed one
- WHEN the matrix runs
- THEN it fails naming the entry point

### Requirement: RAC-6 Cron routes (RNF-01 c)

Routes authenticated by a secret (`api/cron/*`) MUST be covered by their own
mechanism (anonymous or missing/wrong secret denied, no data read) or be listed
in the exemption list with a reason.

#### Scenario: No secret

- GIVEN a cron route called without the secret or with a wrong one
- WHEN it is requested
- THEN it is denied and no data module is read

### Requirement: RAC-7 Citable figure (RNF-01 c)

The matrix MUST report the figure "N entry points x 7 identities", with N
computed from the table, and MUST fail unless every unauthorized combination was
denied (100%).

#### Scenario: Figure reported

- GIVEN the matrix passes
- WHEN the run finishes
- THEN the output states N entry points x 7 identities and that all unauthorized combinations were denied
