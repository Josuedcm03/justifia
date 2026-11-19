# Data Retention Specification (new capability)

> Delta type: this whole file is ADDED. There is no base spec for `data-retention`.

## Purpose

Personal data of a student is cancelled five years after the student's last
activity, unless the student is still enrolled. A daily scheduled task finds the
due students and cancels each one by anonymization in place, deleting the
supporting documents, and records one audit row per student. Hard deletion is
not used: the account is FK-pinned by its own requests, enrollments and audit
rows, and the audit log is immutable.

Traceability (`docs/requirements.md`): RNF-04 (cancel at five years, audited),
RN-27 (new in this change: subject, anchor and meaning of cancellation). Every
requirement below cites both. Related: RNF-05, RNF-06 (audit content), RNF-01
(scheduler-only route).

Vocabulary: *anchor* is the latest of `Usuario.CreadoEn` and the newest
`PresentadaEn` or `ReenviadaEn` across the student's requests. *Cancelled* means
`Usuario.CanceladoEn` is set. *Placeholder* is the fixed text `[cancelado]`.
Legal sufficiency of anonymization as "cancelacion" (Ley 787, arts. 19 f, 24)
is an assumption, recorded as a limitation, not a requirement.

## Requirements

### Requirement: DR-1 Due rule (RNF-04, RN-27)

A student MUST be due when `now` is at or after five calendar years from the
anchor. Exactly five years MUST be due; one day less MUST NOT. A leap-day anchor
(29 February) MUST become due on 1 March of the fifth year after, never earlier.
Absent `PresentadaEn`/`ReenviadaEn` values MUST be ignored.

#### Scenario: Boundary (table-driven)

| Anchor | now | Due |
|---|---|---|
| 2026-03-10T09:00Z | 2031-03-10T09:00Z | yes |
| 2026-03-10T09:00Z | 2031-03-09T09:00Z | no |
| 2028-02-29 | 2033-02-28 | no |
| 2028-02-29 | 2033-03-01 | yes |

- GIVEN a student with no active enrollment and the anchor of the row
- WHEN the due rule is evaluated at `now`
- THEN the outcome is as shown

#### Scenario: Recent request moves the anchor

- GIVEN an account created six years ago whose newest `PresentadaEn` is two years ago
- WHEN the due rule is evaluated
- THEN the student is not due

### Requirement: DR-2 Exclusions (RNF-04, RN-27)

A student with any `Inscripcion` where `Activo` is true MUST NOT be due, however
old. Accounts of every role other than student (including the system actor)
MUST NEVER be due. A cancelled student MUST NEVER be selected or processed again.

#### Scenario: Enrolled student

- GIVEN a student past five years with one active enrollment
- WHEN the retention run executes
- THEN the student is untouched and no audit row is written

#### Scenario: Staff and cancelled accounts

- GIVEN a `secretaria` account past five years and an already cancelled student
- WHEN the run executes
- THEN neither is changed and neither is counted

### Requirement: DR-3 Account cancellation (RNF-04, RN-27)

Cancelling a student MUST: set `NombreCompleto` to the placeholder; set
`Correo`, `Telefono` and `Cif` to NULL (unique columns); set `HashClave` to a
value no password can match; set `Activo` false; set `Login` to
`cancelado-{id}`; set `CanceladoEn` to `now`. The `Usuario` row MUST remain.

#### Scenario: Account anonymized

- GIVEN a due student
- WHEN cancelled
- THEN the columns above hold the stated values and no original value remains in `Usuario`
- AND the student cannot authenticate

### Requirement: DR-4 Requests, third-party text and documents (RNF-04, RN-27)

For every request of the student (drafts included) the system MUST replace the
student snapshot (`EstudianteNombre`, `EstudianteCif`, `EstudianteCarrera`,
`EstudianteCorreo`) by the redact rule (a non-NULL value becomes the placeholder, NULL stays NULL; `EstudianteCarrera` is redacted, not kept), and set
`CanceladaEn`. Embedded personal text MUST be anonymized with placeholders:
`SolicitudDecision.Texto` (`SolicitudRevision` holds no names or free text and is left unchanged), `Escalamiento.Nota` and
`Respuesta`, `ReporteInasistencia.DocenteNombre` and `Nota`, and the
`Remision.DocenteNombre` and `Remision.Correo` teacher snapshot. Every
`DocumentoRespaldo` row of the student's requests (retired and staff-uploaded
included) MUST be deleted, and its `ExtraccionDocumento` rows MUST cascade.

#### Scenario: Requests and documents

- GIVEN a due student with two requests, a decision text, a remission and three documents
- WHEN cancelled
- THEN no snapshot, free text or teacher value remains and all three document rows and their extractions are gone

### Requirement: DR-5 Residue kept (RNF-04, RN-27)

