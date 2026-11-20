# Delta for Data Retention

Traceability: RNF-04, RN-27 (retention), RF-14, RN-24. Based on the current main
text of `openspec/specs/data-retention/spec.md`. Requirement ids MD-n are stable
and shared by all deltas of this change.

Why: the manual data record holds personal values (student name, issuer, dates,
rest period) and the type and marks of a document. They must be cancelled with
the document at five years, exactly as the extracted data is, and must never
outlive it.

## ADDED Requirements

### Requirement: MD-35 Retention inventory covers manual document data (RNF-04, RN-27)

The retention inventory test MUST classify every column that this change adds to
`DocumentoRespaldo` (the document type, the firma mark and the sello mark) among
the columns of that row that are deleted, and MUST classify the manual data
record (every column, including the personal values name, issuer, issue date and
rest period) as deleted by cascade from its document. A column or a table added
for manual document data without a classification MUST fail the inventory test.
The retention code MUST NOT delete the manual data record by its own name: the
record MUST disappear only as the consequence of the deletion of its document row,
so that a missing cascade is caught by the integration proof and not hidden by an
explicit delete.

#### Scenario: Inventory lists the new columns and table

- GIVEN the schema after this change
- WHEN the retention inventory test runs
- THEN the document type, firma and sello are listed as deleted columns of `DocumentoRespaldo`, and the manual data record is listed as deleted by cascade

#### Scenario: Unclassified addition fails

- GIVEN a column added to `DocumentoRespaldo`, or a table with a foreign key to it, that the inventory does not list
- WHEN the retention inventory test runs
- THEN it fails naming the column or table

#### Scenario: No explicit delete of the manual record

- GIVEN the retention source
- WHEN the structural test scans it
- THEN it does not name the manual data record, and its removal relies on the cascade

#### Scenario: Cancellation removes manual data (integration, owner-run)

- GIVEN an aged student whose request has a document with manual name, issuer, dates and rest, a type and both marks, and a younger student with the same kind of data
- WHEN the retention route runs with the scheduler bearer
- THEN the aged student's document row and manual data record no longer exist and the younger student's are untouched
- AND the `usuario.cancelado` payload still holds counts and `retencion_5_anios` only, with no manual value

## MODIFIED Requirements

### Requirement: DR-4 Requests, third-party text and documents (RNF-04, RN-27)

Spec id MD-34. For every request of the student (drafts included) the system MUST replace the
student snapshot (`EstudianteNombre`, `EstudianteCif`, `EstudianteCarrera`,
`EstudianteCorreo`) by the redact rule (a non-NULL value becomes the placeholder, NULL stays NULL; `EstudianteCarrera` is redacted, not kept), and set
`CanceladaEn`. Embedded personal text MUST be anonymized with placeholders:
`SolicitudDecision.Texto` (`SolicitudRevision` holds no names or free text and is left unchanged), `Escalamiento.Nota` and
`Respuesta`, `ReporteInasistencia.DocenteNombre` and `Nota`, and the
`Remision.DocenteNombre` and `Remision.Correo` teacher snapshot. Every
`DocumentoRespaldo` row of the student's requests (retired and staff-uploaded
included) MUST be deleted, its `ExtraccionDocumento` rows MUST cascade, and its
manual data record MUST cascade (see `manual-document-data`). The document type
and the firma and sello marks live on the `DocumentoRespaldo` row and go with it.
No manual value (name, issuer, issue date, rest period, type or mark) MUST remain
in any table after the cancellation of its student.
(Previously: only the extraction rows cascaded; no manual data existed.)

#### Scenario: Requests and documents

- GIVEN a due student with two requests, a decision text, a remission and three documents, one with manual data
- WHEN cancelled
- THEN no snapshot, free text or teacher value remains and all three document rows, their extractions and the manual data record are gone

#### Scenario: Manual values do not survive

- GIVEN a due student whose retired document and whose current document both carry manual data
- WHEN cancelled
- THEN a search of every table for the manual name, issuer, dates, type and marks finds nothing
