# Apply Progress: docente-maintenance

## Owner decisions (task 0.2, 2026-11-25)

- D1 to D5 of `proposal.md` confirmed.
- Four stacked slices into the tracker `feat/docente-maintenance` (from main c5ea22e); review budget 1000 changed lines per PR; ask-on-risk; feature-branch-chain; one production deploy.
- Standing approval to open and merge the slice PRs into the tracker without asking for each one, only with every gate green and at most 1000 changed lines.
- STOP after each slice: report and wait for the owner before starting the next one.
- An explicit yes is always required for every Neon command, the merge to `main` and the deploy, any deletion, any PR over 1000 lines and any change of an owner decision. No database command runs without it.

## Log

- 0.1: tracker created from main c5ea22e; planning committed (exploration, proposal, specs, design, tasks) and pushed.
- Early read-only check of production (2026-11-25): 0 active grupos under an inactive docente, 0 emails repeated ignoring case, 0 docentes without email, 4 docentes, all active. The gate repeats it on the day of the merge (6.3).

## Slice 1 (domain), branch `feat/docente-maintenance-1-domain` (base tracker 76574b3), 2026-11-25

Mode: Strict TDD (vitest). Tasks 0.3 and 1.1 to 1.11 done. Task 1.12 (slice close) is NOT closed: the slice measures 1258 changed lines, over the 1000 stop line (see "Size and stop line"). Task 1.0 (branch) was created by the orchestrator and 1.13 (PR) is not started.

### Task 0.3: baseline and Next rule

