# Apply Progress: catalog-excel-import

Mode: Strict TDD. Batch 1: Phase 0 + Phase 1 (WU1a). Branch: `feat/catalog-excel-import-wu1a` (base tracker `feat/catalog-excel-import`). Nothing committed.

## Completed

- [x] 0.1 (chain strategy feature-branch-chain and WU2b pre-split accepted per orchestrator preflight)
- [~] 0.2 local tracker + WU1a branches created; artifact commit NOT made (apply must not commit) - user/orchestrator pending
- [x] 0.3 baseline: typecheck clean; `npm test` 201/201 on 2nd run (1st run showed 3 transient failures, not reproducible); `npm run build` OK
- [x] 1.3, 1.4, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12
- [ ] 1.5 RED written (8 failing tests by design) - stays RED until 1.6 runs
- Parked: 1.1, 1.2 (READ-ONLY DB), 1.6 [CONFIRM] generate, 1.13 checkpoint

## TDD Cycle Evidence

| Task | Test file | RED | GREEN | REFACTOR |
|------|-----------|-----|-------|----------|
| 1.3/1.4 | src/db/schema.test.ts | suite failed: `asignatura` export undefined | 18/18 pass | prettier only; test switched to `PgDialect.sqlToQuery` for the CHECK text |
| 1.5/1.6 | src/db/migration-0003.test.ts | 8/8 fail: `drizzle/0003_*.sql not found` | PARKED (needs `npm run db:generate`, [CONFIRM]) | n/a |
| 1.7/1.8 | src/lib/data/catalog.test.ts | suite failed: module absent | 4/4 pass | none needed |
| 1.9/1.10 | src/lib/data/users-data.test.ts | 4/4 fail: functions not exported | 4/4 pass (+27 existing in src/lib/data) | none needed |
| 1.11 | rg check on modelo_datos_sql.md | entries absent | entries present | n/a (docs) |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx vitest run src/db/schema.test.ts src/lib/data` passes; `migration-0003.test.ts` intentionally red until 1.6 |
| Runtime harness | N/A: DB apply deferred to Phase 6; `toSQL()`/logger proofs cover SQL text only |
| Rollback boundary | revert schema.ts/schema.test.ts, users.ts, catalog.ts, users-data.test.ts, catalog.test.ts, import/types.ts, migration-0003.test.ts, modelo_datos_sql.md hunks |

## Full-suite state at end of batch

`npm test`: 221 passed, 8 failed (all in migration-0003.test.ts, awaiting 1.6). `npm run typecheck` clean. `npm run build` OK. eslint: no real errors (CRLF noise only).

## Parked commands

- 1.1 (READ-ONLY, DB): `SELECT "Correo", count(*) FROM "Usuario" WHERE "Correo" IS NOT NULL GROUP BY 1 HAVING count(*) > 1;`
- 1.2 (READ-ONLY): inspect only the host of `DATABASE_URL` for `-pooler`.
- 1.6 [CONFIRM]: `npm run db:generate` (answer "create" to any rename prompt), then hand-review SQL; expect `migration-0003.test.ts` GREEN.

## Deviations / notes

- Readers named `buildActiveGruposForEstudianteQuery` / `buildActiveEnrollmentQuery` (pure query builders taking a `QueryBuilder`); RF-03 keys on the STUDENT's CIF, so `listActiveGruposForDocente` from the task was renamed. No executing wrappers yet (no consumer in this change).
- `CatalogSnapshot` shape was not defined in design; row types chosen in `src/lib/import/types.ts`.
- `modelo_datos_sql.md` already had `CK_Asignatura_Horas`; only Correo unique, DebeCambiarClave, Grupo/Inscripcion `Activo` and note 3 were added.
- `UsuarioConRol` now carries `debeCambiarClave` (also returned by `createUsuario`).
- prettier normalised three files to LF in the working tree (git autocrlf warns; diff is clean).
- Line count: ~247 modified + ~488 new = ~735 authored vs ~440 estimate (tests dominate); 0003 SQL adds ~50 more. Still under the 800 budget but tight.

---

# Batch 2: Phase 2 (WU1b), branch `feat/catalog-excel-import-wu1b` (base WU1a). Nothing committed.

Mode: Strict TDD. Stopped at the first parked blocker (2.1/2.5/2.6/2.7 gate 2.10/2.12/2.14).

## Completed

- [x] 2.8 RED `src/db/audit-schema.test.ts` (5 tests). Initially all failed: module `./audit-schema` absent. Assertion 3 (SQL column list vs declaration) stays RED until 0004 exists.
- [x] 2.9 GREEN `src/db/audit-schema.ts` (`datos` typed `Record<string, unknown>` with `TODO(WU2b-1)`; `accion`/`entidadTipo` plain varchar until `audit/types.ts` lands). Assertions 1-2 and the shape assertions pass (4/5).
- [x] 2.11 RED `src/db/migration-0004.test.ts` (14 tests; no `BEGIN` absence assertion, transaction control checked outside the `$$` body). 14/14 fail: `drizzle/0004_audit_log.sql` absent. The two evidence-gated assertions are deliberately NOT here (2.14).
- [x] 2.15 `modelo_datos_sql.md` §3.1 `EventoAuditoria` entity (identity form flagged as pending S1).
- [x] 2.16 `modelo_datos_sql.md` §4 note 12: append-only mechanism with honest limits (owner can DISABLE TRIGGER / DROP / DETACH, Neon restore rewinds, purge not implemented). Whether the parent accepts its own BEFORE TRUNCATE trigger is worded as "decided by probe S2".

## Parked (in the order the user must approve them)

1. 2.1 [READ-ONLY, GATE] `SELECT current_setting('server_version_num');` (batch 1 reported PG 18.6 = 180006; recorded from orchestrator, not re-verified by apply).
2. 2.2 doc hypothesis (not evidence; nothing asserted): PG >= 17 accepts identity on a partitioned parent; a statement-level BEFORE TRUNCATE trigger is accepted on a partitioned parent, and truncating the parent expands to its partitions whose own statement triggers fire. S1/S2 settle both.
3. 2.3 [CONFIRM] create Neon branch `rehearsal-audit` (Neon console/tool; destructive-adjacent, needs "yes").
4. 2.4 [CONFIRM] shell-scoped `DATABASE_URL` pointing to that branch; print host only, compare with 2.3.
5. 2.5 [CONFIRM] S1 on the branch, one BEGIN..ROLLBACK script: `CREATE TABLE zz_probe (id bigint GENERATED ALWAYS AS IDENTITY, t timestamptz NOT NULL, PRIMARY KEY (id, t)) PARTITION BY RANGE (t);` then ROLLBACK.
6. 2.6 [CONFIRM] S2 in BEGIN..ROLLBACK: create `zz_probe` with two partitions (`zz_probe_a`, `zz_probe_b`) each with a BEFORE TRUNCATE statement trigger; (a) `CREATE TRIGGER ... BEFORE TRUNCATE ON zz_probe FOR EACH STATEMENT ...` accepted or rejected; (b) `TRUNCATE zz_probe;` and record which trigger fired.
7. 2.7 [USER][GATE] confirm yearly granularity (D25). Blocks 2.12 and 2.17.
8. 2.10 [CONFIRM] `npx drizzle-kit generate --custom --name audit_log` (local only). Precondition 2.1 + 2.5-2.6 not met, so parked (not run).
9. 2.12 GREEN hand-write `drizzle/0004_audit_log.sql` (blocked by 2.7 and 2.10); 2.14 evidence-gated assertions + finalise 0004; 2.13 optional refactor.
10. 2.17 §4 partition runbook note (window ends 2030-12-31, DEFAULT trap, health check): parked with 2.7 because it states the granularity.
11. 2.18 verification, 2.19-2.27 branch apply + probes 4b-4h (each [CONFIRM], one statement per confirmation as in tasks.md), 2.28 hashes, 2.29 checkpoint.

## TDD Cycle Evidence (batch 2)

| Task | Test file | RED | GREEN | REFACTOR |
|------|-----------|-----|-------|----------|
| 2.8/2.9 | src/db/audit-schema.test.ts | 5/5 fail (module absent) | 4/5 pass; 5th waits for 0004 (2.12) | prettier only |
| 2.11 | src/db/migration-0004.test.ts | 14/14 fail (file absent) | PARKED (2.12 gated by 2.7, 2.10) | n/a |
| 2.15, 2.16 | rg check on modelo_datos_sql.md | entries absent | present | n/a (docs) |

## Work Unit Evidence (partial)

| Evidence | Value |
|---|---|
| Focused tests | `npx vitest run src/db/audit-schema.test.ts src/db/migration-0004.test.ts`: 4 pass, 14 fail by design (0004 absent) |
| Runtime harness | Neon branch rehearsal PARKED (2.19-2.26 all [CONFIRM]) |
| Rollback boundary | delete audit-schema.ts, audit-schema.test.ts, migration-0004.test.ts; revert the two `modelo_datos_sql.md` hunks |

## Suite state

`npm run typecheck` clean. `npm test`: 228 passed, 19 failed = 14 intended REDs (0004: 13 migration-0004 + 1 audit-schema) + 5 unrelated pre-existing failures (`src/app/denied/page.test.tsx` x2 reproduced on a stash of my changes; `users/page.test.tsx`, `data-table-search.test.tsx`: render empty in this environment). Note: batch 1 saw 8 reds only; these 5 unrelated failures appeared later (environment/flaky, not caused by WU1b files). eslint on src/db: only CRLF prettier noise.

## Notes / flags

- `src/db/index.ts` creates `postgres()` without `prepare: false` while DATABASE_URL host is `-pooler` (flag for 9.26; not changed).
- Authored lines in WU1b so far: 328 (new TS) + 20 (doc) = ~350 vs ~420 estimate; SQL file (~120-150) still to come, so ~500 expected.

---

# Batch 3: Phase 2 (WU1b) continued, branch `feat/catalog-excel-import-wu1b`. Nothing committed.

Evidence supplied by the orchestrator (Neon branch `rehearsal-audit`, project damp-recipe-21839554, PG 18): 2.1 server is PG 18 (18.6 from batch 1); S1 identity + PK (id, t) on a partitioned parent ACCEPTED (no sequence fallback); S2 BEFORE TRUNCATE statement trigger ACCEPTED on the parent, statement triggers NOT cloned to partitions, row triggers cloned (including DEFAULT); 2.7 user confirmed yearly 2026-2030 + DEFAULT.

## Completed

- [x] 2.1, 2.5, 2.6, 2.7 recorded from the evidence above (not re-run by apply).
- [x] 2.2 the docs check is superseded by the probe evidence (hypothesis replaced by S1/S2 results).
- [x] 2.10 `npx drizzle-kit generate --custom --name audit_log` (local only): created `drizzle/0004_audit_log.sql`, journal entry `0004_audit_log`, and `drizzle/meta/0004_snapshot.json` (a copy of the 0003 snapshot; contains no EventoAuditoria).
- [x] 2.12 `drizzle/0004_audit_log.sql` hand-written: partitioned table, composite PK, FK, CHECK, 5 yearly partitions + DEFAULT, 3 indexes, `fn_EventoAuditoria_inmutable`, parent row trigger, 7 TRUNCATE triggers (parent + 6), 7 REVOKE.
- [x] 2.13 no refactor needed (helpers already extracted at write time).
- [x] 2.14 the two evidence-gated assertions added; RED against the first 2.12 draft (`"Id" bigint NOT NULL`, no parent TRUNCATE trigger: 2 failures), GREEN after completing 0004.
- [x] 2.17 note 13 in `modelo_datos_sql.md` §4 (window ends 2030-12-31, per-partition trigger + REVOKE, `EventoAuditoria_default` health check, DEFAULT trap); §3.1 identity comment and note 12 wording updated to the S1/S2 results.
- [x] 2.18 `npm run typecheck` clean; `npm test` 244 passed, 5 failed (all the known button.tsx failures, unrelated); migration-0004 (16) and audit-schema (5) all pass.

## TDD Cycle Evidence (batch 3)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.12 | 14/14 migration-0004 + audit-schema col-list failing (file empty) | draft 0004 written (without identity and parent TRUNCATE trigger); 17/20 pass, 3 fail (2 gated + 1 test-helper bug) | n/a |
| 2.14 | 3 failures with draft 0004 (identity, parent trigger, and the DELETE check below) | all 21 pass | see note |
| test fixes | (a) `fnChunks` matched `EXECUTE FUNCTION` in trigger chunks; (b) DML guard `\bDELETE\b(?! ON)` matched `REVOKE ... DELETE,` | narrowed to `CREATE (OR REPLACE )?FUNCTION` and `\bDELETE\s+FROM\b` | test bugs, not weakened intent |

## Deviations

- Two test-helper bugs in my own batch-2 assertions fixed (see above); intent unchanged.
- Trigger names: `TR_EventoAuditoria_inmutable` (row, parent), `TR_EventoAuditoria_truncate` (parent), `TR_EventoAuditoria_<year|default>_truncate` (partitions).
- `0004_snapshot.json` generated by drizzle-kit (630 lines, excluded from the authored count).

## Parked (in the order the user must approve them; nothing run against Neon)

Connection approach for all: create the branch in the Neon console/MCP (2.3, needs "yes"), then in a shell only: `export DATABASE_URL='<branch connection string>'` (never echo it; print host with `node -e "console.log(new URL(process.env.DATABASE_URL).host)"` and compare to the shared host; abort if equal). `psql "$DATABASE_URL" -c "..."` for each probe, one confirmation per statement.
1. 2.3 create branch `rehearsal-audit` (already exists from the orchestrator's S1/S2 run: confirm reuse or recreate fresh so 0003 has not been applied yet) and 2.4 shell-scoped DATABASE_URL + host check.
2. 2.19 `npm run db:migrate` (branch only; never db:push).
3. 2.20 `INSERT INTO "EventoAuditoria" ("ActorId","OcurridoEn","Accion","EntidadTipo","EntidadId","Datos") VALUES (<existing Usuario Id>, '2026-06-01 00:00:00+00', 'probe', 'Importacion', NULL, '{}');` then `SELECT tableoid::regclass FROM "EventoAuditoria" WHERE "Accion"='probe';` expect `EventoAuditoria_2026`. (Needs an existing Usuario Id: `SELECT "Id" FROM "Usuario" LIMIT 1;` read-only.)
4. 2.21 same INSERT with `'2099-01-01 00:00:00+00'` and Accion `probe99`; expect `EventoAuditoria_default`.
5. 2.22 four statements, one each: `UPDATE "EventoAuditoria" SET "Accion"='x';` `DELETE FROM "EventoAuditoria";` `UPDATE "EventoAuditoria_2026" SET "Accion"='x';` `DELETE FROM "EventoAuditoria_2026";` all expect 42501.
6. 2.23 `TRUNCATE "EventoAuditoria";` then `TRUNCATE "EventoAuditoria_2026";` both expect 42501.
7. 2.24 `CREATE TABLE "EventoAuditoria_2031" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2031-01-01 00:00:00+00') TO ('2032-01-01 00:00:00+00');` insert a 2031 row; `UPDATE`/`DELETE` on it (expect 42501); `TRUNCATE "EventoAuditoria_2031";` (expected to succeed).
8. 2.25 `ALTER TABLE "EventoAuditoria" DISABLE TRIGGER USER;` and `ALTER TABLE "EventoAuditoria" DETACH PARTITION "EventoAuditoria_2031";` (expected success), then `ENABLE TRIGGER USER` and `ATTACH PARTITION ... FOR VALUES ...` back.
9. 2.26 `CREATE TABLE "EventoAuditoria_2099" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2099-01-01 00:00:00+00') TO ('2100-01-01 00:00:00+00');` (expected fail: row in DEFAULT), then `DROP TABLE "EventoAuditoria";` and confirm partitions gone.
10. 2.27 delete branch `rehearsal-audit`, `unset DATABASE_URL`.
11. 2.28 freeze hashes: `sha256sum drizzle/0003_late_groot.sql drizzle/0004_audit_log.sql`; 2.29 checkpoint.

## Line count

WU1b authored: 93 (0004 SQL) + 69 + 81 + 200 (TS) + 29 (doc + journal) = ~472 vs ~420 estimate (expected ~500); under 800. `0004_snapshot.json` excluded.
