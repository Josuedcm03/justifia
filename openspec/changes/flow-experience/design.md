# Design: Flow Experience (roadmap row 13, Table 19 plus UX-20 and UX-21)

## Technical Approach

This design follows the approved proposal (owner, 2026-11-20) and its four defaults:

- A second escalation stays allowed, with a soft notice.
- Previews are client-side only.
- A future start date shows a non-blocking notice.
- Decided cards show the reason.

Ten slices run on tracker `feat/flow-experience` as a Feature Branch Chain, in the proposal's order. S1 to S7 and S9 are UI, copy or read-path changes with no schema change. S8 adds migration `0016`, which only widens existing constraints. S10 carries evidence and docs. The thesis (`C:\thesis-workspace`) is the source of truth. The 4.9 cases are rows of Table 13: 4.9:15 RF-01, :20 RF-06, :21 RF-07, :22 RF-08, :24 RF-10 and :28 RF-16.

Every new read is batched or reuses data the page already loads. No slice adds a route, a Server Action or an audit event, so the access matrix (`src/test/access/matrix-table.ts`) needs no row. Its inventory test must stay green.

CodeGraph has no index for the `p1` worktree, and no shell was available to initialize one. The code was therefore read with Read and Grep, and every anchor below refers to `p1` (main `8a3f270`). The only Next.js rule relied on is that Client Component props must be serializable (`node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md:50`). Every value that crosses into a client module is a plain string, number or boolean, formatted on the server.

Copy register: the staff namespaces (`review.*`) already use "usted" and are pinned (`src/i18n/review-messages.test.ts:579, 961`). The student namespaces (`intake`, `requests`) and the admin namespace (`users`) are written in "tú" today. As instructed, every new or changed line here uses "usted", and most lines are register-neutral labels. See Open Questions.

## Architecture Decisions

| # | Topic | Options | Tradeoff | Decision |
|---|---|---|---|---|
| D1 | RF-16 banner data | new read / `detail.escalamientos` | The detail already selects the answer, author and date (`solicitud-detail.ts:233-256`) | Pure `latestAnswer(escalations)` takes the last escalation with `respondidaEn` and `respuesta` set. The banner shows only while the request is `pendiente` |
| D2 | RF-16 banner place | inside section 2 / top of the stack | The answer was buried above a long page (exploration P2.5) | The banner is the first child of the section stack, before `ChangesSection` (`page.tsx:262`). It uses the existing answer callout tokens (`escalation-section.tsx:164`) and links to `#escalation-title` |
| D3 | Second escalation | block / soft notice | `UX_Escalamiento_Abierto` already allows a new escalation once the earlier one is answered | Soft notice in the dialog only. No server change |
| D4 | RF-06 "Vence primero" | first visible row / `queue.rows[0]` | Under a search filter, the first visible row is not the first due | The marker goes on `queue.rows[0].id` (whole queue, deadline order, `revision-queue.ts:80`). It shows only if that row is visible. Ties in the deadline date keep the SQL order |
| D5 | RF-10 stale errors | `cleared` state set / filter the failure | Filtering to an empty list would trip the "unexpected" banner (`escalate-dialog.tsx:70-73`) | `withoutFieldErrors(failure, field)` in `dialog-parts.tsx` returns `null` when no field error remains. It is called on every change |
| D6 | RF-07 subjects | per-card read / one batched read | N+1 | `listOwnRequests` issues at most 3 selects for any N: the rows, `listRequestClasses(db, ids)`, and one decisions select for the `devuelta`/`rechazada` ids. The latest decision per request is reduced in TS |
| D7 | RF-07 reason | RN-17 code only / code or text | `rechazada` carries no motive code (`es.json:1300`) | Card reason = RN-17 label when `motivoCodigo` is set, otherwise the decision text cut to 140 characters and clamped to 2 lines; a rejection text is cut from its reason on, without the fixed template introduction (`withoutRejectionIntro`, owner decision 2026-11-24, S9e). Only `devuelta` and `rechazada` cards show one; an `aprobada` card never does (owner decision 2026-11-20: approval text is template boilerplate, the detail has the full text) |
| D8 | RF-08 preview | server route / object URL / preview before upload | The server route writes `documento.descargado` (`route.ts:88-98`). Preview-before-upload adds a step to every attach | Object URL for every file attached during the current visit to step 3, keyed by the `documentId` the finalize action already returns (`step-actions.ts:155`). Earlier files keep the audited "Ver" link. Assigning and revoking follows `credentials-download.tsx:27-39` (the ref is assigned in an effect, and cleanup revokes) |
| D9 | RF-08 Nuevo/Anterior | diff in client / latest revision ids | The latest `SolicitudRevision` of a `devuelta` request is the version just returned (SR-17) | New owner-scoped `getReturnedDocumentIds(userId, id)` (one select). It is fail-soft: on failure the names show without marks |
| D10 | RF-01 "today" | client clock / server | A client clock risks a hydration mismatch and the host time zone | `managuaToday(new Date())` (`dates.ts:20`) runs in both pages and is passed down as `today`. Pure `startsAfterToday(range, today)` compares ISO strings |
| D11 | `otro` constants | new list / extend `ESCALATION_REASONS` | The schema CHECKs, the index predicate and every read filter render from the arrays (`schema.ts:767-809`, `inArray(..., ESCALATION_REASONS)` in 6 readers) | Insert `"otro"` after `"caso_especial"` in both `ESCALATION_KINDS` and `ESCALATION_REASONS`. The note rule (`CK_Escalamiento_Kind`) then covers it, and so does answerability (`CK_Escalamiento_SinRespuesta`) |
| D12 | UX-21 resolution | single lookup / ordered | `Correo` is nullable (`schema.ts:130`) and its UNIQUE is case-sensitive, while the lookup lowercases | An input containing `@` resolves by email, case-insensitive and trimmed, for any role. An email that matches 2 rows is refused. Otherwise the input resolves by CIF, students only. No legacy `Login` step ships (owner decision 2026-11-20, task 9.1): the stored `Login` is never an identifier, and the production counts of accounts without an email, email collisions and non-digit CIFs were all zero |
| D13 | Rate limiting | add / none | None exists (no `proxy.ts`/`middleware.ts`, no limiter). Adding one is new infrastructure | None in this change. A backlog entry records it. Timing is equalized instead: an unknown identifier and an inactive account still run `verifyPassword` against a constant dummy hash (the inactive case since S9f) |
| D14 | `Login` column | drop / keep and derive | Dropping it is a migration, and it is the session claim (`login/actions.ts:41`) | Keep it. Staff get `deriveLogin(correo)` (`src/lib/import/normalize.ts:21`, as import does). A registered student gets the trimmed CIF |