- Scoped baseline T(src/lib src/app src/i18n src/test) on the tracker tip: 342 test files, 9651 tests; 2 files and 3 tests failed (the visible one is `import-form.test.tsx`, the "credentials.download" link not found) while the machine was loaded by parallel edits. Not reproduced: the two later full runs of the same tree were green.
- Full suite at the slice tip: 394 files, 10510 tests, green (run twice; the first run found the real regression of unit 2 described in the deviations).
- Next docs read (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/`): `revalidatePath.md` (a pattern with a dynamic segment REQUIRES the `type` argument "page"; a literal path omits it; call it in Server Functions) and `redirect.md` (call `redirect` OUTSIDE any `try`/`catch`: it throws). Rule applied in slice 2: literal paths without type, dynamic patterns with "page", `redirect` after the try. Slice 1 touches no Next API.

### TDD cycle evidence

| Unit | Task | RED (test written first, run, failed) | GREEN | MC |
|------|------|----------------------------------------|-------|----|
| 1 | 1.1 | `npm test -- src/lib/audit`: 12 failed, 140 passed (2 files). `accountCreatedEvent` and `accountUpdatedEvent` ignored `origin` (payload came out `origen: "importacion"` with `importacionSha256: undefined`), `accountActiveChangedEvent` and `docenteWriteEvents` "is not a function", `AUDIT_ACTIONS` lacked the two codes | 1.2: `src/lib/audit/{types,events}.ts` plus the result types; T(audit/): 3 files, 152 tests pass; typecheck clean | 1.3 |
| 2 | 1.4 | `docente.test.ts`: "Failed to resolve import @/lib/validations/docente"; `catalog-parity`: 7 failed (key list, `fieldErrors` exact set in es and en, five messages missing in both locales) | 1.5: schema, key list, catalogs; T(validations/docente catalog-parity src/i18n): 10 files, 509 tests pass | 1.6 |
| 3 | 1.7 to 1.9 | `docentes.test.ts`: "Failed to resolve import @/lib/data/docentes" (module missing) | 1.10: `src/lib/data/docentes.ts`; T(data/docentes): 1 file, 31 tests pass | 1.11 |

REFACTOR: none needed (the builders reuse the `AuditOrigin` spread of the asignatura and grupo builders).

### Mutation checks (each applied to the production file, run, reverted with `git restore`; `git status` clean before every commit)

| MC | Mutation | Failing tests |
|----|----------|---------------|
| 1a | the toggle payload carries `importacionSha256` | `accountActiveChangedEvent ... activo false is usuario.desactivado ...` and `... activo true is usuario.reactivado ...`; `docenteWriteEvents ... every payload is the three keys campos, rol and origen: no digest, no value` |
| 1b | `buildAuditEvents` origin without the digest | `buildAuditEvents > importacionSha256 propagates from summary.fileSha256, not re-derived` |
| 1c | `docenteWriteEvents` emits for `unchanged` | `docenteWriteEvents ... gives one event per success and [] per refusal and no-op`; `... every payload is the three keys ...` |
| 2 | schema made loose (`.loose()`, passes `login` through) | `docenteUpdateSchema (DM-3) > strips every key outside the three editable fields` |
| 3a | `if (!activo && false)` skips the active-grupo count | `setDocenteActivo ... deactivation counts the active grupos of any period ...`; `... active grupos refuse with their count and no UPDATE`; `... answers not_found when the deactivating UPDATE returns no row` |
| 3b | email lookup without `Id <> id` | `updateDocente ... looks the email up by lower-case equality, excluding the account itself ...`; `... re-saving an own mixed-case email ... excludes the own row` |
| 3c | savepoint replaced by the same handle | `updateDocente ... updates inside a savepoint, with only the changed fields ...`; `... maps a 23505 raised inside the savepoint to correo_taken` |
| 3d | `login` added to the SET | `updateDocente ... updates inside a savepoint ...`; `... stores all changed fields in one write ...`; `... never puts the login, the hash, the role, the state or the password flag in the SET` |
| 3e (UPDATE) | role predicate dropped from both UPDATEs | `updateDocente ... updates inside a savepoint ...`; `setDocenteActivo ... deactivation counts ...`; `setDocenteActivo ... reactivation runs no count, sets only Activo and carries the role in the WHERE` |
| 3e (read) | role predicate dropped from the reads | `getDocenteById ... reads Usuario joined to Rol ...`; `... is null identically for a missing id and for an account of another role`; `updateDocente ... reads the row first ...`; `setDocenteActivo ... reads the row first ...` |
| 3f | email lookup runs when `correo` is unchanged | `updateDocente ... runs no email lookup when the email is unchanged`; `... updates inside a savepoint ...` |

### Work unit evidence

| Unit | Focused test command and result | Runtime harness | Rollback boundary |
|------|---------------------------------|-----------------|-------------------|
| 1 | `DATABASE_URL=postgres://u:p@localhost:5432/x npm test -- src/lib/audit`: 3 files, 152 tests, pass | N/A: pure builders, no runtime boundary; the Postgres proof is SC-1..SC-7 (task 5.2) | revert `fed07e0`: audit actions, builders, result types; the import payload is key-for-key unchanged |
| 2 | `npm test -- validations/docente validations/catalog catalog-parity src/i18n`: pass (the i18n run is 509 tests; the two validations files 122) | N/A: pure schema and catalogs | revert `c8ba7a2`: schema, key list, catalog strings |
| 3 | `npm test -- data/docentes`: 1 file, 31 tests, pass | Postgres suite SC-1..SC-7 on the disposable branch (task 5.2); not run here (no database command allowed) | revert `af552d9`: two new files, nothing calls them yet |

### Commits

- `fed07e0` feat(audit): add docente toggle actions and origin-aware account events (5 files, 324 changed lines)
- `c8ba7a2` feat(docentes): add the docente edit schema, result types and field errors (7 files, 273 changed lines)
- `af552d9` feat(docentes): add the docente data layer (2 files, 661 changed lines)

### Deviations

1. The result types `DocenteWriteResult` and `DocenteActiveResult` (`src/lib/catalog/types.ts`) are in unit 1, not unit 2 (task 1.5): `docenteWriteEvents` in `events.ts` maps them, so unit 1 does not typecheck without them. The unit 1 commit lists five files (four audit files plus `catalog/types.ts`); the unit 2 commit has no `catalog/types.ts`.
2. The unit 2 commit also holds `src/lib/validations/catalog.test.ts`: its "every listed key can be emitted (the list is exactly the emitted set)" pin went red with the four new keys, found by the first full run. The battery now also feeds `docenteUpdateSchema` (empty input, over-long values, an over-long address). Folded into unit 2 with a fixup and autosquash so every commit is green on its own (local branch, nothing pushed).
3. `events.test.ts`: the existing import assertions that read `datos.importacionSha256` (a field the new union type does not expose without narrowing) now assert `datos` with `toEqual` or `toMatchObject` carrying the same keys and values; the calls of `accountCreatedEvent` and `accountUpdatedEvent` pass `origin`. Meaning unchanged.
4. `getDocenteById`, `updateDocente` and `setDocenteActivo` share one `isDocente` predicate (role code "docente" through the join on `Rol`), so the three reads cannot drift apart.
5. New files were created LF and converted to CRLF to match the working tree; the index holds LF (autocrlf).

### Gate results (slice tip `af552d9`)

- `npm test` (dummy DB): 394 files, 10510 tests, all pass (286 s).
- `npm run typecheck`: clean.
- `npx eslint src` with the prettier end-of-line rule set to auto: 0 errors, 1 warning (`SidebarGroupLabel` unused in `src/components/app-sidebar.tsx`, not touched by this slice). Touched files individually: 0 problems; `npx prettier --check <touched> --end-of-line auto`: clean.
- `npm run build` (dummy DATABASE_URL and AUTH_SECRET): compiled, route table printed.

### Size and stop line

`git diff --numstat 76574b3 HEAD -- . ':(exclude)openspec' ':(exclude)docs'`: 1232 added, 26 deleted, 1258 total (planned about 710). Production code is about 340 of those lines; about 920 are tests (`docentes.test.ts` alone is 487). Over the 1000 stop line: task 1.12 is left open and the PR (1.13) is not opened. The last unit boundary under 1000 is after unit 2 (597 lines); unit 3 alone is 661. The owner decides the cut or a `size:exception`. Tests were not trimmed.
