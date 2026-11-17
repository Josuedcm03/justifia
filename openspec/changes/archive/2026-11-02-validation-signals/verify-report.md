```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:9e2fbd5cf242077c84dfc14f0641ccb100f0cbc9530ffc8632e6cc3bfd557746
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 19/19
scenarios: 76/76
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:69b05670988b137176bda5424c1311754c087e28871878c4a48ebc9156403ae6
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:f2cbbbb191d7d62906ae878fdb2a44507726ff4ca341b4a9aefe69c0847edf74
```

## Verification Report

**Change**: validation-signals
**Version**: N/A (5 spec files, 19 requirements, 76 scenarios; counted from the `### Requirement:` and `#### Scenario:` headings: 1 + 3 + 1 + 2 + 12 requirements, 8 + 12 + 5 + 12 + 39 scenarios)
**Mode**: Strict TDD
**Head verified**: f5e4744 (branch `docs/validation-signals-closeout`; tree ca15878d47c00c160cf273271f00af9a348907b2). Working tree clean; nothing edited, committed or pushed by this verification. No database was contacted, no `drizzle-kit` was run, and the opt-in integration suite was not run by this verifier.
**Evidence revision**: sha256 of three lines (each ending in a newline): `tree:<HEAD tree>`, `test:<test_output_hash>`, `build:<build_output_hash>`.
**Supersedes**: the report on 3d4072d (committed as db08b54): `fail` on evidence completeness, 0 critical, 7 partial scenarios, W1-W4.

### Completeness
| Metric | Value |
|--------|-------|
| Checkboxes total | 102 |
| Checked | 102 |
| Open | 0 |
| Open implementation tasks | 0 |

`gentle-ai sdd-status` at the start of this run: taskProgress 102/102, apply `all_done`, verify `ready`, archive `blocked` with the reason "failed verification evidence is incomplete; rerun SDD verification" (the previous `fail` envelope). Task 10.8 (UAM legal review) stays closed as a documented owner deferral, not as a performed review (a precondition of a real deployment, recorded as a limitation); unchanged since the previous report.

### Build & Tests Execution
**Build**: `npm run build` was NOT run (scope: full vitest suite and typecheck). Static gate: `npm run typecheck` exit 0, 0 errors. tasks.md 13.1 and 12.6 record `npm run build` ok on earlier heads; the changes since touch `documentos.ts` (a catch block) and `signals.ts` (a `.mapWith`), both covered by the typecheck.

