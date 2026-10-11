# Apply progress: merge-grupo-into-asignatura

Plan: the 2026-10-10 plan (seven phases, seams A to E). The earlier destructive plan (work units M01 to M06) is void and was not merged.

Mode: Strict TDD, `npm test`. Artifact store: hybrid. Delivery: one PR with `size:exception`.

## Batch 1: Phase 0 (preflight) and Phase 1 (seam A, search by group)

### Phase 0

- 0.1 Read the Next.js docs relevant to Phase 0/1 scope: `redirects.md` (query values pass through to the destination, `permanent: false` is 307, `has`/`missing` objects) and the "Execution order" of `proxy.md` (config `redirects` run before Proxy). No contradiction of UG-1, UG-3 or UG-4 found at reading level. `dynamic-routes.md`, `redirect.md`, `not-found.md`, `revalidatePath.md` were not read in full; they are needed from Phase 2 and must be read there.
- 0.2 Baseline on HEAD: `npm test` 143 files, 2848 tests, all passed (no failure, so the known flaky set did not fail). `npm run typecheck` clean.
- 0.3 Saved: `rg -c "catalog/grupos" src` totals 74 occurrences in 20 files (same as the plan). `rg -n '"/catalog/grupos' src` prints nothing (no quoted route literal in `src` today); the baseline is in the scratchpad, not in the repo.
- 0.4 Answers: `parseRecordId` is in `src/lib/validations/catalog.ts` and uses `RECORD_ID_RE = /^[1-9][0-9]{0,14}$/` (positive integer, 1 to 15 digits, no leading zero). `GrupoListItem` carries `asignaturaId`, `asignaturaCodigo`, `asignaturaNombre`. `revalidateRecord(listPath, id)` exists in `src/lib/catalog/action-helpers.ts:80`. The only test pinning "Select a subject" is `grupo-form.test.tsx:491` (`asignaturaId: "Select a subject"`), a fixture string; `i18n/en.json:289-290` holds the wording. Task 2.8/2.10 must update it.
- 0.5 is the owner's and stays unticked.

### Phase 1

| Task | Test file | RED | GREEN |
|---|---|---|---|
| 1.1 | `src/lib/data/asignaturas.test.ts` | 2 failed for the right reason (rendered `or(...)` had two members, no `exists`) | yes (1.2) |
| 1.2 | `src/lib/data/asignaturas.ts` | n/a | 68 passed |
| 1.3 | `src/lib/data/asignaturas.test.ts` | 9 failed (no third statement, no new fields) | yes (1.4) |
| 1.4 | `asignaturas.ts`, `types.ts`, `list-params.ts` | n/a | 76 passed, typecheck clean |
| 1.5 | `src/i18n/catalog-parity.test.ts` | 6 failed (keys missing, copy not naming docente/periodo) | yes (1.6) |
| 1.6 | `i18n/es.json`, `i18n/en.json` | n/a | 170 passed |
| 1.7 | `.../asignaturas/page.test.tsx` | 4 failed (no list rendered) | yes (1.8) |
| 1.8 | `.../asignaturas/page.tsx` | n/a | 40 passed |
| 1.9 | refactor and V | n/a | see V below |

Notes on RED:
- In 1.1 four tests were added or rewritten; two failed. The B7 pin (no `NumeroGrupo`, no `Dias`, no group `Activo`) and the scope-none pin passed before the code existed. They are guards (they pass on the old predicate and must keep passing), so they are not RED; they protect against a regression of B7/U9 and of scope handling in the new `exists`. No mutation run to prove them.
- X6: no page-level fixture exists for the "group number does not match" scenario (`page.test.tsx` rows use `grupos: null`), so only the data-layer pin applies.

### What was implemented

- `grupoMatchesTerm(pattern)` (module-private) and a correlated `exists (select 1 from "Grupo" inner join "Usuario" ...)` as third member of the `or(...)` in `buildAsignaturasWhere`. Count and page still share the one `where`.
- A third, non-exported statement `listMatchingGrupos` inside the same `try` of `listAsignaturas`, only when `q` is set and the page has rows. Selects id, asignaturaId, periodo, numeroGrupo, docente name and `Activo`; filters with `inArray`, `asignaturaInScope(scope)` and `grupoMatchesTerm`; ordered by `AsignaturaId`, `Periodo` desc, `NumeroGrupo`, `Id`. Grouped in code: first `ASIGNATURA_MATCHES_MAX = 3` kept, all counted in `gruposCoincidentesTotal`.
- `AsignaturaGrupoMatch`, `gruposCoincidentes`, `gruposCoincidentesTotal` in `types.ts`; `ASIGNATURA_MATCHES_MAX` in `list-params.ts`.
- i18n (both locales): `catalog.asignaturas.matches.{label,item,itemInactive,more}`; reworded `search.label`, `search.placeholder`, `noResults.hint`.
- Page: matches list (`<ul aria-label>`, `text-label text-muted-foreground`, `gap-1`, text only) in the Name cell; nothing when there are no matches; `+N more` as a last `<li>` when the total exceeds three.

### V results (end of batch)

- `npm test`: 143 files passed, 2868 tests passed (baseline 2848, +20).
- `npm run typecheck`: clean.
- Lint on the 7 changed source files, Windows-safe form `npx eslint <files> | rg -v "Delete .␍."`, then `rg "\berror\b"`: prints nothing.
- Intake and request suites (`src/lib/intake`, `requests`, `solicitudes`, `inscripcion-writes`, `intake-sweep`, `grupo-dias`, `enrollment`): 33 files, 349 tests passed.
- Focused (asignaturas data, asignaturas page, catalog-parity, list-params): 4 files, 305 tests passed.
- No build (no route change, as the task states).

### Deviations and decisions

1. A full-suite run caught `src/lib/data/scope-inventory.test.ts`, which pins the title "combines scope, state and search with AND" inside the `buildAsignaturasWhere` describe. My first rewrite of that test renamed it; I restored the exact title (the test file `scope-inventory.test.ts` was not edited).
2. Existing `listAsignaturas` tests in `asignaturas.test.ts` that use `q: "mat"` now see three statements. Two were adapted: "uses one where..." expects 3 statements; "aggregates the distinct, ordered numbers..." now calls with `q: ""` so its `toHaveLength(2)` still holds. The `params` helper gained an optional `q` argument. "returns the page..." expects the two new fields as empty.
3. The third statement orders by `"Grupo"."AsignaturaId"` rather than the Asignatura code (the design says "ordered Asignatura"); either groups rows per Asignatura and the code groups in a Map, so the order across Asignaturas is irrelevant. Pinned in the test.
4. `more` is `{count, plural, other {+# more}}` (es: `+# más`); the page passes `total - 3`. The spec scenario "+2 more" for five groups holds.
5. `prettier --end-of-line crlf --write` was used on the changed files to keep the working-tree CRLF and clear real prettier errors. Line endings of the files were preserved (CRLF). One file briefly lost CRLF through a `sed -i` and was restored.
6. Task 1.4's instruction to update fixtures in `page.test.tsx` was applied to the `row()` helper (it returns a loose record, so typecheck did not require it).

