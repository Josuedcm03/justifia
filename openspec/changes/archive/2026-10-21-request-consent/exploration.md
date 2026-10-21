# Exploration: request-consent

Roadmap row #9. Covers RF-01 (d), RF-03 (f); RN-25.

## Current State

- **Draft model**: one `Solicitud` table (`src/db/schema.ts:246`) holds the
  draft (`borrador`) and every RN-16 state. One open draft per student
  (`UX_Solicitud_Borrador`). The `Estudiante*` snapshot is NOT NULL once
  presented (`CK_Solicitud_Presentada`). `PresentadaEn` is the first
  presentation; `ReenviadaEn` marks each resubmission.
- **Wizard**: `/requests/new` (`new/page.tsx`, `openDraft`) reads `?step=`
  (`steps.ts`: details, subjects, documents, review). `FlowSteps`
  (`flow-steps.tsx`) is shared with the correction flow through the `Flow` prop
  (`flow.ts`).
- **Final step**: `ReviewStep` (`review-step.tsx`, client) has a footer with
  `BackLink`, `DiscardDialog` and `SubmitDialog` (or `ResubmitDialog` in the
  correction flow). `SubmitDialog` wraps the shared `ConfirmDialog` (RNF-12)
  and calls `submitRequestAction` with no arguments.
- **Errors**: `{ field, key: "intake.errors.<code>" }`, rendered by
  `FieldErrors` (`form-field.tsx`). A field outside `SECTION_FIELDS` falls to a
  form-level block.
- **Server action**: `submitRequestAction` (`new/actions.ts:81`) takes an empty
  payload by design: `requireRole`, `getLiveDraft`, `listEligibleGroups`, pure
  `validateSubmission` (`src/lib/intake/submission.ts`, all errors at once;
  codes mapped by `submissionErrors` in `step-actions.ts`), `submitDraft`, then
  redirect to the static `/requests/new/confirmation`.
- **Data layer**: `submitDraft` (`src/lib/data/solicitudes.ts:318`) runs one
  transaction: account snapshot, guarded UPDATE `borrador` → `pendiente`, drift
  re-checks of groups and documents, and `insertAuditEvents` with
  `solicitudPresentadaEvent`.
- **Audit**: `solicitud.presentada` carries `{ asignaturas, documentos }`
  (`RequestSubmittedPayload` in `src/lib/audit/types.ts`; builder in
  `events.ts:97`). `AUDIT_ACTIONS` is a closed list pinned by `types.test.ts`
  and `events.test.ts`.
- **Sweep**: `src/lib/data/intake-sweep.ts` (cron `/api/cron/intake-sweep`)
  deletes idle drafts, stale `pendiente` documents and orphan blobs, for
  `borrador` rows only. No change needed under any option.
- **Correction**: `resubmitCorrectionAction`
  (`requests/[id]/correct/actions.ts:79`) → `resubmitCorrection`
  (`src/lib/data/solicitud-correction.ts:59`): `validateSubmission(..., {
  filingWindow: false })`, UPDATE `devuelta` → `pendiente` plus `ReenviadaEn`,
  audit `solicitud.corregida`. The file header and
  `secretary-review/design.md:434` already decide that a correction MUST NOT
  ask for consent again and that pre-consent requests MUST stay correctable.
  Corrections can add documents, so the text must cover "this request and its
  corrections".
- **Schema**: latest migration is `drizzle/0009_teacher_remission.sql`. This
  change generates `0010` plus `meta/0010_snapshot.json` and a journal entry.
  Applying it to Neon needs explicit owner confirmation. The database cannot
  enforce "presented requires consent" without breaking legacy rows (a
  `NOT VALID` check still fires when old rows are updated), so enforcement
  lives in `submitDraft` and validation.
- **Staff detail**: `/review/[id]/page.tsx` → `getRequestDetail`
  (`src/lib/data/solicitud-detail.ts`) → `StudentSection` in
  `review/[id]/request-sections.tsx` (i18n `review.detail.*`), which already
  lists name, CIF, career and email. The student's own detail
  (`getOwnRequestDetail`) is separate.
- **Privacy notice**: none exists. `middleware.ts` only lets `/login` and
  `/register` through without a session. A `Checkbox` primitive exists in
  `src/components/ui/checkbox.tsx`. i18n subtrees: `intake.review.submit.*`,
  `intake.errors.*`, `review.detail.*`.
- **Facts that change the prototype wording**:
  - `teacher-remission` (shipped) emails the supporting document and cause to
    each affected teacher through Resend
    (`src/lib/intake/adapters/resend-mail-sender.ts`). "Solo para tramitar"
    omits those recipients.
  - RN-01 has five causes; only the medical one carries health data, so the
    text says documents "may include" it.
  - RNF-04 (five-year retention) has no purge job yet.
  - Nicaraguan data-protection law was not verified; UAM should review the text.

## Affected Areas

- `src/db/schema.ts`, `drizzle/0010_*`, `drizzle/meta/*` — two consent columns
  and a migration test.
- `src/lib/intake/consent.ts` (new) — `CONSENT_VERSION` and a test pinning the
  es text hash to the version.
- `src/lib/intake/submission.ts`, `src/lib/data/solicitud-correction.ts` —
  consent required by default, correction opts out.
- `src/app/(dashboard)/requests/new/actions.ts`, `src/lib/data/solicitudes.ts`
  — `SubmitInput`, the guarded UPDATE, the audit payload.
