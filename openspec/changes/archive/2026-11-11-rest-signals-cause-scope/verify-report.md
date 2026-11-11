```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:9e5e0b0aef5df58f01bff43e28235df1a01dc765b9597eb1c8203b87e8783d32
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 10/10
scenarios: 47/47
test_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm test
test_exit_code: 0
test_output_hash: sha256:40f63a3fb6ad2825bf7ead0cdfdc049ba917719b0b29e31e39d290fcb4c72e55
build_command: npm run typecheck
build_exit_code: 0
build_output_hash: sha256:67d1fc6f094cf715091e7d1a2d3052f1850098c09943bd7fa81afbe386e92a94
```

## Verification Report

**Change**: rest-signals-cause-scope
**Version**: N/A (three spec deltas: validation-signals, request-review, coordination-escalation)
**Mode**: Strict TDD (vitest)
**Head verified**: ea258fd (base 245ad57), branch fix/rest-signals-cause-scope

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 37 |
| Tasks complete | 32 |
| Tasks incomplete | 5 |

The incomplete tasks are exactly the ones intended to stay open: 9.1-9.4 (Neon-gated integration run, each command needs an explicit yes from the owner) and 11.3 (this verify). Phase 9 is optional per the merge gate; not a core-task gap.

### Build & Tests Execution
**Build (typecheck)**: PASSED. `npm run typecheck` (tsc --noEmit) exit 0, no output. No `next build` was run.

**Tests**: PASSED. `npm test` with a dummy DATABASE_URL: 320 files passed (320), 7286 tests passed (7286), 0 failed, exit 0 (190.9 s).

**Lint**: `npx eslint src` exit 1, 131401 messages over 683 files, all severity error. ALL 131401 contain the CR marker (U+240D: "Delete CR" or prettier-on-CRLF). 0 messages lack the marker, so there is no non-CRLF lint finding. (Parsed from `-f json` output.)

**Format**: `prettier --check --end-of-line auto` over every changed src/ and i18n/ file: all pass.

**Coverage**: not available (no coverage run requested; not a failure).

**Integration (opt-in)**: `validation-signals.integration.test.ts` was NOT executed (user-gated Neon run, tasks 9.1-9.4; this verify also may not touch any database). It typechecks.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | PASS | "TDD Cycle Evidence" table in apply-progress.md |
| All tasks have tests | PASS | 9/9 behavior rows name a test file; docs and planning units have none by nature |
| RED confirmed (tests exist) | PASS | 9/9 test files exist |
| GREEN confirmed (tests pass) | PASS | all files passed in the full run; the integration file is compile-only by design |
| Triangulation adequate | PASS | several cases per behavior (3 non-rest causes, 2 rest causes, 3 invalid-cause values, 7 verdict rows, both audiences, both locales) |
| Safety Net for modified files | PASS | every modified file lists an N/N baseline |

**TDD Compliance**: 6/6 checks passed. Row 4.1 admits the projection already produced the right runtime shape (RED was a tsc RED plus one leak test) and row 2.1 admits other verdict rows passed on the old code; both are honest and acceptable.

### Test Layer Distribution
| Layer | Files | Tools |
|-------|-------|-------|
| Unit | causes, verdict, evaluate, coordination-view, data/signals, data/signals-sql, review-messages (7) | vitest |
| Component | signals-section (1, includes an axe run) | vitest + testing-library |
| Integration (opt-in, not executed) | validation-signals.integration (1, 2 new cases) | vitest + real Postgres |

### Assertion Quality
No tautologies, no assertion-free tests, no ghost loops: loops in evaluate.test.ts iterate the large non-empty `cases` set and the sweep also asserts that `seen` holds the not_applicable keys, so an empty set would fail. The `as unknown as` casts appear only in deliberate leak tests (coordination-view, signals-section) that assert absence of leaked evidence.
**Assertion quality**: 0 CRITICAL, 0 WARNING

### Spec Compliance Matrix (10 requirements, 47 scenarios)

