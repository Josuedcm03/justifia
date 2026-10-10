```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:38ca6d8d53924c20e8f5ba73c577583d406149f8baa568b461bddf6f8d1c0321
verdict: fail
blockers: 0
critical_findings: 0
requirements: 26/26
scenarios: 84/90
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:c6313814eb09447e5a0dd77a2ef3a9e5b03b54088a363362911873a2e4004fd2
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:3e6ec7d249771a42204eb3b78cc8447fadabb9f770d57a90359dcdcb5f0c98d0
```

## Verification Report

**Change**: justification-intake
**Version**: specs justification-intake / supporting-documents / audit-log (delta), preproposal rev 6 (D1-D15)
**Mode**: Strict TDD
**HEAD**: 227946d (revision 2, rerun after commit 227946d normalized CRLF in the teammate test; no production code changed since revision 1). Revision 1 was at 187a123 (branch `feat/justification-intake`, main e89d309 merged)

> Envelope note: the validator refuses `pass` / `pass_with_warnings` while scenarios are partial (84/90), so the envelope is recorded as `fail` with `critical_findings: 0` and `blockers: 0`. Revision 2 has `npm test` exit 0 (revision 1 also failed on exit code 1). The human verdict below is PASS WITH WARNINGS.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 56 |
| Tasks complete | 51 |
| Tasks incomplete | 5 (1.5, 5.5, 5.7, F.3, F.5) |

Incomplete tasks, all known and owner-sanctioned:
- 1.5 migration apply gate: deliberate STOP (needs owner confirmation and merge-grupo-into-asignatura coordination). `drizzle/0007_justification_intake.sql` generated, not applied.
- 5.5 PARTIAL: cron `0 9 * * *` and `regions: ["cle1"]` present and tested; creating the Blob store in the same region is an owner dashboard action.
- 5.7 (roadmap note) and F.5 (rebase audit-log delta): archive-time tasks.
- F.3 design-system re-check: pending (see SUGGESTION).

### Build & Tests Execution
**Build**: PASSED (`npm run build`, exit 0; routes `/api/cron/intake-sweep`, `/api/intake/documents/[id]`, `/api/intake/upload-token`, `/requests/new`, `/requests/new/confirmation` compiled)

**Tests**: `npm test` exit 0: 2848 passed / 0 failed (143 files, all passed), 92.9 s. Single run; the import-form load-sensitive flake did not recur, so no second run was needed. The revision-1 failures were `catalog-structure.test.ts` (CRLF artifact, fixed out of scope by commit 227946d) and a load flake in `import-form.test.tsx`.

**Typecheck**: `npm run typecheck` exit 0.
**Lint**: `npx eslint src -f json`: 0 real errors, 0 warnings, 53,473 CRLF `Delete` messages filtered (known Windows gotcha in config).
**Coverage**: threshold 0, no coverage tool (config coverage.available false): not available.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | Yes | "TDD Cycle Evidence" tables for slices 1-5, fixes 5.8/5.9 and F.4 in apply-progress |
| All tasks have tests | Yes | every code task maps to a colocated test file (existence verified) |
| RED confirmed | Mostly | 2 recorded slips: `content-disposition.test.ts` written together with its module; `layout-360.test.tsx` passed first time (static guard, triangulated with a deliberately wide fixture) |
| GREEN confirmed | Yes | all intake test files pass on execution |
| Triangulation adequate | Yes | multi-case tables in all rows |
| Safety Net | Yes | modified files list baselines (117/117, 19/19, 48/48 ...) |

**TDD Compliance**: 5/6 clean, 1 with documented slips (WARNING).

### Test Layer Distribution
Unit (pure domain, db double): about 330 tests in about 30 files (`src/lib/intake`, `src/lib/data`, `src/lib/audit`, `src/db`, `src/lib/validations`, `src/i18n`). Component/integration (Testing Library, mocked actions/deps): about 160 tests in about 17 files (`src/app/(dashboard)/requests/new`, `src/components/ui`, routes under `src/app/api`). E2E: none installed. Data-layer SQL semantics (row lock, partial unique index race, rollback) run against a scripted drizzle double only; real behaviour was covered by the owner's manual Neon rehearsal.