- `src/lib/audit/types.ts`, `events.ts` — payload field only.
- `review-step.tsx`, `submit-dialog.tsx` — checkbox and wiring.
- `solicitud-detail.ts`, `request-sections.tsx` — staff sees consent and date.
- `i18n/es.json`, `i18n/en.json`.
- Optional: `src/app/(dashboard)/privacy/page.tsx`.
- Spec deltas: `justification-intake`, `request-review`, `student-requests`.
- Tests to update: `new/actions.test.ts` (12 zero-argument calls and the
  forged-payload case), `submit-dialog.test.tsx`, `review-step.test.tsx`,
  `solicitudes.test.ts`, `events.test.ts`, the 360px layout and axe tests,
  `intake-concurrency.integration.test.ts` (needs a database).
- Must not touch `openspec/changes/backoffice-ui-refresh`.

## Open Decisions

| ID  | Decision | Options | Recommendation |
| --- | -------- | ------- | -------------- |
| C1  | Text and versioning | text only; version per row plus hash-pin test; sha256 per row | Version per row plus a test pinning the es text hash to the version |
| C2  | Storage | two columns on `Solicitud`; separate table | Two columns (`ConsentimientoEn`, `ConsentimientoVersion`), CHECK both-or-neither and `En <= PresentadaEn` |
| C3  | Legacy requests | leave NULL; sentinel backfill; force consent later | Leave NULL; staff sees "not recorded (before consent)". A backfill would fabricate consent |
| C4  | Consent on correction | never ask; ask only when none recorded | Never ask (already decided). Asking legacy students costs ~60–80 lines, owner opt-in |
| C5  | Privacy notice | in-app `/privacy`; inline `<details>`; external URL | In-app static page as the last, separable slice, marked as a draft pending UAM review |
| C6  | Persist the checkbox in the draft | yes; no | No: consent is given at submit against the text shown then |
| C7  | Audit | add to `solicitud.presentada` payload; new action | Add `consentimientoVersion` to the existing payload (one entry per operation, RNF-06) |
| C8  | Placement | review step; fifth step; inside the dialog | Review step, above the button, as in the prototype |
| C9  | Blocking | enabled button plus `consent_required`; disabled button | Enabled button with the inline error, per RF-03 (e) |
| C10 | Payload | client sends the version it showed; server uses its own | Client sends `{ consentVersion }`; mismatch returns `consent_outdated` |
| C11 | Visibility | staff only; staff and student | Staff only |
| C12 | `validateSubmission` default | required with correction opt-out; optional field | Required by default (fail closed) |

### Draft text (v1, pending owner approval)

- **es**: «Acepto que la UAM trate mis datos personales y los de mis documentos
  de respaldo, que pueden incluir información de salud, solo para tramitar esta
  justificación y sus correcciones, y que se envíen por correo institucional a
  los docentes de las asignaturas afectadas. Ver aviso de privacidad»
- **en**: "I agree that UAM may process my personal data and the data in my
  supporting documents, which may include health information, only to handle
  this justification and its corrections, and that they may be emailed to the
  teachers of the affected subjects. View privacy notice"

Prototype reference (simulated, no jury feedback): «Acepto que la UAM use mis
datos, incluida la información médica de mi constancia, solo para tramitar
esta justificación. Ver aviso de privacidad».

## Overlap with document-extraction

Predicted from RF-11 and the teacher-remission precedent; no teammate branch
was available.

| Shared file | Risk | Why |
| ----------- | ---- | --- |
| `drizzle/0010_*`, `drizzle/meta/*`, `schema.ts` | High | Both generate 0010; the second to merge regenerates; Neon apply order follows merge order |
| `new/actions.ts` (`submitRequestAction`) | Medium | Consent adds an argument; extraction adds a trigger after success |
| `solicitudes.ts` (`submitDraft`) | Medium | Same transaction block |
| `actions.test.ts`, `solicitudes.test.ts` | Medium | Shared mock harness |
| `solicitud-correction.ts` | Low–medium | One consent line; extraction may hook a rerun here |
| `solicitud-detail.ts`, `request-sections.tsx` | Low–medium | Both add to the detail view |
| `i18n/*.json` | Low | Different subtrees |
| `audit/types.ts`, `events.ts` | Low | Consent adds no action under C7 |

Merge plan: consent merges first. The teammate keeps the `SubmitInput` and
`submitRequestAction` signatures and generates their migration after consent
reaches `main`.

## Approaches

1. **Columns on `Solicitud`, checkbox on the review step, version-pinned text**
   — smallest diff, one transaction, one audit row. Cons: migration collision,
   NULL legacy rows. Effort: Medium.
2. **Separate append-only consent table** — supports future re-consent or
   revocation that no requirement asks for. Effort: Medium–High.
3. **Consent as a fifth wizard step** — changes the stepper and the correction
   flow, departs from the prototype. Effort: High.

## Recommendation

Approach 1 in three chained slices: S1 data and rules (~330 lines), S2 UI
(~330 lines), S3 privacy page and closeout (~150–190 lines, separable).

## Size

~865 authored lines (~675 without S3) against the 800 budget; generated
snapshot excluded; SDD documents ship as a separate docs commit.

## Risks

- The consent wording is a legal and privacy artifact; UAM must approve it
  before production.
- Migration 0010 collides with document-extraction; applying it needs owner
  confirmation.
- Legacy NULL rows must not read as a defect in staff UI.
- 360px layout and axe tests constrain the checkbox label.
- The integration test needs a database.
- A privacy page behind login is unreachable from login and register.

## Ready for Proposal

Yes, after the owner confirms C1 (text), C3, C4, C5 and the merge order.
