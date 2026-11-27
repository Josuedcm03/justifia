# Delta for Validation Signals

Change `normative-parameters`. Requirements covered: RNF-14, RN-07, RN-08, RN-13,
RN-14. Thesis: CU-13, Annex D Table D19. The RN-07 deadline days, the RN-14
threshold, the RN-13 type-to-cause map and the calendar come from
`normative-parameters` (NP-2, NP-10, NP-12) and are read when the signals are read.
[PG] marks a scenario that MUST run on a real PostgreSQL.

## Notes for archive

- Purpose: in the paragraph "Known limitations (documented, not defects)", delete
  the sentence "RNF-14 is not met, because the recurrence threshold is a code
  constant until roadmap #8;" and keep the other limitations (RN-26 exact bytes,
  extraction rows needed, UAM legal review). In "Out of scope", nothing changes.
- "Four outcomes with a closed set of reasons": no edit. The reason
  `calendar_not_covering_year` now means that the calendar parameter holds no date of
  the deadline year (`normative-parameters` NP-10).
- The three modified requirements below replace their base text. The evaluators keep
  receiving the threshold, the map, the days and the calendar as inputs; only the
  source of those inputs changes.
- Out of scope here: the coordination report (RF-13 c) keeps its own defaults.

## RENAMED Requirements

### Requirement: MD-15 Type-to-cause correspondence is one table behind an injectable seam (RN-13, RNF-14 mapping only, D3, D4) → MD-15 Type-to-cause correspondence is one parameter table behind an injectable seam (RN-13, RNF-14, D3, D4)

(Reason: the heading said the mapping was the only part of RNF-14 covered and the body said changing the table required a deployment; the table is now the `tipo_documento_causa` parameter of `normative-parameters` (NP-12).)
(Migration: references to the old heading in docs and tests update to the new one; the body is replaced by the MODIFIED block below, which uses the new heading.)

## MODIFIED Requirements

### Requirement: Late presentation, RN-07 (RF-05 a, RN-07, RN-08)

Slice S1. Parameters (RNF-14, CU-13): the number of days is the late-filing days
parameter in force, with its own key, independent of the remission days of RN-08;
the calendar is the calendar parameter. The signal MUST be `present` when the
Managua date of the first presentation (`presentadaEn`, never the resubmission time
`reenviadaEn`) is after the deadline of the absence end date, that is the N-th
business day strictly after `fechaFin` (RN-07; N = late-filing days, default 2),
counted with the same calendar and the same day-counting function as the queue. It
MUST be `absent` when that date is on or before the deadline. It MUST be
`not_evaluable` with `calendar_not_covering_year` when the calendar holds no date of
the year of the deadline. The signal MUST NOT depend on extraction. Changing the
remission days MUST NOT change this signal and changing the late-filing days MUST
NOT change the queue.
(Previously: the deadline was `deadlineOf(fechaFin)`, the second business day, sharing the number of RN-08 and the code constant calendar.)

#### Scenario: Boundary dates (table-driven, calendar without holidays, late-filing days 2)

| `fechaFin` | First presented (Managua) | Outcome |
|---|---|---|
| Fri 2026-10-09 | Tue 2026-10-13 (the deadline) | `absent` |
| Fri 2026-10-09 | Wed 2026-10-14 | `present` |
| Fri 2026-10-09 | Mon 2026-10-12 | `absent` |
| Sat 2026-10-10 | Tue 2026-10-13 | `absent` |
| Sat 2026-10-10 | Wed 2026-10-14 | `present` |

- GIVEN a request with the dates in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown (presentation on the deadline day is not late)

#### Scenario: Late-filing days change the deadline (table-driven, calendar without holidays, `fechaFin` Fri 2026-10-09)

| Late-filing days | First presented (Managua) | Outcome |
|---|---|---|
| 3 | Wed 2026-10-14 (the deadline) | `absent` |
| 3 | Thu 2026-10-15 | `present` |
| 1 | Mon 2026-10-12 (the deadline) | `absent` |
| 1 | Tue 2026-10-13 | `present` |

