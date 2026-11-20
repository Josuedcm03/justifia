# Design: Manual Document Data (RF-14 a-d, RF-05 e, RN-11, RN-12, RN-13, RN-24)

## Technical Approach

This follows exploration approach 1 and decisions D1-D9 (`exploration.md`). The thesis (`C:\thesis-workspace`) is the source of truth:

- The three marks live on `DocumentoRespaldo`, as Anexo D D11 defines them.
- The four manual data fields live in a new 1:1 typed table. A non-null column means the value was entered manually.
- One pure function overlays the manual values on the OCR row at read time (RN-24). Its output is the effective row, which the display and every signal read.
- New pure evaluators produce rn11, rn12 and rn13. The type-to-cause map rides in `SignalParams`.
- One write module records a document's data in a single audited transaction.
- One server action and a per-document form in the review detail call that write module.

Migration `0015` is additive. CodeGraph has no index for the `p1` worktree and no shell was available to initialize one, so the code was read with Read and Grep. Every anchor below refers to the `p1` worktree.

## Architecture Decisions

| # | Topic | Options | Tradeoff | Decision |
|---|---|---|---|---|
| A1 | Marks | on `DocumentoRespaldo` / in the new table | Anexo D D11 places `TipoDocumento`, `TieneFirma` and `TieneSello` on D11 | Columns on `DocumentoRespaldo` (`schema.ts:398-465`): `TipoDocumento varchar(40)`, `TieneFirma boolean`, `TieneSello boolean`, all nullable with no default. NULL means "not registered yet" (D11). Add `CK_Documento_TipoDocumento`: `TipoDocumento IS NULL OR TipoDocumento IN (inList(TIPOS_DOCUMENTO))`, using the `inList` helper (`schema.ts:257`) |
| A2 | Four manual fields | D15 literal row per field / 1:1 typed table / columns in `ExtraccionDocumento` | D15 loses types and the from ≤ to CHECK. `ExtraccionDocumento` may have no row, `CK_Extraccion_Datos` (`schema.ts:874-877`) forbids data unless the state is `completada`, and `extraction.ts` is pinned as the only writer of that table (`extraction.test.ts:735-745`) | New table `DocumentoDatoManual`, described after this table |
| A3 | Where the merge happens | SQL `coalesce` everywhere / TS for the display, SQL for the history | The display needs the OCR value and the manual value apart, for the badges and the hint | TS `toEffectiveRow` in `listExtractions`. SQL `coalesce` in `readIssuerHistory` only, because it aggregates other requests |
| A4 | Promotion (D9) | promote only when OCR failed / promote on any manual field | Promoting always is simple and matches D9. Cost: while OCR is pending, a missing date reads as `field_missing` instead of `extraction_pending` | Any manual field makes the effective state `completada`. Marks alone do not promote, because they carry no dates and no issuer |
| A5 | Absent rule for rn11, rn12 and rn13 | lenient like RN-09 (`rest-dates.ts:101`) / strict like RN-10 | Lenient would let an unregistered document pass with "no alerts", and that document is the one the signal exists to catch (D1) | Strict. Present when any document is present (D5). Absent only when every document is registered and none is present. Otherwise `not_evaluable` with reason `not_registered`. With no documents, `no_eligible_documents` |
| A6 | Map seam (D3) | separate port / field of `SignalParams` | The `SignalParams` source is what roadmap row 8 replaces (D19 `ParametroNormativo` stores the map in `Valor jsonb`) | `SignalParams.documentTypeCauses`, set by default from `DOCUMENT_TYPE_CAUSES` in `src/lib/signals/document-type-causes.ts`. `loadSignals` already injects `params` (`signals.ts:258-263`) |
| A7 | Editable window (D6) | any visible state / `pendiente` only | | `pendiente`, re-checked under a `FOR UPDATE` lock on the request, as `special-format.ts:175-181` does |
| A8 | Coordination | show the manual values / outcomes only | The projection exposes no extracted value (`coordination-view.ts:7-12`) | The coordinator sees the outcomes and reason labels of rn11, rn12 and rn13, and no manual value. `coordination-view.ts` needs no code change because its switch is on the outcome, not the signal |
| A9 | Audit | value diff / field names | Name and issuer are personal data (RNF-06) | One `documento.datos_registrados` row per save that changed something. The payload holds field names only |

