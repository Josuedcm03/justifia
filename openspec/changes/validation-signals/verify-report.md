```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:a678d212205080cd571c9d1f6579a7b8703c20149716993785fa6e8fc1117447
verdict: fail
blockers: 0
critical_findings: 0
requirements: 16/19
scenarios: 69/76
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:f3c268c1badbfb3138a141176a521efa2e77b6cc16223c240c4f6a5a91fa40d3
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:f2cbbbb191d7d62906ae878fdb2a44507726ff4ca341b4a9aefe69c0847edf74
```

## Verification Report

**Change**: validation-signals
**Version**: N/A (5 spec files, 19 requirements, 76 scenarios; counted from the `### Requirement:` and `#### Scenario:` headings)
**Mode**: Strict TDD
**Head verified**: 3d4072d (branch `docs/validation-signals-closeout`, equal to main 584bde8 plus the tasks.md closeout commit). Working tree clean; nothing edited, committed, pushed or built. No database was contacted and no integration test was run.
**Evidence revision**: sha256 of three lines: `tree:<HEAD tree 2bd6afb5201b175a35b19c4913e7775cdbf455ea>`, `test:<test_output_hash>`, `build:<build_output_hash>`.
**Supersedes**: the report on f1ea6d0 (also `fail` on evidence completeness, 0 critical, W1-W4).

### Completeness
| Metric | Value |
|--------|-------|
| Checkboxes total | 102 |
| Checked | 102 |
| Open | 0 |
| Open implementation tasks | 0 |

W1 of the previous report is closed: the owner tasks are done (4.3 walk; 4.4 not needed; 10.6 and 13.2 walks on dev-arnia; 10.9 migration 0013 applied to production, 14 migrations with HuellaSha256). Task 10.8 (UAM legal review) is closed as a documented owner deferral, not as a performed review: the review is a precondition of a real deployment with real students, not of this change (limitation and future work in the thesis). The merge gate text in tasks.md already says so. Delivery facts from tasks.md and git, not re-proven here: PRs #72, #73, #74 merged, tracker merged to main through #76 (merge 584bde8) after the revert #75.

### Build & Tests Execution
**Build**: `npm run build` was NOT run (this run was scoped to the full vitest suite and the typecheck). Static gate: `npm run typecheck` exit 0, 0 errors. tasks.md 13.1 and 12.6 record `npm run build` ok on e4ff52e and on the S3 head (same code).

**Tests**: 320 files, 7232 tests passed, 0 failed, 0 skipped (exit 0, 183.67 s). The opt-in integration suite is excluded by `vitest.config.mts` (`src/**/*.integration.test.ts`) and was not run.
```text
npx vitest run
 Test Files  320 passed (320)
      Tests  7232 passed (7232)
exit=0
npm run typecheck   (tsc --noEmit)
exit=0
```
`test_output_hash` is the SHA-256 of the captured stdout and stderr of the vitest run plus the `exit=0` line; `build_output_hash` is the same for the typecheck run. The command ran without `DATABASE_URL`; no test needed one.

**Coverage**: not available (no coverage provider installed).

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | Partial | "TDD cycle evidence" tables exist for S2 and S3 in apply-progress.md; none for S1 (tasks 1.2-3.10, 36 checkboxes) |
| All tasks have tests | OK | every behavior task has a test file; all exist and pass in this run |
| RED confirmed (tests exist) | OK | all test files named in the S2 and S3 tables exist |
| GREEN confirmed (tests pass) | OK | the full suite passed (7232/7232) |
| Triangulation adequate | OK | tables of 4-7 rows per behavior; closed-set check over 3276 combinations |
| Safety net for modified files | Warning | the tables have no Safety Net column (modified: documentos.test.ts, special-format.test.ts, page tests, structure.test.ts) |

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure, table-driven) | majority of src/lib/signals and src/lib/intake | about 14 | vitest |
| Component/page (Testing Library, axe) | page and section tests | 5 | vitest, testing-library |
| Structural (source scans) | display-only, no-persistence, fingerprint-exposure, no-signals, structure | 5 | vitest |
| Integration against Postgres (opt-in) | 9 (owner-run 2026-11-02 on a disposable branch, not re-run) | 1 | vitest, excluded from `npm test` |
| E2E | 0 | 0 | not installed |

