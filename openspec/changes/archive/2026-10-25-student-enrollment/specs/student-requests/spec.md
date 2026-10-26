# Delta for Student Requests

Covers RF-07 c, RF-04, RN-21, RNF-01, RNF-11.

## MODIFIED Requirements

### Requirement: Own requests list (RF-07 c, RNF-01)

A student MUST see a list at `/requests` of their own presented requests
(never `borrador`), with state and presentation date, newest first. The list
MUST be built from the session user only; the student identity MUST NOT come
from request input. Only `estudiante` MAY open it. When the student has no
presented request, the empty state MUST also link to `/enrollment`, because
enrollment is what makes subjects available to a request; the link MUST be
usable at 360 px and its text MUST exist in `es` and `en`.
(Previously: the empty state carried no link to the enrollment page.)

#### Scenario: List own requests

- GIVEN a student with a draft, a `pendiente` and an `aprobada` request
- WHEN they open `/requests`
- THEN the two presented requests are listed with their states and the draft is not

#### Scenario: Other role denied

- GIVEN a user with role `secretaria`
- WHEN they open `/requests`
- THEN access is denied and no data is returned

#### Scenario: Unauthenticated

- GIVEN no session
- WHEN `/requests` is requested
- THEN access is denied and nothing is read

#### Scenario: Empty state links to enrollment

- GIVEN a student with no presented request (a draft alone does not count)
- WHEN they open `/requests`
- THEN the empty state is shown with a link to `/enrollment`

#### Scenario: No empty state with requests

- GIVEN a student with a presented request
- WHEN they open `/requests`
- THEN the list is shown and the empty state is not
