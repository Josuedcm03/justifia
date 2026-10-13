# Design: Secretary Review

> **Size note.** The `sdd-design` skill caps a design at 800 words. This
> change carries a schema, a migration, a pure rule set, three audited flows
> and two UIs; the repository precedent (`merge-grupo-into-asignatura`,
> `justification-intake`) keeps decision tables over prose cuts. The
> deviation is deliberate.

> **DB-touching.** This document plans commands and runs none. Every database
> step is tagged `[READ-ONLY]` or `[CONFIRM]`; a `[CONFIRM]` step needs the
> owner's explicit "yes" for that single command (`CLAUDE.md`).

Binding inputs: `proposal.md`, confirmed decisions (Engram
`sdd/secretary-review/pre-proposal`), `exploration.md`, `docs/requirements.md`
(RF-06..RF-08, RN-08, RN-15..RN-17, RNF-01, RNF-06, RNF-12), and the archived
`justification-intake/design.md` (A1..A9, D1..D15). Decisions here are
**SR-1..SR-17**. SR-16 was confirmed by the owner on 2026-10-11 (option b plus a);
SR-17 (slice S6) records the owner decisions of 2026-10-13.

## Technical Approach

Hexagonal, same layout as intake. Pure rules in `src/lib/intake/` (no I/O,
injected `now`, injected `NonWorkingDaysProvider`); persistence in
`src/lib/data/`; transport in Server Actions, RSC pages and the existing
document route handler. Every state change is one guarded
`UPDATE ... WHERE "Estado" = <expected>` with `RETURNING`, its history rows
and its audit row in the same transaction (the `submitDraft` pattern). Scope
is resolved per request from the database, never from the session token
(`CatalogScope` precedent), and fails closed. Class data (subject, group,
teacher) is read only through `src/lib/data/solicitud-clases.ts`, so any
later change to the class tables touches one module.

## Verified framework findings (Next 16.3.4, `node_modules/next/dist/docs/`)

| # | Finding | Source | Consequence |
|---|---|---|---|
| N1 | **Superseded** by the SR-11 amendment ("Main Sync 2026-10-12"). Without Cache Components, a dynamic route is prefetched only down to the nearest `loading.js` boundary, so the page body below it never runs on prefetch | `02-guides/prefetching.md`; `03-api-reference/02-components/link.md` | The guard is not "no `loading.tsx`": the audit write lives only in the `page.tsx` body, which holds while `cacheComponents`/Partial Prefetching are off |
| N2 | Impure pages/layouts "might run when the route is prefetched" | `prefetching.md` Troubleshooting | The audited read must sit in a dynamic page body with prefetch excluded twice (SR-11) |
| N3 | The `prefetch` segment export works only with `cacheComponents`; `<Link prefetch={false}>` skips prefetch regardless of destination config | `route-segment-config/prefetch.md` | Link-level `prefetch={false}` is the guard that survives a later `cacheComponents` switch |
| N4 | `next.config.ts` has no `cacheComponents` / `partialPrefetching` | repo | N1 applies today |
| N5 | `params`/`searchParams` are Promises; `notFound()`/`redirect()` throw | intake design, MG N1-N2 | Same placement rules as intake |

## Architecture Decisions

### SR-1. Schema

| Object | Definition | Rejected |
|---|---|---|
| `Usuario.FacultadId` | `bigint NULL` FK `Facultad.Id`; `CK_Usuario_Ambito`: `"FacultadId" IS NULL OR "CarreraId" IS NULL` | A CHECK "required when role is secretaria": `RolId` is a FK to `Rol`, a CHECK cannot read another table; a trigger is procedural code drizzle-kit does not model. The requirement is enforced at write time (SR-16) and by the fail-closed scope (SR-6) |
| `Solicitud.ReenviadaEn` | `timestamptz NULL`; `CK_Solicitud_Reenvio`: `"ReenviadaEn" IS NULL OR ("PresentadaEn" IS NOT NULL AND "ReenviadaEn" >= "PresentadaEn")` | Overwriting `PresentadaEn` (loses the first presentation, RN-02 snapshot date) |
| `IX_Solicitud_Cola` | btree on `(coalesce("ReenviadaEn", "PresentadaEn"), "Id") WHERE "Estado" = 'pendiente'` | Relying on `IX_Solicitud_Estado` (orders by `PresentadaEn` only) |
| `DocumentoRespaldo.RetiradoEn` | `timestamptz NULL`; `CK_Documento_Retiro`: `"RetiradoEn" IS NULL OR "Estado" = 'valido'` | A third `Estado` value (would break every `estado = 'valido'` reader); hard delete (RF-08 b) |
| `SolicitudRevision` | `Id` identity PK; `SolicitudId` FK `Solicitud` (no cascade); `Numero smallint` (`UQ_SolicitudRevision (SolicitudId, Numero)`, `CK > 0`); `Causa`, `FechaInicio`, `FechaFin` (same types and CHECKs as `Solicitud`); `Clases jsonb NOT NULL` (array of `{asignaturaId, codigo, nombre, numeroGrupo}`); `DocumentoIds jsonb NOT NULL` (array of ids); `CreadaEn timestamptz NOT NULL default now()` | FK table per revision line (no `Grupo`/`Asignatura` FK allowed; the class row is reused across terms, so history must not follow live catalog edits) |
| `SolicitudDecision` | `Id` identity PK; `SolicitudId` FK (no cascade); `Tipo varchar(20)` `CK in ('aprobada','rechazada','devuelta')`; `PlantillaCodigo varchar(40) NOT NULL`; `MotivoCodigo varchar(30) NULL` `CK`: `(Tipo = 'devuelta') = (MotivoCodigo IS NOT NULL)` and in the RN-17 list; `Texto varchar(1000) NULL`, `CK`: `Tipo = 'aprobada' OR length(btrim(Texto)) > 0`; `RevisionId` FK `SolicitudRevision` NULL, `CK`: `(Tipo = 'devuelta') = (RevisionId IS NOT NULL)`; `SecretariaId` FK `Usuario` NOT NULL; `DecididaEn timestamptz NOT NULL default now()`; `IX_SolicitudDecision_Solicitud (SolicitudId, DecididaEn)` | Storing the decision on `Solicitud` columns (loses history across return cycles) |