- GIVEN a request with the dates in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Own key, independent of the remission days (RN-07 and RN-08 are two parameters)

- GIVEN `fechaFin` Fri 2026-10-09, first presentation Wed 2026-10-14, late-filing days 2 and remission days 3
- WHEN the signal is evaluated
- THEN the outcome is `present`, as with remission days 2
- AND with late-filing days 3 and remission days 2 the outcome is `absent`

#### Scenario: A listed holiday moves the deadline

- GIVEN `fechaFin` Fri 2026-10-09, late-filing days 2, Tue 2026-10-13 listed as non-working and first presentation Wed 2026-10-14
- WHEN the signal is evaluated
- THEN the deadline is Wed 2026-10-14 and the outcome is `absent`

#### Scenario: A parameter change applies to the next read [PG]

- GIVEN a presented request whose RN-07 is `present` with late-filing days 2
- WHEN the maintainer saves late-filing days 3 and the signals are read again
- THEN RN-07 is `absent` and nothing had been stored about the earlier outcome

#### Scenario: Managua date, not UTC

- GIVEN `fechaFin` Fri 2026-10-09 and a first presentation at 2026-10-14 03:00 UTC (Tue 21:00 in Managua)
- WHEN the signal is evaluated
- THEN the outcome is `absent`

#### Scenario: Resubmission does not restart the signal

- GIVEN a request first presented Wed 2026-10-14 (deadline Tue 2026-10-13), returned, and resubmitted on Thu 2026-10-15
- WHEN the signal is evaluated
- THEN the outcome is `present` (the first presentation counts), and a request first presented on time and resubmitted late stays `absent`

#### Scenario: Calendar does not cover the deadline year

- GIVEN `fechaFin` Thu 2027-12-30, whose deadline falls in 2028, and a calendar parameter with dates in 2026 and 2027 only
- WHEN the signal is evaluated
- THEN the outcome is `not_evaluable` with `calendar_not_covering_year`
- AND a `fechaFin` whose deadline falls in 2027 is evaluated normally

### Requirement: Recurrence, RN-14 (RF-05 a, RF-05 c, RN-14)

