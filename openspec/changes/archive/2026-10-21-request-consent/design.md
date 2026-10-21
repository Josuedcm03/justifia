# Design: Request Consent

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries a schema, a migration, a pure rule, an action signature change, an
> audit field, two UI surfaces and a public page; the repository precedent
> (`teacher-remission`, `secretary-review`) keeps decision tables over prose
> cuts. The deviation is deliberate.

> **DB-touching.** This document plans commands and runs none. Every database
> step is tagged `[LOCAL]`, `[READ-ONLY]` or `[CONFIRM]`; a `[CONFIRM]` step
> needs the owner's explicit "yes" for that single command (`CLAUDE.md`).

Binding inputs: `proposal.md` (D1-D11), `preproposal.yaml` revision 3 (C1,
C3-C5, R1-R3, D10 and the accepted defaults), `exploration.md`, `research.md`
(Ley 787, Decreto 36-2012), `docs/requirements.md` (RF-01 d, RF-03 f, RN-25;
also RF-03 e, RNF-02, RNF-04, RNF-06, RNF-12). Decisions here are
**RC-1..RC-13**.

## Technical Approach

Approach 1 of the exploration. Two nullable columns on `Solicitud` record the
consent of a first presentation. A pure module `src/lib/intake/consent.ts`
owns `CONSENT_VERSION`; the visible text lives in `i18n/es.json` and a test
pins its SHA-256 to that version. `validateSubmission` requires consent by
default (fail closed) and the correction resubmit opts out.
`submitRequestAction` receives `{ consentVersion }`, reports
`consent_required` / `consent_outdated` with every other submit error at once,
and `submitDraft` writes the consent in its existing transaction and guarded
UPDATE, plus the version in the `solicitud.presentada` payload. Staff see the
fact on the review detail. A public static `/privacy` page holds the notice.

## Architecture Decisions

### RC-1. Schema

| Object | Definition | Rejected |
|---|---|---|
| `Solicitud.ConsentimientoEn` | `timestamptz NULL` | A separate append-only consent table (re-consent and revocation history nobody requires; second write and join; exploration approach 2) |
| `Solicitud.ConsentimientoVersion` | `varchar(20) NULL` | A per-row text hash (the version plus the pinned-hash test proves the text; a per-row hash duplicates it) |
| `CK_Solicitud_Consentimiento` | `("ConsentimientoEn" IS NULL) = ("ConsentimientoVersion" IS NULL)` (both or neither) | — |
| `CK_Solicitud_ConsentimientoFecha` | `"ConsentimientoEn" IS NULL OR ("PresentadaEn" IS NOT NULL AND "ConsentimientoEn" <= "PresentadaEn")` | A CHECK "presented requires consent": it fails every legacy row, and a `NOT VALID` CHECK still fires when a legacy row is later updated (correction, decision) |

Justification of `<=`: consent is given at the moment of the first
presentation, never after it. `PresentadaEn IS NOT NULL` also forbids consent
on a `borrador`, which encodes C6 (the checkbox is never persisted in the
draft) in the database. Both values are written with the same `now`, so the
equality case is the normal one; `<` stays legal for a future flow that
records consent before the presenting write. A correction never touches the
columns (`PresentadaEn` is the first presentation; `ReenviadaEn` moves).
Legacy rows stay NULL (C3, no backfill: a backfill would fabricate consent).

### RC-2. Migration 0010

**Generated**, never hand-numbered: `npm run db:generate -- --name
request_consent` `[LOCAL]` (expected `0010_request_consent.sql` plus
`meta/0010_snapshot.json` and a journal entry; re-check `drizzle/` on `main`
first). Purely additive: two `ADD COLUMN` without `NOT NULL` or default, two
`ADD CONSTRAINT ... CHECK`; existing rows are NULL and satisfy both. Test
`src/db/migration-request-consent.test.ts` follows
`migration-teacher-remission.test.ts`: located by name, journal `when` later
than `0009`'s, both columns nullable, both CHECK bodies, no `DROP`, no
`ALTER ... TYPE`, no `UPDATE` (no backfill).

