# Tasks: Merge Grupo into Asignatura (one catalog row per class)

> **DB-touching and DESTRUCTIVE.** Migration `0007` rewrites `Asignatura`, re-points `Inscripcion` and drops `Grupo`. This file plans commands; it runs none. Strict TDD: inside every phase RED (test written, run, fails for the stated reason) -> GREEN. A task labelled "characterization" cannot be RED; it states how it is proven (mutation check). Written 2026-10-09 against `proposal.md`, `design.md` (MG-1..MG-27, MG-G1..MG-G22, N1-N4, R1-R11, O1-O12, P1-P10), the four delta specs and the house format of `catalog-management/tasks.md`.
> **Spec abbreviations.** `academic-catalog` (AC-): NOGRP, DOC, ACTDOC, ORIG, DIAS, D9, RULE, DBRULE, MIG, COLL, ACT, PRE, AUDH, GATE, ASG, INS, READ, LIFE, CODE (one per requirement title of the delta). `catalog-management`: CM-ASG-1..13, CM-RTE-1, CM-ACC-1/2, CM-SCOPE-1..3, CM-LST-1, CM-UX-1, CM-NAV-1, CM-I18N-1, CM-NFR-1/2/4, CM-AUD-1. `audit-log`: AL-RET, AL-PROP, AL-IMPSHAPE, AL-SET, AL-ONE, AL-PAY, AL-IMP. `catalog-excel-import` (CEI-): SHEETS, OLD, D9ROWS, D9WRITE, DOC, RULE, ORDER, DIAS-1..4, TPL, VAL, DRY, UPS, DEA, AUD, UI, PREC, PREV, COPY. Questions: O2-O12 (design), S1-S8 (specs), Q:xx marks the task that needs the answer.
> **Tags.** **[READ-ONLY]** allowed without confirmation. **[CONFIRM]** touches or may touch a database, a Neon branch, or generates migration files: needs the owner's explicit "yes" **for that exact command**. **[GATE]** blocks the tasks named after it. **[USER]** needs input or an action only the owner can give or perform.
> **HC (host check)** applies to every [CONFIRM] task that writes to a Neon branch or runs `db:migrate`: read the host part of the connection string in use, restate it before the command (never credentials), compare with HOST-PROD recorded by task 0.13; abort if equal to HOST-PROD when the target is `rehearsal-0007-neg`, `rehearsal-0007` or `rehearsal-0007-final`, or different when the target is `production`.
> **FT (flaky-test hygiene)** applies to every component and page test: await async UI (`findBy*`, `waitFor`); no synchronous query after an interaction; `fireEvent.change` where `user-event` filters; render with the real `es` and `en` catalogs through `NextIntlClientProvider` with an `onError` that throws; resolve every action promise inside `act`; never read popup contents synchronously; fixed seeds; no wall clock.
> **V (verification)** = the focused command of the slice, `npm test` (full run, once per slice), `npm run typecheck`, `npx eslint <touched files>` (ignore the pre-existing CRLF `Delete ␍` noise), every guard suite that exists at that point (`guards`, `catalog-structure`, `scope-inventory`, `current-marker-usage`, `inscripcion-writes`, `catalog-parity`, `audit-leak`), and `npm run build` when a route, config or `app/` file changed. Tests never import `@/db` (except schema-only files) or `@/env`: `vi.mock("server-only", () => ({}))`, `toSQL()` through `new QueryBuilder()`, hand-rolled recording `tx` doubles. Before any Next.js code re-read the matching guide in `node_modules/next/dist/docs/` (AGENTS.md); N1-N4 of the design are the starting point.
> The `sdd-tasks` 530-word cap is knowingly exceeded: 35 slices with full traceability need the room (precedent: `catalog-management/tasks.md`).

## Read this first

1. **Counting rule (owner, 2026-10-09).** A file deleted whole counts as **ONE** review item, not as its line count. Everything else (additions, deletions inside files that stay, rewrites, new files) counts per changed line; generated snapshots/journal and binary `.xlsx` are excluded. The design's 48 slices are re-planned into **35** (table below). Every slice stays at most **800** counted lines.
2. **Database rule.** Every command that writes to any database (Neon branch create or delete, `npm run db:migrate`, `db:seed`, write SQL, `neon deploy`/`neon config apply`, a smoke that writes) is a **[USER][CONFIRM]** task: one command per task, host restated first (HC), a "yes" for one command never covers the next. `drizzle-kit push` is **forbidden** in every phase. **Agents never run these**; the owner runs them (or gives the explicit "yes" and the agent runs only local file generation, tasks 3.10 and 4.11). Read-only queries need no confirmation.
3. **Branch against database.** From the schema slice (Phase 3) until the production cutover (task 39.10) this branch runs **only** against the Neon development branch `rehearsal-0007` (from task 5.17) and **never** against `production`. Its inserts name `NumeroGrupo`, which production lacks (the failure is a rolled-back `42703`, still forbidden). Any `npm run dev` or smoke uses a shell-scoped `DATABASE_URL`; `.env` is never edited. Every checkpoint restates this.
4. **Measure discipline.** Each slice is measured by path as a delta over the baseline recorded at its first task: `git diff --numstat` for tracked files, `rg -c "" <file>` for untracked ones, a whole deleted file = 1. **Measure after the RED tasks (tests written, production code not yet) and add the design's production estimate; if the slice would pass 800, stop before the GREEN that crosses it**, go to the fallback seam named in the phase header and ask the orchestrator to split. Never `size:exception`. Measure again after GREEN. In earlier changes real sizes ran 1.3x-2x above estimates; tests and bilingual copy dominate. Author locale keys late and small: only the keys a test strictly renders, and show the parity RED first.
5. **Agents never commit, stage, push or branch.** The owner commits by hand (conventional commit, no AI attribution) at each checkpoint, **never while an executor attempt is open**. Moves use the filesystem, never `git mv`.
6. **Executors have no memory tool.** Every batch appends a dated section to `openspec/changes/merge-grupo-into-asignatura/apply-progress.md` (tasks done, RED evidence, V results, authored lines by path, bridges, deviations, new locale keys). A task is not done until its batch note exists. The orchestrator saves Engram from that file.
7. **Bridges.** Where a signature or union changes before its callers are rewritten, the slice carries the minimal typecheck-driven edit marked `// bridge: removed in Phase N` and lists it in apply-progress.md (design P6 names two; this plan names more). Bridges count toward the slice.
8. **Invariant after every slice:** `npm test`, `npm run typecheck`, `npx eslint src`, `npm run build` pass, with no failure outside the known flaky set recorded by 0.8. Runtime coherence between slices is not promised, green is (design, ordering rule 4).
9. **Dev server.** A `next dev` may be running (it shares `.next` with `build`). Any task that runs `npm run build` first checks; if one is running, ask the owner to stop it, never kill it.
10. **Order and parallelism.** One writer, no parallel executors. "Parallel" below means owner-paced work that runs while the executor works: Phase 5 (gates) runs beside Phases 6-10 (code only, no database); Phase 5 must close before Phase 22. One `i18n/*.json` / `catalog-parity.test.ts` / `catalog/types.ts` editor at a time.
11. **Describe boundaries.** The design asked this phase to fix the describe boundaries of the five long test files. Under the counting rule the whole-file deletions (`grupos.test.ts`, `grupos/actions.test.ts`, `grupos/[id]/edit/page.test.tsx`, `plan.test.ts`, `apply.test.ts`) need none. Only the files that are *rewritten* need one: `import/actions.test.ts` (800, task 30.2) and `import-form.test.tsx` (799) with `import-preview.test.tsx` (465) (task 31.2).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | **About 17,500 counted lines** over 35 slices (design: about 28,700 with deletions counted in full; the difference is the whole-file deletions). Honest range 17,500 to about 25,000 if the 1.3x-1.5x overshoot of earlier changes repeats; a slice that overshoots stops at its seam instead of passing 800 |
| 400-line budget risk | High (budget configured at 800; 13 of 35 slices are planned at 700 or more) |
| Chained PRs recommended | Yes (chained review slices on one branch) |
| Suggested split | 35 slices on `feat/sidebar-catalogs`, one conventional commit each, owner-made at the checkpoint of each phase |
| Delivery strategy | One branch with chained review slices of at most 800 counted lines (owner-approved), no `size:exception` |
| Chain strategy | not applicable (single branch) |

Decision needed before apply: No (delivery answered by the owner; the counting rule is binding; the only blocking owner input is task 0.1, the `catalog-management` waivers, which is a prerequisite and not a delivery decision)
Chained PRs recommended: Yes
Chain strategy: not applicable (single branch, chained review slices)
400-line budget risk: High

### Slice table (counting rule applied)

Defaults for every slice unless stated below the table. **Harness:** none (doubles and SQL text); **Rollback:** `git revert` of the slice. Slices M05-M09 are removals, M30-M31 whole-file deletions, M32 a rename.

| Slice | Phase | Design slices | Goal | Est. counted lines | Fits 800 | Focused test command |
|---|---|---|---|---|---|---|
| M01 | 1 | S01 | Pure docente rule, constraint map | 350 | Yes | `npx vitest run src/lib/catalog` |
| M02 | 2 | S02 | `grupo` moves to `db/legacy-grupo.ts` | 120 | Yes | `npx vitest run src/db` |
| M03 | 3 | S03 | Schema, `0007` core, readers, forced fixes | 700 | Yes (tight) | `npx vitest run src/db src/lib/data/catalog.test.ts src/lib/catalog` |
| M04 | 4 | S04 | Guards, assertions, consistency pin, docs, runbook | 480 | Yes | `npx vitest run src/db` |
| M05 | 6 | S05 | Remove tests that scan Grupo sources | 310 | Yes | `npx vitest run src/i18n "src/app/(dashboard)/catalog/audit-leak.test.ts"` |
| M06 | 7 | S06 | Remove the Grupos section | 515 | Yes | `npx vitest run "src/app/(dashboard)/catalog/asignaturas" src/i18n` |
| M07 | 8 | S07-S13 | Remove `catalog/grupos/**` (11 files), sidebar entry | 100 | Yes | `npx vitest run "src/app/(dashboard)/catalog" src/components/app-sidebar.test.tsx` |
| M08 | 9 | S14-S16 | Remove Grupo copy and `grupos.ts` | 480 | Yes | `npx vitest run src/lib/data src/lib/catalog src/i18n` |
| M09 | 10 | S17 | Retire Grupo audit, validation, types | 770 | Yes (tight) | `npx vitest run src/lib/audit src/lib/validations src/lib/data src/lib/catalog` |
| M10 | 11 | S18 | Audit for class events, result unions | 450 | Yes | `npx vitest run src/lib/audit src/lib/catalog` |
| M11 | 12 | S19 | Scope helper, three manual schemas | 550 | Yes | `npx vitest run src/lib/data/catalog-scope-sql.test.ts src/lib/validations src/i18n` |
| M12 | 13 | S20 | Data reads | 650 | Yes | `npx vitest run src/lib/data "src/app/(dashboard)/catalog/asignaturas"` |
| M13 | 14 | S21 | Data writes I (create, add group) | 750 | Yes (tight) | `npx vitest run src/lib/data src/lib/catalog` |
| M14 | 15 | S22 | Data writes II (update, propagation, state) | 750 | Yes (tight) | `npx vitest run src/lib/data` |
| M15 | 16 | S23 | Actions I | 700 | Yes (tight) | `npx vitest run "src/app/(dashboard)/catalog/asignaturas/actions.test.ts" "src/app/(dashboard)/catalog/guards.test.ts" src/i18n` |
| M16 | 17 | S24 | Actions II and the leak sweep | 780 | Yes (tight) | same plus `audit-leak.test.ts` |
| M17 | 18 | S25 | List page | 700 | Yes (tight) | `npx vitest run "src/app/(dashboard)/catalog/asignaturas/page.test.tsx" src/i18n` |
| M18 | 19 | S26 | Form: create and edit | 650 | Yes | `npx vitest run "src/app/(dashboard)/catalog/asignaturas/asignatura-form.test.tsx" src/i18n` |
| M19 | 20 | S27 | Form: add-group and propagation block | 500 | Yes | same |
| M20 | 21 | S28 | Pages | 700 | Yes (tight) | `npx vitest run "src/app/(dashboard)/catalog/asignaturas" "src/app/(dashboard)/catalog/guards.test.ts" src/i18n` |
| M21 | 23 | S29 | Import v2 contract | 600 | Yes | `npx vitest run src/lib/import` |
| M22 | 24 | S30 | Docentes stage extracted | 250 | Yes | `npx vitest run src/lib/import` |
| M23 | 25 | S31 | Planner I | 780 | Yes (tight) | `npx vitest run src/lib/import` |
| M24 | 26 | S32 | Planner II | 700 | Yes (tight) | `npx vitest run src/lib/import` |
| M25 | 27 | S33 | Apply I | 700 | Yes (tight) | `npx vitest run src/lib/import` |
| M26 | 28 | S34 | Apply II, summary, import audit | 650 | Yes | `npx vitest run src/lib/import src/lib/audit` |
| M27 | 29 | S35 | Parse, template, fixtures | 600 | Yes | `npx vitest run src/lib/import` |
| M28 | 30 | S36 | Switch I (actions, snapshot, template route) | 750 | Yes (tight) | `npx vitest run "src/app/(dashboard)/catalog/import" src/lib/import src/lib/data/catalog.test.ts src/app/api` |
| M29 | 31 | S37 | Switch II (preview, card, errors, copy) | 750 | Yes (tight) | `npx vitest run "src/app/(dashboard)/catalog" src/i18n` |
| M30 | 33 | S38-S42 | Remove old planner and old apply (2 tests, 2 modules, fixtures, old summary) | 60 | Yes | `npx vitest run src/lib/import` |
| M31 | 34 | S43-S44 | Remove old contract, schemas, types, `legacy-grupo.ts`, bridges | 60 | Yes | `npx vitest run src/lib/import src/db` |
| M32 | 35 | S45 | Rename `v2/*` into place | 90 | Yes | `npx vitest run src/lib/import` |
| M33 | 36 | S46 | Origin rename, applied-migration literal | 120 | Yes | `npx vitest run src/db src/lib/catalog` |
| M34 | 37 | S47 | Documents | 200 | Yes | `npx vitest run src/lib/import` |
| M35 | 38 | S48 | Closing pins | 150 | Yes | `npm test` |
| | | | **Total (35 slices)** | **about 17,465** | | |

