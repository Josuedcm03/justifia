# Design: Justification Intake

## Technical Approach

Hexagonal slice. Pure domain in `src/lib/intake/` (no I/O, injected `now`), two ports (`DocumentStore`, `GroupScheduleProvider`), adapters in `src/lib/intake/adapters/`, persistence in `src/lib/data/`, transport in server actions plus three route handlers. Files go browser to a private Vercel Blob store and never cross a Next function body (C1, C13). Decisions D1-D15 (`preproposal.yaml` rev 6) are fixed; claim IDs refer to `research.md`.

## Architecture Decisions

| # | Option chosen | Rejected | Rationale |
|---|---|---|---|
| A1 | Single `Solicitud` with `Estado` CHECK (`borrador` + RN-16) | Separate draft table | D7; submit is one UPDATE |
| A2 | `DocumentoRespaldo.Estado` `pendiente`/`valido`; finalize claims a `pendiente` row before sniffing | Row only after validation | Row claim enforces the 5-document cap (D12, counts `pendiente` + `valido`) and pathname uniqueness under concurrent finalize; stale `pendiente` rows are swept |
| A3 | Magic bytes read in finalize action via `get()` stream, first 8 bytes, then cancel (D3, C16, C29) | `onUploadCompleted` (C15); `file-type` lib | Works on localhost; no dependency; mirrors `src/lib/import/guards.ts` |
| A4 | Token route (`handleUpload`) is a Vercel-only inbound adapter; port covers server-side read/delete/list/stream | Port owning token issuance | Token protocol is vendor-specific; an R2 swap replaces route and adapter only |
| A5 | One clock: action takes `now = new Date()`, used for RN-23 and `PresentadaEn` | DB `now()` for timestamp | Rule boundary and stored value cannot disagree |
| A6 | Dates as Postgres `date` (`mode: "string"`, ISO); Managua "today" via `Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" })` | `timestamptz` for absence dates | Calendar days have no time zone |
| A7 | Step routed by `?step=1..4` searchParams, server-loaded draft | Client-held wizard state | Refresh/back safe; draft is server truth (D8) |
| A8 | Draft operations (create, autosave, discard, cron expiry, orphan sweep) write no audit row; sweeps emit a structured log with counts only (D14) | Fake system actor; auditing drafts | `EventoAuditoria.ActorId` is NOT NULL FK; a `borrador` is not yet a presented request, so auditing of the request starts at submission. Exception: explicit student document actions (attach, remove, rejected upload) are audited from the first file (sensitive data, RNF-02; human actor always present); cascaded deletions are not |
| A9 | Download writes one `documento.descargado` row per successful download, after auth and `store.stream()` opens, before bytes are sent (D13) | Unaudited reads | RNF-06 a requires exactly one entry per read; audit-insert failure fails the download |

## Data Model (`src/db/schema.ts`, one generated migration)

```
Solicitud: Id identity PK | EstudianteId FK Usuario NOT NULL
  Estado varchar(30) NOT NULL default 'borrador'
    CK in ('borrador','pendiente','en_revision_coordinacion','devuelta','aprobada','rechazada')
  Causa varchar(30) NULL  CK null or in 5 codes (RN-01)
  FechaInicio, FechaFin date NULL  CK FechaFin >= FechaInicio (RN-05)
  PresentadaEn timestamptz NULL
  EstudianteNombre(160) EstudianteCif(20) EstudianteCarrera(160) EstudianteCorreo(160) NULL (D9)
  CreadoEn, ActualizadoEn timestamptz NOT NULL default now()
  CK_Solicitud_Presentada: Estado='borrador' OR (PresentadaEn, Causa, both dates, 4 snapshot cols NOT NULL)
  UX_Solicitud_Borrador UNIQUE (EstudianteId) WHERE Estado='borrador'      (D8)
  IX_Solicitud_Estado (Estado, PresentadaEn); IX_Solicitud_BorradorActualizado (ActualizadoEn) WHERE borrador
SolicitudAsignatura: PK (SolicitudId FK CASCADE, GrupoId FK Grupo)
DocumentoRespaldo: Id PK | SolicitudId FK CASCADE | Pathname varchar(255) UNIQUE
  NombreOriginal varchar(255) | TipoDetectado varchar(10) NULL CK in (pdf,png,jpeg)
  TamanoBytes integer CK 0 < x <= 10485760 | Estado varchar(10) CK in (pendiente,valido)
  CK: Estado='pendiente' OR TipoDetectado NOT NULL | CreadoEn
```

