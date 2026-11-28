```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:4fa0700fd8659796fe236fdb44adf54befd603c33c4331536d88ab111f982168
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 31/31
scenarios: 183/183
test_command: DATABASE_URL=postgres://u:p@localhost:5432/x npm test
test_exit_code: 0
test_output_hash: sha256:7be0a2444bed9b95b558153a9683ec5d52d0742e48a6f3e8fe13b4ec483c7a59
build_command: DATABASE_URL=postgres://u:p@localhost:5432/x AUTH_SECRET=throwaway-build-secret-0123456789abcdef npm run build
build_exit_code: 0
build_output_hash: sha256:de4ecf8ff148584fbefc3e340b5e84189be093e6ea0a4facb027aec75e4aacdb
```

## Verification Report

**Change**: normative-parameters (roadmap row 8; RNF-14)
**Version**: N/A
**Mode**: Strict TDD (vitest); task 15.1 whole-change verification
**Tracker tip**: `feat/normative-parameters` at `8e0b1ef` (10 slices, PRs 170 to 180, fix PR 181, evidence PR 182 merged). `origin/main` is `a5b057f` and is an ancestor of the tip, so the tracker contains it. `evidence_revision` is the SHA-256 of the tip commit id.

## Verdict: PASS WITH WARNINGS

0 CRITICAL, 7 WARNING, 3 SUGGESTION. Every gate is green, every requirement has code and a passing test or recorded Phase 14 evidence, the cut items are absent, the teammate-facing exports are unchanged and 0017 is the only migration. The warnings are bookkeeping, evidence-scope and pre-existing items; none blocks the merge gate.

## Gate results (task 15.1, run on the tracker tip)

| Gate | Command | Result |
|---|---|---|
| Full unit suite | `DATABASE_URL=postgres://u:p@localhost:5432/x npm test` | exit 0; 415 test files passed (415); 11641 tests passed (11641); 0 failed; duration 323 s. The Postgres integration files are not part of this run (they need the INTEGRATION env). |
| Route types | `npx next typegen` | exit 0, "Types generated successfully" |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0, no diagnostics |
| Lint | `npx eslint --rule '{"prettier/prettier":["error",{"endOfLine":"auto"}]}' src` | exit 0; 0 errors, 1 warning (pre-existing, see W5) |
| Build | `DATABASE_URL=postgres://u:p@localhost:5432/x AUTH_SECRET=throwaway-build-secret-0123456789abcdef npm run build` | exit 0; "Compiled successfully"; `/parameters` listed as a dynamic route |

Coverage tooling: not configured for this change (no threshold); not measured.

## Completeness

| Metric | Value |
|---|---|
| Tasks total | 128 checkbox tasks |
| Tasks complete | 106 |
| Tasks incomplete | 22 (all process or post-verify, none is code; see W1) |
| Delta requirements (headings) | 31 (normative-parameters 17, audit-log 3, backoffice-shell 1, justification-intake 2, request-review 1, supporting-documents 3, validation-signals 4) |
| Delta scenarios (headings) | 183 (66 + 15 + 9 + 21 + 18 + 26 + 28); 23 of them are marked [PG] |

