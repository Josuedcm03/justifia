# Design: Normative Parameters (RNF-14)

Covers RNF-14; RN-01, RN-04, RN-07, RN-08, RN-13, RN-14, RN-23; RNF-01, RNF-06,
RNF-12; thesis CU-13, Anexo D Table D19. Decisions D1 to D8 of `proposal.md` are
closed. The contract is `specs/` (NP-1 to NP-17, NP-AUD-1 to NP-AUD-3 and the
consumer deltas). DB schema: YES (migration `0017`, table plus seeds only; the
document size CHECK is not changed).

> Scope cuts (owner, 2026-11-27, see `proposal.md`): no 25 MiB ceiling and no
> migration `0018` (A17 removed, A19 added); no two-step confirmation of every
> save (A18 revised: only deactivating a cause asks, in the existing alert
> dialog); no extra display on the page (default, range in words, per-year
> counts, current-year warning, "default in use", locked degraded forms); no
> 360/320 px or touch-target tests for the staff page; no mutation checks from
> slice 5 on; no per-family Postgres cases of the effect without redeploy (the
> owner system test is the proof); the work after slice 8 is two PRs (9: access
> and every server action; 10: page, four sections, menu entry, docs).

## Technical Approach

One table exactly per D19, one pure registry (key, Zod schema, code default), one
fail-soft loader read per request, one write path that reuses
`withCatalogWrite`. Pure rule functions stay synchronous and gain explicit
parameters; the async load happens once at the page, action or route boundary,
and pure adapters in `src/lib/parameters/derive.ts` turn the loaded values into
what each rule already expects (`NonWorkingDaysProvider` via `constantCalendar`,
`SignalParams`, deadline and filing rules, bytes). No cross-request cache, so a
saved value is seen by the next request on every instance without a deploy
(NP-5, NP-14).