### RC-3. Consent module and text pin

`src/lib/intake/consent.ts` (pure, no `server-only`: the client imports it):

```ts
/** Version of the consent text and of the privacy notice (accepted default). */
export const CONSENT_VERSION = "2026-10-20";
/** i18n key of the checkbox label; the text itself lives in i18n/{es,en}.json. */
export const CONSENT_LABEL_KEY = "intake.review.consent.label";
```

| Element | Choice |
|---|---|
| Version format | The ISO date of the owner's approval (R3). The notice shows it as its version and date (D9), so one constant serves both |
| Visible text | `intake.review.consent.label` in both locales, rendered with `t.rich` and a `<link>` tag around "Ver aviso de privacidad" / "View privacy notice". The es string is D1 verbatim; en is its translation |
| Pin | `consent.test.ts` reads `i18n/es.json`, takes the raw message (tags included), computes SHA-256 with `node:crypto` and asserts it equals `PINNED[CONSENT_VERSION]`, a literal map kept in the test. It also asserts the hashes in `PINNED` are distinct and `CONSENT_VERSION` is its last key. In S3 the same test pins the es `privacy` subtree (serialised with sorted keys) under the same version |
| Effect | Editing the es label or the notice turns the test red until a new version and its pin are added; old pins stay, so history is reviewable |

Rejected: the text as a TypeScript constant (two copies of the string, one of
them outside i18n, against the convention); pinning the en text (the legal
text is the Spanish one; en is a translation and may be polished freely).

### RC-4. Validation (fail closed)

`src/lib/intake/submission.ts`:

| Change | Detail |
|---|---|
| `SubmissionInput.consentVersion?: string \| null` | What the client says it showed; `undefined`/`null` = not given |
| `SubmissionOptions.consent?: boolean` | Default `true` |
| `SubmissionField` | gains `"consent"` |
| `SubmissionErrorCode` | gains `"consent_required"`, `"consent_outdated"` |
| Rule `consentErrors` | `consent === false` -> none; null/undefined/empty -> `consent_required`; `!== CONSENT_VERSION` -> `consent_outdated` |

The rule joins the existing list, so a submit reports all errors at once
(RF-03). `resubmitCorrection` passes `{ filingWindow: false, consent: false }`
(C4, C12); a new caller that forgets the option is refused, never silently
accepted. Rejected: an optional rule enabled per caller (fails open).

### RC-5. Action payload

`submitRequestAction(input: unknown)`; the doc comment changes from "payload
deliberately empty" to "payload carries only the consent version shown".

| Step | Rule |
|---|---|
| Parse | `submitPayloadSchema = z.object({ consentVersion: z.string().max(20).nullable() })` in `src/lib/validations/solicitud.ts`. Non-strict: extra keys are dropped, so the forged snapshot/timestamp/state still has no effect. A parse failure yields `consentVersion = null` and therefore `consent_required` beside the other errors (fail closed, no separate `invalid_input` path) |
| Validate | `validateSubmission({ ..., consentVersion }, managuaToday(now))` |
| Errors | `submissionErrors` maps them unchanged: `{ field: "consent", key: "intake.errors.consent_required" \| "intake.errors.consent_outdated" }` |
| Write | `submitDraft({ ..., consentimientoVersion: CONSENT_VERSION })` (the server constant, after validation proved equality) |

Identity, timestamp and draft values still come from the session, the server
clock and the stored draft (RN-02, RN-06, A5).

### RC-6. Persistence and timestamp

`SubmitInput` gains `consentimientoVersion: string` (required). The guarded
UPDATE in `submitDraft` adds `consentimientoEn: now` and
`consentimientoVersion` to its `set`; nothing else in the transaction moves,
so a conflict or drift rolls the consent back with the presentation. `now` is
the action's single `new Date()`, the same instant as `PresentadaEn`:
`timestamptz` stores the UTC instant; America/Managua is applied on display
(`useDates().instant`), as for `PresentadaEn`. Rejected: `now()` in SQL (a
second clock, and it could disagree with `PresentadaEn`, breaking RC-1).

