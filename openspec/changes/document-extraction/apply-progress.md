# Apply progress: Document Extraction

Mode: Strict TDD (vitest). Delivery: single PR with `size:exception` (task 0.1),
branch `feat/document-extraction`; slices are commit work units, not branches or
PRs.

## Batch 1 (2026-10-23): phase 0 and S1 (tasks 0.3-0.5, 1.1-1.18)

Status: 0.3, 0.4, 0.5 done (commit `b9a1ed1`). S1 1.1-1.18 done; **1.19 (commit)
held**: the authored diff is 1,484 lines, over the 800 stop threshold.

### Completed tasks

- [x] 0.3 DE-14 text-mode measurement: **FAIL** (see below)
- [x] 0.4 unpdf signatures confirmed (unpdf 1.9.1)
- [x] 0.5 Commit unit 0 (`b9a1ed1`)
- [x] 1.1 N/A (`size:exception`, stay on `feat/document-extraction`)
- [x] 1.2-1.13, 1.16, 1.17 RED/GREEN pairs for states, limits, template, config,
      validate, display
- [x] 1.14, 1.15 N/A (`[TEXT PATH]`, dropped by the 0.3 FAIL)
- [x] 1.18 Gates and diff measurement
- [ ] 1.19 Commit unit 1 (held, see "Workload / PR boundary")

### 0.3 result: FAIL

3 synthetic text-layer PDFs (fictional data) x 2 runs against the local
`nuextract3` container, text mode, DE-8 contract. Issue date and name 6/6
correct and present in the text; issuer correct 3/6 (the other 3 returned the
signing physician, who is in the text, so the appear-in-text check cannot catch
it); rest period correct 2/6 (hours returned as days; rest invented in 2 runs).
Gate fails on the issuer. Consequence: text-layer PDFs take the image path, no
rules extractor; `[TEXT PATH]` tasks 1.14, 1.15, 4.6, 4.7 are N/A. Container
stopped after the measurement (`docker ps` empty). Details in
`docs/investigacion/spike-ocr-resultados.md`.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.4/1.5 | `src/lib/extraction/limits.test.ts` | Unit | N/A (new) | Written; run failed: `./limits` unresolved | 15/15 | `it.each` over 5 remaining-budget values and 5 timeout values, clamp at zero | Margin extracted to a named constant |
| 1.2/1.3 | `src/lib/extraction/states.test.ts` | Unit | N/A (new) | Written; run failed: `./states` unresolved | 17/17 | retry below cap, final at cap, permanent on attempt 1, `not_configured` at 1 and 3 | None needed |
| 1.6/1.7 | `src/lib/extraction/template.test.ts` | Unit | N/A (new) | Written; run failed: `./template` unresolved | 8/8 | two pages in both orders prove ordering comes from the input | None needed |
| 1.8/1.9 | `src/lib/extraction/config.test.ts` | Unit | N/A (new) | Written; run failed: `./config` unresolved | 28/28 | 8 accepted and 10 rejected addresses, key present/blank/absent, default logger once per process via `vi.resetModules()` | None needed |
| 1.10/1.11 | `src/lib/extraction/validate.test.ts` | Unit | N/A (new) | Written; run failed: `./validate` unresolved | 32/32 | window table incl. 29 Feb reference, 160/200 length edges, 9 invalid date forms | Rest rules left as stub until 1.12 |
| 1.12/1.13 | `src/lib/extraction/validate.test.ts` | Unit | 32/32 | 15 of 66 failed (the non-null rest cases; null-expecting cases passed against the stub) | 66/66 | forms (a), (b) and every other combination; window edges (+30 days, one year back) | Stub placeholders removed; helpers extracted (`isPresent`, `wholeNumber`, `inclusiveDays`) |
| 1.16/1.17 | `src/lib/extraction/display.test.ts` | Unit | N/A (new) | Written; run failed: `./display` unresolved | 24/24 | each state x request state x configured, precedence table | None needed |

### Test summary

- Total tests written: 158 (limits 15, states 17, template 8, config 28,
  validate 66, display 24)