**Tests**: 320 files, 7234 tests passed, 0 failed, 0 skipped (exit 0, 199.84 s). 7234 = 7232 of the previous head + 2 net in `documentos.test.ts` (the W4 tests). The opt-in integration suite is excluded by `vitest.config.mts` (`src/**/*.integration.test.ts`) and is not part of this count.
```text
DATABASE_URL=postgres://dummy:dummy@localhost:5432/dummy npx vitest run
 Test Files  320 passed (320)
      Tests  7234 passed (7234)
exit=0
npm run typecheck   (tsc --noEmit)
exit=0
```
`test_output_hash` is the SHA-256 of the captured stdout and stderr of the vitest run plus the `exit=0` line; `build_output_hash` is the same for the typecheck run (its output is byte-identical to the previous report's: no type output). The dummy `DATABASE_URL` is never connected to; no test in the default suite opens a connection.

**Integration suite on Postgres (runtime evidence not produced by this verifier)**: `src/lib/data/integration/validation-signals.integration.test.ts` was executed on 2026-11-02 by the orchestrator, with the owner's explicit yes, on a disposable Neon branch `test-validation-signals-evidence` (from dev-arnia, migration 0013 applied; endpoint ep-broad-resonance-ayh65h6g), command `INTEGRATION_DATABASE_URL=<disposable> INTEGRATION_ALLOW_WRITES=1 npm run test:integration -- src/lib/data/integration/validation-signals.integration.test.ts`.
- First run (before f5e4744): 26 passed, 10 failed, all with `expected [ { solicitudId: '207' } ] to deeply equal [ { solicitudId: 207 } ]`. A real defect: the raw CASE in `earlierMatchesQuery` returned the bigint id as a string.
- Second run (after f5e4744, `.mapWith(Number)`): Test Files 1 passed, Tests 45 passed (45) = 36 new + 9 existing.
- The disposable branch was deleted afterwards. The run cannot be repeated without a new disposable branch and a new owner yes.

This verifier read the 36 new cases statically (982-line file, typechecks, collected under its own config) and counts the run as runtime evidence of a covering test executed on Postgres, as instructed by the orchestrator. The provenance is the orchestrator's account plus the f5e4744 commit message; see W5.

**Coverage**: not available (no coverage provider installed).

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | Partial | tables exist for S2, S3 and the remediation; none for S1 (tasks 1.2-3.10, 36 checkboxes); S2 and S3 tables have no Safety Net column. The remediation table (ca3cbfd) has the Safety Net column. See W2 |
| All tasks have tests | OK | every behavior task has a test file; all exist and pass |
| RED confirmed | OK | W4: 5 tests red against the old rethrow, then green (apply-progress). W3: the integration suite was red on Postgres once (10 failures, the bigint string) and caught a real defect; this RED is not recorded in apply-progress (W5) |
| GREEN confirmed | OK | the full suite passed (7234/7234); the Postgres suite passed 45/45 on the second run |
| Triangulation adequate | OK | RN-14: 17 table rows plus 3 targeted cases; RN-26: 8 rows plus 4 cases (tie in both directions, same-request exclusion, other-request reuse, first-presentation order); scope: 4 cases with two viewers and a no-scope caller; W4: 4 failure shapes (throw, stream break, failing blob delete, hash-less digest) |
| Safety net for modified files | OK for the remediation | `documentos.test.ts` 64/64 before the change; `signals-sql.test.ts` and the 9 existing integration tests unchanged. Earlier slices: Warning (W2) |

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure, table-driven) | majority of src/lib/signals and src/lib/intake | about 14 | vitest |
| Unit with db double and fake store | documentos, signals loader, special-format | 4 | vitest |
| Component/page (Testing Library, axe) | page and section tests | 5 | vitest, testing-library |
| Structural (source scans) | display-only, no-persistence, fingerprint-exposure, no-signals, structure | 5 | vitest |
| Integration against Postgres (opt-in) | 45 (36 new for RN-14/RN-26 predicates and scope) | 1 | vitest, excluded from `npm test`; executed once on a disposable branch |
| E2E | 0 | 0 | not installed |

### Assertion Quality
Audited this run: the new `RN-14 and RN-26 predicates (real Postgres)` block (36 cases) and the W4 tests in `documentos.test.ts`. No tautologies, no assertion-free tests, no ghost loops: `rows.every(...)` in the RN-14 case follows an assertion that the id set is exactly `[earlier, other]` or `[earlier]` (non-empty), and every `toEqual([])` expectation has a companion row in the same table with a non-empty expectation. Every case calls production code (`readIssuerHistory`, `readEarlierMatches`, `loadSignals`, `finalizeDocument`). The unit tests of the earlier slices were audited on f1ea6d0 and are unchanged. SQL-rendering tests match statement text (an accepted repo pattern).
**Assertion quality**: 0 CRITICAL, 0 WARNING

### Spec Compliance Matrix (76 scenarios)
Legend: C = COMPLIANT (a covering test passed at runtime: in the default suite of this run, or, for the Postgres predicates, in the integration run described above). No P, no FAILING, no UNTESTED remain.

