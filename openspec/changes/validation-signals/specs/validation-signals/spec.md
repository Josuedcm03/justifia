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

Known limitations (documented, not defects): RNF-14 is not met, because the
recurrence threshold is a code constant until roadmap #8; RN-26 matches exact
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

### Requirement: Three outcomes with a closed set of reasons (RF-05 a, RN-15)

Slice S1 (S2 adds the RN-26 codes). Every signal MUST yield exactly one outcome:
`present`, `absent` or `not_evaluable`. A `not_evaluable` outcome MUST carry
exactly one reason code from this closed set, and `present` and `absent` MUST
carry none. A signal MUST be `not_evaluable` only when an input it needs is
missing, never as a fallback for an error.

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

- GIVEN every signal evaluated over the input combinations of this spec
- WHEN the outcomes are collected
- THEN each respects the row and no other code or free text exists

#### Scenario: Precedence of reasons

- GIVEN a request with a `fallida` document and a `completada` document with a days-only rest period
- WHEN RN-09 is evaluated and no document is evaluable
- THEN the outcome is `not_evaluable` with `extraction_failed`

### Requirement: Late presentation, RN-07 (RF-05 a, RN-07, RN-08)

Slice S1. The signal MUST be `present` when the Managua date of the first
presentation (`presentadaEn`, never the resubmission time `reenviadaEn`) is
after `deadlineOf(fechaFin)` (the second business day strictly after the
absence end date, RN-08, using the same calendar and function as the queue).
It MUST be `absent` when that date is on or before the deadline. It MUST be
`not_evaluable` with `calendar_not_covering_year` when the calendar does not
cover the year of the deadline. The signal MUST NOT depend on extraction.

#### Scenario: Boundary dates (table-driven, calendar without holidays)

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

#### Scenario: Managua date, not UTC

- GIVEN `fechaFin` Fri 2026-10-09 and a first presentation at 2026-10-14 03:00 UTC (Tue 21:00 in Managua)
- WHEN the signal is evaluated
- THEN the outcome is `absent`

#### Scenario: Resubmission does not restart the signal

- GIVEN a request first presented Wed 2026-10-14 (deadline Tue 2026-10-13), returned, and resubmitted on Thu 2026-10-15
- WHEN the signal is evaluated
- THEN the outcome is `present` (the first presentation counts), and a request first presented on time and resubmitted late stays `absent`

#### Scenario: Calendar does not cover the deadline year

- GIVEN `fechaFin` Thu 2027-12-30, whose deadline falls in 2028, and a calendar covering 2026 and 2027
- WHEN the signal is evaluated
- THEN the outcome is `not_evaluable` with `calendar_not_covering_year`
- AND a `fechaFin` whose deadline falls in 2027 is evaluated normally

### Requirement: Incoherent dates, RN-09 (RF-05 a, RF-05 b, RN-09)

Slice S1. Per current document with a `completada` extraction row, the check
MUST be `present` when the end of the rest period (`reposoHasta`) is before the
issue date (`fechaEmision`), `absent` when it is on or after it, and not
evaluable for that document when the issue date or the end date is missing
(`field_missing`, or `days_only` when the rest period has days and no dates), or
when the extraction row is `pendiente`, `procesando`, missing
(`extraction_pending`) or `fallida` (`extraction_failed`). At request level the
signal MUST be `present` if any document is `present`; `absent` if at least one
document is evaluable and none is `present`; otherwise `not_evaluable` with the
reason chosen by the precedence of "Three outcomes with a closed set of
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

- GIVEN a request with one current document with the values in the row
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

- GIVEN a request with the two current documents in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Retired and staff documents ignored

- GIVEN a retired document that would be `present` and a staff-uploaded document with extraction data
- WHEN the signal is evaluated over a request whose only current student document is `absent`
- THEN the outcome is `absent`

### Requirement: Uncovered dates, RN-10 (RF-05 a, RN-10)

Slice S1. The signal MUST use full containment: the union, at calendar-day
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

- GIVEN a request whose current documents are all `completada` with dated periods as in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Days-only documents (table-driven)

| Dated union | Other current documents | Outcome |
|---|---|---|
| 10-05 to 10-09 | one days-only | `absent` |
| 10-05 to 10-07 | one days-only | `not_evaluable`, `days_only` |
| none | one days-only | `not_evaluable`, `days_only` |

- GIVEN absence Mon 2026-10-05 to Fri 2026-10-09 and the documents in the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

