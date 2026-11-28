# Validation Signals Specification

## Purpose

The academic secretary receives, with each presented request, the result of
automatic validation signals and a suggested verdict, to support (never to
replace) the decision. Covers RF-05 (a), (b), (c), (d); RN-07, RN-09, RN-10,
RN-14, RN-15 and the new RN-26 (repeated document); touches RF-11 (extracted
data as input), RN-08 (`deadlineOf`), RN-22 (not used), RNF-01, RNF-02, RNF-06,
RNF-12. Screens live in `request-review` (secretary) and
`coordination-escalation` (coordination); fingerprint storage in
`supporting-documents`; the student never sees signals (`student-requests`).

Slices of the feature-branch chain `feat/validation-signals`: **S1** evaluators,
read assembly and secretary UI for RN-07, RN-09, RN-10, RN-14 (no schema);
**S2** fingerprint at finalize, migration 0013 and RN-26; **S3** coordination
read-only projection and closeout of specs and docs. Every requirement below
names the slice that delivers it.

Out of scope: RF-05 (e), RN-11, RN-12, RN-13, RN-24 (deferred to RF-14); NS-12;
anomalous issuer volume across students; a decision-time snapshot; fingerprint
backfill; any change of `CONSENT_VERSION`.

Known limitations (documented, not defects): RN-26 matches exact
bytes only, so a re-saved, re-compressed or screenshotted file evades it;
RN-09, RN-10 and RN-14 need `completada` extraction rows (only RN-07 and RN-26
work without extraction); hashing and cross-request comparison of documents are
pending the UAM legal review and run on fictitious data only.

Terms: "signal" = one of `late_presentation` (RN-07, "presentación tardía"),
`incoherent_dates` (RN-09, "fechas incoherentes"), `uncovered_dates` (RN-10,
"fechas no cubiertas"), `recurrence` (RN-14, "reincidencia"),
`repeated_document` (RN-26, "documento repetido"); "current documents" = the
non-retired, student-uploaded (not staff-uploaded), non-special-format
documents in state `valido` of the request; "presented request" = a request
with a first presentation time (`presentadaEn`), in any later state including
`rechazada` and `devuelta`, never a `borrador`; "order of presentation" =
`presentadaEn` ascending, then request id ascending; "today" = current date in
America/Managua; "extraction row" = the `ExtraccionDocumento` of a document.

## Requirements

### Requirement: Four outcomes with a closed set of reasons (RF-05 a, RN-15)

Spec id MD-17. Slice S1 (S2 adds the RN-26 codes; the manual-document-data
change adds the RN-11, RN-12 and RN-13 uses and the code `not_registered`).
Every signal MUST yield exactly one outcome:
`present`, `absent`, `not_evaluable` or, for RN-09 and RN-10 only,
`not_applicable`. A `not_evaluable` outcome MUST carry exactly one reason code
from this closed set, and `present` and `absent` MUST carry none.
`not_applicable` MUST carry no reason code and no evidence and MUST be produced
only by "Rest signals apply only to causes that admit rest"; it MUST NOT be a
reason code and MUST NOT replace `not_evaluable`. A signal MUST be
`not_evaluable` only when an input it needs is missing, never as a fallback for
an error. Wherever this spec reads the extraction row of a document, it reads
the effective view of the document (see `document-extraction`, MD-21): manual
data prevails over extracted data (RN-24), and a document with at least one
manual value among name, issuer, issue date and rest period counts as
`completada` whatever its extraction row is, including `fallida`, `pendiente`,
`procesando`, absent or extraction not configured.
(Previously: five signals, no `not_registered` code, and only extraction rows were read.)

