# Apply Progress: auth-route-tests

## Task 0.1: delivery decision (owner, 2026-11-18)

Option A: one PR with one commit per work unit, review budget 1000 changed lines (`openspec/` excluded). Checkpoint after unit 3: measure the real diff (`git diff --numstat main...HEAD`, excluding `openspec/`); if unit 4 would take the total past 1000, stop and report to the owner, who decides between a small `size:exception` and splitting unit 4 into a stacked PR (chain strategy `stacked-to-main`). Do not trim tests to fit the budget.

## Apply run 2026-11-18 (units 1-3)

Mode: Strict TDD (vitest, `npm test`). Every run used `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`; no migration, no build, no database access.

### Task 0.2 and 0.3

- 0.2: branch `feat/auth-route-tests`; `c7c0c20` is an ancestor of HEAD (`5e68ea3` planning docs on top). Baseline `npm test -- "src/app/(auth)/login" "src/app/(dashboard)/reports"`: 8 files, 144 tests, green.
- 0.3: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` re-read. `redirect()` "throws a `NEXT_REDIRECT` error and terminates rendering of the route segment"; it is valid in Server Components, Route Handlers and Server Functions; Server Actions must call it outside `try`. No drift from the design: the throwing mock is faithful. The doc also says `redirect` accepts absolute URLs and can go to external links, which is exactly why the `next` target needs the allowlist.

### Environment note (CRLF)

Working copies of existing files are CRLF (`core.autocrlf=true`); new files written by tools are LF and git normalizes both on commit. `eslint` therefore reports `Delete ␍` (prettier/prettier) on every line of CRLF files; per the task precedent these are filtered with `rg -v 'Delete .␍.'`. `prettier --check` is run with `--end-of-line auto`. Files that were created new (LF) pass both gates with no filter.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Mutation check |
|------|-----------|-------|------------|-----|-------|-------------|----------------|
| 1.1-1.2, 1.4 | `src/lib/auth/safe-next.test.ts` | Unit | N/A (new) | Failed to resolve `@/lib/auth/safe-next` (module missing) | 15/15 after `safe-next.ts` | 4 accepted, 10 rejected, origin property over all 14 values | Removing the `"\\"` check fails 2 tests (backslash case, property); removing the control-character check fails 2 (raw tab, property); removing the `"//"` check fails 2 (protocol-relative, property); helper restored |
| 1.3, 1.5 | `src/app/(auth)/login/actions.test.ts` | Unit (mocked collaborators) | 5/5 (existing) | 1 failed: `REDIRECT:/\evil.com` instead of `REDIRECT:/` | 6/6 | The existing three login cases keep the default target; the new case pins the rejected target | Covered by RED against the old local rule |

Unit 1 test counts: `npm test -- src/lib/auth/safe-next.test.ts "src/app/(auth)/login/actions.test.ts"`: 2 files, 21 tests passed.

### Work Unit Evidence: unit 1

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/lib/auth/safe-next.test.ts "src/app/(auth)/login/actions.test.ts"`: exit 0, 2 files, 21 tests |
| Runtime harness | N/A: pure function and action tests with a mocked session |
| Rollback boundary | Revert `src/lib/auth/safe-next*` and `src/app/(auth)/login/actions*` |

### Unit 2: login page

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Mutation check |
|------|-----------|-------|------------|-----|-------|-------------|----------------|
| 2.1, 2.3 | `src/app/(auth)/login/page.test.tsx` | Integration (real `dal.ts`, mocked `getSession`, throwing `redirect`, form double) | 6/6 (existing login action tests) | 2 failed against the old page: `next=/\evil.com` gave `/\evil.com`; `next=["/a","/b"]` threw `TypeError: next.startsWith is not a function` | 18/18 (24/24 with the action tests) | `next`: root, query, `//`, absolute, missing, array, backslash | Removing the helper call (page passes `next` through) fails 4 cases (`//evil.com`, `https://evil.com`, repeated value, backslash) |
| 2.2 | same file | Integration | same | **Characterization pins, pass at write**: 5 roles and 5 flagged roles redirect to `/`; anonymous gets the form with no redirect; `next` cases root, query, `//`, absolute, missing | pass at write | n/a | Replacing the signed-in `redirect("/")` with a no-op fails all 10 role and flagged cases (`sends <role> to /`, `sends a flagged <role> to / too`) |

