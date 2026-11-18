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