### Assertion Quality
Spot-audit of route, actions, documentos, sweep and cron tests: no tautologies or ghost loops; assertions check values (headers, row counts, audit event shape, statement order).
- `layout-360.test.tsx` asserts utility class names (implementation coupling); documented as a static guard. WARNING.
- `src/lib/data/*.test.ts` and `actions.test.ts` are mock-heavy by design (db double, mocked deps). WARNING (layer limitation, already disclosed).

**Assertion quality**: 0 CRITICAL, 2 WARNING

### Spec Compliance Matrix
Totals: 26 requirements, 90 scenarios (justification-intake 14/52, supporting-documents 7/24, audit-log 5/14). COMPLIANT = covering test passed at runtime; PARTIAL = test passes but real concurrency, store or browser behaviour is only simulated.

| Requirement (spec) | Scenarios | Evidence (test) | Result |
|---|---|---|---|
| Intake authorization RNF-01 (ji) | non-student, other draft, unauthenticated | `actions.test.ts` (authz x6 actions, foreign id equals missing id), `page.test.tsx` guard, `permissions.test.ts` | COMPLIANT 3/3 |
| One open draft, resume D8 (ji) | first visit, resume | `solicitudes.test.ts` resume, creates empty draft owned by session user | COMPLIANT 2/2 |
| | concurrent creation | `solicitudes.test.ts` concurrent creation, the loser resumes (double; real index race = manual) | PARTIAL |
| Draft persistence and expiry D8 (ji) | activity extends, expired not resumable, sweep deletes expired only | `solicitudes.test.ts` (clock restart, 30-day cutoff, purge), `intake-sweep.test.ts` | COMPLIANT 3/3 |
| Cleanup sweep execution D8/D10 (ji) | unauthorized, one failure, pending untouched | `cron/intake-sweep/route.test.ts` (bad credentials), `intake-sweep.test.ts` | COMPLIANT 3/3 |
| Discard with confirmation RNF-12 (ji) | confirm, cancel, submitted refused | `solicitudes.test.ts` discard, `discard-dialog.test.tsx`, `actions.test.ts` | COMPLIANT 3/3 |
| Four-step stepper (ji) | navigation keeps data, review read-only with View link, edit from review, subjects need dates | `steps.test.ts`, `review-step.test.tsx`, `subjects-step.test.tsx`, `page.test.tsx` | COMPLIANT 4/4 |
| Cause and dates rules (ji) | cause outside list, end before start, window table, Managua time | `submission.test.ts`, `dates.test.ts`, `solicitud.test.ts`, `actions.test.ts` (RN-23 Managua) | COMPLIANT 4/4 |
| Submit blocking per field (ji) | required empty, no document, no subject, all errors, client bypass | `submission.test.ts`, `actions.test.ts` submit cases | COMPLIANT 5/5 |
| Subject eligibility and group display RF-04/RN-21/RN-22 (ji) | group and teacher, several, inactive, outside enrollment, class in range / not in range / mask 0, date change rejected at submit, no teacher | `enrollment.test.ts`, `schedule.test.ts`, `weekday-schedule.test.ts`, `grupo-dias.test.ts`, `eligibility.test.ts`, `subjects-step.test.tsx`, `actions.test.ts` | COMPLIANT 9/9 |
| Group choice when ambiguous (ji) | ambiguous, missing choice, other subject | `eligibility.test.ts`, `subjects-step.test.tsx`, `actions.test.ts` | COMPLIANT 3/3 |
| Submission transition and timestamps (ji) | successful, client timestamp ignored, failure rolls back | `solicitudes.test.ts` submit cases, `actions.test.ts` | COMPLIANT 3/3 |
| | double submit | `solicitudes.test.ts` conflict, `actions.test.ts` (guarded UPDATE asserted in SQL; real race = manual) | PARTIAL |
| Student snapshot D9 (ji) | stored, account change afterwards, forged | `solicitudes.test.ts` snapshot, `actions.test.ts` forged payload | COMPLIANT 3/3 |
| Drafts excluded from listings D7 (ji) | hidden from lists, not readable by id | `states.test.ts` (VISIBLE_STATES excludes borrador) | COMPLIANT 2/2 |
| Usability 360 px and i18n (ji) | no horizontal scroll | `layout-360.test.tsx` static guard plus owner manual 360 px | PARTIAL |
| | actions reachable, translation keys | `layout-360.test.tsx`, `intake-messages.test.ts` (es/en parity, 26 error codes) | COMPLIANT 2/2 |
| Upload authorization and limits (sd) | own draft, denied | `upload-token/route.test.ts` | COMPLIANT 2/2 |
| | oversize or wrong type at store | token payload asserted; enforcement belongs to the SDK and store (owner manual: over 10 MB rejected) | PARTIAL |
| Several documents per request (sd) | two docs, remove | `documentos.test.ts`, `documents-step.test.tsx` | COMPLIANT 2/2 |
| At most five documents D12 (sd) | 6th at token, pendiente counts, removal frees slot | `upload-token/route.test.ts`, `documentos.test.ts`, `documents-step.test.tsx` | COMPLIANT 3/3 |
| | concurrent finalize beyond cap | `documentos.test.ts` under concurrent finalizes (double; row lock = manual 5-doc cap) | PARTIAL |
| Finalize with magic-byte validation D3 (sd) | valid table, spoofed, other rejections, unvalidated never referenced, reason shown | `signature.test.ts`, `documentos.test.ts`, `documents-step.test.tsx` | COMPLIANT 5/5 |
| Authenticated inline view (sd) | owner inline, View link, other denied, audited, failed not audited | `documents/[id]/route.test.ts`, `documents-step.test.tsx`, `review-step.test.tsx`, `content-disposition.test.ts` | COMPLIANT 5/5 |
| | no public URL | response asserted to expose no location; DB and page inspection not automated (adapter uses private access) | PARTIAL |
| Orphan blob cleanup (sd) | old removed, fresh kept, referenced kept | `intake-sweep.test.ts` | COMPLIANT 3/3 |
| Storage behind a port (sd) | fake store | `fakes.test.ts`, `documentos.test.ts`, `vercel-blob-store.test.ts` | COMPLIANT 1/1 |
| Closed set of events (al) | action to entity table, existing unchanged | `events.test.ts`, `types.test.ts` | COMPLIANT 2/2 |
| One audit row per operation, same tx (al) | successful ops, no-row ops, audit failure aborts, actor from session | `documentos.test.ts`, `solicitudes.test.ts`, `actions.test.ts` | COMPLIANT 4/4 |
| Draft operations not audited D14 (al) | lifecycle leaves no row | `solicitudes.test.ts`, `intake-sweep.test.ts` (writes none) | COMPLIANT 1/1 |
| Every download audited D13 (al) | successful, two downloads, no row on denial, audit failure blocks | `documents/[id]/route.test.ts` | COMPLIANT 4/4 |
| Payload minimisation RNF-02 (al) | submit, rejection, leak check | `events.test.ts` leak scans | COMPLIANT 3/3 |

