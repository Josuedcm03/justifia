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

---

# Batch 4: Phase 2 (WU1b) rehearsal, tasks 2.19-2.29. Neon branch `rehearsal-audit` (id `br-floral-block-ayd8br3d`, project `damp-recipe-21839554`), reused from the orchestrator's S1/S2 run. Nothing committed to git; all Neon actions per-command [CONFIRM] by the user.

## Pre-check (before 2.19)

Read-only: `rehearsal-audit` already had migrations `0000`-`0003` applied (hashes/timestamps match local `_journal.json` exactly). `0004` not yet applied — branch was reusable as-is, no fresh branch needed.

## Completed

- [x] 2.19 `npm run db:migrate` with `DATABASE_URL` scoped to `rehearsal-audit` (inline in the command, never persisted in shell env — confirmed no env persistence across Bash calls). Exit 0. `EventoAuditoria` + 5 yearly partitions (2026-2030) + `EventoAuditoria_default` created.
- [x] 2.20 INSERT `OcurridoEn='2026-06-01'` → `tableoid` = `EventoAuditoria_2026`. Matches.
- [x] 2.21 INSERT `OcurridoEn='2099-01-01'` → `tableoid` = `EventoAuditoria_default`. Matches.
- [x] 2.22 Four statements (`UPDATE`/`DELETE` on parent and on `EventoAuditoria_2026`), one confirmation each: **all four failed**, but via `fn_EventoAuditoria_inmutable`'s custom exception, **not** SQLSTATE `42501` as tasks.md expected.
- [x] 2.23 `TRUNCATE` on parent then on `EventoAuditoria_2026`: both failed, same trigger mechanism as 2.22.
- [x] 2.24 Created throwaway `EventoAuditoria_2031`, inserted a row, `UPDATE`/`DELETE` both failed (row trigger clones to new partitions), `TRUNCATE` **succeeded** as predicted (statement triggers do not clone).
- [x] 2.25 `DISABLE TRIGGER USER` → ok; `DETACH PARTITION "EventoAuditoria_2031"` → ok; `ENABLE TRIGGER USER` → ok; re-`ATTACH PARTITION` with the original range → ok. Run as `neondb_owner` (no separate app role provisioned), not "as the app role" per the task wording.
- [x] 2.26 `CREATE TABLE "EventoAuditoria_2099" PARTITION OF ...` failed as expected: `updated partition constraint for default partition "EventoAuditoria_default" would be violated by some row`. `DROP TABLE "EventoAuditoria"` on the branch succeeded; confirmed via `pg_tables` that no `EventoAuditoria*` table remained (partitions dropped with the parent).
- [x] 2.27 Deleted branch `rehearsal-audit` via Neon MCP `delete_branch` (user-confirmed). Shared/production instance untouched throughout (all `run_sql`/`db:migrate` calls scoped to `branch_id`/`DATABASE_URL` of the rehearsal branch only).
- [x] 2.28 Hashes frozen: `drizzle/0003_late_groot.sql` = `62e422f64149a52b9956a7bf2723d56d69e2eb9214e23f6047e6269191e76f3f`; `drizzle/0004_audit_log.sql` = `d8832f7d8dff7c25df83461ca37752e16070a83477e78df895eee4fd8740d720`. Phase 6 (6.1) re-checks these before the shared apply; re-rehearse on a fresh branch only if either changed.
- [x] 2.29 Checkpoint delivered to the user (this entry + the deviation below).

## Deviation — `42501` vs trigger exception (2.22/2.23)

Tasks.md and design docs expected the `REVOKE UPDATE, DELETE, TRUNCATE ... FROM PUBLIC` statements in `0004_audit_log.sql` (lines 81-93) to produce SQLSTATE `42501` for the blocked DML. In practice every rehearsal connection used `neondb_owner`, the table's **owner** — and table owners bypass `REVOKE`-based privilege checks in PostgreSQL regardless of the grantee named in the `REVOKE`. The block that actually fired every time was the `BEFORE`/row trigger `fn_EventoAuditoria_inmutable`, which does not check role and therefore protects the owner too.

