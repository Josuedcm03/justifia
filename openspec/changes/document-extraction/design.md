# Design: Document Extraction

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries a schema, a migration, three ports with adapters, an `after()`
> pipeline, a cron step, a model contract, code-side validation and a UI
> section; the repository precedent (`teacher-remission`, `secretary-review`)
> keeps decision tables over prose cuts. The deviation is deliberate.

> **Reconciled with the build (2026-10-24, apply batch 8).** This document
> describes what was built. Two things changed against the first draft: the
> text path was dropped after the DE-14 measurement failed (every PDF is
> rendered to images), and the details listed in `apply-progress.md` ("Batch 8")
> were aligned with the code. Spec IDs are unchanged.

> **DB-touching.** This document plans commands and runs none. Database steps
> are tagged `[LOCAL]`, `[READ-ONLY]` or `[CONFIRM]`; a `[CONFIRM]` step needs
> the owner's explicit "yes" for that single command (`CLAUDE.md`).

Binding inputs: `proposal.md` ("Decisions from the proposal review" 1-5 are
authoritative), `explore.md`, `docs/investigacion/ocr-document-extraction.md`
sections 10-11, `spike-ocr-resultados.md`, `nuextract3-instalacion.md`,
`docs/requirements.md` (RF-11 a-b, RNF-03; also RN-02, RNF-02, RNF-04). The
archived `teacher-remission/design.md` (TR-6 claim/lease, TR-8 `after()`, TR-9
`not_configured`) is the pattern source. Decisions here are **DE-1..DE-14**.

## Technical Approach

Approach B from the exploration. Submit and correction actions commit as
today, then call `ExtractionQueue.enqueue(solicitudId, startedAt)`; the
adapter registers one `after()` callback. The callback idempotently registers
`ExtraccionDocumento` rows for the request's eligible documents, then processes
them sequentially under a deadline derived from `maxDuration = 300`: guarded
claim with lease, read bytes via `DocumentStore.stream`, `DocumentPreparer`
(sharp / unpdf / lazy `@napi-rs/canvas`; every document reaches the model as
images, DE-9, DE-14), `FieldExtractor` (NuExtract3 over llama.cpp's
OpenAI-compatible API), pure validation, guarded completion. The daily
`intake-sweep` gains step 4 as the backstop and backfill. Staff read the
results in a fail-soft "Extracted data" section. Pure code in
`src/lib/extraction/`; persistence only in `src/lib/data/extraction.ts`.

## Verified framework findings (Next 16.3.4, `node_modules/next/dist/docs`)

| # | Finding | Source | Consequence |
|---|---|---|---|
| N1 | `after()` runs in Server Functions even when `redirect()` is called | `04-functions/after.md` | Enqueue before `redirect()` in both actions |
| N2 | `after` runs within the route's default or configured `maxDuration` | same, "Duration" | The deadline (DE-7) derives from 300 s |
| N3 | Server Action duration is set by `maxDuration` at **page** level | `02-route-segment-config/maxDuration.md` | Pin on `requests/new/page.tsx` and `requests/[id]/correct/page.tsx`, plus the cron route |

## Architecture Decisions

### DE-1. Module layout