**Compliance summary**: 84/90 scenarios compliant, 6 PARTIAL (concurrent creation, double submit, concurrent finalize, oversize at store, 360 px scroll, no public URL), 0 FAILING, 0 UNTESTED. The owner manual rehearsal on a Neon branch (2026-10-09/10) covered uploads (valid, spoofed, over 10 MB, 5-doc cap), view link, resume, dialogs, submit with snapshot, 360 px, cron 401/200 and the audit rows; concurrency races were not exercised.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Authorization re-check in every action and route | Implemented | all 5 actions call `requireRole` with `rolesSolicitantes`; upload-token checks session, flagged account, `canFileRequests`, draft ownership and prefix; view route checks session, flagged account, `canViewDocument` (owner); actions take no draft id |
| Owner-only access, identical denial | Implemented | unknown, malformed and foreign ids all return `404 not_found` with no bytes |
| Blob private | Implemented | private access on put and get in the adapter; no public URL exposed |
| Token limits | Implemented | PDF/PNG/JPEG, 10,485,760 bytes, TTL, no random suffix, no overwrite, draft prefix, cap 5 |
| Magic-byte validation | Implemented | finalize reads stored bytes (`signature.ts`); file deleted on failure |
| Inline view headers | Implemented | `inline` with RFC 5987 name, `CSP: sandbox`, `nosniff`, `private, no-store`, verified Content-Type |
| Audit before bytes, failure blocks | Implemented | order: stream, audit, response; audit failure cancels stream and returns 500 |
| Cron Bearer constant time, fail closed | Implemented | SHA-256 digests with `timingSafeEqual`; missing secret rejects; GET only; counts-only log; generic 500 |
| No secrets in code | Implemented | env vars via `src/env.ts`; `.env.example` holds empty placeholders; `.env` and `.env.local` are gitignored |
| Audit rules D13/D14 | Implemented | 5 builders; draft ops and sweeps write no row; cascaded deletes unaudited; payloads minimal |
| Migration | Implemented, NOT applied | `0007_justification_intake` journal `when` 1791672226324 is after the last production value 1791423623880 |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1/D2 direct client upload via token route | Yes | `onUploadCompleted` deliberately omitted (SDK throws on localhost); documented, safe |
| D3 server-side magic bytes | Yes | |
| D5 schedule port, weekday adapter (F.4) | Yes | `permissive-schedule` kept only as the `fakes.ts` double |
| D7 drafts hidden (`VISIBLE_STATES`) | Yes | |
| D8 one draft, 30-day expiry, daily sweep | Yes | |
| D10/D11 cron, region, pool `max:3`, `prepare:false` | Yes | region `cle1`; Blob region is an owner action |
| D12 five documents, row-lock cap | Yes | double-tested only |
| D13/D14 audit | Yes | |
| D15 min one subject, no-teacher label, owner-only reads | Yes | |
| Claim row `TamanoBytes = 1` placeholder | Deviation | documented in `documentos.ts`; replaced on finalize, swept if abandoned (SUGGESTION) |
| Actions take no draft id (identity from session) | Yes | stronger than the design |

