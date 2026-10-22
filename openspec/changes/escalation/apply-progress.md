# Apply progress: Escalation

Mode: Strict TDD (vitest). Artifact store: hybrid. Delivery: auto-chain, `feature-branch-chain`, review budget 1000 authored lines.

## Batch S1: Phases 1, 2 and 3 (2026-10-22)

Branches (all pushed): `feat/escalation-s1a-schema` (Phase 1, `e4ef559`), `feat/escalation-s1b-writes` (Phase 2, `28ca0f9`, stacked on S1a), `feat/escalation-s1-data-rules` (both units, the full S1 head). Cut from the tracker `feat/escalation` at `b4f7892`. No PR opened: blocked on owner task 0.1 (migration merge order with `document-extraction`).

### Completed tasks

- Phase 1: 1.1 to 1.13 (schema, generated migration `0011_escalation`, transitions, business-day and clock rules).
- Phase 2: 2.1 to 2.12 (validators, audit builders, escalate and report writes, resubmit reset, append-only pin).
- Phase 3: 3.1 (gates), 3.2 (measure and split).
- Open: 3.3 (re-check again right before the PR), 3.4, 3.5 (PR; blocked on 0.1).

### TDD cycle evidence

| Task | Test file | Layer | Safety net (unaffected at RED) | RED | GREEN | Triangulate | Refactor |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.3 | `src/lib/intake/transitions.test.ts` | Unit | 5 pre-existing assertions stayed green in the RED run | 11 failed / 5 passed | 16 passed (+`solicitud-decision.test.ts` 55/55) | edges per actor, `sourceOf` none/many/one, every `DECISION_KINDS` | prettier only |
| 1.4/1.5 | `src/lib/intake/business-days.test.ts` | Unit | 26 pre-existing tests green in the RED run | 17 failed / 26 passed | 43 passed | six count rows, holiday, same-day, reverse range; add rows, zero, holiday | none needed |
| 1.6/1.7 | `src/lib/intake/deadline-clock.test.ts` | Unit | N/A (new) | file failed to load (module absent) | 13 passed (one test fixture bug fixed before green) | spec table 3 rows, holiday, two pauses, Managua vs UTC | none needed |
| 1.8-1.12 | `src/db/migration-escalation.test.ts` | Schema (file read) | the other `src/db` files: 154 green | 26 failed / 26 | 26 passed after `db:generate` (`src/db` 14 files / 180 passed) | columns, 12 CHECK bodies, FKs, indexes, only-DROP | none needed |
| 2.1/2.2 | `src/lib/intake/escalation.test.ts` | Unit | N/A (new file) | 35 failed / 1 passed | 36 passed | bounds 0/1/1000/1001, reasons, date today/yesterday/tomorrow/Feb 30, Managua evening | prettier only |
| 2.3/2.4 | `src/lib/audit/events.test.ts`, `types.test.ts` | Unit | `diff.test.ts` and 12 other tests green in the RED run | events file failed to load, types 1 failed | `src/lib/audit` 3 files / 92 passed | three builders, leak test with smuggled text, existing payloads | none needed |
| 2.5-2.7 | `src/lib/data/solicitud-escalation.test.ts` | Data (db double) | N/A (new) | file failed to load | 29 passed (24 report tests still red) | count (0/1/2, null career), 5 non-pendiente states, unique violation x2, rollback x3 | prettier only |
| 2.8/2.9 | same file | Data (db double) | 29 green | 24 failed (`recordExcessReport` not a function) | 53 passed | 5 non-aprobada states, foreign teacher, date/note, two reports, three rollbacks | none needed |
| 2.10 | `src/lib/data/solicitud-correction.test.ts` | Data (db double) | 24 pre-existing tests green in the RED run | 4 failed / 24 passed | 28 passed | `set` shape asserted in three places plus a named test | comment re-wrapped |
| 2.11 | `src/lib/data/append-only.test.ts` | Structural | 8 pre-existing tests green in the RED run | 1 failed / 8 | 11 passed | detection x3 tables, writer scanned | none needed |

Safety net note: the pre-existing test files were not run as a separate baseline before editing; the tests that stayed green in each RED run are the evidence that the unmodified behavior held.

Test summary: 4 new test files (`deadline-clock`, `migration-escalation`, `escalation`, `solicitud-escalation`) and 6 extended (`transitions`, `business-days`, audit `events` and `types`, `solicitud-correction`, `append-only`); `npm test` at the S1 head is 240 files / 5282 tests green. Layers: Unit (pure), Data (scripted db double), Schema (generated SQL read), Structural. No approval tests (no refactor tasks). Pure functions added: `sourceOf`, `countBusinessDays`, `addBusinessDays`, `clockStartOf`, `pausedStartOnAnswer`, `effectiveClockStart`, three validators.

