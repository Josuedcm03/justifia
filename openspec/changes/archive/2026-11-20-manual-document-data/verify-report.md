```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ed221b763693a30e0ce4d03a1341d6f438cfa864c3db777047a339227d04c53b
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 35/35
scenarios: 173/173
test_command: 'DATABASE_URL=postgres://u:p@127.0.0.1:9/x npx vitest run "src/app/(dashboard)/coordination/[id]/document-marks-section.test.tsx" "src/app/(dashboard)/coordination/[id]/page.test.tsx" "src/app/(dashboard)/coordination/structure.test.ts" "src/app/(dashboard)/requests/no-signals.test.ts" "src/app/(dashboard)/review/[id]/document-data-actions.test.ts" "src/app/(dashboard)/review/[id]/document-data-form.test.tsx" "src/app/(dashboard)/review/[id]/extraction-section.test.tsx" "src/app/(dashboard)/review/[id]/page.test.tsx" "src/app/(dashboard)/review/[id]/signals-section.test.tsx" "src/db/migration-manual-document-data.test.ts" "src/i18n/coordination-messages.test.ts" "src/i18n/review-messages.test.ts" "src/lib/audit/events.test.ts" "src/lib/audit/types.test.ts" "src/lib/data/document-data.test.ts" "src/lib/data/document-marks-read.test.ts" "src/lib/data/extraction-sql.test.ts" "src/lib/data/extraction.test.ts" "src/lib/data/retention-inventory.test.ts" "src/lib/data/retention.test.ts" "src/lib/data/signals-sql.test.ts" "src/lib/data/signals.test.ts" "src/lib/document-data/effective.test.ts" "src/lib/document-data/validation.test.ts" "src/lib/intake/dates.test.ts" "src/lib/signals/coordination-view.test.ts" "src/lib/signals/document-marks.test.ts" "src/lib/signals/document-type-causes.test.ts" "src/lib/signals/evaluate.test.ts" "src/lib/signals/issuer.test.ts" "src/lib/signals/rest-dates.test.ts" "src/lib/signals/rf-05-e.test.ts" "src/lib/signals/verdict.test.ts" "src/app/route-coverage.test.ts" "src/app/access-matrix.routes.test.ts" "src/app/(dashboard)/review/structure.test.ts" "src/lib/signals/display-only.test.ts" "src/lib/signals/no-persistence.test.ts" "src/lib/signals/fingerprint-exposure.test.ts"'
test_exit_code: 0
test_output_hash: sha256:c27af5fe99daba0dcfa318caee1ab5c463af3120020a76f7675d9e5ab0f4ccfc
build_command: DATABASE_URL=postgres://u:p@127.0.0.1:9/x npm run typecheck
build_exit_code: 0
build_output_hash: sha256:f2cbbbb191d7d62906ae878fdb2a44507726ff4ca341b4a9aefe69c0847edf74
```

> **Envelope note.** `evidence_revision` is the sha256 of `git diff 172e9e0..485f7a1` (the whole change on the tracker tip, merge-base with `origin/main`). `test_output_hash` is the sha256 of the console log of the focused vitest run executed in this verification (39 files, 1398 tests, exit 0); the log carries timings, so the hash is a record and not a reproducible digest. The full-suite figure is the owner-measured run on 485f7a1 (2026-11-20): 367 files, 8926 tests, all passed. It was reused, not rerun, as instructed. `build_output_hash` is the sha256 of `npm run typecheck` as run here (exit 0). Counts are completed/total over the whole change: 35 requirement headings (26 ADDED headings that carry MD-1..16, MD-21..25, MD-30..33 and MD-35, plus 9 MODIFIED headings that carry MD-17..20, MD-26..29 and MD-34) and 173 scenario headings (audit-log 10, coordination-escalation 17, data-retention 6, document-extraction 10, manual-document-data 34, request-review 42, validation-signals 54). Two scenarios under MD-6 are counted complete on structural evidence only (see W2). No database command of any kind was run.

## Verification Report