| Reason code | Meaning | Allowed for |
|---|---|---|
| `calendar_not_covering_year` | the non-working-day calendar does not cover the deadline year | RN-07 |
| `extraction_pending` | a needed document has an effective state `pendiente` or `procesando`, or no row yet, and no manual data | RN-09, RN-10, RN-14 |
| `extraction_failed` | a needed document has an effective state `fallida` | RN-09, RN-10, RN-14 |
| `field_missing` | a document with effective state `completada` lacks the field the signal needs | RN-09, RN-10, RN-14 |
| `days_only` | the rest period has a number of days and no dates | RN-09, RN-10 |
| `no_period` | the request has no single academic period | RN-14 |
| `no_eligible_documents` | the request has no current document | RN-09, RN-10, RN-11, RN-12, RN-13, RN-14, RN-26 |
| `no_fingerprint` | every current document has no fingerprint | RN-26 |
| `not_registered` | at least one current document has no registered value of the datum the signal needs (firma, sello or document type) and no current document raises the signal | RN-11, RN-12, RN-13 |

When several documents explain a `not_evaluable` outcome, the reason MUST be
chosen by this precedence, first match winning: `no_period`,
`no_eligible_documents`, `extraction_pending`, `extraction_failed`,
`days_only`, `field_missing`, `no_fingerprint`, `not_registered`.

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

#### Scenario: `not_registered` belongs to RN-11, RN-12 and RN-13 only

- GIVEN every signal evaluated over documents whose firma, sello and type are not registered
- WHEN the outcomes are collected
- THEN RN-11, RN-12 and RN-13 are `not_evaluable` with `not_registered`, and no other signal carries that code

#### Scenario: Manual data removes the extraction reason

- GIVEN a `medica` request whose only document has extraction `fallida` and a manual rest period 2026-11-09 to 2026-11-09 and no issue date
- WHEN RN-09 and RN-10 are evaluated
- THEN RN-09 is `not_evaluable` with `field_missing`, not `extraction_failed`, and RN-10 is evaluated from the registered rest period

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

#### Scenario: A parameter change applies to the next read

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

#### Scenario: A parameter change applies to the next read

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

### Requirement: Repeated document, RN-26 (RF-05 a, RN-26, RNF-01, RNF-02)

Slice S2. The signal compares each current document of request R that has a
fingerprint with the documents of OTHER presented requests that come EARLIER in
the order of presentation. The other side MUST include presented requests in any
state (`rechazada` and `devuelta` included) and their retired documents, and
MUST exclude drafts, staff-uploaded documents and special-format documents (on
both sides). The signal MUST be `present` when any current document of R has
the same fingerprint as an eligible document of an earlier request, whatever the
student (a match across students is a legitimate signal). It MUST be `absent`
when at least one current document has a fingerprint and none matches. It MUST
be `not_evaluable` with `no_fingerprint` when every current document has a NULL
fingerprint, and with `no_eligible_documents` when there is no current
document. Documents of the same request (a correction re-upload, retired or
current) MUST NEVER match. A document with a NULL fingerprint MUST NEVER match.
A request's signal MUST NOT change because a later request reuses its
documents.

#### Scenario: Earlier request reused (table-driven)

| Earlier request R1 | Later request R2 | R2 outcome | R1 outcome |
|---|---|---|---|
| presented, `pendiente`, document H | document H | `present` | `absent` |
| presented, `rechazada`, document H | document H | `present` | `absent` |
| presented, document H retired by a correction | document H | `present` | `absent`, or `not_evaluable`, `no_eligible_documents` when H is R1's only document |
| draft with document H | document H | `absent` | not applicable |
| presented, document H uploaded by staff | document H | `absent` | `not_evaluable`, `no_eligible_documents` |
| presented, document H special format | document H | `absent` | `not_evaluable`, `no_eligible_documents` |
| presented, other student, document H | document H | `present` | `absent` |

- GIVEN R1 presented before R2 as in the row and R2 with a current student document with fingerprint H
- WHEN the signal is evaluated for R2 and for R1
- THEN the outcomes are as shown

#### Scenario: Equal presentation time