`ActualizadoEn` is set explicitly by every draft mutation in `src/lib/data/solicitudes.ts` (no trigger). `EventoAuditoria` needs no DDL (`EntidadTipo` is varchar; its CHECK only targets `Usuario`). Migration number: `catalog-management` owns `0005` (`catalog_management`) and plans `0006` (`Grupo.Dias`), not yet on `main` (see Compatibility with catalog-management). On the feature branch the migration is generated against current `main`; at the final merge it is deleted and regenerated on top of `main` (expected `0007` or later). Tests locate the migration by its `justification_intake` name, never by number. Never `migrate`/`push` without per-command confirmation.

## Ports and Locations

```ts
// src/lib/intake/ports.ts
export interface DocumentStore {
  readHead(pathname: string, bytes: number):
    Promise<{ size: number; head: Uint8Array } | null>;
  delete(pathnames: readonly string[]): Promise<void>;
  list(prefix: string, cursor?: string):
    Promise<{ blobs: { pathname: string; uploadedAt: Date }[]; cursor?: string }>;
  stream(pathname: string): Promise<ReadableStream<Uint8Array> | null>;
}
export interface GroupScheduleProvider {
  groupsWithClass(grupoIds: readonly number[], range: { from: string; to: string }):
    Promise<ReadonlySet<number>>;
}
```

| Path | Content |
|---|---|
| `src/lib/intake/{causes,limits,dates,signature,submission,eligibility,states,pathnames}.ts` | Pure rules; `states.ts` exports `VISIBLE_STATES` excluding `borrador` |
| `src/lib/intake/adapters/vercel-blob-store.ts` | `server-only`; `get/del/list` with `access: "private"` |
| `src/lib/intake/adapters/weekday-schedule.ts`, `src/lib/intake/schedule.ts`, `src/lib/data/grupo-dias.ts` | Weekday adapter over `Grupo.Dias` (F.4, RN-22): pure `hasClassInRange`, injected mask read. `adapters/permissive-schedule.ts` remains only as the all-groups test double used by `fakes.ts` |
| `src/lib/intake/deps.ts` | `getIntakeDeps()` wiring; mocked in tests |
| `src/lib/validations/solicitud.ts` | zod step schemas; messages are i18n keys |
| `src/lib/data/solicitudes.ts`, `src/lib/data/enrollment.ts` | Draft CRUD, submit transaction, eligible groups |

Limits (constants, D4): 10 485 760 bytes, `application/pdf|image/png|image/jpeg`, 5 documents per draft counting `pendiente` + `valido` (D12), draft TTL 30 days, orphan grace 24 h, pending grace 1 h, RN-23 window 30 days. Pathname `intake/{solicitudId}/{uuid}.{ext}`; original name stored only in DB (C28).

## Upload Sequence

```
Browser            /api/intake/upload-token        Blob          finalizeDocument (action)        DB
 |-- upload(pathname, file, handleUploadUrl) -->|                  |                           |
 |                 | onBeforeGenerateToken:     |                  |                           |
 |                 |  getCurrentUser, student,  |                  |                           |
 |                 |  pathname under own draft, |                  |                           |
 |                 |  doc count < 5 (D12)       |---------------------------- read ----------->|
 |                 | -> allowedContentTypes, maximumSizeInBytes 10485760,                      |
 |                 |    validUntil now+10 min, allowOverwrite false                            |
 |<-- client token -|                           |                  |                           |
 |------------------ PUT file ---------------->|                  |                           |
 |-- finalizeDocument(pathname, name) ------------------------------>| requireUser + predicate  |
 |                                             |                  | prefix == own draft       |
 |                                             |                  | INSERT pendiente -------->|
 |                                             |<-- get() head ---| sniff 8 bytes, size       |
 |                                             |                  | ok: UPDATE valido + audit>|
 |                                             |<-- del() --------| bad: DELETE row + audit ->|
 |<------------------- { ok | fieldError key } ---------------------|                           |
```

If the draft already counts 5 `pendiente` + `valido` documents, `onBeforeGenerateToken` throws and the client receives `too_many_documents`; no token is issued. Finalize re-counts inside the transaction that inserts the `pendiente` row (row lock on the `Solicitud`), so concurrent tokens cannot exceed the cap; an over-cap finalize deletes the blob, writes `documento.rechazado` with reason `too_many_documents`, and returns that reason (D12). `onUploadCompleted` is a no-op. Local dev: `vercel env pull` provides `BLOB_READ_WRITE_TOKEN` for a dev store; the flow needs no callback, so it runs on `localhost` unchanged. `/api` is excluded from `middleware.ts`, so each route authenticates itself.