Unchecked tasks: 2.8, 3.8, 5.8, 6.8, 7.11, 8.8, 9.13, 10.15 (open-the-PR tasks of slices already merged, see W1); 15.0 (satisfied, see W1); 15.1 (this report); 15.2, 15.3, 15.5, 15.6, 15.7, 15.8 and 16.0 to 16.5 (merge-gate, deploy and archive steps that follow verification by design and need the owner's explicit yes).

## Scope-cut and compatibility checks

| Check | Result |
|---|---|
| Migrations: only 0017 added | `git diff origin/main HEAD` over `drizzle/` adds exactly `0017_normative_parameters.sql`, `meta/0017_snapshot.json` and one `_journal.json` entry; no existing `.sql` modified; no 0018 on disk. `0017` is free on `origin/main` (`git ls-tree origin/main drizzle/`). Journal `when` 1795817587621 is above 0016 (1795216905153) and last. |
| 0017 content | One `CREATE TABLE "ParametroNormativo"` (`Id`, `Clave` varchar 60, `Valor` jsonb, `VigenteDesde` date, unique `Clave`+`VigenteDesde`) and one `INSERT ... ON CONFLICT DO NOTHING` with the nine seed keys dated `2026-01-01`. Additive, no alter or drop. |
| `schema.ts` check literal | `CK_Documento_Tamano` keeps the same SQL with the literal `10485760` (no schema change, no migration); `size-ceiling.test.ts` pins the registry maximum to it. |
| `SignalParams`, `DEFAULT_SIGNAL_PARAMS`, `issuer.ts` | `git diff origin/main HEAD -- src/lib/signals/params.ts src/lib/signals/issuer.ts src/lib/signals/document-type-causes.ts`: only a 5-line comment edit in `params.ts`; no code line, type, export or value changed; `issuer.ts` and `document-type-causes.ts` byte-identical. |
| Cut 1 (no 0018, no 25 MiB ceiling) | `rg` over `src`: no `DOCUMENT_BYTES_CEILING`, no `26214400`; `MAX_DOCUMENT_BYTES` only inside the structural test asserting it is gone. The 25 MiB `MAX_REMISSION_ATTACHMENT_BYTES` is the unrelated, pre-existing mail limit (identical on `origin/main`). |
| Cut 5 (no confirm-every-save) | No `confirm-changes`, no `unconfirmed` outcome in `src`; the only `confirmado` hits are a test asserting a stray marker is never read; the only confirmation is `deactivate-cause-dialog.tsx` built on the shared alert dialog. |
| Cut 6 (no extra display) | No default badge, range-in-words, per-year counts, current-year warning or locked degraded forms in the page, forms or catalogs (`page.test.tsx` asserts no alert and no lock on fallback). |
| Cuts 2, 7, 8 | No per-family PG-2 cases in the Postgres suite (only PG-1, PG-3, PG-4, PG-5); no 360/320 px or 44 px assertions in the parameters tests; no mutation-check scaffolding after slice 4. |
| Old constants removed | `BUSINESS_DAYS_TO_REMIT`, `LATE_WINDOW_DAYS`, `MAX_DOCUMENT_BYTES` and `src/lib/intake/calendar.ts` are gone (asserted by `no-constants.test.ts` and `business-days.test.ts`). No `unstable_cache`, no `use cache`, no module-level store in `src/lib/parameters`. |
| Edit footprint | `git diff origin/main HEAD --name-only` outside `openspec/`, `docs/`, `.engram/` is only `src/**`, `drizzle/**`, `i18n/es.json`, `i18n/en.json`. |
| Working tree | Clean apart from untracked `.engram/chunks/*` (never staged by rule). |

## Spec Compliance Matrix (by requirement; scenario groups mapped to tests)

Legend: UT = passing in the 11641-test run above; PG = proven by the Postgres suite recorded in `apply-progress.md` (35/35 on `params-it` at `7b75e3a`, not re-run here, see W2); ST = owner system test ST-1 to ST-7 recorded in `apply-progress.md` (see W3).

| Requirement | Scenarios | Evidence | Result |
|---|---|---|---|
| NP-1 table is Table D19, additive | 4 | UT `src/db/migration-normative-parameters.test.ts`; PG-1 (one row per key and day, key length 60/61) | COMPLIANT |
| NP-2 registry, ranges, size 1 to 10, alert below remission | 6 | UT `parameters/registry.test.ts`, `parameters/size-ceiling.test.ts`, `parameters/write.test.ts` | COMPLIANT |
| NP-3 effective today, history kept | 4 | UT `parameters/write.test.ts` (Managua date, upsert text, no DELETE); PG-3 write part | COMPLIANT |
| NP-4 per-key fallback, fail-soft | 4 | UT `parameters/loader.test.ts`; PG-3 read part (per-key table, unknown key, latest not after today) | COMPLIANT (see W4) |
| NP-5 per request, no cross-request cache | 3 | UT `loader.test.ts` (one read per render, two per two renders), `no-constants.test.ts`; PG next-read case; ST-2 to ST-6 | COMPLIANT |
| NP-6 secretaria only, guard first | 4 | UT `auth/permissions.test.ts`, `auth/parameter-access.test.ts`, access matrix (`src/test/access/matrix-table.ts` actions and page rows), `parameters/page.test.tsx`; ST-1 | COMPLIANT |
| NP-7 one screen, value in force, errors with range | 4 | UT `parameters/scalars-form.test.tsx`, `parameters/actions.test.ts`, `parameters/page.test.tsx`; ST-1, ST-2, ST-6 | COMPLIANT |
| NP-8 deactivation asks first | 4 | UT `parameters/causes-section.test.tsx` (dialog names the cause, cancel calls no action and keeps values, other saves direct); ST-4 | COMPLIANT |
| NP-9 one guarded transaction, busy, unchanged | 5 | UT `parameters/actions.test.ts`, `write.test.ts`; PG-4 (two keys, audit failure rolls back, busy) | COMPLIANT |
| NP-10 calendar as data | 6 | UT `parameters/derive.test.ts` (`coversYear`), `lib/data/revision-queue.test.ts`, `actions.test.ts` (invalid entries), `calendar-section.test.tsx`; ST-3 | COMPLIANT |
| NP-11 causes | 6 | UT `intake/causes.test.ts`, `validations/solicitud.test.ts`, `data/signals.test.ts` (rest rules ignore the flag), `causes-section.test.tsx`, `actions.test.ts`; ST-4 | COMPLIANT |
| NP-12 type-to-cause map | 3 | UT `registry.test.ts`, `actions.test.ts`, `type-causes-section.test.tsx`, `data/signals.test.ts`; ST-4 | COMPLIANT |
| NP-13 effect on existing requests | 5 | UT `revision-queue.test.ts`, `solicitud-correction.test.ts`, `upload-token/route.test.ts` (an earlier token keeps the limit it carries); PG-5 (stored document and `PlazoInicioEn`) | COMPLIANT |
| NP-14 proven without a deploy | 2 | ST-1 to ST-7 recorded with build `7b75e3a` (see W3); PG per-key fallback | COMPLIANT (system run) |
| NP-15 constants only as defaults | 2 | UT `parameters/no-constants.test.ts` (structural scans, with negative fixtures) | COMPLIANT |
| NP-16 seeds only | 1 | UT migration test (seed values parsed from the SQL equal the registry defaults); PG-1 seeds read back; production count is task 15.5 | COMPLIANT |
| NP-17 copy and accessibility | 3 | UT `src/i18n/parameters-parity.test.ts`, `catalog-parity.test.ts`, `scalars-form.test.tsx`, `page.test.tsx` (one h1, no skipped level, alert role on errors) | COMPLIANT |
| NP-AUD-1 closed set | 4 | UT `audit/types.test.ts` (50 actions, `parametro.actualizado` last, entity `Parametro`), `audit/events.test.ts` | COMPLIANT |
| NP-AUD-2 one row per key, same transaction | 5 | UT `actions.test.ts`, `write.test.ts`; PG-4 | COMPLIANT |
| NP-AUD-3 closed payload, no personal data | 6 | UT `audit/events.test.ts`, `catalog/audit-leak.test.ts`; PG sentinel case; ST-7 (12 rows, keys exactly antes, clave, despues) | COMPLIANT |
| BS-NAV-1 sidebar entry | 9 | UT `lib/navigation.test.ts`, `components/app-sidebar.test.tsx` (entry for secretaria only, label per locale, active marker) | COMPLIANT |
| RR-QUEUE ordering and alert | 18 | UT `intake/business-days.test.ts`, `data/revision-queue.test.ts`, `review/page.test.tsx`, review detail `page.test.tsx`, `coordination/actions.test.ts`; ST-2, ST-3 | COMPLIANT |
| VS-RN07 late presentation | 8 | UT `signals/timing.test.ts`, `signals/evaluate.test.ts`, `data/signals.test.ts`; ST-2 | COMPLIANT |
| VS-RN14 recurrence | 13 | UT `signals/evaluate.test.ts`, `data/signals.test.ts` (threshold 2 flips the second request); PG fallback; ST-5 | COMPLIANT |
| VS-MD15 table behind a seam (two headings in the delta) | 7 | UT `data/signals.test.ts`, `signals/evaluate.test.ts`, `parameters/no-constants.test.ts`; ST-4 | COMPLIANT |
| JI-CAUSE cause and dates rules | 12 | UT `intake/dates.test.ts`, `intake/causes.test.ts`, `validations/solicitud.test.ts`, `requests/new/step-actions.test.ts`, `cause-dates-step.test.tsx`, `correct/page.test.tsx`; PG fallback; ST-2, ST-4 | COMPLIANT |
| JI-SUBMIT submit blocking | 9 | UT `intake/submission.test.ts`, `requests/new/actions.test.ts` (reads the parameters once for the whole submit) | COMPLIANT |
| SD-UPLOAD upload authorization and limits | 7 | UT `upload-token/route.test.ts`, `special-format-token/route.test.ts` | COMPLIANT |
| SD-FINALIZE finalize with the limit | 13 | UT `data/documentos.test.ts` (6 MiB vs 5, 4 MiB accepted, boundary table), `data/special-format.test.ts`, review detail `actions.test.ts` | COMPLIANT |
| SD-LIMIT every path and the client | 6 | UT `documents-step.test.tsx`, `special-format-upload.test.tsx`, review detail `page.test.tsx`, `size-ceiling.test.ts`, `no-constants.test.ts`; PG-5; ST-6 | COMPLIANT |

Compliance summary: 183/183 scenarios have a passing covering unit test, a recorded Postgres case or recorded system-test evidence; 0 failing, 0 untested. The scenario-to-test mapping was checked by task traceability (every RED task names its files and all of them exist on disk) plus targeted checks of the least obvious scenarios (token keeps its limit, cancel keeps values and returns focus, secretaria with no Facultad, rest rules ignore the active flag, the otro row has no editable cell, audit-leak sentinel). It was not a line-by-line mapping of all 183 headings.

## Correctness (static evidence)

| Area | Status | Notes |
|---|---|---|
| Loader (`src/lib/parameters/loader.ts`) | Implemented | One `selectDistinctOn("Clave")` with `VigenteDesde <= today`, per-key `safeParse` through `resolveParameters`, never falls back to an older row, `degraded` on a failed read, logs the key and a code only, React `cache()` only. |
| Write path (`write.ts`) | Implemented | Reads the effective values under the lock, re-validates each change, cross-key rule on merged values, drops equal values by canonical JSON, one upsert per changed key dated today (Managua), no DELETE. |
| Guard (`parameter-access.ts`) | Implemented | `requireRole(...rolesQueGestionanParametros)` first, secretaria only, subject validated, no database read. Used by the page and by `actions.ts`. |
| Actions | Implemented | Four actions through `withCatalogWrite` with `parameterWriteEvents`, `revalidatePath` after the write, closed field set, actor from the session. |
| Consumers | Implemented | The loader is read at the page, action and route boundary only (14 non-test consumers); both upload-token routes use `maxDocumentBytesOf(values)`; pure rules take the value as a required argument (design A12). |
| Page and navigation | Implemented | `/parameters` with the four sections, menu entry last child of the administration group, matrix rows. |
| Audit | Implemented | `parametro.actualizado` appended last, entity `Parametro`, payload with clave, antes and despues, calendar reduced to ISO dates. |

## Coherence (design)

| Decision | Followed? | Notes |
|---|---|---|
| A1 table per D19, one row per key and date | Yes | Exactly four columns plus the unique. |
| A2 closed registry | Yes | `PARAMETER_KEYS` closed tuple; unknown keys ignored by the loader and refused by the write. |
| A3 single `DISTINCT ON` read, per-key validation | Yes | |
| A4 React `cache()` only | Yes | Structural scan enforces it. |
| A5 seeds dated `2026-01-01`, `ON CONFLICT DO NOTHING` | Yes | |
| A6 upsert write | Yes | |
| A7 `withCatalogWrite` reused unchanged | Yes | Lock key and busy mapping untouched. |
| A8 one audit action, one entity type | Yes | |
| A9 `antes` is the effective value; equal value is `unchanged` | Yes | |
| A10 `SignalParams`, `DEFAULT_SIGNAL_PARAMS`, `issuer.ts` stable | Yes | Verified against `origin/main` above. |
| A11 `loadSignals` reads the loader | Yes | |
| A12 required arguments, no defaults | Yes | `LATE_WINDOW_DAYS` and `BUSINESS_DAYS_TO_REMIT` removed. |
| A13 copy takes values | Yes | `limits` prop, days and size placeholders. |
| A14 corrections ignore RN-23 and the active-cause rule | Yes | `filingWindow: false` in the correction path. |
| A15 derived calendar coverage | Yes | |
| A16 cross-key alert rule under the lock | Yes | |
| A17 removed, A18 revised, A19 range 1 to 10 pinned to the check | Yes | `size-ceiling.test.ts`. |
| Deviations recorded (shared `parameter-form.tsx`, dashboard shortcut for the new entry, number inputs) | Accepted | Recorded in `apply-progress.md`, Slice 10 "Deviations". |

## Issues Found

**CRITICAL**: None.

**WARNING**:

- W1. Task bookkeeping is stale. The open-the-PR tasks 2.8, 3.8, 5.8, 6.8, 7.11, 8.8, 9.13 and 10.15 are unchecked, although git history shows PRs 170 to 180 merged into the tracker in order with merge commits (`git log --merges origin/main..HEAD`), and task 15.0 is satisfied in fact (all 10 slices merged, tracker contains `origin/main`, 0017 is the only migration and its number is free). Tick them before archive. Task 15.1 is ticked by the orchestrator after this report.
- W2. The 23 `[PG]` scenarios (NP-1, NP-3, NP-4, NP-5, NP-9, NP-13, NP-14, NP-16, NP-AUD-2, NP-AUD-3, VS-RN14, JI-CAUSE, SD-LIMIT) were not executed in this verification: the rules forbid any database access, and `npm test` skips them by design. Their proof is the Phase 14 run on `params-it` (normative-parameters suite 35/35 after PR 181; whole integration suite 273/274 with only the known `queue-index` baseline failure) at `7b75e3a`. The tip `8e0b1ef` differs from `7b75e3a` by two openspec files only (`git diff --name-only 7b75e3a HEAD`), so the evidence applies to the tip code.
- W3. The system test has accepted gaps, all recorded with the owner's acceptance: ST-2 RN-23 (a new draft with an old end date refused, a resubmission accepted) was not run in the preview because the draft and correction steps need Blob storage; the refusal is covered by the slice 5 unit tests. ST-6 special-format upload was not reachable (no approved request marked for it); its component and route are unit-tested. ST-1 direct-request denial rests on the access-matrix test, and the "2026-02-30" refusal of ST-3 is only reachable by a direct POST (native date input); both are unit-tested.
- W4. Loader behavior on a numeric-looking string: the database driver decodes a stored JSON string of digits (for example "3") as the number 3, so such a row reads as that value instead of falling back. Found in Phase 14, no product effect (the write path never stores a string in a scalar), owner decision recorded, spec NP-4 carries the note, fixture changed to "tres". The loader is unchanged.
- W5. ESLint reports one warning, `SidebarGroupLabel` unused in `src/components/app-sidebar.tsx`. It is pre-existing: the file is identical to `origin/main` (the label is commented out upstream), so it is not introduced by this change. Exit code 0.
- W6. Size overruns, all owner-approved and recorded: slice 2a 1184 lines (split into 2a and 2b), slice 4 1108, slice 8 1199, slice 9 1808 (above the pre-approved 1500), slice 10 1686 (above the pre-approved 1500). Review load was high; nothing in the evidence suggests unreviewed content.
- W7. Production gate items remain open by design and block the merge to `main` until done: migration 0017 applied to production with the owner's explicit yes (15.3), the read-only count of 9 rows (15.5), the owner's yes to open and merge the tracker PR (15.6). Merging before 0017 keeps reads on defaults but makes every save fail.

**SUGGESTION**:

- S1. The ST-1 (coordinacion direct request) and ST-2 (RN-23) evidence could be repeated in a preview deployment with Blob configured, if the owner wants the thesis table to show those steps run end to end.
- S2. Screenshots from `params-it` inherit rows from `dev-arnia` that may carry real names; crop or check them before using them as thesis evidence (already noted in `apply-progress.md`).
- S3. Task 4.5 still says the staleness test "becomes the coverage notice of slice 11"; the note under Phase 4 already corrects it, but a later tidy of `tasks.md` could drop the stale phrase before archive.

## Verdict

PASS WITH WARNINGS. All four gates are green on the tracker tip (415 files, 11641 tests, typecheck, eslint src with 0 errors, build), every requirement and scenario of the seven deltas is covered by a passing test or by the recorded Postgres and system-test evidence, the eight scope cuts are not half-built, the teammate-facing exports are unchanged in shape and value, and 0017 is the only migration (no 0018). Safe to proceed to task 15.2 and the owner-gated steps of Phase 15.