### Issues Found
**CRITICAL**: None for this change.

**WARNING**:
1. Resolved since revision 1: `npm test` now exits 0 (2848/2848). The `import-form` flake is load-sensitive and may recur on slow machines; it is outside this change.
2. Migration 0007 is not applied (task 1.5). The feature cannot run against the database until the owner applies it, with a `drizzle.__drizzle_migrations` row count before and after, coordinated with merge-grupo-into-asignatura (drops Grupo; the new FKs target Grupo).
3. Task 5.5 partial: the Blob store in the same region as Neon, and `CRON_SECRET` / `BLOB_READ_WRITE_TOKEN` in Vercel, are owner dashboard actions.
4. Six scenarios PARTIAL (race conditions and store or browser behaviour simulated by doubles or static guards; the manual rehearsal did not exercise concurrency). Data-layer tests do not exercise real row locks or the partial unique index.
5. TDD slips: `content-disposition.test.ts` and `layout-360.test.tsx` were never seen failing first; `layout-360` asserts class names.
6. Archive-time tasks pending: 5.7 (roadmap) and F.5 (rebase the audit-log delta onto `openspec/specs/audit-log/spec.md`; its base specs are not archived).

**SUGGESTION**:
1. F.3: re-check the UI against `docs/design-system.md` now that it is on main.
2. Replace the `TamanoBytes = 1` claim placeholder (nullable column or separate state).
3. The event name `documento.descargado` records a read (inline view); revisit when `secretary-review` adds real downloads.
4. Run the data-layer tests against a real Postgres (Neon branch or container) in CI to cover lock and index semantics.
5. Pathname well-formedness (uuid shape) is only prefix-checked; acceptable under the ownership prefix.

### Verdict
PASS WITH WARNINGS. 0 CRITICAL, 6 WARNING, 5 SUGGESTION. Machine envelope: `fail`, solely because 6 scenarios are PARTIAL (concurrency, store and browser behaviour covered by doubles or static guards, not a failing check). Open tasks 1.5, 5.5 and F.3 are owner actions; 5.7 and F.5 are archive-time work. Archive may proceed once the owner acknowledges the migration-apply sequencing and the archive-time tasks are done.
