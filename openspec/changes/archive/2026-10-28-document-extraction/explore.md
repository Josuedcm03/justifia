# Exploration: document-extraction

Roadmap #4. Covers RF-11 and RNF-03 (criterion clarified 2026-10-22).
Closed decisions: `docs/investigacion/ocr-document-extraction.md` section 11
and `docs/investigacion/spike-ocr-resultados.md`.

## Current state

- **Producers.** `submitRequestAction` (`requests/new/actions.ts`) calls
  `submitDraft`; `resubmitCorrectionAction` (`requests/[id]/correct/actions.ts`)
  calls `resubmitCorrection`. Both are single transactions with heavily mocked
  unit tests. The RF-11 hook is only a comment in `solicitud-correction.ts`.
- **`after()` precedent.** `scheduleDispatch` (`review/[id]/actions.ts`,
  `remission-actions.ts`) wraps `after()` in try/catch before `redirect()`;
  tests mock `next/server`'s `after`. teacher-remission design N2: `after`
  runs within the route's `maxDuration`.
- **Claim/lease precedent.** `Remision` has `ReclamoId` + `ReclamadaEn`;
  `claimRemission` is a guarded `UPDATE … RETURNING`, completion guarded by
  `heldBy(claim)`, `selectRetryCandidates` uses a lease cutoff, and
  `not_configured` hands the attempt back.
- **Hexagonal slice.** `src/lib/intake/` (`ports.ts` with
  `DocumentStore.stream`, `deps.ts`, `fakes.ts`). Env vars are optional in
  `src/env.ts` and asserted at use.
- **Cron.** `runIntakeSweep(now, store)` has 3 steps, never throws, returns
  `SweepCounts`. `vercel.json`: region `cle1`, two daily crons, pinned by
  `vercel-config.test.ts`.
- **Documents.** `DocumentoRespaldo` has `estado` (`pendiente`/`valido`),
  `tipoDetectado`, `retiradoEn`, `subidoPorId`, `formatoEspecial`.
  Staff-uploaded special formats share the table.
- **Staff detail.** `review/[id]/page.tsx` renders `Section` cards from
  `request-sections.tsx`. `DetailDocument` (from `getRequestDetail`) is shared
  with the student view.
- **Migrations.** Latest is `drizzle/0010_request_consent.sql`; this change
  generates `0011` (never applied without explicit user confirmation).
- **Dependencies.** `sharp` is only an optional transitive dependency of
  `next`; `unpdf` and `@napi-rs/canvas` are absent. Next auto-externalizes
  `sharp`, not `@napi-rs/canvas`.

## Affected areas

New:

- `src/lib/extraction/`: `states.ts`, `template.ts`, `validate.ts`,
  `limits.ts`, `ports.ts` (`DocumentPreparer`, `FieldExtractor`,
  `ExtractionQueue`), `run.ts`, `deps.ts`, `fakes.ts`, adapters
  (`sharp-unpdf-preparer.ts`, `nuextract-http-extractor.ts`, `after-queue.ts`).
- `src/lib/data/extraction.ts`: register, claim, complete, fail, list, stale
  selection.
- `ExtraccionDocumento` in `src/db/schema.ts` + `drizzle/0011_*`.
- Staff-only `ExtractionSection` + i18n keys (es, en).
- Tests: RNF-03 fetch interception, `maxDuration` pins.

Modified:

- Both actions: `scheduleExtraction` wrapper mirroring `scheduleDispatch`.
- `intake-sweep.ts`: step 4 (re-enqueue), `SweepCounts` gains `reenqueued`.
- `review/[id]/page.tsx`: loads extractions, renders the section.
- `src/env.ts`: optional `EXTRACTION_API_URL`, `EXTRACTION_API_KEY`.
- `package.json`: `sharp`, `unpdf`, `@napi-rs/canvas`.
- `next.config.ts`: `serverExternalPackages: ["@napi-rs/canvas"]`.
- `export const maxDuration = 300` on `requests/new/page.tsx`,
  `requests/[id]/correct/page.tsx` and the cron route, with pin tests.

## Approaches: where rows are created and enqueued

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. Insert `pendiente` rows inside the submit/correction transaction | Atomic | Submission depends on the new table; reopens hot transactions | Medium |
| **B. Post-commit `registerPendingExtractions` inside `after()`; cron anti-join as backstop (recommended)** | Submission path and tests untouched; idempotent `ON CONFLICT DO NOTHING`; handles retired → `no_aplica` | Crash between commit and `after()` waits for the daily cron | Low–Medium |
| C. Fan-out HTTP to an internal route per document | Strict one invocation per document | Needs auth/origin handling; breaks on preview protection | High |

