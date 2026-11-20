# Apply progress: flow-experience

## Phase 0: Planning and decisions

Mode: Strict TDD (vitest). Delivery: Feature Branch Chain, twelve slices on the tracker "feat/flow-experience". Size exception: none requested; the stop line is 460 changed lines per PR excluding "openspec/", ".engram/" and "drizzle/meta/0016_snapshot.json".

### 0.1 Owner resolutions (2026-11-20, Managua, all final)

1. **Copy register.** Each screen keeps its existing register. "Tú": student screens (namespaces "requests", "intake", the register page) and admin screens ("users", "catalog"). "Usted": staff screens ("review", "coordination") and the sign-in page. A new Spanish line never mixes registers on its screen. This overrides the design's blanket "usted". Labels with no verb are neutral.
2. **Old-login fallback.** It ships in S9a only for accounts that would otherwise be locked out (no email) and is removed once the read-only count of such accounts is zero.
3. **Decided-card reason.** At most 140 characters in up to 2 lines.
4. **RF-08 preview.** It covers files attached during the current visit to step 3; older files keep the audited "Ver".
5. **CIF.** Students' CIF is digits only (last two digits of the enrollment year, then digits; the owner's has 8). Staff have another unknown CIF format that is not stored today. Login rule: an identifier containing "@" is an email (trimmed, case-insensitive); otherwise it is a CIF (trimmed, spaces and hyphens stripped, exact match against the stored CIF, 20-character limit). No hard-coded 8-digit format.
6. **UX-22 "Mantener la sesión iniciada".** 30 days when checked, 8 h unchecked; logout ends both.
7. **Backlog numbering.** The six Table 19 backlog entries are UX-23 to UX-28.

### Copy-register map (resolution 1)

| Screen or namespace                     | Register |
| --------------------------------------- | -------- |
| "review" (staff detail, queue, dialogs) | usted    |
| "coordination"                          | usted    |
| sign-in page                            | usted    |
| "requests", "intake", register page     | tú       |
| "users", "catalog" (admin)              | tú       |
| Labels with no verb                     | neutral  |

### Migration plan

- Migration 0016, "drizzle/0016_escalation_otro.sql", belongs to S8 only (the motive "otro"); it only widens four existing constraints. S1 to S7 and S9 carry no schema change.
- Generation is local, "npx drizzle-kit generate --name escalation_otro", which opens no database connection. Applying it to production is owner-run, after an explicit "yes" for that exact command (task 8.25).
- Whoever merges second renumbers: if catalog-schedule takes 0016 first (task 8.0), S8 regenerates as the next number.

### 0.2 Coordination (2026-11-20)

- (a) **Migration number: 0016 is free.** "git fetch origin" then the file list of "origin/main" (8a3f270): the last file is "drizzle/0015_manual_document_data.sql"; no "0016" file exists. catalog-schedule has no migration today.
- (b) **PR states, "gh pr view", 2026-11-20:**
  - #98 "docs: sync requirements with the thesis and close catalog-management open tasks" (base "main"): **OPEN**, not merged. Gate: it must merge before S8 (task 8.0).
  - #105 "feat(catalog-schedule): add the inscripciones list table and copy (S1c-1)" (base "feat/catalog-schedule-s1b2-list-read"): **OPEN**, not merged. If it merges, the JSON is rebased last and the parity tests must be green.
  - Neither blocks S1 to S7.

### 0.3 Baseline on the tracker (2026-11-20)

- The tracker "feat/flow-experience" already exists and is pushed (owner-created, on top of main 8a3f270), so "git switch -c" was not re-run.
- "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/lib/data src/lib/signals src/db src/lib/audit src/lib/auth src/app src/i18n": **242 files, 6461 tests, all passed**, 166.6 s vitest duration (2 m 49 s wall).

### 0.4 Spec and design edits hold (2026-11-20)

- "rg -n 'FE-32' specs/auth-entry-access/spec.md": the requirement heading at line 333.
- "rg -n 'removing spaces and hyphens' specs/auth-entry-access/spec.md": line 148 (FE-22).
- "rg -n 'UX-22 addendum' design.md": exactly one heading (line 385).

### 0.5 Planning commits (already on the tracker; nothing re-committed)

"git log --oneline origin/main..HEAD" at the tracker tip 42f7c93 (oldest first):

| Hash    | Message                                                                       |
| ------- | ----------------------------------------------------------------------------- |
| 1e5f5f7 | docs(backlog): add UX-20 change-password link and UX-21 login by CIF or email |
| 963cfe2 | docs(backlog): name the existing specs in UX-20 and UX-21                     |
| b4ad8a3 | docs(flow-experience): add exploration and proposal                           |
| c7e900a | docs(flow-experience): add delta specs                                        |
| 623eee2 | docs(flow-experience): add technical design                                   |
| 1c2cfd1 | docs(backlog): add UX-22 keep me signed in                                    |
| 42f7c93 | docs(flow-experience): add tasks, FE-32 and the UX-22 design addendum         |

The tracker is pushed ("git ls-remote" shows "refs/heads/feat/flow-experience" at 42f7c93). The staged UX-17 and UX-18 edit in "C:<BS>justifia" is not touched, so the numbering gap (UX-17, UX-18) stays until the owner lands it.

## Phase 1 (PR 1): S1 RF-16, the answer at the top

Mode: Strict TDD. Date: 2026-11-20. Slice branch "feat/flow-experience-1-answer-banner" from the tracker tip 42f7c93 (task 1.0). Units 1 and 2 are on it; unit 3 is on "feat/flow-experience-1b-escalate-dialog-pointer", cut from it at the unit boundary because the slice went over the stop line (see "Checkpoint"). Nothing was pushed and PR 1 was NOT opened: the owner decides how the over-size slice ships (task 1.13 is open).

