# Proposal: Auth Route Tests

## Intent

Covers RNF-01 (c): 100% of protected routes and actions deny an unauthorized
role, by URL and by direct request. 33 of 36 entry points have a test;
`login`, `register` and `profile` pages do not, nor does `register/actions.ts`.
The thesis (5.3) keeps RNF-01 at "Parcial" because no test checks every
route with every role: about 20 page tests run each unauthorized role through
the real guard, but others only assert that `requireRole` is called with a
list, with the guard mocked. Nothing stops a future untested page. The login `next` rule also accepts
`/\evil.com`, which browsers resolve to `https://evil.com/` (open redirect).
Evidence: `exploration.md`.

## Scope

### In Scope
- Colocated tests: `src/app/(auth)/login/page.test.tsx`,
  `src/app/(auth)/register/page.test.tsx`,
  `src/app/(dashboard)/profile/page.test.tsx`.
- `src/app/(auth)/register/actions.test.ts`: characterization pins (role
  always `estudiante` even if another is posted, no guard, no CIF check); the
  later `/register` closing change edits them on purpose.
- Ratchet test under `src/app/`: fails when a `page.tsx`/`route.ts` lacks a
  sibling test, a `"use server"` file lacks an actions test, or a
  `(dashboard)` page calls no guard; justified exemption list for public
  pages. Starts RED.
- Denial matrix test (role x entry point): one table-driven test that lists
  every protected `page.tsx`, `route.ts` and exported server action with its
  allowed roles, and for each runs the five roles, anonymous and a flagged
  user through the REAL `dal.ts` (mocked session only). Every identity outside
  the allowed set is denied (`/denied`, `/login`, `/change-password` or the
  action's denial result) and no data module is read before the denial. The
  table is checked against the tree (the ratchet fails when an entry point is
  missing from it), so it reports one citable figure: N entry points x 7
  identities, 100% denied.
- Open-redirect fix: one shared helper for `login/actions.ts` (`safeNext`)
  and `login/page.tsx` rejects a backslash, `//` and non-`/` values. RED test
  first; minimal.
- Archive-time task: add a `docs/roadmap.md` row (owner Armando, RNF-01 (c)).

### Out of Scope
- Closing the open `/register` (later change, roadmap point 0.6).
- `middleware.ts` test (follow-up).
- Deactivated-account JWT window.
- Extending `login/actions.test.ts` beyond `safeNext`.

## Capabilities

### New Capabilities
- `auth-entry-access`: access behavior of `/login`, `/register`, `/profile`
  (signed-in redirect, anonymous and flagged handling), safe `next` redirect,
  and pinned `registerAction` behavior.
- `route-access-coverage`: repo-wide invariant that every entry point and
  server action has a test and every `(dashboard)` page calls a guard, and the
  role x entry-point denial matrix over the real guard.

### Modified Capabilities
None

## Approach

Exploration Approach 2. Page tests copy `reports/page.test.tsx` (real
`dal.ts` over mocked cookies, throwing `redirect`, `await Page(props)`). The
ratchet reads source text; the denial matrix runs the real guard with
throwing data doubles. Design places the redirect helper and the matrix
table. Single PR, about 900-1000 lines (review budget 1000; if the forecast
exceeds it, ask before apply).

## Affected Areas

| Area | Impact |
|------|--------|
| `src/app/(auth)/login/page.test.tsx`, `register/page.test.tsx`, `register/actions.test.ts` | New |
| `src/app/(dashboard)/profile/page.test.tsx` | New |
| Ratchet test under `src/app/` | New |
| Denial matrix test (role x entry point) | New |
| `src/app/(auth)/login/actions.ts`, `login/page.tsx` | Modified (redirect rule) |
| Shared `next` helper + its test | New |
| `docs/roadmap.md` | Modified at archive |

**DB schema: NO.** No migration, no data.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ratchet proves shape, not behavior | Med | Behavior lives in colocated tests |
| Exemption list hides a real gap | Low | Each entry justified inline |
| Register pins mistaken for desired behavior | Med | Named as characterization; 0.6 edits them |
| Redirect fix rejects a valid internal path | Low | Tests keep `/`, `/requests?x=1` accepted |

## Rollback Plan

Revert the change commits. No migration, no data; keep the change branch.

## Dependencies

None.

## Success Criteria

- [ ] The three pages and `register/actions.ts` have colocated tests.
- [ ] Ratchet test green; it fails if a sibling test or guard is removed.
- [ ] Denial matrix green over every protected entry point and server action
      with the five roles, anonymous and flagged; it fails if a protected
      entry point is missing from the table or lets an unauthorized identity
      through.
- [ ] `/\evil.com` and `//evil.com` resolve to `/` in both login paths.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src` green.
