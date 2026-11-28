# Exploration: normative-parameters (RNF-14, roadmap row 8)

Base `main` a5b057f, worktree `C:\justifia-worktrees\p1`, explored 2026-11-27, artifact store openspec. Persisted by the orchestrator from the sdd-explore result (the executor had no file-write tool); condensed copy in Engram `sdd/normative-parameters/explore`.

## Current State

### Seams that already exist

- **Calendar:** `NonWorkingDaysProvider` (`src/lib/intake/ports.ts:90`) is a sync port with `isNonWorkingDay` and `coversYear`. `constantCalendar(record)` (`src/lib/intake/adapters/constant-calendar.ts:9`) already builds a provider from a plain per-year record, so a DB-backed calendar only needs a loader that produces that record.
- **Signal parameters:** `evaluateSignals(input, params, calendar)` (`src/lib/signals/evaluate.ts:25`) receives its parameters; no evaluator reads a constant.
- **Pure rule code:** the pure functions can stay sync if the async load happens once at the action or page boundary.

### Inventory of normative constants

| Parameter (rule) | Value | Defined | Readers | Sync? |
|---|---|---|---|---|
| Remission deadline, business days (RN-08) | 2 | `src/lib/intake/business-days.ts:11` `BUSINESS_DAYS_TO_REMIT` (private, used at :44) | `deadlineOf` :39, `deadlineStatus` :54, `listReviewQueue` (`src/lib/data/revision-queue.ts:105`), review detail (`review/[id]/page.tsx:195`) | sync, pure |
| Alert when 1 business day is left (RN-08) | 1 | literal `remaining <= 1` at `business-days.ts:67`; copy `review.queue.dueSoon` (es/en.json:1317) | queue and detail badges | sync |
| Late filing: 2nd business day after end date (RN-07) | 2 | no constant of its own; `src/lib/signals/timing.ts:18` calls `deadlineOf`, so RN-07 and RN-08 share one number | `evaluateSignals` through `loadSignals` | sync |
| End date at most 30 calendar days before filing (RN-23) | 30 | `src/lib/intake/limits.ts:27` `LATE_WINDOW_DAYS`, used in `dates.ts:42-48` | `validateSubmission` (`submission.ts:105`), `makeDetailsStepSchema` (`src/lib/validations/solicitud.ts:58`), `step-actions.ts:91` (applies), `solicitud-correction.ts:88` (off); copy `intake.errors.end_too_old` states "30 días" (:940) | sync, pure |
| Non-business days | 2026 and 2027, 15 dates each | `src/lib/intake/calendar.ts:17`, `calendar` at :54 | `review/page.tsx:68`, `review/[id]/page.tsx:195`, `coordination/[id]/actions.ts:54` (answer pause), `data/signals.ts:273` (default); injected at `revision-queue.ts:86`, `escalation-answer.ts:46`, `evaluate.ts:28`, `timing.ts:16` | sync provider |
| Recurrence threshold (RN-14) | 3 | `src/lib/signals/params.ts:17` | `issuer.ts:113`; `loadSignals` default at `data/signals.ts:272`; callers `review/[id]/page.tsx:144`, `coordination/[id]/page.tsx:44`, `integration/rf-14-support.ts:298`; the evidence already carries `threshold` | sync |
| Type-to-cause map (RN-13) | 3 types × causes | `src/lib/signals/document-type-causes.ts:15`, `params.ts:18` | `document-marks.ts:101-108`, `evaluate.ts:56` | sync |
| Max document size (RN-04) | 10,485,760 B | `src/lib/intake/limits.ts:5` | see "File size" | mixed |
| Five causes (RN-01) | 5 | `src/lib/intake/causes.ts:5`, plus `CAUSAS_CON_REPOSO` :28 | see "Causes" | sync |

**Operational constants (not normative, stay in code):** `MAX_DOCUMENTS_PER_DRAFT`, `DRAFT_TTL_DAYS`, the sweep grace hours, `UPLOAD_TOKEN_TTL_MINUTES`, the extraction limits, and `MAX_FILE_BYTES` (5 MiB) of the catalog import (RNF-13).

**Retention (RNF-04).** `RETENTION_YEARS = 5` (`src/lib/retention/policy.ts:4`) is hard-wired into the audit literal `retencion_5_anios` (`src/lib/audit/types.ts:319`). Lowering it would trigger irreversible anonymization (RN-27); recommended out of RNF-14. RN-20's "20 %" is never computed by the system.

### Calendar

