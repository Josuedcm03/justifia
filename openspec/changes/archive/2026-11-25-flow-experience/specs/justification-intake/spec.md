# Delta for Justification Intake

Change: `flow-experience` (roadmap row 13). Tabla 19 row RF-01 (5.8:13, 4.9
case RF-01, Anexo F RF-01-a to RF-01-d). The diagnosis of 2026-11-20 found no
defect: the participant registered someone else's dates, and the system accepts
future absence dates by design. The changes are defensive and change no
validation: "Cause and dates rules" (future dates allowed, RN-05, RN-23) and
"Submit blocking, per field" stay as they are. Owner decision 2026-11-20: a
future start date gets a non-blocking notice.

## ADDED Requirements

### Requirement: FE-18 Dates recap on the subjects and documents steps (RF-01 a, b, c; RF-03 a, b; RF-04 a; RN-05, RN-22; RNF-11)

Once the dates of the draft are valid, the subjects step (step 2) and the
documents step (step 3) MUST show a recap of the absence dates: the start and end
dates written with the weekday and the month name (a single date with its
weekday when both are the same day), under the label "Fechas de ausencia"
(`en`: "Absence dates"). The recap MUST include an "Editar fechas" (`en`: "Edit
dates") link that opens step 1 with the draft's data intact. The recap MUST show
Managua calendar dates with no time-zone shift, MUST be read-only, and MUST be
the same dates that step 4 shows. The same recap applies in the correction flow,
which reuses these steps. The recap MUST be usable at 360 px with no horizontal
scroll and its texts MUST exist in `es` and `en`. It MUST add no audit row.

#### Scenario: Recap on step 2 (4.9 RF-01 a, c)

- GIVEN a draft with start 2026-10-29 and end 2026-10-30
- WHEN the student opens the subjects step
- THEN the recap shows both dates with their weekdays and month names under "Fechas de ausencia"
- AND the subjects listed are those with class in those dates

#### Scenario: Recap on step 3

- GIVEN the same draft
- WHEN the student opens the documents step
- THEN the same recap is shown

#### Scenario: Edit link returns to the dates

- GIVEN the recap on step 2
- WHEN the student activates "Editar fechas"
- THEN step 1 opens with the cause and both dates as saved

#### Scenario: Single-day absence

- GIVEN a draft whose start and end dates are the same day
- WHEN the recap renders
- THEN it shows that one date with its weekday

#### Scenario: Recap equals the review

- GIVEN a draft with valid dates
- WHEN the recap of step 2 and the review step are compared
- THEN they show the same dates

#### Scenario: No recap without valid dates

- GIVEN a draft without valid dates
- WHEN the student opens step 2
- THEN no recap is shown and the message that asks for dates first is shown

#### Scenario: Recap in the correction flow

- GIVEN a returned request being corrected
- WHEN the owner opens steps 2 and 3
- THEN the recap shows the request's current dates

#### Scenario: 360 px

- GIVEN a 360 px viewport
- WHEN steps 2 and 3 render with the recap
- THEN the document width does not exceed the viewport

### Requirement: FE-19 A future start date gets a non-blocking notice (RF-01 a, b; RF-03 a, b; RN-05, RN-23; RNF-11)

When the start date of the draft is later than today (America/Managua), the
system MUST show an informational notice on the cause and dates step and in the
dates recap of FE-18, stating that the absence has not started yet and asking
the student to check the dates. The notice MUST NOT block moving between steps or
submitting, MUST NOT be reported as an invalid field, and MUST NOT change any
validation outcome: the request is accepted as before (RN-05 and RN-23 hold).
When the start date is today or earlier, no notice is shown. The notice MUST be
text, never color alone, MUST NOT use error styling, MUST be removed as soon as
the start date is no longer in the future, MUST store nothing and add no audit
row, and its texts MUST exist in `es` and `en`.

#### Scenario: Future start shows the notice

- GIVEN today is 2026-11-02 in Managua and the student enters start 2026-11-10 and end 2026-11-12
- WHEN the dates step renders
- THEN the notice is shown and the dates recap of steps 2 and 3 carries it too

#### Scenario: Boundary (table-driven)

| Start date compared with today | Notice |
|---|---|
| tomorrow | shown |
| today | not shown |
| yesterday | not shown |

- GIVEN a draft with the start date in the row
- WHEN the dates step renders
- THEN the notice is as shown

#### Scenario: Notice does not block submission (4.9 RF-01 a to c)

- GIVEN a draft with a future start date, valid cause, two subjects, one document and consent
- WHEN the student submits
- THEN the request is `pendiente` with the student's account data and both subjects, exactly as without the notice

#### Scenario: Notice is not a field error

- GIVEN a draft with a future start date and no cause
- WHEN the student submits
- THEN the response lists the cause error only, and the notice is not among the invalid fields

#### Scenario: Notice clears when the date changes

- GIVEN the notice shown for a future start date
- WHEN the student changes the start date to today
- THEN the notice is no longer shown

#### Scenario: Managua date decides

- GIVEN a server instant of 2026-11-02 02:00 UTC (2026-11-01 20:00 in Managua) and a start date of 2026-11-02
- WHEN the notice is evaluated
- THEN the notice is shown, because today in Managua is 2026-11-01

#### Scenario: Translation keys present

- GIVEN the notice and recap keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys
