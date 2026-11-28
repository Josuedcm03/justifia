# Delta for Request Review

Change `normative-parameters`. Requirements covered: RNF-14, RN-08. Thesis: CU-13,
Annex D Table D19. The remission days, the alert days and the calendar of
non-business days come from `normative-parameters` (NP-2, NP-10) instead of code
constants. [PG] marks a scenario that MUST run on a real PostgreSQL. The effect of a
saved change on the next read is proven by unit tests that inject the loader value
and by the owner system test (NP-14), not by a Postgres case (scope cut, 2026-11-27).

## Notes for archive

- Purpose: no edit. The "Terms" paragraph still defines "business day" as Monday
  to Friday that is not in the non-working-days calendar; the calendar is now data.
- Every other requirement of this capability is unchanged, including "Review state
  tabs", whose deadline pause text and alert marks follow the modified requirement
  below.
- The real-clock staleness test of the constant calendar is retired. Its scenario
  "Calendar year not loaded" is replaced by the coverage notice.

## MODIFIED Requirements

### Requirement: Queue ordering and RN-08 alert (RF-06, RN-08)

The queue (Pendientes tab) MUST list only `pendiente` requests in scope,
ordered by effective deadline ascending (soonest first). Presentation and clock
start use Managua dates. The base remission deadline MUST be the N-th business day
strictly after the clock start date, where N is the remission-days parameter in
force (RN-08, RNF-14; default 2; with the default a weekend or holiday
presentation counts from the next business day: presented Saturday, Monday is
day 1 and Tuesday is the deadline); the request is due at the end of that day.
The effective deadline MUST be the base deadline moved later by the number of
business days the request spent in coordination since the clock start. Paused
business days for one answered escalation MUST be the business days `d` with
`E <= d < A`, where `E` is the Managua date of the escalation and `A` the
Managua date of its answer; pauses of several escalations add up, and an
escalation made before the current clock start (a resubmission restarts the
clock) MUST NOT count. A request MUST be flagged "alert" when at most A business
days remain to the effective deadline, where A is the alert-days parameter in force
(RN-08, RNF-14; default 1), and flagged "overdue" when today is after it. Alert
state MUST be computed on read, not stored. Business-day logic MUST be a pure
function using a `NonWorkingDaysProvider` port whose dates are the `calendario`
parameter, and it MUST receive the remission days and the alert days as inputs. The
parameters in force at read time MUST apply to every `pendiente` request, including
those presented before the change; the stored clock start (`PlazoInicioEn`) MUST NOT
be recomputed. The queue MUST show a calendar coverage notice, as text, when the
calendar holds no non-working date of the current Managua year, and MUST NOT show it
otherwise; the rows MUST still be listed. A request in `en_revision_coordinacion`
MUST NOT appear in the queue and MUST NOT be flagged.
(Previously: the deadline was always the second business day and the alert always at one business day left, both code constants; the calendar was a code constant checked by a real-clock test.)

#### Scenario: Ordering

- GIVEN pendiente requests with clock starts Tue, Mon and a resubmitted one with `ReenviadaEn` Wed, none escalated
- WHEN the queue is read
- THEN the order is Mon, Tue, Wed (by the `COALESCE` value)

#### Scenario: Alert and overdue boundaries (table-driven, defaults 2 and 1)

| Presented (Managua) | Today | State |
|---|---|---|
| Mon | Mon | none (2 business days left) |
| Mon | Tue | alert (1 left) |
| Mon | Wed | alert (0 left, due today) |
| Mon | Thu | overdue |
| Fri | Mon | alert |
| Sat | Mon | alert (1 left, deadline Tue) |
| Sat | Tue | alert (0 left, due today) |
| Sat | Wed | overdue |

- GIVEN no holidays, no escalation, remission days 2, alert days 1 and the row values
- WHEN the queue is read
- THEN the state is as shown

#### Scenario: Remission days change the deadline (table-driven, alert days 1)

| Remission days | Presented | Today | State |
|---|---|---|---|
| 3 | Mon | Mon | none (3 left, deadline Thu) |
| 3 | Mon | Tue | none (2 left) |
| 3 | Mon | Wed | alert (1 left) |
| 3 | Mon | Thu | alert (0 left, due today) |
| 3 | Mon | Fri | overdue |
| 1 | Mon | Mon | alert (1 left, deadline Tue) |
| 1 | Mon | Wed | overdue |