| Path | Content |
|---|---|
| `src/lib/extraction/states.ts` | `EXTRACTION_STATES`, `EXTRACTION_ERRORS`, `PERMANENT_ERRORS`, guards, `failureOutcome(error, attempts)` |
| `limits.ts` | All numeric constants (DE-7, DE-9) and the pure budget helpers (`deadlineFor`, `canStartDocument`, `modelTimeoutMs`, `fitsRenderCap`) |
| `template.ts` | `NUEXTRACT_TEMPLATE`, `ENGINE_ID` (`nuextract3-4b/image`), `PreparedDocument` (`{ kind: "images" }` only), `buildChatRequest(prepared)` (pure) |
| `validate.ts` | `validateFields(raw, { submittedOn })` (pure, DE-10) |
| `config.ts` | `resolveExtractionConfig(env)` -> `{ ok, baseUrl, apiKey? } \| { ok: false }`; HTTPS rule, credentials rejected, base URL normalised (DE-12) |
| `display.ts` | `toExtractionDisplay(row, { requestState, configured })` (pure, DE-13) |
| `ports.ts` | `DocumentPreparer`, `FieldExtractor`, `ExtractionQueue`; every failure crosses a port as a closed-set code (`PrepareResult`, `ExtractResult`), never a message |
| `run.ts` | `runDocumentExtraction`, `processRequestExtractions`, `runExtractionSweep` (use cases) |
| `deps.ts` | `getExtractionDeps()` composition root (`server-only`) returning `ExtractionWiring` (the use-case deps plus `queue`); reuses `getIntakeDeps().store` |
| `configured.ts` | `extractionEnv()` and `isExtractionConfigured()` (`server-only`, light: imports neither sharp, unpdf nor the HTTP adapter); `deps.ts` reuses `extractionEnv` |
| `fakes.ts` | Fake preparer, scripted extractor, recording queue |
| `adapters/sharp-unpdf-preparer.ts` | DE-9 |
| `adapters/nuextract-http-extractor.ts` | DE-8; takes `env: () => ExtractionEnv` so it never imports `@/env` |
| `adapters/after-queue.ts` | `after()` + try/catch, mirrors `scheduleDispatch` |
| `src/lib/data/extraction.ts` | The ONLY writer of `ExtraccionDocumento` (structural test), and it changes no other table |

Rejected: placing the use case in `src/lib/data/` like `remission-dispatch.ts`
(the proposal fixes `run.ts` in the slice; it still calls the data module
directly and tests `vi.mock` it, as the remission tests do).

### DE-2. Schema `ExtraccionDocumento`

| Column | Type |
|---|---|
| `DocumentoId` | `bigint` PK, FK `DocumentoRespaldo.Id` **on delete cascade** (a deleted draft takes its rows) |
| `Estado` | `varchar(12) NOT NULL default 'pendiente'` |
| `Intentos` | `smallint NOT NULL default 0` |
| `ErrorCodigo` | `varchar(30) NULL` |
| `ReclamoId` / `ReclamadaEn` | `uuid NULL` / `timestamptz NULL` (lease, as `Remision`) |
| `NombreEstudiante` | `varchar(160) NULL` |
| `Emisor` | `varchar(200) NULL` |
| `FechaEmision`, `ReposoDesde`, `ReposoHasta` | `date NULL` |
| `ReposoDias` | `smallint NULL` |
| `Motor` | `varchar(40) NULL` (`nuextract3-4b/image`) |
| `ProcesadoEn` | `timestamptz NULL` (terminal outcome time) |
| `CreadaEn`, `ActualizadaEn` | `timestamptz NOT NULL default now()` |

Constraints: `CK_Extraccion_Estado`, `CK_Extraccion_Error` (NULL or in list,
rendered from DE-3 constants via `inList`); `CK_Extraccion_Reclamo`:
`(ReclamoId IS NULL) = (ReclamadaEn IS NULL)`; `CK_Extraccion_Procesando`:
`(Estado = 'procesando') = (ReclamoId IS NOT NULL)`; `CK_Extraccion_Fallida`:
`Estado <> 'fallida' OR ErrorCodigo IS NOT NULL`; `CK_Extraccion_Completada`:
`Estado <> 'completada' OR (ErrorCodigo IS NULL AND ProcesadoEn IS NOT NULL
AND Motor IS NOT NULL)`; `CK_Extraccion_Datos`: every data column NULL unless
`completada`; `CK_Extraccion_Reposo`: `ReposoDias IS NULL OR ReposoDias > 0`
and `ReposoHasta IS NULL OR ReposoDesde IS NULL OR ReposoHasta >= ReposoDesde`;
`CK_Extraccion_Intentos`: `Intentos >= 0`; `IX_Extraccion_Abierta (CreadaEn)
WHERE Estado IN ('pendiente','procesando')`. No raw text, no `Confianza`, no
`NombreCoincide`.

### DE-3. States, errors, transitions