`DocumentoDatoManual` columns:

- `DocumentoId bigint` is the PK and an FK to `DocumentoRespaldo` with `ON DELETE CASCADE`.
- `NombreEstudiante varchar(160)`, `Emisor varchar(200)`, `FechaEmision date`, `ReposoDesde date` and `ReposoHasta date`. The lengths and types are those of `ExtraccionDocumento` (`schema.ts:833-837`).
- `RegistradoPorId bigint NOT NULL` is an FK to `Usuario` with no cascade.
- `ActualizadoEn timestamptz NOT NULL DEFAULT now()`.

`DocumentoDatoManual` CHECKs:

- `CK_DatoManual_Reposo`: `(ReposoDesde IS NULL) = (ReposoHasta IS NULL) AND (ReposoHasta IS NULL OR ReposoHasta >= ReposoDesde)`.
- `CK_DatoManual_Texto`: no blank `NombreEstudiante` or `Emisor` (`btrim(x) <> ''`).
- `CK_DatoManual_NoVacio`: at least one of the four fields is non-null. A row exists only when some value was entered manually, and clearing everything deletes the row.

Type to cause map (D4):

| `TipoDocumento` | Corresponds to |
|---|---|
| `constancia_medica` | `medica`, `maternidad_paternidad` (an assumption, no thesis scenario) |
| `constancia_institucional` | `actividad_representativa`, `intercambio_academico`, `fuerza_mayor` |
| `otro` | none ("Otro activa la señal de RN-13") |

## Data Flow

Read path, recomputed on every read (SNAP):

```
listExtractions(solicitudId)             src/lib/data/extraction.ts:384
  DocumentoRespaldo  ⟕ ExtraccionDocumento  ⟕ DocumentoDatoManual
  ─► item { row: toEffectiveRow(ocr, manual), ocr, manual, marks }
        │                               │
  ExtractionSection (display, badges)   loadSignals  signals.ts:258
                                          documents[i] = { extraction: row, marks }
                                          readIssuerHistory: coalesce(manual.Emisor, ocr.Emisor)
                                          evaluateSignals(input, params{threshold, documentTypeCauses})
                                          ─► rn07 rn09 rn10 rn11 rn12 rn13 rn14 rn26 ─► suggestVerdict
```

`toEffectiveRow(ocr, manual)` (`src/lib/document-data/effective.ts`):

- When `manual` is null, it returns `ocr` unchanged.
- Otherwise it returns `state: "completada"` and takes each field from `manual` when present. A field with no manual value falls back to the OCR value, but only when `ocr.state === "completada"`.
- A manual rest sets `restFrom`, `restTo` and `restDays = inclusiveDays(from, to)`, a new export of `src/lib/intake/dates.ts`. Without a manual rest, all three OCR rest values are kept.

Sequence of a save (RF-14 a, b, d):

