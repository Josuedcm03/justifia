```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ca8a5b4498d5541cd1836b806e129beda9822613a51094af064683aeff57e14e
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 11/11
scenarios: 18/18
test_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test
test_exit_code: 0
test_output_hash: sha256:a614dee266a79a36afe2c7b23f4ce35ede6d47959d9d1f94dd4fba1c89b744cd
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:67d1fc6f094cf715091e7d1a2d3052f1850098c09943bd7fa81afbe386e92a94
```

## Verification Report

**Change**: auth-route-tests
**Version**: N/A (two new capabilities, all ADDED: `auth-entry-access`, `route-access-coverage`)
**Mode**: Strict TDD (vitest, `npm test`)
**Branch / HEAD**: `feat/auth-route-tests` at 428122a (base main c7c0c20). Verified commits: 5e68ea3 (planning), cab684b, 4f9ec5e, 5a2c916, efe47ca, 428122a. The working tree was clean before and after every check.

Evidence notes: `evidence_revision` is the sha256 of `git ls-tree -r HEAD` at 428122a. `build_command` is `npm run typecheck` (`tsc --noEmit`) because the brief forbids `next build`; no production build was run. Counts: 11 requirements (AEA-1..4, RAC-1..7) and 18 scenarios (AEA 2+2+3+2, RAC 2+1+1+2+1+1+1). Judgement call, stated openly: scenario AEA-3 "Same rule in page and action" has no action-level test for `//evil.com` (only for the backslash form). I counted it complete because the behavior is proven by composition (the helper test covers `//evil.com`, and the action backslash test, red against the old local rule, proves the action redirects to the helper output), and I recorded the missing direct row as SUGGESTION 5, not as a gap that blocks archive.

In this file `<BS>` stands for one backslash character (written out so tooling does not read the inputs as paths).

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 39 (phases 0-4: 36, phase 5: 3) |
| Tasks complete | 36 |
| Tasks incomplete | 3 (5.1, 5.2, 5.3) |

Phases 0-4 are fully checked and match the code state (every file named in the tasks exists; the 16 changed `src` files equal the design file list; size 1208 added + 12 deleted = 1220 changed lines, `openspec/` and `.engram/` excluded). Phase 5 (roadmap row, thesis flag, spec sync) is archive-time by design, so pending is expected and not a finding. The 1220 lines exceed the 1000-line review budget under the owner's accepted `size:exception` (hard cap 1250, 30 lines of margin); that is cited, not a finding.

### Build & Tests Execution
**Typecheck (build gate)**: PASS, `npm run typecheck`, exit 0, no errors.

**Focused run**: PASS, exit 0.
```text
DATABASE_URL=postgres://u:p@127.0.0.1:9/x npx vitest run src/lib/auth src/app/access-matrix src/app/route-coverage.test.ts "src/app/(auth)" "src/app/(dashboard)/profile" --reporter=default
 Test Files  16 passed (16)
      Tests  795 passed (795)
access matrix total:   62 entry points x 7 identities = 434 cases, 320 denied, 114 admitted
access matrix routes:   7 entry points x 7 identities = 49 cases, 40 denied, 9 admitted
access matrix actions: 30 entry points x 7 identities = 210 cases, 161 denied, 49 admitted
access matrix pages:   25 entry points x 7 identities = 175 cases, 119 denied, 56 admitted
```
The figure lines are printed through `console.info`; they appear with `--reporter=default` or `verbose`, not under the non-TTY reporter of plain `npm test`. The describe titles carry the same numbers.

**Full suite**: PASS, `DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test`, exit 0: 350 files, 8343 tests passed, 0 failed, 0 skipped, duration 228.05 s. No flaky timeout in `src/lib/signals/evaluate.test.ts` appeared in this run.

**Lint and format on the 16 changed `src` files**:
- `npx eslint`: exit 1, 228 errors, all of them `Delete ␍` (prettier/prettier) on the three modified files that are CRLF working copies (`login/actions.ts`, `login/page.tsx`, `login/actions.test.ts`) because `core.autocrlf=true`. The committed blobs of those files contain 0 CR characters. With the documented filter (`rg -v 'Delete .␍.'`) there are 0 findings. This is environment noise, per the precedent in `tasks.md`, not a quality finding.
- `npx prettier --check`: 3 warnings (the same three CRLF files); `npx prettier --check --end-of-line auto`: all files clean.