- **No `ON DELETE CASCADE`** on the two new tables: a presented request is
  never deleted (sweeps touch only `borrador`), and a delete attempt on a
  decided request must fail rather than erase history.
- **Append-only `SolicitudDecision` and `SolicitudRevision`** are enforced by
  a structural test (as `inscripcion-writes.test.ts`): no `update(` or
  `delete(` on either table anywhere under `src`. Rejected: a trigger like
  `EventoAuditoria`'s (custom SQL outside the snapshot for a table only this
  code writes).
- CHECK lists are derived from code constants with `inList` / `sql.raw`, as
  `CK_Solicitud_Estado` is today.

### SR-2. Migration number and ordering

Our migration is simply the next one, **generated**, never hand-numbered:
`npm run db:generate -- --name secretary_review` (expected
`0008_secretary_review.sql`; re-check `drizzle/` on `main` for a newer
migration before generating). It has no dependency on another change:
`merge-grupo-into-asignatura` was archived as option A with no schema change
(see "Main Sync 2026-10-12"). It is purely additive (new nullable columns, two
tables, one index, CHECKs): no backfill, no data rewrite. Tests find it by the
`secretary_review` name, never by number. Slice S1 has no schema.

### SR-3. One class reader: `solicitud-clases.ts`

```ts
export type RequestClass = {
  asignaturaId: number; codigo: string; nombre: string;
  numeroGrupo: string; docenteNombre: string | null;
};
export function listRequestClasses(
  q: Db | Transaction, solicitudIds: readonly number[],
): Promise<Map<number, RequestClass[]>>;
```

Every reader in this change (queue counts, staff detail, student detail,
revision snapshot) calls it. No period is returned; `docenteNombre` may be
null. It joins `SolicitudAsignatura -> Grupo -> Asignatura -> Usuario`
(`SolicitudAsignatura.GrupoId` still references `Grupo`), and that join lives
only in this module. Rejected: inline joins in each data module (a later
change to the class tables would have to find them all).

### SR-4. RN-16 transitions as a pure table

`src/lib/intake/transitions.ts`:

| From | To | Actor | Trigger |
|---|---|---|---|
| `borrador` | `pendiente` | estudiante | submit (existing) |
| `pendiente` | `aprobada` / `rechazada` / `devuelta` | secretaria | decision (RN-15) |
| `devuelta` | `pendiente` | estudiante | correction (RF-08 c) |

`en_revision_coordinacion` stays in the CHECK, has no edge (RF-10 out of
scope). `aprobada`, `rechazada` are terminal. `canTransition(from, to,
actor)` is exhaustive over `EstadoSolicitud`; each data write derives its
`WHERE "Estado" = ...` from this table, and a test pins that the SQL guard and
the table agree.

### SR-5. Business days (RN-08)

| Element | Choice |
|---|---|
| Module | `src/lib/intake/business-days.ts`, pure |
| Port | `NonWorkingDaysProvider { isNonWorkingDay(iso: string): boolean; coversYear(year: number): boolean }` in `src/lib/intake/ports.ts` |
| Adapter | `src/lib/intake/adapters/constant-calendar.ts` over `NON_WORKING_DAYS: Readonly<Record<number, readonly string[]>>` in `src/lib/intake/calendar.ts` (per-year ISO dates; Semana Santa moves, so each year is listed explicitly; dataset validated by the owner) |
| Business day | Monday-Friday and not in the calendar (thesis working assumption) |
| Clock start | `coalesce(ReenviadaEn, PresentadaEn)`, as a Managua date (`managuaToday`) |
| Deadline | the 2nd business day strictly after the start date; a weekend or holiday presentation therefore counts from the next business day; due at end of that day |
| Status | `remaining = business days after today up to the deadline`; `vencida` when today > deadline, `por_vencer` when remaining <= 1, else `en_plazo`. RF-06 b alerts `por_vencer` and `vencida` |
| Year outside calendar | `coversYear` false -> computation still runs (weekends only) and the queue shows a muted "calendar not loaded" note; never blocks |
| Staleness test | uses the real clock on purpose: fails when `NON_WORKING_DAYS[current year]` is missing or empty |