### Work unit evidence

| Evidence | Unit 1 (S1a) | Unit 2 (S1b) |
|---|---|---|
| Focused test command and result | `npx vitest run src/db src/lib` at `e4ef559`: 118 files, 2432 passed | `npx vitest run src/lib/intake src/lib/audit src/lib/data` at `28ca0f9`: 69 files, 1297 passed |
| Runtime harness | N/A: SQL read by test, never applied; real Postgres is unit 10 and phase 14 | N/A: scripted db double; the race and lock are covered by unit 10 |
| Rollback boundary | `schema.ts`, `src/db/clock-start.ts`, `drizzle/0011_escalation.sql`, `drizzle/meta/`, intake rule files | `solicitud-escalation.ts`, `solicitud-correction.ts` reset, audit files, `intake/escalation.ts` validators |

### Gates (combined S1 head)

- `npm test` (dummy `DATABASE_URL`): 240 files, 5282 passed.
- `npm run typecheck`: clean.
- `npx eslint src`: 0 problems other than the CRLF `Delete ␍` noise.
- Prettier (`--end-of-line auto`) on every changed source file: clean.
- `npm run build` (dummy `DATABASE_URL`): ok.
- No `drizzle-kit migrate`/`push`, `db:seed` or SQL write run; `db:generate` ran with a dummy URL (it never connects).

### Measured authored lines vs the tracker

Excluding `openspec/`, `.engram/`, `package-lock.json`, generated SQL and `drizzle/meta/*`:

| Slice | Added | Deleted | Total |
|---|---:|---:|---:|
| S1 combined | 2545 | 25 | 2570 |
| S1a (Phase 1) | 907 | 14 | 921 |
| S1b (Phase 2, vs S1a) | 1642 | 15 | 1657 |

S1b exceeds 1000 after the one allowed split: `size:exception` recommended. It holds the 316-line data module and its 700-line test (every state in the spec tables is a row), so it cannot shrink without dropping tests. If the owner prefers smaller PRs, the next honest cut is inside S1b: validators + audit + resubmit reset + append-only (about 700) and the two data writes (about 1000).

### Deviations from design

1. `src/lib/intake/escalation.ts` is created in unit 1 with the constants only (the schema renders its CHECK lists from them, as `remission/states.ts` does); unit 2 adds the validators (task 2.2 said the file is created there).
2. `countCoordinationAccounts(q, solicitudId)` runs two selects (the student's live career, then the count) and returns `{ carreraNombre, cuentas } | null`; a single joined statement cannot be pinned by the db double.
3. `EscalationField`/`EscalationErrorCode` gain `docente`/`docente_invalid` for the "teacher outside the remissions" refusal.
4. `CK_Escalamiento_MotivoEstado` states `bloqueada` as `NotificacionMotivo IS NOT NULL AND = 'sin_destinatarios'`: a bare equality would let a NULL motive pass the CHECK. A named `CK_Escalamiento_NotificacionEstado` also exists (design listed the outbox CHECKs as "mirroring Remision").
5. `CreadoEn` defaults to `now()` (the writes pass the injected `now` explicitly).
6. The pre-commit hook added `.engram/` sync files to commit `e4ef559` (excluded from the budget).

### Issues and notes

- Two `package-lock.json` changes pre-existed and stay unstaged.
- No Next.js API is used in S1 (no pages, actions or routes), so the Next 16 docs were not needed yet.
- Migration number `0011` is whatever `drizzle-kit` produced; if `document-extraction` merges a `0011` first, regenerate (task 3.3).

### UX observations (for owner decision)

- The report date accepts any past date with no lower bound (spec); a typo such as a wrong year is stored. A soft warning in the S2 dialog for a date before the approval would catch it.

### Remaining tasks

- [ ] 3.3 re-check `drizzle/` on `main` right before the PR
- [ ] 3.4 open the S1a PR (tracker base), then S1b (S1a base until it merges), with `size:exception` noted for S1b
- [ ] 3.5 merge into the tracker after review
- Not started by instruction: Phase 4 onward, S2.

### Status

27 of the 30 S1 tasks (1.1-1.13, 2.1-2.12, 3.1, 3.2) complete; 3.3 to 3.5 wait on owner task 0.1. Ready for sdd-verify of the S1 code, then PRs once 0.1 is closed.
