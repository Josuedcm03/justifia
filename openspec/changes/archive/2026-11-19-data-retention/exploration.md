# Exploration: data-retention (RNF-04)

RNF-04: "When a personal datum reaches five years of retention, the system shall cancel it." Test: records with simulated age over five years are cancelled and the cancellation is recorded in the audit log. Legal basis cited by the thesis: Ley 787, arts. 19 f) and 24. Thesis Anexo F: "Cancellation task not built; only two scheduled tasks exist". Base: `main` bf91506.

## Current State

### Scheduled tasks

- `vercel.json` has two daily crons: `/api/cron/intake-sweep` (`0 9 * * *`) and `/api/cron/remission-retry` (`0 10 * * *`). Both are `GET` route handlers authenticated by `isScheduler(request, env.CRON_SECRET)` (`src/app/api/cron/scheduler-auth.ts`: constant-time `Bearer` compare, fails closed when unset, 401 with `no-store`).
- `src/lib/data/intake-sweep.ts` is the model: `runIntakeSweep(now, store, ...)` takes `now` as a parameter; batches of 100, at most 50 batches; one try/catch per item, failures counted; rows deleted before Blobs. Its orphan step (`intake/` prefix, 24 h grace) deletes any Blob without a `DocumentoRespaldo` row, which is the safety net when a Blob delete fails after a database commit. It writes no audit row (D14: no human actor).
- Tests a new cron route must extend: its own `route.test.ts`; `src/lib/intake/vercel-config.test.ts` (pins exactly two jobs); `src/app/route-coverage.test.ts` and `src/test/access/matrix-table.ts` (scheduler-only row: every identity gets 401).

### Audit log

- `drizzle/0004_audit_log.sql`: no CHECK on `Accion` or `EntidadTipo`, so new action codes and entity types need no migration, only `src/lib/audit/types.ts` / `events.ts` additions (pinned by their tests).
- Append-only: trigger `fn_EventoAuditoria_inmutable` rejects UPDATE, DELETE and TRUNCATE.
- `ActorId` is NOT NULL with an FK to `Usuario`. The archived `catalog-excel-import` design (decision 18) already flagged this for "a retention job": a nullable column or a sentinel `Usuario`.
- Payload convention: ids, closed codes and counts only (RNF-05, RNF-06). Writers use `insertAuditEvents(tx, actorId, events)` inside the caller's transaction.
- Partitions cover 2026-2030 plus `DEFAULT`.

### Personal data

| Data | Location | Notes |
| --- | --- | --- |
| Account identity | `Usuario`: `NombreCompleto`, `Correo` (unique), `Telefono`, `Cif` (unique), `Login`, `HashClave`, `CreadoEn` | FK-pinned by `Solicitud.EstudianteId`, `Inscripcion` and audit `ActorId`; no last-login column (JWT sessions) |
| Request snapshot | `Solicitud.Estudiante{Nombre,Cif,Carrera,Correo}` | NOT NULL once presented (`CK_Solicitud_Presentada`) |
| Request health and absence data | `Causa`, `FechaInicio`, `FechaFin` | `Causa` can be medical |
| Consent proof | `ConsentimientoEn`, `ConsentimientoVersion` | Not personal; keep |
| Documents | `DocumentoRespaldo` (`Pathname`, `NombreOriginal`, `HuellaSha256`) and the Blob under `intake/{id}/` | Includes retired documents and staff uploads |
| Extracted data | `ExtraccionDocumento` | `ON DELETE CASCADE` from the document |
| Staff free text | `SolicitudDecision.Texto`, `SolicitudRevision`, `Escalamiento.Nota`/`Respuesta`, `ReporteInasistencia.DocenteNombre`/`Nota` | Template texts may contain the student's name |
| Teacher snapshot | `Remision.DocenteNombre`, `Remision.Correo` | |
| Audit | `EventoAuditoria` | Ids and codes only; out of scope |
| Enrollment | `Inscripcion` | Ids only |

### Constraints that shape "cancel"

- Structural tests forbid production UPDATE/DELETE of `SolicitudDecision`, `SolicitudRevision`, `ReporteInasistencia` (`append-only.test.ts`) and pin the writers of `Remision`, `Escalamiento`, `ExtraccionDocumento`. A retention module needs explicit, narrow carve-outs.
- `Solicitud` foreign keys do not cascade by design, except `SolicitudAsignatura` and `DocumentoRespaldo`.
- CHECKs forcing non-null values: `CK_Solicitud_Presentada`, `CK_Remision_Correo`, `CK_SolicitudDecision_Texto`, `CK_Escalamiento_Kind`.
- `/privacy` already says "Los datos se conservan durante cinco años y después se cancelan" (pinned by a test); changing it would require a new `CONSENT_VERSION`. No RN covers retention.
- No soft-delete or anonymization pattern exists (precedents: `Activo`, `RetiradoEn`).
- Real data does not reach five years before about October 2031: the feature is provable only by simulation.

