# Delta for Supporting Documents

Covers RF-10, RNF-01, RNF-02, RNF-06 (a), E1, E6. Documents of a request in
coordination are visible to the coordination of the student's career only
inside the system, with a session and an audited read.

## MODIFIED Requirements

### Requirement: Authenticated inline view (RNF-01, RNF-02, RNF-06, D13, D15)

Documents MUST be served only through an authenticated server route that
re-checks session, role, scope and the readable-document predicate on every
call. A document MUST NOT have a public URL, and no stored location MUST be
exposed to clients. Authorized readers: (a) the owning student, for their own
`valido` documents of a draft or request; (b) a `secretaria` whose `FacultadId`
equals the facultad of the request's student (via the student's current
`CarreraId`), for `valido` documents of a non-`borrador` request, including
retired ones (`RetiradoEn` set); (c) a `coordinacion` with a `CarreraId` equal
to the current `CarreraId` of the request's student, only for the `valido`,
non-retired documents of a request that is in `en_revision_coordinacion` with
an open escalation. No other role MAY read. Unauthorized, out-of-scope,
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
(Previously: `coordinacion` was denied; readers were the owner and the in-scope `secretaria`.)

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

#### Scenario: Coordinator of the career reads while in coordination

- GIVEN a coordinator of career C and a `valido`, non-retired document of a request of a career C student in `en_revision_coordinacion` with an open escalation
- WHEN they call the route in mode `ver`
- THEN the file is streamed inline with the security headers and one `documento.descargado` row exists with the coordinator as actor

#### Scenario: Coordinator denied outside coordination (table-driven)

| Case | Result |
|---|---|
| request answered and back in `pendiente` | denied |
| `aprobada` request with a notice | denied |
| retired document of an escalated request | denied |
| request of another career | denied |
| `coordinacion` with null `CarreraId` | denied |

- GIVEN a coordinator and the case in the row
- WHEN they call the route in any mode
- THEN the response equals that for a nonexistent id, no bytes are returned and no audit row is written

#### Scenario: Secretary without facultad or non-reader role denied

- GIVEN a `secretaria` with null `FacultadId`, an `administrador`, or a `docente`
- WHEN they call the route
- THEN access is denied with no bytes and no audit row

#### Scenario: Unknown mode refused

- GIVEN an authorized caller
- WHEN the mode is neither `ver` nor `descarga`
- THEN the request is refused with no bytes and no audit row