- Business days are Monday to Friday minus the listed dates, computed on read in `business-days.ts`.
- Dates are plain ISO strings; only "today" depends on the Managua zone (`dates.ts:8`, UTC-6, no DST).
- `coversYear` drives the muted "calendar not loaded" note in the queue and the RN-07 signal returning `not_evaluable` with `calendar_not_covering_year`.
- `calendar.test.ts` is a real-clock staleness test; it must be replaced by the coverage notice once the calendar is data.
- `pausedStartOnAnswer` (`deadline-clock.ts:40`) stores `PlazoInicioEn` using the calendar at the time of the answer; that stored value is never recomputed.
- A configurable calendar needs a date table, a loader that builds `constantCalendar(rowsByYear)`, and an add/remove screen with year coverage visible.

### Causes

- **Code:** the `CAUSAS` tuple is the source of the `Causa` type. `isCausa` or `CAUSAS` is used in 9 non-test files: `causes.ts`, `schema.ts`, `data/signals.ts`, `submission.ts`, `validations/solicitud.ts`, `cause-dates-step.tsx`, `review/[id]/page.tsx`, `reports/params.ts` and the reports page.
- **Database CHECKs:** `CK_Solicitud_Causa` (`src/db/schema.ts:322`), `CK_SolicitudRevision_Causa` (:521), and `CK_Solicitud_FormatoEspecial` with the literal `'fuerza_mayor'` (:350). The migration history repeats the lists.
- **Behaviour tied to specific codes:** `CAUSAS_CON_REPOSO` drives RN-09/RN-10; `FORCE_MAJEURE` (`solicitud-decision.ts:57,190`) drives the special format (RN-19); `CAUSE_PHRASES` (`decision-templates.ts:35`) feeds the decision templates.
- **Labels and the map:** labels live in i18n `intake.causes.*` (`es.json:871`); the type-to-cause map is keyed by cause code.
- **Existing data:** `Solicitud.Causa` and `SolicitudRevision.Causa` hold the code; a deactivated cause must keep rendering for existing requests, decisions, remissions, reports and audit rows.
- **Cost:** adding a cause means FK instead of CHECK, `Causa` loosened to string, an async `isCausa`, DB-backed labels and phrases, and flags for rest and special format. This is the largest part of the change.

### File size

- **Client:** `documents-step.tsx:53` pre-check and :230 hint; `special-format-upload.tsx:38` pre-check and :116 hint. Both import the constant, so a DB value must arrive as a prop from the server page.
- **Upload tokens:** `maximumSizeInBytes` at `src/app/api/intake/upload-token/route.ts:84` and `src/app/api/review/special-format-token/route.ts:72`. The token is built per request, so a change applies to new tokens immediately.
- **Server:** `documentos.ts:318` (`fingerprintStoredFile`) and :341 (`refusalFor`); `inspectStoredFile` and `fingerprintStoredFile` need a `maxBytes` argument; `special-format.ts:156` uses the same inspection.
- **Database:** `CK_Documento_Tamano` (`schema.ts:454`) bakes in 10 MiB. Lowering needs no migration; raising requires dropping or relaxing the CHECK (for example to a hard technical ceiling).
- **Copy:** "10 MB" appears in `intake.errors.too_large` (es/en.json:955, :1785); the hints at :917 and :1775 already take `{size}`. Error keys carry no parameters, so the copy must be reworded or the error shape extended. Tests pin the current strings in `documents-step.test.tsx`, `cause-dates-step.test.tsx`, `review-step.test.tsx` and `special-format-upload.test.tsx`.

### Platform facts (Next 16.3.4, from `node_modules/next/dist/docs`)

- `cacheComponents` is off in `next.config.ts`, so `use cache` is unavailable.
- `unstable_cache` is documented as replaced by `use cache` in 16 and needs mocking in vitest.
- `revalidateTag(tag, profile)` takes two arguments (the one-argument form is deprecated); `updateTag` works only inside Server Actions.
- The pages and routes involved read cookies or the database, so they are dynamic anyway.

### Audit, permissions and write pattern

- `EventoAuditoria` (`drizzle/0004_audit_log.sql`) has no CHECK on `Accion` or `EntidadTipo`, and `EntidadId` is nullable except for `Usuario`: new audit actions need no migration, only edits to `AUDIT_ACTIONS`, `AuditEntityType` and the `AuditEvent` union in `src/lib/audit/types.ts`, plus builders in `events.ts`.
- `withCatalogWrite` (`src/lib/data/catalog-write.ts:88`) provides lock, transaction and audit row; the docente actions show the full shape (guard, Zod, write, `revalidatePath`).
- Role predicates live in `src/lib/auth/permissions.ts`. The administrador provisions only `coordinacion` and has read-only catalog access. `/settings` is a frozen, dead nav entry.
- Production has 2 active administrador accounts (read-only count by the orchestrator, 2026-11-27).