### Assertion Quality
No tautologies, no ghost loops (loops iterate fixed non-empty constant lists or follow a length guard), no assertion-free tests. SQL-rendering tests match rendered statement text (implementation coupling, an accepted repo pattern from extraction-sql.test.ts). Audited on f1ea6d0; the test files are unchanged on the current head (only tasks.md changed since).
**Assertion quality**: 0 CRITICAL, 0 WARNING

### Spec Compliance Matrix (76 scenarios)
Legend: C = COMPLIANT (a covering automated test passed in this run); P = PARTIAL (the test passes, but the outcome depends on a SQL predicate checked only by statement rendering and a scripted db double, never executed on Postgres by an automated test, or the code deviates from the scenario text).

validation-signals (39 scenarios, 33 C and 6 P)
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
| RN-09 | Retired and staff ignored | data/extraction-sql.test.ts and extraction.test.ts (listExtractions filters) | C |
| RN-10 | Containment boundaries | rest-dates.test.ts > containment | C |
| RN-10 | Days-only documents | rest-dates.test.ts > days-only | C |
| RN-10 | Pending or failed on uncovered range | rest-dates.test.ts > pending or failed | C |
| RN-14 | Nth request flagged | issuer.test.ts > Nth request | C |
| RN-14 | What does not count | data/signals-sql.test.ts > RN-14 history statement (Q4), rendering only | P |
| RN-14 | Issuer normalization | issuer.test.ts > normalizeIssuer | C |
| RN-14 | One request counts once | issuer.test.ts > one request counts once | C |
| RN-14 | Threshold is a parameter | issuer.test.ts > threshold is a parameter | C |
| RN-14 | Missing inputs | issuer.test.ts > missing inputs | C |
| RN-26 | Earlier request reused (7 rows) | repeated-document.test.ts and signals-sql.test.ts > Q5 other side (state, retired, staff, special format, other student decided in SQL) | P |
| RN-26 | Equal presentation time | signals-sql.test.ts > keeps only presented requests earlier (tuple rendering) | P |
| RN-26 | Correction re-upload same request | signals-sql.test.ts > never matches the request itself | P |
| RN-26 | Correction reusing another request document | data/signals.test.ts > flags a correction that reuses another request document (db double) | P |
| RN-26 | Order follows first presentation | signals.test.ts > uses the first presentation, Q5 tuple rendering | P |
| RN-26 | NULL fingerprint table | repeated-document.test.ts > NULL fingerprints; signals.test.ts > RN-26 through the loader | C |
| RN-26 | Earlier document with NULL fingerprint | signals.test.ts > ignores a NULL document | C |
| Scope | Cross-scope match without reference | repeated-document.test.ts; signals.test.ts > secretary of facultad A | C |
| Scope | In-scope match with reference (41/55) | signals.test.ts > references 41 only | C |
| Scope | Reference carries no personal data | repeated-document.test.ts; signals.test.ts > serializes no name | C |
| Verdict | Verdict table | verdict.test.ts > suggestVerdict table | C |
| Verdict | Present beats not evaluable | verdict.test.ts | C |
| Verdict | Extraction not available | verdict.test.ts > never no_alerts while extraction is pending | C |
| Display-only | Decision independent of the verdict | signals/display-only.test.ts (no write path imports the signals) | C |
| Display-only | No write path reads the signals | display-only.test.ts > still imports every write-path module with both signal modules throwing | C |
| Display-only | Queue unchanged | display-only.test.ts > queue untouched; review/page.test.tsx > ReviewQueuePage carries no signal | C |
| Computed on read | Late extraction changes the next read | signals.test.ts > changes the next read when the extraction completes later | C |
| Computed on read | Decision does not store the verdict | signals/no-persistence.test.ts | C |
| Access | Roles | auth/permissions.test.ts > signalsAccess; review/[id]/page.test.tsx denial cases | C |
| i18n | Translation keys present | i18n/review-messages.test.ts | C |
| i18n | Text, not color | signals-section.test.tsx > Text, not color | C |

request-review (12): Section content, Decision controls untouched, Shown after the decision (it.each over states including aprobada), Not in the queue or the tabs, Reference to an earlier request, Match outside the scope shows no reference, Not for other roles, Read failure, One signal query fails (signals.test.ts > degrades when the RN-14 query throws), One audit row, Translation keys present, Verdict wording: all 12 C (review/[id]/page.test.tsx, signals-section.test.tsx, review/page.test.tsx, signals.test.ts, review-messages.test.ts).