### Observations for later phases

- `parseRecordId` accepts `^[1-9][0-9]{0,14}$`, not "digits only". Task 2.1 says the redirect `has` value "accepts exactly what `parseRecordId` accepts (digits only)". A regex `^[1-9][0-9]{0,14}$` would match exactly; plain `^[0-9]+$` would let `0` and `007` through. Decide in Phase 2.
- `scope-inventory.test.ts` pins test titles of exported functions; renaming a test there breaks it.

### Not verified

- The behaviour of the new `exists` on real data (row counts, pagination counts Asignaturas): structural pins only (X7), owner check 6.9.
- Rendered look in a browser (design tokens used: `text-label`, `text-muted-foreground`, `gap-1`).
- Engram persistence: the memory tools were not available in this session, so progress lives only in this file.

### Boundaries

No DB command, nothing under `drizzle/` or `src/db/`, nothing under the intake paths, `package-lock.json` untouched (pre-existing modification), no stage/commit/push.

## Batch 2: Phase 2 (seam B, create a group under its Asignatura)

Mode: Strict TDD, `npm test`. Delivery: one PR with `size:exception`. Tasks 2.1 to 2.11 done; 2.12 partial (see "Redirect checks"). Phase 3 not started.

### Reading for this batch

Read: `redirects.md` (all), `redirect.md` (all), `revalidatePath.md` (first 120 lines: parameters and behaviour), `not-found.md` (first 80 lines), `dynamic-routes.md` (first 150 lines). Nothing contradicts UG-1, UG-3 or UG-4. Source read (not docs): `shared/lib/router/utils/prepare-destination.js` (`matchHas` anchors `^value$`, uses the last value of a repeated key, treats an empty value as "no value") and `server/lib/router-utils/resolve-routes.js` (route order: headers, redirects, then the middleware step; a redirect carries the request query, and its status comes from `permanent`).

### TDD cycle evidence

| Task | Test file | RED (reason) | GREEN | Notes |
|---|---|---|---|---|
| 2.1 | `src/lib/catalog/legacy-redirects.test.ts` (new, 35 tests) | module missing (import resolve error) | 2.2: 35 passed | mutation: `RECORD_ID` changed to `[0-9]+` made 7 tests fail (`0`, `007`, 16 digits); restored |
| 2.2 | `legacy-redirects.ts`, `next.config.ts` | n/a | see 2.1 | `redirects()` returns the table; `withNextIntl` export kept |
| 2.3 | `grupos/grupo-form.test.tsx` | 40 failed. Honest note: once the helper stopped passing `asignaturas`, every test crashed on the old code (`asignaturas` undefined), so the failure is a mix of the right reason (no `asignatura` prop) and a crash. The new create-mode assertions (text, hidden input, no combobox, stray error) cannot pass without the new code | 2.4: 40 passed | edit-mode tests unchanged in intent |
| 2.4 | `grupo-form.tsx`, `bound-controls.tsx` | n/a | 40 passed, typecheck clean | `CreateGrupoForm` requires `asignatura`, `EditGrupoForm` omits it |
| 2.4a (extra) | `grupos/[id]/edit/page.test.tsx` | 1 failed: the page still passed `asignaturas` (`not.toHaveProperty`) | 44 passed after dropping `asignaturas={[]}` from the old edit page | needed because the form no longer takes the prop; two `asignaturasTruncated` lines removed (typecheck) |
| 2.5 | `grupos/actions.test.ts` | 2 failed: redirected to `/catalog/grupos` | 2.6: 94 passed | rewrote the "created" test; added the A-CREATE-TAMPER test (id 14; crafted `returnTo` and `path` fields ignored) |
| 2.6 | `grupos/actions.ts` | n/a | 94 passed | `ASIGNATURAS_PATH`, `asignaturaEditPath()`, `revalidateRecord`; unused `revalidatePath` import removed; `LIST_PATH` kept for update and toggle (X4) |
| 2.7 | `asignaturas/[id]/grupos/new/page.test.tsx` (new, 36 tests) | page missing (import resolve error) | 2.9: 36 passed | one test-side fix: the current breadcrumb segment has role `link` without `href` |
| 2.8 | `current-marker-usage.test.ts`, `catalog-parity.test.ts` | marker list mismatch and "source not found"; parity `ENOENT` on the new page | green after 2.9 | `guards.test.ts` not edited; it now lists the new page (27 tests); mutation (an `await` before the guard) failed the guard pin for the new page; restored |
| 2.9 | `.../grupos/new/page.tsx` | n/a | 36 + 27 + marker + parity green | moved with `mv`; old `grupos/new/` removed (page and test) |
| 2.10 | `src/i18n/catalog-parity.test.ts` | 4 failed (subtitle still says "catalog"; Asignatura errors still say "from the list") | 174 passed | copy chosen in this batch, see below |
| 2.11 | `asignaturas/[id]/edit/page.test.tsx` | 4 failed (old `?asignaturaId=` href) | 61 passed | `addHref` only |
| 2.12 | n/a | n/a | see V | partial |

### What was implemented

- `/catalog/asignaturas/[id]/grupos/new`: guard first, scope `none` state with no read (and `params` not awaited), `parseRecordId`, `getAsignaturaById(scope, id)`, `notFound()` for null or inactive, then `listDocenteOptions()`. Breadcrumb: Asignaturas list, the Asignatura code (link to `/catalog/asignaturas/{id}/edit`), the current segment. With scope `none` the breadcrumb has the list and the page only.
- Form: `asignatura?: {id, codigo, nombre}` shown as `FixedField` plus a hidden `asignaturaId` input in create mode; `asignaturas`, `asignaturasTruncated`, `defaultAsignaturaId` removed; `asignaturaId` is no longer a drawn field, so its error shows in the `role="status"` region.
- Create action: revalidates `/catalog/asignaturas` and `/catalog/asignaturas/{id}/edit`, redirects to the latter; `{id}` is the validated payload id.
- `legacy-redirects.ts` with two rules (`has` capture and `missing` complement) and `next.config.ts` `redirects()`.
- "Add group" link in the Asignatura Grupos section points at the new route.
- Copy (es and en): `catalog.grupos.page.newSubtitle` ("... add a group to this subject." / "... agregar un grupo a esta asignatura."); `catalog.shared.fieldErrors.asignaturaId.required` ("The subject is missing. Open this form again from the subject's page.") and `.invalid` ("This subject is not available. Open the form again from the subject's page and check that it is active."), with the es equivalents.

### Redirect checks (2.12)

Not run: `npm run build` and the `curl.exe` HTTP checks. Reason: `netstat` shows PID 40084 (`node ... next/dist/server/lib/start-server.js`, this repo) listening on :3000. It shares `.next` with a build, and the rule is to ask the owner to stop it, never kill it. Left for the owner (2.12 and 6.5).

Run (read-only; no server, no network, no database): a scratchpad script loaded the real `next.config.ts` through Next's `loadConfig`, processed it with `loadCustomRoutes`, and applied Next's own `matchHas` and `prepareDestination`.