Computed on read, never stored. Rejected: a `DiaNoHabil` table (RNF-14 is
out of scope); storing the deadline (stale after a calendar fix).

**Queue order.** `ORDER BY coalesce("ReenviadaEn", "PresentadaEn") ASC, "Id"
ASC`. Adding business days is monotone non-decreasing in the start date, so
this order equals the deadline order (RF-06 a) with no calendar in SQL.

### SR-6. `RequestScope`, fail-closed

```ts
export type RequestScope =
  { kind: "facultad"; facultadId: number } | { kind: "none" };
export function requestScopeFor(
  rol: RolUsuario, actor: { facultadId: number | null } | null,
): RequestScope;   // secretaria with a facultad -> facultad; everything else -> none
```

Pure in `src/lib/intake/request-scope.ts`; resolved per request by
`resolveRequestScope(userId, rol)` in `src/lib/data/`. The only SQL form lives
in `request-scope-sql.ts`: `EXISTS (SELECT 1 FROM "Usuario" e JOIN "Carrera" c
ON c."Id" = e."CarreraId" WHERE e."Id" = "Solicitud"."EstudianteId" AND
c."FacultadId" = $1)`; `none` renders literal `false`. A student without a
carrera is invisible to every secretary (fail-closed; preflight P2 counts
them). The snapshot carrera **name** is never used for scope.
`permissions.ts` gains `rolesRevisores = ["secretaria"]` and
`canReviewRequests(rol)`; RN-15: only `secretaria` decides, only in scope.
Rejected: scope from the session token (stale after reassignment); `all` for
`administrador`/`coordinacion` (RF-10 owns coordination access).

### SR-7. Decision transaction

```
decideRequest({ actorId, scope, solicitudId, decision, now })   // src/lib/data/solicitud-decision.ts
 tx:
  UPDATE "Solicitud" SET "Estado" = target, "ActualizadoEn" = now
    WHERE "Id" = $id AND "Estado" = 'pendiente' AND <scope EXISTS> RETURNING ...
  0 rows -> SELECT state within scope: absent -> not_found ; present -> conflict
  devuelta: listRequestClasses(tx) + active document ids
            -> INSERT SolicitudRevision (Numero = max + 1)
  INSERT SolicitudDecision (Tipo, PlantillaCodigo, MotivoCodigo, Texto, RevisionId, SecretariaId)
  insertAuditEvents(tx, actorId, [solicitudDecididaEvent(...)])
 -> { ok: true } | { ok: false; reason: "not_found" | "conflict" | "invalid" }
```

Two concurrent decisions: the row lock of the first `UPDATE` makes the second
re-evaluate `Estado = 'pendiente'`, match 0 rows and return `conflict`; only
one decision row and one audit row exist (integration test on real Postgres,
`intake-concurrency` suite). Input is validated by a pure
`validateDecision(input)` (`src/lib/intake/decision-validation.ts`, tested in
`decision-validation.test.ts`) before the transaction (template kind matches
`Tipo`, RN-17 code required iff return, text bounds, no unresolved `[...]`
marker in rejection text).

### SR-8. Decision templates (code constants)