## Data Flow

```
RF-16  getRequestDetail ─► detail.escalamientos ─► latestAnswer() ─┬─► <AnswerBanner/> (top)
                                                                    ├─► decision copy (answered?)
                                                                    ├─► <EscalateDialog previousAnswer/>
                                                                    └─► <HistorySection escalations=n/>
RF-07  listOwnRequests: rows ─► ids ─► Promise.all[listRequestClasses, latest decisions] ─► cards
RF-08  pick File ─► upload ─► finalize ─► {documentId} ─► Map<documentId, File> (step 3 state)
         "Vista previa" ─► mount <LocalPreview> ─► effect: el.src = createObjectURL ─► cleanup: revoke
```

UX-21 login (sequence):

```
LoginForm ──login, password──► loginAction
loginAction: loginSchema (trim, ≤160) ─► findLoginAccount(identifier)
  has "@" ? select by lower(Correo) = lower(trim) LIMIT 2 ── 2 rows ─► null
          : select by Cif = cleaned (spaces and hyphens removed)
            ── rol ≠ estudiante ─► skip, none ─► null  (no Login step)
  user null  ─► verifyPassword(pw, DUMMY_HASH) ─► generic error
  inactive or bad password ─► generic error
  ok ─► signSession({ login: user.login, … }) ─► redirect
```

## Slices

### S1 — RF-16: the answer at the top (Crítica, 4.9:28)

| File | Action | Change |
|---|---|---|
| `src/app/(dashboard)/review/[id]/answer-banner.tsx` (+test) | Create | `latestAnswer()` (pure) and sync presentational `AnswerBanner({ answer })`: an `h2`, the quoted answer (`whitespace-pre-wrap break-words`), the byline and a link to `#escalation-title` |
| `review/[id]/page.tsx` | Modify | Container: `answer = pending ? latestAnswer(detail.escalamientos) : null`. Renders the banner first in the stack. Decision copy uses `descriptionAnswered` when `answer` is set. Passes `previousAnswer={ text, byline }` (formatted in `BUSINESS_TIME_ZONE`) and `escalations` count |
| `review/[id]/escalate-dialog.tsx` | Modify | Prop `previousAnswer: { text; byline } \| null`. Shows a `role="note"` block above the motive (`max-h-32 overflow-y-auto`). Confirm is unchanged |
| `review/[id]/request-sections.tsx` | Modify | `HistorySection` prop `escalations: number`. When it is > 0, a muted line with a link to `#escalation-title` |

i18n (`review.detail.answerBanner.*`, `review.detail.decisionPanel.descriptionAnswered`, `review.escalation.dialog.previousAnswer.*`, `review.detail.history.escalations*`):