- GIVEN requests A (id 10) and B (id 11) with the same `presentadaEn` and the same document H
- WHEN the signal is evaluated for each
- THEN B is `present` and A is `absent` (ties are broken by request id ascending)

#### Scenario: Correction re-upload in the same request never triggers

- GIVEN request R `devuelta` whose document H was retired and the student re-uploads the same file as a new current document with fingerprint H, and no other request has H
- WHEN the signal is evaluated for R
- THEN the outcome is `absent`

#### Scenario: Correction that reuses another request's document

- GIVEN request R `devuelta`, corrected with a new current document whose fingerprint H equals a document of an earlier request E
- WHEN the signal is evaluated for R
- THEN the outcome is `present`, and E stays `absent`

#### Scenario: Order follows first presentation

- GIVEN request E first presented Mon, request L first presented Tue, and E corrected and resubmitted (`reenviadaEn`) Wed with a document equal to one of L
- WHEN the signal is evaluated for E and L
- THEN E is `absent` (L is not earlier than E in the order of presentation) and L is `present`, because the order uses the first presentation and not the resubmission time

#### Scenario: Documents from before the change (NULL fingerprint, table-driven)

| Current documents of R | Outcome |
|---|---|
| all NULL | `not_evaluable`, `no_fingerprint` |
| one NULL, one with a fingerprint that matches nothing | `absent` |
| one NULL, one with a fingerprint that matches an earlier request | `present` |
| no current student document | `not_evaluable`, `no_eligible_documents` |

- GIVEN a request with the current documents in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Earlier document with NULL fingerprint

- GIVEN an earlier request whose document predates the change (NULL) and a later request with a document of the same bytes
- WHEN the signal is evaluated for the later request
- THEN the outcome is `absent` (no backfill; NULL never matches)

### Requirement: RN-26 reference is confined to the caller's scope (RN-26, RNF-01, RNF-02)

Slice S2 (secretary), S3 (coordination). When RN-26 is `present`, the outcome
MUST include the number of each matching earlier request only when that
request is inside the caller's scope: for the `secretaria`, requests whose
student's current career belongs to her facultad; for the `coordinacion`,
requests whose student's current career equals her own. A match outside the
scope MUST be `present` with no reference, no count and no other attribute
that would reveal it. The outcome MUST NEVER contain a student name, CIF,
email or document name, and MUST NOT reveal whether the match is of the same
or of another student.

#### Scenario: Cross-scope match without reference

- GIVEN request R of facultad A whose document matches an earlier request of facultad B
- WHEN the secretary of A reads the signal
- THEN the outcome is `present` with no request number and nothing else about the match

#### Scenario: In-scope match with reference

- GIVEN request R whose document matches earlier requests 41 (same facultad) and 55 (other facultad)
- WHEN the secretary of the facultad reads the signal
- THEN the outcome is `present` and references request 41 only

#### Scenario: Reference carries no personal data

- GIVEN an in-scope match
- WHEN the outcome is serialized for the screen
- THEN it holds the request number and no student name, CIF, email or document name

### Requirement: Three-state suggested verdict (RF-05 a, RF-05 d, RN-15)

Spec id MD-19. Slice S1 (the verdict covers the signals delivered so far; S2
adds RN-26 to the set; the manual-document-data change adds RN-11, RN-12 and
RN-13, so the set is eight signals). The verdict MUST be computed from the
outcomes of the applicable
signals only; `not_applicable` outcomes MUST be ignored. It MUST be:
`review_carefully` ("review carefully") when any applicable signal is
`present`; `no_alerts` ("no alerts") when no signal is `present`, at least one
signal is applicable and every applicable signal is `absent`; `inconclusive`
otherwise, that is, when no signal is `present` and at least one applicable
signal is `not_evaluable`, or when no signal is applicable. A document whose
firma, sello or type is not registered therefore keeps the verdict
`inconclusive` while no signal is `present` (D1), and the signal is listed apart
with the reason `not_registered`. The signals that are
`not_evaluable` MUST be listed apart from the verdict, each with its reason, so
the secretary sees what was not checked; `not_applicable` signals MUST NOT be
listed there. The verdict MUST be a suggestion: its text MUST state that it does
not change the state of the request.
(Previously: five signals; the verdict scenarios did not mention RN-11, RN-12 and RN-13.)

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

