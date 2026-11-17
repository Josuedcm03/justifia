# Design: Escalation

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries two tables, a queue-index change, three write paths, an outbox, a new
> role surface and a consent version; the repository precedent
> (`request-consent`, `teacher-remission`) keeps decision tables over prose
> cuts. The deviation is deliberate.

> **DB-touching.** This document plans commands and runs none. Steps are tagged
> `[LOCAL]`, `[READ-ONLY]` or `[CONFIRM]`; a `[CONFIRM]` step needs the owner's
> explicit "yes" for that single command (`CLAUDE.md`).

Binding inputs: `proposal.md`, `preproposal.yaml` revision 7 (D0, E1-E18),
`exploration.md`, the delta specs (the contract), `docs/requirements.md`
(RF-07 a/c, RF-10, RF-15, RN-08, RN-16, RN-20, RN-25/RF-01 d, RNF-01, RNF-06,
RNF-07, RNF-12; changelog 2026-10-22). Decisions here are **ES-1..ES-17**.

## Technical Approach

A new `Escalamiento` row is both the escalation record and its notification
outbox; a `ReporteInasistencia` row is the append-only RF-15 report. Two
escalation motives, `sospecha_documento` and `caso_especial` (E18), and one
notice kind share the escalation table. Both motives move `pendiente ->
en_revision_coordinacion`, are answered by the coordination and return to
`pendiente`, and behave identically; `exceso_inasistencias` (state stays `aprobada`, informational,
never answered). Writes are guarded single transactions like `decideRequest`;
`SolicitudDecision` and `decideRequest` are untouched. The career of a request
is always the student's live `Usuario.CarreraId` (spec terms). The RN-08 clock
gets a stored effective start that the answer moves forward by the paused
business days. A minimal `/coordination` surface, scoped to the coordinator's
career, lists, shows (with audited documents) and answers. The cron route
drains the second outbox.

## Architecture Decisions

### ES-1. `Escalamiento` table (one table, motives and a notice kind)

| Column | Definition |
|---|---|
| `Id` | bigint identity PK |
| `SolicitudId` | FK `Solicitud`, NOT NULL, no cascade |
| `Tipo` | varchar(30) NOT NULL, `IN ('sospecha_documento','caso_especial','exceso_inasistencias')` (`ESCALATION_KINDS`, RN-20, E18) |
| `EstadoPrevio` | varchar(30) NOT NULL |
| `Nota` | varchar(1000) NULL: secretary note (either motive) |
| `ReporteId` | FK `ReporteInasistencia` NULL (exceso only) |
| `SecretariaId`, `CreadoEn` | FK `Usuario` NOT NULL; timestamptz NOT NULL |
| `Respuesta`, `RespondidaPorId`, `RespondidaEn` | varchar(1000), FK `Usuario`, timestamptz; all NULL until answered |
| Outbox | `NotificacionEstado` varchar(20) NOT NULL default `pendiente` (`pendiente`/`enviada`/`bloqueada`), `NotificacionMotivo` varchar(30) NULL (`sin_destinatarios`/`error_envio`), `Intentos` smallint default 0, `ReclamoId` uuid, `ReclamadaEn`, `EnviadaEn`, `ProveedorMensajeId` varchar(100), `ActualizadaEn` |

CHECKs: `CK_Escalamiento_Tipo`; `CK_Escalamiento_Kind`
(`(Tipo IN ('sospecha_documento','caso_especial') AND EstadoPrevio='pendiente' AND ReporteId IS NULL
AND Nota IS NOT NULL AND length(btrim(Nota))>0) OR (Tipo='exceso_inasistencias'
AND EstadoPrevio='aprobada' AND ReporteId IS NOT NULL AND Nota IS NULL)`);
`CK_Escalamiento_Respuesta` (the three answer columns all NULL or all set,
answer non-blank, `RespondidaEn >= CreadoEn`); `CK_Escalamiento_SinRespuesta`
(`Tipo IN ('sospecha_documento','caso_especial') OR RespondidaEn IS NULL`); outbox CHECKs mirroring
`Remision` (`enviada` iff `EnviadaEn`; motive/state consistency:
`CK_Escalamiento_NotificacionMotivo` = `NotificacionMotivo IS NULL OR
NotificacionMotivo IN ('sin_destinatarios','error_envio')`, `bloqueada` needs
`sin_destinatarios`, `pendiente` allows NULL or `error_envio`, `enviada` none;
claim pair; `Intentos >= 0`).