## Architecture Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| A1 | `ParametroNormativo` exactly per D19; one row per key and effective date; `Valor jsonb` holds an integer, an array or an object (NP-1) | Typed table per family; extra `Version`/author columns | D19 and the owner decision are closed. Ranges live in the registry; author and time live in the audit row |
| A2 | Registry keys are the NP-2 codes (`plazo_remision_dias`, ...), a closed `as const` tuple; TS field names stay English | Free-form keys | A closed tuple makes an unknown key a compile error, lets the write refuse it and the loader ignore stray rows |
| A3 | Loader: one `SELECT DISTINCT ON ("Clave")` with `"VigenteDesde" <= $today` (Managua), then per-key `safeParse` of that row only; an invalid newest row yields the default, never an older row; a failed query yields every default and `degraded` (NP-4) | Per-key queries; scanning back to the newest valid row; throwing | One round trip served by the unique index; NP-4 forbids falling back to older rows |
| A4 | `getNormativeParameters = cache(...)` from React; no `unstable_cache`, no `use cache`, no tags | `unstable_cache` + `updateTag`/`revalidateTag(tag, profile)` | `cacheComponents` is off (`use cache` unavailable); `unstable_cache` is superseded in 16 (`02-guides/caching-without-cache-components.md`) and serves stale data across instances. React `cache()` dedupes inside one render (NP-5 "one read per render") and is a pass-through in route handlers and actions, so nothing survives a request |
| A5 | Seeds dated `'2026-01-01'` (fixed literal, not after the migration date), `ON CONFLICT ("Clave","VigenteDesde") DO NOTHING` (NP-16) | `CURRENT_DATE` | Deterministic, in force at once, not tied to the database time zone; idempotent if re-run |
| A6 | Write = `INSERT ... ON CONFLICT ("Clave","VigenteDesde") DO UPDATE SET "Valor" = excluded."Valor"` with `VigenteDesde = today` (NP-3) | Read-then-update/insert; delete-then-insert | One statement gives "same day replaces, otherwise insert"; earlier rows untouched; no future date is ever written |
| A7 | Writes run inside `withCatalogWrite` as is (same advisory lock key `5005001`, same busy mapping, audit as last statement) (NP-9) | A second lock key and helper | Proposal decision; parameter writes are rare; no new mechanism. Last write wins, each save audited |
| A8 | Audit: exactly one new action `parametro.actualizado` (last in `AUDIT_ACTIONS`), one new entity type `Parametro`, `entidadId` null, payload exactly `{ clave, antes, despues }` for every key; the calendar payload lists ISO dates only (NP-AUD-1 to 3) | Per-family or per-date codes; row `Id` as entity id; descriptions in the payload | The spec's closed set; the key identifies the parameter; descriptions are free text, which NP-AUD-3 bars |
| A9 | `antes` is the effective value read under the lock (stored, or the default when no valid row is in force); a validated value equal to it is `unchanged`: no row, no audit, "no changes" message (NP-9, NP-AUD-3) | `antes` = raw stored row | The audit states what the system applied before and after |
| A10 | `SignalParams`, `DEFAULT_SIGNAL_PARAMS` and every `issuer.ts` export keep their shape and values; RN-07 days travel as a separate `TimingParams` argument | Adding a field to `SignalParams` | A teammate's report reads these (and keeps its own defaults, per spec out-of-scope); a new required field would break their literals. Registry defaults for the threshold and the map point at `DEFAULT_SIGNAL_PARAMS` |
| A11 | `loadSignals` resolves params, timing and calendar from the loader when the caller passes none (no longer from constants) | Every caller passes them | The two pages and `rf-14-support.ts` keep their calls; tests still inject; no constant path remains (NP-15) |
| A12 | Pure functions take the value as a required argument (no default) | Optional argument defaulting to the old constant | A forgotten call site is a compile error; the NP-15 structural test pins that `BUSINESS_DAYS_TO_REMIT`, `LATE_WINDOW_DAYS`, `MAX_DOCUMENT_BYTES` and the `calendar` export no longer exist and that rule modules import no registry default |
| A13 | Copy takes values: components pass `{ days, size }` to every `t(error.key, values)` from a server-provided `limits` prop (NP-17) | Extending `FieldError` with values | Error keys stay parameterless on the wire; next-intl ignores unused values; the hints already take `{size}` |
| A14 | Corrections: neither RN-23 nor the active-cause rule applies; any of the five codes is accepted on a returned request (`justification-intake` notes, NP-13) | Applying the cause rule to corrections | The spec refuses deactivated causes for drafts only; the correction form still offers the active causes plus the request's current one |
| A15 | Calendar coverage is derived: `coversYear(y)` is true when the list holds at least one date of `y`; unchanged `constantCalendar` semantics (NP-10) | A stored list of covered years | Matches the spec; queue note and RN-07 `not_evaluable` keep their meaning |
| A16 | Cross-key rule `alerta_dias < plazo_remision_dias` checked by the write under the lock against the merged effective values; refused with a field error, nothing written (NP-2 scenario) | Cross-key fallback in the loader | Per-key fallback stays simple; an inconsistent pair can only come from manual SQL and only degrades the badge |
| A17 | Removed (scope cut 2026-11-27). Was: size ceiling 25 MiB enforced three times (registry max, `CK_Documento_Tamano` through migration `0018`, `DOCUMENT_BYTES_CEILING`). Replaced by A19 | | RNF-14 asks only that a change of the maximum size needs no deploy; raising it above 10 MiB is not needed for that |
| A18 | Revised (scope cut 2026-11-27). Each section is one form saved as a whole value (calendar list, causes list, map, scalars) and a save is submitted directly: no two-step confirmation, no hidden `confirmado=1`, no before/after list, no `unconfirmed` outcome. Only a save that deactivates a cause asks first, in the existing `AlertDialog` primitive (`src/components/ui/alert-dialog.tsx`, the dialog of `DecisionDialog` for rejecting a request and of `ActiveToggle` for deactivating a record), naming the cause; cancel submits nothing and keeps the typed values (NP-8) | The inline two-step confirmation of every save with a server marker (removed: RNF-12 asks a confirmation only to reject a request and to deactivate a record); per-date add/remove actions | One audit row per key per save (NP-AUD-2: a calendar save adding two dates and removing one is one row); no new primitive |
| A19 | The registry range of `tamano_maximo_mib` is 1 to 10 and its maximum is pinned to the existing check: a source-scan test asserts registry maximum in MiB times 1 048 576 equals the number in `CK_Documento_Tamano` of `src/db/schema.ts` (10 485 760); no migration (NP-2, NP-16) | A 25 MiB ceiling and migration `0018` (A17) | The database check already is the technical bound; the test keeps the range and the check from drifting apart |

## Store and migrations

`src/db/schema.ts`:

```ts
export const parametroNormativo = pgTable(
  "ParametroNormativo",
  {
    id: bigint("Id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    clave: varchar("Clave", { length: 60 }).notNull(),
    valor: jsonb("Valor").notNull(),
    vigenteDesde: date("VigenteDesde", { mode: "string" }).notNull(),
  },
  (t) => [unique("UQ_ParametroNormativo_Clave_Vigencia").on(t.clave, t.vigenteDesde)],
);
```

**`0017_normative_parameters`** (S1), produced as 0014 to 0016 were:
`npm run db:generate -- --name normative_parameters` (drizzle-kit reads
`schema.ts` only, no database connection) writes the SQL, `meta/0017_snapshot.json`
and the journal entry. Then, hand-appended below the generated `CREATE TABLE`
after a `--> statement-breakpoint` and a comment (as in 0014), one
`INSERT INTO "ParametroNormativo" ("Clave","Valor","VigenteDesde") VALUES ...
ON CONFLICT ("Clave","VigenteDesde") DO NOTHING;` with nine rows, one per NP-2
key (`plazo_remision_dias`, `alerta_dias`, `presentacion_tardia_dias`,
`ventana_presentacion_dias`, `umbral_reincidencia`, `tamano_maximo_mib`,
`calendario`, `causas`, `tipo_documento_causa`), each with its registry default,
dated `'2026-01-01'`. Before generating, rebase on `main` and confirm `0017` is
free; if a teammate took it, regenerate (tests locate by name, never by number).

**No second migration.** Migration `0018_document_size_ceiling` (a 25 MiB
`CK_Documento_Tamano`) was removed by the scope cut of 2026-11-27. The check keeps
`"TamanoBytes" > 0 AND "TamanoBytes" <= 10485760`. In slice 7, when
`MAX_DOCUMENT_BYTES` leaves `src/lib/intake/limits.ts`, `src/db/schema.ts` keeps
the same check with the literal 10485760, and `npm run db:generate` must report no
schema change (A19).

Migration test (`src/db/migration-normative-parameters.test.ts`), pattern of
`migration-escalation-otro.test.ts`: located by name, journal entry once, right
after its predecessor, `when` above 0016's `1795216905153`; exact column set of
D19 (NP-1); 0017 alters or drops no existing table or column; seed `INSERT` holds
exactly the nine keys with values equal to `PARAMETER_REGISTRY` defaults (parsed
from the SQL). The generated snapshot JSON is excluded from the authored line
budget.

## Registry: `src/lib/parameters/registry.ts` (pure, no `server-only`)

| Clave | Field | Schema | Range | Default (source) |
|---|---|---|---|---|
| `plazo_remision_dias` | `remissionBusinessDays` | JSON integer | 1-10 | 2 (RN-08) |
| `alerta_dias` | `alertBusinessDays` | JSON integer | 0-10, `< plazo_remision_dias` at write | 1 (RN-08, D4) |
| `presentacion_tardia_dias` | `lateFilingBusinessDays` | JSON integer | 1-10 | 2 (RN-07, D3) |
| `ventana_presentacion_dias` | `filingWindowDays` | JSON integer | 1-365 | 30 (RN-23) |
| `umbral_reincidencia` | `issuerRecurrenceThreshold` | JSON integer | 2-20 | `DEFAULT_SIGNAL_PARAMS` (3, RN-14) |
| `tamano_maximo_mib` | `maxDocumentMib` | JSON integer | 1-10 (slice 1 built 1-25; slice 7 lowers it, A19) | 10 (RN-04, D6) |
| `calendario` | `nonWorkingDays` | array of `{ fecha: real ISO date, descripcion: trimmed string 1-120 or null }` | no duplicate `fecha`; stored ascending; at most 1000 entries (input bound) | the 30 validated 2026/2027 dates (moved from `intake/calendar.ts`) (NP-10) |
| `causas` | `causes` | array of `{ codigo: Causa, activa: boolean, posicion: 1-5 }` | exactly the five codes once each, positions a permutation of 1-5, at least one `activa`; stored by `posicion` | `CAUSAS` order, all active (RN-01, D1, NP-11) |
| `tipo_documento_causa` | `documentTypeCauses` | strict object with every `TipoDocumento`, unique `Causa` arrays, `otro` exactly `[]` | | `DOCUMENT_TYPE_CAUSES` (RN-13, NP-12) |

