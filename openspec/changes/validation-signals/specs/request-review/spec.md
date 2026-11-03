# Delta for Request Review

Covers RF-05 (a), (d), RN-15, RNF-01, RNF-06, RNF-12. Signal rules, reason
codes and the verdict live in `validation-signals`; this delta covers only
their presentation on the staff detail. The staff detail adds one section and
changes no existing behavior, so every requirement is ADDED.

## ADDED Requirements

### Requirement: Signals section and suggested verdict on the staff detail (RF-05 a, RF-05 d, RN-15, RNF-01)

Slice S1 (RN-07, RN-09, RN-10, RN-14), S2 adds the RN-26 entry. In addition to
the content of "Staff detail with history", the staff detail of any presented
request (never a `borrador`) MUST show a "Señales de validación" / "Validation
signals" section, after the "Extracted data" section, with: the suggested
verdict in words and a sentence stating that it does not change the state of the
request; one entry per signal with its name and outcome (`present`, `absent`,
`not_evaluable`) in words; and the signals that are `not_evaluable` listed apart
from the verdict, each with its reason as text. The RN-26 entry, when `present`,
MUST show the number of each matching earlier request inside the secretary's
scope as a link to its staff detail, and nothing else about it. The section MUST
be visible only to the roles that may open the staff detail, under the same
scope rules, MUST NOT be shown in the queue or in any tab, and MUST be shown in
every state of the request, including decided ones. The section MUST offer no
action and MUST NOT alter the decision controls.

#### Scenario: Section content

- GIVEN a `pendiente` request with RN-07 `present`, RN-09 `absent` and RN-10 `not_evaluable` with `extraction_pending`
- WHEN an in-scope secretary opens its detail
- THEN the section shows the verdict "review carefully", the three outcomes in words, and RN-10 listed apart with its reason

#### Scenario: Decision controls untouched

- GIVEN a `pendiente` request with the verdict "review carefully"
- WHEN the secretary opens its detail
- THEN approve, reject, return and escalate are offered exactly as without the section

#### Scenario: Shown after the decision

- GIVEN an `aprobada` request
- WHEN the in-scope secretary opens its detail
- THEN the signals section is shown, computed from the current data

#### Scenario: Not in the queue or the tabs

- GIVEN requests with different verdicts
- WHEN the secretary opens each tab of `/review`
- THEN no row shows a signal, an outcome or a verdict

#### Scenario: Reference to an earlier request (S2)

- GIVEN RN-26 `present` with an in-scope earlier request number 41
- WHEN the secretary opens the detail
- THEN the entry shows "41" as a link to the staff detail of 41 and no student name or document name

#### Scenario: Match outside the scope shows no reference (S2)

- GIVEN RN-26 `present` against an earlier request of another facultad
- WHEN the secretary opens the detail
- THEN the entry reads `present` with no number and no link

#### Scenario: Not for other roles

- GIVEN a request with signals
- WHEN its owner opens `/requests/[id]`, or a `coordinacion` of another career, a `docente` or an `administrador` requests the staff detail
- THEN no signal data is shown or returned

### Requirement: Signals are fail-soft and add no audit row (RF-05, RNF-06)

Slice S1. The signals read MUST be fail-soft: if it fails or throws, in whole or
for any signal, the staff detail MUST still load completely and the section MUST
show a degraded notice in place of the verdict and the entries, with no partial
or stale value and no verdict computed from a subset. Showing the section MUST
add no audit row beyond the existing `solicitud.consultada` and MUST NOT add an
audit event type.

#### Scenario: Read failure

- GIVEN the signals read throws
- WHEN the secretary opens the detail
- THEN the rest of the detail renders, the section shows the degraded notice, and no verdict is shown

#### Scenario: One signal's query fails

- GIVEN the RN-14 history query throws and the other signals succeed
- WHEN the secretary opens the detail
- THEN the degraded notice is shown and no partial verdict appears

#### Scenario: One audit row

- GIVEN a presented request with signals
- WHEN the secretary opens the detail once
- THEN exactly one `solicitud.consultada` row is written and no other

### Requirement: Signals UI i18n (RNF-12)

Slice S1 (RN-26 keys S2). All texts of the signals section (section title,
signal names, outcomes, verdict labels, the display-only sentence, reason
labels, the degraded notice and the reference wording) MUST exist in both
`i18n/es.json` and `i18n/en.json` under `review.signals.*` with the same keys.
The `es` text MUST be in neutral professional Spanish with no voseo.

#### Scenario: Translation keys present

- GIVEN the review signals keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys

#### Scenario: Verdict wording

- GIVEN the verdict labels
- WHEN each locale is read
- THEN "review carefully", "no alerts" and "inconclusive" exist, with the `es` intents «Revisar con cuidado», «Sin alertas» and «No concluyente»
