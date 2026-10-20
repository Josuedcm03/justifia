# Design: Teacher Remission

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries a schema, a migration, a new port with an adapter, an outbox with a
> retry job, a staff upload path, audit events and a UI; the repository
> precedent (`secretary-review`, `justification-intake`) keeps decision tables
> over prose cuts. The deviation is deliberate.

> **DB-touching.** This document plans commands and runs none. Every database
> step is tagged `[LOCAL]`, `[READ-ONLY]` or `[CONFIRM]`; a `[CONFIRM]` step
> needs the owner's explicit "yes" for that single command (`CLAUDE.md`).

Binding inputs: `proposal.md` (D1-D8 confirmed), `exploration.md`, Engram
`sdd/teacher-remission/explore`, `docs/requirements.md` (RF-09 a-c, RN-18,
RN-19, RNF-07 a-b; also RNF-01, RNF-02, RNF-06), the archived
`secretary-review/design.md` (SR-1..SR-17). Decisions here are **TR-1..TR-16**.

**Revision 2 (RN-19).** Confirmed product decision: the **secretary uploads**
the format signed by the coordinación de carrera and stamped (thesis interview
E-02, 05:33: "luego eso me lo firma el coordinador, me lo sellan, y es lo que
yo envío"). The previous "designate one of the student's documents" model is
withdrawn. The blank template is out of scope (roadmap #12 `printable-forms`).
Changed: TR-1, TR-2, TR-4, TR-5, TR-7, TR-11, TR-13, TR-14; new: TR-15, TR-16.

## Technical Approach

Transactional outbox, hexagonal like intake. Approval writes one `Remision`
row per distinct teacher **inside** `decideRequest`'s transaction (snapshot of
teacher id, name, email and groups). After commit, `decideAction` schedules
`dispatchRemissions` with `after()`. Each send is a guarded per-row claim
(`UPDATE ... WHERE ... RETURNING`), a pure plan (blockers, message, size
guard), a `MailSender.send`, and a guarded completion that writes the audit
row in the same transaction. Failures leave the row `pendiente` with
`error_envio`; a daily cron and a manual "Reenviar" retry it. RN-19: the
secretary marks the case at approval and uploads the signed format from the
review detail through the same client-upload protocol and server-side sniffing
as intake; the upload unblocks the request's `formato_especial_faltante` rows
and dispatches them. Pure modules in `src/lib/remission/`; persistence in
`src/lib/data/`; port and wiring beside `DocumentStore`.

## Verified framework findings (Next 16.3.4)

| # | Finding | Source | Consequence |
|---|---|---|---|
| N1 | `after()` works in Server Functions and Route Handlers and "will be executed even if the response didn't complete successfully. Including when … `redirect` is called" | `04-functions/after.md` | `decideAction` can schedule the dispatch and still `redirect()` |
| N2 | `after` runs for the route's default or configured `maxDuration`; on Vercel it uses `waitUntil` | same, "Duration", "serverless" | The send must fit the function duration; a cut-off send is recovered by the claim lease plus cron (TR-6) |
| N3 | `after` is not a request-time API and does not make a route dynamic | same | No effect on the review pages' rendering or on SR-11 |
| N4 | `cookies()`/`headers()` may be read inside `after` in Server Functions | same | Not needed: the actor id is captured before `after` and passed in |

## Architecture Decisions

### TR-1. Schema

| Object | Definition | Rejected |
|---|---|---|
| `Remision` | `Id` identity PK; `SolicitudId` FK `Solicitud` (no cascade); `DocenteId` FK `Usuario` NOT NULL; `DocenteNombre varchar(160) NOT NULL`; `Correo varchar(160) NULL`; `Clases jsonb NOT NULL` (`RevisionClase[]`, that teacher's groups); `Estado varchar(20) NOT NULL default 'pendiente'`; `MotivoCodigo varchar(40) NULL`; `Intentos smallint NOT NULL default 0`; `ReclamoId uuid NULL`; `ReclamadaEn timestamptz NULL`; `EnviadaEn timestamptz NULL`; `ProveedorMensajeId varchar(100) NULL`; `CreadaEn`, `ActualizadaEn timestamptz NOT NULL default now()` | One send flag/time on `Solicitud` (sends succeed or fail per teacher, D5) |
| Constraints | `UQ_Remision_SolicitudDocente (SolicitudId, DocenteId)` (dedupe, D2); `CK_Remision_Estado` / `CK_Remision_Motivo` from code constants (TR-2) via `inList`; `CK_Remision_Enviada`: `(Estado = 'enviada') = (EnviadaEn IS NOT NULL)`; `CK_Remision_MotivoEstado`: `enviada` -> motivo NULL, `bloqueada` -> motivo NOT NULL and `<> 'error_envio'`, `pendiente` -> motivo NULL or `'error_envio'`; `CK_Remision_Correo`: `Correo IS NOT NULL OR MotivoCodigo = 'sin_correo'`; `CK_Remision_Reclamo`: `(ReclamoId IS NULL) = (ReclamadaEn IS NULL)`; `CK_Remision_Intentos >= 0`; `IX_Remision_Pendiente (CreadaEn, Id) WHERE Estado = 'pendiente'`; `IX_Remision_Solicitud (SolicitudId)` | A trigger for the state machine (procedural code drizzle-kit does not model) |
| `Solicitud.FormatoEspecial` | `boolean NOT NULL default false`; `CK_Solicitud_FormatoEspecial`: `NOT "FormatoEspecial" OR ("Estado" = 'aprobada' AND "Causa" = 'fuerza_mayor')` | A document-kind column (RF-14 d belongs to `validation-signals`) |
| `DocumentoRespaldo` (TR-16) | `SubidoPorId bigint NULL` FK `Usuario` (no cascade; NULL = uploaded by the student); `FormatoEspecial boolean NOT NULL default false`; `CK_Documento_FormatoEspecial`: `"FormatoEspecial" = ("SubidoPorId" IS NOT NULL) AND (NOT "FormatoEspecial" OR "Estado" = 'valido')`; `UX_Documento_FormatoEspecial (SolicitudId) WHERE "FormatoEspecial"` (at most one per request) | See TR-16 |

No `ON DELETE CASCADE` on the new FKs: a decided request is never deleted.
`Remision` is not append-only (it is a state machine); every write goes through
`src/lib/data/remision.ts`, pinned by a structural test (no `update(remision)`
elsewhere under `src`).

### TR-2. States, reasons and triggers (code constants)

`src/lib/remission/states.ts`, pure:

| Constant | Values |
|---|---|
| `REMISSION_STATES` | `pendiente`, `enviada`, `bloqueada` |
| `REMISSION_REASONS` | `sin_correo`, `formato_especial_faltante`, `adjuntos_exceden_limite`, `error_envio` |
| `REMISSION_TRIGGERS` | `aprobacion`, `reenvio_manual`, `reintento_automatico`, `formato_especial` |

`enviada` is terminal. Cron and `formato_especial` dispatch only `pendiente`;
manual resend accepts `pendiente` and `bloqueada`. A test pins that the CHECK
lists in the generated SQL equal these constants.

### TR-3. Migration

**Generated**, never hand-numbered: `npm run db:generate -- --name
teacher_remission` `[LOCAL]` (expected `0009_teacher_remission.sql`; re-check
`drizzle/` on `main` first). Purely additive (one table, two boolean columns
and one nullable FK column, CHECKs, indexes): no backfill. Test
`src/db/migration-teacher-remission.test.ts` follows
`migration-secretary-review.test.ts`: located by name, journal `when` later
than `0008`'s, each CHECK, FKs without cascade, the partial indexes, and no
`DROP`/`ALTER ... TYPE` statement.

### TR-4. Creation inside the approval transaction

```
decideRequest (aprobada) tx:
  guarded UPDATE Solicitud (unchanged) RETURNING causa, ...
  [formatoEspecial] causa !== 'fuerza_mayor' -> tx.rollback() -> invalid
                    UPDATE Solicitud SET FormatoEspecial = true
  INSERT SolicitudDecision; audit solicitud.aprobada (unchanged)
  teachers = listRequestTeachers(tx, id)          // solicitud-clases.ts (SR-3)
  rows = buildRemissionRows(teachers)             // pure: dedupe DocenteId, snapshot
  INSERT Remision ... RETURNING Id; audit remision.creada per row
 -> { ok: true; remisionIds: number[]; formatoEspecial: boolean }
```

- `listRequestTeachers` lives in `solicitud-clases.ts` (the only module that
  joins the class tables, SR-3) and returns `{ docenteId, nombre, correo,
  clases }` per teacher, groups ordered as today. Groups without a teacher
  yield no row; the detail shows them as "no teacher identified".
- `buildRemissionRows` (pure, `src/lib/remission/recipients.ts`): null
  `correo` -> `bloqueada` + `sin_correo` (D6); otherwise `pendiente`.
- Reject and return create nothing (test).

### TR-5. RN-19 model: mark at approval, staff upload afterwards

| Moment | Behaviour |
|---|---|
| Approve dialog | When `causa = 'fuerza_mayor'`: checkbox "Special-format case (RN-19)" with a hint that the signed format is uploaded from the detail right after approving. No file input in the dialog |
| After a marked approval | `decideAction` redirects to `/review/{id}` (not `/review`) so the secretary lands on the upload control. The new page view is a new audited read, which is correct (SR-11 forbids revalidating the same view, not navigating) |
| Dispatch | Marked and no format -> `bloqueada` + `formato_especial_faltante`; marked with format -> attach **only** the format; unmarked -> all current valid documents with `SubidoPorId IS NULL` |
| Upload (TR-15) | Allowed while the request is `aprobada`, marked, and has no format; it unblocks the `formato_especial_faltante` rows and dispatches them |

`validateDecision` gains: the mark only on `aprobada`. Rejected: an upload
inside the approve dialog (a second token state rule for undecided requests,
an orphan blob on every cancelled dialog, a pathname threaded through
`decideAction`; about +150 lines for the same outcome one redirect away).

### TR-6. Guarded per-row claim (idempotency)

```sql
UPDATE "Remision" SET "ReclamoId" = $uuid, "ReclamadaEn" = $now,
       "Intentos" = "Intentos" + 1, "ActualizadaEn" = $now
 WHERE "Id" = $id AND "Estado" IN (<allowed for trigger>)
   AND ("ReclamadaEn" IS NULL OR "ReclamadaEn" < $now - LEASE)
RETURNING ...
```

- `CLAIM_LEASE_MS = 10 min` (> any function duration). 0 rows -> skip
  (`enviada`, or another attempt holds it).
- Every completion is `UPDATE ... WHERE "Id" = $id AND "ReclamoId" = $uuid`
  and clears the claim; a stale worker whose lease was taken over matches 0
  rows and writes nothing.
- Provider idempotency: `idempotencyKey = remision-{Id}-{digest}`, where
  `digest` is a short SHA-256 of recipient, CC and attachment ids/sizes. A
  crash after the provider accepted but before the completion re-sends the
  same key within the provider window and is deduplicated; a changed payload
  (email fixed, format uploaded) gets a new key.
- Concurrency test on real Postgres (opt-in `intake-concurrency` suite): two
  parallel dispatches of one row -> one `send` call, one `EnviadaEn`.

### TR-7. Dispatch pipeline

`src/lib/data/remission-dispatch.ts`:
`dispatchRemission(id, { trigger, actorId }, deps: { store, mail, now })`.

1. Claim (TR-6). Manual resend of `sin_correo` re-reads `Usuario.Correo` by
   `DocenteId` and refreshes the snapshot only when it is now set.
2. Load request (`Causa`, dates, `EstudianteNombre`, `EstudianteCif`,
   `EstudianteCorreo`, `FormatoEspecial`) and its current valid documents with
   `SubidoPorId` and `FormatoEspecial`.
3. Pure `planRemission` (`src/lib/remission/plan.ts`), gate order:
   `sin_correo` -> `formato_especial_faltante` -> `adjuntos_exceden_limite`
   -> `{ kind: "send", message, documentIds }`. Document selection per TR-5.
4. Blocked -> `bloqueada` + reason, audit `remision.bloqueada`.
5. Read bytes via `DocumentStore.stream`; a missing or failed read ->
   `pendiente` + `error_envio`.
6. `mail.send` -> ok: `enviada`, `EnviadaEn = now`, `ProveedorMensajeId`,
   audit `remision.enviada`; failure: `pendiente` + `error_envio`, audit
   `remision.fallida`.

`dispatchRemissions(ids, ...)` runs rows sequentially and never throws (each
row's failure is contained, logged as codes only).

### TR-8. Post-commit send: `after()` (N1, N2)

`decideAction` captures `actorId`, then on an `aprobada` success calls
`after(() => dispatchRemissions(remisionIds, { trigger: "aprobacion", actorId },
getIntakeDeps()))` and `redirect()`s (to the detail when marked, TR-5).
Rejected: inline await before redirect (approval UX would wait on the
provider, up to tens of seconds with attachments); a queue service (overkill,
D2). If `after` is cut off, the lease expires and the cron picks the row up.

### TR-9. `MailSender` port, Resend adapter, fake

```ts
// src/lib/intake/ports.ts
export type MailAttachment = { filename: string; contentType: string; content: Uint8Array };
export type MailMessage = {
  to: string; cc: readonly string[]; subject: string; text: string;
  attachments: readonly MailAttachment[]; idempotencyKey: string;
};
export type MailResult = { ok: true; providerId: string } | { ok: false; code: "not_configured" | "rejected" | "unavailable" };
export interface MailSender { send(message: MailMessage): Promise<MailResult>; }
```

| Element | Choice |
|---|---|
| Adapter | `src/lib/intake/adapters/resend-mail-sender.ts`: plain `fetch` `POST https://api.resend.com/emails`, `Authorization: Bearer`, `Idempotency-Key` header, JSON `{ from, to: [to], cc, subject, text, attachments: [{ filename, content: base64 }] }`; `fetch` injected for tests; timeout via `AbortSignal.timeout(20_000)` |
| Why fetch | One endpoint, no new dependency, trivially faked; rejected: the `resend` SDK (dependency for one call, harder to stub) |
| Body | Plain text only; rejected: HTML (injection surface from names, no benefit) |
| Config | Asserted **inside `send`**, not at construction: `getIntakeDeps()` also serves the document route, which must keep working without mail config. Missing config -> `not_configured` -> row `pendiente` + `error_envio` (D1: rows wait until DNS/keys exist) |
| Wiring | `IntakeDeps.mail` in `src/lib/intake/deps.ts`; `createFakeMailSender()` in `fakes.ts` records sent messages, can be scripted to fail or to dedupe by idempotency key |

`src/env.ts`: `RESEND_API_KEY: optionalSecret(1)`, `MAIL_FROM` (optional,
`"Name <address>"` validated at use). Values go in Vercel env, never in code.

### TR-10. Message (RN-18, D8) and size guard (D3)

`src/lib/remission/message.ts` (pure, Spanish constants, independent of UI
locale like SR-8): subject `Justificar la inasistencia de {estudiante}`,
the form the secretary uses in the real cases (EXP-02, EXP-03, EXP-04;
`thesis-workspace/investigacion/expedientes/`). The body follows her opening
("Buenos días, su apoyo en justificar la inasistencia de {estudiante} por
{causa}, {fechas}.") and closing ("Gracias de antemano."), then lists the
student CIF, **only that teacher's groups** from `Remision.Clases` and the
attachment names. The cause phrase and the `{fechas}` formatter are reused
from `decision-templates.ts`.

The warning (RN-18) is built per cause from two constants:

- `RN18_WARNING`, always present: "Esta justificación habilita la
  reprogramación de las evaluaciones o actividades de las fechas indicadas; no
  elimina la inasistencia del registro."
- `RN18_DISCRETION_NOTE`, appended only for `fuerza_mayor`: "Por tratarse de
  una causa de fuerza mayor, la aplicación de penalizaciones en las
  evaluaciones reprogramadas queda a criterio del docente." Source: E-02
  [20:17] — for health, sports and maternity the rectification applies "sí o
  sí"; for causes "de otra índole" a penalty "puede quedar a criterio del
  docente". `intercambio_academico` is not mentioned in E-02 and gets only
  the base warning.

To: snapshot email; CC: `EstudianteCorreo`. Tests pin the subject, both
warnings per cause, per-teacher group isolation and the CC. Owner-approved
2026-10-19. The real cases also copy the career coordinator; that is outside
RF-09 and is not done here.

`src/lib/remission/limits.ts`: `MAX_REMISSION_ATTACHMENT_BYTES = 25 MiB` of
raw bytes summed from `DocumentoRespaldo.TamanoBytes` (checked before any
download). Rationale: Resend's documented message limit is 40 MB including
base64 (+33 %); 25 MiB raw is about 35 MB encoded plus the body. A single
format is at most `MAX_DOCUMENT_BYTES` (10 MiB), so a special-format remission
never trips the guard. Over the limit -> `bloqueada` + `adjuntos_exceden_limite`.

### TR-11. Detail actions

`src/app/(dashboard)/review/[id]/remission-actions.ts`. Common guards:
`requireRole(...rolesRevisores)`; `resolveRequestScope`; `none` ->
`not_found`; lookup joined to `Solicitud` with `requestInScope(scope)`; absent
or out of scope -> the same `not_found` (RNF-01).

| Action | Rule |
|---|---|
| `resendRemissionAction(remisionId)` | Audit `remision.reenviada`; `dispatchRemission(..., { trigger: "reenvio_manual" })` **awaited**; returns the updated row view. `enviada` -> claim matches nothing -> `{ ok: true, estado: "enviada" }`, nothing sent |
| `attachSpecialFormatAction(solicitudId, { pathname, nombreOriginal })` | TR-15 attach; on success `after(() => dispatchRemissions(ids, { trigger: "formato_especial", actorId }))`; returns the rows as `pendiente` and the document view. Errors: `not_found`, `not_allowed`, `already_attached`, and the intake rejection codes (`empty_file`, `too_large`, `unsupported_format`) |

Neither revalidates nor redirects the detail, so the audited detail read stays
exactly-once (SR-11). The attach dispatch uses `after()` (one row per teacher,
each with a file of up to 10 MiB, may outlast an awaited action); the section
tells the secretary sending is in progress and to reload for the result.

### TR-12. Retry cron

`src/app/api/cron/remission-retry/route.ts` (`GET`): the constant-time
`Bearer ${CRON_SECRET}` check of `intake-sweep`, extracted to
`src/app/api/cron/scheduler-auth.ts` and reused by both routes (fails closed
without the secret). Selects up to 20 `pendiente` rows with an expired or no
claim and `Intentos < MAX_AUTO_ATTEMPTS (8)`, oldest first, and dispatches
sequentially with `trigger: "reintento_automatico"`. Responds with counts only.
`vercel.json`: add `{ "path": "/api/cron/remission-retry", "schedule":
"0 10 * * *" }` (daily, Hobby-compatible; see Open Questions).

### TR-13. Audit events (codes only)

| Action | Entity | `datos` |
|---|---|---|
| `remision.creada` | `Remision` | `{ solicitudId, estado, motivo? }` |
| `remision.enviada` | `Remision` | `{ solicitudId, origen, intentos, adjuntos }` |
| `remision.fallida` | `Remision` | `{ solicitudId, origen, intentos, codigo }` |
| `remision.bloqueada` | `Remision` | `{ solicitudId, origen, motivo }` |
| `remision.reenviada` | `Remision` | `{ solicitudId, estadoPrevio }` |
| `documento.formato_especial` | `DocumentoRespaldo` | `{ solicitudId, tipo, tamanoBytes, remisionesDesbloqueadas }` |
| `documento.rechazado` (existing builder) | as today | `{ solicitudId, reason }` for a refused staff upload |

`AuditEntityType` gains `Remision`. `origen` is a `REMISSION_TRIGGERS` code.
**Actor:** `EventoAuditoria.ActorId` is NOT NULL; approval, upload and manual
resend use the session user; the cron uses the approving secretary
(`SolicitudDecision.SecretariaId` of the approval) with `origen:
"reintento_automatico"`. Rejected: no audit for cron sends (RNF-06 a); a system
user (new seed data). No email, name, cause, dates, file name, pathname,
provider id or message text in any payload; the leak test is extended to every
new builder.

### TR-14. Review detail UI

| Element | Content |
|---|---|
| `review/[id]/remission-section.tsx` (client) | Shown when `estado = 'aprobada'`. Per teacher: name, snapshot email, groups, state pill with text (`pendiente` / `enviada` / `bloqueada`), send time (`America/Managua`, RF-09 c), reason sentence, "Reenviar" (`outline`, `lg`, hidden when `enviada`, pending state, `role="alert"` on failure). When marked and without format: the upload control (TR-15); once uploaded: the format's name with the existing download link |
| `review/[id]/special-format-upload.tsx` (client) | One file input (`accept` from `ALLOWED_CONTENT_TYPES`), client pre-check against `MAX_DOCUMENT_BYTES` (UX only), `upload()` from `@vercel/blob/client` to the TR-15 token route with pathname `intake/{id}/{uuid}.{ext}`, then `attachSpecialFormatAction`; pending and error states, 44 px targets |
| `page.tsx` | Adds `listRemissions(detail.id)` (data module, scope already enforced by `getRequestDetail`) before `recordRequestRead`; one audit row covers the read |
| `decision-dialog.tsx` | RN-19 checkbox and hint on approve, only for `fuerza_mayor` |
| `solicitud-detail.ts` | `formatoEspecial` on the detail; the format document separated from the student's documents (`subidoPorStaff`) |
| `student-requests.ts` | The student's document list keeps `SubidoPorId IS NULL` (a staff artifact is not the student's evidence) |
| i18n | `review.remission.*` (states, reasons, actions, upload, empty "no teacher identified") and `review.decision.approve.specialFormat.*` in `es` and `en`; tokens from `docs/design-system.md`; 360 px stacked |

### TR-15. Staff upload path for the special format

Files of up to 10 MiB exceed the Vercel function body limit (4.5 MB), so a
Server Action receiving `FormData` is not viable; the staff path reuses
intake's client-upload protocol (browser -> private Blob, the function never
sees the bytes) and its finalize-time sniffing.

| Step | Rule |
|---|---|
| Token | `src/app/api/review/special-format-token/route.ts` (`POST`, `handleUpload`). Authenticates itself (the proxy never sees `/api`): session, `debeCambiarClave` false, `canReviewRequests`, `resolveRequestScope` not `none`. `onBeforeGenerateToken(pathname)`: `solicitudIdOf(pathname)` and `isUnderDraftPrefix`; `getSpecialFormatContext(id, scope)` = request in scope, `aprobada`, `FormatoEspecial`, no format document. Any failure -> one uniform `400 not_allowed` (no existence oracle, RNF-01). Token: `ALLOWED_CONTENT_TYPES`, `MAX_DOCUMENT_BYTES`, `UPLOAD_TOKEN_TTL_MINUTES`, no random suffix, no overwrite. No `onUploadCompleted` (as intake) |
| Inspect | Extract `inspectStoredFile(pathname, store)` from `finalizeDocument` in `documentos.ts` (`readHead` + `refusalFor` + `detectSignature`); `finalizeDocument` uses it unchanged (existing tests pin behaviour). Refusal -> best-effort blob delete, `documento.rechazado`, reason code returned |
| Attach | `attachSpecialFormat(...)` in `src/lib/data/special-format.ts`, one transaction: `SELECT ... FOR UPDATE` the `Solicitud` with the same conditions as the token plus `requestInScope`; `INSERT DocumentoRespaldo` (`Estado = 'valido'`, detected type and real size, `SubidoPorId = actor`, `FormatoEspecial = true`, normalized `NombreOriginal`); `unblockSpecialFormat(tx, solicitudId)` in `remision.ts` (`bloqueada` + `formato_especial_faltante` -> `pendiente`, motivo NULL); audit `documento.formato_especial`. Returns the unblocked ids plus the request's other `pendiente` ids (a dispatch cut off before blocking) |
| Races | Two secretaries: the row lock serialises; the second sees the format and returns `already_attached`; `UX_Documento_FormatoEspecial` and the `Pathname` unique are the backstops (unique violation -> `already_attached`). The loser's blob is deleted best effort |
| Abandoned upload | Pathname under `intake/{id}/`: an unfinalized blob is removed by the existing orphan sweep after `ORPHAN_GRACE_HOURS`; no sweep change |
| Download | Existing `/api/intake/documents/[id]` and `canViewDocument` apply unchanged (staff in scope, owner student) |

Rejected: a new `DocumentStore.put` with a server-side upload (body limit
above); widening the student `upload-token` route with a staff branch (mixes
two authorization models in one handler that is RNF-01-critical).

### TR-16. Storage model of the staff-uploaded format

| Option | Tradeoff | Decision |
|---|---|---|
| `DocumentoRespaldo` + `SubidoPorId` + `FormatoEspecial` | Reuses the type/size CHECKs, pathname uniqueness, orphan sweep, download route and `canViewDocument`; dispatch reads one table. Cost: student-facing list and unmarked dispatch must filter `SubidoPorId IS NULL`; the 5-document cap counts it, harmless because an `aprobada` request is never editable again | **Chosen** |
| Separate `FormatoEspecial` table (`SolicitudId` PK, pathname, type, size, uploader) | Cleanest semantics, but a second orphan-sweep reference, a second download route with its own authorization, duplicated CHECKs; about +150 lines and a second RNF-01 surface | Rejected |
| Flag a student document (previous TR-5) | No upload code, but contradicts E-02: the signed paper is with the secretary, not the student | Withdrawn |

`FormatoEspecial` is kept beside `SubidoPorId` (rather than deriving the flag
from the uploader) so a later staff upload of another kind does not change
dispatch semantics; the CHECK ties them for now.

## Data Flow

```
secretaria -> decideAction -> decideRequest tx: UPDATE, decision, audit,
                                 Remision rows + remision.creada
           -> after(dispatchRemissions) -> redirect /review (or /review/{id} if marked)
dispatch:  claim (UPDATE ... RETURNING) -> planRemission (pure)
           -> DocumentStore.stream -> MailSender.send -> complete (guarded) + audit
upload:    browser -> /api/review/special-format-token (scope) -> private Blob
           -> attachSpecialFormatAction -> inspectStoredFile -> tx: insert doc,
              unblock rows, audit -> after(dispatchRemissions "formato_especial")
cron       -> /api/cron/remission-retry (Bearer) -> pendiente rows -> dispatch
secretaria -> /review/[id] RemissionSection -> resendRemissionAction -> dispatch
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/db/schema.ts`, `drizzle/0009_teacher_remission.sql` (+ meta) | Modify / Create (generated) | TR-1 |
| `src/db/migration-teacher-remission.test.ts` | Create | TR-3 |
| `src/lib/remission/{states,recipients,message,limits,plan}.ts` (+ tests) | Create | Pure domain |
| `src/lib/data/solicitud-clases.ts` | Modify | `listRequestTeachers` |
| `src/lib/data/solicitud-decision.ts`, `src/lib/intake/decision-validation.ts` | Modify | TR-4, TR-5 |
| `src/lib/data/remision.ts`, `remission-dispatch.ts` (+ tests) | Create | Claim, completion, unblock, listing, dispatch |
| `src/lib/data/special-format.ts` (+ test), `src/lib/data/documentos.ts` | Create / Modify | TR-15 attach; extract `inspectStoredFile` |
| `src/app/api/review/special-format-token/route.ts` (+ test) | Create | TR-15 token |
| `src/lib/intake/{ports,deps,fakes}.ts`, `adapters/resend-mail-sender.ts` | Modify / Create | TR-9 |
| `src/env.ts` | Modify | Mail env vars |
| `src/lib/audit/{types,events}.ts` | Modify | TR-13 |
| `src/app/(dashboard)/review/[id]/actions.ts`, `page.tsx`, `decision-dialog.tsx` | Modify | TR-5, TR-8, TR-14 |
| `src/app/(dashboard)/review/[id]/{remission-actions.ts,remission-section.tsx,special-format-upload.tsx}` (+ tests) | Create | TR-11, TR-14, TR-15 |
| `src/lib/data/solicitud-detail.ts`, `src/lib/data/student-requests.ts` | Modify | Format separation and filter |
| `src/app/api/cron/{scheduler-auth.ts,remission-retry/route.ts}`, `intake-sweep/route.ts`, `vercel.json` | Create / Modify | TR-12 |
| `i18n/{es,en}.json` | Modify | TR-14 |
| `docs/roadmap.md` | Modify | Row 3 status at archive |

## Size Estimate (excluding generated `drizzle/meta` snapshot)

| Area | Production | Tests |
|---|---|---|
| Schema + migration SQL | ~90 | ~90 |
| Pure domain (`src/lib/remission/*`) | ~230 | ~300 |
| Teachers, decision, validation | ~100 | ~120 |
| `remision.ts` + dispatch | ~310 | ~340 |
| Mail port, adapter, fake, env | ~150 | ~120 |
| Audit | ~50 | ~30 |
| Review actions, section, dialog, page, detail | ~290 | ~260 |
| Cron + scheduler auth | ~70 | ~70 |
| **RN-19 staff upload (TR-15, TR-16)** | ~290 | ~290 |
| i18n | ~70 | — |
| **Total** | **~1,650** | **~1,620** |

About **3,270 lines**, against a 2,000-line single-PR budget. The staff
upload adds about +430 net over the withdrawn designation model. The design
does not decide delivery; a natural split is PR 1 (schema, outbox, dispatch,
mail port and adapter, cron; approvals create rows and send) and PR 2 (review
detail UI, resend, RN-19 staff upload). Before PR 2 merges, a marked request
simply stays blocked, which the spec already allows.

## Testing Strategy (strict TDD, Vitest)

| Layer | What | Approach |
|---|---|---|
| Unit | dedupe and snapshot; gate order; document selection (unmarked excludes staff uploads, marked sends only the format); per-teacher groups; RN-18 warning, cause, CC; size guard at/over limit; idempotency digest stable/changing; `validateDecision` RN-19 rule | Pure, no I/O |
| Adapter | Resend request shape, base64, headers, timeout, 4xx/5xx/abort mapping, missing config -> `not_configured` | Injected fake `fetch` |
| Data | creation in the approval tx; claim states per trigger; stale claim takeover; guarded completion; mail failure keeps `aprobada`; attach: valid pdf/png/jpeg accepted, empty/oversized/forged type refused with blob deleted and `documento.rechazado`, unmarked/not approved/out of scope refused, second attach `already_attached`, unblock only `formato_especial_faltante` (a `sin_correo` row stays blocked); `finalizeDocument` regression after the extraction | Mocked data layer and `createFakeDocumentStore`; real Postgres opt-in for concurrent claims and concurrent attach |
| Actions/routes | resend and attach: role, scope, unknown id == out of scope, `enviada` sends nothing, attach schedules `after` with `formato_especial`; token route: 401/403, student role refused, wrong prefix, out of scope, not marked, already attached all -> same `not_allowed`, token limits; marked approval redirects to the detail; cron 401 without/with wrong secret, counts | `vi.hoisted` mocks (as `actions.test.ts`, `upload-token/route.test.ts`), fake `MailSender` |
| Schema / audit | CHECK lists equal constants; `CK_Documento_FormatoEspecial`; leak test over new builders (no pathname or file name); only `remision.ts` writes `Remision` | Generated SQL by name; file scan |
| UI | state pills with text, resend pending/failure, upload control only when marked and missing, upload error codes mapped to messages, RN-19 checkbox only for `fuerza_mayor`, 44 px targets, 360 px, es/en keys | Testing Library + user-event |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification
or process integration. Uploaded files are classified by magic bytes, never
executed; the new HTTP surfaces (token route, cron route, two actions) are
covered by TR-11, TR-12 and TR-15 and their RNF-01 tests; outbound mail is TR-9.

## Migration / Rollout

| Step | Tag | Command / check |
|---|---|---|
| G1 | `[LOCAL]` | `npm run db:generate -- --name teacher_remission` (no DB access) |
| P1 | `[READ-ONLY]` | Counts: `Solicitud` by `Estado`; docentes with `Correo IS NULL` among groups of pending requests |
| B1 | `[CONFIRM]` | Neon branch `backup-before-teacher-remission` |
| M1 | `[CONFIRM]` | `drizzle-kit migrate` over the direct (non-pooler) URL |
| V1 | `[READ-ONLY]` | P1 unchanged; new booleans all `false`; `SubidoPorId` all NULL; `Remision` empty |

Order: merge with mail env unset (rows stay `pendiente`, approvals unaffected)
-> configure `RESEND_API_KEY`, `MAIL_FROM` after UAM IT verifies the sender
domain -> first manual resend from the detail -> cron takes over. Approvals made
before 0009 create no rows (no backfill). Rollback: revert the PR and the cron
entry; a `[CONFIRM]` down-migration drops `Remision` and the three new columns
(staff-uploaded format blobs remain under `intake/{id}/` and are swept as
orphans once their rows are gone); requests and decisions are untouched.

## Accepted deviations during apply

Recorded in `apply-progress.md` (Deviations and decisions; S5 decisions) and
confirmed by verify on 2026-10-19 (pass with warnings). The TR text above is
unchanged; where they differ, the code follows this table.

| TR | Deviation | Reason |
|---|---|---|
| TR-5, TR-8 (task 5.1) | A marked approval does not schedule `after()`; also skipped when the approval created no remission | Every row of a marked approval is born `bloqueada` (`sin_correo` or `formato_especial_faltante`) and `aprobacion` claims only `pendiente`, so the dispatch is a provable no-op; the format upload (TR-15) dispatches the unblocked rows |
| TR-6 | A `not_configured` send gives the claim's attempt back (`Intentos - 1`) | Otherwise rows burn the automatic-attempt cap (8) while the mail env is unset and the cron never takes over after the rollout; pinned by `remision.test.ts` |
| TR-9 (task 3.2) | The Resend adapter maps `408`, `409` and `429` to `unavailable`; every other `4xx` is `rejected` | All three clear on a later attempt (lease or key expiry, rate or quota reset); both outcomes leave the row `pendiente` with `error_envio`, only the audit `codigo` differs |
| TR-10 | The opening reads "por motivos {causa}" (shared `CAUSE_PHRASES`), not "por {causa}" | Wording only; subject, `RN18_WARNING`, `RN18_DISCRETION_NOTE` and the closing stay verbatim |
| TR-11 | `resendRemissionAction` returns `{ ok, estado, motivo }`, not only `estado`; `skipped` and `lost` map to `pendiente` | The control says what happened without revalidating the page (SR-11) |
| TR-15 (token) | The token route answers `403` only for `debeCambiarClave` (`401` when unauthenticated); every non-reviewer role and every request-related failure gets the uniform `400 not_allowed` | Spec reading of RNF-01: one answer, no existence or role oracle |
| TR-15 (attach) | The attach never deletes a file already referenced by any document row (student evidence); the unique-violation backstop keeps the file. Action denials are all `not_allowed`; `not_found` means the stored file is missing | A best-effort delete must never remove evidence another row points to |

## Open Questions

- [ ] Delivery: the estimate (~3,270 lines) exceeds the 2,000-line single-PR
  budget; the orchestrator/owner chooses a budget exception or the two-PR
  split above.
- [ ] Verify against current Resend docs before apply (Context7 was not
  available in this session): the 40 MB limit including base64, the
  `Idempotency-Key` window (24 h) and its behaviour after a failed first
  attempt, and the response shape.
- [ ] Vercel plan: Hobby allows daily crons only; on Pro, change TR-12 to
  hourly.
- [x] RN-18 warning wording: owner approved `RN18_WARNING`,
  `RN18_DISCRETION_NOTE` and the subject on 2026-10-19 (see TR-10).
- [ ] Replacing a wrongly uploaded format is out of scope (one format per
  request; no remove action). Confirm with the owner if needed.
- [ ] `validation-signals` (RF-14 d) may later introduce document types;
  `DocumentoRespaldo.FormatoEspecial` is the migration source there.
