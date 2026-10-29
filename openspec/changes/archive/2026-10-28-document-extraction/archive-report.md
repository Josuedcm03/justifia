# Archive report: document-extraction

**Change**: `document-extraction` (roadmap row 4). Spec IDs: RF-11 (a, b), RN-02, RNF-01, RNF-02, RNF-03, RNF-04, RNF-06, FA-04.
**Project**: justifia
**Store mode**: hybrid (filesystem artifacts; Engram unavailable in this session, see Artifact sources)
**Archived**: 2026-10-28
**Archive folder**: `openspec/changes/archive/2026-10-28-document-extraction/`
**Branch**: `feat/document-extraction`, HEAD `42053ed` at archive start. One PR, `size:exception` (task 0.1). The owner merges the tracker PR into `main` (task 10.5, still open by design).
**Close status**: closed with warnings. Verdict `pass_with_warnings`, 0 CRITICAL. Warnings W2, W3 and W6 remain open and are carried forward below. No partial archive and no stale-checkbox reconciliation was needed.

## Artifact sources

Engram tools (`mem_search`, `mem_get_observation`, `mem_save`) were not available to this executor because the Engram MCP server failed to connect. The `sdd/document-extraction/*` topics were not read or saved. Observation IDs: none. The Engram topic `sdd/document-extraction/archive-report` was NOT saved; this file is the persisted report.

Files read for this archive: `tasks.md` (full, including Phase 10), `verify-report.md` (front matter and verdict), `specs/document-extraction/spec.md`, `specs/justification-intake/spec.md` and `specs/request-review/spec.md` (byte checks). `proposal.md`, `design.md`, `explore.md` and `apply-progress.md` were archived unchanged by the mechanical move and were not re-read for content in this run.

## Gates

- **Native review**: `gentle-ai review status --next-transition` reports applicability `unrelated`, receipt `not_applicable`, and `next_transition` `stop` with reason `rdd_disabled`. Receipt-driven development is off. `reviewGate` is structurally absent, so the archive proceeds under ordinary repository policy. Receipt-driven development was not enabled.
- **CRITICAL findings**: `verify-report.md` front matter reports `verdict: pass_with_warnings`, `blockers: 0`, `critical_findings: 0`.
- **Dispatcher note**: the native dispatcher reported `verify: blocked` because tasks 10.1 to 10.5 were still open. Verify (task 10.1) ran with the owner's approval. The block was a sequencing artifact of the open closeout tasks, not a verification failure.
- **Task Completion Gate**: every implementation task (0.1 to 9.6) and closeout tasks 10.1 to 10.3 are checked. Task 10.4 is closed by this run. Task 10.5 remains unchecked, as instructed: it is an owner action (merge the tracker PR into `main`). No stale checkbox was reconciled.
- **Database**: no database command was run by this archive. The production Neon project was not touched.

## Final state at close

Ranking per the sdd-archive Final-State Authority: native review authority, then the tasks artifact, then explicit launch-prompt final-state facts, then `verify-report` (intermediate snapshot, written at `b402d6e`).

| Fact | Final state | Source (rank) |
|---|---|---|
| Verification outcome | `pass_with_warnings`; 0 CRITICAL; 61 scenarios: 60 COMPLIANT, 1 PARTIAL ("Concurrent claim", W3) | `verify-report` (snapshot, verification time) |
| Gates | `npm test` 268 files, 5,911 tests passed; typecheck clean; build passes (on `aff40b1`) | launch-prompt final-state facts (supersede the 258 / 5,663 counts recorded at task 8.1) |
| Migration `0011_document_extraction` | Applied to production 2026-10-24 (task 9.4); `__drizzle_migrations` 11 to 12; `ExtraccionDocumento` exists | tasks artifact (9.4) |
| Owner walk 9.5 | Passed after the PDF token-budget fix (`2fd7a38`). Steps (a) to (f) pass on the re-walk; the PDF step failed on the old build and passes after the fix. Docs 1 and 2 of the walk stay `fallida` on the old build | tasks artifact (9.5) |
| Walk cleanup 9.6 | Neon branches `backup-before-document-extraction` and `walk-document-extraction` deleted; walk data deleted from production (`ExtraccionDocumento` cascades, 0 rows); 76 `EventoAuditoria` rows kept (the audit table is immutable). The Neon project now has only `production`, with no restore branch | tasks artifact (9.6) |
| Verify W1 (spec/design drift from the token-budget fix) | Resolved in `85939c8` (spec sync and design wording) | launch-prompt final-state facts; commit |
| Verify W4 (escalation must renumber its 0011) | Recorded in `docs/roadmap.md` row 4 notes (`42053ed`); also a follow-up below | roadmap (commit `42053ed`) |
| Verify W5 (`MAX_IMAGE_TOKENS` 6144 tied to server `-c 8192`) | Recorded in `docs/roadmap.md` row 4 notes (`42053ed`); also a follow-up below | roadmap (commit `42053ed`) |
| Roadmap row 4 | `archivado` (task 10.3, `42053ed`); not touched by this archive | tasks artifact (10.3) |