Scalar schemas are `z.number().int().min().max()` on the parsed JSON, so `2.5`,
`"2"`, `true` and `null` fail (NP-2); the form action converts typed digits to
numbers before validation and reports "not a whole number" otherwise.

```ts
export const PARAMETER_KEYS = [/* the nine claves above */] as const;
export type ParameterKey = (typeof PARAMETER_KEYS)[number];
export type NormativeParameters = {
  remissionBusinessDays: number; alertBusinessDays: number;
  lateFilingBusinessDays: number; filingWindowDays: number;
  issuerRecurrenceThreshold: number; maxDocumentMib: number;
  nonWorkingDays: readonly NonWorkingDay[]; causes: readonly CauseSetting[];
  documentTypeCauses: DocumentTypeCauses;
};
export const PARAMETER_REGISTRY: {
  [K in ParameterKey]: { field: keyof NormativeParameters; schema: z.ZodType;
    default: unknown; range?: { min: number; max: number } };
};
export const DEFAULT_PARAMETERS: NormativeParameters;
export function resolveParameters(rows: readonly { clave: string; valor: unknown }[]):
  { values: NormativeParameters; fallback: readonly ParameterKey[] };
```

`resolveParameters` is pure: unknown claves ignored, a missing or invalid key
takes its default and joins `fallback`. `src/lib/intake/calendar.ts` and
`calendar.test.ts` (real-clock staleness test) are deleted; the list moves to
`src/lib/parameters/defaults.ts` with its descriptions.

## Loader: `src/lib/parameters/loader.ts` (`server-only`)

```ts
export type ParametersRead = {
  values: NormativeParameters; fallback: readonly ParameterKey[]; degraded: boolean;
};
export async function readInForce(exec: Executor, today: string):
  Promise<{ clave: string; valor: unknown }[]>;           // DISTINCT ON query
export async function loadNormativeParameters(now: Date): Promise<ParametersRead>;
export const getNormativeParameters = cache(
  (): Promise<ParametersRead> => loadNormativeParameters(new Date()),
);
```

`today = managuaToday(now)`. Logs only `parameter_invalid { clave, code }` and
`parameters_read_failed { code: error.name }`, never a value (NP-4). No role
check (NP-6: consumers are not gated). Never at module scope.

`src/lib/parameters/derive.ts` (pure): `calendarOf(p)` (groups by year,
`constantCalendar`), `deadlineRulesOf(p)` (`{ remissionBusinessDays,
alertBusinessDays }`), `timingParamsOf(p)`, `signalParamsOf(p): SignalParams`,
`filingRulesOf(p)` (`{ windowDays, selectableCauses }`), `activeCausesOf(p)`
(stored order), `maxDocumentBytesOf(p)` (`mib * 1_048_576`), `intakeLimitsOf(p)`
(`{ filingWindowDays, maxDocumentMib }` for client props).

## Write path: `src/lib/parameters/write.ts` (`server-only`)

```ts
export type ParameterChange = { [K in ParameterKey]: { clave: K; valor: unknown } }[ParameterKey];
export type AppliedChange = { clave: ParameterKey; antes: unknown; despues: unknown };
export type ParameterWriteResult =
  | { kind: "updated"; changes: readonly AppliedChange[] }
  | { kind: "unchanged" }
  | { kind: "invalid"; clave: ParameterKey; reason: "schema" | "alert_not_below_remission" };
export async function writeParameters(
  tx: Transaction, changes: readonly ParameterChange[], today: string,
): Promise<ParameterWriteResult>;
```

Order inside `withCatalogWrite(actorId, work, parameterWriteEvents)`: lock;
`readInForce(tx, today)` and `resolveParameters` give the effective values;
refuse a clave outside the registry; re-validate each change with its schema
(fail loud on the data side too); the cross-key rule on the merged values; drop
changes equal to the effective value (canonical JSON after schema
normalisation); for each remaining one the upsert of A6. `parameterWriteEvents`
(in `src/lib/audit/events.ts`) returns one event per applied change, `[]`
otherwise, exhaustive `never` default.