validation-signals (39 scenarios, 39 C)
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Three outcomes | Reason always from the closed set | signals/evaluate.test.ts > reasons are always from the closed set | C |
| Three outcomes | Precedence of reasons | evaluate.test.ts > gives extraction_failed, not days_only | C |
| RN-07 | Boundary dates | timing.test.ts > boundary dates | C |
| RN-07 | Managua date, not UTC | timing.test.ts > uses the Managua date | C |
| RN-07 | Resubmission | timing.test.ts > counts the first presentation only | C |
| RN-07 | Calendar not covering year | timing.test.ts > calendar coverage (3 tests) | C |
| RN-09 | Document boundaries | rest-dates.test.ts > document boundaries | C |
| RN-09 | Aggregation | rest-dates.test.ts > aggregation | C |
| RN-09 | Retired and staff ignored | data/extraction-sql.test.ts and extraction.test.ts | C |
| RN-10 | Containment boundaries | rest-dates.test.ts > containment | C |
| RN-10 | Days-only documents | rest-dates.test.ts > days-only | C |
| RN-10 | Pending or failed on uncovered range | rest-dates.test.ts > pending or failed | C |
| RN-14 | Nth request flagged | issuer.test.ts > Nth request; integration > RN-14 history, through loadSignals (3rd present) | C |
| RN-14 | What does not count (6 rows) | integration > RN-14 history (Q4): same student rechazada / devuelta counted; other period, other student, borrador, retired documents only not counted (plus aprobada, en_revision_coordinacion, staff special format, document not valido, extraction fallida / pendiente / no_aplica, no issuer, later request, tie by id both ways, never the request itself); signals-sql.test.ts rendering | C (was P) |
| RN-14 | Issuer normalization | issuer.test.ts > normalizeIssuer | C |
| RN-14 | One request counts once | issuer.test.ts > one request counts once | C |
| RN-14 | Threshold is a parameter | issuer.test.ts > threshold is a parameter | C |
| RN-14 | Missing inputs | issuer.test.ts > missing inputs | C |
| RN-26 | Earlier request reused (7 rows) | integration > RN-26 earlier-only matching (Q5): pendiente, rechazada, devuelta, retired document, draft, staff upload / special format (one row shape), other student; each asserts the R2 outcome, the earlier-match rows, and that R1 has no earlier match; repeated-document.test.ts for the evaluator side | C (was P; see S5) |
| RN-26 | Equal presentation time | integration > breaks a tie on the presentation instant by request id (B present referencing A, A absent) | C (was P) |
| RN-26 | Correction re-upload same request | integration > never matches a correction re-upload against its own request | C (was P) |
| RN-26 | Correction reusing another request document | integration > flags a correction that reuses a document of another, earlier request (corrected present, earlier absent) | C (was P) |
| RN-26 | Order follows first presentation | integration > orders by the first presentation, never by the resubmission | C (was P) |
| RN-26 | NULL fingerprint table | repeated-document.test.ts > NULL fingerprints; signals.test.ts > RN-26 through the loader | C |
| RN-26 | Earlier document with NULL fingerprint | signals.test.ts > ignores a NULL document; integration > document from before the change (NULL fingerprint) absent | C |
| Scope | Cross-scope match without reference | integration > nulls, inside the database, the id of a request outside the scope, and keeps the match; repeated-document.test.ts; signals.test.ts | C |
| Scope | In-scope match with reference (41/55) | integration > references the request of the facultad and hides the others (41 and 55), and the mirror for the other facultad; signals.test.ts > references 41 only | C |
| Scope | Reference carries no personal data | repeated-document.test.ts; signals.test.ts > serializes no name | C |
| Verdict | Verdict table | verdict.test.ts > suggestVerdict table | C |
| Verdict | Present beats not evaluable | verdict.test.ts | C |
| Verdict | Extraction not available | verdict.test.ts > never no_alerts while extraction is pending | C |
| Display-only | Decision independent of the verdict | signals/display-only.test.ts | C |
| Display-only | No write path reads the signals | display-only.test.ts > still imports every write-path module with both signal modules throwing | C |
| Display-only | Queue unchanged | display-only.test.ts > queue untouched; review/page.test.tsx > ReviewQueuePage carries no signal | C |
| Computed on read | Late extraction changes the next read | signals.test.ts > changes the next read when the extraction completes later | C |
| Computed on read | Decision does not store the verdict | signals/no-persistence.test.ts | C |
| Access | Roles | auth/permissions.test.ts > signalsAccess; review/[id]/page.test.tsx denial cases | C |
| i18n | Translation keys present | i18n/review-messages.test.ts | C |
| i18n | Text, not color | signals-section.test.tsx > Text, not color | C |

request-review (12, all C): Section content, Decision controls untouched, Shown after the decision, Not in the queue or the tabs, Reference to an earlier request, Match outside the scope shows no reference, Not for other roles, Read failure, One signal query fails, One audit row, Translation keys present, Verdict wording (review/[id]/page.test.tsx, signals-section.test.tsx, review/page.test.tsx, signals.test.ts, review-messages.test.ts).

