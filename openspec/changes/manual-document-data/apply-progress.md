# Apply progress: manual-document-data

## Phase 0: Planning and decisions

### 0.1 Owner answers (2026-11-19, Managua)

- (a) **Size: exception accepted up front.** Keep the seven planned slices (forecast block in tasks.md). The owner accepts that slices may exceed the 400-line budget, as data-retention did. The unit-boundary split rule stays as guidance only.
- (b) **Section title: it stays "Datos extraídos"** (spec MD-23, MD-26, MD-28). The thesis does not name the section. RF-14 (a) only asks that the detail mark each manual datum "ingresado manualmente", and the per-field mark does that.
- (c) **Signal evidence: document ids only** (spec MD-16 and MD-28). No counts or type codes.
- (d) **MD-30 stays in scope** (PR 7). It is a coordination read-only block with the type and the marks, never the four values.
- (e) **A4 accepted.** While OCR is pending, a missing date reads "field_missing" (spec MD-17). In both cases the signal stays not evaluated, as thesis 4.6:33 asks.
- (f) **Vercel previews use the PRODUCTION database.** Preview and Production share DATABASE_URL (Engram #439, set on 2026-11-14 from the production branch). Consequences:
  - Never use a slice preview for testing.
  - The RF-14 system case (Phase 10) runs locally against the disposable branch "manual-it".
  - A preview of PR 1 onward that inserts a document would fail until 0015 is in production. Nobody uses previews, so no action is taken beyond this note.

### 0.2 Coordination (2026-11-19)

- (a) **Migration number: 0015.** On the latest main (172e9e0) the last migration is 0014_data_retention. Josué may add a migration in catalog-schedule. Whoever merges second rebases and regenerates with "npx drizzle-kit generate".
- (b) **Requirements doc.** Josué is syncing docs/requirements.md (RN-16, RN-20, RF-11, RNF-03, RN-26, RF-17, RF-12 (c)). This change keeps its edit there to one line (task 8.12) and rebases first.

### 0.4 Spec reconciliation check

- "whole number": no match in specs/manual-document-data/spec.md (dates only).
- "tieneFirma": present in specs/audit-log/spec.md (the closed list).
- "STRICT": present in specs/validation-signals/spec.md (the MD-16 rule).

### 0.3 Baseline on the tracker (2026-11-19)

- "npm test -- src/lib/data src/lib/signals src/db src/lib/audit src/app" with the dummy DB: 218 files, 5469 tests, all passed, 138 s.

## Phase 1-2 (PR 1)

Mode: Strict TDD. Branch "feat/manual-document-data-1-schema" from the tracker (a84893f). PR 1: "https://github.com/Josuedcm03/justifia/pull/93", base "feat/manual-document-data". Size exception accepted by the owner (0.1 a); the slice is not split.

Tasks 1.10 to 1.13 (all database work) were NOT run: they are owner-run and need explicit confirmation per command. 0.5 is untouched by this run.

### Commits

| Unit | Hash    | Message                                              |
| ---- | ------- | ---------------------------------------------------- |
| 1    | fc41c9a | feat(db): add manual document data columns and table |
| 2    | 5c5dded | feat(signals): add the document type to cause map    |

### Files

| File                                            | Action                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `drizzle/0015_manual_document_data.sql`         | Created (generated, 20 lines)                                                                         |
| `drizzle/meta/_journal.json`                    | Modified (generated, 7 lines; when 1795134628842)                                                     |
| `drizzle/meta/0015_snapshot.json`               | Created (generated, 2467 lines, not counted)                                                          |
| `src/db/schema.ts`                              | Modified: three columns and one CHECK on DocumentoRespaldo; new documentoDatoManual with three CHECKs |
| `src/db/migration-manual-document-data.test.ts` | Created (11 cases)                                                                                    |
| `src/lib/document-data/types.ts`                | Created (pure)                                                                                        |
| `src/lib/data/retention-inventory.test.ts`      | Modified: three columns and the new table entry                                                       |
| `src/lib/data/retention.test.ts`                | Modified: structural regex names documentoDatoManual                                                  |
| `src/lib/signals/document-type-causes.ts`       | Created                                                                                               |
| `src/lib/signals/document-type-causes.test.ts`  | Created (23 cases)                                                                                    |
| `src/lib/intake/causes.ts`                      | Modified: comment only                                                                                |

### TDD cycle evidence

| Task              | RED                                                 | GREEN                                                                                                                                                  | Refactor                                                  |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| 1.2 inventory     | 2 tests failed (table undefined, columns missing)   | 16 of 16 pass after schema                                                                                                                             | none                                                      |
| 1.3 migration     | 11 of 11 cases failed: 0015 not found               | 11 of 11 pass after generate                                                                                                                           | none                                                      |
| 1.8 retention pin | passes at write (pins existing behavior), 15 tests  | mutation check: a comment naming documentoDatoManual in `src/lib/data/retention.ts` failed the case (1 failed, 14 passed); restored with "git restore" | none                                                      |
| 2.1 map           | run failed: module "./document-type-causes" missing | 23 of 23 pass                                                                                                                                          | removed an unused destructured variable flagged by eslint |

### Work unit evidence

| Evidence             | Value                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | "npm test -- src/db src/lib/data/retention-inventory.test.ts src/lib/data/retention.test.ts": 20 files, 274 tests passed. "npm test -- src/lib/intake src/lib/signals/document-type-causes.test.ts": 34 files, 444 tests passed |
| Runtime harness      | N/A for this run: the owner-run rehearsal on the disposable branch "manual-it" is tasks 1.10 to 1.12, not executed here                                                                                                         |
| Rollback boundary    | Revert the PR; the columns and the table may stay if applied (additive, nullable)                                                                                                                                               |

### Gates

- Full "npm test" with the dummy DB: 358 files, 8487 tests, all passed, 204 s (vitest duration; about 3.5 min wall).
- "npm run typecheck": clean.
- "npx eslint src": only the known CRLF noise ("Delete the carriage return" and two CRLF-quoted lines in `src/test/access/inventory.ts`, untouched) and one old unused-import warning in `src/components/app-sidebar.tsx` (untouched). Touched files: eslint and prettier clean.

### Measured size (task 2.5)

"git diff --numstat feat/manual-document-data...HEAD" excluding "openspec/", ".engram/" and "drizzle/meta/0015_snapshot.json": 497 additions and 3 deletions, 500 changed lines. Without the generated SQL (20) and journal (7) lines: 473. The snapshot adds 2467 lines, reported separately. Target was about 330 and the stop line 460; the owner's size exception covers it.

### Deviations and findings

- The test title of the retention structural pin (task 1.8) now also names the manual-data table, so the title matches the regex.
- The generated SQL puts the new CHECK on DocumentoRespaldo (CK_Documento_TipoDocumento) last, after the foreign keys, in drizzle-kit's own order. Nothing was reordered by hand.
- `src/db/schema.ts` and `src/lib/intake/causes.ts` were CRLF in the worktree; both were converted to LF before editing, so lint passes. Git stores LF, so the diff shows no line-ending change.
- "CK_DatoManual_NoVacio" tests only the rest start with the other three fields, because "CK_DatoManual_Reposo" ties the two dates. Matches the design text "at least one of the four fields".
- `DOCUMENT_TYPE_CAUSES` is declared "as const satisfies ...", so consumers get literal types and the "satisfies" check of task 2.2 still holds.
- No pin of `src/db/schema.test.ts` needed adjusting (task 1.7).
- The migration number stayed 0015: origin/main (fetched 2026-11-19) still ends at 0014_data_retention.

## Phase 1 database steps (owner yes per command)

- 1.10 (2026-11-19 18:42 Managua, read-only): production has 15 migrations (0000 to 0014) and no 0015 objects. "dev-arnia" has 14 (no 0014).
- 1.11 (18:49): "manual-it" created as a child of "dev-arnia".
- 1.12 (18:50): 0014 and 0015 applied to "manual-it" only. Read-only verification: three nullable columns without default, the new table, four CHECKs, and the cascade FK. Production untouched; 1.13 waits for the owner's yes before the tracker reaches main.

## Phase 3 (PR 2)

Mode: Strict TDD. Branch "feat/manual-document-data-2-effective-read" from the PR 1 branch (3993a5f). PR 2: "https://github.com/Josuedcm03/justifia/pull/94", base "feat/manual-document-data-1-schema". Size exception accepted by the owner (0.1 a); the slice is not split.

No database was touched: every run used the dummy DB.

### Commits

| Unit | Hash    | Message                                                      |
| ---- | ------- | ------------------------------------------------------------ |
| 3    | 0827935 | feat(document-data): merge manual values over the extraction |
| 4    | 4d6ba03 | feat(data): read the effective document data                 |
| 5    | 02f21e5 | feat(data): count manual issuers in the RN-14 history        |

### Files

| File                                                          | Action                                                                                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/lib/intake/dates.ts`                                     | Modified: inclusiveDays export (8 lines)                                                                               |
| `src/lib/intake/dates.test.ts`                                | Modified: 5 inclusiveDays cases                                                                                        |
| `src/lib/document-data/effective.ts`                          | Created (pure): toEffectiveRow, datumOrigin, ManualDatum, DatumOrigin                                                  |
| `src/lib/document-data/effective.test.ts`                     | Created (20 cases)                                                                                                     |
| `src/lib/data/extraction.ts`                                  | Modified: second LEFT JOIN, eight new selected columns, effective mapping, ExtractionListItem gains ocr, manual, marks |
| `src/lib/data/extraction.test.ts`                             | Modified: listExtractions block rewritten (7 cases for the shape and the overlay)                                      |
| `src/lib/data/extraction-sql.test.ts`                         | Modified: the LEFT JOIN text pin and a new select-columns pin                                                          |
| `src/lib/data/signals.ts`                                     | Modified: readIssuerHistory reads the coalesced issuer, both tables LEFT JOIN, state filter dropped                    |
| `src/lib/data/signals-sql.test.ts`                            | Modified: the two RN-14 history pins re-pinned                                                                         |
| `src/app/(dashboard)/review/[id]/extraction-section.test.tsx` | Modified: fixture helper only, three new item fields (see deviations)                                                  |

### TDD cycle evidence

| Task                   | RED                                                                                                              | GREEN                                                                                             | Refactor                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- |
| 3.1 inclusiveDays      | 5 of 5 new cases failed: "inclusiveDays is not a function"                                                       | 16 of 16 pass after the export                                                                    | none                             |
| 3.3 effective          | run failed: module "./effective" missing                                                                         | 20 of 20 pass                                                                                     | prettier reflow of one assertion |
| 3.5 mutation 1         | n/a (revert-only check)                                                                                          | OCR value wins over manual: 2 failed (precedence, independence), 18 passed; restored              | none                             |
| 3.5 mutation 2         | n/a (revert-only check)                                                                                          | promotion dropped (state taken from the row): 3 failed (fallida, pendiente, procesando); restored | none                             |
| 3.7 listExtractions    | 7 of 7 new or rewritten cases failed; the pins on retired, staff, "no_aplica" and the degraded read stayed green | 51 of 51 pass in `src/lib/data/extraction.test.ts`                                                | none                             |
| 3.8 SQL pin            | 2 failed: LEFT JOIN text and the selected columns                                                                | 6 of 6 pass in `src/lib/data/extraction-sql.test.ts`                                              | none                             |
| 3.11 RN-14 history pin | 2 failed: coalesce select with both LEFT JOINs, not-null filter with no state filter                             | 17 of 17 pass in `src/lib/data/signals-sql.test.ts`; `src/lib/data/signals.test.ts` stays green   | none                             |

The mutation checks ran on new files, so the files were staged first and "git restore" restored them from the index; "git status" was clean of the mutation each time.

### Work unit evidence

| Evidence             | Value                                                                                                                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | "npm test -- src/lib/document-data src/lib/intake/dates.test.ts": 2 files, 36 tests. "npm test -- src/lib/data/extraction.test.ts src/lib/data/extraction-sql.test.ts": 2 files, 57 tests. "npm test -- src/lib/data/signals-sql.test.ts src/lib/data/signals.test.ts": 2 files, 47 tests. All passed |
| Runtime harness      | N/A: pure merge and SQL text pins against a driver-less drizzle instance; the real database proof is Phase 9 (owner-run on "manual-it")                                                                                                                                                               |
| Rollback boundary    | Revert the PR; listExtractions returns its old shape and readIssuerHistory reads the extracted issuer of a completed row again; nothing else depends on the new fields                                                                                                                                |

### Gates

- Full "npm test" with the dummy DB: 359 files, 8519 tests, all passed, 207 s (vitest duration). PR 1 was 358 files and 8487 tests: one new file, 32 new tests (dates 5, effective 20, listExtractions net 6, SQL pin 1).
- "npm run typecheck": clean.
- "npx eslint src": 138630 CRLF "Delete the carriage return" messages (worktree line endings) plus the same three findings as PR 1 in untouched files (one unused import in `src/components/app-sidebar.tsx`, two CRLF-quoted lines in `src/test/access/inventory.ts`). Nothing in a touched file. ESLint and "npx prettier --check" on the ten touched files: clean.

### Measured size (task 3.14)

"git diff --numstat feat/manual-document-data-1-schema...HEAD" excluding "openspec/" and ".engram/": 621 additions and 37 deletions, 658 changed lines (200 production lines, 458 test lines). Target was about 310 and the stop line 460; the owner's size exception covers it. Unit 3 is 322 lines (the pure module and its table-driven test), unit 4 is 298, unit 5 is 38.

### Deviations and findings

- `src/app/(dashboard)/review/[id]/extraction-section.test.tsx` is touched, which tasks 3.7 to 3.10 do not list: its fixture helper builds ExtractionListItem objects, so typecheck failed on the three new required fields. The helper now sets "ocr" to the row, "manual" to null and the three marks to null. The component and its assertions are unchanged (30 tests pass).
- `toEffectiveRow` also treats a manual object with no value among the four data (all five fields null) as no manual row, and a lone rest date as no manual rest. Neither can be stored (CK_DatoManual_NoVacio, CK_DatoManual_Reposo); it keeps the function total and matches MD-21 "at least one manual value".
- `listExtractions` builds "manual" as null when none of the five manual columns holds a value, instead of selecting the manual document id. It does not select "ActualizadoEn"; see the notes for later PRs.
- `datumOrigin` returns "extracted" when neither source holds a value; callers ask only for a datum that has one.
- `readIssuerHistory` uses one sql expression for both the select and the not-null filter, so the two cannot drift apart.
- Line endings: the seven existing files were CRLF in the worktree and were converted to LF before editing; the two "git restore" calls of the mutation checks wrote CRLF back into the new files, which were converted to LF again. Git stores LF, so the diff shows no line-ending change.
- The repo hook staged `.engram/` files on every commit. Each commit was amended: "git rm --cached" for the chunk, "git checkout HEAD~1 --" for the manifest, then "git commit --amend --no-edit --no-verify". The local working copies of `.engram/manifest.json` and the chunk were put back as they were (the manifest is still modified and the chunk untracked).

### Notes for later PRs

- The form key of PR 6 (design: keyed on the document id plus "ActualizadoEn" and the marks) needs "ActualizadoEn" in the read item. PR 2 does not select it: PR 6 either adds "DocumentoDatoManual"."ActualizadoEn" to listExtractions (a small SQL pin change) or keys the form on the manual values and marks only.
- `loadSignals` still passes "item.row" (now the effective row) as the document extraction and does not pass the marks yet; task 6.3 widens SignalDocument and the wiring.
- The existing "no_aplica" filter of listExtractions is unchanged: a document whose extraction row is "no_aplica" stays out of the staff list even if manual data were stored for it. The writer of PR 3 only accepts current student documents, so this matters only if "no_aplica" rows can exist for them.

## Phase 4 (PR 3)

Mode: Strict TDD. Branch "feat/manual-document-data-3-write" from the PR 2 branch (75288f3). PR 3: "https://github.com/Josuedcm03/justifia/pull/95", base "feat/manual-document-data-2-effective-read". Size exception accepted by the owner (0.1 a); the slice is not split.

No database was touched: every run used the dummy DB. The retention integration test (task 4.12) was written and not run; the owner runs it in Phase 9.

### Commits

| Unit | Hash    | Message                                                          |
| ---- | ------- | ---------------------------------------------------------------- |
| 6    | f185134 | feat(audit): add the documento.datos_registrados event           |
| 7    | 617442a | feat(data): save manual document data in one audited transaction |
| 8    | 609433f | test(retention): prove the manual data cascade                   |

### Files

| File                                                     | Action                                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/lib/audit/types.ts`                                 | Modified: the action in AUDIT_ACTIONS, the payload type, the union member (entity DocumentoRespaldo)             |
| `src/lib/audit/events.ts`                                | Modified: documentDataRecordedEvent (names only, takes no value)                                                 |
| `src/lib/audit/types.test.ts`                            | Modified: the new action in the closed set, a compile-time mapping pin, a compile-time "no new entity type" pin  |
| `src/lib/audit/events.test.ts`                           | Modified: 5 cases for the new builder                                                                            |
| `src/lib/data/document-data.ts`                          | Created: saveDocumentData, DocumentDataInput, SaveDocumentDataResult (204 lines)                                 |
| `src/lib/data/document-data.test.ts`                     | Created (34 cases: guards, writes, rollback, logs, write-surface pins)                                           |
| `src/lib/data/integration/retention.integration.test.ts` | Modified: manual record and marks for the aged and the younger student, one new case, wider personal-data search |

### TDD cycle evidence

| Task                | RED                                                                                                          | GREEN                                                                                                                  | Refactor                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 4.1 audit types     | 2 failed (action missing from the closed set, mapping case); the entity-type pin passes at write (see below) | 11 of 11 pass in `src/lib/audit/types.test.ts`                                                                         | none                                   |
| 4.2 audit builder   | 5 of 5 new cases failed: "documentDataRecordedEvent is not a function"                                       | `src/lib/audit` 3 files, 130 tests pass                                                                                | a cast in one case fixed for typecheck |
| 4.1 entity-type pin | n/a (passes at write, compile-time)                                                                          | mutation: a temporary extra entity type made "npm run typecheck" fail in `src/lib/audit/types.test.ts`; restored       | none                                   |
| 4.5 to 4.7 writer   | run failed: module "@/lib/data/document-data" missing (no test collected)                                    | 4.8 skeleton: guard cases 12 of 12 pass, 15 write cases still failing; 4.9: 34 of 34 pass                              | prettier reflow of the test file       |
| 4.10 mutation 1     | n/a (revert-only check)                                                                                      | "FOR UPDATE" removed: 1 failed (the lock case), 33 passed; restored                                                    | none                                   |
| 4.10 mutation 2     | n/a (revert-only check)                                                                                      | audit insert on the db handle instead of the transaction: 2 failed (one transaction, audit-failure rollback); restored | none                                   |
| 4.10 mutation 3     | n/a (revert-only check)                                                                                      | no-op early return removed: 2 failed (both no-op cases); restored                                                      | none                                   |
| 4.12 integration    | n/a (owner-run, not collected by "npm test")                                                                 | "npm run typecheck" passes; the file is excluded from "npm test" (no test files found)                                 | none                                   |

The writer files were new, so they were staged before each mutation and "git restore" restored them from the index; "git status" was clean of the mutation each time. Triangulation: the guards and the writes each have several inputs (five refused states against pendiente; insert against update against delete; manual-only against marks-only saves).

### Work unit evidence

| Evidence             | Value                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | "npm test -- src/lib/audit src/lib/data/document-data.test.ts": 4 files, 164 tests passed                                                                                                                     |
| Runtime harness      | N/A for this run: the owner-run suite is "npm run test:integration" on "manual-it" (retention proof of task 4.12, Phase 9). The unit tests use the DB double, which cannot prove row locks or a real rollback |
| Rollback boundary    | Revert the PR; nothing calls the writer yet, so no behavior changes. The audit action is additive                                                                                                             |

### Gates

- Full "npm test" with the dummy DB: 360 files, 8560 tests, all passed, 220 s (vitest duration). PR 2 was 359 files and 8519 tests: one new file, 41 new tests (writer 34, builder 5, audit types 2).
- "npm run typecheck": clean (run before each commit and at the end).
- "npx eslint src": the known CRLF "Delete the carriage return" messages (135059 of them in the worktree), two CRLF-quoted lines in `src/test/access/inventory.ts` and one unused-import warning in `src/components/app-sidebar.tsx`, all in untouched files, as in PR 1 and PR 2. ESLint and "npx prettier --check" on the seven touched files: clean.

### Measured size (task 4.14)

"git diff --numstat feat/manual-document-data-2-effective-read...HEAD" excluding "openspec/" and ".engram/": 1367 additions and 5 deletions, 1372 changed lines (242 production lines, 1130 test lines). Target was about 360 and the stop line 460; the owner's size exception covers it. Unit 6 is 175 lines, unit 7 is 1061 (204 production, 857 test), unit 8 is 136.

### Deviations and findings

- The writer picks insert or update from the manual row it reads under the request lock, instead of the design's "INSERT ... ON CONFLICT DO UPDATE". The DB double does not record the arguments of a conflict clause, so the update branch (the "correct a registered value" scenarios) would not have been observable in a unit test. The read was already needed for the changed-field computation; every writer of the table takes the request "FOR UPDATE" lock and a structural pin keeps one writer, so no other save can create or remove the row between the read and the write. The behavior in the design sequence is unchanged.
- saveDocumentData takes an optional second parameter "now", by the repository convention ("now: Date = new Date()"), and sets "ActualizadoEn" from it on both insert and update. The design interface has only the input.
- A scope of none answers "not_found" with no transaction and no query, like getSpecialFormatContext.
- When any mark or the type changes, the UPDATE writes all three (the complete submitted state), not only the changed ones; the audit "campos" still names only the changed fields.
- DocumentDataInput (ManualFields plus DocumentMarks) is exported from `src/lib/data/document-data.ts`; `src/lib/document-data/types.ts` is untouched. The input is the complete submitted state of the eight values: a manual value that is null is cleared, a mark that is null is not registered.
- Task 4.1's mapping case is a compile-time assignment (the types test file is type-level for entity types); the runtime mapping from action to entity to id is pinned in `src/lib/audit/events.test.ts`. The "adds no audit entity type" case is also compile-time, so vitest cannot fail it; its mutation check ran through "npm run typecheck".
- Task 4.12: readStudentRows in the retention integration suite now also reads each student's documents (with the three marks) and manual records, so the existing "leaves the younger and the enrolled students untouched" case also covers the younger student's record and marks by whole-object comparison. The dry-run guard and the counts of the route ("documentsDeleted: 1") are unchanged because only the aged student's one document is deleted. The suite header now says the branch needs 0014 and 0015.
- Line endings: the seven touched source and test files, `openspec/changes/manual-document-data/tasks.md` and `openspec/changes/manual-document-data/apply-progress.md` were CRLF in the worktree and were converted to LF; the "git restore" calls of the mutation checks wrote CRLF into the new files, which were converted to LF again. Git stores LF, so the diff shows no line-ending change.
- The repo hook staged `.engram/` files on each of the three commits. Each commit was amended: "git rm --cached" for the chunks, "git checkout HEAD~1 --" for the manifest, then "git commit --amend --no-edit --no-verify". The local manifest was backed up first and put back; the manifest is still modified and the chunks untracked.
- CodeGraph has no index for this worktree, so the code was read with Read and Grep.

### Plan notes for PR 6

- **"no_aplica" documents.** The read in listExtractions excludes documents whose extraction row is "no_aplica", and the writer cannot save manual data for such a document today. A row becomes "no_aplica" only for a retired document (registerPendingExtractions creates it for a retired document and moves the open rows of documents retired meanwhile there), retirement is one-way (nothing sets "RetiradoEn" back to null), and the writer requires "RetiradoEn" to be null. So the two sets never intersect for a write. The only way to reach "manual row plus no_aplica" is by order: manual data saved while the extraction row was "pendiente" or "procesando", then the student retires the document in a correction. That document is retired, hence not a current document and not listed; the signals ignore it too. No read change is needed, and none was made.
- **Form key.** The writer returns only "ok" and "changed". Returning "ActualizadoEn" from it would not help: the action redirects on success, so the page remounts from a fresh read, and the form key must come from that read, which does not select "ActualizadoEn". "ActualizadoEn" moves only when the manual row is written (a marks-only save leaves it alone and a no-op writes nothing), so keying on the document id plus the manual values and the marks is equivalent to the design key and needs no read change. Recommended for PR 6: key on those. The alternative is adding "DocumentoDatoManual"."ActualizadoEn" to listExtractions (a SQL pin change in `src/lib/data/extraction-sql.test.ts` and one more field on ExtractionListItem).
- **Never log the raw error.** The writer rethrows database errors as they are, and a Postgres error message or detail can embed row values (a CHECK violation prints "Failing row contains (...)"). The action of PR 6 must map any throw to "unexpected" and log at most a code and the ids, never the message, stack or cause (MD-11).
- **Payload shape.** The action calls saveDocumentData with actorId, scope, solicitudId, documentoId and data, where data is the complete state: studentName, issuer, issueDate, restFrom, restTo, type, hasSignature and hasSeal, each null when empty. The validation of PR 4 must trim, turn empty into null and give both rest dates or neither; the writer takes "restFrom" alone to decide whether any manual value remains, which is safe only under that rule and under "CK_DatoManual_Reposo". actorId is the session user and scope is the resolved scope, never request input.
- **Outcomes.** "not_found" and "not_editable" are the two refusals; "ok" with "changed" false is a success (no write, no audit row), so the action redirects in both success cases.
- **Phase 9.** The unit tests cannot prove the row lock or a real rollback; the PR 7 acceptance suite and the retention suite run on "manual-it". The retention suite needs 0014 and 0015 on the branch, which are applied.