## Verify warnings at close

| # | Verify-report statement (at `b402d6e`) | Status at close |
|---|---|---|
| W1 | Spec/design drift from the token-budget fix | Resolved in `85939c8` |
| W2 | No TDD evidence table for batch 9 | Open (carried forward) |
| W3 | "Concurrent claim" PARTIAL: the real race is proven only by the opt-in integration test 2.17 (`src/lib/data/integration/extraction-claim.integration.test.ts`), which was written but never run | Open (carried forward) |
| W4 | `escalation` must renumber its `0011` | Recorded in the roadmap (`42053ed`); follow-up 1 |
| W5 | `MAX_IMAGE_TOKENS` 6144 is tied to the server `-c 8192` | Recorded in the roadmap (`42053ed`); follow-up 5 |
| W6 | Vercel Hobby non-commercial terms | Open owner decision (carried forward) |

Verify suggestions were not re-audited in this run; they remain as recorded in `verify-report.md`.

## Commits

Closeout commits of this change, on `feat/document-extraction`:

- `94ce89f`: the extraction table with migration 0011 and its data module (task 2.19)
- `2fd7a38`: fix, PDF image-token budget (the 9.5 defect)
- `22b818e`: docs, owner walk 9.5 and the PDF token fix
- `aff40b1`: docs, task 9.6 cleanup
- `b402d6e`: docs, verify report
- `85939c8`: docs, spec sync and image token budget
- `42053ed`: docs, roadmap row 4 archived

This archive step commits nothing. The `git mv` rename is staged in the index; the report and the `tasks.md` edit are unstaged, for the owner to commit.

## Spec sync record (task 10.2, `85939c8`)

| Capability | Action | Details |
|---|---|---|
| `document-extraction` | Created from the delta | Byte-identical copy of `specs/document-extraction/spec.md` (readback below) |
| `justification-intake` | Updated | MODIFIED `Cleanup sweep execution (D8, D10)` replaced in place; ADDED `Sweep re-enqueues document extraction (RF-11)` placed before `## Decisions applied` |
| `request-review` | Updated | ADDED 4 requirements, appended: `Extracted data section on the staff detail (RF-11 a, RF-11 b, RN-02, RNF-01)`, `Extraction states on the staff detail (RF-11)`, `Extracted data is fail-soft and adds no audit row (RF-11, RNF-06)`, `Extraction UI i18n` |

Differences between the deltas and the merged main specs at archive time, all intentional:

- `justification-intake` MODIFIED block: the delta line `(Previously: the sweep had no extraction step ...)` is dropped in the main spec, because change-specific `Previously` annotations are not kept (the same convention as `request-consent`).
- `justification-intake` ADDED block: the main spec continues with `## Decisions applied` after the new requirement, which the delta does not contain.

## Readback outputs (verbatim)

The source for every move is a pre-move recursive snapshot in the session scratchpad (`.../scratchpad/snap/source`). HEAD is exported with `git archive HEAD openspec/changes/document-extraction`.

Spec readbacks, run before the move:

```
$ cmp specs/document-extraction/spec.md openspec/specs/document-extraction/spec.md
identical (cmp exit 0)

$ diff <(sed -n '7,43p' delta/justification-intake/spec.md | tr -d '\r') <(sed -n '100,135p' main/justification-intake/spec.md | tr -d '\r')
12d11
< (Previously: the sweep had no extraction step and MUST NOT touch requests in any state other than `borrador`.)
exit=1  (intentional, see Spec sync record)

$ diff <(sed -n '46,$p' delta/justification-intake/spec.md | tr -d '\r') <(sed -n '783,$p' main/justification-intake/spec.md | tr -d '\r')
55a56,63 (the `## Decisions applied` block, see Spec sync record)
exit=1  (intentional)