| Check | Result |
|---|---|
| next-intl wrapper keeps `redirects` | run: `config.redirects` is a function and the processed table has both rules (plus Next's internal trailing-slash rule), both `permanent: false` |
| `has` value anchored | run: `12abc`, `abc`, `0`, `007`, empty and absent all go to `/catalog/asignaturas`; `12` goes to `/catalog/asignaturas/12/grupos/new`; exactly one rule matched in every case |
| status | derived from `permanent: false` (307); no live response observed |
| query handling | run: the request query is carried to the destination (`?asignaturaId=12` stays on the new URL), as the design expected; a repeated key uses its last value |
| config redirects run before the auth middleware | read in `resolve-routes.js` (redirects precede the middleware step); not observed over HTTP |
| unauthenticated HTTP behaviour, `/login?next=` | not run |
| slug conflict: `[id]/grupos/new` beside `[id]/edit` | not run (needs the build); same slug name at the same position, so none expected |

Noted refinement (not a deviation): the `has` pattern is `[1-9][0-9]{0,14}` (what `parseRecordId` accepts), not "digits only", so `0` and `007` fall to the list.

### V results

- `npm test`: 144 files, 2909 tests, all passed. Start-of-batch baseline re-run: 143 files, 2868 passed.
- `npm run typecheck`: the only error is `.next/types/validator.ts(116,39)`, a stale generated file that still points at the deleted `grupos/new/page.js`; `.next` is gitignored and held by the running server, so I did not touch it. A temporary tsconfig (scratchpad, not in the repo) that extends the project one and excludes `.next` reports no errors for `src` and the root configs.
- Lint, Windows-safe form, on the 16 changed source files: after `rg -v "Delete .␍."` only per-file headers and one warning remained (the unused `revalidatePath` import, since removed); `rg "\berror\b"` on the output prints nothing. `prettier --end-of-line crlf --check` passes on all 16.
- Intake and request suites on their own: 33 files, 349 tests passed.
- Focused: `legacy-redirects.test.ts` 35; `grupo-form.test.tsx` 40; `actions.test.ts` 94; new page test 36; `catalog-parity.test.ts` 174; `guards.test.ts` 27.

### Deviations and decisions

1. 2.1: the redirect `has` pattern mirrors `parseRecordId`, not "digits only" (see above).
2. The old edit page and its test changed in Phase 2 (dropping `asignaturas={[]}` and two `asignaturasTruncated` lines) because the form contract changed; the task list does not name them.
3. Copy for `newSubtitle` and `asignaturaId.{required,invalid}` is mine; the spec only requires that it stop pointing to a list. Pinned by the parity test.
4. The grupo-form test fixture for the `asignaturaId` error now reads the real `required` message instead of the literal "Select a subject".
5. `key={asignatura.id}` on `CreateGrupoForm`, replacing the old preselection key.
6. New files were written LF and converted with `prettier --end-of-line crlf --write`; no `sed -i` used.
7. Size: well over the 900-line reference (below). The work was complete when I measured; I report instead of trimming tests.
8. 2.12 left unticked (partial).

### Changed lines of this batch (authored adds plus deletes, estimated)

| Group | Lines |
|---|---|
| Modified files of Phase 2 only (`git diff --numstat`: 149 added, 133 deleted) | 282 |
| `i18n/*.json` (6 added and 6 deleted each way in the cumulative diff) and `catalog-parity.test.ts` (about 36 added, 1 changed) | about 49 |
| New files with no ancestor (`legacy-redirects.ts` 46, its test 126) | 172 |
| Moved with edits, rename credited (`git diff --no-index` against HEAD: page 48 added 27 deleted; page test 301 added 333 deleted) | 709 |
| **Total, renames credited** | **about 1,210** |
| Without rename credit (new files 767, deleted files 778) | about 2,050 |

Phase 1 left 9 files with 554 insertions and 26 deletions. This batch is about 300 over the 900 reference and above the 550 to 850 estimate; the page test (634 with rename credit) is most of it, because it was rewritten for the new route (36 tests, up from 31).

### Not verified

- `npm run build` and any HTTP behaviour (see above).
- Real-data behaviour of create then redirect (owner checks 6.9 and 6.10).
- Rendered look in a browser (the new page reuses `FixedField`, `ERROR_PANEL`, `PageHeader` and the breadcrumb pattern; no new tokens).
- Engram persistence: see the final report.

### Boundaries

No DB command, nothing under `drizzle/` or `src/db/`, nothing under the intake paths, `package-lock.json` untouched, no stage, commit, stash, branch switch or push; the index still has only the three staged spec deletions. No process was killed; the server on :3000 was left running.

## Batch 2 follow-up: task 2.12 completed (2026-10-11)

Run by the orchestrator after the owner stopped the server on :3000.

- `npm run build`: passed. The route table lists `/catalog/asignaturas/[id]/grupos/new` next to `/catalog/asignaturas/[id]/edit`, so the shared `[id]` slug raises no conflict. `/catalog/grupos` and `/catalog/grupos/[id]/edit` are still routes, as planned until Phases 3 and 4.
- `npm run typecheck`: clean after the build regenerated `.next/types` (the stale `validator.ts` error is gone).
- HTTP checks against `next start -p 3111`, no session, redirects not followed:

| Request | Status | Location |
|---|---|---|
| `/catalog/grupos/new?asignaturaId=12` | 307 | `/catalog/asignaturas/12/grupos/new?asignaturaId=12` |
| `/catalog/grupos/new?asignaturaId=12&foo=bar` | 307 | `/catalog/asignaturas/12/grupos/new?asignaturaId=12&foo=bar` |
| `/catalog/grupos/new` | 307 | `/catalog/asignaturas` |
| `/catalog/grupos/new?asignaturaId=abc` | 307 | `/catalog/asignaturas?asignaturaId=abc` |
| `/catalog/grupos/new?asignaturaId=` | 307 | `/catalog/asignaturas?asignaturaId=` |
| `/catalog/grupos/new?asignaturaId=0` | 307 | `/catalog/asignaturas?asignaturaId=0` |
| `/catalog/grupos/new?asignaturaId=007` | 307 | `/catalog/asignaturas?asignaturaId=007` |
| `/catalog/grupos/new?asignaturaId=12abc` | 307 | `/catalog/asignaturas?asignaturaId=12abc` |
| `/catalog/asignaturas/12/grupos/new` | 307 | `/login?next=%2Fcatalog%2Fasignaturas%2F12%2Fgrupos%2Fnew` |

Confirmed live: the next-intl wrapper keeps `redirects`; the `has` value is anchored; config redirects run before the auth middleware (no session was needed); the status is 307; the request query is carried to the destination; an anonymous request to the new route is bounced to `/login?next=` with the new path.

Still not verified: anything behind a session (the rendered create page, saving a group, the landing page after save). Owner tasks 6.9 and 6.10 cover them. The server started for the check was stopped and port 3111 is free. No database was touched: every request above was answered by configuration or by the auth middleware.

## Batch 3: Phase 3 (seam C, edit a group under its Asignatura)

Mode: Strict TDD, `npm test`. Delivery: one PR with `size:exception`; line cap for this work unit 1,300. Tasks 3.1 to 3.10 done. Phase 4 not started. The runtime attempt token was passed by the orchestrator and is not settled here.

### Reading for this batch

Re-read before coding: `dynamic-routes.md` (params is a Promise and is awaited; two dynamic segments in one path are plain `[id]` and `[grupoId]`), `redirect.md` (throws, outside `try`, 307 in a Server Component unless streaming already started; `permanentRedirect` is the 308 one), `not-found.md` (throws; a `try/catch` around it suppresses it), `revalidatePath.md` (a literal path takes no `type`). Nothing contradicts UG-1, UG-3 or UG-4. Safety net: `npm test` before any edit, 144 files, 2909 tests, all passed (the known flaky set did not fail).

### TDD cycle evidence

| Task | Test file | RED (reason) | GREEN | Notes |
|---|---|---|---|---|
| 3.1 | `asignaturas/[id]/grupos/[grupoId]/edit/page.test.tsx` (new path; made by copying the old edit-page test, then adapted: 56 tests, up from 44) | page missing (import resolve error), together with 3.2 | 3.3: 56 passed | **Mutation on the parent check**: replaced `record === null \|\| record.asignaturaId !== asignaturaId` with `record === null`; 3 tests failed (mismatch with another Asignatura, mismatch with a non-existent one, mismatch answers like a missing group); restored, 56 passed |
| 3.2 | `catalog/current-marker-usage.test.ts`, `src/i18n/catalog-parity.test.ts` | marker list mismatch and "source not found"; parity `ENOENT` on the new page | green after 3.3 | `guards.test.ts` not edited; verbose output shows it checks both `asignaturas/[id]/grupos/[grupoId]/edit/page.tsx` and `grupos/[id]/edit/page.tsx` ("first await" and "never reaches a server action") |
| 3.3 | `.../[grupoId]/edit/page.tsx` | n/a | 56 + marker + parity + guards green | moved with `mv`, then adapted; one test-side fix (the current breadcrumb segment has role `link` without `href`, so the link count filters on `href`) |
| 3.4 | `grupos/[id]/edit/page.test.tsx` (rewritten as the redirect page test, 30 tests) | page missing at the old path (import resolve error) | 3.5: 30 passed | **Mutation on the guard**: `await Promise.resolve()` before `requireCatalogAccess()` made `guards.test.ts` (for this page) and the new "guard is the first await" pin fail (2 failed); restored, all passed |
| 3.5 | `grupos/[id]/edit/page.tsx` | n/a | 30 passed; guards green | |
| 3.6 | `grupos/actions.test.ts` | 9 failed: update and toggle expected the three Asignatura paths and got `/catalog/grupos`; the two new tamper tests and the two source pins failed for the same reason | 3.7: 98 passed (89 before the code) | `audit-leak.test.ts`, `guards.test.ts` and `scope-inventory.test.ts` run in the same pass: green |
| 3.7 | `grupos/actions.ts` | n/a | see 3.6 | `LIST_PATH` removed; private `revalidateGrupo(asignaturaId, grupoId)` = `revalidateRecord(ASIGNATURAS_PATH, asignaturaId)` plus a literal `revalidatePath(".../grupos/{grupoId}/edit")`; the `revalidatePath` import is back (Batch 2 had removed it) |
| 3.8 | `asignaturas/[id]/edit/page.test.tsx` | 4 failed (old `/catalog/grupos/{id}/edit` href), two of them new tests with id 345 (active and inactive subject) | 3.9: 63 passed | |
| 3.9 | `asignatura-grupos-section.tsx` | n/a | see 3.8 | Edit link built from the section's `asignaturaId` and the row id; `viewAll` and `codigo` untouched (4.8) |
| 3.10 | n/a | n/a | see V | |

Characterization check for the deactivation confirmation (3.1): the page has no "confirmation prop"; the confirmation is `ActiveToggle` fed by the `recordLabel` the page builds. I emptied `recordLabel`: "gives the toggle the id, the action and a label that names the record" and "names the record when deactivating and adds no blocking note" failed; restored, 56 passed.

Tests that were green before the code: the parts of the moved page test that describe unchanged behaviour (they are the old tests adapted). They are not RED. The parent check, both malformed-id cases, the inactive-parent case and the breadcrumb are new behaviour; the parent check and the confirmation were proved by mutation as above, the inactive-parent test passes because the page never reads the parent (the mock of `getAsignaturaById` is asserted not called; I did not run a mutation that adds the `activo` check).

### What was implemented

- `/catalog/asignaturas/[id]/grupos/[grupoId]/edit`: guard first, scope `none` with no read (and `params` not awaited), both params through `parseRecordId`, `getGrupoById(scope, grupoId)`, then `notFound()` for null or `record.asignaturaId !== id`, with no extra query. It does not read the parent Asignatura and does not look at its `activo`. Breadcrumb: Asignaturas list, parent Asignatura (the record's code, link built from `record.asignaturaId`), current segment. No new i18n key.
- `/catalog/grupos/[id]/edit` is now a thin page: guard as first await, scope `none` redirects to `/catalog/asignaturas` with no read, `parseRecordId` null or an unknown/foreign group gives the same `notFound()`, a found group (active or inactive) redirects to `/catalog/asignaturas/{record.asignaturaId}/grupos/{id}/edit` with `redirect()` (no `permanentRedirect`, no `try`, no copy, no markup).
- Actions: update redirects to `/catalog/asignaturas/{target.item.asignaturaId}/edit`; update and toggle revalidate the list, the parent edit page and the group edit page (literal path); toggle keeps its no-redirect behaviour; no form field builds a path. `actions.ts` holds no `/catalog/grupos` literal and no `LIST_PATH`.
- Grupos section: the Edit link points to the new route.

### V results

- `npm test`: 145 files, 2957 tests, all passed (start of batch 144 and 2909; +1 file, +48 tests).
- `npm run typecheck`: clean, before and after the build (no stale `.next/types` error this time, because the old edit path still exists).
- `npm run build`: passed. The route table lists `/catalog/asignaturas/[id]/grupos/[grupoId]/edit`, `/catalog/asignaturas/[id]/grupos/new`, `/catalog/asignaturas/[id]/edit`, `/catalog/grupos` and `/catalog/grupos/[id]/edit`, so `[id]` and `[grupoId]` at one path position raise no conflict (UG-1's unverified point is now verified). Nothing was listening on :3000 before the build.
- Lint, Windows-safe form, on the 10 changed files: after `rg -v "Delete .␍."` only per-file headers and the summary line remained; `rg "\berror\b"` on that output prints nothing. `prettier --end-of-line crlf --check` passes on all 10, all CRLF.
- Intake and request suites on their own: 33 files, 349 tests passed.
- Focused: new edit page 56; redirect page 30; `actions.test.ts` 98; `asignaturas/[id]/edit/page.test.tsx` 63; marker, parity, guards, audit-leak and scope-inventory green.

### Deviations and decisions

1. The old edit-page test was copied to the new path (not moved), because the old path needs a test of its own (the redirect page). In git both paths show as modified/untracked rather than as a rename. The new-path file is the old one with these changes: params and `renderPage(grupoId, id)`, import depth, a `getAsignaturaById` mock added to prove the parent is never read, malformed-parent cases, parent-mismatch cases (3 tests), the inactive-parent case, the breadcrumb expectations and the source pins. The rest is unchanged.
2. The characterization mutation for the confirmation empties `recordLabel` instead of "removing the confirmation prop" (see above); same intent.
3. The current breadcrumb segment keeps `breadcrumb.edit` with `{codigo}`, so the code now shows in both the parent crumb and the current crumb. The reword is task 4.7, so I did not touch the key.
4. The redirect page test has two pins beyond the task text: the page holds no copy or markup (so it stays out of the parity `FILES`), and the target is built only from `record.asignaturaId` and the parsed id.
5. No i18n key was added, changed or removed in this phase, so `i18n/*.json` are not touched by this batch.
6. Size: under the 1,300 cap (below).

### Changed lines of this batch (authored adds plus deletes, estimated)

Measured against `HEAD` where the file has an ancestor there (this also counts the few lines Batch 2 changed in those files, so the figures lean slightly high), and by hand for files touched in both batches.

| Group | Lines |
|---|---|
| Moved page, rename credited (36 added, 13 deleted vs `HEAD`) | 49 |
| Moved page test, rename credited (131 added, 25 deleted vs `HEAD`) | 156 |
| New redirect page (34) and its test (309) | 343 |
| `actions.ts` (about 24) and `actions.test.ts` (about 97) | about 121 |
| Section (3), `asignaturas/[id]/edit/page.test.tsx` (about 33), marker test (2), parity test (2) | about 40 |
| **Total, renames credited** | **about 710** |
| Without rename credit (new paths 170 + 953 added; old paths 34 + 309 added and 146 + 844 deleted; plus the 161 above) | about 2,620 |

Running cumulative, renames credited: Batch 1 about 580, Batch 2 about 1,210, Batch 3 about 710.

### Not verified

- The real status code of the old edit URL's redirect page (a `redirect()` in a Server Component can surface as something other than 307 once streaming has started): owner task 6.10, needs a session.
- Rendered look of the edit page in a browser (it reuses the breadcrumb pattern of the new-group page; no new tokens).
- Real-data behaviour of update then redirect, and of the toggle refreshing the three pages (owner checks 6.9 and 6.10).
- Engram persistence: the memory tools were not available in this session, so progress lives only in this file and in `tasks.md`.

### Boundaries

No database command, nothing under `drizzle/` or `src/db/`, nothing under the intake paths, `package-lock.json` untouched (its modification predates the batch), no stage, commit, stash, branch switch or push; the index still holds only the three staged spec deletions. No process was killed; nothing was listening on :3000.

## Batch 4: Phase 4 (seam D, retire the list, the sidebar entry and the last old URL)

Mode: Strict TDD, `npm test`. Delivery: one PR with `size:exception`; line cap for this work unit 1,800. Tasks 4.1 to 4.11 done. Phase 5 not started. The runtime attempt token was passed by the orchestrator and is not settled here. Start-of-batch baseline re-run: 145 files, 2957 tests, all passed; nothing listening on :3000.

### TDD cycle evidence

| Task | Test file | RED (reason) | GREEN | Notes |
|---|---|---|---|---|
| 4.1 | `src/components/app-sidebar.test.tsx` | 15 failed, all because the Grupos entry still rendered (the new "no Grupos destination" cases and the shortened link lists) | 4.2: 88 passed | Grupos cases removed or rewritten (7 link-list rows, the exclusive-active table, the old Grupos describe, the Docentes "not current" table, the tab-order test). Two characterization cases (`/catalog/asignaturas/3/grupos/new` and `.../5/edit` mark only Asignaturas) cannot be RED. Mutation: `isCurrent` narrowed to `pathname === href`; 8 tests failed (both new cases, the two new table rows, `/catalog/asignaturas/12/edit`, `/users/new` cases); restored, 88 passed |
| 4.2 | `app-sidebar.tsx`, `i18n/*.json`, `catalog-parity.test.ts` | n/a | sidebar and parity tests 257 passed | `catalogGrupos` item and `UsersRound` import removed (no other use); `nav.catalogGrupos` removed from both locales, from `GUARDED_SECTIONS` and the "sidebar label is" test |
| 4.3 | `legacy-redirects.test.ts` | 12 failed (table has two rules, list rule missing) | 4.4: 47 passed | table pin is now three rules, all `permanent: false`; the list rule is pinned as an exact object (source, destination `/catalog/asignaturas?status=active&page=1`, `permanent: false`), no `has`/`missing`; the matcher test uses Next's own bundled `path-to-regexp` (via `createRequire`): the source matches `/catalog/grupos` only, not `/new`, `/5/edit`, `/12`, `/12/other`, `/catalog/gruposx` or the new-group path; plus a "no pattern character" pin |
| 4.4 | `legacy-redirects.ts` | n/a | 47 passed | one rule added at the head of the table |
| 4.5 | `catalog/guards.test.ts` | 2 failed: the discovered list had the extra `grupos/page.tsx` (the new "exactly the seven pages" pin and a "no list page under grupos" pin) | 31 passed after deleting `grupos/page.tsx` and `grupos/page.test.tsx` | the parity `FILES` and its list-bound expectations were adjusted in the same step so the test does not read a deleted file |
| 4.6 | `catalog-parity.test.ts`, `asignaturas/[id]/edit/page.test.tsx` | parity: section keys/columns/`edit` missing, `catalog.grupos.list` still present, breadcrumb with only periodo and numeroGrupo threw `FORMATTING_ERROR` on `codigo` (13 failed); edit page: 7 failed (headers undefined, `viewAll` link still rendered) | 4.7 and 4.8 | the cap test now asserts the note has no anchor and that the section links are exactly Add plus the three Edit links; the ampersand test checks every link is numeric under `/catalog/asignaturas/12/`; a Spanish header assertion was added |
| 4.7 | `i18n/es.json`, `i18n/en.json` | n/a | parity 197 passed | see "i18n keys" below |
| 4.8 | `asignatura-grupos-section.tsx`, `[id]/edit/page.tsx`, group edit page | n/a | `asignaturas` folder and parity 496 passed | labels from `t("grupos.*")`; `tList` gone; `viewAll` and the `codigo` prop gone; the group edit page no longer passes `codigo` to `breadcrumb.edit`; its test now expects `Edit 2026-S1 A` and no `MAT101` in the current crumb. That test was green before the page change, so it was proved by mutation (en `breadcrumb.edit` put back to carry the code): 1 failed; restored |
| 4.9 | `list-params.test.ts` | `npm run typecheck`: `TS2578 Unused '@ts-expect-error' directive` at the new line | typecheck clean for `src` after removing `/catalog/grupos` from `CatalogListBase` | no other caller surfaced |
| 4.10 | `legacy-redirects.test.ts` + `grupos/[id]/edit/page.test.tsx` | characterization, cannot be RED | 2 files, 75 tests passed | |
| 4.11 | n/a | n/a | see V | |

### i18n keys (both locales, same task)

- Moved: `catalog.grupos.list.columns.{periodo,numeroGrupo,docente,dias,status,actions}` to `catalog.asignaturas.grupos.columns.*`; `catalog.grupos.list.edit` to `catalog.asignaturas.grupos.edit`.
- Removed: `nav.catalogGrupos`; all the rest of `catalog.grupos.list.*` (title, subtitle, newButton, columns.code, columns.subject, empty, noResults.*, degraded, search.*, count, tableCaption, pagination.*); `catalog.asignaturas.grupos.viewAll`.
- Reworded (key kept): `catalog.grupos.breadcrumb.edit` is now `Edit {periodo} {numeroGrupo}` / `Editar {periodo} {numeroGrupo}`.
- Kept: `catalog.grupos.{errors,form,page,state}.*`, `breadcrumb.{label,new}`, `form.asignaturaLabel`, `form.naturalKeyHint`, `form.searchPlaceholder`, `form.noMatches`, `form.truncated`.

### What changed in code

- `app-sidebar.tsx`: Grupos item and `UsersRound` import removed.
- `legacy-redirects.ts`: third rule, `/catalog/grupos` to `/catalog/asignaturas?status=active&page=1`.
- Deleted from the filesystem: `catalog/grupos/page.tsx` (248 lines) and `catalog/grupos/page.test.tsx` (625 lines). `catalog/grupos/` now holds `actions.ts`, `grupo-form.tsx`, `bound-controls.tsx`, their tests, and `[id]/edit/page.tsx` with its test.
- Section: no list link, `codigo` prop gone, the cap note stays as plain text.
- `list-params.ts`: `CatalogListBase` is `"/catalog/asignaturas" | "/catalog/docentes"`.
- `listGrupos` and `buildGruposWhere` left in place for Phase 5 (no lint or typecheck complaint about them).

### V results

- `npm test`: 144 files, 2921 tests, all passed (start of batch 145 and 2957: one file deleted, 36 tests net fewer).
- `npm run build`: passed after one workaround, see deviation 3. Catalog routes in the table: `/catalog/asignaturas`, `/catalog/asignaturas/[id]/edit`, `/catalog/asignaturas/[id]/grupos/[grupoId]/edit`, `/catalog/asignaturas/[id]/grupos/new`, `/catalog/asignaturas/new`, `/catalog/docentes`, `/catalog/grupos/[id]/edit`, `/catalog/import`. `/catalog/grupos` is gone.
- `npm run typecheck`: clean after the build.
- Lint, Windows-safe form, 13 changed source files: after `rg -v "Delete .␍."` only per-file headers and the summary line remained; `rg "\berror\b"` on that output prints nothing. `prettier --end-of-line crlf --check` passes on those files and on both `i18n` files.
- Intake and request suites on their own: 33 files, 349 tests passed.

### Live redirect check (run, port 3111, no session, redirects not followed)

| Request | Status | Location |
|---|---|---|
| `/catalog/grupos` | 307 | `/catalog/asignaturas?status=active&page=1` |
| `/catalog/grupos?q=x&status=inactive&page=3` | 307 | `/catalog/asignaturas?q=x&status=active&page=1` |
| `/catalog/grupos?q=x` | 307 | `/catalog/asignaturas?q=x&status=active&page=1` |
| `/catalog/grupos?status=all` | 307 | `/catalog/asignaturas?status=active&page=1` |
| `/catalog/grupos/new?asignaturaId=12` | 307 | `/catalog/asignaturas/12/grupos/new?asignaturaId=12` |
| `/catalog/grupos/new` | 307 | `/catalog/asignaturas` |
| `/catalog/grupos/5/edit` | 307 | `/login?next=%2Fcatalog%2Fgrupos%2F5%2Fedit` |
| `/catalog/grupos/12` | 307 | `/login?next=%2Fcatalog%2Fgrupos%2F12` |
| `/catalog/grupos/12/other` | 307 | `/login?next=%2Fcatalog%2Fgrupos%2F12%2Fother` |

The design's unverified point is settled: a key written in the destination overrides the same key in the request, so `status` and `page` are pinned and `q` is carried. The fallback of 4.4 was NOT needed. Following the first redirect once reaches `/login?next=%2Fcatalog%2Fasignaturas` (200). The server started for the check (PID 33072) was stopped; no listener remains on 3111 (only TIME_WAIT sockets), and nothing was listening on :3000. Still behind a session (owner 6.9, 6.10): that `/catalog/grupos/12` and `/12/other` answer 404 for a signed-in user (anonymously they go to `/login`, as expected).

### Leftover sweep (4.11): `rg -n "catalog/grupos" src`

Baseline 0.3: 74 occurrences in 20 files. Now: 52 occurrences in 17 files, every one explained.

- Imports of `grupos/actions`, `grupos/grupo-form`, `grupos/bound-controls` and mocks of them: the two group pages (`new/page.tsx`, `[grupoId]/edit/page.tsx`) and their tests, `grupo-form.test.tsx`, `actions.test.ts`, `audit-leak.test.ts`.
- Structural pins: `guards.test.ts`, `current-marker-usage.test.ts`, `catalog-structure.test.ts`, `catalog-parity.test.ts` (directory path of the form and the actions file).
- `legacy-redirects.ts` (the three sources) and its test.
- `grupos/[id]/edit/page.test.tsx` (path of the guarded redirect page).
- Negative pins added or kept on purpose: `app-sidebar.test.tsx` (no `a[href^="/catalog/grupos"]`), `list-params.test.ts` (the `@ts-expect-error` line), `actions.test.ts` ("holds no /catalog/grupos literal and no LIST_PATH").
- Task 6.8(c) greps: `viewAll`, `grupos.list` and `LIST_PATH` still appear only in negative pins of `catalog-parity.test.ts` and `grupos/actions.test.ts`, plus the Asignaturas `actions.ts`, which has its own unrelated `LIST_PATH = "/catalog/asignaturas"`. `catalogGrupos` and `UsersRound` are gone. Nothing in `src/components` (source), `list-params.ts` (source), `asignaturas/` (source) or `grupos/actions.ts` mentions `/catalog/grupos` (I removed a document-wide anchor check from the edit page test so the Asignaturas folder stays clean; the exact-href equality of the section covers it).
- Note on the 0.3 baseline: the quoted-route search `rg -n '"/catalog/grupos' src` prints nothing in this shell because of quoting; `rg -n '\x22/catalog/grupos' src` is the form that works. It now lists `legacy-redirects.ts` and its test plus the negative pins above.

### Deviations and decisions

1. The parity `FILES` expectations and the "day names" assertion that read the deleted list page were changed in 4.5, not 4.6, because the parity test would otherwise read a deleted file. Two expectations (`catalog.shared.status.active`, `catalog.shared.dias.notSet`) also left the "scan finds the keys" list: only the list page chose them through the scanned files; the shared-copy describe still covers the keys.
2. **Mistake and repair.** While editing `catalog-parity.test.ts` a script removed the wrong `LIST_KEYS` block (the first one in the file, in the Asignaturas list describe, up to the next `PAGE_KEYS`), deleting about 390 lines of other describes (rest of the Asignaturas list copy, the search-by-group describe, the Grupos section describe, the Asignatura and Grupo action copy). Tests that depended on them started failing with `keysOf is not defined`, which exposed it. I rebuilt the file from `git show HEAD` and replayed, in order, the earlier batches' edits (extracted from the earlier executors' recorded commands: the search-by-group describe and its `matches` filter, the Phase 2 `FILES` and subtitle/error tests, the Phase 3 `FILES` swap) and then this batch's edits, followed by prettier. A diff against the broken file shows exactly two hunks: the 391 restored lines and the intended removal of the Grupo describe's `LIST_KEYS`. No copy of the lost version existed, so the restored text was not compared byte for byte; the whole file passes (197 tests in it at that point). The owner should look at this file's diff in review.
3. `npm run build` first failed in its own type check on a stale generated file, `.next/dev/types/validator.ts`, that still imported the deleted list page (the task named `.next/types`; here the stale copy was under `.next/dev`, and no `next dev` was running). I deleted only that gitignored generated file; the next build and typecheck were clean.
4. The cap test no longer calls `catalogListHref`; the ampersand test lost its original purpose (nothing builds a URL from the code now) and became "reaches no URL, links stay numeric".
5. The `isCurrent` characterization mutation also failed two existing rows (`/catalog/asignaturas/12/edit`, `/users/new`), as expected for a prefix rule.
6. Not RED, by their nature: the 4.1 characterization cases, 4.10, and the group-edit-page breadcrumb expectation (proved by mutation, see 4.8).

### Changed lines of this batch (authored adds plus deletes, estimated)

Measured with `git diff --numstat HEAD` for files this batch alone touched, and estimated for files touched in earlier batches too.

| Group | Lines |
|---|---|
| `i18n/es.json`, `i18n/en.json` | about 104 |
| Sidebar (7) and its test (159) | 166 |
| `guards.test.ts` | 33 |
| `legacy-redirects.ts` (8) and its test (about 85) | about 93 |
| `list-params.ts` and its test | about 13 |
| `catalog-parity.test.ts` | about 120 |
| Section (about 20), Asignatura edit page (about 17), its test (about 75), group edit page and test (about 14) | about 126 |
| **Authored total** | **about 655** |
| Deleted list page (248) and its test (625), stated apart | 873 |
| With the deletions | about 1,530 (cap 1,800) |

Running cumulative authored, renames credited: Batch 1 about 580, Batch 2 about 1,210, Batch 3 about 710, Batch 4 about 655, plus the 873 deleted lines.

### Not verified

- The HTTP status of `/catalog/grupos/{id}/edit` and the 404 of `/catalog/grupos/12` for a signed-in user (owner 6.10).
- Rendered look in a browser (only text and links were removed; no new tokens).
- Real-data behaviour of the Asignaturas list reached through the redirect (owner 6.9).
- Engram persistence: see the final report.

### Boundaries

No database command, nothing under `drizzle/` or `src/db/`, nothing under the intake paths, `package-lock.json` untouched (modified before the batch), no stage, commit, stash, branch switch or push; the index still holds only the three staged spec deletions. Only the process I started (`next start` on 3111) was stopped; nothing was listening on :3000. `file-dropzone.tsx`, `grupo-dias.ts` and `dias.ts` were not touched.

### Batch 4 orchestrator verification (2026-10-11)

- `npm test` first run: 1 failed of 2921, `src/app/(dashboard)/catalog/import/import-form.test.tsx` > "ImportForm flow (preview, then confirm) > shows the summary and the credentials download after the apply". The import folder is not in the diff. Re-run in isolation three times: 39 of 39 passed each time. Second full run: 144 files, 2921 passed. Treated as an intermittent failure unrelated to this batch; not fixed here.
- `npm run build` passed; `/catalog/grupos` is no longer in the route table and `/catalog/grupos/[id]/edit` still is. `npm run typecheck` clean after the build.
- `src/i18n/catalog-parity.test.ts` (rebuilt by the executor, deviation 1): 12 top-level describes on HEAD, 13 now (the search describe added in Batch 1); the only test titles removed against HEAD are the list-key pins and the list-bound cases.

## Batch 5: Phase 5 (seam E, remove the unused group list query)

Mode: Strict TDD, `npm test`. Delivery: one PR with `size:exception`; line cap 700. Tasks 5.1 to 5.3 done. Phase 6 not started. Runtime attempt token not settled here. Deletion-only batch.

### TDD evidence

| Task | File | RED | GREEN |
|---|---|---|---|
| 5.1 | `src/lib/data/scope-inventory.test.ts` (rows for `buildGruposWhere` and `listGrupos` removed, 10 lines) | 1 failed of 15: "pairs every exported function with a row" (received exports still listed `buildGruposWhere` and `listGrupos`) | 5.2 |
| 5.2 | `grupos.ts`, `grupos.test.ts`, `catalog-structure.test.ts` | n/a | the three data suites: 115 passed |
| 5.3 | refactor and V | n/a | see V |

### Removed, by name

- `src/lib/data/grupos.ts`: `buildGruposWhere`, `listGrupos` and their doc comments (82 lines). Imports that became unused (proved by eslint `no-unused-vars`): from `drizzle-orm` `ilike`, `not`, `or`, `sql`, `type SQL`; from `@/lib/catalog/types` `CatalogListResult`, `CatalogStatusFilter`; `containsPattern` (`@/lib/data/sql-like`); `clampPage` (`@/lib/data/users`). `and`, `asc`, `desc`, `eq`, `asignaturaInScope`, `GrupoListItem` stay (still used).
- `src/lib/data/grupos.test.ts`: `describe("buildGruposWhere")` (7 tests), `describe("listGrupos")` (12 tests), the sentinel test "listGrupos: the count and the page", the `listGrupos(...)` call inside "every statement issued has a where..." (its queued results reduced to the two statements left), and the two imports.
- `src/lib/data/catalog-structure.test.ts`: the pin "keeps the days out of buildGruposWhere (CM-GRP-7)" (X9: that file is source-text based and does not import the data module, so no behavioural replacement lives there; the B7 pin of 1.1 in `asignaturas.test.ts` covers "no NumeroGrupo, no Dias in the predicate"). `functionBody` stays (still used by the `setGrupoActivo` pin).
- `src/lib/data/scope-inventory.test.ts`: the two rows only.
- Types: none removed. `CatalogListResult`, `CatalogStatusFilter`, `GrupoListItem` are still used elsewhere (typecheck clean).

### Sweep: `rg -n "listGrupos\b|buildGruposWhere" src`

No hits. (`listGruposByAsignatura` is a different function and stays; the `\b` form excludes it.)

### V results

- `npm test`: 2899 tests passed (baseline 2921: 22 fewer = 7 + 12 + 1 sentinel + 1 structure pin + 1 inventory row-pair, net as removed). No flaky failure this run.
- `npm run typecheck`: clean.
- Lint, Windows-safe form, on the 4 files: only per-file headers remain; `rg "\berror\b"` prints nothing. `prettier --end-of-line crlf --check` passes; all four are CRLF.
- Intake and request suites on their own (`src/lib/intake requests solicitudes inscripcion-writes intake-sweep grupo-dias enrollment`): 34 files, 362 tests passed (the filter set matches one more file than the earlier 33/349 runs).
- `git diff --stat` for the batch: `grupos.ts` 88 lines changed, `grupos.test.ts` 228, `catalog-structure.test.ts` 6, `scope-inventory.test.ts` 10; 2 insertions and 330 deletions in total, so about 332 changed lines (cap 700).

### Deviations

1. `git diff -- src/lib/data/grupos.ts | rg '^\+[^+]'` prints one line, not nothing: `+import { and, asc, desc, eq } from "drizzle-orm";`. It is the single-line drizzle import with five names dropped; a name cannot be removed from a one-line import without it showing as a changed line. Every other change in the file is a deletion. The alternative (leaving unused imports) would leave 9 lint warnings, so I removed them.
2. X9 applied as the "delete" branch (see above).

### Boundaries

No DB command, nothing under `drizzle/`, `src/db/`, intake paths, `grupo-dias.ts`, `dias.ts`, `file-dropzone.tsx`; `package-lock.json` untouched; no stage, commit, stash, branch switch or push (index still holds only the three staged spec deletions). Edits were targeted `Edit` calls, no scripts. Engram persistence: see the final report.

## Phase 6: guardrails and closing verification (2026-10-11, run by the orchestrator)

Tasks 6.1 to 6.8 done. No code changed in this phase. Owner tasks 0.5, 6.9 and 6.10 remain open. Compared against `main`, which equals `origin/main` and `HEAD` (d118b67); every change of this work is uncommitted in the working tree.

| Task | Result |
|---|---|
| 6.1 | `git diff --name-only main` and `git status --porcelain` on `src/lib/intake`, `src/lib/data/solicitudes.ts`, `src/app/(dashboard)/requests`, `src/db`, `drizzle`: both printed nothing. |
| 6.2 | `file-dropzone.tsx`, `grupo-dias.ts` and `dias.ts` are not in the diff or the status, and all three are still tracked at their paths. `fd` is not installed in this shell, so `git ls-files` was used. |
| 6.3 | `src/lib/validations/catalog.ts` and `src/lib/audit/events.ts` are not in the diff. In `src/lib/data/grupos.ts` no hunk touches `createGrupo`, `updateGrupo` or `setGrupoActivo`; the only added line is the narrowed import `import { and, asc, desc, eq } from "drizzle-orm";`. |
| 6.4 | Intake and request suites: 33 files, 349 tests passed. |
| 6.5 | See the table below. Run against `next start -p 3111` (not 3000), no session. |
| 6.6 | `npm test`: 144 files, 2899 tests passed. |
| 6.7 | `npm run typecheck` clean. `npx eslint src` filtered for the CRLF noise leaves no `error` line (the raw run reports 54,058 problems, all of the `Delete CR` prettier kind). `npm run build` passed. |
| 6.8 | (d) parity test 169 passed. (a), (b), (c): see "Sweep hits". |

### 6.5 HTTP results

| Request | Status | Location |
|---|---|---|
| `/catalog/grupos?q=x&status=inactive&page=3` | 307 | `/catalog/asignaturas?q=x&status=active&page=1` |
| `/catalog/grupos` | 307 | `/catalog/asignaturas?status=active&page=1` |
| `/catalog/grupos/new?asignaturaId=12` | 307 | `/catalog/asignaturas/12/grupos/new?asignaturaId=12` |
| `/catalog/grupos/new` | 307 | `/catalog/asignaturas` |
| `/catalog/grupos/new?asignaturaId=abc` | 307 | `/catalog/asignaturas?asignaturaId=abc` |
| `/catalog/grupos/new?asignaturaId=12abc` | 307 | `/catalog/asignaturas?asignaturaId=12abc` |
| `/catalog/grupos/5/edit` | 307 | `/login?next=%2Fcatalog%2Fgrupos%2F5%2Fedit` |
| `/catalog/grupos/12` | 307 | `/login?next=%2Fcatalog%2Fgrupos%2F12` |

Following `/catalog/grupos` ends on `/login?next=%2Fcatalog%2Fasignaturas` after two redirects. No 308 or 301 anywhere. The server was stopped and port 3111 is free. Not observable without a session: that `/catalog/grupos/12` answers not found and that `/catalog/grupos/{id}/edit` redirects to the new edit URL (owner task 6.10).

### Sweep hits (6.8)

- (a) Beyond the allowed list: `src/components/app-sidebar.test.tsx` and `src/lib/catalog/list-params.test.ts`. Both hold deliberate negative pins (no anchor to `/catalog/grupos`; `catalogListHref("/catalog/grupos")` under `@ts-expect-error`).
- (b) Beyond the allowed list: the same two negative pins and `grupos/actions.test.ts:994` (`not.toContain("/catalog/grupos")`).
- (c) `src/i18n/catalog-parity.test.ts:702` and `:720` assert that `viewAll` and `catalog.grupos.list` are absent; `grupos/actions.test.ts:993-995` asserts no `LIST_PATH`; `asignaturas/actions.ts` keeps its own `LIST_PATH = "/catalog/asignaturas"`, which this change does not touch (that file is not in the diff). No production code references the retired list.

## Post-walk-through fix (2026-10-11)

The owner did the browser walk-through (6.9, 6.10) and reported every check passing, plus one console error on `/catalog/asignaturas`: "Base UI: A component is changing the default value state of an uncontrolled FieldControl after being initialized", raised from `DataTableSearch`.

- Cause: `src/components/data-table-search.tsx` renders an uncontrolled `<Input defaultValue={value}>`. When the URL term changes while the form stays mounted (a search, the clear link, or a redirect that carries `q`), the input received a new default value. Base UI warns, and the box kept showing the previous term. The component is not new: it is shared by the Users, Docentes and Asignaturas lists and was not touched by Phases 0 to 5.
- Fix: `key={value}` on the input, so it remounts with the new term. Three lines including the comment; no behaviour change on first render and no `"use client"`.
- TDD: new test in `src/components/data-table-search.test.tsx`, "follows the value when the same form re-renders with another one, without a Base UI default-value warning". RED: 1 failed of 12 (the input kept `ana`). GREEN: 12 passed.
- Verification: `npm test` 144 files, 2900 passed; `npm run typecheck` clean; eslint on both files reports only the CRLF noise; both files are CRLF.
- Not re-checked in a browser after the fix.
