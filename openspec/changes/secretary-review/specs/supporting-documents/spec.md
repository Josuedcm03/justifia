# Delta for Supporting Documents

Covers RF-06, RF-07, RF-08 b, RN-15, RNF-01, RNF-02, RNF-06 a. Decisions from
`sdd/secretary-review/pre-proposal` (item 5).

## ADDED Requirements

### Requirement: Soft retirement of documents on correction (RF-08 b)

While a request is `devuelta`, when its owner removes a document that belongs
to the latest returned revision (listed in that revision's snapshot), the
document MUST be retired, not deleted: its record is marked with `RetiradoEn`
(server time), it stays `valido`, and its stored file MUST be kept. There is no
revision marker column; the revision snapshot already lists the document.
Retirement MUST happen in the same transaction as its single
`documento.retirado` audit row (see the `audit-log` delta). A document uploaded
during the current correction and then removed MUST be deleted as in a draft
(record and file), with no `documento.retirado` row. A retired document
(`RetiradoEn IS NOT NULL`) MUST NOT count toward the 5-document cap, MUST NOT
count as a valid document for RN-03, and MUST NOT be offered to the student for
viewing in the current revision. The cleanup sweep MUST NOT delete a retired
document or its file.

#### Scenario: Removal retires, does not delete

- GIVEN a `devuelta` request whose latest revision lists a `valido` document D1
- WHEN the owner removes D1
- THEN D1's record and stored file remain, `RetiradoEn` is set, and exactly one `documento.retirado` row is written in the same transaction
- AND after attaching D2 and resubmitting, D2 is current and D1 stays retired

#### Scenario: Document added during the correction is deleted

- GIVEN a `devuelta` request where the owner attached D2 during the current correction
- WHEN the owner removes D2 before resubmitting
- THEN D2's record and stored file are deleted and no `documento.retirado` row is written

#### Scenario: Cap ignores retired

- GIVEN a request with 5 retired documents and 3 current ones
- WHEN the owner requests an upload token during a correction
- THEN a token is issued

#### Scenario: Sweep keeps retired

- GIVEN a retired document whose request is older than 30 days
- WHEN the cleanup sweep runs
- THEN the record and file remain

## MODIFIED Requirements

### Requirement: Upload authorization and limits (RN-04, D2, RNF-01)

The system MUST issue an upload token only to an authenticated `estudiante`
who owns a non-expired draft or who owns a request in state `devuelta` (a
correction, see `student-requests`). The token MUST restrict content types to
PDF, PNG, and JPEG, restrict size to at most 10 485 760 bytes, be short-lived,
and bind the file to that draft's or request's storage prefix with an
unguessable name. The token route MUST re-check session, role, ownership and,
for a correction, the `devuelta` state on every call.
(Previously: only the caller's own non-expired draft could receive a token.)

#### Scenario: Token for own draft

- GIVEN a student with an open draft
- WHEN they request an upload token
- THEN a token is issued limited to the three types, 10 MB, a short validity, and that draft's prefix

#### Scenario: Token for own returned request

- GIVEN a student who owns a request in `devuelta`
- WHEN they request an upload token for that request
- THEN a token is issued limited to the three types, 10 MB, a short validity, and that request's prefix

#### Scenario: Token denied

- GIVEN no session, a non-student role, another student's draft or request, an expired draft, or an own request that is not `devuelta`
- WHEN a token is requested
- THEN it is denied and no token is issued

#### Scenario: Oversize or wrong type at the store

- GIVEN a valid token
- WHEN the client uploads 11 MB or declares `text/html`
- THEN the store rejects the upload

### Requirement: At most five documents per request (D12, RF-02 a)

A draft, or the caller's own request in `devuelta` during a correction, MUST
hold at most 5 documents. The count MUST include every document record of that
draft or request in state `pendiente` (finalize in progress) or `valido`, and
MUST exclude retired documents (`RetiradoEn IS NOT NULL`). When the draft or
request already holds 5 such documents, the token route MUST NOT issue an
upload token and MUST return the reason `too_many_documents`. Finalize MUST
re-check the cap when it claims its `pendiente` row, so concurrently issued
tokens cannot exceed it; a finalize that would make a sixth document MUST be
rejected with `too_many_documents`, delete the stored file, and create no
document record. Removing a document frees a slot, whether it is deleted or
retired.
(Previously: the cap applied to drafts only and there were no retired
documents.)

#### Scenario: Sixth upload rejected at the token

- GIVEN a draft with 5 `valido` documents
- WHEN the student requests an upload token
- THEN no token is issued and the reason `too_many_documents` is shown

#### Scenario: Pending documents count toward the cap

- GIVEN a draft with 4 `valido` documents and 1 `pendiente` document
- WHEN the student requests an upload token
- THEN no token is issued and the reason `too_many_documents` is shown

#### Scenario: Concurrent finalize beyond the cap

- GIVEN a draft with 4 documents and two tokens issued before either finalize
- WHEN both uploads are finalized at the same time
- THEN exactly one becomes a document, the other is rejected with `too_many_documents`, and its stored file is deleted

#### Scenario: Removal frees a slot

- GIVEN a draft with 5 `valido` documents
- WHEN the student removes one and requests a token
- THEN a token is issued

#### Scenario: Correction cap excludes retired documents

- GIVEN a `devuelta` request with 2 retired documents and 5 current `valido` documents
- WHEN the owner requests an upload token
- THEN no token is issued and the reason `too_many_documents` is shown
- AND after the owner removes one current document of the returned revision (retiring it), a token is issued

### Requirement: Authenticated inline view (RNF-01, RNF-02, RNF-06, D13, D15)

Documents MUST be served only through an authenticated server route that
re-checks session, role, scope and the readable-document predicate on every
call. A document MUST NOT have a public URL, and no stored location MUST be
exposed to clients. Authorized readers: (a) the owning student, for their own
`valido` documents of a draft or request; (b) a `secretaria` whose `FacultadId`
equals the facultad of the request's student (via the student's current
`CarreraId`), for `valido` documents of a non-`borrador` request, including
retired ones (`RetiradoEn` set). No other role MAY read. Unauthorized, out-of-scope,
draft-of-another-user and unknown ids MUST yield identical denials with no file
bytes. The route MUST accept a mode: `ver` (default) serves inline
(`Content-Disposition: inline` with the RFC 5987 original name); `descarga`
serves as an attachment (`Content-Disposition: attachment` with the same
name). Both MUST send `Content-Security-Policy: sandbox`,
`X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` and the
`Content-Type` of the verified detected type. An unknown mode value MUST be
refused. Every successful read, in either mode, MUST write exactly one
`documento.descargado` audit row whose payload records the mode (see the
`audit-log` delta); a denied or failed read MUST write none.
(Previously: only the owning student could read, inline only; staff access and
explicit download were deferred to this change.)

#### Scenario: Owner views inline

- GIVEN a student who owns a request with a document
- WHEN they call the view route
- THEN the file is streamed with its detected content type
- AND `Content-Disposition` is `inline` (not `attachment`)
- AND `Content-Security-Policy: sandbox`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store` are set

#### Scenario: View link on step 3 and review

- GIVEN a student with a `valido` document on step 3 or the review
- WHEN the page renders
- THEN a "View" link (accessible name includes the file name) points to `/api/intake/documents/<id>` and opens in a new tab with `rel="noopener noreferrer"`
- AND a `pendiente` document has no View link

#### Scenario: Other student denied

- GIVEN a document owned by student A
- WHEN student B or an anonymous caller requests it
- THEN the response is a denial identical to that for a nonexistent id
- AND no audit row is written

#### Scenario: Download is audited (D13)

- GIVEN a student who owns a `valido` document
- WHEN they download it successfully
- THEN exactly one `documento.descargado` row exists for that document with the student as actor

#### Scenario: Failed download not audited

- GIVEN a document whose stored file cannot be read
- WHEN the owner requests it
- THEN no file bytes are returned and no `documento.descargado` row is written

#### Scenario: No public URL

- GIVEN any stored document
- WHEN the page, API responses, and database records are inspected
- THEN none contains a directly fetchable store URL

#### Scenario: Staff in scope views inline

- GIVEN a `secretaria` of facultad A and a `valido` document of a `pendiente` request of a facultad A student
- WHEN they call the route in mode `ver`
- THEN the file is streamed inline with the security headers
- AND one `documento.descargado` row exists with the secretary as actor and mode `ver`

#### Scenario: Staff attachment download

- GIVEN the same document
- WHEN the secretary calls the route in mode `descarga`
- THEN `Content-Disposition` is `attachment` with the original name
- AND one `documento.descargado` row exists with mode `descarga`

#### Scenario: Retired document visible to staff

- GIVEN a document retired by a correction of a request in scope
- WHEN the secretary opens it
- THEN it is served and audited; the owning student is not offered it in the current revision

#### Scenario: Out-of-scope secretary denied

- GIVEN a `secretaria` of facultad A and a document of a facultad B student
- WHEN they call the route in any mode
- THEN the response equals that for a nonexistent id, no bytes are returned and no audit row is written

#### Scenario: Staff cannot read drafts or unfinalized files

- GIVEN a document of a `borrador` or a `pendiente` (unfinalized) document of a presented request
- WHEN an in-scope secretary calls the route
- THEN the response is the same denial as for a nonexistent id

#### Scenario: Secretary without facultad or other staff role denied

- GIVEN a `secretaria` with null `FacultadId`, or a `coordinacion`
- WHEN they call the route
- THEN access is denied with no bytes and no audit row

#### Scenario: Unknown mode refused

- GIVEN an authorized caller
- WHEN the mode is neither `ver` nor `descarga`
- THEN the request is refused with no bytes and no audit row
