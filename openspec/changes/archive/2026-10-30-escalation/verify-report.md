```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:916f642eb5064eecf860558b9e300939f89a33bf698d6f56d7723c62de95a80d
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 31/31
scenarios: 176/176
test_command: npx vitest run
test_exit_code: 0
test_output_hash: sha256:fd11794285fc10800ec70b12207e8e5aa415b8522f89625f8888c3367a357ff8
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:4ad34417e722e944159300f84a84e00e55c1c0b281bfa1dc4d23e173fe627010
```

## Verification Report (phase 16.1, second run; supersedes the S5-head report)

**Change**: escalation. **Code**: tracker `feat/escalation`, head `a38cdd8` (S1..S10 merged: S6 verify fixes, S7 review fixes, S8 renumber to 0012, S9 race timeout, S10 #68 caso_especial / branded HTML / table fit). Run in the working tree (the uncommitted docs of the owner left untouched; git status identical before and after). No database command, no `.env*` read (drizzle-kit run with DOTENV_CONFIG_PATH pointing at a missing file), integration suite only collected with env unset (all skipped).

### Completeness
Tasks 175 total, 151 `[x]`, 24 open: 0.1, 3.3-3.5, 6.3, 8.3, 11.3, 13.2, 13b.8, 13b.9, 15.3, 16.1-16.13. All but 13b.9 are owner or PR-gated (merge order, slice PR bookkeeping, Vercel APP_BASE_URL, closeout) or this verify (16.1). No `[x]` item found undone. 13b.9 is a real gap (W1).

### Gates (dummy env)
- `npx vitest run`: 304 files / 6903 tests passed, exit 0 (was 270 / 5990).
- `npm run typecheck`: exit 0.
- `npx eslint src`: 121134 problems, all 121134 CRLF "Delete CR"; 0 other findings.
- `npm run format:check`: exit 2. Raw run flags 868 lines (CRLF checkout). With `--end-of-line auto`: 153 files fail, 0 under `src/`, `i18n/`, `drizzle/`; they are Markdown/JSON/docs (see W2). The old W1 (`src/app/privacy/page.test.tsx`) is gone.
- `npm run build`: exit 0 (dummy AUTH_SECRET, no font failure, no retry); `/coordination` and `/coordination/[id]` dynamic.
- Integration config, env unset: 5 files / 72 tests collected, all skipped; the count equals the proof run 14.4 (72/72 on the regenerated 0012).
- Migration: `drizzle-kit generate` with dummy URL printed "No schema changes, nothing to migrate"; `git status` unchanged (no new files). Journal: 13 entries, `when` strictly increasing, 0012 `when` 1793384505116 > 0011 1792808788271, idx 12. 0012 has one DROP (`IX_Solicitud_Cola`, recreated), no UPDATE, no ALTER TYPE; `Tipo`, `Kind`, `SinRespuesta` and `UX_Escalamiento_Abierto` carry both motives. `migration-escalation.test.ts` green.

### Spec compliance
8 specs, 31 requirements, 176 scenarios (audit-log 8/28, coordination-escalation 11/75, justification-intake 1/7, privacy-notice 1/4, request-review 7/34, student-requests 1/9, supporting-documents 1/15, user-roles 1/4). 176 map to a passing test; the database-engine ones also to the real-Postgres proof (14.4, 72/72: second open of either motive refused, reopen after answer with the other motive, notice next to an open escalation, the 12 CHECKs by pg_constraint, queue index, escalate vs approve race) and to the owner walk (15.4-15.7 end to end; 15.5 answered a sospecha, the caso_especial answer is test-only: `coordination/[id]/page.test.tsx:230`, `escalation-answer.test.ts:168`). The 18 scenarios added since the first verify (E18 x6, S6 x4, S7 denial split x3, HTML notice x5) all map: `intake/escalation.test.ts`, `solicitud-escalation.test.ts`, `escalate-dialog.test.tsx`, `escalation-actions.test.ts`, `escalation-dispatch.test.ts:254-317`, `escalamiento.test.ts:275,404,566`, `message.test.ts:128-327`, integration 699-770. Of the 7 previously PARTIAL, 5 are now DB-proven; "Concurrent answers" and "Concurrent attempts (outbox)" remain unit-level (guarded UPDATE), see W1. 0 failing, 0 untested.

### Correctness highlights
- Student neutrality (E13): motive wording lives only in `review.escalation.*` (es/en); the student namespace has one neutral key (`requests.detail.coordination`); no student module imports the escalation tables; `requests/[id]/page.test.tsx:440` and the student-requests scenarios pin no sospecha / caso especial text.
- HTML notice: `html.ts` escapes title, intro, every row label and value, link, button and alt (`message.test.ts:210` with script, img, quotes and ampersands); the plain-text part is pinned byte for byte (`message.test.ts:139`); subject unchanged; no remote asset, only `cid:uam-fia-logo`; the Resend payload forwards `html` and `content_id` only when set (`resend-mail-sender.ts:39`).
- Closed motive set validated server-side; `exceso_inasistencias` refused as a chosen motive; no production code filters on the sospecha motive alone any more.
- Requirement IDs: every RF/RN/RNF cited in the specs exists in `docs/requirements.md` at HEAD (RF-01, 06, 07, 08, 10, 15; RN-02, 08, 15, 16, 17, 20, 25; RNF-01, 02, 04, 06, 07, 12). RN-20 (line 56) now lists suspicion, special case and excess report.
- Old verify items closed: W1 prettier, W3 resend audit row (13b.1), S4 unconfigured mail (13b.2), S5 answered notice (13b.3), S1 denial alignment (13c.11), S2 consent date no longer a placeholder (12.4, 13c.9).

### Design coherence
ES-1..ES-17 followed (ES-17 = E18). Documented deviation kept: ES-12 dialogs use AlertDialog.

### Issues
CRITICAL: none.
WARNING:
- W1. `tasks.md:243` (13b.9) open: no real-Postgres case for the `RespondidaEn IS NULL` claim guard (`src/lib/data/integration/` has none), so "Concurrent answers", "Concurrent attempts (outbox)" and "Answered before it was sent" are proven by mocked-SQL unit tests only. Accepted window documented; not an archive blocker if the owner accepts it.
- W2. `npm run format:check` fails. Raw: CRLF checkout, 868 lines. With `--end-of-line auto`: 153 files, none in source. Change files that fail (Markdown formatting, same as every archived change): the escalation change documents apply-progress, design, exploration, proposal, tasks and verify-report, and its specs audit-log, coordination-escalation, privacy-notice, request-review, supporting-documents and user-roles. Pre-existing and not ours: `docs/requirements.md` (also dirty), `docs/roadmap.md`, `.engram/manifest.json`, `scripts/demo-reset.local.ts`, `docs/investigacion/*`, the archived changes and `openspec/specs/*`.
SUGGESTION (spec drift after E18; stale text, none contradicts a scenario):
- S1. `openspec/changes/escalation/proposal.md:16`: E2 says the reason is `sospecha_documento`; E18 adds `caso_especial`.
- S2. `openspec/changes/escalation/design.md:484-485` (UX observation 6): "refuses every sospecha escalation"; E17 applies to both motives.
- S3. `openspec/changes/escalation/preproposal.yaml:20` (E2) and `:30` (E17) name only `sospecha_documento`; E18 (line 32) amends them without a cross-reference.
- S4. `openspec/changes/escalation/tasks.md:94` (2.1 "fixed reason sospecha_documento") and `:138` (5.12 "client motivo ignored") describe the pre-E18 behavior; 13d.2 (line 268) supersedes them.
- S5. `openspec/changes/escalation/tasks.md:289` says the walk is "to be repeated after S10", but 15.4 (line 294) records the post-S10 walk as done.
- S6. `docs/requirements.md:132` (changelog 2026-10-22, HEAD) still says escalation is "por sospecha sobre el documento (RN-20)"; RN-20 at line 56 now names the special case. Covered by owner task 16.6.
- S7. `openspec/changes/escalation/verify-report.md` (the file) still holds the S5-head report; refresh it from this report at archive (16.5).
- S8. 13b.8 (`tasks.md:242`): teacher-remission still writes a failure row on provider `not_configured`; separate change.

### Verdict
PASS WITH WARNINGS. 0 critical, 2 warnings, 8 suggestions. Next: sdd-archive (16.2 spec sync onward), after the owner decides on W1 and the S1-S5 text touch-ups (spec sync should carry the E18 wording).

## Key Learnings

1. The escalation tracker head passes 6903 unit tests, typecheck and build, and its eslint output is only CRLF noise.
2. Regenerating migration 0012 in place left the drizzle journal ordered and the schema drift check clean.
3. The real-Postgres suite at head holds 72 tests, the same count as the 72 of the regenerated-0012 proof run.
4. Adding the caso_especial motive left stale sospecha-only wording in the proposal, one design note and the preproposal decisions.
5. Prettier with end-of-line auto fails only on Markdown and docs files, never on source files of this change.