**Coverage**: Not available (`@vitest/coverage-*` is not installed); changed-file coverage analysis skipped. Not a failure.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | "TDD Cycle Evidence" tables for units 1-3 and unit 4 in `apply-progress.md` |
| All tasks have tests | ✅ | 12/12 evidence rows name a test file; all exist |
| RED confirmed (tests exist) | ✅ | 12/12 test files exist; 5 rows are labelled characterization (pass at write) and are paired with mutation checks |
| GREEN confirmed (tests pass) | ✅ | 12/12 files pass in the focused and full runs |
| Triangulation adequate | ✅ | safe-next 4 accepted + 10 rejected + origin property; login page 7 `next` cases + 10 identities; 62-row matrix |
| Safety net for modified files | ✅ | modified test-bearing files (`login/actions.test.ts` 5/5, `route-coverage.test.ts` 82/82) record a safety net; new files record N/A (new) and are new |

**TDD Compliance**: 6/6 checks passed. Caveat: each work unit is committed as one commit (tests plus code, per `work-unit-commits`), so git history cannot re-prove the RED step; it rests on the apply report, which quotes the RED messages. I compensated with four independent mutation checks (below) that prove the tests can fail.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 28 (`safe-next` 15, `login/actions` 6, `register/actions` 7) | 3 | vitest |
| Integration | 36 (`login/page` 18, `register/page` 11, `profile/page` 7; real `dal.ts`, mocked session, `profile` rendered with testing-library) | 3 | vitest, testing-library |
| Structural | 85 (`route-coverage.test.ts`, source text and tree) | 1 | vitest |
| Behavioral matrix | 435 (`pages` 175, `routes` 49, `actions` 211 = 210 cases + exports check) | 3 | vitest |
| E2E | 0 | 0 | not installed |
| **Total** | **584** | **10** | |

584 plus the 211 pre-existing tests in the same folders equals the 795 of the focused run.

### Assertion Quality
Scanned all 10 test files and the three support files (`harness.ts`, `inventory.ts`, `matrix-table.ts`).

**Assertion quality**: 0 CRITICAL, 0 WARNING. No tautologies, no assertions without a production call, no mock-heavy files. Ghost loops checked: the loop in `safe-next.test.ts` is preceded by a `toHaveLength` guard; the matrix loops over a table that the ratchet forces to equal the tree (an empty table would fail RAC-5 `missing`). Two observations (SUGGESTION level, see below): the admitted branch of the matrix asserts only "not a denial", and the figure test asserts `denied > 0`, which is loose but backed by the per-case tally in `afterAll`.

### Quality Metrics
**Linter**: ⚠️ only CRLF working-copy noise (see above); 0 real findings.
**Type Checker**: ✅ No errors.

### Independent re-check of the open-redirect fix (AEA-3)
Method: the committed `src/lib/auth/safe-next.ts` was copied unchanged to the scratchpad and run on Node 24.11.1 against the WHATWG URL parser, `new URL(output, "https://h/login")`. Inputs were built with `String.fromCharCode` so no escaping layer could alter a backslash.
- Spec-rejected inputs return `/` (20 of 20): `""`, `//evil.com`, `/<BS>evil.com`, `<BS>evil.com`, `https://evil.com`, `null`, `undefined`, an array, `42`, an object, a bare host, plus extra probes (`/` + tab, newline, CR, NUL or DEL + `/evil.com`, `///evil.com`, `/<BS><BS>evil.com`, `/<BS>/evil.com`, `javascript:alert(1)`).
- Accepted inputs stay unchanged and same-origin: `/`, `/requests?x=1`, `/review/12#top`, `/%2F%2Fevil.com`, `/%5Cevil.com`, `/.//evil.com` (resolves to `https://h//evil.com`), `/@evil.com`, and `/` + space, no-break space or U+2028 + `/evil.com`.
- Exhaustive fuzz: 159,744 strings of the form `/` + char(0..0x2FFF) + one of 13 second characters + `evil.com`, plus 12,288 strings `/` + char + `/evil.com`: zero outputs resolve to another origin (110,277 of the first group were accepted and stayed same-origin).
- Consumers: `login/page.tsx` and `login/actions.ts` both call `safeNextPath` (the only two readers of `next`; `login-form.tsx` only echoes the already sanitised value into a hidden field). The old local `safeNext` is gone.