### Owner decision on slice size (2026-11-20)

Owner decision 2026-11-20: size exception for the whole flow-experience change; each slice is cut at its natural unit boundary into one or two PRs and its size recorded, without stopping.

Result for S1: PRs 109 (1a, 554 lines) and 110 (1b, 440 lines) were opened 2026-11-20 under this exception (task 1.13). PR 109 targets the tracker "feat/flow-experience"; PR 110 targets "feat/flow-experience-1-answer-banner". The "Nothing was pushed" sentence above describes the state before that decision.

### Commits

| Unit     | Hash    | Branch                        | Message                                                                                           |
| -------- | ------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| 0 (docs) | a1e9eb8 | "-1-answer-banner"            | docs(flow-experience): record the owner resolutions and the Phase 0 baseline                      |
| 1        | 3029bff | "-1-answer-banner"            | feat(review): add the coordination answer banner                                                  |
| 2        | 3daa9d9 | "-1-answer-banner"            | feat(review): show the answer at the top of the staff detail                                      |
| 3        | 8fe35d0 | "-1b-escalate-dialog-pointer" | feat(review): show the earlier answer in the escalate dialog and point the history to escalations |

The docs commit of Phase 1 (this file and the task marks) is on the tip of "-1b-escalate-dialog-pointer".

### TDD cycle evidence

| Task                         | Test file                                                                                                                                                                                 | Layer              | Safety net                                       | RED                                                                         | GREEN                                                       | Triangulation                                                                                                                                                                                                           | Refactor    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1.1 and 1.2                  | `src/app/(dashboard)/review/[id]/answer-banner.test.tsx`, `src/i18n/review-messages.test.ts`                                                                                              | Unit and component | N/A (new file); 84 review-messages cases passing | Module missing (file failed to load); 6 i18n cases failed                   | 2 files, 104 passed                                         | 7 latestAnswer cases (none, unanswered only, half an answer, one, two, answered then open, a notice is never the answer) and 7 banner cases (en, es, next-day UTC instant in Managua, 1000 characters, link, no action) | None needed |
| 1.4 and 1.5                  | `src/app/(dashboard)/review/[id]/page.test.tsx`, `src/i18n/review-messages.test.ts`                                                                                                       | Component (page)   | 132 page cases passing before the change         | 7 page cases and 2 i18n cases failed first                                  | Review directory and review-messages: 30 files, 1012 passed | Banner table of 6 states, later of two answers, document order, today's copy in 2 situations, four decisions unchanged, one audit read                                                                                  | None needed |
| 1.4 (layout and design pins) | `src/app/(dashboard)/review/layout-360.test.tsx`, `src/app/(dashboard)/review/design-system.test.tsx`                                                                                     | Component          | Existing suites green                            | Pass at write (the banner module existed from unit 1); mutation check below | Pass                                                        | Banner: no width above 360 px, axe es and en, long answer wraps, card tokens                                                                                                                                            | None needed |
| 1.7 and 1.8                  | `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`, `src/app/(dashboard)/review/[id]/request-sections.test.tsx`, `src/app/(dashboard)/review/[id]/page.test.tsx`, review-messages | Component          | Existing cases of the four files green           | 14 cases failed first (notice, pointer count, copy, page pass-down)         | 4 files, 282 passed                                         | Notice present, informational, second escalation, null and omitted, long answer, Spanish (7 cases); pointer for 2, 1, 0, no text, Spanish (5 cases)                                                                     | None needed |
| 1.9                          | `src/app/(dashboard)/review/[id]/answer-banner.test.tsx`                                                                                                                                  | Structural pin     | N/A                                              | Pass at write; mutation check below                                         | 15 passed                                                   | Single importer                                                                                                                                                                                                         | None needed |

### Mutation checks (revert-only; the file was confirmed clean after each)

| Pass-at-write test                                                                                                                                                            | Temporary edit                                                                                                                                                                                                                            | Result                                    | Reverted                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| layout-360 "answer banner sets no width above the viewport"; design-system "frames the answer banner as a card"; layout-360 long answer wraps; design-system fixed-width scan | In `src/app/(dashboard)/review/[id]/answer-banner.tsx`: add a fixed width of 400 px, drop the "bg-primary/5" tint, drop "break-words" and "whitespace-pre-wrap"                                                                           | 4 tests failed, as expected               | "git restore"                                            |
| 1.9 structural pin                                                                                                                                                            | Import the banner in `src/app/(dashboard)/requests/[id]/page.tsx`                                                                                                                                                                         | The pin failed (2 importers instead of 1) | "git restore"                                            |
| "still escalates a second time"; "no notice when omitted or null"; "no pointer when never escalated"                                                                          | In `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`: confirm does nothing when an earlier answer exists, and the notice always renders. In `src/app/(dashboard)/review/[id]/request-sections.tsx`: the pointer renders for 0 records | 4 tests failed, as expected               | Restored from a byte-identical backup copy (deviation 4) |
| layout-360 "escalate dialog with a long earlier answer"                                                                                                                       | Drop "break-words" and "whitespace-pre-wrap" from the notice text                                                                                                                                                                         | 1 test failed, as expected                | Restored from the backup copy                            |

### Checkpoint (task 1.11): measured size

Measure: "git diff --numstat feat/flow-experience...HEAD" excluding "openspec/" and ".engram/" (additions plus deletions).