coordination-escalation (8): Outcomes and labels only, Verdict shown no extracted values, RN-26 match never gives a reference, Other careers and ids, Notices and the list carry none, Answer unaffected (page-level form unchanged plus display-only scan of the answer action), Read failure, No audit row: all 8 C (coordination/[id]/page.test.tsx, coordination/structure.test.ts, signals/coordination-view.test.ts).

student-requests (5): Detail and list, Returned and rejected, Correction and upload results (documentos.test.ts finalize-equality plus upload-chain scan), Owner of the earlier document, Another student request: all 5 C (requests/no-signals.test.ts, 17 tests).

supporting-documents (12): Valid files, Spoofed, Other rejections, Unvalidated never referenced, Reason shown, Fingerprint stored at finalize, Same bytes same fingerprint, Staff upload and old documents NULL, Never exposed (fingerprint-exposure.test.ts), Retirement keeps it (single write site), Database rejects a malformed value (migration-validation-signals.test.ts here; the 9/9 Postgres run is owner evidence of task 10.5, not re-run): 11 C. Failed finalize stores no fingerprint: P (W4).

**Compliance summary**: 69/76 scenarios compliant by automated runtime evidence (33 + 12 + 8 + 5 + 11), 7 partial (6 + 1), 0 failing, 0 untested. Requirements 16/19; incomplete: RN-14 recurrence, RN-26 repeated document, Finalize with magic-byte validation.

Owner real-data evidence, recorded in tasks.md and reported by the orchestrator, not re-run here and not an automated covering test: request 138 on dev-arnia with the local NuExtract (RN-07/09/10/14 evaluated and absent, verdict no alerts); requests 138 and 139 with the same file (RN-26 present with "Solicitud 138" on 139, absent on 138; the coordinator sees the verdict and no reference); request 145 in the thesis system tests of 2026-11-02 at fa57a53 (RF-10 c showed the signals to the coordinator, RN-26 present); the Postgres integration run 9/9 (CK_Documento_Huella accept and reject cases, EXPLAIN of the Q5 lookup uses IX_Documento_Huella). This corroborates the main paths of Q4 and Q5 on a real database: the statements execute, an earlier request is found, order is respected, the reference is scope-confined. It does not exercise the exclusion predicates of RN-14 "What does not count" (retired, staff, special-format, no_aplica documents), the RN-26 state, retired, staff, special-format and other-student rows, the equal-time tie-break, the same-request exclusion for a correction re-upload, or a correction that reuses another request document, and it does not cover W4. openspec/config.yaml has no clause that lets manual verification stand in for a covering test, so these stay P.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Closed reason set and precedence | Implemented | signals/types.ts pickReason |
| RN-07 | Implemented | signals/timing.ts; first presentation, Managua date |
| RN-09, RN-10 | Implemented | signals/rest-dates.ts |
| RN-14 | Implemented | signals/issuer.ts; Q4 in data/signals.ts (no state filter, earlier-only tuple, current student documents) |
| RN-26 | Implemented | signals/repeated-document.ts; Q5 in data/signals.ts; id nulled in SQL by requestInScope, coordinator gets literal false |
| Verdict | Implemented | signals/verdict.ts |
| Display-only (RN-15) | Implemented | display-only.test.ts passes in the full run; no write path imports the signals |
| Nothing persisted | Implemented | no signal column in schema.ts (only huellaSha256); no-persistence.test.ts |
| Access (RNF-01) | Implemented | signalsAccess; review page loads only for full; coordination page only for kind escalation and outcomes |
| Coordinator projection | Implemented | coordination-view.ts copies fields by name and drops all evidence; coordination-view.test.ts passes |
| Students see nothing | Implemented | requests/no-signals.test.ts (17 tests) passes |
| Fingerprint at finalize | Implemented with a deviation | one stream, counted size, hash stored; unreadable stored file, see W4 |
| Migration 0013 | Implemented | drizzle/0013_validation_signals.sql (ADD COLUMN char(64) NULL, partial index, CHECK); applied to dev-arnia and to production per tasks 10.5 and 10.9 |
| i18n es and en | Implemented | review.signals.* same keys in both locales (review-messages.test.ts passes) |
| Fail-soft, one audit row | Implemented | loadSignals returns degraded; recordRequestRead stays the only audit write |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| VS-1 evaluator layout and params | Yes | threshold 3 as a code constant (RNF-14 not met, documented) |
| VS-2 verdict and display-only scan | Yes | scan covers RN-26 and repeated-document.ts |
| VS-3 loader Q1-Q5, fail-soft, error name only | Yes | |
| VS-4 single stream, port, helper, adapters | Yes | readDigest, refusal on counted size; unreadable-file behavior is W4 |
| VS-5 migration 0013 | Yes | applied; generated SQL unchanged since the previous report |
| VS-6 secretary UI | Yes | section after ExtractionSection |
| VS-7 coordination projection | Yes, with a small addition | audience prop and review.signals.coordinationNote are not described in design.md (S1) |
| VS-8 fail-soft and ordering | Yes | |
| VS-9 data path for 2026-11-03 | Yes | the primary path (local NuExtract) worked in the owner walk; the fallback script was not needed (4.4 closed as not needed) |

