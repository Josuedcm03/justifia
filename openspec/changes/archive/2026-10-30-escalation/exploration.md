# Exploration: escalation

Roadmap row #6. Covers RF-10, RF-15; RN-20. Reads RN-16 (states), RN-15, RN-17 (secretary review), RN-18/RN-19 (teacher remission), RNF-01, RNF-06, RNF-07 (pattern only), RNF-12. Thesis scope: student and secretary flows; coordinator module out of focus. Out of scope: document-extraction (#4), validation-signals (#5), coordination-reports (#7), normative-parameters (#8).

## Current State

- **State machine**: `ESTADOS_SOLICITUD` (src/lib/intake/states.ts) already lists `en_revision_coordinacion`; `CK_Solicitud_Estado` allows it (migration 0007). `TRANSITIONS` (src/lib/intake/transitions.ts) has no edge into or out of it: borrador->pendiente, pendiente->aprobada|rechazada|devuelta, devuelta->pendiente. aprobada and rechazada are terminal. The `request-review` spec says the state "MUST NOT be reachable" (scenario "Coordination state unreachable"); this change must MODIFY it.
- **Decision write path**: `decideRequest` (src/lib/data/solicitud-decision.ts): one transaction with guarded UPDATE `WHERE Estado = stateBefore(target)`, optional revision snapshot, SolicitudDecision row, audit row, remissions on approval. `stateBefore` throws unless exactly ONE secretary edge leads into the target, so any new edge into aprobada/rechazada/devuelta forces a change. `DECISION_KINDS` (decision-templates.ts) feeds CK_SolicitudDecision_Tipo, `Record<DecisionKind,...>` maps in decision-dialog.tsx and the queue banner. SolicitudDecision encodes return-only invariants (reason iff devuelta; MotivoCodigo limited to RN-17 codes; RevisionId iff devuelta).
- **Secretary UI**: `/review` lists only `pendiente` requests in scope (`listReviewQueue`, revision-queue.ts). Decided requests leave the queue; no other list exists under review/. `/review/[id]` renders the decision panel only when pendiente (templatesFor null otherwise), the remission section only when aprobada, and explains nothing when no action is offered. Three DecisionDialogs post to `decideAction` (review/[id]/actions.ts): requireRole(...rolesRevisores), resolveRequestScope, validateDecision, decideRequest, redirect `/review?resultado=<kind>`.
- **Scope**: secretary scope = facultad of the student's CURRENT career (`requestInScope`, request-scope-sql.ts). `canViewDocument` serves only the owning student and an in-scope secretary. `coordinacion` is denied by all review pages and actions.
- **Coordination modeling**: no coordination table. A coordination is a `Usuario` with role `coordinacion`, nullable `CarreraId`, nullable unique `Correo`, `Activo`. `Carrera` has only Nombre and FacultadId (no email, no responsible user). Zero or several coordinators per career are possible. Accounts are created by `administrador` (createStaffAction, rolesAsignables); one role per user (docs/api-institucional/README.md B-8). Routing career = `Usuario.CarreraId` of the student (same join as requestInScope); `Solicitud.EstudianteCarrera` is a name snapshot only.
- **Students**: `StatePill` and `requests.states` already render the state. `getOwnRequestDetail` shows a decision only for devuelta|rechazada|aprobada (`DECIDED_STATES`), so an escalated request shows a pill and no explanation.
- **Mail outbox (teacher-remission)**: `Remision` = transactional outbox per teacher: FK DocenteId->Usuario, UQ(SolicitudId,DocenteId), snapshot Clases, states pendiente|enviada|bloqueada, reasons sin_correo|formato_especial_faltante|adjuntos_exceden_limite|error_envio, claim/lease columns, provider id. Only src/lib/data/remision.ts writes it after creation (structural test). `dispatchRemission` = claim -> pure `planRemission` (teacher message with RN-18, student in cc, attachments, idempotency key) -> read blobs -> `MailSender.send` -> guarded completion + audit. `/api/cron/remission-retry` (daily, vercel.json) drains pendiente rows. Reusable: MailSender port (ports.ts; `to` single string, `cc` array), Resend adapter, getIntakeDeps(), claim/lease/complete pattern, closed failure codes. Not reusable as is: the table, plan, message, recipient builder. Dispatch never checks Solicitud.Estado. Resend keys are not configured in Vercel, so every mail stays pendiente.
- **Special format**: upload (special-format.ts:73) requires Estado='aprobada'; `CK_Solicitud_FormatoEspecial` requires FormatoEspecial => Estado='aprobada'.
- **Audit**: AUDIT_ACTIONS closed list pinned by types.test.ts and events.test.ts; EventoAuditoria has no CHECK on Accion (0004), so new actions need no migration. Payloads: ids, codes and counts only. `solicitud.cola.consultada` is the single queue-read event (payload {total}, entity Facultad).
- **i18n**: i18n/{es,en}.json; keys requests.states, review.detail.states, review.queue, review.decision; parity and per-area tests.
- **Consent/privacy**: consent label v1 (i18n/es.json:765) and privacy notice "recipients" (:1132) name only teachers of the affected subjects as recipients. A label change needs a new CONSENT_VERSION.
- **Migrations**: 11 files, 0000..0010_request_consent (in main). Next generated is 0011, which document-extraction also targets.