Non-identifying facts MUST remain: request state, `Causa`, `FechaInicio`,
`FechaFin`, subjects, consent version and instant, decision codes, timestamps and
all audit rows. Rows MUST NOT be deleted except `DocumentoRespaldo`.

#### Scenario: Residue intact

- GIVEN a cancelled student's request
- WHEN read
- THEN state, cause, dates, subjects and consent version equal their pre-cancellation values

### Requirement: DR-6 One transaction and one audit row per student (RNF-04, RN-27, RNF-06)

Each student MUST be cancelled in one transaction that includes exactly one
`usuario.cancelado` row (entity `Usuario`, entity id the student id), actor the
system actor, payload only counts and the closed code `retencion_5_anios`. The
payload MUST NOT carry names, emails, CIF, free text or any credential. A failure
MUST roll back that student completely (no audit row) and the run MUST continue
with the next student, counting the failure.

#### Scenario: Success

- GIVEN a due student
- WHEN cancelled
- THEN anonymization and one `usuario.cancelado` row commit together with the system actor
- AND the serialized payload contains no personal value

#### Scenario: One failure does not stop the run

- GIVEN three due students and a write failure on the second
- WHEN the run executes
- THEN students one and three are cancelled, the second is unchanged with no audit row, and the response counts one failure

### Requirement: DR-7 Blob deletion after commit (RNF-04, RN-27)

The stored files of the deleted document rows MUST be deleted only after that
student's transaction commits. A failed file deletion MUST be counted, MUST NOT
undo the cancellation, and the file is left to the existing orphan sweep.

#### Scenario: Blob delete fails

- GIVEN a committed cancellation whose file deletion throws
- WHEN the run finishes
- THEN the student stays cancelled and the response counts one file failure

#### Scenario: Rollback keeps files

- GIVEN a student whose transaction rolls back
- WHEN the run finishes
- THEN none of that student's files was deleted

### Requirement: DR-8 Idempotence and batching (RNF-04, RN-27)

The run MUST take `now` as a parameter. It MUST process due students in bounded
batches; students beyond the bound MUST be picked up by a later run. A repeated
run MUST cancel zero students already cancelled and write no further audit row.

#### Scenario: Second run

- GIVEN a run that cancelled two students
- WHEN it runs again with the same `now`
- THEN zero students are cancelled and the audit row count is unchanged

#### Scenario: Over the batch bound

- GIVEN more due students than one run processes
- WHEN runs execute daily
- THEN each student is cancelled exactly once, in some run

### Requirement: DR-9 Dry run (RNF-04, RN-27)

`GET /api/cron/retention?dry=1` MUST return the counts of students that would be
cancelled and MUST write nothing: no row changed, no audit row, no file deleted.

#### Scenario: Dry run

- GIVEN two due students
- WHEN the route is called with `?dry=1` and the scheduler bearer
- THEN the response counts two and the database and file store are unchanged

### Requirement: DR-10 Scheduled route (RNF-04, RN-27, RNF-01)

`GET /api/cron/retention` MUST authenticate only by the scheduler bearer
(`CRON_SECRET`, constant-time, failing closed when unset). A missing or wrong
bearer MUST get 401 with `Cache-Control: private, no-store` and no data read, for every
identity (anonymous and each role session). The success response MUST be
`private, no-store` and carry counts only (no ids, names or text). The route MUST appear
in the access matrix as a scheduler-only row.

#### Scenario: Identity matrix

- GIVEN each of the 7 identities, with no bearer
- WHEN the route is requested
- THEN the response is 401 `private, no-store` and no data module was called

#### Scenario: Scheduler call

- GIVEN the correct bearer
- WHEN the route is requested
- THEN the run executes and the body holds counts only

### Requirement: DR-11 Daily schedule (RNF-04, RN-27)

`vercel.json` MUST schedule `/api/cron/retention` daily at `0 11 * * *`, in
addition to the two existing jobs (three in total).

#### Scenario: Config pinned

- GIVEN `vercel.json`
- WHEN parsed
- THEN exactly three jobs exist and retention is `0 11 * * *`

### Requirement: DR-12 RNF-04 evidence test (RNF-04, RN-27)

An owner-run integration test on a disposable database branch MUST enter through
`GET /api/cron/retention` with the scheduler bearer, as the scheduled task does.
It MUST age fixture rows by rewriting their timestamps, never by shifting `now`.

#### Scenario: End to end

- GIVEN fixture students aged past five years, a younger student, and a student past five years with an active enrollment
- WHEN the route is called with the bearer
- THEN each aged student is cancelled with its documents gone and exactly one `usuario.cancelado` row without personal data
- AND the younger and the enrolled students are untouched

#### Scenario: Second run and immutability

- GIVEN the end-to-end run completed
- WHEN the route is called again and an `UPDATE` is issued on an audit row
- THEN zero students are cancelled and the `UPDATE` is rejected by the database
