# Apply progress: Validation Signals

## Slice S1 (branch `feat/validation-signals-s1-signals`), 2026-11-02

Status: tasks 0.6, 1.1-1.14, 2.1-2.6, 3.1-3.10, 4.1, 4.2, 4.5, 5.1 and 5.2 done (36 checkboxes). Open for the owner or the orchestrator: 4.3, 4.4 (owner), 5.3, 5.4 (orchestrator). No S2 or S3 task was started. Strict TDD (vitest).

### Commits (tests and code together, no AI attribution)

| Hash | Message | Tasks |
|------|---------|-------|
| e2a6d46 | feat(validation-signals): add the pure signal evaluators and the suggested verdict | 1.2-1.14 |
| 182e714 | feat(validation-signals): add the fail-soft signals read and the display-only guard | 2.1-2.6 |
| 69315b4 | feat(validation-signals): add the signals section to the secretary detail | 3.1-3.10 |

### Gates (S1 head)

- Targeted: `npx vitest run src/lib/signals src/lib/data src/app src/i18n src/lib/auth` 179 files, 4535 tests passed.
- `npm run typecheck`: 0 errors.
- `npm test` (dummy `DATABASE_URL`): 314 files, 7096 tests passed.
- `npx eslint src` (prettier `endOfLine: auto`): clean. `prettier --check --end-of-line auto src i18n`: clean.
- `npm run build` (dummy `DATABASE_URL`): ok.
- No database command of any kind was run.

### Size (task 5.2) against the tracker

| Scope | Added | Production | Tests |
|-------|------:|-----------:|------:|
| S1 total | 3441 | 1069 | 2372 |
| S1a (Phases 1-2) | 2403 | 770 | 1633 |
| S1b (Phase 3) | 1038 | 299 | 739 |

The forecast was ~900. The budget is 1500 and the split rule does not help: S1a alone is 2403. Per `tasks.md` the work stops here with a `size:exception` recommendation; nothing was golfed and no branch was split.

### Decisions and deviations

- Branch name: the orchestrator cut `feat/validation-signals-s1-signals`, not `feat/validation-signals-s1-signals-secretary` (task 1.1).
- RN-14 normalization removes punctuation (spec: "punctuation removed"); `design.md` VS-1 still says "punctuation to space". The spec wins. Example: "Hosp. Vivian-Pellas, S.A." gives `hosp vivianpellas sa`.
- Reason code and signal naming in the report: results use `signal` for the code and `notEvaluable` entries are `{ signal, reason }`.
- RN-09 per document: a days-only rest with no issue date reports `days_only` (it outranks `field_missing` by the closed precedence).
- RN-10: a completed document with a rest start but no end (or the reverse) is `field_missing`; a dated period needs both ends. Extraction validation never produces that shape, so it is defensive.
- RN-07 `calendar_not_covering_year` checks both the year of `fechaFin` and of the computed deadline.
- Q4 compares the order of presentation inside the database against the request's own row (`(PresentadaEn, Id) < (select ...)` through a `QueryBuilder` subquery), so no timestamp is rounded by the driver. Unqualified columns inside that subquery resolve to its own `"r"` alias.
- `referenceScope` is accepted by `loadSignals` but unused in S1 (RN-26 and Q5 arrive in S2).
- `src/lib/data/test-support/db-double.ts` gained `selectDistinct` (2 lines) so the loader test can script Q3.
- The page reads the signals through a fail-soft wrapper (`loadSignalsSafely`) and `signalsAccess(user.rol) === "full"`; the section is rendered after `ExtractionSection`, so it appears even when the Extracted data section renders nothing.
- i18n: `review.signals.*` in `es.json` (neutral, usted) and `en.json`; outcome words are «Señal presente», «Sin señal», «No evaluable»; verdict wording as specified.

### Task 4.x results

- 4.1: `GET http://127.0.0.1:8080/health` returned 200.
- 4.2: `EXTRACTION_API_URL` is NOT set in `.env.development.local`. It is set in `.env` (gitignored; Next loads it in every mode), is non-empty and valid per `src/lib/extraction/config.ts` (http to loopback, no credentials, port 8080). Only booleans were printed; no value was shown or edited. `EXTRACTION_API_KEY` is not set anywhere (optional for the local server).
- 4.5: expected-state note recorded next to the task in `tasks.md`.

### Risks

- Over budget: 3441 authored lines vs 1500 (decision for the orchestrator or owner).
- The Q4 history SQL and the real extraction rows are covered by SQL-rendering tests and mocks only; no database was touched, so the owner walk (4.3) is the first run against Postgres.
- `.env.development.local` lacks the extraction URL; `.env` supplies it, so a walk with `npm run dev` should work, but confirm which `DATABASE_URL` branch the owner names for 4.3.
