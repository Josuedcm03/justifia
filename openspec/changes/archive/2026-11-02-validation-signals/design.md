# Design: Validation Signals

> **Size note.** The `sdd-design` skill caps a design at 800 words. This change
> carries five evaluators, two scoped queries, a port extension, a migration and
> two UI surfaces; like `escalation`, decision tables are kept over prose cuts.

> **DB-touching.** This document plans commands and runs none. Steps are tagged
> `[LOCAL]`, `[READ-ONLY]` or `[CONFIRM]`; a `[CONFIRM]` step needs the owner's
> explicit "yes" for that single command (`CLAUDE.md`).

Binding inputs: `proposal.md`, `preproposal.yaml` revision 2 (S0, S1, V1, R26,
R10, SNAP, PRIV, BACKFILL, DELIVERY, X1-X4), `exploration.md`,
`docs/requirements.md` (RF-05 a-d, RN-07, RN-09, RN-10, RN-14, RN-15, RN-26,
RNF-01). Decisions here are **VS-1..VS-9**. No new Next.js API is used: pages
stay async RSC with the existing `requireRole` + scope + `notFound()` pattern.

## Technical Approach

Signals are computed on read (SNAP). A DB-free module `src/lib/signals/`
evaluates five signals from a plain input object plus a params object and the
injected `NonWorkingDaysProvider`; each yields `present | absent |
not_evaluable(reason)`. One fail-soft loader `src/lib/data/signals.ts` assembles
the input with scope-aware queries and returns `{ data, degraded }`. Finalize
gains a single-stream read that feeds the signature check, the size check and a
SHA-256 stored in a new nullable column. The secretary detail renders a
`SignalsSection`; the coordination detail renders a stripped projection;
students get nothing.

## Architecture Decisions

### VS-1. Pure evaluator layout (`src/lib/signals/`, no `server-only`, no DB)