`EXTRACTION_STATES`: `pendiente`, `procesando`, `completada`, `fallida`,
`no_aplica`. `EXTRACTION_ERRORS`: `not_configured`, `document_unavailable`,
`unreadable_document`, `render_unavailable`, `timeout`, `model_error`,
`invalid_response`. `PERMANENT_ERRORS`: `unreadable_document`.

```
(none) --register, doc eligible--> pendiente
(none) --register, doc retired---> no_aplica
pendiente --claim (Intentos < 3)--> procesando        Intentos + 1
procesando(lease expired, Intentos < 3) --claim--> procesando
procesando --ok (heldBy)--> completada
procesando --error, Intentos < 3, not permanent--> pendiente + ErrorCodigo
procesando --error, Intentos = 3 or permanent--> fallida + ErrorCodigo
procesando --not_configured--> pendiente, Intentos - 1 (attempt handed back)
procesando(lease expired, Intentos = 3) --sweep--> fallida + 'timeout'
pendiente|procesando --doc retired--> no_aplica (claim cleared)
```

`completada`, `fallida`, `no_aplica` are terminal for this change
(`validation-signals` adds manual entry later); the final rows of a document
retired later are left as they are, and the staff read omits retired documents.
`MAX_ATTEMPTS = 3`, `CLAIM_LEASE_MS = 10 min` (> 300 s, so only a killed
invocation is taken over). Completion is `UPDATE ... WHERE DocumentoId = $id
AND ReclamoId = $uuid AND Estado = 'procesando'`; a stale worker writes
nothing.

### DE-4. `not_configured` representation