## Affected Areas

- `src/db/schema.ts` and a new `drizzle/0017_*` migration (new tables and seeds; later the `CK_Documento_Tamano` and cause CHECK changes).
- A new `src/lib/parameters/*` module (registry, loader, write function) and a new `/parameters` page and actions under `(dashboard)`.
- Pure rules gaining explicit parameters: `intake/business-days.ts`, `intake/dates.ts`, `intake/submission.ts`, `validations/solicitud.ts`, `signals/timing.ts`, `signals/params.ts`, `signals/document-type-causes.ts`.
- Data and routes: `data/signals.ts`, `data/revision-queue.ts`, `data/documentos.ts`, `data/special-format.ts`, both upload-token routes, review and coordination pages and actions.
- Client components `documents-step.tsx` and `special-format-upload.tsx` (props instead of imported constants).
- `src/lib/audit/{types,events}.ts`, `permissions.ts`, `navigation.ts`, `i18n/{es,en}.json`.
- Docs: `docs/roadmap.md` row 8 and the RNF-14 status note.

## Approaches

### Store design

1. **One typed table per family.** Database-enforced ranges; a migration per new parameter and a screen per family. Effort: High.
2. **Generic validated key-value or JSON table.** One table, one screen, one audit shape; validation only in the app, and relational data (calendar, map) fits poorly. Effort: Low to Medium.
3. **Hybrid (recommended).** `ParametroNormativo(Clave PK, Valor integer, Version, ActualizadoEn, ActualizadoPorId)` with an app registry holding each key's Zod range and default (remission business days, alert business days, RN-07 business days, RN-23 window days, recurrence threshold, max size in MiB); `DiaNoHabil(Fecha date PK, Descripcion, CreadoEn, CreadoPorId)`; `TipoDocumentoCausa(Tipo, Causa)` with a composite PK; a cause catalog table last. Typed enough, relational where the data is relational, one audit pattern. Effort: Medium.

### Caching across serverless instances

- **No cross-request cache (recommended):** read per request, with React `cache()` for deduplication inside a render. The tables are tiny; consistency is immediate on every instance; tests need no Next cache mocks.
- **`unstable_cache` plus `updateTag`/`revalidateTag`:** saves a few queries but `revalidateTag(…, "max")` serves stale data once and `updateTag` works only in Server Actions; adds mocking cost and stale-read risk. Keep only as a later seam.

### Fallback when the read fails

Per key, fall back to the code default and log the error name only. Defaults are the Reglamento baseline values. An out-of-range DB value also falls back for that key. Fail-soft on every path.

### Audit

One row per change, `{clave, antes, despues}` for scalars and a similar shape for dates, map cells and causes. Proposed actions: `parametro.actualizado`, `dia_no_habil.agregado`/`.eliminado`, `tipo_documento_causa.actualizado`, `causa.*`. Entity type `Parametro`, null `EntidadId`, key in `Datos`. Writes only. An optimistic `Version` check prevents lost updates.

### Admin screen

A single `/parameters` page in the Administración group with four sections (deadlines and limits, calendar, type-to-cause map, causes), following `docs/design-system.md`. Every action re-checks the role (RNF-01) and confirms before applying (RNF-12).

### Effect on in-flight requests

- **Next read:** RN-08 deadline and alert, RN-07, RN-13, RN-14, the calendar (computed on read).
- **Prospective:** RN-23 (checked at step save and submission, never on corrections); file size (stored documents kept; an issued upload token keeps its old limit until it expires).
- **Not recomputed:** the stored `PlazoInicioEn`.
- **Causes:** a deactivated cause is hidden from new selection but renders everywhere for existing data; a draft carrying it is rejected at the next save or submit.

### How the change is proven without a deploy

- **Integration test** on a disposable Neon branch: write each family through the data function, then call the consumer in the same process (`loadSignals`, `listReviewQueue`, `validateSubmission`, the token route, eligibility). Nothing is re-imported or restarted.
- **Owner walkthrough:** threshold 3 to 2 flips RN-14; adding tomorrow to the calendar moves the queue deadline; remission days 2 to 3 moves the deadline; window 30 to 10 rejects an older end date; max size 10 to 1 MB refuses a 2 MB file; toggling a map cell flips RN-13; a deactivated cause leaves the form.
- **Structural test:** the old constants survive only as `DEFAULT_*` values used by the loader.

