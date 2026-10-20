# Exploration: teacher-remission

Roadmap row #3. Covers RF-09; RN-18, RN-19; RNF-07.

## Current State

- **Approval**: `decideAction` (`src/app/(dashboard)/review/[id]/actions.ts`) calls
  `decideRequest` (`src/lib/data/solicitud-decision.ts`). One `db.transaction`:
  guarded UPDATE `Solicitud.Estado` pendiente → aprobada (from `TRANSITIONS` in
  `src/lib/intake/transitions.ts`), insert `SolicitudDecision`, insert audit row
  `solicitud.aprobada`. Then redirect to `/review?resultado=aprobada`. No hook for
  side effects; nothing sends mail today.
- **Mail**: no mail library, no provider env vars, no docs. `package.json` only
  has `@vercel/blob`. `src/env.ts` uses optional secrets asserted at use
  (`BLOB_READ_WRITE_TOKEN?`, `CRON_SECRET?`). `vercel.json` has one daily cron
  (`/api/cron/intake-sweep`, Bearer `CRON_SECRET`).
- **Teachers**: `Solicitud` → `SolicitudAsignatura.grupoId` → `Grupo.docenteId` →
  `Usuario` (`NombreCompleto`, `Correo` varchar(160) UNIQUE NULLABLE). Docentes
  come from the Excel import keyed by `Correo`, so it is normally present. One
  request can reach several teachers; one teacher can own several groups
  (dedupe by `DocenteId`). Teachers do not log in.
- **Student copy**: `Solicitud.EstudianteCorreo` is a submit-time snapshot
  (RN-02), usable for the CC.
- **Documents**: `DocumentoRespaldo` (pdf|png|jpeg, ≤ 10 MiB, up to 5 per
  request → 50 MiB worst case). Private Vercel Blob behind the `DocumentStore`
  port (`src/lib/intake/ports.ts`, composition root `src/lib/intake/deps.ts`,
  fakes in `src/lib/intake/fakes.ts`). The download route
  `/api/intake/documents/[id]` requires a session, so a teacher cannot use it.
- **RN-19 special format**: not modelled. Cause `fuerza_mayor` exists
  (`src/lib/intake/causes.ts`) but there is no special-format flag, no document
  kind, and no "signed and stamped by coordination" attribute. RF-14(d)
  (secretary registers the document type) belongs to `validation-signals`.
- **Audit**: closed `AUDIT_ACTIONS` list in `src/lib/audit/types.ts` with
  builders in `events.ts`; payloads carry ids/codes/counts only and are
  leak-tested.
- **Schema**: Drizzle migrations 0000–0008. A new table means migration 0009,
  which needs explicit user confirmation before it is applied to Neon.
- **Tests**: Vitest, colocated; ports with fakes; strict TDD.
- **Next 16**: read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`
  before using `after()`.

## Affected Areas

- `src/lib/data/solicitud-decision.ts`, `src/app/(dashboard)/review/[id]/actions.ts`
  — approval is the trigger; sending runs after commit, never inside the
  transaction (RNF-07 a).
- `src/db/schema.ts` + `drizzle/0009_*` — new remission table.
- `src/lib/intake/ports.ts`, `deps.ts`, `fakes.ts` — `MailSender` port, adapter, fake.
- `src/env.ts`, `vercel.json` — provider env vars, retry cron.
- `src/lib/audit/types.ts`, `events.ts` — new actions.
- Review detail page and i18n — send state, send time and resend action.
- Must not touch `openspec/changes/backoffice-ui-refresh`.

## Open Decisions

| ID | Decision | Options | Recommendation |
| -- | -------- | ------- | -------------- |
| D1 | Mail provider | Resend (HTTP), SMTP to UAM's server, Microsoft Graph / Gmail API | `MailSender` port with env-selected adapter; provider confirmed by the user / UAM IT |
| D2 | Sync vs queue | Synchronous send; outbox with retry; external queue | Outbox: one `Remision` row per teacher created in the approval transaction, send after commit, manual resend + cron retry |
| D3 | Attachment vs link | Attach files; signed expiring link; hybrid | Attach with a total-size guard; over-limit stays pending resend |
| D4 | RN-19 special format | Student uploads and secretary flags; coordination uploads; secretary attaches at approval | Needs a product answer |
| D5 | Send time (RF-09 c) | Column on `Solicitud`; per-teacher field | `EnviadaEn` per `Remision` row plus audit events |
| D6 | Teacher without `Correo` | Block approval; approval stands and remission is blocked | Approval stands; remission row blocked with a reason code |
| D7 | Teacher snapshot | Resolve at send time; snapshot at approval | Snapshot `DocenteId` and email at approval |
| D8 | Message content | — | Spanish constant with RN-18 text; each teacher's mail lists only their groups; student in CC |

## Risks

- Migration 0009 needs explicit confirmation before touching Neon.
- Provider unknown; the institutional sender domain depends on UAM IT DNS.
- Documents and personal data leave the system (review RNF-02, RNF-04).
- 50 MiB worst case vs provider message limits.
- Retries can double-send without a guarded per-row claim.
- RN-19 overlaps `validation-signals` (RF-14 d).
- Vercel cron frequency depends on the plan.

## Ready for Proposal

Yes, after D1, D4 and D6 are answered.