**validation-signals (7 requirements, 26 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Rest signals apply only to causes that admit rest | Non-rest causes make RN-09 and RN-10 not applicable | evaluate.test.ts > "makes RN-09 and RN-10 not applicable for %s" (x3); data/signals.test.ts > "hands the declared cause to the evaluator" | COMPLIANT |
| | Cut precedes extraction state | evaluate.test.ts > "keeps the cut ahead of an extraction that is %s" (pendiente, fallida) and "...no extraction row" | COMPLIANT |
| | Medical cause keeps RF-05 b | evaluate.test.ts > "still evaluates both signals for %s" (medica); data/signals.test.ts > "keeps RN-09 present ... medical request" | COMPLIANT |
| | Maternity or paternity still evaluates both | evaluate.test.ts > "evaluates RN-10 for maternity or paternity: a covered range, then a gap" and "still evaluates both signals for %s" | COMPLIANT |
| | RN-07, RN-14, RN-26 independent of cause | evaluate.test.ts > "evaluates RN-07, RN-14 and RN-26 the same for every cause" (5 causes, non-trivial present values) | COMPLIANT |
| | Five results in fixed order | evaluate.test.ts > "returns the five results in fixed order for %s" (x5) | COMPLIANT |
| | Missing or invalid cause fails loud | data/signals.test.ts > "degrades with no verdict and reads nothing else when the request has %s" (null, "vacaciones", "") | COMPLIANT |
| Four outcomes (RENAMED) | (rename only, no scenarios) | rename reflected in the types.ts comment | n/a |
| Four outcomes (MODIFIED) | Reason is always from the closed set | evaluate.test.ts > "gives present and absent no reason, and not_evaluable one allowed ..." (sweep with a not_applicable branch asserting keys are exactly signal and outcome) | COMPLIANT |
| | Precedence of reasons | evaluate.test.ts > pickReason precedence (unchanged, passing) | COMPLIANT |
| Incoherent dates, RN-09 | Document boundaries | rest-dates.test.ts > "evaluateIncoherentDates document boundaries" (evaluator unchanged) | COMPLIANT |
| | Aggregation over several documents | rest-dates.test.ts > "evaluateIncoherentDates aggregation" | COMPLIANT |
| | Retired and staff documents ignored | existing current-document filtering tests in data/signals.test.ts (unchanged) | COMPLIANT |
| | Cause without rest | evaluate.test.ts > "makes RN-09 and RN-10 not applicable for %s" | COMPLIANT |
| Uncovered dates, RN-10 | Containment boundaries | rest-dates.test.ts > "evaluateUncoveredDates containment" | COMPLIANT |
| | Days-only documents | rest-dates.test.ts > "evaluateUncoveredDates days-only documents" | COMPLIANT |
| | Extraction pending or failed on an uncovered range | rest-dates.test.ts > "evaluateUncoveredDates pending or failed documents" | COMPLIANT |
| | Cause without rest | evaluate.test.ts > RN-10 slot of the non-rest tests and the sweep test | COMPLIANT |
| Three-state suggested verdict | Verdict table | verdict.test.ts > "suggestVerdict table" and "suggestVerdict with not applicable signals" (7 new rows) | COMPLIANT |
| | Present beats not evaluable | verdict.test.ts > "lets present beat not evaluable ..." | COMPLIANT |
| | Extraction not available | verdict.test.ts > "is inconclusive, never no_alerts, while extraction is pending" | COMPLIANT |
| | Non-rest cause, others evaluable and absent | evaluate.test.ts (verdict no_alerts, notEvaluable empty); data/signals.test.ts (verdict no_alerts) | COMPLIANT |
| | Non-rest cause with a signal not evaluable | evaluate.test.ts > "is inconclusive for a non-rest cause with RN-14 not evaluable, listing only RN-14" | COMPLIANT |
| | Non-rest cause with RN-14 present | evaluate.test.ts > "suggests reviewing carefully when RN-14 is present for a non-rest cause" | COMPLIANT |
| Signals text, i18n and accessibility | Translation keys present | review-messages.test.ts > same keys plus outcome list with not_applicable and notApplicableNote | COMPLIANT |
| | Not applicable wording | review-messages.test.ts > "words not applicable as No aplica with its explanation line" | COMPLIANT |
| | Text, not color | signals-section.test.tsx > "states the outcome in words next to a present and a not evaluable signal" | COMPLIANT |

**request-review (2 requirements, 12 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Signals section and suggested verdict | Section content | existing signals-section.test.tsx (unchanged) | COMPLIANT |
| | Not applicable entries | signals-section.test.tsx > "SignalsSection not applicable entries" (label and note, no evidence, "No alerts", not in the apart list, es wording) | COMPLIANT |
| | Extracted data section unchanged for a non-rest cause | no dedicated test; extraction-section.tsx has zero diff and no cause input; existing extraction-section.test.tsx passes | COMPLIANT (by construction, see SUGGESTION 3) |
| | Decision controls untouched | existing tests (unchanged) | COMPLIANT |
| | Shown after the decision | existing tests (unchanged) | COMPLIANT |
| | Not in the queue or the tabs | existing tests (unchanged) | COMPLIANT |
| | Reference to an earlier request (S2) | existing tests (unchanged) | COMPLIANT |
| | Match outside the scope shows no reference (S2) | existing tests (unchanged) | COMPLIANT |
| | Not for other roles | existing tests (unchanged) | COMPLIANT |
| Signals UI i18n | Translation keys present | review-messages.test.ts | COMPLIANT |
| | Verdict wording | existing review-messages.test.ts (unchanged) | COMPLIANT |
| | Not applicable wording | review-messages.test.ts (exact es and en strings; the no-voseo test passes over the locale) | COMPLIANT |

**coordination-escalation (1 requirement, 9 scenarios)**
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Signal outcomes on the open escalation detail | Outcomes and labels only | existing coordination-view.test.ts (unchanged) | COMPLIANT |
| | Not applicable without evidence | coordination-view.test.ts > "projects not applicable as the signal and the outcome only", "leaks no evidence or reason ..."; signals-section.test.tsx > coordination audience | COMPLIANT |
| | Verdict shown, no extracted values | existing (unchanged) | COMPLIANT |
| | RN-26 match never gives a reference | existing (unchanged) | COMPLIANT |
| | Other careers and ids are a nonexistent id | existing (unchanged) | COMPLIANT |
| | Notices and the list carry none | existing (unchanged) | COMPLIANT |
| | Answer unaffected | existing (unchanged) | COMPLIANT |
| | Read failure | existing (unchanged) | COMPLIANT |
| | No audit row | existing (unchanged) | COMPLIANT |

**Compliance summary**: 47/47 scenarios compliant at runtime (full suite passed). One scenario relies on unchanged behavior rather than a dedicated test (SUGGESTION 3).

### Brief section 6 acceptance criteria
| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | fuerza_mayor, actividad_representativa, intercambio_academico with rest_to before issue_date: no "fechas incoherentes"; RN-09 and RN-10 "no aplica" | PASS | evaluate.test.ts it.each(NON_REST); signals-section.test.tsx; data/signals.test.ts |
| 2 | Same request, no other signal present: verdict "sin alertas", not inconclusive | PASS | evaluate.test.ts (no_alerts, notEvaluable empty); section test reads "Suggestion: No alerts" |
| 3 | medica with the E-02 case still shows incoherent dates | PASS | evaluate.test.ts "still evaluates both signals for medica"; data/signals.test.ts medical case |
| 4 | maternidad_paternidad with rest still evaluates RN-09 and RN-10 | PASS | evaluate.test.ts maternity tests |
| 5 | RN-07, RN-14, RN-26 unchanged for every cause | PASS | evaluate.test.ts five-cause equality against the medica reference |
| 6 | Coordination view shows the same outcome, no evidence | PASS | coordination-view.test.ts (projection and leak tests); signals-section.test.tsx audience=coordination |
| 7 | Unit tests for cut and verdict, plus an integration case; existing suites green | PARTIAL BY DESIGN | Unit tests pass and existing suites are green (7286/7286). The integration case (2 tests) is written and typechecked but NOT executed (user-gated Neon run, tasks 9.1-9.4) |

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Rest signals apply only to causes that admit rest | Implemented | evaluate.ts cut via admitsRest before the evaluators; readRequestBase fails loud on a null or non-isCausa cause |
| Four outcomes | Implemented | NotApplicableResult in SignalResult and SignalViewResult; no reason, no evidence |
| RN-09 and RN-10 cause scope | Implemented | evaluators untouched |
| Three-state verdict | Implemented | verdict.ts filters applicable; an empty applicable set yields inconclusive |
| Signals text, i18n | Implemented | es "No aplica" and "La causa declarada no incluye reposo."; en "Not applicable" and "The declared cause does not include a rest period." |
| Staff and coordination presentation | Implemented | SignalFact renders label plus muted note; evidence only for present and absent |
| Coordination projection | Implemented | exhaustive switch in projectResult |

### Coherence (Design D1-D8)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 fourth outcome, no reason, no evidence | Yes | types.ts NotApplicableResult |
| D2 cut in evaluate.ts before extraction reading; rest-dates.ts untouched | Yes | evaluators are not called when !admitsRest; rest-dates.ts has no diff |
| D3 CAUSAS_CON_REPOSO and admitsRest in intake/causes.ts, pure | Yes | as const satisfies readonly Causa[]; no server-only |
| D4 type restricts not_applicable to rn09 and rn10 | Yes | signal: "rn09" or "rn10" |
| D5 SignalInput.causa required | Yes | typecheck passes across all callers |
| D6 readRequestBase throws signals_request_incomplete on null or invalid cause | Yes | loadSignals degrades |
| D7 verdict over applicable results, "no applicable signal -> inconclusive" | Yes | applicable.length > 0 guard; tested ("every signal not applicable") |
| D8 label plus notApplicableNote muted line in SignalFact, both audiences; extraction section unchanged | Yes | signals-section.tsx; extraction-section.tsx has no diff |

### Out-of-scope check
Untouched (empty diff vs 245ad57): src/lib/extraction/, infra/modal/, scripts/ (including session-verify.local.ts), src/lib/signals/rest-dates.ts, RN-13 and RF-14 code. The docs diff holds only RN-09, RN-10, the 2026-11-11 history row, roadmap row 15 and the committed brief. Also in the range: two .engram/ files (apply deviation a). The working tree holds only the two pre-existing untracked items.

### Apply deviations assessed
- (a) .engram/manifest.json and a chunk in 16a7fa9: .engram/ is tracked and has been committed with ordinary commits repeatedly (16a7fa9, cdfad40, ef364cf, 1d092f2, c3e1f21, f5e4744, ...). Consistent with repo practice; it carries an unrelated 10 KB binary chunk into the PR. Minor WARNING, accepted.
- (b) extra bookkeeping commit ea258fd: only apply-progress.md and tasks.md updates. Accepted.
- (c) signals-sql.test.ts update: required (Q1 now selects "Causa"); one-line change, correct. Accepted.
- (d) closed-set sweep limited to medica and fuerza_mayor: the other three causes are covered by dedicated it.each tests (3 non-rest, 2 rest, 5-cause order and RN-07/14/26 equality). Accepted; SUGGESTION 1.
- (e) 1020 authored lines vs ~600 forecast: measured 967 additions plus 53 deletions excluding openspec/ and .engram/ (production code 112/38). Under the 1200 session budget, so no decision gate was triggered. Accepted.

### Commit hygiene
Six commits (16a7fa9, 2d5757c, 60525e9, 7aeeef8, 5566f90, ea258fd), all Conventional Commits; none carries Co-Authored-By, Claude, Anthropic or other AI attribution in subject or body.

### Issues Found
**CRITICAL**: None

**WARNING**:
1. The integration case for brief criterion 7 has never run; the real-Postgres read of Solicitud.Causa through Q1 is covered only by the emitted-SQL unit test and the db-double tests. Run it on a throwaway Neon branch (tasks 9.1-9.4, owner-gated) or accept the risk explicitly. Risk is low: the column exists (schema.ts:272, nullable for drafts, CK_Solicitud_Causa).
2. Commit 16a7fa9 ("add the SDD planning documents") also carries .engram/ sync files not mentioned in its message. Consistent with repo history; mention it in the PR description.

**SUGGESTION**:
1. Extend the closed-set sweep in evaluate.test.ts to all five causes (or add maternidad_paternidad).
2. Two comment lines (verdict.ts docstring, evaluate.ts docstring) exceed 80 columns; prettier does not reflow comments. Cosmetic.
3. Add a test that the extraction section still renders a stored rest period when the signals say not_applicable, or record the scenario as covered by construction.
4. Task 7.3 is checked though no fixture needed a fix (typecheck was already clean). Note only.
5. docs/requirements.md and docs/roadmap.md are not prettier-clean, but were already unformatted at 245ad57 (pre-existing).

### Verdict
PASS WITH WARNINGS
0 CRITICAL, 2 WARNING, 5 SUGGESTION. All 47 scenarios are compliant at runtime, typecheck and 7286 tests are green, and lint has no non-CRLF message; the only open evidence gap is the owner-gated real-database integration run.
