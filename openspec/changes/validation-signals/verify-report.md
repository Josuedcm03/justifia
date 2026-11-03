```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:a59c228d664bd0f7faca42dde48296e142487c5a8e6cd9ae818b417aaceda7b1
verdict: fail
blockers: 0
critical_findings: 0
requirements: 16/19
scenarios: 69/76
test_command: DATABASE_URL=postgres://u:p@localhost:5432/x npx vitest run src/lib/signals src/lib/data src/app src/i18n src/db src/lib/intake
test_exit_code: 0
test_output_hash: sha256:16b8e5a17e13de03df413607f4c2feb49f77191c9571e0b3b65708444735d13d
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:67d1fc6f094cf715091e7d1a2d3052f1850098c09943bd7fa81afbe386e92a94
```

## Verification Report

**Change**: validation-signals
**Version**: N/A (5 spec files, 19 requirements, 76 scenarios)
**Mode**: Strict TDD
**Head verified**: f1ea6d0 (branch feat/validation-signals-s3-coordination, contains S1, S2 and S3). Working tree clean; nothing edited, stashed, committed or built.

### Completeness
| Metric | Value |
|--------|-------|
| Checkboxes total | 102 |
| Checked | 88 |
| Open | 14 (4.3, 4.4, 5.3, 5.4, 9.4, 10.6, 10.8, 10.9, 12.7, 13.1, 13.2, 13.3, 13.4, 13.5) |
| Open implementation tasks | 0 |

Open tasks, classified (none is code or test work):
- Owner-run: 4.3 (walk with a real extraction), 10.6 (end-to-end RN-26 on dev-arnia), 10.8 (UAM legal review status, PRIV), 10.9 (production migration decision), 13.2 (owner walk).
- Conditional: 4.4 (fixture script, only if 4.3 cannot work).
- Process/PR: 5.3, 5.4, 9.4, 12.7 (PRs and merges; the authored-line measurement of 12.7 is done).
- Closeout: 13.1 (Gate set G on the tracker head), 13.3 (this verify), 13.4 (merge gate and archive), 13.5.

### Build & Tests Execution
**Build**: `npm run build` was NOT run (forbidden: it would clash with the owner dev server). Static gate used instead: `npm run typecheck` exit 0, 0 errors. `apply-progress.md` records `npm run build` ok on the S3 head.

**Tests**: 227 files, 5085 tests passed, 0 failed, 0 skipped (exit 0, about 133 s).
```text
DATABASE_URL=postgres://u:p@localhost:5432/x npx vitest run src/lib/signals src/lib/data src/app src/i18n src/db src/lib/intake
 Test Files  227 passed (227)
      Tests  5085 passed (5085)
```
**Lint (informational)**: `npx eslint` on the 56 changed source files reports only the known CRLF "Delete" prettier noise; no other rule fires.