| Scope                                                      | Changed lines              |
| ---------------------------------------------------------- | -------------------------- |
| Unit 1 (banner module, i18n, tests)                        | 319                        |
| Unit 2 (page, decision copy, layout and design pins, i18n) | 235                        |
| Units 1 and 2 (branch "-1-answer-banner")                  | 554 (551 added, 3 deleted) |
| Unit 3 (dialog notice, history pointer, pass-down, i18n)   | 440                        |
| All of S1 (tip of "-1b-escalate-dialog-pointer")           | 994 (985 added, 9 deleted) |

Production code is 216 of the 994 lines (banner module 92, dialog 43, page 29, sections 18, two catalogs 34); tests are 778 (78 percent). The design forecast was about 200, and the 1.3x to 1.8x precedent ratio would give 260 to 360; the slice is 4.9 times the forecast. The stop line is 460 and it is exceeded. The plan's cut point (after unit 2) does not bring the first part under the line either: units 1 and 2 alone are 554. Unit 3 alone (440) is under the line. Tests were not trimmed. Decision needed from the owner; task 1.13 is held.

### Work unit evidence

| Evidence                              | Value                                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/app/(dashboard)/review src/i18n": 38 files, 1351 tests, all passed (tip of "-1b-escalate-dialog-pointer") |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-16_c" on "flow-it" (task 12.6) is not part of Phase 1, and no database or Neon command was run                                    |
| Rollback boundary                     | Revert the PR (units 1 and 2, then unit 3 if shipped): the staff detail returns to the buried answer. No data, no schema, no audit event type                                |

### Gates (task 1.12), tip of "-1b-escalate-dialog-pointer", dummy DB

- Full "npm test": 368 files, 8987 tests, all passed, 242.4 s vitest duration (4 m 04 s wall). The Phase 0 baseline was a subset (242 files, 6461 tests). S1 adds one test file and 50 new "it" blocks (table rows expand to more cases).
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (147453 lines; the working tree is CRLF), the only findings are three in files S1 does not touch: a warning for the unused `SidebarGroupLabel` in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the S1 files alone is clean, and "npx prettier --check" passes on every touched file.

### Files (all LF in the working tree; the index was already LF)