## Consumers

| Rule | Pure function (new signature) | Boundary that loads |
|---|---|---|
| RN-08 deadline, alert | `deadlineOf(start, calendar, businessDays)`; `deadlineStatus(start, today, calendar, rules: DeadlineRules)` (`remaining <= rules.alertBusinessDays`); `BUSINESS_DAYS_TO_REMIT` removed | `listReviewQueue(scope, now, calendar, rules)`: `review/page.tsx`; detail badge: `review/[id]/page.tsx` |
| RN-07 | `evaluateLatePresentation(input, calendar, timing: TimingParams)`; `evaluateSignals(input, params, calendar, timing)` | `loadSignals` (A11) |
| RN-14, RN-13 | unchanged evaluators; `SignalParams` from `signalParamsOf` | `loadSignals` (A11) |
| Calendar | `NonWorkingDaysProvider` from `calendarOf`; `pausedStartOnAnswer` unchanged (stored `PlazoInicioEn` never recomputed) | the two review pages, `coordination/[id]/actions.ts` (answer pause), `loadSignals` |
| RN-23 | `earliestAllowedEndDate(today, windowDays)`, `isEndWithinWindow(end, today, windowDays)`; `validateSubmission(input, today, rules: FilingRules, options?)`; `makeDetailsStepSchema(today, rules: FilingRules, { filingWindow })` | `step-actions.ts saveDetails`, `requests/new/actions.ts submitRequestAction`; `solicitud-correction.ts` passes `filingWindow: false` |
| RN-01 causes | `causeErrors(causa, selectable)`: not one of the five, `causa_invalid`; one of the five but not selectable, new `causa_inactive`; the schema refines the same way. Drafts: `selectable` = active causes; corrections: all five (A14) | same |
| RN-04 size | `inspectStoredFile(path, store, maxBytes)`, `fingerprintStoredFile(path, store, maxBytes)`, `refusalFor(head, maxBytes)`; `finalizeDocument` and `attachSpecialFormat` inputs gain `maxBytes` | `api/intake/upload-token/route.ts` and `api/review/special-format-token/route.ts` inside `onBeforeGenerateToken`; the finalize action and the special-format attach action |

Client: `requests/new/page.tsx` and `requests/[id]/correct/page.tsx` pass
`limits: IntakeLimits` and `causes: readonly Causa[]` through `flow-steps.tsx`
to `cause-dates-step.tsx` (active causes in stored order; the correction page
adds the request's current cause; a draft whose cause is inactive shows no
selection and the `causa_inactive` alert), `documents-step.tsx` (pre-check and
hint) and `review-step.tsx` (error values). `review/[id]/page.tsx` passes
`maxDocumentBytes` to `special-format-upload.tsx`. Copy reworded with values:
`intake.errors.too_large` (`{size}` MB), the special-format `too_large`,
`intake.errors.end_too_old` (`{days}`), new `intake.errors.causa_inactive`
("no longer available, choose another"), `review.queue.dueSoon` (ICU plural on
`{days}`), in both catalogs; no message keeps a literal 30 or 10 as a limit.
`MAX_DOCUMENT_BYTES` is removed from `limits.ts`; `schema.ts` keeps the check
with the literal 10485760 (A19, no migration).

## Access, page and actions

`src/lib/auth/permissions.ts`: `rolesQueGestionanParametros = ["secretaria"] as
const satisfies readonly RolUsuario[]` and `canManageParameters(rol)`, the
pattern of `canManageEnrollments`. `src/lib/auth/parameter-access.ts`
(`server-only`): `requireParameterAccess(): Promise<{ session; actorId }>`,
copy of `requireDocenteAccess` (role first, subject check, no database read, so
a secretaria with no `Facultad` passes). Nav: last child of `administration`,
after Users, `{ key: "parameters", href: "/parameters", icon:
SlidersHorizontal, visibleTo: canManageParameters }` (prefetch allowed, not
audited); `nav.parameters` is "Parámetros normativos" / "Normative parameters".
Matrix (`src/test/access/matrix-table.ts`): `"(dashboard)/parameters/page.tsx":
row(SECRETARIA)` and the actions row with every export, each in the slice that
adds the file.

