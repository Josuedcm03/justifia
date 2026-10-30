# Proposal: Escalation

## Intent

The secretary cannot escalate a doubtful request to the career coordination,
cannot record a teacher's excess-absence report, and `en_revision_coordinacion`
is unreachable. Deliver roadmap row 6: RF-10, RF-15, RN-20; touches RF-07 (a,
c), RN-08, RN-16, RN-25/RF-01 (d), RNF-01. Pre-proposal handoff revision 5 is
authoritative; evidence in `exploration.md`.

## Scope

### In Scope
- **D0** FIA pilot only; no catalog data changes. Zero recipients is a visible
  blocked state (only Industrial and Sistemas have coordinators).
- **E2** `pendiente -> en_revision_coordinacion`, reason `sospecha_documento` or `caso_especial` (E18)
  with required note. Exit returns to `pendiente` (E3); one open escalation per
  request (E12, new table).
- **E2/E10** On `aprobada`: one action records the RF-15 report (teacher from
  remitted teachers, date, note; append-only, E7-E9) and notifies coordination
  with `exceso_inasistencias`; state stays `aprobada`. No percentage computed.
  Remissions untouched (E16).
- **E1** Minimal coordinator view: list of requests escalated to the user's
  career, detail with documents (audited access), answer action returning the
  request to `pendiente`; excess notices shown as informational.
- **E5/E6** Own outbox on escalation rows, drained by `remission-retry`; email
  with minimal data and a link, no attachments.
- **E6** `CONSENT_VERSION` v2 naming the career coordination; privacy notice
  recipients updated; pin tests.
- **E13** Student sees state and neutral reason label; note and answer are
  staff-only.
- **E14** State tabs on `/review` (Pendientes, En coordinación, Aprobadas).
- **E15** RN-08 deadline paused while in coordination; deadline computation
  and `IX_Solicitud_Cola` change.

### Out of Scope
- Coordinator reports, dashboards, history across careers (roadmap #7
  `coordination-reports`): the view stops at "escalated to my career + answer".
- Search by CIF/name (E14 cut line); validation-signals prefill; other faculties.
- UAM legal review of consent v2 and notice (owner task, joins request-consent 9.7).

### Documented deviation
RF-10 (a) says the request moves to `en_revision_coordinacion`; the excess-absence
path does not change state. Proposed: one changelog line in
`docs/requirements.md` recording it. **Owner decides**; not edited until approved.

## Capabilities

### New Capabilities
- `coordination-escalation`: reasons, transitions, recipients, outbox, RF-15 reports, coordinator view and answer.

### Modified Capabilities
- `request-review`: coordination state reachable; queue tabs; staff detail escalation/report sections; RN-08 pause.
- `student-requests`: escalated state with neutral reason label.
- `audit-log`: escalation, answer, report, notification and coordinator document-read actions.
- `justification-intake`: consent v2 text and version.
- `privacy-notice`: coordination as recipient.
- `supporting-documents`: `coordinacion` may view documents of requests escalated to its career.
- `user-roles`: coordinacion access to its view (RNF-01).

## Approach

Exploration approach 1 plus the coordinator view (approach 3). Guarded updates
like `decideRequest`; `SolicitudDecision` untouched. Strict TDD.

| Slice | Content | ~Lines |
|---|---|---|
| S1 | All schema + generated migration, transitions, pure rules, RN-08 pause, data functions, audit | 850 |
| S2 | Secretary tabs, escalate and report dialogs, detail sections, i18n | 950 |
| S3 | Recipients, message, outbox dispatch, cron drain, delivery status | 700 |
| S4 | Coordinator list/detail/answer, document access, RNF-01 tests | 900 |
| S5 | Student label, consent v2, privacy notice, closeout | 350 |

Total ~3,750. Cut line: S3 downgrades to inline send with manual resend (E5 c, ~-300).

## Affected Areas

| Area | Impact |
|------|--------|
| `src/db/schema.ts`, `drizzle/0011_*` (generated), `drizzle/meta/*` | Modified/New |
| `src/lib/intake/transitions.ts`, `escalation.ts`, `consent.ts` | Modified/New |
| `src/lib/data/solicitud-escalation.ts`, `revision-queue.ts`, `solicitud-detail.ts`, `student-requests.ts` | New/Modified |
| `src/lib/auth/permissions.ts`, document access | Modified |
| `review/*`, new coordinator route, `requests/[id]`, `privacy/page.tsx` | Modified/New |
| `/api/cron/remission-retry`, `src/lib/audit/*`, `i18n/{es,en}.json` | Modified |

**DB schema: YES.** Migration generated, not applied; any Neon command needs the
owner's yes.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration 0011 collides with `document-extraction` | High | Agree merge order before S1 PR; second regenerates |
| Coordinator document access widens exposure | Med | Career scope, audited reads, RNF-01 matrix tests, consent v2 |
| Queue index change regresses ordering | Med | Real-Postgres proof of index and constraints |
| Resend unconfigured: mail stays pending | High | Visible delivery status |
| Coordinator view overlaps #7 | Med | Hard stop listed in Out of Scope |

## Rollback Plan

Revert the PR chain in reverse order (S5, S4 separable). If the migration was
applied, a confirmed down-migration drops the new tables and restores the
queue index; requests in coordination are first returned to `pendiente`; v1
consents remain valid.

## Dependencies

- Merge order agreed with the `document-extraction` owner. UAM legal review before production.

## Success Criteria

- [ ] Pending request escalates, coordination answers, request returns to `pendiente`.
- [ ] Approved request records an RF-15 report and notifies; state stays `aprobada`.
- [ ] Zero recipients shows a blocked status; coordinator sees only its career.
- [ ] RN-08 deadline excludes time in coordination.
- [ ] Consent v2 pinned; student never sees note or answer.