| File                                                                                                                                                                                                                                                                                                                | Action                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/app/(dashboard)/review/[id]/answer-banner.tsx`                                                                                                                                                                                                                                                                 | Created: latestAnswer, AnswerBanner, ANSWER_DATE_OPTIONS                        |
| `src/app/(dashboard)/review/[id]/answer-banner.test.tsx`                                                                                                                                                                                                                                                            | Created: 15 cases, with the importer pin                                        |
| `src/app/(dashboard)/review/[id]/page.tsx`                                                                                                                                                                                                                                                                          | Modified: banner first, decision copy, previousAnswer and escalations pass-down |
| `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`                                                                                                                                                                                                                                                               | Modified: optional previousAnswer prop and notice                               |
| `src/app/(dashboard)/review/[id]/request-sections.tsx`                                                                                                                                                                                                                                                              | Modified: HistorySection prop escalations and pointer                           |
| `src/app/(dashboard)/review/[id]/page.test.tsx`, `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`, `src/app/(dashboard)/review/[id]/request-sections.test.tsx`, `src/app/(dashboard)/review/layout-360.test.tsx`, `src/app/(dashboard)/review/design-system.test.tsx`, `src/i18n/review-messages.test.ts` | Modified: new cases                                                             |
| `i18n/es.json`, `i18n/en.json`                                                                                                                                                                                                                                                                                      | Modified: the keys listed below                                                 |

### Final Spanish UI copy added (staff screens, "usted")

- "review.detail.answerBanner.title": "Respuesta de coordinación"
- "review.detail.answerBanner.byline": "{name}, {date}"
- "review.detail.answerBanner.hint": "Tenga en cuenta esta respuesta al decidir."
- "review.detail.answerBanner.link": "Ver el escalamiento completo"
- "review.detail.decisionPanel.descriptionAnswered": "La coordinación ya respondió esta solicitud (vea la respuesta al inicio de esta página) y la decisión ahora es suya. Apruebe, devuelva para corrección o rechace la solicitud. Cada decisión le pide confirmarla."
- "review.escalation.dialog.previousAnswer.title": "La coordinación ya respondió esta solicitud ({byline}):"
- "review.escalation.dialog.previousAnswer.hint": "Si la escala de nuevo, vuelve a coordinación y no podrá decidir hasta que responda."
- "review.detail.history.escalations": "{count, plural, one {Esta solicitud tiene # escalamiento a coordinación.} other {Esta solicitud tiene # escalamientos a coordinación.}} Los detalles y las respuestas están en la sección «Escalamientos a coordinación»."
- "review.detail.history.escalationsLink": "Ir a los escalamientos"

English twins: "Coordination answer"; "Take this answer into account when you decide."; "See the full escalation"; "Coordination has already answered this request (see the answer at the top of this page) and the decision is now yours. Approve, return for correction or reject the request. Each decision asks you to confirm it."; "Coordination already answered this request ({byline}):"; "If you escalate it again, it goes back to coordination and you cannot decide until it answers."; the plural pointer; "Go to the escalations".

### Deviations

1. **Slice over the stop line, cut applied, PR held.** S1 measures 994 lines; units 1 and 2 are 554. Unit 3 lives on "-1b-escalate-dialog-pointer". No push and no PR 1: task 1.13 waits for the owner.
2. **Decision copy.** The design sentence "Si necesita otra opinión, puede escalarla de nuevo" is not used: FE-4 forbids telling the secretary to escalate to obtain the coordination's opinion, and the spec governs. The decided copy ends with the confirmation sentence instead. The second escalation stays allowed and is explained in the dialog notice (FE-12).
3. **Pass-down moved to unit 3.** Task 1.5 lists the pass of previousAnswer and the escalations count in `src/app/(dashboard)/review/[id]/page.tsx`, but those props only exist after unit 3, so unit 2 would not typecheck. Those lines are in unit 3 (the page is touched by both commits).
4. **Mutation checks with an uncommitted GREEN.** Task 1.9 asks for "git restore"; for the unit 3 files the GREEN was not committed yet, so a byte-identical backup copy was restored (checked with "cmp") instead.
5. **Props.** previousAnswer is optional (default null) so existing renders of the dialog stay valid; HistorySection's escalations is required, as the design says.
6. **Extra keys and tests.** The banner has the design's "byline" and "link" keys beyond the two the task names. Extra tests beyond the list: two page-level cases for the pass-down, a long answer in the open dialog at 360 px, and the banner card tokens in design-system.
7. **Keyboard access.** The scrollable answer box in the dialog has "tabIndex={0}" so the overflow can be scrolled from the keyboard.
8. **Line endings.** The touched files were CRLF in the working tree (index LF); they were converted to LF without changing the index content.

### Notes for S2 (RF-06, "Vence primero")

- Base: S2 is planned from the PR 1 branch. If the owner accepts the split, S2 stacks on "-1b-escalate-dialog-pointer" (the tip with all of S1); if the owner prefers one PR for all of S1 with a size exception, S2 stacks on that.
- S2 overlaps S1 only in `src/i18n/review-messages.test.ts`, `src/app/(dashboard)/review/layout-360.test.tsx` and `src/app/(dashboard)/review/design-system.test.tsx` (append-only blocks), and in `i18n/es.json` and `i18n/en.json` (new keys under "review.queue").
- Tests are about 78 percent of S1 lines. The S2 forecast is about 100 lines; expect 250 to 350. Plan one commit and check the stop line at the checkpoint.
- The design-system test scans every production module of the review directory for spacing steps, raw colours and fixed widths, so a new module such as `src/app/(dashboard)/review/deadline-badge.tsx` is checked automatically.
- Tooling: shell commands that carry a backslash lose it in this environment, so write patch scripts as files and use the Edit tool for regular expressions. A catalog insert helper exists in the scratchpad ("i18n-set.cjs"). Run "npx prettier --write" on a test file before the gates to avoid one-line prettier errors.

## Phase 2 (PR 2): S2 RF-06, "Vence primero" and the deadline-order description

Mode: Strict TDD. Date: 2026-11-20. Branch "feat/flow-experience-2-first-due", cut from the tip of "feat/flow-experience-1b-escalate-dialog-pointer" (19b98f3, all of S1). One work unit (unit 4), one code commit. Size exception per the owner decision of 2026-11-20 (see Phase 1).

### Commits

| Unit | Hash    | Message                                                            |
| ---- | ------- | ------------------------------------------------------------------ |
| 4    | 37ca062 | feat(review): state the queue order and mark the request due first |
| docs | (tip)   | docs(flow-experience): record the Phase 2 apply progress           |

### TDD cycle evidence

| Task        | Test file                                                                                             | Layer            | Safety net                                           | RED                                                                                                                                                                                                                  | GREEN                                                                       | Triangulation                                                                                                                                                                                                                                                                                             | Refactor    |
| ----------- | ----------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 2.1 and 2.2 | `src/app/(dashboard)/review/page.test.tsx`                                                            | Component (page) | Existing cases of the file passing before the change | 10 of the 21 RED failures: description en and es, mark on row 1 (table and cards), accessible name, overdue and due-soon next to it, ids 4 and 7, position, Spanish, term matching row 1, term matching several rows | Review directory, review-messages and revision-queue: 31 files, 1089 passed | Description en and es and the other two tabs; one mark per layout; accessible name; overdue next to it; equal deadlines (ids 4 and 7); queue position beats presentation date; Spanish; search hides row 1, matches row 1, matches several rows, matches none; empty queue; two other tabs; one audit row | None needed |
| 2.1 and 2.2 | `src/app/(dashboard)/review/review-queue-table.test.tsx`                                              | Component        | Existing cases passing                               | 1 case failed first (the mark in the deadline cell and in the row name); the null case passes at write                                                                                                               | Pass                                                                        | Mark present in cell 5, in the name of its row only; null label renders nothing; the row keys list gains "firstDueLabel"                                                                                                                                                                                  | None needed |
| 2.1 and 2.2 | `src/app/(dashboard)/review/design-system.test.tsx`, `src/app/(dashboard)/review/layout-360.test.tsx` | Component        | Existing suites green                                | 2 design-system and 3 layout-360 cases failed first (export missing)                                                                                                                                                 | Pass                                                                        | Neutral pill classes, no warning or alarm tint, told apart from the on-time state by weight and ink, no width above 360 px, axe es and en inside a card list                                                                                                                                              | None needed |
| 2.1 and 2.2 | `src/i18n/review-messages.test.ts`                                                                    | Unit             | Existing cases passing                               | 5 cases failed first (description es and en, no age wording es and en, mark)                                                                                                                                         | Pass                                                                        | Exact copy es and en; the other two tab descriptions pinned unchanged                                                                                                                                                                                                                                     | None needed |
| 2.3         | `src/lib/data/revision-queue.test.ts` (read-only)                                                     | Unit             | N/A                                                  | Pass at write (4.9:20 order tests, no edit)                                                                                                                                                                          | 28 passed                                                                   | Three-way effective start then id; paused days move the deadline; the order the database returned is kept                                                                                                                                                                                                 | N/A         |

### Mutation checks (revert-only; every file was restored from a byte-identical backup copy and confirmed with "cmp", because the GREEN was not committed yet)

| Pass-at-write test                                                                                                                          | Temporary edit                                                                                                         | Result                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| page "shows no mark and does not move it when the term hides row 1"                                                                         | In `src/app/(dashboard)/review/page.tsx`: firstDueId from visibleRows[0] instead of queue.rows[0]                      | Failed, with 7 other cases that depend on row 1 |
| review-queue-table "renders no first-due mark when the label is null"                                                                       | In `src/app/(dashboard)/review/review-queue-table.tsx`: always render the badge, label falling back to the text        | Failed                                          |
| review-messages and page "keeps the descriptions of the other two tabs"                                                                     | In `i18n/en.json`: change the coordination description                                                                 | Both failed                                     |
| page "is absent from an empty queue", "is absent from the En coordinacion and Aprobadas tabs", "writes one queue-read row ... search hides" | In `src/app/(dashboard)/review/page.tsx`: a badge in the other-tab branch and in the empty branch, a second audit call | 8 failed, including those three                 |
| page "shows no mark when nothing matches"                                                                                                   | In `src/app/(dashboard)/review/page.tsx`: a badge beside the no-results state                                          | Failed                                          |

### Checkpoint (task 2.5): measured size

Measure: the diff of the unit against its base (the tip of "-1b-escalate-dialog-pointer"), excluding "openspec/" and ".engram/".

| Scope                                                                           | Changed lines |
| ------------------------------------------------------------------------------- | ------------- |
| Production code (badge 14, page 27, table 10, two catalogs 6)                   | 57            |
| Tests (page 286, table 29, design-system 42, layout-360 11, review-messages 46) | 414           |
| All of S2 (460 added, 11 deleted)                                               | 471           |

The design forecast was about 100; the slice is 4.7 times that. It is 11 lines over the 460 stop line, which is "about 460". It is not cut: the planned cut list has no boundary inside PR 2, the only seam is FE-1 (the description, about 70 lines of copy and tests) against FE-2 (the mark), both share the same test files and the same commit, and a 70-line PR 2a would only add a stacked branch. Tests are 88 percent of the lines and were not trimmed. Size exception per the owner decision of 2026-11-20.

### Work unit evidence

| Evidence                              | Value                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command and exact result | "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/app/(dashboard)/review src/i18n/review-messages src/lib/data/revision-queue": 31 files, 1089 tests, all passed                                                                                                                      |
| Runtime harness                       | N/A in this run: the owner-run check on "flow-it" with the seeded queue (task 12.6) is not part of Phase 2, and no database or Neon command was run                                                                                                                                                    |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/review/deadline-badge.tsx` loses FirstDueBadge, `src/app/(dashboard)/review/page.tsx` and `src/app/(dashboard)/review/review-queue-table.tsx` lose the mark, and the Pendientes description returns. Copy and marker only; no data, no schema, no audit event type |