- GIVEN no holidays, no escalation and the row values
- WHEN the queue is read
- THEN the state is as shown

#### Scenario: Alert days change the alert (table-driven, remission days 2, presented Mon)

| Alert days | Today | State |
|---|---|---|
| 0 | Tue | none (1 left) |
| 0 | Wed | alert (0 left, due today) |
| 2 | Mon | alert (2 left) |
| 2 | Thu | overdue |

- GIVEN no holidays and the row values
- WHEN the queue is read
- THEN the state is as shown

#### Scenario: A parameter change applies to the next read

- GIVEN a request presented Monday, remission days 2, and today Tuesday so the request is flagged alert
- WHEN the maintainer saves remission days 3 and the queue is read again
- THEN the same request is not flagged and its deadline is Thursday

#### Scenario: A calendar change moves the deadline

- GIVEN a request presented Monday with deadline Wednesday
- WHEN Tuesday is added to the calendar and the queue is read
- THEN the deadline is Thursday

#### Scenario: Stored clock start is kept

- GIVEN a request whose answered escalation stored `PlazoInicioEn` under the old calendar
- WHEN a date is added to the calendar and the queue is read
- THEN the stored `PlazoInicioEn` is unchanged and the deadline is computed from it with the new calendar

#### Scenario: Holiday skipped

- GIVEN Tuesday is a non-working day and a request presented Monday
- WHEN today is Wednesday
- THEN the request is alert (deadline Thursday), not overdue

#### Scenario: Managua date, not UTC

- GIVEN a request presented at 2026-10-12 02:00 UTC (Sunday 20:00 in Managua)
- WHEN its deadline is computed
- THEN the clock start date is Sunday and the deadline is Tuesday

#### Scenario: Calendar coverage notice

- GIVEN the calendar holds no non-working date of the current Managua year, and one pendiente request
- WHEN the queue is read
- THEN the coverage notice is shown as text and the request is still listed with its state

#### Scenario: No notice when the year is covered

- GIVEN the calendar holds at least one date of the current Managua year
- WHEN the queue is read
- THEN no coverage notice is shown

#### Scenario: The detail uses the same parameters

- GIVEN remission days 3 and the detail of a request presented Monday, opened on Wednesday
- WHEN the staff detail renders its deadline state
- THEN it shows the same deadline as the queue (Thursday) and the alert state of the queue

#### Scenario: Decided or escalated requests leave the queue

- GIVEN a request that was approved, rejected, returned or escalated
- WHEN the queue is read
- THEN it is absent

#### Scenario: Deadline excludes time in coordination (table-driven)

| Presented | Escalated | Answered | Effective deadline |
|---|---|---|---|
| Mon | Mon | Thu | next Mon (base Wed; paused Mon, Tue, Wed = 3; +3 = Thu, Fri, Mon) |
| Mon | Tue | Tue (same day) | Wed (0 paused) |
| Mon | Tue | next Mon | next Tue (base Wed; paused Tue to Fri = 4, weekend skipped; +4 = Thu, Fri, Mon, Tue) |

- GIVEN no holidays, remission days 2 and an answered escalation with the row values
- WHEN the request is back in the queue
- THEN its effective deadline is as shown

#### Scenario: Holiday inside the pause

- GIVEN an escalation spanning a non-working day
- WHEN paused days are counted
- THEN the non-working day is not counted

#### Scenario: Two escalations add up

- GIVEN a request answered after two separate escalations
- WHEN the effective deadline is computed
- THEN the paused business days of both are added

#### Scenario: Escalation before a resubmission is ignored

- GIVEN a request escalated and answered, later returned, corrected and resubmitted
- WHEN the effective deadline is computed
- THEN the earlier pause is not counted and the clock starts at `ReenviadaEn`

#### Scenario: Order follows the effective deadline

- GIVEN request A presented Mon with a paused business day of 3 and request B presented Tue with none
- WHEN the queue is read
- THEN B precedes A