### Issues Found
**CRITICAL**: None.

**WARNING**:
- W1 (was: open tasks) Closed. 0 open checkboxes. Task 10.8 is closed by an owner deferral, not by a completed legal review; it is recorded as a limitation (PRIV) and does not block this change.
- W2 apply-progress.md (and engram) holds no TDD Cycle Evidence table for S1 (tasks 1.2-3.10); the S2 and S3 tables have no Safety Net column. The S1 RED outputs cannot be audited; the S1 test files exist and pass. Still true.
- W3 Six scenarios are P because the Q4 and Q5 predicates are verified by SQL rendering and scripted db doubles only: RN-14 "What does not count"; RN-26 "Earlier request reused", "Equal presentation time", "Correction re-upload same request", "Correction reusing another request document", "Order follows first presentation". The owner walk, the system tests and the 9/9 Postgres run corroborate the main paths of RN-26 and RN-14 on real data (see the matrix), which lowers the risk, but the exclusion and tie-break predicates have no executed covering test. Reduced in risk, not closed.
- W4 src/lib/data/documentos.ts (finalizeDocument and fingerprintStoredFile): when the stored file cannot be read for hashing (store failure or stream error) finalize drops the claim and rethrows; the stored file is not deleted and no reason message is returned. The scenario "Failed finalize stores no fingerprint" (a stored file that cannot be read for hashing: the file is deleted, no record exists) and the clause "finalize MUST fail the same way" expect the file deleted and a named reason. No record and no hash are stored, so the integrity guarantee holds; apply-progress.md documents the deviation (the orphan sweep is the backstop). documentos.test.ts pins the claim drop and the rethrow but not the deletion. Still true on this head.

**SUGGESTION**:
- S1 design.md:39 still says "punctuation to space"; code and spec remove punctuation (signals/issuer.ts). VS-7 lacks the audience prop and the coordinationNote key, and VS-4 lacks the unreadable-file behavior.
- S2 docs/roadmap.md lines 102-104 still say migration 0013 is generated and not applied, and that use of the fingerprint awaits the UAM legal review. It is applied on dev-arnia and on production, and the legal review is a documented deferral. Update it in the archive step together with roadmap row 5 (status en curso, becomes archivado).
- S3 signals/display-only.test.ts scans actions.ts, *-actions.ts and top-level src/lib/data/*.ts. A notification or mail module outside those would escape the scan. Consider scanning every non-page production file.
- S4 npm run build was not run in this verification; rely on task 13.1 (e4ff52e) or re-run it before release if the build is a gate.

### Verdict
FAIL on the native evidence contract; by content this is PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 4 SUGGESTION).
Evidence: 320 files / 7232 tests green, typecheck clean, 102/102 tasks done, 69 of 76 scenarios compliant by automated runtime evidence, 7 partial, 0 failing, 0 untested; display-only (RN-15), the scope-confined RN-26 reference, the coordinator projection, student invisibility and migration 0013 are all confirmed. The envelope stays fail only because the native contract treats incomplete evidence (7 partial scenarios, 3 incomplete requirements) as non-passing, and this report does not declare those scenarios complete: no automated covering test executes the Q4 and Q5 exclusion predicates on Postgres, the project config does not accept manual evidence in place of a test, and W4 is a real deviation from the scenario text.
To clear the block: (a) add an opt-in integration test for the Q4 and Q5 exclusion rows and run it on a disposable branch with the owner yes per command, and either make finalize delete the unreadable file with a named reason or amend the W4 scenario by owner decision, then re-verify; or (b) the owner explicitly accepts the partials and the spec and tasks are amended to say so, then re-verify.
