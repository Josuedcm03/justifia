# Apply Progress: request-consent

Mode: Strict TDD (vitest). Store: hybrid. Delivery: auto-chain, feature-branch-chain, review budget 800.

## S1 data and rules (phases 1-3), branch `feat/request-consent-s1-data-rules`

Status: tasks 1.1-3.2 complete; 3.3 (push + PR) NOT done because the measured authored diff is 916 lines, above the 800 stop rule. 3.4 is out of this work unit.

| Commit | Unit | Authored lines (+/-) |
|--------|------|----------------------|
| `029e123` | 1 schema, migration 0010 (generated, not applied), consent module and text pin | 315 / 0 |
| `72c1845` | 2 validation, correction opt-out, action payload, persistence, audit | 560 / 41 |

Authored total vs tracker (generated SQL, `drizzle/meta/*` and `openspec/` excluded): 875 added + 41 deleted = 916. Production code is 149 of those; the rest is tests.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.3 | `src/lib/intake/consent.test.ts` | Unit | N/A (new) | module missing, suite did not load | 9/9 | text pin plus a "text edited, version kept" case | none needed |
| 1.4/1.5/1.6 | `src/db/migration-request-consent.test.ts` | Schema (SQL by name) | N/A (new) | 7 failed / 10 passed (SQL missing; pure case-table passed) | 17/17 after generate | 10 constraint cases | prettier only |
| 2.1/2.2 | `src/lib/intake/submission.test.ts` | Unit | 21/21 | 10 failed | 31/31 | absent, null, empty, non-string, outdated, opt-out, ordering | none needed |
| 2.3/2.4 | `src/lib/data/solicitud-correction.test.ts` | Unit (db double) | 22 tests, 19 red once consent became fail-closed by default | 23 failed / 4 passed | 27/27 | legacy NULL, forged key, set-keys pin, spy on options | none needed |
| 2.5/2.6 | `src/lib/audit/events.test.ts` | Unit | 85/85 across `src/lib/audit` | 4 failed | 85/85 | two versions, key set, corregida untouched | none needed |
| 2.7/2.8 | `src/lib/data/solicitudes.test.ts` | Unit (db double) | 36/36 | 4 failed | 40/40 | same instant, handed version, conflict, drift | none needed |
| 2.9/2.10 | `src/app/(dashboard)/requests/new/actions.test.ts` | Unit (hoisted mocks) | 46/46 | 15 failed | 58/58 | 11 payload shapes, 2 outdated, beside documents error | none needed |
| 2.11 | `src/i18n/intake-messages.test.ts` | Unit | 7/7 | 6 failed | 13/13 | es and en, required and outdated | none needed |
| 2.12 | typecheck | Type | N/A | `tsc` error TS2322 in `submit-dialog.tsx` | `tsc` clean | N/A (structural) | none needed |

Totals: tests written or changed in this unit about 100 new test cases; full suite 231 files, 5022 tests passing.

### Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and result | `npx vitest run src/db src/lib src/app src/i18n`: 201 files, 4573 tests passed. `npm test`: 231 files, 5022 passed |
| Runtime harness | N/A: DB double and SQL read by test; no database targeted. Opt-in `npm run test:integration` not run (needs a disposable Neon branch, ASK OWNER); the integration test was updated for the new `SubmitInput` and asserts `ConsentimientoEn = PresentadaEn` |
| Rollback boundary | Unit 1: `schema.ts`, `drizzle/0010*`, `drizzle/meta/*`, `consent.ts`, label key. Unit 2: `submission.ts`, `solicitud-correction.ts`, `solicitudes.ts`, `actions.ts`, `validations/solicitud.ts`, audit files, `submit-dialog.tsx` wrapper, error keys |

### Gates (dummy `DATABASE_URL=postgres://u:p@127.0.0.1:9/x`)

- `npm test`: 231 files, 5022 tests passed.
- `npm run typecheck`: clean.
- `npx eslint src`: 502 files; 89426 messages, all the repository's CRLF `Delete ␍` noise; 0 other findings.
- `prettier --check --end-of-line auto src i18n` and every changed file: clean (repository-wide the check already warns on 106 untouched files: `openspec/`, `scripts/`).
- `npm run build`: succeeded.
- No database command run: no `migrate`, `push`, `db:seed`, `neon`, no SQL.

### Deviations and notes

- None from the design. `submissionErrors` already maps any code to `intake.errors.<code>`, so no change was needed there.
- Size: forecast ~330, measured 916. Cause: the strict-TDD tables (10-case constraint table, 11 payload shapes, spy and forged-key cases) in 8 test files. Cannot shrink without removing coverage. Natural split: unit 1 alone is 315 lines, unit 2 alone is 601 (both inside 800).