### RC-7. Audit

`RequestSubmittedPayload` becomes `{ asignaturas, documentos,
consentimientoVersion }`; `solicitudPresentadaEvent` takes the extra argument.
One row per operation (RNF-06, C7). The version is a code, not personal data;
the leak test keeps passing. No new action, so `AUDIT_ACTIONS` and its pinned
lists are unchanged. The correction's `solicitud.corregida` is untouched.

### RC-8. Review step UI

| Element | Content |
|---|---|
| State | `ReviewStep` holds `const [consented, setConsented] = useState(false)` (C6: never saved). Checking clears `consent` errors |
| Placement | A block after the documents section, at the end of the body, directly above the footer with the submit button (C8). Rendered only when `flow` is absent: the correction flow has no checkbox (C4) |
| Markup | `<div className="flex items-start gap-3">` with `<Checkbox id="review-consent" checked onChange {...invalidProps("review-consent", consentErrors)} />` and `<Label htmlFor="review-consent" className="min-w-0 text-sm break-words">` holding `t.rich("review.consent.label", { link })`; `FieldErrors id="review-consent"` below |
| Link | `<a href="/privacy" target="_blank" rel="noopener noreferrer">` with link styling from `docs/design-system.md` and an `sr-only` "(opens in a new tab)" (`intake.review.consent.newTab`). A link inside a label does not toggle the box (interactive descendant); the new tab keeps the wizard and its unsaved checkbox; the draft itself is already stored |
| 360 px | Text wraps beside a 20 px box; no truncation; `items-start` keeps the box on the first line |
| Errors | `"consent"` joins `SECTION_FIELDS`, so consent errors render only under the checkbox, not in the form-level block |
| Button | Stays enabled (C9, RF-03 e) |

`SubmitDialog` gains `consentVersion: string | null` and passes
`action={() => submitRequestAction({ consentVersion })}`; `ConfirmDialog` is
unchanged (RNF-12). The client sends `CONSENT_VERSION` when checked, `null`
otherwise. Rejected: a client-only pre-check that blocks the dialog (a second
validation path; the server answers all errors in one round trip anyway); a
disabled button (contradicts C9).

Tokens: only existing ones (`text-sm`, `gap-3`, `text-destructive-ink` via
`FieldErrors`, `accent-primary` via `Checkbox`). No new values.

### RC-9. Staff detail

`getRequestDetail` selects both columns and returns `consentimiento: {
version: string; en: Date } | null` on `RequestDetail`. `StudentSection`
gains a `consent` prop (`page.tsx` passes `detail.consentimiento`) and one
`Fact`: `review.detail.fields.consent` with `review.detail.consent.recorded`
("Version {version}, {date}", date via `dates.instant`, America/Managua) or
`review.detail.consent.notRecorded` ("Not recorded (presented before consent
existed)"). `getOwnRequestDetail` and the student pages are untouched (C11).

### RC-10. Public privacy page

`src/app/privacy/page.tsx`: a server component outside `(dashboard)` and
`(auth)` (so no session guard, no login redirect), no session read, static
content from `getTranslations("privacy")`, `generateMetadata` like
`/denied`. Locale comes from the cookie (`getUserLocale`), so it works
anonymously.

Content outline (`privacy.*`, es and en), in this order:

1. Draft marker, first: "Borrador pendiente de revisión por la UAM" (C5), in
   the existing status callout style.
2. Version and date: `CONSENT_VERSION` rendered as a date (D9).
3. Controller: Universidad Americana (UAM), domicile and contact office.
4. Purpose: process absence justifications and their corrections only.
5. Recipients: the teachers of the affected subjects, by institutional mail.
   The mail provider is **not** named (R2).
6. Data categories: identity and academic data, the request (cause, dates,
   subjects), supporting documents; health data is sensitive and may appear
   in them.
7. Mandatory: the data and the consent are required to submit; without them
   the request cannot be processed.
8. Rights and revocation: access, rectification, cancellation and opposition,
   exercised in writing to the faculty secretary's office; revocation has no
   retroactive effect.