- GIVEN a `fuerza_mayor` request with `rest_to` before `issue_date`, RN-07, RN-11, RN-12, RN-13, RN-14 and RN-26 evaluable and `absent`
- WHEN the verdict is computed
- THEN RN-09 and RN-10 are `not_applicable` and the verdict is `no_alerts`, not `inconclusive`

#### Scenario: Non-rest cause with a signal not evaluable

- GIVEN a `fuerza_mayor` request with RN-07, RN-11, RN-12, RN-13 and RN-26 `absent` and RN-14 `not_evaluable` with `field_missing`
- WHEN the verdict is computed
- THEN the verdict is `inconclusive` and only RN-14 is listed apart

#### Scenario: Non-rest cause with RN-14 present

- GIVEN an `actividad_representativa` request that is the 3rd of the same issuer and period (RN-14 `present`)
- WHEN the verdict is computed
- THEN the verdict is `review_carefully` and RN-09 and RN-10 stay `not_applicable`

#### Scenario: Unregistered marks keep the verdict inconclusive (D1)

- GIVEN a `medica` request with RN-07, RN-09, RN-10, RN-14 and RN-26 `absent` and a document whose firma, sello and type are not registered
- WHEN the verdict is computed
- THEN it is `inconclusive`, never `no_alerts`, and RN-11, RN-12 and RN-13 are listed apart, each with the reason `not_registered`

#### Scenario: SC-01 standard approval has no signal (A5 SC-01)

- GIVEN a `medica` request on time, with a first issuer of the period, a document registered with type `constancia_medica`, firma `Sí` and sello `Sí`, and a rest covering the absence
- WHEN the verdict is computed
- THEN every signal is `absent` and the verdict is `no_alerts`

#### Scenario: Registering the marks restores the verdict

- GIVEN the SC-01 request with the firma `Sin registrar`, so the verdict is `inconclusive` and RN-11 is listed apart with `not_registered`
- WHEN the secretary registers firma `Sí` and the next read is computed
- THEN RN-11 is `absent` and the verdict is `no_alerts`

#### Scenario: A present manual signal beats not registered

- GIVEN RN-12 `present` and RN-11 and RN-13 `not_evaluable` with `not_registered`
- WHEN the verdict is computed
- THEN it is `review_carefully` and the two are listed apart

### Requirement: Signals and verdict are display-only (RN-15, RF-05 d)

Slice S1 (S2 for RN-26). Signals and the verdict MUST NOT change the state of a
request, MUST NOT block, enable, order or filter any action or list, and MUST
NOT be read by any write path (decision, escalation, answer, correction,
upload, notification). The queue MUST be unchanged by signals. A secretary MAY
approve a request with verdict `review_carefully` and MAY reject one with
`no_alerts`.

#### Scenario: Decision independent of the verdict

- GIVEN requests with verdicts `review_carefully`, `no_alerts` and `inconclusive`
- WHEN the in-scope secretary approves, rejects or returns each
- THEN every action succeeds exactly as without signals and the state changes only by that action

#### Scenario: No write path reads the signals

- GIVEN the signal module replaced by a stub that throws when called
- WHEN every state-changing action (decide, escalate, answer, report, correct, finalize, resend) runs
- THEN none fails and none reads a signal or the verdict

#### Scenario: Queue unchanged

- GIVEN pendiente requests with different verdicts
- WHEN the queue is read
- THEN its order, alert marks and content equal those computed without signals

### Requirement: Computed on read, nothing persisted (RF-05, SNAP)

