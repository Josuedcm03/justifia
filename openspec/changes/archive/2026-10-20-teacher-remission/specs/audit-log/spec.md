# Delta for Audit Log

Covers RF-09 c, RNF-02, RNF-06, RNF-07.

## ADDED Requirements

### Requirement: Closed set of remission events

The audit actions MUST gain exactly these six: `remision.creada`,
`remision.enviada`, `remision.fallida`, `remision.bloqueada`,
`remision.reenviada`, `documento.formato_especial`. The entity types MUST gain
`Remision` (entity id is the remission id); `documento.formato_especial` is
recorded against the uploaded document (existing entity type `DocumentoRespaldo`,
the document id) once per valid upload, in the upload's transaction. A refused
staff upload MUST reuse the existing `documento.rechazado` event with its
existing payload shape. `remision.creada` MUST be written in the approval transaction,
one per remission. `remision.enviada` MUST be written when a send succeeds,
`remision.fallida` when it fails, `remision.bloqueada` when a blocker is
detected, and `remision.reenviada` when a secretary triggers a resend. Events
MUST be built only through the central builders. Existing events and payloads
MUST be unchanged.

#### Scenario: Approval events
- GIVEN an approval creating two remissions
- WHEN the audit rows are read
- THEN one `solicitud.aprobada` and two `remision.creada` exist, committed together

#### Scenario: Send outcomes (table-driven)

| Outcome | Row |
|---|---|
| send succeeds | `remision.enviada` |
| provider error | `remision.fallida` |
| missing email, missing format, size over limit | `remision.bloqueada` |
| secretary resend | `remision.reenviada` |

- GIVEN the outcome in the row
- WHEN it completes
- THEN the row shown exists with entity type `Remision`

#### Scenario: Format upload audited
- GIVEN a secretary uploading a valid special-format file
- WHEN the upload succeeds
- THEN one `documento.formato_especial` row exists for the document with the secretary as actor
- AND its payload holds only the request id, file type code, size in bytes and the count of unblocked remissions, no file name, name or email

#### Scenario: Refused format audited
- GIVEN a secretary uploading a file whose real format or size is refused
- WHEN the upload is refused
- THEN one `documento.rechazado` row exists with the request id and reason code, and no `documento.formato_especial` row

#### Scenario: No row without an attempt
- GIVEN a denied, out-of-scope or `already_attached` resend or upload, or a retry that finds only `enviada` remissions
- WHEN processed
- THEN no audit row is written

### Requirement: Remission and format-upload payloads are code-only

Remission and `documento.formato_especial` payloads MUST be structured,
identify records by ids, and MAY carry the reason code, attachment count, file
type code, size in bytes, unblocked-remission count and the request id. They MUST NOT carry email
addresses, teacher or student names, CIF, cause, message text, file names,
provider response bodies, storage locations, or any credential.

#### Scenario: Leak check
- GIVEN all remission events of one approval, including a failed send whose provider error contains an email
- WHEN every payload is serialized and searched
- THEN no email, name, cause, file name, URL or token is found

### Requirement: Actor of remission events

Events from a secretary action (approval, resend, format upload) MUST carry the session user
as actor. Events from the scheduled retry have no human session and MUST be
attributed to the approving secretary of the request; the actor MUST never come
from request input.

#### Scenario: Scheduled retry actor
- GIVEN a pending remission retried by the scheduled job
- WHEN its audit row is read
- THEN the actor is the secretary who approved the request
