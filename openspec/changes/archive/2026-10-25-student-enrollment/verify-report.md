```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:72e09cf4276146f06f72ad3527cca1edc6753af565dd9aa6ad123df1f2fb588d
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 24/24
scenarios: 92/92
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:0ab13c4c41ff36f33bc354514e0503be8159e6e132a9e3bde21352fa48dfcd7c
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:174d01b8ed3c5910852a3d9286c558e5d804b53e84c054b5239e70f0a69721a0
```

## Verification Report

**Change**: student-enrollment (whole change: WU1 data, WU1b picker, WU2a-2d route and UI, WU3 intake, shell and docs)
**Version**: N/A (6 delta specs: student-enrollment, academic-catalog, audit-log, justification-intake, student-requests, backoffice-shell)
**Mode**: Strict TDD (vitest, jsdom)
**Revision**: `feat/student-enrollment-3-intake` @ `585c0d500bfeebde1eac907718ea855a1c672d28` (tip of the chain). `evidence_revision` is the sha256 of `git diff feat/student-enrollment...HEAD` with `.engram/` excluded (tracker `419359461546d3801cc0a36ee36f94f19e2cf69e`). 56 files, +4164/-84 authored lines excluding `openspec/` and `.engram/`. Worktree clean before and after the gates. Verified 2026-10-24.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 86 (Phases 0-14) |
| Tasks complete | 70 checked |
| Tasks incomplete | 16 |

Incomplete tasks, none of them code or test work:
- PR opening or merge dependent: 0.4, 5.3, 8.3, 12.2 (second half), 12.3.
- Measurement recorded but box left unchecked: 5.2 and the measuring half of 12.2 (see SUGGESTION 3).
- Owner-gated Phase 13 (13.1-13.5): disposable Neon branch, manual walk, read-only audit query. Pending by design.
- Phase 14 closeout (14.1-14.5): this verify, spec sync, roadmap `archivado`, archive, tracker merge. Pending by design.

The verify skill treats an unchecked core task as CRITICAL. These 16 are PR, owner-gated or closeout steps (the brief scopes them out), none describes work missing from the code, so they are not counted as CRITICAL (same precedent as `request-consent` and `teacher-remission`).

All behavior tasks of Phases 0-4, 6, 7, 9, 10, 11 and the gate tasks 5.1, 8.1, 8.2, 8.2b, 12.1 are checked and match the code state (every referenced file exists; each `feat(enrollment)` commit carries its tests).