| Key | es | en |
|---|---|---|
| `answerBanner.title` | La coordinación respondió esta solicitud | Coordination answered this request |
| `answerBanner.byline` | {name}, {date} | {name}, {date} |
| `answerBanner.hint` | Tenga en cuenta esta respuesta al decidir. | Take this answer into account when you decide. |
| `answerBanner.link` | Ver el escalamiento completo | See the full escalation |
| `decisionPanel.descriptionAnswered` | La coordinación ya respondió (vea la respuesta al inicio de esta página). Apruebe, devuelva para corrección o rechace la solicitud. Si necesita otra opinión, puede escalarla de nuevo. Cada decisión le pide confirmarla. | Coordination has already answered (see the answer at the top of this page). Approve, return for correction or reject the request. If you need another opinion, you can escalate it again. Each decision asks you to confirm it. |
| `dialog.previousAnswer.title` | La coordinación ya respondió esta solicitud ({byline}): | Coordination already answered this request ({byline}): |
| `dialog.previousAnswer.hint` | Si la escala de nuevo, vuelve a coordinación y no podrá decidir hasta que responda. | If you escalate it again, it goes back to coordination and you cannot decide until it answers. |
| `history.escalations` | Los escalamientos a coordinación y sus respuestas están en la sección «Escalamientos a coordinación». | Escalations to coordination and their answers are in the "Escalations to coordination" section. |
| `history.escalationsLink` | Ir a los escalamientos | Go to the escalations |

Tests (RED first):

- `answer-banner.test.tsx`: no escalation, unanswered only, or two answered (the last wins) give the matching result. The banner shows the text, author, date and anchor.
- `page.test.tsx`: a `pendiente` request with an answer shows the banner before "Solicitud" and the answered copy. A request in `en_revision_coordinacion` shows no banner. A request without an answer keeps today's copy.
- `escalate-dialog.test.tsx`: the note shows when there is an earlier answer, and confirm still calls the action.
- `layout-360.test.tsx` and `design-system.test.tsx`: the banner and the note pass with `LONG_NOTE`.
- `review-messages.test.ts`: exact Spanish.
- All of these back 4.9:28 (RF-16 c). Size: about 200 lines.

### S2 — RF-06: "Vence primero" (Crítica, 4.9:20)

| File | Action | Change |
|---|---|---|
| `review/deadline-badge.tsx` | Modify | `FirstDueBadge({ label })`: the neutral badge (`rounded-full bg-muted text-foreground text-xs font-semibold px-3 py-1`, design-system §5 Badge). It has no hooks, so it is shared by the server page and the client table |
| `review/page.tsx` | Modify | `firstDueId = queue.rows[0]?.id ?? null` is computed before `filterQueueRows`. The card renders the badge in `deadline(row)`. The table row gets `firstDueLabel` |
| `review/review-queue-table.tsx` | Modify | `ReviewQueueTableRow.firstDueLabel: string \| null`, rendered in the deadline cell |

i18n:

| Key | es | en |
|---|---|---|
| `review.queue.description` | Solicitudes pendientes de su facultad, ordenadas por vencimiento del plazo: primero la que vence antes. | Pending requests of your faculty, ordered by deadline: the one due first comes first. |
| `review.queue.firstDue` | Vence primero | Due first |

Tests:

- `review/page.test.tsx`: exactly one marker per layout, on row 1. It is absent when the search hides row 1, and it is not moved to the first visible row. The description copy is pinned.
- `review-queue-table.test.tsx`: the label renders.
- The existing order test in `revision-queue.test.ts` is the 4.9:20 Vitest and stays green.
- Size: about 100 lines.

### S3 — RF-10: required note and stale errors (Mayor, 4.9:24)

| File | Action | Change |
|---|---|---|
| `review/[id]/dialog-parts.tsx` (+test) | Modify | `withoutFieldErrors<F>(failure, field)`. `NoteField` gets an optional `required` that sets `aria-required` |
| `review/[id]/escalate-dialog.tsx` | Modify | `onValueChange` calls `setFailure(f => withoutFieldErrors(f, "motivo"))` and the note `onChange` does the same for `"nota"`. `NoteField required` |
| `review/[id]/report-dialog.tsx`, `coordination/[id]/answer-form.tsx` | Modify | They adopt the same helper on change. The defect is identical, so RNF-12 asks for one behaviour |

i18n:

| Key | es | en |
|---|---|---|
| `review.escalation.dialog.noteLabel` | Nota para coordinación (obligatoria) | Note for coordination (required) |
| `review.escalation.dialog.noteHint` | Explique por qué escala la solicitud; por ejemplo, qué dato del documento no coincide o qué situación no prevé el reglamento. Solo la ve el personal. | Explain why you are escalating the request; for example, which document detail does not match or which situation the regulation does not cover. Only staff can see it. |

Tests:

- `dialog-parts.test.tsx`: the helper's truth table covers non-invalid input, the field removed, and the last error giving `null`.
- `escalate-dialog.test.tsx`: confirm with nothing filled shows both errors. Picking a motive clears only the motive error, and typing clears the note error. No "No se pudo escalar" banner appears. The label says "(obligatoria)".
- These back 4.9:24 (RF-10 b). Size: about 110 lines.