coordination-escalation (8, all C): Outcomes and labels only, Verdict shown no extracted values, RN-26 match never gives a reference, Other careers and ids, Notices and the list carry none, Answer unaffected, Read failure, No audit row (coordination/[id]/page.test.tsx, coordination/structure.test.ts, signals/coordination-view.test.ts).

student-requests (5, all C): Detail and list, Returned and rejected, Correction and upload results, Owner of the earlier document, Another student request (requests/no-signals.test.ts, documentos.test.ts).

supporting-documents (12, all C): Valid files, Spoofed, Other rejections, Unvalidated never referenced, Reason shown, Fingerprint stored at finalize, Same bytes same fingerprint, Staff upload and old documents NULL, Never exposed (fingerprint-exposure.test.ts), Retirement keeps it, Database rejects a malformed value (migration-validation-signals.test.ts; the Postgres CHECK cases are in the integration run above, the 9 existing cases passed again), and Failed finalize stores no fingerprint (documentos.test.ts > "a stored file that cannot be read for hashing", 4 tests, and "never creates a record without a fingerprint ... rejected as not_found with the blob deleted"; the spoofed, empty and oversized legs were already covered). The unreadable-file case now deletes the blob best effort, drops the claim, writes one `documento.rechazado` row with `not_found`, stores no hash, and returns ok false with reason not_found (was P).

**Compliance summary**: 76/76 scenarios compliant (39 + 12 + 8 + 5 + 12), 0 partial, 0 failing, 0 untested. Requirements 19/19.

Owner real-data evidence recorded in tasks.md (request 138/139 on dev-arnia, request 145 in the thesis system tests, the 9/9 Postgres run of task 10.5) is corroboration, not counted in the matrix.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Closed reason set and precedence | Implemented | signals/types.ts pickReason |
| RN-07, RN-09, RN-10 | Implemented | signals/timing.ts, signals/rest-dates.ts |
| RN-14 | Implemented | signals/issuer.ts; Q4 (`readIssuerHistory`) executed on Postgres for every exclusion predicate and the order tuple |
| RN-26 | Implemented | signals/repeated-document.ts; Q5 (`earlierMatchesQuery`, `readEarlierMatches`) executed on Postgres; id nulled in SQL by `requestInScope`, coordinator gets literal false; the id is now a number (`.mapWith(Number)`, NULL stays NULL) |
| Verdict | Implemented | signals/verdict.ts |
| Display-only (RN-15) | Implemented | display-only.test.ts passes; no write path imports the signals |
| Nothing persisted | Implemented | no signal column in schema.ts (only huellaSha256); no-persistence.test.ts |
| Access (RNF-01) | Implemented | signalsAccess; review page loads only for full; coordination page only for kind escalation, outcomes only |
| Coordinator projection | Implemented | coordination-view.ts copies fields by name and drops all evidence |
| Students see nothing | Implemented | requests/no-signals.test.ts (17 tests) |
| Fingerprint at finalize | Implemented | one stream, counted size, hash stored; an unreadable stored file is now refused like any rejection (W4 closed), not rethrown |
| Migration 0013 | Implemented | applied to dev-arnia and production (tasks 10.5, 10.9); CHECK and index re-exercised in the integration run |
| i18n es and en | Implemented | same keys in both locales |
| Fail-soft, one audit row | Implemented | loadSignals returns degraded; recordRequestRead stays the only audit write on read |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| VS-1 evaluator layout and params | Yes | threshold 3 as a code constant (RNF-14 not met, documented) |
| VS-2 verdict and display-only scan | Yes | scan covers RN-26 and repeated-document.ts |
| VS-3 loader Q1-Q5, fail-soft, error name only | Yes | |
| VS-4 single stream, port, helper, adapters | Yes | the unreadable-file behavior is now `reject(not_found)`; design.md does not state it (S1) |
| VS-5 migration 0013 | Yes | applied; SQL unchanged |
| VS-6 secretary UI | Yes | section after ExtractionSection |
| VS-7 coordination projection | Yes, with a small addition | audience prop and review.signals.coordinationNote are not in design.md (S1) |
| VS-8 fail-soft and ordering | Yes | |
| VS-9 data path for 2026-11-03 | Yes | primary path worked in the owner walk |