Mutation edits were temporary and reverted (restored from a backup copy, then `git diff --stat` confirmed only the GREEN change remained).

Deviation from `tasks.md` 2.2: the task listed the array `next` case as a characterization pin that passes at write. It did not: the current page crashes on a repeated `next` parameter (`next.startsWith is not a function`), so that case is a real RED fixed by the helper, a second user-visible defect closed by the same change. The `searchParams` type was widened to `{ next?: string | string[] }` to match what Next.js passes.

Unit 2 test counts: `npm test -- "src/app/(auth)/login"`: 2 files, 24 tests passed.

### Work Unit Evidence: unit 2

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- "src/app/(auth)/login"`: exit 0, 2 files, 24 tests |
| Runtime harness | N/A: Server Component called as a function with the real `dal.ts` |
| Rollback boundary | Revert `src/app/(auth)/login/page*`; unit 1 stays harmless |

### Unit 3: ratchet RED, then characterization

Note on counts: the design says the ratchet lists four missing tests; the login page test landed in unit 2, so it lists three.

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Mutation check |
|------|-----------|-------|------------|-----|-------|-------------|----------------|
| 3.1-3.2 | `src/app/route-coverage.test.ts` (+ `src/test/access/inventory.ts`, test support) | Structural (source text and tree) | N/A (new) | 3 failed, 79 passed, naming `(auth)/register/actions.ts`, `(auth)/register/page.tsx`, `(dashboard)/profile/page.tsx` | 82/82 after the three tests below landed (inventory sanity 1, RAC-1 50 entries, RAC-2 24 dashboard pages + 1 checker unit test, RAC-3 6 exemptions) | The guard-first checker is also exercised on synthetic sources (guarded, late guard, no async default export, no await) | See the ratchet mutation table below |
| 3.3 | `src/app/(auth)/register/page.test.tsx` | Integration (real `dal.ts`, mocked `getSession`, form double) | N/A (new) | **Characterization pins, pass at write** (no new behavior) | 11/11 (5 roles + 5 flagged redirect to `/` without `listCarreras`; anonymous gets `props.carreras`, `getSession` runs before `listCarreras` by `invocationCallOrder`) | 5 roles, 5 flagged, anonymous | `listCarreras` before the session check: 11 failed (all 10 signed-in cases and the order case) |
| 3.4 | `src/app/(dashboard)/profile/page.test.tsx` | Integration (real `dal.ts`, real catalogs through `serverIntl`, rendered) | N/A (new) | **Characterization pins, pass at write** | 7/7 (anonymous `REDIRECT:/login`, flagged `REDIRECT:/change-password`, both with no reads; 5 roles each render their own name, email and career and call `getUsuarioByLogin` once with `session.login`) | 5 roles with distinct logins | Reading `"someone.else"` instead of `session.login`: 5 failed (all role cases) |
| 3.5 | `src/app/(auth)/register/actions.test.ts` | Unit (mocked collaborators, forbidden spies) | N/A (new) | **Characterization pins, pass at write**, titled "pins; roadmap 0.6 edits these" | 7/7 (`rol=administrador` still gives `estudiante` in `createUsuario` and `signSession`; no guard, `getSession` never called; CIF stored as posted; mismatch, invalid, unknown career, duplicate keys) | 4 error branches, each with no creation | Taking `rol` from the form (both occurrences): 1 failed (the `rol=administrador` case) |

Ratchet mutation table (each temporary, reverted before the next):

| Mutation | Result |
|----------|--------|
| Rename `(dashboard)/reports/page.test.tsx` | 1 failed: `(dashboard)/reports/page.tsx has a sibling test` ("no test next to (dashboard)/reports/page.tsx") |
| Blank the reason of `privacy/page.tsx` | 1 failed: `privacy/page.tsx exists and says why it is public` ("privacy/page.tsx has no reason") |
| Point an exemption at a path that does not exist | 1 failed: `privacy/gone/page.tsx ...` ("privacy/gone/page.tsx matches no file") |
| Await `getTranslations` before `requireUser` in `profile/page.tsx` | 1 failed: `(dashboard)/profile/page.tsx awaits a guard before anything else` (first await was `getTranslations`) |
| Add `api/zz-new/route.ts` with no test | 1 failed: `api/zz-new/route.ts has a sibling test` |

Product-file mutations (`register/page.tsx`, `profile/page.tsx`, `register/actions.ts`) were restored with `git restore`; the renamed test, the inventory edits and the temporary route were reverted by hand, and `git status` showed only the intended new files before the commit.

Deviations: (1) the sibling-test rule applies to every entry including the public ones, because the RED run must name `register/*`; the exemptions drive the guard check and, from unit 4, the table check. (2) `GUARDS` includes the named helper `requireCatalogAccess` (it calls `requireRole` first), as the task allows "via a named helper".

Unit 3 test counts: `npm test -- src/app/route-coverage.test.ts "src/app/(auth)/register" "src/app/(dashboard)/profile"`: 4 files, 107 tests passed.

### Work Unit Evidence: unit 3

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/app/route-coverage.test.ts "src/app/(auth)/register" "src/app/(dashboard)/profile"`: exit 0, 4 files, 107 tests |
| Runtime harness | N/A: tests only |
| Rollback boundary | Delete the four new tests and `src/test/access/inventory.ts` |

### Gates summary (units 1-3)

| Gate | Unit 1 | Unit 2 | Unit 3 |
|------|--------|--------|--------|
| Focused `npm test` | 2 files, 21 tests | 2 files, 24 tests | 4 files, 107 tests |
| `npm run typecheck` | clean | clean | clean |
| `npx eslint <touched>` | only `Delete ␍` noise on the two CRLF files | only `Delete ␍` noise on `page.tsx` | clean (new files are LF) |
| `npx prettier --check` | clean with `--end-of-line auto` | clean with `--end-of-line auto` | clean |

### Checkpoint after unit 3 (task 3.8)

Command: `git diff --numstat c7c0c20...HEAD -- . ":(exclude)openspec" ":(exclude).engram"`. The planning commit `5e68ea3` (made before this run) also carries `.engram/manifest.json` (+8) and `.engram/chunks/1e75ff2e.jsonl.gz`; they are not authored work and are excluded here. None of the three unit commits contains `.engram`.

| File | Added | Deleted | Design estimate |
|------|-------|---------|-----------------|
| `src/lib/auth/safe-next.ts` | 17 | 0 | 22 |
| `src/lib/auth/safe-next.test.ts` | 48 | 0 | 60 |
| `src/app/(auth)/login/actions.ts` | 2 | 7 | 10 |
| `src/app/(auth)/login/actions.test.ts` | 11 | 0 | 20 |
| `src/app/(auth)/login/page.tsx` | 3 | 5 | 6 |
| `src/app/(auth)/login/page.test.tsx` | 96 | 0 | 75 |
| `src/app/(auth)/register/page.test.tsx` | 90 | 0 | 65 |
| `src/app/(auth)/register/actions.test.ts` | 141 | 0 | 115 |
| `src/app/(dashboard)/profile/page.test.tsx` | 130 | 0 | 95 |
| `src/test/access/inventory.ts` | 59 | 0 | 65 |
| `src/app/route-coverage.test.ts` | 98 | 0 | 95 |
| **Total units 1-3** | **695** | **12** | **628** |

Measured: 707 authored changed lines (695 added + 12 deleted) against 628 designed, a ratio of 1.13 (the register, profile and login page tests ran 1.2-1.4x their estimates; the helper, its test and the inventory ran under).

Projection for unit 4 (design estimate ~350: `matrix-table.ts` 130, `harness.ts` 110, three matrix files 110): at the observed 1.13 ratio the unit lands near 395; adding the ratchet table check (task 4.1), which extends a file that already stands at 98 lines against a 95-line design budget, adds about 35 more, so the central projection is about 430 (range 380-500). Projected total about 1140 (range 1090-1210), over the 1000-line budget by roughly 90-210 lines.

Per the option A checkpoint rule, unit 4 is NOT started. The owner decides between a small `size:exception` and splitting unit 4 into a stacked PR (`stacked-to-main`). Tests were not trimmed to fit the budget.

## Checkpoint decision (owner, 2026-11-18)

After unit 3 the authored diff was 707 lines and the unit-4 projection gave about 1140 in total. The owner accepted a `size:exception` (delivery_strategy `exception-ok`) for one PR, with a hard cap of 1250 changed lines (`openspec/` and `.engram/` excluded): if unit 4 would pass 1250, stop and ask again.

## Apply run 2026-11-18 (unit 4: harness, table, matrix, ratchet table check)

Mode: Strict TDD (vitest, `npm test`). Every run used `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`; no migration, no build, no database access, no product file edited (every mutation below was restored with `git restore` or from a backup before the commit).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Mutation check |
|------|-----------|-------|------------|-----|-------|-------------|----------------|
| 4.1-4.2 | `src/app/route-coverage.test.ts` (+ `src/test/access/matrix-table.ts`, test support) | Structural (tree vs table) | 82/82 (unit 3 ratchet) | Suite failed to load: `Cannot find package '@/test/access/matrix-table'` | 85/85 after the table landed (84 plus the printed-figure test) | missing and stale lists; group sanity (page/route/actions keys); N derived from the table | Removed a row: `missing: ["(dashboard)/reports/page.tsx"]`; added a stale row: `stale: ["(dashboard)/gone/page.tsx"]`; added `src/app/zz-bogus/page.tsx`: fails RAC-1 (no sibling test) and the table check (`missing`) |
| 4.3-4.4 | `src/app/access-matrix.pages.test.tsx` (+ `src/test/access/harness.ts`) | Behavioral (real `dal.ts` and `catalog-access.ts`, tripwires past the guard) | N/A (new) | **Matrix, pass at write**: 175 cases, no behavior changed | 175/175 | 25 pages x 7 identities | See the mutation table below |
| 4.5 | `src/app/access-matrix.routes.test.ts` | Behavioral | N/A (new) | **Matrix, pass at write** | 49/49 | 7 routes x 7 identities; cron rows deny every identity | See the mutation table below |
| 4.6 | `src/app/access-matrix.actions.test.ts` | Behavioral | N/A (new) | **Matrix, pass at write** | 211/211 (210 cases plus the exports check) | 30 actions in 12 files x 7 identities | See the mutation table below |

Deviation from the task text (4.3): `vi.doMock` from the harness took effect first time, so the hoisted `vi.mock` fallback was not needed. `import.meta.glob` typechecked only with the fallback `/// <reference types="vite/client" />` at the top of each matrix file (not in the harness, because the glob call lives in the matrix files). Observation: under the non-TTY default reporter of `npm test` the passing-test `console.info` lines are not shown; they print with `--reporter=default` (or `verbose`), which is the command used to record the figure.

### Matrix figure (printed by the run)

Command: `npx vitest run src/app/access-matrix src/app/route-coverage.test.ts --reporter=default`

```
access matrix total:   62 entry points x 7 identities = 434 cases, 320 denied, 114 admitted
access matrix pages:   25 entry points x 7 identities = 175 cases, 119 denied, 56 admitted
access matrix routes:   7 entry points x 7 identities =  49 cases,  40 denied,  9 admitted
access matrix actions: 30 entry points x 7 identities = 210 cases, 161 denied, 49 admitted
```

The figure equals the design inventory exactly (62 = 25 + 7 + 30; 434; 320 = 119 + 40 + 161; 114 = 56 + 9 + 49). Each matrix file asserts in `afterAll` that every unauthorized pair was denied (denied count equals the table's denials, and admitted equals the rest), so the 100% result is a failing assertion, not a print. "30 actions" counts exported functions; the table has 12 rows (one per file) with their `exports`, as D10 says. The tree matched the design inventory at base `c7c0c20`; no table correction was needed.

### Mutation checks on the matrix (each temporary, then restored)

| Mutation | Result |
|----------|--------|
| `enrollment/page.tsx`: `requireRole(...rolesSolicitantes)` replaced by `requireUser()` (drops the role) | 4 cases failed (administrador, coordinacion, secretaria, docente): `must be denied: expected { threw: 'PAST_GUARD:intl' } to deeply equal { redirect: '/denied' }`; tally failed in `afterAll` (denied 115 of 119) |
| `requests/page.tsx`: a data read (`listOwnRequests(0)`) before the guard | 6 cases failed, including anonymous and flagged: `expected { threw: 'PAST_GUARD:db' } to deeply equal { redirect: '/login' }`; tally 113 of 119 denied |
| `enrollment/actions.ts`: guard widened to `requireRole("estudiante", "docente")` | 2 cases failed (`enrollAction` and `dropAction` as docente: `expected { returned: true } to deeply equal { redirect: '/denied' }`); tally 159 of 161 |
| `intake/upload-token/route.ts`: `canFileRequests` check removed | 4 cases failed (the four non-student roles got `400 bad_request` instead of `403 forbidden`); tally 36 of 40 |
| `reports/justifications/route.ts`: only `canViewReports` removed | Not caught, by design: the scope check (`resolveReportScope` gives `none` for a non-coordinator) still redirects to `/denied`, so the route is still denied (second layer, equivalent mutant) |
| Same route: `canViewReports` and the `scope.kind === "none"` redirect both removed | Failed: administrador and secretaria got `500 export_failed` instead of the `/denied` redirect |
| Table: `users/page.tsx` allows docente | 1 case failed (`docente must be admitted`... the real page denies it) and the admitted tally was 56 instead of 57 |
| Table: row removed / stale row / `zz-bogus/page.tsx` added | Ratchet lists `missing` / `stale` / the bogus page (see the first table); a stale row also fails the matrix with `no module loader for (dashboard)/gone/page.tsx` |
| Actions file gains `export async function extraAction() {}` | Exports check failed: `[dropAction, enrollAction, extraAction]` vs `[dropAction, enrollAction]` |
| Table: `api/cron/intake-sweep` allows administrador (a valid session on a cron route) | Failed: `must be admitted, got {"status":401,"error":"unauthorized"}`; the route still answers 401 to a session |

### Gates (unit 4)

| Gate | Result |
|------|--------|
| Focused `npm test -- src/app/access-matrix src/app/route-coverage.test.ts` | 4 files, 520 tests passed; the three matrix files ran in separate workers (pages about 5 s, actions about 2.5 s, routes about 2 s; whole run about 10 s, well inside the 120 s load timeout) |
| `npm run typecheck` | clean |
| `npx eslint` on the six touched files | clean (the five new files are LF; `route-coverage.test.ts` was already LF) |
| `npx prettier --check` on the six touched files | clean (no CRLF noise: none of the six is a CRLF working copy) |
| Full `npm test` (task 4.10) | `DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test`, run once: 350 files, 8343 tests, all passed, wall time 263.75 s; no flaky timeout in `src/lib/signals/evaluate.test.ts` this time |

### Work Unit Evidence: unit 4

| Evidence | Value |
|---|---|
| Focused test command | `npm test -- src/app/access-matrix src/app/route-coverage.test.ts`: exit 0, 4 files, 520 tests |
| Runtime harness | N/A: tests only; the run prints the figure (reporter note above) |
| Rollback boundary | Delete `matrix-table.ts`, `harness.ts`, the three matrix files; revert the ratchet table check |

### Size (task 4.11)

Command: `git diff --numstat c7c0c20 -- . ":(exclude)openspec" ":(exclude).engram"` (HEAD plus the unit-4 files).

| File | Added | Deleted | Design estimate |
|------|-------|---------|-----------------|
| `src/test/access/matrix-table.ts` | 203 | 0 | 130 |
| `src/test/access/harness.ts` | 185 | 0 | 110 |
| `src/app/route-coverage.test.ts` (table check, +61 over unit 3) | 159 total | 0 | 95 total |
| `src/app/access-matrix.pages.test.tsx` | 15 | 0 | 30 |
| `src/app/access-matrix.routes.test.ts` | 22 | 0 | 35 |
| `src/app/access-matrix.actions.test.ts` | 27 | 0 | 45 |

Unit 4 adds 513 changed lines (452 in new files plus 61 in the ratchet) against the ~430 projected. Total for units 1-4: 1208 added + 12 deleted = **1220** changed lines, under the 1250 hard cap (30 lines of margin) and over the 1000 budget by 220, covered by the owner's `size:exception`. Tests were not trimmed to fit; the table, harness and matrix are the compact table-driven form (matrix files are 15-27 lines each). The harness and table grew past their estimates because of the 62-row oracle (one row per entry, prettier line wrapping) and the observation and tripwire code; the three matrix files came in far under.
