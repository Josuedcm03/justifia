# Exploration: secretary-review (roadmap #2)

Covers RF-06..08; RN-08, RN-15..17; cross-cutting RNF-01, 02, 06, 12. Out of scope: RF-05, RF-09, RF-10, RF-11, RNF-14. Roadmap row #2 owner "Por asignar" must be updated to Armando.

## Current State

- `Solicitud` check constraint already allows all RN-16 states; intake writes only `borrador`/`pendiente`. `VISIBLE_STATES` (`src/lib/intake/states.ts`) excludes `borrador` and must filter every request query. The student data snapshot stores the carrera NAME (`Carrera.Nombre` is unique), not its id.
- `SolicitudAsignatura(SolicitudId, GrupoId FK Grupo)`: subject/group/docente are derived via `Grupo -> Asignatura -> Usuario` (`getLiveDraft`, `enrollment.ts`).
- `DocumentoRespaldo`: no revision or retired flag; removal and draft purge hard-delete; the orphan sweep deletes blobs without rows older than 24h; the draft sweep deletes `borrador` older than 30 days.
- Document route `/api/intake/documents/[id]`: inline only, owner-only `canViewDocument` (D15), audits `documento.descargado` before sending bytes, uniform 404. `getDocumentForDownload` has no state filter. Intake deferred explicit staff download to this change.
- Audit: append-only, `insertAuditEvents(tx, ...)`, closed `AuditEvent` union in `src/lib/audit/events.ts`, payloads carry ids/counts/codes only. No decision or read events exist yet.
- `secretaria` has no carrera (`Usuario.CarreraId` NULL by design) and no facultad link; `Carrera.FacultadId` exists; `catalogScopeFor` gives `secretaria` "all".
- No student "my requests" page; the confirmation page is static. No business-day logic exists (`dates.ts` has `managuaToday`/`addDays` only).
- Pattern to copy: `submitDraft` (guarded `UPDATE ... WHERE state`, `RETURNING`, audit in the same transaction, typed outcome).

## Affected Areas

- `src/db/schema.ts` + new migration (requires per-command confirmation before apply).
- `src/lib/intake/states.ts` (RN-16 transitions), new `business-days.ts`, `return-reasons.ts` (RN-17: fecha incorrecta, fecha alterada, documento ilegible).
- `permissions.ts` (`canReviewRequests`, widened `canViewDocument`, request scope); `app-sidebar.tsx`; i18n es/en.
- Audit types/events: `solicitud.aprobada | rechazada | devuelta | corregida | consultada`.
- New data modules: `revision-queue`, `solicitud-detail`, `solicitud-decision`, `solicitud-clases`.
- Staff UI: queue, detail, decision dialog with RNF-12 confirmation for rejection.
- Student UI: list, detail, correction.
- Document route + `documentos.ts`; intake `upload-token`, `getUploadContext`, `documents-step`, `cause-dates-step`, `subjects-step` need a correction context.
- `docs/roadmap.md`.

## Open Decisions (options; recommendation)

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | Non-working-days calendar (RN-08) | A) pure function + constant calendar behind an injected `NonWorkingDaysProvider` port (no schema); B) `DiaNoHabil` table + seed; C) full parameters (= normative-parameters) | **A**. Ordering by deadline equals ordering by `PresentadaEn` ASC, so SQL needs no calendar; compute the alert on read, never store the deadline. RF-06 b says "<= 1 business day", so overdue requests are alerted too. Place it in `src/lib/intake` so RN-07 can reuse it. |
| 2 | Which requests each secretary sees | A) all; B) by carrera (contradicts the model); C) by facultad (new `Usuario.FacultadId`) | A `RequestScope` seam (`all \| facultad \| none`, fail-closed, like `CatalogScope`) shipped as `all`; if the pilot has more than one facultad, take C. Resolve the student carrera via the snapshot name joined to `Carrera`. |
| 3 | History on RF-08 correction | A) in-place edit while `devuelta` + `SolicitudRevision` snapshot + append-only `SolicitudDecision` + soft-retired documents; B) shadow row `CorrigeA`; C) audit only (insufficient: no values) | **A**. Never reuse `borrador` (the sweep would delete a presented request). |
| 4 | Where the student sees state and reason | A) `/requests` list + `/requests/[id]` detail (+ sidebar); B) detail only; C) email (out of scope) | **A**, minimal. It is also the entry point for the RF-08 correction. |
| 5 | Secretary access to documents | A) same route, widened predicate (staff only for `VISIBLE_STATES`, `valido` docs, in scope), `?disposition=attachment`, add `modo: ver \| descarga` to the payload; B) separate route; C) inline only | **A**. |
| 6 | Is opening a detail an audited read (RNF-06 a) | A) audit each staff detail open (`solicitud.consultada`, state only); B) only documents + decisions; C) list + detail | **A**; the list stays unaudited and shows no health data (no cause). Verify Next 16 prefetch does not run the page body; test that one render writes exactly one row. |

## Requirement Gaps to Confirm

- Does a correction restart the RN-08 clock? (needs `ReenviadaEn`)
- Is RN-23 (30 days) re-applied on correction? Recommendation: no, otherwise a returned request can become uncorrectable.
- RF-07 "con su motivo": RN-17 defines a closed list only for returns. Recommendation: closed code for return, required bounded free text for rejection, optional for approval; free text lives only in the decision table, never in the audit log.
- RN-15 "authorized user": recommendation is only `secretaria` decides.
- RN-08: a request presented on a weekend counts from the next business day; deadline at end of day.
- Concurrency: guarded `UPDATE ... WHERE Estado = 'pendiente'`. `en_revision_coordinacion` stays reserved, not implemented. Re-validate eligibility on correction.

## Isolation from merge-grupo-into-asignatura

- **Blocker**: the merge plans migration `0007` (already taken by `0007_justification_intake.sql`), and its guard G-d aborts if any FK besides `Inscripcion` references `Grupo`. `SolicitudAsignatura.GrupoId` references `Grupo` and the merge does not cover it. It needs a renumber, a re-point of `SolicitudAsignatura.GrupoId -> AsignaturaId`, and updates to `getLiveDraft`, `saveDraftSubjects`, `submitDraft` and `enrollment.ts`. Coordinate with Josué.
- New tables carry no FK or column to `Grupo`. All subject/group/docente reads go through ONE module, `solicitud-clases.ts`, returning `{ asignaturaId, codigo, nombre, numeroGrupo, docenteNombre | null }`. No periodo. Docente may be null.
- The class row is reused across terms, so a live read may differ from the term of the request; an optional submit-time snapshot is an owner decision. Sequence this change's migration after the merge, or make the subject snapshot FK-free.

## Recommendation

Vertical slices with revision tables: pure domain -> schema -> data + audit -> staff queue/detail/decision -> student list/detail/correction -> document access. Estimated 3,500-5,000 changed lines, about 5 chained slices of at most 1000 lines each.

## Risks

- Merge ordering, migration number and guard G-d.
- Reusing `borrador` for corrections.
- No state filter in `getDocumentForDownload`.
- Exactly-once audit-on-read in an RSC page.
- RN-08 gaps; RN-23 on correction.
- Free-text reasons are personal data.
- The migration needs per-command confirmation.
- Roadmap owner not updated.

## Ready for Proposal

Yes, after confirming: facultad count (decision 2), clock restart and RN-23 on correction (decision 3), reason rules, and coordination with Josué on `SolicitudAsignatura` and the migration number.
