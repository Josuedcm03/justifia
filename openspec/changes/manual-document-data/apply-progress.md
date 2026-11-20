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

## Phase 5 (PR 4)

Mode: Strict TDD. Branch "feat/manual-document-data-4-domain" from the PR 3 branch (395840e). PR 4: "https://github.com/Josuedcm03/justifia/pull/96", base "feat/manual-document-data-3-write". Size exception accepted by the owner (0.1 a); the slice is not split.

No database was touched: no migrate, no neon command, no SQL. Every run used the dummy DB. Both modules are pure and unwired: nothing imports them yet.

### Commits

| Unit | Hash    | Message                                               |
| ---- | ------- | ----------------------------------------------------- |
| 9    | a1c0a63 | feat(signals): add the rn11, rn12 and rn13 evaluators |
| 10   | 34cfa5f | feat(document-data): validate manual document data    |

### Files

| File                                       | Action                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `src/lib/signals/document-marks.ts`        | Created: evaluateMissingSignature, evaluateMissingSeal, evaluateTypeMismatch and their local types (127 lines)        |
| `src/lib/signals/document-marks.test.ts`   | Created (64 cases: per-document marks, the strict table for the three signals, 15 type and cause pairs, the map seam) |
| `src/lib/document-data/validation.ts`      | Created: validateDocumentData, the six error codes, the payload and result types (166 lines)                          |
| `src/lib/document-data/validation.test.ts` | Created (60 cases: bounds, trimming, dates, rest period, type, marks, whole-save behavior)                            |

### TDD cycle evidence

| Task              | RED                                                                                        | GREEN                                                                        | Refactor                                                   |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 5.1 and 5.2 marks | run failed: "./document-marks" missing (no test collected; both parts were written first)  | 64 of 64 pass in `src/lib/signals/document-marks.test.ts`; typecheck clean   | test titles reordered so "%s" prints the outcome, prettier |
| 5.4 mutation 1    | n/a (revert-only check)                                                                    | lenient aggregation ("some" absent): 5 failed, 59 passed; restored           | none                                                       |
| 5.4 mutation 2    | n/a (revert-only check)                                                                    | "otro" made to correspond: 7 failed, 57 passed; restored                     | none                                                       |
| 5.6 validation    | run failed: "./validation" missing (no test collected)                                     | 60 of 60 pass in `src/lib/document-data/validation.test.ts`; typecheck clean | prettier reflow                                            |
| 5.7 mutation 3    | n/a: the throw case was added after the first GREEN draft, so this check is its RED proof  | non-string text read as null: 5 failed, 55 passed; restored                  | none                                                       |
| 5.7 mutation 4    | n/a (revert-only check)                                                                    | lone rest date allowed: 3 failed, 57 passed; restored                        | none                                                       |
| 5.7 mutation 5    | n/a (revert-only check)                                                                    | length in UTF-16 units: 1 failed, 59 passed; restored                        | none                                                       |

The mutation checks that touch new files were run after "git add", so "git restore" restored them from the index; "git status" was clean of the mutation each time. Triangulation: the aggregation table runs for firma, sello and type (three signals through one table), the 15 type and cause pairs are written out, and the validation bounds run on both sides of each limit.

### Work unit evidence

| Evidence             | Value                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | "npm test -- src/lib/document-data src/lib/signals": 14 files, 345 tests passed (includes the structural pins `src/lib/signals/display-only.test.ts` and `src/lib/signals/no-persistence.test.ts`) |
| Runtime harness      | N/A: pure functions, unwired; there is no runtime boundary to cross until PR 5 (signals) and PR 6 (action)                                                                                         |
| Rollback boundary    | Revert the PR; nothing imports the two modules, so no behavior changes                                                                                                                             |

### Gates

- Full "npm test" with the dummy DB: 362 files, 8684 tests, all passed, 225 s (vitest duration 224.79 s). PR 3 was 360 files and 8560 tests: two new files, 124 new tests (evaluators 64, validation 60).
- "npm run typecheck": clean (run before each commit and at the end).
- "npx eslint src": the known CRLF "Delete the carriage return" messages, two CRLF-quoted lines in `src/test/access/inventory.ts` and one unused-import warning in `src/components/app-sidebar.tsx`, all in untouched files; 135062 problems, the same total as PR 3. ESLint and "npx prettier --check" on the four touched files: clean.

### Measured size (task 5.9)

"git diff --numstat feat/manual-document-data-3-write...HEAD" excluding "openspec/" and ".engram/": 1104 additions and 0 deletions, 1104 changed lines (293 production lines, 811 test lines). Target was about 400 and the stop line 460; the owner's size exception covers it. Unit 9 is 530 lines (127 production, 403 test), unit 10 is 574 (166 production, 408 test).

### Deviations and findings