#### Scenario: Extraction pending or failed on an uncovered range

- GIVEN a dated union 10-05 to 10-07 and a second current document with extraction `pendiente`, or `fallida`
- WHEN the signal is evaluated
- THEN the outcome is `not_evaluable` with `extraction_pending`, or `extraction_failed`, and never `present`

### Requirement: Recurrence, RN-14 (RF-05 a, RF-05 c, RN-14)

Slice S1. The issuer of each current `completada` document MUST be normalized
before comparison: Unicode decomposition with diacritics removed, lower case,
punctuation removed and whitespace collapsed and trimmed. For each normalized
issuer of the request, the count MUST be the number of distinct presented
requests of the same student, in the same academic period (`Grupo.periodo` of
the request's subjects), that have a current document with that issuer, in the
order of presentation up to and including the current request. The signal MUST
be `present` when any count reaches the threshold, and `absent` otherwise. The
threshold MUST be an input of the evaluation (initial value 3), not read inside
the evaluator. Requests of other students, of other periods, drafts, and
requests later in the order of presentation MUST NOT count. A request MUST be
`not_evaluable` with `no_period` when its subjects do not give exactly one
period, with `extraction_pending` or `extraction_failed` when no current
document is `completada` yet or failed, and with `field_missing` when the
`completada` documents have no issuer. RN-14 compares issuers of the same
student only; no cross-student volume is computed.

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

#### Scenario: One request counts once

- GIVEN a request with two current documents of the same issuer
- WHEN the count is computed
- THEN that request adds 1 to the count, not 2

#### Scenario: Threshold is a parameter

- GIVEN the same data evaluated with threshold 3 and with threshold 2
- WHEN the 2nd request is evaluated
- THEN it is `absent` with 3 and `present` with 2, with no change to the evaluator

#### Scenario: Missing inputs (table-driven)

| Situation | Outcome |
|---|---|
| subjects in two periods, or none | `not_evaluable`, `no_period` |
| every current document `pendiente` or without row | `not_evaluable`, `extraction_pending` |
| every current document `fallida` | `not_evaluable`, `extraction_failed` |
| `completada` documents without issuer | `not_evaluable`, `field_missing` |

- GIVEN a request in the situation of the row
- WHEN the signal is evaluated
- THEN the outcome is as shown

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
| presented, document H retired by a correction | document H | `present` | `absent` |
| draft with document H | document H | `absent` | not applicable |
| presented, document H uploaded by staff | document H | `absent` | `absent` |
| presented, document H special format | document H | `absent` | `absent` |
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

Slice S1 (the verdict covers the signals delivered so far; S2 adds RN-26 to
the set). The verdict MUST be computed from the outcomes of all signals as:
`review_carefully` ("review carefully") when any signal is `present`;
`no_alerts` ("no alerts") when no signal is `present` and every signal is
`absent`; `inconclusive` when no signal is `present` and at least one is
`not_evaluable`. The signals that are `not_evaluable` MUST be listed apart from
the verdict, each with its reason, so the secretary sees what was not checked.
The verdict MUST be a suggestion: its text MUST state that it does not change
the state of the request.

#### Scenario: Verdict table (table-driven)

| Outcomes of the signals | Verdict | Listed apart |
|---|---|---|
| one `present`, others any | `review_carefully` | the `not_evaluable` ones |
| all `absent` | `no_alerts` | none |
| none `present`, one `not_evaluable` | `inconclusive` | that one with its reason |
| none `present`, all `not_evaluable` | `inconclusive` | all of them |

- GIVEN signal outcomes as in the row
- WHEN the verdict is computed
- THEN the verdict and the list are as shown

#### Scenario: Present beats not evaluable

- GIVEN RN-07 `present` and RN-09, RN-10, RN-14 `not_evaluable` for extraction
- WHEN the verdict is computed
- THEN it is `review_carefully` and the three are listed as not evaluable

#### Scenario: Extraction not available

- GIVEN a request with extraction rows `pendiente` and RN-07 `absent`
- WHEN the verdict is computed
- THEN it is `inconclusive`, never `no_alerts`

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
with the same keys. Outcome and verdict MUST be conveyed as text, never by color
alone.

#### Scenario: Translation keys present

- GIVEN the `review.signals.*` keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys, one text per signal, outcome, verdict and reason code

#### Scenario: Text, not color

- GIVEN a `present` signal and a `not_evaluable` signal
- WHEN the section renders
- THEN each states its outcome in words