`src/app/(dashboard)/parameters/`:

| File | Content |
|---|---|
| `actions.ts` (slice 9) | `saveScalarParametersAction`, `saveCalendarAction`, `saveDocumentTypeCausesAction`, `saveCausesAction`; each `(_prev: ParameterFormState, formData)`; the four actions land together, before any page |
| `page.tsx` (slice 10) | Guard first; `loadNormativeParameters(new Date())`; `PageHeader` (one `h1`); one note on effect (NP-13); the four sections; writes nothing. No `DegradedAlert`, no locked forms, no "default in use" badge (scope cut) |
| `scalars-form.tsx` | Six number inputs (Form pattern); each shows the value in force only; errors state the allowed range (NP-7); a press saves directly |
| `calendar-section.tsx` | Editable list in a table card (add a row with date and optional description, mark a row removed); one save of the whole list. No per-year badges and no current-year warning (scope cut) |
| `type-causes-section.tsx` | Checkbox-group matrix, one `fieldset` per document type; `otro` row has no editable cell and states it corresponds to no cause |
| `causes-section.tsx` and `deactivate-cause-dialog.tsx` | The five causes in stored order: active checkbox, move up/down buttons (`lg`); no add, rename or delete control. A save that unchecks an active cause opens the existing `AlertDialog` primitive naming the cause (A18); confirm submits the form once, cancel keeps the typed values and calls no action |
| `confirm-changes.tsx` | Removed (scope cut 2026-11-27, A18): no two-step confirmation of every save |

Each action, in order: `requireParameterAccess()` (first await, before the body
is read); translations; Zod parse of the closed field set, every field error at
once with the allowed range in the message, submitted values echoed back;
`today = managuaToday(new Date())`;
`withCatalogWrite(actorId, tx => writeParameters(tx, changes, today),
parameterWriteEvents)`; switch: `updated` revalidates `/parameters` and reports
`saved`; `unchanged` "no changes"; `invalid` field error; `CatalogBusyError`
"busy, nothing was saved, try again"; other throw `parameters.errors.unexpected`.
Busy is only reachable after the guard (NP-9). Only existing tokens, errors tied
by `aria-describedby` with `role="alert"`; no 360/320 px or touch-target
assertions for this staff page (scope cut). Copy under `parameters.*` and
`nav.parameters`, both catalogs, neutral Spanish.

## Audit

`AUDIT_ACTIONS` gains `parametro.actualizado` at the end (50 in total);
`AuditEntityType` gains `"Parametro"`. Union member: `{ accion:
"parametro.actualizado"; entidadTipo: "Parametro"; entidadId: null; datos:
ParameterChangedPayload }` with `ParameterChangedPayload = { clave:
ParameterKey; antes: AuditParameterValue; despues: AuditParameterValue }`.
Builder `parameterChangedEvent(change)` maps the value per key: scalars are the
integers; `causas` the list of `{ codigo, activa, posicion }`;
`tipo_documento_causa` the type-to-codes table; `calendario` the ISO date list
only (`descripcion` dropped by the builder, so it cannot reach `Datos`).
`parameterWriteEvents(result)` emits one per applied change. The actor is the
session user passed to `withCatalogWrite`. No migration (no CHECK on `Accion`
or `EntidadTipo`; `EntidadId` is nullable).

## File Changes