### Own mutation checks (revert-only; each restored with `git restore`, tree confirmed clean after each)
| Mutation | Result |
|----------|--------|
| M1: `(dashboard)/users/page.tsx` guard narrowed to `requireRole("administrador","coordinacion")` (secretaria removed) | FAIL as required: `(dashboard)/users/page.tsx as secretaria must be admitted, got redirect /denied`; `afterAll` tally admitted 55 instead of 56; run exit 1 |
| M2: `(dashboard)/review/page.tsx` guard widened with `"docente"` | FAIL as required: `as docente must be denied`, expected redirect /denied but the page threw `PAST_GUARD:intl` (it was admitted past the guard); printed denied count fell to 118 |
| M3: delete `(dashboard)/reports/page.test.tsx` | FAIL as required (RAC-1): `no test next to (dashboard)/reports/page.tsx` |
| M4: drop the `users/new/page.tsx` row from the table | FAIL as required (RAC-5): `missing` lists the page |

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| AEA-1 | Signed-in identity (5 roles + flagged) | `login/page.test.tsx > LoginPage signed-in identity > sends %s to /` (5) and `sends a flagged %s to / too` (5); `register/page.test.tsx > sends %s to / without reading the careers` (5) and `sends a flagged %s ...` (5, `listCarreras` not called) | ✅ COMPLIANT |
| AEA-1 | Anonymous visitor | `login/page.test.tsx > renders the form with no redirect`; `register/page.test.tsx > gives the form the careers, read after the session check` | ✅ COMPLIANT |
| AEA-2 | Anonymous and flagged | `profile/page.test.tsx > sends an anonymous caller to /login with no profile read`; `> sends a flagged caller to the change screen with no profile read` | ✅ COMPLIANT |
| AEA-2 | Own data per role | `profile/page.test.tsx > shows %s only the profile of the session login` (5 roles, `getUsuarioByLogin` called once with `session.login`) | ✅ COMPLIANT |
| AEA-3 | Accepted values | `safe-next.test.ts > keeps the same-origin path %s unchanged` (4 values) | ✅ COMPLIANT |
| AEA-3 | Rejected values | `safe-next.test.ts > falls back to / for %s` (10 values) and `only ever resolves to the application origin`; independently re-checked above | ✅ COMPLIANT |
| AEA-3 | Same rule in page and action | Page: `login/page.test.tsx` (`//evil.com`, backslash, absolute, array cases). Action: `login/actions.test.ts > redirects to / when the next target starts with a backslash (AEA-3)`. The action has no direct `//evil.com` case | ✅ COMPLIANT by composition (see SUGGESTION 5) |
| AEA-4 | Role is always `estudiante` | `register/actions.test.ts > creates an estudiante even when the form posts rol=administrador` (`createUsuario` and `signSession`) | ✅ COMPLIANT |
| AEA-4 | No guard, no CIF verification | `register/actions.test.ts > runs no guard and never reads the session`; `> stores the CIF as posted, with no lookup of it` | ✅ COMPLIANT (see SUGGESTION 4) |
| RAC-1 | Missing test | `route-coverage.test.ts > RAC-1 ... %s has a sibling test` (50 entries); M3 proves it fails naming the file | ✅ COMPLIANT |
| RAC-1 | Complete tree | same tests, passing on the current tree | ✅ COMPLIANT |
| RAC-2 | Unguarded dashboard page | `route-coverage.test.ts > RAC-2 ... %s awaits a guard before anything else` (24 pages) and `reads the guard out of a guarded source and rejects the rest` (synthetic late and missing guard) | ✅ COMPLIANT |
| RAC-3 | Exemption without reason or stale | `route-coverage.test.ts > RAC-3 %s exists and says why it is public` (6 entries; the message names the entry) | ✅ COMPLIANT |
| RAC-4 | Unauthorized identity (table-driven) | `access-matrix.{pages,routes,actions}.test.*` (320 denials, each asserting the exact outcome and an untouched tripwire); M1 and M2 | ✅ COMPLIANT |
| RAC-4 | Allowed identity | same files (114 admitted cases assert "no denial") | ✅ COMPLIANT |
| RAC-5 | Drift in either direction | `route-coverage.test.ts > RAC-5 ... the table lists every protected entry point and nothing else` (missing and stale lists); M4 | ✅ COMPLIANT |
| RAC-6 | No secret | matrix cron rows (`api/cron/intake-sweep`, `api/cron/remission-retry`: 7 identities each, 401 `unauthorized`, no tripwire); wrong-secret cases live in the existing cron `route.test.ts` files | ✅ COMPLIANT |
| RAC-7 | Figure reported | `afterAll` in each matrix file (`expect(tally).toEqual({denied, admitted})`) plus the printed figure lines above | ✅ COMPLIANT |