Spec id MD-18. Slice S1. Parameter (RNF-14, CU-13): the threshold is the
recurrence-threshold parameter in force (default 3, range 2 to 20), loaded when the
signals are read. The effective issuer (the manual issuer when
registered, otherwise the extracted one, RN-24) of each current document with
effective state `completada` MUST be normalized
before comparison: Unicode decomposition with diacritics removed, lower case,
punctuation removed and whitespace collapsed and trimmed. Issuers MUST be
compared on that normalized form with every run of one repeated letter
collapsed to a single letter (digits unchanged), because the extraction model
doubles letters at random; the evidence MUST show the normalized issuer of the
current request, not the comparison key. For each normalized
issuer of the request, the count MUST be the number of distinct presented
requests of the same student, in the same academic period (`Grupo.periodo` of
the request's subjects), that have a current document with that effective
issuer, in the
order of presentation up to and including the current request. The same merge
MUST apply to the documents of the earlier requests: a manual issuer of an
earlier request's document counts even when its extraction did not complete,
and prevails over its extracted issuer. The signal MUST
be `present` when any count reaches the threshold, and `absent` otherwise. The
threshold MUST be an input of the evaluation, not read inside the evaluator, and the
read assembly MUST supply the parameter in force at read time, so a change applies to
every request on the next read. Requests of other students, of other periods, drafts, and
requests later in the order of presentation MUST NOT count. A request MUST be
`not_evaluable` with `no_period` when its subjects do not give exactly one
period, with `extraction_pending` or `extraction_failed` when no current
document has effective state `completada` yet or failed, and with `field_missing` when the
`completada` documents have no effective issuer. RN-14 compares issuers of the same
student only; no cross-student volume is computed. The evidence of a `present`
outcome MUST carry the threshold that was applied.
(Previously: the initial threshold value 3 was a code constant that only a deployment could change; the read assembly passed the constant.)

#### Scenario: Nth request is flagged (table-driven, threshold 3)

| Request in order of presentation (same student, period, issuer) | Outcome |
|---|---|
| 1st | `absent` |
| 2nd | `absent` |
| 3rd | `present` (RF-05 c) |
| 4th | `present` |

- GIVEN four presented requests of one student in 2026-S2 with the same issuer
- WHEN the signal is evaluated for each
- THEN the outcome is as shown
- AND the 1st and 2nd stay `absent` after the 3rd exists (later requests never change an earlier one)

#### Scenario: What does not count (table-driven)

| Other request | Counted for the 3rd request |
|---|---|
| same student, same period, `rechazada` | yes |
| same student, same period, `devuelta` | yes |
| same student, other period | no |
| other student, same period | no |
| same student, `borrador` | no |
| same student, retired documents only | no |

- GIVEN a request that would be the 3rd and one other request as in the row
- WHEN the signal is evaluated
- THEN the row says whether that other request is counted

#### Scenario: Issuer normalization

- GIVEN issuers "Clínica  Santa Fe", "CLINICA SANTA FE." and "Clinica Santa Fe S.A."
- WHEN they are normalized
- THEN the first two are equal and the third differs (known heuristic limit)

#### Scenario: Doubled letter from the extraction

- GIVEN a current issuer "CLÍNICA ODONTOLÓGICA DENTALIA PRADO" and two earlier requests of the same student and period with "CLÍNICA ODONTOLOÓGICA DENTALIA PRADO" and "CLÍNICA ODONTOOLÓGICA DENTALIA PRADO"
- WHEN the signal is evaluated with threshold 3
- THEN the outcome is `present` with count 3 and evidence issuer "clinica odontologica dentalia prado"
- AND "Clinica 11" and "Clinica 1" stay different issuers (digits are not collapsed)

#### Scenario: One request counts once

- GIVEN a request with two current documents of the same issuer
- WHEN the count is computed
- THEN that request adds 1 to the count, not 2

#### Scenario: Threshold is a parameter

- GIVEN the same data evaluated with threshold 3 and with threshold 2
- WHEN the 2nd request is evaluated
- THEN it is `absent` with 3 and `present` with 2, with no change to the evaluator

#### Scenario: The parameter in force is read, with its default

- GIVEN no stored row for the recurrence threshold, and then a stored row with value 2
- WHEN the signals read assembles the evaluation for the 2nd request of one issuer
- THEN the threshold passed is 3 and then 2, and the evidence of a `present` outcome carries the applied threshold

#### Scenario: A parameter change applies to the next read [PG]

- GIVEN a presented request that is the 2nd of its issuer and period, RN-14 `absent` with threshold 3
- WHEN the maintainer saves the threshold 2 and the signals are read again
- THEN RN-14 is `present` and earlier requests of the same student that are the 1st stay `absent`

#### Scenario: Invalid stored threshold falls back to 3 [PG]

- GIVEN a stored threshold row with value 0
- WHEN the signals are read
- THEN the threshold applied is 3 and the read does not fail

#### Scenario: Missing inputs (table-driven)

| Situation | Outcome |
|---|---|
| subjects in two periods, or none | `not_evaluable`, `no_period` |
| every current document `pendiente` or without row, and no manual data | `not_evaluable`, `extraction_pending` |
| every current document `fallida`, and no manual data | `not_evaluable`, `extraction_failed` |
| `completada` documents without effective issuer | `not_evaluable`, `field_missing` |

- GIVEN a request in the situation of the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Manual issuer prevails over the extracted one (RN-24)

- GIVEN a current document whose extracted issuer is "Clinica Norte" and whose manual issuer is "Clinica Santa Fe", and two earlier requests of the same student and period with issuer "Clinica Santa Fe"
- WHEN the signal is evaluated with threshold 3
- THEN the outcome is `present` with count 3 and evidence issuer "clinica santa fe"

#### Scenario: Manual issuers count in the history even with failed extraction

- GIVEN two earlier requests of the same student and period whose documents have extraction `fallida` and a manual issuer "Clinica Santa Fe", and a current request with a manual issuer "CLINICA SANTA FE"
- WHEN the signal is evaluated with threshold 3
- THEN the outcome is `present` with count 3

#### Scenario: Cleared manual issuer reverts in the history

- GIVEN an earlier request whose manual issuer was cleared and whose extracted issuer is "Clinica Norte"
- WHEN the signal is evaluated for a later request with issuer "Clinica Santa Fe"
- THEN the earlier request does not count

### Requirement: MD-15 Type-to-cause correspondence is one parameter table behind an injectable seam (RN-13, RNF-14, D3, D4)

Thesis: RN-13 «La correspondencia entre tipo de documento y causa es un
parámetro normativo (RNF-14).» CU-13, Annex D Table D19. The correspondence MUST be
one table: by default the type `constancia_medica` corresponds to the causes `medica` and
`maternidad_paternidad`; the type `constancia_institucional` corresponds to
`actividad_representativa`, `intercambio_academico` and `fuerza_mayor`; the type
`otro` corresponds to no cause and MUST stay so whatever the stored value. The table in force MUST be
the `tipo_documento_causa` parameter (`normative-parameters` NP-12), read when the
signals are read, and MUST be an input of the evaluation, like the recurrence threshold, not read
inside the evaluator. The code table MUST survive only as the default used when the parameter
is missing or invalid. A test MUST cover the default table exhaustively
over every type and every cause (the five causes of RN-01), whatever the active flag
of a cause. Declared assumption: `maternidad_paternidad` (lactancia included, RN-01)
corresponds to `constancia_medica`; no thesis scenario covers it. Changing the table
does not require a deployment: RNF-14 is covered for this mapping.
(Previously: the table was a typed constant of the code and changing it required a deployment, so RNF-14 stayed "No cumple" until roadmap row 8.)

#### Scenario: Table is an input of the evaluation

- GIVEN the same request evaluated with the default table and with a table where `constancia_medica` also corresponds to `fuerza_mayor`
- WHEN RN-13 is evaluated for a `fuerza_mayor` request with a `constancia_medica` document
- THEN it is `present` with the default table and `absent` with the other, with no change to the evaluator

#### Scenario: Exhaustive coverage

- GIVEN the three types and the five causes
- WHEN the exhaustive test runs
- THEN each of the 15 pairs has an expected outcome and a type or cause missing from the table fails the test

#### Scenario: Maternity assumption

- GIVEN a `maternidad_paternidad` request with a document registered as `constancia_medica`
- WHEN RN-13 is evaluated
- THEN it is `absent`

#### Scenario: The stored table is read, with the default as fallback

- GIVEN no stored row for `tipo_documento_causa`, then a stored row that maps `constancia_medica` also to `fuerza_mayor`
- WHEN the signals read assembles the evaluation for a `fuerza_mayor` request with a `constancia_medica` document
- THEN the table passed is the default, and then the stored one

#### Scenario: A parameter change flips the signal on the next read [PG]

- GIVEN a `fuerza_mayor` request with a `constancia_medica` document and RN-13 `present`
- WHEN the maintainer enables the cell (`constancia_medica`, `fuerza_mayor`) and the signals are read again
- THEN RN-13 is `absent`, and disabling it again makes it `present`

#### Scenario: `otro` stays unmapped even in a stored value

- GIVEN a stored row that maps `otro` to `medica` (bypassing the screen)
- WHEN the signals read assembles the evaluation
- THEN the stored row is invalid, the default table is used and RN-13 is `present` for a document registered as `otro` in every cause

#### Scenario: A deactivated cause keeps its row

- GIVEN `medica` deactivated and a `medica` request with a document registered as `constancia_medica`
- WHEN RN-13 is evaluated
- THEN it is `absent`, as when the cause is active