| File | Action |
|---|---|
| `src/db/schema.ts`, `drizzle/0017_normative_parameters.sql`, `drizzle/meta/*` | Modify / Create (generated); `schema.ts` is touched again in slice 7 only to hold the literal 10485760 in the unchanged size check (no migration) |
| `src/lib/parameters/{registry,defaults,derive,loader,write}.ts` | Create (`registry.ts`: maximum of `tamano_maximo_mib` lowered from 25 to 10 in slice 7) |
| `src/lib/parameters/size-ceiling.test.ts` | Create (slice 7: registry maximum in MiB times 1 048 576 equals the check in `src/db/schema.ts`) |
| `src/lib/intake/{business-days,dates,submission,limits}.ts`, `src/lib/validations/solicitud.ts` | Modify |
| `src/lib/intake/calendar.ts`, `src/lib/intake/calendar.test.ts` | Delete |
| `src/lib/signals/{timing,evaluate,params}.ts`, `src/lib/data/{signals,revision-queue,documentos,special-format,solicitud-correction}.ts` | Modify (`params.ts`: comment only) |
| `src/app/api/intake/upload-token/route.ts`, `src/app/api/review/special-format-token/route.ts` | Modify |
| `src/app/(dashboard)/review/{page,[id]/page,[id]/special-format-upload,[id]/actions}.tsx/ts`, `coordination/[id]/actions.ts` | Modify |
| `src/app/(dashboard)/requests/new/{page,flow-steps,cause-dates-step,documents-step,review-step,step-actions,actions}`, `requests/[id]/correct/page.tsx` | Modify |
| `src/lib/audit/{types,events}.ts`, `src/lib/auth/permissions.ts`, `src/lib/navigation.ts` | Modify |
| `src/lib/auth/parameter-access.ts`, `src/app/(dashboard)/parameters/**` | Create |
| `src/test/access/matrix-table.ts`, `i18n/{es,en}.json`, `docs/{roadmap,requirements}.md` | Modify |

## Testing Strategy (strict TDD: each test fails first)

| Layer | Files | What |
|---|---|---|
| Migration | `migration-normative-parameters.test.ts` | D19 columns, additive 0017, journal, seeds equal registry defaults |
| Unit | `parameters/registry.test.ts` | NP-2 range table, integers only, unknown key, defaults table, causes and map validation tables (NP-11, NP-12), calendar invalid entries and 120-char description (NP-10), defaults equal `DEFAULT_SIGNAL_PARAMS` and `DOCUMENT_TYPE_CAUSES` |
| Unit | `parameters/{loader,derive,write}.test.ts` | NP-4 per-key table (newest invalid gives the default), future row ignored, failed read fail-soft and log content; coverage by year; write order, unknown key, cross-key scenario, unchanged, upsert SQL text, Managua date at 03:00 UTC (NP-3) |
| Unit | `business-days`, `timing`, `evaluate`, `dates`, `submission`, `validations/solicitud`, `documentos`, `special-format` tests | Each rule with non-default values; drafts refuse `causa_inactive`, corrections accept it; window off for corrections |
| Route/action | both token route tests, `step-actions`, `requests/new/actions`, `review/[id]/actions`, `parameters/actions.test.ts` | Loader value reaches `maximumSizeInBytes` and `maxBytes`; guard before body and before busy; every outcome; revalidated path; a save is accepted with no confirmation field |
| Component | `documents-step`, `special-format-upload`, `cause-dates-step`, `review-step`, `review/page`, `parameters/*.test.tsx` | Props drive pre-check, hints and copy with values; stored order; the deactivation dialog (confirm submits once, cancel keeps values and calls no action, a save that deactivates nothing opens no dialog); one `h1`; no width or touch-target assertions on the staff page |
| Structural | `parameters/no-constants.test.ts`, `parameters/size-ceiling.test.ts`, `permissions.test.ts`, `navigation.test.ts`, `audit/types.test.ts`, `catalog/audit-leak.test.ts`, i18n parity, access matrix | NP-15 scan; no `unstable_cache`, `use cache`, module store or timer (NP-5); registry maximum pinned to the size check (A19); secretaria only; nav entry last in Administración; 50 codes, `Parametro` added |
| Postgres | `src/lib/data/integration/normative-parameters.integration.test.ts`, gate `guard.ts` | Below |