### Gates (task 2.6), tip of "-2-first-due", dummy DB

- Full "npm test": 368 files, 9016 tests, all passed, 248.0 s vitest duration (4 m 10 s wall). Phase 1 was 368 files and 8987 tests; S2 adds 29 tests and no file.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (145879 lines; the working tree is CRLF outside the touched files), the only findings are the same three in files S2 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the S2 files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.
- "npm test -- src/i18n": 9 files, 421 tests, all passed.

### Files (all LF in the working tree; the index was already LF)

| File                                                                                                                                                                                                                                            | Action                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/app/(dashboard)/review/deadline-badge.tsx`                                                                                                                                                                                                 | Modified: FirstDueBadge (neutral pill, no hooks)                                     |
| `src/app/(dashboard)/review/page.tsx`                                                                                                                                                                                                           | Modified: firstDueId before the search, badge in the card deadline, label to the row |
| `src/app/(dashboard)/review/review-queue-table.tsx`                                                                                                                                                                                             | Modified: row field firstDueLabel, rendered in the deadline cell                     |
| `src/app/(dashboard)/review/page.test.tsx`, `src/app/(dashboard)/review/review-queue-table.test.tsx`, `src/app/(dashboard)/review/design-system.test.tsx`, `src/app/(dashboard)/review/layout-360.test.tsx`, `src/i18n/review-messages.test.ts` | Modified: new cases                                                                  |
| `i18n/es.json`, `i18n/en.json`                                                                                                                                                                                                                  | Modified: "review.queue.description" (replaced) and "review.queue.firstDue" (new)    |

### Final Spanish UI copy added (staff screen "review", "usted")

- "review.queue.description" (replaces "Solicitudes pendientes de su facultad, de la más antigua a la más reciente."): "Solicitudes pendientes de su facultad, ordenadas por vencimiento del plazo: primero la que vence antes."
- "review.queue.firstDue": "Vence primero"

English twins: "Pending requests of your faculty, ordered by deadline: the one due first comes first."; "Due first". The descriptions of the other two tabs are unchanged.

### Deviations

1. **Branch base.** Task 2.0 says "from the PR 1 branch"; the owner's run order cut it from the tip of "feat/flow-experience-1b-escalate-dialog-pointer" (the tip with all of S1), as the S1 notes planned. The PR targets that branch (stacked on #110), not "feat/flow-experience-1-answer-banner".
2. **Slice 471 lines, one PR.** See the checkpoint: 11 lines over "about 460"; no natural boundary inside the unit; recorded under the owner's size exception.
3. **Test file for the layout pin.** The 360 px axe check renders the mark inside a list item (a card), because axe reports no applicable rule for a lone span. The width check and the axe check cover the same component as the other describe.each entries.
4. **Mutation checks with an uncommitted GREEN.** As in S1: byte-identical backup copies restored, checked with "cmp".
5. **Task 2.7 is marked in Phase 3.** The PR number does not exist until the PR is opened, so the S3 docs commit records it.
6. **Line endings.** Five production and test files were CRLF in the working tree (index LF); converted to LF without changing the index content.

## Phase 3 (PR 3): S3 RF-10, required note and stale errors

Mode: Strict TDD. Date: 2026-11-20. Size exception per the owner decision of 2026-11-20 (see Phase 1). The slice measured 690 changed lines before any cut (unit 5: 151, unit 6: 539), so it is cut at its natural unit boundary into two PRs, as S1 was:

- **PR 3a**, branch "feat/flow-experience-3-dialog-errors", cut from the tip of "feat/flow-experience-2-first-due" (7a38971): unit 5 (the helper and the required mark) and unit 6a (the escalate dialog adopts both, plus its copy). 429 changed lines.
- **PR 3b**, branch "feat/flow-experience-3b-report-answer-errors", cut from the tip of PR 3a: unit 6b (the report dialog and the coordinator answer adopt the same helper, RNF-12).

The motive "otro" is NOT part of this slice (S8).

### Commits (PR 3a)

| Unit | Hash    | Message                                                                              |
| ---- | ------- | ------------------------------------------------------------------------------------ |
| 5    | 12c920a | feat(review): add the helper that clears stale dialog errors                         |
| 6a   | 53d7cd1 | fix(review): clear escalate dialog field errors on change and mark the note required |
| docs | (tip)   | docs(flow-experience): record the Phase 3 apply progress for PR 3a                   |

### TDD cycle evidence (PR 3a)

| Task        | Test file                                                     | Layer              | Safety net                       | RED                                                                                                                                                           | GREEN                                                                    | Triangulation                                                                                                                                                                                                                                                                                               | Refactor    |
| ----------- | ------------------------------------------------------------- | ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 3.1 and 3.2 | `src/app/(dashboard)/review/[id]/dialog-parts.test.tsx` (new) | Unit and component | N/A (new file)                   | 11 of 14 cases failed first (the export was missing, and the required mark was absent); the three pass-at-write cases pin the unchanged optional behaviour    | 14 passed                                                                | Truth table of withoutFieldErrors: null in, four failures that name no field (same reference back), one field removed, several errors of one field, last error gives null, field with no error (same reference), frozen input never mutated; required mark on, undefined, false, never the native attribute | None needed |
| 3.4 and 3.5 | `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`    | Component          | Existing cases of the file green | 7 cases failed first: label and hint en, label and hint es, motive error clears, note error clears, no banner in either order, still-invalid form fails again | review directory, coordination directory and i18n: 43 files, 1523 passed | Label and hint en and es, no native required; both errors; motive clears only itself; note clears only itself; no banner in two orders; a second confirmation brings the note error back; conflict, not_found, unexpected and no-coordination persist while editing (4 cases); reopening starts clean       | None needed |
| 3.4 and 3.5 | `src/i18n/review-messages.test.ts`                            | Unit               | Existing cases green             | 2 cases failed first (exact label and hint, es and en); the staff-only statement and the other note labels pass at write                                      | Pass                                                                     | Exact copy es and en; hint keeps the staff-only statement and no informal address; the report and answer labels pinned unchanged                                                                                                                                                                            | None needed |

### Mutation checks (revert-only; files restored from byte-identical backup copies, checked with "cmp", because the GREEN was not committed yet)

| Pass-at-write test                                                                                                                     | Temporary edit                                                                                             | Result                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| dialog-parts "announces nothing when required is undefined or false" and "never turns on the browser's own validation"                 | In `src/app/(dashboard)/review/[id]/dialog-parts.tsx`: the mark always on, plus the native attribute       | 3 failed                                                   |
| escalate-dialog "keeps the %s message while the fields are edited" (4 cases)                                                           | In `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`: a motive change clears the whole failure         | 5 failed, the 4 persistence cases and the motive-only case |
| escalate-dialog "starts with no message when the dialog is reopened"                                                                   | In `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`: the discard keeps the failure                    | Failed                                                     |
| escalate-dialog "shows both errors after confirming with nothing filled"                                                               | In `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`: the motive messages are never read               | 8 failed, including it                                     |
| escalate-dialog "does not turn on the browser's validation"                                                                            | In `src/app/(dashboard)/review/[id]/dialog-parts.tsx`: add the native "required" next to the aria mark     | Failed                                                     |
| review-messages "keeps the staff-only statement and no informal address" and "leaves the labels of the other note fields as they were" | In `i18n/en.json` and `i18n/es.json`: the report label shortened, the Spanish hint in the informal address | 3 failed, including both                                   |

### Checkpoint (task 3.8): measured size of PR 3a

Measure: "git diff --numstat feat/flow-experience-2-first-due...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                                   | Changed lines |
| ----------------------------------------------------------------------- | ------------- |
| Unit 5 (helper, required mark, their tests)                             | 151           |
| Unit 6a (escalate dialog, its tests, the two catalogs, the i18n pin)    | 278           |
| All of PR 3a (422 added, 7 deleted; production 50 and tests 379)        | 429           |
| Unit 6b (report dialog, coordinator answer, their tests) before the cut | 261           |
| All of S3 before the cut                                                | 690           |

The design forecast for S3 was about 110; the slice is 6.3 times that. Unit 6 alone is 539, so the cut is inside unit 6, at the seam the design draws: the escalate dialog (FE-10 and FE-11 for the dialog the requirement names) against the two dialogs that adopt the helper only for consistency (RNF-12). Tests are 88 percent of the lines and were not trimmed.

### Work unit evidence (PR 3a)

| Evidence                              | Value                                                                                                                                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/app/(dashboard)/review src/app/(dashboard)/coordination src/i18n": 43 files, 1523 tests, all passed                                                                                          |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-10_b" on "flow-it" (task 12.7) is not part of Phase 3, and no database or Neon command was run                                                                                                                       |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/review/[id]/dialog-parts.tsx` loses the helper and the mark, `src/app/(dashboard)/review/[id]/escalate-dialog.tsx` returns to its old behaviour, and the two catalog labels return. No data, no schema, no audit event type |