### S4 — RF-07: cards that tell requests apart (Mayor, 4.9:21)

| File | Action | Change |
|---|---|---|
| `src/lib/data/student-requests.ts` (+test) | Modify | `listOwnRequests` returns `OwnRequestListItem[]` (below). The order stays newest first |
| `requests/request-card.tsx` | Modify | Three labelled lines: dates, subject codes (first 3 plus "y N más"), and the reason (D7, `line-clamp-2`). Same single card at every width |
| `requests/no-signals.test.ts` | Modify | `LIST_KEYS` adds `asignaturas` and `decision`. The selects-only shape and the REVEALING checks stay |

```ts
export type OwnRequestListItem = OwnRequestRow & {
  asignaturas: { codigo: string; nombre: string }[]; // listRequestClasses order
  decision: { motivoCodigo: string | null; texto: string | null } | null; // devuelta/rechazada only
};
```

i18n (`requests.list.*`; the labels reuse `requests.detail.reasons.*`):

| Key | es | en |
|---|---|---|
| `absence` | Fechas de ausencia: {period} | Absence dates: {period} |
| `subjects` | Asignaturas: {codes} | Subjects: {codes} |
| `moreSubjects` | {codes} y {count} más | {codes} and {count} more |
| `reason` | Motivo: {reason} | Reason: {reason} |

Tests:

- `student-requests.test.ts`: 1 select when empty and 3 for N rows. Classes are attached per id, and the latest decision only for `devuelta`/`rechazada`.
- `request-card.test.tsx` (new): the labels, the overflow and the four state cases.
- `design-system.test.tsx` and a 360 px check with long codes.
- `no-signals.test.ts` stays green.
- These back 4.9:21 (RF-07 c). Size: about 250 lines.

### S5 — RF-08: local preview and file names (Mayor, 4.9:22)

| File | Action | Change |
|---|---|---|
| `requests/new/local-preview.tsx` (+test) | Create | `"use client"`. `previewKind(file)` returns `pdf` for `application/pdf`, `image` for png/jpeg, otherwise `null`. `LocalPreview({ file, name })` mounts an `<img>` or `<iframe>` whose `src` is assigned in an effect from `URL.createObjectURL(file)`, and the cleanup revokes it. It holds no route URL |
| `requests/new/documents-step.tsx` | Modify | `useState<Map<number, File>>`. On a finalize `ok` with `documentId`, the file is stored. A row with a local file offers "Vista previa"/"Ocultar vista previa" (`aria-expanded`, panel unmounted when closed) instead of "Ver". Remove or unmount drops the entry, so the cleanup revokes |
| `src/lib/data/student-requests.ts` | Modify | `getReturnedDocumentIds(userId, id): Promise<number[]>`: the latest `SolicitudRevision.documentoIds` of the caller's own `devuelta` request |
| `requests/[id]/correct/page.tsx`, `requests/new/flow-steps.tsx`, `review-step.tsx`, `resubmit-dialog.tsx`, `confirm-dialog.tsx` | Modify | The ids are read in the existing `Promise.all` (`.catch(() => null)`). `FlowSteps` passes `previousDocumentIds` to `ReviewStep` and on to `ResubmitDialog`. `ConfirmDialog` gets an optional `children` body that lists each name with its "Nuevo"/"Anterior" mark (no mark when the ids are `null`) |

i18n:

| Key | es | en |
|---|---|---|
| `intake.documents.preview` | Vista previa | Preview |
| `intake.documents.previewNamed` | Ver la vista previa de {name} | Preview {name} |
| `intake.documents.hidePreview` | Ocultar vista previa | Hide preview |
| `intake.documents.hidePreviewNamed` | Ocultar la vista previa de {name} | Hide the preview of {name} |
| `intake.documents.previewHint` | Compruebe que este es el documento correcto antes de continuar. | Check that this is the right document before you continue. |
| `intake.documents.previewImageAlt` / `previewPdfTitle` | Documento {name} | Document {name} |
| `intake.correction.resubmit.filesTitle` | Documentos que se enviarán | Documents that will be sent |
| `intake.correction.resubmit.marks.new` / `.previous` | Nuevo / Anterior | New / Previous |

Tests:

- `local-preview.test.tsx`: `createObjectURL` and `revokeObjectURL` are spied. A PDF mounts an iframe and an image mounts an img, both with a `blob:` src. Unmount revokes, and so does a StrictMode double run with no leak.
- `documents-step.test.tsx`: after an attach, the row offers a preview. Opening it issues no `fetch` and renders no `/api/intake/documents/` URL. Closing and removing revoke. An older document keeps "Ver".
- `resubmit-dialog.test.tsx`: the names and marks.
- `student-requests.test.ts`: one owner-scoped select.
- The 4.9:22 integration (correction in the same request) stays green.
- Size: about 240 lines.