Postgres suite (disposable Neon branch with 0017 applied; applying it there is
itself a schema command and needs the owner's yes). The case groups keep their
numbers; groups 2 and 6 were removed by the scope cuts:

1. NP-1 constraints (duplicate key and day, 61-char key); seeds read back as
   stored values equal to the defaults, `fallback` empty (NP-16).
2. Removed (scope cut 2026-11-27): the NP-14 case per key (write through
   `writeParameters`, then call the consumer in the same process). The effect
   without a redeploy is proven by the owner system test and the structural
   NP-5 scan; consumers are proven by unit tests with the loader value injected.
3. NP-3 history: first save keeps the seed, same-day second save leaves one row,
   yesterday plus today gives two; NP-4 latest-not-after-today with rows at -10,
   -1 and +1 days; per-key fallback rows; unknown key ignored.
4. NP-9 and NP-AUD-2: two keys in one save give two rows; unchanged gives none;
   an actor id that does not exist fails the audit insert and leaves no
   parameter row; busy while a third connection holds the lock writes nothing;
   same-day second save payload `antes` equals the first `despues`; sentinel
   description absent from every payload.
5. NP-13: stored 8 MiB document still listed after the limit is lowered to 5;
   stored `PlazoInicioEn` byte-identical after a calendar change.
6. Removed (scope cut 2026-11-27): the `TamanoBytes` ceiling cases of migration
   `0018`.

Cleanup deletes rows whose `VigenteDesde` is not the seed date and restores the
seeds; audit rows stay (append-only). **No-redeploy proof**: the owner system
test changes each family through the screen in one running build and observes it
on the next request (thesis 5.3 Table 16, verification by inspection); the
structural test proves no module-level memo; case 4 asserts that a saved
`alerta_dias` is read by the next request scope in the same process.

## Threat Matrix

Shell, subprocess, VCS/PR automation, executable-file classification and
process integration: N/A, none is touched. Application boundaries, all with RED
tests: direct POST or GET by every non-secretaria identity (guard first, no
read, matrix, busy not reachable); mass assignment of a key outside the registry or the action's closed set;
out-of-range, non-integer or malformed values (Zod in the action and again in
the write); a causes list that is not a permutation or has no active cause;
actor forging (session only); audit leak (closed payloads, calendar dates only);
unbounded input (calendar at most 1000 entries, loops bounded).

## Migration / Rollout

Tracker `feat/normative-parameters`; Feature Branch Chain: PR 1 targets the
tracker, each later PR targets the previous slice branch.

The original design grouped the work in five slices; `tasks.md` cuts it into ten
numbered slices (the repository precedent measured test-heavy slices at 2x to 3x
of the raw figure). After the scope cuts of 2026-11-27 the plan is:

| PR | Branch (suffix of `feat/normative-parameters-`) | Content | Est. lines |
|---|---|---|---|
| 1 | `1-registry` | Schema, 0017 (generated + seeds), registry, defaults, migration test | about 1000 (done) |
| 2 (2a, 2b) | `2-loader`, `2b-pg-suite` | Loader, derive adapters, Postgres read suite (cases 1 and 3, read part) | about 1750 (done) |
| 3, 4 | `3-on-read-signals`, `4-on-read-deadlines` | RN-07, RN-13, RN-14 through the loader; RN-08 deadline and alert, calendar call sites, delete `calendar.ts`, `dueSoon` copy | about 1760 (done) |
| 5 | `5-filing-window` | RN-23 window, server and client values | about 900 |
| 6 | `6-causes` | Active-cause filter and draft refusal | about 400 |
| 7 | `7-size` | Size in routes, data, actions and client props; registry maximum lowered to 10 and pinned to the database check (A19) | about 950 |
| 8 | `8-audit-write` | Audit action and builders, `writeParameters`, Postgres cases 3 (write part), 4, 5 | about 930 |
| 9 | `9-actions` | Predicate, guard, all four server actions with tests and copy | about 1400 (owner pre-approved up to 1500) |
| 10 | `10-page` | Page, four sections, menu entry, deactivation dialog, docs | about 1400 (owner pre-approved up to 1500) |

After PRs 1-7 alone the defaults behave as today. Nothing is editable by a user
until PR 10.

**Merge gate** (tracker to `main`, which deploys): 1) every suite green,
Postgres suite and owner system test (seven steps) on a fresh disposable branch;
2) with the owner's explicit yes for that command, `0017` applied to production
BEFORE the merge (additive, so old code is unaffected); 3) read-only check that
the nine seed rows exist. Merging before 0017 keeps reads on defaults but every
save fails.

**Rollback**: revert PRs in reverse order or the tracker merge and redeploy;
the table is ignored by old code. Audit rows stay.

## Residual risks

- The maximum size can be lowered but not raised above 10 MiB without a
  migration of `CK_Documento_Tamano` (out of scope, A17 removed).
- An upload token issued before the limit is lowered keeps the old limit until
  it expires (NP-13); finalize then refuses with the current-limit copy.
- Shared catalog lock: a long import can make a parameter save report busy.
- Corrections accept a deactivated cause by spec assumption (A14).

## Open Questions

None blocks.
