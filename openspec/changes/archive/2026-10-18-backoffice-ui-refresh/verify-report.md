```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0518cb349acc2d360e6dbaa2876ef7515e86a516ac5e13a0624c8e70a3d85ef1
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 37/37
scenarios: 131/131
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:3ab0df773275876e2e2d3062b39c35e52afb4ad88fb4fd52a70959e16ed0c2fb
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:bb688f74e6c2f13a9cb0a535f6c18e24987ef3602d006bf690e0e8055e075386
```

## Verification Report

**Change**: backoffice-ui-refresh
**Version**: N/A (four delta specs: backoffice-shell, data-table, users-listing, catalog-management), amended 2026-10-18 after the owner decisions
**Mode**: Strict TDD (runner `npm test`, vitest 5, jsdom; no coverage tool, no E2E layer)
**Commit verified**: `f8fb7cf` on `feature/better-ui` (same tree as `main` after PR #27, minus the merge commit). `git diff --stat HEAD -- src` is empty: no source or test file changed since the previous verify; only OpenSpec artifacts and `docs/roadmap.md` differ from HEAD.
**Date**: 2026-10-18 (re-verification against the amended specs; supersedes the earlier report for `f8fb7cf`)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 123 (the forecast table in tasks.md says 121; the file has 123 checkboxes) |
| Tasks complete | 123 |
| Tasks incomplete | 0 |
| Requirements (specs) | 37 (shell 14, data-table 15, users-listing 7, catalog CM-LST-1 1) |
| Scenarios (specs) | 131 (shell 37, data-table 48, users-listing 27, catalog 19) |

The amended specs add two scenarios to the earlier 129: BS-LOAD-1 "Skeleton on a same-route list change" and DT-PEND-1 "Focus returns to the sort header after the remount". Counts were taken with `rg -c '^### Requirement'` and `rg -c '^#### Scenario'` on each `spec.md`. All task ticks (including F.5, F.6, F.8) are consistent with `apply-progress.md` Batch T and Batch U (owner confirmation of F.6 and the roadmap row is now recorded).

### Build & Tests Execution

All commands were run by this verifier on `f8fb7cf` with the amended specs in the working tree. Outputs were captured to files; the hashes in the envelope are SHA-256 of the captured stdout and stderr plus a trailing `exit=<code>` line. `evidence_revision` is SHA-256 of the concatenation `HEAD sha + test hash + build hash` (hex, no separators). The test hash includes the vitest duration line, so it changes on every run even when the result is identical.

| Command | Exit | Result |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | 0 | clean |
| `npm test` (`vitest run`) | 0 | 211 files passed, 4,537 tests passed, 0 failed, 0 skipped, 92.78 s. Stdout noise only: jsdom "Not implemented: navigation to another Document" for modifier-key clicks |
| `npm run build` | 0 | compiled, TypeScript finished, 22 static pages generated, all routes dynamic, proxy listed. No warning |
| `npx eslint .` with the `prettier/prettier` rule overridden to `endOfLine: "auto"` | 0 | no errors |
| `npm run lint` (plain) | 1 | 72,530 errors, 0 warnings, every one `prettier/prettier` "Delete CR" (identical to the previous run). Environment-only (WARNING W6): `core.autocrlf=true` checks 411 LF-indexed `src` files out as CRLF |

No database command was run. `git status --short` after the gates shows only the OpenSpec artifacts, `docs/roadmap.md` and the untracked `docs/investigacion/` and `verify-report.md`; no gate rewrote a tracked file and `src` is untouched.

**Coverage**: not available (no coverage tool configured; not a failure).

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | "TDD Cycle Evidence" tables in apply-progress batches A to G, "TDD evidence" tables in H to K, RED-first bullets in M to S. Batches T and U changed no code or tests |
| All tasks have tests | Yes | Every RED task names a test file; 0 missing |
| RED confirmed (tests exist) | Yes | All 41 test files of the F.3 abbreviation table exist on disk |
| GREEN confirmed (tests pass) | Yes | Full suite 4,537/4,537 passes now |
| Triangulation adequate | Yes | Table-driven suites (`it.each`) for URL fallbacks, roles, trails, sort keys, forbidden fields, page sizes, pagination bounds |
| Safety net for modified files | Yes | Recorded per task in batches B to G |

**TDD Compliance**: 6/6 checks passed. Minor: batches H to K use a reduced evidence table (SUGGESTION S6). This round is a spec-only amendment, so no new RED/GREEN cycle was required.

### Test Layer Distribution

| Layer | Test files | Tools |
|-------|-----------|-------|
| Unit (no Testing Library import) | 132 | vitest |
| Integration (Testing Library render) | 79 | @testing-library/react, user-event |
| E2E | 0 | not installed (project convention) |
| **Total** | **211 files, 4,537 tests** | |

Counts are for the whole repository (unchanged since the previous verify). Browser and router-level behaviour has no automated layer; it rests on owner-reported manual checks (W5).

### Changed File Coverage

Coverage analysis skipped: no coverage tool detected (`openspec/config.yaml` `coverage.available: false`).

### Assertion Quality

No test file changed since the previous audit, so its findings stand. Re-inspected for this round: the tests that carry the amended scenarios (`table-pagination.test.tsx` 121-145, `list-table.test.tsx` 130-144 and 489-531, `page-context.test.tsx` 85-89, `app-sidebar.test.tsx` 193-237, `(home)/page.test.tsx` 96-136, `lib/navigation.test.ts`).

- Tautologies: none.
- Ghost loops: `getAllByRole` throws on an empty result in the loops of `data-table.test.tsx`, `table-pagination.test.tsx` and `status-filter.test.tsx`; `(home)/loading.test.tsx` lines 75 and 86 are guarded as noted in S3.
- The new "footer does not repeat the total" assertions are meaningful and non-vacuous: `table-pagination.test.tsx:128` checks a rendered footer that does contain "Page 2 of 3" (line 124) and asserts absence of the count text, and `list-table.test.tsx:137` asserts `getAllByText("25 results")` has length 1 with a companion positive check at line 130.
- `list-table.test.tsx:422-487` and `data-table.test.tsx:291-316` still pin the card-level dimming (`opacity-60`, `aria-busy`) that DT-PEND-1 no longer requires; they pass and test real behaviour of dormant code (SUGGESTION S8). They are implementation-detail (CSS class) assertions, so a WARNING-level rating applies if the dimming stays; it is folded into S8.

**Assertion quality**: 0 CRITICAL, 0 WARNING, 1 SUGGESTION (S8).

### Quality Metrics

**Linter**: environment-only failure for the plain script (72,530 CRLF `prettier/prettier` errors); 0 errors with `endOfLine: "auto"`. **Type Checker**: no errors.

### Spec Compliance Matrix

Source of the scenario-to-test mapping: apply-progress Batch L "F.3 Traceability matrix", re-validated by this verifier (every referenced test file exists and the whole suite passes) and re-mapped for the scenarios amended on 2026-10-18. Status legend: COMPLIANT = covering test passed at runtime; PARTIAL = the passing test covers only part of the scenario (DB-free SQL text only, class-level only, component-level only, or simulated); MANUAL = no automated route, owner-reported manual check.

Per requirement (scenario counts are compliant/total). Rows changed by the amendment are marked "(was ...)".

| Spec | Requirement | Scenarios | Status |
|---|---|---|---|
| backoffice-shell | BS-CTX-1 Page context | 2/3 | PARTIAL (Narrow viewport is class-level). Trail rows for `/requests`, `/requests/42`, `/review`, `/review/42` pinned in `page-context.test.tsx:85-89` (es and en) |
| backoffice-shell | BS-NAV-1 Sidebar entries | 4/4 | COMPLIANT (was 3/4): `app-sidebar.test.tsx` per-role table now matches the amended spec, including My requests for `estudiante` and Review requests for `secretaria` |
| backoffice-shell | BS-NAV-2 Brand block and identity footer | 4/4 | COMPLIANT |
| backoffice-shell | BS-FRM-1 Page frame | 1/1 | COMPLIANT |
| backoffice-shell | BS-LOAD-1 Loading skeleton | 0/3 | PARTIAL (was 0/2; new same-route scenario added; component level, real navigation is manual) |
| backoffice-shell | BS-ERR-1 Route error boundary | 3/4 | PARTIAL (Retry exercised at props level) |
| backoffice-shell | BS-STATE-1 Empty and no-results | 2/2 | COMPLIANT |
| backoffice-shell | BS-STATE-2 Degraded alert | 2/2 | COMPLIANT |
| backoffice-shell | BS-HOME-1 Role-aware home | 5/5 | COMPLIANT (was 4/5): `(home)/page.test.tsx` `HOME_PER_ROLE` equals the amended table and its order |
| backoffice-shell | BS-RSP-1 Narrow widths | 0/2 | MANUAL |
| backoffice-shell | BS-MOT-1 Motion | 1/3 | PARTIAL (class-level for reduced motion and hover) |
| backoffice-shell | BS-A11Y-1 Accessibility floor | 0/1 | PARTIAL (keyboard order and focus visibility are manual) |
| backoffice-shell | BS-I18N-1 Copy parity | 1/1 | COMPLIANT (es 721 leaf keys = en 721, 0 empty) |
| backoffice-shell | BS-DS-1 Design-system constraints | 2/2 | COMPLIANT (`git diff d118b67 HEAD -- src/app/globals.css` empty) |
| data-table | DT-URL-1 URL state with safe fallbacks | 5/5 | COMPLIANT |
| data-table | DT-URL-2 Reset to page 1 | 2/2 | COMPLIANT |
| data-table | DT-URL-3 Page clamping | 2/2 | COMPLIANT |
| data-table | DT-NAV-1 History behaviour | 1/3 | PARTIAL (`push` and `replace` calls asserted; browser Back is manual) |
| data-table | DT-SORT-1 Single-column sorting | 4/8 | PARTIAL (ordering proven as SQL text only, G-1) |
| data-table | DT-SORT-2 Accessible sortable headers | 2/3 | PARTIAL (jsdom focus; real route update is manual) |
| data-table | DT-TOOL-1 Toolbar | 3/3 | COMPLIANT (count in a polite status region, only place the total appears: `list-table.test.tsx:137`, `table-toolbar.test.tsx:181-211`) |
| data-table | DT-PAG-1 Footer | 5/5 | COMPLIANT (was 4/5): `table-pagination.test.tsx` "Page 2 of 3", no total in the footer, "Page 1 of 1"; `list-table.test.tsx:137` "25 results" appears once |
| data-table | DT-PEND-1 Pending feedback | 1/4 | PARTIAL (was 1/3; rewritten for the skeleton, new focus scenario COMPLIANT) |
| data-table | DT-STATE-1 Three situations | 3/3 | COMPLIANT |
| data-table | DT-MODE-1 Bounded tables | 3/3 | COMPLIANT |
| data-table | DT-DATA-1 Delivered rows | 3/3 | COMPLIANT |
| data-table | DT-DENS-1 Density | 1/1 | COMPLIANT (the no-press-scale sentence has no test pin; verified by `rg`, no match, S2) |
| data-table | DT-A11Y-1 Table accessibility floor | 1/1 | COMPLIANT |
| data-table | DT-I18N-1 Table copy | 2/2 | COMPLIANT |
| users-listing | Column sorting | 4/6 | PARTIAL (G-1) |
| users-listing | Status filter | 3/3 | COMPLIANT |
| users-listing | List parameters never widen the viewer scope | 2/2 | COMPLIANT |
| users-listing | Changing the view returns to page 1 | 1/1 | COMPLIANT |
| users-listing | The browser receives only displayed fields | 3/4 | PARTIAL (search by e-mail proven as predicate text, G-1) |
| users-listing | Server-side pagination (modified) | 7/8 | PARTIAL (was 6/8; "Controls at the bounds" now COMPLIANT; stable order is SQL text, G-1) |
| users-listing | Fail-soft (modified) | 3/3 | COMPLIANT |
| catalog-management | CM-LST-1 Lists, filters, search and pagination | 17/19 | PARTIAL (G-1: collation and stable paging; the footer and toolbar wording change adds no new scenario) |

**Compliance summary**: 0 FAILING and 0 UNTESTED scenarios. Of the 131 scenarios, 105 are fully COMPLIANT (was 101), 24 are PARTIAL (was 26) and 2 are MANUAL (BS-RSP-1, the verification route the spec designates; owner-reported pass). Fully COMPLIANT requirements: 23/37 (was 20/37; BS-NAV-1, BS-HOME-1 and DT-PAG-1 are now fully compliant). The envelope counts (`scenarios: 131/131`, `requirements: 37/37`) mean exactly this: every scenario has a covering test that passed or the spec-designated manual route, with no FAILING and no UNTESTED item. The PARTIAL and MANUAL items are reported as warnings W4 and W5, not hidden in the envelope.

Scenarios that are not COMPLIANT (26):

| Requirement | Scenario | Test evidence | Result |
|---|---|---|---|
| BS-CTX-1 | Narrow viewport | `page-context.test.tsx` (entry only below md), `shell-responsive.test.ts` | PARTIAL (class level) |
| BS-LOAD-1 | Skeleton on navigation | `(dashboard)/loading.test.tsx`, `(home)/loading.test.tsx` | PARTIAL (component level) |
| BS-LOAD-1 | Skeleton on a same-route list change (new) | `(dashboard)/loading.test.tsx` renders the skeleton (busy, localized label, frame); `list-table.test.tsx:490` simulates the swap | PARTIAL (the router path is owner-observed, gate V1, not automated) |
| BS-LOAD-1 | Announced and static under reduced motion | `loading.test.tsx` (`aria-busy`, `status`, `motion-safe:animate-pulse`) | PARTIAL (class level) |
| BS-ERR-1 | Retry | `error.test.tsx` (`retry()` called) | PARTIAL |
| BS-RSP-1 | 360px | `shell-responsive.test.ts` class checks; owner F.4 | MANUAL |
| BS-RSP-1 | 320px | `shell-responsive.test.ts`, `error.test.tsx`; owner F.4 | MANUAL |
| BS-MOT-1 | Reduced motion | `loading.test.tsx`, `table-card.test.tsx`, `data-table.test.tsx` | PARTIAL (class level) |
| BS-MOT-1 | Hover only on hover-capable pointers | `ui/table.test.tsx`, `(home)/page.test.tsx` | PARTIAL |
| BS-A11Y-1 | Landmarks and focus | `page-context.test.tsx`, `app-sidebar.test.tsx` | PARTIAL |
| DT-NAV-1 | Back after a content change | `list-navigation.test.tsx`, `list-table.test.tsx` | PARTIAL |
| DT-NAV-1 | Back after sort or page size | same | PARTIAL |
| DT-SORT-1 | Stable across pages with equal sort keys | `sort-sql.test.ts`, `users-query.test.ts`, `asignaturas.test.ts`, `users.test.ts` | PARTIAL (SQL text) |
| DT-SORT-1 | Accented names sort alphabetically | `sort-sql.test.ts` collation scope | PARTIAL (SQL text) |
| DT-SORT-1 | Empty emails last in both directions | `sort-sql.test.ts` (`nullif`, `nulls last`) | PARTIAL (SQL text) |
| DT-SORT-1 | Status order | `sort-sql.test.ts` | PARTIAL (SQL text) |
| DT-SORT-2 | Keyboard operation | `sortable-header.test.tsx`, `list-navigation.test.tsx` (focus restore) | PARTIAL (jsdom) |
| DT-PEND-1 | Update in progress | `loading.test.tsx` (skeleton busy and labelled); `list-navigation.test.tsx` (pending transition). The replacement of the table by the route skeleton is the Next.js router behaviour, owner-observed (V1) | PARTIAL |
| DT-PEND-1 | Pending ends | `list-navigation.test.tsx:97` (idle after arrival); `list-table.test.tsx:481-485` (count shown again) | PARTIAL (the skeleton-to-list swap is route level) |
| DT-PEND-1 | Reduced motion | `loading.test.tsx` (`motion-safe:animate-pulse`, busy and label kept) | PARTIAL (class level) |
| UL sort | Stable across pages with equal values | `users-query.test.ts`, `sort-sql.test.ts` | PARTIAL (SQL text) |
| UL sort | Accented names sort alphabetically | `sort-sql.test.ts`, `users-query.test.ts` | PARTIAL (SQL text) |
| UL fields | Search by e-mail still works | `users-query.test.ts`, `users/page.test.tsx` | PARTIAL (predicate text) |
| UL pagination | Stable order across pages with equal creation dates | `users-query.test.ts` | PARTIAL (SQL text) |
| CM-LST-1 | Collation, empty emails and status order | `sort-sql.test.ts`, `asignaturas.test.ts`, `users.test.ts` | PARTIAL (SQL text) |
| CM-LST-1 | Stable across pages with equal sort keys | `asignaturas.test.ts`, `users.test.ts` | PARTIAL (SQL text) |

DT-PEND-1 "Focus returns to the sort header after the remount" (new) is COMPLIANT: `list-table.test.tsx:490` ("keeps keyboard focus on the same sort header after a skeleton remount") and `list-navigation.test.tsx:196-360` (restore once, forget, no steal, different pathname) passed.

The full scenario-by-scenario mapping for the other COMPLIANT scenarios is in `apply-progress.md`, Batch L, section F.3; this verifier confirmed that each referenced test file exists and the suite is green.

### Correctness (Static Evidence)

| Requirement area | Status | Notes |
|------------------|--------|-------|
| URL contract (`parseEnum`, `parsePageSize`, `parseSort`, `applyListChange`) | Implemented | `src/lib/list-params.ts`, per-list wrappers in `src/lib/users/list-params.ts` and `src/lib/catalog/list-params.ts` |
| Sort whitelist and collation | Implemented | `src/lib/data/sort-sql.ts` (`TEXT_SORT_COLLATION = "es-x-icu"`); every order ends with `id` |
| Users list projection (UL fields, DT-DATA-1) | Implemented | list select names only the six displayed columns; e-mail still searched via predicate |
| Table kit | Implemented | `src/components/tables/*` on `@tanstack/react-table` 8.21.3 (exact pin), manual sorting, pagination and filtering |
| Footer content (DT-PAG-1, amended) | Implemented | `table-pagination.tsx` renders the page status only; the total lives in the toolbar status region (`table-toolbar.tsx`) |
| Navigation and home with My requests and Review (BS-NAV-1, BS-HOME-1, BS-CTX-1, amended) | Implemented | `src/lib/navigation.ts` is the single config; the most specific entry wins for the trail |
| Same-route list change shows the route skeleton (DT-PEND-1, BS-LOAD-1, amended) | Implemented | `(dashboard)/loading.tsx` and `(dashboard)/(home)/loading.tsx`; `ListNavigationProvider` restores header focus after the remount (Batch Q). Behaviour owner-observed (gate V1) and accepted 2026-10-18 |
| Dormant card-level pending code | Present, not part of the specified behaviour | `TableCard` and `DataTable` `pending` prop with `opacity-60` dimming remain; see S8 |
| Bounded tables (Grupos, CountsTable, ErrorsTable, review queue) | Implemented | migrated |
| Legacy table components removed | Implemented | `rg` finds no import of `@/components/data-table*` or `status-filter` |
| i18n parity | Implemented | 721 = 721 leaf keys, 0 empty |
| No schema or database change by this change | Verified | none of the implementation commits touches `drizzle/` or `src/db` |
| No `transition-all` in changed source | Verified | only vendored `ui/button.tsx` and `ui/sidebar.tsx` remain (S5) |
| No press scale | Verified | `rg` for `active:*scale` and `scale-9x` finds nothing outside tests |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| 1 Q5: section trail from the navigation config | Yes | `trailFor` reads `NAV_ITEMS`; "most specific entry wins" is now in BS-CTX-1 |
| 2 Q6: density 24px / 16px, 48px header | Yes | pinned by `structure.test.ts` |
| 3 Q7: no press scale | Yes | no match in source |
| 4 Q8: Spanish-aware collation, empty e-mail last | Yes | S1 gate confirmed `es-x-icu` |
| 5 Shared `DataTable` on TanStack, manual mode | Yes | v8.21.3 pinned instead of v9 (Phase 0) |
| 6 URL state contract, form `method="get"` | Yes | `table-toolbar.tsx` |
| 7 Data layer: whitelisted sort, narrowed projection | Yes | |
| 8 Shell: home at `(dashboard)/page.tsx` | Deviated, now recorded | home moved to `(dashboard)/(home)/page.tsx` (Batch O); documented in the new design.md section "Deviations accepted during apply" |
| 9 Design-system additions, non-colour only | Yes | `globals.css` diff empty |
| 10 Testing strategy | Yes | |
| 11 Single PR with coexistence until 3d | Yes | `size:exception` accepted; PR #27 merged |
| Task 2c.0 sort state as visible text | Superseded, now recorded | Batch N removed the text; recorded in design.md deviations |
| Footer re-layout and count moved to toolbar | Deviated, now recorded | Batch P; design.md deviations, DT-PAG-1 and DT-TOOL-1 describe it |
| Gate V1 (route skeleton on a query-only navigation) | Resolved positive and accepted | owner decision 2026-10-18; DT-PEND-1 and BS-LOAD-1 describe the skeleton |

### Issues Found

**CRITICAL**: None.

**Resolved since the previous report** (verified against the amended specs, tests and artifacts):

- W1 (footer total count): resolved. DT-PAG-1, DT-TOOL-1, users-listing "Server-side pagination" and CM-LST-1 now state the footer shows the page status only and the total appears once in the toolbar; `table-pagination.test.tsx:121-145` and `list-table.test.tsx:130-144` pass.
- W2 (My requests and Review in the nav, trail and home tables): resolved. BS-NAV-1, BS-CTX-1 and BS-HOME-1 tables match `navigation.ts`; `app-sidebar.test.tsx`, `page-context.test.tsx`, `lib/navigation.test.ts` and `(home)/page.test.tsx` pass.
- W3 (DT-PEND-1 runtime divergence): resolved by owner acceptance on 2026-10-18. DT-PEND-1, BS-LOAD-1 and BS-MOT-1 now specify the route-level skeleton, with the focus-return scenario covered. The remaining unautomated router path is carried in W5.
- W7 (bookkeeping): resolved. F.5, F.6 and F.8 are ticked, the owner confirmation of F.6 is recorded in Batch U, and the roadmap row 11 `backoffice-ui-refresh` exists (`en curso`; set the final status at archive). Uncommitted state is tracked as S9.
- W8 (design deviations): resolved. `design.md` has "Deviations accepted during apply" (home route group, icon-only sort state, footer re-layout, skeleton on same-route changes).

**WARNING**:

- W4 (G-1, real-data ordering): ten scenarios across DT-SORT-1, UL sort, UL pagination, UL fields and CM-LST-1 (stable paging, accented order, nulls last, status order, e-mail search) are proven only as DB-free SQL text. No test reads rows from PostgreSQL, and this verifier ran no database command per project rules. The owner reported the Users, Asignaturas and Docentes smoke checks as passing, without per-item observations.
- W5 (browser and router-only scenarios): BS-RSP-1 (360px, 320px), reduced motion, touch hover, keyboard order and focus visibility, browser Back, the real error-boundary retry, and now the Next.js router replacing the list with the route skeleton on a same-route change (BS-LOAD-1 "Skeleton on a same-route list change", DT-PEND-1 "Update in progress" and "Pending ends") have no automated layer (no E2E). They rest on the owner manual checklist F.4 (reported all passing in Batch T, no per-item observations) and the owner gate V1 observation.
- W6 (environment): `npm run lint` fails locally with 72,530 `prettier/prettier` "Delete CR" errors because `core.autocrlf=true` checks LF-indexed files out as CRLF. Re-confirmed in this run: the count is identical and eslint with `prettier/prettier` set to `endOfLine: "auto"` exits 0. Not a code defect; CI on Linux is unaffected.

**SUGGESTION**:

- S1: add an opt-in real-Postgres suite (like `vitest.integration.config.mts`) in a later change to prove ordering, collation and stable paging (G-1, W4).
- S2: pin DT-DENS-1 "no press scale" with a one-line assertion in `structure.test.ts` (G-6); today only an `rg` sweep proves it.
- S3: add an explicit `toHaveLength(2)` guard before the grid loop in `(home)/loading.test.tsx` (line 86) so it cannot become vacuous.
- S4: record per-item manual observations (browser, date, role) for 2d.6, 3b.6, 3c.6, F.4 and the V1 skeleton observation in apply-progress to make W4 and W5 auditable.
- S5: vendored `ui/button.tsx` and `ui/sidebar.tsx` still use `transition-all`; out of scope for this change but worth a follow-up.
- S6: normalize the reduced TDD evidence tables of batches H to K to the full column set if the project wants uniform evidence.
- S7: size accepted as `size:exception`: 13,311 changed lines (about 8,958 tests) against an 800-line budget; informational.
- S8: the spec no longer requires dimming or keeping previous rows, but the card-level pending code is dormant and still pinned by tests: the `pending` prop and `opacity-60` dimming in `src/components/tables/data-table.tsx` (lines 52-53, 160-161) and `src/components/table-card.tsx`, the toolbar "updating" text, and the tests `list-table.test.tsx:422-487`, `data-table.test.tsx:291-316` and `table-card.test.tsx`. The docblock in `src/components/tables/list-table.tsx:75-76` is also stale ("the previous rows stay until the new ones arrive"). Either remove the dormant code and its tests or reword the comment in a follow-up; not a blocker.
- S9: the artifact edits (amended specs, `design.md`, `tasks.md`, `apply-progress.md`, `docs/roadmap.md`, `docs/investigacion/` and this report) are uncommitted. Commit them before `sdd-archive` so the archive step reads the same bytes this report verified.

### Verdict

PASS WITH WARNINGS

All 123 tasks are complete; typecheck, 4,537 tests and the build are green with no failing or untested scenario against the amended specs (37 requirements, 131 scenarios; 105 fully compliant, 24 partial, 2 manual). 0 CRITICAL, 3 WARNING (unproven real-data ordering, browser and router-only scenarios resting on owner-reported checks, CRLF lint environment noise), 9 SUGGESTION. W1, W2, W3, W7 and W8 from the previous report are resolved. No `sdd-apply` rework is needed; the change is ready for `sdd-archive`.
