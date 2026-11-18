# Design: Auth Route Tests

## Technical Approach

Tests plus one minimal product fix. The open redirect fix extracts one
pure helper, used by both login paths. Four colocated tests copy the
`reports/page.test.tsx` pattern: the real `dal.ts` over a mocked
`getSession`, and a `redirect` that throws `REDIRECT:<path>`. A source-text
ratchet and a table-driven denial matrix share one tree inventory. The
matrix runs every protected entry point with 7 identities through the real
guard. Every collaborator past the guard is a tripwire. Covers RNF-01 (c).
Capabilities: `auth-entry-access` and `route-access-coverage`.

Evidence read: `src/lib/auth/dal.ts`, `routes.ts`, `permissions.ts` and
`catalog-access.ts`, every `page.tsx`, `route.ts` and `"use server"`
file, `env.ts`, `db/index.ts`, `vitest.config.mts`, and the Next 16 docs.
Per `functions/redirect.md` and `guides/redirecting.md`, `redirect`
throws `NEXT_REDIRECT` in Server Components, Route Handlers and Server
Functions. Code after the throw does not run, so a throwing mock is
faithful.

## Architecture Decisions

| # | Topic | Options | Tradeoff | Decision |
|---|---|---|---|---|
| D1 | Where the `next` rule lives | Inline in both files / `src/lib/auth/safe-next.ts` | Inline already drifted into two copies | `src/lib/auth/safe-next.ts` next to `routes.ts`, no `server-only` |
| D2 | `next` rule | Denylist of patterns / allowlist of shape | A denylist misses variants | Allowlist (see Interfaces) |
| D3 | How the matrix proves "no read before denial" | One spy per `@/lib/data/*` module / tripwires at the I/O roots | Per-module mocks for ~30 pages are unbounded | Tripwires: `@/db` (Proxy), `next-intl/server`, `@/lib/intake/deps`, `@vercel/blob/client` |
| D4 | Matrix file layout | One file / pages, routes and actions files | One file means one worker and a cold transform of ~60 modules | Three files: parallel workers; routes use the `node` env like the existing route tests |
| D5 | Module isolation | `vi.resetModules` per identity / load once per row | A reset costs 7× the transforms; the mocks hold no state | Load once in `beforeAll` (timeout 120 s); reset the spies in `beforeEach` |
| D6 | How modules load | One import thunk per row / `import.meta.glob` lazy loaders | Thunks add about 100 lines and still need a tree check | `import.meta.glob` (lazy); a table row with no loader fails |
| D7 | Shared mocks | `vi.mock` block repeated in 3 files / `installAccessMocks()` using `vi.doMock` in the harness | Repetition costs about 50 lines | `vi.doMock` before any dynamic import. Fallback: repeat the hoisted `vi.mock` block |
| D8 | Tree walkers | Ratchet walker and matrix walker / one `inventory.ts` | Two walkers drift apart | One fs walker. The ratchet alone checks tree = table + public exemptions. The matrix only executes rows |
| D9 | Allowed sets | Import policy constants / literal role lists | Constants make the oracle tautological | Literals: the table is an independent spec of the policy |
| D10 | Action granularity | Per file / per exported function | Per-file rows hide a new unguarded export | A row per file lists its `exports`. The actions matrix asserts the runtime function exports equal that list |
| D11 | Cron routes | Exempt / rows with allowed = none | An exemption hides that a session cannot call them | Rows with allowed = none: every identity without the bearer secret gets 401 |
| D12 | `api/intake/documents/[id]` | Role rows / anonymous and flagged only | Role access is scoped by data (`canViewDocument`); its own `route.test.ts` covers that | All 5 roles allowed; anonymous and flagged denied with 401 |

## Data Flow

```
matrix test --setIdentity--> getSession mock
     |                            |
     +--invoke(row)--> entry module --> REAL dal / catalog-access
                                        |-- denied --> redirect() throws REDIRECT:<path>
                                        |              or Response 401/403/400
                                        +-- admitted --> db / intl / deps / blob tripwire
                                                         throws PAST_GUARD:<name>
assert: denied   => outcome == expected AND tripwire not called
        admitted => outcome is not a denial
```

## Interfaces / Contracts

```ts
// src/lib/auth/safe-next.ts
export function safeNextPath(value: unknown): string; // returns value or "/"
```