### Gates (PR 3a), tip of "-3-dialog-errors", dummy DB

- Full "npm test": 369 files, 9049 tests, all passed, 257.5 s vitest duration (4 m 20 s wall). PR 2 was 368 files and 9016 tests; PR 3a adds one test file (dialog-parts) and 33 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (145008 lines), the only findings are the same three in files PR 3a does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.
- "npm test -- src/app/(dashboard)/review src/app/(dashboard)/coordination src/i18n": 43 files, 1523 tests, all passed.

### Files (PR 3a; all LF in the working tree, the index was already LF)

| File                                                                                           | Action                                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/app/(dashboard)/review/[id]/dialog-parts.tsx`                                             | Modified: withoutFieldErrors, optional "required" of NoteField (aria-required only) |
| `src/app/(dashboard)/review/[id]/dialog-parts.test.tsx`                                        | Created: 14 cases                                                                   |
| `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`                                          | Modified: field errors cleared on change, NoteField required                        |
| `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`, `src/i18n/review-messages.test.ts` | Modified: new cases                                                                 |
| `i18n/es.json`, `i18n/en.json`                                                                 | Modified: "review.escalation.dialog.noteLabel" and "noteHint" (replaced)            |

### Final Spanish UI copy added so far (staff screen "review", "usted")

- "review.escalation.dialog.noteLabel" (replaces "Nota para coordinación"): "Nota para coordinación (obligatoria)"
- "review.escalation.dialog.noteHint" (replaces "Explique por qué escala la solicitud a coordinación. Solo la ve el personal."): "Explique por qué escala la solicitud; por ejemplo, qué dato del documento no coincide o qué situación no prevé el reglamento. Solo la ve el personal."

English twins: "Note for coordination (required)"; "Explain why you are escalating the request; for example, which document detail does not match or which situation the regulation does not cover. Only staff can see it." The labels of the report dialog ("Nota (opcional)") and of the coordinator answer ("Respuesta para la secretaría") are unchanged.

### Deviations (PR 3a)

1. **Branch names.** Task 3.0 says "feat/flow-experience-3-note-errors"; the owner's run order says "feat/flow-experience-3-dialog-errors", which is used. The cut branch is "feat/flow-experience-3b-report-answer-errors".
2. **Cut inside unit 6.** Tasks 3.4 and 3.5 name one commit for the escalate dialog, the report dialog and the answer form; the 539-line unit is split in two commits, one per PR (6a and 6b), because it is over the stop line on its own.
3. **Branch base.** The PR targets "feat/flow-experience-2-first-due" (stacked on PR 2), as planned.
4. **Mutation checks with an uncommitted GREEN.** As in S1 and S2: byte-identical backup copies restored and checked with "cmp".
5. **Task 3.6.** The planned mutation (drop the motive clear in the escalate dialog, the motive case must fail) is done in a stronger form: the clear is replaced by clearing the whole failure, and five cases fail, including the motive-only case.
6. **Line endings.** Four production and test files were CRLF in the working tree (index LF); converted to LF without changing the index content.

### PR 3b: the report dialog and the coordinator answer adopt the helper (unit 6b)

Branch "feat/flow-experience-3b-report-answer-errors", cut from the tip of PR 3a ("feat/flow-experience-3-dialog-errors", a251e2d). It targets that branch. The motive "otro" is still not part of S3 (S8).

#### Commits (PR 3b)

| Unit | Hash    | Message                                                            |
| ---- | ------- | ------------------------------------------------------------------ |
| 6b   | 33a3f7f | fix(review): clear report and answer dialog field errors on change |
| docs | (tip)   | docs(flow-experience): record the Phase 3 apply progress for PR 3b |

#### TDD cycle evidence (PR 3b)

| Task        | Test file                                                    | Layer     | Safety net                       | RED                                                                                                                                                                          | GREEN                                                                    | Triangulation                                                                                                                                                                                                             | Refactor                                                                |
| ----------- | ------------------------------------------------------------ | --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 3.4 and 3.5 | `src/app/(dashboard)/review/[id]/report-dialog.test.tsx`     | Component | Existing cases of the file green | 5 cases failed first: teacher clears, date clears, note clears, no banner once cleared, still-invalid form fails again; the form-level and optional-note cases pass at write | review directory, coordination directory and i18n: 43 files, 1535 passed | Each of the three fields clears only itself; no banner once every field error is cleared; a still-invalid confirmation brings the error back; a conflict persists while editing; the optional note is not marked required | One existing test edited (see deviation 2): it now releases its promise |
| 3.4 and 3.5 | `src/app/(dashboard)/coordination/[id]/answer-form.test.tsx` | Component | Existing cases of the file green | 2 cases failed first: the text error clears, no banner once cleared; the still-empty confirmation and the two persistence cases pass at write                                | Pass                                                                     | The text error clears and the field loses aria-invalid; no banner; a second confirmation with the text still empty shows the error again; conflict and unexpected persist while editing                                   | None needed                                                             |

#### Mutation checks (revert-only; files restored from byte-identical backup copies, checked with "cmp")

| Pass-at-write test                                                                | Temporary edit                                                                                                | Result                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| report-dialog "keeps the form-level message while the fields are edited"          | In `src/app/(dashboard)/review/[id]/report-dialog.tsx`: the teacher and note changes clear the whole failure  | 3 failed, including it                                                     |
| report-dialog "does not mark the optional note as required"                       | In `src/app/(dashboard)/review/[id]/report-dialog.tsx`: pass "required" to the note                           | Failed                                                                     |
| answer-form "keeps the conflict and unexpected messages while the text is edited" | In `src/app/(dashboard)/coordination/[id]/answer-form.tsx`: a change clears the whole failure                 | 2 failed, both persistence cases                                           |
| answer-form "fails again when the text is still empty on the next confirmation"   | In `src/app/(dashboard)/coordination/[id]/answer-form.tsx`: only the first result of the action is ever shown | 12 failed, including it (a global counter, so every later case also fails) |

#### Checkpoint (task 3.8): measured size of PR 3b

Measure: "git diff --numstat feat/flow-experience-3-dialog-errors...HEAD" excluding "openspec/" and ".engram/".

| Scope                                        | Changed lines |
| -------------------------------------------- | ------------- |
| Production (report dialog 18, answer form 6) | 24            |
| Tests (report dialog 152, answer form 85)    | 237           |
| All of PR 3b (256 added, 5 deleted)          | 261           |
| PR 3a (units 5 and 6a)                       | 429           |
| All of S3 (units 5, 6a and 6b)               | 690           |

Both parts are under the 460 stop line. Tests were not trimmed.

#### Work unit evidence (PR 3b)

| Evidence                              | Value                                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/app/(dashboard)/review src/app/(dashboard)/coordination src/i18n": 43 files, 1535 tests, all passed                                                                   |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-10_b" on "flow-it" (task 12.7) is not part of Phase 3, and no database or Neon command was run                                                                                                |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/review/[id]/report-dialog.tsx` and `src/app/(dashboard)/coordination/[id]/answer-form.tsx` return to keeping their field errors until the next confirmation. No data, no schema, no audit event type |