### Issues Found
**CRITICAL**: None.

**WARNING**:
- W2 (carried, not repairable after the fact) apply-progress.md has no TDD Cycle Evidence table for S1 (tasks 1.2-3.10), and the S2 and S3 tables have no Safety Net column. The remediation table (ca3cbfd) has the column and covers the remediation only. The S1 RED outputs cannot be audited; the S1 test files exist and pass. Accept at archive as a recorded process gap.
- W5 (new) apply-progress.md, section "Remediation after verify (W4 and W3)", is stale against the final facts: it says the integration suite was collected with "45 tests skipped, none executed", that W3 RED is "not observable" and that the owner runs the suite, and its gates list ends before f5e4744. It does not record the 2026-11-02 Postgres run (26 passed / 10 failed, then 45/45), the bigint-as-string defect found by that run, or the fix f5e4744. The disposable branch is deleted, so the only durable record of the run is this report and the f5e4744 commit message. Add a short "Postgres run" subsection (counts, command shape, defect, fix) to apply-progress.md before archive.

**SUGGESTION**:
- S1 design.md:39 still says "punctuation to space" (code and spec remove punctuation); VS-7 lacks the audience prop and the coordinationNote key; VS-4 lacks the unreadable-file behavior (reject as `not_found`, blob deleted, one audit row).
- S2 docs/roadmap.md lines 102-104 still say migration 0013 is generated and not applied and that use of the fingerprint awaits the UAM legal review. Update with roadmap row 5 in the archive step.
- S3 signals/display-only.test.ts scans actions.ts, *-actions.ts and top-level src/lib/data/*.ts; a notification or mail module outside those would escape. Consider scanning every non-page production file.
- S4 `npm run build` was not run here; rely on tasks 12.6 and 13.1 or re-run before release if the build is a gate.
- S5 (spec wording, judged) The RN-26 table "Earlier request reused" gives the R1 outcome `absent` for the rows "document H uploaded by staff" and "document H special format" (and for "document H retired by a correction" if that is R1's only document). By the same requirement's own rule, a request with no current student document is `not_evaluable` with `no_eligible_documents`, so the evaluator gives that for R1 in those rows; the table and the rule disagree, and the table is the imprecise side. No behavior is wrong and the Postgres suite asserts the SQL meaning (R1 has no earlier match), so this is a SUGGESTION, not a WARNING. Also, the schema (`CK_Documento_FormatoEspecial`) makes "staff upload" and "special format" one row shape, so those two rows cannot be separate cases. Amend the table (R1: "no earlier match; `not_evaluable` if it has no current student document") before the delta syncs into the main specs at archive.
- S6 The delta spec names no reason for "a stored file that cannot be read for hashing". The implementation uses the existing `not_found`. Name it in the scenario or in "Other rejections" at archive so the main spec states what the code does; note `not_found` now covers a missing file (no audit row, nothing to delete) and an unreadable one (audit row, blob deleted).
- S7 Nothing in the default suite pins `.mapWith(Number)`: the db double returns whatever it is scripted with, so only the opt-in Postgres suite would catch a regression of the string id. Consider a rendering or decoder pin in signals-sql.test.ts.

### Verdict
PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 7 SUGGESTION).
Evidence: 320 files / 7234 tests green, typecheck clean, 102/102 tasks done, 76/76 scenarios compliant, 19/19 requirements. The seven scenarios that were partial are now covered by tests that passed on Postgres (RN-14 "What does not count", the five RN-26 rows) or by the W4 fix with new or rewritten unit tests ("Failed finalize stores no fingerprint"). The Postgres run also found and fixed a real defect (string bigint id) that the unit suite could not see. The remaining warnings are a historical TDD-evidence gap (W2) and a stale apply-progress record of the Postgres run (W5); neither blocks archive. Caveat: the Postgres evidence was produced by the orchestrator on a since-deleted disposable branch and was not re-executed by this verifier.
