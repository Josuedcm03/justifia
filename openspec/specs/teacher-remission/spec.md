# Teacher Remission Specification

## Purpose

After approval, each affected teacher receives the justification by email. The
approval never depends on mail. Covers RF-09 (a, b, c), RN-18, RN-19, RNF-07
(a, b). "Remission" = one per-teacher delivery record. States: `pendiente`,
`enviada`, `bloqueada` (with a visible reason code). Reason codes:
`sin_correo`, `formato_especial_faltante`, `adjuntos_exceden_limite`,
`error_envio`. Audit in `audit-log`; review UI in `request-review`.

## Requirements

### Requirement: One remission per teacher at approval (RF-09 a, RNF-07 a)

Approving a request MUST create, in the approval's own transaction, exactly one
remission per distinct teacher of the request's groups, each recording that
teacher and email as of approval. Mail failure MUST NOT undo the approval.
Reject and return MUST create none.

#### Scenario: Two groups, same teacher
- GIVEN an approved request whose groups A and B belong to teacher T
- WHEN the approval commits
- THEN exactly one remission exists for T

#### Scenario: Several teachers
- GIVEN groups owned by teachers T1 and T2
- WHEN approved
- THEN two remissions exist, one each

#### Scenario: Mail down at approval
- GIVEN the mail service is unavailable
- WHEN the secretary approves
- THEN the request is `aprobada` and its remissions are `pendiente` (RNF-07 a, b)

#### Scenario: Later email change
- GIVEN a remission created for teacher T
- WHEN T's catalog email changes afterwards
- THEN the remission still targets the email recorded at approval

### Requirement: Message content and recipients (RF-09 a, RN-18)

Each message MUST be in Spanish and MUST include the cause, the supporting
documents as attachments, and the warning that the justification enables
rescheduling without erasing the absence. It MUST list only that teacher's
groups. The student MUST be in copy. Teachers MUST NOT see other teachers'
groups.

#### Scenario: Per-teacher groups
- GIVEN T1 owns group A and T2 owns group B
- WHEN both messages are built
- THEN T1's lists only A, T2's lists only B, both carry cause, warning and student CC

### Requirement: Send after commit, idempotent, no double send (RNF-07)

Sending MUST happen after the approval commits. A send MUST be claimed
per remission so concurrent attempts (post-approval, secretary resend, retry
job) send at most once. A failed send MUST leave the remission `pendiente`
with `error_envio`. A pending remission MUST be retried by an authenticated
scheduled job (bounded per run and by a maximum number of automatic attempts
per remission) and by manual resend.

#### Scenario: Success
- GIVEN a `pendiente` remission with no blocker
- WHEN sent successfully
- THEN it is `enviada` with a send time recorded (RF-09 c)

#### Scenario: Concurrent attempts
- GIVEN two simultaneous send attempts on one remission
- WHEN both complete
- THEN exactly one message is sent and the send time is set once

#### Scenario: Sent is never resent by retry
- GIVEN an `enviada` remission
- WHEN the retry job runs
- THEN no message is sent

#### Scenario: Unauthenticated retry job
- GIVEN a call to the retry route without the shared secret
- WHEN processed
- THEN it is refused and nothing is sent

### Requirement: Missing teacher email blocks the remission (D6)

A teacher without an email at approval MUST yield a remission `bloqueada` with
`sin_correo`; the approval stands. After the email is fixed, a resend MUST be
possible.

#### Scenario: No email
- GIVEN teacher T has no email
- WHEN the request is approved
- THEN T's remission is `bloqueada` with `sin_correo` and the others are sent

### Requirement: RN-19 special-format gate (RF-09 b, RN-19)

