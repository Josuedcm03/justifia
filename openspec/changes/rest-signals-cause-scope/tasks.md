# Tasks: Rest Signals Cause Scope

> Strict TDD (vitest): every behavior task is a RED task (failing test) followed by a GREEN task. Test command: `npx vitest run <paths>`. Vitest does not typecheck, so a RED test on a new variant fails at runtime, not at compile time.
> Gate set G (last step): `npm run typecheck`, `npm test`, `npx eslint src` (ignore the CRLF `Delete ␍` noise: `| rg -v 'Delete .␍.'`), `npm run format:check` (CRLF: `--end-of-line auto`). Run `npm test` with a dummy `DATABASE_URL` (`postgres://u:p@127.0.0.1:9/x`) so no database is targeted.
> DB rule (`CLAUDE.md`): `[LOCAL]` touches no database; `[CONFIRM]` writes or applies and needs the owner's explicit "yes" for that single command, never batched. No migration in this change; no agent task runs `drizzle-kit`, `db:seed` or write SQL.
> Spec IDs: RF-05 (a), (b); RN-09, RN-10, RN-15; RNF-12 (i18n); RNF-01 (coordination view). Decisions D1..D8 refer to `design.md`. Spec requirement names are quoted from the three deltas (`validation-signals`, `request-review`, `coordination-escalation`).
> Skills for apply: `C:\Users\Arnia\.agents\skills\work-unit-commits\SKILL.md`. One commit per work unit (tests and code together), Conventional Commits, no AI attribution, no `Co-Authored-By`.
> Never stage: `FORMATO SOLICTUD DE JUSTIFICACION DE AUSENCIA.docx` (read-only), `infra/modal/__pycache__/` (read-only), `package-lock.json` (read-only). Edit authority: a backticked path on a checkbox line is an edit target; read-only references carry `(read-only)`.
> Threat matrix: N/A (design): no routing, shell, subprocess, VCS automation or executable-file classification.
> Size note: the `sdd-tasks` cap (530 words) is exceeded on purpose; the repository precedent (`validation-signals`) keeps one line per task with spec links.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600 authored: code ~90, tests ~300, docs ~210 (about 130 of them the untracked brief committed as is); `openspec/` planning documents excluded |
| Session review budget | 1200 lines (`review_budget_lines`, user-chosen; replaces the default 400) |
| 1200-line budget risk | Low: ~50% of the budget; production-only lines ~90 |
| 400-line default budget risk | Medium: noted for reference only, not applied |
| Chained PRs recommended | No |
| Suggested split | Single PR from `fix/rest-signals-cause-scope` to `main`, five work-unit commits |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed: single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium
1200-line budget risk: Low

Reason for `Decision needed before apply: No`: the forecast is under the session budget (1200), so no chain or `size:exception` choice is required. If apply measures above 1200 authored lines, stop and report instead of trimming tests or docs.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 0 | SDD planning documents | Single PR | N/A: documents only | N/A: no behavior | Revert the docs commit |
| 1 | `admitsRest` and `CAUSAS_CON_REPOSO` | Single PR | `npx vitest run src/lib/intake/causes.test.ts` | N/A: pure function | Revert `causes.ts`, `causes.test.ts` (no importer yet) |
| 2 | Cause cut end to end: types, verdict, evaluate, coordination view, loader, i18n, section | Single PR | `npx vitest run src/lib/signals src/lib/data/signals.test.ts src/i18n "src/app/(dashboard)/review"` | N/A: pure logic and component tests; the real-Postgres case is unit 3 | Revert the unit commit; unit 1 stays harmless |
| 3 | Opt-in integration case for a non-rest cause | Single PR | `npx tsc --noEmit` (compile-only; excluded from `npm test`) | `INTEGRATION_ALLOW_WRITES=1 npm run test:integration` on a throwaway Neon branch (user-gated, tasks 9.2-9.4) | Revert the integration test file |
| 4 | Requirements, roadmap and brief note | Single PR | `git diff docs/` reviewed by the owner | N/A: documents only | Revert the docs commit; code untouched |

