# Design: Data Retention (RNF-04, RN-27)

## Technical Approach

Exploration Approach 1, hexagonal and shaped like the intake sweep: a pure policy (`src/lib/retention/policy.ts`), a data module that owns every retention write (`src/lib/data/retention.ts`, `now`-parameterized, `DocumentStore` port injected), and a thin scheduler-only route (`src/app/api/cron/retention/route.ts`). Each due student is cancelled in its own transaction: an UPDATE that rechecks the due rule, anonymizing UPDATEs, document row deletes, and one `usuario.cancelado` audit row by a sentinel system account. Blobs are deleted after commit. Migration `0014` is additive. Specs: `specs/data-retention` (DR-1..DR-12), `specs/audit-log` delta.

## Architecture Decisions

| # | Topic | Options | Tradeoff | Decision |
|---|---|---|---|---|
| D1 | System actor | sentinel `Usuario` / nullable `ActorId` / new `Rol` | ALTER on the partitioned immutable table; a new role ripples into `rolesUsuario` and every zod enum | Sentinel `Usuario` with the existing role `administrador`, `Activo=false`, login `sistema`, `HashClave='!sistema-sin-clave'` (not 60 chars, so bcryptjs `compare` returns false), name `Sistema (tarea programada)` |
| D2 | Finding the actor id | hardcoded serial / env var / lookup | serials differ per branch | Look it up once per run with `Login = SYSTEM_LOGIN AND HashClave = SYSTEM_HASH AND NOT Activo`. A real user who happens to own `sistema` never matches because that user has a bcrypt hash. No match means throw, so the run fails closed (500 `retention_failed`) |
| D3 | CHECK handling | placeholders / relax CHECKs | relaxing changes 4 constraints | Placeholders. One rule for free text: `redact(col) = CASE WHEN col IS NULL THEN NULL ELSE '[cancelado]' END`. It keeps NULL-ness, so `CK_SolicitudDecision_Texto`, `CK_Escalamiento_Kind`, `CK_Escalamiento_Respuesta`, `CK_Remision_Correo` and `CK_ReporteInasistencia_Nota` hold in every branch |
| D4 | Race and idempotence | select then write / guarded write | | The first statement is `UPDATE "Usuario" ... WHERE Id = :id AND <due predicate> RETURNING Id`. Zero rows means skip, with no other write and no audit row. The cancelled marker drops the student from every later selection |
| D5 | Batching | offset / re-query / keyset | re-query loops forever on a failing student | Keyset on `Usuario.Id > lastId`, `BATCH_SIZE = 50`, `MAX_BATCHES = 10` (500 students per run, about 0.3 s each, so under `maxDuration = 300`). The backlog drains on later days (DR-8) |
| D6 | Partial indexes | add / skip | `CanceladoEn IS NULL` matches almost every row (low selectivity). Thousands of rows, one run a day | No index. Anti-joins use `Inscripcion`'s PK (EstudianteId first) and a hash anti-join on `Solicitud` |
| D7 | DB invariant | none / CHECK | 1 statement | `CK_Usuario_Cancelado`: `CanceladoEn IS NULL OR (NOT Activo AND Correo IS NULL AND Telefono IS NULL AND Cif IS NULL)` |
| D8 | Audit partitions | none / 5 / 10 years | 15 statements per 5 years | 2031..2035 (`EventoAuditoria_2031`..`_2035`, bounds `'YYYY-01-01 00:00:00+00'`). Each partition gets its own `TR_EventoAuditoria_YYYY_truncate` and `REVOKE` (statement triggers are not cloned; the row trigger is). The `DEFAULT` partition is empty today, so the attach scan is instant |
| D9 | Admin listings | hide sentinel and cancelled / show | hiding edits the security-critical `buildUsersWhere` SQL pins, `getDashboardStats` and the `users-listing` spec | Show both. The sentinel appears as an inactive administrator named "Sistema (tarea programada)". Cancelled students appear as inactive `[cancelado]` with login `cancelado-{id}`, which truthfully shows the account still exists anonymized. No admin flow can reactivate or reset an account (`update(usuario)` exists only for the user's own password change and the import, which matches by `Cif`/`Correo`, both NULL after cancellation). Impact: the total user count is +1. A "hide system accounts" filter goes to `docs/flow-experience-backlog.md` |
| D10 | Cutoff arithmetic | UTC / Managua | Managua is a fixed -06:00 offset with no DST | UTC year minus 5. A Feb 29 that does not exist clamps to Feb 28 at the same time, so a student is never due before five full years (DR-1 rows hold). Due means `anchor <= cutoff` |

## Data Flow

```
Vercel cron 0 11 * * *  (GET, Bearer CRON_SECRET)
 route.ts ─ isScheduler? ─no─► 401 no-store
    │ yes, dry = ?dry=1
    ▼
 runRetention(now, store, {dryRun})
    ├─ findSystemActor()      ── missing ─► throw ─► 500 retention_failed
    ├─ countDue(cutoff)       ── dryRun ─► return counts (reads only)
    └─ loop batches (keyset Id, ≤50 × ≤10)
         for id:  db.transaction(tx =>
                    1 UPDATE Usuario … WHERE id AND due   (0 rows → skip)
                    2 SELECT doc Id, Pathname of student's requests
                    3 UPDATE Solicitud / SolicitudDecision / Remision /
                      ReporteInasistencia / Escalamiento  (redact)
                    4 DELETE DocumentoRespaldo   (ExtraccionDocumento cascades)
                    5 insertAuditEvents(tx, systemActorId, [accountCancelledEvent])
                  )  ── throw ─► failures++ (full rollback, blobs untouched)
                  after commit: store.delete(pathnames) ── throw ─► failures++
    ▼
 console.info({event:"retention.run", ...counts}); 200 counts, no-store
```

Due predicate (one helper reused by the count, the selection and the guarded UPDATE, with no join so it works inside UPDATE):
`RolId IN (SELECT Id FROM Rol WHERE Codigo='estudiante') AND CanceladoEn IS NULL AND CreadoEn <= :cutoff AND NOT EXISTS (Inscripcion i WHERE i.EstudianteId=Usuario.Id AND i.Activo) AND NOT EXISTS (Solicitud s WHERE s.EstudianteId=Usuario.Id AND greatest(s.PresentadaEn, s.ReenviadaEn) > :cutoff)` (`greatest` ignores NULLs). Staff and the sentinel are excluded by role.

Exact writes per student (`redact` = D3, `P` = `'[cancelado]'`):

| Table | Columns written | Kept |
|---|---|---|
| Usuario | NombreCompleto=P, Login=`cancelado-{id}`, Correo/Telefono/Cif=NULL, HashClave=`'!cancelado'`, Activo=false, DebeCambiarClave=false, CanceladoEn=now | RolId, CarreraId, FacultadId, CreadoEn |
| Solicitud (drafts included) | EstudianteNombre/Cif/Carrera/Correo=redact, CanceladaEn=now | Estado, Causa, dates, consent, PlazoInicioEn, ActualizadoEn |
| SolicitudDecision | Texto=redact | codes, ids |
| Remision | DocenteNombre=P, Correo=redact | Estado, Motivo, Clases |
| ReporteInasistencia | DocenteNombre=P, Nota=redact | dates, ids |
| Escalamiento | Nota=redact, Respuesta=redact | outbox and answer timestamps |
| DocumentoRespaldo | DELETE all rows of the student's requests (retired, staff-uploaded) | — |
| SolicitudRevision, SolicitudAsignatura, Inscripcion | untouched: codes, dates, jsonb classes, ids only | all |

## Interfaces / Contracts

```ts
// src/lib/retention/policy.ts (pure)
export const RETENTION_YEARS = 5;
export const CANCELLED_TEXT = "[cancelado]";
export const CANCELLED_HASH = "!cancelado";
export const SYSTEM_LOGIN = "sistema";
export const SYSTEM_HASH = "!sistema-sin-clave";
export const RETENTION_REASON = "retencion_5_anios";
export function retentionCutoff(now: Date): Date;
export function cancelledLogin(id: number): string;

// src/lib/data/retention.ts
export type RetentionCounts = { dryRun: boolean; due: number; cancelled: number;
  documentsDeleted: number; blobsDeleted: number; failures: number };
export async function runRetention(now: Date, store: DocumentStore,
  options?: { dryRun?: boolean }): Promise<RetentionCounts>;

// src/lib/audit: action "usuario.cancelado", entity "Usuario"
type AccountCancelledPayload = { motivo: "retencion_5_anios"; solicitudes: number; documentos: number };
export function accountCancelledEvent(a: { usuarioId: number; solicitudes: number; documentos: number }): AuditEvent;
```

`insertAuditEvents` keeps its signature. Its doc comment adds "or the system account, retention only". The audit-log amendment is the spec delta's MODIFIED "Audit record content", which is enforced structurally: only `retention.ts` and `policy.ts` may name `SYSTEM_LOGIN`/`SYSTEM_HASH` (asserted in `retention.test.ts`).

Route: `export const maxDuration = 300` (a literal, read statically; Next 16 route segment config). No `dynamic` export: GET handlers are dynamic by default since v15, and `dynamic` is removed under Cache Components. `dry` is read via `new URL(request.url)`, not `nextUrl`, because the matrix harness passes a plain `Request`. 401 `{error:"unauthorized"}` / 500 `{error:"retention_failed"}`, both `NO_STORE`.

Migration `0014_data_retention` (`npx drizzle-kit generate --name data_retention` after the schema edit, then hand-append below the generated statements with `--> statement-breakpoint`, as 0002 did): 2× ADD COLUMN `timestamp with time zone` (nullable, no default), ADD CONSTRAINT `CK_Usuario_Cancelado`, then
`INSERT INTO "Usuario" ("Login","HashClave","RolId","NombreCompleto","Activo","DebeCambiarClave") SELECT 'sistema','!sistema-sin-clave',r."Id",'Sistema (tarea programada)',false,false FROM "Rol" r WHERE r."Codigo"='administrador' ON CONFLICT ("Login") DO NOTHING;`
then the 5 partitions with their triggers and REVOKEs. The journal `when` comes from generate (it must be later than 1793660241921).

## Structural carve-outs (only `src/lib/data/retention.ts`)

| Test | Change |
|---|---|
| `append-only.test.ts` | `RETENTION_EXEMPT = "lib/data/retention.ts"` may only `update` `solicitudDecision` and `reporteInasistencia`. `solicitudRevision` stays fully pinned. Add a test that asserts exactly those two hits in that file (non-vacuous), so a `delete` there still fails |
| `remision-writes.test.ts` | `ALLOWED["lib/data/retention.ts"] = ["update"]` |
| `escalamiento-writes.test.ts` | `ALLOWED["lib/data/retention.ts"] = ["update"]` (the "every allowed writer" check then pins exactly `update`) |
| `extraction.test.ts`, `fingerprint-exposure.test.ts`, `inscripcion-writes.test.ts` | No change. `retention.ts` must not name `extraccionDocumento`, `huellaSha256` or write `inscripcion`, comments included (the regexes also match prose) |

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | cutoff (exact 5y, 1 ms and 1 day less, both leap rows) | `policy.test.ts` |
| Unit | migration text | `migration-data-retention.test.ts`: located by name; journal `when` > 0013; exact ADD COLUMNs; CHECK; one INSERT using the policy constants, `ON CONFLICT ("Login") DO NOTHING`, no literal Id; partitions `_2031`..`_2035` contiguous `+00` from 2031-01-01 to 2036-01-01, a trigger and a REVOKE for each, no new DEFAULT/FUNCTION/row trigger; no DROP/DELETE/UPDATE/ALTER COLUMN/RENAME/CASCADE/BEGIN |
| Unit | data module | `retention.test.ts` with `createDbDouble`: SQL params (cutoff, `estudiante`), dry run issues only selects, guarded-zero skip, per-student failure rollback continues, blobs only after commit, blob failure counted, keyset advance, missing actor throws, payload keys |
| Unit | route | `route.test.ts` copied from intake-sweep: 7 bad bearers, unset secret, GET-only (ignoring `maxDuration`), `dry` forwarded, counts-only body, one log line, 500 generic |
| Unit | column inventory | `retention-inventory.test.ts`: `getTableColumns` of the 7 touched tables equals a reviewed redact/keep list, so a new personal column fails the build |
| Integration | DR-12 | `retention.integration.test.ts`, see below |

Integration (owner-run, disposable Neon branch): `vitest.integration.setup.ts` adds `process.env.CRON_SECRET ??= "integration-cron-secret-000000"`. `@/lib/intake/deps` is `vi.mock`ed to return a `createFakeDocumentStore()` held in a `vi.hoisted` holder. Fixtures: A (aged: 1 rejected request with decision text, 1 approved request with remission and escalation note/answer, 1 document plus an extraction row, seeded blob), B (aged account, presentation 2 years ago), C (aged, active `Inscripcion`). Aging is one UPDATE per request setting `ConsentimientoEn = PresentadaEn = now - 6y`, `ReenviadaEn`/`PlazoInicioEn` NULL, snapshot, `Estado`, plus `Usuario.CreadoEn = now - 6y`. `now` is never shifted. Steps: (1) `GET ?dry=1` must answer `due === 1`, otherwise abort before the real run (a guard against leftovers or real data); (2) `GET` with the bearer gives `cancelled 1`; assert DR-3/DR-4/DR-5 columns, zero document and extraction rows, blob gone, exactly one audit row (actor = sentinel looked up by login, `datos` deep-equals `{motivo, solicitudes:2, documentos:1}`, and the serialized row contains no original name, CIF or email); B and C byte-equal to before; (3) a second `GET` gives `cancelled 0` and the audit count is unchanged; (4) a raw `UPDATE "EventoAuditoria"` rejects with 42501. Cleanup: `fixtures.cleanup()`. A is not FK-pinned (the audit actor is the sentinel; `EntidadId` has no FK). The audit row and the sentinel stay on the branch by design.

## Threat Matrix

| Boundary | Applicability |
|---|---|
| Documentation-like paths | N/A: no file classification or execution |
| Git repository selection | N/A: no VCS automation |
| Commit state | N/A: no VCS automation |
| Push state | N/A: no VCS automation |
| PR commands | N/A: no PR automation |

The HTTP boundary is covered by DR-10 (bearer tests plus the access matrix), not by this matrix.

## Slicing (two stacked PRs; test lines ×1.3; generated snapshot excluded)

| PR1 file | Lines | PR2 file | Lines |
|---|---|---|---|
| `drizzle/0014_data_retention.sql` | 55 | `src/app/api/cron/retention/route.ts` | 50 |
| `drizzle/meta/_journal.json` (+ generated snapshot) | 7 | `.../retention/route.test.ts` | 145 |
| `src/db/schema.ts` | 15 | `vercel.json` | 1 |
| `src/db/migration-data-retention.test.ts` | 120 | `src/lib/intake/vercel-config.test.ts` (three jobs, `0 11`) | 12 |
| `src/lib/retention/policy.ts` + test | 45 + 80 | `src/test/access/matrix-table.ts` (scheduler-only row) | 9 |
| `src/lib/audit/types.ts`, `events.ts` | 38 | `src/lib/data/integration/retention.integration.test.ts` | 300 |
| `events.test.ts`, `types.test.ts` | 40 | `vitest.integration.setup.ts` | 2 |
| `src/lib/data/audit.ts` (comment) | 3 | `src/lib/data/retention-inventory.test.ts` | 55 |
| `src/lib/data/retention.ts` | 210 | `modelo_datos_sql.md` (partition window) | 5 |
| `src/lib/data/retention.test.ts` | 250 | | |
| 3 carve-out tests | 30 | | |
| `docs/requirements.md` RN-27 | 10 | | |
| **Total** | **~900** | **Total** | **~580** |

`route-coverage.test.ts` needs no edit: it requires the sibling test and the matrix row automatically. The proposal estimated PR1 at ~700, but ~900 is realistic; at tasks time, if PR1 exceeds 1000, move `retention.test.ts`'s SQL-shape cases into the inventory test file in PR2.

TDD commits. PR1: `feat(db): add retention markers, system account and 2031-2035 audit partitions` (migration test RED, then schema, generate, append) → `feat(retention): add the five-year cutoff policy` → `feat(audit): add the usuario.cancelado event` → `feat(data): cancel due students one transaction each` (test RED, then module plus carve-outs together) → `docs(requirements): add RN-27`. PR2: `feat(cron): add the retention route` → `feat(cron): schedule retention daily at 11:00 UTC` → `test(retention): prove RNF-04 through the scheduled route` → `docs: note the 2036 audit partition window`.

## Migration / Rollout

1. Read-only check in production: `SELECT "Id" FROM "Usuario" WHERE "Login"='sistema'` must be empty.
2. Owner's explicit yes, then `drizzle-kit migrate` (applies 0014) before PR1 merges. Then verify the sentinel and the partitions read-only. PR1 code is inert: no route calls it.
3. Disposable branch from production (it now has 0014). Owner yes, then run the integration suite.
4. Retarget PR2 to `main` after PR1 merges. The merge deploys and registers the cron. Then `curl -H "Authorization: Bearer …" /api/cron/retention?dry=1` must answer 200 with `due 0`, which proves the actor lookup in production.

Rollback: remove the cron entry, then revert. The columns, CHECK, sentinel and partitions may stay. Executed cancellations are irreversible.

## Open Questions

- [ ] Spec DR-4 lists "`SolicitudRevision` free text", but the table has none (only `Causa`, dates, `Clases` jsonb, `DocumentoIds`). This design leaves it untouched. The spec should drop that item.
- [ ] Spec DR-4 says the snapshot is replaced "where a CHECK requires a value". This design uses `redact` (non-NULL becomes the placeholder, NULL stays NULL), which matches. Confirm `EstudianteCarrera` is redacted, not kept as residue (the live `Usuario.CarreraId` still serves reports).