**Consequence**: append-only enforcement is real and verified (10/10 blocked DML/TRUNCATE attempts across 2.22-2.24 failed), but the specific `42501` evidence in 2.22/2.23 could only be produced with a non-owner role, which this rehearsal had no credentials for (tracked as the existing open decision #8 "Neon role separation", `modelo_datos_sql.md` §4 note 12/13). Not a defect in `0004` — the `REVOKE`s remain correct defense-in-depth for a future least-privilege app role — but the task's literal `42501` assertion cannot be observed until that role exists. No change to `0004` needed; noting this against 2.22/2.23 in tasks.md.

## Next

WU1b's rehearsal is done and clean. Remaining before WU1b can be considered complete: none outstanding in Phase 2 — batches 1-4 cover tasks through 2.29. Ready for the user to review the `0004` diff + this evidence and decide on committing WU1b / moving to Phase 3, or opening the role-separation follow-up.

---

# Phase 3 (WU2a): Import primitives, xlsx gate, parser. **Branch: kept on `feat/catalog-excel-import-wu1b`** — user overrode the chain-strategy split (0.1) for this session: no `wu2a` branch created, everything continues on the current branch.

## Batch 1: task 3.1 (xlsx advisory gate)

Read-only. No install to the real repo; a throwaway install was done in an isolated scratchpad directory (outside the project) to get a real resolved dependency tree, then deleted; `git status` confirmed `package.json`/`package-lock.json` untouched.

- **Baseline**: `npm audit --omit=dev` on the current repo → 0 vulnerabilities (375 prod deps).
- **exceljs**: latest `4.4.0` (published 2024-12-20; no newer release since — stale but not abandoned/unpublished).
- **Direct deps of exceljs 4.4.0**: `tmp ^0.2.0`, `uuid ^8.3.0`, `dayjs ^1.8.34`, `jszip ^3.10.1`, `saxes ^5.0.1`, `archiver ^5.0.0`, `fast-csv ^4.3.1`, `unzipper ^0.10.11`, `readable-stream ^3.6.0`.
- **Real resolved-tree audit** (installed `exceljs@4.4.0` alone in the scratch dir, 97 packages): **2 moderate findings, 0 high/critical**:
  - `uuid` — `GHSA-w5hq-g745-h8pq` / `CVE-2026-41907`, "missing buffer bounds check in `v3()`/`v5()`/`v6()` when `buf` is provided", CVSS 6.3 moderate. Resolved `uuid@8.3.2` (range `<11.1.1` vulnerable). **Not reachable**: `rg` over `exceljs/lib` shows exactly one `uuid` import, `const {v4: uuidv4} = require('uuid')` in `cf-rule-ext-xform.js`; `v4()` is not one of the affected methods (`v3`/`v5`/`v6`) and exceljs never passes the `buf` argument. `fixAvailable` from npm is a semver-major exceljs downgrade (3.4.0) — not a real fix path and not needed given non-reachability.
  - `exceljs` — flagged only as the transitive parent of the `uuid` finding (`via: ["uuid"]`), no advisory of its own.
- **`unzipper`, `archiver`, `saxes`, `jszip`, `fast-csv`**: none flagged in the real audit at their exceljs-pinned versions. (Background research also surfaced `unzipper` CVE-2018-1002203/Zip-Slip, fixed since 0.8.13 — exceljs pins `^0.10.11`, well past the fix — and an old `archiver`→`minimatch` ReDoS advisory that npm audit did not surface against the resolved `archiver@5.x` tree, consistent with it having been fixed further down the chain.)

**Verdict: PASS.** No high/critical finding against the real dependency tree. Per 3.2's decision rule, proceed with `exceljs` (no need for the `read-excel-file`/`write-excel-file` fallback).

## Batch 2: task 3.2 (real install, user-confirmed)

- `npm install exceljs --save-exact --ignore-scripts` run against the real repo (91 packages added).
- `package.json` pins `"exceljs": "4.4.0"` (exact, verified via grep — no `^`/`~`).
- `npm audit --omit=dev` re-run against the real lockfile: **2 moderate, 0 high/critical** — identical findings to the 3.1 scratchpad evidence (`uuid` GHSA-w5hq-g745-h8pq, not reachable through exceljs's `v4()`-only usage). No new advisory surfaced by the real install.
- `package-lock.json` updated (+939/-5 lines, consistent with adding exceljs's dependency subtree).

## Next

3.3-3.8 (pure primitives: `limits.ts`, `guards.ts`, `normalize.ts`) don't depend on 3.2 and can proceed now that the scope reduction (Asignaturas/Docentes/Grupos only) is settled. 3.9 (real sample workbook from secretaria) is still an external dependency blocking 3.10-3.12/3.14.

## Batch 4: task 3.9 (real sample workbook)

- User supplied `docs/PlantillaCatalogo.xlsx`. Inspected read-only with `exceljs` (no repo files touched by the inspection itself): 3 sheets, matching the reduced scope exactly (Asignaturas, Docentes, Grupos — no Facultades/Carreras/Estudiantes/Inscripciones).
- Real headers vs. the design.md proposal: **Asignaturas** matches exactly (`Codigo`, `Nombre ` w/ trailing space — normalizes fine, `Carrera`, `HorasTotales`). **Docentes** differs: file has `Nombre`, proposal had `NombreCompleto` — corrected in `design.md`'s `SHEETS`. **Grupos** differs: file has `NumGrupo`, proposal had `NumeroGrupo` — corrected. Neither file has a `Telefono` column (optional, absent is fine).
- The workbook has **headers only, 0 data rows** — it settles column names but gives no evidence for row-volume caps. `limits.ts` (already GREEN from batch 3) is unaffected: its constants remain the same provisional defaults, now explicitly documented as still-open (design.md, specs/catalog-excel-import/spec.md updated).
- Also added, per user request: `specs/catalog-excel-import/spec.md` now requires the upload page to display the sheet/column contract and key validation rules **before** the file input (new scenario "Contract shown before upload"); `tasks.md` 9.13/9.14 (WU3b, not yet reached) updated to build that panel when the import UI is implemented.
- Correction made to the user in this batch: the upload page is used by `secretaria` (per `canImportCatalog`), not by `docente` — `docente` is the entity type the import creates, never the uploader.

## Next

3.10-3.12 (sheets.ts, RED/GREEN) can now proceed with the corrected column names. 3.14 (fixtures) can also proceed, using the corrected headers; real row-volume for cap calibration remains an open question deferred to the manual smoke test (9.25).

---

## Note — scope reduction after task 3.1

After 3.1 (xlsx advisory gate) landed, the product owner reduced the Excel workbook from 7 sheets to 3 (Asignaturas, Docentes, Grupos only — Facultades, Carreras, Estudiantes and Inscripciones are dropped). `proposal.md`, `design.md`, `tasks.md` (from 3.2 onward) and the affected specs were updated accordingly; nothing in this batch 1 evidence (the advisory gate itself) is sheet-dependent, so no rework was needed here.

---

## Batch 3: tasks 3.3-3.8 (pure primitives: `limits`, `guards`, `normalize`)

Pure, dependency-free modules (`limits.ts` has zero imports by design; `guards.ts` imports only `limits.ts`; `normalize.ts` has no imports). No npm install, no DB, no Neon command. Branch: kept on `feat/catalog-excel-import-wu1b` per the 0.1 override — no `wu2a` branch cut.

### TDD Cycle Evidence

| Task | Test file | RED | GREEN | REFACTOR |
|------|-----------|-----|-------|----------|
| 3.3/3.4 | src/lib/import/limits.test.ts | 8/8 fail: `Failed to resolve import "./limits"` (module absent) | 8/8 pass | prettier `--fix` only (one multi-line call wrap) |
| 3.5/3.6 | src/lib/import/guards.test.ts | 10/10 fail: `Failed to resolve import "./guards"` (module absent) | 10/10 pass | prettier `--fix` only (two multi-line call wraps) |
| 3.7/3.8 | src/lib/import/normalize.test.ts | 16/16 fail: `Failed to resolve import "./normalize"` (module absent) | 2 failed after first GREEN attempt (test arithmetic: `@uni.edu` is 8 chars, not 9 — fixed the two length-boundary fixtures for the 60/61-char login cases), then 16/16 pass | prettier `--fix` only (one method-chain reflow) |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx vitest run src/lib/import` (limits + guards + normalize): 34/34 pass |
| Runtime harness | N/A: all three modules are pure, no DB/library/network |
| Rollback boundary | delete `src/lib/import/limits.ts`, `limits.test.ts`, `guards.ts`, `guards.test.ts`, `normalize.ts`, `normalize.test.ts`; additive, no consumers yet (3.10+ extend `types.ts` and consume these) |

### Design/tasks.md value cross-check

No conflict found between `tasks.md` and `design.md` for this batch's values: `MAX_FILE_BYTES`/`MAX_ROWS_PER_SHEET`/`MAX_ROWS_TOTAL`/`MAX_NEW_ACCOUNTS_PER_APPLY`/`MAX_ACCOUNT_EVENTS_PER_APPLY`/`WRITE_CHUNK_ROWS`/`SERVER_ACTION_BODY_LIMIT` (design.md lines 329-340) match `tasks.md` 3.3 verbatim. `normalize.ts`'s `normalizeEmail`/`deriveLogin`/`LOGIN_MAX`/`PERIODO_RE` (design.md lines 601-607) match `tasks.md` 3.7. `normalizeKey` and `normalizePeriodo` are named in design.md's component table (line 302: "`normalizeEmail`, `deriveLogin`, `normalizePeriodo`, `normalizeKey`") and in `tasks.md` 3.7's task text, but neither document gives their exact interface signature or behavior beyond `tasks.md`'s prose ("`normalizeKey` (trim -> lowercase -> strip diacritics, used for headers); `normalizePeriodo` trims only") — followed `tasks.md`'s prose literally since design.md's Interfaces code block is silent on both.

### Suite state at end of batch

`npm test`: 278 passed, 5 failed — the same 5 pre-existing, unrelated failures already on record from batch 2/4 (`src/app/denied/page.test.tsx` x2, `src/app/(dashboard)/users/page.test.tsx` x2, `src/components/data-table-search.test.tsx` x1). No regression. `npm run typecheck`: clean. `npx eslint` on the six new files: clean after one `--fix` pass (prettier-only formatting, no real errors).

### Line count

`limits.ts` 16 + `limits.test.ts` 55 + `guards.ts` 44 + `guards.test.ts` 71 + `normalize.ts` 46 + `normalize.test.ts` 86 = 318 lines authored this batch, well under the ~500 WU2a budget (headroom ~300 vs 800).

### Next

3.9 ([USER][GATE], real sample workbook from secretaria) blocks 3.10-3.12/3.14; 3.2 is already done so 3.13/3.15/3.16 and WU3b's 9.6 are unblocked once 3.9 lands. Nothing else outstanding for 3.3-3.8.

---

## Batch 5: tasks 3.10-3.11 (`sheets.ts`, `types.ts` extension)

`sheets.ts` is pure data + header-matching logic; imports only `normalize.ts`'s `normalizeKey` (no duplication), no xlsx library. `types.ts` extended with type-only additions per design.md's Interfaces block. Branch kept on `feat/catalog-excel-import-wu1b` per the 0.1 override.

### TDD Cycle Evidence

| Task | Test file | RED | GREEN | REFACTOR |
|------|-----------|-----|-------|----------|
| 3.10/3.11 | src/lib/import/sheets.test.ts | 10/10 fail: `Failed to resolve import "./sheets"` (module absent) | 10/10 pass | none needed |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx vitest run src/lib/import/sheets.test.ts`: 10/10 pass |
| Runtime harness | N/A: pure data + string comparisons, no I/O, no xlsx library |
| Rollback boundary | delete `src/lib/import/sheets.ts`, `sheets.test.ts`; revert the `types.ts` addition (append-only, no prior export touched) |

### `types.ts` extension

Extended (did not overwrite) the pre-existing `CatalogSnapshot`/row types from WU1a (1.8). Added, type-only, per design.md's Interfaces block (lines 368-396): `RowError`, `EntityName` (`"Asignatura" | "Usuario" | "Grupo"` — not explicitly named in design.md, inferred from the `Record<EntityName, EntityCounts>` usage and the post-scope-reduction entity set: Docentes become Usuario rows, Facultad/Carrera/Estudiante/Inscripcion are out of scope), `EntityCounts`, `ParsedRow` (helper, not in design.md but needed to shape `ParsedWorkbook.sheets` without duplicating the sheet-name union), `ParsedWorkbook`, `ImportPlan` (shape only, `writes` typed as `Record<string, unknown>` since design.md leaves it as a comment placeholder), `ImportSummary`, `TemporaryCredential`.

**`ImportSummary` has no credential field**, verified by reading its own declaration:

```ts
export type ImportSummary = {
  actor: string;
  at: string;
  fileSha256: string;
  counts: Record<EntityName, EntityCounts>;
  accountsCreated: number;
  accountsUpdated: number;
};
```

No `clave`, `hashClave`, `password` or `TemporaryCredential` field anywhere on it (D16) — `npm run typecheck` and a full-repo grep for the type both confirm this.

### Suite state at end of batch

`npm test`: 287 passed, 6 failed. Compared against the batch-3 baseline (278 passed / 5 failed): +10 passed (this batch's `sheets.test.ts`), and **one new, unrelated failure** beyond the known 5 (`src/app/denied/page.test.tsx` x2, `src/app/(dashboard)/users/page.test.tsx` x2, `src/components/data-table-search.test.tsx` x1): `src/app/(dashboard)/users/new/new-user-form.test.tsx > NewUserForm role selector > never offers a non-assignable role to an administrador`. Investigated: fails identically in isolation (`npx vitest run` on just that file), same failure class as the other known failures (`getAllByRole("option")` finds nothing — a Radix/jsdom select-rendering issue in this environment), and this batch touched no file related to users/forms/roles. Treated as a newly-observed instance of the same pre-existing environment-flaky class, not a regression caused by 3.10/3.11. `npm run typecheck`: clean. `npx eslint` on the three touched files: clean after one `--fix` pass (CRLF-only noise in `types.ts`, consistent with prior batches).

### Line count

`sheets.ts` 62 + `sheets.test.ts` 92 + `types.ts` +71 (extension) = 225 lines authored this batch.

### Ambiguity resolved

- `EntityName`'s exact literal union is not spelled out in design.md (only used as `Record<EntityName, EntityCounts>`); resolved as `"Asignatura" | "Usuario" | "Grupo"` from the post-scope-reduction entity set (Docentes map to Usuario; Facultad/Carrera/Estudiante/Inscripcion are out of scope for this import).
- `ImportPlan.writes`'s design.md text is a comment placeholder (`{ /* per-entity create/update payloads, in dependency order */ }`); typed as `Record<string, unknown>` since 3.11 is shape-only (no logic yet — WU2b-1's `plan.ts` gives it real payload types).
- Added a `ParsedRow` helper type (not named in design.md) to express `ParsedWorkbook.sheets` cleanly; kept the sheet-name union inline (`"Asignaturas" | "Docentes" | "Grupos"`) rather than importing it from `sheets.ts`'s `SHEETS` via a type-level lookup, to avoid a fragile `typeof import(...)` construct — SHEETS names and this union must be kept in sync manually if a sheet is ever added or renamed (flagged for a future task, no test currently pins this).

### Next

3.12-3.13 (`schemas.ts`, zod validation) and 3.14 (fixtures, needs 3.2 which is already done) can proceed. 3.15-3.16 (`parse.ts`) depend on 3.14's fixtures.

---

## Batch 6: tasks 3.12-3.13 (`schemas.ts`, per-sheet zod validation)

Pure module: `schemas.ts` imports only `zod` and `./normalize` (`deriveLogin`, `PERIODO_RE`); no xlsx import, no DB. Branch kept on `feat/catalog-excel-import-wu1b` per the 0.1 override.

### TDD Cycle Evidence

| Task | Test file | RED | GREEN | REFACTOR |
|------|-----------|-----|-------|----------|
| 3.12/3.13 | src/lib/import/schemas.test.ts | 0/48 collected: `Failed to resolve import "./schemas"` (module absent) | 46/48 pass on first GREEN attempt (2 failures: a test-arithmetic bug in the Correo-length fixture, and `Periodo` trimming a trailing-space input into a match); fixed both (test fixture length, and `periodoSchema` no longer trims before the `PERIODO_RE` check) -> 48/48 pass | prettier `--fix` only (multi-line call wraps in the test file; `schemas.ts` needed none) |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx vitest run src/lib/import/schemas.test.ts`: 48/48 pass |
| Runtime harness | N/A: pure zod schemas, no I/O, no library, no DB — `npm run typecheck` is the only other proof needed and is clean |
| Rollback boundary | delete `src/lib/import/schemas.ts`, `schemas.test.ts`; additive, no consumers yet (3.15-3.16's `parse.ts` and 4.x's `plan.ts` will import it next) |

### Length caps verified against `src/db/schema.ts`

- `asignatura.codigo`: `varchar("Codigo", { length: 32 })` -> `Codigo` capped at 32.
- `asignatura.nombre` / `carrera.nombre` / `usuario.nombreCompleto`: all `varchar("Nombre"/"NombreCompleto", { length: 160 })` -> `Nombre`/`Carrera` capped at 160.
- `grupo.numeroGrupo`: `varchar("NumeroGrupo", { length: 12 })` -> `NumGrupo` capped at 12, coerced from a JS number to a trimmed string first (Excel stores `1` as a number).
- `usuario.correo`: `varchar("Correo", { length: 160 })` -> `Correo`/`CorreoDocente` capped at 160.
- Additional gate not in the DB column itself: `deriveLogin`'s `LOGIN_MAX` (60, `normalize.ts`, mirrors `usuario.login: varchar("Login", { length: 60 })`) is stricter than the 160-char `Correo` cap since Login is the whole normalized email — a 62-char email is under 160 but rejected via a `superRefine` producing `correo.loginTooLong`.

### Error messages are i18n keys, not prose (examples from `schemas.ts`)

- `` `${key}.required` `` (e.g. `"horasTotales.required"`, `"codigo.required"`) — missing or empty required field.
- `"horasTotales.invalid"` — present but non-integer, non-positive, or non-numeric.
- `"periodo.invalid"` — fails `PERIODO_RE` (case- and whitespace-sensitive, no trim before the check).
- `"correo.invalid"` / `"correoDocente.invalid"` — fails `z.string().email()`.
- `"correo.loginTooLong"` / `"correoDocente.loginTooLong"` — normalized email exceeds `deriveLogin`'s 60-char `LOGIN_MAX`.

No message contains a space or natural-language prose (asserted directly in one test: `expect(message).not.toMatch(/\s/)`).

### Suite state at end of batch

Fresh full-suite run (not reused from a prior batch): `npm test` 341 total, 336 passed, 5 failed. All 5 failures are the same pre-existing environment-flaky class already on record (`src/app/denied/page.test.tsx` x2, `src/app/(dashboard)/users/page.test.tsx` x2, `src/components/data-table-search.test.tsx` x1) — identical failing test names to the batch-5 baseline set, except the sixth known-flaky test (`new-user-form.test.tsx`'s role-selector test) passed this run instead of failing (flaky in either direction, not caused by this batch: `schemas.ts`/`schemas.test.ts` touch no user-form/role code). Batch-5 baseline was 287 passed / 6 failed / 293 total; this batch adds exactly 48 new tests (293 + 48 = 341 total), consistent with no regression. `npm run typecheck`: clean. `npx eslint src/lib/import/schemas.ts src/lib/import/schemas.test.ts`: clean after one `--fix` pass (prettier-only multi-line wraps).

### Ambiguity resolved

- `Periodo` is validated WITHOUT trimming before the `PERIODO_RE` check, unlike every other string field here (which trims): a trailing-space input (`"2026-S1 "`) must fail, matching `normalize.test.ts`'s direct `PERIODO_RE` table (tasks.md 3.7) rather than absorbing whitespace the way a trimmed field would. `parse.ts` (3.15-3.16) is expected to hand `schemas.ts` already-trimmed cell values per `ParsedRow`'s "trimmed values" contract (`types.ts`), so this only matters for a cell whose trim boundary is itself the malformed part — kept strict since tasks.md's literal RED-test table for Periodo includes the untrimmed case.
- `Carrera`'s length cap is not explicitly named in tasks.md 3.12 (only `Codigo`/`Nombre`/`NumGrupo`/`Correo`/login are listed); capped it at 160 to match `carrera.nombre`'s `varchar(160)` in `src/db/schema.ts`, since `Carrera` is a lookup-by-name string that must fit that column.
- `Telefono` (Docentes, optional) was given a 30-char cap matching `usuario.telefono: varchar("Telefono", { length: 30 })`, though no test in 3.12's task text names it — included for consistency with the "match the DB varchar lengths exactly" instruction; not exercised by a dedicated test since it is optional and out of the task's explicit scope.

### Line count

`schemas.ts` 133 + `schemas.test.ts` 275 = 408 lines authored this batch (WU2a running total: ~500 estimate; 3.3-3.11 used ~543 already, so WU2a is now over its ~500 estimate at ~951 — flagged for the WU2a checkpoint (3.19), not a blocker for this task pair).

### Next

3.14 (fixtures, `build-fixtures.mjs`) can proceed now that `schemas.ts` exists for `parse.ts`/`plan.ts` to eventually consume. 3.15-3.16 (`parse.ts`) depend on 3.14's fixtures.

---

## Batch 7: tasks 3.14-3.16 (`build-fixtures.mjs`, `parse.ts`, `parse.test.ts`)

`parse.ts` is a thin adapter: exceljs -> `ParsedWorkbook`, calling into the already-built `sheets.ts` (`findMissingColumns`, `resolveHeaderIndex`) for header logic rather than reimplementing it. It is the sole read-side xlsx library import in `src` (plus the WU3b `template.ts`, not yet built). Branch kept on `feat/catalog-excel-import-wu1b` per the 0.1 override.

### TDD Cycle Evidence

| Task | Test file | RED | GREEN | REFACTOR |
|------|-----------|-----|-------|----------|
| 3.15/3.16 | src/lib/import/parse.test.ts | 0/9 collected: `Failed to resolve import "./parse"` (module absent) | 9/9 pass on first GREEN attempt | prettier `--fix` only (multi-line call wraps in both `parse.ts` and `parse.test.ts`; no logic changed) |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx vitest run src/lib/import`: 101/101 pass (92 pre-existing + 9 new) |
| Runtime harness | `parse.ts` against the 9 committed real `.xlsx` fixtures (real bytes through the real `exceljs` library, `// @vitest-environment node`) — this IS the runtime harness for this unit, per design.md's own Integration-layer entry for `parse.ts` |
| Rollback boundary | delete `src/lib/import/parse.ts`, `parse.test.ts`, `src/lib/import/__fixtures__/*`; additive, no consumers yet (WU2b-1's `plan.ts` and WU3b's UI will import `parse.ts` next) |

### Fixture construction notes (3.14)

- `valid.xlsx`: 3 sheets, cross-referencing (`Grupos` rows reference an `Asignatura` and a `Docente`/`Usuario` present in the same workbook); a deliberate trailing blank row on `Asignaturas` to also cover 3.15's "blank trailing rows are ignored" scenario without a 10th fixture file.
- `corrupt-zip.xlsx`: a real `valid.xlsx` buffer truncated to 60% of its length — keeps the leading `PK` signature (passes `guards.ts`'s ZIP check) but destroys the trailing central directory record, so `exceljs`'s `xlsx.load` throws.
- `text-as-xlsx.xlsx`: literally `Buffer.from("hello")`.
- `row-cap-exceeded.xlsx`: `MAX_ROWS_PER_SHEET + 1` (imported from `limits.ts`, never hardcoded) data rows on `Asignaturas`; the other two sheets carry one valid row each so the error is isolated to the sheet under test.
- `dimension-lie.xlsx` / `external-reference.xlsx`: exceljs has no public API to write malicious/lying XML, so both are built by generating a normal small workbook with exceljs, then loading the resulting zip with `jszip` (an already-installed transitive dependency of `exceljs`, not added to `package.json`) and rewriting one XML part before re-zipping:
  - `dimension-lie.xlsx`: `xl/worksheets/sheet1.xml`'s `<dimension ref="A1:D3"/>` rewritten to `<dimension ref="A1:D10000000"/>`; the sheet still holds only 2 real data rows.
  - `external-reference.xlsx`: discovered mid-implementation that exceljs stores cell text in `xl/sharedStrings.xml` (a shared-string table), not inline in the sheet XML — the first attempt to inject into `sheet1.xml` silently did nothing (the literal `XXE_MARKER` placeholder was never found there). Fixed by injecting into `xl/sharedStrings.xml` instead: `<!DOCTYPE root [<!ENTITY xxe "PWNED-BY-XXE">]>` plus a `&xxe;` reference replacing one cell's shared-string text. This is an **internal** general entity (no `SYSTEM`/network target), so the test proves non-expansion without any real file/network access risk.

### `parse.ts` design decisions (3.15/3.16 ambiguity resolution)

- **Error shape**: reused the existing `RowError` type from `types.ts` (`{ sheet, row, reason, value? }`) for both structural and file-level errors, rather than inventing a new error type, per the task's explicit instruction. `row: 0` is the sentinel for "not a specific data row" (missing sheet, corrupt/invalid file); `sheet: ""` is the sentinel for a file-level error with no sheet context (corrupt zip, non-zip bytes). `ParseResult` returns a single `error` (not an array): design.md and the spec both describe parse-time failures as fail-fast/singular ("a structural error", "a validation error"), unlike `plan.ts`'s per-row error aggregation.
- **"Excel row numbers"**: 1-indexed as a user sees them in Excel, header row (1) excluded from data rows — the first data row is row 2. Verified directly in the valid-workbook test (`row: 2`, `row: 3`).
- **"Stop early, not read the whole oversized file first"**: `exceljs`'s non-streaming `xlsx.load` already reads the whole archive into memory (there is no way around that with the sync API and the design does not call for the streaming `WorkbookReader`, which would be a much larger change for a fixture set this small). "Stop early" is implemented at the row-iteration level: a `RowCapExceeded` sentinel thrown from inside `worksheet.eachRow`'s callback breaks iteration as soon as the cap is crossed, so a sheet past the cap never has all of its rows materialized into `ParsedRow[]`, and no subsequent sheet is touched at all. This satisfies "not a timeout" and "stops early" without literal streaming I/O.
- **Dimension-lie handling**: no special-casing needed. `exceljs`'s `eachRow` iterates the sheet's actually-populated row model, not the `<dimension>` tag's claimed range, so the real-row-count requirement was satisfied automatically once the row-cap logic above was in place. Verified by the dedicated fixture test (`sheets.Asignaturas` has exactly the 2 real rows, not anywhere near 10,000,000).
- **`MAX_ROWS_TOTAL` — no dedicated fixture, and no dedicated executable RED test.** With exactly 3 sheets and `MAX_ROWS_PER_SHEET = 10,000`, the maximum possible total across all sheets is `3 x 10,000 = 30,000`, which **equals** `MAX_ROWS_TOTAL` exactly rather than exceeding it. It is mathematically impossible to cross `MAX_ROWS_TOTAL` with real per-sheet data without first crossing some sheet's own `MAX_ROWS_PER_SHEET` (which fires first, since the per-sheet check runs before the total check for the same row). The total-cap code path (`workbook.tooManyRows`, sharing the same `RowCapExceeded` mechanism as the per-sheet cap) is implemented as defense-in-depth for a future sheet-count increase, but is not independently exercised by a fixture — building a ~30,001-row fixture to exercise unreachable-by-construction logic was judged not worth the size/line-count cost given this batch's explicit discipline instruction. Flagged here for visibility, not hidden.
- **`rg "exceljs|read-excel-file" src`** (quoted verbatim below) shows the one-off `build-fixtures.mjs` dev script as a second importer, alongside `parse.ts`. This is expected and required by 3.14 itself ("a one-off Node script... using `exceljs`"); 3.16's "only file" constraint is about production/app source that ships in the Next.js build, not a standalone generator script that is `git`-committed for reproducibility but never imported by the app.

```
src\lib\import\guards.ts:// These run BEFORE any untrusted-archive parsing (exceljs is never invoked
src\lib\import\sheets.test.ts:// imports the xlsx library: only `parse.ts` touches exceljs.
src\lib\import\parse.ts:import ExcelJS from "exceljs";
src\lib\import\parse.ts:// exceljs -> ParsedWorkbook (decision 6/D2). The ONLY read-side xlsx library
src\lib\import\parse.ts:/** Internal signal used to break out of exceljs's `eachRow` as soon as a cap
src\lib\import\parse.ts:    // exceljs's bundled .d.ts redeclares an ambient `Buffer extends
src\lib\import\parse.test.ts:// Real bytes through the real library (exceljs), never jsdom: avoids the
src\lib\import\__fixtures__\build-fixtures.mjs:import ExcelJS from "exceljs";
src\lib\import\__fixtures__\build-fixtures.mjs:  // exceljs stores cell text in xl/sharedStrings.xml (shared strings table),
```

### A typecheck-only deviation found and fixed during GREEN

`Buffer.from(bytes)` (real Node `Buffer`) did not type-check against `exceljs`'s `xlsx.load(buffer: Buffer, ...)` signature: `exceljs`'s bundled `.d.ts` declares its own ambient `interface Buffer extends ArrayBuffer {}`, which merges with `@types/node@^24`'s generic `Buffer<T>` and produces a structural mismatch (`Buffer<ArrayBuffer>` is reported as missing `maxByteLength`/`resizable`/`resize`/`detached`, all `ArrayBuffer`-only members `Buffer<T>` does not fully expose). This is a type-level-only artifact of the two ambient declarations merging, not a real runtime issue (the value passed is a genuine `Buffer` instance) — resolved with a narrow `as never` cast at the single call site, commented in place.

### Suite state at end of batch

Fresh full-suite baseline taken BEFORE this batch's changes: `npm test` 341 total, 336 passed, 5 failed — all 5 the same pre-existing environment-flaky class already on record (`src/app/denied/page.test.tsx` x2, `src/app/(dashboard)/users/page.test.tsx` x2, `src/components/data-table-search.test.tsx` x1). After this batch: `npm test` 350 total (341 + 9 new), 345 passed, 5 failed on a clean re-run — identical 5 failing test names to the baseline, no new failures, no regression. (One run in between showed 6 failed/344 passed with an extra transient failure in `users/page.test.tsx`'s `shows the new-user button to every creator`; re-run immediately after came back to the same 5 known failures — consistent with the flakiness this same test file has shown since batch 5/6, not caused by this batch's files.) `npm run typecheck`: clean. `npm run build`: succeeds (10 static pages). `npx eslint` on the three touched files: clean after one `--fix` pass (prettier-only multi-line wraps in `parse.ts`/`parse.test.ts`; the `.mjs` script needed no fix).

### Line count (fixtures excluded — binary)

| File | Lines |
|------|-------|
| `src/lib/import/__fixtures__/build-fixtures.mjs` | 193 |
| `src/lib/import/parse.ts` | 154 |
| `src/lib/import/parse.test.ts` | 144 |
| **Batch 7 total (incl. the .mjs script)** | **491** |

**WU2a running total** (per the batch instruction's exact formula — sum of all logic+test **`.ts`** files under `src/lib/import/`, excluding `__fixtures__` binaries; the `.mjs` fixture-generator script is a one-off dev tool, not a `.ts` app/test file, so it is not part of this sum though it is listed above for full transparency):

| File | Lines |
|------|-------|
| `limits.ts` | 16 |
| `guards.ts` | 44 |
| `normalize.ts` | 46 |
| `limits.test.ts` | 55 |
| `sheets.ts` | 64 |
| `guards.test.ts` | 71 |
| `normalize.test.ts` | 86 |
| `sheets.test.ts` | 98 |
| `types.ts` | 128 |
| `schemas.ts` | 133 |
| `parse.test.ts` | 144 |
| `parse.ts` | 154 |
| `schemas.test.ts` | 275 |
| **Total** | **1314** |

This is a real `wc -l` sum taken at the end of this batch (not carried forward from prior batches' own estimates, which is why it does not exactly match "951 + 298"-style arithmetic from batch 6's note — that number was itself an in-flight estimate, not a fresh measurement). WU2a's original estimate was ~500 lines (later ~580, then ~500 again after the 3-sheet scope reduction); the measured 1,314 is well over that, consistent with every prior WU2a batch's own running commentary that tests dominate the actual count. This is flagged for the 3.19 WU2a checkpoint, not a blocker for 3.14-3.16 themselves.

### Remaining in Phase 3 (WU2a)

3.17 (optional REFACTOR: move header-to-column resolution shared by `parse.ts`/`template.ts` into `sheets.ts` — not attempted this batch, `parse.ts` already calls into `sheets.ts`'s existing `findMissingColumns`/`resolveHeaderIndex` rather than duplicating them, so there is no duplication yet to extract; revisit once WU3b's `template.ts` exists and an actual duplication appears), 3.18 (verification: already covered above except the `npm audit --omit=dev` re-run, not repeated this batch since no dependency changed), 3.19 (WU2a checkpoint for the user).

## Batch 8: WU2a checkpoint (3.18-3.19) + delivery split

Orchestrator-verified independently (not just agent-self-reported): `npm test` 345 passed / 5 failed (same known pre-existing environment flakes, unchanged since batch 2); `npm run typecheck` clean; `npm run build` succeeds; `rg "exceljs|read-excel-file" src --files-with-matches` → `guards.ts`, `parse.ts`, `parse.test.ts`, `sheets.test.ts` (only `parse.ts` is an actual import — `import ExcelJS from "exceljs"` — the other three hits are comment mentions); `npm audit --omit=dev`: 2 moderate / 0 high-critical, unchanged since 3.2.

**Delivery decision (user, ask-on-risk)**: WU2a's real total (1,314 lines) is over the 800-line review budget. Agents never commit/push/open PRs in this project (`ask-on-risk`, user delivers manually) — nothing from this entire change is committed yet. User asked to split WU2a into two logical parts for their own commit/PR chain, not to have the agent restructure files (the files are already separated by concern):

- **Part A — pure primitives + contract** (~866 lines): `limits.ts`+test, `guards.ts`+test, `normalize.ts`+test, `sheets.ts`+test, `types.ts` (extended), `schemas.ts`+test. No xlsx library dependency; fully unit-testable without any file I/O.
- **Part B — fixtures + parser** (~491 lines, depends on Part A): `__fixtures__/build-fixtures.mjs` + the 9 generated `.xlsx` fixtures (binary, excluded from the line count), `parse.ts`+test. This is the only part that imports `exceljs`.

The user decides whether Part A/B become one commit each on the same `wu2a` work, two chained PRs, or however they choose to structure it against `feat/catalog-excel-import-wu1b`; the file boundary above is only a suggested split point, not something the agent enforces.

---

# Phase 4 (WU2b-1): Pure planner and audit types. Branch: kept on `feat/catalog-excel-import-wu1b` per the earlier user override (0.1) — no separate `wu2b1` branch cut this session. Nothing committed to git.

Environment note: `node_modules` was absent at the start of this session (fresh container); ran `npm install` (830 packages) and added a local-only `.env.local` (gitignored, placeholder `DATABASE_URL`/`AUTH_SECRET`) purely so `npm run build`/`typecheck` can run — no real DB touched. `package-lock.json` picked up a 180-line diff (npm normalizing `libc`/`os` optional-dependency metadata for the platform list) as a side effect of the fresh install; not a deliberate dependency change and not committed.

## Completed

- [x] 4.1 `src/lib/audit/types.ts`: `AUDIT_ACTIONS`, `AuditEntityType`, `AUDITABLE_USER_FIELDS` (no `login`/`hashClave`), `AuditEvent` closed union, per the design's Interfaces block. Type-only circular import with `src/lib/import/types.ts` (`AuditableUserField` in, `EntityName`/`EntityCounts` out) — both sides use `import type`, erased at compile time, no runtime cycle; `npm run typecheck` confirms.
- [x] 4.2 `src/lib/import/__fixtures__/plan-fixtures.ts`: `makeSnapshot(overrides)`, `makeWorkbook(overrides)` — plain-object builders, no `.xlsx`, Excel row numbers auto-assigned from row 2.
- [x] 4.3-4.15 `src/lib/import/plan.ts` + `plan.test.ts`, all seven stages (A Asignaturas, B Docentes, C Grupos, D deactivate-absent, E idempotency/error-aggregation, F caps-as-validation, G purity) written together rather than strict stage-by-stage RED/GREEN cycles (each stage's scenarios were authored as one test block per stage against the finished `plan.ts`, then run once) — 44/45 passed on the first run; one test-only bug (URL-scheme mismatch reading `plan.ts`'s own source under jsdom) fixed to use `path.resolve(process.cwd(), …)` instead of `import.meta.url`; one self-referential false positive in the purity source-regex test (the file's own top comment said "no Date.now()", which matched the `/Date\.now/` pattern) fixed by rewording the comment to "no clock reads". 45/45 thereafter.
- [x] 4.17 `npm test`: 390 passed / 5 failed (identical failing test names to every prior batch's documented environment-flaky class: `denied/page.test.tsx` x2, `users/page.test.tsx` x2, `data-table-search.test.tsx` x1 — none touch import/audit/catalog code). `npm run typecheck`: clean. `npx eslint` on all new/touched files: clean after one `--fix` pass (prettier-only).
- [x] 4.18 Checkpoint (below): measured total is **over the 800-line budget** (in line with every prior WU2a/WU2b batch's own observation that tests dominate the real count) — flagged, not silently absorbed.

## Deviation — `UsuarioRow` gained `telefono`

`src/lib/import/types.ts`'s `UsuarioRow` (WU1a) and `src/lib/data/catalog.ts`'s `loadCatalogSnapshot` select did not carry `telefono`, but the Docentes sheet has an optional `Telefono` column and Stage B must detect a changed phone number the same way it detects a changed name. Added `telefono: string | null` to `UsuarioRow` and `telefono: usuario.telefono` to the snapshot select (one-line, additive). Verified `catalog.test.ts` still passes unmodified: its recording `exec` double ignores the projection object and returns the raw fixture row, so extending the real `select()` call does not change what the double returns.

## Design choices not fully pinned by `design.md` (resolved here)

- `ImportPlan.writes` was a `Record<string, unknown>` placeholder in `design.md`/`types.ts` (WU2a). Gave it a concrete shape: `AsignaturaWrite`/`UsuarioWrite`/`GrupoWrite` discriminated unions (`kind: "create" | "update"`), grouped as `ImportWrites = { asignaturas, usuarios, grupos }`. `GrupoWrite` carries **natural keys** (`asignaturaCodigo`, `docenteCorreo`), never an id, because a referenced Asignatura/Usuario may itself be a same-workbook `create` whose id does not exist yet in a pure planner — `apply.ts` (WU2c) resolves both after the Asignatura/Usuario writes land in dependency order, matching the design's data-flow diagram order (Asignatura ▸ Usuario(docente) ▸ Grupo).
- Reactivation (Stage D) is folded into `GrupoWrite`'s `update` variant with a `reactivated: boolean` flag rather than a separate plan-level list or count — `EntityCounts` has no dedicated "reactivate" field and task 4.9's own wording treats it as an `update`.
- Row-error `reason` strings are i18n keys mirroring `schemas.ts`'s convention (e.g. `carrera.unresolved`, `docente.unresolved`, `login.collision`, `accountsToCreate.capExceeded`) — not enumerated anywhere in `design.md`, chosen for consistency with the existing zod message keys.
- An inactive matched docente account (Stage B) is left alone: the plan never emits an `activo` write for `Usuario` (open assumption per task 4.5, characterized by a dedicated test, not silently assumed).

## Line count

| File | Lines |
|------|-------|
| `src/lib/audit/types.ts` | 64 |
| `src/lib/import/plan.ts` | 418 |
| `src/lib/import/plan.test.ts` | 963 |
| `src/lib/import/__fixtures__/plan-fixtures.ts` | 61 |
| `src/lib/import/types.ts` (diff, extension only) | ~90 |
| `src/lib/data/catalog.ts` (diff) | +1 |
| **Total authored this phase** | **~1,597** |

Well over the ~460 estimate and the 800-line review budget — consistent with WU2a's own measured overrun (1,314 vs ~500 estimate) and WU1a's (~735 vs ~440). `plan.test.ts` alone (963 lines) is the bulk of it: ~45 scenarios across 7 stages, each asserting counts, writes and error reasons in full (not just booleans), plus prettier's multi-line object formatting after `--fix`. No shortcut was taken to hit the budget (no scenario dropped, no assertion weakened).

**4.16 (optional REFACTOR) intentionally skipped**: `plan.ts` at 418 lines is already organized as clearly commented sections (Stage A-F) inside one function: splitting it into a `plan/` directory of per-stage helper files would add indirection (each stage reads and writes shared local maps — `carreraIdByName`, `usuarioByCorreo`, `docenteByCorreo`, etc. — that would become explicit parameters/returns across 5-6 functions) without changing behavior or making review easier at this size; deferred, not forgotten.

**Delivery decision needed** (ask-on-risk, same pattern as WU2a's batch 8): the user should decide how `audit/types.ts` + `plan.ts`/`plan.test.ts`/fixtures + the `catalog.ts`/`types.ts` extensions become one or more commits/PRs against the `wu1b`-based work in progress. No restructuring suggested here — everything is additive with no consumers yet (WU2b-2's `events.ts` is the first consumer of `AuditableUserField`/`AuditEvent`; WU2c's `apply.ts` is the first consumer of `plan.ts`'s writes).

## Next

Phase 5 (WU2b-2, pure audit event builders in `src/lib/audit/events.ts`) is unblocked: it only needs `AuditEvent`/`AUDITABLE_USER_FIELDS` from `audit/types.ts` (done) and `ImportSummary`/`EntityCounts` from `import/types.ts` (done, unchanged by this phase). Nothing in Phase 4 blocks it.

---

# Phase 5 (WU2b-2): Pure audit event builders. Branch kept on `feat/catalog-excel-import-wu1b` per the 0.1 override — no separate `wu2b2` branch cut this session. Nothing committed to git during this phase (committed together with the rest of the work-so-far per the user's git-push cadence — see the commit history on `claude/excel-upload-module-kuyaot`, not the `feat/*` chain named in tasks.md's original branch plan).

## Completed

- [x] 5.1-5.2 `src/lib/audit/events.ts` (103 lines) + `events.test.ts` (230 lines, 13 tests), written together against the design's exact Interfaces block and run once: 13/13 passed on the first attempt, no fix cycle needed.
- [x] 5.3 Two `// @ts-expect-error` pins (a `clave` key on `accountUpdatedEvent`'s payload; a `TemporaryCredential`-shaped object passed to `accountCreatedEvent`) plus a recursive forbidden-key sweep (`clave`, `password`, `hash`, `hashClave`) over a 4-entry fixture matrix (empty import, create-only, update-only, both). All pass; `npm run typecheck` confirms neither `@ts-expect-error` is unused (i.e. both really do fail to typecheck without the comment).
- [x] 5.4 No gap exposed by 5.3 — `audit/types.ts`'s closed union already rejected both cases; not a characterization-pin situation since the directives are genuinely load-bearing (removing either one now fails `typecheck`, verified).
- [x] 5.5 `npm test`: 403 passed / 5 failed (same 5 pre-existing environment-flaky tests as every prior batch, unrelated to audit/import code — unchanged set of failing test names). `npm run typecheck`: clean. `npx eslint --fix` on both new files: one pass, prettier-only (multi-line object wraps), no real errors.
- [x] 5.6 Checkpoint (below).

## Ambiguity resolved — `accountCreatedEvent`'s `campos`

`design.md`'s interface for `accountCreatedEvent` takes no `campos` parameter (`{ usuarioId, rol, importacionSha256 }` only), yet its `AuditEvent` variant's payload type (`UserChangedPayload`) requires `campos: readonly AuditableUserField[]`. Resolved by having `accountCreatedEvent` always set `campos: AUDITABLE_USER_FIELDS` (the full closed list) internally: a freshly created account has every auditable field set at once, so reporting the whole field-name list (never a value, per decision 22) is the natural reading of "what changed" for a creation. Pinned by a dedicated test (`accountCreatedEvent > … campos ⇒ AUDITABLE_USER_FIELDS`).

`buildAuditEvents`'s design signature also omits a separate `importacionSha256` parameter — resolved by reading it from `summary.fileSha256` (already on `ImportSummary`) for every generated account event, so there is exactly one source of truth for the file hash, never re-derived or passed twice. Pinned by the "propagates from summary.fileSha256, not re-derived" test.

## Line count

| File | Lines |
|------|-------|
| `src/lib/audit/events.ts` | 103 |
| `src/lib/audit/events.test.ts` | 230 |
| **Total** | **333** |

Under the 800-line budget (and much closer to the ~170 estimate than WU1a/WU2a/WU2b-1 landed relative to theirs) — no scope was cut to hit this; the estimate for a small, purely-typed builder module was simply closer to reality here.

## Next

Phase 6 (Gate G-DB, the shared-instance apply of `0003`+`0004`) is the next item in `tasks.md`'s order, but every one of its tasks is `[READ-ONLY]` or `[CONFIRM]` against the real Neon instance — it needs the user's per-command "yes" and is not something to proceed on without that. Phase 7 (WU2c: temp passwords, CSV, `createUsuariosBulk`, `apply.ts`, the audit writer wired in-tx) is the next phase with pure/local work, but per design decision 23/24 it must NOT be started before Phase 6, because `apply.ts` is meant to be exercised against the real, migrated schema in the transaction-critical slice — WU2c's own rollback boundary assumes `0003`/`0004` already exist. Recommend pausing here for the user to decide on Phase 6 (the DB apply), rather than starting Phase 7's code against an unmigrated schema.

---

# Phase 7 (WU2c) batch 1: tasks 7.1-7.8 (temp password, credentials CSV, bulk user insert, summary). Branch kept on `feat/catalog-excel-import-wu1b`. Nothing committed; no database access.

## Completed

- [x] 7.1/7.2 `temp-password.ts` + test. RED: `npx vitest run` failed with "Failed to resolve import @/lib/import/temp-password" (module absent). GREEN: 5/5. `node:crypto.randomInt` default, injectable RNG, called as `(0, 32)`.
- [x] 7.3/7.4 `credentials-csv.ts` + test. RED: failed on the missing module. GREEN: 12/12 (BOM, header `Login,NombreCompleto,Clave`, CRLF rows, RFC 4180 quoting, `'` prefix for `= + - @ \t \r`, accents kept).
- [x] 7.5/7.6 `createUsuariosBulk(tx, rows)` in `users.ts` + `src/lib/data/users.test.ts`. RED: 5/5 failed with "createUsuariosBulk is not a function". GREEN: 5/5; `npx vitest run src/lib/data` 36/36. Chunks at `WRITE_CHUNK_ROWS` (501 rows -> 2 statements), ids in input order via `.returning({ id })`, forces `debeCambiarClave: true`.
- [x] 7.7/7.8 `summary.ts` + test. RED: failed on the missing module. GREEN: 5/5 (`buildImportSummary`, `logImportSummary`, `expectTypeOf` key pin).

## Ambiguity resolved

- Task 7.5 names `src/lib/data/users.test.ts`; the existing data tests live in `users-data.test.ts` (drizzle.mock based). Created the new file named by the task, since it uses a different, hand-rolled `tx` double.
- Alphabet: the task text says "no `0 O 1 I L`", but the pinned alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (D8) contains `L` and omits `I`/`O`/`0`/`1`. Kept the pinned string; the test asserts only `0 O 1 I` are absent.
- `createUsuariosBulk` rows are `NuevaCuentaImportada = Omit<NuevoUsuario, "debeCambiarClave">` (carries `rolId`, already resolved, and the bcrypt `hashClave`); the executor type reuses `CatalogExecutor`.
- `buildImportSummary(input: ImportSummary)` copies the six fields explicitly (so extra keys cannot ride along); `actor`, `at`, `fileSha256`, counts and account totals are supplied by the caller (the clock and actor are not read here). `logImportSummary(summary, logger = console.info)` emits one `JSON.stringify` line with `event: "catalog.import.applied"`. Credentials CSV header names (`Login,NombreCompleto,Clave`) and the event name are not fixed by the spec; chosen here.
- Small test-authoring slip: the credentials CSV and summary tests were lightly edited (escape fix, wording) after their first RED run; the RED reason (module missing) was unchanged.

## Verification

`npm test`: 435 total, 430 passed, 5 failed (the known flaky set: `users/page.test.tsx` "renders users.noResults.* and a clear control..." and "shows the new-user button to every creator"; `denied/page.test.tsx` x2; `data-table-search.test.tsx` "renders a clear link..."). `npm run typecheck`: clean. `npx eslint` on touched files: clean after `--fix` on new files, apart from pre-existing CRLF `Delete ␍` noise on `users.ts`. `npm run build` not run.

## Line count

| File | Lines |
|------|-------|
| `src/lib/import/temp-password.ts` | 23 |
| `src/lib/import/temp-password.test.ts` | 61 |
| `src/lib/import/credentials-csv.ts` | 24 |
| `src/lib/import/credentials-csv.test.ts` | 84 |
| `src/lib/import/summary.ts` | 27 |
| `src/lib/import/summary.test.ts` | 91 |
| `src/lib/data/users.test.ts` | 93 |
| `src/lib/data/users.ts` (diff, additive) | ~+28 |
| **Batch total** | **~431** |

Against the 800-line WU2c budget: ~431 used; 7.9-7.19 (audit writer, `apply.ts`, tests) must fit in ~370 or WU2c will exceed it. Flagged, not cut.

## Next

7.9 (RED audit writer test, `src/lib/data/audit.test.ts`) onward.

---

# Phase 7 (WU2c) batch 2: tasks 7.9-7.19 (audit writer, `apply.ts`, in-transaction audit, `runImportApply`) plus the batch 1 hardening item. Branch kept on `feat/catalog-excel-import-wu1b`. Nothing committed; no database access of any kind (every test uses hand-rolled recording `tx` doubles; `npm run build` ran without a live database).

Mode: Strict TDD. Cycles were done pair by pair (7.9/7.10, 7.11/7.12, 7.13/7.14, 7.15/7.16, then 7.17), each RED run before its GREEN code. `size:exception` for WU2c is accepted by the user (single PR, review budget 800 lines exceeded).

## Completed

- [x] Post-review change to 7.5/7.6: `createUsuariosBulk` no longer trusts `RETURNING` order.
- [x] 7.9/7.10 `src/lib/data/audit.ts` + `audit.test.ts`
- [x] 7.11/7.12 `src/lib/import/apply.ts` `applyImport` entity writes + `apply.test.ts`
- [x] 7.13/7.14 audit written last, same `tx`, inside `applyImport`
- [x] 7.15/7.16 `runImportApply` orchestration
- [x] 7.17 REFACTOR into per-entity writers (`writeAsignaturas`, `writeUsuarios`, `writeGrupos`, `deactivateGrupos`)
- [x] 7.18 verification (below)
- [x] 7.19 checkpoint notes (below)

## TDD Cycle Evidence (batch 2)

| Task | Test file | RED (run before GREEN code) | GREEN | REFACTOR |
|------|-----------|-----------------------------|-------|----------|
| 7.5/7.6 hardening | src/lib/data/users.test.ts | 4 failed / 5 passed: shuffled `RETURNING` returned ids reversed, unknown login did not throw, missing id did not throw, duplicate input login did not throw | 9/9 | none; test double now returns `{ id, login }` (old cases unchanged and still pass) |
| 7.9/7.10 | src/lib/data/audit.test.ts | suite failed: `Failed to resolve import "@/lib/data/audit"` | 7/7; `npm run typecheck` clean, which also proves the `@ts-expect-error` (passing `db` is a compile error) is load-bearing | none needed |
| 7.11/7.12 | src/lib/import/apply.test.ts | suite failed: `Failed to resolve import "@/lib/import/apply"` | 14/14 | none yet (see 7.17) |
| 7.13/7.14 | apply.test.ts (new `in-transaction audit` block, 8 tests) | 4 failed (no audit rows existed: last-statement order, ids/actor, idempotent single import row, failing audit insert propagates) / 4 passed vacuously (negative guards: invalid plan, entity failure, late throw, no credentials in payload) | 22/22 after two 7.11 tests were narrowed to entity statements (`entityStatements(buffer)`), because the audit insert now shares the buffer | none |
| 7.15/7.16 | apply.test.ts (new `runImportApply` block, 9 tests) | 9 failed: `runImportApply` and `ImportRejectedError` not exported | 31/31 | none |
| 7.17 | apply.test.ts | n/a (no new behaviour) | 31/31 unchanged after extraction; `src/lib/data` + apply 78/78, typecheck clean | per-entity writers extracted; `applyImport` is now a 30-line sequence |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `npx vitest run src/lib/import src/lib/data/audit.test.ts src/lib/data/users.test.ts`: 13 files, 215 passed, 0 failed |
| Runtime harness | N/A: no database in this batch by instruction. The doubles prove statement order, handle identity, chunking and rollback-by-discard only. The real transaction, the partitioned `EventoAuditoria` insert and `RETURNING` behaviour are proven only by Phase 6 / Phase 9 evidence |
| Rollback boundary | Delete `src/lib/data/audit.ts`, `audit.test.ts`, `src/lib/import/apply.ts`, `apply.test.ts`; revert the batch 2 hunk of `src/lib/data/users.ts` (`createUsuariosBulk` login mapping) and the batch 2 additions of `src/lib/data/users.test.ts`. Nothing else in the tree references these files yet (no action calls them until WU3b) |

## Ambiguity resolved

- **Final signature of `applyImport` is `(tx, plan, credentials, ctx)`**, not the 3-argument form in the task text. It needs the snapshot to resolve `GrupoWrite` natural keys for rows that already exist (`asignaturaCodigo` to id, `docenteCorreo` to id), and the actor, timestamp and file hash to build the audit events. `ctx = { snapshot, actorId, actor, at, fileSha256 }`. The 7.11 tests were written with this final shape from the start; 7.14 only added behaviour.
- **`Transaction` type** is exported from `src/lib/data/audit.ts` as `Parameters<Parameters<typeof db.transaction>[0]>[0]` (type-only import of `db`). It is assignable to `CatalogExecutor`, so `loadCatalogSnapshot(tx)` and `createUsuariosBulk(tx, ...)` accept it, while `db` is not assignable to it (the 7.9 type test).
- **Docente role id** is resolved inside `applyImport` with one `select` on `Rol` through `tx` (only when the plan creates accounts) and fails loudly if absent. `getRolIdByCodigo` uses the `db` singleton, so it cannot be used inside the transaction, and the snapshot carries no role ids.
- **Credentials shape**: `ProvisionedAccount = TemporaryCredential & { hashClave }`. The plaintext `clave` is only copied into the returned `credentials[]`; only `hashClave` reaches an insert. Returned credentials cover exactly the accounts created by this apply (not every provisioned one).
- **`runImportApply` plans twice**: a preview-time plan on `db` (read-only) decides which accounts are new so passwords are generated and hashed before the transaction; the in-transaction plan on `tx` is the one applied. If the database moved in between: a plan that now has errors throws `ImportRejectedError`; a new account with no pre-hashed credential throws (rollback); an account that appeared meanwhile is simply not created and its hash is discarded (no credential returned). `ImportRejectedError` carries the row errors.
- **Summary fields supplied here**: `actor` is the actor login (the type is `string`), `at` comes from an injectable `now()` (default `new Date()`), `fileSha256` is the `sha256` argument, `accountsCreated`/`accountsUpdated` are counted from what was actually written (`unchanged` is neither).
- **Logging is not done in `runImportApply`**. `logImportSummary` exists (7.8) and the task text for 7.15 does not list a log assertion; the action layer (WU3b) calls it after commit with the returned summary. Flagged so the one-structured-line requirement (D16) is not forgotten there.
- **Updates are one statement per row** (Asignatura, Usuario, Grupo updates). Drizzle has no bulk update; the cap `MAX_ACCOUNT_EVENTS_PER_APPLY = 2 000` bounds Usuario updates. Inserts and deactivations are chunked at `WRITE_CHUNK_ROWS`. Group creates have no `RETURNING` (nothing consumes their ids).
- Task 7.13 says a throw after the entity writes "leaves zero audit statements committed"; the `db` double commits its buffer only if the callback resolves, so this is proven against the double, not against Postgres.

## Deviations

- Hardening (post-review of batch 1): `createUsuariosBulk` now selects `{ id, login }`, maps ids back by login, and throws on an unknown returned login, an input row that gets no id, or duplicate input logins. Public contract unchanged (ids in input order). The pre-existing batch 1 tests were not changed except that the double now also returns `login`.
- Two 7.11 tests were edited in the 7.13 step (narrowed to `entityStatements(buffer)`), because the audit insert legitimately joined the same buffer. No assertion weakened.

## Verification (7.18)

- `npx vitest run src/lib/import src/lib/data/audit.test.ts src/lib/data/users.test.ts`: 13 files, 215 passed.
- `npm test`: 477 total, 472 passed, 5 failed. Failing names (the known environment-flaky set, none touch import code): `data-table-search.test.tsx` "renders a clear link to the bare action only when the value is non-empty"; `denied/page.test.tsx` "renders one h1, the explanation and a single control leading to /" and "gives the way-back control the 44px touch floor and leaves the global focus ring alone"; `users/page.test.tsx` "renders users.noResults.* and a clear control when a search has no results" and "shows the new-user button to every creator".
- `npm run typecheck`: clean.
- `npm run build`: succeeded without a database (compiled, typechecked, 10 static pages).
- `npx eslint` on `apply.ts`, `apply.test.ts`, `audit.ts`, `audit.test.ts`, `users.test.ts`: 0 problems (ran `--fix` on the new files). `users.ts`: 304 pre-existing prettier `Delete ␍` CRLF errors and nothing else.
- Credential sweep `rg "clave|password|hash" src/lib/import/summary.ts src/lib/audit` interpreted: `summary.ts:5` is a comment saying credentials cannot ride along; `audit/types.ts:19` is a comment explaining why `login`/`hashClave` are absent from `AUDITABLE_USER_FIELDS`; every `events.test.ts` hit is a test asserting absence (forbidden-key sweep, two `@ts-expect-error` pins, the "import hash" test name is the file digest). No production audit or summary code mentions a credential field. In addition `apply.test.ts` asserts the serialized audit rows match neither `clave|password|hash` nor the plaintext/hash values, and that the written rows and the `ImportSummary` never contain the plaintext password.

## Checkpoint for the user (7.19)

- Audit call is last and on the same `tx`: `applyImport` ends with `insertAuditEvents(tx, ctx.actorId, buildAuditEvents(summary, written.touched))` after `deactivateGrupos`; `insertAuditEvents` is typed on `Transaction`, so passing `db` does not compile. Proven against doubles only.
- bcrypt is outside the transaction: `runImportApply` calls `generate`/`hash` before `db.transaction`; the test records call order and asserts no `hash`/`generate` call after the transaction opens.
- No delete anywhere: no `.delete(` in `apply.ts` or `audit.ts` (asserted by a source test and a recording double that would capture one); absent groups are deactivated with `Activo = false`.
- Not proven here: the real transaction, `RETURNING` on a live table, the partitioned audit insert, and bcrypt wall-clock. Those wait for Phase 6 / Phase 9.
- Open for WU3b: call `logImportSummary` once after commit; pass `hashPassword` and `generateTemporaryPassword` as `hash`/`generate`; map `ImportRejectedError` to the preview report.

## Line count

| File | Lines |
|------|-------|
| `src/lib/data/audit.ts` | 36 |
| `src/lib/data/audit.test.ts` | 119 |
| `src/lib/import/apply.ts` | 345 |
| `src/lib/import/apply.test.ts` | 938 |
| `src/lib/data/users.test.ts` (batch 2 additions: 93 to 134) | +41 |
| `src/lib/data/users.ts` (batch 2 hunk: 56 total diff minus 28 from batch 1) | ~+28 |
| **Batch 2 total** | **~1,507** |
| Batch 1 (7.1-7.8) | ~431 |
| **WU2c cumulative** | **~1,938** |

Far over the 800-line budget and the ~625 estimate (tests are about 2.7x the implementation: 31 tests in `apply.test.ts` alone, with prettier expanding multi-line literals). Covered by the accepted `size:exception`; no test or scope was cut or padded.

## Next

Phase 8 (WU3a, forced password change) or Phase 9 / WU3b (the server action that calls `runImportApply` and the UI) per `tasks.md`. Recommended before WU3b: Phase 6 evidence so the real transaction path can be exercised.

---

# Phase 6 (Gate G-DB): pre-apply checks, 2026-10-03. Read-only only; nothing written to any database.

Target verified as the shared instance: Neon project `damp-recipe-21839554`, default branch `production` (`br-restless-hat-ayjwtjqw`), endpoint `ep-orange-math-ay4rhpc0`. The `.env` `DATABASE_URL` host is that endpoint's pooled host (`ep-orange-math-ay4rhpc0-pooler...`), host part inspected only.

## Completed

- [x] 6.1 Migration files unchanged since the rehearsal: `sha256sum` of `drizzle/0003_late_groot.sql` = `62e422f6...76f3f` and `drizzle/0004_audit_log.sql` = `d8832f7d...d720`, both equal to the hashes frozen in 2.28. No re-rehearsal needed.
- [x] 6.2 Correo duplicate query from 1.1 against `production`: zero rows. `Usuario` has 5 rows, none with a NULL `Correo`.
- [x] 6.3 `server_version_num` = `180006` (PostgreSQL 18.6), database `neondb`; endpoint kind is still the pooled host. Both match 1.2 and 2.1.

## Finding — `0003` is already applied to the shared instance

`drizzle."__drizzle_migrations"` on `production` holds 4 rows. Row 4 has hash `e49886a2...c082` and `created_at` `1789957305259`, which equal the sha256 of the committed (LF) content of `drizzle/0003_late_groot.sql` and its `when` in `drizzle/meta/_journal.json`. The schema agrees: `Asignatura`, `Grupo` and `Inscripcion` exist (0 rows each), `Usuario` has `DebeCambiarClave` (NOT NULL) and `Usuario_Correo_unique`. `"EventoAuditoria"` does not exist (`to_regclass` is NULL), so `0004` is the only pending migration.

This contradicts the plan recorded in tasks 1.13 and 6.4, which assumed both `0003` and `0004` were still unapplied on the shared instance. When and by whom `0003` was applied is not recorded here; the migrations table stores the journal timestamp, not the apply time.

Consequences for the remaining Phase 6 steps:

- 6.4 will apply `0004` only, not `0003` and `0004` in one transaction as its wording says.
- 6.5 should verify `0004` objects (parent table, six partitions, triggers, empty default partition) and that the 5 existing `Usuario` rows survived.
- The Neon branch `rehearsal-audit` used for 2.19-2.29 no longer exists in the project (branches present: `production`, `backup-before-0002-roles`, `rehearsal-0002-roles`, `abort-rehearsal-0002`). Task 9.26 needs a fresh rehearsal branch.
- The working-tree copies of `0000`-`0003` are CRLF and hash differently from the LF content recorded in the migrations table; `0004` is LF in both. Recorded as an observation, not acted on.

## Next

6.4 (`npm run db:migrate` against the shared instance) waits for the user's explicit "yes" for that exact command.

## Backup branch before the shared apply (user-confirmed, 2026-10-04 01:46 UTC)

Created Neon branch `backup-before-0004-audit` (`br-still-feather-ay7d87p7`) from `production` (`br-restless-hat-ayjwtjqw`) at parent LSN `0/2022840`, without a compute endpoint. It holds the pre-`0004` state of the shared instance (migrations `0000`-`0003`, 5 `Usuario` rows). Not a task in `tasks.md`; added on the user's request, mirroring `backup-before-0002-roles`.

## Shared-instance apply (6.4) and post-apply verification (6.5), 2026-10-04 UTC

- [x] 6.4 `npm run db:migrate` against the shared instance (`production`, via the pooled host in `.env`), run after the user's explicit "yes" for that exact command. Exit 0, `migrations applied successfully!`. Only notices emitted: `schema "drizzle" already exists` and `relation "__drizzle_migrations" already exists`. As recorded above, only `0004_audit_log` was pending, so the task's "wrapped `0003` and `0004` in one transaction" wording did not apply; `0003` was already in place.
- [x] 6.5 Post-apply verification (read-only, Neon `run_sql` on `production`):
  - `drizzle."__drizzle_migrations"` now has 5 rows; the last is hash `d8832f7d...d720` at `1789963712521`, equal to `drizzle/0004_audit_log.sql` and its journal `when`.
  - `"EventoAuditoria"` exists with `relkind = 'p'` (partitioned) and six partitions: `EventoAuditoria_2026` through `EventoAuditoria_2030` with yearly bounds at `00:00:00+00`, plus `EventoAuditoria_default` (DEFAULT).
  - `SELECT count(*)` is 0 on `"EventoAuditoria"` and on `"EventoAuditoria_default"`.
  - Triggers: 14, all enabled. `TR_EventoAuditoria_inmutable` (BEFORE DELETE OR UPDATE, FOR EACH ROW) on the parent and cloned onto all six partitions; a BEFORE TRUNCATE statement trigger on the parent (`TR_EventoAuditoria_truncate`) and one per partition (`TR_EventoAuditoria_<partition>_truncate`). This matches the set asserted by `src/db/migration-0004.test.ts` (one row trigger declared on the parent, a truncate trigger on the parent and on every partition).
  - `Asignatura`, `Grupo` and `Inscripcion` exist; `Usuario` still has 5 rows.
  - Not checked here: the `REVOKE UPDATE, DELETE, TRUNCATE` grants, and the append-only behaviour by attempting a write (that would be a write probe; it was exercised in the 2.19-2.26 rehearsal).
- [ ] 6.6 (optional `db:seed`) not run; skipped by default.

Rollback reference: Neon branch `backup-before-0004-audit` (`br-still-feather-ay7d87p7`) holds the pre-`0004` state. Any correction to `0004` goes through a compensating migration, never an edit to the applied file.

---

# Phase 8 (WU3a) batch 1: tasks 8.1-8.10 (session flag, DAL enforcement, login payload, `changePasswordSchema`, `updateClaveAndClearFlag`). Branch kept on `feat/catalog-excel-import-wu1b`. Nothing committed; no database access of any kind (the data test uses a hand-rolled `db.update` double).

Next.js docs read: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md` (redirect throws; call it outside `try`). The login action only gained one payload field, so cookies and redirect usage are unchanged.

## Completed

- [x] 8.1/8.2 `session.ts` + test. RED: 4 failed, 7 passed; the failures are the non-boolean cases (`"yes"`, `1`, `"true"`, `null`) which the old validator accepted. The no-flag and `true`/`false` round-trip cases already passed on RED (the payload is spread into the JWT, so the flag always survived signing); the test pins them anyway. GREEN: 11/11. `isSessionPayload` accepts `undefined | boolean` (D14).
- [x] 8.3/8.4 `routes.ts`, `dal.ts` + `dal.test.ts`. RED: 9 failed of 19 (`PASSWORD_CHANGE_PATH` and `requireUserAllowingPasswordChange` absent, so flagged cases did not redirect). GREEN: 19/19. `requireUser` redirects `debeCambiarClave === true` to `PASSWORD_CHANGE_PATH` after the anonymous check and before returning; `requireRole` inherits it, so the flag beats the role check (table over all five roles asserts exactly one redirect and never `/denied`). `requireUserAllowingPasswordChange` only checks for a session. `rg requireUserAllowingPasswordChange src` shows only `dal.ts` and `dal.test.ts` (callers arrive with 8.12/8.14).
- [x] 8.5/8.6 `login/actions.ts` + new `login/actions.test.ts`. RED: 2 failed, 1 passed (signSession payload lacked the flag; the no-guard test passes by construction). GREEN: 3/3. Payload now carries `debeCambiarClave: user.debeCambiarClave` from the 1.10 projection (confirmed in `usuarioConRolColumns`).
- [x] 8.7/8.8 `validations/auth.ts` + test. RED: 5 failed (`changePasswordSchema` not exported). GREEN: 10/10. Current password required; new password 8 to 128 (same as registration); confirmation mismatch -> issue on `confirmPassword`; new equals current -> issue on `newPassword`.
- [x] 8.9/8.10 `updateClaveAndClearFlag(id, hashClave)` in `users.ts` + test appended to `users.test.ts`. RED: 1 failed (not a function). GREEN: 10/10. One `db.update(usuario).set({ hashClave, debeCambiarClave: false }).where(eq(usuario.id, id))`; the test renders the WHERE through `PgDialect` and asserts `"Usuario"."Id" = $1` with params `[42]`.

## TDD Cycle Evidence (batch 1)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 8.1/8.2 | 4 failed / 11 | 11/11 | none |
| 8.3/8.4 | 9 failed / 19 | 19/19 | none |
| 8.5/8.6 | 2 failed / 3 | 3/3 | none |
| 8.7/8.8 | 5 failed / 10 | 10/10 | none |
| 8.9/8.10 | 1 failed / 10 | 10/10 | none |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/lib/auth src/lib/validations src/lib/data "src/app/(auth)"`: 12 files, 136 passed |
| Runtime harness | N/A for this batch: no runtime boundary is exercised without the page and action (8.11-8.14) and a database; manual harness is 8.20 |
| Rollback boundary | Revert `session.ts`, `dal.ts`, `routes.ts`, `login/actions.ts`, `validations/auth.ts` hunks, the appended `updateClaveAndClearFlag` block in `users.ts`, and their tests; `login/actions.test.ts` is a new file. No unrelated work is touched |

## Ambiguity resolved

- "Same strength rule as registration": registration (`registroEstudianteSchema`) is `min(8)`/`max(128)` with no composition rule, and it lives in `validations/users.ts`, which imports from `auth.ts`. To avoid a circular import the rule is repeated inline in `changePasswordSchema` (same limits and Spanish message) instead of extracting a shared constant, and `loginSchema` is not touched.
- Messages in the schema are Spanish literals, matching the existing schemas; i18n copy is 8.15/8.16.
- The `requireRole` flagged-before-role order needed no `requireRole` edit: it already calls `requireUser` first.
- `users.test.ts` keeps its existing `vi.mock("@/db", () => ({ db: {} }))`; the new test assigns `db.update` on that object rather than altering the mock.

## Deviations

None from design.md.

## Verification

`npm test`: 504 total, 499 passed, 5 failed, all in the known flaky set (`denied/page.test.tsx` "renders one h1, the explanation and a single control leading to /" and "gives the way-back control the 44px touch floor..."; `data-table-search.test.tsx` "renders a clear link..."; `users/page.test.tsx` "renders users.noResults.* and a clear control..." and "shows the new-user button to every creator"). No existing test needed changing for the new `requireUser` contract (existing guarded-page tests mock the DAL). `npm run typecheck`: clean. `npx eslint` on touched files: only the pre-existing CRLF `Delete ␍` noise remains on CRLF files; `--fix` applied to the new `actions.test.ts` (LF); two real prettier findings in `dal.test.ts` fixed by hand. `npm run build` not run (8.19).

Existing tests extended (not weakened): `dal.test.ts` (`sessionFor` takes an optional flag; imports extended), `session.test.ts`, `validations/auth.test.ts`, `users.test.ts` (appended).

## Line count (WU3a batch 1, authored lines only)

| File | Added |
|------|-------|
| `src/lib/auth/session.ts` | +8 / -1 |
| `src/lib/auth/session.test.ts` | +29 |
| `src/lib/auth/routes.ts` | +6 |
| `src/lib/auth/dal.ts` | +14 / -1 |
| `src/lib/auth/dal.test.ts` | +88 / -5 |
| `src/app/(auth)/login/actions.ts` | +1 |
| `src/app/(auth)/login/actions.test.ts` (new) | 101 |
| `src/lib/validations/auth.ts` | +30 |
| `src/lib/validations/auth.test.ts` | +55 / -1 |
| `src/lib/data/users.ts` (WU3a hunk only) | +15 |
| `src/lib/data/users.test.ts` (WU3a hunk only) | +30 |
| **Batch total** | **+377 / -8 (385 changed)** |

Against the 800-line WU3a budget (estimate ~560): 385 used for 10 of 20 tasks. Remaining 8.11-8.20 (action + test, page and form, i18n and parity test, structural pin) has ~415 lines of room. No `size:exception` granted for WU3a.

## Next

8.11 (RED `src/app/change-password/actions.test.ts`) onward.

# Phase 8 (WU3a) batch 2: tasks 8.11-8.20 (change-password action, page, form, i18n, parity test, logout pin, call-site pin, verification, checkpoint). Branch kept on `feat/catalog-excel-import-wu1b`. Nothing committed; no database access of any kind (every data call is a mock).

Next.js docs read: `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` (Server Functions are directly POSTable, so the guard goes inside the action; forms and `useActionState`), `.../04-functions/redirect.md` (redirect throws; call it outside `try`; in a Server Action it navigates client-side), `.../04-functions/cookies.md` (`cookies().set` is valid in a Server Function, and the updated UI comes back in the same roundtrip). The repo uses `middleware.ts`; it lets any signed-in session through to `/change-password` and sends an anonymous one to `/login`, so it needed no change.

## Completed

- [x] 8.11/8.12 `src/app/change-password/actions.ts` + `actions.test.ts`. RED: suite failed to load (`Failed to resolve import "@/app/change-password/actions"`; 0 tests ran, the module did not exist). GREEN: 22/22 on the first run. The flow is: `requireUserAllowingPasswordChange()` first (ordered before `getTranslations` and the user lookup, asserted by call order; `requireUser`/`requireRole` never called; a source check forbids the words), schema parse, lookup of the session's own account, `verifyPassword(current, storedHash)`, `hashPassword(new)` (the project helper), `updateClaveAndClearFlag(id, hash)`, then a **re-signed session with `debeCambiarClave: false`** set via `setSessionCookie`, then `redirect("/")`. The success test asserts update < sign < setCookie < redirect by invocation order, and that the token is signed from exactly `{ sub, login, rol, nombre, debeCambiarClave: false }` (the session's `iat`/`exp` are not carried over). Failure paths (wrong current, weak, mismatch, equals-current, empty current, missing fields, user missing, inactive, id mismatch, data update throws) each assert no update, no signing, no cookie, no redirect. No-leak tests: action state never contains a password or hash; `console.*` is never called, including when the thrown error embeds the stored hash.
- [x] 8.13/8.14 `page.tsx`, `change-password-form.tsx` (+ `layout.tsx`, see Deviations) and `page.test.tsx`, `change-password-form.test.tsx`. RED: both suites failed to load (modules absent). After writing the components but before the catalogs existed: 12 failed / 38 in `src/app/change-password` (every test that needs real copy failed; the structural and guard tests passed). GREEN after 8.16: 38/38 (22 action + 8 page + 8 form). The page asserts: a flagged user of each of the five roles renders the form with no redirect; non-flagged and legacy (no flag) sessions render the voluntary variant; anonymous goes to `/login` through the guard; only the sibling guard is called; a sign-out control exists in its own form; a `readFileSync` check requires the import of `requireUserAllowingPasswordChange` and forbids `requireUser`, `requireRole` and `redirect` in `page.tsx`. The form asserts: three password fields with the right names, `type=password`, `required` and `autocomplete`; three `PasswordInput` toggles; forced vs voluntary subtitle; no alert before submit; the action-state error is rendered in `role="alert"` and the submitted FormData carries the three fields. Both locales are rendered with the real catalogs.
- [x] 8.15/8.16 `src/i18n/catalog-parity.test.ts` (new) + `changePassword.*` in `i18n/es.json` and `i18n/en.json` (inserted after `denied`, CRLF preserved). RED: 3 failed / 4 (section absent in both catalogs; the pure key-equality test passes vacuously while both are empty, which is why an explicit "exists" test and an exact required-key list were added). GREEN: 4/4, and the 8.13 suites pass. Keys: `title, subtitle, subtitleForced, currentPasswordLabel, newPasswordLabel, newPasswordHint, confirmPasswordLabel, submit, submitting, errors.{invalid, wrongCurrent, weak, mismatch, sameAsCurrent, unexpected}`. The test keeps a `GUARDED_SECTIONS` list for WU3b to extend.
- [x] 8.17 Characterization pin in `login/actions.test.ts`: `logoutAction` with all three guards rigged to throw clears the cookie, redirects to `/login`, calls no guard; and a logout followed by a login of a flagged account signs `debeCambiarClave: true` again. **Expected to pass immediately and did (5/5 in the file: 3 from batch 1 + 2 new); no RED was manufactured.**
- [x] 8.18 Structural pin, recorded below.
- [x] 8.19 Verification, results below.
- [x] 8.20 Checkpoint written below. **The manual run is pending; nothing was executed against the database.**

## TDD Cycle Evidence (batch 2)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 8.11/8.12 | suite did not load (module absent), 0 ran | 22/22 | prettier only (`eslint --fix` on created files) |
| 8.13/8.14 | suites did not load; later 12 failed / 38 with components but no copy | 38/38 (after 8.16) | prettier only |
| 8.15/8.16 | 3 failed / 4 | 4/4 | none |
| 8.17 | n/a, characterization pin | 5/5 in file, passes immediately | none |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/lib/auth src/app/change-password "src/app/(auth)" src/i18n`: 8 files, 122 passed, 0 failed |
| Runtime harness | Not run: needs Phase 6 applied and a flagged account (a database write). Exact steps and unexecuted SQL under "8.20 checkpoint". `npm run build` compiled `/change-password` as a dynamic route without a database |
| Rollback boundary | Delete `src/app/change-password/` (7 files incl. tests), delete `src/i18n/catalog-parity.test.ts`, remove the `changePassword` block from `i18n/es.json` and `i18n/en.json`, remove the `logoutAction` describe and the extra imports in `login/actions.test.ts`. Batch 1 and WU2c are untouched |

## 8.18 call-site list (`rg "requireUser|requireRole" "src/app/(dashboard)" src/app/api`, non-test)

`src/app/api` does not exist yet (the template route arrives in 9.5; it must call `requireRole`, which inherits the flag redirect).

| Site | Guard | Covered by the 8.3 redirect table |
|---|---|---|
| `src/app/(dashboard)/layout.tsx:13` | `requireUser()` | yes, every dashboard page (including `(dashboard)/page.tsx`, which has no guard of its own) inherits it |
| `src/app/(dashboard)/profile/page.tsx:30` | `requireUser()` | yes |
| `src/app/(dashboard)/users/page.tsx:69` | `requireRole(...rolesQueCreanUsuarios)` | yes, flag beats role |
| `src/app/(dashboard)/users/new/page.tsx:22` | `requireRole(...rolesQueCreanUsuarios)` | yes |
| `src/app/(dashboard)/users/new/actions.ts:23` | `requireRole(...rolesQueCreanUsuarios)` | yes, action blocked before any effect |

Only callers of `requireUserAllowingPasswordChange` outside `dal.ts`: `src/app/change-password/page.tsx` and `actions.ts`. Existing tests for the guarded pages and actions mock the DAL, so none needed changes.

## 8.20 checkpoint for the user (NOT executed)

Prerequisite: Phase 6 (Gate G-DB) applied, i.e. migration 0003 with `Usuario.DebeCambiarClave` present on the target database. Use a throwaway test account whose password you know.

1. Flag one account (a database write; confirm before running; replace `<test-login>` with the account's `Login`). NOT EXECUTED:
   ```sql
   UPDATE "Usuario" SET "DebeCambiarClave" = true WHERE "Login" = '<test-login>';
   ```
   Revert (same confirmation). NOT EXECUTED:
   ```sql
   UPDATE "Usuario" SET "DebeCambiarClave" = false WHERE "Login" = '<test-login>';
   ```
   Note: a successful change in step 3 also clears the flag and replaces the password hash, so after the run use a throwaway account or restore its previous hash.
2. Start the app yourself and sign in as that account: expected redirect to `/change-password` (also try `/`, `/profile`, `/users`: all bounce there; the sign-out button works).
3. Submit a wrong current password (form error, nothing changes), a weak or mismatched new one (error), the same password as current (error), then a valid change: expected landing on the dashboard.
4. Reload and open `/profile`: stays on the dashboard (the cookie was re-issued with the flag false). Sign out and sign in with the new password; the old one must fail.

## Verification (8.19)

- Focused: `npx vitest run src/lib/auth src/app/change-password "src/app/(auth)" src/i18n`: 8 files, 122 passed.
- `npm test`: 548 total, 543 passed, 5 failed. The 5 are exactly the known environment-flaky set: `denied/page.test.tsx` "renders one h1, the explanation and a single control leading to /" and "gives the way-back control the 44px touch floor and leaves the global focus ring alone"; `data-table-search.test.tsx` "renders a clear link to the bare action only when the value is non-empty"; `users/page.test.tsx` "renders users.noResults.* and a clear control when a search has no results" and "shows the new-user button to every creator". No failure outside that set.
- `npm run typecheck`: clean.
- `npm run build`: succeeded (Next.js 16.3.4, Turbopack); routes include `/change-password` as a dynamic route; no database connection attempted.
- `npx eslint` on the created files and `login/actions.test.ts`: exit 0, no findings (`--fix` was applied to the files I created, which only reformatted them; `login/actions.test.ts` is also a batch 1 creation and is LF).

## Ambiguity resolved

- **Session refresh requirement**: no conflict. The spec ("Flag travels in the session", scenario "Session refreshed after change") and design D14 ("After a successful change the action re-signs and re-sets the cookie") already require it. Implemented and covered by RED tests in 8.11 as the batch 1 review asked.
- **"Stored hash for the session's own user id"**: no lookup by id exists in the data layer, and adding one was outside the batch. The action looks the account up with `getUsuarioByLogin(session.login)` (the login comes from the signed session, never the form) and requires `account.id === Number(session.sub)`; the write uses that id. Mismatch, missing or inactive account return a generic `errors.unexpected` with no write. An inactive account is refused because login refuses it too; the task text did not say.
- **Data-update failure**: the action returns `errors.unexpected` and does not log (driver errors can embed the bound hash) instead of letting the error propagate; the cookie stays untouched either way.
- **Error mapping**: the first schema issue maps by path to a catalog message (`confirmPassword` -> mismatch, `newPassword` custom -> sameAsCurrent, other `newPassword` -> weak, else invalid), so the Spanish literals in the schema are never shown.
- **Sign-out on the screen**: a flagged user must be able to sign out from this screen (spec), and the screen has no dashboard header. The page renders a separate `<form action={logoutAction}>` (nested forms are invalid) reusing the existing `auth.userMenu.logout` copy rather than a duplicate key.
- **Voluntary vs forced copy**: the page passes `forced = session.debeCambiarClave === true` to the form, which swaps only the subtitle; the spec allows a non-flagged user to open the screen, and telling them they use a temporary password would be false.
- **Task 8.14 verify wording**: the form and page tests use the real catalogs, so they can only pass after 8.16; the GREEN number for 8.13/8.14 is recorded after the catalogs landed, as 8.16's own verify line says.

## Deviations

- Added `src/app/change-password/layout.tsx` (4 lines, re-exports the `(auth)` layout), not listed in design.md's file table. Without it the screen, being outside `(auth)` and `(dashboard)`, would render unstyled outside the app's two-panel shell. It reuses the shell instead of duplicating it; no new tokens or colours. It carries no guard and does not affect the no-loop proof (the page still owns the guard).
- Test line counts are well above the ~560 forecast; the user accepted `size:exception` for WU3a.

## Line count (WU3a batch 2, authored lines, as written after prettier)

| File | Added |
|------|-------|
| `src/app/change-password/actions.ts` (new) | 85 |
| `src/app/change-password/actions.test.ts` (new) | 388 |
| `src/app/change-password/page.tsx` (new) | 38 |
| `src/app/change-password/page.test.tsx` (new) | 177 |
| `src/app/change-password/change-password-form.tsx` (new) | 104 |
| `src/app/change-password/change-password-form.test.tsx` (new) | 146 |
| `src/app/change-password/layout.tsx` (new) | 4 |
| `src/i18n/catalog-parity.test.ts` (new) | 98 |
| `i18n/es.json`, `i18n/en.json` | +19 each (38) |
| `src/app/(auth)/login/actions.test.ts` (8.17 hunk) | +45 |
| **Batch total** | **1123** |

Cumulative WU3a: 385 (batch 1) + 1123 = **1508 changed lines**, against the 800 budget; covered by the user's `size:exception` for WU3a (roughly three quarters of it is tests).

## Next

WU3a is complete pending the user's manual harness (8.20). Recommended: `sdd-verify` for Phase 8, then the user commits by hand. WU3b (Phase 9) follows: the template route must call `requireRole` (8.18), and it extends `GUARDED_SECTIONS` in `catalog-parity.test.ts` with `catalog.import` and `nav.catalog`.

# Phase 9 (WU3b) batch 1: tasks 9.1-9.10 (server side: `canImportCatalog`, template builder and route, `previewAction`, `applyAction`). Branch kept on `feat/catalog-excel-import-wu1b`. Nothing committed; no database access of any kind (the DAL, the snapshot read, `runImportApply` and `@/db` are mocks; `npm run build` ran without a connection).

Next.js docs read: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (Route Handler signature, `Response`, headers), `.../01-app/01-getting-started/15-route-handlers.md` (a `GET` handler is not cached unless opted in, and ours reads the session, so it is dynamic; confirmed by the build listing `/api/catalog/template` as dynamic), `.../04-functions/redirect.md` (usable in Route Handlers and Server Functions, throws, must stay outside `try`), `.../01-app/02-guides/server-actions.md` (an action is a directly POSTable endpoint, so authenticate and authorize inside it; return values are serialized to the client; 1 MB default body limit, raised in 9.19/9.20 in batch 2).

## Completed

- [x] 9.1/9.2 `canImportCatalog(rol) = canAssignRole(rol, "docente")` in `permissions.ts`. RED: 7 failed / 52 (`canImportCatalog is not a function`). GREEN: 52/52. Tests: `secretaria` true; `administrador`, `coordinacion`, `docente`, `estudiante`, `undefined` false; a derivation test over `rolesUsuario` asserting equality with `canAssignRole(rol, "docente")`.
- [x] 9.3/9.4 `src/lib/import/template.ts` + `template.test.ts`. RED: suite failed to load (`Cannot find module './template'`, 0 ran). GREEN: 5/5. The builder is split in two so the test never imports the library: `buildTemplateWorkbook()` (sheets and header row from `SHEETS`, bold header) and `buildTemplate()` (bytes). Tests: sheet order equals `SHEETS` and the literal three names; row 1 equals required then optional headers for every sheet, plus two pinned literals (all-required `Asignaturas`; required + optional `Docentes`); one row only and no `Id` column; bytes start with `PK`; the bytes re-parse through the real `parseWorkbook` to `ok` with three sheets of zero rows.
- [x] 9.5/9.6 `src/app/api/catalog/template/route.ts` + `route.test.ts`. RED: suite failed to load (module absent). GREEN: 9/9. The REAL `dal.ts` runs over a mocked `getSession`, so the flag redirect, the role check and the predicate are the production ones. Tests: `secretaria` gets 200, xlsx content type, `attachment; filename="PlantillaCatalogo.xlsx"` and bytes that parse as the template; `Cache-Control: private, no-store`; `administrador`, `coordinacion`, `docente`, `estudiante` redirect to `/denied` with `buildTemplate` never called (spy wraps the real builder); anonymous redirects to `/login`, flagged `secretaria` to `PASSWORD_CHANGE_PATH`, both with no bytes built; a `secretaria` with the flag explicitly false is served.
- [x] 9.7/9.8 `previewAction` in `src/app/(dashboard)/catalog/import/actions.ts` + `actions.test.ts`. RED: suite failed to load (module absent). GREEN: after writing `previewAction` only, 34 passed and 28 failed, every failure being `applyAction is not a function` (the 9.9 tests, still RED by design).
- [x] 9.9/9.10 `applyAction`. RED: the 28 failures above. GREEN: 62/62.
- Mutation checks (temporary, reverted, file diffed against a backup): removing the hash comparison made 3 tests fail; removing the `canImportCatalog` line made 10 fail.

## TDD Cycle Evidence (batch 1)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 9.1/9.2 | 7 failed / 52 | 52/52 | none |
| 9.3/9.4 | suite did not load, 0 ran | 5/5 | split builder into workbook + bytes so the test needs no library import |
| 9.5/9.6 | suite did not load, 0 ran | 9/9 | none |
| 9.7/9.8 | suite did not load | 34 passed, 28 failed (all `applyAction`) | `eslint --fix` (prettier) on created files only |
| 9.9/9.10 | 28 failed (`applyAction is not a function`) | 62/62 | none |

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/app/api "src/app/(dashboard)/catalog" src/lib/import src/lib/auth`: 17 files, 357 passed, 0 failed |
| Runtime harness | Not run: the real transaction path is only exercised by the user's manual smoke (9.25/9.26, batch 2). The template bytes ARE exercised for real (real exceljs, real `parseWorkbook`) |
| Rollback boundary | Delete `src/lib/import/template.ts` + test, `src/app/api/catalog/template/` (2 files), `src/app/(dashboard)/catalog/import/actions.ts` + test; remove `canImportCatalog` and its describe from `permissions.ts` / `permissions.test.ts`; remove the `catalog` block from `i18n/es.json` and `i18n/en.json`. No batch 8/7 file is touched |

## Carried requirements: where each is covered (`actions.test.ts` unless noted)

1. Summary log (D16): "logs the summary exactly once, after the apply resolved" (call order and the single `console.info` line equal to `{ event, ...summary }`); "never logs on rejection or on a thrown apply"; "still returns the credentials when the log line cannot be written"; "passes no credential, password or hash to any console method".
2. Guard order: `describe.each` over both actions: four denied roles and anonymous never call `FormData.get`, the parser, the snapshot read or `runImportApply`; "runs requireRole, then canImportCatalog, then the first formData.get" (call-order array); "takes the actor from the session, never from the form" (spoofed `actor`, `actorId`, `login` fields; actor is `{ id: 7, login: "caller" }`). Route: `route.test.ts` denied-role, anonymous and flagged cases.
3. Hash never trusted: "re-previews and applies nothing for a different hidden hash" and "...for no hidden hash"; "validates and plans file B on its own when the hidden hash is file A's".
4. Credentials never persist: the applied state is asserted equal to `{ kind, summary, credentials }`; every error and re-preview state has no `credentials` key; no console method receives the password (all five methods, success and failure paths); preview JSON contains no `clave|password|credential|hash`; a source pin forbids `next/headers`, `cookies`, `node:fs`, `fs/promises`, `localStorage`, `sessionStorage` and any line-start `let`/`var` (module-level state) in `actions.ts`.
5. Containment: see the `rg` result below.
6. Guards before parsing: `describe.each` "rejects ... before parsing" asserts the parser spy (wrapping the real `parseWorkbook`) was never called for no file, empty, `.xls`, `.csv`, plain text named `.xlsx` and a 5 MiB + 1 file; parse failures assert the planner was not called.

## Ambiguity resolved

- **Guard roles for `requireRole`**: the design leaves the argument list as `...`. Used `requireRole(...rolesUsuario)` (any authenticated role) so `canImportCatalog` is the only authority on who may import; passing `rolesQueCreanUsuarios` would have made a second, implicit role list. Same in the route. Observable result is identical (denied roles reach `/denied`).
- **Error messages**: `PreviewState` carries `message: string`, so the action translates with `getTranslations("catalog.import")` (the `users/new` pattern) and the test mock returns the key (plus the interpolation values as JSON for `sheetMissing`/`columnMissing`). Added `catalog.import.errors.{noFile, wrongExtension, invalidWorkbook, tooLarge, tooManyRows, sheetMissing, columnMissing, applyFailed}` to BOTH catalogs, neutral Spanish with accents; the guard reason `notAZip` and the parser reason `workbook.invalid` share `invalidWorkbook` ("not a valid workbook" in the spec table). Batch 2 (9.21/9.22) adds the rest of `catalog.import.*` and `nav.catalog` around these keys and extends the parity test; a test here already asserts these eight exist in both locales.
- **Planner caps**: `accountsToCreate.capExceeded` and `accountEvents.capExceeded` are plan errors, so they come back as a `preview` with errors (confirmation blocked), not as `{ kind: "error" }` and not as a timeout. Pinned with a stubbed plan because building a 250+ docente workbook would need the library in the test.
- **Apply rejected by the in-transaction plan** (`ImportRejectedError`): the action returns a fresh preview (re-planned against a new snapshot) so the user sees counts and errors, with no credentials. Any other throw returns `{ kind: "error", message: errors.applyFailed }` and is deliberately NOT logged (driver errors can embed bound hashes).
- **Hash comparison**: the digest the action compares is the one `parseWorkbook` computes from the received bytes (its `fileSha256`), not the client's field. That is the "recomputed sha256 of the uploaded bytes"; no second hashing helper was added.
- **Stale preview**: `applyAction` passes `runImportApply` the parsed workbook and never a plan, and keeps no state, so a database change between preview and confirm is re-planned inside `runImportApply` (that function is mocked here; its re-plan is proven by the WU2c `apply.test.ts`). At action level the test shows two previews over different snapshots give different counts (nothing cached) and that the apply input has exactly `db, parsed, sha256, actor, hash, generate`.
- **Log-sink failure**: the summary log is wrapped in a `try/catch` that swallows, because the transaction is already committed and the credentials exist only in the return value; a throwing logger must not cost the caller their one delivery. Covered by a test.
- **Actor id**: `Number(session.sub)`, as `change-password/actions.ts` already does.

## Deviations

- `design.md` lists `PreviewState`'s preview arm as `counts, errors, fileSha256`; it also carries `accountsToCreate` (the D5 cost visibility the dry-run spec and 9.13 require). Additive.
- `src/lib/import/__fixtures__/build-fixtures.mjs` (pre-existing one-off script, not app code) still matches the `rg` for the library; see below.
- Test line counts exceed the WU3b estimate for the whole unit; see the line count and the budget flag.

## Verification

- `npx vitest run src/app/api "src/app/(dashboard)/catalog" src/lib/import src/lib/auth`: 17 files, 357 passed.
- `npm test`: 631 total, 626 passed, 5 failed. The 5 are exactly the known environment-flaky set: `denied/page.test.tsx` "renders one h1, the explanation and a single control leading to /" and "gives the way-back control the 44px touch floor and leaves the global focus ring alone"; `data-table-search.test.tsx` "renders a clear link to the bare action only when the value is non-empty"; `users/page.test.tsx` "renders users.noResults.* and a clear control when a search has no results" and "shows the new-user button to every creator".
- `npm run typecheck`: clean (one fix during the batch: `new File([new Uint8Array(bytes)])` in the test, a `Uint8Array<ArrayBufferLike>` vs `BlobPart` error).
- `npm run build`: succeeded (Next.js 16.3.4, Turbopack); `/api/catalog/template` is listed as dynamic; no database connection attempted. The actions file is not yet reachable from a page, so the build does not compile it; typecheck and the tests do.
- `npx eslint` on the created files (after `--fix`, which only reformatted them): no findings. `permissions.ts` / `permissions.test.ts` show only the pre-existing `Delete ␍` noise (their working copy is CRLF); no other finding.
- `rg "exceljs|read-excel-file|write-excel-file" src`: code imports are only `src/lib/import/parse.ts` and `src/lib/import/template.ts` (`from "exceljs"`), plus the pre-existing one-off script `__fixtures__/build-fixtures.mjs` (not part of the app or its build) and comments in tests/guards. No `read-excel-file` or `write-excel-file` anywhere.

## Line count (WU3b batch 1, authored lines, as written after prettier)

| File | Added |
|------|-------|
| `src/lib/auth/permissions.ts` | 8 |
| `src/lib/auth/permissions.test.ts` | 23 |
| `src/lib/import/template.ts` (new) | 23 |
| `src/lib/import/template.test.ts` (new) | 79 |
| `src/app/api/catalog/template/route.ts` (new) | 27 |
| `src/app/api/catalog/template/route.test.ts` (new) | 120 |
| `src/app/(dashboard)/catalog/import/actions.ts` (new) | 186 |
| `src/app/(dashboard)/catalog/import/actions.test.ts` (new) | 643 |
| `i18n/es.json`, `i18n/en.json` | +14 each (28) |
| **Batch total** | **1137** |

This is batch 1 of 2 and already exceeds the 800-line review budget for the whole WU3b unit (estimate ~660 for both batches). No `size:exception` has been granted for WU3b; the user must decide before batch 2 adds the components, page, sidebar, config and copy. Roughly 860 of the 1137 lines are tests.

## Next

9.11 (RED `credentials-download.test.tsx`) onward: client components, page with `maxDuration`, sidebar, `next.config.ts` `bodySizeLimit`, the remaining `catalog.import.*` / `nav.catalog` copy and the parity test extension (the `GUARDED_SECTIONS` list in `catalog-parity.test.ts`), then the 9.24 verification. Needs the user's decision on the line budget first.


# Phase 9 (WU3b) batch 2: tasks 9.11-9.24 (client components, page, sidebar, config, copy, verification) plus one post-review change to 9.9/9.10. Branch kept on `feat/catalog-excel-import-wu1b`. Nothing committed; no database access of any kind (`npm run build` ran with no connection; every action is a mock in the component tests). `size:exception` for WU3b in a single PR is accepted by the user.

Next.js docs read before writing: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md` (a page-level export covers every Server Action the page uses), `.../05-config/01-next-config-js/serverActions.md` (`bodySizeLimit` takes a byte count and counts the raw multipart body), plus the batch 1 guides for Server Actions and `redirect`. React 19 form-action behaviour was checked empirically in the test environment (see finding 1).

## Post-review change to 9.9/9.10 (applied first, RED test first)

A non-`ImportRejectedError` failure of `runImportApply` used to return `errors.applyFailed` and log nothing. It now also emits ONE sanitized line, `catalog.import.failed`, through the new `logImportFailure` in `src/lib/import/summary.ts` (injectable logger, default `console.error`, next to `logImportSummary`). The line carries `event`, `actor` (the session login), `fileSha256`, `errorName` and, when it is a string, `errorCode`. It never carries the message, stack, cause, detail, query or parameters.

- RED `summary.test.ts`: 6 failed / 11 (`logImportFailure is not a function`). GREEN: 11/11.
- RED `actions.test.ts`: 2 failed / 66 (the line was absent; the "emits nothing" and "sink fails" guards pass before the change by construction). GREEN: 66/66.
- Tests: one single-line event with the exact key set; SQLSTATE `code` surfaced; code ignored when not a string; a non-`Error` throw named by `typeof` with its content absent; an error whose message, cause, detail, query and params hold a bcrypt-looking hash and a plaintext password yields a line containing neither (and no `$2b$`); emitted exactly once on a failed apply; not emitted for `ImportRejectedError` or on success; a throwing log sink does not change the returned state (the call is wrapped in `try/catch`, like `logImportSummary`, which is untouched).
- Ambiguity resolved: Drizzle wraps driver failures in `DrizzleQueryError`, which has no `code`; the SQLSTATE sits on `error.cause.code`. The helper reads `code` from the error and, failing that, from `cause`, and nothing else from `cause`. Without this the SQLSTATE would never appear for a real database failure. Covered by a test where the wrapper message holds a hash and the cause holds the code.
- One existing test renamed, assertions unchanged: "returns an error without credentials or a log when the apply throws" is now "...or a summary log...", because a failure line is now expected on `console.error`.

## Completed

- [x] 9.11/9.12 `credentials-download.tsx` + test. RED: suite failed to load (module absent). GREEN: 9/9 on the first run. The Blob is built from `buildCredentialsCsv`, typed `text/csv;charset=utf-8`; the test reads the bytes and asserts `EF BB BF` first and that the decoded text equals the builder output. The object URL is assigned to the anchor through a ref in `useEffect` (not through state), so each effect run owns exactly one URL: a StrictMode test shows two creations, one revocation, the link on the live URL, and a last revocation on unmount. Tests also pin: no `fetch`, no `Storage.setItem`, cookie unchanged, no hidden input, the password never rendered into the DOM, and an empty list renders nothing and creates no URL (a remount shows nothing).
- [x] 9.13/9.14 `import-form.tsx`, `import-preview.tsx` + two test files, against the real `es`/`en` catalogs through `NextIntlClientProvider`. RED: both suites failed to load. GREEN: 28/28 (15 form + 13 preview) after the test-side and design fixes recorded in the findings.
- [x] 9.15/9.16 `page.tsx` + test. RED: suite failed to load. GREEN: 9/9. The REAL `dal.ts` runs over a mocked session source (as in the template route test): `secretaria` renders title, subtitle and the form; each of the four other roles gets `/denied` with the form never rendered; anonymous gets `/login`; a flagged `secretaria` gets `/change-password`; the role table is asserted to admit exactly `secretaria`. `maxDuration` is pinned to 300 and to `IMPORT_MAX_DURATION_SECONDS`.
- [x] 9.17/9.18 sidebar + test. RED: 2 failed / 20 (the positive `secretaria` cases; the hide cases pass before the change by construction). GREEN: 20/20. The test pins the item `href` and the full ordered link list for all five roles (existing items unchanged: `["/", "/users", "/settings"]` for administrador and coordinacion, `["/", "/settings"]` for docente and estudiante, `["/", "/users", "/catalog/import", "/settings"]` for secretaria).
- [x] 9.19/9.20 `next.config.ts` + `src/lib/import/next-config.test.ts`. RED: first test failed (`typeof` was `undefined`). GREEN: 2/2. The second test (the next-intl plugin is still applied, via `turbopack.resolveAlias`) is a regression guard that passed before the change too. `npm run build` accepts the config (see Verification).
- [x] 9.21/9.22 parity test extension + copy. RED: 6 failed / 14 (`nav.catalog` absent, `catalog.import.reasons` and `catalog.import.entities` absent; the other `catalog.import` parity checks already passed because batch 1 had put `errors` in both catalogs). GREEN: 14/14. Done before the component pairs because their tests render the real catalogs.
- [x] 9.23 REFACTOR: not needed. The form and the preview share no block near ~30 lines; the only repeated markup is the alert class string, which already repeats across the project forms. The shared `CountsTable` is used by both the preview and the result.
- [x] 9.24 Verification: see below.
- [ ] 9.25, 9.26: NOT done by design; they belong to the user (instructions below).
- [ ] 9.27: checkpoint notes written below; the checkbox stays unchecked until the user has run 9.25/9.26.

## Findings that shaped the code

1. **React clears a form's inputs when its `action` settles.** A `<form action={fn}>` would empty the file input right after the preview, and the confirm step has to re-upload the same file. The upload form is therefore submitted with `onSubmit` (reading `input.files[0]` through a ref, building the `FormData` by hand, then `startTransition(dispatch)`), and the `File` is kept in component state for the confirm step, where the confirm form `action` adds it to the `FormData` next to the hidden `fileSha256`. A side effect that also made the tests honest: user-event overrides `input.files`, so jsdom `new FormData(form)` sees an empty file; reading `input.files` gives the real one.
2. **One reducer, and the previous state is never sent to the server.** `useActionState` forwards the previous state to the action. After an apply that state holds the temporary credentials, so a later request would have carried them back. `runFlow` ignores the previous state and calls `previewAction(IDLE, fd)` / `applyAction(IDLE, fd)`. A test uploads again after an apply and asserts the second call received `{ kind: "idle" }` and that the password string appears nowhere in the call arguments.
3. **An unresolved action promise leaks across tests.** A "pending" test that never settled blocked React's transition queue for later tests (a Spanish end-to-end test timed out only in the full file run). The test now resolves it inside `act`. A second test-side fix: the contract heading selector had to be scoped to the sheet list (the rules block is also an h3).
4. **`maxDuration` cannot be an imported constant.** First attempt: `export const maxDuration = IMPORT_MAX_DURATION_SECONDS`. `npm run build` failed with "Invalid segment configuration export detected" (Next reads segment config statically). The page keeps a literal `300`; `IMPORT_MAX_DURATION_SECONDS = 300` lives in `limits.ts` and `page.test.tsx` asserts both equal each other and 300, so they cannot drift silently. `bodySizeLimit` in `next.config.ts` does import the constant (the config is plain Node code).

## Ambiguity resolved

- **Contract panel**: sheet names and columns come straight from `SHEETS` (static data, never an uploaded file) so they cannot drift from the parser; the labels and the five validation rules are catalog copy. The rule sentences quote the column identifiers (`Id`, `Carrera`, `HorasTotales`, `Periodo`, `CorreoDocente`) as the workbook spells them, in both locales.
- **Row-error reasons**: `RowError.reason` is a machine code (the zod messages are i18n keys by design, `schemas.ts`). The preview translates it through `catalog.import.reasons.<code>`, with 32 codes in both catalogs, and falls back to the raw code when the catalog has none (for example a default validator message). `catalog-parity.test.ts` pins the full code list the schemas, parser and planner can emit, so a new code without copy fails the suite. The two cap reasons interpolate `MAX_NEW_ACCOUNTS_PER_APPLY` / `MAX_ACCOUNT_EVENTS_PER_APPLY`, so the copy cannot drift from the limits. Workbook-wide errors have `row: 0` and show an em dash.
- **File-size hint** uses `MAX_FILE_BYTES / 1024 / 1024` as an ICU argument, not a hardcoded "5".
- **Deactivations line** reads `counts.Grupo.deactivate` (the only entity the planner deactivates) and says "No group will be deactivated" at zero, so absence is explicit too. It is still shown when errors exist, next to the blocked notice.
- **Confirm absent, not disabled, when errors exist** (9.13 allows either): there is no confirm control and no hidden digest field at all.
- **The `Usuario` entity is labelled "Docentes" / "Teachers"** in the counts table, since the import only creates or updates teacher accounts.
- **`en` entity names** "Subjects / Teachers / Groups" (the project `en` catalog already calls the docente role "Faculty"; the sheet names stay Spanish because they are the workbook identifiers).
- **Template link** is a plain `<a href="/api/catalog/template">` styled with `buttonVariants` (a `next/link` would prefetch an API route).
- **Sidebar item key** is `catalog` (`nav.catalog`) with href `/catalog/import`, placed after Users; each item now carries its own `visibleTo` predicate (`canCreateUsers`, `canImportCatalog`) instead of a `requiresUserCreation` flag, so the menu and the page cannot disagree.

## Deviations

- `maxDuration` is a literal `300` in `page.tsx` (Next requires it), pinned by a test to the constant in `limits.ts`; the task asked for it to come from the decided constant. Only `bodySizeLimit` is imported.
- `ImportPreview` receives a `pending` flag and an `action` callback rather than owning `useActionState`; `ImportForm` owns the single state machine. The result screen (`ImportResult`) lives in `import-preview.tsx` beside the preview rather than in its own file.
- The contract panel does not use `Card`: its title is a `div`, and the panel needs a named `section` with real headings (region role, h2/h3 levels). It reuses the same border, radius and padding tokens as the users empty state.
- RED/GREEN order: 9.21/9.22 ran before 9.11-9.14 because those tests render the real catalogs. Each pair still has its own RED run.

## TDD Cycle Evidence (batch 2)

| Task | Test file | RED | GREEN | Triangulation / REFACTOR |
|------|-----------|-----|-------|--------------------------|
| post-review (summary) | `summary.test.ts` | 6 failed / 11 | 11/11 | 6 cases: shape, SQLSTATE, non-string code, cause code, non-Error throw, secrets absent |
| post-review (action) | `actions.test.ts` | 2 failed / 66 | 66/66 | success and rejected paths silent; sink failure |
| 9.21/9.22 | `catalog-parity.test.ts` | 6 failed / 14 | 14/14 | reasons list and entity names pinned |
| 9.11/9.12 | `credentials-download.test.tsx` | suite did not load | 9/9 | StrictMode, BOM bytes, es and en, empty list |
| 9.13/9.14 | `import-form.test.tsx`, `import-preview.test.tsx` | 2 suites did not load | 28/28 | 4 failures fixed on the way (findings 1 and 3); mutation checks below |
| 9.15/9.16 | `page.test.tsx`, `limits.test.ts` | suite did not load; limits 1 failed / 9 | 9/9; limits 9/9 | 4 denied roles, anonymous, flagged |
| 9.17/9.18 | `app-sidebar.test.tsx` | 2 failed / 20 | 20/20 | five-role ordered link table |
| 9.19/9.20 | `next-config.test.ts` | 1 failed (the second test had a wrong shape guess, corrected) | 2/2 | second test is a regression guard |
| 9.23 | n/a | n/a | green | none needed |

Mutation checks (temporary, reverted, suites re-run green afterwards): forcing the preview to always show confirm made 4 tests fail; removing the re-attached file from the confirm submission made the "re-submits the same file" test fail.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/app/api "src/app/(dashboard)/catalog" src/lib/import src/components/app-sidebar.test.tsx src/i18n`: 21 files, 368 passed, 0 failed |
| Runtime harness | Not run: the page, the real database and a browser are the user's manual smoke (9.25/9.26). `npm run build` was run and compiled the page, the client components, the actions and the config (see below) |
| Rollback boundary | Delete `src/app/(dashboard)/catalog/import/{credentials-download,import-form,import-preview,page}.tsx` and their tests; revert `next.config.ts`, `src/components/app-sidebar.tsx` and its test; remove `src/lib/import/next-config.test.ts`; remove `IMPORT_MAX_DURATION_SECONDS` from `limits.ts` and its test; remove `logImportFailure` from `summary.ts` and its tests, and the `logImportFailure` call and test block from `actions.ts` / `actions.test.ts`; remove the batch 2 keys from `i18n/{es,en}.json` and the added blocks in `catalog-parity.test.ts`. Batch 1 and Phases 6-8 are untouched |

## Verification (9.24)

- `npm test`: 54 files, 710 tests, 705 passed, 5 failed. The 5 are exactly the known environment-flaky set: `denied/page.test.tsx` "renders one h1, the explanation and a single control leading to /" and "gives the way-back control the 44px touch floor and leaves the global focus ring alone"; `data-table-search.test.tsx` "renders a clear link to the bare action only when the value is non-empty"; `users/page.test.tsx` "renders users.noResults.* and a clear control when a search has no results" and "shows the new-user button to every creator". No failure outside that set.
- `npm run typecheck`: clean (one fix: `IDLE` typed `as const` so it fits both actions `prev` parameters).
- `npm run build`: succeeded (Next.js 16.3.4, Turbopack). The route list includes `/catalog/import` and `/api/catalog/template` (both dynamic) and prints "Experiments: serverActions", so the config is accepted. The build artefacts confirm both numbers: `.next/required-server-files.json` has `"bodySizeLimit": 5308416` and `.next/server/functions-config-manifest.json` has `"/catalog/import": { "maxDuration": 300 }`. No database connection was attempted.
- `npx eslint` on the touched directories and files: no finding other than the `Delete ␍` prettier noise of the CRLF working copy of tracked files; `--fix` was run only on files created in this batch. One real finding in `app-sidebar.tsx` (import wrapping) was fixed by hand, keeping its CRLF.
- `rg "exceljs|read-excel-file|write-excel-file" src`: code imports (`from "exceljs"`) only in `src/lib/import/parse.ts` and `src/lib/import/template.ts`, plus the one-off `__fixtures__/build-fixtures.mjs` script (not part of the app) and comments in guards, tests and `sheets.test.ts`. No `read-excel-file` or `write-excel-file` anywhere.

## Line count (WU3b batch 2, authored lines, as written after prettier)

| File | Added |
|------|-------|
| `credentials-download.tsx` (new) | 58 |
| `credentials-download.test.tsx` (new) | 173 |
| `import-form.tsx` (new) | 183 |
| `import-form.test.tsx` (new) | 335 |
| `import-preview.tsx` (new) | 224 |
| `import-preview.test.tsx` (new) | 353 |
| `page.tsx` (new) | 28 |
| `page.test.tsx` (new) | 111 |
| `next.config.ts` | 9 |
| `src/lib/import/next-config.test.ts` (new) | 23 |
| `src/components/app-sidebar.tsx` | 17 |
| `src/components/app-sidebar.test.tsx` | 34 |
| `src/lib/import/limits.ts`, `limits.test.ts` | 4 + 5 |
| `src/lib/import/summary.ts`, `summary.test.ts` | 39 + 88 |
| `actions.ts`, `actions.test.ts` (post-review) | 10 + 68 |
| `src/i18n/catalog-parity.test.ts` | 64 |
| `i18n/es.json`, `i18n/en.json` | 135 each (270) |
| **Batch total** | **2096** (1826 without the JSON copy) |

Cumulative WU3b: 1137 (batch 1) + 2096 = **3233**. This is far above the 800-line budget and the ~660 estimate; accepted by the user as `size:exception` in a single PR. The bulk is tests and bilingual copy (32 reason strings plus the contract text, twice).

## 9.27 Checkpoint notes (checkbox left unchecked: it waits for the user's manual run)

Look at, in this order:
1. **Template route guards**: `src/app/api/catalog/template/route.ts`; `requireRole` then `canImportCatalog`, no bytes before both; the proxy cannot see `/api` (F2).
2. **Action ordering**: `actions.ts` `authorize()` is the first statement of both actions and runs before any `formData.get`; the failure trace (`logImportFailure`) is the only new behaviour in that file.
3. **Credentials never leave memory**: they exist only in the `applied` action state, become a Blob behind an object URL in `credentials-download.tsx` (revoked on unmount), are never rendered, never in storage, a cookie, a hidden field or a log, and `runFlow` never sends the previous state back (finding 2).
4. **Sidebar per role**: only `secretaria` sees the import item; both the item and the page derive from `canImportCatalog`.
5. **`bodySizeLimit` in the build output**: `.next/required-server-files.json` `"bodySizeLimit": 5308416`; `maxDuration` 300 for `/catalog/import` in `.next/server/functions-config-manifest.json`.

Revert: see the rollback boundary above. The import is inert without its route.

## Manual steps for the user: 9.25 and 9.26 (NOT run by me)

9.25 (preview only, no write): `npm run dev`, sign in as `secretaria`, open "Catálogo" in the sidebar, confirm the contract panel shows the three sheets before the file input, download the template, upload the real sample workbook and read the dry-run report: counts per entity, the deactivation line, the new-account line and any row errors. Check the caps in `limits.ts` (rows, 250 new accounts, 2000 account events, 5 MB) and the 300 s ceiling against the real row counts, or record a decision to change them. The preview itself writes nothing.

9.26 (a database write, needs your explicit confirmation for the run): do it on a Neon rehearsal branch cloned from the target, not the shared instance, and restate the target host first. If `DATABASE_URL` is `-pooler`, decide `prepare: false` before the first bulk apply (task 1.2 and the Phase 6 note). Then confirm the import and check: the credentials CSV downloads once and a reload shows no password anywhere; the audit rows are present (read-only `SELECT`); a second identical import shows every row `unchanged` and adds one more import audit row. If an apply fails, the server log now shows one `catalog.import.failed` line with the actor, file digest, error name and SQLSTATE.

## Next

User: 9.25 and 9.26, then tick 9.27. After that the change is ready for `sdd-verify`.

---

# Post-implementation UI change to WU3b (user-requested, 2026-10-04). Direct work, not an SDD phase.

The user asked for a visual redesign of the workbook-contract panel on `/catalog/import` and for a dropzone that runs the preview as soon as a file is taken. Tasks 9.13/9.14 are affected; the spec's "upload, then preview, then confirm" flow and "contract before the file input" requirement are kept.

- `import-form.tsx` split into `workbook-contract.tsx` (each sheet drawn as a one-row table of its Excel headers, optional columns labelled in words) and `file-dropzone.tsx` (drop or pick; no submit button; states idle, dragging, analysing, loaded, error). Two columns from `lg`, contract first in DOM order.
- Taking a file dispatches the preview immediately. A client-side pre-check rejects a non-`.xlsx` name or a file over `MAX_FILE_BYTES` without a request; the server guards are unchanged and remain the authority.
- When a preview arrives, focus and scroll move to its heading (`headingRef` on `ImportPreview`).
- While a second file is analysed, the previous preview is hidden (it would otherwise show the first file's counts under the second file's name). Found as an intermittent test failure; pinned by "hides the previous preview while a new file is analysed".
- i18n: added `contract.columnsCaption`, `contract.optional`, `contract.legend`, `upload.dropTitle`, `upload.dropActive`, `upload.choose`, `upload.change`, `upload.analysing`, `upload.selected`; removed `contract.requiredColumns`, `contract.optionalColumns`, `contract.noOptionalColumns`, `upload.fileLabel`, `upload.submit`, `upload.submitting`; `contract.intro` no longer says "in this order" (the parser resolves sheets and columns by name).
- Security pins unchanged: previous action state never sent to the server; confirm re-sends the kept `File` with the hidden `fileSha256`; no confirm control when the preview has errors.
- Not verified here: the rendered layout and real browser drag-and-drop (the page needs a `secretaria` session).

## Follow-up layout changes on `/catalog/import` (user-requested, 2026-10-04)

- Template link tinted with the theme-aware `accent` / `accent-foreground` pair instead of the neutral outline.
- Single column: the dropzone is now the last block inside the workbook-structure card (`WorkbookContract` takes `children`), on `bg-background`; the two-column grid and sticky wrapper are gone.
- Row errors moved out of `ImportPreview` into `ImportErrors` (`import-errors.tsx`, copy under `catalog.import.errorsPanel.*`), rendered between the structure card and the preview only when the analysed file has errors, with a centred summary; focus and scroll go to its heading when a preview arrives with errors. A preview with errors still offers no confirm control.
- The per-sheet column strips, legend and rules stay: the user chose to keep the spec's "contract shown before upload" requirement as written. `spec.md` was not changed.