Slice S1. Outcomes and verdict MUST be computed on every read from current
data. Outcomes, verdict and reason codes MUST NOT be stored, snapshotted at
decision time, written to an audit payload, or sent in a notification.

#### Scenario: Late extraction changes the next read

- GIVEN a `pendiente` request whose RN-09 was `not_evaluable` with `extraction_pending`
- WHEN the extraction becomes `completada` with incoherent dates and the secretary reads again
- THEN RN-09 is `present` and nothing had been stored

#### Scenario: Decision does not store the verdict

- GIVEN a request decided with verdict `review_carefully`
- WHEN the decision, revision and audit rows are inspected
- THEN none holds an outcome, a verdict or a reason code

### Requirement: Access limited to staff in scope (RNF-01, RNF-02)

Slice S1 (secretary), S3 (coordination). Signals and verdict MUST be visible
only to the `secretaria` in scope on the staff detail (all signals and the
verdict) and to the `coordinacion` of the request's own career on the open
escalation detail (outcomes and labels, see `coordination-escalation`).
Students, teachers, administrators, other roles, out-of-scope staff and
anonymous callers MUST receive no signal data, with the denial of the
underlying screen. The access decision MUST live in `src/lib/auth/permissions.ts`.

#### Scenario: Roles (table-driven)

| Caller | Staff detail signals |
|---|---|
| `secretaria` in scope | shown |
| `secretaria` of another facultad | nonexistent-id outcome, no data |
| `coordinacion`, `estudiante`, `docente`, `administrador` | denied, no data |
| anonymous | sent to login |

- GIVEN a request and the caller in the row
- WHEN they open the staff detail
- THEN the result is as shown

### Requirement: Signals text, i18n and accessibility (RNF-12)

Slice S1 (RN-26 texts S2, coordination texts S3). Every label of a signal,
outcome, verdict and reason code MUST exist in `i18n/es.json` and `i18n/en.json`
with the same keys. This includes the `not_applicable` outcome label and the
explanation line shown with it, which in `es` MUST read "No aplica" and "La
causa declarada no incluye reposo." (neutral professional Spanish, no
voseo) and in `en` MUST be their equivalents. Outcome and verdict MUST be
conveyed as text, never by color alone; the explanation line MAY be visually
muted but MUST remain text.

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

### Requirement: Rest signals apply only to causes that admit rest (RF-05 a, RF-05 b, RN-09, RN-10)

Spec id MD-20. RN-09 and RN-10 MUST be evaluated only when the declared cause of the request
is a rest-admitting cause. For any other declared cause (`actividad_representativa`,
`intercambio_academico`, `fuerza_mayor`) both signals MUST be `not_applicable`,
whatever the extracted data, including a rest period ending before the issue
date, days-only, missing, pending or failed extraction. The cause cut MUST
precede any reading of extraction: it MUST NOT change, hide or delete the
extracted data. RN-07, RN-11, RN-12, RN-13, RN-14 and RN-26 MUST be evaluated
for every cause (RN-13 reads the declared cause as an input, it is never cut by
it). The system MUST always return the eight results in the fixed order RN-07,
RN-09, RN-10, RN-11, RN-12, RN-13, RN-14, RN-26. A presented request whose
declared cause is missing
or outside the five causes of RN-01 MUST make the signals read fail, with no
default cause assumed; the existing fail-soft degraded notice of the signals
section (see `request-review`) then applies and no verdict is shown.
(Previously: five results in the order RN-07, RN-09, RN-10, RN-14, RN-26.)

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

#### Scenario: RN-11, RN-12 and RN-13 are not cut by the cause

- GIVEN a `fuerza_mayor` request whose document is registered with firma `No`, sello `No` and type `constancia_medica`
- WHEN the signals are evaluated
- THEN RN-11, RN-12 and RN-13 are all `present` while RN-09 and RN-10 are `not_applicable`

#### Scenario: Eight results in fixed order for every cause