## Recommendation

1. The action calls `ExtractionQueue.enqueue(solicitudId)`; the adapter is one
   `after()` with try/catch.
2. The callback registers rows idempotently for documents that are `valido`,
   not retired, student-uploaded (`subidoPorId IS NULL`,
   `formatoEspecial = false`) and without a row; retired documents get
   `no_aplica`.
3. Documents are processed sequentially, one `runDocumentExtraction(id)` per
   document, under a wall-clock deadline; leftovers stay `pendiente`.
4. Cron step 4 selects `pendiente` rows, expired `procesando` leases and the
   anti-join, scoped to requests in `pendiente` and bounded per batch.

**Gap in the closed design:** `procesando` needs a lease. Reuse the `Remision`
pattern (`ReclamoId`, `ReclamadaEn`, `heldBy`), so a killed function does not
leave a row stuck forever.

**Table shape** (PascalCase): `DocumentoId` (PK/FK, cascade), `Estado`,
`Intentos`, `ErrorCodigo` (closed set), `ReclamoId`, `ReclamadaEn`,
`NombreEstudiante`, `Emisor`, `FechaEmision`, `ReposoDesde`, `ReposoHasta`,
`ReposoDias`, `Motor`, `ProcesadoEn`. Drop `Confianza` (NuExtract3 returns
none) and `NombreCoincide` (belongs to validation-signals). Never store raw
text.

## Open questions

1. **Text-layer PDFs:** send the unpdf text to NuExtract3 (same template,
   adapter and validation) and require returned strings/dates to appear in the
   text. Use the text path only if every page has a text layer above a minimum
   density; otherwise render pages (cap ~5) to images, which covers mixed PDFs
   like the spike's request with a scanned prescription. Text mode was not
   tested in the spike: first apply task measures it on 2–3 PDFs (fallback:
   rules).
2. **Auth:** static bearer secret in `EXTRACTION_API_KEY`, URL in
   `EXTRACTION_API_URL`; header sent only when a key is set; HTTPS required
   for non-loopback hosts (RNF-02); timeouts and cold-start retries. Provider
   specifics (RunPod/Modal edge auth vs `llama-server --api-key`) are decided
   at deploy time.
3. **maxDuration:** Hobby with Fluid compute allows 300 s; `after()` shares
   the invocation budget; Server Action duration is set at page level. Confirm
   Fluid compute is on and that Hobby's non-commercial terms are acceptable.
4. **Staff UI:** separate staff-only "Extracted data" section after
   `DocumentsSection`, loaded by a fail-soft `listExtractions(solicitudId)`
   returning `{ data, degraded }`; `DetailDocument` is not extended. Null
   values show a muted "no reconocido" (RF-11 b). Non-completed documents show
   an extracting or unavailable state, no polling. The extracted name never
   replaces the snapshot name (RN-02).
5. **Bundling:** `sharp` and `unpdf` as direct dependencies; `@napi-rs/canvas`
   in `serverExternalPackages`, imported lazily on the scanned-PDF path so a
   packaging failure becomes an error code. Prove on a Vercel preview. Tests
   importing sharp/unpdf need `// @vitest-environment node`.

**Validation (`validate.ts`):** accept a rest period only with explicit dates
or duration; discard a lone `rest_from` equal to the issue date; compute days
in code (inclusive); optional plausibility window for years (decide in specs).

**RNF-03 test:** stub `globalThis.fetch`, run 10 extractions through the real
HTTP adapter, assert every outbound host equals the `EXTRACTION_API_URL` host;
static guard against third-party OCR/inference SDK imports.

## Risks

- **Review budget:** ~2,000–2,500 lines with tests vs 800 and `single-pr`.
  Suggested slices: (1) schema, domain, use case, fakes, data layer;
  (2) adapters, deps, env, RNF-03 test, config; (3) producers, sweep step, UI.
- **Migration ordering:** `0011` applied only with explicit confirmation,
  before the code deploys; approach B and the fail-soft list contain lag.
- **Daily cron on Hobby:** a failed document may wait 24 h.
- **GPU cold start vs `maxDuration`:** fetch timeout below remaining budget.
- **Model failure modes:** mitigated only by validation and RN-24.
- **Backfill:** first run would extract all existing pending requests; scope
  and bound it.
- **Unproven:** `@napi-rs/canvas` packaging, NuExtract3 text mode.
- **Privacy:** never log extracted values or raw text (RNF-04).
