# Proposal: Justification Intake

## Intent

Students cannot file absence justifications. Deliver request creation (roadmap row 1): RF-01..RF-04, RN-01..RN-06, RN-21..RN-23, RNF-11; cross-cutting RNF-01, RNF-02, RNF-06, RNF-12. Decisions D1-D15 (`preproposal.yaml` rev 6) are authoritative.

## Scope

### In Scope
- Server-side draft; 4-step stepper: cause and dates, subjects, documents, read-only review with confirm dialog (RNF-12); 360 px (RNF-11).
- Validation: five causes, date order, 30-day window (RN-23), at least one PDF/PNG/JPEG of at most 10 MB.
- Client uploads to a private Vercel Blob store; finalize action checks signatures, deletes mismatches (D2, D3; C13, C21, C28-C31).
- Subjects from enrollment via `GroupScheduleProvider` with temporary permissive adapter (D5); student picks a group when ambiguous.
- Submit: `borrador` to `pendiente`, Managua timestamp, student snapshot (D7, D9), audit events.
- One open draft per student, discard with confirmation, daily cron sweep (D8; C32, C33).

### Out of Scope
- secretary-review, teacher-remission, document-extraction, validation-signals (RN-07).
- RNF-14 (normative-parameters); RN-22 schedule filtering until catalog-schedule.

## Capabilities

### New Capabilities
- `justification-intake`: draft lifecycle, validation, subjects, submission.
- `supporting-documents`: upload, format check, authenticated download, orphan cleanup.

### Modified Capabilities
- `audit-log`: new request and document events.

## Approach

Hexagonal: pure domain in `src/lib/intake/`, ports `DocumentStore`, `GroupScheduleProvider`; adapters Vercel Blob and permissive schedule. Single `Solicitud` table plus `SolicitudAsignatura` and `DocumentoRespaldo`. Strict TDD with fake ports. Pooled Neon endpoint, co-located regions (D11).

## Affected Areas

| Area | Impact |
|------|--------|
| `src/db/schema.ts`, `drizzle/0005_*.sql` | Modified/New |
| `src/lib/intake/`, `src/lib/validations/solicitud.ts`, `src/lib/data/` | New |
| `src/lib/audit/`, `src/lib/auth/permissions.ts` | Modified |
| `src/app/(dashboard)/requests/new/`, `src/app/api/` (upload token, download, cron) | New |
| `src/components/ui/` (stepper, alert-dialog, checkbox), `app-sidebar.tsx`, `i18n/*.json` | New/Modified |
| `vercel.json`, `package.json` (`@vercel/blob` >= 2.3), `src/db/index.ts` | New/Modified |

**DB schema: YES.** Migration is generated, never applied without explicit per-command user confirmation.

## Delivery Outline (chained PRs)

| Slice | Content |
|-------|---------|
| 1 | Schema, migration, domain rules, ports |
| 2 | Blob adapter, token route, finalize, download |
| 3 | Draft and submit actions, enrollment, audit, permissions |
| 4 | Steps 1-3, UI primitives, i18n |
| 5 | Review, confirm dialog, discard, cron, 360 px |

Estimate 2,200-3,000 lines; exceeds 800 budget.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| RN-22 contract diverges | Med | Port plus deferred scenarios |
| Hobby quota/terms (C18, C34) | Med | Size caps, sweep, `DocumentStore` port |
| Unvalidated blob window | Low | Finalize deletes; never referenced unvalidated |
| Drafts leak downstream | Med | Visible-states helper plus test |
| Migration number collision | Med | Rebase before generating |

## Rollback Plan

Revert slice PRs in reverse order. If applied, a confirmed down-migration drops the new tables; delete the blob store and cron entry. Existing tables are untouched.

## Dependencies

- catalog-schedule (D5); Vercel Blob store and `BLOB_READ_WRITE_TOKEN`.

## Success Criteria

- [ ] Student submits a valid request; it is `pendiente` with server timestamp and snapshot.
- [ ] Each RN-01..RN-05 and RN-23 violation blocks submit per field.
- [ ] Spoofed files are rejected and deleted.
- [ ] No horizontal scroll at 360 px.