**Coverage**: not available (no coverage provider installed).

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | Partial | Tables exist for S2 and S3 in apply-progress (file and engram #390); none for S1 (36 checkboxes) |
| All tasks have tests | OK | every behavior task has a test file; all exist |
| RED confirmed (tests exist) | OK | all test files named in the S2/S3 tables exist |
| GREEN confirmed (tests pass) | OK | every listed file passed in the run above |
| Triangulation adequate | OK | tables of 4-7 rows per behavior; closed-set check over 3276 combinations |
| Safety net for modified files | Warning | tables have no Safety Net column (documentos.test.ts, special-format.test.ts, page tests, structure.test.ts were modified) |

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (pure, table-driven) | majority of src/lib/signals and intake | about 14 | vitest |
| Component/page (Testing Library, axe) | page and section tests | 5 | vitest, testing-library |
| Structural (source scans) | display-only, no-persistence, fingerprint-exposure, no-signals, structure | 5 | vitest |
| Integration against Postgres (opt-in) | 9 (owner-run 2026-11-02, not re-run here) | 1 | vitest, excluded from npm test |
| E2E | 0 | 0 | not installed |

### Assertion Quality
No tautologies, no ghost loops (loops iterate fixed non-empty constant lists or follow a length guard, e.g. display-only.test.ts:155 and :201), no assertion-free tests. toBeTruthy calls over i18n keys iterate constant code lists. SQL-rendering tests match rendered statement text (implementation coupling, accepted repo pattern from extraction-sql.test.ts).
**Assertion quality**: 0 CRITICAL, 0 WARNING

### Spec Compliance Matrix (76 scenarios)
Legend: C = COMPLIANT (covering test passed in this run), P = PARTIAL (passes, but the outcome depends on a SQL predicate checked by statement rendering and a scripted db double, never executed on Postgres).

validation-signals (39)
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

request-review (12): Section content, Decision controls untouched, Shown after the decision (it.each over states including aprobada), Not in the queue or the tabs, Reference to an earlier request, Match outside the scope shows no reference, Not for other roles, Read failure, One signal query fails (signals.test.ts > degrades when the RN-14 query throws), One audit row, Translation keys present, Verdict wording: all C (review/[id]/page.test.tsx, signals-section.test.tsx, review/page.test.tsx, signals.test.ts, review-messages.test.ts).

coordination-escalation (8): Outcomes and labels only, Verdict shown no extracted values, RN-26 match never gives a reference, Other careers and ids, Notices and the list carry none, Answer unaffected (page-level form unchanged plus display-only scan of the answer action), Read failure, No audit row: all C (coordination/[id]/page.test.tsx, coordination/structure.test.ts, signals/coordination-view.test.ts).

student-requests (5): Detail and list, Returned and rejected, Correction and upload results (documentos.test.ts finalize-equality plus upload-chain scan), Owner of the earlier document, Another student request: all C (requests/no-signals.test.ts, 17 tests).

supporting-documents (12): Valid files, Spoofed, Other rejections, Unvalidated never referenced, Reason shown, Fingerprint stored at finalize, Same bytes same fingerprint, Staff upload and old documents NULL, Never exposed (fingerprint-exposure.test.ts), Retirement keeps it (single write site), Database rejects a malformed value (migration-validation-signals.test.ts here; the 9/9 Postgres run is owner evidence in task 10.5, not re-run): C. Failed finalize stores no fingerprint: P (see W4).

**Compliance summary**: 69/76 scenarios compliant, 7 partial, 0 failing, 0 untested.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Closed reason set and precedence | Implemented | signals/types.ts:18-62, pickReason |
| RN-07 | Implemented | signals/timing.ts; first presentation, Managua date; checks the year of fechaFin and of the deadline |
| RN-09, RN-10 | Implemented | signals/rest-dates.ts; day-granularity merge, containment, days_only over field_missing |
| RN-14 | Implemented | signals/issuer.ts; Q4 data/signals.ts:117-167 (no state filter, earlier-only tuple, current student documents) |
| RN-26 | Implemented | signals/repeated-document.ts; Q5 data/signals.ts:176-238; id nulled in SQL by requestInScope, coordinator gets literal false |
| Verdict | Implemented | signals/verdict.ts |
| Display-only (RN-15) | Implemented | production importers of the signals modules are exactly the two pages, signals-section.tsx, coordination-view.ts and data/signals.ts (ripgrep over src); no write path |
| Nothing persisted | Implemented | no signal column in schema.ts (only huellaSha256); no-persistence.test.ts |
| Access (RNF-01) | Implemented | auth/permissions.ts signalsAccess; review page loads only for full; coordination page only for kind escalation and outcomes (coordination/[id]/page.tsx:87-90); the open-escalation gate is in getCoordinationDetail |
| Coordinator projection | Implemented | referenceScope kind none plus toCoordinationView copies fields by name and drops all evidence: verdict yes, RN-26 reference no |
| Students see nothing | Implemented | no student module imports signals or reads huellaSha256; huellaSha256 appears in production only in schema.ts, documentos.ts (single write) and data/signals.ts (Q5) |
| Fingerprint at finalize | Implemented | intake/stream-digest.ts, DocumentStore.readDigest, documentos.ts:301-323; size from counted bytes; special-format attach keeps readHead and a NULL hash |
| Migration 0013 | Implemented | see Coherence |
| i18n es and en | Implemented | review.signals.* same keys, neutral Spanish, coordinationNote added to both |
| Fail-soft, one audit row | Implemented | loadSignals returns degraded; both pages wrap it; recordRequestRead stays the only audit write |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| VS-1 evaluator layout and params | Yes | all files present; threshold 3 as a code constant (RNF-14 not met, documented) |
| VS-2 verdict and display-only scan | Yes | scan extended to RN-26 and repeated-document.ts |
| VS-3 loader Q1-Q5, fail-soft, error name only | Yes | signals_read_failed logs the error name |
| VS-4 single stream, port, helper, adapters | Yes | readDigest with access private, useCache false; refusal on counted size |
| VS-5 migration 0013 | Yes | drizzle/0013_validation_signals.sql holds exactly ADD COLUMN char(64) NULL, partial IX_Documento_Huella WHERE NOT NULL, CK_Documento_Huella with the designed body; journal idx 13, when 1793660241921 greater than the 0012 value 1793384505116; no DROP/UPDATE/retype; only finalizeDocument sets estado valido together with the hash, so the CHECK cannot trip |
| VS-6 secretary UI | Yes | section after ExtractionSection, loaded before recordRequestRead, role status verdict |
| VS-7 coordination projection | Yes, with a small addition | audience prop and key review.signals.coordinationNote (the shared note says your decision); not described in design |
| VS-8 fail-soft and ordering | Yes | |
| VS-9 data path for 2026-11-03 | Partly | primary path (local NuExtract) awaits owner walk 4.3; fallback script not needed unless 4.3 fails |

### Issues Found
**CRITICAL**: None.

**WARNING**:
- W1 Archive-gating open tasks (see Completeness): 4.3, 10.6, 10.8, 10.9, 13.2 owner; 5.3, 5.4, 9.4, 12.7 PR/merge; 13.1, 13.3, 13.4, 13.5 closeout; 4.4 conditional. The skill default would class unchecked tasks CRITICAL; they are classed WARNING per the orchestrator instruction because none is code or test work. Not archive-ready until closed.
- W2 openspec/changes/validation-signals/apply-progress.md (and engram #390) holds no TDD Cycle Evidence table for S1 (tasks 1.2-3.10); the S2 and S3 tables have no Safety Net column. S1 RED outputs cannot be audited; the S1 test files exist and pass.
- W3 Seven scenarios are PARTIAL because the Q4 and Q5 predicates (order tuple, state filters, retired, staff, special format, same request, other student/period) are verified by SQL rendering and scripted db doubles only: RN-14 "What does not count"; RN-26 "Earlier request reused", "Equal presentation time", "Correction re-upload", "Correction that reuses another request document", "Order follows first presentation"; plus W4. Q5 was planned on Postgres by the opt-in EXPLAIN test (owner run, 10.5); Q4 has never run against Postgres. The owner walks (4.3, 10.6, 13.2) are the first real execution.
- W4 src/lib/data/documentos.ts:216-220 and fingerprintStoredFile (:301): when the stored file cannot be read for hashing (store failure or stream error) finalize drops the claim and rethrows; the stored file is not deleted and no reason message is returned. Spec "Failed finalize stores no fingerprint" and the "fail the same way" clause of "Finalize with magic-byte validation" expect the file deleted and a failure like the other refusals; task 7.7 asked for "an existing reason code". No record and no hash are stored, so the integrity guarantee holds; apply-progress documents this as a deviation (same as the former head read). documentos.test.ts:437-462 pins the claim drop but not deletion.

**SUGGESTION**:
- S1 design.md:39 still says "punctuation to space"; code and spec remove punctuation (signals/issuer.ts:18-26). Task 0.3 reconciled the reason table and VS-6 placement, not this row. VS-7 also lacks the audience prop and the coordinationNote key, and VS-4 lacks the unreadable-file behavior.
- S2 docs/roadmap.md:103 says 0013 is "generada y no aplicada"; it is now applied on dev-arnia (task 10.5). Clarify "not applied in production".
- S3 signals/display-only.test.ts:76-84 scans actions.ts, *-actions.ts and top-level src/lib/data/*.ts. A notification or mail module outside those would escape the scan. Today none imports the signals (manual ripgrep over src); consider scanning every non-page production file.
- S4 Task 4.4 is unnecessary unless 4.3 fails; close it as "not needed" after 4.3.
- S5 Full npm test and npm run build were not re-run here (instructions). Re-run Gate set G on the tracker head (13.1).

### Verdict
PASS WITH WARNINGS on the code (0 CRITICAL, 4 WARNING, 5 SUGGESTION). The envelope verdict is fail only because the native contract treats incomplete evidence (14 open owner and closeout tasks, 7 partial scenarios) as non-passing, so the change is not archive-ready.
No CRITICAL findings: typecheck clean, 227 files / 5085 tests green, 69 of 76 scenarios compliant at runtime and 7 partial (SQL-dependent), RN-15 display-only, RNF-01 scope-confined RN-26 reference, coordinator projection (verdict yes, no reference), student invisibility and migration 0013 all confirmed. Not archive-ready until the owner and closeout tasks (W1) close and the merge gate (S3, 13.2, 10.9, PRIV) is met.