9. Retention: five years (RNF-04), then cancellation.

Rejected: a page under `(dashboard)` (unreachable from login and register,
and the notice must precede collection, Reglamento Art. 14); a `<details>`
inline (not linkable from registration).

### RC-11. Allow-list

Extract `src/lib/auth/public-paths.ts`: `isPublicPage(pathname)` returns true
for `/privacy`. `middleware.ts` checks it first and returns
`NextResponse.next()` for every session state (a signed-in user is **not**
redirected, unlike `/login` and `/register`). The helper is unit-tested
because the root `middleware.ts` sits outside vitest's `src/**` include. The
file keeps its pre-16 name (config gotcha; the `proxy.ts` rename is not this
change).

### RC-12. Links from login and register

One link in `src/app/(auth)/layout.tsx`, beside the institution line
(`common.privacyNotice`), covers both pages; same tab. Rejected: editing both
forms (two edits for one link).

### RC-13. Coordination with document-extraction (D11)

Consent merges to `main` first. The teammate then regenerates their migration
(it becomes `0011`), rebases onto the new `submitRequestAction(input:
unknown)` and the `SubmitInput.consentimientoVersion` field, and adds their
trigger after the consent write without moving it. `solicitud-correction.ts`
keeps its "rerun hook" comment; consent adds only the option.

## Data Flow

```
Student      ReviewStep     SubmitDialog   submitRequestAction    validateSubmission   submitDraft (tx)        DB
  | check box    |               |                 |                      |                   |                 |
  |------------->| consented=true|                 |                      |                   |                 |
  | Submit       |-------------->| ConfirmDialog   |                      |                   |                 |
  | Confirm      |               |--{consentVersion}->| requireRole, parse |                   |                 |
  |              |               |                 |-- draft, groups ---->| errors[] incl.    |                 |
  |              |               |                 |<-- ok | errors ------| consent_*         |                 |
  |              |               |<-- errors ------| (field "consent")    |                   |                 |
  |<-- under box |<- onErrors ---|                 |                      |                   |                 |
  |              |               |                 |-- ok: submitDraft({consentimientoVersion}) ->| snapshot     |
  |              |               |                 |                      |                   |-- guarded UPDATE: pendiente,
  |              |               |                 |                      |                   |   PresentadaEn=ConsentimientoEn=now,
  |              |               |                 |                      |                   |   ConsentimientoVersion ->|
  |              |               |                 |                      |                   |-- drift checks  |
  |              |               |                 |                      |                   |-- audit presentada {.., consentimientoVersion}
  |<------------------------------- redirect /requests/new/confirmation  |                   |                 |
```

Correction: `resubmitCorrection` -> `validateSubmission(..., { filingWindow:
false, consent: false })` -> UPDATE `devuelta` -> `pendiente`; consent columns
untouched.

## File Changes

| File | Action | Slice |
|---|---|---|
| `src/db/schema.ts`, `drizzle/0010_request_consent.sql` (+ meta) | Modify / Create (generated) | S1 |
| `src/db/migration-request-consent.test.ts` | Create | S1 |
| `src/lib/intake/consent.ts` (+ test) | Create | S1 |
| `src/lib/intake/submission.ts` (+ test) | Modify | S1 |
| `src/lib/data/solicitud-correction.ts` (+ test) | Modify | S1 |
| `src/lib/validations/solicitud.ts` | Modify (`submitPayloadSchema`) | S1 |
| `src/app/(dashboard)/requests/new/actions.ts` (+ test) | Modify | S1 |
| `src/lib/data/solicitudes.ts` (+ test, integration test) | Modify | S1 |
| `src/lib/audit/{types,events}.ts` (+ tests) | Modify | S1 |
| `i18n/{es,en}.json` | `intake.review.consent.label`, `intake.errors.consent_*` (S1); `intake.review.consent.newTab`, `review.detail.*consent*` (S2); `privacy.*`, `common.privacyNotice` (S3) | S1-S3 |
| `requests/new/{review-step,submit-dialog}.tsx` (+ tests) | Modify | S2 |
| `src/lib/data/solicitud-detail.ts`, `review/[id]/{request-sections,page}.tsx` (+ tests) | Modify | S2 |
| `src/app/privacy/page.tsx` (+ test) | Create | S3 |
| `src/lib/auth/public-paths.ts` (+ test), `middleware.ts` | Create / Modify | S3 |
| `src/app/(auth)/layout.tsx` | Modify | S3 |
| `docs/roadmap.md` | Modify (row 9 at archive) | S3 |

