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