### Build & Tests Execution
Dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x` and a dummy `AUTH_SECRET` of at least 32 characters; no database was contacted.

| Gate | Command | Exit | Result |
|------|---------|------|--------|
| Types | `npx next typegen && npm run typecheck` | 0 | clean |
| Tests | `npm test` | 0 | 246 files, 5344 tests passed, 0 failed, 0 skipped |
| Lint | `npx eslint --rule "prettier/prettier: [error, {endOfLine: auto}]" src` | 0 | clean |
| Format | `npx prettier --check --end-of-line auto src i18n` | 0 | all files conform |
| Build | `npm run build` | 0 | passes; `/enrollment` listed as dynamic |

**Coverage**: not run (no coverage script in `package.json`); informational only.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | WARNING | No `apply-progress` artifact retrievable (none under the change folder, no memory tool in this executor); per-unit apply notes with gate results live in the `tasks.md` annotations |
| All tasks have tests | OK | every behavior commit ships test files (writer 2 test + 3 code files, picker 1+1, actions 2+3, list 4+2, page 1+1, picker UI 4+2, nav 6+2, intake data 1+1, intake UI 6+6) |
| RED confirmed (tests exist) | OK | every test file named in tasks exists |
| GREEN confirmed (tests pass) | OK | 246/246 files, 5344/5344 tests pass now |
| Triangulation adequate | WARNING | three table-driven data tests share one script per table (see Assertion Quality) |
| Safety net for modified files | OK | `enrollment.test.ts`, `inscripcion-writes.test.ts`, `types.test.ts`, `events.test.ts` and the intake tests were edited in place and pass |

RED-before-GREEN order cannot be proven from history because each unit is committed as test plus code together, as the tasks file prescribes.

### Assertion Quality
| File | Line | Assertion | Issue | Severity |
|------|------|-----------|-------|----------|
| `src/lib/data/enrollment-write.test.ts` | 117-132 | `it.each` of 4 labels (older period, grupo inactive, asignatura inactive, unknown id) | all four run the same script (`rows: []`) and the label is unused. It proves "no target row -> not_eligible", not each state. The distinguishing logic is the SQL predicate, pinned separately at 148-157 | WARNING |
| `src/lib/data/enrollment-write.test.ts` | 161-177 | `it.each` of 6 labels (4 roles, inactive estudiante, unknown id) | same script for every row; the role filter is pinned separately at 179-192 (`Rol.Codigo`, `Usuario.Activo`, params `estudiante`) | WARNING |
| `src/lib/data/enrollment-write.test.ts` | 323-336 | `it.each` of 3 drop refusals | same script for every row | WARNING |
| `src/lib/audit/types.test.ts` | 101-104 | `expect(inscripcion).toBe("Inscripcion")` | runtime-trivial; the real guard is the `AuditEntityType` assignment checked by `tsc` | WARNING |
| `src/app/(dashboard)/enrollment/group-picker.test.tsx` | 181-190 | `queryAllByText(truncated)` length equals `Number(truncated)` | loosened from `toBeVisible`; still asserts presence both ways, loses the visibility check | SUGGESTION |

No tautologies, ghost loops or smoke-only tests were found in the new files. **Assertion quality**: 0 CRITICAL, 4 WARNING.

### Test Layer Distribution
28 test files were created or modified. Data, audit, validation and action tests run in the node environment against `createDbDouble` or mocks; component, page and i18n tests run in jsdom with Testing Library. There is no E2E layer (not installed). Per-layer test counts were not tallied. No test executes a real SQL statement; concurrency and rollback are argued from the lock and the transaction boundary, as the design states ("Concurrency is argued (SE-1), not executed").

### Spec Compliance Matrix
24 requirements, 92 scenarios: 83 COMPLIANT, 9 PARTIAL, 0 UNTESTED, 0 FAILING. The envelope counts a scenario as complete when a passing test covers it or, for the documentation scenario, its designated manual readback (task 11.3); the 9 PARTIAL scenarios are therefore counted complete in the envelope and listed explicitly below. COMPLIANT means a passing test asserts the behavior through the double or pins the SQL predicate that implements it. Capability codes: SE student-enrollment, AL audit-log, AC academic-catalog, JI justification-intake, SR student-requests, BS backoffice-shell.

| Requirement (capability) | Scenarios | Covering tests | Result |
|---|---|---|---|
| Enrollment access and identity (SE) | 3 | `actions.test.ts` (4 roles x 2 actions, anonymous, forged id), `page.test.tsx` access | 3/3 COMPLIANT |
| Latest period and offered groups (SE) | 3 | `enrollment-picker.test.ts` getLatestPeriod (predicates), `enrollment-write.test.ts:148`, `page.test.tsx` noOffering | 3/3 COMPLIANT (period logic SQL-pinned) |
| Own effective enrollments list (SE) | 4 | `enrollment-picker.test.ts` listMyEnrollments, `my-enrollments.test.tsx`, `page.test.tsx` | 4/4 COMPLIANT |
| Picker with own carrera first (SE) | 5 | `group-picker.test.tsx` 96-210 | 5/5 COMPLIANT |
| Enroll in an offered group (SE) | 3 | `enrollment-write.test.ts` outcomes, no-count, reactivate | 3/3 COMPLIANT (not-offered rows weakly triangulated, WARNING 2) |
| One active group per asignatura and period; replace (SE) | 5 | `enrollment-write.test.ts` replace; `group-picker.test.tsx` replace | Replace, Cancel replace, Other asignaturas: COMPLIANT. **Replace is atomic: PARTIAL** (rethrow and no-audit asserted at 250-285; the rollback itself belongs to the database). **Racing enrollments: PARTIAL** (argued; lock clause pinned at 179-192) |
| Drop with confirmation (SE) | 4 | `my-enrollments.test.tsx` 93-165, `enrollment-write.test.ts` 297-354 | Confirm, Cancel, Refusals: COMPLIANT. **Presented requests unaffected: PARTIAL** (no assertion; the writer issues no `Solicitud` statement, implicit in the scripted statement list) |
| Warning for dependent requests (SE) | 4 | `enrollment-picker.test.ts:124`, `my-enrollments.test.tsx:110`, `group-picker.test.tsx:292` | Draft, Returned, No warning: COMPLIANT. **Request data untouched: PARTIAL** (same reason) |
| Enrollment feeds the intake (SE) | 2 | `enrollment.test.ts` (list), `new/actions.test.ts:322` (submit block) | **2 PARTIAL**: each half is tested, no test crosses writer and intake |
| Docente contact data never exposed (SE) | 1 | `enrollment-picker.test.ts:186` (column set), `page.test.tsx:346` (props and HTML) | 1/1 COMPLIANT |
| Degraded read and write failure (SE) | 2 | `page.test.tsx:320-344`, `group-picker.test.tsx:223`, `confirm-change-dialog.test.tsx:126`, `actions.test.ts:123` | 2/2 COMPLIANT |
| Usable at 360 px and both locales (SE) | 2 | `layout-360.test.tsx`, `enrollment-messages.test.ts` | Key parity COMPLIANT. **No horizontal scroll: PARTIAL** (static class guard; jsdom has no layout; walk 13.3 pending) |
| Requirements documentation synchronised (SE) | 1 | none automated; verified by readback in this run | COMPLIANT by the designated manual readback of task 11.3 (done in this run, see Docs) |
| Closed set of enrollment events (AL) | 2 | `types.test.ts`, `events.test.ts` | 2/2 COMPLIANT |
| One audit row per change, same transaction (AL) | 3 | `enrollment-write.test.ts` 195-248 and 297-321, `events.test.ts` | 3/3 COMPLIANT |
| Payloads carry identifiers only (AL) | 2 | `events.test.ts` key and leak test | 2/2 COMPLIANT |
| Estudiante role integrity of Inscripcion (AC) | 5 | `inscripcion-writes.test.ts`, `enrollment-write.test.ts` | 5/5 COMPLIANT |
| Active-only reads for downstream consumers (AC) | 7 | `catalog.test.ts:184-250`, `enrollment.test.ts` (D12 pin) | 5 COMPLIANT. **Reactivated rows visible again** and **Reactivating the asignatura restores visibility**: PARTIAL (query shape only, no state-transition test; inherited from the base spec) |
| Subject eligibility and group display (JI) | 14 | `enrollment.test.ts`, `subjects-step.test.tsx`, `new/page.test.tsx`, existing `eligibility.test.ts` and `new/actions.test.ts` | 14/14 COMPLIANT |
| Entry nudge when the student has no enrollment (JI) | 3 | `new/page.test.tsx` nudge block, `new/layout-360.test.tsx` | 3/3 COMPLIANT |
| Own requests list (SR) | 5 | `requests/page.test.tsx` | 5/5 COMPLIANT |
| BS-NAV-1 Sidebar entries unchanged (BS) | 4 | `navigation.test.ts`, `app-sidebar.test.tsx` | 4/4 COMPLIANT |
| BS-HOME-1 Role-aware dashboard home (BS) | 5 | `(home)/page.test.tsx` | 5/5 COMPLIANT |
| BS-NAV-3 Enrollment destination (BS) | 3 | `app-sidebar.test.tsx`, `page-context.test.tsx`, `navigation.test.ts` | 3/3 COMPLIANT |

**Compliance summary**: 83/92 fully compliant, 9 partial (the ones in bold), 0 untested, 0 failing.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Role guard on page and every action | OK | `page.tsx:35` and `actions.ts:29` call `requireRole(...rolesSolicitantes)` first; the writer re-checks the role in the database (`enrollment-write.ts:42-56`), so a stale JWT is stopped |
| Identity from the session | OK | `actions.ts:35` passes `Number(session.sub)`; the zod schema drops `estudianteId` (`validations/inscripcion.ts`) |
| No IDOR | OK | the drop predicate carries the session student id (`enrollment-write.ts:149-155`); reads are scoped by the session id |
| Input validation | OK | `z.number().int().positive()`; `?asignatura=` parsed with a positive safe-integer regex (`page.tsx:12-20`) |
| Docente email and phone | OK | no query selects them; the page maps explicit fields (`page.tsx:44-67`); tests assert the column set and the serialized HTML |
| No deletes, no `withCatalogWrite` | OK | none in the writer, picker or actions; the allowlist test enforces it |
| Lock clause renders as designed | OK | checked with the drizzle QueryBuilder: the select ends in `for no key update of Usuario` (quoted identifier) |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| SE-1 per-student lock `FOR NO KEY UPDATE OF Usuario`, one transaction, guarded statements | Yes | `lockStudent`, then `work`, then audit on the same `tx` |
| SE-2 statement order and results | Yes (minor) | the reactivation `update` is not guarded by `not Activo` (`enrollment-write.ts:126`), harmless under the lock (SUGGESTION 1) |
| SE-3 role integrity in data layer and edge | Yes | |
| SE-4 latest period over active grupo AND active asignatura | Yes | write-time subquery (`enrollment-write.ts:23`) and `getLatestPeriod` |
| SE-5 picker reads, capped, own carrera first | Yes | `CATALOG_OPTIONS_MAX` = 2000 with `truncated` |
| SE-6 `?asignatura=` page state | Yes | |
| SE-7 `inOpenRequest` in one query | Yes | `borrador` and `devuelta` only, session student only |
| SE-8 audit entity id is the student id, payload `grupoId` plus `motivo` | Yes | `events.ts` `inscripcionEvent` and `enrollmentWriteEvents` |
| SE-9 permissions and nav | Yes | `canManageOwnEnrollment = canFileRequests` |
| SE-10 actions | Yes | return error codes mapped to `enrollment.errors.*` (documented in task 6.7) |
| SE-11 intake changes | Yes | `Asignatura.Activo` filter, `enrolled`, `hasActiveEnrollmentFailSoft`, notice, `/requests` link |
| SE-12 allowlist | Yes | `ALLOWED_WRITERS` holds only `lib/data/enrollment-write.ts` |

### Docs
RF-16 (priority Alta), RF-12 (c), RN-21 and the 2026-10-24 changelog row are present and agree with the specs. The changelog counts (16 RF, 14 RNF, 25 RN) match the tables (16, 14 and 25 rows). Roadmap row 14: responsable Josue, prototype No, state `pendiente`, IDs match the spec header, plus a note on the unverified declaration (RN-15).

### Issues Found
**CRITICAL**: None.

**WARNING**:
1. Nine scenarios are PARTIAL (bold in the matrix); none is UNTESTED or FAILING. Atomicity, the race and the 360 px layout can only be proven against a real database and browser; the Phase 13 walk (13.3, 13.4) is the planned evidence and is pending.
2. Table-driven data tests that do not vary their input (`enrollment-write.test.ts:117-132`, `161-177`, `323-336`): the cases are labels over one script. The discriminating SQL is pinned in separate tests, so behavior is covered by shape, not by state. Consider a disposable-branch integration run (as `request-consent` 8.7 did) before archive.
3. No `apply-progress` / TDD Cycle Evidence artifact could be retrieved in this run; RED-before-GREEN is not provable from history (tests and code share commits).
4. `src/lib/audit/types.ts`, its pinned-count test, `i18n/*.json` and `catalog-parity.test.ts` are shared with the parallel `document-extraction` change (proposal, Dependencies). Whichever merges second must reconcile the pin tests.
5. `src/lib/audit/types.test.ts:101-104` is runtime-trivial (type-level guard only).

**SUGGESTION**:
1. `enrollment-write.ts:126`: add `not Activo` to the reactivation `update`, as design SE-2 step 5 says.
2. `group-picker.test.tsx:181-190`: restore a visibility assertion for the truncated notice when `truncated` is true.
3. `tasks.md`: 5.2 and the measuring half of 12.2 hold recorded results but are unchecked; split the PR-opening half out so the box reflects the work. Line 39 and task 6.1 still name `-2-ui`; the table at lines 29-35 has the real 2a-2d chain.
4. `docs/requirements.md` RF-16 row is not column-padded like the neighboring rows (cosmetic; the repository format check already fails on `docs/`).
5. `requests/new/page.tsx` issues `hasActiveEnrollmentFailSoft` on every render, also on steps 2 and 4 where `listEnrollmentFailSoft` already knows `enrolled`; one extra cheap read, accepted by design SE-11.

### Verdict
PASS WITH WARNINGS
All five gates exit 0 (5344 tests), every requirement is implemented and covered, and the design decisions and security rules hold; only database-level behavior (atomicity, race, real layout) is argued rather than executed, and the owner walk is still pending.

### Remediation
Applied at the chain tip (`feat/student-enrollment-3-intake`) as follow-up commits after this verify; gates re-run green (typecheck, 246 files / 5342 tests, eslint, prettier on `src` and `i18n`, build).

- SUGGESTION 1: the reactivation `update` in `enrollment-write.ts` now also requires `not Activo` (`fix(enrollment): guard the reactivation update on inactive rows`, test first, red then green).
- WARNING 2: each row of the three table-driven writer tests now asserts the rendered predicate that excludes it (`test(enrollment): assert the excluding predicate for each refusal row`). The four non-estudiante roles collapsed into one row because they share one predicate (`Rol.Codigo`), which is why the suite went from 5344 to 5342 tests. Atomicity and the race stay unproven without a real database (WARNING 1 is unchanged).
- SUGGESTION 2: the truncated notice is asserted with `toBeVisible` again, keeping the table form (`test(enrollment): assert the truncated notice is visible`).
- SUGGESTION 3: `tasks.md` names the real 2a-2d chain, 5.2 and the measuring half of 12.2 are checked, and the PR-opening half is split out as 12.2b (unchecked).
- SUGGESTION 4: the RF-16 row of `docs/requirements.md` is padded like its neighbors.
- Left as-is: WARNING 3 (no apply-progress artifact), WARNING 4 (shared `document-extraction` pins), WARNING 5 (type-level audit test) and SUGGESTION 5 (accepted by design SE-11).
