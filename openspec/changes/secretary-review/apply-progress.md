# Apply progress: secretary-review

## S1 Pure domain (branch `feat/secretary-review-s1-domain`)

Status: partial. Tasks 1.1-1.8 and 1.10-1.16 done; 1.9 is the owner STOP gate (open).

| Task | State | Evidence |
|---|---|---|
| 1.1 | done | branch created from the tracker |
| 1.2 | done | `transitions.ts` + test (7 tests) |
| 1.3 | done | `NonWorkingDaysProvider` in `ports.ts` |
| 1.4-1.5 | done | `business-days.ts` + test (26 tests) |
| 1.6 | done | `adapters/constant-calendar.ts` + test (4 tests) |
| 1.7-1.8 | done | `calendar.ts` (pending owner validation) + staleness test |
| 1.9 | OPEN (owner) | holiday lists await the owner's written "yes" |
| 1.10 | done | `return-reasons.ts` + test |
| 1.11-1.12 | done | `decision-templates.ts` + test (17 tests) |
| 1.13 | done | `decision-validation.ts` + test (20 tests) |
| 1.14 | done | `request-scope.ts` + test |
| 1.15 | done | `validateSubmission(..., { filingWindow: false })` + 4 tests |
| 1.16 | done | gates below |

Gates: `npx vitest run src/lib/intake` 24 files / 197 tests green; `npm test` 154 files / 3008 tests green; `tsc --noEmit` clean except stale ignored `.next/types` (pre-existing); eslint and prettier clean on all changed files (repo-wide eslint/format:check show only CRLF noise from untouched files).

Lines vs tracker: production 515, tests 662.
No database command was run.
