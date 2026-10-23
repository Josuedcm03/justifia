# Delta for Justification Intake

Covers RF-11. What the extraction does lives in `document-extraction`.

## MODIFIED Requirements

### Requirement: Cleanup sweep execution (D8, D10)

The sweep MUST be callable only by the platform scheduler; a call without the
scheduler credential MUST be rejected with no effect. It MUST be idempotent,
MUST continue past a single failing item, and MUST report counts. Its cleanup
steps (expired drafts, unfinished documents, orphan files) MUST NOT touch
requests in any state other than `borrador`. Its extraction step (see "Sweep
re-enqueues document extraction") MUST NOT delete or modify any request or
document; it only hands documents of `pendiente` requests to the extraction
queue. A failure of any step MUST NOT stop the others.
(Previously: the sweep had no extraction step and MUST NOT touch requests in any state other than `borrador`.)

#### Scenario: Unauthorized sweep call

- GIVEN a request without the scheduler credential
- WHEN it calls the sweep endpoint
- THEN it is rejected and nothing is deleted or enqueued

#### Scenario: One failure does not stop the sweep

- GIVEN three expired drafts and a blob deletion failing for the second
- WHEN the sweep runs
- THEN the other two are deleted and the failure is reported

#### Scenario: Pending requests untouched

- GIVEN a `pendiente` request older than 30 days
- WHEN the sweep runs
- THEN it still exists, unchanged, and none of its documents is deleted

#### Scenario: Extraction failure does not stop cleanup

- GIVEN the extraction step throws
- WHEN the sweep runs
- THEN the draft cleanup steps still ran and the failure is reported

## ADDED Requirements

### Requirement: Sweep re-enqueues document extraction (RF-11)

After the cleanup steps, the sweep MUST run a re-enqueue step that hands to the
extraction queue: rows in `pendiente`, rows in `procesando` whose lease
expired, and eligible documents (see `document-extraction`) that have no row.
It MUST consider only documents of requests in `pendiente`; `completada`,
`fallida` and `no_aplica` rows and documents of requests in any other state
MUST be left alone. Each run MUST be bounded to a fixed maximum number of
documents, oldest request first by clock start, so that requests already
`pendiente` when this change ships are extracted over successive runs. The
step MUST be idempotent, MUST write no audit row, and the sweep report MUST
include the number of documents re-enqueued, never document data.

#### Scenario: Missing row recovered

- GIVEN a `pendiente` request whose valid document has no row (post-commit hand-off was lost)
- WHEN the sweep runs
- THEN the row is registered and the document is processed

#### Scenario: Expired lease recovered

- GIVEN a `procesando` row with an expired lease on a `pendiente` request
- WHEN the sweep runs
- THEN the document is handed to the queue again

#### Scenario: Only pending requests

- GIVEN `pendiente` rows on a request now `aprobada` and on a request in `devuelta`
- WHEN the sweep runs
- THEN neither row is handed to the queue

#### Scenario: Backfill is bounded

- GIVEN more eligible documents of `pendiente` requests than the batch limit
- WHEN the sweep runs on consecutive days
- THEN each run hands over at most the limit, oldest request first, until none remain

#### Scenario: Not configured

- GIVEN extraction is not configured
- WHEN the sweep runs
- THEN rows stay `pendiente`, no attempt is counted and no error aborts the sweep
