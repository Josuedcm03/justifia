# Tasks: Justification Intake

## Review Workload Forecast

> **Budget rule (owner decision, 2026-10-07):** strict TDD makes tests more than half of every diff, so the 800-line review budget counts **production code only** from slice 3 onward. Tests and test support stay in the same PR as the code they cover and are reported separately. Slices 1 (1,413 lines) and 2 (2,423 lines) shipped under owner-accepted `size:exception`.

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,800 total (range 2,500-3,200) |
| 400-line budget risk | High |
| 800-line budget risk | Medium (slice 4 near the limit; others comfortably inside) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5 |
| Delivery strategy | ask-on-risk (review_budget_lines=800) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
800-line budget risk: Medium

Chain strategy (updated 2026-10-08): single branch per change. Slices are commits on `feat/justification-intake`; the per-slice branches and PRs #7-#11 were consolidated by fast-forward and closed (#7 shows as merged because its commits reached the base). One final PR to `main`. Original note: feature-branch-chain. Tracker branch `feat/justification-intake` is cut from `main`; PR 1 targets the tracker, each later PR targets the previous slice branch, and only the tracker merges to `main` (one final PR). Migration-number conflicts with catalog-management are resolved at that final merge. Per-slice estimate: S1 ~500, S2 ~500, S3 ~600, S4 ~750, S5 ~450.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema, generated migration, pure domain, ports | PR 1 | `npx vitest run src/lib/intake src/db` | N/A: no runtime surface; migration SQL read by test | Revert schema, `drizzle/*_justification_intake.sql`, `src/lib/intake/` (unapplied migration) |
| 2 | Blob adapter, token route, finalize, download | PR 2 | `npx vitest run src/lib/intake/adapters src/app/api src/lib/data/documentos` | Dev Blob store: upload spoofed + valid file via route | Revert adapter, routes, env, dependency |
| 3 | Draft/submit actions, enrollment, audit, permissions | PR 3 | `npx vitest run src/lib/data src/lib/audit src/lib/auth src/app/(dashboard)/requests/new/actions.test.ts` | N/A: no UI yet; actions covered by mocked deps | Revert actions, data layer, audit builders, permissions |
| 4 | Stepper steps 1-3, UI primitives, i18n, sidebar | PR 4 | `npx vitest run src/components/ui src/app/(dashboard)/requests/new` | `npm run dev`, walk steps 1-3 as student | Revert UI files and i18n keys |
| 5 | Review step, dialogs, cron sweep, 360 px | PR 5 | `npx vitest run src/app/api/cron src/app/(dashboard)/requests/new` | `npm run dev` at 360 px; call cron with Bearer | Revert review UI, cron route, `vercel.json` |

## Phase 1: Slice 1 - Schema, domain, ports (PR 1)

- [x] 1.1 Branch slice 1 from `feat/justification-intake` (up to date with `main`); note that `catalog-management` owns `0005`/`0006` off-main, so the number generated here is provisional (design: Compatibility with catalog-management)
- [x] 1.2 RED: `src/db/migration-justification-intake.test.ts` (locates the SQL by the `justification_intake` name, not by number) asserts CHECKs, partial unique `UX_Solicitud_Borrador`, snapshot CHECK, doc cap columns (RN-01, RN-05, D7, D8)
- [x] 1.3 Add `Solicitud`, `SolicitudAsignatura`, `DocumentoRespaldo` to `src/db/schema.ts`
- [x] 1.4 Run `npm run db:generate -- --name justification_intake` (generate only)
- [ ] 1.5 STOP: ask user for explicit confirmation before any `drizzle-kit migrate`/`push`; do not apply unprompted. **Status: AWAITING USER CONFIRMATION** (migration `drizzle/0005_justification_intake.sql` generated, NOT applied; stays unchecked until the user decides)
- [x] 1.6 RED+GREEN: `src/lib/intake/signature.test.ts` then `signature.ts` (PDF/PNG/JPEG magic bytes; RN-04, D3)
- [x] 1.7 RED+GREEN: `src/lib/intake/dates.test.ts` then `dates.ts` (Managua today, UTC crossing, day 30/31; RN-05, RN-23)
- [x] 1.8 RED+GREEN: `causes.ts`, `limits.ts`, `pathnames.ts` with tests (RN-01, RN-04, D4, D12; ownership prefix check)
- [x] 1.9 RED+GREEN: `submission.test.ts` then `submission.ts` `validateSubmission`, all errors at once (RF-03, RN-01..RN-05, RN-23, D15)
- [x] 1.10 RED+GREEN: `eligibility.ts` ambiguity/group choice with tests (RF-04, RN-21)
- [x] 1.11 RED+GREEN: `states.ts` `VISIBLE_STATES` excludes `borrador`, with test (D7)
- [x] 1.12 Add `src/lib/intake/ports.ts` (`DocumentStore`, `GroupScheduleProvider`) and `adapters/permissive-schedule.ts` + test (D5)
- [x] 1.13 RED+GREEN: `src/db/index.ts` prod pool `max:3`, `prepare:false`; test config branch (D11); verify against Neon docs (open question)