Indexes: `UX_Escalamiento_Abierto` unique on `(SolicitudId)` WHERE
`Tipo IN ('sospecha_documento','caso_especial') AND RespondidaEn IS NULL`
(E12, E18: one open escalation across both motives);
`IX_Escalamiento_Pendiente (CreadoEn, Id)` WHERE `NotificacionEstado='pendiente'`;
`IX_Escalamiento_Solicitud (SolicitudId, CreadoEn)`.

| Option | Tradeoff | Decision |
|---|---|---|
| One table with `Tipo` | One outbox, one dispatcher, one recipient query, one coordinator list; kind CHECK keeps the shapes apart | **Chosen** |
| Separate `NotificacionCoordinacion` for excess | Duplicates outbox columns, claim code and list union | Rejected |
| Widen `SolicitudDecision` | Breaks its return-only invariants (exploration E12) | Rejected |

Only `src/lib/data/escalamiento.ts` writes the table after creation (structural
test, like `remision.ts`).

### ES-2. `ReporteInasistencia` table (append-only, RF-15)

`Id`; `SolicitudId` FK NOT NULL; `DocenteId` FK `Usuario` NOT NULL;
`DocenteNombre` varchar(160) NOT NULL (snapshot); `ComunicadoEl` date NOT NULL;
`Nota` varchar(1000) NULL (`CK_ReporteInasistencia_Nota`: NULL or non-blank);
`RegistradoPorId` FK NOT NULL; `RegistradoEn` timestamptz NOT NULL default
now; `IX_ReporteInasistencia_Solicitud`. No update/delete function exists
(structural test). The teacher must be one of the request's `Remision` rows
(any delivery state; Resend is unconfigured, so `enviada` only would leave the
picker empty). `ComunicadoEl` must be a calendar date not later than today in
Managua (spec: no lower bound; a report dated before the approval is
accepted). Both are pure/transactional checks, not CHECKs (a date-vs-today
CHECK needs a time-zone expression). Rejected: free-text teacher (E8).

### ES-3. Career of a request is live