`src/lib/intake/decision-templates.ts`: `{ codigo, tipo, motivo?, cuerpo }`
in Spanish (stored institutional text, independent of UI locale; the UI
labels of the templates live in i18n). Placeholders `{estudiante}`, `{causa}`
(Spanish phrase per `CAUSAS` code, same module), `{fechas}` ("el día 3 de
marzo de 2026" or "del 3 al 5 de marzo de 2026", pure formatter). The register
follows the real teacher notices ("Buenos días, su apoyo en justificar la
inasistencia de {estudiante} por motivos {causa} el día {fecha}. Gracias de
antemano."), which stay with RF-09. Student-facing drafts:

| Código | Tipo / motivo | Cuerpo |
|---|---|---|
| `aprobacion.general` | aprobada | Buenos días, {estudiante}. Su solicitud de justificación de la inasistencia por motivos {causa} {fechas} ha sido aprobada. Gracias por su atención. |
| `rechazo.general` | rechazada | Buenos días, {estudiante}. Su solicitud de justificación de la inasistencia por motivos {causa} {fechas} no ha sido aprobada por el siguiente motivo: [indique el motivo]. Gracias por su atención. |
| `rechazo.documento_no_acredita` | rechazada | Buenos días, {estudiante}. Su solicitud de justificación de la inasistencia por motivos {causa} {fechas} no ha sido aprobada porque el documento de respaldo no acredita la inasistencia en las fechas indicadas. Gracias por su atención. |
| `devolucion.fecha_incorrecta` | devuelta / `fecha_incorrecta` | Buenos días, {estudiante}. Su solicitud de justificación de la inasistencia por motivos {causa} {fechas} fue devuelta para corrección: la fecha registrada no coincide con la del documento de respaldo. Le solicitamos corregirla y reenviar la solicitud. Gracias de antemano. |
| `devolucion.fecha_alterada` | devuelta / `fecha_alterada` | Buenos días, {estudiante}. Su solicitud ... fue devuelta para corrección: la fecha del documento de respaldo presenta alteraciones. Le solicitamos adjuntar un documento sin alteraciones y reenviar la solicitud. Gracias de antemano. |
| `devolucion.documento_ilegible` | devuelta / `documento_ilegible` | Buenos días, {estudiante}. Su solicitud ... fue devuelta para corrección: el documento de respaldo no es legible. Le solicitamos adjuntar una copia legible y reenviar la solicitud. Gracias de antemano. |

RN-17 codes live in `src/lib/intake/return-reasons.ts`
(`fecha_incorrecta`, `fecha_alterada`, `documento_ilegible`); choosing the
reason selects its return template. `renderTemplate(codigo, vars)` is pure; a
test pins that every placeholder of every template is known. The secretary
edits the rendered text before confirming; the final text is stored in
`SolicitudDecision.Texto`; audit stores only `PlantillaCodigo`,
`MotivoCodigo` and `textoEditado: boolean`. Rejected: templates in i18n
(stored text would depend on the reviewer's locale); a templates table
(RNF-14 is out of scope).

### SR-9. Audit events (codes only)

| Action | Entity | `datos` | Writer |
|---|---|---|---|
| `solicitud.aprobada` / `.rechazada` / `.devuelta` | `Solicitud` | `{ decisionId, plantilla, motivo?, textoEditado }` | SR-7 |
| `solicitud.corregida` | `Solicitud` | `{ revision, asignaturas, documentos, documentosRetirados }` | SR-13 |
| `solicitud.consultada` | `Solicitud` | `{ estado }` | staff detail (SR-11) |
| `solicitud.cola.consultada` | `Facultad` (id = scope facultad) | `{ total }` | queue (SR-11) |
| `documento.retirado` | `DocumentoRespaldo` | `{ solicitudId }` | correction removal (SR-13) |
| `documento.descargado` (modified) | `DocumentoRespaldo` | `+ modo: "ver" \| "descarga"` | document route (SR-12) |

`AuditEntityType` gains `Facultad`. No cause, dates, names, free text, file
names or template bodies in any payload (RNF-06, RN-02). Student reads of their own
requests are not audited (confirmed decision; stated in the spec).

### SR-10. Staff UI

| Path | Content |
|---|---|
| `src/app/(dashboard)/review/page.tsx` | Queue (RSC): `requireRole(...rolesRevisores)`, scope, `listReviewQueue(scope, now, calendar)`. Table: start date, student name and CIF, carrera, number of subjects, deadline badge (pill: `warning` "Due within 1 business day", `destructive` "Overdue", text always present). No cause (health data). Row link "Review" `size="lg"`, `prefetch={false}`. Empty state sentence. Scope `none`: `alert` banner "Your account has no faculty assigned" and no data |
| `review/[id]/page.tsx` | Detail (RSC): `PageHeader`, request data, classes (SR-3), current documents (View / Download buttons, `lg`), history section (decisions, prior revisions, retired documents), decision panel |
| `review/[id]/decision-dialog.tsx` + `actions.ts` | `AlertDialog` (intake primitive) per kind; template `RadioGroup`, return reason `RadioGroup` (RN-17 only), `Textarea` prefilled with the rendered template, counter `/1000`. Approve trigger default, Return `outline`, **Reject trigger `secondary`, confirm `destructive`** (RNF-12); cancel `ghost`; all `lg` (44 px). Errors under fields with `role="alert"`; `conflict`/`not_found` as `alert` banner. Action redirects to `/review` with a status param; it never revalidates the detail path |

Sidebar: `review` entry (`ClipboardCheck`, `visibleTo: canReviewRequests`).
i18n `review.*` in `es` and `en`. Tokens only from `docs/design-system.md`;
360 px: table becomes stacked cards, buttons full width.

### SR-11. Exactly-once audited read in RSC

The read event is written **in the page body**, after authorization and after
the data load succeeds, before JSX is returned:
`await recordRequestRead(actorId, detail)` (one transaction, one row). A
failure throws to the error boundary: no data is shown without its audit row
(intake A9 rule). Guards:

1. The audit write lives only in the `page.tsx` body, never in a
   `layout.tsx` or a `loading.tsx` (structural test, task 4.9). A dynamic
   route is prefetched only down to the nearest `loading.js` boundary
   (`link.md`), so the page body never runs on prefetch, with or without a
   `loading.tsx`. This holds while `cacheComponents`/Partial Prefetching stay
   off (SR-11 amendment, "Main Sync 2026-10-12"; supersedes N1).
2. Every `<Link>` to `/review` and `/review/[id]` is `prefetch={false}` (N3;
   survives a future `cacheComponents`), pinned by component tests.
3. `recordRequestRead` is wrapped in React `cache()` keyed by
   `(actorId, solicitudId)` so a second call in the same render pass is a
   no-op.
4. Decision actions `redirect()`; no `router.refresh()` or `revalidatePath`
   of the detail.

Test: one page render with a mocked data layer writes exactly one row; a
render that throws before the event writes none. Rejected: client `useEffect`
+ Server Action (dev StrictMode double-invokes, data visible before the
audit, lost on navigation); proxy logging (runs on prefetch, knows no data);
a JSON route + client fetch (rewrites the pages for no gain).

### SR-12. Document route widening

`GET /api/intake/documents/[id]?modo=ver|descarga` (absent = `ver`; any other
value -> uniform 404). `getDocumentForDownload` additionally returns
`solicitudEstado`, `estudianteFacultadId` (via `Usuario.CarreraId ->
Carrera.FacultadId`) and `retiradoEn`. Predicate (pure, `permissions.ts`):

```ts
canViewDocument(viewer, doc, scope): boolean
// owner student: viewer.id === doc.estudianteId (any state, retired included)
// staff: canReviewRequests(viewer.rol) && scope.kind === "facultad"
//        && scope.facultadId === doc.estudianteFacultadId
//        && isVisibleState(doc.solicitudEstado)
```

`valido` is still required by the query; retired documents stay `valido`, so
staff see them (confirmed decision 5). `descarga` sends
`Content-Disposition: attachment; filename*=UTF-8''...`; every other header
(sandbox CSP, `nosniff`, `no-store`) is unchanged. Audit order unchanged
(stream opened, row written, bytes sent).

### SR-13. Student pages and RF-08 correction

| Path | Content |
|---|---|
| `src/app/(dashboard)/requests/page.tsx` | Own requests, `VISIBLE_STATES` only, newest first; state badge; empty state with "New request" |
| `requests/[id]/page.tsx` | Own request: state, latest decision text and RN-17 reason label (RF-07 c), classes, documents, history; "Correct request" (`lg`, primary) when `devuelta` |
| `requests/[id]/correct/page.tsx` + `actions.ts` | Reuses the four intake step components with a **correction context** |

**Correction context.** `type EditTarget = { kind: "draft" } | { kind:
"correction"; solicitudId: number }`. `editableWhere(userId, target, now)`
returns `ownLiveDraft(...)` or `Id = $id AND EstudianteId = $user AND Estado =
'devuelta'`. `getLiveDraft`, `saveDraftDetails`, `saveDraftSubjects`,
`finalizeDocument`, `removeDocument`, `getUploadContext` take the target; the
step components take `flow: { basePath, actions }` instead of the hard-coded
`FLOW_PATH`. The upload-token route derives the target from the pathname's
`solicitudId` and accepts it only if it is the caller's live draft or own
`devuelta` request. Edits apply in place while `devuelta` (the returned
version is already frozen in `SolicitudRevision`). Never `borrador` (the
draft sweep would delete it).

- **RN-23 not re-applied:** `validateSubmission(input, today, { filingWindow:
  false })` and the step-1 schema built without the window for corrections.
  RN-21/RN-22 eligibility is re-checked.
- **Documents:** the 5-document cap counts `RetiradoEn IS NULL`. Removing a
  document listed in the latest revision's `DocumentoIds` sets `RetiradoEn`
  and writes `documento.retirado` (blob kept); removing one uploaded during
  this correction hard-deletes as today.
- **Resubmit** (`resubmitCorrection`): one transaction, `UPDATE ... SET
  Estado = 'pendiente', ReenviadaEn = now, ActualizadoEn = now WHERE Id AND
  EstudianteId AND Estado = 'devuelta'` plus the intake drift re-checks,
  `solicitud.corregida`; student snapshot columns unchanged (RN-02). Restarts
  the RN-08 clock via `ReenviadaEn`. Redirect to `/requests/[id]?corrected=1`.

Sidebar: `myRequests` (`/requests`, `visibleTo: canFileRequests`).

### SR-14. What is not touched

Sweeps (`intake-sweep.ts`) keep their filters: draft expiry only `borrador`;
orphan sweep deletes blobs without rows (retired documents keep rows);
pending sweep only `pendiente` documents. `EventoAuditoria` needs no DDL.

### SR-15. Delivery slices (chained PRs, <= 1000 changed lines each)

| Slice | Content | Done when |
|---|---|---|
| S1 Pure domain | `transitions.ts`, `business-days.ts` + port + `calendar.ts` + adapter, `return-reasons.ts`, `decision-templates.ts`, `request-scope.ts`, `validateSubmission` option | Unit tests green; no I/O |
| S2 Schema | `schema.ts` (SR-1), generated `secretary_review` migration, `migration-secretary-review.test.ts`, `solicitud-clases.ts`, audit types and builders | Generated as the next migration; drift check clean; not applied |
| S3 Data + access | `revision-queue.ts`, `solicitud-detail.ts`, `solicitud-decision.ts`, `request-reads.ts`, `resolveRequestScope`, permissions, document route widening + `modo`, SR-16 write path, append-only structural test | Integration tests incl. concurrent decisions |
| S4 Staff UI | `/review`, `/review/[id]`, decision dialog, sidebar, i18n `review.*` | Exactly-once and RNF-01 tests |
| S5 Student UI + correction | `/requests`, `/requests/[id]`, correction context, retire, resubmit, i18n, `docs/roadmap.md` row 2 owner Armando | If the forecast exceeds 1000 lines, split S5a (list/detail) and S5b (correction) |
| S6 Guided correction + change flags | Approve dialog finality text; `correction-focus.ts` (RN-17 -> start step) and the correction reason banner; `revision-diff.ts` `diffRevision` and the staff-detail changes section (SR-17) | Pure mapping and diff unit-tested; no schema, no new audit event; added 2026-10-13 after the manual walk |

Estimate 3,500-5,000 changed lines. PR #1 targets the feature branch; each
later PR targets the previous slice branch.

## Data Flow

```
secretaria -> /review (RSC) -> resolveRequestScope -> listReviewQueue ----> DB
                  | audit solicitud.cola.consultada (same request)
           -> /review/[id] -> getRequestDetail(scope) + listRequestClasses
                  | audit solicitud.consultada, then render
           -> decision dialog -> decideAction -> validateDecision (pure)
                  -> decideRequest tx: guarded UPDATE, [revision], decision, audit
estudiante -> /requests/[id] -> correct?step=n (EditTarget correction)
                  -> resubmitCorrection tx: guarded UPDATE, ReenviadaEn, audit
both       -> /api/intake/documents/[id]?modo -> canViewDocument(scope) -> stream -> audit -> bytes
```

## Interfaces / Contracts

```ts
export type DeadlineStatus = "en_plazo" | "por_vencer" | "vencida";
export function deadlineOf(start: string, cal: NonWorkingDaysProvider): string;
export function deadlineStatus(start: string, today: string,
  cal: NonWorkingDaysProvider): { status: DeadlineStatus; deadline: string };

export type DecisionInput =
  | { tipo: "aprobada"; plantilla: string; texto: string | null }
  | { tipo: "rechazada"; plantilla: string; texto: string }
  | { tipo: "devuelta"; plantilla: string; motivo: ReturnReason; texto: string };
```

## Testing Strategy (strict TDD, vitest)

| Layer | What | Approach |
|---|---|---|
| Unit | transitions exhaustive; business days (weekend start, holiday, year edge, overdue, `coversYear` false); calendar staleness; templates placeholders and render; `validateDecision`; `requestScopeFor`; `canViewDocument` matrix | Pure, injected calendar and `now` |
| Schema | migration contains every CHECK, FK without cascade, partial index; no `Grupo` reference | Read generated SQL by name |
| Integration | decisions (each kind, conflict, out-of-scope = not_found), revision snapshot, correction resubmit, retire vs delete, route 401/404/`modo`, one audit row per read | Mocked data layer; real Postgres opt-in suite for concurrent decisions |
| Structural | audit write only in the review `page.tsx` modules (never a layout or loading file); `prefetch={false}` on review links; no update/delete on append-only tables | File scan |
| UI | queue alert badges with text, dialog flows, RNF-12 reject confirm, 44 px targets, 360 px | Testing Library + user-event |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file
classification or process integration. The HTTP authorization changes
(document route, actions, pages) are covered by SR-6, SR-11, SR-12 and their
RNF-01 tests.

## Migration / Rollout

Additive migration; apply only after S2 is merged and the owner confirms.

| Step | Tag | Command / check |
|---|---|---|
| P1 | `[READ-ONLY]` | Row counts: `Solicitud` by `Estado`, `DocumentoRespaldo`, `Usuario` by role, `secretaria` accounts |
| P2 | `[READ-ONLY]` | Students with a presented request and `CarreraId IS NULL` (would be invisible, SR-6) |
| B1 | `[CONFIRM]` | Neon branch `backup-before-secretary-review` from production |
| M1 | `[CONFIRM]` | `drizzle-kit migrate` over the **direct** (non-pooler) URL |
| V1 | `[READ-ONLY]` | Re-run P1: counts identical (no row touched, as verified for `0007`); new columns all NULL |
| V2 | `[CONFIRM]` | `db:generate` drift check writes nothing |
| F1 | `[CONFIRM]` | SR-16 data step, if chosen |

Rollback: revert slices in reverse order; a confirmed down-migration drops
the two tables, the index and the three columns; intake data is untouched.

## Open Questions

- [x] **SR-16 (CONFIRMED 2026-10-11: (b) for new accounts plus (a) once for the existing secretaria account): how the pilot secretaria gets
  `Usuario.FacultadId`.** (a) One-off data step: a single `UPDATE "Usuario"
  SET "FacultadId" = <FIA id> WHERE "Id" = <account>` `[CONFIRM]` per command.
  Zero code, but every future secretary needs the same manual step.
  (b) Users admin: only `coordinacion` creates `secretaria`
  (`rolesAsignables`), so `createStaffAction` can **derive** `FacultadId`
  from the creating coordinator's `Carrera.FacultadId` on the server, with no
  new form field (about 100 lines in S3; `facultadId` joins
  `AUDITABLE_USER_FIELDS`). There is no edit-user screen, so (b) covers new
  accounts only. **Recommendation: (b) for every new secretary, plus (a) once
  for any secretaria account that already exists in production (P1 tells).**
- [x] RN-08 weekend rule (CONFIRMED 2026-10-11): the deadline is the 2nd
  business day strictly after the start date (Saturday -> Tuesday); spec aligned.
- [x] Rejection text bound (CONFIRMED 2026-10-11): trimmed, 1 to 1000 characters.
- [ ] Owner validation of the 2026 and 2027 non-working-day lists in
  `calendar.ts` (national holidays plus any UAM closures).
- [x] `merge-grupo-into-asignatura` dependency (RESOLVED 2026-10-12): archived
  as option A, UI and routing only, no schema change; `SolicitudAsignatura`
  keeps `GrupoId`, and our migration is simply the next one.

## Requirements Sync 2026-10-12 (thesis matrix, PR #17)

`docs/requirements.md` was synced with the thesis matrix after this design was
written. Impact on this change:

| Change | Impact |
|---|---|
| RF-07 (a) adds "en revisión de coordinación" through RF-10 | None. The state stays unreachable here; `escalation` enables it. The spec scenario reads "not reachable in this change". |
| RN-16 fixes `pendiente` as the initial state | Consistent with SR-3 transitions. |
| RF-01 (d), RF-03 (f), RN-25 consent (`request-consent`, roadmap #9) | Coordination: resubmitting a correction MUST NOT ask for consent again, and a request submitted before `request-consent` (no consent recorded) MUST stay correctable. If `request-consent` lands before S5b, `resubmitCorrection` validates consent from the stored record, not from new input. |
| RF-11 runs on submission (`document-extraction`) | Out of scope. `resubmitCorrection` is the hook point if extraction must rerun for documents added in a correction. |
| RF-14 secretary registers document data (`validation-signals`) | Out of scope. The staff detail page (S4) will host it later; keep its layout open to an extra section. |
| RF-12 names the secretary; `canManageCatalog` also allows coordination and admin | None for this change. |

## Main Sync 2026-10-12 (teammate PRs #15 and #16)

| Finding | Impact on this design |
|---|---|
| `merge-grupo-into-asignatura` archived as option A: UI and routing only, no schema change (PR #15) | SR-2: `Grupo` and `SolicitudAsignatura.GrupoId` stay. S2 is no longer blocked and our migration is the next one (expected `0008`). The isolation rules stand: no new FK to `Grupo`, all class reads through `solicitud-clases.ts`. |
| Groups are now managed under their Asignatura (`/catalog/asignaturas/[id]/grupos/...`) | None: this change only reads class data. |
| `backoffice-ui-refresh` exploration (in progress): `loading.tsx` and `error.tsx` for the dashboard group, a shared TanStack `DataTable` (manual mode, URL params), shared `EmptyState`, `DegradedAlert` and `TableCard`, sidebar and header changes | See SR-11 amendment and the UI coordination note below. |

**SR-11 amendment (exactly-once read audit).** Per
`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`, a
dynamic route is prefetched only "down to the nearest segment with a
`loading.js` boundary", so the page body below that boundary never runs on a
prefetch. The guard is therefore **not** "no `loading.tsx`", which would clash
with `backoffice-ui-refresh`. The invariant is: the audit write lives in the
`page.tsx` body (never in a `layout.tsx` or a `loading.tsx`), review links keep
`prefetch={false}` as a backstop, `cache()` dedupes within a render, and the
structural test (task 4.9) asserts the write is only in the page module. This
holds with or without a dashboard-level `loading.tsx`, as long as
`cacheComponents`/Partial Prefetching stay off (re-check if they are enabled).

**UI coordination with `backoffice-ui-refresh`.** If it lands before S4/S5a,
the review queue and the student list MUST use its shared `DataTable`,
`EmptyState`, `DegradedAlert` and `TableCard` instead of new copies. If S4/S5a
land first, they follow the current catalog list pattern (server-side,
URL-driven) so the refresh can migrate them like the other lists. Both changes
edit `app-sidebar.tsx`; whichever lands second rebases and keeps both sets of
entries.

## SR-17 Guided correction and change flags (S6, 2026-10-13)

Owner decisions taken after the manual walk of S4 and S5b. No schema change,
no migration, no new audit event, no new data module write.

**1. Approve dialog states finality.** Only the copy of
`review.decision.approve.description` changes (`es` and `en`), in the register
of `review.decision.reject.description`: "La aprobación es definitiva: no se
puede deshacer. El estudiante verá el mensaje de abajo; puede editarlo antes."
/ "Approval is final: it cannot be undone. The student will see the message
below; you can edit it first." `decision-dialog.tsx` is unchanged: approve
keeps its single confirm (the RNF-12 two-step confirmation stays on reject
only).

**2. Correction starts at the step of the return reason (RN-17).**

| RN-17 code (`return-reasons.ts`) | Start step | Why |
|---|---|---|
| `documento_ilegible` | 3 Documents | The fix is a new legible copy |
| `fecha_alterada` | 3 Documents | The fix is a document without alterations |
| `fecha_incorrecta` | 1 Cause and dates | The fix is the registered date |

- Pure: `src/lib/intake/correction-focus.ts` exports
  `CORRECTION_FOCUS: Readonly<Record<ReturnReason, "details" | "documents">>`
  (keys of `STEP_KEYS`), so adding an RN-17 code fails typecheck until it is
  mapped. `steps.ts` gains `correctionStartStep(reason: ReturnReason | null):
  StepNumber` (`null` -> 1), next to `parseStep`.
- Page: `requests/[id]/correct/page.tsx` resolves `parseStep(query.step) ??
  correctionStartStep(reason)`; an explicit `?step=` wins. The reason and text
  come from a new owner-scoped read `getCorrectionReason(userId, solicitudId)`
  in `src/lib/data/student-requests.ts` (latest `SolicitudDecision` of an own
  `devuelta` request; `{ motivo, texto } | null`; not audited, like every own
  read). It runs fail-soft with the existing `getLiveDraft` read: a failure
  falls back to step 1 and no banner, never blocks the correction.
- Banner: a `CorrectionReasonBanner` above `FlowSteps`, on every step, with the
  RN-17 label (the labels the student detail already uses) and the message;
  alert pattern of `docs/design-system.md`, `role="status"` (informative, not
  an error), wraps at 360 px.
- Nothing is locked: the stepper, `?step=` links and the review step's edit
  links behave as in S5b.

**3. Changes since the return, flagged for the secretary.**

```ts
// src/lib/intake/revision-diff.ts (pure, no I/O)
export type RevisionSide = {
  causa: string | null; fechaInicio: string | null; fechaFin: string | null;
  clases: readonly { asignaturaId: number; numeroGrupo: string }[];
  documentoIds: readonly number[];      // snapshot DocumentoIds | current non-retired ids
};
export type SectionMark = "changed" | "unchanged";
export type RevisionDiff = {
  causeDates: SectionMark; subjects: SectionMark; documents: SectionMark;
  retiredDocumentIds: number[];         // in the snapshot, not current (ascending)
  addedDocumentIds: number[];           // current, not in the snapshot (ascending)
};
export function diffRevision(snapshot: RevisionSide, current: RevisionSide): RevisionDiff;
```

- Cause and dates: changed when any of `causa`, `fechaInicio`, `fechaFin`
  differs. Subjects: set equality over `${asignaturaId}:${numeroGrupo}`
  (order and duplicates ignored; `RevisionClase` has no `grupoId`, so a
  catalog renumbering of a group would read as a change; accepted, the
  snapshot is the frozen truth). Documents: set comparison of ids.
- Input: `getRequestDetail` already returns `revisiones` (with `clases`,
  `documentoIds`), `clases`, `documentos`, `documentosRetirados` and
  `reenviadaEn`, so the data layer is unchanged. The snapshot is the latest
  revision (highest `Numero`).
- Rendering: `review/[id]/page.tsx` computes the diff only when
  `reenviadaEn !== null`, `revisiones.length > 0` and `estado !== "devuelta"`
  (while returned, the student is still editing in place and the latest
  snapshot is the version just returned), before `recordRequestRead`, and
  passes it to a `ChangesSection` in `request-sections.tsx` placed first in
  the section stack. Each row has a pill badge with text ("Changed" /
  "Unchanged"); retired and added documents are listed by name, resolved from
  `documentosRetirados` and `documentos` (fallback label when an id is not
  found). No new audit event: the one `solicitud.consultada` row of the
  detail covers the read.

**Rejected alternative (owner, 2026-10-13).** Locking the correction to the
reason's scope (for example only the Documents step for
`documento_ilegible`). A wrong or incomplete reason chosen by the secretary
would leave the student stuck with no way to fix the real problem, and the
request could only be rejected. The reason guides the starting step; it never
restricts editing.