At approval the secretary MAY mark the request as a special-format case, only
when the cause is `fuerza_mayor`; marking any other cause, or marking a
non-approval decision, MUST be refused as invalid. The special format is signed
and stamped by the coordinación de carrera and is uploaded by the secretary
herself after the approval (see the upload requirement); it is never chosen
among the student's existing documents. A marked remission MUST NOT be sent
until that uploaded format exists; without it the remission MUST be `bloqueada`
with `formato_especial_faltante`, and the approval stands. Once present, only
that format is sent as attachment (the student's own documents are not sent).
For an unmarked request, the attachments are the request's current valid
documents uploaded by the student; a staff-uploaded document is never among
them.

#### Scenario: Marked without format
- GIVEN an approval marked special-format with no format uploaded
- WHEN dispatch runs
- THEN nothing is sent and remissions are `bloqueada` with `formato_especial_faltante`

#### Scenario: Format uploaded after block
- GIVEN blocked special-format remissions and a valid format then uploaded
- WHEN the upload succeeds
- THEN those remissions become `pendiente`, are sent, and carry only the uploaded format

#### Scenario: Unmarked request
- GIVEN an approval not marked special-format
- WHEN dispatched
- THEN the student's valid documents are sent

#### Scenario: Mark on another cause
- GIVEN a request whose cause is not `fuerza_mayor`
- WHEN the secretary approves with the special-format mark
- THEN the decision is refused as invalid and the request stays undecided

### Requirement: Special-format upload by the secretary (RF-09 b, RN-19, RNF-07)

An in-scope `secretaria` MUST be able to upload the signed-and-stamped format
only from the review detail of an `aprobada` request marked special-format that
has no format yet; the approval dialog MUST NOT carry an upload. The upload MUST
validate the real file format (by content, not name or declared type) and size
with the same rules as intake documents, and MUST be refused otherwise with
nothing stored. Other roles, out-of-scope users, unknown ids and requests that
are unmarked, not approved or already holding a format MUST yield the same
denial. Exactly one format exists per request: a second upload, including a
concurrent one, MUST be refused as `already_attached`; replacing or removing a
wrongly uploaded format is out of scope for this change (follow-up). After a
valid upload the blocked `formato_especial_faltante` remissions MUST become
`pendiente` and be dispatched; remissions blocked by another reason stay
blocked. The attachment size guard still applies. The uploaded format MUST NOT
appear in the student's own document list; the staff detail MUST show it apart
from the student's documents, with the existing download authorization.

#### Scenario: Upload from the detail after a marked approval
- GIVEN remissions `bloqueada` with `formato_especial_faltante`
- WHEN the secretary uploads a valid format from the review detail
- THEN they become `pendiente` and are sent with only that format

#### Scenario: Other blockers survive the upload
- GIVEN a remission `bloqueada` with `sin_correo` on a marked request
- WHEN a valid format is uploaded
- THEN that remission stays `bloqueada` with `sin_correo`

#### Scenario: Invalid file
- GIVEN a file whose real format is not allowed, or over the size limit
- WHEN uploaded
- THEN it is refused, nothing is stored and remissions stay blocked

#### Scenario: Unauthorized or out-of-scope upload
- GIVEN a non-secretary user, or a secretary of another facultad
- WHEN they upload a format for the request
- THEN the outcome equals a nonexistent id and nothing is stored or sent

#### Scenario: Unmarked or undecided request
- GIVEN a request not marked special-format, or not `aprobada`
- WHEN an upload is attempted
- THEN it is refused and nothing is stored

#### Scenario: Second upload
- GIVEN a request that already holds a format
- WHEN a second valid upload is attempted, sequentially or concurrently
- THEN exactly one format exists and the other attempt is refused as `already_attached`

#### Scenario: Not in the student's list
- GIVEN a request with an uploaded format
- WHEN the student views the request's documents
- THEN the format is not listed among them

### Requirement: Out of scope note

The prefilled/printable special-format template is out of scope here; it
belongs to roadmap change #12 `printable-forms`. This change only accepts the
signed-and-stamped file uploaded by the secretary.

#### Scenario: No template generation
- GIVEN a special-format request
- WHEN the secretary uses this change
- THEN no template is generated or offered, only upload

### Requirement: Attachment size guard (D3)

If the total attachment size exceeds the configured limit, the remission MUST
NOT be sent and MUST remain `bloqueada` with `adjuntos_exceden_limite`.

#### Scenario: Over limit
- GIVEN attachments over the limit
- WHEN dispatch runs
- THEN no message is sent and the reason is `adjuntos_exceden_limite`

### Requirement: Resend authorization

Only an in-scope `secretaria` MUST be able to resend a remission of a request of
her facultad. Other roles, out-of-scope or unknown ids MUST yield the same
denial. Resending an `enviada` remission MUST send nothing.

#### Scenario: Out of scope
- GIVEN a secretary of facultad A and a remission of facultad B
- WHEN she resends it
- THEN the outcome equals a nonexistent id and nothing is sent