## Submit Sequence (`submitRequest` action)

```
requireUser -> canFileRequests -> loadDraft(userId) (+lines, valid docs)
 -> validateSubmission(draft, managuaToday(now))  RN-01, RN-03, RN-04, RN-05, RN-23, >=1 subject
 -> enrollment.activeGroups(userId) ∩ schedule.groupsWithClass(range)  RF-04, RN-21, RN-22
    every selected GrupoId must still be eligible
 -> errors? return { fieldErrors } (per field, RF-03)
 -> db.transaction:
      read Usuario+Carrera snapshot (RN-02)
      UPDATE Solicitud SET Estado='pendiente', PresentadaEn=now, snapshot
        WHERE Id=? AND EstudianteId=? AND Estado='borrador'   (0 rows -> conflict)
      insertAuditEvents(tx, userId, [solicitudPresentadaEvent])
 -> redirect to confirmation
```

## Cleanup and Download

- **Cron** `GET /api/cron/intake-sweep` writes no audit row (D14; structured log with counts only), `vercel.json` schedule `0 9 * * *` (03:00 Managua; daily is the Hobby ceiling, C33). Rejects unless `Authorization: Bearer ${CRON_SECRET}` (constant-time compare). Steps: delete expired drafts (`ActualizadoEn` < now-30 d, batches of 100, rows first, blobs best-effort); delete `pendiente` documents older than 1 h; `list({ prefix: "intake/" })` paginated, `del()` blobs older than 24 h with no `DocumentoRespaldo` row (C32). Idempotent; orphan sweep is the backstop for failed deletes.
- **Download** `GET /api/intake/documents/[id]` (`params` is a Promise in Next 16): no session 401; not owner (only the owning student in this change, D15) or not `valido` 404; `store.stream()` returns null 404. None of these writes an audit row. On success, insert one `documento.descargado` event (entity `DocumentoRespaldo`, document id, session user as actor, D13) before returning the response; if the insert fails, cancel the stream and return 500 with no bytes. Streams `store.stream()` with `Content-Type` from `TipoDetectado`, `Content-Disposition: inline; filename*=UTF-8''…`, `Content-Security-Policy: sandbox`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` (C17). Decision (owner-approved 2026-10-09): the student views, not downloads, so the route serves inline and steps 3 and 4 link to it (`target="_blank"`, `rel="noopener noreferrer"`); the sandbox CSP and `nosniff` contain the student-supplied bytes. The audit event keeps its name and records a read. An explicit download for staff is deferred to `secretary-review`.

## DB Connectivity (D11)

`src/db/index.ts`: in production use `postgres(DATABASE_URL, { max: 3, idle_timeout: 20, connect_timeout: 10, prepare: false })`; keep `max: 10` locally. `DATABASE_URL` in Vercel must be the Neon `-pooler` host (PgBouncer transaction mode; `prepare: false` is the safe default there). Set `vercel.json` `regions` to the region matching the Neon project; create the Blob store in the same region.

## UI

| Layer | Files under `src/app/(dashboard)/requests/new/` |
|---|---|
| Container | `page.tsx` (RSC: `requireUser`, `canFileRequests` else denied path, fail-soft draft load, step from searchParams), `actions.ts` |
| Presentational | `intake-stepper.tsx`, `cause-dates-step.tsx`, `subjects-step.tsx` (radio per ambiguous subject), `documents-step.tsx` (client, `@vercel/blob/client` `upload()`), `review-step.tsx`, `submit-dialog.tsx`, `discard-dialog.tsx` |

New primitives (shadcn base-ui): `alert-dialog`, `radio-group`, composed `stepper`; `checkbox` is reused from `catalog-management` (`Checkbox`/`CheckboxGroup`) once it is on `main`, otherwise created with the same API. Dates use native `<Input type="date">`. Tokens only from `docs/design-system.md`: the active step uses the primary-colour underline of the current design system ("Academic Governance"; the lime highlight is retired) paired with `aria-current="step"`; the Stitch "nueva solicitud" export is the layout reference; errors under fields with `role="alert"`; destructive button for discard; spacing steps 4-80. At 360 px: stepper collapses to "Step n of 4" plus bar, subjects render as stacked cards (no table), buttons full width, file names truncate. Sidebar: top-level `newRequest` (`/requests/new`, `FilePlus`, `visibleTo: canFileRequests`). `permissions.ts`: `rolesSolicitantes = ["estudiante"]`, `canFileRequests`, `canViewDocument(viewer, ownerId)` (owner only in this change, D15). Step 2 renders a "no teacher assigned" label for a group without a teacher and does not block submit (D15); `validateSubmission` requires at least one subject (D15). i18n: `intake.*` (steps, causes, fields, errors, documents, review, dialogs) and `nav.newRequest` in both `es.json` and `en.json`.

## Audit Events

`AuditEntityType` gains `Solicitud`, `DocumentoRespaldo`. Actions (exactly five, matching the `audit-log` delta):

| Action | Entity | Written by |
|---|---|---|
| `solicitud.presentada` | `Solicitud` | submit transaction |
| `documento.adjuntado` | `DocumentoRespaldo` | finalize accepted |
| `documento.rechazado` | `Solicitud` (draft id) | finalize rejected, incl. `too_many_documents` |
| `documento.eliminado` | `DocumentoRespaldo` | document removal |
| `documento.descargado` | `DocumentoRespaldo` | successful download (D13) |

No events for draft create, autosave, discard, cron expiry, or orphan sweep (D14), including the document deletions they cascade. Explicit student document actions are audited even on a `borrador` (D14 exception). Payloads carry ids, counts, detected type and size, and the rejection reason code; never cause, dates, personal data, file names, contents, or storage locations. Builders live in `src/lib/audit/events.ts`.

## Testing Strategy (strict TDD, vitest)

| Layer | What | Approach |
|---|---|---|
| Unit | signature sniff, Managua dates (UTC-midnight crossing, day 30/31), `validateSubmission` per field, eligibility ambiguity, `VISIBLE_STATES`, pathname ownership | Pure, byte fixtures, injected `now` |
| Integration | actions, token/download/cron routes | Mock `dal`, `getIntakeDeps` (fake store, fake schedule), data layer; assert headers, 401/404, delete on mismatch, Bearer check, 6th-document token refusal (D12), one `documento.descargado` row per download and none on 401/404 (D13), no audit rows from draft ops and cron (D14) |
| Schema | migration SQL has CHECKs and partial unique index | Read generated SQL (as `migration-0002.test.ts`) |
| UI | steps, field errors, dialogs, sidebar visibility | Testing Library + user-event |

## Threat Matrix

All rows N/A: no shell, subprocess, VCS/PR automation or documentation-path classification. HTTP surfaces are covered above (token auth, magic bytes, nosniff, Bearer cron).

## Migration / Rollout

Five chained PRs as in the proposal (schema+domain+ports; blob adapter+routes; actions+enrollment+audit+permissions; steps 1-3+primitives+i18n; review+dialogs+cron+360 px). Env: `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET` (optional in `src/env.ts` outside production, asserted by adapter/route). Rollback: revert slices; confirmed down-migration drops the three tables.

## Open Questions

- [ ] Verify `prepare: false` necessity and Hobby region selection against current Neon/Vercel docs at apply.

## Compatibility with catalog-management

Observed on `origin/feat/sidebar-catalogs` (2026-10-07, not merged to `main`). Re-check when it lands.

| Topic | What catalog-management does | Impact here | Slice |
|---|---|---|---|
| Group days | `Grupo."Dias" smallint` bitmask (Monday = bit 0 ... Sunday = bit 6, `0` = no days), migration `0006`, codec `src/lib/catalog/dias.ts` (`DIAS_SEMANA`, `decodeDias`) | `GroupScheduleProvider.groupsWithClass(ids, from, to)` is satisfiable from weekdays alone: a group has class when any date in `[from, to]` (America/Managua) falls on a set day. Add `adapters/weekday-schedule.ts` reusing `decodeDias`; a group with mask `0` counts as having class (never hide a subject). No hours, period dates or holidays exist, so those stay out of RN-22 | Done in F.4 (final merge) |
| Migration numbers | Owns `0005`, plans `0006` | Ours is regenerated at the final merge (expected `0007`+); tests find it by name | 1, final merge |
| Design system | `docs/design-system.md` replaced by Stitch "Academic Governance"; lime retired; active step = primary underline | Stepper and review UI follow the new document; take tokens from it, not from the retired UAM system | 4, 5 |
| Checkbox | Adds `Checkbox`/`CheckboxGroup` primitives | Reuse instead of creating a second one | 4 |
| Audit base spec | `openspec/specs/audit-log/spec.md` now exists (archived catalog-excel-import) | Our `audit-log` delta is rebased onto it at archive | Archive |
| Shared files | Edits `permissions.ts`, `app-sidebar.tsx`, `i18n/*.json`, audit types | Expected merge conflicts, resolved at the final merge | Final merge |