#### Gates (task 3.9), tip of "-3b-report-answer-errors", dummy DB

- Full "npm test": 369 files, 9061 tests, all passed, 249.9 s vitest duration (4 m 12 s wall). PR 3a was 369 files and 9049 tests; PR 3b adds 12 tests and no file. Against PR 2 (368 files, 9016 tests) all of S3 adds one file and 45 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (145008 lines), the only findings are the same three in files S3 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on all the S3 files (and S2) is clean, and "npx prettier --check" passes on every touched file and on both catalogs.
- "npm test -- src/app/(dashboard)/review src/app/(dashboard)/coordination src/i18n": 43 files, 1535 tests, all passed.

#### Files (PR 3b; all LF in the working tree, the index was already LF)

| File                                                                                                                   | Action                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/app/(dashboard)/review/[id]/report-dialog.tsx`                                                                    | Modified: teacher, date and note changes clear their own field errors |
| `src/app/(dashboard)/coordination/[id]/answer-form.tsx`                                                                | Modified: a text change clears its field error                        |
| `src/app/(dashboard)/review/[id]/report-dialog.test.tsx`, `src/app/(dashboard)/coordination/[id]/answer-form.test.tsx` | Modified: new cases                                                   |

No Spanish UI copy is added in PR 3b: the report dialog and the coordinator answer keep their labels. The final Spanish copy of all of S3 is the two keys listed under PR 3a ("review.escalation.dialog.noteLabel" and "review.escalation.dialog.noteHint").

#### Deviations (PR 3b)

1. **Cut.** PR 3b exists only because S3 measured 690 lines (see PR 3a). The report dialog and the coordinator answer adopt the helper exactly as task 3.5 lists.
2. **One existing test edited.** In `src/app/(dashboard)/review/[id]/report-dialog.test.tsx`, "sends nothing twice while the first confirm is still running" used a promise that never settles. React entangles async actions across roots, so every later test of the file kept its confirm button pending. The test now holds the promise and releases it at the end; its assertions are unchanged.
3. **Task 3.6 and the answer form.** The report dialog and the answer form have no "otro" and no motive; the mutation checks above stand in for task 3.6 on those two files.

### Notes for S4 (RF-07, cards that tell requests apart)

- Base: S4 stacks on "feat/flow-experience-3b-report-answer-errors", the tip with all of S3.
- Task 4.1 is an [ASK OWNER] confirmation of two defaults. Owner resolution 3 of 2026-11-20 already fixes (b), at most 140 characters in up to 2 lines; (a), the excerpt on an "aprobada" card, is only in the spec (FE-15) and the design did not list it, so it still needs the owner's go-ahead before unit 7 starts.
- S4 does not overlap S3 files: it touches `src/lib/data/student-requests.ts`, `src/lib/data/decision-excerpt.ts` (new), `src/app/(dashboard)/requests/request-card.tsx`, `src/app/(dashboard)/requests/page.tsx`, their tests, `src/i18n/requests-messages.test.ts` and the "requests.list" keys of both catalogs. The student screens use "tú".
- Size: tests are 88 percent of S2 and S3 lines; the forecast of about 250 will run 2 to 3 times higher, so plan the cut the tasks name (after unit 7: the data layer and its excerpt helper, 4.2 to 4.7; then the card, 4.8 to 4.10) and measure at each unit.
- React async transitions: a test that leaves a never-settling server action pending keeps every later "isPending" in the same file true (React entangles async actions across roots). Resolve promises of mocked actions at the end of the test.
- Tooling: write patch scripts as files; the helpers in the scratchpad ("i18n-set.cjs", the append and the line-ending scripts) work as before. the owner's rules ask for "rg", "fd", "bat", "eza" and "sd"; only "rg" is installed here, so use "rg", Node scripts and the Read and Edit tools. After "git show HEAD:<path> > <path>" the file is LF, which is what the index holds.
