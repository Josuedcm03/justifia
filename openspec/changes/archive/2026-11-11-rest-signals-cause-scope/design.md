# Design: Rest Signals Cause Scope

Binding inputs: `proposal.md`, `exploration.md`,
`docs/next-change-rest-signals-cause-scope.md`. Covers RF-05 (a), (b); RN-09,
RN-10, RN-15. Decisions are **D1..D8**. No Next.js API changes, no migration,
nothing persisted; the change runs no database command.

## Technical Approach

`readRequestBase` also reads `Solicitud.causa`; `loadSignals` passes it as
`SignalInput.causa`. `evaluateSignals` decides per cause whether RN-09/RN-10
run: for a cause without rest it emits `{ signal, outcome: "not_applicable" }`
in the same slot, so the five results keep their fixed order. `rest-dates.ts`
is untouched. `suggestVerdict` ignores `not_applicable`. Both screens share
`SignalFact`, which renders "No aplica" plus a muted explanation line.

## Architecture Decisions

| # | Decision | Rejected alternative | Rationale |
|---|---|---|---|
| D1 | Fourth outcome `not_applicable`, no `reason`, no `evidence` | Filter rn09/rn10 out of `results`; reuse `not_evaluable` with a new reason | Filtering hides why the signals are missing and breaks the five-results order. `not_evaluable` means missing input, would land in "Señales no evaluadas" and would keep every non-medical request `inconclusive` |
| D2 | The cut lives in `evaluate.ts`; evaluators are not called when the cause has no rest | Pass `causa` into `rest-dates.ts` | Keeps the RN-09/RN-10 evaluators pure and their tests unchanged; one decision point |
| D3 | `CAUSAS_CON_REPOSO` + `admitsRest(causa)` in `src/lib/intake/causes.ts` | Constant in `src/lib/signals/`; configuration table | D4 of intake: causes are code constants. RNF-14 (configurable table) belongs to change #8. `src/lib/signals/evaluate.ts` already imports `@/lib/intake/ports`, and `causes.ts` is pure (no `server-only`, no DB), so signals -> intake adds no new direction |
| D4 | Type-level restriction: the variant's `signal` is `"rn09" \| "rn10"` | Runtime guard or test only | Free compile-time guarantee; any attempt to mark RN-07/RN-14/RN-26 as not applicable fails `tsc` |
| D5 | `SignalInput.causa: Causa` is required | Optional with a default | A silent default would reintroduce the false RN-09 or hide it; required makes every caller explicit |
| D6 | `readRequestBase` throws `signals_request_incomplete` when `causa` is null or fails `isCausa` | New error code; default to `medica` | Same fail-loud path as missing dates; `loadSignals` already converts the throw into `{ data: null, degraded: true }`. DB checks `CK_Solicitud_Causa` and the presented-request check make it unreachable for presented requests |
| D7 | Verdict over applicable results: any `present` -> `review_carefully`; applicable non-empty and all `absent` -> `no_alerts`; else `inconclusive` | Count `not_applicable` as absent | Same result today, but "no alerts" must mean "every applicable signal was checked and is clean"; explicit filtering keeps it correct if a future cut removes more signals |
| D8 | Label `outcomes.not_applicable` + key `notApplicableNote` rendered as a muted line inside `SignalFact`, both audiences; extraction section unchanged | One long label; note in the extraction section | Short label matches the other outcomes; the coordinator already sees the cause (`coordination-sections.tsx:66`), so the line discloses nothing new |

## Data Flow

```
loadSignals ─> readRequestBase (+causa, fail-loud) ─> SignalInput{causa}
                                                          │
evaluateSignals: rn07 │ admitsRest(causa)? rn09/rn10 : not_applicable │ rn14 │ rn26
                                                          │
suggestVerdict(applicable only) ─> SignalReport ─┬─> SignalsSection (secretary)
                                                 └─> toCoordinationView ─> SignalsSection (coordination)
```

## Interfaces / Contracts

```ts
// causes.ts
export const CAUSAS_CON_REPOSO = ["medica", "maternidad_paternidad"] as const satisfies readonly Causa[];
export function admitsRest(causa: Causa): boolean;

// types.ts
type NotApplicableResult = { signal: "rn09" | "rn10"; outcome: "not_applicable" };
export type SignalResult = PresentAbsent | NotEvaluable | NotApplicableResult;
export type SignalViewResult = PresentAbsentView | NotEvaluable | NotApplicableResult;
export type SignalInput = { /* existing */ causa: Causa };
```

