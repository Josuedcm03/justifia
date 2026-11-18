# Exploration: auth-route-tests

Goal: close RNF-01 (c) ("100% of protected routes and actions deny access to an unauthorized role, by URL and by direct request"). User scope decision: tests only for `src/app/(auth)/login`, `src/app/(auth)/register` and `src/app/(dashboard)/profile`; closing the open `/register` is a separate later change. Base: `main` c7c0c20.

## Current State

### 1. Entry-point recount

Main has 29 `page.tsx` and 7 `route.ts` (36 entry points; the thesis Anexo F counted 33 on e531a65). The three added since then have tests: `reports/page.tsx`, `reports/requests/page.tsx`, `api/reports/justifications/route.ts` (`route.test.ts`, `parity.test.tsx`). 33 of 36 have a colocated test; the missing three are still `(auth)/login/page.tsx`, `(auth)/register/page.tsx` and `(dashboard)/profile/page.tsx`.

### 2. Server actions

14 `"use server"` files under `src/app` (plus `src/i18n/locale.ts` outside it).

| File | Guard | Denial test |
| --- | --- | --- |
| `catalog/asignaturas`, `catalog/grupos` | `requireCatalogAccess()` | Yes (docente, estudiante, anonymous, flagged per action; `catalog/guards.test.ts` pins guard-first order) |
| `catalog/import` | `requireRole(...rolesUsuario)` + `canImportCatalog` | Yes |
| `coordination/[id]` | `rolesCoordinadores` | Yes |
| `enrollment`, `requests/new`, `requests/[id]/correct` | `rolesSolicitantes` | Yes |
| `review/[id]` actions, escalation-actions, remission-actions | `rolesRevisores` | Yes |
| `users/new` | `rolesQueCreanUsuarios` | Yes |
| `change-password` | `requireUserAllowingPasswordChange` | Yes |
| `login/actions.ts` | none (public by design) | Partial: session payload and logout; not invalid credentials, inactive account or `safeNext` |
| `register/actions.ts` | none (public by design) | No test file |
| `src/i18n/locale.ts` | none (public by design) | No test (outside `src/app`) |

Every protected action has a role-denial test; `register/actions.ts` is the only untested action file under `src/app`.

### 3. What "deny" means for the three targets

- Guard layers: the URL-level guard is the root `middleware.ts` (no `src/proxy.ts`; Next 16 deprecates the `middleware` name in favour of `proxy`); it has no test. Per-page guards live in `src/lib/auth/dal.ts`; `(dashboard)/layout.tsx` also calls `requireUser`.
- `/profile`: `requireUser()`; protected but not role-restricted, so all five roles may open it. Anonymous -> `/login`; flagged (`debeCambiarClave`) -> `/change-password`. No props; data keyed by `session.login`, so no cross-user read by URL. No `/denied` case: "unauthorized role" maps to unauthenticated or flagged here.
- `/login`: public (`getCurrentUser`); any signed-in user, flagged or not, is redirected to `/`. Anonymous gets `LoginForm` with `next` sanitized (`startsWith("/") && !startsWith("//")`, else `/`).
- `/register`: public, same page redirect; `listCarreras()` runs only after it. `registerAction` has no guard, has no `rol` field in its schema and always creates `rol: "estudiante"`; it does not verify the CIF and does not reject an already signed-in caller (that contract rests on the page redirect and middleware).

### 4. Patterns to copy

