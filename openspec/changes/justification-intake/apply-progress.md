# Apply Progress: justification-intake

## Slice 1 (Phase 1, PR 1) - Schema, domain, ports

Mode: Strict TDD. Branch: `feat/justification-intake-s1-schema-domain`. Status: 12/13 tasks complete; 1.5 is a STOP gate awaiting user confirmation (migration generated, NOT applied).

### Completed tasks

1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13. Task 1.5 intentionally open.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.2/1.3/1.4 | `src/db/migration-justification-intake.test.ts` | Unit (SQL read) | N/A (new) | Written; 17/17 failed (no SQL file) | Schema + generated SQL; 17/17 pass after aligning assertions to drizzle's qualified-column output | 17 cases over 3 tables | Test helper `flat()` strips drizzle qualifiers |
| 1.6 | `src/lib/intake/signature.test.ts` | Unit | N/A (new) | Written; module missing | 8/8 pass | PDF/PNG/JPEG + truncated, wrong tail, HTML, MZ | prettier only |
| 1.7 | `src/lib/intake/dates.test.ts` | Unit | N/A (new) | Written; module missing | pass | UTC crossing, 06:00 UTC flip, boundary table 30/31 days, leap day | none needed |
| 1.8 | `causes/limits/pathnames.test.ts` | Unit | N/A (new) | Written; modules missing | pass | prefix collision 42/420/4, traversal, nesting, root | none needed |
| 1.9 | `src/lib/intake/submission.test.ts` | Unit | N/A (new) | Written; module missing | pass | per-field, RN-23 table, all-at-once, order | `endErrors` split per field |
| 1.10 | `src/lib/intake/eligibility.test.ts` | Unit | N/A (new) | Written; module missing | pass | ambiguous, wrong group, other subject, duplicate, multi-error | none needed |
| 1.11 | `src/lib/intake/states.test.ts` | Unit | N/A (new) | Written; module missing | pass | visible/hidden/unknown | none needed |
| 1.12 | `src/lib/intake/adapters/permissive-schedule.test.ts` | Unit | N/A (new) | Written; module missing | pass | ids, date-independence, empty | none needed |
| 1.13 | `src/db/pool-options.test.ts` | Unit | N/A (new); `src/db` baseline 6 files green | Written; module missing | pass | production vs dev/test | none needed |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx vitest run src/lib/intake src/db` -> 17 files, 140 tests passed |
| Runtime harness | N/A: no runtime surface; migration SQL read by test |
| Rollback boundary | Revert `src/db/schema.ts` additions, `src/db/index.ts`, `src/db/pool-options*.ts`, `drizzle/0005_justification_intake.sql`, `drizzle/meta/0005_snapshot.json` and the `_journal.json` entry, `src/lib/intake/`. Migration is unapplied. |

### Deviations / notes

- Generated migration number is `0005` (provisional; catalog-management owns 0005/0006 off-main; regenerate at final merge, F.2).
- Cause codes (varchar(30)): `maternidad_paternidad`, `actividad_representativa`, `intercambio_academico`, `medica`, `fuerza_mayor`. `schema.ts` derives its CHECKs from `CAUSAS`, `ESTADOS_SOLICITUD`, `MAX_DOCUMENT_BYTES`.
- Extra index `IX_Documento_Solicitud` on `DocumentoRespaldo(SolicitudId)` (not in design; serves the cap count and cascade). Easy to drop.
- `validateSubmission` input shape: `{ causa, fechaInicio, fechaFin, selections: {asignaturaId, grupoId|null}[], eligibleGroups, validDocumentCount }`; errors are `{ field, code, asignaturaId? }` with codes mapped to `intake.errors.<code>` later.
- Pool options extracted to `src/db/pool-options.ts` (pure) so the env branch is testable.
- Open question (D11): `prepare: false` is confirmed as the postgres-js recommendation for PgBouncer transaction mode (`node_modules/postgres/README.md`). Context7 MCP was not available to this executor, so Neon/Vercel docs were not consulted live; Hobby region selection is left to task 5.5.
- Slice size: 1413 changed lines excluding drizzle/meta (780 in tests); over the 800 budget. Recommend `size:exception` or splitting the tests.
- `npm run typecheck` reports only pre-existing errors in `src/lib/import/*` (`exceljs` missing from node_modules); none in touched files.

## Delivery decision (slice 1)

- Owner accepted `size:exception` for PR 1: 1,413 changed lines (780 tests) against the 800-line budget, instead of splitting into 1a/1b. Native attempt objective reset by the owner (request `ji-s1-reset-size-exception-001`).
- Task 1.5 (apply migration) deliberately left open: the migration number `0005` is provisional and collides with catalog-management; apply only after regeneration at the final merge (F.2), with explicit user confirmation.
- Environment note: `exceljs` is declared in package.json but missing from node_modules, so `npm run typecheck` fails in `src/lib/import/*` (pre-existing, untouched by this slice). Run `npm install`.