## Testing Strategy (strict TDD, Vitest)

| Layer | What | Approach |
|---|---|---|
| Unit | `consentErrors`: required, outdated, accepted, opt-out; all-errors-at-once with consent; text pin (and notice pin in S3); `isPublicPage` | Pure |
| Schema | Both CHECK bodies, nullable columns, no backfill | Generated SQL by name |
| Data | `submitDraft` sets both columns with `now`; conflict and drift leave them unset; correction does not touch them and passes `consent: false`; detail returns `consentimiento` or `null` | Mocked data layer; real Postgres opt-in for the integration suite |
| Action | `consent_required` (missing, `null`, malformed payload), `consent_outdated`, success passes `CONSENT_VERSION`; forged keys still ignored; role check before parsing | `vi.hoisted` mocks as today |
| Audit | Payload carries `consentimientoVersion`; leak test | Builder unit |
| UI | Checkbox unchecked by default; sends `null`/version; error under the box with `aria-describedby`; no checkbox in the correction flow; link `target="_blank"`, label toggles, link does not; 360 px; axe; staff fact recorded / not recorded; privacy page renders all nine sections and the draft marker, no provider name | Testing Library + user-event |

Existing tests to update: `requests/new/actions.test.ts` (twelve
zero-argument `submitRequestAction()` calls, the generic role table at line
139, the forged-payload case), `submission.test.ts` (valid fixtures gain
`consentVersion`), `solicitud-correction.test.ts`, `submit-dialog.test.tsx`,
`review-step.test.tsx`, `layout-360.test.tsx`,
`requests/new/design-system.test.tsx`, `solicitudes.test.ts`,
`intake-concurrency.integration.test.ts`, `events.test.ts`,
`review/design-system.test.tsx` and any `solicitud-detail` fixture typed as
`RequestDetail`.

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification
or process integration. The one routing change (RC-11) adds a public static
page with no data and no session read; its allow-list is unit-tested.

## Slice Plan (chained PRs, 800-line budget, generated snapshot excluded)

| Slice | Content | Estimate |
|---|---|---|
| S1 data and rules | RC-1..RC-7, S1 i18n keys | ~330 |
| S2 UI | RC-8, RC-9, S2 i18n keys | ~330 |
| S3 privacy and closeout | RC-10..RC-12, notice pin, roadmap | ~150-190 |

Between S1 and S2 the existing dialog sends no payload, so every submit on the
tracker branch fails closed with `consent_required`; the tracker merges to
`main` only after S2. S3 is separately reviewable and revertable, but
reverting it leaves the checkbox link pointing to a missing page.

## Migration / Rollout

| Step | Tag | Command / check |
|---|---|---|
| G1 | `[LOCAL]` | `npm run db:generate -- --name request_consent` |
| P1 | `[READ-ONLY]` | Count `Solicitud` by `Estado` |
| B1 | `[CONFIRM]` | Neon branch `backup-before-request-consent` |
| M1 | `[CONFIRM]` | `drizzle-kit migrate` over the direct URL |
| V1 | `[READ-ONLY]` | P1 unchanged; both consent columns NULL on every row |

Rollback: revert the chain; a `[CONFIRM]` down-migration drops the two
CHECKs and columns; requests are otherwise untouched.

## Open Questions

- [ ] UAM legal review of the checkbox text and the notice before production
  (provider not named, Ley 787 Arts. 13-14; bundled health consent, Reglamento
  Art. 7 c). A changed text means a new `CONSENT_VERSION` and pin.
- [ ] Controller domicile and contact office for notice item 3: the owner
  supplies the wording, or it stays as a marked placeholder in the draft.
