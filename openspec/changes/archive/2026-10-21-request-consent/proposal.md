# Proposal: Request Consent

## Intent

A presented request records no informed consent, yet it carries personal and
possibly health data and is emailed to teachers (`teacher-remission`). Deliver
roadmap row 9: RF-01 (d), RF-03 (f), RN-25. Pre-proposal handoff revision 3
(C1, C3, C4, C5, R1-R3 and accepted defaults) is authoritative; evidence in
`exploration.md` and `research.md` (Ley 787 / Decreto 36-2012).

## Scope

### In Scope
- **D1 (C1, R3)** Text v1 (es, owner-approved 2026-10-20), verbatim:
  «Acepto que la UAM use los datos de esta solicitud y de mis documentos,
  incluidos los datos de salud que contengan, solo para tramitarla, y que se
  envíen a los docentes de las asignaturas afectadas. Ver aviso de privacidad».
  en: "I agree that UAM may use the data in this request and in my documents,
  including any health data they contain, only to process it, and that they be
  sent to the teachers of the affected subjects. View privacy notice".
  `CONSENT_VERSION` constant; a test pins the es text hash to the version.
- **D2 (C2)** `Solicitud.ConsentimientoEn` + `ConsentimientoVersion`; CHECK
  both-or-neither and `ConsentimientoEn <= PresentadaEn`.
- **D3 (C3)** Legacy rows stay NULL; no backfill; staff sees "not recorded".
- **D4 (C4, C12)** `validateSubmission` requires consent by default; the
  correction resubmit opts out and never asks again.
- **D5 (R1, C6, C8, C9)** One short checkbox on the review step above the
  submit button; not persisted in the draft; button stays enabled, inline
  `consent_required` error (RF-03 e).
- **D6 (C10)** Client sends the `consentVersion` it showed; mismatch returns
  `consent_outdated`.
- **D7 (C7)** `consentimientoVersion` added to the `solicitud.presentada`
  payload (one entry per operation, RNF-06).
- **D8 (C11)** Consent and date visible to staff only, on the review detail.
- **D9 (C5, R2)** Static privacy notice page, marked draft pending UAM review:
  controller (UAM), purpose, recipients (teachers), data categories with health
  as sensitive, data mandatory to submit, rights and revocation in writing to
  the faculty secretary's office, 5-year retention (RNF-04), version/date (=
  `CONSENT_VERSION`). It does not name the mail provider.
- **D10** The privacy page is **public** (`/privacy`, outside `(dashboard)`,
  allow-listed in `middleware.ts`) and linked from the checkbox, login and
  register. Rationale: the notice must precede collection (Reglamento Art. 14),
  registration already collects data, and the page holds no PII; cost is one
  allow-list entry.

### Out of Scope
- In-app revocation or ARCO workflow; re-consent of legacy rows.
- Minimizing what teachers receive by email (`teacher-remission` follow-up).
- `document-extraction`; RNF-04 purge job.

## Capabilities

### New Capabilities
- `privacy-notice`: public static notice, required facts, version, draft mark.

### Modified Capabilities
- `justification-intake`: consent checkbox, RN-25 validation, version check, stored consent, audit payload.
- `request-review`: staff sees consent version and date, or "not recorded".
- `student-requests`: correction resubmit never asks for consent.

## Approach

Approach 1 from exploration: columns on `Solicitud`, pure rule in
`submission.ts`, write inside `submitDraft`'s existing transaction and guarded
UPDATE. Enforcement lives in code, not the DB (a CHECK would break legacy
rows). Strict TDD. Chained PRs: S1 data/rules (~330), S2 UI (~330), S3 privacy
page + closeout (~150-190, separable); ~865 lines total vs the 800 budget.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/db/schema.ts`, `drizzle/0010_*`, `drizzle/meta/*` | Modified/New |
| `src/lib/intake/consent.ts` | New |
| `src/lib/intake/submission.ts`, `src/lib/data/solicitudes.ts`, `solicitud-correction.ts` | Modified |
| `requests/new/actions.ts`, `review-step.tsx`, `submit-dialog.tsx` | Modified |
| `src/lib/audit/types.ts`, `events.ts` | Modified |
| `solicitud-detail.ts`, `review/[id]/request-sections.tsx` | Modified |
| `src/app/privacy/page.tsx`, `middleware.ts`, `i18n/{es,en}.json`, `docs/roadmap.md` | New/Modified |

**DB schema: YES** (migration 0010, generated, not applied). Applying it to
Neon requires explicit owner confirmation per command.

RNF touchpoints: RNF-02 (consent data under existing encryption), RNF-06 (audit
payload), RNF-12 (submit keeps the existing `ConfirmDialog`).

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Provider not named; Ley 787 Arts. 13-14 (cesión, transfer abroad) | Med | Owner decision R2; UAM legal review before production |
| One bundled checkbox may fail "specific"/express health consent (Reglamento Art. 7c) | Med | Health named explicitly; UAM review; new version if changed |
| Migration 0010 collides with `document-extraction` | High | Consent merges first; teammate regenerates |
| Legacy NULL reads as a defect | Low | Explicit "not recorded" label |
| 360px/axe constraints on label | Low | Short text; existing tests |

## Rollback Plan

Revert the PR chain (S3 alone is separable). If 0010 was applied, a confirmed
down-migration drops the two columns and CHECKs; requests are otherwise
untouched.

## Dependencies

- `teacher-remission` archived. UAM review of text and notice before production.
- **D11 (accepted default)** Merge order: consent reaches `main` before
  `document-extraction`, which keeps the `SubmitInput`/`submitRequestAction`
  signatures and regenerates its migration afterwards.

## Success Criteria

- [ ] Submit without consent fails with `consent_required`; stale version fails with `consent_outdated`.
- [ ] Presented request stores version and date; audit payload carries the version.
- [ ] Correction resubmit never asks; legacy rows stay NULL and correctable.
- [ ] Staff detail shows consent or "not recorded"; `/privacy` loads without login.
- [ ] Text hash test pins es text to `CONSENT_VERSION`.