- Total passing: 158; full suite `npm test`: 242 files, 5274 tests, all passing
- Layers: Unit (158). Approval tests: none (no refactoring tasks)
- Pure functions created: `deadlineFor`, `canStartDocument`, `modelTimeoutMs`,
  `failureOutcome`, guards (3), `buildChatRequest`, `resolveExtractionConfig`,
  `validateFields`, `toExtractionDisplay`

### Work Unit Evidence (S1)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx vitest run src/lib/extraction`: 6 files, 158 tests, all passing |
| Runtime harness | N/A: pure code, no runtime boundary |
| Rollback boundary | Delete the 12 files under `src/lib/extraction/` (no other file in the repo is touched) |

### Gates (2026-10-23, dummy `DATABASE_URL`)

- `npm test`: 242 files, 5274 tests passed
- `npm run typecheck`: clean
- `npx eslint src`: 0 findings besides the CRLF `Delete ␍` noise
- `prettier --check --end-of-line auto src`: clean
- `npm run build`: not run in this batch (no Next-facing change; run at the next gate)

### Files changed

| File | Action |
|---|---|
| `docs/investigacion/spike-ocr-resultados.md` | Modified (commit `b9a1ed1`): text-mode measurement and unpdf call shapes (neutral Spanish) |
| `openspec/changes/document-extraction/tasks.md` | Modified: 0.3-0.5 and S1 marks, `[TEXT PATH]` N/A annotations |
| `src/lib/extraction/{limits,states,template,config,validate,display}.ts` | Created (496 lines) |
| `src/lib/extraction/*.test.ts` (six files) | Created (988 lines) |

### Deviations from design

1. **Text variant dropped (0.3 FAIL, owner decision 2026-10-22).**
   `PreparedDocument` is `{ kind: "images"; images: readonly Uint8Array[] }`;
   `ENGINE_ID` is the single string `nuextract3-4b/image`; `buildChatRequest`
   has no text branch; `validateFields(raw, { submittedOn })` has no
   `sourceText`; `MIN_TEXT_CHARS_PER_PAGE` and `MAX_TEXT_CHARS` are not defined.
   Untagged task text in 1.4, 1.6, 1.11, 3.4 and 5.8 still mentions the text
   path; those later tasks follow this deviation.
2. **Order:** limits (1.4/1.5) before states (1.2/1.3), because
   `failureOutcome` reads `MAX_ATTEMPTS`.
3. **Additions:** `failureOutcome(error, attempts)` in `states.ts` (the task
   asks for the rule, not its name); `STUDENT_NAME_MAX_LENGTH` (160) and
   `ISSUER_MAX_LENGTH` (200) exported from `validate.ts`; `toExtractionDisplay`
   takes `(row, { requestState, configured })`; the display model marks each
   field `{ recognized: false }` instead of a string; `config.ts` also rejects
   an address that embeds credentials and normalises the base URL (no trailing
   slash, no query).
4. **Spec and design drift to resolve at verify/archive:** spec requirements
   "Document preparation" (text-layer PDF sent as text) and "Values from text
   must appear in the text", their scenarios, and design DE-9/DE-10/DE-14 text
   rows still describe the dropped text path. Not edited in this batch.

### Issues found

- Authored diff 1,484 lines vs ~700 estimated: tests are 988 lines (the
  rest-period, window and address tables are long). The aggregate forecast of
  ~3,400 lines is likely understated by a similar factor.
- Docker Desktop lives under `%LOCALAPPDATA%\Programs\DockerDesktop`, not
  `Program Files`; cold start of the model container took about 125 s to
  `/health` ok.
- Finding for the image path: a days-only rest ("rest_days" with no dates) is
  accepted by validation, so a model-invented duration passes (seen in the
  measurement: a letter validity period returned as 30 days). RF-14/RN-24
  remain the control.

### Remaining tasks

1.19 (held), then phases 2-10.

### Workload / PR boundary

- Mode: `size:exception`, single PR from `feat/document-extraction`
- Current work unit: S1 (pure domain), staged, not committed
- Natural split if the owner wants smaller commits: A = limits, states,
  template, config (708 lines) and B = validate, display (776 lines)
- Estimated review budget impact: S1 alone is ~1.8x its forecast