```
Form ──saveDocumentDataAction(payload)──► action
action: requireRole(rolesRevisores) → resolveRequestScope → ids → validateDocumentData (D7)
   invalid ─► { ok:false, reason:"invalid", errors }   (shown in the form)
action ──saveDocumentData({actorId, scope, solicitudId, documentoId, data})──► data module
  tx: SELECT Solicitud FOR UPDATE WHERE requestRowInScope   none ─► not_found
      estado ≠ pendiente ─► not_editable
      SELECT DocumentoRespaldo (same request, valido, not retired, SubidoPorId NULL)  none ─► not_found
      read current marks + manual row; campos = changed field names; [] ─► ok, no write, no audit
      UPDATE DocumentoRespaldo marks (if changed)
      all four null ? DELETE DocumentoDatoManual : INSERT … ON CONFLICT (DocumentoId) DO UPDATE
      insertAuditEvents(tx, actorId, [documentDataRecordedEvent({documentoId, solicitudId, campos})])
action ◄─ ok ─► redirect(`/review/${solicitudId}`)   (SR-11: never revalidate)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `drizzle/0015_manual_document_data.sql`, `drizzle/meta/*` | Create | Generated by `npx drizzle-kit generate --name manual_document_data`. Fully generated, with nothing hand-appended (unlike 0014) |
| `src/db/schema.ts` | Modify | Three columns plus a CHECK on `documentoRespaldo`. New `documentoDatoManual` with its CHECKs |
| `src/db/migration-manual-document-data.test.ts` | Create | Follows `migration-data-retention.test.ts`. Checks: the file is located by name, its journal `when` is later than 0014's, exactly three nullable ADD COLUMNs with no default, one CREATE TABLE, an FK with `ON DELETE cascade` to `DocumentoRespaldo`, an FK without cascade to `Usuario`, four named CHECKs, and no DROP, DELETE, UPDATE, ALTER COLUMN, RENAME or BEGIN |
| `src/lib/document-data/types.ts` | Create | `TIPOS_DOCUMENTO`, `DocumentMarks`, `ManualFields`, `DOCUMENT_DATA_FIELDS` (pure) |
| `src/lib/document-data/effective.ts` (+test) | Create | `toEffectiveRow`, covering RN-24 and D8/D9 |
| `src/lib/document-data/validation.ts` (+test) | Create | D7 rules. Text is trimmed and an empty value becomes null (D8). Max lengths are 160 and 200. Dates must pass `isIsoDate` (`dates.ts:44`). The rest needs both dates or neither, with from ≤ to. The type must be in the list or null. Each mark is `true`, `false` or `null`. Error codes: `text_too_long`, `date_invalid`, `rest_incomplete`, `rest_order`, `type_invalid`, `mark_invalid` |
| `src/lib/signals/document-type-causes.ts` (+test) | Create | The D4 constant, `satisfies Readonly<Record<TipoDocumento, readonly Causa[]>>`. The test covers the 3 × 5 matrix as an explicit truth table |
| `src/lib/intake/causes.ts:24-26` | Modify | The comment points to the new map |
| `src/lib/signals/params.ts` | Modify | Add `documentTypeCauses`. RNF-14 remains "not met" |
| `src/lib/signals/types.ts` | Modify | `SIGNAL_CODES` becomes 8 codes, in numeric order. `not_registered` is appended to `REASON_PRECEDENCE` (`:22-30`). `ALLOWED_REASONS` for rn11, rn12 and rn13 is `["no_eligible_documents","not_registered"]`. New evidence kinds. `SignalDocument.marks` (`:159-163`) |
| `src/lib/signals/document-marks.ts` (+test) | Create | `evaluateMissingSignature`, `evaluateMissingSeal` and `evaluateTypeMismatch` (A5) |
| `src/lib/signals/evaluate.ts:39-55` | Modify | Insert the three results between rn10 and rn14 |
| `src/lib/data/extraction.ts:363-444` | Modify | A second LEFT JOIN plus the mark columns. The item carries `row` (effective), `ocr`, `manual` and `marks`. The read stays fail-soft |
| `src/lib/data/signals.ts:127-177, 297-300` | Modify | The issuer is `coalesce("DocumentoDatoManual"."Emisor", "ExtraccionDocumento"."Emisor")`. The state filter is dropped because `CK_Extraccion_Datos` already nulls a non-`completada` issuer. `ExtraccionDocumento` and `DocumentoDatoManual` are LEFT JOINs. `marks` is passed through |
| `src/lib/data/signals-sql.test.ts:73,113-115`, `extraction-sql.test.ts:95-97` | Modify | Re-pin the SQL text |
| `src/lib/data/document-data.ts` (+test) | Create | `saveDocumentData`, the only writer of `documentoDatoManual` and of the mark columns. It does not import `@/lib/data/signals` (VS-2) |
| `src/lib/audit/types.ts:21-66`, `events.ts`, `types.test.ts:34-83` | Modify | `documento.datos_registrados`, entity `DocumentoRespaldo`, payload `{ solicitudId; campos: DocumentDataField[] }` |
| `src/app/(dashboard)/review/[id]/document-data-actions.ts` (+test) | Create | `saveDocumentDataAction`, with `authorize` copied from `escalation-actions.ts:69-78` |
| `src/test/access/matrix-table.ts:181-192` | Modify | Add `` [`${REVIEW}/[id]/document-data-actions.ts`]: actions(SECRETARIA, "saveDocumentDataAction") `` |
| `src/app/(dashboard)/review/[id]/document-data-form.tsx` (+test) | Create | Client form, one per document |
| `src/app/(dashboard)/review/[id]/extraction-section.tsx` | Modify | Stop hiding `notConfigured` entries (`:150-157`). Add the marks facts, the badges and the form slot. New `editable` prop |
| `src/app/(dashboard)/review/[id]/signals-section.tsx:38-79` | Modify | Evidence lines for `mark` and `documentType` |
| `src/app/(dashboard)/review/[id]/page.tsx:149-156, 301-305` | Modify | Replace the RF-14 placeholder sentence with the real behaviour. Pass `editable={pending}` |
| `src/app/(dashboard)/review/[id]/request-sections.tsx:18-21` | Modify | Same replacement of the placeholder sentence |
| `i18n/es.json`, `i18n/en.json` | Modify | Keys listed under UI below |
| `src/lib/data/retention-inventory.test.ts:163-181`, `retention.test.ts:399-407`, `integration/retention.integration.test.ts:277,428-433` | Modify | See Retention below |
| `src/lib/signals/rf-05-e.test.ts`, `src/lib/data/integration/rf-14.integration.test.ts` | Create | Thesis acceptance tests |
| `docs/requirements.md`, `docs/roadmap.md` | Modify | Minimal edits: RF-14 status and roadmap row 18 |

## Interfaces / Contracts

```ts
// src/lib/document-data/types.ts
export const TIPOS_DOCUMENTO = ["constancia_medica", "constancia_institucional", "otro"] as const;
export type DocumentMarks = { type: TipoDocumento | null; hasSignature: boolean | null; hasSeal: boolean | null };
export type ManualFields = { studentName: string | null; issuer: string | null;
  issueDate: string | null; restFrom: string | null; restTo: string | null };
export const DOCUMENT_DATA_FIELDS = ["nombreEstudiante", "emisor", "fechaEmision",
  "reposo", "tipoDocumento", "tieneFirma", "tieneSello"] as const;

// src/lib/signals/types.ts (additions)
| { kind: "mark"; mark: "signature" | "seal"; missing: number; registered: number }
| { kind: "documentType"; causa: Causa; mismatched: TipoDocumento[] }

// src/lib/data/document-data.ts
export type SaveDocumentDataResult =
  | { ok: true; changed: boolean } | { ok: false; reason: "not_found" | "not_editable" };
```

The action returns `{ ok:false; reason:"not_found"|"not_editable"|"unexpected" } | { ok:false; reason:"invalid"; errors }`. On success it redirects. An out-of-scope id and an unknown id get the same `not_found`.

## UI (review detail)

`ExtractionSection` is retitled "Datos del documento" and lists every current student document:

- The display comes from the effective row (`toExtractionDisplay`, `display.ts:67-84`). A `notConfigured` entry now renders, with the line `states.notExtracted`. `ConfigurationNotice` still appears once for the section.
- Each data fact with a manual value shows the "Ingresado manualmente" pill. The pill uses the same token classes as `DeadlineBadge` (`docs/design-system.md`), so the design system gains no new value.
- Three facts show the type, firma and sello, each with "Sin registrar" when null.
- When `editable` is true, a `Collapsible` labelled "Registrar o corregir datos" holds the form:
  - text inputs for name and issuer, with the OCR value as a hint;
  - `type="date"` inputs for the issue date and the rest from and to;
  - a `Select` for the type, with "Sin registrar" plus the three types;
  - a `RadioGroup` for firma and one for sello, each with Sí / No / Sin registrar.
- The form prefills the manual values only. Emptying a field clears it, so the value reverts to OCR (D8).
- The form is keyed on `documentoId` plus `ActualizadoEn` and the marks, so it remounts closed after the redirect.
- At 360 px the form is one column (`grid gap-4 sm:grid-cols-2`), the radios use `flex flex-wrap gap-2`, and the submit button uses `w-full sm:w-auto`.

i18n keys:

- `review.extraction`: `manualBadge`, `states.notExtracted`, `marks.{type,signature,seal}`, `markValues.{yes,no,unregistered}`, `types.{constancia_medica,constancia_institucional,otro}`.
- `review.extraction.form`: `{open,save,saving,ocrHint}`, `errors.{6 codes}`, `failures.{not_found,not_editable,unexpected}`.
- `review.signals`: `names.{rn11,rn12,rn13}` ("Firma ausente", "Sello ausente", "Formato no corresponde a la causa"), `reasons.not_registered`, `evidence.{mark,documentType}`.

## Retention

- `retention-inventory.test.ts`: add `tipoDocumento`, `tieneFirma` and `tieneSello` to `documentoRespaldo.deleted`. Add a `documentoDatoManual` entry with every column in `deleted` and a comment saying the table cascades.
- `retention.test.ts:402`: the regex becomes `/extraccionDocumento|documentoDatoManual|huellaSha256/i`, so `retention.ts` never names the new table. The deletion at `retention.ts:190-192` cascades.
- `retention.integration.test.ts`: after `:277`, insert a `DocumentoDatoManual` row (name and issuer) and set the marks. Next to `:428-433`, assert that zero manual rows remain.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | RF-05 (e) "tipo discordante" | `src/lib/signals/rf-05-e.test.ts`: SC-05 is present, SC-01, SC-10, SC-06, SC-13 and SC-11 are absent, `otro` is always present, and an untyped document gives `not_registered` |
| Unit | Map | 15-cell truth table, every type key present, `otro` maps to `[]` |
| Unit | Evaluators, merge, validation | `document-marks.test.ts` (A5 table, D5 with several documents), `effective.test.ts`, `validation.test.ts` |
| Unit | Write module | `document-data.test.ts` with `createDbDouble`: not in scope, not `pendiente`, wrong document, no change (no write and no audit), clear-all deletes the row, audit `campos` exact and value-free |
| Unit | Action | Session, role and scope; invalid payload; redirect to self; the review structure guard (`review/structure.test.ts:196-204`) |
| Integration | Thesis cases | `rf-14.integration.test.ts`, with one describe per inciso:<br>- (a) round trip and RN-24: manual wins, clearing reverts to OCR, an earlier request's manual issuer counts toward RN-14.<br>- (b) SC-08 gives rn12 and SC-14 gives rn11.<br>- (c) SC-12: a forced `fallida` row (`errorCodigo: "unreadable_document"`) gives rn10 `not_evaluable`; after capture of rest 9-9 Nov against an absence of 9-10 Nov, rn10 is present. Also a document with no row (extraction off) then capture.<br>- (d) SC-05 gives rn13 and `review_carefully`.<br>- SC-01 with all marks gives `no_alerts`. SC-11 gives rn13 absent.<br>- The audit row for each save.<br>Harness: `INTEGRATION_ALLOW_WRITES=1`, fixtures from `fixtures.ts` |

Verdict fixtures that change with D1 and the eight codes:

- `evaluate.test.ts:66-67,353`
- `verdict.test.ts:83,218`
- `signals.test.ts`
- `coordination-view.test.ts:175`
- `signals-section.test.tsx`
- `i18n/review-messages.test.ts:645`
- `requests/no-signals.test.ts:301`
- `validation-signals.integration.test.ts` (its `no_alerts` case needs marks)
- `review/[id]/page.test.tsx`
- `extraction.test.ts:592-680`

RF-14 system capture, manual steps following hoja lines 46-53. Run them locally on a disposable Neon branch with fictitious data. Save the evidence to `build/salida/pruebas/RF-14_{a..d}.png`:

- (a) As secretary, on a pending FM request, enter the four fields and save. Each one shows "Ingresado manualmente". Run a read-only `select` on `DocumentoDatoManual`.
- (b) Mark firma No and sello Sí. After the redirect the marks show, and so does rn11.
- (c) With `EXTRACTION_API_URL` unset, present a new request. Register its data, see the signals, then approve. The request resolves.
- (d) Register `constancia_medica` on an `actividad_representativa` request. "Formato no corresponde a la causa" shows.

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A: no file classification or execution |
| Git repository selection | N/A: no VCS automation |
| Commit state | N/A: no VCS automation |
| Push state | N/A: no VCS automation |
| PR commands | N/A: no PR automation |

The Server Action boundary is covered by the access matrix row and the action's own tests.

## Slicing (Feature Branch Chain on `feat/manual-document-data`)

| PR | Branch suffix | Scope | Est. lines |
|---|---|---|---|
| 1 | `-1-schema` | 0015, schema, migration test, `types`, `effective`, map, `inclusiveDays`, inventory | ~480 |
| 2 | `-2-data` | `listExtractions` and issuer overlays with their SQL pins, `saveDocumentData`, audit action, retention cascade proof | ~560 |
| 3 | `-3-signals` | rn11, rn12 and rn13, types, evaluate, params wiring, evidence lines, i18n, verdict fixtures | ~500 |
| 4 | `-4-form` | validation, action, matrix row, form, section changes, placeholders, i18n | ~540 |
| 5 | `-5-thesis` | `rf-05-e.test.ts`, `rf-14.integration.test.ts`, requirements, roadmap row 18 | ~420 |

PR1 targets the tracker, and each later PR targets the previous one. No slice merges to `main` on its own.

Merge gate: the tracker merges to `main` (which auto-deploys) only after the owner's explicit yes to apply `0015` in production and a read-only check that it is applied. PR1 already falls under the gate, because Drizzle lists every declared column in an INSERT, so a document upload would name `TipoDocumento`.

Deploy-order risk: `listExtractions` is fail-soft (`extraction.ts:437-443`). On a database without `0015` it degrades silently, and `loadSignals` then degrades too (`signals.ts:267`). The detail would hide data and signals instead of failing loud. The gate is the only protection.

## Migration / Rollout

1. Before PR1, agree the migration number with catalog-schedule. If that change takes `0015`, regenerate this one as `0016`.
2. Read-only check in production: the three columns and the table are absent.
3. Owner's yes, then `drizzle-kit migrate`. The migration is additive and nullable, so the code already in production is unaffected.
4. Disposable branch from production. Owner's yes, then run the integration suite.
5. Merge the tracker to `main`. Smoke test: the form shows on a pending request.

Rollback: revert in reverse order. The columns and the table may stay. Dropping them needs a new migration and the owner's yes.

## Thesis Sync List

- **Anexo D, line 42 note:** the D11 columns exist from `0015` on (they are no longer "previstos"). D15 is realized as `ExtraccionDocumento` (OCR) plus `DocumentoDatoManual` (one typed row per document, where a non-null column equals `Origen manual`). RN-24 precedence is resolved at read time.
- **Anexo F:**
  - RF-05-e: Unitaria, Cumple, `src/lib/signals/rf-05-e.test.ts`.
  - RF-14: one row per inciso a-d, Sistema, Cumple, `RF-14_a.png` to `RF-14_d.png`.
  - RNF-14: stays "No cumple". Note that the map is a constant (`document-type-causes.ts`).
  - The Alta count goes from 47/53 to 52/53.
- **A5 and Anexo G:**
  - SC-12's "Decisión esperada" no longer reads "RF-14 no está construido".
  - G10, row "SC-05, SC-08 y SC-14", gets updated only after a new verification run.
  - Under D1, the "Aprobable" expectation of SC-01 and SC-09 holds only once firma, sello and type are registered.
- **Hoja de ejecución, lines 50-53:** record the outcomes after the capture.

## Open Questions

- [ ] A5 rule: confirm the strict absent rule for rn11, rn12 and rn13 (A5), versus RN-09's lenient rule.
- [ ] SC-11 (a): the FE carries no coordination firma or sello by design. If the secretary marks "No", rn11 and rn12 show and contradict A5's "Ninguna". Which reading does the thesis want for FE marks?
- [ ] PR2 and PR4 exceed the 400-line budget. At sdd-tasks, either accept them or split PR4 into action and form.
- [ ] A4 promotion while OCR is pending: is `field_missing` instead of `extraction_pending` acceptable?