Why unit 2 is one commit: making `SignalInput.causa` required (D5), adding the `not_applicable` variant (D4) and rendering it must land together, or `tsc` fails between commits.

## Phase 0: Planning and baseline

- [x] 0.1 `[READ-ONLY]` Confirm the branch is `fix/rest-signals-cause-scope` and run `npx vitest run src/lib/signals src/lib/intake` for a green baseline
- [x] 0.2 Commit only `openspec/changes/rest-signals-cause-scope/` as unit 0: `docs(rest-signals-cause-scope): add the SDD planning documents`
- [x] 0.3 `[READ-ONLY]` No Next.js API is touched (design); skip the `node_modules/next/dist/docs/` read, note it in the apply progress

## Phase 1: Cause constant (unit 1)

- [x] 1.1 RED `src/lib/intake/causes.test.ts` (file exists; add cases): `admitsRest` true for `medica`, `maternidad_paternidad`; false for `actividad_representativa`, `intercambio_academico`, `fuerza_mayor`; `CAUSAS_CON_REPOSO` holds exactly the two (requirement "Rest signals apply only to causes that admit rest", D3)
- [x] 1.2 GREEN `src/lib/intake/causes.ts`: `CAUSAS_CON_REPOSO` (`as const satisfies readonly Causa[]`) and `admitsRest(causa)`; pure, no `server-only`
- [x] 1.3 Commit unit 1: `feat(intake): add the causes that admit a rest period`

## Phase 2: Verdict over applicable results (unit 2 starts)

- [x] 2.1 RED `src/lib/signals/verdict.test.ts`: every row of "Verdict table" involving `not_applicable` (plus all absent -> `no_alerts`; plus one present -> `review_carefully`; only `not_applicable` + `not_evaluable` -> `inconclusive`; every signal `not_applicable` -> `inconclusive`); `not_applicable` never in `notEvaluable`; scenarios "Non-rest cause with the other signals evaluable and absent", "Non-rest cause with a signal not evaluable", "Non-rest cause with RN-14 present" (D7)
- [x] 2.2 GREEN `src/lib/signals/types.ts`: `NotApplicableResult` (`signal: "rn09" | "rn10"`, no reason, no evidence) in `SignalResult` and `SignalViewResult`, `SignalInput.causa: Causa` required, header comment (D1, D4, D5); `src/lib/signals/verdict.ts`: filter applicable before `some`/`every`

## Phase 3: Cause cut in evaluate

- [x] 3.1 RED `src/lib/signals/evaluate.test.ts`: `input()` defaults `causa: "medica"`; table "Non-rest causes make RN-09 and RN-10 not applicable" for the three causes, with `rest_to` before `issue_date`; scenario "Cut precedes extraction state" (`pendiente`, `fallida`, no row stay `not_applicable`); "Medical cause keeps RF-05 b (E-02, SC-02)" RN-09 `present`; "Maternity or paternity cause still evaluates both"; "RN-07, RN-14 and RN-26 do not depend on the cause" across the five causes; "Five results in fixed order for every cause"; "Reason is always from the closed set" extended to `not_applicable` (no reason, no evidence)
- [x] 3.2 GREEN `src/lib/signals/evaluate.ts`: `results: SignalResult[]`; when `!admitsRest(input.causa)` emit `{ signal, outcome: "not_applicable" }` in the rn09 and rn10 slots without calling the evaluators (D2); `src/lib/signals/rest-dates.ts` stays untouched

## Phase 4: Coordination view

- [x] 4.1 RED `src/lib/signals/coordination-view.test.ts`: `toCoordinationView` projects `not_applicable` as `{ signal, outcome }` only; verdict equals the secretary's; no evidence field leaks (requirement "Signal outcomes on the open escalation detail", scenario "Not applicable without evidence")
- [x] 4.2 GREEN `src/lib/signals/coordination-view.ts`: `projectResult` becomes an exhaustive `switch` over `outcome` (D4)