Every branch on `outcome` that must change:

| File | Change |
|---|---|
| `src/lib/signals/types.ts` | Variant in `SignalResult` and `SignalViewResult`; header comment |
| `src/lib/signals/evaluate.ts` | `results: SignalResult[]`; cut for rn09/rn10 |
| `src/lib/signals/verdict.ts` | Filter applicable before `some`/`every`; `notEvaluable` unchanged |
| `src/lib/signals/coordination-view.ts` | `projectResult` becomes an exhaustive `switch` (the current `else` literal no longer typechecks with the narrower `signal`) |
| `src/app/(dashboard)/review/[id]/signals-section.tsx` | `:118` evidence only for `present`/`absent`; render `notApplicableNote` when `not_applicable` |

`scripts/session-verify.local.ts` only reads `SignalReport` and compares
strings (`:104`, `:481`); it still typechecks and stays out of this change
(its expectations are updated after merge, brief §9.3).

i18n (`review.signals`, es + en, neutral Spanish, no voseo):
`outcomes.not_applicable` = "No aplica" / "Not applicable";
`notApplicableNote` = "La causa declarada no incluye reposo." / "The declared
cause does not include a rest period." (the line omits the "No aplica:" prefix
because the label already shows it).

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/intake/causes.ts` (+ `causes.test.ts`) | Modify / Create test | D3 |
| `src/lib/signals/{types,evaluate,verdict,coordination-view}.ts` | Modify | D1, D2, D4, D7 |
| `src/lib/data/signals.ts` | Modify | Select `causa`, D6, pass to input |
| `src/app/(dashboard)/review/[id]/signals-section.tsx` | Modify | D8 |
| `i18n/es.json`, `i18n/en.json` | Modify | Two keys each |
| Tests listed below | Modify | |
| `docs/requirements.md` | Modify | RN-09, RN-10 cause scope; history row 2026-11-11 with "Pendiente de sincronizar con la matriz de la tesis." |
| `docs/roadmap.md` | Modify | Row 15, `pendiente` |
| `openspec/changes/rest-signals-cause-scope/specs/*` | Created by sdd-spec | validation-signals, request-review, coordination-escalation deltas |

## Testing Strategy (strict TDD: each RED test before its code)

| Order | Layer | File | Cases |
|---|---|---|---|
| 1 | Unit | `src/lib/intake/causes.test.ts` | `admitsRest` true for medica, maternidad_paternidad; false for the other three |
| 2 | Unit | `src/lib/signals/verdict.test.ts` | not_applicable ignored in all-absent, not listed in `notEvaluable`, only not_applicable + not_evaluable -> `inconclusive` |
| 3 | Unit | `src/lib/signals/evaluate.test.ts` | `input()` defaults `causa: "medica"`; per cause rn09/rn10 slots; E-02 still present for medica; rn07/rn14/rn26 identical across causes; order kept |
| 4 | Unit | `src/lib/signals/coordination-view.test.ts` | Projects not_applicable as `{ signal, outcome }` |
| 5 | Data | `src/lib/data/signals.test.ts` | `BASE.causa`; it.each null/invalid causa -> degraded; non-rest cause reaches evaluator |
| 6 | i18n | `src/i18n/review-messages.test.ts` | Outcome list `:626` + `notApplicableNote`; same-keys and no-voseo tests cover the rest |
| 7 | Component | `signals-section.test.tsx` | Label and note shown, no evidence, both audiences |
| 8 | Integration (opt-in) | `validation-signals.integration.test.ts` | `addPresented({ causa })`, `addExtraction({ issueDate, restTo })`; fuerza_mayor with restTo < issueDate, issuer present, fingerprint without match -> rn09/rn10 not_applicable, verdict `no_alerts`. Runs on a throwaway Neon branch; creating and deleting it each need the user's explicit "yes" |

Then `npm run typecheck`, `npx eslint src`, `npm test`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file
classification, or process-integration boundary.

## Migration / Rollout

No migration required. Rollback: revert the merge commit on `main`; keep the
change branch.

## Open Questions

None blocking.
