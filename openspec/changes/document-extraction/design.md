# Design: Document Extraction

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries a schema, a migration, three ports with adapters, an `after()`
> pipeline, a cron step, a model contract, code-side validation and a UI
> section; the repository precedent (`teacher-remission`, `secretary-review`)
> keeps decision tables over prose cuts. The deviation is deliberate.

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
(sharp / unpdf / lazy `@napi-rs/canvas`), `FieldExtractor` (NuExtract3 over
llama.cpp's OpenAI-compatible API), pure validation, guarded completion. The
daily `intake-sweep` gains step 4 as the backstop and backfill. Staff read the
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
| `src/lib/extraction/states.ts` | `EXTRACTION_STATES`, `EXTRACTION_ERRORS`, `PERMANENT_ERRORS`, guards |
| `limits.ts` | All numeric constants (DE-7, DE-9) |
| `template.ts` | `NUEXTRACT_TEMPLATE`, `ENGINE_ID`, `buildChatRequest(prepared)` (pure) |
| `validate.ts` | `validateFields(raw, ctx)` and `appearsInText` helpers (pure, DE-10) |
| `config.ts` | `resolveExtractionConfig(env)` -> `{ ok, baseUrl, apiKey? } \| { ok: false }`; HTTPS rule (DE-12) |
| `display.ts` | `toExtractionDisplay(row, configured)` (pure, DE-13) |
| `ports.ts` | `DocumentPreparer`, `FieldExtractor`, `ExtractionQueue` |
| `run.ts` | `runDocumentExtraction`, `processRequestExtractions` (use case) |
| `deps.ts` | `getExtractionDeps()` composition root (`server-only`); reuses `getIntakeDeps().store` |
| `fakes.ts` | Fake preparer, scripted extractor, recording queue |
| `adapters/sharp-unpdf-preparer.ts` | DE-9 |
| `adapters/nuextract-http-extractor.ts` | DE-8 |
| `adapters/after-queue.ts` | `after()` + try/catch, mirrors `scheduleDispatch` |
| `src/lib/data/extraction.ts` | The ONLY writer of `ExtraccionDocumento` (structural test) |

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
| `Motor` | `varchar(40) NULL` (`nuextract3-4b/image`, `nuextract3-4b/text`) |
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
pendiente|procesando|fallida --doc retired--> no_aplica (claim cleared)
```

`completada`, `fallida`, `no_aplica` are terminal for this change
(`validation-signals` adds manual entry later). `MAX_ATTEMPTS = 3`,
`CLAIM_LEASE_MS = 10 min` (> 300 s, so only a killed invocation is taken
over). Completion is `UPDATE ... WHERE DocumentoId = $id AND ReclamoId = $uuid
AND Estado = 'procesando'`; a stale worker writes nothing.

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
| Producers | `submitRequestAction`: after `submitDraft` ok, `getExtractionDeps().queue.enqueue(draft.id, now)` then `redirect`. `resubmitCorrectionAction`: same inside `if (outcome.ok)`. The transactions and their tests are untouched |
| Adapter | `after(() => processRequestExtractions(id, deps, { startedAt }))` in try/catch; a scheduling or callback failure logs `extraction_not_scheduled` / `extraction_run_failed` by error name only |
| Registration | `registerPendingExtractions(solicitudId, now)`, one tx: `INSERT ... SELECT` documents with `Estado = 'valido'`, `RetiradoEn IS NULL`, `SubidoPorId IS NULL`, `FormatoEspecial = false`, `ON CONFLICT DO NOTHING`; retired documents without a row -> `no_aplica`; open rows of retired documents -> `no_aplica`. Returns the request's claimable document ids ordered by id |
| Processing | Sequential `runDocumentExtraction(id)` while the remaining budget is at least `MIN_DOCUMENT_BUDGET_MS`; leftovers stay `pendiente` for the cron |
| Unexpected throw | Logged by name; the row keeps its lease and the cron reclaims it after expiry |

Rejected: rows inside the submit transaction (approach A, reopens hot
transactions); per-document internal HTTP fan-out (approach C, auth and
preview protection).

### DE-6. `runDocumentExtraction(documentoId, deps, { deadline })`

1. `claimExtraction` (guarded `UPDATE ... FROM DocumentoRespaldo JOIN
   Solicitud RETURNING` pathname, `TipoDetectado`, `Intentos`, `ReclamoId`,
   submission date = `ReenviadaEn ?? PresentadaEn`; requires the document not
   retired). Null -> `skipped`.
2. `extractor.isConfigured()` false -> `failExtraction(not_configured)`.
3. `store.stream(pathname)` -> bytes; null or error -> `document_unavailable`.
4. `preparer.prepare(bytes, tipo)` -> error code or `PreparedDocument`.
5. `extractor.extract(prepared, { timeoutMs })`.
6. `validateFields(raw, { submittedOn, sourceText })` (text path only).
7. `completeExtraction(claim, fields, motor)`.

### DE-7. Deadline, timeout, cold start (`limits.ts`)

| Constant | Value | Rationale |
|---|---|---|
| `EXTRACTION_MAX_DURATION_S` | 300 | Hobby + Fluid compute ceiling; pinned equal to the three literal `maxDuration` exports |
| `DEADLINE_SAFETY_MS` | 25 s | Leaves room for the guarded completion writes |
| deadline | `startedAt + 300 s - 25 s` | `startedAt` is the action's `now`, so validation and commit time count |
| `MIN_DOCUMENT_BUDGET_MS` | 20 s | Do not start a document that cannot finish |
| `FETCH_TIMEOUT_MS` | 120 s | Covers a serverless GPU cold start; effective timeout `min(120 s, remaining - 10 s)` via `AbortSignal.timeout` |
| Cold-start retry | 1 retry after 5 s on connection error or HTTP 502/503/504, only if the remaining budget still covers `MIN_DOCUMENT_BUDGET_MS`; same attempt, `Intentos` unchanged | Spike: 2-5 s warm; first request after scale-to-zero fails or stalls |

Abort -> `timeout`; other non-2xx (incl. 401/403) or network -> `model_error`.

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
//   messages: [{ role: "user", content: <image_url parts in page order> | <text> }],
//   chat_template_kwargs: { template: JSON.stringify(TEMPLATE, null, 4), enable_thinking: false } }
```

Images go as `data:image/jpeg;base64,...` parts. Headers: `Content-Type`;
`Authorization: Bearer <key>` only when a key is set. `redirect: "error"` (a
redirect could move the document to another host, RNF-03). Response: read at
most 64 KiB, `choices[0].message.content`, strip a code fence, `JSON.parse`,
zod schema (each key string/number or null; extra keys ignored) ->
otherwise `invalid_response`. `fetch` injected for tests.

### DE-9. Preparer: image vs text path

| Input | Path |
|---|---|
| `png`/`jpeg` | sharp `.rotate()` (EXIF) -> `resize({ width: 1600, withoutEnlargement: true })` -> JPEG q85 -> one image |
| `pdf`, every page has >= `MIN_TEXT_CHARS_PER_PAGE` (80) non-whitespace chars and <= `MAX_PDF_PAGES` (5) pages | unpdf per-page text, joined with page markers, truncated to `MAX_TEXT_CHARS` (6,000) -> text path, `Motor = nuextract3-4b/text` |
| any other `pdf` (scanned or mixed) | Render the first 5 pages with unpdf `renderPageAsImage` + `canvasImport: () => import("@napi-rs/canvas")`, then the sharp step; failed dynamic import -> `render_unavailable` |
| unparseable bytes | `unreadable_document` (permanent) |

Page-size guard (added 2026-10-23, task 4.11). Rendering at a fixed width makes
the canvas height proportional to the page's aspect ratio, so a page box such
as 1 x 14400 pt would allocate millions of pixels before the draw fails. Before
any page is drawn, the preparer reads each page it would send (the first
`MAX_PDF_PAGES`) through the same pdf.js proxy at scale 1, rotation applied.
`fitsRenderCap(width, height)` (`limits.ts`, pure) is false when
`height * IMAGE_MAX_WIDTH / width > MAX_RENDERED_PAGE_HEIGHT` (10,000 px = 16 MP
at width 1600, ratio 6.25) or the size is zero, negative or not finite. One page
over the cap refuses the whole document as `unreadable_document` (permanent: the
file will not change), with no canvas allocated and no partial result. Letter,
A4, legal and a 400 mm receipt (ratio 5) pass.

### DE-10. Validation (`validate.ts`, pure)

| Rule | Behaviour |
|---|---|
| Strings | Trim, collapse whitespace; empty or longer than the column -> null |
| Dates | Real ISO calendar dates only; plausibility window per the spec (reference = Managua date of `COALESCE(ReenviadaEn, PresentadaEn)`): issue date and `rest_from` in `[ref - 1 year, ref]`; `rest_to` in `[ref - 1 year, ref + 30 days]` (rest still running at submission); issue date outside -> null; any rest date outside -> whole rest period null |
| Rest period | Exactly the two spec forms: `rest_from` + `rest_to` (`to >= from`) -> days computed inclusive in code (model's `rest_days` ignored); or `rest_days` in 1..366 with no dates -> days only. Any other combination (lone date, a date plus days) -> whole rest period null |
| Text path | `student_name`/`issuer` must appear in the normalized source text (NFD, no diacritics, lowercase, collapsed spaces); a date must appear in a recognized Spanish numeric or long form; `rest_days` must appear as `n día(s)` or `n*24 h/hrs/horas`; otherwise null |
| Result | All-null is still `completada` ("no reconocido" everywhere, RF-11 b). The extracted name never replaces the snapshot name (RN-02) |

### DE-11. Cron step 4 (`justification-intake` delta)

`runIntakeSweep(now, store, extraction?)` gains an optional injected step
`extraction.sweep(now, deadline)` so `intake-sweep.ts` imports no adapter.
The step: `abandonExpiredExtractions(now)` (DE-3 last-attempt leases ->
`fallida`); if configured, `selectExtractionCandidates(now, 10)` = requests
with `Estado = 'pendiente'` that have a `pendiente` row, an expired
`procesando` lease under the cap, or an eligible document without a row
(anti-join), oldest `PresentadaEn` first; then `processRequestExtractions`
sequentially until the deadline. `SweepCounts` gains `extractionsRun` and
`extractionsAbandoned`; failures count into `failures`. The bounded batch plus
the deadline is the backfill of decision 5.

### DE-12. Environment, dependencies, config

| Item | Choice |
|---|---|
| `src/env.ts` | `EXTRACTION_API_URL: optionalSecret(1)`, `EXTRACTION_API_KEY: optionalSecret(16)`; validated at use, never at boot |
| HTTPS | `resolveExtractionConfig`: `https:` always; `http:` only for loopback (`localhost`, `127.0.0.0/8`, `::1`); anything else -> not configured, logged once as `extraction_config_invalid` (RNF-02) |
| `package.json` | `sharp`, `unpdf`, `@napi-rs/canvas` as direct dependencies |
| `next.config.ts` | `serverExternalPackages: ["@napi-rs/canvas"]` (Next auto-externalizes `sharp` only) |
| `maxDuration = 300` | `requests/new/page.tsx`, `requests/[id]/correct/page.tsx`, `api/cron/intake-sweep/route.ts`; literal (segment config must be static), pinned to `EXTRACTION_MAX_DURATION_S` by a file-scan test |
| Logs | Codes and ids only, never values or text (RNF-04) |

### DE-13. Staff UI

`listExtractions(solicitudId)` returns `{ data, degraded }` (fail-soft); the
page loads it with the rest, before `recordRequestRead` (one audited read).
`review/[id]/extraction-section.tsx` (server component, no polling) renders
after `DocumentsSection`, for the request's student-uploaded documents. Visible
to the roles that already open the page (`rolesRevisores`, decision 1).

| `toExtractionDisplay` | UI |
|---|---|
| `completada` | Name in the document, issuer, issue date, rest period; null -> muted "No reconocido" |
| not completed and `configured = false` | Configuration-needed message (decision 3); never names the variable |
| no row, `pendiente`, `procesando` | "Extracting data; reload later" |
| `fallida` | "Unavailable; review the document", no action (decision 2) |
| `degraded` | One section-level notice, no per-document rows |

i18n (`es`, `en`): `review.detail.sections.extraction`,
`review.extraction.{note, fields.{studentName,issuer,issueDate,restPeriod},
notRecognized, restDays (ICU plural), restRange, states.{extracting,
unavailable, notConfigured}, degraded}`. Staff copy uses the existing neutral
register: «Hace falta configurar el servicio de extracción. Contacte al
administrador del sistema.» Tokens only from `docs/design-system.md`
(`text-muted-foreground`, existing `Section`, `dl` layout of
`request-sections.tsx`).

### DE-14. First apply task: text-mode measurement

Before writing the text path, run NuExtract3 (local `nuextract3` container)
in text mode on 2-3 text-layer PDFs with the DE-8 contract; record per-field
results in `spike-ocr-resultados.md` without personal data. Gate: issuer and
issue date correct and passing the appear-in-text check on every sample. Fail
-> text-layer PDFs take the image path (DE-9) like scanned PDFs; no rules
extractor is built (decided 2026-10-22). Also confirm the unpdf `renderPageAsImage` signature
against current docs.

## Data Flow

```
student -> submitRequestAction -> submitDraft (tx, unchanged)
        -> queue.enqueue(id, now) -> after(...) ; redirect
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
| `src/lib/extraction/{states,limits,template,validate,config,display,ports,run,deps,fakes}.ts` (+ tests) | Create |
| `src/lib/extraction/adapters/{sharp-unpdf-preparer,nuextract-http-extractor,after-queue}.ts` (+ tests) | Create |
| `src/lib/extraction/rnf03.test.ts` | Create |
| `src/lib/data/extraction.ts` (+ test) | Create |
| `src/db/schema.ts`, `drizzle/0011_document_extraction.sql` (+ meta) | Modify / Create (generated) |
| `src/db/migration-document-extraction.test.ts` | Create |
| `src/app/(dashboard)/requests/new/{actions,page}.ts(x)`, `requests/[id]/correct/{actions,page}.ts(x)` (+ tests) | Modify |
| `src/lib/data/intake-sweep.ts`, `src/app/api/cron/intake-sweep/route.ts` (+ tests) | Modify |
| `src/app/(dashboard)/review/[id]/{page,extraction-section}.tsx` (+ tests) | Modify / Create |
| `src/env.ts`, `package.json`, `next.config.ts`, `i18n/{es,en}.json` | Modify |
| `docs/investigacion/spike-ocr-resultados.md` | Modify (DE-14) |

## Testing Strategy (Strict TDD)

| Layer | What | Approach |
|---|---|---|
| Pure | Transitions and permanent errors; template/request shape; every DE-10 rule incl. spike failures (lone `rest_from`, 20-24 July = 5 days, year outside window, invented text-path value); HTTPS/loopback config; display mapping | Vitest, no I/O |
| Use case | Claim null skip; not configured hands back; deadline stops before a doc; each error code path; unexpected throw keeps the lease | Fakes + `vi.mock("@/lib/data/extraction")` |
| Data | Registration eligibility (staff upload, special format, retired -> `no_aplica`, idempotent); claim guards (cap, lease); heldBy completion; fail to `fallida` at 3; abandon; candidate scope (`pendiente` only, batch bound); fail-soft list | Mocked db as existing data tests; opt-in real Postgres concurrency suite: two claims -> one winner |
| Adapters | sharp rotate/resize; text vs render selection; canvas import failure -> `render_unavailable`; HTTP headers, bearer only with key, `redirect: "error"`, retry on 503 once, abort -> `timeout`, malformed -> `invalid_response` | `// @vitest-environment node`, generated fixtures (no real documents), injected `fetch` |
| RNF-03 | 10 extractions (7 images, 3 text PDFs) through the real preparer and HTTP extractor with stubbed `globalThis.fetch`: exactly 10 model calls, every outbound URL host equals the configured host; static guard: no third-party OCR/inference SDK in `package.json` or `src` imports | node env, fake store and data |
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

## Open Questions

- [x] `rest_to` may end up to 30 days after the reference date (decided
  2026-10-22; spec updated).
- [x] DE-14 fallback: text PDFs take the image path, no rules extractor
  (decided 2026-10-22).
- [x] Copy: neutral «Contacte» (decided 2026-10-22; spec updated).
- [ ] Vercel Hobby with Fluid compute (300 s) and its non-commercial terms;
  `@napi-rs/canvas` packaging must be proven on a preview.