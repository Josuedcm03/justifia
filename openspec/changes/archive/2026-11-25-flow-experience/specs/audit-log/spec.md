# Delta for Audit Log

Change: `flow-experience` (roadmap row 13). The only change is the escalation
motive code `otro`, which the `solicitud.escalada` payload may now carry. No
audit action or entity type is added: the answer banner, the dialog notice, the
history pointer, the "Vence primero" mark, the client-side file preview, the
dates recap and the sign-in change write no audit row (see `request-review`
FE-2 to FE-5, `coordination-escalation` FE-12, `supporting-documents` FE-17).

## MODIFIED Requirements

### Requirement: Escalation payloads are code-only (RNF-02, RNF-06)

Spec id FE-31. Escalation payloads MUST be structured and identify records by stable ids.
They MAY carry the reason code, the previous and new state, the escalation
record id, the report id, the notification reason code, the number of
recipients and the request id. They MUST NOT carry the note, the answer or any
free text, student, teacher or coordinator names, CIF, email addresses, cause,
dates, message text, provider response bodies or any credential.
`escalamiento.cola.consultada` MUST carry the count only. The reason code of an
escalation is one of `sospecha_documento`, `caso_especial` and `otro`; the note
that describes an `otro` escalation MUST NOT appear in any payload.
(Previously: the reason code was `sospecha_documento` or `caso_especial`.)

#### Scenario: Payloads hold codes only

- GIVEN an escalation with a note naming a diagnosis, an answer, a report naming a teacher, and a failed send whose provider error contains an email
- WHEN every payload of those events is serialized and searched
- THEN no part of the note or answer, no name, CIF, email or date is found

#### Scenario: Escalation payload

- GIVEN a successful escalation
- WHEN its `solicitud.escalada` payload is read
- THEN it carries the reason chosen by the secretary, `sospecha_documento`, `caso_especial` or `otro` (E18), and the previous and new state

#### Scenario: Payload of an `otro` escalation holds no description (4.9 RF-10 a, b)

- GIVEN an `otro` escalation whose note describes a family situation
- WHEN every payload of its operation is serialized and searched
- THEN the code `otro` is found and no part of the note is