## Phase 5: Loader

- [x] 5.1 RED `src/lib/data/signals.test.ts`: `BASE.causa`; `it.each` null and a value outside the five causes make `loadSignals` return `{ data: null, degraded: true }` with no verdict (scenario "Missing or invalid cause fails loud"); a `fuerza_mayor` request reaches the evaluator with `causa` and yields `not_applicable` for RN-09 and RN-10 (D6)
- [x] 5.2 GREEN `src/lib/data/signals.ts`: `readRequestBase` selects `Solicitud.causa` and throws `signals_request_incomplete` when null or `!isCausa`; `loadSignals` passes `causa` in `SignalInput`

## Phase 6: i18n

- [x] 6.1 RED `src/i18n/review-messages.test.ts`: extend the outcome list (line ~626) with `not_applicable` and add `notApplicableNote`; es reads "No aplica" and "La causa declarada no incluye reposo."; the same-keys and no-voseo tests cover the rest (requirement "Signals UI i18n", scenarios "Translation keys present", "Not applicable wording")
- [x] 6.2 GREEN `i18n/es.json`, `i18n/en.json`: `review.signals.outcomes.not_applicable` ("No aplica" / "Not applicable") and `review.signals.notApplicableNote` ("La causa declarada no incluye reposo." / "The declared cause does not include a rest period.")

## Phase 7: Section component

- [x] 7.1 RED `src/app/(dashboard)/review/[id]/signals-section.test.tsx`: `not_applicable` RN-09 and RN-10 show the label and the muted note, no evidence, not listed among "Señales no evaluadas", "fechas incoherentes" absent, verdict "Sin alertas"; same for `audience="coordination"`; text, not color only (scenarios "Not applicable entries", "Text, not color", coordination "Not applicable without evidence")
- [x] 7.2 GREEN `src/app/(dashboard)/review/[id]/signals-section.tsx`: evidence only for `present`/`absent` (line ~118); render `notApplicableNote` as a muted line inside `SignalFact` when `not_applicable` (D8); the extraction section stays unchanged (scenario "Extracted data section unchanged for a non-rest cause")
- [x] 7.3 Fix any other test fixture that builds `SignalInput` or `SignalResult` and no longer compiles (for example under `src/app/(dashboard)/coordination/[id]/` and `src/lib/signals/display-only.test.ts`); test files only, no behavior change
- [x] 7.4 Gates unit 2: `npx vitest run src/lib/signals src/lib/data src/i18n "src/app/(dashboard)"`, then `npm run typecheck` (it also compiles `scripts/session-verify.local.ts` (read-only), which must still typecheck unchanged; `tsconfig.json` includes `**/*.ts`) and `npx eslint src`
- [x] 7.5 Commit unit 2: `feat(validation-signals): evaluate RN-09 and RN-10 only for causes that admit rest`

## Phase 8: Integration case (opt-in, unit 3)

- [x] 8.1 Add a case in `src/lib/data/integration/validation-signals.integration.test.ts` (pattern of the existing `addPresented` and `addExtraction` helpers): `addPresented({ causa: "fuerza_mayor" })` with the issuer present, `addExtraction({ issueDate, restTo })` with `restTo` before `issueDate`, a fingerprint without a match; expect RN-09 and RN-10 `not_applicable` and verdict `no_alerts` (brief §6 criteria 1-2). Written after the code, so it passes at write; compile-only here (excluded from `npm test`)
- [x] 8.2 Gates unit 3: `npm run typecheck` and `npx eslint src`; then commit: `test(validation-signals): add the non-rest cause integration case`

## Phase 9: Integration run (USER-GATED, optional)

> Every step needs the user's explicit "yes" for that specific command, never batched and never automatic. Connection strings come from the Neon CLI. Never a validation branch.