Coordinator scope, recipients, the E17 account check and coordinator document
access all resolve the student's current `Usuario.CarreraId`, read in the same
statement or transaction that uses it (spec terms; "Current career, not the
snapshot"). No career column is stored on `Escalamiento`. A student career
change while an escalation is open therefore moves it to the new career's
coordination, which is the spec's rule.

| Option | Tradeoff | Decision |
|---|---|---|
| Live join `Escalamiento -> Solicitud -> Usuario(student)` | One extra join per read; pilot volume is tiny | **Chosen** (spec) |
| Snapshot `Escalamiento.CarreraId` at escalation | Stable routing, but contradicts the spec's current-career rule | Rejected |

### ES-4. Transitions

`TRANSITIONS` gains `{ pendiente -> en_revision_coordinacion, secretaria }` and
`{ en_revision_coordinacion -> pendiente, coordinacion }`; the header comment
drops "no edge". New pure helper `sourceOf(to, actor)` in `transitions.ts`
(same uniqueness rule as `stateBefore`) feeds the escalation guards.
`stateBefore` stays valid: it filters `actor === "secretaria"` and is only
asked for `aprobada|rechazada|devuelta`; neither new edge targets those, so
each still has exactly one secretary source. A test pins that invariant for
every `DECISION_KINDS` entry and that the escalation SQL guards equal
`sourceOf`. The excess report is not an edge: its guard is the constant
`EXCESS_REPORT_STATE = "aprobada"` in `escalation.ts`. `solicitud-decision.ts`
is not edited.

### ES-5. RN-08 pause in business days (E15)

`Solicitud.PlazoInicioEn timestamptz NULL` = stored effective clock start.
Effective start = `coalesce(PlazoInicioEn, ReenviadaEn, PresentadaEn)`; its
Managua date `S` feeds the unchanged `deadlineOf(S)` (2nd business day
strictly after `S`).

Derivation, computed in the app inside the answer transaction (ES-8) with the
injected `NonWorkingDaysProvider` (`constantCalendar`):

1. `E` = Managua date of `Escalamiento.CreadoEn`, `A` = Managua date of `now`.
2. `P = countBusinessDays(E, A)` = business days `d` with `E <= d < A`.
3. `P = 0` -> `PlazoInicioEn` unchanged. `P > 0` -> `S' =
   addBusinessDays(S, P)` (P-th business day strictly after the current `S`);
   `PlazoInicioEn` = Managua midnight of `S'` (`${S'}T06:00:00Z`).

Because `S'` is a business day, `deadlineOf(S')` = (2 + P)-th business day
after `S` = base deadline + P business days. Pauses add up (each answer starts
from the current effective `S`). Spec table check (no holidays): Mon/Mon/Thu:
P=3, S'=Thu, deadline next Mon; Mon/Tue/Tue: P=0, Wed; Mon/Tue/next Mon: P=4
(Tue-Fri), S'=Fri, deadline next Tue. A holiday inside `[E, A)` is not
counted (provider). `countBusinessDays` and `addBusinessDays` are new pure
exports of `src/lib/intake/business-days.ts`, reusing `nextBusinessDay` and
`isBusinessDay`; its header comment changes from "never stored" to "the
answer stores the shifted start".

| Write | Effect |
|---|---|
| Answer (ES-8) | `PlazoInicioEn = $computed` in the guarded `Solicitud` UPDATE (P > 0 only) |
| Resubmit (`resubmitCorrection`) | adds `plazoInicioEn: null` to its existing `set`, so a pause before the resubmission never counts |

`CK_Solicitud_PlazoInicio`: `PlazoInicioEn IS NULL OR PlazoInicioEn >=
coalesce(ReenviadaEn, PresentadaEn)` (holds: `S'` is a later Managua date than
the start instant). It catches most forgotten resets; the
`resubmitCorrection` unit test pins the reset. `IX_Solicitud_Cola` is dropped
and recreated on `(coalesce(PlazoInicioEn, ReenviadaEn, PresentadaEn), Id)`
WHERE `Estado='pendiente'`; `listReviewQueue` orders by the same expression,
built by one exported `effectiveClockStart` SQL fragment that the schema index
also uses (so planner text matches). Pure `clockStartOf(row)` in
`src/lib/intake/deadline-clock.ts` feeds `deadlineStatus` in the queue and the
detail page. Instant order implies Managua-date order and `deadlineOf` is
monotone in the date, so index order equals effective-deadline order (spec
"B precedes A").

| Option | Tradeoff | Decision |
|---|---|---|
| Stored start shifted by business days in the app | Additive, nullable, no backfill; plain-column index; matches spec rule | **Chosen** |
| Wall-clock shift `start + (now - CreadoEn)` | Counts weekends and hours; breaks the spec deadline table | Rejected |
| Paused-days column + index expression | `timestamptz + interval` is STABLE, not allowed in an index; calendar not in SQL | Rejected |
| Sum of escalation durations on read | Subquery cannot be indexed; ordering moves out of SQL | Rejected |

In the En coordinacion tab the badge shows a display status `en_pausa`
(`DeadlineBadge` accepts `DeadlineStatus | "en_pausa"`, muted tone, text
label; `DeadlineStatus` itself unchanged); alert/overdue marks stay
Pendientes-only.

### ES-6. Escalate write path (E17, E18)

`escalateRequest({ actorId, scope, solicitudId, motivo, nota, now })` in
`src/lib/data/solicitud-escalation.ts`; `motivo` comes from the dialog and
`validateEscalationDraft` checks it against `ESCALATION_REASONS`
(`sospecha_documento`, `caso_especial`; anything else, `exceso_inasistencias`
included, is `motivo_invalid`). One transaction: guarded UPDATE
`Estado = sourceOf('en_revision_coordinacion','secretaria')` AND
`requestInScope(scope)` RETURNING; read the student's current `CarreraId` and
career name; count active `coordinacion` accounts of that career
(`countCoordinationAccounts`, email ignored); zero -> throw a typed error that
rolls back, outcome `sin_coordinacion` with the career name (nothing written,
no audit); INSERT `Escalamiento` with notification `pendiente` (unique index
backs E12: a violation maps to `conflict`); audit `solicitud.escalada`.
Outcome `{ ok, escalamientoId } | { ok:false, reason:
not_found|conflict|invalid|sin_coordinacion, carreraNombre? }`. Concurrent
approve vs escalate serialise on the row lock; the loser gets `conflict`.

Accounts exist but none has an email: the escalation succeeds; the post-commit
dispatch resolves zero recipients and sets `bloqueada/sin_destinatarios`
(ES-11); the coordinator still lists and answers it (ES-9). Recipients gone
after the escalation: same `bloqueada` path. The UI shows the refusal before
submit (ES-12); the server check is authoritative. i18n intent, es: "{carrera}
no tiene coordinación registrada; solicite al administrador que cree la
cuenta." en: "{career} has no registered coordination; ask the administrator
to create the account."

### ES-7. Excess report (RF-15, E10)

`recordExcessReport({ actorId, scope, solicitudId, remisionId, comunicadoEl,
nota, now })`: lock the request with `SELECT ... FOR UPDATE` WHERE
`Estado = EXCESS_REPORT_STATE` AND in scope; resolve teacher from the
request's `Remision` row; validate the date (ES-2); INSERT report; INSERT
`Escalamiento` (`exceso_inasistencias`, `EstadoPrevio='aprobada'`,
notification `pendiente`, no state change); audit
`solicitud.reporte_inasistencias`. Zero accounts or zero emails do **not**
refuse (E17); the post-commit dispatch blocks the notice with
`sin_destinatarios`. Remissions untouched (E16).

### ES-8. Answer (coordinator)

`answerEscalation({ actorId, scope: CoordinationScope, escalamientoId,
respuesta, now })` in `src/lib/data/escalation-answer.ts`: guarded UPDATE
`Escalamiento` WHERE id AND `Tipo IN ESCALATION_REASONS` AND `RespondidaEn IS
NULL` AND `escalationInScope(scope)` (student's current career) RETURNING
`SolicitudId`, `CreadoEn`; read the request's `PresentadaEn`, `ReenviadaEn`,
`PlazoInicioEn` (nothing else writes them while in coordination); compute the
pause (ES-5); guarded UPDATE `Solicitud` WHERE `Estado =
sourceOf('pendiente','coordinacion')` setting `pendiente` and
`PlazoInicioEn`; zero rows there throws (invariant). Audit
`solicitud.escalamiento_resuelto` (entity `Solicitud`). Concurrent answers
serialise on the escalation row; the loser gets `conflict` ("already
answered"). The secretary then decides with the existing panel.

### ES-9. Coordinator surface (E1, RNF-01)

| Element | Choice |
|---|---|
| Role | `rolesCoordinadores = ["coordinacion"]`, `canCoordinate(rol)` in `permissions.ts` |
| Scope | Pure `CoordinationScope = { kind:"carrera"; carreraId } \| { kind:"none" }` and `coordinationScopeFor` in `src/lib/intake/coordination-scope.ts`; `resolveCoordinationScope(userId, rol)` reads `Usuario.CarreraId`/`Activo` per call (never cached); SQL `escalationInScope(scope)` in `src/lib/data/coordination-scope-sql.ts` is the only place it becomes SQL (`none` -> `false`; `carrera` -> student's current `CarreraId` equals it) |
| Routes | `src/app/(dashboard)/coordination/page.tsx`: open escalations (either motive) of the own career (oldest first, regardless of notification state) then all notices of the own career (newest first); `coordination/[id]/page.tsx` keyed by **escalation id**; `coordination/[id]/actions.ts` `answerEscalationAction` |
| Guards | Every page and action: `requireRole(...rolesCoordinadores)`, resolve scope, `none` -> denial with no rows; an escalation of another career, an answered escalation, a `borrador` or an unknown id is `notFound()` |
| Detail | Open escalation: student full name, CIF, career, cause, dates, subjects with group and teacher, current non-retired documents, reason label, secretary note, escalation time, answer form with `ConfirmDialog` (RNF-12); never the student email, consent state or decision history. Notice: student full name, CIF, career, teacher name, communicated date, report note; no documents, cause, dates or answer form |
| Audit | List open writes `escalamiento.cola.consultada` (entity `Carrera`); detail open writes `solicitud.consultada` (entity `Solicitud`, coordinator actor), exactly once per render (same pattern as the secretary detail and `recordQueueRead`) |
| Nav | `NAV_ITEMS` entry `coordination`, `visibleTo: canCoordinate`, `prefetch: false` (audited render) |
| Documents | `getDocumentForDownload` adds `estudianteCarreraId` and `tieneEscalamientoAbierto` (exists on the open escalation row of either motive; unique index => at most one). `canViewDocument(viewer, doc, scope, coordination = NONE)`: `coordinacion` allowed iff `coordination.kind==="carrera"` AND `doc.estudianteCarreraId === carreraId` AND `solicitudEstado === "en_revision_coordinacion"` AND `tieneEscalamientoAbierto` AND `doc.estado === "valido"` AND `doc.retiradoEn === null`; the download route resolves the coordination scope only for that role. Reads keep writing `documento.descargado` |

Rejected: widening `RequestScope` with a `carrera` kind (touches 8 secretary
callers and `facultadId` narrowing; a coordinator could reach secretary data
functions by type); a URL keyed by request id (an excess notice and an
escalation of the same request would collide).

### ES-10. Recipients and message

`listCoordinationRecipients(solicitudId)`: `Usuario` WHERE `Rol='coordinacion'`
AND `Activo` AND `CarreraId` = the student's current career AND `Correo IS NOT
NULL`, ordered by id; resolved fresh at every send attempt (post-commit, cron,
resend), never frozen. Pure `planEscalationNotice` in
`src/lib/escalation/plan.ts`: zero -> `blocked sin_destinatarios` (evaluated
before any mail configuration check); else `to` = first, `cc` = rest (one
message, so "every recipient accepted" = one provider acceptance; no
`MailSender` change). Spanish subject and text with exactly: request number,
student full name and CIF, career name, reason label, the escalation note
(either motive) or the report note when present (exceso), and the absolute link
`${APP_BASE_URL}/coordination/${id}` (login required, no token). No cause, no
dates, no teacher name, no document names, no document attachments, no answer
(see ES-17 for the HTML part and its inline brand image).
Idempotency key `escalamiento-${id}-${sha256(to,cc)[0..16]}`. `APP_BASE_URL`
joins `env.ts` as optional URL; unset -> failure `not_configured`, row stays
`pendiente` (same as a missing Resend key). Rejected:
`VERCEL_PROJECT_PRODUCTION_URL` fallback (wrong host on previews); widening
`to` to a list (adapter, fake and remission tests change).

### ES-11. Outbox dispatch

`src/lib/data/escalamiento.ts` (claim/lease/complete, copied pattern of
`remision.ts`: `claimEscalationNotice`, `completeSent|Failed|Blocked`,
`selectEscalationRetryCandidates` bounded per run and by the max automatic
attempts, `authorizeNoticeResend`) and `src/lib/data/escalation-dispatch.ts`
(`dispatchEscalationNotice(s)`, never throws per row). Audit actor: the
session user for post-commit and resend dispatch; `Escalamiento.SecretariaId`
for cron (no lookup). Triggers: `after()` in the escalate/report actions;
cron (`pendiente` only; `bloqueada` is never retried automatically); manual
resend `resendEscalationNoticeAction` (`requireRole(...rolesRevisores)` +
`resolveRequestScope`, escalation's request in scope, state `pendiente` or
`bloqueada`; `enviada` sends nothing and writes no audit; out of scope or
unknown id -> the same denial). `/api/cron/remission-retry` runs the
remission batch then the escalation batch, each in its own try; response keeps
the remission counts at top level and adds `escalamientos: {...}`. Secretary
detail shows per escalation: enviada (time), pendiente ("pending send", "last
attempt failed" with `error_envio`), bloqueada `sin_destinatarios` (no
coordination recipient for the career), with the resend button unless
`enviada`.

### ES-12. Secretary UI

`/review?estado=pendiente|en_revision_coordinacion|aprobada` (closed set,
default `pendiente`) renders three tab links (`aria-current`, `prefetch:false`).
Data: `listReviewQueue` (pending, pause-aware), new
`listCoordinationQueue(scope)` (escalation time ascending, reason label,
`en_pausa`, notification status) and `listApprovedRequests(scope)` (ordered by
the approval `SolicitudDecision.DecididaEn` descending, report count; newest 50
with a "latest 50" note; search is the E14 cut line). Detail `/review/[id]`:
`EscalationSection` (history, answers, delivery) for any state with
escalations; escalate dialog when `pendiente` (motive and note required, E18); when the
career has no active `coordinacion` account the action is unavailable with the
career-named E17 text (`countCoordinationAccounts` read in the page); report
dialog when `aprobada` (teacher select from remissions, date, optional note)
plus the reports list. Both dialogs use `ConfirmDialog` (RNF-12). Actions in
`review/[id]/escalation-actions.ts`, each `requireRole(...rolesRevisores)` +
`resolveRequestScope`. Tokens: existing only (`docs/design-system.md`).

### ES-13. Audit

| Action | Entity | Payload (ids/codes/counts only) |
|---|---|---|
| `solicitud.escalada` | Solicitud | `{ escalamientoId, motivo, estadoPrevio, estadoNuevo }` |
| `solicitud.escalamiento_resuelto` | Solicitud | `{ escalamientoId, estadoPrevio, estadoNuevo }` |
| `solicitud.reporte_inasistencias` | Solicitud | `{ reporteId, escalamientoId, docenteId }` |
| `escalamiento.notificacion_enviada` | Escalamiento | `{ solicitudId, origen, intentos, destinatarios }` |
| `escalamiento.notificacion_fallida` | Escalamiento | `{ solicitudId, origen, intentos, codigo }` |
| `escalamiento.notificacion_bloqueada` | Escalamiento | `{ solicitudId, origen, motivo: "sin_destinatarios" }` |
| `escalamiento.notificacion_reenviada` | Escalamiento | `{ solicitudId, estadoPrevio }` |
| `escalamiento.cola.consultada` | Carrera (caller's `CarreraId`) | `{ total }` |
| `solicitud.consultada` (reused) | Solicitud | `{ estado }` (also on coordinator detail) |
| `solicitud.cola.consultada` (modified) | Facultad | `{ total, estado }` (tab code) |

Entity types gain `Escalamiento` and `Carrera`. `EventoAuditoria` has no CHECK
on `Accion`/`EntidadTipo`: no migration. Notes, answers, names, emails, career
and dates never enter payloads (leak test extended). Refusals (including the
E17 `sin_coordinacion` refusal), lost races and rollbacks write nothing.

### ES-14. Student visibility (E13, RF-07 c)

`getOwnRequestDetail` is unchanged; the page renders a neutral callout
`requests.detail.coordination` when the state is `en_revision_coordinacion`.
No reason code, note, answer, coordinator or excess notice reaches the student
payload (the approved state does not change). Texts contain neither "sospecha",
"suspicion", "caso especial" nor "special case" (test); the motive never reaches
the student (E18). `DECIDED_STATES` unchanged.

### ES-15. Consent v2

`CONSENT_VERSION` becomes the owner-approval ISO date (placeholder
`"2026-10-22"` until confirmed). The es label `intake.review.consent.label`
takes the spec's exact v2 text and `privacy.recipients` names "la coordinación
de la carrera del estudiante"; `consent.test.ts` adds the new hashes under the
new key (v1 pins stay). Rows with v1 stay valid (stored per row; only new
submits compare). A wizard open across deploy gets `consent_outdated`
(expected).

### ES-16. Migration

Generated only: `npm run db:generate -- --name escalation` `[LOCAL]` after
rebasing on the merge order agreed with `document-extraction` (whoever merges
second regenerates; the number is never assumed). Additive except
`DROP INDEX "IX_Solicitud_Cola"` + recreate. Test
`src/db/migration-escalation.test.ts`: located by name, journal `when` after
its predecessor, both tables and every CHECK body, `PlazoInicioEn` nullable,
the only `DROP` is that index, no `UPDATE`, no `ALTER ... TYPE`.

### ES-17. Special-case motive, branded notice, coordination table (E18, S10)

Owner walk of 2026-10-30; evidence from the thesis interviews: E-02 (secretaria
académica, 03:36) says causes outside art. 36 (health or sport), such as the
death of a close relative or migration paperwork, are valued by the career
coordination together with the teacher; E-01 (ex-coordinator) says the first
level is the secretaría and, if the case requires it, it escalates to the
coordination.

| Topic | Decision |
|---|---|
| Motive | `ESCALATION_KINDS` gains `caso_especial`; `ESCALATION_REASONS = ["sospecha_documento","caso_especial"]` is the closed set a secretary may choose (`exceso_inasistencias` stays the notice kind). Every query that selected `Tipo = 'sospecha_documento'` now selects the set (`inArray` or the shared SQL fragment) |
| Schema | CHECKs `Tipo`, `Kind`, `SinRespuesta` and the partial unique index `UX_Escalamiento_Abierto` cover both motives, so one open escalation exists per request across them. `CK_Escalamiento_MotivoEstado` pins the notification state and reason, not the kind, and is unchanged |
| Migration | `0012_escalation` was never applied to production (production stops at `0011_document_extraction`; only disposable branches got it), so it is regenerated in place by drizzle-kit instead of adding `0013`. The disposable branches that hold the old 0012 are not valid targets for the new one; phases 4 and 14 must be re-run |
| Dialog | The secretary picks the motive (radio group, accessible legend, no default); the server validates it against `ESCALATION_REASONS` (`motivo_invalid`); the note stays required |
| Student | Unchanged and neutral (E13): neither motive reaches the student payload or text |
| Message | One template function builds the text part (unchanged content) and the HTML part for both motives and the excess notice. The reason label of `caso_especial` is "Caso especial". `MailMessage` gains optional `html` and `attachments`; `ResendMailSender` forwards them, remission mails are unchanged |
| Inline brand image | The UAM and FIA lockup travels as an inline attachment with a content id (`cid:`), because mail clients such as Gmail do not load images from `http://localhost` and a remote image would be a tracking surface. E6 ("no attachments") is about request documents; a brand image is not a document and holds no personal data. No remote resource, script or pixel in the HTML |
| Coordination tab table | The columns Carrera and Plazo no longer take their own columns: the career goes under the student and the deadline pause under the escalation time; the notification status wraps (no `whitespace-nowrap` on it) and the actions column has a narrow fixed width. The 360 px card layout is unchanged |

## Data Flow

```
Secretary  escalateAction   escalateRequest(tx)               after()            Coordinator
   |--nota-->| requireRole, scope |-- UPDATE pendiente->coord   |                     |
   |         |------------------->|-- live CarreraId, accounts>0 (else refuse, rollback)
   |         |                    |-- INSERT Escalamiento       |                     |
   |         |                    |-- audit solicitud.escalada  |                     |
   |         |-- after(dispatch) ------------------------------>| claim, recipients,  |
   |         |                                                  | plan (0 -> bloqueada)
   |                                                            |-- mail (link) ----->|
   |                         cron remission-retry drains pendiente rows              |
   |                                                    answerEscalationAction <-----|
   |                answerEscalation(tx): UPDATE Escalamiento answered,               |
   |                pause P business days -> PlazoInicioEn, UPDATE coord->pendiente,  |
   |                audit solicitud.escalamiento_resuelto                             |
   |<-- /review pendiente tab, deadline resumes                                       |
```

Excess: `recordExcessReportAction` -> lock `aprobada` -> INSERT report +
`Escalamiento(exceso)` -> audit -> `after(dispatch)`; state unchanged.

## File Changes

| File | Action | Slice |
|---|---|---|
| `src/db/schema.ts`, `drizzle/00NN_escalation.sql` (+ meta, generated) | Modify / Create | S1 |
| `src/db/migration-escalation.test.ts` | Create | S1 |
| `src/lib/intake/transitions.ts`, `business-days.ts` (+ tests) | Modify | S1 |
| `src/lib/intake/escalation.ts`, `deadline-clock.ts` (+ tests) | Create | S1 |
| `src/lib/data/solicitud-escalation.ts` (escalate, report, `countCoordinationAccounts`; + tests) | Create | S1 |
| `src/lib/data/solicitud-correction.ts` (+ test) | Modify (reset) | S1 |
| `src/lib/audit/{types,events}.ts` (+ tests) | Modify (S1 actions) | S1 |
| `src/lib/data/revision-queue.ts` (+ list functions, tests), `solicitud-detail.ts` | Modify | S2 |
| `review/page.tsx`, `review/deadline-badge.tsx`, `review/[id]/{page,request-sections,escalation-*}.tsx`, `escalation-actions.ts` (+ tests) | Modify / Create | S2 |
| `src/lib/escalation/{plan,message}.ts`, `src/lib/data/{escalamiento,escalation-dispatch}.ts` (+ tests) | Create | S3 |
| `src/app/api/cron/remission-retry/route.ts`, `src/env.ts` | Modify | S3 |
| `src/lib/intake/coordination-scope.ts`, `src/lib/data/{coordination-scope-sql,coordination-queue,escalation-answer}.ts` | Create | S4 |
| `src/app/(dashboard)/coordination/**`, `permissions.ts`, `navigation.ts`, `documentos.ts`, `api/intake/documents/[id]/route.ts` | Create / Modify | S4 |
| `requests/[id]/*`, `consent.ts` (+ test), `privacy/page.tsx` | Modify | S5 |
| `i18n/{es,en}.json` | Per slice | S2-S5 |

## Slice Plan (feature-branch-chain, 1000-line budget, generated files excluded)

| Slice | Content | Estimate |
|---|---|---|
| S1 | ES-1..ES-7, ES-13 (S1 actions), ES-16 | ~950 (fallback: split data writes into S1b) |
| S2 | ES-5 queue/badge, ES-12 | ~900 |
| S3 | ES-10, ES-11, notification audit | ~700 |
| S4 | ES-8, ES-9, RNF-01 matrix | ~900 |
| S5 | ES-14, ES-15, closeout | ~350 |

Between S1 and S3 escalations are created with notices `pendiente` and no
dispatcher; between S1 and S4 nothing answers them. The tracker merges to
`main` only after S5.

## Testing Strategy (strict TDD, Vitest)

| Layer | What | Approach |
|---|---|---|
| Unit | `sourceOf`, decision-kind uniqueness invariant; note/report/date validation (today, yesterday, tomorrow, missing); `countBusinessDays`/`addBusinessDays`; `clockStartOf`; the spec deadline table, holiday in pause, two pauses, reset on resubmit, ordering B before A; `planEscalationNotice` (0/1/n recipients, exact fields, no cause/dates/teacher, link, key stability); `coordinationScopeFor`; `canViewDocument` matrix (estudiante, secretaria, coordinacion same/other career, answered, excess, retired, `none`) | Pure |
| Schema | Generated SQL by name (ES-16) | File read |
| Data | Escalate: conflict, out of scope, zero accounts -> `sin_coordinacion` with career name and nothing written, account without email -> success, unique violation -> conflict; report: non-aprobada refused, foreign teacher refused, zero accounts recorded; answer: wrong career, already answered, business-day pause written; resubmit resets `PlazoInicioEn`; queue order by effective start; recipients use the live career | Mocked data layer |
| Real Postgres (opt-in integration) | Every new CHECK accepts/rejects (incl. `sin_destinatarios` only); `UX_Escalamiento_Abierto` (second open rejected, allowed after answer, exceso alongside); `CK_Solicitud_PlazoInicio`; recreated `IX_Solicitud_Cola` used by the queue query (EXPLAIN); escalate vs approve race -> one winner | `intake-concurrency.integration.test.ts` pattern |
| Action/Route | Role and scope re-check before parse for escalate, report, answer and resend; document route for coordinacion; cron drains both, skips `bloqueada`; resend of `enviada` writes nothing | `vi.hoisted` mocks |
| UI | Tabs, badges `en_pausa`, dialogs with confirm, E17 unavailable state naming the career, delivery status texts, coordinator list/detail/answer (blocked notice still listed), student callout, 360 px, axe; consent pins | Testing Library |

## Threat Matrix

N/A for shell, subprocess, VCS/PR automation and executable-file
classification. Routing: new authenticated `/coordination` routes and an
extended document route; both are covered by RNF-01 role/scope tests (ES-9),
no public path is added. Process integration: the existing scheduler-only cron
route gains a second batch behind the same `isScheduler` check.

## Migration / Rollout

| Step | Tag | Command / check |
|---|---|---|
| G1 | `[LOCAL]` | `npm run db:generate -- --name escalation` (after merge-order rebase) |
| P1 | `[READ-ONLY]` | Count `Solicitud` by `Estado`; list `IX_Solicitud_Cola` definition; count active `coordinacion` accounts per FIA career (E17 readiness) |
| B1 | `[CONFIRM]` | Neon branch `backup-before-escalation` |
| M1 | `[CONFIRM]` | `drizzle-kit migrate` over the direct URL |
| V1 | `[READ-ONLY]` | P1 unchanged; new index definition; both tables empty |

Rollback: revert the chain; before a `[CONFIRM]` down-migration, return every
`en_revision_coordinacion` request to `pendiente` (`[CONFIRM]` write), then
drop the tables and `PlazoInicioEn`, and restore the old index. v1 and v2
consents stay valid.

## Open Questions

- [ ] Consent v2 approval date and UAM legal review (joins request-consent 9.7).
- [ ] `APP_BASE_URL` value per environment (Vercel env, owner).
- [ ] Merge order with `document-extraction` before the S1 PR.

## UX observations (for owner decision)

1. Pendientes tab: a request back from coordination shows a later due date with
   no hint why; a "paused N days" note may help.
2. Aprobadas tab lists only the latest 50 without search (E14 cut line); RF-15
   on an older request needs the URL.
3. Approve dialog still says approval is final; consistent with E2, but the
   excess report may surprise secretaries expecting a state change.
4. The teacher picker lists remitted teachers even when the remission mail is
   still pending; a delivery hint beside each name may avoid confusion.
5. Coordinator detail has no history of answered escalations (roadmap #7).
6. D0 found coordinators with email only for Industrial and Sistemas: a FIA
   career with no active coordination account refuses every escalation
   (both motives, E17 and E18) until the administrator creates one (P1 counts them).
