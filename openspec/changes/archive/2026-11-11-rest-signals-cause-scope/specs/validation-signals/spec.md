# Delta for Validation Signals

Covers RF-05 (a), (b); RN-09, RN-10, RN-15 (`docs/requirements.md`). Touches
no schema and no persisted data (outcomes stay computed on read). Roadmap #15.

Terms added: "rest-admitting cause" = a declared cause (RN-01) in the closed
set {`medica`, `maternidad_paternidad`}; "applicable signal" = a signal whose
outcome is not `not_applicable`; "declared cause" = the `causa` of the request.
Not to be confused with the document extraction state `no_aplica`
(special-format documents), which is unrelated and unchanged.

Naming decision: the requirement "Three outcomes with a closed set of reasons"
is RENAMED to "Four outcomes with a closed set of reasons". Its only
cross-reference by title (inside "Incoherent dates, RN-09") is updated in the
same delta. "Three-state suggested verdict" keeps its name: the verdict still
has three states.

Known limitation (documented, not a defect): a request with a rest-admitting
cause but a non-medical document still evaluates RN-09 and RN-10 on whatever
the extraction produced; that case belongs to RN-13 and RF-14 (out of scope).
The list of rest-admitting causes is a code constant; its configuration is
RNF-14 (roadmap #8).

## ADDED Requirements

### Requirement: Rest signals apply only to causes that admit rest (RF-05 a, RF-05 b, RN-09, RN-10)

RN-09 and RN-10 MUST be evaluated only when the declared cause of the request
is a rest-admitting cause. For any other declared cause (`actividad_representativa`,
`intercambio_academico`, `fuerza_mayor`) both signals MUST be `not_applicable`,
whatever the extracted data, including a rest period ending before the issue
date, days-only, missing, pending or failed extraction. The cause cut MUST
precede any reading of extraction: it MUST NOT change, hide or delete the
extracted data. RN-07, RN-14 and RN-26 MUST be evaluated identically for every
cause. The system MUST always return the five results in the fixed order RN-07,
RN-09, RN-10, RN-14, RN-26. A presented request whose declared cause is missing
or outside the five causes of RN-01 MUST make the signals read fail, with no
default cause assumed; the existing fail-soft degraded notice of the signals
section (see `request-review`) then applies and no verdict is shown.

#### Scenario: Non-rest causes make RN-09 and RN-10 not applicable (table-driven)

| Declared cause | RN-09 | RN-10 |
|---|---|---|
| `fuerza_mayor` | `not_applicable` | `not_applicable` |
| `actividad_representativa` | `not_applicable` | `not_applicable` |
| `intercambio_academico` | `not_applicable` | `not_applicable` |

- GIVEN a presented request with that cause, absence 2026-11-02 to 2026-11-03 and a `completada` extraction with issue date 2026-11-04 and rest 2026-11-02 to 2026-11-03
- WHEN the signals are evaluated
- THEN RN-09 and RN-10 are as shown, with no reason and no evidence, and "fechas incoherentes" is not raised

#### Scenario: Cut precedes extraction state

- GIVEN a `fuerza_mayor` request whose only document has extraction `pendiente`, `fallida` or no row
- WHEN the signals are evaluated
- THEN RN-09 and RN-10 are `not_applicable`, not `not_evaluable`

#### Scenario: Medical cause keeps RF-05 b (E-02, SC-02)

- GIVEN a `medica` request whose document has issue date 2026-07-12 and rest ending 2026-07-10
- WHEN the signals are evaluated
- THEN RN-09 is `present`

#### Scenario: Maternity or paternity cause still evaluates both

- GIVEN a `maternidad_paternidad` request with absence Mon 2026-10-05 to Fri 2026-10-09 and one `completada` document with issue date 2026-10-05
- WHEN the rest period is 10-05 to 10-09, then 10-05 to 10-07
- THEN RN-09 is `absent` in both cases, RN-10 is `absent` then `present`, and neither is `not_applicable`

#### Scenario: RN-07, RN-14 and RN-26 do not depend on the cause (table-driven)

| Declared cause | RN-07 (first presented after the deadline) | RN-14 (3rd request, same issuer and period) |
|---|---|---|
| each of the five causes | `present` | `present` |

- GIVEN requests that meet the row, evaluated once per cause
- WHEN the signals are evaluated
- THEN RN-07 and RN-14 are as shown for every cause, and RN-26 follows its own rule

#### Scenario: Five results in fixed order for every cause

- GIVEN a request of any cause
- WHEN the signals are evaluated
- THEN the results are RN-07, RN-09, RN-10, RN-14, RN-26 in that order, including when two are `not_applicable`

#### Scenario: Missing or invalid cause fails loud (table-driven)

| Declared cause | Result |
|---|---|
| null | signals read fails, no outcome, no verdict |
| a value outside the five causes | signals read fails, no outcome, no verdict |

- GIVEN a presented request with the cause in the row
- WHEN the signals are read
- THEN the read fails and the staff detail shows the degraded notice instead of a verdict

## RENAMED Requirements

### Requirement: Three outcomes with a closed set of reasons (RF-05 a, RN-15) → Four outcomes with a closed set of reasons (RF-05 a, RN-15)

(Reason: RN-09 and RN-10 gain a fourth outcome, `not_applicable`.)
(Migration: the only reference by title, in "Incoherent dates, RN-09", is updated in this delta; archived specs and docs keep their historical wording.)

## MODIFIED Requirements

### Requirement: Four outcomes with a closed set of reasons (RF-05 a, RN-15)

Slice S1 (S2 adds the RN-26 codes). Every signal MUST yield exactly one outcome:
`present`, `absent`, `not_evaluable` or, for RN-09 and RN-10 only,
`not_applicable`. A `not_evaluable` outcome MUST carry exactly one reason code
from this closed set, and `present` and `absent` MUST carry none.
`not_applicable` MUST carry no reason code and no evidence and MUST be produced
only by "Rest signals apply only to causes that admit rest"; it MUST NOT be a
reason code and MUST NOT replace `not_evaluable`. A signal MUST be
`not_evaluable` only when an input it needs is missing, never as a fallback for
an error.
(Previously: three outcomes, no `not_applicable`.)

| Reason code | Meaning | Allowed for |
|---|---|---|
| `calendar_not_covering_year` | the non-working-day calendar does not cover the deadline year | RN-07 |
| `extraction_pending` | a needed document has an extraction row `pendiente` or `procesando`, or none yet | RN-09, RN-10, RN-14 |
| `extraction_failed` | a needed document has an extraction row `fallida` | RN-09, RN-10, RN-14 |
| `field_missing` | a `completada` document lacks the field the signal needs | RN-09, RN-10, RN-14 |
| `days_only` | the rest period has a number of days and no dates | RN-09, RN-10 |
| `no_period` | the request has no single academic period | RN-14 |
| `no_eligible_documents` | the request has no current document | RN-09, RN-10, RN-14, RN-26 |
| `no_fingerprint` | every current document has no fingerprint | RN-26 |

When several documents explain a `not_evaluable` outcome, the reason MUST be
chosen by this precedence, first match winning: `no_period`,
`no_eligible_documents`, `extraction_pending`, `extraction_failed`,
`days_only`, `field_missing`, `no_fingerprint`.

#### Scenario: Reason is always from the closed set (table-driven)

| Outcome | Reason code |
|---|---|
| `present` | none |
| `absent` | none |
| `not_evaluable` | exactly one code of the table, allowed for that signal |
| `not_applicable` | none, and no evidence; only RN-09 and RN-10 |

- GIVEN every signal evaluated over the input combinations of this spec
- WHEN the outcomes are collected
- THEN each respects the row and no other code or free text exists

#### Scenario: Precedence of reasons

- GIVEN a request with a `fallida` document and a `completada` document with a days-only rest period
- WHEN RN-09 is evaluated and no document is evaluable
- THEN the outcome is `not_evaluable` with `extraction_failed`

### Requirement: Incoherent dates, RN-09 (RF-05 a, RF-05 b, RN-09)

Slice S1. Only when the declared cause is a rest-admitting cause (otherwise the
outcome is `not_applicable`, see "Rest signals apply only to causes that admit
rest"), per current document with a `completada` extraction row, the check MUST
be `present` when the end of the rest period (`reposoHasta`) is before the
issue date (`fechaEmision`), `absent` when it is on or after it, and not
evaluable for that document when the issue date or the end date is missing
(`field_missing`, or `days_only` when the rest period has days and no dates), or
when the extraction row is `pendiente`, `procesando`, missing
(`extraction_pending`) or `fallida` (`extraction_failed`). At request level the
signal MUST be `present` if any document is `present`; `absent` if at least one
document is evaluable and none is `present`; otherwise `not_evaluable` with the
reason chosen by the precedence of "Four outcomes with a closed set of
reasons". Documents retired, staff-uploaded or `no_aplica` MUST NOT count.
(Previously: evaluated for every cause; cross-reference named "Three outcomes".)

#### Scenario: Document boundaries (table-driven)

| `fechaEmision` | `reposoHasta` | Document check |
|---|---|---|
| 2026-07-12 | 2026-07-10 | present (RF-05 b: rest ends before the consultation) |
| 2026-07-12 | 2026-07-12 | absent (equal dates) |
| 2026-07-12 | 2026-07-14 | absent |
| 2026-07-12 | days only, no dates | not evaluable, `days_only` |
| none | 2026-07-14 | not evaluable, `field_missing` |
| any | extraction `fallida` | not evaluable, `extraction_failed` |
| any | extraction `pendiente` or no row | not evaluable, `extraction_pending` |

- GIVEN a request of cause `medica` with one current document with the values in the row
- WHEN the signal is evaluated
- THEN the request-level outcome is the document check

#### Scenario: Aggregation over several documents (table-driven)

| Document A | Document B | Request outcome |
|---|---|---|
| present | pending | `present` |
| absent | pending | `absent` |
| absent | absent | `absent` |
| pending | failed | `not_evaluable`, `extraction_pending` |
| days only | field missing | `not_evaluable`, `days_only` |

- GIVEN a request of cause `medica` with the two current documents in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Retired and staff documents ignored

- GIVEN a retired document that would be `present` and a staff-uploaded document with extraction data
- WHEN the signal is evaluated over a `medica` request whose only current student document is `absent`
- THEN the outcome is `absent`

#### Scenario: Cause without rest

- GIVEN a `fuerza_mayor` request whose document has rest ending before the issue date
- WHEN the signal is evaluated
- THEN the outcome is `not_applicable`, not `present`

### Requirement: Uncovered dates, RN-10 (RF-05 a, RN-10)

Slice S1. Only when the declared cause is a rest-admitting cause (otherwise the
outcome is `not_applicable`, see "Rest signals apply only to causes that admit
rest"), the signal MUST use full containment: the union, at calendar-day
granularity, of the rest periods `[reposoDesde, reposoHasta]` of the current
`completada` documents MUST cover the whole absence range
`[fechaInicio, fechaFin]`. Adjacent periods (one ending the day before the next
starts) MUST merge; a one-day gap MUST NOT. The signal MUST be `absent` when
the dated union covers the range, whatever other documents show. It MUST be
`present` only when the union does not cover the range and every current
document contributes a dated period. When the union does not cover the range
and at least one current document contributes no dated period (days-only,
field missing, pending, failed) the outcome MUST be `not_evaluable`, with the
reason chosen by precedence. A request with no dated period at all MUST be
`not_evaluable`.
(Previously: evaluated for every cause.)

#### Scenario: Containment boundaries (table-driven, absence Mon 2026-10-05 to Fri 2026-10-09)

| Rest periods of the current documents | Outcome |
|---|---|
| 10-05 to 10-09 | `absent` (exact cover) |
| 10-01 to 10-20 | `absent` (wider cover) |
| 10-05 to 10-08 | `present` (last day uncovered) |
| 10-06 to 10-09 | `present` (first day uncovered) |
| 10-05 to 10-07 and 10-08 to 10-09 | `absent` (adjacent periods merge) |
| 10-05 to 10-06 and 10-08 to 10-09 | `present` (gap on 10-07) |
| 10-07 to 10-07 (single day) | `present` |

- GIVEN a `medica` request whose current documents are all `completada` with dated periods as in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Days-only documents (table-driven)

| Dated union | Other current documents | Outcome |
|---|---|---|
| 10-05 to 10-09 | one days-only | `absent` |
| 10-05 to 10-07 | one days-only | `not_evaluable`, `days_only` |
| none | one days-only | `not_evaluable`, `days_only` |

- GIVEN a `medica` request, absence Mon 2026-10-05 to Fri 2026-10-09 and the documents in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Extraction pending or failed on an uncovered range

- GIVEN a `medica` request, a dated union 10-05 to 10-07 and a second current document with extraction `pendiente`, or `fallida`
- WHEN the signal is evaluated
- THEN the outcome is `not_evaluable` with `extraction_pending`, or `extraction_failed`, and never `present`

#### Scenario: Cause without rest

- GIVEN an `intercambio_academico` request whose documents leave the absence range uncovered
- WHEN the signal is evaluated
- THEN the outcome is `not_applicable`, not `present`

### Requirement: Three-state suggested verdict (RF-05 a, RF-05 d, RN-15)

Slice S1 (the verdict covers the signals delivered so far; S2 adds RN-26 to
the set). The verdict MUST be computed from the outcomes of the applicable
signals only; `not_applicable` outcomes MUST be ignored. It MUST be:
`review_carefully` ("review carefully") when any applicable signal is
`present`; `no_alerts` ("no alerts") when no signal is `present`, at least one
signal is applicable and every applicable signal is `absent`; `inconclusive`
otherwise, that is, when no signal is `present` and at least one applicable
signal is `not_evaluable`, or when no signal is applicable. The signals that are
`not_evaluable` MUST be listed apart from the verdict, each with its reason, so
the secretary sees what was not checked; `not_applicable` signals MUST NOT be
listed there. The verdict MUST be a suggestion: its text MUST state that it does
not change the state of the request.
(Previously: computed over all signals; `no_alerts` required every signal `absent`; no `not_applicable`.)

#### Scenario: Verdict table (table-driven)

| Outcomes of the signals | Verdict | Listed apart |
|---|---|---|
| one `present`, others any | `review_carefully` | the `not_evaluable` ones |
| all `absent` | `no_alerts` | none |
| `not_applicable` plus the rest all `absent` | `no_alerts` | none |
| `not_applicable` plus one `present` | `review_carefully` | the `not_evaluable` ones, if any |
| none `present`, one `not_evaluable` (any `not_applicable` ignored) | `inconclusive` | that one with its reason |
| none `present`, all applicable `not_evaluable` | `inconclusive` | all of them |
| every signal `not_applicable` | `inconclusive` | none |

- GIVEN signal outcomes as in the row
- WHEN the verdict is computed
- THEN the verdict and the list are as shown

#### Scenario: Present beats not evaluable

- GIVEN RN-07 `present` and RN-09, RN-10, RN-14 `not_evaluable` for extraction
- WHEN the verdict is computed
- THEN it is `review_carefully` and the three are listed as not evaluable

#### Scenario: Extraction not available

- GIVEN a `medica` request with extraction rows `pendiente` and RN-07 `absent`
- WHEN the verdict is computed
- THEN it is `inconclusive`, never `no_alerts`

#### Scenario: Non-rest cause with the other signals evaluable and absent

- GIVEN a `fuerza_mayor` request with `rest_to` before `issue_date`, RN-07, RN-14 and RN-26 evaluable and `absent`
- WHEN the verdict is computed
- THEN RN-09 and RN-10 are `not_applicable` and the verdict is `no_alerts`, not `inconclusive`

#### Scenario: Non-rest cause with a signal not evaluable

- GIVEN a `fuerza_mayor` request with RN-07 and RN-26 `absent` and RN-14 `not_evaluable` with `field_missing`
- WHEN the verdict is computed
- THEN the verdict is `inconclusive` and only RN-14 is listed apart

#### Scenario: Non-rest cause with RN-14 present

- GIVEN an `actividad_representativa` request that is the 3rd of the same issuer and period (RN-14 `present`)
- WHEN the verdict is computed
- THEN the verdict is `review_carefully` and RN-09 and RN-10 stay `not_applicable`

### Requirement: Signals text, i18n and accessibility (RNF-12)

Slice S1 (RN-26 texts S2, coordination texts S3). Every label of a signal,
outcome, verdict and reason code MUST exist in `i18n/es.json` and `i18n/en.json`
with the same keys. This includes the `not_applicable` outcome label and the
explanation line shown with it, which in `es` MUST read "No aplica" and "La
causa declarada no incluye reposo." (neutral professional Spanish, no
voseo) and in `en` MUST be their equivalents. Outcome and verdict MUST be
conveyed as text, never by color alone; the explanation line MAY be visually
muted but MUST remain text.
(Previously: no `not_applicable` label or explanation line.)

#### Scenario: Translation keys present

- GIVEN the `review.signals.*` keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys, one text per signal, outcome (including `not_applicable`), verdict and reason code, and the same key for the explanation line

#### Scenario: Not applicable wording

- GIVEN the `not_applicable` outcome label and explanation line
- WHEN the `es` locale is read
- THEN they read "No aplica" and "La causa declarada no incluye reposo.", and the `en` locale holds an English text for each

#### Scenario: Text, not color

- GIVEN a `present` signal, a `not_evaluable` signal and a `not_applicable` signal
- WHEN the section renders
- THEN each states its outcome in words
