# Apply Progress: rest-signals-cause-scope

Mode: Strict TDD (vitest). Branch `fix/rest-signals-cause-scope`. Single PR, five work-unit commits plus this progress record. No database was touched: no Neon branch, no migration, no seed, no write SQL.

Status: 32 of 37 tasks complete. Pending: 9.1 to 9.4 (user-gated Neon run) and 11.3 (`sdd-verify`, next phase).

## Completed work units

| Unit | Commit | Tasks | Summary |
|------|--------|-------|---------|
| 0 | `16a7fa9` | 0.1-0.3 | SDD planning documents (an Engram sync hook also added `.engram/` chunk files to this commit) |
| 1 | `2d5757c` | 1.1-1.3 | `CAUSAS_CON_REPOSO`, `admitsRest` |
| 2 | `60525e9` | 2.1-7.5 | `not_applicable` outcome end to end: types, verdict, evaluate, coordination view, loader, i18n, section |
| 3 | `7aeeef8` | 8.1-8.2 | Opt-in integration case (compile-only here) |
| 4 | `5566f90` | 10.1-10.7 | `docs/requirements.md` RN-09, RN-10 and history row; roadmap row 15; brief committed as is |

Task 0.3: no Next.js API is touched (design), so the `node_modules/next/dist/docs/` read was skipped by design.
Task 10.3: RN-15 and RF-05 (a) were read; neither says every signal must be absent, so they stay untouched.

## TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 | `src/lib/intake/causes.test.ts` | Unit | 4/4 (555 baseline in signals+intake) | 8 failed (`admitsRest` not a function) | 12/12 | 2 true + 3 false causes, subset, agreement with the constant | Clean |
| 2.1/2.2 | `src/lib/signals/verdict.test.ts` | Unit | 11/11 | 1 failed (not_applicable + all absent -> no_alerts); other rows pass on the old code by coincidence | 17/17 | 7 table rows + never-listed test | Clean |
| 3.1/3.2 | `src/lib/signals/evaluate.test.ts` | Unit | 11/11 | 9 failed | 30/30 | 3 non-rest causes, 2 rest causes, pending/failed/no row, 5-cause independence of RN-07/14/26, fixed order x5, closed-set sweep with medica and fuerza_mayor | Prettier fix |
| 4.1/4.2 | `src/lib/signals/coordination-view.test.ts` | Unit | 10/10 | 1 failed (leak test, after fixing a test-data slip); the pure projection already produced `{signal, outcome}` at runtime, the change is the type-level exhaustive switch (`tsc` RED on the old `else` literal) | 13/13 | projection, verdict parity, leaky evidence/reason | Clean |
| 5.1/5.2 | `src/lib/data/signals.test.ts` | Unit (db double) | 24/24 | 6 failed | 30/30 | null, outside-list and empty cause; fuerza_mayor vs medica on the same extraction | Clean |
| 5.x | `src/lib/data/signals-sql.test.ts` | Unit | 17/17 | 1 failed (Q1 now selects `Causa`) | 17/17 | n/a | n/a |
| 6.1/6.2 | `src/i18n/review-messages.test.ts` | Unit | 62/62 | 3 failed | 65/65 | es and en wording, same-keys, no voseo | Clean |
| 7.1/7.2 | `src/app/(dashboard)/review/[id]/signals-section.test.tsx` | Component | 38/38 | 5 failed | 43/43 | both audiences, es, no evidence even if leaked, not in the apart list, text-not-color, axe | Clean |
| 8.1 | `src/lib/data/integration/validation-signals.integration.test.ts` | Integration (opt-in) | n/a | n/a (written after the code, compile-only here) | typecheck only, not run | fuerza_mayor and medica on the same extraction | Prettier |

Test summary: tests added or extended in 9 test files (full suite 7286 passing). Pure functions created: `admitsRest` (plus the exhaustive `projectResult` switch).

## Work Unit Evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|---------------------------------|-----------------|-------------------|
| 1 | `npx vitest run src/lib/intake/causes.test.ts`: 1 file, 12/12 passed | N/A: pure function | Revert `causes.ts`, `causes.test.ts` (no importer before unit 2) |
| 2 | `npx vitest run src/lib/signals src/lib/data src/i18n "src/app/(dashboard)"`: 163 files, 4247 tests, all passed after updating `signals-sql.test.ts` | N/A: pure logic and component tests; the real-Postgres case is unit 3 | Revert the unit 2 commit; unit 1 stays harmless |
| 3 | `npx tsc --noEmit`: exit 0 (integration file is excluded from `npm test`) | `INTEGRATION_ALLOW_WRITES=1 npm run test:integration` NOT run: user-gated (tasks 9.2-9.4) | Revert the integration test file |
| 4 | `git diff` of `docs/requirements.md`, `docs/roadmap.md` holds only RN-09, RN-10, the 2026-11-11 history row and roadmap row 15 | N/A: documents only | Revert the docs commit; code untouched |

## Gates (branch head)

- `npm test` (dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`): 320 files, 7286 tests, all passed.
- `npm run typecheck`: exit 0 (also compiles `scripts/session-verify.local.ts`, unchanged).
- `npx eslint src`: 131401 problems, every one a CRLF `Delete ␍` or a prettier-on-CRLF message; no other error or warning.
- Prettier (`--end-of-line auto`) passes for every `src/` and `i18n/` file of the change.
- Size: 1020 authored lines (967 + 53) excluding `openspec/` and `.engram/`; budget 1200, forecast ~600.

## Deviations from design

None in behavior. Implementation notes:

- `addPresented` and `addExtraction` in the integration test gained optional parameters (`causa`, `{ issueDate, restTo }`) instead of a new helper; existing calls are unchanged.
- `src/lib/data/signals-sql.test.ts` needed a one-column update (Q1 now selects `Causa`); it was not listed in tasks.md.
- Evaluate closed-set sweep covers `medica` and `fuerza_mayor` (2 causes x 3276 inputs) rather than all five, to keep the suite time unchanged in kind.

## Remaining

- [ ] 9.1-9.4 Neon integration run: pending the user's explicit consent for each command.
- [ ] 11.3 `sdd-verify`.
