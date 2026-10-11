# Exploration: justification-intake

Roadmap row #1. Covers RF-01..RF-04, RN-01..RN-06, RN-21, RN-22, RNF-11.
Out of scope: secretary-review, teacher-remission, document-extraction, validation-signals.
Depends on: catalog-schedule (in progress) for per-group schedules (RN-22).

## Recommendation

Server-side draft + 4-step stepper + per-file uploads. Storage and schedules
behind ports (`DocumentStore`, `GroupScheduleProvider`). Postgres `bytea` first,
hand-rolled magic-byte guard, single `Solicitud` table with `borrador` + RN-16
states. RN-22 runs on a temporary permissive adapter until catalog-schedule lands.
Estimated size 2,200–3,000 lines, ~5 chained slices.

## Requirement mapping

- RF-01: create request (dates, subjects, cause) bound to the authenticated student.
- RF-02: multiple files per request; invalid file rejected with reason.
- RF-03: per-field submit blocking; RN-01..RN-05 are the checks.
- RF-04: show group and teacher per subject, only subjects passing RN-22; if
  enrollment does not resolve a single group, the student chooses one.
- RN-02: name, CIF, career, email come from the account.
- RN-06: submission timestamp server-set, America/Managua.
- RN-16: this change only writes `pendiente` (plus internal `borrador`).
- RN-21: enrollment lookup via `Inscripcion` → `Grupo` → `Asignatura`.
- RNF-11: usable at 360 px.
- Cross-cutting: RNF-01, RNF-02, RNF-06, RNF-12; RNF-09 verified at pilot.
- Open: whether RNF-14 (causes and max file size configurable without redeploy) applies now.

## Current state

- RN-02 data exists on `Usuario`.
- `Inscripcion` has no uniqueness per subject+period (RF-04(c) case is real).
- No schedule table or period dates; `Grupo.periodo` is a bare string.
- catalog-schedule has no spec or branch in the repo.
- `permissions.ts` has no student predicate.
- Audit events are a closed union; `entidadTipo` is varchar (likely no migration needed — confirm in design).
- `middleware.ts` sits in front of server-action POSTs; Next 16 `proxyClientMaxBodySize`
  defaults to 10 MB and buffers only up to the limit — a 10 MB file + multipart
  overhead may be truncated. Must be tested.
- `serverActions.bodySizeLimit` is global in `next.config.ts` (5 MiB + 64 KiB, tuned for catalog import).
- Missing UI primitives: stepper, alert-dialog, checkbox, date picker.
  `docs/design-system.md` §2.3 reserves lime for the active step.

## Affected areas

- `src/db/schema.ts`, new `drizzle/0005_*.sql` (not applied without user confirmation).
- New `src/lib/intake/`, `src/lib/validations/solicitud.ts`, data files under `src/lib/data/`.
- `src/lib/audit/types.ts`, `events.ts`.
- `src/lib/auth/permissions.ts`, `src/components/app-sidebar.tsx`, `i18n/es.json`, `i18n/en.json`.
- New `src/app/(dashboard)/requests/new/*`.
- `next.config.ts`, `src/lib/import/limits.ts`.
- New primitives under `src/components/ui`.

## Decision 1 — File storage

Hosting target unknown (only the stock Vercel `.gitignore` block; Neon confirmed).
A Vercel target (~4.5 MB request body cap, unverified) breaks 10 MB uploads through server actions.

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Postgres `bytea` (Neon) | No new vendor; Neon at-rest encryption (to verify); transactional with the request, no orphans; one backup domain; cascade delete | DB size/egress growth; plan limits; files pass through app server; never select the column in lists | Low-Med |
| B. Vercel Blob | Direct client upload avoids body cap | Target unconfirmed; private mode/encryption to verify; orphans; validation needs post-upload download | Medium |
| C. S3/R2 private bucket + SSE + presigned URLs | Standard, scalable | New account/credentials/SDK; orphans; two backup domains | Med-High |
| D. Local filesystem | Trivial in dev | Ephemeral on serverless; reject for prod | n/a |

Recommendation: `DocumentStore` port (put/get/delete), option A first; switch to B/C if hosting is Vercel.