- [ ] 9.1 ASK USER `[READ-ONLY]` agree on the throwaway branch name and its parent branch (fictitious data only)
- [ ] 9.2 ASK USER `[CONFIRM]` create the throwaway Neon branch (one command, one yes)
- [ ] 9.3 ASK USER `[CONFIRM]` run `INTEGRATION_ALLOW_WRITES=1 npm run test:integration` against that branch only; record the exact result next to this task
- [ ] 9.4 ASK USER `[CONFIRM]` delete the throwaway Neon branch (a separate command, a separate yes)

## Phase 10: Docs (unit 4)

- [x] 10.1 `docs/requirements.md` RN-09 (line ~46): append in Spanish that it is evaluated only in requests whose declared cause is medical or maternity/paternity, and that with another cause it does not apply
- [x] 10.2 `docs/requirements.md` RN-10 (line ~47): same cause scope, with the "no aplica" wording; no change to the recount (17 RF, 14 RNF, 26 RN)
- [x] 10.3 `docs/requirements.md` RN-15 and RF-05 (a): read their rows; clarify "no aplica" only if the verdict wording there says every signal must be absent, otherwise leave untouched
- [x] 10.4 `docs/requirements.md` section 5: add the row `2026-11-11` with the change and the reason (10 Nov simulated-handwriting run, NuExtract3 invents a rest period on non-medical documents, change `rest-signals-cause-scope`); end the "Cambio" cell with `**Pendiente de sincronizar con la matriz de la tesis.**` like the 2026-11-02 and 2026-11-09 rows
- [x] 10.5 `docs/roadmap.md`: add row 15 `rest-signals-cause-scope`, covers RF-05 (a), (b); RN-09, RN-10, RN-15, responsible Armando, prototype No, status `pendiente` (set `archivado` at archive)
- [x] 10.6 `docs/next-change-rest-signals-cause-scope.md`: commit the existing untracked brief as is, with this docs unit
- [x] 10.7 Check `git diff docs/requirements.md docs/roadmap.md` holds only the rows above (anything else, STOP and ask the owner); commit unit 4: `docs(rest-signals-cause-scope): scope RN-09 and RN-10 to causes with rest and add roadmap row 15`

## Phase 11: Final verification

- [ ] 11.1 Gate set G on the branch head: `npm run typecheck`, `npm test` (dummy `DATABASE_URL`), `npx eslint src`, `npm run format:check`; record exact results
- [ ] 11.2 Measure authored lines against `main`; if above 1200, stop and report (no code golf); record the size
- [ ] 11.3 Run `sdd-verify` against the three spec deltas; fix findings on this branch

## Merge gate

- No migration; `Solicitud.causa` already exists. Production needs nothing before the merge.
- Tests, `tsc` and lint green (task 11.1). The integration run (phase 9) is opt-in and user-gated; its result is recorded if run, not required.
- Merge to `main` on Wed 2026-11-11 or early Thu 2026-11-12, before the tag. `main` auto-deploys to production and is frozen from the tag until the secretary session ends.
- Do NOT delete the change branch `fix/rest-signals-cause-scope` after the merge (memory `keep-change-branches`).
- Then run `sdd-archive` and set roadmap row 15 to `archivado`.

## Follow-ups outside this change (brief §9, before the tag)

- Re-run the extraction check with the real photos: `npx tsx scripts/session-extraction-check.local.ts`.
- Rehearsal in `ensayo-secretaria` (Thu 2026-11-12 from 07:00): seed `--rehearsal`, extraction cron, `--resolve-history`, `scripts/session-verify.local.ts`.
- Update `scripts/session-verify.local.ts` expectations of RN-09 and RN-10 for SC-06, SC-10, SC-11 a/b, SC-13, P2, P3 and P5 to "no aplica".
- Thesis (in `thesis-workspace`): review 4.x and A.5 for the cause cut; sync RN-09 and RN-10 to the requirements matrix.