The helper accepts the value only when it is a non-empty string, starts
with `/`, does not start with `//`, and contains no `\` and no control
character (`/[\u0000-\u001F\u007F]/`). Any other value returns `/`, which
covers schemes (`https:`, `javascript:`), bare hosts, `null`, arrays and
numbers.

- Accepted values: `/`, `/requests?x=1` and `/review/12#top`.
- Rejected values: `""`, `//evil.com`, `/\evil.com`, `\evil.com`,
  `/\t/evil.com` (a raw tab; browsers strip it and resolve `//evil.com`),
  `https://evil.com`, `javascript:alert(1)`, `null`, `["/a"]` and `42`.
- The encoded `/%2F%2Fevil.com` stays accepted: it is a same-origin path,
  which the property check proves.
- Property check in the test: every accepted value satisfies
  `new URL(v, "https://app.test/login").origin === "https://app.test"`.

`login/actions.ts` drops its local `safeNext`. Both files call
`safeNextPath`: the action passes `formData.get("next")` and the page
passes the `next` search param.

```ts
// src/test/access/matrix-table.ts (data only; no entry imports)
type Identity = RolUsuario | "anonymous" | "flagged";
type Outcome = { redirect: string } | { status: number; error: string };
type Row = {
  allowed: readonly Identity[];
  denial?: Partial<Record<"anonymous" | "flagged" | "role", Outcome>>; // default: dal
};
export const PAGES: Record<string, Row>;                 // key: path under src/app
export const ROUTES: Record<string, Row & { method: "GET" | "POST" }>;
export const ACTIONS: Record<string, Row & { exports: readonly string[] }>;
```

- **Default dal denial:** anonymous gets `/login`, flagged gets
  `PASSWORD_CHANGE_PATH`, and any other role gets `ACCESS_DENIED_PATH`.
- **Flagged identity:** its role is `allowed[0]` (or `administrador` when
  no role is allowed). This attributes the denial to the flag alone.
- **Invocation:**
  - Page: `await mod.default({ params: P({ id: "1", grupoId: "1" }), searchParams: P({}) })`.
  - Route: `await mod[method](new Request(url, { method, body }), { params: P({ id: "1" }) })`.
  - Action: `await mod[name]({}, new FormData())`. The guard is the first
    statement of every action, so the arguments are irrelevant to the
    denial.

**Inventory** (base c7c0c20). Totals: 25 protected pages, 7 routes and 30
protected actions, for N = 62 entry points × 7 identities = 434 cases. Of
these, 320 are denials and 114 are admissions.

| Group | Entries | Allowed | Denial |
|---|---|---|---|
| `(home)`, `profile` pages | 2 | 5 roles | dal |
| Catalog pages (7), asignaturas actions (3), grupos actions (3) | 13 | admin, coordinación, secretaría (`requireCatalogAccess`) | dal |
| `catalog/import` page, `previewAction`, `applyAction`, `api/catalog/template` | 4 | secretaría (`canImportCatalog`; otherwise a redirect to `/denied`) | dal |
| Coordination pages (2), `answerEscalationAction` | 3 | coordinación | dal |
| Reports pages (2), `api/reports/justifications` | 3 | coordinación | dal |
| Enrollment page, `enrollAction`, `dropAction` | 3 | estudiante | dal |
| Requests pages (5), `requests/new` actions (6), `[id]/correct` actions (5) | 16 | estudiante | dal |
| Review pages (2), `decideAction`, escalation actions (3), remission actions (2) | 8 | secretaría | dal |
| Users pages (2), `createStaffAction` | 3 | admin, coordinación, secretaría | dal |
| `change-password` page and `changePasswordAction` | 2 | 5 roles + flagged | dal (anonymous only) |
| `api/intake/upload-token` POST | 1 | estudiante | anonymous 401 `unauthorized`; flagged and roles 403 `forbidden` |
| `api/review/special-format-token` POST | 1 | secretaría | anonymous 401; flagged 403 `forbidden`; roles 400 `not_allowed` |
| `api/intake/documents/[id]` GET | 1 | 5 roles | anonymous and flagged 401 `unauthorized` |
| `api/cron/intake-sweep`, `api/cron/remission-retry` GET | 2 | none | 401 `unauthorized` for all 7 identities (no bearer secret) |

Every protected action guards before reading its body, and its denial is
the guard's redirect, never a returned error state. Escalation actions
reach the guard through `authorize()`, correction actions through
`correctionOf`, intake actions through `currentStudentId`, and enrollment
actions through `run`. Each helper redirects before any `try`.

`src/test/access/inventory.ts`:

- `listAppEntries()` walks `src/app` with `readdirSync` and returns posix
  paths of `page.tsx` and `route.ts` files, plus every file whose first
  statement is `"use server"`.