$ diff <(sed -n '9,$p' delta/request-review/spec.md | tr -d '\r') <(sed -n '517,$p' main/request-review/spec.md | tr -d '\r')
(no output, exit 0)
```

Move readbacks:

```
$ git mv openspec/changes/document-extraction openspec/changes/archive/2026-10-28-document-extraction
$ test ! -e openspec/changes/document-extraction   -> source absent

$ diff -r <snapshot>/source openspec/changes/archive/2026-10-28-document-extraction
(no output, exit 0)

$ diff -r <HEAD export>/openspec/changes/document-extraction openspec/changes/archive/2026-10-28-document-extraction
Files apply-progress.md and verify-report.md differ (line endings only, see below)

$ diff -r --strip-trailing-cr <HEAD export>/openspec/changes/document-extraction openspec/changes/archive/2026-10-28-document-extraction
(no output, exit 0)
```

Line-ending note: the archive bytes equal the pre-move working copy (snapshot readback empty). Against the committed blobs, `apply-progress.md` has 49 LF-only lines in its Batch 9 section (1,266 CR of 1,315 lines), and `verify-report.md` is LF-only (0 CR). `core.autocrlf=true` makes git status report the tree as clean. Content is identical once CRs are stripped. The archive did not rewrite these bytes, because the archive is a mechanical copy. The owner decides whether to normalize them in the closeout commit.

Post-edit readback (task 10.4 mark and this report, added after the move): see the final readback in the phase result. Expected difference: `tasks.md` (10.4 mark) and `archive-report.md` (additive). Nothing else.

## Open warnings carried forward

1. **W2**: no TDD evidence table for batch 9, per `verify-report`. Informational for the next change; no code impact.
2. **W3**: "Concurrent claim" is PARTIAL. The real two-writer race and the real `ON DELETE CASCADE` are proven only by `src/lib/data/integration/extraction-claim.integration.test.ts` (task 2.17). It was never run. It runs only on a disposable branch with migration 0011 applied and the owner's explicit yes.
3. **W6**: Vercel Hobby plan terms are non-commercial. Recorded as an open owner decision (task 9.2 (c), design open question). Before any commercial use, the owner decides on the plan.

## Follow-ups

1. **Escalation renumber (W4)**: the unmerged `escalation` change carries `drizzle/0011_escalation.sql`. Production already has `0011_document_extraction` applied (task 9.4), so `escalation` must regenerate its migration as the next free number (`npm run db:generate`), not hand-number it. The migration test locates SQL by name.
2. **Validation-signals manual entry**: documents that end `fallida` (walk docs 1 and 2 on the old build) have no manual entry until `validation-signals` ships. Owner-visible gap.
3. **Orphaned Blob files**: the 7 walk documents deleted in 9.6 left their files in Vercel Blob storage. Cleanup is an owner action; no agent deleted them.
4. **No Neon restore point**: after 9.6 the project has only `production`. Create a fresh backup branch (owner yes) before the next migration.
5. **Coupling (W5)**: `MAX_IMAGE_TOKENS` (6144) must stay consistent with the model server context `-c 8192`. Changing either requires checking the other.
6. **Accuracy at narrower PDF widths**: the token budget narrows PDF pages. The re-walk confirmed the name and issuer on the 3-page sample, and dates read "no reconocido". Accuracy at these widths was not measured. Reference: a 5-page Letter PDF gives about 964 px per page (31 x 39 = 1,209 image tokens, within the per-page share of 6,144 / 5 = 1,228.8).
7. **Shared pins with `student-enrollment`** (its archive warning 5): `src/lib/audit/types.ts` and its pinned-count test, `i18n/*.json`, and `catalog-parity.test.ts` are shared. That warning asks whichever change merged second to reconcile the pins. This archive did not re-verify that reconciliation.

## Traceability

- Engram observation IDs read: none (Engram unavailable).
- Engram topic `sdd/document-extraction/archive-report`: not saved; this file is the record.
- Roadmap: `docs/roadmap.md` was not touched by this archive step.
