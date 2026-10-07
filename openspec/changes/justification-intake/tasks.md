# Tasks: Justification Intake

## Review Workload Forecast

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

Chain strategy decided by the user: feature-branch-chain. Tracker branch `feat/justification-intake` is cut from `main`; PR 1 targets the tracker, each later PR targets the previous slice branch, and only the tracker merges to `main` (one final PR). Migration-number conflicts with catalog-management are resolved at that final merge. Per-slice estimate: S1 ~500, S2 ~500, S3 ~600, S4 ~750, S5 ~450.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema, generated migration, pure domain, ports | PR 1 | `npx vitest run src/lib/intake src/db` | N/A: no runtime surface; migration SQL read by test | Revert schema, `drizzle/0005_*`, `src/lib/intake/` (unapplied migration) |
| 2 | Blob adapter, token route, finalize, download | PR 2 | `npx vitest run src/lib/intake/adapters src/app/api src/lib/data/documentos` | Dev Blob store: upload spoofed + valid file via route | Revert adapter, routes, env, dependency |
| 3 | Draft/submit actions, enrollment, audit, permissions | PR 3 | `npx vitest run src/lib/data src/lib/audit src/lib/auth src/app/(dashboard)/requests/new/actions.test.ts` | N/A: no UI yet; actions covered by mocked deps | Revert actions, data layer, audit builders, permissions |
| 4 | Stepper steps 1-3, UI primitives, i18n, sidebar | PR 4 | `npx vitest run src/components/ui src/app/(dashboard)/requests/new` | `npm run dev`, walk steps 1-3 as student | Revert UI files and i18n keys |
| 5 | Review step, dialogs, cron sweep, 360 px | PR 5 | `npx vitest run src/app/api/cron src/app/(dashboard)/requests/new` | `npm run dev` at 360 px; call cron with Bearer | Revert review UI, cron route, `vercel.json` |

## Phase 1: Slice 1 - Schema, domain, ports (PR 1)

- [ ] 1.1 Rebase on `main`; confirm `drizzle/` numbering vs `catalog-management` before generating (design: Data Model)
- [ ] 1.2 RED: `src/db/migration-0005.test.ts` asserts CHECKs, partial unique `UX_Solicitud_Borrador`, snapshot CHECK, doc cap columns (RN-01, RN-05, D7, D8)
- [ ] 1.3 Add `Solicitud`, `SolicitudAsignatura`, `DocumentoRespaldo` to `src/db/schema.ts`
- [ ] 1.4 Run `npm run db:generate -- --name justification_intake` (generate only)
- [ ] 1.5 STOP: ask user for explicit confirmation before any `drizzle-kit migrate`/`push`; do not apply unprompted
- [ ] 1.6 RED+GREEN: `src/lib/intake/signature.test.ts` then `signature.ts` (PDF/PNG/JPEG magic bytes; RN-04, D3)
- [ ] 1.7 RED+GREEN: `src/lib/intake/dates.test.ts` then `dates.ts` (Managua today, UTC crossing, day 30/31; RN-05, RN-23)
- [ ] 1.8 RED+GREEN: `causes.ts`, `limits.ts`, `pathnames.ts` with tests (RN-01, RN-04, D4, D12; ownership prefix check)
- [ ] 1.9 RED+GREEN: `submission.test.ts` then `submission.ts` `validateSubmission`, all errors at once (RF-03, RN-01..RN-05, RN-23, D15)
- [ ] 1.10 RED+GREEN: `eligibility.ts` ambiguity/group choice with tests (RF-04, RN-21)
- [ ] 1.11 RED+GREEN: `states.ts` `VISIBLE_STATES` excludes `borrador`, with test (D7)
- [ ] 1.12 Add `src/lib/intake/ports.ts` (`DocumentStore`, `GroupScheduleProvider`) and `adapters/permissive-schedule.ts` + test (D5)
- [ ] 1.13 RED+GREEN: `src/db/index.ts` prod pool `max:3`, `prepare:false`; test config branch (D11); verify against Neon docs (open question)

## Phase 2: Slice 2 - Blob adapter and routes (PR 2)

