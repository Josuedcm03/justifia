# Archive Report: manual-document-data

**Change**: manual-document-data (RF-14 a to d, RF-05 e, RN-11, RN-12, RN-13, RN-24; RNF-14 type-to-cause map only)
**Archived**: 2026-11-20, to `openspec/changes/archive/2026-11-20-manual-document-data/`
**Artifact store**: openspec (repo-local). No Engram observation IDs were read as sources; the Engram mirror is topic key `sdd/manual-document-data/archive-report`.
**Branch and worktree**: `docs/archive-manual-document-data` at `C:/justifia-worktrees/p1`, created from origin/main 6b7d74e (tracker PR #106 merged, deployed).
**Archive mode**: intentional-with-warnings. Task 11.5 (production smoke test, owner-run, read-only) is open by explicit instruction and is not an implementation task; it is listed in section 7 as a pending owner action. No stale checkbox was reconciled. No CRITICAL issue is open.
**Whole-change verdict**: `PASS WITH WARNINGS` (`verify-report.md`, 0 CRITICAL, 5 WARNING, 7 SUGGESTION, 35/35 requirements, 173/173 scenarios). Verdict and warnings are read as history; the final state is in section 2.

## 1. Artifacts read

| Artifact | Locator (openspec) | Read |
|---|---|---|
| proposal | `openspec/changes/manual-document-data/proposal.md` | yes (locator resolved; folder moved in this archive) |
| spec (capability) | `openspec/changes/manual-document-data/specs/manual-document-data/spec.md` | yes, copied with `cp` |
| spec (deltas) | `openspec/changes/manual-document-data/specs/{validation-signals,document-extraction,request-review,coordination-escalation,audit-log,data-retention}/spec.md` | yes, merged by script |
| design | `openspec/changes/manual-document-data/design.md` | yes (locator) |
| tasks | `openspec/changes/manual-document-data/tasks.md` | yes, 1 open checkbox at close (11.5) |
| verify-report | `openspec/changes/manual-document-data/verify-report.md` | yes (issues S1, S2 read and reconciled in section 4) |

Also in the folder and moved with it: `apply-progress.md`, `exploration.md`. They are historical records and were not used as final-state sources except for the `no_aplica` evidence in section 7.

## 2. Final-state facts (ranked)

Ranking follows `sdd-archive` Final-State Authority: tasks artifact first, then the launch prompt, then intermediate snapshots.

| Fact at close | Rank and source | Where it landed |
|---|---|---|
| Migration `0015_manual_document_data` applied to production, 2026-11-20 00:34 Managua, owner yes, exit 0; read-only check 00:35: 16 migrations, last journal "when" 1795134628842 | 1, tasks | task 1.13 |
| Integration on "manual-it": 29/29 (rf-14 suite), 10/10 (retention), 48/48 (signals); mutations M1 to M3 red then green | 1, tasks | tasks 9.2 to 9.8 |
| RF-14 captures (a) to (d) recorded | 1, tasks | tasks 10.3 to 10.7 |
| Neon disposable branch `manual-it` deleted, 2026-11-20 00:40 Managua, owner yes | 1, tasks (task 10.8, marked done per the orchestrator's instruction) | task 10.8 |
| Tracker PR #106 merged to main as 6b7d74e; Vercel production deploy success; "/login" 200 | 1, tasks | task 11.4 |
| Slices PR #93, #94, #95, #96, #97, #102 and #104 merged into the tracker in order | 1, tasks | task 11.1 |
| Whole-change verify (on 485f7a1): 367 files, 8926 tests passed; typecheck exit 0 | 1, tasks | task 11.2 |
| Task 11.5 (production smoke test) | open, owner-gated | task 11.5 |

## 3. Roadmap (task 12.1)

Commit `c6f6876` (`docs(roadmap): add manual-document-data as row 18`), file `docs/roadmap.md`.

- New row 18, verbatim: `| 18  | \`manual-document-data\`     | RF-14 (a) a (d); RF-05 (e); RN-11, RN-12, RN-13, RN-24; RNF-14 (solo el mapa tipo-causa) | Armando | No | archivado |`. The prototype column is set to "No" because the launch prompt did not specify it; the owner should confirm.
- Note replaced (validation-signals note, first replacement): the sentence that said the RF-14 manual load "no está construida" now names `manual-document-data` (row 18).
- Note replaced (validation-signals note, second replacement): "Quedan fuera de esta entrega" became "Quedaron fuera de esta entrega ... que entrega `manual-document-data` (fila 18)".
- Spanish note added at the end of the notes list, starting "`manual-document-data` (archivado el 2026-11-20)". It covers what the change delivers, migration 0015 and its production date (2026-11-20 00:34, Managua), the strict rule for unregistered marks (the signal stays unresolved and the verdict stays «No concluyente» until the mark is registered), the maternity mapping assumption, and that RNF-14 as a whole stays «No cumple» until row 8.
- The table format is kept (one row added, no count changed).

## 4. Specs synced (task 12.2)

Commit `a770c64` (`docs(specs): sync manual-document-data deltas into the main specs`).

| Domain | Action | Details |
|---|---|---|
| manual-document-data | Created (verbatim `cp` of the capability spec) | 11 requirements (MD-1 to MD-11), `diff -r` empty before any edit. |
| validation-signals | Updated (delta merged) | ADDED 5 (MD-12 to MD-16), MODIFIED 4 (Four outcomes; Recurrence, RN-14; Three-state suggested verdict; Rest signals apply only to causes that admit rest). Untouched requirements verified unchanged. |
| document-extraction | Updated (delta merged) | ADDED 2 (MD-21, MD-22). MODIFIED 0. |
| request-review | Updated (delta merged) | ADDED 3 (MD-23 to MD-25). MODIFIED 3 (Extracted data section; Extraction states; Signals section and suggested verdict). Untouched verified. |
| coordination-escalation | Updated (delta merged) | ADDED 1 (MD-30). MODIFIED 1 (Signal outcomes on the open escalation detail). |
| audit-log | Updated (delta merged) | ADDED 3 (MD-31 to MD-33). MODIFIED 0. |
| data-retention | Updated (delta merged) | ADDED 1 (MD-35). MODIFIED 1 (DR-4 Requests, third-party text and documents). |

Method: a deterministic byte-level merge script (`merge_specs.py`, kept in the session scratchpad, not in the repo). MODIFIED blocks replaced the same-named main block; ADDED blocks were appended at the end of the Requirements section. Blocks were copied byte-for-byte, with CRLF normalised to LF in the working copy (the blobs are LF in git already). The script refused duplicates and missing headings, and verified afterwards that every delta block is present, every changed heading appears once, and every untouched block is unchanged.

### Deliberate deviations (main copies only; the archived deltas keep the original text)

- **S1, validation-signals main, MD-13**: `"Stamp missing"` changed to `"Seal missing"` (1 occurrence, line 801). Reason: the shipped English catalog reads `"rn12": "Seal missing"` (`i18n/en.json`, line 1490); the Spanish is "Sello ausente".
- **S2, request-review main, section title**: `Datos extraídos` changed to `Datos leídos del documento` (2 occurrences, lines 581 and 1101). Reason: the shipped Spanish title is `"extraction": "Datos leídos del documento"` (`i18n/es.json`, line 1343). The title was not changed by this change; the spec text was wrong. The English part of the pair ("Extracted data") was not changed.

### Readback (verbatim, after the deviations)

```
validation-signals delta blocks present: 9
document-extraction delta blocks present: 2
request-review delta blocks present: 6
coordination-escalation delta blocks present: 2
audit-log delta blocks present: 3
data-retention delta blocks present: 2
ALL PRESENT
--- capability spec readback:
(diff -r of the copy against the archived delta: no output, exit 0)
```

The readback ran on the main copies after the S1 and S2 substitutions. The capability spec contains neither substituted string, so it is byte-identical to its archived delta.

## 5. Thesis-sync list (task 12.3, FLAG only)

Nothing under `C:/thesis-workspace` was edited. The owner applies these in the thesis.

1. **Anexo D**: line 42 note, D11 and D15. The D11 columns exist from migration 0015 on. D15 is realised as `ExtraccionDocumento` (OCR) plus `DocumentoDatoManual` (one typed row per document; a non-null column equals "Origen manual"). RN-24 is resolved at read time.
2. **Anexo F**:
   - RF-05 (e), unit test: "Cumple", with `src/lib/signals/rf-05-e.test.ts`.
   - RF-14 (a) to (d), system: "Cumple", with evidence `RF-14_a.png` to `RF-14_d.png` (folder `bitacora/evidencia_p1_2026-11-18/rf14/`, present).
   - The test files named in Anexo F are now `rf-14-a.integration.test.ts`, `rf-14-b.integration.test.ts`, `rf-14-c.integration.test.ts`, `rf-14-d.integration.test.ts` and `rf-05-e.test.ts` (the four acceptance files, per task 8.7).
   - RNF-14 stays "No cumple"; add a note that the type-to-cause map is a constant (`src/lib/signals/document-type-causes.ts`).
   - Alta count goes from 47/53 to 52/53.
   - RNF-01 access matrix: 64 entry points x 7 identities (63 before; the new row is the action `saveDocumentDataAction`, task 7.4).
3. **A5 and Anexo G**:
   - SC-12 "Decisión esperada" no longer reads "RF-14 no está construido".
   - G10 row "SC-05, SC-08 y SC-14" is updated only after a new verification run.
   - Under D1, the "Aprobable" expectation of SC-01 and SC-09 holds only once firma, sello and type are registered.
   - **SC-11 a**: the expected signal "Ninguna" does not hold when the secretary marks firma and sello "No". RN-11 and RN-12 apply to the firma and sello of the issuer; the coordination signature is RN-19 (RF-09 b). The thesis must update that expectation. Shipped result: rn11 and rn12 present (`rf-05-e.test.ts`, verify-report MD-13).
4. **D1 verdict change**: every existing request reads "No concluyente" until its marks are registered (verify-report S5; apply-progress). The thesis verdict expectations under D1 must say so.
5. **Hoja lines 50 to 53**: move RF-14 rows from "No ejecutable" to "Cumple". Record the outcomes from task 10.7 (the four captures). The hoja was not edited.

## 6. Coordination note (task 12.4)

- Josué edited `docs/requirements.md` in parallel. This change kept its edit there to one line: line 153 now names `manual-document-data` for RF-14 (task 8.12), with no new row and no count change.
- PR #98 ("docs: sync requirements with the thesis and close catalog-management open tasks") was still OPEN when this archive was prepared. A trial merge with its head reported no conflict, so the edit was not rebased onto unmerged work. **Re-check line 153 after PR #98 merges.**
- The final migration number is `0015_manual_document_data`, agreed with catalog-schedule (task 0.2). The drizzle journal matches: the `when` of row 0015 is 1795134628842, and production shows 16 migrations (task 1.13).

## 7. Follow-ups (task 12.5; not blocking the archive)

1. **Roadmap row 8 (`normative-parameters`)** replaces the type-to-cause constant in `src/lib/signals/document-type-causes.ts` and the RN-14 threshold constant.
2. **Maternity mapping** (constancia médica also for maternidad and paternidad) stays an assumption of the change, not a verified legal or normative conclusion.
3. **A4**: while OCR is pending, a missing date reads "field_missing" instead of "extraction_pending" (accepted in task 0.1 e).
4. **Documents with extraction "no_aplica"** are not listed and get no form. `no_aplica` belongs only to retired documents: the writer of PR 3 accepts only current student documents, and a row becomes "no_aplica" only for a retired document (apply-progress, PR 3 notes). No current document is affected.
5. **Legal review** of the document-type contrast by the UAM stays with the owner.
6. **Re-check `docs/requirements.md` line 153** after PR #98 merges (verify S3).
7. **Tell the secretaries** that every existing request reads "No concluyente" until its marks are registered (D1; verify S5). This was an operational pre-deploy item; the owner should confirm it was done.
8. **Planning commit `a84893f`** carried `.engram/` chunks and the manifest (verify S6). The owner should confirm that is intended. This archive did not stage any `.engram/` file; each commit was cleaned with the hook cleanup.

## 8. Pending owner actions

| Task | State at close | Owner action |
|---|---|---|
| 10.8 (delete Neon branch `manual-it`) | DONE 2026-11-20 00:40 Managua, owner yes (recorded by the orchestrator; not re-verified here, because this phase runs no Neon commands) | None |
| 11.5 (production smoke test after the deploy: secretary opens a pending request, the form shows, no degraded notice; read-only, no save) | OPEN, owner-gated | Run and record the result in `apply-progress.md` |

## 9. Snapshot claims superseded at close

Each intermediate snapshot claim below was true when written and is not current.

- `verify-report` W1 ("12 of 149 tasks open"; 1.13, 10.8, 11.1 to 11.5, 12.1 to 12.5). Superseded: at close only 11.5 is open (tasks.md); 1.13, 10.8, 11.1 to 11.4 and 12.1 to 12.5 are done.
- `verify-report` Merge Gate table: 1.13 "OPEN", owner OK 11.4 "OPEN", dated entries for 11.3 "waits for 1.13". Superseded: 1.13 done 2026-11-20 00:34, 11.4 done 2026-11-20 00:36 (main 6b7d74e).
- `verify-report` S4 (confirm no other branch took 0015 before the merge). Resolved before the production migration (task 0.2 and 1.13).
- `verify-report` S3 (re-check line 153 after PR #98). Still open; see section 6.
- `verify-report` S1 and S2. Resolved in the main specs, section 4.
- `verify-report` S7 (thesis sync). Carried to section 5 for the owner.

## 10. Readback and traceability

- Mechanical copy and move: the change folder was snapshotted with `cp -R` to the session scratchpad, then moved with `git mv` to `openspec/changes/archive/2026-11-20-manual-document-data/`. The move was followed by `diff -r` of the snapshot against the archived folder, with no output (exit 0). The source folder is absent after the move. This report was written after that readback and is additive, so it is excluded from the comparison.
- Spec copy: `diff -r` of the capability spec against the archived delta: no output, exit 0 (section 4).
- Commits on `docs/archive-manual-document-data`: `c6f6876` (roadmap), `a770c64` (specs), and the archive commit (move, tasks 12.x, this report). Each was checked with `git show --stat HEAD` and the `.engram/` hook files were removed with the cleanup script before the next step.
- Engram: `sdd/manual-document-data/archive-report` is saved with the same content as this file.