## Recommendation

Hybrid store, no cross-request cache, per-key fallback, edited by the administrador role.

### Slices (rough, including tests)

| Slice | Content | Lines |
|---|---|---|
| S1 store | Additive migration 0017 (all new tables and seeds, so the owner is asked once), schema, registry, `getNormativeParams()` loader, defaults fallback, unit and integration read tests; no consumer change | ~700 |
| S2a deadlines | Thread remission days, alert days, RN-07 days, the RN-23 window and the threshold into `business-days.ts`, `timing.ts`, `dates.ts`, `submission.ts`, `validations/solicitud.ts`, `loadSignals`; reword copy | ~600 |
| S2b size | Max size into both token routes, `documentos.ts`, `special-format.ts` and the two client props; contract migration relaxing `CK_Documento_Tamano` | ~600 |
| S3 scalar screen | `canManageParameters`, audit events, write with version check, `/parameters` page for the scalars, i18n, tests | ~900 |
| S4 calendar | `DiaNoHabil` loader through `constantCalendar`, replace the 4 call sites, add/remove screen, coverage notice instead of the staleness test | ~900 |
| S5 map | `TipoDocumentoCausa` loader and a 3×5 matrix section | ~600 |
| S6 causes | Catalog table, FKs instead of CHECKs, `Causa` as string, async `isCausa`, DB labels and phrases, flags, screen; likely two slices | ~1,500 |

Total roughly 5.5k to 6.5k lines; a cut is needed for the 2026-12-01 deadline. Scope-cut ladder: S1 to S5 plus a minimal S6 (deactivate and reorder the five existing causes; labels stay in i18n; no new-cause creation). Full "add a cause" becomes documented future work.

### Overlap with the teammate

| Teammate work | Our file | Mitigation |
|---|---|---|
| Coordination report (`src/lib/reports/*`) | `src/lib/signals/params.ts` | Keep `DEFAULT_SIGNAL_PARAMS`, `SignalParams` and the `issuer.ts` exports unchanged; after both merge, switch the report to the loader and add a consistency test |
| `/register` audit | `src/lib/audit/{types,events}.ts` | Append our actions at the end of `AUDIT_ACTIONS` and the union; rebase before each slice |
| Remission, theme, scripts | none | No overlap expected |
| Shared files | `i18n/{es,en}.json`, `src/lib/navigation.ts`, `src/db/schema.ts` | One new i18n namespace, one nav entry, check whether the teammate adds a migration |

### Test strategy

Strict TDD with vitest: pure unit tests for registry ranges, deadline math with parameters, RN-23 and the `loadSignals` threshold; migration content tests (`migration-*.test.ts` pattern); integration tests on a disposable Neon branch guarded by `src/lib/data/integration/guard.ts` (write, read, audit, version conflict); component tests for the form and the props; i18n parity updates.

## Risks

- Schedule: four days against the estimate.
- Production: each migration needs the owner's per-command yes; merging before the migration keeps reads working (defaults) but writes would fail.
- Sync to async ripple: `isCausa`, the Zod schema factory and `validateSubmission` are sync; load once at the action boundary and pass plain data.
- Contract migration: swapping cause CHECKs for FKs and relaxing the size CHECK on live tables need care; all existing rows use the five seeded codes.
- Concurrency and in-flight uploads: the version check; an in-flight upload may be accepted by the blob store and refused by finalize after the limit is lowered.
- Misconfiguration: ranges validated; loops bounded by rows.

## Open product decisions

- **D1. What "change the causes" means:** (a) activate, deactivate and reorder the five; (b) also edit labels; (c) add new causes with rest and special-format flags. Recommendation: (a), (c) only if time allows. Also whether type `otro` stays locked to no causes in RN-13.
- **D2. Who edits:** administrador, secretaria or coordinacion. Recommendation: administrador (the role that decides requests should not change the rules it is judged by, RN-15); optionally the secretaria for the calendar.
- **D3. RN-07 and RN-08:** two keys, both default 2.
- **D4. The "1 business day left" alert:** configurable.
- **D5. Effect on open requests:** computed-on-read values apply immediately; filing-time rules are prospective; no per-request snapshot.
- **D6. File size range:** only lowering (no migration) or 1 to 25 MiB with a ceiling and the contract migration. Recommendation: the latter.
- **D7. Retention (5 years):** out of RNF-14.
- **D8. Delivery scope:** which of S4 to S6 may be cut, and whether RNF-14 can be declared met with the minimal causes slice; row 8 owner.