### S6 — RF-01: dates recap and future-start notice (Mayor, 4.9:15)

| File | Action | Change |
|---|---|---|
| `requests/new/steps.ts` (+test) | Modify | `startsAfterToday(range, today): boolean` |
| `requests/new/dates-recap.tsx` (+test) | Create | `DatesRecap({ range, today, editHref })`. The dates are formatted with `weekday: "long", day, month: "long", year`, `timeZone: "UTC"` on `${iso}T00:00:00Z` (as `use-request-dates.ts:10`), with an "Editar fechas" link to step 1. When `startsAfterToday`, a warning Alert (`border-warning/30 border-l-warning bg-warning/8 text-warning-ink`, `role="note"`) |
| `requests/new/page.tsx`, `[id]/correct/page.tsx`, `flow-steps.tsx`, `subjects-step.tsx`, `documents-step.tsx`, `review-step.tsx` | Modify | Both pages pass `today = managuaToday(new Date())`. The recap tops steps 2 and 3. The notice repeats under the period in step 4 |

The notice never disables a control, and the server rules (RN-05, RN-23, `solicitud.ts:37-69`) are untouched.

| Key | es | en |
|---|---|---|
| `intake.datesRecap.label` | Fechas de la ausencia | Absence dates |
| `intake.datesRecap.range` | Del {start} al {end} | From {start} to {end} |
| `intake.datesRecap.edit` | Editar fechas | Edit dates |
| `intake.datesRecap.futureStart` | La fecha de inicio es posterior a hoy. Si la ausencia ya ocurrió, corrija las fechas; si es una ausencia prevista, puede continuar. | The start date is later than today. If the absence already happened, correct the dates; if it is a planned absence, you can continue. |

Tests:

- `steps.test.ts`: the truth table, with equal dates giving false.
- `dates-recap.test.tsx`: weekday text, a single day, and the notice shown only when the start is in the future.
- `page.test.tsx`: fake time `2026-11-20T05:30:00Z` gives today = `2026-11-19`, which proves the Managua zone. The submit stays enabled with the notice shown.
- `layout-360.test.tsx`.
- These back 4.9:15. Size: about 140 lines.

### S7 — UX-20: "Cambiar contraseña" link

- Files: `profile/page.tsx` gets an outline `lg` link to `/change-password`. `src/components/dashboard-header.tsx` gets a `DropdownMenuItem` for the same link.
- Keys: `profile.changePassword` and `auth.userMenu.changePassword` = "Cambiar contraseña" / "Change password".
- Tests: `profile/page.test.tsx` checks the href, and a header test checks the menu item.
- The matrix already covers `/change-password` (`matrix-table.ts:75`).
- Size: about 50 lines.

### S8 — Motive `otro` (after #98 merges)

| File | Action | Change |
|---|---|---|
| `src/lib/intake/escalation.ts` | Modify | `ESCALATION_KINDS = ["sospecha_documento","caso_especial","otro","exceso_inasistencias"]` and `ESCALATION_REASONS = [...,"otro"]`. Doc comments |
| `src/db/schema.ts:713-723` | Modify | Comment only. The CHECKs and the index render from the arrays |
| `drizzle/0016_escalation_otro.sql`, `drizzle/meta/*` | Create | `npx drizzle-kit generate --name escalation_otro` (local, no database). If the generator misses a piece, it is hand-appended, as 0014 was |
| `src/db/migration-escalation-otro.test.ts` | Create | Pins the file by name, the journal order after 0015, exactly the statements below, and no ADD COLUMN, DROP TABLE, DELETE, UPDATE, RENAME or BEGIN |
| `src/lib/escalation/message.ts` | Modify | `REASON_LABELS.otro = "Otro motivo"`. SUBJECTS, INTROS, HTML_TITLES and HTML_BUTTONS reuse the escalation values. The note already travels as the "Nota" line (`message.ts:95`) and is the description |
| `i18n/*.json` | Modify | `review.escalation.reasons.otro` "Otro motivo" / "Other reason"; `dialog.motivo.otro` "Otro (descríbalo en la nota)" / "Other (describe it in the note)". The coordination list and detail read `review.escalation.reasons` (`coordination-list.tsx:33`, `coordination-sections.tsx:90`), so they need no code change |
| `docs/requirements.md:58` | Modify | RN-20, applied on top of #98's merged text (see below) |

Expected `0016` statements, on `"Escalamiento"`:

- `DROP INDEX "UX_Escalamiento_Abierto"`, then `CREATE UNIQUE INDEX "UX_Escalamiento_Abierto" … WHERE "Tipo" IN ('sospecha_documento', 'caso_especial', 'otro') AND "RespondidaEn" IS NULL`.
- `DROP CONSTRAINT` and `ADD CONSTRAINT` for:
  - `CK_Escalamiento_Tipo`, with `('sospecha_documento','caso_especial','otro','exceso_inasistencias')`;
  - `CK_Escalamiento_Kind`, whose reason branch lists all three reasons and still requires a non-blank note;
  - `CK_Escalamiento_SinRespuesta`, with the three reasons.

The Drizzle migrator applies the file inside one transaction. Existing rows satisfy the wider rules.

RN-20 text, applied as the minimal insertion into #98's wording: "Los motivos de escalamiento son la sospecha sobre el documento, el caso especial fuera de las causas del reglamento y otro motivo, que la secretaría describe en la nota obligatoria. El reporte de exceso del 20 % comunicado por el docente es un aviso informativo a la coordinación. El sistema no calcula ese porcentaje."

Tests:

- `escalation.test.ts`: `otro` with a note is accepted, and with an empty note gives `nota_required`.
- `escalate-dialog.test.tsx`: three radios.
- `message.test.ts`: the `otro` label and subject.
- `review-messages.test.ts:331`: re-pin `dialog.motivo`.
- `escalation-constraints.integration.test.ts`: an `otro` row needs a note (23514), a second open `otro` gives 23505, and an `otro` can be answered. It runs on a disposable branch, only with the owner's yes.
- Audit types tests for `motivo`.
- These back 4.9:24 (RF-10). Size: about 280 lines.

Production gate: on a database without `0016`, an `otro` insert fails with 23514 and the action answers "unexpected". The other motives keep working. The tracker therefore reaches `main` only after `0016` is applied (see Merge gate).

### S9 — UX-21: CIF or email login (9a and 9b)

Pre-slice, read-only and allowed without confirmation, with the result recorded in `tasks.md`:

```sql
select r."Codigo", count(*) from "Usuario" u join "Rol" r on r."Id" = u."RolId"
where u."Activo" and u."CanceladoEn" is null and u."Correo" is null
  and (r."Codigo" <> 'estudiante' or u."Cif" is null) group by 1;
select lower("Correo"), count(*) from "Usuario" where "Correo" is not null
group by 1 having count(*) > 1;
```

The first query counts the accounts that would be locked out, because they have no email and are not a student with a CIF. The second finds emails that D12 would refuse as ambiguous. A third read-only query counts the stored CIFs with a character other than a digit, which the cleaned login input could never match. Owner result of 2026-11-20: zero, zero and zero, so the legacy `Login` fallback of the first design is dropped.

**9a — resolution (about 220 lines).**

- `src/lib/auth/login-identity.ts` (+test): pure `classifyIdentifier(raw)` returns `{ kind: "email" | "cif", value }` or `null` for a blank value (the CIF value is empty when only hyphens were typed, which skips the lookup).
- `src/lib/data/users.ts` (+test): `findLoginAccount(identifier)` follows the sequence above, with `LIMIT 2` on the email lookup and the CIF filtered to `estudiante`.
- `src/lib/validations/auth.ts`: login max 160.
- `login/actions.ts`: `findLoginAccount`, plus `DUMMY_HASH` for an unknown identifier.
- `login-form.tsx`: label and hint.

Tests:

- `actions.test.ts`: a CIF reaches the student. A mixed-case email with spaces reaches staff and students. A staff `Login` that equals a CIF does not resolve as a CIF.
- The following all give the same generic error: an unknown identifier (and `verifyPassword` is still called), an inactive account, a wrong password, an ambiguous email, and the stored `Login` of any account that is not its email or a student's CIF.
- An account with no email and no CIF cannot sign in by any value.
- `login-form.test.tsx`: copy.

**9b — "Usuario" removed (about 260 lines).**

- `users/new` (form, action, `crearStaffSchema`): no login field. `correo` is required. `login = deriveLogin(correo)`, which can give `loginTooLong`.
- `register` (form, action, schema): `login = cif.trim()`.
- `users/page.tsx`, `users-table.tsx`, `src/lib/users/list-params.ts`: the "Usuario" column and the `login` sort key are dropped. An old URL with `sort=login` falls back to the default.
- `catalog/docentes` table: the login column is dropped.
- `profile/page.tsx`: the login row is dropped.
- `dashboard-header.tsx`: the role line no longer shows the login.
- `src/lib/import/credentials-csv.ts`: the header `Login` becomes `Correo`. The value is the same, because a docente's login is the normalized email.
- Tests for all of the above, plus `users-listing` and `staff-account-creation` specs. The access matrix is unchanged.