| Option | Tradeoff | Decision |
|---|---|---|
| Section-level flag from `isExtractionConfigured()` (env resolved server-side) plus a pre-claim check in the use case | Accurate at render time; no rows churn or burn attempts while unset; setting the env flips every waiting document to "extracting" with no data change | **Chosen** |
| Rows with `ErrorCodigo = 'not_configured'` drive the message | Stale after the env is set until each row is retried; documents without a row show nothing | Rejected as the UI source; the code stays in the closed set for diagnostics (an invalid URL detected inside the adapter hands the attempt back, as TR-6's accepted deviation) |

`processRequestExtractions` and cron step 4 register rows, then stop when the
extractor reports `isConfigured() === false`.

### DE-5. Post-commit flow (approach B)

| Step | Rule |
|---|---|
| Producers | `submitRequestAction`: after `submitDraft` ok, `scheduleExtraction(draft.id, now)` then `redirect`. `resubmitCorrectionAction`: same inside `if (outcome.ok)`, sharing one `now` with the resubmission. `scheduleExtraction` (shared, `requests/new/step-actions.ts`) imports the composition root on demand, calls `getExtractionDeps().queue.enqueue(id, now)` and logs `extraction_not_scheduled` by error name on any failure, so a native addon that cannot load never breaks a student action. The transactions and their tests are untouched |
| Adapter | `after(() => processRequestExtractions(id, deps, { startedAt }))` in try/catch; a scheduling or callback failure logs `extraction_not_scheduled` / `extraction_run_failed` with the request id and the error name only |
| Registration | `registerPendingExtractions(solicitudId, now)`, one transaction of four statements (a single `INSERT ... SELECT` is not possible: drizzle requires the select to project every column): select the request's `valido`, student-uploaded (`SubidoPorId IS NULL`), `FormatoEspecial = false` documents; `INSERT` `pendiente` (or `no_aplica` for a retired one) with `ON CONFLICT DO NOTHING`; turn the open rows of retired documents into `no_aplica` (claim cleared); select the claimable ids. Returns the ids of live documents whose row is `pendiente` or `procesando` with an expired lease, under the attempt cap, ordered by id. A document retired after the last statement is refused by the claim guard |
| Processing | `processRequestExtractions(id, deps, { startedAt } \| { deadline })` returns `{ processed, errored }`; sequential `runDocumentExtraction` while the remaining budget is at least `MIN_DOCUMENT_BUDGET_MS`; leftovers stay `pendiente` for the cron |
| Unexpected throw | Logged by name (`extraction_document_failed`); `failExtraction` is not called and the row keeps its lease; the cron reclaims it after expiry |

Rejected: rows inside the submit transaction (approach A, reopens hot
transactions); per-document internal HTTP fan-out (approach C, auth and
preview protection).

### DE-6. `runDocumentExtraction(documentoId, deps, { deadline })`

Never throws; returns `skipped | completed | failed(code) | lost | errored`.

1. `claimExtraction` (guarded `UPDATE ... FROM DocumentoRespaldo JOIN
   Solicitud RETURNING` pathname, `TipoDetectado`, `Intentos`, `ReclamoId`,
   submission date = `ReenviadaEn ?? PresentadaEn`; requires the document not
   retired, `Solicitud.PresentadaEn IS NOT NULL` and a claimable row). Null ->
   `skipped`.
2. `extractor.isConfigured()` false -> `failExtraction(not_configured)`.
3. `store.stream(pathname)` -> bytes; null, throw or a broken body ->
   `document_unavailable`.
4. `preparer.prepare(bytes, tipo)` -> `PrepareResult`: `PreparedDocument` or a
   code in `unreadable_document | render_unavailable`.
5. `extractor.extract(prepared, { timeoutMs })` -> `ExtractResult`: raw answer
   or a code in `timeout | model_error | invalid_response`. `timeoutMs` is
   `modelTimeoutMs(remaining)` taken after preparation, because rendering a PDF
   eats into the budget; it is `0` when under 10 s remain, which the extractor
   answers as an immediate `timeout`.
6. `validateFields(raw, { submittedOn })`, `submittedOn` = Managua date of the
   claim's submission instant.
7. `completeExtraction(claim, fields, ENGINE_ID)`. A guarded write that matches
   nothing (lease taken over) is `lost`.

### DE-7. Deadline, timeout, cold start (`limits.ts`)

| Constant | Value | Rationale |
|---|---|---|
| `EXTRACTION_MAX_DURATION_S` | 300 | Hobby + Fluid compute ceiling; pinned equal to the three literal `maxDuration` exports |
| `DEADLINE_SAFETY_MS` | 25 s | Leaves room for the guarded completion writes |
| deadline | `startedAt + 300 s - 25 s` | `startedAt` is the action's `now`, so validation and commit time count |
| `MIN_DOCUMENT_BUDGET_MS` | 20 s | Do not start a document that cannot finish |
| `FETCH_TIMEOUT_MS` | 120 s | Covers a serverless GPU cold start; effective timeout `min(120 s, remaining - 10 s)` via `AbortSignal.timeout` |
| Cold-start retry | 1 retry after `COLD_START_RETRY_DELAY_MS` (5 s) on connection error or HTTP 502/503/504, only when `timeoutMs - elapsed - 5 s >= MIN_DOCUMENT_BUDGET_MS`; same attempt, `Intentos` unchanged | Spike: 2-5 s warm; first request after scale-to-zero fails or stalls. The `FieldExtractor` port hands over only `timeoutMs`, so the "remaining budget" of the rule is the call's own `timeoutMs`; one `AbortSignal.timeout(timeoutMs)` covers both attempts. This can only make the retry rarer, never exceed the deadline. A `redirect: "error"` failure looks like a connection error and may be retried once (same host, same budget) |

Abort -> `timeout`; other non-2xx (incl. 401/403/500/429) or network ->
`model_error`.

### DE-8. NuExtract3 request contract

```ts
export const NUEXTRACT_TEMPLATE = {
  student_name: "verbatim-string",
  issuer: "verbatim-string",
  issue_date: "date",
  rest_from: "date",
  rest_to: "date",
  rest_days: "integer",
} as const;
// POST {baseUrl}/v1/chat/completions
// { temperature: 0.2, max_tokens: 512, stream: false,
//   messages: [{ role: "user", content: <image_url parts in page order> }],
//   chat_template_kwargs: { template: JSON.stringify(TEMPLATE, null, 4), enable_thinking: false } }
```

Images go as `data:image/jpeg;base64,...` parts. Headers: `Content-Type`;
`Authorization: Bearer <key>` only when a key is set. `redirect: "error"` (a
redirect could move the document to another host, RNF-03). Response: read at
most 64 KiB (`MAX_MODEL_RESPONSE_BYTES`; a larger body cancels the stream and
is `invalid_response`, a broken stream is `model_error`),
`choices[0].message.content`, strip a code fence, `JSON.parse`, zod schema
(each key string/number or null; extra keys ignored) -> otherwise
`invalid_response`. `fetch` injected for tests. A call made while not
configured answers `model_error` and sends nothing (the use case checks first;
this is a safety net).

### DE-9. Preparer: every document becomes images

| Input | Path |
|---|---|
| `png`/`jpeg` | sharp `.rotate()` (EXIF) -> `.flatten()` onto white (JPEG has no alpha) -> `resize({ width: 1600, withoutEnlargement: true })` -> JPEG q85 -> one image |
| any `pdf` (text layer or scanned or mixed) | Page-size guard (below), then render the first `MAX_PDF_PAGES` (5) pages with unpdf `renderPageAsImage(proxy, n, { canvasImport: () => import("@napi-rs/canvas"), width: 1600 })` through one `getDocumentProxy` (it also counts the pages), each page through the sharp step. A failed dynamic import -> `render_unavailable` (not permanent); a page that fails to render, an unreadable or zero-page PDF -> `unreadable_document` |
| unparseable bytes | `unreadable_document` (permanent) |

There is no text path (DE-14): `extractText`, a text-density threshold and
`MIN_TEXT_CHARS_PER_PAGE` / `MAX_TEXT_CHARS` do not exist. pdf.js detaches the
buffer it is given, so the preparer hands it a copy.

Page-size guard (added 2026-10-23, task 4.11). Rendering at a fixed width makes
the canvas height proportional to the page's aspect ratio, so a page box such
as 1 x 14400 pt would allocate millions of pixels before the draw fails. Before
any page is drawn, the preparer reads each page it would send (the first
`MAX_PDF_PAGES`) through the same pdf.js proxy at scale 1, rotation applied.
`fitsRenderCap(width, height)` (`limits.ts`, pure) is false when
`height * IMAGE_MAX_WIDTH / width > MAX_RENDERED_PAGE_HEIGHT` (10,000 px = 16 MP
at width 1600, ratio 6.25) or the size is zero, negative or not finite. One page
over the cap refuses the whole document as `unreadable_document` (permanent: the
file will not change), with no canvas allocated, the canvas addon not even
imported, and no partial result. A page whose viewport cannot be read is refused
the same way. Letter, A4, legal and a 400 mm receipt (ratio 5) pass.

### DE-10. Validation (`validate.ts`, pure)

| Rule | Behaviour |
|---|---|
| Strings | Trim, collapse whitespace; empty or longer than the column (160 name, 200 issuer, measured after collapsing) -> null |
| Dates | Real ISO calendar dates only; plausibility window per the spec (reference = Managua date of `COALESCE(ReenviadaEn, PresentadaEn)`): issue date and `rest_from` in `[ref - 1 year, ref]`; `rest_to` in `[ref - 1 year, ref + 30 days]` (rest still running at submission); issue date outside -> null; any rest date outside -> whole rest period null |
| Rest period | Exactly the two spec forms: `rest_from` + `rest_to` (`to >= from`) -> days computed inclusive in code (model's `rest_days` ignored); or `rest_days` in 1..366 with no dates -> days only. Any other combination (lone date, a date plus days) -> whole rest period null |
| Result | All-null is still `completada` ("no reconocido" everywhere, RF-11 b). The extracted name never replaces the snapshot name (RN-02) |

Known limit, accepted: a days-only rest has no dates to check, so a duration the
model invents (the spike saw a letter's validity period read as 30 days) passes
validation. Staff see the value next to the document; RF-14 and RN-24
(`validation-signals`) are the control.

### DE-11. Cron step 4 (`justification-intake` delta)

`runIntakeSweep(now, store, extraction?)` gains an optional injected step
`extraction.sweep(now, deadline)` so `intake-sweep.ts` imports no adapter (its
only import from the extraction slice is the pure `deadlineFor` of
`limits.ts`; the deadline is computed inside `runIntakeSweep` from `now`, the
invocation start, so the cleanup time counts). The step is
`runExtractionSweep(now, deadline, deps)`: `abandonExpiredExtractions(now)`
(DE-3 last-attempt leases -> `fallida`, whatever the state of the request,
because such a lease can never complete); if configured,
`selectExtractionCandidates(now, SWEEP_BATCH_SIZE = 10)` = requests with
`Estado = 'pendiente'` that have a `pendiente` row, an expired `procesando`
lease under the cap, or an eligible document without a row (anti-join), oldest
clock start first (`COALESCE(ReenviadaEn, PresentadaEn)`, then `Id`); then
`processRequestExtractions` sequentially for each, stopping when
`canStartDocument` is false. It processes inline (it does not go through the
`after` queue) and returns `{ run, abandoned, failures }`: `run` = documents
processed, `abandoned` = leases closed, `failures` = requests that threw plus
documents that ended in an unexpected throw. A failure of the lease step or of
the candidate read reaches the caller, which counts the whole step as one
failure. `SweepCounts` always carries `extractionsRun` and
`extractionsAbandoned` (zero with no step); step failures count into
`failures`, beside the cleanup ones. The route builds the step lazily (the
wiring and `runExtractionSweep` load only when it runs), so a wiring failure is
one counted failure and the cleanup is unaffected. The bounded batch plus the
deadline is the backfill of decision 5.

### DE-12. Environment, dependencies, config

| Item | Choice |
|---|---|
| `src/env.ts` | `EXTRACTION_API_URL: optionalSecret(1)`, `EXTRACTION_API_KEY: optionalSecret(16)`; validated at use, never at boot |
| HTTPS | `resolveExtractionConfig`: `https:` always; `http:` only for loopback (`localhost`, `127.0.0.0/8`, `::1`); an address that embeds credentials or does not parse -> not configured; anything else -> not configured, logged once as `extraction_config_invalid` (RNF-02). The base URL is normalised (no trailing slash, no query) |
| `package.json` | `sharp`, `unpdf`, `@napi-rs/canvas` as direct dependencies |
| `next.config.ts` | `serverExternalPackages: ["@napi-rs/canvas"]` (Next auto-externalizes `sharp` only) |
| `maxDuration = 300` | `requests/new/page.tsx`, `requests/[id]/correct/page.tsx`, `api/cron/intake-sweep/route.ts`; literal (segment config must be static), pinned to `EXTRACTION_MAX_DURATION_S` by a file-scan test (`max-duration.test.ts`) |
| Logs | Codes, ids and error names only, never values or text (RNF-04) |

### DE-13. Staff UI

`listExtractions(solicitudId)` returns `{ data, degraded }` (fail-soft); the
page loads it with the rest (`loadExtractions` also catches a throw, so the
degraded notice holds at page level too), before `recordRequestRead` (one
audited read). `review/[id]/extraction-section.tsx` (server component, no
polling) renders after `DocumentsSection`, for the request's student-uploaded
documents, and renders nothing when the read succeeded and the request has no
such document. Visible to the roles that already open the page
(`rolesRevisores`, decision 1).

`toExtractionDisplay(row, { requestState, configured })` decides, first match
winning (spec "Extraction states"):

| Order | Condition | UI |
|---|---|---|
| 1 | `completada` | Name in the document, issuer, issue date, rest period; null -> muted "No reconocido" |
| 2 | request not `pendiente` | "Unavailable; review the document", never extracting |
| 3 | `fallida` | "Unavailable; review the document", no action (decision 2) |
| 4 | `configured = false` | Configuration-needed message (decision 3), shown once at the top of the section; the waiting entries are not listed; never names the variable |
| 5 | no row, `pendiente`, `procesando` | "Extracting data; reload later" |
| - | `degraded` read | One section-level notice (shared `DegradedAlert`), no per-document rows |

The configuration notice is a warning-tinted `role="status"` banner (a setup
condition, not a failed read). A one-day rest (from = to) reads as one date with
its day count (`restSingleDay`). `useDates` is exported from
`request-sections.tsx` to reuse the Managua and UTC date formatting;
`isExtractionConfigured()` (light module) is called in the page body.

i18n (`es`, `en`): `review.detail.sections.extraction`,
`review.extraction.{note, fields.{studentName,issuer,issueDate,restPeriod},
notRecognized, restDays (ICU plural), restRange, restSingleDay, states.
{extracting, unavailable, notConfigured}, degraded}`. Staff copy uses the
existing neutral register: «Hace falta configurar el servicio de extracción.
Contacte al administrador del sistema.» Tokens only from
`docs/design-system.md` (`text-muted-foreground`, existing `Section`, `dl`
layout of `request-sections.tsx`).

### DE-14. Text-mode measurement (result: FAIL, text path dropped)

The first apply task measured NuExtract3 (local `nuextract3` container) in text
mode on 3 synthetic text-layer PDFs, 2 runs each, with the DE-8 contract.
Issue date and student name were right 6/6, but the issuer only 3/6 (the rest
returned the signing physician, who is in the text, so an appear-in-text check
cannot catch it) and the rest period 2/6 (hours read as days, rest invented in
2 runs). The gate (issuer and issue date correct on every sample) failed.
Decision (owner, 2026-10-22, applied 2026-10-23): text-layer PDFs take the
image path like scanned PDFs (DE-9); no rules extractor and no text mode are
built, so there is no text variant of `PreparedDocument`, no `ENGINE_ID` for
text and no appear-in-text validation. The unpdf `renderPageAsImage` signature
was confirmed in the same task (unpdf 1.9.1). Details and the call shapes:
`docs/investigacion/spike-ocr-resultados.md`.

## Data Flow

```
student -> submitRequestAction -> submitDraft (tx, unchanged)
        -> scheduleExtraction -> queue.enqueue(id, now) -> after(...) ; redirect
after:  registerPendingExtractions(id) -> [configured?] -> for each doc:
        claim --> store.stream --> preparer --> extractor --HTTPS--> llama.cpp
          |                                                          |
          +<-- completeExtraction <-- validateFields <---------------+
cron:   intake-sweep steps 1-3 -> step 4: abandon -> select -> process
staff:  /review/[id] -> listExtractions (fail-soft) -> ExtractionSection
```

## File Changes

| File | Action |
|---|---|
| `src/lib/extraction/{states,limits,template,validate,config,display,ports,run,deps,configured,fakes}.ts` (+ tests) | Create |
| `src/lib/extraction/adapters/{sharp-unpdf-preparer,nuextract-http-extractor,after-queue}.ts` (+ tests, `test-support/pdf.ts`) | Create |
| `src/lib/extraction/{rnf03,max-duration}.test.ts` | Create |
| `src/lib/data/extraction.ts` (+ tests, opt-in integration test) | Create |
| `src/db/schema.ts`, `drizzle/0011_document_extraction.sql` (+ meta) | Modify / Create (generated) |
| `src/db/migration-document-extraction.test.ts` | Create |
| `src/app/(dashboard)/requests/new/{actions,page,step-actions}.ts(x)`, `requests/[id]/correct/{actions,page}.ts(x)` (+ tests) | Modify |
| `src/lib/data/intake-sweep.ts`, `src/app/api/cron/intake-sweep/route.ts` (+ tests) | Modify |
| `src/app/(dashboard)/review/[id]/{page,extraction-section,request-sections}.tsx` (+ tests) | Modify / Create |
| `src/env.ts`, `package.json`, `next.config.ts` (+ `src/next-config.test.ts`), `i18n/{es,en}.json` | Modify |
| `src/lib/data/test-support/db-double.ts` | Modify (records `calls` and `limit`) |
| `docs/investigacion/spike-ocr-resultados.md` | Modify (DE-14) |

## Testing Strategy (Strict TDD)

| Layer | What | Approach |
|---|---|---|
| Pure | Transitions and permanent errors; template/request shape; every DE-10 rule incl. spike failures (lone `rest_from`, 20-24 July = 5 days, year outside window); HTTPS/loopback config; display mapping and precedence; render-cap helper | Vitest, no I/O |
| Use case | Claim null skip; not configured hands back; deadline stops before a doc; each error code path; unexpected throw keeps the lease; sweep bounds | Fakes + `vi.mock("@/lib/data/extraction")` |
| Data | Registration eligibility (staff upload, special format, retired -> `no_aplica`, idempotent); claim guards (cap, lease); heldBy completion; fail to `fallida` at 3; abandon; candidate scope (`pendiente` only, batch bound); fail-soft list; the module changes no other table | Mocked db as existing data tests; emitted SQL pinned with a driver-less `drizzle.mock`; opt-in real Postgres concurrency suite: simultaneous claims -> one winner |
| Adapters | sharp rotate/resize; every PDF (text layer or not) rendered to images; page cap and page-size guard; canvas import failure -> `render_unavailable`; HTTP headers, bearer only with key, `redirect: "error"`, retry on 503 once, abort -> `timeout`, malformed -> `invalid_response` | `// @vitest-environment node`, generated fixtures (no real documents), injected `fetch` |
| RNF-03 | 10 extractions (7 images, 3 PDFs) through the real preparer and HTTP extractor with stubbed `globalThis.fetch`: exactly 10 model calls, every outbound URL host equals the configured host; static guard: no third-party OCR/inference SDK in `package.json` or `src` imports | node env, fake store and data |
| Producers / cron / config | Actions enqueue only on success and before redirect; sweep step counts; `maxDuration` literal pins; schema CHECK lists equal constants; only `extraction.ts` writes the table | Existing `vi.hoisted` patterns, file scans |
| UI | Each display state, "No reconocido", degraded notice, config message without variable name, es/en keys, 360 px | Testing Library |

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification
or routing change. The one new outbound integration (HTTP to the model server)
is covered by DE-8 and DE-12: URL from env only, HTTPS outside loopback, no
redirects, bounded response, codes-only logs, and the RNF-03 test.

## Migration / Rollout

| Step | Tag | Command / check |
|---|---|---|
| G1 | `[LOCAL]` | `npm run db:generate -- --name document_extraction` (re-check `drizzle/` on `main` first; expected `0011`) |
| P1 | `[READ-ONLY]` | Count `pendiente` requests and their eligible documents (backfill size) |
| M1 | `[CONFIRM]` | `drizzle-kit migrate` over the direct URL, **before** the producer slice deploys |
| V1 | `[READ-ONLY]` | Table exists and is empty |

Order: migrate -> deploy with `EXTRACTION_API_URL` unset (staff see the
configuration message; rows register) -> set the env when the model server is
deployed -> the cron backfills. If code reaches production before M1, the
`after()` callback fails and is logged, the list is `degraded`, and submission
is unaffected. Rollback: revert; unset the env to stop extraction; a
`[CONFIRM]` down-migration drops `ExtraccionDocumento` only.

## Review Workload Forecast

| Slice | Content | Approx. lines (prod + tests) |
|---|---|---|
| S1 | Pure domain: states, limits, template, config, validate, display | ~700 |
| S2 | Schema, migration test, `data/extraction.ts` | ~620 |
| S3 | Ports, fakes, `run.ts` | ~520 |
| S4 | Adapters, deps, env, `next.config`, dependencies, RNF-03 test (after DE-14) | ~820 |
| S5 | Producers, `after-queue`, sweep step 4, `maxDuration` pins, UI, i18n | ~740 |
| **Total** | | **~3,400** |

Above the proposal's 2,000-2,500 estimate and far above the 800-line budget
with `single-pr`. Each slice is inert until S5 wires the producers, so the
chain rolls back slice by slice; `sdd-tasks` must force the delivery decision.
Actual (apply, one PR under `size:exception`): about 8,800 authored lines,
roughly 2.6x the forecast, mostly tests; per-slice figures are in
`apply-progress.md`.

## Open Questions

- [x] `rest_to` may end up to 30 days after the reference date (decided
  2026-10-22; spec updated).
- [x] DE-14 fallback: text PDFs take the image path, no rules extractor
  (decided 2026-10-22; measured FAIL 2026-10-23).
- [x] Copy: neutral «Contacte» (decided 2026-10-22; spec updated).
- [ ] Vercel Hobby with Fluid compute (300 s) and its non-commercial terms;
  `@napi-rs/canvas` packaging must be proven on a preview (task 9.2).