**Change**: manual-document-data (whole change: 7 slice PRs #93, #94, #95, #96, #97, #102, #104 merged into the tracker)
**Branch / HEAD**: `feat/manual-document-data` @ 485f7a1; merge-base with `origin/main` is 172e9e0 (remote `main` is still 172e9e0 per `git ls-remote`)
**Version**: N/A
**Mode**: Strict TDD (`openspec/config.yaml` `strict_tdd: true`, vitest runner)
**Artifact store**: openspec (repo-local). Native status (`gentle-ai sdd-status`): 149 tasks, 137 complete, 12 pending; `verify: blocked` only because of those 12.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total (`tasks.md`) | 149 |
| Complete | 137 (Phases 0 to 10 except 1.13 and 10.8) |
| Open | 12: 1.13, 10.8, 11.1 to 11.5, 12.1 to 12.5 |

All 12 open tasks are process or owner-gated steps; none is implementation work (W1). Task 1.13 (apply 0015 to production) is the one that gates the merge to `main`. Task 11.2 is this verification. Task 11.1 (merge the slice PRs into the tracker) is in fact done (seven merge commits 7fdb020, 9fb93e7, 369a8fd, 917bb44, 22676cc, 2f341ff, 485f7a1) but is still unchecked (S3). Tasks 12.1 to 12.5 are archive-commit tasks. Under a strict reading of the skill, unchecked tasks are CRITICAL; they are recorded as a WARNING because the requester declared them expected and owner-gated, and the data-retention verify set that precedent.

### Build and Tests Execution

**Typecheck** (`npm run typecheck`, dummy DB, run here): ✅ exit 0, no errors.

**Focused tests** (run here, dummy DB): ✅ 1398 passed, 0 failed, 0 skipped.

```text
DATABASE_URL=postgres://u:p@127.0.0.1:9/x npx vitest run <33 changed unit test files> src/app/route-coverage.test.ts src/app/access-matrix.routes.test.ts review/structure.test.ts src/lib/signals/display-only.test.ts src/lib/signals/no-persistence.test.ts src/lib/signals/fingerprint-exposure.test.ts
Test Files  39 passed (39)
     Tests  1398 passed (1398)
```

**Full suite** (owner-measured on 485f7a1, 2026-11-20, reused and not rerun): 367 files, 8926 tests, all passed. `npm run typecheck` exit 0. `npx eslint src` has only the known noise: CRLF "Delete CR" prettier errors from the autocrlf checkout, two quoted lines in `src/test/access/inventory.ts` and one unused-import warning in `src/components/app-sidebar.tsx`, all predating this change. Cross-check run here: `eslint -f json` over the 70 files this change touches reports 27633 messages, all `prettier/prettier` (CRLF), and zero from any other rule.

**Integration on real Postgres** (owner-run on the disposable branch "manual-it", NOT rerun here): recorded in apply-progress Phase 9 on commit d0dfe3f. RF-14 acceptance 29/29 (4 files, 182.9 s), retention 10/10, validation-signals 48/48. Mutations M1 (OCR wins), M2 (no promotion) and M3 (issuer history reads only OCR) each failed their cases, and the green rerun passed 29/29. Applicability to the tip was checked: `git diff d0dfe3f..HEAD -- src drizzle i18n` and `git diff 1f4f121..HEAD -- src drizzle i18n` are both empty, so the code that ran on "manual-it" is identical to the tip.

**Coverage**: ➖ not available (no vitest coverage package in `package.json`); skipped.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | ✅ | A "TDD cycle evidence" table in each of the seven PR sections of apply-progress (RED, GREEN and Refactor columns; the repository table shape, with no Safety Net or Triangulate columns) |
| All tasks have tests | ✅ | Every behavior-changing task names its test file; the 33 changed unit test files and the 6 integration files exist |
| RED confirmed | ✅ | Each RED task records the failing run and its cause; pass-at-write tests carry a revert-only mutation check |
| GREEN confirmed | ✅ | The focused run here passes 39 of 39 files; the owner-measured full run passes 367 files |
| Triangulation adequate | ✅ | Table-driven cases: 15-cell type-to-cause table, six-row aggregation table, 160/161 and 200/201 bounds, five refused states, four denied roles |
| Mutation evidence | ✅ | About 40 revert-only mutation checks across the PRs, plus M1 to M3 on real Postgres |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit and component (jsdom) | 1398 in the focused run (8926 in the full suite) | 39 focused (367 full) | vitest, testing-library, axe |
| Integration (real Postgres, owner-run) | 87 (29 + 10 + 48) | 6 | vitest integration config, branch "manual-it" |
| E2E | 0 | 0 | none installed; the RF-14 system captures are manual (Phase 10) |

### Assertion Quality

| File | Assertion | Issue | Severity |
|------|-----------|-------|----------|
| `src/i18n/coordination-messages.test.ts` | three `.toBeTruthy()` on the new keys | Existence only; other cases in the file pin the exact wording | WARNING |
| `src/app/(dashboard)/coordination/[id]/page.test.tsx` | two `.toBeTruthy()` | Existence only; neighbouring cases assert text | WARNING |
| `src/lib/signals/evaluate.test.ts` | two `.toBeDefined()` | Type only, inside sweeps that also assert reasons | WARNING |
| `src/app/(dashboard)/review/[id]/document-data-form.test.tsx` | one CSS-class `querySelector` not null | Implementation detail; the 360 px design and task 7.6 mandate those classes | WARNING |

No tautology, no assertion without a production call, and no ghost loop was found in the lines this change adds. **Assertion quality**: 0 CRITICAL, 4 WARNING (reported as one item, W5).

### Quality Metrics

**Linter**: ✅ no non-prettier findings on the 70 touched files (the working tree is CRLF, Git stores LF).
**Type Checker**: ✅ no errors.

### Thesis acceptance (source of truth: `C:\thesis-workspace`)

| Criterion (thesis text) | Proven by | Result |
|---|---|---|
| RF-14 (a): register or correct name, issuer, issue date and rest period; each datum marked "ingresado manualmente" | IA round trip and RN-24 cases, ES "marks each of the four data", DD; capture RF-14_a.png (request 145: four data marked, one `DocumentoDatoManual` row, one audit row with field names only) | ✅ |
| RF-14 (b): firma and sello marks saved | IB SC-08, SC-14 and the three states, DD; capture RF-14_b.png (firma No, sello Sí, "Firma ausente" present, "Revisar con cuidado") | ✅ |
| RF-14 (c): without OCR data the request resolves with the registered data | IC SC-12 (forced fallida, then capture gives RN-10 present), no-row document, `decideRequest` approval with fetch spied and never called; captures RF-14_c.png and RF-14_c-resuelta.png (request 138, extraction off, approved) | ✅ with caveat W3 |
| RF-14 (d): type registered and contrasted with the cause (RN-13) | ID SC-05, RE, DM 15 pairs; capture RF-14_d.png (request 146, "Formato no corresponde a la causa" present) | ✅ |
| RF-05 (e): "tipo discordante" as a Vitest unit | `src/lib/signals/rf-05-e.test.ts` (16 tests: SC-05 present; SC-01, SC-06, SC-09, SC-10, SC-13, SC-11 b absent; "otro" present for the five causes; untyped is not_registered), mutation check recorded | ✅ |
| RN-11 firma ausente, RN-12 sello ausente | `evaluateMissingSignature`, `evaluateMissingSeal`; IB SC-14 and SC-08; evaluated for every cause, never not_applicable | ✅ |
| RN-13 formato no corresponde a la causa; the mapping is a normative parameter (RNF-14) | Map injected through `SignalParams.documentTypeCauses`; DM "map is an input"; RNF-14 stays "No cumple" (constant), as declared | ✅ |
| RN-24 manual prevails over OCR | `toEffectiveRow` (EF), `listExtractions`, `readIssuerHistory` coalesce; M1 and M3 fail on real Postgres | ✅ |
| Hoja lines 46 to 53, steps a, b, c, d | Phase 10 table in apply-progress; evidence files present in `bitacora/evidencia_p1_2026-11-18/rf14/` (RF-14_a, _b, _c, _c-resuelta, _d, _d-causa, `rf14-resultados.json`); the hoja itself is untouched (still "No ejecutable", owner edit at archive) | ✅ |
| A5 SC-05, SC-08, SC-12, SC-14 | ID, IB, IC, IB (all in the 29/29 run); unit mirrors in RE and DM | ✅ |
| A5 SC-11 a and b | b gives no signal (ID, RE). a: A5 expects "Ninguna", but RN-11 and RN-12 are present when the secretary marks No; the spec says so and the thesis must be updated (task 12.3, S7) | ✅ b, flagged a |

### Spec Compliance Matrix

Evidence keys (paths relative to the repository root, `[id]` folders under `src/app/(dashboard)/`). Unit and component tests ran here and in the owner full run; integration tests (I*) ran on real Postgres at a tree identical to the tip.

- DD `src/lib/data/document-data.test.ts`, EF `src/lib/document-data/effective.test.ts`, VA `src/lib/document-data/validation.test.ts`, MG `src/db/migration-manual-document-data.test.ts`
- DM `src/lib/signals/document-marks.test.ts`, DTC `src/lib/signals/document-type-causes.test.ts`, EV `src/lib/signals/evaluate.test.ts`, VE `src/lib/signals/verdict.test.ts`, RE `src/lib/signals/rf-05-e.test.ts`, CV `src/lib/signals/coordination-view.test.ts`
- LX `src/lib/data/extraction.test.ts` plus `extraction-sql.test.ts`, LS `src/lib/data/signals.test.ts` plus `signals-sql.test.ts`, MR `src/lib/data/document-marks-read.test.ts`, RI `src/lib/data/retention-inventory.test.ts` plus `retention.test.ts`, AE `src/lib/audit/events.test.ts` plus `types.test.ts`
- AC `review/[id]/document-data-actions.test.ts`, FO `review/[id]/document-data-form.test.tsx`, ES `review/[id]/extraction-section.test.tsx`, SS `review/[id]/signals-section.test.tsx`, PG `review/[id]/page.test.tsx`, ST `review/structure.test.ts`, CP `coordination/[id]/page.test.tsx`, CM `coordination/[id]/document-marks-section.test.tsx`, RC `src/app/route-coverage.test.ts` plus `access-matrix.routes.test.ts`, I18N `src/i18n/review-messages.test.ts` plus `coordination-messages.test.ts`
- Integration (owner-run): IA, IB, IC, ID are `src/lib/data/integration/rf-14-a` to `rf-14-d.integration.test.ts` (29 cases), IR is `retention.integration.test.ts` (10), IS is `validation-signals.integration.test.ts` (48)
- X means an existing test that this change did not edit, still green, covering unchanged behavior the scenario relies on

#### manual-document-data (MD-1 to MD-11): 34 scenarios

| Req | Scenario | Evidence | Result |
|-----|----------|----------|--------|
| MD-1 | RF-14 (a) register the four data | IA round trip; ES "marks each of the four data"; DD insert plus audit | ✅ COMPLIANT |
| MD-1 | RF-14 (a) correct a registered value | DD "updates the stored manual record" | ✅ COMPLIANT |
| MD-1 | Correct an extracted value without touching the extraction | IA "byte-equal through every save", "manual value wins"; LX | ✅ COMPLIANT |
| MD-1 | Name never reaches the snapshot | DD "never touches the extraction row or the request state" (the request row is only locked and read) | ✅ COMPLIANT |
| MD-2 | One manual datum among extracted ones | EF "resolves the four data independently" | ✅ COMPLIANT |
| MD-2 | Clearing reverts to the extracted value | EF precedence table; IA "reverts when cleared" | ✅ COMPLIANT |
| MD-2 | Clearing without an extracted value | EF "does not borrow values from an extraction that did not complete"; DD delete of the last value | ✅ COMPLIANT |
| MD-2 | Rest period is not mixed | EF "mixes nothing over an extracted rest" | ✅ COMPLIANT |
| MD-3 | Field bounds and forms (table) | VA text bounds, issue date, rest period cases (160/161, 200/201, 2026-02-30, 2024-01-15, from after to, lone date, both empty) | ✅ COMPLIANT |
| MD-3 | One invalid field refuses the whole save | VA "one invalid field refuses the whole save"; AC validation table | ✅ COMPLIANT |
| MD-4 | RF-14 (d) register the type | ID SC-05; RE; DD marks update; capture RF-14_d.png | ✅ COMPLIANT |
| MD-4 | Closed set (table) | VA type cases ("formato_especial" gives type_invalid) | ✅ COMPLIANT |
| MD-5 | RF-14 (b) marks are saved | IB SC-08 and SC-14; DD "updates only the document marks" | ✅ COMPLIANT |
| MD-5 | Three states stay distinct | IB "keeps the three mark states apart"; VA "keeps false distinct from null" | ✅ COMPLIANT |
| MD-5 | Marks are independent | DD "returns a mark to not registered, apart from No"; IB "firma and sello independent" | ✅ COMPLIANT |
| MD-6 | Editable by state (table) | DD guards: pendiente accepted, five other states refused with no write and no audit | ✅ COMPLIANT |
| MD-6 | Back to pendiente | DD proves that pendiente is accepted; the earlier data survives because the structural pin (DD write surface) shows no module but the writer can change or delete the manual record, so escalation and answer code cannot clear it; no test runs the full escalate, answer, resubmit cycle (W2) | ✅ COMPLIANT (structural) |
| MD-6 | Decision closes the window | DD pins the FOR UPDATE lock taken first in the transaction (the mutation check removes it and the case fails); `decideRequest` updates the request row conditionally on its state, so the ordering holds by Postgres row-lock semantics; no concurrent run on Postgres (W2) | ✅ COMPLIANT (structural) |
| MD-6 | Coordination cannot write | AC "sends %s to /denied" for the four non-secretaria roles including coordinacion; RC matrix | ✅ COMPLIANT |
| MD-7 | Callers (table) | AC (anonymous to /login, the four other roles to /denied, no facultad or other facultad gives not_found); DD scope cases; RC | ✅ COMPLIANT |
| MD-7 | Document that is not current | DD "answers not_found for an unknown document, a document of another request, a retired one and a staff-uploaded one alike" | ✅ COMPLIANT |
| MD-7 | Never shown to the student | PG "gives the student side no manual value, mark, type, form or action"; X `requests/no-signals.test.ts` | ✅ COMPLIANT |
| MD-8 | Denial matrix over the real guard | RC (64 entry points x 7 identities, 100 percent denied) | ✅ COMPLIANT |
| MD-8 | Table equals the tree | RC RAC-5 (it failed first naming the action file, task 7.3) | ✅ COMPLIANT |
| MD-9 | Success is atomic | DD "writes the mark update, the manual insert and exactly one audit row ... in one transaction" | ✅ COMPLIANT |
| MD-9 | Failure rolls back | DD audit-insert failure and post-write failure cases (database double; the rollback itself is the driver transaction) | ✅ COMPLIANT |
| MD-9 | No-op | DD two no-op cases (no write, no audit row) | ✅ COMPLIANT |
| MD-9 | Signals are not read | AC "never reads the signals" (throwing stub); DD structural pin (no signals import) | ✅ COMPLIANT |
| MD-10 | RF-14 (c) extraction off, resolve with registered data | IC "resolves the request ... through the decision of the review action, with no outbound extraction call"; PG form offered when not configured; capture RF-14_c-resuelta.png | ✅ COMPLIANT |
| MD-10 | Extraction fallida, resolve with registered data | IC SC-12 fallida; ES "registered values of a failed extraction" | ✅ COMPLIANT |
| MD-10 | SC-12 forced fallida, then capture gives RN-10 | IC SC-12 (rn10 not_evaluable extraction_failed, then present, review_carefully); M2 mutation fails it | ✅ COMPLIANT |
| MD-10 | SC-12 variant, completada with nothing recognized | IC variant (field_missing, then present) | ✅ COMPLIANT |
| MD-10 | Decision does not require manual data | X `solicitud-decision.test.ts` (decision path not modified: no diff in `solicitud-decision.ts`) | ✅ COMPLIANT |
| MD-11 | No values in logs | DD "writes no manual value to any log, on success or on failure"; AC "logs nothing at all for a refusal or a success" and the unexpected case (fixed code and two ids) | ✅ COMPLIANT |

#### validation-signals (MD-12 to MD-20): 54 scenarios

| Req | Scenario | Evidence | Result |
|-----|----------|----------|--------|
| MD-12 | Document check (table) | DM rn11 per-document and six-row tables | ✅ COMPLIANT |
| MD-12 | SC-14 firma ausente | IB SC-14; DM; RE | ✅ COMPLIANT |
| MD-12 | Independent of extraction and cause | EV "reads no extraction" and the fuerza_mayor case; DM | ✅ COMPLIANT |
| MD-13 | Document check (table) | DM rn12 tables | ✅ COMPLIANT |
| MD-13 | SC-08 sello ausente | IB SC-08; DM | ✅ COMPLIANT |
| MD-13 | Firma and sello are independent | DM "firma Si with sello Sin registrar: rn11 absent, rn12 not evaluable" | ✅ COMPLIANT |
| MD-13 | The special format has no exemption (SC-11 a and b) | RE SC-11 a (rn11 and rn12 present); ID SC-11 b (all absent) | ✅ COMPLIANT |
| MD-14 | RF-05 (e) tipo discordante | RE "SC-05 ... raises formato no corresponde a la causa" and "the other seven signals are as without the type" | ✅ COMPLIANT |
| MD-14 | Correspondence (15 pairs) | DM "covers every type and every cause" plus the 15-row table; DTC | ✅ COMPLIANT |
| MD-14 | SC-05 tipo discordante | ID SC-05 (rn13 present, review_carefully); RE | ✅ COMPLIANT |
| MD-14 | Institutional documents correspond (SC-10, SC-06, SC-13, SC-11 b) | RE absent cases; DM table; ID SC-11 b | ✅ COMPLIANT |
| MD-14 | Medical certificate for a medical cause (SC-01, SC-09) | RE SC-01 and SC-09; ID SC-01 | ✅ COMPLIANT |
| MD-14 | otro always raises the signal | DM "otro is present for each of the five causes"; RE | ✅ COMPLIANT |
| MD-14 | Type not registered | DM "an unregistered type is not evaluable, with not_registered"; RE | ✅ COMPLIANT |
| MD-15 | Table is an input of the evaluation | DM "a fuerza_mayor request flips from present to absent with a wider map"; EV "takes the map from the params"; LS "evaluates the type with the map of the params" | ✅ COMPLIANT |
| MD-15 | Exhaustive coverage | DTC 15-cell truth table, every key present, a missing key fails | ✅ COMPLIANT |
| MD-15 | Maternity assumption | DTC maternity cell; DM | ✅ COMPLIANT |
| MD-16 | Aggregation over several documents (table, RN-11, RN-12, RN-13) | DM six-row strict table run for the three signals | ✅ COMPLIANT |
| MD-16 | One unregistered document keeps the signal open | DM "one unregistered document keeps the signal open until it is registered"; M-lenient mutation fails 5 cases | ✅ COMPLIANT |
| MD-16 | No current document | DM and EV no_eligible_documents | ✅ COMPLIANT |
| MD-16 | Evidence holds document ids only | DM "serializes with the ids and no name, issuer, date, type or fingerprint"; LS "serializes no type code, mark value or document name" | ✅ COMPLIANT |
| MD-16 | Retired and special-format documents ignored | LX filter pins (not retired, student-uploaded) feed the evaluators; DM evaluators take current documents only | ✅ COMPLIANT |
| MD-17 | Reason is always from the closed set (table) | EV "allows only no_eligible_documents and not_registered for the three codes" and the sweep | ✅ COMPLIANT |
| MD-17 | Precedence of reasons | EV "ends with not_registered" and the precedence run; X rest-dates and issuer tests | ✅ COMPLIANT |
| MD-17 | not_registered belongs to RN-11, RN-12 and RN-13 only | EV "does not allow not_registered to any other signal" | ✅ COMPLIANT |
| MD-17 | Manual data removes the extraction reason | EF promotion over fallida; IC variant and SC-12 (rn10 evaluated); M2 mutation | ✅ COMPLIANT |
| MD-18 | Nth request is flagged (table) | X `issuer.test.ts` (fixtures gained marks), IS | ✅ COMPLIANT |
| MD-18 | What does not count (table) | X `issuer.test.ts`, LS signals-sql history pins, IS | ✅ COMPLIANT |
| MD-18 | Issuer normalization | X `issuer.test.ts` | ✅ COMPLIANT |
| MD-18 | Doubled letter from the extraction | X `issuer.test.ts` | ✅ COMPLIANT |
| MD-18 | One request counts once | X `issuer.test.ts` | ✅ COMPLIANT |
| MD-18 | Threshold is a parameter | X `issuer.test.ts`, EV params | ✅ COMPLIANT |
| MD-18 | Missing inputs (table) | X `issuer.test.ts`; EF promotion changes the effective state fed to it | ✅ COMPLIANT |
| MD-18 | Manual issuer prevails over the extracted one | EF; LS coalesce pin; IA "counts the manual issuer of an earlier request toward RN-14" | ✅ COMPLIANT |
| MD-18 | Manual issuers count in the history even with failed extraction | LS pin (LEFT JOINs, no state filter); IA (count 3 of 3); M3 mutation fails it | ✅ COMPLIANT |
| MD-18 | Cleared manual issuer reverts in the history | IA "stops counting it once cleared" | ✅ COMPLIANT |
| MD-19 | Verdict table | VE (existing table plus eight-signal cases) | ✅ COMPLIANT |
| MD-19 | Present beats not evaluable | VE; EV | ✅ COMPLIANT |
| MD-19 | Extraction not available | VE | ✅ COMPLIANT |
| MD-19 | Non-rest cause, other signals evaluable and absent | VE; EV fuerza_mayor case | ✅ COMPLIANT |
| MD-19 | Non-rest cause with a signal not evaluable | VE "is inconclusive for a non-rest cause with only the marks unregistered" | ✅ COMPLIANT |
| MD-19 | Non-rest cause with RN-14 present | VE; X | ✅ COMPLIANT |
| MD-19 | Unregistered marks keep the verdict inconclusive (D1) | VE "keeps the verdict inconclusive, and lists the three apart"; IS; ID SC-01 inconclusive | ✅ COMPLIANT |
| MD-19 | SC-01 standard approval has no signal | RE SC-01 (eight absent, no alerts); ID SC-01 | ✅ COMPLIANT |
| MD-19 | Registering the marks restores the verdict | VE "restores no_alerts once the marks are registered"; ID SC-01 | ✅ COMPLIANT |
| MD-19 | A present manual signal beats not registered | VE "lets a present manual signal beat not registered" | ✅ COMPLIANT |
| MD-20 | Non-rest causes make RN-09 and RN-10 not applicable (table) | X `evaluate.test.ts` cause cut; EV | ✅ COMPLIANT |
| MD-20 | Cut precedes extraction state | X `evaluate.test.ts` | ✅ COMPLIANT |
| MD-20 | Medical cause keeps RF-05 b | X `rest-dates.test.ts`, EV | ✅ COMPLIANT |
| MD-20 | Maternity or paternity cause still evaluates both | X `rest-dates.test.ts`, EV | ✅ COMPLIANT |
| MD-20 | RN-07, RN-14 and RN-26 do not depend on the cause (table) | EV per-cause cases; X | ✅ COMPLIANT |
| MD-20 | RN-11, RN-12 and RN-13 are not cut by the cause | EV "raises the three signals for a fuerza_mayor request with firma No, sello No and type constancia_medica, while RN-09 and RN-10 are not applicable" | ✅ COMPLIANT |
| MD-20 | Eight results in fixed order for every cause | EV "returns the eight results in order" per cause | ✅ COMPLIANT |
| MD-20 | Missing or invalid cause fails loud (table) | X `signals.test.ts` and `evaluate.test.ts` (unchanged behavior, still green) | ✅ COMPLIANT |

#### request-review (MD-23 to MD-28): 42 scenarios

| Req | Scenario | Evidence | Result |
|-----|----------|----------|--------|
| MD-23 | One form per current document | ES "offers one form per current document, and each one names its document"; PG "offers one form per document on a pendiente request" | ✅ COMPLIANT |
| MD-23 | RF-14 (c) form with extraction not configured | ES "lists a document waiting for the setting with its form, the notice once and no state text"; PG "offers the form while extraction is not configured" | ✅ COMPLIANT |
| MD-23 | Form in every extraction state (table) | ES it.each over completada, pendiente, procesando, no row, fallida, not configured; PG | ✅ COMPLIANT |
| MD-23 | Prefill only manual values | FO "is prefilled only with the manual values, and shows the extracted value beside the field"; ES "prefills the manual values and shows the extracted ones as a reference" | ✅ COMPLIANT |
| MD-23 | Form not offered outside pendiente (table) | PG it.each over aprobada, rechazada, devuelta, en_revision_coordinacion; ES "offers no form when the request cannot be edited"; AC denies other roles; X page access tests | ✅ COMPLIANT |
| MD-23 | Refusal keeps the input | FO "shows an error on each invalid field, links it to the control and keeps what was typed" | ✅ COMPLIANT |
| MD-23 | Saved values are shown after the save | IA round trip through the staff read; AC redirect; capture RF-14_a.png | ✅ COMPLIANT |
| MD-23 | Degraded read shows no form | ES and PG "offers no form when the extraction read is degraded" | ✅ COMPLIANT |
| MD-24 | No revalidation in the review directory | ST (SR-11 guard 4 and the prefetch guard, new files scanned); FO "never revalidates or refreshes, and links nowhere"; AC | ✅ COMPLIANT |
| MD-24 | The action redirects to the same route | AC "saves the whole form ... and redirects to the same route"; refusals return errors | ✅ COMPLIANT |
| MD-24 | One open per render | DD writes exactly one `documento.datos_registrados` row; X page tests keep one `solicitud.consultada` per render (composition, no combined test) | ✅ COMPLIANT |
| MD-25 | Translation keys present | I18N form and section keys pinned by name, same keys in es and en (verified here: 0 keys only in es, 0 only in en) | ✅ COMPLIANT |
| MD-25 | Wording | I18N (Ingresado manualmente / Entered manually, Sí/No/Sin registrar, Constancia médica and the others; no voseo) | ✅ COMPLIANT |
| MD-26 | Full data shown | ES "shows the four fields with the rest range and its days" | ✅ COMPLIANT |
| MD-26 | Unrecognized field | ES "marks a field without value as muted not recognized" | ✅ COMPLIANT |
| MD-26 | Days only | ES "shows only the days when the document gave no dates" | ✅ COMPLIANT |
| MD-26 | Snapshot name wins | ES "labels the name as read from the document and says it is not compared"; X page tests | ✅ COMPLIANT |
| MD-26 | Manual name does not touch the snapshot | DD (the request row is never written); ES manual name with the mark and no comparison | ✅ COMPLIANT |
| MD-26 | Not for students or other roles | PG "gives the student side no manual value, mark, type, form or action"; X `no-signals.test.ts`; AC | ✅ COMPLIANT |
| MD-26 | RF-14 (a) each datum is marked manual | ES "marks each of the four data entered manually, next to its value"; capture RF-14_a.png | ✅ COMPLIANT |
| MD-26 | Manual value prevails and is marked | ES "marks only the datum that is manual, and leaves the extracted ones unmarked"; EF | ✅ COMPLIANT |
| MD-26 | Clearing removes the mark | EF "datumOrigin is manual only for a non-null manual column"; ES; IA "reverts when cleared" | ✅ COMPLIANT |
| MD-26 | Registered values on a failed extraction | ES "shows the registered values of a failed extraction with the mark, and the rest as not recognized" | ✅ COMPLIANT |
| MD-26 | RF-14 (d) type and marks are shown | ES "shows the registered type and the marks, each with its state"; "tells No from Not registered" | ✅ COMPLIANT |
| MD-27 | Extracting | ES it.each (procesando, no row) with no control and the form | ✅ COMPLIANT |
| MD-27 | Permanently failed | ES "reads unavailable, review the document for a failed row, with no control"; form while editable | ✅ COMPLIANT |
| MD-27 | Not configured | ES "shows the configuration message once for several waiting documents, without the variable name" and "lists a document waiting for the setting with its form" | ✅ COMPLIANT |
| MD-27 | Not configured and not pendiente | ES "does not list a document waiting for the setting when the request cannot be edited" | ✅ COMPLIANT |
| MD-27 | Decided request never extracting | ES it.each over aprobada and devuelta | ✅ COMPLIANT |
| MD-27 | Manual data comes first in the order | ES "shows the registered values of a failed extraction" with a decided request; EF | ✅ COMPLIANT |
| MD-28 | Section content | PG "shows the eight entries"; SS "lists the eight entries in the fixed order" | ✅ COMPLIANT |
| MD-28 | Not applicable entries | X `signals-section.test.tsx` not-applicable cases (updated to eight entries) | ✅ COMPLIANT |
| MD-28 | Extracted data section unchanged for a non-rest cause | ES (stored rest still shown); X | ✅ COMPLIANT |
| MD-28 | Decision controls untouched | X page tests, PG | ✅ COMPLIANT |
| MD-28 | Shown after the decision | X page tests (signals shown in every state) | ✅ COMPLIANT |
| MD-28 | Not in the queue or the tabs | X queue tests (no signal data in the list) | ✅ COMPLIANT |
| MD-28 | Reference to an earlier request (S2) | X `signals-section.test.tsx` RN-26 link cases | ✅ COMPLIANT |
| MD-28 | Match outside the scope shows no reference (S2) | X `signals-section.test.tsx` | ✅ COMPLIANT |
| MD-28 | Not for other roles | X `no-signals.test.ts` (updated: eight codes, three new names in the revealing words), PG | ✅ COMPLIANT |
| MD-28 | The three manual signals in their names and order | SS "names the three new entries in Spanish after rn10 and before the recurrence entry" | ✅ COMPLIANT |
| MD-28 | Not registered is listed apart with its reason | SS "lists a not registered signal apart with text saying the secretary has not registered the datum" | ✅ COMPLIANT |
| MD-28 | RF-14 (d) the registered type is contrasted with the cause | ID SC-05; SS present entry names the raising document; capture RF-14_d-causa.png | ✅ COMPLIANT |

#### coordination-escalation (MD-29, MD-30): 17 scenarios

| Req | Scenario | Evidence | Result |
|-----|----------|----------|--------|
| MD-30 | Type and marks shown read-only | CM "shows the type, the firma and the sello of a document as text"; CP "shows the type, the firma and the sello as text, with no control" | ✅ COMPLIANT |
| MD-30 | Registered values stay hidden | CM "shows no name, issuer, date or rest even if the item carried them"; CP "shows no name, issuer, date or rest"; MR statement pin (no manual table, no extracted column) | ✅ COMPLIANT |
| MD-30 | Unregistered data reads as such | CM and CP "reads Sin registrar for a type and marks not registered" | ✅ COMPLIANT |
| MD-30 | No write path for coordination | AC the four non-secretaria roles denied before any read or write; RC matrix | ✅ COMPLIANT |
| MD-30 | Notices and the list carry none | CP "neither reads nor renders the block on a notice" | ✅ COMPLIANT |
| MD-30 | Other careers are a nonexistent id | CP "never reads the marks for a coordinator without a career, a malformed id or another role"; X not-found tests | ✅ COMPLIANT |
| MD-30 | Read failure | CM "replaces the entries with one degraded notice"; CP "renders the rest, the answer form and the degraded notice when the read is degraded"; MR fail-soft | ✅ COMPLIANT |
| MD-29 | Outcomes and labels only | CV; X coordination page tests (eight results) | ✅ COMPLIANT |
| MD-29 | Not applicable without evidence | X CV and CP not-applicable cases | ✅ COMPLIANT |
| MD-29 | Verdict shown, no extracted values | CV "projects the manual signals to outcome and reason label only"; CP | ✅ COMPLIANT |
| MD-29 | RN-26 match never gives a reference | X CV | ✅ COMPLIANT |
| MD-29 | Other careers and ids are a nonexistent id | X CP | ✅ COMPLIANT |
| MD-29 | Notices and the list carry none | X CP, CP | ✅ COMPLIANT |
| MD-29 | Answer unaffected | X escalation answer tests (unchanged) | ✅ COMPLIANT |
| MD-29 | Read failure | X CP signals degraded case | ✅ COMPLIANT |
| MD-29 | No audit row | CP "adds no audit row: the only read is the existing one" | ✅ COMPLIANT |
| MD-29 | Manual-data signals as outcomes and labels only (SC-08, SC-14) | CV (rn11 not_registered, rn12 present, rn13 absent as outcome and label only); SS coordination audience shows labels only | ✅ COMPLIANT |

#### document-extraction (MD-21, MD-22): 10 scenarios

| Req | Scenario | Evidence | Result |
|-----|----------|----------|--------|
| MD-21 | Field-by-field precedence (table) | EF precedence table (A/none, A/B, none/B, none/none) | ✅ COMPLIANT |
| MD-21 | Manual data promotes the state | EF it.each over fallida, pendiente, procesando, absent; LX "resolves a document with no extraction row and a manual issue date as completada"; M2 mutation | ✅ COMPLIANT |
| MD-21 | Marks and type do not promote | EF "does not promote on the type or marks alone"; LX "passes the marks through ... and never promotes on them"; IB "never promotes a row" | ✅ COMPLIANT |
| MD-21 | Rest period is one unit | EF rest-period group; LX "derives the days of a manual rest period over a failed row" | ✅ COMPLIANT |
| MD-21 | Page and signals read the same view | LS "hands the marks of the effective read to the evaluators"; `loadSignals` consumes `listExtractions` rows (single read); IA reads both | ✅ COMPLIANT |
| MD-21 | Clearing restores the extracted value | EF; IA "reverts to the extracted value when a manual value is cleared" | ✅ COMPLIANT |
| MD-22 | Late extraction does not overwrite | EF (ocr kept next to manual); IA "manual value wins"; extraction writers untouched (DD structural pins: no extraction table named) | ✅ COMPLIANT |
| MD-22 | Manual save leaves the row alone | DD "never touches the extraction row"; IA "extraction row byte-equal through every save" | ✅ COMPLIANT |
| MD-22 | Failure after manual data | EF "does not borrow values from an extraction that did not complete" (manual kept over fallida); IC fallida cases | ✅ COMPLIANT |
| MD-22 | Document deleted | MG FK ON DELETE cascade; IR cascade case (10 of 10) | ✅ COMPLIANT |

#### audit-log (MD-31 to MD-33): 10 scenarios

| Req | Scenario | Evidence | Result |
|-----|----------|----------|--------|
| MD-31 | Action to entity type | AE "maps to documento.datos_registrados on the document, with the request in the payload"; types test (compile-time pin of entity types, checked by typecheck) | ✅ COMPLIANT |
| MD-31 | Existing events unchanged | AE "leaves the existing document and request payloads unchanged" | ✅ COMPLIANT |
| MD-32 | Successful save (table) | DD one audit row for one or several changed fields, delete case; IA "one audit row per save that changed something" | ✅ COMPLIANT |
| MD-32 | Saves that must leave no row (table) | AC validation, role and scope refusals; DD not_editable, out of scope, no-op, audit-insert failure, post-write failure | ✅ COMPLIANT |
| MD-32 | Actor from the session | DD "takes the audit actor from the actorId argument"; AC "uses the session user and the resolved scope even when the body claims others" | ✅ COMPLIANT |
| MD-32 | Open and save are separate rows | DD writes only `documento.datos_registrados`; X page tests keep the single `solicitud.consultada` (composition, no combined test) | ✅ COMPLIANT |
| MD-33 | Names, not values | AE "carries exactly the request id and the changed field names" and "drops a name, issuer, date, day count, type code or mark smuggled into the call"; IA names-only audit case; capture JSON | ✅ COMPLIANT |
| MD-33 | Cleared value | AE "reports a cleared value by name, like any other change, with no value" | ✅ COMPLIANT |
| MD-33 | Closed list | AE "reports every field of the closed list by its own name, and no other name"; DD campos order | ✅ COMPLIANT |
| MD-33 | Payload-leak check | AE serialization checks; IA audit case searched for values | ✅ COMPLIANT |

#### data-retention (MD-34, MD-35): 6 scenarios

| Req | Scenario | Evidence | Result |
|-----|----------|----------|--------|
| MD-35 | Inventory lists the new columns and table | RI (tipoDocumento, tieneFirma, tieneSello deleted; documentoDatoManual every column deleted) | ✅ COMPLIANT |
| MD-35 | Unclassified addition fails | RI inventory mechanism (fails first on the missing table and columns, task 1.2) | ✅ COMPLIANT |
| MD-35 | No explicit delete of the manual record | RI retention.test regex now includes documentoDatoManual; mutation check failed the case | ✅ COMPLIANT |
| MD-35 | Cancellation removes manual data (integration, owner-run) | IR 10 of 10 on "manual-it" at an identical tree | ✅ COMPLIANT |
| MD-34 | Requests and documents | IR (aged student documents, extraction and manual record gone) | ✅ COMPLIANT |
| MD-34 | Manual values do not survive | IR (younger student untouched, `usuario.cancelado` payload searched for the manual values) | ✅ COMPLIANT |

**Compliance summary**: 173/173 scenarios compliant, 0 failing, 0 untested. Two of them (both under MD-6) rest on structural evidence, not on a behavioral or concurrent run (W2). Requirements: 35/35.

### Correctness (Static Evidence)

| Requirement group | Status | Notes |
|-------------------|--------|-------|
| MD-1 to MD-5 manual data, validation, type, marks | ✅ Implemented | `src/lib/data/document-data.ts` (single writer), `src/lib/document-data/{types,effective,validation}.ts`, migration 0015, schema columns and CHECKs |
| MD-6 edit window, MD-7 and MD-8 authorization | ✅ Implemented (two MD-6 scenarios on structural evidence, W2) | Pendiente re-checked under `FOR UPDATE` with `requestRowInScope`; role through `rolesRevisores` in `permissions.ts`; matrix row `saveDocumentDataAction`; see W2 |
| MD-9 one transaction, MD-11 no values logged | ✅ Implemented | Audit insert in the same transaction; no console call in the writer; action logs a fixed code and two ids |
| MD-10 resolve without extraction | ✅ Implemented | Any manual value promotes the effective state to completada; decision path untouched |
| MD-12 to MD-20 signals | ✅ Implemented | `src/lib/signals/document-marks.ts` (strict aggregation), `document-type-causes.ts`, `params.ts` seam, `evaluate.ts` (three results outside the cause cut), `types.ts` (eight codes, `not_registered` last in the precedence) |
| MD-21, MD-22 effective view, extraction isolation | ✅ Implemented | `listExtractions` second LEFT JOIN plus `toEffectiveRow`; `readIssuerHistory` coalesce; no write to the extraction table |
| MD-23 to MD-28 review UI | ✅ Implemented | `document-data-form.tsx`, `extraction-section.tsx` (editable prop), `signals-section.tsx`, i18n es and en with identical key sets |
| MD-29, MD-30 coordination | ✅ Implemented | `document-marks-read.ts` narrow read, `document-marks-section.tsx` after the signals, one shared access decision |
| MD-31 to MD-33 audit | ✅ Implemented | `documentDataRecordedEvent` takes field names only; action added, entity type unchanged |
| MD-34, MD-35 retention | ✅ Implemented | Inventory classifies the three columns and the table; `retention.ts` never names the table; cascade proven on real Postgres |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| A1 marks on `DocumentoRespaldo`, nullable, `CK_Documento_TipoDocumento` | ✅ Yes | Migration holds three nullable ADD COLUMN and the CHECK (MG) |
| A2 1:1 table `DocumentoDatoManual`, cascade FK, three CHECKs | ✅ Yes | FK to the document `ON DELETE cascade`, FK to `Usuario` with no cascade; fully generated SQL, no destructive statement |
| A3 merge in TS for the display, SQL coalesce for the history only | ✅ Yes | `toEffectiveRow` in `listExtractions`; coalesce in `readIssuerHistory` |
| A4 any manual field promotes; marks alone do not | ✅ Yes | EF and M2 |
| A5 strict absent rule | ✅ Yes | One `aggregate` function for the three signals; the lenient mutation fails 5 cases |
| A6 type-to-cause map behind the params seam | ✅ Yes | `SignalParams.documentTypeCauses`, default from the constant |
| A7 pendiente under a request lock | ✅ Yes | Lock first in the transaction (pinned) |
| A8 coordination sees outcomes and labels only | ✅ Yes | Plus the MD-30 block of type and marks through a narrow read (decided in 0.1 d) |
| A9 audit holds field names only | ✅ Yes | Closed list of seven names; keys `solicitudId` and `campos` |
| Writer uses INSERT ... ON CONFLICT DO UPDATE | ⚠️ Deviation | Reads the row under the request lock, then inserts, updates or deletes; recorded because the database double cannot observe a conflict clause; behavior equals the design sequence (W4) |
| Evidence kinds `mark` and `documentType` with counts and type codes | ⚠️ Deviation | Collapsed to one `documents` kind holding ids only, per spec MD-16 and decision 0.1 c; spec wins (W4) |
| Section retitled "Datos del documento"; key `states.notExtracted` | ⚠️ Deviation | Title unchanged (decision 0.1 b); the key was dropped because MD-27 says a waiting document has no per-document state text (W4, S2) |
| Form keyed on document id plus `ActualizadoEn` and marks | ⚠️ Deviation | Keyed on document id, manual values and marks; equivalent, needs no read change (W4) |
| One `rf-14.integration.test.ts` | ⚠️ Deviation | Four files named after the incisos, by owner instruction; Phase 9 command updated (W4) |

### Security Review

| Point | Result | Evidence |
|-------|--------|----------|
| MD-11 no raw error logging | ✅ | The action catches every throw and logs `document_data_save_failed` with the two ids only, not even the error name; `redirect` and the guard sit outside the try block. The writer has no console call (structural pin plus a spy over every console method). Read paths (`listExtractions`, `loadSignals`, `listDocumentMarks`) log ids and `error.name` only. A Postgres CHECK message that could embed a row never reaches a log |
| No values in audit rows | ✅ | `documentDataRecordedEvent` accepts only `documentoId`, `solicitudId` and `campos`; AE shows smuggled values are dropped; the payload keys are exactly two |
| Role recheck | ✅ | `requireRole(...rolesRevisores)` runs first in the action, so the page guard is not trusted; the policy lives in `src/lib/auth/permissions.ts`; the matrix row proves anonymous, flagged and the four other roles are denied with no data double called |
| Scope recheck | ✅ | `resolveRequestScope` in the action, then `requestRowInScope` under `FOR UPDATE` in the writer; scope none, unknown id, other facultad and not-current document all give the same `not_found` |
| Actor and ids from the session, not the body | ✅ | The actor is `user.sub`; the scope comes from the database; ids are parsed as positive safe integers; a file entry reads as empty |
| Coordination never sees the four values | ✅ | `listDocumentMarks` selects the id, the file name, the type and the two marks only; a statement-level pin shows no manual table and no extracted column; the section renders nothing else even if an item carried values; coordination has no write path (denied before any read or write) |
| Student and other roles | ✅ | A structural case in PG pins that nothing under `requests/` names the manual data, marks, type, form or action |
| No outbound request on save | ✅ | The writer imports no extraction module; IC spies the global fetch during the approval and it is never called |
| Migration safety | ✅ | Additive and nullable only; no DROP, DELETE, UPDATE, ALTER COLUMN, RENAME or BEGIN (MG); production not touched by apply |

### Merge Gate (tasks.md section "Merge gate")

| Precondition | State |
|--------------|-------|
| 0015 applied to production and verified read-only (task 1.13, owner yes for that exact command) | ❌ OPEN. Last production check (1.10, 2026-11-19 18:42 Managua): 15 migrations, none of the 0015 objects |
| Integration suite passed on "manual-it" (9.5) | ✅ Recorded: commit d0dfe3f, 29/29, 10/10, 48/48, M1 to M3; the tip tree is identical |
| RF-14 captures recorded (10.7) | ✅ Recorded 2026-11-20 on 1f4f121; four incisos Cumple; evidence files present |
| `sdd-verify` passes (11.2) | ✅ This report: 0 CRITICAL |
| Owner explicit OK to merge (11.4) | ❌ OPEN |
| Dated entries for 11.3 | ❌ Waits for 1.13 |
| Only the tracker merges; tracker and slice branches kept | ✅ The tracker holds all seven slices; 10.8 deletes only the Neon branch |

### Issues Found

**CRITICAL**: None.

**WARNING**:
- W1: 12 of 149 tasks are open (1.13, 10.8, 11.1 to 11.5, 12.1 to 12.5); all are process or owner-gated, none is implementation, and 1.13 blocks the merge to `main`.
- W2: MD-6 scenarios "Back to pendiente" and "Decision closes the window" are counted compliant on structural evidence only (a state guard, a single-writer pin and a pinned FOR UPDATE lock); no test runs the escalate, answer, resubmit cycle and none races a save against a decision on Postgres.
- W3: The RF-14 (c) system capture used request 138, whose document kept an earlier extraction row (1 attempt, 3 Nov), so it does not show a document without extracted data (the criterion itself is proven by IC on real Postgres with no-row and fallida documents); the optional MD-30 coordination capture was skipped (unit tests only).
- W4: Five recorded design deviations (writer without ON CONFLICT, evidence as document ids only, section title and `states.notExtracted` dropped, form key without `ActualizadoEn`, four acceptance files); none breaks a spec.
- W5: Assertion quality: 0 CRITICAL, 4 weak assertions (existence-only and CSS-class checks, listed above), none standing alone for a spec scenario.

**SUGGESTION**:
- S1: The spec (MD-13) names rn12 in English "Stamp missing" but the catalog and its test say "Seal missing"; align the spec at archive or change the string.
- S2: The spec says the section is "Datos extraídos"; the shipped Spanish title is "Datos leídos del documento" (already on main); reconcile at archive.
- S3: Check task 11.1 (it is done) and re-check `docs/requirements.md` line 153 after PR 98 merges (PR 98 was still unmerged at the last fetch).
- S4: Before merging, run `git fetch` and confirm no other branch took migration 0015 (local refs show none, and remote `main` is 172e9e0).
- S5: D1 effect in production: every existing request reads "No concluyente" until marks are registered (recorded in apply-progress); tell the secretaries before the deploy.
- S6: The planning commit a84893f carries two `.engram/chunks` files and the manifest, against the tasks.md rule never to stage `.engram/`; confirm they are intended before they reach `main`.
- S7: Thesis sync at archive (task 12.3, nothing edited here): Anexo F RF-14 rows and hoja lines 50 to 53 still read "No ejecutable"; A5 SC-11 a "Ninguna" does not hold; SC-12 "Decisión esperada"; G10 row; Alta count 47/53 to 52/53; access matrix 64 x 7.

### Verdict

PASS WITH WARNINGS

0 CRITICAL, 5 WARNING, 7 SUGGESTION. Requirements 35/35 and scenarios 173/173 compliant (two MD-6 scenarios on structural evidence, W2). The change is ready for the owner-gated merge steps; only task 1.13 and the owner explicit OK stand between the tracker and `main`.
