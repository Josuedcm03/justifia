# Apply progress: data-retention

## Unit 0: owner decisions

- 0.1 (2026-11-19): the owner chose option A. The SQL-shape cases of `src/lib/data/retention.test.ts` move to PR 2, and the generated snapshot `drizzle/meta/0014_snapshot.json` is excluded from the 1000-line count. Every checkpoint still reports the snapshot separately.
- 0.2 (2026-11-18): (a) DR-4 no longer lists "SolicitudRevision free text" (the table holds no names or free text), and the snapshot rule now reads as the redact rule (a non-NULL value becomes the placeholder, NULL stays NULL). (b) `EstudianteCarrera` is redacted, not kept as residue. Reports still read the program from the live `Usuario` row.

## Unit 0 (continued)

- 0.3 (2026-11-19): baseline confirmed. Branch "feat/data-retention" sits on origin/main bf91506 (HEAD 8544bcc is the docs commit). The local ref "main" in this repository is stale (b82b359, ten commits behind), so every diff in this change is measured against bf91506 (origin/main), not the local "main" ref. Baseline run "npm test -- src/lib/data src/db src/lib/audit src/lib/intake" with the dummy DB: 106 files, 2054 tests, all passed (57.5 s).
- 0.4 (2026-11-19): committed earlier as 8544bcc ("docs(data-retention): add the SDD planning documents").

## Unit 1: cutoff policy (DR-1, DR-3, DR-6)

Mode: Strict TDD. Layer: unit (pure functions). Safety net: N/A (new files).

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 1.1 | "npm test -- src/lib/retention": suite failed to load, "Failed to resolve import "./policy" from "src/lib/retention/policy.test.ts". Does the file exist?" (0 tests) | n/a |
| 1.2 | With a naive first version of retentionCutoff (plain year minus 5, no clamp): 10 passed, 1 failed, "retentionCutoff (DR-1) > clamps a missing Feb 29 cutoff to Feb 28 at the same time of day: expected 2027-03-01T09:00:00.000Z to deeply equal 2027-02-28T09:00:00.000Z" | n/a |
| 1.3 | n/a | clamp added: 11 of 11 passed in `src/lib/retention/policy.test.ts` |
| 1.4 | n/a | gates: focused vitest 11/11; "npm run typecheck" clean; "npx eslint src/lib/retention" clean; "npx prettier --check src/lib/retention --end-of-line auto" clean |

Triangulation: four DR-1 boundary rows, exact 5 years, 1 ms less, 1 day less, the clamp, and two rows where the cutoff date exists. Refactor: none needed (the day-exists probe is the minimum code).

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/lib/retention" with the dummy DB: 1 file, 11 tests passed |
| Runtime harness | N/A: pure functions, no runtime boundary |
| Rollback boundary | Revert `src/lib/retention/` |

Commit: "feat(retention): add the five-year cutoff policy".

## Unit 2: migration 0014 and schema (DR-2, DR-3, DR-6, D1, D3, D7, D8)

Mode: Strict TDD. Layer: unit (static migration text). Safety net: "npm test -- src/db" before touching `src/db/schema.ts`: covered by the unit 0 baseline (106 files, 2054 tests green, which includes `src/db`).

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 2.1 | "npm test -- src/db/migration-data-retention.test.ts": 9 failed of 9. "is registered once in the journal, later than the last applied migration: expected [] to have a length of 1 but got +0" and the other eight fail on "expected [] to have a length of 1 but got +0" (migration located by name, missing) | n/a |
| 2.2 | n/a | `src/db/schema.ts`: Usuario.canceladoEn, Solicitud.canceladaEn (nullable timestamptz, no default) and the CK_Usuario_Cancelado check with the sibling check pattern |
| 2.3 | n/a | "npx drizzle-kit generate --name data_retention" with the dummy DATABASE_URL (no connection): wrote `drizzle/0014_data_retention.sql`, the journal entry (idx 14, when 1795111590732, later than 1793660241921) and `drizzle/meta/0014_snapshot.json` (2342 lines, generated, untouched). Generated statements: 2 ADD COLUMN and the CHECK (drizzle emitted the check, so no hand-appended CHECK) |
| 2.4 | n/a | hand-appended: the sentinel INSERT, then per year 2031 to 2035 the partition, its truncate trigger and its REVOKE; every statement after a breakpoint marker; the partition comment is attached to the first partition statement so no breakpoint chunk is comment-only |
| 2.5 | n/a | "npm test -- src/db": 17 files, 232 tests passed (includes `src/db/schema.test.ts`; no pin needed adjusting); migration test 9 of 9 |
| 2.6 | n/a | gates: "npm run typecheck" clean after one fix (below); "npx eslint" clean (CRLF noise filtered); "npx prettier --check --end-of-line auto" clean |