Exceptions to the defaults. **Harness:** M03/M04 are proven for real only by the Neon gates of Phase 5 (rehearsal on `rehearsal-0007`); M19-M20 by the owner smoke of Phase 22; M28-M29 by the smoke of Phase 32. **Rollback:** M03/M04 additionally delete the three `drizzle/0007*` files and the journal entry (nothing is applied before Phase 5; after Phase 39 only the Neon restore of `backup-before-0007` goes back); M05-M09 revert in reverse order; M30-M31 revert independently. **Fallback seams** (where an executor stops if the measure passes 800): M03 = move tasks 3.5 and 3.9 (readers) to the head of Phase 4; M09 = split after 10.7 (audit) from 10.8-10.9 (validations, scope, types); M13 = move `addGrupo` (14.4, 14.8) to the head of Phase 15; M14 = move `setAsignaturaActivo` (15.5, 15.8) to a new slice; M16 = move the leak-sweep rewrite (17.4) to the head of Phase 18; M23 = move the match rules (25.4) to M24; M28 = move the template route (30.5) to M29; M29 = move `import-form` tests (31.7) to a new slice.

## Owner questions that block tasks (each attached to the first task that needs the answer)

| Q | Question | First task | Default if the owner does not answer |
|---|---|---|---|
| O12 | Waive the `catalog-management` tasks of MG-27 and archive it first | 0.1 | Applied only on an explicit yes. No code task (Phase 1 on) starts before 0.1-0.5 close. Fallback if declined: deltas target the unarchived change folder and the archive of this change is blocked |
| O7 | Confirm A2 (surviving row of a period collision) | 3.13 | A2 as designed. Preflight found zero collisions, so it selects nothing today |
| O9 | Origin of a group-less subject (audit lookup or `importacion`) | 3.13 | Audit lookup as MG-7 (selects zero rows today; lever L3 remains) |
| S1 | Unresolvable A2 tie (two active rows, same number, same period) stops the migration | 4.2 | Add guard G-e (spec S1 is binding; the design's ranking would pick by `Id`) |
| S2 | Active class without docente is returned by downstream readers | 3.5 | Returned (consistent with MG-24) |
| O3 | A class row keeps no record of its term | 4.15 | Accepted (D8 is binding); recorded in the G5 approval |
| O4 | A class with no days never conflicts | 1.2 | Accepted as designed (spec AC-RULE says the same) |
| O6 | Removed `/catalog/grupos` URLs show the framework 404 | 8.2 | Framework default (A11, N3) |
| S5 | Create for an existing code: design refuses in create mode and copies stored fields in add-group mode; spec scenarios CM-ASG-2 "Another group of an existing code is allowed" and CM-ASG-11 "A new group takes the stored fields" read as a create | 14.2 | Design (MG-10, MG-17). Verify must read those two scenarios as satisfied through the add-group entry point, or the spec needs a one-line delta fix |
| O5 | Offer "reactivate without docente" | 15.2 | Not offered; the import is the exit (MG-14) |
| S8 | Confirmation of a propagating edit is enforced on the server | 15.2 | Server-enforced |
| S6 | List search covers code, name, group number, docente name | 13.2 | As specified |
| S7 | List order of group numbers | 13.2 | Design: code, `length(NumeroGrupo)`, `NumeroGrupo`, id (so "2" before "10"); spec S7 notes text order. Rows in the spec scenario order identically under both |
| O11 | Keep the Hours column in the list | 18.2 | Keep (nine columns) |
| O8 | A6 (blank `CorreoDocente` clears) and the header rule | 23.2 | A6 yes. Header: **spec S4** (column optional; absent keeps the stored docente; created class has none), because it removes the risk that made the design (P3) make the header required. Diverges from MG-19; the orchestrator records the amendment |
| S3 | Rows of one code that disagree: every row errors | 25.3 | Every row of the code errors (spec S3); the design (first valid row) is the fallback |
| S4 | Absent `CorreoDocente` column keeps the docente | 23.2 | See O8 |
| O10 | How long `backup-before-0007` is kept | 39.20 | Until the owner names a date |
| O2 | Who handles a request for a class without docente | 40.5 | Out of scope; recorded as a constraint for the future Solicitud change |

Other spec-versus-design differences found while planning, each with the default the tasks apply: **(a)** list docente cell shows a hyphen `-` (spec CM-ASG-12) not the muted text "no docente" (MG-16): spec wins, task 18.3. **(b)** A docente-rule conflict makes **each** workbook row involved an error naming the code and both group numbers (CEI-RULE) not only the later row (MG-20): spec wins, task 26.4. **(c)** The deactivation confirmation names code, group number **and name** (CM-UX-1), MG-17 names code and group: spec wins, task 21.3.

## Phase 0: Prerequisites (before any slice)

State when written: branch `feat/sidebar-catalogs`, HEAD `d3a3997`, only `openspec/changes/merge-grupo-into-asignatura/` untracked. `catalog-management` is committed but not verified or archived. Production preflight run on 2026-10-09 (read-only): 3 `Asignatura`, 3 `Grupo` (all active), 0 `Inscripcion`, 0 subjects without group, 0 collisions on (subject, group number) once `Periodo` is dropped, 0 docente-rule violations, periods `2026-S1` and `2026-S2`.

**`catalog-management` open tasks (23 boxes in its `tasks.md`) and what this change does to them (MG-27).** Waived (17): 9.12, 9.13, 10.15, 12.13, 13.13, 13.14, 15.6, 17.30, 17.31, 19.14, 19.15, 20.13, 20.14, 21.7, 21.8, 22.10, 22.11. Kept (6): 14.10, 14.11, 15.7, 15.8, 15.9, 18.11. Each waiver is recorded in that file by the orchestrator with the reason "superseded by merge-grupo-into-asignatura" and only after the owner's yes (task 0.1).

- [ ] 0.1 [USER][GATE] Q:O12. Owner confirms the 17 waivers above and the order (verify and archive `catalog-management` before this change). The orchestrator then records each waiver in `catalog-management/tasks.md`. Blocks 0.2-0.5 and every code task.
- [ ] 0.2 [USER] Do the three kept looks of `catalog-management`: 18.11 (checkbox group, five minutes), 14.10 and 14.11 (Docentes page read-only smoke and checkpoint). Verify: ticked by the owner there.
- [ ] 0.3 [USER][CONFIRM] Settle `catalog-management` 15.7 (branch housekeeping) as written there; each Neon deletion is its own command with HC. New names `rehearsal-0007-neg`, `rehearsal-0007`, `rehearsal-0007-final`, `backup-before-0007` must not collide with any survivor. Verify: decisions recorded.
- [ ] 0.4 [USER][GATE] `catalog-management` 15.8: run `sdd-verify` on the tree at `d3a3997` before any slice of this change touches code. Verify: no CRITICAL, or each recorded.
- [ ] 0.5 [USER][GATE] `catalog-management` 15.9: archive in order (`catalog-excel-import` first per its 0.6, then `catalog-management`). Verify: `openspec/specs/catalog-management/spec.md` exists and the requirement titles the deltas of this change cite are present.
- [ ] 0.6 [USER] Decide the state of the untracked change folder (commit it by hand, or leave it untracked) and record HEAD sha. Create `apply-progress.md` with a header. Verify: baselines of every slice start from the recorded HEAD.
- [ ] 0.7 [READ-ONLY] Re-read in `node_modules/next/dist/docs/`: `03-file-conventions/page.md`, `dynamic-routes.md`, `03-file-conventions/not-found.md`, `04-functions/not-found.md`, `redirect.md`, `revalidatePath.md`, the forms and data-security guides, and the route-handler guide for `src/app/api/catalog/template`. Verify: any deviation from N1-N4 written in apply-progress.md before 8.2, 16.2 and 21.2.
- [ ] 0.8 Baseline `npm test` on HEAD. Verify: exact names of failing known-flaky tests recorded (previous set: `denied/page.test.tsx` 2, `users/page.test.tsx` 2, `data-table-search.test.tsx` 1); "green" means no failure outside that set.
- [ ] 0.9 Baseline `npm run typecheck`. Verify: result recorded.
- [ ] 0.10 Baseline `npx eslint src`. Verify: count of pre-existing findings and CRLF noise recorded.
- [ ] 0.11 Baseline `npm run build` after the dev-server check (Read first item 9). Verify: result recorded.
- [ ] 0.12 [READ-ONLY] Record the 2026-10-09 preflight above in apply-progress.md (counts and catalog keys only). Spec: AC-PRE. Design: P1-P5, MG-G1. Note: with 3 groups and 3 subjects no code has two groups, so rules A1 and A2 select nothing today and stay in `0007` as guards.
- [ ] 0.13 [USER] Record HOST-PROD: the host part of the production connection string (never credentials), in apply-progress.md. Every HC compares against it.
- [ ] 0.14 [READ-ONLY] Run the preflight queries the 2026-10-09 run did not report, on `production`: P10 (seven migration rows, last is `0006`), P11 (constraint and index names equal finding R3, nothing else depends on `Grupo`), P12 (digest of the expected class rows), and the informational P6-P9. Stop conditions: P10 not 7, P11 differs from R3. Verify: results recorded.
- [ ] 0.15 [USER][GATE] MG-G2. Owner reads the preflight record (0.12 and 0.14). Verify: approval recorded; P3 is empty so nothing is "not carried over"; any stop condition returns the change to the owner.

## Phase 1: M01 Pure docente rule and constraint map (~350)

Seam and files: `src/lib/catalog/docente-rule.ts`, `constraints.ts` and their tests. Pure; imports nothing from `@/db` or the data layer.

- [ ] 1.1 Baseline: record `rg -c ""` of the four new paths (all untracked) and HEAD.
- [ ] 1.2 RED `docente-rule.test.ts`: table of MG-13 cases through `conflictoDocente`: same docente + shared day conflicts; null docente on either side, `Dias = 0` on either side (Q:O4), either side inactive, same docente with disjoint days never conflict; a days-edit case that adds a shared day conflicts; returns the shared mask. Spec: AC-RULE (overlap table). Fails: module missing.
- [ ] 1.3 RED `conflictosDocente`: every conflicting pair inside one set, `[]` when valid; symmetry; a property loop over random small sets with a fixed seed compared with a brute-force pairwise check; generic key (number and string). Design: MG-13.
- [ ] 1.4 RED `constraints.test.ts`: `UQ_CLASE === "UQ_Asignatura_Clase"`; `DOCENTE_RULE_INDEX` holds exactly the seven names `UX_Asignatura_Docente_<Dia>` (Lunes, Martes, Miercoles, Jueves, Viernes, Sabado, Domingo) mapped to the seven `DiaSemana` in week order; a pure `classifyUniqueViolation(constraintName)` returns clase-taken, docente-conflict with the day, or null for anything else. Design: MG-11.
- [ ] 1.5 RED purity pin: both modules' source contains no import of `@/db`, `server-only`, `drizzle-orm` or the data layer. Verify: proven by a mutation (add one such import, pin fails, remove it).
- [ ] 1.6 GREEN `docente-rule.ts`: `ClaseHorario<D>`, `conflictoDocente`, `conflictosDocente` (MG-13).
- [ ] 1.7 GREEN `constraints.ts`: constants and `classifyUniqueViolation` (MG-11). The cross-check against `schema.ts` is task 3.4.
- [ ] 1.8 Measure (sum of the four paths).
- [ ] 1.9 V (`npx vitest run src/lib/catalog`; full `npm test` once; typecheck; eslint touched files).
- [ ] 1.10 [USER] Checkpoint M01. Look at: purity, the five non-conflict cases, symmetry. Commit by hand once no executor attempt is open.

## Phase 2: M02 Legacy seam (~120)

`grupo` moves, unchanged, to `src/db/legacy-grupo.ts` so drizzle-kit (which reads only `schema.ts`, R1) stops seeing it while the old import code keeps compiling (MG-5). Do not run `db:generate` in this phase.

- [ ] 2.1 Baseline: record HEAD; list importers of `grupo` with `rg -l "\bgrupo\b" src` (expected: `grupos.ts`, `catalog.ts`, import `plan.ts`/`apply.ts`, tests).
- [ ] 2.2 RED in `src/db/schema.test.ts`: `schema.ts` does not export `grupo`. Fails: it does. Design: MG-5, R1.
- [ ] 2.3 RED characterization in `schema.test.ts`: the `grupo` object imported from `@/db/legacy-grupo` has the same column names, types and constraints as the one it replaces (captured from the current test before the move). Proven by a mutation (rename one column in the new file).
- [ ] 2.4 GREEN create `src/db/legacy-grupo.ts` with the header of MG-5 (dropped by `0007`, do not query a migrated database, deleted in Phase 34); `schema.ts` imports it for `inscripcion.grupoId` with lazy `() => grupo.id` references and does not re-export it. Verify: no import-cycle failure when `schema.ts` and `legacy-grupo.ts` are imported in either order (add the two-order import to 2.3).
- [ ] 2.5 Re-point every importer found in 2.1 to `@/db/legacy-grupo`.
- [ ] 2.6 Measure.
- [ ] 2.7 V (full `npm test`; typecheck; eslint touched files).
- [ ] 2.8 [USER] Checkpoint M02. Look at: only an import path changed outside the new file. Commit by hand.

## Phase 3: M03 Schema, migration core, readers (~700)

From this phase until task 39.10 the branch never runs against `production` (Read first item 3). Fallback seam: tasks 3.5 and 3.9 (readers) move to the head of Phase 4.

- [ ] 3.1 Baseline paths: `src/db/schema.ts`, `schema.test.ts`, `src/db/migration-0007.test.ts` (new), `drizzle/0007_*.sql` (new), `src/lib/data/catalog.ts`, `catalog.test.ts`, `src/lib/data/asignaturas.ts`, `src/lib/import/apply.ts`.
- [ ] 3.2 [READ-ONLY] Read `drizzle/meta/0006_snapshot.json` (object names, finding R3), `migration-0006.test.ts` and `migration-0005.test.ts` (style), `drizzle.config.ts`, the `db:generate` script; locate the two production inserts into `asignatura` that need the bridge value. Verify: names and sites recorded.
- [ ] 3.3 RED `schema.test.ts`: the ten columns in order; `DocenteId` nullable FK to `usuario`; `Dias` default 0; `Origen` default `'importacion'`; no unique on `Codigo` alone; `UQ_Asignatura_Clase` on (`codigo`, `numeroGrupo`); `IX_Asignatura_Docente`; both CHECK names; seven partial unique indexes with seven distinct bits 1,2,4,8,16,32,64 and the predicate text `Activo` AND `DocenteId IS NOT NULL` AND `(Dias & bit) <> 0`; `inscripcion.asignaturaId` NOT NULL with PK `Inscripcion_EstudianteId_AsignaturaId_pk`, `IX_Inscripcion_Asignatura`, FK to `asignatura`, no `grupoId`. Spec: AC-ASG, AC-DBRULE, AC-INS, AC-NOGRP. Design: MG-1..MG-5.
- [ ] 3.4 RED cross-pin: `constraints.test.ts` reads `schema.ts` and asserts the keys of `DOCENTE_RULE_INDEX` and `UQ_CLASE` equal the names declared there. Design: MG-11.
- [ ] 3.5 RED `catalog.test.ts` (SQL text): `buildActiveClasesForEstudianteQuery({cif, codigoAsignatura})` has no `periodo`, joins `inscripcion` to `asignatura`, requires `Activo` on both, selects `asignaturaId`, `numeroGrupo`, nullable `docenteId`; `buildActiveEnrollmentQuery({cif, asignaturaId})` has the same two conditions; the snapshot projects `numeroGrupo`, `docenteId`, `origen`, `dias` for asignaturas and `asignaturaId` for inscripciones; Q:S2 a class without docente is not excluded (no condition on the docente). Spec: AC-READ. Design: MG-24.
- [ ] 3.6 Measure after RED (tests only) plus the design estimate for 3.7-3.13; decide go or stop (Read first item 4).
- [ ] 3.7 GREEN `schema.ts` per MG-5: `asignatura` columns and constraints, the seven indexes from one helper over `DIAS_SEMANA` using `sql.raw(String(1 << i))`, `inscripcion` re-pointed, the import of `grupo` from `legacy-grupo.ts` removed.
- [ ] 3.8 Forced fixes: `tsc` now fails at the production inserts and test literals; add `numeroGrupo: "1"` (the A1 value) only at the sites it lists, marked `// bridge: removed in Phase 14` (asignaturas.ts) and `// bridge: removed in Phase 33` (old import `apply.ts`, deleted whole there). Design: P6.
- [ ] 3.9 GREEN `catalog.ts` per MG-24 (the `grupos` snapshot keeps reading the legacy table until Phase 30).
- [ ] 3.10 [USER][CONFIRM] MG-G3: `npm run db:generate -- --name merge_grupo_into_asignatura`. Files only, no database. Every rename prompt answered "create". Never `--custom` (R2). Verify: draft SQL, `drizzle/meta/0007_snapshot.json`, journal `idx: 7` exist. The draft is destructive and is never applied.
- [ ] 3.11 [READ-ONLY] Copy the draft SQL into apply-progress.md as text; check the snapshot `prevId` equals the `0006` snapshot id; record every constraint, index, FK and PK name from the draft for 3.13.
- [ ] 3.12 RED `migration-0007.test.ts` core pins: exactly one `0007_*.sql`; first statement `SELECT pg_advisory_xact_lock(5005001)`; the old unique dropped before the first `INSERT`; the A1 update before the `INSERT`; `DROP TABLE "Grupo"` last, once, no `CASCADE`; no `DELETE FROM`, no `TRUNCATE`, no write to `EventoAuditoria`, no transaction control outside `$$` bodies, no breakpoint inside a `$$` body; seven `CREATE UNIQUE INDEX` with bits 1..64; journal `idx: 7`; snapshot chained to `0006`; the `0007` snapshot has no `Grupo`. Spec: AC-MIG, AC-AUDH, AC-GATE. Fails on the draft (no lock, no backfill, order).
- [ ] 3.13 GREEN replace the body of `drizzle/0007_merge_grupo_into_asignatura.sql` with MG-7 steps 1, 3-9, 11 and 12 (lock, expand, rank, old-unique drop, A1, backfill, re-point, contract, drop); object names taken from the draft; snapshot and journal kept as generated. Q:O7 (A2 ranking), Q:O9 (origin lookup for group-less subjects). Spec: AC-MIG, AC-COLL, AC-ACT. Design: MG-6, MG-7, MG-8.
- [ ] 3.14 Measure final (stop rule; seam in the phase header).
- [ ] 3.15 V (`npx vitest run src/db src/lib/data/catalog.test.ts src/lib/catalog`; full `npm test`; typecheck; eslint; `npm run build` after the dev-server check).
- [ ] 3.16 [USER] Checkpoint M03. Look at: ten columns, no unique on `Codigo` alone, seven indexes from one helper, SQL order, bridges listed in apply-progress.md. Restate: this branch never runs against production from now. Commit by hand.

## Phase 4: M04 Guards, assertions, documents (~480)

- [ ] 4.1 Baseline paths: the `0007` SQL, `migration-0007.test.ts`, `modelo_datos_sql.md`, `openspec/changes/merge-grupo-into-asignatura/runbook-0007.md` (new).
- [ ] 4.2 RED guard block pin: after the advisory lock and before the first `ALTER`, one `DO` block raising `P0001` for G-a (a non-carried group has `Inscripcion` rows), G-b (carried-over active classes of one code share a docente and a day), G-c (a `Periodo` outside the expected format or a NULL where NOT NULL is assumed), G-d (a foreign key other than `Inscripcion`'s references `Grupo`), and **G-e (unresolvable A2 tie, Q:S1)**; each message lists the offending rows with `string_agg`. Spec: AC-PRE, AC-COLL (tie). Design: MG-7 guards.
- [ ] 4.3 RED assertions block pin: one `DO` block between re-point and contract checking every rank-1 group has a class row equal field by field, no NULL `NumeroGrupo`, no NULL `Inscripcion.AsignaturaId`, the row count equals subjects-without-group plus rank-1 groups, no code with more than one distinct (`Nombre`, `CarreraId`, `HorasTotales`). Spec: AC-D9, AC-MIG.
- [ ] 4.4 RED consistency pin: every index, constraint, FK and PK name the `0007` snapshot holds for `Asignatura` and `Inscripcion` and `0006` does not is created by the SQL; every such name `0006` holds and `0007` does not is dropped or belongs to `Grupo`. Design: MG-6 consistency pin. If it passes at once it is a characterization, proven in 4.8.
- [ ] 4.5 Measure after RED.
- [ ] 4.6 GREEN guards in the SQL (G-a..G-e).
- [ ] 4.7 GREEN assertions in the SQL.
- [ ] 4.8 Mutation check for 4.4: rename one constraint in the SQL, the pin fails, restore.
- [ ] 4.9 Rewrite `modelo_datos_sql.md`: `Asignatura` (ten columns, key, seven indexes), `Inscripcion.AsignaturaId`, `SolicitudDetalle.GrupoId` becomes `AsignaturaId`, `Grupo` and `Periodo` removed, the two import-payload shapes (old with `Grupo`, new without) and the note that stored `grupo.*` audit ids refer to dropped rows. Verify: `rg -n "Grupo|Periodo" modelo_datos_sql.md` shows only deliberate historical mentions. Design: MG-22, MG-23.
- [ ] 4.10 Create `runbook-0007.md` (text only, nothing runs): P1-P12, V1-V8 and the probe scripts of MG-G13 (each ending in `ROLLBACK`). Spec: AC-PRE (the preflight "MUST exist"). Design: Migration / Rollout.
- [ ] 4.11 [USER][CONFIRM] MG-G4 drift check: `npm run db:generate` a second time must report nothing to generate. Files only. If it writes a file, delete that file, stop and report the difference.
- [ ] 4.12 [READ-ONLY] Compute the SHA-256 of the `0007` SQL as in the working tree and with CRLF normalized to LF; record both in apply-progress.md and the runbook. Any later edit of the file restarts at 4.15.
- [ ] 4.13 Measure final.
- [ ] 4.14 V (`npx vitest run src/db`; full `npm test`; typecheck; eslint; build).
- [ ] 4.15 [USER][GATE] MG-G5 and Checkpoint M04. Q:O3 (a class row keeps no term record). Owner approves in writing the hand-written SQL and the `schema.ts` diff; freeze recorded (4.12). Commit by hand. Opens Phase 5.

## Phase 5: Rehearsal gates MG-G6 to MG-G14 (owner-paced; runs beside Phases 6-10)

Every task is its own command; HC before each write; the owner runs them. Phases 6-10 need no database. Any gate that fails stops here: fix, re-freeze, restart at 4.15.

- [ ] 5.1 [USER] Confirm the procedure: HOST-PROD recorded (0.13); a shell-scoped `DATABASE_URL` for each rehearsal command; `.env` never edited.
- [ ] 5.2 [USER][CONFIRM] MG-G6. Create Neon branch `rehearsal-0007-neg` from `production`. HC.
- [ ] 5.3 [READ-ONLY] Prepare the exact SQL for 5.4 after a read-only look at the three groups. With 3 groups and 3 subjects the one `UPDATE` must also re-parent one group (`AsignaturaId`) and set the same docente and `Dias` as another so that two active groups of one code share a docente and a day. Verify: SQL shown to the owner before 5.4.
- [ ] 5.4 [USER][CONFIRM] MG-G7. On `rehearsal-0007-neg` run that one `UPDATE`. HC.
- [ ] 5.5 [USER][CONFIRM] MG-G8. `npm run db:migrate` against `rehearsal-0007-neg` (expected to fail). HC. Verify: it stops with the guard G-b message naming both groups.
- [ ] 5.6 [READ-ONLY] After 5.5 on `rehearsal-0007-neg`: `Asignatura` has no `NumeroGrupo` column, `Grupo` exists, the migration table holds seven rows. Proves the guard and the atomicity (AC-MIG "A failure leaves the schema as before").
- [ ] 5.7 [USER][CONFIRM] MG-G9. Delete `rehearsal-0007-neg`. HC.
- [ ] 5.8 [USER][CONFIRM] MG-G10. Create a fresh branch `rehearsal-0007` from `production`. HC.
- [ ] 5.9 [USER][CONFIRM] MG-G11. `npm run db:migrate` against `rehearsal-0007`. HC. Verify: success.
- [ ] 5.10 [READ-ONLY] MG-G12. V1-V8 on `rehearsal-0007`; write the rehearsal report in apply-progress.md: groups per period, groups not carried over (none expected), `Inscripcion` count before and after (0 and 0), no docente names. Spec: AC-GATE (report complete).
- [ ] 5.11 [USER][CONFIRM] MG-G13 (a). One probe script on `rehearsal-0007`, each case its own transaction ending in `ROLLBACK`: each of the seven weekday indexes refuses a same-code, same-docente, same-day pair with `23505` naming the index. HC. Spec: AC-DBRULE.
- [ ] 5.12 [USER][CONFIRM] MG-G13 (b). Allowed states do not collide: null docente, `Dias = 0`, an inactive row, the same docente on the same day in two codes, the same docente on disjoint days. All `ROLLBACK`. HC. Spec: AC-DBRULE (allowed states).
- [ ] 5.13 [USER][CONFIRM] MG-G13 (c). A repeated (`Codigo`, `NumeroGrupo`) is refused; both CHECKs fire; an insert omitting `Dias`, `Origen`, `Activo` stores the defaults. All `ROLLBACK`. HC.
- [ ] 5.14 [USER][CONFIRM] MG-G13 (d). A direct docente swap fails on the non-deferrable index; the clear-then-assign order of MG-21 succeeds. `ROLLBACK`. HC. Spec: CEI-ORDER.
- [ ] 5.15 [USER][CONFIRM] MG-G13 (e). A throwaway script outside the repository, using the application's driver, runs the violating insert in a transaction and prints `error.cause.code` and `error.cause.constraint_name`, then `ROLLBACK`. HC. Verify: if `constraint_name` is absent the backstop of MG-11 falls to the generic message (record it for task 14.5).
- [ ] 5.16 [READ-ONLY] MG-G13 (f). Row counts of every table equal before and after the probes.
- [ ] 5.17 [USER][GATE] MG-G14. Owner approves the rehearsal report. `rehearsal-0007` becomes the **development database** of every later slice; each smoke that writes to it is its own confirmed step. Closes Read first item 3's opening. Blocks Phase 22.

## Phase 6: M05 Remove the tests that scan Grupo sources (~310)

Rule: a test or pin that reads a source file by path is removed or edited no later than the slice that deletes that file (design, removal rule).

- [ ] 6.1 Baseline: record `git diff --numstat` of `src/i18n/catalog-parity.test.ts` and `src/app/(dashboard)/catalog/audit-leak.test.ts`.
- [ ] 6.2 [READ-ONLY] Read both tests; list the describes that read `catalog/grupos/*.tsx` and `grupos/actions.ts`, and the Grupo cases of `audit-leak`. Verify: list recorded.
- [ ] 6.3 Characterization: remove the two parity describes that read `grupos/*.tsx` and `grupos/actions.ts`. Proof: suite stays green.
- [ ] 6.4 Characterization: remove the Grupo cases of `audit-leak.test.ts`, keep the Asignatura and import cases. Proof: suite stays green.
- [ ] 6.5 Mutation check: spread a data-layer result into an Asignatura audit payload, the kept leak pin fails; restore.
- [ ] 6.6 Measure.
- [ ] 6.7 V.
- [ ] 6.8 [USER] Checkpoint M05. Look at: only describes that read soon-deleted files left. Commit by hand.

## Phase 7: M06 Remove the Grupos section (~515)

- [ ] 7.1 Baseline paths: `asignaturas/asignatura-grupos-section.tsx` (185, counts 1 when deleted), `asignaturas/[id]/edit/page.tsx`, its `page.test.tsx` (943), `src/lib/catalog/list-params.ts`, `i18n/es.json`, `i18n/en.json`, `catalog-parity.test.ts`.
- [ ] 7.2 RED edit page test: no Grupos section and no "Add group" link (remove the section describes in the same edit). Spec: CM-RTE-1 ("Edit page has no Grupos section"), CM-ASG-7 removed. Fails: the section renders.
- [ ] 7.3 RED parity pin: `catalog.asignaturas.grupos.*` absent from both catalogs. Spec: CM-I18N-1.
- [ ] 7.4 Measure after RED.
- [ ] 7.5 GREEN edit page stops rendering the section and its reader; delete `asignatura-grupos-section.tsx`; remove `ASIGNATURA_GRUPOS_MAX`. The `grupos.ts` reader stays until Phase 9.
- [ ] 7.6 GREEN remove `catalog.asignaturas.grupos.*` from `es` and `en`.
- [ ] 7.7 Measure final.
- [ ] 7.8 V.
- [ ] 7.9 [USER] Checkpoint M06. Look at: nothing else on the edit page moved; State section intact. Commit by hand.

## Phase 8: M07 Remove `catalog/grupos/**` and the sidebar entry (~100)

Eleven files deleted whole: `grupos/page.tsx`, `page.test.tsx`, `new/page.tsx`, `new/page.test.tsx`, `[id]/edit/page.tsx`, `[id]/edit/page.test.tsx`, `grupo-form.tsx`, `grupo-form.test.tsx`, `actions.ts`, `actions.test.ts`, `bound-controls.tsx` (11 items by the counting rule).

- [ ] 8.1 Baseline; confirm the eleven files with Glob; `rg -n "catalog/grupos" src` recorded.
- [ ] 8.2 RED `guards.test.ts`: segments `["asignaturas","docentes"]`, exactly one actions module, and a new pin that the directory `catalog/grupos` does not exist. Q:O6 (removed URLs show the framework 404; no redirect, no catch-all). Spec: CM-RTE-1. Fails: directory exists.
- [ ] 8.3 RED `current-marker-usage.test.ts`: two breadcrumb pages and one form. Fails: Grupo pages and form still listed.
- [ ] 8.4 RED `app-sidebar.test.tsx`: ordered children `catalogAsignaturas`, `catalogDocentes`, `catalogImport`, `users` for the five roles, single `aria-current`, no Grupos entry. Spec: CM-NAV-1. Design: MG-18.
- [ ] 8.5 GREEN delete the eleven files; remove the entry from `app-sidebar.tsx`.
- [ ] 8.6 GREEN remove `nav.catalogGrupos` from `es`, `en` and `GUARDED_SECTIONS`.
- [ ] 8.7 Mutation checks: recreate an empty `grupos/page.tsx` (8.2 fails); write the marker in the form (8.3 fails); restore.
- [ ] 8.8 [READ-ONLY] `rg -n "catalog/grupos|grupos/" src` shows no live reference (links, `revalidatePath`, tests); fix the leftovers in this slice.
- [ ] 8.9 Measure.
- [ ] 8.10 V including `npm run build` (routes removed).
- [ ] 8.11 [USER] Checkpoint M07. Look at: a directory-sized deletion with 11 items and about 90 edited lines. Commit by hand.

## Phase 9: M08 Remove Grupo copy and the Grupo data layer (~480)

- [ ] 9.1 Baseline paths: `src/lib/catalog/list-params.ts` (+test), `catalog-parity.test.ts`, `i18n/*.json`, `catalog-structure.test.ts`, `scope-inventory.test.ts`; `src/lib/data/grupos.ts` (385) and `grupos.test.ts` (1,152) count 1 each when deleted.
- [ ] 9.2 RED `list-params` test: `CatalogListBase` has no `/catalog/grupos`. Fails: it does.
- [ ] 9.3 RED parity: `GUARDED_SECTIONS` loses `catalog.grupos` and `catalog.grupos.errors`; the Grupo copy describe is removed.
- [ ] 9.4 GREEN remove `catalog.grupos` copy from `es` and `en`; `CatalogListBase` loses the path.
- [ ] 9.5 Characterization: `catalog-structure.test.ts` drops `grupos.ts` from its lists; the Grupo describe becomes `asignaturas.ts` never mentions `inscripcion` and `buildAsignaturasWhere` never mentions `dias` (the `setAsignaturaActivo` pin lands in 15.9); `scope-inventory.test.ts` drops the `grupos.ts` module entry. Pins that only lose entries cannot be RED; proven in 9.7.
- [ ] 9.6 `rg "data/grupos"` shows no importer left; delete `grupos.ts` and `grupos.test.ts`.
- [ ] 9.7 Mutation checks: add `.delete(` to `asignaturas.ts`, add a second `.transaction(`, write `origen` in a `.set(`; each fails a pin; restore.
- [ ] 9.8 Measure.
- [ ] 9.9 V.
- [ ] 9.10 [USER] Checkpoint M08. Look at: two whole-file deletions counted as 2, pins kept honest. Commit by hand.

## Phase 10: M09 Retire Grupo audit, validation and types (~770)

Fallback seam: stop after 10.7 (audit); move 10.8-10.9 to a new slice. Keep copy still used by the Asignatura flow: `activeGrupos`, `state.activeGroups`, `columns.groups` (removed in 15.8, 21.7, 18.7) and `numGrupo.taken*`, `docenteId.invalid`, `dias.*` (reworded or reused later).

- [ ] 10.1 Baseline paths: `src/lib/audit/{types,events}.ts` + tests, `src/lib/validations/catalog.ts` + test, `catalog-scope-sql.ts` + test, `src/lib/catalog/types.ts`, `i18n/*.json`.
- [ ] 10.2 RED `types.test.ts`: `AuditEvent` has no `grupo.*` action and no entity `"Grupo"` (negative type tests); `HISTORICAL_AUDIT_ACTIONS` lists the four retired actions with the note that their `EntidadId` values are ids of the dropped table; disjoint from the emit list; no builder returns a historical action. Spec: AL-RET. Design: MG-23.
- [ ] 10.3 RED `validations/catalog.test.ts`: `grupoCreateSchema` and `grupoUpdateSchema` absent; `CATALOG_FIELD_ERROR_KEYS` loses `asignaturaId.*`, `periodo.*`, `docenteId.required`.
- [ ] 10.4 RED `catalog-scope-sql.test.ts`: no `grupoRowInScope` export.
- [ ] 10.5 Measure after RED.
- [ ] 10.6 GREEN `audit/types.ts`: historical constant; `AUDITABLE_GRUPO_FIELDS` and Grupo leave the emit union.
- [ ] 10.7 GREEN `audit/events.ts`: remove the four Grupo builders and their describes in `events.test.ts`.
- [ ] 10.8 GREEN validations: remove the Grupo schemas; remove the keys of 10.3 and `parentInactive.asignatura` from `es` and `en`.
- [ ] 10.9 GREEN remove `grupoRowInScope` and the Grupo types and result unions of `catalog/types.ts`.
- [ ] 10.10 Mutation checks: reintroduce a `grupo.creado` event literal and `grupoRowInScope`; the pins fail; restore.
- [ ] 10.11 [READ-ONLY] `rg -n -i "grupo" src` triage recorded: each remaining hit is the Asignatura flow, `numeroGrupo`, the historical constant, the legacy table file or the old import (removed later).
- [ ] 10.12 Measure final (stop rule).
- [ ] 10.13 V.
- [ ] 10.14 [USER] Checkpoint M09. Look at: emission of a `grupo.*` event is a compile error; stored names remain discoverable. Commit by hand.

## Phase 11: M10 Audit for class events (~450)

Unions are added to, not trimmed: `has_active_groups` and the old shapes stay until their producers change (Phases 14-15).

- [ ] 11.1 Baseline paths: `src/lib/audit/{types,events}.ts` + tests, `src/lib/catalog/types.ts`.
- [ ] 11.2 RED `types.test.ts`: `AUDITABLE_ASIGNATURA_FIELDS` equals `codigo, nombre, carreraId, horasTotales, activo, numeroGrupo, docenteId, dias, origen` in column order. Spec: AL-PAY (closed list). Design: MG-23.
- [ ] 11.3 RED `events.test.ts`: `created` reports the whole list; `updated` reports `changedFields` over `nombre, carreraId, horasTotales, docenteId, dias` (a days reselection in another order is not a change); a state change reports `["activo"]`; `asignaturaPropagatedEvent` carries `propagadaDesde: <id>` only there; payloads hold field names and ids only (no docente id, name or email, no day, no count). Spec: AL-PAY, AL-PROP, AL-SET.
- [ ] 11.4 RED `asignaturaWriteEvents`: `updated` emits `1 + propagadas.length` events; `created` one; every refusal, `unchanged` and `confirm_propagation` emit none; negative type tests for the unions of the Interfaces section; `CatalogFormState` gains `{kind:"confirm", afectadas}`. Spec: AL-ONE, CM-AUD-1.
- [ ] 11.5 Measure after RED.
- [ ] 11.6 GREEN `audit/types.ts`, `events.ts`: field list, `asignaturaPropagatedEvent`, `asignaturaWriteEvents`.
- [ ] 11.7 GREEN `catalog/types.ts`: `AsignaturaWriteResult`, `AsignaturaActiveResult`, `DocenteConflicto`, `CatalogFormState` addition (superset; bridge members marked `// bridge: removed in Phase 15`).
- [ ] 11.8 Measure final.
- [ ] 11.9 V.
- [ ] 11.10 [USER] Checkpoint M10. Look at: no value in any payload; one audit row per affected class. Commit by hand.

## Phase 12: M11 Scope helper and manual schemas (~550)

- [ ] 12.1 Baseline paths: `catalog-scope-sql.ts` (+test), `src/lib/validations/catalog.ts` (+test), `i18n/*.json`, `catalog-parity.test.ts`.
- [ ] 12.2 RED `asignaturaCodigoInScope` for the three scope kinds (unscoped, scoped by carrera, coordinacion without carrera) through `toSQL()`: `"Codigo" = $1 AND <scope>`. Spec: CM-SCOPE-1, CM-SCOPE-2. Design: MG-10.
- [ ] 12.3 RED the three schemas, table-driven from CM-ASG-1: `asignaturaCreateSchema` (codigo, numeroGrupo, nombre, carreraId?, horasTotales, docenteId id-or-null, dias at least one); `asignaturaAddGrupoSchema` (codigo, numeroGrupo, docenteId, dias; subject fields stripped); `asignaturaUpdateSchema` (nombre, carreraId?, horasTotales, docenteId, dias; a submitted `codigo` or `numeroGrupo` is stripped). Trimming, 32/12/160 limits, `"01"` kept as `"01"`, blank or missing docente is `null`, a `File` or malformed id is `docenteId.invalid`, no day is `dias.required`, a day outside the seven is `dias.invalid`. Spec: CM-ASG-1, CM-ASG-2 (key cannot be edited), CM-ASG-6, CM-ASG-9, AC-ASG, AC-CODE, AC-DIAS. Design: MG-17.
- [ ] 12.4 RED parity pin: `CATALOG_FIELD_ERROR_KEYS` adds `codigo.exists`; `numGrupo.taken` and `takenInactive` reworded for "this subject" without a period. Show RED before authoring copy.
- [ ] 12.5 Measure after RED.
- [ ] 12.6 GREEN `asignaturaCodigoInScope` in `catalog-scope-sql.ts`.
- [ ] 12.7 GREEN the three schemas under their final names.
- [ ] 12.8 Bridge: rename the previous `asignaturaCreateSchema` and `asignaturaUpdateSchema` to `legacyAsignaturaCreateSchema` and `legacyAsignaturaUpdateSchema`, fix the two importers listed by `tsc` (`asignaturas/actions.ts` and its test), marked `// bridge: removed in Phase 17`.
- [ ] 12.9 GREEN author only the keys 12.4 pins, in `es` and `en`.
- [ ] 12.10 Measure final.
- [ ] 12.11 V.
- [ ] 12.12 [USER] Checkpoint M11. Look at: the schemas strip rather than trust the key fields; docente blank is null. Commit by hand.

## Phase 13: M12 Data reads (~650)

- [ ] 13.1 Baseline paths: `src/lib/data/asignaturas.ts` (+test), `src/lib/catalog/types.ts`, `scope-inventory.test.ts`, the Asignatura `page.tsx` and edit `page.tsx`.
- [ ] 13.2 RED `asignaturas.test.ts` list: `buildAsignaturasWhere(scope, {status, q})` searches `Codigo`, `Nombre`, `NumeroGrupo` and the docente name (Q:S6) with `%` and `_` escaped, never mentions `dias`, carries the scope predicate; `listAsignaturas` counts and pages with `LEFT JOIN "Usuario"`, orders by `Codigo`, `length("NumeroGrupo")`, `NumeroGrupo`, `Id` (Q:S7), is fail-soft, returns `AsignaturaListItem` with `dias` decoded to week order (the mask never leaves the data layer). Spec: CM-ASG-12, CM-LST-1, CM-SCOPE-1, AC-DIAS. Design: MG-10, MG-16.
- [ ] 13.3 RED `getAsignaturaById` returns the class plus `hermanas` (OTHER rows of its code), not fail-soft; `getSubjectByCodigo(scope, codigo)` returns subject fields and existing group numbers and `null` for a missing and a foreign code alike. Spec: CM-SCOPE-1 (foreign by id). Design: MG-10; threat: existence disclosure.
- [ ] 13.4 RED `scope-inventory.test.ts`: a row for `getSubjectByCodigo`; `listAsignaturaOptions` row removed. Pins that lose entries are proven in 13.9.
- [ ] 13.5 Measure after RED.
- [ ] 13.6 GREEN the reads in `asignaturas.ts`; delete `listAsignaturaOptions`.
- [ ] 13.7 GREEN `catalog/types.ts`: `AsignaturaListItem`, `AsignaturaDetail`, `SubjectOfCodigo`.
- [ ] 13.8 Forced fixes: the aggregated "groups" column leaves the list page and the edit page's group count; adapt only what `tsc` lists, marked `// bridge: removed in Phase 18` and `Phase 21`.
- [ ] 13.9 Mutation check: export a function from `asignaturas.ts` with no inventory row; the pin fails; restore.
- [ ] 13.10 Measure final.
- [ ] 13.11 V.
- [ ] 13.12 [USER] Checkpoint M12. Look at: the scope predicate on every statement; `null` for foreign codes. Commit by hand.

## Phase 14: M13 Data writes I: create and add group (~750)

Fallback seam: `addGrupo` (14.4, 14.8) moves to the head of Phase 15.

- [ ] 14.1 Baseline paths: `asignaturas.ts` (+test), `scope-inventory.test.ts`. [READ-ONLY] read the deleted docente-availability check with `git show HEAD:src/lib/data/grupos.ts` to re-implement it here.
- [ ] 14.2 [USER] Q:S5. Confirm the default: `createAsignatura` refuses an existing code (`codigo_taken` with `inScope`), and a class for an existing code is created through `addGrupo` with the subject fields copied from the stored rows (read-only in the form).
- [ ] 14.3 RED `createAsignatura` with a `tx` double: scope sentinel on every statement naming `Asignatura`; a code existing inside scope gives `codigo_taken{inScope:true}` and an outside-scope one `{inScope:false}`, neither inserts; coordinacion forced to own carrera, foreign carrera is `carrera_invalid`; the docente table of AC-ACTDOC (inactive refused, none accepted, non-docente roles refused, unknown refused) gives `docente_unavailable`; the insert carries `origen:"manual"`, `activo:true`, the encoded mask; a `23505` on `UQ_Asignatura_Clase` gives `clase_taken`. Spec: CM-ASG-1, CM-ASG-2, CM-ASG-13, AC-DOC, AC-ACTDOC, AC-ORIG, CM-SCOPE-3.
- [ ] 14.4 RED `addGrupo`: all rows of the code read inside scope; none gives `codigo_unavailable`; subject fields copied from the stored rows, submitted ones ignored; stored rows that disagree refuse with the generic message and one log line `catalog.subject.inconsistent` (code only); (code, group) existing gives `clase_taken{activo}`; docente rule through `docente-rule.ts` gives `docente_conflict` naming the group and shared days only from scoped sibling rows, the generic variant otherwise. Spec: AC-D9, AC-RULE, CM-ASG-10, CM-ASG-11 (new group). Design: MG-12, MG-13.
- [ ] 14.5 RED the `23505` backstop: `UX_Asignatura_Docente_<Dia>` gives `docente_conflict{numeroGrupo:null, dias:[dia]}`; any other constraint or none is rethrown with one sanitised log line; a refusal issues no insert. Uses the 5.15 finding about `constraint_name`. Spec: CM-ASG-10 (race), CM-ASG-2 (concurrent duplicate). Design: MG-11.
- [ ] 14.6 Measure after RED.
- [ ] 14.7 GREEN `createAsignatura` (removes the Phase 3 bridge `numeroGrupo: "1"`).
- [ ] 14.8 GREEN `addGrupo` and the docente availability check.
- [ ] 14.9 Forced fixes: the existing action's call site adapts to the new input and result kinds, marked `// bridge: removed in Phase 16`.
- [ ] 14.10 `scope-inventory.test.ts` row for `addGrupo`; mutation check: remove the row, the pin fails; restore.
- [ ] 14.11 Measure final (stop rule).
- [ ] 14.12 V.
- [ ] 14.13 [USER] Checkpoint M13. Look at: every refusal issues no insert; lock held before the sibling read; subject fields never taken from the form. Commit by hand.

## Phase 15: M14 Data writes II: update, propagation, state (~750)

Fallback seam: `setAsignaturaActivo` (15.5, 15.8) moves to a new slice.

- [ ] 15.1 Baseline paths: `asignaturas.ts` (+test), `catalog-structure.test.ts`, `catalog/types.ts`.
- [ ] 15.2 [USER] Q:O5 (default: no "reactivate without docente"), Q:S8 (default: confirmation enforced on the server). Record the answers.
- [ ] 15.3 RED `updateAsignatura` (`tx` double), MG-12 steps 1-7: `not_found` on 0 rows; `inactive`; own diff over `docenteId, dias`, subject diff over `nombre, carreraId, horasTotales`; both empty is `unchanged` with no write; subject diff with siblings and no `propagar` gives `confirm_propagation{afectadas}` with no update (Q:S8); `carrera_invalid`; `docente_unavailable` only when the docente changed (an unchanged inactive docente is exempt); docente rule against active siblings when docente or days changed gives `docente_conflict`; a coordinacion cannot change `carreraId`. Spec: CM-ASG-3, CM-ASG-10, CM-ASG-11, AC-ACTDOC, AC-RULE, CM-SCOPE-3.
- [ ] 15.4 RED propagation (steps 8-10): own `UPDATE` carries the scope; sibling `UPDATE` uses `asignaturaCodigoInScope`; exactly two updates; a returned count different from the siblings read throws (rollback); returns `updated{id, campos, propagadas}`; a docente or days edit alone propagates nothing; a subject edit cannot create a docente conflict. Spec: CM-ASG-11 (all scenarios), CM-NFR-2, AL-PROP, AC-D9. Threat: cross-scope propagation.
- [ ] 15.5 RED `setAsignaturaActivo`: deactivation always allowed (inscripciones present, last active class, docente state irrelevant), already inactive is `unchanged`; reactivation requires an available docente when there is one (`docente_unavailable`), then the docente rule (`docente_conflict` naming the group), no docente means no check; the `SET` names only `activo`; no other class changes. Spec: CM-ASG-4, CM-ASG-5, AC-LIFE, AC-RULE (reactivation).
- [ ] 15.6 Measure after RED.
- [ ] 15.7 GREEN `updateAsignatura`.
- [ ] 15.8 GREEN `setAsignaturaActivo`; remove `has_active_groups` from the unions (the Phase 11 bridge) and its producer.
- [ ] 15.9 Structural pins in `catalog-structure.test.ts`: `setAsignaturaActivo` sets only `activo`. Proven by mutation: add `origen` to the `.set(`; the pin fails; restore. Spec: CM-NFR-1 (no delete).
- [ ] 15.10 Forced fixes: the action call sites map the new result kinds, marked `// bridge: removed in Phase 17`.
- [ ] 15.11 Measure final (stop rule).
- [ ] 15.12 V.
- [ ] 15.13 [USER] Checkpoint M14. Look at: the propagation count check, audit shape, the scope predicate on the sibling update. Commit by hand.

## Phase 16: M15 Actions I: create and add group (~700)

- [ ] 16.1 Baseline paths: `asignaturas/actions.ts`, `actions.test.ts` (850; the create describes are rewritten here, the update and state describes in Phase 17), `i18n/*.json`, `catalog-parity.test.ts`. Re-check N2 and N4 (`notFound`/`redirect` outside any `try`, literal `revalidatePath`).
- [ ] 16.2 RED `createAsignaturaAction`: `requireCatalogAccess()` is the first await and no form field is read before it; denied roles redirect, body never read; schema failures keep the values; `codigo_taken{inScope:true}` shows `codigo.exists` under the code field, `{inScope:false}` the generic `codigo.taken`; `clase_taken` shows `numGrupo.taken` (or `takenInactive` pointing to reactivation) under the group field; `docente_conflict` is an error on the docente field with `{grupo}` and `{dias}` (generic variant without a group), `docente_unavailable`, `carrera_invalid`, busy; success writes the events through `asignaturaWriteEvents`, then `revalidatePath` and `redirect` outside `try`; no audit for any refusal. Spec: CM-ACC-1, CM-ACC-2, CM-ASG-1, CM-ASG-2, CM-ASG-10, CM-NFR-4, CM-AUD-1, AL-ONE.
- [ ] 16.3 RED `addGrupoAction`: posts only `codigo, numeroGrupo, docenteId, dias`; hand-crafted `nombre`, `carreraId`, `horasTotales` never reach the data layer; the lock-free pre-check (`getSubjectByCodigo`) answers a foreign and a missing code with the same "gone" outcome without taking the lock. Threat: object reference, hand-crafted form.
- [ ] 16.4 RED parity pin for `catalog.shared.refusals.{docenteConflict, docenteConflictGeneric}` taking `{grupo}` and `{dias}`; the English text of CM-ASG-10 ("This docente already teaches group 1 of this subject on a shared day. Choose another docente or change the days."). Show RED first.
- [ ] 16.5 Measure after RED.
- [ ] 16.6 GREEN `createAsignaturaAction` and `addGrupoAction` (removes the Phase 14 bridge).
- [ ] 16.7 GREEN author only the keys 16.4 pins, in `es` and `en`.
- [ ] 16.8 Measure final.
- [ ] 16.9 V (guards suite runs `getAll("dias")` before/after the guard check; extend it RED if `getAll` before the guard is not caught).
- [ ] 16.10 [USER] Checkpoint M15. Look at: guard first, scoped pre-check, no audit on refusal. Commit by hand.

## Phase 17: M16 Actions II and the leak sweep (~780)

Fallback seam: the `audit-leak` rewrite (17.4) moves to the head of Phase 18.

- [ ] 17.1 Baseline paths: `asignaturas/actions.ts`, `actions.test.ts`, `audit-leak.test.ts` (506), `src/lib/validations/catalog.ts`, `i18n/*.json`.
- [ ] 17.2 RED `updateAsignaturaAction`: guard first; `getAsignaturaById` null is "gone"; a submitted `codigo` or `numeroGrupo` is ignored; a first submit that changes a subject field of a code with siblings returns `{kind:"confirm", afectadas}` with no write and no audit; `propagar=si` writes; `propagar=si` with no subject change writes nothing (the flag only permits); no change gives the "no changes" state; an inactive class is refused with "reactivate first"; docente conflict on the docente field; busy; success redirects outside `try`. Spec: CM-ASG-2, CM-ASG-3, CM-ASG-11, CM-NFR-2, S8. Threat: hand-crafted form.
- [ ] 17.3 RED `setAsignaturaActivoAction`: no `has_active_groups` mapping; `docente_unavailable` names the docente; `docente_conflict` names the group; `unchanged` messages; revalidation. Spec: CM-ASG-4, CM-ASG-5, CM-UX-1.
- [ ] 17.4 RED `audit-leak.test.ts` rewritten over create, add group, update and state (the import preview and apply cases follow in 31.11, completing the six actions): sentinels for group number, docente name and email, days (code, long name, mask), a sibling's group number; a propagated edit's events hold field names and ids only. Spec: AL-PAY, AL-PROP, CM-AUD-1. Design: MG-23.
- [ ] 17.5 Measure after RED.
- [ ] 17.6 GREEN `updateAsignaturaAction` and `setAsignaturaActivoAction` (removes the Phase 15 bridge).
- [ ] 17.7 Characterization: the leak sweep is proven by mutation (spread a data-layer result into a payload; it fails; restore).
- [ ] 17.8 Remove the `legacyAsignatura*Schema` bridge of 12.8 and its importers.
- [ ] 17.9 Author only the keys the new action tests render; parity RED first.
- [ ] 17.10 Measure final (stop rule).
- [ ] 17.11 V.
- [ ] 17.12 [USER] Checkpoint M16. Look at: propagation confirmation enforced on the server; no value in any payload. Commit by hand.

## Phase 18: M17 List page (~700)

- [ ] 18.1 Baseline paths: `asignaturas/page.tsx`, `page.test.tsx` (524), `i18n/*.json`, `catalog-parity.test.ts`.
- [ ] 18.2 [USER] Q:O11. Default: keep the Hours column (nine columns).
- [ ] 18.3 RED `page.test.tsx` (five-role table of CM-ACC-1): columns code, group, name, career, hours, docente, days, status plus one "Edit" link whose `aria-label` names code and group; the docente cell shows `-` when none (spec CM-ASG-12; MG-16 differs, see the differences note); `DiasCell` short visible, long for assistive technology, "days not set" with no error styling; status as a word; search over code, name, group, docente; filters; pagination clamps; fail-soft message; no mutation by GET (links only). Spec: CM-ASG-12, CM-LST-1, CM-UX-1 (GET never mutates), CM-SCOPE-2 (empty state). Design: MG-16.
- [ ] 18.4 RED parity: list keys `catalog.asignaturas.columns.{group, docente, dias}`, `noDocente`; `columns.groups` absent. Parity RED first.
- [ ] 18.5 Measure after RED.
- [ ] 18.6 GREEN `page.tsx` (removes the Phase 13 bridge).
- [ ] 18.7 GREEN author only the keys 18.4 pins; remove `columns.groups`.
- [ ] 18.8 Measure final (nine columns at 360px is checked in the smoke).
- [ ] 18.9 V.
- [ ] 18.10 [USER] Checkpoint M17. Look at: column order, the hyphen, days cell. Commit by hand.

## Phase 19: M18 Form: create and edit (~650)

- [ ] 19.1 Baseline paths: `asignatura-form.tsx`, `asignatura-form.test.tsx` (472), `i18n/*.json`, `catalog-parity.test.ts`.
- [ ] 19.2 RED create mode (FT): code and group inputs, name, career (fixed for coordinacion), hours, the `Combobox` with a first option "No docente" (value `""`) and an optional label, the days `CheckboxGroup` with at least one day; values kept after `invalid`; errors under fields with `role="alert"`; the docente-rule error on the docente field. Spec: CM-ASG-1, CM-ASG-9 (control accessible), CM-ASG-10, CM-I18N-1. Design: MG-17.
- [ ] 19.3 RED edit mode: code and group number rendered as text (A9) and absent from the update payload; docente clearable; a class with an empty set of days shows none selected and no error until submit, then `dias.required`. Spec: CM-ASG-2, CM-ASG-3, CM-ASG-9.
- [ ] 19.4 RED parity form keys: `catalog.asignaturas.form.{numeroGrupoLabel, docenteLabel, docenteNone, diasLabel, diasHint, searchPlaceholder, noMatches, truncated}`. Parity RED first.
- [ ] 19.5 Measure after RED.
- [ ] 19.6 GREEN the form (create and edit). If the empty-value item misbehaves under jsdom use the design's fallback (a separate "No docente" checkbox that disables the combobox, no new token) and record it.
- [ ] 19.7 GREEN author only the keys 19.4 pins.
- [ ] 19.8 Measure final.
- [ ] 19.9 V.
- [ ] 19.10 [USER] Checkpoint M18. Look at: keyboard path, focus order, no new token or primitive. Commit by hand.

## Phase 20: M19 Form: add-group mode and propagation block (~500)

- [ ] 20.1 Baseline paths: `asignatura-form.tsx`, `asignatura-form.test.tsx`, `active-toggle.tsx` (read the pattern only), `i18n/*.json`.
- [ ] 20.2 RED `add-group` mode: code as text plus a hidden field; group number input; name, career and hours as read-only text with visible labels (not disabled inputs); the existing group numbers listed; only `codigo, numeroGrupo, docenteId, dias` are posted. Spec: CM-ASG-11 (new group), AC-D9. Design: MG-17, MG-12.
- [ ] 20.3 RED propagation block (FT): on a `confirm` state an inline two-step block states how many OTHER classes will change, with a confirm button (default variant) and a cancel; focus moves to confirm; the result is announced through `aria-live`; cancel restores the form with no write; confirm resubmits the same fields plus `propagar=si`; values kept. Spec: CM-ASG-11, CM-UX-1, CM-I18N-1 (propagating-edit confirmation row).
- [ ] 20.4 Measure after RED.
- [ ] 20.5 GREEN add-group mode and the propagation block (pattern of `active-toggle.tsx`, no Dialog, AlertDialog or Tabs).
- [ ] 20.6 GREEN author only the keys the tests render: `form.{subjectFromCode, existingGroups}`, `propagation.{title, body, confirm, cancel}` with an ICU count; parity RED first.
- [ ] 20.7 [READ-ONLY] `docs/design-system.md` needs no change: no new colour, radius, size, spacing step or primitive. Verify: recorded.
- [ ] 20.8 Measure final.
- [ ] 20.9 V.
- [ ] 20.10 [USER] Checkpoint M19. Look at: the block is keyboard accessible and names the count. Commit by hand.

## Phase 21: M20 Pages (~700)

- [ ] 21.1 Baseline paths: `asignaturas/new/page.tsx` (+test 299), `[id]/edit/page.tsx` (+test 943), `bound-controls.tsx`, `i18n/*.json`, `current-marker-usage.test.ts`.
- [ ] 21.2 RED `new/page.test.tsx`: `searchParams` awaited after the guard (N1); `?codigo=` valid and in scope renders `add-group` mode with the existing group numbers; missing, foreign, malformed (over 32 characters) and repeated-key (array) values render plain `create` mode with **identical statements and markup**; the form is keyed by the validated code; five-role table; no page imports an actions module. Spec: CM-ACC-1, CM-SCOPE-1. Threat: existence disclosure.
- [ ] 21.3 RED edit page test: breadcrumb names code and group; code and group read-only; one "Add group to this subject" link to `/catalog/asignaturas/new?codigo=<encoded>`; State section without the active-groups notice; the toggle's `recordLabel` names code, group number **and name** (CM-UX-1; the differences note c); an inactive class is read-only with the reactivate action (CM-ASG-3); a foreign id gives the same `notFound` as a missing one; `notFound`/`redirect` outside `try` (N2). Spec: CM-ASG-2, CM-ASG-3, CM-ASG-4, CM-SCOPE-1, CM-UX-1.
- [ ] 21.4 RED parity pins: page keys `catalog.asignaturas.page.{addGroupTitle, addGroupSubtitle, addGroupLink}`, `breadcrumb.edit` takes `{codigo}` and `{numeroGrupo}`; `state.activeGroups` and `refusals.activeGrupos` absent.
- [ ] 21.5 Measure after RED.
- [ ] 21.6 GREEN `new/page.tsx`, `[id]/edit/page.tsx`, `bound-controls.tsx` (binds `createAsignaturaAction`, `addGrupoAction`, `updateAsignaturaAction`, `setAsignaturaActivoAction`; removes the Phase 13 bridge).
- [ ] 21.7 GREEN author only the keys 21.4 pins; remove `state.activeGroups` and `refusals.activeGrupos`.
- [ ] 21.8 Pins: `current-marker-usage.test.ts` two breadcrumb pages and one form; `guards.test.ts` unchanged and green. Mutation: write the marker in the form; restore.
- [ ] 21.9 Measure final (stop rule).
- [ ] 21.10 V including `npm run build`.
- [ ] 21.11 [USER] Checkpoint M20. Look at: identical markup for every `?codigo=` miss; no actions import in pages. Commit by hand.

## Phase 22: Owner smoke of the manual screens on `rehearsal-0007`

Needs Phase 5 closed. Every write below is its own [CONFIRM] with HC (target `rehearsal-0007`, never production).

- [ ] 22.1 [USER] Start `npm run dev` with a shell-scoped `DATABASE_URL` for `rehearsal-0007`; restate the host (not HOST-PROD). Verify: noted.
- [ ] 22.2 [USER] Read-only: class list as `secretaria` and as `coordinacion`; nine columns at 360px, docente hyphen, days cell, `es` and `en`, search by code, group, docente name.
- [ ] 22.3 [USER][CONFIRM] Create a class for a new code with Monday and Wednesday and no docente.
- [ ] 22.4 [USER][CONFIRM] From its edit page use "Add group to this subject": add-group mode shows name, career and hours as read-only text; add group "2".
- [ ] 22.5 [USER][CONFIRM] Edit the hours of group "2": the confirmation block states how many other classes change; cancel restores the form; confirm updates every row of the code; the list shows the new value.
- [ ] 22.6 [USER][CONFIRM] Give group "2" the same docente and a shared day as group "1": refused under the docente field, naming group "1" and the shared days, in `es` and `en`; nothing stored.
- [ ] 22.7 [USER][CONFIRM] Deactivate group "2" (the confirmation names code, group number and name; says nothing is deleted); reactivate it (refusal if the rule would break).
- [ ] 22.8 [USER] Roles: `docente` and `estudiante` reach `/denied`, anonymous reaches `/login`, a `coordinacion` actor opening a foreign class id gets the same not-found as a missing id.
- [ ] 22.9 [USER] Removed URLs: `/catalog/grupos`, `/catalog/grupos/new`, `/catalog/grupos/42/edit` answer the framework default 404 with no redirect (Q:O6); the sidebar has no Grupos entry.
- [ ] 22.10 [READ-ONLY] After the writes: V7 (no code with more than one subject combination) and the audit rows of the smoke (one per affected class for 22.5) read on `rehearsal-0007`.
- [ ] 22.11 [USER] Checkpoint of the smoke. Record findings in apply-progress.md; defects return to the owning phase.

## Phase 23: M21 Import v2 contract (~600)

New code lives in `src/lib/import/v2/` beside the old pipeline (R7, MG-26).

- [ ] 23.1 Baseline paths: `src/lib/import/v2/{sheets,schemas,types}.ts` and their tests (new).
- [ ] 23.2 [USER] Q:O8 and Q:S4. Default: A6 (a blank `CorreoDocente` cell clears the docente) and the header is **optional** with the absent column keeping the stored docente (spec S4); this departs from MG-19/P3. Record the answer; the orchestrator records the design amendment.
- [ ] 23.3 RED `v2/sheets.test.ts`: `SHEETS` is `Asignaturas` (required `Codigo, Nombre, Carrera, HorasTotales, Grupo`; optional `CorreoDocente, Dias`) then `Docentes` (required `Correo, Nombre`; optional `Telefono`); `ABSENCE_SIGNIFICANT` lists `Dias` and `CorreoDocente` under `Asignaturas`; `RETIRED_SHEETS` is `["Grupos"]`; no `Id` column. Spec: CEI-SHEETS, CEI-DIAS-1, CEI-DOC (S4). Design: MG-19.
- [ ] 23.4 RED `v2/schemas.test.ts`: row keys `codigo.*`, `nombre.*`, `carrera.*`, `horasTotales.*`, `numGrupo.*` (trim, 12, never numeric), `correoDocente.invalid`, `correoDocente.tooLong`, `correo.loginTooLong`; a blank `CorreoDocente` is `null`. Spec: CEI-VAL, CEI-DOC.
- [ ] 23.5 RED type-level tests for `EntityName`, `AsignaturaRow`, `AsignaturaWrite` and `ImportPlan` of the Interfaces section; `deactivateGrupoIds` and `manualGruposToDeactivate` do not exist. Design: MG-22.
- [ ] 23.6 Measure after RED.
- [ ] 23.7 GREEN the three modules.
- [ ] 23.8 Measure final.
- [ ] 23.9 V.
- [ ] 23.10 [USER] Checkpoint M21. Look at: the O8 default applied. Commit by hand.

## Phase 24: M22 Docentes stage extracted (~250)

- [ ] 24.1 Baseline: record `plan.ts` (478) and `plan.test.ts` (1,649) numstat.
- [ ] 24.2 RED `plan-docentes.test.ts` (direct tests of the unchanged docentes logic: email match, create, update, role integrity, caps). Fails: module missing.
- [ ] 24.3 GREEN extract the stage to `src/lib/import/plan-docentes.ts`; the old planner delegates (refactor under the full existing `plan.test.ts`, green before and after). Design: MG-20 stage 1.
- [ ] 24.4 Measure.
- [ ] 24.5 V.
- [ ] 24.6 [USER] Checkpoint M22. Commit by hand.

## Phase 25: M23 Planner I (~780)

Fallback seam: the match rules (25.4) move to M24.

- [ ] 25.1 Baseline paths: `src/lib/import/v2/plan.ts` (+test), `v2/__fixtures__`.
- [ ] 25.2 RED row checks in MG-20 order, each failure one row error that skips the row: schema keys; `dias.invalid` naming the token; `carrera.unresolved`; repeated key `clase.duplicate` (value "<Codigo> <Grupo>"); a non-blank `CorreoDocente` that resolves nowhere or to a user of another role gives `docente.unresolved`; a repeated `Codigo` with a different `Grupo` is not a duplicate; all errors reported with sheet, row, reason. Spec: CEI-VAL, CEI-DOC, CEI-DIAS-2, CEI-DIAS-3.
- [ ] 25.3 RED subject disagreement (Q:S3): **every** row of a code whose rows disagree is an error naming the code and exactly the differing fields (`Nombre`, `Carrera`, `HorasTotales`, table-driven); agreement across three groups raises none; confirmation is not offered. Spec: CEI-D9ROWS, AC-D9. Design: MG-20 (the design compares to the first valid row; spec S3 wins).
- [ ] 25.4 RED match by (`Codigo`, `Grupo`): `create`, `update` (a subject field differs, docente differs including to or from none, the stored row was inactive, a non-empty `Dias` cell differs), `unchanged`; origin `importacion` only on create; absent `Dias` or `CorreoDocente` column and an empty `Dias` cell keep the stored values; `mask > 0 && mask !== existing.dias`; no write carries `dias: 0`; same set in another spelling is `unchanged`; a new group of an existing code leaves the others `unchanged`; counts per entity. Spec: CEI-UPS, CEI-DRY, CEI-PREC, CEI-DIAS-3, AC-ORIG.
- [ ] 25.5 Measure after RED.
- [ ] 25.6 GREEN `v2/plan.ts` stages 1-3.
- [ ] 25.7 Measure final (stop rule).
- [ ] 25.8 V.
- [ ] 25.9 [USER] Checkpoint M23. Commit by hand.

## Phase 26: M24 Planner II (~700)

- [ ] 26.1 Baseline paths: `v2/plan.ts` (+test).
- [ ] 26.2 RED subject sync: stored rows (active or inactive) of a mentioned code whose group the workbook does not list receive the workbook's subject fields in `subjectSyncs`; not a counted disposition; preview and apply agree. Spec: CEI-D9WRITE. Design: MG-20 stage 4.
- [ ] 26.3 RED deactivate absent (A5): every active stored class not matched goes to `deactivateAsignaturaIds` (a whole absent code included); `manualClasesToDeactivate` counts only active origin-`manual` ones; inactive rows are not counted; no delete; other entities untouched. Spec: CEI-DEA, AC-LIFE.
- [ ] 26.4 RED docente rule on the resulting state: per code over the workbook rows with the effective mask (the cell's, else the stored, else 0); a conflict makes **each** involved row a `docente.overlap` error naming the code and both group numbers (spec CEI-RULE; the difference note b); table: swap valid, rotation of three valid, a deactivated stored row does not count, kept days take part, no docente or no days never conflict, handover from a deactivated class valid. Spec: CEI-RULE, AC-RULE.
- [ ] 26.5 RED `clearDocenteIds` (matched active rows with a docente whose docente or days will change) and the unchanged caps. Design: MG-21 phase B, MG-20 stage 7.
- [ ] 26.6 Measure after RED.
- [ ] 26.7 GREEN `v2/plan.ts` stages 4-7.
- [ ] 26.8 Measure final.
- [ ] 26.9 V.
- [ ] 26.10 [USER] Checkpoint M24. Commit by hand.

## Phase 27: M25 Apply I (~700)

- [ ] 27.1 Baseline paths: `v2/apply.ts` (+test).
- [ ] 27.2 RED statement order with a recording `tx` double that includes an in-memory simulator of the seven non-deferrable indexes checked per statement: A deactivate, B clear (names only `DocenteId`), C usuarios, D insert new classes and subject sync, E one update per changed matched row to its final state, F audit last; the swap, the rotation and the handover plans never trip the simulator. Spec: CEI-ORDER. Design: MG-21.
- [ ] 27.3 RED other apply rules: a plan with errors is refused; the "falsy mask is never written" rule; reactivation sets `activo` true; no delete statement; new classes get `origen` by default.
- [ ] 27.4 Measure after RED.
- [ ] 27.5 GREEN `v2/apply.ts` phases A-E (the real index behaviour is proven only by the rehearsal, task 5.14).
- [ ] 27.6 Measure final.
- [ ] 27.7 V.
- [ ] 27.8 [USER] Checkpoint M25. Commit by hand.

## Phase 28: M26 Apply II, summary, import audit (~650)

- [ ] 28.1 Baseline paths: `v2/apply.ts`, `v2/summary.ts` (+tests), `src/lib/audit/events.ts` (+test).
- [ ] 28.2 RED `runImportApply`: takes the shared lock 5005001, re-reads the snapshot and re-plans, refuses an errored or stale plan, busy outcome, atomic. Spec: CEI-ORDER, CM-NFR-4 (apply busy).
- [ ] 28.3 RED `ImportSummary` keyed by `Asignatura` and `Usuario` with `cuentasCreadas`, `cuentasActualizadas`, `asignaturasReactivadas`, `asignaturasManualesDesactivadas`; no `gruposManualesDesactivados`. Spec: CEI-AUD, AL-IMPSHAPE.
- [ ] 28.4 RED import audit: one import-level record `catalogo.importacion.aplicada` with the file SHA-256, two-entity counts, the two new counts, no cell content or credential; one `asignatura.reactivada` per reactivated class (field `activo`, `origen: importacion`, digest); no other `asignatura.*` or `grupo.*` event; idempotent re-import writes the record with zeros and no event; a failed apply writes nothing; preview writes nothing. Spec: AL-IMP, AL-IMPSHAPE, CEI-AUD. Design: MG-22. The new builder lives beside the old one (removed in 33.3).
- [ ] 28.5 Measure after RED.
- [ ] 28.6 GREEN orchestration, summary, import payload, reactivation events.
- [ ] 28.7 Measure final.
- [ ] 28.8 V.
- [ ] 28.9 [USER] Checkpoint M26. Commit by hand.

## Phase 29: M27 Parse, template, fixtures (~600)

- [ ] 29.1 Baseline paths: `src/lib/import/parse.ts` (+test 232), `template.ts` (+test), `__fixtures__/build-fixtures.mjs`, `docs/PlantillaCatalogo.xlsx` (binary, excluded).
- [ ] 29.2 RED `parse.test.ts` parametric over a contract argument: a sheet named `Grupos` (matched with `normalizeKey`) refuses the workbook with the structural reason `workbook.oldLayout` before any row is read, including a stray `Grupos` beside a new `Asignaturas` sheet; with no `Grupos` sheet but no `Grupo` column the existing `column.missing` names `Grupo`; missing sheet or column errors name them; absent optional columns are not errors; absent versus empty cell is distinguished for `Dias` and `CorreoDocente`. Spec: CEI-OLD, CEI-SHEETS, CEI-DIAS-1. Design: MG-19.
- [ ] 29.3 RED `template.test.ts`: two sheets in order; headers `Codigo, Nombre, Carrera, HorasTotales, Grupo, CorreoDocente, Dias` and `Correo, Nombre, Telefono`; uploaded unchanged parses with zero rows and zero errors. Spec: CEI-TPL, CEI-DIAS-4.
- [ ] 29.4 Measure after RED.
- [ ] 29.5 GREEN `parse.ts` and `template.ts` take the contract as a parameter; the template route keeps passing the old contract until 30.7.
- [ ] 29.6 Fixtures: update `build-fixtures.mjs` and regenerate the `.xlsx` fixtures locally (no database): the new template, the old three-sheet workbook kept as a refusal fixture, a two-sheet workbook with a docente swap, one with a disagreeing code, one with a docente overlap. Binary files are outside the count.
- [ ] 29.7 Measure final.
- [ ] 29.8 V.
- [ ] 29.9 [USER] Checkpoint M27. Commit by hand.

## Phase 30: M28 Switch I (~750)

Fallback seam: the template route (30.5, 30.7 part) moves to M29.

- [ ] 30.1 Baseline paths: `catalog/import/actions.ts` (207), `actions.test.ts` (800), `src/lib/data/catalog.ts` (+test), the template route under `src/app/api/catalog/template/`.
- [ ] 30.2 [READ-ONLY] Read `import/actions.test.ts` and fix its describe boundaries so the rewrite is reviewable (Read first item 11). Verify: recorded.
- [ ] 30.3 RED `import/actions.test.ts` over v2: guard first and `secretaria` only, body not read before it; file guards; the old-layout refusal returns a structural state; preview and apply call the v2 parse, plan and apply; busy; state types. Spec: CEI-OLD, CEI-DRY, CM-NFR-4.
- [ ] 30.4 RED `catalog.test.ts`: `CatalogSnapshot` has no `grupos`; `asignaturas` carries the MG-24 projection. Design: MG-24.
- [ ] 30.5 RED template route test: role-guarded (only `secretaria`), denial for others, the new two-sheet file. Spec: CEI-TPL.
- [ ] 30.6 Measure after RED.
- [ ] 30.7 GREEN actions, snapshot without `grupos` (removes the legacy-table read), state types, template route on the new contract.
- [ ] 30.8 Measure final (stop rule).
- [ ] 30.9 V including `npm run build`.
- [ ] 30.10 [USER] Checkpoint M28. Commit by hand.

## Phase 31: M29 Switch II (~750)

Fallback seam: `import-form` tests (31.7) move to a new slice.

- [ ] 31.1 Baseline paths: `import-preview.tsx` (+test 465), `workbook-contract.tsx` (+test), `import-errors.tsx` (+test), `import-form.tsx` (+test 799), `i18n/*.json`, `catalog-parity.test.ts`, `audit-leak.test.ts`.
- [ ] 31.2 [READ-ONLY] Fix the describe boundaries of `import-form.test.tsx` and `import-preview.test.tsx` for the rewrite. Verify: recorded.
- [ ] 31.3 RED `import-preview.test.tsx`: two entities; before the confirm control it states how many classes will be deactivated, that nothing is deleted and that a later import reactivates them, how many were created by hand (the warning only when above zero: table 0/0, 4/0, 4/1, 4/4), how many are reactivated (the `update` count includes them), that manual edits may be replaced, and that the user may cancel; the warning does not block confirm; errors hide confirm. Spec: CEI-PREV, CEI-DRY, CEI-COPY, CEI-PREC. Threat: mass deactivation.
- [ ] 31.4 RED `workbook-contract.test.tsx`: two sheets in order, required and optional columns from the contract, the static rules (no `Id`, `Carrera` must exist, positive integer hours, `Grupo` required with `Codigo`, rows of a code agree, `CorreoDocente` optional and a blank cell removes the docente, a docente cannot teach two groups of a code on a shared day, absent classes are deactivated, `Dias` rule); no `Grupos`, no `Periodo`. Spec: CEI-UI, CEI-DIAS-4.
- [ ] 31.5 RED `import-errors.test.tsx`: reasons `clase.duplicate`, `asignatura.inconsistent`, `docente.overlap`, structural `workbook.oldLayout` render in both locales; removed reasons absent. Spec: CEI-COPY.
- [ ] 31.6 RED parity: `ROW_REASONS` and the entities pin `["Asignatura","Usuario"]`; list, form and page key pins; locale parity of the new import keys.
- [ ] 31.7 RED `import-form.test.tsx` adjustments for the new states (FT).
- [ ] 31.8 Measure after RED.
- [ ] 31.9 GREEN preview, contract card, errors and form components.
- [ ] 31.10 GREEN copy: add `workbook.oldLayout`, `preview.{deactivations, manualClases}`, `result.manualClasesDeactivated`, contract rules `docenteBlank` and `absentDeactivated`; remove `entities.Grupo`, reasons `codigoAsignatura.*`, `periodo.*`, `asignatura.unresolved`, `asignatura.inactive`, `grupo.duplicate`, `codigo.duplicate`, `preview.manualGroups`, `result.manualGruposDeactivated`.
- [ ] 31.11 `audit-leak.test.ts`: add the import preview and import apply cases over v2 (completes the six actions of MG-23). Mutation: leak a cell value into the import payload; it fails; restore.
- [ ] 31.12 Measure final (stop rule).
- [ ] 31.13 V including `npm run build`.
- [ ] 31.14 [USER] Checkpoint M29. Look at: the deactivation sentence appears before confirm. Commit by hand.

## Phase 32: Owner smoke of the import on `rehearsal-0007`

- [ ] 32.1 [USER] Start `npm run dev` with a shell-scoped `DATABASE_URL` for `rehearsal-0007`; restate the host. Log in as `secretaria`.
- [ ] 32.2 [USER] Download the template: two sheets, header rows as specified; upload it unchanged: zero rows, zero errors. Spec: CEI-TPL, CEI-OLD ("new template is not refused").
- [ ] 32.3 [USER] Upload the old three-sheet workbook kept in 29.6: the `workbook.oldLayout` message in `es` and `en`, naming the two sheets, the columns and the template; nothing planned or written. Spec: CEI-OLD.
- [ ] 32.4 [USER] Preview the workbooks with a disagreeing code and with a docente overlap: row errors named per row, no confirm control.
- [ ] 32.5 [USER] Preview the two-sheet workbook with the docente swap: counts, the deactivation sentence and number, the manual-class warning, the replaced-edits statement; then [READ-ONLY] confirm no table changed.
- [ ] 32.6 [USER][CONFIRM] Apply that workbook on `rehearsal-0007`. HC. Verify: the swap applied without a unique violation; [READ-ONLY] V6, V7 and the import audit record (one) and `asignatura.reactivada` events.
- [ ] 32.7 [USER][CONFIRM] Apply the same workbook again. HC. Verify: every entity `unchanged`, exactly one new import-level record, no reactivation event.
- [ ] 32.8 [USER] Roles: `coordinacion`, `docente`, `estudiante` cannot open or post the import; a non-`secretaria` template request is denied.
- [ ] 32.9 [USER] Checkpoint of the smoke. Record findings; defects return to the owning phase.

## Phase 33: M30 Remove the old planner and the old apply (~60)

Whole-file deletions: `plan.test.ts` (1,649), `plan.ts` (478), the old `__fixtures__/plan-fixtures.ts` (78), `apply.test.ts` (1,317), `apply.ts` (380), the old `summary.ts` (67) and `summary.test.ts` (213): 7 items.

- [ ] 33.1 Baseline; [READ-ONLY] `rg "lib/import/(plan|apply|summary)\"" src` shows no importer outside the files to delete (the actions import the v2 modules since Phase 30).
- [ ] 33.2 Delete the seven files; the Phase 3 bridge in `apply.ts` goes with it.
- [ ] 33.3 Remove the old import-payload builder from `audit/events.ts` and its old cases from `events.test.ts` (kept the v2 builder of 28.4).
- [ ] 33.4 Measure.
- [ ] 33.5 V.
- [ ] 33.6 [USER] Checkpoint M30. Commit by hand.

## Phase 34: M31 Remove the old contract and the legacy table file (~60)

Whole-file deletions: `sheets.ts`, `sheets.test.ts`, `schemas.ts`, `schemas.test.ts`, the old `types.ts`, `src/db/legacy-grupo.ts`.

- [ ] 34.1 Baseline; [READ-ONLY] `rg "legacy-grupo|import/(sheets|schemas|types)\"" src` shows only the files to delete and `v2/*`.
- [ ] 34.2 Delete the six files; remove the Phase 2 characterization tests of `schema.test.ts` that imported the legacy file (the "no `grupo` export" test stays).
- [ ] 34.3 [READ-ONLY] `rg -n "legacy-grupo"` returns nothing; remaining bridges from the Phase 3 list are all removed (compare with apply-progress.md).
- [ ] 34.4 Measure.
- [ ] 34.5 V including `npm run build`.
- [ ] 34.6 [USER] Checkpoint M31. Commit by hand.

## Phase 35: M32 Rename `v2/*` into place (~90)

- [ ] 35.1 Baseline.
- [ ] 35.2 Move `src/lib/import/v2/*` (modules, tests, fixtures) up one level with the filesystem (no `git mv`); no logic change.
- [ ] 35.3 Update import paths in the files `tsc` lists.
- [ ] 35.4 Verify rename-only: every moved test is byte-identical apart from import paths (diff of old and new copies recorded).
- [ ] 35.5 Measure.
- [ ] 35.6 V; [USER] Checkpoint M32 (commit by hand; the owner reviews with `git diff -M`).

## Phase 36: M33 Origin rename and the applied-migration literal (~120)

- [ ] 36.1 Baseline paths: `src/lib/catalog/origen.ts` (+test), `src/db/migration-0005.test.ts`, the users of `GRUPO_ORIGENES`/`GrupoOrigen` (`rg`).
- [ ] 36.2 RED `origen.test.ts`: exports `ORIGENES` and `Origen`, values unchanged. Fails: old names.
- [ ] 36.3 GREEN rename and re-point every user.
- [ ] 36.4 `migration-0005.test.ts`: its `GRUPO_ORIGENES` import becomes the literal `["importacion","manual"]` (an applied migration must not follow a live constant). Mutation: change one literal; the pin fails; restore. Design: MG-6, R4.
- [ ] 36.5 Confirm `migration-0006.test.ts` and `inscripcion-writes.test.ts` are unchanged and green (R4, R6). Spec: AC-INS ("No code path writes Inscripcion").
- [ ] 36.6 Measure.
- [ ] 36.7 V.
- [ ] 36.8 [USER] Checkpoint M33. Commit by hand.

## Phase 37: M34 Documents (~200)

- [ ] 37.1 Baseline paths: `docs/api-institucional/README.md`, `docs/PlantillaCatalogo.xlsx` (binary, excluded).
- [ ] 37.2 Rewrite the mapping note of `docs/api-institucional/README.md`: a Grupo is a class row of `Asignatura`; `Periodo` is gone; the student's enrolment points to the class. Design: MG-2.
- [ ] 37.3 Regenerate `docs/PlantillaCatalogo.xlsx` from the template builder (local, no database). Verify: it uploads unchanged with zero rows and zero errors.
- [ ] 37.4 [READ-ONLY] `modelo_datos_sql.md` (task 4.9) and `docs/design-system.md` need no further change. Verify: recorded.
- [ ] 37.5 [READ-ONLY] `rg -n -i "grupos?\b|periodo" docs README.md` shows only deliberate historical mentions.
- [ ] 37.6 Measure.
- [ ] 37.7 V.
- [ ] 37.8 [USER] Checkpoint M34. Commit by hand.

## Phase 38: M35 Closing pins (~150)

- [ ] 38.1 Baseline.
- [ ] 38.2 RED new pin: no identifier `grupo` used as a table, type or route under `src`, outside `numeroGrupo`, `addGrupo`, copy and the historical audit constant (explicit allowlist). Spec: AC-NOGRP, AL-RET ("no path writes a grupo event"), CM-RTE-1. May pass at once; then it is a characterization proven in 38.4.
- [ ] 38.3 [READ-ONLY] Final sweep: `rg -n -i "grupo" src` triaged; any residual fixed in this slice.
- [ ] 38.4 Mutation check: reintroduce an import of a table named `grupo`; the pin fails; restore.
- [ ] 38.5 [READ-ONLY] `catalog-parity` has no `catalog.grupos` or `nav.catalogGrupos`; `es` and `en` key sets identical. Spec: CM-I18N-1.
- [ ] 38.6 Write the final section of apply-progress.md: slice list with authored lines by path, every bridge and its removal, deviations (O8 default, differences a-c), new locale keys.
- [ ] 38.7 Measure.
- [ ] 38.8 V full: `npm test`, `npm run typecheck`, `npx eslint src`, `npm run build`.
- [ ] 38.9 [USER] Checkpoint M35: the code is complete. Look at: every pin, the closing sweep. Commit by hand. Opens Phase 39.

## Phase 39: Cutover gates MG-G15 to MG-G22

Nothing is batched; HC before every write; the owner runs every command. Production keeps the old schema and old code until 39.10.

- [ ] 39.1 [READ-ONLY] Preconditions: Phases 1-38 closed and committed by the owner; the commit to deploy recorded; working tree clean; the SHA-256 of the `0007` SQL equals the one frozen at 4.12.
- [ ] 39.2 [USER][CONFIRM] MG-G15. Create branch `rehearsal-0007-final` from `production`, at most one day before the cutover. HC.
- [ ] 39.3 [USER][CONFIRM] MG-G16. `npm run db:migrate` against `rehearsal-0007-final`. HC.
- [ ] 39.4 [READ-ONLY] **Re-run the preflight P1-P12 on `production` now.** Any new finding in P3, P4, P5, P10 or P11 stops the cutover.
- [ ] 39.5 [READ-ONLY] V1-V8 on `rehearsal-0007-final`.
- [ ] 39.6 [USER][GATE] Compare 39.4 and 39.5 with the report of 5.10; every difference the owner has not approved stops the cutover.
- [ ] 39.7 [USER][GATE] MG-G17. Maintenance window opens: catalog writes stop (A12). Confirm nobody else uses `production` (design could not verify it).
- [ ] 39.8 [USER][CONFIRM] MG-G18. Create `backup-before-0007` from `production` (mandatory). HC.
- [ ] 39.9 [READ-ONLY] MG-G19. On `production`: P1, P4, P5, P10, P11 again; `.env` host equals HOST-PROD; file hash equals 4.12. Any difference stops here.
- [ ] 39.10 [USER][CONFIRM] MG-G20. **Irreversible.** `npm run db:migrate` against `production`: exact command and host restated first (HC: host must equal HOST-PROD). Spec: AC-GATE.
- [ ] 39.11 [USER] Deploy the new code inside the window. The design does not specify the mechanism; the owner states it and the step is recorded.
- [ ] 39.12 [READ-ONLY] MG-G21. V1-V8 on `production`.
- [ ] 39.13 [USER] Read-only smoke on `production` as each role and an import **preview** (writes nothing).
- [ ] 39.14 [USER][CONFIRM] Optional smoke write on `production`: one manual edit. HC. May be skipped.
- [ ] 39.15 [USER][CONFIRM] Optional smoke write on `production`: one import apply. HC. May be skipped.
- [ ] 39.16 [USER][GATE] Decision: reopen the window (checks and smoke passed) or roll back.
- [ ] 39.17 [USER][CONFIRM] Conditional, only on failure inside the window: restore `production` from `backup-before-0007`, then run the previous commit. HC. Nothing is lost because writes were stopped.
- [ ] 39.18 [USER][CONFIRM] MG-G22. Delete `rehearsal-0007`. HC.
- [ ] 39.19 [USER][CONFIRM] MG-G22. Delete `rehearsal-0007-final`. HC.
- [ ] 39.20 [USER] Q:O10. Name the date on which `backup-before-0007` is deleted; record it. It is never deleted before that.

## Phase 40: Closing: verify, archive, documents

- [ ] 40.1 [USER] Run `sdd-verify` for `merge-grupo-into-asignatura`. It must read the differences note (S5 and the CorreoDocente header) against the specs; each CRITICAL is fixed or recorded.
- [ ] 40.2 [READ-ONLY] Run V7 on `production` (standing consistency query for D9) and record it for the verify report.
- [ ] 40.3 [USER][GATE] Archive in order: `catalog-management` first (0.5), then this change. The archive warns before merging destructive deltas (REMOVED: Grupo shape, Grupo origin, Grupo meeting days, CM-ASG-7, CM-ASG-8, CM-GRP-1..8); confirm.
- [ ] 40.4 [USER] The orchestrator saves Engram from `apply-progress.md`.
- [ ] 40.5 [USER] Q:O2. Record the constraints for the future Solicitud change: a class may have no docente; a class row is reused across terms (no `Periodo`); who handles a request for a class without docente is still open.
- [ ] 40.6 [USER] Confirm the final documents: `modelo_datos_sql.md`, `docs/api-institucional/README.md`, `docs/PlantillaCatalogo.xlsx`, and the main specs after the archive.
- [ ] 40.7 [USER] Branch housekeeping decisions (any smoke branch left); `production` untouched by this task.

## Traceability

### Spec requirement to tasks

| Requirement | Tasks |
|---|---|
| AC-NOGRP | 2.2, 3.3, 4.9, 38.2 |
| AC-DOC, AC-ACTDOC | 14.3, 14.4, 15.3, 15.5, 16.2 |
| AC-ORIG | 3.3, 14.3, 25.4, 36.2 |
| AC-DIAS | 12.3, 13.2, 14.3, 25.4 |
| AC-D9 | 3.13, 4.3, 14.4, 15.4, 20.2, 25.3, 39.5, 40.2 |
| AC-RULE | 1.2-1.3, 14.4, 15.3, 15.5, 26.4 |
| AC-DBRULE | 3.3, 3.13, 5.11-5.14 |
| AC-MIG, AC-COLL, AC-ACT | 3.12, 3.13, 4.2, 4.3, 5.4-5.6, 5.9, 5.10 |
| AC-PRE | 0.12, 0.14, 4.2, 4.10, 39.4, 39.9 |
| AC-AUDH | 3.12, 10.2 |
| AC-GATE | 3.12, 4.15, Phase 5, Phase 39 |
| AC-ASG, AC-CODE | 3.3, 12.3, 17.2 |
| AC-INS, AC-READ | 3.3, 3.5, 36.5 |
| AC-LIFE | 15.5, 26.3 |
| CM-ASG-1, CM-ASG-6 | 12.3, 14.3, 16.2 |
| CM-ASG-2 | 12.3, 14.3, 14.4, 16.2, 17.2, 21.3 |
| CM-ASG-3, CM-ASG-4, CM-ASG-5 | 15.3, 15.5, 17.2, 17.3, 21.3 |
| CM-ASG-9 | 12.3, 19.2, 19.3 |
| CM-ASG-10 | 14.4, 14.5, 15.3, 15.5, 16.2, 16.4, 22.6 |
| CM-ASG-11 | 14.4, 15.3, 15.4, 17.2, 20.2, 20.3, 22.5 |
| CM-ASG-12, CM-LST-1 | 13.2, 18.3 |
| CM-ASG-13 | 14.3, 25.4, 36.2 |
| CM-RTE-1 | 7.2, 8.2, 8.4, 22.9, 38.2 |
| CM-ACC-1, CM-ACC-2 | 16.2, 21.2, 22.8 |
| CM-SCOPE-1..3 | 12.2, 13.2, 14.3, 15.3, 21.2 |
| CM-UX-1 | 18.3, 20.3, 21.3 |
| CM-NAV-1 | 8.4 |
| CM-I18N-1 | 7.3, 9.3, 12.4, 16.4, 18.4, 19.4, 20.6, 21.4, 31.6, 38.5 |
| CM-NFR-1, CM-NFR-2, CM-NFR-4 | 9.7, 15.4, 15.9, 16.2, 28.2 |
| CM-AUD-1 | 11.4, 16.2, 17.4 |
| AL-RET | 10.2, 10.7, 38.2 |
| AL-PROP, AL-PAY, AL-SET, AL-ONE | 11.2-11.4, 15.4, 17.4 |
| AL-IMP, AL-IMPSHAPE | 28.3, 28.4, 31.11 |
| CEI-SHEETS, CEI-DIAS-1 | 23.3, 29.2 |
| CEI-OLD | 29.2, 32.3 |
| CEI-D9ROWS, CEI-D9WRITE | 25.3, 26.2 |
| CEI-DOC | 23.4, 25.2, 25.4 |
| CEI-RULE, CEI-ORDER | 26.4, 27.2, 5.14 |
| CEI-DIAS-2..4 | 25.2, 25.4, 29.3, 31.4 |
| CEI-TPL | 29.3, 30.5, 32.2 |
| CEI-VAL, CEI-UPS, CEI-DRY, CEI-PREC | 25.2, 25.4, 31.3 |
| CEI-DEA | 26.3 |
| CEI-AUD | 28.3, 28.4 |
| CEI-UI, CEI-PREV, CEI-COPY | 31.3-31.5, 31.10 |

### Design decision to tasks

| Decision | Tasks |
|---|---|
| MG-1, MG-2 | 3.3, 3.7, 14.3 |
| MG-3 | 3.3, 3.13, 5.11 |
| MG-4 | 3.3, 3.13 |
| MG-5 | 2.2-2.5, 3.7 |
| MG-6 | 3.10-3.13, 4.4, 4.11, 36.4 |
| MG-7, MG-8 | 3.13, 4.2, 4.3, 4.6, 4.7, 5.10 |
| MG-9 (gates) | Phase 5, Phase 39 |
| MG-10 | 12.2, 13.2-13.6 |
| MG-11 | 1.4, 3.4, 5.15, 14.5 |
| MG-12 | 14.4, 15.3, 15.4, 17.2, 20.3 |
| MG-13 | 1.2, 1.3, 14.4, 26.4 |
| MG-14 | 15.5, 17.3 |
| MG-15 | 8.2, 22.9 |
| MG-16 | 18.3 |
| MG-17 | 12.3, 19.2, 19.3, 20.2, 21.2 |
| MG-18 | 8.4, 8.6, 9.3, 10.8, 18.7, 21.7, 31.10 |
| MG-19 | 23.3, 29.2, 29.3 |
| MG-20 | 25.2-25.4, 26.2-26.5 |
| MG-21 | 26.5, 27.2, 5.14 |
| MG-22 | 23.5, 28.3, 28.4, 31.3, 4.9 |
| MG-23 | 10.2, 11.2-11.4, 17.4, 31.11 |
| MG-24 | 3.5, 3.9, 30.4 |
| MG-25 | pins: 6.3-6.5, 8.2-8.3, 9.5, 9.7, 13.4, 14.10, 15.9, 17.7, 31.11, 36.4, 38.2-38.4 |
| MG-26 | the slice table and the order of Phases 1-38 |
| MG-27 | Phase 0 (0.1-0.5) |
