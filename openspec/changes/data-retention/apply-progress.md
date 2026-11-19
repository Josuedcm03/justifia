# Apply progress: data-retention

## Unit 0: owner decisions

- 0.1 (2026-11-19): the owner chose option A. The SQL-shape cases of `src/lib/data/retention.test.ts` move to PR 2, and the generated snapshot `drizzle/meta/0014_snapshot.json` is excluded from the 1000-line count. Every checkpoint still reports the snapshot separately.
- 0.2 (2026-11-18): (a) DR-4 no longer lists "SolicitudRevision free text" (the table holds no names or free text), and the snapshot rule now reads as the redact rule (a non-NULL value becomes the placeholder, NULL stays NULL). (b) `EstudianteCarrera` is redacted, not kept as residue. Reports still read the program from the live `Usuario` row.

## Unit 0 (continued)

- 0.3 (2026-11-19): baseline confirmed. Branch "feat/data-retention" sits on origin/main bf91506 (HEAD 8544bcc is the docs commit). The local ref "main" in this repository is stale (b82b359, ten commits behind), so every diff in this change is measured against bf91506 (origin/main), not the local "main" ref. Baseline run "npm test -- src/lib/data src/db src/lib/audit src/lib/intake" with the dummy DB: 106 files, 2054 tests, all passed (57.5 s).
- 0.4 (2026-11-19): committed earlier as 8544bcc ("docs(data-retention): add the SDD planning documents").

## Unit 1: cutoff policy (DR-1, DR-3, DR-6)

Mode: Strict TDD. Layer: unit (pure functions). Safety net: N/A (new files).

| Task | RED evidence | GREEN evidence |
|------|--------------|----------------|
| 1.1 | "npm test -- src/lib/retention": suite failed to load, "Failed to resolve import "./policy" from "src/lib/retention/policy.test.ts". Does the file exist?" (0 tests) | n/a |
| 1.2 | With a naive first version of retentionCutoff (plain year minus 5, no clamp): 10 passed, 1 failed, "retentionCutoff (DR-1) > clamps a missing Feb 29 cutoff to Feb 28 at the same time of day: expected 2027-03-01T09:00:00.000Z to deeply equal 2027-02-28T09:00:00.000Z" | n/a |
| 1.3 | n/a | clamp added: 11 of 11 passed in `src/lib/retention/policy.test.ts` |
| 1.4 | n/a | gates: focused vitest 11/11; "npm run typecheck" clean; "npx eslint src/lib/retention" clean; "npx prettier --check src/lib/retention --end-of-line auto" clean |

Triangulation: four DR-1 boundary rows, exact 5 years, 1 ms less, 1 day less, the clamp, and two rows where the cutoff date exists. Refactor: none needed (the day-exists probe is the minimum code).

Work Unit Evidence:

| Evidence | Value |
|---|---|
| Focused test command and exact result | "npm test -- src/lib/retention" with the dummy DB: 1 file, 11 tests passed |
| Runtime harness | N/A: pure functions, no runtime boundary |
| Rollback boundary | Revert `src/lib/retention/` |

Commit: "feat(retention): add the five-year cutoff policy".