- GIVEN a request of any cause
- WHEN the signals are evaluated
- THEN the results are RN-07, RN-09, RN-10, RN-11, RN-12, RN-13, RN-14, RN-26 in that order, including when two are `not_applicable`

#### Scenario: Missing or invalid cause fails loud (table-driven)

| Declared cause | Result |
|---|---|
| null | signals read fails, no outcome, no verdict |
| a value outside the five causes | signals read fails, no outcome, no verdict |

- GIVEN a presented request with the cause in the row
- WHEN the signals are read
- THEN the read fails and the staff detail shows the degraded notice instead of a verdict

### Requirement: MD-12 Firma ausente, RN-11 (RF-05 a, RF-14 b, RN-11)

Thesis: RN-11 «Un documento que la secretaría marca sin la firma del emisor
genera la señal “firma ausente”.» Signal code `rn11` (es "Firma ausente", en
"Signature missing"). For each current document the check MUST be `present`
when its firma is registered `No`, `absent` when it is registered `Sí`, and not
evaluable for that document when it is `Sin registrar` (D1). The check MUST NOT
depend on the extraction state of the document and MUST NOT depend on the
declared cause: it MUST be evaluated identically for the five causes and MUST
NEVER be `not_applicable`. The request-level outcome follows "Aggregation and
reasons of RN-11, RN-12 and RN-13".

#### Scenario: Document check (table-driven)

| Firma of the document | Document check |
|---|---|
| `Sí` | absent |
| `No` | present |
| `Sin registrar` | not evaluable |

- GIVEN a request with one current document with the firma in the row
- WHEN RN-11 is evaluated
- THEN the request-level outcome is the document check, with reason `not_registered` when not evaluable

#### Scenario: SC-14 firma ausente (A5 SC-14, RF-14 b, RN-11)

- GIVEN a `medica` request whose only document is registered with type `constancia_medica`, firma `No` and sello `Sí`
- WHEN the signals are evaluated
- THEN RN-11 is `present`, RN-12 and RN-13 are `absent`, and the verdict is "review carefully"

#### Scenario: Independent of extraction and cause

- GIVEN a `fuerza_mayor` request whose document has extraction `fallida` and firma `No`
- WHEN RN-11 is evaluated
- THEN it is `present`, not `not_evaluable` and not `not_applicable`

### Requirement: MD-13 Sello ausente, RN-12 (RF-05 a, RF-14 b, RN-12)

Thesis: RN-12 «Un documento que la secretaría marca sin el sello del emisor
genera la señal “sello ausente”.» Signal code `rn12` (es "Sello ausente", en
"Seal missing"). For each current document the check MUST be `present` when its
sello is registered `No`, `absent` when `Sí`, and not evaluable for that
document when `Sin registrar` (D1). It MUST NOT depend on the extraction state
or on the declared cause, and MUST NEVER be `not_applicable`. The request-level
outcome follows "Aggregation and reasons of RN-11, RN-12 and RN-13".

#### Scenario: Document check (table-driven)

| Sello of the document | Document check |
|---|---|
| `Sí` | absent |
| `No` | present |
| `Sin registrar` | not evaluable |

- GIVEN a request with one current document with the sello in the row
- WHEN RN-12 is evaluated
- THEN the request-level outcome is the document check, with reason `not_registered` when not evaluable

#### Scenario: SC-08 sello ausente (A5 SC-08, RF-14 b, RN-12)

- GIVEN a `medica` request whose only document is registered with type `constancia_medica`, firma `Sí` and sello `No`
- WHEN the signals are evaluated
- THEN RN-12 is `present`, RN-11 and RN-13 are `absent`, and the verdict is "review carefully"

#### Scenario: Firma and sello are independent

- GIVEN a document with firma `Sí` and sello `Sin registrar`
- WHEN RN-11 and RN-12 are evaluated
- THEN RN-11 is `absent` and RN-12 is `not_evaluable` with `not_registered`