## Decision 2 — Real-format validation

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. Hand-rolled guard: `%PDF-`, PNG 8-byte signature, JPEG `FF D8 FF`, ≤10 MB, store detected type | No dependency; mirrors `src/lib/import/guards.ts`; reasons map to RF-02(b) | Signature-only; polyglots/corrupt files pass | Low |
| B. `file-type` library | Better sniffing | ESM-only dependency; still magic bytes | Low-Med |
| C. Deep parse (pdf-lib, sharp) | Rejects corrupt/malicious files | Heavy deps, CPU; creeps into document-extraction | High |

Recommendation: A, plus `nosniff` and attachment download headers; B as upgrade path.
One file per action (limit ≈ 10 MB + overhead). Raise `proxyClientMaxBodySize`
and prove with a test that 10 MB arrives intact. Transport limits are build-time,
so RNF-14 "without redeploy" can only apply to the app-level rule.

## Decision 3 — Request model and RN-16 states

Tables: `Solicitud`, `SolicitudAsignatura` (resolved group), `DocumentoRespaldo`.
`presentadaEn` NULL until submit.

| Option | Pros | Cons | Effort |
| --- | --- | --- | --- |
| A. One table, `estado` = `borrador` + 5 RN-16 states, CHECK constraint | One model; submit is one transition; RF-08 fits | `borrador` not an RN-16 state; downstream lists must filter it | Low-Med |
| B. Separate `SolicitudBorrador` copied on submit | Drafts can't leak into queues | Duplicate structures; files must move | Medium |
| C. No server draft | No draft rows/cleanup | Refresh loses everything; N files in one submit | Low |

Recommendation: A, with a domain visible-states helper and a test that drafts are excluded.
This change owns `borrador` and `pendiente` only. Causes: seeded lookup table only
if RNF-14 applies; otherwise a constant. Open: snapshot vs live join for RN-02
student data (lean: snapshot at submit).

## Stepper and orphan files

Steps: cause and dates → subjects → documents → read-only review with alert-dialog
confirmation (RNF-12). At 360 px: "step n of 4" + progress bar, native date inputs.
Server draft, one file per action. With `bytea` + cascade delete, orphans reduce to
stale drafts: one open draft per student (partial unique index), lazily purge stale
drafts when the student starts a new request (no scheduler in the project). Submit
re-validates from the stored draft in one transaction with audit events.

## RN-22 dependency handling

- `GroupScheduleProvider` port: `groupsWithClass(groupIds, from, to)` → set of group ids with class in range.
- Pure eligibility logic tested with a fake provider (strict TDD proceeds now).
- Temporary permissive adapter (every active enrolled group has class), flagged as a known gap; RN-22 schedule-filtering scenarios marked deferred.
- Real adapter later = one file + wiring.
- Agree a minimal contract with catalog-schedule owner (grupoId, ISO weekday, start/end time) and how current period and holidays are determined.

## Size and slicing

| Slice | Content | Approx lines |
| --- | --- | --- |
| 1 | Schema + migration (not applied), validations, guard, ports | 500-700 |
| 2 | Document store, upload action, limits, download route | 450-600 |
| 3 | Draft and submit actions, enrollment queries, audit, permissions | 500-650 |
| 4 | Stepper steps 1-3, UI primitives, i18n | 500-700 |
| 5 | Review step, confirm dialog, nav, 360 px polish | 300-400 |

## Open questions before proposal

1. Hosting target (Vercel or other)?
2. Does RNF-14 apply to causes and max file size now?
3. Is the temporary permissive RN-22 adapter acceptable?
4. Date constraints: future dates allowed? Maximum span? (RN-05 silent)
5. Confirm draft/`pendiente` model.

## Risks

- Vercel target invalidates server-side 10 MB uploads and the `bytea` option.
- Middleware body buffering may truncate large action bodies.
- RN-22 unverifiable until catalog-schedule lands; no period dates exist.
- Migration numbering may collide with catalog-management and catalog-schedule.
- Every migration/seed needs per-command user confirmation.
- Health documents in DB: RNF-02 relies on Neon at-rest encryption (verify); RNF-04 retention and draft cleanup unresolved.
- Drafts may leak into future review queues if `borrador` is not filtered everywhere.
- RNF-06 audit scope ambiguous (reads?); audit unions must be extended.
- UI gaps must not implicitly extend design tokens.
- Snapshot vs live join for RN-02 is expensive to change later.

Unverified claims: Vercel body cap, Neon at-rest encryption.