## Phase 2: Slice 2 - Blob adapter and routes (PR 2)

- [x] 2.1 Add `@vercel/blob` >= 2.3 to `package.json`; add `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET` to `src/env.ts` and `.env.example` (D1, D10). (`.env.example` placeholders added by the owner)
- [x] 2.2 RED+GREEN: `adapters/vercel-blob-store.ts` (`server-only`, private access) with mocked SDK tests (RNF-02)
- [x] 2.3 RED+GREEN: `src/lib/intake/deps.ts` `getIntakeDeps()` with fakes helper for tests (supporting-documents: Storage behind a port)
- [x] 2.4 RED: `upload-token/route.test.ts` for 401, non-student, foreign/expired draft, 6th doc `too_many_documents`, limits payload (RN-04, D2, D12, RNF-01)
- [x] 2.5 GREEN: `src/app/api/intake/upload-token/route.ts` via `handleUpload`; `onUploadCompleted` no-op
- [x] 2.6 RED: `src/lib/data/documentos.test.ts` for finalize claim, concurrent cap, reasons table, delete on mismatch (RN-04, D3, D12)
- [x] 2.7 GREEN: `src/lib/data/documentos.ts` finalize (pendiente claim, sniff, validate), remove
- [x] 2.8 RED: `documents/[id]/route.test.ts` for 401/404 identical denial, headers, nosniff, no bytes on failure (RNF-01, RNF-02, D15)
- [x] 2.9 GREEN: `src/app/api/intake/documents/[id]/route.ts` streaming download (audit hook wired here in slice 2 instead of slice 3)

## Phase 3: Slice 3 - Actions, enrollment, audit, permissions (PR 3)

- [x] 3.1 RED+GREEN: `permissions.ts` `rolesSolicitantes`, `canFileRequests`, `canViewDocument` with tests (RNF-01, D15)
- [x] 3.2 RED+GREEN: `src/lib/audit/events.ts` five builders and `AuditEntityType` additions; payload minimisation + leak tests (RNF-06, RNF-02, D13, D14). Four document builders came in slice 2; `solicitudPresentadaEvent` added in slice 3
- [x] 3.3 RED+GREEN: `src/lib/data/enrollment.ts` active groups, teacher label (RF-04, RN-21, D15)
- [x] 3.4 RED: `solicitudes.test.ts` for one-draft concurrency, resume, 30-day expiry, discard, no audit rows (D8, D14)
- [x] 3.5 GREEN: `src/lib/data/solicitudes.ts` draft CRUD setting `ActualizadoEn` explicitly
- [x] 3.6 RED+GREEN: `src/lib/validations/solicitud.ts` zod step schemas with i18n-key messages (RF-03)
- [x] 3.7 RED: `actions.test.ts` for authz, forged snapshot/timestamp, double submit, audit rollback, port re-check (RN-02, RN-06, RF-04)
- [x] 3.8 GREEN: `src/app/(dashboard)/requests/new/actions.ts` (save step, finalize, remove, discard, `submitRequest`)
- [x] 3.9 Wire `documento.descargado` insert before bytes in download route; extend its tests (D13)

## Phase 4: Slice 4 - Steps 1-3, primitives, i18n (PR 4)