#### Scenario: The special format has no exemption (A5 SC-11 a and b)

RN-11 and RN-12 apply to the firma and sello of the issuer (thesis
`tesis/04_propuesta/4.2_requisitos.md`, RN-11 and RN-12). The signature and seal
of the coordination on the special format belong to RN-19 (RF-09 b), not to these
signals, and no exemption is made for the special format.

| Variant | Document registered as | Firma | Sello | RN-11, RN-12 | RN-13 |
|---|---|---|---|---|---|
| SC-11 b, signed and sealed | `constancia_institucional` | `Sí` | `Sí` | `absent` | `absent` |
| SC-11 a, without signature or seal | `constancia_institucional` | `No` | `No` | `present` | `absent` |

- GIVEN a `fuerza_mayor` request whose current student-uploaded document is the FIA special format form (a staff-uploaded special-format document does not count, see MD-16), registered as in the row
- WHEN the signals are evaluated
- THEN the outcomes are as shown
- AND the A5 expectation "Ninguna" for SC-11 a does not hold when the secretary marks `No`; the thesis updates it (see the thesis sync list of the tasks)

### Requirement: MD-14 Formato no corresponde a la causa, RN-13 (RF-05 e, RF-14 d, RN-13)

Thesis: RF-05 (e) «Un documento cuyo tipo registrado no corresponde a la causa
declarada muestra la señal “formato no corresponde a la causa”.»; RN-13 «Un
documento cuyo formato no corresponde a la causa declarada genera la señal
“formato no corresponde a la causa”.» Signal code `rn13` (es "Formato no
corresponde a la causa", en "Format does not match the cause"). For each current
document the check MUST be `present` when its registered type does not
correspond to the declared cause by the correspondence of "Type-to-cause
correspondence", `absent` when it corresponds, and not evaluable for that
document when the type is not registered (D1). The type `otro` corresponds to
no cause (Anexo D D11: "Otro activa la señal de RN-13"): RN-13 MUST be `present`
for it whatever the cause. The check MUST NOT depend on the extraction state and
MUST NEVER be `not_applicable`: it applies to the five causes. The request-level
outcome follows "Aggregation and reasons of RN-11, RN-12 and RN-13".

#### Scenario: RF-05 (e) tipo discordante (unit test, 4.9 "tipo discordante")

- GIVEN a presented request of cause `actividad_representativa` with one document of registered type `constancia_medica`
- WHEN the signals are evaluated
- THEN RN-13 is `present`, and the other signals are as without the document type

#### Scenario: Correspondence (table-driven, every type and cause)

| Declared cause | `constancia_medica` | `constancia_institucional` | `otro` |
|---|---|---|---|
| `medica` | absent | present | present |
| `maternidad_paternidad` | absent | present | present |
| `actividad_representativa` | present | absent | present |
| `intercambio_academico` | present | absent | present |
| `fuerza_mayor` | present | absent | present |

- GIVEN a request of the cause in the row with one document of the type in the column
- WHEN RN-13 is evaluated
- THEN the outcome is as shown

#### Scenario: SC-05 tipo discordante (A5 SC-05, RF-14 d, RN-13)

- GIVEN an `actividad_representativa` request whose document, a medical certificate, is registered as `constancia_medica`
- WHEN the signals are evaluated
- THEN RN-13 is `present` and the verdict is "review carefully"

#### Scenario: Institutional documents correspond to their causes (A5 SC-10, SC-06, SC-13, SC-11 b)

| Scenario | Declared cause | Document registered as | RN-13 |
|---|---|---|---|
| SC-10 sports letter of the UAM (CD) | `actividad_representativa` | `constancia_institucional` | absent |
| SC-06 employer letter (CI) | `fuerza_mayor` | `constancia_institucional` | absent |
| SC-13 foundation letter (CI) | `intercambio_academico` | `constancia_institucional` | absent |
| SC-11 b special format of the FIA (FE), signed and sealed by the coordination | `fuerza_mayor` | `constancia_institucional` | absent |

- GIVEN the request of the row with its document registered as shown
- WHEN RN-13 is evaluated
- THEN the outcome is as shown, and no signal is raised by the type

#### Scenario: Medical certificate for a medical cause (A5 SC-01, SC-09)

- GIVEN a `medica` request whose document is registered as `constancia_medica` (SC-01 and SC-09)
- WHEN RN-13 is evaluated
- THEN it is `absent`

#### Scenario: `otro` always raises the signal

- GIVEN a document registered as `otro`
- WHEN RN-13 is evaluated once for each of the five causes
- THEN it is `present` every time

#### Scenario: Type not registered

- GIVEN a document whose type is not registered
- WHEN RN-13 is evaluated
- THEN the document is not evaluable and the request-level outcome is `not_evaluable` with `not_registered`

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

#### Scenario: A parameter change flips the signal on the next read

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
### Requirement: MD-16 Aggregation and reasons of RN-11, RN-12 and RN-13 (RF-05 a, D1, D5)

At request level each of RN-11, RN-12 and RN-13 MUST follow the STRICT rule
(D1; thesis `tesis/04_propuesta/4.6_vista_desarrollo.md` line 33: «Las señales
que dependen de ese dato quedan sin evaluar»): `present` if any current
document is `present` (any-document aggregation, D5); `absent` only when EVERY
current document has the datum registered (firma, sello or type) and none is
`present`; otherwise `not_evaluable`: with `no_eligible_documents` when the
request has no current document, and with `not_registered` when at least one
current document is not registered for the datum the signal needs and none is
`present`. The rule is deliberately stricter than the aggregation of RN-09,
where one evaluable document is enough for `absent`: here an unregistered
document is the very document the signal exists to catch, so it MUST keep the
signal open. Retired,
staff-uploaded and special-format documents MUST NOT count. A `present` outcome
MUST carry as evidence only the ids of the documents that raise it, and never a
name, issuer, date, mark value of another document, type code or fingerprint.
The verdict MUST treat each of the three like any other signal (see "Three-state
suggested verdict").

#### Scenario: Aggregation over several documents (table-driven, RN-11)

| Document A firma | Document B firma | Request outcome |
|---|---|---|
| `No` | `Sí` | `present` |
| `Sí` | `No` | `present` |
| `Sí` | `Sí` | `absent` |
| `Sí` | `Sin registrar` | `not_evaluable`, `not_registered` |
| `No` | `Sin registrar` | `present` |
| `Sin registrar` | `Sin registrar` | `not_evaluable`, `not_registered` |

- GIVEN a request with the two current documents in the row
- WHEN RN-11 is evaluated
- THEN the outcome is as shown, and the same table holds for RN-12 with the sello and for RN-13 with the type check

#### Scenario: One unregistered document keeps the signal open (strict rule, D1)

- GIVEN a request with two current documents, A with firma `Sí` and B with firma `Sin registrar`
- WHEN RN-11 is evaluated
- THEN it is `not_evaluable` with `not_registered`, never `absent`
- AND once the secretary registers firma `Sí` for B, RN-11 is `absent`

#### Scenario: No current document

- GIVEN a request whose only document is retired
- WHEN RN-11, RN-12 and RN-13 are evaluated
- THEN each is `not_evaluable` with `no_eligible_documents`

#### Scenario: Evidence holds document ids only

- GIVEN RN-12 `present` for document 41
- WHEN the outcome is serialized
- THEN its evidence holds the id 41 and no name, issuer, date, type code or fingerprint

#### Scenario: Retired and special-format documents ignored

- GIVEN a retired document with firma `No` and a staff-uploaded special format with firma `No`, and one current document with firma `Sí`
- WHEN RN-11 is evaluated
- THEN it is `absent`
