# Delta for Request Review

Covers RF-05 (a), (b); RN-15, RNF-12. Signal rules, the cause cut and the
verdict live in `validation-signals`; this delta covers only their presentation
on the staff detail. The extracted-data section is NOT changed: an extraction
that invented a rest period on a non-rest cause is still shown there as stored.

## MODIFIED Requirements

### Requirement: Signals section and suggested verdict on the staff detail (RF-05 a, RF-05 d, RN-15, RNF-01)

Slice S1 (RN-07, RN-09, RN-10, RN-14), S2 adds the RN-26 entry. In addition to
the content of "Staff detail with history", the staff detail of any presented
request (never a `borrador`) MUST show a "Señales de validación" / "Validation
signals" section, after the "Extracted data" section, with: the suggested
verdict in words and a sentence stating that it does not change the state of the
request; one entry per signal with its name and outcome (`present`, `absent`,
`not_evaluable` or, for RN-09 and RN-10 only, `not_applicable`) in words; and
the signals that are `not_evaluable` listed apart from the verdict, each with
its reason as text. A `not_applicable` entry MUST read "No aplica" (`es`), MUST
show no evidence, MUST carry a muted explanation line "La causa declarada
no incluye reposo." (`es`), and MUST NOT be listed apart with the
`not_evaluable` ones. The five entries MUST keep the fixed order RN-07, RN-09,
RN-10, RN-14, RN-26. The RN-26 entry, when `present`, MUST show the number of
each matching earlier request inside the secretary's scope as a link to its
staff detail, and nothing else about it. The section MUST be visible only to the
roles that may open the staff detail, under the same scope rules, MUST NOT be
shown in the queue or in any tab, and MUST be shown in every state of the
request, including decided ones. The section MUST offer no action and MUST NOT
alter the decision controls.
(Previously: three outcomes; no `not_applicable` entry or explanation line.)

#### Scenario: Section content

- GIVEN a `pendiente` request with RN-07 `present`, RN-09 `absent` and RN-10 `not_evaluable` with `extraction_pending`
- WHEN an in-scope secretary opens its detail
- THEN the section shows the verdict "review carefully", the three outcomes in words, and RN-10 listed apart with its reason

#### Scenario: Not applicable entries

- GIVEN a `fuerza_mayor` request whose extraction has rest ending before the issue date, and RN-07, RN-14, RN-26 `absent`
- WHEN an in-scope secretary opens its detail
- THEN RN-09 and RN-10 read "No aplica" with the muted line "La causa declarada no incluye reposo." and no evidence, "fechas incoherentes" is not shown, and the verdict reads "Sin alertas"
- AND neither entry appears among the signals listed apart as not evaluated

#### Scenario: Extracted data section unchanged for a non-rest cause

- GIVEN the same `fuerza_mayor` request
- WHEN the secretary opens its detail
- THEN the extracted-data section still shows the stored rest period exactly as before this change

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

### Requirement: Signals UI i18n (RNF-12)

Slice S1 (RN-26 keys S2). All texts of the signals section (section title,
signal names, outcomes including `not_applicable`, verdict labels, the
display-only sentence, reason labels, the explanation line of a not applicable
signal, the degraded notice and the reference wording) MUST exist in both
`i18n/es.json` and `i18n/en.json` under `review.signals.*` with the same keys.
The `es` text MUST be in neutral professional Spanish with no voseo.
(Previously: no `not_applicable` outcome or explanation line in the list.)

#### Scenario: Translation keys present

- GIVEN the review signals keys
- WHEN `es.json` and `en.json` are compared
- THEN both contain the same keys, including the `not_applicable` outcome and its explanation line

#### Scenario: Verdict wording

- GIVEN the verdict labels
- WHEN each locale is read
- THEN "review carefully", "no alerts" and "inconclusive" exist, with the `es` intents «Revisar con cuidado», «Sin alertas» and «No concluyente»

#### Scenario: Not applicable wording

- GIVEN the `not_applicable` label and its explanation line
- WHEN the `es` locale is read
- THEN they read "No aplica" and "La causa declarada no incluye reposo.", with no voseo, and `en` holds an English text for each