| Key | es | en |
|---|---|---|
| `auth.login.loginLabel` | CIF o correo institucional | CIF or institutional email |
| `auth.login.loginHint` | Los estudiantes pueden usar su CIF o su correo; el personal, su correo institucional. | Students may use their CIF or email; staff use their institutional email. |
| `auth.errors.invalid` | Los datos de acceso no son correctos. Revise su CIF o correo y su contraseña. | The sign-in details are not correct. Check your CIF or email and your password. |
| `users.new.emailLabel` / `emailHint` | Correo institucional / Con este correo la persona ingresa al sistema. | Institutional email / This person signs in with this email. |
| `users.new.errors.duplicate` / `emailTooLong` | Ya existe una cuenta con ese correo. / El correo no puede superar los 60 caracteres. | An account with that email already exists. / The email cannot exceed 60 characters. |
| `auth.register.errors.duplicate` | El CIF o el correo ya están registrados. | The CIF or email is already registered. |
| `users.search.placeholder` / `noResults.hint` | Nombre o correo / Pruebe con otro nombre o correo. | Name or email / Try another name or email. |
| `auth.userMenu.roleLine` (replaces `signedInAs`) | {rol} | {rol} |

Removed keys: `auth.login`/`register`/`profile`/`users.new` `loginLabel`, `users.columns.login`, `catalog.docentes.columns.login`.

### S10 — Evidence and docs (about 150 lines)

- Captures per 4.9 case, taken locally against a disposable Neon branch: `build/salida/pruebas/RF-16_c.png`, `RF-10_b.png`, `RF-07_c.png`, `RF-01.png`. RF-06 and RF-08 are covered by their Vitest output.
- Backlog entries UX-22 to UX-27 for the six Table 19 items, plus the open entries for login rate limiting and for the server-side revocation of 30-day sessions. No entry is needed for a legacy fallback: it was dropped.
- Roadmap row 13, then archive.

## Testing Strategy

| Layer | What | 4.9 |
|---|---|---|
| Unit | `latestAnswer`, `withoutFieldErrors`, `startsAfterToday`, `classifyIdentifier`, `previewKind`, `validateEscalationDraft(otro)`, message maps | :28, :24, :15, :22 |
| Component | banner, dialogs, cards, preview, recap, marker, 360 px and design-system pins, axe | :28, :20, :24, :21, :22, :15 |
| Data (db double) | `listOwnRequests` ≤ 3 selects, `getReturnedDocumentIds`, `findLoginAccount` | :21, :22 |
| Migration | `0016` statement pins | :24 |
| Integration (owner yes) | `otro` constraints; the RF-08 regression | :24, :22 |
| System capture | RF-16, RF-10, RF-07, RF-01 | :28, :24, :21, :15 |

## Threat Matrix

N/A: no routing, shell, subprocess, VCS/PR automation, executable-file classification or process-integration boundary. The S9 authentication boundary is covered by the login action tests (generic errors, timing and inactive accounts) and by the unchanged access matrix.

## Merge Gate (tracker → `main`, which auto-deploys)

All of the following must hold:

1. S1 to S10 are merged into the tracker, and `npm test`, `npm run typecheck` and `npx eslint src` are green.
2. #98 merged before S8. If #105 merged, the JSON is rebased.
3. The S9 read-only counts are recorded.
4. The owner gave an explicit yes for the exact `drizzle-kit migrate` command against production. `0016` was then applied, and a read-only check of `pg_constraint` and `pg_indexes` shows `'otro'` in all four definitions.

No slice merges to `main` on its own. The evidence runs locally, so no early production merge is needed.

## Migration / Rollout and Rollback

- Rollout: agree the migration number with catalog-schedule (the second to merge renumbers), generate `0016`, owner yes, migrate, then merge the tracker.
- Rollback: revert slices in reverse order. UI slices carry no data, and `0016` may stay. Once `otro` rows exist, never revert the constants: the read filters would hide open `otro` escalations (`inArray(ESCALATION_REASONS)` in 6 readers). Remove only the radio option instead. Narrowing needs no `otro` rows, a new migration and the owner's yes.
- UX-21 rollback restores "Usuario". Accounts created under S9 keep a valid `Login` (the email or the CIF), so no data is lost.

## Conflicts and Thesis Sync

- **#105** (i18n, catalog namespace): S9b touches `catalog.docentes.columns`. Rebase the JSON last and run the parity tests.
- **#98** (requirements): S8's RN-20 edit waits for it.
- Thesis-sync list for the thesis session:
  - **5.8:** every row adjusted. RF-01, RF-07 and RF-06 are worded as defensive improvement plus diagnosis, and RF-16 and RF-10 as system causes. 5.8:20 "sin definir" is resolved.
  - **4.2:89:** RN-20 adds caso especial and otro.
  - **5.4:19:** "Otro" was added.
  - **Anexo E:3:** students sign in with their CIF or email, staff with their institutional email.
  - **Recommendation 6:** the queue search exists on the pending tab.
  - **Recommendation 8:** the Table 19 adjustments are done, and the repeat test remains future work.

## Open Questions

- [ ] Register: should the "usted" copy in the `intake`, `requests` and `users` namespaces (still "tú") ship as is, or should a register sweep be scheduled?
- [ ] CIF match: exact after trimming, or also case and hyphen normalization?
- [x] The legacy `Login` fallback does not ship (owner decision 2026-11-20, task 9.1: the S9 counts are zero).
- [ ] Confirm that a `rechazada` card shows a 2-line excerpt of the decision text.
- [ ] Confirm that the RF-08 preview covers only files attached during the current visit to step 3.

## UX-22 addendum (owner, 2026-11-20): keep the session signed in

Spec: `auth-entry-access` FE-32. Backlog UX-22. Slice S9c, after S9b, about 180 lines. It stays out of S9a so that slice keeps its budget.

### Approach: a session claim, not only a cookie age

The session JWT lasts 8 h (`src/lib/auth/session.ts:34`, `SESSION_MAX_AGE` at `:6`) and the cookie uses the same constant (`src/lib/auth/cookies.ts:25`). Three places issue a session: `login/actions.ts:39`, `register/actions.ts:70` and `change-password/actions.ts:75`. The last one re-signs from the old session claims, so a cookie-age-only design would silently turn a 30-day session into an 8-hour one at the forced password change. The choice therefore travels as an optional claim.

| Piece | Decision |
|---|---|
| Claim | `SessionPayload.mantenerSesion?: boolean`. `isSessionPayload` accepts it undefined or boolean only. A token without it (every token issued before this change) stays valid and reads as unchecked |
| Durations | `SESSION_MAX_AGE` (8 h) stays. New `SESSION_MAX_AGE_KEPT = 60 * 60 * 24 * 30`. One pure helper `sessionMaxAge(keep: boolean)` returns the right one, so the token and the cookie cannot disagree |
| Token | `signSession` sets `setExpirationTime("30d")` when `payload.mantenerSesion` is true, otherwise `"8h"`. A string is used on purpose: a number given to `jose` is an absolute timestamp |
| Cookie | `setSessionCookie(token, keep = false)` uses `sessionMaxAge(keep)`. Flags (`httpOnly`, `secure`, `sameSite`, `path`) do not change |
| Login | `loginAction` reads `formData.get("mantener") === "on"`. The claim is added to the payload only when true, so an unchecked token is byte-identical in shape to today's. Failures return before any session work |
| Re-issue | `change-password/actions.ts` carries `mantenerSesion: session.mantenerSesion` into the new payload and passes it to `setSessionCookie`. The flag `debeCambiarClave` flow is untouched |
| Register | No checkbox on `/register`. It keeps the 8-hour default |
| Logout | `clearSessionCookie` already deletes the cookie. No change; a test pins it for a kept session |
| Form | `login-form.tsx` adds the native `Checkbox` (`src/components/ui/checkbox.tsx`, which posts `on`) with a `Label`, unchecked by default |

The forced change is unaffected. A flagged user who checks the box is still redirected to `/change-password`, and the re-issued session keeps 30 days and drops the flag. The access matrix needs no row because no route, Server Action or audit event is added.

Trade-off: a 30-day token cannot be revoked server-side before it expires, as for the 8-hour token today (there is no session table). Deactivating an account still blocks the next sign-in but not an issued token. This is recorded as a backlog entry in S10, not solved here.

### Files

| File | Action |
|---|---|
| `src/lib/auth/session.ts` (+test) | Claim, constant, `sessionMaxAge`, expiry, payload guard |
| `src/lib/auth/cookies.ts` (+new test) | `setSessionCookie(token, keep)` |
| `src/app/(auth)/login/actions.ts` (+test) | Read the box, pass the claim and the cookie flag |
| `src/app/(auth)/login/login-form.tsx` (+test) | Checkbox and label |
| `src/app/change-password/actions.ts` (+test) | Carry the claim and the cookie flag |
| `i18n/es.json`, `i18n/en.json` | `auth.login.keepSession` "Mantener la sesión iniciada" / "Keep me signed in" |

### Tests (RED first)

- `session.test.ts`: `exp - iat` is 30 days with the claim and 8 hours without it. An old token without the claim verifies. A non-boolean claim is refused.
- `cookies.test.ts`: `maxAge` is 30 days when kept and 8 hours otherwise, and the flags are unchanged.
- `login/actions.test.ts`: `mantener=on` signs with the claim and sets the 30-day cookie. Absent gives today's payload and 8 hours. A failed attempt with the box checked sets no cookie. A flagged account with the box checked still redirects to the forced change.
- `change-password/actions.test.ts`: the claim and the cookie flag survive the re-issue, both for a kept and for an unchecked session.
- `login-form.test.tsx`: the label, unchecked by default, and the field posts `mantener` when checked.
- The access matrix suites stay green with no new row.