## What "cancel" can mean

- Hard delete is blocked: students are FK-pinned as actors of their own audit events, the audit table is immutable, decisions/revisions/remissions/escalations do not cascade and the structural tests forbid deleting them; it would also destroy report statistics.
- Anonymization in place plus Blob deletion fits the schema: `Usuario` (`NombreCompleto` -> placeholder, `Login` -> `cancelado-{id}`, `Correo`/`Telefono`/`Cif` -> NULL, unusable `HashClave`, `Activo` false); request snapshots and staff free text -> placeholders; `DocumentoRespaldo` rows deleted (extraction cascades), then the Blobs. Non-identifying facts stay (state, cause, dates, subjects, consent version and instant, counts).
- The unit of cancellation must be the student (data subject): cancelling only requests leaves the identity reachable through `EstudianteId`.
- CHECK handling: placeholders satisfy the NOT NULL CHECKs with no constraint change (additive migration); relaxing the CHECKs is cleaner but riskier.
- Audit entry, one per cancelled student, same transaction as the anonymization: `usuario.cancelado`, entity `Usuario`, `datos` with counts and the closed code `retencion_5_anios`, actor = system actor.

## Approaches

1. Student-level anonymization cron with a system actor and marker columns (recommended): third daily cron route; `now`-parameterized module; one transaction per student (anonymize, delete document rows, audit row, `CanceladoEn`); Blobs deleted after commit, failures counted and caught later by the orphan sweep; optional `?dry=1`. Meets RNF-04 literally, keeps the audit and append-only guarantees, idempotent. Needs a migration with a data insert and structural carve-outs. About 1,300 lines with tests.
2. Request-level only: about 800 lines, but identity stays reachable; RNF-04 arguably unmet.
3. Hard delete with FK and audit surgery: contradicts RNF-06; not recommended.

System actor: a sentinel `Usuario` (login `sistema`, inactive, unusable hash; appears in admin lists) or a nullable `ActorId` (ALTER on the partitioned table, weaker "author").

## Recommendation

Approach 1, sentinel actor, placeholder anonymization; request anchor `PresentadaEn`; daily at `0 11 * * *` as its own route. Slice in two stacked PRs: S1 (~700: migration, schema, policy, audit event, data module, unit tests, carve-outs) and S2 (~500: route, `vercel.json`, matrix and route-coverage entries, integration test, docs).

## Testability

- Unit: fixed `now`; policy boundaries (exactly five years, just under, leap day); mocked `db`/store as in `intake-sweep.test.ts`.
- Integration (the RNF-04 test): `retention.integration.test.ts` with `createFixtures` and the existing write gate; age fixture rows by rewriting their timestamps to one old instant (respects `ConsentimientoEn <= PresentadaEn <= ...`); never shift `now`, which on a branch copied from real data would cancel real students. Assert anonymized columns, deleted Blobs (fake store), cascaded extraction, exactly one audit row without personal data, idempotent second run, younger student untouched, audit UPDATE still rejected. Owner-run on a disposable Neon branch with explicit confirmation.

## Migration and rollout

- Additive migration `0014` (generated, never hand-numbered): `Usuario.CanceladoEn`, `Solicitud.CanceladaEn`, optional partial indexes, the sentinel `Usuario`; optionally audit partitions for 2031 onward (cancellations start late 2031 and would otherwise land in the default partition).
- Order: apply the migration to production with the owner's explicit yes, then merge (main auto-deploys and registers the cron). `CRON_SECRET` is reused.

## Risks

- Student-account anchor: five years from `CreadoEn` would cancel enrolled students; there is no last-login signal.
- Legal meaning of "cancelación" under Ley 787 (anonymization vs deletion, blocking period) is unconfirmed; the UAM legal review was deferred.
- System actor requires a data insert in the migration.
- Structural tests must be updated deliberately.
- Size exceeds 1,000 lines unless sliced.

## Open Questions

1. Data subjects in scope: students only (recommended) or also staff accounts.
2. Student-account anchor: latest of `CreadoEn` and newest presentation older than five years, plus no active enrollment (recommended); or only inactive accounts.
3. Is anonymization plus document deletion an acceptable "cancelación"?
4. May non-identifying residue (state, cause, dates, subjects, consent) remain?
5. Placeholders vs relaxed CHECKs.
6. Dry-run mode on the route.
7. Schedule `0 11 * * *`.
8. Sentinel actor vs nullable `ActorId`.
9. Audit partitions 2031+ in this migration.
10. Add a retention RN to `docs/requirements.md`.