| File | Content |
|---|---|
| `types.ts` | `SignalCode = "rn07" \| "rn09" \| "rn10" \| "rn14" \| "rn26"`; `SignalResult` discriminated on `outcome`; closed `NotEvaluableReason`; per-signal evidence (ids, ISO dates, counts, normalized issuer only) |
| `params.ts` | `SignalParams = { issuerRecurrenceThreshold: number }`, `DEFAULT_SIGNAL_PARAMS = { issuerRecurrenceThreshold: 3 }` (X3; roadmap #8 replaces the source, RNF-14 not met) |
| `timing.ts` | RN-07 |
| `rest-dates.ts` | RN-09, RN-10 (interval union helper) |
| `issuer.ts` | `normalizeIssuer` (NFD, strip marks, lowercase, remove punctuation, collapse whitespace, trim) + RN-14 |
| `repeated-document.ts` | RN-26 (S2) |
| `verdict.ts` | `suggestVerdict(results)` |
| `evaluate.ts` | `evaluateSignals(input, params, calendar): SignalReport` |

Closed reason codes — the spec's set and precedence are authoritative
(`no_period`, `no_eligible_documents`, `extraction_pending`,
`extraction_failed`, `days_only`, `field_missing`, `no_fingerprint`, first
match winning; plus `calendar_not_covering_year` for RN-07):

| Signal | Rule | `not_evaluable` reasons |
|---|---|---|
| RN-07 | present iff `managuaToday(presentadaEn) > deadlineOf(fechaFin)` (first presentation, never `reenviadaEn`) | `calendar_not_covering_year` (year of `fechaFin` or of the deadline) |
| RN-09 | per completed extraction with `fechaEmision` and `reposoHasta`: present iff `reposoHasta < fechaEmision`; request present if any | `no_eligible_documents`, `extraction_pending`, `extraction_failed`, `days_only`, `field_missing` |
| RN-10 | union of dated rest ranges (adjacent days merge) must contain `[fechaInicio, fechaFin]`: absent if covered; uncovered + any days-only, pending or failed document -> not evaluable; uncovered otherwise -> present | `no_eligible_documents`, `extraction_pending`, `extraction_failed`, `days_only`, `field_missing` |
| RN-14 | for each normalized issuer of the current request: count distinct presented requests of the same student and period, earlier or equal by `(presentadaEn, id)`, carrying it; present iff any count >= threshold | `no_period` (no single `Grupo.periodo`: none or more than one), `no_eligible_documents`, `extraction_pending`, `extraction_failed`, `field_missing` (no issuer) |
| RN-26 | any eligible current document hash equals a hash of an earlier other request | `no_eligible_documents`, `no_fingerprint` (every eligible document has NULL hash; BACKFILL) |

RN-26 with some hashed and some NULL documents and no match is `absent`
(NULL documents are ignored); recorded as an assumption. In S1 `evaluate.ts`
runs four signals; S2 adds `rn26`.

| Option | Tradeoff | Decision |
|---|---|---|
| Pure functions + params object | Table-testable, #8 can inject params | **Chosen** |
| SQL-side evaluation | Calendar and normalization not in SQL (`unaccent` needs an extension) | Rejected |

### VS-2. Verdict (V1, RN-15)

`review_carefully` if any present; `no_alerts` if none present and all
evaluable; `inconclusive` otherwise. `SignalReport = { verdict, results,
notEvaluable: SignalCode[] }`; the UI lists `notEvaluable` apart. Display-only:
structural test `src/lib/signals/display-only.test.ts` scans `src/**/actions.ts`,
`src/**/*-actions.ts` and every `src/lib/data/*.ts` except `signals.ts` and
fails if any imports `@/lib/signals` or `@/lib/data/signals`.

### VS-3. Read assembly (`src/lib/data/signals.ts`, fail-soft)

`loadSignals({ solicitudId, referenceScope: RequestScope, params?, calendar?
}): Promise<{ data: SignalReport | null; degraded: boolean }>`. The caller has
already proven the request is in its scope. Any throw -> `{ data: null,
degraded: true }`, logs `signals_read_failed` with the error name only (RNF-04).
No audit row (beyond the page's `solicitud.consultada`).

| Query | Shape |
|---|---|
| Q1 base | `Solicitud` `presentadaEn`, `fechaInicio`, `fechaFin`, `estudianteId` |
| Q2 extractions | reuse `listExtractions(solicitudId)`; its `degraded` makes the whole result degraded |
| Q3 periods | `SELECT DISTINCT Grupo.Periodo` via `SolicitudAsignatura` |
| Q4 RN-14 history | presented requests (`PresentadaEn IS NOT NULL`) of the same student, `id <> R`, `(PresentadaEn, Id) < (R.PresentadaEn, R.Id)`, EXISTS a group with the period; joined to current student documents (`valido`, not retired, `SubidoPorId IS NULL`, not `FormatoEspecial`) and `completada` extraction with non-null `Emisor`; returns `(solicitudId, emisor)` raw, normalized in TS; the evaluator adds the current request itself (count includes it) |
| Q5 RN-26 (S2) | eligible current documents of R; then `DocumentoRespaldo d JOIN Solicitud s` WHERE `d.HuellaSha256 IN (...)`, `s.Id <> R`, `s.PresentadaEn IS NOT NULL`, `(s.PresentadaEn, s.Id) < (R.PresentadaEn, R.Id)`, `d.SubidoPorId IS NULL`, `NOT d.FormatoEspecial`, `d.Estado='valido'` (retired included); selects `CASE WHEN requestInScope(referenceScope) THEN s.Id END` |

RNF-01: the other request id is nulled in SQL, so an out-of-scope id never
leaves the database. The coordinator passes `{ kind: "none" }` (literal
`false`), so it never gets a reference. Names are never selected.

### VS-4. Single-stream fingerprint at finalize (X1)

| Element | Choice |
|---|---|
| Port | `DocumentStore.readDigest(pathname, { headBytes, maxBytes }): Promise<{ size; head; sha256: string \| null } \| null>`; `readHead` stays (special-format attach keeps using it, no hash, X1) |
| Helper | `src/lib/intake/stream-digest.ts` `digestStream(stream, headBytes, maxBytes)`: one pass fills the head, counts bytes and feeds `createHash("sha256")` (`node:crypto`, flat memory); once the count exceeds `maxBytes` it cancels and returns `sha256: null` with the counted size |
| Adapters | Vercel: `get(..., { access: "private", useCache: false, token })` then `digestStream`; fake: `stream()` then `digestStream` |
| Finalize | `fingerprintStoredFile(pathname, store)` in `documentos.ts` reuses `refusalFor` on the counted size (never the blob metadata); accepted update sets `huellaSha256` |

| Option | Tradeoff | Decision |
|---|---|---|
| New port method, shared helper | One blob read, size from bytes | **Chosen** |
| Hash in extraction | Never runs where `EXTRACTION_API_URL` is empty | Rejected |
| `readHead` + second `stream()` | Two transfers, `stream()` may hit cache | Rejected |

### VS-5. Schema delta (migration 0013, S2)

`DocumentoRespaldo.HuellaSha256 char(64) NULL`;
`CK_Documento_Huella`: `HuellaSha256 IS NULL OR (Estado = 'valido' AND
HuellaSha256 ~ '^[0-9a-f]{64}$')`; `IX_Documento_Huella (HuellaSha256) WHERE
HuellaSha256 IS NOT NULL`. Generated only (step G1). Test
`src/db/migration-validation-signals.test.ts`: located by name, journal order,
column nullable, CHECK body, partial index, no `DROP`, no `UPDATE`.

### VS-6. Secretary UI (`review/[id]/signals-section.tsx`)

`SignalsSection({ signals: { data: SignalView | null; degraded } })`, rendered
right after the Extracted data section (`ExtractionSection`, per the spec), loaded before `recordRequestRead`. Degraded ->
`DegradedAlert`. Verdict: `role="status"` paragraph whose meaning is in its
text; existing warning/muted tokens only as reinforcement
(`docs/design-system.md`). Each signal is a `Fact`: label, outcome text, reason
text when not evaluable, evidence for the secretary (dates via `useDates`,
count/threshold, other request number only when present in data). A fixed note:
the suggestion does not change the request (RN-15). i18n es + en under
`review.signals.*` (`title`, `note`, `degraded`, `verdict.*`, `names.*`,
`outcomes.*`, `reasons.*`, `evidence.*`).

### VS-7. Coordination projection (S3)

Pure `toCoordinationView(report): SignalView` drops every evidence field
(outcome, reason and verdict only; never an RN-26 reference; no extracted data, consistent with
document-extraction). `coordination/[id]/page.tsx` loads with `referenceScope:
{ kind: "none" }` only for `kind === "escalation"` and renders the same
`SignalsSection`. Students: `getOwnRequestDetail` untouched; a structural test
asserts `requests/**` imports nothing from signals.

### VS-8. Fail-soft and ordering

A signals failure never blocks the detail, the decision panel or the audit read.
`loadSignals` never writes. The queue is untouched.

### VS-9. Extraction data for the 2026-11-03 system tests

| Option | Tradeoff | Decision |
|---|---|---|
| Local NuExtract at `127.0.0.1:8080` (`docs/setup-local.md`, `EXTRACTION_API_URL` in `.env.development.local`) | Real flow, no DB write beyond normal use | **Primary** |
| Local-only fixture script (excluded like `scripts/demo-reset.local.ts`) inserting `completada` rows, host-guarded to a disposable dev branch | Deterministic; DB write | Fallback, `[CONFIRM]`, never on validation branches |

Without either, RN-09/10/14 show `extraction_pending` and the verdict is
`inconclusive` (known limitation).

## Data Flow

```
Finalize (S2)
Student -> finalize -> finalizeDocument: claim row (tx)
                         -> store.readDigest -> digestStream (head, size, sha256)
                         -> refusalFor(size, head) -- refuse -> reject()
                         -> UPDATE valido + HuellaSha256 + audit (tx)

Read (S1/S2/S3)
page (requireRole, scope, getRequestDetail)
  -> loadSignals(id, referenceScope) -- Q1..Q5 --> evaluateSignals (pure)
  -> secretary: SignalView with evidence | coordinator: toCoordinationView
  -> recordRequestRead -> render SignalsSection (degraded -> DegradedAlert)
```

## File Changes

| File | Action | Slice |
|---|---|---|
| `src/lib/signals/{types,params,timing,rest-dates,issuer,verdict,evaluate}.ts` (+ tests), `display-only.test.ts` | Create | S1 |
| `src/lib/data/signals.ts` (+ test) | Create | S1 (Q5 in S2) |
| `review/[id]/signals-section.tsx` (+ test), `review/[id]/page.tsx` | Create / Modify | S1 |
| `i18n/{es,en}.json` | Modify | S1-S3 |
| `src/lib/intake/stream-digest.ts` (+ test), `ports.ts`, `adapters/vercel-blob-store.ts` (+ test), `fakes.ts` (+ test) | Create / Modify | S2 |
| `src/lib/data/documentos.ts` (+ test) | Modify | S2 |
| `src/db/schema.ts`, `drizzle/0013_*.sql` + `drizzle/meta/*` (generated), `src/db/migration-validation-signals.test.ts` | Modify / Create | S2 |
| `src/lib/signals/repeated-document.ts` (+ test) | Create | S2 |
| `src/lib/signals/coordination-view.ts` (+ test), `coordination/[id]/page.tsx` (+ test), `requests/**` structural test | Create / Modify | S3 |
| `docs/requirements.md` (RN-26, changelog), `docs/roadmap.md` row 5, `docs/pendientes-validacion-tesis.md` | Modify | S3 |

## Slice Plan (feature-branch-chain on `feat/validation-signals`, generated files excluded)

| Slice | Content | Estimate |
|---|---|---|
| S1 | VS-1 (four signals), VS-2, VS-3 Q1-Q4, VS-6, VS-8 | ~900 |
| S2 | VS-4, VS-5, RN-26, Q5, scope tests | ~650 |
| S3 | VS-7, student test, docs closeout | ~400 |

S1 has no schema and lands before the system tests.

## Testing Strategy (strict TDD, Vitest)

| Layer | What | Approach |
|---|---|---|
| Unit | RN-07 (deadline day vs next, weekend/holiday, 2028 -> `calendar_not_covering_year`, `reenviadaEn` ignored); RN-09 (days-only); RN-10 (adjacent union, gap, days-only uncovered); `normalizeIssuer`; RN-14 (2nd vs 3rd, other period, later requests ignored, two periods -> `no_period`); RN-26 (same request never, earlier only, NULL hash, mixed, null reference); verdict truth table; `digestStream` (chunked hash equals known digest, oversize cancels, empty); `toCoordinationView` strips evidence | Pure |
| Data | `loadSignals` assembly and degraded path; Q4/Q5 predicates rendered via `toSQL()` (earlier-only tuple, `CASE WHEN` scope, `none` -> `false`); finalize stores the hash, refuses oversize by counted bytes | Mocked db / SQL rendering (`extraction-sql.test.ts` pattern) |
| Real Postgres (opt-in) | `CK_Documento_Huella` accepts/rejects; partial index used by Q5 (EXPLAIN) | `intake-concurrency.integration.test.ts` pattern |
| Schema | Generated SQL by name | File read |
| UI | Three verdicts, reasons as text, degraded, evidence absent in coordination view, no state-change wording, es/en keys | Testing Library |
| Structural | Display-only (VS-2), students (VS-7) | Import scan |

## Threat Matrix

N/A: no new route, shell, subprocess, VCS/PR automation or executable-file
classification. The finalize change keeps the existing signature check on the
same bytes; size is enforced from the stream.

## Migration / Rollout

| Step | Tag | Command / check |
|---|---|---|
| G1 | `[LOCAL]` | `npm run db:generate -- --name validation_signals` (regenerate if another migration lands first) |
| P1 | `[READ-ONLY]` | Latest applied migration; `DocumentoRespaldo` columns |
| M1 | `[CONFIRM]` | `drizzle-kit migrate` over the direct URL, owner's explicit yes |
| V1 | `[READ-ONLY]` | Column, CHECK and index present; all hashes NULL |

Rollback: revert S3, S2, S1; if 0013 was applied, a `[CONFIRM]`
down-migration drops index, CHECK and column.

## Open Questions

- [ ] UAM legal review of hashing and cross-request comparison (PRIV).
- [x] Owner confirmed on 2026-11-02: the mixed hashed/NULL RN-26 rule (`absent`); the coordinator sees the verdict and never an RN-26 reference; RN-10 with a pending or failed document is `not_evaluable`; RN-14 counts `rechazada` and `devuelta` requests.