- [x] 4.1 Add `alert-dialog`, `radio-group`, `stepper` in `src/components/ui/` with tests; reuse `catalog-management`'s `Checkbox` if it is on `main`, else create it with the same API (RNF-11, tokens from the current "Academic Governance" design system, no lime)
- [x] 4.2 RED+GREEN: `page.tsx` guard, step from searchParams, fail-soft draft load (A7, RNF-01)
- [x] 4.3 RED+GREEN: `intake-stepper.tsx` with `aria-current="step"` and the primary-underline active step, "Step n of 4" at 360 px; layout per the Stitch "nueva solicitud" reference (RF-01, RNF-11)
- [x] 4.4 RED+GREEN: `cause-dates-step.tsx` field errors (RN-01, RN-05, RN-23)
- [x] 4.5 RED+GREEN: `subjects-step.tsx` radio for ambiguous groups, no-teacher label (RF-04, D15)
- [x] 4.6 RED+GREEN: `documents-step.tsx` `upload()`, reason messages, remove (RF-02, RN-03, RN-04, D12)
- [x] 4.7 Add `intake.*`, `nav.newRequest` to `i18n/es.json` and `i18n/en.json`; key-parity test (RNF-11)
- [x] 4.8 Sidebar entry in `src/components/app-sidebar.tsx` with `visibleTo: canFileRequests` + test

## Phase 5: Slice 5 - Review, dialogs, cron, 360 px (PR 5)

- [x] 5.1 RED+GREEN: `review-step.tsx` read-only, edit links, per-field errors (RF-01, RF-03)
- [x] 5.1a Gap from slice 4: `AVAILABLE_STEPS = 4` and a "Continue" link on step 3 to the review step (`steps.ts`, `documents-step.tsx`, `ContinueLink` in `form-field.tsx`); page renders step 4
- [x] 5.1b Gap from slice 3: `/requests/new/confirmation` page that `submitRequestAction` redirects to (student guard, static text, links to dashboard and a new request)
- [x] 5.2 RED+GREEN: `submit-dialog.tsx`, `discard-dialog.tsx`; cancel changes nothing (RNF-12)
- [x] 5.3 RED: `api/cron/intake-sweep/route.test.ts` for Bearer, expiry, pendiente docs, orphans, continue-on-failure, no audit, non-borrador untouched (D8, D14)
- [x] 5.4 GREEN: `src/app/api/cron/intake-sweep/route.ts` (constant-time compare, counts log)
- [ ] 5.5 Add `vercel.json` cron `0 9 * * *` and `regions` matching Neon (D10, D11); create Blob store same region. **PARTIAL**: cron and `regions: ["cle1"]` done and tested (Neon is aws-us-east-2, Ohio; cle1 = Cleveland); Blob store creation in the same region is a dashboard action by the owner
- [x] 5.6 Test no horizontal scroll at 360 px per step and dialog (RNF-11); manual harness check. Automated static guard done (`layout-360.test.tsx`); the manual 360 px harness walk stays a **pending manual item**
- [x] 5.8 FIX (manual test): edit links of the review carry `from=review`; saving that step returns to the review (`reviewEditHref`, `parseFromReview`, steps 1-3 `fromReview`)
- [x] 5.9 ENHANCEMENT (manual test, owner-approved 2026-10-09): View link per valid document on step 3 and review; route serves inline with CSP sandbox (`inlineDisposition`)
- [ ] 5.7 Update `docs/roadmap.md` status note for `justification-intake` at archive time

## Final merge checklist (feature branch -> main)

- [ ] F.1 Rebase `feat/justification-intake` on `main` after `catalog-management` lands; resolve conflicts in `permissions.ts`, `app-sidebar.tsx`, `i18n/*.json`, audit types
- [ ] F.2 Delete our generated migration and its snapshot/journal entry; regenerate with `npm run db:generate -- --name justification_intake` (expected `0007`+); rerun the migration test; ask the user before any apply **Finding 2026-10-09:** production already has 7 drizzle migrations applied (catalog-management `0005` at 2026-10-05 and a `0006` at 2026-10-08 01:40 UTC). drizzle-kit migrate only applies migrations newer than the last applied `created_at`, so our current `0005` (when 2026-10-07) would be SKIPPED silently with a success exit. The regenerated migration must sit after `0006` in the journal with a later `when`; verify with a row count of `drizzle.__drizzle_migrations` before and after.
- [ ] F.3 Re-check UI against `docs/design-system.md` ("Academic Governance") and swap any local `Checkbox` for the shared one
- [ ] F.4 Follow-up (separate PR or change): `adapters/weekday-schedule.ts` over `Grupo.Dias` replacing the permissive adapter (mask `0` = has class); un-defer the RN-22 scenarios
- [ ] F.5 At archive: rebase the `audit-log` delta onto `openspec/specs/audit-log/spec.md`