## Verified data (read-only query on production, 2026-10-22)

- 3 coordinator accounts in total, all active, with email and a career: Ingeniería Industrial, Ingeniería de Sistemas, Diseño y Comunicación Visual.
- 14 of 17 careers have no coordinator. Only Ingeniería de Sistemas has a student account (1).
- Consequence: notification works for the demo career, and the zero-recipient case is the common one, so it must be handled visibly.

## Affected Areas

- src/db/schema.ts, drizzle/0011_* (generated), drizzle/meta/*: new escalation and absence-report tables; relax CK_Solicitud_FormatoEspecial if aprobada can enter the coordination state.
- src/lib/intake/transitions.ts (+test): new edges. src/lib/intake/escalation.ts (new, pure): reason codes, validation.
- src/lib/data/solicitud-escalation.ts (new): escalate, resolve, record report (guarded updates like decideRequest).
- src/lib/data/solicitud-decision.ts: only if E3(b) or E12(a) is chosen.
- src/lib/audit/types.ts, events.ts (+tests): new actions, maybe entity type Escalamiento.
- review/page.tsx, revision-queue.ts: lists of escalated and approved requests. review/[id]/page.tsx, request-sections.tsx, solicitud-detail.ts: escalation panel, reports section, history. review/[id]/actions.ts (or sibling): three actions.
- Notification: new dispatcher module; /api/cron/remission-retry/route.ts (drain both outboxes); ports.ts only if `to` must become a list.
- requests/[id], student-requests.ts: student message. i18n es/en.
- Spec deltas: request-review (MODIFIED: state transitions, queue, staff detail, decision actions only when pendiente), student-requests, audit-log, new capability coordination-escalation; maybe teacher-remission.
- Must not touch: openspec/changes/backoffice-ui-refresh, docs/flow-experience-backlog.md.

## Open Decisions (E1..E16)

| ID | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| E1 | Who takes a request out of the coordination state | a) nobody; b) secretary records coordination's answer; c) minimal coordinator view | b. Coordination works offline today (RN-19 format signed on paper); RF-13 (#7) creates the coordinator surface anyway; c adds scope, pages, document access, RNF-01 tests; a leaves requests stuck |
| E2 | States escalation starts from | a) pendiente only; b) pendiente and aprobada | b. RN-20 second reason and RF-15 act on a remitted (aprobada) request; with a that reason is unreachable |
| E3 | Exit target | a) resolution restores previous state (pendiente or aprobada), secretary then decides with the existing panel; b) resolve straight into approve/reject/return | a. b widens every decision guard and must forbid a second approval (duplicate remissions) |
| E4 | Recipients | a) users with role coordinacion, active, CarreraId = student's current career, with email; b) new Carrera.Correo; c) both | a. b needs an admin screen for Carrera that does not exist. Zero recipients must be visible (blocked sin_destinatario) |
| E5 | Notification channel | a) reuse Remision with a discriminator; b) own outbox columns on the escalation row, same pattern, drained by the existing retry route; c) inline best-effort send + status columns + manual resend | b. a couples teacher flow, UQ, UI and structural test. c is the cut line |
| E6 | Notification content | a) minimal: request id, student name + CIF, career, reason label, secretary note; no cause, no documents; b) also documents | a. Consent label and privacy notice name only teachers; cause can be health data. b needs UAM legal review + new CONSENT_VERSION. Consequence: coordination cannot see documents in the system |
| E7 | RF-15 storage | a) columns on Solicitud; b) append-only table (teacher name, optional teacher id, communicated date, recorded by/at) | b |
| E8 | RF-15 teacher field | a) free text; b) pick one of the request's remitted teachers (id + name snapshot) | b (name stored either way). Teachers do not log in (RNF-10) |
| E9 | RF-15 states | a) aprobada only; b) also in coordination | a. "Remitted" read as approved; the system cannot know the teacher received mail |
| E10 | Does a report escalate by itself | a) automatically; b) record first, separate Escalate action with the reason preselected | b. RF-10 and RF-15 are separate; RN-15 deliberate act; exceso_inasistencias requires >=1 report |
| E11 | RN-20 "sospecha sobre el documento" | a) free manual reason now (code + required note); b) wait for validation-signals; c) structured sub-reasons | a. Signals (#5) are advisory (RN-15), no dependency; c duplicates RN-09..13; #5 can prefill later without a schema change |
| E12 | Storage of escalation | a) widen SolicitudDecision; b) new table (reason, note, previous state, resolution, outbox columns) | b |
| E13 | Student visibility (RF-07 c) | a) state + reason label + note; b) state + neutral message; c) state + neutral reason label, note staff-only | c (needs owner confirmation) |
| E14 | Secretary lists | a) state tabs on /review (Pendientes, En coordinación, Aprobadas); b) tabs + search by CIF/name; c) none | a now, b as a cut-line addition; c blocks RF-15 (approved requests reachable only by URL today) |
| E15 | RN-08 clock after return to pendiente | a) leave formula (shows vencida); b) restart from resolution (changes IX_Solicitud_Cola expression/order); c) hide badge | a, raise to owner |
| E16 | Remissions of an escalated approved request | a) leave untouched (dispatch ignores state); b) pause dispatch | a; special-format upload keeps the aprobada gate, so it pauses implicitly |

Proposed state machine (E1 b, E2 b, E3 a): pendiente->en_revision_coordinacion (secretaria, reason sospecha_documento); aprobada->en_revision_coordinacion (secretaria, sospecha_documento, or exceso_inasistencias with >=1 recorded report); en_revision_coordinacion->stored previous state (secretaria, resolve with a note recording the coordination's answer). One open escalation per request (partial unique index on the unresolved row). CK_Solicitud_FormatoEspecial becomes NOT FormatoEspecial OR (Estado IN ('aprobada','en_revision_coordinacion') AND Causa='fuerza_mayor').

Audit events (codes only): solicitud.escalada, solicitud.escalamiento_resuelto, solicitud.reporte_inasistencias, escalamiento.notificacion_* (mirror remision.*). Lists need an audited read: reuse solicitud.cola.consultada with a discriminator or add one action.

## Overlap with document-extraction / validation-signals (predicted; no teammate branch locally)

- drizzle/0011_*, meta/_journal.json, snapshots, schema.ts: HIGH (both generate 0011; the second to merge regenerates as 0012; never hand-number; Neon apply order = merge order).
- review/[id]/page.tsx, request-sections.tsx, solicitud-detail.ts: medium-high (all add sections or fields to the staff detail).
- i18n/*.json, audit/types.ts, events.ts + tests: medium (the pinned action list conflicts textually).
- solicitud-decision.ts, decision-dialog.tsx: low-medium (#5 may add a suggested verdict near the decision panel; avoided under E3 a, E12 b).
- transitions.ts: low.

Mitigation: all schema in the first slice; agree the merge order with the teammate before PR #1.

## Approaches

1. **Escalation record + secretary-recorded answer + own notification outbox** (E1 b, E5 b, E12 b). Pros: meets RF-10, RF-15 and both RN-20 reasons; no new role surface; teacher flow untouched; reusable by a future coordinator view. Cons: coordination answers outside the system; migration collision; largest. Effort: High.
2. **Same with inline best-effort send** (E5 c). Pros: smaller; no cron change. Cons: no automatic retry. Effort: Medium-High.
3. **Add a minimal coordinator view** (E1 c). Pros: closest to the real flow; documents visible to coordination. Cons: new scope, canViewDocument change, nav, RNF-01 matrix; the thesis puts the coordinator out of focus; overlaps #7. Effort: High (+~40%).
4. **State flag only, no exit** (E1 a). Pros: smallest. Cons: requests stuck; weak demo. Effort: Medium.

## Recommendation

Approach 1 in four chained slices (rough; full scope ~2,800-3,200 authored lines, does not fit one 1000-line review): S1 data and rules (~800; ALL schema + generated migration, pure rules, transitions, data functions, audit), S2 secretary UI (~950; dialogs, detail sections, state tabs, actions, i18n), S3 notification (~700; recipients, message, outbox, dispatch, retry), S4 student visibility + closeout (~250). Cut lines: search (E14 b), then S3 downgraded to E5 c.

## Risks

- Migration number collision with document-extraction; any Neon apply needs explicit owner confirmation; real-Postgres constraint proof needed for new CHECKs and the partial unique index.
- 14 of 17 careers have no coordinator account: notifications for those careers are blocked until accounts exist.
- Privacy: recipients named in the consent label and notice exclude coordination; E6 a limits exposure, but the notice wording needs UAM review; attaching documents needs a new CONSENT_VERSION.
- Resend is not configured in Vercel: notifications stay pendiente; the UI must show it.
- The approve dialog says approval is final; escalating an aprobada request returns it to aprobada, but the student sees a regression meanwhile.
- Existing spec scenarios flip (state unreachable, decision actions only when pendiente, queue lists only pendiente): deltas must be MODIFIED.
- "Remitted" in RF-15 is interpreted as aprobada (E9); RF-07 c vs E13 c need owner confirmation.
- Vercel cron: current docs allow 100 crons per project on Hobby with a once-per-day minimum (older pages say 2); avoid a third cron by reusing remission-retry.

## UX observations (for owner decision; docs/flow-experience-backlog.md NOT edited)

1. Secretary, /review: today only pendiente is listed; a decided request is reachable only by typing /review/<id>. Expected: filter by state and search by CIF or name (needed for RF-15).
2. Secretary, /review/[id] of a non-pending request: today no decision panel and no explanation. Expected: a status panel naming the state and the remaining actions.
3. Secretary, approve dialog: today "La aprobación es definitiva: no se puede deshacer." Expected: wording consistent with a later coordination review of an approved request.
4. Secretary, queue after coordination: a request back in pendiente keeps the original clock and shows "Vencida". Expected: a signal that explains the delay (E15).
5. Secretary, escalation feedback: today no delivery status for any mail except teacher remissions in the detail. Expected: a clear "Coordination notified / pending send / no recipient" status (Resend not configured yet).
6. Student, /requests/[id]: today an escalated request shows only the pill "En revisión de coordinación", with no explanation or expected wait (DECIDED_STATES excludes it). Expected: a short neutral message.
7. Student, approved request re-entering coordination: the pill goes Aprobada -> En revisión de coordinación with no reason. Expected: the message of item 6 plus its reason label.

## Ready for Proposal

Yes, after the owner confirms E1, E2, E6, E10, E13 and E15 and the merge order with the teammate is agreed. Coordinator accounts with email were verified (see Verified data).