**Compliance summary**: 18/18 scenarios compliant (one by composition, AEA-3 "Same rule in page and action"), 0 failing, 0 untested.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| AEA-1 | ✅ Implemented | `login/page.tsx` redirects any session (flagged included) to `/`; the register page is pinned by characterization |
| AEA-2 | ✅ Implemented | pinned; `profile` has no `/denied` case |
| AEA-3 | ✅ Implemented | one helper, two call sites; allowlist as designed (non-string, no leading `/`, `//`, backslash and control characters all give `/`) |
| AEA-4 | ✅ Implemented | characterization only, titled "pins; roadmap 0.6 edits these" |
| RAC-1..3 | ✅ Implemented | one tree walker (`inventory.ts`), 6 reasoned exemptions, guard-first-await check with `requireCatalogAccess` as the named helper |
| RAC-4..7 | ✅ Implemented | 62 rows (25 pages, 7 routes, 12 action files with 30 exports); each route file exports exactly one handler and the table lists it; no inline `"use server"` exists in `src` |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1/D2 helper location and allowlist | ✅ Yes | `src/lib/auth/safe-next.ts`, no `server-only`, allowlist |
| D3 tripwires at the I/O roots | ✅ Yes | `@/db` Proxy, `next-intl/server`, `@/lib/intake/deps`, `@vercel/blob/client` |
| D4 three matrix files | ✅ Yes | separate workers, 4-6 s each |
| D5/D6/D7 load once, `import.meta.glob`, `vi.doMock` | ✅ Yes | no hoisted fallback needed; `/// <reference types="vite/client" />` added in each matrix file |
| D8 one walker | ✅ Yes | |
| D9 literal allowed sets | ✅ Yes | the table imports no policy constant |
| D10 exports per action file | ✅ Yes | exports check in the actions matrix |
| D11 cron rows allowed none | ✅ Yes | |
| D12 documents `[id]` anonymous and flagged only | ✅ Yes | the five roles are "admitted"; object scope stays in its own `route.test.ts` |
| Deviations recorded in apply-progress | ✅ Acceptable | the login page crashed on a repeated `next`; fixed by the helper and `searchParams` widened to `string or string[]`; the ratchet lists 3 missing tests, not 4; the sibling-test rule also covers public entries; the RAC-2 check is the stricter "first await" |

### Does the matrix answer the thesis objection (5.3, "no se comprobo cada ruta con cada rol")?
RNF-01 (c): "100% of protected routes and actions deny an unauthorized role, by URL and by direct request."

**Answer**: yes for role-based denial at the handler level, with caveats on wording. Evidence: 62 entry points (25 pages, 7 route handlers, 30 exported server actions in 12 files) x 7 identities (5 roles, anonymous, flagged) = 434 cases; 320 are denials, each asserted individually against the exact documented outcome (anonymous `/login`, flagged `/change-password`, other role `/denied`, or the route 401/403/400) with a tripwire proving no data module was reached; 114 are admissions. The oracle is literal (D9), and RAC-5 plus RAC-1 force the table to equal the tree, so an entry point added later cannot escape unnoticed. Four mutations of mine (and ten recorded in apply-progress) show the matrix fails when a role is added or dropped or a guard is bypassed. That is exactly "each route with each role".

Limits to cite when quoting the figure: the matrix calls each page as a function, each route with a `Request` and each action directly, all through the real `dal.ts`; it does not drive HTTP routing, so "by URL" holds at the page-guard level and not through `middleware.ts`. Entry points and identities not covered:

| Item | Covered? | In scope of RNF-01 (c)? |
|------|----------|-------------------------|
| 25 pages, 7 routes, 30 actions x 7 identities | Yes (matrix) | In scope, covered |
| `/login`, `/register`, `denied`, `privacy` pages and the login and register actions | Behavior pinned by AEA tests (login and register); each has a sibling test (RAC-1); exempt with a written reason | Public by design; in scope as "no denial expected" |
| `middleware.ts` at the repo root (first layer for page URLs: anonymous redirect with `next`, `/login` and `/register` bounce, public pages; excludes `/api`) | No test (only `public-paths.test.ts` for the allowlist helper) | In scope for the literal "by URL"; known follow-up (task 5.1). Pages stay denied by their own guard (ratchet RAC-2), so authorization does not depend on it, but the claim must not say "end to end" (WARNING 2) |
| `src/app/(dashboard)/layout.tsx` (calls `requireUser`) | No test; the ratchet inspects `page.tsx` only | Out of scope: not an addressable entry point and a second layer; every page guards itself. SUGGESTION 2 |
| `src/i18n/locale.ts` (`"use server"`: `getUserLocale`, `setUserLocale`) | No test, outside the walker (`src/app` only) | Out of the access purpose (preference cookie, no protected data, public by nature) but inside the literal wording of RAC-1 (WARNING 1) |
| Object-level access in `api/intake/documents/[id]` (`canViewDocument`: owner, secretaria scope, coordinator career) | The matrix covers anonymous and flagged only (D12); the five roles are "admitted" | Out of the role matrix by decision; covered by its own `route.test.ts` (another student gets the same 404 as an unknown id; secretaria, coordinator and none scope), verified by reading the test names |
| Other `[id]` pages (`requests/[id]`, `review/[id]`, `coordination/[id]`, `correct`) | Role gate only | Out of scope here; ownership and scope belong to their data modules and tests |
| Forged or expired token | Not in the matrix | Out: `session.test.ts` (11 tests) owns token verification |
| Deactivated account inside the JWT lifetime | No | Out of scope by the tasks (5.3 archive note) |
| Route methods other than the listed ones | n/a | Each of the 7 `route.ts` files exports a single handler, all listed |

### Issues Found
**CRITICAL**: None.

**WARNING**:
1. `src/i18n/locale.ts` is a `"use server"` file outside `src/app` with no test and not inventoried. RAC-1 says every `"use server"` file MUST have an actions test, and `listAppEntries()` only walks `src/app`, so this file, and any future `"use server"` file outside `src/app`, escapes the ratchet. Functionally it is outside the access purpose (it reads and writes a locale cookie; `setUserLocale` does not validate its argument at runtime, the value is whitelisted on read in `getUserLocale`). Either extend the walker to `src/**` and add the file as a reasoned public entry with a test, or narrow the RAC-1 wording to `src/app` when the spec is synced at archive.
2. The thesis wording "by URL" is satisfied only at the page-guard level. `middleware.ts` (first layer, anonymous `next` redirect, `/api` exclusion) has no test, so the figure should be quoted as "every page, route handler and exported server action, invoked through the real guard, denies each unauthorized identity", not as end-to-end HTTP. This matches the recorded follow-up (task 5.1); the owner decides whether RNF-01 stays "Parcial" (task 5.2).

**SUGGESTION**:
1. The matrix admitted branch only proves "not a denial" (a page that throws an unrelated error for an allowed role still counts as admitted). That is what RAC-4 "Allowed identity" requires; a positive-render check would be a later strengthening.
2. Add a small test for `(dashboard)/layout.tsx` (anonymous to `/login`, flagged to `/change-password`) and extend the RAC-2 ratchet to `layout.tsx`, as defence in depth.
3. The figure lines are `console.info`, hidden under the non-TTY reporter of plain `npm test`. Consider a dedicated npm script (for example `vitest run src/app/access-matrix src/app/route-coverage.test.ts --reporter=default`) so the thesis evidence is reproducible with one command. The 100% result itself is an assertion, not a print.
4. AEA-4 "with or without a signed-in caller": only the no-session variant is run; the forbidden `getSession` and guard spies prove the action never consults a session, so the signed-in variant follows by construction. A signed-in row would make it explicit.
5. AEA-3 "Same rule in page and action": the action is tested with the backslash value only; `//evil.com` is not asserted at action level (it is covered through the shared helper test and the page test). Adding one `it.each` row to `login/actions.test.ts` would make the scenario directly tested at both call sites.

Process notes (not findings): commit efe47ca was made with `--no-verify`; the repository `.githooks/pre-commit` only exports engram memory to `.engram/` and runs no lint or test, so nothing was skipped. The size exception (1220 of 1250) was accepted by the owner. Phase 5 tasks are pending by design. Merge gate: main auto-deploys to production, so merging still needs the owner explicit OK and the change branch must not be deleted.

### Verdict
PASS WITH WARNINGS

0 CRITICAL, 2 WARNING, 5 SUGGESTION: the 11 requirements are implemented, all 18 scenarios have a passing covering test (one by composition), typecheck and the full suite (350 files, 8343 tests) pass, the redirect fix holds against the WHATWG parser and the matrix fails under all four of my mutations; archive can proceed once the owner has read WARNINGs 1-2.