- `PUBLIC_ENTRY_POINTS: Record<path, reason>` exempts `(auth)/login/page.tsx`,
  `(auth)/register/page.tsx`, `denied/page.tsx`, `privacy/page.tsx`,
  `(auth)/login/actions.ts` and `(auth)/register/actions.ts`, each with
  its reason.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `safeNextPath` | Table-driven test plus the URL-origin property check |
| Unit | `loginAction` | One added case: `next=/\evil.com` gives `REDIRECT:/` |
| Integration | `login/page` | Every role and flagged give `REDIRECT:/`. Anonymous: `el.props.next` per `next` case, with no render |
| Integration | `register/page` | Signed-in identities give `REDIRECT:/` with `listCarreras` not called. Anonymous gets `props.carreras`; `listCarreras` runs after `getSession` (`invocationCallOrder`) |
| Integration | `profile/page` | Anonymous gives `/login` and flagged gives `/change-password`, with no reads. For each role (`it.each`): renders own data, and `getUsuarioByLogin` is called only with the session login |
| Integration | `register/actions` (characterization) | Posting `rol=administrador` still yields `rol:"estudiante"` in both `createUsuario` and `signSession`. No guard runs and `getSession` is never called (forbidden spies). The CIF is stored as posted with no lookup. Also covers the mismatch, invalid, unknown-carrera and duplicate error keys. Named "pins; roadmap 0.6 edits these" |
| Structural | Ratchet `src/app/route-coverage.test.ts` | Checks sibling tests, an actions test per `"use server"` file, and that a guard is the first `await` in each `(dashboard)` page. Exemptions must exist and give reasons. Tree minus public entries must equal the table keys, with missing and stale entries listed. The describe title shows `${N} entry points x 7 identities` |
| Behavioral | `src/app/access-matrix.{pages.test.tsx,routes.test.ts,actions.test.ts}` | Expands rows × identities. Each file's title carries its subtotal and denial count |

**TDD order** (each commit is green):

1. RED: `safe-next.test.ts` and the added `loginAction` case. GREEN: the
   helper and the wiring in `actions.ts`.
2. RED: `login/page.test.tsx` (the backslash case). GREEN: the page uses
   the helper.
3. RED: the ratchet (it lists the 4 missing tests and the missing table).
   Then add the `register/page`, `profile/page` and `register/actions`
   tests; these characterization pins are green at write.
4. Add the harness, the table and the 3 matrix files, plus the ratchet's
   table check; the ratchet turns green.
5. At archive: add a `docs/roadmap.md` row.

## File Changes

| File | Action | Est. lines |
|---|---|---|
| `src/lib/auth/safe-next.ts` | Create | 22 |
| `src/lib/auth/safe-next.test.ts` | Create | 60 |
| `src/app/(auth)/login/actions.ts` | Modify | 10 |
| `src/app/(auth)/login/actions.test.ts` | Modify | 20 |
| `src/app/(auth)/login/page.tsx` | Modify | 6 |
| `src/app/(auth)/login/page.test.tsx` | Create | 75 |
| `src/app/(auth)/register/page.test.tsx` | Create | 65 |
| `src/app/(auth)/register/actions.test.ts` | Create | 115 |
| `src/app/(dashboard)/profile/page.test.tsx` | Create | 95 |
| `src/test/access/inventory.ts` | Create | 65 |
| `src/app/route-coverage.test.ts` | Create | 95 |
| `src/test/access/matrix-table.ts` | Create | 130 |
| `src/test/access/harness.ts` | Create | 110 |
| `src/app/access-matrix.pages.test.tsx` | Create | 30 |
| `src/app/access-matrix.routes.test.ts` | Create | 35 |
| `src/app/access-matrix.actions.test.ts` | Create | 45 |
| `docs/roadmap.md` | Modify (archive) | 2 |
| **Total** | | **≈ 980 (range 930–1060) against the 1000 budget. At the edge: flag it** |

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A: no file classification or execution |
| Git repository selection, commit, push, PR commands | N/A: no VCS or PR automation |

The redirect-target boundary falls outside these rows. Its adversarial
cases are the rejected values listed under Interfaces, and their RED test
is `safe-next.test.ts`.

## Migration / Rollout

No migration required. No schema changes, no data, no flags. Roll back by
reverting the commits.

## Open Questions

- [ ] Delivery: the forecast (≈980 lines, range 930–1060) sits at the 1000
      budget. Decide between one PR, accepting the overrun if it happens,
      and two stacked PRs: (1) the fix, the 4 tests and the ratchet without
      the table check, and (2) the matrix and the table check.
