# Delta for Student Requests

Covers RF-05 (a), RN-15, RN-26, RNF-01, RNF-02. Slice S1 (checked again in S2
and S3). The existing requirements "Own requests list" and "Own request
detail with decision" are unchanged; this delta adds a prohibition that applies
to every student view.

## ADDED Requirements

### Requirement: Students never see validation signals (RF-05, RN-26, RNF-01, RNF-02, E13)

No student view, response or notification MUST contain a signal, an outcome, a
reason code, the suggested verdict, a document fingerprint, or any trace that a
document of the student was matched with another request. This MUST hold for the
list, the detail, the correction flow, the upload and finalize results, and the
decision and escalation texts. The student view MUST NOT receive signal data
from the server. A student whose earlier document was reused by someone else
MUST NOT learn of it: the signals of the earlier request never change.

#### Scenario: Detail and list carry no signal data

- GIVEN a presented request whose signals include `present` outcomes
- WHEN its owner opens `/requests` and `/requests/[id]`
- THEN no signal, outcome, reason, verdict or fingerprint appears in the rendered output or the data sent to the client

#### Scenario: Returned and rejected requests

- GIVEN a `devuelta` or `rechazada` request with RN-07 `present`
- WHEN the owner opens the detail
- THEN only the state, the reason and the decision text are shown, and the decision text is whatever the secretary wrote

#### Scenario: Correction and upload results

- GIVEN a student correcting a returned request with a file whose fingerprint matches an earlier request
- WHEN the file is finalized and the correction is submitted
- THEN the result messages are those of the existing flow, with no mention of a repeated document

#### Scenario: Owner of the earlier document

- GIVEN a student E whose document was later reused by another student's request
- WHEN E opens the list and the detail of the earlier request
- THEN nothing indicates the reuse

#### Scenario: Another student's request

- GIVEN a request of student A with signals
- WHEN student B opens its id
- THEN the response equals that of a nonexistent id and no data is returned