- Template: `reports/page.test.tsx` (lines 108-151): mocks `@/lib/auth/cookies` so the real `dal.ts` runs over a mocked `getSession`; the `redirect` mock throws `REDIRECT:<path>`; `it.each(rolesUsuario.filter(...))` for `ACCESS_DENIED_PATH`, anonymous for `/login`, flagged for `PASSWORD_CHANGE_PATH`; data mocks asserted `not.toHaveBeenCalled()`. `enrollment/page.test.tsx` has the same shape.
- Helpers: `review/test-support.tsx` (`sessionFor`, `serverIntl`, `messages`, `linkDouble`) and `src/test/*`.
- `change-password/page.test.tsx` mocks `dal` directly and adds a source-text pin.
- Vitest cannot render async server components natively (Next docs): tests call `await Page(props)` and render the returned element. Route tests use `// @vitest-environment node`; the global environment is jsdom.
- No central "every route has a test" or role-matrix test exists; only per-feature structure tests (`catalog/guards`, `coordination/structure`, `reports/structure`, `review/structure`, `requests/no-signals`).

## Affected Areas

- `src/app/(auth)/login/page.test.tsx` (new): authenticated redirect, `next` sanitization.
- `src/app/(auth)/register/page.test.tsx` (new): redirect before `listCarreras`, anonymous render.
- `src/app/(auth)/register/actions.test.ts` (new, if in scope).
- `src/app/(dashboard)/profile/page.test.tsx` (new): anonymous, flagged, per-role own data.
- `src/app/(auth)/login/actions.test.ts` (optional extension).
- Repo-wide ratchet test under `src/app/` (optional, new).
- `middleware.test.ts` (optional, new).
- `docs/roadmap.md`: no row for this change yet.
- No product file changes in the tests-only scope.

## Approaches

1. Three colocated page tests plus `register/actions.test.ts`. Pros: exactly the chosen scope; follows the one-test-beside-entry convention; no product risk. Cons: "100%" stays a manual claim; a future untested page passes silently. Effort: low, about 450-500 lines.
2. Approach 1 plus a repo-wide ratchet test that walks `src/app` and asserts every `page.tsx`/`route.ts` has a sibling test, every `"use server"` file has an actions test, and every `(dashboard)` page calls a guard. Pros: makes RNF-01 (c) provable and regression-proof; red until the targets exist (strict TDD). Cons: source-text checks prove shape, not behavior; needs an exemption list (`denied`, `privacy`, `login`, `register`). Effort: low-medium, about 570 lines.
3. Approach 2 plus `middleware.test.ts` (exported `middleware(request)` with `verifySession` mocked). Pros: covers the URL layer, which has zero tests. Cons: outside the three targets and the Anexo F counting unit; a later rename to `proxy.ts` forces a test update. Effort: medium, about 670 lines.

## Recommendation

Approach 2; the middleware test as a separate follow-up. All options fit one slice under the 1000-line review budget. Page tests pin existing behavior and pass at write time; only the ratchet test starts red, and the tasks must say so, so apply does not invent product code.

## Risks

- Open redirect (confirmed by the orchestrator with the WHATWG URL parser, not executed against the app): `safeNext` in `login/actions.ts` and the same rule in `login/page.tsx` accept `/\evil.com`, which starts with `/` and not `//`; `new URL("/\\evil.com", "https://host/login")` resolves to `https://evil.com/`. A test asserting the secure behavior fails today, so a tests-only change cannot ship it.
- Open `/register`: anyone with an unverified CIF can create a student account; the action never rejects a signed-in caller. Pinning today's behavior means the later change must edit those tests on purpose.
- Deactivated accounts keep access for up to 8 hours: `requireUser` trusts the JWT and never re-checks `activo`. Out of scope.
- `middleware.ts` has no test and its file name is deprecated in Next 16.
- `docs/roadmap.md` has no row; the specs must cite RNF-01 (c).

## Open Questions

1. Does `register/actions.ts` enter scope with characterization pins of today's behavior? Recommended: yes.
2. Add the repo-wide ratchet test? Recommended: yes.
3. `middleware.test.ts` now or as a follow-up? Recommended: follow-up.
4. Open redirect: fix here, fold into the `/register` hardening change, or record as `it.todo`?
5. Extend `login/actions.test.ts` with invalid credentials, inactive account and `safeNext`? Optional; not a role-denial gap.

## Ready for Proposal

Yes, once questions 1-4 are answered.
