```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:37fede72bdd0799bec0b009a3c7816c2c45d69767c48a7f025c944dcce49d4d3
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 29/29
scenarios: 120/120
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:02404d0992bcee9b478b83f1241cd9b7db66b2ce924f3f03b6e15a15a0ec7ff7
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:3a932fb9c9f2323142e74b5bf79a4fecb169ae61491fa4506d80ae0a3fb720f7
```

## Verification Report

**Change**: secretary-review (whole change, slices S1-S6, PRs #18-#24)
**Mode**: Strict TDD
**Revision**: tracker branch `feat/secretary-review` @ 8fd241c, clean working tree. Verified 2026-10-13.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 104 (Phases 1-6b: 92, Phase 7: 8, Phase 8: 4) |
| Tasks complete | 91 checked (Phases 1-6b except 2.5) |
| Tasks incomplete | 13 |

Incomplete tasks, all deliberately gated and outside the code scope of this verify:
- 2.5 STOP [CONFIRM]: the migration is never applied by the slices; it is applied in Phase 7. Intentional gate, not a missing deliverable. 0008 was already rehearsed on a disposable Neon branch (task 3.16).
- 7.1-7.8 (Phase 7): production migration and data steps, owner-run with explicit confirmation per command.
- 8.1-8.4 (Phase 8): archive, spec sync, roadmap update. Run after this verify.

All code, test and doc tasks of Phases 1-6b are checked, including the owner manual harnesses (4.11, 5.8, 6.14, 6b.16) and the integration run (3.16).

### Build & Tests Execution
- `npm test` (vitest run): exit 0, 183 files, 3711 passed / 0 failed, 88.5 s.
- `npx next typegen`: exit 0. `npm run typecheck` (tsc --noEmit): exit 0, no errors.
- `npm run build`: exit 0 (`/review`, `/review/[id]`, `/requests`, `/requests/[id]`, `/requests/[id]/correct` dynamic).
- `npx eslint src -f json`: exit 1 only because of 70,243 CRLF "Delete" messages (known Windows gotcha); 0 real errors, 0 warnings after filtering.
- Coverage: not available (no tool configured).
- Integration suite (`npm run test:integration`) NOT run here by instruction (no database access). Evidence is the owner-approved run of 2026-10-12 on disposable Neon branch `test-secretary-review`: 6/6 on 2 consecutive runs (2 concurrent-decision cases plus 4 intake), 0008 applied cleanly (__drizzle_migrations 8 to 9, production stayed at 8), branch deleted.
- Owner manual walk of 2026-10-13 on disposable branch `test-walk-secretary-review` (0008 plus seeded accounts, deleted afterwards): S4, S5a, S5b and S6 passed at 1280 and 360 px, `scrollWidth > clientWidth` false on every screen, out-of-facultad request hidden, unknown id not found. Read-only DB check: one audit row per decision (aprobada, devuelta, rechazada 1 each), solicitud.corregida 1, documento.retirado 1, one SolicitudRevision v1, cola.consultada 7 and consultada 5 matching the opens.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | WARNING | apply-progress has one evidence table per slice (task, state, evidence incl. RED observations) rather than the canonical RED/GREEN/TRIANGULATE/SAFETY NET columns |
| All tasks have tests | OK | every behavior task has its test file; 83 test files touched on the branch |
| RED confirmed | OK | RED outcomes recorded per task (e.g. "22 failed, SQL missing", "RED: 14 failed", "module missing", mutation checks in 5.7, 6.11, 6.12); all referenced files exist |
| GREEN confirmed | OK | full suite 3711/3711 now |
| Triangulation | OK | table-driven or multi-case tests for transitions, business-day boundaries, text bounds, RN-17 codes, scope matrix, diff cases |
| Safety net | OK | safety-net counts recorded for modified modules (sidebar 94/94, solicitudes/documentos 74/74) |

**Assertion quality**: spot audit of the review, requests, data-layer and structure tests found no tautologies and no ghost loops (the `it.each` over links is guarded by a "finds the Link elements" test, so it cannot run empty); the structural tests assert on real file content. The data-layer unit tests are db-double based and mock-heavy, as in the intake change (WARNING 3).

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit and component | 3711 (whole repo; 83 files touched by this change) | 183 | vitest, Testing Library |
| Integration (real Postgres, opt-in) | 6 | 1 | vitest, disposable Neon branch (not rerun here) |
| E2E | 0 | 0 | not installed (manual owner walk instead) |

### Spec Compliance Matrix
Totals: 29 requirements, 120 scenarios (request-review 11/36, student-requests 6/27, supporting-documents 4/26, audit-log 6/22, staff-account-creation 2/9). A scenario is COMPLIANT when a covering test passed in this run; real-Postgres scenarios also cite the owner integration run.

| Requirement (capability) | Scenarios | Covering tests | Result |
|---|---|---|---|
| Review authorization and facultad scope (RR) | other role denied, out-of-scope, no facultad, facultad follows career, draft never visible (5) | review/page.test, review/[id]/page.test and actions.test (guard, none scope, same notFound), permissions.test canViewDocument, request-scope.test (fail closed), request-scope-sql.test (EXISTS via Carrera.FacultadId, snapshot name never used, none = false, unknown kind throws), solicitud-detail.test; owner walk: out-of-facultad hidden | COMPLIANT x5 |
| Queue ordering and RN-08 alert (RR) | ordering, boundaries table, holiday, Managua vs UTC, calendar year not loaded, decided leave queue (6) | business-days.test, constant-calendar.test, calendar.test (staleness on real clock), revision-queue.test (pendiente only, ORDER BY coalesce, Managua date, resubmission clock), review/page.test badges | COMPLIANT x6 |
| Staff detail with history (RR) | corrected request, actions only when pendiente (2) | review/[id]/page.test (history, versions, retired docs, decision panel only while pendiente), solicitud-detail.test | COMPLIANT x2 |
| Changes since the return (RR) | unchanged, changed subjects, retired and new docs, first-time none, no extra audit row (5) | revision-diff.test (13), review/[id]/page.test changes-since-the-return block (incl. exactly one audit row), design-system.test | COMPLIANT x5 |
| State transitions (RR) | concurrent decisions, decide decided, coordination unreachable, failure rolls back (4) | transitions.test, solicitud-decision.test (guarded UPDATE, conflict, rollback on audit failure), integration 6/6 incl. 2 concurrent-decision cases (owner run) | COMPLIANT x4 |
| Approve (RR) | finality text, without text, edited template (3) | decision-dialog.test (finality es/en, single confirm, prefill/edit), solicitud-decision.test, actions.test | COMPLIANT x3 |
| Return with RN-17 code (RR) | valid return with snapshot, missing/foreign code (2) | solicitud-decision.test (snapshot Numero = max+1, devuelta link), decision-validation.test, decision-dialog.test, actions.test | COMPLIANT x2 |
| Reject with text and confirmation (RR) | confirmed, bounds table, cancel, client bypass (4) | decision-validation.test (1000 ok, 1001 refused), actions.test (direct call refused), decision-dialog.test (two-step, cancel, Escape) | COMPLIANT x4 |
| Predefined editable templates (RR) | prefill, free text only in decision row (2) | decision-templates.test, review/[id]/page.test prefill, events.test payload leak sweep | COMPLIANT x2 |
| Decision data is append-only (RR) | two decisions over a correction (1) | append-only.test (structural), solicitud-detail.test ordering, migration-secretary-review.test (no cascade) | COMPLIANT x1 |
| Review UI usability and i18n (RR) | keys present, menu per role (2) | review-messages.test, catalog-parity.test, app-sidebar.test | COMPLIANT x2 |
| Own requests list (SR) | list own, other role denied, unauthenticated (3) | requests/page.test, student-requests.test | COMPLIANT x3 |
| Own request detail with decision (SR) | returned reason, another student, own reads no audit, draft not found (4) | requests/[id]/page.test, student-requests.test | COMPLIANT x4 |
| In-place correction of a returned request (SR) | successful, not devuelta, no draft, clock restarts, concurrent resubmit, failure rolls back, 3 guided starts, every step reachable, explicit step wins (12) | solicitud-correction.test, correct/actions.test, correct/page.test, correction-focus.test, steps.test, revision-queue.test (clock); concurrent resubmit only at db-double level | COMPLIANT x12 (concurrent resubmit at unit level only, see WARNING 1) |
| Correction validation (SR) | RN-23 not re-applied, RN-05, subject outside enrollment, no valid doc, forged owner (5) | solicitud-correction.test, correct/actions.test, submission.test | COMPLIANT x5 |
| Revision history and soft retirement (SR) | replaced document retained, history visible (2) | documentos.test (retire vs delete), requests/[id]/page.test, student-requests.test | COMPLIANT x2 |
| Student screens at 360 px and i18n (SR) | no horizontal scroll, keys present (2) | requests/design-system.test, correct-design-system.test, requests-messages.test, correction-messages.test; owner console check at 360 px false on every screen | COMPLIANT x2 |
| Soft retirement on correction (SD) | retire not delete, added doc deleted, cap ignores retired, sweep keeps retired (4) | documentos.test, upload-token route.test, intake-sweep.test (SR-14, mutation check) | COMPLIANT x4 |
| Upload authorization and limits (SD) | token own draft, token own returned request, denied, oversize or wrong type at the store (4) | upload-token route.test (draft and correction, foreign and not-devuelta denied, limits payload); store-side refusal not observed | COMPLIANT x4 (store-side refusal judged at system level, see WARNING 2) |
| At most five documents (SD) | sixth rejected, pending counts, concurrent finalize, removal frees slot, correction cap excludes retired (5) | upload-token route.test, documentos.test, integration cap cases (owner run) | COMPLIANT x5 |
| Authenticated inline view (SD) | owner inline, view link, other student denied, download audited, failed not audited, no public URL, staff inline, staff attachment, retired visible, out-of-scope denied, drafts/unfinalized denied, no facultad or other role denied, unknown mode (13) | documents/[id]/route.test (modes, RFC 5987, headers, scope denials identical and no row, audit order, audit failure no bytes), permissions.test canViewDocument, documentos.test; owner walk View/Download | COMPLIANT x13 |
| Closed set of review events (AL) | action to entity type table (1) | events.test, types.test | COMPLIANT x1 |
| One audit row per decision and correction (AL) | successful table, lost race, nothing written on refusal (3) | solicitud-decision.test, solicitud-correction.test, actions tests, integration (owner run); read-only DB check after the walk | COMPLIANT x3 |
| Staff reads are audited (AL) | detail open, queue open, prefetch and re-render, denied writes nothing, audit failure blocks, student reads not audited (6) | request-reads.test (cache, rollback), review page tests (exactly one row, none on throw, no data on audit failure), structure.test (17), requests page tests; owner DB check cola 7 / consultada 5 equal opens | COMPLIANT x6 |
| Review payloads minimise personal data (AL) | decision codes, return code, queue count only, download mode (4) | events.test leak sweep and key sets, route.test mode | COMPLIANT x4 |
| Scope limited to write events, MODIFIED (AL) | preview no audit, staff read in scope, student own read out of scope (3) | import preview tests (unchanged), review page tests, requests page tests | COMPLIANT x3 |
| Every download is audited, MODIFIED (AL) | successful, two downloads two rows, no row on denial table, audit failure blocks, staff mode (5) | documents/[id]/route.test | COMPLIANT x5 |
| New secretaria accounts inherit the facultad of the creating coordinator (SAC) | creates in facultad, forged ignored, no career refused, other roles null (4) | users/new/actions.test (SR-16 block), users.test, users-data.test, events.test (facultadId in AUDITABLE_USER_FIELDS) | COMPLIANT x4 |
| Check (b), MODIFIED (SAC) | allowed pairs, disallowed redirect, estudiante validation, hand-crafted role, decided before write (5) | users/new/actions.test | COMPLIANT x5 |

**Compliance summary**: 120/120 scenarios COMPLIANT, 0 PARTIAL, 0 FAILING, 0 UNTESTED; 29/29 requirements. Two scenarios are COMPLIANT with caveats, as in the justification-intake precedent: concurrent resubmit (no real-Postgres run, WARNING 1) and oversize at the store (store-side refusal not observed, WARNING 2).

### Exactly-once audited read and fail-closed scope
- The only call sites of `recordRequestRead` and `recordQueueRead` outside tests are `review/[id]/page.tsx:123` and `review/page.tsx:57`, each after authorization and after the data load and every derived value (renderedTemplates, changesSinceReturn). There is no try/catch around them, so an audit failure throws and no data is returned.
- `structure.test.ts` (17 tests) pins: write only from the two page modules, never from a layout or loading file, each helper called exactly once after the data load, no client-side triggers, every `<Link>` to `/review*` and the sidebar entry with `prefetch={false}`, no revalidatePath or router.refresh, the decision action ends in a redirect, and cacheComponents/partial prefetching stay off. Both writers are wrapped in React `cache()`.
- Scope: `requestInScope` is an EXISTS over the current career facultad of the student, bound as a parameter, `none` renders literal false, an unknown scope kind throws, and the snapshot career name is never used. `resolveRequestScope` reads the DB per request and fails closed (no facultad, missing account). Out-of-scope, draft and unknown ids share the same `notFound()` or 404. The owner walk confirmed it live.

### Design-system compliance (docs/design-system.md)
Source scan found no hex colors, no palette utility colors, no arbitrary px values and no inline styles in the review or requests modules. Design-system tests pin tokens, type and spacing steps, pill badges with text, 44 px targets, dialog hierarchy (reject trigger secondary, destructive confirm, cancel ghost), alert pattern and banner (role=status), and 360 px guards (review 24 tests, requests 21, correction 15, plus S6 additions). The owner walk confirmed no horizontal scroll at 360 px on every screen. S4 status pills use the 12/4 spacing steps instead of the catalog pill 10/2 (documented, on-grid).

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| SR-1 Schema, SR-2 migration | Yes | 0008 generated, additive, journal `when` later than 0007, no cascade, no Grupo FK. Deviation: `CK_SolicitudDecision_Texto` made null-safe (documented, stricter than design) |
| SR-3 class reader | Yes | single join in solicitud-clases.ts |
| SR-4 transitions table | Yes | SQL guards pinned against the table; en_revision_coordinacion has no edge |
| SR-5 business days | Yes | pure module, port, constant calendar, staleness test; calendar validated by the owner 2026-10-12 |
| SR-6 scope fail-closed | Yes | see above |
| SR-7 decision transaction | Yes | null/invalid return variants are documented deviations; real-Postgres concurrent run |
| SR-8 templates, SR-9 audit codes only | Yes | leak sweep tests |
| SR-10 staff UI | Yes | minor documented deviations (conflict banner, two renderings of queue rows) |
| SR-11 exactly-once read | Yes | with the Main Sync amendment |
| SR-12 document route modes | Yes | |
| SR-13 student pages and correction | Yes | EditTarget, retire vs delete, resubmit |
| SR-14 sweeps untouched | Yes | test added, code unchanged |
| SR-15 slices, SR-16 facultad derivation | Yes | S4 shipped as size:exception by owner decision |
| SR-17 guided correction and change flags | Yes | no schema, no new audit event |
| Main Sync and Requirements Sync notes | Yes | no consent or extraction hooks needed yet; resubmitCorrection remains the hook point |

### Issues Found
**CRITICAL**: None.

**WARNING**:
1. Concurrent resubmit is not proven on real Postgres: the opt-in integration suite covers concurrent decisions and the document cap, but not two simultaneous `resubmitCorrection` calls. Evidence is the db-double unit test (loser changes nothing, adds no audit row), the guarded UPDATE SQL pin (Estado = devuelta), and the same row-lock mechanism proven for decisions. Judged COMPLIANT on the unit evidence plus the proven mechanism; a real-Postgres case would close it.
2. Oversize or wrong type at the store: store-side rejection is a Vercel Blob guarantee of the signed token; the token constraints and finalize-side refusal are unit-tested, but the store itself was never observed refusing (same caveat as justification-intake, carried over).
3. TDD evidence is reported per slice but not in the canonical RED/GREEN/TRIANGULATE/SAFETY NET table; data-layer tests are db-double and mock-heavy (SQL shape and call order are asserted, not execution), which is why the real-Postgres runs matter.
4. The integration suite is opt-in and was not rerun in this verify (instruction); it is not part of `npm test` or CI. Evidence is the owner run of 2026-10-12.
5. Task 2.5 and Phases 7 and 8 are unchecked by design (migration apply gate, production data steps, archive). Phase 7 needs the owner confirmation per command.
6. Operational prerequisite before pilot use: production has no secretaria with `FacultadId` until task 7.7 (SR-16 (a)); until then every secretary is fail-closed and sees the no-faculty-assigned alert. Preflight P2 (students with CarreraId NULL are invisible) must be read before Phase 7.
7. The calendar staleness test uses the real clock by design: it will fail at the start of 2028 until `NON_WORKING_DAYS[2028]` is added.

**SUGGESTION**:
1. Add a concurrent-resubmit case to the opt-in integration suite.
2. Run the integration suite in CI against an ephemeral Postgres.
3. Add a canonical TDD evidence table to future apply-progress files.
4. Consider a raw oversize PUT check against the store (carried from intake).
5. Revisit the RF-14 and RF-11 hook points (staff detail extra section, resubmitCorrection) when validation-signals and document-extraction land.

### Verdict
PASS WITH WARNINGS. 0 CRITICAL, 7 WARNING, 5 SUGGESTION. The change may proceed to Phase 7 (owner-confirmed production migration and the F1 facultad update) and then Phase 8 (archive, spec sync, roadmap update).