- [ ] 2.1 Add `@vercel/blob` >= 2.3 to `package.json`; add `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET` to `src/env.ts` and `.env.example` (D1, D10)
- [ ] 2.2 RED+GREEN: `adapters/vercel-blob-store.ts` (`server-only`, private access) with mocked SDK tests (RNF-02)
- [ ] 2.3 RED+GREEN: `src/lib/intake/deps.ts` `getIntakeDeps()` with fakes helper for tests (supporting-documents: Storage behind a port)
- [ ] 2.4 RED: `upload-token/route.test.ts` for 401, non-student, foreign/expired draft, 6th doc `too_many_documents`, limits payload (RN-04, D2, D12, RNF-01)
- [ ] 2.5 GREEN: `src/app/api/intake/upload-token/route.ts` via `handleUpload`; `onUploadCompleted` no-op
- [ ] 2.6 RED: `src/lib/data/documentos.test.ts` for finalize claim, concurrent cap, reasons table, delete on mismatch (RN-04, D3, D12)
- [ ] 2.7 GREEN: `src/lib/data/documentos.ts` finalize (pendiente claim, sniff, validate), remove
- [ ] 2.8 RED: `documents/[id]/route.test.ts` for 401/404 identical denial, headers, nosniff, no bytes on failure (RNF-01, RNF-02, D15)
- [ ] 2.9 GREEN: `src/app/api/intake/documents/[id]/route.ts` streaming download (audit hook wired in slice 3)

## Phase 3: Slice 3 - Actions, enrollment, audit, permissions (PR 3)

- [ ] 3.1 RED+GREEN: `permissions.ts` `rolesSolicitantes`, `canFileRequests`, `canViewDocument` with tests (RNF-01, D15)
- [ ] 3.2 RED+GREEN: `src/lib/audit/events.ts` five builders and `AuditEntityType` additions; payload minimisation + leak tests (RNF-06, RNF-02, D13, D14)
- [ ] 3.3 RED+GREEN: `src/lib/data/enrollment.ts` active groups, teacher label (RF-04, RN-21, D15)
- [ ] 3.4 RED: `solicitudes.test.ts` for one-draft concurrency, resume, 30-day expiry, discard, no audit rows (D8, D14)
- [ ] 3.5 GREEN: `src/lib/data/solicitudes.ts` draft CRUD setting `ActualizadoEn` explicitly
- [ ] 3.6 RED+GREEN: `src/lib/validations/solicitud.ts` zod step schemas with i18n-key messages (RF-03)
- [ ] 3.7 RED: `actions.test.ts` for authz, forged snapshot/timestamp, double submit, audit rollback, port re-check (RN-02, RN-06, RF-04)
- [ ] 3.8 GREEN: `src/app/(dashboard)/requests/new/actions.ts` (save step, finalize, remove, discard, `submitRequest`)
- [ ] 3.9 Wire `documento.descargado` insert before bytes in download route; extend its tests (D13)

## Phase 4: Slice 4 - Steps 1-3, primitives, i18n (PR 4)

- [ ] 4.1 Add `alert-dialog`, `checkbox`, `radio-group`, `stepper` in `src/components/ui/` with tests (RNF-11, design-system tokens)
- [ ] 4.2 RED+GREEN: `page.tsx` guard, step from searchParams, fail-soft draft load (A7, RNF-01)
- [ ] 4.3 RED+GREEN: `intake-stepper.tsx` with `aria-current="step"`, "Step n of 4" at 360 px (RF-01, RNF-11)
- [ ] 4.4 RED+GREEN: `cause-dates-step.tsx` field errors (RN-01, RN-05, RN-23)
- [ ] 4.5 RED+GREEN: `subjects-step.tsx` radio for ambiguous groups, no-teacher label (RF-04, D15)
- [ ] 4.6 RED+GREEN: `documents-step.tsx` `upload()`, reason messages, remove (RF-02, RN-03, RN-04, D12)
- [ ] 4.7 Add `intake.*`, `nav.newRequest` to `i18n/es.json` and `i18n/en.json`; key-parity test (RNF-11)
- [ ] 4.8 Sidebar entry in `src/components/app-sidebar.tsx` with `visibleTo: canFileRequests` + test

## Phase 5: Slice 5 - Review, dialogs, cron, 360 px (PR 5)

- [ ] 5.1 RED+GREEN: `review-step.tsx` read-only, edit links, per-field errors (RF-01, RF-03)
- [ ] 5.2 RED+GREEN: `submit-dialog.tsx`, `discard-dialog.tsx`; cancel changes nothing (RNF-12)
- [ ] 5.3 RED: `api/cron/intake-sweep/route.test.ts` for Bearer, expiry, pendiente docs, orphans, continue-on-failure, no audit, non-borrador untouched (D8, D14)
- [ ] 5.4 GREEN: `src/app/api/cron/intake-sweep/route.ts` (constant-time compare, counts log)
- [ ] 5.5 Add `vercel.json` cron `0 9 * * *` and `regions` matching Neon (D10, D11); create Blob store same region
- [ ] 5.6 Test no horizontal scroll at 360 px per step and dialog (RNF-11); manual harness check
- [ ] 5.7 Update `docs/roadmap.md` status note for `justification-intake` at archive time