- Evidence kind. The evaluators return one local evidence kind, "documents" with "documentIds", for the three signals, and an absent outcome carries an empty list (like RN-09's absent). The design interface listed two kinds ("mark" and "documentType") with counts and type codes; the spec (MD-16, MD-28) and task 0.1 (c) settled ids only, so the two collapse into one. Task 6.3 folds this kind into SignalEvidence and PR 5 needs one evidence line per signal code instead of per kind.
- Input shape. The evaluators take MarkedDocument, which is the document id plus a DocumentMarks, exactly the "marks" field that task 6.3 adds to SignalDocument. A SignalDocument array will therefore pass to them unchanged, and the evaluators cannot see the extraction row, the name, the issuer or the dates.
- Map type. DocumentTypeCauses is declared in `src/lib/signals/document-marks.ts` as the readonly record of types to causes; the constant of `src/lib/signals/document-type-causes.ts` satisfies it. "otro" is handled only through the map (it is in no list), not by a hard rule in the evaluator, so an injected map decides everything (MD-15).
- Validation error keys. One key per field: "studentName", "issuer", "issueDate", "rest", "type", "hasSignature", "hasSeal". The two rest dates share "rest" (the spec reads "error on rest period"), with "date_invalid" over "rest_incomplete" over "rest_order" when several apply. The task named the codes, not the keys.
- Lengths are counted in code points, as varchar(n) counts characters, not in UTF-16 units; a case with 160 emoji pins it. Trimming happens before the length check.
- The type accepts null or an empty string as "not registered" and refuses anything else, including a padded " otro". The marks accept only true, false or null; the action of PR 6 maps the radio values.
- validateDocumentData throws a TypeError when a text or date field is neither a string nor null (the message holds no value). The task did not ask for it; without it such a value would have read as empty and cleared a stored one. The type and the marks come in as "unknown" and are checked, not trusted.
- The result type is ManualFields plus DocumentMarks from `src/lib/document-data/types.ts`, structurally the same as DocumentDataInput of the writer; the validation does not import the writer (it has "server-only").
- Line endings: the "git restore" calls of the mutation checks wrote CRLF into the new files, which were converted to LF again; Git stores LF.
- The repo hook staged `.engram/` files on both commits. Each was amended with the helper script (chunks "git rm --cached", manifest "git checkout HEAD~1 --", then "git commit --amend --no-edit --no-verify"), and the local manifest was put back; the manifest is still modified and the chunks untracked.
- CodeGraph has no index for this worktree and the four files are new and self-contained, so the surrounding code (signals types, rest-dates, dates) was read directly.

### Plan notes for PR 5

- **Fold the local types into `src/lib/signals/types.ts` (task 6.3).** MarkSignalResult becomes members of SignalResult, MarkEvidence becomes one member of SignalEvidence (kind "documents", ids only), and "not_registered" joins REASON_PRECEDENCE and NOT_EVALUABLE_REASONS; MarkNotEvaluableReason is then a subset of NotEvaluableReason, and ALLOWED_REASONS for rn11, rn12 and rn13 is the same two codes. Delete the local copies from `src/lib/signals/document-marks.ts` and import from types, so nothing is declared twice. The design's evidence kinds "mark" and "documentType" and the i18n keys "evidence.mark" and "evidence.documentType" do not exist in this model: the evidence line of the three signals is keyed by signal code, so decide the keys of "review.signals.evidence" when writing the evidence lines.
- **Wiring (task 6.4).** The evaluators take a readonly list of MarkedDocument; pass `input.documents` as it is once SignalDocument carries "marks". evaluateTypeMismatch needs the declared cause and "params.documentTypeCauses" (default DOCUMENT_TYPE_CAUSES, typed DocumentTypeCauses). The three results go between rn10 and rn14, outside the cause cut, in that order; none of them can be not_applicable, which the result type already enforces.
- **The strict rule is already inside the evaluators.** Nothing in `src/lib/signals/verdict.ts` needs to change: not_registered is a not_evaluable reason, so the verdict stays "inconclusive" while any mark is unregistered (task 6.2 pins it with a mutation check).
- **`loadSignals` and the marks.** ExtractionListItem already carries "marks" (PR 2); map them into SignalDocument as "marks". Documents must stay the current student documents only (the item list is already filtered); the evaluators do no filtering.
- **For PR 6.** validateDocumentData takes the payload of the eight values and returns "data" (the same eight, trimmed, empty as null, both rest dates or neither) or "errors" keyed by field with one of six codes; pass "data" to saveDocumentData as is. The action must give text and dates as string or null (a FormData entry can be a File: coerce first, because a non-string throws a TypeError) and the radios as true, false or null; map any throw to "unexpected" and never log its message. The i18n keys "errors.{6 codes}" are keyed by code, but the form shows each under its field key, so "rest" shows under the rest inputs. NAME_MAX_LENGTH and ISSUER_MAX_LENGTH are exported for the maxLength of the inputs.

## Phase 6 (PR 5)

Mode: Strict TDD. Branch "feat/manual-document-data-5-wiring" from the PR 4 branch (368b6cb). PR 5: "https://github.com/Josuedcm03/justifia/pull/97", base "feat/manual-document-data-4-domain". Size exception accepted by the owner (0.1 a); the slice is not split.

No database was touched: no migrate, no neon command, no SQL. Every run used the dummy DB. The integration file `src/lib/data/integration/validation-signals.integration.test.ts` was edited and typechecks; it was not run (owner-run, Phase 9).

### Commits

| Unit | Hash    | Message                                                 |
| ---- | ------- | ------------------------------------------------------- |
| 11   | 975eb3a | feat(signals): wire rn11, rn12 and rn13 into the report |
| 12   | 03d9afa | feat(review): show the manual signals                   |
| 13   | d5a5b9d | test(signals): RF-05 (e) tipo discordante               |

### Files

| File                                                                   | Action                                                                                                                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/signals/types.ts`                                             | Modified: eight codes, "not_registered" last in the precedence, the allowed pair of rn11 to rn13, evidence kind "documents", the mark result types, marks on SignalDocument |
| `src/lib/signals/params.ts`                                            | Modified: documentTypeCauses (default DOCUMENT_TYPE_CAUSES)                                                                                                                 |
| `src/lib/signals/evaluate.ts`                                          | Modified: the three results between rn10 and rn14, outside the cause cut                                                                                                    |
| `src/lib/signals/document-marks.ts`                                    | Modified: the local result types removed (they live in types.ts); MarkedDocument and DocumentTypeCauses stay                                                                |
| `src/lib/data/signals.ts`                                              | Modified: one line, the marks of the effective read go into the documents                                                                                                   |
| `src/app/(dashboard)/review/[id]/signals-section.tsx`                  | Modified: the documents evidence line, documentNames prop, labels for the secretary audience only                                                                           |
| `src/app/(dashboard)/review/[id]/page.tsx`                             | Modified: passes the labels (file names) of the current documents                                                                                                           |
| `i18n/es.json`, `i18n/en.json`                                         | Modified: names of rn11 to rn13, the "not_registered" reason, the plural documents line                                                                                     |
| `src/lib/signals/evaluate.test.ts`                                     | Modified: eight-result order, precedence, closed reasons, MD-20, the map as a param, a sweep of marks                                                                       |
| `src/lib/signals/verdict.test.ts`                                      | Modified: five cases for the manual signals (pass at write)                                                                                                                 |
| `src/lib/signals/rf-05-e.test.ts`                                      | Created (16 cases, the thesis acceptance)                                                                                                                                   |
| `src/lib/signals/coordination-view.test.ts`                            | Modified: eight-result report, the manual signals project to outcome and reason label                                                                                       |
| `src/lib/signals/issuer.test.ts`, `src/lib/signals/rest-dates.test.ts` | Modified: fixtures only, the marks and the params the types now require                                                                                                     |
| `src/lib/data/signals.test.ts`                                         | Modified: eight signals, a marks block of five cases                                                                                                                        |
| `src/lib/data/integration/validation-signals.integration.test.ts`      | Modified: marks option on the document fixture, the "no_alerts" case registers them, one new "inconclusive" case                                                            |
| `src/app/(dashboard)/requests/no-signals.test.ts`                      | Modified: eight codes in the report, three new names among the revealing words                                                                                              |
| `src/app/(dashboard)/review/[id]/signals-section.test.tsx`             | Modified: show() takes labels and audience; eleven cases for the manual signals                                                                                             |
| `src/app/(dashboard)/review/[id]/page.test.tsx`                        | Modified: eight-result fixture, one case for the labels                                                                                                                     |
| `src/app/(dashboard)/coordination/[id]/page.test.tsx`                  | Modified: fixture with rn11 to rn13; the not_registered label is shown, no document id                                                                                      |
| `src/i18n/review-messages.test.ts`                                     | Modified: names, reason and the plural line of the documents evidence                                                                                                       |

### TDD cycle evidence

| Task           | RED                                                                                                                         | GREEN                                                                                                       | Refactor                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 6.1 evaluate   | 15 of 49 failed in `src/lib/signals/evaluate.test.ts` (eight results, precedence, allowed pair, not_registered, MD-20, map) | 113 of 113 pass with `src/lib/signals/document-marks.test.ts` after types, params and evaluate              | two weak cases tightened to require the eight codes |
| 6.2 verdict    | passes at write (22 tests, verdict.ts is generic)                                                                           | mutation: not_evaluable counted as absent failed 10 (3 new); restored with "git restore"                    | none                                                |
| 6.5 loader     | 17 of 35 failed in `src/lib/data/signals.test.ts` (no marks make the evaluators throw, the loader degrades)                 | 35 of 35 pass after one line in `src/lib/data/signals.ts`                                                   | none                                                |
| 6.6 fixtures   | n/a: fixtures of already-built behavior, they pass at write                                                                 | coordination view (14), no-signals, integration file typechecks                                             | none                                                |
| 6.8 section    | 2 of 11 new failed (raising documents by label, plural and singular); the other nine pass at write                          | 59 of 59 in `src/app/(dashboard)/review/[id]/signals-section.test.tsx`                                      | prettier                                            |
| 6.8 page       | 1 failed (the label of the raising document)                                                                                | 124 of 124 in `src/app/(dashboard)/review/[id]/page.test.tsx` after the page passes the labels              | none                                                |
| 6.9 i18n       | 5 failed (the documents line: placeholders, both numbers, no ids); names and reason pass at write                           | 134 of 134 with the section file                                                                            | none                                                |
| 6.8 mutation   | n/a (revert-only check)                                                                                                     | audience guard dropped: 1 failed (the coordination case); restored from a copy                              | none                                                |
| 6.9 mutation   | n/a (revert-only check)                                                                                                     | Spanish name of rn13 shortened: 2 failed (the name pin, the Spanish order case); restored from a copy       | none                                                |
| 6.12 RF-05 (e) | passes at write (pins units 9 and 11), 16 tests                                                                             | mutation: actividad_representativa added to constancia_medica failed 1 (SC-05); restored with "git restore" | none                                                |

The two mutations of unit 12 ran while the GREEN edits of tracked files were still uncommitted, so they were restored from a copy made first (a "git restore" would also have dropped the GREEN edit). The other two ran on committed files and used "git restore", then "git diff --quiet" confirmed the tree clean. Triangulation: the eight-result order runs for the five causes, the not_registered cases for the five causes, rn13 over the 15 pairs through units 9 and 13 and a sweep of 5 mark sets and their pairs for the allowed reasons.

### Work unit evidence

| Evidence             | Value                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | "npm test -- src/lib/signals src/i18n src/lib/data/signals.test.ts": green. "npm test -- src/lib/signals src/lib/data src/app src/i18n": 210 files, 5654 tests passed after unit 11. "npm test -- src/lib/signals src/i18n src/app/(dashboard)/review src/app/(dashboard)/coordination": 55 files, 1608 tests passed after unit 12 |
| Runtime harness      | N/A: the report is computed in memory from plain data; the real database proof is Phase 9 (owner-run on "manual-it", `src/lib/data/integration/validation-signals.integration.test.ts` edited, not run)                                                                                                                            |
| Rollback boundary    | Revert the PR; the five-signal behavior returns and nothing else depends on the three new signals. Units 12 and 13 can be reverted alone (display and acceptance test)                                                                                                                                                             |

### Gates

- Full "npm test" with the dummy DB: 363 files, 8750 tests, all passed, 219.87 s (vitest duration). PR 4 was 362 files and 8684 tests: one new file, 66 new tests.
- "npm run typecheck": clean (run before each commit and at the end).
- "npx eslint" on the touched files: clean, no CRLF noise because every touched file was converted to LF first. "npx eslint src": 126466 problems, all in untouched files: 126463 CRLF "Delete the carriage return" messages (worktree line endings), two CRLF-quoted lines in `src/test/access/inventory.ts` and one unused-import warning in `src/components/app-sidebar.tsx`. The total is lower than PR 4 (135062) because the 20 files touched here are now LF.
- "npx prettier --check" on the touched files: clean.

### Measured size (task 6.14)

"git diff --numstat feat/manual-document-data-4-domain...HEAD" excluding "openspec/" and ".engram/": 1330 additions and 99 deletions, 1429 changed lines (198 production lines, 1231 test lines). Target was about 320 and the stop line 460; the owner's size exception covers it. Unit 11 is 876 lines, unit 12 is 378, unit 13 is 179.

### Deviations and findings

- **Unit 11 and 12 boundary.** Unit 11 also holds the three names and the "not_registered" reason in `i18n/es.json` and `i18n/en.json` and a no-op "documents" case in `src/app/(dashboard)/review/[id]/signals-section.tsx`. The typecheck gate fails without the case (a new evidence kind), and the existing key-parity test of `src/i18n/review-messages.test.ts` walks SIGNAL_CODES, so it went red the moment task 6.3 landed. The name and reason cases of task 6.9 therefore pass at write; the RED of unit 12 is the documents evidence line and the section cases.
- **Fixture moved between units.** The eight-result fixture of `src/app/(dashboard)/review/[id]/page.test.tsx` (task 6.6) is in unit 12 with the test of the labels, because it only makes sense with the page wiring.
- **Files beyond the task lists.** Unit 11 touches `src/lib/signals/issuer.test.ts`, `src/lib/signals/rest-dates.test.ts` and `src/lib/signals/evaluate.test.ts` (fixtures: the marks and params the types now require) and `src/lib/signals/document-marks.ts` (the local result types removed). Unit 12 lists eight files, not four: the page and its test, the section and its test, the i18n test, both catalogs and `src/app/(dashboard)/coordination/[id]/page.test.tsx`.
- **What moved into `src/lib/signals/types.ts`.** The result model (MarkSignalCode, MarkNotEvaluableReason, MarkEvidence, MarkSignalResult), as the PR 4 notes asked. MarkedDocument and DocumentTypeCauses stay in `src/lib/signals/document-marks.ts` because they are evaluator inputs, and `src/lib/signals/params.ts` imports the map type from there. SignalResult lists MarkSignalResult as a member next to the generic one; the generic member already admits it, so the member only documents the typed pairing.
- **Evidence is ids only, as the spec says; the labels come from the page.** The section takes an optional documentNames record (id to file name, the label the documents section shows) from the secretary's page only. The coordination page passes none and the section ignores the labels for that audience, so a stray evidence field cannot name a file (RNF-01). An id with no label shows nothing.
- **One reason text for the three signals.** "reasons.not_registered" is keyed by reason, not by signal, so it says "this datum" ("La secretaría aún no registró este dato en uno o más documentos vigentes."); the entry name beside it says which datum. The documents line is a plural message.
- **Evidence line keys.** The design's keys "evidence.mark" and "evidence.documentType" do not exist; there is one key, "review.signals.evidence.documents", for the three signals, as the PR 4 notes anticipated.
- **D1 is visible.** A request whose documents have no marks reads "No concluyente" with rn11, rn12 and rn13 listed apart, as the spec says. Every request that exists today has no marks, so after this change reaches production each of them reads "No concluyente" until the secretary registers the marks in PR 6. Nothing reads the verdict to decide anything (RN-15).
- **The thesis case.** `src/lib/signals/rf-05-e.test.ts` is named after the inciso. SC-05 (actividad_representativa with a constancia_medica) is checked through evaluateSignals with the default params: rn13 present with the document id, the verdict "review carefully" and the other seven signals equal to the same request typed institutional or untyped.
- Line endings: the 20 existing files touched were CRLF in the worktree and were converted to LF before editing; the "git restore" of two mutation checks wrote CRLF back and was converted again. Git stores LF, so the diff shows no line-ending change. The three units were committed after the conversion.
- The repo hook staged `.engram/` files on each of the three commits. Each commit was amended with the helper `fixengram.sh` (chunks "git rm --cached", manifest "git checkout HEAD~1 --", then "git commit --amend --no-edit --no-verify"); the local manifest was put back, so it is still modified and the chunks untracked.
- CodeGraph was not queried: every file was named in the tasks or the PR 4 notes, and was read directly.

### Plan notes for PR 6

- **The section already takes labels.** `src/app/(dashboard)/review/[id]/signals-section.tsx` needs nothing more. The per-document form of PR 6 can reuse the same label (nombreOriginal) its section header shows.
- **The data is read through ExtractionListItem.** loadSignals maps "item.marks" (PR 2) into the documents, so a save followed by the redirect re-reads the marks with no other wiring. The action must not revalidate; the page is dynamic and reads on every request.
- **The i18n namespace "review.signals" is done** (names, reasons, the documents line). PR 6 adds the form keys (task 7.x) and must keep the same keys in "es" and "en"; `src/i18n/review-messages.test.ts` walks "review.signals" only, so the form keys need their own parity case.
- **The verdict will read "No concluyente" for every existing request** until marks are registered (see above). The owner may want to know before the tracker reaches main: the first secretary to open an old request sees three signals listed apart. It is the D1 behavior, not a bug.
- **Closed-list of fixtures.** `src/app/(dashboard)/review/[id]/page.test.tsx` now builds the eight-result report; a new test that needs a report should copy it.

### Plan notes for PR 7

- The coordination read-only block of MD-30 is separate from the signals section. The coordination signals section already shows rn11 to rn13 as outcome and reason label only (covered in `src/app/(dashboard)/coordination/[id]/page.test.tsx` and `src/lib/signals/coordination-view.test.ts`); the block adds the type and the marks, never the four values.
- The acceptance suite (task 9.x) can lean on `src/lib/signals/rf-05-e.test.ts` for the unit-level thesis case and on the integration fixture of `src/lib/data/integration/validation-signals.integration.test.ts`, whose document helper now takes the three marks. SC-08 (rn12) and SC-14 (rn11) are not yet covered anywhere: only the evaluator tables and the loader cases run them.
- The design's "rf-14.integration.test.ts" (d) case reads "SC-05 gives rn13 and review_carefully". A present signal beats not registered (MD-19), so the verdict is "review carefully" whether or not the firma and the sello are registered; register them anyway if the case also reads the other signals.

## Phase 7 (PR 6)

Mode: Strict TDD. Branch "feat/manual-document-data-6-form" from the PR 5 branch (a04213e). PR 6: "https://github.com/Josuedcm03/justifia/pull/102", base "feat/manual-document-data-5-wiring". Size exception accepted by the owner (0.1 a); the slice is not split.

No database was touched: no migrate, no neon command, no SQL. Every run used the dummy DB. The two files `src/lib/signals/document-type-causes.ts` and `src/lib/signals/verdict.ts`, which showed as modified for line endings only, were restored with "git checkout" and never committed.

### Task 7.0: Next.js guides re-read

The Server Actions, forms and redirect guides of Next 16.3.4 under "node_modules/next/dist/docs/" (mutating data, forms, redirect) were re-read. No drift from what the action and the form assume:

- "redirect" throws NEXT_REDIRECT and is called outside the try block; in a Server Action it navigates on the client when JavaScript is available.
- A form action receives the FormData; "useActionState" gives the pending flag; a hand dispatch inside "startTransition" is the documented way to call the action from an event handler.
- "refresh" and "revalidatePath" are the tools the review structure guard forbids, so the action ends in "redirect" only.

### Commits

| Unit | Hash    | Message                                      |
| ---- | ------- | -------------------------------------------- |
| 14   | 65bc812 | feat(review): add the document data action   |
| 15   | 3bfcc64 | feat(review): add the document data form     |
| 16   | 47b7041 | feat(review): show manual data and its marks |

### Files

| File                                                          | Action                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(dashboard)/review/[id]/document-data-actions.ts`    | Created: saveDocumentDataAction ("use server", 126 lines)                                                                                               |
| `src/app/(dashboard)/review/[id]/document-data-actions.test.ts` | Created (50 cases)                                                                                                                                    |
| `src/test/access/matrix-table.ts`                             | Modified: the row of the action (64 entry points x 7 identities)                                                                                        |
| `src/app/(dashboard)/review/[id]/document-data-form.tsx`      | Created: the client form of one document (433 lines)                                                                                                    |
| `src/app/(dashboard)/review/[id]/document-data-form.test.tsx` | Created (27 cases)                                                                                                                                      |
| `src/i18n/review-messages.test.ts`                            | Modified: a describe for the manual data keys (9 cases)                                                                                                 |
| `i18n/es.json`, `i18n/en.json`                                | Modified: the "review.extraction" keys of the manual mark, the marks, the types and the form                                                            |
| `src/app/(dashboard)/review/[id]/extraction-section.tsx`      | Modified: manual mark per datum, type and marks facts, the form per document, "editable" and "solicitudId" props, a document waiting for the setting listed with its form |
| `src/app/(dashboard)/review/[id]/extraction-section.test.tsx` | Modified: 22 new cases, the layout case now counts one list per entry, the helper takes "editable" and "solicitudId"                                    |
| `src/app/(dashboard)/review/[id]/page.tsx`                    | Modified: passes "solicitudId" and "editable={pending}", the placeholder comment replaced                                                               |
| `src/app/(dashboard)/review/[id]/page.test.tsx`               | Modified: the actions module mock, the extraction fixture with ocr, manual and marks, 8 new cases                                                       |
| `src/app/(dashboard)/review/[id]/request-sections.tsx`        | Modified: the placeholder comment replaced                                                                                                              |

### TDD cycle evidence

| Task                  | RED                                                                                                                  | GREEN                                                                                                                  | Refactor                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 7.1 action            | run failed: module "document-data-actions" missing (no test collected)                                               | 50 of 50 pass in `src/app/(dashboard)/review/[id]/document-data-actions.test.ts`                                        | prettier reflow; the log spies restored in "afterEach"                 |
| 7.2 mutation 1        | n/a (revert-only check)                                                                                              | the error message added to the log: 3 failed, 47 passed; restored with "git restore"                                   | none                                                                  |
| 7.2 mutation 2        | n/a (revert-only check)                                                                                              | an unknown mark text read as null: 3 failed (firma, sello, all at once); restored                                      | none                                                                  |
| 7.2 mutation 3        | n/a (revert-only check)                                                                                              | a file entry left uncoerced: 1 failed; restored                                                                        | none                                                                  |
| 7.3 matrix            | `src/app/route-coverage.test.ts` RAC-5: the table lacked "(dashboard)/review/[id]/document-data-actions.ts"          | 143 of 143 pass in the two suites after the row                                                                        | none                                                                  |
| 7.6, 7.7 form, i18n   | form run failed: module missing (no test collected); 9 cases failed in `src/i18n/review-messages.test.ts`            | 110 of 110 pass in the form file and the messages file after the component and the keys                                | prettier; "gap-5" to "gap-6" for the spacing guard                    |
| 7.8 mutation 1        | n/a (revert-only check)                                                                                              | the extracted issuer as a default: it passed first (the case had a manual issuer), so the case "prefills nothing" was added, then 1 failed; restored | none                                                  |
| 7.8 mutation 2        | n/a (revert-only check)                                                                                              | "maxLength" of the name removed: 1 failed; restored                                                                    | none                                                                  |
| 7.8 mutation 3        | n/a (revert-only check)                                                                                              | the last refusal kept while the next save runs: 3 failed; restored                                                     | none                                                                  |
| 7.8 mutation 4        | n/a (revert-only check)                                                                                              | the "pending" guard of the submit removed: it passed first (the button is disabled), so the case now submits with "fireEvent" and counts the calls after the first one settles, then 1 failed; restored | none                               |
| 7.10 section          | 26 of 52 failed in `src/app/(dashboard)/review/[id]/extraction-section.test.tsx`                                      | 52 of 52 pass                                                                                                          | none                                                                  |
| 7.11 mutations        | n/a (revert-only checks)                                                                                             | mark on every datum: 3 failed; a waiting document always listed: 1; a key without the marks: 1; rest marked as the issuer: 2; each restored from a copy | none                                                |
| 7.12 page             | 2 failed in `src/app/(dashboard)/review/[id]/page.test.tsx` (the form per document, the form with no extraction)      | 132 of 132 pass after the page passes "editable" and "solicitudId"                                                      | none                                                                  |
| 7.12 mutation         | n/a (revert-only check)                                                                                              | "editable" always true: 4 failed (the four decided states); restored from a copy                                       | none                                                                  |

The new action and form files were staged before their mutations, so "git restore" restored them from the index; the section and the page were uncommitted tracked files, so they were restored from a copy made first. Triangulation: the action runs the callers over six roles, anonymous and no facultad, the validation over eight refusals, and the logs over three kinds of thrown value; the section runs the manual mark over the four data, the rest as one datum, and the marks over null, true and false.

### Work unit evidence

| Evidence             | Value                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | "npm test -- src/app src/i18n": 143 files and 4145 tests passed before the last commit. "npm test -- src/app/(dashboard)/review src/app/access-matrix.routes.test.ts src/app/route-coverage.test.ts": the review directory 28 files and 887 tests, the two matrix suites 143 tests, all passed |
| Runtime harness      | N/A: the unit tests stub the Server Action and the data module; the real save, the redirect and the captures RF-14 (a) to (d) are Phase 10 (owner-run locally on "manual-it")                                                                                                                |
| Rollback boundary    | Revert the PR; the saved rows stay readable and unused, and the section returns to its read-only shape. Unit 14 (the action and its row) and units 15 and 16 can be reverted in reverse order                                                                                              |

### Gates

- Full "npm test" with the dummy DB: 365 files, 8880 tests, all passed, 212.9 s (vitest duration). PR 5 was 363 files and 8750 tests: two new files, 130 new tests.
- "npm run typecheck": clean (run before each commit and at the end).
- "npx eslint" on the 11 touched files: clean. "npx eslint src": 125667 problems, all in untouched files: 125664 CRLF "Delete the carriage return" messages (worktree line endings), two CRLF-quoted lines in `src/test/access/inventory.ts` and one unused-import warning in `src/components/app-sidebar.tsx`. The total is lower than PR 5 (126466) because three more files are now LF.
- "npx prettier --check" on the touched files and both catalogs: clean.
- Thesis figure (task 12.3): the access matrix is now 64 entry points x 7 identities (63 before), 100 percent denied.

### Measured size (task 7.15)

"git diff --numstat feat/manual-document-data-5-wiring...HEAD" excluding "openspec/" and ".engram/": 2702 additions and 46 deletions, 2748 changed lines (853 production lines, 1895 test lines). Target was about 410 and the stop line 460; the owner's size exception covers it. Unit 14 is 642 lines (130 production, 512 test), unit 15 is 1308 as committed (523 production, 785 test) and unit 16 is 812 (the later removal of one catalog key from unit 15 is counted in unit 16).

### Deviations and findings

- **No per-document text for a document waiting for the setting.** The design lists the key "states.notExtracted" and a line for that entry. The spec (MD-27) says such an entry carries its form and no per-document state text, and task 0.1 keeps the spec as the default, so the line and the key were dropped (the key had been added in unit 15 and was removed in unit 16).
- **The shipped Spanish title is not «Datos extraídos».** The spec and the task text call the section «Datos extraídos»; the catalog says "Datos leídos del documento" (English "Extracted data"). Decision 0.1 (b) keeps the shipped title, so nothing changed and the section test pins the shipped one. The spec wording should be reconciled at archive.
- **The action takes FormData, not an object.** The escalation actions take a plain object; this one takes FormData as the brief asked, and the form submits "new FormData(form)" by hand (React resets the fields of a form "action" once it settles, which would drop what was typed after a refusal, as `src/app/(dashboard)/catalog/asignaturas/asignatura-form.tsx` documents). "unregistered" is the value of "Sin registrar" in the radios and in the type select; the action maps it to null. A file or a missing entry reads as empty. An unknown mark text is not mapped to null: it passes through and the validation refuses it with "mark_invalid", so a bad value never clears a stored mark.
- **Logging.** On any throw the action logs the fixed code "document_data_save_failed" and the two ids; it does not log even the error name (the escalation actions log "error.name"). The guard (session, role, scope, ids) runs outside the try block, so the denial redirect of "requireRole" is never turned into "unexpected".
- **The refusal is hidden while the next save runs.** "useActionState" keeps the previous result while a new action is pending, so the form shows the last refusal only when no save is pending.
- **The form key is computed in the section.** It is the JSON of the document id, the manual values and the marks, as PR 3 recommended; no read change and no "ActualizadoEn". A save that changes nothing redirects too, but the key is the same, so that form stays open; a save that changes a stored value remounts it closed.
- **The section also takes "solicitudId".** The design lists only "editable"; the form needs the request id. The page passes "detail.id".
- **The marks are shown in every listed entry.** In an entry with data they share its list; in the other entries (extracting, unavailable, waiting for the setting) they are a list of their own, so the layout case of the section now counts one list per entry instead of one in total.
- **A document waiting for the setting is listed only when editable.** The configuration notice shows whenever one waits; the entry shows only with its form (spec MD-27).
- **Keys beyond the design list.** "form.formLabel" (the accessible name of each form, so several forms on a page can be told apart) and "form.intro" (one sentence that a manual value wins and that an empty field shows the extracted value again, D8). The existing catalog test already compares every "review" key between the locales; the new case pins the form keys by name.
- **Spacing guard.** `src/app/(dashboard)/review/design-system.test.tsx` rejects "gap-5"; the form stack uses "gap-6".
- **A red test was committed once.** Unit 15 was first committed with the spacing guard failing, because the broader run and the commit were in one command. It was fixed and amended before any push, so no pushed commit is red; from then on the broader run is read before each commit.
- **The page test fixture.** The extraction fixture of `src/app/(dashboard)/review/[id]/page.test.tsx` gained ocr, manual and marks, and the test mocks the new actions module, because the page now renders the form.
- Line endings: `src/app/(dashboard)/review/[id]/extraction-section.tsx`, `src/app/(dashboard)/review/[id]/request-sections.tsx` and `src/test/access/matrix-table.ts` were CRLF in the worktree and were converted to LF before editing; the "git restore" of the mutation checks wrote CRLF into the new files, which were converted to LF again. Git stores LF, so the diff shows no line-ending change.
- The repo hook staged `.engram/` files on each commit. Each commit was amended with the helper `fixengram.sh` (chunks "git rm --cached", manifest "git checkout HEAD~1 --", then "git commit --amend --no-edit --no-verify"); the local manifest was put back, so it is still modified and the chunks untracked.
- CodeGraph was not queried: every file was named in the tasks or the earlier notes, and was read directly.

### Plan notes for PR 7

- **The coordination block must not use the extraction read.** `listExtractions` carries the four values; the block needs the narrow read of task 8.1 (document id, name, type, firma, sello). The wording already exists in the catalogs ("review.extraction.types.*" and "markValues.*": «Constancia médica», «Sí», «No», «Sin registrar»); the new keys go under "coordination.detail" as task 8.5 says, with the same text.
- **Acceptance suite and the sentinel.** The "unregistered" value exists only between the form and the action; the data layer, the signals and the integration suite deal in null, true and false. The acceptance suite calls "saveDocumentData" directly with null for "not registered".
- **The form stays open after a no-op save.** The key changes only when a stored value changes. For the RF-14 captures, a save that changes nothing shows the same open form after the redirect; this is not a failure.
- **Phase 10 captures.** The form opens from "Registrar o corregir datos", one per document, under the section «Datos leídos del documento»; each datum shows «Ingresado manualmente» after a save; the type and marks read «Sin registrar» until saved.
- **Task 12.3 figure.** The access matrix is 64 entry points x 7 identities.
- **The requirements edit (task 8.12).** Rebase first (decision 0.2) and keep it to line 153.
- **Before the tracker reaches main.** Task 1.13 (migration 0015 in production, owner's "yes" for that exact command) is still open, and every existing request reads «No concluyente» until the marks are registered (D1).

## Phase 8 (PR 7)

Mode: Strict TDD for the coordination block (unit 17); the acceptance suite is integration code that cannot run here, so its evidence is a typecheck, a skip-mode run and a temporary paper check. Branch "feat/manual-document-data-7-coordination-thesis" from the PR 6 branch (d8d317e). PR 7: "https://github.com/Josuedcm03/justifia/pull/104", base "feat/manual-document-data-6-form". Size exception accepted by the owner (0.1 a); the slice is not split.

No database was touched: no migrate, no neon command, no SQL. Every unit run used the dummy DB. The one integration-config run (task 8.11) had INTEGRATION_DATABASE_URL unset, so every file was skipped and nothing connected. The integration files were written and typechecked, not run: Phase 9.

### Commits

| Unit | Hash    | Message                                                    |
| ---- | ------- | ---------------------------------------------------------- |
| 17   | 84c27f6 | feat(coordination): show the document type and marks read-only |
| 18   | b17b83d | test(manual-document-data): add the RF-14 acceptance suite |
| docs | fa86649 | docs(requirements): point RF-14 to manual-document-data    |
| docs | this commit | docs(manual-document-data): record PR 7 apply progress |

### Files

| File                                                                          | Action                                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/lib/data/document-marks-read.ts`                                         | Created: listDocumentMarks, the narrow fail-soft read (88 lines)                                               |
| `src/lib/data/document-marks-read.test.ts`                                    | Created (14 cases)                                                                                             |
| `src/app/(dashboard)/coordination/[id]/document-marks-section.tsx`            | Created: the read-only block (61 lines)                                                                        |
| `src/app/(dashboard)/coordination/[id]/document-marks-section.test.tsx`       | Created (14 cases)                                                                                             |
| `src/app/(dashboard)/coordination/[id]/page.tsx`                              | Modified: one access decision for the signals and the marks; the block after the signals section               |
| `src/app/(dashboard)/coordination/[id]/page.test.tsx`                         | Modified: the marks mock and a describe of 12 tests (ten cases and one table of two rows)                          |
| `src/app/(dashboard)/coordination/structure.test.ts`                          | Modified: the allowlist entry and a pin that only the detail page imports the read and no staff module        |
| `src/i18n/coordination-messages.test.ts`                                      | Modified: a describe of 5 tests (same wording as "review.extraction", names, no value or control key)          |
| `i18n/es.json`, `i18n/en.json`                                                | Modified: "sections.marks", "marks.*", "markValues.*", "types.*", "marksDegraded" under "coordination.detail" |
| `src/lib/data/integration/rf-14-support.ts`                                   | Created: the shared gate and harness of the four suites                                                        |
| `src/lib/data/integration/rf-14-a.integration.test.ts`                        | Created (6 cases)                                                                                              |
| `src/lib/data/integration/rf-14-b.integration.test.ts`                        | Created (5 cases)                                                                                              |
| `src/lib/data/integration/rf-14-c.integration.test.ts`                        | Created (7 cases)                                                                                              |
| `src/lib/data/integration/rf-14-d.integration.test.ts`                        | Created (11 cases)                                                                                             |
| `docs/requirements.md`                                                        | Modified: line 153 only                                                                                        |

### TDD cycle evidence

| Task                    | RED                                                                                                                                   | GREEN                                                                                                  | Refactor                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 8.1 read                | run failed: module "document-marks-read" missing (no test collected)                                                                  | 14 of 14 pass in `src/lib/data/document-marks-read.test.ts`                                             | prettier reflow                                       |
| 8.2 mutations           | n/a (revert-only checks)                                                                                                              | extra column 2 failed; subidoPorId filter dropped 1; firma from sello 1; manual table joined 3; no_aplica dropped 1; each restored with "git restore" | none                  |
| 8.3 section             | suite failed: component missing                                                                                                       | 14 of 14 pass in `src/app/(dashboard)/coordination/[id]/document-marks-section.test.tsx`                | prettier reflow                                       |
| 8.4 page                | 7 failed in `src/app/(dashboard)/coordination/[id]/page.test.tsx` against the page of PR 6                                            | 58 of 58 pass after the page edit                                                                      | none                                                  |
| 8.4 structure, i18n     | 2 failed in `src/app/(dashboard)/coordination/structure.test.ts`, 5 failed in `src/i18n/coordination-messages.test.ts`               | 18 of 18 and the messages file pass after the page and the keys                                        | the pin counts value imports only (type import erased) |
| 8.5 mutations           | n/a (revert-only checks)                                                                                                              | read made unconditional 1 failed; staff read imported 2; firma from sello 4; button added 2; null as "No" 3; drifted Spanish wording 1; each restored from a copy | none           |
| 8.7 to 8.10 suite       | n/a: integration code, owner-run in Phase 9                                                                                           | typecheck clean; skip-mode run: 4 files, 29 tests skipped, exit 0; a temporary unit test (deleted) fed every case input to evaluateSignals and toEffectiveRow: 4 cases passed | none                                  |

The new data and section files were staged before their mutations, so "git restore" restored them from the index; the page, the structure test and the catalog were tracked and modified, so they were restored from copies made first. The mutation checks of the acceptance suite itself are tasks 9.6 to 9.8.

### Work unit evidence

| Evidence             | Value                                                                                                                                                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command | "npm test -- src/app src/i18n src/lib/data src/lib/signals" before unit 17: 215 files and 5866 tests passed. "npm test -- src/app/(dashboard)/coordination src/i18n/coordination-messages.test.ts src/lib/data/document-marks-read.test.ts": 19 files and 599 tests passed                |
| Runtime harness      | Owner-run: "npm run test:integration -- src/lib/data/integration/rf-14-" on "manual-it" (tasks 9.2 to 9.8). Here: skip mode only (4 files, 29 tests skipped, exit 0)                                                                                                                    |
| Rollback boundary    | Revert the PR; delete the four acceptance files and the harness, and the block with its read; the requirements line is its own commit (fa86649) and reverts alone                                                                                                                       |

### Gates

- Full "npm test" with the dummy DB: 367 files, 8926 tests, all passed, 250.5 s (vitest duration; 4 m 12 s wall). PR 6 was 365 files and 8880 tests: two new files, 46 new tests. A first run, before the harness fix, had 3 failed of 8926 (two structural guards, see the findings).
- "npm run typecheck": clean (run before each commit and at the end).
- "npx eslint" on the touched files: clean (exit 0) on the 13 touched source and test files. "npx eslint src": 125178 problems, all in untouched files: 125175 CRLF "Delete the carriage return" messages (worktree line endings), two CRLF-quoted lines in `src/test/access/inventory.ts` and one unused-import warning in `src/components/app-sidebar.tsx`.
- "npx prettier --check" on the touched files and both catalogs: clean.

### Measured size (task 8.14)

"git diff --numstat feat/manual-document-data-6-form...HEAD" excluding "openspec/" and ".engram/": 2357 additions and 9 deletions, 2366 changed lines (212 production lines, 2154 test and harness lines). Target was about 410 and the stop line 460; the owner's size exception covers it. Unit 17 is 1022 lines (88 + 61 + 21 production, 40 in the catalogs, the rest tests), unit 18 is 1342 (366 of them the shared harness) and the requirements line is 2.

### Deviations and findings

- **Four acceptance files instead of one (owner instruction).** Tasks 8.7 to 8.10 name one file, `rf-14.integration.test.ts`, with a describe per inciso. The owner asked for files named after the incisos so the thesis Anexo F can cite them, so there are four, plus `src/lib/data/integration/rf-14-support.ts` (the gate and the shared fixtures, 366 lines) which the task list does not name. Task 9.2 named the old path in its command; it was updated to the filter "src/lib/data/integration/rf-14-" (it matches the four files and not the harness) so Phase 9 can run as written.
- **The first full run caught two structural guards, and the harness was fixed, not the guards.** `src/lib/data/extraction.test.ts` (no non-test module outside the extraction module writes the extraction table) and `src/lib/signals/fingerprint-exposure.test.ts` (no non-test module outside three allowed ones names or writes the fingerprint column) scan every non-test file of `src`, so the harness `src/lib/data/integration/rf-14-support.ts` tripped both (3 tests failed, 8923 of 8926 passed). The harness now builds only the values (`documentValues`, `extractionValues`, and `fingerprint()` for the hash); the two inserts live in each suite file, as in `src/lib/data/integration/validation-signals.integration.test.ts`. Unit 18 was recreated with the fix before any push; a second full run is the one recorded below.
- **Acceptance files: inciso, scenario and cases.**
  - `src/lib/data/integration/rf-14-a.integration.test.ts`, RF-14 (a): round trip, RN-24 manual over extracted, clearing reverts, RN-14 manual issuer counts and stops when cleared (A5 history, MD-18), extraction row byte-equal, audit rows names only.
  - `src/lib/data/integration/rf-14-b.integration.test.ts`, RF-14 (b): SC-08 (sello ausente, rn12), SC-14 (firma ausente, rn11), the three mark states apart, firma and sello independent, marks never promote.
  - `src/lib/data/integration/rf-14-c.integration.test.ts`, RF-14 (c): SC-12 (forced fallida then capture, rn10 present), the completada variant, a pending row, a document with no row, a covering rest, approval through decideRequest with no outbound call, data frozen after the decision.
  - `src/lib/data/integration/rf-14-d.integration.test.ts`, RF-14 (d) and RF-05 (e): SC-05, SC-01 (no_alerts and inconclusive until registered), SC-11 b, the type and cause table, the A5 strict rule, RN-24 end to end.
- **"The A5 precedence of RN-24" (task 8.10) is ambiguous.** It was read as the A5 strict rule across several documents plus the manual-over-extracted precedence of RN-24 carried to the verdict; both are cases of the (d) file.
- **The acceptance suite cannot be mutation-checked here.** The unit-style revert-only checks need a database; M1 to M3 (tasks 9.6 to 9.8) are the mutation checks. To lower the risk meanwhile, a temporary unit test (not committed) fed the inputs of every case to evaluateSignals and toEffectiveRow with the default parameters and the production calendar, and all expected outcomes held. What it cannot prove is the SQL, the constraints, the row lock and the cleanup, which only Phase 9 shows.
- **The narrow read joins the extraction table for its state only.** Task 8.1 says the filters equal those of listExtractions and 8.2 says the read never touches the manual table. Equal filters include "no_aplica", which lives on the extraction row, so the statement left-joins `ExtraccionDocumento` and selects none of its columns; a pin proves the select holds the five columns and no value. The where clause is compared with the one of listExtractions by rendering both.
- **The block lists the file name and a read-only note.** The spec asks for the type and the marks per document; each entry carries the file name as its heading (the documents card of the same page shows the names) so several documents can be told apart, and one sentence says the secretary registers the data (key "marks.note"). Neither is a registered or extracted value.
- **The block renders nothing when the request has no current document and no degraded read.** The spec is silent; an escalation of only special-format documents has none, and an empty card would carry no information. The degraded read shows one notice and the rest of the detail loads.
- **One access decision for two reads.** `src/app/(dashboard)/coordination/[id]/page.tsx` computes "outcomesOnly" once (an open escalation and the "outcomes" access of signalsAccess) and uses it for the signals and the marks; a pin keeps a single signalsAccess call. The marks read has no page-level try/catch because listDocumentMarks is fail-soft by contract and its own tests prove it.
- **No write path for coordination (MD-30 scenario).** Not new in PR 7: the call of the save action by a coordinator is denied in `src/app/(dashboard)/review/[id]/document-data-actions.test.ts` (six roles) and in the access matrix (64 entry points x 7 identities, unchanged: PR 7 adds a read inside an existing page and no entry point).
- **Task 8.12 and PR 98.** The edit stays: line 153 is outside both hunks of PR 98 and a trial merge with its head is clean. The line must be re-checked after PR 98 merges (a different rewrite of the "Pendientes" list there would conflict); see the plan notes.
- Line endings: `src/app/(dashboard)/coordination/[id]/page.tsx`, `src/app/(dashboard)/coordination/structure.test.ts`, `src/i18n/coordination-messages.test.ts` and `docs/requirements.md` were CRLF in the worktree and were converted to LF before editing; the "git restore" of the mutation checks wrote CRLF into the new files, which were left as the working tree had them and checked LF before each commit. Git stores LF, so the diffs show no line-ending change.
- The repo hook staged `.engram/` files on each commit. Each commit was amended with the helper `fixengram.sh` (chunks "git rm --cached", manifest "git checkout HEAD~1 --", then "git commit --amend --no-edit --no-verify"); the local manifest was put back, so it is still modified and the chunks untracked.
- CodeGraph was not queried (no index for this worktree); every file was named in the tasks or the earlier notes and was read directly. No new Next.js API was used (a server component and a page edit), so no guide was re-read.

### Plan notes for Phases 9 to 12

- **Phase 9 command.** "$env:INTEGRATION_DATABASE_URL='<direct URL of branch manual-it>'; $env:INTEGRATION_ALLOW_WRITES='1'; npm run test:integration -- src/lib/data/integration/rf-14-" runs the four files (29 cases: 6, 5, 7 and 11). A refused gate throws at import, unset skips. Audit rows are append-only, so the secretary the suites create, with its rows, stays on the branch by design.
- **What each mutation should break.** M1 (OCR wins): in (a) "manual value wins" and "reverts when cleared" and in (d) the RN-24 case. M2 (no promotion to "completada"): the capture cases of (c) (fallida, completada variant, pending, no row) and the (a) round trip. M3 (RN-14 history reads only the extracted issuer): the (a) RN-14 case.
- **For task 9.5.** SC-05, SC-01 and SC-11 b are in (d), SC-08 and SC-14 in (b), SC-12 in (c) (rn10 present after the capture), RN-24 precedence and clearing in (a) and (d), the names-only audit rows in (a) and (b), and the retention cascade is the retention suite of PR 3.
- **Thesis Anexo F (task 12.3).** The acceptance files can be cited per inciso: "src/lib/data/integration/rf-14-a.integration.test.ts" to "rf-14-d.integration.test.ts", next to "src/lib/signals/rf-05-e.test.ts" for RF-05 (e) and the captures "RF-14_a.png" to "RF-14_d.png" (Phase 10). The access matrix figure of 12.3 stays 64 entry points x 7 identities.
- **Task 11.1.** When PR 98 merges, re-check `docs/requirements.md` line 153 (the "Pendientes" bullet about RF-14) on the tracker before the slice PRs merge; if PR 98 rewrote that list, redo the one-line edit on top of it. Then the note of task 12.4 can say whether a rebase was needed. This branch was not rebased onto PR 98 and holds only its one line.
- **Coordinator experience (Phase 10, optional).** The block shows after the signals section of an open escalation; it reads «Sin registrar» until the secretary saves, which is every request until the marks are registered (D1).

## Phase 9 (integration on "manual-it", owner yes 2026-11-19)

- Commit: d0dfe3f (tip of "feat/manual-document-data-7-coordination-thesis"). Branch: "manual-it" (child of "dev-arnia"; never production, never "validacion-secretaria"). The run refused any URL on the production endpoint.
- 9.1 (23:31 Managua, read-only): 16 migrations, DocumentoDatoManual present, cascade FK.
- 9.2 (23:33): RF-14 acceptance suite, 4 files, 29/29 passed in 182.9 s.
  - rf-14-a: round trip, RN-24 manual over OCR, clearing reverts, RN-14 manual issuer (MD-18), extraction row byte-equal, audit names only.
  - rf-14-b: SC-08 (sello ausente, rn12 present), SC-14 (firma ausente, rn11 present), three mark states, firma and sello independent.
  - rf-14-c: SC-12 (forced fallida, capture of rest 9 Nov vs absence 9-10 Nov makes rn10 evaluable and present), completada and pending variants, decision without extraction, data frozen after the decision.
  - rf-14-d: SC-05 (rn13 present), SC-01, SC-11 b, the type and cause table, the strict rule across documents, RN-24 to the verdict.
- 9.3 (23:36): retention suite 10/10 (manual data cascade).
- 9.4 (23:37): signals suite 48/48.
- Mutation checks (each applied temporarily, restored from a copy, then a green rerun):
  - M1 (23:44) OCR value wins in toEffectiveRow: 1 failed, the RN-24 datum-by-datum case.
  - M2 (23:47) no promotion to completada: 3 failed, SC-12, the pending-row A4 case and the full-cover RN-10 absent case.
  - M3 (23:50) readIssuerHistory reads only the extracted issuer: 1 failed, the MD-18 manual issuer case.
  - Green rerun (23:53): 29/29. Working tree clean under src afterwards.

## Phase 10 (RF-14 system case, local server on "manual-it", owner yes 2026-11-19)

Commit 1f4f121, branch "manual-it", extraction off, all writes through the UI, no direct SQL write. Evidence in the thesis workspace, "bitacora/evidencia_p1_2026-11-18/rf14/" (uncommitted), with rf14-resultados.json. Captures are cropped to the relevant sections; the secretary's real name in the sidebar and in escalation blocks stays out of frame.

| Inciso | Desenlace | Observado |
|---|---|---|
| a | Cumple | Request 145 (medica): name, issuer, issue date and rest registered; after saving, the four data show "Ingresado manualmente". DocumentoDatoManual has 1 row; 1 "documento.datos_registrados" audit row with field names only. RF-14_a.png |
| b | Cumple | Same document: firma No, sello Si; both marks show and "Firma ausente" is present with "Revisar con cuidado". RF-14_b.png |
| c | Cumple | Request 138 (medica) with extraction off: data, type and marks registered, "Sin alertas", approved through the UI; it shows "Aprobada" with the registered data. RF-14_c.png, RF-14_c-resuelta.png |
| d | Cumple | Request 146 (actividad_representativa): "Constancia medica" registered; "Formato no corresponde a la causa" present with "Revisar con cuidado". RF-14_d.png, RF-14_d-causa.png |

Deviations: (c) used an existing pending request instead of a new one (no Blob upload); its document kept an earlier extraction row that the manual data override, while SC-12 in rf-14-c covers the fallida case on real Postgres. The optional MD-30 coordination capture was skipped: the coordination accounts on the branch are real people and enabling one needs direct SQL writes; MD-30 is covered by unit tests. In (b) and (d) "Documento repetido" also shows, because the seed reuses one file across requests 140 to 145.
