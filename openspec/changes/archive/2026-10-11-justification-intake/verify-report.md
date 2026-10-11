```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:13d08561e6f3c51795b58bd3e9174eef6e0d571f39d2a2d366f24dcd8555579f
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 26/26
scenarios: 90/90
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:72178b4b4605ca6c39872c94c503cfec4cc931a0dc44e5075e33967df1542272
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:25fdba20502c9551f3c56ea6846e982a414f822fa491f82cbf1817eb0d0f36f0
```

## Verification Report

**Change**: justification-intake
**Mode**: Strict TDD
**Revision**: 3, worktree `C:\Users\Arnia\justifia-worktrees\intake-closeout` (branch chore/justification-intake-closeout, base main d118b67, uncommitted closeout changes). Revision 2 was at 227946d.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 56 (plus F.6 added at closeout) |
| Tasks complete | 55 checked |
| Tasks incomplete | 2: 5.7 (roadmap note) and F.5 (rebase audit-log delta), both archive-time |

1.5 is done (migration 0007 applied, owner read-only check 2026-10-11). 5.5 is done for this change; the Vercel project and env vars were moved out of scope by owner decision and are tracked in docs/roadmap.md. F.3 and F.6 are done.

### Build & Tests Execution
- `npm test`: exit 0, 145 files, 2867 passed / 0 failed, 73.4 s (revision 2: 2848).
- `npm run build`: exit 0.
- `npm run typecheck`: exit 0.
- `npx eslint src -f json`: exit 1 only because of 52,583 CRLF "Delete" messages (known Windows gotcha); 0 real errors, 0 warnings after filtering.
- Coverage: not available (no tool configured).
- Integration suite (`npm run test:integration`, opt-in) was NOT rerun here by instruction (no database access). Evidence is the owner-approved run of 2026-10-11 on disposable Neon branch `test-concurrency-intake`: 4/4 passed on 3 consecutive runs, branch deleted afterwards.

### TDD Compliance
Unchanged from revision 2 (5/6 clean; documented slips in content-disposition and layout-360 tests). New: `design-system.test.tsx` pins the F.3 fixes class-level; F.6 integration suite is a real-DB suite excluded from the default run (vitest.config.mts change, `npm run test:integration`).

### Spec Compliance Matrix (6 previously PARTIAL scenarios)
Totals: 26 requirements, 90 scenarios.

| Scenario | Evidence | Result |
|---|---|---|
| Concurrent creation (one open draft) | Integration run: 6 parallel openDraft produce one borrador, all same id; plus double-based unit test | COMPLIANT |
| Double submit | Integration run: 6 parallel, exactly 1 success, losers `conflict`, one `solicitud.presentada` audit row; plus unit test and guarded-UPDATE SQL assertion | COMPLIANT |
| Concurrent finalize beyond cap | Integration run: 8 parallel gives exactly 5 valido; from 4 existing only 1 admitted; plus unit test | COMPLIANT |
| Oversize or wrong type at the store | Unit: token payload asserts allowed types and maximumSizeInBytes 10,485,760; unit: finalize rejects too_large and spoofed types and deletes the stored file; owner browser: 11 MB file with real %PDF header rejected, list stayed 0 of 5 | COMPLIANT, with caveat below |
| No public URL | Unit: adapter uses access private, route response exposes no location; owner manual: "Ver" opened /api/intake/documents/9, never a blob.vercel-storage.com URL; same URL without session returned {"error":"unauthorized"} and no bytes | COMPLIANT |
| 360 px no horizontal scroll | layout-360.test.tsx static guard plus owner device-mode walk of steps 1-4, review, dialogs at 360 px, no overflow; owner console check at 360 px on 4 intake screens, document.documentElement.scrollWidth > clientWidth returned false every time (measured, not only visual) | COMPLIANT |

Caveat on the oversize scenario: the owner's browser rejection ("El archivo supera los 10 MB.") is the client-side check, so the store itself was never observed refusing an oversize body. Store-side refusal is a Vercel Blob guarantee triggered by the signed token constraint; this change proves the constraint is issued (unit) and that finalize independently refuses oversize and deletes the file (unit), so an oversize file can never become a document. I judge the scenario satisfied at the system level, but "end to end at both layers" overstates the evidence. To close it fully, send a raw oversize PUT with a valid token directly to the store (bypassing the client check) and confirm refusal; recorded as WARNING, not blocking.

All other 84 scenarios are unchanged from revision 2 (COMPLIANT). Summary: 90/90 compliant, 0 FAILING, 0 UNTESTED.

### Coherence (Design) and F.3 conformance
Design decisions D1-D15 followed as in revision 2. F.3 fixes verified against docs/design-system.md: tokens exist in globals.css (text-headline, text-title, text-destructive-ink, shadow-soft); field errors and degraded notices use destructive-ink and the catalog alert pattern; radio, checkbox and View/Edit targets are 44px (min-h-11, h-11; design system section 5/7); alert dialog uses shadow-soft, p-6, no heavier shadow (section 4.1: one shadow); confirm is destructive tint and cancel ghost, both lg 44px (section 5 dialogs); discard trigger is secondary; radio focus uses primary border with ring (section 2.2 focus rule). Production changes are 9 files, 36 insertions / 19 deletions, no logic changes. Item 13 (FormField consolidation) deferred by decision.

### Issues Found
**CRITICAL**: None.

**WARNING**:
1. Oversize-at-store: store-side rejection not directly observed (see caveat).
2. The real-Postgres concurrency suite is opt-in and not in the default run or CI; it needs a disposable Neon branch and explicit owner approval each time. It was run once (3 consecutive passes), not continuously.
3. TDD slips (content-disposition, layout-360 class-name coupling) and mock-heavy data-layer unit tests, as before.
4. Archive-time tasks 5.7 and F.5 pending. Deployment (Vercel project, CRON_SECRET, BLOB_READ_WRITE_TOKEN) is outside this change by owner decision.
5. import-form load-sensitive flake did not recur; outside this change.

**SUGGESTION**:
1. Replace the TamanoBytes = 1 claim placeholder.
2. Revisit event name documento.descargado when secretary-review adds real downloads.
3. Run the integration suite in CI against an ephemeral Postgres.
4. Pathname uuid well-formedness is prefix-checked only.
5. Add the raw oversize PUT check described above.

### Verdict
PASS WITH WARNINGS. 0 CRITICAL, 5 WARNING, 5 SUGGESTION. Archive may proceed; 5.7 and F.5 are done during archive.