Unplanned edit (deviation): the new `Usuario.CanceladoEn` column made "npm run typecheck" fail in `src/lib/data/users.ts` (4 errors, property canceladoEn missing from `UsuarioConRol` in the projections). Smallest fix: `UsuarioConRol` is now `Omit<Usuario, "rolId" | "canceladoEn">` with a comment, so no SQL projection or pinned query changed. After the fix: "npm test -- src/db src/lib/data/users": 20 files, 337 tests passed.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/db" with the dummy DB: 17 files, 232 tests passed |
| Runtime harness | Owner-run: disposable Neon branch rehearsal (tasks 6.2-6.3). Nothing was applied to any database here |
| Rollback boundary | Revert `drizzle/0014_data_retention.sql`, its journal entry and snapshot, `src/db/schema.ts`, the test and the `UsuarioConRol` type edit |

Commit: "feat(db): add retention markers, system account and 2031-2035 audit partitions".

## Unit 3: audit event "usuario.cancelado" (audit-log "Closed set of retention events", DR-6)

Mode: Strict TDD. Layer: unit (pure builder). Safety net: "npm test -- src/lib/audit": 3 files, 119 tests passed before the edits (the 123 after the new cases is 119 plus 4 new or changed).

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 3.1 | "npm test -- src/lib/audit": `src/lib/audit/types.test.ts` "AUDIT_ACTIONS > keeps the existing codes unchanged and adds exactly the ... and one retention one: expected [ 'asignatura.actualizada', ...(42) ] to deeply equal [ 'asignatura.actualizada', ...(43) ]" | `src/lib/audit/types.ts`: the action, the payload type and the union member (entity "Usuario"); list test green |
| 3.2 | same run, three failures in `src/lib/audit/events.test.ts` "account cancelled event": "TypeError: accountCancelledEvent is not a function" (maps to usuario.cancelado on the student; carries exactly the closed code and the two counts; drops a name, email, CIF, free text or request ids smuggled into the call). Total 4 failed, 119 passed | n/a |
| 3.3 | n/a | `src/lib/audit/events.ts`: accountCancelledEvent copies the three fields by name and takes the code from RETENTION_REASON. "npm test -- src/lib/audit": 3 files, 123 tests passed |
| 3.4 | n/a (comment only) | `src/lib/data/audit.ts` doc comment of insertAuditEvents: "or the system account, retention only"; no signature change |
| 3.5 | n/a | gates: "npm test -- src/lib/audit src/lib/data/audit.test.ts": 4 files, 130 tests passed; "npm run typecheck" clean; "npx eslint" clean (CRLF noise filtered); "npx prettier --check --end-of-line auto" clean |

Triangulation: the payload is asserted for two different students and counts (2 and 3, then 0 and 0), plus a smuggling case with six extra fields. Refactor: none needed.

Deviation (type fallout): a second audit event on entity type "Usuario" stopped `entidadTipo !== "Usuario"` from narrowing the payload, so "npm run typecheck" reported 8 errors in `src/lib/audit/events.test.ts` (campos and importacionSha256 missing on the union). The four existing narrowing guards now test `accion` ("usuario.creado" or "usuario.actualizado") instead of `entidadTipo`. Test-only edit, no assertion changed.

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/lib/audit" with the dummy DB: 3 files, 123 tests passed |
| Runtime harness | N/A: pure builder tests, no runtime boundary |
| Rollback boundary | Revert the two audit files, their tests and the comment in `src/lib/data/audit.ts` |

Commit: "feat(audit): add the usuario.cancelado event".

### Interim checkpoint 3.6 (after unit 3)

"git diff --numstat bf91506...HEAD" (bf91506 is origin/main; the local "main" ref is stale) excluding "openspec/", ".engram/" and `drizzle/meta/0014_snapshot.json`:

| File | Added | Deleted |
|------|-------|---------|
| `drizzle/0014_data_retention.sql` | 56 | 0 |
| `drizzle/meta/_journal.json` | 7 | 0 |
| `src/db/migration-data-retention.test.ts` | 171 | 0 |
| `src/db/schema.ts` | 11 | 0 |
| `src/lib/audit/events.test.ts` | 64 | 5 |
| `src/lib/audit/events.ts` | 22 | 0 |
| `src/lib/audit/types.test.ts` | 2 | 1 |
| `src/lib/audit/types.ts` | 18 | 0 |
| `src/lib/data/audit.ts` | 4 | 3 |
| `src/lib/data/users.ts` | 6 | 2 |
| `src/lib/retention/policy.test.ts` | 83 | 0 |
| `src/lib/retention/policy.ts` | 34 | 0 |
| Total | 478 | 11 |

Cumulative: 489 changed lines. Snapshot reported separately: `drizzle/meta/0014_snapshot.json` 2342 lines. The threshold of 520 is not exceeded (31 lines of margin), so apply continues with unit 4. Unit 4 plus unit 5 project at ~474 (file lines only: retention.ts ~210, retention.test.ts ~165 raw plus carve-outs ~30 raw plus RN-27 ~10), giving ~960 against the 1000 budget.
